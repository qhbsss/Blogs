[TOC]

# 自增主键的作用
自增主键是指自增列上定义的主键，在建表语句中一般是这么定义的： NOT NULL PRIMARY KEY AUTO_INCREMENT。
## 自增主键的作用
### 插入时不改变索引B+树结构
插入新记录的时候可以不指定 ID 的值，系统会获取当前 ID 最大值加 1 作为下一条记录的 ID值。
也就是说，**自增主键的插入数据模式，正符合了我们前面提到的递增插入的场景。每次插入一条新记录，都是追加操作，都不涉及到挪动其他记录，也不会触发叶子节点的分裂。**
而有业务逻辑的字段做主键，则往往不容易保证有序插入，这样写数据成本相对较高。
### 节省存储空间
除了考虑性能外，我们还可以从存储空间的角度来看。假设你的表中确实有一个唯一字段，比如字符串类型的身份证号，那应该用身份证号做主键，还是用自增字段做主键呢？
由于每个非主键索引的叶子节点上都是主键的值。如果用身份证号做主键，那么每个二级索引的叶子节点占用约 20 个字节，而如果用整型做主键，则只要 4 个字节，如果是长整型（bigint）则是 8 个字节。
显然，主键长度越小，普通索引的叶子节点就越小，普通索引占用的空间也就越小。
所以，从性能和存储空间方面考量，自增主键往往是更合理的选择。
## 适合业务字段做主键的场景
有没有什么场景适合用业务字段直接做主键的呢？还是有的。比如，有些业务的场景需求是这样的：
1. 只有一个索引；
2. 该索引必须是唯一索引。
你一定看出来了，这就是典型的 KV 场景。
由于没有其他索引，所以也就不用考虑其他索引的叶子节点大小的问题。
这时候我们就要优先考虑上一段提到的“尽量使用主键查询”原则，直接将这个索引设置为主
键，可以避免每次查询需要搜索两棵树。

# change buffer
## 概念
在MySQL5.5之前，叫插入缓冲（Insert Buffer），只针对INSERT做了优化；现在对DELETE和UPDATE也有效，叫做写缓冲（Change Buffer）。

它是一种应用在**非唯一普通索引页（non-unique secondary index page）**不在缓冲池中，对页进行了写操作，并不会立刻将磁盘页加载到缓冲池，而仅仅记录缓冲变更（Buffer Changes），等未来数据被读取时，再将数据合并（Merge）恢复到缓冲池中的技术。**写缓****冲的目的是降低写操作的磁盘IO，提升数据库性能。
## 原理
当需要更新一个数据页时，如果数据页在内存中就直接更新，而如果这个数据页还没有在内存中的话，在不影响数据一致性的前提下，InooDB会将这些更新操作缓存在change buffer中，这样就不需要从磁盘中读入这个数据页了。在下次查询需要访问这个数据页的时候，将数据页读入内存，然后执行change buffer中与这个页有关的操作。change buffer在内存中有拷贝，也会被写入到磁盘上。
将change buffer中的操作应用到原数据页，得到最新结果的过程称为merge。
merge的执行流程是这样的：
1. 从磁盘读入数据页到内存（老版本的数据页）；
2. 从change buffer里找出这个数据页的change buffer记录(可能有多个），依次应用，得到新版数据页；
3. 写redo log。这个redo log包含了数据的变更和change buffer的变更。
eg:
假设执行以下插入语句：

```
mysql> insert into t(id,k) values(id1,k1),(id2,k2)
```
假设k1所在的数据页在内存中，k2所在的数据页不在内存中。则在更新语句执行时，在内存中的page1上的记录直接更新（1），而未在内存中的page2（2），就在change buffer中记录更新操作（2），并将上述操作记录到redo log中（3，4），如下图所示：
![](./images/1726624344548_image.png)
之后如果需要执行查询操作：
mysql> select * from t where k in (k1, k2)
则page1上的记录直接从内存返回，而page2则要先被从磁盘读入内存中，再应用change buffer里面的操作
日志，生成一个正确的版本并返回结果：
![](./images/1726624382928_image.png)
## change buffer存储结构
>图片来源http://mysql.taobao.org/monthly/2015/07/01/

change buffer的实现和索引一样，底层用的数据结构也是B+树，只不过它不是每个表都有一个B+树，而是整个InnoDB共享一个，其存储在共享表空间中。由于change buffer是一棵B+树，所以也分为叶子节点和非叶子节点，非叶子节点存放的是键值，由三分部组成，如图1所示，其中IBUF_REC_FIELD_SPACE表示要插入或者更新数据所在的space id，占用4个字节。IBUF_REC_FIELD_MAKER用来区分新旧版本的change buffer，占用1个字节，默认值为0。IBUF_REC_FIELD_PAGE表示数据所在的page number，占用4个字节，即非叶子节点键值一共占用9字节。当有数据要插入或者更新到非唯一二级索引时，如果这个数据对应的page不在缓冲中，InnoDB会构造刚才所介绍的键值，然后通过这个键值到change buffer中查询，最后将这条数据插入到change buffer的叶子节点中。
![](https://image.huawei.com/tiny-lts/v1/images/d1c3d25784b91d7bf950_326x118.png)
叶子节点的构造如图2所示，前面三部分与非叶子节点是一样的，第四部分是IBUF_REC_FIELD_METADATA，它又由四个部分组成，即IBUF_REC_OFFSET_COUNT、IBUF_REC_OFFSET_TYPE、IBUF_REC_OFFSET_FLAGS、DATA_NEW_ORDER_NULL_TYPE_BUF_SIZE分别表示用来记录操作change buffer的顺序性、操作的类型、表的数据格式以及列的长度和NULL值，总共占用4个字节。最后一部分就是实际插入数据的各个字段了。
![](https://image.huawei.com/tiny-lts/v1/images/b070e25784b91f59f9a0_324x336.png)
由于change buffer的操作是针对page的，所以必需保证操作时不会导致page为空或者分裂，对于page为空的情况，主要是对purge线程而言的，因为只有purge线程才会去真正的删除二级索引上的物理记录，所以在准备删除操作缓冲时，需要预估剩下下的记录数，如果只剩下最后一条，则拒绝pruge操作缓冲，而是直接在物理页面上操作。对于页面分裂的情况，InnoDB使用了一个叫做bitmap page的页来记录数据页面剩余空间的大小,当剩余空间大于512字节时，才允许插入，否则会进行一次强制合并，然后写入二级索引页中。另外当mater thread定时发生merge操作以及对表执行flush table命令时，也会对change buffer进行合并操作。
## 唯一索引与普通索引的区别
对唯一索引来说，更新操作要先判断操作是否满足唯一性，因此必须将数据页读入内存，使用change buffer就没有必要了。
因此，唯一索引的更新就不能使用change buffer，实际上也只有普通索引可以使用。
1. 若目标页已在内存中：唯一索引比普通索引多一个唯一性判断，耗费资源很小
2. 要更新的目标页不在内存中：唯一索引需要将此页读到内存中，判断冲突并插入；普通索引只要将更新记录在change buffer即可结束。
>**redo log 主要节省的是随机写磁盘的 IO 消耗（转成顺序写），而 change buffer 主要节省的则是随机读磁盘的 IO 消耗。**

# mysql选错索引
## 场景复现
创建表 Y，设置两个普通索引, 创建一个存储过程用于插入数据。
```
CREATE TABLE `Y` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `a` int(11) DEFAULT NULL,
  `b` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `a` (`a`),
  KEY `b` (`b`)
) ENGINE=InnoDB；
```

```
delimiter ;;
create procedure idata()
begin
  declare i int;
  set i=1;
  while(i<=100000)do
     insert into Y (`a`,`b`) values(i, i);
    set i=i+1;
  end while;
end;;
delimiter ;
call idata();
```
查看如下事务：
| Session A  | Session B  |
|---|---|
| start transaction with consistent snapshot;  |  |
|| delete from t;  | 
|| call idata();  | 
|| explain select * from Y where a between 10000 and 20000;  |  
|  | explain select * from Y force index(a) where a between 10000 and 20000; |
| commit;  |  |
如果单独执行 Session B 中 select * from Y where a between 10000 and 20000;，毫无疑问会选择 a 这个索引。

但如果安装 Session A，Session B 的顺序执行，发现索引的选择如下：
![](https://img2020.cnblogs.com/blog/1861307/202005/1861307-20200521114914231-144488594.png)
在 Session B 的场景下，执行器却没有选择 a 所在的索引，而是选择基于主键索引的全表扫描。
## 原因分析
MySQL 的优化器不一定每次都能选择合适的索引。
MySQL 中优化器在选择索引时，会考虑扫描的行数：扫描的行数越少，就证明访问磁盘数据的次数越少，消耗的 CPU 资源就越少。
MySQL 在执行语句前，其实并不能准确的计算出扫描的行数，而是通过数学统计信息来估算记录数。由于是采样统计，所以基数的值不是准确的。
### 问题：
- 执行 Select * from Y where a between 10000 and 20000 预估的行数是 100015，这个是能理解的，因为走的是全表扫描。

- 之后执行 select * from Y force index(a) where a between 10000 and 20000 预估的行数是 37116，这个就不能理解了，理想的情况下应该是 10001 行 (需要遍历到 20001)。

- 而且更奇怪的是，虽然 37116 行的预估行数不太合理，但也远小于全表扫描的 100015，为什么优化器还是选择全表扫描呢？

### 原因
首先先看第二个问题，选择 100015 的原因是因为如果使用索引 a 的话，除了需要在 a 索引扫描外，还需要回表，主键索引上的查询代价，优化器也需要算进去，所以选择了全表扫描。

这时再看第一个问题，为什么没有得到正确的行数。这个就和一致性视图有关了，首先 Session A 中，开启了一致性视图，并没有提交。之后的 Session 清空了 Y 表后，又重新创建了相同的数据，这时每行数据都有两个版本，旧版本是 delete 前的数据，新版本是标记为删除的数据。所以索引 a 上的数据其实有两份。也就造成了行数的预估错误。
>mysql 是通过标记删除的方法来删除记录的，并不是在索引和数据文件中真正的删除。而且由于一致性读的保证，不能删除 delete 的空间，再加上 insert 的空间。导致统计信息有误。

>主键上的数据也不能删，那没有使用 force index 的语句，使用 explain命令看到的扫描行数为什么还是 100000 左右？
是的，不过这个是主键，主键是直接按照表的行数来估计的。而表的行数，优化器直接用的是
show table status 的值。

# buffer pool
MySQL 的数据是存储在磁盘里的，但是也不能每次都从磁盘里面读取数据，这样性能是极差的。

要想提升查询性能，加个缓存就行了嘛。所以，当数据从磁盘中取出后，缓存内存中，下次查询同样的数据的时候，直接从内存中读取。

为此，Innodb 存储引擎设计了一个**缓冲池（*Buffer Pool*）**，来提高数据库的读写性能。

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/ImageHost4@main/mysql/innodb/缓冲池.drawio.png)

有了缓冲池后：

- 当读取数据时，如果数据存在于  Buffer Pool 中，客户端就会直接读取  Buffer Pool 中的数据，否则再去磁盘中读取。
- 当修改数据时，首先是修改  Buffer Pool  中数据所在的页，然后将其页设置为脏页，最后由后台线程将脏页写入到磁盘。

## buffer pool存储结构和管理
### 存储内容
InnoDB 会把存储的数据划分为若干个「页」，以页作为磁盘和内存交互的基本单位，一个页的默认大小为 16KB。因此，Buffer Pool  同样需要按「页」来划分。

在 MySQL 启动的时候，**InnoDB 会为 Buffer Pool 申请一片连续的内存空间，然后按照默认的`16KB`的大小划分出一个个的页，Buffer Pool 中的页就叫做缓存页**。此时这些缓存页都是空闲的，之后随着程序的运行，才会有磁盘上的页被缓存到 Buffer Pool 中。

所以，MySQL 刚启动的时候，你会观察到使用的虚拟内存空间很大，而使用到的物理内存空间却很小，这是因为只有这些虚拟内存被访问后，操作系统才会触发缺页中断，接着将虚拟地址和物理地址建立映射关系。

Buffer Pool  除了缓存「索引页」和「数据页」，还包括了 undo 页，插入缓存、自适应哈希索引、锁信息等等。

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/ImageHost4@main/mysql/innodb/bufferpool内容.drawio.png)

为了更好的管理这些在 Buffer Pool 中的缓存页，InnoDB 为每一个缓存页都创建了一个**控制块**，控制块信息包括「缓存页的表空间、页号、缓存页地址、链表节点」等等。

控制块也是占有内存空间的，它是放在 Buffer Pool 的最前面，接着才是缓存页，如下图：

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/ImageHost4@main/mysql/innodb/缓存页.drawio.png)

上图中控制块和缓存页之间灰色部分称为碎片空间。

> 为什么会有碎片空间呢？
你想想啊，每一个控制块都对应一个缓存页，那在分配足够多的控制块和缓存页后，可能剩余的那点儿空间不够一对控制块和缓存页的大小，自然就用不到喽，这个用不到的那点儿内存空间就被称为碎片了。
当然，如果你把 Buffer Pool 的大小设置的刚刚好的话，也可能不会产生碎片。

> 查询一条记录，就只需要缓冲一条记录吗？
不是的。
当我们查询一条记录时，InnoDB 是会把整个页的数据加载到 Buffer Pool 中，因为，通过索引只能定位到磁盘中的页，而不能定位到页中的一条记录。将页加载到 Buffer Pool 后，再通过页里的页目录去定位到某条具体的记录。

### 存储管理
#### 空闲页管理

Buffer Pool 是一片连续的内存空间，当 MySQL 运行一段时间后，这片连续的内存空间中的缓存页既有空闲的，也有被使用的。

那当我们从磁盘读取数据的时候，总不能通过遍历这一片连续的内存空间来找到空闲的缓存页吧，这样效率太低了。

所以，为了能够快速找到空闲的缓存页，可以使用链表结构，将空闲缓存页的「控制块」作为链表的节点，这个链表称为 **Free 链表**（空闲链表）。

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/ImageHost4@main/mysql/innodb/freelist.drawio.png)

Free 链表上除了有控制块，还有一个头节点，该头节点包含链表的头节点地址，尾节点地址，以及当前链表中节点的数量等信息。

Free 链表节点是一个一个的控制块，而每个控制块包含着对应缓存页的地址，所以相当于 Free 链表节点都对应一个空闲的缓存页。

有了 Free 链表后，每当需要从磁盘中加载一个页到 Buffer Pool 中时，就从 Free 链表中取一个空闲的缓存页，并且把该缓存页对应的控制块的信息填上，然后把该缓存页对应的控制块从 Free 链表中移除。
#### 脏页管理

设计 Buffer Pool 除了能提高读性能，还能提高写性能，也就是更新数据的时候，不需要每次都要写入磁盘，而是将 Buffer Pool 对应的缓存页标记为**脏页**，然后再由后台线程将脏页写入到磁盘。

那为了能快速知道哪些缓存页是脏的，于是就设计出 **Flush 链表**，它跟 Free 链表类似的，链表的节点也是控制块，区别在于 Flush 链表的元素都是脏页。

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/ImageHost4@main/mysql/innodb/Flush.drawio.png)

有了 Flush 链表后，后台线程就可以遍历 Flush 链表，将脏页写入到磁盘。

#### 内存淘汰机制
Buffer Pool  的大小是有限的，对于一些频繁访问的数据我们希望可以一直留在 Buffer Pool 中，而一些很少访问的数据希望可以在某些时机可以淘汰掉，从而保证 Buffer Pool  不会因为满了而导致无法再缓存新的数据，同时还能保证常用数据留在 Buffer Pool 中。

要实现这个，最容易想到的就是 LRU（Least recently used）算法。
Buffer Pool 里有三种页和链表来管理数据。

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/ImageHost4@main/mysql/innodb/bufferpoll_page.png)

图中：

- Free Page（空闲页），表示此页未被使用，位于 Free 链表；
- Clean Page（干净页），表示此页已被使用，但是页面未发生修改，位于 LRU 链表。
- Dirty Page（脏页），表示此页「已被使用」且「已经被修改」，其数据和磁盘上的数据已经不一致。当脏页上的数据写入磁盘后，内存数据和磁盘数据一致，那么该页就变成了干净页。脏页同时存在于 LRU 链表和 Flush 链表。

MySQL 改进了 LRU 算法，将 LRU 划分了 2 个区域：**old 区域 和 young 区域**。

young 区域在 LRU 链表的前半部分，old 区域则是在后半部分，如下图：

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/ImageHost4@main/mysql/innodb/young%2Bold.png)
##### 预读失效解决
**划分这两个区域后，预读的页就只需要加入到 old 区域的头部，当页被真正访问的时候，才将页插入 young 区域的头部**。如果预读的页一直没有被访问，就会从 old 区域移除，这样就不会影响 young 区域中的热点数据。
##### 缓存污染
LRU 链表中 young 区域就是热点数据，只要我们提高进入到 young 区域的门槛，就能有效地保证 young 区域里的热点数据不会被替换掉。

MySQL 是这样做的，进入到 young 区域条件增加了一个**停留在 old 区域的时间判断**。

具体是这样做的，在对某个处在 old 区域的缓存页进行第一次访问时，就在它对应的控制块中记录下来这个访问时间：

- 如果后续的访问时间与第一次访问的时间**在某个时间间隔内**，那么**该缓存页就不会被从 old 区域移动到 young 区域的头部**；
- 如果后续的访问时间与第一次访问的时间**不在某个时间间隔内**，那么**该缓存页移动到 young 区域的头部**；

这个间隔时间是由 `innodb_old_blocks_time` 控制的，默认是 1000 ms。

也就说，**只有同时满足「被访问」与「在 old 区域停留时间超过 1 秒」两个条件，才会被插入到 young 区域头部**，这样就解决了 Buffer Pool  污染的问题。
#### 脏页刷盘时机
下面几种情况会触发脏页的刷新：

- 当 redo log 日志满了的情况下，会主动触发脏页刷新到磁盘；
- Buffer Pool 空间不足时，需要将一部分数据页淘汰掉，如果淘汰的是脏页，需要先将脏页同步到磁盘；
- MySQL 认为空闲时，后台线程回定期将适量的脏页刷入到磁盘；
- MySQL 正常关闭之前，会把所有的脏页刷入到磁盘；

在我们开启了慢 SQL 监控后，如果你发现**「偶尔」会出现一些用时稍长的 SQL**，这可能是因为脏页在刷新到磁盘时可能会给数据库带来性能开销，导致数据库操作抖动。

如果间断出现这种现象，就需要调大 Buffer Pool 空间或 redo log 日志的大小。

# mysql优化过程
MySQL 性能优化是一个系统性工程，涉及多个方面，在面试中不可能面面俱到。因此，建议按照“点-线-面”的思路展开，从核心问题入手，再逐步扩展，展示出你对问题的思考深度和解决能力。

## **1. 抓住核心：慢 SQL 定位与分析**

性能优化的第一步永远是找到瓶颈。面试时，建议先从 **慢 SQL 定位和分析** 入手，这不仅能展示你解决问题的思路，还能体现你对数据库性能监控的熟练掌握：

- **监控工具：** 介绍常用的慢 SQL 监控工具，如 **MySQL 慢查询日志**、**Performance Schema** 等，说明你对这些工具的熟悉程度以及如何通过它们定位问题。
- **EXPLAIN 命令：** 详细说明 `EXPLAIN` 命令的使用，分析查询计划、索引使用情况，可以结合实际案例展示如何解读分析结果，比如执行顺序、索引使用情况、全表扫描等。
### 慢查询日志
MySQL 的慢查询日志，用来记录在 MySQL 中响应时间超过阀值的语句，具体指运行时间超过 long_query_time​ 值的SQL，则会被记录到慢查询日志中。
#### 慢查询日志配置：

```
mysql> show variables like '%slow_query_log%';
+-----------------------------------+--------------------------------+
| Variable_name                     | Value                          |
+-----------------------------------+--------------------------------+
| slow_query_log                    | OFF                            |
| slow_query_log_always_write_time  | 10.000000                      |
| slow_query_log_file               | /var/lib/mysql/KAiTO-slow.log  |
| slow_query_log_use_global_control |                                |
+-----------------------------------+--------------------------------+
4 rows in set (0.00 sec)

# 开启慢查询
mysql > set global slow_query_log='ON';
Query OK, 0 rows affected (0.12 sec)
```
#### 慢查询日志分析

```
$ cat /var/lib/mysql/instance-1-slow.log
/usr/sbin/mysqld, Version: 8.0.13 (MySQL Community Server - GPL). started with:
Tcp port: 3306  Unix socket: /var/run/mysqld/mysqld.sock
Time                 Id Command    Argument
/usr/sbin/mysqld, Version: 8.0.13 (MySQL Community Server - GPL). started with:
Tcp port: 3306  Unix socket: /var/run/mysqld/mysqld.sock
Time                 Id Command    Argument
# Time: 2018-12-18T05:55:15.941477Z
# User@Host: root[root] @ localhost []  Id:    53
# Query_time: 2.000479  Lock_time: 0.000000 Rows_sent: 1  Rows_examined: 0
SET timestamp=1545112515;
select sleep(2);
```

### explain使用
**执行计划** 是指一条 SQL 语句在经过 **MySQL 查询优化器** 的优化会后，具体的执行方式。

执行计划通常用于 SQL 性能分析、优化等场景。通过 `EXPLAIN` 的结果，可以了解到如数据表的查询顺序、数据查询操作的操作类型、哪些索引可以被命中、哪些索引实际会命中、每个数据表有多少行记录被查询等信息。
MySQL 为我们提供了 `EXPLAIN` 命令，来获取执行计划的相关信息。

需要注意的是，`EXPLAIN` 语句并不会真的去执行相关的语句，而是通过查询优化器对语句进行分析，找出最优的查询方案，并显示对应的信息。

`EXPLAIN` 执行计划支持 `SELECT`、`DELETE`、`INSERT`、`REPLACE` 以及 `UPDATE` 语句。我们一般多用于分析 `SELECT` 查询语句，使用起来非常简单，语法如下：

```sql
EXPLAIN + SELECT 查询语句；
```

我们简单来看下一条查询语句的执行计划：

```sql
mysql> explain SELECT * FROM dept_emp WHERE emp_no IN (SELECT emp_no FROM dept_emp GROUP BY emp_no HAVING COUNT(emp_no)>1);
+----+-------------+----------+------------+-------+-----------------+---------+---------+------+--------+----------+-------------+
| id | select_type | table    | partitions | type  | possible_keys   | key     | key_len | ref  | rows   | filtered | Extra       |
+----+-------------+----------+------------+-------+-----------------+---------+---------+------+--------+----------+-------------+
|  1 | PRIMARY     | dept_emp | NULL       | ALL   | NULL            | NULL    | NULL    | NULL | 331143 |   100.00 | Using where |
|  2 | SUBQUERY    | dept_emp | NULL       | index | PRIMARY,dept_no | PRIMARY | 16      | NULL | 331143 |   100.00 | Using index |
+----+-------------+----------+------------+-------+-----------------+---------+---------+------+--------+----------+-------------+
```

可以看到，执行计划结果中共有 12 列，各列代表的含义总结如下表：

| **列名**      | **含义**                                     |
| ------------- | -------------------------------------------- |
| id            | SELECT 查询的序列标识符                      |
| select_type   | SELECT 关键字对应的查询类型                  |
| table         | 用到的表名                                   |
| partitions    | 匹配的分区，对于未分区的表，值为 NULL        |
| **type**          | 表的访问方法（查询执行的类型，描述了查询是如何执的。）                               |
| possible_keys | 可能用到的索引                               |
| **key**           | 实际用到的索引（key 列表示 MySQL 实际使用到的索引。如果为 NULL，则表示未用到索引。）                               |
| key_len       | 所选索引的长度                               |
| ref           | 当使用索引等值查询时，与索引作比较的列或常量 |
| rows          | 预计要读取的行数                             |
| filtered      | 按表条件过滤后，留存的记录数的百分比         |
| **Extra**         | 附加信息（这列包含了 MySQL 解析查询的额外信息，通过这些信息，可以更准确的理解 MySQL 到底是如何执行查询的。）                                     |

## **2. 由点及面：索引、表结构和 SQL 优化**

定位到慢 SQL 后，接下来就要针对具体问题进行优化。 这里可以重点介绍索引、表结构和 SQL 编写规范等方面的优化技巧：

- **索引优化：** 这是 MySQL 性能优化的重点，可以介绍索引的创建原则、覆盖索引、最左前缀匹配原则等。如果能结合你项目的实际应用来说明如何选择合适的索引，会更加分一些。
- **表结构优化：** 优化表结构设计，包括选择合适的字段类型、避免冗余字段、合理使用范式和反范式设计等等。
- **SQL 优化：** 避免使用 `SELECT *`、尽量使用具体字段、使用连接查询代替子查询、合理使用分页查询、批量操作等，都是 SQL 编写过程中需要注意的细节。

## **3. 进阶方案：架构优化**

当面试官对基础优化知识比较满意时，可能会深入探讨一些架构层面的优化方案。以下是一些常见的架构优化策略：

- **读写分离：** 将读操作和写操作分离到不同的数据库实例，提升数据库的并发处理能力。
- **分库分表：** 将数据分散到多个数据库实例或数据表中，降低单表数据量，提升查询效率。但要权衡其带来的复杂性和维护成本，谨慎使用。
- **数据冷热分离**：根据数据的访问频率和业务重要性，将数据分为冷数据和热数据，冷数据一般存储在存储在低成本、低性能的介质中，热数据高性能存储介质中。
- **缓存机制：** 使用 Redis 等缓存中间件，将热点数据缓存到内存中，减轻数据库压力。这个非常常用，提升效果非常明显，性价比极高！

## **4. 其他优化手段**

除了慢 SQL 定位、索引优化和架构优化，还可以提及一些其他优化手段，展示你对 MySQL 性能调优的全面理解：

- **连接池配置：** 配置合理的数据库连接池（如 **连接池大小**、**超时时间** 等），能够有效提升数据库连接的效率，避免频繁的连接开销。
- **硬件配置：** 提升硬件性能也是优化的重要手段之一。使用高性能服务器、增加内存、使用 **SSD** 硬盘等硬件升级，都可以有效提升数据库的整体性能。

## **5.总结**

在面试中，建议按优先级依次介绍慢 SQL 定位、[索引优化](./mysql-index.md)、表结构设计和 [SQL 优化](../../high-performance/sql-optimization.md)等内容。架构层面的优化，如[读写分离和分库分表](../../high-performance/read-and-write-separation-and-library-subtable.md)、[数据冷热分离](../../high-performance/data-cold-hot-separation.md) 应作为最后的手段，除非在特定场景下有明显的性能瓶颈，否则不应轻易使用，因其引入的复杂性会带来额外的维护成本。

# 数据删除流程
![](./images/1726645771881_image.png)
# 记录复用
假设要删掉 R4 这个记录，InnoDB 引擎只会把 R4 这个记录标记为删除。如果之后要再插入一个 ID 在 300 和 600 之间的记录时，可能会复用这个位置。但是，磁盘文件的大小并不会缩小。
记录的复用，只限于符合范围条件的数据。比如上面的这个例子，R4 这条记录被删除后，如果
插入一个 ID 是 400 的行，可以直接复用这个空间。但如果插入的是一个 ID 是 800 的行，就不
能复用这个位置了。
## 数据页复用
如果我们删掉了一个数据页上的所有记录，整个数据页就可以被复用了。
当整个页从 B+ 树里面摘掉以后，可以复用到任何位置。如果将数据页 page A上的所有记录删除以后，page A 会被标记为可复用。这时候如果要插入一条 ID=50 的记录需要使用新页的时候，page A 是可以被复用的。

>delete 命令其实只是把记录的位置，或者数据页标记为了“可复用”，但磁盘文件的大小是不会变的。也就是说，通过 delete 命令是不能回收表空间的。这些可以复用，而没有被使用的空间，看起来就像是“空洞”。
>不止是删除数据会造成空洞，插入数据也会。(插入记录时导致页分裂产生空洞)
>更新索引上的值，可以理解为删除一个旧的值，再插入一个新值。不难理解，这也是会造成空洞的。

# count原理
count() 是一个聚合函数，对于返回的结果集，一行行地判断，如果 count 函数的参数不是 NULL，累计值就加 1，否则不加。最后返回累计值。
count(*)、count(主键 id) 和 count(1) 都表示返回满足条件的结果集的总行数；而count(字段），则表示返回满足条件的数据行里面，参数“字段”不为 NULL 的总个数。
>按照效率排序的话，count(字段) < count(主键 id) < count(1) < count(*)

## count(主键id)
对于 count(主键 id) 来说，InnoDB 引擎会遍历整张表，把每一行的 id 值都取出来，返回给server 层。server 层拿到 id 后，判断是不可能为空的，就按行累加。
## count(1)
对于 count(1) 来说，InnoDB 引擎遍历整张表，但不取值。server 层对于返回的每一行，放一个数字“1”进去，判断是不可能为空的，按行累加。
## count(字段)
对于 count(字段) 来说：
1. 如果这个“字段”是定义为 not null 的话，一行行地从记录里面读出这个字段，判断不能
为 null，按行累加；
2. 如果这个“字段”定义允许为 null，那么执行的时候，判断到有可能是 null，还要把值取出
来再判断一下，不是 null 才累加。
## count(*)
count(*) 是例外，并不会把全部字段取出来，而是专门做了优化，不取值。count(*) 肯定不是 null，按行累加。

# mysql加锁原理
## 加锁语句
普通的 select 语句是不会对记录加锁的，因为它属于快照读，是通过  MVCC（多版本并发控制）实现的。

如果要在查询时对记录加行级锁，可以使用下面这两个方式，这两种查询会加锁的语句称为**锁定读**。

```sql
//对读取的记录加共享锁(S型锁)
select ... lock in share mode;

//对读取的记录加独占锁(X型锁)
select ... for update;
```

上面这两条语句必须在一个事务中，**因为当事务提交了，锁就会被释放**，所以在使用这两条语句的时候，要加上 begin 或者 start transaction 开启事务的语句。

**除了上面这两条锁定读语句会加行级锁之外，update 和 delete 操作都会加行级锁，且锁的类型都是独占锁 (X 型锁)**。

```sql
//对操作的记录加独占锁(X型锁)
update table .... where id = 1;

//对操作的记录加独占锁(X型锁)
delete from table where id = 1;
```
## MySQL 加锁机制
1. 原则 1：加锁的基本单位是 next-key lock。希望你还记得，next-key lock 是前开后闭区
间。
2. 原则 2：查找过程中访问到的对象才会加锁。
3. 优化 1：索引上的等值查询，给唯一索引加锁的时候，next-key lock 退化为行锁。
4. 优化 2：索引上的等值查询，向右遍历时且最后一个值不满足等值条件的时候，next-key
lock 退化为间隙锁。
5. 一个 bug：唯一索引上的范围查询会访问到不满足条件的第一个值为止。

**加锁的对象是索引，加锁的基本单位是 next-key lock**，它是由记录锁和间隙锁组合而成的，**next-key lock 是前开后闭区间，而间隙锁是前开后开区间**。

但是，next-key lock 在一些场景下会退化成记录锁或间隙锁。
**在能使用记录锁或者间隙锁就能避免幻读现象的场景下，next-key lock  就会退化成退化成记录锁或间隙锁**。

这次会以下面这个表结构来进行实验说明：

```sql
CREATE TABLE `user` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `age` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `index_age` (`age`) USING BTREE
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

其中，id 是主键索引（唯一索引），age 是普通索引（非唯一索引），name 是普通的列。

表中的有这些行记录：

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesuser.png)

这次实验环境的 **MySQL 版本是 8.0.26，隔离级别是「可重复读」**。

### 唯一索引等值查询

当我们用唯一索引进行等值查询的时候，查询的记录存不存在，加锁的规则也会不同：

- 当查询的记录是「存在」的，在索引树上定位到这一条记录后，将该记录的索引中的 next-key lock 会**退化成「记录锁」**。
- 当查询的记录是「不存在」的，在索引树找到第一条大于该查询记录的记录后，将该记录的索引中的 next-key lock 会**退化成「间隙锁」**。

接下里用两个案例来说明。

#### 1、记录存在的情况

假设事务 A 执行了这条等值查询语句，查询的记录是「存在」于表中的。

```sql
mysql> begin;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from user where id = 1 for update;
+----+--------+-----+
| id | name   | age |
+----+--------+-----+
|  1 | 路飞   |  19 |
+----+--------+-----+
1 row in set (0.02 sec)
```

事务 A 会为 id 为 1 的这条记录就会加上 **X 型的记录锁**。

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/唯一索引记录锁.drawio.png)

>**加锁的对象是针对索引**，因为这里查询语句扫描的 B+ 树是聚簇索引树，即主键索引树，所以是对主键索引加锁。将对应记录的主键索引加 记录锁后，就意味着其他事务无法对该记录进行更新和删除操作了。

#### 2、记录不存在的情况

假设事务 A 执行了这条等值查询语句，查询的记录是「不存在」于表中的。

```sql
mysql> begin;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from user where id = 2 for update;
Empty set (0.03 sec)
```

**此时事务 A 在 id = 5 记录的主键索引上加的是间隙锁，锁住的范围是 (1, 5)。**

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/唯一索引间隙锁.drawio.png)

接下来，如果有其他事务插入 id 值为 2、3、4 这一些记录的话，这些插入语句都会发生阻塞。

> 间隙锁的范围`(1, 5)` ，是怎么确定的？
根据我的经验，如果 LOCK_MODE 是 next-key 锁或者间隙锁，那么 LOCK_DATA 就表示锁的范围「右边界」，此次的事务 A 的 LOCK_DATA 是 5。
然后锁范围的「左边界」是表中 id 为 5 的上一条记录的 id 值，即 1。因此，间隙锁的范围`(1, 5)`。

##### eg:
以表 t 为例，表 t 的建表语句和初始化语句如下。
```sql
CREATE TABLE `t` (
`id` int(11) NOT NULL,
`c` int(11) DEFAULT NULL,
`d` int(11) DEFAULT NULL,
PRIMARY KEY (`id`),
KEY `c` (`c`)
) ENGINE=InnoDB;
insert into t values(0,0,0),(5,5,5),
(10,10,10),(15,15,15),(20,20,20),(25,25,25);
```

![image-20240918235429581](C:\Users\dell\AppData\Roaming\Typora\typora-user-images\image-20240918235429581.png)

由于表 t 中没有 id=7 的记录，所以用我们上面提到的加锁规则判断一下的话：
1. 根据原则 1，加锁单位是 next-key lock，session A 加锁范围就是 (5,10]；
2. 同时根据优化 2，这是一个等值查询 (id=7)，而 id=10 不满足查询条件，next-key lock
退化成间隙锁，因此最终加锁的范围是 (5,10)。
所以，session B 要往这个间隙里面插入 id=8 的记录会被锁住，但是 session C 修改 id=10 这
行是可以的。

### 唯一索引范围查询

范围查询和等值查询的加锁规则是不同的。

当唯一索引进行范围查询时，**会对每一个扫描到的索引加 next-key 锁，然后如果遇到下面这些情况，会退化成记录锁或者间隙锁**：

- 情况一：针对「大于等于」的范围查询，因为存在等值查询的条件，那么如果等值查询的记录是存在于表中，那么该记录的索引中的 next-key 锁会**退化成记录锁**。
- 情况二：针对「小于或者小于等于」的范围查询，要看条件值的记录是否存在于表中：
  - 当条件值的记录不在表中，那么不管是「小于」还是「小于等于」条件的范围查询，**扫描到终止范围查询的记录时，该记录的索引的 next-key 锁会退化成间隙锁**，其他扫描到的记录，都是在这些记录的索引上加 next-key 锁。
  - 当条件值的记录在表中，如果是「小于」条件的范围查询，**扫描到终止范围查询的记录时，该记录的索引的 next-key 锁会退化成间隙锁**，其他扫描到的记录，都是在这些记录的索引上加 next-key 锁；如果「小于等于」条件的范围查询，扫描到终止范围查询的记录时，该记录的索引 next-key 锁不会退化成间隙锁。其他扫描到的记录，都是在这些记录的索引上加 next-key 锁。

#### 1、针对「大于或者大于等于」的范围查询

> 实验一：针对「大于」的范围查询的情况。

假设事务 A 执行了这条范围查询语句：

```sql
mysql> begin;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from user where id > 15 for update;
+----+-----------+-----+
| id | name      | age |
+----+-----------+-----+
| 20 | 香克斯    |  39 |
+----+-----------+-----+
1 row in set (0.01 sec)
```
事务 A 在主键索引上加了两个 X 型 的 next-key 锁：

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/唯一索引范围查询大于15.drawio.png)


> 实验二：针对「大于等于」的范围查询的情况。

假设事务 A 执行了这条范围查询语句：

```sql
mysql> begin;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from user where id >= 15 for update;
+----+-----------+-----+
| id | name      | age |
+----+-----------+-----+
| 15 | 乌索普    |  20 |
| 20 | 香克斯    |  39 |
+----+-----------+-----+
2 rows in set (0.00 sec)
```
事务 A 在主键索引上加了三个 X 型 的锁，分别是：

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/唯一索引范围查询大于等于15.drawio.png)


#### 2、针对「小于或者小于等于」的范围查询

> 实验一：针对「小于」的范围查询时，查询条件值的记录「不存在」表中的情况。

假设事务 A 执行了这条范围查询语句，注意查询条件值的记录（id 为 6）并不存在于表中。

```sql
mysql> begin;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from user where id < 6 for update;
+----+--------+-----+
| id | name   | age |
+----+--------+-----+
|  1 | 路飞   |  19 |
|  5 | 索隆   |  21 |
+----+--------+-----+
3 rows in set (0.00 sec)
```
事务 A 在主键索引上加了三个 X 型的锁：

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/唯一索引范围查询小于等于6.drawio.png)


> 实验二：针对「小于等于」的范围查询时，查询条件值的记录「存在」表中的情况。

假设事务 A 执行了这条范围查询语句，注意查询条件值的记录（id 为 5）存在于表中。

```sql
mysql> begin;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from user where id <= 5 for update;
+----+--------+-----+
| id | name   | age |
+----+--------+-----+
|  1 | 路飞   |  19 |
|  5 | 索隆   |  21 |
+----+--------+-----+
2 rows in set (0.00 sec)
```
**事务 A 在主键索引上加了 2 个 X 型的锁**：

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/唯一索引范围查询小于等于5.drawio.png)

> 实验三：再来看针对「小于」的范围查询时，查询条件值的记录「存在」表中的情况。

如果事务 A 的查询语句是小于的范围查询，且查询条件值的记录（id 为 5）存在于表中。

```sql
select * from user where id < 5 for update;
```

**事务 A 在主键索引上加了两种 X 型锁：**

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/唯一索引范围查询小于5.drawio.png)

#### 主键索引范围锁

```sql
mysql> select * from t where id>=10 and id<11 for update;
```

![image-20240919000324622](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240919000324622.png)

1. 开始执行的时候，要找到第一个 id=10 的行，因此本该是 next-key lock(5,10]。 根据优化主键 id 上的等值条件，退化成行锁，只加了 id=10 这一行的行锁。
2. 范围查找就往后继续找，找到 id=15 这一行停下来，因此需要加 next-key lock(10,15]。

所以，session A 这时候锁的范围就是主键索引上，行锁 id=10 和 next-key lock(10,15]。这样，session B 和 session C 的结果就能理解了。
首次 session A 定位查找 id=10 的行的时候，是当做等值查询来判断的，而向右扫描到 id=15 的时候，用的是范围查询判断。

### 非唯一索引等值查询

当我们用非唯一索引进行等值查询的时候，**因为存在两个索引，一个是主键索引，一个是非唯一索引（二级索引），所以在加锁时，同时会对这两个索引都加锁，但是对主键索引加锁的时候，只有满足查询条件的记录才会对它们的主键索引加锁**。

针对非唯一索引等值查询时，查询的记录存不存在，加锁的规则也会不同：

- 当查询的记录「存在」时，由于不是唯一索引，所以肯定存在索引值相同的记录，于是**非唯一索引等值查询的过程是一个扫描的过程，直到扫描到第一个不符合条件的二级索引记录就停止扫描，然后在扫描的过程中，对扫描到的二级索引记录加的是 next-key 锁，而对于第一个不符合条件的二级索引记录，该二级索引的  next-key 锁会退化成间隙锁。同时，在符合查询条件的记录的主键索引上加记录锁**。
- 当查询的记录「不存在」时，**扫描到第一条不符合条件的二级索引记录，该二级索引的  next-key 锁会退化成间隙锁。因为不存在满足查询条件的记录，所以不会对主键索引加锁**。

#### 1、记录不存在的情况

> 实验一：针对非唯一索引等值查询时，查询的值不存在的情况。

先来说说非唯一索引等值查询时，查询的记录不存在的情况，因为这个比较简单。

假设事务 A 对非唯一索引（age）进行了等值查询，且表中不存在 age = 25 的记录。

```sql
mysql> begin;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from user where age = 25 for update;
Empty set (0.00 sec)
```

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/非唯一索引等值查询age=25.drawio.png)

##### eg: 非唯一索引等值锁覆盖索引

![image-20240918235638345](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240918235638345.png)

这里 session A 要给索引 c 上 c=5 的这一行加上读锁。
1. 根据原则 1，加锁单位是 next-key lock，因此会给 (0,5] 加上 next-key lock。
2. 要注意 c 是普通索引，因此仅访问 c=5 这一条记录是不能马上停下来的，需要向右遍历，查到 c=10 才放弃。根据原则 2，访问到的都要加锁，因此要给 (5,10] 加 next-key lock。
3. 但是同时这个符合优化 2：等值判断，向右遍历，最后一个值不满足 c=5 这个等值条件，因此退化成间隙锁 (5,10)。
4. 只有访问到的对象才会加锁，这个查询使用覆盖索引，并不需要访问主键索引，所以主键索引上没有加任何锁，这就是为什么 session B 的 update 语句可以执行完成。但 session C 要插入一个 (7,7,7) 的记录，就会被 session A 的间隙锁 (5,10) 锁住。

需要注意，在这个例子中，lock in share mode 只锁覆盖索引，但是如果是 for update 就不一
样了。 执行 for update 时，系统会认为你接下来要更新数据，因此会顺便给主键索引上满足条
件的行加上行锁。
这个例子说明，锁是加在索引上的；同时，它给我们的指导是，如果你要用 lock in share
mode 来给行加读锁避免数据被更新的话，就必须得绕过覆盖索引的优化，在查询字段中加入
索引中不存在的字段。比如，将 session A 的查询语句改成 select d from t where c=5 lock
in share mode。

#### 2、记录存在的情况

> 实验二：针对非唯一索引等值查询时，查询的值存在的情况。

假设事务 A 对非唯一索引（age）进行了等值查询，且表中存在 age = 22 的记录。

```sql
mysql> begin;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from user where age = 22 for update;
+----+--------+-----+
| id | name   | age |
+----+--------+-----+
| 10 | 山治   |  22 |
+----+--------+-----+
1 row in set (0.00 sec)
```

可以看到，事务 A 对主键索引和二级索引都加了 X 型的锁：

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/非唯一索引等值查询存在.drawio.png)



#### 非唯一索引上存在"等值"的例子

```sql
mysql> insert into t values(30,10,30);
```

新插入的这一行 c=10，也就是说现在表里有两个 c=10 的行。

![image-20240919001211232](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240919001211232.png)

![image-20240919001229698](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240919001229698.png)

session A 在遍历的时候，先访问第一个 c=10 的记录。同样地，根据原则 1，这里加的是 (c=5,id=5) 到 (c=10,id=10) 这个 next-key lock。
然后，session A 向右查找，直到碰到 (c=15,id=15) 这一行，循环才结束。根据优化 2，这是一个等值查询，向右查找到了不满足条件的行，所以会退化成 (c=10,id=10) 到 (c=15,id=15)的间隙锁。
也就是说，这个 delete 语句在索引 c 上的加锁范围，就是下图中蓝色区域覆盖的部分。

![image-20240919001310139](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240919001310139.png)

这个蓝色区域左右两边都是虚线，表示开区间，即 (c=5,id=5) 和 (c=15,id=15) 这两行上都没有锁。

#### limit 语句加锁

![image-20240919001443814](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240919001443814.png)

这个例子里，session A 的 delete 语句加了 limit 2。你知道表 t 里 c=10 的记录其实只有两条，因此加不加 limit 2，删除的效果都是一样的，但是加锁的效果却不同。可以看到，sessionB 的 insert 语句执行通过了，跟案例六的结果不同。
这是因为，案例七里的 delete 语句明确加了 limit 2 的限制，因此在遍历到 (c=10, id=30) 这一行之后，满足条件的语句已经有两条，循环就结束了。
因此，索引 c 上的加锁范围就变成了从（c=5,id=5) 到（c=10,id=30) 这个前开后闭区间，如下图所示：

![image-20240919001517196](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240919001517196.png)

可以看到，(c=10,id=30）之后的这个间隙并没有在加锁范围里，因此 insert 语句插入 c=12是可以执行成功的。

#### 死锁例子

![image-20240919001745805](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240919001745805.png)

1. session A 启动事务后执行查询语句加 lock in share mode，在索引 c 上加了 next-keylock(5,10] 和间隙锁 (10,15)；

2. session B 的 update 语句也要在索引 c 上加 next-key lock(5,10] ，进入锁等待；

3. 然后 session A 要再插入 (8,8,8) 这一行，被 session B 的间隙锁锁住。由于出现了死锁，InnoDB 让 session B 回滚。

session B 的 next-key lock 不是还没申请成功吗？
其实是这样的，session B 的“加 next-key lock(5,10] ”操作，实际上分成了两步，先是加(5,10) 的间隙锁，加锁成功；然后加 c=10 的行锁，这时候才被锁住的。

### 非唯一索引范围查询

非唯一索引和主键索引的范围查询的加锁也有所不同，不同之处在于**非唯一索引范围查询，索引的 next-key lock 不会有退化为间隙锁和记录锁的情况**，也就是非唯一索引进行范围查询时，对二级索引记录加锁都是加 next-key 锁。

就带大家简单分析一下，事务 A 的这条范围查询语句：

```sql
mysql> begin;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from user where age >= 22  for update;
+----+-----------+-----+
| id | name      | age |
+----+-----------+-----+
| 10 | 山治      |  22 |
| 20 | 香克斯    |  39 |
+----+-----------+-----+
2 rows in set (0.01 sec)
```

可以看到，事务 A 对主键索引和二级索引都加了 X 型的锁：

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/非唯一索引范围查询age大于等于22.drawio.png)

##### eg:

![image-20240919000839832](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240919000839832.png)

session A 是一个范围查询，按照原则 1 的话，应该是索引 id 上只加 (10,15] 这个 next-keylock，并且因为 id 是唯一键，所以循环判断到 id=15 这一行就应该停止了。但是实现上，InnoDB 会往前扫描到第一个不满足条件的行为止，也就是 id=20。而且由于这是个范围扫描，因此索引 id 上的 (15,20] 这个 next-key lock 也会被锁上。所以你看到了，session B 要更新 id=20 这一行，是会被锁住的。同样地，session C 要插入id=16 的一行，也会被锁住。
##### eg:
![](./images/1726711401717_image.png)
1. 由于是 order by c desc，第一个要定位的是索引 c 上“最右边的”c=20 的行，所以会加上间隙锁 (20,25) 和 next-key lock (15,20]。
2. 在索引 c 上向左遍历，要扫描到 c=10 才停下来，所以 next-key lock 会加到 (5,10]，这正是阻塞 session B 的 insert 语句的原因。
3. 在扫描过程中，c=20、c=15、c=10 这三行都存在值，由于是 select *，所以会在主键 id上加三个行锁。

因此，session A 的 select 语句锁的范围就是：
1. 索引 c 上 (5, 25)；
2. 主键索引上 id=10、15、20 三个行锁。
><= 到底是间隙锁还是行锁？其实，这个问题，你要跟“执行过程”配合起来分析。在 InnoDB 要去找“第一个值”的时候，是按照等值去找的，用的是等值判断的规则；找到第一个值以后，要在索引内找“下一个
值”，对应于我们规则中说的范围查找。所以此处例子中从右往左扫描时，第一个访问到的15按照非唯一索引等值查询的规则，要往右找不符合条件的值，也就是20，加上间隙锁。
### 没有加索引的查询

前面的案例，我们的查询语句都有使用索引查询，也就是查询记录的时候，是通过索引扫描的方式查询的，然后对扫描出来的记录进行加锁。

**如果锁定读查询语句，没有使用索引列作为查询条件，或者查询语句没有走索引查询，导致扫描是全表扫描。那么，每一条记录的索引上都会加 next-key 锁，这样就相当于锁住的全表，这时如果其他事务对该表进行增、删、改操作的时候，都会被阻塞**。

不只是锁定读查询语句不加索引才会导致这种情况，update 和 delete 语句如果查询条件不加索引，那么由于扫描的方式是全表扫描，于是就会对每一条记录的索引上都会加 next-key 锁，这样就相当于锁住的全表。

因此，**在线上在执行 update、delete、select ... for update 等具有加锁性质的语句，一定要检查语句是否走了索引，如果是全表扫描的话，会对每一个索引加 next-key 锁，相当于把整个表锁住了**，这是挺严重的问题。

## 总结

唯一索引等值查询：

- 当查询的记录是「存在」的，在索引树上定位到这一条记录后，将该记录的索引中的 next-key lock 会**退化成「记录锁」**。
- 当查询的记录是「不存在」的，在索引树找到第一条大于该查询记录的记录后，将该记录的索引中的 next-key lock 会**退化成「间隙锁」**。

非唯一索引等值查询：

- 当查询的记录「存在」时，由于不是唯一索引，所以肯定存在索引值相同的记录，于是非唯一索引等值查询的过程是一个扫描的过程，直到扫描到第一个不符合条件的二级索引记录就停止扫描，然后**在扫描的过程中，对扫描到的二级索引记录加的是 next-key 锁，而对于第一个不符合条件的二级索引记录，该二级索引的 next-key 锁会退化成间隙锁。同时，在符合查询条件的记录的主键索引上加记录锁**。
- 当查询的记录「不存在」时，**扫描到第一条不符合条件的二级索引记录，该二级索引的  next-key 锁会退化成间隙锁。因为不存在满足查询条件的记录，所以不会对主键索引加锁**。

非唯一索引和主键索引的范围查询的加锁规则不同之处在于：

- 唯一索引在满足一些条件的时候，索引的 next-key lock 退化为间隙锁或者记录锁。
- 非唯一索引范围查询，索引的 next-key lock 不会退化为间隙锁和记录锁。

还有一件很重要的事情，在线上在执行 update、delete、select ... for update 等具有加锁性质的语句，一定要检查语句是否走了索引，**如果是全表扫描的话，会对每一个索引加 next-key 锁，相当于把整个表锁住了**，这是挺严重的问题。

唯一索引加锁的流程图：

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/唯一索引加锁流程.jpeg)

非唯一索引加锁的流程图：

![](https://cdn.xiaolincoding.com/gh/xiaolincoder/mysql/行级锁/非唯一索引加锁流程.jpeg)


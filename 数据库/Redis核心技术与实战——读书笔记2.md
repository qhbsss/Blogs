[TOC]

# 集合的统计模式

![image-20250110121153200](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250110121153200.png)

# GeoHash的编码方法

GEO 类型的底层数据结构就是用 Sorted Set 来实现的。  

为了能高效地对经纬度进行比较，Redis 采用了业界广泛使用的 GeoHash 编码方法，这个方法的基本原理就是“二分区间，区间编码”。

当我们要对一组经纬度进行 GeoHash 编码时，我们要先对经度和纬度分别编码，然后再把经纬度各自的编码组合成一个最终编码。

首先，我们来看下经度和纬度的单独编码过程。

对于一个地理位置信息来说，它的经度范围是[-180,180]。GeoHash 编码会把一个经度值编码成一个 N 位的二进制值，我们来对经度范围[-180,180]做 N 次的二分区操作，其中 N可以自定义。

在进行第一次二分区时，经度范围[-180,180]会被分成两个子区间：[-180,0) 和[0,180] （我称之为左、右分区）。此时，我们可以查看一下要编码的经度值落在了左分区还是右分区。如果是落在左分区，我们就用 0 表示；如果落在右分区，就用 1 表示。这样一来，每做完一次二分区，我们就可以得到 1 位编码值。

然后，我们再对经度值所属的分区再做一次二分区，同时再次查看经度值落在了二分区后的左分区还是右分区，按照刚才的规则再做 1 位编码。当做完 N 次的二分区后，经度值就可以用一个 N bit 的数来表示了。

> eg:假设我们要编码的经度值是 116.37，我们用 5 位编码值（也就是 N=5，做 5次分区）。  
>
> ![image-20250110171637204](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250110171637204.png)
>
> ![image-20250110171653977](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250110171653977.png)
>
> 当一组经纬度值都编完码后，我们再把它们的各自编码值组合在一起，组合的规则是：最终编码值的偶数位上依次是经度的编码值，奇数位上依次是纬度的编码值，其中，偶数位从 0 开始，奇数位从 1 开始。
>
> 我们刚刚计算的经纬度（116.37，39.86）的各自编码值是 11010 和 10111，组合之后，第 0 位是经度的第 0 位 1，第 1 位是纬度的第 0 位 1，第 2 位是经度的第 1 位 1，第 3位是纬度的第 1 位 0，以此类推，就能得到最终编码值 1110011101，如下图所示：
>
> ![image-20250110171826077](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250110171826077.png)
>
> 举个例子。我们把经度区间[-180,180]做一次二分区，把纬度区间[-90,90]做一次二分区，就会得到 4 个分区。我们来看下它们的经度和纬度范围以及对应的 GeoHash 组合编码。
>
> 分区一：[-180,0) 和[-90,0)，编码 00；分区二：[-180,0) 和[0,90]，编码 01；分区三：[0,180]和[-90,0)，编码 10；分区四：[0,180]和[0,90]，编码 11。  
>
> 这 4 个分区对应了 4 个方格，每个方格覆盖了一定范围内的经纬度值，分区越多，每个方格能覆盖到的地理空间就越小，也就越精准。我们把所有方格的编码值映射到一维空间时，相邻方格的 GeoHash 编码值基本也是接近的，如下图所示：
>
> ![image-20250110172044494](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250110172044494.png)
>
> 有的编码值虽然在大小上接近，但实际对应的方格却距离比较远。例如，我们用 4 位来做 GeoHash 编码，把经度区间[-180,180]和纬度区间[-90,90]各分成了 4 个分区，一共 16 个分区，对应了 16 个方格。编码值为 0111 和 1000 的两个方格就离得比较远，如下图所示：  
>
> ![image-20250110172114952](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250110172114952.png)
>
> 所以，为了避免查询不准确问题，我们可以同时查询给定经纬度所在的方格周围的 4 个或8 个方格。  

# Redis自定义数据类型

Redis 键值对中的每一个值都是用 RedisObject 保存的。  RedisObject 的内部组成包括了 type,、encoding,、lru 和 refcount 4 个元数据，以及 1个*ptr指针。  

- type：表示值的类型，涵盖了我们前面学习的五大基本类型； 

- encoding：是值的编码方式，用来表示 Redis 中实现各个基本类型的底层数据结构，例如 SDS、压缩列表、哈希表、跳表等； 
- lru：记录了这个对象最后一次被访问的时间，用于淘汰过期的键值对； 
- refcount：记录了对象的引用计数；
- *ptr：是指向数据的指针。

![image-20250110172348823](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250110172348823.png)

![image-20250110172731537](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250110172731537.png)

## 第一步：定义新数据类型的底层结构

我们用 newtype.h 文件来保存这个新类型的定义，具体定义的代码如下所示：

```
struct NewTypeObject {
struct NewTypeNode *head;
size_t len;
}NewTypeObject;
```

其中，NewTypeNode 结构就是我们自定义的新类型的底层结构。我们为底层结构设计两个成员变量：一个是 Long 类型的 value 值，用来保存实际数据；一个是

*next指针，指向下一个 NewTypeNode 结构。

```
struct NewTypeNode {
long value;
struct NewTypeNode *next;
};
```

## 第二步：在 RedisObject 的 type 属性中，增加这个新类型的定义

这个定义是在 Redis 的 server.h 文件中。比如，我们增加一个叫作 OBJ_NEWTYPE 的宏定义，用来在代码中指代 NewTypeObject 这个新类型。

```
#define OBJ_STRING 0 /* String object. */
#define OBJ_LIST 1 /* List object. */
#define OBJ_SET 2 /* Set object. */
#define OBJ_ZSET 3 /* Sorted set object. */
…#
define OBJ_NEWTYPE 7
```

## 第三步：开发新类型的创建和释放函数

Redis 把数据类型的创建和释放函数都定义在了 object.c 文件中。所以，我们可以在这个文件中增加 NewTypeObject 的创建函数 createNewTypeObject，如下所示：

```
robj *createNewTypeObject(void){
    NewTypeObject *h = newtypeNew();
    robj *o = createObject(OBJ_NEWTYPE,h);
    return o;
}
```

createNewTypeObject 分别调用了 newtypeNew 和 createObject 两个函数,newtypeNew 函数是用来为新数据类型初始化内存结构的。这个初始化过程主要是用 zmalloc 做底层结构分配空间，以便写入数据。

```
NewTypeObject *newtypeNew(void){
	NewTypeObject *n = zmalloc(sizeof(*n));
    n->head = NULL;
    n->len = 0;
    return n;
}
```

newtypeNew 函数涉及到新数据类型的具体创建，而 Redis 默认会为每个数据类型定义一个单独文件，实现这个类型的创建和命令操作，例如，t_string.c 和 t_list.c 分别对应String 和 List 类型。按照 Redis 的惯例，我们就把 newtypeNew 函数定义在名为t_newtype.c 的文件中。

createObject 是 Redis 本身提供的 RedisObject 创建函数，它的参数是数据类型的 type和指向数据类型实现的指针*ptr。

我们给 createObject 函数中传入了两个参数，分别是新类型的 type 值 OBJ_NEWTYPE，以及指向一个初始化过的 NewTypeObjec 的指针。这样一来，创建的 RedisObject 就能指向我们自定义的新数据类型了。

```
robj *createObject(int type, void *ptr) {
    robj *o = zmalloc(sizeof(*o));
    o->type = type;
    o->ptr = ptr;
    ...
    return o;
}
```

## 第四步：开发新类型的命令操作

简单来说，增加相应的命令操作的过程可以分成三小步：

1. 在 t_newtype.c 文件中增加命令操作的实现。比如说，我们定义 ntinsertCommand 函数，由它实现对 NewTypeObject 单向链表的插入操作：

```
void ntinsertCommand(client *c){
//基于客户端传递的参数，实现在NewTypeObject链表头插入元素
}
```

2. 在 server.h 文件中，声明我们已经实现的命令，以便在 server.c 文件引用这个命令，例如：  

```
void ntinsertCommand(client *c)
```

3. 在 server.c 文件中的 redisCommandTable 里面，把新增命令和实现函数关联起来。例如，新增的 ntinsert 命令由 ntinsertCommand 函数实现，我们就可以用 ntinsert 命令给 NewTypeObject 数据类型插入元素了。  

```
struct redisCommand redisCommandTable[] = {
...
{"ntinsert",ntinsertCommand,2,"m",...}
}
```

# 异步机制：如何避免单线程模型的阻塞？  

影响 Redis 性能的 5 大方面的潜在因素，分别是：  

- Redis 内部的阻塞式操作；  

- CPU 核和 NUMA 架构的影响； 
- Redis 关键系统配置；

- Redis 内存碎片；

- Redis 缓冲区。

Redis 

## 实例有哪些阻塞点？

Redis 实例在运行时，要和许多对象进行交互，这些不同的交互就会涉及不同的操作，下面我们来看看和 Redis 实例交互的对象，以及交互时会发生的操作。

- 客户端：网络 IO，键值对增删改查操作，数据库操作；

- 磁盘：生成 RDB 快照，记录 AOF 日志，AOF 日志重写；

- 主从节点：主库生成、传输 RDB 文件，从库接收 RDB 文件、清空数据库、加载 RDB文件；

- 切片集群实例：向其他实例传输哈希槽信息，数据迁移。

![image-20250110210038658](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250110210038658.png)

### 1. 和客户端交互时的阻塞点

网络 IO 有时候会比较慢，但是 Redis 使用了 IO 多路复用机制，避免了主线程一直处在等待网络连接或请求到来的状态，所以，网络 IO 不是导致 Redis 阻塞的因素。
键值对的增删改查操作是 Redis 和客户端交互的主要部分，也是 Redis 主线程执行的主要任务。所以，复杂度高的增删改查操作肯定会阻塞 Redis。
那么，怎么判断操作复杂度是不是高呢？这里有一个最基本的标准，就是看操作的复杂度是否为 O(N)。

Redis 中涉及集合的操作复杂度通常为 O(N)，我们要在使用时重视起来。例如集合元素全量查询操作 HGETALL、SMEMBERS，以及集合的聚合统计操作，例如求交、并和差集。这些操作可以作为 Redis 的第一个阻塞点：**集合全量查询和聚合操作**。

除此之外，集合自身的删除操作同样也有潜在的阻塞风险。你可能会认为，删除操作很简单，直接把数据删除就好了，为什么还会阻塞主线程呢？

其实，删除操作的本质是要释放键值对占用的内存空间。你可不要小瞧内存的释放过程。释放内存只是第一步，为了更加高效地管理内存空间，在应用程序释放内存时，操作系统需要把释放掉的内存块插入一个空闲内存块的链表，以便后续进行管理和再分配。这个过程本身需要一定时间，而且会阻塞当前释放内存的应用程序，所以，如果一下子释放了大量内存，空闲内存块链表操作时间就会增加，相应地就会造成 Redis 主线程的阻塞。

那么，什么时候会释放大量内存呢？其实就是在删除大量键值对数据的时候，最典型的就是删除包含了大量元素的集合，也称为 bigkey 删除。**bigkey 删除操作就是 Redis 的第二个阻塞点**。删除操作对Redis 实例性能的负面影响很大，而且在实际业务开发时容易被忽略，所以一定要重视它。  

在 Redis 的数据库级别操作中，清空数据库（例如 FLUSHDB 和 FLUSHALL 操作）必然也是一个潜在的阻塞风险，因为它涉及到删除和释放所有的键值对。所以，这就是 **Redis 的第三个阻塞点：清空数据库**。  

### 2. 和磁盘交互时的阻塞点
我之所以把 Redis 与磁盘的交互单独列为一类，主要是因为磁盘 IO 一般都是比较费时费力的，需要重点关注。
幸运的是，Redis 开发者早已认识到磁盘 IO 会带来阻塞，所以就把 Redis 进一步设计为采用子进程的方式生成 RDB 快照文件，以及执行 AOF 日志重写操作。这样一来，这两个操作由子进程负责执行，慢速的磁盘 IO 就不会阻塞主线程了。
但是，Redis 直接记录 AOF 日志时，会根据不同的写回策略对数据做落盘保存。一个同步写磁盘的操作的耗时大约是 1～2ms，如果有大量的写操作需要记录在 AOF 日志中，并同步写回的话，就会阻塞主线程了。这就得到了 Redis 的**第四个阻塞点了：AOF 日志同步写**。

### 3. 主从节点交互时的阻塞点
在主从集群中，主库需要生成 RDB 文件，并传输给从库。主库在复制的过程中，创建和传输 RDB 文件都是由子进程来完成的，不会阻塞主线程。但是，对于从库来说，它在接收了RDB 文件后，需要使用 FLUSHDB 命令清空当前数据库，这就正好撞上了刚才我们分析的第三个阻塞点。
此外，从库在清空当前数据库后，还需要把 RDB 文件加载到内存，这个过程的快慢和RDB 文件的大小密切相关，RDB 文件越大，加载过程越慢，所以，**加载 RDB 文件就成为了 Redis 的第五个阻塞点**。

### 4. 切片集群实例交互时的阻塞点  

当我们部署 Redis 切片集群时，每个 Redis 实例上分配的哈希槽信息需要在不同实例间进行传递，同时，当需要进行负载均衡或者有实例增删时，数据会在不同的实例间进行迁移。不过，哈希槽的信息量不大，而数据迁移是渐进式执行的，所以，一般来说，这两类操作对 Redis 主线程的阻塞风险不大。

不过，如果你使用了 Redis Cluster 方案，而且同时正好迁移的是 bigkey 的话，就会造成主线程的阻塞，因为 Redis Cluster 使用了同步迁移。当没有 bigkey 时，切片集群的各实例在进行交互时不会阻塞主线程  

## 哪些阻塞点可以异步执行？  

对于 Redis 来说，读操作是典型的关键路径操作，因为客户端发送了读操作之后，就会等待读取的数据返回，以便进行后续的数据处理。而 Redis 的第一个阻塞点“集合全量查询和聚合操作”都涉及到了读操作，所以，它们是不能进行异步操作了。

我们再来看看删除操作。删除操作并不需要给客户端返回具体的数据结果，所以不算是关键路径操作。而我们刚才总结的第二个阻塞点“bigkey 删除”，和第三个阻塞点“清空数据库”，都是对数据做删除，并不在关键路径上。因此，我们可以使用后台子线程来异步执行删除操作。

对于第四个阻塞点“AOF 日志同步写”来说，为了保证数据可靠性，Redis 实例需要保证AOF 日志中的操作记录已经落盘，这个操作虽然需要实例等待，但它并不会返回具体的数据结果给实例。所以，我们也可以启动一个子线程来执行 AOF 日志的同步写，而不用让主线程等待 AOF 日志的写完成。

最后，我们再来看下“从库加载 RDB 文件”这个阻塞点。从库要想对客户端提供数据存取服务，就必须把 RDB 文件加载完成。所以，这个操作也属于关键路径上的操作，我们必须让从库的主线程来执行。

对于 Redis 的五大阻塞点来说，除了“集合全量查询和聚合操作”和“从库加载 RDB 文件”，其他三个阻塞点涉及的操作都不在关键路径上，所以，我们可以使用 Redis 的异步子线程机制来实现 bigkey 删除，清空数据库，以及 AOF 日志同步写。

## 异步的子线程机制

Redis 主线程启动后，会使用操作系统提供的 pthread_create 函数创建 3 个子线程，分别由它们负责 AOF 日志写操作、键值对删除以及文件关闭的异步执行。

主线程通过一个链表形式的任务队列和子线程进行交互。当收到键值对删除和清空数据库的操作时，主线程会把这个操作封装成一个任务，放入到任务队列中，然后给客户端返回一个完成信息，表明删除已经完成。

但实际上，这个时候删除还没有执行，等到后台子线程从任务队列中读取任务后，才开始实际删除键值对，并释放相应的内存空间。因此，我们把这种异步删除也称为惰性删除（lazy free）。此时，删除或清空操作不会阻塞主线程，这就避免了对主线程的性能影响。

和惰性删除类似，当 AOF 日志配置成 everysec 选项后，主线程会把 AOF 写日志操作封装成一个任务，也放到任务队列中。后台子线程读取任务后，开始自行写入 AOF 日志，这样主线程就不用一直等待 AOF 日志写完了。

![image-20250111113918807](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250111113918807.png)

# 为什么CPU结构也会影响Redis的性能？  

## 主流的 CPU 架构  

![image-20250111122930643](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250111122930643.png)

在多 CPU 架构上，应用程序可以在不同的处理器上运行。在刚才的图中，Redis 可以先在Socket 1 上运行一段时间，然后再被调度到 Socket 2 上运行。

但是，有个地方需要你注意一下：如果应用程序先在一个 Socket 上运行，并且把数据保存到了内存，然后被调度到另一个 Socket 上运行，此时，应用程序再进行内存访问时，就需要访问之前 Socket 上连接的内存，这种访问属于**远端内存访问。和访问 Socket 直接连接的内存相比，远端内存访问会增加应用程序的延迟**。

在多 CPU 架构下，一个应用程序访问所在 Socket 的本地内存和访问远端内存的延迟并不一致，所以，我们也把这个架构称为非统一内存访问架构（Non-Uniform Memory Access，NUMA 架构）。

## CPU 多核对 Redis 性能的影响  

在一个 CPU 核上运行时，应用程序需要记录自身使用的软硬件资源信息（例如栈指针、CPU 核的寄存器值等），我们把这些信息称为运行时信息。同时，应用程序访问最频繁的指令和数据还会被缓存到 L1、L2 缓存上，以便提升执行速度。  

>可能有同学不太清楚 99% 尾延迟是啥，我先解释一下。我们把所有请求的处理延迟从小到大排个序，99% 的请求延迟小于的值就是 99% 尾延迟。比如说，我们有 1000 个请求，假设按请求延迟从小到大排序后，第 991 个请求的延迟实测值是 1ms，而前 990 个请求的延迟都小于 1ms，所以，这里的 99% 尾延迟就是 1ms。  

>当时，我们的项目需求是要对 Redis 的 99% 尾延迟进行优化，要求 GET 尾延迟小于 300微秒，PUT 尾延迟小于 500 微秒。  
>
>刚开始的时候，我们使用 GET/PUT 复杂度为 O(1) 的 String 类型进行数据存取，同时关闭了 RDB 和 AOF，而且，Redis 实例中没有保存集合类型的其他数据，也就没有 bigkey操作，避免了可能导致延迟增加的许多情况。
>
>但是，即使这样，我们在一台有 24 个 CPU 核的服务器上运行 Redis 实例，GET 和 PUT的 99% 尾延迟分别是 504 微秒和 1175 微秒，明显大于我们设定的目标。
>
>后来，我们仔细检测了 Redis 实例运行时的服务器 CPU 的状态指标值，这才发现，CPU的 context switch 次数比较多。
>
>context switch 是指线程的上下文切换，这里的上下文就是线程的运行时信息。在 CPU 多核的环境中，一个线程先在一个 CPU 核上运行，之后又切换到另一个 CPU 核上运行，这时就会发生 context switch。  
>
>当 context switch 发生后，Redis 主线程的运行时信息需要被重新加载到另一个 CPU 核上，而且，此时，另一个 CPU 核上的 L1、L2 缓存中，并没有 Redis 实例之前运行时频繁访问的指令和数据，所以，这些指令和数据都需要重新从 L3 缓存，甚至是内存中加载。这个重新加载的过程是需要花费一定时间的。而且，Redis 实例需要等待这个重新加载的过程完成后，才能开始处理请求，所以，这也会导致一些请求的处理时间增加。
>
>如果在 CPU 多核场景下，Redis 实例被频繁调度到不同 CPU 核上运行的话，那么，对Redis 实例的请求处理时间影响就更大了。
>
>每调度一次，一些请求就会受到运行时信息、指令和数据重新加载过程的影响，这就会导致某些请求的延迟明显高于其他请求。分析到这里，我们就知道了刚刚的例子中 99% 尾延迟的值始终降不下来的原因。
>
>所以，我们要避免 Redis 总是在不同 CPU 核上来回调度执行。于是，我们尝试着把 Redis实例和 CPU 核绑定了，让一个 Redis 实例固定运行在一个 CPU 核上。我们可以使用taskset 命令把一个程序绑定在一个核上运行。
>
>比如说，我们执行下面的命令，就把 Redis 实例绑在了 0 号核上，其中，“-c”选项用于设置要绑定的核编号。  
>
>```
>taskset -c 0 ./redis-server
>```
>
>绑定以后，我们进行了测试。我们发现，Redis 实例的 GET 和 PUT 的 99% 尾延迟一下子就分别降到了 260 微秒和 482 微秒，达到了我们期望的目标。
>
>我们来看一下绑核前后的 Redis 的 99% 尾延迟。
>
>![image-20250111130540684](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250111130540684.png)

## CPU 的 NUMA 架构对 Redis 性能的影响  

在实际应用 Redis 时，我经常看到一种做法，为了提升 Redis 的网络性能，把操作系统的网络中断处理程序和 CPU 核绑定。这个做法可以避免网络中断处理程序在不同核上来回调度执行，的确能有效提升 Redis 的网络处理性能。

但是，网络中断程序是要和 Redis 实例进行网络数据交互的，一旦把网络中断程序绑核后，我们就需要注意 Redis 实例是绑在哪个核上了，这会关系到 Redis 访问网络数据的效率高低。

我们先来看下 Redis 实例和网络中断程序的数据交互：网络中断处理程序从网卡硬件中读取数据，并把数据写入到操作系统内核维护的一块内存缓冲区。内核会通过 epoll 机制触发事件，通知 Redis 实例，Redis 实例再把数据从内核的内存缓冲区拷贝到自己的内存空间，如下图所示：

![image-20250111132602936](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250111132602936.png)

那么，在 CPU 的 NUMA 架构下，当网络中断处理程序、Redis 实例分别和 CPU 核绑定后，就会有一个潜在的风险：如果网络中断处理程序和 Redis 实例各自所绑的 CPU 核不在同一个 CPU Socket 上，那么，Redis 实例读取网络数据时，就需要跨 CPU Socket 访问内存，这个过程会花费较多时间。    

>不过，需要注意的是，在 CPU 的 NUMA 架构下，对 CPU 核的编号规则，并不是先把一个 CPU Socket 中的所有逻辑核编完，再对下一个 CPU Socket 中的逻辑核编码，而是先给每个 CPU Socket 中每个物理核的第一个逻辑核依次编号，再给每个 CPU Socket 中的物理核的第二个逻辑核依次编号。  

## 绑核的风险和解决方案  

当我们把 Redis 实例绑到一个 CPU 逻辑核上时，就会导致子进程、后台线程和 Redis 主线程竞争 CPU 资源，一旦子进程或后台线程占用 CPU 时，主线程就会被阻塞，导致Redis 请求延迟增加。

针对这种情况，我来给你介绍两种解决方案，分别是一个 Redis 实例对应绑一个物理核和优化 Redis 源码。

### 方案一：一个 Redis 实例对应绑一个物理核

在给 Redis 实例绑核时，我们不要把一个实例和一个逻辑核绑定，而要和一个物理核绑定，也就是说，把一个物理核的 2 个逻辑核都用上。

```
taskset -c 0,12 ./redis-server
```

和只绑一个逻辑核相比，把 Redis 实例和物理核绑定，可以让主线程、子进程、后台线程共享使用 2 个逻辑核，可以在一定程度上缓解 CPU 资源竞争。但是，因为只用了 2 个逻辑核，它们相互之间的 CPU 竞争仍然还会存在。如果你还想进一步减少 CPU 竞争，我再给你介绍一种方案。  

### 方案二：优化 Redis 源码

这个方案就是通过修改 Redis 源码，把子进程和后台线程绑到不同的 CPU 核上。

如果你对 Redis 的源码不太熟悉，也没关系，因为这是通过编程实现绑核的一个通用做法。学会了这个方案，你可以在熟悉了源码之后把它用上，也可以应用在其他需要绑核的场景中。

接下来，我先介绍一下通用的做法，然后，再具体说说可以把这个做法对应到 Redis 的哪部分源码中。

通过编程实现绑核时，要用到操作系统提供的 1 个数据结构 cpu_set_t 和 3 个函数CPU_ZERO、CPU_SET 和 sched_setaffinity，我先来解释下它们。

- cpu_set_t 数据结构：是一个位图，每一位用来表示服务器上的一个 CPU 逻辑核。

- CPU_ZERO 函数：以 cpu_set_t 结构的位图为输入参数，把位图中所有的位设置为 0。

- CPU_SET 函数：以 CPU 逻辑核编号和 cpu_set_t 位图为参数，把位图中和输入的逻辑核编号对应的位设置为 1。

- sched_setaffinity 函数：以进程 / 线程 ID 号和 cpu_set_t 为参数，检查 cpu_set_t 中哪一位为 1，就把输入的 ID 号所代表的进程 / 线程绑在对应的逻辑核上。

分别把后台线程、子进程绑到不同的核上的做法。

先说后台线程。为了让你更好地理解编程实现绑核，你可以看下这段示例代码，它实现了为线程绑核的操作：

```
//线程函数
void worker(int bind_cpu){
    cpu_set_t cpuset; //创建位图变量
    CPU_ZERO(&cpu_set); //位图变量所有位设置0
    CPU_SET(bind_cpu, &cpuset); //根据输入的bind_cpu编号，把位图对应为设置为1
    sched_setaffinity(0, sizeof(cpuset), &cpuset); //把程序绑定在cpu_set_t结构位图
    //实际线程函数工作
} 
int main(){
    pthread_t pthread1
    //把创建的pthread1绑在编号为3的逻辑核上
    pthread_create(&pthread1, NULL, (void *)worker, 3);
}
```

对于 Redis 来说，它是在 bio.c 文件中的 bioProcessBackgroundJobs 函数中创建了后台线程。bioProcessBackgroundJobs 函数类似于刚刚的例子中的 worker 函数，在这个函数中实现绑核四步操作，就可以把后台线程绑到和主线程不同的核上了。

和给线程绑核类似，当我们使用 fork 创建子进程时，也可以把刚刚说的四步操作实现在fork 后的子进程代码中，示例代码如下：

```
int main(){
    //用fork创建一个子进程
    pid_t p = fork();
    if(p < 0){
    printf(" fork error\n");
    }/
    /子进程代码部分
    else if(!p){
        cpu_set_t cpuset; //创建位图变量
        CPU_ZERO(&cpu_set); //位图变量所有位设置0
        CPU_SET(3, &cpuset); //把位图的第3位设置为1
        sched_setaffinity(0, sizeof(cpuset), &cpuset); //把程序绑定在3号逻辑核
        //实际子进程工作
        exit(0);
    }
    ...
}
```

对于 Redis 来说，生成 RDB 和 AOF 日志重写的子进程分别是下面两个文件的函数中实现的。

- rdb.c 文件：rdbSaveBackground 函数； 

- aof.c 文件：rewriteAppendOnlyFileBackground 函数。  

这两个函数中都调用了 fork 创建子进程，所以，我们可以在子进程代码部分加上绑核的四步操作。

使用源码优化方案，我们既可以实现 Redis 实例绑核，避免切换核带来的性能影响，还可以让子进程、后台线程和主线程不在同一个核上运行，避免了它们之间的 CPU 资源竞争。相比使用 taskset 绑核来说，这个方案可以进一步降低绑核的风险。  

# 波动的响应延迟：如何应对变慢的Redis？  

## Redis 真的变慢了吗？  

- 一个最直接的方法，就是查看 Redis 的响应延迟。

大部分时候，Redis 延迟很低，但是在某些时刻，有些 Redis 实例会出现很高的响应延迟，甚至能达到几秒到十几秒，不过持续时间不长，这也叫延迟“毛刺”。当你发现Redis 命令的执行时间突然就增长到了几秒，基本就可以认定 Redis 变慢了。

这种方法是看 Redis 延迟的绝对值，但是，在不同的软硬件环境下，Redis 本身的绝对性能并不相同。比如，在我的环境中，当延迟为 1ms 时，我判定 Redis 变慢了，但是你的硬件配置高，那么，在你的运行环境下，可能延迟是 0.2ms 的时候，你就可以认定 Redis 变慢了。

- 第二个方法了，就是基于当前环境下的 Redis 基线性能做判断。

所谓的基线性能呢，也就是一个系统在低压力、无干扰下的基本性能，这个性能只由当前的软硬件配置决定。

你可能会问，具体怎么确定基线性能呢？有什么好方法吗？

实际上，从 2.8.7 版本开始，redis-cli 命令提供了–intrinsic-latency 选项，可以用来监测和统计测试期间内的最大延迟，这个延迟可以作为 Redis 的基线性能。其中，测试时长可以用–intrinsic-latency 选项的参数来指定。

需要注意的是，基线性能和当前的操作系统、硬件配置相关。因此，我们可以把它和Redis 运行时的延迟结合起来，再进一步判断 Redis 性能是否变慢了。

一般来说，你要把运行时延迟和基线性能进行对比，如果你观察到的 Redis 运行时延迟是其基线性能的 2 倍及以上，就可以认定 Redis 变慢了。

## 如何应对 Redis 变慢？  

![image-20250111164357434](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250111164357434.png)

### Redis 自身操作特性的影响  

1. 从慢查询命令开始排查，并且根据业务需求替换慢查询命令；

2. 排查过期 key 的时间设置，并根据实际使用需求，设置不同的过期时间。

### 文件系统：AOF 模式  
为了保证数据可靠性，Redis 会采用 AOF 日志或 RDB 快照。其中，AOF日志提供了三种日志写回策略：no、everysec、always。这三种写回策略依赖文件系统的两个系统调用完成，也就是 write 和 fsync。
write 只要把日志记录写到内核缓冲区，就可以返回了，并不需要等待日志实际写回到磁盘；而 fsync 需要把日志记录写回到磁盘后才能返回，时间较长。下面这张表展示了三种写回策略所执行的系统调用。

![image-20250111182537491](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250111182537491.png)

AOF 重写会对磁盘进行大量 IO 操作，同时，fsync 又需要等到数据写到磁盘后才能返回，所以，当 AOF 重写的压力比较大时，就会导致 fsync 被阻塞。虽然 fsync 是由后台子线程负责执行的，但是，主线程会监控 fsync 的执行进度。

当主线程使用后台子线程执行了一次 fsync，需要再次把新接收的操作记录写回磁盘时，如果主线程发现上一次的 fsync 还没有执行完，那么它就会阻塞。所以，如果后台子线程执行的 fsync 频繁阻塞的话（比如 AOF 重写占用了大量的磁盘 IO 带宽），主线程也会阻塞，导致 Redis 性能变慢。

![image-20250111182701937](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20250111182701937.png)

### 操作系统：swap  

通常，触发 swap 的原因主要是物理机器内存不足，对于 Redis 而言，有两种常见的情况：  

- Redis 实例自身使用了大量的内存，导致物理机器的可用内存不足；

- 和 Redis 实例在同一台机器上运行的其他进程，在进行大量的文件读写操作。文件读写本身会占用系统内存，这会导致分配给 Redis 实例的内存量变少，进而触发 Redis 发生swap。

# 删除数据后，为什么内存占用率还是很高？  

## 内存碎片是如何形成的？
其实，内存碎片的形成有内因和外因两个层面的原因。简单来说，内因是操作系统的内存
分配机制，外因是 Redis 的负载特征。
### 内因：内存分配器的分配策略
内存分配器的分配策略就决定了操作系统无法做到“按需分配”。这是因为，内存分配器
一般是按固定大小来分配内存，而不是完全按照应用程序申请的内存空间大小给程序分
配。  

>Redis 可以使用 libc、jemalloc、tcmalloc 多种内存分配器来分配内存，默认使用
>jemalloc。  
>
>jemalloc 的分配策略之一，是按照一系列固定的大小划分内存空间，例如 8 字节、16 字
>节、32 字节、48 字节，…, 2KB、4KB、8KB 等。当程序申请的内存最接近某个固定值
>时，jemalloc 会给它分配相应大小的空间。  

如果 Redis 每次向分配器申请的内存空间大小不一样，这种分配方式就会有形成碎
片的风险，而这正好来源于 Redis 的外因了。  

### 外因：键值对大小不一样和删改操作
Redis 通常作为共用的缓存系统或键值数据库对外提供服务，所以，不同业务应用的数据
都可能保存在 Redis 中，这就会带来不同大小的键值对。这样一来，Redis 申请内存空间
分配时，本身就会有大小不一的空间需求。这是第一个外因。  

第二个外因是，这些键值对会被修改和删除，这会导致空间的扩容和释放。具体来说，一
方面，如果修改后的键值对变大或变小了，就需要占用额外的空间或者释放不用的空间。
另一方面，删除的键值对就不再需要内存空间了，此时，就会把空间释放出来，形成空闲
空间  

## 如何清理内存碎片？  

从 4.0-RC3 版本以后，Redis 自身提供了一种内存碎片自动清理的方法
内存碎片清理，简单来说，就是“搬家让位，合并空间”。  当有数据把一块连续的内存空间分割成好几块不连续的空间时，操作系统就会把数据拷贝到别处。此时，数据拷贝需要能把这些数据原来占用的空间都空出来，把原本不连续的内存空间变成连续的空间。否则，如果数据拷贝后，并没有形成连续的内存空间，这就不能算是清理了。  

碎片清理是有代价的，操作系统需要把多份数据拷贝到新位置，把原有空间释放出来，这会带来时间开销。因为 Redis 是单线程，在数据拷贝时，Redis 只能等着，这就导致 Redis 无法及时处理请求，性能就会降低。而且，有的时候，数据拷贝还需要注意顺序，就像刚刚说的清理内存碎片的例子，操作系统需要先拷贝 D，并释放 D的空间后，才能拷贝 B。这种对顺序性的要求，会进一步增加 Redis 的等待时间，导致性
能降低。  

# 缓冲区：一个可能引发“惨案”的地方  

缓冲区的功能其实很简单，主要就是用一块内存空间来暂时存放命令数据，以免出现因为
数据和命令的处理速度慢于发送速度而导致的数据丢失和性能问题。但因为缓冲区的内存
空间有限，如果往里面写入数据的速度持续地大于从里面读取数据的速度，就会导致缓冲
区需要越来越多的内存来暂存数据。当缓冲区占用的内存超出了设定的上限阈值时，就会
出现缓冲区溢出。  

Redis 是典型的 client-server 架构，所有的操作命令都需要通过客户端发送给
服务器端。所以，缓冲区在 Redis 中的一个主要应用场景，就是在客户端和服务器端之间
进行通信时，用来暂存客户端发送的命令数据，或者是服务器端返回给客户端的数据结
果。此外，缓冲区的另一个主要应用场景，是在主从节点间进行数据同步时，用来暂存主
节点接收的写命令和数据。  

## 客户端输入和输出缓冲区  

为了避免客户端和服务器端的请求发送和处理速度不匹配，服务器端给每个连接的客户端
都设置了一个输入缓冲区和输出缓冲区，我们称之为客户端输入缓冲区和输出缓冲区。
输入缓冲区会先把客户端发送过来的命令暂存起来，Redis 主线程再从输入缓冲区中读取
命令，进行处理。当 Redis 主线程处理完数据后，会把结果写入到输出缓冲区，再通过输
出缓冲区返回给客户端，如下图所示：  

![image-20250113210106320](C:\Users\qiuhb\AppData\Roaming\Typora\typora-user-images\image-20250113210106320.png)

### 如何应对输入缓冲区溢出  

输入缓冲区就是用来暂存客户端发送的请求命令的，所以可能导致溢出的情况主要是下面两种：  

- 写入了 bigkey，比如一下子写入了多个百万级别的集合类型数据；
- 服务器端处理请求的速度过慢，例如，Redis 主线程出现了间歇性阻塞，无法及时处理正常发送的请求，导致客户端发送的请求在缓冲区越积越多。  

Redis 并没有提供参数让我们调节客户端输入缓冲区的大小。如果要避免输入缓冲区溢出，那我们就只能从数据命令的发送和处理速度入手，也就是前面提到的避免客户端写入 bigkey，以及避免 Redis 主线程阻塞。  

### 如何应对输出缓冲区溢出？  

Redis 的输出缓冲区暂存的是 Redis 主线程要返回给客户端的数据。一般来说，主线程返回给客户端的数据，既有简单且大小固定的 OK 响应（例如，执行 SET 命令）或报错信息，也有大小不固定的、包含具体数据的执行结果（例如，执行 HGET 命令）。  

- 服务器端返回 bigkey 的大量结果；

  避免 bigkey 操作返回大量数据结果；  

- 执行了 MONITOR 命令；

  MONITOR 的输出结果会持续占用输出缓冲区，并越占越多，最后的结果就是发生溢出。所以，我要给你一个小建议：MONITOR 命令主要用在调试环境中，不要在线上生产环境中持续使用 MONITOR。  

- 缓冲区大小设置得不合理。  

  使用 client-output-buffer-limit 设置合理的缓冲区大小上限，或是缓冲区连续写入时间和写入量上限。  

## 主从集群中的缓冲区
主从集群间的数据复制包括全量复制和增量复制两种。全量复制是同步所有数据，而增量复制只会把主从库网络断连期间主库收到的命令，同步给从库。无论在哪种形式的复制中，为了保证主从节点的数据一致，都会用到缓冲区。但是，这两种复制场景下的缓冲区，在溢出影响和大小设置方面并不一样。  

### 复制缓冲区的溢出问题
在全量复制过程中，主节点在向从节点传输 RDB 文件的同时，会继续接收客户端发送的写命令请求。这些写命令就会先保存在复制缓冲区中，等 RDB 文件传输完成后，再发送给从节点去执行。主节点上会为每个从节点都维护一个复制缓冲区，来保证主从节点间的数据同步。  如果在全量复制时，从节点接收和加载 RDB 较慢，同时主节点接收到了大量的写命令，写命令在复制缓冲区中就会越积越多，最终导致溢出。  

主节点上的复制缓冲区，本质上也是一个用于和从节点连接的客户端（我们称之为从节点客户端），使用的输出缓冲区。复制缓冲区一旦发生溢出，主节点也会直接关闭和从节点进行复制操作的连接，导致全量复制失败。那如何避免复制缓冲区发生溢出呢？

一方面，我们可以控制主节点保存的数据量大小。按通常的使用经验，我们会把主节点的数据量控制在 2~4GB，这样可以让全量同步执行得更快些，避免复制缓冲区累积过多命令。
另一方面，我们可以使用 client-output-buffer-limit 配置项，来设置合理的复制缓冲区大小。设置的依据，就是主节点的数据量大小、主节点的写负载压力和主节点本身的内存大小。  

### 复制积压缓冲区的溢出问题
增量复制时使用的缓冲区，这个缓冲区称为复制积压缓冲区。
主节点在把接收到的写命令同步给从节点时，同时会把这些写命令写入复制积压缓冲区。一旦从节点发生网络闪断，再次和主节点恢复连接后，从节点就会从复制积压缓冲区中，读取断连期间主节点接收到的写命令，进而进行增量同步  

首先，复制积压缓冲区是一个大小有限的环形缓冲区。当主节点把复制积压缓冲区写满后，会覆盖缓冲区中的旧命令数据。如果从节点还没有同步这些旧命令数据，就会造成主从节点间重新开始执行全量复制。
其次，为了应对复制积压缓冲区的溢出问题，我们可以调整复制积压缓冲区的大小，也就是设置 repl_backlog_size 这个参数的值。  

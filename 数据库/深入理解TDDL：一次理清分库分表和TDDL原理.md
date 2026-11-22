---
title: "深入理解TDDL：一次理清分库分表和TDDL原理"
source: "https://ata.atatech.org/articles/11020345614?spm=ata.23639746.0.0.717cf84bF5Likt"
author:
  - "[[马子珺(秦麒)]]"
published:
created: 2026-10-15
description:
tags:
  - "clippings"
---
## 0.前言

在正式学习 TDDL 之前应该先做一些知识准备，了解一下 TDDL 产生的背景以及解决了哪些问题。TDDL 是和分布式数据库相关的，首先来看一下分布式数据库的演化过程。

![](c272d181-7aa5-4c55-acbb-5924c46449db.avif)

四个阶段

## 单库单表

通常刚开始的时候，应用的数据比较少，也不会很复杂，所以应用只有一个数据库，数据库中的表是一张完整的表，这也是我们刚开始接触数据库时的数据库形态。

## 读写分离

随着业务的发展，数据量与数据访问量不断增长，很多时候应用的主要业务是读多写少的，比如说一些新闻网站，运营在后台上传了一堆新闻之后，所有的用户都会去读取这些新闻资讯，因此数据库面临的读压力远大于写压力，那么这时候在原来数据库 Master 的基础上增加一个备用数据库 Slave，备库和主库存储着相同的数据，但只提供读服务，不提供写服务。

以后的写操作以及事务中的读操作就走主库，其它读操作就走备库，这就是所谓的读写分离。

读写分离会直接带来两个问题：

- 数据的复制：新写入的数据只会在主库中，备库需要将数据的新增和修改从主库中复制过来。这个一般依靠数据库提供的复制功能实现，比如mysql基于binlog实现的的replication。
- 数据源的选择：读写分离后，我们都知道写要找主库，读要找备库，但是程序不知道。所以程序中应该根据SQL判断出是读操作还是写操作，进而选择要访问的数据库。这就涉及到SQL语法树的解析了，比如Druid连接池就提供了 [SQL Parser模块](https://github.com/alibaba/druid/wiki/SQL-Parser) 。

## 垂直分库分表

- 事务的ACID将被打破：数据被分到不同的数据库，原来的事务操作将会受很大影响。单机数据库可以利用本地事务很好地完成这件事儿，但是多机就会变得比较麻烦。这个问题就涉及到分布式事务，分布式事务的解决方案有很多，比如使用强一致性的分布式事务框架 [Seata](https://github.com/seata/seata) ，或者使用 [RocketMQ](http://rocketmq.apache.org/docs/transaction-example/) 等消息队列实现最终一致性。
- Join联表操作困难：这个也毋庸置疑了，解决方案一般是将联表查询改成多个单次查询，在代码层进行关联。
- 外键约束受影响：因为外键约束和唯一性约束一样本质还是依靠索引实现的，所以分库后外键约束也会收到影响。但外键约束本就不太推荐使用，一般都是在代码层进行约束，这个问题倒也不会有很大影响。

## 水平分库分表

- 自增主键会有影响这个影响很明显，分表中如果使用的是自增主键的话，那么就不能产生唯一的 ID 了，因为逻辑上来说多个分表其实都属于一张表，自增主键无法标识每一条数据。
- 有些单表查询会变成多表比如说 count 操作，原来是一张表的问题，现在要从多张分表中共同查询才能得到结果。
![](a5d15513-a63c-4a06-8230-8148501ce5e4.png)

分库分表-架构

  可以看出，数据库从单机走向分布式将会面临很多很多的问题，TDDL 就是为了解决这些问题而生的。

## 1\. TDDL概述

一句话介绍，TDDL是一个分布式数据库访问引擎。

对数据库进行分库分表，读写分离以提高性能、同时还有系统容灾和运维管理的考虑，需要提供定制化的数据引擎，可以让开发人员不需要考虑过多的细节就可以简便的操纵底层的数据库中的数据。

TDDL: TaoBao Distributed data layer 的简称，一种分布式数据访问引擎；

位于ibatis或其他ORM框架之下，JDBC Driver之上，整个中间件实现了JDBC规范，可以将其当作普通的数据源实例化并注入到ORM框架之中；

整体架构分三层，分别为Matrix层、Group层和Atom层，分别对应数据源TDateSource、TGroupDataSource和TAtomDataSource。

## 2\. 核心功能

## 2.1 数据自动的水平切分

  可以对数据自动的分库分表，使用人员可以像访问单库单表一样，去访问多库多表的数据，底层的实现是对使用者透明的，也就意味着数据可以自由的扩展。

## 2.2 读写分离、容灾、扩容

  在部分节点发生故障以后，可以及时的主备切换或者更改数据源，保持数据引擎的正常运转。

  当原有的数据库数据表大小难以满足业务需求时，可以动态的扩容同时尽量减少对业务的影响，包括全量迁移、增量同步和切换数据库三个步骤。

## 2.3 全局唯一Sequence的生成

  保证分库分表后，各个数据表中不会发生主键的冲突;

## 3.横向对比

|  | TDDL | MTDDL | Sharding-Sphere | Mycat | Sharding-JDBC |
| --- | --- | --- | --- | --- | --- |
| 原理 | 以代码封装的形式将数据库操作分发，支持分库分表、读写分离。 | 逻辑与TDDL基本一致，美团内部 | 采用透明代理方式，支持分库分表、读写分离、分布式事务。 | 采用代理模式，实现了MYSQL服务器通过 SQL 解析进行路由。 | 通过 JDBC 连接池管理 SQL 路由。 |
| 应用  方式 | jar集成+prectrl配置（策略） | jar集成+独立平台配置（策略） | 1. jar集成 2. Proxy 3. Sidecar 模式  +配置（策略，链接） | Proxy+配置（策略，链接） | jar集成+本地配置（策略，链接） |
| 特性 | 与阿里自有生态高度集成，研发无感 | 与TDDL基本一致 | 灵活  支持复杂事务  （分布式） | 无感、多语言 | 使用简单 |
| 外部依赖 | 依赖diamond | 未知 | 自成体系 | 自成体系 | 无 |
| 数据库 | 任意 | 任意 | 取决于集成方式 | MySQL/PostgreSQL | 任意 |
| 语言 | Java | Java | JAVA / 无限制 | 无限制 | JAVA |

## 4\. 架构组成

  接下来讲一下TDDL的数据架构，TDDL的数据架构共为三层。

TDDL 为了解决每一层所要应对的问题，它在结构上至上而下也分了三层，分别是：

Matrix 层、Group层以及 Atom 层。

具体来说，从逻辑上来看：

- 最顶层是要进行分库分表才过渡到中间层的，分库分表所带来的问题是在 Matrix 层解决；
- 中间层是经过读写分离和主备切换处理，因此读写分离与主备切换的工作由 Group 层解决；
- 至于 Atom 层，它面对的是实实在在的每一个数据库，更多的工作在与对数据库的连接管理，比如说当数据库的 IP 地址发生改变时，Atom 层要动态感知，以免连接找不到地址
![](2eb34ee5-93fb-4cd0-9f03-203ab3a4df51.png) ![](5dd502f4-db19-4359-9697-a628e99c8fb1.png)

## 4.1 Matrix

最上面的一层，对开发人员来说就是要进行操作的数据库，底层的分库分表等一系列操作对程序员来说是透明的，提供了关系数据库的水平扩展的功能。主要的功能是

1\. SQL语句的解释、优化和执行，实现分库分表，支持多个Group

2\. 规则的管理

3\. 各个子表查询出来结果集的Merge。

![](b3121f92-7ff8-4f21-836e-6f41e2323a78.png)

## 4.2 Group

中间的数据库层，是逻辑上的各个数据库节点。主要的功能是:

1\. 持有多个Atom，数据库读写分离，基本上主数据库负责读写，备份数据库只负责读

2\. 主备切换 状态对调后备库变为主库，主库变为备库

3\. 权重的选择 根据权重选择要去读哪些库

![](1dd996b0-1b7a-44e2-9920-b86d913d83e3.png)

## 4.3 Atom

底层数据源的管理。它的主要功能是:

1\. 动态创建，添加，减少数据源。管理着底层的数据库IP，连接等信息。

2\. 底层对物理数据库做了代理，对单库的JDBC做了一层封装，执行底层单库的SQL

3\. 线程数、执行次数等状态的统计

![](a8993548-c6d7-43c2-81dd-b9df98821ea7.png)

  这样三层的结构可以使很好的拆解了分布式数据库的各个层次，都每一个层次明确，需要面对的场景和解决的问题也是不一样的。

## 5.工作流程&原理

通过一个典型的sql来了解其工作流程及原理；

![](b6dcd055-0e63-481e-98df-cd0de2aaaad8.png)

TDDL的工作流程类似上图，client发送一条SQL的执行语句，会优先传递给Matrix层。由Martix 解释 SQL语句，优化，并根据查询条件路由到各个group，转发sql进行查询，各个group根据权重选择其中一个Atom进行查询，各个Atom再将结果返回给Matrix，Matrix将结果合并返回给client。

具体的工作流程的可以拆分成如下图:

![](fd41fefd-b0c5-46ae-a179-333b33a7169a.png)

## 5.1 路由请求

Matrix层会先执行以下四个过程:

- Sql的解析
	- 首先将Sql语句解析成一颗抽象语法树(Abstract Syntax Tree)，解析成我们比较好处理的一个结构
- 规则的匹配与计算
	- 基于上一步创建的语法树查找匹配的规则，再根据规则（prectrl配置）去确定分库分表的结果。
		- 这里有一个概念就是规则，规则这里可以简单的看做就是定义数据库怎么进行分库分表，要分成几张库几张表，库名和表名的命名是怎么样的。规则的匹配就是根据SQL的语句确定，具体查询的子表是哪几张。
- 表名替换
	- 对于开发人员来说：

它查询的表直接就是select \* from A.B limit 10(A为数据库名,B为数据表名)。

但底层其实会把这些表名替换成类似：

select \* from A\_000.B\_001

select \* from A\_000.B\_002

select \* from A\_001.B\_003

这样的形式。表名替换就是把总表（逻辑表）的名称替换为这些子表的名字。

- Sql的转发
	- 将上一步生成的各个sql语句转发到对应的Group进行执行，这里如上图我查询的条件是

where id = 2 or 3，那么

转发给Group0的查询为where id=3

转发给group1的查询为where id =2

  这样四个步骤可以在Matrix层就实现了分库分表的功能，对原始的Sql进行分解，将原本单库单表的查询语句，底层转发到多库多表并行的进行执行，提高了数据库读写的性能。

只做路由，不控制读写分离，也无法控制主备切换；

## 5.2 提交执行

Group层接下来会执行两个过程：

- 根据权重选择AtomDs
	- 通常会在主节点和副节点上读取数据，只在主节点上写入数据。
- 具有重试的策略地在AtomDs上执行SQL
	- 这个可以防止单个的AtomDs发生故障，那么会进入读重试，以确保尽可能多的数据访问可以在正常数据库中访问。

负责读写分离、主备切换；

Atom层执行两个过程：

- 读写数控制、线程并发数控制
	- 同时会统计线程数、执行次数等信息。
- 执行sql，返回结果集
	- Atom底层利用druid进行连接池的管理，具体查询还是对JDBC做了一定封装。执行完Sql后对将结果返回给Matrix。

单数据库连接管理；

## 5.3 汇总结果

Matrix层最后执行最后一个过程：

- 结果集合并
	- Matrix将Atom层的返回的各个结果集进行合并Merge，返回给Client端。

## 6.应用实践

通过几个应用的场景了希望对TDDL的理解能更深入一些；

## 6.1基础

```<?xml
<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE beans PUBLIC "-//SPRING//DTD BEAN//EN" "http://www.springframework.org/dtd/spring-beans.dtd">
<beans>
  <!-- 这个bean配置为TDDL规则总配置 -->
  <bean id="vtabroot" class="com.taobao.tddl.rule.VirtualTableRoot" init-method="init">
    <!-- 没有被配置在tableRules的逻辑表都将在这个group里，以单表形式执行 -->
    <property name="defaultDbIndex" value="TDDL_DEFAULT_GROUP"/>  
    <!-- 数据库类型,默认是mysql -->
    <property name="dbType" value="MYSQL"></property> 
    <!-- 该map配置有分表的逻辑表，有几个表有分表就配置几个键值对(该事例表示只有三个表需要分表)-->
    <property name="tableRules">
      <map> 
        <!-- key是逻辑表名，value指的是对应具体配置的id -->
        <entry key="user" value-ref="user_bean"></entry> 
        <!-- 逻辑表名为admin，具体的分表规则在id="admin_bean"的配置中 -->
        <entry key="admin" value-ref="admin_bean"></entry> 
        <!-- 这张表是单表，可以配置在这，不配置的话默认走defaultDbIndex -->
        <entry key="picture" value-ref="picture_bean"></entry> 
      </map>
    </property>
  </bean>

  <!-- 按照user_id取模划分64张表,表明具体为'user_0000'-'user_0063'，
  'user_0000'-'user_0031' 在'TDDL_0000_GROUP'中，
  'user_0032'-'user_0063' 在'TDDL_0001_GROUP'中 -->
  <bean id="user_bean" class="com.taobao.tddl.rule.TableRule">
    <!-- groupKey格式框架，{}中的数将会被dbRuleArray的值替代，并保持位数 -->
    <property name="dbNamePattern" value="TDDL_{0000}_GROUP"/> 
    <!-- 具体的分库规则 -->
    <property name="dbRuleArray"> 
      <!-- 按照user_id取模划分64张表，结果除以32后分到两个库中 -->
      <value>(#user_id,1,64#.longValue() % 64).intdiv(32)</value> 
    </property>
    <!-- 具体表名格式框架，{}中的数将会被tbRuleArray的值替代，并保持位数 -->
    <property name="tbNamePattern" value="user_{0000}"></property> 
    <!-- 具体的分表规则 -->
```

![](3ff62741-cc7b-4ff4-9a51-d81333816aee.png)

```<?xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE beans PUBLIC "-//SPRING//DTD BEAN//EN" "http://www.springframework.org/dtd/spring-beans.dtd">

<beans>
  <bean id="vtabroot" class="com.taobao.tddl.interact.rule.VirtualTableRoot" init-method="init">
    <property name="dbType" value="MYSQL" />
    <property name="defaultDbIndex" value="AAS_TILE_HD_0000_GROUP" />
    <property name="tableRules">
      <map>
        <entry key="hq_tile_common" value-ref="hq_tile_common" />
      </map>
    </property>
  </bean>

  <bean id="hq_tile_common" class="com.taobao.tddl.interact.rule.TableRule">
    <property name="dbNamePattern" value="AAS_TILE_HD_{0000}_GROUP" />
    <property name="dbRuleArray" value="(#tile_id,1,256#.hashCode().abs().longValue() % 256).intdiv(16)" />  
    <property name="tbNamePattern" value="hq_tile_common_{0000}" />
    <property name="tbRuleArray" value="(#tile_id,1,256#.hashCode().abs().longValue() % 256)" />
    <property name="allowFullTableScan" value="false" />
  </bean>

</beans>
```

## 6.2 影子表应用

tddl-client会从Eagleeye中，读取线程上下文中的压测标（EagleEye.getUserData("t")）,当压测标是“1”的时候，在物理SQL的表名前面，增加\_\_test\_前缀（称为影子表）。

详情🔎： [https://aliyuque.antfin.com/coronadb/ydgmzl/iv34umpuxlmpb6vw](https://aliyuque.antfin.com/coronadb/ydgmzl/iv34umpuxlmpb6vw)

tddl-client中支持全链路压测，需要满足以下条件：

1. 需要使用TDataSource。TGroupDataSource不支持全链路压测（这个是最常见的压测流量无法路由到影子表的原因）。
	1. ds.setDynamicRule(true) TDataSource
		2. ds.setDynamicRule(fasle) TGroupDataSource
2. 对需要压测的表，需提前创建影子表，影子表以\_\_test\_开头。通常情况下，影子表需要到DMS上进行创建。
	1. 特别注意，需要保证影子表与正式表的表结构一致。

所有SQL，包括读请求和写请求，都会被路由到影子表;

影子表通常不需要配置路由规则;

## 6.3 超时参数

- socketTimeout

当前阿里集团的数据库的默认12秒。

在SQL前面加HINT，超时单位为ms： /\*+TDDL({'extra':{'SOCKET\_TIMEOUT':'9999'}})\*/ select \* from t1

- blockingTimeout

这个是连接池本身的参数，对应Druid中的maxWait。

可以理解为应用在从连接池获取连接最长的等待时间，单位毫秒，默认5s。如果连接池中没有足够的连接，应用线程就会等待，如果等待时间超过blockingTimeout，就会报错。

- connectTimeout

这个参数是与mysql建立连接时最长的等待时间，单位毫秒，默认1s。创建连接的线程，在创建连接的过程中，会等待 connectTimeout 的时间，如果失败，会重试三次，也即等待三倍于connectTimeout（默认是1sx3=3s） 的时间会超时。

如果出现了，基本是因为DB挂了或者网络不通。

## 6.4 连接池的参数应用

集团默认的连接池大小是10，maxPoolSize。如果10都无法满足要求，请优先考虑优化SQL性能、优化程序的事务逻辑，降低对连接的占用时间。

- minPoolSize和prefill优化

minPoolSize是连接池中连接数的最小值。

但需要注意的是，默认情况下，在应用启动的时候，如果没有SQL访问，TDDL并不会在连接池中建连接，。

这样可能导致的问题是如果引用刚启动的时候，连接池刚启动时，如果来了比较大的流量，那么可能会导致频繁的建连接，而影响执行效率，因此我们引入了prefill这个参数，如果置为true，那么，在TDDL初始化的时候，就会提前在连接池内建立minPoolSize个连接。

并且值得注意的是，当由某些原因导致连接池中的连接被断开（如MySQL空闲超时），导致连接池内连接小于minPoolSize时，TDDL并不会维持连接池内总是有minPoolSize个连接。

minPoolSize一般默认值为5，prefill默认值为false。

注意：prefill参数会极大的减缓应用的初始化速度，并且增加启动失败的风险（例如MySQL连接不够用，无法创建足够的连接）。通常情况下，只建议大促前打开，平时关闭。

最好的方式是代码启动代码+数据预热

- 一个连接池数量和超时的例子

一个连接池，minPoolSize=3，maxPoolSize=6，idleTimeout=60，MySQL空闲超时时间(max\_wait)为8小时。假如目前连接池内有5个连接，并且应用进入持续的空闲状态。

那么，最早60分钟，最迟60+60/2=90分钟后，连接池会清理掉5-3=2个连接，是连接池内的连接数恢复为minPoolSize。

8小时后，由于MySQL单方面关掉了空闲的连接，连接池中剩余的3个连接处于半开状态，变得无效，这时如果有一个getConnection调用，连接池会用一个简单的SQL去判断拿到的连接是否有效，然后会发现连接池内的3个连接都无效，那就会清理掉这3个连接，并新建一个连接返回。

- 一个连接池超时参数的例子

一个连接池，connectTimeout = 20s，socketTimeout = 60s，blockingTimeout = 30s，maxPoolSize = 50

- case1：分库宕机

如果某个分库突然宕机，客户端在尝试建立连接时会等待 20s（connectTimeout设置）\* 3 （重试三次） 。由于并发请求很多，剩下的分库连接请求会累积起来，每个请求都在等待 60s，容易形成雪崩效应，当分库重启或者主备切换后，剩下的分库也处于拥塞状态，应用如果低水位则可能自愈，如果高水位将持续拥塞。

改进措施：将connectTimeout调小。这样做的话，在数据库宕机的情况下，系统会更快地放弃连接，减少资源等待时间，使资源可以更快地释放，以便处理其他的数据库请求。

- case2：慢SQL

如果某个分库出现慢SQL，每个慢SQL会占用连接超过60s（socketTimeout设置）。这会导致该分库的连接池耗尽，后续请求必须等待，当等待时间超过了30s（blockingTimeout设置），大量请求在等待连接时超时。对于单库查询则只影响单个分库，如果跨库则和分库宕机类似。

改进措施：将socketTimeout调整小。这能减少单个慢SQL占用连接的时间，从而提高连接的利用率和系统吞吐量。代价是正常执行超过socketTimeout的SQL也会失败。

将maxPoolSize增加至100。这样在面对高并发场景时能拥有更多可用的连接，提高系统处理能力。代价是压力给到数据库侧。

调整后，在面对慢SQL时，系统能更快地释放占用的连接资源，其他请求能更高效地获取连接资源，避免了因为连接池耗尽导致的请求阻塞和服务下降，减少了雪崩发生的可能性

中
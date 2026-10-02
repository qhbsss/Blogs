---
title: "EagleEye学习分享"
source: "https://ata.atatech.org/articles/11000247124?spm=ata.23639746.0.0.5bd3f4bfDdnhk2"
author:
published:
created: 2026-05-10
description:
tags:
  - "clippings"
---
中国电商事业群-飞猪

粉丝 4影响力 205

** 44

** 87

** 2

** 原创文章

**

[刘禹(禹源)](https://ata.atatech.org/users/11001415891)

2022-09-23发表2023-08-29更新3.6k浏览

** 字号

** 笔记

** 分享 **

## 基本概念

什么是Dapper？

Dapper（谷歌）是一个大规模分布式系统的跟踪系统，EagleEye（阿里）的设计基本遵循了 Dapper 规范，但也有些差异，比如没有借用 Span 和 Parent 的概念，而是引入了rpcId。

Dapper的设计目标

●

低消耗 (Low overhead)：跟踪系统对在线服务的影响应该做到足够小。在一些高度优化过的服务，即使一点点损耗也会很容易察觉到，而且有可能迫使在线服务的部署团队不得不将跟踪系统关停。

●

应用级的透明 (Application-level transparency)：对于应用的程序员来说，是不需要知道有跟踪系统这回事的。如果一个跟踪系统想生效，就必须需要依赖应用的开发者主动配合，那么这个跟踪系统也太脆弱了，往往由于跟踪系统在应用中植入代码的bug或疏忽导致应用出问题，这样才是无法满足对跟踪系统“无所不在的部署”这个需求。面对当下向Google这样的快节奏的开发环境来说，尤其重要。

●

延展性 (Scalability)：Google至少在未来几年的服务和集群的规模，监控系统都应该能完全把控住。

●

Low overhead: the tracing system should have negligible performance impact on running services. In some highly optimized services even small monitoring overheads are easily noticeable, and might compel the deployment teams to turn the tracing system off.

●

Application-level transparency: programmers should not need to be aware of the tracing system. A tracing infrastructure that relies on active collaboration from application-level developers in order to function becomes extremely fragile, and is often broken due to instrumentation bugs or omissions, therefore violating the ubiquity requirement. This is especially important in a fast-paced development environment such as ours.

●

Scalability: it needs to handle the size of Google’s services and clusters for at least the next few years

什么是EagleEye？

●

EagleEye是Google的分布式调用跟踪系统Dapper在淘宝的实现，EagleEye通过在每一次系统调用（广义RPC）前和调用后进行埋点同时收集和分析埋点日志来梳理应用的调用和依赖关系，能够快速定位异常、分析系统调用链路和评估链路瓶颈等。

●

EagleEye在应用服务器中主要做了两件事情：

○

第一件是生成traceId和rpcId，并将这两个信息外加用户数据（压测标记）透传到调用链的下游应用中；（链路数据）

○

第二件是在本地记录日志，主要是记录本次调用的相关信息。（本地数据）

●

EagleEye中提到的rpc不只是rpc框架HSF，而是广义的rpc概念，即泛指任何的远程调用过程。

什么是TraceId？

●

TraceID是RPC链路的全局唯一标识，通过TraceId，Eagleye处理日志时可以把一次前端请求在不同服务器记录的调用日志关联起来，重新组合成当时这个请求的调用链。理论上TraceID在一次请求中只应该被生成一次，并跟随请求传递至RPC调用经过的各个节点。

●

在用户请求到达服务器时，应用容器在执行实际业务处理之前，会先执行EagleEye的埋点逻辑，为这个请求分配一个全局唯一的调用链ID，这个ID在EagleEye 里面被称为 traceId，traceId在整个调用过程中都不会改变，用于唯一标识这一次用户请求。EagleEye将traceId存储在ThreadLocal中的上下文信息里面，上下文信息里还有一个rpcId，rpcId用于区分同一个调用链下的多个网络调用的发生顺序和嵌套层次关系。

为什么需要TraceId?

●

构建一个可观测性的系统，帮助我们更好的理解分布式系统的拓扑关系

●

更好的监控我们的系统，从端到端，以及上下游服务依赖的调用链路

●

快速定位问题

●

全链路压测，提前定位和发现系统的问题

什么是rpcId？

●

traceId能够唯一标识一条调用链，但是无法标识该调用链路的每一次调用的顺序和嵌套层次，因此EagleEye还额外使用了rpcId，rpcId的作用是标识当前调用过程在整条调用链路的位置。rpcId用0.X1.X2.X3…..Xi表示，Xi都是非负整数，根节点的rpcId固定从0开始，第一层网络调用的rpcId是0.X1，第二层的则为0.X1.X2，依次类推，通过rpcId，可以准确的还原出调用链上每次调用的层次关系和先后顺序。

![[b1da8118-2241-4dfb-8753-12abe6332050.png]]

什么是采样率？

●

采样率即一个用户请求被采样（存储）的概率，被采样的记录才能够根据traceId查找到链路记录，否则查找不到。

●

目前EagleEye的采样率为1/1000，采样规则：23,24,25位都为0的TraceId。

采样率例子

●

符合采样率： [0bb6ad0316634729997854000e8a3f](http://eagleeye.alibaba-inc.com/trace/callChain.htm?traceId=0bb6ad0316634729997854000e8a3f)

●

不符合采样率： [212c17f716638580832076144e07c9](http://eagleeye.alibaba-inc.com/trace/callChain.htm?traceId=212c17f716638580832076144e07c9)

为什么需要采样率？

●

由于每一个请求就会生成一个链路，为了减少性能消耗，避免存储资源的浪费（主要是成本问题，其次是全部存储的必要性不大），EagleEye并不会记录所有的链路数据，而是使用采样的方式，控制存储的链路数量。可以在发现性能瓶颈的同时，有效减少性能损耗。采样率的概念在其他的追踪系统中也被广泛使用。

什么是本地数据？什么是链路数据？

从数据的分类上来看，EagleEye只有两种数据：本地数据和链路数据。

●

本地数据：记录在本地日志中

○

比如：时间戳、调用的类名、方法名、用户数据等

●

链路数据：记录在本地日志中，并会跟随调用链传递至下游

○

比如：traceId、rpcId、用户数据等

例：通过HTTP的形式传递链路数据

●

中间件埋点（HSF、MetaQ、TDDL等）也是一样的道理，发送端在发送RPC请求的时候会把这些能够唯一标示链路的信息附在请求里，接收端在接受RPC请求的时候，再把这些信息从请求里取出来，并放进ThreadLocal中。

![[251c4dd3-0b5d-41fa-8b23-9ebe8b72cd92.png]]

EagleEye-TraceId:213fc34f16634734548303777ec49f

EagleEye-RpcId:0.1.1

// 用户数据 - 以@开头，可以包含多对业务数据，每对业务数据以KV格式记录

// 分隔符为不可见字符，两个KV之间的分隔符是0x12，K和V的分隔符是0x14。本地数据的K以@开头

EagleEye-UserData:|@@rpcName0x14RPC 0x12 i0x147325abff 0x12

// 使用EagleEye-Core的API存入本地or链路数据

EagleEye.attribute("rpcName", "RPC");

EagleEye.putUserData("i", "7325abff");

## 原理

## TraceId

### TraceId是如何生成的？

![[e3ecc648-3785-455c-8a86-01b709aa7ea1.png]]

如何生成TraceId并保证唯一呢？这是在EagleEye之中非常重要的细节。TraceId 采用了类似以 UUID库产生随机数，但是，在机器数量急剧增加的情况下，使用随机数很容易发生碰撞，并且缺乏直观的业务语义，不能最大化利用这串字符。因此 EagleEye 使用了带有业务语义的 TraceId 方案，能够保证单台机器900万 qps 不发生碰撞。

EagleEye生成的traceId，由五个部分组成：

第一部分是生成traceId的机器的8个字符的IP地址；

第二部分是13个字符的生成traceId的毫秒级的生成时间（时间戳）；

第三部分是4位（1000-9999）的自增顺序数，顺序数用于避免多线程并发时traceId碰撞；

第四部分是一个字符的标志位，用于标识生成该traceId的应用模块（例如nginx模块的标志位为e，Java应用中的标志位固定为d）；

第五部分是4个字符的进程id。

### TraceId是如何传递的？

![[341e1a65-5362-4dc0-b7b5-3d1279d99902.png]]

应用A是接受到来自用户请求的一条调用链的开始端，在请求收到后它会先调用EagleEye.StartTrace生成traceId并放置在当前线程的ThreadLocal中，在应用A调用应用B、C的HSF服务，或者发送MetaQ消息时，traceId被包含在EagleEye上下文中，随网络请求到达应用B、C、F、G之中，并放置在接收端的当前线程ThreadLocal内，因此后续调用到的这些系统都会有EagleEye这次请求的上下文。这些系统再发起网络请求时，也类似的携带了上下文信息的。注：EagleEye基于ThreadLocal实现上下文的存储，所以当业务方使用同步的方式时对使用者透明，但是该方式无法支持异步线程的场景，所以在使用异步线程时需要手动传递上下文，当业务逻辑转移到异步线程时，需要先备份 EagleEye 的调用上下文到异步任务中，保证链路的正确性。

EagleEye已经集成在HSF、Notify、MetaQ、TDDL、Tair等集团中间件产品中，这些中间件能够自动执行EagleEye的埋点逻辑，完成traceId和rpcId的上下游传递。 Dapper设计目标：应用级的透明 (Application-level transparency)，通过在中间件埋点的方式实现traceId的传递，对应用的业务代码的侵入程度较低。

传递上下文方案

●

方案一（推荐）：手动，每一个异步任务都要加这段代码

●

方案二：自动，统一的处理

○

前提：线程池是业务自己创建的

○

重写AbstractExecutorService的两个newTaskFor方法

■

线程池的三个submit方法都会调用newTaskFor方法将传入的Runnable或Callable包装成FutureTask后，最终通过Executor的execute方法提交给线程池（至于提交后怎么运行这个任务，是Executor的逻辑）。

// 【方案一】

Object ctx = EagleEye.getRpcContext(); // 从当前 ThreadLocal 备份

MyAsyncTask task = new MyAsyncTask(); // 这里的MyAsyncTask是一个业务自定义的Runnable

task.setRpcContext(ctx); // 将 ctx 保存到 task 中

Future future = bizThreadPoolExecutor.submit(task); // 提交任务

// 后面继续执行其他逻辑，或者用 future.get() 等待任务的结果，都没有问题

// 如果 submit 多个 task，每个 task 都需要保存一份 ctx

class MyAsyncTask implements Runnable {

private Object ctx; // 用于存放之前保存的 EagleEye 上下文

public void setRpcContext(Object ctx) { this.ctx = ctx; }

public void run() {

EagleEye.setRpcContext(ctx); // 还原到 ThreadLocal

try {

// 开始做异步逻辑，如调用 HSF、Notify、Tair 之类

//...

} finally {

// 务必清理 ThreadLocal 的上下文，避免异步线程复用时出现上下文互串的问题

EagleEye.clearRpcContext();

}

}

}

// 【方案二】

// 如果线程池是自己创建的，可以用方案二，只需要覆盖ThreadPoolExecutor里面的两个方法即可。

// (注意: 只针对使用 submit 方法, 如果想使用 execute方法, 请参考方案一)

class EagleEyeFixThreadPoolExecutor extends ThreadPoolExecutor {

// 重写前的逻辑

protected <T> RunnableFuture<T> newTaskFor(Runnable runnable, T value) {

return new FutureTask<T>(runnable, value);

}

protected <T> RunnableFuture<T> newTaskFor(Callable<T> callable) {

return new FutureTask<T>(callable);

}

## 日志

### 日志格式

●

查看一个链路的 [日志原文](http://eagleeye.alibaba-inc.com/trace/callChain.htm?traceId=0bb6ad0316634729997854000e8a3f)

![[a1c56040-b77a-4f19-9eb5-79f08f1eae2a.png]]

213d415916630562138211941ef540|1663056213922|2|0.1.1.19|com.alitrip.btrip.btripcontrol.client.service.RuleLocalService:1.0.0|queryReserveList~Q|00|33.5.179.202|30|0|@icfb390a0r33.5.179.202\_btriplog\_event\_parent\_id5a17dc855b82445681df4d69a74df63d\_btriplog\_event\_pageId\_btriplog\_event\_key\_btriplog\_event\_pageNamedpath\_envDPathBaseEnvsbee5b9a1@ps

dd97e5d116630562131661012922f7|1663056214013|2|0.1.2.27|com.alitrip.btrip.btripcontrol.client.service.ReserveRuleControlInfoService:1.0.0|queryCorpBacsiReserveRulePrice~SS|00|33.7.26.198|2|0|@i84d1a21cr33.7.26.198dpath\_envDPathBaseEnvs17e8766b@ps

dd97e5d116630562131661012922f7|1663056214013|94|0.1.2.27.1|TDDL\_CONN|94||\[0, 0\]|00|0|0|@i84d1a21cr33.7.26.198dpath\_envDPathBaseEnvs17e8766bateye\_rpc\_id11456218323.1@s0com.alitrip.btrip.btripcontrol.client.service.ReserveRuleControlInfoService:1.0.0@queryCorpBacsiReserveRulePrice~SS

dd97e5d116630562131661012922f7|1663056214013|4|0.1.2.27.2|trip\_corp:|QUERY|33.10.238.27:3012|\[0, 1\]|00|0|0|@i84d1a21cr33.7.26.198dpath\_envDPathBaseEnvs17e8766bateye\_rpc\_id11456218323.1.1@s0com.alitrip.btrip.btripcontrol.client.service.ReserveRuleControlInfoService:1.0.0@queryCorpBacsiReserveRulePrice~SS

位置

/home/admin/logs/eagleeye/eagleeye.log

格式

注

●

日志以竖线'|'分割

●

日志的前三个字段固定，含义为traceId、timestamp、rpcType。不同rpcType对应日志的余下字段个数、含义及顺序会略有不同。

EagleEye日志主要分为三类：入口型、客户端型和服务端型，不同类型的日志格式有所不同。

入口型： traceId|timestamp|rpcType|span|rpcId|resultCode|traceName|extInfo|userData

客户端型： traceId|timestamp|rpcType|rpcId|serviceName|method|remoteIp|span|resultCode|requestSize|responseSize|extInfo|userData

服务端类型： traceId|timestamp|rpcType|rpcId|serviceName|method|resultCode|remoteIp|span|responseSize|extInfo|userData

字段含义

●

traceId：全局唯一的Id，用作整个链路的唯一标识与组装

●

timestamp：调用的开始时间

●

rpcType：Rpc调用类型标示， [详细信息](http://mw.alibaba-inc.com/products/eagleeye/_book/eagle-log.html?spm=a1zco.8292288.0.0.5d5e2588LVHUxh)

○

入口型

■

HTTP前端 0

○

RPC类型

■

HSF客户端 1

■

HSF服务端 2

■

HTTP客户端25

■

HTTP服务端 251

○

数据类型

■

TDDL客户端 4

○

....

●

rpcId：用来标示 RPC 调用层次关系

●

serviceName：调用的服务名（可能已编码）

●

method：调用的方法名（可能已编码）

●

remoteIp：対端地址(默认为0.0.0.0)

●

span：记录的是调用的时间偏移量，毫秒为单位，有两种格式：\[a,b\](客户端类型)或者是一个数字c(服务端类型)，a=调用开始到客户端发送请求的时间差，b=调用开始到收到响应的时间差，c=处理时间

●

resultCode：标示rpc调用成功或者失败，一般00表示成功，01表示失败， [详细信息](http://gitlab.alibaba-inc.com/middleware/eagleeye-docs/wikis/eagleeye-error-code)

●

requestSize：客户端请求的大小(默认为0)

●

responseSize：服务端响应的大小(默认为0)

●

extInfo：用户附加的扩展数据，可选，\[详细信息\]

●

userDate：业务自定义数据，可选， [详细信息](http://gitlab.alibaba-inc.com/middleware/eagleeye-docs/wikis/eagleeye-core-userdata)

### 写日志

采用通用日志框架会引入很多不需要的特性，带了更多性能损耗，为了提高性能和对写日志底层做更细致的控制，EagleEye自己实现了日志输出：利用无锁环形队列做日志异步写入来避免hang住业务线程，调节日志输出缓冲大小，控制每秒写日志的IO次数等。

EagleEye的日志记录过程是高并发的，初期采用同步写日志的方案，但是同步写日志会导致在极端情况下线程池会被日志线程占满，影响到业务应用的主线程。EagleEye作为辅助的功能，其记录日志过程不应影响到主线程，因此EagleEye后期采用异步写日志的方式：任何线程要写日志，只需要把日志事件对象加入日志队列就行了，后台会专门起一个线程从日志队列中取出日志对象再写入到本地文件中，虽然此举会导致日志记录有些许延时，但是保证了只有一个日志记录线程，不会将线程池占满。

为了追求高性能，EagleEye采用异步的方式写日志，那么EagleEye就需要两个逻辑流程：一个流程是往日志队列中加入日志对象，另一个流程是从日志队列中取出日志对象，并写日志到本地文件中。EagleEye维护了一个环形队列，由 put、take 两个游标来标识当前队列的下一次调用put和take应该返回的位置，每当put一个元素则put指针往前移动一格，每当take一个元素也往前移动一格，并且通过一定的逻辑处理保证put指针一直在take指针前面。

![[86a043dc-1d32-499a-bfb6-2efd9872edca.png]]

#### 日志队列中添加日志对象源码解读

往日志队列中加入日志对象，是EagleEye的AsyncAppender类的append方法实现的，其原理是向一个环形队列（由环形数组实现）中放入日志对象ctx，看一下具体过程

核心代码是entries\[(int)put & indexMask\] = ctx，由于下标掩码indexMask的值是queueSize-1，而queueSize的值是4096，所以indexMask的二进制码是全为1的，因此能够保证put与indexMask相与后得到的数组下标不会超过数组长度，同时能够形成环形（当put的值开始超过数组长度时，与indexMask进行“与计算”后会重新被放入到数组的头部）。

需要注意的是，日志入队列时put的值会一直增大，由于是环形队列，如果没有线程消费日志的话，最后会导致put指针饶了一圈最终又追赶上了take指针，若是继续增大put的值，会覆盖掉第一圈所存下的日志对象，此时若再有日志请求入环形队列，该日志对象会被直接丢弃掉，以此来保证总共只有一圈。

/\*\*

\* 异步提交日志，避免影响主线程

\* @author jifeng

\*/

class AsyncAppender extends EagleEyeAppender {

// 环形数组实现的环形队列，size 必须为 2 的 n 次方

private final BaseContext\[\] entries;

// 环形队列的长度：4096

private final int queueSize;

// 下标掩码，其值是queueSize-1

private final int indexMask;

private final ReentrantLock lock;

private final Condition notEmpty;

// put位置的游标

private AtomicLong putIndex;

// take位置的游标，一直递增，不能大于 putIndex

private AtomicLong takeIndex;

int size() {

return (int) (putIndex.get() - takeIndex.get());

}

/\*

\* 异步写日志

\*/

boolean append(BaseContext ctx) {

final long qsize = queueSize;

long startTime = 0;

for (;;) {

final long put = putIndex.get();

final long size = put - takeIndex.get();

if (size >= qsize) {

/\*\*

### 采集日志

EagleEye控制台能够看到一次traceId全部调用过程并进行分析，要实现如此功能必须要在EagleEye控制台的服务器集群中存储所有应用的EagleEye日志。

站在设计者的角度去思考，要想EagleEye控制台获取到所有应用的EagleEye日志，有两种思路：第一种是所有的应用在执行EagleEye埋点逻辑时，也将本地的EagleEye日志上传到EagleEye控制台上；第二种是EagleEye控制台的服务器定时去所有应用的服务器上拉取EagleEye日志。

EagleEye选择的第二种方式，即定时去应用服务器上拉取指定路径的EagleEye日志，并根据traceId将日志进行重组和排列，最终得到了EagleEye控制台上展现的调用链。事后分析一下，选择第二种方式的好处是拉取日志的速率可以由EagleEye自己决定，但是也有缺点比如EagleEye日志会有一些延时；转而一想，如果选择了第一种方式，则会存在更大的问题：所有应用无时无刻不在打EagleEye日志，第一种方式中所有应用每打一次日志就上传一次，全集团的应用加在一起势必会把EagleEye服务器给打挂，最终导致服务不可用。

采样策略

●

Adaptive Sampling，自适应采样，适用于小流量场景。

●

Fixed-rate Sampling，固定比例采样，可以保存完整链路。

●

Signature Sampling，链路签名采样，保证每类特征组合都能命中，最好在入口打标。

●

Priority Sampling，优先级采样，适用于错/慢/异常等关键链路。

●

Custom Sampling，自定义采样，适用于调试模式，自定义场景等。

日志采集策略

●

基础采样率（1/1000），TraceId 第 23、24、25位必须同时为0

●

预发全量，以 prehost 结尾的分组数据全量存储

●

最近5分钟全量，TraceId 生成后的5分钟内，会缓存在计算集群内存中，实现全量效果

●

3s慢调用全量，单次请求耗时超过3s的链路将被全量存储

#### 采样率

EagelEye的采样率为1/1000，即每1000次在EagleEye上的链路查询，有1次会查询到调用链，其他999次都会返回空。如此低的采样率如果不进行任何优化，EagleEye基本上是不可用的状态。

![[70652d5e-180a-4790-840e-d94fcd642294.png]]

采样率的演进

EagleEeye的采样策略和采样率是在不断的演进的，并不是一开始就使用1/1000的采样率，EagleEye历史上曾经使用过很多采样率策略，比如：

●

保存10%的采样策略，即：所有的调用链日志根据traceid进行分类，只保存traceid里面序列号是10的倍数的调用链

●

细分的采样规则，根据应用体量：体量大样本足，系统稳定 -> 低采样率。体量小样本不足，系统不稳定 -> 高采样率

为什么不能把采样率调高？（其实也没有必要调高）

2019年3月，集团内有 16000+ 应用接入 EagleEye，运维实例数超过百万级，链路数据规模达到 10PB+。 2018 上半年，我们为了解决 “查询慢” 的问题，将 EagleEye 的调用链存储从 HiStore 迁移至 SLS，有效提升查询速度 3s -> 1s。但随之而来的，是存储成本的大幅上升， SLS 存储账单高达 25W/天（不计算内部折扣）。

在成本问题面前，我们只保留了基础采样率、预发采集和小流量应用，下线了其他采样策略。下线了其他采样策略之后，全局采样率（存储的调用链数量/总调用链数量）从7%下降到0.5%，成本由25W/天下降到2W/天，成本问题得到了控制，但是有效查询率（查询命中率/总查询数）由55%下降到40%。

问题的关键就是成本与查询有效性之间的平衡，因此我们需要寻找新的增加查询命中率的方式。

如何提升查询有效性？

通过对TraceId查询的数据分析我们发现

1、接近40%的查询发生在调用链生成的5分钟内 —— [EagleEye五分钟全量查询功能](https://ata.alibaba-inc.com/articles/134723) ，从调用链生成的时间点开始，在五分钟内，所有的调用链都可以查询到。

一条链路被查询的时间与这条链路生成的时间之间差的分布的统计

![[18222e90-5d6e-42aa-b899-244fc3f73fbe.png]]

五分钟全量查询的标识

![[c52c946b-8fa4-4119-b445-998cb98e9043.png]]

2、当调用链中出现错误、超时、以及延迟达数秒的调用的时候，被查询的概率比较高，这些调用链仅占总量的1‰ —— [EagleEye错慢链路全量采集功能](https://ata.alibaba-inc.com/articles/117311) ，当出现符合条件的traceId的时候，这条链路不再受任何规则限制，直接会将全部的上下游链路记录下来。

错慢全采样的标识 ![[d7ee2940-78cb-41e6-9b71-cfccca0c58a0.png]]

#### 五分钟全量查询&错慢全采样

EagleEye的日志采集是分布式，同一条次调用产生的调用日志会分布在不同应用的服务器上，收集后也会出现在不同的采集节点上面。

![[7de9bf54-4348-4254-b000-d66d8f83d2a1.jpeg]] ![[3a9ce8b0-6a5d-43bd-8228-427c3739d3d3.jpeg]]

对此我们有两种方式：

●

将属于同一个traceId的日志发送到同一台机器上，然后在这台机器上面集中处理。

●

每个采集点单独处理自己所收集的日志，发现符合采样规则（如其中存在错慢调用）后，通知其他所有采集点保存带有这个traceId的调用链日志

我们采用的是第二个方案，这个方案比上一个方案cpu消耗小，而且当处理同一条调用链的数据在两个不同的流计算集群的时候，仍然可以把需要保存的traceid相互通知。

采集到的日志在内存中的结构大概是这样的：

Map<timestamp, Map<traceid, List<tracelog>>>

![[1b9eef5b-0dae-4408-9649-02d4bfe94819.jpeg]]

然后定时找出产生超过一定时间的日志，检查其中是否有符合采样条件的日志，输出到存储。

说明：以上的存储结构并不能放在生产环境中使用，实际上还需要进行一些优化，对细节感兴趣的可以看 [中间件极客挑战赛落地实现--EagleEye错慢链路全量采集功能的使用及实现](https://ata.alibaba-inc.com/articles/117311)

### 日志总结

以下面这条调用链路位例：

应用A -> 应用B -> 应用C

#### 图例

以HSF为例，HSF：会同时在Client端和Server端记录日志

HSF客户端：rpcType=1

traceId|timestamp|rpcType|rpcId|serviceName|method|remoteIp|span|resultCode|requestSize|responseSize|extInfo|userData

HSF服务端：rpcType=2

traceId|timestamp|rpcType|rpcId|serviceName|method|resultCode|remoteIp|span|responseSize|extInfo|userData

![[4c6b7e70-ab8e-4e58-8a84-248ac46c0d28.jpeg]]

#### 文字说明

1、首先traceId和rpcId会通过在中间件（比如HSF）埋点的方式进行传递，因此这三个应用的traceId和rpcId是一致的。当这条调用链路走完后，应用A、应用B、应用C中的其中一台机器（应用都是集群）的eagleeye.log文件中都会打印一条traceId相同的日志，但时间戳、类名、方法名等这些都是不一样的。

2、随后，EagleEye的集群会定时从这三个应用的机器中采集日志，需要注意的是，这三条日志可能被同一个采集点（EagleEye集群中的一台机器）采集，也有可能会被多个采集点采集。采集点采集到日志后，并不是立马存下来，而是先放在内存中一段时间（五分钟全量采集），当过了这段时间后，再判断这个traceId是否符合采样规则，符合则会存储下来（打日志），否则直接丢弃。

## 现有分布式追踪框架比较

<table><colgroup><col width="162"> <col width="162"> <col width="162"> <col width="162"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>现有系统</p></td><td rowspan="1" colspan="1"><p>厂商</p></td><td rowspan="1" colspan="1"><p>开源</p></td><td rowspan="1" colspan="1"><p>特点</p></td></tr><tr><td rowspan="1" colspan="1"><p>Jaeger</p></td><td rowspan="1" colspan="1"><p>uber</p></td><td rowspan="1" colspan="1"><p>开源</p></td><td rowspan="1" colspan="1"><p>go、部分侵入、采集策略灵活</p></td></tr><tr><td rowspan="1" colspan="1"><p>EagleEye</p></td><td rowspan="1" colspan="1"><p>taobao</p></td><td rowspan="1" colspan="1"><p>不开源</p></td><td rowspan="1" colspan="1"><p>java、侵入性低、采集策略灵活、丰富的数据报表</p></td></tr><tr><td rowspan="1" colspan="1"><p>Zipkin</p></td><td rowspan="1" colspan="1"><p>Twitter</p></td><td rowspan="1" colspan="1"><p>开源</p></td><td rowspan="1" colspan="1"><p>java、侵入性强、采集策略灵活、丰富的数据报表</p></td></tr><tr><td rowspan="1" colspan="1"><p>Watchman</p></td><td rowspan="1" colspan="1"><p>weibo</p></td><td rowspan="1" colspan="1"><p>不开源</p></td><td rowspan="1" colspan="1"><p>java、侵入性低（字节码增强）</p></td></tr><tr><td rowspan="1" colspan="1"><p>CallGraph</p></td><td rowspan="1" colspan="1"><p>jd</p></td><td rowspan="1" colspan="1"><p>不开源</p></td><td rowspan="1" colspan="1"><p>java、侵入性低（字节码增强）</p></td></tr><tr><td rowspan="1" colspan="1"><p>MTrace</p></td><td rowspan="1" colspan="1"><p>meituan</p></td><td rowspan="1" colspan="1"><p>不开源</p></td><td rowspan="1" colspan="1"><p>侵入性很低、采集策略灵活、丰富的数据报表</p></td></tr><tr><td rowspan="1" colspan="1"><p>Skywalking</p></td><td rowspan="1" colspan="1"><p>huawei</p></td><td rowspan="1" colspan="1"><p>开源</p></td><td rowspan="1" colspan="1"><p>java、无字节码注入，无侵入</p></td></tr></tbody></table>

## 你可能不知道的几个EagleEye的Feature

●

[即席故障多维分析](http://eagleeye.alibaba-inc.com/ts/ibQuery.htm)

●

[个性化采样率](http://eagleeye.alibaba-inc.com/app/sampleSetting.htm) （指定条件全量收集）

●

收藏（这个功能好像不太行）

●

查看SQL

## 参考文档

[Dapper, a Large-Scale Distributed Systems Tracing Infrastructure](https://storage.googleapis.com/pub-tools-public-publication-data/pdf/36356.pdf)

[链接监控 EAGLEEYE中间件文档](http://mw.alibaba-inc.com/product-eagleeye.html)

[EagleEye鹰眼实践小结](https://ata.alibaba-inc.com/articles/211961)

[鹰眼下的淘宝——分布式调用跟踪系统介绍 ( 2015年版 )](https://ata.alibaba-inc.com/articles/47574)

[EagleEye五分钟全量查询功能](https://ata.alibaba-inc.com/articles/134723)

[你可能不知道的几个EagleEye的Feature](https://ata.alibaba-inc.com/articles/47615)

[中间件极客挑战赛落地实现--EagleEye错慢链路全量采集功能的使用及实现](https://ata.alibaba-inc.com/articles/117311)

END

基本概念

原理

TraceId

TraceId是如何生成的？

TraceId是如何传递的？

日志

日志格式

写日志

日志队列中添加日志对象源码解读

采集日志

采样率

五分钟全量查询&错慢全采样

日志总结

图例

文字说明

现有分布式追踪框架比较

你可能不知道的几个EagleEye的Feature

参考文档

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
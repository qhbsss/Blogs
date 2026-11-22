---
title: "Flink与Spark特性解析及差异对比"
source: "https://ata.atatech.org/articles/11000195666?spm=ata.23639746.0.0.39f24cf87GV0Un"
author:
  - "[[李京蔚]]"
published:
created: 2026-10-07
description:
tags:
  - "clippings"
---
第一代计算引擎：Hadoop MapReduce - 批处理  
第二代计算引擎：DAG 框架（Tez）+ MapReduce - 批处理  
第三代计算引擎：Spark - 微批次、批+流+SQL - 较高的延迟  
第四代计算引擎：Flink - 批+流+SQL+DAG 低延迟-高吞吐-高可靠

## Flink基础及特性介绍

Flink初衷-流式处理数据，减少在大型分布式系统中，数据一致性和对事件发生顺序理解的局限性造成的危害。

物联网-流数据被普遍应用的领域

流处理预期-低延迟、高吞吐、可处理中断、容错并保证exactly-once

得到有保障的准确状态-微批处理作业，可实现exactly-once语义

## 对比Spark Streaming

值得一提的是，Spark Streaming通过微批处理方法实现了高吞吐和容错性，牺牲了低延迟和实时处理能力，  
窗口与自然时间不匹配，表现力欠佳。

flink-批流一体，支持高吞吐和exactly-once语义的实时计算  
如何做到-批处理(处理有限的静态数据)作为特殊的流处理

flink执行引擎-在YARN集群，Mesos集群和单机上均可运行

## 对比传统数据架构

中心化的数据库系统存储事务性数据(SQL或者NoSQL)新鲜数据，分布式文件系统存储不需经常更新的数据。传统批处理架构采用Lambda架构，flink采用流处理架构，Spark Streaming微批处理架构和批处理架构本质一致，只不过隐藏摄取和存储，将微批数据用预写日志的形式存储在内存中。Flink这样的现代流处理器，在shuffle阶段将含有多个事件的缓冲容器通过网络发送，此处批处理只作为提高系统性能的机制，须完全独立于定义窗口时用的缓冲，不能作为API的一部分。

消息传输和流处理：文件/数据库->Kafka/Logs/MapR Streams/MQ/...(消息传输层)->Flink(流处理层)

消息传输层需求-高性能和持久性，持久性意味着消息可以重播，解耦生产者和消费者(支持微服务)

流处理架构-消息队列代替集中式数据库，作为共享数据源，服务不同消费者

跨地域复制-保存消息偏移量(共享资源最新状态，多个数据中心可缓解高吞吐带来的压力，降低网络传输延迟，备份防灾)

## flink流处理特性1

使计算窗口与会话窗口吻合，根据真实情况设置计算窗口  
窗口是一种机制，它用于将许多事件按照时间或者其他特征分组，从而将每一组作为整体进行分析。  
时间窗口-滚动时间窗口，滑动时间窗口  
计数窗口-滚动、滑动  
会话窗口-活动阶段，例如用户与网站进行一系列交互（活动阶段）之后，关闭浏览器或者不再交互（非活动阶段）  
窗口的实现需注意：开窗机制与检查点机制完全分离，复杂窗口形式可由基本开窗机制定义

## flink流处理特性2

故障出现时仍有状态计算，checkpoint(检查点)：记录中间计算状态，故障发生时准确重置。关于检查点机制的介绍穿插在之后的调度流程描述中，描述可参见流处理特性7。

## flink流处理特性3-能区分事件时间与处理时间

流处理中的时间-事件时间(事件实际发生的时间)，处理时间(事件被处理的时间)，摄取时间/进入时间(事件进入流处理框架的时间)  
事件时间偏差-事件时间和处理时间存在偏差，导致事件以乱序到达流处理器。

## flink流处理特性4

提供触发机制，触发器控制生成结果的时间，例如采用事件时间的窗口在收到水印时触发生成结果(聚合窗口内容并将结果返回给用户)。触发器可自定义

## flink流处理特性5

时空穿梭，重新处理数据的能力。按时间回溯并正确重新处理数据，须支持事件时间(特性核心点)  
水印机制-flink通过水印来推进事件时间，水印使得事件时间与处理时间完全无关，设定水印需要领域知识，或者学习事件的迟到规律生成模型，可以是启发式的。水印是Flink 判断迟到数据的标准，同时也是窗口触发的标记。在程序并行度大于1 的情况下，会有多个流产生水印和窗口，这时候Flink 会选取时间戳最小的水印。当Flink 接收到每一条数据时，都会产生一条Watermark，这条Watermark 就等于当前所有到达数据中的maxEventTime - 延迟时长，Watermark 是由数据携带的，一旦数据携带的Watermark 比当前未触发的窗口的停止时间要晚，那么就会触发相应窗口的执行。Watermark 就是触发前一窗口的“关窗时间”，一旦触发关门那么以当前时刻为准在窗口范围内的所有数据都会收入窗中。只要没有达到水位那么不管现实中的时间推进了多久都不会触发关窗。

## flink流处理特性6-支持有状态计算，视状态及其正确性为重中之重

流式计算-无状态和有状态，无状态计算观察每个独立事件，并根据最后一个事件输出结果，有状态计算基于多个事件输出结果(维护状态，根据每条输入记录更新，基于最新输入的记录和当前的状态值生成输出记录)

### 两种类型状态-算子状态(operator state)，键控状态(keyed state)

算子状态的作用范围限定为算子任务。这意味着由同一并行任务所处理的所有数据都可以访问到相同的状态，状态对于同一任务而言是共享的。算子状态不能由相同或不同算子的另一个任务访问。  
键控状态是根据输入数据流中定义的键（key）来维护和访问的。Flink 为每个键值维护一个状态实例，并将具有相同键的所有数据，都分区到同一个算子任务中，这个任务会维护和处理这个key 对应的状态。当任务处理一条数据时，它会自动将状态的访问范围限定为当前数据的key。因此，具有相同key 的所有数据都会访问相同的状态。Keyed State 很类似于一个分布式的key-value map 数据结构，只能用于KeyedStream（keyBy 算子处理之后）。

流处理一致性级别  
at-most-once：没有正确性保障的委婉说法，故障发生之后，计数结果可能丢失  
at-least-once：计数结果可能大于正确值，绝不会小于正确值，计数程序在发生故障后可能多算不会少算  
exactly-once：系统保证在发生故障后得到的计数结果与正确值一致

## 流处理一致性对比

Storm Trident和Spark Streaming最先保证exactly-once的系统，在性能和表现力两方面付出了很大的代价，批量处理保证exactly-once，导致低延迟和正确性效率不可兼得

## flink流处理特性7-保证exactly-once的同时，具有低延迟和高吞吐的处理能力

检查点特性保证exactly-once-确保状态正确，检查点屏障隔开数据，当flink数据源遇到检查点屏障时，其在输入流中的位置被保存至稳定存储中。让flink可根据该位置重启输入。状态在算子收到检查点屏障时，会被以异步的方式写入稳定存储。稳定存储备份检查点屏障在输入流中的位置发生在检查点屏障被输入算子处理的时候，(map)算子接着开始处理检查点屏障触发状态异步备份到稳定存储中。当状态备份和位置备份被确认之后，该检查点操作标记为完成。  
flink检查点算法的正式名称-异步屏障快照(asynchronous barrier snapshotting)  
检查点本质上是一个可持续升级状态版本的可编程机制

## flink流处理特性8-保存点(savepoint)

手动触发，可从保存点启动被修改过的程序版本  
保存点用途-应用程序代码升级、flink版本更新、维护和迁移、假设模拟与恢复、A/B测试

flink拓扑-3个算子例子，source读取输入数据，根据key分区，将数据路由到有状态的算子实例，算子实例将状态内容或者衍生结果写入sink，sink将结果传送到输出存储系统中

### 端到端的一致性保证

1. 在sink环节缓冲所有输出，收到检查点记录时，将输出"原子提交"到存储系统
2. 即时将数据写入输出存储系统，需要在发生故障时重新处理

 内部保证—— 依赖checkpoint  
 source 端—— 需要外部源可重设数据的读取位置  
 sink 端——需要保证从故障恢复时，数据不会重复写入外部系统而对于sink 端，又有两种具体的实现方式：幂等（Idempotent）写入和事务性（Transactional）写入。

 幂等写入  
所谓幂等操作，是说一个操作，可以重复执行很多次，但只导致一次结果更改，也就是说，后面再重复执行就不起作用了。  
 事务写入  
需要构建事务来写入外部系统，构建的事务对应着checkpoint，等到checkpoint真正完成的时候，才把所有对应的结果写入sink 系统中。事务性写入，具体又有两种实现方式：预写日志（WAL）和两阶段提交（2PC）

 预写日志（Write-Ahead-Log，WAL）  
把结果数据先当成状态保存，然后在收到checkpoint 完成的通知的时候，一次性写入sink 系统简单易于实现，由于数据提前在状态后端中做了缓存，所以无论什么sink 系统，都能用这种方式一批搞定  
 两阶段提交（Two-Phase-Commit，2PC）  
对于每个checkpoint，sink 任务会启动一个事务，并将接下来所有接收的数据添加到事务里然后将这些数据写入外部的sink 系统，但不提交它们-----这时只是“预提交”当它收到checkpoint 完成的通知时，它才正式提交事务，实现结果的真正写入这种方式真正实现了exactly-once ，它需要一个提供事务支持的外部sink 系统。

 2PC 对外部sink 系统的要求  
外部sink 系统必须提供事务支持，或者sink 任务必须能够模拟外部系统上的事务  
在checkpoint 的间隔期间里，必须能够开启一个事务并接受数据写入  
在收到checkpoint 完成的通知之前，事务必须是“等待提交” 的状态。在故障恢复的情况下，这可能需要一些时间。如果这个时候sink 系统关闭事务（列如超时了），那么未提交的数据就会丢失  
sink 任务必须能够在进程失败后恢复事务  
提交事务必须是幂等操作

## 吞吐量和延迟性能测试对比

Spark Streaming不能做到两全，Storm和Flink可以在吞吐量增加时维持低延迟。  
Flink较于Storm提供状态容错特性。  
Storm能够承受每秒40万事件，受限于CPU，Flink可达每秒300万事件，受限于Kafka集群和Flink集群之间的网络。  
结论-通过避免流处理瓶颈，利用flink有状态流处理能力，可使其吞吐量达到Storm的30倍左右，还保证了exactly-once和高可用性。Flink的检查点机制，同时实现了容错、高吞吐和低延迟，一种技术实现了批流一体。

## 有限流处理对比

如果计算结果不在执行过程中连续生成，而仅在末尾处生成一次，就是批处理。  
flink DataSet API专门用于批处理：用于调度和恢复的回溯法、特殊内存数据结构，以及查询优化  
flink执行过程基于流，处理阶段有更多的重叠，混洗操作是流水线式的，  
Spark等基于批的数据通过网络传输前必须被写入磁盘，使用flink时系统空闲时间和磁盘访问操作更少

## Flink基础架构

Flink 运行时包含了两种类型的处理器：  
JobManager 处理器：也称之为Master，用于协调分布式执行，它们用来调度task，协调检查点，协调失败时恢复等。Flink 运行时至少存在一个master 处理器，如果配置高可用模式则会存在多个master 处理器，它们其中有一个是leader，而其他的都是standby。  
TaskManager 处理器：也称之为Worker，用于执行一个dataflow 的task(或者特殊的subtask)、数据缓冲和data stream 的交换，Flink 运行时至少会存在一个worker 处理器。

## Flink运行架构

Flink 程序的基础构建模块是流（Streams）和转换（Transformations），每一个数据流起始于一个或多个Source，并终止于一个或多个Sink。数据流类似于有向无环图（DAG）。

在并行环境下，Flink 将多个operator 的子任务链接在一起形成了一个task，每个task 都有一个独立的线程执  
行。

## 任务调度原理

JobManager：它扮演的是集群管理者的角色，负责调度任务、协调checkpoints、协调故障恢复、收集Job 的状态信息，并管理Flink 集群中的从节点TaskManager。  
TaskManager：实际负责执行计算的Worker，在其上执行Flink Job 的一组Task；TaskManager 还是所在节点的管理员，它负责把该节点上的服务器信息比如内存、磁盘、任务运行情况等向JobManager 汇报。  
Client：用户在提交编写好的Flink 工程时，会先创建一个客户端再进行提交，这个客户端就是Client，Client 会根据用户传入的参数选择使用yarn per job 模式、stand-alone 模式还是yarn-session 模式将Flink 程序提交到集群。

运行时架构主要包括四个组件  
 作业管理器（JobManager）  
 资源管理器（ResourceManager）  
 任务管理器（TaskManager）  
 分发器（Dispatcher）

### 作业管理器（JobManager）

控制一个应用程序执行的主进程，每个应用程序都会被一个不同的JobManager 所控制执行。JobManager 会先接收到要执行的应用程序，这个应用程序会包括：作业图（JobGraph）、逻辑数据流图（logical dataflow graph）和打包了所有的类、库和其它资源的JAR 包。JobManager 会把JobGraph 转换成一个物理层面的数据流图，这个图被叫做“执行图”（ExecutionGraph），包含了所有可以并发执行的任务。JobManager 会向资源管理器（ResourceManager）请求执行任务必要的资源，也就是任务管理器（TaskManager）上的插槽（slot）。一旦它获取到了足够的资源，就会将执行图分发到真正运行它们的TaskManager 上。而在运行过程中，JobManager 会负责所有需要中央协调的操作，比如说检查点（checkpoints）的协调。

### 资源管理器（ResourceManager）

主要负责管理任务管理器（TaskManager）的插槽（slot），TaskManger 插槽是Flink 中定义的处理资源单元。

### 任务管理器（TaskManager）

Flink 中的工作进程。通常在Flink 中会有多个TaskManager 运行，每一个TaskManager 都包含了一定数量的插槽（slots）。插槽的数量限制了TaskManager 能够执行的任务数量。启动之后，TaskManager 会向资源管理器注册它的插槽；收到资源管理器的指令后，TaskManager 就会将一个或者多个插槽提供给JobManager  
调用。JobManager 就可以向插槽分配任务（tasks）来执行了。在执行过程中，一个TaskManager 可以跟其它运行同一应用程序的TaskManager 交换数据。

### 分发器（Dispatcher）

可以跨作业运行，它为应用提交提供了REST 接口。当一个应用被提交执行时，分发器就会启动并将应用移交给一个JobManager。由于是REST 接口，所以Dispatcher 可以作为集群的一个HTTP 接入点，这样就能够不受防火墙阻挡。不是必需

![image.png](f6afdb2d-c4bf-4e24-b4a1-878cb2eecc32.avif)

每一个worker(TaskManager)是一个JVM 进程，它可能会在独立的线程上执行一个或多个subtask。为了控制一个worker 能接收多少个task，worker 通过task slot来进行控制（一个worker 至少有一个task slot）。  
每个task slot 表示TaskManager 拥有资源的一个固定大小的子集。假如一个TaskManager 有三个slot，那么它会将其管理的内存分成三份给各个slot。资源slot化意味着一个subtask 将不需要跟来自其他job 的subtask 竞争被管理的内存，取而代之的是它将拥有一定数量的内存储备。需要注意的是，这里不会涉及到CPU 的隔离，slot 目前仅仅用来隔离task 的受管理的内存。

Stream 在operator 之间传输数据的形式可以是one-to-one(forwarding)的模式也可以是redistributing 的模式，具体是哪一种形式，取决于operator 的种类。  
One-to-one：stream(比如在source 和map operator 之间)维护着分区以及元素的顺序。那意味着map operator 的subtask 看到的元素的个数以及顺序跟source operator 的subtask 生产的元素的个数、顺序相同，map、fliter、flatMap 等算子都是one-to-one 的对应关系。  
 类似于spark 中的窄依赖  
Redistributing：stream(map()跟keyBy/window 之间或者keyBy/window 跟sink之间)的分区会发生改变。每一个operator subtask 依据所选择的transformation 发送数据到不同的目标subtask。例如，keyBy() 基于hashCode 重分区、broadcast 和rebalance 会随机重新分区，这些算子都会引起redistribute 过程，而redistribute 过程就类似于Spark 中的shuffle 过程。  
 类似于spark 中的宽依赖

相同并行度的one to one 操作，Flink 这样相连的operator 链接在一起形成一个task，原来的operator 成为里面的subtask。将operators 链接成task 是非常有效的优化：它能减少线程之间的切换和基于缓存区的数据交换，在减少时延的同时提升吞吐量。链接的行为可以在编程API 中进行指定。  
![image.png](6713409e-4c60-48b6-92aa-8478095fb84b.avif)

## Spark基础及特性介绍

## Spark重要组成

### Driver（驱动器）

Spark 的驱动器是执行开发程序中的main 方法的进程。它负责开发人员编写的用来创建SparkContext、创建RDD，以及进行RDD 的转化操作和行动操作代码的执行。如果你是用spark shell，那么当你启动Spark shell 的时候，系统后台自启了一个Spark 驱动器程序，就是在Spark shell 中预加载的一个叫作sc 的SparkContext 对象。如果驱动器程序终止，那么Spark 应用也就结束了。主要负责：  
1）把用户程序转为任务  
2）跟踪Executor 的运行状况  
3）为执行器节点调度任务  
4）UI 展示应用运行状况

### Executor（执行器）

Spark Executor 是一个工作进程，负责在Spark 作业中运行任务，任务间相互独立。Spark应用启动时，Executor 节点被同时启动，并且始终伴随着整个Spark 应用的生命周期而存在。如果有Executor 节点发生了故障或崩溃，Spark 应用也可以继续执行，会将出错节点上的任务调度到其他Executor 节点上继续运行。主要负责：  
1）负责运行组成Spark 应用的任务，并将结果返回给驱动器进程；  
2）通过自身的块管理器（Block Manager）为用户程序中要求缓存的RDD 提供内存式存储。RDD 是直接缓存在Executor 进程内的，因此任务可以在运行时充分利用缓存数据加速运算。  
调度模式-Local、Standalone、Yarn、Mesos  
![image.png](179569cb-874c-4ec4-b921-48d02e37a2a4.avif)

## SparkCore

### RDD（Resilient Distributed Dataset）

叫做弹性分布式数据集，是Spark 中最基本的数据抽象。代码中是一个抽象类，它代表一个弹性的、不可变、可分区、里面的元素可并行计算的集合。  
RDD 表示只读的分区的数据集，对RDD 进行改动，只能通过RDD 的转换操作，由一个RDD 得到一个新的RDD，新的RDD 包含了从其他RDD 衍生所必需的信息。RDDs 之间存在依赖，RDD 的执行是按照血缘关系延时计算的。如果血缘关系较长，可以通过持久化RDD 来切断血缘关系。

### RDD依赖关系

RDDs 通过操作算子进行转换，转换得到的新RDD 包含了从其他RDDs 衍生所必需的信息，RDDs 之间维护着这种血缘关系，也称之为依赖。依赖包括两种，一种是窄依赖，RDDs 之间分区是一一对应的，另一种是宽依赖，下游RDD 的每个分区与上游RDD(也称之为父RDD)的每个分区都有关，是多对多的关系，会引起shuffle。对于窄依赖，partition 的转换处理在Stage 中完成计算。对于宽依赖，由于有Shuffle 的存在，只能在parentRDD 处理完成后，才能开始接下来的计算，因此宽依赖是划分Stage 的依据。 ![image.png](4223544b-1ab5-40a3-a083-58bc84451397.avif)

### RDD checkpoint

将数据保存到持久化的存储中，这样就可以切断之前的血缘关系，因为checkpoint 后的RDD 不需要知道它的父RDDs 了，它可以从checkpoint处拿到数据。检查点通过将数据写入到HDFS文件系统实现了RDD 的检查点功能。为当前RDD 设置检查点，该函数将会创建一个二进制的文件，并存储到checkpoint 目录中，该目录是用SparkContext.setCheckpointDir()设置的。在checkpoint 的过程中，该RDD的所有依赖于父RDD 中的信息将全部被移除。对RDD 进行checkpoint 操作并不会马上被执行，必须执行Action 操作才能触发。

### RDD编程模型

RDD 被表示为对象，通过对象上的方法调用来对RDD 进行转换。经过一系列的transformations 定义RDD 之后，就可以调用actions 触发RDD 的计算，action 可以是向应用程序返回结果(count, collect 等)，或者是向存储系统保存数据(saveAsTextFile 等)。在Spark 中，只有遇到action，才会执行RDD 的计算(即延迟计算)，这样在运行时可以通过管道的方式传输多个转换。使用Spark，开发者需要编写一个Driver 程序，它被提交到集群以调度运行Worker。初始化工作是在Driver 端进行的，而实际运行程序是在Executor 端进行的。

### RDD任务划分

分为Application、Job、Stage 和Task  
\- Application：初始化一个SparkContext 即生成一个Application  
\- Job：一个Action 算子就会生成一个Job  
\- Stage：根据RDD 之间的依赖关系的不同将Job 划分成不同的Stage，遇到一个宽依赖则划分一个Stage。  
\- Task：Stage 是一个TaskSet，将Stage 划分的结果发送到不同的Executor 执行即为一个Task。  
Application->Job->Stage->Task 每一层都是1 对n 的关系。

### RDD缓存

RDD 通过persist 方法或cache 方法可以将前面的计算结果缓存，默认情况下persist() 会把数据以序列化的形式缓存在JVM 的堆空间中。但是并不是这两个方法被调用时立即缓存，而是触发后面的action 时，该RDD 将会被缓存在计算节点的内存中，并供后面重用。缓存有可能丢失，或者存储存储于内存的数据由于内存不足而被删除，RDD 的缓存容错机制保证了即使缓存丢失也能保证计算的正确执行。通过基于RDD 的一系列转换，丢失的数据会被重算，由于RDD 的各个Partition 是相对独立的，因此只需要计算丢失的部分即可，并不需要重算全部Partition。

### Cache缓存和Checkpoint的区别：

1. cache 是保存在内存, Checkpoint是保存在磁盘
2. cache 不会新创建job, Checkpoint会新创建job,Checkpoint在运行的第二次之后才开始缓存. ---job 提交次数, Checkpoint提交两次
3. 源码中建议Checkpoint必须在调用任何行动算子之前运行Checkpoint,否则调用过行动算子Checkpoint  
	失效. cache 就算调用了行动算子, 照样生效. ---生效时机
4. 通过rdd.toDebugString 可以查看: cache 不会切断血缘关系, Checkpoint会切断血缘关系

## Flink与Spark的差异比较

## 架构比较

Storm 的架构是经典的主从模式，并且强依赖ZooKeeper；Spark Streaming 的架构是基于Spark 的，它的本质是微批处理，每个batch 都依赖Driver，我们可以把Spark Streaming 理解为时间维度上的Spark DAG。

Flink 也采用了经典的主从模式，DataFlow Graph 与Storm 形成的拓扑Topology 结构类似，Flink 程序启动后，会根据用户的代码处理成Stream Graph，然后优化成为JobGraph，JobManager 会根据JobGraph 生成ExecutionGraph。ExecutionGraph 才是Flink 真正能执行的数据结构，当很多个ExecutionGraph 分布在集群中，就会形成一张网状的拓扑结构。

## 架构模型比较

Spark Streaming 在运行时的主要角色包括：Master、Worker、Driver、Executor。  
Flink 在运行时主要包含：Jobmanager、Taskmanager 和Slot。

## 容错比较

Storm 在容错方面只支持了Record 级别的ACK-FAIL，发送出去的每一条消息，都可以确定是被成功处理或失败处理，因此Storm 支持至少处理一次语义。  
Spark Streaming 任务，我们可以配置对应的checkpoint，也就是保存点。当任务出现failover 的时候，会从checkpoint 重新加载，使得数据不丢失。但是这个过程会导致原来的数据重复处理，不能做到“只处理一次”语义。  
Flink 基于两阶段提交实现了精确的一次处理语义

### Flink+kafka 实现exactly-once 语义

Flink 通过checkpoint 来保存数据是否处理完成的状态由JobManager 协调各个TaskManager 进行checkpoint 存储，checkpoint保存在StateBackend 中，默认StateBackend 是内存级的，也可以改为文件级的进行持久化保存。执行过程实际上是一个两段式提交，每个算子执行完成，会进行“预提交”，直到执行完sink 操作，会发起“确认提交”，如果执行失败，预提交会放弃掉。如果宕机需要通过StateBackend 进行恢复，只能恢复所有确认提交的操作。

### Flink+Kafka 实现端到端的exactly-once 语义

 内部——利用checkpoint 机制，把状态存盘，发生故障的时候可以恢复，保证内部的状态一致性  
 source——kafka consumer 作为source，可以将偏移量保存下来，如果后续任务出现了故障，恢复的时候可以由连接器重置偏移量，重新消费数据，保证一致性  
 sink —— kafka producer 作为sink，采用两阶段提交sink，flink 由JobManager 协调各个TaskManager 进行checkpoint 存储，checkpoint 保存在StateBackend 中，默认StateBackend 是内存级的，也可以改为文件级的进行持久化保存。sink 任务首先把数据写入外部kafka，这些数据都属于预提交的事务（还不能被消费）；当遇到barrier 时，把状态保存到状态后端，并开启新的预提交事务。当所有算子任务的快照完成，也就是这次的checkpoint 完成时，JobManager 会向所有任务发通知，确认这次checkpoint 完成。当sink 任务收到确认通知，就会正式提交之前的事务，kafka 中未确认的数据就改为“已确认”，数据就真正可以被消费了。  
 第一条数据来了之后，开启一个kafka 的事务（transaction），正常写入kafka分区日志但标记为未提交，这就是“预提交”  
 jobmanager 触发checkpoint 操作，barrier 从source 开始向下传递，遇到barrier 的算子将状态存入状态后端，并通知jobmanager  
 sink 连接器收到barrier，保存当前状态，存入checkpoint，通知jobmanager，并开启下一阶段的事务，用于提交下个检查点的数据  
 jobmanager 收到所有任务的通知，发出确认信息，表示checkpoint 完成  
 sink 任务收到jobmanager 的确认信息，正式提交这段时间的数据  
 外部kafka 关闭事务，提交的数据可以正常消费了。

## 反压比较

反压是分布式处理系统中经常遇到的问题，当消费者速度低于生产者的速度时，则需要消费者将信息反馈给生产者使得生产者的速度能和消费者的速度进行匹配。  
Stom 在处理背压问题上简单粗暴，当下游消费者速度跟不上生产者的速度时会直接通知生产者，生产者停止生产数据，这种方式的缺点是不能实现逐级反压，且调优困难。设置的消费速率过小会导致集群吞吐量低下，速率过大会导致消费者OOM。  
Spark Streaming 为了实现反压这个功能，在原来的架构基础上构造了一个“速率控制器”，这个“速率控制器”会根据几个属性，如任务的结束时间、处理时长、处理消息的条数等计算一个速率。在实现控制数据的接收速率中用到了一个经典的算法，即“PID 算法”。  
Flink 没有使用任何复杂的机制来解决反压问题，Flink 在数据传输过程中使用了分布式阻塞队列。我们知道在一个阻塞队列中，当队列满了以后发送者会被天然阻塞住，这种阻塞功能相当于给这个阻塞队列提供了反压的能力。

## 任务调度比较

Spark Streaming 连续不断的生成微小的数据批次，构建有向无环图DAG，Spark Streaming 会依次创建DStreamGraph、JobGenerator、JobScheduler。  
Flink 根据用户提交的代码生成StreamGraph，经过优化生成JobGraph，然后提交给JobManager 进行处理，JobManager 会根据JobGraph 生成ExecutionGraph，ExecutionGraph 是Flink 调度最核心的数据结构，JobManager 根据ExecutionGraph 对Job 进行调度。

## 时间机制对比

Spark Streaming 支持的时间机制有限，只支持处理时间。  
Flink 支持了流处理程序在时间上的三个定义：处理时间、事件时间、注入时间。同时也支持watermark 机制来处理滞后数据。

## 维表join和异步IO比较

Structured Streaming 不直接支持与维表的join 操作，但是可以使用map、flatmap 及udf 等来实现该功能，所有的这些都是同步算子，不支持异步IO 操作。但是Structured Streaming 直接与静态数据集的join，可以也可以帮助实现维表的join 功能，当然维表要不可变。  
Flink 支持与维表进行join 操作，除了map，flatmap 这些算子之外，flink 还有异步IO 算子，可以用来实现维表，提升性能。
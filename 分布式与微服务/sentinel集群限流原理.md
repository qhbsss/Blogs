---
title: "sentinel集群限流原理"
source: "https://ata.atatech.org/articles/11000155096?spm=ata.23639746.0.0.717cf84bF5Likt"
author:
  - "[[吴坚鑫(宗寒)]]"
published:
created: 2026-10-15
description:
tags:
  - "clippings"
---
## 架构如下：

![image.png](1370bf41-ce05-49e2-af5c-274063fa4742.avif "image.png")

## 名词解释

### 1、切入点

Sentinel 将对所有切入点（埋点）资源的调用进行统计，根据统计信息进行限流降级的判断。

### 2、链路

在一次调用过程当中，可能存在多个切入点，这些切入点将以调用的先后顺序链起来，组成一条调用链路。

### 3、链路入口

在进入切入点之前，声明链路路口来区分属于哪一条特定链路，Sentinel默认支持的链路路口有 Web Filter、HSF Provider 等，只有声明了链路入口后续调用的切入点才会纳入链路管理。

### 4、树结点

链路上的切入点节点

### 5、孤儿结点(默认节点）

未纳入链路管理的切入点节点

### 6、簇结点

同一个检查点可能存在于多条不同链路，簇结点（ClusterNode）是某个埋点资源的汇总统计。

总的来说sentinel里有两个核心概念： **资源** 和 **策略**

**资源：** 一些可以作为流控对象的抽象。例如一个类的调用，一个方法的调用，db的访问等，都可以是流控的对象。

**策略：** 专门为上述 **资源** 服务的的。例如限制一个类或者方法的qps可以称之为一个策略。当接口异常频率到达某个阈值时采取的措施（例如降级）也可以称之为一个策略。

**一个** **资源被** **多个** **策略修饰着。多个策略通过责任链模式，进行链式处理。** 每个策略可以简单的理解成是继承自AbstractLinkedProcessorSlot在链式结构里的一个槽位(slot)。

已知Slot的功能职责：

- `NodeSelectorSlot` 负责收集资源的路径，并将这些资源的调用路径，以树状结构存储起来，用于根据调用路径来限流降级；
- `ClusterBuilderSlot` 则用于存储资源的统计信息以及调用者信息，例如该资源的 RT, QPS, thread count 等等，这些信息将用作为多维度限流，降级的依据；
- LogSlot 用于在发生BlockException时，打印限流日志。日志记录在：~logs/csp/sentinel-block.log
- `StatistcSlot` 则用于记录，统计不同纬度的 runtime 信息；
- `FlowSlot` 则用于根据预设的限流规则，以及前面 slot 统计的状态，来进行限流；
- `AuthorizationSlot` 则根据黑白名单，来做黑白名单控制；
- `DegradeSlot` 则通过统计信息，以及预设的规则，来做熔断降级；
- `SystemSlot` 则通过系统的状态，例如 load1 等，来控制总的入口流量；

多个Slot可灵活组合，例如默认的DefaultSlotChainBuilder组合如下：

![image.png](67e2b7fe-41d4-43c0-a2bf-c1a7f8d8155a.avif "image.png")

具体链路调用过程，限流算法原理等内网已有不少文档介绍，这里不在重复书写。可参见以下文章：

sentinel详细解析文档： [https://www.atatech.org/articles/118007?spm=ata.13261165.0.0.80ac3603P5Pa2X](https://www.atatech.org/articles/118007?spm=ata.13261165.0.0.80ac3603P5Pa2X)

\-------------------------------------分割线---------------------------------------------------

## 集群限流原理

## 前言

对于QPS较低接口，单机限流效果不佳。假设集群中有 10 台机器，我们给每台机器设置单机限流阈值为 10 QPS，理想情况下整个集群的限流阈值就为 100 QPS。不过实际情况下流量到每台机器可能会不均匀，会导致总量没有到的情况下某些机器就开始限流。因此仅靠单机维度去限制的话会无法精确地限制总体流量。而集群流控可以精确地控制整个集群的调用总量，结合单机限流兜底，可以更好地发挥流量控制的效果。

## 详细介绍

### 角色种类

集群流控中共有两种身份：

- Token Client：集群流控客户端，用于向所属 Token Server 通信请求 token。集群限流服务端会返回给客户端结果，决定是否限流。
- Token Server：即集群流控服务端，处理来自 Token Client 的请求，根据配置的集群规则判断是否应该发放 token（是否允许通过）。

### 启动方式

Sentinel 集群限流服务端有两种启动方式：

- 独立模式（Alone），即作为独立的 token server 进程启动，独立部署，隔离性好，但是需要额外的部署操作。独立模式适合作为 Global Rate Limiter 给集群提供流控服务。

![image.png](2550844f-8586-4c29-be9b-56e6ff4edc76.avif "image.png")

- 嵌入模式（Embedded），即作为内置的 token server 与服务在同一进程中启动。在此模式下，集群中各个实例都是对等的，token server 和 client 可以随时进行转变，因此无需单独部署，灵活性比较好。但是隔离性不佳，需要限制 token server 的总 QPS，防止影响应用本身。嵌入模式适合某个应用集群内部的流控。我们也是目前我们服务器采用的部署方式。

![image.png](fa0a12f3-4197-4fd2-9f5d-5c330b5e0154.avif "image.png")

### token server与token client分配过程

![image.png](ba6b87e6-c3f2-4861-8c7f-eb6fd55ddb4b.avif "image.png")

## 集群限流模式下的一次HSF的大致调用过程

sentinel关于hsf的处理通过interceptor统一拦截(其他资源如tair的处理应该都大同小异)，例如provider入口为：com.alibaba.csp.sentinel.adapter.hsf.SentinelHsfProviderInterceptor

![image.png](9696ef8e-0203-47d0-a38f-1d5fa362abc1.avif "image.png")

以QPS限流为例：

经历过一系列slot后进入QPS流控的slot：FlowSlot，核心判断方法canPassCheck

![image.png](9ddbf31f-1018-4af1-b800-ce8867011eaa.avif "image.png")

通过FlowRuleChecker，集群流控方式进入 *passClusterCheck方法*

![image.png](84b71dae-6e7c-4469-9cbc-baf7631eb50a.avif "image.png")

进入passClusterCheck方法，通过 *pickClusterService方法获取到token server的机器(每次配置变更后已记录下来)，然后通过* requestToken方法尝试获取token

![image.png](f83c5f6e-3db9-4271-9ffd-259fcedd02ea.avif "image.png")

后续进入NettyTransportClient#sendRequest方法，通过netty发送获取token的请求

![image.png](5ac80b43-b2d2-40e0-ba10-50dd2d1fff04.avif "image.png")

对于异常情况，例如请求超时(默认20ms)情况，返回特定状态。

再次进入FlowRuleChecker类passClusterCheck方法，查看 *applyTokenResult方法逻辑*

![image.png](4efadffd-b483-4653-87c0-1276d5dce46c.avif "image.png")

可以看到对于一些异常情况(如请求超时等)，是有本地限流兜底的

![image.png](61c0b311-5355-42f3-9543-93da9507fea4.avif "image.png")

进入fallbackToLocalOrPass方法，可以发现本地限流兜底逻辑是个可配置项，默认为true。如果配置为不兜底这时候直接允许请求通过。

![image.png](d47ce125-a165-4b94-8471-eebb3dd97394.avif "image.png")

到这里大概就知道了一次集群限流的流程是怎样的了。

至此，sentinel的原理大致了解了。整个sentinel设计思想还是很通俗易懂的。源码阅读起来可读性也很强。很赞！
---
title: "EagleEye鹰眼原理分析"
source: "https://ata.atatech.org/articles/11000210737?spm=ata.23639746.0.0.3d222a29mpDFWf#ZWI3ZDBh"
author:
published:
created: 2026-05-10
description:
tags:
  - "clippings"
---
ATH事业群-悟空事业部

粉丝 21影响力 1.5k

** 315

** 826

** 30

** 原创文章

发表到圈儿

[钉钉技术团队](https://ata.atatech.org/community/team/140) (首发)

收录于专题

[好文慢读-翰林院精选技术好文](https://ata.atatech.org/specials/10000000012)

**

[李深昊(青路)](https://ata.atatech.org/users/11000894103)

2021-07-27发表2023-09-04更新14k浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章20:17

**

传统的一个大型而又全面的系统，随着业务体量的增大已经很难满足市场对技术的需求，通过将整块业务系统拆分为多个互联依赖的子系统并针对子系统进行独立优化，能够有效提升整个系统的吞吐量。在进行系统拆分之后，完整的业务事务逻辑所对应的功能会部署在多个子系统上，此时用户的一次点击请求会触发若干次子系统之间的相互功能调用，如何分析一次用户请求所触发的多次跨系统的调用过程、如何定位存在响应问题的调用链路等等问题是分布式链路追踪技术所要解决的问题。

EagleEye是分布式系统跟踪技术Dapper的Java语言实现，EagleEye通过在每一次系统调用前和调用后进行埋点同时收集和分析埋点日志来梳理应用的调用和依赖关系，能够快速定位异常、分析系统调用链路和评估链路瓶颈等。在EagleEye控制台上使用一次请求的traceId能够分析出整条调用链的信息，效果图如下所示：

![[8d1e3a4f-8637-4f23-be8d-4ebe99c301ca.png]]

图 1

EagleEye很强大，底层实现的原理是什么样的呢？本文通过分析EagleEye的源码，来解释EagleEye的背后执行原理。EagleEye在应用服务器中主要做了两件事情：第一件是生成traceId和rpcId，并将这两个信息传递到调用链的下游应用中；第二件是在本地记录日志，主要是记录本次调用的相关信息。

本文目录如下：

○

1.traceId和rpcId

■

1.1. traceId

■

1.2. rpcId

■

1.3. traceId和rpcId传递原理

●

1.3.1. MetaQ的EagleEye埋点逻辑

○

1.3.1.1. MetaQ producer埋点逻辑

○

1.3.1.2. MetaQ consumer埋点逻辑

●

1.3.2. HSF的EagleEye埋点逻辑

○

1.3.2.1. HSF consumer的埋点

○

1.3.2.2 HSF provider的埋点逻辑

●

1.3.3 tair的EagleEye埋点逻辑

●

1.3.4 tddl的EagleEye埋点逻辑

○

2.EagleEye日志记录原理

■

2.1 EagleEye日志记录源码解读

●

2.1.1 日志队列中添加日志对象

●

2.1.2 从日志队列中消费日志对象

■

2.2 EagleEye控制台分析traceId的原理

○

3.自定义EagleEye接入

■

3.1 EagleEye信息塞入

●

3.1.1 客户端中塞入EagleEye信息

●

3.1.2 入口型应用塞入EagleEye信息

●

3.1.3 定时任务塞入EagleEye信息

■

3.2 EagleEye信息取出

■

3.3 EagleEye异步线程恢复

## 1.traceId和rpcId

在用户请求到达服务器时，应用容器在执行实际业务处理之前，会先执行EagleEye的埋点逻辑（基于Servlet的Filter的机制），为这个请求分配一个全局唯一的调用链ID，这个ID在EagleEye 里面被称为 traceId，traceId在整个调用过程中都不会改变，用于唯一标识这一次用户请求。EagleEye将traceId存储在ThreadLocal中的上下文信息里面，上下文信息里还有一个rpcId（等价于Dapper论文中的SpanID），rpcId用于区分同一个调用链下的多个网络调用的发生顺序和嵌套层次关系。

## 1.1. traceId

traceId的作用是唯一标识一次请求的整个调用链路，同时traceId在调用过程中会被传递到调用链下游，并且在调用全过程中保持不变。通过traceId可以把一次前端请求在不同服务器记录的调用日志关联起来，经过组合可以得出该请求的调用链信息。因此，EagleEye不仅可以分析到应用之间的直接调用关系，还可以得到他们的间接调用关系、以及上下游的业务处理信息；对于调用链的底层系统，可以追溯到它的最上层请求来源以及中间经过的所有节点。

traceId的生成原理如下所示：

![[497f733d-b955-4823-9544-0c80e6f25446.png]]

图 2

EagleEye 使用了带有业务语义的traceId方案，由五个部分组成：

第一部分是生成traceId的机器的8个字符的IP地址；

第二部分是13个字符的生成traceId的毫秒级的生成时间；

第三部分是4位（1000-9999）的自增顺序数，顺序数用于避免多线程并发时traceId碰撞；

第四部分是一个字符的标志位，用于标识生成该traceId的应用模块（例如nginx模块的标志位为e，Java应用中的标志位固定为d）；

第五部分是4个字符的进程id。

如图3所示，应用A是接受到来自用请求的一条调用链的开始端，在请求收到后它会先调用EagleEye.StartTrace生成traceId并放置在当前线程的ThreadLocal中，在应用A调用应用B、C的HSF服务，或者发送MetaQ消息时，traceId被包含在EagleEye上下文中，随网络请求到达应用B、C、F、G之中，并放置在接收端的当前线程ThreadLocal内，因此后续调用到的这些系统都会有EagleEye这次请求的上下文。这些系统再发起网络请求时，也类似的携带了上下文信息的。

![[7c9df384-1ccd-48c5-9721-f64c4e0a7502.png]]

图 3

## 1.2. rpcId

traceId能够唯一标识一条调用链，但是无法标识该调用链路的每一次调用的顺序和嵌套层次，因此EagleEye还额外使用了rpcId，rpcId的作用是标识当前调用过程在整条调用链路的位置。rpcId用0.X1.X2.X3…..Xi表示，Xi都是非负整数，根节点的rpcId固定从0开始，第一层网络调用的rpcId是0.X1，第二层的则为0.X1.X2，依次类推，通过rpcId，可以准确的还原出调用链上每次调用的层次关系和先后顺序。

通过rpcId，可以准确的还原出调用链上每次调用的层次关系和先后顺序。下面的图4与图3是同一个调用链，但是展现的是rpcId的层次关系，可以看出对 TDDL的访问0.1.1.1源于 B到 D 的调用0.1.1，对 Tair 的访问0.2.1.2源于C到E的调用0.2.1。

![[a46b521e-a89e-4426-a7a1-537a7ff623c2.png]]

图 4

## 1.3. traceId和rpcId传递原理

在分析源码之前，首先要明确一点，EagleEye中的rpc不只是后端rpc框架，而是广义的rpc概念，即泛指任何的远程调用过程。

EagleEye已经集成在HSF、Notify、MetaQ、TDDL、Tair等集团中间件产品中，这些中间件能够自动执行EagleEye的埋点逻辑，完成traceId和rpcId的上下游传递，下面将深入源码来分析这一过程。

### 1.3.1. MetaQ的EagleEye埋点逻辑

MetaQ有两个逻辑主体：消息的发送端producer和消息的消费端consumer，下面将分别MetaQ的producer和consumer的EagleEye埋点逻辑。

#### 1.3.1.1. MetaQ producer埋点逻辑

首先metaq的producer实现类MetaProducerImpl在初始化时会在registerHook()方法中注册两个和EagleEye相关的hook：MetaQSendMessageHookImpl和MetaQSendMessageTraceHookImpl。

public class MetaProducerImpl extends TransactionMQProducer {

//其余代码

private void registerHooks() {

if (!isAuthEnabled) {

//注册MetaQSendMessageHookImpl

this.getDefaultMQProducerImpl().registerSendMessageHook(new MetaQSendMessageHookImpl());

//注册MetaQSendMessageTraceHookImpl

this.getDefaultMQProducerImpl().registerSendMessageHook(new MetaQSendMessageTraceHookImpl());

//其余代码

}

//其余代码

}

其中MetaQSendMessageHookImpl负责生成rpcId和traceId，并将rpcId和traceId放入到上下文信息中的消息结构体traceBean中；MetaQSendMessageTraceHookImpl负责生产消息时的TRACE埋点，进行MetaQ的消息上下文的traceBean封装（此处会封装traceBean的所有信息，封装过程中会再次校验和封装traceId和rpcId）。

下面看着两个hook的源代码。

首先看MetaQSendMessageHookImpl：

public class MetaQSendMessageHookImpl implements SendMessageHook, MetaQTraceConstants {

@Override

public String hookName() {

return "EagleEyeSendMessageHook";

}

//发送消息前开启鹰眼rpc

@Override

public void sendMessageBefore(SendMessageContext context) {

MetaQSendMessageTraceLog.startEagleEyeRpc(context);

}

//发送消息后关闭鹰眼rpc

@Override

public void sendMessageAfter(SendMessageContext context) {

MetaQSendMessageTraceLog.endEagleEyeRpc(context);

}

}

跟进MetaQSendMessageTraceLog.startEagleEyeRpc(context)方法,该方法的主要逻辑为开启一次Rpc调用（主要任务是计算rpcId并放入到rpc上下文RpcContext\_inner中），并记录该事件同时在EagleEyeContextListener中注册事件的回调逻辑。

跟进MetaQSendMessageTraceLog.endEagleEyeRpc(context)方法，该方法主要逻辑是提交调用上下文，生成本地的EagleEye日志，并且并在异步执行的情况下重新将EagleEye信息塞入到上下文内容中。具体代码如下所示：

public class MetaQSendMessageTraceLog {

Message msg = context.getMessage();

String eagleLog = EagleEyeLogUtils.pubEagleLog(context.getMessage(), context.getProducerGroup());

//标识一次Rpc调用开始，计算rpcId并将rpcId放入RpcContext\_inner

EagleEye.startRpc(sendServiceName, eagleLog);

////记录本次RPC调用事件到日志中,并在EagleEyeContextListener中注册本次事件的回调逻辑

EagleEye.rpcClientSend();

EagleEye.requestSize(msg.getBody().length);

MetaQTraceContext mqTraceContext;

if (context.getMqTraceContext()!= null) {

mqTraceContext = (MetaQTraceContext) context.getMqTraceContext();

} else {

mqTraceContext = new MetaQTraceContext();

}

context.setMqTraceContext(mqTraceContext);

MetaQTraceBean traceBean;

if (mqTraceContext.getTraceBeans() == null || mqTraceContext.getTraceBeans().isEmpty()) {

traceBean = new MetaQTraceBean();

mqTraceContext.setTraceBeans(Arrays.asList(traceBean));

} else {

traceBean = mqTraceContext.getTraceBeans().get(0);

}

if (StringUtils.isBlank(traceBean.getTraceId())) {

traceBean.setTraceId(EagleEye.getTraceId());

// 这里是因为如果rpcId太长会导致消息发送失败，因为Message的属性(Short.MAX\_VALUE)太长

// 这里给Rpc一半的属性长度

traceBean.setRpcId(EagleEye.getRpcId() + ".1");

if (traceBean.getRpcId()!= null && traceBean.getRpcId().length() >= (Short.MAX\_VALUE / 2)) {

traceBean.setRpcId(EagleEye.MAL\_ROOT\_RPC\_ID);

}

traceBean.setEagleEyeUserData(EagleEye.exportUserData());

}

// 如果采用异步的方式提交消息，需要将EagleEye的context在不同线程中进行传递（默认EagleEye的context是存放在ThreadLocal 中）

if (CommunicationMode.ASYNC.equals(context.getCommunicationMode())) {

mqTraceContext.setRpcContextInner(EagleEye.getRpcContext());

EagleEye.popRpcContext();

}

}

public static void endEagleEyeRpc(SendMessageContext context) {

if (context == null || context.getMessage() == null

||!MetaQTraceLogUtils.isEagleEyeTraceOn(context.getProducerGroup())) {

return;

}

if (context.getMqTraceContext() == null) {

return;

}

MetaQTraceContext ctx = (MetaQTraceContext) context.getMqTraceContext();

if (ctx.getTraceBeans() == null || ctx.getTraceBeans().isEmpty()) {

return;

}

MetaQTraceBean traceBean = ctx.getTraceBeans().get(0);

// 如果采用异步的方式提交消息，需要将 EagleEye 的 context 在不同线程中进行传递

// （默认 EagleEye 的 context 是存放在 ThreadLocal 中）

if (ctx.isAsync()) {

//通过传入context，设置threadlocal变量

EagleEye.setRpcContext(ctx.getRpcContextInner());

}

//追加远程服务地址到rpc日志中

EagleEye.remoteIp(traceBean.getStoreHost());

if (CommunicationMode.ONEWAY.equals(context.getCommunicationMode())) {

接下来看MetaQSendMessageTraceHookImpl ：

public class MetaQSendMessageTraceHookImpl implements SendMessageHook, MetaQTraceConstants {

@Override

public String hookName() {

return "TraceSendMessageHook";

}

//发消息前开启TRACE记录

@Override

public void sendMessageBefore(SendMessageContext context) {

MetaQSendMessageTraceLog.startTrace(context);

MetaQSendMessageTraceLog.putEagleEyeToMsgProp(context);

}

//发消息后关闭TRACE记录

@Override

public void sendMessageAfter(SendMessageContext context) {

//关闭trace记录，清空ThreadLocal变量

MetaQSendMessageTraceLog.endTrace(context);

}

}

跟进MetaQSendMessageTraceLog.startTrace(context)方法，主要逻辑为将traceId和消息topic、tag等信息塞入到EagleEye的上下文信息中。需要注意的是，startTrace方法并不计算traceId，只会将当前已有的traceId塞入到上下文信息中，没有traceId则不塞入。在后续消费者consumer消息的时候，若是没有traceId，会重新计算一个traceId放入到上下文中，这个下一小节再讲。

跟进MetaQSendMessageTraceLog.endTrace(context)方法，该方法的主要逻辑为关闭当前traceId记录并记录trace日志。

了解了MetaQ的埋点逻辑之后，还有一个问题就是两个hook的逻辑是如何被执行的：上述的发送消息两个hook的逻辑会在发送消息前和发送消息后执行，执行逻辑如下：

public class DefaultMQProducerImpl implements MQProducerInner{

//其余代码

//执行发送消息前的hook

public void executeSendMessageHookBefore(final SendMessageContext context) {

if (!this.sendMessageHookList.isEmpty()) {

for (SendMessageHook hook: this.sendMessageHookList) {

try {

hook.sendMessageBefore(context);

} catch (Throwable e) {

log.warn("failed to executeSendMessageHookBefore", e);

}

}

}

}

//执行发送消息后的hook

public void executeSendMessageHookAfter(final SendMessageContext context) {

if (!this.sendMessageHookList.isEmpty()) {

for (SendMessageHook hook: this.sendMessageHookList) {

try {

hook.sendMessageAfter(context);

} catch (Throwable e) {

log.warn("failed to executeSendMessageHookAfter", e);

}

}

}

}

//其余代码

}

#### 1.3.1.2. MetaQ consumer埋点逻辑

同样的，metaQ的consumer在初始化时也注册了一个跟EagleEye相关的hook：MetaQConsumeMessageHookImpl。

MetaQConsumeMessageHookImpl主要有两个逻辑：一个是消息消费前将消息属性中的traid，rpcId等信息放入到消息上下文中，一个是消息消费后计算耗时，再将EagleEye相关的信息打到本地日志中。

public class MetaQConsumeMessageHookImpl implements ConsumeMessageHook, MetaQTraceConstants {

@Override

public String hookName() {

return "EagleEyeConsumeMessageHook";

}

@Override

public void consumeMessageBefore(ConsumeMessageContext context) {

//其他代码

for (MessageExt message: context.getMsgList()) {

if (message == null) {

continue;

}

MessageClientExt msg = (MessageClientExt) message;

MetaQTraceBean traceBean = new MetaQTraceBean();

//从消息属性中取出traceId和rpcId装配到traceBean中

traceBean.setTraceId(msg.getProperty(TRACE\_ID\_KEY));

traceBean.setRpcId(msg.getProperty(RPC\_ID\_KEY));

traceBean.setEagleEyeUserData(msg.getProperty(USER\_DATA\_KEY));

//其他代码

}

mqTraceContext.setTraceBeans(beans);

MetaQConsumeMessageTraceLog.consumeMessageBefore(mqTraceContext);

}

@Override

public void consumeMessageAfter(ConsumeMessageContext context) {

if (context == null || context.getMsgList() == null || context.getMsgList().isEmpty()

||!MetaQTraceLogUtils.isTraceLogOn(context.getConsumerGroup())) {

return;

}

MetaQTraceContext mqTraceContext = (MetaQTraceContext) context.getMqTraceContext();

mqTraceContext.setSuccess(context.isSuccess());

### 1.3.2. HSF的EagleEye埋点逻辑

HSF的EagleEye埋点的原理是在hsf的consumer端和provider端分别写了一个ClientFilter和ServerFilter，在消费服务和提供服务时执行响应的invoke逻辑，从而进行埋点。

#### 1.3.2.1. HSF consumer的埋点

HSF consumer作为服务的调用端，其埋点目的是将本地的rpc上下文、traceId和rpcId等信息传到调用端。HSF的consumer端使用EagleEyeClientFilter来执行响应的EagleEye埋点逻辑。具体如下所示：

public ListenableFuture<RPCResult> invoke(InvocationHandler invocationHandler, Invocation invocation)

throws Throwable {

/\*\*

\* 其余代码

\*/

String logName = methodLogNameService.convertToLogName(invocation, invocation.getMethodName(),

invocation.getMethodArgSigs(),

invocation.getMethodArgs());

// 调用EagleEye.startRpc()方法，计算rpcId并将rpcd放入到rpc上下文RpcContext\_inner中

logService.startRpc(serviceUniqueName, logName, EagleEye.TYPE\_HSF\_CLIENT, invocation.getMethodArgs());

Object rpcCtx = logService.currentRpcContext();

if (null!= rpcCtx) {

// 将rpc上下文信息塞入到调用对象invocation中，invocation最终会被传递到server端

invocation.setRequestProps(EagleEyeConstants.REQUEST\_EAGLEEYE\_CONTEXT, rpcCtx);

}

//在调用对象信息中塞入traceId和rpcId

invocation.put(EagleEyeConstants.EAGLEEYE\_TRACE\_ID\_KEY, logService.getTraceId());

invocation.put(EagleEyeConstants.EAGLEEYE\_RPC\_ID\_KEY, logService.getRpcId());

if (containerInfo.isSupportContainer()) {

invocation.setRequestProps(HSFConstants.CONTAINER\_ID, containerInfo.getContainerId());

}

/\*\*

\* 其余代码

\*/

}

#### 1.3.2.2 HSF provider的埋点逻辑

HSF provider作为服务的提供端，其埋点的目的是将调用端所传来的rpc上下文、traceId和rpcId等信息进行还原。HSF provider端通过实现EagleEyeServerFilter来进行埋点，其invoke()方法源码如下：

public ListenableFuture<RPCResult> invoke(InvocationHandler invocationHandler,

Invocation invocation) throws Throwable {

//取出rpc上下文信息

Object oldContext = EagleEye.getRpcContext();

try {

invocation.put(EAGLEEYE\_EXECUTED\_KEY, Boolean.TRUE);

//将rpc上下文信息放入到当前线程中

handleEagleEyeServerRecv(invocation);

//将rpc上下文放入到本次调用对象invocation中

invocation.put(INVOCATION\_EAGLEEYE\_CONTEXT\_KEY, logService.getRpcContext());

invocation.addContextAware(eagleEyeServerContextAware);

//把traceId,rpcId放到本次调用对象invocation中

invocation.put(EagleEyeConstants.EAGLEEYE\_TRACE\_ID\_KEY, logService.getTraceId());

invocation.put(EagleEyeConstants.EAGLEEYE\_RPC\_ID\_KEY, logService.getRpcId());

ListenableFuture<RPCResult> rpcFuture = invocationHandler.invoke(invocation);

return rpcFuture;

} finally {

EagleEye.setRpcContext(oldContext);

}

}

### 1.3.3 tair的EagleEye埋点逻辑

tair的client在执行相应数据操作时也会进行EagleEye的埋点逻辑，包括put，get，invalid，delete等数据操作。在tair的基本数据操作源码中，执行了相同的EagleEye埋点逻辑，下面以delete数据操作为例讲述tair的EagleEye埋点逻辑。

public ResultCode delete(int namespace, Serializable key) {

if (asyncMethodDependent) {

return tairAsync.delete(namespace, key).get();

}

try {

//在执行数据操作前的EagleEye埋点

eagleEyeFirstOps(namespace, TairConstant.TAIR\_REQ\_REMOVE\_PACKET);

/\*\*

\* 进行实际的delete数据操作过程

\*/

} finally {

//在执行数据操作后的EagleEye埋点

eagleEyeLastOps(namespace);

}

}

tair中的EagleEye埋点主逻辑是在执行数据操作之前，调用eagleEyeFirstOps方法进行埋点，在数据操作完成后，再执行eagleEyeLastOps方法进行埋点，以记录下完整的调用记录。在tair的EagleEye埋点逻辑中，有两个重要的状态：isStart（当前步骤环境是否为开启了一次tair操作）和isSend（当前步骤环境是否为已经发送tair数据请求），tair会在判断这两个状态后才进行相应的埋点逻辑，具体代码分析如下：

private void eagleEyeFirstOps(int namespace, int pcode) {

if (namespace!= 0) {

//判断当前步骤环境是否为开启了一次tair操作

if (!EagleEyeState.isStartCall()) {

//EagleEye开启一次rpc，计算rpcId并将rpcId放到上下文中

EagleEye.startRpc(String.valueOf(pcode), groupName);

}

//设置当前步骤环境为开启了一次tair操作

EagleEyeState.setStart(true);

//设置当前步骤环境为未发送tair请求

EagleEyeState.setSend(false);

}

}

private void eagleEyeLastOps(int namespace) {

if (namespace!= 0) {

//判断当前步骤环境是否为已发送tair请求

if (!EagleEyeState.isSendCall()) {

//记录发起本次调用的日志

EagleEye.rpcClientSend();

// 记录响应本次调用的日志

EagleEye.rpcClientRecv(String.valueOf(EagleEyeState.getResultCode().getCode()),

EagleEye.TYPE\_TAIR, String.valueOf(namespace));

EagleEyeState.setResultCode(ResultCode.ERROR\_BEFORE\_SEND);

}

//设置当前步骤环境为已发送tair请求

EagleEyeState.setSend(true);

//设置当前步骤环境为未开启一次tair操作

EagleEyeState.setStart(false);

}

}

### 1.3.4 tddl的EagleEye埋点逻辑

tddl的接口TddlEagleeye负责进行tddl的EagleEye埋点逻辑，其实现类EagleEyeTaobaoImpl核心方法源码分析如下所示：

@Activate(order = 2)

public class EagleEyeTaobaoImpl implements TddlEagleeye {

protected static Map<String, StatLogger> statLoggerMaps = new ConcurrentHashMap<String, StatLogger>();

@Override

public void startRpc(String ip, String port, String dbName, String sqlType) {

//开启一次EagleEye rpc调用，计算rpcId并将rpcId放入到上下文变量中

EagleEye.startRpc(dbName, sqlType);

//将远程服务器ip放入到上下文变量中

EagleEye.remoteIp(ip + ':' + port);

//记录本次rpc调用的发起日志

EagleEye.rpcClientSend();

}

@Override

public void endRpc(SqlMetaData sqlMetaData, Exception e) {

String index = StringUtils.isEmpty(sqlMetaData.getLogicSql())? null: index("!" + sqlMetaData.getLogicSql());

if (e == null) {

//记录本次rpc调用的响应日志，包含调用耗时等信息

EagleEye.rpcClientRecv(EagleEye.RPC\_RESULT\_SUCCESS, EagleEye.TYPE\_TDDL, index);

} else {

EagleEye.rpcClientRecv(EagleEye.RPC\_RESULT\_FAILED, EagleEye.TYPE\_TDDL, index);

}

}

/\*\*

\* 其余代码

\*/

}

## 2.EagleEye日志记录原理

## 2.1 EagleEye日志记录源码解读

EagleEye的日志记录过程是高并发的，初期采用同步写日志的方案，但是同步写日志会导致在极端情况下服务器线程池会被日志线程占满，进而影响到业务应用的主线程。EagleEye作为辅助的功能，其记录日志过程不应影响到主线程，因此EagleEye后期采用异步写日志的方式：任何线程要写日志，只需要把日志事件对象加入日志队列就行了，后台会专门起一个线程从日志队列中取出日志对象再写入到本地文件中，虽然此举会导致日志记录有些许延时，但是保证了只有一个日志记录线程，不会将服务器线程池占满。

前面小节的叙述中，大部分的情况下都是业务应用调用EagleEye.rpcClientRecv方法来进行打日志，跟进这个方法会发现底层调用了eagleeye自定义的日志appender来实现打日志的逻辑，下面将分析EagleEye自定义的appender的逻辑。

为了追求高性能，EagleEye采用异步的方式写日志，那么EagleEye就需要两个逻辑流程：一个流程是往日志队列中加入日志对象，另一个流程是从日志队列中取出日志对象，并写日志到本地文件中。EagleEye维护了一个环形队列，由 put、take 两个游标来标识当前队列的下一次调用put和take应该返回的位置，每当put一个元素则put指针往前移动一格，每当take一个元素也往前移动一格，并且通过一定的逻辑处理保证put指针一直在take指针前面（“前面”是指逆时针方向上，put指针在take指针之前）。具体的样式如图5所示。有意思的是，EagleEye是采用一个环形数组来实现这个环形队列的。

![[d2ac6f80-87fa-4e07-b64e-86002efad164.png]]

图 5

下面将从往队列中添加日志对象与从队列中取出日志对象两个角度来分析EagleEye的记录日志流程。

### 2.1.1 日志队列中添加日志对象

往日志队列中加入日志对象，是EagleEye的AsyncAppender类的append方法实现的，其原理是向一个环形队列（由环形数组实现）中放入日志对象ctx，看一下具体过程：

class AsyncAppender extends EagleEyeAppender {

private static final int DEFAULT\_NOTIFY\_THRESHOLD = 512;

//环形数组实现的环形队列

private final BaseContext\[\] entries;

private final int queueSize;

//下标掩码，其值是queueSize-1

private final int indexMask;

private final ReentrantLock lock;

private final Condition notEmpty;

//put位置的游标

private AtomicLong putIndex;

//take位置的游标

private AtomicLong takeIndex;

private EagleEyeAppender appender;

int size() {

return (int) (putIndex.get() - takeIndex.get());

}

//塞入日志对象ctx的主逻辑

boolean append(BaseContext ctx) {

final long put = putIndex.get();

final long size = put - takeIndex.get();

if (size >= qsize) {

/\*\*

\*若是日志队列已经满了，则直接丢弃日志对象

\*/

}else {

/\*\*

\* 其余代码

\*/

前面说过EagleEye是通过环形数组实现的环形队列，其中的核心代码是entries\[(int)put & indexMask\] = ctx，由于下标掩码indexMask的值是queueSize-1，而queueSize的值是4096，所以indexMask的二进制码是全为1的，因此能够保证put与indexMask相与后得到的数组下标不会超过数组长度，同时能够形成环形（当put的值开始超过数组长度时，与indexMask进行“与计算”后会重新被放入到数组的头部）。

需要注意的是，日志入队列时put的值会一直增大，由于是环形队列，如果没有线程消费日志的话，最后会导致put指针饶了一圈最终又追赶上了take指针，若是继续增大put的值，会覆盖掉第一圈所存下的日志对象，此时若再有日志请求入环形队列，该日志对象会被直接丢弃掉，以此来保证总共只有一圈。

### 2.1.2 从日志队列中消费日志对象

EagleEye的AsyncAppender类的start方法开启了EagleEye日志消费的线程，具体源码如下：

void start(EagleEyeAppender appender, BaseContextEncoder encoder, String workerName) {

/\*\*

\* 其他代码

\*/

//开启记录日志的AsyncAppender线程，并执行run方法

this.worker = new Thread(new AsyncAppender.AsyncRunnable(), "EagleEye-AsyncAppender-Thread-" + workerName);

this.worker.setDaemon(true);

this.worker.start();

}

再深入AsyncAppender的源码，查看其run()方法的逻辑：

class AsyncRunnable implements Runnable{

public void run() {

long take = takeIndex.get();

long size = putIndex.get() - take;

//只有在put大于take时才会进行日志记录

if (size > 0) {

/\*\*

\* 其余代码

\*/

//执行日志记录逻辑

processContext(ctx, parent.appender, encoder);

}

else {

/\*\*

\*阻塞直到有日志入队列，并且put大于take

\*/

}

}

private final void processContext(final BaseContext ctx,

final EagleEyeAppender appender, final BaseContextEncoder encoder) throws IOException {

if (ctx.isEvent()) {

final int logType = ctx.logType;

if (logType == LOG\_TYPE\_EVENT\_FLUSH) {

appender.flush();

} else if (logType == LOG\_TYPE\_EVENT\_ROLLOVER) {

appender.rollOver();

} else if (logType == LOG\_TYPE\_EVENT\_RELOAD) {

appender.reload();

} else if (logType == LOG\_TYPE\_EVENT\_CLOSE) {

doNotifyIfRequired(ctx);

throw closeEvent;

}

取日志对象的时候，若是take指针追上了put指针，会一直阻塞线程直到有日志对象队列并且put指针往前进时，才会继续从日志队列中取对象。

下面来看EagleEye的DefaultRpcContextEncoder类的具体打日志过程：

class DefaultRpcContextEncoder extends BaseContextEncoder {

@Override

public void encode(BaseContext base, EagleEyeAppender eea) throws IOException {

//定义日志输出的StringBuilder对象

StringBuilder buffer = getBuffer();

/\*\*

\* 组装日志StringBuilder的对象buffer，省略掉这部分略长的代码

\*/

//调用EagleEyeRollingFileAppender类的appender方法将日志流buffer输出到本地文件中

eea.append(buffer.toString());

}

}

最后来看EagleEyeRollingFileAppender类中的日志写入到文件的过程：

class EagleEyeRollingFileAppender extends EagleEyeAppender{

/\*\*

\* 其余代码

\*/

@Override

public void append(String log) {

BufferedOutputStream bos = this.bos;

if (bos!= null) {

try {

waitUntilRollFinish();

//获取到日志流的byte字节数组

byte\[\] bytes = log.getBytes(EagleEye.DEFAULT\_CHARSET);

int len = bytes.length;

if (len > DEFAULT\_BUFFER\_SIZE && this.multiProcessDetected) {

len = DEFAULT\_BUFFER\_SIZE;

bytes\[len - 1\] = '\\n';

}

//将字节数组写入到缓冲区

bos.write(bytes, 0, len);

outputByteSize += len;

//若是超出文件大小限制则切片写入到文件中，否则直接写入到文件中

if (outputByteSize >= maxFileSize) {

rollOver();

} else {

if (System.currentTimeMillis() >= nextFlushTime) {

flush();

}

}

} catch (Exception e) {

//出现写入异常则恢复现场

doSelfLog("\[ERROR\] fail to write log to file " + filePath + ", error=" + e.getMessage());

close();

## 2.2 EagleEye控制台分析traceId的原理

EagleEye控制器能够看到一次traceId全部调用过程并进行分析，如图1所示，要实现如此功能必须要在EagleEye控制台的服务器集群中存储所有应用的EagleEye日志。

站在设计者的角度去思考，要想EagleEye控制台获取到所有应用的EagleEye日志，有两种思路：第一种是所有的应用在执行EagleEye埋点逻辑时，也将本地的EagleEye日志上传到EagleEye控制台上；第二种是EagleEye控制台的服务器定时去所有应用的服务器上拉取EagleEye日志。

EagleEye选择的第二种方式，即通过starAgent定时去应用服务器上拉取指定路径的EagleEye日志（在EagleEye的控制台上可以指定应用EagleEye日志的路径），并根据traceId将日志进行重组和排列，最终得到了EagleEye控制台上展现的调用链。事后分析一下，选择第二种方式的好处是拉取日志的速率可以由EagleEye自己决定，但是也有缺点比如EagleEye日志会有一些延时；转而一想，如果选择了第一种方式，则会存在更大的问题：所有应用无时无刻不在打EagleEye日志，第一种方式中所有应用每打一次日志就上传一次，全集团的应用加在一起势必会把EagleEye服务器给打挂，最终导致服务不可用。

## 3.自定义EagleEye接入

EagleEye的埋点逻辑已经集成到了中间件中，如果应用未使用到集成了EagleEye的中间件和接入端，也可以自定义EagleEye的接入方式。

以下内容参考自EagleEye官方文档。

自定义的EagleEye接入需要在入口型应用或者客户端中塞入EagleEye的相关信息，再在后面的应用中进行信息还原即可。

## 3.1 EagleEye信息塞入

### 3.1.1 客户端中塞入EagleEye信息

EagleEye.startRpc(serviceName, methodName, 91, params); //开启一次rpc调用，计算rpcId并放入到上下文中，91是自定义客户端的EagleEye的RpcType码

EagleEye.requestSize(reqSize); //设置请求大小(可选)

EagleEye.remoteIp(serverIp); //设置服务端IP，如果是非集团的外部应用可以填10.0.0.0

EagleEye.rpcClientSend(); //标识客户端发送RPC调用请求

// 构造请求对象

RpcRequest request = new RpcRequest();

// 在请求对象中塞入eagleeye的相关信息

request.addAttachment("EagleEyeTraceId", EagleEye.getTraceId());

request.addAttachment("EagleEyeRpcId", EagleEye.getRpcId());

request.addAttachment("EagleEyeUserData", EagleEye.exportUserData());

//设置响应大小(可选)

EagleEye.responseSize(resSize);

//设置RPC类型名

EagleEye.attribute("rpcName", "RPC");

//记录本次rpc调用的响应事件日志

EagleEye.rpcClientRecv(EagleEye.RPC\_RESULT\_SUCCESS, null);

### 3.1.2 入口型应用塞入EagleEye信息

String traceId = null;

//尝试从本地上下文中获取traceId，若为空，则重新生成traceId

if (null == EagleEye.getTraceId()) {

traceId = EagleEye.generateTraceId(localIP);

}

//标识一次trace调用的开始，traceName为用户设置，90是入口型应用的rpcType

EagleEye.startTrace(traceId, traceName, 90);

try {

// 处理业务逻辑...

} finally {

EagleEye.attribute("rpcName", "HTTP"); //设置RPC类型名

//关闭trace记录，清空ThreadLocal变量

EagleEye.endTrace("00", null);

}

### 3.1.3 定时任务塞入EagleEye信息

目前集团内的定时任务一般是用Schedulerx来调用，Schedulerx在进行任务调度时不会传入traceId等信息，需要应用在自定义的任务类中手动塞入traceId并进行trace记录，示例如下：

public class MyMapJobProcessor extends MapJobProcessor {

@Override

//定时任务方法

public ProcessResult process(JobContext context) throws Exception {

String traceId = EagleEye.getTraceId();

//表示是否新建了 traceId

boolean flag = false;

//若上下文中不存在traceId，需要手动生成traceId并开启trace记录

if (StringUtils.isBlank(traceId)) {

String id = EagleEye.generateTraceId(null);

EagleEye.startTrace(id, methodName, EagleEye.TYPE\_HSF\_SERVER);

flag = true;

}

try {

/\*\*

\*执行业务逻辑

\*/

}finally {

if (flag) {

//若开启了trace记录，则必须要在线程结束时关闭trace记录，以清空ThreadLocal变量

EagleEye.endTrace(EagleEye.RPC\_RESULT\_SUCCESS);

}

}

}

}

## 3.2 EagleEye信息取出

// 收到了 RPC 请求

RpcRequest request =...

// 从请求获取traceId、rpcId、UserData，还原EagleEye调用链上下文

String traceId = request.getAttachment("EagleEyeTraceId");

String rpcId = request.getAttachment("EagleEyeRpcId");

String userData = request.getAttachment("EagleEyeUserData");

// 如果没有上下文，需要生成新的

if (traceId == null) {

traceId = EagleEye.generateTraceId(null);

}

if (rpcId == null) {

rpcId = EagleEye.MAL\_ROOT\_RPC\_ID;

}

// userData 可以为 null

// 如果是一对多场景（即类似 Notify、MetaQ 的方式，客户端发布一个消息，会对应多个服务端收到这条消息），服务端埋点需要增加下面一句：

rpcId = EagleEye.generateMulticastRpcId(rpcId, null);

// 重新构建上下文

Map<String, String> context = new HashMap<String, String>();

context.put(EagleEye.TRACE\_ID\_KEY, traceId);

context.put(EagleEye.RPC\_ID\_KEY, rpcId);

context.put(EagleEye.USER\_DATA\_KEY, userData);

EagleEye.setRpcContext(context);

EagleEye.rpcServerRecv(serviceName, methodName, 92, params); //params为参数，可以不填

EagleEye.remoteIp(clientIp); //设置远程服务器ip

// 服务端处理请求...

// 生成响应返回

EagleEye.responseSize(respSize);

EagleEye.attribute("rpcName", "RPC"); //设置RPC类型名

EagleEye.rpcServerSend(EagleEye.RPC\_RESULT\_SUCCESS, null); // 自动清理线程上的EagleEye上下文，并设置RpcType

## 3.3 EagleEye异步线程恢复

EagleEye的上下文信息是存储在ThreadLocal中的，所以在使用异步线程时需要手动传递上下文，当业务逻辑转移到异步线程时，需要先备份 EagleEye 的调用上下文到异步任务中，保证链路的正确性。下面是一个例子：

先做EagleEye上下文备份：

Object ctx = EagleEye.getRpcContext(); // 从当前 ThreadLocal 备份

MyAsyncTask task = new MyAsyncTask(); // 这里的 MyAsyncTask 是一个业务自定义的 Runnable

task.setRpcContext(ctx); // 将 ctx 保存到 task 中

Future future = bizThreadPoolExecutor.submit(task); // 提交任务

// 后面继续执行其他逻辑，或者用 future.get() 等待任务的结果，都没有问题

// 如果 submit 多个 task，每个 task 都需要保存一份 ctx

再在执行逻辑时恢复上下文：

class MyAsyncTask implements Runnable {

private Object ctx; // 用于存放之前保存的 EagleEye 上下文

public void setRpcContext(Object ctx) { this.ctx = ctx; }

public void run() {

EagleEye.setRpcContext(ctx); // 还原到 ThreadLocal

try {

// 开始做异步逻辑，如调用 HSF、Notify、Tair 之类

//...

} finally {

EagleEye.clearRpcContext(); // 务必清理 ThreadLocal 的上下文，避免异步线程复用时出现上下文互串的问题

}

}

}

END

1.traceId和rpcId

1.1. traceId

1.2. rpcId

1.3. traceId和rpcId传递原理

1.3.1. MetaQ的EagleEye埋点逻辑

1.3.1.1. MetaQ producer埋点逻辑

1.3.1.2. MetaQ consumer埋点逻辑

1.3.2. HSF的EagleEye埋点逻辑

1.3.2.1. HSF consumer的埋点

1.3.2.2 HSF provider的埋点逻辑

1.3.3 tair的EagleEye埋点逻辑

1.3.4 tddl的EagleEye埋点逻辑

2.EagleEye日志记录原理

2.1 EagleEye日志记录源码解读

2.1.1 日志队列中添加日志对象

2.1.2 从日志队列中消费日志对象

2.2 EagleEye控制台分析traceId的原理

3.自定义EagleEye接入

3.1 EagleEye信息塞入

3.1.1 客户端中塞入EagleEye信息

3.1.2 入口型应用塞入EagleEye信息

3.1.3 定时任务塞入EagleEye信息

3.2 EagleEye信息取出

3.3 EagleEye异步线程恢复

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
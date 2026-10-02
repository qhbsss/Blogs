---
title: "EagleEye最佳实践"
source: "https://ata.atatech.org/articles/11000211961?spm=ata.21736010.0.0.4c407536tpnJ4x#NzQwNmZk"
author:
published:
created: 2026-05-10
description:
tags:
  - "clippings"
---
国际数字商业集团

勋章

粉丝 58影响力 1.5k

** 106

** 195

** 3

** 原创文章

发表到圈儿

[Sunfire集团监控](https://ata.atatech.org/community/group/16)

[中间件](https://ata.atatech.org/community/group/35)

[ATA之家](https://ata.atatech.org/community/group/45)

[技术味儿](https://ata.atatech.org/community/group/386)

[阿里云开发者生态圈](https://ata.atatech.org/community/group/1627)

[B2B技术部葵花宝典](https://ata.atatech.org/community/group/2006)

[ICBU交易技术](https://ata.atatech.org/community/group/3277)

[翰林院](https://ata.atatech.org/community/group/3390)

[阿里国际技术](https://ata.atatech.org/community/team/100042)

收录于专题

[基础设施与稳定性工程](https://ata.atatech.org/specials/10000003434)

开放访问

**

复制专用链接

**

[王峰(楚枭)](https://ata.atatech.org/users/11001176053)

2021-08-14发表2025-10-10更新9.2k浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章14:59

**

1.

## 关于链路追踪

### 1.1 行业背景

分布式系统出现的时间其实非常早，可以追溯到上世纪 70 年代，但真正开始流行要到 2000 年互联网大爆发，这时候用户量开始激增，单体系统面临比较严重的单点性能问题，而且无法做到高可用。等到再过几年进入 Web2.0 时代，头部 C 类系统的用户量已经从千级飙升到亿级，分布式系统毫无疑问已经是绝对主流。

但分布式系统其实也带来了很多问题：系统间的网络通信问题、服务发现、数据一致性问题、CAP 问题、负载均衡、熔断降级、服务雪崩、统一认证，以及本文的重点链路追踪（Distributed Tracing）。

单体时代不需要链路追踪，因为所有逻辑在一个进程中执行，日志集中输出，堆栈完整，出问题时通过日志 + 堆栈就能定位。而分布式系统的普及，导致调用链路断裂，错误溯源困难，缺乏全局视角。

最早在 2010 年，Google 发布论文《Dapper: A Large-Scale Distributed Systems Tracing Infrastructure》（中文版见： [https://bigbully.github.io/Dapper-translation/](https://bigbully.github.io/Dapper-translation/) ），首次系统性提出分布式追踪架构，介绍 Span、Trace、采样等概念，成为行业标准，后来 2012 年，Twitter 开源 Zipkin，相信以前用过 Spring Cloud 的同学都知道这个。

简单看看 Dapper 提出的概念：

<table><colgroup><col width="291"> <col width="508"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>Trace（轨迹）</p></td><td rowspan="1" colspan="1"><p>表示一次完整的用户请求生命周期，比如“用户下单”</p></td></tr><tr><td rowspan="1" colspan="1"><p>Span（跨度）</p></td><td rowspan="1" colspan="1"><p>表示一个工作单元，如“调用库存服务”就是一个 Span</p></td></tr><tr><td rowspan="1" colspan="1"><p>Span ID / Parent Span ID</p></td><td rowspan="1" colspan="1"><p>构成调用树结构，表示父子调用关系</p></td></tr><tr><td rowspan="1" colspan="1"><p>Trace ID</p></td><td rowspan="1" colspan="1"><p>全局唯一 ID，贯穿整个调用链</p></td></tr><tr><td rowspan="1" colspan="1"><p>Annotation / Event</p></td><td rowspan="1" colspan="1"><div>记录关键时间点，如 <code>sr</code> （Server Receive）、 <code>ss</code> （Server Send）</div></td></tr></tbody></table>

有了这几个模型的支撑，下面几个核心问题看起来都有办法解决了：

●

请求经过哪些服务：能通过 Trace ID 关联所有服务的日志

●

哪个环节最耗时：记录每个服务的 Span（时间段），可视化展示调用耗时

●

哪里发生了错误：标记异常 Span，快速定位失败节点

●

服务间依赖关系是什么：自动生成服务拓扑图

### 1.2 阿里的链路追踪

阿里的链路追踪，是随着淘宝的微服务架构演化进程自然而然出现的，和 Dapper 规范非常接近，但也有差异，比如没有使用 Span 和 Parent，而是引入了 rpcId，通过一个字段同时表达了当前线程和 parent，每次新开一个线程，rpcId 都会新加一位数字，这样子通过格式也能区分父子线程之间的关联。

![[04afac25-cd76-4fb2-a194-e96448a8f36b.png]]

对于链路追踪框架，客户端负责埋点，服务端负责收集和展示，具体技术栈的选择：

<table><colgroup><col width="266"> <col width="266"> <col width="267"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>场景</p></td><td rowspan="1" colspan="1"><p>埋点记录（业务侧服务）</p></td><td rowspan="1" colspan="1"><p>埋点收集和展示（链路追踪中心服务）</p></td></tr><tr><td rowspan="1" colspan="1"><p>Spring Boot 2.x + Spring Cloud</p></td><td rowspan="1" colspan="1"><p>Spring Cloud Sleuth</p></td><td rowspan="1" colspan="1"><p>Zipkin</p></td></tr><tr><td rowspan="1" colspan="1"><p>Spring Boot 3.x + Spring Cloud 2022+</p></td><td rowspan="1" colspan="1"><p>Micrometer Tracing</p></td><td rowspan="1" colspan="1"><p>Zipkin/Jaeger</p></td></tr><tr><td rowspan="1" colspan="1"><p>阿里技术栈</p></td><td rowspan="1" colspan="1"><p>EagleEye 客户端</p></td><td rowspan="1" colspan="1"><p>EagleEye 服务端</p></td></tr></tbody></table>

### 1.3 为什么在阿里一定要用 EagleEye

链路追踪在跨服务的时候，是这么处理的：

所以，在阿里的使用 EagleEye 的好处是，与 HSF、TDDL、MetaQ、Diamond、ConfigServer 等中间件无缝衔接，在每个“出口”自动注入标准追踪头，在每个“入口”统一解析并恢复上下文，从而实现跨服务的链路贯通。

类似的道理，如果使用 Spring Cloud Sleuth，则支持与 SpringMVC、RestTemplate、Feign、RabbitMQ 等技术的无缝衔接。

但现实远没有想象的美好，就比如刚刚说的对中间件的支持，也不是所有中间件都支持，比如 SchedulerX 就不支持，原因不详，对于这种情况那就得特殊处理，诸如此类的问题倒也不麻烦，但是总结分享一下，大家也能少走点弯路节省点宝贵的时间，下面分享一下我个人的实践经验。

2.

## 如何将 traceId 打印到日志文件

### 2.1 问题

分布式系统的诸多微服务，EagleEye 能把他们的 trace 都串起来。而聚焦到某个服务的时候，也需要一口气知道一个请求的所有路径，需要将日志串起来，尤其是线程池、多线程的广泛使用，用线程 id 关联明显力不从心。

### 2.2 方案

日志系统以 slf4j + logback 为例。

●

EagleEye 依赖：

<dependency>

<groupId>com.alibaba.boot</groupId>

<artifactId>pandora-eagleeye-spring-boot-starter</artifactId>

</dependency>

●

EagleEye 配置：

\# 决定是否自动装配 EagleEye filter

spring.eagleeye.enabled=true

\# 决定 EagleEye 是否使用本地 IP 作为埋点信息

spring.eagleeye.use-local-ip=true

\# 鹰眼traceId打印到日志文件

spring.eagleeye.mdc-updater=slf4j

添加完成后，EagleEye 的 servlet filter 会被 EagleEyeWebAutoConfiguration 自动装配，所以无需重复注册该 filter。

●

日志配置 EagleEye Trace：

logback.xml pattern 节点添加 traceId 后，就可以在日志中打印出来了。由于基于 slf4j 的 MDC，所以使用 MDC 表达式： `%X{EAGLEEYE_TRACE_ID}` 代表traceId， `%X{EAGLEEYE_RPC_ID}` 代表rpcId。pattern示例：

%d{HH:mm:ss.SSS} \[traceId: %X{EAGLEEYE\_TRACE\_ID} /rpcId: %X{EAGLEEYE\_RPC\_ID}\] \[%thread\] ${PID:- } %logger{36} %-5level - %msg%n"

3.

## 某些中间件不支持 EagleEye

### 3.1 问题说明

但有的中间件比如 SchedulerX 就和 EagleEye 之间没有很好的支持，需要手动设置上下文。

### 3.2 方案1：手动设置上下文

@Component

public class demoJob extends JavaProcessor {

@Override

public ProcessResult process(JobContext jobContext) {

// 开启trace（traceId和rpcId可以传null，EagleEye会自动为其生成）

EagleEye.startTrace(traceId, rpcId, traceName, EagleEye.TYPE\_NOTIFY);

try {

//...

} finally {

// 结束trace（resultCode可以根据成功失败模仿httpCode的规则）

EagleEye.endTrace(resultCode);

}

}

}

### 3.3 方案2：通用注解，代理设置上下文

●

定义注解：

@Documented

@Target({ElementType.METHOD})

@Retention(RetentionPolicy.RUNTIME)

public @interface OpenTrace {

/\*\*

\* trace 名

\* 建议传入能够唯一标识入口的数据，例如用户访问网络的 http url

\*/

String traceName();

/\*\*

\* trace 类型

\*/

TraceTypeEnum traceType();

}

@Slf4j

@Aspect

@Component

public class OpenTraceProcessor {

@Pointcut(value = "@annotation(com.alibaba.xxxx.OpenTrace)")

public void pointCut() {

}

@Around("pointCut() && @annotation(openTrace)")

public Object around(ProceedingJoinPoint joinPoint, OpenTrace openTrace) throws Throwable {

log.debug("Enter OpenTrace, openTrace: {}", openTrace);

RpcContext\_inner rpcContext = EagleEye.getRpcContext();

if (rpcContext == null) {

log.debug("without rpcContext, try to open trace");

String traceName = openTrace.traceName();

TraceTypeEnum traceType = openTrace.traceType();

EagleEye.startTrace(null, null, traceName, traceType.getCode());

}

●

使用注解：

@Component

public class demoJob extends JavaProcessor {

@Override

@OpenTrace(traceName = "DemoJob", traceType = TraceTypeEnum.JOB)

public ProcessResult process(JobContext jobContext) {

//...

}

}

4.

## 多线程的EagleEye上下文传递

### 4.1 问题说明

EagleEye 基于 ThreadLocal 实现 trace 上下文的存储和传递，意味着 trace 不能在多线程中进行传递和延续。

有人会有疑问，使用 InheritableThreadLocal 或者 [TransmittableThreadLocal](https://github.com/alibaba/transmittable-thread-local?spm=ata.21736010.0.0.6fca287eJlM4Y4) 之类的可继承的 ThreadLocal 就能很简单的解决问题了啊，要是可以的话 EagleEye 官方早就做了，因为当下的系统几乎都使用的线程池，线程早就一口气初始化好了，这些线程根本就没有继承关系，InheritableThreadLocal 肯定无法起作用。

### 4.2 方案1：手动设置上下文

以 parallelStream 操作为例（本质是 ForkJoin 线程池）：

RpcContext\_inner rpcContext = EagleEye.getRpcContext();

ctx.setAsyncMode(true); // 主动开启异步模式，所有线程非安全的操作都改为线程安全的操作

list.parallelStream().forEach(item -> {

try {

// 恢复上下文

EagleEye.setRpcContext(rpcContext);

// rpcId 增加一个层级

EagleEye.startRpc();

// do sth else

} finally {

EagleEye.clearRpcContext();

}

});

// forkjoin线程池可能复用主线程，在主线程中执行EagleEye.clearRpcContext()，所以这里需要恢复

EagleEye.setRpcContext(rpcContext);

> 参考官方： [http://gitlab.alibaba-inc.com/middleware/eagleeye-docs/wikis/eagleeye-async-rpc](http://gitlab.alibaba-inc.com/middleware/eagleeye-docs/wikis/eagleeye-async-rpc)

### 4.3 方案2：重写 ThreadPoolExecutor

●

重写 ThreadPoolExecutor：

public class TraceThreadPoolExecutor extends ThreadPoolExecutor {

public TraceThreadPoolExecutor(int corePoolSize, int maximumPoolSize, long keepAliveTime, TimeUnit milliseconds, BlockingQueue<Runnable> workQueue) {

super(corePoolSize, maximumPoolSize, keepAliveTime, milliseconds, workQueue);

}

public TraceThreadPoolExecutor(int corePoolSize, int maximumPoolSize, long keepAliveTime, TimeUnit milliseconds, LinkedBlockingQueue<Runnable> workQueue, ThreadFactory factory) {

super(corePoolSize, maximumPoolSize, keepAliveTime, milliseconds, workQueue, factory);

}

@Override

public void execute(Runnable runnable) {

RpcContext\_inner rpcContext = EagleEye.getRpcContext();

super.execute(() -> {

// 恢复上下文

EagleEye.setRpcContext(rpcContext);

// rpcId 增加一个层级

EagleEye.startRpc();

try {

runnable.run();

} finally {

EagleEye.clearRpcContext();

}

});

}

}

●

使用时就不用关心了：

private static final ExecutorService TRACE\_POOL\_EXECUTOR = new TraceThreadPoolExecutor(4, 6, 0L, TimeUnit.MILLISECONDS,

new LinkedBlockingQueue<>(20), new ThreadFactoryBuilder().setNameFormat("trace-executor-%d").build());

public void testTrace() {

log.info("Enter main");

TRACE\_POOL\_EXECUTOR.execute(() -> {

log.info("Enter executor");

log.info("Exit executor");

});

log.info("Exit main");

}

5.

## 声明式多线程的上下文传递：@Async

### 5.1 问题说明

上述的多线程案例都是编程式的，很容易就手动写入上下文，声明式的多线程稍微麻烦点，比如 Spring 的 @Async 注解，通过代理方法的形式创建线程。

### 5.2 方案：重写指定线程池

其实和 4.3 没啥区别，只不过这里就得知道每个注解背后的线程池，@Async 默认使用的线程池是 ThreadPoolTaskExecutor。

●

重写线程池 execute 和 submit 方法：

public class AysncThreadPoolExecutor extends ThreadPoolTaskExecutor {

public AysncThreadPoolExecutor(int corePoolSize, int maxPoolSize, int queueCapacity, int keepAliveSeconds, String threadNamePrefix, RejectedExecutionHandler rejectedExecutionHandler) {

super();

setCorePoolSize(corePoolSize);

setMaxPoolSize(maxPoolSize);

setQueueCapacity(queueCapacity);

setKeepAliveSeconds(keepAliveSeconds);

setThreadNamePrefix(threadNamePrefix);

setRejectedExecutionHandler(rejectedExecutionHandler);

}

@Override

public void execute(Runnable runnable) {

RpcContext\_inner rpcContext = EagleEye.getRpcContext();

super.execute(() -> {

// 恢复上下文

EagleEye.setRpcContext(rpcContext);

// rpcId 增加一个层级

EagleEye.startRpc();

try {

runnable.run();

} finally {

EagleEye.clearRpcContext();

}

});

}

@Override

public <T> Future<T> submit(Callable<T> task) {

RpcContext\_inner rpcContext = EagleEye.getRpcContext();

ThreadPoolExecutor executor = super.getThreadPoolExecutor();

return executor.submit(() -> {

// 略，同上

});

}

●

指定 @Async 所用线程池：

@Async 会去容器里找 type 为 `TaskExecutor` 的 Bean，若有多个，会再去找 name 为 `taskExecutor` 、type 为 `Executor` 的Bean，所以如下声明 `@Bean("taskExecutor")` ：

@Configuration

public class AsyncThreadPoolConfig {

@Bean("taskExecutor")

public Executor taskExecutor() {

return new AysncThreadPoolExecutor(8, 16,

1024, 60, "AsyncTaskExecutor-",

new ThreadPoolExecutor.CallerRunsPolicy());

}

}

●

使用时就不用关心了：

@Autowired

private TestAysncService testAysnc;

@PostMapping(path = "/testAysnc", produces = "application/json")

public void testAysnc(HttpServletRequest request) {

log.info("Enter main");

testAysnc.doAysnc();

log.info("Exit main");

}

@Slf4j

@Service

public class TestAysncService {

@Async

public void doAysnc() {

log.info("Enter executor");

log.info("Exit executor");

}

}

END

1.关于链路追踪

1.1 行业背景

1.2 阿里的链路追踪

1.3 为什么在阿里一定要用 EagleEye

2.如何将 traceId 打印到日志文件

2.1 问题

2.2 方案

3.某些中间件不支持 EagleEye

3.1 问题说明

3.2 方案1：手动设置上下文

3.3 方案2：通用注解，代理设置上下文

4.多线程的EagleEye上下文传递

4.1 问题说明

4.2 方案1：手动设置上下文

4.3 方案2：重写 ThreadPoolExecutor

5.声明式多线程的上下文传递：@Async

5.1 问题说明

5.2 方案：重写指定线程池

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
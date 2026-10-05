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
收录于专题



2021-08-14发表2025-10-10更新9.2k浏览






## 关于链路追踪

### 1.1 行业背景

分布式系统出现的时间其实非常早，可以追溯到上世纪 70 年代，但真正开始流行要到 2000 年互联网大爆发，这时候用户量开始激增，单体系统面临比较严重的单点性能问题，而且无法做到高可用。等到再过几年进入 Web2.0 时代，头部 C 类系统的用户量已经从千级飙升到亿级，分布式系统毫无疑问已经是绝对主流。

但分布式系统其实也带来了很多问题：系统间的网络通信问题、服务发现、数据一致性问题、CAP 问题、负载均衡、熔断降级、服务雪崩、统一认证，以及本文的重点链路追踪（Distributed Tracing）。

单体时代不需要链路追踪，因为所有逻辑在一个进程中执行，日志集中输出，堆栈完整，出问题时通过日志 + 堆栈就能定位。而分布式系统的普及，导致调用链路断裂，错误溯源困难，缺乏全局视角。

最早在 2010 年，Google 发布论文《Dapper: A Large-Scale Distributed Systems Tracing Infrastructure》（中文版见： [https://bigbully.github.io/Dapper-translation/](https://bigbully.github.io/Dapper-translation/) ），首次系统性提出分布式追踪架构，介绍 Span、Trace、采样等概念，成为行业标准，后来 2012 年，Twitter 开源 Zipkin，相信以前用过 Spring Cloud 的同学都知道这个。

简单看看 Dapper 提出的概念：


| Trace（轨迹）                | 表示一次完整的用户请求生命周期，比如“用户下单”                            |
| ------------------------ | --------------------------------------------------- |
| Span（跨度）                 | 表示一个工作单元，如“调用库存服务”就是一个 Span                         |
| Span ID / Parent Span ID | 构成调用树结构，表示父子调用关系                                    |
| Trace ID                 | 全局唯一 ID，贯穿整个调用链                                     |
| Annotation / Event       | 记录关键时间点，如 `sr` （Server Receive）、 `ss` （Server Send） |


有了这几个模型的支撑，下面几个核心问题看起来都有办法解决了：

- 请求经过哪些服务：能通过 Trace ID 关联所有服务的日志

- 哪个环节最耗时：记录每个服务的 Span（时间段），可视化展示调用耗时

- 哪里发生了错误：标记异常 Span，快速定位失败节点

- 服务间依赖关系是什么：自动生成服务拓扑图

### 1.2 阿里的链路追踪

阿里的链路追踪，是随着淘宝的微服务架构演化进程自然而然出现的，和 Dapper 规范非常接近，但也有差异，比如没有使用 Span 和 Parent，而是引入了 rpcId，通过一个字段同时表达了当前线程和 parent，每次新开一个线程，rpcId 都会新加一位数字，这样子通过格式也能区分父子线程之间的关联。

![[04afac25-cd76-4fb2-a194-e96448a8f36b.png]]

对于链路追踪框架，客户端负责埋点，服务端负责收集和展示，具体技术栈的选择：


| 场景                                   | 埋点记录（业务侧服务）         | 埋点收集和展示（链路追踪中心服务） |
| ------------------------------------ | ------------------- | ----------------- |
| Spring Boot 2.x + Spring Cloud       | Spring Cloud Sleuth | Zipkin            |
| Spring Boot 3.x + Spring Cloud 2022+ | Micrometer Tracing  | Zipkin/Jaeger     |
| 阿里技术栈                                | EagleEye 客户端        | EagleEye 服务端      |


### 1.3 为什么在阿里一定要用 EagleEye

链路追踪在跨服务的时候，是这么处理的：

所以，在阿里的使用 EagleEye 的好处是，与 HSF、TDDL、MetaQ、Diamond、ConfigServer 等中间件无缝衔接，在每个“出口”自动注入标准追踪头，在每个“入口”统一解析并恢复上下文，从而实现跨服务的链路贯通。

类似的道理，如果使用 Spring Cloud Sleuth，则支持与 SpringMVC、RestTemplate、Feign、RabbitMQ 等技术的无缝衔接。

但现实远没有想象的美好，就比如刚刚说的对中间件的支持，也不是所有中间件都支持，比如 SchedulerX 就不支持，原因不详，对于这种情况那就得特殊处理，诸如此类的问题倒也不麻烦，但是总结分享一下，大家也能少走点弯路节省点宝贵的时间，下面分享一下我个人的实践经验。

## 如何将 traceId 打印到日志文件

### 2.1 问题

分布式系统的诸多微服务，EagleEye 能把他们的 trace 都串起来。而聚焦到某个服务的时候，也需要一口气知道一个请求的所有路径，需要将日志串起来，尤其是线程池、多线程的广泛使用，用线程 id 关联明显力不从心。

### 2.2 方案

日志系统以 slf4j + logback 为例。

- EagleEye 依赖：

```xml
<dependency>
<groupId>com.alibaba.boot</groupId>
<artifactId>pandora-eagleeye-spring-boot-starter</artifactId>
</dependency>
```

- EagleEye 配置：

\# 决定是否自动装配 EagleEye filter

spring.eagleeye.enabled=true

\# 决定 EagleEye 是否使用本地 IP 作为埋点信息

spring.eagleeye.use-local-ip=true

\# 鹰眼traceId打印到日志文件

spring.eagleeye.mdc-updater=slf4j

添加完成后，EagleEye 的 servlet filter 会被 EagleEyeWebAutoConfiguration 自动装配，所以无需重复注册该 filter。

- 日志配置 EagleEye Trace：

logback.xml pattern 节点添加 traceId 后，就可以在日志中打印出来了。由于基于 slf4j 的 MDC，所以使用 MDC 表达式： `%X{EAGLEEYE_TRACE_ID}` 代表traceId， `%X{EAGLEEYE_RPC_ID}` 代表rpcId。pattern示例：

%d{HH:mm:ss.SSS} [traceId: %X{EAGLEEYE_TRACE_ID} /rpcId: %X{EAGLEEYE_RPC_ID}] [%thread] ${PID:- } %logger{36} %-5level - %msg%n"

## 某些中间件不支持 EagleEye

### 3.1 问题说明

但有的中间件比如 SchedulerX 就和 EagleEye 之间没有很好的支持，需要手动设置上下文。

### 3.2 方案1：手动设置上下文

```java
@Component
public class demoJob extends JavaProcessor {
    @Override
    public ProcessResult process(JobContext jobContext) {
        // 开启trace（traceId和rpcId可以传null，EagleEye会自动为其生成）
        EagleEye.startTrace(traceId, rpcId, traceName, EagleEye.TYPE_NOTIFY);
        try {
            //...
        } finally {
            // 结束trace（resultCode可以根据成功失败模仿httpCode的规则）
            EagleEye.endTrace(resultCode);
        }
    }
}
```

### 3.3 方案2：通用注解，代理设置上下文

- 定义注解：

@Documented

```java
@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface OpenTrace {
    /**
* 建议传入能够唯一标识入口的数据，例如用户访问网络的 http url
*/
String traceName();
/**
*/
TraceTypeEnum traceType();
}
```

@Slf4j

@Aspect

```java
@Aspect
@Component
public class OpenTraceProcessor {
    @Around("@annotation(openTrace)")
    public Object around(ProceedingJoinPoint joinPoint,
                         OpenTrace openTrace) throws Throwable {
        log.debug("Enter OpenTrace, openTrace: {}", openTrace);
        boolean createdHere = false;
        String resultCode = "200";

        if (EagleEye.getRpcContext() == null) {
            EagleEye.startTrace(null, null, openTrace.traceName(),
                    openTrace.traceType().getCode());
            createdHere = true;
        }

        try {
            return joinPoint.proceed();
        } catch (Throwable throwable) {
            resultCode = "500";
            throw throwable;
        } finally {
            if (createdHere) {
                EagleEye.endTrace(resultCode);
            }
        }
    }
```

这里最容易忽略的是 Trace 的归属。如果进入切面时已有上下文，说明 Trace 由上游创建，当前切面就不应该调用 endTrace()。嵌套使用注解时也遵循这个规则：谁创建，谁结束。 使用注解： @Component

```java
public class DemoJob extends JavaProcessor {
    @Override
    @OpenTrace(traceName = "DemoJob", traceType = TraceTypeEnum.JOB)
    public ProcessResult process(JobContext jobContext) {
        // 执行业务逻辑
        return new ProcessResult(true);
    }
} 注解方式要求调用经过 Spring AOP 代理。如果任务框架绕过代理直接调用对象，或者发生同类内部自调用，切面可能不生效，需要在实际任务执行路径中验证。手动方式与注解方式任选一种即可。 多线程的EagleEye上下文传递 4.1 问题说明 EagleEye 使用线程上下文保存当前链路信息。仅靠普通 ThreadLocal，这些信息不会随任务自动传递到另一个线程，因此异步执行时可能丢失 traceId，需要额外的传播机制。 这里需要区分 InheritableThreadLocal 和 TransmittableThreadLocal（TTL）：前者在线程创建时继承数据，无法准确表达线程池中每次任务提交时的上下文；后者正是为线程池等场景提供传播能力，通过任务包装、执行器包装或 Agent 等方式，在提交时捕获、执行时回放、结束后恢复上下文。 不过，引入 TTL 不代表 EagleEye 上下文就会自动传播，还需要上下文载体或适配器与之集成。平台已有适配能力时优先复用；需要自行处理时，关键是明确“提交线程的上下文”和“执行线程原有的上下文”分别是什么。 4.2 方案1：手动设置上下文 以 parallelStream 为例。常见 JDK 实现使用 ForkJoin 执行并行任务，调用线程也可能参与执行，所以不能假设回调一定运行在另外一个线程中。 下面沿用原文的 RpcContext_inner、setAsyncMode(true) 和 startRpc() 接口，展示保存、设置、恢复上下文的位置。这些接口与 SDK 版本有关，使用前需确认当前版本支持这种异步传递方式，不能把示例当作所有版本通用的实现。 RpcContext_inner rpcContext = EagleEye.getRpcContext();
if (rpcContext != null) {
    // 沿用原 SDK 的异步模式；并发语义需与实际版本核对
    rpcContext.setAsyncMode(true);
}

try {
    list.parallelStream().forEach(item -> {
        // 在实际执行线程中保存原上下文
        RpcContext_inner previous = EagleEye.getRpcContext();
        try {
            if (rpcContext == null) {
                // 没有父上下文时，避免误用执行线程上的旧上下文
                EagleEye.clearRpcContext();
            } else {
                EagleEye.setRpcContext(rpcContext);
                EagleEye.startRpc();
            }
            // 处理 item
        } finally {
            if (previous == null) {
                EagleEye.clearRpcContext();
            } else {
                EagleEye.setRpcContext(previous);
            }
        }
    });
} finally {
    // 并行流异常退出时，也恢复调用线程进入前的上下文
    if (rpcContext == null) {
        EagleEye.clearRpcContext();
    } else {
        EagleEye.setRpcContext(rpcContext);
    }
} 这里有三个容易踩坑的地方： 回调结束时要恢复执行线程原上下文。无条件 clearRpcContext() 可能把参与计算的调用线程上下文一起清掉。 外层恢复必须放在 finally 中。只写在 forEach 后面，一旦抛异常就不会执行；它也不能代替每个回调自身的恢复。 保存的是上下文对象引用，不能直接视为不可变快照。setAsyncMode(true) 的作用范围应以 SDK 为准，恢复引用也不会撤销对象内部的修改；不要据此推断业务对象或上下文所有字段都变成线程安全。 这里保留了原 SDK 的 startRpc() 调用，但它是否同时开启需要配对结束的 RPC 埋点，需按实际版本确认并补齐；恢复线程上下文不等于结束 RPC 埋点。如果平台提供了封装好的任务包装器，可以直接用它替代这段底层操作。 参考原文官方资料：EagleEye 异步 RPC。 4.3 方案2：重写 ThreadPoolExecutor 如果每次提交任务都手动设置上下文，容易漏写。可以保留自定义 ThreadPoolExecutor 的方式，把同样的逻辑统一放到任务提交入口。 重写 ThreadPoolExecutor： public class TraceThreadPoolExecutor extends ThreadPoolExecutor {
    public TraceThreadPoolExecutor(int corePoolSize, int maximumPoolSize,
            long keepAliveTime, TimeUnit unit,
            BlockingQueue<Runnable> workQueue) {
        super(corePoolSize, maximumPoolSize, keepAliveTime, unit, workQueue);
    }

    public TraceThreadPoolExecutor(int corePoolSize, int maximumPoolSize,
            long keepAliveTime, TimeUnit unit,
            BlockingQueue<Runnable> workQueue, ThreadFactory factory) {
        super(corePoolSize, maximumPoolSize, keepAliveTime, unit,
                workQueue, factory);
    }

    @Override
    public void execute(Runnable runnable) {
        Objects.requireNonNull(runnable, "runnable");
        // 每次提交时，在提交线程捕获上下文
        RpcContext_inner rpcContext = EagleEye.getRpcContext();
        if (rpcContext != null) {
            rpcContext.setAsyncMode(true);
        }

        super.execute(() -> {
            RpcContext_inner previous = EagleEye.getRpcContext();
            try {
                if (rpcContext == null) {
                    EagleEye.clearRpcContext();
                } else {
                    EagleEye.setRpcContext(rpcContext);
                    EagleEye.startRpc();
                }
                runnable.run();
            } finally {
                if (previous == null) {
                    EagleEye.clearRpcContext();
                } else {
                    EagleEye.setRpcContext(previous);
                }
            }
        });
    }
} 这里与 4.2 使用相同的 SDK 适用前提和 RPC 生命周期约定。上下文在每次 execute() 调用时捕获，而不是在线程池创建时保存一次。 使用时，业务代码只负责提交任务： private static final ExecutorService TRACE_POOL_EXECUTOR =
        new TraceThreadPoolExecutor(4, 6, 0L, TimeUnit.MILLISECONDS,
                new LinkedBlockingQueue<>(20),
                new ThreadFactoryBuilder()
                        .setNameFormat("trace-executor-%d").build());

public void testTrace() {
    log.info("Enter main");
    TRACE_POOL_EXECUTOR.execute(() -> {
        log.info("Enter executor");
        log.info("Exit executor");
    });
    log.info("Exit main");
} ThreadFactoryBuilder 沿用 Guava 的工具类；项目也可以替换为已有的线程工厂。示例展示提交方式，实际线程池应由应用统一管理，并在应用停止时关闭。 对于这里直接继承的 JDK ThreadPoolExecutor，继承的 submit 会通过 execute 提交任务，因此能进入上述包装逻辑；不能由此推断所有框架执行器都如此，Spring 的情况见下一节。参见 JDK AbstractExecutorService。 另外，线程池使用 CallerRunsPolicy 时，队列满等拒绝场景下可能直接由提交线程执行任务，因此“恢复原上下文”同样不可省略。接入后至少验证正常执行、任务抛异常、线程复用和调用线程执行四种情况，同时检查任务内与任务结束后的 traceId、rpcId 和 MDC。参见 CallerRunsPolicy。 声明式多线程的上下文传递：@Async 5.1 问题说明 上述多线程案例都是编程式的，能直接控制任务提交的位置。Spring 的 @Async 则通过代理把方法调用交给配置的执行器，业务代码不直接操作线程池，但上下文传播的要求是一样的。 因此，关键是找到 @Async 实际使用的执行器，并在它的任务边界上统一处理上下文。@Async 不保证默认使用 ThreadPoolTaskExecutor，具体选择受 Spring 配置、AsyncConfigurer 和 Spring Boot 自动配置等因素影响。 5.2 方案：重写指定线程池 整体思路仍与 4.3 一样：自定义执行器，并让 @Async 明确使用它。这里保留继承 ThreadPoolTaskExecutor 的方式，类名统一为 AsyncThreadPoolExecutor。 对于 Spring 的 ThreadPoolTaskExecutor，仅重写外层 execute() 不一定覆盖 submit() 路径。支持 TaskDecorator 的版本可以在内部任务执行入口统一包装，从而避免重复维护多个方法。TaskDecorator 从 Spring 4.3 开始提供；下例将它设置在自定义执行器的构造器中。 自定义线程池： public class AsyncThreadPoolExecutor extends ThreadPoolTaskExecutor {
    public AsyncThreadPoolExecutor(int corePoolSize, int maxPoolSize,
            int queueCapacity, int keepAliveSeconds,
            String threadNamePrefix,
            RejectedExecutionHandler rejectedExecutionHandler) {
        setCorePoolSize(corePoolSize);
        setMaxPoolSize(maxPoolSize);
        setQueueCapacity(queueCapacity);
        setKeepAliveSeconds(keepAliveSeconds);
        setThreadNamePrefix(threadNamePrefix);
        setRejectedExecutionHandler(rejectedExecutionHandler);

        setTaskDecorator(runnable -> {
            // 在任务提交时捕获上下文
            RpcContext_inner rpcContext = EagleEye.getRpcContext();
            if (rpcContext != null) {
                rpcContext.setAsyncMode(true);
            }
            return () -> {
                RpcContext_inner previous = EagleEye.getRpcContext();
                try {
                    if (rpcContext == null) {
                        EagleEye.clearRpcContext();
                    } else {
                        EagleEye.setRpcContext(rpcContext);
                        EagleEye.startRpc();
                    }
                    runnable.run();
                } finally {
                    if (previous == null) {
                        EagleEye.clearRpcContext();
                    } else {
                        EagleEye.setRpcContext(previous);
                    }
                }
            };
        });
    }
} 这里复用 4.2 的上下文处理逻辑及版本前提，只把包装位置移到了 TaskDecorator。已有平台装饰器时，可以直接使用经过适配的实现；如果现有执行器已经配置了其他装饰器，应组合处理，避免覆盖原有能力。 指定 @Async 所用线程池： 未显式指定时，Spring 的默认查找会涉及唯一的 TaskExecutor Bean、名为 taskExecutor 的 Executor Bean 以及 AsyncConfigurer 等配置。为便于确认实际使用的执行器，下例同时声明 Bean 名称，并在注解中显式引用： @Configuration
@EnableAsync
public class AsyncThreadPoolConfig {
    @Bean("taskExecutor")
    public AsyncThreadPoolExecutor taskExecutor() {
        return new AsyncThreadPoolExecutor(8, 16, 1024, 60,
                "AsyncTaskExecutor-",
                new ThreadPoolExecutor.CallerRunsPolicy());
    }
} 该 Bean 的初始化和销毁交由 Spring 管理，无需在工厂方法里重复调用 initialize()。如果在容器外直接创建执行器，则需要自行管理初始化和关闭。上述线程数、队列大小沿用示例值，实际应按业务负载调整。 使用时仍然由业务服务通过注解提交任务： @Autowired
private TestAsyncService testAsync;

@PostMapping(path = "/testAsync", produces = "application/json")
public void testAsync() {
    log.info("Enter main");
    testAsync.doAsync();
    log.info("Exit main");
} @Slf4j
@Service
public class TestAsyncService {
    @Async("taskExecutor")
    public void doAsync() {
        log.info("Enter executor");
        // 执行业务逻辑
        log.info("Exit executor");
    }

```
- 使用注解：

```java
@Component
public class demoJob extends JavaProcessor {
    @Override
    @OpenTrace(traceName = "DemoJob", traceType = TraceTypeEnum.JOB)
    public ProcessResult process(JobContext jobContext) {
        //...
    }
}
```

## 多线程的EagleEye上下文传递

### 4.1 问题说明

EagleEye 基于 ThreadLocal 实现 trace 上下文的存储和传递，意味着 trace 不能在多线程中进行传递和延续。

有人会有疑问，使用 InheritableThreadLocal 或者 [TransmittableThreadLocal](https://github.com/alibaba/transmittable-thread-local?spm=ata.21736010.0.0.6fca287eJlM4Y4) 之类的可继承的 ThreadLocal 就能很简单的解决问题了啊，要是可以的话 EagleEye 官方早就做了，因为当下的系统几乎都使用的线程池，线程早就一口气初始化好了，这些线程根本就没有继承关系，InheritableThreadLocal 肯定无法起作用。

### 4.2 方案1：手动设置上下文

以 parallelStream 操作为例（本质是 ForkJoin 线程池）：

```java
RpcContext_inner rpcContext = EagleEye.getRpcContext();
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
```

> 参考官方： [http://gitlab.alibaba-inc.com/middleware/eagleeye-docs/wikis/eagleeye-async-rpc](http://gitlab.alibaba-inc.com/middleware/eagleeye-docs/wikis/eagleeye-async-rpc)

### 4.3 方案2：重写 ThreadPoolExecutor

- 重写 ThreadPoolExecutor：

```java
public class TraceThreadPoolExecutor extends ThreadPoolExecutor {
    public TraceThreadPoolExecutor(int corePoolSize, int maximumPoolSize, long keepAliveTime, TimeUnit milliseconds, BlockingQueue<Runnable> workQueue) {
        super(corePoolSize, maximumPoolSize, keepAliveTime, milliseconds, workQueue);
    }
    public TraceThreadPoolExecutor(int corePoolSize, int maximumPoolSize, long keepAliveTime, TimeUnit milliseconds, LinkedBlockingQueue<Runnable> workQueue, ThreadFactory factory) {
        super(corePoolSize, maximumPoolSize, keepAliveTime, milliseconds, workQueue, factory);
    }
    @Override
    public void execute(Runnable runnable) {
        RpcContext_inner rpcContext = EagleEye.getRpcContext();
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
```

- 使用时就不用关心了：

```java
private static final ExecutorService TRACE_POOL_EXECUTOR = new TraceThreadPoolExecutor(4, 6, 0L, TimeUnit.MILLISECONDS,
new LinkedBlockingQueue<>(20), new ThreadFactoryBuilder().setNameFormat("trace-executor-%d").build());
public void testTrace() {
    log.info("Enter main");
    TRACE_POOL_EXECUTOR.execute(() -> {
        log.info("Enter executor");
        log.info("Exit executor");
    });
    log.info("Exit main");
}
```

## 声明式多线程的上下文传递：@Async

### 5.1 问题说明

上述的多线程案例都是编程式的，很容易就手动写入上下文，声明式的多线程稍微麻烦点，比如 Spring 的 @Async 注解，通过代理方法的形式创建线程。

### 5.2 方案：重写指定线程池

其实和 4.3 没啥区别，只不过这里就得知道每个注解背后的线程池，@Async 默认使用的线程池是 ThreadPoolTaskExecutor。

- 重写线程池 execute 和 submit 方法：

```java
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
        RpcContext_inner rpcContext = EagleEye.getRpcContext();
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
        RpcContext_inner rpcContext = EagleEye.getRpcContext();
        ThreadPoolExecutor executor = super.getThreadPoolExecutor();
        return executor.submit(() -> {
            // 略，同上
        });
    }
```

- 指定 @Async 所用线程池：

@Async 会去容器里找 type 为 `TaskExecutor` 的 Bean，若有多个，会再去找 name 为 `taskExecutor` 、type 为 `Executor` 的Bean，所以如下声明 `@Bean("taskExecutor")` ：

@Configuration

```java
public class AsyncThreadPoolConfig {
    @Bean("taskExecutor")
    public Executor taskExecutor() {
        return new AysncThreadPoolExecutor(8, 16,
1024, 60, "AsyncTaskExecutor-",
new ThreadPoolExecutor.CallerRunsPolicy());

}

}
```

- 使用时就不用关心了：

```java
@Autowired
private TestAysncService testAysnc;
@PostMapping(path = "/testAysnc", produces = "application/json")
public void testAysnc(HttpServletRequest request) {
    log.info("Enter main");
    testAysnc.doAysnc();
    log.info("Exit main");
}
```

@Slf4j

@Service

public class TestAysncService {

@Async

```java
public void doAysnc() {
    log.info("Enter executor");
    log.info("Exit executor");
}
}
```

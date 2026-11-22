---
title: "metaQ消息限流技术分享"
source: "https://ata.atatech.org/articles/11020313613?spm=ata.23639746.0.0.7a332474MRtX3l#M2FiOWEz"
author:
  - "[[杨颖(苍岚)]]"
published:
created: 2026-10-30
description:
tags:
  - "clippings"
---
## 背景

在下游服务中，创建计划单的过程涉及消费metaq消息。由于存在QPS限制，我们需要控制下游消费的速率，防止因为限流而频繁导致失败和重试的情况发生。同时，在不超过QPS限制的前提下，希望尽量提升创建计划单的速度，满足计划单创建的时限要求。

## 原有方案

为了防止消费速率过快，直接通过设置metaQ客户端参数来实现。metaQ可以调节consumer消费的参数中常用的包括：

- pullInterval: 设置消费者去每个队列拉取消息的间隔，默认为0，即一个消息消费完成后立即去拉取数据
- pullBatchSize：每次去每个队列拉取消息的数量，默认32。
- consumeThreadMin：业务逻辑处理线程池最小线程数，默认值20。
- consumeThreadMax：业务逻辑处理线程池最大线程数。

```spring.metaq.consumers[4].consumer-group=
spring.metaq.consumers[4].consumer-group= ****************
spring.metaq.consumers[4].topic= ****************
spring.metaq.consumers[4].sub-expression= ****************
spring.metaq.consumers[4].message-listener-ref=planAdviceStreamMessageListener
spring.metaq.consumers[4].consume-thread-min=15
spring.metaq.consumers[4].consume-thread-max=20
```

通过在应用中设置最小线程数和最大线程数，理论上可以控制消费消息速率的上下限。但是阅读metaQ相关的技术文档发现consumer.setConsumeThreadMax()函数没有意义（ [客户端参数解释](https://aliyuque.antfin.com/mqdevops/metaq_wiki/cmnixt) ），结合metaQ源码可以看到，其内置线程池在初始化时创建的无界队列。众所周知，线程池线程数等于核心线程数时，只有当任务队列满了线程池才会将线程往最大线程数增加，所以实际情况是永远都是核心线程数。

![](313bd8bf-d62c-463e-9df1-94b191de86a7.png)

除此之外，通过线程数去限制QPS也是不稳定的。假如QPS限制为150，我们设置20个线程，线程消费一条消息的RT为200ms，那么调用下游服务的最大QPS为20 \* 1000 / 200）= 100。但是线程消费消息的RT不是固定的，假如RT突然缩短到100ms，QPS就会激增到200，仍旧会超过QPS限制触发限流，从而导致部分计划单创建失败。而且想要实时调整核心线程数的大小metaQ也比较繁琐，需要重新改配置发布变更，耗时久且流程繁琐，因此需要对其进行改造。

## 技术方案

## 3.1.主动控速

既然每次修改线程数很繁琐，那么有没有在应用运行时能够修改参数的方法呢？集团中间件里diamond和Switch都能做到这一点，如果我们能将metaQ的参数通过动态推送的方式修改就好了。继续分析metaQ的源码发现其实它预留了修改核心线程数的方法，不过设置的值需要满足一些约束条件：com.taobao.metaq.client.MetaPushConsumer。

![](a118d3c5-4df4-4001-aa7e-ed0590852feb.png) ![](78c461f6-d445-4a4c-8a58-8be108b75123.png)

那么我们只需要获取需要调整线程数的MetaPushConsumer就能动态设置核心线程数，通过diamond推送的方式来推送修改的参数值，这样只需要重启机器就能实现动态修改的功能。不过这个内置方法并没有在metaQ的内置文档中体现，可能操作核心线程数是一种高风险的行为，不太推荐我们主动去做这个，并且重启机器的过程中是可能出现消息堆积的场景的，需要评估应急方法。

## 3.2 被动控速

其实在动态限流方面集团大佬做了很多相关的工作，Sentinel在这种场景下迭代了丰富的功能给我们提供帮助。为了保证限流的同时不会出现长时间的等待，可以接入限流组件Sentinel配合热点规则来设置匀速排队功能。匀速排队模式会严格控制请求通过的间隔时间，也即是让请求以均匀的速度通过，对应的是漏桶算法。

![](46e8d083-98f1-441b-9f14-6ead00d38bc2.png)

### 3.2.1 无侵入式限流

Sentinel为HSF提供了自动埋点功能，能够实现接口级别和接口方法级别的限流，可以在簇点链路中查询资源名称，用于限流规则配置。对于HSF接口而言，资源名包含了接口名和方法名。如果想对某个方法进行限流，找到对应的方法资源名，点击右侧的流控。

![](dff302f7-4139-4913-9e0c-31966ab14ba7.png)

本次需要限流的方法不是应该标准的HSF接口，不过可以将其抽成1个hsf服务 对其监控限流 做限流报错处理，当发生限流的时候，可以进行消息失败重投或者设置metaQ的延迟投递。

![](187423b4-ce56-4b0e-8089-691f43a39cd6.png) ![](7bdc34de-007f-4725-b9c7-ffa7346c8fa0.png)

### 3.2.2 埋点式限流

一种比较直观的方法，哪里需要限流就对该代码块进行自定义埋点，设置好自定义资源名以后就可以在Sentinel上配置流控规则，实现动态限流，实现方法比较简单。

```entry
Entry entry = null;
// 务必保证 finally 会被执行
try {
    // 资源名可使用任意有业务语义的字符串，注意数目不能太多（超过 1K），超出几千请作为参数传入而不要直接作为资源名
    // EntryType 代表流量类型（inbound/outbound），其中系统规则只对 IN 类型的埋点生效
    entry = SphU.entry("自定义资源名");
    // 被保护的业务逻辑
    // do something...
} catch (BlockException ex) {
    // 资源访问阻止，被限流或被降级
    // 进行相应的处理操作
} catch (Exception ex) {
    // 若需要配置降级规则，需要通过这种方式记录业务异常
    Tracer.traceEntry(ex, entry);
} finally {
    // 务必保证 exit，务必保证每个 entry 与 exit 配对
    if (entry != null) {
        entry.exit();
    }
}
```

![](05d8a619-5af8-4659-8012-672d0db1c2b3.png)

### 3.2.3 注解式限流

埋点式限流式有比较大的侵入性，并且也不具有限流方法的扩展性。很多需要限流的方法在被限流后的操作其实是一致的，例如延迟投递。如果每个位置都利用自定义埋点框架来实现流控部分代码实际上是重复的。那么我们能不能提取出一个公共的限流框架出来呢？正当苦思冥想如何实现时，发现Sentinel竟然也出了相关的功能。在sentinel 3.9.26及以上版本中，为了解决埋点式限流的侵入性，增加了注解方式的限流实现，注解方式需要引入Spring AOP并加入额外依赖。

```@target({elementtype.method,
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
public @interface SentinelResource {

    String value() default "";

    EntryType entryType() default EntryType.OUT;

    int resourceType() default 0;

    String blockHandler() default "";

    Class<?>[] blockHandlerClass() default {};

    String fallback() default "";

    String defaultFallback() default "";

    Class<?>[] fallbackClass() default {};

    Class<? extends Throwable>[] exceptionsToTrace() default {Throwable.class};
    
    Class<? extends Throwable>[] exceptionsToIgnore() default {};
}
```

主要属性属性：value定义资源名称，blockHandler和blockHandlerClass来指定限流处理函数，fallback用于在抛出异常的时候提供fallback处理逻辑，fallback 函数可以针对所有类型的异常进行处理。

### 3.2.4 消息限流

在今年的Sentinel官方文档中可以看到MetaQ消息也能直接接入限流了（文档持续更新中）。接入metaQ限流功能，在Springboot启动应用中直接加入注解@ImportResource({"sentinel-tracer-metaq.xml"})，本地启动后触发消息发送/监听就能观察到metaQ前缀的资源注册成功。

![](d2336131-7f29-45dc-9213-effe41567313.png) ![](9876fa2f-70d4-42d2-804a-4526c5893c2b.png)

配置完成之后，默认限流行为抛出异常，metaq consumer 侧会自动进行重试。producer 侧直接阻塞本次发布。如果需要自定义fallback可以自定义fallback逻辑并进行注册。

```public
public class MyMetaConsumerFallback implements MetaConsumerFallback {
    @Override
    public void blocked(String consumerGroup, MessageExt messageExt, BlockException ex) throws BlockException {
        throw ex;
    }
    
    @Override
    public ConsumeConcurrentlyStatus concurrentlyHandle(String consumerGroup, BlockException ex) {
        throw new RuntimeException(ex);
    }
    
    @Override
    public ConsumeOrderlyStatus orderlyHandle(String consumerGroup, BlockException ex) {
        throw new RuntimeException(ex);
    }
}
```

```metaconsumerfallback
MetaConsumerFallback consumerFallback = new MyMetaConsumerFallback();
MetaFallbackRegistry.setConsumerFallback(consumerFallback);
```

## 方案比较

| 方案 | 主动控速 | 埋点限流 | metaQ接入限流 | 注解式限流 |
| --- | --- | --- | --- | --- |
| 优点 | 修改简单 | 控速稳定，异常处理方便 | 控速稳定，无需修改代码 | 复用性强、侵入性低，异常处理方便，控速稳定 |
| 缺点 | 控速不稳定，线程处理请求速度会影响QPS | 对代码有一定的侵入性 | 异常处理不方便,Sentinel 版本需 3.9.34 版本及以上,看代码仓库没有使用量 |  |

综上所述，结合我们应用的实际情况，在改动应用依赖包数量较少的情况下选择了注解式限流实现。

## 方案实现

## 5.1 禁用Sentinel AHAS插件

禁用AHAS插件，AHAS插件已经被集成进pandora中，但目前sentinel团队已不再维护该版本，并且注解式限流也无法支持，因此需要将其禁用。首先需要增加启动参数-Ddisable.pandora.sentinel=true"。

![](c3f65504-e328-4d82-abf7-2b8b21d3523f.png)

然后重新构建基础镜像，利用新构建的镜像替换原有镜像。

![](dae05211-4193-4e15-bd53-b45a0dc56ee1.png) ![](6472ee1a-7b01-4dbd-bfa5-d3af42a40c04.png)

## 5.2 升级二方包

需要引入支持注解式限流的二方包，同时将sentinel升级到3.9.26。

```<dependency>
<dependency>
  <groupId>com.taobao.csp</groupId>
  <artifactId>sentinel</artifactId>
  <version>3.9.26</version>
</dependency>
<dependency>
  <groupId>com.taobao.csp</groupId>
  <artifactId>sentinel-annotation-aspectj</artifactId>
  <version>3.9.26</version>
</dependency>
```

通过AOP的方式将SentinelAspectConfiguration注册为一个Spring Bean。

```@configurationpublic
@Configuration
public class SentinelAspectConfiguration {

    @Bean
    public SentinelResourceAspect sentinelResourceAspect() {
        return new SentinelResourceAspect();
    }
}
```

利用@SentinelResource用于定义资源，并提供可选的异常处理和 fallback 配置项,通过blockHandler和FallBackHandler可以自定义限流处理和异常处理。

```@sentinelresource(value
@SentinelResource(value = "****.****.*****",
                  blockHandler = "metaqBlockHandle",blockHandlerClass = {SentinelExceptionUtils.class},
                  fallback = "metaqFallBackHandle",fallbackClass = {SentinelExceptionUtils.class})
protected boolean doOneMessage(MessageExt message, ConsumeConcurrentlyContext context) {
}
```

## 5.3 限流参数设置

### 5.3.1 QPS设置

设置QPS之后发现可能还没到阈值就会触发限流，这是因为在匀速排队等待模式下QPS阈值配置并不代表一秒钟最多通过这么多请求，这个阈值只会用来计算两个请求的时间间隔。比如当阈值设为 10 的时候，则代表一秒匀速的通过 10 个请求，也就是每个请求平均间隔恒定为1000 / 10 = 100ms。如果请求以一个尖刺的脉冲到达，比如同一时刻到达了 8 个请求，这一刻最多只能过一个请求，但排队等待最大时间仅 200ms，那意味着这 8 个请求排队时一定会有几个请求直接被拒绝（每个请求间隔 100ms，最大排队 200ms，超出直接拒绝）。

### 5.3.2 超时时间等待设置

按照排队等待原理，官方给出了最小超时时间计算公式，推荐在保证业务正常消费的同时尽可能大，我们的线程数设置的20，你们最小超时时间计算公式为：

![](38c20689-afb4-4800-83a4-7b749eaa2339.svg)

### 5.3.3 流控效果选择（快速失败 or 排队等待？）

对于metaQ消息限流配置，必须要选择排队等待，不能选择快速失败。这是因为如果选择快速失败，在触发限流以后任务会立即进入重试队列，从而不走业务逻辑导致RT很小。这时候broker会认为消费者消费能力增强会多发消息，从而导致消息QPS翻倍，而重投队列只会有固定的消费者进行消费，这样消息总量会激增影响稳定性。

## 总结

校招来到阿里后，这是第一次自己独立地去设计一个技术方案。在设计的过程中学习了集团的中间件，不得不感慨集团的中间件的功能做的的确很完善，免去了自己造轮子的工作量，从Sentinel功能更新的演进也可以看出开发人员的思考过程，对用户使用场景的不同做了很多适配。在编写设计方案的过程中也学习到了很多相关的知识，最先进的方案并不一定是最适合当前场景的。最后非常感谢组内师兄们和Sentinel官方人员的答疑解惑！

中
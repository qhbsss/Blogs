---
title: "HSF 是什么"
source: "https://ata.atatech.org/articles/11020792010?spm=ata.23639746.0.0.1b9f3566ExQTeU#ZGUzYTY3"
author:
  - "[[王宇静(北音)]]"
published:
created: 2026-10-25
description:
tags:
  - "clippings"
---
## 一、HSF 是什么，为什么要有它

HSF 是一款在阿里巴巴内部广泛使用的分布式 RPC 服务框架，"高速"体现在底层的非阻塞 I/O 和优秀的序列化机制上。作为基础中间件，它联通不同业务系统、解耦系统间的实现依赖，从分布式应用层面统一了服务的发布/调用方式，让用户可以像调本地方法一样调远程服务。

它屏蔽了分布式领域的四类复杂细节：远程通讯、序列化实现、性能损耗、同步/异步调用方式。对使用者来说，只需要三步：定义接口、发布实现、注入代理，就能拿到远程调用能力。

HSF 功能结构上分为 6 个部分：服务消费方、服务提供方、地址注册中心、持久化配置中心、元数据存储中心、HSF 运维平台（HSF 控制台）。其中必须的只有前三个——消费方、提供方、地址注册中心，另外三个是治理/运维增强

![](d2de2e21-c92b-4ec8-9a55-ecf854249248.png)

## 二、总体架构：六大组件

RPC 抽象图如下：理解 client 和 server 之间到底在做什么

![](ea4a1ddc-43ef-4ae2-86a7-42e7082ad0cd.png)

在这张图基础上补齐注册中心、配置中心、元数据中心，就是 HSF 的完整运行机制：

![](4e6f691b-558b-4cb5-afe4-b2bdecf2ed0b.png)

各组件在阿里内部的具体承担者：

| 组件角色 | 阿里内部实现 | 职责 |
| --- | --- | --- |
| 地址注册中心 | ConfigServer | 服务注册与发现，去中心化 + 发布订阅模型，长链接实时通知 |
| 持久化配置中心 | Diamond（HSF 专属，非应用 Diamond） | 存储路由规则、归组规则、权重规则等治理规则 |
| 元数据存储中心 | Redis | 存服务名/接口名/参数名/版本信息，供 HSFOPS 运维查询，可选 |
| HSF 控制台 | HSFOPS | 服务查询、地址列表、提供者/消费者信息、预热 Case 管理 |
| 地址服务器 | VipServer | 通过 `jmenv.tbsite.net` 获取 ConfigServer 的所有 IP |

关键理解：client 和 server 启动时都会先去 Diamond 拉配置（包括注册中心地址、治理规则等），然后 server 向 ConfigServer 注册服务、client 从 ConfigServer 订阅地址列表。ConfigServer 用长链接维护发布订阅关系，server 上下线时实时推送给 client，client 本地缓存地址列表，调用时直接从内存选址，不走注册中心。

## 三、协议层设计：为什么不用 HTTP

一个自然的问题：client 和 server 之间的请求响应为什么不用 HTTP？

答案在于场景不匹配。如果 client 少、请求次数少、请求体小，HTTP 没问题；但阿里内部服务调用是 client 数量巨大、请求频繁、请求体可能很大的场景，HTTP 性能会急剧下降。HTTP 有两个天然劣势：

第一，短连接。一次 HTTP 请求要经历"建立连接→发送请求→接收响应→关闭连接"，而服务间调用是持续过程，频繁建立/断开 TCP 连接消耗巨大。RPC 用长连接，一条 TCP 通道复用所有请求。

第二，消息头冗余。HTTP header 复杂且文本化，远程调用不需要那么多字段。RPC 自己定义精简的二进制协议 `RpcRequest` / `RpcResponse`。

HSF 协议分两层：

- 通讯传输层：`协议头 + payload` 结构，定长（协议头）+ 不定长（实际内容）组合，基于 TCP 传输，用 Netty 实现。
- 应用层：对不定长部分做序列化，HSF 默认用 Hessian（集团自己封装的版本），也支持 Kryo 等其他序列化方式。
![](3209fa1e-dadf-473c-91e9-0a08179baae7.png)

## 四、服务端原理：注册与发布

### 4.1 使用侧：一个注解搞定

Spring 注解方式发布服务只需要三步：

```<!--
<!-- 步骤 1：引入 starter -->
<dependency>
    <groupId>com.alibaba.boot</groupId>
    <artifactId>pandora-hsf-spring-boot-starter</artifactId>
</dependency>
```

```//
// 步骤 2：接口实现类上加 @HSFProvider 注解
@HSFProvider(serviceInterface = OrderService.class,
             serviceGroup = "HSF",
             serviceVersion = "1.0.0",
             clientTimeout = 3000)
public class OrderServiceImpl implements OrderService {
    @Autowired
    private OrderDAO orderDAO;

    @Override
    public OrderModel queryOrder(Long id) {
        return orderDAO.queryOrder(id);
    }
}
// 步骤 3：启动应用，服务自动发布
```

`@HSFProvider` 注解的核心属性：

| 属性 | 含义 |
| --- | --- |
| `serviceInterface` | 服务接口，客户端通过此属性订阅 |
| `target` | 服务端实现对象 |
| `serviceVersion` | 服务版本，客户端通过此属性订阅 |
| `serviceGroup` | 服务归组，客户端通过此属性订阅 |
| `clientTimeout` | 响应超时（毫秒），超时即抛 `HSFTimeOutException` |
| `preferSerializeType` | 序列化方式，默认 `hessian2` |

⚠️核心概念：`serviceInterface + serviceVersion + serviceGroup` 三者共同构成服务的唯一标识。服务名（interface:version）和组别（group）唯一决定了服务的发布和订阅关系。

![](4d6a498b-9ef7-4f81-a811-b6c0c8fbfb06.png)

### 4.2 原理侧：发布流程时序

发布入口是 `HSFSpringProviderBean.init()`，它内部委托给 `HSFApiProviderBean.publish()`，再调用 `ProcessService`（实现类 `ProcessComponent`）完成实际发布。

![](daca4830-606c-4548-a49a-23b8b9547350.png)

完整流程六步：

1. 初始化 `HSFSpringProviderBean`：从配置读取服务名、接口、实现类、版本、组。
2. 初始化 `HSFApiProviderBean`（Spring bean 的成员变量 `providerBean`）：Spring bean 只是适配层，实际发布逻辑都在 `providerBean` 里。构造函数中会创建 `ServiceMetadata` 对象，写入默认值：version=`1.0.0`、group=`HSF`、timeout=`3000ms`、idle timeout=`10s`、序列化=`HESSIAN`、RPC 版本=`2.0`。
3. `providerBean.publish()` 调用 `ProcessService.publish()`（实现类 `ProcessComponent`）。
4. `ProcessComponent` 调 `RPCProtocolTemplateService.registerProvider()`：在 server 本地为该服务申请一个独立线程池，请求过来时从线程池取 executor 执行。
5. `ProcessComponent` 调 `UnitService.beforePublish()`：判断是中心发布还是单元发布，为 `ServiceMetadata` 设置不同的发布路由。
6. `ProcessComponent` 调 `MetadataService.publish()`：把 metadata（接口/实现/版本等）发布到 ConfigServer。
7. `ProcessComponent` 调 `MetadataInfoStoreService.store()`：把 metadata 保存到 Redis 供 HSFOPS 服务治理查询。

### 4.3 服务端接收请求的处理流程

![](f620f78e-660f-40d1-8dec-a683b76f5dca.png)

Server 侧简述：

1. 启动 NettyServer 监听端口。
2. `NettyServerHandler` 根据 `HSFRequest` 类型找到对应 Handler（如 `RPCServerHandler` 或心跳 Handler）。
3. Handler 加载执行任务的 executor（服务注册时已生成对应线程池）。
4. 生成 `HandlerRunnable`，`executor.execute(new HandlerRunnable)`。
5. `HandlerRunnable` 内部调用 `ProviderProcess`，找到服务的具体实现类执行，把结果封装成 `HSFResponse` 返回给 client。

## 五、客户端原理：订阅与调用

### 5.1 使用侧：注入即用

```//
// 方式 A：统一 Config 类（推荐，避免多处重复注解）
@Configuration
public class HsfConfig {
    @HSFConsumer(serviceVersion = "1.0.0", serviceGroup = "HSF")
    OrderService orderService;
}

// 使用时直接 @Autowired
@Service
public class MyBiz {
    @Autowired
    OrderService orderService;

    public void doSomething() {
        OrderModel order = orderService.queryOrder(123L);
    }
}
```

### 5.2 原理侧：动态代理生成

Spring 注入时只有接口、没有实现类，HSF 用动态代理把远程服务伪装成本地 Bean。

![](874c6312-92dc-41d7-84fe-f2e596633c88.png)

关键链路：`HSFSpringConsumerBean implements FactoryBean` → `getObject()` → `consumerBean.getObject()` → `metadata.getTarget()`。

`target` 在 `consumerBean.init()` 中赋值：

```public
public void init() throws Exception {
    if (!inited.compareAndSet(false, true)) { return; }  // 避免重复初始化
    LoggerInit.initHSFLog();
    // ... 校验接口类存在
    metadata.initUniqueName();  // 服务命名："interfaceName:version"
    ProcessService processService = HSFServiceContainer.getInstance(ProcessService.class);
    metadata.setTarget(processService.consume(metadata));  // 生成代理
    // 同步等待地址推送（可选）
    int waitTime = metadata.getMaxWaitTimeForCsAddress();
    if (waitTime > 0) {
        metadata.getCsAddressCountDownLatch().await(waitTime, TimeUnit.MILLISECONDS);
    }
}
```

`processService.consume(metadata)` 内部做的事：

- 从缓存查是否已生成代理（`ApplicationModel.getConsumedServiceModel(uniqueName)`）
- 执行前置 `ProcessHookService.preConsume()`
- 用 `HSFServiceProxy` 生成动态代理（默认 Javassist，可切 JDK Proxy）
- `metadataService.subscribe(metadata)`：同时订阅 Diamond 治理规则 + ConfigServer 地址列表
- 执行后置 hook
- 存 metadata 到 Redis
- 每天向数据采集中心发布一次运行时数据
![](409e8ff0-a05f-4fd7-86c1-829c50a0eb06.png)

### 5.3 原理侧：一次调用的完整过程

拿到代理对象后，调用 `helloWorldService.sayHi("xiaozi")` 实际执行的是 `HSFServiceProxy.invoke()`，最终进入 `invoke0()` 这个核心方法。

![](e4c49012-876e-4046-97fc-1d420b4a16e1.png)

`invoke0()` 做的事：

1. 组装 `HSFRequest`：写入 targetServiceUniqueName、methodName、methodArgSigs、methodArgs、returnClass。
2. 附加上下文字段：单元化 userId、消费端应用名（`CONSUMER_APP_NAME`）、目标组别（`TARGET_GROUP`）、SPAS 签名（access key + timestamp + signature）、EagleEye RPC 上下文。
3. Mock 拦截：如果配置了 `hsf.plugin.octopus` 且命中 mock 规则，直接返回 mock 值，不走网络。
4. 选址（核心）：按优先级——
	- 测试模式：直接用配置的 `target` URL
		- 用户指定 `targetServerIp`：走 `addressService.getAddressByIp()`
		- SCM 流程：走 `scmAddressSelectService`
		- 广播模式：`selectAddressList()` 拿全部地址列表逐个调
		- 一致性哈希：设置 `ROUTE_SERVICE=CONSISTENT` 后走 `selectAddress()`
		- 默认：负载均衡选址
5. 发起 RPC：`rpcService.invoke(request, methodModel, remotingURL)`，内部根据配置选择四种调用方式之一：
	- `SyncInvokeComponent`（同步，默认）
		- `FutureInvokeComponent`（Future 异步）
		- `CallbackInvokeComponent`（回调异步）
		- `ReliableInvokeComponent`（可靠调用）
6. 超时重试：`HSFTimeOutException` 时如果 `retryTime < executeTimes` 继续下一轮选址重试。
7. 异常处理：如果 `appResponse instanceof Throwable`，重新抛出。
8. 监控埋点：`monitorService.add(HSF_CONSUMER_ACTIVE_THREAD, ...)`、`logService.rpcClientRecv()`、`Profiler.enter/release()`。

消费端线程池保护：`trueInvoke()` 中如果配置了 `consumerMaxPoolSize`，会用 `AtomicInteger` 计数，超限抛 `"消费端线程池已满"` 异常。这是消费端自我保护，防止慢服务拖垮调用方。

## 六、部署实践：API 方式 vs PandoraBoot 方式

HSF 有两种主流部署方式，选择依据是是否需要 Spring 集成和服务数量。

### 6.1 API 方式（原生，无 Spring）

适合服务数量少、需要精细控制发布/订阅时机的场景。

Maven 依赖：

```<dependency>
<dependency>
    <groupId>com.taobao.hsf</groupId>
    <artifactId>hsf-all</artifactId>
    <version>3.1.23</version>
</dependency>
```

服务提供方：

```public
public static void main(String[] args) {

    HSFApiProviderBean bean = new HSFApiProviderBean();
    bean.setServiceInterface("org.example.service.HelloWorldService");
    bean.setTarget(new HelloWorldServiceImpl());
    bean.setServiceVersion("1.0.0");
    bean.setServiceGroup("HSF");
    bean.setClientTimeout(5000);
    bean.setPreferSerializeType("hessian2");
    bean.init();  // 发布
}
```

服务消费方：

```hsfapiconsumerbean
HSFApiConsumerBean bean = new HSFApiConsumerBean();
bean.setInterfaceName("org.example.service.HelloWorldService");
bean.setVersion("1.0.0");
bean.setGroup("HSF");
bean.init(true);  // true=同步等待地址推送，默认超时 3000ms

HelloWorldService svc = (HelloWorldService) bean.getObject();
String hi = svc.sayHi("CuiHengtuo");
```

### 6.2 PandoraBoot 方式（Spring Boot 集成，推荐）

适合服务数量多、需要 Spring 依赖注入和统一配置管理的场景。优势：注解方式代码简洁；配置方式多样（`ServiceFactory` / XML / 注解）；部署灵活。

Maven 依赖：

```<dependencies>
<dependencies>
    <dependency>
        <groupId>org.example</groupId>
        <artifactId>hsf-api</artifactId>
        <version>1.0-SNAPSHOT</version>
    </dependency>
    <dependency>
        <groupId>com.alibaba.boot</groupId>
        <artifactId>pandora-hsf-spring-boot-starter</artifactId>
    </dependency>
</dependencies>

<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>2.5.12</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>com.taobao.pandora</groupId>
            <artifactId>pandora-boot-starter-bom</artifactId>
            <version>2023-07-stable-final</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

Provider：

```@hsfprovider(serviceinterface
@HSFProvider(serviceInterface = HelloWorldService.class,
             serviceVersion = "2.0.0",
             serviceGroup = "HSF")
public class HelloWorldServiceImpl implements HelloWorldService {
    @Override
    public String sayHi(String name) {
        return name + " pandora hsf welcome you";
    }
}
```

Consumer 三种写法：

写法 1：`@HSFConsumer` 注解 + `@Autowired`（最常用）

```@configurationpublic
@Configuration
public class ConsumerConfig {
    @HSFConsumer(serviceVersion = "2.0.0", serviceGroup = "HSF")
    HelloWorldService helloWorldService;
}

// 使用
@RunWith(PandoraBootRunner.class)
@DelegateTo(SpringJUnit4ClassRunner.class)
@SpringBootTest(classes = {Application.class})
public class HsfTest {
    @Autowired
    HelloWorldService helloWorldService;

    @Test
    public void testHsf() {
        Assert.assertEquals("cuihengtuo pandora hsf welcome you",
                            helloWorldService.sayHi("cuihengtuo"));
    }
}
```

写法 2：`ServiceFactory` 构建（细粒度控制）

```@configurationpublic
@Configuration
public class ConsumerConfig {
    @Bean
    HelloWorldService helloWorldService() {
        return (HelloWorldService) ServiceFactory.consumer()
                .service(HelloWorldService.class)
                .group("HSF")
                .version("2.0.0")
                .timeout(3000)
                .sync()
                .subscribe();
    }
}
```

写法 3：`@Bean` 方式创建 `HSFSpringProviderBean` / `HSFSpringConsumerBean`

使用场景：`@HSFConsumer` 出现 `${}` 变量无法注入时的兜底方案。

```@configurationpublic
@Configuration
public class HsfProviderConfig {
    @Bean(initMethod = "init")
    public HSFSpringProviderBean helloWorldServiceXProvider(HelloWorldServiceXImpl impl) {
        HSFSpringProviderBean bean = new HSFSpringProviderBean();
        bean.setServiceInterface("org.example.service.HelloWorldService");
        bean.setTarget(impl);
        bean.setServiceVersion("1.0.0");
        bean.setServiceGroup("HSF");
        return bean;
    }
}

@Bean
HSFSpringConsumerBean helloWorldServiceXConsumer() {
    HSFSpringConsumerBean bean = new HSFSpringConsumerBean();
    bean.setInterfaceName("org.example.service.HelloWorldService");
    bean.setVersion("1.0.0");
    bean.setGroup("HSF");
    bean.init();
    return bean;
}
```

## 七、真实案例：轨迹中心的 HSF 应用

轨迹中心 `cnl-trace-center` 是海外链路里做轨迹查询/推送的核心服务，它的 HSF 用法很有代表性。

### 7.1 消费侧：工厂模式 + 细粒度配置

Step 1：通过配置类把区划组件 `DivisionComponents` 注入 Spring 容器。`DivisionComponents` 里包含用户配置和根据配置生成的核心操作类，其中就有 HSF 服务。初始化时调 `init()`。

![](bad631e1-b618-4be8-8d30-b4f1dc3c5b88.png)

Step 2：`DivisionComponents.init()` 中获取各个订阅的服务。

Step 3：订阅服务创建消费者在 `HsfConsumerFactory` 这样的工厂类中完成——创建 `HSFSpringConsumerBean`、根据参数设置、订阅服务、放入 Map 缓存。

![](8aa0260d-8d99-4d59-8f85-d3eed64c6d58.png)

### 7.2 发布侧：API 方式

轨迹中心的发布选择基于 API 方式而非注解，原因是发布的服务比较少，API 方式可以做更清晰、更细粒度的配置，也允许通过记录日志了解服务发布情况。

![](527d3d48-ac96-4c15-adbc-9e2460beb064.png)

### 7.3 总结这套设计的取舍

- 消费用工厂 + `HSFSpringConsumerBean`：代码简洁、可读性好、复用到多个订阅场景，允许细粒度配置。
- 发布用 API 方式：服务少时更清晰，可日志追踪发布情况。

这种"消费重工厂、发布重直白"的模式在海外其他应用（如 `cnl-fulfill-center`、`cnl-routing-na`）里也能看到，是排查 HSF 相关问题时的重要背景知识。

## 八、HSF 预热

### 8.1 为什么要预热

HSF 服务刚启动时，JIT 编译未完成、连接池未建立、缓存未加载，直接接流量会导致首批请求 RT 飙升甚至超时。预热就是在服务上线前，用一批"预热 Case"模拟真实调用，把 JIT、连接池、缓存都跑热。

### 8.2 预热方式

官方推荐用插件方式（对应文档：`aliyuque.antfin.com/chgygl/xmp9di/zchivo7ff61p4kiz`）。核心步骤：

1. 在 HSFOPS 上创建预热 Case：入口 `hsf.alibaba-inc.com/hsfops/v2/warmup/case`。
2. 应用启动脚本增加预热命令：让容器启动后自动执行预热 Case。
3. 检查插件安装：确认预热插件已挂载到应用。
4. 查看预热报告：`hsf.alibaba-inc.com/hsfops/warmup/report.htm?id=xxx`。

预热流程用 mermaid 表示（原钉钉文档截图无签名 URL 拉不到，用流程图补上）：

文本绘图

视图

99

1

2

3

4

5

6

7

8

9

10

flowchart LR

A\[HSFOPS 创建预热 Case\] --> B\[应用启动脚本\<br/>加预热命令\]

B --> C\[容器启动\]

C --> D\[预热插件执行 Case\]

D --> E{RT/成功率\<br/>达标?}

E -->|是| F\[挂载到 ConfigServer\<br/>开始接流量\]

E -->|否| G\[预热报告标红\<br/>阻断上线\]

G --> H\[排查 JIT/连接池/依赖\]

H --> D

![](data:image/svg+xml;utf8,%3Csvg%20aria-roledescription%3D%22flowchart-v2%22%20role%3D%22graphics-document%20document%22%20viewBox%3D%22-8%20-8%201327.76123046875%20249.30299377441406%22%20style%3D%22max-width%3A%201327.76123046875px%3B%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20%20id%3D%22text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%22%20width%3D%221327.76123046875%22%20height%3D%22249.30299377441406%22%3E%3Cstyle%3E%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%7Bfont-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3Bfont-size%3A16px%3Bfill%3A%23333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.error-icon%7Bfill%3A%23552222%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.error-text%7Bfill%3A%23552222%3Bstroke%3A%23552222%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.edge-thickness-normal%7Bstroke-width%3A2px%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.edge-thickness-thick%7Bstroke-width%3A3.5px%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.edge-pattern-solid%7Bstroke-dasharray%3A0%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.edge-pattern-dashed%7Bstroke-dasharray%3A3%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.edge-pattern-dotted%7Bstroke-dasharray%3A2%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.marker%7Bfill%3A%23333333%3Bstroke%3A%23333333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.marker.cross%7Bstroke%3A%23333333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20svg%7Bfont-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3Bfont-size%3A16px%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.label%7Bfont-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3Bcolor%3A%23333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.cluster-label%20text%7Bfill%3A%23333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.cluster-label%20span%2C%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20p%7Bcolor%3A%23333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.label%20text%2C%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20span%2C%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20p%7Bfill%3A%23333%3Bcolor%3A%23333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.node%20rect%2C%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.node%20circle%2C%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.node%20ellipse%2C%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.node%20polygon%2C%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.node%20path%7Bfill%3A%23ECECFF%3Bstroke%3A%239370DB%3Bstroke-width%3A1px%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.flowchart-label%20text%7Btext-anchor%3Amiddle%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.node%20.katex%20path%7Bfill%3A%23000%3Bstroke%3A%23000%3Bstroke-width%3A1px%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.node%20.label%7Btext-align%3Acenter%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.node.clickable%7Bcursor%3Apointer%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.arrowheadPath%7Bfill%3A%23333333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.edgePath%20.path%7Bstroke%3A%23333333%3Bstroke-width%3A2.0px%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.flowchart-link%7Bstroke%3A%23333333%3Bfill%3Anone%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.edgeLabel%7Bbackground-color%3A%23e8e8e8%3Btext-align%3Acenter%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.edgeLabel%20rect%7Bopacity%3A0.5%3Bbackground-color%3A%23e8e8e8%3Bfill%3A%23e8e8e8%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.labelBkg%7Bbackground-color%3Argba\(232%2C%20232%2C%20232%2C%200.5\)%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.cluster%20rect%7Bfill%3A%23ffffde%3Bstroke%3A%23aaaa33%3Bstroke-width%3A1px%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.cluster%20text%7Bfill%3A%23333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.cluster%20span%2C%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20p%7Bcolor%3A%23333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20div.mermaidTooltip%7Bposition%3Aabsolute%3Btext-align%3Acenter%3Bmax-width%3A200px%3Bpadding%3A2px%3Bfont-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3Bfont-size%3A12px%3Bbackground%3Ahsl\(80%2C%20100%25%2C%2096.2745098039%25\)%3Bborder%3A1px%20solid%20%23aaaa33%3Bborder-radius%3A2px%3Bpointer-events%3Anone%3Bz-index%3A100%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20.flowchartTitleText%7Btext-anchor%3Amiddle%3Bfont-size%3A18px%3Bfill%3A%23333%3B%7D%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118%20%3Aroot%7B--mermaid-font-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3B%7D%3C%2Fstyle%3E%3Cg%3E%3Cmarker%20orient%3D%22auto%22%20markerHeight%3D%2212%22%20markerWidth%3D%2212%22%20markerUnits%3D%22userSpaceOnUse%22%20refY%3D%225%22%20refX%3D%226%22%20viewBox%3D%220%200%2010%2010%22%20class%3D%22marker%20flowchart%22%20id%3D%22text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-pointEnd%22%3E%3Cpath%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%201%2C%200%3B%22%20class%3D%22arrowMarkerPath%22%20d%3D%22M%200%200%20L%2010%205%20L%200%2010%20z%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20orient%3D%22auto%22%20markerHeight%3D%2212%22%20markerWidth%3D%2212%22%20markerUnits%3D%22userSpaceOnUse%22%20refY%3D%225%22%20refX%3D%224.5%22%20viewBox%3D%220%200%2010%2010%22%20class%3D%22marker%20flowchart%22%20id%3D%22text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-pointStart%22%3E%3Cpath%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%201%2C%200%3B%22%20class%3D%22arrowMarkerPath%22%20d%3D%22M%200%205%20L%2010%2010%20L%2010%200%20z%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20orient%3D%22auto%22%20markerHeight%3D%2211%22%20markerWidth%3D%2211%22%20markerUnits%3D%22userSpaceOnUse%22%20refY%3D%225%22%20refX%3D%2211%22%20viewBox%3D%220%200%2010%2010%22%20class%3D%22marker%20flowchart%22%20id%3D%22text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-circleEnd%22%3E%3Ccircle%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%201%2C%200%3B%22%20class%3D%22arrowMarkerPath%22%20r%3D%225%22%20cy%3D%225%22%20cx%3D%225%22%3E%3C%2Fcircle%3E%3C%2Fmarker%3E%3Cmarker%20orient%3D%22auto%22%20markerHeight%3D%2211%22%20markerWidth%3D%2211%22%20markerUnits%3D%22userSpaceOnUse%22%20refY%3D%225%22%20refX%3D%22-1%22%20viewBox%3D%220%200%2010%2010%22%20class%3D%22marker%20flowchart%22%20id%3D%22text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-circleStart%22%3E%3Ccircle%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%201%2C%200%3B%22%20class%3D%22arrowMarkerPath%22%20r%3D%225%22%20cy%3D%225%22%20cx%3D%225%22%3E%3C%2Fcircle%3E%3C%2Fmarker%3E%3Cmarker%20orient%3D%22auto%22%20markerHeight%3D%2211%22%20markerWidth%3D%2211%22%20markerUnits%3D%22userSpaceOnUse%22%20refY%3D%225.2%22%20refX%3D%2212%22%20viewBox%3D%220%200%2011%2011%22%20class%3D%22marker%20cross%20flowchart%22%20id%3D%22text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-crossEnd%22%3E%3Cpath%20style%3D%22stroke-width%3A%202%3B%20stroke-dasharray%3A%201%2C%200%3B%22%20class%3D%22arrowMarkerPath%22%20d%3D%22M%201%2C1%20l%209%2C9%20M%2010%2C1%20l%20-9%2C9%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20orient%3D%22auto%22%20markerHeight%3D%2211%22%20markerWidth%3D%2211%22%20markerUnits%3D%22userSpaceOnUse%22%20refY%3D%225.2%22%20refX%3D%22-1%22%20viewBox%3D%220%200%2011%2011%22%20class%3D%22marker%20cross%20flowchart%22%20id%3D%22text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-crossStart%22%3E%3Cpath%20style%3D%22stroke-width%3A%202%3B%20stroke-dasharray%3A%201%2C%200%3B%22%20class%3D%22arrowMarkerPath%22%20d%3D%22M%201%2C1%20l%209%2C9%20M%2010%2C1%20l%20-9%2C9%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cg%20class%3D%22root%22%3E%3Cg%20class%3D%22clusters%22%3E%3C%2Fg%3E%3Cg%20class%3D%22edgePaths%22%3E%3Cpath%20marker-end%3D%22url\(%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-pointEnd\)%22%20style%3D%22fill%3Anone%3B%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20flowchart-link%20LS-A%20LE-B%22%20id%3D%22L-A-B-0%22%20d%3D%22M175.781%2C143.565L179.948%2C143.565C184.115%2C143.565%2C192.448%2C143.565%2C199.898%2C143.565C207.348%2C143.565%2C213.915%2C143.565%2C217.198%2C143.565L220.481%2C143.565%22%3E%3C%2Fpath%3E%3Cpath%20marker-end%3D%22url\(%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-pointEnd\)%22%20style%3D%22fill%3Anone%3B%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20flowchart-link%20LS-B%20LE-C%22%20id%3D%22L-B-C-0%22%20d%3D%22M336.79%2C143.565L340.956%2C143.565C345.123%2C143.565%2C353.456%2C143.565%2C360.906%2C143.565C368.356%2C143.565%2C374.923%2C143.565%2C378.206%2C143.565L381.49%2C143.565%22%3E%3C%2Fpath%3E%3Cpath%20marker-end%3D%22url\(%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-pointEnd\)%22%20style%3D%22fill%3Anone%3B%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20flowchart-link%20LS-C%20LE-D%22%20id%3D%22L-C-D-0%22%20d%3D%22M465.795%2C143.565L469.962%2C143.565C474.129%2C143.565%2C482.462%2C143.565%2C489.912%2C143.565C497.362%2C143.565%2C503.929%2C143.565%2C507.212%2C143.565L510.495%2C143.565%22%3E%3C%2Fpath%3E%3Cpath%20marker-end%3D%22url\(%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-pointEnd\)%22%20style%3D%22fill%3Anone%3B%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20flowchart-link%20LS-D%20LE-E%22%20id%3D%22L-D-E-0%22%20d%3D%22M625.199%2C124.07L635.966%2C118.055C646.733%2C112.041%2C668.267%2C100.012%2C682.401%2C94.063C696.535%2C88.115%2C703.268%2C88.247%2C706.635%2C88.313L710.002%2C88.379%22%3E%3C%2Fpath%3E%3Cpath%20marker-end%3D%22url\(%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-pointEnd\)%22%20style%3D%22fill%3Anone%3B%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20flowchart-link%20LS-E%20LE-F%22%20id%3D%22L-E-F-0%22%20d%3D%22M841.658%2C62.51L851.404%2C57.34C861.15%2C52.171%2C880.643%2C41.831%2C895.006%2C36.661C909.37%2C31.491%2C918.604%2C31.491%2C923.222%2C31.491L927.839%2C31.491%22%3E%3C%2Fpath%3E%3Cpath%20marker-end%3D%22url\(%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-pointEnd\)%22%20style%3D%22fill%3Anone%3B%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20flowchart-link%20LS-E%20LE-G%22%20id%3D%22L-E-G-0%22%20d%3D%22M841.658%2C114.456L851.404%2C119.459C861.15%2C124.462%2C880.643%2C134.468%2C898.976%2C139.471C917.31%2C144.474%2C934.485%2C144.474%2C943.073%2C144.474L951.66%2C144.474%22%3E%3C%2Fpath%3E%3Cpath%20marker-end%3D%22url\(%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-pointEnd\)%22%20style%3D%22fill%3Anone%3B%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20flowchart-link%20LS-G%20LE-H%22%20id%3D%22L-G-H-0%22%20d%3D%22M1067.969%2C144.474L1076.106%2C144.474C1084.242%2C144.474%2C1100.516%2C144.474%2C1119.766%2C150.09C1139.016%2C155.706%2C1161.241%2C166.939%2C1172.354%2C172.555L1183.467%2C178.171%22%3E%3C%2Fpath%3E%3Cpath%20marker-end%3D%22url\(%23text-diagram-c36530b6-9401-4e5f-9366-cef1be808db5-74118_flowchart-pointEnd\)%22%20style%3D%22fill%3Anone%3B%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20flowchart-link%20LS-H%20LE-D%22%20id%3D%22L-H-D-0%22%20d%3D%22M1162.278%2C219.553L1154.697%2C221.844C1147.116%2C224.136%2C1131.953%2C228.719%2C1106.984%2C231.011C1082.015%2C233.303%2C1047.24%2C233.303%2C1011.13%2C233.303C975.021%2C233.303%2C937.578%2C233.303%2C900.662%2C233.303C863.745%2C233.303%2C827.356%2C233.303%2C792.3%2C233.303C757.244%2C233.303%2C723.523%2C233.303%2C694.337%2C222.187C665.151%2C211.072%2C640.501%2C188.841%2C628.176%2C177.726L615.851%2C166.611%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabels%22%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate\(0%2C%200\)%22%20class%3D%22label%22%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate\(0%2C%200\)%22%20class%3D%22label%22%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate\(0%2C%200\)%22%20class%3D%22label%22%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate\(0%2C%200\)%22%20class%3D%22label%22%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate\(900.1349296569824%2C%2031.49147605895996\)%22%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate\(-8.004261016845703%2C%20-11.99573802947998\)%22%20class%3D%22label%22%3E%3CforeignObject%20height%3D%2223.99147605895996%22%20width%3D%2216.008522033691406%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%E6%98%AF%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate\(900.1349296569824%2C%20144.47442817687988\)%22%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate\(-8.004261016845703%2C%20-11.99573802947998\)%22%20class%3D%22label%22%3E%3CforeignObject%20height%3D%2223.99147605895996%22%20width%3D%2216.008522033691406%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%E5%90%A6%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate\(0%2C%200\)%22%20class%3D%22label%22%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate\(0%2C%200\)%22%20class%3D%22label%22%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22nodes%22%3E%3Cg%20transform%3D%22translate\(87.890625%2C%20143.56533813476562\)%22%20data-id%3D%22A%22%20data-node%3D%22true%22%20id%3D%22flowchart-A-0%22%20class%3D%22node%20default%20default%20flowchart-label%22%3E%3Crect%20height%3D%2238.99147605895996%22%20width%3D%22175.78125%22%20y%3D%22-19.49573802947998%22%20x%3D%22-87.890625%22%20ry%3D%220%22%20rx%3D%220%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%3E%3C%2Frect%3E%3Cg%20transform%3D%22translate\(-80.390625%2C%20-11.99573802947998\)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%3E%3C%2Frect%3E%3CforeignObject%20height%3D%2223.99147605895996%22%20width%3D%22160.78125%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22nodeLabel%22%3EHSFOPS%20%E5%88%9B%E5%BB%BA%E9%A2%84%E7%83%AD%20Case%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate\(281.2855110168457%2C%20143.56533813476562\)%22%20data-id%3D%22B%22%20data-node%3D%22true%22%20id%3D%22flowchart-B-1%22%20class%3D%22node%20default%20default%20flowchart-label%22%3E%3Crect%20height%3D%2262.98295211791992%22%20width%3D%22111.0085220336914%22%20y%3D%22-31.49147605895996%22%20x%3D%22-55.5042610168457%22%20ry%3D%220%22%20rx%3D%220%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%3E%3C%2Frect%3E%3Cg%20transform%3D%22translate\(-48.0042610168457%2C%20-23.99147605895996\)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%3E%3C%2Frect%3E%3CforeignObject%20height%3D%2247.98295211791992%22%20width%3D%2296.0085220336914%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22nodeLabel%22%3E%E5%BA%94%E7%94%A8%E5%90%AF%E5%8A%A8%E8%84%9A%E6%9C%AC%3Cbr%2F%3E%E5%8A%A0%E9%A2%84%E7%83%AD%E5%91%BD%E4%BB%A4%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate\(426.29261016845703%2C%20143.56533813476562\)%22%20data-id%3D%22C%22%20data-node%3D%22true%22%20id%3D%22flowchart-C-3%22%20class%3D%22node%20default%20default%20flowchart-label%22%3E%3Crect%20height%3D%2238.99147605895996%22%20width%3D%2279.00567626953125%22%20y%3D%22-19.49573802947998%22%20x%3D%22-39.502838134765625%22%20ry%3D%220%22%20rx%3D%220%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%3E%3C%2Frect%3E%3Cg%20transform%3D%22translate\(-32.002838134765625%2C%20-11.99573802947998\)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%3E%3C%2Frect%3E%3CforeignObject%20height%3D%2223.99147605895996%22%20width%3D%2264.00567626953125%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22nodeLabel%22%3E%E5%AE%B9%E5%99%A8%E5%90%AF%E5%8A%A8%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate\(590.2982864379883%2C%20143.56533813476562\)%22%20data-id%3D%22D%22%20data-node%3D%22true%22%20id%3D%22flowchart-D-5%22%20class%3D%22node%20default%20default%20flowchart-label%22%3E%3Crect%20height%3D%2238.99147605895996%22%20width%3D%22149.00567626953125%22%20y%3D%22-19.49573802947998%22%20x%3D%22-74.50283813476562%22%20ry%3D%220%22%20rx%3D%220%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%3E%3C%2Frect%3E%3Cg%20transform%3D%22translate\(-67.00283813476562%2C%20-11.99573802947998\)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%3E%3C%2Frect%3E%3CforeignObject%20height%3D%2223.99147605895996%22%20width%3D%22134.00567626953125%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22nodeLabel%22%3E%E9%A2%84%E7%83%AD%E6%8F%92%E4%BB%B6%E6%89%A7%E8%A1%8C%20Case%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate\(790.9658966064453%2C%2087.98295211791992\)%22%20data-id%3D%22E%22%20data-node%3D%22true%22%20id%3D%22flowchart-E-7%22%20class%3D%22node%20default%20default%20flowchart-label%22%3E%3Cpolygon%20style%3D%22%22%20transform%3D%22translate\(-76.16477012634277%2C76.16477012634277\)%22%20class%3D%22label-container%22%20points%3D%2276.16477012634277%2C0%20152.32954025268555%2C-76.16477012634277%2076.16477012634277%2C-152.32954025268555%200%2C-76.16477012634277%22%3E%3C%2Fpolygon%3E%3Cg%20transform%3D%22translate\(-37.17329406738281%2C%20-23.99147605895996\)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%3E%3C%2Frect%3E%3CforeignObject%20height%3D%2247.98295211791992%22%20width%3D%2274.34658813476562%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22nodeLabel%22%3ERT%2F%E6%88%90%E5%8A%9F%E7%8E%87%3Cbr%2F%3E%E8%BE%BE%E6%A0%87%3F%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate\(1012.464469909668%2C%2031.49147605895996\)%22%20data-id%3D%22F%22%20data-node%3D%22true%22%20id%3D%22flowchart-F-9%22%20class%3D%22node%20default%20default%20flowchart-label%22%3E%3Crect%20height%3D%2262.98295211791992%22%20width%3D%22158.6505584716797%22%20y%3D%22-31.49147605895996%22%20x%3D%22-79.32527923583984%22%20ry%3D%220%22%20rx%3D%220%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%3E%3C%2Frect%3E%3Cg%20transform%3D%22translate\(-71.82527923583984%2C%20-23.99147605895996\)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%3E%3C%2Frect%3E%3CforeignObject%20height%3D%2247.98295211791992%22%20width%3D%22143.6505584716797%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22nodeLabel%22%3E%E6%8C%82%E8%BD%BD%E5%88%B0%20ConfigServer%3Cbr%2F%3E%E5%BC%80%E5%A7%8B%E6%8E%A5%E6%B5%81%E9%87%8F%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate\(1012.464469909668%2C%20144.47442817687988\)%22%20data-id%3D%22G%22%20data-node%3D%22true%22%20id%3D%22flowchart-G-11%22%20class%3D%22node%20default%20default%20flowchart-label%22%3E%3Crect%20height%3D%2262.98295211791992%22%20width%3D%22111.0085220336914%22%20y%3D%22-31.49147605895996%22%20x%3D%22-55.5042610168457%22%20ry%3D%220%22%20rx%3D%220%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%3E%3C%2Frect%3E%3Cg%20transform%3D%22translate\(-48.0042610168457%2C%20-23.99147605895996\)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%3E%3C%2Frect%3E%3CforeignObject%20height%3D%2247.98295211791992%22%20width%3D%2296.0085220336914%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22nodeLabel%22%3E%E9%A2%84%E7%83%AD%E6%8A%A5%E5%91%8A%E6%A0%87%E7%BA%A2%3Cbr%2F%3E%E9%98%BB%E6%96%AD%E4%B8%8A%E7%BA%BF%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate\(1226.7755432128906%2C%20200.0568141937256\)%22%20data-id%3D%22H%22%20data-node%3D%22true%22%20id%3D%22flowchart-H-13%22%20class%3D%22node%20default%20default%20flowchart-label%22%3E%3Crect%20height%3D%2238.99147605895996%22%20width%3D%22169.97158813476562%22%20y%3D%22-19.49573802947998%22%20x%3D%22-84.98579406738281%22%20ry%3D%220%22%20rx%3D%220%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%3E%3C%2Frect%3E%3Cg%20transform%3D%22translate\(-77.48579406738281%2C%20-11.99573802947998\)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%3E%3C%2Frect%3E%3CforeignObject%20height%3D%2223.99147605895996%22%20width%3D%22154.97158813476562%22%3E%3Cdiv%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%3E%3Cspan%20class%3D%22nodeLabel%22%3E%E6%8E%92%E6%9F%A5%20JIT%2F%E8%BF%9E%E6%8E%A5%E6%B1%A0%2F%E4%BE%9D%E8%B5%96%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E)

### 8.3 tms-tns 实际预热用例参考

`tms-tns`（CES-运输卡班）的预热实践是海外域内可参考的样板，主要动作：检查插件的安装 + 启动脚本增加预热命令。这两步在发布规范里对应"灰度时长核心应用至少 60 分钟"的红线——预热没跑完不允许接流量。

## 九、测试视角：我要关注什么

结合我墨西哥 TT 质量保障岗位，HSF 相关的测试关注点整理如下：

### 9.1 一致性校验里的 HSF 边界

`order-consistency-verify` skill 里已经涉及多处 HSF 调用：

- LDS 分单：`lds → cnl-fulfill-oms` 发起重计划走 HSF1（大包维度），返回分单结果。
- LDS 查三段码：`lds → cnl-fulfill-oms → cnl-routing-na` 走 HSF1 查三段码 by resCode。
- 换配链路：`cngoverseasoms → cnlfulfillcenter` 调 Apollo 接口查是否 B 类订单、查履行日志，`cngoverseasoms → lds` 调 LDS 接口取消包裹和任务。

测试要点：HSF 超时会导致重复调用（如 Freelancer 资损场景"HSF 超时重复发起支付"），一致性校验时必须考虑幂等性——同一 LP98 可能因为重试产生多条 HSF 调用记录，不能简单按"出现次数"判定。

### 9.2 HSF 相关的常见故障模式

| 故障模式 | 根因 | 排查工具 |
| --- | --- | --- |
| 服务地址找不到 `HSF-0001` | ConfigServer 订阅失败 / 服务未发布 / 组别版本不匹配 | HSFOPS 查服务地址列表 |
| 调用超时 `HSFTimeOutException` | 服务端慢 / 网络抖动 / 线程池满 | EagleEye traceId 反查、Sunfire 监控 |
| 消费端线程池满 | `consumerMaxPoolSize` 配置过小 / 下游慢 | 应用日志 grep "消费端线程池已满" |
| 序列化失败 | Hessian 对 `NullPointerException`、无参构造函数缺失的对象支持差 | 切换 Kryo 或补无参构造 |
| 配置覆盖踩坑 | `application.properties` 全局值覆盖注解默认值 | 用 `${}` placeholder 显式声明 |
| 预热未完成就接流量 | 启动脚本漏配预热命令 | HSFOPS 预热报告 |
| 重试导致重复计费 | 超时重试 + 下游非幂等 | 加去重表 / 下游做幂等 |

### 9.3 HSF 相关的测试用例设计模式

模式 1：Mock 拦截测试——用 `hsf.plugin.octopus` 配置 mock 规则，在不依赖真实下游的情况下验证调用方逻辑。适合做异常分支覆盖（下游超时、返回异常、返回 null）。

模式 2：一致性哈希验证——如果服务配置了 `consistent` 参数，要验证相同 key 的请求是否稳定路由到同一台 server。这在分单、波次分配等场景很关键。

模式 3：广播模式验证——`isBroadcast=true` 时会调用地址列表全部 server，要验证每台都收到请求且响应都被处理。缓存刷新、配置推送类接口常用。

模式 4：切流标 + HSF 联动——0310 美国 LDS 司机端无法领件故障的教训是：切流标（Tair）决定走新链路还是老链路，而新老链路的 HSF 服务名/组别可能不同。测试时必须覆盖"切流标丢失/延迟"场景下的 HSF 调用降级路径。

模式 5：跨机房 HSF 调用——北美美东机房 + Apollo2 美东机房两个域之间有 HSF 调用，要验证跨机房延迟、单元化路由（`UnitService`）是否正确。

### 9.4 HSFOPS 常用入口

| 入口 | URL | 用途 |
| --- | --- | --- |
| 服务查询（日常） | `hsf.alibaba.net/hsfops/serviceSearch.htm?envType=daily` | 查服务地址、提供者、消费者 |
| 服务治理 | `hsf.alibaba.net/hsfops/serviceSearch.htm?envType=daily` | 配置路由/归组/权重规则 |
| 预热 Case（新版） | `hsf.alibaba-inc.com/hsfops/v2/warmup/case` | 创建/管理预热 Case |
| 预热报告 | `hsf.alibaba-inc.com/hsfops/warmup/report.htm?id=xxx` | 查看预热执行结果 |

中
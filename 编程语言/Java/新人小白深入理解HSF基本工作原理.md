---
title: "新人小白深入理解HSF基本工作原理"
source: "https://ata.atatech.org/articles/11020474070?spm=ata.23639420.0.0.15527536rhsaS7#ZDBkZDI5"
author:
published:
created: 2026-05-12
description:
tags:
  - "clippings"
---
2025-09-24发表1.0k浏览






使用版本：

pandora: `2024-04-release`

hsf: `3.1.23`

在日常业务研发中，我们都会使用到HSF RPC框架，对于我们使用方来说，我们只需要通过注解即可实现RPC远程调用能力，甚至其注册中心使用的都是默认的，对于使用方来说是极其方便的。我在使用的过程中有过以下几个疑问：

- `@HSFProvider` 为什么这个注解就能将服务注册到HSF注册中心上？

- `@HSFConsumer` 在某一个具体字段上通过对属性添加该注解，为什么就能实现调用远程对应的能力？

- 注册中心地址是如何发现的？

- HSF以超高性能在多次双11中经历过验证，那么其底层通信协议是什么样的？

- HSF异步能力是如何支持的，其对于线程是如何巧妙的进行使用的？

而正是由于上面的几个问题驱动，而我才会去静下心来去翻翻HSF的源码，自己去寻找这几个答案，而这篇记录则主要分享下自己是如何一步一步的找到自己心之所想的答案的。

## 一、测试代码用例

RPC接口实现：

@HSFProvider

```java
public class HelloWordImpl implements HelloWord {
    @Override
    public String hello(String context) {
        return "HSF RPC Hello:" + context;
    }
}
```

@Resource

```java
private HelloWord helloWord;
@GetMapping("/")
public @ResponseBody String index(){
    return this.helloWord.hello("tala");
}
```

相关依赖：

<!-- service服务 -->

```xml
<dependency>
<groupId>com.alibaba.boot</groupId>
<artifactId>pandora-hsf-spring-boot-starter</artifactId>
</dependency>
```

<!-- 最外层Pom：用来下载hsf资源包，进行DEBUG分析 -->

```xml
<dependency>
<groupId>com.taobao.hsf</groupId>
<artifactId>hsf-all</artifactId>
<version>3.1.23</version>
</dependency>
```

测试结果：

![[51397664-29cd-4e07-a50b-50da32314dcb.png]] ![[ecc11ff6-67d4-426e-a73f-cfa025dc2214.png]]

## 二、HSFProvider注解实现原理

![[c3b0a705-3c77-4bc6-bf99-08cf249d0be8.png]]

### 1.1 注解HSFPorvider

1. 接口

![[098e2430-c821-41cc-a859-a76b781bc04f.jpeg]]

为了能够在分析工作原理时通过DEBUG其上下文进行详细梳理，分析建立在pandora工程上进行DEBUG分析。

首先，我们看下 `HSFProvider` 注解声明：

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Component
@Import(HsfProviderAnnotationRegistrar.class)
public @interface HSFProvider {
    Class<?> serviceInterface() default Object.class;
    String serviceVersion() default Constants.DEFAULT_VERSION;
    String serviceGroup() default Constants.DEFAULT_GROUP;
    String serviceName() default "";
    int clientTimeout() default -1;
    int corePoolSize() default 0;
    String corePoolSizeStr() default "";
    int maxPoolSize() default 0;
    String maxPoolSizeStr() default "";
    //...
}
```

对于学习过Spring IOC加载的同学应该知道，在执行加载Bean时（实例化BeanDefinition），会判断其类上是否有注解 `@Import` ，并且其中的注解类是否有实现接口： `ImportBeanDefinitionRegistrar` 如果满足这个条件，那么就会动态的注册相关的Bean到IOC容器中，之后IOC则会去加载和实例化其对应的BeanDefinition。

Import工作原理详情：

此处为语雀内容卡片，点击链接查看： [https://aliyuque.antfin.com/mazhenxin.mzx/ux4n5m/oqoyxffpth7h3z81](https://aliyuque.antfin.com/mazhenxin.mzx/ux4n5m/oqoyxffpth7h3z81)

### 1.2 registerBeanDefinitions函数实现

在pandora框架中，类 `HsfProviderAnnotationRegistrar` 实现了Spring接口： `IpmortBeanDefinitionRegistrar` ，配合Import来完成Bean的手动注册，我们来具体看下函数实现：

```java
public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata, BeanDefinitionRegistry registry) {
    HsfProperties hsfProperties = HsfPropertiesUtils.buildHsfProperties(environment);
    if (!hsfProperties.isEnabled()) {
        if (logger.isDebugEnabled()) {
            logger.debug("spring.hsf.enabled is false, so skip process @HSFProvider");
        }
        return;
    }

    // 处理 @HSFProvider ，然后产生bean定义
    String targetBeanName = BeanNameUtils.beanName(importingClassMetadata, registry);
    // helloWordImpl#HSFProvider 
    String beanName = targetBeanName + Constants.GENERATE_HSFPROVIDERBEAN_SUFFIX;
    
    String className = importingClassMetadata.getClassName();
    Class<?> targetClass;
    try {
        targetClass = this.classLoader.loadClass(className);

        HSFProvider hsfProvider = AnnotationUtils.findAnnotation(targetClass, HSFProvider.class);

        configIfNecessary(hsfProperties);

        HsfProviderBeanDefinitionBuilder builder = new HsfProviderBeanDefinitionBuilder(targetBeanName, hsfProvider)
        .clazz(targetClass)
        .properties(hsfProperties);

        // HSFSpringProviderBean
        BeanDefinition beanDefinition = builder.build(registry);

        if (beanDefinition != null) {
            if (registry.containsBeanDefinition(beanName)) {
                throw new BeanDefinitionValidationException(
                    "BeanDefinition with the same beanName already existed, please check your config! beanName:"
                    + beanName);
            }
            registry.registerBeanDefinition(beanName, beanDefinition);
            logger.info("[HSF Starter] register HSF provider bean: {}, targetClass: {}", beanName, className);
        }
    } catch (ClassNotFoundException e) {
        throw new BeanCreationException("create hsf provider bean error! beanName:" + beanName, e);
    }
}
```
```java
public final class HSFSpringProviderBean implements InitializingBean, ApplicationContextAware, ApplicationListener {
    @Override
    public void afterPropertiesSet() throws Exception {
        // 执行HSFProvider注解标识的类的初始化。
        init();
    }
}
```

我们通过时序图来梳理下这个流程：

![[ff8682c0-2e5c-4c2b-8479-dce5e4a02fbc.svg]]

### 1.3 HSF标注的RPC接口如何注册到控制中心

紧接着上文，我们知道当我们在我们的Application中通过注解 `@HSFProvider` 声明一个RPC服务时，其都会通过 `HsfProviderAnnotationRegistrar` 针对该注解声明一个 `BeanDenefition` 到IOC容器中，之后在Sprign初始化完该Bean所对应的基础属性之后，会执行 `InitializingBean` 所预留的扩展接口，而HSF服务发布正是在该入口内执行发布到注册中心供消费者来进行消费。

![[92bf4982-c1c3-40ca-81c4-bb7bc7ae68f3.png]]

我们来看下具体的实现逻辑代码：

```java
@Override
public void afterPropertiesSet() throws Exception {
    init();
}
/**
```


```java
*/
public void init() throws Exception {
    // 避免被初始化多次
    if (!inited.compareAndSet(false, true)) {
        return;
    }
    AppInfoUtils.handleProviderBeanInit(providerBean.getUniqueServiceName());
    providerBean.initWithoutPub();
    // 重点：Spring环境下，并不会在这里进行发布。
    publishIfNotInSpringContainer();
}
```

有一个小重点，在Spring容器环境下，并不会在init中直接进行服务发布，而是通过后续的事件通知机制来去实现的。这里重点我们直接看其如何发布的。

通过上面的分析，我们已经知道每一个 `@HSFProvider` 注解在Spring环境下都会被包装成一个 `HSFSpringProviderBean` 并交给Spring管理，那么我们可以重点从这个类出发，其实现了 `InitializingBean` 接口，同时又实现了 `ApplicationContextAware` 接口，而在该接口内的实现内，其又向Spring注册了一个监听器，

public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {

if (applicationContext instanceof AbstractApplicationContext) {

(...)

```java
// 注册一些Bean
DubboSpringUtils.registerDubboBeans((AbstractApplicationContext) applicationContext, providerBean.getModuleModel());
}
}
// registerDubboBeans 注册Dubbo的一些Bean
public static void registerDubboBeans(AbstractApplicationContext applicationContext, ModuleModel moduleModel) {
    ConfigurableListableBeanFactory beanFactory = applicationContext.getBeanFactory();
    if (!springContainsBean(applicationContext, HSFConstants.HSF_MODULE_SPRING_BEAN)) {
        beanFactory.registerSingleton(HSFConstants.HSF_MODULE_SPRING_BEAN, moduleModel);
    }
    registerApplicationListener(applicationContext);
}
// 注册上下文，如果上下文中不存在对应的ApplicationListener
private static void registerApplicationListener(AbstractApplicationContext applicationContext) {
    // beanName HSFDubboApplicationListener
    String beanName = HSFDubboApplicationListener.class.getName();
    // 判断Spring上下文中是否存在要添加的监听器，如果存在则不需要重复添加
```

(...)

try {

(...)

```java
HSFDubboApplicationListener listener = new HSFDubboApplicationListener();
applicationContext.getBeanFactory().initializeBean(listener, beanName);
// [重要] 注册ApplicationListener事件
applicationContext.addApplicationListener(listener);
} catch (Throwable e) {
}
}
```

基于此，针对 `HSFDubboApplicationListener` 我们已经添加到Spring容器中了，我们来看下监听事件回调。

我们看下 `HSFDubboApplicationListener` 具体实现：

```java
public class HSFDubboApplicationListener implements ApplicationListener<ApplicationContextEvent> {
    @Override
    public void onApplicationEvent(ApplicationContextEvent event) {
        if (event instanceof ContextRefreshedEvent) {
            // Spring上下文准备就绪通知事件[服务发布就是在该流程进行对外发布]
            onContextRefreshed(event);
        } else if (event instanceof ContextClosedEvent) {
            // Spring上下文关闭通知事件
            onContextClosed(event);
        }
    }
}
```

我们知道，Srping在其上下文准备就绪后，则会找到其所有实现了接口 `ApplicationListener` 的类来执行具体的时间通知回调逻辑，而在HSF接口发布里，当Spring整个上下文准备就绪后，则会执行其对应的回调函数逻辑，而HSF的服务发布逻辑就是在这个回调逻辑中进行发布的。

我们看下具体的时间通知回调逻辑：

```java
// 准备服务发布.
private void onContextRefreshed(ApplicationContextEvent event) {
    if (event.getApplicationContext().containsBean(HSFConstants.HSF_MODULE_SPRING_BEAN)) {
        // ModuleModel 可以理解为一个Model(模块)的模型，其组合了该Module下的基本能力组件
        // HSF_MODULE_SPRING_BEAN 这个在之前已经注册到IOC容器中了
        ModuleModel moduleModel = event.getApplicationContext().getBean(HSFConstants.HSF_MODULE_SPRING_BEAN, ModuleModel.class);
        // start module[重要]，异步启动当前Module.而所有服务注发布都是在该异步函数内执行发布的。
        Future future = moduleModel.getDeployer().start();
        // if the module does not start in background, await finish
        if (!moduleModel.getDeployer().isBackground()) {
            try {
                future.get();
            } catch (InterruptedException e) {
                LoggerWrapper.LOGGER.warn("Interrupted while waiting for hsf module startup: " + e.getMessage());
            } catch (Exception e) {
                LoggerWrapper.LOGGER.warn("An error occurred while waiting for hsf module startup: " + e.getMessage(), e);
            }
        }
    }
}
```

我们直接看重点：

```java
// 该函数是模块Dpeloy的start函数实现，用于启动Module。
// 而在HSF中，这里的Module则是HSF Server以及各个HSFPorvider。
public Future start() throws IllegalStateException {
    // initialize，maybe deadlock applicationDeployer lock & moduleDeployer lock
    applicationDeployer.initialize();
    // 同步启动，我们进去之后，则会发现其中的秘密
    return startSync();
}
private synchronized Future startSync() throws IllegalStateException {
```

(...) // 省略了一些不相关的代码

try {

(...)

```java
// 重点，重点，重点，对外发布服务
exportServices();
// prepare application instance
// exclude internal module to avoid wait itself
if (moduleModel!= moduleModel.getApplicationModel().getInternalModule()) {
    applicationDeployer.prepareInternalModule();
}
// refer services
referServices();
```

(...) //wait阻塞等待所有的异步操作，比如异步发布

```java
} catch (Throwable e) {
onModuleFailed(getIdentifier() + " start failed: " + e, e);
throw e;
}
return startFuture;
}
```

在上面的 `startSync` 函数内，我们可以明确的知道，通过注解 `@HSFProvider` 所声明的RPC服务则会在 `exportServices` 函数内对外（注册中心）执行发布。

```java
private void exportServices() {
    // 遍历所有的HSF服务，执行发布
    for (ServiceConfigBase sc: configManager.getServices()) {
        exportServiceInternal(sc);
    }
}
// 发布
private void exportServiceInternal(ServiceConfigBase sc) {
    ServiceConfig<?> serviceConfig = (ServiceConfig<?>) sc;
```

(...) // 检查是否已发布

```java
// 默认这里的发布是同步进行发布的，而是否异步由上一步我们是否配置来决定。

if (exportAsync || sc.shouldExportAsync()) {

    // 这里的异步通过CmopletableFuture来实现，调用的函数都是export
```

(...) // 省略

```java
} else {
if (!sc.isExported()) {
    // 发布
    sc.export();
    exportedServices.add(sc);
}
}
}
```

我们来看看其具体的实现发布逻辑：

// 无相关逻辑已删

public void export() {

(...)

synchronized (this) {

(...)

```java
if (this.shouldExport()) {
    // 初始化元信息，比如版本号、分组，以及interface等。
    this.init();
    // 发布
    doExport();
}
}
}
protected synchronized void doExport() {
```

(...)

```java
// 服务发布
path = interfaceName;
// 发布URL?
doExportUrls();
// 修改状态？
exported();
}
```

上面已经分析到，我们会循环遍历到每一个 `ServiceConfigBase` ，而这个类也就 `HSFProvider` 所表示的服务类，现在，我们就要去发布注解 `@HSFProvider` 所表示的服务了。

```java
private void doExportUrls() {
    ModuleServiceRepository repository = getScopeModel().getServiceRepository();
    // HSF服务描述符：表述了当前服务下的函数的集合信息
    serviceDescriptor = repository.registerService(getInterfaceClass());
    // 本次要进行发布的ProviderModel
providerModel = new ProviderModel(serviceMetadata.getServiceKey(),
ref,
serviceDescriptor,
getScopeModel(),
serviceMetadata, interfaceClassLoader);
// Compatible with dependencies on ServiceModel#getServiceConfig(), and will be removed in a future version
providerModel.setConfig(this);
providerModel.setDestroyRunner(getDestroyRunner());
repository.registerProvider(providerModel);
// 注册URL，这里
List<URL> registryURLs = ConfigValidationUtils.loadRegistries(this, true);
// 根据ProtocolConfig来对外进行注册
for (ProtocolConfig protocolConfig: protocols) {
    String pathKey = URL.buildKey(getContextPath(protocolConfig)
        .map(p -> p + "/" + path)
        .orElse(path), group, version);
    // stub service will use generated service name
    // 这里的PathKey，就是我们在HSF控制台上看到的服务名
    if (!serverService) {
        // In case user specified path, register service one more time to map it to path.
        repository.registerService(pathKey, interfaceClass);
    }
    // 发布[重要]
    doExportUrlsFor1Protocol(protocolConfig, registryURLs);
}
providerModel.setServiceUrls(urls);
}
```

`pathKey` 就是我们日常见到的HSF服务名称

![[5c868b6d-6dfc-4d12-a1ff-f909b507b481.png]]

ReflectionServiceDescriptor：HSF服务描述符，描述了当前HSF服务拥有的Method等。

同理，其对应的Method描述符：其重新封装Method的一层表达含义。

整体注册时序图

![[d142522a-934b-42d5-b00b-2132668d2dcb.svg]] ![[a70910b0-21ca-4fa5-b135-590efe43fbc5.png]] ![[37a8f632-873c-421a-acb1-0d356c3cedea.svg]]

### 1.4 ConfigServer地址是如合发现的

[http://jmenv.tbsite.net:8080/configserver/serverlist](http://jmenv.tbsite.net:8080/configserver/serverlist)

1. HSFPorvider指定注册中心

2. 环境变量

3. Java -D参数指定

4. CENTER 环境标不对

```java
class GetServerListTask implements Runnable {
    @Override
    public void run() {
        try {
            updateIfChanged(getApacheServerList());
        } catch (Exception e) {
            log.error("%s", "[serverlist] failed to get serverlist, " + e.toString(), e);
        }
    }
}
public static String addressServerUrl(String center, String layer) {
    // domain=jmenv.tbsite.net:8080
    String domain = ConfigClientSetting.getAddressServerDomain() + ":" + ConfigClientSetting.getAddressServerPort();
    String layerUrl = "";
    if(StringUtils.isNotBlank(layer) &&!layer.equals(ConfigClientConstants.LAYER_CLUSER_LOCAL)){
        layerUrl = "-"+layer;
    }
```

url = http://jmenv.tbsite.net:8080/configserver/serverlist-

```java
String url = "http://" + domain + "/configserver"+layerUrl+"/serverlist";
if (center!= null && (!center.equals("default")) && (!center.equals(LocalConfigInfo.DEFAULT_ENV))) {
    url = url + "-" + center + "?nofix=1";
    if (StringUtils.isNotBlank(labelsString)) {
        url = url + "&labels=" + labelsString;
    }
} else {
    if (StringUtils.isNotBlank(labelsString)) {
        url = url + "?labels=" + labelsString;
    }
}
return url;
}
```

## 三、HSFConsumer注解实现原理

HsfConsumerPostProcessor

HsfConsumerAutoConfiguration

HSFNewInvoker 消费者执行调用时，具体执行调用

ReferenceBeanBuilder

![[a4fa4054-b4db-4e05-9ff5-b0021b0a84da.svg]]

ConfigClient

先进行订阅获取到服务器上的服务地址

然后Invoker.invoke时，通过LoadBalacne哈希选择。

1. MockClusterInvoker(Invoker)，如果没有Mcok数据，则远程调用Invoke

2. 调用Invoker时，直接调用抽象类AbstractClusterInvoker的invoke，在父类会直接调用一系列的Filter以及拦截器等。

3. 最终执行远程调用：AbstractClusterInvoker，最终会调用该类的Invoke进行调用

### 3.2 负载均衡机制

几种支持的负载均衡机制

@startumlinterface LoadBalance{ <T> Invoker<T> select(List<Invoker<T>> invokers, URL url, Invocation invocation)}class WeightLoadBalancer{ // 权重负载均衡}class RandomLoadBalance{}class ConsistentHashLoadBalancer{ }LoadBalance <|-- WeightLoadBalancerLoadBalance <|-- RandomLoadBalanceLoadBalance <|-- ConsistentHashLoadBalancer@enduml

#### 3.2.1 加权随机负载

A: 5

B：10

C：15

![[9efbd793-9077-402b-92f7-aea53f448df7.jpeg]]

```java
ReferenceBeanBuilder ConfigClient 先进行订阅获取到服务器上的服务地址 然后Invoker.invoke时，通过LoadBalacne哈希选择。 MockClusterInvoker(Invoker)，如果没有Mcok数据，则远程调用Invoke 调用Invoker时，直接调用抽象类AbstractClusterInvoker的invoke，在父类会直接调用一系列的Filter以及拦截器等。 最终执行远程调用：AbstractClusterInvoker，最终会调用该类的Invoke进行调用 3.2 负载均衡机制 几种支持的负载均衡机制 @startumlinterface LoadBalance{ <T> Invoker<T> select(List<Invoker<T>> invokers, URL url, Invocation invocation)}class WeightLoadBalancer{ // 权重负载均衡}class RandomLoadBalance{}class ConsistentHashLoadBalancer{ }LoadBalance <|-- WeightLoadBalancerLoadBalance <|-- RandomLoadBalanceLoadBalance <|-- ConsistentHashLoadBalancer@enduml 3.2.1 加权随机负载 A: 5 B：10 C：15 public class RandomLoadBalance extends AbstractLoadBalance {

    public static final String NAME = "random";

    /**
     * Select one invoker between a list using a random criteria
     *
     * @param invokers   List of possible invokers
     * @param url        URL
     * @param invocation Invocation
     * @param <T>
     * @return The selected invoker
     */
    @Override
        protected <T> Invoker<T> doSelect(List<Invoker<T>> invokers, URL url, Invocation invocation) {
        // Number of invokers
        int length = invokers.size();

        if (!needWeightLoadBalance(invokers, invocation)) {
            return invokers.get(ThreadLocalRandom.current().nextInt(length));
        }

        boolean sameWeight = true;
        // the maxWeight of every invokers, the minWeight = 0 or the maxWeight of the last invoker
        int[] weights = new int[length];
        // The sum of weights
        int totalWeight = 0;
        for (int i = 0; i < length; i++) {
            int weight = getWeight(invokers.get(i), invocation);
            // Sum
            totalWeight += weight;
            // save for later use
            weights[i] = totalWeight;
            if (sameWeight && totalWeight != weight * (i + 1)) {
                sameWeight = false;
            }
        }
        if (totalWeight > 0 && !sameWeight) {
            // If (not every invoker has the same weight & at least one invoker's weight>0), select randomly based on totalWeight.
            int offset = ThreadLocalRandom.current().nextInt(totalWeight);
            // 加权随机，判断当前生成的随机数在当权重表中的那个位置，从而获取对应位置的Invoker
            for (int i = 0; i < length; i++) {
                if (offset < weights[i]) {
                    return invokers.get(i);
                }
            }
        }
        // If all invokers have the same weight value or totalWeight=0, return evenly.
        return invokers.get(ThreadLocalRandom.current().nextInt(length));
    }

}
```
#### 3.2.2 一致性哈希

一致性哈希（重要）

![[23ffd6cf-4c30-49dc-bc92-eba2fbe54525.jpeg]]

```java
public class ConsistentHashLoadBalancer implements LoadBalance {
    private static final Logger LOGGER = LoggerInit.LOGGER_CONFIG;

    private static final String VIRTUAL_NODE_SIZE = "hsf.loadbalance.consistenthash.virtaulnodesize";
    private static final String CONSISTENT_HASH_STRATEGY = "hsf.loadbalance.consistenthash.strategy";

    private static final int VIRTUAL_NODE_DEFAULT_SIZE = 10;
    private static final String VIRTUAL_NODE_SPLITER = "@";
    private static final String LOCATOR_SUBFIX = ".ND";

    private HashStrategy hashStrategy;

    public ConsistentHashLoadBalancer() {
        String hashStrategy = ConfigurationUtils.getProperty(ModelManager.getMainModule(), CONSISTENT_HASH_STRATEGY, "murmur");

        ExtensionLoader extensionLoader = ModelManager.getMainModule().getExtensionLoader(HashStrategy.class);
        if (extensionLoader.hasExtension(hashStrategy)) {
            this.hashStrategy = (HashStrategy) extensionLoader.getExtension(hashStrategy);
        } else {
            LOGGER.warn("[ConsistentHashLoadBalancer] the hash strategy [" + hashStrategy + "] is not support, please check the config -D" + CONSISTENT_HASH_STRATEGY + ",use default hash strategy murmurhash.");
            this.hashStrategy = (HashStrategy) extensionLoader.getExtension("murmur");
        }
    }

    @Override
    public <T> Invoker<T> select(List<Invoker<T>> invokers, URL url, Invocation invocation) throws RpcException {
        if (emptyAddress(invokers)) {
            return null;
        }
        if (invokers.size() == 1) {
            return invokers.get(0);
        }

        ConsumerModel consumerModel = ModelUtil.getConsumerModel(invocation);
        String consistentKey = (String) consumerModel.getServiceMetadata().getAttribute(CONSISTENT_KEY);

        String locator = null;
        if (null != consistentKey && !consistentKey.isEmpty() && !consistentKey.equals(Boolean.TRUE.toString())) {
            //seed specified key user
            locator = ThreadLocalUtil.get(consistentKey);
        } else {
            //TODO ok with this?
            locator = HSFConfigs.getPubHost();
        }


        if (null == locator || locator.isEmpty()) {
            throw new IllegalArgumentException("See http://gitlab.alibaba-inc.com/middleware/hsf2-0/wikis/consistent_hash");
        }

        locator += LOCATOR_SUBFIX;
        Integer locatorSeed = hashStrategy.getHashCode(locator);
        // 构建哈希环
        TreeMap<Integer, Invoker<T>> ketamaMap = buildMap(invokers);
        // 
        Integer key = locate(locatorSeed, ketamaMap);
        return ketamaMap.get(key);
    }

    <T> Integer locate(Integer seed, TreeMap<Integer, Invoker<T>> ketamaMap) {
        Integer ret = seed;
        if (!ketamaMap.containsKey(seed)) {
            SortedMap<Integer, Invoker<T>> tailMap = ketamaMap.tailMap(seed);
            if (tailMap.isEmpty()) {
                ret = ketamaMap.firstKey();
            } else {
                ret = tailMap.firstKey();
            }
        }
        return ret;
    }

    <T> TreeMap<Integer, Invoker<T>> buildMap(List<Invoker<T>> invokers) {
        int virtualNodeSize = Integer.parseInt(ConfigurationUtils.getProperty(ModelManager.getMainModule(), VIRTUAL_NODE_SIZE, VIRTUAL_NODE_DEFAULT_SIZE + ""));
        TreeMap<Integer, Invoker<T>> ketamaMap = new TreeMap<Integer, Invoker<T>>();
        for (Invoker<T> invoker : invokers) {
            for (int i = 0; i < virtualNodeSize; i++) {
                //TODO annoying fullURL
                ketamaMap.put(hashStrategy.getHashCode(invoker.getUrl().getAddress() + VIRTUAL_NODE_SPLITER + i), invoker);
            }
        }
        return ketamaMap;
    }
}
```
## 四、HSF通信协议结构

### 4.1 HSFRequest 请求协议

header？

```java
static Packet decodeRequest(ByteBufferWrapper wrapper, final int originPos) {
    if (wrapper.readableBytes() < REQUEST_HEADER_LEN - 2) {
        wrapper.setReaderIndex(originPos);
        return null;
    }
    byte codecType = wrapper.readByte();
    byte[] extendBytes = new byte[3];
    wrapper.readBytes(extendBytes);
    long requestId = wrapper.readLong();
    int timeout = wrapper.readInt();
    int targetInstanceLen = wrapper.readInt();
    int methodNameLen = wrapper.readInt();
    int argsCount = wrapper.readInt();
    int argInfosLen = argsCount * 4 * 2;
    int expectedLenInfoLen = argInfosLen + targetInstanceLen + methodNameLen + 4;
    int size = expectedLenInfoLen;
    if (wrapper.readableBytes() < expectedLenInfoLen) {
        wrapper.setReaderIndex(originPos);
        return null;
    }
    int expectedLen = 0;
    int[] argsTypeLen = new int[argsCount];
    for (int i = 0; i < argsCount; i++) {
        argsTypeLen[i] = wrapper.readInt();
        expectedLen += argsTypeLen[i];
    }
    int[] argsLen = new int[argsCount];
    for (int i = 0; i < argsCount; i++) {
        argsLen[i] = wrapper.readInt();
        expectedLen += argsLen[i];
    }
    int requestPropLength = wrapper.readInt();
    expectedLen += requestPropLength;
    byte[] targetInstanceByte = new byte[targetInstanceLen];
    wrapper.readBytes(targetInstanceByte);
```

### 4.2 HSFResponse 响应协议

+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+

| BYTE | | | | | | | | | | | | | | | |

+--------------------------------------------+--------+-----------------+--------+--------+--------+--------+--------+--------+-----------------+

| 0x0E | 1 | resp | status |ser type| extends bytes | request id |

+--------+-----------------------------------------------------------------------------------------+--------------------------------------------+

| payload length | | |

+--------------------------------------------------------------------------------------------------------------------------------------+--------+

| PAYLOAD |

+-----------------------------------------------------------------------------------------------------------------------------------------------+

```java
static void encodeResponse(HSFResponsePacket responsePacket, ByteBufferWrapper byteBufferWrapper) {
    int capacity = RESPONSE_HEADER_LEN + responsePacket.getBody().length;
    byteBufferWrapper.ensureCapacity(capacity);
    byteBufferWrapper.writeByte(RemotingConstants.PROTOCOL_VERSION_HSF_REMOTING);
    byteBufferWrapper.writeByte(VERSION);
    byteBufferWrapper.writeByte(RESPONSE);
    byteBufferWrapper.writeByte(responsePacket.status());
    byteBufferWrapper.writeByte(responsePacket.serializeType());
    byteBufferWrapper.writeBytes(responsePacket.getExtendBytes());
    byteBufferWrapper.writeLong(responsePacket.requestId());
    byteBufferWrapper.writeInt(responsePacket.getBody().length);
    byteBufferWrapper.writeBytes(responsePacket.getBody());
}
```

### 4.3 心跳包

+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+

| BYTE | | | | | | | | | | | | | | | |

+--------------------------------------------+--------+-----------------+--------+--------+--------+--------+--------+--------+-----------------+

| 0x0C | req | 1 | 0 | 0 | 0 | request id | 0 | 0 |

+--------+-----------------------------------------------------------------------------------------+--------------------------------------------+

| 0 | 0 | |

+--------------------------------------------------------------------------------------------------------------------------------------+--------+

```java
+--------------------------------------------------------------------------------------------------------------------------------------+--------+ public void encode(Packet packet, ByteBufferWrapper byteBufferWrapper) {
        MessageType messageType = packet.messageType();
        switch (messageType) {
            case HeartBeatRequest:
                HSFHeartBeatRequestPacket requestPacket = (HSFHeartBeatRequestPacket) packet;
                byteBufferWrapper.ensureCapacity(CUSTOM_PROTOCOL_HEADER_LEN);
                byteBufferWrapper.writeByte(RemotingConstants.PROTOCOL_VERSION_HEATBEAT);
                byteBufferWrapper.writeByte(REQUEST);
                byteBufferWrapper.writeByte(VERSION);
                byteBufferWrapper.writeByte((byte) 0);
                byteBufferWrapper.writeByte((byte) 0);
                byteBufferWrapper.writeByte((byte) 0);
                byteBufferWrapper.writeLong(requestPacket.requestId());
                byteBufferWrapper.writeInt(RemotingConstants.DEFAULT_TIMEOUT);
                break;
            case HeartBeatResponse:
                HSFHeartBeatResponsePacket responsePacket = (HSFHeartBeatResponsePacket) packet;
                byteBufferWrapper.ensureCapacity(CUSTOM_PROTOCOL_HEADER_LEN);
                byteBufferWrapper.writeByte(RemotingConstants.PROTOCOL_VERSION_HEATBEAT);
                byteBufferWrapper.writeByte(RESPONSE);
                byteBufferWrapper.writeByte(VERSION);
                byteBufferWrapper.writeByte((byte) 0);
                byteBufferWrapper.writeByte((byte) 0);
                byteBufferWrapper.writeByte((byte) 0);
                byteBufferWrapper.writeLong(responsePacket.requestId());
                // keep response equal with request
                byteBufferWrapper.writeInt(0);
                break;
            default:
                //do nothing
                break;
        }
    } 4.4 gorpc 协议 https://github.com/xmopen/gorpc +--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
```
default:

```java
//do nothing
break;
}
}
```

### 4.4 gorpc 协议

[https://github.com/xmopen/gorpc](https://github.com/xmopen/gorpc)

+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+

| BYTE | | | | | | | | | | | | | | | |

+--------------------------------------------+--------+-----------------+--------+--------+--------+--------+--------+--------+-----------------+

|uint8_98|uint8(8)| type | timeout| payload request length | response data length | servicename length |

+--------+-----------------------------------------------------------------------------------------+--------------------------------------------+

| methodname length | | |

+--------------------------------------------------------------------------------------------------------------------------------------+--------+

| PAYLOAD |

+-----------------------------------------------------------------------------------------------------------------------------------------------+

[https://github.com/xmopen/gorpc/blob/master/pkg/pack/encode.go](https://github.com/xmopen/gorpc/blob/master/pkg/pack/encode.go)

package pack

import (

"encoding/binary"

)

// 自定义协议

const (

```java
ProtocolMargic = uint8(98) // 魔数.
ProtocolVersion = uint8(8)
ProtocolIsOne = uint8(0) // 0、非单次请求 1、单次请求.
ProtocolNullFiled = uint32(0) // 协议中为空的属性.
```

)

// RPC Request Type

const (

RPCTypeConnType RpcConnType = iota

RPCTypePeerConnType // 1

)

type RpcConnType = uint8

/*

1\. 向字节数组中写入数据.

```java
// 存长度的时候就这么存.
response:= make([]byte, 0)
binray.BigEndian.PutUint32(response,uint32(13))
*/
// Encode 编码.
// 返回字节指针,避免Copy内存.
func (m *Message) Encode() (*[]byte, error) {
    pl:= len(m.Payload)
    dl:= len(m.Data)
```

## 五、HSF Server异步

![[2bd02685-fb94-4f41-8b25-7ff710ab9d39.jpeg]]

```java
public <T> Exporter<T> export(final Invoker<T> invoker) throws RpcException {
    URL url = invoker.getUrl();
    try {
        String bindIp = url.getParameter(BIND_IP_KEY, url.getHost());
        if (url.getParameter(ANYHOST_KEY, false)) {
            bindIp = ANYHOST_VALUE;
        }
        int bindPort = url.getParameter(BIND_PORT_KEY, url.getPort());
        // 启动Netty服务
        startHSFServer(bindIp, bindPort);
        waitTime = Long.parseLong(ConfigurationUtils.getProperty(url.getScopeModel(), HSF_SHUTHOOK_WAITTIME_KEY, "0"));
        // FIXME: we should inject values from Env into URL from provider bean
        int httpBindPort = url.getParameter(HSFConfigs.HSF_HTTP_BIND_PORT, HSFConfigs.getHttpBindPort());
        if (Boolean.parseBoolean(ConfigurationUtils.getProperty(url.getScopeModel(), Server.HSF_HTTP_ENABLE_KEY, "false"))
        || AppInfoUtils.isEnableHttp()) {
            startHttpServer(bindIp, httpBindPort);
        }
    } catch (Exception e) {
        throw new HSFException("start HSF Server error:", e);
    }
    Exporter<T> exporter = new AbstractExporter<T>(invoker) {
        @Override
        public Invoker<T> getInvoker() {
            return invoker;
        }
        @Override
        public void afterUnExport(){
            HSFRequestProcessor.removeExporter(url.getServiceKey(), this);
        }
    };
```

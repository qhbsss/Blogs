[TOC]

# Spring Boot自动装配

我们现在提到自动装配的时候，一般会和 Spring Boot 联系在一起。但是，实际上 Spring Framework 早就实现了这个功能。Spring Boot 只是在其基础上，通过 SPI 的方式，做了进一步优化。

> SpringBoot 定义了一套接口规范，这套规范规定：SpringBoot 在启动时会扫描外部引用 jar 包中的`META-INF/spring.factories`文件，将文件中配置的类型信息加载到 Spring 容器（此处涉及到 JVM 类加载机制与 Spring 的容器知识），并执行类中定义的各种操作。对于外部 jar 来说，只需要按照 SpringBoot 定义的标准，就能将自己的功能装置进 SpringBoot。
> 自 Spring Boot 3.0 开始，自动配置包的路径从`META-INF/spring.factories` 修改为 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`。

没有 Spring Boot 的情况下，如果我们需要引入第三方依赖，需要手动配置，非常麻烦。但是，Spring Boot 中，我们直接引入一个 starter 即可。比如你想要在项目中使用 redis 的话，直接在项目中引入对应的 starter 即可。

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

引入 starter 之后，我们通过少量注解和一些简单的配置就能使用第三方组件提供的功能了。

在我看来，自动装配可以简单理解为：**通过注解或者一些简单的配置就能在 Spring Boot 的帮助下实现某块功能。**

## 自动装配原理

SpringBoot 的核心注解 `SpringBootApplication` 。

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
<1.>@SpringBootConfiguration
<2.>@ComponentScan
<3.>@EnableAutoConfiguration
public @interface SpringBootApplication {

}

@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Configuration //实际上它也是一个配置类
public @interface SpringBootConfiguration {
}
```

大概可以把 `@SpringBootApplication`看作是 `@Configuration`、`@EnableAutoConfiguration`、`@ComponentScan` 注解的集合。根据 SpringBoot 官网，这三个注解的作用分别是：

- `@EnableAutoConfiguration`：启用 SpringBoot 的自动配置机制
- `@Configuration`：允许在上下文中注册额外的 bean 或导入其他配置类
- `@ComponentScan`：扫描被`@Component` (`@Service`,`@Controller`)注解的 bean，注解默认会扫描启动类所在的包下所有的类 ，可以自定义不扫描某些 bean。如下图所示，容器中将排除`TypeExcludeFilter`和`AutoConfigurationExcludeFilter`。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesbcc73490afbe4c6ba62acde6a94ffdfd%7Etplv-k3u1fbpfcp-watermark.png)

`@EnableAutoConfiguration` 是实现自动装配的重要注解，我们以这个注解入手。

### @EnableAutoConfiguration:实现自动装配的核心注解

`EnableAutoConfiguration` 只是一个简单地注解，自动装配核心功能的实现实际是通过 `AutoConfigurationImportSelector`类。

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@AutoConfigurationPackage //作用：将main包下的所有组件注册到容器中
@Import({AutoConfigurationImportSelector.class}) //加载自动装配类 xxxAutoconfiguration
public @interface EnableAutoConfiguration {
    String ENABLED_OVERRIDE_PROPERTY = "spring.boot.enableautoconfiguration";

    Class<?>[] exclude() default {};

    String[] excludeName() default {};
}
```

我们现在重点分析下`AutoConfigurationImportSelector` 类到底做了什么？

### AutoConfigurationImportSelector:加载自动装配类

`AutoConfigurationImportSelector`类的继承体系如下：

```java
public class AutoConfigurationImportSelector implements DeferredImportSelector, BeanClassLoaderAware, ResourceLoaderAware, BeanFactoryAware, EnvironmentAware, Ordered {

}

public interface DeferredImportSelector extends ImportSelector {

}

public interface ImportSelector {
    String[] selectImports(AnnotationMetadata var1);
}
```

可以看出，`AutoConfigurationImportSelector` 类实现了 `ImportSelector`接口，也就实现了这个接口中的 `selectImports`方法，该方法主要用于**获取所有符合条件的类的全限定类名，这些类需要被加载到 IoC 容器中**。

```java
private static final String[] NO_IMPORTS = new String[0];

public String[] selectImports(AnnotationMetadata annotationMetadata) {
        // <1>.判断自动装配开关是否打开
        if (!this.isEnabled(annotationMetadata)) {
            return NO_IMPORTS;
        } else {
          //<2>.获取所有需要装配的bean
            AutoConfigurationMetadata autoConfigurationMetadata = AutoConfigurationMetadataLoader.loadMetadata(this.beanClassLoader);
            AutoConfigurationImportSelector.AutoConfigurationEntry autoConfigurationEntry = this.getAutoConfigurationEntry(autoConfigurationMetadata, annotationMetadata);
            return StringUtils.toStringArray(autoConfigurationEntry.getConfigurations());
        }
    }
```

这里我们需要重点关注一下`getAutoConfigurationEntry()`方法，这个方法主要负责加载自动配置类的。

该方法调用链如下：

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures3c1200712655443ca4b38500d615bb70%7Etplv-k3u1fbpfcp-watermark.png)

现在我们结合`getAutoConfigurationEntry()`的源码来详细分析一下：

```java
private static final AutoConfigurationEntry EMPTY_ENTRY = new AutoConfigurationEntry();

AutoConfigurationEntry getAutoConfigurationEntry(AutoConfigurationMetadata autoConfigurationMetadata, AnnotationMetadata annotationMetadata) {
        //<1>.
        if (!this.isEnabled(annotationMetadata)) {
            return EMPTY_ENTRY;
        } else {
            //<2>.
            AnnotationAttributes attributes = this.getAttributes(annotationMetadata);
            //<3>.
            List<String> configurations = this.getCandidateConfigurations(annotationMetadata, attributes);
            //<4>.
            configurations = this.removeDuplicates(configurations);
            Set<String> exclusions = this.getExclusions(annotationMetadata, attributes);
            this.checkExcludedClasses(configurations, exclusions);
            configurations.removeAll(exclusions);
            configurations = this.filter(configurations, autoConfigurationMetadata);
            this.fireAutoConfigurationImportEvents(configurations, exclusions);
            return new AutoConfigurationImportSelector.AutoConfigurationEntry(configurations, exclusions);
        }
    }
```

**第 1 步**:

判断自动装配开关是否打开。默认`spring.boot.enableautoconfiguration=true`，可在 `application.properties` 或 `application.yml` 中设置

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures77aa6a3727ea4392870f5cccd09844ab%7Etplv-k3u1fbpfcp-watermark.png)

**第 2 步**：

用于获取`EnableAutoConfiguration`注解中的 `exclude` 和 `excludeName`。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures3d6ec93bbda1453aa08c52b49516c05a%7Etplv-k3u1fbpfcp-zoom-1.png)

**第 3 步**

获取需要自动装配的所有配置类，读取`META-INF/spring.factories`

```plain
spring-boot/spring-boot-project/spring-boot-autoconfigure/src/main/resources/META-INF/spring.factories
```

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures58c51920efea4757aa1ec29c6d5f9e36%7Etplv-k3u1fbpfcp-watermark.png)

从下图可以看到这个文件的配置内容都被我们读取到了。`XXXAutoConfiguration`的作用就是按需加载组件。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures94d6e1a060ac41db97043e1758789026%7Etplv-k3u1fbpfcp-watermark.png)

不光是这个依赖下的`META-INF/spring.factories`被读取到，所有 Spring Boot Starter 下的`META-INF/spring.factories`都会被读取到。

所以，你可以清楚滴看到， druid 数据库连接池的 Spring Boot Starter 就创建了`META-INF/spring.factories`文件。

如果，我们自己要创建一个 Spring Boot Starter，这一步是必不可少的。

![](https://oss.javaguide.cn/github/javaguide/system-design/framework/spring/68fa66aeee474b0385f94d23bcfe1745~tplv-k3u1fbpfcp-watermark.png)

> sprint boot为数据库自动配置的各种配置类：
> DataSourceAutoConfiguration
> • 配置 DataSource
> DataSourceTransactionManagerAutoConfiguration
> • 配置 DataSourceTransactionManager
> JdbcTemplateAutoConfiguration
> • 配置 JdbcTemplate
> 符合条件时才进⾏行行配置

**第 4 步**：

到这里可能面试官会问你:“`spring.factories`中这么多配置，每次启动都要全部加载么？”。

很明显，这是不现实的。我们 debug 到后面你会发现，`configurations` 的值变小了。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures267f8231ae2e48d982154140af6437b0%7Etplv-k3u1fbpfcp-watermark.png)

因为，这一步有经历了一遍筛选，`@ConditionalOnXXX` 中的所有条件都满足，该类才会生效。

```java
@Configuration
// 检查相关的类：RabbitTemplate 和 Channel是否存在
// 存在才会加载
@ConditionalOnClass({ RabbitTemplate.class, Channel.class })
@EnableConfigurationProperties(RabbitProperties.class)
@Import(RabbitAnnotationDrivenConfiguration.class)
public class RabbitAutoConfiguration {
}
```

## 如何实现一个 Starter

光说不练假把式，现在就来撸一个 starter，实现自定义线程池

第一步，创建`threadpool-spring-boot-starter`工程

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures1ff0ebe7844f40289eb60213af72c5a6%7Etplv-k3u1fbpfcp-watermark.png)

第二步，引入 Spring Boot 相关依赖

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures5e14254276604f87b261e5a80a354cc0%7Etplv-k3u1fbpfcp-watermark.png)

第三步，创建`ThreadPoolAutoConfiguration`

![](https://oss.javaguide.cn/github/javaguide/system-design/framework/spring/1843f1d12c5649fba85fd7b4e4a59e39~tplv-k3u1fbpfcp-watermark.png)

第四步，在`threadpool-spring-boot-starter`工程的 resources 包下创建`META-INF/spring.factories`文件

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures97b738321f1542ea8140484d6aaf0728%7Etplv-k3u1fbpfcp-watermark.png)

最后新建工程引入`threadpool-spring-boot-starter`

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesedcdd8595a024aba85b6bb20d0e3fed4%7Etplv-k3u1fbpfcp-watermark.png)

测试通过！！！

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures9a265eea4de742a6bbdbbaa75f437307%7Etplv-k3u1fbpfcp-watermark.png)
# Spring访问数据库方式
## 通过JDBC访问数据库
 ![](./images/1727056701812_image.png)
### JDBC
JDBC 是java连接数据库操作的原生接口。

JDBC对Java程序员而言是API，对实现与数据库连接的服务提供商而言是接口模型。

作为API，JDBC为程序开发提供标准的接口，并为各个数据库厂商及第三方中间件厂商实现与数据库的连接提供了标准方法。一句话概括：jdbc是所有框架操作数据库的必须要用的，由数据库厂商提供，但是为了方便java程序员调用各个数据库，各个数据库厂商都要实现jdbc接口。
### Spring data JDBC
spring data JDBC相比传统JDBC而言省去了 数据库驱动，连接等无关配置，只需要写sql，设置参数；

## 通过封装的持久化框架访问数据库
 ![](./images/1727057341304_image.png)
### ORM
ORM （Object Relation Mapping，对象关系映射）是一种思想，是插入在应用程序与JDBC API之间的一个中间层，用于在关系型数据库和业务实体对象之间作一个映射.
### JPA
JPA 的全称是 Java Persistence API，中文的字面意思就是 java 的持久层 API ，jpa 就是定义了一系列标准，让实体类和数据库中的表建立一个对应的关系，当我们在使用 java 操作实体类的时候能达到操作数据库中表的效果(不用写sql ，就可以达到效果），jpa 的实现思想即是 ORM。
jpa 并不是一个框架，是一种java持久化规范，是orm框架的标准，主流orm框架都实现了这个标准，持久层框架 Hibernate 是 jpa 的一个具体实现， spring data jpa 又是在 Hibernate 的基础之上的封装实现。
JPA 仅仅是一种规范，也就是说 JPA 仅仅定义了一些接口，而接口是需要实现才能工作的。所以底层需要某种实现，而 Hibernate 就是实现了 JPA 接口的 ORM 框架。JPA的具体解决方案不止hibernate一种，还有TopLink、JDO、open等，可以简单理解成JPA是接口，Hibernate是实现类。
 ![](./images/1727057050867_image.png)
### Spring data JPA
虽然ORM框架都实现了JPA规范，但是在不同的ORM框架之间切换仍然需要编写不同的代码。Spring Data JPA是在实现了JPA规范的基础上封装的一套 JPA 应用框架，使用SpringData JPA能够方便大家在不同的ORM框架之间进行切换而不要更改代码。Spring Data JPA旨在通过将统一ORM框架的访问持久层的操作，来提高开发人的效率。
Spring Data JPA是对JPA规范的再次抽象，是基于 ORM 框架、JPA 规范的基础上封装的一套 JPA 应用框架，底层默认还是用的实现JPA的Hibernate技术，也可以使用其他技术实现。
![](./images/1727057269288_image.png)
![](./images/1727057281887_image.png)
#### 通过 Spring Data JPA 操作数据库
只需要操作实体对象，操作数据库的方法自动生成
@EnableJpaRepositories
Repository<T, ID> 接⼝口
• CrudRepository<T, ID>
• PagingAndSortingRepository<T, ID>
• JpaRepository<T, ID>
>Repository Bean 是如何创建的
JpaRepositoriesRegistrar
• 激活了了 @EnableJpaRepositories
• 返回了了 JpaRepositoryConfigExtension
RepositoryBeanDefinitionRegistrarSupport.registerBeanDefinitions
• 注册 Repository Bean（类型是 JpaRepositoryFactoryBean ）
RepositoryConfigurationExtensionSupport.getRepositoryConfigurations
• 取得 Repository 配置
JpaRepositoryFactory.getTargetRepository
• 创建了了 Repository

>接⼝口中的⽅方法是如何被解释的
RepositoryFactorySupport.getRepository 添加了了Advice
• DefaultMethodInvokingMethodInterceptor
• QueryExecutorMethodInterceptor
AbstractJpaQuery.execute 执⾏行行具体的查询
语法解析在 Part 中
### Hibernate
Hibernate是一个标准的ORM框架，实现Jpa接口。Hibernate着手解决如何实现映射的方案，是一种处理映射关系方法类框架。
![](./images/1727057367441_image.png)
JPA和Hibernate 的关系就像JDBC和JDBC 驱动的关系：JPA是规范，Hibernate除了作为ORM框架之外，它也是一种JPA实现。
### Mybatis
Mybatis也是一个持久化框架，但不完全是一个ORM框架，不是依照的JPA规范。Mybatis底层也使用JDBC.
#### 通过mybatis操作数据库
区别于jpa，自己写sql（或工具生成），支持复杂的sql语句

# Spring访问Redis
Spring 对 Redis 的支持:
Spring Data Redis:
- 支持的客户端 Jedis / Lettuce
- RedisTemplate
- Repository ⽀支持
## Jedis客户端
Jedis 不不是线程安全的
1. 通过 JedisPool 获得 Jedis 实例例
2. 直接使⽤用 Jedis 中的⽅方法
## RedisTemplate
RedisTemplate<K, V>
- opsForXxx()
## Redis Repository
实体注解
- @RedisHash
- @Id
- @Indexed

# Spring应用上下文的层级关系
Web 上下⽂文层次
![](./images/1727075627860_image.png)
>AOP的增强方法只能在同一个应用上下文生效，父应用上下文中BEAN的AOP增强方法无法在子应用上下文的BEAN生效。

# Spring MVC中的视图解析
## 视图解析的实现基础
ViewResolver 与 View 接⼝：
• AbstractCachingViewResolver
• UrlBasedViewResolver
• FreeMarkerViewResolver
• ContentNegotiatingViewResolver
• InternalResourceViewResolver
## DispatcherServlet 中的视图解析逻辑
### 非注解情况
1. initStrategies()
- initViewResolvers() 初始化了了对应的ViewResolver
2. doDispatch()
- processDispatchResult()
   - 没有返回视图的话，尝试RequestToViewNameTranslator
   - resolveViewName() 解析 View 对象

### 使用 @ResponseBody 的情况
在 HandlerAdapter.handle() 的中完成了了 Response 输出
- RequestMappingHandlerAdapter.invokeHandlerMethod()
  - HandlerMethodReturnValueHandlerComposite.handleReturnValue()
    - RequestResponseBodyMethodProcessor.handleReturnValue()

## Spring MVC支持的视图
### Jackson-based JSON / XML
配置 MessageConverter
- 通过 WebMvcConfigurer 的 configureMessageConverters()
  - Spring Boot ⾃自动查找 HttpMessageConverters 进⾏行行注册
### Thymeleaf & FreeMarker（模板引擎）

# 可执行Jar包
包含
• Jar 描述，META-INF/MANIFEST.MF
• Spring Boot Loader，org/springframework/boot/loader
• 项⽬目内容，BOOT-INF/classes
• 项⽬目依赖，BOOT-INF/lib
其中不不包含
• JDK / JRE
![](./images/1727080283723_image.png)
## 如何找到程序的⼊入⼝口
Jar 的启动类
- MANIFEST.MF
  - Main-Class: org.springframework.boot.loader.JarLauncher
  项⽬目的主类
- @SpringApplication
- MANIFEST.MF
  - Start-Class: xxx.yyy.zzz
## 如何创建可直接执行的 Jar
![](./images/1727080357661_image.png)
• 打包后的 Jar 可直接运⾏行行，⽆无需 java 命令
• 可以在 .conf 的同名⽂文件中配置参数

# 服务注册与发现
## Eureka
### 注册中心
Starter
- spring-cloud-dependencies
- spring-cloud-starter-netflix-eureka-starter
声明
- @EnableEurekaServer
### 服务注册
Starter
- spring-cloud-starter-netflix-eureka-client
声明
- @EnableDiscoveryClient
- @EnableEurekaClient
### 服务发现
#### 获得服务地址
EurekaClient
- getNextServerFromEureka()
DiscoveryClient
- getInstances()
#### 负载均衡
Load Balancer Client
RestTemplate 与 WebClient
- @LoadBalaced
- 实际是通过 ClientHttpRequestInterceptor 实现的
  - LoadBalancerInterceptor
  - LoadBalancerClient
    - RibbonLoadBalancerClient
## Nacos
![](./images/1727159906704_image.png)

# 服务配置管理
Spring Cloud Config
目标
- 在分布式系统中，提供外置配置⽀支持
实现
- 类似于 Spring 应⽤用中的 Environment 与 PropertySource
- 在上下⽂文中增加 Spring Cloud Config 的 PropertySource
## 配置中心
Spring Cloud Config Server

EnvironmentRepository
- Git / SVN / Vault / JDBC …
目的
- 提供针对外置配置的 HTTP API
依赖
- spring-cloud-config-server
- @EnableConfigServer
- ⽀支持 Git / SVN / Vault / JDBC …
## 服务配置发现
Spring Cloud Config Client
依赖
- spring-cloud-starter-config
发现配置中⼼心
- bootstrap.properties | yml
- spring.cloud.config.fail-fast=true
- 通过配置
  - spring.cloud.config.uri=http://localhost:8888

发现配置中心
- bootstrap.properties | yml
- 通过服务发现
- spring.cloud.config.discovery.enabled=true
- spring.cloud.config.discovery.service-id=configserver
配置刷新
- @RefreshScope
- Endpoint - /actuator/refresh

配置的组合顺序
以 yml 为例
- 应⽤用名-profile.yml
- 应⽤用名.yml
- application-profile.yml
- application.yml

# 服务熔断与降级
## 断路器模式
核心思想
- 在断路路器器对象中封装受保护的⽅方法调用
- 该对象监控调⽤用和断路路情况
- 调⽤用失败触发阈值后，后续调⽤用直接由断路路器器返回错误，不不再执⾏行行实际调⽤用
![](./images/1727166037291_image.png)
## Hystrix
实现了了断路路器器模式
@HystrixCommand
- fallbackMethod / commandProperties
- @HystrixProperty(name="execution.isolation.strategy",value=“SEMAPHORE")

## Resilience4j



# 消息驱动

## Spring Cloud Stream

Spring Cloud Stream 是一款⽤用于构建消息驱动的微服务应⽤用程序的轻量量级框架
特性
• 声明式编程模型
• 引⼊入多种概念抽象
• 发布订阅、消费组、分区
• ⽀支持多种消息中间件
• RabbitMQ、Kafka ……

![image-20240924235252952](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240924235252952.png)

### Binder
• RabbitMQ
• Apache Kafka
• Kafka Streams
• Amazon Kinesis
• RocketMQ

### Binding
应⽤用中⽣生产者、消费者与消息系统之间的桥梁梁
• @EnableBinding
• @Input / SubscribableChannel
• @Output / MessageChannel

### 消费组
• 对同一消息，每个组中都会有⼀一个消费者收到消息

### 分区

![image-20240924235404907](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240924235404907.png)

### 如何发送与接收消息
生产消息
• 使⽤用 MessageChannel 中的 send()
• @SendTo
消费消息
• @StreamListener
• @Payload / @Headers / @Header

## kafka使用

诞⽣生之初被⽤用作消息队列列，现已发展为强⼤大的分布式事件流平台              

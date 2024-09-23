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

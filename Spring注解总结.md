[TOC]

# Spring注解

## @PostConstruct 

@PostConstruct 注解好多人以为是 Spring 提供的。其实是 Java 自己的注解。

Java 中该注解的说明：@PostConstruct 该注解被用来修饰一个非静态的 void（）方法。被 @PostConstruct 修饰的方法会在服务器加载 [Servlet](https://so.csdn.net/so/search?q=Servlet&spm=1001.2101.3001.7020) 的时候运行，并且只会被服务器执行一次。PostConstruct 在构造函数之后执行，init（）方法之前执行。

通常我们会是在 Spring 框架中使用到 @PostConstruct 注解 该注解的方法在整个 Bean 初始化中的执行顺序：

Constructor(构造方法) -> @Autowired(依赖注入) -> @PostConstruct(注释的方法)

应用：在静态方法中调用依赖注入的 Bean 中的方法。

```
package com.example.studySpringBoot.util;
 
import com.example.studySpringBoot.service.MyMethorClassService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
 
import javax.annotation.PostConstruct;
 
@Component
public class MyUtils {
 
    private static MyUtils          staticInstance = new MyUtils();
 
    @Autowired
    private MyMethorClassService    myService;
 
    @PostConstruct
    public void init(){
        staticInstance.myService = myService;
    }
 
    public static Integer invokeBean(){
        return staticInstance.myService.add(10,20);
    }
}
```

###  Java 提供的 @PostConstruct 注解，Spring 是如何实现的呢？

需要先学习下 BeanPostProcessor 这个接口：

```
public interface BeanPostProcessor {
 
	/**
     * Apply this BeanPostProcessor to the given new bean instance <i>before</i> any bean
	 * initialization callbacks (like InitializingBean's {@code afterPropertiesSet}
	 * or a custom init-method). The bean will already be populated with property values.
	 * The returned bean instance may be a wrapper around the original.
     * 
     * 任何Bean实例化，并且Bean已经populated(填充属性) 就会回调这个方法
     *
     */
	Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException;
 
	/**
	 * Apply this BeanPostProcessor to the given new bean instance <i>after</i> any bean
	 * initialization callbacks (like InitializingBean's {@code afterPropertiesSet}
	 * or a custom init-method). The bean will already be populated with property values.
	 * The returned bean instance may be a wrapper around the original.
     *
     * 任何Bean实例化，并且Bean已经populated(填充属性) 就会回调这个方法
     *
     */
	Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException;
```

```
那Spring初始化是那里回调这些方法呢？

```

```
AbstractApplicationContext.finishBeanFactoryInitialization(...);
    beanFactory.preInstantiateSingletons();
       DefaultListableBeanFactory.getBean(beanName);
          AbstractBeanFactory.doGetBean();
            AbstractAutowireCapableBeanFactory.createBean(....)
                populateBean(beanName, mbd, instanceWrapper);
                initializeBean(...)
                 //调用BeanPostProcessor.postProcessBeforeInitialization()方法
                  applyBeanPostProcessorsBeforeInitialization(wrappedBean, beanName);
                 //调用BeanPostProcessor.postProcessBeforeInitialization()方法
                  applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
```

BeanPostProcessor 有个实现类 CommonAnnotationBeanPostProcessor，就是专门处理 @PostConstruct  @PreDestroy 注解。

```
CommonAnnotationBeanPostProcessor的父类InitDestroyAnnotationBeanPostProcessor()
 InitDestroyAnnotationBeanPostProcessor.postProcessBeforeInitialization()
    InitDestroyAnnotationBeanPostProcessor.findLifecycleMetadata()
        // 组装生命周期元数据
        InitDestroyAnnotationBeanPostProcessor.buildLifecycleMetadata()
            // 查找@PostConstruct注释的方法
            InitDestroyAnnotationBeanPostProcessor.initAnnotationType
            // 查找@PreDestroy注释方法
            InitDestroyAnnotationBeanPostProcessor.destroyAnnotationType
 // 反射调用          
 metadata.invokeInitMethods(bean, beanName);    
```

# Spring Bean的加载方式

## 1.xml+<bean/>

被配置的 bean 需要有无参数的构造函数

```
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">
	<!-- xml方式声明自己开发的bean -->
	<bean id="user" class="cn.sticki.blog.pojo.domain.User" />
	<!-- xml方式声明第三方bean -->
	<bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource"/>
</beans>

```

## 2.xml:context + 注解 (@Component+4 个 @Bean)

*   使用组件扫描，指定加载 bean 的位置，spring 会自动扫描这个包下的文件。
    
    ```
    <?xml version="1.0" encoding="UTF-8"?>
    <beans xmlns="http://www.springframework.org/schema/beans"
           xmlns:context="http://www.springframework.org/schema/context"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:schemaLocation="
           http://www.springframework.org/schema/beans
           http://www.springframework.org/schema/beans/spring-beans.xsd
           http://www.springframework.org/schema/context
           http://www.springframework.org/schema/context/spring-context.xsd
        ">
    
        <!-- 组件扫描，指定加载bean的位置 -->
        <context:component-scan base-package="cn.sticki.bean,cn.sticki.config"/>
    </beans>
    
    ```
    
*   然后在需要被加载的类名上添加 @Component 注解。也可以使用 @Controller、@Service、@Repository 定义 bean。
    
    ```
    @Service
    publice class UserServiceImpl implements UserService {
    }
    
    ```
    
*   使用 @Bean 定义第三方 bean，并将所在类定位为配置类或 Bean
    
    ```
    @Configuration  // 或使用@Component
    public class DBConfig {
        @Bean
        public DruidDataSource dataSource(){
            DruidDataSource ds = new DruidDataSource();
            return ds;
        } 
    }
    
    ```
    

> @Component 和 @Bean 的区别是什么？
>
> - `@Component` 注解作用于类，而`@Bean`注解作用于方法。
> - `@Component`通常是通过类路径扫描来自动侦测以及自动装配到 Spring 容器中（我们可以使用 `@ComponentScan` 注解定义要扫描的路径从中找出标识了需要装配的类自动装配到 Spring 的 bean 容器中）。`@Bean` 注解通常是我们在标有该注解的方法中定义产生这个 bean,`@Bean`告诉了 Spring 这是某个类的实例，当我需要用它的时候还给我。
> - `@Bean` 注解比 `@Component` 注解的自定义性更强，而且很多地方我们只能通过 `@Bean` 注解来注册 bean。比如当我们引用第三方库中的类需要装配到 `Spring`容器时，则只能通过 `@Bean`来实现。



## 3. 配置类 + 扫描 + 注解 (@Component+4 个 @Bean)

使用 `AnnotationConfigApplicationContext(SpringConfig.class);` 来获取 `ApplicationContext`

```
@ComponentScan({"cn.sticki.bean","cn.sticki.config"})
public class SpringConfig {
    @Bean
    public DogFactoryBean dog(){
        return new DogFactoryBean();
    }
}

```

和上面的第二种有点类似，就是包的扫描方式有所改变。

### 3.1FactoryBean 接口

初始化实现 [FactoryBean](https://so.csdn.net/so/search?q=FactoryBean&spm=1001.2101.3001.7020) 接口的类，实现对 bean 加载到容器之前的批处理操作。

```
public class DogFactoryBean implements FactoryBean<Dog> {
    @Override
    public Dog getObject() throws Exception {
        return new Dog();
    }
    @Override
    public Class<?> getObjectType() {
        return Dog.class;
    }
}

```

在下面的 bean 中，显示的表示为配置`DogFactoryBean` ，但实际上配置的是 `Dog` 。

```
@Component
public class SpringConfig {
    @Bean
    public DogFactoryBean dog(){
        return new DogFactoryBean();
    }
}

```

### 3.2@ImportResource 注解

用于加载配置类并加载配置文件（系统迁移）

```
@Configuration
@ComponentScan("cn.sticki.bean")
@ImportResource("applicationContext.xml")
public class SpringConfig {
}

```

### 3.3proxyBeanMethods 属性

使用 `proxyBeanMethods = true` 可以保障调用此类中的方法得到的对象是从容器中获取的，而不是重新创建的，但要求必须是通过此类调用方法获得的 bean。

```
@Configuration(proxyBeanMethods = true)
public class SpringConfig {
    @Bean
    public User user() {
        System.out.println("user init...");
        return new User();
    }
}

```

```
public class AppObject {
    public static void main() {
        ApplicationContext ctx = new AnnotationConfigApplicationContext(SpringConfig.class);
        SpringConfig config = ctx.getBean("Config", SpringConfig.class);
        // 两次获取的是同一个对象
        config.user();
        config.user();
    }
}

```

## 4.@Import 导入 bean 的类

使用 @Import 注解导入要注入的 bean 对应的字节码

```
@Import(User.class)
public class SpringConfig {
}

```

而被导入的 bean 无需使用注解声明为 bean

```
public class User{
}

```

这种形式可以有效的降低源代码与 spring 技术的耦合度（无侵入），在 spring 技术底层及诸多框架的整合中大量使用。

使用这种方法可以加在配置类，且也可以加在配置类当中的 bean。

## 5.AnnotationConfigApplicationContext 调用 registe[r 方](https://so.csdn.net/so/search?q=r%E6%96%B9&spm=1001.2101.3001.7020)法

在容器初始化完毕后使用容器对象手动注入 bean

```
public class App {
    public static void main() {
        ApplicationContext ctx = new AnnotationConfigApplicationContext(SpringConfig.class);
        ctx.register(User.class);
        // 打印容器中当前的所有bean
        String[] names = ctx.getBeanDefinitionNames();
        for (String name: names) {
            System.out.println(name);
        }
    }
}

```

必须在容器初始化之后才能使用这种方法。如果重复加载同一个 bean，后面加载的会覆盖前面加载的。

## 6.@Import 导入 ImportSelector 接口

导入实现了 ImportSelector 接口的类，实现对导入源的编程式处理

```
public class MyImportSelector implements ImportSelector {
    public String selectImports(AnnotationMetadata metadata) {
        // 使用metadata可以获取到导入该类的元类的大量属性，通过对这些属性进行判断，可以达到动态注入bean的效果
        boolean flag = metadata.hasAnnotation("org.springframework.context.annotation.Import");
        if(flag) {
            return new String[]{"cn.sticki.pojo.User"};
        }
        return new String[]{"cn.sticki.pojo.Dog"};
    }
}

```

调用处：

```
@Import(MyImportSelector.class)
public class SpringConfig {
}

```

## 7.@Import 导入 ImportBeanDefinitionRegistrar 接口

导入实现了 ImportBeanDefinitionRegistrar 接口的类，通过 BeanDefinition 的注册器注册实名 bean，实现对容器中 bean 的裁定，例如对现有 bean 的覆盖，进而达成不修改源代码的情况下更换实现的效果。

```
public class MyImportBeanDefinitionRegistrar implements ImportBeanDefinitionRegistrar {
    public String registrarBeanDefinitions(AnnotationMetadata metadata, BeanDefinitionRegistry registry) {
        // 使用元数据去做判定，然后再决定要注入哪些bean
        BeanDefinition beanDefinition = BeanDefinitionBuilder.rootBeanDefinition(User.class).getBeanDefinition();
        registry.registerBeanDefinition("user",beanDefinition);
    }
}

```

调用处和上面第六种方式差不多。

## 8.@Import 导入 BeanDefinitionRegistryPostProcessor 接口

导入实现了 BeanDefinitionRegistryPostProcessor 接口的类，通过 BeanDefinition 的注册器注册实名 bean，实现对容器中 bean 的最终裁定。其在 @Import 中的加载顺序为最后一个加载，可以用来做 bean 覆盖的最终裁定。

```
public class MyPostProcessor implements BeanDefinitionRegistryPostProcessor {
    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) throws BeansException {
        // 注意这里注册的是BookServiceImpl4
        BeanDefinition beanDefinition = BeanDefinitionBuilder.rootBeanDefinition(BookServiceImpl4.class).getBeanDefinition();
        registry.registerBeanDefinition("bookService",beanDefinition);
    }
    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
    }
}

```

调用处：

```
// 按照先后顺序加载，但 MyPostProcessor.class 最后才加载
@Import(BookServiceImpl1.class,MyPostProcessor.class, BookServiceImpl.class, MyImportSelector.class)
public class SpringConfig {
}

```

>本篇文章学习自 B 站黑马程序员，课程链接：https://www.bilibili.com/video/BV15b4y1a7yG，本本的内容主要来自 `原理篇139 - 原理篇148`，讲述的是 bean 加载方式。



# bean依赖属性

## 注入 Bean 的注解有哪些？

Spring 内置的 `@Autowired` 以及 JDK 内置的 `@Resource` 和 `@Inject` 都可以用于注入 Bean。

| Annotation   | Package                            | Source       |
| ------------ | ---------------------------------- | ------------ |
| `@Autowired` | `org.springframework.bean.factory` | Spring 2.5+  |
| `@Resource`  | `javax.annotation`                 | Java JSR-250 |
| `@Inject`    | `javax.inject`                     | Java JSR-330 |

>@Autowired 和 @Resource 的区别是什么？
>
>`Autowired` 属于 Spring 内置的注解，默认的注入方式为`byType`（根据类型进行匹配），也就是说会优先根据接口类型去匹配并注入 Bean （接口的实现类）。
>
>**这会有什么问题呢？** 当一个接口存在多个实现类的话，`byType`这种方式就无法正确注入对象了，因为这个时候 Spring 会同时找到多个满足条件的选择，默认情况下它自己不知道选择哪一个。
>
>这种情况下，注入方式会变为 `byName`（根据名称进行匹配），这个名称通常就是类名（首字母小写）。就比如说下面代码中的 `smsService` 就是我这里所说的名称，这样应该比较好理解了吧。
>
>```java
>// smsService 就是我们上面所说的名称
>@Autowired
>private SmsService smsService;
>```
>
>举个例子，`SmsService` 接口有两个实现类: `SmsServiceImpl1`和 `SmsServiceImpl2`，且它们都已经被 Spring 容器所管理。
>
>```java
>// 报错，byName 和 byType 都无法匹配到 bean
>@Autowired
>private SmsService smsService;
>// 正确注入 SmsServiceImpl1 对象对应的 bean
>@Autowired
>private SmsService smsServiceImpl1;
>// 正确注入  SmsServiceImpl1 对象对应的 bean
>// smsServiceImpl1 就是我们上面所说的名称
>@Autowired
>@Qualifier(value = "smsServiceImpl1")
>private SmsService smsService;
>```
>
>我们还是建议通过 `@Qualifier` 注解来显式指定名称而不是依赖变量的名称。
>
>`@Resource`属于 JDK 提供的注解，默认注入方式为 `byName`。如果无法通过名称匹配到对应的 Bean 的话，注入方式会变为`byType`。
>
>`@Resource` 有两个比较重要且日常开发常用的属性：`name`（名称）、`type`（类型）。
>
>```java
>public @interface Resource {
>    String name() default "";
>    Class<?> type() default Object.class;
>}
>```
>
>如果仅指定 `name` 属性则注入方式为`byName`，如果仅指定`type`属性则注入方式为`byType`，如果同时指定`name` 和`type`属性（不建议这么做）则注入方式为`byType`+`byName`。
>
>```java
>// 报错，byName 和 byType 都无法匹配到 bean
>@Resource
>private SmsService smsService;
>// 正确注入 SmsServiceImpl1 对象对应的 bean
>@Resource
>private SmsService smsServiceImpl1;
>// 正确注入 SmsServiceImpl1 对象对应的 bean（比较推荐这种方式）
>@Resource(name = "smsServiceImpl1")
>private SmsService smsService;
>```
>
>简单总结一下：
>
>- `@Autowired` 是 Spring 提供的注解，`@Resource` 是 JDK 提供的注解。
>- `Autowired` 默认的注入方式为`byType`（根据类型进行匹配），`@Resource`默认注入方式为 `byName`（根据名称进行匹配）。
>- 当一个接口存在多个实现类的情况下，`@Autowired` 和`@Resource`都需要通过名称才能正确匹配到对应的 Bean。`Autowired` 可以通过 `@Qualifier` 注解来显式指定名称，`@Resource`可以通过 `name` 属性来显式指定名称。
>- `@Autowired` 支持在构造函数、方法、字段和参数上使用。`@Resource` 主要用于字段和方法上的注入，不支持在构造函数或参数上使用。

## 注入 Bean 的方式有哪些？

依赖注入 (Dependency Injection, DI) 的常见方式：

1. 构造函数注入：通过类的构造函数来注入依赖项。
1. Setter 注入：通过类的 Setter 方法来注入依赖项。
1. Field（字段） 注入：直接在类的字段上使用注解（如 `@Autowired` 或 `@Resource`）来注入依赖项。

构造函数注入示例：

```java
@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    //...
}
```

Setter 注入示例：

```java
@Service
public class UserService {

    private UserRepository userRepository;

    // 在 Spring 4.3 及以后的版本，特定情况下 @Autowired 可以省略不写
    @Autowired
    public void setUserRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    //...
}
```

Field 注入示例：

```java
@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    //...
}
```

>构造函数注入还是 Setter 注入？
>
>Spring 官方有对这个问题的回答：<https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html#beans-setter-injection>。
>
>**Spring 官方推荐构造函数注入**，这种注入方式的优势如下：
>
>1. 依赖完整性：确保所有必需依赖在对象创建时就被注入，避免了空指针异常的风险。
>2. 不可变性：有助于创建不可变对象，提高了线程安全性。
>3. 初始化保证：组件在使用前已完全初始化，减少了潜在的错误。
>4. 测试便利性：在单元测试中，可以直接通过构造函数传入模拟的依赖项，而不必依赖 Spring 容器进行注入。
>
>构造函数注入适合处理**必需的依赖项**，而 **Setter 注入** 则更适合**可选的依赖项**，这些依赖项可以有默认值或在对象生命周期中动态设置。虽然 `@Autowired` 可以用于 Setter 方法来处理必需的依赖项，但构造函数注入仍然是更好的选择。
>
>在某些情况下（例如第三方类不提供 Setter 方法），构造函数注入可能是**唯一的选择**。
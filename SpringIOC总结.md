https://javadoop.com/post/spring-ioc

# IOC

IoC （Inversion of Control ）即控制反转/反转控制。它是一种思想不是一个技术实现。描述的是：Java 开发领域对象的创建以及管理的问题。
控制 ：指的是对象创建（实例化、管理）的权力
反转 ：控制权交给外部环境（IoC 容器）

![IoC 图解](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/frc-365faceb5697f04f31399937c059c162.png)

>IoC 和 DI 有区别吗？
IoC（Inverse of Control:控制反转）是一种设计思想或者说是某种模式。这个设计思想就是 **将原本在程序中手动创建对象的控制权交给第三方比如 IoC 容器。** 对于我们常用的 Spring 框架来说， IoC 容器实际上就是个 Map（key，value）,Map 中存放的是各种对象。不过，IoC 在其他语言中也有应用，并非 Spring 特有。
IoC 最常见以及最合理的实现方式叫做依赖注入（Dependency Injection，简称 DI）。

## Spring IOC容器源码分析
IOC容器可以理解为ApplicationContext对象，下图中的ClassPathXmlApplicationContext 、FileSystemXmlApplicationContext 和 AnnotationConfigApplicationContext都是根据不同方式启动的容器，如ClassPathXmlApplicationContext 是根据XML文件来实现依赖注入的，AnnotationConfigApplicationContext是根据注解来实现依赖注入的。
![1](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/1.png)
>如何获取ApplicationContext
1. 直接注入
```java
@Resource
private ApplicationContext ctx;
```
2. 实现 ApplicationContextAware 接口
创建一个实体类并实现 ApplicationContextAware 接口，重写接口内的 setApplicationContext 方法来完成获取 ApplicationContext 实例的方法
这里要注意 ApplicationContextProvider 类上的 @Component 注解是不可以去掉的，去掉后 Spring 就不会自动调用 setApplicationContext 方法来为我们设置上下文实例。

3. 在自定义 AutoConfiguration 中获取
有时候我们需要实现自定义的 Spring starter，并在自定义的 AutoConfiguration 中使用 ApplicationContext，Spring 在初始化 AutoConfiguration 时会自动传入 ApplicationContext，这时我们就可以使用下面的方式来获取 ApplicationContext：

```java
@Configuration
@EnableFeignClients("com.yidian.data.interfaces.client")
public class FeignAutoConfiguration {
    FeignAutoConfiguration(ApplicationContext context) {
         doSomething(context);
    }
}
```


4. 启动时获取 ApplicationContext
在启动 Spring Boot 项目时，需要调用 SpringApplication.run 方法，而 run 方法的返回值就是 ApplicationContext，我们可以把 run 方法返回的 ApplicationContext 对象保存下来，方便随时使用
5. 通过 WebApplicationContextUtils 获取
Spring 提供了一个工具类用于获取 ApplicationContext 对象：

```java
WebApplicationContextUtils.getRequiredWebApplicationContext(ServletContext sc);
WebApplicationContextUtils.getWebApplicationContext(ServletContext sc);
```
## BeanFactory

ApplicationContext 其实就是一个 BeanFactory, 负责生产和管理各个 bean 实例.
- ApplicationContext 继承了 ListableBeanFactory，这个 Listable 的意思就是，通过这个接口，我们可以获取多个 Bean，大家看源码会发现，最顶层 BeanFactory 接口的方法都是获取单个 Bean 的。
- ApplicationContext 继承了 HierarchicalBeanFactory，Hierarchical 单词本身已经能说明问题了，也就是说我们可以在应用中起多个 BeanFactory，然后可以将各个 BeanFactory 设置为父子关系。
- AutowireCapableBeanFactory 这个名字中的 Autowire 大家都非常熟悉，它就是用来自动装配 Bean 用的，但是仔细看上图，**ApplicationContext 并没有继承它，不过不用担心，不使用继承，不代表不可以使用组合，如果你看到 ApplicationContext 接口定义中的最后一个方法 getAutowireCapableBeanFactory() 就知道了**。ApplicationContext 继承自 BeanFactory，但是它不应该被理解为 BeanFactory 的实现类，而是说其内部持有一个实例化的 BeanFactory（DefaultListableBeanFactory）。以后所有的 BeanFactory 相关的操作其实是委托给这个实例来处理的。
- ConfigurableListableBeanFactory 也是一个特殊的接口，看图，特殊之处在于它继承了第二层所有的三个接口，而 ApplicationContext 没有。

![2](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/2.png)

## 启动源码分析
所有启动过程都会到refresh()函数中来进行实现：
```java
@Override
public void refresh() throws BeansException, IllegalStateException {
   // 来个锁，不然 refresh() 还没结束，你又来个启动或销毁容器的操作，那不就乱套了嘛
   synchronized (this.startupShutdownMonitor) {

      // 准备工作，记录下容器的启动时间、标记“已启动”状态、处理配置文件中的占位符
      prepareRefresh();

      // 这步比较关键，这步完成后，配置文件就会解析成一个个 Bean 定义，注册到 BeanFactory 中，
      // 当然，这里说的 Bean 还没有初始化，只是配置信息都提取出来了，
      // 注册也只是将这些信息都保存到了注册中心(说到底核心是一个 beanName-> beanDefinition 的 map)(BeanDefinition 中保存了我们的 Bean 信息，比如这个 Bean 指向的是哪个类、是否是单例的、是否懒加载、这个 Bean 依赖了哪些 Bean 等等。)
      ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

      // 设置 BeanFactory 的类加载器，添加几个 BeanPostProcessor，手动注册几个特殊的 bean
      //实现了 Aware 接口的 beans 在初始化的时候，这些 BeanPostProcessor 负责回调
      prepareBeanFactory(beanFactory);

      try {
         // 【这里需要知道 BeanFactoryPostProcessor 这个知识点，Bean 如果实现了此接口，
         // 那么在容器初始化以后，Spring 会负责调用里面的 postProcessBeanFactory 方法。】

         // 这里是提供给子类的扩展点，到这里的时候，所有的 Bean 都加载、注册完成了，但是都还没有初始化
         // 具体的子类可以在这步的时候添加一些特殊的 BeanFactoryPostProcessor 的实现类或做点什么事
         postProcessBeanFactory(beanFactory);
         // 调用 BeanFactoryPostProcessor 各个实现类的 postProcessBeanFactory(factory) 方法
         invokeBeanFactoryPostProcessors(beanFactory);

         // 注册 BeanPostProcessor 的实现类，注意看和 BeanFactoryPostProcessor 的区别
         // 此接口两个方法: postProcessBeforeInitialization 和 postProcessAfterInitialization
         // 两个方法分别在 Bean 初始化之前和初始化之后得到执行。注意，到这里 Bean 还没初始化
         registerBeanPostProcessors(beanFactory);

         // 初始化当前 ApplicationContext 的 MessageSource，国际化这里就不展开说了，不然没完没了了
         initMessageSource();

         // 初始化当前 ApplicationContext 的事件广播器，这里也不展开了
         initApplicationEventMulticaster();

         // 从方法名就可以知道，典型的模板方法(钩子方法)，
         // 具体的子类可以在这里初始化一些特殊的 Bean（在初始化 singleton beans 之前）
         onRefresh();

         // 注册事件监听器，监听器需要实现 ApplicationListener 接口。这也不是我们的重点，过
         registerListeners();

         // 重点，重点，重点
         // 初始化所有的 singleton beans
         //（lazy-init 的除外）
         //finishBeanFactoryInitialization()->preInstantiateSingletons()->getBean()->createBean()->doCreateBean(),doCreateBean()中有创建 Bean 实例的 createBeanInstance 方法，依赖注入的 populateBean 方法，还有回调方法 initializeBean。createBeanInstance 方法使用反射或者CGLIB进行实例化，initializeBean方法中会进行实现了所有Aware接口和BeanPostProcessor接口的方法的回调
         finishBeanFactoryInitialization(beanFactory);

         // 最后，广播事件，ApplicationContext 初始化完成
         finishRefresh();
      }

      catch (BeansException ex) {
         if (logger.isWarnEnabled()) {
            logger.warn("Exception encountered during context initialization - " +
                  "cancelling refresh attempt: " + ex);
         }

         // Destroy already created singletons to avoid dangling resources.
         // 销毁已经初始化的 singleton 的 Beans，以免有些 bean 会一直占用资源
         destroyBeans();

         // Reset 'active' flag.
         cancelRefresh(ex);

         // 把异常往外抛
         throw ex;
      }

      finally {
         // Reset common introspection caches in Spring's core, since we
         // might not ever need metadata for singleton beans anymore...
         resetCommonCaches();
      }
   }
}
```
## Bean的生命周期

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/spring-bean-lifestyle.png)

1. 创建Bean的实例: Bean容器首先会找到配置文件中的Bean定义，然后使用Java反射API来创建Bean的实例。
2. Bean属性赋值/填充:为Bean设置相关属性和依赖，例如@Autowired等注解注入的对象、@value注入
的值、setter方法或构造函数注入依赖和值、@Resource注入的各种资源。
3. Bean初始化:
- 如果Bean实现了
BeanNameAware接口，调用setBeanName()方法，传入Bean的名字。
- 如果Bean实现了
BeanClassLoaderAware接口，调用setBeanClassLoader()方法，传入ClassLoader对
象的实例。
- 如果 Bean 实现了
BeanFactoryAware接口，调用
setBeanFactory 方法，传入 BeanFactory 对象的实
例。
- 与上面的类似，如果实现了其他*.Aware接口，就调用相应的方法。
- 如果有和加载这个Bean的 Spring 容器相关的 BeanPostProcessor对象，执行
postProcessBeforeInitialization()方法
- 如果 Bean 实现了InitializingBean 接口，执行afterPropertiesSet()方法。。如果Bean在配置文件中的定义包含init-method属性，执行指定的方法。。如果有和加载这个Bean的 Spring容器相关的 BeanPostProcessor对象，执行
postProcessAfterInitialization(方法。
4. 销毁Bean:销毁并不是说要立马把Bean给销毁掉，而是把Bean的销毁方法先记录下来，将来需要销毁Bean 或者销毁容器的时候，就调用这些方法去释放Bean所持有的资源。
- 如果Bean实现了DisposableBean接口，执行destroy()方法。
- 如果Bean在配置文件中的定义包含destroy-method属性，执行指定的Bean 销毁方法。或者，也可以直接通过@PreDestroy注解标记Bean销毁之前执行的方法。
AbstractAutowireCapableBeanFactory 的 doCreateBean() 方法中能看到依次执行了这 4 个阶段：
```java
protected Object doCreateBean(final String beanName, final RootBeanDefinition mbd, final @Nullable Object[] args)
    throws BeanCreationException {

    // 1. 创建 Bean 的实例
    BeanWrapper instanceWrapper = null;
    if (instanceWrapper == null) {
        instanceWrapper = createBeanInstance(beanName, mbd, args);
    }

    Object exposedObject = bean;
    try {
        // 2. Bean 属性赋值/填充
        populateBean(beanName, mbd, instanceWrapper);
        // 3. Bean 初始化
        exposedObject = initializeBean(beanName, exposedObject, mbd);
    }

    // 4. 销毁 Bean-注册回调接口
    try {
        registerDisposableBeanIfNecessary(beanName, bean, mbd);
    }

    return exposedObject;
}
```
## Aware接口：
Aware 接口能让 Bean 能拿到 Spring 容器资源。
Spring 中提供的 Aware 接口主要有：
- BeanNameAware：注入当前 bean 对应 beanName；
- BeanClassLoaderAware：注入加载当前 bean 的 ClassLoader；
- BeanFactoryAware：注入当前 BeanFactory 容器的引用。BeanPostProcessor 接口是 Spring 为修改 Bean 提供的强大扩展点。
## BeanPostProcess接口
BeanPostProcessor 接口是 Spring 为修改 Bean 提供的强大扩展点。
- postProcessBeforeInitialization：Bean 实例化、属性注入完成后
- InitializingBean#afterPropertiesSet方法以及自定义的 init-method 方法之前执行；
- postProcessAfterInitialization：类似于上面，不过是在 InitializingBean#afterPropertiesSet方法以及自定义的 init-method 方法之后执行。
## PS:
这两个接口的方法都在bean进行初始化时的initializaBean方法中进行回调：
```java
protected Object initializeBean(final String beanName, final Object bean, RootBeanDefinition mbd) {
   if (System.getSecurityManager() != null) {
      AccessController.doPrivileged(new PrivilegedAction<Object>() {
         @Override
         public Object run() {
            invokeAwareMethods(beanName, bean);
            return null;
         }
      }, getAccessControlContext());
   }
   else {
      // 如果 bean 实现了 BeanNameAware、BeanClassLoaderAware 或 BeanFactoryAware 接口，回调
      invokeAwareMethods(beanName, bean);
   }

   Object wrappedBean = bean;
   if (mbd == null || !mbd.isSynthetic()) {
      // BeanPostProcessor 的 postProcessBeforeInitialization 回调
      wrappedBean = applyBeanPostProcessorsBeforeInitialization(wrappedBean, beanName);
   }

   try {
      // 处理 bean 中定义的 init-method，
      // 或者如果 bean 实现了 InitializingBean 接口，调用 afterPropertiesSet() 方法
      invokeInitMethods(beanName, wrappedBean, mbd);
   }
   catch (Throwable ex) {
      throw new BeanCreationException(
            (mbd != null ? mbd.getResourceDescription() : null),
            beanName, "Invocation of init method failed", ex);
   }

   if (mbd == null || !mbd.isSynthetic()) {
      // BeanPostProcessor 的 postProcessAfterInitialization 回调
      wrappedBean = applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
   }
   return wrappedBean;
}
```

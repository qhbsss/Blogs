> 本文由 [简悦 SimpRead](http://ksria.com/simpread/) 转码， 原文地址 [javadoop.com](https://javadoop.com/post/spring-ioc)

> Spring 最重要的概念是 IOC 和 AOP，本篇文章其实就是要带领大家来分析下 Spring 的 IOC 容器。

Spring 最重要的概念是 IOC 和 AOP，本篇文章其实就是要带领大家来分析下 Spring 的 IOC 容器。既然大家平时都要用到 Spring，怎么可以不好好了解 Spring 呢？阅读本文并不能让你成为 Spring 专家，不过一定有助于大家理解 Spring 的很多概念，帮助大家排查应用中和 Spring 相关的一些问题。

本文采用的源码版本是 4.3.11.RELEASE，算是 5.0.x 前比较新的版本了。为了降低难度，本文所说的所有的内容都是基于 xml 的配置的方式，实际使用已经很少人这么做了，至少不是纯 xml 配置，不过从理解源码的角度来看用这种方式来说无疑是最合适的。

阅读建议：读者至少需要知道怎么配置 Spring，了解 Spring 中的各种概念，少部分内容我还假设读者使用过 SpringMVC。本文要说的 IOC 总体来说有两处地方最重要，一个是创建 Bean 容器，一个是初始化 Bean，如果读者觉得一次性看完本文压力有点大，那么可以按这个思路分两次消化。读者不一定对 Spring 容器的源码感兴趣，也许附录部分介绍的知识对读者有些许作用。

希望通过本文可以让读者不惧怕阅读 Spring 源码，也希望大家能反馈表述错误或不合理的地方。

引言
--

先看下最基本的启动 Spring 容器的例子：

```
public static void main(String[] args) {
    ApplicationContext context = new ClassPathXmlApplicationContext("classpath:applicationfile.xml");
}


```

以上代码就可以利用配置文件来启动一个 Spring 容器了，请使用 maven 的小伙伴直接在 dependencies 中加上以下依赖即可，个人比较反对那些不知道要添加什么依赖，然后把 Spring 的所有相关的东西都加进来的方式。

```
<dependency>
  <groupId>org.springframework</groupId>
  <artifactId>spring-context</artifactId>
  <version>4.3.11.RELEASE</version>
</dependency>


```

spring-context 会自动将 spring-core、spring-beans、spring-aop、spring-expression 这几个基础 jar 包带进来。

多说一句，很多开发者入门就直接接触的 SpringMVC，对 Spring 其实不是很了解，Spring 是渐进式的工具，并不具有很强的侵入性，它的模块也划分得很合理，即使你的应用不是 web 应用，或者之前完全没有使用到 Spring，而你就想用 Spring 的依赖注入这个功能，其实完全是可以的，它的引入不会对其他的组件产生冲突。

废话说完，我们继续。`ApplicationContext context = new ClassPathXmlApplicationContext(...)` 其实很好理解，从名字上就可以猜出一二，就是在 ClassPath 中寻找 xml 配置文件，根据 xml 文件内容来构建 ApplicationContext。当然，除了 ClassPathXmlApplicationContext 以外，我们也还有其他构建 ApplicationContext 的方案可供选择，我们先来看看大体的继承结构是怎么样的：

![](https://www.javadoop.com/blogimages/spring-context/1.png)读者可以大致看一下类名，源码分析的时候不至于找不着看哪个类，因为 Spring 为了适应各种使用场景，提供的各个接口都可能有很多的实现类。对于我们来说，就是揪着一个完整的分支看完。

当然，读本文的时候读者也不必太担心，每个代码块分析的时候，我都会告诉读者我们在说哪个类第几行。

我们可以看到，ClassPathXmlApplicationContext 兜兜转转了好久才到 ApplicationContext 接口，同样的，我们也可以使用绿颜色的 **FileSystemXmlApplicationContext** 和 **AnnotationConfigApplicationContext** 这两个类。

**1、FileSystemXmlApplicationContext** 的构造函数需要一个 xml 配置文件在系统中的路径，其他和 ClassPathXmlApplicationContext 基本上一样。

**2、AnnotationConfigApplicationContext** 是基于注解来使用的，它不需要配置文件，采用 java 配置类和各种注解来配置，是比较简单的方式，也是大势所趋吧。

不过本文旨在帮助大家理解整个构建流程，所以决定使用 ClassPathXmlApplicationContext 进行分析。

我们先来一个简单的例子来看看怎么实例化 ApplicationContext。

首先，定义一个接口：

```
public interface MessageService {
    String getMessage();
}


```

定义接口实现类：

```
public class MessageServiceImpl implements MessageService {

    public String getMessage() {
        return "hello world";
    }
}


```

接下来，我们在 **resources** 目录新建一个配置文件，文件名随意，通常叫 application.xml 或 application-xxx.xml 就可以了：

```
<?xml version="1.0" encoding="UTF-8" ?>
<beans xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns="http://www.springframework.org/schema/beans"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd" default-autowire="byName">

    <bean/>
</beans>


```

这样，我们就可以跑起来了：

```
public class App {
    public static void main(String[] args) {
        
        ApplicationContext context = new ClassPathXmlApplicationContext("classpath:application.xml");

        System.out.println("context 启动成功");

        
        MessageService messageService = context.getBean(MessageService.class);
        
        System.out.println(messageService.getMessage());
    }
}


```

以上例子很简单，不过也够引出本文的主题了，就是怎么样通过配置文件来启动 Spring 的 ApplicationContext ？也就是我们今天要分析的 IOC 的核心了。ApplicationContext 启动过程中，会负责创建实例 Bean，往各个 Bean 中注入依赖等。

BeanFactory 简介
--------------

BeanFactory，从名字上也很好理解，生产 bean 的工厂，它负责生产和管理各个 bean 实例。

初学者可别以为我之前说那么多和 BeanFactory 无关，前面说的 ApplicationContext 其实就是一个 BeanFactory。我们来看下和 BeanFactory 接口相关的主要的继承结构：

![](https://www.javadoop.com/blogimages/spring-context/2.png)我想，大家看完这个图以后，可能就不是很开心了。ApplicationContext 往下的继承结构前面一张图说过了，这里就不重复了。这张图呢，背下来肯定是不需要的，有几个重点和大家说明下就好。

1.  ApplicationContext 继承了 ListableBeanFactory，这个 Listable 的意思就是，通过这个接口，我们可以获取多个 Bean，大家看源码会发现，最顶层 BeanFactory 接口的方法都是获取单个 Bean 的。
2.  ApplicationContext 继承了 HierarchicalBeanFactory，Hierarchical 单词本身已经能说明问题了，也就是说我们可以在应用中起多个 BeanFactory，然后可以将各个 BeanFactory 设置为父子关系。

1.  AutowireCapableBeanFactory 这个名字中的 Autowire 大家都非常熟悉，它就是用来自动装配 Bean 用的，但是仔细看上图，ApplicationContext 并没有继承它，不过不用担心，不使用继承，不代表不可以使用组合，如果你看到 ApplicationContext 接口定义中的最后一个方法 getAutowireCapableBeanFactory() 就知道了。
2.  ConfigurableListableBeanFactory 也是一个特殊的接口，看图，特殊之处在于它继承了第二层所有的三个接口，而 ApplicationContext 没有。这点之后会用到。

1.  请先不用花时间在其他的接口和类上，先理解我说的这几点就可以了。

然后，请读者打开编辑器，翻一下 BeanFactory、ListableBeanFactory、HierarchicalBeanFactory、AutowireCapableBeanFactory、ApplicationContext 这几个接口的代码，大概看一下各个接口中的方法，大家心里要有底，限于篇幅，我就不贴代码介绍了。

启动过程分析
------

下面将会是冗长的代码分析，记住，一定要自己打开源码来看，不然纯看是很累的。

第一步，我们肯定要从 ClassPathXmlApplicationContext 的构造方法说起。

```
public class ClassPathXmlApplicationContext extends AbstractXmlApplicationContext {
  private Resource[] configResources;

  
  public ClassPathXmlApplicationContext(ApplicationContext parent) {
    super(parent);
  }
  ...
  public ClassPathXmlApplicationContext(String[] configLocations, boolean refresh, ApplicationContext parent)
      throws BeansException {

    super(parent);
    
    setConfigLocations(configLocations);
    if (refresh) {
      refresh(); 
    }
  }
    ...
}


```

接下来，就是 `refresh()`，这里简单说下为什么是 refresh()，而不是 init() 这种名字的方法。因为 ApplicationContext 建立起来以后，其实我们是可以通过调用 refresh() 这个方法重建的，refresh() 会将原来的 ApplicationContext 销毁，然后再重新执行一次初始化操作。

往下看，refresh() 方法里面调用了那么多方法，就知道肯定不简单了，请读者先看个大概，细节之后会详细说。

```
@Override
public void refresh() throws BeansException, IllegalStateException {
   
   synchronized (this.startupShutdownMonitor) {

      
      prepareRefresh();

      
      
      
      ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

      
      
      prepareBeanFactory(beanFactory);

      try {
         
         

         
         
         postProcessBeanFactory(beanFactory);
         
         invokeBeanFactoryPostProcessors(beanFactory);

         
         
         
         registerBeanPostProcessors(beanFactory);

         
         initMessageSource();

         
         initApplicationEventMulticaster();

         
         
         onRefresh();

         
         registerListeners();

         
         
         
         finishBeanFactoryInitialization(beanFactory);

         
         finishRefresh();
      }

      catch (BeansException ex) {
         if (logger.isWarnEnabled()) {
            logger.warn("Exception encountered during context initialization - " +
                  "cancelling refresh attempt: " + ex);
         }

         
         
         destroyBeans();

         
         cancelRefresh(ex);

         
         throw ex;
      }

      finally {
         
         
         resetCommonCaches();
      }
   }
}


```

下面，我们开始一步步来肢解这个 refresh() 方法。

### 创建 Bean 容器前的准备工作

这个比较简单，直接看代码中的几个注释即可。

```
protected void prepareRefresh() {
   
   
   this.startupDate = System.currentTimeMillis();
   this.closed.set(false);
   this.active.set(true);

   if (logger.isInfoEnabled()) {
      logger.info("Refreshing " + this);
   }

   
   initPropertySources();

   
   getEnvironment().validateRequiredProperties();

   this.earlyApplicationEvents = new LinkedHashSet<ApplicationEvent>();
}


```

### 创建 Bean 容器，加载并注册 Bean

我们回到 refresh() 方法中的下一行 obtainFreshBeanFactory()。

注意，**这个方法是全文最重要的部分之一**，这里将会初始化 BeanFactory、加载 Bean、注册 Bean 等等。

当然，这步结束后，Bean 并没有完成初始化。这里指的是 Bean 实例并未在这一步生成。

// AbstractApplicationContext.java

```
protected ConfigurableListableBeanFactory obtainFreshBeanFactory() {
   
   refreshBeanFactory();

   
   ConfigurableListableBeanFactory beanFactory = getBeanFactory();
   if (logger.isDebugEnabled()) {
      logger.debug("Bean factory for " + getDisplayName() + ": " + beanFactory);
   }
   return beanFactory;
}


```

// AbstractRefreshableApplicationContext.java 120

```
@Override
protected final void refreshBeanFactory() throws BeansException {
   
   
   
   if (hasBeanFactory()) {
      destroyBeans();
      closeBeanFactory();
   }
   try {
      
      DefaultListableBeanFactory beanFactory = createBeanFactory();
      
      beanFactory.setSerializationId(getId());

      
      
      customizeBeanFactory(beanFactory);

      
      loadBeanDefinitions(beanFactory);
      synchronized (this.beanFactoryMonitor) {
         this.beanFactory = beanFactory;
      }
   }
   catch (IOException ex) {
      throw new ApplicationContextException("I/O error parsing bean definition source for " + getDisplayName(), ex);
   }
}


```

看到这里的时候，我觉得读者就应该站在高处看 ApplicationContext 了，ApplicationContext 继承自 BeanFactory，但是它不应该被理解为 BeanFactory 的实现类，而是说其内部持有一个实例化的 BeanFactory（DefaultListableBeanFactory）。以后所有的 BeanFactory 相关的操作其实是委托给这个实例来处理的。

我们说说为什么选择实例化 **DefaultListableBeanFactory** ？前面我们说了有个很重要的接口 ConfigurableListableBeanFactory，它实现了 BeanFactory 下面一层的所有三个接口，我把之前的继承图再拿过来大家再仔细看一下：

![](https://www.javadoop.com/blogimages/spring-context/3.png)我们可以看到 ConfigurableListableBeanFactory 只有一个实现类 DefaultListableBeanFactory，而且实现类 DefaultListableBeanFactory 还通过实现右边的 AbstractAutowireCapableBeanFactory 通吃了右路。所以结论就是，最底下这个家伙 DefaultListableBeanFactory 基本上是最牛的 BeanFactory 了，这也是为什么这边会使用这个类来实例化的原因。

如果你想要在程序运行的时候动态往 Spring IOC 容器注册新的 bean，就会使用到这个类。那我们怎么在运行时获得这个实例呢？

之前我们说过 ApplicationContext 接口能获取到 AutowireCapableBeanFactory，就是最右上角那个，然后它向下转型就能得到 DefaultListableBeanFactory 了。

那怎么拿到 ApplicationContext 实例呢？如果你不会，说明你没用过 Spring。

在继续往下之前，我们需要先了解 BeanDefinition。**我们说 BeanFactory 是 Bean 容器，那么 Bean 又是什么呢？**

这里的 BeanDefinition 就是我们所说的 Spring 的 Bean，我们自己定义的各个 Bean 其实会转换成一个个 BeanDefinition 存在于 Spring 的 BeanFactory 中。

所以，如果有人问你 Bean 是什么的时候，你要知道 Bean 在代码层面上可以简单认为是 BeanDefinition 的实例。

BeanDefinition 中保存了我们的 Bean 信息，比如这个 Bean 指向的是哪个类、是否是单例的、是否懒加载、这个 Bean 依赖了哪些 Bean 等等。

#### BeanDefinition 接口定义

我们来看下 BeanDefinition 的接口定义：

```
public interface BeanDefinition extends AttributeAccessor, BeanMetadataElement {

   
   
   
   String SCOPE_SINGLETON = ConfigurableBeanFactory.SCOPE_SINGLETON;
   String SCOPE_PROTOTYPE = ConfigurableBeanFactory.SCOPE_PROTOTYPE;

   
   int ROLE_APPLICATION = 0;
   int ROLE_SUPPORT = 1;
   int ROLE_INFRASTRUCTURE = 2;

   
   
   void setParentName(String parentName);

   
   String getParentName();

   
   void setBeanClassName(String beanClassName);

   
   String getBeanClassName();


   
   void setScope(String scope);

   String getScope();

   
   void setLazyInit(boolean lazyInit);

   boolean isLazyInit();

   
   
   void setDependsOn(String... dependsOn);

   
   String[] getDependsOn();

   
   
   void setAutowireCandidate(boolean autowireCandidate);

   
   boolean isAutowireCandidate();

   
   void setPrimary(boolean primary);

   
   boolean isPrimary();

   
   
   void setFactoryBeanName(String factoryBeanName);
   
   String getFactoryBeanName();
   
   void setFactoryMethodName(String factoryMethodName);
   
   String getFactoryMethodName();

   
   ConstructorArgumentValues getConstructorArgumentValues();

   
   MutablePropertyValues getPropertyValues();

   
   boolean isSingleton();

   
   boolean isPrototype();

   
   
   boolean isAbstract();

   int getRole();
   String getDescription();
   String getResourceDescription();
   BeanDefinition getOriginatingBeanDefinition();
}


```

这个 BeanDefinition 其实已经包含很多的信息了，暂时不清楚所有的方法对应什么东西没关系，希望看完本文后读者可以彻底搞清楚里面的所有东西。

这里接口虽然那么多，但是没有类似 getInstance() 这种方法来获取我们定义的类的实例，真正的我们定义的类生成的实例到哪里去了呢？别着急，这个要很后面才能讲到。

有了 BeanDefinition 的概念以后，我们再往下看 refreshBeanFactory() 方法中的剩余部分：

```
customizeBeanFactory(beanFactory);
loadBeanDefinitions(beanFactory);


```

虽然只有两个方法，但路还很长啊。。。

#### customizeBeanFactory

customizeBeanFactory(beanFactory) 比较简单，就是配置是否允许 BeanDefinition 覆盖、是否允许循环引用。

```
protected void customizeBeanFactory(DefaultListableBeanFactory beanFactory) {
   if (this.allowBeanDefinitionOverriding != null) {
      
      beanFactory.setAllowBeanDefinitionOverriding(this.allowBeanDefinitionOverriding);
   }
   if (this.allowCircularReferences != null) {
      
      beanFactory.setAllowCircularReferences(this.allowCircularReferences);
   }
}


```

BeanDefinition 的覆盖问题可能会有开发者碰到这个坑，就是在配置文件中定义 bean 时使用了相同的 id 或 name，默认情况下，allowBeanDefinitionOverriding 属性为 null，如果在同一配置文件中重复了，会抛错，但是如果不是同一配置文件中，会发生覆盖。

循环引用也很好理解：A 依赖 B，而 B 依赖 A。或 A 依赖 B，B 依赖 C，而 C 依赖 A。

默认情况下，Spring 允许循环依赖，当然如果你在 A 的构造方法中依赖 B，在 B 的构造方法中依赖 A 是不行的。

至于这两个属性怎么配置？我在附录中进行了介绍，尤其对于覆盖问题，很多人都希望禁止出现 Bean 覆盖，可是 Spring 默认是不同文件的时候可以覆盖的。

之后的源码中还会出现这两个属性，读者有个印象就可以了，它们不是非常重要。

#### 加载 Bean: loadBeanDefinitions

接下来是最重要的 loadBeanDefinitions(beanFactory) 方法了，这个方法将根据配置，加载各个 Bean，然后放到 BeanFactory 中。

读取配置的操作在 XmlBeanDefinitionReader 中，其负责加载配置、解析。

// AbstractXmlApplicationContext.java 80

```
@Override
protected void loadBeanDefinitions(DefaultListableBeanFactory beanFactory) throws BeansException, IOException {
   
   XmlBeanDefinitionReader beanDefinitionReader = new XmlBeanDefinitionReader(beanFactory);

   
   
   beanDefinitionReader.setEnvironment(this.getEnvironment());
   beanDefinitionReader.setResourceLoader(this);
   beanDefinitionReader.setEntityResolver(new ResourceEntityResolver(this));

   
   
   initBeanDefinitionReader(beanDefinitionReader);
   
   loadBeanDefinitions(beanDefinitionReader);
}


```

现在还在这个类中，接下来用刚刚初始化的 Reader 开始来加载 xml 配置，这块代码读者可以选择性跳过，不是很重要。也就是说，下面这个代码块，读者可以很轻松地略过。

// AbstractXmlApplicationContext.java 120

```
protected void loadBeanDefinitions(XmlBeanDefinitionReader reader) throws BeansException, IOException {
   Resource[] configResources = getConfigResources();
   if (configResources != null) {
      
      reader.loadBeanDefinitions(configResources);
   }
   String[] configLocations = getConfigLocations();
   if (configLocations != null) {
      
      reader.loadBeanDefinitions(configLocations);
   }
}


@Override
public int loadBeanDefinitions(Resource... resources) throws BeanDefinitionStoreException {
   Assert.notNull(resources, "Resource array must not be null");
   int counter = 0;
   
   for (Resource resource : resources) {
      
      counter += loadBeanDefinitions(resource);
   }
   
   return counter;
}


@Override
public int loadBeanDefinitions(Resource resource) throws BeanDefinitionStoreException {
   return loadBeanDefinitions(new EncodedResource(resource));
}


public int loadBeanDefinitions(EncodedResource encodedResource) throws BeanDefinitionStoreException {
   Assert.notNull(encodedResource, "EncodedResource must not be null");
   if (logger.isInfoEnabled()) {
      logger.info("Loading XML bean definitions from " + encodedResource.getResource());
   }
   
   Set<EncodedResource> currentResources = this.resourcesCurrentlyBeingLoaded.get();
   if (currentResources == null) {
      currentResources = new HashSet<EncodedResource>(4);
      this.resourcesCurrentlyBeingLoaded.set(currentResources);
   }
   if (!currentResources.add(encodedResource)) {
      throw new BeanDefinitionStoreException(
            "Detected cyclic loading of " + encodedResource + " - check your import definitions!");
   }
   try {
      InputStream inputStream = encodedResource.getResource().getInputStream();
      try {
         InputSource inputSource = new InputSource(inputStream);
         if (encodedResource.getEncoding() != null) {
            inputSource.setEncoding(encodedResource.getEncoding());
         }
         
         return doLoadBeanDefinitions(inputSource, encodedResource.getResource());
      }
      finally {
         inputStream.close();
      }
   }
   catch (IOException ex) {
      throw new BeanDefinitionStoreException(
            "IOException parsing XML document from " + encodedResource.getResource(), ex);
   }
   finally {
      currentResources.remove(encodedResource);
      if (currentResources.isEmpty()) {
         this.resourcesCurrentlyBeingLoaded.remove();
      }
   }
}


protected int doLoadBeanDefinitions(InputSource inputSource, Resource resource)
      throws BeanDefinitionStoreException {
   try {
      
      Document doc = doLoadDocument(inputSource, resource);
      
      return registerBeanDefinitions(doc, resource);
   }
   catch (...
}


public int registerBeanDefinitions(Document doc, Resource resource) throws BeanDefinitionStoreException {
   BeanDefinitionDocumentReader documentReader = createBeanDefinitionDocumentReader();
   int countBefore = getRegistry().getBeanDefinitionCount();
   
   documentReader.registerBeanDefinitions(doc, createReaderContext(resource));
   return getRegistry().getBeanDefinitionCount() - countBefore;
}

@Override
public void registerBeanDefinitions(Document doc, XmlReaderContext readerContext) {
   this.readerContext = readerContext;
   logger.debug("Loading bean definitions");
   Element root = doc.getDocumentElement();
   
   doRegisterBeanDefinitions(root);
}         


```

经过漫长的链路，一个配置文件终于转换为一颗 DOM 树了，注意，这里指的是其中一个配置文件，不是所有的，读者可以看到上面有个 for 循环的。下面开始从根节点开始解析：

##### doRegisterBeanDefinitions：

```
protected void doRegisterBeanDefinitions(Element root) {
   
   
   
   BeanDefinitionParserDelegate parent = this.delegate;
   this.delegate = createDelegate(getReaderContext(), root, parent);

   if (this.delegate.isDefaultNamespace(root)) {
      
      
      
      String profileSpec = root.getAttribute(PROFILE_ATTRIBUTE);
      if (StringUtils.hasText(profileSpec)) {
         String[] specifiedProfiles = StringUtils.tokenizeToStringArray(
               profileSpec, BeanDefinitionParserDelegate.MULTI_VALUE_ATTRIBUTE_DELIMITERS);
         if (!getReaderContext().getEnvironment().acceptsProfiles(specifiedProfiles)) {
            if (logger.isInfoEnabled()) {
               logger.info("Skipped XML bean definition file due to specified profiles [" + profileSpec +
                     "] not matching: " + getReaderContext().getResource());
            }
            return;
         }
      }
   }

   preProcessXml(root); 
   
   parseBeanDefinitions(root, this.delegate);
   postProcessXml(root); 

   this.delegate = parent;
}


```

preProcessXml(root) 和 postProcessXml(root) 是给子类用的钩子方法，鉴于没有被使用到，也不是我们的重点，我们直接跳过。

这里涉及到了 profile 的问题，对于不了解的读者，我在附录中对 profile 做了简单的解释，读者可以参考一下。

接下来，看核心解析方法 parseBeanDefinitions(root, this.delegate) :

```
protected void parseBeanDefinitions(Element root, BeanDefinitionParserDelegate delegate) {
   if (delegate.isDefaultNamespace(root)) {
      NodeList nl = root.getChildNodes();
      for (int i = 0; i < nl.getLength(); i++) {
         Node node = nl.item(i);
         if (node instanceof Element) {
            Element ele = (Element) node;
            if (delegate.isDefaultNamespace(ele)) {
               
               parseDefaultElement(ele, delegate);
            }
            else {
               
               delegate.parseCustomElement(ele);
            }
         }
      }
   }
   else {
      delegate.parseCustomElement(root);
   }
}


```

从上面的代码，我们可以看到，对于每个配置来说，分别进入到 parseDefaultElement(ele, delegate); 和 delegate.parseCustomElement(ele); 这两个分支了。

parseDefaultElement(ele, delegate) 代表解析的节点是 `<import />`、`<alias />`、`<bean />`、`<beans />` 这几个。

这里的四个标签之所以是 **default** 的，是因为它们是处于这个 namespace 下定义的：

```
http://www.springframework.org/schema/beans


```

又到初学者科普时间，不熟悉 namespace 的读者请看下面贴出来的 xml，这里的第二行 **xmlns** 就是咯。

```
<beans xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns="http://www.springframework.org/schema/beans"
       xsi:schemaLocation="
            http://www.springframework.org/schema/beans
          http://www.springframework.org/schema/beans/spring-beans.xsd"
       default-autowire="byName">


```

而对于其他的标签，将进入到 delegate.parseCustomElement(element) 这个分支。如我们经常会使用到的 `<mvc />`、`<task />`、`<context />`、`<aop />`等。

这些属于扩展，如果需要使用上面这些 ” 非 default“ 标签，那么上面的 xml 头部的地方也要引入相应的 namespace 和 .xsd 文件的路径，如下所示。同时代码中需要提供相应的 parser 来解析，如 MvcNamespaceHandler、TaskNamespaceHandler、ContextNamespaceHandler、AopNamespaceHandler 等。

假如读者想分析 `<context:property-placeholder location="classpath:xx.properties" />` 的实现原理，就应该到 ContextNamespaceHandler 中找答案。

```
<beans xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns="http://www.springframework.org/schema/beans"
      xmlns:context="http://www.springframework.org/schema/context"
      xmlns:mvc="http://www.springframework.org/schema/mvc"
      xsi:schemaLocation="
           http://www.springframework.org/schema/beans 
           http://www.springframework.org/schema/beans/spring-beans.xsd
           http://www.springframework.org/schema/context
           http://www.springframework.org/schema/context/spring-context.xsd
           http://www.springframework.org/schema/mvc   
           http://www.springframework.org/schema/mvc/spring-mvc.xsd  
       "
      default-autowire="byName">


```

同理，以后你要是碰到 `<dubbo />` 这种标签，那么就应该搜一搜是不是有 DubboNamespaceHandler 这个处理类。

回过神来，看看处理 default 标签的方法：

```
private void parseDefaultElement(Element ele, BeanDefinitionParserDelegate delegate) {
   if (delegate.nodeNameEquals(ele, IMPORT_ELEMENT)) {
      
      importBeanDefinitionResource(ele);
   }
   else if (delegate.nodeNameEquals(ele, ALIAS_ELEMENT)) {
      
      
      processAliasRegistration(ele);
   }
   else if (delegate.nodeNameEquals(ele, BEAN_ELEMENT)) {
      
      processBeanDefinition(ele, delegate);
   }
   else if (delegate.nodeNameEquals(ele, NESTED_BEANS_ELEMENT)) {
      
      doRegisterBeanDefinitions(ele);
   }
}


```

如果每个标签都说，那我不吐血，你们都要吐血了。我们挑我们的重点 `<bean />` 标签出来说。

##### processBeanDefinition 解析 bean 标签

下面是 processBeanDefinition 解析 `<bean />` 标签：

// DefaultBeanDefinitionDocumentReader 298

```
protected void processBeanDefinition(Element ele, BeanDefinitionParserDelegate delegate) {
   
   BeanDefinitionHolder bdHolder = delegate.parseBeanDefinitionElement(ele);

   

   if (bdHolder != null) {
      bdHolder = delegate.decorateBeanDefinitionIfRequired(ele, bdHolder);
      try {
         
         BeanDefinitionReaderUtils.registerBeanDefinition(bdHolder, getReaderContext().getRegistry());
      }
      catch (BeanDefinitionStoreException ex) {
         getReaderContext().error("Failed to register bean definition with name '" +
               bdHolder.getBeanName() + "'", ele, ex);
      }
      
      getReaderContext().fireComponentRegistered(new BeanComponentDefinition(bdHolder));
   }
}


```

继续往下看怎么解析之前，我们先看下 **`<bean />`** 标签中可以定义哪些属性：

Property class 类的全限定名 name 可指定 id、name(用逗号、分号、空格分隔) scope 作用域 constructor arguments 指定构造参数 properties 设置属性的值 autowiring mode no(默认值)、byName、byType、 constructor lazy-initialization mode 是否懒加载 (如果被非懒加载的 bean 依赖了那么其实也就不能懒加载了) initialization method bean 属性设置完成后，会调用这个方法 destruction method bean 销毁后的回调方法 上面表格中的内容我想大家都非常熟悉吧，如果不熟悉，那就是你不够了解 Spring 的配置了。

简单地说就是像下面这样子：

```
<bean 
      scope="singleton" lazy-init="true" init-method="init" destroy-method="cleanup">

    
    <constructor-arg type="int" value="7500000"/>
    <constructor-arg />
    <constructor-arg index="0" value="7500000"/>

    
    <property >
        <ref bean="anotherExampleBean"/>
    </property>
    <property />
    <property />
</bean>


```

当然，除了上面举例出来的这些，还有 factory-bean、factory-method、`<lockup-method />`、`<replaced-method />`、`<meta />`、`<qualifier />` 这几个，大家是不是熟悉呢？自己检验一下自己对 Spring 中 bean 的了解程度。

有了以上这些知识以后，我们再继续往里看怎么解析 bean 元素，是怎么转换到 BeanDefinitionHolder 的。

// BeanDefinitionParserDelegate 428

```
public BeanDefinitionHolder parseBeanDefinitionElement(Element ele) {
    return parseBeanDefinitionElement(ele, null);
}

public BeanDefinitionHolder parseBeanDefinitionElement(Element ele, BeanDefinition containingBean) {
   String id = ele.getAttribute(ID_ATTRIBUTE);
   String nameAttr = ele.getAttribute(NAME_ATTRIBUTE);

   List<String> aliases = new ArrayList<String>();

   
   
   
   if (StringUtils.hasLength(nameAttr)) {
      String[] nameArr = StringUtils.tokenizeToStringArray(nameAttr, MULTI_VALUE_ATTRIBUTE_DELIMITERS);
      aliases.addAll(Arrays.asList(nameArr));
   }

   String beanName = id;
   
   if (!StringUtils.hasText(beanName) && !aliases.isEmpty()) {
      beanName = aliases.remove(0);
      if (logger.isDebugEnabled()) {
         logger.debug("No XML 'id' specified - using '" + beanName +
               "' as bean name and " + aliases + " as aliases");
      }
   }

   if (containingBean == null) {
      checkNameUniqueness(beanName, aliases, ele);
   }

   
   
   AbstractBeanDefinition beanDefinition = parseBeanDefinitionElement(ele, beanName, containingBean);

   
   if (beanDefinition != null) {
      
      
      if (!StringUtils.hasText(beanName)) {
         try {
            if (containingBean != null) {
               beanName = BeanDefinitionReaderUtils.generateBeanName(
                     beanDefinition, this.readerContext.getRegistry(), true);
            }
            else {
               
               
               

               beanName = this.readerContext.generateBeanName(beanDefinition);

               String beanClassName = beanDefinition.getBeanClassName();
               if (beanClassName != null &&
                     beanName.startsWith(beanClassName) && beanName.length() > beanClassName.length() &&
                     !this.readerContext.getRegistry().isBeanNameInUse(beanClassName)) {
                  
                  aliases.add(beanClassName);
               }
            }
            if (logger.isDebugEnabled()) {
               logger.debug("Neither XML 'id' nor 'name' specified - " +
                     "using generated bean name [" + beanName + "]");
            }
         }
         catch (Exception ex) {
            error(ex.getMessage(), ele);
            return null;
         }
      }
      String[] aliasesArray = StringUtils.toStringArray(aliases);
      
      return new BeanDefinitionHolder(beanDefinition, beanName, aliasesArray);
   }

   return null;
}


```

然后，我们再看看怎么根据配置创建 BeanDefinition 实例的：

```
public AbstractBeanDefinition parseBeanDefinitionElement(
      Element ele, String beanName, BeanDefinition containingBean) {

   this.parseState.push(new BeanEntry(beanName));

   String className = null;
   if (ele.hasAttribute(CLASS_ATTRIBUTE)) {
      className = ele.getAttribute(CLASS_ATTRIBUTE).trim();
   }

   try {
      String parent = null;
      if (ele.hasAttribute(PARENT_ATTRIBUTE)) {
         parent = ele.getAttribute(PARENT_ATTRIBUTE);
      }
      
      AbstractBeanDefinition bd = createBeanDefinition(className, parent);

      
      parseBeanDefinitionAttributes(ele, beanName, containingBean, bd);
      bd.setDescription(DomUtils.getChildElementValueByTagName(ele, DESCRIPTION_ELEMENT));

      

      
      parseMetaElements(ele, bd);
      
      parseLookupOverrideSubElements(ele, bd.getMethodOverrides());
      
      parseReplacedMethodSubElements(ele, bd.getMethodOverrides());
    
      parseConstructorArgElements(ele, bd);
      
      parsePropertyElements(ele, bd);
      
      parseQualifierElements(ele, bd);

      bd.setResource(this.readerContext.getResource());
      bd.setSource(extractSource(ele));

      return bd;
   }
   catch (ClassNotFoundException ex) {
      error("Bean class [" + className + "] not found", ele, ex);
   }
   catch (NoClassDefFoundError err) {
      error("Class that bean class [" + className + "] depends on not found", ele, err);
   }
   catch (Throwable ex) {
      error("Unexpected failure during bean definition parsing", ele, ex);
   }
   finally {
      this.parseState.pop();
   }

   return null;
}


```

到这里，我们已经完成了根据 `<bean />` 配置创建了一个 BeanDefinitionHolder 实例。注意，是一个。

我们回到解析 `<bean />` 的入口方法:

```
protected void processBeanDefinition(Element ele, BeanDefinitionParserDelegate delegate) {
   
   BeanDefinitionHolder bdHolder = delegate.parseBeanDefinitionElement(ele);
   if (bdHolder != null) {
      
      bdHolder = delegate.decorateBeanDefinitionIfRequired(ele, bdHolder);
      try {
         
         BeanDefinitionReaderUtils.registerBeanDefinition(bdHolder, getReaderContext().getRegistry());
      }
      catch (BeanDefinitionStoreException ex) {
         getReaderContext().error("Failed to register bean definition with name '" +
               bdHolder.getBeanName() + "'", ele, ex);
      }
      
      getReaderContext().fireComponentRegistered(new BeanComponentDefinition(bdHolder));
   }
}


```

大家再仔细看一下这块吧，我们后面就不回来说这个了。这里已经根据一个 `<bean />` 标签产生了一个 BeanDefinitionHolder 的实例，这个实例里面也就是一个 BeanDefinition 的实例和它的 beanName、aliases 这三个信息，注意，我们的关注点始终在 BeanDefinition 上：

```
public class BeanDefinitionHolder implements BeanMetadataElement {

  private final BeanDefinition beanDefinition;

  private final String beanName;

  private final String[] aliases;
...


```

然后我们准备注册这个 BeanDefinition，最后，把这个注册事件发送出去。

下面，我们开始说说注册 Bean 吧。

##### 注册 Bean

// BeanDefinitionReaderUtils 143

```
public static void registerBeanDefinition(
      BeanDefinitionHolder definitionHolder, BeanDefinitionRegistry registry)
      throws BeanDefinitionStoreException {

   String beanName = definitionHolder.getBeanName();
   
   registry.registerBeanDefinition(beanName, definitionHolder.getBeanDefinition());

   
   String[] aliases = definitionHolder.getAliases();
   if (aliases != null) {
      for (String alias : aliases) {
         
         
         registry.registerAlias(beanName, alias);
      }
   }
}


```

别名注册的放一边，毕竟它很简单，我们看看怎么注册 Bean。

// DefaultListableBeanFactory 793

```
@Override
public void registerBeanDefinition(String beanName, BeanDefinition beanDefinition)
      throws BeanDefinitionStoreException {

   Assert.hasText(beanName, "Bean name must not be empty");
   Assert.notNull(beanDefinition, "BeanDefinition must not be null");

   if (beanDefinition instanceof AbstractBeanDefinition) {
      try {
         ((AbstractBeanDefinition) beanDefinition).validate();
      }
      catch (BeanDefinitionValidationException ex) {
         throw new BeanDefinitionStoreException(...);
      }
   }

   
   BeanDefinition oldBeanDefinition;

   
   oldBeanDefinition = this.beanDefinitionMap.get(beanName);

   
   if (oldBeanDefinition != null) {
      if (!isAllowBeanDefinitionOverriding()) {
         
         throw new BeanDefinitionStoreException(beanDefinition.getResourceDescription()...
      }
      else if (oldBeanDefinition.getRole() < beanDefinition.getRole()) {
         
      }
      else if (!beanDefinition.equals(oldBeanDefinition)) {
         
      }
      else {
         
      }
      
      this.beanDefinitionMap.put(beanName, beanDefinition);
   }
   else {
      
      
      
      if (hasBeanCreationStarted()) {
         
         synchronized (this.beanDefinitionMap) {
            this.beanDefinitionMap.put(beanName, beanDefinition);
            List<String> updatedDefinitions = new ArrayList<String>(this.beanDefinitionNames.size() + 1);
            updatedDefinitions.addAll(this.beanDefinitionNames);
            updatedDefinitions.add(beanName);
            this.beanDefinitionNames = updatedDefinitions;
            if (this.manualSingletonNames.contains(beanName)) {
               Set<String> updatedSingletons = new LinkedHashSet<String>(this.manualSingletonNames);
               updatedSingletons.remove(beanName);
               this.manualSingletonNames = updatedSingletons;
            }
         }
      }
      else {
         

         
         this.beanDefinitionMap.put(beanName, beanDefinition);
         
         this.beanDefinitionNames.add(beanName);
         
         
         
         
         
         
         this.manualSingletonNames.remove(beanName);
      }
      
      this.frozenBeanDefinitionNames = null;
   }

   if (oldBeanDefinition != null || containsSingleton(beanName)) {
      resetBeanDefinition(beanName);
   }
}


```

总结一下，到这里已经初始化了 Bean 容器，`<bean />` 配置也相应的转换为了一个个 BeanDefinition，然后注册了各个 BeanDefinition 到注册中心，并且发送了注册事件。

--------- 分割线 ---------

到这里是一个分水岭，前面的内容都还算比较简单，不过应该也比较繁琐，大家要清楚地知道前面都做了哪些事情。

### Bean 容器实例化完成后

说到这里，我们回到 refresh() 方法，我重新贴了一遍代码，看看我们说到哪了。是的，我们才说完 obtainFreshBeanFactory() 方法。

考虑到篇幅，这里开始大幅缩减掉没必要详细介绍的部分，大家直接看下面的代码中的注释就好了。

```
@Override
public void refresh() throws BeansException, IllegalStateException {
   
   synchronized (this.startupShutdownMonitor) {

      
      prepareRefresh();

      
      
      
      ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

      
      
      prepareBeanFactory(beanFactory);

      try {
         
         

         
         
         postProcessBeanFactory(beanFactory);
         
         invokeBeanFactoryPostProcessors(beanFactory);          



         
         
         
         registerBeanPostProcessors(beanFactory);

         
         initMessageSource();

         
         initApplicationEventMulticaster();

         
         
         onRefresh();

         
         registerListeners();

         
         
         
         finishBeanFactoryInitialization(beanFactory);

         
         finishRefresh();
      }

      catch (BeansException ex) {
         if (logger.isWarnEnabled()) {
            logger.warn("Exception encountered during context initialization - " +
                  "cancelling refresh attempt: " + ex);
         }

         
         
         destroyBeans();

         
         cancelRefresh(ex);

         
         throw ex;
      }

      finally {
         
         
         resetCommonCaches();
      }
   }
}


```

### 准备 Bean 容器: prepareBeanFactory

之前我们说过，Spring 把我们在 xml 配置的 bean 都注册以后，会 "手动" 注册一些特殊的 bean。

这里简单介绍下 prepareBeanFactory(factory) 方法：

```
protected void prepareBeanFactory(ConfigurableListableBeanFactory beanFactory) {
   
   
   beanFactory.setBeanClassLoader(getClassLoader());

   
   beanFactory.setBeanExpressionResolver(new StandardBeanExpressionResolver(beanFactory.getBeanClassLoader()));
   
   beanFactory.addPropertyEditorRegistrar(new ResourceEditorRegistrar(this, getEnvironment()));

   
   
   
   
   
   beanFactory.addBeanPostProcessor(new ApplicationContextAwareProcessor(this));

   
   
   beanFactory.ignoreDependencyInterface(EnvironmentAware.class);
   beanFactory.ignoreDependencyInterface(EmbeddedValueResolverAware.class);
   beanFactory.ignoreDependencyInterface(ResourceLoaderAware.class);
   beanFactory.ignoreDependencyInterface(ApplicationEventPublisherAware.class);
   beanFactory.ignoreDependencyInterface(MessageSourceAware.class);
   beanFactory.ignoreDependencyInterface(ApplicationContextAware.class);

   
   beanFactory.registerResolvableDependency(BeanFactory.class, beanFactory);
   beanFactory.registerResolvableDependency(ResourceLoader.class, this);
   beanFactory.registerResolvableDependency(ApplicationEventPublisher.class, this);
   beanFactory.registerResolvableDependency(ApplicationContext.class, this);

   
   
   beanFactory.addBeanPostProcessor(new ApplicationListenerDetector(this));

   
   
   
   if (beanFactory.containsBean(LOAD_TIME_WEAVER_BEAN_NAME)) {
      beanFactory.addBeanPostProcessor(new LoadTimeWeaverAwareProcessor(beanFactory));
      
      beanFactory.setTempClassLoader(new ContextTypeMatchClassLoader(beanFactory.getBeanClassLoader()));
   }

   

   
   if (!beanFactory.containsLocalBean(ENVIRONMENT_BEAN_NAME)) {
      beanFactory.registerSingleton(ENVIRONMENT_BEAN_NAME, getEnvironment());
   }
   
   if (!beanFactory.containsLocalBean(SYSTEM_PROPERTIES_BEAN_NAME)) {
      beanFactory.registerSingleton(SYSTEM_PROPERTIES_BEAN_NAME, getEnvironment().getSystemProperties());
   }
   
   if (!beanFactory.containsLocalBean(SYSTEM_ENVIRONMENT_BEAN_NAME)) {
      beanFactory.registerSingleton(SYSTEM_ENVIRONMENT_BEAN_NAME, getEnvironment().getSystemEnvironment());
   }
}


```

在上面这块代码中，Spring 对一些特殊的 bean 进行了处理，读者如果暂时还不能消化它们也没有关系，慢慢往下看。

### 初始化所有的 singleton beans

我们的重点当然是 `finishBeanFactoryInitialization(beanFactory);` 这个巨头了，这里会负责初始化所有的 singleton beans。

注意，后面的描述中，我都会使用**初始化**或**预初始化**来代表这个阶段，Spring 会在这个阶段完成所有的 singleton beans 的实例化。

我们来总结一下，到目前为止，应该说 BeanFactory 已经创建完成，并且所有的实现了 BeanFactoryPostProcessor 接口的 Bean 都已经初始化并且其中的 postProcessBeanFactory(factory) 方法已经得到回调执行了。而且 Spring 已经 “手动” 注册了一些特殊的 Bean，如 `environment`、`systemProperties` 等。

剩下的就是初始化 singleton beans 了，我们知道它们是单例的，如果没有设置懒加载，那么 Spring 会在接下来初始化所有的 singleton beans。

// AbstractApplicationContext.java 834

```
protected void finishBeanFactoryInitialization(ConfigurableListableBeanFactory beanFactory) {

   
   
   
   if (beanFactory.containsBean(CONVERSION_SERVICE_BEAN_NAME) &&
         beanFactory.isTypeMatch(CONVERSION_SERVICE_BEAN_NAME, ConversionService.class)) {
      beanFactory.setConversionService(
            beanFactory.getBean(CONVERSION_SERVICE_BEAN_NAME, ConversionService.class));
   }

   
   
   
   if (!beanFactory.hasEmbeddedValueResolver()) {
      beanFactory.addEmbeddedValueResolver(new StringValueResolver() {
         @Override
         public String resolveStringValue(String strVal) {
            return getEnvironment().resolvePlaceholders(strVal);
         }
      });
   }

   
   
   String[] weaverAwareNames = beanFactory.getBeanNamesForType(LoadTimeWeaverAware.class, false, false);
   for (String weaverAwareName : weaverAwareNames) {
      getBean(weaverAwareName);
   }

   
   beanFactory.setTempClassLoader(null);

   
   
   beanFactory.freezeConfiguration();

   
   beanFactory.preInstantiateSingletons();
}


```

从上面最后一行往里看，我们就又回到 DefaultListableBeanFactory 这个类了，这个类大家应该都不陌生了吧。

#### preInstantiateSingletons

// DefaultListableBeanFactory 728

```
@Override
public void preInstantiateSingletons() throws BeansException {
   if (this.logger.isDebugEnabled()) {
      this.logger.debug("Pre-instantiating singletons in " + this);
   }
   
   List<String> beanNames = new ArrayList<String>(this.beanDefinitionNames);

   
   for (String beanName : beanNames) {

      
      
      RootBeanDefinition bd = getMergedLocalBeanDefinition(beanName);

      
      if (!bd.isAbstract() && bd.isSingleton() && !bd.isLazyInit()) {
         
         if (isFactoryBean(beanName)) {
            
            final FactoryBean<?> factory = (FactoryBean<?>) getBean(FACTORY_BEAN_PREFIX + beanName);
            
            boolean isEagerInit;
            if (System.getSecurityManager() != null && factory instanceof SmartFactoryBean) {
               isEagerInit = AccessController.doPrivileged(new PrivilegedAction<Boolean>() {
                  @Override
                  public Boolean run() {
                     return ((SmartFactoryBean<?>) factory).isEagerInit();
                  }
               }, getAccessControlContext());
            }
            else {
               isEagerInit = (factory instanceof SmartFactoryBean &&
                     ((SmartFactoryBean<?>) factory).isEagerInit());
            }
            if (isEagerInit) {

               getBean(beanName);
            }
         }
         else {
            
            getBean(beanName);
         }
      }
   }

   
   
   for (String beanName : beanNames) {
      Object singletonInstance = getSingleton(beanName);
      if (singletonInstance instanceof SmartInitializingSingleton) {
         final SmartInitializingSingleton smartSingleton = (SmartInitializingSingleton) singletonInstance;
         if (System.getSecurityManager() != null) {
            AccessController.doPrivileged(new PrivilegedAction<Object>() {
               @Override
               public Object run() {
                  smartSingleton.afterSingletonsInstantiated();
                  return null;
               }
            }, getAccessControlContext());
         }
         else {
            smartSingleton.afterSingletonsInstantiated();
         }
      }
   }
}


```

接下来，我们就进入到 getBean(beanName) 方法了，这个方法我们经常用来从 BeanFactory 中获取一个 Bean，而初始化的过程也封装到了这个方法里。

#### getBean

在继续前进之前，读者应该具备 FactoryBean 的知识，如果读者还不熟悉，请移步附录部分了解 FactoryBean。

// AbstractBeanFactory 196

```
@Override
public Object getBean(String name) throws BeansException {
   return doGetBean(name, null, null, false);
}



@SuppressWarnings("unchecked")
protected <T> T doGetBean(
      final String name, final Class<T> requiredType, final Object[] args, boolean typeCheckOnly)
      throws BeansException {
   
   
   final String beanName = transformedBeanName(name);

   
   Object bean; 

   
   Object sharedInstance = getSingleton(beanName);

   
   
   if (sharedInstance != null && args == null) {
      if (logger.isDebugEnabled()) {
         if (isSingletonCurrentlyInCreation(beanName)) {
            logger.debug("...");
         }
         else {
            logger.debug("Returning cached instance of singleton bean '" + beanName + "'");
         }
      }
      
      
      
      bean = getObjectForBeanInstance(sharedInstance, name, beanName, null);
   }

   else {
      if (isPrototypeCurrentlyInCreation(beanName)) {
         
         
         throw new BeanCurrentlyInCreationException(beanName);
      }

      
      BeanFactory parentBeanFactory = getParentBeanFactory();
      if (parentBeanFactory != null && !containsBeanDefinition(beanName)) {
         
         String nameToLookup = originalBeanName(name);
         if (args != null) {
            
            return (T) parentBeanFactory.getBean(nameToLookup, args);
         }
         else {
            
            return parentBeanFactory.getBean(nameToLookup, requiredType);
         }
      }

      if (!typeCheckOnly) {
         
         markBeanAsCreated(beanName);
      }

      
      try {
         final RootBeanDefinition mbd = getMergedLocalBeanDefinition(beanName);
         checkMergedBeanDefinition(mbd, beanName, args);

         
         
         String[] dependsOn = mbd.getDependsOn();
         if (dependsOn != null) {
            for (String dep : dependsOn) {
               
               if (isDependent(beanName, dep)) {
                  throw new BeanCreationException(mbd.getResourceDescription(), beanName,
                        "Circular depends-on relationship between '" + beanName + "' and '" + dep + "'");
               }
               
               registerDependentBean(dep, beanName);
               
               getBean(dep);
            }
         }

         
         if (mbd.isSingleton()) {
            sharedInstance = getSingleton(beanName, new ObjectFactory<Object>() {
               @Override
               public Object getObject() throws BeansException {
                  try {
                     
                     return createBean(beanName, mbd, args);
                  }
                  catch (BeansException ex) {
                     destroySingleton(beanName);
                     throw ex;
                  }
               }
            });
            bean = getObjectForBeanInstance(sharedInstance, name, beanName, mbd);
         }

         
         else if (mbd.isPrototype()) {
            
            Object prototypeInstance = null;
            try {
               beforePrototypeCreation(beanName);
               
               prototypeInstance = createBean(beanName, mbd, args);
            }
            finally {
               afterPrototypeCreation(beanName);
            }
            bean = getObjectForBeanInstance(prototypeInstance, name, beanName, mbd);
         }

         
         else {
            String scopeName = mbd.getScope();
            final Scope scope = this.scopes.get(scopeName);
            if (scope == null) {
               throw new IllegalStateException("No Scope registered for scope name '" + scopeName + "'");
            }
            try {
               Object scopedInstance = scope.get(beanName, new ObjectFactory<Object>() {
                  @Override
                  public Object getObject() throws BeansException {
                     beforePrototypeCreation(beanName);
                     try {
                        
                        return createBean(beanName, mbd, args);
                     }
                     finally {
                        afterPrototypeCreation(beanName);
                     }
                  }
               });
               bean = getObjectForBeanInstance(scopedInstance, name, beanName, mbd);
            }
            catch (IllegalStateException ex) {
               throw new BeanCreationException(beanName,
                     "Scope '" + scopeName + "' is not active for the current thread; consider " +
                     "defining a scoped proxy for this bean if you intend to refer to it from a singleton",
                     ex);
            }
         }
      }
      catch (BeansException ex) {
         cleanupAfterBeanCreationFailure(beanName);
         throw ex;
      }
   }

   
   if (requiredType != null && bean != null && !requiredType.isInstance(bean)) {
      try {
         return getTypeConverter().convertIfNecessary(bean, requiredType);
      }
      catch (TypeMismatchException ex) {
         if (logger.isDebugEnabled()) {
            logger.debug("Failed to convert bean '" + name + "' to required type '" +
                  ClassUtils.getQualifiedName(requiredType) + "'", ex);
         }
         throw new BeanNotOfRequiredTypeException(name, requiredType, bean.getClass());
      }
   }
   return (T) bean;
}


```

大家应该也猜到了，接下来当然是分析 createBean 方法：

```
protected abstract Object createBean(String beanName, RootBeanDefinition mbd, Object[] args) throws BeanCreationException;


```

第三个参数 args 数组代表创建实例需要的参数，不就是给构造方法用的参数，或者是工厂 Bean 的参数嘛，不过要注意，在我们的初始化阶段，args 是 null。

这回我们要到一个新的类了 AbstractAutowireCapableBeanFactory，看类名，AutowireCapable？类名是不是也说明了点问题了。

主要是为了以下场景，采用 @Autowired 注解注入属性值：

```
public class MessageServiceImpl implements MessageService {
    @Autowired
    private UserService userService;

    public String getMessage() {
        return userService.getMessage();
    }
}

<bean />


```

以上这种属于混用了 xml 和 注解 两种方式的配置方式，Spring 会处理这种情况。

好了，读者要知道这么回事就可以了，继续向前。

// AbstractAutowireCapableBeanFactory 447

```
@Override
protected Object createBean(String beanName, RootBeanDefinition mbd, Object[] args) throws BeanCreationException {
   if (logger.isDebugEnabled()) {
      logger.debug("Creating instance of bean '" + beanName + "'");
   }
   RootBeanDefinition mbdToUse = mbd;

   
   Class<?> resolvedClass = resolveBeanClass(mbd, beanName);
   if (resolvedClass != null && !mbd.hasBeanClass() && mbd.getBeanClassName() != null) {
      mbdToUse = new RootBeanDefinition(mbd);
      mbdToUse.setBeanClass(resolvedClass);
   }

   
   
   
   try {
      mbdToUse.prepareMethodOverrides();
   }
   catch (BeanDefinitionValidationException ex) {
      throw new BeanDefinitionStoreException(mbdToUse.getResourceDescription(),
            beanName, "Validation of method overrides failed", ex);
   }

   try {
      
      
      Object bean = resolveBeforeInstantiation(beanName, mbdToUse);
      if (bean != null) {
         return bean; 
      }
   }
   catch (Throwable ex) {
      throw new BeanCreationException(mbdToUse.getResourceDescription(), beanName,
            "BeanPostProcessor before instantiation of bean failed", ex);
   }
   
   Object beanInstance = doCreateBean(beanName, mbdToUse, args);
   if (logger.isDebugEnabled()) {
      logger.debug("Finished creating instance of bean '" + beanName + "'");
   }
   return beanInstance;
}


```

#### 创建 Bean

我们继续往里看 doCreateBean 这个方法：

```
protected Object doCreateBean(final String beanName, final RootBeanDefinition mbd, final Object[] args)
      throws BeanCreationException {

   
   BeanWrapper instanceWrapper = null;
   if (mbd.isSingleton()) {
      instanceWrapper = this.factoryBeanInstanceCache.remove(beanName);
   }
   if (instanceWrapper == null) {
      
      instanceWrapper = createBeanInstance(beanName, mbd, args);
   }
   
   final Object bean = (instanceWrapper != null ? instanceWrapper.getWrappedInstance() : null);
   
   Class<?> beanType = (instanceWrapper != null ? instanceWrapper.getWrappedClass() : null);
   mbd.resolvedTargetType = beanType;

   
   synchronized (mbd.postProcessingLock) {
      if (!mbd.postProcessed) {
         try {
            
            applyMergedBeanDefinitionPostProcessors(mbd, beanType, beanName);
         }
         catch (Throwable ex) {
            throw new BeanCreationException(mbd.getResourceDescription(), beanName,
                  "Post-processing of merged bean definition failed", ex);
         }
         mbd.postProcessed = true;
      }
   }

   
   
   
   boolean earlySingletonExposure = (mbd.isSingleton() && this.allowCircularReferences &&
         isSingletonCurrentlyInCreation(beanName));
   if (earlySingletonExposure) {
      if (logger.isDebugEnabled()) {
         logger.debug("Eagerly caching bean '" + beanName +
               "' to allow for resolving potential circular references");
      }
      addSingletonFactory(beanName, new ObjectFactory<Object>() {
         @Override
         public Object getObject() throws BeansException {
            return getEarlyBeanReference(beanName, mbd, bean);
         }
      });
   }

   
   Object exposedObject = bean;
   try {
      
      populateBean(beanName, mbd, instanceWrapper);
      if (exposedObject != null) {
         
         
         exposedObject = initializeBean(beanName, exposedObject, mbd);
      }
   }
   catch (Throwable ex) {
      if (ex instanceof BeanCreationException && beanName.equals(((BeanCreationException) ex).getBeanName())) {
         throw (BeanCreationException) ex;
      }
      else {
         throw new BeanCreationException(
               mbd.getResourceDescription(), beanName, "Initialization of bean failed", ex);
      }
   }

   if (earlySingletonExposure) {
      
      Object earlySingletonReference = getSingleton(beanName, false);
      if (earlySingletonReference != null) {
         if (exposedObject == bean) {
            exposedObject = earlySingletonReference;
         }
         else if (!this.allowRawInjectionDespiteWrapping && hasDependentBean(beanName)) {
            String[] dependentBeans = getDependentBeans(beanName);
            Set<String> actualDependentBeans = new LinkedHashSet<String>(dependentBeans.length);
            for (String dependentBean : dependentBeans) {
               if (!removeSingletonIfCreatedForTypeCheckOnly(dependentBean)) {
                  actualDependentBeans.add(dependentBean);
               }
            }
            if (!actualDependentBeans.isEmpty()) {
               throw new BeanCurrentlyInCreationException(beanName,
                     "Bean with name '" + beanName + "' has been injected into other beans [" +
                     StringUtils.collectionToCommaDelimitedString(actualDependentBeans) +
                     "] in its raw version as part of a circular reference, but has eventually been " +
                     "wrapped. This means that said other beans do not use the final version of the " +
                     "bean. This is often the result of over-eager type matching - consider using " +
                     "'getBeanNamesOfType' with the 'allowEagerInit' flag turned off, for example.");
            }
         }
      }
   }

   
   try {
      registerDisposableBeanIfNecessary(beanName, bean, mbd);
   }
   catch (BeanDefinitionValidationException ex) {
      throw new BeanCreationException(
            mbd.getResourceDescription(), beanName, "Invalid destruction signature", ex);
   }

   return exposedObject;
}


```

到这里，我们已经分析完了 doCreateBean 方法，总的来说，我们已经说完了整个初始化流程。

接下来我们挑 doCreateBean 中的三个细节出来说说。一个是创建 Bean 实例的 createBeanInstance 方法，一个是依赖注入的 populateBean 方法，还有就是回调方法 initializeBean。

注意了，接下来的这三个方法要认真说那也是极其复杂的，很多地方我就点到为止了，感兴趣的读者可以自己往里看，最好就是碰到不懂的，自己写代码去调试它。

##### 创建 Bean 实例

我们先看看 createBeanInstance 方法。需要说明的是，这个方法如果每个分支都分析下去，必然也是极其复杂冗长的，我们挑重点说。此方法的目的就是实例化我们指定的类。

```
protected BeanWrapper createBeanInstance(String beanName, RootBeanDefinition mbd, Object[] args) {
   
   Class<?> beanClass = resolveBeanClass(mbd, beanName);

   
   if (beanClass != null && !Modifier.isPublic(beanClass.getModifiers()) && !mbd.isNonPublicAccessAllowed()) {
      throw new BeanCreationException(mbd.getResourceDescription(), beanName,
            "Bean class isn't public, and non-public access not allowed: " + beanClass.getName());
   }

   if (mbd.getFactoryMethodName() != null)  {
      
      return instantiateUsingFactoryMethod(beanName, mbd, args);
   }

   
   
   boolean resolved = false;
   boolean autowireNecessary = false;
   if (args == null) {
      synchronized (mbd.constructorArgumentLock) {
         if (mbd.resolvedConstructorOrFactoryMethod != null) {
            resolved = true;
            autowireNecessary = mbd.constructorArgumentsResolved;
         }
      }
   }
   if (resolved) {
      if (autowireNecessary) {
         
         return autowireConstructor(beanName, mbd, null, null);
      }
      else {
         
         return instantiateBean(beanName, mbd);
      }
   }

   
   Constructor<?>[] ctors = determineConstructorsFromBeanPostProcessors(beanClass, beanName);
   if (ctors != null ||
         mbd.getResolvedAutowireMode() == RootBeanDefinition.AUTOWIRE_CONSTRUCTOR ||
         mbd.hasConstructorArgumentValues() || !ObjectUtils.isEmpty(args))  {
      
      return autowireConstructor(beanName, mbd, ctors, args);
   }

   
   return instantiateBean(beanName, mbd);
}


```

挑个简单的**无参构造函数**构造实例来看看：

```
protected BeanWrapper instantiateBean(final String beanName, final RootBeanDefinition mbd) {
   try {
      Object beanInstance;
      final BeanFactory parent = this;
      if (System.getSecurityManager() != null) {
         beanInstance = AccessController.doPrivileged(new PrivilegedAction<Object>() {
            @Override
            public Object run() {

               return getInstantiationStrategy().instantiate(mbd, beanName, parent);
            }
         }, getAccessControlContext());
      }
      else {
         
         beanInstance = getInstantiationStrategy().instantiate(mbd, beanName, parent);
      }
      
      BeanWrapper bw = new BeanWrapperImpl(beanInstance);
      initBeanWrapper(bw);
      return bw;
   }
   catch (Throwable ex) {
      throw new BeanCreationException(
            mbd.getResourceDescription(), beanName, "Instantiation of bean failed", ex);
   }
}


```

我们可以看到，关键的地方在于：

```
beanInstance = getInstantiationStrategy().instantiate(mbd, beanName, parent);


```

这里会进行实际的实例化过程，我们进去看看:

// SimpleInstantiationStrategy 59

```
@Override
public Object instantiate(RootBeanDefinition bd, String beanName, BeanFactory owner) {

   
   
   if (bd.getMethodOverrides().isEmpty()) {
      Constructor<?> constructorToUse;
      synchronized (bd.constructorArgumentLock) {
         constructorToUse = (Constructor<?>) bd.resolvedConstructorOrFactoryMethod;
         if (constructorToUse == null) {
            final Class<?> clazz = bd.getBeanClass();
            if (clazz.isInterface()) {
               throw new BeanInstantiationException(clazz, "Specified class is an interface");
            }
            try {
               if (System.getSecurityManager() != null) {
                  constructorToUse = AccessController.doPrivileged(new PrivilegedExceptionAction<Constructor<?>>() {
                     @Override
                     public Constructor<?> run() throws Exception {
                        return clazz.getDeclaredConstructor((Class[]) null);
                     }
                  });
               }
               else {
                  constructorToUse = clazz.getDeclaredConstructor((Class[]) null);
               }
               bd.resolvedConstructorOrFactoryMethod = constructorToUse;
            }
            catch (Throwable ex) {
               throw new BeanInstantiationException(clazz, "No default constructor found", ex);
            }
         }
      }
      
      return BeanUtils.instantiateClass(constructorToUse);
   }
   else {
      
      
      return instantiateWithMethodInjection(bd, beanName, owner);
   }
}


```

到这里，我们就算实例化完成了。我们开始说怎么进行属性注入。

##### bean 属性注入

看完了 createBeanInstance(...) 方法，我们来看看 populateBean(...) 方法，该方法负责进行属性设值，处理依赖。

// AbstractAutowireCapableBeanFactory 1203

```
protected void populateBean(String beanName, RootBeanDefinition mbd, BeanWrapper bw) {
   
   PropertyValues pvs = mbd.getPropertyValues();

   if (bw == null) {
      if (!pvs.isEmpty()) {
         throw new BeanCreationException(
               mbd.getResourceDescription(), beanName, "Cannot apply property values to null instance");
      }
      else {
         
         return;
      }
   }

   
   
   
   boolean continueWithPropertyPopulation = true;
   if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
      for (BeanPostProcessor bp : getBeanPostProcessors()) {
         if (bp instanceof InstantiationAwareBeanPostProcessor) {
            InstantiationAwareBeanPostProcessor ibp = (InstantiationAwareBeanPostProcessor) bp;
            
            if (!ibp.postProcessAfterInstantiation(bw.getWrappedInstance(), beanName)) {
               continueWithPropertyPopulation = false;
               break;
            }
         }
      }
   }

   if (!continueWithPropertyPopulation) {
      return;
   }

   if (mbd.getResolvedAutowireMode() == RootBeanDefinition.AUTOWIRE_BY_NAME ||
         mbd.getResolvedAutowireMode() == RootBeanDefinition.AUTOWIRE_BY_TYPE) {
      MutablePropertyValues newPvs = new MutablePropertyValues(pvs);

      
      if (mbd.getResolvedAutowireMode() == RootBeanDefinition.AUTOWIRE_BY_NAME) {
         autowireByName(beanName, mbd, bw, newPvs);
      }

      
      if (mbd.getResolvedAutowireMode() == RootBeanDefinition.AUTOWIRE_BY_TYPE) {
         autowireByType(beanName, mbd, bw, newPvs);
      }

      pvs = newPvs;
   }

   boolean hasInstAwareBpps = hasInstantiationAwareBeanPostProcessors();
   boolean needsDepCheck = (mbd.getDependencyCheck() != RootBeanDefinition.DEPENDENCY_CHECK_NONE);

   if (hasInstAwareBpps || needsDepCheck) {
      PropertyDescriptor[] filteredPds = filterPropertyDescriptorsForDependencyCheck(bw, mbd.allowCaching);
      if (hasInstAwareBpps) {
         for (BeanPostProcessor bp : getBeanPostProcessors()) {
            if (bp instanceof InstantiationAwareBeanPostProcessor) {
               InstantiationAwareBeanPostProcessor ibp = (InstantiationAwareBeanPostProcessor) bp;
               
               
               pvs = ibp.postProcessPropertyValues(pvs, filteredPds, bw.getWrappedInstance(), beanName);
               if (pvs == null) {
                  return;
               }
            }
         }
      }
      if (needsDepCheck) {
         checkDependencies(beanName, mbd, filteredPds, pvs);
      }
   }
   
   applyPropertyValues(beanName, mbd, bw, pvs);
}


```

##### initializeBean

属性注入完成后，这一步其实就是处理各种回调了，这块代码比较简单。

```
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
      
      invokeAwareMethods(beanName, bean);
   }

   Object wrappedBean = bean;
   if (mbd == null || !mbd.isSynthetic()) {
      
      wrappedBean = applyBeanPostProcessorsBeforeInitialization(wrappedBean, beanName);
   }

   try {
      
      
      invokeInitMethods(beanName, wrappedBean, mbd);
   }
   catch (Throwable ex) {
      throw new BeanCreationException(
            (mbd != null ? mbd.getResourceDescription() : null),
            beanName, "Invocation of init method failed", ex);
   }

   if (mbd == null || !mbd.isSynthetic()) {
      
      wrappedBean = applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
   }
   return wrappedBean;
}


```

大家发现没有，BeanPostProcessor 的两个回调都发生在这边，只不过中间处理了 init-method，是不是和读者原来的认知有点不一样了？

附录
--

### id 和 name

每个 Bean 在 Spring 容器中都有一个唯一的名字（beanName）和 0 个或多个别名（aliases）。

我们从 Spring 容器中获取 Bean 的时候，可以根据 beanName，也可以通过别名。

```
beanFactory.getBean("beanName or alias");


```

在配置 `<bean />` 的过程中，我们可以配置 id 和 name，看几个例子就知道是怎么回事了。

```
<bean >


```

以上配置的结果就是：beanName 为 messageService，别名有 3 个，分别为 m1、m2、m3。

```
<bean  />


```

以上配置的结果就是：beanName 为 m1，别名有 2 个，分别为 m2、m3。

```
<bean>


```

beanName 为：com.javadoop.example.MessageServiceImpl#0，

别名 1 个，为： com.javadoop.example.MessageServiceImpl

```
<bean>


```

以上配置的结果就是：beanName 为 messageService，没有别名。

### 配置是否允许 Bean 覆盖、是否允许循环依赖

我们说过，默认情况下，allowBeanDefinitionOverriding 属性为 null。如果在同一配置文件中 Bean id 或 name 重复了，会抛错，但是如果不是同一配置文件中，会发生覆盖。

可是有些时候我们希望在系统启动的过程中就严格杜绝发生 Bean 覆盖，因为万一出现这种情况，会增加我们排查问题的成本。

循环依赖说的是 A 依赖 B，而 B 又依赖 A。或者是 A 依赖 B，B 依赖 C，而 C 却依赖 A。默认 allowCircularReferences 也是 null。

它们两个属性是一起出现的，必然可以在同一个地方一起进行配置。

添加这两个属性的作者 Juergen Hoeller 在这个 [jira](https://jira.spring.io/browse/SPR-4374) 的讨论中说明了怎么配置这两个属性。

```
public class NoBeanOverridingContextLoader extends ContextLoader {

  @Override
  protected void customizeContext(ServletContext servletContext, ConfigurableWebApplicationContext applicationContext) {
    super.customizeContext(servletContext, applicationContext);
    AbstractRefreshableApplicationContext arac = (AbstractRefreshableApplicationContext) applicationContext;
    arac.setAllowBeanDefinitionOverriding(false);
  }
}

public class MyContextLoaderListener extends org.springframework.web.context.ContextLoaderListener {

  @Override
  protected ContextLoader createContextLoader() {
    return new NoBeanOverridingContextLoader();
  }

}

<listener>
    <listener-class>com.javadoop.MyContextLoaderListener</listener-class>  
</listener>


```

如果以上方式不能满足你的需求，请参考这个链接：[解决 spring 中不同配置文件中存在 name 或者 id 相同的 bean 可能引起的问题](http://blog.csdn.net/zgmzyr/article/details/39380477)

### profile

我们可以把不同环境的配置分别配置到单独的文件中，举个例子：

```
<beans profile="development"
    xmlns="http://www.springframework.org/schema/beans"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:jdbc="http://www.springframework.org/schema/jdbc"
    xsi:schemaLocation="...">

    <jdbc:embedded-database>
        <jdbc:script location="classpath:com/bank/config/sql/schema.sql"/>
        <jdbc:script location="classpath:com/bank/config/sql/test-data.sql"/>
    </jdbc:embedded-database>
</beans>

<beans profile="production"
    xmlns="http://www.springframework.org/schema/beans"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:jee="http://www.springframework.org/schema/jee"
    xsi:schemaLocation="...">

    <jee:jndi-lookup jndi-/>
</beans>


```

应该不必做过多解释了吧，看每个文件第一行的 profile=""。

当然，我们也可以在一个配置文件中使用：

```
<beans xmlns="http://www.springframework.org/schema/beans"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:jdbc="http://www.springframework.org/schema/jdbc"
    xmlns:jee="http://www.springframework.org/schema/jee"
    xsi:schemaLocation="...">

    <beans profile="development">
        <jdbc:embedded-database>
            <jdbc:script location="classpath:com/bank/config/sql/schema.sql"/>
            <jdbc:script location="classpath:com/bank/config/sql/test-data.sql"/>
        </jdbc:embedded-database>
    </beans>

    <beans profile="production">
        <jee:jndi-lookup jndi-/>
    </beans>
</beans>


```

理解起来也很简单吧。

接下来的问题是，怎么使用特定的 profile 呢？Spring 在启动的过程中，会去寻找 “spring.profiles.active” 的属性值，根据这个属性值来的。那怎么配置这个值呢？

Spring 会在这几个地方寻找 spring.profiles.active 的属性值：操作系统环境变量、JVM 系统变量、web.xml 中定义的参数、JNDI。

最简单的方式莫过于在程序启动的时候指定：

```
-Dspring.profiles.active="profile1,profile2"


```

profile 可以激活多个

当然，我们也可以通过代码的形式从 Environment 中设置 profile：

```
AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext();
ctx.getEnvironment().setActiveProfiles("development");
ctx.register(SomeConfig.class, StandaloneDataConfig.class, JndiDataConfig.class);
ctx.refresh(); 


```

如果是 Spring Boot 的话更简单，我们一般会创建 application.properties、application-dev.properties、application-prod.properties 等文件，其中 application.properties 配置各个环境通用的配置，application-{profile}.properties 中配置特定环境的配置，然后在启动的时候指定 profile：

```
java -Dspring.profiles.active=prod -jar JavaDoop.jar


```

如果是单元测试中使用的话，在测试类中使用 @ActiveProfiles 指定，这里就不展开了。

### 工厂模式生成 Bean

请读者注意 factory-bean 和 FactoryBean 的区别。这节说的是前者，是说静态工厂或实例工厂，而后者是 Spring 中的特殊接口，代表一类特殊的 Bean，附录的下面一节会介绍 FactoryBean。

设计模式里，工厂方法模式分静态工厂和实例工厂，我们分别看看 Spring 中怎么配置这两个，来个代码示例就什么都清楚了。

静态工厂：

```
<bean
   
    factory-method="createInstance"/>

public class ClientService {
    private static ClientService clientService = new ClientService();
    private ClientService() {}

    
    public static ClientService createInstance() {
        return clientService;
    }
}


```

实例工厂：

```
<bean>
    
</bean>

<bean
    factory-bean="serviceLocator"
    factory-method="createClientServiceInstance"/>

<bean
    factory-bean="serviceLocator"
    factory-method="createAccountServiceInstance"/>

public class DefaultServiceLocator {

    private static ClientService clientService = new ClientServiceImpl();

    private static AccountService accountService = new AccountServiceImpl();

    public ClientService createClientServiceInstance() {
        return clientService;
    }

    public AccountService createAccountServiceInstance() {
        return accountService;
    }
}


```

### FactoryBean

FactoryBean 适用于 Bean 的创建过程比较复杂的场景，比如数据库连接池的创建。

```
public interface FactoryBean<T> {
    T getObject() throws Exception;
    Class<T> getObjectType();
    boolean isSingleton();
}

public class Person { 
    private Car car ;
    private void setCar(Car car){ this.car = car;  }  
}


```

我们假设现在需要创建一个 Person 的 Bean，首先我们需要一个 Car 的实例，我们这里假设 Car 的实例创建很麻烦，那么我们可以把创建 Car 的复杂过程包装起来：

```
public class MyCarFactoryBean implements FactoryBean<Car>{
    private String make; 
    private int year ;

    public void setMake(String m){ this.make =m ; }

    public void setYear(int y){ this.year = y; }

    public Car getObject(){ 
      
      CarBuilder cb = CarBuilder.car();

      if(year!=0) cb.setYear(this.year);
      if(StringUtils.hasText(this.make)) cb.setMake( this.make ); 
      return cb.factory(); 
    }

    public Class<Car> getObjectType() { return Car.class ; } 

    public boolean isSingleton() { return false; }
}


```

我们看看装配的时候是怎么配置的：

```
<bean class = "com.javadoop.MyCarFactoryBean" id = "car">
  <property name = "make" value ="Honda"/>
  <property name = "year" value ="1984"/>
</bean>
<bean class = "com.javadoop.Person" id = "josh">
  <property name = "car" ref = "car"/>
</bean>


```

看到不一样了吗？id 为 “car” 的 bean 其实指定的是一个 FactoryBean，不过配置的时候，我们直接让配置 Person 的 Bean 直接依赖于这个 FactoryBean 就可以了。中间的过程 Spring 已经封装好了。

说到这里，我们再来点干货。我们知道，现在还用 xml 配置 Bean 依赖的越来越少了，更多时候，我们可能会采用 java config 的方式来配置，这里有什么不一样呢？

```
@Configuration 
public class CarConfiguration { 

    @Bean 
    public MyCarFactoryBean carFactoryBean(){ 
      MyCarFactoryBean cfb = new MyCarFactoryBean();
      cfb.setMake("Honda");
      cfb.setYear(1984);
      return cfb;
    }

    @Bean
    public Person aPerson(){ 
    Person person = new Person();
      
    person.setCar(carFactoryBean().getObject());
    return person; 
    } 
}


```

这个时候，其实我们的思路也很简单，把 MyCarFactoryBean 看成是一个简单的 Bean 就可以了，不必理会什么 FactoryBean，它是不是 FactoryBean 和我们没关系。

### 初始化 Bean 的回调

有以下四种方案：

```
<bean init-method="init"/>

public class AnotherExampleBean implements InitializingBean {

    public void afterPropertiesSet() {
        
    }
}

@Bean(initMethod = "init")
public Foo foo() {
    return new Foo();
}

@PostConstruct
public void init() {

}


```

### 销毁 Bean 的回调

```
<bean destroy-method="cleanup"/>

public class AnotherExampleBean implements DisposableBean {

    public void destroy() {
        
    }
}

@Bean(destroyMethod = "cleanup")
public Bar bar() {
    return new Bar();
}

@PreDestroy
public void cleanup() {

}


```

### ConversionService

既然文中说到了这个，顺便提一下好了。

最有用的场景就是，它用来将前端传过来的参数和后端的 controller 方法上的参数进行绑定的时候用。

像前端传过来的字符串、整数要转换为后端的 String、Integer 很容易，但是如果 controller 方法需要的是一个枚举值，或者是 Date 这些非基础类型（含基础类型包装类）值的时候，我们就可以考虑采用 ConversionService 来进行转换。

```
<bean
 >
  <property >
    <list>
      <bean/>
    </list>
  </property>
</bean>


```

ConversionService 接口很简单，所以要自定义一个 convert 的话也很简单。

下面再说一个实现这种转换很简单的方式，那就是实现 Converter 接口。

来看一个很简单的例子，这样比什么都管用。

```
public class StringToDateConverter implements Converter<String, Date> {

    @Override
    public Date convert(String source) {
        try {
            return DateUtils.parseDate(source, "yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm", "HH:mm:ss", "HH:mm");
        } catch (ParseException e) {
            return null;
        }
    }
}


```

只要注册这个 Bean 就可以了。这样，前端往后端传的时间描述字符串就很容易绑定成 Date 类型了，不需要其他任何操作。

### Bean 继承

在初始化 Bean 的地方，我们说过了这个：

```
RootBeanDefinition bd = getMergedLocalBeanDefinition(beanName);


```

这里涉及到的就是 `<bean parent="" />` 中的 parent 属性，我们来看看 Spring 中是用这个来干什么的。

首先，我们要明白，这里的继承和 java 语法中的继承没有任何关系，不过思路是相通的。child bean 会继承 parent bean 的所有配置，也可以覆盖一些配置，当然也可以新增额外的配置。

Spring 中提供了继承自 AbstractBeanDefinition 的 `ChildBeanDefinition` 来表示 child bean。

看如下一个例子:

```
<bean abstract="true">
    <property />
    <property />
</bean>

<bean
        parent="inheritedTestBean" init-method="initialize">

    <property />
</bean>


```

parent bean 设置了 `abstract="true"` 所以它不会被实例化，child bean 继承了 parent bean 的两个属性，但是对 name 属性进行了覆写。

child bean 会继承 scope、构造器参数值、属性值、init-method、destroy-method 等等。

当然，我不是说 parent bean 中的 abstract = true 在这里是必须的，只是说如果加上了以后 Spring 在实例化 singleton beans 的时候会忽略这个 bean。

比如下面这个极端 parent bean，它没有指定 class，所以毫无疑问，这个 bean 的作用就是用来充当模板用的 parent bean，此处就必须加上 abstract = true。

```
<bean abstract="true">
    <property />
    <property />
</bean>


```

### 方法注入

一般来说，我们的应用中大多数的 Bean 都是 singleton 的。singleton 依赖 singleton，或者 prototype 依赖 prototype 都很好解决，直接设置属性依赖就可以了。

但是，如果是 singleton 依赖 prototype 呢？这个时候不能用属性依赖，因为如果用属性依赖的话，我们每次其实拿到的还是第一次初始化时候的 bean。

一种解决方案就是不要用属性依赖，每次获取依赖的 bean 的时候从 BeanFactory 中取。这个也是大家最常用的方式了吧。怎么取，我就不介绍了，大部分 Spring 项目大家都会定义那么个工具类的。

另一种解决方案就是这里要介绍的通过使用 Lookup method。

#### lookup-method

我们来看一下 Spring Reference 中提供的一个例子：

```
package fiona.apple;



public abstract class CommandManager {

    public Object process(Object commandState) {
        
        Command command = createCommand();
        
        command.setState(commandState);
        return command.execute();
    }

    
    protected abstract Command createCommand();
}


```

xml 配置 `<lookup-method />`：

```
<bean scope="prototype">
    
</bean>


<bean>
    <lookup-method />
</bean>


```

Spring 采用 **CGLIB 生成字节码**的方式来生成一个子类。我们定义的类不能定义为 final class，抽象方法上也不能加 final。

lookup-method 上的配置也可以采用注解来完成，这样就可以不用配置 `<lookup-method />` 了，其他不变：

```
public abstract class CommandManager {

    public Object process(Object commandState) {
        MyCommand command = createCommand();
        command.setState(commandState);
        return command.execute();
    }

    @Lookup("myCommand")
    protected abstract Command createCommand();
}


```

注意，既然用了注解，要配置注解扫描：`<context:component-scan base-package="com.javadoop" />`

甚至，我们可以像下面这样：

```
public abstract class CommandManager {

    public Object process(Object commandState) {
        MyCommand command = createCommand();
        command.setState(commandState);
        return command.execute();
    }

    @Lookup
    protected abstract MyCommand createCommand();
}


```

上面的返回值用了 MyCommand，当然，如果 Command 只有一个实现类，那返回值也可以写 Command。

#### replaced-method

记住它的功能，就是替换掉 bean 中的一些方法。

```
public class MyValueCalculator {

    public String computeValue(String input) {
        
    }

    
}


```

方法覆写，注意要实现 MethodReplacer 接口：

```
public class ReplacementComputeValue implements org.springframework.beans.factory.support.MethodReplacer {

    public Object reimplement(Object o, Method m, Object[] args) throws Throwable {
        
        String input = (String) args[0];
        ...
        return ...;
    }
}


```

配置也很简单：

```
<bean>
    
    <replaced-method >
        <arg-type>String</arg-type>
    </replaced-method>
</bean>

<bean/>


```

arg-type 明显不是必须的，除非存在方法重载，这样必须通过参数类型列表来判断这里要覆盖哪个方法。

### BeanPostProcessor

应该说 BeanPostProcessor 概念在 Spring 中也是比较重要的。我们看下接口定义：

```
public interface BeanPostProcessor {

   Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException;

   Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException;

}


```

看这个接口中的两个方法名字我们大体上可以猜测 bean 在初始化之前会执行 postProcessBeforeInitialization 这个方法，初始化完成之后会执行 postProcessAfterInitialization 这个方法。但是，这么理解是非常片面的。

首先，我们要明白，除了我们自己定义的 BeanPostProcessor 实现外，Spring 容器在启动时自动给我们也加了几个。如在获取 BeanFactory 的 obtainFactory() 方法结束后的 prepareBeanFactory(factory)，大家仔细看会发现，Spring 往容器中添加了这两个 BeanPostProcessor：ApplicationContextAwareProcessor、ApplicationListenerDetector。

我们回到这个接口本身，读者请看第一个方法，这个方法接受的第一个参数是 bean 实例，第二个参数是 bean 的名字，重点在返回值将会作为新的 bean 实例，所以，没事的话这里不能随便返回个 null。

那意味着什么呢？我们很容易想到的就是，我们这里可以对一些我们想要修饰的 bean 实例做一些事情。但是对于 Spring 框架来说，它会决定是不是要在这个方法中返回 bean 实例的代理，这样就有更大的想象空间了。

最后，我们说说如果我们自己定义一个 bean 实现 BeanPostProcessor 的话，它的执行时机是什么时候？

如果仔细看了代码分析的话，其实很容易知道了，在 bean 实例化完成、属性注入完成之后，会执行回调方法，具体请参见类 AbstractAutowireCapableBeanFactory#initBean 方法。

首先会回调几个实现了 Aware 接口的 bean，然后就开始回调 BeanPostProcessor 的 postProcessBeforeInitialization 方法，之后是回调 init-method，然后再回调 BeanPostProcessor 的 postProcessAfterInitialization 方法。

总结
--

按理说，总结应该写在附录前面，我就不讲究了。

在花了那么多时间后，这篇文章终于算是基本写完了，大家在惊叹 Spring 给我们做了那么多的事的时候，应该透过现象看本质，去理解 Spring 写得好的地方，去理解它的设计思想。

本文的缺陷在于对 Spring 预初始化 singleton beans 的过程分析不够，主要是代码量真的比较大，分支旁路众多。同时，虽然附录条目不少，但是庞大的 Spring 真的引出了很多的概念，希望日后有精力可以慢慢补充一些。

（全文完）
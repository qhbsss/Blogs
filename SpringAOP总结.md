[TOC]



# AOP

AOP（Aspect Oriented Programming）即面向切面编程，AOP 是 OOP（面向对象编程）的一种延续，二者互补，并不对立。AOP 的目的是将横切关注点（如日志记录、事务管理、权限控制、接口限流、接口幂等等）从核心业务逻辑中分离出来，通过动态代理、字节码操作等技术，实现代码的复用和解耦，提高代码的可维护性和可扩展性。OOP 的目的是将业务逻辑按照对象的属性和行为进行封装，通过类、对象、继承、多态等概念，实现代码的模块化和层次化（也能实现代码的复用），提高代码的可读性和可维护性。
## AOP 关键术语（不理解也没关系，可以继续往下看）：
- **横切关注点（cross-cutting concerns）** ：多个类或对象中的公共行为（如日志记录、事务管理、权限控制、接口限流、接口幂等等）。
- **切面（Aspect）**：对横切关注点进行封装的类，一个切面是一个类。切面可以定义多个通知，用来实现具体的功能。
- **连接点（JoinPoint）**：连接点是方法调用或者方法执行时的某个特定时刻（如方法调用、异常抛出等）。
- **通知（Advice）**：通知就是切面在某个连接点要执行的操作。通知有五种类型，分别是前置通知（Before）、后置通知（After）、返回通知（AfterReturning）、异常通知（AfterThrowing）和环绕通知（Around）。前四种通知都是在目标方法的前后执行，而环绕通知可以控制目标方法的执行过程。
- **切点（Pointcut）**：一个切点是一个表达式，它用来匹配哪些连接点需要被切面所增强。切点可以通过注解、正则表达式、逻辑运算等方式来定义。比如 `execution(* com.xyz.service..*(..))`匹配 `com.xyz.service` 包及其子包下的类或接口。
- **织入（Weaving）**：织入是将切面和目标对象连接起来的过程，也就是将通知应用到切点匹配的连接点上。常见的织入时机有两种，分别是编译期织入（Compile-Time Weaving 如：AspectJ）和运行期织入（Runtime Weaving 如：AspectJ、Spring AOP）。

## AOP 实现原理

Spring的AOP实现原理其实很简单，就是通过动态代理实现的。如果我们为Spring的某个bean配置了切面，那么Spring在创建这个bean的时候，实际上创建的是这个bean的一个代理对象，我们后续对bean中方法的调用，实际上调用的是代理类重写的代理方法。而Spring的AOP使用了两种动态代理，分别是JDK的动态代理，以及CGLib的动态代理。

![SpringAOPProcess](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/230ae587a322d6e4d09510161987d346.jpeg)

当然你也可以使用 **AspectJ** ！Spring AOP 已经集成了 AspectJ ，AspectJ 应该算的上是 Java 生态系统中最完整的 AOP 框架了。

**Spring AOP 属于运行时增强，而 AspectJ 是编译时增强。** Spring AOP 基于代理(Proxying)，而 AspectJ 基于字节码操作(Bytecode Manipulation)。

### JDK动态代理
Spring默认使用JDK的动态代理实现AOP，类如果实现了接口，Spring就会使用这种方式实现动态代理。熟悉Java语言的应该会对JDK动态代理有所了解。JDK实现动态代理需要两个组件，首先第一个就是**InvocationHandler接口**。我们在使用JDK的动态代理时，需要编写一个类，去实现这个接口，然后重写invoke方法，这个方法其实就是我们提供的代理方法。然后JDK动态代理需要使用的第二个组件就是**Proxy这个类**，我们可以通过这个类的newProxyInstance方法，返回一个代理对象。生成的代理类实现了原来那个类的所有接口，并对接口的方法进行了代理，我们通过代理对象调用这些方法时，底层将通过反射，调用我们实现的invoke方法。\

`JDK`的动态代理是基于**反射**实现。`JDK`通过反射，生成一个代理类，这个代理类实现了原来那个类的全部接口，并对接口中定义的所有方法进行了代理。当我们通过代理对象执行原来那个类的方法时，代理类底层会通过反射机制，回调我们实现的`InvocationHandler`接口的`invoke`方法。**并且这个代理类是Proxy类的子类**（记住这个结论，后面测试要用）。这就是`JDK`动态代理大致的实现方式。

#### Proxy 生成代理类
实例化代理对象先通过 getProxyClass0(...) 获取代理类 Class 对象，而 newProxyInstance(...) 随后会获取参数为 InvocationHandler 的构造函数实例化一个代理类对象。
```java
1、获取代理类 Class 对象
public static Class<?> getProxyClass(ClassLoader loader,Class<?>... interfaces){
    final Class<?>[] intfs = interfaces.clone();
    ...
    1.1 获得代理类 Class 对象
    return getProxyClass0(loader, intfs);
}

2、实例化代理类对象
public static Object newProxyInstance(ClassLoader loader,Class<?>[] interfaces,InvocationHandler h){
    ...
    final Class<?>[] intfs = interfaces.clone();
    2.1 获得代理类 Class对象
    Class<?> cl = getProxyClass0(loader, intfs);
    ...
    2.2 获得代理类构造器 (接收一个 InvocationHandler 参数)
    // private static final Class<?>[] constructorParams = { InvocationHandler.class };
    final Constructor<?> cons = cl.getConstructor(constructorParams);
    final InvocationHandler ih = h;
    ...
    2.3 反射创建实例
    return newInstance(cons, ih);
}
```
JDK 动态代理生成的代理类命名为 com.sun.proxy$Proxy[从0开始的数字]（例如：com.sun.proxy$Proxy0），这个类继承自 java.lang.reflect.Proxy。其内部还有一个参数为 InvocationHandler 的构造器，对于代理接口的方法调用都会分发到 InvocationHandler#invoke()

```java
-> 1.1、2.1 获得代理类 Class对象
private static Class<?> getProxyClass0(ClassLoader loader,Class<?>... interfaces) {
    ...
    从缓存中获取代理类，如果缓存未命中，则通过ProxyClassFactory生成代理类
    return proxyClassCache.get(loader, interfaces);
}

private static final class ProxyClassFactory implements BiFunction<ClassLoader, Class<?>[], Class<?>>{

    3.1 代理类命名前缀
    private static final String proxyClassNamePrefix = "$Proxy";

    3.2 代理类命名后缀，从 0 递增（原子 Long）
    private static final AtomicLong nextUniqueNumber = new AtomicLong();

    @Override
    public Class<?> apply(ClassLoader loader, Class<?>[] interfaces) {
        Map<Class<?>, Boolean> interfaceSet = new IdentityHashMap<>(interfaces.length);
        3.3 参数校验
        for (Class<?> intf : interfaces) {
            // 验证参数 interfaces 和 ClassLoder 中加载的是同一个类
            // 验证参数 interfaces 是接口类型
            // 验证参数 interfaces 中没有重复项
            // 否则抛出 IllegalArgumentException
        }
        // 验证所有non-public接口来自同一个包

        3.4（一般地）代理类包名
        // public static final String PROXY_PACKAGE = "com.sun.proxy";
        String proxyPkg = ReflectUtil.PROXY_PACKAGE + ".";

        3.5 代理类的全限定名
        long num = nextUniqueNumber.getAndIncrement();
        String proxyName = proxyPkg + proxyClassNamePrefix + num;

        3.6 生成字节码数据
        byte[] proxyClassFile = ProxyGenerator.generateProxyClass(proxyName, interfaces);

        3.7 从字节码生成 Class 对象
        return defineClass0(loader, proxyName,proxyClassFile, 0, proxyClassFile.length); 
    }
}

-> 3.6 生成字节码数据
public static byte[] generateProxyClass(final String var0, Class[] var1) {
    ProxyGenerator var2 = new ProxyGenerator(var0, var1);
    ...
    final byte[] var3 = var2.generateClassFile();
    return var3;
}
```
#### 将方法调用统一分发到 InvocationHandler 接口。
```java
private byte[] generateClassFile() {
    3.6.1 只代理Object的hashCode、equals和toString
    this.addProxyMethod(hashCodeMethod, Object.class);
    this.addProxyMethod(equalsMethod, Object.class);
    this.addProxyMethod(toStringMethod, Object.class);

    3.6.2 代理接口的每个方法
    ...
    for(var1 = 0; var1 < this.interfaces.length; ++var1) {
        ...
    }
    
    3.6.3 添加带有 InvocationHandler 参数的构造器
    this.methods.add(this.generateConstructor());
    var7 = this.proxyMethods.values().iterator();
    while(var7.hasNext()) {
        ...
        3.6.4 在每个代理的方法中调用InvocationHandler#invoke()
    }

    3.6.5 输出字节流
    ByteArrayOutputStream var9 = new ByteArrayOutputStream();
    DataOutputStream var10 = new DataOutputStream(var9);
    ...
    return var9.toByteArray();
}
```

#### eg: 代码示例

**1.定义发送短信的接口**

```java
public interface SmsService {
    String send(String message);
}
```

**2.实现发送短信的接口**

```java
public class SmsServiceImpl implements SmsService {
    public String send(String message) {
        System.out.println("send message:" + message);
        return message;
    }
}
```

**3.定义一个 JDK 动态代理类**

```java
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/**
 * @author shuang.kou
 * @createTime 2020年05月11日 11:23:00
 */
public class DebugInvocationHandler implements InvocationHandler {
    /**
     * 代理类中的真实对象
     */
    private final Object target;

    public DebugInvocationHandler(Object target) {
        this.target = target;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws InvocationTargetException, IllegalAccessException {
        //调用方法之前，我们可以添加自己的操作
        System.out.println("before method " + method.getName());
        Object result = method.invoke(target, args);
        //调用方法之后，我们同样可以添加自己的操作
        System.out.println("after method " + method.getName());
        return result;
    }
}

```

`invoke()` 方法: 当我们的动态代理对象调用原生方法的时候，最终实际上调用到的是 `invoke()` 方法，然后 `invoke()` 方法代替我们去调用了被代理对象的原生方法。

**4.获取代理对象的工厂类**

```java
public class JdkProxyFactory {
    public static Object getProxy(Object target) {
        return Proxy.newProxyInstance(
                target.getClass().getClassLoader(), // 目标类的类加载器
                target.getClass().getInterfaces(),  // 代理需要实现的接口，可指定多个
                new DebugInvocationHandler(target)   // 代理对象对应的自定义 InvocationHandler
        );
    }
}
```

`getProxy()`：主要通过`Proxy.newProxyInstance（）`方法获取某个类的代理对象

**5.实际使用**

```java
SmsService smsService = (SmsService) JdkProxyFactory.getProxy(new SmsServiceImpl());
smsService.send("java");
```

运行上述代码之后，控制台打印出：

```plain
before method send
send message:java
after method send
```



### CGLib动态代理

CGLib实现动态代理的原理是，底层采用了ASM字节码生成框架，直接对需要代理的类的字节码进行操作，生成这个类的一个子类，并重写了类的所有可以重写的方法，在重写的过程中，将我们定义的额外的逻辑（简单理解为Spring中的切面）织入到方法中，对方法进行了增强。而通过字节码操作生成的代理类，和我们自己编写并编译后的类没有太大区别。

通过CGLIB的**Enhancer**来指定要代理的目标对象、实际处理代理逻辑的对象，最终通过调用create()方法得到代理对象，对这个对象所有非final方法的调用都会转发给**MethodInterceptor.intercept()**方法，在intercept()方法里我们可以加入任何逻辑，比如修改方法参数，加入日志功能、安全检查功能等；通过调用**MethodProxy.invokeSuper()**方法，我们将调用转发给原始对象。

**在 CGLIB 动态代理机制中 `MethodInterceptor` 接口和 `Enhancer` 类是核心。**

你需要自定义 `MethodInterceptor` 并重写 `intercept` 方法，`intercept` 用于拦截增强被代理类的方法。

```java
public interface MethodInterceptor
extends Callback{
    // 拦截被代理类中的方法
    public Object intercept(Object obj, java.lang.reflect.Method method, Object[] args,MethodProxy proxy) throws Throwable;
}

```

1. **obj** : 被代理的对象（需要增强的对象）
2. **method** : 被拦截的方法（需要增强的方法）
3. **args** : 方法入参
4. **proxy** : 用于调用原始方法

你可以通过 `Enhancer`类来动态获取被代理类，当代理类调用方法的时候，实际调用的是 `MethodInterceptor` 中的 `intercept` 方法。

#### eg: 代码示例

不同于 JDK 动态代理不需要额外的依赖。[CGLIB](https://github.com/cglib/cglib)(_Code Generation Library_) 实际是属于一个开源项目，如果你要使用它的话，需要手动添加相关依赖。

```xml
<dependency>
  <groupId>cglib</groupId>
  <artifactId>cglib</artifactId>
  <version>3.3.0</version>
</dependency>
```

**1.实现一个使用阿里云发送短信的类**

```java
package github.javaguide.dynamicProxy.cglibDynamicProxy;

public class AliSmsService {
    public String send(String message) {
        System.out.println("send message:" + message);
        return message;
    }
}
```

**2.自定义 `MethodInterceptor`（方法拦截器）**

```java
import net.sf.cglib.proxy.MethodInterceptor;
import net.sf.cglib.proxy.MethodProxy;

import java.lang.reflect.Method;

/**
 * 自定义MethodInterceptor
 */
public class DebugMethodInterceptor implements MethodInterceptor {


    /**
     * @param o           被代理的对象（需要增强的对象）
     * @param method      被拦截的方法（需要增强的方法）
     * @param args        方法入参
     * @param methodProxy 用于调用原始方法
     */
    @Override
    public Object intercept(Object o, Method method, Object[] args, MethodProxy methodProxy) throws Throwable {
        //调用方法之前，我们可以添加自己的操作
        System.out.println("before method " + method.getName());
        Object object = methodProxy.invokeSuper(o, args);
        //调用方法之后，我们同样可以添加自己的操作
        System.out.println("after method " + method.getName());
        return object;
    }

}
```

**3.获取代理类**

```java
import net.sf.cglib.proxy.Enhancer;

public class CglibProxyFactory {

    public static Object getProxy(Class<?> clazz) {
        // 创建动态代理增强类
        Enhancer enhancer = new Enhancer();
        // 设置类加载器
        enhancer.setClassLoader(clazz.getClassLoader());
        // 设置被代理类
        enhancer.setSuperclass(clazz);
        // 设置方法拦截器
        enhancer.setCallback(new DebugMethodInterceptor());
        // 创建代理类
        return enhancer.create();
    }
}
```

**4.实际使用**

```java
AliSmsService aliSmsService = (AliSmsService) CglibProxyFactory.getProxy(AliSmsService.class);
aliSmsService.send("java");
```

运行上述代码之后，控制台打印出：

```bash
before method send
send message:java
after method send
```



>## 为什么jdk动态代理基于反射，而cglib基于字节码操作，jdk动态代理不也生成了字节码吗
>
>关于为什么 JDK 动态代理基于反射，而 CGLIB 基于字节码操作，尽管 JDK 动态代理最终也会生成字节码。让我们详细解释一下：
>
>### JDK 动态代理基于反射的实现方式：
>
>1. **接口代理限制：** JDK 动态代理要求被代理的类必须实现接口，因为它是基于 `java.lang.reflect.Proxy` 和 `java.lang.reflect.InvocationHandler` 接口实现的。
>   
>2. **反射调用：** 在运行时，JDK 动态代理通过 `Proxy.newProxyInstance()` 方法创建代理对象，并传入一个 `InvocationHandler` 接口的实现类，用于处理代理方法的调用。每次代理方法被调用时，`InvocationHandler` 的 `invoke()` 方法被触发，通过反射调用被代理对象的方法。
>
>3. **生成字节码：** JDK 动态代理在代理类创建时，确实会生成字节码，但这部分字节码是由 Java 运行时动态生成的，并且由 `ProxyGenerator.generateProxyClass()` 方法完成。这些生成的字节码实现了被代理接口的所有方法，并包含了调用 `InvocationHandler` 的逻辑。
>
>### CGLIB 基于字节码操作的实现方式：
>
>1. **继承代理：** CGLIB 是通过继承来创建代理对象的，不需要被代理类实现接口。它通过扩展被代理类，生成一个子类作为代理类。
>
>2. **字节码增强：** CGLIB 使用了 ASM（一个 Java 字节码操作库）来直接操作字节码，生成代理类的字节码。这使得 CGLIB 可以动态地修改类的结构和行为，比如添加方法、字段或覆盖方法。
>
>3. **性能和功能：** 由于直接操作字节码，CGLIB 通常比 JDK 动态代理更快，尤其是在方法调用频繁的场景下。此外，CGLIB 还能够代理那些没有实现接口的类，提供更广泛的代理能力。
>
>### 总结：
>
>- JDK 动态代理基于反射，生成的代理类通过接口实现方式，适用于要求被代理类实现接口的场景，生成的字节码由 Java 运行时动态生成。
>  
>- CGLIB 基于字节码操作，通过继承和字节码增强实现代理类，不需要被代理类实现接口，能够处理更广泛的代理需求，并且性能通常比 JDK 动态代理略高。
>
>因此，尽管 JDK 动态代理最终也涉及到字节码的生成，但它的主要机制是基于反射，而 CGLIB 则更直接地操作字节码来实现动态代理。

### AspectJ

执行AspectJ的时候，我们需要使用ajc编译器，对Aspect和需要织入的Java Source Code进行编译，得到字节码后，可以使用java命令来执行。
ajc编译器会首先调用javac将Java源代码编译成字节码，然后根据我们在Aspect中定义的pointcut找到相对应的Java Byte Code部分，使用对应的advice动作修改源代码的字节码。最后得到了经过Aspect织入的Java字节码，然后就可以正常使用这个字节码了。

AspectJ支持编译时织入(CTW)和类加载时织入(LTW)

#### CTW

CTW是 AspectJ 中一种将切面织入目标类的字节码的技术。相比于加载时织入和运行时织入，编译时织入在编译阶段就将切面织入到目标类的字节码中，这样在程序运行时就无需再进行切面的织入操作。

- 开发者编写包含切面定义的AspectJ源代码。
- 使用AspectJ编译器（ajc）编译源代码，编译器将切面逻辑织入到目标类的字节码中。
- 生成的字节码包含了原始的业务逻辑和切面逻辑。

#### LTW
LTW是一种在类加载时织入切面的方式。与CTW和RTW相比，加载时织入提供了更大的灵活性，并且可以在不修改原始源代码的情况下，将切面逻辑应用到已编译的类中。
使用AspectJ LTW有两个主要步骤，第一，通过JM的-**javaagent**参数设置LTW的织入器类包，以代理JVM默认的类加载器;第二，LTW织入器需要一个 aop.xm文件，在该文件中指定切面类和需要进行切面织入的目标类。


## Spring中AOP代理对象创建时机

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/1854920ece1c77df2b70968d53df1dec.png)
这是一个Bean的生命周期流程，当它执行完第六步，也就是初始化方法执行完毕之后，这个Bean就可用了。而第七步是Spring给我们提供的扩展点，在这一步可以拿到可用的原始对象，我们的代理对象生成和替换就是在这里。

```java
public interface BeanPostProcessor {
 
 
	@Nullable
	default Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
		return bean;
	}
 
 
	@Nullable
	default Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
		return bean;
	}
 
}
```
位置：org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory#initializeBean(java.lang.String, java.lang.Object, org.springframework.beans.factory.support.RootBeanDefinition)

![e645599692ee986ecead15e392f25c6b](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/e645599692ee986ecead15e392f25c6b.png)


 位置：org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory#doCreateBean

![e18573be06013940acccc9a6205aafd5](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/e18573be06013940acccc9a6205aafd5.png)

 从源码可以知道，Spring在调用BeanPostProcessor的postProcessAfterInitialization方法会传入原始对象，并把postProcessAfterInitialization方法返回的对象替换原始对象，所以我们只要在postProcessAfterInitialization方法实现代理对象的生成逻辑即可。


# 注解

`Annotation` （注解） 是 Java5 开始引入的新特性，可以看作是一种特殊的注释，主要用于修饰类、方法或者变量，提供某些信息供程序在编译或者运行时使用。

注解本质是一个继承了`Annotation` 的特殊接口：

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.SOURCE)
public @interface Override {

}

public interface Override extends Annotation{

}
```
注解不会对代码有直接的影响，只是起到标记的作用，需要编写额外的代码去利用注解，否则注解一无所用。幸运的是，无论是框架还是java编译器已经提供了相应的注解处理代码。

![img](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/60edd709edda490685dfa53e292e6325~tplv-k3u1fbpfcp-zoom-in-crop-mark:1512:0:0:0.awebp)

## 注解的解析方法
注解相当于给某些代码贴了个标签。我们既**可以通过注解处理器在编译时解析这些标签，也可以在运行时通过反射解析这些标签**。解析后都会有一系列动作，这些动作就是对标签语义的诠释。

注解只有被解析之后才会生效，常见的解析方法有两种：

### 1. **编译期直接扫描**：
编译器在编译 Java 代码的时候扫描对应的注解并处理，比如某个方法使用`@Override` 注解，编译器在编译的时候就会检测当前的方法是否重写了父类对应的方法。
#### 注解处理器

##### Java 编译器的工作流程

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures64e93f67c3b422afd90966bfe9aaf5b8.png)

Java 源代码的编译过程可分为三个步骤：
1. 将源文件解析为抽象语法树；

2. 调用已注册的注解处理器；

3. 生成字节码。

如果在第 2 步调用注解处理器过程中生成了新的源文件，那么编译器将重复第 1、2 步，解析并且处理新生成的源文件。每次重复我们称之为一轮（Round）。

所有的注解处理器类都需要实现接口Processor。该接口主要有四个重要方法。其中，init方法用来存放注解处理器的初始化代码。之所以不用构造器，是因为在 Java 编译器中，注解处理器的实例是通过反射 API 生成的。也正是因为使用反射 API，每个注解处理器类都需要定义一个无参数构造器。

JDK 提供了一个实现Processor接口的抽象类AbstractProcessor。该抽象类实现了init、getSupportedAnnotationTypes和getSupportedSourceVersion方法。

它的子类可以通过@SupportedAnnotationTypes和@SupportedSourceVersion注解来声明所支持的注解类型以及 Java 版本。

### 2. **运行期通过反射处理**
注解本质是一个继承了Annotation的特殊接口，其具体实现类是Java运行时生成的动态代理类。通过代理对象调用自定义注解（接口）的方法，会最终调用AnnotationInvocationHandler的invoke方法。该方法会从memberValues这个Map中索引出对应的值。而memberValues的来源是Java常量池。

反射注解的工作原理：

1. 首先，我们通过键值对的形式可以为注解属性赋值，像这样：@Hello(value = "hello")。

2. 接着，你用注解修饰某个元素，编译器将在编译期扫描每个类或者方法上的注解，会做一个基本的检查，你的这个注解是否允许作用在当前位置，最后会将注解信息写入元素的属性表。

3. 然后，当你进行反射的时候，虚拟机将所有生命周期在 RUNTIME的注解取出来放到一个 map 中，并创建一个 AnnotationInvocationHandler 实例，把这个 map 传递给它。

4. 最后，虚拟机将采用 JDK 动态代理机制生成一个目标注解的代理类，并初始化好处理器。


像框架中自带的注解(比如 Spring 框架的 `@Value`、`@Component`)都是通过反射来进行处理的。
- 一般情况下，继承于class类的子类可以通过class基类的方法反射获取得到子类的property，method等，但是对于注解，子类如何通过父类得到呢？这里的class类需要对AnnotatedElement接口进行实现，这个接口提供要返回的Annotation的方法。
- Java反射机制解析注解主要是通过java.lang.reflect包下的提供的AnnotatedElement接口，Class<T>实现了该接口定义的方法，返回本元素/所有的注解（Annotation接口）。
![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures076e4647149398d41eb6610106890d73.jpeg)

- AnnotatedElement是所有注解元素的父接口，所有的注解元素都可以通过某个类反射获取AnnotatedElement对象，该对象有以下4个方法来访问Annotation信息。AnnotatedElement接口定义如下：    

    public interface AnnotatedElement {
        
        default boolean isAnnotationPresent(Class<? extends Annotation> annotationClass)     {
            return getAnnotation(annotationClass) != null;
        }
        
         <T extends Annotation> T getAnnotation(Class<T> annotationClass);
        
        Annotation[] getAnnotations();
        
        default <T extends Annotation> T getDeclaredAnnotation(Class<T> annotationClass) {}
        
        default <T extends Annotation> T[] getDeclaredAnnotationsByType(Class<T> annotationClass) {
            ...
        }
        
        Annotation[] getDeclaredAnnotations();
    }
这个接口有default方法，Class类可直接使用。

java反射中与注解相关的API包括：

1. 判断某个注解是否存在于Class、Field、Method、Constructor：Xxx.isAnnotationPresent(Class)
2. 读取注解：Xxx.getAnnotation(Class)
#### eg:
自定义一个名为@IDAuthenticator的注解去验证Student类的学号，要求学号的长度必须为4，对不满足要求的学号抛出异常。
首先我们定义注解：
```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface IDAuthenticator {
    int length() default 8;
}
```

然后应用注解:

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Student {
    private  String name;
    @IDAuthenticator(length = 4)
    private String id;

}
```

最后解析注解:

```java
public  void check(Student student) throws IllegalAccessException {
    for(Field field:student.getClass().getDeclaredFields()){

        if(field.isAnnotationPresent(IDAuthenticator.class)){
            IDAuthenticator idAuthenticator = field.getAnnotation(IDAuthenticator.class);
            field.setAccessible(true);
            //只有id有@IDAuthenticator注解，
            //也只要当field为id时@IDAuthenticator才不为空，才能满足判断条件，
            // 体会，注解的本质是标签，起筛选作用
            Object value=field.get(student);
            if(value instanceof String){
                String id=(String) value;
                if(id.length()!=idAuthenticator.length()){
                    throw  new  IllegalArgumentException("the length of "+field.getName()+" should be "+idAuthenticator.length());
                }

            }

        }
    }
```

测试

```java
@Test
public void useAnnotation(){
    Student student01 = new Student("小明", "20210122");
    Student student02 = new Student("小军", "2021");
    Student student03 = new Student("小花", "20210121");
    
    for(Student student:new Student[]{student01,student02,student03}){
        try{
            check(student);
            System.out.println(" Student "+student+" checks ok ");
        } catch (IllegalArgumentException | IllegalAccessException e) {
            System.out.println(" Student "+student+" checks failed "+e);
        }
    }
}
```

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures9c42d2df2fcd49699cfaf6db52b18a43%7Etplv-k3u1fbpfcp-zoom-in-crop-mark%3A1512%3A0%3A0%3A0.awebp)


#### 反射返回动态代理对象 & 注解实现类

注解本质上是继承了 Annotation 接口的接口，而当你通过反射获取一个注解类实例的时候，其实 JDK 是通过动态代理机制生成一个实现我们注解（接口）的代理类。该动态代理类实现了注解所对应的接口，对该注解接口内定义的方法通过定义一个代理方法，该代理方法内通过AnnotationInvocationHandler的类通过反射调用注解接口内对应的方法。该方法会从memberValues这个Map中索引出对应的值，而memberValues的来源是Java常量池。

![在这里插入图片描述](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures013586c59e690beac6d83f14ef46d057.png)

![在这里插入图片描述](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesc69c6edf4a62dade860333771a527f8a.png)
# java agent

## premain方法

`premain`方法指的就是在`main`方法之前执行的方法。

```java
package org.example;
 
public class MyAgent {
  public static void premain(String args) {
    System.out.println("premain");
  }
}
```

为了能够以 Java agent 的方式运行该`premain`方法，我们需要将其打包成 jar 包，并在其中的 MANIFEST.MF 配置文件中，指定所谓的`Premain-class`。具体的命令如下所示：

```bash
# 注意第一条命令会向 manifest.txt 文件写入两行数据，其中包括一行空行
$ echo 'Premain-Class: org.example.MyAgent
' > manifest.txt
$ jar cvmf manifest.txt myagent.jar org/
$ java -javaagent:myagent.jar HelloWorld
premain
Hello, World
```

## Attach API

除了在命令行中指定 Java agent 之外，我们还可以通过 Attach API 远程加载。具体用法如下面的代码所示：

```java
import java.io.IOException;
 
import com.sun.tools.attach.*;
 
public class AttachTest {
  public static void main(String[] args)
      throws AttachNotSupportedException, IOException, AgentLoadException, AgentInitializationException {
    if (args.length <= 1) {
      System.out.println("Usage: java AttachTest <PID> /PATH/TO/AGENT.jar");
      return;
    }
    VirtualMachine vm = VirtualMachine.attach(args[0]);
    vm.loadAgent(args[1]);
  }
}
```

使用 Attach API 远程加载的 Java agent 不会再先于`main`方法执行，这取决于另一虚拟机调用 Attach API 的时机。并且，它运行的也不再是`premain`方法，而是名为`agentmain`的方法。

```java
public class MyAgent { 
  public static void agentmain(String args) {
    System.out.println("agentmain");
  }
}
```

相应的，我们需要更新 jar 包中的 manifest 文件，使其包含`Agent-Class`的配置，例如`Agent-Class: org.example.MyAgent`。

```b
$ echo 'Agent-Class: org.example.MyAgent
' > manifest.txt
$ jar cvmf manifest.txt myagent.jar org/
$ java HelloWorld
Hello, World
$ jps
$ java AttachTest <pid> myagent.jar
agentmain
// 最后一句输出来自于运行 HelloWorld 的 Java 进程
```

## 基于instrumentation机制的字节码注入

Java agent 还提供了一套 instrumentation 机制，允许应用程序拦截类加载事件，并且更改该类的字节码。

```java
package org.example;
 
import java.lang.instrument.*;
import java.security.ProtectionDomain;
 
public class MyAgent {
  public static void premain(String args, Instrumentation instrumentation) {
    instrumentation.addTransformer(new MyTransformer());
  }
 
  static class MyTransformer implements ClassFileTransformer {
    public byte[] transform(ClassLoader loader, String className, Class<?> classBeingRedefined,
        ProtectionDomain protectionDomain, byte[] classfileBuffer) throws IllegalClassFormatException {
      System.out.printf("Loaded %s: 0x%X%X%X%X\n", className, classfileBuffer[0], classfileBuffer[1],
          classfileBuffer[2], classfileBuffer[3]);
      return null;
    }
  }
}
```

在上面这段代码中，`premain`方法多出了一个`Instrumentation`类型的参数，我们可以通过它来注册类加载事件的拦截器。该拦截器需要实现`ClassFileTransformer`接口，并重写其中的`transform`方法。

`transform`方法将接收一个 byte 数组类型的参数，它代表的是正在被加载的类的字节码。在上面这段代码中，我将打印该数组的前四个字节，也就是 Java class 文件的魔数（magic number）0xCAFEBABE。

`transform`方法将返回一个 byte 数组，代表更新过后的类的字节码。当方法返回之后，Java 虚拟机会使用所返回的 byte 数组，来完成接下来的类加载工作。不过，如果`transform`方法返回 null 或者抛出异常，那么 Java 虚拟机将使用原来的 byte 数组完成类加载工作。

基于这一类加载事件的拦截功能，我们可以实现字节码注入（bytecode instrumentation），往正在被加载的类中插入额外的字节码。

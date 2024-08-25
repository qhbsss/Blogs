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

### CGLib动态代理
CGLib实现动态代理的原理是，底层采用了ASM字节码生成框架，直接对需要代理的类的字节码进行操作，生成这个类的一个子类，并重写了类的所有可以重写的方法，在重写的过程中，将我们定义的额外的逻辑（简单理解为Spring中的切面）织入到方法中，对方法进行了增强。而通过字节码操作生成的代理类，和我们自己编写并编译后的类没有太大区别。

通过CGLIB的**Enhancer**来指定要代理的目标对象、实际处理代理逻辑的对象，最终通过调用create()方法得到代理对象，对这个对象所有非final方法的调用都会转发给**MethodInterceptor.intercept()**方法，在intercept()方法里我们可以加入任何逻辑，比如修改方法参数，加入日志功能、安全检查功能等；通过调用**MethodProxy.invokeSuper()**方法，我们将调用转发给原始对象。

### AspectJ
执行AspectJ的时候，我们需要使用ajc编译器，对Aspect和需要织入的Java Source Code进行编译，得到字节码后，可以使用java命令来执行。
ajc编译器会首先调用javac将Java源代码编译成字节码，然后根据我们在Aspect中定义的pointcut找到相对应的Java Byte Code部分，使用对应的advice动作修改源代码的字节码。最后得到了经过Aspect织入的Java字节码，然后就可以正常使用这个字节码了。

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


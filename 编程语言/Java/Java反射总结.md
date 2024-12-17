[TOC]



# Java反射

## 概念
Java反射机制的核心是在程序运行时动态加载类并获取类的详细信息，从而操作类或对象的属性和方法。
本质是JVM得到class对象之后，再通过class对象进行反编译，从而获取对象的各种信息。
## Java反射加载过程
首先理解类的加载过程
1）编译时期：执行 javac 命令对.java文件进行编译，生成一个或多个字节码文件（即.class文件）；
2）运行时期：执行 java 命令对字节码文件进行解释运行，首先要进行类的加载，加载到内存的类称为运行时类，即Class类型的一个对象；
3）这个Class类型对象存放在方法区中，作为方法区中类数据的访问入口，所有对类数据的访问都要通过这个Class类型对象（反射机制也就是从内存中找到了这个Class类型对象，再通过这个对象获取类的属性、方法、构造器等所有信息）。
## java反射原理
>java的反射是指运行时动态地加载类并使用相关的对象方法，new一个对象是在编译时静态加载的，在编译期间就知道了类对象的信息，但是动态加载时，编译期间不能确定类的信息，需要在运行时去寻找类的信息，而java有字节码这个中间状态，能够在运行时去寻找对应类的class字节码文件，进而找到对应类的信息并进行操作。而C++这类语言在编译时就确定了所有的信息，无法实现动态加载。

Java语言的跨平台是它的最大亮点之一，为了达到平台惯性，它就不得不多一个中间步骤，也就是生成字节码文件。对于一个Java源文件来说，需要用javac命令把源文件编译成class文件，这个class文件是计算机无法直接识别的，但是却可以被Java虚拟机所认识，所以在运行一个Java程序的时候，肯定是要启动一个Java虚拟机，然后在由虚拟机去加载这些class文件，如图所示：
![](https://img-blog.csdn.net/20160808210731495?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQv/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/Center)
>为什么c++没有反射？
对于像c,c++这类高级计算机语言来说，它们的编译器（例如：Unix的CC命令，Windows的CL命令）都是直接把源码直接编译成计算机可以认识的机器码，如exe，dll之类的文件，然后直接运行即可。c++源码编译以后，生成的是特定机器可以直接运行的文件，而Java源码经过编译后，生成的是中间的字节码文件，这些字节码文件是需要放在JVM中运行的，而JVM是有多个平台版本的。因此，Java是具有跨平台的，而C++没有。

我们用普通的方式使用一个类的时候，类是静态加载的,而使用Class.forName(“XXX”)这种方式，则属于动态加载一个类.静态加载的类在编译的时候就能确定该类是否存在，但动态加载一个类的时候却无法在编译阶段确定是否存在该类，而是在运行时候才能够确定是否有这个类。

># java反射的底层原理是操作字节码吗
>Java 反射的底层原理确实涉及到字节码操作，但它并不是直接操作字节码，而是通过 JVM 提供的 API 进行间接的字节码解析和操作。
>
>## 反射的工作机制
>
>Java 反射允许程序在运行时动态地获取类、方法、字段等信息，并对它们进行操作。这是通过 Java 提供的 `java.lang.reflect` 包中的类（如 `Class`, `Method`, `Field`, `Constructor` 等）来实现的。反射的底层原理大致可以概括如下：
>
>1. **元数据访问**：反射通过 JVM 的元数据表（metadata table）获取类的结构信息。JVM 在类加载时会将类的结构信息（包括类的名称、字段、方法签名等）存储在元数据表中，反射机制可以从这些表中查询信息，而不是直接操作字节码。
>
>2. **方法和字段的动态访问**：当反射调用类的方法或操作字段时，反射机制通过内部的 JVM 调用路径，间接地操作字节码。这种调用通常是通过 JVM 的内置方法来实现的，它们会在运行时定位到具体的字节码指令，执行与之对应的操作。
>
>3. **JNI 调用**：部分反射功能（如获取类的结构信息和调用方法）会通过 JNI（Java Native Interface）调用到本地代码（通常是用 C 或 C++ 实现的 JVM 内部函数）。这些本地代码直接操作内存中的元数据和字节码，从而执行具体的操作。
>
>4. **性能开销**：反射的这种机制虽然灵活，但由于它需要在运行时解析元数据、间接调用方法，并可能涉及 JNI 调用，所以其性能开销相对直接调用方法要大。JVM 通过一定的优化技术（如 JIT 编译）来减少反射的性能损失，但反射调用仍然比常规的直接调用慢。
>
>## 与字节码的关系
>
>   虽然反射机制本身并不直接生成或修改字节码，它更多地是通过 JVM 提供的 API 访问类的字节码结构和执行方法。但它的确涉及到字节码的间接操作：
>
>   - **类的元数据**：反射通过 JVM 获取类的元数据，而这些元数据是类的字节码解析后生成的。
>   - **方法调用**：反射在调用方法时，底层仍然需要通过 JVM 去执行对应的方法字节码指令。
>   - **字段访问**：反射访问字段时，也是通过 JVM 的内部机制来解析字段在内存中的位置和字节码中的定义。
>
>## 总结
>
>   Java 反射并不会直接操作字节码，而是通过 JVM 内部的元数据表、字节码解析和 JNI 调用来实现对类结构的动态查询和方法、字段的访问。虽然字节码在底层运行时被执行，但反射的 API 提供的是对这些低级操作的抽象，使得开发者可以在更高层次上进行操作，而不需要直接面对字节码。
### 与字节码的关系
虽然反射机制本身并不直接生成或修改字节码，它更多地是通过 JVM 提供的 API 访问类的字节码结构和执行方法。但它的确涉及到字节码的间接操作：
- **类的元数据**：反射通过 JVM 获取类的元数据，而这些元数据是类的字节码解析后生成的。
- **方法调用**：反射在调用方法时，底层仍然需要通过 JVM 去执行对应的方法字节码指令。
- **字段访问**：反射访问字段时，也是通过 JVM 的内部机制来解析字段在内存中的位置和字节码中的定义。
### 总结
Java 反射并不会直接操作字节码，而是通过 JVM 内部的元数据表、字节码解析和 JNI 调用来实现对类结构的动态查询和方法、字段的访问。虽然字节码在底层运行时被执行，但反射的 API 提供的是对这些低级操作的抽象，使得开发者可以在更高层次上进行操作，而不需要直接面对字节码。

# JVM如何实现反射

方法的反射调用 Method.invoke代码

```ja
public final class Method extends Executable {
  ...
  public Object invoke(Object obj, Object... args) throws ... {
    ... // 权限检查
    MethodAccessor ma = methodAccessor;
    if (ma == null) {
      ma = acquireMethodAccessor();
    }
    return ma.invoke(obj, args);
  }
}
```

Method.invoke 的源代码实际上委派给 MethodAccessor 来处理。MethodAccessor 是一个接口，它有两个已有的具体实现：一个通过本地方法来实现反射调用，另一个则使用了委派模式。

![8a22180d61207a9b411042e4f11f296](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures8a22180d61207a9b411042e4f11f296.jpg)

## 本地实现

每个 Method 实例的第一次反射调用都会生成一个委派实现，它所委派的具体实现便是一个本地实现。本地实现非常容易理解。当进入了 Java 虚拟机内部之后，我们便拥有了 Method 实例所指向方法的具体地址。这时候，反射调用无非就是将传入的参数准备好，然后调用进入目标方法。

### eg:

```
// v0 版本
import java.lang.reflect.Method;
 
public class Test {
  public static void target(int i) {
    new Exception("#" + i).printStackTrace();
  }
 
  public static void main(String[] args) throws Exception {
    Class<?> klass = Class.forName("Test");
    Method method = klass.getMethod("target", int.class);
    method.invoke(null, 0);
  }
}
 
# 不同版本的输出略有不同，这里我使用了 Java 10。
$ java Test
java.lang.Exception: #0
        at Test.target(Test.java:5)
        at java.base/jdk.internal.reflect.NativeMethodAccessorImpl .invoke0(Native Method)
 a      t java.base/jdk.internal.reflect.NativeMethodAccessorImpl. .invoke(NativeMethodAccessorImpl.java:62)
 t       java.base/jdk.internal.reflect.DelegatingMethodAccessorImpl.i .invoke(DelegatingMethodAccessorImpl.java:43)
        java.base/java.lang.reflect.Method.invoke(Method.java:564)
  t        Test.main(Test.java:131
```

为了方便理解，我们可以打印一下反射调用到目标方法时的栈轨迹。在上面的 v0 版本代码中，我们获取了一个指向 Test.target 方法的 Method 对象，并且用它来进行反射调用。在 Test.target 中，我会打印出栈轨迹。

可以看到，反射调用先是调用了 Method.invoke，然后进入委派实现（DelegatingMethodAccessorImpl），再然后进入本地实现（NativeMethodAccessorImpl），最后到达目标方法。

> 本地实现要经过Java 到 C++ 再到 Java 的切换，为什么要使用本地实现
>
> Java 反射使用本地方法主要是出于以下几个原因：
>
> 1. **性能优化**：
> - 反射涉及频繁的元数据访问和动态类型检查，通过本地方法实现可以减少性能开销，尤其是在处理大量反射调用时。
> 2. **底层访问**：
> - 某些反射操作需要直接与系统资源（如文件、网络、硬件等）交互，这通常只能通过本地代码实现，以获得更高的灵活性和效率。
> 3. **数据类型转换**：
> - 在 Java 和本地代码之间传递复杂数据结构时，使用本地方法可以简化数据类型的转换过程，特别是在处理数组、字符串和对象时。
> 4. **利用已有库**：
>  - 许多底层功能和库是用 C/C++ 实现的，通过本地方法，Java 可以直接调用这些库，重用已有的功能。
> 5. **安全性**：
>  - Java 的安全模型要求对内存和资源的访问进行严格控制。使用本地方法时，JVM 可以对这些调用进行监控和管理，确保安全性。
>
> 通过使用本地方法，Java 反射能够实现更高的性能、灵活性和安全性，同时有效利用现有的底层资源和库。这种设计使得 Java 能够在提供高层抽象的同时，保留对底层系统的访问能力。

## 动态实现

Java 的反射调用机制还设立了另一种动态生成字节码的实现（下称动态实现），直接使用 invoke 指令来调用目标方法。之所以采用委派实现，便是为了能够在本地实现以及动态实现中切换。

```java
// 动态实现的伪代码，这里只列举了关键的调用逻辑，其实它还包括调用者检测、参数检测的字节码。
package jdk.internal.reflect;
 
public class GeneratedMethodAccessor1 extends ... {
  @Overrides    
  public Object invoke(Object obj, Object[] args) throws ... {
    Test.target((int) args[0]);
    return null;
  }
}
```

动态实现和本地实现相比，其运行效率要快上 20 倍 。这是因为动态实现无需经过 Java 到 C++ 再到 Java 的切换，但由于生成字节码十分耗时，仅调用一次的话，反而是本地实现要快上 3 到 4 倍 [3]。

考虑到许多反射调用仅会执行一次，Java 虚拟机设置了一个阈值 15（可以通过 -Dsun.reflect.inflationThreshold= 来调整），当某个反射调用的调用次数在 15 之下时，采用本地实现；当达到 15 时，便开始动态生成字节码，并将委派实现的委派对象切换至动态实现，这个过程我们称之为 Inflation。

### eg:

为了观察这个过程，我将刚才的例子更改为下面的 v1 版本。它会将反射调用循环 20 次。

```
// v1 版本
import java.lang.reflect.Method;
 
public class Test {
  public static void target(int i) {
    new Exception("#" + i).printStackTrace();
  }
 
  public static void main(String[] args) throws Exception {
    Class<?> klass = Class.forName("Test");
    Method method = klass.getMethod("target", int.class);
    for (int i = 0; i < 20; i++) {
      method.invoke(null, i);
    }
  }
}
 
# 使用 -verbose:class 打印加载的类
$ java -verbose:class Test
...
java.lang.Exception: #14
        at Test.target(Test.java:5)
        at java.base/jdk.internal.reflect.NativeMethodAccessorImpl .invoke0(Native Method)
        at java.base/jdk.internal.reflect.NativeMethodAccessorImpl .invoke(NativeMethodAccessorImpl.java:62)
        at java.base/jdk.internal.reflect.DelegatingMethodAccessorImpl .invoke(DelegatingMethodAccessorImpl.java:43)
        at java.base/java.lang.reflect.Method.invoke(Method.java:564)
        at Test.main(Test.java:12)
[0.158s][info][class,load] ...
...
[0.160s][info][class,load] jdk.internal.reflect.GeneratedMethodAccessor1 source: __JVM_DefineClass__
java.lang.Exception: #15
       at Test.target(Test.java:5)
       at java.base/jdk.internal.reflect.NativeMethodAccessorImpl .invoke0(Native Method)
       at java.base/jdk.internal.reflect.NativeMethodAccessorImpl .invoke(NativeMethodAccessorImpl.java:62)
       at java.base/jdk.internal.reflect.DelegatingMethodAccessorImpl .invoke(DelegatingMethodAccessorImpl.java:43)
       at java.base/java.lang.reflect.Method.invoke(Method.java:564)
       at Test.main(Test.java:12)
java.lang.Exception: #16
       at Test.target(Test.java:5)
       at jdk.internal.reflect.GeneratedMethodAccessor1 .invoke(Unknown Source)
       at java.base/jdk.internal.reflect.DelegatingMethodAccessorImpl .invoke(DelegatingMethodAccessorImpl.java:43)
       at java.base/java.lang.reflect.Method.invoke(Method.java:564)
       at Test.main(Test.java:12)
...
```

可以看到，在第 15 次（从 0 开始数）反射调用时，我们便触发了动态实现的生成。这时候，Java 虚拟机额外加载了不少类。其中，最重要的当属 GeneratedMethodAccessor1（第 30 行）。并且，从第 16 次反射调用开始，我们便切换至这个刚刚生成的动态实现（第 40 行）。

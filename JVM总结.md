[TOC]



![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures414248014bf825dd610c3095eed75377.jpg)

# JVM执行字节码

## JVM视角

从虚拟机视角来看，执行 Java 代码首先需要将它编译而成的 class 文件加载到 Java 虚拟机中。加载后的 Java 类会被存放于方法区（Method Area）中。实际运行时，虚拟机会执行方法区内的代码。

如果你熟悉 X86 的话，你会发现这和段式内存管理中的代码段类似。而且，Java 虚拟机同样也在内存中划分出堆和栈来存储运行时数据。

不同的是，Java 虚拟机会将栈细分为面向 Java 方法的 Java 方法栈，面向本地方法（用 C++ 写的 native 方法）的本地方法栈，以及存放各个线程执行位置的 PC 寄存器。

在运行过程中，每当调用进入一个 Java 方法，Java 虚拟机会在当前线程的 Java 方法栈中生成一个栈帧，用以存放局部变量以及字节码的操作数。这个栈帧的大小是提前计算好的，而且 Java 虚拟机不要求栈帧在内存空间里连续分布。

当退出当前执行的方法时，不管是正常返回还是异常返回，Java 虚拟机均会弹出当前线程的当前栈帧，并将之舍弃。

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesab5c3523af08e0bf2f689c1d6033ef77.png)

### java字节码

eg:

```java
public class Foo {
  private int tryBlock;
  private int catchBlock;
  private int finallyBlock;
  private int methodExit;
 
  public void test() {
    try {
      tryBlock = 0;
    } catch (Exception e) {
      catchBlock = 1;
    } finally {
      finallyBlock = 2;
    }
    methodExit = 3;
  }
}
```

编译过后，我们便可以使用 javap 来查阅 Foo.test 方法的字节码。

```
$ javac Foo.java
$ javap -p -v Foo
Classfile ../Foo.class
  Last modified ..; size 541 bytes
  MD5 checksum 3828cdfbba56fea1da6c8d94fd13b20d
  Compiled from "Foo.java"
public class Foo
  minor version: 0
  major version: 54
  flags: (0x0021) ACC_PUBLIC, ACC_SUPER
  this_class: #7                          // Foo
  super_class: #8                         // java/lang/Object
  interfaces: 0, fields: 4, methods: 2, attributes: 1
Constant pool:
   #1 = Methodref          #8.#23         // java/lang/Object."<init>":()V
   #2 = Fieldref           #7.#24         // Foo.tryBlock:I
   #3 = Fieldref           #7.#25         // Foo.finallyBlock:I
   #4 = Class              #26            // java/lang/Exception
   #5 = Fieldref           #7.#27         // Foo.catchBlock:I
   #6 = Fieldref           #7.#28         // Foo.methodExit:I
   #7 = Class              #29            // Foo
   #8 = Class              #30            // java/lang/Object
   #9 = Utf8               tryBlock
  #10 = Utf8               I
  #11 = Utf8               catchBlock
  #12 = Utf8               finallyBlock
  #13 = Utf8               methodExit
  #14 = Utf8               <init>
  #15 = Utf8               ()V
  #16 = Utf8               Code
  #17 = Utf8               LineNumberTable
  #18 = Utf8               test
  #19 = Utf8               StackMapTable
  #20 = Class              #31            // java/lang/Throwable
  #21 = Utf8               SourceFile
  #22 = Utf8               Foo.java
  #23 = NameAndType        #14:#15        // "<init>":()V
  #24 = NameAndType        #9:#10         // tryBlock:I
  #25 = NameAndType        #12:#10        // finallyBlock:I
  #26 = Utf8               java/lang/Exception
  #27 = NameAndType        #11:#10        // catchBlock:I
  #28 = NameAndType        #13:#10        // methodExit:I
  #29 = Utf8               Foo
  #30 = Utf8               java/lang/Object
  #31 = Utf8               java/lang/Throwable
{
  private int tryBlock;
    descriptor: I
    flags: (0x0002) ACC_PRIVATE
 
  private int catchBlock;
    descriptor: I
    flags: (0x0002) ACC_PRIVATE
 
  private int finallyBlock;
    descriptor: I
    flags: (0x0002) ACC_PRIVATE
 
  private int methodExit;
    descriptor: I
    flags: (0x0002) ACC_PRIVATE
 
  public Foo();
    descriptor: ()V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokespecial #1                  // Method java/lang/Object."<init>":()V
         4: return
      LineNumberTable:
        line 1: 0
 
  public void test();
    descriptor: ()V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=2, locals=3, args_size=1
         0: aload_0
         1: iconst_0
         2: putfield      #2                  // Field tryBlock:I
         5: aload_0
         6: iconst_2
         7: putfield      #3                  // Field finallyBlock:I
        10: goto          35
        13: astore_1
        14: aload_0
        15: iconst_1
        16: putfield      #5                  // Field catchBlock:I
        19: aload_0
        20: iconst_2
        21: putfield      #3                  // Field finallyBlock:I
        24: goto          35
        27: astore_2
        28: aload_0
        29: iconst_2
        30: putfield      #3                  // Field finallyBlock:I
        33: aload_2
        34: athrow
        35: aload_0
        36: iconst_3
        37: putfield      #6                  // Field methodExit:I
        40: return
      Exception table:
         from    to  target type
             0     5    13   Class java/lang/Exception
             0     5    27   any
            13    19    27   any
      LineNumberTable:
        line 9: 0
        line 13: 5
        line 14: 10
        line 10: 13
        line 11: 14
        line 13: 19
        line 14: 24
        line 13: 27
        line 14: 33
        line 15: 35
        line 16: 40
      StackMapTable: number_of_entries = 3
        frame_type = 77 /* same_locals_1_stack_item */
          stack = [ class java/lang/Exception ]
        frame_type = 77 /* same_locals_1_stack_item */
          stack = [ class java/lang/Throwable ]
        frame_type = 7 /* same */
}
SourceFile: "Foo.java"
```

#### 1. 基本信息，涵盖了原 class 文件的相关信息

class 文件的版本号（minor version: 0，major version: 54），该类的访问权限（flags: (0x0021) ACC_PUBLIC, ACC_SUPER），该类（this_class: #7）以及父类（super_class: #8）的名字，所实现接口（interfaces: 0）、字段（fields: 4）、方法（methods: 2）以及属性（attributes: 1）的数目。

```
Classfile ../Foo.class
  Last modified ..; size 541 bytes
  MD5 checksum 3828cdfbba56fea1da6c8d94fd13b20d
  Compiled from "Foo.java"
public class Foo
  minor version: 0
  major version: 54
  flags: (0x0021) ACC_PUBLIC, ACC_SUPER
  this_class: #7                          // Foo
  super_class: #8                         // java/lang/Object
  interfaces: 0, fields: 4, methods: 2, attributes: 1
```

### 2. 常量池，用来存放各种常量以及符号引用

常量池中的每一项都有一个对应的索引（如 #1），并且可能引用其他的常量池项（#1 = Methodref #8.#23）

```
Constant pool:
   #1 = Methodref          #8.#23         // java/lang/Object."<init>":()V
... 
   #8 = Class              #30            // java/lang/Object
...
  #14 = Utf8               <init>
  #15 = Utf8               ()V
...
  #23 = NameAndType        #14:#15        // "<init>":()V
...
  #30 = Utf8               java/lang/Object

```

举例来说，上图中的 1 号常量池项是一个指向 Object 类构造器的符号引用。它是由另外两个常量池项所构成。如果将它看成一个树结构的话，那么它的叶节点会是字符串常量，如下图所示。

![image-20241004224835665](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241004224835665.png)

### 3. 字段区域，用来列举该类中的各个字段

这里最主要的信息便是该字段的类型（descriptor: I）以及访问权限（flags: (0x0002) ACC_PRIVATE）。对于声明为 final 的静态字段而言，如果它是基本类型或者字符串类型，那么字段区域还将包括它的常量值。

另外，Java 虚拟机同样使用了“描述符”（descriptor）来描述字段的类型。

```
  private int tryBlock;
    descriptor: I
    flags: (0x0002) ACC_PRIVATE
```

### 4. 方法区域，用来列举该类中的各个方法

除了方法描述符以及访问权限之外，每个方法还包括最为重要的代码区域（Code:)。

```
public void test();
    descriptor: ()V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=2, locals=3, args_size=1
         0: aload_0
...
        10: goto          35
...
        34: athrow
        35: aload_0
...
        40: return
      Exception table:
         from    to  target type
             0     5    13   Class java/lang/Exception
             0     5    27   any
            13    19    27   any
      LineNumberTable:
        line 9: 0
...
        line 16: 40
      StackMapTable: number_of_entries = 3
        frame_type = 77 /* same_locals_1_stack_item */
          stack = [ class java/lang/Exception ]
```

接下来则是该方法的字节码。每条字节码均标注了对应的偏移量（bytecode index，BCI），这是用来定位字节码的。比如说偏移量为 10 的跳转字节码 10: goto 35，将跳转至偏移量为 35 的字节码 35: aload_0。

紧跟着的异常表（Exception table:）也会使用偏移量来定位每个异常处理器所监控的范围（由 from 到 to 的代码区域），以及异常处理器的起始位置（target）。除此之外，它还会声明所捕获的异常类型（type）。其中，any 指代任意异常类型。

再接下来的行数表（LineNumberTable:）则是 Java 源程序到字节码偏移量的映射。如果你在编译时使用了 -g 参数（javac -g Foo.java），那么这里还将出现局部变量表（LocalVariableTable:），展示 Java 程序中每个局部变量的名字、类型以及作用域。

行数表和局部变量表均属于调试信息。Java 虚拟机并不要求 class 文件必备这些信息。

```
 LocalVariableTable:
        Start  Length  Slot  Name   Signature
           14       5     1     e   Ljava/lang/Exception;
            0      41     0  this   LFoo;
```

最后则是字节码操作数栈的映射表（StackMapTable: number_of_entries = 3）。该表描述的是字节码跳转后操作数栈的分布情况，一般被 Java 虚拟机用于验证所加载的类，以及即时编译相关的一些操作，正常情况下，你无须深入了解。

## 硬件视角

从硬件视角来看，Java 字节码无法直接执行。因此，Java 虚拟机需要将字节码翻译成机器码。

在 HotSpot 里面，上述翻译过程有两种形式：

- 第一种是解释执行，即逐条将字节码翻译成机器码并执行；
- 第二种是即时编译（Just-In-Time compilation，JIT），即将一个方法中包含的所有字节码编译成机器码后再执行。

前者的优势在于无需等待编译，而后者的优势在于实际运行速度更快。HotSpot 默认采用混合模式，综合了解释执行和即时编译两者的优点。它会先解释执行字节码，而后将其中反复执行的热点代码，以方法为单位进行即时编译。

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures5ee351091464de78eed75438b6f9183b.png)

# Java 虚拟机的 boolean 类型

在 Java 语言规范中，boolean 类型的值只有两种可能，它们分别用符号“true”和“false”来表示。显然，这两个符号是不能被虚拟机直接使用的。

在 Java 虚拟机规范中，boolean 类型则被映射成 int 类型。具体来说，“true”被映射为整数 1，而“false”被映射为整数 0。这个编码规则约束了 Java 字节码的具体实现。

## eg: Java 语言和 Java 虚拟机看待 boolean 类型的方式是否不同

```bash
echo '
public class Foo {
 public static void main(String[] args) {
  boolean flag = true;
  if (flag) System.out.println("Hello, Java!");
  if (flag == true) System.out.println("Hello, JVM!");
 }
}' > Foo.java
javac Foo.java
java Foo
java -cp /path/to/asmtools.jar org.openjdk.asmtools.jdis.Main Foo.class Foo.jasm.1
awk 'NR==1,/iconst_1/{sub(/iconst_1/, "iconst_2")} 1' Foo.jasm.1 > Foo.jasm
java -cp /path/to/asmtools.jar org.openjdk.asmtools.jasm.Main Foo.jasm
java Foo
```
jvm把boolean当做int来处理

flag = iconst_1 = true

awk把stackframe中的flag改为iconst_2

if（flag）比较时ifeq指令做是否为零判断，常数2仍为true，打印输出

if（true == flag）比较时if_cmpne做整数比较，iconst_1是否等于flag，比较失败，不再打印输出



# Java基本类型存储空间大小

Java 虚拟机每调用一个 Java 方法，便会创建一个栈帧。这种栈帧有两个主要的组成部分，分别是局部变量区，以及字节码的操作数栈。

## 局部变量区

这里的局部变量是广义的，**除了普遍意义下的局部变量之外，它还包含实例方法的“this 指针”以及方法所接收的参数**。

在 Java 虚拟机规范中，**局部变量区等价于一个数组**，并且可以用正整数来索引。除了 **long、double 值需要用两个数组单元来存储之外，其他基本类型以及引用类型的值均占用一个数组单元**。

当然，这种情况仅存在于局部变量，而并不会出现在存储于堆中的字段或者数组元素上。对于 byte、char 以及 short 这三种类型的字段或者数组单元，它们在堆上占用的空间分别为一字节、两字节，以及两字节，也就是说，跟这些类型的值域相吻合。

> 因此，当我们将一个 int 类型的值，存储到这些类型的字段或数组时，相当于做了一次隐式的掩码操作。举例来说，当我们把 0xFFFFFFFF（-1）存储到一个声明为 char 类型的字段里时，由于该字段仅占两字节，所以高两位的字节便会被截取掉，最终存入“\uFFFF”。boolean 字段和 boolean 数组则比较特殊。在 HotSpot 中，boolean 字段占用一字节，而 boolean 数组则直接用 byte 数组来实现。为了保证堆中的 boolean 值是合法的，HotSpot 在存储时显式地进行掩码操作，也就是说，只取最后一位的值存入 boolean 字段或数组中。

## 操作数栈

Java 虚拟机的算数运算几乎全部依赖于操作数栈。也就是说，我们需要将堆中的 boolean、byte、char 以及 short 加载到操作数栈上，而后将栈上的值当成 int 类型来运算。

对于 boolean、char 这两个无符号类型来说，加载伴随着零扩展。举个例子，char 的大小为两个字节。在加载时 char 的值会被复制到 int 类型的低二字节，而高二字节则会用 0 来填充。

对于 byte、short 这两个类型来说，加载伴随着符号扩展。举个例子，short 的大小为两个字节。在加载时 short 的值同样会被复制到 int 类型的低二字节。如果该 short 值为非负数，即最高位为 0，那么该 int 类型的值的高二字节会用 0 来填充，否则用 1 来填充。



# JVM加载类过程

## 引用类型

Java 语言的类型可以分为两大类：基本类型（primitive types）和引用类型（reference types）。

引用类型，Java 将其细分为四种：类、接口、数组类和泛型参数。由于泛型参数会在编译过程中被擦除，因此 Java 虚拟机实际上只有前三种。在类、接口和数组类中，数组类是由 Java 虚拟机直接生成的，其他两种则有对应的字节流。

> 字节流，最常见的形式要属由 Java 编译器生成的 class 文件。除此之外，我们也可以在程序内部直接生成，或者从网络中获取（例如网页中内嵌的小程序 Java applet）字节流。这些不同形式的字节流，都会被加载到 Java 虚拟机中，成为类或接口。

## 加载

加载，是指查找字节流，并且据此创建类的过程。前面提到，对于数组类来说，它并没有对应的字节流，而是由 Java 虚拟机直接生成的。对于其他的类来说，Java 虚拟机则需要借助类加载器来完成查找字节流的过程。

> 类加载的结果是把一段字节流变换成Class结构并写方法区, 在加载阶段就已经生成class结构了，已经写入了方法区，只是被标记为未链接而暂不能使用。

启动类加载器是由 C++ 实现的，没有对应的 Java 对象，因此在 Java 中只能用 null 来指代。除了启动类加载器之外，其他的类加载器都是 java.lang.ClassLoader 的子类，因此有对应的 Java 对象。这些类加载器需要先由另一个类加载器，比如说启动类加载器，加载至 Java 虚拟机中，方能执行类加载。

在 Java 9 之前，启动类加载器负责加载最为基础、最为重要的类，比如存放在 JRE 的 lib 目录下 jar 包中的类（以及由虚拟机参数 -Xbootclasspath 指定的类）。除了启动类加载器之外，另外两个重要的类加载器是扩展类加载器（extension class loader）和应用类加载器（application class loader），均由 Java 核心类库提供。

> `java.lang.*` 包中的类（如 `java.lang.Math`、`java.lang.String`、`java.lang.System` 等）都是由启动类加载器加载的，因此不用import也能使用。

扩展类加载器的父类加载器是启动类加载器。它负责加载相对次要、但又通用的类，比如存放在 JRE 的 lib/ext 目录下 jar 包中的类（以及由系统变量 java.ext.dirs 指定的类）。

应用类加载器的父类加载器则是扩展类加载器。它负责加载应用程序路径下的类。（这里的应用程序路径，便是指虚拟机参数 -cp/-classpath、系统变量 java.class.path 或环境变量 CLASSPATH 所指定的路径。）默认情况下，应用程序中包含的类便是由应用类加载器加载的。

除了加载功能之外，类加载器还提供了命名空间的作用。在 Java 虚拟机中，类的唯一性是由类加载器实例以及类的全名一同确定的。即便是同一串字节流，经由不同的类加载器加载，也会得到两个不同的类。（在大型应用中，我们往往借助这一特性，来运行同一个类的不同版本。）

## 链接

链接，是指将创建成的类合并至 Java 虚拟机中，使之能够执行的过程。它可分为验证、准备以及解析三个阶段。

### 验证

验证阶段的目的，在于确保被加载类能够满足 Java 虚拟机的约束条件。通常而言，Java 编译器生成的类文件必然满足 Java 虚拟机的约束条件。

### 准备

准备阶段的目的，则是为被加载类的静态字段分配内存。Java 代码中对静态字段的具体初始化，则会在稍后的初始化阶段中进行。

除了分配内存外，部分 Java 虚拟机还会在此阶段构造其他跟类层次相关的数据结构，比如说用来实现虚方法的动态绑定的方法表。

在 class 文件被加载至 Java 虚拟机之前，这个类无法知道其他类及其方法、字段所对应的具体地址，甚至不知道自己方法、字段的地址。因此，每当需要引用这些成员时，Java 编译器会生成一个符号引用。在运行阶段，这个符号引用一般都能够无歧义地定位到具体目标上。

举例来说，对于一个方法调用，编译器会生成一个包含目标方法所在类的名字、目标方法的名字、接收参数类型以及返回值类型的符号引用，来指代所要调用的方法。

### 解析

解析阶段的目的，正是将这些符号引用解析成为实际引用。如果符号引用指向一个未被加载的类，或者未被加载类的字段或方法，那么解析将触发这个类的加载（但未必触发这个类的链接以及初始化。）Java 虚拟机规范并没有要求在链接过程中完成解析。它仅规定了：如果某些字节码使用了符号引用，那么在执行这些字节码之前，需要完成对这些符号引用的解析。

## 初始化

在 Java 代码中，如果要初始化一个静态字段，我们可以在声明时直接赋值，也可以在静态代码块中对其赋值。

如果直接赋值的静态字段被 final 所修饰，并且它的类型是基本类型或字符串时，那么该字段便会被 Java 编译器标记成常量值（ConstantValue），其初始化直接由 Java 虚拟机完成。除此之外的直接赋值操作，以及所有静态代码块中的代码，则会被 Java 编译器置于同一方法中，并把它命名为 < clinit >。

类加载的最后一步是初始化，便是为标记为常量值的字段赋值，以及执行 < clinit > 方法的过程。**Java 虚拟机会通过加锁来确保类的 < clinit > 方法仅被执行一次**。

只有当初始化完成之后，类才正式成为可执行的状态。

#### 类初始化时机

1. 当虚拟机启动时，初始化用户指定的主类；

2. 当遇到用以新建目标类实例的 new 指令时，初始化 new 指令的目标类；

3. 当遇到调用静态方法的指令时，初始化该静态方法所在的类；

4. 当遇到访问静态字段的指令时，初始化该静态字段所在的类；

   > eg:类的初始化仅会被执行一次，这个特性被用来实现单例的延迟初始化。
   >
   > ```java
   > public class Singleton {
   >   private Singleton() {}
   >   private static class LazyHolder {
   >     static final Singleton INSTANCE = new Singleton();
   >   }
   >   public static Singleton getInstance() {
   >     return LazyHolder.INSTANCE;
   >   }
   > }
   > ```
   >
   > 单例延迟初始化例子中，只有当调用 Singleton.getInstance 时，程序才会访问 LazyHolder.INSTANCE，才会触发对 LazyHolder 的初始化（对应第 4 种情况），继而新建一个 Singleton 的实例。
   >
   > 由于类初始化是线程安全的，并且仅被执行一次，因此程序可以确保多线程环境下有且仅有一个 Singleton 实例。

5. 子类的初始化会触发父类的初始化；

6. 如果一个接口定义了 default 方法，那么直接实现或者间接实现该接口的类的初始化，会触发该接口的初始化；

7. 使用反射 API 对某个类进行反射调用时，初始化这个类；

8. 当初次调用 MethodHandle 实例时，初始化该 MethodHandle 指向的方法所在的类。



# 方法调用过程

# eg：

```java
void invoke(Object obj, Object... args) { ... }
void invoke(String s, Object obj, Object... args) { ... }
 
invoke(null, 1);    // 调用第二个 invoke 方法
invoke(null, 1, 2); // 调用第二个 invoke 方法
invoke(null, new Object[]{1}); // 只有手动绕开可变长参数的语法糖，
                               // 才能调用第一个 invoke 方法
```



## 重载与重写

### 重载

在 Java 程序里，如果**同一个类**中出现多个名字相同，并且参数类型相同的方法，那么它无法通过编译。也就是说，在正常情况下，如果我们想要在同一个类中定义名字相同的方法，那么它们的参数类型必须不同。这些方法之间的关系，我们称之为重载。

重载的方法在编译过程中即可完成识别。具体到每一个方法调用，Java 编译器会根据所传入参数的声明类型（注意与实际类型区分）来选取重载方法。如果 Java 编译器在同一个阶段中找到了多个适配的方法，那么它会在其中选择一个最为贴切的，而决定贴切程度的一个关键就是形式参数类型的继承关系。

> eg:在例子中，当传入 null 时，它既可以匹配第一个方法中声明为 Object 的形式参数，也可以匹配第二个方法中声明为 String 的形式参数。由于 String 是 Object 的子类，因此 Java 编译器会认为第二个方法更为贴切。

除了同一个类中的方法，重载也可以作用于这个类所继承而来的方法。也就是说，如果子类定义了与父类中非私有方法同名的方法，而且这两个方法的参数类型不同，那么在子类中，这两个方法同样构成了重载。

### 重写

如果子类定义了与父类中非私有方法同名的方法，而且这两个方法的参数类型相同，那么这两个方法之间又是什么关系呢？

如果这两个方法都是静态的，那么子类中的方法隐藏了父类中的方法。如果这两个方法都不是静态的，且都不是私有的，那么子类的方法重写了父类中的方法。

众所周知，Java 是一门面向对象的编程语言，它的一个重要特性便是多态。而方法重写，正是多态最重要的一种体现方式：它允许子类在继承父类部分功能的同时，拥有自己独特的行为。



## JVM的静态绑定与动态绑定

### JVM如何识别方法

> 在编译完成之后，我们可以再向 class 文件中添加方法名和参数类型相同，而返回类型不同的方法。当这种包括多个方法名相同、参数类型相同，而返回类型不同的方法的类，出现在 Java 编译器的用户类路径上时，它是怎么确定需要调用哪个方法的呢？当前版本的 Java 编译器会直接选取第一个方法名以及参数类型匹配的方法。并且，它会根据所选取方法的返回类型来决定可不可以通过编译，以及需不需要进行值转换等。

Java 虚拟机识别方法的关键在于类名、方法名以及方法描述符（method descriptor）。方法描述符是由方法的参数类型以及返回类型所构成。在同一个类中，如果同时出现多个名字相同且描述符也相同的方法，那么 Java 虚拟机会在类的验证阶段报错。

Java 虚拟机与 Java 语言不同，它并不限制名字与参数类型相同，但返回类型不同的方法出现在同一个类中，对于调用这些方法的字节码来说，由于字节码所附带的方法描述符包含了返回类型，因此 Java 虚拟机能够准确地识别目标方法。

Java 虚拟机中关于方法重写的判定同样基于方法描述符。也就是说，如果子类定义了与父类中非私有、非静态方法同名的方法，那么只有当这两个方法的参数类型以及返回类型一致，Java 虚拟机才会判定为重写。

Java 虚拟机中的静态绑定指的是在解析时便能够直接识别目标方法的情况，而动态绑定则指的是需要在运行过程中根据调用者的动态类型来识别目标方法的情况。

> 由于对重载方法的区分在编译阶段已经完成，我们可以认为 Java 虚拟机不存在重载这一概念。因此，在某些文章中，重载也被称为静态绑定（static binding），或者编译时多态（compile-time polymorphism）；而重写则被称为动态绑定（dynamic binding）。这个说法在 Java 虚拟机语境下并非完全正确。这是因为某个类中的重载方法可能被它的子类所重写，因此 Java 编译器会将所有对非私有实例方法的调用编译为需要动态绑定的类型。

Java 字节码中与调用相关的指令共有五种。

1. invokestatic：用于调用静态方法。
2. invokespecial：用于调用私有实例方法、构造器，以及使用 super 关键字调用父类的实例方法或构造器，和所实现接口的默认方法。
3. invokevirtual：用于调用非私有实例方法。
4. invokeinterface：用于调用接口方法。
5. invokedynamic：用于调用动态方法。



### eg：

Java 的重写与 Java 虚拟机中的重写并不一致，但是编译器会通过生成桥接方法来弥补。

```java
interface Customer {
  boolean isVIP();
}
 
class Merchant {
  public Number actionPrice(double price, Customer customer) {
      return 0;
  }
}
 
class NaiveMerchant extends Merchant {
  @Override
  public Double actionPrice(double price, Customer customer) {
      return 0.0;
  }
}
```

```
//Merchant.class
Classfile /home/qiuhb/Project/jvmtest/Merchant.class
  Last modified Oct 4, 2024; size 349 bytes
  MD5 checksum f8a40f596bfbc4c9d3142a5bc5a3e7b1
  Compiled from "override.java"
class Merchant
  minor version: 0
  major version: 52
  flags: ACC_SUPER
Constant pool:
   #1 = Methodref          #4.#13         // java/lang/Object."<init>":()V
   #2 = Methodref          #14.#15        // java/lang/Integer.valueOf:(I)Ljava/lang/Integer;
   #3 = Class              #16            // Merchant
   #4 = Class              #17            // java/lang/Object
   #5 = Utf8               <init>
   #6 = Utf8               ()V
   #7 = Utf8               Code
   #8 = Utf8               LineNumberTable
   #9 = Utf8               actionPrice
  #10 = Utf8               (DLCustomer;)Ljava/lang/Number;
  #11 = Utf8               SourceFile
  #12 = Utf8               override.java
  #13 = NameAndType        #5:#6          // "<init>":()V
  #14 = Class              #18            // java/lang/Integer
  #15 = NameAndType        #19:#20        // valueOf:(I)Ljava/lang/Integer;
  #16 = Utf8               Merchant
  #17 = Utf8               java/lang/Object
  #18 = Utf8               java/lang/Integer
  #19 = Utf8               valueOf
  #20 = Utf8               (I)Ljava/lang/Integer;
{
  Merchant();
    descriptor: ()V
    flags:
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokespecial #1                  // Method java/lang/Object."<init>":()V
         4: return
      LineNumberTable:
        line 5: 0

  public java.lang.Number actionPrice(double, Customer);
    descriptor: (DLCustomer;)Ljava/lang/Number;
    flags: ACC_PUBLIC
    Code:
      stack=1, locals=4, args_size=3
         0: iconst_0
         1: invokestatic  #2                  // Method java/lang/Integer.valueOf:(I)Ljava/lang/Integer;
         4: areturn
      LineNumberTable:
        line 7: 0
}
SourceFile: "override.java"
```

```
//NaiveMerchant.class
Classfile /home/qiuhb/Project/jvmtest/NaiveMerchant.class
  Last modified Oct 4, 2024; size 433 bytes
  MD5 checksum f30d2c69d3e0079a35ca554b31ca60af
  Compiled from "override.java"
class NaiveMerchant extends Merchant
  minor version: 0
  major version: 52
  flags: ACC_SUPER
Constant pool:
   #1 = Methodref          #5.#15         // Merchant."<init>":()V
   #2 = Methodref          #16.#17        // java/lang/Double.valueOf:(D)Ljava/lang/Double;
   #3 = Methodref          #4.#18         // NaiveMerchant.actionPrice:(DLCustomer;)Ljava/lang/Double;
   #4 = Class              #19            // NaiveMerchant
   #5 = Class              #20            // Merchant
   #6 = Utf8               <init>
   #7 = Utf8               ()V
   #8 = Utf8               Code
   #9 = Utf8               LineNumberTable
  #10 = Utf8               actionPrice
  #11 = Utf8               (DLCustomer;)Ljava/lang/Double;
  #12 = Utf8               (DLCustomer;)Ljava/lang/Number;
  #13 = Utf8               SourceFile
  #14 = Utf8               override.java
  #15 = NameAndType        #6:#7          // "<init>":()V
  #16 = Class              #21            // java/lang/Double
  #17 = NameAndType        #22:#23        // valueOf:(D)Ljava/lang/Double;
  #18 = NameAndType        #10:#11        // actionPrice:(DLCustomer;)Ljava/lang/Double;
  #19 = Utf8               NaiveMerchant
  #20 = Utf8               Merchant
  #21 = Utf8               java/lang/Double
  #22 = Utf8               valueOf
  #23 = Utf8               (D)Ljava/lang/Double;
{
  NaiveMerchant();
    descriptor: ()V
    flags:
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokespecial #1                  // Method Merchant."<init>":()V
         4: return
      LineNumberTable:
        line 11: 0

  public java.lang.Double actionPrice(double, Customer);
    descriptor: (DLCustomer;)Ljava/lang/Double;
    flags: ACC_PUBLIC
    Code:
      stack=2, locals=4, args_size=3
         0: dconst_0
         1: invokestatic  #2                  // Method java/lang/Double.valueOf:(D)Ljava/lang/Double;
         4: areturn
      LineNumberTable:
        line 14: 0

  public java.lang.Number actionPrice(double, Customer);
    descriptor: (DLCustomer;)Ljava/lang/Number;
    flags: ACC_PUBLIC, ACC_BRIDGE, ACC_SYNTHETIC
    Code:
      stack=4, locals=4, args_size=3
         0: aload_0
         1: dload_1
         2: aload_3
         3: invokevirtual #3                  // Method actionPrice:(DLCustomer;)Ljava/lang/Double;
         6: areturn
      LineNumberTable:
        line 11: 0
}
SourceFile: "override.java"
```

Merchant类中actionPrice方法返回值类型为Number
NaiveMerchant类中actionPrice方法返回值类型为Double

为了保证重写语义, NaiveMerchant类生成的字节码中有两个参数类型相同返回值类型不同的actionPrice方法, 生成的桥接方法还有一个acc_synthetic标记，代表对程序不可见。因此javac不能直接选取那个方法。
Method actionPrice:(DLCustomer;)Ljava/lang/Double;
Method actionPrice:(DLCustomer;)Ljava/lang/Number; // 桥接到返回值为double的方法 flags: ACC_PUBLIC, ACC_BRIDGE, ACC_SYNTHETIC

### 符号引用

在编译过程中，我们并不知道目标方法的具体内存地址。因此，Java 编译器会暂时用符号引用来表示该目标方法。这一符号引用包括目标方法所在的类或接口的名字，以及目标方法的方法名和方法描述符。

符号引用存储在 class 文件的常量池之中。根据目标方法是否为接口方法，这些引用可分为接口符号引用和非接口符号引用。

在执行使用了符号引用的字节码前，Java 虚拟机需要解析这些符号引用，并替换为实际引用。

对于非接口符号引用，假定该符号引用所指向的类为 C，则 Java 虚拟机会按照如下步骤进行查找。

1. 在 C 中查找符合名字及描述符的方法。
2. 如果没有找到，在 C 的父类中继续搜索，直至 Object 类。
3. 如果没有找到，在 C 所直接实现或间接实现的接口中搜索，这一步搜索得到的目标方法必须是非私有、非静态的。并且，如果目标方法在间接实现的接口中，则需满足 C 与该接口之间没有其他符合条件的目标方法。如果有多个符合条件的目标方法，则任意返回其中一个。

从这个解析算法可以看出，静态方法也可以通过子类来调用。此外，子类的静态方法会隐藏（注意与重写区分）父类中的同名、同描述符的静态方法。

对于接口符号引用，假定该符号引用所指向的接口为 I，则 Java 虚拟机会按照如下步骤进行查找。

1. 在 I 中查找符合名字及描述符的方法。
2. 如果没有找到，在 Object 类中的公有实例方法中搜索。
3. 如果没有找到，则在 I 的超接口中搜索。这一步的搜索结果的要求与非接口符号引用步骤 3 的要求一致。

经过上述的解析步骤之后，符号引用会被解析成实际引用。对于可以静态绑定的方法调用而言，实际引用是一个指向方法的指针。对于需要动态绑定的方法调用而言，实际引用则是一个方法表的索引。

### 虚方法

Java 里所有非私有实例方法调用都会被编译成 invokevirtual 指令，而接口方法调用都会被编译成 invokeinterface 指令。这两种指令，均属于 Java 虚拟机中的虚方法调用。

在绝大多数情况下，Java 虚拟机需要根据调用者的动态类型，来确定虚方法调用的目标方法。这个过程我们称之为动态绑定。那么，相对于静态绑定的非虚方法调用来说，虚方法调用更加耗时。

在 Java 虚拟机中，静态绑定包括用于调用静态方法的 invokestatic 指令，和用于调用构造器、私有实例方法以及超类非私有实例方法的 invokespecial 指令。如果虚方法调用指向一个标记为 final 的方法，那么 Java 虚拟机也可以静态绑定该虚方法调用的目标方法。

Java 虚拟机中采取了一种用空间换取时间的策略来实现动态绑定。它为每个类生成一张方法表，用以快速定位目标方法。

#### 方法表

类加载机制的链接部分中的准备阶段，它除了为静态字段分配内存之外，还会构造与该类相关联的方法表。

这些方法可能是具体的、可执行的方法，也可能是没有相应字节码的抽象方法。方法表满足两个特质：其一，子类方法表中包含父类方法表中的所有方法；其二，子类方法在方法表中的索引值，与它所重写的父类方法的索引值相同。

我们知道，方法调用指令中的符号引用会在执行之前解析成实际引用。对于静态绑定的方法调用而言，实际引用将指向具体的目标方法。对于动态绑定的方法调用而言，实际引用则是方法表的索引值（实际上并不仅是索引值）。

在执行过程中，Java 虚拟机将获取调用者的实际类型，并在该实际类型的虚方法表中，根据索引值获得目标方法。这个过程便是动态绑定。

实际上，使用了方法表的动态绑定与静态绑定相比，仅仅多出几个内存解引用操作：访问栈上的调用者，读取调用者的动态类型，读取该类型的方法表，读取方法表中某个索引值所对应的目标方法。相对于创建并初始化 Java 栈帧来说，这几个内存解引用操作的开销简直可以忽略不计。

上述优化的效果看上去十分美好，但实际上仅存在于解释执行中，或者即时编译代码的最坏情况中。这是因为即时编译还拥有另外两种性能更好的优化手段：内联缓存（inlining cache）和方法内联（method inlining）。下面我便来介绍第一种内联缓存。

# 异常

异常处理的两大组成要素是抛出异常和捕获异常。这两大要素共同实现程序控制流的非正常转移。

抛出异常可分为显式和隐式两种。显式抛异常的主体是应用程序，它指的是在程序中使用“throw”关键字，手动将异常实例抛出。

隐式抛异常的主体则是 Java 虚拟机，它指的是 Java 虚拟机在执行过程中，碰到无法继续执行的异常状态，自动抛出异常。

## 异常分类

在 Java 语言规范中，所有异常都是 Throwable 类或者其子类的实例。Throwable 有两大直接子类。第一个是 Error，涵盖程序不应捕获的异常。当程序触发 Error 时，它的执行状态已经无法恢复，需要中止线程甚至是中止虚拟机。第二子类则是 Exception，涵盖程序可能需要捕获并且处理的异常。

Exception 有一个特殊的子类 RuntimeException，用来表示“程序虽然无法继续执行，但是还能抢救一下”的情况。前边提到的数组索引越界便是其中的一种。

RuntimeException 和 Error 属于 Java 里的非检查异常（unchecked exception）。其他异常则属于检查异常（checked exception）。在 Java 语法中，所有的检查异常都需要程序显式地捕获，或者在方法声明中用 throws 关键字标注。通常情况下，程序中自定义的异常应为检查异常，以便最大化利用 Java 编译器的编译时检查。

![image-20241004164736418](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241004164736418.png)

>异常实例的构造十分昂贵。这是由于在构造异常实例时，Java 虚拟机便需要生成该异常的栈轨迹（stack trace）。该操作会逐一访问当前线程的 Java 栈帧，并且记录下各种调试信息，包括栈帧所指向方法的名字，方法所在的类名、文件名，以及在代码中的第几行触发该异常。

当然，在生成栈轨迹时，Java 虚拟机会忽略掉异常构造器以及填充栈帧的 Java 方法（Throwable.fillInStackTrace），直接从新建异常位置开始算起。此外，Java 虚拟机还会忽略标记为不可见的 Java 方法栈帧。

## 异常表

在编译生成的字节码中，每个方法都附带一个异常表。异常表中的每一个条目代表一个异常处理器，并且由 from 指针、to 指针、target 指针以及所捕获的异常类型构成。这些指针的值是字节码索引（bytecode index，bci），用以定位字节码。

其中，from 指针和 to 指针标示了该异常处理器所监控的范围，例如 try 代码块所覆盖的范围。target 指针则指向异常处理器的起始位置，例如 catch 代码块的起始位置。

当程序触发异常时，Java 虚拟机会从上至下遍历异常表中的所有条目。当触发异常的字节码的索引值在某个异常表条目的监控范围内，Java 虚拟机会判断所抛出的异常和该条目想要捕获的异常是否匹配。如果匹配，Java 虚拟机会将控制流转移至该条目 target 指针指向的字节码。

如果遍历完所有异常表条目，Java 虚拟机仍未匹配到异常处理器，那么它会弹出当前方法对应的 Java 栈帧，并且在调用者（caller）中重复上述操作。在最坏情况下，Java 虚拟机需要遍历当前线程 Java 栈上所有方法的异常表。

finally 代码块的编译比较复杂。当前版本 Java 编译器的做法，是复制 finally 代码块的内容，分别放在 try-catch 代码块所有正常执行路径以及异常执行路径的出口中。

![image-20241004165629600](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241004165629600.png)



针对异常执行路径，Java 编译器会生成一个或多个异常表条目，监控整个 try-catch 代码块，并且捕获所有种类的异常（在 javap 中以 any 指代）。这些异常表条目的 target 指针将指向另一份复制的 finally 代码块。并且，在这个 finally 代码块的最后，Java 编译器会重新抛出所捕获的异常。



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
  Java 反射使用本地方法主要是出于以下几个原因：
>
  1. **性能优化**：
> - 反射涉及频繁的元数据访问和动态类型检查，通过本地方法实现可以减少性能开销，尤其是在处理大量反射调用时。
  2. **底层访问**：
> - 某些反射操作需要直接与系统资源（如文件、网络、硬件等）交互，这通常只能通过本地代码实现，以获得更高的灵活性和效率。
  3. **数据类型转换**：
> - 在 Java 和本地代码之间传递复杂数据结构时，使用本地方法可以简化数据类型的转换过程，特别是在处理数组、字符串和对象时。
  4. **利用已有库**：
   - 许多底层功能和库是用 C/C++ 实现的，通过本地方法，Java 可以直接调用这些库，重用已有的功能。
  5. **安全性**：
   - Java 的安全模型要求对内存和资源的访问进行严格控制。使用本地方法时，JVM 可以对这些调用进行监控和管理，确保安全性。
>
通过使用本地方法，Java 反射能够实现更高的性能、灵活性和安全性，同时有效利用现有的底层资源和库。这种设计使得 Java 能够在提供高层抽象的同时，保留对底层系统的访问能力。

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

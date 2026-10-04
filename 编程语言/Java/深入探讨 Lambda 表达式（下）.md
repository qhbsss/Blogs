---
title: "深入探讨 Lambda 表达式（下）"
source: "https://ata.atatech.org/articles/11000163518?spm=ata.23639746.0.0.3a83eae8aRvknl"
author:
published:
created: 2026-04-10
description:
tags:
  - "clippings"
---
**说明：**

> 由于 Lambda 表达式涉及的周边知识点实在太多，因此拆分为上、下两篇文章讲解。
>
> 本篇为下篇，上篇请点击： [深入探讨 Lambda 表达式（上）](https://www.atatech.org/articles/159525)

目录介绍：
![[61d7f198-516d-419f-95a0-06c4bc05dde1.png]]

在上篇 “ [深入探讨 Lambda 表达式（上）](https://www.atatech.org/articles/159525) ” 中，主要讲述了 1~4 章节，本篇，主要介绍 5~8 章节。

## 5\. 与匿名类的区别

![[Pasted image 20260410143026.png]]
在一定程度上，Lambda 表达式是对匿名内部类的一种替代，避免了冗余丑陋的代码风格，但又不能完全取而代之。

我们知道，Lambda 表达式简化的是符合函数式接口定义的匿名内部类，如果一个接口有多个抽象方法，那这种接口不是函数式接口，也无法使用 Lambda 表达式来替换。

举个示例：

```java
public interface DataOperate {
    public boolean accept(Integer value);

    public Integer convertValue(Integer value);
}

public static List<Integer> process(List<Integer> valueList, DataOperate operate) {
    return valueList.stream()
        .filter(value -> operate.accept(value))
        .map(value -> operate.convertValue(value))
        .collect(Collectors.toList());
}

public static void main(String[] args) {
    List<Integer> valueList = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9);

    // 示例场景1: 将大于3的值翻倍，否则丢弃，得到新数组
    List<Integer> newValueList1 = process(valueList, new DataOperate() {
        @Override
        public boolean accept(Integer value) {
            return value > 3 ? true : false;
        }

        @Override
        public Integer convertValue(Integer value) {
            return value * 2;
        }
    });

    // 示例场景2：将为偶数的值除以2，否则丢弃，得到新数组
    List<Integer> newValueList2 = process(valueList, new DataOperate() {
        @Override
        public boolean accept(Integer value) {
            return value % 2 == 0 ? true : false;
        }

        @Override
        public Integer convertValue(Integer value) {
            return value / 2;
        }
    });
}
```

上面示例中的 `DataOperate` 接口，因存在两个接口，是无法使用 Lambda 表达式的，只能在调用的地方通过匿名内部类来实现。

若 `DataOperate` 接口多种不同的应用场景，要么使用匿名内部类来实现，要么就优雅一些，使用设计模式中的策略模式来封装一下，Lambda 在这里是不适用的。

## 6\. 变量作用域

不少人在使用 Lambda 表达式的尝鲜阶段，可能都遇到过一个错误提示：

Variable used in lambda expression should be final or effectively final

以上报错，就涉及到外部变量在 Labmda 表达式中的作用域，且有以下几个语法规则。

### 6.1 变量作用域的规则

- **规则 1：局部变量不可变，域变量或静态变量是可变的**

何为局部变量？局部变量是指在我们普通的方法内部，且在 Lambda 表达式外部声明的变量。

在 Lambda 表达式内使用局部变量时，该局部变量必须是不可变的。

如下的代码展示中，变量 `a` 就是一个局部变量，因在 Lambda 表达式中调用且改变了值，在编译期就会报错：

```java
public class AClass {
    private Integer num1 = 1;
    private static Integer num2 = 10;

    public void testA() {
        int a = 1;
        int b = 2;
        int c = 3;
        a++;
        new Thread(() -> {
            System.out.println("a=" + a); // 在 Lambda 表达式使用前有改动，编译报错
```

b++; // 在 Lambda 表达式中更改，报错
System.out.println("c=" + c); // 在 Lambda 表达式使用之后有改动，编译报错

System.out.println("num1=" + this.num1++); // 对象变量，或叫域变量，编译通过
AClass.num2 = AClass.num2 + 1;
System.out.println("num2=" + AClass.num2); // 静态变量，编译通过
}).start();
c++;
}
}


上面的代码中，变量 `a` ， `b` ， `c` 都是局部变量，无论在 Lambda 表达式前、表达式中或表达式后修改，都是不允许的，直接编译报错。而对于域变量 `num1` ，以及静态变量 `num2` ，不受此规则限制。

- **规则 2：表达式内的变量名不能与局部变量重名，域变量和静态变量不受限制**

不解释，看代码示例：

```java
public class AClass {
    private Integer num1 = 1;
    private static Integer num2 = 10;

    public void testA() {
        int a = 1;
        new Thread(() -> {
            int a = 3; // 与外部的局部变量重名，编译报错
```

Integer num1 = 232; // 虽与域变量重名，允许，编译通过
Integer num2 = 11; // 虽与静态变量重名，允许，编译通过
}).start();
}
}


友情提醒： 虽然域变量和静态变量可以重名，从可读性的角度考虑，最好也不用重复，养成良好的编码习惯。

- **规则 3：可使用 `this` 、 `super` 关键字，等同于在普通方法中使用**

```java
public class AClass extends ParentClass {
    @Override
    public void printHello() {
        System.out.println("subClass: hello budy!");
    }

    @Override
    public void printName(String name) {
        System.out.println("subClass: name=" + name);
    }

    public void testA() {
        this.printHello();  // 输出：subClass: hello budy!
        super.printName("susu"); // 输出：ParentClass: name=susu

        new Thread(() -> {
            this.printHello();  // 输出：subClass: hello budy!
            super.printName("susu"); // 输出：ParentClass: name=susu
        }).start();

    }
}

class ParentClass {
    public void printHello() {
        System.out.println("ParentClass: hello budy!");
    }

    public void printName(String name) {
        System.out.println("ParentClass: name=" + name);
    }
}
```

**对于 `this` 、 `super` 关键字，大家记住一点就行啦：在 Lambda 表达式中使用，跟在普通方法中使用没有区别！**

- **规则 4：不能使用接口中的默认方法（default 方法）**

```java
public class AClass implements testInterface {
    public void testA() {
        new Thread(() -> {
            String name = super.getName(); // 编译报错：cannot resolve method 'getName()'
        }).start();
    }
}

interface testInterface {
    // 默认方法
    default public String getName() {
        return "susu";
    }
}
```

### 6.2 为何要 final？

不管是 Lambda 表达式，还是匿名内部类，编译器都要求了变量必须是 final 类型的，即使不显式声明，也要确保没有修改。那大家有没有想过，为何编译器要强制设定变量为 final 或 effectively final 呢？

- **原因 1：引入的局部变量是副本，改变不了原本的值**

看以下代码：

```java
public static void main(String args[]) {
    int a = 3;
    String str = "susu";
    Susu123 susu123 = (x) -> System.out.println(x * 2 + str);
    susu123.print(a);
}

interface Susu123 {
    void print(int x);
}
```

在编译器看来，main 方法所在类的方法是如下几个：

```java
public class Java8Tester {
    public Java8Tester(){
    }
    public static void main(java.lang.String[]){
        ...
    }
    private static void lambda$main$0(java.lang.String, int);
        ...
    }
}
```

可以看到，编译后的文件中，多了一个方法 `lambda$m a i n$0(java.lang.String, int)` ，这个方法就对应了 Lambda 表达式。它有两个参数，第一个是 String 类型的参数，对应了引入的 局部变量 `str` ，第二个参数是 int 类型，对应了传入的变量 `a` 。

若在 Lambda 表达式中修改变量 str 的值，依然不会影响到外部的值，这对很多使用者来说，会造成误解，甚至不理解。

既然在表达式内部改变不了，那就索性直接从编译器层面做限制，把有在表达式内部使用到的局部变量强制为 final 的，直接告诉使用者： 这个局部变量在表达式内部不能改动，在外部也不要改啦！

- **原因 2：局部变量存于栈中，多线程中使用有问题**

大家都知道，局部变量是存于 JVM 的栈中的，也就是线程私有的，若 Lambda 表达式中可直接修改这边变量，会不会引起什么问题？

很多小伙伴想到了，如果这个 Lambda 表达式是在另一个线程中执行的，是拿不到局部变量的，因此表达式中拥有的只能是局部变量的副本。
如下的代码：

```java
public static void main(String args[]) {
    int b = 1;
    new Thread(() -> System.out.println(b++));
}
```

假设在 Lambda 表达式中是可以修改局部变量的，那在上面的代码中，就出现矛盾了。变量 `b` 是一个局部变量，是当前线程私有的，而 Lambda 表达式是在另外一个线程中执行的，它又怎么能改变这个局部变量 `b` 的值呢？这是矛盾的。

- **原因 3：线程安全问题**

举一个经常被列举的一个例子：

```java
public void test() {
    boolean flag = true;
    new Thread(() -> {
        while(flag) {
            ...
            flag = false;
        }
    });
    flag = false;
}
```

先假设 Lambda 表达式中的 flag 与外部的有关联。那么在多线程环境中，线程 A、线程 B 都在执行 Lambda 表达式，那么线程之间如何彼此知道 flag 的值呢？且外部的 flag 变量是在主线程的栈（stack）中，其他线程也无法得到其值，因此，这是自相矛盾的。

**小结：**

前面我们列举了多个局部变量必须为 final 或 effectively final 的原因，而 Lambda 表达式并没有对实例变量或静态变量做任何约束。

虽然没做约束，大家也应该明白，允许使用，并不代表就是线程安全的，看下面的例子：

```java
// 实例变量
private int a = 1;

public static void main(String args[]) {
    Java8Tester java8Tester = new Java8Tester();
    java8Tester.test();
    System.out.println(java8Tester.a);

}

public void test() {
    for (int i = 0; i < 10; i++) {
        new Thread(() -> this.a++).start();
    }
}
```

以上的代码，并不是每次执行的结果都是 11，因此也存在线程安全问题。

## 7\. Java 中的闭包

前面已经把 Lmabda 表达式讲的差不多了，是时候该讲一下闭包了。

闭包是函数式编程中的一个概念。在介绍 Java 中的闭包前，我们先看下 JavaScript 语言中的闭包。

```javascript
function func1() {
  var s1 = 32;
    incre = function() {
        s1 + 1;
    };
    return function func2(y) {
        return s1 + y;
    };
}

tmp = func1();
console.log(tmp(1)); // 33

incre();
console.log(tmp(1)); // 34
```

上面的 JavaScript 示例代码中，函数 `func2(y)` 就是一个闭包，特征如下：

- 第一点，它本身是一个函数，且是一个在其他函数内部定义的函数；
- 第二点，它还携带了它作用域外的变量 `s1` ，即 **外部变量** 。

正常来说，语句 `tmp = func1();` 在执行完之后， `func1()` 函数的声明周期就结束啦，并且变量 `s1` 还使用了 `var` 修饰符，即它是一个方法内的局部变量，是存在于方法栈中的，在该语句执行完后，是要随 `func1()` 函数一起被回收的。

但在执行第二条语句 `console.log(tmp(1));` 时，它竟然没有报错，还仍然保有变量 `s1` 的值！

继续往下看。

在执行完第三条语句 `incre();` 后，再次执行语句 `console.log(tmp(1));`，会发现输出值是 34。这说明在整个执行的过程中，函数 `func2(y)` 是持有了变量 `s1` 的引用，而不单纯是数值 32！

通过以上的代码示例，我们可以用依据通俗的话来总结闭包：

> 闭包是由函数和其外部的引用环境组成的一个实体，并且这个外部引用必须是在堆上的（在栈中就直接回收掉了，无法共享）。

在上面的 JavaScript 示例中，变量 `s1` 就是外部引用环境，而且是 **capture by Reference** 。

说完 JavaScript 中的闭包，我们再来看下 Java 中的闭包是什么样子的。Java 中的内部类就是一个很好的阐述闭包概念的例子。

```java
public class OuterClass {
    private String name = "susu";

    private class InnerClass {
        private String firstName = "Shan";

        public String getFullName() {
            return new StringBuilder(firstName).append(" ").append(name).toString();
        }

        public OuterClass getOuterObj() {
            // 通过 外部类.this 得到对外部环境的引用
            return OuterClass.this;
        }
    }

    public static void main(String[] args) {
        OuterClass outerClass = new OuterClass();
        InnerClass innerClass = outerClass.new InnerClass();
        System.out.println(innerClass.getFullName());

        outerClass.name = "susu1";
        System.out.println(innerClass.getFullName());

        System.out.println(Objects.equals(outerClass, innerClass.getOuterObj()));
    }
}
```

#### 输出 ####
Shan susu
Shan susu1
true

上面的例子中，函数 `getFullName()` 就是一个闭包函数，其持有一个外部引用的变量 `name` ，从输出结果可以看到，引用的外部变量变化，输出值也会跟随变化的，也是 **capture by reference** 。

内部类可以通过 `外部类.this` 来得到对外部环境的引用，上面示例的输出结果为 true 说明了这点。在内部类的 `getFullName()` 方法中，可直接引用外部变量 `name` ，其实也是通过内部类持有的外部引用来调用的，比如，该方法也可以写成如下形式：

```java
public String getFullName() {
    return new StringBuilder(firstName).append(" ").append(OutClass.this.name).toString();
}
```

`OutClass.this` 就是内部类持有的外部引用。

内部类可以有多种形式，比如匿名内部类，局部内部类，成员内部类（上面的示例中 `InnerClass` 类就是），静态内部类（可用于实现单例模式），这里不再一一列举。

对于 Lambda 表达式，在一定条件下可替换匿名内部类，但都是要求引入的外部变量必须是 final 的，前面也解释了为何变量必须是 final 的。

宽泛理解，Lambda 表达式也是一种闭包，也是在函数内部引入了外部环境的变量，但不同于 JavaScript 语言中的闭包，函数内一直持有外部变量，即使对应的外部函数已经销毁，外部变量依然可以存在并可以修改，Java 中 Lambda 表达式中对外部变量的持有，是一种值拷贝，Lambda 表达式内并不持有外部变量的引用，实际上是一种 **capture by value** ，所以 Java 中的 Lambda 表达式所呈现的闭包是一种伪闭包。

## 8\. Consumer、Supplier 等函数式接口

说实话，在第一次看到这类函数式接口的定时时，我是一脸懵逼的，这类接口有什么用？看不懂有什么含义，这类接口定义的莫名其妙。

就像 Consumer 接口的定义：

@FunctionalInterface
```java
public interface Consumer<T> {
    /**
     * Performs this operation on the given argument.
     * @param t the input argument
     */
    void accept(T t);

    default Consumer<T> andThen(Consumer<? super T> after) {
        Objects.requireNonNull(after);
        return (T t) -> { accept(t); after.accept(t); };
    }
}
```

单看 `accept(T t)` 抽象方法，需传入一个入参，没有返回值。这个方法做了啥？有什么语义上的功能吗？木有！

众所周知，Java 是一门面向对象的语言，一切皆对象。我们自定义的类（比如： `HashMap` 、 `ArrayList` ）或方法（如： `getName()` 、 `execute()` ），都是有一定的语义（semantic）信息的，是暗含了它的使用范围和场景的，通俗点说，我们明显的可以知道它们可以干啥。

但回过头看 `accept(T t)` 这个抽象方法，你却不知道它是干啥的。其实，对于函数式接口中的抽象方法，它们是从另外一个维度去定义的，即结构化（structure）的定义。它们就是一种结构化意义的存在，本身就不能从语义角度去理解。

这里介绍几种常见的函数式接口的用法。

- **Consumer 接口：消费型函数式接口**

从其抽象方法 `void accept(T t)` 来理解，就是一个参数传入了进去，整个方法的具体实现都与当前这个参数有关联。这与列表元素的循环获取很像，比如集合类的 `Foreach()` 方法：

```java
default void forEach(Consumer<? super T> action) {
    Objects.requireNonNull(action);
    for (T t : this) {
        action.accept(t);
    }
}
```

再举一个例子。在日常开发中，可能会遇到连接，如数据库的连接，网络的连接等，假设有这么一个连接类：

```java
public class Connection {

    public Connection() {
    }

    public void operate() {
        System.out.println("do something.");
    }

    public void close() {

    }
```

每次使用时，都需要创建连接、使用连接和关闭连接三个步骤，比如：

```java
public void executeTask() {
    Connection conn = new Connection();
    try {
        conn.operate();
    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        conn.close();
    }
}
```

当有多处代码都需要用到此类用法时，就需要在多处去创建连接、使用和关闭连接等操作。

这样有没有什么问题呢？万一某处代码忘记关闭其创建的连接对象，就可能会导致内存泄漏！

有没有比较好的方式呢？

可以将这部分常用代码做抽象，且不允许外部随意创建连接对象，只能自己创建自己的对象，如下：

```java
public class Connection {

    private Connection() {

    }

    public void operate() {
        System.out.println("do something.");
    }

    public void close() {

    }

    public static void useConnection(Consumer<Connection> consumer) {
        Connection conn = new Connection();
        try {
            consumer.accept(conn);
        } catch (Exception e) {
        } finally {
            conn.close();
        }
    }
}
```

注意，上面的构造函数是私有的，从而避免了由外部创建 `Connection` 对象，同时在其内部提供了一个静态方法 `useConnection()` ，入参就是一个 `Consumer` 对象。当我们外部想使用时，使用如下调用语句即可：

Connection.useConnection(conn -> conn.operate());

- **Supplier 接口：供给型函数式接口**

接口定义如下：

```java
public interface Supplier<T> {
    /**
     */
    T get();
}
```

抽象方法 `T get()` 没有入参，返回一个对象，和前面的 `Consumer` 接口的 `void accept(T t)` 抽象方法正好相反。

看下基本用法：

```java
// 示例 1
Supplier<Integer> supplier1 = () -> Integer.valueOf(32);
System.out.println(supplier1.get());  // 32

// 示例 2
Supplier<Runnable> supplier2 = () -> () -> System.out.println("abc");
supplier2.get().run(); // abc
```

第 2 个示例，你有没有看糊涂？其等价代码如下：

```java
Supplier<Runnable> supplier2 = () -> {
    Runnable runnable = () -> System.out.println("abc");
    return runnable;
};
supplier2.get().run();
```

像 Predicate、BiConsumer 等其他函数式接口，这里不再一一列举，感兴趣的小伙伴可自行查阅学习。

## 小结

关于 Lambda 表达式的知识点，上篇文章 [深入探讨 Lambda 表达式（上）](https://www.atatech.org/articles/159525?spm=ata.21736010.0.0.76c27536daqCaZ) 和本篇就已经全部介绍完毕。各位小伙伴，你都掌握了吗？

# Java引用

## 引用类型

不同的引用类型，主要体现的是对象不同的可达性（reachable）状态和对垃圾收集的影响。

1. 强引用（"Strong" Reference），就是我们最常见的普通对象引用，只要还有强引用指向一个对象，就能表明对象还“活着”，垃圾收集器不会碰这种对象。对于一个普通的对象，如果没有其他的引用关系，只要超过了引用的作用域或者显式地将相应（强）引用赋值为null，就是可以被垃圾收集的了，当然具体回收时机还是要看垃圾收集策略。
2. 软引用（SoftReference），是一种相对强引用弱化一些的引用，可以让对象豁免一些垃圾收集，只有当JVM认为内存不足时，才会去试图回收软引用指向的对象。JVM会确保在抛出OutOfMemoryError之前，清理软引用指向的对象。软引用通常用来实现内存敏感的缓存，如果还有空闲内存，就可以暂时保留缓存，当内存不足时清理掉，这样就保证了使用缓存的同时，不会耗尽内存。
3. 弱引用（WeakReference）并不能使对象豁免垃圾收集，仅仅是提供一种访问在弱引用状态下对象的途径。这就可以用来构建一种没有特定约束的关系，比如，维护一种非强制性的映射关系，如果试图获取时对象还在，就使用它，否则重现实例化。它同样是很多缓存实现的选择。
   对于幻象引用，有时候也翻译成虚引用，你不能通过它访问对象。
4. 幻象引用仅仅是提供了一种确保对象被fnalize以后，做某些事情的机制，比如，通常用来做所谓的Post-Mortem清理机制，我在专栏上一讲中介绍的Java平台自身Cleaner机制等，也有人利用幻象引用监控对象的创建和销毁。

## 对象可达性状态流转分析

下面流程图简单总结了对象生命周期和不同可达性状态，以及不同状态可能的改变关系，来阐述下可达性的变化。

![image-20241012111548183](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241012111548183.png)

Java定义的不同可达性级别（reachability level），具体如下：

1. 强可达（Strongly Reachable），就是当一个对象可以有一个或多个线程可以不通过各种引用访问到的情况。比如，我们新创建一个对象，那么创建它的线程对它就是强可达。
2. 软可达（Softly Reachable），就是当我们只能通过软引用才能访问到对象的状态。
3. 弱可达（Weakly Reachable），类似前面提到的，就是无法通过强引用或者软引用访问，只能通过弱引用访问时的状态。这是十分临近fnalize状态的时机，当弱引用被清除的时候，就符合fnalize的条件了。
4. 幻象可达（Phantom Reachable），上面流程图已经很直观了，就是没有强、软、弱引用关联，并且fnalize过了，只有幻象引用指向这个对象的时候。
5. 当然，还有一个最后的状态，就是不可达（unreachable），意味着对象可以被清除了。

判断对象可达性，是JVM垃圾收集器决定如何处理对象的一部分考虑。
所有引用类型，都是抽象类java.lang.ref.Reference的子类，它提供了get()方法：

![image-20241012111758441](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241012111758441.png)

除了幻象引用（因为get永远返回null），如果对象还没有被销毁，都可以通过get方法获取原有对象。这意味着，利用软引用和弱引用，我们可以将访问到的对象，重新指向强引用，也就是人为的改变了对象的可达性状态！这也是为什么我在上面图里有些地方画了双向箭头。

## 引用队列

在创建各种引用并关联到响应对象时，可以选择是否需要关联引用队列，JVM会在特定时机将引用enqueue到队列里，从队列里获取引用（remove方法在这里实际是有获取的意思）进行相关后续逻辑。尤其是幻象引用，get方法只返回null，如果再不指定引用队列，基本就没有意义了。

引用队列 ReferenceQueue 是用来配合引用工作的，没有 ReferenceQueue 一样可以运行。创建引用的时候可以指定关联的队列，**当GC释放对象内存的时候，会将引用加入到引用队列的队列末尾，这相当于是一种通知机制**。当关联的引用队列中有数据的时候，意味着引用指向的堆内存中的对象被回收。通过这种方式，JVM允许我们在对象被销毁后，做一些我们自己想做的事情。JVM提供了一个ReferenceHandler线程，将引用加入到注册的引用队列中。

### eg:

```java
Object counter = new Object();//Object counter: 创建了一个新的对象 counter。
ReferenceQueue refQueue = new ReferenceQueue<>();//ReferenceQueue<Object> refQueue: 创建了一个 ReferenceQueue，这是用来存储当对象的引用变为不可达时会加入的引用。
PhantomReference<Object> p = new PhantomReference<>(counter, refQueue);//PhantomReference<Object> p: 创建了一个虚引用 p，指向 counter 对象。虚引用和 ReferenceQueue 结合使用时，当 counter 对象即将被垃圾回收时，它会被放入 refQueue 中。
counter = null;//将 counter 设置为 null，即删除对该对象的强引用。这使得 counter 对象在下一次垃圾回收时变得不可达，也就意味着它有资格被垃圾回收。
Sysem.gc();//调用了 System.gc()，这是一种请求垃圾回收器进行回收的方式（注意这只是一个建议，垃圾回收器未必会立即执行）。
try {
// Remove是一个阻塞方法，可以指定timeout，或者选择一直阻塞
Reference<Object> ref = refQueue.remove(1000L);
if (ref != null) {
// do something
}
} catch (InterruptedException e) {
// Handle it
}
```

## ThreadLocal中的弱引用问题

### eg:

发生gc后，key为null，value不为null。

```java
public class ThreadLocalDemo {

    public static void main(String[] args) throws NoSuchFieldException, IllegalAccessException, InterruptedException {
        Thread t = new Thread(()->test("abc",false));
        t.start();
        t.join();
        System.out.println("--gc后--");
        Thread t2 = new Thread(() -> test("def", true));
        t2.start();
        t2.join();
    }

    private static void test(String s,boolean isGC)  {
        try {
            new ThreadLocal<>().set(s);
            if (isGC) {
                System.gc();
            }
            Thread t = Thread.currentThread();
            Class<? extends Thread> clz = t.getClass();
            Field field = clz.getDeclaredField("threadLocals");
            field.setAccessible(true);
            Object ThreadLocalMap = field.get(t);
            Class<?> tlmClass = ThreadLocalMap.getClass();
            Field tableField = tlmClass.getDeclaredField("table");
            tableField.setAccessible(true);
            Object[] arr = (Object[]) tableField.get(ThreadLocalMap);
            for (Object o : arr) {
                if (o != null) {
                    Class<?> entryClass = o.getClass();
                    Field valueField = entryClass.getDeclaredField("value");
                    Field referenceField = entryClass.getSuperclass().getSuperclass().getDeclaredField("referent");
                    valueField.setAccessible(true);
                    referenceField.setAccessible(true);
                    System.out.println(String.format("弱引用key:%s,值:%s", referenceField.get(o), valueField.get(o)));
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

```ba
弱引用key:java.lang.ThreadLocal@433619b6,值:abc
弱引用key:java.lang.ThreadLocal@418a15e3,值:java.lang.ref.SoftReference@bf97a12
--gc后--
弱引用key:null,值:def
```

#### 原因：

ThreadLocal#set后会将threadLocal实例本身作为key 放入 Thread.currentThread().threadLocalMap中，与threadlocal#set的value构成一对Entry。而Entry使用了threadLocal的实例作为 弱引用。因此当发生gc的时候，弱引用的key会被回收掉，而作为强引用的value还存在。
>**作为key的弱引用的ThreadLocal**
>
>![在这里插入图片描述](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturese25922c8c4b99d2f343cf1ef54e5787b.png)
>
>![在这里插入图片描述](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures46dd0a1fee2ad11efb58035751ac5bfc.png)

### eg:

如果没有失去对ThreadLocal本身的强引用，那么不会回收threadLocal。（注释中有标注helpGC的地方)
而我们平时代码中，常常使用static final修饰threadLocal保留一个全局的threadLocal方便传递其他value（threadLocal一直被强引用），作为key的threadLocal就不会被回收，更不会导致key为null。
![在这里插入图片描述](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures810938d4ef110323022da92c7fbf4589.png)
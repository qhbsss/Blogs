[TOC]



# ThreadLocal应用场景

>项目中使用了ThreadLocal保存用户权限信息来进行鉴权，为什么要用ThreadLocal来存储，用一个变量不也可以吗？

1. 每个线程内需要保存全局变量，可以让不同方法直接使用，避免参数传递的麻烦
比如说当前用户的权限信息需要被线程内所有方法共享，一个比较繁琐的解决方案是把user作为参数层层传递，从service-1()传到service-2(),以此类推，但是这样做会导致代码冗余且不易维护。
在线程生命周期内，都通过这个静态ThreadLocal实例的get()方法取得自己set过的那个对象，避免了将这个对象作为参数传递的麻烦。
2. 避免多线程竞争
如果使用一个静态变量保存信息，当有另外的线程运行时，可能会修改该静态变量的值，造成多线程竞争问题，可以用静态变量Map来存储不同用户对应的权限信息，但如果不同用户的不同线程访问该Map时，如果是HashMap，它并不是线程安全的，可能会发生多线程竞争导致HashMap被污染问题，需要使用synchronized或者线程安全的concurrenthashmap，这是一种解决方案，但也可以使用ThreadLocal来实现，它是通过创建每个线程的变量副本来保证线程安全的，这样不会像上一种方案发生线程获取锁时的阻塞情况。

## HashMap的线程不安全问题
JDK1.7 及之前版本，在多线程环境下，`HashMap` 扩容时会造成死循环和数据丢失的问题。

数据丢失这个在 JDK1.7 和 JDK 1.8 中都存在，这里以 JDK 1.8 为例进行介绍。

JDK 1.8 后，在 `HashMap` 中，多个键值对可能会被分配到同一个桶（bucket），并以链表或红黑树的形式存储。多个线程对 `HashMap` 的 `put` 操作会导致线程不安全，具体来说会有数据覆盖的风险。

举个例子：

- 两个线程 1,2 同时进行 put 操作，并且发生了哈希冲突（hash 函数计算出的插入下标是相同的）。
- 不同的线程可能在不同的时间片获得 CPU 执行的机会，当前线程 1 执行完哈希冲突判断后，由于时间片耗尽挂起。线程 2 先完成了插入操作。
- 随后，线程 1 获得时间片，由于之前已经进行过 hash 碰撞的判断，所有此时会直接进行插入，这就导致线程 2 插入的数据被线程 1 覆盖了。

```java
public V put(K key, V value) {
    return putVal(hash(key), key, value, false, true);
}

final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
                   boolean evict) {
    // ...
    // 判断是否出现 hash 碰撞
    // (n - 1) & hash 确定元素存放在哪个桶中，桶为空，新生成结点放入桶中(此时，这个结点是放在数组中)
    if ((p = tab[i = (n - 1) & hash]) == null)
        tab[i] = newNode(hash, key, value, null);
    // 桶中已经存在元素（处理hash冲突）
    else {
    // ...
}
```

还有一种情况是这两个线程同时 `put` 操作导致 `size` 的值不正确，进而导致数据覆盖的问题：

1. 线程 1 执行 `if(++size > threshold)` 判断时，假设获得 `size` 的值为 10，由于时间片耗尽挂起。
2. 线程 2 也执行 `if(++size > threshold)` 判断，获得 `size` 的值也为 10，并将元素插入到该桶位中，并将 `size` 的值更新为 11。
3. 随后，线程 1 获得时间片，它也将元素放入桶位中，并将 size 的值更新为 11。
4. 线程 1、2 都执行了一次 `put` 操作，但是 `size` 的值只增加了 1，也就导致实际上只有一个元素被添加到了 `HashMap` 中。

```java
public V put(K key, V value) {
    return putVal(hash(key), key, value, false, true);
}

final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
                   boolean evict) {
    // ...
    // 实际大小大于阈值则扩容
    if (++size > threshold)
        resize();
    // 插入后回调
    afterNodeInsertion(evict);
    return null;
}
```
# ThreadLocal实现原理
从 `Thread`类源代码入手。

```java
public class Thread implements Runnable {
    //......
    //与此线程有关的ThreadLocal值。由ThreadLocal类维护
    ThreadLocal.ThreadLocalMap threadLocals = null;

    //与此线程有关的InheritableThreadLocal值。由InheritableThreadLocal类维护
    ThreadLocal.ThreadLocalMap inheritableThreadLocals = null;
    //......
}
```

从上面`Thread`类 源代码可以看出`Thread` 类中有一个 `threadLocals` 和 一个 `inheritableThreadLocals` 变量，它们都是 `ThreadLocalMap` 类型的变量,我们可以把 `ThreadLocalMap` 理解为`ThreadLocal` 类实现的定制化的 `HashMap`。默认情况下这两个变量都是 null，只有当前线程调用 `ThreadLocal` 类的 `set`或`get`方法时才创建它们，实际上调用这两个方法的时候，我们调用的是`ThreadLocalMap`类对应的 `get()`、`set()`方法。

`ThreadLocal`类的`set()`方法

```java
public void set(T value) {
    //获取当前请求的线程
    Thread t = Thread.currentThread();
    //取出 Thread 类内部的 threadLocals 变量(哈希表结构)
    ThreadLocalMap map = getMap(t);
    if (map != null)
        // 将需要存储的值放入到这个哈希表中
        map.set(this, value);
    else
        createMap(t, value);
}
ThreadLocalMap getMap(Thread t) {
    return t.threadLocals;
}
```

通过上面这些内容，我们足以通过猜测得出结论：**最终的变量是放在了当前线程的 `ThreadLocalMap` 中，并不是存在 `ThreadLocal` 上，`ThreadLocal` 可以理解为只是`ThreadLocalMap`的封装，传递了变量值。** `ThrealLocal` 类中可以通过`Thread.currentThread()`获取到当前线程对象后，直接通过`getMap(Thread t)`可以访问到该线程的`ThreadLocalMap`对象。

**每个`Thread`中都具备一个`ThreadLocalMap`，而`ThreadLocalMap`可以存储以`ThreadLocal`为 key ，Object 对象为 value 的键值对。**

```java
ThreadLocalMap(ThreadLocal<?> firstKey, Object firstValue) {
    //......
}
```

比如我们在同一个线程中声明了两个 `ThreadLocal` 对象的话， `Thread`内部都是使用仅有的那个`ThreadLocalMap` 存放数据的，`ThreadLocalMap`的 key 就是 `ThreadLocal`对象，value 就是 `ThreadLocal` 对象调用`set`方法设置的值。

`ThreadLocal` 数据结构如下图所示：

![ThreadLocal 数据结构](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/threadlocal-data-structure.png)

`ThreadLocalMap`是`ThreadLocal`的静态内部类。

![ThreadLocal内部类](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/thread-local-inner-class.png)



# TheadLocal与线程复用

## 场景

项目中用ThreadLocal来记录用户登录信息，但是Tomcat或者Jetty容器都是线程复用的，如何防止被其他线程修改数据。

## 解决方案

在拦截器中每次主动调用remove方法清除线程中的历史数据

# ThreadLocal如何在线程间传递

## 场景

项目中的登录方法中如果后续调用了其他线程，如何传递ThreadLocal中的数据

## 解决方案

我们使用`ThreadLocal`的时候，在异步场景下是无法给子线程共享父线程中创建的线程副本数据的。

为了解决这个问题，JDK 中还有一个`InheritableThreadLocal`类，我们来看一个例子：

```
public class InheritableThreadLocalDemo {
    public static void main(String[] args) {
        ThreadLocal<String> ThreadLocal = new ThreadLocal<>();
        ThreadLocal<String> inheritableThreadLocal = new InheritableThreadLocal<>();
        ThreadLocal.set("父类数据:threadLocal");
        inheritableThreadLocal.set("父类数据:inheritableThreadLocal");

        new Thread(new Runnable() {
            @Override
            public void run() {
                System.out.println("子线程获取父类ThreadLocal数据：" + ThreadLocal.get());
                System.out.println("子线程获取父类inheritableThreadLocal数据：" + inheritableThreadLocal.get());
            }
        }).start();
    }
}
```

```
子线程获取父类ThreadLocal数据：null
子线程获取父类inheritableThreadLocal数据：父类数据:inheritableThreadLocal
```

实现原理是子线程是通过在父线程中通过调用`new Thread()`方法来创建子线程，`Thread#init`方法在`Thread`的构造方法中被调用。在`init`方法中拷贝父线程数据到子线程中：

```
private void init(ThreadGroup g, Runnable target, String name,
                      long stackSize, AccessControlContext acc,
                      boolean inheritThreadLocals) {
    if (name == null) {
        throw new NullPointerException("name cannot be null");
    }

    if (inheritThreadLocals && parent.inheritableThreadLocals != null)
        this.inheritableThreadLocals =
            ThreadLocal.createInheritedMap(parent.inheritableThreadLocals);
    this.stackSize = stackSize;
    tid = nextThreadID();
}
```

## 场景

如果是调用线程池，线程池是复用的逻辑，如何传递ThreadLocal数据

## 解决方案

`InheritableThreadLocal`仍然有缺陷，一般我们做异步化处理都是使用的线程池，而`InheritableThreadLocal`是在`new Thread`中的`init()`方法给赋值的，而线程池是线程复用的逻辑，所以这里会存在问题。

阿里巴巴开源了一个`TransmittableThreadLocal`组件就可以解决这个问题

### TTL原理

#### 使用方法

1. 增强Runnable或Callable

	1. 使用TtlRunnable.get()或TtlCallable.get()
	2. 提交线程池之后，在run()内取出变量

2. 增强线程池

	1. 使用TtlExecutors.getTtlExecutor()或getTtlExecutorService()、getTtlScheduledExecutorService()获取装饰后的线程池
	2. 使用线程池提交普通任务
	
	3. 在run()方法内取出变量（任务子线程）

装饰线程池其实本质也是装饰Runnable，只是将这个逻辑移到了ExecutorServiceTtlWrapper.submit()方法内，对所有提交的Runnable都进行包装：
	  ![image-20200807095719400](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures0a533342fcb84b208eca23d3ef83943b.png)

#### 原理

![9A0033F8-DCD4-4054-8E83-55511D5E52CC](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures46895fede25a5bdebf4df3d1bbf13da2.png)

根据TransmittableThreadLocal的使用流程，其核心逻辑可以分成三个部分：设置线程变量 -> 构建TtlRunnable -> 提交线程池运行

##### 1.设置线程变量

当调用`TransmittableThreadLocal.set()`设置变量值时，除了会通过调用`super.set()`（ThreadLocal）设置当前线程变量外，还会执行`addThisToHolder()`方法：

![image-20200807103557739](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures4447be3ac342cafa949dc094d2212478.png)

- TransmittableThreadLocal内部维护了一个静态的线程变量holder，保存的是以TransmittableThreadLocal对象为Key的Map（这个map的值永远是null，也就是当做Set使用的）holder保存了当前线程下的所有TTL线程变量

- 设值时向获取holder传入this，保存发起set()操作的TransmittableThreadLocal对象
  

##### 2. 构建TtlRunnable对象
   构建TtlRunnable对象时，会保存原Runnable对象引用，用于后续run()方法中业务代码的执行。另外还会调TransmittableThreadLocal.Transmitter.capture()方法，缓存当前主线程的线程变量：

![image-20200807111215487](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesa5036538b6fc315c3058be1b5e0aa054.png)

- 这里实际上就是对第一步在holder中保存的ThreadLocal对象进行遍历，保存其变量值
- 此时原本通过ThreadLocal保存的和Thread绑定的线程变量，就复制了一份到TtlRunnable对象中了

##### 3.在子线程中读取变量

当TtlRunnable对象被提交到线程池执行时，调用`TtlRunnable.run()`：

> 注意此时已处于任务子线程环境中

![BC10853C-DF6B-45B5-9AEB-B90081D1EF6D](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures9a96eaaaae6ad2f3fff2a8d440e5c3d9.png)

这里会从Runnable对象取出缓存的线程变量captured，然后进行后续流程：

#### (1)前序处理

`TransmittableThreadLocal.Transmitter.replay()`：

![在这里插入图片描述](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures47097b9ee6771b30137699a37b5c9a72.png)

- 将缓存的父线程变量值设置到当前任务线程（子线程）的ThreadLocal内，并将父线程的线程变量备份

#### (2)执行run()方法，读取变量值

由于上一步已经将从父线程复制的线程变量都设置到当前子线程的ThreadLocal中，因此run()方法中直接通过ThreadLocal.get()即可读取继承自父线程的变量值。

#### (3)后续处理

`TransmittableThreadLocal.Transmitter.restore()`：

![348D0F21-632E-48A2-B9F2-DC9AE10F2EF3](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures8b9e81e5a303d8a3e0cc761ba8687a77.png)

- 将run()执行前获取的备份，设置到当前线程中去，恢复run()执行过程中可能导致的变化，避免对后续复用此线程的任务产生影响



从使用上来看，不管是修饰Runnable还是修饰线程池，本质都是将Runnable增强为TtlRunnable。

而从实现线程变量传递的原理上来看，TTL做的实际上就是将原本与Thread绑定的线程变量，缓存一份到TtlRunnable对象中，在执行子线程任务前，将对象中缓存的变量值设置到子线程的ThreadLocal中以供run()方法的代码使用，然后执行完后，又恢复现场，保证不会对复用线程产生影响。


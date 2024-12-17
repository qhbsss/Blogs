[TOC]



# 线程池

线程池就是管理一系列线程的资源池，其提供了一种限制和管理线程资源的方式。每个线程池还维护一些基本统计信息，例如已完成任务的数量。

**线程池一般用于执行多个不相关联的耗时任务，没有多线程的情况下，任务顺序执行，使用了线程池的话可让多个不相关联的任务同时执行。**

## Executor框架

`Executor` 框架是 Java5 之后引进的，在 Java 5 之后，通过 `Executor` 来启动线程比使用 `Thread` 的 `start` 方法更好，除了更易管理，效率更好（用线程池实现，节约开销）外，还有关键的一点：有助于避免 this 逃逸问题。

> this 逃逸是指在构造函数返回之前其他线程就持有该对象的引用，调用尚未构造完全的对象的方法可能引发令人疑惑的错误。

`Executor` 框架不仅包括了线程池的管理，还提供了线程工厂、队列以及拒绝策略等，`Executor` 框架让并发编程变得更加简单。

`Executor` 框架结构主要由三大部分组成：

**1、任务(`Runnable` /`Callable`)**

执行任务需要实现的 **`Runnable` 接口** 或 **`Callable`接口**。**`Runnable` 接口**或 **`Callable` 接口** 实现类都可以被 **`ThreadPoolExecutor`** 或 **`ScheduledThreadPoolExecutor`** 执行。

**2、任务的执行(`Executor`)**

如下图所示，包括任务执行机制的核心接口 **`Executor`** ，以及继承自 `Executor` 接口的 **`ExecutorService` 接口。`ThreadPoolExecutor`** 和 **`ScheduledThreadPoolExecutor`** 这两个关键类实现了 **`ExecutorService`** 接口。

![](https://oss.javaguide.cn/github/javaguide/java/concurrent/executor-class-diagram.png)

这里提了很多底层的类关系，但是，实际上我们需要更多关注的是 `ThreadPoolExecutor` 这个类，这个类在我们实际使用线程池的过程中，使用频率还是非常高的。

**注意：** 通过查看 `ScheduledThreadPoolExecutor` 源代码我们发现 `ScheduledThreadPoolExecutor` 实际上是继承了 `ThreadPoolExecutor` 并实现了 `ScheduledExecutorService` ，而 `ScheduledExecutorService` 又实现了 `ExecutorService`，正如我们上面给出的类关系图显示的一样。

`ThreadPoolExecutor` 类描述:

```java
//AbstractExecutorService实现了ExecutorService接口
public class ThreadPoolExecutor extends AbstractExecutorService
```

`ScheduledThreadPoolExecutor` 类描述:

```java
//ScheduledExecutorService继承ExecutorService接口
public class ScheduledThreadPoolExecutor
        extends ThreadPoolExecutor
        implements ScheduledExecutorService
```

**3、异步计算的结果(`Future`)**

**`Future`** 接口以及 `Future` 接口的实现类 **`FutureTask`** 类都可以代表异步计算的结果。

当我们把 **`Runnable`接口** 或 **`Callable` 接口** 的实现类提交给 **`ThreadPoolExecutor`** 或 **`ScheduledThreadPoolExecutor`** 执行。（调用 `submit()` 方法时会返回一个 **`FutureTask`** 对象）

**`Executor` 框架的使用示意图**：

![Executor 框架的使用示意图](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_PicturesExecutor%E6%A1%86%E6%9E%B6%E7%9A%84%E4%BD%BF%E7%94%A8%E7%A4%BA%E6%84%8F%E5%9B%BE-8GKgMC9g.png)

1. 主线程首先要创建实现 `Runnable` 或者 `Callable` 接口的任务对象。
2. 把创建完成的实现 `Runnable`/`Callable`接口的 对象直接交给 `ExecutorService` 执行: `ExecutorService.execute（Runnable command）`）或者也可以把 `Runnable` 对象或`Callable` 对象提交给 `ExecutorService` 执行（`ExecutorService.submit（Runnable task）`或 `ExecutorService.submit（Callable <T> task）`）。
3. 如果执行 `ExecutorService.submit（…）`，`ExecutorService` 将返回一个实现`Future`接口的对象（我们刚刚也提到过了执行 `execute()`方法和 `submit()`方法的区别，`submit()`会返回一个 `FutureTask 对象）。由于 FutureTask` 实现了 `Runnable`，我们也可以创建 `FutureTask`，然后直接交给 `ExecutorService` 执行。
4. 最后，主线程可以执行 `FutureTask.get()`方法来等待任务执行完成。主线程也可以执行 `FutureTask.cancel（boolean mayInterruptIfRunning）`来取消此任务的执行。

## ThreadPoolExecutor 类介绍

线程池实现类 `ThreadPoolExecutor` 是 `Executor` 框架最核心的类。

### 线程池参数分析

`ThreadPoolExecutor` 类中提供的四个构造方法。我们来看最长的那个，其余三个都是在这个构造方法的基础上产生（其他几个构造方法说白点都是给定某些默认参数的构造方法比如默认制定拒绝策略是什么）。

```java
    /**
     * 用给定的初始参数创建一个新的ThreadPoolExecutor。
     */
    public ThreadPoolExecutor(int corePoolSize,//线程池的核心线程数量
                              int maximumPoolSize,//线程池的最大线程数
                              long keepAliveTime,//当线程数大于核心线程数时，多余的空闲线程存活的最长时间
                              TimeUnit unit,//时间单位
                              BlockingQueue<Runnable> workQueue,//任务队列，用来储存等待执行任务的队列
                              ThreadFactory threadFactory,//线程工厂，用来创建线程，一般默认即可
                              RejectedExecutionHandler handler//拒绝策略，当提交的任务过多而不能及时处理时，我们可以定制策略来处理任务
                               ) {
        if (corePoolSize < 0 ||
            maximumPoolSize <= 0 ||
            maximumPoolSize < corePoolSize ||
            keepAliveTime < 0)
            throw new IllegalArgumentException();
        if (workQueue == null || threadFactory == null || handler == null)
            throw new NullPointerException();
        this.corePoolSize = corePoolSize;
        this.maximumPoolSize = maximumPoolSize;
        this.workQueue = workQueue;
        this.keepAliveTime = unit.toNanos(keepAliveTime);
        this.threadFactory = threadFactory;
        this.handler = handler;
    }
```

下面这些参数非常重要，在后面使用线程池的过程中你一定会用到！所以，务必拿着小本本记清楚。

`ThreadPoolExecutor` 3 个最重要的参数：

- `corePoolSize` : 任务队列未达到队列容量时，最大可以同时运行的线程数量。
- `maximumPoolSize` : 任务队列中存放的任务达到队列容量的时候，当前可以同时运行的线程数量变为最大线程数。
- `workQueue`: 新任务来的时候会先判断当前运行的线程数量是否达到核心线程数，如果达到的话，新任务就会被存放在队列中。

`ThreadPoolExecutor`其他常见参数 :

- `keepAliveTime`:线程池中的线程数量大于 `corePoolSize` 的时候，如果这时没有新的任务提交，核心线程外的线程不会立即销毁，而是会等待，直到等待的时间超过了 `keepAliveTime`才会被回收销毁。
- `unit` : `keepAliveTime` 参数的时间单位。
- `threadFactory` :executor 创建新线程的时候会用到。
- `handler` :拒绝策略（后面会单独详细介绍一下）。

下面这张图可以加深你对线程池中各个参数的相互关系的理解（图片来源：《Java 性能调优实战》）：

![线程池各个参数的关系](https://oss.javaguide.cn/github/javaguide/java/concurrent/relationship-between-thread-pool-parameters.png)

**`ThreadPoolExecutor` 拒绝策略定义:**

如果当前同时运行的线程数量达到最大线程数量并且队列也已经被放满了任务时，`ThreadPoolExecutor` 定义一些策略:

- `ThreadPoolExecutor.AbortPolicy`：抛出 `RejectedExecutionException`来拒绝新任务的处理。
- `ThreadPoolExecutor.CallerRunsPolicy`：调用执行自己的线程运行任务，也就是直接在调用`execute`方法的线程中运行(`run`)被拒绝的任务，如果执行程序已关闭，则会丢弃该任务。因此这种策略会降低对于新任务提交速度，影响程序的整体性能。如果您的应用程序可以承受此延迟并且你要求任何一个任务请求都要被执行的话，你可以选择这个策略。
- `ThreadPoolExecutor.DiscardPolicy`：不处理新任务，直接丢弃掉。
- `ThreadPoolExecutor.DiscardOldestPolicy`：此策略将丢弃最早的未处理的任务请求。

### 线程池创建的两种方式

**方式一：通过`ThreadPoolExecutor`构造函数来创建（推荐）。**

![通过构造方法实现](./images/java-thread-pool-summary/threadpoolexecutor构造函数.png)

**方式二：通过 `Executor` 框架的工具类 `Executors` 来创建。**

`Executors`工具类提供的创建线程池的方法如下图所示：

![](https://oss.javaguide.cn/github/javaguide/java/concurrent/executors-new-thread-pool-methods.png)

可以看出，通过`Executors`工具类可以创建多种类型的线程池，包括：

- `FixedThreadPool`：固定线程数量的线程池。该线程池中的线程数量始终不变。当有一个新的任务提交时，线程池中若有空闲线程，则立即执行。若没有，则新的任务会被暂存在一个任务队列中，待有线程空闲时，便处理在任务队列中的任务。
- `SingleThreadExecutor`： 只有一个线程的线程池。若多余一个任务被提交到该线程池，任务会被保存在一个任务队列中，待线程空闲，按先入先出的顺序执行队列中的任务。
- `CachedThreadPool`： 可根据实际情况调整线程数量的线程池。线程池的线程数量不确定，但若有空闲线程可以复用，则会优先使用可复用的线程。若所有线程均在工作，又有新的任务提交，则会创建新的线程处理任务。所有线程在当前任务执行完毕后，将返回线程池进行复用。
- `ScheduledThreadPool`：给定的延迟后运行任务或者定期执行任务的线程池。

`Executors` 返回线程池对象的弊端如下：

- `FixedThreadPool` 和 `SingleThreadExecutor`:使用的是无界的 `LinkedBlockingQueue`，任务队列最大长度为 `Integer.MAX_VALUE`,可能堆积大量的请求，从而导致 OOM。
- `CachedThreadPool`:使用的是同步队列 `SynchronousQueue`, 允许创建的线程数量为 `Integer.MAX_VALUE` ，如果任务数量过多且执行速度较慢，可能会创建大量的线程，从而导致 OOM。
- `ScheduledThreadPool` 和 `SingleThreadScheduledExecutor`:使用的无界的延迟阻塞队列`DelayedWorkQueue`，任务队列最大长度为 `Integer.MAX_VALUE`,可能堆积大量的请求，从而导致 OOM。

```java
// 无界队列 LinkedBlockingQueue
public static ExecutorService newFixedThreadPool(int nThreads) {

    return new ThreadPoolExecutor(nThreads, nThreads,0L, TimeUnit.MILLISECONDS,new LinkedBlockingQueue<Runnable>());

}

// 无界队列 LinkedBlockingQueue
public static ExecutorService newSingleThreadExecutor() {

    return new FinalizableDelegatedExecutorService (new ThreadPoolExecutor(1, 1,0L, TimeUnit.MILLISECONDS,new LinkedBlockingQueue<Runnable>()));

}

// 同步队列 SynchronousQueue，没有容量，最大线程数是 Integer.MAX_VALUE`
public static ExecutorService newCachedThreadPool() {

    return new ThreadPoolExecutor(0, Integer.MAX_VALUE,60L, TimeUnit.SECONDS,new SynchronousQueue<Runnable>());

}

// DelayedWorkQueue（延迟阻塞队列）
public static ScheduledExecutorService newScheduledThreadPool(int corePoolSize) {
    return new ScheduledThreadPoolExecutor(corePoolSize);
}
public ScheduledThreadPoolExecutor(int corePoolSize) {
    super(corePoolSize, Integer.MAX_VALUE, 0, NANOSECONDS,
          new DelayedWorkQueue());
}
```

### 线程池常用的阻塞队列总结

新任务来的时候会先判断当前运行的线程数量是否达到核心线程数，如果达到的话，新任务就会被存放在队列中。

不同的线程池会选用不同的阻塞队列，我们可以结合内置线程池来分析。

- 容量为 `Integer.MAX_VALUE` 的 `LinkedBlockingQueue`（无界队列）：`FixedThreadPool` 和 `SingleThreadExector` 。`FixedThreadPool`最多只能创建核心线程数的线程（核心线程数和最大线程数相等），`SingleThreadExector`只能创建一个线程（核心线程数和最大线程数都是 1），二者的任务队列永远不会被放满。
- `SynchronousQueue`（同步队列）：`CachedThreadPool` 。`SynchronousQueue` 没有容量，不存储元素，目的是保证对于提交的任务，如果有空闲线程，则使用空闲线程来处理；否则新建一个线程来处理任务。也就是说，`CachedThreadPool` 的最大线程数是 `Integer.MAX_VALUE` ，可以理解为线程数是可以无限扩展的，可能会创建大量线程，从而导致 OOM。
- `DelayedWorkQueue`（延迟阻塞队列）：`ScheduledThreadPool` 和 `SingleThreadScheduledExecutor` 。`DelayedWorkQueue` 的内部元素并不是按照放入的时间排序，而是会按照延迟的时间长短对任务进行排序，内部采用的是“堆”的数据结构，可以保证每次出队的任务都是当前队列中执行时间最靠前的。`DelayedWorkQueue` 添加元素满了之后会自动扩容原来容量的 1/2，即永远不会阻塞，最大扩容可达 `Integer.MAX_VALUE`，所以最多只能创建核心线程数的线程。

## 线程池原理分析

###  线程池如何维护自身的生命周期？

```
    private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));
    private static final int COUNT_BITS = Integer.SIZE - 3;
    private static final int CAPACITY   = (1 << COUNT_BITS) - 1;

    // runState is stored in the high-order bits
    private static final int RUNNING    = -1 << COUNT_BITS;
    private static final int SHUTDOWN   =  0 << COUNT_BITS;
    private static final int STOP       =  1 << COUNT_BITS;
    private static final int TIDYING    =  2 << COUNT_BITS;
    private static final int TERMINATED =  3 << COUNT_BITS;


```

线程池内部使用一个变量 ctl 维护两个值：运行状态（runState）和线程数量（countBits）  
高 3 位保存 runState，低 29 位保存 workerCount。线程池也提供了若干方法去供用户获得线程池当前的运行状态、线程个数。这里都使用的是位运算的方式，相比于基本运算，速度也会快很多。  
ThreadPoolExecutor 的运行状态有五种：

<table><thead><tr><th>名称</th><th>状态值</th><th>描述</th></tr></thead><tbody><tr><td>RUNNING</td><td>-1</td><td>能接受新提交的任务，并且也能处理阻塞队列中的任务</td></tr><tr><td>SHUTDOWN</td><td>0</td><td>关闭状态，不再接受新提交的任务，但却可以继续处理阻塞队列中已保存的任务</td></tr><tr><td>STOP</td><td>1</td><td>不能接受新任务，也不处理队列中的任务，会中断正在处理任务的线程</td></tr><tr><td>TIDING</td><td>2</td><td>所有的任务都已终止，workerCount(有效线程数) 为 0</td></tr><tr><td>TERMINATED</td><td>3</td><td>在 terminated（）方法执行完后进入该状态</td></tr></tbody></table>

> 为什么要用一个变量去存储两个值？
>
> 可避免在做相关决策时，出现不一致的情况，不必为了维护两者的一致，而占用锁资源。

### 线程池如何管理任务？

#### 任务调度

所有任务的调度都是由 execute 方法完成的，这部分完成的工作是：检查现在线程池的运行状态、运行线程数、运行策略，决定接下来执行的流程，是直接申请线程执行，或是缓冲到队列中执行，亦或者是直接拒绝该任务。  
execute 方法源码如下：

```
  public void execute(Runnable command) {
        if (command == null)
            throw new NullPointerException();
        /*
         * Proceed in 3 steps:
         *
         * 1. If fewer than corePoolSize threads are running, try to
         * start a new thread with the given command as its first
         * task.  The call to addWorker atomically checks runState and
         * workerCount, and so prevents false alarms that would add
         * threads when it shouldn't, by returning false.
         *  1.如果工作线程小于核心线程数，尝试新建一个工作线程执行任务addWorker。
         * addWorker将会自动检查线程池状态和工作线程数，以防在添加工作线程的过程中，线程池被关闭。
         *
         * 2. If a task can be successfully queued, then we still need
         * to double-check whether we should have added a thread
         * (because existing ones died since last checking) or that
         * the pool shut down since entry into this method. So we
         * recheck state and if necessary roll back the enqueuing if
         * stopped, or start a new thread if there are none.
         *  2.如果创建工作线程执行任务失败，则任务入队列，如果入队列成功，我们仍需要二次检查线程池状态，以防在入队列的过程中，线程池关闭。如果线程池关闭，则回滚任务。
         *
         * 3. If we cannot queue task, then we try to add a new
         * thread.  If it fails, we know we are shut down or saturated
         * and so reject the task.
         *  3.如果任务入队列失败，则尝试创建一个工作线程执行任务
         */
        int c = ctl.get();
        //如果当前工作线程数小于核心线程数，则添加新的工作线程执行任务。
        if (workerCountOf(c) < corePoolSize) {    
            if (addWorker(command, true))
                return;
            c = ctl.get();
        }
        //如果当前工作线程数大于等于核心线程数，检查线程池运行状态，若为正在运行，则添加任务到任务队列。
        if (isRunning(c) && workQueue.offer(command)) {
            int recheck = ctl.get();
            //重新检查线程池运行状态，如果线程池处于非运行状态，则移除任务。
            if (! isRunning(recheck) && remove(command))
                //移除成功则进行拒绝任务处理
                reject(command);
            //如果工作线程为0（之前的线程已被销毁完），则创建一个工作线程。
            else if (workerCountOf(recheck) == 0)
                addWorker(null, false);
        }
        //false表示判断最大线程数，此处为根据最大线程数，判断是否应该添加工作线程，如果当前工作线程数量小于最大线程数，则尝试添加工作线程执行任务，如果执行失败，则拒绝任务处理
        else if (!addWorker(command, false))
            reject(command);
    }


```

addWorker 方法源码如下:

```
  /**
    *  根据当前线程池状态和核心线程数量与最大线程数量，检查是否应该添加工作线程执行任务。
    *  如果应该添加工作线程，则更新工作线程数，如果调整成功，则创建工作线程，执行任务。
    *  如果线程是已关闭或正在关闭，则添加工作线程失败。如果线程工厂创建线程失败，则返回false，如果由于线程工厂返回null或OutOfMemoryError等原因，则执行回滚清除操作。
    */
 private boolean addWorker(Runnable firstTask, boolean core) {
        retry:  
        for (;;) {
            int c = ctl.get();
            int rs = runStateOf(c);
            // Check if queue empty only if necessary.
            //如果线程池非运行状态 且 不同时满足线程池处于关闭状态，提交的任务为null,任务队列不为空，则直接返回false，添加工作线程失败。
            //SHUTDOWN状态不接受新任务，但仍然会执行已经加入任务队列的任务。
            //所以当进入SHUTDOWN状态，而传进来的任务为空，且任务队列不为空的时候，是允许添加新线程的，如果把这个条件取反，就表示不允许添加worker。
            if (rs >= SHUTDOWN &&
                ! (rs == SHUTDOWN &&
                   firstTask == null &&
                   ! workQueue.isEmpty()))
                return false;
            
            for (;;) {
                int wc = workerCountOf(c);
                //如果工作线程数量大于线程池容量，或当前工作线程大于core，或当前工作线程数量大于core（传入参数core为true时，此处core为corePoolSize,否则为maximumPoolSize），则直接返回false，添加工作线程失败
                if (wc >= CAPACITY ||
                    wc >= (core ? corePoolSize : maximumPoolSize))
                    return false;
                //CAS操作工作线程数，即原子操作工作线程数+1,成功则跳出自旋
                if (compareAndIncrementWorkerCount(c))
                    break retry;
                c = ctl.get();  // Re-read ctl
                //线程状态改变，继续重试。
                if (runStateOf(c) != rs)
                    continue retry;
                // else CAS failed due to workerCount change; retry inner loop
            }
        }
        
        //上面这段代码主要是对worker数量做原子+1操作。下面的逻辑才是正式构建Worker

        boolean workerStarted = false;//工作线程是否开始
        boolean workerAdded = false;//工作线程是否添加成功
        Worker w = null;
        try {
            w = new Worker(firstTask);
            final Thread t = w.thread;
            if (t != null) {
                final ReentrantLock mainLock = this.mainLock;
                //这里有个重入锁，避免并发问题
                mainLock.lock();
                try {
                    // Recheck while holding lock.
                    // Back out on ThreadFactory failure or if
                    // shut down before lock acquired.
                    int rs = runStateOf(ctl.get());
                    
                    //如果线程池是正在运行或线程池已关闭状态同时任务为null，则添加工作线程到工作线程集
                    if (rs < SHUTDOWN ||
                        (rs == SHUTDOWN && firstTask == null)) {  
                        //任务刚封装到work里面，还没start，线程状态不可能是alive，故抛出异常。
                        if (t.isAlive()) // precheck that t is startable
                            throw new IllegalThreadStateException();
                        //添加工作线程到工作线程集
                        workers.add(w);
                        int s = workers.size();
                        //如果集合中的工作线程数大于最大线程数，这个最大线程数表示线程池曾经出现过的最大线程数。则更新线程池出现过的最大线程数
                        if (s > largestPoolSize)
                            largestPoolSize = s;
                        workerAdded = true;
                    }
                } finally {
                    mainLock.unlock();
                }
                //添加工作线程成功，则启动线程执行任务
                if (workerAdded) {
                    t.start();
                    workerStarted = true;
                }
            }
        } finally {
            //执行任务失败，则回滚工作线程和工作线程数
            if (! workerStarted)
                addWorkerFailed(w);
        }
        return workerStarted;
    }


```

总结而言，线程池的执行过程如下：

1.  检查线程池运行状态
2.  如果 workCount < corePoolSize, 创建并启动一个线程来执行新提交的任务
3.  如果 workCount >= corePoolSize，且线程池内的阻塞队列未满，则将任务添加到该阻塞队列中。
4.  如果 workCount >=corePoolSize && workCount < maximumPoolSize，且线程池内的阻塞队列已满，则创建并启动一个线程来执行新提交的任务。
5.  如果 workCount >= maximumPoolSize，并且线程池内的阻塞队列已满，则根据拒绝策略来处理该任务，默认的处理方式是直接抛异常。

#### 任务缓冲

线程池以生产者消费者模式，通过一个阻塞队列来实现。阻塞队列缓存任务，工作线程从阻塞队列中获取任务。  
常用阻塞队列如下表

<table><thead><tr><th>名称</th><th>描述</th></tr></thead><tbody><tr><td>ArrayBlockingQueue</td><td>一个用数组实现的有界阻塞队列。此队列按照先进先出（FIFO）的原则对元素进行排序。支持公平锁和非公平锁。</td></tr><tr><td>LinkedBlockingQueue</td><td>一个由链表结构组成的有界队列，此队列按照先进先出（FIFO）的原则对元素进行排序。此队列的默认长度为 Integer.MAX_VALUE。所以默认创建的该队列有容量危险。</td></tr><tr><td>PriorityBlockingQueue</td><td>一个支持线程优先级排序的无界队列，默认自然序进行排序，也可以自定义实现 compareTo（）方法来指定元素排序规则，不能保证同优先级元素的顺序。</td></tr><tr><td>DelayQueue</td><td>一个实现 PriorityBlockingQueue 实现延迟获取的无界队列，在创建元素时，可以指定多久才能从队列中获取当前元素。只有延时期满后才能从队列中获取元素。</td></tr><tr><td>SynchronousQueue</td><td>一个不存储元素的阻塞队列，每一个 put 操作必须等待 take 操作，否则不能添加元素。支持公平锁和非公平锁。SynchronousQueue 的一个使用场景是在线程池里。Executors.newCachedThreadPool() 就使用了 SynchronousQueue，这个线程池根据需要（新任务到来时）创建新的线程，如果有空闲线程就会重复使用，线程空闲了 60 秒后会被回收。</td></tr><tr><td>LinkedTransferQueue</td><td>一个由链表结构构成的无界阻塞队列，相对于其他队列，LinkedTransferQueue 队列多了 transfer 和 tryTransfer 方法。</td></tr><tr><td>LinkedBlockingDeque</td><td>一个由链表结构组成的双向阻塞队列。队列头部和尾部都可以添加和移除元素，多线程并发时，可以将锁的竞争最多降到一半。</td></tr></tbody></table>

#### 任务申请

任务的执行有两种可能：  
1. 任务直接由新创建的线程执行。  
2. 线程从任务队列中获取任务然后执行，执行完任务的空闲线程会再次从队列中申请任务再去执行。  
第一种情况仅出现在线程初始创建的时候，第二种是线程获取任务绝大多数的情况。

线程需要从任务缓存模块中不断地取任务执行，帮助线程从高阻塞队列中获取任务，实现线程管理模块和任务管理模块之间的通信。  
这部分策略由 getTask 方法实现。  
getTask 这部分进行了多次判断，为的是控制线程的数量，使其符合线程池的状态。如果线程池现在不应该持有那么多线程，则会返回 null 值。工作线程 Worker 会不断接收新任务去执行，而当工作线程 Worker 接收不到任务的时候，就会开始被回收。

#### 任务拒绝

任务拒绝模块是线程池的保护部分，线程池有一个最大的容量，当线程池的任务缓存队列已满，并且线程池中的线程数目达到 maximumPoolSize 时 i，就需要拒绝掉该任务，采用任务拒绝策略，保护线程池。  
用户可以通过实现 RejectedExecutionHandler 接口定制拒绝策略。也可以选择 JDK 提供的四种拒绝策略。

<table><thead><tr><th>名称</th><th>描述</th></tr></thead><tbody><tr><td>ThreadPoolExecutor.AbortPolicy</td><td>丢弃任务并抛出 RejectedExecutionException 异常。这是线程池默认的拒绝策略，在任务不能再提交的时候，抛出异常，及时反馈程序运行状态。如果是比较关键的业务，推荐使用此拒绝策略，这样在系统不能承载更大的并发量的时候，能够及时的通过异常发现。</td></tr><tr><td>ThreadPoolExecutor.DiscardPolicy</td><td>丢弃任务，但不抛出异常。使用此策略，可能会使我们无法发现系统的异常状态。建议是一些无关紧要的业务采用此策略。</td></tr><tr><td>ThreadPoolExecutor.DiscardOldestPolicy</td><td>丢弃队列最前面的任务，然后重新提交被拒绝的任务。是否要采用此种拒绝策略，还得根据实际业务是否允许丢弃老任务来认真衡量。</td></tr><tr><td>ThreadPoolExecutor.CallerRunPolicy</td><td>由调用线程 (提交任务的线程) 处理该任务。这种情况是需要让所有任务都执行完毕。那么就适合大量计算的任务类型去执行，多线程仅仅是增大吞吐量的手段，最终必须要让每个任务都执行完毕。</td></tr></tbody></table>

### 线程池如何管理线程？

#### 工作线程 Worker

线程池为了掌握线程的状态，并维护线程的生命周期，设计了线程池内工作线程 Worker 管理线程。

```
/** 
  *  Worker主要为任务线程维护中断控制状态和其他次要状态记录。Worker简单实现了AQS在任务线程执行前lock，任务执行完unlock。加锁的主要目的是保护任务线程的执行。
  *  线程池唤醒一个任务线程等待任务，而不是中断当前正在执行任务的线程去执行任务。我们使用了一个非重入互斥锁而不是ReentrantLock，
  *  这样做的目的是以防在任务执行的过程，线程池控制方法的改变，对任务线程执行的影响，比如setCorePoolSize方法。
  *  另外为了防止任务线程在实际执行前被中断，我们初始化锁状态为-1，在runWorker方法中，我们会清除它。
  */
private final class Worker
        extends AbstractQueuedSynchronizer
        implements Runnable
    {
        /**
         * This class will never be serialized, but we provide a
         * serialVersionUID to suppress a javac warning.
         */
        private static final long serialVersionUID = 6138294804551838833L;

        /** Thread this worker is running in.  Null if factory fails. */
        final Thread thread;  //任务线程,正正执行task的线程
        /** Initial task to run.  Possibly null. */
        Runnable firstTask;  //任务
        /** Per-thread task counter */
        volatile long completedTasks;  //线程完成的任务计数

        /**
         * Creates with given first task and thread from ThreadFactory.
         * 根据给定的任务，用线程工厂创建任务线程
         * @param firstTask the first task (null if none)
         */
        Worker(Runnable firstTask) {
            setState(-1); // inhibit interrupts until runWorker
            this.firstTask = firstTask;
            this.thread = getThreadFactory().newThread(this);
        }

        /** Delegates main run loop to outer runWorker  */
        public void run() {
            runWorker(this);
        }

        // Lock methods
        //
        // The value 0 represents the unlocked state.
        // The value 1 represents the locked state.
        //  判断是否锁状态 0为闭锁状态，1为开锁状态
        protected boolean isHeldExclusively() {
            return getState() != 0;
        }
         
        //尝试获取锁
        protected boolean tryAcquire(int unused) {
            if (compareAndSetState(0, 1)) {
                setExclusiveOwnerThread(Thread.currentThread());
                return true;
            }
            return false;
        }
        
        //尝试释放锁
        protected boolean tryRelease(int unused) {
            setExclusiveOwnerThread(null);
            setState(0);
            return true;
        }

        public void lock()        { acquire(1); }
        public boolean tryLock()  { return tryAcquire(1); }
        public void unlock()      { release(1); }
        public boolean isLocked() { return isHeldExclusively(); }

        void interruptIfStarted() {
            Thread t;
            //如果锁处于关闭状态，且任务线程不为null,非处于中断状态，则中断当前线程
            if (getState() >= 0 && (t = thread) != null && !t.isInterrupted()) {
                try {
                    t.interrupt();
                } catch (SecurityException ignore) {
                }
            }
        }
    }


```

Worker 实现 Runnable 接口了，持有一个线程 thread，一个初始化的任务 firstTask。thread 是在调用构造方法时通过 ThreadFactory 来创建的线程，可以用来执行任务。firstTask 用来保存传入的第一个任务。如果这个值是非空的，那么线程就会在启动初期立即执行这个任务，也就对应核心线程创建时的情况，如果这个值是 null，那么就需要创建一个线程去执行 workQueue 中的任务，也就是非核心线程的创建。  
Work 通过继承 AQS，使用 AQS 来实现独占锁。

##### 什么是 AQS？

AQS：AbstractQueuedSynchronizer 抽象的队列式的同步器  
AQS 定义了一套多线程访问共享资源的同步器框架，许多同步类的实现都依赖于它，如常用的 ReentrantLock、Semaphore 等。  
AQS 的核心思想是：如果被请求的共享资源空闲，则将当前请求资源的线程设置为有效的工作线程，并将共享资源设置为锁定状态，如果被请求的共享资源被占用，那么就需要一套线程阻塞等待以及被唤醒时锁分配的机制，这个机制 AQS 是用 CLH 队列锁实现的，即将暂时获取不到锁的线程加入到队列中。  
CLH 队列是一个虚拟的双向队列，虚拟的双向队列即不存在队列实例，仅存在节点之间的关联关系。

总结：AQS 就是基于 CLH 队列，用 volatile 修饰共享变量 state，线程通过 CAS 去改变状态符，成功则获取锁成功，失败则进入等待队列，等待被唤醒。

##### 为什么要继承 AQS？

线程池需要管理线程的生命周期，需要在线程池长时间不运行的时候进行回收。

```
  private final HashSet<Worker> workers = new HashSet<Worker>();
```

线程池使用一张 HashSet 去持有线程的引用，这样可以通过添加引用，移除引用这样的操作来控制线程的生命周期。  
此时 Work 需要提供对线程是否在运行的判断。  
故 Worker 通过继承 AQS，使用 AQS 来实现独占锁的功能，没有使用可重入锁 ReeentrantLock，而是使用 AQS，为的就是**实现不可重入的特性去反应线程现在的执行状态**。  
lock 方法一旦获取了独占锁，表示当前线程正在执行任务中，那么它会有以下几个作用：  

1. 如果正在执行任务，则不应该中断线程。  
2. 如果该线程现在不是独占锁的状态，也就是空闲的状态，说明它没有在处理任务，这时可以对该线程进行中断。  
3. 线程池在执行 shutdown 方法或 tryTerminate 方法时会调用 interruptIdleWorkers 方法来中断空闲的线程，interruptIdleWorkers 方法会使用 tryLock 方法来判断线程池中的线程是否是空闲状态。  
4. 之所以设置为不可重入，是因为我们不希望任务在调用像 setCorePoolSize 这样的线程池控制方法时重新获取锁，这样会中断正在运行的线程

#### Worker 线程增加

增加线程是通过线程池中的 addWorker 方法。该方法的功能就是增加一个线程。(源码见上文)

#### Worker 线程回收

线程池中的线程的销毁依赖 JVM 自动的回收，线程池做的工作是根据当前线程池的状态维护一定数量的线程引用，防止这部分线程被 JVM 回收，当线程池决定哪些线程需要回收时，只需要将其引用消除即可。  
Worker 被创建出来后，就会不断地进行轮询。然后获取任务去执行，核心线程可以无限等待获取任务，非核心线程要限时获取任务。当 Worker 无法获取到任务，也就是获取的任务为空时，循环会结束，Worker 会自动消除自身在线程池内的引用。

#### Worker 线程执行任务

在 Worker 类中的 run 方法调用了 runWorker 方法来执行任务，runWorker 方法的执行过程如下：

1.  while 循环不断地通过 getTask() 方法获取任务。
2.  getTask() 方法从阻塞队列中取任务。
3.  如果线程池正在停止，那么要保证当前线程是中断状态，否则要保证当前线程不是中断状态。
4.  执行任务
5.  如果 getTask 结果为 null 则跳出循环，执行 processWorkerExit() 方法，销毁线程。

```
  private Runnable getTask() {
        boolean timedOut = false; // Did the last poll() time out?
      
        for (;;) {
            int c = ctl.get();
            int rs = runStateOf(c);

            // Check if queue empty only if necessary.
            /* 对线程池状态的判断，两种情况会workCount-1，并且返回null
               1. 线程池状态为shutdown，且workQueue为空（反映了shutdown状态的线程池还是要执行workQueue中剩余的任务）
               2.  线程池状态为stop（shutdownNow（）会导致变成stop），此时不考虑workQueue的情况
             */
            if (rs >= SHUTDOWN && (rs >= STOP || workQueue.isEmpty())) {
                decrementWorkerCount();
                return null;
            }

            int wc = workerCountOf(c);
            
            // Are workers subject to culling?
            //如果线程池正在运行，根据是否允许空闲线程等待任务和当前工作线程与核心线程数比较值，判断是否需要超时等待任务。
            //allowCoreThreadTimeOut默认为false，也就是默认核心线程不允许进行超时。
            boolean timed = allowCoreThreadTimeOut || wc > corePoolSize;
            //如果当前工作线程数，小于最大线程数，空闲工作线程不需要超时等待任务，则跳出自旋，即在当前工作线程小于最大线程数的情况下，有工作线程可用，任务队列为空。
            if ((wc > maximumPoolSize || (timed && timedOut))
                && (wc > 1 || workQueue.isEmpty())) {
                if (compareAndDecrementWorkerCount(c))
                    return null;
                continue;
            }
            
            /*根据 timed 来判断，如果为 true，则通过阻塞队列 poll 方法进行超时控制，如果在keepaliveTime 时间内没有获取到任务，则返回 null.
                否则通过 take 方法阻塞式获取队列中的任务*/
            try {
                Runnable r = timed ?
                    workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS) :
                    workQueue.take();
                if (r != null)  //如果拿到的任务不为空，则直接返回给worker进行处理
                    return r;
                timedOut = true;  //如果 r==null，说明已经超时了，设置 timedOut=true，在下次自旋的时候进行回收
            } catch (InterruptedException retry) {
                timedOut = false;  // 如果获取任务时当前线程发生了中断，则设置 timedOut 为false 并返回循环重试
            }
        }
    }


```

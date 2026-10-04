---
title: "Java Lock - ATA"
source: "https://ata.atatech.org/articles/11000192128?spm=ata.25287382.0.0.6eff7536YzL0JD"
author:
published:
created: 2026-04-08
description:
tags:
  - "clippings"
---
## Java Lock

2021-01-11发表2023-06-12更新359次浏览




## 引言

本文着重介绍 Java 中 Lock 的不同实现方式。所有关于 Java 并发的文章均收录于 [贝贝猫的文章目录](https://www.atatech.org/articles/192584) 。

## 锁的种类

在 JUC 中，大量使用到了锁，而 Java 中往往是按照是否含有某一特性来定义锁，我们通过特性将锁进行分组归类，再使用对比的方式进行介绍，帮助大家更快捷的理解相关知识。下面给出本文内容的总体分类目录：

![[ab2d44bc-2b0a-470b-9be7-3fb7d1a176c5.jpg|lock-map]]

### 悲观锁与乐观锁

对于同一个数据的并发操作，悲观锁认为自己在使用数据的时候一定有别的线程来修改数据，因此在获取数据的时候会先加锁，确保数据不会被别的线程修改。Java中，synchronized关键字和大部分Lock的实现类都是悲观锁。

而乐观锁认为自己在使用数据时不会有别的线程修改数据，所以不会添加锁，只是在更新数据的时候去判断之前有没有别的线程更新了这个数据。如果这个数据没有被更新，当前线程将自己修改的数据成功写入。如果数据已经被其他线程更新，则根据不同的实现方式执行不同的操作（例如报错或者自动重试）。在 Java 中是通过使用无锁编程来实现，最常采用的是CAS 算法，Java原子类中的递增操作就通过CAS自旋实现的。

![[bcf538b3-5d8b-4201-8f41-18549d33ce1c.jpg|lock-or-not]]

lock-or-not

一般来说，当数据的写操作很少，读操作很多时，我们会使用到乐观锁，反之则使用悲观锁。下面是这两种锁使用的例子。

```java
public class LockTest{

    private int sum1;
    private AtomicInteger sum2 = new AtomicInteger(0);
    private int sum3;
    private ReentrantLock lock;

    /**
     */
    public synchronized void increase1() {
        sum1++;
    }

    /**
     * 悲观锁，使用 ReentrantLock 提供的锁
     */
    public void increase3() {
        lock.lock();
        sum3++;
        lock.unlock();
    }

    /**
     */
    public void increase2() {
        sum2.incrementAndGet();
    }
}
```

#### 乐观锁实现

这里我们简单地说一下乐观锁使用到的 CAS，关于悲观锁的内容我们后面再说，CAS全称 Compare And Swap（比较与交换），是一种无锁算法。在不使用锁（没有线程被阻塞）的情况下实现多线程之间的变量同步。java.util.concurrent包中的原子类就是通过CAS来实现了乐观锁。

CAS算法涉及到三个操作数：

- 需要读写的内存值 V。
- 进行比较的值 A。
- 要写入的新值 B。

当且仅当 V 的值等于 A 时，CAS通过原子方式用新值B来更新V的值（“比较+更新”整体是一个原子操作），否则不会执行任何操作。一般情况下，“更新”是一个不断重试的操作。

```java
public class AtomicInteger extends Number implements java.io.Serializable {
    private static final long serialVersionUID = 6214790243416807050L;

    // setup to use Unsafe.compareAndSwapInt for updates
    private static final Unsafe unsafe = Unsafe.getUnsafe();
    private static final long valueOffset;

    static {
        try {
            valueOffset = unsafe.objectFieldOffset
                (AtomicInteger.class.getDeclaredField("value"));
        } catch (Exception ex) { throw new Error(ex); }
    }

    private volatile int value;
    ///...
    public final int incrementAndGet() {
        return unsafe.getAndAddInt(this, valueOffset, 1) + 1;
    }
}
```
            valueOffset = unsafe.objectFieldOffset
```javascript
                (AtomicInteger.class.getDeclaredField("value"));
        } catch (Exception ex) { throw new Error(ex); }
    }

    private volatile int value;
    ///...
    public final int incrementAndGet() {
        return unsafe.getAndAddInt(this, valueOffset, 1) + 1;
    }
}
```

上述就是 JUC 中原子类的实现，其中 `unsafe` 是 Java 提供的操作底层内存的接口，CAS 指令就在其中，而这个原子类的实际数据保存在 `value` 字段中，该属性需要借助volatile关键字保证其在线程间是可见的。 `valueOffset` 存储了value在AtomicInteger中的偏移量，我们在使用 `unsafe` 是需要用到它。

接下来，我们深入到 `unsafe` 中看看它是如何实现 `getAndAddInt` 的。

```java
public final int getAndAddInt(Object o, long offset, int delta) {
    int previousValue;
    do {
        previousValue = this.getIntVolatile(o, offset);
    } while(!this.compareAndSwapInt(o, offset, previousValue, previousValue + delta));

    return var5;
}
```

从上述代码中我们可以看到， `getAndAddInt` 中循环地获取对象 o 中指定 offset 的内存值，并通过 `compareAndSwapInt` 进行原子化的比较和更新操作。如果更新失败，就重复上述过程。

而 `compareAndSwapInt` 已经是一个 native 函数了，它的实现如下：

```java
// unsafe.cpp
UNSAFE_ENTRY(jboolean, Unsafe_CompareAndSwapInt(JNIEnv *env, jobject unsafe, jobject obj, jlong offset, jint e, jint x))
  UnsafeWrapper("Unsafe_CompareAndSwapInt");
  oop p = JNIHandles::resolve(obj);
  jint* addr = (jint *) index_oop_from_field_offset_long(p, offset);
  return (jint)(Atomic::cmpxchg(x, addr, e)) == e;
```
UNSAFE_END

代码中能看到 cmpxchg 有基于各个平台的实现，这里我选择Linux X86平台下的源码分析：

```java
// atomic_linux_x86.inline.hpp
inline jint     Atomic::cmpxchg    (jint     exchange_value, volatile jint*     dest, jint     compare_value) {
    int mp = os::is_MP();
  __asm__ volatile (LOCK_IF_MP(%4) "cmpxchgl %1,(%3)"
                    : "=a" (exchange_value)
                    : "r" (exchange_value), "a" (compare_value), "r" (dest), "r" (mp)
                    : "cc", "memory");
  return exchange_value;
}

// Adding a lock prefix to an instruction on MP machine
```
#define LOCK_IF_MP(mp) "cmp $0, " #mp "; je 1f; lock; 1: "

这是一段小汇编，__asm__说明是ASM汇编，__volatile__禁止编译器优化。

os::is_MP判断当前系统是否为多核系统，如果是就给该数据加锁（总线锁或者缓存锁），所以同一芯片上的其他处理器就暂时不能访问内存，保证了该指令在多处理器环境下的原子性。

在正式解读这段汇编前，我们来了解下嵌入汇编的基本格式：

asm ( assembler template
```java
    : output operands                  /* optional */
    : input operands                   /* optional */
    : list of clobbered registers      /* optional */
    );
```

其中：

- template就是cmpxchgl %1, (%3)表示汇编模板
- output operands表示输出操作数, =a对应eax寄存器
- input operand 表示输入参数，%1 就是exchange_value, %3是dest, %4就是mp， r表示任意寄存器，a还是eax寄存器
- list of clobbered registers就是些额外参数，cc表示编译器cmpxchgl的执行将影响到标志寄存器, memory告诉编译器要重新从内存中读取变量的最新值

在 Linux X86平台下，最终JDK通过CPU的cmpxchgl指令的支持，实现AtomicInteger的CAS操作的原子性。虽然我们说 CAS 是无锁化的设计，但是在机器指令这一层面来看实际上也会使用到内存锁定，才能达到原子化的目标。

#### 乐观锁的问题

乐观锁虽然很高效，但是它也存在三大问题，这里也简单说一下：

1. ABA问题。CAS需要在操作值的时候检查内存值是否发生变化，没有发生变化才会更新内存值。但是如果内存值原来是A，后来变成了B，然后又变成了A，那么CAS进行检查时会发现值没有发生变化，但是实际上是有变化的。ABA问题的解决思路就是在变量前面添加版本号，每次变量更新的时候都把版本号加一，这样变化过程就从“A－B－A”变成了“1A－2B－3A”。
	- JDK从1.5开始提供了 `AtomicStampedReference` 类来解决ABA问题，具体操作封装在compareAndSet()中。compareAndSet()首先检查当前引用和当前标志与预期引用和预期标志是否相等，如果都相等，则以原子方式将引用值和标志的值设置为给定的更新值。
2. 循环时间长开销大。CAS操作如果长时间不成功，会导致其一直自旋，给CPU带来非常大的开销。
3. 只能保证一个共享变量的原子操作。对一个共享变量执行操作时，CAS能够保证原子操作，但是对多个共享变量操作时，CAS是无法保证操作的原子性的。
	- Java从1.5开始JDK提供了 `AtomicReference` 类来保证引用对象之间的原子性，可以把多个变量放在一个对象里来进行CAS操作。CAS 操作比较的是对象的地址。

```java
// java.util.concurrent.atomic.AtomicStampedReference#compareAndSet
/**

* Atomically sets the value of both the reference and stamp
* to the given update values if the
* current reference is {@code ==} to the expected reference
* and the current stamp is equal to the expected stamp.

* @param expectedReference the expected value of the reference
* @param newReference the new value for the reference
* @param expectedStamp the expected value of the stamp
* @param newStamp the new value for the stamp
* @return {@code true} if successful

*/
public boolean compareAndSet(V   expectedReference,
```
                            V   newReference,
                            int expectedStamp,
                            int newStamp) {
   Pair<V> current = pair;
   return
       expectedReference == current.reference &&
       expectedStamp == current.stamp &&
       ((newReference == current.reference &&
         newStamp == current.stamp) ||
```java
casPair(current, Pair.of(newReference, newStamp)));
}

private boolean casPair(Pair<V> cmp, Pair<V> val) {
    return UNSAFE.compareAndSwapObject(this, pairOffset, cmp, val);
}
```

无论是上述的 `AtomicStampedReference` 还是 `AtomicReference` 最终都是通过 `compareAndSwapObject` 来实现的，而这个 CAS 操作比较的实际上就是对象的地址。

```java
// Unsafe.h
virtual jboolean compareAndSwapObject(::java::lang::Object *, jlong, ::java::lang::Object *, ::java::lang::Object *);

// natUnsafe.cc
static inline bool
```
compareAndSwap (volatile jobject *addr, jobject old, jobject new_val)
```java
{
    jboolean result = false;
    spinlock lock;

    // 如果字段的地址与期望的地址相等则将字段的地址更新
    if ((result = (*addr == old)))
        *addr = new_val;
    return result;
}

// natUnsafe.cc
```
jboolean
sun::misc::Unsafe::compareAndSwapObject (jobject obj, jlong offset,
                     jobject expect, jobject update)
```java
{
    // 获取字段地址并转换为字符串
    jobject *addr = (jobject*)((char *) obj + offset);
    // 调用 compareAndSwap 方法进行比较
    return compareAndSwap (addr, expect, update);
}
```

### 阻塞锁与自旋锁

阻塞或唤醒一个Java线程需要操作系统切换CPU状态来完成，这种状态转换需要耗费处理器时间。如果同步代码块中的内容过于简单，状态转换消耗的时间有可能比用户代码执行的时间还要长。我们前面提到的 `Monitor 锁` 和 `ReentrantLock` 都是阻塞锁。

在许多场景中，同步资源的锁定时间很短，为了这一小段时间去切换线程，线程挂起和恢复现场的花费可能会让系统得不偿失。如果物理机器有多个处理器，能够让两个或以上的线程同时并行执行，我们就可以让后面那个请求锁的线程不放弃CPU的执行时间，看看持有锁的线程是否很快就会释放锁。

而为了让当前线程“稍等一下”，我们需让当前线程进行自旋，如果在自旋完成后前面锁定同步资源的线程已经释放了锁，那么当前线程就可以不必阻塞而是直接获取同步资源，从而避免切换线程的开销。这就是自旋锁。这很类似于前面 `AtomicInteger` 的实现方式， `AtomicInteger` CAS 的期待值是 previousValue，目标值可能是任意一个数，而一般在自旋锁中，用 0 表示未锁定状态，用 1 表示锁定状态，那么加锁过程CAS的期待值就是0，目标值就是 1。

```java
public class SpinLock {

   private AtomicBoolean locked = new AtomicBoolean(false);

   public void lock() {
      while (!locked.compareAndSet(false, true));
   }

   public void unlock() {
      locked.set(false);
   }
}
```

![[1175652b-eb4a-449b-a85c-74fe2fd63b3c.jpg|spin-lock]]

自旋锁本身是有缺点的，它不能代替阻塞。自旋等待虽然避免了线程切换的开销，但它要占用处理器时间。如果锁被占用的时间很短，自旋等待的效果就会非常好。反之，如果锁被占用的时间很长，那么自旋的线程只会白浪费处理器资源。所以，自旋等待的时间必须要有一定的限度，如果自旋超过了限定次数还没有成功获得锁，就应当挂起线程。

既然自旋锁的等待过程这么浪费 CPU，那么我们有没有什么办法能够改善它呢？JDK 6中引入了自适应的自旋锁（适应性自旋锁）。自适应意味着自旋的时间（次数）不再固定，而是由前一次在同一个锁上的自旋时间及锁的拥有者的状态来决定。如果在同一个锁对象上，自旋等待刚刚成功获得过锁，并且持有锁的线程正在运行中，那么虚拟机就会认为这次自旋也是很有可能再次成功，进而它将允许自旋等待持续相对更长的时间。如果对于某个锁，自旋很少成功获得过，那在以后尝试获取这个锁时将可能省略掉自旋过程，直接阻塞线程，避免浪费处理器资源。

### 公平锁和非公平锁

公平锁是指多个线程按照申请锁的顺序来获取锁，线程直接进入队列中排队，队列中的第一个线程才能获得锁。公平锁的优点是等待锁的线程不会饿死。缺点是整体吞吐效率相对非公平锁要低，等待队列中除第一个线程以外的所有线程都会阻塞，CPU唤醒阻塞线程的开销比非公平锁大。

![[676f1459-afef-4edb-a57c-b316c74fbfe6.jpg|fair-lock]]

非公平锁是多个线程加锁时直接尝试获取锁，获取不到才会到等待队列的队尾等待。但如果此时锁刚好可用，那么这个线程可以无需阻塞直接获取到锁，所以非公平锁有可能出现后申请锁的线程先获取锁的场景。非公平锁的优点是可以减少唤起线程的开销，整体的吞吐效率高，因为线程有几率不阻塞直接获得锁，CPU不必唤醒所有线程。缺点是处于等待队列中的线程可能会饿死，或者等很久才会获得锁。

![[66a20362-1a8b-4b10-b0be-05be0e81d23a.jpg|unfair-lock]]

unfair-lock

我们知道在 `ReentrantLock` 中，我们即可以使用公平锁，又可以使用非公平锁，不妨来看看它们分别是怎么实现的。在 `ReentrantLock` 中，锁的核心都是通过 `Sync` 对象实现，它继承自 `AbstractQueuedSynchronizer(AQS)` ，AQS 是一个集成了等待队列与锁与一身的基类，很多 JUC 中的库都是建立在其上开发的。我们之后会详细介绍到它，这里先来看一下公平锁和非公平锁的实现方式。

```javascript
/**
 * Fair version of tryAcquire.  Don't grant access unless
 * recursive call or no waiters or is first.
 */
protected final boolean tryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState();
    if (c == 0) {
        if (!hasQueuedPredecessors() && // 先检查任务队列中是否有排在自己前面的线程等待
            compareAndSetState(0, acquires)) { // 没有的话，自己再试图获取锁
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    else if (current == getExclusiveOwnerThread()) {
        // 如果已经是自己持有锁，则计数器加1
        int nextc = c + acquires;
        if (nextc < 0)
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false;
}
/**
 * Performs non-fair tryLock.  tryAcquire is implemented in
 * subclasses, but both need nonfair try for trylock method.
 */
final boolean nonfairTryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState();
    if (c == 0) {
        if (compareAndSetState(0, acquires)) { // 非公平锁直接试图加锁，不检查等待队列
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    else if (current == getExclusiveOwnerThread()) {
        // 如果已经是自己持有锁，则计数器加1
        int nextc = c + acquires;
        if (nextc < 0) // overflow
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false;
}
```

从上面的代码中，我们不难发现，公平锁和非公平锁就差一行，即 `!hasQueuedPredecessors()`, 该方法主要做一件事情：主要是判断当前线程是否位于同步队列中的第一个。如果是则返回true，否则返回false。

```java
/**
 * Queries whether any threads have been waiting to acquire longer
 * than the current thread.
 *
 * <p>An invocation of this method is equivalent to (but may be
 * more efficient than):
 *  <pre> {@code
 * getFirstQueuedThread() != Thread.currentThread() &&
 * hasQueuedThreads()}</pre>
 *
 * <p>Note that because cancellations due to interrupts and
 * timeouts may occur at any time, a {@code true} return does not
 * guarantee that some other thread will acquire before the current
 * thread.  Likewise, it is possible for another thread to win a
 * race to enqueue after this method has returned {@code false},
 * due to the queue being empty.
 *
 * <p>This method is designed to be used by a fair synchronizer to
 * avoid <a href="AbstractQueuedSynchronizer#barging">barging</a>.
 * Such a synchronizer's {@link #tryAcquire} method should return
 * {@code false}, and its {@link #tryAcquireShared} method should
 * return a negative value, if this method returns {@code true}
 * (unless this is a reentrant acquire).  For example, the {@code
 * tryAcquire} method for a fair, reentrant, exclusive mode
 * synchronizer might look like this:
 *
 *  <pre> {@code
 * protected boolean tryAcquire(int arg) {
 *   if (isHeldExclusively()) {
 *     // A reentrant acquire; increment hold count
 *     return true;
 *   } else if (hasQueuedPredecessors()) {
 *     return false;
 *   } else {
 *     // try to acquire normally
 *   }
 * }}</pre>
 *
 * @return {@code true} if there is a queued thread preceding the
 *         current thread, and {@code false} if the current thread
 *         is at the head of the queue or the queue is empty
 * @since 1.7
 */
public final boolean hasQueuedPredecessors() {
    // The correctness of this depends on head being initialized
    // before tail and on head.next being accurate if the current
    // thread is first in queue.
    Node t = tail; // Read fields in reverse initialization order
    Node h = head;
    Node s;
    // 队列中第一个节点是一个虚节点，如果 tail == head 说明只存在该虚节点，不存在实际数据
    // 当 tail != head 时判断 head.next 是不是等于 null，等于 null 也说明不存在实际数据，
    // 最后如果 head.next.thread == Thread.currentThread() 的话说明持有锁的是当前线程
    return h != t &&
        ((s = h.next) == null || s.thread != Thread.currentThread());
}
```

综上，公平锁就是通过同步队列来实现多个线程按照申请锁的顺序来获取锁，从而实现公平的特性。非公平锁加锁时不考虑排队等待问题，直接尝试获取锁，所以存在后申请却先获得锁的情况。这里我们先介绍到这一层，关于 `ReentrantLock` 的更下层实现细节，我们后面再展开。

### 可重入和不可重入

可重入锁又名递归锁，是指在一个线程已经持有锁的前提下，可以再次获得该锁，不会因为之前已经获取过还没释放而阻塞。Java中 `ReentrantLock` 和 `synchronized` 都是可重入锁，可重入锁的一个优点是可一定程度避免死锁。

```java
public class LockTest{

    public synchronized void doSomeThing() {
        doOtherThings();
    }

    public synchronized void doOtherThings() {
        // doOtherThings
    }
}
```

如果是一个不可重入锁，那么当前线程在调用doOtherThings()之前需要将执行doSomeThing()时获取当前对象的锁释放掉，实际上该对象锁已被当前线程所持有，且synchronized锁无法显式释放，所以此时会出现死锁。

前面提到的 ReentrantLock 是一个可重入锁，从它的加锁代码中，我们不难发现加锁成功时，如果发现当前线程已经是持有锁的线程，则会通过一个 int 来保存重入次数。

```javascript
/**
 * Fair version of tryAcquire.  Don't grant access unless
 * recursive call or no waiters or is first.
 */
protected final boolean tryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState();
    if (c == 0) {
        if (!hasQueuedPredecessors() &&
            compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    else if (current == getExclusiveOwnerThread()) {
        int nextc = c + acquires; // 通过一个 int 来保存重入次数
        if (nextc < 0)
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false;
}
```

而在解锁时，则会将重入次数减1，直到该值为0时，才真正的释放锁。

```c
protected final boolean tryRelease(int releases) {
    int c = getState() - releases;
    if (Thread.currentThread() != getExclusiveOwnerThread())
        throw new IllegalMonitorStateException();
    boolean free = false;
    if (c == 0) {
        // 直到该值为0时，才真正的释放锁
        free = true;
        setExclusiveOwnerThread(null);
    }
    setState(c);
    return free;
}
```

而当我们要实现一个不可重入锁时，我们可以简单地认为 0 就代表未锁定，1就代表锁定，没有其他状态。代码如下：

```java
protected boolean tryAcquire(int acquires) {
    if (compareAndSetState(0, 1)) {
        owner = Thread.currentThread();
        return true;
    }
    return false;
}

protected boolean tryRelease(int releases) {
    if (Thread.currentThread() != owner) {
        throw new IllegalMonitorStateException();
    }
    owner = null;
    setState(0);
    return true;
}
```

### 独占锁和共享锁

独享锁也叫排他锁，是指该锁一次只能被一个线程所持有。如果线程T对数据A加上排它锁后，则其他线程不能再对A加任何类型的锁。获得排它锁的线程即能读数据又能修改数据。JDK中的synchronized和JUC中Lock的实现类就是互斥锁。

共享锁是指该锁可被多个线程所持有。如果线程T对数据A加上共享锁后，则其他线程只能对A再加共享锁，不能加排它锁。获得共享锁的线程只能读数据，不能修改数据。

独享锁与共享锁也是通过AQS来实现的，通过实现不同的方法，来实现独享或者共享。

在 ReentrantReadWriteLock 中，有两把锁，一个读锁，一个写锁，它们两个是对外暴露的接口。外层使用者需要使用不同的锁来达到不同的线程控制效果。

```java
public class ReentrantReadWriteLock
        implements ReadWriteLock, java.io.Serializable {
    /** Inner class providing readlock */
    private final ReentrantReadWriteLock.ReadLock readerLock;
    /** Inner class providing writelock */
    private final ReentrantReadWriteLock.WriteLock writerLock;
    /** Performs all synchronization mechanics */
    final Sync sync;
}

public interface ReadWriteLock {
    /**
     * Returns the lock used for reading.
     * @return the lock used for reading
     */
    Lock readLock();

    /**
     * Returns the lock used for writing.
     * @return the lock used for writing
     */
    Lock writeLock();
}
```

而无论是读锁，还是写锁，它们都是通过同一个 Sync 对象来进行控制的, 也就是 ReentrantReadWriteLock 对象中的 sync。

```java
public static class ReadLock implements Lock, java.io.Serializable {
    private static final long serialVersionUID = -5992448646407690164L;
    private final Sync sync;

    protected ReadLock(ReentrantReadWriteLock lock) {
        sync = lock.sync;
    }
}
public static class WriteLock implements Lock, java.io.Serializable {
    private static final long serialVersionUID = -4992448646407690164L;
    private final Sync sync;

    protected WriteLock(ReentrantReadWriteLock lock) {
        sync = lock.sync;
    }
}
```

既然在ReentrantReadWriteLock里面，读锁和写锁的锁主体都是Sync，但读锁和写锁的加锁方式不一样。读锁是共享锁，写锁是独享锁。读锁的共享锁可保证并发读非常高效，而读写、写读、写写的过程互斥，因为读锁和写锁是分离的。那读锁和写锁的具体加锁方式有什么区别呢？

这里我们先会回顾一下之前的互斥锁，当时我们使用到了 state字段（int类型，32位），该字段用来描述有多少线程获持有锁。在独享锁中这个值通常是0或者1（如果是重入锁的话state值就是重入的次数），在共享锁中state就是持有锁的数量。

但是在ReentrantReadWriteLock中有读、写两把锁，所以需要在一个整型变量state上分别描述读锁和写锁的数量（或者也可以叫状态）。于是将state变量“按位切割”切分成了两个部分，高16位表示读锁状态（读锁个数），低16位表示写锁状态（写锁个数）。如下图所示：

![[215a35d2-ff7c-4aed-8e49-2774dce36625.jpg|read-write-lock-use-state]]

read-write-lock-use-state

我们先来一下写锁的实现逻辑：

1. 首先获取当前的状态 state 值
2. 取状态值的后16位作为 writeState 值
3. 如果当前状态值 state 不为 0，则说明要么写锁被占用要么读锁被占用
	1. 如果 writeState 为 0，说明有读锁占用，获取锁失败，也就是说如果一个线程先获取读锁，再获取写锁的话，会发生死锁
		2. 如果 writeState 不为0，需要看一下当前线程和持有锁的线程是否是同一个线程，是的话就加锁成功（重入锁），否则加锁失败
4. 走到第四步说明 state 为空，这时候，检查 writerShouldBlock 它实际上是为了实现公平锁而出现的，
	1. 如果是公平锁 writerShouldBlock 的内容就是确认队列中有没有前驱节点
		2. 非公平锁则直接是 false
5. 如果第四步返回了false，就尝试进行 CAS 加锁，如果 CAS 失败，则加锁失败，否则加锁成功，将当前持有锁的线程置为当前线程。

protected final boolean tryAcquire(int acquires) {
    /*
     * 1. If read count nonzero or write count nonzero
     *    and owner is a different thread, fail.
     * 2. If count would saturate, fail. (This can only
     *    happen if count is already nonzero.)
     * 3. Otherwise, this thread is eligible for lock if
     *    it is either a reentrant acquire or
     *    queue policy allows it. If so, update state
```javascript
     */
    Thread current = Thread.currentThread();
    int c = getState();
    int w = exclusiveCount(c);
    if (c != 0) {
        // (Note: if c != 0 and w == 0 then shared count != 0)
        // w == 0 说明有线程持有读锁，w != 0 需要检查当前持有排它锁的线程是不是当前线程，不是的话就加锁失败
        if (w == 0 || current != getExclusiveOwnerThread())
            return false;
        // 当前线程重入，计数器增加
        if (w + exclusiveCount(acquires) > MAX_COUNT)
            throw new Error("Maximum lock count exceeded");
        // Reentrant acquire
        setState(c + acquires);
        return true;
    }
    if (writerShouldBlock() ||
        !compareAndSetState(c, c + acquires))
        return false;
    setExclusiveOwnerThread(current);
    return true;
}

static int exclusiveCount(int c) { return c & EXCLUSIVE_MASK; }

static final int EXCLUSIVE_MASK = (1 << SHARED_SHIFT) - 1;

static final int SHARED_SHIFT   = 16;

static final class NonfairSync extends Sync {
    final boolean writerShouldBlock() {
        return false; // writers can always barge
    }
}

static final class FairSync extends Sync {
    final boolean writerShouldBlock() {
        return hasQueuedPredecessors();
    }
}

```

ReentrantReadWriteLock 的tryAcquire()相较于 ReentrantLock 来说，除了重入条件（当前线程为获取了写锁的线程）之外，增加了一个读锁是否存在的判断。如果存在读锁，则写锁不能被获取，原因在于：必须确保写锁的操作对读锁可见，如果允许读锁在已被获取的情况下对写锁的获取，那么正在运行的其他读线程就无法感知到当前写线程的操作。


因此，只有等待其他读线程都释放了读锁，写锁才能被当前线程获取，而写锁一旦被获取，则其他读写线程的后续访问均被阻塞。写锁的释放与ReentrantLock的释放过程基本类似，每次释放均减少写状态，当写状态为0时表示写锁已被释放，然后等待的读写线程才能够继续访问读写锁，同时前次写线程的修改对后续的读写线程可见。

接下来，我们看一下读锁的实现：

1. 如果 writeState 不为0，并且持有该写锁的线程不是当前线程，则直接返回失败，否则尝试获得锁
	1. 如果先获得了写锁，再尝试获取读锁则不会发生死锁，这和前面的先获得读锁，再获得写锁不同，之所以这么设计可以参考文档：
		> Additionally, a writer can acquire the read lock, but not
		> vice-versa. Among other applications, reentrancy can be useful
		> when write locks are held during calls or callbacks to methods that
		> perform reads under read locks. If a reader tries to acquire the
		> write lock it will never succeed.
2. 接下来判断当前线程是否需要阻塞：
	1. 对于公平锁来说，只要队列中有前序节点则阻塞，因为只有读锁时，是不需要入队的，队列不为空，说明队列中存在或者存在过一个排它锁，这里直接入队等待
		2. 对于非公平锁来说，只要当前等待队列的第一个Waiter是排他锁，就阻塞，也就是下面的 apparentlyFirstQueuedIsExclusive 函数
3. 如果不需要阻塞，则判断重入次数是否溢出，没溢出的话就通过 CAS 修改 state 的共享锁部分，即前16位，每次增加 1<<16
4. 如果上述过程成功获得了锁，这里还有一道工序，就是保存当前线程的读锁持有数，本质上说通过一个 ThreadLocal 来保存这个读锁持有数即可，但是出于性能的考虑（ThreadLocal 性能不够好），这里另外增加了 firstReader 和 firstReaderHoldCount 来保存第一个获得读锁的线程重入数，此外还使用 cachedHoldCounter 来保存上一次调用时的线程的重入数，来达到加速的目的
5. 当上述过程仍然没有获得锁时，进入 fullTryAcquireShared 逻辑

protected final int tryAcquireShared(int unused) {
    /*
     * 1. If write lock held by another thread, fail.
     * 2. Otherwise, this thread is eligible for
     *    lock wrt state, so ask if it should block
     *    because of queue policy. If not, try
     *    to grant by CASing state and updating count.
     *    Note that step does not check for reentrant
     *    acquires, which is postponed to full version
     *    to avoid having to check hold count in
     *    the more typical non-reentrant case.
     * 3. If step 2 fails either because thread
     *    apparently not eligible or CAS fails or count
     *    saturated, chain to version with full retry loop.
```java
     */
    Thread current = Thread.currentThread();
    int c = getState();
    // 如果排它锁不为0，并且持有排它锁的线程不是当前线程，就返回
    if (exclusiveCount(c) != 0 &&
        getExclusiveOwnerThread() != current)
        return -1;
    int r = sharedCount(c);
    // 根据是不是公平锁，做出阻塞决定，读锁数是否溢出，检查通过的话通过 cas 加锁
    if (!readerShouldBlock() &&
```
        r < MAX_COUNT &&
```java
        compareAndSetState(c, c + SHARED_UNIT)) {
        if (r == 0) {
            firstReader = current;
            firstReaderHoldCount = 1;
        } else if (firstReader == current) {
            firstReaderHoldCount++;
        } else {
            HoldCounter rh = cachedHoldCounter;
            if (rh == null || rh.tid != getThreadId(current))
                cachedHoldCounter = rh = readHolds.get();
            else if (rh.count == 0)
                readHolds.set(rh);
            rh.count++;
        }
        return 1;
    }
    return fullTryAcquireShared(current);
}

/**
 * Returns {@code true} if the apparent first queued thread, if one
 * exists, is waiting in exclusive mode.  If this method returns
```
 * {@code true}, and the current thread is attempting to acquire in
 * shared mode (that is, this method is invoked from {@link
 * #tryAcquireShared}) then it is guaranteed that the current thread
 * is not the first queued thread.  Used only as a heuristic in
 * ReentrantReadWriteLock.
```java
 */
final boolean apparentlyFirstQueuedIsExclusive() {
    Node h, s;
    return (h = head) != null &&
```
        (s = h.next)  != null &&
        !s.isShared()         &&
```java
s.thread != null;
}

static final int SHARED_SHIFT   = 16;

static final int SHARED_UNIT    = (1 << SHARED_SHIFT);

static final class NonfairSync extends Sync {
    final boolean readerShouldBlock() {
        /* As a heuristic to avoid indefinite writer starvation,
            * block if the thread that momentarily appears to be head
            * of queue, if one exists, is a waiting writer.  This is
            * only a probabilistic effect since a new reader will not
            * block if there is a waiting writer behind other enabled
            * readers that have not yet drained from the queue.
            */
        return apparentlyFirstQueuedIsExclusive();
    }
}

/**
    * Fair version of Sync
    */
static final class FairSync extends Sync {
    final boolean readerShouldBlock() {
        return hasQueuedPredecessors();
    }
}
```

fullTryAcquireShared 主要用来处理 tryAcquireShared 中需要阻塞等待，或者 CAS 失败或者重入次数溢出的问题：

1. 整个 fullTryAcquireShared 就是一个循环 CAS 的过程
2. 如果发现写锁被占用，并且持有写锁的的进程不是当前线程，则获取锁失败
3. 然后检查是否需要阻塞（这里有一个额外的判断：如果当前线程是读锁重入，也不会进行阻塞）：
	1. 对于公平锁来说，只要队列中有前序节点则阻塞（说明之前有人成功获取过写锁，获取正在获取写锁，才会出现队列）
		2. 对于非公平锁来说，只要当前等待队列的第一个Waiter是排他锁，就阻塞，也就是上述的 apparentlyFirstQueuedIsExclusive 函数，这里大家可能会有一个疑问：为什么只判断队列头不是写锁即可，如果等待队列是 Read->Read->Write 不就有问题了吗（读锁插队写锁）, 确实会存在这个问题，apparentlyFirstQueuedIsExclusive 只能在一定程度上缓解读锁插队写锁的情况，因为并不是公平锁，所以没有必要完全保证读锁不能插队写锁
4. 处理外阻塞逻辑后，判断重入数是否溢出，溢出则抛出异常
5. 最后通过 CAS，进行 state 读锁段 + 1，修改成功的话，就维护当前线程的读锁持有数

```java
/**
 * Full version of acquire for reads, that handles CAS misses
 * and reentrant reads not dealt with in tryAcquireShared.
 */
final int fullTryAcquireShared(Thread current) {
    /*
     * This code is in part redundant with that in
     * tryAcquireShared but is simpler overall by not
     * complicating tryAcquireShared with interactions between
     * retries and lazily reading hold counts.
```
```javascript
     */
    HoldCounter rh = null;
    for (;;) {
        int c = getState();
        // 如果排它锁不为0，并且持有排它锁的线程不是当前线程，就返回
        if (exclusiveCount(c) != 0) {
            if (getExclusiveOwnerThread() != current)
                return -1;
            // else we hold the exclusive lock; blocking here
            // would cause deadlock.
        } else if (readerShouldBlock()) {
            // 如果当前线程获取过读锁，现在这次是读锁重入的话，就不进行阻塞，否则才会阻塞
            // Make sure we're not acquiring read lock reentrantly
            if (firstReader == current) {
                // assert firstReaderHoldCount > 0;
            } else {
                if (rh == null) {
                    rh = cachedHoldCounter;
                    if (rh == null || rh.tid != getThreadId(current)) {
                        rh = readHolds.get();
                        if (rh.count == 0)
                            readHolds.remove();
                    }
                }
                if (rh.count == 0)
                    return -1;
            }
        }
        // 读锁数是否溢出
        if (sharedCount(c) == MAX_COUNT)
            throw new Error("Maximum lock count exceeded");
        if (compareAndSetState(c, c + SHARED_UNIT)) {
            // 通过 cas 加锁, 然后维护读锁持有数
            if (sharedCount(c) == 0) {
                firstReader = current;
                firstReaderHoldCount = 1;
            } else if (firstReader == current) {
                firstReaderHoldCount++;
            } else {
                if (rh == null)
                    rh = cachedHoldCounter;
                if (rh == null || rh.tid != getThreadId(current))
                    rh = readHolds.get();
                else if (rh.count == 0)
                    readHolds.set(rh);
                rh.count++;
                cachedHoldCounter = rh; // cache for release
            }
            return 1;
        }
    }
}
```

看到这，大家一定有疑问，就是 Sync 的基类 AQS 到底是怎么实现的，我们在 AQS 之上基本上只是实现了 `tryAcquire` 接口，而且基本上都是通过 CAS 修改 state 来获取锁的，如果成功则返回true，如果失败则返回 false，那返回之后 AQS 根据返回值都会做出什么样的抉择呢？

### 死锁

当2个线程分别持有对方正在阻塞等待的资源时，它们两个线程会一直阻塞下去，这种情况一般称为死锁。就比如下面的例子:

```java
public class LockTest{
    public static void main(String[] args) {
        ReentrantLock lock1 = new ReentrantLock();
        ReentrantLock lock2 = new ReentrantLock();
        new Thread(new Runnable() {
            @Override
            public void run() {
                lock1.lock();
                try {
                    Thread.sleep(1000);
                    lock2.lock();
                    lock2.unlock();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                } finally {
                    lock1.unlock();
                }
            }
        }).start();
        new Thread(new Runnable() {
            @Override
            public void run() {
                lock2.lock();
                try {
                    Thread.sleep(1000);
                    lock1.lock();
                    lock1.unlock();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                } finally {
                    lock2.unlock();
                }
            }
        }).start();
    }
}
```

产生死锁必须具备以下四个条件：

- 互斥条件：该资源任意一个时刻只由一个线程占用。
- 请求与保持条件：一个进程因请求资源而阻塞时，对已获得的资源保持不放。
- 不剥夺条件: 线程已获得的资源在末使用完之前不能被其他线程强行剥夺，只有自己使用完毕后才释放资源。
- 循环等待条件: 若干进程之间形成一种头尾相接的循环等待资源关系。

那么如何避免死锁呢？我们只要破坏产生死锁的四个条件中的其中一个就可以了。

- 破坏互斥条件：可以通过CAS修改数据。
- 破坏请求与保持条件：一次性申请所有锁然后再执行后续流程，如果任何一个锁没有申请到，则解锁所有已经获得的锁。
- 破坏不剥夺条件：在获取不到某一锁时，我们可以尝试中断持有锁的线程，让其主动释放，不过这种方式也存在风险，需要对面保证数据的完整性。
- 破坏循环等待条件：靠按序申请资源来预防。按某一顺序申请资源，释放资源则反序释放。破坏循环等待条件。

## 参考内容

[1] [linux 2.6 互斥锁的实现-源码分析](https://www.jianshu.com/p/a7ddb2998b3b)
[2] [深入解析条件变量(condition variables)](https://www.cnblogs.com/harlanc/p/8596211.html)
[3] [Linux下Condition Vairable和Mutext合用的小细节](http://lday.me/2017/11/19/0017_condition_variable_and_mutex_together/)
[4] [从ReentrantLock的实现看AQS的原理及应用](https://tech.meituan.com/2019/12/05/aqs-theory-and-apply.html)
[5] [不可不说的Java“锁”事](https://mp.weixin.qq.com/s?__biz=MjM5NjQ5MTI5OA==&mid=2651749434&idx=3&sn=5ffa63ad47fe166f2f1a9f604ed10091&chksm=bd12a5778a652c61509d9e718ab086ff27ad8768586ea9b38c3dcf9e017a8e49bcae3df9bcc8&scene=38#wechat_redirect)
[6] [从源码层面解析yield、sleep、wait、park](https://juejin.im/post/5dfc31c5f265da33a7674376)
[7] [LockSupport中的park与unpark原理](https://cloud.tencent.com/developer/article/1460321)
[8] [Thread.sleep、Object.wait、LockSupport.park 区别](https://blog.csdn.net/u013332124/article/details/84647915)
[9] [从AQS到futex-二-JVM的Thread和Parker](http://kexianda.info/2017/08/16/%E5%B9%B6%E5%8F%91%E7%B3%BB%E5%88%97-4-%E4%BB%8EAQS%E5%88%B0futex-%E4%BA%8C-JVM%E7%9A%84Thread%E5%92%8CParker/)
[10] [Java的LockSupport.park()实现分析](https://blog.csdn.net/hengyunabc/article/details/28126139)
[11] [JVM源码分析之Object.wait/notify实现](https://www.jianshu.com/p/f4454164c017)
[12] [Java线程源码解析之interrupt](https://www.jianshu.com/p/1492434f2810)
[13] [Thread.interrupt()相关源码分析](http://www.fanyilun.me/2016/11/19/Thread.interrupt\(\)%E7%9B%B8%E5%85%B3%E6%BA%90%E7%A0%81%E5%88%86%E6%9E%90/)
[14] [Java CAS 原理剖析](https://juejin.im/post/5a73cbbff265da4e807783f5)
[15] [源码解析 Java 的 compareAndSwapObject 到底比较的是什么](https://blog.csdn.net/qq_40697071/article/details/103374783)
[16] 《Java并发编程的艺术》
[17] 《实战 Java 高并发程序设计》
[18] [volatile关键字深入学习](https://blog.nowcoder.net/n/6b9ccfdb9dac45bbbb9762b17c7c502a)
[19] [为什么Netty的FastThreadLocal速度快](https://juejin.im/post/5da45be5f265da5b86013552)
[20] [线程池ThreadPoolExecutor实现原理](https://juejin.im/post/5aeec0106fb9a07ab379574f)
[21] [深入理解Java线程池：ThreadPoolExecutor](http://www.ideabuffer.cn/2017/04/04/%E6%B7%B1%E5%85%A5%E7%90%86%E8%A7%A3Java%E7%BA%BF%E7%A8%8B%E6%B1%A0%EF%BC%9AThreadPoolExecutor/)
[22] [ConcurrentHashMap 详解一](https://yq.aliyun.com/articles/673765)
[23] [ConcurrentHashMap 详解二](https://yq.aliyun.com/articles/673766?spm=a2c4e.11153940.0.0.78e55ba9w7HT0v)
[24] [JUC中Atomic class之lazySet的一点疑惑](http://ifeve.com/juc-atomic-class-lazyset-que/)
[25] [The JSR-133 Cookbook for Compiler Writers](http://gee.cs.oswego.edu/dl/jmm/cookbook.html)
[26] [就是要你懂Java中volatile关键字实现原理](https://www.cnblogs.com/xrq730/p/7048693.html)

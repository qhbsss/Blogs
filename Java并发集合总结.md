[TOC]

# 自旋锁

自旋锁是互斥锁的一种实现，Java 实现如下方所示。

```
public class SpinLock {
    private AtomicReference<Thread> owner = new AtomicReference<Thread>();
    public void lock() {
        Thread currentThread = Thread.currentThread();
        // 如果锁未被占用，则设置当前线程为锁的拥有者
        while (!owner.compareAndSet(null, currentThread)) {
        }
    }
    public void unlock() {
        Thread currentThread = Thread.currentThread();
        // 只有锁的拥有者才能释放锁
        owner.compareAndSet(currentThread, null);
    }
}

```

如代码所示，获取锁时，线程会对一个原子变量循环执行 compareAndSet 方法，直到该方法返回成功时即为成功获取锁。compareAndSet 方法底层是通用 compare-and-swap （下称 CAS）实现的。该操作通过将内存中的值与指定数据进行比较，当数值一样时将内存中的数据替换为新的值。该操作是原子操作。原子性保证了根据最新信息计算出新值，如果与此同时值已由另一个线程更新，则写入将失败。因此，这段代码可以实现互斥锁的功能。

## 优缺点

**自旋锁适用于锁竞争不激烈、锁持有时间短的场景。**

自旋锁实现简单，同时避免了操作系统进程调度和线程上下文切换的开销，但他有两个缺点：

*   第一个是锁饥饿问题。在锁竞争激烈的情况下，可能存在一个线程一直被其他线程” 插队 “而一直获取不到锁的情况。
    
* 第二是性能问题。在实际的多处理上运行的自旋锁在锁竞争激烈时性能较差。

  >自旋锁锁状态中心化，在竞争激烈的情况下，锁状态变更会导致多个 CPU 的高速缓存的频繁同步，从而拖慢 CPU 效率
  >
  >n 个线程固定地执行一段临界区所需的时间。
  >
  >TASLock 和 TTASLock 与上文代码类似，都是针对一个原子状态变量轮询的自旋锁实现，最下面的曲线表示线程在没有干扰的情况下所需的时间。
  >
  >![](https://mmbiz.qpic.cn/mmbiz_png/YE1dmj1Pw7nrrNGMD7K9qS7a1xMIZLAQLpicTPLI0BEYWfwBSPiaQCvQdicsXAzeOKh62fNd5DEPM9iaibWMcke96Gw/640?wx_fmt=png)

# CLH锁

Craig, Landin, and Hagersten locks（下称 CLH 锁）

CLH 锁是对自旋锁的一种改进，有效的解决了自旋锁的两个缺点。首先它将线程组织成一个队列，保证先请求的线程先获得锁，避免了饥饿问题。其次锁状态去中心化，让每个线程在不同的状态变量中自旋，这样当一个线程释放它的锁时，只能使其后续线程的高速缓存失效，缩小了影响范围，从而减少了 CPU 的开销。

CLH 锁数据结构很简单，类似一个链表队列，所有请求获取锁的线程会排列在链表队列中，自旋访问队列中前一个节点的状态。当一个节点释放锁时，只有它的后一个节点才可以得到锁。CLH 锁本身有一个队尾指针 Tail，它是一个原子变量，指向队列最末端的 CLH 节点。每一个 CLH 节点有两个属性：所代表的线程和标识是否持有锁的状态变量。当一个线程要获取锁时，它会对 Tail 进行一个 getAndSet 的原子操作。该操作会返回 Tail 当前指向的节点，也就是当前队尾节点，然后使 Tail 指向这个线程对应的 CLH 节点，成为新的队尾节点。入队成功后，该线程会轮询上一个队尾节点的状态变量，当上一个节点释放锁后，它将得到这个锁。

下面用图来展示 CLH 锁从获取到释放锁的全过程。

![](https://mmbiz.qpic.cn/mmbiz_png/YE1dmj1Pw7nrrNGMD7K9qS7a1xMIZLAQHR0HXHH0nIm6LgSkKCVq54mVvYBmF2lcFUSQsAvxP5gmBstCOl6hPA/640?wx_fmt=png)

1.  CLH 锁初始化时会 Tail 会指向一个状态为 false 的空节点，如图 1 所示。
2.  当 Thread 1（下称 T1）请求获取锁时，Tail 节点指向 T1 对应的节点，同时返回空节点。T1 检查到上一个节点状态为 false，就成功获取到锁，可以执行相应的逻辑了，如图 2 所示。
3.  当 Thread 2（下称 T2）请求获取锁时，Tail 节点指向 T2 对应的节点，同时返回 T1 对应的节点。T2 检查到上一个节点状态为 True，无法获取到锁，于是开始轮询上一个节点的状态，如图 3 所示。
4.  当 T1 释放锁时，会将状态变量置为 False，如图 4 所示。
5.  T2 轮询到检查到上一个节点状态变为 False，则获取锁成功，如图 5 所示。

## CLH锁的Java实现

CLH 锁 Java 实现源码并分享并发编程的一些细节

![](https://mmbiz.qpic.cn/mmbiz_png/YE1dmj1Pw7nrrNGMD7K9qS7a1xMIZLAQe2ibdtQJTgaiccEGDPiaAYG4WhQyGa6TvjfSuRGArGpcvg27DoVbfKR1Q/640?wx_fmt=png)

代码如图所示，有三个地方需要关注，上图已用红框标记：

**1、节点中的状态变量为什么用 volatile 修饰？可以不用 volatile 吗？**

使用 volatile 修饰状态变量不是为了利用 volatile 的内存可见性，因为这个状态变量只会被持有该状态变量的线程写入，只会被队列中该线程的后驱节点对应的线程读，而且后者会轮询读取。因此，可见性问题不会影响锁的正确性。以上面的例子为例，T2 会不断轮询 T1 的状态变量，T1 将它的状态变更为 False 时 T2 没有立即感知也没有关系。该状态变量最终会写回内存并被 T2 终感知到变更后的值。

但要实现一个可以在多线程程序中正确执行的锁，还需要解决重排序问题。在《Java 并发编程实战》一书对于重排序问题是这么描述的：在没有同步的情况下，编译器、处理器以及运行时等都可能对操作的执行顺序进行一些意想不到的调整。在缺乏足够同步的多线程程序中，要想对内存操作的执行顺序进行判断，几乎无法得到正确的结论。对于 Java synchronized 关键字提供的内置锁 (又叫监视器)，Java Memory Model（下称 JMM）规范中有一条 Happens-Before（先行发生）规则：“一个监视器锁上的解锁发生在该监视器锁的后续锁定之前”，因此 JVM 会保证这条规则成立。

而自定义互斥锁就需要自己保证这一规则的成立，因此上述代码通过 volatile 的 Happens-Before（先行发生）规则来解决重排序问题。JMM 的 Happens-Before（先行发生）规则有一条针对 volatile 关键字的规则：“volatile 变量的写操作发生在该变量的后续读之前”。

**2、CLH 锁是一个链表队列，为什么 Node 节点没有指向前驱或后继指针呢？**

CLH 锁是一种隐式的链表队列，没有显式的维护前驱或后继指针。因为每个等待获取锁的线程只需要轮询前一个节点的状态就够了，而不需要遍历整个队列。在这种情况下，只需要使用一个局部变量保存前驱节点，而不需要显式的维护前驱或后继指针。

**3、this.node.set(new Node()) 这行代码有何意义？**

如果没有这行代码，Node 可能被复用，导致死锁，如下图所示：

![](https://mmbiz.qpic.cn/mmbiz_png/YE1dmj1Pw7nrrNGMD7K9qS7a1xMIZLAQOoiad1St2aYTXP2fdLEnHEAcUhvMaic0BqtGkEKYyuR5wMsaouMvJIkg/640?wx_fmt=png)

1. 一开始，T1 持有锁，T2 自旋等待，如图 1 开始。

2. 当 T1 释放锁（设置为 false），但此时 T2 尚未抢占到锁，如图 2 所示。

3. 此时如果 T1 再次调用 lock() 请求获取锁，会将状态设为 True，同时自旋等待 T2 释放锁。而 T2 也自旋等待前驱节点状态变为 False，这样就造成了死锁，如图 3 所示。

因此需要这行代码生成新的 Node 节点，避免 Node 节点复用带来的死锁。

## 优缺点
CLH 锁作为自旋锁的改进，有以下几个优点：

1.  性能优异，获取和释放锁开销小。CLH 的锁状态不再是单一的原子变量，而是分散在每个节点的状态中，降低了自旋锁在竞争激烈时频繁同步的开销。在释放锁的开销也因为不需要使用 CAS 指令而降低了。
2.  公平锁。先入队的线程会先得到锁。
3.  实现简单，易于理解。
4.  扩展性强。下面会提到 AQS 如何扩展 CLH 锁实现了 j.u.c 包下各类丰富的同步器。
    

当然，它也有两个缺点：第一是因为有自旋操作，当锁持有时间长时会带来较大的 CPU 开销。第二是基本的 CLH 锁功能单一，不改造不能支持复杂的功能。

##  AQS 对 CLH 队列锁的改造

针对 CLH 的缺点，AQS 对 CLH 队列锁进行了一定的改造。针对第一个缺点，**AQS 将自旋操作改为阻塞线程操作**。针对第二个缺点，AQS 对 CLH 锁进行改造和扩展，原作者 Doug Lea 称之为 “CLH 锁的变体”。下面将详细讲 AQS 底层细节以及对 CLH 锁的改进。AQS 中的对 CLH 锁数据结构的改进主要包括三方面：扩展每个节点的状态、显式的维护前驱节点和后继节点以及诸如出队节点显式设为 null 等辅助 GC 的优化。正是这些改进使 AQS 可以支撑 j.u.c 丰富多彩的同步器实现。

### 扩展每个节点的状态

AQS 每个节点的状态如下所示，在源码中如下所示：

```
volatile int waitStatus;
```

AQS 同样提供了该状态变量的原子读写操作，但和同步器状态不同的是，节点状态在 AQS 中被清晰的定义，如下表所示：

<table><tbody><tr><td width="124.33333333333331" valign="top" data-style="word-break: break-all; background-color: rgb(187, 187, 187);">状态名<br></td><td width="411" valign="top" data-style="word-break: break-all; background-color: rgb(187, 187, 187);">描述</td></tr><tr><td width="124.33333333333331" valign="top">SIGNAL</td><td width="411" valign="top">表示该节点正常等待</td></tr><tr><td width="124.33333333333331" valign="top">PROPAGATE</td><td width="411" valign="top">应将 releaseShared 传播到其他节点</td></tr><tr><td width="124.33333333333331" valign="top">CONDITION</td><td width="411" valign="top">该节点位于条件队列，不能用于同步队列节点</td></tr><tr><td width="124.33333333333331" valign="top">CANCELLED</td><td width="411" valign="top">由于超时、中断或其他原因，该节点被取消</td></tr></tbody></table>

### 显式的维护前驱节点和后继节点

上文我们提到在原始版本的 CLH 锁中，节点间甚至都没有互相链接。但是，通过在节点中显式地维护前驱节点，CLH 锁就可以处理 “超时” 和各种形式的“取消”：如果一个节点的前驱节点取消了，这个节点就可以滑动去使用前面一个节点的状态字段。对于通过自旋获取锁的 CLH 锁来说，只需要显式的维护前驱节点就可以实现取消功能，如下图所示：

![](https://mmbiz.qpic.cn/mmbiz_png/YE1dmj1Pw7nrrNGMD7K9qS7a1xMIZLAQiaj8Pg2LNUo5TndQK4kT6vOicgUFbCJbChYT5HIghTQrh9XEBQkib9ictw/640?wx_fmt=png)

但是在 AQS 的实现稍有不同。因为 AQS 用阻塞等待替换了自旋操作，线程会阻塞等待锁的释放，不能主动感知到前驱节点状态变化的信息。AQS 中显式的维护前驱节点和后继节点，需要释放锁的节点会显式通知下一个节点解除阻塞，如下图所示，T1 释放锁后主动唤醒 T2，使 T2 检测到锁已释放，获取锁成功。

![](https://mmbiz.qpic.cn/mmbiz_png/YE1dmj1Pw7nrrNGMD7K9qS7a1xMIZLAQj8nSrEuYVCRFF43VAkvGOjic3cWMP0LWQzom0lARp7JKo1yIvpMypfw/640?wx_fmt=png)

其中需要关注的一个细节是：由于没有针对双向链表节点的类似 compareAndSet 的原子性无锁插入指令，因此后驱节点的设置并非作为原子性插入操作的一部分，而仅是在节点被插入后简单地赋值。在释放锁时，如果当前节点的后驱节点不可用时，将从利用队尾指针 Tail 从尾部遍历到直到找到当前节点正确的后驱节点。

### 辅助 GC

JVM 的垃圾回收机制使开发者无需手动释放对象。但在 AQS 中需要在释放锁时显式的设置为 null，避免引用的残留，辅助垃圾回收。

# AQS

## AQS 框架：

![](https://p1.meituan.net/travelcube/82077ccf14127a87b77cefd1ccf562d3253591.png)

*   上图中有颜色的为 Method，无颜色的为 Attribution。

*   总的来说，AQS 框架共分为五层，自上而下由浅入深，从 AQS 对外暴露的 API 到底层基础数据。

*   当有自定义同步器接入时，只需重写第一层所需要的部分方法即可，不需要关注底层具体的实现流程。当自定义同步器进行加锁或者解锁操作时，先经过第一层的 API 进入 AQS 内部方法，然后经过第二层进行锁的获取，接着对于获取锁失败的流程，进入第三层和第四层的等待队列处理，而这些处理方式均依赖于第五层的基础数据提供层。

## 原理

AQS 核心思想是，如果被请求的共享资源空闲，那么就将当前请求资源的线程设置为有效的工作线程，将共享资源设置为锁定状态；如果共享资源被占用，就需要一定的阻塞等待唤醒机制来保证锁分配。这个机制主要用的是 CLH 队列的变体实现的，将暂时获取不到锁的线程加入到队列中。

CLH：Craig、Landin and Hagersten 队列，是单向链表，AQS 中的队列是 CLH 变体的虚拟双向队列（FIFO），AQS 是通过将每条请求共享资源的线程封装成一个节点来实现锁的分配。

主要原理图如下：

![](https://p0.meituan.net/travelcube/7132e4cef44c26f62835b197b239147b18062.png)

AQS 使用一个 Volatile 的 int 类型的成员变量来表示同步状态，通过内置的 FIFO 队列来完成资源获取的排队工作，通过 CAS 完成对 State 值的修改。

###  AQS 数据结构

先来看下 AQS 中最基本的数据结构——Node，Node 即为上面 CLH 变体队列中的节点。

![](https://p1.meituan.net/travelcube/960271cf2b5c8a185eed23e98b72c75538637.png)

解释一下几个方法和属性值的含义：

<table><thead><tr><th>方法和属性值</th><th>含义</th></tr></thead><tbody><tr><td>waitStatus</td><td>当前节点在队列中的状态</td></tr><tr><td>thread</td><td>表示处于该节点的线程</td></tr><tr><td>prev</td><td>前驱指针</td></tr><tr><td>predecessor</td><td>返回前驱节点，没有的话抛出 npe</td></tr><tr><td>nextWaiter</td><td>指向下一个处于 CONDITION 状态的节点（由于本篇文章不讲述 Condition Queue 队列，这个指针不多介绍）</td></tr><tr><td>next</td><td>后继指针</td></tr></tbody></table>

线程两种锁的模式：

<table><thead><tr><th>模式</th><th>含义</th></tr></thead><tbody><tr><td>SHARED</td><td>表示线程以共享的模式等待锁</td></tr><tr><td>EXCLUSIVE</td><td>表示线程正在以独占的方式等待锁</td></tr></tbody></table>

waitStatus 有下面几个枚举值：

<table><thead><tr><th>枚举</th><th>含义</th></tr></thead><tbody><tr><td>0</td><td>当一个 Node 被初始化的时候的默认值</td></tr><tr><td>CANCELLED</td><td>为 1，表示线程获取锁的请求已经取消了</td></tr><tr><td>CONDITION</td><td>为 - 2，表示节点在等待队列中，节点线程等待唤醒</td></tr><tr><td>PROPAGATE</td><td>为 - 3，当前线程处在 SHARED 情况下，该字段才会使用</td></tr><tr><td>SIGNAL</td><td>为 - 1，表示线程已经准备好了，就等资源释放了</td></tr></tbody></table>

### 同步状态 State

在了解数据结构后，接下来了解一下 AQS 的同步状态——State。AQS 中维护了一个名为 state 的字段，意为同步状态，是由 Volatile 修饰的，用于展示当前临界资源的获锁情况。

```
private volatile int state;
```

下面提供了几个访问这个字段的方法：

<table><thead><tr><th>方法名</th><th>描述</th></tr></thead><tbody><tr><td>protected final int getState()</td><td>获取 State 的值</td></tr><tr><td>protected final void setState(int newState)</td><td>设置 State 的值</td></tr><tr><td>protected final boolean compareAndSetState(int expect, int update)</td><td>使用 CAS 方式更新 State</td></tr></tbody></table>

这几个方法都是 Final 修饰的，说明子类中无法重写它们。我们可以通过修改 State 字段表示的同步状态来实现多线程的独占模式和共享模式（加锁过程）。

![](https://p0.meituan.net/travelcube/27605d483e8935da683a93be015713f331378.png) ![](https://p0.meituan.net/travelcube/3f1e1a44f5b7d77000ba4f9476189b2e32806.png)

对于我们自定义的同步工具，需要自定义获取同步状态和释放状态的方式，也就是 AQS 架构图中的第一层：API 层。

### Reentranlock中aqs的使用
ReentrantLock 中公平锁和非公平锁在底层是相同的，这里以非公平锁为例进行分析。

在非公平锁中，有一段这样的代码：

```
static final class NonfairSync extends Sync {
	...
	final void lock() {
		if (compareAndSetState(0, 1))
			setExclusiveOwnerThread(Thread.currentThread());
		else
			acquire(1);
	}
  ...
}


```

看一下这个 Acquire 是怎么写的：

```
public final void acquire(int arg) {
	if (!tryAcquire(arg) && acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
		selfInterrupt();
}


```

再看一下 tryAcquire 方法：

```
protected boolean tryAcquire(int arg) {
	throw new UnsupportedOperationException();
}


```

可以看出，这里只是 AQS 的简单实现，具体获取锁的实现方法是由各自的公平锁和非公平锁单独实现的（以 ReentrantLock 为例）。如果该方法返回了 True，则说明当前线程获取锁成功，就不用往后执行了；如果获取失败，就需要加入到等待队列中。

### 线程加入等待队列

#### 加入队列的时机

当执行 Acquire(1) 时，会通过 tryAcquire 获取锁。在这种情况下，如果获取锁失败，就会调用 addWaiter 加入到等待队列中去。

#### 如何加入队列

获取锁失败后，会执行 addWaiter(Node.EXCLUSIVE) 加入等待队列，具体实现方法如下：

```
private Node addWaiter(Node mode) {
	Node node = new Node(Thread.currentThread(), mode);
	
	Node pred = tail;
	if (pred != null) {
		node.prev = pred;
		if (compareAndSetTail(pred, node)) {
			pred.next = node;
			return node;
		}
	}
	enq(node);
	return node;
}
private final boolean compareAndSetTail(Node expect, Node update) {
	return unsafe.compareAndSwapObject(this, tailOffset, expect, update);
}


```

主要的流程如下：

*   通过当前的线程和锁模式新建一个节点。
    
*   Pred 指针指向尾节点 Tail。
    
*   将 New 中 Node 的 Prev 指针指向 Pred。
    
*   通过 compareAndSetTail 方法，完成尾节点的设置。这个方法主要是对 tailOffset 和 Expect 进行比较，如果 tailOffset 的 Node 和 Expect 的 Node 地址是相同的，那么设置 Tail 的值为 Update 的值。
    

```
static {
	try {
		stateOffset = unsafe.objectFieldOffset(AbstractQueuedSynchronizer.class.getDeclaredField("state"));
		headOffset = unsafe.objectFieldOffset(AbstractQueuedSynchronizer.class.getDeclaredField("head"));
		tailOffset = unsafe.objectFieldOffset(AbstractQueuedSynchronizer.class.getDeclaredField("tail"));
		waitStatusOffset = unsafe.objectFieldOffset(Node.class.getDeclaredField("waitStatus"));
		nextOffset = unsafe.objectFieldOffset(Node.class.getDeclaredField("next"));
	} catch (Exception ex) { 
    throw new Error(ex); 
  }
}


```

从 AQS 的静态代码块可以看出，都是获取一个对象的属性相对于该对象在内存当中的偏移量，这样我们就可以根据这个偏移量在对象内存当中找到这个属性。tailOffset 指的是 tail 对应的偏移量，所以这个时候会将 new 出来的 Node 置为当前队列的尾节点。同时，由于是双向链表，也需要将前一个节点指向尾节点。

*   如果 Pred 指针是 Null（说明等待队列中没有元素），或者当前 Pred 指针和 Tail 指向的位置不同（说明被别的线程已经修改），就需要看一下 Enq 的方法。

```
private Node enq(final Node node) {
	for (;;) {
		Node t = tail;
		if (t == null) { 
			if (compareAndSetHead(new Node()))
				tail = head;
		} else {
			node.prev = t;
			if (compareAndSetTail(t, node)) {
				t.next = node;
				return t;
			}
		}
	}
}


```

如果没有被初始化，需要进行初始化一个头结点出来。但请注意，初始化的头结点并不是当前线程节点，而是调用了无参构造函数的节点。如果经历了初始化或者并发导致队列中有元素，则与之前的方法相同。其实，addWaiter 就是一个在双端链表添加尾节点的操作，需要注意的是，双端链表的头结点是一个无参构造函数的头结点。

总结一下，线程获取锁的时候，过程大体如下：

1.  当没有线程获取到锁时，线程 1 获取锁成功。
    
2.  线程 2 申请锁，但是锁被线程 1 占有。
    

![](https://p0.meituan.net/travelcube/e9e385c3c68f62c67c8d62ab0adb613921117.png)

1.  如果再有线程要获取锁，依次在队列中往后排队即可。

回到上边的代码，hasQueuedPredecessors 是公平锁加锁时判断等待队列中是否存在有效节点的方法。如果返回 False，说明当前线程可以争取共享资源；如果返回 True，说明队列中存在有效节点，当前线程必须加入到等待队列中。

```
public final boolean hasQueuedPredecessors() {
	
	
	
	Node t = tail; 
	Node h = head;
	Node s;
	return h != t && ((s = h.next) == null || s.thread != Thread.currentThread());
}


```

看到这里，我们理解一下 h != t && ((s = h.next) == null || s.thread != Thread.currentThread()); 为什么要判断的头结点的下一个节点？第一个节点储存的数据是什么？

> 双向链表中，第一个节点为虚节点，其实并不存储任何信息，只是占位。真正的第一个有数据的节点，是在第二个节点开始的。当 h != t 时： 如果 (s = h.next) == null，等待队列正在有线程进行初始化，但只是进行到了 Tail 指向 Head，没有将 Head 指向 Tail，此时队列中有元素，需要返回 True（这块具体见下边代码分析）。 如果 (s = h.next) != null，说明此时队列中至少有一个有效节点。如果此时 s.thread == Thread.currentThread()，说明等待队列的第一个有效节点中的线程与当前线程相同，那么当前线程是可以获取资源的；如果 s.thread != Thread.currentThread()，说明等待队列的第一个有效节点线程与当前线程不同，当前线程必须加入进等待队列。

```
if (t == null) { 
	if (compareAndSetHead(new Node()))
		tail = head;
} else {
	node.prev = t;
	if (compareAndSetTail(t, node)) {
		t.next = node;
		return t;
	}
}


```

节点入队不是原子操作，所以会出现短暂的 head != tail，此时 Tail 指向最后一个节点，而且 Tail 指向 Head。如果 Head 没有指向 Tail（可见 5、6、7 行），这种情况下也需要将相关线程加入队列中。所以这块代码是为了解决极端情况下的并发问题。

#### 等待队列中线程出队列时机

回到最初的源码：

```
public final void acquire(int arg) {
	if (!tryAcquire(arg) && acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
		selfInterrupt();
}


```

上文解释了 addWaiter 方法，这个方法其实就是把对应的线程以 Node 的数据结构形式加入到双端队列里，返回的是一个包含该线程的 Node。而这个 Node 会作为参数，进入到 acquireQueued 方法中。acquireQueued 方法可以对排队中的线程进行 “获锁” 操作。

总的来说，一个线程获取锁失败了，被放入等待队列，acquireQueued 会把放入队列中的线程不断去获取锁，直到获取成功或者不再需要获取（中断）。

下面我们从 “何时出队列？” 和“如何出队列？”两个方向来分析一下 acquireQueued 源码：

```
final boolean acquireQueued(final Node node, int arg) {
	
	boolean failed = true;
	try {
		
		boolean interrupted = false;
		
		for (;;) {
			
			final Node p = node.predecessor();
			
			if (p == head && tryAcquire(arg)) {
				
				setHead(node);
				p.next = null; 
				failed = false;
				return interrupted;
			}
			
			if (shouldParkAfterFailedAcquire(p, node) && parkAndCheckInterrupt())
				interrupted = true;
		}
	} finally {
		if (failed)
			cancelAcquire(node);
	}
}


```

注：setHead 方法是把当前节点置为虚节点，但并没有修改 waitStatus，因为它是一直需要用的数据。

```
private void setHead(Node node) {
	head = node;
	node.thread = null;
	node.prev = null;
}




private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
	
	int ws = pred.waitStatus;
	
	if (ws == Node.SIGNAL)
		return true; 
	
	if (ws > 0) {
		do {
			
			node.prev = pred = pred.prev;
		} while (pred.waitStatus > 0);
		pred.next = node;
	} else {
		
		compareAndSetWaitStatus(pred, ws, Node.SIGNAL);
	}
	return false;
}


```

parkAndCheckInterrupt 主要用于挂起当前线程，阻塞调用栈，返回当前线程的中断状态。

```
private final boolean parkAndCheckInterrupt() {
    LockSupport.park(this);
    return Thread.interrupted();
}


```

上述方法的流程图如下：

![](https://p0.meituan.net/travelcube/c124b76dcbefb9bdc778458064703d1135485.png)

从上图可以看出，跳出当前循环的条件是当 “前置节点是头结点，且当前线程获取锁成功”。为了防止因死循环导致 CPU 资源被浪费，我们会判断前置节点的状态来决定是否要将当前线程挂起，具体挂起流程用流程图表示如下（shouldParkAfterFailedAcquire 流程）：

![](https://p0.meituan.net/travelcube/9af16e2481ad85f38ca322a225ae737535740.png)

从队列中释放节点的疑虑打消了，那么又有新问题了：

*   shouldParkAfterFailedAcquire 中取消节点是怎么生成的呢？什么时候会把一个节点的 waitStatus 设置为 - 1？
    
*   是在什么时间释放节点通知到被挂起的线程呢？
    

### CANCELLED 状态节点生成

acquireQueued 方法中的 Finally 代码：

```
final boolean acquireQueued(final Node node, int arg) {
	boolean failed = true;
	try {
    ...
		for (;;) {
			final Node p = node.predecessor();
			if (p == head && tryAcquire(arg)) {
				...
				failed = false;
        ...
			}
			...
	} finally {
		if (failed)
			cancelAcquire(node);
		}
}


```

通过 cancelAcquire 方法，将 Node 的状态标记为 CANCELLED。接下来，我们逐行来分析这个方法的原理：

```
private void cancelAcquire(Node node) {
  
	if (node == null)
		return;
  
	node.thread = null;
	Node pred = node.prev;
  
	while (pred.waitStatus > 0)
		node.prev = pred = pred.prev;
  
	Node predNext = pred.next;
  
	node.waitStatus = Node.CANCELLED;
  
  
	if (node == tail && compareAndSetTail(node, pred)) {
		compareAndSetNext(pred, predNext, null);
	} else {
		int ws;
    
    
    
		if (pred != head && ((ws = pred.waitStatus) == Node.SIGNAL || (ws <= 0 && compareAndSetWaitStatus(pred, ws, Node.SIGNAL))) && pred.thread != null) {
			Node next = node.next;
			if (next != null && next.waitStatus <= 0)
				compareAndSetNext(pred, predNext, next);
		} else {
      
			unparkSuccessor(node);
		}
		node.next = node; 
	}
}


```

当前的流程：

*   获取当前节点的前驱节点，如果前驱节点的状态是 CANCELLED，那就一直往前遍历，找到第一个 waitStatus <= 0 的节点，将找到的 Pred 节点和当前 Node 关联，将当前 Node 设置为 CANCELLED。
    
*   根据当前节点的位置，考虑以下三种情况：
    

(1) 当前节点是尾节点。

(2) 当前节点是 Head 的后继节点。

(3) 当前节点不是 Head 的后继节点，也不是尾节点。

根据上述第二条，我们来分析每一种情况的流程。

当前节点是尾节点。

![](https://p1.meituan.net/travelcube/b845211ced57561c24f79d56194949e822049.png)

当前节点是 Head 的后继节点。

![](https://p1.meituan.net/travelcube/ab89bfec875846e5028a4f8fead32b7117975.png)

当前节点不是 Head 的后继节点，也不是尾节点。

![](https://p0.meituan.net/travelcube/45d0d9e4a6897eddadc4397cf53d6cd522452.png)

通过上面的流程，我们对于 CANCELLED 节点状态的产生和变化已经有了大致的了解，但是为什么所有的变化都是对 Next 指针进行了操作，而没有对 Prev 指针进行操作呢？什么情况下会对 Prev 指针进行操作？

> 执行 cancelAcquire 的时候，当前节点的前置节点可能已经从队列中出去了（已经执行过 Try 代码块中的 shouldParkAfterFailedAcquire 方法了），如果此时修改 Prev 指针，有可能会导致 Prev 指向另一个已经移除队列的 Node，因此这块变化 Prev 指针不安全。 shouldParkAfterFailedAcquire 方法中，会执行下面的代码，其实就是在处理 Prev 指针。shouldParkAfterFailedAcquire 是获取锁失败的情况下才会执行，进入该方法后，说明共享资源已被获取，当前节点之前的节点都不会出现变化，因此这个时候变更 Prev 指针比较安全。
> 
> ```
> do {
> 	node.prev = pred = pred.prev;
> } while (pred.waitStatus > 0);
> 
> 
> ```

### 如何解锁

我们已经剖析了加锁过程中的基本流程，接下来再对解锁的基本流程进行分析。由于 ReentrantLock 在解锁的时候，并不区分公平锁和非公平锁，所以我们直接看解锁的源码：

```
public void unlock() {
	sync.release(1);
}


```

可以看到，本质释放锁的地方，是通过框架来完成的。

```
public final boolean release(int arg) {
	if (tryRelease(arg)) {
		Node h = head;
		if (h != null && h.waitStatus != 0)
			unparkSuccessor(h);
		return true;
	}
	return false;
}


```

在 ReentrantLock 里面的公平锁和非公平锁的父类 Sync 定义了可重入锁的释放锁机制。

```
protected final boolean tryRelease(int releases) {
	
	int c = getState() - releases;
	
	if (Thread.currentThread() != getExclusiveOwnerThread())
		throw new IllegalMonitorStateException();
	boolean free = false;
	
	if (c == 0) {
		free = true;
		setExclusiveOwnerThread(null);
	}
	setState(c);
	return free;
}


```

我们来解释下述源码：

```
public final boolean release(int arg) {
	
	if (tryRelease(arg)) {
		
		Node h = head;
		
		if (h != null && h.waitStatus != 0)
			unparkSuccessor(h);
		return true;
	}
	return false;
}


```

这里的判断条件为什么是 h != null && h.waitStatus != 0？

> h == null Head 还没初始化。初始情况下，head == null，第一个节点入队，Head 会被初始化一个虚拟节点。所以说，这里如果还没来得及入队，就会出现 head == null 的情况。
> 
> h != null && waitStatus == 0 表明后继节点对应的线程仍在运行中，不需要唤醒。
> 
> h != null && waitStatus < 0 表明后继节点可能被阻塞了，需要唤醒。

再看一下 unparkSuccessor 方法：

```
private void unparkSuccessor(Node node) {
	
	int ws = node.waitStatus;
	if (ws < 0)
		compareAndSetWaitStatus(node, ws, 0);
	
	Node s = node.next;
	
	if (s == null || s.waitStatus > 0) {
		s = null;
		
		for (Node t = tail; t != null && t != node; t = t.prev)
			if (t.waitStatus <= 0)
				s = t;
	}
	
	if (s != null)
		LockSupport.unpark(s.thread);
}


```

为什么要从后往前找第一个非 Cancelled 的节点呢？原因如下。

之前的 addWaiter 方法：

```
private Node addWaiter(Node mode) {
	Node node = new Node(Thread.currentThread(), mode);
	
	Node pred = tail;
	if (pred != null) {
		node.prev = pred;
		if (compareAndSetTail(pred, node)) {
			pred.next = node;
			return node;
		}
	}
	enq(node);
	return node;
}


```

我们从这里可以看到，节点入队并不是原子操作，也就是说，node.prev = pred; compareAndSetTail(pred, node) 这两个地方可以看作 Tail 入队的原子操作，但是此时 pred.next = node; 还没执行，如果这个时候执行了 unparkSuccessor 方法，就没办法从前往后找了，所以需要从后往前找。还有一点原因，在产生 CANCELLED 状态节点的时候，先断开的是 Next 指针，Prev 指针并未断开，因此也是必须要从后往前遍历才能够遍历完全部的 Node。

综上所述，如果是从前往后找，由于极端情况下入队的非原子操作和 CANCELLED 节点产生过程中断开 Next 指针的操作，可能会导致无法遍历所有的节点。所以，唤醒对应的线程后，对应的线程就会继续往下执行。继续执行 acquireQueued 方法以后，中断如何处理？

### 中断恢复后的执行流程

唤醒后，会执行 return Thread.interrupted();，这个函数返回的是当前执行线程的中断状态，并清除。

```
private final boolean parkAndCheckInterrupt() {
	LockSupport.park(this);
	return Thread.interrupted();
}


```

再回到 acquireQueued 代码，当 parkAndCheckInterrupt 返回 True 或者 False 的时候，interrupted 的值不同，但都会执行下次循环。如果这个时候获取锁成功，就会把当前 interrupted 返回。

```
final boolean acquireQueued(final Node node, int arg) {
	boolean failed = true;
	try {
		boolean interrupted = false;
		for (;;) {
			final Node p = node.predecessor();
			if (p == head && tryAcquire(arg)) {
				setHead(node);
				p.next = null; 
				failed = false;
				return interrupted;
			}
			if (shouldParkAfterFailedAcquire(p, node) && parkAndCheckInterrupt())
				interrupted = true;
			}
	} finally {
		if (failed)
			cancelAcquire(node);
	}
}


```

如果 acquireQueued 为 True，就会执行 selfInterrupt 方法。

```
static void selfInterrupt() {
	Thread.currentThread().interrupt();
}


```

该方法其实是为了中断线程。但为什么获取了锁以后还要中断线程呢？这部分属于 Java 提供的协作式中断知识内容，感兴趣同学可以查阅一下。这里简单介绍一下：

1.  当中断线程被唤醒时，并不知道被唤醒的原因，可能是当前线程在等待中被中断，也可能是释放了锁以后被唤醒。因此我们通过 Thread.interrupted() 方法检查中断标记（该方法返回了当前线程的中断状态，并将当前线程的中断标识设置为 False），并记录下来，如果发现该线程被中断过，就再中断一次。
    
2.  线程在等待资源的过程中被唤醒，唤醒后还是会不断地去尝试获取锁，直到抢到锁为止。也就是说，在整个流程中，并不响应中断，只是记录中断记录。最后抢到锁返回了，那么如果被中断过的话，就需要补充一次中断。
    

这里的处理方式主要是运用线程池中基本运作单元 Worder 中的 runWorker，通过 Thread.interrupted() 进行额外的判断处理，感兴趣的同学可以看下 ThreadPoolExecutor 源码。

># ReentrantLock的公平锁与非公平锁
>公平锁是指多个线程按照申请锁的顺序来获取锁，线程直接进入队列中排队，队列中的第一个线程才能获得锁。公平锁的优点是等待锁的线程不会饿死。缺点是整体吞吐效率相对非公平锁要低，等待队列中除第一个线程以外的所有线程都会阻塞，CPU唤醒阻塞线程的开销比非公平锁大。
>非公平锁是多个线程加锁时直接尝试获取锁，获取不到才会到等待队列的队尾等待。但如果此时锁刚好可用，那么这个线程可以无需阻塞直接获取到锁，所以非公平锁有可能出现后申请锁的线程先获取锁的场景。非公平锁的优点是可以减少唤起线程的开销，整体的吞吐效率高，因为线程有几率不阻塞直接获得锁，CPU不必唤醒所有线程。缺点是处于等待队列中的线程可能会饿死，或者等很久才会获得锁。
>
>![图片](https://mmbiz.qpic.cn/mmbiz_jpg/hEx03cFgUsUWxF3IJSFicIicbpueYm7MoKy8L55ZOKDI0tnRw74XvTR0sUgzceubtjkxMC3awlEdVqzu1YUqvEAA/640?wx_fmt=jpeg&tp=webp&wxfrom=10005&wx_lazy=1&wx_co=1)
>
>ReentrantLock里面有一个内部类Sync，Sync继承AQS（AbstractQueuedSynchronizer），添加锁和释放锁的大部分操作实际上都是在Sync中实现的。它有公平锁FairSync和非公平锁NonfairSync两个子类。ReentrantLock默认使用非公平锁，也可以通过构造器来显示的指定使用公平锁。
>
>![图片](https://mmbiz.qpic.cn/mmbiz_png/hEx03cFgUsXibicYtRt824nicRjKGTibicl7aN2r1YicfsKWuibcdJ2996VOlslIwgpwtjYEwCdS9M0WVusy8xL8XGOqg/640?wx_fmt=png&tp=webp&wxfrom=10005&wx_lazy=1&wx_co=1)
>
>公平锁与非公平锁的lock()方法唯一的区别就在于公平锁在获取同步状态时多了一个限制条件：hasQueuedPredecessors()。
>
>![图片](https://mmbiz.qpic.cn/mmbiz_jpg/hEx03cFgUsUWxF3IJSFicIicbpueYm7MoKQAjz6G48LnP2yzfA1ZbSUMBic1dBMyxMian5oSW0fYz7CwXNS6zGxLZg/640?wx_fmt=jpeg&tp=webp&wxfrom=10005&wx_lazy=1&wx_co=1)
>
>再进入hasQueuedPredecessors()，可以看到该方法主要做一件事情：主要是判断当前线程是否位于同步队列中的第一个。如果是则返回true，否则返回false。
>
>综上，公平锁就是通过同步队列来实现多个线程按照申请锁的顺序来获取锁，从而实现公平的特性。非公平锁加锁时不考虑排队等待问题，直接尝试获取锁，所以存在后申请却先获得锁的情况。

# ReentrantLock

`ReentrantLock` 实现了 `Lock` 接口，是一个可重入且独占式的锁，和 `synchronized` 关键字类似。不过，`ReentrantLock` 更灵活、更强大，增加了轮询、超时、中断、公平锁和非公平锁等高级功能。

`ReentrantLock` 里面有一个内部类 `Sync`，`Sync` 继承 AQS（`AbstractQueuedSynchronizer`），添加锁和释放锁的大部分操作实际上都是在 `Sync` 中实现的。`Sync` 有公平锁 `FairSync` 和非公平锁 `NonfairSync` 两个子类。

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesreentrantlock-class-diagram.png)

## 公平锁和非公平锁区别

- **公平锁** : 锁被释放之后，先申请的线程先得到锁。性能较差一些，因为公平锁为了保证时间上的绝对顺序，上下文切换更频繁。
- **非公平锁**：锁被释放之后，后申请的线程可能会先获取到锁，是随机或者按照其他优先级排序的。性能更好，但可能会导致某些线程永远无法获取到锁。
## ReentrantLock 比 synchronized 增加的一些高级功能
相比synchronized，ReentrantLock增加了一些高级功能。主要来说主要有三点：
- 等待可中断 : ReentrantLock提供了一种能够中断等待锁的线程的机制，通过 lock.lockInterruptibly() 来实现这个机制。也就是说正在等待的线程可以选择放弃等待，改为处理其他事情。
- 可实现公平锁 : ReentrantLock可以指定是公平锁还是非公平锁。而synchronized只能是非公平锁。所谓的公平锁就是先等待的线程先获得锁。ReentrantLock默认情况是非公平的，可以通过 ReentrantLock类的ReentrantLock(boolean fair)构造方法来指定是否是公平的。
- 可实现选择性通知（锁可以绑定多个条件）: synchronized关键字与wait()和notify()/notifyAll()方法相结合可以实现等待/通知机制。ReentrantLock类当然也可以实现，但是需要借助于Condition接口与newCondition()方法。
>Condition是 JDK1.5 之后才有的，它具有很好的灵活性，比如可以实现多路通知功能也就是在一个Lock对象中可以创建多个Condition实例（即对象监视器），线程对象可以注册在指定的Condition中，从而可以有选择性的进行线程通知，在调度线程上更加灵活。 在使用notify()/notifyAll()方法进行通知时，被通知的线程是由 JVM 选择的，用ReentrantLock类结合Condition实例可以实现“选择性通知” ，这个功能非常重要，而且是 Condition 接口默认提供的。而synchronized关键字就相当于整个 Lock 对象中只有一个Condition实例，所有的线程都注册在它一个身上。如果执行notifyAll()方法的话就会通知所有处于等待状态的线程，这样会造成很大的效率问题。而Condition实例的signalAll()方法，只会唤醒注册在该Condition实例中的所有等待线程。

## 可中断锁和不可中断锁区别
可中断锁：获取锁的过程中可以被中断，不需要一直等到获取锁之后 才能进行其他逻辑处理。ReentrantLock 就属于是可中断锁。
不可中断锁：一旦线程申请了锁，就只能等到拿到锁以后才能进行其他的逻辑处理。 synchronized 就属于是不可中断锁。
## ReentrantLock 条件变量使用
**ReentrantLock 类 API**

*   `Condition newCondition()`: 创建条件变量对象

**Condition 类 API**

*   `void await()`: 当前线程从运行状态进入等待状态，同时释放锁，该方法可以被中断
*   `void awaitUninterruptibly()`：当前线程从运行状态进入等待状态，该方法不能够被中断
*   `void signal()`: 唤醒一个等待在 Condition 条件队列上的线程
*   `void signalAll()`: 唤醒阻塞在条件队列上的所有线程
### await 过程

1.  线程 0（Thread-0）一开始获取锁，exclusiveOwnerThread 字段是 Thread-0, 如下图中的深蓝色节点

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesbd150fc02b55479388f05f0d4fe54644%7Etplv-k3u1fbpfcp-zoom-in-crop-mark%3A1512%3A0%3A0%3A0.awebp)

2.  Thread-0 调用 await 方法，Thread-0 封装成 Node 进入 ConditionObject 的队列，因为此时只有一个节点，所有 firstWaiter 和 lastWaiter 都指向 Thread-0，会释放锁资源，NofairSync 中的 state 会变成 0，同时 exclusiveOwnerThread 设置为 null。如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/17f6535fa51e4071baa1c15e9f05c740~tplv-k3u1fbpfcp-zoom-in-crop-mark:1512:0:0:0.awebp)

3.  线程 1（Thread-1）被唤醒，重新获取锁，如下图的深蓝色节点所示。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures9528ba34eb9d4919a6940c0eebf0d561%7Etplv-k3u1fbpfcp-zoom-in-crop-mark%3A1512%3A0%3A0%3A0.awebp)

4.  Thread-0 被 park 阻塞，如下图灰色节点所示：

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesd801403e01e54746b61652d1ae4253e4~tplv-k3u1fbpfcp-zoom-in-crop-mark%3A1512%3A0%3A0%3A0.awebp)

**源码如下：**

*   下面是 await() 方法的整体流程，其中`LockSupport.park(this)`进行阻塞当前线程，后续唤醒，也会在这个程序点恢复执行。

```
public final void await() throws InterruptedException {
     // 判断当前线程是否是中断状态，是就直接给个中断异常
    if (Thread.interrupted())
        throw new InterruptedException();
    // 将调用 await 的线程包装成 Node，添加到条件队列并返回
    Node node = addConditionWaiter();
    // 完全释放节点持有的锁，因为其他线程唤醒当前线程的前提是【持有锁】
    int savedState = fullyRelease(node);
    
    // 设置打断模式为没有被打断，状态码为 0
    int interruptMode = 0;
    
    // 如果该节点还没有转移至 AQS 阻塞队列, park 阻塞，等待进入阻塞队列
    while (!isOnSyncQueue(node)) {
        // 阻塞当前线程，待会
        LockSupport.park(this);
        // 如果被打断，退出等待队列，对应的 node 【也会被迁移到阻塞队列】尾部，状态设置为 0
        if ((interruptMode = checkInterruptWhileWaiting(node)) != 0)
            break;
    }
    // 逻辑到这说明当前线程退出等待队列，进入【阻塞队列】
    
    // 尝试枪锁，释放了多少锁就【重新获取多少锁】，获取锁成功判断打断模式
    if (acquireQueued(node, savedState) && interruptMode != THROW_IE)
        interruptMode = REINTERRUPT;
    
    // node 在条件队列时 如果被外部线程中断唤醒，会加入到阻塞队列，但是并未设 nextWaiter = null
    if (node.nextWaiter != null)
        // 清理条件队列内所有已取消的 Node
        unlinkCancelledWaiters();
    // 条件成立说明挂起期间发生过中断
    if (interruptMode != 0)
        // 应用打断模式
        reportInterruptAfterWait(interruptMode);
}


```

*   将线程封装成 Node, 加入到 ConditionObject 队列尾部，此时节点的等待状态时 - 2。

```
private Node addConditionWaiter() {
    // 获取当前条件队列的尾节点的引用，保存到局部变量 t 中
    Node t = lastWaiter;
    // 当前队列中不是空，并且节点的状态不是 CONDITION（-2），说明当前节点发生了中断
    if (t != null && t.waitStatus != Node.CONDITION) {
        // 清理条件队列内所有已取消的 Node
        unlinkCancelledWaiters();
        // 清理完成重新获取 尾节点 的引用
        t = lastWaiter;
    }
    // 创建一个关联当前线程的新 node, 设置状态为 CONDITION(-2)，添加至队列尾部
    Node node = new Node(Thread.currentThread(), Node.CONDITION);
    if (t == null)
        firstWaiter = node;		// 空队列直接放在队首【不用CAS因为执行线程是持锁线程，并发安全】
    else
        t.nextWaiter = node;	// 非空队列队尾追加
    lastWaiter = node;			// 更新队尾的引用
    return node;
}


```

*   清理条件队列中的 cancel 类型的节点，比如中断、超时等会导致节点转换为 Cancel

```
// 清理条件队列内所有已取消（不是CONDITION）的 node，【链表删除的逻辑】
private void unlinkCancelledWaiters() {
    // 从头节点开始遍历【FIFO】
    Node t = firstWaiter;
    // 指向正常的 CONDITION 节点
    Node trail = null;
    // 等待队列不空
    while (t != null) {
        // 获取当前节点的后继节点
        Node next = t.nextWaiter;
        // 判断 t 节点是不是 CONDITION 节点，条件队列内不是 CONDITION 就不是正常的
        if (t.waitStatus != Node.CONDITION) { 
            // 不是正常节点，需要 t 与下一个节点断开
            t.nextWaiter = null;
            // 条件成立说明遍历到的节点还未碰到过正常节点
            if (trail == null)
                // 更新 firstWaiter 指针为下个节点
                firstWaiter = next;
            else
                // 让上一个正常节点指向 当前取消节点的 下一个节点，【删除非正常的节点】
                trail.nextWaiter = next;
            // t 是尾节点了，更新 lastWaiter 指向最后一个正常节点
            if (next == null)
                lastWaiter = trail;
        } else {
            // trail 指向的是正常节点 
            trail = t;
        }
        // 把 t.next 赋值给 t，循环遍历
        t = next; 
    }
}


```

*   fullyRelease 方法将 r 让 Thread-0 释放锁, 这个时候 Thread-1 就会去竞争锁

```
// 线程可能重入，需要将 state 全部释放
final int fullyRelease(Node node) {
    // 完全释放锁是否成功，false 代表成功
    boolean failed = true;
    try {
        // 获取当前线程所持有的 state 值总数
        int savedState = getState();
        // release -> tryRelease 解锁重入锁
        if (release(savedState)) {
            // 释放成功
            failed = false;
            // 返回解锁的深度
            return savedState;
        } else {
            // 解锁失败抛出异常
            throw new IllegalMonitorStateException();
        }
    } finally {
        // 没有释放成功，将当前 node 设置为取消状态
        if (failed)
            node.waitStatus = Node.CANCELLED;
    }
}


```

*   判断节点是否在 AQS 阻塞对列中，不在条件对列中

```
final boolean isOnSyncQueue(Node node) {
    // node 的状态是 CONDITION，signal 方法是先修改状态再迁移，所以前驱节点为空证明还【没有完成迁移】
    if (node.waitStatus == Node.CONDITION || node.prev == null)
        return false;
    // 说明当前节点已经成功入队到阻塞队列，且当前节点后面已经有其它 node，因为条件队列的 next 指针为 null
    if (node.next != null)
        return true;
	// 说明【可能在阻塞队列，但是是尾节点】
    // 从阻塞队列的尾节点开始向前【遍历查找 node】，如果查找到返回 true，查找不到返回 false
    return findNodeFromTail(node);
}


```

### signal 过程

1.  Thread-1 执行 signal 方法唤醒条件队列中的第一个节点，即 Thread-0，条件队列置空

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesf95b8f94d3484e479464cdf2fa8c2d1b%7Etplv-k3u1fbpfcp-zoom-in-crop-mark%3A1512%3A0%3A0%3A0.awebp)

2.  Thread-0 的节点的等待状态变更为 0， 重新加入到 AQS 队列尾部。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesd92a7bb21ed348c59a7f8b85d48d8de5%7Etplv-k3u1fbpfcp-zoom-in-crop-mark%3A1512%3A0%3A0%3A0.awebp)

3.  后续就是 Thread-1 释放锁，其他线程重新抢锁。

**源码如下：**

*   signal() 方法是唤醒的入口方法

```
public final void signal() {
    // 判断调用 signal 方法的线程是否是独占锁持有线程
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();
    // 获取条件队列中第一个 Node
    Node first = firstWaiter;
    // 不为空就将第该节点【迁移到阻塞队列】
    if (first != null)
        doSignal(first);
}


```

*   调用 doSignal() 方法唤醒节点

```
// 唤醒 - 【将没取消的第一个节点转移至 AQS 队列尾部】
private void doSignal(Node first) {
    do {
        // 成立说明当前节点的下一个节点是 null，当前节点是尾节点了，队列中只有当前一个节点了
        if ((firstWaiter = first.nextWaiter) == null)
            lastWaiter = null;
        first.nextWaiter = null;
    // 将等待队列中的 Node 转移至 AQS 队列，不成功且还有节点则继续循环
    } while (!transferForSignal(first) && (first = firstWaiter) != null);
}

// signalAll() 会调用这个函数，唤醒所有的节点
private void doSignalAll(Node first) {
    lastWaiter = firstWaiter = null;
    do {
        Node next = first.nextWaiter;
        first.nextWaiter = null;
        transferForSignal(first);
        first = next;
    // 唤醒所有的节点，都放到阻塞队列中
    } while (first != null);
}


```

*   调用 transferForSignal() 方法，先将节点的 waitStatus 改为 0，然后加入 AQS 阻塞队列尾部，将 Thread-3 的 waitStatus 改为 -1。

```
// 如果节点状态是取消, 返回 false 表示转移失败, 否则转移成功
final boolean transferForSignal(Node node) {
    // CAS 修改当前节点的状态，修改为 0，因为当前节点马上要迁移到阻塞队列了
    // 如果状态已经不是 CONDITION, 说明线程被取消（await 释放全部锁失败）或者被中断（可打断 cancelAcquire）
    if (!compareAndSetWaitStatus(node, Node.CONDITION, 0))
        // 返回函数调用处继续寻找下一个节点
        return false;
    
    // 【先改状态，再进行迁移】
    // 将当前 node 入阻塞队列，p 是当前节点在阻塞队列的【前驱节点】
    Node p = enq(node);
    int ws = p.waitStatus;
    
    // 如果前驱节点被取消或者不能设置状态为 Node.SIGNAL，就 unpark 取消当前节点线程的阻塞状态, 
    // 让 thread-0 线程竞争锁，重新同步状态
    if (ws > 0 || !compareAndSetWaitStatus(p, ws, Node.SIGNAL))
        LockSupport.unpark(node.thread);
    return true;
}


```

# HashMap源码解读

JDK1.8 以后在解决哈希冲突时有了较大的变化。

当链表长度大于阈值（默认为 8）时，会首先调用 `treeifyBin()`方法。这个方法会根据 HashMap 数组来决定是否转换为红黑树。只有当数组长度大于或者等于 64 的情况下，才会执行转换红黑树操作，以减少搜索时间。否则，就是只是执行 `resize()` 方法对数组扩容。相关源码这里就不贴了，重点关注 `treeifyBin()`方法即可！

![jdk1.8之后的内部结构-HashMap](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesjdk1.8_hashmap.png)

**类的属性：**

```java
public class HashMap<K,V> extends AbstractMap<K,V> implements Map<K,V>, Cloneable, Serializable {
    // 序列号
    private static final long serialVersionUID = 362498820763181265L;
    // 默认的初始容量是16
    static final int DEFAULT_INITIAL_CAPACITY = 1 << 4;
    // 最大容量
    static final int MAXIMUM_CAPACITY = 1 << 30;
    // 默认的负载因子
    static final float DEFAULT_LOAD_FACTOR = 0.75f;
    // 当桶(bucket)上的结点数大于等于这个值时会转成红黑树
    static final int TREEIFY_THRESHOLD = 8;
    // 当桶(bucket)上的结点数小于等于这个值时树转链表
    static final int UNTREEIFY_THRESHOLD = 6;
    // 桶中结构转化为红黑树对应的table的最小容量
    static final int MIN_TREEIFY_CAPACITY = 64;
    // 存储元素的数组，总是2的幂次倍
    transient Node<k,v>[] table;
    // 一个包含了映射中所有键值对的集合视图
    transient Set<map.entry<k,v>> entrySet;
    // 存放元素的个数，注意这个不等于数组的长度。
    transient int size;
    // 每次扩容和更改map结构的计数器
    transient int modCount;
    // 阈值(容量*负载因子) 当实际大小超过阈值时，会进行扩容
    int threshold;
    // 负载因子
    final float loadFactor;
}
```

- **loadFactor 负载因子**

  loadFactor 负载因子是控制数组存放数据的疏密程度，loadFactor 越趋近于 1，那么 数组中存放的数据(entry)也就越多，也就越密，也就是会让链表的长度增加，loadFactor 越小，也就是趋近于 0，数组中存放的数据(entry)也就越少，也就越稀疏。

  **loadFactor 太大导致查找元素效率低，太小导致数组的利用率低，存放的数据会很分散。loadFactor 的默认值为 0.75f 是官方给出的一个比较好的临界值**。

  给定的默认容量为 16，负载因子为 0.75。Map 在使用过程中不断的往里面存放数据，当数量超过了 16 \* 0.75 = 12 就需要将当前 16 的容量进行扩容，而扩容这个过程涉及到 rehash、复制数据等操作，所以非常消耗性能。

- **threshold**

  **threshold = capacity \* loadFactor**，**当 Size>threshold**的时候，那么就要考虑对数组的扩增了，也就是说，这个的意思就是 **衡量数组是否需要扩增的一个标准**。

**Node 节点类源码:**

```java
// 继承自 Map.Entry<K,V>
static class Node<K,V> implements Map.Entry<K,V> {
       final int hash;// 哈希值，存放元素到hashmap中时用来与其他元素hash值比较
       final K key;//键
       V value;//值
       // 指向下一个节点
       Node<K,V> next;
       Node(int hash, K key, V value, Node<K,V> next) {
            this.hash = hash;
            this.key = key;
            this.value = value;
            this.next = next;
        }
        public final K getKey()        { return key; }
        public final V getValue()      { return value; }
        public final String toString() { return key + "=" + value; }
        // 重写hashCode()方法
        public final int hashCode() {
            return Objects.hashCode(key) ^ Objects.hashCode(value);
        }

        public final V setValue(V newValue) {
            V oldValue = value;
            value = newValue;
            return oldValue;
        }
        // 重写 equals() 方法
        public final boolean equals(Object o) {
            if (o == this)
                return true;
            if (o instanceof Map.Entry) {
                Map.Entry<?,?> e = (Map.Entry<?,?>)o;
                if (Objects.equals(key, e.getKey()) &&
                    Objects.equals(value, e.getValue()))
                    return true;
            }
            return false;
        }
}
```

## 构造方法

HashMap 中有四个构造方法，它们分别如下：

```java
    // 默认构造函数。
    public HashMap() {
        this.loadFactor = DEFAULT_LOAD_FACTOR; // all   other fields defaulted
     }

     // 包含另一个“Map”的构造函数
     public HashMap(Map<? extends K, ? extends V> m) {
         this.loadFactor = DEFAULT_LOAD_FACTOR;
         putMapEntries(m, false);//下面会分析到这个方法
     }

     // 指定“容量大小”的构造函数
     public HashMap(int initialCapacity) {
         this(initialCapacity, DEFAULT_LOAD_FACTOR);
     }

     // 指定“容量大小”和“负载因子”的构造函数
     public HashMap(int initialCapacity, float loadFactor) {
         if (initialCapacity < 0)
             throw new IllegalArgumentException("Illegal initial capacity: " + initialCapacity);
         if (initialCapacity > MAXIMUM_CAPACITY)
             initialCapacity = MAXIMUM_CAPACITY;
         if (loadFactor <= 0 || Float.isNaN(loadFactor))
             throw new IllegalArgumentException("Illegal load factor: " + loadFactor);
         this.loadFactor = loadFactor;
         // 初始容量暂时存放到 threshold ，在resize中再赋值给 newCap 进行table初始化，通过 tableSizeFor 将其扩容到与 initialCapacity 最接近的 2 的幂次方大小
         this.threshold = tableSizeFor(initialCapacity);
     }
```

> 值得注意的是上述四个构造方法中，都初始化了负载因子 loadFactor，由于 HashMap 中没有 capacity 这样的字段，即使指定了初始化容量 initialCapacity ，也只是通过 tableSizeFor 将其扩容到与 initialCapacity 最接近的 2 的幂次方大小，然后暂时赋值给 threshold ，后续通过 resize 方法将 threshold 赋值给 newCap 进行 table 的初始化。

**putMapEntries 方法：**

```java
final void putMapEntries(Map<? extends K, ? extends V> m, boolean evict) {
    int s = m.size();
    if (s > 0) {
        // 判断table是否已经初始化
        if (table == null) { // pre-size
            /*
             * 未初始化，s为m的实际元素个数，ft=s/loadFactor => s=ft*loadFactor, 跟我们前面提到的
             * 阈值=容量*负载因子 是不是很像，是的，ft指的是要添加s个元素所需的最小的容量
             */
            float ft = ((float)s / loadFactor) + 1.0F;
            int t = ((ft < (float)MAXIMUM_CAPACITY) ?
                    (int)ft : MAXIMUM_CAPACITY);
            /*
             * 根据构造函数可知，table未初始化，threshold实际上是存放的初始化容量，如果添加s个元素所
             * 需的最小容量大于初始化容量，则将最小容量扩容为最接近的2的幂次方大小作为初始化。
             * 注意这里不是初始化阈值
             */
            if (t > threshold)
                threshold = tableSizeFor(t);
        }
        // 已初始化，并且m元素个数大于阈值，进行扩容处理
        else if (s > threshold)
            resize();
        // 将m中的所有元素添加至HashMap中，如果table未初始化，putVal中会调用resize初始化或扩容
        for (Map.Entry<? extends K, ? extends V> e : m.entrySet()) {
            K key = e.getKey();
            V value = e.getValue();
            putVal(hash(key), key, value, false, evict);
        }
    }
}
```

## put 方法

HashMap 只提供了 put 用于添加元素，putVal 方法只是给 put 方法调用的一个方法，并没有提供给用户使用。

**对 putVal 方法添加元素的分析如下：**

1. 如果定位到的数组位置没有元素 就直接插入。
2. 如果定位到的数组位置有元素就和要插入的 key 比较，如果 key 相同就直接覆盖，如果 key 不相同，就判断 p 是否是一个树节点，如果是就调用`e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value)`将元素添加进入。如果不是就遍历链表插入(插入的是链表尾部)。

![ ](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesput.png)

```java
public V put(K key, V value) {
    return putVal(hash(key), key, value, false, true);
}

final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
                   boolean evict) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;
    // table未初始化或者长度为0，进行扩容
    if ((tab = table) == null || (n = tab.length) == 0)
        n = (tab = resize()).length;
    // (n - 1) & hash 确定元素存放在哪个桶中，桶为空，新生成结点放入桶中(此时，这个结点是放在数组中)
    if ((p = tab[i = (n - 1) & hash]) == null)
        tab[i] = newNode(hash, key, value, null);
    // 桶中已经存在元素（处理hash冲突）
    else {
        Node<K,V> e; K k;
        //快速判断第一个节点table[i]的key是否与插入的key一样，若相同就直接使用插入的值p替换掉旧的值e。
        if (p.hash == hash &&
            ((k = p.key) == key || (key != null && key.equals(k))))
                e = p;
        // 判断插入的是否是红黑树节点
        else if (p instanceof TreeNode)
            // 放入树中
            e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value);
        // 不是红黑树节点则说明为链表结点
        else {
            // 在链表最末插入结点
            for (int binCount = 0; ; ++binCount) {
                // 到达链表的尾部
                if ((e = p.next) == null) {
                    // 在尾部插入新结点
                    p.next = newNode(hash, key, value, null);
                    // 结点数量达到阈值(默认为 8 )，执行 treeifyBin 方法
                    // 这个方法会根据 HashMap 数组来决定是否转换为红黑树。
                    // 只有当数组长度大于或者等于 64 的情况下，才会执行转换红黑树操作，以减少搜索时间。否则，就是只是对数组扩容。
                    if (binCount >= TREEIFY_THRESHOLD - 1) // -1 for 1st
                        treeifyBin(tab, hash);
                    // 跳出循环
                    break;
                }
                // 判断链表中结点的key值与插入的元素的key值是否相等
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    // 相等，跳出循环
                    break;
                // 用于遍历桶中的链表，与前面的e = p.next组合，可以遍历链表
                p = e;
            }
        }
        // 表示在桶中找到key值、hash值与插入元素相等的结点
        if (e != null) {
            // 记录e的value
            V oldValue = e.value;
            // onlyIfAbsent为false或者旧值为null
            if (!onlyIfAbsent || oldValue == null)
                //用新值替换旧值
                e.value = value;
            // 访问后回调
            afterNodeAccess(e);
            // 返回旧值
            return oldValue;
        }
    }
    // 结构性修改
    ++modCount;
    // 实际大小大于阈值则扩容
    if (++size > threshold)
        resize();
    // 插入后回调
    afterNodeInsertion(evict);
    return null;
}
```

## get 方法

```java
public V get(Object key) {
    Node<K,V> e;
    return (e = getNode(hash(key), key)) == null ? null : e.value;
}

final Node<K,V> getNode(int hash, Object key) {
    Node<K,V>[] tab; Node<K,V> first, e; int n; K k;
    if ((tab = table) != null && (n = tab.length) > 0 &&
        (first = tab[(n - 1) & hash]) != null) {
        // 数组元素相等
        if (first.hash == hash && // always check first node
            ((k = first.key) == key || (key != null && key.equals(k))))
            return first;
        // 桶中不止一个节点
        if ((e = first.next) != null) {
            // 在树中get
            if (first instanceof TreeNode)
                return ((TreeNode<K,V>)first).getTreeNode(hash, key);
            // 在链表中get
            do {
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    return e;
            } while ((e = e.next) != null);
        }
    }
    return null;
}
```

## resize 方法

进行扩容，会伴随着一次重新 hash 分配，并且会遍历 hash 表中所有的元素，是非常耗时的。在编写程序中，要尽量避免 resize。resize 方法实际上是将 table 初始化和 table 扩容 进行了整合，底层的行为都是给 table 赋值一个新的数组。

```java
final Node<K,V>[] resize() {
    Node<K,V>[] oldTab = table;
    int oldCap = (oldTab == null) ? 0 : oldTab.length;
    int oldThr = threshold;
    int newCap, newThr = 0;
    if (oldCap > 0) {
        // 超过最大值就不再扩充了，就只好随你碰撞去吧
        if (oldCap >= MAXIMUM_CAPACITY) {
            threshold = Integer.MAX_VALUE;
            return oldTab;
        }
        // 没超过最大值，就扩充为原来的2倍
        else if ((newCap = oldCap << 1) < MAXIMUM_CAPACITY && oldCap >= DEFAULT_INITIAL_CAPACITY)
            newThr = oldThr << 1; // double threshold
    }
    else if (oldThr > 0) // initial capacity was placed in threshold
        // 创建对象时初始化容量大小放在threshold中，此时只需要将其作为新的数组容量
        newCap = oldThr;
    else {
        // signifies using defaults 无参构造函数创建的对象在这里计算容量和阈值
        newCap = DEFAULT_INITIAL_CAPACITY;
        newThr = (int)(DEFAULT_LOAD_FACTOR * DEFAULT_INITIAL_CAPACITY);
    }
    if (newThr == 0) {
        // 创建时指定了初始化容量或者负载因子，在这里进行阈值初始化，
    	// 或者扩容前的旧容量小于16，在这里计算新的resize上限
        float ft = (float)newCap * loadFactor;
        newThr = (newCap < MAXIMUM_CAPACITY && ft < (float)MAXIMUM_CAPACITY ? (int)ft : Integer.MAX_VALUE);
    }
    threshold = newThr;
    @SuppressWarnings({"rawtypes","unchecked"})
        Node<K,V>[] newTab = (Node<K,V>[])new Node[newCap];
    table = newTab;
    if (oldTab != null) {
        // 把每个bucket都移动到新的buckets中
        for (int j = 0; j < oldCap; ++j) {
            Node<K,V> e;
            if ((e = oldTab[j]) != null) {
                oldTab[j] = null;
                if (e.next == null)
                    // 只有一个节点，直接计算元素新的位置即可
                    newTab[e.hash & (newCap - 1)] = e;
                else if (e instanceof TreeNode)
                    // 将红黑树拆分成2棵子树，如果子树节点数小于等于 UNTREEIFY_THRESHOLD（默认为 6），则将子树转换为链表。
                    // 如果子树节点数大于 UNTREEIFY_THRESHOLD，则保持子树的树结构。
                    ((TreeNode<K,V>)e).split(this, newTab, j, oldCap);
                else {
                    Node<K,V> loHead = null, loTail = null;
                    Node<K,V> hiHead = null, hiTail = null;
                    Node<K,V> next;
                    do {
                        next = e.next;
                        // 原索引
                        if ((e.hash & oldCap) == 0) {
                            if (loTail == null)
                                loHead = e;
                            else
                                loTail.next = e;
                            loTail = e;
                        }
                        // 原索引+oldCap
                        else {
                            if (hiTail == null)
                                hiHead = e;
                            else
                                hiTail.next = e;
                            hiTail = e;
                        }
                    } while ((e = next) != null);
                    // 原索引放到bucket里
                    if (loTail != null) {
                        loTail.next = null;
                        newTab[j] = loHead;
                    }
                    // 原索引+oldCap放到bucket里
                    if (hiTail != null) {
                        hiTail.next = null;
                        newTab[j + oldCap] = hiHead;
                    }
                }
            }
        }
    }
    return newTab;
}
```

# ConcurrentHashMap源码分析

## 存储结构

![Java8 ConcurrentHashMap 存储结构（图片来自 javadoop）](https://oss.javaguide.cn/github/javaguide/java/collection/java8_concurrenthashmap.png)

可以发现 Java8 的 ConcurrentHashMap 相对于 Java7 来说变化比较大，不再是之前的 **Segment 数组 + HashEntry 数组 + 链表**，而是 **Node 数组 + 链表 / 红黑树**。当冲突链表达到一定长度时，链表会转换成红黑树。
>```java
>transient volatile Node<K,V>[] table;
>```
>
>对比HashMap的底层结构可以发现，table的定义中多了一个**volatile**关键字。
>
>所有的共享变量都存在**主内存**中，就像table。
>
>而线程对变量的所有操作都必须在线程自己的**工作内存**中完成，而不能直接读取主存中的变量，这是JMM的规定。所以每个线程都会有自己的工作内存，工作内存中存放了共享变量的副本。而正是因为这样，才造成了可见性的问题。
>
>ABCD四个线程同时在操作一个共享变量X，此时如果A从主存中读取了X，改变了值，并且写回了内存。那么BCD线程所得到的X副本就已经失效了。此时如果没有被**volatile**修饰，那么BCD线程是不知道自己的变量副本已经失效了。继续使用这个变量就会造成**数据不一致**的问题。
## 初始化 initTable

```java
/**
 * Initializes table, using the size recorded in sizeCtl.
 */
private final Node<K,V>[] initTable() {
    Node<K,V>[] tab; int sc;
    while ((tab = table) == null || tab.length == 0) {
        //　如果 sizeCtl < 0 ,说明另外的线程执行CAS 成功，正在进行初始化。
        if ((sc = sizeCtl) < 0)
            // 让出 CPU 使用权
            Thread.yield(); // lost initialization race; just spin
        else if (U.compareAndSwapInt(this, SIZECTL, sc, -1)) {
            try {
                if ((tab = table) == null || tab.length == 0) {
                    int n = (sc > 0) ? sc : DEFAULT_CAPACITY;
                    @SuppressWarnings("unchecked")
                    Node<K,V>[] nt = (Node<K,V>[])new Node<?,?>[n];
                    table = tab = nt;
                    sc = n - (n >>> 2);
                }
            } finally {
                sizeCtl = sc;
            }
            break;
        }
    }
    return tab;
}
```

从源码中可以发现 `ConcurrentHashMap` 的初始化是通过**自旋和 CAS** 操作完成的。里面需要注意的是变量 `sizeCtl` （sizeControl 的缩写），它的值决定着当前的初始化状态。

1. -1 说明正在初始化，其他线程需要自旋等待
2. -N 说明 table 正在进行扩容，高 16 位表示扩容的标识戳，低 16 位减 1 为正在进行扩容的线程数
3. 0 表示 table 初始化大小，如果 table 没有初始化
4. \>0 表示 table 扩容的阈值，如果 table 已经初始化。

### 初始化时的线程安全

如何保证不重复初始化？

```java
private transient volatile int sizeCtl;
```

sizeCtl使用了关键字`volatile`修饰，说明这是一个多线程的共享变量，可以看到如果是首次初始化，第一个判断条件`if ((sc = sizeCtl) < 0)`是不会满足的，正常初始化的话sizeCtl的值为0，初始化设定了size的话sizeCtl的值会等于传入的size，而这两个值始终是大于0的。

执行首次扩容时，会将变量`sizeCtl`设置为`-1`，因为其被`volatile`修饰，所以其值的修改对其他线程可见。

其它线程再调用初始化时，就会发现`sizeCtl`的值为`-1`，说明已经有线程正在执行初始化的操作了，就会执行`Thread.yield()`，然后退出。

## put

直接过一遍 put 源码。

```java
public V put(K key, V value) {
    return putVal(key, value, false);
}

/** Implementation for put and putIfAbsent */
final V putVal(K key, V value, boolean onlyIfAbsent) {
    // key 和 value 不能为空
    if (key == null || value == null) throw new NullPointerException();
    int hash = spread(key.hashCode());
    int binCount = 0;
    for (Node<K,V>[] tab = table;;) {
        // f = 目标位置元素
        Node<K,V> f; int n, i, fh;// fh 后面存放目标位置的元素 hash 值
        if (tab == null || (n = tab.length) == 0)
            // 数组桶为空，初始化数组桶（自旋+CAS)
            tab = initTable();
        else if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
            // 桶内为空，CAS 放入，不加锁，成功了就直接 break 跳出
            if (casTabAt(tab, i, null,new Node<K,V>(hash, key, value, null)))
                break;  // no lock when adding to empty bin
        }
        else if ((fh = f.hash) == MOVED)
            tab = helpTransfer(tab, f);
        else {
            V oldVal = null;
            // 使用 synchronized 加锁加入节点
            synchronized (f) {
                if (tabAt(tab, i) == f) {
                    // 说明是链表
                    if (fh >= 0) {
                        binCount = 1;
                        // 循环加入新的或者覆盖节点
                        for (Node<K,V> e = f;; ++binCount) {
                            K ek;
                            if (e.hash == hash &&
                                ((ek = e.key) == key ||
                                 (ek != null && key.equals(ek)))) {
                                oldVal = e.val;
                                if (!onlyIfAbsent)
                                    e.val = value;
                                break;
                            }
                            Node<K,V> pred = e;
                            if ((e = e.next) == null) {
                                pred.next = new Node<K,V>(hash, key,
                                                          value, null);
                                break;
                            }
                        }
                    }
                    else if (f instanceof TreeBin) {
                        // 红黑树
                        Node<K,V> p;
                        binCount = 2;
                        if ((p = ((TreeBin<K,V>)f).putTreeVal(hash, key,
                                                       value)) != null) {
                            oldVal = p.val;
                            if (!onlyIfAbsent)
                                p.val = value;
                        }
                    }
                }
            }
            if (binCount != 0) {
                if (binCount >= TREEIFY_THRESHOLD)
                    treeifyBin(tab, i);
                if (oldVal != null)
                    return oldVal;
                break;
            }
        }
    }
    addCount(1L, binCount);
    return null;
}
```

1. 根据 key 计算出 hashcode 。

2. 判断是否需要进行初始化。

3. 即为当前 key 定位出的 Node，如果为空表示当前位置可以写入数据，利用 CAS 尝试写入，失败则自旋保证成功。

4. 如果当前位置的 `hashcode == MOVED == -1`,则需要进行扩容。

5. 如果都不满足，则利用 synchronized 锁写入数据。

6. 如果数量大于 `TREEIFY_THRESHOLD` 则要执行树化方法，在 `treeifyBin` 中会首先判断当前数组长度 ≥64 时才会将链表转换为红黑树。

### 赋值时的线程安全

ConcurrentHashMap在目标key已经存在时的赋值操作，使用synchronized保证线程安全，通过对共享资源加锁的方式，使同一时间只能有一个线程能够访问到临界区（也就是共享资源），共享资源包括了方法、锁代码块和对象。

## 扩容

> 除了初始化、并发的写入值，还有一个问题值得关注，那就是在多线程下，`ConcurrentHashMap`是如何保证自动扩容是线程安全的。

并发扩容的时候，由于操作的table都是同一个，不像JDK7中分段控制，所以这里需要等扩容完之后，所有的读写操作才能进行，所以扩容的效率就成为了整个并发的一个瓶颈点，好在Doug lea大神对扩容做了优化，本来在一个线程扩容的时候，如果影响了其他线程的数据，那么其他的线程的读写操作都应该阻塞，但Doug lea说你们闲着也是闲着，不如来一起参与扩容任务，这样人多力量大，办完事你们该干啥干啥，别浪费时间，于是在JDK8的源码里面就引入了一个ForwardingNode类，在一个线程发起扩容的时候，就会改变sizeCtl这个值，其含义如下： 
```  
sizeCtl ：默认为0，用来控制table的初始化和扩容操作，具体应用在后续会体现出来。  
-1 代表table正在初始化  
-N 表示有N-1个线程正在进行扩容操作  
其余情况：  
1、如果table未初始化，表示table需要初始化的大小。  
2、如果table初始化完成，表示table的容量，默认是table大小的0.75倍  
```
扩容时候会判断这个值，如果超过阈值就要扩容，首先根据运算得到需要遍历的次数i，然后利用tabAt方法获得i位置的元素f，初始化一个forwardNode实例fwd，如果f == null，则在table中的i位置放入fwd，否则采用头插法的方式把当前旧table数组的指定任务范围的数据给迁移到新的数组中，然后 
给旧table原位置赋值fwd。直到遍历过所有的节点以后就完成了复制工作，把table指向nextTable，并更新sizeCtl为新数组大小的0.75倍 ，扩容完成。在此期间如果其他线程的有读写操作都会判断head节点是否为forwardNode节点，如果是就帮助扩容。 

#### 在扩容时读写操作如何进行

- 对于get读操作，如果当前节点有数据，还没迁移完成，此时不影响读，能够正常进行。 
如果当前链表已经迁移完成，那么头节点会被设置成fwd节点，此时get线程会帮助扩容。 

- 对于put/remove写操作，如果当前链表已经迁移完成，那么头节点会被设置成fwd节点，此时写线程会帮助扩容，如果扩容没有完成，当前链表的头节点会被锁住，所以写线程会被阻塞，直到扩容完成。 

扩容的关键方案是`transfer`，在`putVal`的最后一步，会调用`addCount`方法，然后在方法里判读是否需要扩容，如果容量超过了`实际容量 * 负载因子`（也就是sizeCtl的值）就会调用`transfer`方法。

### 计算分区的范围
-------

因为`ConcurrentHashMap`是支持多线程同时扩容的，所以为了避免每个线程处理的数量不均匀，也为了提高效率，其对当前的所有桶按数量（也就是上面提到的槽位）进行分区，每个线程只处理自己分到的区域内的桶的数据即可。

当前线程计算当前 stride 的代码如下。

```
stride = (NCPU > 1) ? (n >>> 3) / NCPU : n);
```

如果计算出来的值小于设定的最小范围，也就是`private static final int MIN_TRANSFER_STRIDE = 16;`，就把当前分区范围设置为 16。

### 初始化 nextTable
-------------

`nextTable`也是一个共享变量，定义如下，用于存放在正在扩容之后的`ConcurrentHashMap`的数据，当且仅当正在**扩容**时才不为空。

```
private transient volatile Node<K,V>[] nextTable;
```

如果当前 transfer 方法传入的 nextTab（这是个局部变量，比上面提到的 nextTable 少了几个字母，不要搞混了）是 null，说明是当前线程是第一个调用扩容操作的线程，就需要初始化一个 size 为原来容量 2 被的 nextTable，核心代码如下。

```
Node<K,V>[] nt = (Node<K,V>[])new Node<?,?>[n << 1]; // 可以看到传入的初始化容量是n << 1。
```

初始化成功之后就更新**共享变量**`nextTable`的值，并设置`transferIndex`的值为扩容前的 length，这也是一个共享的变量，表示扩容使还未处理的桶的下标。

### 设置分区边界
------

一个新的线程加入扩容操作，在完成上述步骤后，就会开始从现在正在扩容的 Map 中找到自己的分区。例如，如果是第一个线程，那么其取到的分区就会如下。

```
start = nextIndex - 1;
end = nextIndex > stride ? nextIndex - stride : 0;
// 实际上就是当还有足够的桶可以分的时候，线程分到的分区为 [n-stride, n - 1]
```

可以看到，分区是从尾到首进行的。而如果是首次进入的线程，`nextIndex` 的值会被初始化为共享变量`transferIndex` 的值。

### Copy 分区内的值
----------

当前线程在自己划分到的分区内开始遍历，如果当前桶是 null，那么就生成一个 `ForwardingNode`，代码如下。

```
ForwardingNode<K,V> fwd = new ForwardingNode<K,V>(nextTab);
```

并把当前槽位赋值为 fwd，你可以把`ForwardingNode`理解为一个标志位，如果有线程遍历到了这个桶， 发现已经是`ForwardingNode`了，就代表这个桶已经被处理过了，就会跳过这个桶。

如果这个桶没有被处理过，就会开始给当前的桶加锁，我们知道`ConcurrentHashMap`会在多线程的场景下使用，所以当有线程正在扩容的时候，可能还会有线程正在执行 put 操作，所以如果当前 Map 正在执行扩容操作，如果此时再写入数据，很可能会造成的数据丢失，所以要对桶进行加锁。

# ArrayBlockingQueue源码分析

## 初始化

从源码中我们可以看出 `ArrayBlockingQueue` 有 3 个构造方法，而最核心的构造方法就是下方这一个。

```java
// capacity 表示队列初始容量，fair 表示 锁的公平性
public ArrayBlockingQueue(int capacity, boolean fair) {
  //如果设置的队列大小小于0，则直接抛出IllegalArgumentException
  if (capacity <= 0)
      throw new IllegalArgumentException();
  //初始化一个数组用于存放队列的元素
  this.items = new Object[capacity];
  //创建阻塞队列流程控制的锁
  lock = new ReentrantLock(fair);
  //用lock锁创建两个条件控制队列生产和消费
  notEmpty = lock.newCondition();
  notFull =  lock.newCondition();
}
```

这个构造方法里面有两个比较核心的成员变量 `notEmpty`(非空) 和 `notFull` （非满） ，它们是实现生产者和消费者有序工作的关键所在。

## 阻塞式获取和新增元素

`ArrayBlockingQueue` 阻塞式获取和新增元素对应的就是生产者-消费者模型，虽然它也支持非阻塞式获取和新增元素（例如 `poll()` 和 `offer(E e)` 方法，后文会介绍到），但一般不会使用。

`ArrayBlockingQueue` 阻塞式获取和新增元素的方法为：

- `put(E e)`：将元素插入队列中，如果队列已满，则该方法会一直阻塞，直到队列有空间可用或者线程被中断。
- `take()` ：获取并移除队列头部的元素，如果队列为空，则该方法会一直阻塞，直到队列非空或者线程被中断。

这两个方法实现的关键就是在于两个条件对象 `notEmpty`(非空) 和 `notFull` （非满），这个我们在上文的构造方法中有提到。

接下来笔者就通过两张图让大家了解一下这两个条件是如何在阻塞队列中运用的。

![ArrayBlockingQueue 非空条件](https://oss.javaguide.cn/github/javaguide/java/collection/ArrayBlockingQueue-notEmpty-take.png)

假设我们的代码消费者先启动，当它发现队列中没有数据，那么非空条件就会将这个线程挂起，即等待条件非空时挂起。然后 CPU 执行权到达生产者，生产者发现队列中可以存放数据，于是将数据存放进去，通知此时条件非空，此时消费者就会被唤醒到队列中使用 `take` 等方法获取值了。

![ArrayBlockingQueue 非满条件](https://oss.javaguide.cn/github/javaguide/java/collection/ArrayBlockingQueue-notFull-put.png)

随后的执行中，生产者生产速度远远大于消费者消费速度，于是生产者将队列塞满后再次尝试将数据存入队列，发现队列已满，于是阻塞队列就将当前线程挂起，等待非满。然后消费者拿着 CPU 执行权进行消费，于是队列可以存放新数据了，发出一个非满的通知，此时挂起的生产者就会等待 CPU 执行权到来时再次尝试将数据存到队列中。

简单了解阻塞队列的基于两个条件的交互流程之后，我们不妨看看 `put` 和 `take` 方法的源码。

```java
public void put(E e) throws InterruptedException {
    //确保插入的元素不为null
    checkNotNull(e);
    //加锁
    final ReentrantLock lock = this.lock;
    //这里使用lockInterruptibly()方法而不是lock()方法是为了能够响应中断操作，如果在等待获取锁的过程中被打断则该方法会抛出InterruptedException异常。
    lock.lockInterruptibly();
    try {
            //如果count等数组长度则说明队列已满，当前线程将被挂起放到AQS队列中，等待队列非满时插入（非满条件）。
       //在等待期间，锁会被释放，其他线程可以继续对队列进行操作。
        while (count == items.length)
            notFull.await();
           //如果队列可以存放元素，则调用enqueue将元素入队
        enqueue(e);
    } finally {
        //释放锁
        lock.unlock();
    }
}
```

`put`方法内部调用了 `enqueue` 方法来实现元素入队，我们继续深入查看一下 `enqueue` 方法的实现细节：

```java
private void enqueue(E x) {
   //获取队列底层的数组
    final Object[] items = this.items;
    //将putindex位置的值设置为我们传入的x
    items[putIndex] = x;
    //更新putindex，如果putindex等于数组长度，则更新为0
    if (++putIndex == items.length)
        putIndex = 0;
    //队列长度+1
    count++;
    //通知队列非空，那些因为获取元素而阻塞的线程可以继续工作了
    notEmpty.signal();
}
```

从源码中可以看到入队操作的逻辑就是在数组中追加一个新元素，整体执行步骤为:

1. 获取 `ArrayBlockingQueue` 底层的数组 `items`。
2. 将元素存到 `putIndex` 位置。
3. 更新 `putIndex` 到下一个位置，如果 `putIndex` 等于队列长度，则说明 `putIndex` 已经到达数组末尾了，下一次插入则需要 0 开始。(`ArrayBlockingQueue` 用到了循环队列的思想，即从头到尾循环复用一个数组)
4. 更新 `count` 的值，表示当前队列长度+1。
5. 调用 `notEmpty.signal()` 通知队列非空，消费者可以从队列中获取值了。

自此我们了解了 `put` 方法的流程，为了更加完整的了解 `ArrayBlockingQueue` 关于生产者-消费者模型的设计，我们继续看看阻塞获取队列元素的 `take` 方法。

```java
public E take() throws InterruptedException {
       //获取锁
     final ReentrantLock lock = this.lock;
     lock.lockInterruptibly();
     try {
             //如果队列中元素个数为0，则将当前线程打断并存入AQS队列中，等待队列非空时获取并移除元素（非空条件）
         while (count == 0)
             notEmpty.await();
            //如果队列不为空则调用dequeue获取元素
         return dequeue();
     } finally {
          //释放锁
         lock.unlock();
     }
}
```

理解了 `put` 方法再看`take` 方法就很简单了，其核心逻辑和`put` 方法正好是相反的，比如`put` 方法在队列满的时候等待队列非满时插入元素（非满条件），而`take` 方法等待队列非空时获取并移除元素（非空条件）。

`take`方法内部调用了 `dequeue` 方法来实现元素出队，其核心逻辑和 `enqueue` 方法也是相反的。

```java
private E dequeue() {
  //获取阻塞队列底层的数组
  final Object[] items = this.items;
  @SuppressWarnings("unchecked")
  //从队列中获取takeIndex位置的元素
  E x = (E) items[takeIndex];
  //将takeIndex置空
  items[takeIndex] = null;
  //takeIndex向后挪动，如果等于数组长度则更新为0
  if (++takeIndex == items.length)
      takeIndex = 0;
  //队列长度减1
  count--;
  if (itrs != null)
      itrs.elementDequeued();
  //通知那些被打断的线程当前队列状态非满，可以继续存放元素
  notFull.signal();
  return x;
}
```

由于`dequeue` 方法（出队）和上面介绍的 `enqueue` 方法（入队）的步骤大致类似，这里就不重复介绍了。

为了帮助理解，我专门画了一张图来展示 `notEmpty`(非空) 和 `notFull` （非满）这两个条件对象是如何控制 `ArrayBlockingQueue` 的存和取的。

![ArrayBlockingQueue 非空非满](https://oss.javaguide.cn/github/javaguide/java/collection/ArrayBlockingQueue-notEmpty-notFull.png)

- **消费者**：当消费者从队列中 `take` 或者 `poll` 等操作取出一个元素之后，就会通知队列非满，此时那些等待非满的生产者就会被唤醒等待获取 CPU 时间片进行入队操作。
- **生产者**：当生产者将元素存到队列中后，就会触发通知队列非空，此时消费者就会被唤醒等待 CPU 时间片尝试获取元素。如此往复，两个条件对象就构成一个环路，控制着多线程之间的存和取。

# PriorityQueue源码分析

## 构造函数

 `PriorityQueue` 的构造方法要求用户传入一个 `initialCapacity` 用于初始化一个数组 `queue`，这个数组就是优先队列底层所用到的二叉小顶堆。

```java
public PriorityQueue(int initialCapacity,
                         Comparator<? super E> comparator) {
        //如果初始化容量小于1则抛出异常
        if (initialCapacity < 1)
            throw new IllegalArgumentException();
        this.queue = new Object[initialCapacity];
        this.comparator = comparator;
    }
```

同时该构造方法还要求用户传入一个 `comparator` 即一个比较器，说明 `queue` 的元素在进行入队操作时是需要比较的，而这个 `comparator` 就是比较的依据。

## 入队操作

对于 PriorityQueue 来说，核心的入队就是 offer，它的核心步骤为:

1. 校验元素是否为空。
2. 设置新插入的位置为 size。
3. 判断数组容量是否足够，如果不够则扩容。
4. 如果是第一个元素，则直接将其放到索引 0 位置。
5. 如果不是第一个元素，则调用 siftUp 将元素放入队列。

```java
public boolean offer(E e) {
		//校验元素是否为空
        if (e == null)
            throw new NullPointerException();
        modCount++;
        //设置新插入的位置为size
        int i = size;
        //判断数组容量是否足够，如果不够则扩容
        if (i >= queue.length)
            grow(i + 1);
        size = i + 1;
        //如果是第一个元素，则直接将其放到索引0位置
        if (i == 0)
            queue[0] = e;
        else
        //如果不是第一个元素，则调用siftUp将元素放入队列
            siftUp(i, e);
        return true;
    }
```

在 siftUp 操作时会判断比较器是否为空，如果不为空则使用传入的比较器生成小顶堆，反之就将元素 x 转为 Comparable 对象进行比较。 因为整体比较逻辑都一样，所以我们就以 siftUpUsingComparator 查看一下进行 siftUp 操作时对于入队元素的处理逻辑。  

```java
private void siftUp(int k, E x) {
        if (comparator != null)
            siftUpUsingComparator(k, x);
        else
            siftUpComparable(k, x);
    }
```


siftUpUsingComparator 和我们手写的 siftUp 逻辑差不多, 都是不断向上比较父节点，找到比自己大的则交换位置，直到到达根节点或者比较父节点比自己小为止，整体来说 PriorityQueue 的 siftUp 分为以下几个步骤:  

1. 获取入队元素当前索引位置的父索引 parent。
2. 根据父索引找到元素 e。
3.  如果新节点 x 比 e 大，则说明当前入队操作符合小顶堆要求，直接结束循环。
4. 如果 x 比 e 小，则将父节点 e 的值改为我们入队元素 x 的值。
5. k 指向父索引，继续循环向上比较父索引，直到找到比 x 还小的父节点 e，终止循环。  
6.  将 x 存到符合要求的索引位置 k。  

```java
private void siftUpUsingComparator(int k, E x) {
        while (k > 0) {
        //获取入队元素当前索引位置的父索引parent
            int parent = (k - 1) >>> 1;
            //根据父索引找到元素e
            Object e = queue[parent];
            // 如果新节点x比e大，则说明当前入队操作符合小顶堆要求，直接结束循环
            if (comparator.compare(x, (E) e) >= 0)
                break;
			//如果x比e小，则将父节点e的值改为我们入队元素x的值
            queue[k] = e;
            //k指向父索引，继续循环向上比较父索引，直到找到比x还小的父节点e，终止循环
            k = parent;
        }
        //将x存到符合要求的索引位置k
        queue[k] = x;
    }
```

## 出队操作  

出队操作和我们手写的逻辑也差不多，只不过逻辑处理的更加细致，它的逻辑步骤为:  

1. size 减 1 并赋值给 s。  
2. 如果队列为空则返回 null。
3. 如果队列不为空则拷贝索引 0 位置即优先级最高的元素。
4. 将数组 0 位置设置为 null。
5.  如果 s 不为 0，说明队列中不止一个元素，需要维持小顶堆的特性，需要从堆顶开始进行 siftDown 操作。
6.  返回优先队列优先级最高的元素 result。  

```java
public E poll() {
        if (size == 0)
            return null;
        int s = --size;
        modCount++;
        E result = (E) queue[0];
        E x = (E) queue[s];
        queue[s] = null;
        if (s != 0)
            siftDown(0, x);
        return result;
    }
```



## 查看优先级最高的元素  

peek 方法可以不改变队列结构查看优先级最高的元素，如果队列为空则返回 null，反之返回 0 索引位置的元素。  

```java
 public E peek() {
        return (size == 0) ? null : (E) queue[0];
    }
```

# DelayQueue源码分析

`DelayQueue` 的类定义如下：

```java
public class DelayQueue<E extends Delayed> extends AbstractQueue<E> implements BlockingQueue<E>
{
  //...
}
```

`DelayQueue` 继承了 `AbstractQueue` 类，实现了 `BlockingQueue` 接口。

![DelayQueue类图](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesdelayqueue-class-diagram.png)

## 核心成员变量

`DelayQueue` 的 4 个核心成员变量如下：

```java
//可重入锁，实现线程安全的关键
private final transient ReentrantLock lock = new ReentrantLock();
//延迟队列底层存储数据的集合,确保元素按照到期时间升序排列
private final PriorityQueue<E> q = new PriorityQueue<E>();

//指向准备执行优先级最高的线程
private Thread leader = null;
//实现多线程之间等待唤醒的交互
private final Condition available = lock.newCondition();
```

- `lock` : 我们都知道 `DelayQueue` 存取是线程安全的，所以为了保证存取元素时线程安全，我们就需要在存取时上锁，而 `DelayQueue` 就是基于 `ReentrantLock` 独占锁确保存取操作的线程安全。
- `q` : 延迟队列要求元素按照到期时间进行升序排列，所以元素添加时势必需要进行优先级排序,所以 `DelayQueue` 底层元素的存取都是通过这个优先队列 `PriorityQueue` 的成员变量 `q` 来管理的。
- `leader` : 延迟队列的任务只有到期之后才会执行,对于没有到期的任务只有等待,为了确保优先级最高的任务到期后可以即刻被执行,设计者就用 `leader` 来管理延迟任务，只有 `leader` 所指向的线程才具备定时等待任务到期执行的权限，而其他那些优先级低的任务只能无限期等待，直到 `leader` 线程执行完手头的延迟任务后唤醒它。
- `available` : 上文讲述 `leader` 线程时提到的等待唤醒操作的交互就是通过 `available` 实现的，假如线程 1 尝试在空的 `DelayQueue` 获取任务时，`available` 就会将其放入等待队列中。直到有一个线程添加一个延迟任务后通过 `available` 的 `signal` 方法将其唤醒。

## 构造方法

相较于其他的并发容器，延迟队列的构造方法比较简单，它只有两个构造方法，因为所有成员变量在类加载时都已经初始完成了，所以默认构造方法什么也没做。还有一个传入 `Collection` 对象的构造方法，它会将调用 `addAll()`方法将集合元素存到优先队列 `q` 中。

```java
public DelayQueue() {}

public DelayQueue(Collection<? extends E> c) {
    this.addAll(c);
}
```

## 添加元素

`DelayQueue` 添加元素的方法无论是 `add`、`put` 还是 `offer`,本质上就是调用一下 `offer` ,所以了解延迟队列的添加逻辑我们只需阅读 offer 方法即可。

`offer` 方法的整体逻辑为:

1. 尝试获取 `lock` 。
2. 如果上锁成功,则调 `q` 的 `offer` 方法将元素存放到优先队列中。
3. 调用 `peek` 方法看看当前队首元素是否就是本次入队的元素,如果是则说明当前这个元素是即将到期的任务(即优先级最高的元素)，于是将 `leader` 设置为空,通知因为队列为空时调用 `take` 等方法导致阻塞的线程来争抢元素。
4. 上述步骤执行完成，释放 `lock`。
5. 返回 true。

源码如下，笔者已详细注释，读者可自行参阅:

```java
public boolean offer(E e) {
    //尝试获取lock
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        //如果上锁成功,则调q的offer方法将元素存放到优先队列中
        q.offer(e);
        //调用peek方法看看当前队首元素是否就是本次入队的元素,如果是则说明当前这个元素是即将到期的任务(即优先级最高的元素)
        if (q.peek() == e) {
            //将leader设置为空,通知调用取元素方法而阻塞的线程来争抢这个任务
            leader = null;
            available.signal();
        }
        return true;
    } finally {
        //上述步骤执行完成，释放lock
        lock.unlock();
    }
}
```

## 获取元素

`DelayQueue` 中获取元素的方式分为阻塞式和非阻塞式，先来看看逻辑比较复杂的阻塞式获取元素方法 `take`,为了让读者可以更直观的了解阻塞式获取元素的全流程，笔者将以 3 个线程并发获取元素为例讲述 `take` 的工作流程。

1、首先， 3 个线程会尝试获取可重入锁 `lock`,假设我们现在有 3 个线程分别是 t1、t2、t3,随后 t1 得到了锁，而 t2、t3 没有抢到锁，故将这两个线程存入等待队列中。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesdelayqueue-take-0.png)

2、紧接着 t1 开始进行元素获取的逻辑。

3、线程 t1 首先会查看 `DelayQueue` 队列首元素是否为空。

4、如果元素为空，则说明当前队列没有任何元素，故 t1 就会被阻塞存到 `conditionWaiter` 这个队列中。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesdelayqueue-take-1.png)

注意，调用 `await` 之后 t1 就会释放 `lcok` 锁，假如 `DelayQueue` 持续为空，那么 t2、t3 也会像 t1 一样执行相同的逻辑并进入 `conditionWaiter` 队列中。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesdelayqueue-take-2.png)

如果元素不为空，则判断当前任务是否到期，如果元素到期，则直接返回出去。如果元素未到期，则判断当前 `leader` 线程(`DelayQueue` 中唯一一个可以等待并获取元素的线程引用)是否为空，若不为空，则说明当前 `leader` 正在等待执行一个优先级比当前元素还高的元素到期，故当前线程 t1 只能调用 `await` 进入无限期等待，等到 `leader` 取得元素后唤醒。反之，若 `leader` 线程为空，则将当前线程设置为 leader 并进入有限期等待,到期后取出元素并返回。

自此我们阻塞式获取元素的逻辑都已完成后,源码如下，读者可自行参阅:

```java
public E take() throws InterruptedException {
    // 尝试获取可重入锁,将底层AQS的state设置为1,并设置为独占锁
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        for (;;) {
            //查看队列第一个元素
            E first = q.peek();
            //若为空,则将当前线程放入ConditionObject的等待队列中，并将底层AQS的state设置为0，表示释放锁并进入无限期等待
            if (first == null)
                available.await();
            else {
                //若元素不为空，则查看当前元素多久到期
                long delay = first.getDelay(NANOSECONDS);
                //如果小于0则说明已到期直接返回出去
                if (delay <= 0)
                    return q.poll();
                //如果大于0则说明任务还没到期，首先需要释放对这个元素的引用
                first = null; // don't retain ref while waiting
                //判断leader是否为空，如果不为空，则说明正有线程作为leader并等待一个任务到期，则当前线程进入无限期等待
                if (leader != null)
                    available.await();
                else {
                    //反之将我们的线程成为leader
                    Thread thisThread = Thread.currentThread();
                    leader = thisThread;
                    try {
                        //并进入有限期等待
                        available.awaitNanos(delay);
                    } finally {
                        //等待任务到期时，释放leader引用，进入下一次循环将任务return出去
                        if (leader == thisThread)
                            leader = null;
                    }
                }
            }
        }
    } finally {
        // 收尾逻辑:当leader为null，并且队列中有任务时，唤醒等待的获取元素的线程。
        if (leader == null && q.peek() != null)
            available.signal();
        //释放锁
        lock.unlock();
    }
}
```

我们再来看看非阻塞的获取元素方法 `poll` ，逻辑比较简单，整体步骤如下:

1. 尝试获取可重入锁。
2. 查看队列第一个元素,判断元素是否为空。
3. 若元素为空，或者元素未到期，则直接返回空。
4. 若元素不为空且到期了，直接调用 `poll` 返回出去。
5. 释放可重入锁 `lock` 。

源码如下,读者可自行参阅源码及注释:

```java
public E poll() {
    //尝试获取可重入锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        //查看队列第一个元素,判断元素是否为空
        E first = q.peek();

        //若元素为空，或者元素未到期，则直接返回空
        if (first == null || first.getDelay(NANOSECONDS) > 0)
            return null;
        else
            //若元素不为空且到期了，直接调用poll返回出去
            return q.poll();
    } finally {
        //释放可重入锁lock
        lock.unlock();
    }
}
```

## 查看元素

上文获取元素时都会调用到 `peek` 方法，peek 顾名思义仅仅窥探一下队列中的元素，它的步骤就 4 步:

1. 上锁。
2. 调用优先队列 q 的 peek 方法查看索引 0 位置的元素。
3. 释放锁。
4. 将元素返回出去。

```java
public E peek() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return q.peek();
    } finally {
        lock.unlock();
    }
}
```
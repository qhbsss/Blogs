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

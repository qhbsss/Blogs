[TOC]

# Synchronized底层原理：

重量级锁依赖于对象头中的监视器锁，底层依赖于操作系统的Mutex Lock来实现，`synchronized` 同步语句块的实现使用的是 `monitorenter` 和 `monitorexit` 指令，其中 `monitorenter` 指令指向同步代码块的开始位置，`monitorexit` 指令则指明同步代码块的结束位置。当执行 monitorenter 指令时，线程试图获取锁也就是获取 对象监视器 monitor 的持有权。在执行monitorenter时，会尝试获取对象的锁，如果锁的计数器为 0 则表示锁可以被获取，获取后将锁计数器设为 1 也就是加 1。

对于偏向锁和轻量级锁，都是为了尽可能避免使用重量级锁带来的操作系统由用户态向内核态的切换，因此偏向锁和轻量级锁都是通过对象头的信息，在不使用moniter的作用下，判断锁是否重入，以及出现线程竞争对象时缓冲一定的时间，使得线程尽可能释放，避免升级为重量级锁。

## PS:
在 Java 虚拟机(HotSpot)中，Monitor 是基于 C++实现的，由ObjectMonitor实现的。每个对象中都内置了一个 ObjectMonitor对象。
另外，wait/notify等方法也依赖于monitor对象，这就是为什么只有在同步的块或者方法中才能调用wait/notify等方法，否则会抛出java.lang.IllegalMonitorStateException的异常的原因。
## JVM中对象的内存模型
在 JVM 中，对象在内存中分为三块区域：

1. 对象头：由Mark Word和Klass Point构成。

- Mark Word（标记字段）：用于存储对象自身的运行时数据，例如存储对象的HashCode，分代年龄、锁标志位等信息，是synchronized实现轻量级锁和偏向锁的关键。 64位JVM的Mark Word组成如下：

  ![image-20210627210825952](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/image-20210627210825952.png)

- Klass Point（类型指针）：对象指向它的类元数据的指针，虚拟机通过这个指针来确定这个对象是哪个类的实例。
2. 实例数据：这部分主要是存放类的数据信息，父类的信息。

3. 字节对齐：为了内存的IO性能，JVM要求对象起始地址必须是8字节的整数倍。对于不对齐的对象，需要填充数据进行对齐。
# Synchronized的锁升级原理
## 偏向锁
当一个共享资源首次被某个线程访问时，锁就会从无锁状态升级到偏向锁状态，偏向锁会在Markword的偏向线程ID里存储当前线程的操作系统线程ID，偏向锁标识位是1，锁标识位是01。此后如果当前线程再次进入临界区域时，只比较这个偏向线程ID即可，这种情况是在只有一个线程访问的情况下，不再需要操作系统的重量级锁来切换上下文，提供程序的访问效率。（另外需要注意的是，由于硬件资源的不断升级，获取锁的成本随之下降，jdk15版本后默认关闭了偏向锁。如果未开启偏向锁（或者在JVM偏向锁延迟时间之前）有线程访问共享资源则直接由无锁升级为轻量级锁，请看第3步。）
![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/3230688-20231101142508587-1722367516.png)
## 轻量级锁
轻量级锁能够提升程序性能的依据是**“对绝大部分的锁，在整个同步周期内都不存在竞争”**，注意这是经验数据。
当第二个线程尝试获取偏向锁失败时，偏向锁会升级为轻量级锁，此时，JVM会使用CAS自旋操作来尝试获取锁，如果成功则进入临界区域，否则升级为重量级锁。
轻量级锁是在当前线程的栈帧中建立一个名为**锁记录（Lock Record）**的空间，尝试拷贝锁对象头的Markword到栈帧的Lock Record，若拷贝成功，JVM将使用CAS操作尝试将对象头的Markword更新为指向Lock Record的指针，并将Lock Record里的owner指针指向对象头的Markword。若拷贝失败,若当前只有一个等待线程，则可通过自旋继续尝试， 当自旋超过一定的次数，或者一个线程在持有锁，一个线程在自旋，又有第三个线程来访问时，轻量级锁就会膨胀为重量级锁。
![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/3230688-20231101142544543-1353049648.png)

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/6d9892d868215781bc7cfd35be36c2d2.png)

**轻量级锁的重入**：虚拟机首先会检查对象的Mark Word是否指向当前线程的栈帧，如果是就说明当前线程已经拥有了这个对象的锁，现在是重入状态，那么设置Lock Record第一部分（Displaced Mark Word）为null，起到了一个重入计数器的作用。

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/767dc4b1d9239fbf391e27a5fc8584e2.png)

当对象已经被轻量级锁定的时候，会判断是否是锁重入，如果是重入的话，会记录一条Displaced Mark Word为空的Lock Record。如果不是重入，会膨胀为重量级锁。需要注意的是，即使膨胀为重量级锁，没有获取到锁的线程也不会马上阻塞，而是通过适应性自旋尝试获取锁，当自旋次数达到临界值后，才会阻塞未获取到的线程。JVM认为获取到锁的线程大概率会很快的释放锁，这样做是为了尽可能的避免用户态到内核态的切换。

## 重量级锁
当轻量级锁获取锁失败时，说明有竞争存在，轻量级锁会升级为重量级锁，此时，JVM会将线程阻塞，直到获取到锁后才能进入临界区域，底层是通过操作系统的mutex lock来实现的，每个对象指向一个monitor对象，这个monitor对象在堆中与锁是关联的，通过monitorenter指令插入到同步代码块在编译后的开始位置，monitorexit指令插入到同步代码块的结束处和异常处，这两个指令配对出现。JVM的线程和操作系统的线程是对应的，重量级锁的Markword里存储的指针是这个monitor对象的地址，操作系统来控制内核态中的线程的阻塞和恢复，从而达到JVM线程的阻塞和恢复，涉及内核态和用户态的切换，影响性能，所以叫重量级锁。

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/3230688-20231101142620113-1396564306.png)
当对象已经被轻量级锁定的时候，会判断是否是锁重入，如果是重入的话，会记录一条Displaced Mark Word为空的Lock Record。如果不是重入，会膨胀为重量级锁。需要注意的是，即使膨胀为重量级锁，没有获取到锁的线程也不会马上阻塞，而是通过适应性自旋尝试获取锁，当自旋次数达到临界值后，才会阻塞未获取到的线程。JVM认为获取到锁的线程大概率会很快的释放锁，这样做是为了尽可能的避免用户态到内核态的切换。



一个`ObjectMonitor`对象包括两个同步队列（`_cxq`和`_EntryList`） ，以及一个等待队列`_WaitSet`，`_owner`指向持有`ObjectMonitor`对象的线程。cxq、EntryList 、WaitSet都是由ObjectWaiter构成的链表结构(每个等待锁的线程都会被封装成`ObjectWaiter`对象)。其中，`_cxq`为单向链表，`_EntryList`为双向链表。

![同步队列、阻塞队列](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/---------.svg)

当一个线程尝试获得重量级锁且没有竞争到时，该线程会被封装成一个`ObjectWaiter`对象插入到cxq的队列的队首，然后调用`park`函数挂起当前线程，进入BLOCKED状态。当线程释放锁时，会根据唤醒策略，从cxq或EntryList中挑选一个线程`unpark`唤醒。如果线程获得锁后调用`Object#wait`方法，则会将线程加入到WaitSet中，进入WAITING或TIMED_WAITING状态。当被`Object#notify`唤醒后，会将线程从WaitSet移动到cxq或EntryList中去，进入BLOCKED状态。

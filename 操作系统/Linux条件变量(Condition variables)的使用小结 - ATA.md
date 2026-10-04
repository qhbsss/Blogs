---
title: "Linux条件变量(Condition variables)的使用小结 - ATA"
source: "https://ata.atatech.org/articles/11000014320?spm=ata.23639746.0.0.30bd67e4UJSjXw"
author:
published:
created: 2026-04-08
description:
tags:
  - "clippings"
---
## Linux条件变量(Condition variables)的使用小结

2014-03-07发表2022-08-01更新151次浏览




在多线程程序中，两个或多个有交互的线程需要关注同一个共享条件的状态变化，通常有两种方法：轮询和中断。虽然该概念来自于硬件编程，但是逻辑和思路都是一样的，即是否需要让CPU去做更有意义的事情而不是空转。

假定线程t1和t2需要关注一个Boolean变量b的变化，t1读取b的值，如果为true才继续执行，否则进行等待，t2改变b的值。在每次轮询时，如果t1休眠的时间比较短，会导致CPU浪费很厉害；如果t1休眠的时间比较长，又会导致应用逻辑处理不够及时，致使应用程序性能下降(busy-waiting)。第二种方法就是为了解决轮询的弊端应运而生，t1在b不满足条件的情况下可以让出CPU去干别的事情，等t2改变了b的状态，通过发送一个“信号”告诉t1可以继续往下走了，既不会浪费资源也不会错过时机。

多线程访问一个互斥区域内的资源，如果获取资源的条件不够时，则线程需要等待，直到其他线程释放资源后，唤醒等待条件，使得线程得以继续。条件变量典型应用如bounded producer/consumer问题，两阶段提交算法问题。

在条件变量上有两种基本操作：

Ø 等待（wait）：一个线程因为等待条件P为真而处于等待在条件变量上，此时线程不会占用互斥量;

Ø 通知（signal/notify）：另一个线程在使得条件P为真的时候，通知条件变量。

以下澄清一些容易用错的点：

### pthread的条件变量是边沿触发（edge trigger）

即signal()/broadcast()只会唤醒已经等在wait()上的线程(s)，所以在编码时必须要考虑signal()早于wait()的可能；由于多个线程的执行先后和快慢不能做人为的臆想和假定，一种方案是保证wait的线程一定先执行，显然这种隐式的约定就是定时炸弹；还有一种就是合理使用条件变量，即使wait线程后执行也不会让程序违反意图。

pthread_cond_wait(mutex, cond)内部做三件事情：

Ø 对mutex解锁，

Ø 等待条件cond发生(解锁并阻塞是一个原子操作)

Ø 获得通知后，对mutex重新加锁；

现在互斥对象已被解锁，其它线程可以进入互斥区域，修改条件。此时，pthread_cond_wait()调用还未返回。等待条件 cond是一个阻塞操作，这意味着线程将睡眠，在它苏醒之前不会消耗CPU周期。直到特定条件发生。

### spurious wakeup

在多处理器上，可能没有办法避免signal同时唤醒多个wait线程，考虑以下伪代码实现（序号表明执行顺序）：

pthread_cond_wait(mutex, cond):
```java
    value = cond->value; /* 1 */
    pthread_mutex_unlock(mutex); /* 2 */
    pthread_mutex_lock(cond->mutex); /* 10 */
    if (value == cond->value) { /* 11 */
        me->next_cond = cond->waiter;
        cond->waiter = me;
        pthread_mutex_unlock(cond->mutex);
        unable_to_run(me);                // t3 blocked at here
    } else
        pthread_mutex_unlock(cond->mutex); /* 12 */
    pthread_mutex_lock(mutex); /* 13 */

pthread_cond_signal(cond):
```
```java
    pthread_mutex_lock(cond->mutex); /* 3 */
    cond->value++; /* 4 */
    if (cond->waiter) { /* 5 */
        sleeper = cond->waiter; /* 6 */
        cond->waiter = sleeper->next_cond; /* 7 */
        able_to_run(sleeper); /* 8 */
    }
pthread_mutex_unlock(cond->mutex); /* 9 */
```

第一个线程t1尝试wait该条件变量，第二个线程t2正在并行执行signal，第三t3个已经在wait中，有可能线程一和三都被唤醒。也可以看到，signal唤醒链表头的那个wait线程。

也有可能一个wait线程在未被signal的情况下唤醒(a thread might be awoken from its waiting state even though no thread signaled the condition variable)。

还有一种可能是一个被唤醒的线程马上被调度了，调度器抢占了或调度了其他线程，与此同时，其他的外部实体（进程或硬件）已经使该条件失效。

虽然虚假唤醒在pthread_cond_wait函数中可以解决，为了发生概率很低的情况而降低边缘条件（fringe condition）效率是不值得的，纠正这个问题会降低对所有基于它的所有更高级的同步操作的并发度。所以pthread_cond_wait的实现上没有去解决它(Spurious wakeups may sound strange, but on some multiprocessor systems, making condition wakeup completely predictable might substantially slow all condition variable operations)。所以就引出了条件变量的“标准”用法：

**对于wait** **端：**

1.必须与mutex一起使用，该布尔表达式的读写需受此mutex保护。

```java
2.在mutex已上锁的时候才能调用wait()。
3.把判断布尔条件和wait()放到while循环中。
void wait()
{
    pthread_mutex_lock(&mutex_);
    while (!signaled_)
    {
        pthread_cond_wait(&cond_, &mutex_);
    }
    pthread_mutex_unlock(&mutex_);
}
```

**对于signal/broadcast** **端：**

1.不一定要在mutex已上锁的情况下调用signal（理论上）。

2.在signal之前一般要修改布尔表达式。

3.修改布尔表达式通常要用mutex保护

```java
void signal()
{
    pthread_mutex_lock(&mutex_);
    signaled_ = true;
    pthread_cond_signal(&cond_);
    pthread_mutex_unlock(&mutex_);
}
```

pthread_cond_wait配合使用的while()不仅仅在等待条件变量 **前** 检查条件变量，实际上在等待条件变量 **后** 也检查条件变量。

### wait morphing

解锁互斥量mutex和发出唤醒信号condition_signal是两个单独的操作，那么就存在一个顺序的问题。谁先随后可能会产生不同的结果。如下：

(1) 按照unlock(mutex); condition_signal()顺序，当等待的线程被唤醒时，因为mutex已经解锁，因此被唤醒的线程很容易就锁住了mutex然后从conditon_wait()中返回了。

```java
void signal()
{
    pthread_mutex_lock(&mutex_);
    signaled_ = true;
    pthread_mutex_unlock(&mutex_);
    pthread_cond_signal(&cond_);
}
```

(2) 按照condition_signal(); unlock(mutext)顺序，当等待线程被唤醒时，它试图锁住mutex,但是如果此时mutex还未解锁，则线程又进入睡眠，mutex成功解锁后，此线程在再次被唤醒并锁住mutex，从而从condition_wait()中返回。

```java
void signal()
{
    pthread_mutex_lock(&mutex_);
    signaled_ = true;
    pthread_cond_signal(&cond_);
    pthread_mutex_unlock(&mutex_);
}
```

可以看到，按照(2)的顺序，对等待线程可能会发生2次的上下文切换，严重影响性能。因此在后来的实现中，对(2)的情况，如果线程被唤醒但是不能锁住mutex,则线程被转移(morphing)到互斥量mutex的等待队列中，避免了上下文的切换造成的开销。当然，两种的执行效果是一样的。

C++ 11已经将条件变量纳入了std命名空间，具体参考相关资料。

### References

http://en.wikipedia.org/wiki/Condition_variable#Condition_variables

http://en.wikipedia.org/wiki/Spurious_wakeup

http://www.cppblog.com/Solstice/archive/2013/09/09/203094.html

http://linux.die.net/man/3/pthread_cond_signal

http://blog.csdn.net/fengge8ylf/article/details/6896380

http://en.wikipedia.org/wiki/Single_UNIX_Specification

http://en.cppreference.com/w/cpp/thread/condition_variable

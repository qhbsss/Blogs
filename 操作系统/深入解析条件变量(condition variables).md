---
title: "深入解析条件变量(condition variables)"
source: "https://www.cnblogs.com/harlanc/p/8596211.html?spm=ata.21736010.0.0.44127536qdZIaa"
author:
  - "[[HarlanC]]"
published: 2018-03-18
created: 2026-04-08
description: "深入解析条件变量 什么是条件变量（condition variables） 引用APUE中的一句话: Condition variables are another synchronization mechanism available to threads. These synchronizati"
tags:
  - "clippings"
---
**目录**

- [什么是条件变量（condition variables）##](#_label0)
- [一个例子##](#_label1)
- [关于上面例子的几个疑问##](#_label2)
	- [为什么pthread\_cond\_wait需要加锁？？###](#_label2_0)
		- [在生产者线程中修改条件时为什么要加mutex？？###](#_label2_1)
		- [消费者线程中判断条件为什么要放在while中？？###](#_label2_2)
		- [signal到底是放在unlock之前还是之后？？###](#_label2_3)

**正文**

## 深入解析条件变量#

## 什么是条件变量（condition variables）##

引用APUE中的一句话:

> Condition variables are another synchronization mechanism available to threads.  
> These synchronization objects provide a place for threads to rendezvous. When used with mutexes, condition variables allow threads to wait in a race-free way for arbitrary conditions to occur.

条件变量是线程的另外一种同步机制，这些同步对象为线程提供了会合的场所，理解起来就是两个（或者多个）线程需要碰头（或者说进行交互-一个线程给另外的一个或者多个线程发送消息），我们指定在条件变量这个地方发生，一个线程用于修改这个变量使其满足其它线程继续往下执行的条件，其它线程则接收条件已经发生改变的信号。

条件变量同锁一起使用使得线程可以以一种 **无竞争** 的方式等待任意条件的发生。所谓无竞争就是，条件改变这个信号会发送到所有等待这个信号的线程。而不是说一个线程接受到这个消息而其它线程就接收不到了。

## 一个例子##

具体的函数介绍就不说了，详细参考APUE，下面通过一个例子来详细说一下正确使用条件变量的方法。下例实现了生产者和消费者模型，生产者向队列中插入数据，消费者则在生产者发出 **队列准备好（有数据了）** 后接收消息，然后取出数据进行处理。实现的关键点在以下几个方面：

- 生产者和消费者都对条件变量的使用加了锁
- 消费者调用pthread\_cond\_wait,等待队列是否准备好的信息，注意参数有两个，一个是pthread\_cond\_t，另外一个是pthread\_mutex\_t.

代码：

```cpp
#include <pthread.h>
struct msg {
struct msg *m_next;
/* ... more stuff here ... */
};
struct msg *workq;
pthread_cond_t qready = PTHREAD_COND_INITIALIZER;
pthread_mutex_t qlock = PTHREAD_MUTEX_INITIALIZER;
void
process_msg(void)
{
    struct msg *mp;
    for (;;) {
    pthread_mutex_lock(&qlock);
    while (workq == NULL)
        pthread_cond_wait(&qready, &qlock);
    mp = workq;
    workq = mp->m_next;
    pthread_mutex_unlock(&qlock);
    /* now process the message mp */
    }
}
void
enqueue_msg(struct msg *mp)
{
    pthread_mutex_lock(&qlock);
    mp->m_next = workq;
    workq = mp;
    pthread_mutex_unlock(&qlock);
    pthread_cond_signal(&qready);
}
```

## 关于上面例子的几个疑问##

### 为什么pthread\_cond\_wait需要加锁？？###

pthread\_cond\_wait中的mutex用于保护条件变量，调用这个函数进行等待条件的发生时,mutex会被自动释放，以供其它线程（生产者）改变条件，pthread\_cond\_wait中的两个步骤必须是原子性的(atomically,万恶的APUE中文版把这个单词翻译成了『自动』，误人子弟啊)，也就是说必须把两个步骤捆绑到一起：

- 把调用线程放到条件等待队列上
- 释放mutex

不然呢，如果不是原子性的，上面的两个步骤中间就可能插入其它操作。比如，如果先释放mutex，这时候生产者线程向队列中添加数据，然后signal,之后消费者线程才去『把调用线程放到等待队列上』，signal信号就这样被丢失了。

如果先把调用线程放到条件等待队列上，这时候另外一个线程发送了pthread\_cond\_signal（我们知道这个函数的调用是不需要mutex的），然后调用线程立即获取mutex，两次获取mutex会产生deadlock.

### 在生产者线程中修改条件时为什么要加mutex？？###

如果不这么做信号可能会丢失，看下面的例子：

```lisp
Thead A                             Thread B

pthread_mutex_lock(&qlock);
while (workq == NULL)
                                   mp->m_next = workq;
                                   workq = mp;
                                   pthread_cond_signal(&cond);

pthread_cond_wait(&qready, &qlock);
```

在while判断之后向队列中插入数据，虽然已经有数据了，但线程A还是调用了pthread\_cond\_wait等待下一个信号到来。。

### 消费者线程中判断条件为什么要放在while中？？###

```lisp
while (workq == NULL)
    pthread_cond_wait(&qready, &qlock);
mp = workq;
```

我们把while换成if可不可以呢？

```lisp
if (workq == NULL)
    pthread_cond_wait(&qready, &qlock);
mp = workq;
```

答案是不可以，一个生产者可能对应着多个消费者，生产者向队列中插入一条数据之后发出signal，然后各个消费者线程的pthread\_cond\_wait获取mutex后返回，当然，这里只有一个线程获取到了mutex，然后进行处理，其它线程会pending在这里，处理线程处理完毕之后释放mutex，刚才等待的线程中有一个获取mutex，如果这里用if，就会在当前队列为空的状态下继续往下处理，这显然是不合理的。

### signal到底是放在unlock之前还是之后？？###

```cpp
void
enqueue_msg(struct msg *mp)
{
    pthread_mutex_lock(&qlock);
    mp->m_next = workq;
    workq = mp;
    pthread_mutex_unlock(&qlock);
    pthread_cond_signal(&qready);
}
```

如果先unlock，再signal,如果这时候有一个消费者线程恰好获取mutex，然后进入条件判断，这里就会判断成功，从而跳过pthread\_cond\_wait,下面的signal就会不起作用；另外一种情况，一个优先级更低的不需要条件判断的线程正好也需要这个mutex，这时候就会转去执行这个优先级低的线程，就违背了设计的初衷。

```cpp
void
enqueue_msg(struct msg *mp)
{
    pthread_mutex_lock(&qlock);
    mp->m_next = workq;
    workq = mp;
    pthread_cond_signal(&qready);
    pthread_mutex_unlock(&qlock);
}
```

如果把signal放在unlock之前，消费者线程会被唤醒，获取mutex发现获取不到，就又去sleep了。浪费了资源.但是在LinuxThreads或者NPTL里面，就不会有这个问题，因为在Linux 线程中，有两个队列，分别是cond\_wait队列和mutex\_lock队列， cond\_signal只是让线程从cond\_wait队列移到mutex\_lock队列，而不用返回到用户空间，不会有性能的损耗。  
所以在Linux中推荐使用这种模式。

References:

[why pthread\_cond\_wait need an lock?](https://stackoverflow.com/questions/19562304/why-pthread-cond-wait-need-an-lock)

[Calling pthread\_cond\_signal without locking mutex](https://stackoverflow.com/questions/4544234/calling-pthread-cond-signal-without-locking-mutex?noredirect=1&lq=1)

[Why do pthreads’ condition variable functions require a mutex?](https://stackoverflow.com/questions/2763714/why-do-pthreads-condition-variable-functions-require-a-mutex/18604957)

[indirect priority inversion](http://austin-group-l.opengroup.narkive.com/lKcmfoRI/predictable-scheduling-behavior-in-pthread-cond-broadcast)

[pthread\_cond\_signal 和 pthread\_mutex\_unlock顺序问题](http://blog.csdn.net/linuxsmallping/article/details/53198701)

  
作者： [HarlanC](http://www.cnblogs.com/harlanc/)  
  
博客地址： [http://www.cnblogs.com/harlanc/](http://www.cnblogs.com/harlanc/)  
个人博客： [http://www.harlancn.me/](http://blog.harlanc.vip/)  
本文版权归作者和博客园共有，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出, [原文链接](#)  
  

posted @ [HarlanC](https://www.cnblogs.com/harlanc) 阅读(34450) 评论(1) 收藏 [举报](https://report.cnblogs.com/?targetLink=https%3A%2F%2Fwww.cnblogs.com%2Fharlanc%2Fp%2F8596211.html&targetId=8596211&targetType=0)
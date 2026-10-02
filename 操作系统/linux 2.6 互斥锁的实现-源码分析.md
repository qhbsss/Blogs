---
title: "linux 2.6 互斥锁的实现-源码分析"
source: "https://www.jianshu.com/p/a7ddb2998b3b?spm=ata.21736010.0.0.44127536qdZIaa"
author:
published: 2017-05-03
created: 2026-04-08
description: "Linux 2.6 kernel的源码，下面结合代码来分析一下在X86体系结构下，互斥锁的实现原理。 代码分析: 1. 首先介绍一下互斥锁所使用的数据结构： 2. 互斥锁加锁..."
tags:
  - "clippings"
---
Linux 2.6 kernel的源码，下面结合代码来分析一下在X86体系结构下，互斥锁的实现原理。

### 代码分析:

##### 1\. 首先介绍一下互斥锁所使用的数据结构：

```cpp
struct mutex {
   atomic_t  count; //引用计数器,1: 所可以利用,小于等于0：该锁已被获取，需要等待
   spinlock_t  wait_lock;//自旋锁类型，保证多cpu下，对等待队列访问是安全的。
   spinlock_t  wait_lock; //等待队列，如果该锁被获取，任务将挂在此队列上，等待调度。
   struct list_head wait_list;
};
```

##### 2\. 互斥锁加锁函数

```csharp
void inline __sched mutex_lock(struct mutex *lock)
```

调用了宏：

```csharp
__mutex_fastpath_lock(&lock->count, __mutex_lock_slowpath);
```

宏的定义：将mutex数据结构中，引用计数器减1，如果不为负数就返回，如果为负数，需要调用函数：\_\_mutex\_lock\_slowpath，接下来我们再来分析这个函数，我们先来分析一下这个宏。

```cpp
#define __mutex_fastpath_lock(count, fail_fn)  /
do {        /
   unsigned int dummy;    /
   //检查参数类型的有效性
   typecheck(atomic_t *, count);    /
   typecheck_fn(void (*)(atomic_t *), fail_fn);  /
   //输入，输出寄存器为eax,输入为count,输出为dummy,仅将eax的值减1
   asm volatile(LOCK_PREFIX "  decl (%%eax)/n"  /
   "  jns 1f /n"    /
  //如果减后为负数，调用回调函数，尝试阻塞该进程
   "  call " #fail_fn "/n"  /
   "1:/n"    /
   : "=a" (dummy)    /
   : "a" (count)    /
   : "memory", "ecx", "edx");  /
} while (0)
```

##### 3\. 回调函数

```csharp
static noinline int __sched __mutex_lock_killable_slowpath(atomic_t *lock_count)
{
//通过结构的成员地址，获取该结构地址
   struct mutex *lock = container_of(lock_count, struct mutex, count);
//该函数在后面做详细介绍
   return __mutex_lock_common(lock, TASK_KILLABLE, 0, _RET_IP_);
}
```

##### 4\. 阻塞进程真正获取锁的地方

```csharp
static inline int __sched
__mutex_lock_common(struct mutex *lock, long state, unsigned int subclass,unsigned long ip)
{
   //获取当前进程的task_struct的地址
   struct task_struct *task = current;
   struct mutex_waiter waiter;
   unsigned int old_val;
   unsigned long flags;

   //对该锁上的等待队列加自旋锁，防止多个CPU的情况。
   spin_lock_mutex(&lock->wait_lock, flags);

   //将该任务添加到该锁的等待队列上
   list_add_tail(&waiter.list, &lock->wait_list);
   waiter.task = task;

   //用一条汇编指令对count进行付值，lock->count=-1,保证该操作在一个cpu上是原子的
   old_val = atomic_xchg(&lock->count, -1);

   //如果lock->count之前的值为1，说明是可以获取锁的
   if (old_val == 1)
       goto done;
   lock_contended(&lock->dep_map, ip);

   for (;;) {
       //在这个地方，又尝试去获取锁，处理方式如上。
       old_val = atomic_xchg(&lock->count, -1);
       if (old_val == 1)
           break;

       //如果该进程是可中断的，或者该进程是可kiilable的，如果有信号被递送到该任务，那么该进程将从等待队列中移除
       if (unlikely((state == TASK_INTERRUPTIBLE &&signal_pending(task)) ||(state == TASK_KILLABLE &&fatal_signal_pending(task)))) {
           mutex_remove_waiter(lock, &waiter,task_thread_info(task));
           mutex_release(&lock->dep_map, 1, ip);
           spin_unlock_mutex(&lock->wait_lock, flags);
           debug_mutex_free_waiter(&waiter);
           //返回被信号中断
           return -EINTR;
       }
       __set_task_state(task, state);

       //如果还不能获取所，则将自旋锁解除，当从schedule返回时再次获取自旋锁，重复如上操作。
       spin_unlock_mutex(&lock->wait_lock, flags);
       schedule();
       spin_lock_mutex(&lock->wait_lock, flags);
   }
   //表示已经获取了锁
   done:
   lock_acquired(&lock->dep_map);
   //将该任务从等待队列中删除
   mutex_remove_waiter(lock, &waiter, task_thread_info(task));
   debug_mutex_set_owner(lock, task_thread_info(task));
   //如果等待队列为空将lock->count置为0
   if (likely(list_empty(&lock->wait_list)))
       atomic_set(&lock->count, 0);
   spin_unlock_mutex(&lock->wait_lock, flags);
   debug_mutex_free_waiter(&waiter);
   return 0;
}
```

##### 5\. 解锁过程

```csharp
void __sched mutex_unlock(struct mutex *lock)
{
   //解锁后lock->count将从0变为1
   __mutex_fastpath_unlock(&lock->count,__mutex_unlock_slowpath);
}
```

//该宏是对引用计数器实行加1操作，如果加后小于等于0，说明该等待队列上还有任务需要获取锁。调用\_\_mutex\_unlock\_slowpath函数。

```cpp
#define __mutex_fastpath_unlock(count, fail_fn)  /
do {        /
   unsigned int dummy;    /
   /
   typecheck(atomic_t *, count);    /
   typecheck_fn(void (*)(atomic_t *), fail_fn);  /
   /
   asm volatile(LOCK_PREFIX "  incl (%%eax)/n"  /
       "  jg 1f/n"    /
       "  call " #fail_fn "/n"  /
       "1:/n"    /
       : "=a" (dummy)    /
       : "a" (count)    /
       : "memory", "ecx", "edx");  /
} while (0)
```

//该函数调用了\_\_mutex\_unlock\_slowpath函数。

```cpp
static noinline void
__mutex_unlock_slowpath(atomic_t *lock_count)
{
   __mutex_unlock_common_slowpath(lock_count, 1);
}
```

```csharp
static inline void
__mutex_unlock_common_slowpath(atomic_t *lock_count, int nested)
{
   //通过结构的成员地址，获取该结构地址
   struct mutex *lock = container_of(lock_count, struct mutex, count);

   unsigned long flags;
   //为等待队列加自旋锁
   spin_lock_mutex(&lock->wait_lock, flags);
   mutex_release(&lock->dep_map, nested, _RET_IP_);
   debug_mutex_unlock(lock);
   if (__mutex_slowpath_needs_to_unlock())
       atomic_set(&lock->count, 1);

   //先看看等待队列是不是为空了，如果已经为空，不需要做任何处理，否则将该等待队列上面的队首进程唤醒
   if (!list_empty(&lock->wait_list)) {
       struct mutex_waiter *waiter =list_entry(lock->wait_list.next,struct mutex_waiter, list);
       debug_mutex_wake_waiter(lock, waiter);
       wake_up_process(waiter->task);
   }

   debug_mutex_clear_owner(lock);
   spin_unlock_mutex(&lock->wait_lock, flags);

}
```

##### 总结：

互斥锁的实现，实际上就是一把锁维护了一个等待队列和一个引用计数器，当获取锁之前，先对引用计数器减1操作，如果为非负，则可以获取锁进入临界区。否则需要将该任务挂在该等待对列上。

转自： [http://blog.csdn.net/tq02h2a/article/details/4317211](https://link.jianshu.com/?t=http://blog.csdn.net/tq02h2a/article/details/4317211)
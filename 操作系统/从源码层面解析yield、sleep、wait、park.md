---
title: "从源码层面解析yield、sleep、wait、park"
source: "https://juejin.cn/post/6844903971463626766?spm=ata.21736010.0.0.44127536qdZIaa"
author:
  - "[[SimpleYoung]]"
published: 2019-12-20
created: 2026-04-08
description: "Thread的yield()、sleep()方法、Object的wait()方法和Unsafe的park()方法，都能够阻塞当前线程，让出CPU执行权，那么它们底层实现上又有什么区别呢？本文将从JVM源码层面分别解析这几个方法的实现逻辑。 这里就比较清晰了，首先调用当前任务（线…"
tags:
  - "clippings"
---
`Thread` 的 `yield()` 、 `sleep()` 方法、 `Object` 的 `wait()` 方法和 `Unsafe` 的 `park()` 方法，都能够阻塞当前线程，让出CPU执行权，那么它们底层实现上又有什么区别呢？本文将从JVM源码层面分别解析这几个方法的实现逻辑。

#### Thread::yield

是一个JNI方法

体验AI代码助手 代码解读复制代码public static native void yield();

hotspot的JNI的实现入口一般都是在 `jvm.cpp` 中

```java
体验AI代码助手 代码解读复制代码JVM_ENTRY(void, JVM_Yield(JNIEnv *env, jclass threadClass))
  // ...
  if (os::dont_yield()) return;
  // ...
  if (ConvertYieldToSleep) {
    os::sleep(thread, MinSleepInterval, false); // 使用sleep替代
  } else {
    os::yield(); // 默认调用os的yield实现
  }
```
JVM_END

最终会调用 `sched_yield()`

```java
体验AI代码助手 代码解读复制代码void os::yield() {
  sched_yield();
}
```

这是一个linux的系统调用，下面是相关的内核代码

```java
体验AI代码助手 代码解读复制代码SYSCALL_DEFINE0(sched_yield)
{
  do_sched_yield();
  return 0;
}

static void do_sched_yield(void)
{
  // ...
  current->sched_class->yield_task(rq);
  // ...
  schedule();
}
```

这里就比较清晰了，首先调用当前任务（线程）对应调度类的 `yield_task()` 函数，然后调用 `schedule()` 函数执行一次重新调度，相当于为当前CPU选择下一个要执行的任务。

对于普通线程来说，对应的调度队列是 `cfs_rq` ，对应的调度类是 `cfs_sched_class` ，对应的 `yield_task()` 函数是 `yield_task_fair()`

```java
体验AI代码助手 代码解读复制代码static void yield_task_fair(struct rq *rq)
{
    // ...
    clear_buddies(cfs_rq, se);
    if (curr->policy != SCHED_BATCH) {
        update_rq_clock(rq);
        update_curr(cfs_rq); // 更新当前任务的vruntime等信息
        rq_clock_skip_update(rq);
    }
    set_skip_buddy(se); // 设置当前任务为cfs_rq->skip
}
```

其实这里相当于只是把当前线程标记成了skip

接下来进行一次 `__schedule()` 的调用，通俗地讲，就是从当前CPU的运行队列中取出一个任务执行，并将前一个任务放回队列中去。

对于普通任务来说，体现函数 `pick_next_entity` 中，这个函数从 `cfs_rq` 的红黑树队列取出下一个任务的调度实体

```java
体验AI代码助手 代码解读复制代码pick_next_entity(struct cfs_rq *cfs_rq, struct sched_entity *curr)
{
  if (!left || (curr && entity_before(curr, left)))
        left = curr; // 如果没有标记skip的话，当前任务还有可能继续执行

    se = left;
    // ...
    if (cfs_rq->skip == se) {
        struct sched_entity *second;
        if (se == curr) {
            second = __pick_first_entity(cfs_rq); // 如果标记为skip了，从队列中取一个出来
        }
    // ...
        if (second && wakeup_preempt_entity(second, left) < 1)
            se = second;
    }
  // ...
    return se;
}
```

此时当前任务其实被标记为skip了，所以即使当前任务的vruntime比红黑树（通过vruntime排序，它是task的加权运行时间，权重与task优先级有关）最小节点低，也会返回最小节点，作为下一次要执行的任务。也就是说，只要红黑树不是空的，当前线程就会让出CPU。

然后，当前任务当然还要添加到队列里面去等待下一次调度啊。

```java
体验AI代码助手 代码解读复制代码static struct task_struct * pick_next_task_fair(...)
{
  // ...
  if (prev != p) { // 表示需要任务的切换了
    //...
    put_prev_entity(cfs_rq, pse); // 将当前任务再添加到红黑树中
    set_next_entity(cfs_rq, se); // 从红黑树中移除一个节点，并且设置为当前任务
  }
  // ...
}
```

#### Thread::sleep

也是一个JNI方法

体验AI代码助手 代码解读复制代码public static native void sleep(long millis) throws InterruptedException;

`sleep` 的入口如下，可以看出来，如果参数是0的话，可以转换成 `yield`

```java
体验AI代码助手 代码解读复制代码JVM_ENTRY(void, JVM_Sleep(JNIEnv* env, jclass threadClass, jlong millis))
  // ...
  if (millis == 0) {
    if (ConvertSleepToYield) { // 默认是false
      os::yield();
    } else {
      ThreadState old_state = thread->osthread()->get_state();
      thread->osthread()->set_state(SLEEPING);
      os::sleep(thread, MinSleepInterval, false); // 小睡一下
      thread->osthread()->set_state(old_state);
    }
  } else {
    ThreadState old_state = thread->osthread()->get_state();
    thread->osthread()->set_state(SLEEPING);
    if (os::sleep(thread, millis, true) == OS_INTRPT) {
      // 处理中断
    }
    thread->osthread()->set_state(old_state);
  }
  // ...
```
JVM_END

调用了 `os::sleep` 函数（JVM实现的os，并不是操作系统的sleep），linux平台的实现代码如下

```javascript
体验AI代码助手 代码解读复制代码int os::sleep(Thread* thread, jlong millis, bool interruptible) {
  ParkEvent * const slp = thread->_SleepEvent ;
  if (interruptible) {
    jlong prevtime = javaTimeNanos();

    for (;;) {
      if (os::is_interrupted(thread, true)) {
        return OS_INTRPT;
      }

      jlong newtime = javaTimeNanos();

      if (newtime - prevtime < 0) {
        // ...
      } else {
        millis -= (newtime - prevtime) / NANOSECS_PER_MILLISEC;
      }

      if(millis <= 0) {
        return OS_OK;
      }
      // ...
      {
        // ...
        slp->park(millis);  // 调用的是os::PlatformEvent::park
        // ...
      }
    }
  } else {
    // ...
  }
}
```

最终是调用 `ParkEvent` 的 `park` 函数，实现如下

```java
体验AI代码助手 代码解读复制代码int os::PlatformEvent::park(jlong millis) {
  int v ;
  for (;;) {
      v = _Event ;
      if (Atomic::cmpxchg (v-1, &_Event, v) == v) break ; // cas设置_Event
  }
  if (v != 0) return OS_OK ;  // os::PlatformEvent::unpark的时候会设置_Event=1，这里就会提前跳出
  struct timespec abst;
  compute_abstime(&abst, millis);  // 0. 计算绝对时间

  int ret = OS_TIMEOUT;
  int status = pthread_mutex_lock(_mutex);  // 1. 加mutex锁
  // ...
  ++_nParked ;

  while (_Event < 0) {
    status = os::Linux::safe_cond_timedwait(_cond, _mutex, &abst); // 2. 等待
    if (status != 0 && WorkAroundNPTLTimedWaitHang) {
      pthread_cond_destroy (_cond);
      pthread_cond_init (_cond, os::Linux::condAttr()) ;
    }
    if (!FilterSpuriousWakeups) break ;                 // previous semantics
    if (status == ETIME || status == ETIMEDOUT) break ;
  }
  --_nParked ;
  if (_Event >= 0) {
     ret = OS_OK;
  }
  _Event = 0 ;
  status = pthread_mutex_unlock(_mutex); // 3. 释放mutex锁
  // ...
  return ret;
}
```

熟悉的味道吧，上面是一个典型的Mesa Monitor条件等待代码了，其中 `os::Linux::safe_cond_timedwait` 的代码比较简单，就是调用了 `pthread_cond_timedwait` 函数

```java
体验AI代码助手 代码解读复制代码int os::Linux::safe_cond_timedwait(pthread_cond_t *_cond, pthread_mutex_t *_mutex, const struct timespec *_abstime)
{
   if (is_NPTL()) {
      return pthread_cond_timedwait(_cond, _mutex, _abstime);
   } else {
      int fpu = get_fpu_control_word();
      int status = pthread_cond_timedwait(_cond, _mutex, _abstime);
      set_fpu_control_word(fpu);
      return status;
   }
}
```

#### Object::wait

也是JNI方法

体验AI代码助手 代码解读复制代码public final native void wait(long timeout) throws InterruptedException;

对应的入口是 `JVM_MonitorWait`

```java
体验AI代码助手 代码解读复制代码JVM_ENTRY(void, JVM_MonitorWait(JNIEnv* env, jobject handle, jlong ms))
  JVMWrapper("JVM_MonitorWait");
  Handle obj(THREAD, JNIHandles::resolve_non_null(handle));
  JavaThreadInObjectWaitState jtiows(thread, ms != 0);
  if (JvmtiExport::should_post_monitor_wait()) {
    JvmtiExport::post_monitor_wait((JavaThread *)THREAD, (oop)obj(), ms);
  }
  ObjectSynchronizer::wait(obj, ms, CHECK);
```
JVM_END

显而易见， `Object::wait` 是配合 `synchronized` 使用的，对应的代码是在 `synchronizer.cpp` 中，其中的 `wait` 实现代码如下

```java
体验AI代码助手 代码解读复制代码void ObjectSynchronizer::wait(Handle obj, jlong millis, TRAPS) {
  if (UseBiasedLocking) {
    BiasedLocking::revoke_and_rebias(obj, false, THREAD);
    assert(!obj->mark()->has_bias_pattern(), "biases should be revoked by now");
  }
  if (millis < 0) {
    TEVENT (wait - throw IAX) ;
    THROW_MSG(vmSymbols::java_lang_IllegalArgumentException(), "timeout value is negative");
  }
  ObjectMonitor* monitor = ObjectSynchronizer::inflate(THREAD, obj()); // 膨胀为重量级锁
  DTRACE_MONITOR_WAIT_PROBE(monitor, obj(), THREAD, millis);
  monitor->wait(millis, true, THREAD); // 调用wait

  dtrace_waited_probe(monitor, obj, THREAD);
}
```

首先撤销偏向锁，然后膨胀为重量级锁，再调用 `ObjectMonitor` 的 `wait` 函数。

忽略 `ObjectMonitor` 复杂的实现机制，我们只看关键的地方，如下所示

```javascript
体验AI代码助手 代码解读复制代码void ObjectMonitor::wait(jlong millis, bool interruptible, TRAPS) {
  Thread * const Self = THREAD ;
  // ...
  if (interruptible && Thread::is_interrupted(Self, true) && !HAS_PENDING_EXCEPTION) {
     // ...
     THROW(vmSymbols::java_lang_InterruptedException()); // 处理中断
     return ;
   }
  // ...
  AddWaiter (&node) ; // 1. 添加到ObjectMonitor的等待队列_WaitSet中
  // ...
  exit (true, Self) ; // 2. 释放java的monitor锁（也就是monitorexit）
  // ...
       if (interruptible &&
```
           (Thread::is_interrupted(THREAD, false) ||
```java
            HAS_PENDING_EXCEPTION)) {
           // Intentionally empty
       } else if (node._notified == 0) {
         if (millis <= 0) {
            Self->_ParkEvent->park () ;
         } else {
            ret = Self->_ParkEvent->park (millis) ; // 3. 等待，和Thread::sleep一样的
         }
       }
  //...
}
```

到这里，是不是明白为啥 `wait` 要写在 `synchronized` 块里面了吧，面试官再问你 `sleep和wait的区别` ，是不是就可以开㨃了啊？

最终也是调用了 `os::PlatformEvent::park` 函数，与 `sleep` 的实现方式一致。

#### Unsafe::park

同样也是JNI

体验AI代码助手 代码解读复制代码public native void park(boolean isAbsolute, long time);

`Unsafe` 类比较特殊，它的native方法的入口在 `unsafe.cpp` 里面

```java
体验AI代码助手 代码解读复制代码UNSAFE_ENTRY(void, Unsafe_Park(JNIEnv *env, jobject unsafe, jboolean isAbsolute, jlong time))
  // ...
  thread->parker()->park(isAbsolute != 0, time);
  // ...
```
UNSAFE_END

和 `sleep` 、 `wait` 不同的是，这里调用的是 `Parker` 的 `park` 函数，而不是 `os::PlatformEvent::park` 了

```java
体验AI代码助手 代码解读复制代码void Parker::park(bool isAbsolute, jlong time) {
  if (Thread::is_interrupted(thread, false)) {
    return;
  }

  timespec absTime;
  if (time < 0 || (isAbsolute && time == 0) ) { // don't wait at all
    return;
  }
  if (time > 0) {
    unpackTime(&absTime, isAbsolute, time); // 0. 计算绝对时间
  }
  if (Thread::is_interrupted(thread, false) ||
// 1. 尝试加mutex锁

    return;
  }
  int status ;
  if (_counter > 0)  { // no wait needed
    _counter = 0;
    status = pthread_mutex_unlock(_mutex); // 2.1 在park之前调用了unpark，就不会wait了
    // ...
    return;
  }
  if (time == 0) {
    _cur_index = REL_INDEX; // arbitrary choice when not timed
    status = pthread_cond_wait (&_cond[_cur_index], _mutex) ;  // 2.2 入参为0，一直等待
  } else {
    _cur_index = isAbsolute ? ABS_INDEX : REL_INDEX;
    // 2.3 带超时的等待
    status = os::Linux::safe_cond_timedwait (&_cond[_cur_index], _mutex, &absTime) ;
    if (status != 0 && WorkAroundNPTLTimedWaitHang) {
      pthread_cond_destroy (&_cond[_cur_index]) ;
      pthread_cond_init    (&_cond[_cur_index], isAbsolute ? NULL : os::Linux::condAttr());
    }
  }
  _counter = 0 ;
  status = pthread_mutex_unlock(_mutex) ; // 3. 释放mutex锁
}
```

还是熟悉的味道，最终仍然是依赖于 `pthread_cond_timedwait` 来阻塞线程，与 `sleep` 不同的是，如果参数是0， `park` 会一直阻塞。

#### 总结

`yield` 相当于进行了一次主动调度，当前线程放弃CPU使用权，重新进入CPU的运行队列，等待下一次调度。

`sleep` 、 `wait` 和 `park` 最终都是借助于 `pthread_cond_timedwait` 实现阻塞，其中 `wait` 比较特殊的是，需要结合 `ObjectMonitor` 使用。

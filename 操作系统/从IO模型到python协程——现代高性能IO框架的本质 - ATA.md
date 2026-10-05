---
title: "从I/O模型到python协程——现代高性能IO框架的本质 - ATA"
source: "https://ata.atatech.org/articles/11020604937?spm=ata.23639420.0.0.15527536QKdp63"
author:
published:
created: 2026-04-08
description:
tags:
  - "clippings"
---
云智能集团







## 从I/O模型到python协程——现代高性能IO框架的本质

昨天14:41发表42次浏览








协程是我们在开发过程中常常使用的一个功能，本文从操作系统的I/O开始，讲解什么是协程，为什么用协程。以帮助大家理解协程的概念，事件循环为什么会卡死，并发变串行的原因，混用同步库导致性能骤降，如何开发流式输出代码 等开发中常常遇到的问题。

另外Claude Code源码中应用非常多的异步生成器，PYTHON也支持完全一样的能力，文章也会介绍。

## 操作系统的 I/O 模型

### 什么是 I/O 操作？

I/O（Input/Output）是程序与外部世界交互的方式：

- 网络 I/O：socket 的读写（如 HTTP 请求）

- 文件 I/O：文件的读写

- 设备 I/O：键盘、鼠标、显示器

关键特征：I/O 操作的速度远远慢于 CPU

- CPU 时钟周期：~0.3 纳秒

- 从内存读取数据：~100 纳秒

- 从 SSD 读取数据：~50 微秒（慢 500 倍）

- 从网络读取数据：~1-100 毫秒（慢 10000-1000000 倍）

以上当我们的代码可能出现网络调用或文件读写时，就要小心啦！你的代码可能一不小心就会并发阻塞了！

### 用户空间和内核空间

简单的说我们把计算机的内存分为两大类

用户空间：用来运行应用程序

内核空间：用来运行操作系统内核程序

### 操作系统的 I/O 两个阶段

任何 I/O 操作都包含两个阶段：

阶段 1：等待数据就绪（Waiting for data to be ready） --> socket ready

↓

阶段 2：将数据从内核空间复制到用户空间（Copying data from kernel to user space）

举例：读取网络数据

你的程序 操作系统内核 网卡

| | |

|--- recv() --------------->| |

| |--- 等待数据到达(耗时) -------->|

| |<-- 数据到达 -------------|

|<-- 数据复制 --------------| |

| | |

阶段 1：等待网卡收到数据（可能很慢）阶段 2：将数据从内核缓冲区复制到你的程序内存（很快）

所有的 I/O 模型差异，都体现在这两个阶段上"你的程序在干什么"。

### 阻塞 I/O vs 非阻塞 I/O

阻塞与非阻塞——描述的是阶段一的行为，即"发起 I/O 调用时，数据没就绪怎么办"。

#### 阻塞 I/O（Blocking I/O）

```c
// C 语言示例
int sockfd = socket(AF_INET, SOCK_STREAM, 0);
char buffer[1024];
// 阻塞调用
recv(sockfd, buffer, sizeof(buffer), 0); // ← 线程在这里卡住
// 线程被操作系统挂起，无法执行其他代码
// 直到数据到达并复制完成
printf("收到数据: %s\\n", buffer); // ← 只有数据到达后才执行
```

线程状态变化：

运行态 (Running)

↓ 调用 recv()

阻塞态 (Blocked) ← 线程被操作系统挂起，不消耗 CPU

↓ 数据到达

就绪态 (Ready)

↓ 被调度器选中

运行态 (Running)

特点：

- 线程在等待期间完全停止工作

- 操作系统会将线程从 CPU 上移除

- 不消耗 CPU 资源，但线程无法做任何事情

#### 非阻塞 I/O（Non-blocking I/O）

```c
// 设置 socket 为非阻塞模式
fcntl(sockfd, F_SETFL, O_NONBLOCK);
char buffer[1024];
int result;
while (1) {
    // 非阻塞调用
    result = recv(sockfd, buffer, sizeof(buffer), 0);
    if (result == -1 && errno == EAGAIN) {
        // 数据还没准备好，立即返回
        printf("数据未就绪，继续做其他事情...\\n");
        // 可以做其他工作
        do_something_else();
        continue;
    }
    if (result > 0) {
        // 数据已就绪并复制完成
        printf("收到数据: %s\\n", buffer);
        break;
    }
}
```

特点：

- 调用立即返回，不会阻塞线程

- 如果数据未就绪，返回错误码 `EAGAIN` 或 `EWOULDBLOCK`

- 线程可以继续执行其他代码

- 缺点：需要不断轮询（polling），浪费 CPU

### 同步 I/O vs 异步 I/O

同步与异步——描述的是整个 I/O 操作完成的模式，它是操作系统内核的行为。即"谁来完成数据搬运，以及你怎么知道它完成了"。

- 同步 I/O：不管阶段一你是阻塞等的还是非阻塞轮询的，到了阶段二（数据从内核拷贝到用户空间），这个动作是你的线程自己参与完成的，在拷贝完成之前你的线程仍然被阻塞。换句话说，你主动去"取"结果。

- 异步 I/O：你发起 I/O 请求后就彻底不管了，两个阶段都由内核代劳。内核把数据准备好、拷贝到你指定的用户空间缓冲区之后，通过回调或信号通知你"全部搞定了"。你是被动收到结果的。

注意：事实上，我们目前使用的大多数IO框架，支持的都是同步I/O！因为在阶段二，你的线程都要亲自参与数据拷贝并被阻塞。

因此，在IO框架层面，我们讨论IO可以只关注阻塞与非阻塞在技术层面的问题！因为本质上大家都是同步的（Windows IOCP ，Linux 5.1 io_uring支持真正的异步 I/O，但生态有限）！

所以I/O多路复用解决的是阶段1的问题！！！！

### I/O 多路复用（I/O Multiplexing）

什么是多路复用：

- 一个线程管理多个socket ✅

- 事件驱动，只在有事件时工作，避免无效轮询的 CPU ✅

#### select/epoll 的工作原理

```c
// epoll 示例（Linux）
int epoll_fd = epoll_create(1);
// 注册多个 socket 到 epoll
struct epoll_event event;
event.events = EPOLLIN; // 监听可读事件
event.data.fd = sockfd1;
epoll_ctl(epoll_fd, EPOLL_CTL_ADD, sockfd1, &event);
event.data.fd = sockfd2;
epoll_ctl(epoll_fd, EPOLL_CTL_ADD, sockfd2, &event);
// 等待事件
struct epoll_event events[10];
while (1) {
    // 阻塞等待，直到有 socket 就绪
    int n = epoll_wait(epoll_fd, events, 10, -1);
    for (int i = 0; i < n; i++) {
        int fd = events[i].data.fd;
        // 只有就绪的 socket 才会被处理
        recv(fd, buffer, sizeof(buffer), 0); // 此时 recv 不会阻塞
        handle_request(fd);
    }
}
```

简述上述代码的流程：

epoll 向内核注册需要监视的 socket，

当数据到达时，内核的网络栈会触发注册的回调函数（在内核空间），该回调将 socket 加入就绪列表并唤醒睡眠的线程，

epoll_wait() 返回就绪的 socket 列表，

用户空间调用 recv() 接收数据。

#### epoll是阻塞I/O还是非阻塞I/O

epoll 是一个阻塞的等待机制配合非阻塞的 I/O 操作。

epoll_wait() 阻塞等待"谁就绪了"这个事件，但它监控的每个 socket 上的 I/O 操作本身是非阻塞的。

它既不是纯粹的阻塞 I/O，也不是纯粹的非阻塞 I/O，而是把阻塞点从"每个 I/O 操作"收拢到了"一个统一的等待点"上。

与阻塞IO的区别：

- 阻塞IO：一个线程只处理一个socket！该线程执行到recv()后 ，就阻塞等待socket ready（耗时）

- epoll： 一个线程能处理多个socket，它通过调用epoll_wait()，轮询哪个socket就绪了，只有当有socket ready后，才调用recv()

与非阻塞IO的区别：

- 非阻塞IO：主动问询socket 是否ready

- epoll：内核收到ready 的socket后主动通知epoll

## 协程

协程的定义：一个可以暂停执行、稍后再恢复执行的函数。

### 协程 VS 普通函数

普通函数的执行模型是"调用 → 运行到底 → 返回"，一旦开始就必须运行完。

协程打破了这个限制——它可以运行到一半主动让出控制权，保留当前的所有状态（局部变量、执行到哪一行），之后再从暂停的地方恢复继续跑。

普通函数： 调用 ──────────────────► 返回

（中间不能暂停）

协程： 调用 ───► 暂停 ───► 恢复 ───► 暂停 ───► 恢复 ───► 返回

（可以多次暂停和恢复）

### 协程 VS 线程

线程是操作系统调度的，任何时候操作系统都可以强制打断一个线程去执行另一个（抢占式多任务）。

协程是程序自己调度的，只有协程主动执行到 await / yield 时才会让出控制权（协作式多任务）。这意味着协程没有线程切换的开销（上下文切换成本低几个数量级），也不需要锁来保护共享状态——因为在两个 await 之间，不会有其他协程插进来执行。

### 为什么需要协程

- I/O 密集型应用的挑战

- 传统解决方案的缺陷

- 方案 A：多线程（GIL 限制（Python 的多线程不是真正的并行））

- 方案 B：进程池

- 协程的优势

协程（Coroutine）：用户态的轻量级线程

特点：

├内存占用小（每个协程 ~几 KB）

├切换开销低（无需操作系统介入）

├单线程内调度（避免 GIL 问题）

└适合 I/O 密集型任务

---

具体到实现方式，协程有两个阶段：

- Python 3.4：生成器协程（Generator-based Coroutines）

> ⚠️ 此语法已在 Python 3.11 中彻底移除，不可再用。

@asyncio.coroutine

def fetch():

yield from asyncio.sleep(1)

- Python 3.5+：原生协程（Native Coroutines）

async def fetch():

await asyncio.sleep(1)


| 版本          | 官方名称  | 实现方式               | 语法                   |
| ----------- | ----- | ------------------ | -------------------- |
| Python 3.4  | 生成器协程 | 生成器 + `yield from` | `@asyncio.coroutine` |
| Python 3.5+ | 原生协程  | 原生协程对象             | `async/await`        |


### 生成器

生成器是协程的原型与基石，协程是生成器在并发场景下的专业化进化。

两者共享“暂停/恢复/状态保持”的核心机制

随着python版本的迭代，他们的设计目标、语法约束和底层实现已彻底分化。

但是从生成器着手仍然是理解协程最好的方式！

生成器是一种特殊的迭代器，它可以暂停和恢复执行。

\# 使用生成器模拟协程

def task1():

print("Task 1: 开始")

yield # 暂停，让出控制权

print("Task 1: 继续")

yield

print("Task 1: 结束")

def task2():

print("Task 2: 开始")

yield

print("Task 2: 继续")

yield

print("Task 2: 结束")

\# 简单的调度器

def scheduler():

tasks = [task1(), task2()]

```java
print("start")

while tasks:

for task in tasks[:]: # 复制列表，避免修改时出错
```

try:

next(task) # 恢复执行

except StopIteration:

tasks.remove(task) # 任务完成

scheduler()

执行流程：

scheduler() 启动

↓

tasks = [task1(), task2()]

→ 创建两个生成器对象（函数体不执行）

↓

print("start")

→ 输出: start

↓

while tasks: (第一次循环)

↓

for task in tasks[:]:

→ task = task1 的生成器

↓

next(task)

→ 执行 task1() 函数体

→ print("Task 1: 开始") ← 输出

→ yield (暂停)

↓

→ task = task2 的生成器

↓

next(task)

→ 执行 task2() 函数体

→ print("Task 2: 开始") ← 输出

→ yield (暂停)

↓

while tasks: (第二次循环)

↓

for task in tasks[:]:

→ task = task1 的生成器

↓

next(task)

→ 从上次 yield 后继续

→ print("Task 1: 继续") ← 输出

→ yield (暂停)

↓

→ task = task2 的生成器

关键：

- 两个任务交替执行

- 通过 `yield` 让出控制权

- 单线程实现"并发"

- 需要调用方恢复，才能继续执行

除了 `next()` ，还可以用 `send()` 向生成器发送值：

def interactive_generator():

print("开始")

value = yield 1 # ← 返回 1 给调用者

print(f"收到: {value}")

value = yield 2 # ← 返回 2 给调用者

print(f"收到: {value}")

yield 3 # ← 返回 3 给调用者

gen = interactive_generator()

print(next(gen)) # 启动生成器

print(gen.send("Hello")) # 发送值并恢复

print(gen.send("World")) # 发送值并恢复

输出：

开始

1

收到: Hello

2

收到: World

3

#### yield from——生成器委托机制

`yield from` 的“委托机制”是 Python 3.3（PEP 380）引入的核心特性。它的本质不是语法简写，而是在调用方与子生成器之间建立一条双向透明通道，自动处理迭代、值透传、异常转发和返回值捕获。

委托机制的 4 大核心能力


| 能力                | 说明                                             | 手动实现难度                      |
| ----------------- | ---------------------------------------------- | --------------------------- |
| ✅ 自动迭代产出          | `for v in sub: yield v`                        | 简单                          |
| 🔄 `.send()` 透明透传  | 外部 `.send(val)` 直接穿透到子生成器                      | 需手动拦截/转发/处理 `StopIteration` |
| ⚡ `.throw()` 异常路由 | 外部 `.throw(exc)` 直接抛入子生成器当前暂停处                 | 需嵌套 try/except，极易遗漏边界情况     |
| 🎁 捕获 `return` 值   | 子生成器 `return val` 时， `yield from` 表达式值即为 `val` | 需拦截 `StopIteration.value`   |


完整代码演示（透明通道如何工作）

def sub_generator():

```java
print("[子] 启动，等待数据...")
while True:
val = yield # 暂停，等待.send()
if val is None:
print("[子] 收到终止信号，准备返回")
return "🎁 子生成器的返回值" # 关键：被 yield from 捕获
```

def delegator():

print("[外] 开始委托")

\# 建立透明通道：外部.send/.throw 直接穿透到 sub_generator

result = yield from sub_generator()

print(f"[外] 委托结束，收到: {result}")

\# 🔍 运行测试

gen = delegator()

next(gen) # 启动：打印 [外]... [子]...，暂停在子生成器的 yield

gen.send(100) # 100 直接穿透到 sub_generator 的 val（外层无感知）

gen.send(None) # 触发子生成器 return，通道关闭

输出：

[外] 开始委托

[子] 启动，等待数据...

[子] 收到终止信号，准备返回

[外] 委托结束，收到: 🎁 子生成器的返回值

> 💡 关键观察： `delegator` 没有写任何 `send/throw/return` 处理逻辑，但外部的 `.send()` 值、`.throw()` 异常、子生成器的 `return` 值全部自动穿透。这就是“委托”的真实含义。

#### 异步生成器

异步生成器（Async Generator）是 Python 3.6（PEP 525）引入的核心特性，本质是能持续产出数据流，且允许在产出之间进行异步等待的特殊对象。它完美结合了生成器的“惰性序列”能力与协程的“非阻塞 I/O”能力。

定义：用 `async def` 定义且包含 `yield` 的函数称为异步生成器。调用它不会立即执行，而是返回一个异步迭代器对象，必须通过 `async for` 或 `await anext()` 消费。

注意："异步"这个词在不同语境下指的是不同的东西。

这里的"异步"描述的是编程模型——你的代码不需要按顺序等待每个操作完成，而是发起操作后可以先去做别的事，操作完成后再回来处理结果。这是应用层面的概念，说的是代码的执行方式。

import asyncio

async def fetch_data_stream():

"""模拟异步数据源：每次拉取前需等待网络响应"""

for i in range(1, 4):

await asyncio.sleep(0.5) # 🔹 异步等待（不阻塞线程）

yield f"📦 数据包 {i}" # 🔹 产出当前值并暂停

async def main():

\# 必须使用 async for 消费

async for chunk in fetch_data_stream():

print(f"收到: {chunk}")

asyncio.run(main())

#### 流式输出

我们经常用到的流式输出，无非就是通过yield把消息块发送给它的调用者—web框架同时暂停，等待下一次迭代。web框架接收消息块发送到前端并恢复生成器的执行。如此迭代实现了流式输出的效果。

### 协程的原理

`async/await` 本质是：协程状态机 + `yield from` 委托机制 + 事件循环调度器。 虽然现代 CPython 在 C 层做了深度优化，但行为模型完全等价于以下三步：

1. `async def` → 创建独立执行上下文（保存局部变量、执行位置）

2. `await` → 挂起当前上下文，将控制权交还调度器，等待外部事件

3. 事件循环 → 不断检查“哪些协程可以恢复”，驱动状态机前进

---

#### 第一步：用生成器还原 async def

Python 的协程底层基于生成器实现。调用 `async def` 函数不会立即执行，而是返回一个可暂停/恢复的对象。

\# 原生 async def 的等价物

def async_worker():

```java
print("1. 协程启动")

yield # 模拟 await asyncio.sleep(0)

print("2. 协程恢复")
```

yield # 再次挂起

return "3. 协程结束，返回值: OK"

\# 调用 async def 的行为

coro = async_worker()

print(type(coro)) # <class 'generator'> (实际为 types.CoroutineType)

> 🔍 `next(coro)` 会执行到第一个 `yield` 暂停；再次 `next(coro)` 从暂停处继续；执行完返回 `return` 值（触发 `StopIteration.value` ）。

---

#### 第二步：用 yield from 还原 await

`await` 的核心能力是：等待一个可等待对象完成，并自动处理值传递、异常转发、返回值捕获。这正是 `yield from` 的设计初衷（PEP 380）。

def awaitable_sleep(seconds):

print(f"⏳ 开始等待 {seconds}s")

yield seconds # 告诉事件循环：我需要等这么多秒

print(f"✅ 等待 {seconds}s 结束")

return "醒来"

async def worker():

\# await asyncio.sleep(1) 的底层等价写法

result = yield from awaitable_sleep(1)

print(f"📦 收到返回值: {result}")

> 🔍 `yield from` 会建立一条透明通道：外部 `.send()` /`.throw()` 直接穿透到子生成器；子生成器 `return` 时， `yield from` 表达式的值就是返回值。

---

#### 第三步：手写极简事件循环（核心调度器）

没有事件循环， `async/await` 只是普通的生成器。

循环负责：运行就绪任务 → 收集等待条件 → 阻塞等待 → 唤醒任务。

import time

from collections import deque

class MiniEventLoop:

def __init__(self):

self.ready = deque() # 1. 可立即运行的协程队列

self.timers = {} # 2. 定时器：{唤醒时间戳: 协程}

def create_task(self, coro):

self.ready.append(coro)

return coro

def run(self):

while self.ready or self.timers:

\# 🔹 阶段1：执行所有已就绪的协程

while self.ready:

coro = self.ready.popleft()

try:

\# 执行到下一个 yield/await 处暂停

wait_info = next(coro)

\# 如果 yield 的是时间（模拟 sleep），注册定时器

if isinstance(wait_info, (int, float)):

wake_time = time.time() + wait_info

self.timers[wake_time] = coro

else:

\# 其他等待类型（如 I/O）此处简化为重新入队

self.ready.append(coro)

except StopIteration as e:

print(f"🏁 任务完成，返回值: {e.value}")

except Exception as e:

print(f"💥 任务异常: {e}")

\# 🔹 阶段2：阻塞等待最近的事件发生

if self.timers:

输出：

[A] 开始

[B] 开始

[B] 恢复

[A] 恢复

✅ 等待 0.5s 结束

🏁 任务完成，返回值: B Done

✅ 等待 1.0s 结束

🏁 任务完成，返回值: A Done

> 💡 关键观察：A 和 B 交替执行，没有线程切换，没有 CPU 空转。这就是“单线程高并发”的本质。

### 如何判断一个方法是否会阻塞

#### ❌ 误区 1：async def 一定不阻塞？

真相： `async def` 只提供“可挂起”的能力，不自动产生非阻塞特性。

- 只有在遇到 `await` 时，协程才会主动让出控制权。

- 如果内部全是同步阻塞代码，一旦执行就会阻塞整个事件循环。

async def blocking_async():

```java
time.sleep(2) # ❌ 同步阻塞

requests.get(url) # ❌ 同步阻塞

return data
```

\# 在 asyncio 中调用：

await blocking_async() # 🚨 事件循环直接卡死 2 秒+网络延迟

> 💡 `async def` 不是“防阻塞护身符”，而是“可暂停的函数模板”。没有 `await` 让出控制权，它和普通函数执行轨迹完全一致。

---

#### ❌ 误区 2：def 一定阻塞？

真相： `def` 只是同步执行函数，是否阻塞取决于耗时与上下文。

- 如果内部是纯内存快速操作（微秒级），不构成实际阻塞。

- 即使是耗时操作，只要放在独立线程/进程中，阻塞会被隔离，不影响主流程。

def fast_def():

return {k: v*2 for k, v in data.items()} # ⚡ 微秒级，不阻塞任何调度器

def slow_def():

return requests.get(url).json() # 🐢 阻塞当前线程

\# 在线程池中运行：

with ThreadPoolExecutor() as pool:

pool.submit(slow_def) # ✅ 阻塞被隔离，主线程继续运行

> 💡 `def` 只是“按顺序执行到底”，执行快就不阻塞，执行慢只阻塞当前线程。

---

#### 决定阻塞的真正因素


| 维度     | 说明                                      |
| ------ | --------------------------------------- |
| 内部代码   | 是否调用阻塞 API（网络/文件/锁/睡眠）或长耗时 CPU          |
| 是否有让出点 | `async def` 中是否有 `await` ； `def` 中无让出机制 |
| 执行上下文  | 单线程事件循环（阻塞致命） vs 线程池/多进程（阻塞可隔离）         |


#### 工程判断速查表


| 场景                                                 | 是否阻塞           | 原因                |
| -------------------------------------------------- | -------------- | ----------------- |
| `async def` + `await aiohttp.get()` + asyncio 事件循环 | ✅ 不阻塞          | 等待期间让出控制权         |
| `async def` + `time.sleep(5)` + asyncio 事件循环       | ❌阻塞            | 无 `await` 让出，独占线程 |
| `def` + `x = 1+1` + 任何环境                           | ✅不阻塞           | 耗时微秒，不占执行流        |
| `def` + `requests.get()` + 同步脚本                    | ❌阻塞            | 预期行为，线程挂起         |
| `def` + `requests.get()` + ThreadPoolExecutor      | ⚠️ 阻塞线程，不阻塞主流程 | 阻塞被隔离             |


### aiohttp vs requests

我们以最常用的aiohttp库和requests举例说明，协程是如何做到

内核的阻塞等待转化为用户态的事件驱动，从而在单线程中榨干 I/O 等待时间的计算价值

#### aiohttp 的I/O工作流程

import asyncio

import aiohttp

async def fetch_url(url):

```java
print(f"开始请求: {url}")

async with aiohttp.ClientSession() as session:

async with session.get(url) as response:
```

data = await response.text() # ← 让出控制权

print(f"请求完成: {url}")

return data

async def main():

urls = [

"http://example.com/1",

"http://example.com/2",

"http://example.com/3"

]

\# 并发执行

tasks = [fetch_url(url) for url in urls]

```java
results = await asyncio.gather(*tasks)

print(f"所有请求完成: {results}")

asyncio.run(main())
```

输出：

开始请求: http://example.com/1

开始请求: http://example.com/2

开始请求: http://example.com/3

（等待网络响应...）

请求完成: http://example.com/1

请求完成: http://example.com/2

请求完成: http://example.com/3

所有请求完成: [...]

关键：

- 三个请求几乎同时开始

- `await response.text()` 让出控制权

- 事件循环可以调度其他任务

- 三个请求并发执行

---

重点关注await的部分

\# await 的本质

async def fetch():

await aiohttp.get(url)

\# 等价于

def fetch():

return aiohttp.get(url).__await__()

\# __await__() 返回一个迭代器

class Awaitable:

def __await__(self):

\# 返回一个生成器

yield future # 让出控制权

return result

伪代码讲解详细流程：

async def fetch_url(url):

\# 1. 创建非阻塞 socket

sock = socket.socket()

sock.setblocking(False)

\# 2. 发起连接（非阻塞）

try:

sock.connect((host, port))

except BlockingIOError:

pass

\# 3. 注册到事件循环

future = loop.create_future()

loop.add_writer(sock.fileno(), lambda: future.set_result(None))

\# 4. await 让出控制权

await future # ← 暂停当前协程

\# 5. 连接建立后，恢复执行

sock.send(request)

\# 6. 等待响应

future = loop.create_future()

loop.add_reader(sock.fileno(), lambda: future.set_result(None))

await future # ← 再次让出控制权

\# 7. 数据到达，恢复执行

data = sock.recv(4096)

return data

---

最重要的就是理解第7步，为什么这里 `sock.recv` 不阻塞？因为 socket 已设为非阻塞模式，且事件循环通过 `epoll` 保证了只有在内核缓冲区有数据（socket ready）时才会恢复该协程。此时调用 `recv()` 能瞬间读取数据，不会触发 `BlockingIOError` 。

这背后的核心是 epoll 为协程提供的“精准唤醒”机制：

协程暂停时交出控制权：当协程执行到 await，事件循环会把它挂起（保存用户态状态），并将它等待的 socket 交给 epoll 监控。 内核数据就绪即通知：网卡收到数据后，内核协议栈标记 socket 为可读，epoll_wait() 返回就绪的 socket 列表。事件循环根据映射表找到等待它的协程，放入“可运行队列”。 协程按需恢复执行：协程被调度恢复，执行 sock.recv()。数据已在内核缓冲区，非阻塞读取瞬间完成。

事件循环与 I/O 的完整交互

用户空间（协程） 事件循环 内核（epoll）

│ │ │

│ await aiohttp.get() │ │

│─────────────────────────>│ │

│ │ 设置 socket 非阻塞 │

│ │─────────────────────────>│

│ │ │

│ │ 注册写事件到 epoll │

│ │─────────────────────────>│

│ │ │

│ 让出控制权 │ │

│<─────────────────────────│ │

│ │ │

│ （协程暂停） │ 调用 epoll_wait() │

│ │─────────────────────────>│

│ │ │

│ │ 线程睡眠 │

│ │ │

│ │ │ 连接建立

│ │<─────────────────────────│

│ │ │

│ │ epoll_wait() 返回 │

│ │<─────────────────────────│

│ │ │

│ │ 恢复协程 │

│─────────────────────────>│ │

│ │ │

│ 发送 HTTP 请求 │ │

│─────────────────────────>│─────────────────────────>│

│ │ │

│ await response.text() │ │

│─────────────────────────>│ │

│ │ 注册读事件到 epoll │

│ │─────────────────────────>│

│ │ │

│ 让出控制权 │ │

---

#### requests 的 I/O 工作流程

import asyncio

import requests

async def fetch_url(url):

print(f"开始请求: {url}")

response = requests.get(url) # ← 阻塞在此！

data = response.text

print(f"请求完成: {url}")

return data

async def main():

urls = [

"http://example.com/1",

"http://example.com/2",

"http://example.com/3"

]

\# 并发执行（实际变为串行）

tasks = [fetch_url(url) for url in urls]

```java
results = await asyncio.gather(*tasks)

print(f"所有请求完成: {results}")

asyncio.run(main())
```

输出：

开始请求: http://example.com/1

（等待网络响应... 整个事件循环卡死）

请求完成: http://example.com/1

开始请求: http://example.com/2

（等待网络响应... 整个事件循环卡死）

请求完成: http://example.com/2

开始请求: http://example.com/3

（等待网络响应... 整个事件循环卡死）

请求完成: http://example.com/3

所有请求完成: [...]

关键： ● 请求严格按顺序开始，必须等上一个完全返回才发起下一个 ● `requests.get()` 不让出控制权，无 `yield` / `await` ● 事件循环被完全阻塞，无法调度其他任务 ● 三个请求串行执行，总耗时 = 各请求延迟之和

---

`requests` 的底层实现

\# requests.get() 的本质（无 __await__ 协议）

def fetch():

return requests.get(url).text

\# 等价于直接调用阻塞式 socket

def blocking_request():

```java
sock = socket.socket()
sock.setblocking(True) # 默认阻塞模式
sock.connect((host, port)) # 阻塞直到 TCP 握手完成
sock.sendall(request)
```

data = sock.recv(4096) # 阻塞直到数据到达

return data

阻塞本质： `requests` 内部是纯同步调用链，没有 `__await__()` 方法，不返回迭代器，不 `yield` 。当它在 `async def` 中被调用时，只是普通函数调用，直接执行到底。

---

详细流程

async def fetch_url(url):

\# 1. 创建阻塞 socket（requests 底层自动完成）

sock = socket.socket()

sock.setblocking(True)

\# 2. 发起连接（阻塞）

sock.connect((host, port)) # ← 线程在此挂起，事件循环无法工作

\# 3. 发送请求

sock.sendall(request)

\# 4. 等待响应（核心阻塞点）

data = sock.recv(4096) # ← 线程休眠，同线程所有协程全停

\# 5. 数据返回后，恢复执行

return data

---

事件循环与 I/O 的完整交互

用户空间（async 协程） 事件循环（被阻塞） 内核（阻塞 I/O）

│ │ │

│ await fetch_url(url) │ │

│─────────────────────────────>│ │

│ │ 调用 requests.get() │

│ │ 创建阻塞 socket │

│ │─────────────────────────>│

│ │ │

│ │ 发起 TCP 握手 (connect) │

│ │─────────────────────────>│

│ │ │

│ 协程未暂停！线程直接挂起 │ 事件循环失去控制权 │

│ (无 yield/await) │ 无法执行 task 2/3 │

│ │ (调度器 starvation) │

│ │<─────────────────────────│

│ │ │

│ （整个程序卡死等待） │ 线程进入睡眠状态 │

│ │ (TASK_INTERRUPTIBLE) │

│ │ │

│ │ 握手完成 / 数据到达 │

│ │<─────────────────────────│

│ │ 系统调用返回，唤醒线程 │

│ │<─────────────────────────│

│ │ │

│ 恢复执行（请求1完成） │ 事件循环重新获得控制权 │

│<─────────────────────────────│ │

│ │ │

│ 开始请求 2（重复阻塞过程） │ │

│─────────────────────────────>│─────────────────────────>│

---

#### 核心对照


| 维度        | `aiohttp` (非阻塞)                   | `requests` (阻塞)                 |
| --------- | --------------------------------- | ------------------------------- |
| 控制权流转     | `await` 主动让出 → 事件循环调度其他任务         | 无让出点 → 线程挂起 → 事件循环饿死            |
| 底层协议      | 实现 `__await__()` ，返回生成器/迭代器       | 纯同步函数调用，无异步协议                   |
| Socket 模式 | `setblocking(False)` + `epoll` 监听 | `setblocking(True)` + 阻塞系统调用    |
| 等待状态      | 协程暂停（用户态状态机保存）                    | 线程睡眠（内核态 `TASK_INTERRUPTIBLE` ） |
| 并发表现      | 单线程并发，总耗时 ≈ 单次延迟                  | 单线程串行，总耗时 = 延迟累加                |


> 💡 关键认知： `async def` 只是“可暂停的函数模板”，不自动赋予非阻塞能力。内部调用同步阻塞库时， `async` 关键字形同虚设，底层直接退化为阻塞式系统调用。这就是为什么在异步上下文中混用 `requests` 会导致整个事件循环卡死。

## 事件循环

💡 核心思想：协作式多任务（Cooperative Multitasking）

单线程异步，所有任务共享一个线程，通过 `await` 主动让出控制权，循环不断调度就绪任务。代码需改写为异步，不能有阻塞调用。

注意："异步"这个词在不同语境下指的是不同的东西。

这里的"异步"描述的是编程模型——你的代码不需要按顺序等待每个操作完成，而是发起操作后可以先去做别的事，操作完成后再回来处理结果。这是应用层面的概念，说的是代码的执行方式。

上文的I/O异步说的是操作系统的内核行为。

#### API速查表

按使用频率排序，标注了 Python 版本要求：


| API                               | 用途                         | 版本    |
| --------------------------------- | -------------------------- | ----- |
| `asyncio.run(coro)`               | 启动事件循环，运行协程                | 3.7+  |
| `asyncio.create_task(coro)`       | 把协程包装成 Task 并发执行           | 3.7+  |
| `asyncio.gather(*coros)`          | 并发运行多个协程，收集结果              | 3.4+  |
| `asyncio.sleep(seconds)`          | 异步等待（不阻塞事件循环）              | 3.4+  |
| `asyncio.wait_for(coro, timeout)` | 给协程加超时                     | 3.4+  |
| `asyncio.timeout(seconds)`        | 超时上下文管理器                   | 3.11+ |
| `asyncio.TaskGroup()`             | 结构化并发（更安全的 gather）         | 3.11+ |
| `asyncio.to_thread(func)`         | 在线程中运行阻塞函数                 | 3.9+  |
| `asyncio.wait(tasks)`             | 细粒度等待（先完成先返回）              | 3.4+  |
| `asyncio.Queue()`                 | 异步队列                       | 3.4+  |
| `asyncio.Lock()`                  | 协程互斥锁                      | 3.4+  |
| `asyncio.Semaphore(n)`            | 限制并发数                      | 3.4+  |
| `asyncio.Event()`                 | 协程间事件通知                    | 3.4+  |
| `asyncio.shield(coro)`            | 保护协程不被取消                   | 3.4+  |
| `asyncio.get_running_loop()`      | 获取当前运行的事件循环                | 3.7+  |
| `asyncio.current_task()`          | 获取当前 task                  | 3.7+  |
| `asyncio.all_tasks()`             | 获取所有活跃 task                | 3.7+  |
| `loop.run_in_executor()`          | 在线程池中运行（ `to_thread` 的底层版） | 3.4+  |
| `loop.call_later()`               | 延迟执行回调                     | 3.4+  |
| `loop.call_soon()`                | 尽快执行回调                     | 3.4+  |


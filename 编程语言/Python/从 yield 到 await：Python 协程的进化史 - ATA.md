---
title: "从 yield 到 await：Python 协程的进化史 - ATA"
source: "https://ata.atatech.org/articles/11020492029?spm=ata.23639420.0.0.15527536YAEKiD"
author:
published:
created: 2026-04-09
description:
tags:
  - "clippings"
---
云智能集团

粉丝 8影响力 84

** 18

** 12

** 2

** 原创文章

AI 辅助创作

发表到圈儿

[人生苦短我用Python](https://ata.atatech.org/community/group/1246) (首发)

[阿里云基础设施](https://ata.atatech.org/community/team/3)

[ATA之家](https://ata.atatech.org/community/group/45)

[Python](https://ata.atatech.org/community/group/63)

[弹性计算](https://ata.atatech.org/community/team/114)

[云布道师](https://ata.atatech.org/community/team/628)

开放访问

**

复制专用链接

**

## 从 yield 到 await：Python 协程的进化史

[刘天宇(剑洁)](https://ata.atatech.org/users/11001850788)

2025-10-24发表2025-10-30更新230次浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章14:23

Powered by 通义语音合成

通义语音合成

**

内容创意 from 剑洁、润色加工 by 千问

## 引言

今天我们习以为常的 `async/await` ，是 Python 异步编程的标准范式。但很少有人意识到，这个简洁优雅的语言结构并非凭空而来。

它是一段跨越二十年的技术演进成果——从最原始的生成器（generator）出发，历经社区实践中的“打补丁”阶段（如 `@wrappertask` ），再到语言层面引入 `yield from` 和原生协程，最终形成了现代异步体系。

本文将按技术发展的真实时间线与逻辑脉络，带你完整还原这段历史：

> 为什么需要协程？

> 嵌套任务如何调度？

> `wrappertask` 是谁的“替身”？

> `await` 究竟比 `yield from` 强在哪？

我们将一步步揭开 Python 协程从“手工轮子”走向语言级支持的全过程。

---

## 第一阶段：生成器的本质——yield 的出现

### 1.1 什么是生成器？

早在 Python 2.2（2001年），语言引入了 `yield` 关键字，用于创建惰性计算的序列：

def counter():

i = 0

while True:

yield i

i += 1

gen = counter()

print(next(gen)) # 输出 0

print(next(gen)) # 输出 1

此时， `yield` 被视为一种增强版的 `return` ，主要用于节省内存地遍历大数据集或无限序列。

### 1.2 双向通信：send() 方法的诞生（Python 2.5）

真正的转折点出现在 2006 年的 Python 2.5，加入了 `.send(value)` 方法，使外部可以向生成器内部传递数据：

def echoer():

while True:

msg = yield

print(f"Echo: {msg}")

e = echoer()

next(e) # 预激：运行到第一个 yield

e.send("Hi") # 打印 "Echo: Hi"

这一特性彻底改变了生成器的角色：

✅ 它不再只是“产出值”，而是能接收输入、维护状态、主动暂停的独立执行体。这正是“协程（Coroutine）”的核心定义——一个可中断、可恢复、能与调用方协作的过程。

---

## 第二阶段：现实困境 —— 嵌套生成器的控制流难题

随着异步模式在实践中应用加深，开发者开始尝试用生成器模拟复杂任务流。然而很快遇到了一个经典问题：如何在一个生成器中“调用”另一个生成器，并正确转发所有控制信号？

### 2.1 示例：父子任务关系

设想我们有两个生成器：

●

子任务负责处理具体逻辑；

●

父任务负责流程编排。

def child\_task():

for i in range(3):

print(f" Child step {i}")

yield f"data\_{i}"

return "child\_done"

def parent\_task():

print("Parent start")

\# 想要“调用” child\_task 并将其产出透传出去

for data in child\_task():

yield data # 手动循环转发

print("Parent end")

虽然功能上看似可行，但这种写法存在严重缺陷。

### 2.2 手动转发的三大痛点

#### 🔹 1. 控制流不透明

外部无法直接向 `child_task` 发送数据：

p = parent\_task()

next(p)

p.send("X") # ❌ 实际发送给了父生成器，但父层没有接收逻辑！

#### 🔹 2. 异常无法穿透

如果外部抛出异常：

p.throw(ValueError())

父生成器根本不知道该如何处理——它只是一个中间转发者，不具备代理能力。

#### 🔹 3. 返回值丢失

当子生成器以 `return "child_done"` 结束时，其返回值藏在 `StopIteration.value` 中，父层无法自然获取。

---

### ✅ 理想解决方案应当是什么样子？

我们需要一种机制，能让父生成器把“控制权”完全交给子生成器，直到后者完成为止。理想语义包括：

<table><colgroup><col width="375"> <col width="375"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>功能</p></td><td rowspan="1" colspan="1"><p>行为</p></td></tr><tr><td rowspan="1" colspan="1"><p>数据产出</p></td><td rowspan="1" colspan="1"><div>子的 <code>yield</code> 直接对外可见</div></td></tr><tr><td rowspan="1" colspan="1"><p>数据输入</p></td><td rowspan="1" colspan="1"><div>外部 <code>send(value)</code> 自动传给子</div></td></tr><tr><td rowspan="1" colspan="1"><p>异常处理</p></td><td rowspan="1" colspan="1"><div><code>.throw(exc)</code> / <code>.close()</code> 穿透到子</div></td></tr><tr><td rowspan="1" colspan="1"><p>返回值捕获</p></td><td rowspan="1" colspan="1"><div>父级能拿到子的 <code>return</code> 值</div></td></tr></tbody></table>

我们希望这样写：

def parent\_task():

print("Parent start")

result = yield from child\_task() # 控制权移交，结束后自动继续

print(f"Child returned: {result}")

print("Parent end")

但遗憾的是，在 Python 3.3 之前，这是非法语法！

于是，在语言尚未提供支持的时代，工程师们只能自己动手，造出了各种“模拟方案”。

---

## 第三阶段：社区补丁 —— OpenStack 的 @wrappertask 装饰器

为了填补 `yield from` 缺失带来的空白，大型项目开始实现自定义的委托机制。其中最具代表性的是 OpenStack Heat 项目的 `@wrappertask` 装饰器。它是对 `yield from` 语义的一次完整工程模拟。

> 🔗 [20130507 引入 @wrappertask 的 commit](https://github.com/openstack/heat/commit/772f8b9e812ced3fe21425870bcde3b765cd73ab)

> 🔗 [20231227 移除 @wrappertask 的 commit](https://github.com/openstack/heat/commit/772f8b9e812ced3fe21425870bcde3b765cd73ab)

### 3.1 出现时间与背景

●

`yield from` 正式发布：2012年9月（Python 3.3）

●

`@wrappertask` 首次引入：2013年5月7日

✅ 数字上看， `@wrappertask` 是在 `yield from` 标准化之后才被加入 OpenStack 的。

但这并不削弱它的价值，反而凸显了一个关键事实：

> ⚠️ 尽管 `yield from` 已经成为标准，但绝大多数生产系统仍在使用 Python 2.7，而该语法对 Python 2 完全不可用。

因此， `@wrappertask` 不是一个“逆潮复古”，而是在现实约束下的必要替代方案。

### 3.2 wrappertask 的设计目标

它的核心目的是允许一个生成器函数通过 `yield` 直接“启动”另一个生成器作为子任务：

@wrappertask

def parent\_task():

self.setup()

yield child\_task()

self.cleanup()

这与未来 `yield from` 的使用方式惊人相似。

在 Heat 中，一个典型的 `@wrappertask` 示例是在一个云资源的 `destroy` 父任务中调用 `delete` 子任务：

\# commit\_id: e649574d4751ffd8578f63787621c3a26d383a34

class Resource(status.ResourceStatus)

@scheduler.wrappertask

def destroy(self):

"""A task to delete the resource and remove it from the database."""

yield self.delete()

if self.id is None:

return

try:

resource\_objects.Resource.delete(self.context, self.id)

except exception.NotFound:

\# Don't fail on delete if the db entry has

\# not been created yet.

pass

self.id = None

### 3.3 实现原理简析

以下为 Heat 中的原始代码逻辑：

def wrappertask(task):

"""

Decorator for a task that needs to drive a subtask.

This is essentially a replacement for the Python 3-only "yield from"

keyword (PEP 380), using the "yield" keyword that is supported in

Python 2. For example::

@wrappertask

def parent\_task(self):

self.setup()

yield self.child\_task()

self.cleanup()

"""

def wrapper(\*args, \*\*kwargs):

\# 启动父生成器任务

parent = task(\*args, \*\*kwargs)

\# 遍历父生成器产生的每个子任务

for subtask in parent:

try:

\# 如果子任务不为None，则需要驱动执行它

if subtask is not None:

\# 遍历子任务产生的每个步骤

for step in subtask:

try:

\# 将子任务的产出值传递给外界调用者

yield step

\# 捕获生成器关闭异常

except GeneratorExit as exit:

\# 关闭子任务并重新抛出异常

subtask.close()

raise exit

\# 捕获其他所有异常

> 💡 它完整实现了：

> \- `yield` 出子任务的数据

> \- 父子任务间的异常传播`.throw()` `close()`

尽管实现复杂，且未实现 send 值透传、return 值捕获等功能，但它成功支撑了 Heat 项目中复杂的任务编排需求。

### 3.4 历史地位：一场“超前落地”的工业化验证

可以说， `@wrappertask` 是 `yield from` 在现实世界中的一次大规模工程验证。

正因为像 OpenStack 这样的重大项目长期面临“生成器代理”的痛点，开发者社区才更清楚地认识到：

> ❝ 协程组合不是一个边缘场景，而是一个普遍存在的基础需求。 ❞

也正是这些广泛的实践，为 PEP 380（即 `yield from` ）提供了坚实的现实依据。

🔁 因此，“后来者居上”并不矛盾—— `@wrappertask` 虽然晚于 `yield from` 出现，但在 Python 2 用户的实际生态中，它成了无数人最早接触的“类协程组合”机制。

---

## 第四阶段：语法标准化 —— yield from 登场（Python 3.3）

2012 年，随着 Python 3.3 发布，PEP 380 正式引入 `yield from` ，一举解决了嵌套生成器问题：

def parent\_task():

print("Parent start")

result = yield from child\_task() # 所有行为自动代理

print(f"Child returned: {result}")

print("Parent end")

相比 `@wrappertask` ， `yield from` 的优势在于：

<table><colgroup><col width="250"> <col width="250"> <col width="250"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>特性</p></td><td rowspan="1" colspan="1"><div><code>@wrappertask</code></div></td><td rowspan="1" colspan="1"><div><code>yield from</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>是否需装饰器</p></td><td rowspan="1" colspan="1"><p>是</p></td><td rowspan="1" colspan="1"><p>否</p></td></tr><tr><td rowspan="1" colspan="1"><p>是否通用</p></td><td rowspan="1" colspan="1"><p>特定库实现</p></td><td rowspan="1" colspan="1"><p>语言内置</p></td></tr><tr><td rowspan="1" colspan="1"><p>性能</p></td><td rowspan="1" colspan="1"><p>较慢（多重循环）</p></td><td rowspan="1" colspan="1"><p>更快（C 层优化）</p></td></tr><tr><td rowspan="1" colspan="1"><p>易用性</p></td><td rowspan="1" colspan="1"><p>难理解</p></td><td rowspan="1" colspan="1"><p>简洁直观</p></td></tr></tbody></table>

从此，开发者无需再造轮子。

---

## 第五阶段：专用抽象 —— 原生协程登场（Python 3.5）

尽管 `yield from` 极大提升了表达力，但它仍有局限：

●

它仍属于普通生成器语法，难区分“真协程”与“假生成器”

●

可被误用于非异步场景

●

缺乏类型提示和静态检查支持

因此，PEP 492 （2015年，Python 3.5）提出了更高级的抽象：

### 5.1 新关键字：async def 与 await

async def child\_coro():

await asyncio.sleep(1)

return "child\_done"

async def parent\_coro():

print("Parent start")

result = await child\_coro()

print(f"Child returned: {result}")

print("Parent end")

关键变化：

●

`async def` 明确定义一个 原生协程函数

●

`await` 替代 `yield from` ，只能用于 awaitable 对象

●

类型清晰、上下文明确、安全性高

### 5.2 await 与 yield from 的关系

<table><colgroup><col width="250"> <col width="250"> <col width="250"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>对比项</p></td><td rowspan="1" colspan="1"><div><code>yield from gen</code></div></td><td rowspan="1" colspan="1"><div><code>await coro</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>支持对象</p></td><td rowspan="1" colspan="1"><p>任意生成器或可迭代</p></td><td rowspan="1" colspan="1"><div>仅限 <code>Awaitable</code> 类型</div></td></tr><tr><td rowspan="1" colspan="1"><p>使用位置</p></td><td rowspan="1" colspan="1"><p>任何函数</p></td><td rowspan="1" colspan="1"><div>仅限 <code>async def</code> 函数内</div></td></tr><tr><td rowspan="1" colspan="1"><p>错误提示</p></td><td rowspan="1" colspan="1"><p>混乱或静默失败</p></td><td rowspan="1" colspan="1"><p>明确报错</p></td></tr><tr><td rowspan="1" colspan="1"><p>设计意图</p></td><td rowspan="1" colspan="1"><p>数据委派</p></td><td rowspan="1" colspan="1"><p>异步等待</p></td></tr><tr><td rowspan="1" colspan="1"><p>运行环境</p></td><td rowspan="1" colspan="1"><p>可独立运行</p></td><td rowspan="1" colspan="1"><p>必须由事件循环驱动</p></td></tr></tbody></table>

> 🔄 本质上， `await` 是 `yield from` 在异步上下文下的专用化版本——去除了通用性，换取更强的语义清晰度。

---

## 第六阶段：生态成型 —— asyncio 与事件循环整合

最后，配合 `async/await` 的语义升级，官方标准库 `asyncio` 成为现代异步编程的核心：

import asyncio

async def main():

task1 = asyncio.create\_task(some\_work())

task2 = asyncio.create\_task(other\_work())

await task1

await task2

asyncio.run(main()) # 启动事件循环

关键组件成熟：

●

`EventLoop` ：统一调度所有协程

●

`Task` ：封装协程为并发单位

●

`Future` ：表示未完成的结果

●

`gather/wait` ：批量管理多个协程

至此，Python 完成了从“生成器兼职协程”到“原生异步优先”的全面转型。

---

## 完整演化时间轴（按实际发展顺序）

<table><colgroup><col width="250"> <col width="250"> <col width="250"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>年份</p></td><td rowspan="1" colspan="1"><p>技术</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="1"><p>2001</p></td><td rowspan="1" colspan="1"><div>生成器 (<code>yield</code>)</div></td><td rowspan="1" colspan="1"><p>Python 2.2 引入，用于惰性迭代</p></td></tr><tr><td rowspan="1" colspan="1"><p>2006</p></td><td rowspan="1" colspan="1"><div><code>send()</code> 方法</div></td><td rowspan="1" colspan="1"><p>Python 2.5 开启双向通信，协程雏形形成</p></td></tr><tr><td rowspan="1" colspan="1"><p>2012</p></td><td rowspan="1" colspan="1"><div><code>yield from</code></div></td><td rowspan="1" colspan="1"><p>Python 3.3 正式支持，标准化生成器委托机制</p></td></tr><tr><td rowspan="1" colspan="1"><p>2013</p></td><td rowspan="1" colspan="1"><div><code>@wrappertask</code></div></td><td rowspan="1" colspan="1"><div>OpenStack 为 Python 2 实现 <code>yield from</code> 的等价机制</div></td></tr><tr><td rowspan="1" colspan="1"><p>2015</p></td><td rowspan="1" colspan="1"><div><code>async</code> / <code>await</code></div></td><td rowspan="1" colspan="1"><p>Python 3.5 新增关键字，分离协程与生成器</p></td></tr><tr><td rowspan="1" colspan="1"><p>2016+</p></td><td rowspan="1" colspan="1"><div><code>asyncio</code> 生态完善</div></td><td rowspan="1" colspan="1"><p>构建完整的异步程序模型</p></td></tr></tbody></table>

> 💡 注： `@wrappertask` 出现在 `yield from` 之后，反映了 语言先进但平台滞后 的典型工程现实 —— 新特性普及需要过渡周期。

---

## 总结：一段从“补丁”到“标准”的进化之路

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>阶段</p></td><td rowspan="1" colspan="1"><p>核心机制</p></td><td rowspan="1" colspan="1"><p>代表语法</p></td><td rowspan="1" colspan="1"><p>解决的问题</p></td></tr><tr><td rowspan="1" colspan="1"><p>🧱 基础设施</p></td><td rowspan="1" colspan="1"><div>生成器 + <code>yield</code></div></td><td rowspan="1" colspan="1"><div><code>yield x</code></div></td><td rowspan="1" colspan="1"><p>提供暂停/恢复能力</p></td></tr><tr><td rowspan="1" colspan="1"><p>🔁 双向通信</p></td><td rowspan="1" colspan="1"><div><code>send()</code> 方法</div></td><td rowspan="1" colspan="1"><div><code>val = yield</code></div></td><td rowspan="1" colspan="1"><p>实现外部注入数据</p></td></tr><tr><td rowspan="1" colspan="1"><p>🔗 层级管理</p></td><td rowspan="1" colspan="1"><p>手动转发</p></td><td rowspan="1" colspan="1"><div><code>for item in gen: yield item</code></div></td><td rowspan="1" colspan="1"><p>初步组合任务，但功能残缺</p></td></tr><tr><td rowspan="1" colspan="1"><p>⛓️ 工程补丁</p></td><td rowspan="1" colspan="1"><div><code>@wrappertask</code></div></td><td rowspan="1" colspan="1"><div><code>yield subtask()</code></div></td><td rowspan="1" colspan="1"><p>在无语言支持下模拟完整委托</p></td></tr><tr><td rowspan="1" colspan="1"><p>🔗 标准委托</p></td><td rowspan="1" colspan="1"><div><code>yield from</code></div></td><td rowspan="1" colspan="1"><div><code>yield from gen()</code></div></td><td rowspan="1" colspan="1"><p>语言内建机制，解决嵌套难题</p></td></tr><tr><td rowspan="1" colspan="1"><p>✨ 专用抽象</p></td><td rowspan="1" colspan="1"><div><code>async/await</code></div></td><td rowspan="1" colspan="1"><div><code>await coro</code></div></td><td rowspan="1" colspan="1"><p>明确异步边界，提升安全与可读性</p></td></tr><tr><td rowspan="1" colspan="1"><p>🏗️ 生态支撑</p></td><td rowspan="1" colspan="1"><div><code>asyncio</code> 框架</div></td><td rowspan="1" colspan="1"><div><code>create_task()</code>, <code>run()</code></div></td><td rowspan="1" colspan="1"><p>构建完整异步程序模型</p></td></tr></tbody></table>

---

## 启示

1.

痛点驱动创新 `@wrappertask`

虽是临时补丁，但它来源于 OpenStack 这类超大规模系统的实际调度需求。正是这些真实世界的挑战，反向推动了语言标准的演进。

2.

抽象逐层递进

技术演进不是跳跃式的，而是遵循 “hack → 模式 → 库 → 语法 → 生态” 的升维路径。

3.

清晰优于灵活

`async/await` 牺牲了 `yield from` 的通用性，换来的是更低的认知成本和更高的工程可靠性。

---

今天的 `await` 虽然只是一行关键字，但它背后站着从普通 `yield` 到协程理念成熟的全部历程。

理解这段历史，不仅能让我们写出更好的异步代码，更能明白：

> 💬 每一个优雅的 API，都曾经历过无数粗糙的原型与漫长的打磨。

END

引言

第一阶段：生成器的本质——yield 的出现

1.1 什么是生成器？

1.2 双向通信：send() 方法的诞生（Python 2.5）

第二阶段：现实困境 —— 嵌套生成器的控制流难题

2.1 示例：父子任务关系

2.2 手动转发的三大痛点

🔹 1. 控制流不透明

🔹 2. 异常无法穿透

🔹 3. 返回值丢失

✅ 理想解决方案应当是什么样子？

第三阶段：社区补丁 —— OpenStack 的 @wrappertask 装饰器

3.1 出现时间与背景

3.2 wrappertask 的设计目标

3.3 实现原理简析

3.4 历史地位：一场“超前落地”的工业化验证

第四阶段：语法标准化 —— yield from 登场（Python 3.3）

第五阶段：专用抽象 —— 原生协程登场（Python 3.5）

5.1 新关键字：async def 与 await

5.2 await 与 yield from 的关系

第六阶段：生态成型 —— asyncio 与事件循环整合

完整演化时间轴（按实际发展顺序）

总结：一段从“补丁”到“标准”的进化之路

启示

**

**

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
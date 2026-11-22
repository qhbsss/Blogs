---
title: "Agent 长程任务的断点恢复：问题场景、业界方案与 LangChain / OpenAI / Anthropic 的三种路径"
source: "https://ata.atatech.org/articles/11020767201?spm=ata.23639746.0.0.4d5364f0VFgxYi"
author:
  - "[[沈奕辰(奕辰)]]"
published:
created: 2026-10-11
description:
tags:
  - "clippings"
---
## 一、问题场景：长程任务的"第 60 步崩溃"

设想一个典型的企业级自动化任务：让 Agent 完成一份多源数据跨表审计。它需要连接多个数据库、拉取十几张宽表、逐表做字段对齐、跑一致性校验、生成中间结论、再交叉比对，最后汇总成报告。整个流程被拆成大约 60~80 个步骤，端到端要跑几十分钟到几个小时。

问题出在中段。假设 Agent 顺利跑到第 60 步——前面已经消耗了几十万 token、调用了几十次工具、生成了大量中间产物——这时候环境抛出一个异常：数据库连接超时、某个 API 限流、进程被 OOM kill、或者仅仅是宿主机重启了一下。

如果 harness（承载 Agent 运行的执行框架）没有任何持久化与恢复能力，代价是残酷的：

- Token 成本：前 59 步累积的推理上下文全部作废，重跑意味着把这些 token 再烧一遍。对长程任务而言，这往往是任务总成本的大头。
- 时间成本：几十分钟甚至几小时的执行时间归零，用户要重新等待。
- 副作用不可控：前面的步骤可能已经真实地写了数据库、发了邮件、下了订单。盲目从头重跑会导致重复副作用——同一封邮件发两次，同一笔操作执行两次。
- 非确定性放大：LLM 本身有随机性，重跑不保证走到同一条路径,之前"跑对了"的部分可能这次跑歪。

因此核心诉求非常明确：在 harness 层建立一套可断点恢复的机制，让崩溃后的任务能够从最近一个可信状态继续，而不是从零开始。这个能力在工业界有两个既相关又不同的名字——状态检查点（State Checkpointing）和持久化执行（Durable Execution）。理解它们的差异，是理解整个领域的钥匙。

## 二、业界的两条技术路线：Checkpointing vs Durable Execution

在展开三家具体实现之前，先厘清一个关键区分。目前业界解决"Agent 长程任务不丢状态"这件事，本质上有两条路线。

### 路线 A：状态检查点（Checkpointing / Snapshotting）

思路是把 Agent 的执行建模成一张图（Graph）或状态机：每个节点是一个步骤，节点之间有依赖边。每执行完一个（或几个）节点，就把当前的完整状态——包括已完成节点、它们的输出、共享内存/累加器、下一步指针——序列化写入一个持久化存储（内存、SQLite、Postgres、文件）。

恢复时，harness 读回最近一个 checkpoint，计算出"恢复前沿（resume frontier）"——即那些输入已就绪但自身尚未完成的节点——然后从那里继续调度。这条路线的主导者是 LangGraph。它的特点是开发者显式管理状态形状，控制粒度细，还能顺带实现"时间旅行"（回到任意历史 checkpoint 分叉重跑）和"人在环路中断（human-in-the-loop）"。

### 路线 B：持久化执行（Durable Execution）

思路完全不同：不让开发者手动存快照，而是由一个持久化运行时接管整个执行生命周期。开发者只需把工作流写成普通代码，运行时会记录每一次副作用调用（Activity）的输入与输出到事件日志。一旦进程崩溃，运行时在另一台机器上重放（replay）这段代码：所有已经执行过的副作用不会真的再跑一遍，而是直接从日志里取回上次的结果，代码"快进"到崩溃点后继续。

这条路线的代表是 Temporal，OpenAI Agents SDK 官方推荐用它来做生产级的持久化。它的核心约束是工作流代码必须是确定性的（deterministic）——所有不确定的东西（时间、随机数、网络调用）都要包进 Activity，这样重放才能得到一致结果。

一句话区分：Checkpointing 是"开发者定期给状态拍快照，崩溃后加载快照"；Durable Execution 是"运行时记录所有副作用的结果，崩溃后重放代码并跳过已完成的副作用"。前者管理的是状态数据，后者管理的是执行进度本身。二者也可以组合使用。

下面分别看三家怎么落地这两条路线。

## 三、LangChain / LangGraph 怎么做：Checkpointer + Store 双层持久化

LangGraph 是 LangChain 生态里专门为"有状态、多步骤 Agent"设计的编排框架，它把持久化做成了框架的一等公民，机制也最贴近前面说的"状态检查点"路线。

### 1\. 把执行建模成图 + 超级步（super-step）

LangGraph 让你把 Agent 定义成一个图：节点（node）是函数，边（edge）是转移逻辑，共享的 `State` 对象在节点间流动。图的执行按超级步（super-step）推进——可以理解为一个离散的"时钟节拍"，每个 super-step 结束时框架都有机会持久化。

### 2\. Checkpointer：短期记忆，存"线程内"的执行状态

核心组件是 Checkpointer（检查点保存器）。当你给图编译时挂上一个 checkpointer，LangGraph 会在每个 super-step 之后自动把 State 的完整快照写入存储。每个快照带一个 `thread_id`（对应一次会话/一个任务实例）和一个 checkpoint id。

LangGraph 提供了多种开箱即用的 checkpointer 实现，对应不同的持久化后端：

| Checkpointer | 后端 | 适用场景 |
| --- | --- | --- |
| `InMemorySaver` | 进程内存 | 开发调试、单测；进程重启即丢 |
| `SqliteSaver` / `AsyncSqliteSaver` | SQLite 文件 | 本地/单机生产，轻量持久化 |
| `PostgresSaver` / `AsyncPostgresSaver` | Postgres | 分布式生产环境，多副本共享状态 |

恢复只需要用同一个 `thread_id` 再次调用图，LangGraph 会自动加载该线程最近的 checkpoint 并从断点继续。对应到"第 60 步崩溃"的场景：只要每个 super-step 后都落盘，崩溃后拿着 thread\_id 重新 invoke，就能从第 60 步之后接着跑，而不是从头。

```
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver.from_conn_string(DB_URI)
graph = builder.compile(checkpointer=checkpointer)

# 首次执行：thread_id = "audit-2026-001"
config = {"configurable": {"thread_id": "audit-2026-001"}}
graph.invoke(inputs, config)   # 跑到第 60 步崩溃

# 崩溃后：同一个 thread_id 再次 invoke
graph.invoke(None, config)     # 自动从最近 checkpoint 恢复，继续第 61 步
```

### 3\. Store：长期记忆，跨线程共享

Checkpointer 存的是"这一次任务的执行状态"，是线程内的。而 Store 是另一层——它存跨线程、跨会话的长期知识（例如用户偏好、领域事实），用命名空间组织，可选带向量检索。二者配合，Checkpointer 负责"任务从哪断的接着跑"，Store 负责"跨任务记住的东西"。

### 4\. 附加能力：重试、时间旅行、人在环路

因为每一步状态都被快照，LangGraph 顺带解锁了三个高价值能力：

- RetryPolicy：节点级别配置重试策略（次数、退避），瞬时故障自动重试。
- 时间旅行（time travel）：可以列出一个 thread 的所有历史 checkpoint，选任意一个作为起点分叉重跑——用于调试"如果第 30 步换个决策会怎样"。
- Human-in-the-loop：用 `interrupt` 在某个节点暂停、把状态持久化、等人类审批后再恢复。这本质上就是"主动触发的 checkpoint + 恢复"。

### 局限

LangGraph 的 checkpoint 存的是状态数据，不负责保证副作用的幂等。如果某个节点里发了邮件然后崩溃，恢复重跑该节点时邮件会再发一次——幂等仍需开发者自己在节点内处理（比如用幂等键、先查后写）。此外快照粒度是 super-step，如果单个 super-step 内部有多个副作用，中途崩溃仍可能部分完成。

## 四、OpenAI 怎么做：轻量 Sessions + 生产级 Temporal 持久化执行

OpenAI 的 Agents SDK 走的是"分层"策略：内置一个轻量的对话状态持久化（Sessions），生产级的崩溃恢复则明确推荐交给专业的持久化执行引擎（Temporal）。

### 1\. Sessions：自动管理对话历史

Agents SDK 的 Session 解决的是最基础的问题——多轮之间自动保存和读取对话历史，免得开发者每轮手动拼 `.to_input_list()`。它同样提供多种后端实现：

| Session 类型 | 存储 | 说明 |
| --- | --- | --- |
| `SQLiteSession` | SQLite（内存或文件） | 默认轻量方案 |
| `SQLAlchemySession` | 任意 SQLAlchemy 支持的库 | Postgres/MySQL 等生产库 |
| `RedisSession` | Redis | 高并发、分布式 |
| `OpenAIConversationsSession` | OpenAI Conversations API | 托管在 OpenAI 侧 |
| `EncryptedSession` | 包装层 | 透明加密 + TTL |

但要注意：Session 只持久化"对话历史"，不持久化"执行进度"。它能让你在崩溃后不丢已经发生的对话消息，但无法自动跳过"已经执行过的工具调用/副作用"。对于"第 60 步崩溃"这种带大量副作用的长程任务，Session 只是必要而不充分的一层。

### 2\. Temporal：真正的崩溃级持久化执行

为了让 Agent 达到"进程崩溃、机器宕机都能无缝续跑"的级别，OpenAI 官方文档推荐把 Agents SDK 与 Temporal 集成，这正是前面说的"持久化执行"路线。

模型是这样的：把整个 Agent 流程写成一个 Temporal Workflow，其中每一个"有副作用/不确定"的操作（调用 LLM、调工具、访问数据库）都封装成 Activity。Temporal 的运行时会：

- 把每个 Activity 的输入和返回结果记录到持久化的事件历史（event history）；
- 如果 worker 进程崩溃，Temporal 在另一个 worker 上重放（replay）整个 Workflow 代码；
- 重放时，已经完成的 Activity 不会真的重新执行，而是直接从事件历史里返回上次的结果——代码被"快进"到崩溃点，然后继续跑没做完的部分。

这样一来，第 60 步之前的 59 步（每步是一个 Activity）在恢复时全部命中历史记录、瞬间返回，Agent 从第 60 步继续真实执行。Token 不重烧、副作用不重放，这正是长程任务想要的"无感恢复"。

关键约束——确定性：Temporal 的 Workflow 代码必须是确定性的，否则重放会走岔路。因此所有不确定来源（当前时间、随机数、网络 IO、LLM 调用）都必须放进 Activity。这是 Durable Execution 路线的"入场券"，也是它和 LangGraph 那种"随便写节点函数"相比更重的地方。

### 小结 OpenAI 的取舍

OpenAI 没有在 SDK 里自己造一个重型状态机，而是把编排逻辑做轻（Sessions 管对话）、把持久化难题外包给成熟的执行引擎（Temporal 管崩溃恢复）。这是一种"用对的工具做对的事"的工程哲学：LLM 编排归 SDK，分布式容错归 Temporal。

## 五、Anthropic 怎么做：文件系统即状态，产物即事实

Anthropic 在《Effective harnesses for long-running agents》中给出的思路，和前两家有本质差异。它不依赖某个专门的 checkpoint 数据库或持久化运行时，而是主张——把文件系统本身当作状态存储，把 Agent 产出的文件（artifacts）当作唯一可信的事实来源（ground truth）。

### 1\. 为什么是文件系统

Anthropic 的观察是：LLM 的上下文窗口是易失、有限、会被压缩的。长程任务跑到后面，早期上下文要么被挤出窗口，要么被 context compaction（上下文压缩）摘要掉，细节丢失，Agent 就会"失忆漂移"。因此不能把状态托付给上下文，而要外置到持久介质——文件系统是最自然、最通用的那个。

### 2\. 产物即事实：结构化进度文件

Agent 每完成一个阶段，就把成果和进度写成实实在在的文件，而不是只留在对话里。典型做法：

- `feature_list.json` 之类的结构化清单：记录整个任务被拆成哪些子项、每项当前状态（todo / in-progress / done）。这就是一份人类可读、机器可校验的"图状态"。
- `progress.txt` / 进度笔记：Agent 用自然语言记录"我做到哪了、下一步打算干什么、遇到了什么坑"。
- Git commit 作为检查点：每完成一个可验证的里程碑就 commit 一次。Git 天然是带版本的状态机——崩溃后 `git log` 就能看到最后一个可信状态，甚至能回滚。

### 3\. 恢复：重读文件，重建上下文

崩溃或新开一个 session 后，恢复流程不是加载某个二进制快照，而是让 Agent 重新读取这些产物文件：读 `feature_list.json` 知道哪些子任务已完成、哪些还没做；读 progress 笔记恢复"心智上下文"；读 git 历史确认代码状态。Agent 据此重建自己的工作记忆，然后从"第一个还没 done 的子任务"继续。

### 4\. 双 Agent 分工：initializer + coding agent

Anthropic 还提出用角色拆分来强化这套机制：一个 initializer agent 负责在任务开始时搭好脚手架（建立 feature\_list、初始化 git、写好规则文件），一个 coding/execution agent 在干净的上下文里专注执行并持续更新产物。这样每次恢复都能拿到一个"结构良好、状态清晰"的起点，而不是一堆混乱的对话残留。

Anthropic 路线的精髓：不相信易失的上下文，只相信落盘的产物。恢复能力不来自框架的魔法，而来自"每一步都留下人类和机器都能读懂的物理证据"。这套方法门槛低、通用性强、和现有工具（文件系统、Git）无缝，代价是需要 Agent 有良好的"记录纪律"，且恢复时要花上下文重新读文件。

## 六、三家横向对比

| 维度 | LangChain / LangGraph | OpenAI (Agents SDK) | Anthropic |
| --- | --- | --- | --- |
| 核心路线 | 状态检查点（Checkpointing） | 轻量 Sessions + 外包 Durable Execution | 文件系统即状态 / 产物即事实 |
| 状态存在哪 | Checkpointer 后端（内存/SQLite/Postgres） | Session 存对话；Temporal 事件历史存执行进度 | 文件系统 + Git（feature\_list.json、progress、commit） |
| 持久化粒度 | 每个 super-step 自动快照 | 每次 Activity 调用记录结果 | 每个里程碑手动落盘/commit |
| 恢复方式 | 同 thread\_id 重新 invoke，自动加载 | Temporal 重放代码、跳过已完成 Activity | 重读产物文件，Agent 重建上下文 |
| 副作用幂等 | 开发者自理 | Temporal 保证（重放不重执行） | 靠产物校验 + Git，部分自理 |
| 额外能力 | 时间旅行、重试策略、人在环路 | 确定性重放、生产级容错 | 低门槛、工具通用、人类可审计 |
| 主要成本/约束 | 需按框架建模图 + 状态形状 | Workflow 须确定性、引入 Temporal 依赖 | 依赖 Agent 记录纪律、恢复要重读文件 |

## 七、怎么给自己的 harness 选路线

三条路线不是互斥的，选择取决于任务特征：

如果你在做编排密集、需要细粒度控制和调试能力的 Agent——例如多分支决策、需要人工审批节点、想做"时间旅行"复盘——LangGraph 的 Checkpointer 模型最合适，它把状态管理做成了框架能力，开箱即用。

如果你的任务副作用重、对"绝不重复执行"要求高、且要跑在分布式生产环境——例如涉及真实交易、发消息、改数据库——OpenAI 推荐的 Temporal 持久化执行路线最稳，它从运行时层面保证了幂等和崩溃恢复，代价是接受确定性约束。

如果你想要低门槛、通用、可审计，且 Agent 产出本身就是文件（代码、报告、数据）——Anthropic 的文件系统即状态路线最务实，用 feature\_list + progress + git 就能撑起相当强的恢复能力，不引入任何重型依赖。

回到开篇那个"第 60 步崩溃"的跨表审计任务：一个成熟的 harness 往往组合使用——用类 LangGraph 的图状态机建模步骤依赖并 checkpoint 关键节点，用类 Temporal 的思路保证写库/发送这类副作用步骤幂等，同时把每张表的审计结论落成产物文件（类 Anthropic），让恢复既能精准定位断点，又不会重放危险副作用，还留下人类可复核的物理证据。这三者叠起来，才是"无感错误恢复"真正的工程形态。

---

### Sources

- [LangGraph — Persistence (Checkpointers, Threads, Store)](https://langchain-ai.github.io/langgraph/concepts/persistence/)
- [LangGraph — How to add persistence / memory to a graph](https://langchain-ai.github.io/langgraph/how-tos/persistence/)
- [LangGraph — Low-level concepts (super-steps, state)](https://langchain-ai.github.io/langgraph/concepts/low_level/)
- [OpenAI Agents SDK — Sessions (SQLite/Redis/SQLAlchemy/...)](https://openai.github.io/openai-agents-python/sessions/)
- [OpenAI Agents SDK — Docs & Temporal durable execution](https://openai.github.io/openai-agents-python/)
- [Temporal — Durable Execution for AI Agents](https://temporal.io/blog/durable-execution-for-ai-agents)
- [Anthropic — Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Diagrid — Durable Execution vs Checkpointing](https://www.diagrid.io/blog/durable-execution-vs-checkpointing)

中
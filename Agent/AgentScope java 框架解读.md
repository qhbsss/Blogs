---
title: "AgentScope java 框架解读"
source: "https://ata.atatech.org/articles/11020654022#NTRjMGI4"
author:
published:
created: 2026-05-31
description:
tags:
  - "clippings"
---
国际数字商业集团

粉丝 2影响力 64

** 10

**

**

** 原创文章

** AI辅助创作 50%

** 内部资料

发表到圈儿

[阿里国际技术](https://ata.atatech.org/community/team/100042) / [AI工程](https://ata.atatech.org/community/team/100042?cid=100068) (首发)

**

[王德惠(智峰)](https://ata.atatech.org/users/11001285312)

5月28日发表5月28日更新41次浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章1:14:46

**

## 0 概述

本文从源码和案例实现两个维度，逐一介绍 Agent、Models、Messages、Tools、Memory、Hooks、Skills、Graph/Pipeline、Multi-Agent、HITL 等核心组件

AgentScope Java：由阿里巴巴通义实验室开源，采用响应式架构（Reactor），以 `ReActAgent` + `Hook` 事件驱动为核心，内置 Toolkit 工具注册、PlanNotebook 结构化规划、Pipeline 多智能体编排等能力，强调轻量、可扩展与流式优先。

![[ac715088-c3a2-4574-a92e-8bf5a80a6389.png]]

源码地址： [https://github.com/agentscope-ai](https://github.com/agentscope-ai)

### 0.1 温习响应式编程

个人博客： [https://blog.csdn.net/wang852575989/article/details/107748307?spm=1001.2014.3001.5501](https://blog.csdn.net/wang852575989/article/details/107748307?spm=1001.2014.3001.5501)

为什么需要响应式编程？

在现代微服务架构中，系统需要处理海量并发请求，传统的同步阻塞式编程模型已无法满足高性能、高吞吐量的需求。Reactor 作为 Spring WebFlux 的核心依赖，提供了一套完整的响应式编程解决方案，能够以少量线程实现高并发处理。

核心优势：

●

高效资源利用：非阻塞 I/O，用少量线程处理大量并发

●

背压机制：消费者可控制数据流速，避免内存溢出

●

声明式编程：函数式 API，代码简洁可读

●

完整的异步链路：从数据库到 HTTP，全链路异步化

为什么 LLM 时代必须拥抱响应式？在传统的单体或微服务架构中，系统默认通过一个线程处理一个请求的。但在 AI 时代，以 百炼 或 IdeaLab 为代表的大模型API调用带来了

两个核心挑战：

●

超长耗时：模型生成内容可能长达数十秒。

●

流式输出：内容是一片片吐出的，同步等待会极大降低用户体验并耗尽线程池。

响应式编程（Reactive Programming）是支撑高并发、低延迟 AI 应用的必须选择。

![[ee012e53-9fe9-4bca-8179-f07a64652063.jpeg]]

#### 0.2 主流异步方案对比

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>方案</p></td><td rowspan="1" colspan="1"><p>优点</p></td><td rowspan="1" colspan="1"><p>缺点</p></td><td rowspan="1" colspan="1"><p>适用场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>Thread/ThreadPool</p></td><td rowspan="1" colspan="1"><p>简单直观</p></td><td rowspan="1" colspan="1"><p>线程开销大，难以管理</p></td><td rowspan="1" colspan="1"><p>简单的后台任务</p></td></tr><tr><td rowspan="1" colspan="1"><p>@Async</p></td><td rowspan="1" colspan="1"><p>Spring 集成简单</p></td><td rowspan="1" colspan="1"><p>本质还是线程池，缺乏流控制</p></td><td rowspan="1" colspan="1"><p>简单的异步方法调用</p></td></tr><tr><td rowspan="1" colspan="1"><p>CompletableFuture</p></td><td rowspan="1" colspan="1"><p>组合能力强，JDK 内置</p></td><td rowspan="1" colspan="1"><p>缺乏背压，不适合流式数据</p></td><td rowspan="1" colspan="1"><p>单次异步调用组合</p></td></tr><tr><td rowspan="1" colspan="1"><p>Reactor(Mono和Flux) / RxJava</p></td><td rowspan="1" colspan="1"><p>完整的响应式支持，背压机制</p></td><td rowspan="1" colspan="1"><p>学习曲线陡峭</p></td><td rowspan="1" colspan="1"><p>高并发流式数据处理</p></td></tr></tbody></table>

代码风格对比

// CompletableFuture 方式

CompletableFuture.supplyAsync(() -> A(id))

.thenApply(user -> B(user))

.thenAccept(user -> C(user));

// Reactor 方式

Mono.fromCallable(() -> A(id))

.map(user -> B(user))

.doOnNext(user -> C(user))

.subscribe();

#### 0.3 Reactor 核心概念

##### 0.3.1 两大核心类型

●

Mono：表示 0 或 1 个元素的异步序列（类似 CompletableFuture）

●

Flux：表示 0 到 N 个元素的异步序列（类似 Stream，但支持异步和背压）

##### 0.3.2 核心机制

●

发布-订阅模型：数据源（Publisher）在有订阅者（Subscriber）时才开始生产数据

●

背压（Backpressure）：订阅者可以向发布者请求特定数量的元素，防止过载

●

调度器（Scheduler）：控制代码在哪个线程池执行

●

操作符链：通过 map、flatMap、filter 等操作符组合复杂逻辑

##### 0.3.2 总结

从命令式到声明式的思维跃迁

Reactor Java 异步编程不仅是一套 API，更是一种流式优先（Streaming First）的设计思维。

心态转变：从“我在这一行要做什么”转变为“数据流转到这里时，应该如何变换”。

核心价值：不在于让单个任务变快，而在于让系统在面对海量高延迟任务（如 AI 推理、复杂 I/O）时，依然能以极低的资源消耗保持稳定。

<table><colgroup><col width="173"> <col width="382"> <col width="436"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>维度</p></td><td rowspan="1" colspan="1"><p>✅ 适合响应式的场景</p></td><td rowspan="1" colspan="1"><p>❌ 不适合响应式的场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>业务类型</p></td><td rowspan="1" colspan="1"><p>I/O 密集型</p></td><td rowspan="1" colspan="1"><p>CPU 密集型</p></td></tr><tr><td rowspan="1" colspan="1"><p>服务调用</p></td><td rowspan="1" colspan="1"><p>≥2 个外部服务，且无强依赖（可并行）</p><p>单据中心补全，调用多个服务，很适合用这个场景</p></td><td rowspan="1" colspan="1"><p>单次 DB 查询或单服务调用</p></td></tr><tr><td rowspan="1" colspan="1"><p>耗时特征</p></td><td rowspan="1" colspan="1"><p>I/O 耗时 >> CPU 耗时（如 HSF、HTTP 延迟高）</p></td><td rowspan="1" colspan="1"><p>纯内存计算，无 I/O 等待</p></td></tr><tr><td rowspan="1" colspan="1"><p>并发需求</p></td><td rowspan="1" colspan="1"><p>高并发</p></td><td rowspan="1" colspan="1"><p>低并发</p></td></tr><tr><td rowspan="1" colspan="1"><p>典型例子</p></td><td rowspan="1" colspan="1"><p>聚合多个外部服务数据• 定时任务 + 多 I/O 操作• 高并发 API 网关</p></td><td rowspan="1" colspan="1"><p>单体 CRUD 后台</p></td></tr></tbody></table>

## 1 整体架构与设计原则

AgentScope Java 是面向 Java 生态的 AI Agent 开发框架，定位为用反应式编程构建安全可控的生产级智能体。它以 Project Reactor（Mono / Flux）为运行时基础，原生支持流式输出、非阻塞 I/O 和安全中断，同时兼容 DashScope、OpenAI、Anthropic、Gemini、Ollama 等主流模型提供商。

框架从下到上分为两层，上层依赖下层能力：

![[21aa92e0-0551-44e9-a33c-fe83a4b32f14.jpeg]]

<table><colgroup><col width="250"> <col width="250"> <col width="482"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>层级</p></td><td rowspan="1" colspan="1"><p>定位</p></td><td rowspan="1" colspan="1"><p>核心组件</p></td></tr><tr><td rowspan="1" colspan="1"><p>Agent Framework</p></td><td rowspan="1" colspan="1"><p>开箱即用的智能体开发层</p></td><td rowspan="1" colspan="1"><p>ReActAgent（ReAct 推理 + 行动循环）、Multi-Agent 编排（Sequential / Fanout Pipeline、MsgHub）、Hooks 事件插桩、Memory 对话记忆、PlanNotebook 任务规划、Session 跨会话持久化</p></td></tr><tr><td rowspan="1" colspan="1"><p>Augmented LLM</p></td><td rowspan="1" colspan="1"><p>模型与工具的统一抽象</p></td><td rowspan="1" colspan="1"><p>Model（DashScope / OpenAI / Anthropic 等）、Toolkit（工具注册、Schema 生成、执行器）、MCP（远程工具发现与通信）、Msg + ContentBlock 消息体系、Formatter（跨厂商消息适配）</p></td></tr></tbody></table>

### 1.1 核心能力一览

●

ReAct 智能体：ReActAgent 将「模型推理（Reasoning） → 工具执行（Acting） → 再推理」封装为自动循环，支持结构化输出、流式响应与最大迭代限制。整条链路基于 Mono/Flux 组织，天然非阻塞。

●

多智能体编排：内置 SequentialPipeline（串行链）、FanoutPipeline（并行扇出）等 Pipeline，以及 MsgHub（多 Agent 共享消息空间）、Routing、Supervisor 等协作模式。

●

统一事件 Hook：所有生命周期扩展通过 Hook.onEvent(HookEvent) 统一收口，按 priority() 排序执行，支持在推理前后、工具执行前后、流式 chunk 等关键阶段注入异步逻辑。

●

人机协同（HITL）：PostReasoningEvent.stopAgent() 与 ToolSuspendException 支持在工具执行前暂停等待人工审批，或将工具挂起由外部系统补齐结果，中断后可恢复继续。

●

会话记忆与持久化：Memory 接口（继承 StateModule）管理对话消息；Session + SessionKey 实现 Agent / Memory / Toolkit / PlanNotebook 的跨会话序列化与恢复。

●

任务规划：PlanNotebook 自带一组计划工具（创建/修订子任务、改状态、收尾等）与 PlanToHint Hook，在每轮推理前自动注入结构化计划上下文。

### 1.2 核心流程

![[38bad8f4-aae6-4091-9e3d-f81a8458c3b3.jpeg]]

使用框架的注意事项：

单个 Agent 实例不要在多线程上并发调用 call() / stream()。源码在 AgentBase 的类注释里写得很明确（AgentBase.java L65-L70）：

/\*\*

\* Agent instances are NOT designed for concurrent execution. A single agent instance should not

\* be invoked concurrently from multiple threads (e.g., calling {@code call()} or {@code stream()}

\* simultaneously). The hooks list is mutable and modified during streaming operations without

\* synchronization, which is safe only under single-threaded execution per agent instance.

\*/

Toolkit 与 Memory 随 Agent 持有状态；多请求场景应为每个请求创建独立 Agent（或框架提供的池化/隔离方案），不要共享同一有状态实例。

### 1.3 快速感受：最小 Agent 示例

引入依赖：

<dependency>

<groupId>io.agentscope</groupId>

<artifactId>agentscope</artifactId>

<version>1.0.12</version>

</dependency>

/\*\*

\* @author wangdehui

\* @date 2026/5/01

\*/

public class AgentScopeTool {

public static void main(String\[\] args) {

ReActAgent agent = ReActAgent.builder()

.name("曼巴AI助理")

.sysPrompt("你是曼巴AI助理.")

.model(DashScopeChatModel.builder()

.apiKey(System.getenv("xxxxx"))

.modelName("qwen3-max")

.build())

.build();

Msg response = agent.call(Msg.builder()

.textContent("Hello!")

.build()).block();

System.out.println(response.getTextContent());

}

}

---

## 2 Agent

### 2.1 组件介绍

#### 2.1.1 组件定位

ReActAgent 是 AgentScope Java 框架的核心入口，也是开发者最常接触的 API。它封装了 ReAct（Reasoning + Acting）范式——让大模型在「推理」与「行动」之间自动迭代，直至任务完成。与 Spring AI Alibaba 的 ReactAgent 将自身编译为 StateGraph 不同，AgentScope Java 的 ReActAgent 直接用 Project Reactor 的 Mono/Flux 管道组织推理与行动流程，不依赖图运行时。

从使用角度看，ReActAgent 支持以下几种典型场景：

●

单轮问答：传入一条消息，模型直接回复。

●

工具增强：配置 Toolkit 后，模型可自动决定何时调用工具，形成「推理 → 调工具 → 再推理」的闭环。

●

多轮会话：通过 Memory + Session/StateModule 实现跨调用的状态恢复。

●

多智能体编排：ReActAgent 继承 AgentBase，可作为 SequentialPipeline、FanoutPipeline 等 Pipeline 的节点组合为更大的协作拓扑。

●

结构化输出：继承 StructuredOutputCapableAgent，支持通过 call(msg, OutputClass.class) 让模型直接返回结构化 Java 对象。

●

生命周期扩展：通过 Hook 在执行流的关键阶段注入自定义逻辑（日志、审计、人机协同等）。

一句话总结：ReActAgent 是框架面向开发者的统一入口，用建造者模式一站式组装模型、工具、记忆与扩展点，向下通过 Reactor 管道驱动 ReAct 循环，向上提供简洁的 call() / stream() API。

#### 2.1.2 组件基本原理

ReActAgent 的运行本质是一个 反应式 Mono/Flux 管道驱动的 ReAct 循环。其基本原理可归纳为三步：

1.

构建阶段（ `ReActAgent.builder().build()` ）：通过 Builder 组装 Model、Toolkit、Memory、Hook 列表、maxIters、可选的 PlanNotebook / 长期记忆等。构造完成后，Agent 持有所有配置，准备接受调用。

2.

执行阶段（ `call()` / `stream()` ）：每次调用经过 AgentBase 的运行态管理，进入 ReActAgent.doCall()，根据当前状态分流：

○

普通新轮：写入 memory → executeIteration(0) → reasoning() →（若有工具调用）acting() → 下一轮 reasoning()...

○

无参恢复：memory 中已有未执行的 ToolUseBlock → 直接进入 acting(0)

○

用户补 ToolResult：用户提供工具结果消息 → 写入 memory → 继续迭代

3.

终止条件：循环在以下任一条件下停止，通过 GenerateReason 枚举显式告知调用方「为什么返回」：

○

`MODEL_STOP` — 模型正常完成

○

`TOOL_CALLS` — 模型返回工具调用（内部继续执行）

○

`STRUCTURED_OUTPUT` — 结构化输出完成

○

`TOOL_SUSPENDED` — 工具挂起，等待用户提供结果

○

`REASONING_STOP_REQUESTED` / `ACTING_STOP_REQUESTED` — Hook 请求停止（HITL）

○

`INTERRUPTED` — 外部中断

○

`MAX_ITERATIONS` — 达到最大迭代次数

### 2.2 使用案例举例

import io.agentscope.core.ReActAgent;

import io.agentscope.core.model.DashScopeChatModel;

import io.agentscope.core.message.Msg;

// 1. 构建模型

DashScopeChatModel model = DashScopeChatModel.builder()

.apiKey(System.getenv("xxxx"))

.modelName("qwen3-max")

.build();

// 2. 构建 Agent（仅传入模型）

ReActAgent agent = ReActAgent.builder()

.name("qa\_agent")

.sysPrompt("你是曼巴AI助理。")

.model(model)

.build();

// 3. 调用

Msg response = agent.call(Msg.builder()

.textContent("请简要介绍一下自己。")

.build()).block();

System.out.println(response.getTextContent());

### 2.3 底层实现原理

以上述案例为例， `agent.call(msg).block()` 触发的完整数据流如下：

●

Step 1 — AgentBase 运行态管理： `call()` 进入 AgentBase，触发 PreCallEvent，检查中断状态，然后委派给 ReActAgent.doCall()。

●

Step 2 — doCall 分流入口：检查 `getPendingToolUseIds()` ——本案例是全新对话，pendingIds 为空，走「普通新轮」分支： `addToMemory(msgs)` 把用户消息写入默认 Memory，然后进入 `executeIteration(0)` 。

●

Step 3 — Reasoning 阶段：a. 触发 PreReasoningEvent，Hook 可修改输入消息或注入额外上下文b. 调用 `model.stream(event.getInputMessages(), toolSchemas=[], options)` —— 本案例未注册工具，toolSchemas 为空列表，DashScope 模型仅收到对话历史，返回 `Flux<ChatResponse>` 流式响应c. 流式 chunk 通过 ReasoningContext 聚合，每个 chunk 触发 ReasoningChunkEvent（可观测）d. 聚合完成后触发 PostReasoningEvent，将助手消息写入 Memorye. 检查返回的 Msg 是否包含 ToolUseBlock —— 本案例未注册工具，模型直接返回文本回复，不包含 ToolUseBlock

●

Step 4 — 终止与返回： `isFinished()` 判定为 true（无工具调用请求），返回 Msg，GenerateReason 为 `MODEL_STOP` 。整个过程仅执行一轮 Reasoning，不进入 Acting 阶段。

其中 `isFinished()` 的判断逻辑为：遍历 Msg 的 ContentBlock 列表，若不存在任何 ToolUseBlock 实例，则返回 true。

ReActAgent.builder() 支持的配置参数如下：

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="430"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>分类</p></td><td rowspan="1" colspan="1"><p>参数</p></td><td rowspan="1" colspan="1"><p>类型</p></td><td rowspan="1" colspan="1"><p>作用</p></td></tr><tr><td rowspan="1" colspan="1"><p>基本信息</p></td><td rowspan="1" colspan="1"><div><code>name</code></div></td><td rowspan="1" colspan="1"><p>String</p></td><td rowspan="1" colspan="1"><p>Agent 名称，用于日志、事件标识和 Session 状态存储</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>description</code></div></td><td rowspan="1" colspan="1"><p>String</p></td><td rowspan="1" colspan="1"><p>Agent 描述，用于日志和 Pipeline 中的元数据展示</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>sysPrompt</code></div></td><td rowspan="1" colspan="1"><p>String</p></td><td rowspan="1" colspan="1"><p>系统提示词，在每轮 Reasoning 时由 prepareMessages() 插入到消息列表头部</p></td></tr><tr><td rowspan="1" colspan="1"><p>模型配置</p></td><td rowspan="1" colspan="1"><div><code>model</code></div></td><td rowspan="1" colspan="1"><p>Model</p></td><td rowspan="1" colspan="1"><p>推理使用的模型实例（如 DashScopeChatModel、OpenAIChatModel），必填</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>generateOptions</code></div></td><td rowspan="1" colspan="1"><p>GenerateOptions</p></td><td rowspan="1" colspan="1"><p>模型生成参数（temperature、topP、maxTokens 等），传入 model.stream()</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>modelExecutionConfig</code></div></td><td rowspan="1" colspan="1"><p>ExecutionConfig</p></td><td rowspan="1" colspan="1"><p>模型调用的执行配置（超时、重试等）</p></td></tr><tr><td rowspan="1" colspan="1"><p>工具配置</p></td><td rowspan="1" colspan="1"><div><code>toolkit</code></div></td><td rowspan="1" colspan="1"><p>Toolkit</p></td><td rowspan="1" colspan="1"><p>工具集，通过 registerTool() / registerObject() 注册 @Tool 注解的方法</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>toolExecutionContext</code></div></td><td rowspan="1" colspan="1"><p>ToolExecutionContext</p></td><td rowspan="1" colspan="1"><p>工具执行上下文，向工具传递额外的环境信息（如用户 ID、会话信息）</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>toolExecutionConfig</code></div></td><td rowspan="1" colspan="1"><p>ExecutionConfig</p></td><td rowspan="1" colspan="1"><p>工具调用的执行配置（超时、重试等）</p></td></tr><tr><td rowspan="1" colspan="1"><p>记忆</p></td><td rowspan="1" colspan="1"><div><code>memory</code></div></td><td rowspan="1" colspan="1"><p>Memory</p></td><td rowspan="1" colspan="1"><p>对话记忆存储，默认 InMemoryMemory，保存历史消息供模型每轮推理读取</p></td></tr><tr><td rowspan="1" colspan="1"><p>执行控制</p></td><td rowspan="1" colspan="1"><div><code>maxIters</code></div></td><td rowspan="1" colspan="1"><p>int</p></td><td rowspan="1" colspan="1"><p>ReAct 循环最大迭代次数，超出后进入 summarizing() 并返回 MAX_ITERATIONS</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>checkRunning</code></div></td><td rowspan="1" colspan="1"><p>boolean</p></td><td rowspan="1" colspan="1"><p>是否检查 Agent 运行状态，防止同一实例并发调用 call()（默认 true）</p></td></tr><tr><td rowspan="1" colspan="1"><p>生命周期</p></td><td rowspan="1" colspan="1"><div><code>hooks</code></div></td><td rowspan="1" colspan="1"><p>List</p></td><td rowspan="1" colspan="1"><p>生命周期钩子列表，在 PreReasoning、PostReasoning、PreActing、PostActing 等事件点执行自定义逻辑</p></td></tr><tr><td rowspan="1" colspan="1"><p>计划</p></td><td rowspan="1" colspan="1"><div><code>planNotebook</code></div></td><td rowspan="1" colspan="1"><p>PlanNotebook</p></td><td rowspan="1" colspan="1"><p>计划本，在 Reasoning 阶段自动解析模型输出中的任务计划，支持状态跟踪与持久化</p></td></tr><tr><td rowspan="1" colspan="1"><p>知识库 (RAG)</p></td><td rowspan="1" colspan="1"><div><code>knowledge</code></div></td><td rowspan="1" colspan="1"><p>Knowledge</p></td><td rowspan="1" colspan="1"><p>RAG 知识库实例，配合 ragMode 在 Reasoning 前自动检索相关文档并注入上下文</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>ragMode</code></div></td><td rowspan="1" colspan="1"><p>RAGMode</p></td><td rowspan="1" colspan="1"><p>RAG 模式：TOOL（模型主动调用检索工具）或 HOOK（每轮自动检索注入）</p></td></tr><tr><td rowspan="1" colspan="1"><p>技能</p></td><td rowspan="1" colspan="1"><div><code>skillBox</code></div></td><td rowspan="1" colspan="1"><p>SkillBox</p></td><td rowspan="1" colspan="1"><p>技能盒，通过 SkillHook 在模型调用前注入技能摘要，并提供 read_skill 工具加载完整技能内容</p></td></tr><tr><td rowspan="1" colspan="1"><p>结构化输出</p></td><td rowspan="1" colspan="1"><div><code>structuredOutputReminder</code></div></td><td rowspan="1" colspan="1"><p>StructuredOutputReminder</p></td><td rowspan="1" colspan="1"><p>结构化输出提醒策略，在 Reasoning 前追加 JSON Schema 格式约束提示</p></td></tr><tr><td rowspan="1" colspan="1"><p>状态持久化</p></td><td rowspan="1" colspan="1"><div><code>statePersistence</code></div></td><td rowspan="1" colspan="1"><p>StatePersistence</p></td><td rowspan="1" colspan="1"><p>控制哪些组件的状态需要持久化到 Session（Memory、Toolkit、PlanNotebook），默认全部持久化</p></td></tr></tbody></table>

## 3 Model

### 3.1 组件介绍

#### 3.1.1 组件定位

Model 是 AgentScope Java 定义的模型抽象层，统一了「向 LLM 发起一次流式对话」的契约。与 Spring AI 的 ChatModel 提供 call(Prompt) / stream(Prompt) 两个方法不同，AgentScope Java 的 Model 接口只有一个核心方法 stream()，入参是 AgentScope 统一的 Msg 列表 + 工具 Schema + GenerateOptions，出参是 Flux。具体厂商在实现类里完成鉴权、HTTP/SDK、以及 Formatter（把 Msg 转成厂商接受的格式）。

public interface Model {

/\*\*

\* The model internally handles message formatting using its configured formatter.

\*/

Flux<ChatResponse> stream(List<Msg> messages, List<ToolSchema> tools, GenerateOptions options);

String getModelName();

}

常见实现：DashScopeChatModel、OpenAIChatModel、AnthropicChatModel、GeminiChatModel、OllamaChatModel 等；OpenAI 兼容端点（vLLM、DeepSeek 等）通常也可走 OpenAI 风格客户端。

从使用角度看，Model 涉及以下几个关键概念：

●

GenerateOptions：控制生成行为的参数集合（temperature、maxTokens、enableThinking 等）。可在 ReActAgent.builder() 中通过 generateOptions() 设置全局默认，也可在 PreReasoningEvent Hook 中按轮次覆盖。

●

Formatter：跨厂商消息适配的核心。每个 Model 实现内部持有一个 Formatter（如 DashScopeFormatter、OpenAIFormatter），负责将统一的 Msg / ContentBlock 映射为厂商特定的 JSON payload。

●

ChatResponse：模型返回结果，包含流式 chunk 的文本、工具调用、thinking 块等内容。

●

与 Agent 的关系：ReActAgent 在 reasoning() 阶段调用 model.stream(prepareMessages(), toolkit.getToolSchemas(), options)，模型层对 Agent 层完全透明。

#### 3.1.2 组件基本原理

Model 的运行本质是一次「统一消息 → 厂商 payload → 流式响应」的适配过程。其基本原理可归纳为三层：

1.

接口层（Model 接口）：定义唯一的 stream() 方法，所有厂商实现均遵循此契约，实现策略模式——不同模型可互换。

2.

适配层（如 DashScopeChatModel）：每个厂商实现负责三件事：

○

请求转换：通过内部持有的 Formatter 将 AgentScope 统一的 Msg / ContentBlock 转换为厂商特定的 API 请求格式。例如 DashScopeFormatter 将 TextBlock、ToolUseBlock、ToolResultBlock、ThinkingBlock 等映射为 DashScope API 要求的 JSON 结构。

○

API 通信：通过 HTTP 客户端发起实际网络请求，API Key 通常从环境变量或 Builder 参数注入。

○

响应转换：将厂商返回的原始 SSE 流解析为 AgentScope 统一的 ChatResponse，以 Flux 形式返回。

3.

多智能体适配：多 Agent 场景下，需要 MultiAgentFormatter 变体（例如 DashScopeMultiAgentFormatter），以便在消息里携带多角色、多 Agent 的上下文字段；这与 Pipeline、MsgHub 等编排方式配套。

### 3.2 使用案例举例

// ===== 1. 构建 DashScope 模型 =====

DashScopeChatModel model = DashScopeChatModel.builder()

.apiKey(System.getenv("xxxx")) // API Key，推荐从环境变量读取

.modelName("qwen3-max") // 模型名称

.build();

// ===== 2. 配置生成参数（可选） =====

GenerateOptions options = GenerateOptions.builder()

.temperature(0.7) // 采样温度

.maxTokens(2000) // 最大生成 token 数

.enableThinking(true) // 启用 Qwen3 深度思考链

.build();

// ===== 3. 注入 Agent =====

ReActAgent agent = ReActAgent.builder()

.name("曼巴AI助理")

.model(model)

.generateOptions(options) // 全局默认生成参数

.build();

更换厂商时一般是「替换 model(...) 的构建器」，Agent 侧代码结构保持不变。

### 3.3 底层实现原理

以上述案例为例，当 ReActAgent 进入 reasoning() 阶段时，完整调用路径如下：

●

Step 1 — 消息组装：prepareMessages() 从 Memory 中取出所有历史 Msg，组成 List。同时 toolkit.getToolSchemas() 返回当前启用的工具 Schema 列表。

●

Step 2 — Formatter 适配：DashScopeChatModel.stream() 内部先调用 DashScopeFormatter 将统一的 Msg / ContentBlock（TextBlock、ToolUseBlock、ToolResultBlock、ThinkingBlock）转换为 DashScope API 要求的 JSON 结构。GenerateOptions 中的 temperature、maxTokens、enableThinking 等参数也被映射到请求体的对应字段。

●

Step 3 — 流式响应与聚合：stream() 返回 Flux，ReActAgent 用 ReasoningContext 消费 chunk，边收边触发 ReasoningChunkEvent（可观测），兼顾低延迟与可中断。聚合完成后的 Msg 包含文本内容、可能的 ToolUseBlock、可能的 ThinkingBlock（开启深度思考时）。

●

Step 4 — 与 Agent 的衔接：聚合后的 Msg 写入 memory，然后根据是否包含 ToolUseBlock 决定是进入 acting() 还是直接返回。整个过程中，Agent 层只组装消息与工具列表，将差异性下沉到 Model 实现。

完整调用链：

ReActAgent.reasoning()

→ model.stream(msgs, toolSchemas, options)

→ Formatter: Msg/ContentBlock → 厂商 JSON

→ HTTP 请求（SSE）

→ SSE → Flux<ChatResponse>

→ ReasoningContext 聚合 chunk

→ Msg 写入 Memory

GenerateOptions.builder() 支持的可选配置参数

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="428"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>分类</p></td><td rowspan="1" colspan="1"><p>参数</p></td><td rowspan="1" colspan="1"><p>类型</p></td><td rowspan="1" colspan="1"><p>作用</p></td></tr><tr><td rowspan="1" colspan="1"><p>采样控制</p></td><td rowspan="1" colspan="1"><div><code>temperature</code></div></td><td rowspan="1" colspan="1"><p>Double</p></td><td rowspan="1" colspan="1"><p>采样温度（0–2），值越高输出越随机，越低越确定</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>topP</code></div></td><td rowspan="1" colspan="1"><p>Double</p></td><td rowspan="1" colspan="1"><p>核采样参数（0–1），只从累积概率超过 topP 的最小 token 集合中采样</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>topK</code></div></td><td rowspan="1" colspan="1"><p>Integer</p></td><td rowspan="1" colspan="1"><p>每步只考虑概率最高的 K 个 token，值越小输出越聚焦</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>seed</code></div></td><td rowspan="1" colspan="1"><p>Long</p></td><td rowspan="1" colspan="1"><p>随机种子，相同 seed + 相同输入可复现相同输出（部分模型支持）</p></td></tr><tr><td rowspan="1" colspan="1"><p>长度限制</p></td><td rowspan="1" colspan="1"><div><code>maxTokens</code></div></td><td rowspan="1" colspan="1"><p>Integer</p></td><td rowspan="1" colspan="1"><p>最大生成 token 数</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>maxCompletionTokens</code></div></td><td rowspan="1" colspan="1"><p>Integer</p></td><td rowspan="1" colspan="1"><p>最大完成 token 数，部分 OpenAI 兼容 API 使用此字段替代 maxTokens</p></td></tr><tr><td rowspan="1" colspan="1"><p>重复惩罚</p></td><td rowspan="1" colspan="1"><div><code>frequencyPenalty</code></div></td><td rowspan="1" colspan="1"><p>Double</p></td><td rowspan="1" colspan="1"><p>频率惩罚（-2–2），根据 token 在已生成文本中的出现频率降低重复</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>presencePenalty</code></div></td><td rowspan="1" colspan="1"><p>Double</p></td><td rowspan="1" colspan="1"><p>存在惩罚（-2–2），只要 token 已出现过就降低其概率</p></td></tr><tr><td rowspan="1" colspan="1"><p>深度思考</p></td><td rowspan="1" colspan="1"><div><code>thinkingBudget</code></div></td><td rowspan="1" colspan="1"><p>Integer</p></td><td rowspan="1" colspan="1"><p>思考链最大 token 数，设置后启用模型的 Thinking 模式（如 Qwen3），模型会先输出推理过程再给出最终答案</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>reasoningEffort</code></div></td><td rowspan="1" colspan="1"><p>String</p></td><td rowspan="1" colspan="1"><p>推理努力等级（"low" / "medium" / "high"），控制模型在推理上投入的计算量（o1 系列模型）</p></td></tr><tr><td rowspan="1" colspan="1"><p>工具控制</p></td><td rowspan="1" colspan="1"><div><code>toolChoice</code></div></td><td rowspan="1" colspan="1"><p>ToolChoice</p></td><td rowspan="1" colspan="1"><p>工具调用策略：AUTO（模型自决）、REQUIRED（必须调用）、NONE（禁止调用）或指定某个工具名</p></td></tr><tr><td rowspan="1" colspan="1"><p>连接配置</p></td><td rowspan="1" colspan="1"><div><code>apiKey</code></div></td><td rowspan="1" colspan="1"><p>String</p></td><td rowspan="1" colspan="1"><p>覆盖模型默认的 API Key，用于按请求切换凭据</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>baseUrl</code></div></td><td rowspan="1" colspan="1"><p>String</p></td><td rowspan="1" colspan="1"><p>覆盖模型默认的 API 基址，用于按请求切换端点</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>endpointPath</code></div></td><td rowspan="1" colspan="1"><p>String</p></td><td rowspan="1" colspan="1"><p>自定义 API 路径（如 /v1/chat/completions），适配非标准 OpenAI 兼容端点</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>modelName</code></div></td><td rowspan="1" colspan="1"><p>String</p></td><td rowspan="1" colspan="1"><p>覆盖模型默认的模型名称，用于按请求切换模型</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>stream</code></div></td><td rowspan="1" colspan="1"><p>Boolean</p></td><td rowspan="1" colspan="1"><p>是否启用流式输出，true 为流式，false 为一次性返回</p></td></tr><tr><td rowspan="1" colspan="1"><p>扩展</p></td><td rowspan="1" colspan="1"><div><code>executionConfig</code></div></td><td rowspan="1" colspan="1"><p>ExecutionConfig</p></td><td rowspan="1" colspan="1"><p>执行配置（超时、重试、退避策略等）</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>cacheControl</code></div></td><td rowspan="1" colspan="1"><p>Boolean</p></td><td rowspan="1" colspan="1"><p>是否启用缓存控制（Anthropic 模型特有）</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>additionalHeaders</code></div></td><td rowspan="1" colspan="1"><p>Map<String, String></p></td><td rowspan="1" colspan="1"><p>额外的 HTTP 请求头，传递自定义元数据</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>additionalBodyParams</code></div></td><td rowspan="1" colspan="1"><p>Map<String, Object></p></td><td rowspan="1" colspan="1"><p>额外的请求体参数，用于传递框架未显式支持的厂商特有字段</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><div><code>additionalQueryParams</code></div></td><td rowspan="1" colspan="1"><p>Map<String, String></p></td><td rowspan="1" colspan="1"><p>额外的 URL 查询参数</p></td></tr></tbody></table>

未设置时使用模型实例的默认值。GenerateOptions 可在 ReActAgent.builder().generateOptions(...) 中设置全局默认，也可在 PreReasoningEvent Hook 中通过 event.setEffectiveGenerateOptions(...) 按轮次覆盖。

## 4 Message

### 4.1 组件介绍

#### 4.1.1 组件定位

Msg 是 AgentScope Java 定义的统一对话消息载体，是模型推理的最小信息单元。与 Spring AI 采用类型层级结构（UserMessage、AssistantMessage、SystemMessage、ToolResponseMessage）不同，AgentScope Java 采用单一 Msg 类 + 多种 ContentBlock 组合的设计：所有角色的消息都用同一个 Msg 类表示，通过 role 字段区分发送者，通过 ContentBlock 列表承载多样化内容。

核心 ContentBlock 类型包括：

●

TextBlock：纯文本内容，用户输入、模型回复的文本部分均用此表示。

●

ToolUseBlock：模型请求调用工具，包含工具名称、参数、唯一 ID。

●

ToolResultBlock：工具执行结果，与 ToolUseBlock 通过 toolUseId 关联。

●

ThinkingBlock：模型的思考过程（开启深度思考时产生）。

Msg 还携带 GenerateReason 字段，显式表达「这条消息为什么被生成」（模型停止、工具调用、HITL 停止、中断等）。

#### 4.1.2 组件基本原理

1.

统一消息模型：不同于 Spring AI 的多类型继承体系，AgentScope Java 用单一 Msg 类 + role 字段（system / user / assistant）区分角色，用 List 承载内容。这种设计使得一条消息可以同时包含文本、工具调用、思考过程等多种内容，而无需拆分为多条不同类型的消息。

2.

消息生命周期：在一次完整的 agent.call() 执行中，Memory 中的消息列表的增长过程如下：

<table><colgroup><col width="250"> <col width="250"> <col width="250"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>阶段</p></td><td rowspan="1" colspan="1"><p>操作</p></td><td rowspan="1" colspan="1"><p>消息内容</p></td></tr><tr><td rowspan="1" colspan="1"><p>① 输入</p></td><td rowspan="1" colspan="1"><p>addToMemory(msgs)</p></td><td rowspan="1" colspan="1"><p>Msg(role=user, content=[TextBlock])</p></td></tr><tr><td rowspan="1" colspan="1"><p>② 推理</p></td><td rowspan="1" colspan="1"><p>memory.addMessage(reasoningMsg)</p></td><td rowspan="1" colspan="1"><p>Msg(role=assistant, content=[TextBlock, ToolUseBlock...])</p></td></tr><tr><td rowspan="1" colspan="1"><p>③ 工具执行</p></td><td rowspan="1" colspan="1"><p>memory.addMessage(toolResultMsg)</p></td><td rowspan="1" colspan="1"><p>Msg(role=user, content=[ToolResultBlock...])</p></td></tr><tr><td rowspan="1" colspan="1"><p>④ 再推理</p></td><td rowspan="1" colspan="1"><p>memory.addMessage(finalMsg)</p></td><td rowspan="1" colspan="1"><p>Msg(role=assistant, content=[TextBlock])</p></td></tr><tr><td rowspan="1" colspan="1"><p>…</p></td><td rowspan="1" colspan="1"><p>重复 ②③④</p></td><td rowspan="1" colspan="1"><p>ReAct 循环直到无 ToolUse</p></td></tr></tbody></table>

3.

Pending 工具判断：getPendingToolUseIds() 通过比对「最后一条助手消息中的 ToolUseBlock id」与「memory 中已有 ToolResultBlock id」，判断是否仍需 Acting。这是恢复执行和 HITL 的关键机制。

### 4.2 使用案例举例

// ===== 1. 构建用户消息（纯文本） =====

Msg userMsg = Msg.builder()

.textContent("今天杭州天气怎么样？")

.build();

// 内部等价于：Msg(role="user", content=\[TextBlock("今天杭州天气怎么样？")\])

// ===== 2. 调用 Agent =====

Msg response = agent.call(userMsg).block();

// ===== 3. 读取响应内容 =====

System.out.println(response.getTextContent()); // 纯文本内容

System.out.println(response.getGenerateReason()); // MODEL\_STOP / TOOL\_SUSPENDED 等

// ===== 4. 遍历 ContentBlock（高级用法） =====

for (ContentBlock block: response.getContent()) {

if (block instanceof TextBlock tb) {

System.out.println("文本：" + tb.getText());

} else if (block instanceof ToolResultBlock trb) {

System.out.println("工具结果：" + trb.getContent());

}

}

// ===== 5. 构建带 ToolResult 的恢复消息（HITL 场景） =====

Msg toolResultMsg = Msg.builder()

.toolResult("tool-use-id-123", "工具执行结果内容")

.build();

agent.call(toolResultMsg).block(); // 补齐工具结果后继续执行

### 4.3 底层实现原理

以上述案例为例，Msg 在框架底层的作用路径如下：

●

Step 1 — 写入 Memory：addToMemory(msgs) 将用户 Msg 追加到 InMemoryMemory 的 CopyOnWriteArrayList 中。每条 Msg 保持完整的 ContentBlock 列表，不会被拆分。

●

Step 2 — 组装 Prompt：prepareMessages() 从 Memory 中取出所有 Msg，加上 sysPrompt（包装为 role=system 的 Msg），组成 List 传给 model.stream()。

●

Step 3 — Formatter 转换：Model 内部的 Formatter 将每条 Msg 的 role + List 转换为厂商特定的 JSON。例如：

○

TextBlock → {"type": "text", "text": "..."}

○

ToolUseBlock → {"type": "function", "function": {"name": "...", "arguments": "..."}}

○

ToolResultBlock → 厂商特定的工具结果格式

●

Step 4 — Pending 判断与恢复：getPendingToolUseIds() 比对最后一条助手 Msg 中的 ToolUseBlock.id 与 memory 中已有 ToolResultBlock.toolUseId，找出尚未执行的工具调用。这允许 doCall() 在无参恢复时直接进入 acting()，或在用户补上 ToolResult 后继续迭代。

---

## 5 Tool

### 5.1 组件介绍

#### 5.1.1 组件定位

Toolkit 是 AgentScope Java 的工具管理门面（Facade），将工具注册、Schema 生成、参数绑定、执行与错误处理统一收口。与 Spring AI Alibaba 直接使用 ToolCallback 列表不同，AgentScope Java 的 Toolkit 内部拆分为四个子组件：

●

ToolRegistry：工具注册表，按名称索引可执行项

●

ToolSchemaGenerator：Schema 生成器，将 @Tool 注解方法转为模型可理解的 ToolSchema

●

ToolMethodInvoker：参数绑定与方法调用，将 ToolUseBlock 中的 JSON 参数映射到 Java 方法参数

●

ToolExecutor：执行器，统一处理并行/顺序、超时、重试、校验与错误回落

从使用角度看，Toolkit 支持以下几种工具注册方式：

●

注解声明：在 Java 对象的方法上使用 @Tool / @ToolParam（参数名需显式 name =，因为 Java 运行时默认不带参数名）

●

流式 API：toolkit.registration() 流式注册工具对象、MCP、子 Agent 工具等

●

分组与动态启用：内置工具分组、reset\_equipped\_tools 元工具、以及 MCP 客户端集成，可对工具生态做「运行时扩缩」

#### 5.1.2 组件基本原理

Toolkit 的运行本质是一个 从注册到执行的四步流水线：

1.

注册阶段：registerTool(obj) 扫描对象上的 @Tool 注解方法，通过 ToolSchemaGenerator 生成 ToolSchema（名称、描述、参数 JSON Schema），并在 ToolRegistry 中建立「名称 → 可执行项」的索引。

2.

Schema 暴露：getToolSchemas() 返回当前启用的工具 Schema 列表，ReActAgent 在每轮 reasoning() 时将其传给 model.stream()，模型据此决定是否调用工具。

3.

执行阶段：callTools(toolUseBlocks) 委派给 ToolExecutor，后者统一处理并行/顺序、超时、重试、校验与错误回落（出错时为每个 ToolUse 构造错误 ToolResultBlock，避免整条 Agent 调用链异常中断）。

4.

挂起路径：工具方法抛出 ToolSuspendException 时，该工具的结果不会写入 memory，Agent 返回 GenerateReason.TOOL\_SUSPENDED，留给外部系统补执行或用户提交结果（与 doCall 里对 ToolResultBlock 的恢复逻辑闭合）。

### 5.2 使用案例举例

// ===== 1. 定义工具类 =====

public class WeatherService {

@Tool(description = "查询指定城市的当前天气")

public String getWeather(

@ToolParam(name = "city", description = "城市名称") String city) {

// 实际实现中调用天气 API

return city + "：晴，18-26℃";

}

}

// ===== 2. 注册工具并构建 Agent =====

Toolkit toolkit = new Toolkit();

toolkit.registerTool(new WeatherService());

ReActAgent agent = ReActAgent.builder()

.name("weather\_agent")

.model(model)

.toolkit(toolkit)

.memory(new InMemoryMemory())

.build();

// ===== 3. 调用 =====

Msg response = agent.call(Msg.builder()

.textContent("今天杭州天气怎么样？")

.build()).block();

### 5.3 底层实现原理

以上述案例为例，当模型在 Reasoning 阶段返回包含 ToolUseBlock 的 Msg 后，进入 Acting 阶段的完整执行路径如下：

1.

提取 Pending 工具调用：extractPendingToolCalls() 从最后一条助手 Msg 中提取所有 ToolUseBlock，构成待执行列表。

2.

并发/顺序执行：ToolExecutor 根据配置决定是并发执行（CompletableFuture）还是顺序执行。每个工具调用经历：

○

匹配 ToolRegistry 中的可执行项

○

ToolMethodInvoker 将 ToolUseBlock.arguments（JSON 字符串）解析为 Java 方法参数

○

反射调用目标方法

○

捕获异常并构造 ToolResultBlock（失败时包含错误信息）

3.

结果写回：所有 ToolResultBlock 组装为一条 Msg(role=user, content=\[ToolResultBlock...\])，写入 Memory。

4.

返回下一轮：acting() 方法返回 Mono，flatMap 到 executeIteration(iter + 1)，开始下一轮 Reasoning。

---

## 6 Hooks

### 6.1 组件介绍

#### 6.1.1 组件定位

Hook 是 AgentScope Java 的统一生命周期扩展机制。与 Spring AI Alibaba 将扩展点拆分为 AgentHook（图节点级）和 Interceptor（模型/工具调用链）两套体系不同，AgentScope Java 将所有扩展点统一收口到一个 Hook 接口的 onEvent(HookEvent) 方法中，通过事件类型区分不同阶段。

Hook 接口定义（Hook.java）：

public interface Hook {

<T extends HookEvent> Mono<T> onEvent(T event);

default int priority() { return 100; }

}

核心设计要素：

●

priority() 控制顺序：数值越小越先执行（默认 100），框架内置 Hook 通常使用较低优先级以确保在用户 Hook 之前运行

●

返回 Mono：支持在中间插入异步逻辑（鉴权、注入提示、审计日志、外部 API 调用等），支持 Reactor 算子链（flatMap、doOnNext 等）

●

类型安全的 switch 分发：Java 21 的 pattern matching 可在一个 onEvent 方法中对不同事件类型做精确匹配

#### 6.1.2 组件基本原理

一、事件类型总览与分类

AgentScope Java 定义了 12 种 Hook 事件，按 ReAct 循环的执行阶段分为四组：

<table><colgroup><col width="150"> <col width="150"> <col width="150"> <col width="150"> <col width="382"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>分组</p></td><td rowspan="1" colspan="1"><p>事件类型</p></td><td rowspan="1" colspan="1"><p>事件类</p></td><td rowspan="1" colspan="1"><p>可修改</p></td><td rowspan="1" colspan="1"><p>调用时机</p></td></tr><tr><td rowspan="1" colspan="1"><p>调用级</p></td><td rowspan="1" colspan="1"><p>PRE_CALL</p></td><td rowspan="1" colspan="1"><p>PreCallEvent</p></td><td rowspan="1" colspan="1"><p>❌ 通知</p></td><td rowspan="1" colspan="1"><p>Agent call()/stream() 入口，消息已写入 Memory 后</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><p>POST_CALL</p></td><td rowspan="1" colspan="1"><p>PostCallEvent</p></td><td rowspan="1" colspan="1"><p>✅ setFinalMessage()</p></td><td rowspan="1" colspan="1"><p>Agent 完成所有 ReAct 迭代后，最终消息返回前</p></td></tr><tr><td rowspan="1" colspan="1"><p>推理级</p></td><td rowspan="1" colspan="1"><p>PRE_REASONING</p></td><td rowspan="1" colspan="1"><p>PreReasoningEvent</p></td><td rowspan="1" colspan="1"><p>✅ setInputMessages() / setGenerateOptions()</p></td><td rowspan="1" colspan="1"><p>每轮 reasoning() 调用 model.stream() 之前</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><p>REASONING_CHUNK</p></td><td rowspan="1" colspan="1"><p>ReasoningChunkEvent</p></td><td rowspan="1" colspan="1"><p>❌ 通知</p></td><td rowspan="1" colspan="1"><p>模型流式输出的每个 chunk（含增量和累积两个视图）</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><p>POST_REASONING</p></td><td rowspan="1" colspan="1"><p>PostReasoningEvent</p></td><td rowspan="1" colspan="1"><p>✅ setReasoningMessage() / stopAgent() / gotoReasoning()</p></td><td rowspan="1" colspan="1"><p>模型推理完成、消息聚合后，进入 Acting 之前</p></td></tr><tr><td rowspan="1" colspan="1"><p>执行级</p></td><td rowspan="1" colspan="1"><p>PRE_ACTING</p></td><td rowspan="1" colspan="1"><p>PreActingEvent</p></td><td rowspan="1" colspan="1"><p>✅ setToolUse()</p></td><td rowspan="1" colspan="1"><p>每个工具执行前（N 个工具触发 N 次）</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><p>ACTING_CHUNK</p></td><td rowspan="1" colspan="1"><p>ActingChunkEvent</p></td><td rowspan="1" colspan="1"><p>❌ 通知</p></td><td rowspan="1" colspan="1"><p>工具执行过程中的流式进度</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><p>POST_ACTING</p></td><td rowspan="1" colspan="1"><p>PostActingEvent</p></td><td rowspan="1" colspan="1"><p>✅ setToolResult() / stopAgent()</p></td><td rowspan="1" colspan="1"><p>每个工具执行后（含结果修改和停止能力）</p></td></tr><tr><td rowspan="1" colspan="1"><p>摘要级</p></td><td rowspan="1" colspan="1"><p>PRE_SUMMARIZING</p></td><td rowspan="1" colspan="1"><p>PreSummaryEvent</p></td><td rowspan="1" colspan="1"><p>✅</p></td><td rowspan="1" colspan="1"><p>摘要阶段开始前</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><p>SUMMARIZING_CHUNK</p></td><td rowspan="1" colspan="1"><p>SummaryChunkEvent</p></td><td rowspan="1" colspan="1"><p>❌ 通知</p></td><td rowspan="1" colspan="1"><p>摘要流式输出的 chunk</p></td></tr><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><p>POST_SUMMARIZING</p></td><td rowspan="1" colspan="1"><p>PostSummaryEvent</p></td><td rowspan="1" colspan="1"><p>✅</p></td><td rowspan="1" colspan="1"><p>摘要完成后</p></td></tr><tr><td rowspan="1" colspan="1"><p>错误</p></td><td rowspan="1" colspan="1"><p>ERROR</p></td><td rowspan="1" colspan="1"><p>ErrorEvent</p></td><td rowspan="1" colspan="1"><p>❌ 通知</p></td><td rowspan="1" colspan="1"><p>执行过程中发生异常时（getError() 获取异常对象）</p></td></tr></tbody></table>

二、各事件类型详解

1.

PreCallEvent / PostCallEvent — 调用级

○

PreCallEvent：Agent 开始处理前触发，主要用于日志记录、指标采集、资源初始化。

○

PostCallEvent：Agent 完成所有迭代后触发，可读取和修改最终回复。

2.

PreReasoningEvent — 推理前

○

使用频率最高的 Hook 事件，在每轮 reasoning() 中调用 model.stream() 之前触发。

○

可用 API：getInputMessages() / setInputMessages()、getModelName()、getGenerateOptions() / setGenerateOptions()、getMemory()

○

使用场景：Prompt 增强、上下文注入（PlanNotebook、RAG、Skill）、参数覆盖

3.

ReasoningChunkEvent — 推理流式 chunk

○

模型流式输出期间，每个 chunk 触发一次。只读，不可修改。

○

提供两个视图：getIncrementalChunk()（本次新增）、getAccumulated()（累积完整内容）

4.

PostReasoningEvent — 推理后

○

功能最丰富的事件，可用 API：getReasoningMessage() / setReasoningMessage()、stopAgent()、gotoReasoning()

○

使用场景：HITL 工具审查、工具调用过滤、重定向推理、结果审计

5.

PreActingEvent — 工具执行前

○

每个工具执行前触发一次，可用 API：getToolUse() / setToolUse()、getToolkit()

6.

PostActingEvent — 工具执行后

○

每个工具执行后触发一次，可用 API：getToolResult() / setToolResult()、stopAgent()

7.

ErrorEvent — 错误处理

○

执行过程中发生异常时触发，只读。

### 6.2 使用案例举例

import io.agentscope.core.hook.\*;

import io.agentscope.core.message.\*;

import reactor.core.publisher.Mono;

import java.util.ArrayList;

import java.util.List;

// 定义综合 Hook

Hook comprehensiveHook = new Hook() {

@Override

public <T extends HookEvent> Mono<T> onEvent(T event) {

return switch (event) {

// 推理前：注入 System 指令

case PreReasoningEvent e -> {

List<Msg> messages = new ArrayList<>(e.getInputMessages());

messages.add(0, Msg.builder()

.role(MsgRole.SYSTEM)

.content(List.of(TextBlock.builder()

.text("Think step by step. Always verify your reasoning.")

.build()))

.build());

e.setInputMessages(messages);

System.out.println("\[Hook\] 推理开始，消息数：" + messages.size());

yield Mono.just(e);

}

// 流式输出：实时打印

case ReasoningChunkEvent e -> {

System.out.print(extractText(e.getIncrementalChunk()));

yield Mono.just(e);

}

// 推理后：记录模型输出

case PostReasoningEvent e -> {

System.out.println("\[Hook\] 推理完成，模型输出：" + extractText(e.getReasoningMessage()));

yield Mono.just(e);

}

// 工具执行前：打印工具信息

case PreActingEvent e -> {

### 6.3 底层实现原理

Hook 的完整作用路径如下：

1.

Hook 注册与排序：ReActAgent.builder().hook(comprehensiveHook) 将 Hook 加入 Agent 的 Hook 列表。若有多个 Hook，按 priority() 升序排列，数值越小越先执行。

2.

PreCallEvent 触发：agent.call(msg) 进入 AgentBase.call()，构造 PreCallEvent 并遍历 Hook 链。

3.

Reasoning 阶段的 Hook 触发：

○

notifyPreReasoningEvent(messages) → 构造 PreReasoningEvent → 遍历 Hook 链 → 注入 "Think step by step" 指令

○

model.stream() 执行，每个流式 chunk → notifyReasoningChunkEvent() → 构造 ReasoningChunkEvent → 逐字打印

○

消息聚合后 → notifyPostReasoningEvent() → 构造 PostReasoningEvent → 打印模型输出日志

4.

Acting 阶段的 Hook 触发：

○

notifyPreActingEvent(toolUse) → 构造 PreActingEvent → 打印工具名称和参数

○

toolkit.callTool() 执行工具

○

notifyPostActingEvent(toolUse, toolResult) → 构造 PostActingEvent → 打印执行结果

5.

PostCallEvent 触发：所有 ReAct 迭代完成后，构造 PostCallEvent(finalMessage) 遍历 Hook 链。

---

## 7 Memory

### 7.1 组件介绍

#### 7.1.1 组件定位

Memory 是 AgentScope Java 的对话记忆管理抽象，负责存储和提供 Agent 每轮推理所需的上下文消息。与 Spring AI Alibaba 通过 MemorySaver + Checkpoint + threadId 实现状态持久化不同，AgentScope Java 将 Memory 拆分为两层：

●

Memory 接口：继承 StateModule，提供 addMessage() / getMessages() / delete / clear 等最小集合，管理当前会话的短期记忆

●

Session + StateModule：跨会话持久化层，Memory / Toolkit / PlanNotebook 等均可实现 StateModule，通过 saveTo / loadFrom 与 SessionKey 做序列化恢复

常见实现：

●

短期记忆：InMemoryMemory（基于 CopyOnWriteArrayList 的内存实现，适合单次会话）

●

长期记忆：通过 ReActAgent.builder().longTermMemory() + longTermMemoryMode() 配置，支持三种模式（AGENT\_CONTROL、STATIC\_CONTROL、BOTH）

#### 7.1.2 组件基本原理

Memory 在框架中的运行机制可从三个方面了解：

1.

与 ReAct 循环的配合：ReActAgent 在推理前调用 prepareMessages() 从 memory 组装上下文；在产生助手消息、工具结果时调用 addMessage() 写回。Pending 工具调用通过比对「最后一条助手消息中的 ToolUseBlock id」与「memory 中已有 ToolResultBlock id」判断是否仍需 Acting。

2.

跨会话持久化：Memory 继承 StateModule，支持 saveTo(SessionKey) / loadFrom(SessionKey) 方法。Session 对象统一管理多个 StateModule（Memory、Toolkit、PlanNotebook 等）的序列化与恢复，实现「关闭后重连」场景。

3.

长期记忆策略：

○

AGENT\_CONTROL：Agent 通过工具调用主动控制长期记忆的读写

○

STATIC\_CONTROL：框架自动管理，无需 Agent 参与

○

BOTH：结合两者

### 7.2 使用案例举例

// ===== 1. 基本用法：内存短期记忆 =====

ReActAgent agent = ReActAgent.builder()

.name("你是曼巴AI助理")

.model(model)

.memory(new InMemoryMemory()) // CopyOnWriteArrayList 储存 Msg

.build();

// 多轮对话：memory 自动累积历史消息

agent.call(Msg.builder().textContent("你好").build()).block();

agent.call(Msg.builder().textContent("我刚才说了什么？").build()).block();

// Agent 可回答「你刚才说了『你好』」

// ===== 2. 跨会话持久化 =====

// 保存状态

Session session = new Session();

agent.saveTo(session, "my-session-key");

// 恢复状态（新建 Agent 后）

ReActAgent newAgent = ReActAgent.builder()

.name("你是曼巴AI助理")

.model(model)

.memory(new InMemoryMemory())

.build();

newAgent.loadFrom(session, "my-session-key");

// newAgent 现在拥有之前的对话历史

// ===== 3. 配置长期记忆 =====

ReActAgent agentWithLTM = ReActAgent.builder()

.name("你是曼巴AI助理")

.model(model)

.memory(new InMemoryMemory())

.longTermMemory(longTermMemoryImpl) // 长期记忆实现

.longTermMemoryMode(LongTermMemoryMode.BOTH) // Agent + 框架共同管理

.build();

### 7.3 底层实现原理

以上述基本用法案例为例，多轮对话时 Memory 的完整作用路径如下：

1.

用户消息写入：doCall() 中 addToMemory(msgs) 将用户 Msg 追加到 InMemoryMemory 的 CopyOnWriteArrayList。

2.

组装推理上下文：prepareMessages() 从 Memory 取出所有 Msg，加上 sysPrompt，组成 List 传给 model.stream()。这保证模型每次推理都能看到完整的对话历史。

3.

助手消息与工具结果写回：Reasoning 完成后，memory.addMessage(reasoningMsg) 写入助手消息（可能含 ToolUseBlock）。Acting 完成后，memory.addMessage(toolResultMsg) 写入工具结果。

4.

Pending 判断：下一轮 doCall() 或无参恢复时，getPendingToolUseIds() 比对 memory 中的 ToolUseBlock.id 与 ToolResultBlock.toolUseId，找出尚未执行的工具调用，决定是继续 Acting 还是开始新轮 Reasoning。

5.

StateModule 持久化：agent.saveTo(session, key) 内部遍历 Agent 持有的所有 StateModule（Memory、Toolkit、PlanNotebook），各自将状态序列化到 Session。loadFrom 反向恢复，实现「关闭后重连」场景。

---

## 8 Skills

### 2.8.1 组件介绍

#### 8.1.1 组件定位

Skills 是 AgentScope Java 的渐进式知识注入机制，让 Agent 根据任务需要动态加载预定义的操作指南。其设计借鉴了 Claude 的 Skills 理念——采用三阶段按需加载：初始只加载元数据（~100 token/Skill）→ 模型按需加载完整内容（<5k token）→ 按需访问资源文件。

框架涉及以下核心组件：

●

AgentSkill：技能的数据模型，包含 name、description、skillContent（SKILL.md 正文）、resources（可选的参考文档/脚本/示例）。支持 Builder、Markdown 解析、直接构造三种创建方式。

●

SkillBox：技能管理门面，持有 SkillRegistry（注册表）+ AgentSkillPromptProvider（提示词生成）+ SkillToolFactory（工具创建），并实现 StateModule 支持状态持久化。

●

SkillHook：Hook 实现，在每轮 PreReasoningEvent 时将技能摘要注入系统提示。

●

load\_skill\_through\_path：SkillToolFactory 自动创建的 AgentTool，接受 skillId + path 参数，按需加载技能内容或资源文件，同时激活该技能及其绑定的工具。

●

AgentSkillRepository（接口）：技能存储后端，内置实现包括 ClasspathSkillRepository、FileSystemSkillRepository、GitSkillRepository、MysqlSkillRepository、NacosSkillRepository。

#### 8.1.2 组件基本原理

核心数据模型：AgentSkill，可用 Builder 直接构建，无需文件系统：

AgentSkill skill = AgentSkill.builder()

.name("data\_analysis")

.description("Use when analyzing data...")

.skillContent("# Data Analysis\\n...")

.addResource("references/formulas.md", "# Common Formulas\\n...")

.build();

存储后端对比：

<table><colgroup><col width="250"> <col width="250"> <col width="250"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>存储后端</p></td><td rowspan="1" colspan="1"><p>读写</p></td><td rowspan="1" colspan="1"><p>适用场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>ClasspathSkillRepository</p></td><td rowspan="1" colspan="1"><p>只读</p></td><td rowspan="1" colspan="1"><p>预打包在 JAR 中的内置技能</p></td></tr><tr><td rowspan="1" colspan="1"><p>FileSystemSkillRepository</p></td><td rowspan="1" colspan="1"><p>读写</p></td><td rowspan="1" colspan="1"><p>本地开发、动态更新</p></td></tr><tr><td rowspan="1" colspan="1"><p>GitSkillRepository</p></td><td rowspan="1" colspan="1"><p>只读</p></td><td rowspan="1" colspan="1"><p>从 Git 仓库拉取技能，支持自动同步</p></td></tr><tr><td rowspan="1" colspan="1"><p>MysqlSkillRepository</p></td><td rowspan="1" colspan="1"><p>读写</p></td><td rowspan="1" colspan="1"><p>生产环境持久化存储</p></td></tr><tr><td rowspan="1" colspan="1"><p>NacosSkillRepository</p></td><td rowspan="1" colspan="1"><p>只读</p></td><td rowspan="1" colspan="1"><p>从 Nacos 实时拉取，支持变更订阅</p></td></tr></tbody></table>

### 8.2 使用案例举例

以下案例摘自官方文档 Skills (Progressive Disclosure)，展示如何为 Agent 配置 Skills，实现一个 SQL 助手根据业务领域按需加载库表 Schema。

// ===== 1. 创建模型 =====

Model model = DashScopeChatModel.builder()

.apiKey(System.getenv("xxxx"))

.modelName("qwen-plus")

.build();

// ===== 2. 从 classpath 加载技能 =====

// 目录结构：

// src/main/resources/skills/

// ├── sales\_analytics/

// │ └── SKILL.md # name: sales\_analytics, description: "客户、订单、营收相关 SQL"

// └── inventory\_management/

// └── SKILL.md # name: inventory\_management, description: "产品、仓库、库存相关 SQL"

ClasspathSkillRepository skillRepository = new ClasspathSkillRepository("skills");

// ===== 3. 创建 SkillBox 并注册技能 =====

Toolkit toolkit = new Toolkit();

SkillBox skillBox = new SkillBox(toolkit);

for (AgentSkill skill: skillRepository.getAllSkills()) {

skillBox.registration()

.skill(skill)

.apply();

}

// skillBox 自动注册 load\_skill\_through\_path 工具到 Toolkit

// ===== 4. 构建 Agent =====

ReActAgent agent = ReActAgent.builder()

.name("曼巴AI助理")

.model(model)

.toolkit(toolkit)

.skillBox(skillBox) // 自动注册 SkillHook + 技能工具

.memory(new InMemoryMemory())

.build();

### 8.3 底层实现原理

以上述案例为例，当 agent.call("查询上个月订单金额超过 1000 的所有客户") 执行时，Skills 在框架内部的完整调度过程如下：

1.

构建阶段：SkillBox 注册工具和 Hook

○

ReActAgent.builder().skillBox(skillBox).build() 时，框架自动执行：

■

SkillBox.bindToolkit() 将 Agent 的 Toolkit 副本绑定到 SkillBox

■

SkillToolFactory.createSkillTool() 创建 load\_skill\_through\_path 工具并注册到 Toolkit

■

SkillHook 被加入 Agent 的 Hook 链

2.

第 1 轮 Reasoning：技能摘要注入

○

PreReasoningEvent 触发，SkillHook.onEvent() 执行

○

SkillBox.generateHint() 遍历所有已注册技能的 name + description，生成约 100 token/Skill 的摘要文本

○

摘要以 `<system-hint>` 标签包裹，作为一条 Msg(role=SYSTEM) 追加到本轮推理的消息列表

○

模型收到 Hint 后判断任务涉及订单查询，返回 ToolUseBlock: load\_skill\_through\_path({"skillId": "sales\_analytics", "path": "SKILL.md"})

3.

第 1 轮 Acting：加载完整技能内容

○

ToolExecutor 调用 SkillToolFactory 创建的 AgentTool

○

工具执行 loadSkillResourceImpl()：

■

激活技能（包括绑定的工具组）

■

从 resources Map 中读取 SKILL.md 内容

■

返回完整 Markdown（含库表 Schema、业务规则、示例查询）

○

结果包装为 ToolResultBlock 写入 Memory

4.

第 2 轮 Reasoning：基于技能内容生成回复

○

模型读取 ToolResultBlock（完整 SKILL.md），结合用户的业务查询，按照技能中定义的 Schema 生成 SQL

○

模型返回纯文本（无 ToolUseBlock）→ isFinished() = true → ReAct 循环结束

---

## 9 高级功能

### 9.1 Planning（PlanNotebook）

#### 9.1.1 组件介绍

##### 9.1.1.1 组件定位

PlanNotebook 是 AgentScope Java 的结构化任务规划组件，让 Agent 能够将复杂任务拆解为子任务并跟踪执行进度。它同时是 StateModule（状态可随 Session 持久化）和工具提供者（自带一组计划工具）和 Hook 提供者（PlanToHint 在每轮推理前注入上下文）。

核心职责：

●

计划工具：创建/修订子任务、改状态、收尾、查看历史等（注册到 Toolkit）

●

PlanToHint Hook：在每轮 PreReasoning 时将当前计划状态翻译为 `<system-hint>...</system-hint>` 包裹的提示注入模型上下文

●

状态持久化：计划状态可随 Agent 一起 saveTo / loadFrom

##### 9.1.1.2 组件基本原理

一、数据模型：Plan → SubTask 两级结构

PlanNotebook 的核心数据单元是 Plan 和 SubTask：

// Plan 核心字段

public class Plan {

private String id = UUID.randomUUID().toString();

private String name;

private String description;

private String expectedOutcome;

private List<SubTask> subtasks;

private PlanState state = PlanState.TODO; // TODO → IN\_PROGRESS → DONE / ABANDONED

private String createdAt;

private String finishedAt;

private String outcome;

}

// SubTask 核心字段

public class SubTask {

private String name;

private String description;

private String expectedOutcome;

private SubTaskState state = SubTaskState.TODO; // TODO → IN\_PROGRESS → DONE / ABANDONED

private String outcome;

private String createdAt;

private String finishedAt;

}

状态机流转：TODO → IN\_PROGRESS → DONE / ABANDONED

Plan 和 SubTask 均提供 toMarkdown(boolean detailed) 方法，将当前状态渲染为 Markdown 文本，供 Hint 注入时使用。

二、工具体系：10 个计划工具的注册与职责

PlanNotebook 自身即是一个工具提供者——它的方法使用 @Tool 和 @ToolParam 注解标记，在 Agent 构建阶段由 Toolkit 统一扫描注册。这 10 个工具覆盖了计划从创建到归档的完整生命周期：

<table><colgroup><col width="250"> <col width="250"> <col width="250"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>工具名</p></td><td rowspan="1" colspan="1"><p>触发时机</p></td><td rowspan="1" colspan="1"><p>功能说明</p></td></tr><tr><td rowspan="1" colspan="1"><p>create_plan</p></td><td rowspan="1" colspan="1"><p>模型判断任务复杂、需要拆解时</p></td><td rowspan="1" colspan="1"><p>创建 Plan，设置 name/description/expectedOutcome 并初始化 SubTask 列表</p></td></tr><tr><td rowspan="1" colspan="1"><p>update_plan_info</p></td><td rowspan="1" colspan="1"><p>需修改计划元信息时</p></td><td rowspan="1" colspan="1"><p>更新当前 Plan 的 name、description 或 expectedOutcome</p></td></tr><tr><td rowspan="1" colspan="1"><p>revise_current_plan</p></td><td rowspan="1" colspan="1"><p>执行过程中发现需要调整时</p></td><td rowspan="1" colspan="1"><p>批量新增、修改或删除 SubTask</p></td></tr><tr><td rowspan="1" colspan="1"><p>update_subtask_state</p></td><td rowspan="1" colspan="1"><p>开始执行某个子任务时</p></td><td rowspan="1" colspan="1"><p>将 SubTask 状态改为 todo / in_progress / abandoned</p></td></tr><tr><td rowspan="1" colspan="1"><p>finish_subtask</p></td><td rowspan="1" colspan="1"><p>子任务完成时</p></td><td rowspan="1" colspan="1"><p>标记为 done，记录 outcome 和 finishedAt</p></td></tr><tr><td rowspan="1" colspan="1"><p>view_subtasks</p></td><td rowspan="1" colspan="1"><p>模型需要确认当前进度时</p></td><td rowspan="1" colspan="1"><p>返回所有 SubTask 的详细 Markdown</p></td></tr><tr><td rowspan="1" colspan="1"><p>get_subtask_count</p></td><td rowspan="1" colspan="1"><p>避免遗漏子任务</p></td><td rowspan="1" colspan="1"><p>返回当前 Plan 中 SubTask 数量</p></td></tr><tr><td rowspan="1" colspan="1"><p>finish_plan</p></td><td rowspan="1" colspan="1"><p>所有子任务完成或用户取消时</p></td><td rowspan="1" colspan="1"><p>将 Plan 标记为 DONE / ABANDONED，归档到 PlanStorage</p></td></tr><tr><td rowspan="1" colspan="1"><p>view_historical_plans</p></td><td rowspan="1" colspan="1"><p>需要参考历史计划时</p></td><td rowspan="1" colspan="1"><p>从 PlanStorage 列出已归档的历史计划</p></td></tr><tr><td rowspan="1" colspan="1"><p>recover_historical_plan</p></td><td rowspan="1" colspan="1"><p>需要恢复已归档计划时</p></td><td rowspan="1" colspan="1"><p>从 PlanStorage 恢复历史计划为当前 Plan</p></td></tr></tbody></table>

这些工具和普通 @Tool 方法一样，由 模型自主决策 是否调用。但 PlanNotebook 通过 Hint 注入在每轮推理前向模型「建议」下一步应做什么，从而引导模型在合适时机调用对应工具。

三、Hint 注入机制：PlanToHint + DefaultPlanToHint

PlanNotebook 的核心设计是通过 Hook 在每轮 PreReasoningEvent 时自动注入 Hint，让模型始终感知当前计划状态。

默认实现 DefaultPlanToHint 根据当前 Plan 状态分为 五种场景，生成不同的引导文本：

<table><colgroup><col width="250"> <col width="250"> <col width="250"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>场景</p></td><td rowspan="1" colspan="1"><p>判定条件</p></td><td rowspan="1" colspan="1"><p>Hint 引导内容</p></td></tr><tr><td rowspan="1" colspan="1"><p>No Plan</p></td><td rowspan="1" colspan="1"><p>plan == null</p></td><td rowspan="1" colspan="1"><p>引导模型对复杂任务调用 create_plan</p></td></tr><tr><td rowspan="1" colspan="1"><p>At the Beginning</p></td><td rowspan="1" colspan="1"><p>所有 SubTask 状态为 TODO</p></td><td rowspan="1" colspan="1"><p>引导模型将第一个子任务标记为 in_progress 并开始执行</p></td></tr><tr><td rowspan="1" colspan="1"><p>Subtask In Progress</p></td><td rowspan="1" colspan="1"><p>存在状态为 IN_PROGRESS 的 SubTask</p></td><td rowspan="1" colspan="1"><p>显示该子任务详情，引导模型继续执行或调用 finish_subtask</p></td></tr><tr><td rowspan="1" colspan="1"><p>No Subtask In Progress</p></td><td rowspan="1" colspan="1"><p>有 SubTask 已完成但无 IN_PROGRESS</p></td><td rowspan="1" colspan="1"><p>引导模型选择下一个 TODO 子任务并标记为 in_progress</p></td></tr><tr><td rowspan="1" colspan="1"><p>At the End</p></td><td rowspan="1" colspan="1"><p>所有 SubTask 为 DONE / ABANDONED</p></td><td rowspan="1" colspan="1"><p>引导模型调用 finish_plan 收尾</p></td></tr></tbody></table>

每个场景的 Hint 都以 `<system-hint>...</system-hint>` 标签包裹，并内嵌当前 Plan 的 Markdown 渲染结果。

四、Agent 构建阶段：工具与 Hook 的自动注册

使用 ReActAgent.builder().planNotebook(planNotebook) 或快捷方法.enablePlan() 时，Builder 的 build() 内部自动完成：

1.

注册计划工具：将 PlanNotebook 实例注册到 Agent 的 Toolkit，Toolkit 通过反射扫描其 @Tool 注解方法，生成 10 个工具的 Schema 并存入工具注册表

2.

注册 PlanToHint Hook：将 PlanNotebook 作为 Hook 加入 Agent 的 Hook 链，使其能在 PreReasoningEvent 时被触发

3.

注册 StateModule：PlanNotebook 实现了 StateModule 接口，Agent 在 saveTo() / loadFrom() 时会自动调用 planNotebook.saveTo() / planNotebook.loadFrom()

五、运行时闭环：Hint → Reasoning → Tool → 状态更新 → 下一轮 Hint

完整的执行流程如下：

1.

PreReasoningEvent 触发 — 每轮 reasoning() 前，Agent 遍历 Hook 链，PlanNotebook 的 Hook 被调用，执行 planToHint.generateHint(currentPlan, this)

2.

Hint 注入 — 生成的 `<system-hint>` 文本作为一条 Msg(role=SYSTEM) 追加到本轮推理的消息列表中，模型因此「看到」当前计划状态和下一步建议

3.

模型推理 — model.stream(messagesWithHint, toolSchemas, options) 执行，模型根据 Hint 决定是调用计划工具还是业务工具

4.

Acting 执行 — 若模型调用了计划工具（如 finish\_subtask），Toolkit 匹配到 PlanNotebook 上的 @Tool 方法并执行，内部修改 currentPlan 的 SubTask 状态

5.

下一轮循环 — ReAct 循环进入下一轮 Reasoning，PreReasoningEvent 再次触发，Hook 读取 已更新 的 currentPlan，生成新的 Hint（可能场景已从 "Subtask In Progress" 变为 "No Subtask In Progress"），从而引导模型处理下一个子任务

6.

计划完成 — 当所有 SubTask 完成，Hint 变为 "At the End" 场景，引导模型调用 finish\_plan，Plan 被归档到 PlanStorage

#### 9.1.2 使用案例举例

// 1. 构建 PlanNotebook（完整自定义配置）

PlanNotebook planNotebook = PlanNotebook.builder()

.planToHint(new DefaultPlanToHint()) // 计划 → 提示的转换策略

.storage(new InMemoryPlanStorage()) // 内存存储

.maxSubtasks(10) // 最大子任务数

.needUserConfirm(false) // 跳过用户确认，立即执行

.keyPrefix("mainPlan") // 自定义 key 前缀

.build();

// 2. 挂载到 Agent

ReActAgent agent = ReActAgent.builder()

.name("planner")

.model(model)

.toolkit(toolkit)

.memory(new InMemoryMemory())

.planNotebook(planNotebook) // 自定义配置

// 或直接.enablePlan() 使用全部默认配置

.build();

// 3. Agent 获得计划工具，可自动拆解复杂任务

Msg response = agent.call(Msg.builder()

.textContent("帮我用 HTML/CSS/JS 搭建一个计算器 Web 应用")

.build()).block();

#### 9.1.3 底层实现原理

以上述案例为例，用户调用 agent.call(msg) 后，框架内部的计划执行全过程如下：

1.

Step 1 — Agent 构建：工具与 Hook 自动注册

○

ReActAgent.builder().planNotebook(planNotebook).build() 时，Builder 内部：

■

将 PlanNotebook 实例注册到 Toolkit，反射扫描其 10 个 @Tool 方法生成工具 Schema

■

将 PlanNotebook 的 Hook 加入 Agent 的 Hook 链

■

将 PlanNotebook 作为 StateModule 纳入 Agent 的持久化列表

2.

Step 2 — 第 1 轮 Reasoning：无计划 → 创建计划

○

doCall() 进入第 1 轮 reasoning()。在调用 model.stream() 之前，Agent 触发 PreReasoningEvent，PlanNotebook 的 Hook 执行 generateHint(null, planNotebook)。

○

由于 currentPlan == null，进入 No Plan 场景，生成：

<system-hint>

If the user's query is complex... you NEED to create a plan first by calling 'create\_plan'.

Important Rules:

\- Subtask Limit: Ensure the plan consists of no more than 10 subtasks

</system-hint>

○

模型收到 Hint 后判断任务复杂，调用 create\_plan 工具，PlanNotebook 内部创建 Plan 对象并初始化 SubTask 列表。

3.

Step 3 — 第 2 轮 Reasoning：计划就绪 → 开始执行

○

下一轮 PreReasoningEvent 触发时，currentPlan 已非 null 且所有 SubTask 为 TODO，进入 At the Beginning 场景。

○

Hint 引导模型调用 update\_subtask\_state(subtask\_idx=0, state='in\_progress')，启动第一个子任务。

○

由于 needUserConfirm = false，Hint 中 不包含 等待确认规则，模型直接进入执行。

4.

Step 4 — 第 3~N 轮：子任务执行循环

○

进入 Subtask In Progress 场景。Hint 展示当前子任务详情，引导模型：

■

调用业务工具（如文件操作、代码生成）完成子任务

■

完成后调用 finish\_subtask 记录 outcome

○

子任务完成后进入 No Subtask In Progress 场景，Hint 引导模型选择下一个 TODO 子任务。如此循环直到所有子任务完成。

5.

Step 5 — 最后一轮：计划收尾

○

所有 SubTask 为 DONE / ABANDONED，进入 At the End 场景。

○

Hint 引导模型调用 finish\_plan(outcome)，PlanNotebook 将 Plan 归档到 PlanStorage（默认 InMemoryPlanStorage），并将 currentPlan 设为已完成状态。

6.

Step 6 — 持久化（可选）

○

agent.saveTo(session, key) 调用时，PlanNotebook 的 saveTo() 将 currentPlan 序列化为 PlanNotebookState 存入 Session（key = "mainPlan\_state"，使用配置的 keyPrefix）。

○

下次 loadFrom() 恢复后，Hint 能继续从上次中断的场景引导模型执行。

### 9.2 Multi-Agent（多智能体编排）

#### 9.2.1 功能介绍

##### 9.2.1.1 定位

Pipeline 是 AgentScope Java 的多智能体编排抽象。io.agentscope.core.pipeline 包提供核心编排能力，包括：

●

Pipeline 接口：execute(Msg) 、execute(Msg, Class structuredOutputClass) 等

●

Pipelines 工厂：

○

Pipelines.sequential：前一个 Agent 的输出作为下一个的输入

○

Pipelines.fanout / fanoutSequential：多 Agent 同输入，并发或顺序聚合结果列表

●

MsgHub：多 Agent 共享消息空间，适用于辩论、单试等场景

与 Spring AI Alibaba 基于 StateGraph 的多 Agent 编排（SequentialAgent / ParallelAgent / RoutingAgent / LoopAgent）不同，AgentScope Java 的 Pipeline 直接用 Reactor flatMap 链式串联 agent.call，每个节点仍是一个完整的 ReActAgent（自带 memory/toolkit），编排层只负责 Msg 传递。

##### 9.2.1.2 基本原理

一、Pipeline 类型体系

io.agentscope.core.pipeline 包围绕一个泛型接口 Pipeline 构建：

public interface Pipeline<T> {

Mono<T> execute(Msg input); // 普通执行

Mono<T> execute(Msg input, Class<?> structuredOutputClass); // 结构化输出

}

框架提供两个核心实现与一个工厂类：

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>类</p></td><td rowspan="1" colspan="1"><p>Pipeline 泛型</p></td><td rowspan="1" colspan="1"><p>消息分发模式</p></td><td rowspan="1" colspan="1"><p>适用场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>SequentialPipeline</p></td><td rowspan="1" colspan="1"><p>Pipeline</p></td><td rowspan="1" colspan="1"><p>串行链式：A 的输出 → B 的输入 → C 的输入</p></td><td rowspan="1" colspan="1"><p>翻译→润色→审核 等逐步深化链路</p></td></tr><tr><td rowspan="1" colspan="1"><p>FanoutPipeline</p></td><td rowspan="1" colspan="1"><p>Pipeline<List></p></td><td rowspan="1" colspan="1"><p>扇出广播：相同输入同时/依次发给 N 个 Agent</p></td><td rowspan="1" colspan="1"><p>多视角分析、投票表决</p></td></tr><tr><td rowspan="1" colspan="1"><p>Pipipelines（工厂）</p></td><td rowspan="1" colspan="1"><p>—</p></td><td rowspan="1" colspan="1"><p>静态工具方法：sequential / fanout / fanoutSequential / compose</p></td><td rowspan="1" colspan="1"><p>一次性调用无需手动 new</p></td></tr></tbody></table>

二、SequentialPipeline — 串行链式传递

核心实现是 Reactor flatMap 链式串联：前 N-1 个 Agent 走普通调用，最后一个可选择结构化输出类型。这本质上是责任链的 Reactive 版本。

Mono<Msg> chain = Mono.justOrEmpty(input);

// First N-1 agents use normal call

for (int i = 0; i < agents.size() - 1; i++) {

AgentBase agent = agents.get(i);

chain = chain.flatMap(agent::call);

}

// Last agent uses structured output if specified

AgentBase lastAgent = agents.get(agents.size() - 1);

if (structuredOutputClass!= null) {

chain = chain.flatMap(msg -> lastAgent.call(msg, structuredOutputClass));

} else {

chain = chain.flatMap(lastAgent::call);

}

return chain;

消息流转过程：flatMap(agent::call) 的语义是「等待上游 Mono 完成，将其结果 Msg 作为参数传入下一个 agent.call()」。每个 Agent 独立持有自己的 Memory / Toolkit / Hooks，接收到的 Msg 只是一条用户角色消息（上一个 Agent 的最终回复），不会携带上游 Agent 的内部 Memory 或工具调用历史。

三、FanoutPipeline — 扇出广播

与 Sequential 的「串行传递」不同，Fanout 将同一条输入 Msg 同时分发给所有 Agent，结果收集为 List。

// 并发模式：每个 Agent 在 boundedElastic 线程上独立执行

List<Mono<Msg>> agentMonos = agents.stream()

.map(agent -> agent.call(input).subscribeOn(scheduler)

.doOnError(e -> errors.add(...))

.onErrorResume(e -> Mono.empty()))

.toList();

return Flux.merge(agentMonos).collectList(); // 合并所有结果

// 顺序模式：依次执行但输入相同（不是串联）

return Flux.concat(chain).collectList();

四、与单智能体通信的关键区别

<table><colgroup><col width="250"> <col width="250"> <col width="250"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>对比维度</p></td><td rowspan="1" colspan="1"><p>单 Agent 直接调用</p></td><td rowspan="1" colspan="1"><p>Pipeline 多 Agent 编排</p></td></tr><tr><td rowspan="1" colspan="1"><p>调用方式</p></td><td rowspan="1" colspan="1"><p>agent.call(msg) 用户直接控制</p></td><td rowspan="1" colspan="1"><p>Pipelines.sequential(agents, msg) 编排层控制路由</p></td></tr><tr><td rowspan="1" colspan="1"><p>Memory 可见性</p></td><td rowspan="1" colspan="1"><p>Agent 内部多轮 ReAct 共享同一 Memory，所有推理/工具历史全程可见</p></td><td rowspan="1" colspan="1"><p>每个 Agent 只在自己的 Memory 中看到自己的历史；Agent B 看不到 Agent A 的内部推理过程和工具调用记录，只能看到 A 最终输出的那条 Msg</p></td></tr><tr><td rowspan="1" colspan="1"><p>上下文传递方式</p></td><td rowspan="1" colspan="1"><p>通过 Memory 累积：addToMemory → prepareMessages → stream</p></td><td rowspan="1" colspan="1"><p>通过 flatMap 的 Msg 传递：上一个 Agent 的输出就是下一个的全部输入</p></td></tr><tr><td rowspan="1" colspan="1"><p>工具隔离</p></td><td rowspan="1" colspan="1"><p>单 Agent 持有一个 Toolkit，所有工具共享</p></td><td rowspan="1" colspan="1"><p>每个 Agent 持有独立 Toolkit，Agent A 的工具 Agent B 无法使用</p></td></tr><tr><td rowspan="1" colspan="1"><p>状态隔离</p></td><td rowspan="1" colspan="1"><p>单实例内状态连续</p></td><td rowspan="1" colspan="1"><p>Agent 间完全隔离：Memory、Toolkit、Hooks、PlanNotebook 各自独立</p></td></tr><tr><td rowspan="1" colspan="1"><p>中断恢复</p></td><td rowspan="1" colspan="1"><p>stopAgent() 后可 call() 无参恢复（memory 中有 pending ToolUse）</p></td><td rowspan="1" colspan="1"><p>Pipeline 不提供跨 Agent 的中断恢复——中断发生在哪个 Agent 内部，由该 Agent 自身处理</p></td></tr></tbody></table>

#### 9.2.2 使用案例举例

下面以 SequentialPipeline 为例，展示框架的 multi-agent 的编排逻辑。案例逻辑为用户输入自然语言描述，Pipeline 依次执行：(1) SQL Generator 将其转为 MySQL SQL，(2) SQL Rater 对 SQL 与用户意图的匹配度打分（0–1）。

// SQL Generator：接收 {input}，输出写入 state key "sql"

AgentScopeAgent sqlGenerateAgent = AgentScopeAgent.fromBuilder(

ReActAgent.builder()

.name("sql\_generator")

.model(dashScopeChatModel)

.sysPrompt(SQL\_GENERATOR\_PROMPT)

.memory(new InMemoryMemory()))

.name("sql\_generator")

.instruction("{input}")

.outputKey("sql")

.build();

// SQL Rater：读取 {sql} 和 {input}，输出写入 state key "score"

AgentScopeAgent sqlRatingAgent = AgentScopeAgent.fromBuilder(

ReActAgent.builder()

.name("sql\_rater")

.model(dashScopeChatModel)

.sysPrompt(SQL\_RATER\_PROMPT)

.memory(new InMemoryMemory()))

.name("sql\_rater")

.instruction("Here's the generated SQL:\\n {sql}.\\n\\n Original request:\\n {input}.")

.outputKey("score")

.build();

// 串行编排

SequentialPipeline sequentialSqlAgent = SequentialPipeline.builder()

.name("sequential\_sql\_agent")

.subAgents(List.of(sqlGenerateAgent, sqlRatingAgent))

.build();

---

## 10.总结

AgentScope Java 框架采用响应式架构，基于 Project Reactor（Mono/Flux）构建，核心特点包括：

1.

ReActAgent 为核心入口：用建造者模式组装 Model、Toolkit、Memory、Hook，通过 Reactor 管道驱动 ReAct 循环

2.

统一事件 Hook 机制：12 种 Hook 事件覆盖调用级、推理级、执行级、摘要级全生命周期

3.

单一 Msg + ContentBlock 设计：区别于 Spring AI 的多类型继承体系，用 role 字段区分发送者，ContentBlock 承载多样化内容

4.

Toolkit 工具管理门面：四子组件（Registry、SchemaGenerator、MethodInvoker、Executor）统一管理工具注册与执行

5.

PlanNotebook 结构化规划：10 个计划工具 + PlanToHint Hook 引导模型自主拆解和跟踪复杂任务

6.

Pipeline 多智能体编排：Sequential/Fanout 两种模式，用 Reactor flatMap 链式串联多个 ReActAgent

与 Spring AI Alibaba 相比，AgentScope Java 更适合高并发、响应式需求的场景，强调轻量、可扩展与流式优先。

END

0 概述

0.1 温习响应式编程

0.2 主流异步方案对比

0.3 Reactor 核心概念

0.3.1 两大核心类型

0.3.2 核心机制

0.3.2 总结

1 整体架构与设计原则

1.1 核心能力一览

1.2 核心流程

1.3 快速感受：最小 Agent 示例

2 Agent

2.1 组件介绍

2.1.1 组件定位

2.1.2 组件基本原理

2.2 使用案例举例

2.3 底层实现原理

3 Model

3.1 组件介绍

3.1.1 组件定位

3.1.2 组件基本原理

3.2 使用案例举例

3.3 底层实现原理

4 Message

4.1 组件介绍

4.1.1 组件定位

4.1.2 组件基本原理

4.2 使用案例举例

4.3 底层实现原理

5 Tool

5.1 组件介绍

5.1.1 组件定位

5.1.2 组件基本原理

5.2 使用案例举例

5.3 底层实现原理

6 Hooks

6.1 组件介绍

6.1.1 组件定位

6.1.2 组件基本原理

6.2 使用案例举例

6.3 底层实现原理

7 Memory

7.1 组件介绍

7.1.1 组件定位

7.1.2 组件基本原理

7.2 使用案例举例

7.3 底层实现原理

8 Skills

2.8.1 组件介绍

8.1.1 组件定位

8.1.2 组件基本原理

8.2 使用案例举例

8.3 底层实现原理

9 高级功能

9.1 Planning（PlanNotebook）

9.1.1 组件介绍

9.1.1.1 组件定位

9.1.1.2 组件基本原理

9.1.2 使用案例举例

9.1.3 底层实现原理

9.2 Multi-Agent（多智能体编排）

9.2.1 功能介绍

9.2.1.1 定位

9.2.1.2 基本原理

9.2.2 使用案例举例

10.总结

**

**

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
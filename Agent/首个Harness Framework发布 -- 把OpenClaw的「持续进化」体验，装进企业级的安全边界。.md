---
title: "首个Harness Framework发布 -- 把OpenClaw的「持续进化」体验，装进企业级的安全边界。"
source: "https://ata.atatech.org/articles/11020626959?spm=ata.23639746.0.0.3d222a29mpDFWf"
author:
published:
created: 2026-05-11
description:
tags:
  - "clippings"
---
来源：[https://ata.atatech.org/articles/11020653242?spm=ata.23639420.0.0.15527536RR2Sck](https://ata.atatech.org/articles/11020653242?spm=ata.23639420.0.0.15527536RR2Sck)

云智能集团

__ 18

__ 8

__

__ 原创文章

__ AI辅助优化 30%

__

## MaaS-DeepAgent：基于 AgentScope Harness 的分布式智能体框架

__ 朗读

__ 字号

__ 笔记

__ 分享 __

Powered by 通义语音合成

通义语音合成

__

> **推荐阅读**
>
> - [ADK-DeepAgent：面向分布式环境的通用智能体框架](https://ata.atatech.org/articles/11020532914?spm=ata.21736010.0.0.37027536FeKfQM) — DeepAgent 原始设计与核心原理
> - [首个 Harness Framework 发布](https://ata.atatech.org/articles/11020626959?spm=ata.21736010.0.0.37027536FeKfQM) — AgentScope Harness 设计理念与框架能力

---

## 一、背景与定位

DeepAgent 最初是我们在 ADK 框架上构建的一套面向分布式环境的通用智能体框架（详见上方推荐阅读第一篇）。其核心理念与 Gemini CLI / Claude Code 类似——基于文件系统做上下文管理——并在此基础上增加了动态规划、渐进式 Skill 加载，将整套方案搬到了云上分布式环境中。

随着 MaaS 团队与 AgentScope 团队开展深度共建，我们将 DeepAgent 的核心能力迁移到了 AgentScope Harness 之上。选择 Harness 作为新基座，核心原因有两个：

1. **生态** ：AgentScope 是集成了众多阿里云组件的 Agent 框架，DeepAgent 基于其 Harness 构建，可直接复用模型服务、可观测性等基础设施。
2. **架构适配** ：Harness 的设计哲学是「不替换推理循环，在关键时机插入 Hook」。DeepAgent 需要注入十几项能力（沙箱、存储、Skill、Prompt 引擎……），但不需要修改 ReAct 循环本身，Harness 的 Hook 管线正好满足这一需求。

**当前定位** ：DeepAgent 是 Harness 的上层扩展框架，将 APaaS 沙箱执行、分布式存储隔离、渐进式 Skill 系统等能力打包注入 Harness 标准管线，面向业务方提供开箱即用的 Agent 接入方案。

---

## 二、架构全景与框架优势

### 2.1 五层架构

![[71510df3-0e2d-4a27-be54-317e7a069cc3.png|DeepAgent · 基于 AgentScope Harness 的五层技术架构]]

DeepAgent · 基于 AgentScope Harness 的五层技术架构

从上到下：

- **L1 应用交互与编排层** ：DeepAgentBuilder 装配入口 + agent.call()/callStream() 执行接口
- **L2 智能体核心引擎层** ：Prompt 引擎、ReAct 推理循环、Hook 事件管道
- **L3 上下文管理与记忆层** ：动态压缩、Session 持久化、Skill 渐进加载、WorkspaceContext
- **L4 核心工具与后端适配层** ：文件系统 API、Shell 执行、规划工具、Memory/Skill 工具
- **L5 基础设施与存储层** ：APaaS 远程沙箱、OssStore 分布式存储、Session 后端

继承与组合关系：

ReActAgent (推理内核, Project Reactor 非阻塞)
    ↑ 组合持有 (delegate)
HarnessAgent (薄包装: bindRuntimeContext + forceCompactAndRetry)
    ↑ Builder 装配
DeepAgentBuilder (能力注入: APaaS + Store + Skill + Prompt + Hook)
    ↑ 工厂入口
DeepAgents.from(HarnessAgent.Builder)

### 2.2 DeepAgent 提供了什么

直接使用 Harness 能够获得 ReAct 循环、Workspace 注入、Session 持久化、对话压缩等基础能力。DeepAgent 在此之上额外提供：

|能力维度|直接使用 Harness|通过 DeepAgent|
|---|---|---|
|执行环境|需自行对接沙箱实现|APaaS 远程沙箱开箱即用，生命周期由 Hook 自动管理|
|存储隔离|本地文件读写 + 自定义 Filesystem 扩展|NAS 的 Session 级隔离 + OSS 的多维度隔离（USER / SESSION / AGENT / GLOBAL）|
|Prompt 工程|手写 sysPrompt 或依赖 AGENTS.md|4 段组合 + 4 级注入粒度，配置化定制|
|Skill 系统|基础 SkillBox 装配|本地 Skill + 沙箱中台 Skill 渐进式加载，版本去重上传 + 失败自动重传|
|用户输入处理|无内置方案|UserInputWrapHook 模板化包装，Agent 开箱即用|
|**总结** ：如果业务需要沙箱执行、分布式记忆隔离与共享、或平台级 Skill 管理，DeepAgent 是 Harness 之上的生产就绪方案。|||

---

## 三、核心设计决策

#### 决策一：组合式构建，不侵入推理循环

DeepAgent 需要在 ReAct 循环的多个阶段注入能力（沙箱生命周期、存储路由、Prompt 组装等），但不需要修改循环逻辑。

HarnessAgent 通过组合持有 ReActAgent 作为 delegate，DeepAgent 在 Builder 层完成能力装配。运行时能力通过 Harness 的两个扩展通道注入：

- **Hook** ：在 PreCall、PreReasoning、PostActing、PostCall 等事件节点插入逻辑
- **Toolkit** ：向模型注册 shell_execute、activate_skill 等工具

各 Hook 之间不持有彼此引用，通过三个共享对象完成协作：

|共享对象|职责|生命周期|
|---|---|---|
|RuntimeContext|当次 call() 的身份信息（sessionId / userId）|每次 call() 重新注入|
|WorkspaceManager|工作区读写|构建时创建，跨 call 复用|
|AbstractFilesystem|存储后端接口|构建时创建，跨 call 复用|
|任何一项能力均可独立开关，关闭某个 Hook 不影响其余 Hook 的运行。AgentScope 核心团队对 ReActAgent 的迭代（Reactor 调度、流式协议、新事件类型）可直接升级，DeepAgent 无需适配。|||

**Hook × Event 矩阵** ：

|事件|触发的 Hook（priority 升序执行）|
|---|---|
|PreCallEvent|Trace(0) → **StoreContext(1)** → **SandboxLifecycle(50)**|
|PreReasoningEvent|Compact(10) → WorkspaceCtx(900)|
|PostActingEvent|Trace(0) → ToolResultEviction(50)|
|PostCallEvent|Trace(0) → MemFlush(5) → MemMaint(6) → Session(900)|
|加粗项为 DeepAgent 追加的 Hook。其中 StoreContext(1) 必须在 SandboxLifecycle(50) 之前执行，确保 DynamicNamespaceFactory 拿到正确的用户上下文。||

#### 决策二：Filesystem 双形态——隔离粒度按需选择

![[2d5647dd-3dbb-4dc8-95ef-acb97c803c16.png|DeepAgent Filesystem 两形态]]

DeepAgent Filesystem 两形态

不同业务对隔离粒度的要求不同，DeepAgent 通过 Filesystem 双形态适配：

**形态一：ossStore 未配置（默认）**

- ApaasSandboxFilesystem 作为唯一后端
- 所有路径统一走远程沙箱，文件持久化在 NAS 上
- 隔离粒度为 **SESSION** ——每个会话独占一个 workspace

适用场景：大多数生产环境（session 粒度隔离即可满足需求，无需额外配 OSS）。

**形态二：ossStore 已配置**

- CompositeFilesystem 做路由器，按路径前缀分发读写
- memory 相关路径走 OssStore（持久化、可跨会话访问）
- 其余路径走 ApaasSandboxFilesystem（代码执行、临时文件）
- 隔离粒度默认 **USER** （同一用户的多次会话共享记忆），可覆盖为 SESSION / AGENT / GLOBAL

适用场景：需要跨会话积累记忆（如用户级记忆）、或需要 AGENT / GLOBAL 级共享的高级场景。

通过一个 Builder 参数决定形态，上层工具无需感知存储后端差异。

---

## 四、核心能力详解

### 4.1 APaaS 沙箱执行

DeepAgent 的文件操作和 Shell 命令执行全部发生在 APaaS 远程沙箱中，宿主进程只做协调。沙箱的使用是 **瞬时** 的——按需申请、用完释放，持久化交给 NAS 或 OSS，宿主进程不持有执行状态。

**生命周期管理** ：ApaasSandboxLifecycleHook 在每次 agent.call() 的 PreCallEvent 时触发，负责确保 workspace 就绪：

- **幂等创建** ：synchronized + workspaceId 判空，多线程并发 call() 不会重复创建
- **Session 恢复优先** ：首先从 Session 中读取上次保存的 workspaceId，读不到时才创建新 workspace。进程重启或 Pod 漂移后，工作现场可原位恢复
- **Skill 上传** ：首次创建 workspace 时上传 Skill 文件，后续 call() 跳过

**Shell 执行** ：DeepAgentShellExecuteTool 在标准 Shell 工具基础上注入业务环境描述（bizType），供模型了解当前沙箱的预装环境。环境描述的查询结果缓存 10 秒，避免每次工具调用都重复探测。

**沙箱后端** ：当前支持弹内 Aone 沙箱和售卖区 FC（函数计算）两种后端，通过 bizType 区分，同一套 HTTP API 对接。

**分布式部署能力** ：沙箱中的 session 文件持久化在 NAS 上，而非沙箱实例本地。这意味着 Agent 服务可以多副本部署——请求落到任何一个 Pod，都能通过 NAS 拿到同一份 workspace 状态，沙箱实例本身是无状态的、瞬时使用的。

### 4.2 分布式存储与隔离

**OssStore** ：实现 BaseStore 的四个方法（get / put / search / delete），底层对接用户提供的 OSSClient。

**CompositeFilesystem 路由** ：配置 OssStore 后，Builder 自动构建 CompositeFilesystem，按路径前缀将读写分发到不同后端：

|路径模式|路由目标|隔离语义|
|---|---|---|
|`MEMORY.md`|OssStore|长期记忆，跨会话持久|
|`memory/*`|OssStore（memory 命名空间）|日记忆|
|`agents/{name}/sessions/*`|OssStore（session 命名空间）|会话级状态|
|`agents/{name}/tasks/*`|OssStore（task 命名空间）|异步任务结果|
|其余路径|ApaasSandboxFilesystem|代码、临时文件、Shell 执行|
|记忆类数据需要跨会话持久化，代码文件只需在沙箱内存活。同一个 `write_file` 调用，根据路径自动路由到正确的存储后端。|||

**四级命名空间隔离** ：通过 DynamicNamespaceFactory + IsolationScope 实现：

- **USER** （默认）： `agents/{agentName}/users/{userId}/...` — 同一用户跨会话共享
- **SESSION** ： `agents/{agentName}/sessions/{sessionId}/...` — 会话间隔离
- **AGENT** ： `agents/{agentName}/shared/...` — 同一 Agent 的所有用户共享
- **GLOBAL** ： `global/...` — 全局共享

### 4.3 Prompt 引擎

DeepAgent 预设了一套完整的 **CLI 风格软件工程专家** 人设，内置代码规范遵循、项目约定发现、工作流编排（理解→规划→实现→验证→完成）等能力引导。 **大多数场景下无需修改系统 Prompt** 。

需要定制时，按以下方式逐级覆盖（优先级从低到高）：

|定制方式|适用场景|说明|
|---|---|---|
|workspace 文件（ `AGENTS.md` 、 `KNOWLEDGE.md` ）|项目背景、Agent 人格补充、静态知识|由 Harness 的 WorkspaceContextHook **每轮自动注入** ，随项目代码管理|
|`additionalContext(String)`|运行时动态注入上下文（如当前用户身份）|追加到 system prompt 末尾，不替换预设人设|
|`promptConfig(DeepAgentPromptConfig)`|微调预设 Prompt 段落开关|控制是否保留 FinalRemind、启用 AskHuman、替换 PrimaryWorkflow|
|`customSysPrompt(String)`|完全自定义系统 Prompt|整段替换预设人设，仅在需要完全不同风格时使用|

> `customSysPrompt` 和 `promptConfig` 同时设置时，前者生效，后者被忽略。

**内部结构** ：预设 Prompt 由 4 段按固定顺序拼接——Identity（身份定义）→ PrimaryWorkflow（主工作流）→ OperationalGuidelines（操作规范）→ FinalRemind（结尾提醒）。 `promptConfig` 的开关即作用于这些段落。

**最佳实践** ：将项目背景、团队规范等静态信息写入 workspace 的 `AGENTS.md` ；运行时需要动态追加的信息（如请求上下文）使用 `additionalContext()` ；只有需要彻底改变 Agent 行为风格时才使用 `customSysPrompt()` 。

### 4.4 Skill 系统

Skill 是把可复用的操作流程结构化为 Markdown 文件，Agent 在运行时按需加载。

**渐进式加载** ：DeepAgentSkillTool 通过 `activate_skill(name)` 接口，在 LLM 判断需要时才读取 SKILL.md 的完整内容。未激活的 Skill 只有名称和描述出现在工具列表中，不占用上下文窗口。

**版本去重上传** ：ApaasSandboxLifecycleHook 在上传 Skill 到沙箱时，会对比本地版本与沙箱中已有版本。只有变更的 Skill 才会重新上传，大幅减少 workspace 初始化耗时。

**失败自动重传** ：如果 Skill 加载失败（沙箱侧文件不存在），工具会自动触发一次重新上传再重试，而不是直接报错给用户。

**多来源支持** ：

- `LocalApaasSkill.fromDirectory(path)` — 从本地目录加载
- `LocalApaasSkill.fromClasspath(path)` — 从 classpath 加载
- `ApaasRegisteredSkill` — 从 APaaS 平台注册中心引用（类似 Maven GAV 坐标）

---

## 五、接入指南

> **完整对接文档** ： [MaaS-AgentScope DeepAgent](https://maas-infra.io.alibaba-inc.com/#/docs/frameworks/maas-agentscope-java/deep-agent)

### 5.1 什么场景选 DeepAgent

DeepAgent 面向 **长周期、分布式部署的复杂任务** ：通过文件系统作为上下文载体维持跨轮状态，借助瞬时无状态的远程沙箱实现 Agent 服务多副本水平扩展。

**匹配以下任一信号，建议选 DeepAgent：**

- 长周期任务：单次对话无法完成，需要多轮迭代（写代码 → 跑测试 → 修 bug → 再跑）
- 分布式沙箱：Agent 服务需要多副本水平扩展，沙箱跨进程瞬时调度、workspace 跨节点恢复
- 分布式 Memory：跨用户、跨 Agent 共享记忆，按 USER/SESSION/AGENT/GLOBAL 四级命名空间隔离
- 安全隔离：不可信代码在远程沙箱中执行

### 5.2 前置条件

- **APaaS 沙箱资源** ：申请 APaaS 平台 `bizType` 与 `ak` ，申请时需明确部署区域——弹内走 Aone 沙箱后端，售卖区走阿里云 FC 后端。
- **（可选）OSS 存储** ：仅在需要跨会话/跨用户共享记忆时准备独立 Bucket；不配置时，session 与记忆默认随沙箱 workspace 持久化在 NAS 上。

### 5.3 引入依赖


    com.aliyun.maas
    maas-agentscope-extension-deep-agent
    ${maas-agentscope-version}

    io.agentscope
    agentscope-harness
    ${agentscope-version}

### 5.4 完整构建模板

```java
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 完整配置模板（所有可选项均已标注默认值）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HarnessAgent agent = DeepAgents.from(
    HarnessAgent.builder()
        // ── harness 通用配置 ──
        .name("agent-name")                          // 必填
        .model(model)                                // 必填
        .sysPrompt(null)                             // DeepAgent 自动设置，一般无需手动指定
        .session(new JsonSession(workspace.resolve("sessions")))  // 生产推荐RedisSession等，跨进程状态恢复
        .compaction(CompactionConfig.builder()       // 推荐，长对话防溢出
                .triggerTokens(60000)
                .triggerMessages(40)
                .keepMessages(10)
                .build())
        .toolResultEviction(ToolResultEvictionConfig.defaults())  // 推荐
        // .subagent(subagentSpec)                   // 可选
        // .toolkit(customToolkit)                   // 可选
        // .hook(customHook)                         // 可选
```
    )
```java
    // ── DeepAgent 专属配置 ──
    .workspace(workspace)                            // 推荐，从 classpath resources/workspace 加载
    .apaas(ApaasSandboxConfig.pre(bizType, ak))      // APaaS 沙箱模式必填
    .planning(false)                                 // 默认 false
    .agentName("agent-name")                         // 默认 "HarnessAgent"
    .dynamicStore(() -> new OssStore(ossConfig))      // 可选，OSS 持久化
    .isolationScope(IsolationScope.USER)              // 默认 USER
    // .enableMemoryTools()                          // 默认禁用
    // .enableMemoryHooks()                          // 默认禁用
    // .promptConfig(DeepAgentPromptConfig.defaults()) // 默认使用
    // .customSysPrompt("...")                       // 与 promptConfig 互斥，优先级更高
    // .additionalContext("...")                     // 追加上下文
    // .userInputWrapper("请分析：%s")                // 输入包装
    // .skill(LocalApaasSkill.fromDirectory(...))    // Skill 添加
    // .waitForSkillUpload(false)                    // 默认 false
    // .shellToolCustomizer(biz -> "env desc")       // Shell 环境描述
    // .bizType("my_biz")                            // 业务类型
    .build();                                        // 返回 HarnessAgent
```

### 5.5 答疑与交流

接入过程中遇到问题，欢迎加入钉钉群沟通：

![[c7ed0a29-7e01-4109-bf17-e4d4f670b3a4.jpg|Mass-AgentScope 交流群]]

Mass-AgentScope 交流群

---

## 六、招聘彩蛋

[https://www.aliway.com/detail?spm=a1z2e.2209aced.content.3.6d224f9bmTgcvQ&id=c0924490777d492dbf899def5cd50b38](https://www.aliway.com/detail?spm=a1z2e.2209aced.content.3.6d224f9bmTgcvQ&id=c0924490777d492dbf899def5cd50b38)

我们在寻找一群人，一起定义 AI 的下一个主场。

10+ 个岗位，海量 HC，欢迎聊聊！

![[ed42dd35-ba48-4170-ad8a-e56a442b2b67.jpg|一起定义 AI 的下一个主场]]

一起定义 AI 的下一个主场

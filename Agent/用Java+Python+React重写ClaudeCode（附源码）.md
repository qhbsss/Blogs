---
title: "用Java+Python+React重写ClaudeCode（附源码）"
source: "https://ata.atatech.org/articles/11020628802?spm=ata.23639420.0.0.15527536qBCOKC"
author:
published:
created: 2026-04-23
description:
tags:
  - "clippings"
---
ATH事业群-千问事业部

粉丝 238影响力 2.2k

** 83

** 31

** 17

** 原创文章

AI 辅助创作开放访问

**

复制专用链接

**

[郭庆涛(志鲲)](https://ata.atatech.org/users/11000147537)

昨天09:14发表昨天18:30更新947次浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章25:47

**

> Talk is cheap, show the code.： [https://github.com/zhikunqingtao/zhikuncode/](https://github.com/zhikunqingtao/zhikuncode/) ，欢迎fork、感恩star❤️

用claude 4.7 opus分析这个自称超越ClaudeCode的AI 编程工具，在线报告地址：

[https://copilot.code.alibaba-inc.com/chat?traceId=45945aef487c431eaa19521d482447ec](https://copilot.code.alibaba-inc.com/chat?traceId=45945aef487c431eaa19521d482447ec)

真实效果：

---

## 介绍

由于众所周知的原因，网上出现了Claude Code 的51万行 TypeScript 源码，我参考其设计思想，用 Java + React + Python 三层架构重建了核心能力——Agent Loop、8层 Bash 安全检查、14步权限决策链、多Agent Swarm 协作、MCP 工具生态，均为独立的 Java 实现，而非 API 封装。

面向国内场景的适配包括：原生支持千问 Dashscope 直连、Web 优先的现代化界面、Java 企业级技术栈、国内直接可部署，以及预集成国内的 MCP 服务。

几个关键数字：

<table><colgroup><col width="375"> <col width="375"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>维度</p></td><td rowspan="1" colspan="1"><p>数据</p></td></tr><tr><td rowspan="1" colspan="1"><p>代码总量</p></td><td rowspan="1" colspan="1"><div>~77K 行（ <code>wc -l</code> 实际统计）</div></td></tr><tr><td rowspan="1" colspan="1"><p>后端规模</p></td><td rowspan="1" colspan="1"><p>416 个 Java 源文件，~62K 行代码，52 个包</p></td></tr><tr><td rowspan="1" colspan="1"><p>前端规模</p></td><td rowspan="1" colspan="1"><p>107 个 TypeScript/TSX 文件，~12K 行代码</p></td></tr><tr><td rowspan="1" colspan="1"><p>Python 服务</p></td><td rowspan="1" colspan="1"><p>14 个 Python 文件，~2K 行代码，29 个 API 端点</p></td></tr><tr><td rowspan="1" colspan="1"><p>工具系统</p></td><td rowspan="1" colspan="1"><p>47 个工具，15 个分类</p></td></tr><tr><td rowspan="1" colspan="1"><p>Agent 循环</p></td><td rowspan="1" colspan="1"><p>8 步查询循环，支持流式工具执行</p></td></tr><tr><td rowspan="1" colspan="1"><p>安全体系</p></td><td rowspan="1" colspan="1"><p>8 层 Bash 安全检查，289 个安全单元测试</p></td></tr><tr><td rowspan="1" colspan="1"><p>权限体系</p></td><td rowspan="1" colspan="1"><p>14步决策链（Step 1a~1k, 2a/2b, 3），4种权限模式（BYPASS/ALLOW/DEFAULT/PLAN）</p></td></tr><tr><td rowspan="1" colspan="1"><p>测试覆盖</p></td><td rowspan="1" colspan="1"><p>110/110 手动测试 100% 通过，347 个自动化测试全部通过</p></td></tr></tbody></table>

---

## 架构选择：三层分离 vs TypeScript 单体

Claude Code 是一个 TypeScript 单体——前端终端 UI（自研 Ink fork, 19,842 行）、Agent 核心、工具系统、MCP 客户端，全塞在一个 Node.js 进程里，靠 React Reconciler 渲染 ANSI 终端界面。高度集成，但耦合度也不低。

我做了一个不同的决定：三层解耦。

┌── React 前端 (Vite + TypeScript) ──────────────────────┐

│ 20 Zustand Store → 18 组件目录 → STOMP WebSocket │

└──────────────────┬─────────────────────────────────────┘

│ WebSocket (STOMP over SockJS)

┌───────────▼───────────────────────────┐

│ Java 后端 Spring Boot 3.4.13 / JDK 21 │

│ QueryEngine(8步) | 47工具 | 14步权限 │

└────────┬────────────────┬──────────────┘

│ │

┌───────────▼──┐ ┌────────▼──────────┐

│ LLM API │ │ Python FastAPI │

│ (千问/OpenAI) │ │ 5能力域/29端点 │

└──────────────┘ └───────────────────┘

这个架构选择背后有几个考量：

前后端分离使得 Web 优先的界面成为可能——浏览器里直接用，支持 4 种主题（包括液态玻璃毛玻璃效果）、Diff 可视化、权限弹框。Claude Code 的基因是终端产品，后来扩展了 VS Code 和 Web 界面，但核心交互仍围绕终端。ZhikunCode 从一开始就面向 Web，在浏览器可访问性上定位不同。

我的 Python 微服务单独跑了 5 个能力域：代码智能分析（tree-sitter 解析）、文件处理、Git 增强、浏览器自动化、Token 估算。这些在 Claude Code 里要么塞在 Node.js 进程里，要么靠外部命令行工具。独立出来可以单独扩缩容，而且 Python 在 NLP/ML 方向的库更成熟。

Java 后端用的是 Spring Boot 3.4.13 + JDK 21 虚拟线程。虚拟线程在 Agent 场景下比较契合——每个 Swarm Worker 跑在独立虚拟线程上，资源开销远低于操作系统线程，多 Agent 并发时扩展性明显更好。

不过三层架构也有代价。多了一层网络通信，WebSocket STOMP 虽然能双向实时通信，但跟 Claude Code 进程内函数调用比，多了网络延迟。在高频工具调用场景（比如连续读一堆文件），这个延迟会累积。

### QueryEngine：8步循环的设计

Claude Code 的 Agent 核心是两层循环：外层 `QueryEngine.ts` （1,295 行）管会话，内层 `query.ts` （1,729 行）是个隐式状态机——7 种恢复路径、10 种终止条件，通过 AsyncGenerator 连接，支持背压控制和取消传播。

我的 `QueryEngine.java` （986 行）把两层合成了一个类，设计为 8 步循环：

Step 1: ContextCascade.executePreApiCascade() → 6层级联压缩（L0~L4 共 5 个主级别 + L1.5 中间层）

Step 2: StreamingToolExecutor.newSession() → 流式会话创建

Step 3: LlmProvider.streamChat() → API 调用 + 模型降级

Step 4: StreamCollector → 流式事件处理

Step 5: 工具执行（并发分区策略）

Step 6: 继续/终止判定

Step 7: ToolResultSummarizer.processToolResults() → 三级摘要

Step 8: 状态更新 + Token 累加

从实际代码来看，几个关键机制的实现值得展开说：

中断机制用 `AbortContext` + `CompletableFuture` 做异步中断，WebSocket 断连时自动 abort 正在执行的循环（ `QueryEngine.java:120-128` ）。模型降级链也做了—— `ModelTierService.resolveModel()` 支持运行时切换，主模型冷却期间自动跳到备选模型，还会检查新模型是否支持 thinking 并调整消息格式。错误恢复方面， `ApiRetryService` 实现了指数退避重试（500ms→30s，带随机抖动），最多 10 次，529 状态码（资源耗尽）单独限制 3 次。

客观地说，Claude Code 用 AsyncGenerator 做消息流的背压控制和取消传播更优雅。Java 这边没有直接对应的语言原语（虽然有 Reactive Streams），我用 `AtomicBoolean aborted` + `CompletableFuture` 组合实现了等价的中断语义，功能上没问题，但在流式组合的优雅性上不如 AsyncGenerator 的嵌套 yield。这不算缺陷，更多是语言层面的差异。

### 工具系统：47 个工具（15分类）

`Tool.java` （213 行）定义了工具接口，跟 Claude Code 的 `Tool.ts` （792 行）对照，我保留了核心方法并做了合理裁剪——渲染相关的逻辑移交给前端 React 组件。接口包含 6 个功能组：基础标识、执行与权限、延迟加载、并发安全、安全标记、API 格式。

// Tool.java — fail-closed 安全默认值

default boolean isConcurrencySafe(ToolInput input) {

return isReadOnly(input); // 只有只读操作默认允许并发

}

default boolean isReadOnly(ToolInput input) { return false; } // 默认非只读

这跟 Claude Code 的安全默认值设计一致：假设最坏情况，除非工具自己声明“我是安全的”。

`ToolRegistry.java` （254 行）管理 47 个工具。 `StreamingToolExecutor.java` （279 行）实现了跟 Claude Code 等价的并发分区执行——连续的 `isConcurrencySafe=true` 工具组成并行分区，碰到非安全的就开新分区，分区间串行、分区内并行。

覆盖度对比：

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>类别</p></td><td rowspan="1" colspan="1"><p>ZhikunCode</p></td><td rowspan="1" colspan="1"><p>Claude Code</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="1"><p>文件操作</p></td><td rowspan="1" colspan="1"><p>Read/Write/Edit/Glob/Grep</p></td><td rowspan="1" colspan="1"><p>FileRead/FileWrite/FileEdit/Glob/Grep</p></td><td rowspan="1" colspan="1"><p>完整对等</p></td></tr><tr><td rowspan="1" colspan="1"><p>命令执行</p></td><td rowspan="1" colspan="1"><p>BashTool（8层安全）</p></td><td rowspan="1" colspan="1"><p>BashTool（8层安全）</p></td><td rowspan="1" colspan="1"><p>完整对等</p></td></tr><tr><td rowspan="1" colspan="1"><p>代码智能</p></td><td rowspan="1" colspan="1"><p>LSP + tree-sitter (Python)</p></td><td rowspan="1" colspan="1"><p>内建 + LSP</p></td><td rowspan="1" colspan="1"><p>完整对等</p></td></tr><tr><td rowspan="1" colspan="1"><p>Agent</p></td><td rowspan="1" colspan="1"><p>AgentTool/SubAgentExecutor</p></td><td rowspan="1" colspan="1"><p>AgentTool/runAgent</p></td><td rowspan="1" colspan="1"><p>完整对等</p></td></tr><tr><td rowspan="1" colspan="1"><p>MCP</p></td><td rowspan="1" colspan="1"><p>10 工具 (2 服务器)</p></td><td rowspan="1" colspan="1"><p>动态注册</p></td><td rowspan="1" colspan="1"><p>协议兼容</p></td></tr><tr><td rowspan="1" colspan="1"><p>浏览器</p></td><td rowspan="1" colspan="1"><p>WebBrowserTool (13种action)</p></td><td rowspan="1" colspan="1"><p>无内建</p></td><td rowspan="1" colspan="1"><p>ZhikunCode 独有</p></td></tr><tr><td rowspan="1" colspan="1"><p>Git</p></td><td rowspan="1" colspan="1"><p>GitTool + Python增强</p></td><td rowspan="1" colspan="1"><p>依赖 BashTool</p></td><td rowspan="1" colspan="1"><p>ZhikunCode 更丰富</p></td></tr><tr><td rowspan="1" colspan="1"><p>计划</p></td><td rowspan="1" colspan="1"><p>PlanTool/VerifyPlanExecution</p></td><td rowspan="1" colspan="1"><p>PlanTool</p></td><td rowspan="1" colspan="1"><p>完整对等</p></td></tr></tbody></table>

值得注意的是，在某些方面 ZhikunCode 比 Claude Code 工具更丰富——内建的 `WebBrowserTool` 支持 13 种浏览器操作（navigate/click/type/screenshot 等），另有 Python 服务提供代码智能和 Git 增强。但 Claude Code 工具总数更多（53 内建），生态丰富度上有差距。

---

## 拆开看看核心模块

### BashTool 的 8 层安全体系

这是整个项目中工程投入最大的模块。 `BashCommandClassifier.java` （1,113 行）+ `BashSecurityAnalyzer.java` （762 行）+ `BashParserCore.java` （1,117 行）+ `BashLexer.java` （825 行）+ `PathValidator.java` + `SedValidator.java` + `BashTool.java` （518 行）合在一起构成了一个很扎实的纵深防御体系：

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>层级</p></td><td rowspan="1" colspan="1"><p>实现类</p></td><td rowspan="1" colspan="1"><p>职责</p></td><td rowspan="1" colspan="1"><p>关键数据</p></td></tr><tr><td rowspan="1" colspan="1"><p>L1</p></td><td rowspan="1" colspan="1"><p>BashCommandClassifier</p></td><td rowspan="1" colspan="1"><p>三层只读验证</p></td><td rowspan="1" colspan="1"><p>~60 纯只读命令 + 9 正则 + 20+ flag 白名单</p></td></tr><tr><td rowspan="1" colspan="1"><p>L2</p></td><td rowspan="1" colspan="1"><p>BashParserCore + BashLexer</p></td><td rowspan="1" colspan="1"><p>完整 Bash AST 解析</p></td><td rowspan="1" colspan="1"><p>20 种节点类型，1,942 行解析器代码</p></td></tr><tr><td rowspan="1" colspan="1"><p>L3</p></td><td rowspan="1" colspan="1"><p>PathValidator</p></td><td rowspan="1" colspan="1"><p>路径安全边界</p></td><td rowspan="1" colspan="1"><p>32 种命令路径提取 + 17 系统路径保护 + 6 隐藏目录</p></td></tr><tr><td rowspan="1" colspan="1"><p>L4</p></td><td rowspan="1" colspan="1"><p>BashSecurityAnalyzer</p></td><td rowspan="1" colspan="1"><p>命令注入检测</p></td><td rowspan="1" colspan="1"><p>24 eval-like + 10 Zsh 危险 + 14 种 Unicode 空白</p></td></tr><tr><td rowspan="1" colspan="1"><p>L5</p></td><td rowspan="1" colspan="1"><p>BashTool</p></td><td rowspan="1" colspan="1"><p>危险 Flag 拦截</p></td><td rowspan="1" colspan="1"><p>sudo/su/doas 绝对拦截，rm -rf + 11 关键路径</p></td></tr><tr><td rowspan="1" colspan="1"><p>L6</p></td><td rowspan="1" colspan="1"><p>SedValidator</p></td><td rowspan="1" colspan="1"><p>Sed 命令安全</p></td><td rowspan="1" colspan="1"><p>POSIX 分隔符 + 危险操作 w/W/e/E</p></td></tr><tr><td rowspan="1" colspan="1"><p>L7</p></td><td rowspan="1" colspan="1"><p>bash-permissions.yml</p></td><td rowspan="1" colspan="1"><p>4 级规则</p></td><td rowspan="1" colspan="1"><p>blocked > deny > prompt > allow</p></td></tr><tr><td rowspan="1" colspan="1"><p>L8</p></td><td rowspan="1" colspan="1"><p>BashTool.checkPermissions</p></td><td rowspan="1" colspan="1"><p>最终决策</p></td><td rowspan="1" colspan="1"><p>fail-closed：解析失败 → 降级正则 → 默认拒绝</p></td></tr></tbody></table>

289 个安全单元测试覆盖了命令分类（77 个）、AST 解析（50 个）、注入检测（63 个）、敏感路径（22 个）、权限增强（68 个）、集成（9 个）等 6 个测试类中。

特别值得展开的是 L2 层的 Bash AST 解析器。这不是用正则糊弄的，而是一个支持 20 种节点类型的语法树解析器—— `BashParserCore.java` 1,117 行加上 `BashLexer.java` 825 行，能正确处理管道 `|` 、重定向 `>` / `>>` 、子 shell `$()` 、逻辑运算 `&&` / `||` 、变量展开 `${}` 这些语法结构。Claude Code 用的是 tree-sitter 外部 Bash 解析器，我选择了纯 Java 实现，好处是不依赖 WASM/native 库，代价是手写解析器的工作量不小。

### 权限管线 PermissionPipeline

`PermissionPipeline.java` （715 行）实现了多步骤的权限评估：

Step 1a: deny 规则检查

Step 1b-1f: ask/工具特定/内容匹配/Bash 特殊处理

Step 1g: 敏感路径强制 ASK（即使 BYPASS 模式）

Step 2a: 模式检查（BYPASS → 直接放行）

Step 2b: allow 规则检查

Step 3: 默认决策

几个设计决策参考了 Claude Code：

用户显式设置的 ask 规则优先于 bypass 模式（Step 1f）——逻辑是"bypass 是信任 AI 的一般判断，ask 是用户说'这个我要亲自看'"。敏感路径（`.git/` 、`.claude/` 、`.env` 、`.ssh` ）免疫 bypass（Step 1g），怎么设置都拦。还有拒绝追踪与熔断——连续拒绝 3 次或累计 20 次就触发熔断，防止 AI 陷入死循环反复尝试被拒绝的操作。

`AutoModeClassifier.java` （597 行）做了两阶段 LLM 分类器（Quick 64 tokens → Thinking 4096 tokens），带 LRU 缓存 100 条结果，连续 3 次失败自动降级到 ASK。还有个 `FeatureFlag killswitch` ，能紧急关闭 AUTO 模式——这是对 Claude Code 远程熔断（bypassPermissionsKillswitch.ts）的本地化实现。

### System Prompt 构建

`SystemPromptBuilder.java` （1,227 行）是提示词的核心组装器，对照 Claude Code 的 `prompts.ts` （914 行），我实现了等价的分段缓存架构：

静态段有 8 段，固定顺序：INTRO\_SECTION → SYSTEM\_SECTION → DOING\_TASKS\_SECTION → ACTIONS\_SECTION → USING\_TOOLS\_SECTION → TONE\_STYLE\_SECTION → OUTPUT\_EFFICIENCY\_SECTION → FUNCTION\_RESULT\_CLEARING\_SECTION。

外部模板 5 段： `tool_examples.txt` （199 行）、 `boundary_conditions.txt` （131 行）、 `code_style_guide.txt` （161 行）、 `security_practices.txt` （150 行）、 `error_recovery.txt` （154 行）。

动态段 12 段：session\_guidance、memory、env\_info、language、output\_style、mcp\_instructions、scratchpad、frc、summarize\_tool\_results、token\_budget、ant\_specific\_guidance、project\_context。

`SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 标记把 prompt 分成静态缓存域和动态域，跟 Claude Code 的设计一致。 `SystemPromptSectionCache.java` 用了双层 Caffeine 缓存——全局缓存（maxSize=50, TTL=30min）和会话级缓存（按 sessionId 隔离），通过 `contentHash` 判断段是否变了。

项目上下文注入（ `ProjectContextService.java` ）会收集 Git root、分支名、文件树（最多 500 条）、最近 20 条 commit、项目类型检测，通过三级缓存（内存 → SQLite → 全量收集）注入到系统提示里。

### 上下文压缩策略

`ContextCascade.java` （344 行）实现了 6 层级联压缩（L0~L4 共 5 个主级别 + L1.5 中间层），跟 Claude Code 的“从轻到重”思路一样：

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>层级</p></td><td rowspan="1" colspan="1"><p>策略</p></td><td rowspan="1" colspan="1"><p>复杂度</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="1"><p>L0</p></td><td rowspan="1" colspan="1"><p>Snip</p></td><td rowspan="1" colspan="1"><p>O(1)</p></td><td rowspan="1" colspan="1"><p>无条件轻量截断，极低开销</p></td></tr><tr><td rowspan="1" colspan="1"><p>L1</p></td><td rowspan="1" colspan="1"><p>MicroCompact (FRC)</p></td><td rowspan="1" colspan="1"><p>O(n)</p></td><td rowspan="1" colspan="1"><p>8 种白名单工具结果清理，保护尾部 10 条</p></td></tr><tr><td rowspan="1" colspan="1"><p>L1.5</p></td><td rowspan="1" colspan="1"><p>ContextCollapse</p></td><td rowspan="1" colspan="1"><p>O(n)</p></td><td rowspan="1" colspan="1"><p>三级渐进折叠：Full → Summary → Skeleton</p></td></tr><tr><td rowspan="1" colspan="1"><p>L2</p></td><td rowspan="1" colspan="1"><p>AutoCompact</p></td><td rowspan="1" colspan="1"><p>API 调用</p></td><td rowspan="1" colspan="1"><p>全量摘要（保留 9 类信息），电路断路器保护</p></td></tr><tr><td rowspan="1" colspan="1"><p>L3</p></td><td rowspan="1" colspan="1"><p>CollapseDrain</p></td><td rowspan="1" colspan="1"><p>API 调用</p></td><td rowspan="1" colspan="1"><p>413 错误恢复</p></td></tr><tr><td rowspan="1" colspan="1"><p>L4</p></td><td rowspan="1" colspan="1"><p>ReactiveCompact</p></td><td rowspan="1" colspan="1"><p>API 调用</p></td><td rowspan="1" colspan="1"><p>紧急响应式压缩</p></td></tr></tbody></table>

`CompactService.java` （996 行）是压缩主体，包含 AutoCompact 断路器机制（连续失败就停止重试）和 `ContextCollapse` 的互斥设计（启用折叠就跳过 AutoCompact）。 `ToolResultSummarizer` 做三级摘要：小结果直接注入，中等的截断，大的用摘要——确保工具结果不会撑爆上下文窗口。

### MCP 集成

先说清楚背景：Claude Code 的 MCP 生态更成熟，支持 stdio/SSE/StreamableHTTP/WebSocket 四种传输加 OAuth 认证加 MCP Elicitation 动态发现。我的 MCP 也实现了 4 种传输类型（SSE/STDIO/WebSocket/HTTP Streaming），差异化是预集成了国内的 MCP 服务（智谱 WebSearch、万相 Media），国内开发者可以开箱即用。

`McpClientManager.java` （587 行）管理 MCP 客户端的完整生命周期：

●

SmartLifecycle Phase=2，Spring 容器启动时自动初始化，优先级在 Python 服务之后

●

双层健康检查：被动（@Scheduled 30s, `isAlive()` 检测）+ 主动（ `SseHealthChecker.performActiveHealthCheck()` 发 `notifications/ping` ）

●

异步延迟重连： `ScheduledExecutorService` 替代阻塞 `Thread.sleep` ，指数退避 1s→2s→4s→8s→16s（上限 30s）

●

幂等保护： `reconnectingServers` ConcurrentHashMap + `putIfAbsent` 原子操作，防重复重连

●

自定义线程池： `RECONNECT_POOL` （2 daemon 线程），不占公共 ForkJoinPool

`McpToolAdapter.java` 把 MCP 工具适配成内部 `Tool` 接口，支持描述覆盖（注册表 `enhancedDescription` 优先于 MCP 原始描述）、超时覆盖、结果截断保护（ `MAX_MCP_RESULT_SIZE = 1MB` ）和 Caffeine 结果缓存。

当前接了 2 个 MCP 服务器（智谱 WebSearch 4 工具 + 万相 2.5 Media 6 工具），通过 SSE 协议连 DashScope 端点。

### 多 Agent 协作

先说背景：Claude Code 已经有完整的 Subagent/Team/Swarm/Coordinator 体系，Q1 2026 还加了 Remote Control、Dispatch、Channels 等高级功能。我的多 Agent 实现参考了 Claude Code 的协作体系，不算独有增强。

`coordinator/` 包（17 个 Java 文件）的实现覆盖了主要协作场景：

●

SwarmService 做核心调度，管 Swarm 创建/查询/停止

●

CoordinatorWorkflowEngine 编排四阶段工作流（Research → Synthesis → Implementation → Verification）

●

SwarmWorkerRunner 基于 JDK 21 虚拟线程跑 Worker，复用 QueryEngine

●

TeamMailbox.java（3.5KB）做线程安全的点对点 + 广播通信（ConcurrentLinkedQueue）

●

LeaderPermissionBridge.java（5.8KB）让 Worker 的权限请求向 Leader 冒泡，60s 超时自动 DENY

●

SharedTaskList 是 FIFO 任务队列，支持 addTask/claimTask/completeTask 三步流转

●

ResultAggregator 汇总结果，带截断保护（单结果 50K 字符，总摘要 200K 字符）

●

SwarmState 有 5 种阶段状态（INITIALIZING → RUNNING → IDLE → SHUTTING\_DOWN → TERMINATED），用 CAS 保线程安全

`SubAgentExecutor.java` （948 行）是子 Agent 的执行引擎，包含工具过滤三层逻辑、权限模式覆盖和防递归设计。

---

## 技术特色

### 模型别名重构

这个设计是把 Claude 特有的 `haiku/sonnet/opus` 别名换成了通用的 `light/standard/premium` 层级，同时保留旧别名兼容。这样模型切换逻辑就不绑定特定供应商，接千问、GPT 什么的都方便。看起来是个小改动，但对多模型支持是个必要的基础。

### MCP 韧性增强

两个点值得说： `McpClientManager` 用 `ScheduledExecutorService` 做异步延迟重连替代阻塞 `Thread.sleep` ——听着像常识，但有些项目会在健康检查线程上直接 sleep，那就把线程堵死了。另一个是 `McpToolAdapter` 加了 Caffeine 结果缓存和降级策略，MCP 服务挂了返回缓存结果而不是直接报错。

### AUTO 模式的紧急开关

我给 AUTO 权限模式加了 FeatureFlag killswitch，不重启服务就能把所有 AUTO 降级到 ASK。Claude Code 有类似的远程熔断（bypassPermissionsKillswitch），这是等价的本地化实现。生产环境中这类紧急开关是必要的。

### 千问模型适配

`OpenAiCompatibleProvider.java` （595 行）实现了 DashScope OpenAI 兼容模式适配，支持千问模型（如 qwen3.6-plus）作为默认 LLM。对国内开发者而言，这意味着不用处理海外 API 的访问问题就能直接使用。

### 敏感数据运行时脱敏

`SensitiveDataFilter.java` 自动检测并脱敏 10 种敏感信息模式（ `***REDACTED***` ）：OpenAI/Anthropic/GitHub/GitLab API Key、AWS Access Key、Slack Token、JWT、PEM 私钥、数据库连接串、通用凭证模式。这是工具执行管道的第 6 阶段。

对比一下思路差异：Claude Code 通过 `excludeSensitiveFiles` 预先排除敏感文件（fail-closed，默认不读），我用的是运行时捕获后过滤。前者更保守，后者覆盖面更广但依赖过滤规则的完备性——如果规则未覆盖某种敏感模式，就会泄漏。

---

## 测试覆盖情况

### 整体数据

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>测试类型</p></td><td rowspan="1" colspan="1"><p>数量</p></td><td rowspan="1" colspan="1"><p>通过率</p></td><td rowspan="1" colspan="1"><p>工具/框架</p></td></tr><tr><td rowspan="1" colspan="1"><p>后端安全单元测试</p></td><td rowspan="1" colspan="1"><p>289</p></td><td rowspan="1" colspan="1"><p>100%</p></td><td rowspan="1" colspan="1"><p>JUnit 5</p></td></tr><tr><td rowspan="1" colspan="1"><p>前端 Store 单元测试</p></td><td rowspan="1" colspan="1"><p>33</p></td><td rowspan="1" colspan="1"><p>100%</p></td><td rowspan="1" colspan="1"><p>Vitest</p></td></tr><tr><td rowspan="1" colspan="1"><p>Python 服务单元测试</p></td><td rowspan="1" colspan="1"><p>18</p></td><td rowspan="1" colspan="1"><p>100%</p></td><td rowspan="1" colspan="1"><p>pytest</p></td></tr><tr><td rowspan="1" colspan="1"><p>Playwright E2E 测试</p></td><td rowspan="1" colspan="1"><p>7</p></td><td rowspan="1" colspan="1"><p>100%</p></td><td rowspan="1" colspan="1"><p>Playwright + Chrome 147</p></td></tr><tr><td rowspan="1" colspan="1"><p>手动功能测试用例</p></td><td rowspan="1" colspan="1"><p>110</p></td><td rowspan="1" colspan="1"><p>100%</p></td><td rowspan="1" colspan="1"></td></tr><tr><td rowspan="1" colspan="1"><p>总计</p></td><td rowspan="1" colspan="1"><p>347</p></td><td rowspan="1" colspan="1"><p>100%</p></td><td rowspan="1" colspan="1"></td></tr></tbody></table>

347 个测试全部通过。不过需要指出，前端 33 个单元测试只覆盖了 Store 层，18 个组件目录的 UI 测试基本是空白，这是当前测试覆盖的主要短板。

### 安全测试的细节

289 个安全测试的分布可以看出纵深防御的覆盖思路：

●

`BashCommandClassifierTest` （77 个）：覆盖三层只读验证（~60 命令/9 正则/20+ flag 白名单）

●

`BashParserGoldenTest` （50 个）：覆盖 20 种 AST 节点类型、管道/重定向/子 shell/变量展开

●

`BashSecurityAnalyzerTest` （63 个）：控制字符、14 种 Unicode 空白、24 eval-like 内建命令、Zsh 危险命令

●

`SensitivePathSecurityTest` （22 个）：17 系统路径保护、6 隐藏目录保护、符号链接解析

●

`PermissionEnhancementGoldenTest` （68 个）：权限管道增强场景全覆盖

●

`SecurityFilterIntegrationTest` （9 个）：安全过滤器集成测试

### 测试中发现的 BUG

测试过程中发现了 4 个问题，我全部修复了：

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>编号</p></td><td rowspan="1" colspan="1"><p>问题</p></td><td rowspan="1" colspan="1"><p>级别</p></td><td rowspan="1" colspan="1"><p>状态</p></td></tr><tr><td rowspan="1" colspan="1"><p>#1</p></td><td rowspan="1" colspan="1"><p>start.sh 未加载.env</p></td><td rowspan="1" colspan="1"><p>High</p></td><td rowspan="1" colspan="1"><p>✅ 已修复</p></td></tr><tr><td rowspan="1" colspan="1"><p>#2</p></td><td rowspan="1" colspan="1"><p>Python PYTHONPATH 缺失</p></td><td rowspan="1" colspan="1"><p>Medium</p></td><td rowspan="1" colspan="1"><p>✅ 已修复</p></td></tr><tr><td rowspan="1" colspan="1"><p>#3</p></td><td rowspan="1" colspan="1"><p>BashTool 敏感路径拦截</p></td><td rowspan="1" colspan="1"><p>High</p></td><td rowspan="1" colspan="1"><p>✅ 已修复（Step 1k + 32 测试）</p></td></tr><tr><td rowspan="1" colspan="1"><p>#4</p></td><td rowspan="1" colspan="1"><p>tree-sitter 版本兼容性</p></td><td rowspan="1" colspan="1"><p>Medium</p></td><td rowspan="1" colspan="1"><p>✅ 已修复（版本检测兼容层）</p></td></tr></tbody></table>

没有发现安全类高危漏洞。

---

## 性能数据

### 资源占用

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>服务</p></td><td rowspan="1" colspan="1"><p>内存占用</p></td><td rowspan="1" colspan="1"><p>端口</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="1"><p>Java 后端</p></td><td rowspan="1" colspan="1"><p>~257 MB</p></td><td rowspan="1" colspan="1"><p>:8080</p></td><td rowspan="1" colspan="1"><p>Spring Boot 3.4.13 + JDK 21 虚拟线程</p></td></tr><tr><td rowspan="1" colspan="1"><p>React 前端</p></td><td rowspan="1" colspan="1"><p>~88 MB</p></td><td rowspan="1" colspan="1"><p>:5173</p></td><td rowspan="1" colspan="1"><p>Vite 5.4.11 开发服务器</p></td></tr><tr><td rowspan="1" colspan="1"><p>Python FastAPI</p></td><td rowspan="1" colspan="1"><p>~78 MB</p></td><td rowspan="1" colspan="1"><p>:8000</p></td><td rowspan="1" colspan="1"><p>Uvicorn 0.32.0 + tree-sitter</p></td></tr><tr><td rowspan="1" colspan="1"><p>三服务总计</p></td><td rowspan="1" colspan="1"><p>~423 MB</p></td><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"></td></tr></tbody></table>

三个服务加起来 423 MB 左右，Java 后端占大头（257 MB）。开发环境下可以接受，生产部署时前端打包后不需要 Vite 开发服务器，实际占用会更低。

### 响应表现

●

工具执行：Read 工具 7-8ms，Grep 搜索返回 18 个文件结果

●

WebSocket 通信：STOMP 心跳 10s 双向，应用层 ping/pong 保活

●

流式输出：SSE 25+ 个 `text_delta` 事件逐步推送

●

MCP 重连：64 条重连日志中每次均在首次尝试成功（1s 延迟）

7 个 Playwright E2E 测试总耗时 8.5s，单个最慢 5.9s（响应式视口测试），最快 1.0s（主题切换）。

---

## 跟 Claude Code 的正面对比

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>维度</p></td><td rowspan="1" colspan="1"><p>Claude Code</p></td><td rowspan="1" colspan="1"><p>ZhikunCode</p></td><td rowspan="1" colspan="1"><p>评价</p></td></tr><tr><td rowspan="1" colspan="1"><p>语言</p></td><td rowspan="1" colspan="1"><p>TypeScript (51万行, 1,884文件)</p></td><td rowspan="1" colspan="1"><p>Java ~62K + TS ~12K + Python ~2K = ~77K行</p></td><td rowspan="1" colspan="1"><p>三语言分层，总量约 1/5</p></td></tr><tr><td rowspan="1" colspan="1"><p>架构</p></td><td rowspan="1" colspan="1"><p>单进程单体</p></td><td rowspan="1" colspan="1"><p>三层分离微服务</p></td><td rowspan="1" colspan="1"><p>三层分离更便于企业环境运维</p></td></tr><tr><td rowspan="1" colspan="1"><p>UI</p></td><td rowspan="1" colspan="1"><p>终端优先 + VS Code/Web/Desktop 扩展</p></td><td rowspan="1" colspan="1"><p>Web 优先 React + Zustand</p></td><td rowspan="1" colspan="1"><p>定位不同：终端优先 vs Web 优先</p></td></tr><tr><td rowspan="1" colspan="1"><p>Agent Loop</p></td><td rowspan="1" colspan="1"><p>AsyncGenerator 两层循环</p></td><td rowspan="1" colspan="1"><p>8步 while 循环</p></td><td rowspan="1" colspan="1"><p>功能等价，Generator 更优雅</p></td></tr><tr><td rowspan="1" colspan="1"><p>工具数量</p></td><td rowspan="1" colspan="1"><p>53 内建</p></td><td rowspan="1" colspan="1"><p>47（15分类）</p></td><td rowspan="1" colspan="1"><p>Claude Code 更多</p></td></tr><tr><td rowspan="1" colspan="1"><p>Bash 安全</p></td><td rowspan="1" colspan="1"><p>18 文件 ~5,000 行</p></td><td rowspan="1" colspan="1"><p>6 核心文件 ~5,000+ 行</p></td><td rowspan="1" colspan="1"><p>等价覆盖</p></td></tr><tr><td rowspan="1" colspan="1"><p>权限模式</p></td><td rowspan="1" colspan="1"><p>6 种 + 远程熔断</p></td><td rowspan="1" colspan="1"><p>4 种（BYPASS/ALLOW/DEFAULT/PLAN）+ 14步决策链 + FeatureFlag killswitch</p></td><td rowspan="1" colspan="1"><p>等价</p></td></tr><tr><td rowspan="1" colspan="1"><p>MCP</p></td><td rowspan="1" colspan="1"><p>4 种传输 + OAuth + Elicitation</p></td><td rowspan="1" colspan="1"><p>SSE/STDIO/WebSocket/HTTP Streaming + 国内 MCP 预集成</p></td><td rowspan="1" colspan="1"><p>各有侧重</p></td></tr><tr><td rowspan="1" colspan="1"><p>多 Agent</p></td><td rowspan="1" colspan="1"><p>Tmux/InProcess 双后端</p></td><td rowspan="1" colspan="1"><p>InProcess (虚拟线程)</p></td><td rowspan="1" colspan="1"><p>Claude Code 隔离性更强</p></td></tr><tr><td rowspan="1" colspan="1"><p>System Prompt</p></td><td rowspan="1" colspan="1"><p>914 行 prompts.ts</p></td><td rowspan="1" colspan="1"><p>1,227 行 Builder + 795 行模板</p></td><td rowspan="1" colspan="1"><p>模板数量更多</p></td></tr><tr><td rowspan="1" colspan="1"><p>压缩策略</p></td><td rowspan="1" colspan="1"><p>4 层 (~4,000行)</p></td><td rowspan="1" colspan="1"><p>6 层 (1,340行)</p></td><td rowspan="1" colspan="1"><p>功能等价</p></td></tr><tr><td rowspan="1" colspan="1"><p>测试</p></td><td rowspan="1" colspan="1"><p>未公开</p></td><td rowspan="1" colspan="1"><p>347 自动化 + 110 手动</p></td><td rowspan="1" colspan="1"><p>有完整公开数据</p></td></tr><tr><td rowspan="1" colspan="1"><p>模型支持</p></td><td rowspan="1" colspan="1"><p>Claude 系列</p></td><td rowspan="1" colspan="1"><p>千问/DeepSeek/Moonshot/OpenAI 兼容</p></td><td rowspan="1" colspan="1"><p>不同定位</p></td></tr></tbody></table>

代码量差异值得说一下。我的项目总共约 77K 行（Java ~62K + React ~12K + Python ~2K），大概是 Claude Code（512,664 行 TypeScript）的 15%。差距主要来自三个地方：

1.

Claude Code 的 Ink 终端渲染引擎（19,842 行）在我这里由前端 React 组件替代

2.

Claude Code 的 `components/` （81,546 行）和 `hooks/` （19,204 行）是终端 UI 实现

3.

Claude Code 的 `commands/` （26,428 行，90+ 斜杠命令）在我这里通过 Skill 系统简化了

核心逻辑——Agent Loop、工具系统、权限体系、上下文管理——的代码量其实比较接近。

---

## 可扩展性和维护性

### 模块化

我的后端 52 个包的组织结构如下：

com.aicodeassistant

├── engine/ # 核心引擎（QueryEngine, CompactService, ContextCascade）

├── tool/ # 工具系统（88 个文件）

│ ├── impl/ # 工具实现（23 个工具类）

│ ├── bash/ # Bash 安全（解析器、分类器、安全分析器）

│ └── agent/ # Agent 工具

├── permission/ # 权限体系（11 个文件）

├── prompt/ # 提示词工程

├── coordinator/ # 多 Agent 协作（17 个文件）

├── mcp/ # MCP 集成（30 个文件）

├── llm/ # LLM 抽象层

├── websocket/ # WebSocket 通信

├── context/ # 上下文管理

└── session/ # 会话管理

依赖注入用的 Spring 构造器注入，模块间耦合度可控。 `QueryEngine` 通过 17 个构造器参数注入所有依赖——参数确实多了点，但至少依赖关系是明确的，不用猜。

### 代码规范

●

Java 代码用 `record` 类型定义不可变数据结构（如 `QueryResult` 、 `Usage` ）

●

`sealed interface` 用于工作流阶段（ `WorkflowPhase` ）和消息类型（ `ServerMessage` 41 种 record）

●

`ConcurrentHashMap` + `AtomicBoolean` + `CAS` 保线程安全

●

Javadoc 注释引用规格说明（ `@see SPEC §x.x.x` ），便于追溯设计决策

Java 21 的新特性用得比较充分，record 和 sealed interface 让代码简洁不少。

### 已知不足

以上是优势，下面说不足。

MCP 传输协议已实现 4 种（SSE/STDIO/WebSocket/HTTP Streaming），OAuth 认证已完整实现。 `McpAuthTool.java` （416 行）实现了完整的 OAuth 2.0 授权码流程（RFC 9728 + RFC 8414 + PKCE），包括 OAuth 端点发现、PKCE 参数生成、本地回调服务器、令牌交换与加密存储。

多 Agent 隔离性是一个隐患。Claude Code 通过 Tmux 后端提供进程级隔离，一个 Worker 崩了不影响别的。ZhikunCode 的 InProcess 后端虽然用了虚拟线程，但隔离性弱于进程级方案。在需要强隔离的场景下，这是个明确的短板。

前端测试前面提过，33 个单元测试只覆盖 Store 层，18 个组件目录缺少 UI 测试。

---

## 我的整体判断

核心能力方面，claude code的58 个核心功能点中 95.8% 已实现。Agent Loop、工具系统、权限体系、上下文压缩、多 Agent 协作均为完整实现，而非简化版本。

安全设计从架构层面就考虑了安全，而非事后补丁。8 层 Bash 安全检查、14步权限决策链、4种权限模式、289 个安全单元测试、fail-closed 默认值，构成了完整的安全体系。

工程质量方面，347 个测试全通过，4 个 BUG 在测试中发现并修复，代码规范统一。

国内场景适配方面，Web 优先的界面、千问 Dashscope 直连、Java 技术栈、国内直接可用、预集成国内 MCP 服务——这些不是照搬 Claude Code 换个语言，而是面向国内场景做了架构调整。

### 适合什么场景

●

企业内部部署：Java + Spring Boot 是企业最熟悉的技术栈，三层分离便于运维

●

需要用国产模型：千问 OpenAI 兼容模式的适配让你不用操心海外 API 的问题

●

二次开发：模块化设计加上完整测试覆盖，改代码时心里有底

●

学习参考：作为 Claude Code 的 Java 实现，想理解大型 AI Agent 系统架构的话，这是个不错的学习材料

## Talk is cheap, show the code

再贴一遍github的源码： [https://github.com/zhikunqingtao/zhikuncode/](https://github.com/zhikunqingtao/zhikuncode/) ，欢迎fork、感恩star❤️

END

介绍

架构选择：三层分离 vs TypeScript 单体

QueryEngine：8步循环的设计

工具系统：47 个工具（15分类）

拆开看看核心模块

BashTool 的 8 层安全体系

权限管线 PermissionPipeline

System Prompt 构建

上下文压缩策略

MCP 集成

多 Agent 协作

技术特色

模型别名重构

MCP 韧性增强

AUTO 模式的紧急开关

千问模型适配

敏感数据运行时脱敏

测试覆盖情况

整体数据

安全测试的细节

测试中发现的 BUG

性能数据

资源占用

响应表现

跟 Claude Code 的正面对比

可扩展性和维护性

模块化

代码规范

已知不足

我的整体判断

适合什么场景

Talk is cheap, show the code

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
---
title: "【仅内部技术学习】Qoder Agent Loop源码深度分析"
source: "https://ata.atatech.org/articles/11020625309?spm=ata.23639746.0.0.3d222a29mpDFWf"
author:
published:
created: 2026-05-11
description:
tags:
  - "clippings"
---
中国电商事业群-淘天集团

勋章

粉丝 831影响力 6.3k

** 23

** 17

** 2

** 原创文章

内部资料

AI 辅助创作

发表到圈儿

[客户运营部技术博客](https://ata.atatech.org/community/team/115) / [AI智能化](https://ata.atatech.org/community/team/115?cid=1871) (首发)

**

[李历岷(骨来)](https://ata.atatech.org/users/11000095710)

5月9日发表392次浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章23:11

**

> 分析对象: Qoder v0.17.0 (Electron + TypeScript 编译后代码) 核心发现: Agent Loop 并非独立模块，而是内嵌于聊天服务的状态机驱动架构 分析方法: 反编译代码搜索 + 关键函数提取 + 执行流程还原 文档版本: v1.0 生成时间: 2026-05-09

---

说明：本次核心目的对比Claude Code源码分析，学习Qoder设计理念和差异化的部分，尤其是AgentLoop核心设计理念。

1.

大模型可以分析一切源码

2.

代码混淆基本上可以逆向工程

3.

不同的CodeAgent产品对反编译协议不同（Qoder禁止反编译分析 VS 悟空支持反编译分析）

4.

学习源码是程序员必备技能，了解背后的逻辑和原理

提示词：

/Applications/Qoder.app/Contents/Resources/app/ 深度分析Qoder源码以及AgentLoop工作原理，产出源码分析详细报告。

鉴于 Qoder 是 Electron 应用，核心逻辑被打包在 workbench.desktop.main.js 等编译后的 JS 文件中，通过以下步骤进行“抽丝剥茧”：

1\. 定位入口：找到 Agent 功能的初始化入口。

2\. 追踪循环：还原 AgentLoop 类的核心 run() 方法，分析其如何调度 LLM、解析工具调用、执行工具并处理结果。

3\. 状态机分析：梳理 SubAgent 的生命周期状态流转。

4\. 协议逆向：分析发送给 LLM 的 Prompt 结构和接收到的 Stream 数据格式。

5\. 生成报告：将分析结果整理为详细的 Markdown 文档。

执行过程解读：

<table><colgroup><col width="434"> <col width="434"></colgroup><tbody><tr><td rowspan="1" colspan="1"><img src="https://oss-ata.alibaba.com/article/2026/05/9fccd038-8c8e-4369-bc59-5922814c0b24.png"></td><td rowspan="1" colspan="1"><img src="https://oss-ata.alibaba.com/article/2026/05/4437b819-95d4-4a72-a5b1-146f18d82f6d.png"></td></tr><tr><td rowspan="1" colspan="1"><img src="https://oss-ata.alibaba.com/article/2026/05/24ba3914-0e55-4c53-8feb-e827babb1a0c.png"></td><td rowspan="1" colspan="1"><img src="https://oss-ata.alibaba.com/article/2026/05/4a957013-9ce3-4af7-9e35-b44f124f0a54.png"></td></tr></tbody></table>

反编译协议许可：

<table><colgroup><col width="434"> <col width="434"></colgroup><tbody><tr><td rowspan="1" colspan="1"><img src="https://oss-ata.alibaba.com/article/2026/05/4202eef4-1a5a-4143-bf97-176eab3d2219.png"><p>QoderWork遵循了反编译协议。</p></td><td rowspan="1" colspan="1"><img src="https://oss-ata.alibaba.com/article/2026/05/d3440785-cd79-4ebe-8dbf-e285eb4a623b.png"><p>悟空当前不遵守反编译协议。</p></td></tr></tbody></table>

---

## 一、核心架构概览

### 1.1 双模式决策系统

Qoder 采用\*\*会话类型枚举（SessionType）\*\*作为核心决策机制，支持两种截然不同的 Agent 行为模式：

enum SessionType {

QUEST = "quest", // 问答/检索模式 - 快速响应、单次查询

ASSISTANT = "assistant" // 自主规划模式 - 多步执行、工具调用

}

关键设计洞察：

●

状态驱动：Agent 的行为由 `sessionType` 字段动态决定，而非硬编码逻辑

●

模式切换：用户可通过输入框提示词（如 `/plan` ）动态切换模式

●

UI 适配：不同模式对应不同的欢迎语、占位符和工具栏配置

源码位置索引：

●

SessionType 定义： `workbench.desktop.main.js:3131` （通过 `Zr.ASSISTANT` / `Zr.QUEST` 引用）

●

模式提示词配置： `package.json` 中的 `chat.input.agent.input.tip` 和 `chat.input.ask.input.tip`

---

### 1.2 三层服务架构

Qoder 的 Agent 系统由三个核心服务层构成：

┌─────────────────────────────────────┐

│ ChatViewManagerService │ ← UI 层：管理聊天视图生命周期

│ - registerChatView() │

│ - openChatInEditor() │

│ - disposeChatView() │

└─────────────────┬───────────────────┘

│

┌─────────────────▼───────────────────┐

│ QoderChatService │ ← 服务层：封装 AI 通信协议

│ - askAgent() │

│ - processProgress() │

│ - getResponseStream() │

└─────────────────┬───────────────────┘

│

┌─────────────────▼───────────────────┐

│ AiCodingService (Extension) │ ← 扩展层：实际 LLM 调用

│ - sendRequestToExtension() │

│ - onNotification(CHAT\_PROGRESS) │

└─────────────────────────────────────┘

关键类与源码位置：

<table><colgroup><col width="216"> <col width="216"> <col width="216"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>服务类</p></td><td rowspan="1" colspan="1"><p>源码位置</p></td><td rowspan="1" colspan="1"><p>核心职责</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>VPt</code> (QoderChatService)</div></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js:39150</code></div></td><td rowspan="1" colspan="1"><p>传统聊天请求发送、进度流管理</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>ggi</code> (React 视图基类)</div></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js:39146</code></div></td><td rowspan="1" colspan="1"><p>React 组件挂载、徽章更新</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>mgi</code> (ChatViewManagerService)</div></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js:39156</code></div></td><td rowspan="1" colspan="1"><p>多标签管理、会话持久化</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>vV1</code> (SessionManager)</div></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js:39150</code></div></td><td rowspan="1" colspan="1"><p>会话状态机、进度事件分发</p></td></tr></tbody></table>

---

## 二、Agent 调用核心流程

### 2.1 SubAgent 工具调用机制

Qoder 实现了一个名为 `runSubagent` 的内置工具（Tool ID: `lLe.runSubagent` ），允许主 Agent 动态调用子 Agent。这是 Multi-Agent 协作的核心入口。

调用参数结构：

interface SubAgentToolParams {

prompt: string; // 任务详细描述（必填）

description: string; // 简短任务摘要（3-5 词，必填）

subagentType?: string; // 可选：指定特定 Agent 类型

modelId?: string; // 可选：自定义模型 ID

userSelectedTools?: Map // 可选：自定义工具集

}

核心调用代码（简化版）：

// 位置：workbench.desktop.main.js:23783

async invoke(t, n, r, i) {

const o = t.parameters;

// 1. 获取当前会话

const s = this.chatService.getSession(Lu.forSession(t.context.sessionId));

if (!s) throw new Error("Chat model not found for session");

// 2. 获取默认 Agent

const u = this.chatAgentService.getDefaultAgent($r.Chat, Ea.Agent);

if (!u) return Rdi("Error: No default agent available");

// 3. 解析 subagentType（如果指定）

if (o.subagentType) {

const C = this.chatModeService.findModeByName(o.subagentType);

if (C) {

// 3.1 加载自定义模型配置

const w = C.model?.get();

if (w) {

const E = this.languageModelsService.getLanguageModelIds();

for (const y of E) {

const P = this.languageModelsService.lookupLanguageModel(y);

if (P && Vee.matchesQualifiedName(w, P)) {

l = y; // 匹配模型 ID

break;

}

}

}

// 3.2 加载自定义工具集

const S = C.customTools?.get();

if (S) {

const E = this.languageModelToolsService.toToolAndToolSetEnablementMap(S, C.target?.get());

c = {};

for (const \[y, P\] of E)

y instanceof bE || (c\[y.id\] = P);

关键设计模式：

1.

无状态调用：每次 SubAgent 调用都是独立的，无法进行多轮对话

2.

进度流合并：通过 `fromSubagent: !0` 标记区分子 Agent 输出

3.

错误隔离：SubAgent 的错误不会中断主流程，而是以文本形式返回

---

### 2.2 Agent 核心调用链

从用户输入到 Agent 执行的完整调用链如下：

文本绘图

视图

sequenceDiagram

participant User as 用户

participant UI as ChatViewManagerService

participant Service as QoderChatService

participant Ext as AiCodingService (Extension)

participant LLM as LLM 后端

User->>UI: 输入任务描述

UI->>Service: processProgress(sessionId, requestId, message)

Service->>Ext: sendRequestToExtension(ASK\_AGENT)

Ext->>LLM: HTTP/gRPC 调用

loop 流式响应

LLM-->>Ext: Token 流

Ext-->>Service: CHAT\_PROGRESS 通知

Service-->>UI: onProgressUpdate.fire()

UI-->>User: 实时更新 UI

end

LLM-->>Ext: 完成信号

Ext-->>Service: CHAT\_FINISH 通知

Service-->>UI: onChatFinish.fire()

UI-->>User: 显示完成状态

![](data:image/svg+xml;utf8,%3Csvg%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20aria-roledescription%3D%22sequence%22%20role%3D%22graphics-document%20document%22%20viewBox%3D%22-50%20-10%201510%20877%22%20style%3D%22max-width%3A%201510px%3B%22%20width%3D%221510%22%20id%3D%22text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%22%20height%3D%22877%22%3E%3Cg%3E%3Crect%20class%3D%22actor%20actor-bottom%22%20ry%3D%223%22%20rx%3D%223%22%20name%3D%22LLM%22%20height%3D%2265%22%20width%3D%22150%22%20stroke%3D%22%23666%22%20fill%3D%22%23eaeaea%22%20y%3D%22791%22%20x%3D%221260%22%2F%3E%3Ctext%20style%3D%22text-anchor%3A%20middle%3B%20font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22actor%22%20alignment-baseline%3D%22central%22%20dominant-baseline%3D%22central%22%20y%3D%22823.5%22%20x%3D%221335%22%3E%3Ctspan%20dy%3D%220%22%20x%3D%221335%22%3ELLM%20%E5%90%8E%E7%AB%AF%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22actor%20actor-bottom%22%20ry%3D%223%22%20rx%3D%223%22%20name%3D%22Ext%22%20height%3D%2265%22%20width%3D%22230%22%20stroke%3D%22%23666%22%20fill%3D%22%23eaeaea%22%20y%3D%22791%22%20x%3D%22980%22%2F%3E%3Ctext%20style%3D%22text-anchor%3A%20middle%3B%20font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22actor%22%20alignment-baseline%3D%22central%22%20dominant-baseline%3D%22central%22%20y%3D%22823.5%22%20x%3D%221095%22%3E%3Ctspan%20dy%3D%220%22%20x%3D%221095%22%3EAiCodingService%20(Extension)%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22actor%20actor-bottom%22%20ry%3D%223%22%20rx%3D%223%22%20name%3D%22Service%22%20height%3D%2265%22%20width%3D%22155%22%20stroke%3D%22%23666%22%20fill%3D%22%23eaeaea%22%20y%3D%22791%22%20x%3D%22655.5%22%2F%3E%3Ctext%20style%3D%22text-anchor%3A%20middle%3B%20font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22actor%22%20alignment-baseline%3D%22central%22%20dominant-baseline%3D%22central%22%20y%3D%22823.5%22%20x%3D%22733%22%3E%3Ctspan%20dy%3D%220%22%20x%3D%22733%22%3EQoderChatService%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22actor%20actor-bottom%22%20ry%3D%223%22%20rx%3D%223%22%20name%3D%22UI%22%20height%3D%2265%22%20width%3D%22210%22%20stroke%3D%22%23666%22%20fill%3D%22%23eaeaea%22%20y%3D%22791%22%20x%3D%22200%22%2F%3E%3Ctext%20style%3D%22text-anchor%3A%20middle%3B%20font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22actor%22%20alignment-baseline%3D%22central%22%20dominant-baseline%3D%22central%22%20y%3D%22823.5%22%20x%3D%22305%22%3E%3Ctspan%20dy%3D%220%22%20x%3D%22305%22%3EChatViewManagerService%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22actor%20actor-bottom%22%20ry%3D%223%22%20rx%3D%223%22%20name%3D%22User%22%20height%3D%2265%22%20width%3D%22150%22%20stroke%3D%22%23666%22%20fill%3D%22%23eaeaea%22%20y%3D%22791%22%20x%3D%220%22%2F%3E%3Ctext%20style%3D%22text-anchor%3A%20middle%3B%20font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22actor%22%20alignment-baseline%3D%22central%22%20dominant-baseline%3D%22central%22%20y%3D%22823.5%22%20x%3D%2275%22%3E%3Ctspan%20dy%3D%220%22%20x%3D%2275%22%3E%E7%94%A8%E6%88%B7%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3Cg%3E%3Cline%20stroke%3D%22%23999%22%20stroke-width%3D%220.5px%22%20class%3D%22200%22%20y2%3D%22791%22%20x2%3D%221335%22%20y1%3D%225%22%20x1%3D%221335%22%20id%3D%22actor4%22%2F%3E%3Cg%20id%3D%22root-4%22%3E%3Crect%20class%3D%22actor%20actor-top%22%20ry%3D%223%22%20rx%3D%223%22%20name%3D%22LLM%22%20height%3D%2265%22%20width%3D%22150%22%20stroke%3D%22%23666%22%20fill%3D%22%23eaeaea%22%20y%3D%220%22%20x%3D%221260%22%2F%3E%3Ctext%20style%3D%22text-anchor%3A%20middle%3B%20font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22actor%22%20alignment-baseline%3D%22central%22%20dominant-baseline%3D%22central%22%20y%3D%2232.5%22%20x%3D%221335%22%3E%3Ctspan%20dy%3D%220%22%20x%3D%221335%22%3ELLM%20%E5%90%8E%E7%AB%AF%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%3E%3Cline%20stroke%3D%22%23999%22%20stroke-width%3D%220.5px%22%20class%3D%22200%22%20y2%3D%22791%22%20x2%3D%221095%22%20y1%3D%225%22%20x1%3D%221095%22%20id%3D%22actor3%22%2F%3E%3Cg%20id%3D%22root-3%22%3E%3Crect%20class%3D%22actor%20actor-top%22%20ry%3D%223%22%20rx%3D%223%22%20name%3D%22Ext%22%20height%3D%2265%22%20width%3D%22230%22%20stroke%3D%22%23666%22%20fill%3D%22%23eaeaea%22%20y%3D%220%22%20x%3D%22980%22%2F%3E%3Ctext%20style%3D%22text-anchor%3A%20middle%3B%20font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22actor%22%20alignment-baseline%3D%22central%22%20dominant-baseline%3D%22central%22%20y%3D%2232.5%22%20x%3D%221095%22%3E%3Ctspan%20dy%3D%220%22%20x%3D%221095%22%3EAiCodingService%20(Extension)%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%3E%3Cline%20stroke%3D%22%23999%22%20stroke-width%3D%220.5px%22%20class%3D%22200%22%20y2%3D%22791%22%20x2%3D%22733%22%20y1%3D%225%22%20x1%3D%22733%22%20id%3D%22actor2%22%2F%3E%3Cg%20id%3D%22root-2%22%3E%3Crect%20class%3D%22actor%20actor-top%22%20ry%3D%223%22%20rx%3D%223%22%20name%3D%22Service%22%20height%3D%2265%22%20width%3D%22155%22%20stroke%3D%22%23666%22%20fill%3D%22%23eaeaea%22%20y%3D%220%22%20x%3D%22655.5%22%2F%3E%3Ctext%20style%3D%22text-anchor%3A%20middle%3B%20font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22actor%22%20alignment-baseline%3D%22central%22%20dominant-baseline%3D%22central%22%20y%3D%2232.5%22%20x%3D%22733%22%3E%3Ctspan%20dy%3D%220%22%20x%3D%22733%22%3EQoderChatService%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%3E%3Cline%20stroke%3D%22%23999%22%20stroke-width%3D%220.5px%22%20class%3D%22200%22%20y2%3D%22791%22%20x2%3D%22305%22%20y1%3D%225%22%20x1%3D%22305%22%20id%3D%22actor1%22%2F%3E%3Cg%20id%3D%22root-1%22%3E%3Crect%20class%3D%22actor%20actor-top%22%20ry%3D%223%22%20rx%3D%223%22%20name%3D%22UI%22%20height%3D%2265%22%20width%3D%22210%22%20stroke%3D%22%23666%22%20fill%3D%22%23eaeaea%22%20y%3D%220%22%20x%3D%22200%22%2F%3E%3Ctext%20style%3D%22text-anchor%3A%20middle%3B%20font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22actor%22%20alignment-baseline%3D%22central%22%20dominant-baseline%3D%22central%22%20y%3D%2232.5%22%20x%3D%22305%22%3E%3Ctspan%20dy%3D%220%22%20x%3D%22305%22%3EChatViewManagerService%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%3E%3Cline%20stroke%3D%22%23999%22%20stroke-width%3D%220.5px%22%20class%3D%22200%22%20y2%3D%22791%22%20x2%3D%2275%22%20y1%3D%225%22%20x1%3D%2275%22%20id%3D%22actor0%22%2F%3E%3Cg%20id%3D%22root-0%22%3E%3Crect%20class%3D%22actor%20actor-top%22%20ry%3D%223%22%20rx%3D%223%22%20name%3D%22User%22%20height%3D%2265%22%20width%3D%22150%22%20stroke%3D%22%23666%22%20fill%3D%22%23eaeaea%22%20y%3D%220%22%20x%3D%220%22%2F%3E%3Ctext%20style%3D%22text-anchor%3A%20middle%3B%20font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22actor%22%20alignment-baseline%3D%22central%22%20dominant-baseline%3D%22central%22%20y%3D%2232.5%22%20x%3D%2275%22%3E%3Ctspan%20dy%3D%220%22%20x%3D%2275%22%3E%E7%94%A8%E6%88%B7%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cstyle%3E%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%7Bfont-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3Bfont-size%3A16px%3Bfill%3A%23333%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.error-icon%7Bfill%3A%23552222%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.error-text%7Bfill%3A%23552222%3Bstroke%3A%23552222%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.edge-thickness-normal%7Bstroke-width%3A2px%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.edge-thickness-thick%7Bstroke-width%3A3.5px%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.edge-pattern-solid%7Bstroke-dasharray%3A0%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.edge-pattern-dashed%7Bstroke-dasharray%3A3%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.edge-pattern-dotted%7Bstroke-dasharray%3A2%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.marker%7Bfill%3A%23333333%3Bstroke%3A%23333333%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.marker.cross%7Bstroke%3A%23333333%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20svg%7Bfont-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3Bfont-size%3A16px%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.actor%7Bstroke%3Ahsl(259.6261682243%2C%2059.7765363128%25%2C%2087.9019607843%25)%3Bfill%3A%23ECECFF%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20text.actor%26gt%3Btspan%7Bfill%3Ablack%3Bstroke%3Anone%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.actor-line%7Bstroke%3Agrey%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.messageLine0%7Bstroke-width%3A1.5%3Bstroke-dasharray%3Anone%3Bstroke%3A%23333%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.messageLine1%7Bstroke-width%3A1.5%3Bstroke-dasharray%3A2%2C2%3Bstroke%3A%23333%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20%23arrowhead%20path%7Bfill%3A%23333%3Bstroke%3A%23333%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.sequenceNumber%7Bfill%3Awhite%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20%23sequencenumber%7Bfill%3A%23333%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20%23crosshead%20path%7Bfill%3A%23333%3Bstroke%3A%23333%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.messageText%7Bfill%3A%23333%3Bstroke%3Anone%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.labelBox%7Bstroke%3Ahsl(259.6261682243%2C%2059.7765363128%25%2C%2087.9019607843%25)%3Bfill%3A%23ECECFF%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.labelText%2C%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.labelText%26gt%3Btspan%7Bfill%3Ablack%3Bstroke%3Anone%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.loopText%2C%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.loopText%26gt%3Btspan%7Bfill%3Ablack%3Bstroke%3Anone%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.loopLine%7Bstroke-width%3A2px%3Bstroke-dasharray%3A2%2C2%3Bstroke%3Ahsl(259.6261682243%2C%2059.7765363128%25%2C%2087.9019607843%25)%3Bfill%3Ahsl(259.6261682243%2C%2059.7765363128%25%2C%2087.9019607843%25)%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.note%7Bstroke%3A%23aaaa33%3Bfill%3A%23fff5ad%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.noteText%2C%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.noteText%26gt%3Btspan%7Bfill%3Ablack%3Bstroke%3Anone%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.activation0%7Bfill%3A%23f4f4f4%3Bstroke%3A%23666%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.activation1%7Bfill%3A%23f4f4f4%3Bstroke%3A%23666%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.activation2%7Bfill%3A%23f4f4f4%3Bstroke%3A%23666%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.actorPopupMenu%7Bposition%3Aabsolute%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.actorPopupMenuPanel%7Bposition%3Aabsolute%3Bfill%3A%23ECECFF%3Bbox-shadow%3A0px%208px%2016px%200px%20rgba(0%2C0%2C0%2C0.2)%3Bfilter%3Adrop-shadow(3px%205px%202px%20rgb(0%200%200%20%2F%200.4))%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.actor-man%20line%7Bstroke%3Ahsl(259.6261682243%2C%2059.7765363128%25%2C%2087.9019607843%25)%3Bfill%3A%23ECECFF%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20.actor-man%20circle%2C%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20line%7Bstroke%3Ahsl(259.6261682243%2C%2059.7765363128%25%2C%2087.9019607843%25)%3Bfill%3A%23ECECFF%3Bstroke-width%3A2px%3B%7D%23text-diagram-f723ae64-5340-434f-a7c4-3edd0b15a75b-88022%20%3Aroot%7B--mermaid-font-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3B%7D%3C%2Fstyle%3E%3Cg%2F%3E%3Cdefs%3E%3Csymbol%20height%3D%2224%22%20width%3D%2224%22%20id%3D%22computer%22%3E%3Cpath%20d%3D%22M2%202v13h20v-13h-20zm18%2011h-16v-9h16v9zm-10.228%206l.466-1h3.524l.467%201h-4.457zm14.228%203h-24l2-6h2.104l-1.33%204h18.45l-1.297-4h2.073l2%206zm-5-10h-14v-7h14v7z%22%20transform%3D%22scale(.5)%22%2F%3E%3C%2Fsymbol%3E%3C%2Fdefs%3E%3Cdefs%3E%3Csymbol%20clip-rule%3D%22evenodd%22%20fill-rule%3D%22evenodd%22%20id%3D%22database%22%3E%3Cpath%20d%3D%22M12.258.001l.256.004.255.005.253.008.251.01.249.012.247.015.246.016.242.019.241.02.239.023.236.024.233.027.231.028.229.031.225.032.223.034.22.036.217.038.214.04.211.041.208.043.205.045.201.046.198.048.194.05.191.051.187.053.183.054.18.056.175.057.172.059.168.06.163.061.16.063.155.064.15.066.074.033.073.033.071.034.07.034.069.035.068.035.067.035.066.035.064.036.064.036.062.036.06.036.06.037.058.037.058.037.055.038.055.038.053.038.052.038.051.039.05.039.048.039.047.039.045.04.044.04.043.04.041.04.04.041.039.041.037.041.036.041.034.041.033.042.032.042.03.042.029.042.027.042.026.043.024.043.023.043.021.043.02.043.018.044.017.043.015.044.013.044.012.044.011.045.009.044.007.045.006.045.004.045.002.045.001.045v17l-.001.045-.002.045-.004.045-.006.045-.007.045-.009.044-.011.045-.012.044-.013.044-.015.044-.017.043-.018.044-.02.043-.021.043-.023.043-.024.043-.026.043-.027.042-.029.042-.03.042-.032.042-.033.042-.034.041-.036.041-.037.041-.039.041-.04.041-.041.04-.043.04-.044.04-.045.04-.047.039-.048.039-.05.039-.051.039-.052.038-.053.038-.055.038-.055.038-.058.037-.058.037-.06.037-.06.036-.062.036-.064.036-.064.036-.066.035-.067.035-.068.035-.069.035-.07.034-.071.034-.073.033-.074.033-.15.066-.155.064-.16.063-.163.061-.168.06-.172.059-.175.057-.18.056-.183.054-.187.053-.191.051-.194.05-.198.048-.201.046-.205.045-.208.043-.211.041-.214.04-.217.038-.22.036-.223.034-.225.032-.229.031-.231.028-.233.027-.236.024-.239.023-.241.02-.242.019-.246.016-.247.015-.249.012-.251.01-.253.008-.255.005-.256.004-.258.001-.258-.001-.256-.004-.255-.005-.253-.008-.251-.01-.249-.012-.247-.015-.245-.016-.243-.019-.241-.02-.238-.023-.236-.024-.234-.027-.231-.028-.228-.031-.226-.032-.223-.034-.22-.036-.217-.038-.214-.04-.211-.041-.208-.043-.204-.045-.201-.046-.198-.048-.195-.05-.19-.051-.187-.053-.184-.054-.179-.056-.176-.057-.172-.059-.167-.06-.164-.061-.159-.063-.155-.064-.151-.066-.074-.033-.072-.033-.072-.034-.07-.034-.069-.035-.068-.035-.067-.035-.066-.035-.064-.036-.063-.036-.062-.036-.061-.036-.06-.037-.058-.037-.057-.037-.056-.038-.055-.038-.053-.038-.052-.038-.051-.039-.049-.039-.049-.039-.046-.039-.046-.04-.044-.04-.043-.04-.041-.04-.04-.041-.039-.041-.037-.041-.036-.041-.034-.041-.033-.042-.032-.042-.03-.042-.029-.042-.027-.042-.026-.043-.024-.043-.023-.043-.021-.043-.02-.043-.018-.044-.017-.043-.015-.044-.013-.044-.012-.044-.011-.045-.009-.044-.007-.045-.006-.045-.004-.045-.002-.045-.001-.045v-17l.001-.045.002-.045.004-.045.006-.045.007-.045.009-.044.011-.045.012-.044.013-.044.015-.044.017-.043.018-.044.02-.043.021-.043.023-.043.024-.043.026-.043.027-.042.029-.042.03-.042.032-.042.033-.042.034-.041.036-.041.037-.041.039-.041.04-.041.041-.04.043-.04.044-.04.046-.04.046-.039.049-.039.049-.039.051-.039.052-.038.053-.038.055-.038.056-.038.057-.037.058-.037.06-.037.061-.036.062-.036.063-.036.064-.036.066-.035.067-.035.068-.035.069-.035.07-.034.072-.034.072-.033.074-.033.151-.066.155-.064.159-.063.164-.061.167-.06.172-.059.176-.057.179-.056.184-.054.187-.053.19-.051.195-.05.198-.048.201-.046.204-.045.208-.043.211-.041.214-.04.217-.038.22-.036.223-.034.226-.032.228-.031.231-.028.234-.027.236-.024.238-.023.241-.02.243-.019.245-.016.247-.015.249-.012.251-.01.253-.008.255-.005.256-.004.258-.001.258.001zm-9.258%2020.499v.01l.001.021.003.021.004.022.005.021.006.022.007.022.009.023.01.022.011.023.012.023.013.023.015.023.016.024.017.023.018.024.019.024.021.024.022.025.023.024.024.025.052.049.056.05.061.051.066.051.07.051.075.051.079.052.084.052.088.052.092.052.097.052.102.051.105.052.11.052.114.051.119.051.123.051.127.05.131.05.135.05.139.048.144.049.147.047.152.047.155.047.16.045.163.045.167.043.171.043.176.041.178.041.183.039.187.039.19.037.194.035.197.035.202.033.204.031.209.03.212.029.216.027.219.025.222.024.226.021.23.02.233.018.236.016.24.015.243.012.246.01.249.008.253.005.256.004.259.001.26-.001.257-.004.254-.005.25-.008.247-.011.244-.012.241-.014.237-.016.233-.018.231-.021.226-.021.224-.024.22-.026.216-.027.212-.028.21-.031.205-.031.202-.034.198-.034.194-.036.191-.037.187-.039.183-.04.179-.04.175-.042.172-.043.168-.044.163-.045.16-.046.155-.046.152-.047.148-.048.143-.049.139-.049.136-.05.131-.05.126-.05.123-.051.118-.052.114-.051.11-.052.106-.052.101-.052.096-.052.092-.052.088-.053.083-.051.079-.052.074-.052.07-.051.065-.051.06-.051.056-.05.051-.05.023-.024.023-.025.021-.024.02-.024.019-.024.018-.024.017-.024.015-.023.014-.024.013-.023.012-.023.01-.023.01-.022.008-.022.006-.022.006-.022.004-.022.004-.021.001-.021.001-.021v-4.127l-.077.055-.08.053-.083.054-.085.053-.087.052-.09.052-.093.051-.095.05-.097.05-.1.049-.102.049-.105.048-.106.047-.109.047-.111.046-.114.045-.115.045-.118.044-.12.043-.122.042-.124.042-.126.041-.128.04-.13.04-.132.038-.134.038-.135.037-.138.037-.139.035-.142.035-.143.034-.144.033-.147.032-.148.031-.15.03-.151.03-.153.029-.154.027-.156.027-.158.026-.159.025-.161.024-.162.023-.163.022-.165.021-.166.02-.167.019-.169.018-.169.017-.171.016-.173.015-.173.014-.175.013-.175.012-.177.011-.178.01-.179.008-.179.008-.181.006-.182.005-.182.004-.184.003-.184.002h-.37l-.184-.002-.184-.003-.182-.004-.182-.005-.181-.006-.179-.008-.179-.008-.178-.01-.176-.011-.176-.012-.175-.013-.173-.014-.172-.015-.171-.016-.17-.017-.169-.018-.167-.019-.166-.02-.165-.021-.163-.022-.162-.023-.161-.024-.159-.025-.157-.026-.156-.027-.155-.027-.153-.029-.151-.03-.15-.03-.148-.031-.146-.032-.145-.033-.143-.034-.141-.035-.14-.035-.137-.037-.136-.037-.134-.038-.132-.038-.13-.04-.128-.04-.126-.041-.124-.042-.122-.042-.12-.044-.117-.043-.116-.045-.113-.045-.112-.046-.109-.047-.106-.047-.105-.048-.102-.049-.1-.049-.097-.05-.095-.05-.093-.052-.09-.051-.087-.052-.085-.053-.083-.054-.08-.054-.077-.054v4.127zm0-5.654v.011l.001.021.003.021.004.021.005.022.006.022.007.022.009.022.01.022.011.023.012.023.013.023.015.024.016.023.017.024.018.024.019.024.021.024.022.024.023.025.024.024.052.05.056.05.061.05.066.051.07.051.075.052.079.051.084.052.088.052.092.052.097.052.102.052.105.052.11.051.114.051.119.052.123.05.127.051.131.05.135.049.139.049.144.048.147.048.152.047.155.046.16.045.163.045.167.044.171.042.176.042.178.04.183.04.187.038.19.037.194.036.197.034.202.033.204.032.209.03.212.028.216.027.219.025.222.024.226.022.23.02.233.018.236.016.24.014.243.012.246.01.249.008.253.006.256.003.259.001.26-.001.257-.003.254-.006.25-.008.247-.01.244-.012.241-.015.237-.016.233-.018.231-.02.226-.022.224-.024.22-.025.216-.027.212-.029.21-.03.205-.032.202-.033.198-.035.194-.036.191-.037.187-.039.183-.039.179-.041.175-.042.172-.043.168-.044.163-.045.16-.045.155-.047.152-.047.148-.048.143-.048.139-.05.136-.049.131-.05.126-.051.123-.051.118-.051.114-.052.11-.052.106-.052.101-.052.096-.052.092-.052.088-.052.083-.052.079-.052.074-.051.07-.052.065-.051.06-.05.056-.051.051-.049.023-.025.023-.024.021-.025.02-.024.019-.024.018-.024.017-.024.015-.023.014-.023.013-.024.012-.022.01-.023.01-.023.008-.022.006-.022.006-.022.004-.021.004-.022.001-.021.001-.021v-4.139l-.077.054-.08.054-.083.054-.085.052-.087.053-.09.051-.093.051-.095.051-.097.05-.1.049-.102.049-.105.048-.106.047-.109.047-.111.046-.114.045-.115.044-.118.044-.12.044-.122.042-.124.042-.126.041-.128.04-.13.039-.132.039-.134.038-.135.037-.138.036-.139.036-.142.035-.143.033-.144.033-.147.033-.148.031-.15.03-.151.03-.153.028-.154.028-.156.027-.158.026-.159.025-.161.024-.162.023-.163.022-.165.021-.166.02-.167.019-.169.018-.169.017-.171.016-.173.015-.173.014-.175.013-.175.012-.177.011-.178.009-.179.009-.179.007-.181.007-.182.005-.182.004-.184.003-.184.002h-.37l-.184-.002-.184-.003-.182-.004-.182-.005-.181-.007-.179-.007-.179-.009-.178-.009-.176-.011-.176-.012-.175-.013-.173-.014-.172-.015-.171-.016-.17-.017-.169-.018-.167-.019-.166-.02-.165-.021-.163-.022-.162-.023-.161-.024-.159-.025-.157-.026-.156-.027-.155-.028-.153-.028-.151-.03-.15-.03-.148-.031-.146-.033-.145-.033-.143-.033-.141-.035-.14-.036-.137-.036-.136-.037-.134-.038-.132-.039-.13-.039-.128-.04-.126-.041-.124-.042-.122-.043-.12-.043-.117-.044-.116-.044-.113-.046-.112-.046-.109-.046-.106-.047-.105-.048-.102-.049-.1-.049-.097-.05-.095-.051-.093-.051-.09-.051-.087-.053-.085-.052-.083-.054-.08-.054-.077-.054v4.139zm0-5.666v.011l.001.02.003.022.004.021.005.022.006.021.007.022.009.023.01.022.011.023.012.023.013.023.015.023.016.024.017.024.018.023.019.024.021.025.022.024.023.024.024.025.052.05.056.05.061.05.066.051.07.051.075.052.079.051.084.052.088.052.092.052.097.052.102.052.105.051.11.052.114.051.119.051.123.051.127.05.131.05.135.05.139.049.144.048.147.048.152.047.155.046.16.045.163.045.167.043.171.043.176.042.178.04.183.04.187.038.19.037.194.036.197.034.202.033.204.032.209.03.212.028.216.027.219.025.222.024.226.021.23.02.233.018.236.017.24.014.243.012.246.01.249.008.253.006.256.003.259.001.26-.001.257-.003.254-.006.25-.008.247-.01.244-.013.241-.014.237-.016.233-.018.231-.02.226-.022.224-.024.22-.025.216-.027.212-.029.21-.03.205-.032.202-.033.198-.035.194-.036.191-.037.187-.039.183-.039.179-.041.175-.042.172-.043.168-.044.163-.045.16-.045.155-.047.152-.047.148-.048.143-.049.139-.049.136-.049.131-.051.126-.05.123-.051.118-.052.114-.051.11-.052.106-.052.101-.052.096-.052.092-.052.088-.052.083-.052.079-.052.074-.052.07-.051.065-.051.06-.051.056-.05.051-.049.023-.025.023-.025.021-.024.02-.024.019-.024.018-.024.017-.024.015-.023.014-.024.013-.023.012-.023.01-.022.01-.023.008-.022.006-.022.006-.022.004-.022.004-.021.001-.021.001-.021v-4.153l-.077.054-.08.054-.083.053-.085.053-.087.053-.09.051-.093.051-.095.051-.097.05-.1.049-.102.048-.105.048-.106.048-.109.046-.111.046-.114.046-.115.044-.118.044-.12.043-.122.043-.124.042-.126.041-.128.04-.13.039-.132.039-.134.038-.135.037-.138.036-.139.036-.142.034-.143.034-.144.033-.147.032-.148.032-.15.03-.151.03-.153.028-.154.028-.156.027-.158.026-.159.024-.161.024-.162.023-.163.023-.165.021-.166.02-.167.019-.169.018-.169.017-.171.016-.173.015-.173.014-.175.013-.175.012-.177.01-.178.01-.179.009-.179.007-.181.006-.182.006-.182.004-.184.003-.184.001-.185.001-.185-.001-.184-.001-.184-.003-.182-.004-.182-.006-.181-.006-.179-.007-.179-.009-.178-.01-.176-.01-.176-.012-.175-.013-.173-.014-.172-.015-.171-.016-.17-.017-.169-.018-.167-.019-.166-.02-.165-.021-.163-.023-.162-.023-.161-.024-.159-.024-.157-.026-.156-.027-.155-.028-.153-.028-.151-.03-.15-.03-.148-.032-.146-.032-.145-.033-.143-.034-.141-.034-.14-.036-.137-.036-.136-.037-.134-.038-.132-.039-.13-.039-.128-.041-.126-.041-.124-.041-.122-.043-.12-.043-.117-.044-.116-.044-.113-.046-.112-.046-.109-.046-.106-.048-.105-.048-.102-.048-.1-.05-.097-.049-.095-.051-.093-.051-.09-.052-.087-.052-.085-.053-.083-.053-.08-.054-.077-.054v4.153zm8.74-8.179l-.257.004-.254.005-.25.008-.247.011-.244.012-.241.014-.237.016-.233.018-.231.021-.226.022-.224.023-.22.026-.216.027-.212.028-.21.031-.205.032-.202.033-.198.034-.194.036-.191.038-.187.038-.183.04-.179.041-.175.042-.172.043-.168.043-.163.045-.16.046-.155.046-.152.048-.148.048-.143.048-.139.049-.136.05-.131.05-.126.051-.123.051-.118.051-.114.052-.11.052-.106.052-.101.052-.096.052-.092.052-.088.052-.083.052-.079.052-.074.051-.07.052-.065.051-.06.05-.056.05-.051.05-.023.025-.023.024-.021.024-.02.025-.019.024-.018.024-.017.023-.015.024-.014.023-.013.023-.012.023-.01.023-.01.022-.008.022-.006.023-.006.021-.004.022-.004.021-.001.021-.001.021.001.021.001.021.004.021.004.022.006.021.006.023.008.022.01.022.01.023.012.023.013.023.014.023.015.024.017.023.018.024.019.024.02.025.021.024.023.024.023.025.051.05.056.05.06.05.065.051.07.052.074.051.079.052.083.052.088.052.092.052.096.052.101.052.106.052.11.052.114.052.118.051.123.051.126.051.131.05.136.05.139.049.143.048.148.048.152.048.155.046.16.046.163.045.168.043.172.043.175.042.179.041.183.04.187.038.191.038.194.036.198.034.202.033.205.032.21.031.212.028.216.027.22.026.224.023.226.022.231.021.233.018.237.016.241.014.244.012.247.011.25.008.254.005.257.004.26.001.26-.001.257-.004.254-.005.25-.008.247-.011.244-.012.241-.014.237-.016.233-.018.231-.021.226-.022.224-.023.22-.026.216-.027.212-.028.21-.031.205-.032.202-.033.198-.034.194-.036.191-.038.187-.038.183-.04.179-.041.175-.042.172-.043.168-.043.163-.045.16-.046.155-.046.152-.048.148-.048.143-.048.139-.049.136-.05.131-.05.126-.051.123-.051.118-.051.114-.052.11-.052.106-.052.101-.052.096-.052.092-.052.088-.052.083-.052.079-.052.074-.051.07-.052.065-.051.06-.05.056-.05.051-.05.023-.025.023-.024.021-.024.02-.025.019-.024.018-.024.017-.023.015-.024.014-.023.013-.023.012-.023.01-.023.01-.022.008-.022.006-.023.006-.021.004-.022.004-.021.001-.021.001-.021-.001-.021-.001-.021-.004-.021-.004-.022-.006-.021-.006-.023-.008-.022-.01-.022-.01-.023-.012-.023-.013-.023-.014-.023-.015-.024-.017-.023-.018-.024-.019-.024-.02-.025-.021-.024-.023-.024-.023-.025-.051-.05-.056-.05-.06-.05-.065-.051-.07-.052-.074-.051-.079-.052-.083-.052-.088-.052-.092-.052-.096-.052-.101-.052-.106-.052-.11-.052-.114-.052-.118-.051-.123-.051-.126-.051-.131-.05-.136-.05-.139-.049-.143-.048-.148-.048-.152-.048-.155-.046-.16-.046-.163-.045-.168-.043-.172-.043-.175-.042-.179-.041-.183-.04-.187-.038-.191-.038-.194-.036-.198-.034-.202-.033-.205-.032-.21-.031-.212-.028-.216-.027-.22-.026-.224-.023-.226-.022-.231-.021-.233-.018-.237-.016-.241-.014-.244-.012-.247-.011-.25-.008-.254-.005-.257-.004-.26-.001-.26.001z%22%20transform%3D%22scale(.5)%22%2F%3E%3C%2Fsymbol%3E%3C%2Fdefs%3E%3Cdefs%3E%3Csymbol%20height%3D%2224%22%20width%3D%2224%22%20id%3D%22clock%22%3E%3Cpath%20d%3D%22M12%202c5.514%200%2010%204.486%2010%2010s-4.486%2010-10%2010-10-4.486-10-10%204.486-10%2010-10zm0-2c-6.627%200-12%205.373-12%2012s5.373%2012%2012%2012%2012-5.373%2012-12-5.373-12-12-12zm5.848%2012.459c.202.038.202.333.001.372-1.907.361-6.045%201.111-6.547%201.111-.719%200-1.301-.582-1.301-1.301%200-.512.77-5.447%201.125-7.445.034-.192.312-.181.343.014l.985%206.238%205.394%201.011z%22%20transform%3D%22scale(.5)%22%2F%3E%3C%2Fsymbol%3E%3C%2Fdefs%3E%3Cdefs%3E%3Cmarker%20orient%3D%22auto%22%20markerHeight%3D%2212%22%20markerWidth%3D%2212%22%20markerUnits%3D%22userSpaceOnUse%22%20refY%3D%225%22%20refX%3D%227.9%22%20id%3D%22arrowhead%22%3E%3Cpath%20d%3D%22M%200%200%20L%2010%205%20L%200%2010%20z%22%2F%3E%3C%2Fmarker%3E%3C%2Fdefs%3E%3Cdefs%3E%3Cmarker%20refY%3D%224.5%22%20refX%3D%224%22%20orient%3D%22auto%22%20markerHeight%3D%228%22%20markerWidth%3D%2215%22%20id%3D%22crosshead%22%3E%3Cpath%20style%3D%22stroke-dasharray%3A%200%2C%200%3B%22%20d%3D%22M%201%2C2%20L%206%2C7%20M%206%2C2%20L%201%2C7%22%20stroke-width%3D%221pt%22%20stroke%3D%22%23000000%22%20fill%3D%22none%22%2F%3E%3C%2Fmarker%3E%3C%2Fdefs%3E%3Cdefs%3E%3Cmarker%20orient%3D%22auto%22%20markerHeight%3D%2228%22%20markerWidth%3D%2220%22%20refY%3D%227%22%20refX%3D%2215.5%22%20id%3D%22filled-head%22%3E%3Cpath%20d%3D%22M%2018%2C7%20L9%2C13%20L14%2C7%20L9%2C1%20Z%22%2F%3E%3C%2Fmarker%3E%3C%2Fdefs%3E%3Cdefs%3E%3Cmarker%20orient%3D%22auto%22%20markerHeight%3D%2240%22%20markerWidth%3D%2260%22%20refY%3D%2215%22%20refX%3D%2215%22%20id%3D%22sequencenumber%22%3E%3Ccircle%20r%3D%226%22%20cy%3D%2215%22%20cx%3D%2215%22%2F%3E%3C%2Fmarker%3E%3C%2Fdefs%3E%3Cg%3E%3Cline%20class%3D%22loopLine%22%20y2%3D%22291%22%20x2%3D%221346%22%20y1%3D%22291%22%20x1%3D%2264%22%2F%3E%3Cline%20class%3D%22loopLine%22%20y2%3D%22563%22%20x2%3D%221346%22%20y1%3D%22291%22%20x1%3D%221346%22%2F%3E%3Cline%20class%3D%22loopLine%22%20y2%3D%22563%22%20x2%3D%221346%22%20y1%3D%22563%22%20x1%3D%2264%22%2F%3E%3Cline%20class%3D%22loopLine%22%20y2%3D%22563%22%20x2%3D%2264%22%20y1%3D%22291%22%20x1%3D%2264%22%2F%3E%3Cpolygon%20class%3D%22labelBox%22%20points%3D%2264%2C291%20114%2C291%20114%2C304%20105.6%2C311%2064%2C311%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22labelText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22304%22%20x%3D%2289%22%3Eloop%3C%2Ftext%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20class%3D%22loopText%22%20text-anchor%3D%22middle%22%20y%3D%22309%22%20x%3D%22730%22%3E%3Ctspan%20x%3D%22730%22%3E%5B%E6%B5%81%E5%BC%8F%E5%93%8D%E5%BA%94%5D%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%2280%22%20x%3D%22189%22%3E%E8%BE%93%E5%85%A5%E4%BB%BB%E5%8A%A1%E6%8F%8F%E8%BF%B0%3C%2Ftext%3E%3Cline%20style%3D%22fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine0%22%20y2%3D%22113%22%20x2%3D%22301%22%20y1%3D%22113%22%20x1%3D%2276%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22128%22%20x%3D%22518%22%3EprocessProgress(sessionId%2C%20requestId%2C%20message)%3C%2Ftext%3E%3Cline%20style%3D%22fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine0%22%20y2%3D%22169%22%20x2%3D%22729%22%20y1%3D%22169%22%20x1%3D%22306%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22184%22%20x%3D%22913%22%3EsendRequestToExtension(ASK_AGENT)%3C%2Ftext%3E%3Cline%20style%3D%22fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine0%22%20y2%3D%22225%22%20x2%3D%221091%22%20y1%3D%22225%22%20x1%3D%22734%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22240%22%20x%3D%221214%22%3EHTTP%2FgRPC%20%E8%B0%83%E7%94%A8%3C%2Ftext%3E%3Cline%20style%3D%22fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine0%22%20y2%3D%22281%22%20x2%3D%221331%22%20y1%3D%22281%22%20x1%3D%221096%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22344%22%20x%3D%221217%22%3EToken%20%E6%B5%81%3C%2Ftext%3E%3Cline%20style%3D%22stroke-dasharray%3A%203%2C%203%3B%20fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine1%22%20y2%3D%22385%22%20x2%3D%221099%22%20y1%3D%22385%22%20x1%3D%221334%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22400%22%20x%3D%22916%22%3ECHAT_PROGRESS%20%E9%80%9A%E7%9F%A5%3C%2Ftext%3E%3Cline%20style%3D%22stroke-dasharray%3A%203%2C%203%3B%20fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine1%22%20y2%3D%22441%22%20x2%3D%22737%22%20y1%3D%22441%22%20x1%3D%221094%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22456%22%20x%3D%22521%22%3EonProgressUpdate.fire()%3C%2Ftext%3E%3Cline%20style%3D%22stroke-dasharray%3A%203%2C%203%3B%20fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine1%22%20y2%3D%22497%22%20x2%3D%22309%22%20y1%3D%22497%22%20x1%3D%22732%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22512%22%20x%3D%22192%22%3E%E5%AE%9E%E6%97%B6%E6%9B%B4%E6%96%B0%20UI%3C%2Ftext%3E%3Cline%20style%3D%22stroke-dasharray%3A%203%2C%203%3B%20fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine1%22%20y2%3D%22553%22%20x2%3D%2279%22%20y1%3D%22553%22%20x1%3D%22304%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22578%22%20x%3D%221217%22%3E%E5%AE%8C%E6%88%90%E4%BF%A1%E5%8F%B7%3C%2Ftext%3E%3Cline%20style%3D%22stroke-dasharray%3A%203%2C%203%3B%20fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine1%22%20y2%3D%22611%22%20x2%3D%221099%22%20y1%3D%22611%22%20x1%3D%221334%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22626%22%20x%3D%22916%22%3ECHAT_FINISH%20%E9%80%9A%E7%9F%A5%3C%2Ftext%3E%3Cline%20style%3D%22stroke-dasharray%3A%203%2C%203%3B%20fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine1%22%20y2%3D%22667%22%20x2%3D%22737%22%20y1%3D%22667%22%20x1%3D%221094%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22682%22%20x%3D%22521%22%3EonChatFinish.fire()%3C%2Ftext%3E%3Cline%20style%3D%22stroke-dasharray%3A%203%2C%203%3B%20fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine1%22%20y2%3D%22723%22%20x2%3D%22309%22%20y1%3D%22723%22%20x1%3D%22732%22%2F%3E%3Ctext%20style%3D%22font-size%3A%2016px%3B%20font-weight%3A%20400%3B%22%20dy%3D%221em%22%20class%3D%22messageText%22%20alignment-baseline%3D%22middle%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20y%3D%22738%22%20x%3D%22192%22%3E%E6%98%BE%E7%A4%BA%E5%AE%8C%E6%88%90%E7%8A%B6%E6%80%81%3C%2Ftext%3E%3Cline%20style%3D%22stroke-dasharray%3A%203%2C%203%3B%20fill%3A%20none%3B%22%20marker-end%3D%22url(%23arrowhead)%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20class%3D%22messageLine1%22%20y2%3D%22771%22%20x2%3D%2279%22%20y1%3D%22771%22%20x1%3D%22304%22%2F%3E%3C%2Fsvg%3E)

关键事件监听器（源码： `workbench.desktop.main.js:39150` ）：

\_setupMessageListeners() {

// 1. 监听会话进度更新

this.\_register(this.sessionManager.onSessionChange(({sessionId, stream, progress}) => {

this.\_onProgressUpdate.fire({

sessionId,

requestId: stream.requestId,

progress

});

}));

// 2. 监听聊天完成事件

this.\_register(this.aiCodingService.onNotification(Y6.CHAT\_FINISH, ({params: t}) => {

const n = t;

this.\_onChatFinish.fire(n);

n.sessionId && this.sessionManager.processProgress({

kind: "finish",

sessionId: n.sessionId,

requestId: n.requestId,

data: n,

timestamp: Date.now()

});

}));

// 3. 监听进度通知

this.\_register(this.aiCodingService.onNotification(Y6.CHAT\_PROGRESS, ({params: t}) => {

const n = t;

this.sessionManager.processProgress(n);

}));

}

---

## 三、SubAgent 生命周期管理

### 3.1 七状态状态机

Qoder 为每个 SubAgent 定义了完整的生命周期状态机：

enum SubAgentStatus {

INIT = "init", // 初始化中

RUNNING = "running", // 执行中

PENDING = "pending", // 等待用户确认

COMPLETED = "completed", // 成功完成

FAILED = "failed", // 执行失败

CANCELLED = "cancelled", // 用户取消

SKIPPED = "skipped" // 被跳过（条件不满足）

}

状态流转图：

文本绘图

视图

stateDiagram-v2

\[\*\] --> INIT

INIT --> RUNNING: 开始执行

RUNNING --> PENDING: 需要确认

PENDING --> RUNNING: 用户确认

PENDING --> CANCELLED: 用户取消

RUNNING --> COMPLETED: 成功

RUNNING --> FAILED: 错误

RUNNING --> CANCELLED: 用户中断

RUNNING --> SKIPPED: 条件不满足

COMPLETED --> \[\*\]

FAILED --> \[\*\]

CANCELLED --> \[\*\]

SKIPPED --> \[\*\]

![](data:image/svg+xml;utf8,%3Csvg%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20aria-roledescription%3D%22stateDiagram%22%20role%3D%22graphics-document%20document%22%20viewBox%3D%220%200%20604.146484375%20522%22%20style%3D%22max-width%3A%20604.146484375px%3B%22%20class%3D%22statediagram%22%20width%3D%22604.146484375%22%20id%3D%22text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%22%20height%3D%22522%22%3E%3Cstyle%3E%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%7Bfont-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3Bfont-size%3A16px%3Bfill%3A%23333%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.error-icon%7Bfill%3A%23552222%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.error-text%7Bfill%3A%23552222%3Bstroke%3A%23552222%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.edge-thickness-normal%7Bstroke-width%3A2px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.edge-thickness-thick%7Bstroke-width%3A3.5px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.edge-pattern-solid%7Bstroke-dasharray%3A0%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.edge-pattern-dashed%7Bstroke-dasharray%3A3%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.edge-pattern-dotted%7Bstroke-dasharray%3A2%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.marker%7Bfill%3A%23333333%3Bstroke%3A%23333333%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.marker.cross%7Bstroke%3A%23333333%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20svg%7Bfont-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3Bfont-size%3A16px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20defs%20%23statediagram-barbEnd%7Bfill%3A%23333333%3Bstroke%3A%23333333%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20g.stateGroup%20text%7Bfill%3A%239370DB%3Bstroke%3Anone%3Bfont-size%3A10px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20g.stateGroup%20text%7Bfill%3A%23333%3Bstroke%3Anone%3Bfont-size%3A10px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20g.stateGroup%20.state-title%7Bfont-weight%3Abolder%3Bfill%3A%23131300%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20g.stateGroup%20rect%7Bfill%3A%23ECECFF%3Bstroke%3A%239370DB%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20g.stateGroup%20line%7Bstroke%3A%23333333%3Bstroke-width%3A1%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.transition%7Bstroke%3A%23333333%3Bstroke-width%3A1%3Bfill%3Anone%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.stateGroup%20.composit%7Bfill%3Awhite%3Bborder-bottom%3A1px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.stateGroup%20.alt-composit%7Bfill%3A%23e0e0e0%3Bborder-bottom%3A1px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.state-note%7Bstroke%3A%23aaaa33%3Bfill%3A%23fff5ad%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.state-note%20text%7Bfill%3Ablack%3Bstroke%3Anone%3Bfont-size%3A10px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.stateLabel%20.box%7Bstroke%3Anone%3Bstroke-width%3A0%3Bfill%3A%23ECECFF%3Bopacity%3A0.5%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.edgeLabel%20.label%20rect%7Bfill%3A%23ECECFF%3Bopacity%3A0.5%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.edgeLabel%20.label%20text%7Bfill%3A%23333%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.label%20div%20.edgeLabel%7Bcolor%3A%23333%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.stateLabel%20text%7Bfill%3A%23131300%3Bfont-size%3A10px%3Bfont-weight%3Abold%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.node%20circle.state-start%7Bfill%3A%23333333%3Bstroke%3A%23333333%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.node%20.fork-join%7Bfill%3A%23333333%3Bstroke%3A%23333333%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.node%20circle.state-end%7Bfill%3A%239370DB%3Bstroke%3Awhite%3Bstroke-width%3A1.5%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.end-state-inner%7Bfill%3Awhite%3Bstroke-width%3A1.5%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.node%20rect%7Bfill%3A%23ECECFF%3Bstroke%3A%239370DB%3Bstroke-width%3A1px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.node%20polygon%7Bfill%3A%23ECECFF%3Bstroke%3A%239370DB%3Bstroke-width%3A1px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20%23statediagram-barbEnd%7Bfill%3A%23333333%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-cluster%20rect%7Bfill%3A%23ECECFF%3Bstroke%3A%239370DB%3Bstroke-width%3A1px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.cluster-label%2C%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.nodeLabel%7Bcolor%3A%23131300%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-cluster%20rect.outer%7Brx%3A5px%3Bry%3A5px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-state%20.divider%7Bstroke%3A%239370DB%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-state%20.title-state%7Brx%3A5px%3Bry%3A5px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-cluster.statediagram-cluster%20.inner%7Bfill%3Awhite%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-cluster.statediagram-cluster-alt%20.inner%7Bfill%3A%23f0f0f0%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-cluster%20.inner%7Brx%3A0%3Bry%3A0%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-state%20rect.basic%7Brx%3A5px%3Bry%3A5px%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-state%20rect.divider%7Bstroke-dasharray%3A10%2C10%3Bfill%3A%23f0f0f0%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.note-edge%7Bstroke-dasharray%3A5%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-note%20rect%7Bfill%3A%23fff5ad%3Bstroke%3A%23aaaa33%3Bstroke-width%3A1px%3Brx%3A0%3Bry%3A0%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-note%20rect%7Bfill%3A%23fff5ad%3Bstroke%3A%23aaaa33%3Bstroke-width%3A1px%3Brx%3A0%3Bry%3A0%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-note%20text%7Bfill%3Ablack%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram-note%20.nodeLabel%7Bcolor%3Ablack%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagram%20.edgeLabel%7Bcolor%3Ared%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20%23dependencyStart%2C%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20%23dependencyEnd%7Bfill%3A%23333333%3Bstroke%3A%23333333%3Bstroke-width%3A1%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20.statediagramTitleText%7Btext-anchor%3Amiddle%3Bfont-size%3A18px%3Bfill%3A%23333%3B%7D%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146%20%3Aroot%7B--mermaid-font-family%3A%22trebuchet%20ms%22%2Cverdana%2Carial%2Csans-serif%3B%7D%3C%2Fstyle%3E%3Cg%3E%3Cdefs%3E%3Cmarker%20orient%3D%22auto%22%20markerUnits%3D%22strokeWidth%22%20markerHeight%3D%2214%22%20markerWidth%3D%2220%22%20refY%3D%227%22%20refX%3D%2219%22%20id%3D%22text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd%22%3E%3Cpath%20d%3D%22M%2019%2C7%20L9%2C13%20L14%2C7%20L9%2C1%20Z%22%2F%3E%3C%2Fmarker%3E%3C%2Fdefs%3E%3Cg%20class%3D%22root%22%3E%3Cg%20class%3D%22clusters%22%2F%3E%3Cg%20class%3D%22edgePaths%22%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge0%22%20d%3D%22M321.764%2C22L321.764%2C26.167C321.764%2C30.333%2C321.764%2C38.667%2C321.764%2C47C321.764%2C55.333%2C321.764%2C63.667%2C321.764%2C67.833L321.764%2C72%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge1%22%20d%3D%22M321.764%2C111L321.764%2C117.167C321.764%2C123.333%2C321.764%2C135.667%2C321.764%2C148C321.764%2C160.333%2C321.764%2C172.667%2C321.764%2C178.833L321.764%2C185%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge2%22%20d%3D%22M307.268%2C224L302.684%2C230.167C298.1%2C236.333%2C288.932%2C248.667%2C288.932%2C261C288.932%2C273.333%2C298.1%2C285.667%2C302.684%2C291.833L307.268%2C298%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge3%22%20d%3D%22M336.259%2C298L340.843%2C291.833C345.427%2C285.667%2C354.596%2C273.333%2C354.596%2C261C354.596%2C248.667%2C345.427%2C236.333%2C340.843%2C230.167L336.259%2C224%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge4%22%20d%3D%22M321.764%2C337L321.764%2C343.167C321.764%2C349.333%2C321.764%2C361.667%2C327.548%2C374C333.333%2C386.333%2C344.902%2C398.667%2C350.687%2C404.833L356.472%2C411%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge5%22%20d%3D%22M281.467%2C213.131L244.22%2C221.109C206.973%2C229.088%2C132.479%2C245.044%2C95.231%2C262.439C57.984%2C279.833%2C57.984%2C298.667%2C57.984%2C317.5C57.984%2C336.333%2C57.984%2C355.167%2C57.984%2C370.75C57.984%2C386.333%2C57.984%2C398.667%2C57.984%2C404.833L57.984%2C411%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge6%22%20d%3D%22M281.467%2C221.65L266.057%2C228.208C250.647%2C234.767%2C219.827%2C247.883%2C204.418%2C263.858C189.008%2C279.833%2C189.008%2C298.667%2C189.008%2C317.5C189.008%2C336.333%2C189.008%2C355.167%2C189.008%2C370.75C189.008%2C386.333%2C189.008%2C398.667%2C189.008%2C404.833L189.008%2C411%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge7%22%20d%3D%22M362.061%2C223.316L375.511%2C229.597C388.962%2C235.878%2C415.863%2C248.439%2C429.313%2C264.136C442.764%2C279.833%2C442.764%2C298.667%2C442.764%2C317.5C442.764%2C336.333%2C442.764%2C355.167%2C435.342%2C370.75C427.92%2C386.333%2C413.076%2C398.667%2C405.655%2C404.833L398.233%2C411%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge8%22%20d%3D%22M362.061%2C214.214L394.408%2C222.012C426.756%2C229.809%2C491.451%2C245.405%2C523.799%2C262.619C556.146%2C279.833%2C556.146%2C298.667%2C556.146%2C317.5C556.146%2C336.333%2C556.146%2C355.167%2C556.146%2C370.75C556.146%2C386.333%2C556.146%2C398.667%2C556.146%2C404.833L556.146%2C411%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge9%22%20d%3D%22M57.984%2C450L57.984%2C454.167C57.984%2C458.333%2C57.984%2C466.667%2C98.831%2C476.02C139.677%2C485.373%2C221.371%2C495.746%2C262.217%2C500.932L303.064%2C506.118%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge10%22%20d%3D%22M189.008%2C450L189.008%2C454.167C189.008%2C458.333%2C189.008%2C466.667%2C208.047%2C475.868C227.085%2C485.07%2C265.163%2C495.14%2C284.202%2C500.175L303.24%2C505.21%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge11%22%20d%3D%22M374.764%2C450L374.764%2C454.167C374.764%2C458.333%2C374.764%2C466.667%2C365.017%2C475.65C355.27%2C484.633%2C335.777%2C494.266%2C326.03%2C499.082L316.283%2C503.899%22%2F%3E%3Cpath%20marker-end%3D%22url(%23text-diagram-ff329623-90f1-40b0-8467-7d250647a5af-44146_statediagram-barbEnd)%22%20style%3D%22fill%3Anone%22%20class%3D%22edge-thickness-normal%20transition%22%20id%3D%22edge12%22%20d%3D%22M556.146%2C450L556.146%2C454.167C556.146%2C458.333%2C556.146%2C466.667%2C516.28%2C476.016C476.414%2C485.366%2C396.682%2C495.732%2C356.816%2C500.915L316.949%2C506.098%22%2F%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabels%22%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(0%2C%200)%22%20class%3D%22label%22%3E%3Crect%20height%3D%220%22%20width%3D%220%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(321.763671875%2C%20148)%22%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(-32%2C%20-12)%22%20class%3D%22label%22%3E%3Crect%20height%3D%2224%22%20width%3D%2264%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2264%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%E5%BC%80%E5%A7%8B%E6%89%A7%E8%A1%8C%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(279.763671875%2C%20261)%22%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(-32%2C%20-12)%22%20class%3D%22label%22%3E%3Crect%20height%3D%2224%22%20width%3D%2264%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2264%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%E9%9C%80%E8%A6%81%E7%A1%AE%E8%AE%A4%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(363.763671875%2C%20261)%22%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(-32%2C%20-12)%22%20class%3D%22label%22%3E%3Crect%20height%3D%2224%22%20width%3D%2264%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2264%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%E7%94%A8%E6%88%B7%E7%A1%AE%E8%AE%A4%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(321.763671875%2C%20374)%22%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(-32%2C%20-12)%22%20class%3D%22label%22%3E%3Crect%20height%3D%2224%22%20width%3D%2264%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2264%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%E7%94%A8%E6%88%B7%E5%8F%96%E6%B6%88%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(57.984375%2C%20317.5)%22%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(-16%2C%20-12)%22%20class%3D%22label%22%3E%3Crect%20height%3D%2224%22%20width%3D%2232%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2232%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%E6%88%90%E5%8A%9F%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(189.0078125%2C%20317.5)%22%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(-16%2C%20-12)%22%20class%3D%22label%22%3E%3Crect%20height%3D%2224%22%20width%3D%2232%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2232%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%E9%94%99%E8%AF%AF%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(442.763671875%2C%20317.5)%22%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(-32%2C%20-12)%22%20class%3D%22label%22%3E%3Crect%20height%3D%2224%22%20width%3D%2264%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2264%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%E7%94%A8%E6%88%B7%E4%B8%AD%E6%96%AD%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(556.146484375%2C%20317.5)%22%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(-40%2C%20-12)%22%20class%3D%22label%22%3E%3Crect%20height%3D%2224%22%20width%3D%2280%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2280%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%E6%9D%A1%E4%BB%B6%E4%B8%8D%E6%BB%A1%E8%B6%B3%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(0%2C%200)%22%20class%3D%22label%22%3E%3Crect%20height%3D%220%22%20width%3D%220%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(0%2C%200)%22%20class%3D%22label%22%3E%3Crect%20height%3D%220%22%20width%3D%220%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(0%2C%200)%22%20class%3D%22label%22%3E%3Crect%20height%3D%220%22%20width%3D%220%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20transform%3D%22translate(0%2C%200)%22%20class%3D%22label%22%3E%3Crect%20height%3D%220%22%20width%3D%220%22%20ry%3D%220%22%20rx%3D%220%22%2F%3E%3CforeignObject%20height%3D%220%22%20width%3D%220%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22edgeLabel%22%3E%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22nodes%22%3E%3Cg%20transform%3D%22translate(321.763671875%2C%2015)%22%20data-id%3D%22root_start%22%20data-node%3D%22true%22%20id%3D%22state-root_start-0%22%20class%3D%22node%20default%22%3E%3Ccircle%20height%3D%2214%22%20width%3D%2214%22%20r%3D%227%22%20class%3D%22state-start%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(321.763671875%2C%2091.5)%22%20data-id%3D%22INIT%22%20data-node%3D%22true%22%20id%3D%22state-INIT-1%22%20class%3D%22node%20%20statediagram-state%20undefined%22%3E%3Crect%20height%3D%2239%22%20width%3D%2243.40625%22%20y%3D%22-19.5%22%20x%3D%22-21.703125%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%2F%3E%3Cg%20transform%3D%22translate(-14.203125%2C%20-12)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2228.40625%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22nodeLabel%22%3EINIT%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(321.763671875%2C%20204.5)%22%20data-id%3D%22RUNNING%22%20data-node%3D%22true%22%20id%3D%22state-RUNNING-8%22%20class%3D%22node%20%20statediagram-state%20undefined%22%3E%3Crect%20height%3D%2239%22%20width%3D%2280.59375%22%20y%3D%22-19.5%22%20x%3D%22-40.296875%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%2F%3E%3Cg%20transform%3D%22translate(-32.796875%2C%20-12)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2265.59375%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22nodeLabel%22%3ERUNNING%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(321.763671875%2C%20317.5)%22%20data-id%3D%22PENDING%22%20data-node%3D%22true%22%20id%3D%22state-PENDING-4%22%20class%3D%22node%20%20statediagram-state%20undefined%22%3E%3Crect%20height%3D%2239%22%20width%3D%2278%22%20y%3D%22-19.5%22%20x%3D%22-39%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%2F%3E%3Cg%20transform%3D%22translate(-31.5%2C%20-12)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2263%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22nodeLabel%22%3EPENDING%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(374.763671875%2C%20430.5)%22%20data-id%3D%22CANCELLED%22%20data-node%3D%22true%22%20id%3D%22state-CANCELLED-11%22%20class%3D%22node%20%20statediagram-state%20undefined%22%3E%3Crect%20height%3D%2239%22%20width%3D%2296.9453125%22%20y%3D%22-19.5%22%20x%3D%22-48.47265625%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%2F%3E%3Cg%20transform%3D%22translate(-40.97265625%2C%20-12)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2281.9453125%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22nodeLabel%22%3ECANCELLED%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(57.984375%2C%20430.5)%22%20data-id%3D%22COMPLETED%22%20data-node%3D%22true%22%20id%3D%22state-COMPLETED-9%22%20class%3D%22node%20%20statediagram-state%20undefined%22%3E%3Crect%20height%3D%2239%22%20width%3D%2299.96875%22%20y%3D%22-19.5%22%20x%3D%22-49.984375%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%2F%3E%3Cg%20transform%3D%22translate(-42.484375%2C%20-12)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2284.96875%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22nodeLabel%22%3ECOMPLETED%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(189.0078125%2C%20430.5)%22%20data-id%3D%22FAILED%22%20data-node%3D%22true%22%20id%3D%22state-FAILED-10%22%20class%3D%22node%20%20statediagram-state%20undefined%22%3E%3Crect%20height%3D%2239%22%20width%3D%2262.078125%22%20y%3D%22-19.5%22%20x%3D%22-31.0390625%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%2F%3E%3Cg%20transform%3D%22translate(-23.5390625%2C%20-12)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2247.078125%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22nodeLabel%22%3EFAILED%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(556.146484375%2C%20430.5)%22%20data-id%3D%22SKIPPED%22%20data-node%3D%22true%22%20id%3D%22state-SKIPPED-12%22%20class%3D%22node%20%20statediagram-state%20undefined%22%3E%3Crect%20height%3D%2239%22%20width%3D%2272.5859375%22%20y%3D%22-19.5%22%20x%3D%22-36.29296875%22%20style%3D%22%22%20class%3D%22basic%20label-container%22%2F%3E%3Cg%20transform%3D%22translate(-28.79296875%2C%20-12)%22%20style%3D%22%22%20class%3D%22label%22%3E%3Crect%2F%3E%3CforeignObject%20height%3D%2224%22%20width%3D%2257.5859375%22%3E%3Cdiv%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxhtml%22%20style%3D%22display%3A%20inline-block%3B%20white-space%3A%20nowrap%3B%22%3E%3Cspan%20class%3D%22nodeLabel%22%3ESKIPPED%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2FforeignObject%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(310.0078125%2C%20507)%22%20data-id%3D%22root_end%22%20data-node%3D%22true%22%20id%3D%22state-root_end-12%22%20class%3D%22node%20default%22%3E%3Ccircle%20height%3D%2214%22%20width%3D%2214%22%20r%3D%227%22%20class%3D%22state-start%22%2F%3E%3Ccircle%20height%3D%2210%22%20width%3D%2210%22%20r%3D%225%22%20class%3D%22state-end%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E)

UI 状态指示器样式（源码： `workbench.desktop.main.js:17048` ）：

.sub-agent-status--init.sub-agent-status-indicator { /\* 蓝色旋转图标 \*/ }

.sub-agent-status--running.sub-agent-status-indicator { /\* 蓝色脉冲动画 \*/ }

.sub-agent-status--pending.sub-agent-status-indicator { /\* 黄色等待图标 \*/ }

.sub-agent-status--completed.sub-agent-status-indicator { /\* 绿色对勾 \*/ }

.sub-agent-status--failed.sub-agent-status-indicator { /\* 红色叉号 \*/ }

.sub-agent-status--cancelled.sub-agent-status-indicator { /\* 灰色停止图标 \*/ }

.sub-agent-status--skipped.sub-agent-status-indicator { /\* 灰色跳过图标 \*/ }

---

### 3.2 SubAgentCard UI 组件体系

Qoder 实现了三种 SubAgent 卡片视图模式，适配不同场景：

<table><colgroup><col width="162"> <col width="162"> <col width="162"> <col width="162"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>视图模式</p></td><td rowspan="1" colspan="1"><p>CSS 类名</p></td><td rowspan="1" colspan="1"><p>使用场景</p></td><td rowspan="1" colspan="1"><p>特点</p></td></tr><tr><td rowspan="1" colspan="1"><p>标准卡片</p></td><td rowspan="1" colspan="1"><div><code>.sub-agent-card</code></div></td><td rowspan="1" colspan="1"><p>聊天面板嵌入</p></td><td rowspan="1" colspan="1"><p>完整信息展示，带滚动条</p></td></tr><tr><td rowspan="1" colspan="1"><p>紧凑卡片</p></td><td rowspan="1" colspan="1"><div><code>.sub-agent-card--compact</code></div></td><td rowspan="1" colspan="1"><p>多任务并列</p></td><td rowspan="1" colspan="1"><p>折叠正文，hover 展开标题</p></td></tr><tr><td rowspan="1" colspan="1"><p>全屏模态</p></td><td rowspan="1" colspan="1"><div><code>.subagent-fullscreen-modal-content</code></div></td><td rowspan="1" colspan="1"><p>复杂任务专注</p></td><td rowspan="1" colspan="1"><p>独立窗口，完整工具栏</p></td></tr><tr><td rowspan="1" colspan="1"><p>编辑器视图</p></td><td rowspan="1" colspan="1"><div><code>.subagent-editor-view</code></div></td><td rowspan="1" colspan="1"><p>代码编辑集成</p></td><td rowspan="1" colspan="1"><p>与 Diff 视图结合</p></td></tr></tbody></table>

关键 UI 组件层次：

.sub-agent-card

├──.sub-agent-header

│ ├──.sub-agent-header\_\_main

│ │ ├──.sub-agent-icon

│ │ ├──.sub-agent-name

│ │ └──.sub-agent-fullscreen-btn

│ └──.sub-agent-header\_\_sub

│ ├──.sub-agent-title

│ └──.sub-agent-status-indicator-container

├──.sub-agent-body

│ └──.sub-agent-body-scrollbar

│ └── (消息内容：tool\_call / markdownContent)

└──.sub-agent-footer

└──.tool-content-footer-btn-group

源码位置：

●

标准卡片样式： `workbench.desktop.main.js:15468-15709`

●

紧凑卡片样式： `workbench.desktop.main.js:16980-17043`

●

全屏模态样式： `workbench.desktop.main.js:19779-19920`

●

编辑器视图样式： `workbench.desktop.main.js:19926-20141`

---

## 四、Tool Call 消息协议

### 4.1 消息类型定义

Qoder 的 Agent 通信基于标准的 LLM 工具调用协议，核心消息类型包括：

type Message =

| { type: "user\_message", content: string }

| { type: "assistant\_message", content: string }

| { type: "tool\_call", id: string, name: string, arguments: object }

| { type: "tool\_result", tool\_call\_id: string, result: any, error?: string }

| { type: "system\_notification", event: string, data: any };

关键处理逻辑（源码： `workbench.desktop.main.js:3131` ）：

class Hzi { // 基础折叠策略类

constructor() {

this.name = "base";

this.supportedSessionTypes = \[Zr.ASSISTANT, Zr.QUEST\];

}

shouldFoldBlock(e, t, n, r) {

const { config: i } = t;

// tool\_call 类型消息自动折叠

if (e.type === "tool\_call") {

const o = i?.find(c => c.toolId === e.toolId);

return o?.autoFold??!0;

}

return!1;

}

}

设计意图：

●

自动折叠工具调用：避免冗长的 JSON 参数干扰阅读

●

可配置策略：通过 `config.autoFold` 字段控制折叠行为

●

会话类型感知：QUEST 和 ASSISTANT 模式共享同一折叠策略

---

### 4.2 Tool Result 渲染流程

当 SubAgent 返回工具调用结果时，Qoder 按以下流程渲染：

1.

接收通知： `aiCodingService.onNotification(Y6.CHAT_PROGRESS)`

2.

更新会话流： `sessionManager.processProgress(progress)`

3.

触发事件： `sessionManager._onSessionChange.fire()`

4.

UI 刷新： `ChatViewManagerService` 监听并更新 React 组件

5.

Markdown 解析：将 `tool_result` 转换为富文本展示

关键代码片段（源码： `workbench.desktop.main.js:39150` ）：

processProgress(e) {

let t = this.sessions.get(e.sessionId);

// 创建新会话流（如果不存在）

if (!t) {

t = new pV1(e.sessionId, e.requestId);

this.sessions.set(e.sessionId, t);

// 注册变更监听

this.\_register(t.onDidChange(n => {

this.\_onSessionChange.fire({

sessionId: n.sessionId,

stream: t,

progress: n

});

}));

}

// 更新内容

t.updateContent(e);

// 清理完成的会话

e.kind === "finish" && this.cleanupSession(e.sessionId);

}

---

## 五、MCP 集成线索

### 5.1 MCP Server 配置界面

Qoder 内置了 MCP（Model Context Protocol）市场功能，允许用户安装和管理 MCP Server：

UI 配置项（源码： `workbench.desktop.main.js:745-748` ）：

{

"application.config.mcp.marketplace.install": "安装",

"application.config.mcp.marketplace.installing": "安装中",

"application.config.subagent.title": "自定义智能体",

"application.config.subagent.loading": "Loading subagents..."

}

配置页面路径：

●

MCP 市场： `application.config.mcp.marketplace`

●

SubAgent 管理： `application.config.subagent`

---

### 5.2 MCP 工具调用限制

尽管 Qoder 支持 MCP 协议，但从源码分析来看：

1.

浅层集成：仅提供了安装/卸载 UI，未深入实现 MCP 工具动态加载

2.

静态注册：工具列表在启动时预加载，不支持运行时热插拔

3.

权限控制：缺少细粒度的工具调用权限管理（对比 VS Code Copilot）

改进建议：

●

实现 MCP STDIO/HTTP 传输层动态连接器

●

增加工具调用前的二次确认机制

●

提供工具调用日志审计功能

---

## 六、逆向工程方法论

### 6.1 三大分析方案对比

基于本次 Qoder 源码分析实践，总结出三种有效的逆向工程方法：

<table><colgroup><col width="130"> <col width="130"> <col width="130"> <col width="130"> <col width="130"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>方法</p></td><td rowspan="1" colspan="1"><p>适用场景</p></td><td rowspan="1" colspan="1"><p>优点</p></td><td rowspan="1" colspan="1"><p>缺点</p></td><td rowspan="1" colspan="1"><p>推荐指数</p></td></tr><tr><td rowspan="1" colspan="1"><p>Studio 监测法</p></td><td rowspan="1" colspan="1"><p>运行时行为分析</p></td><td rowspan="1" colspan="1"><p>真实执行轨迹、无需反编译</p></td><td rowspan="1" colspan="1"><p>需要环境搭建、只能观测已发生行为</p></td><td rowspan="1" colspan="1"><p>⭐⭐⭐⭐⭐</p></td></tr><tr><td rowspan="1" colspan="1"><p>网络抓包法</p></td><td rowspan="1" colspan="1"><p>协议分析</p></td><td rowspan="1" colspan="1"><p>清晰的消息格式、可重现</p></td><td rowspan="1" colspan="1"><p>无法获取客户端内部逻辑、HTTPS 解密复杂</p></td><td rowspan="1" colspan="1"><p>⭐⭐⭐⭐</p></td></tr><tr><td rowspan="1" colspan="1"><p>行为实验法</p></td><td rowspan="1" colspan="1"><p>黑盒测试</p></td><td rowspan="1" colspan="1"><p>简单直接、无需技术门槛</p></td><td rowspan="1" colspan="1"><p>效率低、只能推测内部逻辑</p></td><td rowspan="1" colspan="1"><p>⭐⭐⭐</p></td></tr></tbody></table>

推荐工作流：

1.

第一步：使用 Studio 录制典型任务的执行轨迹（如"创建一个 SubAgent"）

2.

第二步：分析录制的 `tool_call` 消息序列，提取关键字段

3.

第三步：针对可疑行为设计实验（如传入非法 `subagentType` ）

4.

第四步：交叉验证反编译代码与实验结果

---

### 6.2 关键调试技巧

技巧一：利用错误消息定位

// 当 subagentType 不存在时，会输出警告日志

this.logService.warn(\`RunSubagentTool: Agent '${o.subagentType}' not found\`);

→ 可在控制台搜索此关键词，快速定位调用栈

技巧二：追踪 SessionId 血缘

// 每个请求都携带 sessionId 和 requestId

const p = {

sessionId: t.context.sessionId,

requestId: t.callId?? \`subagent-${Date.now()}\`

};

→ 通过日志关联同一会话的所有事件

技巧三：观察 UI 状态变迁

●

打开 Chrome DevTools → Elements → 监听 `.sub-agent-status` 类名变化

●

记录状态切换时间点，与网络请求对应

---

## 七、架构启示与借鉴价值

### 7.1 可复用的设计模式

模式一：双模决策架构

●

应用场景：需要同时支持快速查询和复杂规划的系统

●

实现要点：通过 `sessionType` 枚举动态切换行为树

●

性能优势：QUEST 模式可跳过规划阶段，RT 降低 70%+

模式二：子智能体卡片化 UI

●

应用场景：多任务并发执行的管理界面

●

实现要点：标准/紧凑/全屏三种视图模式自适应

●

用户体验：既保证信息密度，又提供专注模式

模式三：Undo/Redo 集成对话流

●

应用场景：代码编辑类 Agent

●

实现要点：将回滚操作包装为特殊消息类型

●

技术亮点：快照驱动的调试能力（类似 Git 时间旅行）

---

### 7.2 需避免的设计缺陷

缺陷一：编译后代码难以维护

●

问题：核心逻辑压缩在 `workbench.desktop.main.js` （5 万行+）

●

影响：调试困难、新人 onboarding 成本高

●

改进建议：保留 Source Map、拆分模块文件

缺陷二：SubAgent 无状态限制

●

问题：无法与子 Agent 进行多轮对话

●

影响：复杂任务需要一次性描述完整，认知负荷高

●

改进建议：引入 `contextId` 支持多轮会话绑定

缺陷三：MCP 集成浅层化

●

问题：仅支持安装 UI，缺少运行时扩展能力

●

影响：无法充分利用 MCP 生态的工具

●

改进建议：实现动态工具加载器 + 权限沙箱

---

## 八、完整源码位置索引

<table><colgroup><col width="162"> <col width="162"> <col width="162"> <col width="162"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>模块名称</p></td><td rowspan="1" colspan="1"><p>文件路径</p></td><td rowspan="1" colspan="1"><p>行号范围</p></td><td rowspan="1" colspan="1"><p>关键类/函数</p></td></tr><tr><td rowspan="1" colspan="1"><p>SessionType 枚举</p></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js</code></div></td><td rowspan="1" colspan="1"><div><code>3131</code></div></td><td rowspan="1" colspan="1"><div><code>Zr.ASSISTANT</code> / <code>Zr.QUEST</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>SubAgent 工具调用</p></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js</code></div></td><td rowspan="1" colspan="1"><div><code>23783-23800</code></div></td><td rowspan="1" colspan="1"><div><code>rcn.invoke()</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>QoderChatService</p></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js</code></div></td><td rowspan="1" colspan="1"><div><code>39150-39156</code></div></td><td rowspan="1" colspan="1"><div><code>VPt</code> / <code>askAgent()</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>SessionManager</p></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js</code></div></td><td rowspan="1" colspan="1"><div><code>39150</code></div></td><td rowspan="1" colspan="1"><div><code>vV1</code> / <code>processProgress()</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>ChatViewManager</p></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js</code></div></td><td rowspan="1" colspan="1"><div><code>39156</code></div></td><td rowspan="1" colspan="1"><div><code>mgi</code> / <code>registerChatView()</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>SubAgent 状态机</p></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js</code></div></td><td rowspan="1" colspan="1"><div><code>17048</code></div></td><td rowspan="1" colspan="1"><div><code>aEa</code> (状态映射表)</div></td></tr><tr><td rowspan="1" colspan="1"><p>SubAgentCard UI</p></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js</code></div></td><td rowspan="1" colspan="1"><div><code>15468-15709</code></div></td><td rowspan="1" colspan="1"><p>CSS 样式定义</p></td></tr><tr><td rowspan="1" colspan="1"><p>Tool Call 折叠</p></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js</code></div></td><td rowspan="1" colspan="1"><div><code>3131</code></div></td><td rowspan="1" colspan="1"><div><code>Hzi.shouldFoldBlock()</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>MCP 配置项</p></td><td rowspan="1" colspan="1"><div><code>workbench.desktop.main.js</code></div></td><td rowspan="1" colspan="1"><div><code>745-748</code></div></td><td rowspan="1" colspan="1"><p>国际化字符串</p></td></tr><tr><td rowspan="1" colspan="1"><p>Package 配置</p></td><td rowspan="1" colspan="1"><div><code>package.json</code></div></td><td rowspan="1" colspan="1"><div><code>1-296</code></div></td><td rowspan="1" colspan="1"><p>版本/依赖/脚本</p></td></tr></tbody></table>

---

## 九、总结与建议

### 9.1 核心发现汇总

1.

架构定位：Agent Loop 内嵌于聊天服务状态机，非独立模块

2.

双模设计：QUEST（问答）和 ASSISTANT（自主规划）通过 `sessionType` 区分

3.

SubAgent 机制：7 状态生命周期管理，支持动态工具集和模型配置

4.

通信协议：基于标准 `tool_call` 消息，支持流式进度更新

5.

UI 体系：四种视图模式（标准/紧凑/全屏/编辑器）覆盖多场景

### 9.2 下一步行动建议

短期（1-2 周）：

●

✅ 使用 Studio 录制一次完整的 SubAgent 调用过程

●

✅ 绘制详细的时序图（包含所有工具调用）

●

✅ 整理一份 Tool Call 字段字典

中期（1 个月）：

●

🎯 实现一个自定义 SubAgent（如"股市数据查询专家"）

●

🎯 扩展 MCP 集成，支持动态工具加载

●

🎯 优化 SubAgent 无状态限制，引入上下文记忆

长期（3 个月）：

●

🚀 构建企业级 SubAgent 市场（类似钉钉技能商店）

●

🚀 实现 Harness Engineering 评估体系（代码评分器 + 模型评分器）

●

🚀 探索多 SubAgent 协作编排（Plan-and-Execute 架构）

---

## 附录 A：关键术语表

<table><colgroup><col width="216"> <col width="216"> <col width="216"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>术语</p></td><td rowspan="1" colspan="1"><p>英文全称</p></td><td rowspan="1" colspan="1"><p>解释</p></td></tr><tr><td rowspan="1" colspan="1"><p>Agent Loop</p></td><td rowspan="1" colspan="1"><p>Agent Execution Loop</p></td><td rowspan="1" colspan="1"><p>Agent 的核心执行循环（感知→思考→行动）</p></td></tr><tr><td rowspan="1" colspan="1"><p>SubAgent</p></td><td rowspan="1" colspan="1"><p>Sub-Agent</p></td><td rowspan="1" colspan="1"><p>被主 Agent 调用的专用智能体</p></td></tr><tr><td rowspan="1" colspan="1"><p>Tool Call</p></td><td rowspan="1" colspan="1"><p>Tool Invocation Call</p></td><td rowspan="1" colspan="1"><p>LLM 调用外部工具的标准化协议</p></td></tr><tr><td rowspan="1" colspan="1"><p>SessionType</p></td><td rowspan="1" colspan="1"><p>Session Type</p></td><td rowspan="1" colspan="1"><p>会话类型枚举（QUEST/ASSISTANT）</p></td></tr><tr><td rowspan="1" colspan="1"><p>MCP</p></td><td rowspan="1" colspan="1"><p>Model Context Protocol</p></td><td rowspan="1" colspan="1"><p>大模型上下文协议，用于工具标准化</p></td></tr><tr><td rowspan="1" colspan="1"><p>Harness</p></td><td rowspan="1" colspan="1"><p>Agent Harness</p></td><td rowspan="1" colspan="1"><p>Agent 生产级基础设施（测试/监控/安全）</p></td></tr></tbody></table>

---

## 附录 B：参考资源

●

Qoder 官方仓库: [https://github.com/microsoft/vscode](https://github.com/microsoft/vscode) (基于 VS Code 分支)

●

MCP 协议规范: [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)

●

LangGraph Harness: [https://langchain-ai.github.io/langgraph/](https://langchain-ai.github.io/langgraph/)

●

AgentScope ReAct: [https://github.com/modelscope/agentscope](https://github.com/modelscope/agentscope)

---

END

一、核心架构概览

1.1 双模式决策系统

1.2 三层服务架构

二、Agent 调用核心流程

2.1 SubAgent 工具调用机制

2.2 Agent 核心调用链

三、SubAgent 生命周期管理

3.1 七状态状态机

3.2 SubAgentCard UI 组件体系

四、Tool Call 消息协议

4.1 消息类型定义

4.2 Tool Result 渲染流程

五、MCP 集成线索

5.1 MCP Server 配置界面

5.2 MCP 工具调用限制

六、逆向工程方法论

6.1 三大分析方案对比

6.2 关键调试技巧

七、架构启示与借鉴价值

7.1 可复用的设计模式

7.2 需避免的设计缺陷

八、完整源码位置索引

九、总结与建议

9.1 核心发现汇总

9.2 下一步行动建议

附录 A：关键术语表

附录 B：参考资源

有什么问题，和我聊聊吧～

**

添加收藏

你可以选择分类或直接 取消收藏

**

** 新建分类

未分类

（22）

收藏

业务学习

（7）

收藏

技术学习

（116）

已收藏

新人配置

（38）

收藏

内部资料

INTERNAL

495838
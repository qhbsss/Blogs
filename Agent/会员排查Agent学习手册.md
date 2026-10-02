---
title: 会员排查 Agent 学习手册
date: 2026-09-14
tags:
  - agent
  - 架构学习
  - 会员业务
  - 学习手册
aliases:
  - ticketSmartAgent 学习手册
  - memberCheckAnswer 学习手册
---

# 会员排查 Agent 学习手册

> [!abstract] 手册定位
> 本手册基于三份一手材料编写：ATA 文章《会员Tickets工单智能助手&问题排查Agent分享》（[[会员Tickets工单智能助手&问题排查Agent分享]]）、钉钉文档《AI答疑/排查架构&进展》、以及 `xinxuan-setup` / `vipshop` / `tlens` 三个本地源码仓库的实地探查。
> 目标：**两周内建立对"会员问题排查 Agent"完整的架构认知，能独立定位问题、评审方案、参与迭代。**

**适用读者**：Java 后端（阿里技术栈），了解 HSF / MetaQ / Pandora 基本概念，对 LLM Agent 有概念级了解。
**总学习时长**：约 5.5 个工作日（可按篇拆分，见附录 D 学习路线总表）。

---

## 详细学习目录

- [前言：怎么用这本手册](#前言怎么用这本手册)
- **第一篇 项目全景（第 0 站 · 0.5 天）**
  - [1.1 项目要解决什么问题](#11-项目要解决什么问题)
  - [1.2 三份核心资料导读](#12-三份核心资料导读)
  - [1.3 三个仓库的角色坐标](#13-三个仓库的角色坐标)
  - [1.4 效果指标基线](#14-效果指标基线)
  - [1.5 本篇产出检验](#15-本篇产出检验)
- **第二篇 纵向架构：AI 视角的三层（第 2 站前半 · 0.5 天）**
  - [2.1 三层架构总览](#21-三层架构总览)
  - [2.2 应用层：ticketSmartAgent 编排](#22-应用层ticketsmartagent-编排)
  - [2.3 能力层：memberCheckAnswer 七大能力](#23-能力层membercheckanswer-七大能力)
  - [2.4 能力内部的 L1–L4 四层诊断模型](#24-能力内部的-l1l4-四层诊断模型)
  - [2.5 SOP 与 Self-Plan 的动态切换](#25-sop-与-self-plan-的动态切换)
  - [2.6 few-shot 构建样例：SOP 的进化形态](#26-few-shot-构建样例sop-的进化形态)
  - [2.7 本篇产出检验](#27-本篇产出检验)
- **第三篇 工程分层：代码视角的双体系（第 2 站后半 · 0.5 天）**
  - [3.1 xinxuan-setup 的两套体系](#31-xinxuan-setup-的两套体系)
  - [3.2 member-ai-agent 模块内部结构](#32-member-ai-agent-模块内部结构)
  - [3.3 核心心法：代码是壳，配置是脑](#33-核心心法代码是壳配置是脑)
  - [3.4 本篇产出检验](#34-本篇产出检验)
- **第四篇 横向链路：一条工单的生命周期（第 1 站 · 1 天）**
  - [4.1 全链路总览](#41-全链路总览)
  - [4.2 入口：MetaQ 消息接入](#42-入口metaq-消息接入)
  - [4.3 主流程：增强处理器七步](#43-主流程增强处理器七步)
  - [4.4 双 Agent 协作：编排层 → 排查本体](#44-双-agent-协作编排层--排查本体)
  - [4.5 结果回传：钉钉互动卡片与 outTrackId 设计](#45-结果回传钉钉互动卡片与-outtrackid-设计)
  - [4.6 卡片回调：Stream 长连接（三个坑）](#46-卡片回调stream-长连接三个坑)
  - [4.7 落库、报表与人工打标](#47-落库报表与人工打标)
  - [4.8 本篇精读清单与产出检验](#48-本篇精读清单与产出检验)
- **第五篇 工具三代机制（第 3 站 · 1 天）**
  - [5.1 为什么会有三代工具](#51-为什么会有三代工具)
  - [5.2 第一代：@CobwebHSFApi 短 API 自动注册](#52-第一代cobwebhsfapi-短-api-自动注册)
  - [5.3 第二代：MemberAgentToolEntryService 统一契约](#53-第二代memberagenttoolentryservice-统一契约)
  - [5.4 第三代：ToolFunction 抽象（member-ai-domain）](#54-第三代toolfunction-抽象member-ai-domain)
  - [5.5 五大工具簇与 20+ 原子工具](#55-五大工具簇与-20-原子工具)
  - [5.6 本篇精读清单与产出检验](#56-本篇精读清单与产出检验)
- **第六篇 知识与 Agent 组织：云端侧（第 4 站 · 0.5 天）**
  - [6.1 双知识库：排查知识库 + 规则知识库](#61-双知识库排查知识库--规则知识库)
  - [6.2 Agent-Task/Skill 架构：演进型 Agent](#62-agent-taskskill-架构演进型-agent)
  - [6.3 agent 与 skill 的能力分层原则](#63-agent-与-skill-的能力分层原则)
  - [6.4 知识库上传 SOP 规范](#64-知识库上传-sop-规范)
  - [6.5 本篇产出检验](#65-本篇产出检验)
- **第七篇 治理与自进化（第 5 站 · 1 天）**
  - [7.1 开关与灰度：AiAgentSwitch](#71-开关与灰度aiagentswitch)
  - [7.2 幂等设计：Tair 防重投](#72-幂等设计tair-防重投)
  - [7.3 观测体系](#73-观测体系)
  - [7.4 Agent Loop：三 sub-agent 自进化闭环](#74-agent-loop三-sub-agent-自进化闭环)
  - [7.5 本篇精读清单与产出检验](#75-本篇精读清单与产出检验)
- **第八篇 对照拓展与架构手法（第 6 站 · 0.5 天）**
  - [8.1 对照一：tlens 日志体系](#81-对照一tlens-日志体系)
  - [8.2 对照二：vipshop GptPlugin 模式](#82-对照二vipshop-gptplugin-模式)
  - [8.3 方案演进：V1 GOC 链路 → V2 演进型 Agent](#83-方案演进v1-goc-链路--v2-演进型-agent)
  - [8.4 五个值得吸收的架构手法](#84-五个值得吸收的架构手法)
  - [8.5 本篇产出检验](#85-本篇产出检验)
- **附录**
  - [附录 A：关键类路径速查表](#附录-a关键类路径速查表)
  - [附录 B：术语表](#附录-b术语表)
  - [附录 C：学习检查点总清单](#附录-c学习检查点总清单)
  - [附录 D：学习路线总表](#附录-d学习路线总表)

---

## 前言：怎么用这本手册

本手册的组织逻辑是**三条线交织**：

| 线索 | 视角 | 对应篇章 |
|------|------|----------|
| 纵向 | AI 系统怎么分层（应用/能力/工具） | 第二、六篇 |
| 横向 | 一条工单怎么流转（MQ→Agent→卡片→落库） | 第四篇 |
| 代码 | 工程上怎么落地（模块/类/配置） | 第三、五、七篇 |

> [!tip] 学习建议
> 每一篇都遵循同一节奏：**先读正文建立地图 → 按精读清单打开源码对照 → 做产出检验自测**。产出检验答不上来的，回到对应小节重读。
> 云端配置（idealab/ideaLab 上的 Agent、知识库、工具箱）无本地源码，第六篇只能基于文档学习，建议找有权限的同学要只读访问。

---

## 第一篇 项目全景（第 0 站 · 0.5 天）

### 1.1 项目要解决什么问题

会员业务的 B 端运营**每月要处理上百条用户工单**（开续卡、权益、天猫积分、消费券……）。人工答疑需要跨多个系统查数据、翻知识库，效率低、质量不稳定。

项目用 AI 做成一条闭环流水线：

```
工单诞生 → 自动诊断 → 结论推送到钉钉群 → 人工反馈打标 → 落库报表 → 反哺 Agent 进化
```

上游背景是淘天「重大故障应急专项」，本 Agent 承载其中两个子项：
- **舆情初诊归因**（KR2）：舆情预警后 2 分钟内给出初步诊断，覆盖 C 端高频预警场景；
- **Tickets 工单智能助手**：本手册的主线（工单量级、链路最完整）。

### 1.2 三份核心资料导读

| 资料 | 定位 | 读法 |
|------|------|------|
| ATA《会员Tickets工单智能助手&问题排查Agent分享》 | 全景架构文：四部分讲透分层/链路/知识/Loop | 第一遍通读，第二遍配合第四、七篇精读 |
| 钉钉《AI答疑/排查架构&进展》 | 演进视角：V1 GOC 链路 → V2 演进型 Agent，含数据模型、知识库 SOP、典型 case | 配合第六、八篇读 |
| 三个本地仓库源码 | 事实的唯一来源 | 全程对照，路径见附录 A |

### 1.3 三个仓库的角色坐标

| 仓库 | 角色 | 关键事实 |
|------|------|----------|
| `xinxuan-setup` | **AI 应用主体**（本手册主角） | 工单消费、Agent 调用、卡片、落库全在这；DDD 五模块 `member-ai-*` + 老单体 `setup-*` 同进程部署 |
| `vipshop` | **能力供给方** | `member-blackvip-client` ~103 个接口对外；排查工具底层的数据/规则大多来自这里（如 `judgeCanOpenBlackVip` 背后的奥格人群资格判断） |
| `tlens` | **会员业务应用 + 日志设施范本** | ⚠️ 不是日志 SDK 仓库！三层 Sunfire 注解定义内嵌在 `tlens-facility` 里；学它是为了对照"这套 Agent 项目没用什么、为什么"（见 8.1） |

> [!warning] 最大的认知纠偏
> **Agent 的"智能"不在代码仓库里**。Agent 编排、提示词、知识库、工具箱全部配置在 idealab（AI Studio）云端；`xinxuan-setup` 里的代码只是"管道"——把工单送过去、把结果接回来。找"为什么这么回答"不要翻代码，要翻云端配置和执行链日志。

### 1.4 效果指标基线

| 指标 | 数值 | 备注 |
|------|------|------|
| 诊断采纳率 | ~80% 浮动，9 月达 **87.8%** | 人工卡片按钮/后台打标 |
| P95 诊断耗时 | **270s**（约 4.5 min） | 口径：消息开始消费 → 诊断结果返回 |
| 提效 | 未覆盖问题完结时长 P95 ≈ 已采纳的 **2.3 倍**；未采纳 ≈ 2.1 倍 | |
| 单条成本 | 约 **200 万 token** | 走 claude-opus 系模型 |

> [!note] 为什么 200 万 token 也值得
> 一条工单人工排查跨多系统、多知识库，运营耗时以十分钟计；270s + 自动化卡片回流，ROI 成立。**评估 Agent 项目别只盯 token 数，盯"人工时长置换比"**。

### 1.5 本篇产出检验

- [ ] 能用三句话说清这个项目是干嘛的、谁在用、效果如何
- [ ] 能说出三个仓库各自的角色，以及"智能在云端不在代码"这条结论
- [ ] 知道 87.8% / 270s / 200万token 三个数字的含义和口径

---

## 第二篇 纵向架构：AI 视角的三层（第 2 站前半 · 0.5 天）

### 2.1 三层架构总览

```
┌─────────────────────────────────────────┐
│ 应用层  ticketSmartAgent（工单编排）      │  ← 面向"受众场景"，变化最快
│   也复用于：VOC 舆情路由（GOC 链路）      │
├─────────────────────────────────────────┤
│ 能力层  memberCheckAnswer（排查本体）     │  ← 系统的"大脑"
│   7 大能力 × L1-L4 四层诊断模型          │
├─────────────────────────────────────────┤
│ 上下文与工具原子能力层                    │  ← 最稳定的地基
│   双知识库 + 20+ 原子工具（五大簇）       │
└─────────────────────────────────────────┘
```

原则：**越往下越稳定、越往上越贴近业务场景**。业务迭代（改知识库、加样例）不触碰底层工具；底层工具升级不影响上层业务语义。

### 2.2 应用层：ticketSmartAgent 编排

应用层是**流程编排型 workflow**，不负责"怎么排查"，只负责把排查接入具体场景并把结果处理成受众想要的样子：

- 工单信息提取（依赖 Tickets 工单平台 MCP）
- 解答结构化输出（长文本裁剪、重组）
- Markdown 转换、钉钉群消息推送

**可复用性是关键**：Tickets 工单链路与 VOC 舆情路由（GOC 链路）共享同一个下游"会员排查本体"，各自演进入口和输出。

### 2.3 能力层：memberCheckAnswer 七大能力

| # | 能力 | 说明 |
|---|------|------|
| 1 | 开续卡 + 权益排查 | 两类问题合并 |
| 2 | 天猫积分排查 | 积分记录、拉人开卡、积分买返、返点逆向等 |
| 3 | 消费券排查 | 目前主要支持人群券 |
| 4 | 活动玩法排查 | 明星演唱会日日抽 |
| 5 | 通用工具调用 | SLS、Hologres、ChangeFree 变更、策略平台变更记录 |
| 6 | 自主规划（Self-Plan） | 根据知识库 + 工具自主编排调用顺序与重试策略 |
| 7 | 拒绝执行（边界守卫） | 拒绝大会员、省钱卡等"语义相近但不支持"的场景，抑制幻觉 |

> [!tip] 第 7 项最容易被忽视
> "拒绝执行"是一等公民能力。LLM 天然倾向于"有问必答"，把"明确说不行"做成显式能力 + system 提示词约束，是抑制幻觉的第一道闸门。

### 2.4 能力内部的 L1–L4 四层诊断模型

每个能力内部都是同一个四层闭环：

| 层 | 名称 | 核心机制 |
|----|------|----------|
| L1 | 交互与意图理解 | `userId 补全`（缺失时昵称反查）、`边界守卫`、`SOP 路由` |
| L2 | RAG 知识与规则 | **查询模板库**（SLS/Holo 唯一合法模板，只允许替换占位符）、业务规则字典、工具契约 —— Agent 行为的"宪法" |
| L3 | 原子工具与诊断 | 五大工具簇，20+ 原子能力（详见第五篇） |
| L4 | 诊断推理与输出 | SOP/Self-Plan 双模式；三分归因：**业务规则 / 系统异常 / 用户理解偏差**；强制五要素输出 |

**五要素结构化输出**（强制）：问题概述、归因结论、关键证据、建议动作、不确定性说明。

> [!note] L2 是"宪法"的原因
> SQL 和日志查询语句是幻觉重灾区。L2 的查询模板库规定"只允许替换占位符"，把自由生成降维成填空题——这是本系统准确率的根基之一。

### 2.5 SOP 与 Self-Plan 的动态切换

| 能力 | 主导模式 | 设计理由 |
|------|----------|----------|
| 天猫积分 | Self-Plan 为主 | 知识库只描述"工具的用途与边界"，**不告诉模型步骤**，由模型自主编排 |
| 开续卡 + 权益 | SOP + Self-Plan | 复杂长链路（海外收银台）走 SOP；单一工具可解的走 Self-Plan，甚至纯规则解释 |
| 消费券 | SOP/Skill 为主 | 低成本运行态层默认先用 4 工具确认；高成本配置态层（88VIP排查skill-IDEA）按门控触发 |
| 活动玩法 | Skill 为主 | 排查链路单一，结构化查询口径表由运营每日维护 |

消费券的**两层门控**值得细看：运行态层（query_consume_crowd / sls_log_tool / query_vip_level_change_record / query_black_vip_info）每次可调；配置态层（活动配置、券模板反查、拉菲投放/库存、人群依赖、巡检）单次调用重、耗时长，非每次触发。

### 2.6 few-shot 构建样例：SOP 的进化形态

- **是什么**：能力维度的手动推理步骤全链路实现，缓存在能力提示词的上下文窗口中。
- **为什么**：抑制幻觉（尤其 SQL 入参和日志查询语句撰写）；badcase 解决后**记忆永久内化到上下文**。
- **怎么管**：支持手动干预入参、编辑执行链路、调整工具优先级。

运行模式即经典 ReAct 循环：**思考 → Act（调工具）→ 结果 → 再思考**。

### 2.7 本篇产出检验

- [ ] 能默画三层架构图并说出每层职责
- [ ] 能解释 L1-L4 每层的一个关键机制（如 userId 补全 / 查询模板 / 三分归因）
- [ ] 能说出"为什么天猫积分用 Self-Plan 而消费券用 SOP"
- [ ] 能解释 few-shot 构建样例与 SOP 的关系

---

## 第三篇 工程分层：代码视角的双体系（第 2 站后半 · 0.5 天）

### 3.1 xinxuan-setup 的两套体系

同一个 Pandora 进程里住着**两套工程体系**：

```
xinxuan-setup
├── DDD 五模块（AI 新体系）
│   ├── member-ai-client          # HSF 协议：TicketsDiagnosisQueryService / ManageService 等
│   ├── member-ai-domain          # 领域模型：ToolFunction 抽象、BizSceneConfig
│   ├── member-ai-application     # 应用编排
│   ├── member-ai-infrastructure  # 远程依赖：IdealabFacade（调云端 Agent）
│   └── member-ai-agent           # Agent 接入主体（工单消费/处理器/Stream回调）
├── 老单体（存量体系）
│   ├── setup-start               # 启动 + CobwebApiRegister 注册器
│   ├── setup-service             # HSF Provider：MemberAgentToolEntryService 等
│   ├── setup-manager / persistence / client / spi
└── member-config-biz
```

关键连接点：`setup-service/pom.xml:272` 依赖 `member-ai-agent` —— **新体系寄生在老单体的进程里渐进生长**，没有另起炉灶。

### 3.2 member-ai-agent 模块内部结构

```
member-ai-agent/src/main/java/com/taobao/xinxuan/member/ai/agent/
├── adapter/       # 输入适配：MetaQ 消息（TicketsWorkOrderAsyncAdapter 在 adapter/input/interaction/message/）
├── processor/     # 核心编排：TicketsWorkOrderEnhancedProcessor（七步主流程）
├── service/       # HSF 出口：AgentServiceImpl（@HSFProvider）
├── stream/        # Stream 长连接回调：TicketsCardCallbackHandler
├── infra/switchs/ # 开关：AiAgentSwitch（Agent URL 云端配置）
├── domain/ dal/ biz/ client/ interaction/ async/ log/ tool/ util/ e2e/
```

记忆法（一条工单的行进方向）：**adapter（进）→ processor（编排）→ service/infra（出）→ stream（回）**。

### 3.3 核心心法：代码是壳，配置是脑

| 东西 | 在哪里 | 不在哪里 |
|------|--------|----------|
| Agent 编排/意图分流 | idealab 云端（AI Studio） | 代码仓库 |
| 提示词（Agent Prompt / Task Prompt） | idealab 云端 | 代码仓库 |
| 知识库（排查/规则） | idealab 知识库 | 代码仓库 |
| 工具清单 | MT 配置 BizSceneConfig（id=1326071）→ 云端工具箱注册 | 代码仓库 |
| 代码职责 | 管道：送工单、接结果、发卡片、落库 | —— |

由此推论：**排查线上问题 = 看执行链日志（sessionId 锚点）+ 看云端配置，而不是 debug Java 代码**。Java 侧问题只可能是：消息没消费到、调用超时、回调丢失、落库失败这类管道故障。

### 3.4 本篇产出检验

- [ ] 能画出双体系模块图，指出 setup-service 与 member-ai-agent 的依赖关系
- [ ] 能说出 member-ai-agent 下 adapter/processor/service/stream 各自装什么
- [ ] 遇到"Agent 答错了"和"结果没回群"两类问题，知道分别去哪查

---

## 第四篇 横向链路：一条工单的生命周期（第 1 站 · 1 天）

### 4.1 全链路总览

```
Tickets 工单系统
  → MetaQ (TICKETS topic, tag: TICKET_ACTION_CREATE || TICKET_ACTION_REFERRAL_STC)
  → TicketsWorkOrderAsyncAdapter（消息接入）
  → TicketsWorkOrderEnhancedProcessor（七步编排）
      → idealabFacade.streamCallByIdeaLabApi
          → ticketSmartAgent（应用层编排）
              → memberCheckAnswer（排查本体：知识库+工具+skill+MCP）
      → 更新结果/耗时
      → 钉钉互动卡片（运营群，4 个反馈按钮）
  → 运营点按钮 → Stream 长连接回调 → TicketsCardCallbackHandler → 更新 vip_ai_config
  → vip_ai_config → ODPS DWD → ADS → BI 报表
```

### 4.2 入口：MetaQ 消息接入

- **代码入口**：`com.taobao.xinxuan.member.ai.agent.adapter.input.interaction.message.TicketsWorkOrderAsyncAdapter#consumeMessage`
- 订阅 tag：`TICKET_ACTION_CREATE || TICKET_ACTION_REFERRAL_STC`（**工单创建 + 工单转交**——转交也触发，覆盖"转到会员域"的工单）

### 4.3 主流程：增强处理器七步

**代码入口**：`TicketsWorkOrderEnhancedProcessor#process`（幂等判断约 L99，主流程 L106-159）

| 步骤 | 动作 | 关键设计 |
|------|------|----------|
| 0 | **Tair 幂等** | 分批发布时消息会重投，已完成的工单直接跳过 |
| 1 | 查询结构化工单 | `TicketsService.find` 拿 title / description / createTime / link |
| 2 | 字段提取与合并 | **工单标题合并进描述**——标题往往承载分类关键信息（如"订单未返天猫积分"），仅凭描述无法分类 |
| 3 | 生成 sessionId + 落库 | sessionId 在此生成而非下沉，**保证日志、落库、Agent 调用三方同一会话 ID**（Agent Loop 回溯的锚点，见 7.4） |
| 4 | 调用 idealab Agent | `idealabFacade.streamCallByIdeaLabApi`，工单描述作为 question 打给 ticketSmartAgent |
| 5 | 更新诊断结果 + 耗时 | 耗时口径"消息开始消费 → 结果返回"，供运营面板分业务类统计 |
| 6 | 投放钉钉互动卡片 | 见 4.5 |
| 7 | 打处理完成标记 | 后续重投的相同工单不再处理 |

### 4.4 双 Agent 协作：编排层 → 排查本体

第 4 步"调用 Agent"实际是双层协作：

1. 请求先打到 **ticketSmartAgent**（应用层）：工单信息提取、场景预处理；
2. 它再调用 **memberCheckAnswer**（能力层本体）：账号链路级深度排查，调知识库/工具/skill/MCP；
3. 本体产出结构化诊断结论 → 回传编排层做**结构化输出**（裁剪、Markdown）→ 回到 EnhancedProcessor。

**分工价值**：业务定制（怎么接、怎么呈现）与核心排查能力（怎么查、怎么归因）解耦；本体被多个应用层复用（Tickets、VOC 舆情）。

### 4.5 结果回传：钉钉互动卡片与 outTrackId 设计

核心方法 `sendDingTalkInteractiveCard`：

```
getAccessToken(appKey, appSecret)
  → createAndDeliver(
        cardTemplateId,              // 资源位配置（高频变更）
        outTrackId = aiConfigCode,    // ★ 直接复用 aiConfigCode
        callbackType = "STREAM",
        openSpaceId,                  // 资源位配置，决定发到哪个群
        robotCode,                    // 机器人须已在该群内
        cardData.cardParamMap)
```

> [!important] outTrackId = aiConfigCode
> 钉钉回调只带 `outTrackId`。让它直接等于落库记录的 `aiConfigCode`，**回调时无需任何映射表即可反查记录**；卡片更新接口也用它定位卡片。一个 ID 三用（落库主键 / 卡片跟踪 / 回调反查）。

卡片四个反馈按钮：

| 按钮 ID | 语义 | 写入字段 |
|---------|------|----------|
| `requestIsAccept` | 是否采纳 | `knowledgeAdopted` |
| `requsetIsCover` | 是否覆盖 | `knowledgeOverridden` |
| `questQueryScene` | 问题分类 | `tagCategory` |
| `requestInput` | 追加评论 | `diagnosisComments[]`（追加语义） |

### 4.6 卡片回调：Stream 长连接（三个坑）

**代码入口**：`TicketsCardCallbackHandler#handle`（约 L87）。运营点按钮 → 钉钉 Stream 长连接（topic `/v1.0/card/instances/callback`）回调服务端。

三个踩坑沉淀的硬约束：

1. **同一 client-id 同一时间只能有一个活跃 Stream 服务**。多机注册互相顶开连接，且被顶掉的机器 websocket 仍是 ESTABLISHED、日志仍打 `started successfully`——**回调静默丢失、极难定位**。解法：只允许指定 IP 的单台机器注册（IP 从策略平台资源位读取）。
2. **按钮 ID 与回显变量是两套命名**：解析用 `request*` / `quest*`（注意 `requsetIsCover` 的拼写就是坑本身），回写状态用 `response*`，且回写传中文展示文案而非原始编码。
3. **不同组件回传结构不同**：按钮/单选回传对象 `{index, value}`，输入框回传**纯字符串**——不能无脑 `getJSONObject`。

### 4.7 落库、报表与人工打标

- **落库**：复用 `vip_ai_config` 单表，`type = tickets_work_order_enhanced`，`data` 字段 **JSON 承载全部业务数据**——新增字段时 DTO/Adapter/DAL/前端协议全都不用改。
- **HSF 查询/管理**（member-ai-client 协议）：`TicketsDiagnosisQueryService`（queryPage / queryByCode / queryStat）供 OneDay 仪表盘；`TicketsDiagnosisManageService`（updateFeedback / deleteByCode）支持后台补录删除。**后台管理接口完全不依赖 Stream，是回调链路的天然兜底**。
- **离线报表**：`vip_ai_config → ODPS DWD → ADS → BI`，每日全量快照重刷；**排序键用 `gmtCreate` 而非 `gmtModified`**（后者会被追加评论刷新）。
- **人工打标**：群卡片按钮或管理后台，既是效果度量，也是 Agent Loop 的人工监督信号源。

### 4.8 本篇精读清单与产出检验

精读文件（按顺序）：

| 顺序 | 文件 | 重点 |
|------|------|------|
| 1 | `member-ai-agent/.../adapter/input/interaction/message/TicketsWorkOrderAsyncAdapter.java` | 消费入口、tag 过滤 |
| 2 | `member-ai-agent/.../processor/TicketsWorkOrderEnhancedProcessor.java` | L99 幂等、L106-159 七步逐行 |
| 3 | `member-ai-infrastructure/.../remote/dependency/idea/IdealabFacade.java` | L164 `streamCallByIdeaLabApi` 流式调用 |
| 4 | `member-ai-agent/.../stream/TicketsCardCallbackHandler.java` | L87 handle、三种组件解析分支 |
| 5 | `setup-persistence/.../dao/ai/VipAiConfigDAO.java` | 单表读写 |

产出检验：

- [ ] 能白板画出全链路时序（含 MetaQ tag、七步、双 Agent、回调、ODPS）
- [ ] 能解释 sessionId 为什么在第 3 步生成而不是调 Agent 时生成
- [ ] 能复述 Stream 长连接的三个坑及各自解法
- [ ] 能说出 outTrackId=aiConfigCode 一个设计省掉了什么

---

## 第五篇 工具三代机制（第 3 站 · 1 天）

### 5.1 为什么会有三代工具

Agent 的工具不是一次设计到位，而是**三代机制并存、按场景选用**——这本身就是一个"渐进式 AI 化"的活教材。

| 代 | 机制 | 位置 | 规模 |
|----|------|------|------|
| 一 | `@CobwebHSFApi` 短 API 注解自动注册 | setup-start `CobwebApiRegister` | 69 个工具，cobweb 五簇 |
| 二 | `MemberAgentToolEntryService` 统一契约 | setup-service | 11 个 @Component ToolService |
| 三 | `ToolFunction` 抽象（BSP/GenericHsf/HTTP/SPI） | member-ai-domain | 清单来自 MT 配置 |

### 5.2 第一代：@CobwebHSFApi 短 API 自动注册

- 注解打在短 API 方法上，`CobwebApiRegister` 启动时扫描注册。
- 五个簇：`cobweb/{black, sop, point, sqyk, solution}` —— 分别对应黑卡、SOP、积分、省钱卡、解决方案域。
- **特点**：零额外代码，存量 API 直接变 Agent 工具；代价是工具语义就是 API 语义，粒度和命名不受 Agent 场景约束。

### 5.3 第二代：MemberAgentToolEntryService 统一契约

- `@HSFProvider` 对外暴露**一个统一入口**，内部按 `bizScene + type` 路由到 `List<MemberAgentToolInterface>` 实现。
- `MemberAgentToolTypeEnum` 定义工具类型；11 个 `@Component` ToolService 承载具体工具。
- **价值**（ATA 文章的核心结论）：把散落在交易、大会员、积分、消费券等多个二方系统的能力，**收敛成语义清晰、入参规范、结果可控、做过脱敏的"排查专用工具"**——Agent 只面对统一契约，不理解底层协议差异。最终由 idealab 工具箱注册（底层本质是 MCP 服务）。

### 5.4 第三代：ToolFunction 抽象（member-ai-domain）

- `ToolFunction` / `ToolFunctionFactory` / `ToolFunctionType`（取值 **BSP / GenericHsf / HTTP / SPI**）位于 `member-ai-domain/.../interaction/agent/function/`。
- 工具清单不再硬编码，而是来自 **MT 配置的 BizSceneConfig（id=1326071）**——又一个"配置是脑"的实例。
- 四种 ToolFunctionType 意味着工具实现可以直达 BSP 规则引擎、泛化 HSF、HTTP 接口或 SPI 扩展点。

### 5.5 五大工具簇与 20+ 原子工具

| 工具簇 | 代表工具 | 底层来源 |
|--------|----------|----------|
| 信息查询 | `queryBlackVipInfo` / `getUserPointInfo` / `queryPointDetail` | setup-service（cobweb/black、cobweb/point）+ 交易平台 |
| 资格与活动 | `queryNpickOne` / `queryQualificationInvalidReason` / `whetherHitFromLimit` | setup-service + 活动/资格系统 |
| 交易与退款 | `analyzeOrderNotReturnPoint` / `queryRefundPointToRemainDetailList` / 退卡明细 | setup-service（cobweb/point）+ BSP 规则引擎 |
| 系统排查 | SLS 日志 / Hologres SQL / ChangeFree / 策略平台变更 | 可观测与数仓（**模板化查询**，呼应 L2 宪法） |
| 规则判断 | `judgeCanOpenBlackVip` / `queryBenefitinfo` | setup-service + 大会员权益 |

对照案例（工具语义的运用，取自评测报告 279ff1bd）：天猫积分"加钱兑退款"工单——从规则知识库拿到机制根因（"退积分 = 扣卖家保证金赔付"），再从 `queryRefundPointToRemainDetailList` 的工具描述确认边界（"查不到 = 未走标准回退流程"），最终结论"商家不转保 = 资金来源被切断 = 非系统故障"。**工具描述本身就是知识**。

### 5.6 本篇精读清单与产出检验

精读文件：

| 顺序 | 文件 | 重点 |
|------|------|------|
| 1 | `setup-start/src/main/java/com/taobao/xinxuan/register/CobwebApiRegister.java` | 扫描注册机制 |
| 2 | `setup-service/src/main/java/com/taobao/xinxuan/hsf/provider/agent/MemberAgentToolEntryService.java` | bizScene+type 路由 |
| 3 | `member-ai-domain/.../interaction/agent/function/ToolFunction.java` 及同目录 Factory/Type | 四种类型的分发 |
| 4 | 任选一个 11 个 ToolService 之一（如积分类） | 统一契约的入参/出参/脱敏 |

产出检验：

- [ ] 能说清三代工具各自解决什么问题、代价是什么
- [ ] 能解释"工具不是直连底层而是统一封装"的价值（脱敏/契约/复用三选一展开）
- [ ] 知道工具清单配置在 MT 的哪个配置里

---

## 第六篇 知识与 Agent 组织：云端侧（第 4 站 · 0.5 天）

### 6.1 双知识库：排查知识库 + 规则知识库

| 知识库 | 内容 | 作用 |
|--------|------|------|
| **排查知识库** | 工单&结论、CCO 布防口径、历史 VOC 舆情事件&排查定位 | "这类问题怎么查"——步骤、工具链、口径 |
| **规则知识库** | 业务领域知识（积分概念、权益规则、开卡资格） | "业务机制是什么"——归因的权威依据 |

两类知识库**交叉印证，缺一不可**：只有规则库知道"应该是什么"但不知道"怎么查"；只有排查库会照猫画虎查一遍但归因可能无据。上节"加钱兑退款"案例就是双库交叉的样板。

知识库持续扩展路径：持续捞取线上 tickets 工单、手动录入、迭代沉淀；后续规划是业务领域知识库与问题排查知识库两大类分离。

### 6.2 Agent-Task/Skill 架构：演进型 Agent

V2 方案的核心（钉钉文档 3.2 节），把一份大 Prompt 拆成两份：

| 组成 | 内容 | 类比 |
|------|------|------|
| **Agent Prompt** | 人设 + 共性 Prompt | "你是一个营销优惠券配置专家" |
| **Task Prompt（Skill Prompt）** | 具体技能的任务指令、工具信息、执行样例 | "每种券的配置经验是一个 Task/Skill" |

- 一个 Agent 关联多个 Task，平台**意图分流**自动选择匹配的 Task（用户无感知），组合成完整上下文注入大模型。
- 每个 Agent 默认两个 Task：**自主规划**（打工人默认技能一）+ **拒绝执行**（默认技能二）。
- 演进型 Agent 的三阶段：实习生（Task 定义学高频任务）→ 熟练工（采样探索+训练内化套路）→ 专家（解空间完整认知，强泛化）。
- 相比 V1（MultiAgent + Master-Agent 代码/提示词分流，本质 workflow 确定性）：V2 让 Agent 有自主规划能力，泛化更强，支持多轮对话 + 短期记忆（Planner-Executor 交互形式）。

### 6.3 agent 与 skill 的能力分层原则

| 维度 | Agent 能力（memberCheckAnswer 六大能力） | Skill 能力（a1 / odps-analyze / dingtalk-docs） |
|------|------------------------------------------|------------------------------------------------|
| 定位 | **业务语义级**：一类业务问题的诊断闭环 | **工具原子级**：一组通用平台操作 |
| 知识依赖 | 排查库 + 规则库 + 构建样例 | SKILL.md 指令与参数约定 |
| 编排 | L4 SOP/Self-Plan 动态编排 | 主 Agent 显式调用 |
| 演进节奏 | 随业务快速迭代 | 稳定，基础设施复用 |

**核心原则：Agent 负责"理解业务、决定查什么"，Skill/工具负责"高效、规范地把数据取回来"。** 越靠业务语义变化越快、越需要知识库和样例约束；越靠平台操作越稳定、越强调复用。

### 6.4 知识库上传 SOP 规范

（来自钉钉文档实操沉淀，向量模型最大接收 8192 tokens）

1. 自定义方式上传；
2. 分段标识：**H1 标题**；
3. 分段最大长度：分段预览后取接近实际 token 数略大一点的值（最大限度节省 token）；
4. 分段重叠长度：取分段最大长度的 **1/10**；
5. 文章标题**不勾选**（分段内容不添加文档标题）。

### 6.5 本篇产出检验

- [ ] 能说出双知识库各自装什么、"交叉印证"举一个例子
- [ ] 能解释 Agent-Task/Skill 拆分与 V1 MultiAgent 的本质区别
- [ ] 能背出知识库分段 SOP 的 5 条中至少 3 条

---

## 第七篇 治理与自进化（第 5 站 · 1 天）

### 7.1 开关与灰度：AiAgentSwitch

- 位置：`member-ai-agent/.../infra/switchs/AiAgentSwitch.java`。
- **Agent URL 本身来自云端配置（资源位/策略平台）**——切 Agent 版本、切实验不用发版。
- Stream 回调注册的指定 IP 也从策略平台资源位读取（见 4.6 坑 1 的解法）。

### 7.2 幂等设计：Tair 防重投

七步主流程的第 0 步 + 第 7 步首尾呼应：

```
第 0 步：Tair 查处理标记 → 已处理直接 return（分批发布消息重投场景）
第 7 步：处理完成后打标记
```

配合 MetaQ 至少一次投递语义，保证**同一条工单恰好处理一次**。注意幂等键的选择与 sessionId 生成时机（第 3 步）解耦但相关——sessionId 保证的是"一次处理内三方日志同源"。

### 7.3 观测体系

- **耗时口径**统一为"消息开始消费 → 诊断结果返回"（第 5 步记录），供运营面板按业务分类统计；
- xinxuan-setup 本项目**没有用** tlens 的三层 Sunfire 注解体系，用的是自研 CommonLog / XflushStatLog / AgentCommonStatLog 埋点；
- GOC 链路指标观测有独立 FBI 看板（钉钉文档附地址）；
- 效果度量的最终依据是**人工采纳打标**（卡片按钮 + 管理后台），而非模型自评。

### 7.4 Agent Loop：三 sub-agent 自进化闭环

**物理载体**：ideaGoal 云端文件库公共目录 `问题排查Agent/`（按天累积）。文件名里的 sessionId 与七步主流程第 3 步生成的 sessionId 完全对应——**线上一次真实诊断与离线可回溯资产之间的锚点**。

三个已固化的 ideaGoal 任务（sub-agent）：

| Sub-agent | 做什么 | 产物 |
|-----------|--------|------|
| ① 执行链日志归档（_21718） | 采集 AI Studio 排查 Agent（appCode `UmggMXyACZh`）上一整点小时的执行链，下钻每个 IDEAs 子 Agent 完整调用链，按日归档 | 每条日志含：会话元信息（耗时/tokens/费用/conversationId）、提问原文、最终回答、逐步执行链（role/推理/工具/入参/返回，敏感入参已脱敏） |
| ② GoldSet 样例提炼（_22526） | 按 sessionId 抓执行链，提炼金标准样例写入标准样例集 | 样例元信息与溯源、输入、**标准结论**、**标准执行路径**（期望工具序列与入参）、**评分锚点与红线**；正向金标准（综合期望 ≥9.0）+ 反例 |
| ③ 会话评测（_22150） | **四方交叉评测**：执行链日志 × memberCheckAnswer Agent × vipSentimentKnowledgeBase 知识库 × 88VIP 代码仓库 | 评测报告：总体评分（准确性/知识库引用/能力利用充分度/完整性/规范性/综合）+ 做得好 + 可优化点（附证据与建议）→ 推钉钉频道 |

**闭环四步**：

```
感知（执行链归档，可回溯）
  → 立标（goldSet 沉淀"什么是好的诊断"）
  → 度量（四方交叉评测对照 goldSet 打分，指出差距）
  → 进化（反哺提示词/SOP/知识库/样例/工具 → goldSet 回归跑分 → 通过则新基线 → 下一轮）
```

为什么是"四方"：执行链看**实际怎么跑**、Agent 定义看**本应具备什么能力**（如"漏用了 queryPointDetail"）、知识库验证**归因是否有据**、代码仓库做**机制级终极佐证**（如从 `TmallPointAddMoneyBuyRefundOrderListener` 监听器代码证实"无退款单则回退逻辑永不触发"）。

> [!important] Agent Loop 的本质
> LLM Agent 的质量取决于它的全部产物（提示词/知识库/few-shot/工具/skill），这些上线即静态而工单千变万化。Agent Loop 建立**可观测（执行链归档）、可度量（goldSet 打分）、可改进（评测建议）、防退化（回归跑分）**的工程化路径——这是项目比"某次诊断答得好"更有长期价值的部分。

### 7.5 本篇精读清单与产出检验

精读文件：

| 顺序 | 文件 | 重点 |
|------|------|------|
| 1 | `member-ai-agent/.../infra/switchs/AiAgentSwitch.java` | 哪些配置走云端资源位 |
| 2 | `TicketsWorkOrderEnhancedProcessor.java` 第 0/7 步 | Tair 幂等键、完成标记 |
| 3 | `member-ai-agent/.../log/` 目录 | 自研埋点与 tlens 体系差异 |

产出检验：

- [ ] 能复述 Agent Loop 四步闭环与三个 sub-agent 的分工
- [ ] 能解释 sessionId 作为"锚点"串起了哪三样东西
- [ ] 能说出四方交叉评测每一方各回答什么问题

---

## 第八篇 对照拓展与架构手法（第 6 站 · 0.5 天）

### 8.1 对照一：tlens 日志体系

**事实纠偏**：tlens 仓库是会员业务应用 + 内嵌 `tlens-facility` 日志设施，**不是独立日志 SDK 仓库**。

三层注解体系（定义于 `tlens-facility/src/main/java/com/taobao/tlens/log/annotation/`）：

| 注解 | 适用层 | 输出 |
|------|--------|------|
| `@EnableServiceEntryLog` | HSF ServiceImpl 方法入口 | tlens_service_entry.log |
| `@EnableSunfireLog` | Manager 层关键业务方法 | tlens_sunfire_log.log |
| `@EnableServiceDependencyLog` | Facade/Client 外部依赖调用 | tlens_service_dependency.log |

**学习视角**：xinxuan-setup 的 AI 链路没有引入这套体系（用自研埋点）。对照思考：AI 管道方法的观测重点是**耗时分段 + token/费用 + sessionId 贯穿**，与 Sunfire 体系的"成功失败 + 依赖耗时"关注点不同；但 tlens 体系的已知坑（`LogContextHolder` TTL 未重写 childValue/copy 导致线程池 fan-out 共享栈 NPE/字段错位）在 AI 项目的并行编排（future 并行调工具）里同样要警惕——**池内路径禁止 getCurrent()，用局部 LogContent**。

### 8.2 对照二：vipshop GptPlugin 模式

- vipshop（能力供给方）正在出现**另一条 AI 接入路径**：`member-blackvip-vipshop/.../biz/memberhelper/gpt/` 下的 GptPluginHandlerManager（**未提交 patch，见仓库根 `vipshop_diff.txt`**），实现 `GptPluginInterface`，按 action 自动注册路由，带 `vip_assistant_tool` 开关。
- 对照：xinxuan-setup 是"**应用侧编排**"（主动调云端 Agent，管道在代码），GptPlugin 是"**能力侧插件**"（业务系统把自己暴露成 AI 助手的工具）。两者未来在工具层汇合（排查工具的底层本来就有 vipshop 的 HSF）。
- 学习时看：`vipshop_diff.txt` L590 起 GptPluginHandlerManager 的注册/路由实现（InitializingBean + ApplicationContextAware 自动发现 handler）。

### 8.3 方案演进：V1 GOC 链路 → V2 演进型 Agent

| 维度 | V1 GOC 链路 | V2 演进型 Agent |
|------|-------------|-----------------|
| 组织形式 | MultiAgent + Master-Agent 意图分流（本质 workflow） | Agent-Task/Skill + 意图分流 |
| 确定性 | 代码+提示词限制 query 处理链路 | Planner-Executor，自主规划 |
| 泛化性 | 场景固定，新场景要搭新 Agent | Task 可持续新增，自主规划兜底 |
| 记忆 | 无 | 短期记忆 + 多轮对话 |
| 典型场景 | 舆情诊断（88VIP 开卡/权益，盒马 P4 测试） | 会员业务日常排查答疑（预发） |

V1 的架构产物仍在服役：舆情诊断的前置 Agent / Master / 开卡 Agent / 权益 Agent / 结果汇总 Agent 五件套，及 GOC 路由场景（开卡入口、价格不正确、权益领取、权益未到账）。V1 的 5 条问题总结（知识库扩展、混合场景 agent、评测口径、日常答疑 agent、变更单匹配、工单群接入）几乎每条的解法都指向了 V2 或 Agent Loop——**演进是被 badcase 推着走的**。

### 8.4 五个值得吸收的架构手法

1. **代码是壳、配置是脑**：智能资产（Agent/提示词/知识库/工具清单）全在云端配置，代码只做管道。换模型、调提示词、切实验不发版。
2. **工具契约统一化**：不直连底层，自建 HSF 封装层收敛多系统能力为语义清晰、入参规范、结果脱敏的排查专用工具。
3. **outTrackId = 业务主键**：一个 ID 贯穿落库/卡片/回调三处，消灭映射表。
4. **单表 JSON 承载**：`vip_ai_config` 单表 + `data` JSON 字段，新业务字段零改 DTO/DAO/前端协议；代价是查询能力弱（靠 ODPS 补）。
5. **双体系共存渐进式 AI 化**：不重写老单体，DDD 五模块寄生同进程，按场景逐步迁移。

### 8.5 本篇产出检验

- [ ] 能说出 tlens 三层注解的适用层，以及 AI 项目为何没用它
- [ ] 能对比"应用侧编排"与"能力侧插件"两种 AI 接入路径
- [ ] 五个架构手法能任选两个展开讲适用前提和代价

---

## 附录 A：关键类路径速查表

仓库根均为本地目录，包路径省略 `src/main/java`。

| 类 | 模块 | 路径（包内） | 记忆点 |
|----|------|--------------|--------|
| TicketsWorkOrderAsyncAdapter | member-ai-agent | `com/taobao/xinxuan/member/ai/agent/adapter/input/interaction/message/` | 消息入口 |
| TicketsWorkOrderEnhancedProcessor | member-ai-agent | `com/taobao/xinxuan/member/ai/agent/processor/` | 七步主流程；L99 幂等，L106-159 主体 |
| AgentServiceImpl | member-ai-agent | `com/taobao/xinxuan/member/ai/agent/service/impl/` | @HSFProvider L53 |
| TicketsCardCallbackHandler | member-ai-agent | `com/taobao/xinxuan/member/ai/agent/stream/` | 回调 L87 |
| AiAgentSwitch | member-ai-agent | `com/taobao/xinxuan/member/ai/agent/infra/switchs/` | Agent URL 云端配置 |
| IdealabFacade | member-ai-infrastructure | `com/taobao/xinxuan/member/ai/infrastructure/remote/dependency/idea/` | L164 streamCallByIdeaLabApi |
| ToolFunction / Factory / Type | member-ai-domain | `com/taobao/xinxuan/member/ai/domain/interaction/agent/function/` | 四种类型 BSP/GenericHsf/HTTP/SPI |
| MemberAgentToolEntryService | setup-service | `com/taobao/xinxuan/hsf/provider/agent/` | 统一工具契约 |
| CobwebApiRegister | setup-start | `com/taobao/xinxuan/register/` | 一代工具注册 |
| VipAiConfigDAO | setup-persistence | `com/taobao/xinxuan/setup/vipshop/dao/ai/` | 单表落库 |
| Sunfire 三注解 | tlens-facility | `com/taobao/tlens/log/annotation/` | 对照学习 |
| GptPluginHandlerManager | vipshop（未提交） | `com/alibaba/taobao/vipmember/blackvip/biz/memberhelper/gpt/` | 见 vipshop_diff.txt L590 |

配置类资产（不在代码库）：

| 资产 | 位置 |
|------|------|
| ticketSmartAgent / memberCheckAnswer / 舆情五件套 Agent | idealab（AI Studio），projectId 195684 |
| 排查/规则双知识库 | idealab 知识库（88vip舆情排查知识库等） |
| 工具清单 | MT 配置 BizSceneConfig（id=1326071） |
| Agent Loop 三任务 + 执行链归档 | ideaGoal 云端文件库 `问题排查Agent/`（appCode UmggMXyACZh） |

## 附录 B：术语表

| 术语 | 含义 |
|------|------|
| ticketSmartAgent | 应用层工单编排 Agent（工单智能助手-增强型） |
| memberCheckAnswer | 会员排查 Agent 本体（能力层，ReAct 演进型） |
| GOC 链路 | V1 方案：舆情预警→Master-Agent 分流→子 Agent 诊断→回调 |
| 演进型 Agent | V2 方案：Agent-Task/Skill 架构，自主规划，持续进化 |
| L1–L4 | 能力内部四层诊断模型：意图理解→RAG 规则→原子工具→诊断推理输出 |
| SOP / Self-Plan | 两种推理模式：标准流程驱动 / 模型自主编排 |
| few-shot 构建样例 | 缓存在能力提示词中的手动推理步骤全链路，抑制幻觉 |
| goldSet | 金标准样例集：标准结论+标准执行路径+评分锚点，评测标尺 |
| 四方交叉评测 | 执行链 × Agent × 知识库 × 代码仓库 的会话质量评测 |
| outTrackId / aiConfigCode | 卡片跟踪 ID 与落库业务码，二者相等以消灭映射 |
| vip_ai_config | 单表承载所有 AI 诊断记录，data 列 JSON |
| Agent Loop | 感知→立标→度量→进化的自进化闭环 |
| Stream 长连接 | 钉钉卡片回调通道，topic /v1.0/card/instances/callback |

## 附录 C：学习检查点总清单

完成全部学习后，以下 20 项应全部打勾：

**全景**（3 项）
- [ ] 三句话说清项目价值；三仓库角色；智能在云端不在代码

**架构**（5 项）
- [ ] 默画三层架构图；L1-L4 各一个关键机制；SOP/Self-Plan 选择逻辑；few-shot 与 SOP 关系；双体系模块图

**链路**（5 项）
- [ ] 白板全链路时序；sessionId 生成时机的原因；Stream 三坑；outTrackId 设计价值；幂等首尾两步

**工具与知识**（4 项）
- [ ] 三代工具各自定位；工具统一封装三价值；双知识库交叉印证案例；Agent-Task/Skill 与 V1 区别

**治理与演进**（3 项）
- [ ] Agent Loop 四步闭环；sessionId 锚点串三样；四方评测各答什么

## 附录 D：学习路线总表

| 站 | 篇章 | 时长 | 核心产出 |
|----|------|------|----------|
| 第 0 站 | 第一篇 项目全景 | 0.5 天 | 项目定位 + 资料地图 |
| 第 1 站 | 第四篇 横向链路 | 1 天 | 全链路时序白板图 |
| 第 2 站 | 第二、三篇 纵向分层 + 工程分层 | 1 天 | 双体系模块图 + 三层架构图 |
| 第 3 站 | 第五篇 工具三代机制 | 1 天 | 工具机制对比表 |
| 第 4 站 | 第六篇 知识与 Agent 组织 | 0.5 天 | 双知识库 + Task/Skill 认知 |
| 第 5 站 | 第七篇 治理与自进化 | 1 天 | Agent Loop 闭环图 |
| 第 6 站 | 第八篇 对照拓展 | 0.5 天 | 架构手法吸收清单 |

> [!quote] 结语（引 ATA 原文收束）
> 这套架构的真正价值，不在于"某一次诊断答得多好"，而在于它**建立了一条让 AI 诊断质量可观测、可度量、可持续改进的工程化路径**。

---

*相关笔记：[[会员Tickets工单智能助手&问题排查Agent分享]] · [[React学习]]（前端素材配置后台——同一项目组的配套前端）*

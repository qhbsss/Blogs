---
title: "会员Tickets工单智能助手&问题排查Agent分享"
source: "https://ata.atatech.org/articles/11020794806?spm=ata.23639420.0.0.15527536kjn2yL"
author:
published:
created: 2026-09-21
description:
tags:
  - "clippings"
---
昨天20:50发表8次浏览






## 写在前面：

会员问题排查 Agent 要解决的问题很朴素—— **会员业务的 B 端运营每月要处理上百条用户工单（开续卡、权益、天猫积分、消费券……），人工答疑需要跨多个系统查数据、翻知识库，效率低、质量不稳定。**

我们用 AI 把这件事做成了一条闭环流水线：

![image.png](<../images/redirect_41.png>)

下面分四个部分展开： **① Agent 架构层级 → ② 外部交互链路 → ③ 知识上下文组织 → ④ Agent Loop 实现** 。

---

## 一、Agent 架构层级介绍

整个系统在纵向上可以清晰地拆成 **三个层级** ：应用层、能力层、上下文与工具原子能力层。这三层各司其职，越往下越稳定、越往上越贴近业务场景。

### 1.1 应用层：面向"受众场景"的定制编排

![image.png](<../images/redirect_42.png>)

应用层是 **流程编排型 workflow** ，直接面向使用者（业务/运营）的场景做定制化处理。它不负责"怎么排查"，只负责"把排查这件事接入到具体的业务场景里，并把结果处理成受众想要的样子"。

以 Tickets 工单场景为例，应用层（即 `ticketSmartAgent` ，工单智能助手-增强型）主要承担：

- **工单信息提取能力** ：依赖 Tickets 工单平台 MCP，把工单原始信息结构化；
- **解答结构化输出** ：对排查本体返回的长文本做裁剪、重组；
- **代码执行** ：转换成 Markdown 格式；
- **发送钉钉群消息** ：智能监听并把"问题排查 Agent"的答疑结果推送到运营群。

> 应用层是可以复用的：目前已经迭代了两个场景—— **VOC 舆情路由（GOC 链路）** 与 **Tickets 工单排查链路** 。二者共享同一个下游"会员排查本体"，但各自有不同的入口编排和输出定制。

### 1.2 能力层：会员排查本体的 7 大能力

能力层就是 **会员问题排查 Agent 本体** （ `memberCheckAnswer` ）， **演进型 ReAct模式** ，也是整个系统的"大脑"。它目前支持 7 种能力：

| # | 能力 | 说明 |
| --- | --- | --- |
| 1 | **开续卡 + 权益排查** | 合并了开续卡与权益两类问题 |
| 2 | **天猫积分排查** | 积分记录、拉人开卡、积分买返、积分返点逆向等 |
| 3 | **消费券排查** | 目前主要支持人群券 |
| 4 | **活动玩法排查** | 明星演唱会日日抽 |
| 5 | **通用工具调用** | 技术查询 SLS、Hologres、ChangeFree 变更、策略平台变更记录 |
| 6 | **自主规划（Self-Plan）** | 根据知识库 + 工具自主编排调用顺序与重试策略，由 idealab 团队底层封装 |
| 7 | **拒绝执行（边界守卫）** | 通过 system 提示词 + 拒绝执行能力，限制排查范围，明确拒绝大会员、省钱卡等"语义相近但实际不支持"的场景，抑制幻觉 |

#### 能力内部的四层诊断模型（L1–L4）

每一种能力，其内部都可以抽象为一个从"意图识别"到"结果综合"的四层闭环模型：

![image.png](<../images/redirect_43.png>)

- **L1 交互与意图理解层** ：提取结构化参数（userId、orderId、timestamp、scene_tag），识别问题类型，判断是否在能力边界内。关键机制有三个—— `userId 补全` （缺失时用昵称反查）、 `边界守卫` （拒绝非会员业务）、 `SOP 路由` （把典型场景映射到标准流程）。
- **L2 RAG 知识与规则层** ：为工具调用和结果解读提供权威依据，是 Agent 行为的"宪法"。核心是 **查询模板库** （SLS/Holo 的唯一合法模板，只允许替换占位符）、 **业务规则字典** 、 **工具契约** 。
- **L3 原子工具与诊断能力层** ：按业务域划分为五大工具簇（信息查询、资格活动、交易退款、系统排查、规则判断），共 20+ 原子能力。
- **L4 诊断推理与输出层** ：两种推理模式（SOP 驱动 / Self-Plan 自主规划），统一的三分归因框架（ **业务规则 / 系统异常 / 用户理解偏差** ），以及强制的五要素结构化输出（问题概述、归因结论、关键证据、建议动作、不确定性说明）。

#### SOP 与 Self-Plan 的动态切换

不同能力对两种模式的倚重不同：

| 能力 | 主导模式 | 设计理由 |
| --- | --- | --- |
| **天猫积分** | 以 Self-Plan 为主 | 知识库着重描述"工具的用途与边界"， **不告诉模型排查步骤** ，由模型根据工具用途自主编排顺序 |
| **开续卡 + 权益** | SOP + Self-Plan | 复杂长链路（如海外收银台）走 SOP；单一工具即可解决的走 Self-Plan，甚至无需调用工具、按规则文档解释 |
| **消费券** | 以 SOP/Skill 为主 | 低成本运行态层（默认先用）：query_consume_crowd（消费券预查询）、sls_log_tool（领取日志）、query_vip_level_change_record（等级变更）、query_black_vip_info（会员信息）。用于确认「是否领取成功 / 领取时间 / 等级变更 / 会员与卡程状态」。 |
|  |  | 高成本配置态层（按门控触发，非每次调用）：88VIP排查skill-IDEA。内含多个下层配置查询 skill（活动配置、券模板反查、拉菲投放/库存、人群依赖、巡检），单次调用重、耗时长。 |
| **活动玩法** | 以Skill为主 | 排查链路单一，结构化了查询口径表，由运营同学每日维护 |

**构建样例（few-shot）是 SOP 的进化形态** ：它是能力维度的手动推理步骤全链路实现，缓存在能力提示词的上下文窗口中。构建初衷是 **抑制幻觉** （尤其是 SQL 入参和日志查询语句的撰写），支持手动干预入参、编辑执行链路、调整工具优先级。解决好这部分 badcase，记忆会永久内化到上下文中。

> Few-shot（少样本学习/提示）是一种通过提供少量示例来引导模型理解任务并生成高质量回答的技术，其核心在于利用上下文中的演示（Demonstrations）让模型“照猫画虎”，而无需进行昂贵的模型微调（Fine-tune）。

思考➡️Act➡️结果——每轮推理步骤的运行模式

![image.png](<../images/redirect_44.png>)

### 1.3 上下文与工具原子能力层：最稳定的地基

这一层是整个金字塔的底座，由 **知识库** 和 **原子工具** 两部分构成——具体的数据源接入、知识分层，将在第三部分详细展开。

### 1.4 三层架构总览

![image.png](<../images/redirect_45.png>)

---

## 二、外部交互链路介绍

如果说第一部分是"纵向分层"，那么这一部分就是"横向流转"——一条工单从诞生到诊断结论回群、再到落库报表的 **完整生命周期** 。

### 2.1 全链路时序图

<svg id="mermaid-1789959301797-sn08k" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 3219.5px;" viewBox="-50 -10 3219.5 1041" role="graphics-document document" aria-roledescription="sequence"><g><rect x="2937.5" y="955" fill="#eaeaea" stroke="#666" width="182" height="65" name="BI" rx="3" ry="3"></rect><text x="3028.5" y="987.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="3028.5" dy="0">OneDay 仪表盘 / 报表</tspan></text></g> <g><rect x="2656.5" y="955" fill="#eaeaea" stroke="#666" width="231" height="65" name="CB" rx="3" ry="3"></rect><text x="2772" y="987.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="2772" dy="0">TicketsCardCallbackHandler</tspan></text></g> <g><rect x="2338" y="955" fill="#eaeaea" stroke="#666" width="196" height="65" name="CARD" rx="3" ry="3"></rect><text x="2436" y="987.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="2436" dy="0">钉钉互动卡片（运营群）</tspan></text></g> <g><rect x="2108" y="955" fill="#eaeaea" stroke="#666" width="180" height="65" name="DB" rx="3" ry="3"></rect><text x="2198" y="987.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="2198" dy="0">vip_ai_config（落库）</tspan></text></g> <g><rect x="1781" y="955" fill="#eaeaea" stroke="#666" width="277" height="65" name="MC" rx="3" ry="3"></rect><text x="1919.5" y="987.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="1919.5" dy="0">memberCheckAnswer（排查本体）</tspan></text></g> <g><rect x="1399" y="955" fill="#eaeaea" stroke="#666" width="261" height="65" name="TA" rx="3" ry="3"></rect><text x="1529.5" y="987.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="1529.5" dy="0">ticketSmartAgent（工单编排层）</tspan></text></g> <g><rect x="1047" y="955" fill="#eaeaea" stroke="#666" width="302" height="65" name="EP" rx="3" ry="3"></rect><text x="1198" y="987.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="1198" dy="0">TicketsWorkOrderEnhancedProcessor</tspan></text></g> <g><rect x="740" y="955" fill="#eaeaea" stroke="#666" width="257" height="65" name="AD" rx="3" ry="3"></rect><text x="868.5" y="987.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="868.5" dy="0">TicketsWorkOrderAsyncAdapter</tspan></text></g> <g><rect x="200" y="955" fill="#eaeaea" stroke="#666" width="195" height="65" name="MQ" rx="3" ry="3"></rect><text x="297.5" y="987.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="297.5" dy="0">MetaQ (TICKETS topic)</tspan></text></g> <g><rect x="0" y="955" fill="#eaeaea" stroke="#666" width="150" height="65" name="TK" rx="3" ry="3"></rect><text x="75" y="987.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="75" dy="0">Tickets 工单系统</tspan></text></g> <g><line id="actor9" x1="3028.5" y1="65" x2="3028.5" y2="955" stroke-width="0.5px" stroke="#999" name="BI"></line><g id="root-9"><rect x="2937.5" y="0" fill="#eaeaea" stroke="#666" width="182" height="65" name="BI" rx="3" ry="3"></rect><text x="3028.5" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="3028.5" dy="0">OneDay 仪表盘 / 报表</tspan></text></g></g> <g><line id="actor8" x1="2772" y1="65" x2="2772" y2="955" stroke-width="0.5px" stroke="#999" name="CB"></line><g id="root-8"><rect x="2656.5" y="0" fill="#eaeaea" stroke="#666" width="231" height="65" name="CB" rx="3" ry="3"></rect><text x="2772" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="2772" dy="0">TicketsCardCallbackHandler</tspan></text></g></g> <g><line id="actor7" x1="2436" y1="65" x2="2436" y2="955" stroke-width="0.5px" stroke="#999" name="CARD"></line><g id="root-7"><rect x="2338" y="0" fill="#eaeaea" stroke="#666" width="196" height="65" name="CARD" rx="3" ry="3"></rect><text x="2436" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="2436" dy="0">钉钉互动卡片（运营群）</tspan></text></g></g> <g><line id="actor6" x1="2198" y1="65" x2="2198" y2="955" stroke-width="0.5px" stroke="#999" name="DB"></line><g id="root-6"><rect x="2108" y="0" fill="#eaeaea" stroke="#666" width="180" height="65" name="DB" rx="3" ry="3"></rect><text x="2198" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="2198" dy="0">vip_ai_config（落库）</tspan></text></g></g> <g><line id="actor5" x1="1919.5" y1="65" x2="1919.5" y2="955" stroke-width="0.5px" stroke="#999" name="MC"></line><g id="root-5"><rect x="1781" y="0" fill="#eaeaea" stroke="#666" width="277" height="65" name="MC" rx="3" ry="3"></rect><text x="1919.5" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="1919.5" dy="0">memberCheckAnswer（排查本体）</tspan></text></g></g> <g><line id="actor4" x1="1529.5" y1="65" x2="1529.5" y2="955" stroke-width="0.5px" stroke="#999" name="TA"></line><g id="root-4"><rect x="1399" y="0" fill="#eaeaea" stroke="#666" width="261" height="65" name="TA" rx="3" ry="3"></rect><text x="1529.5" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="1529.5" dy="0">ticketSmartAgent（工单编排层）</tspan></text></g></g> <g><line id="actor3" x1="1198" y1="65" x2="1198" y2="955" stroke-width="0.5px" stroke="#999" name="EP"></line><g id="root-3"><rect x="1047" y="0" fill="#eaeaea" stroke="#666" width="302" height="65" name="EP" rx="3" ry="3"></rect><text x="1198" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="1198" dy="0">TicketsWorkOrderEnhancedProcessor</tspan></text></g></g> <g><line id="actor2" x1="868.5" y1="65" x2="868.5" y2="955" stroke-width="0.5px" stroke="#999" name="AD"></line><g id="root-2"><rect x="740" y="0" fill="#eaeaea" stroke="#666" width="257" height="65" name="AD" rx="3" ry="3"></rect><text x="868.5" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="868.5" dy="0">TicketsWorkOrderAsyncAdapter</tspan></text></g></g> <g><line id="actor1" x1="297.5" y1="65" x2="297.5" y2="955" stroke-width="0.5px" stroke="#999" name="MQ"></line><g id="root-1"><rect x="200" y="0" fill="#eaeaea" stroke="#666" width="195" height="65" name="MQ" rx="3" ry="3"></rect><text x="297.5" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="297.5" dy="0">MetaQ (TICKETS topic)</tspan></text></g></g> <g><line id="actor0" x1="75" y1="65" x2="75" y2="955" stroke-width="0.5px" stroke="#999" name="TK"></line><g id="root-0"><rect x="0" y="0" fill="#eaeaea" stroke="#666" width="150" height="65" name="TK" rx="3" ry="3"></rect><text x="75" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="75" dy="0">Tickets 工单系统</tspan></text></g></g> <g></g><defs><symbol id="computer" width="24" height="24"><path transform="scale(.5)" d="M2 2v13h20v-13h-20zm18 11h-16v-9h16v9zm-10.228 6l.466-1h3.524l.467 1h-4.457zm14.228 3h-24l2-6h2.104l-1.33 4h18.45l-1.297-4h2.073l2 6zm-5-10h-14v-7h14v7z"></path></symbol></defs><defs><symbol id="database" fill-rule="evenodd" clip-rule="evenodd"><path transform="scale(.5)" d="M12.258.001l.256.004.255.005.253.008.251.01.249.012.247.015.246.016.242.019.241.02.239.023.236.024.233.027.231.028.229.031.225.032.223.034.22.036.217.038.214.04.211.041.208.043.205.045.201.046.198.048.194.05.191.051.187.053.183.054.18.056.175.057.172.059.168.06.163.061.16.063.155.064.15.066.074.033.073.033.071.034.07.034.069.035.068.035.067.035.066.035.064.036.064.036.062.036.06.036.06.037.058.037.058.037.055.038.055.038.053.038.052.038.051.039.05.039.048.039.047.039.045.04.044.04.043.04.041.04.04.041.039.041.037.041.036.041.034.041.033.042.032.042.03.042.029.042.027.042.026.043.024.043.023.043.021.043.02.043.018.044.017.043.015.044.013.044.012.044.011.045.009.044.007.045.006.045.004.045.002.045.001.045v17l-.001.045-.002.045-.004.045-.006.045-.007.045-.009.044-.011.045-.012.044-.013.044-.015.044-.017.043-.018.044-.02.043-.021.043-.023.043-.024.043-.026.043-.027.042-.029.042-.03.042-.032.042-.033.042-.034.041-.036.041-.037.041-.039.041-.04.041-.041.04-.043.04-.044.04-.045.04-.047.039-.048.039-.05.039-.051.039-.052.038-.053.038-.055.038-.055.038-.058.037-.058.037-.06.037-.06.036-.062.036-.064.036-.064.036-.066.035-.067.035-.068.035-.069.035-.07.034-.071.034-.073.033-.074.033-.15.066-.155.064-.16.063-.163.061-.168.06-.172.059-.175.057-.18.056-.183.054-.187.053-.191.051-.194.05-.198.048-.201.046-.205.045-.208.043-.211.041-.214.04-.217.038-.22.036-.223.034-.225.032-.229.031-.231.028-.233.027-.236.024-.239.023-.241.02-.242.019-.246.016-.247.015-.249.012-.251.01-.253.008-.255.005-.256.004-.258.001-.258-.001-.256-.004-.255-.005-.253-.008-.251-.01-.249-.012-.247-.015-.245-.016-.243-.019-.241-.02-.238-.023-.236-.024-.234-.027-.231-.028-.228-.031-.226-.032-.223-.034-.22-.036-.217-.038-.214-.04-.211-.041-.208-.043-.204-.045-.201-.046-.198-.048-.195-.05-.19-.051-.187-.053-.184-.054-.179-.056-.176-.057-.172-.059-.167-.06-.164-.061-.159-.063-.155-.064-.151-.066-.074-.033-.072-.033-.072-.034-.07-.034-.069-.035-.068-.035-.067-.035-.066-.035-.064-.036-.063-.036-.062-.036-.061-.036-.06-.037-.058-.037-.057-.037-.056-.038-.055-.038-.053-.038-.052-.038-.051-.039-.049-.039-.049-.039-.046-.039-.046-.04-.044-.04-.043-.04-.041-.04-.04-.041-.039-.041-.037-.041-.036-.041-.034-.041-.033-.042-.032-.042-.03-.042-.029-.042-.027-.042-.026-.043-.024-.043-.023-.043-.021-.043-.02-.043-.018-.044-.017-.043-.015-.044-.013-.044-.012-.044-.011-.045-.009-.044-.007-.045-.006-.045-.004-.045-.002-.045-.001-.045v-17l.001-.045.002-.045.004-.045.006-.045.007-.045.009-.044.011-.045.012-.044.013-.044.015-.044.017-.043.018-.044.02-.043.021-.043.023-.043.024-.043.026-.043.027-.042.029-.042.03-.042.032-.042.033-.042.034-.041.036-.041.037-.041.039-.041.04-.041.041-.04.043-.04.044-.04.046-.04.046-.039.049-.039.049-.039.051-.039.052-.038.053-.038.055-.038.056-.038.057-.037.058-.037.06-.037.061-.036.062-.036.063-.036.064-.036.066-.035.067-.035.068-.035.069-.035.07-.034.072-.034.072-.033.074-.033.151-.066.155-.064.159-.063.164-.061.167-.06.172-.059.176-.057.179-.056.184-.054.187-.053.19-.051.195-.05.198-.048.201-.046.204-.045.208-.043.211-.041.214-.04.217-.038.22-.036.223-.034.226-.032.228-.031.231-.028.234-.027.236-.024.238-.023.241-.02.243-.019.245-.016.247-.015.249-.012.251-.01.253-.008.255-.005.256-.004.258-.001.258.001zm-9.258 20.499v.01l.001.021.003.021.004.022.005.021.006.022.007.022.009.023.01.022.011.023.012.023.013.023.015.023.016.024.017.023.018.024.019.024.021.024.022.025.023.024.024.025.052.049.056.05.061.051.066.051.07.051.075.051.079.052.084.052.088.052.092.052.097.052.102.051.105.052.11.052.114.051.119.051.123.051.127.05.131.05.135.05.139.048.144.049.147.047.152.047.155.047.16.045.163.045.167.043.171.043.176.041.178.041.183.039.187.039.19.037.194.035.197.035.202.033.204.031.209.03.212.029.216.027.219.025.222.024.226.021.23.02.233.018.236.016.24.015.243.012.246.01.249.008.253.005.256.004.259.001.26-.001.257-.004.254-.005.25-.008.247-.011.244-.012.241-.014.237-.016.233-.018.231-.021.226-.021.224-.024.22-.026.216-.027.212-.028.21-.031.205-.031.202-.034.198-.034.194-.036.191-.037.187-.039.183-.04.179-.04.175-.042.172-.043.168-.044.163-.045.16-.046.155-.046.152-.047.148-.048.143-.049.139-.049.136-.05.131-.05.126-.05.123-.051.118-.052.114-.051.11-.052.106-.052.101-.052.096-.052.092-.052.088-.053.083-.051.079-.052.074-.052.07-.051.065-.051.06-.051.056-.05.051-.05.023-.024.023-.025.021-.024.02-.024.019-.024.018-.024.017-.024.015-.023.014-.024.013-.023.012-.023.01-.023.01-.022.008-.022.006-.022.006-.022.004-.022.004-.021.001-.021.001-.021v-4.127l-.077.055-.08.053-.083.054-.085.053-.087.052-.09.052-.093.051-.095.05-.097.05-.1.049-.102.049-.105.048-.106.047-.109.047-.111.046-.114.045-.115.045-.118.044-.12.043-.122.042-.124.042-.126.041-.128.04-.13.04-.132.038-.134.038-.135.037-.138.037-.139.035-.142.035-.143.034-.144.033-.147.032-.148.031-.15.03-.151.03-.153.029-.154.027-.156.027-.158.026-.159.025-.161.024-.162.023-.163.022-.165.021-.166.02-.167.019-.169.018-.169.017-.171.016-.173.015-.173.014-.175.013-.175.012-.177.011-.178.01-.179.008-.179.008-.181.006-.182.005-.182.004-.184.003-.184.002h-.37l-.184-.002-.184-.003-.182-.004-.182-.005-.181-.006-.179-.008-.179-.008-.178-.01-.176-.011-.176-.012-.175-.013-.173-.014-.172-.015-.171-.016-.17-.017-.169-.018-.167-.019-.166-.02-.165-.021-.163-.022-.162-.023-.161-.024-.159-.025-.157-.026-.156-.027-.155-.027-.153-.029-.151-.03-.15-.03-.148-.031-.146-.032-.145-.033-.143-.034-.141-.035-.14-.035-.137-.037-.136-.037-.134-.038-.132-.038-.13-.04-.128-.04-.126-.041-.124-.042-.122-.042-.12-.044-.117-.043-.116-.045-.113-.045-.112-.046-.109-.047-.106-.047-.105-.048-.102-.049-.1-.049-.097-.05-.095-.05-.093-.052-.09-.051-.087-.052-.085-.053-.083-.054-.08-.054-.077-.054v4.127zm0-5.654v.011l.001.021.003.021.004.021.005.022.006.022.007.022.009.022.01.022.011.023.012.023.013.023.015.024.016.023.017.024.018.024.019.024.021.024.022.024.023.025.024.024.052.05.056.05.061.05.066.051.07.051.075.052.079.051.084.052.088.052.092.052.097.052.102.052.105.052.11.051.114.051.119.052.123.05.127.051.131.05.135.049.139.049.144.048.147.048.152.047.155.046.16.045.163.045.167.044.171.042.176.042.178.04.183.04.187.038.19.037.194.036.197.034.202.033.204.032.209.03.212.028.216.027.219.025.222.024.226.022.23.02.233.018.236.016.24.014.243.012.246.01.249.008.253.006.256.003.259.001.26-.001.257-.003.254-.006.25-.008.247-.01.244-.012.241-.015.237-.016.233-.018.231-.02.226-.022.224-.024.22-.025.216-.027.212-.029.21-.03.205-.032.202-.033.198-.035.194-.036.191-.037.187-.039.183-.039.179-.041.175-.042.172-.043.168-.044.163-.045.16-.045.155-.047.152-.047.148-.048.143-.048.139-.05.136-.049.131-.05.126-.051.123-.051.118-.051.114-.052.11-.052.106-.052.101-.052.096-.052.092-.052.088-.052.083-.052.079-.052.074-.051.07-.052.065-.051.06-.05.056-.051.051-.049.023-.025.023-.024.021-.025.02-.024.019-.024.018-.024.017-.024.015-.023.014-.023.013-.024.012-.022.01-.023.01-.023.008-.022.006-.022.006-.022.004-.021.004-.022.001-.021.001-.021v-4.139l-.077.054-.08.054-.083.054-.085.052-.087.053-.09.051-.093.051-.095.051-.097.05-.1.049-.102.049-.105.048-.106.047-.109.047-.111.046-.114.045-.115.044-.118.044-.12.044-.122.042-.124.042-.126.041-.128.04-.13.039-.132.039-.134.038-.135.037-.138.036-.139.036-.142.035-.143.033-.144.033-.147.033-.148.031-.15.03-.151.03-.153.028-.154.028-.156.027-.158.026-.159.025-.161.024-.162.023-.163.022-.165.021-.166.02-.167.019-.169.018-.169.017-.171.016-.173.015-.173.014-.175.013-.175.012-.177.011-.178.009-.179.009-.179.007-.181.007-.182.005-.182.004-.184.003-.184.002h-.37l-.184-.002-.184-.003-.182-.004-.182-.005-.181-.007-.179-.007-.179-.009-.178-.009-.176-.011-.176-.012-.175-.013-.173-.014-.172-.015-.171-.016-.17-.017-.169-.018-.167-.019-.166-.02-.165-.021-.163-.022-.162-.023-.161-.024-.159-.025-.157-.026-.156-.027-.155-.028-.153-.028-.151-.03-.15-.03-.148-.031-.146-.033-.145-.033-.143-.033-.141-.035-.14-.036-.137-.036-.136-.037-.134-.038-.132-.039-.13-.039-.128-.04-.126-.041-.124-.042-.122-.043-.12-.043-.117-.044-.116-.044-.113-.046-.112-.046-.109-.046-.106-.047-.105-.048-.102-.049-.1-.049-.097-.05-.095-.051-.093-.051-.09-.051-.087-.053-.085-.052-.083-.054-.08-.054-.077-.054v4.139zm0-5.666v.011l.001.02.003.022.004.021.005.022.006.021.007.022.009.023.01.022.011.023.012.023.013.023.015.023.016.024.017.024.018.023.019.024.021.025.022.024.023.024.024.025.052.05.056.05.061.05.066.051.07.051.075.052.079.051.084.052.088.052.092.052.097.052.102.052.105.051.11.052.114.051.119.051.123.051.127.05.131.05.135.05.139.049.144.048.147.048.152.047.155.046.16.045.163.045.167.043.171.043.176.042.178.04.183.04.187.038.19.037.194.036.197.034.202.033.204.032.209.03.212.028.216.027.219.025.222.024.226.021.23.02.233.018.236.017.24.014.243.012.246.01.249.008.253.006.256.003.259.001.26-.001.257-.003.254-.006.25-.008.247-.01.244-.013.241-.014.237-.016.233-.018.231-.02.226-.022.224-.024.22-.025.216-.027.212-.029.21-.03.205-.032.202-.033.198-.035.194-.036.191-.037.187-.039.183-.039.179-.041.175-.042.172-.043.168-.044.163-.045.16-.045.155-.047.152-.047.148-.048.143-.049.139-.049.136-.049.131-.051.126-.05.123-.051.118-.052.114-.051.11-.052.106-.052.101-.052.096-.052.092-.052.088-.052.083-.052.079-.052.074-.052.07-.051.065-.051.06-.051.056-.05.051-.049.023-.025.023-.025.021-.024.02-.024.019-.024.018-.024.017-.024.015-.023.014-.024.013-.023.012-.023.01-.022.01-.023.008-.022.006-.022.006-.022.004-.022.004-.021.001-.021.001-.021v-4.153l-.077.054-.08.054-.083.053-.085.053-.087.053-.09.051-.093.051-.095.051-.097.05-.1.049-.102.048-.105.048-.106.048-.109.046-.111.046-.114.046-.115.044-.118.044-.12.043-.122.043-.124.042-.126.041-.128.04-.13.039-.132.039-.134.038-.135.037-.138.036-.139.036-.142.034-.143.034-.144.033-.147.032-.148.032-.15.03-.151.03-.153.028-.154.028-.156.027-.158.026-.159.024-.161.024-.162.023-.163.023-.165.021-.166.02-.167.019-.169.018-.169.017-.171.016-.173.015-.173.014-.175.013-.175.012-.177.01-.178.01-.179.009-.179.007-.181.006-.182.006-.182.004-.184.003-.184.001-.185.001-.185-.001-.184-.001-.184-.003-.182-.004-.182-.006-.181-.006-.179-.007-.179-.009-.178-.01-.176-.01-.176-.012-.175-.013-.173-.014-.172-.015-.171-.016-.17-.017-.169-.018-.167-.019-.166-.02-.165-.021-.163-.023-.162-.023-.161-.024-.159-.024-.157-.026-.156-.027-.155-.028-.153-.028-.151-.03-.15-.03-.148-.032-.146-.032-.145-.033-.143-.034-.141-.034-.14-.036-.137-.036-.136-.037-.134-.038-.132-.039-.13-.039-.128-.041-.126-.041-.124-.041-.122-.043-.12-.043-.117-.044-.116-.044-.113-.046-.112-.046-.109-.046-.106-.048-.105-.048-.102-.048-.1-.05-.097-.049-.095-.051-.093-.051-.09-.052-.087-.052-.085-.053-.083-.053-.08-.054-.077-.054v4.153zm8.74-8.179l-.257.004-.254.005-.25.008-.247.011-.244.012-.241.014-.237.016-.233.018-.231.021-.226.022-.224.023-.22.026-.216.027-.212.028-.21.031-.205.032-.202.033-.198.034-.194.036-.191.038-.187.038-.183.04-.179.041-.175.042-.172.043-.168.043-.163.045-.16.046-.155.046-.152.048-.148.048-.143.048-.139.049-.136.05-.131.05-.126.051-.123.051-.118.051-.114.052-.11.052-.106.052-.101.052-.096.052-.092.052-.088.052-.083.052-.079.052-.074.051-.07.052-.065.051-.06.05-.056.05-.051.05-.023.025-.023.024-.021.024-.02.025-.019.024-.018.024-.017.023-.015.024-.014.023-.013.023-.012.023-.01.023-.01.022-.008.022-.006.023-.006.021-.004.022-.004.021-.001.021-.001.021.001.021.001.021.004.021.004.022.006.021.006.023.008.022.01.022.01.023.012.023.013.023.014.023.015.024.017.023.018.024.019.024.02.025.021.024.023.024.023.025.051.05.056.05.06.05.065.051.07.052.074.051.079.052.083.052.088.052.092.052.096.052.101.052.106.052.11.052.114.052.118.051.123.051.126.051.131.05.136.05.139.049.143.048.148.048.152.048.155.046.16.046.163.045.168.043.172.043.175.042.179.041.183.04.187.038.191.038.194.036.198.034.202.033.205.032.21.031.212.028.216.027.22.026.224.023.226.022.231.021.233.018.237.016.241.014.244.012.247.011.25.008.254.005.257.004.26.001.26-.001.257-.004.254-.005.25-.008.247-.011.244-.012.241-.014.237-.016.233-.018.231-.021.226-.022.224-.023.22-.026.216-.027.212-.028.21-.031.205-.032.202-.033.198-.034.194-.036.191-.038.187-.038.183-.04.179-.041.175-.042.172-.043.168-.043.163-.045.16-.046.155-.046.152-.048.148-.048.143-.048.139-.049.136-.05.131-.05.126-.051.123-.051.118-.051.114-.052.11-.052.106-.052.101-.052.096-.052.092-.052.088-.052.083-.052.079-.052.074-.051.07-.052.065-.051.06-.05.056-.05.051-.05.023-.025.023-.024.021-.024.02-.025.019-.024.018-.024.017-.023.015-.024.014-.023.013-.023.012-.023.01-.023.01-.022.008-.022.006-.023.006-.021.004-.022.004-.021.001-.021.001-.021-.001-.021-.001-.021-.004-.021-.004-.022-.006-.021-.006-.023-.008-.022-.01-.022-.01-.023-.012-.023-.013-.023-.014-.023-.015-.024-.017-.023-.018-.024-.019-.024-.02-.025-.021-.024-.023-.024-.023-.025-.051-.05-.056-.05-.06-.05-.065-.051-.07-.052-.074-.051-.079-.052-.083-.052-.088-.052-.092-.052-.096-.052-.101-.052-.106-.052-.11-.052-.114-.052-.118-.051-.123-.051-.126-.051-.131-.05-.136-.05-.139-.049-.143-.048-.148-.048-.152-.048-.155-.046-.16-.046-.163-.045-.168-.043-.172-.043-.175-.042-.179-.041-.183-.04-.187-.038-.191-.038-.194-.036-.198-.034-.202-.033-.205-.032-.21-.031-.212-.028-.216-.027-.22-.026-.224-.023-.226-.022-.231-.021-.233-.018-.237-.016-.241-.014-.244-.012-.247-.011-.25-.008-.254-.005-.257-.004-.26-.001-.26.001z"></path></symbol></defs><defs><symbol id="clock" width="24" height="24"><path transform="scale(.5)" d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.848 12.459c.202.038.202.333.001.372-1.907.361-6.045 1.111-6.547 1.111-.719 0-1.301-.582-1.301-1.301 0-.512.77-5.447 1.125-7.445.034-.192.312-.181.343.014l.985 6.238 5.394 1.011z"></path></symbol></defs><defs><marker id="arrowhead" refX="7.9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M -1 0 L 10 5 L 0 10 z"></path></marker></defs><defs><marker id="crosshead" markerWidth="15" markerHeight="8" orient="auto" refX="4" refY="4.5"><path fill="none" stroke="#000000" stroke-width="1pt" d="M 1,2 L 6,7 M 6,2 L 1,7" style="stroke-dasharray: 0, 0;"></path></marker></defs><defs><marker id="filled-head" refX="15.5" refY="7" markerWidth="20" markerHeight="28" orient="auto"><path d="M 18,7 L9,13 L14,7 L9,1 Z"></path></marker></defs><defs><marker id="sequencenumber" refX="15" refY="15" markerWidth="60" markerHeight="40" orient="auto"><circle cx="15" cy="15" r="6"></circle></marker></defs><text x="185" y="80" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">工单创建，推送消息</text> <line x1="76" y1="121" x2="293.5" y2="121" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="582" y="136" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">consumeMessage（TICKET_ACTION_CREATE / REFERRAL_STC）</text> <line x1="298.5" y1="177" x2="864.5" y2="177" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="1032" y="192" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">开关命中增强链路 → process()</text> <line x1="869.5" y1="233" x2="1194" y2="233" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="1199" y="248" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">①查结构化工单 ②Tair幂等 ③生成 sessionId</text> <path d="M 1199,289 C 1259,279 1259,319 1199,309" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></path><text x="1697" y="334" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">④落库 AiConfig（status=处理中）</text> <line x1="1199" y1="375" x2="2194" y2="375" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="1362" y="390" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">⑤请求 idealab SDK 发起会话</text> <line x1="1199" y1="431" x2="1525.5" y2="431" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="1723" y="446" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">工单处理逻辑后，调用排查本体做账号级诊断</text> <line x1="1530.5" y1="487" x2="1915.5" y2="487" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="1726" y="502" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">返回结构化诊断结论</text> <line x1="1918.5" y1="543" x2="1533.5" y2="543" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="stroke-dasharray: 3, 3; fill: none;"></line><text x="1365" y="558" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">回传诊断结果（Markdown）</text> <line x1="1528.5" y1="599" x2="1202" y2="599" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="stroke-dasharray: 3, 3; fill: none;"></line><text x="1697" y="614" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">更新诊断结果 + 诊断耗时</text> <line x1="1199" y1="655" x2="2194" y2="655" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="1816" y="670" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">⑥投放互动卡片（outTrackId = aiConfigCode）</text> <line x1="1199" y1="711" x2="2432" y2="711" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="2603" y="726" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">运营点击按钮（Stream 长连接回调）</text> <line x1="2437" y1="767" x2="2768" y2="767" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="stroke-dasharray: 3, 3; fill: none;"></line><text x="2487" y="782" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">分段锁串行化，写反馈 + 操作人 + 时间</text> <line x1="2771" y1="823" x2="2202" y2="823" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="2606" y="838" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">TicketsCardUpdater 回写卡片状态</text> <line x1="2771" y1="879" x2="2440" y2="879" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="2612" y="894" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">离线 ODPS 清洗 → 报表 + 采纳打标</text><line x1="2199" y1="935" x2="3024.5" y2="935" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line></svg>

### 2.2 入口：消息接入（这是整条链路的起点）

一条工单被创建时， `xinxuan-setup` 监听的 MetaQ topic 会推送一条消息。订阅的 tag 是 `TICKET_ACTION_CREATE || TICKET_ACTION_REFERRAL_STC` （工单创建 + 工单转交）。

**代码入口** ： `com.taobao.xinxuan.member.ai.agent.adapter.input.interaction.message.TicketsWorkOrderAsyncAdapter#consumeMessage`

### 2.3 主流程：增强处理器的 7 步

**代码入口** ： `com.taobao.xinxuan.member.ai.agent.processor.TicketsWorkOrderEnhancedProcessor#process`

这是整条链路的核心编排，7 步环环相扣：

| 步骤 | 动作 | 关键设计 |
| --- | --- | --- |
| 0 | **Tair 幂等** | 分批发布时消息会重投，已处理完成的工单直接跳过 |
| 1 | **查询结构化工单** | 通过 `TicketsService.find` 拿到 title / description / createTime / link |
| 2 | **字段提取与合并** | **工单标题合并进描述** ——标题往往承载分类关键信息（如"订单未返天猫积分"），仅凭描述无法分类 |
| 3 | **生成 sessionId + 落库** | sessionId 在此生成而非下沉， **保证日志、落库记录、实际调用 Agent 用的是同一个会话 ID** （这一点对第四部分的Loop回溯至关重要） |
| 4 | **调用 idealab Agent** | `idealabFacade.streamCallByIdeaLabApi` ，把工单描述作为 question 打给 `ticketSmartAgent` |
| 5 | **更新诊断结果 + 耗时** | 耗时口径是"消息开始消费 → 诊断结果返回"，供运营面板统计各业务分类平均耗时 |
| 6 | **投放钉钉互动卡片** | 见 2.5 |
| 7 | **打处理完成标记** | 后续重投的相同工单不再处理 |

![image.png](<../images/redirect_46.png>)

### 2.4 双 Agent 协作：编排层 → 排查本体

第 4 步的"调用 Agent"，实际上触发的是一个 **双层 Agent 协作** ：

1. **请求先打到** `**ticketSmartAgent**` **（工单智能助手-增强型，应用层/编排型）** ：它承担工单处理逻辑（信息提取、场景预处理）；
2. `**ticketSmartAgent**` **再调用** `**memberCheckAnswer**` **（会员排查 Agent 本体）** ：进行 **账号链路级别** 的深度问题排查，调用知识库、工具、skill、MCP 等；
3. 排查本体产出结构化诊断结论后，回传给编排层做 **结构化输出** （文本裁剪、Markdown 转换），最终回到 `EnhancedProcessor` 。

> 这种"编排层 + 本体"的分工，让 **业务定制** （工单场景怎么接、结果怎么呈现）与 **核心排查能力** （怎么查账号、怎么归因）解耦：本体可以被多个应用层（Tickets、VOC 舆情）复用，而每个应用层可以独立演进自己的入口和输出。

`**ticketSmartAgent**` **（工单智能助手-增强型，应用层/编排型）**
![image.png](<../images/redirect_47.png>)

`**memberCheckAnswer**` **（会员排查 Agent 本体）**
![image.png](<../images/redirect_48.png>)

### 2.5 结果回传：钉钉互动卡片

诊断结论通过钉钉互动卡片推送到运营群。核心方法 `sendDingTalkInteractiveCard` ：

getAccessToken(appKey, appSecret)
  → createAndDeliver(
        cardTemplateId,          // 资源位配置（高频变更）
        outTrackId = aiConfigCode,   // ★ 关键：直接复用 aiConfigCode
        callbackType = "STREAM",
        openSpaceId,             // 资源位配置，决定发到哪个群
        robotCode,               // 机器人须已在该群内
        cardData.cardParamMap)

> **关键设计：** `**outTrackId**` **直接复用** `**aiConfigCode**` **。** 钉钉回调只带 `outTrackId` ，两者相同即可用它直接反查记录， **无需额外映射表** ；卡片更新接口也用它定位卡片。

卡片承载 **四项人工反馈按钮** ：

| 按钮 ID | 语义 | 写入字段 |
| --- | --- | --- |
| `requestIsAccept` | 是否采纳 | `knowledgeAdopted` |
| `requsetIsCover` | 是否覆盖 | `knowledgeOverridden` |
| `questQueryScene` | 问题分类 | `tagCategory` |
| `requestInput` | 追加评论 | `diagnosisComments[]` （追加语义） |

**示意图：**

![image.png](<../images/redirect_49.png>)

### 2.6 卡片回调：Stream 长连接

**代码入口** ： `com.taobao.xinxuan.member.ai.agent.stream.TicketsCardCallbackHandler#handle`

运营点击卡片按钮后，通过钉钉 **Stream 长连接** （topic `/v1.0/card/instances/callback` ）回调到服务端。处理流程：

![image.png](<../images/redirect_50.png>)

这里有几个"踩过坑"沉淀下来的硬约束，很值得分享，具体见原创ATA文章 [《钉钉互动卡片接入实战：从发送到回调，踩完所有坑》](https://ata.atatech.org/articles/11020736039?spm=ata.25287382.0.0.45a87536RywkCR) ：

- **同一 client-id 同一时间只能有一个活跃 Stream 服务** ：多机都注册会互相顶开连接，且被顶掉的机器 websocket 仍是 ESTABLISHED、日志仍打 `started successfully` ，导致回调 **静默丢失、极难定位** 。因此设计为 **只允许指定 IP 的单台机器注册** （IP 从策略平台资源位读取）。
- **按钮 ID 与回显变量是两套命名** ：解析用 `request*` / `quest*` ，回写状态用 `response*` ，且回写传的是中文展示文案而非原始编码。
- **不同组件回传结构不同** ：按钮/单选回传的是对象 `{index, value}` ，输入框回传的是 **纯字符串** ——不能无脑用 `getJSONObject` 解析。

### 2.7 落库、报表与人工打标

![image.png](<../images/redirect_51.png>)

- **落库** ：复用 `vip_ai_config` 单表， `type = tickets_work_order_enhanced` ， `data` 字段用 **JSON 承载全部业务数据** （新增字段时 DTO/Adapter/DAL/前端协议全都不用改，这是本方案的关键设计）。
- **HSF 查询/管理服务** （ `member-ai-client` 协议）： `TicketsDiagnosisQueryService` （queryPage / queryByCode / queryStat）供 OneDay 仪表盘； `TicketsDiagnosisManageService` （updateFeedback / deleteByCode）支持后台补录与删除。后台管理接口 **完全不依赖 Stream** ，是回调链路的天然兜底。
- **离线报表** ： `vip_ai_config → ODPS DWD → ADS → BI 报表` ，每日全量快照重刷。排序键用 `gmtCreate` 而非 `gmtModified` （后者会被追加评论刷新）。
- **人工采纳打标** ：业务最终在 **群聊卡片按钮** 或 [Tickets 工单智能助手管理后台] 上完成诊断采纳打标，这些反馈既是效果度量，也是 Agent Loop 的人工信号源。

[Tickets 工单智能助手管理后台]界面示意图：

从效果上来看：

准确率指标：目前全量工单累计诊断采纳率基本维持在 **80% **左右浮动，9月份统计数据诊断采纳率达** 87.8%**

耗时性能指标：P95工单诊断耗时在 **270s** 以内，约4.5min（claude-opus-4.8）

提效指标：未覆盖问题完结时长P95约为已采纳问题的2.3倍，未采纳问题完结时长P95约为已采纳问题的2.1倍

成本估算：每条工单花费token约等于200万，<=0.5元

诊断明细：
![image.png](<../images/redirect_52.png>)

准确率指标：
![image.png](<../images/redirect_53.png>)

诊断详情：
![image.png](<../images/redirect_54.png>)

诊断耗时指标：
![image.png](<../images/redirect_55.png>)

提效指标：
![image.png](<../images/redirect_56.png>)

成本估算：
![image.png](<../images/redirect_57.png>) ![image.png](<../images/redirect_58.png>)

---

## 三、知识上下文组织介绍

这一部分回答三个问题： **数据源如何接入？知识如何分层？agent 与 skill 的能力如何分层？**

### 3.1 数据源如何接入：工具在代码仓库中的来源

会员排查 Agent 的每一个"原子工具"，本质上都是一次对底层数据/服务的封装。通过对 `starrynight/xinxuan-setup` 仓库的代码检索，可以清晰地看到工具的 **来源与分层封装模式** ：

![image.png](<../images/redirect_59.png>)

**核心结论：会员排查 Agent 的工具不是"直连底层"，而是由** `**xinxuan-setup**` **的** `**setup-service**` **统一自建了一层 HSF Provider 做封装聚合，最终由idelab工具箱进行注册（底层本质其实也是一个MCP服务）。**

这样做的价值：**把散落在交易、大会员、积分、消费券等多个二方系统的能力，收敛成一组语义清晰、入参规范、结果可控、且做过脱敏的"排查专用工具"**，Agent 只需面对统一的工具契约，而不必理解每个底层系统的协议差异。

目前原子工具已接入 **20+**，统一归类在"舆情诊断 Agent 工具箱"，按业务域可分为五大工具簇：详情见： [《AI答疑/排查架构&进展》](https://alidocs.dingtalk.com/i/nodes/14lgGw3P8vxjwogPCgGx0b45V5daZ90D?utm_scene=person_space&iframeQuery=anchorId%3Duu_mrsr4ndx98nazgwvpnk)

| 工具簇 | 代表工具 | 底层来源 |
| --- | --- | --- |
| 信息查询 | `queryBlackVipInfo` / `getUserPointInfo` / `queryPointDetail` | setup-service（cobweb/black、cobweb/point）+ 交易平台 |
| 资格与活动 | `queryNpickOne` / `queryQualificationInvalidReason` / `whetherHitFromLimit` | setup-service + 活动/资格系统 |
| 交易与退款 | `analyzeOrderNotReturnPoint` / `queryRefundPointToRemainDetailList` / 退卡明细 | setup-service（cobweb/point）+ BSP 规则引擎 |
| 系统排查 | SLS 日志 / Hologres SQL / ChangeFree / 策略平台变更 | 可观测与数仓（模板化查询） |
| 规则判断 | `judgeCanOpenBlackVip` / `queryBenefitinfo` | setup-service + 大会员权益 |

### 3.2 知识如何分层：排查知识库 + 规则知识库

知识库整体分为 **两大类** ，分工明确：详情见： [《AI答疑/排查架构&进展》](https://alidocs.dingtalk.com/i/nodes/14lgGw3P8vxjwogPCgGx0b45V5daZ90D?utm_scene=person_space&iframeQuery=anchorId%3Duu_mrsr0rcbvcmy1rinfi)

![image.png](<../images/redirect_60.png>)

这套分层在于： **排查知识库是 Agent 的"方法论"，规则知识库是业务的"事实源"。** 前者告诉模型"该用哪个工具、怎么用、结果怎么读"，后者告诉模型"这个业务本来是怎么规定的"。二者在 L2 层共同构成了 Agent 行为的约束边界——无论走 SOP 还是 Self-Plan，都必须溯源到知识库， **禁止臆造查询语句、禁止自创归因** 。

> 一个真实的知识分层样例（取自评测报告 279ff1bd）：天猫积分"加钱兑退款"工单，Agent 从 **规则知识库** （积分概念文档 1.2.2「退积分 = 扣卖家保证金赔付」）拿到机制根因，又从 **排查知识库** （ `queryRefundPointToRemainDetailList` 工具描述"查不到 = 未走标准回退流程"）确认工具边界，最终给出"商家不转保 = 积分回退资金来源被切断 = 非系统故障"的准确结论—— **两类知识库交叉印证，缺一不可** 。

### 3.3 agent 与 skill 的能力分层

系统里存在两类"能力单元"，它们的职责边界需要厘清：

| 维度 | **Agent 能力** （如 memberCheckAnswer 的 6 大能力） | **Skill 能力** （如 a1 / odps-analyze / dingtalk-docs） |
| --- | --- | --- |
| 定位 | **业务语义级** ：一个能力对应一类业务问题的诊断闭环 | **工具原子级** ：一个 skill 封装一组通用的平台操作 |
| 知识依赖 | 强依赖排查知识库 + 规则知识库 + 构建样例 | 依赖 skill 自身的 SKILL.md 指令与参数约定 |
| 编排方式 | 由 L4 的 SOP / Self-Plan 动态编排 | 由主 Agent 按 SKILL.md 显式调用 |
| 演进节奏 | 随业务场景快速迭代（提示词/样例/知识库） | 相对稳定，作为通用基础设施复用 |
| 举例 | 天猫积分排查、消费券排查 | `a1` （代码仓库/CI/MR）、 `odps-analyze` （数仓取数）、 `dingtalk-docs` （文档操作） |

**能力分层的核心原则：Agent 负责"理解业务、决定查什么"，Skill/工具负责"高效、规范地把数据取回来"。** 越靠近业务语义的能力变化越快、越需要知识库和样例来约束；越靠近平台操作的 skill 越稳定、越强调复用。这种分层让业务迭代（改知识库、加样例）不必触碰底层工具，底层工具升级也不影响上层业务语义。

---

## 四、Agent Loop 实现

前三部分讲的是"Agent 如何把一条工单诊断好"。这一部分讲的是 **更重要的一件事：Agent 如何越用越聪明** ——即基于 **ideaGoal 云端文件库** ，感知 idealab Agent 的依赖产物并持续改进，形成自进化闭环。

### 4.1 为什么需要 Agent Loop

一个 LLM Agent 的诊断质量，取决于它的 **全部产物** ：系统提示词、知识库、few-shot 构建样例、工具、MCP、skill……这些东西一旦上线就静态了，而真实工单千变万化。 **如果没有一套机制持续观测"Agent 实际怎么跑的、跑得好不好、哪里可以改"，Agent 就会停在发布那天的水平。**

Agent Loop 要解决的就是这个问题： **让 Agent 的每一次真实执行都被持久化、可回溯，让优质执行成为标准，让每次执行都能反哺下一次迭代。**

### 4.2 ideaGoal 云端文件库：Loop 的物理载体

这套闭环的物理载体，是 ideaGoal 云端文件库中的一个公共目录 `问题排查Agent/` 。它的实际结构如下（真实存在、按天累积）：

![image.png](<../images/redirect_61.png>)

> **关键点：执行链会持久化在云端文件库中，便于回溯改进。** 每条日志文件名里的 `sessionId` 与第二部分 2.3 中"落库时生成的同一个 sessionId"完全对应—— **这就是"线上一次真实诊断"与"离线可回溯资产"之间的锚点** 。

### 4.3 三个 sub-agent 构成的进化闭环

Agent Loop 由三个已固化的 ideaGoal 任务（sub-agent）串联而成：

![image.png](<../images/redirect_62.png>)

#### ① 执行链日志归档（执行链日志归档_21718）

- **做什么** ：采集 AI Studio 问题排查 Agent（appCode `UmggMXyACZh` ） **上一整点小时** 的执行链日志，下钻每个 IDEAs 子 Agent 的完整调用链，按日期归档到文件库。
- **产物长什么样** ：每条归档日志（如 `279ff1bd-...md` ）包含——会话元信息（appCode、sessionId、messageId、耗时、tokens、费用、子 Agent conversationId）、用户提问原文、最终回答、以及 **IDEAs 子 Agent 内部完整执行链路** （每一步的 role、耗时、推理内容、调用了哪些工具、入参、工具返回，敏感入参已脱敏）。
- **价值** ：把"黑盒的一次 Agent 执行"变成"白盒的、可逐步复盘的文本资产"。

排查Agent - memberCheckAnswer下钻示意图：

![image.png](<../images/redirect_63.png>)

#### ② GoldSet样例提炼（金标准样例提炼_22526）

- **做什么** ：按 sessionId 抓取执行链日志，提炼成**金标准样例（goldSet）**写入标准样例集。
- **goldSet 的结构** （对齐 README schema）：样例元信息与溯源、输入、 **标准结论** （核心归因/口径修正/关键证据）、 **标准执行路径** （期望的工具调用序列与入参）、 **评分锚点与红线** （加分项/红线/可优化点）、关联资源。
- **两种类型** ： **正向金标准** （诊断正确、路径规范、证据闭环，综合期望 ≥9.0，作为"应该怎么做"的正例）和 **反例** （典型错误会话，标注错误点与正确做法）。
- **价值** ：goldSet 是整个 Loop 的"标尺"——既是自动评测的 **对照锚点** ，也是 Agent 迭代后的 **回归验证跑分基准** ，还是版本发布前的 **质量基线** 。

示意图：

![image.png](<../images/redirect_64.png>)

#### ③ 会话评测（会话评测_22150）

- **做什么** ：对某条执行链会话做 **四方交叉评测** —— `执行链日志 × memberCheckAnswer Agent × vipSentimentKnowledgeBase 知识库 × 88VIP 代码仓库` ，输出质量评测报告并推送到指定钉钉频道。
- **为什么是"四方" **：这正好呼应了前三部分的产物——用** 执行链日志** 看 Agent 实际怎么跑的，用 **memberCheckAnswer** 核对它本应具备哪些能力（如"漏用了 queryPointDetail"），用 **知识库** 验证归因是否有权威依据，用 **代码仓库** 做机制级的终极佐证（如从 `TmallPointAddMoneyBuyRefundOrderListener` 监听器代码证实"无退款单则回退逻辑永不触发"）。
- **产物长什么样** ：评测报告包含总体评分（诊断准确性/知识库引用/能力利用充分度/答复完整性/输出规范性/综合）、做得好的地方、 **可优化的点** （附具体证据与建议）、结论。
- **价值** ：产出 **迭代修正进化建议** ——明确告诉迭代者"最高优先级改进是什么"（如"把 queryPointDetail 设为积分退回场景的首选核查工具，并在结论后补充三段式行动建议"）。

任务示意图：

![image.png](<../images/redirect_65.png>)

### 4.4 闭环如何"合拢"：从产物到进化

![image.png](<../images/redirect_66.png>)

把三个 sub-agent 串起来，Agent Loop 的完整逻辑是：

1. **感知** ：线上每一次真实诊断（ `memberCheckAnswer` ）都带着落库时生成的 sessionId； `执行链日志归档` 定时把这些执行链下钻、归档到 ideaGoal 云端文件库， **让执行可回溯** 。
2. **立标** ： `金标准样例提炼` 把优质会话固化为 goldSet，**沉淀"什么是好的诊断"**。
3. **度量** ： `会话评测` 基于 Agent 的全部产物（提示词、知识库、few-shot、工具、MCP、skill）做四方交叉评测，对照 goldSet 打分， **指出差距与改进方向** 。
4. **进化** ：评测建议反哺到提示词 / SOP / 知识库 / 构建样例 / 工具的迭代；改完后再用 goldSet 回归跑分， **验证是否引入退化** ——若通过，则成为新的发布基线，进入下一轮。

> **这正是"Agent loop"的含义** ：ideaGoal 云端文件库让 idealab Agent 的依赖产物（执行链、样例、评测）被感知、被积累、被回溯；每一轮"执行 → 归档 → 立标 → 评测 → 进化"都让下一轮的 Agent 变得更准、更规范、更少幻觉。人工采纳打标（第二部分 2.7）则为这个自动闭环持续注入高质量的监督信号。

一次自迭代所经历的步骤：

![image.png](<../images/redirect_67.png>)

![image.png](<../images/redirect_68.png>)

![image.png](<../images/redirect_69.png>)

### 4.5 一张图收束全篇

![image.png](<../images/redirect_70.png>)

---

## 结语

会员问题排查 Agent 不是一个"孤立的问答机器人"，而是一套 **分层清晰、链路闭环、且能自我进化** 的系统工程：

- **纵向分层** （应用层 / 能力层 / 工具知识层）让业务定制与核心能力解耦；
- **横向链路** （消息 → 双 Agent → 卡片 → 落库 → 报表）让一条工单从诞生到反馈全程自动化；
- **知识组织** （自建 HSF 工具封装 + 排查/规则双知识库 + agent/skill 能力分层）让 Agent 有据可依、拒绝臆造；
- **Agent Loop** （执行链归档 + 金标准样例 + 会话评测，承载于 ideaGoal 云端文件库）让 Agent 的每一次执行都成为下一次进化的燃料。

这套架构的真正价值，不在于"某一次诊断答得多好"，而在于它 **建立了一条让 AI 诊断质量可观测、可度量、可持续改进的工程化路径** 。

## 致谢

项目的落地离不开多个岗位同学的紧密协作，感谢每一位参与者：

后端：宗龙、问元、林悟、藏鸣、黑烨、州舟

产品：馨伊

测试：长川

数据：来秋

IdeaLAB：张海山、本末、风业、树石、宵途

Tickets：薛宣

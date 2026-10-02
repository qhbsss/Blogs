---
title: "从0到1搭建agent -  agent原理分析及个人助手实践"
source: "https://ata.atatech.org/articles/11020641206?spm=ata.23639420.0.0.15527536X1FN3C"
author:
published:
created: 2026-05-19
description:
tags:
  - "clippings"
---
中国电商事业群-淘天集团

勋章

粉丝 37影响力 968

** 32

** 17

** 6

** 原创文章

** AI辅助优化 30%

发表到圈儿

[闲鱼技术团队](https://ata.atatech.org/community/team/137) (首发)

[ATA之家](https://ata.atatech.org/community/group/45)

[互联网业界思考](https://ata.atatech.org/community/group/104)

[阿里巴巴算法大学](https://ata.atatech.org/community/group/152)

[淘宝买菜产技团队博客](https://ata.atatech.org/community/team/765)

[成长集](https://ata.atatech.org/community/group/2203)

[AI特派员](https://ata.atatech.org/community/group/2571)

**

[占旭鹏(帆日)](https://ata.atatech.org/users/11001192288)

5月17日发表5月17日更新226次浏览

** 朗读

** 字号

** 笔记

** 分享 **

## 前言

ai 发展越来越快，对于大部分人来说，想深入参与 llm 研究的机会很少，但是大家都有机会成为 agent 开发，低成本搭建一个agent，解决自己生产生活中的问题，下文对自己近期搭建 agent 相关的内容总结和大家分享，希望相互学习，共同进步。

本文会分两部分介绍：

1.

理论部分，会尽可能用通俗易懂的语言把 agent 发展历程上涉及到的技术均介绍一遍，篇幅比较长，让自己有全局体系化的认知。

2.

实践部分，把整个项目的各个模块方案和设计，用通俗易懂加代码结合的方式表述出来，让每个人都可以理解搭建自己的 agent。

以下个人认为本 agent 中的一些较好的设计，先列出来让大家知晓，避免文档过长避免浪费大家时间。

<table><colgroup><col width="119"> <col width="174"> <col width="539"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>亮点设计</p></td><td rowspan="1" colspan="1"><p>详细描述</p></td><td rowspan="1" colspan="1"><p>截图示例</p></td></tr><tr><td rowspan="1" colspan="1"><p>越用越懂你的记忆系统</p></td><td rowspan="1" colspan="1"><p>1. 环境事实、用户偏好记录。</p><p>2. 会话动态压缩机制，保留最精准的信息。</p><p>3. 自总结沉淀用户维度 skill。</p></td><td rowspan="1" colspan="1"><p>示例：历史说过我喜欢英文风格，后续及时新开窗口或者过了很多天仍然记得我喜欢英文风格。</p><img src="https://oss-ata.alibaba.com/article/2026/05/d212ceba-a89d-42f0-b632-3c3af4ec90cc.png"> <img src="https://oss-ata.alibaba.com/article/2026/05/1c77a38b-df08-403b-80cb-065dba32e007.png"></td></tr><tr><td rowspan="1" colspan="1"><p>ReAct 模式下的 Plan 能力</p></td><td rowspan="1" colspan="1"><p>传统 agent loop 要么 react、要么 plan、要么 plan-react，均存在一些问题，项目巧妙设计了灵活切换的方案，让简单任务执行高效，复杂任务按计划执行。</p></td><td rowspan="1" colspan="1"><p>简单任务直接react</p><img src="https://oss-ata.alibaba.com/article/2026/05/43d9dcf2-2147-4e1f-8c33-2d5ce8d67e4a.png"><p>负责任务或者手动指定要规划，则会先规划再执行。</p><img src="https://oss-ata.alibaba.com/article/2026/05/c02e2353-d764-411c-ad3b-229331666ec5.png"></td></tr><tr><td rowspan="1" colspan="1"><p>全局渐进式加载设计</p></td><td rowspan="1" colspan="1"><p>agent 的能力均通过 skill 体现，以 skill 渐进式加载沉淀更多能力，function call & mcp 等能力依据 skill 加载后按需加载。</p></td><td rowspan="1" colspan="1"><p>加入奥格人群需要mcp工具，调用模型的tool工具中只含奥格人群工具，避免上下文过长或失焦。</p><img src="https://oss-ata.alibaba.com/article/2026/05/8d83ebc0-4a2c-4b5d-bc98-2da9420b0849.png"></td></tr><tr><td rowspan="1" colspan="1"><p>subagent 设计</p></td><td rowspan="1" colspan="1"><p>通过 subagent 隔离复杂任务的长上下文，并通过并行执行保证执行效率。</p></td><td rowspan="1" colspan="1"><p>子任务隔离执行，主任务汇总结果。</p><img src="https://oss-ata.alibaba.com/article/2026/05/18d5c29e-3b00-4d9d-a291-ea0225c8dad7.png"></td></tr><tr><td rowspan="1" colspan="1"><p>harness 容错设计</p></td><td rowspan="1" colspan="1"><p>模型调用异常、数据格式错误等等，各类异常自动恢复机制。安全防御设计。</p></td><td rowspan="1" colspan="1"><p>流程异常归类，不同异常不同的处理方式，让流程回到正轨等等。</p><img src="https://oss-ata.alibaba.com/article/2026/05/f1c70072-ca09-448e-aabe-4380b1265f3f.png"></td></tr></tbody></table>

## agent 理论

## 起：从时间线看各项技术由来

agent发展到现在经历了一系列变化，以下我根据我的理解按时间线说明每一项技术产生的原因以及核心解决的问题，以下是时间线简图，后续会对每一项内容作详细介绍。

![[c2c26ddc-4ef9-4611-9054-1a9d641c84a2.png]]

后续的每一项说明这个功能的具体用途，结合图片说明，并说一下现阶段遇到的问题，引入下一阶段的内容。

## 大模型出现：万能百科全书

2022 年底 ChatGPT 横空出世，大语言模型（LLM）正式进入大众视野。本质上 LLM 是在海量文本语料上做的 next token prediction，训练完成后它就像一部"万能百科全书"——你问什么知识性问题，它大概率能给出一个像模像样的回答。

![[64c68491-e312-4231-8959-098f9445cdd1.png]]

但用了一段时间你会发现两个核心缺陷：

●

无记忆：你上一句刚说完"我叫张三"，如果不把这句话放在上下文里传给它，下一轮它完全不知道你是谁。每一次请求对 LLM 来说都是全新的。

●

知识静态：它的知识截止到训练日期，今天的天气、昨天的新闻、你们公司的内部 API 文档——这些它一概不知。

这两个问题催生了后续记忆系统和 RAG 的出现。

## 记忆出现：让对话连续

### 问题本质

LLM 的每一次 API 调用都是无状态的——模型本身不存储任何对话历史。你上一句刚说"我叫张三"，如果下一次请求不带这条信息，它完全不知道你是谁。记忆系统要解决的核心问题是：如何在有限的上下文窗口中，为模型提供最相关的历史信息。

### 记忆体系分类

目前市场上大家按是否与当前会话相关，把记忆分为短期记忆和长期记忆，具体如下图所示：

![[d2e6b0c1-32a9-440b-8f21-e44780550fac.jpeg]]

#### 短期记忆：上下文窗口管理

最基础的做法是把历史消息放进 messages 数组：

messages = \[

{"role": "system", "content": "你是一个助手"},

{"role": "user", "content": "我叫张三"},

{"role": "assistant", "content": "你好张三！"},

{"role": "user", "content": "我叫什么？"},

\]

\# LLM 此时能回答"你叫张三"

但上下文窗口有上限（早期 4K tokens → 现在 128K-1M），聊多了装不下。业界的应对策略形成了一个由简到复杂的梯度：

<table><colgroup><col width="129"> <col width="219"> <col width="216"> <col width="277"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>策略</p></td><td rowspan="1" colspan="1"><p>原理</p></td><td rowspan="1" colspan="1"><p>信息损失</p></td><td rowspan="1" colspan="1"><p>适用场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>滑动窗口</p></td><td rowspan="1" colspan="1"><p>只保留最近 N 条消息</p></td><td rowspan="1" colspan="1"><p>高（早期信息全丢）</p></td><td rowspan="1" colspan="1"><p>简单场景、token 预算紧张</p></td></tr><tr><td rowspan="1" colspan="1"><p>摘要压缩</p></td><td rowspan="1" colspan="1"><p>LLM 对历史消息生成摘要</p></td><td rowspan="1" colspan="1"><p>中（丢失细节保留要点）</p></td><td rowspan="1" colspan="1"><p>长对话场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>分层保护</p></td><td rowspan="1" colspan="1"><p>保留首尾消息，压缩中间</p></td><td rowspan="1" colspan="1"><p>中低（关键信息受保护）</p></td><td rowspan="1" colspan="1"><p>任务型对话</p></td></tr><tr><td rowspan="1" colspan="1"><p>结构化摘要</p></td><td rowspan="1" colspan="1"><p>按模板字段压缩</p></td><td rowspan="1" colspan="1"><p>低（保留结构化要素）</p></td><td rowspan="1" colspan="1"><p>复杂 agent 场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>虚拟分页</p></td><td rowspan="1" colspan="1"><p>模仿 OS 内存管理，按需换入换出</p></td><td rowspan="1" colspan="1"><p>极低（可随时检索回来）</p></td><td rowspan="1" colspan="1"><p>超长对话</p></td></tr></tbody></table>

#### 长期记忆：跨会话持久化

跨会话记忆需要将信息持久化到外部存储，在新会话开始时注入 system prompt。核心设计决策包括：

1.

存什么 — 环境事实、用户偏好、行为反馈、参考资料（不同类型需要不同的更新策略）

2.

何时存 — agent 主动写入 vs 系统自动提取

3.

如何取 — 全量注入 vs 语义检索 vs LLM 判断相关性

4.

如何更新 — 新旧冲突处理、过期衰减机制

### 市场主流记忆方案对比

<table><colgroup><col width="153"> <col width="125"> <col width="201"> <col width="183"> <col width="135"> <col width="148"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>方案</p></td><td rowspan="1" colspan="1"><p>架构</p></td><td rowspan="1" colspan="1"><p>存储方式</p></td><td rowspan="1" colspan="1"><p>检索方式</p></td><td rowspan="1" colspan="1"><p>自动化程度</p></td><td rowspan="1" colspan="1"><p>适用场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>Claude Code</p></td><td rowspan="1" colspan="1"><p>Markdown 文件系统</p></td><td rowspan="1" colspan="1"><p>分类文件（user/feedback/project/reference）</p></td><td rowspan="1" colspan="1"><p>全量注入 system prompt</p></td><td rowspan="1" colspan="1"><p>Agent 主动写入</p></td><td rowspan="1" colspan="1"><p>开发者工具</p></td></tr><tr><td rowspan="1" colspan="1"><p>ChatGPT Memory</p></td><td rowspan="1" colspan="1"><p>服务端数据库</p></td><td rowspan="1" colspan="1"><p>事实陈述句列表</p></td><td rowspan="1" colspan="1"><p>语义相关性选择注入</p></td><td rowspan="1" colspan="1"><p>全自动提取</p></td><td rowspan="1" colspan="1"><p>C端消费者产品</p></td></tr><tr><td rowspan="1" colspan="1"><p>MemGPT/Letta</p></td><td rowspan="1" colspan="1"><p>分层虚拟内存</p></td><td rowspan="1" colspan="1"><p>Core + Recall + Archival（内存+DB+向量）</p></td><td rowspan="1" colspan="1"><p>Agent 自主搜索</p></td><td rowspan="1" colspan="1"><p>Agent 自管理</p></td><td rowspan="1" colspan="1"><p>超长对话/复杂任务</p></td></tr><tr><td rowspan="1" colspan="1"><p>Mem0</p></td><td rowspan="1" colspan="1"><p>独立记忆服务</p></td><td rowspan="1" colspan="1"><p>向量DB + 图DB</p></td><td rowspan="1" colspan="1"><p>向量 + 图检索</p></td><td rowspan="1" colspan="1"><p>全自动提取+去重</p></td><td rowspan="1" colspan="1"><p>通用 AI 应用</p></td></tr><tr><td rowspan="1" colspan="1"><p>Zep</p></td><td rowspan="1" colspan="1"><p>独立记忆服务器</p></td><td rowspan="1" colspan="1"><p>向量 + 实体图 + 时序</p></td><td rowspan="1" colspan="1"><p>混合检索（语义+实体+时间）</p></td><td rowspan="1" colspan="1"><p>全自动（摘要+实体抽取）</p></td><td rowspan="1" colspan="1"><p>企业级应用</p></td></tr><tr><td rowspan="1" colspan="1"><p>LangGraph</p></td><td rowspan="1" colspan="1"><p>框架组件</p></td><td rowspan="1" colspan="1"><p>可配置多后端</p></td><td rowspan="1" colspan="1"><p>可配置（全量/检索/摘要）</p></td><td rowspan="1" colspan="1"><p>需编排</p></td><td rowspan="1" colspan="1"><p>框架开发</p></td></tr></tbody></table>

### 记忆系统的高级设计

用户的沟通历史庞大且存在大量重复无效的信息，需要按需从其中萃取总结有价值的信息，让agent变得越来越智能。主流的主要有用户画像存储、生成用户技能。

#### 从记忆到用户画像

在和用户对话过程中自动分析提取信息，沉淀结构化用户画像。

![[38f515cd-13b9-4b4c-82e0-4396ce164be3.jpeg]]

#### 从记忆到技能生成（Memory → Skill）

这是记忆系统演进的最高级阶段——从"记住用户说了什么"升级为"学会以后怎么做"。

要理解这个概念，先思考一个问题：人类新员工是如何成长为熟练工的？

人类学习过程 vs Agent 学习过程

人类新员工:

第1次犯错 → 被指正 → 记住"不要这样做"

第2次犯错 → 被指正 → 记住"在这种情况下应该那样做"

第3次类似场景 → 主动用正确方式处理（形成"肌肉记忆"）

反复实践后 → 总结为一套工作方法论（SOP）

Agent:

第1次被纠正 → 写入 feedback 记忆: "不要 mock 数据库"

第2次被纠正 → 写入 feedback 记忆: "集成测试必须连真实DB"

第3次类似场景 → 检索到 feedback 记忆，按正确方式执行

多次记忆积累 → 自动生成 skill（触发条件+执行步骤+约束规则）

核心洞察：记忆是被动的（遇到才回忆），而技能是主动的（匹配条件自动触发）。 从记忆到技能的转化，就是从"被提醒才想起"变成"条件反射式执行"。

##### 完整转化链路

┌─────────────────────────────────────────────────────────────────────────┐

│ 记忆 → 技能 完整转化链路 │

│ │

│ Phase 1: 记忆积累 │

│ ┌──────────────────────────────────────────────────────────┐ │

│ │ 用户交互产生的零散信息 │ │

│ │ │ │

│ │ 对话1: "测试不要mock数据库，上次mock导致线上出了事" │ │

│ │ 对话3: "集成测试一定要连真实DB，mock测试毫无意义" │ │

│ │ 对话7: "写测试的时候记得用事务回滚，不要污染测试数据" │ │

│ │ 对话9: "测试环境的DB配置在 config/test.yaml 里" │ │

│ │ │ │

│ │ → 写入 feedback 记忆（带 Why + How to apply） │ │

│ └──────────────────────────────────────────────────────────┘ │

│ │ │

│ ▼ │

│ Phase 2: 模式识别 │

│ ┌──────────────────────────────────────────────────────────┐ │

│ │ 系统检测到同一主题的 feedback 记忆积累达到阈值 │ │

│ │ │ │

│ │ 聚类分析: │ │

│ │ ┌─────────────────────┐ │ │

│ │ │ 主题: "测试规范" │ ← 4条相关记忆 │ │

│ │ │ 核心规则: │ │ │

│ │ │ • 禁止mock数据库 │ │ │

│ │ │ • 必须连真实DB │ │ │

│ │ │ • 使用事务回滚 │ │ │

│ │ │ 触发场景: │ │ │

│ │ │ • 用户让写测试时 │ │ │

│ │ │ • 涉及数据库操作时 │ │ │

│ │ └─────────────────────┘ │ │

│ └──────────────────────────────────────────────────────────┘ │

│ │ │

│ ▼ │

│ Phase 3: 技能生成 │

│ ┌──────────────────────────────────────────────────────────┐ │

##### 递进式学习转化

从记忆到技能的转化实际上是三个递进的学习层次：

<table><colgroup><col width="111"> <col width="164"> <col width="121"> <col width="219"> <col width="242"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>层次</p></td><td rowspan="1" colspan="1"><p>能力</p></td><td rowspan="1" colspan="1"><p>类比</p></td><td rowspan="1" colspan="1"><p>Agent 实现</p></td><td rowspan="1" colspan="1"><p>示例</p></td></tr><tr><td rowspan="1" colspan="1"><p>L1: 记住事实</p></td><td rowspan="1" colspan="1"><p>记住用户说了什么</p></td><td rowspan="1" colspan="1"><p>新员工记笔记</p></td><td rowspan="1" colspan="1"><p>feedback/user 类型记忆</p></td><td rowspan="1" colspan="1"><p>"用户说过不要用 mock"</p></td></tr><tr><td rowspan="1" colspan="1"><p>L2: 总结规则</p></td><td rowspan="1" colspan="1"><p>从多次事实中提炼规律</p></td><td rowspan="1" colspan="1"><p>老员工总结经验</p></td><td rowspan="1" colspan="1"><p>记忆聚合 → 行为约束注入 system prompt</p></td><td rowspan="1" colspan="1"><p>"测试规范: 禁mock/真实DB/事务回滚"</p></td></tr><tr><td rowspan="1" colspan="1"><p>L3: 形成技能</p></td><td rowspan="1" colspan="1"><p>规则 + 流程 + 触发条件 = 自动化能力</p></td><td rowspan="1" colspan="1"><p>专家制定 SOP</p></td><td rowspan="1" colspan="1"><p>生成 SKILL.md（含 workflow + tools + references）</p></td><td rowspan="1" colspan="1"><p>完整的集成测试 Skill</p></td></tr></tbody></table>

关键区别：

●

L1（记忆）是被动的：只有被检索到才生效，而且可能因为语义不匹配而漏检

●

L2（规则）是半主动的：注入 system prompt 后每次都生效，但只是约束不是流程

●

L3（技能）是全主动的：自动匹配触发条件 + 提供完整执行流程 + 按需加载工具

##### 具体示例：从纠正到技能的演化过程

以下是一个真实场景的演化过程：

场景：代码审查规范

═══════════════════════════════════════════════════════════════

Week 1 — 第一次纠正（L1: 记住事实）

═══════════════════════════════════════════════════════════════

用户: 你给的代码变量名太长了，我们团队习惯短变量名

Agent: \[写入 feedback 记忆\]

→ "用户团队偏好简短变量名。Why: 团队编码规范。

How to apply: 生成代码时使用简短的变量命名风格。"

效果: 下次生成代码时，Agent 检索到这条记忆，会注意用短变量名。

局限: 如果语义检索没命中（比如用户问"帮我写个函数"没提到变量），

可能不会被检索到。

═══════════════════════════════════════════════════════════════

Week 2-3 — 多次纠正积累（L1 → L2: 总结规则）

═══════════════════════════════════════════════════════════════

对话5: "函数不要超过20行" → feedback 记忆

对话8: "不要用 any 类型" → feedback 记忆

对话15: "import 要按字母排序" → feedback 记忆

模式识别: 以上 5 条 feedback 均关于"代码风格规范"

规则聚合: 生成一段结构化约束

┌─────────────────────────────────────────────┐

│ ## 代码规范（注入 system prompt） │

│ - 变量名简短 │

│ - 函数不超过20行 │

│ - 禁止 any 类型 │

│ - import 按字母排序 │

└─────────────────────────────────────────────┘

效果: 每次生成代码都会遵守这些规则（因为在 system prompt 中）

局限: 只有约束规则，没有完整的检查流程和工具支持

##### 技能转化方式：自动or主动

从记忆到技能的转化，目前业界有两种实现路径：

路径一: Agent 自主转化（如 Claude Code 设计方向）

┌───────────────────────────────────────────────────────┐

│ │

│ Agent 在对话中观察到: │

│ "我已经第 3 次提醒类似的事了" │

│ │ │

│ ▼ │

│ Agent 主动提议: │

│ "我注意到您多次提到测试相关的规范， │

│ 是否需要我将这些规则整理成一个固定的工作流程？" │

│ │ │

│ ▼ 用户确认 │

│ Agent 生成 Skill 文件并注册 │

│ │

│ 优点: 透明、用户可控 │

│ 缺点: 需要用户参与确认 │

└───────────────────────────────────────────────────────┘

路径二: 系统自动转化（如 Mem0 + 自动 SOP 引擎）

┌───────────────────────────────────────────────────────┐

│ │

│ 后台定时任务: │

│ 1. 扫描所有 feedback 类型记忆 │

│ 2. 用 LLM 做主题聚类 │

│ 3. 同一主题 ≥ N 条记忆 → 触发技能生成 │

│ 4. LLM 生成 SKILL.md 草稿 │

│ 5. 注册到 Skill 系统（或发给用户审批） │

│ │

│ 优点: 全自动，无需用户干预 │

│ 缺点: 可能过度生成无用 skill，需要置信度过滤 │

└───────────────────────────────────────────────────────┘

### 记忆系统核心挑战与解决思路

<table><colgroup><col width="132"> <col width="263"> <col width="411"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>挑战</p></td><td rowspan="1" colspan="1"><p>问题描述</p></td><td rowspan="1" colspan="1"><p>业界解决方案</p></td></tr><tr><td rowspan="1" colspan="1"><p>上下文占用</p></td><td rowspan="1" colspan="1"><p>记忆注入占 prompt 空间</p></td><td rowspan="1" colspan="1"><p>渐进式加载、选择性注入、摘要压缩</p></td></tr><tr><td rowspan="1" colspan="1"><p>相关性检索</p></td><td rowspan="1" colspan="1"><p>如何找到当前最相关的记忆</p></td><td rowspan="1" colspan="1"><p>Embedding 语义检索 + Reranking + 元数据过滤</p></td></tr><tr><td rowspan="1" colspan="1"><p>记忆过时</p></td><td rowspan="1" colspan="1"><p>用户偏好会变</p></td><td rowspan="1" colspan="1"><p>时间戳衰减、冲突检测更新、周期性验证</p></td></tr><tr><td rowspan="1" colspan="1"><p>矛盾处理</p></td><td rowspan="1" colspan="1"><p>新旧信息冲突</p></td><td rowspan="1" colspan="1"><p>Last-write-wins / LLM 仲裁 / 保留两者标记冲突</p></td></tr><tr><td rowspan="1" colspan="1"><p>安全威胁</p></td><td rowspan="1" colspan="1"><p>记忆注入攻击</p></td><td rowspan="1" colspan="1"><p>写入前安全扫描、敏感信息脱敏、审计日志</p></td></tr></tbody></table>

记忆系统的核心价值不在于"能存多少"，而在于"能否减少用户的重复表达"。对于个人助手场景，几千字符的有界文件记忆往往比复杂的向量检索系统更实用——这是一个反直觉但经过验证的结论。关键是：分类要清晰（环境事实/用户偏好/行为反馈各有不同的更新策略）、安全要前置（写入时扫描，而非读取时）、演进要有梯度（从记住事实 → 总结规则 → 沉淀为技能）。

记忆解决了对话的连续性问题，但 LLM 能回答的内容仍然局限于它的训练数据。要让 agent 具备业务知识，就需要 RAG。

## RAG 出现：解决信息滞后/缺少业务知识

### 核心原理

RAG（Retrieval-Augmented Generation，检索增强生成）的核心思路是：先检索，再生成。用户提问后，先从外部知识库中检索相关的文档片段，把检索结果作为"参考资料"拼接到 prompt 中，让 LLM 基于这些资料生成回答。

详细流程如下图所示：

![[5aa7b6c3-cafe-47cc-86a1-f5cff35a2a63.png]]

其中每个环节都有关键的技术决策：

### 环节一：文档分块（Chunking）

分块质量直接决定检索效果——切得太大，检索精度下降；切得太小，上下文信息不完整。

<table><colgroup><col width="92"> <col width="347"> <col width="187"> <col width="244"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>分块策略</p></td><td rowspan="1" colspan="1"><p>原理</p></td><td rowspan="1" colspan="1"><p>适用场景</p></td><td rowspan="1" colspan="1"><p>优缺点</p></td></tr><tr><td rowspan="1" colspan="1"><p>固定大小</p></td><td rowspan="1" colspan="1"><p>按字符/token 数切割，设 overlap</p></td><td rowspan="1" colspan="1"><p>快速原型、通用场景</p></td><td rowspan="1" colspan="1"><p>简单快速，但可能切断语义单元</p></td></tr><tr><td rowspan="1" colspan="1"><p>递归分割</p></td><td rowspan="1" colspan="1"><div>按分隔符层级递归（ <code>\n\n</code> → <code>\n</code> → <code>.</code> → 空格）</div></td><td rowspan="1" colspan="1"><p>通用，LangChain 默认方案</p></td><td rowspan="1" colspan="1"><p>比固定大小好，仍不语义感知</p></td></tr><tr><td rowspan="1" colspan="1"><p>语义分块</p></td><td rowspan="1" colspan="1"><p>计算相邻句子 embedding 相似度，相似度骤降处切割</p></td><td rowspan="1" colspan="1"><p>语义完整性要求高</p></td><td rowspan="1" colspan="1"><p>效果最好，但计算开销大</p></td></tr><tr><td rowspan="1" colspan="1"><p>结构感知</p></td><td rowspan="1" colspan="1"><p>按 Markdown 标题/HTML 标签/PDF 段落结构切割</p></td><td rowspan="1" colspan="1"><p>结构化文档</p></td><td rowspan="1" colspan="1"><p>保留层级关系，适配性好</p></td></tr><tr><td rowspan="1" colspan="1"><p>Agentic</p></td><td rowspan="1" colspan="1"><p>用 LLM 判断每句话属于哪个主题</p></td><td rowspan="1" colspan="1"><p>最高质量要求</p></td><td rowspan="1" colspan="1"><p>效果极佳，成本极高</p></td></tr></tbody></table>

生产经验：

●

Chunk size 典型值：256-1024 tokens，overlap 10-20%

●

经验法则：chunk 越大上下文完整但检索精度降低；反之亦然

●

推荐方案：递归分割 + 元数据增强（保留标题层级、页码、文件路径）

### 环节二：向量化（Embedding）

将文本转换为高维向量，使语义相近的文本在向量空间中距离相近。

<table><colgroup><col width="199"> <col width="81"> <col width="114"> <col width="224"> <col width="202"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>模型</p></td><td rowspan="1" colspan="1"><p>维度</p></td><td rowspan="1" colspan="1"><p>多语言</p></td><td rowspan="1" colspan="1"><p>特点</p></td><td rowspan="1" colspan="1"><p>推荐场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>OpenAI text-embedding-3-small</p></td><td rowspan="1" colspan="1"><p>1536</p></td><td rowspan="1" colspan="1"><p>良好</p></td><td rowspan="1" colspan="1"><p>性价比最高 API 方案</p></td><td rowspan="1" colspan="1"><p>英文为主、快速接入</p></td></tr><tr><td rowspan="1" colspan="1"><p>BGE-M3 (BAAI)</p></td><td rowspan="1" colspan="1"><p>1024</p></td><td rowspan="1" colspan="1"><p>100+语言</p></td><td rowspan="1" colspan="1"><p>同时支持 dense/sparse/colbert</p></td><td rowspan="1" colspan="1"><p>中文场景首选，支持混合检索</p></td></tr><tr><td rowspan="1" colspan="1"><p>GTE-Qwen2 (阿里)</p></td><td rowspan="1" colspan="1"><p>多种</p></td><td rowspan="1" colspan="1"><p>中英</p></td><td rowspan="1" colspan="1"><p>中文表现极强</p></td><td rowspan="1" colspan="1"><p>阿里云生态、DashScope 集成</p></td></tr><tr><td rowspan="1" colspan="1"><p>Jina-embeddings-v3</p></td><td rowspan="1" colspan="1"><p>1024</p></td><td rowspan="1" colspan="1"><p>多语言</p></td><td rowspan="1" colspan="1"><p>支持 8K 长上下文</p></td><td rowspan="1" colspan="1"><p>长文档场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>Cohere embed-v3</p></td><td rowspan="1" colspan="1"><p>1024</p></td><td rowspan="1" colspan="1"><p>100+语言</p></td><td rowspan="1" colspan="1"><p>内置 search/classify 模式区分</p></td><td rowspan="1" colspan="1"><p>需要区分查询和文档 embedding</p></td></tr></tbody></table>

选型建议：中文场景首选 BGE-M3 或 GTE-Qwen2（开源免费、中文效果极佳）；英文场景 OpenAI text-embedding-3-small 性价比最优。

### 环节三：向量存储

<table><colgroup><col width="96"> <col width="150"> <col width="150"> <col width="201"> <col width="214"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>数据库</p></td><td rowspan="1" colspan="1"><p>类型</p></td><td rowspan="1" colspan="1"><p>数据规模</p></td><td rowspan="1" colspan="1"><p>核心优势</p></td><td rowspan="1" colspan="1"><p>适用场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>ChromaDB</p></td><td rowspan="1" colspan="1"><p>嵌入式</p></td><td rowspan="1" colspan="1"><p><百万</p></td><td rowspan="1" colspan="1"><p>零配置、嵌入应用</p></td><td rowspan="1" colspan="1"><p>原型开发、小规模</p></td></tr><tr><td rowspan="1" colspan="1"><p>pgvector</p></td><td rowspan="1" colspan="1"><p>PG扩展</p></td><td rowspan="1" colspan="1"><p><千万</p></td><td rowspan="1" colspan="1"><p>复用现有 PG 基础设施</p></td><td rowspan="1" colspan="1"><p>已有 PG、不想引入新组件</p></td></tr><tr><td rowspan="1" colspan="1"><p>Qdrant</p></td><td rowspan="1" colspan="1"><p>独立服务</p></td><td rowspan="1" colspan="1"><p>亿级</p></td><td rowspan="1" colspan="1"><p>Rust 高性能、灵活过滤</p></td><td rowspan="1" colspan="1"><p>高性能要求</p></td></tr><tr><td rowspan="1" colspan="1"><p>Milvus</p></td><td rowspan="1" colspan="1"><p>分布式</p></td><td rowspan="1" colspan="1"><p>百亿级</p></td><td rowspan="1" colspan="1"><p>GPU 加速、大规模</p></td><td rowspan="1" colspan="1"><p>企业级大规模场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>Pinecone</p></td><td rowspan="1" colspan="1"><p>全托管 SaaS</p></td><td rowspan="1" colspan="1"><p>十亿级</p></td><td rowspan="1" colspan="1"><p>Serverless、零运维</p></td><td rowspan="1" colspan="1"><p>不想运维基础设施</p></td></tr></tbody></table>

### 环节四：检索优化

单纯的向量相似度检索在生产中远远不够，需要多种策略组合：

混合检索（Hybrid Search）

最终得分 = α × 向量语义得分 + (1-α) × BM25关键词得分

│ │

语义理解（同义词、近义词） 精确匹配（专有名词、代码标识符）

为什么需要混合？纯向量检索对专有名词（如 `AgentLoop` 、 `McpService` ）效果差——语义模型不认识这些名称，但 BM25 关键词匹配可以精确命中。

重排序（Re-ranking）

检索 Top-50 → Cross-Encoder 精排（逐对打分） → 取 Top-5

Bi-encoder（独立编码 query 和 doc）速度快但精度一般；Cross-encoder（同时编码 query+doc 对）精度高但慢，所以用于 re-rank 小批量结果。生产中 re-ranking 几乎是标配，精度提升 10-30%。

查询变换（Query Transformation）

<table><colgroup><col width="205"> <col width="243"> <col width="352"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>策略</p></td><td rowspan="1" colspan="1"><p>原理</p></td><td rowspan="1" colspan="1"><p>效果</p></td></tr><tr><td rowspan="1" colspan="1"><p>Query Rewriting</p></td><td rowspan="1" colspan="1"><p>LLM 改写查询使其更适合检索</p></td><td rowspan="1" colspan="1"><p>解决口语化查询的检索效果差</p></td></tr><tr><td rowspan="1" colspan="1"><p>Query Decomposition</p></td><td rowspan="1" colspan="1"><p>复杂问题拆成多个子查询</p></td><td rowspan="1" colspan="1"><p>解决多跳推理问题</p></td></tr><tr><td rowspan="1" colspan="1"><p>HyDE</p></td><td rowspan="1" colspan="1"><p>LLM 先生成"假设答案"，用假设答案的 embedding 检索</p></td><td rowspan="1" colspan="1"><p>缩小 query 和 document 的语义鸿沟</p></td></tr><tr><td rowspan="1" colspan="1"><p>Multi-query</p></td><td rowspan="1" colspan="1"><p>同一问题生成多种表述分别检索后合并</p></td><td rowspan="1" colspan="1"><p>提高召回率</p></td></tr></tbody></table>

### 高级 RAG 模式

随着 RAG 实践深入，业界发展出了多种高级模式来解决基础 RAG 的不足：

RAG 演进路线图

Naive RAG Advanced RAG Agentic RAG

(基础检索生成) (优化检索链路) (Agent驱动检索)

│ │ │

简单 Top-K Hybrid + Rerank Agent 循环检索

单次检索 查询变换 多轮自适应

全信任结果 结果过滤/验证 自评估+纠错

│ │ │

└──────────→────────┴──────────→─────────┘

复杂度与效果递增

Self-RAG（自反思RAG）：模型在生成过程中自我评估——是否需要检索？检索结果是否相关？生成是否忠实于检索内容？不相关时丢弃结果重新检索。

CRAG（纠正型RAG）：对检索结果做质量评估，如果 Correct 就使用，如果 Incorrect 就丢弃并改用 Web Search 补充，如果 Ambiguous 就两者都用。显著减少因检索质量差导致的幻觉。

Agentic RAG：将 RAG 嵌入 Agent 循环，Agent 自主决定何时检索、检索什么、结果是否足够。支持多轮检索、跨文档推理。这也是本项目采用的模式。

### RAG 核心问题与解决方案

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="281"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>问题</p></td><td rowspan="1" colspan="1"><p>表现</p></td><td rowspan="1" colspan="1"><p>根因</p></td><td rowspan="1" colspan="1"><p>解决方案</p></td></tr><tr><td rowspan="1" colspan="1"><p>检索到了仍幻觉</p></td><td rowspan="1" colspan="1"><p>回答中包含检索文档中没有的信息</p></td><td rowspan="1" colspan="1"><p>LLM 生成时使用了"记忆"而非 context</p></td><td rowspan="1" colspan="1"><p>强化 prompt 约束 + 引用标注 + CRAG 验证</p></td></tr><tr><td rowspan="1" colspan="1"><p>检索不相关</p></td><td rowspan="1" colspan="1"><p>Top-K 结果与问题无关</p></td><td rowspan="1" colspan="1"><p>语义相似≠主题相关</p></td><td rowspan="1" colspan="1"><p>Hybrid search + re-rank + 元数据过滤</p></td></tr><tr><td rowspan="1" colspan="1"><p>Chunk 边界</p></td><td rowspan="1" colspan="1"><p>关键信息跨越两个 chunk</p></td><td rowspan="1" colspan="1"><p>切分位置不当</p></td><td rowspan="1" colspan="1"><p>overlap + Parent Document Retriever</p></td></tr><tr><td rowspan="1" colspan="1"><p>多文档推理</p></td><td rowspan="1" colspan="1"><p>答案需综合多文档</p></td><td rowspan="1" colspan="1"><p>单次检索只看单 chunk</p></td><td rowspan="1" colspan="1"><p>Multi-hop RAG + GraphRAG + MapReduce</p></td></tr><tr><td rowspan="1" colspan="1"><p>长尾查询</p></td><td rowspan="1" colspan="1"><p>罕见问题检索效果差</p></td><td rowspan="1" colspan="1"><p>训练数据中类似表述少</p></td><td rowspan="1" colspan="1"><p>Query 改写 + HyDE + Few-shot 示例</p></td></tr></tbody></table>

### RAG 评估体系（RAGAS 框架）

生产中需要量化 RAG 效果，RAGAS 是目前最流行的评估框架：

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>指标</p></td><td rowspan="1" colspan="1"><p>评估对象</p></td><td rowspan="1" colspan="1"><p>含义</p></td><td rowspan="1" colspan="1"><p>计算思路</p></td></tr><tr><td rowspan="1" colspan="1"><p>Faithfulness</p></td><td rowspan="1" colspan="1"><p>生成质量</p></td><td rowspan="1" colspan="1"><p>回答忠实于检索内容的程度</p></td><td rowspan="1" colspan="1"><p>答案中每个 claim 是否有 context 支持</p></td></tr><tr><td rowspan="1" colspan="1"><p>Answer Relevancy</p></td><td rowspan="1" colspan="1"><p>生成质量</p></td><td rowspan="1" colspan="1"><p>是否真正在回答用户的问题</p></td><td rowspan="1" colspan="1"><p>答案与原始问题的相关性</p></td></tr><tr><td rowspan="1" colspan="1"><p>Context Precision</p></td><td rowspan="1" colspan="1"><p>检索质量</p></td><td rowspan="1" colspan="1"><p>检索结果中有多少是有用的</p></td><td rowspan="1" colspan="1"><p>Top-K 中相关文档的排名位置</p></td></tr><tr><td rowspan="1" colspan="1"><p>Context Recall</p></td><td rowspan="1" colspan="1"><p>检索质量</p></td><td rowspan="1" colspan="1"><p>是否检索到了所有必要信息</p></td><td rowspan="1" colspan="1"><p>ground truth 中的信息被检索到的比例</p></td></tr></tbody></table>

### 小结

RAG 极大地扩展了 LLM 的知识边界，让 agent 能回答私域知识问题。但本质上 LLM 此时仍然只是一个"信息提供者"——它能告诉你答案，但不能帮你执行操作。比如用户说"帮我查一下今天杭州的天气"，LLM 知道应该查天气，但它没有手脚去调用天气 API。要让 LLM 从"说"到"做"，就需要 Function Calling。

## Function Call & MCP 出现：从"说"到"做"

### 演进历程

<table><colgroup><col width="170"> <col width="245"> <col width="463"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>时间</p></td><td rowspan="1" colspan="1"><p>里程碑</p></td><td rowspan="1" colspan="1"><p>关键能力</p></td></tr><tr><td rowspan="1" colspan="1"><p>2023.06</p></td><td rowspan="1" colspan="1"><p>OpenAI 引入 Function Calling</p></td><td rowspan="1" colspan="1"><p>单函数调用，模型输出函数名+参数 JSON</p></td></tr><tr><td rowspan="1" colspan="1"><p>2023.11</p></td><td rowspan="1" colspan="1"><p>Parallel Function Calling</p></td><td rowspan="1" colspan="1"><p>一次响应可并行调用多个函数</p></td></tr><tr><td rowspan="1" colspan="1"><p>2024.01</p></td><td rowspan="1" colspan="1"><p>各厂商跟进</p></td><td rowspan="1" colspan="1"><p>Anthropic Tool Use、Google Function Calling、通义千问</p></td></tr><tr><td rowspan="1" colspan="1"><p>2024.08</p></td><td rowspan="1" colspan="1"><p>Structured Outputs</p></td><td rowspan="1" colspan="1"><p>保证输出 100% 符合 JSON Schema</p></td></tr><tr><td rowspan="1" colspan="1"><p>2024.11</p></td><td rowspan="1" colspan="1"><p>MCP 发布（Anthropic）</p></td><td rowspan="1" colspan="1"><p>标准化工具协议，脱离具体 LLM 平台</p></td></tr><tr><td rowspan="1" colspan="1"><p>2025.03</p></td><td rowspan="1" colspan="1"><p>MCP Streamable HTTP</p></td><td rowspan="1" colspan="1"><p>新传输层，支持无状态服务器，替代 SSE</p></td></tr></tbody></table>

### Function Calling 原理

Function Calling 的本质是让 LLM 在"该调用工具时"输出结构化的调用指令，而不是自然语言文本。

![[15d07ef4-2c17-4b65-9b0b-81b1bccb3bbb.png]]

代码示例：

\# 完整交互示例

\# Step 1: 定义工具 schema

tools = \[{

"type": "function",

"function": {

"name": "query\_weather",

"description": "查询指定城市的天气",

"parameters": {

"type": "object",

"properties": {

"city": {"type": "string", "description": "城市名"}

},

"required": \["city"\]

}

}

}\]

\# Step 2: LLM 返回的是工具调用指令，而非文本

response = llm.chat(messages=\[{"role":"user","content":"杭州天气如何"}\], tools=tools)

\# → tool\_calls: \[{"function": {"name":"query\_weather", "arguments":"{\\"city\\":\\"杭州\\"}"}}\]

\# Step 3: 应用侧执行工具

result = query\_weather(city="杭州") # "杭州今天25°C，多云"

\# Step 4: 工具结果回传，LLM 生成最终回答

messages.append({"role":"tool", "content":result, "tool\_call\_id":"..."})

final = llm.chat(messages=messages, tools=tools)

\# → "杭州今天天气多云，气温25°C，适合出行。"

核心要点：LLM 本身并不执行工具——它只负责"决策"（选择工具和生成参数），实际执行由应用侧完成。这种决策-执行分离的设计确保了安全性和可控性。

### MCP 深度解析

Function Calling 让 LLM 有了"手脚"，但工具定义硬编码在应用中——换个 LLM 平台或新增工具都需要改代码。MCP（Model Context Protocol）试图解决这个问题：建立工具的标准化通信协议，让工具可以即插即用（mcp对比function call无技术差异，本质是约定一套标准规范，放大家使用更方便）。

如下图所示，所有的逻辑对接等均包在server侧，client侧完全无关，可插拔复用，0接入成本。

┌─────────────────────────────────────────────────────────┐

│ Host │

│ (Claude Desktop / IDE / Agent 框架) │

│ │

│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │

│ │ Client A │ │ Client B │ │ Client C │ │

│ └─────┬────┘ └─────┬────┘ └─────┬────┘ │

└─────────┼───────────────┼───────────────┼───────────────┘

│ 1:1 连接 │ │

┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐

│ Server A │ │ Server B │ │ Server C │

│ (文件系统)│ │ (数据库) │ │ (SLS日志)│

│ │ │ │ │ │

│ tools: │ │ tools: │ │ tools: │

│ •read │ │ •query │ │ •search │

│ •write │ │ •insert │ │ •alert │

└──────────┘ └──────────┘ └──────────┘

●

Host：运行环境，管理多个 Client 实例的生命周期

●

Client：维护与单个 Server 的 1:1 连接，处理协议协商和消息路由

●

Server：工具提供方，暴露 capabilities（tools / resources / prompts）

协议层使用JSON-RPC 2.0，通俗易懂：

// 请求: 列出可用工具

{"jsonrpc":"2.0", "id":1, "method":"tools/list", "params":{}}

// 响应: 返回工具列表

{"jsonrpc":"2.0", "id":1, "result":{"tools":\[

{"name":"query\_logs", "description":"查询SLS日志", "inputSchema":{...}}

\]}}

// 请求: 调用工具

{"jsonrpc":"2.0", "id":2, "method":"tools/call",

"params":{"name":"query\_logs", "arguments":{"query":"ERROR", "timeRange":"1h"}}}

// 响应: 返回调用结果

{"jsonrpc":"2.0", "id":2, "result":{"content":\[{"type":"text","text":"找到3条错误..."}\]}}

MCP 除了 function calling 能力外，它提供了三类能力，方便agent使用：

<table><colgroup><col width="250"> <col width="250"> <col width="395"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>能力</p></td><td rowspan="1" colspan="1"><p>说明</p></td><td rowspan="1" colspan="1"><p>对应操作</p></td></tr><tr><td rowspan="1" colspan="1"><p>Tools</p></td><td rowspan="1" colspan="1"><p>可执行的函数/操作</p></td><td rowspan="1" colspan="1"><div><code>tools/list</code>, <code>tools/call</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>Resources</p></td><td rowspan="1" colspan="1"><p>可读取的数据源（文件、数据库）</p></td><td rowspan="1" colspan="1"><div><code>resources/list</code>, <code>resources/read</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>Prompts</p></td><td rowspan="1" colspan="1"><p>预定义的 prompt 模板</p></td><td rowspan="1" colspan="1"><div><code>prompts/list</code>, <code>prompts/get</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>Sampling</p></td><td rowspan="1" colspan="1"><p>Server 反向调用 LLM（Server 需要 AI 能力时）</p></td><td rowspan="1" colspan="1"><div><code>sampling/createMessage</code></div></td></tr></tbody></table>

### Function Calling vs MCP：如何选择

<table><colgroup><col width="134"> <col width="379"> <col width="335"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>维度</p></td><td rowspan="1" colspan="1"><p>Function Calling</p></td><td rowspan="1" colspan="1"><p>MCP</p></td></tr><tr><td rowspan="1" colspan="1"><p>标准化</p></td><td rowspan="1" colspan="1"><p>各厂商格式不同（OpenAI/Anthropic/通义各一套）</p></td><td rowspan="1" colspan="1"><p>统一协议标准</p></td></tr><tr><td rowspan="1" colspan="1"><p>工具发现</p></td><td rowspan="1" colspan="1"><p>硬编码在应用中</p></td><td rowspan="1" colspan="1"><div>动态 <code>tools/list</code> （运行时发现）</div></td></tr><tr><td rowspan="1" colspan="1"><p>可复用性</p></td><td rowspan="1" colspan="1"><p>换平台需改代码</p></td><td rowspan="1" colspan="1"><p>一个 Server 服务所有 Agent</p></td></tr><tr><td rowspan="1" colspan="1"><p>生态</p></td><td rowspan="1" colspan="1"><p>各厂商独立</p></td><td rowspan="1" colspan="1"><p>跨平台工具复用（写一次到处用）</p></td></tr><tr><td rowspan="1" colspan="1"><p>额外能力</p></td><td rowspan="1" colspan="1"><p>仅函数调用</p></td><td rowspan="1" colspan="1"><p>Resources + Prompts + Sampling</p></td></tr><tr><td rowspan="1" colspan="1"><p>部署复杂度</p></td><td rowspan="1" colspan="1"><p>无额外组件</p></td><td rowspan="1" colspan="1"><p>需要部署/维护 MCP Server</p></td></tr><tr><td rowspan="1" colspan="1"><p>成熟度</p></td><td rowspan="1" colspan="1"><p>2年+，稳定</p></td><td rowspan="1" colspan="1"><p>新标准（2024.11），快速演进</p></td></tr><tr><td rowspan="1" colspan="1"><p>适用场景</p></td><td rowspan="1" colspan="1"><p>简单应用、工具少且固定</p></td><td rowspan="1" colspan="1"><p>工具多、需要复用、多平台支持</p></td></tr></tbody></table>

实践建议：如果你的 agent 工具数量少于 5 个且只对接一个 LLM 平台，直接用 Function Calling；如果工具超过 10 个、需要跨平台复用、或者工具由不同团队提供，MCP 是更好的选择。

### 生产中的核心挑战

<table><colgroup><col width="150"> <col width="381"> <col width="357"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>挑战</p></td><td rowspan="1" colspan="1"><p>问题</p></td><td rowspan="1" colspan="1"><p>解决方案</p></td></tr><tr><td rowspan="1" colspan="1"><p>工具选择准确性</p></td><td rowspan="1" colspan="1"><p>工具多时 LLM 选错工具</p></td><td rowspan="1" colspan="1"><p>渐进式加载（Skill 方案）、优化工具描述</p></td></tr><tr><td rowspan="1" colspan="1"><p>参数提取可靠性</p></td><td rowspan="1" colspan="1"><p>JSON 格式错误、缺必填字段</p></td><td rowspan="1" colspan="1"><p>Structured Outputs、参数修复、重试</p></td></tr><tr><td rowspan="1" colspan="1"><p>嵌套参数包装</p></td><td rowspan="1" colspan="1"><div>LLM 展平嵌套参数 <code>{query:...}</code> → <code>{request:{query:...}}</code></div></td><td rowspan="1" colspan="1"><p>自动包装检测（本项目方案）</p></td></tr><tr><td rowspan="1" colspan="1"><p>工具名拼写</p></td><td rowspan="1" colspan="1"><p>大小写/格式错误</p></td><td rowspan="1" colspan="1"><p>模糊匹配 + 自动修复（本项目方案）</p></td></tr><tr><td rowspan="1" colspan="1"><p>上下文占用</p></td><td rowspan="1" colspan="1"><p>几十个工具 schema 占满 prompt</p></td><td rowspan="1" colspan="1"><p>按需注入 + Skill 分级加载</p></td></tr></tbody></table>

### 小结

Function Calling + MCP 让 LLM 从"只能说"变成"能做事"。但有了手脚之后，谁来编排整个流程？ 用户说了一句话，LLM 可能需要先调工具 A 获取信息，再据此调工具 B，最后综合结果给出答案。这个"编排大脑"的角色，就是 Agent。

## Agent 出现：开始完成完整任务

### Agent 的本质

一件事情往往有多个步骤，需要多步均执行才算执行成本，比如把钉钉文档的内容复制到语雀中，则需要先去钉钉复制文档，然后再去语雀黏贴文档，如何让llm可以做很多不完成任务，这就诞生了agent。Agent 本质上是一个循环（loop）——不断让 LLM 思考下一步做什么，执行操作，观察结果，再决定下一步。直到认为任务完成或达到退出条件。

![[3e816680-162f-43a8-b98c-def9fa0e42fa.jpeg]]

### 主流循环范式对比

学术界和工业界提出了多种 agent 循环范式，各有优劣：

<table><colgroup><col width="187"> <col width="167"> <col width="517"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>范式</p></td><td rowspan="1" colspan="1"><p>核心思想</p></td><td rowspan="1" colspan="1"><p>示例及说明</p></td></tr><tr><td rowspan="1" colspan="1"><h4>ReAct（Reasoning + Acting）</h4></td><td rowspan="1" colspan="1"><p>让 LLM 交替进行推理（Thought）和行动（Action），每一步都基于上一步的观察结果决策。</p></td><td rowspan="1" colspan="1"><p>Thought 1: 用户想知道杭州天气。我需要调用天气查询工具。</p><p>Action 1: query_weather(city="杭州")</p><p>Observation 1: {"temp": 25, "condition": "多云"}</p><p>Thought 2: 已获取到天气数据。我可以直接回答用户了。</p><p>Answer: 杭州今天天气多云，气温25°C。</p><p>实现极简—— 一个 while 循环：</p><p>while not done:</p><p>response = llm.chat(messages, tools) # Think</p><p>if response.has_tool_calls:</p><p>results = execute(response.tool_calls) # Act</p><p>messages.append(results) # Observe</p><p>else:</p><p>return response.content # Done</p></td></tr><tr><td rowspan="1" colspan="1"><h4>Plan-then-Execute</h4></td><td rowspan="1" colspan="1"><p>先让 LLM 制定完整计划，再按步骤逐一执行。</p></td><td rowspan="1" colspan="1"><p>Phase 1 — Plan（规划阶段）:</p><p>┌─────────────────────────────────────────┐</p><p>│ 用户任务: "帮我分析这个项目的性能瓶颈" │</p><p>│ │</p><p>│ 计划: │</p><p>│ 1. 读取项目配置，了解技术栈 │</p><p>│ 2. 查看日志，定位高延迟接口 │</p><p>│ 3. 分析代码，识别 N+1 查询 │</p><p>│ 4. 生成优化建议报告 │</p><p>└─────────────────────────────────────────┘</p><p>Phase 2 — Execute（执行阶段）:</p><p>Step 1 → executor.run("读取配置") → 结果</p><p>Step 2 → executor.run("查看日志") → 结果</p><p>...</p></td></tr><tr><td rowspan="1" colspan="1"><h4>Plan-React 混合</h4></td><td rowspan="1" colspan="1"><p>先规划再执行，但执行过程中允许根据新发现动态调整计划。</p></td><td rowspan="1" colspan="1"><p>Plan → Execute Step 1 → 发现新信息 → Re-plan → Execute Step 2 →...</p></td></tr><tr><td rowspan="1" colspan="1"><h4>LATS（Language Agent Tree Search）</h4></td><td rowspan="1" colspan="1"><p>受蒙特卡洛树搜索（MCTS）启发，将 agent 决策建模为树搜索问题，探索多条执行路径。</p></td><td rowspan="1" colspan="1"><p>[Root: 用户任务]</p><p>/ | \</p><p>[方案A] [方案B] [方案C]</p><p>/ \ | |</p><p>[A1] [A2] [B1] [C1]</p><p>↑ ↑</p><p>score=0.8 score=0.3 ← 评估每个节点</p><p>选择最优路径执行，失败时回溯到其他分支重试</p></td></tr><tr><td rowspan="1" colspan="1"><h4>Reflexion（自反思模式）</h4></td><td rowspan="1" colspan="1"><p>Agent 失败后进行自我反思，将反思结论存入记忆，在下次尝试时利用经验教训。</p></td><td rowspan="1" colspan="1"><p>尝试1: 执行任务 → 失败</p><p>→ 反思: "失败原因是... 下次应该..."</p><p>→ 存入 memory</p><p>尝试2: 加载反思记忆 → 执行任务（基于经验改进）→ 成功/再次反思</p></td></tr></tbody></table>

### 范式综合对比

<table><colgroup><col width="128"> <col width="93"> <col width="220"> <col width="211"> <col width="281"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>范式</p></td><td rowspan="1" colspan="1"><p>实现复杂度</p></td><td rowspan="1" colspan="1"><p>适用场景</p></td><td rowspan="1" colspan="1"><p>优势</p></td><td rowspan="1" colspan="1"><p>劣势</p></td></tr><tr><td rowspan="1" colspan="1"><p>ReAct</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>通用，简单到中等任务</p></td><td rowspan="1" colspan="1"><p>灵活、实现简单、可观测性好</p></td><td rowspan="1" colspan="1"><p>无全局规划，复杂任务易迷失</p></td></tr><tr><td rowspan="1" colspan="1"><p>Plan-Execute</p></td><td rowspan="1" colspan="1"><p>中</p></td><td rowspan="1" colspan="1"><p>步骤可预见的确定性任务</p></td><td rowspan="1" colspan="1"><p>全局规划合理，可展示计划</p></td><td rowspan="1" colspan="1"><p>不灵活，中间出错难调整</p></td></tr><tr><td rowspan="1" colspan="1"><p>Plan-React</p></td><td rowspan="1" colspan="1"><p>中高</p></td><td rowspan="1" colspan="1"><p>复杂但可拆解的任务</p></td><td rowspan="1" colspan="1"><p>兼顾规划和灵活性</p></td><td rowspan="1" colspan="1"><p>实现复杂，LLM 难维护计划</p></td></tr><tr><td rowspan="1" colspan="1"><p>LATS</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>数学/代码/需探索的任务</p></td><td rowspan="1" colspan="1"><p>可回溯，找到更优解</p></td><td rowspan="1" colspan="1"><p>Token 消耗极高，延迟高</p></td></tr><tr><td rowspan="1" colspan="1"><p>Reflexion</p></td><td rowspan="1" colspan="1"><p>中</p></td><td rowspan="1" colspan="1"><p>有明确成功标准的任务</p></td><td rowspan="1" colspan="1"><p>从失败中学习</p></td><td rowspan="1" colspan="1"><p>需多次尝试，成本高</p></td></tr></tbody></table>

### 生产中的最佳实践

当前生产环境中 90% 以上的 agent 采用 ReAct 为主循环 + 可选 Plan 能力 的混合模式，自动根据任务复杂度判断是否需要规划，简单任务直接执行，复杂任务可规划再执行，任务执行中途也可重新规划执行：

┌──────────────────────────────────────────────────┐

│ 生产级 Agent 架构 │

│ │

│ ReAct 主循环（始终运行） │

│ ├── 简单任务: 直接 Think → Act → Answer │

│ ├── 复杂任务: Think → 创建 Plan → 按 Plan 执行 │

│ └── 计划调整: 执行中发现新信息 → 更新 Plan │

│ │

│ 关键保障: │

│ ├── 迭代预算（防无限循环） │

│ ├── 上下文压缩（防溢出） │

│ ├── 错误重试（防临时故障） │

│ └── 工具修复（防格式错误） │

└──────────────────────────────────────────────────┘

这也是本项目采用的方案——ReAct 循环中通过 `todo` 工具嵌入 Plan 能力，简单任务零开销，复杂任务自动启用计划。

### 引出下一个问题

无论哪种范式，agent 的核心都是这个 loop。但随着能力增长，工具越来越多（可能几十上百个），每个工具的 JSON Schema 定义动辄几百 tokens，全部塞进 prompt 会严重占用上下文窗口，而且 LLM 面对太多选项容易"选择困难"。如何高效管理工具？这就引出了 Skill 的概念。

## Skill 出现：精准执行任务

### 问题本质

工具数量增长带来两个核心矛盾：

1.

上下文占用：50 个工具的 schema 可能占 50000 tokens，严重挤压有效上下文

2.

选择困难：LLM 面对太多工具时，选择准确率显著下降

传统 Function Calling 的做法是把所有工具定义一股脑塞进 prompt——工具少时没问题，工具多了就崩了。

### 渐进式加载（Progressive Disclosure）

Skill 的核心设计灵感来自操作系统的按需加载（lazy loading）思想：不把所有代码都加载到内存，而是需要时才加载。

![[f0912cc1-c928-482a-90b4-4a235bb6ec3f.png]]

### Token 效率对比

<table><colgroup><col width="250"> <col width="381"> <col width="250"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>方案</p></td><td rowspan="1" colspan="1"><p>50 个工具的 Token 消耗</p></td><td rowspan="1" colspan="1"><p>效率</p></td></tr><tr><td rowspan="1" colspan="1"><p>传统全量注入</p></td><td rowspan="1" colspan="1"><p>~50,000 tokens（每个工具 ~1000 tokens schema）</p></td><td rowspan="1" colspan="1"><p>1x</p></td></tr><tr><td rowspan="1" colspan="1"><p>Skill Advertise</p></td><td rowspan="1" colspan="1"><p>~5,000 tokens（每个 skill ~100 tokens 摘要）</p></td><td rowspan="1" colspan="1"><p>10x</p></td></tr><tr><td rowspan="1" colspan="1"><p>Skill Load 后</p></td><td rowspan="1" colspan="1"><p>+1,000~3,000 tokens（仅加载用到的 1-2 个 skill）</p></td><td rowspan="1" colspan="1"><p>按需</p></td></tr></tbody></table>

关键洞察：大多数对话只会用到 1-2 个 skill，没必要让 LLM "看到"所有工具的完整定义。

### Skill = SOP + 工具 + 资源

与传统 Function Calling 只有一个简短 description 不同，每个 Skill 自带一份完整的"操作手册"：

skill/

└── log-diagnosis/

├── SKILL.md # 操作手册（工作流程+参数规范+输出格式）

├── references/ # 参考资料

│ └── error-patterns.md # 历史错误模式库

└── scripts/ # 可执行脚本

└── parse\_trace.py # 日志解析工具

这种设计的价值：LLM 不是在"猜"怎么用工具，而是在"按手册操作"——就像给新员工一份 SOP 文档，而不是只告诉他工具箱在哪里。

## Multi-Agent 出现：专家协作，并行探索

### 单 Agent 的三大困境

<table><colgroup><col width="250"> <col width="263"> <col width="549"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>困境</p></td><td rowspan="1" colspan="1"><p>表现</p></td><td rowspan="1" colspan="1"><p>根因</p></td></tr><tr><td rowspan="1" colspan="1"><p>上下文膨胀</p></td><td rowspan="1" colspan="1"><p>对话越长越容易"忘事"</p></td><td rowspan="1" colspan="1"><p>即使压缩，信息损失也不可逆</p></td></tr><tr><td rowspan="1" colspan="1"><p>注意力分散</p></td><td rowspan="1" colspan="1"><p>复杂任务容易"跑偏"</p></td><td rowspan="1" colspan="1"><p>一个 system prompt 难兼顾所有场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>串行瓶颈</p></td><td rowspan="1" colspan="1"><p>多步骤任务耗时长</p></td><td rowspan="1" colspan="1"><p>独立子任务只能排队执行</p></td></tr></tbody></table>

### Multi-Agent 架构模式

要理解 Multi-Agent 为什么会有多种模式，先想一个类比：人类团队协作也不止一种方式。

<table><colgroup><col width="390"> <col width="300"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>场景</p></td><td rowspan="1" colspan="1"><p>协作模式</p></td></tr><tr><td rowspan="1" colspan="1"><p>老板分配任务给员工</p></td><td rowspan="1" colspan="1"><p>主从委托</p></td></tr><tr><td rowspan="1" colspan="1"><p>流水线上一道工序传给下一道</p></td><td rowspan="1" colspan="1"><p>接力传递</p></td></tr><tr><td rowspan="1" colspan="1"><p>多人头脑风暴讨论</p></td><td rowspan="1" colspan="1"><p>对等讨论</p></td></tr><tr><td rowspan="1" colspan="1"><p>部门经理各管一摊，有事才协调</p></td><td rowspan="1" colspan="1"><p>层级分治</p></td></tr><tr><td rowspan="1" colspan="1"><p>专家会诊，轮流发表意见后投票</p></td><td rowspan="1" colspan="1"><p>竞争投票</p></td></tr><tr><td rowspan="1" colspan="1"><p>导师带徒弟，做完了师傅审核</p></td><td rowspan="1" colspan="1"><p>评估反馈</p></td></tr></tbody></table>

业界的 Multi-Agent 模式很多，以下对多种逐一深入分析。

#### 模式一：主从委托（Orchestrator-Worker）

类比：项目经理分配任务给不同开发者，各自完成后经理汇总交付。

┌─────────────────────────────────────────────────────────────────┐

│ Orchestrator（编排者） │

│ │

│ 职责: 理解用户意图 → 任务拆解 → 分配 → 等待 → 汇总结果 │

│ │

│ ┌──────────┬──────────┬──────────┐ │

│ │ 任务A │ 任务B │ 任务C │ 并行分配 │

│ ▼ ▼ ▼ │ │

│ ┌─────────┐┌─────────┐┌─────────┐ │ │

│ │Worker A ││Worker B ││Worker C │ │ │

│ │(搜索) ││(代码) ││(数据) │ │ │

│ │ ││ ││ │ │ │

│ │独立上下文││独立上下文││独立上下文│ │ │

│ │独立工具 ││独立工具 ││独立工具 │ │ │

│ └────┬────┘└────┬────┘└────┬────┘ │ │

│ │ │ │ │ │

│ └──────────┴──────────┘ │ │

│ │ │ │

│ ▼ │ │

│ 结果汇总 + 综合推理 │ │

│ │ │ │

│ ▼ │ │

│ 最终回答给用户 │ │

└─────────────────────────────────────────────────────────────────┘

代表产品：Claude Code（subagent）、本项目（DelegateManager）、AutoGen

典型场景示例：

用户: "帮我调研竞品 A、B、C 的定价策略，然后给出我们的定价建议"

Orchestrator 拆解:

├── Worker A: 调研竞品A的定价（独立搜索+分析）

├── Worker B: 调研竞品B的定价（独立搜索+分析）

└── Worker C: 调研竞品C的定价（独立搜索+分析）

↓ 三者并行完成后

Orchestrator 汇总: 综合三份报告 → 生成定价建议

优势：并行执行快、上下文隔离、Worker 可以各自专精

劣势：Orchestrator 是单点瓶颈（拆解不好则全盘失败）、Worker 之间无法直接通信

适用场景：可明确拆解为独立子任务的场景（搜索、分析、数据处理）

---

#### 模式二：接力传递（Sequential / Pipeline）

类比：工厂流水线——原材料经过一道道工序，每道工序加工后传给下一道。

┌─────────────────────────────────────────────────────────────────┐

│ Pipeline 模式 │

│ │

│ 用户需求 │

│ │ │

│ ▼ │

│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │

│ │ Agent 1 │ │ Agent 2 │ │ Agent 3 │ │ Agent 4 │ │

│ │ 研究者 │───→│ 编码者 │───→│ 审查者 │───→│ 部署者 │ │

│ │ │ │ │ │ │ │ │ │

│ │•理解需求 │ │•接收需求 │ │•接收代码 │ │•接收审查 │ │

│ │•收集资料 │ │ +研究结果│ │ +需求上下文 │ 通过的代码│ │

│ │•输出需求 │ │•编写代码 │ │•代码审查 │ │•写部署脚本│ │

│ │ 分析报告 │ │•输出代码 │ │•输出修改 │ │•执行部署 │ │

│ └──────────┘ └──────────┘ │ 建议或通过│ └──────────┘ │

│ └──────────┘ │

│ │

│ 每个 Agent 的输出是下一个 Agent 的输入 │

└─────────────────────────────────────────────────────────────────┘

代表产品：GitHub Copilot Workspace（需求→设计→编码→验证）、传统 CI/CD pipeline

典型场景示例：

用户: "帮我实现用户注册功能"

Pipeline:

Agent 1 (需求分析): 确认功能细节 → 输出需求文档

↓

Agent 2 (架构设计): 读取需求 → 设计接口和数据模型 → 输出设计方案

↓

Agent 3 (代码实现): 读取设计 → 编写代码 → 输出源代码

↓

Agent 4 (测试验证): 读取代码 → 编写并运行测试 → 输出测试报告

优势：流程清晰可控、每步可审计、前序步骤为后续提供结构化上下文

劣势：串行执行慢、一步出错后面全部受影响、反馈循环困难（后面发现前面有问题很难回退）

适用场景：有明确先后顺序依赖的工作流（需求→设计→编码→测试→部署）

---

#### 模式三：对等讨论（Peer Discussion / Debate）

类比：圆桌会议——多位专家轮流发言、互相质疑补充，最终达成共识。

┌─────────────────────────────────────────────────────────────────┐

│ Debate 模式 │

│ │

│ ┌─────────────────────────────────┐ │

│ │ 讨论话题 / 问题 │ │

│ └────────────────┬────────────────┘ │

│ │ │

│ ┌──────────────┼──────────────┐ │

│ │ │ │ │

│ ┌────▼────┐ ┌───▼────┐ ┌───▼────┐ │

│ │ Agent A │ │Agent B │ │Agent C │ │

│ │ 乐观派 │ │ 悲观派 │ │ 实用派 │ │

│ │ │ │ │ │ │ │

│ │"这方案 │ │"但是有 │ │"折中一 │ │

│ │ 可行！" │ │ 风险…" │ │ 下吧…" │ │

│ └────┬────┘ └───┬────┘ └───┬────┘ │

│ │ │ │ │

│ └─────────────┼─────────────┘ │

│ │ 多轮对话 │

│ ▼ │

│ ┌─────────────────────────┐ │

│ │ Moderator（主持人） │ │

│ │ • 判断是否达成共识 │ │

│ │ • 超过N轮强制总结 │ │

│ │ • 输出最终结论 │ │

│ └─────────────────────────┘ │

└─────────────────────────────────────────────────────────────────┘

代表产品：ChatDev（软件公司模拟）、CAMEL（角色扮演对话）、MetaGPT

典型场景示例：

问题: "我们的登录系统应该用 Session 还是 JWT？"

Agent A (安全专家): "Session 更安全，服务端控制力强，可以即时撤销"

Agent B (架构师): "JWT 无状态，适合微服务分布式架构，扩展性好"

Agent C (产品经理): "我们现在单体应用，但半年后要拆微服务"

第2轮:

Agent A: "如果要拆微服务，Session 需要引入 Redis 共享，确实麻烦"

Agent B: "JWT 的安全问题可以通过短过期时间+refresh token 缓解"

Agent C: "那用 JWT + 短过期 + refresh token 方案？"

Moderator: 共识达成 → 输出结论和理由

优势：多角度思考避免盲点、激发创造性方案、决策质量高

劣势：Token 消耗极高（多轮多人）、收敛时间不确定、容易陷入无意义的循环辩论

适用场景：决策类问题（技术选型、方案评审、风险评估）

---

#### 模式四：层级分治（Hierarchical / Manager-of-Managers）

类比：公司组织架构——CEO 管 VP，VP 管总监，总监管一线员工。

┌─────────────────────────────────────────────────────────────────┐

│ Hierarchical 模式 │

│ │

│ ┌──────────────┐ │

│ │ CEO Agent │ │

│ │ (顶层决策) │ │

│ └──────┬───────┘ │

│ │ │

│ ┌────────────┼────────────┐ │

│ │ │ │ │

│ ┌──────▼─────┐┌────▼──────┐┌───▼───────┐ │

│ │ 前端经理 ││ 后端经理 ││ 测试经理 │ │

│ │ Agent ││ Agent ││ Agent │ │

│ └──────┬─────┘└────┬──────┘└───┬───────┘ │

│ │ │ │ │

│ ┌────┼────┐ ┌──┼───┐ ┌──┼───┐ │

│ │ │ │ │ │ │ │ │ │ │

│ ┌▼┐ ┌▼┐ ┌▼┐ ┌▼┐ ┌▼┐ ┌▼┐ ┌▼┐ ┌▼┐ │

│ │W│ │W│ │W│ │W│ │W│ │W│ │W│ │W│ Worker Agents │

│ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ │

│ │

│ 信息流向: 上级只和直属下级通信，不跨级 │

│ 汇报路径: Worker → Manager → CEO → 用户 │

└─────────────────────────────────────────────────────────────────┘

代表产品：MetaGPT（CEO/CTO/PM/Engineer角色）、企业级 Agent 编排平台

典型场景示例：

用户: "帮我开发一个完整的电商后台管理系统"

CEO Agent: 拆为三大模块

├── 前端经理 Agent:

│ ├── Worker: 实现商品列表页

│ ├── Worker: 实现订单管理页

│ └── Worker: 实现用户管理页

├── 后端经理 Agent:

│ ├── Worker: 实现商品 API

│ ├── Worker: 实现订单 API

│ └── Worker: 实现用户 API

└── 测试经理 Agent:

├── Worker: 前端自动化测试

└── Worker: 后端接口测试

优势：适合超大型任务、自然模拟团队协作、每层只处理自己关心的粒度

劣势：层级增加延迟和通信成本、容易"传话走样"（信息在层级间失真）、实现复杂度极高

适用场景：大型工程项目（需要多模块协作、多角色分工）

---

#### 模式五：竞争选优（Competition / Voting）

类比：考试阅卷——多位老师分别打分，取平均分或投票选出最佳答案。

┌─────────────────────────────────────────────────────────────────┐

│ Competition 模式 │

│ │

│ ┌──────────────┐ │

│ │ 同一问题 │ │

│ └──────┬───────┘ │

│ │ │

│ ┌────────────┼────────────┐ │

│ │ │ │ 同一问题分发给多个Agent │

│ ▼ ▼ ▼ │

│ ┌───────────┐┌───────────┐┌───────────┐ │

│ │ Agent A ││ Agent B ││ Agent C │ │

│ │ (方案一) ││ (方案二) ││ (方案三) │ │

│ │ ││ ││ │ │

│ │ 用GPT-4o ││ 用Claude ││ 用Gemini │ 或同模型不同策略 │

│ └─────┬─────┘└─────┬─────┘└─────┬─────┘ │

│ │ │ │ │

│ └────────────┼────────────┘ │

│ │ │

│ ▼ │

│ ┌────────────────────────┐ │

│ │ Judge Agent │ │

│ │ │ │

│ │ 评估策略: │ │

│ │ • 投票制（多数胜出） │ │

│ │ • 评分制（打分选最高） │ │

│ │ • 综合制（取各方精华） │ │

│ └────────────────────────┘ │

│ │ │

│ ▼ │

│ 最优方案输出 │

└─────────────────────────────────────────────────────────────────┘

代表产品：LLM-as-Judge 框架、AlphaCode（生成大量代码候选 → 过滤选优）、self-consistency（多次采样投票）

典型场景示例：

问题: "这段代码的 bug 在哪里？"

Agent A (逐行分析策略): "第15行的空指针检查缺失"

Agent B (执行追踪策略): "第15行 user 可能为 null，会崩"

Agent C (模式匹配策略): "第23行的循环边界有 off-by-one"

Judge: A 和 B 都指向第15行，高置信度 → 输出 "第15行空指针问题"

C 的发现作为补充建议

优势：结果质量高（多方验证）、鲁棒性强（单个 Agent 失误不影响最终结果）、天然适合需要高可靠性的场景

劣势：Token 成本是单 Agent 的 N 倍、延迟取决于最慢的 Agent、对简单问题过度使用是浪费

适用场景：高可靠性要求（代码 bug 检测、安全审计）、创意生成（需要多样化方案）、决策质量要求极高

---

#### 模式六：评估反馈（Generator-Critic / Self-Refinement）

类比：作者写初稿 → 编辑审稿批注 → 作者修改 → 再审 → 直到编辑满意。

┌─────────────────────────────────────────────────────────────────┐

│ Generator-Critic 模式 │

│ │

│ ┌───────────────────────────────────────────┐ │

│ │ 循环 │ │

│ │ │ │

│ │ ┌──────────────┐ ┌──────────────┐ │ │

│ │ │ Generator │ │ Critic │ │ │

│ │ │ (生成者) │ │ (评估者) │ │ │

│ │ │ │ │ │ │ │

│ │ │ 生成/修改 │────→│ 评估质量 │ │ │

│ │ │ 方案 │ │ 给出反馈 │ │ │

│ │ │ │←────│ │ │ │

│ │ │ 根据反馈 │ │ 判断是否 │ │ │

│ │ │ 改进方案 │ │ 达标 │ │ │

│ │ └──────────────┘ └──────┬───────┘ │ │

│ │ │ │ │

│ └──────────────────────────────┘ │ │

│ │ 达标 │ │

│ ▼ │ │

│ 输出最终结果 │ │

│ │ │

│ 最大迭代次数限制（防止无限循环） │ │

└─────────────────────────────────────────────────────────────────┘

代表产品：Reflexion、Self-Refine、Constitutional AI、本项目中 Skill 内的 ReAct + 验证步骤

典型场景示例：

任务: "写一篇关于 RAG 的技术博客"

第1轮:

Generator: 生成初稿（2000字）

Critic: "缺少代码示例、RAG 评估部分太浅、没有图表"

→ 评分: 6/10，不达标

第2轮:

Generator: 基于反馈修改（加了代码示例、扩充评估、加了流程图）

Critic: "整体好多了，但开头太学术化，不够吸引人"

→ 评分: 8/10，不达标

第3轮:

Generator: 改写开头为案例引入

Critic: "很好，结构清晰、内容完整、表达生动"

→ 评分: 9/10，达标 → 输出

优势：输出质量持续提升、有明确的质量标准、生成者和评估者可以用不同模型（如生成用快模型、评估用强模型）

劣势：多轮迭代增加延迟和成本、Critic 本身可能不可靠（"评委水平不行"）、可能过度修改（改了不该改的地方）

适用场景：需要高质量输出的创作任务（写作、代码生成）、有明确评估标准的任务（测试通过/代码风格达标）

---

#### 模式七：动态路由（Router / Dispatch）

类比：医院分诊台——护士根据症状把病人分配到不同科室的专科医生。

┌─────────────────────────────────────────────────────────────────┐

│ Router 模式 │

│ │

│ ┌──────────────┐ │

│ │ 用户请求 │ │

│ └──────┬───────┘ │

│ │ │

│ ┌──────▼───────┐ │

│ │ Router │ │

│ │ (分诊台) │ │

│ │ │ │

│ │ 意图识别: │ │

│ │ 写代码? │ │

│ │ 查日志? │ │

│ │ 问知识? │ │

│ │ 闲聊? │ │

│ └──────┬───────┘ │

│ │ │

│ ┌─────────────────┼─────────────────┐ │

│ │ │ │ │

│ ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ │

│ │ Coding │ │ DevOps │ │ Q&A │ │

│ │ Agent │ │ Agent │ │ Agent │ │

│ │ │ │ │ │ │ │

│ │专属工具: │ │专属工具: │ │专属工具: │ │

│ │•编辑器 │ │•日志查询 │ │•知识库 │ │

│ │•终端 │ │•监控面板 │ │•搜索引擎│ │

│ │•Git │ │•部署系统 │ │ │ │

│ └──────────┘ └──────────┘ └──────────┘ │

│ │

│ 特点: 每个专家 Agent 有专属的 system prompt + 专属工具集 │

│ Router 本身很轻量（分类器），不做实际工作 │

└─────────────────────────────────────────────────────────────────┘

代表产品：Anthropic Claude 的 tool\_use routing、各大厂的智能客服（先分类再转专家）、本项目的 Skill advertise→load 本质上也是一种路由

典型场景示例：

用户: "线上报了空指针错误，帮我查下日志"

Router 判断: 这是运维诊断类问题 → 路由到 DevOps Agent

DevOps Agent: 加载日志查询工具 → 查SLS → 定位错误 → 输出诊断报告

用户: "找到原因了，帮我修一下代码"

Router 判断: 这是编码类问题 → 路由到 Coding Agent

Coding Agent: 加载代码编辑工具 → 修改代码 → 运行测试 → 提交

优势：响应快（不需要大模型做全局推理来选工具）、每个专家 Agent 的 system prompt 高度专注、容易水平扩展（加新专家不影响已有的）

劣势：Router 可能分错类、跨领域问题需要在 Agent 间转交、不适合需要多领域协作的任务

适用场景：用户意图明确可分类的场景（客服、工具型产品）、专家 Agent 能力差异大的场景

---

### 七种模式综合对比

<table><colgroup><col width="107"> <col width="107"> <col width="149"> <col width="80"> <col width="107"> <col width="107"> <col width="252"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>模式</p></td><td rowspan="1" colspan="1"><p>并行性</p></td><td rowspan="1" colspan="1"><p>通信开销</p></td><td rowspan="1" colspan="1"><p>实现复杂度</p></td><td rowspan="1" colspan="1"><p>输出质量</p></td><td rowspan="1" colspan="1"><p>Token 成本</p></td><td rowspan="1" colspan="1"><p>最佳场景</p></td></tr><tr><td rowspan="1" colspan="1"><p>主从委托</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>低（单次分发+收集）</p></td><td rowspan="1" colspan="1"><p>中</p></td><td rowspan="1" colspan="1"><p>取决于子 Agent</p></td><td rowspan="1" colspan="1"><p>中</p></td><td rowspan="1" colspan="1"><p>可拆解的独立子任务</p></td></tr><tr><td rowspan="1" colspan="1"><p>接力传递</p></td><td rowspan="1" colspan="1"><p>无</p></td><td rowspan="1" colspan="1"><p>中（逐步传递）</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>中</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>有顺序依赖的流水线</p></td></tr><tr><td rowspan="1" colspan="1"><p>对等讨论</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>高（多轮对话）</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>高（多角度）</p></td><td rowspan="1" colspan="1"><p>极高</p></td><td rowspan="1" colspan="1"><p>决策/方案选择</p></td></tr><tr><td rowspan="1" colspan="1"><p>层级分治</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>高（多层传递）</p></td><td rowspan="1" colspan="1"><p>极高</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>超大型工程项目</p></td></tr><tr><td rowspan="1" colspan="1"><p>竞争选优</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>低（各自独立）</p></td><td rowspan="1" colspan="1"><p>中</p></td><td rowspan="1" colspan="1"><p>极高（投票/选优）</p></td><td rowspan="1" colspan="1"><p>高（N倍）</p></td><td rowspan="1" colspan="1"><p>高可靠性要求</p></td></tr><tr><td rowspan="1" colspan="1"><p>评估反馈</p></td><td rowspan="1" colspan="1"><p>无</p></td><td rowspan="1" colspan="1"><p>中（多轮迭代）</p></td><td rowspan="1" colspan="1"><p>中</p></td><td rowspan="1" colspan="1"><p>高（逐步提升）</p></td><td rowspan="1" colspan="1"><p>中高</p></td><td rowspan="1" colspan="1"><p>创作/生成类任务</p></td></tr><tr><td rowspan="1" colspan="1"><p>动态路由</p></td><td rowspan="1" colspan="1"><p>无（单路由）</p></td><td rowspan="1" colspan="1"><p>极低</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>取决于专家</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>意图明确可分类</p></td></tr></tbody></table>

### 生产中的组合使用

现实中很少只用单一模式，成熟的系统会组合多种模式。以本项目为例：

┌─────────────────────────────────────────────────────────────┐

│ 本项目的 Multi-Agent 组合模式 │

│ │

│ 层次1: 动态路由 │

│ └── Skill advertise 阶段 = Router │

│ 用户请求 → 匹配 skill → 路由到对应能力 │

│ │

│ 层次2: 主从委托 │

│ └── DelegateManager = Orchestrator-Worker │

│ 复杂任务 → 拆解 → 并行子Agent执行 → 汇总 │

│ │

│ 层次3: 评估反馈（隐式） │

│ └── ReAct 循环中 LLM 自评估是否完成 │

│ 工具执行结果 → LLM 判断是否满意 → 继续/结束 │

└─────────────────────────────────────────────────────────────┘

Claude Code 的实现也类似：

Claude Code Multi-Agent 组合:

• Router: 根据任务类型选择是否需要子 Agent

• Orchestrator-Worker: 主 Agent spawn 子 Agent 并行搜索/编辑

• Generator-Critic: 编码后运行测试 = 生成+验证循环

• Pipeline: plan → implement → test → commit 的阶段流

### 核心收益

<table><colgroup><col width="188"> <col width="276"> <col width="351"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>收益</p></td><td rowspan="1" colspan="1"><p>原理</p></td><td rowspan="1" colspan="1"><p>效果</p></td></tr><tr><td rowspan="1" colspan="1"><p>上下文隔离</p></td><td rowspan="1" colspan="1"><p>每个子 agent 独立上下文窗口</p></td><td rowspan="1" colspan="1"><p>主 agent 只看到任务+结果，不被中间过程污染</p></td></tr><tr><td rowspan="1" colspan="1"><p>并行执行</p></td><td rowspan="1" colspan="1"><p>独立子任务同时运行</p></td><td rowspan="1" colspan="1"><p>3 个 20s 的子任务 → 并行只需 20s 而非 60s</p></td></tr><tr><td rowspan="1" colspan="1"><p>失败隔离</p></td><td rowspan="1" colspan="1"><p>子 agent 失败不影响其他</p></td><td rowspan="1" colspan="1"><p>可基于部分成功的结果给出答案</p></td></tr><tr><td rowspan="1" colspan="1"><p>专家化</p></td><td rowspan="1" colspan="1"><p>不同子 agent 用不同的 system prompt</p></td><td rowspan="1" colspan="1"><p>搜索专家/代码专家/数据专家各司其职</p></td></tr><tr><td rowspan="1" colspan="1"><p>质量提升</p></td><td rowspan="1" colspan="1"><p>多 Agent 交叉验证</p></td><td rowspan="1" colspan="1"><p>减少单 Agent 的幻觉和遗漏</p></td></tr></tbody></table>

### 关键设计挑战

<table><colgroup><col width="122"> <col width="300"> <col width="387"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>挑战</p></td><td rowspan="1" colspan="1"><p>描述</p></td><td rowspan="1" colspan="1"><p>解决思路</p></td></tr><tr><td rowspan="1" colspan="1"><p>任务拆解粒度</p></td><td rowspan="1" colspan="1"><p>拆太细增加通信开销，拆太粗失去并行意义</p></td><td rowspan="1" colspan="1"><p>依赖 LLM 判断 + 经验阈值（3-5个子任务为宜）</p></td></tr><tr><td rowspan="1" colspan="1"><p>结果聚合</p></td><td rowspan="1" colspan="1"><p>多个子 agent 结果如何合并为连贯回答</p></td><td rowspan="1" colspan="1"><p>主 agent 做综合推理 / 结构化合并模板</p></td></tr><tr><td rowspan="1" colspan="1"><p>资源控制</p></td><td rowspan="1" colspan="1"><p>防止子 agent 无限膨胀（递归创建子 Agent）</p></td><td rowspan="1" colspan="1"><p>并发数限制 + 超时 + 深度限制 + 工具权限收窄</p></td></tr><tr><td rowspan="1" colspan="1"><p>状态一致性</p></td><td rowspan="1" colspan="1"><p>子 agent 之间需要共享信息时怎么办</p></td><td rowspan="1" colspan="1"><p>通过主 agent 转发 / 共享工具注册表 / 共享内存区</p></td></tr><tr><td rowspan="1" colspan="1"><p>错误传播</p></td><td rowspan="1" colspan="1"><p>一个 Agent 的错误输出被下游 Agent 放大</p></td><td rowspan="1" colspan="1"><p>每步输出验证 + 错误时回退重试 + 置信度传递</p></td></tr><tr><td rowspan="1" colspan="1"><p>成本控制</p></td><td rowspan="1" colspan="1"><p>多 Agent 的 Token 消耗是单 Agent 的数倍</p></td><td rowspan="1" colspan="1"><p>按需使用（简单任务不拆分）+ 弱模型做 Router/Worker</p></td></tr></tbody></table>

## Harness：让 Agent 稳定运行

### 什么是 Agent Harness

Harness（直译"挽具/安全带"）在 Agent 领域特指：包裹在 Agent 核心循环外层的运行时保护框架。它不改变 Agent 的决策逻辑，但负责让 Agent 在真实世界中"活得够久、跑得够稳"。

这个概念在 2024-2025 年随着 Agent 从 Demo 走向生产而被正式提出。代表性开源项目：

<table><colgroup><col width="134"> <col width="139"> <col width="396"> <col width="187"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>项目</p></td><td rowspan="1" colspan="1"><p>组织</p></td><td rowspan="1" colspan="1"><p>定位</p></td><td rowspan="1" colspan="1"><p>GitHub Stars</p></td></tr><tr><td rowspan="1" colspan="1"><p>DeerFlow</p></td><td rowspan="1" colspan="1"><p>ByteDance</p></td><td rowspan="1" colspan="1"><p>"Super agent harness" — 编排子 Agent + 记忆 + 沙箱</p></td><td rowspan="1" colspan="1"><p>68k+</p></td></tr><tr><td rowspan="1" colspan="1"><p>DeepAgents</p></td><td rowspan="1" colspan="1"><p>LangChain</p></td><td rowspan="1" colspan="1"><p>"Batteries-included agent harness" — 文件系统/子Agent/上下文/记忆</p></td><td rowspan="1" colspan="1"><p>23k+</p></td></tr><tr><td rowspan="1" colspan="1"><p>SWE-agent</p></td><td rowspan="1" colspan="1"><p>Princeton NLP</p></td><td rowspan="1" colspan="1"><p>代码修复 Agent + YAML 驱动的可配置 harness</p></td><td rowspan="1" colspan="1"><p>19k+</p></td></tr><tr><td rowspan="1" colspan="1"><p>Parlant</p></td><td rowspan="1" colspan="1"><p>Emcie</p></td><td rowspan="1" colspan="1"><p>"Interaction control harness" — 上下文工程 + 行为治理</p></td><td rowspan="1" colspan="1"><p>18k+</p></td></tr><tr><td rowspan="1" colspan="1"><p>OpenHarness</p></td><td rowspan="1" colspan="1"><p>HKUDS (港大)</p></td><td rowspan="1" colspan="1"><p>"One command to launch all agent harnesses" — CLI agent 通用运行时</p></td><td rowspan="1" colspan="1"><p>12k+</p></td></tr><tr><td rowspan="1" colspan="1"><p>Hive</p></td><td rowspan="1" colspan="1"><p>Aden</p></td><td rowspan="1" colspan="1"><p>"Multi-Agent Harness for Production" — 状态管理 + 故障恢复</p></td><td rowspan="1" colspan="1"><p>10k+</p></td></tr><tr><td rowspan="1" colspan="1"><p>desloppify</p></td><td rowspan="1" colspan="1"><p>peteromallet</p></td><td rowspan="1" colspan="1"><p>Agent harness for code quality — 扫描/修复循环 + 防作弊评分</p></td><td rowspan="1" colspan="1"><p>3k+</p></td></tr><tr><td rowspan="1" colspan="1"><p>CascadeFlow</p></td><td rowspan="1" colspan="1"><p>Lemony AI</p></td><td rowspan="1" colspan="1"><p>"Runtime Intelligence Layer" — 成本/延迟/质量实时优化</p></td><td rowspan="1" colspan="1"><p>2k+</p></td></tr><tr><td rowspan="1" colspan="1"><p>Harmonist</p></td><td rowspan="1" colspan="1"><p>GammaLab</p></td><td rowspan="1" colspan="1"><p>协议强制执行作为机械门控 (186 agents, 0 运行时依赖)</p></td><td rowspan="1" colspan="1"><p>2k+</p></td></tr><tr><td rowspan="1" colspan="1"><p>saifctl</p></td><td rowspan="1" colspan="1"><p>Safe AI Factory</p></td><td rowspan="1" colspan="1"><p>"Safety harness" — 收敛循环 + Gate/Reviewer/Holdout 三验证</p></td><td rowspan="1" colspan="1"><p>新兴</p></td></tr><tr><td rowspan="1" colspan="1"><p>avakill</p></td><td rowspan="1" colspan="1"><p>log-bell</p></td><td rowspan="1" colspan="1"><p>"Safety firewall" — 在工具执行前拦截并执行 YAML 策略</p></td><td rowspan="1" colspan="1"><p>新兴</p></td></tr></tbody></table>

可以看到一个明确趋势：Harness 正在成为 Agent 架构中与 Agent Loop 平级的一等公民。如果 Agent Loop 是"大脑"，Harness 就是"免疫系统 + 骨骼 + 皮肤"。

### 为什么需要 Harness —— 从裸奔到防护

一个没有 Harness 的 Agent 就像没有保护装置的赛车手——晴天路况好时跑得飞快，但遇到任何意外就是灾难。

![[690c11a7-8ee4-45b4-b1c3-1067c685d1fd.png]]

关键洞察：LLM 的错误率并不低（工具调用格式错误约 5-10%，幻觉率更高），只是 Harness 将其屏蔽了。没有 Harness 的 Agent 不是不能跑，而是跑不过 24 小时。

### Harness 的定位

Harness是一个统一的运行时壳，所有非核心决策逻辑的运行时他都参与其中，保证各个链路能够稳定运行。

![[7819e6d6-bad2-4a62-8a08-0d7efd34bbeb.png]]

### Harness 的核心子系统

基于对 OpenHarness、DeerFlow、Parlant、SWE-agent、Claude Code 等项目的分析，一个完整的 Harness 通常包含以下子系统：

![[92f5f83f-6412-4045-9718-37af4eec7315.png]]

---

#### 子系统 1：错误分类与恢复

这是 Harness 最核心的能力。核心原则：不是所有错误都值得重试，但所有错误都需要被分类处理。

┌─────────────────────────────────────────────────────────────────────────┐

│ 错误分类决策树 │

│ │

│ 异常发生 │

│ │ │

│ ▼ │

│ ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ │

│ │ 瞬态错误 │ │ 速率限制错误 │ │ 永久错误 │ │

│ │ (Transient) │ │ (Throttle) │ │ (Fatal) │ │

│ └──────┬──────┘ └──────┬───────┘ └──────┬──────┘ │

│ │ │ │ │

│ • 网络超时 • 429 Too Many • API Key 无效 │

│ • 连接断开 • 模型并发限制 • 模型不存在 │

│ • 500 服务器错误 • Token 配额耗尽 • 内容违规拒绝 │

│ • 响应截断 • 账户欠费 • Schema 不匹配 │

│ │ │ │ │

│ ▼ ▼ ▼ │

│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │

│ │ 指数退避重试 │ │ 尊重 Retry- │ │ 终止 + 报告 │ │

│ │ + 随机抖动 │ │ After 头 │ │ 给用户 │ │

│ │ max 3 次 │ │ 或递增等待 │ │ │ │

│ └──────────────┘ └──────────────┘ └──────────────┘ │

│ │

│ 进阶策略 (来自 OpenHarness): │

│ • 模型降级: GPT-4 失败 → 自动回退到 GPT-3.5 │

│ • 提供商切换: OpenAI 超时 → 切换 Anthropic │

│ • 请求拆分: 超大请求 → 拆成多个小请求重试 │

└─────────────────────────────────────────────────────────────────────────┘

为什么需要"抖动"（Jitter）？ 如果多个客户端在失败后等待相同时间重试，会在同一瞬间再次涌入服务器（"惊群效应" / Thundering Herd）。加随机抖动使重试时间离散分布：

import random

def exponential\_backoff\_with\_jitter(attempt: int, base: float = 1.0) -> float:

"""

业界标准实现 (AWS, Google Cloud, Anthropic SDK 均采用类似策略)

"""

exponential = base \* (2 \*\* attempt) # 1s, 2s, 4s, 8s...

jitter = random.uniform(0, exponential \* 0.5) # 0~50% 随机偏移

return min(exponential + jitter, 60.0) # 上限 60s

\# AWS 推荐的 "Full Jitter" 变体 — 更激进的分散

def full\_jitter(attempt: int, base: float = 1.0, cap: float = 60.0) -> float:

return random.uniform(0, min(cap, base \* (2 \*\* attempt)))

真实案例：Anthropic 官方 SDK 内置 2 次自动重试 + 指数退避；OpenAI SDK 默认重试 `429` / `500` / `503` 错误。这些都是 Harness 的最小实现。

---

#### 子系统 2：上下文工程 (Context Engineering)

Parlant 将这个概念提升到了框架设计核心——"getting the right context, no more and no less, into the prompt at the right time"。上下文管理不只是防溢出，更是让 Agent 在有限窗口内保持最优决策能力。

┌─────────────────────────────────────────────────────────────────────────┐

│ 上下文生命周期管理 │

│ │

│ Token 使用率 │

│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% (窗口上限) │

│ │

│ ┌─── 阶段4: 紧急模式 │

│ ━━━━━┤ 90% 只保留 system + 最近N轮 │

│ ━━━━━ │ │

│ ━━━━━ ━━━━━┤ 80% 阶段3: 工具结果截断 │

│ ━━━━━ │ (只保留 summary) │

│ ━━━━━ ━━━━━┤ 70% 阶段2: 自动压缩 │

│ ━━━━━ │ (结构化摘要替换早期消息) │

│ ━━━━━━━━━━ ━━━━━┤ 60% 阶段1: 预警 │

│ │ (标记可压缩区域) │

│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│ │

│ 正常运行 (无干预) │ 时间 → │

└─────────────────────────────────────────────────────────────────────────┘

各阶段策略对比：

<table><colgroup><col width="150"> <col width="150"> <col width="150"> <col width="150"> <col width="309"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>阶段</p></td><td rowspan="1" colspan="1"><p>触发条件</p></td><td rowspan="1" colspan="1"><p>操作</p></td><td rowspan="1" colspan="1"><p>信息损失</p></td><td rowspan="1" colspan="1"><p>代表实现</p></td></tr><tr><td rowspan="1" colspan="1"><p>阶段1: 预警</p></td><td rowspan="1" colspan="1"><p>60% 窗口</p></td><td rowspan="1" colspan="1"><p>标记冗余区域，准备压缩</p></td><td rowspan="1" colspan="1"><p>无</p></td><td rowspan="1" colspan="1"><p>Claude Code auto-compact</p></td></tr><tr><td rowspan="1" colspan="1"><p>阶段2: 压缩</p></td><td rowspan="1" colspan="1"><p>70% 窗口</p></td><td rowspan="1" colspan="1"><p>LLM 生成结构化摘要替换早期消息</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>LangChain ConversationSummaryMemory</p></td></tr><tr><td rowspan="1" colspan="1"><p>阶段3: 截断</p></td><td rowspan="1" colspan="1"><p>80% 窗口</p></td><td rowspan="1" colspan="1"><p>工具返回只保留摘要，删除原始内容</p></td><td rowspan="1" colspan="1"><p>中</p></td><td rowspan="1" colspan="1"><p>OpenHarness context trim</p></td></tr><tr><td rowspan="1" colspan="1"><p>阶段4: 紧急</p></td><td rowspan="1" colspan="1"><p>90% 窗口</p></td><td rowspan="1" colspan="1"><p>仅保留 system prompt + 最近 3 轮</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>SWE-agent window reset</p></td></tr></tbody></table>

Parlant 的创新方法：不同于被动压缩，Parlant 主动做上下文窄化 (Context Narrowing) ——根据当前对话轮次的主题，只注入相关的规则、知识和工具描述，从源头控制 token 消耗。这是从"事后压缩"到"事前精选"的范式转变。

---

#### 子系统 3：迭代控制 (Iteration Control)

Agent 的无限循环是生产中最常见的"静默杀手"——不会崩溃，但会持续消耗 Token 和时间，直到预算耗尽。

┌─────────────────────────────────────────────────────────────────────────┐

│ 迭代控制 — 三层防护 │

│ │

│ Layer 1: 硬性预算 (Hard Budget) │

│ ─────────────────────────────────────────── │

│ • 最大迭代次数 (如 200 轮) │

│ • 最大 Token 消耗 (如 $5/次) │

│ • 最大执行时间 (如 30 分钟) │

│ → 任一触发 = 强制终止 + 输出当前摘要 │

│ │

│ Layer 2: 模式检测 (Pattern Detection) │

│ ─────────────────────────────────────────── │

│ • 重复检测: 同一工具 + 同一参数连续调用 N 次 │

│ • 震荡检测: A→B→A→B 反复切换状态 │

│ • 空转检测: 连续 N 轮无新信息/无副作用 │

│ → 触发 = 注入反思提示 / 强制 re-plan / 终止 │

│ │

│ Layer 3: 进展评估 (Progress Evaluation) │

│ ─────────────────────────────────────────── │

│ • 里程碑机制: 每 N 轮评估 "离目标更近了吗?" │

│ • 衰减因子: 每轮的价值递减，超过阈值说明边际收益已不足 │

│ • 置信度: LLM 自评 "我有多确定能完成?" < 阈值则终止 │

│ → 触发 = 交还控制权给用户 + 附带进展报告 │

│ │

└─────────────────────────────────────────────────────────────────────────┘

SWE-agent 的做法：在代码修复任务中设置 cost limit（$3/实例），超出后强制停止并提交当前最优 patch。这保证了在 benchmark 评测中不会因单个困难实例耗光全部预算。

DeerFlow 的做法：引入"迭代衰减"机制——前 10 轮每轮权重 1.0，之后每轮权重递减 0.95^n。当累积衰减权重低于阈值，判定为"边际收益不足"，自动终止。

---

#### 子系统 4：工具治理 (Tool Governance)

Agent 调用外部工具是最大的风险点——因为工具操作有副作用（删文件、发邮件、执行代码）且不可逆。

┌─────────────────────────────────────────────────────────────────────────┐

│ 工具调用的完整生命周期 │

│ │

│ LLM 输出工具调用意图 │

│ │ │

│ ▼ │

│ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ │

│ │ ① 参数校验 │───→│ ② 权限检查 │───→│ ③ 参数修复 │ │

│ │ & 清洗 │ │ & 审批 │ │ (容错) │ │

│ └─────────────┘ └─────────────┘ └──────┬───────┘ │

│ │ │

│ 校验: 权限: 修复策略: │

│ • JSON Schema • 白名单/黑名单 • 大小写归一化 │

│ • 必填参数 • 路径范围限制 • camelCase→snake\_case │

│ • 类型转换 • 危险操作需审批 • 模糊匹配 (Levenshtein) │

│ • 注入检测 • 并发/频率限制 • 缺失参数填默认值 │

│ │ │

│ ▼ │

│ ┌──────────────┐ │

│ │ ④ 沙箱执行 │ │

│ │ (隔离环境) │ │

│ └──────┬───────┘ │

│ │ │

│ 沙箱实现: │ │

│ • Docker 容器 (SWE-agent, OpenHands) │ │

│ • WASM 沙箱 (浏览器环境) │ │

│ • 文件系统虚拟化 (路径隔离) │ │

│ • seccomp/AppArmor (系统调用限制) │ │

│ ▼ │

│ ┌──────────────┐ │

│ │ ⑤ 结果验证 │ │

│ │ & 后处理 │ │

│ └──────────────┘ │

│ │

│ 验证: 返回大小限制 / 敏感信息脱敏 / 格式标准化 │

│ │

avakill 的策略引擎方式：通过 YAML 定义工具策略，在执行前拦截判定：

\# avakill 策略示例 — 声明式安全规则

policies:

\- name: "prevent-destructive-file-ops"

match:

tool: "bash"

args\_contains: \["rm -rf", "dd if=", "mkfs"\]

action: deny

message: "Destructive file operation blocked"

\- name: "limit-network-access"

match:

tool: "fetch\_url"

args\_match:

url: "^(?!https://(api\\\\.github\\\\.com|.\*\\\\.internal)).\*"

action: ask\_user

message: "Agent wants to access external URL: {url}"

saifctl 的规格驱动方式：先定义 Agent 的能力边界规格（spec），运行时 harness 确保 Agent 行为不越界，类似形式化验证的思路。

---

#### 子系统 5：安全防护 (Security)

Agent 面临独特且严峻的安全威胁——间接提示注入 (Indirect Prompt Injection)。与传统 Web 安全不同，攻击面在于Agent 处理的内容本身就可能是攻击载荷。

┌─────────────────────────────────────────────────────────────────────────┐

│ Agent 安全威胁模型 │

│ │

│ ┌──────────────────────────────────────────────────────────────────┐ │

│ │ 攻击面 1: 输入侧 │ │

│ │ • 用户直接注入 (直接 Prompt Injection) │ │

│ │ • 对抗性 prompt 绕过安全限制 │ │

│ └──────────────────────────────────────────────────────────────────┘ │

│ │

│ ┌──────────────────────────────────────────────────────────────────┐ │

│ │ 攻击面 2: 工具返回侧 (最危险) │ │

│ │ • 网页内容包含 "Ignore previous instructions..." │ │

│ │ • 文件内容嵌入隐藏指令 │ │

│ │ • API 响应中的恶意 payload │ │

│ │ • 邮件/消息内容操纵 Agent 行为 │ │

│ └──────────────────────────────────────────────────────────────────┘ │

│ │

│ ┌──────────────────────────────────────────────────────────────────┐ │

│ │ 攻击面 3: 输出/持久化侧 │ │

│ │ • Agent 输出泄漏系统 prompt / 内部标签 │ │

│ │ • 凭证信息 (API Key, Token) 出现在回复中 │ │

│ │ • 记忆投毒 — 写入恶意信息影响后续行为 │ │

│ └──────────────────────────────────────────────────────────────────┘ │

│ │

└─────────────────────────────────────────────────────────────────────────┘

防护策略矩阵：

<table><colgroup><col width="167"> <col width="240"> <col width="200"> <col width="270"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>威胁</p></td><td rowspan="1" colspan="1"><p>检测方法</p></td><td rowspan="1" colspan="1"><p>防护位置</p></td><td rowspan="1" colspan="1"><p>代表方案</p></td></tr><tr><td rowspan="1" colspan="1"><p>间接提示注入</p></td><td rowspan="1" colspan="1"><p>模式匹配 + 语义分类器</p></td><td rowspan="1" colspan="1"><p>工具返回后、送入 LLM 前</p></td><td rowspan="1" colspan="1"><p>Anthropic Constitutional AI</p></td></tr><tr><td rowspan="1" colspan="1"><p>凭证泄漏</p></td><td rowspan="1" colspan="1"><p>正则 (API Key/Token 模式)</p></td><td rowspan="1" colspan="1"><p>输出流过滤</p></td><td rowspan="1" colspan="1"><p>OpenHarness output scrubber</p></td></tr><tr><td rowspan="1" colspan="1"><p>路径穿越</p></td><td rowspan="1" colspan="1"><p>路径规范化 + 白名单</p></td><td rowspan="1" colspan="1"><p>文件操作工具前</p></td><td rowspan="1" colspan="1"><p>SWE-agent chroot</p></td></tr><tr><td rowspan="1" colspan="1"><p>命令注入</p></td><td rowspan="1" colspan="1"><p>Shell 元字符检测</p></td><td rowspan="1" colspan="1"><p>Bash 工具参数清洗</p></td><td rowspan="1" colspan="1"><p>DeerFlow sandbox mode</p></td></tr><tr><td rowspan="1" colspan="1"><p>记忆投毒</p></td><td rowspan="1" colspan="1"><p>内容可信度评估</p></td><td rowspan="1" colspan="1"><p>Memory write 前</p></td><td rowspan="1" colspan="1"><p>Claude Code memory validation</p></td></tr><tr><td rowspan="1" colspan="1"><p>System Prompt 泄漏</p></td><td rowspan="1" colspan="1"><p>输出标签检测 + 围栏去除</p></td><td rowspan="1" colspan="1"><p>流式输出管线</p></td><td rowspan="1" colspan="1"><p>Parlant response filtering</p></td></tr></tbody></table>

深层防御原则：安全不能只靠一层。业界最佳实践是 Defense in Depth——输入、处理、输出三层各设独立检测，任何一层失守，后面的层仍能拦截。

---

#### 子系统 6：可观测性 (Observability)

Agent 的不确定性远超传统软件——同一输入可能产生不同的执行路径。没有可观测性，出了问题只能"重现一下看看"。

┌─────────────────────────────────────────────────────────────────────────┐

│ Agent 可观测性三支柱 │

│ │

│ ┌────────────────────┐ ┌────────────────────┐ ┌─────────────────┐ │

│ │ Logging (日志) │ │ Tracing (追踪) │ │ Metrics (指标) │ │

│ │ │ │ │ │ │ │

│ │ • 每轮决策记录 │ │ • 端到端请求链路 │ │ • Token/轮/成本 │ │

│ │ • 工具调用入参出参 │ │ • 父子 Agent 关系 │ │ • 成功率/重试率 │ │

│ │ • 错误上下文 │ │ • 工具调用耗时 │ │ • 延迟分布 │ │

│ │ • 安全事件审计 │ │ • 压缩/降级事件 │ │ • 循环检测触发率 │ │

│ └────────────────────┘ └────────────────────┘ └─────────────────┘ │

│ │

│ 关键追踪维度: │

│ ┌─────────────────────────────────────────────────────────────────┐ │

│ │ Session → Turn → LLM Call → Tool Call → Sub-Agent │ │

│ │ ↕ ↕ ↕ ↕ ↕ │ │

│ │ 用户意图 决策轮次 模型响应 外部操作 委托任务 │ │

│ └─────────────────────────────────────────────────────────────────┘ │

│ │

│ 代表工具: LangSmith / Langfuse / OpenTelemetry / Helicone │

│ │

└─────────────────────────────────────────────────────────────────────────┘

DeerFlow 同时支持 LangSmith 和 Langfuse 两种追踪后端，体现了可观测性在生产 Agent 中的必要地位。

---

### Harness 设计原则

从上述开源实践中可以提炼出 7 条核心设计原则：

<table><colgroup><col width="166"> <col width="295"> <col width="348"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>原则</p></td><td rowspan="1" colspan="1"><p>含义</p></td><td rowspan="1" colspan="1"><p>反面教材</p></td></tr><tr><td rowspan="1" colspan="1"><p>分类先于处理</p></td><td rowspan="1" colspan="1"><p>必须先诊断错误类型，才能选正确策略</p></td><td rowspan="1" colspan="1"><p>所有错误一律重试 3 次</p></td></tr><tr><td rowspan="1" colspan="1"><p>渐进式降级</p></td><td rowspan="1" colspan="1"><p>从温和到激进，逐级响应</p></td><td rowspan="1" colspan="1"><p>token 超限直接清空历史</p></td></tr><tr><td rowspan="1" colspan="1"><p>静默优先</p></td><td rowspan="1" colspan="1"><p>能内部恢复的异常不暴露给用户</p></td><td rowspan="1" colspan="1"><p>每次 retry 都弹 toast</p></td></tr><tr><td rowspan="1" colspan="1"><p>预算有限</p></td><td rowspan="1" colspan="1"><p>任何自动恢复都必须有上限</p></td><td rowspan="1" colspan="1"><p>无限重试直到成功</p></td></tr><tr><td rowspan="1" colspan="1"><p>可观测</p></td><td rowspan="1" colspan="1"><p>静默≠无记录，所有操作必须可审计</p></td><td rowspan="1" colspan="1"><p>静默吞掉异常无日志</p></td></tr><tr><td rowspan="1" colspan="1"><p>最小权限</p></td><td rowspan="1" colspan="1"><p>工具权限按需授予，危险操作需审批</p></td><td rowspan="1" colspan="1"><p>所有工具默认全权执行</p></td></tr><tr><td rowspan="1" colspan="1"><p>声明式策略</p></td><td rowspan="1" colspan="1"><p>安全规则外置为配置，非硬编码</p></td><td rowspan="1" colspan="1"><p>每个安全检查写死在代码里</p></td></tr></tbody></table>

### Harness 的演进趋势

如下所示是一个从手动到慢慢自动化的过程。

![[00e4d6f6-b6d2-49b0-8978-ad9d4454f324.png]]

### 小结

Harness 是 Agent 从"能跑"到"能用"的关键分水岭。一个没有 Harness 的 Agent 就像没有操作系统的程序——能执行，但无法在真实环境中可靠运行。随着 Agent 应用进入生产，Harness 正从"各家自建"走向"标准化框架"，成为 Agent 技术栈中不可或缺的一层。

---

### Claw 出现：每个人的私人秘书

上面讨论的 Agent 都运行在服务端，用户通过 API 或 Web 界面远程交互。2024-2025 年出现了一个根本性的转变——Agent 以本地客户端的形式运行在你的电脑上，直接操控你的工作环境。实现上区别没有太大，核心是agent跑在了你的本地，可以获取你本地的信息，操作你本地的文件等等。

![[c8c17cc0-ca74-4799-8f32-e35fdb41470a.png]]

常见场景对比：

<table><colgroup><col width="250"> <col width="279"> <col width="331"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>场景</p></td><td rowspan="1" colspan="1"><p>服务端 Agent（传统）</p></td><td rowspan="1" colspan="1"><p>Claw Agent（本地）</p></td></tr><tr><td rowspan="1" colspan="1"><p>"帮我修复这个 bug"</p></td><td rowspan="1" colspan="1"><p>"你需要在第 15 行改成..." → 用户手动改</p></td><td rowspan="1" colspan="1"><p>直接编辑文件 → 运行测试 → 确认修复</p></td></tr><tr><td rowspan="1" colspan="1"><p>"帮我部署到测试环境"</p></td><td rowspan="1" colspan="1"><p>"执行以下命令:..." → 用户复制粘贴</p></td><td rowspan="1" colspan="1"><p>直接执行 docker build → push → deploy</p></td></tr><tr><td rowspan="1" colspan="1"><p>"帮我创建一个 PR"</p></td><td rowspan="1" colspan="1"><p>"去 GitHub 创建 PR，标题是..." → 用户操作</p></td><td rowspan="1" colspan="1"><p>git add → commit → push → gh pr create</p></td></tr><tr><td rowspan="1" colspan="1"><p>"帮我查个 bug 原因"</p></td><td rowspan="1" colspan="1"><p>"可能是XX问题" → 用户自己去看日志</p></td><td rowspan="1" colspan="1"><p>grep 日志 → 读代码 → 定位根因 → 给出结论</p></td></tr></tbody></table>

关键差异：Claw Agent 消除了"告诉用户怎么做"和"用户实际执行"之间的断层——它直接动手做，形成完整的"决策-执行-验证"闭环。

## 止：终点未到，变化依旧

发展至今，好像已经很完备了，实际 agent 没有跑出一个很划时代的范式，大家还在探索阶段，未来会持续发展。

回顾整条技术线，本质上是在解决三个递进的问题：

1.

LLM 知道什么（知识 → 记忆 + RAG 扩展）

2.

LLM 能做什么（能力 → function call + MCP + skill）

3.

LLM 怎么做得好（质量 → agent loop + multi agent + harness）

这三层问题不是一次性解决的，而是随着实践不断暴露出新痛点，再催生新方案。下面进入实践部分，看看这些理论在项目中是怎么落地的。

## Agent 实践

## 项目总览

### 一句话定位

本项目定位是一个云端通用agent，用于处理用户的日常问题，后续用户沉淀mcp和skill后可以慢慢加入进来，让agent的能力越来越完善，逐渐可以解决更多问题。

### 系统架构

整个agent的架构设计如下所示，整个流程也比较简单，核心是一个loop，loop循环内会调用底层能力，这里特别注意，能力层需要尽可能抽象，对编排层暴露尽可能少的接口，让agent的loop流程保持尽可能的简洁，提高后续持续迭代的可维护性。下面我会对我认为比较重要的模块详细展开说明。

![[031bc98a-9a94-4972-851e-1e4a0a0cbdd5.jpeg]]

## 核心 Loop 设计

> 核心方案：ReAct 主循环（按需可plan） + 六重保障（预算/压缩/重试/修复/中断/防抖）。

### loop流程

在进入代码之前，先用一张图理解整个循环的数据流和保障机制的介入时机：

┌─────────────────────────────────────────────────────────────────────────┐

│ Agent Loop 完整生命周期 │

│ │

│ 用户请求 │

│ │ │

│ ▼ │

│ ┌─────────────────────────────────────────────────────────────────┐ │

│ │ 预算检查 (IterationBudget) │ │

│ │ 当前迭代 < 最大迭代? │ │

│ │ NO → 生成工作摘要 → 优雅退出 │ │

│ │ YES ↓ │ │

│ ├─────────────────────────────────────────────────────────────────┤ │

│ │ 中断检查 │ │

│ │ 用户请求取消? │ │

│ │ YES → 保存状态 → 优雅退出 │ │

│ │ NO ↓ │ │

│ ├─────────────────────────────────────────────────────────────────┤ │

│ │ 上下文压缩检查 (ContextCompressor) │ │

│ │ token 数 >= 75% 窗口? │ │

│ │ YES → 执行压缩(三步策略) → 注入 Todo 状态 │ │

│ │ NO ↓ │ │

│ ├─────────────────────────────────────────────────────────────────┤ │

│ │ 记忆预取 │ │

│ │ 提取用户最近 query → 预取记忆 → 注入 <memory-context> 围栏 │ │

│ │ ↓ │ │

│ ├─────────────────────────────────────────────────────────────────┤ │

│ │ ★ THINK: 调用 LLM │ │

│ │ \_api\_call\_with\_retry(messages, tools) │ │

│ │ │ │

│ │ 成功 → 解析 response │ │

│ │ 失败 → ErrorClassifier 分类: │ │

│ │ 瞬态错误 → 指数退避+抖动重试 │ │

│ │ 上下文溢出 → 触发压缩后重试 │ │

│ │ 永久错误 → 报告用户 → 退出 │ │

│ │ ↓ │ │

│ ├─────────────────────────────────────────────────────────────────┤ │

代码示意：

下面是 `agent/loop.py` 的核心精简代码，每一行都有注释说明其设计意图：

\# agent/loop.py 核心循环（简化版，展示完整保障机制）

class AgentLoop:

def run(self, messages, tools) -> Generator:

budget = IterationBudget(self.\_max\_iterations) # 保障①: 迭代预算

while budget.consume():

\# 保障②: 可中断

if self.\_interrupt\_requested:

yield {"type": "interrupted"}

return

\# 保障③: 上下文压缩

messages = self.\_check\_and\_compress(messages)

\# 记忆预取注入

prefetch\_context = self.\_memory.prefetch\_all(user\_query)

#...注入 <memory-context> 围栏

\# THINK: 调用 LLM（保障④: 错误分类+重试）

response = yield from self.\_api\_call\_with\_retry(messages, tools)

\# 保障⑤: 空响应防护

if not content and not tool\_calls:

consecutive\_empty += 1

if consecutive\_empty >= 2:

yield {"type": "error", "message": "LLM 连续返回空响应"}

return

continue

\# ACT: 执行工具调用（保障⑥: 名称/参数修复）

if tool\_calls:

yield from self.\_dispatcher.execute\_tool\_calls(tool\_calls, messages)

continue

\# DONE: 无工具调用 → 最终回答

yield {"type": "final\_answer", "content": content}

### 保障及触发条件

<table><colgroup><col width="103"> <col width="196"> <col width="150"> <col width="201"> <col width="237"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>保障</p></td><td rowspan="1" colspan="1"><p>模块</p></td><td rowspan="1" colspan="1"><p>触发条件</p></td><td rowspan="1" colspan="1"><p>行为</p></td><td rowspan="1" colspan="1"><p>代码位置</p></td></tr><tr><td rowspan="1" colspan="1"><p>① 迭代预算</p></td><td rowspan="1" colspan="1"><div><code>IterationBudget</code></div></td><td rowspan="1" colspan="1"><p>达到上限（默认90轮）</p></td><td rowspan="1" colspan="1"><p>生成工作摘要 → 优雅退出</p></td><td rowspan="1" colspan="1"><div><code>loop.py</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>② 可中断</p></td><td rowspan="1" colspan="1"><div><code>_interrupt_requested</code></div></td><td rowspan="1" colspan="1"><p>外部线程设置标志</p></td><td rowspan="1" colspan="1"><p>保存记忆 → 立即退出</p></td><td rowspan="1" colspan="1"><div><code>loop.py</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>③ 上下文压缩</p></td><td rowspan="1" colspan="1"><div><code>ContextCompressor</code></div></td><td rowspan="1" colspan="1"><p>token ≥ 75% 窗口</p></td><td rowspan="1" colspan="1"><p>三步压缩 + 三级降级</p></td><td rowspan="1" colspan="1"><div><code>context_compressor.py</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>④ 错误重试</p></td><td rowspan="1" colspan="1"><div><code>ErrorClassifier</code> + <code>jittered_backoff</code></div></td><td rowspan="1" colspan="1"><p>API 异常</p></td><td rowspan="1" colspan="1"><p>分类 → 重试/压缩/终止</p></td><td rowspan="1" colspan="1"><div><code>error_classifier.py</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>⑤ 空响应防护</p></td><td rowspan="1" colspan="1"><p>连续计数器</p></td><td rowspan="1" colspan="1"><p>连续2次空</p></td><td rowspan="1" colspan="1"><p>注入提示引导 → 超限终止</p></td><td rowspan="1" colspan="1"><div><code>loop.py</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>⑥ 工具修复</p></td><td rowspan="1" colspan="1"><div><code>ToolDispatcher</code></div></td><td rowspan="1" colspan="1"><p>工具名/参数错误</p></td><td rowspan="1" colspan="1"><p>模糊匹配修复 → 重新调用</p></td><td rowspan="1" colspan="1"><div><code>tool_dispatcher.py</code></div></td></tr></tbody></table>

---

### 上下文压缩详细设计

上下文压缩是整个 Loop 最复杂的子系统。它解决的核心问题是：Agent 对话越长，累积的 messages 越多，总 token 数迟早会撞上模型的上下文窗口上限（如 128K），此时 API 会直接报错拒绝。

#### 压缩的触发时机

当 prompt token 达到 context\_length \* 75% 时触发压缩，为什么是 75% 而不是 90%?因为要给 LLM 的回复留空间（completion tokens 也占窗口），加上压缩本身也会调用 LLM（也需要 token），所以要预留 25% 余量。

#### 压缩的流程

共分为三步：划分保护区、修建中间取件的工具输出、调用模型生成结构化摘要。

┌─────────────────────────────────────────────────────────────────────────┐

│ 压缩三步策略 (compress 方法) │

│ │

│ 输入: \[msg\_0, msg\_1, msg\_2,..., msg\_N\] (N 可能 > 100) │

│ │

│ Step 1: 划分保护区 │

│ ┌────────────┐ ┌──────────────────────────────┐ ┌────────────────┐ │

│ │ HEAD 保护区 │ │ MIDDLE 压缩区 │ │ TAIL 保护区 │ │

│ │ (前3条) │ │ (所有中间消息) │ │ (后6条) │ │

│ │ │ │ 这里是压缩目标 → │ │ │ │

│ │ • system │ │ │ │ • 最近3轮对话 │ │

│ │ • 首轮对话 │ │ │ │ • 用户最新输入 │ │

│ └────────────┘ └──────────────────────────────┘ └────────────────┘ │

│ │

│ 为什么保护头部? system prompt 包含 Agent 的角色定义和工具列表， │

│ 丢失它 Agent 就"失忆"了。首轮对话通常包含用户的核心目标。 │

│ 为什么保护尾部? 最近的对话是 LLM 决策的直接依据，丢失会导致重复劳动。 │

│ │

│ Step 2: 修剪 MIDDLE 区的工具输出 │

│ ┌──────────────────────────────────────────────────────────────────┐ │

│ │ Before: {"role":"tool", "content":"<3000字的文件内容>"} │ │

│ │ After: {"role":"tool", "content":"\[read\_file\] config.py │ │

│ │ from line 1 (3,000 chars)"} │ │

│ │ │ │

│ │ Before: {"tool\_calls":\[{..."arguments":"{\\"content\\":\\"<2000字>\\"│ │

│ │ After: {"tool\_calls":\[{..."arguments":"{\\"content\\":\\"<前200字> │ │

│ │...\[truncated\]\\"}" │ │

│ └──────────────────────────────────────────────────────────────────┘ │

│ │

│ 这一步是"物理压缩"——直接删减冗余内容。通常能减少 40-60% token。 │

│ │

│ Step 3: LLM 驱动的结构化摘要 │

│ ┌──────────────────────────────────────────────────────────────────┐ │

│ │ 将修剪后的 MIDDLE 发给 LLM，要求它按 13 个字段生成摘要: │ │

│ │ │ │

│ │ ## Active Task ← 用户最近的未完成请求（逐字复制） │ │

#### 工具输出修剪的代码实现

这是压缩中最有技巧的部分——不同工具的输出需要不同的摘要策略，这样可以让模型更好的理解：

\# agent/context\_compressor.py — 工具输出智能摘要

def \_summarize\_tool\_result(tool\_name: str, tool\_args: str, tool\_content: str) -> str:

"""为工具调用结果生成信息丰富的单行摘要。

设计思路：不同工具关注不同的信息——

\- terminal: 开发者最关心"执行了什么命令"和"退出码是什么"

\- read\_file: 关心"读了哪个文件的哪一段"

\- write\_file: 关心"写了哪个文件，写了多少行"

\- search\_files: 关心"搜了什么模式，匹配了几条"

这些信息足以让 LLM 在摘要中回忆起"之前做了什么"，

而不需要保留工具的完整输出（动辄几千字）。

"""

try:

args = json.loads(tool\_args) if tool\_args else {}

except (json.JSONDecodeError, TypeError):

args = {}

content = tool\_content or ""

content\_len = len(content)

line\_count = content.count("\\n") + 1 if content.strip() else 0

\# terminal: 提取命令和退出码

if tool\_name == "terminal":

cmd = args.get("command", "")

if len(cmd) > 80:

cmd = cmd\[:77\] + "..." # 长命令截断

\# 从输出中正则提取 exit\_code

exit\_match = re.search(r'"exit\_code"\\s\*:\\s\*(-?\\d+)', content)

exit\_code = exit\_match.group(1) if exit\_match else "?"

return f"\[terminal\] ran \`{cmd}\` -> exit {exit\_code}, {line\_count} lines output"

\# 示例: \[terminal\] ran \`pytest tests/\` -> exit 1, 42 lines output

\# read\_file: 提取路径和偏移量

if tool\_name == "read\_file":

#### LLM 驱动的结构化摘要

Step 3 是压缩的核心——调用 LLM 将修剪后的消息"浓缩"为一段结构化摘要：

\# agent/context\_compressor.py — LLM 摘要生成

def \_generate\_llm\_summary(self, pruned\_middle, previous\_summary, focus\_topic) -> str:

"""使用 LLM 生成高质量结构化摘要。

为什么不用简单的文本拼接?

因为 LLM 能理解语义，可以区分"重要的决策"和"可丢弃的试错过程"，

生成的摘要信息密度远高于机械截断。

双重保险: LLM 失败时回退到基于规则的简单摘要（\_build\_structured\_summary）。

"""

\# 准备 summarizer 的 system 指令

system\_instruction = (

"You are a summarization agent creating a context checkpoint. "

"Treat the conversation turns below as source material for a "

"compact record of prior work. "

\# 关键: 要求摘要使用用户的语言（如中文对话就输出中文摘要）

"Write the summary in the same language the user was using. "

\# 安全: 绝对不能在摘要中保留密钥

"NEVER include API keys, tokens, passwords — replace with \[REDACTED\]."

)

\# 将待压缩的消息序列化为文本

conversation\_lines = \[\]

total\_chars = 0

max\_total\_chars = 15000 # 约 3750 tokens，给 summarizer 留足够的输出空间

for msg in pruned\_middle:

role = msg.get("role", "unknown")

content = msg.get("content", "")

if isinstance(content, list):

\# 多模态内容: 只提取文本部分

content = "\\n".join(

item.get("text", "") for item in content if isinstance(item, dict)

)

if content:

#### 降级策略：解决压缩失败问题

如果标准压缩后 token 仍然超限（比如单轮工具输出就有 80K token），就需要更激进的降级，提高压缩力度：

\# agent/context\_compressor.py — 三级降级

def compress\_with\_fallback(self, messages, todo\_store=None,...) -> list:

"""带降级的压缩 — 确保无论如何都能把 token 压到阈值以下。

降级策略按"信息损失"从低到高排列:

降级① 损失低: 减少尾部保护条数（从 6 条降到 3 条）

降级② 损失中: 删除最早的 10 条工具结果

降级③ 损失高: 只保留 system prompt + 最近 3 轮（最后手段）

"""

\# 第一次尝试: 标准压缩

result = self.compress(messages)

result\_tokens = sum(\_estimate\_message\_tokens(m) for m in result)

if result\_tokens < self.threshold\_tokens:

return self.\_inject\_todo\_state(result, todo\_store)

\# ---- 降级① ----

\# 思路: 尾部保护从 6 条减到 3 条，让更多消息进入压缩区

\# 代价: LLM 丢失了一些近期上下文，可能会重复之前做过的事

original\_protect\_last = self.protect\_last\_n

self.protect\_last\_n = min(3, self.protect\_last\_n)

result = self.compress(messages)

self.protect\_last\_n = original\_protect\_last # 恢复原值

result\_tokens = sum(\_estimate\_message\_tokens(m) for m in result)

if result\_tokens < self.threshold\_tokens:

return self.\_inject\_todo\_state(result, todo\_store)

\# ---- 降级② ----

\# 思路: 直接删除最早的 10 条工具结果消息

\# 代价: 早期的工具执行记录完全丢失

filtered = \[\]

removed\_count = 0

for msg in result:

if msg.get("role") == "tool" and removed\_count < 10:

removed\_count += 1

continue # 跳过（删除）

#### 防抖机制

一个容易忽视但很重要的细节——如果消息本身就很长（比如单条 system prompt 占了 60% 窗口），那么反复压缩也压不下来。防抖机制避免浪费 LLM 调用：

\# agent/context\_compressor.py — 压缩防抖

def compress(self, messages,...):

before\_tokens = sum(\_estimate\_message\_tokens(m) for m in messages)

\# 防抖检查: 最近几次压缩的平均节省率

if self.\_recent\_savings:

avg\_saving = sum(self.\_recent\_savings) / len(self.\_recent\_savings)

if avg\_saving < COMPRESSION\_DEBOUNCE\_THRESHOLD: # 默认 0.1 (10%)

\# 平均每次压缩只能节省不到 10%，说明已经压无可压

\# 跳过压缩，避免浪费 LLM 调用（生成摘要也要花 token）

return messages

#... 执行压缩...

\# 记录本次压缩的节省比例（用于后续防抖判断）

after\_tokens = sum(\_estimate\_message\_tokens(m) for m in result)

if before\_tokens > 0:

saving\_ratio = (before\_tokens - after\_tokens) / before\_tokens

self.\_recent\_savings.append(saving\_ratio)

if len(self.\_recent\_savings) > 5:

self.\_recent\_savings.pop(0) # 只保留最近 5 次记录

return result

#### 执行计划重新注入，防止被压缩

压缩后有一个关键问题：如果 LLM 正在按照 todo 列表逐步执行任务，压缩会把 todo 工具调用的历史消息压缩掉，导致 LLM "忘记"自己做到哪了。

解决方案：压缩完成后，把未完成的 todo 状态作为新消息注入回去：

\# agent/context\_compressor.py — Todo 状态注入

def \_inject\_todo\_state(self, messages, todo\_store):

"""在压缩完成后注入未完成的 todo 任务状态。

为什么不把 todo 放在 system prompt 里?

因为 system prompt 是固定的，而 todo 是动态变化的。

而且 system prompt 在保护区内不会被压缩，放在里面只会让它越来越大。

所以作为独立的 user 消息注入，插入到尾部保护区之前。

"""

if todo\_store is None:

return messages

injection\_text = todo\_store.format\_for\_injection()

if injection\_text:

\# 示例输出:

\# \[Your active task list was preserved across context compression\]

\# - \[>\] 1. 重写 Harness 理论模块 (in\_progress)

\# - \[ \] 2. 重写 Claw 理论模块 (pending)

todo\_message = {"role": "user", "content": injection\_text}

\# 插入位置: 在尾部保护消息之前

system\_count = sum(1 for m in messages if m.get("role") == "system")

insert\_pos = max(system\_count, len(messages) - self.protect\_last\_n)

messages.insert(insert\_pos, todo\_message)

return messages

---

### 错误分类与重试详细设计

API 错误不能一律"重试 3 次"——限流错误需要的是等待，认证错误重试 100 次也没用，上下文溢出需要压缩而不是重试。这就是错误分类器的价值。

#### 错误细分归类

生产场景需要对每一种错误标记出来，如下代码所示，然后对错误进行归类，判断后续应该如何重试。

<table><colgroup><col width="221"> <col width="568"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>错误归类</p></td><td rowspan="1" colspan="1"><p>描述</p></td></tr><tr><td rowspan="1" colspan="1"><p>可重试成功</p></td><td rowspan="1" colspan="1"><p>例如网络抖动、超时等，这种情况可以直接重试成功。</p></td></tr><tr><td rowspan="1" colspan="1"><p>需要修改信息可重试成功</p></td><td rowspan="1" colspan="1"><p>比如数据超长、服务器过载等等，数据超长可以压缩后重试，服务器过载可以切换模型重试。</p></td></tr><tr><td rowspan="1" colspan="1"><p>永远无法成功</p></td><td rowspan="1" colspan="1"><p>比如认证错误，这种需要用户调整完配置才行，否则永远无法成功。</p></td></tr></tbody></table>

\# agent/error\_classifier.py —

class FailoverReason(enum.Enum):

"""15+ 种错误原因，每种附带不同的恢复策略。"""

auth = "auth" # 临时认证错误 → 换凭证

auth\_permanent = "auth\_permanent" # 永久认证错误 → 终止

billing = "billing" # 账单耗尽 → 终止

rate\_limit = "rate\_limit" # 限流 → 等待后重试

overloaded = "overloaded" # 服务过载 → 切换提供商

server\_error = "server\_error" # 服务器错误 → 重试

timeout = "timeout" # 超时 → 重试

context\_overflow = "context\_overflow" # 上下文溢出 → 压缩

model\_not\_found = "model\_not\_found" # 模型不存在 → 终止

format\_error = "format\_error" # 请求格式错误 → 终止

#... 还有 image\_too\_large, thinking\_signature 等

"""错误匹配方式:

Layer 1: HTTP 状态码 (最可靠)

429 → rate\_limit, 402 → billing, 401/403 → auth,

500/502 → server\_error, 503/529 → overloaded

400 → 进一步检查消息内容（可能是上下文溢出）

Layer 2: 错误消息模式匹配 (状态码不可用时)

"context length" / "too many tokens" → context\_overflow

"rate limit" / "throttled" → rate\_limit

"invalid api key" → auth

包含中文模式: "超过最大长度" → context\_overflow

包含云厂商特定模式: "rate increased too quickly" (阿里云限流)

Layer 3: 异常类型名匹配 (兜底)

ReadTimeout / ConnectError / SSLError → timeout

其他 → unknown (但仍标记为 retryable)

"""

#### 分类后的错误具体使用代码示例

如下代码所示，在发生异常时，会对异常进行归类，并根据不同类别的异常做不同的后续处理：

\# agent/loop.py — \_api\_call\_with\_retry 方法

def \_api\_call\_with\_retry(self, messages, tools, current\_error\_streak):

"""LLM 调用 + 错误处理 — 循环中最关键的方法。"""

try:

\# 根据是否有流式回调，选择 chat\_stream 或 chat

if self.\_stream.has\_callback:

response = self.\_llm.chat\_stream(

messages=messages,

callback=self.\_stream.feed, # 流式 chunk 回调

tools=tools,

)

else:

response = self.\_llm.chat(messages=messages, tools=tools)

return response

except Exception as api\_error:

\# 第一步: 分类错误

classified = classify\_error(api\_error, provider=self.\_llm.platform\_name)

\# 第二步: 根据分类选择恢复策略

if classified.should\_compress:

\# 上下文溢出 → 不是重试，而是压缩后重新发送

compressed = self.\_compressor.compress\_with\_fallback(

messages, todo\_store=self.\_todo\_store

)

messages.clear()

messages.extend(compressed)

yield {"type": "error", "message": "上下文过大，已自动压缩，正在重试..."}

return None # 返回 None 让主循环重试

if classified.retryable:

\# 瞬态/限流错误 → 等待后重试

delay = jittered\_backoff(

current\_error\_streak + 1,

base\_delay=RETRY\_BASE\_DELAY, # 默认 5s

线上部分场景示例：

<table><colgroup><col width="187"> <col width="260"> <col width="183"> <col width="195"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>场景</p></td><td rowspan="1" colspan="1"><p>错误信号</p></td><td rowspan="1" colspan="1"><p>分类结果</p></td><td rowspan="1" colspan="1"><p>恢复动作</p></td></tr><tr><td rowspan="1" colspan="1"><p>OpenAI 限流</p></td><td rowspan="1" colspan="1"><div><code>429 Too Many Requests</code></div></td><td rowspan="1" colspan="1"><div><code>rate_limit</code></div></td><td rowspan="1" colspan="1"><p>等待 + 退避重试</p></td></tr><tr><td rowspan="1" colspan="1"><p>对话太长</p></td><td rowspan="1" colspan="1"><div><code>400 "context length exceeded"</code></div></td><td rowspan="1" colspan="1"><div><code>context_overflow</code></div></td><td rowspan="1" colspan="1"><p>压缩后重试</p></td></tr><tr><td rowspan="1" colspan="1"><p>API Key 过期</p></td><td rowspan="1" colspan="1"><div><code>401 Unauthorized</code></div></td><td rowspan="1" colspan="1"><div><code>auth</code></div></td><td rowspan="1" colspan="1"><p>终止 + 提示用户换 Key</p></td></tr><tr><td rowspan="1" colspan="1"><p>阿里云 DashScope 限流</p></td><td rowspan="1" colspan="1"><div><code>"rate increased too quickly"</code></div></td><td rowspan="1" colspan="1"><div><code>rate_limit</code></div></td><td rowspan="1" colspan="1"><p>等待 + 退避重试</p></td></tr><tr><td rowspan="1" colspan="1"><p>Anthropic 过载</p></td><td rowspan="1" colspan="1"><div><code>529 Overloaded</code></div></td><td rowspan="1" colspan="1"><div><code>overloaded</code></div></td><td rowspan="1" colspan="1"><p>重试 + 可切换提供商</p></td></tr><tr><td rowspan="1" colspan="1"><p>网络断连</p></td><td rowspan="1" colspan="1"><div><code>ConnectionResetError</code></div></td><td rowspan="1" colspan="1"><div><code>timeout</code></div></td><td rowspan="1" colspan="1"><p>退避重试</p></td></tr><tr><td rowspan="1" colspan="1"><p>vLLM 本地推理超限</p></td><td rowspan="1" colspan="1"><div><code>"exceeds the max_model_len"</code></div></td><td rowspan="1" colspan="1"><div><code>context_overflow</code></div></td><td rowspan="1" colspan="1"><p>压缩后重试</p></td></tr><tr><td rowspan="1" colspan="1"><p>模型名拼错</p></td><td rowspan="1" colspan="1"><div><code>404 "model not found"</code></div></td><td rowspan="1" colspan="1"><div><code>model_not_found</code></div></td><td rowspan="1" colspan="1"><p>终止 + 报告</p></td></tr></tbody></table>

## 记忆模块

### 概述

记忆模块主要包含如下三部分设计。

<table><colgroup><col width="249"> <col width="600"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>模块</p></td><td rowspan="1" colspan="1"><p>介绍</p></td></tr><tr><td rowspan="1" colspan="1"><p>记忆预取注入 (每轮对话前)</p></td><td rowspan="1" colspan="1"><p>将相关记忆以 <memory-context> 围栏注入 messages，流式输出时自动过滤围栏标签，防止回传给用户。</p></td></tr><tr><td rowspan="1" colspan="1"><p>跨会话长期记忆 (持久化文件)</p></td><td rowspan="1" colspan="1"><p>分三个模块分别存不同维度长期记忆，并按需取用：</p>●<p>MEMORY.md (2200字符) — 环境事实、项目约定</p>●<p>USER.md (1375字符) — 用户画像、偏好</p>●<p>db（不限字数）— 会话历史</p></td></tr><tr><td rowspan="1" colspan="1"><p>会话内短期记忆 (messages 数组)</p></td><td rowspan="1" colspan="1"><p>用户会话记忆，超过 75% 上下文窗口触发压缩 ，尽可能都知道短期记忆但不能影响用户体验。</p></td></tr></tbody></table>

### 用户画像沉淀

LLM 在对话中识别到值得持久化的信息时，主动调用 `memory` 工具写入。Schema 的 description 中详细说明了何时该保存、保存什么：

\# agent/memory\_manager.py — memory 工具定义

def create\_memory\_tool\_schema() -> Dict:

return {

"type": "function",

"function": {

"name": "memory",

"description": (

"Save durable information to persistent memory that survives "

"across sessions. Memory is injected into future turns, so keep "

"it compact and focused on facts that will still matter later.\\n\\n"

"WHEN TO SAVE (proactively, don't wait to be asked):\\n"

"- User corrects you or says 'remember this'\\n"

"- User shares preferences, habits, personal details\\n"

"- You discover environment facts (OS, tools, project structure)\\n"

"- You learn conventions, API quirks, workflow specifics\\n\\n"

"TWO TARGETS:\\n"

"- 'user': who the user is (name, role, preferences)\\n"

"- 'memory': your notes (environment facts, project conventions)\\n\\n"

"ACTIONS: add, replace (old\_text identifies target), "

"remove (old\_text identifies target).\\n\\n"

"SKIP: trivial info, easily re-discovered facts, raw data dumps."

),

"parameters": {

"type": "object",

"properties": {

"action": {

"type": "string",

"enum": \["add", "replace", "remove"\],

},

"target": {

"type": "string",

"enum": \["memory", "user"\],

},

"content": {

"type": "string",

这里是具体的实现逻辑，画像的具体规则交给模型去总结，总结结束后，对进行安全扫码，安全扫码后保存。

def handle\_tool\_call(self, tool\_name: str, args: Dict) -> str:

"""处理内存工具调用（add/replace/remove）。返回 JSON 字符串。"""

action = args.get("action", "")

target = args.get("target", "memory")

store = self.memory\_store if target == "memory" else self.user\_store

if target not in ("memory", "user"):

return json.dumps({"success": False, "error": f"Invalid target '{target}'. Use 'memory' or 'user'."}, ensure\_ascii=False)

logger.info("\[FileMemoryProvider\] tool\_call: action=%s, target=%s", action, target)

\# 安全扫描

if action in ("add", "replace"):

content = args.get("content", "")

threats = scan\_context\_threats(content)

if threats:

threat\_list = ", ".join(threats)

logger.warning("\[FileMemoryProvider\] 安全拦截: %s", threat\_list)

return json.dumps({"success": False, "error": f"Blocked: content matches threat pattern ({threat\_list})."}, ensure\_ascii=False)

\# 追加画像

if action == "add":

content = args.get("content", "")

if not content:

return json.dumps({"success": False, "error": "Content is required for 'add' action."}, ensure\_ascii=False)

result = store.add(content)

if result.get("success"):

self.\_notify\_memory\_write(action, target, content)

return json.dumps(result, ensure\_ascii=False)

\# 覆盖画像

elif action == "replace":

old\_text = args.get("old\_text", "")

content = args.get("content", "")

if not old\_text:

return json.dumps({"success": False, "error": "old\_text is required for 'replace' action."}, ensure\_ascii=False)

### 记忆围栏：防止记忆被输出

#### 记忆预取注入

每轮对话前自动将相关记忆注入 messages 序列：

\# agent/loop.py — 核心循环中的记忆预取

\# 1. 移除上一轮的围栏消息（避免累积）

messages = \[msg for msg in messages if not msg.get("\_is\_memory\_fence")\]

\# 2. 提取用户最近的查询

user\_query = ""

for msg in reversed(messages):

if msg.get("role") == "user":

user\_query = msg.get("content", "") if isinstance(msg.get("content"), str) else ""

break

\# 3. 预取并注入

if user\_query:

prefetch\_context = self.\_memory.prefetch\_all(user\_query, session\_id=self.\_session\_id)

memory\_block = build\_memory\_context\_block(prefetch\_context)

if memory\_block:

messages.append({

"role": "user",

"content": memory\_block,

"\_is\_memory\_fence": True # 标记为围栏消息，压缩前会被移除

})

#### 围栏构建与清洗

预取的记忆被包装在 `<memory-context>` 围栏中，告诉 LLM 这是记忆上下文而非用户消息：

\# agent/memory\_manager.py — 围栏构建

def build\_memory\_context\_block(raw\_context: str) -> str:

"""将预取的记忆包装在围栏块中。"""

if not raw\_context or not raw\_context.strip():

return ""

clean = sanitize\_context(raw\_context) # 先清洗：剥离可能被嵌套的围栏标签

if not clean:

return ""

return (

"<memory-context>\\n"

"\[System note: The following is recalled memory context, "

"NOT new user input. Treat as authoritative reference data — "

"this is the agent's persistent memory and should inform all responses.\]\\n\\n"

f"{clean}\\n"

"</memory-context>"

)

#### StreamingContextScrubber：防止围栏泄漏

LLM 的流式输出可能包含 `<memory-context>` 标签——如果直接展示给用户，内部记忆就泄漏了。 `StreamingContextScrubber` 是一个有状态的流式文本清理器，能处理跨 delta 边界的标签：

\# agent/memory\_manager.py — 流式清洗器

class StreamingContextScrubber:

"""处理跨 delta 边界的 <memory-context> 标签过滤。

难点：流式传输中，标签可能被拆分在两个 delta 中：

delta1: "...some text <memory"

delta2: "-context>secret data</memory-context> visible text"

"""

\_OPEN\_TAG = "<memory-context>"

\_CLOSE\_TAG = "</memory-context>"

def \_\_init\_\_(self):

self.\_in\_span: bool = False # 是否正在围栏内部

self.\_buf: str = "" # 缓冲区（处理跨 delta 的部分标签）

def feed(self, text: str) -> str:

"""返回 text 清理后的可见部分。"""

self.\_buf += text

output\_parts = \[\]

while self.\_buf:

if self.\_in\_span:

\# 在围栏内部：吞掉所有内容直到找到关闭标签

close\_idx = self.\_buf.find(self.\_CLOSE\_TAG)

if close\_idx == -1:

\# 关闭标签可能还没到，保留尾部缓冲防止截断标签

if len(self.\_buf) > len(self.\_CLOSE\_TAG):

self.\_buf = self.\_buf\[-(len(self.\_CLOSE\_TAG) - 1):\]

break

\# 找到关闭标签：跳过围栏内容

self.\_buf = self.\_buf\[close\_idx + len(self.\_CLOSE\_TAG):\]

self.\_in\_span = False

else:

\# 在围栏外部：正常输出

open\_idx = self.\_buf.find(self.\_OPEN\_TAG)

为什么需要缓冲区：流式传输中每个 delta 可能只有几个字符。标签 `<memory-context>` 有 16 个字符，完全可能被拆分到多个 delta 中。缓冲区确保在收到足够字符之前不会误输出标签的一部分。

## 工具模块

### 通用性抽象设计

整体架构如下所示，所有的能力均是工具，核心分为schema、registry、handler三个模块，分别控制和llm交互、工具的注册、工具的执行。

![[f99d97bc-805d-468b-9a32-822a87c7e48b.jpeg]]

### 工具注册执行流程

def register(

self,

name: str,

schema: Dict\[str, Any\],

handler: Callable,

\*,

check\_fn: Optional\[Callable\[\[\], bool\]\] = None,

is\_async: bool = False,

toolset: str = "",

description: str = "",

) -> None:

"""注册工具到注册表。

Args:

name: 工具名称（唯一标识）

schema: JSON Schema 定义

handler: 执行函数

check\_fn: 可用性检查函数（可选）

is\_async: handler 是否为异步函数

toolset: 所属工具集

description: 工具描述

"""

with self.\_lock:

if name in self.\_tools:

logger.info(f"\[Registry\] 覆盖已有工具: {name}")

self.\_tools\[name\] = ToolEntry(

name=name,

schema=schema,

handler=handler,

check\_fn=check\_fn,

is\_async=is\_async,

toolset=toolset,

description=description,

)

self.\_generation += 1

logger.info(f"\[Registry\] 注册工具: {name} (generation={self.\_generation})")

比如加载skill的方法注册，如下所示，重点关注schema和\_handle\_load\_skill。

\# load\_skill — 始终注册

def \_handle\_load\_skill(\*\*kwargs):

skill\_name = kwargs.get("skill\_name", "")

return self.loader.load\_skill(skill\_name)

registry.register(

name="load\_skill",

schema={

"type": "function",

"function": {

"name": "load\_skill",

"description": (

"Load the full instructions of a skill. Use this when the user's "

"request matches a skill's description from the available skills list."

),

"parameters": {

"type": "object",

"properties": {

"skill\_name": {

"type": "string",

"description": "The name of the skill to load",

}

},

"required": \["skill\_name"\],

},

},

},

handler=\_handle\_load\_skill,

toolset=SKILLS\_TOOLSET,

description="Load full instructions of a skill",

)

回调代码示例：

先从注册器中调用get\_tool拿到工具，然后调用handler方法执行工具

def \_dispatch(self, tool\_name: str, arguments: Dict\[str, Any\]) -> str:

\# 获取工具详情

tool\_entry = registry.get\_tool(tool\_name)

if tool\_entry is None:

\## 修复工具

repaired = self.\_repair\_tool\_name(tool\_name)

if repaired:

logger.info(f"\[ToolDispatcher\] 工具名修复: '{tool\_name}' → '{repaired}'")

tool\_entry = registry.get\_tool(repaired)

tool\_name = repaired

if tool\_entry is None:

available = ", ".join(registry.list\_tools())

return f"工具 '{tool\_name}' 未找到。可用工具: {available}"

try:

\# 执行工具

if tool\_entry.is\_async:

from utils.async\_bridge import run\_async

result = run\_async(tool\_entry.handler(\*\*execution\_args))

else:

result = tool\_entry.handler(\*\*execution\_args)

result\_str = str(result) if result is not None else "工具执行完成（无输出）"

logger.warning(

f"\[ToolDispatcher\] Tool '{tool\_name}' returned: "

f"result\_length={len(result\_str)}, result\_preview='{result\_str\[:300\]}'"

)

return result\_str

except Exception as tool\_err:

error\_msg = (

f"工具 '{tool\_name}' 执行失败: "

f"{type(tool\_err).\_\_name\_\_}: {tool\_err}"

)

logger.error(f"\[ToolDispatcher\] {error\_msg}")

return error\_msg

### mcp工具按需注入

如下代码所示，可以看到，在进行skill加载的时候，会获取skill对应的tools，然后冲mcp工具集合中找到工具并加载到调用大模型的工具列表中。

\# agent/loop.py — load\_skill 触发 MCP 工具注入

if tc\_name == "load\_skill":

skill\_name = raw\_args.get("skill\_name", "")

if skill\_name:

self.\_dispatcher.inject\_skill\_mcp\_tools(skill\_name, tools)

\# agent/tool\_dispatcher.py — 注入逻辑（去重后 append）

def inject\_skill\_mcp\_tools(self, skill\_name: str, tools: List\[Dict\]) -> None:

"""将指定 skill 声明的 MCP 工具 schema 注入到 tools 列表。"""

if not self.\_skill\_service:

return

try:

mcp\_tool\_defs = self.\_skill\_service.get\_mcp\_tool\_definitions\_for\_skill(skill\_name)

if not mcp\_tool\_defs:

return

\# 去重：已经在 tools 列表中的工具不重复注入

existing\_names = {t.get("function", {}).get("name", "") for t in tools}

injected = \[\]

for tool\_def in mcp\_tool\_defs:

tool\_func\_name = tool\_def.get("function", {}).get("name", "")

if tool\_func\_name and tool\_func\_name not in existing\_names:

tools.append(tool\_def)

injected.append(tool\_func\_name)

if injected:

logger.info(f"按需注入 MCP 工具 for skill '{skill\_name}': {injected}")

except Exception as exc:

logger.warning(f"注入 MCP 工具失败 for skill '{skill\_name}': {exc}")

### 异常自动修复

工具参数 JSON 修复

LLM 返回的工具参数经常有格式问题——缺失右括号、surrogate 字符、尾随逗号。 `repair_tool_arguments` 尝试多种策略修复：

\# agent/tool\_dispatcher.py — 参数 JSON 修复

def repair\_tool\_arguments(raw\_arguments: str) -> dict:

"""修复 LLM 返回的工具调用参数 JSON。"""

if not raw\_arguments or not raw\_arguments.strip():

return {}

\# 策略 1: 清理 surrogate 字符（LLM 有时生成无效 Unicode）

cleaned = raw\_arguments.encode("utf-8", errors="replace").decode("utf-8")

try:

return json.loads(cleaned)

except json.JSONDecodeError:

pass

\# 策略 2: 补全缺失的右括号

stripped = cleaned.strip()

open\_braces = stripped.count("{") - stripped.count("}")

open\_brackets = stripped.count("\[") - stripped.count("\]")

if open\_braces > 0:

stripped += "}" \* open\_braces

if open\_brackets > 0:

stripped += "\]" \* open\_brackets

try:

return json.loads(stripped)

except json.JSONDecodeError:

pass

\# 策略 3: 删除尾随逗号

\# {"key": "value",} ← 删掉最后的逗号

last\_comma = stripped.rfind(",")

if last\_comma > 0:

candidate = stripped\[:last\_comma\]

open\_b = candidate.count("{") - candidate.count("}")

if open\_b > 0:

candidate += "}" \* open\_b

try:

MCP 参数自动包装

部分 MCP 工具的 inputSchema 有嵌套包装（如 `{request: {query: ...}}` ），LLM 常常展平为 `{query: ...}` 。系统自动检测并包装：

\# tools/mcp\_service.py — 检测展平参数，自动包装

def \_normalize\_mcp\_arguments(arguments: dict, input\_schema: dict) -> dict:

properties = input\_schema.get("properties", {})

if len(properties)!= 1:

return arguments

wrapper\_key = next(iter(properties))

if properties\[wrapper\_key\].get("type")!= "object":

return arguments

inner\_props = properties\[wrapper\_key\].get("properties", {})

if any(k in inner\_props for k in arguments):

return {wrapper\_key: arguments} # 自动包装

return arguments

工具名模糊修复

LLM 返回的工具名可能拼错（大小写、camelCase/snake\_case 混用、多余后缀）。系统尝试多种变换后做模糊匹配：

\# agent/tool\_dispatcher.py — 多策略工具名修复

def \_repair\_tool\_name(self, tool\_name: str) -> Optional\[str\]:

"""尝试修复 LLM 返回的异常工具名称。"""

valid\_names = registry.list\_tools()

def \_normalize(name): return name.lower().replace("-", "\_").replace(" ", "\_")

def \_camel\_to\_snake(name): return re.sub(r"(?<!^)(?=\[A-Z\])", "\_", name).lower()

def \_strip\_tool\_suffix(name):

lower = name.lower()

for suffix in ("\_tool", "-tool", "tool"):

if lower.endswith(suffix):

return name\[:-len(suffix)\].rstrip("\_-")

return None

\# 策略 1: 直接小写匹配

lowered = tool\_name.lower()

if lowered in valid\_names: return lowered

\# 策略 2: 标准化（替换 - 和空格为 \_）

normalized = \_normalize(tool\_name)

if normalized in valid\_names: return normalized

\# 策略 3: 生成候选集（交叉组合所有变换）

candidates = {tool\_name, lowered, normalized, \_camel\_to\_snake(tool\_name)}

for \_ in range(2): # 两轮扩展

extra = set()

for candidate in candidates:

stripped = \_strip\_tool\_suffix(candidate)

if stripped:

extra.add(stripped)

extra.add(\_normalize(stripped))

extra.add(\_camel\_to\_snake(stripped))

candidates |= extra

for candidate in candidates:

if candidate and candidate in valid\_names:

实际修复案例：

<table><colgroup><col width="250"> <col width="250"> <col width="250"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>LLM 返回</p></td><td rowspan="1" colspan="1"><p>实际工具名</p></td><td rowspan="1" colspan="1"><p>修复策略</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>QueryWeather</code></div></td><td rowspan="1" colspan="1"><div><code>query_weather</code></div></td><td rowspan="1" colspan="1"><p>camelToSnake</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>QUERY_WEATHER</code></div></td><td rowspan="1" colspan="1"><div><code>query_weather</code></div></td><td rowspan="1" colspan="1"><p>小写</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>query_weather_tool</code></div></td><td rowspan="1" colspan="1"><div><code>query_weather</code></div></td><td rowspan="1" colspan="1"><p>strip_tool_suffix</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>qeury_weather</code></div></td><td rowspan="1" colspan="1"><div><code>query_weather</code></div></td><td rowspan="1" colspan="1"><p>difflib 模糊匹配</p></td></tr></tbody></table>

### 进度预览：给用户可读的执行状态

工具执行过程中，ToolDispatcher 会生成可读的进度预览，通过 callback 推送到前端，让用户感知到调用 什么工具：

\# agent/tool\_dispatcher.py — 工具进度预览

def \_build\_tool\_preview(self, tool\_name: str, arguments: Dict) -> str:

if tool\_name == "delegate\_task":

goal = arguments.get("goal", "")\[:40\]

return f"正在委托子代理执行 — {goal}"

if tool\_name == "memory":

action\_desc = {"add": "正在写入", "replace": "正在更新"}.get(

arguments.get("action", ""), "正在操作")

return f"{action\_desc}记忆 {arguments.get('target', '')}"

if tool\_name == "todo":

todos = arguments.get("todos")

return f"正在更新 {len(todos)} 个任务" if todos else "正在读取任务列表"

\# 搜索类工具：展示搜索关键词

search\_tools = {

"searchDocChunk": ("query", "正在搜索文档"),

"web\_search": ("query", "正在搜索网页"),

}

if tool\_name in search\_tools:

key, desc = search\_tools\[tool\_name\]

value = str(arguments.get(key, ""))\[:30\]

return f"{desc} — {value}" if value else desc

\# 通用兜底

return f"正在调用 {tool\_name}"

## SubAgent 设计

> 设计目标：让复杂任务可以被拆解并行执行，同时确保子任务不会失控。

### 流程示意

主 Agent 调用 delegate\_task(goal, context, role)

│

▼

┌─────────────────────────────────────────────────────────────┐

│ delegate\_task │

│ │

│ 1. 深度检查 → 超限则降级为 leaf（禁止递归委托） │

│ 2. 并发检查 → 活跃子 agent ≥ 3 时等待 │

│ 3. 提交到 ThreadPoolExecutor（延迟创建） │

│ 4. 带超时等待 Future 结果 │

│ │

│ ┌───────────────────┐ ┌───────────────────┐ │

│ │ 子 Agent A (leaf) │ │ 子 Agent B (leaf) │ 并行执行 │

│ │ 独立 IdleAgent 实例 │ │ 独立 IdleAgent 实例 │ │

│ │ 独立 messages 历史 │ │ 独立 messages 历史 │ │

│ │ 独立迭代预算 (50) │ │ 独立迭代预算 (50) │ │

│ │ 独立 TodoStore │ │ 独立 TodoStore │ │

│ │ 受限工具权限 │ │ 受限工具权限 │ │

│ └────────┬──────────┘ └────────┬──────────┘ │

│ │ │ │

│ ▼ ▼ │

│ DelegateResult DelegateResult │

│ {goal, success, {goal, success, │

│ final\_answer, final\_answer, │

│ tool\_calls\_count, tool\_calls\_count, │

│ iterations\_used, iterations\_used, │

│ tokens\_used, tokens\_used, │

│ duration\_seconds} duration\_seconds} │

└──────────────────────┬──────────────────────────────────────┘

│

▼

主 Agent 汇总子任务结果，继续处理

### 子agent定义示意

子agent其实也是一个工具，只是这个工具背后会调用agent去执行具体的任务。

\# agent/delegate.py — 工具定义

def create\_delegate\_tool\_schema() -> Dict\[str, Any\]:

return {

"type": "function",

"function": {

"name": "delegate\_task",

"description": (

"将子任务委托给独立的子代理执行。"

"适用于可并行、相互独立的子任务。"

"子代理有独立的迭代预算和工具集。"

),

"parameters": {

"type": "object",

"properties": {

"goal": {

"type": "string",

"description": "子任务的目标描述，需清晰具体",

},

"context": {

"type": "string",

"description": "提供给子代理的上下文信息",

},

"role": {

"type": "string",

"enum": \["leaf", "orchestrator"\],

"description": "leaf 不能再委托，orchestrator 可继续委托",

"default": "leaf",

},

},

"required": \["goal", "context"\],

},

},

}

### 子 Agent 执行流程

如下是子agent的创建和执行流程，从代码可以看到，子agent有独立的提示词，并可以可以继承主agent的工具完成任务。

\# agent/delegate.py — 子 Agent 创建逻辑

def \_run\_child\_agent(self, goal, context, parent\_llm, role,

enabled\_toolsets, disabled\_toolsets,

max\_iterations, current\_depth) -> DelegateResult:

\# 延迟导入避免循环依赖（delegate.py ↔ agent.py 互相引用）

from agent.agent import IdleAgent

\# ── 构建子 agent 的工具集黑名单 ──

\# 合并固有限制 + 父 agent 传递的黑名单

child\_disabled\_toolsets = list(DELEGATE\_BLOCKED\_TOOLSETS)

if disabled\_toolsets:

for ts in disabled\_toolsets:

if ts not in child\_disabled\_toolsets:

child\_disabled\_toolsets.append(ts)

\# ── 构建被禁用的工具名称列表 ──

blocked\_tools = list(DELEGATE\_BLOCKED\_TOOLS) # \["memory", "clarify"\]

if role == "leaf":

blocked\_tools.append("delegate\_task") # leaf 不能再委托

\# ── 构建子 agent 身份提示词 ──

\# 作为 custom\_identity 传入，让 build\_system\_prompt 正常流程运行

\# 这样 skill 索引会由 prompt\_builder 自动注入

child\_identity = (

f"你是一个子代理，负责完成以下特定任务。\\n\\n"

f"{DELEGATE\_EXECUTION\_DISCIPLINE}\\n\\n" # 执行纪律

f"## 任务目标\\n{goal}\\n\\n"

f"## 上下文\\n{context}\\n\\n"

f"{DELEGATE\_WORK\_BOUNDARIES}\\n\\n" # 工作边界

f"{DELEGATE\_RESULT\_FORMAT}\\n\\n" # 结果格式要求

f"## 技术约束\\n"

f"- 角色: {role}\\n"

f"- 最大迭代次数: {max\_iterations}\\n"

f"- 禁止使用的工具: {', '.join(blocked\_tools)}\\n"

f"- 完成任务后立即给出最终回答\\n"

子 Agent 的执行结果不是一个简单字符串，而是包含完整指标的结构化数据：

\# agent/delegate.py — 委托结果

@dataclass

class DelegateResult:

"""子代理委托执行结果。"""

goal: str # 子任务目标

success: bool # 是否成功完成

final\_answer: str = "" # 子 agent 的最终回答

error: Optional\[str\] = None # 失败时的错误信息

tool\_calls\_count: int = 0 # 使用了多少次工具

iterations\_used: int = 0 # 消耗了多少次迭代

tokens\_used: int = 0 # 消耗了多少 token

duration\_seconds: float = 0.0 # 耗时（秒）

为什么要记录这些指标：主 Agent 需要这些信息来判断子任务的质量。如果一个子 Agent 用了 50 次迭代（预算耗尽）但声称成功，主 Agent 应该怀疑结果的完整性。这些指标也会展示在结果摘要中，帮助用户了解执行效率。

### 子agent资源控制

防止子agent无限扩展占用太多资源，主要从如下四个维度控制：

<table><colgroup><col width="187"> <col width="187"> <col width="187"> <col width="343"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>控制维度</p></td><td rowspan="1" colspan="1"><p>默认值</p></td><td rowspan="1" colspan="1"><p>目的</p></td><td rowspan="1" colspan="1"><p>实现方式</p></td></tr><tr><td rowspan="1" colspan="1"><p>并发控制</p></td><td rowspan="1" colspan="1"><p>最多 3 个子 agent</p></td><td rowspan="1" colspan="1"><p>防止 API 并发耗尽</p></td><td rowspan="1" colspan="1"><div><code>ThreadPoolExecutor(max_workers=3)</code> + <code>_active_count</code> 计数器</div></td></tr><tr><td rowspan="1" colspan="1"><p>迭代预算</p></td><td rowspan="1" colspan="1"><p>子 agent 独立 50 次</p></td><td rowspan="1" colspan="1"><p>不消耗主 agent 配额</p></td><td rowspan="1" colspan="1"><div>独立的 <code>IterationBudget</code> 实例</div></td></tr><tr><td rowspan="1" colspan="1"><p>超时保护</p></td><td rowspan="1" colspan="1"><p>600 秒后强制取消</p></td><td rowspan="1" colspan="1"><p>防止子任务挂死</p></td><td rowspan="1" colspan="1"><div><code>future.result(timeout=600)</code> + <code>FuturesTimeoutError</code></div></td></tr><tr><td rowspan="1" colspan="1"><p>深度限制</p></td><td rowspan="1" colspan="1"><p>最多 1 层委托</p></td><td rowspan="1" colspan="1"><p>防止无限嵌套</p></td><td rowspan="1" colspan="1"><div><code>current_depth >= max_depth</code> 时强制 <code>role="leaf"</code></div></td></tr></tbody></table>

### 主子agent权限隔离

子agent仅仅只有主agent运行的工具进行执行，防止并发修改或者篡改主agent的助力。

┌───────────────────────────────────────────────────────────────┐

│ 主 Agent（全部权限） │

│ │

│ 可用: delegate\_task, memory, clarify, load\_skill, MCP 工具, │

│ todo, 所有内置工具... │

│ │

│ ┌─────────────────────────────────────────────────────────┐ │

│ │ 子 Agent - leaf（受限权限） │ │

│ │ │ │

│ │ ✗ delegate\_task — 防止递归委托 │ │

│ │ ✗ memory — 防止修改全局持久状态 │ │

│ │ ✗ clarify — 不能向用户提问（保证并行不阻塞） │ │

│ │ │ │

│ │ ✓ load\_skill — 通过全局 registry 继承 │ │

│ │ ✓ MCP 工具 — 通过 enabled\_toolsets 继承 │ │

│ │ ✓ todo — 独立的 TodoStore 实例 │ │

│ │ ✓ 内置工具 — 搜索、读文件等能力类工具 │ │

│ └─────────────────────────────────────────────────────────┘ │

└───────────────────────────────────────────────────────────────┘

为什么禁止 `memory` ：子 Agent 并行执行，如果允许修改全局记忆，多个子 Agent 可能产生冲突写入。记忆的修改应该由主 Agent 统一决策。

为什么禁止 `clarify` ：子 Agent 在线程池中运行，无法直接与用户交互。如果允许 clarify，子 Agent 会阻塞等待用户回复，而用户看不到这个请求。

## ReAct 模式下的 Plan 能力

> 设计目标：简单任务不增加额外开销，复杂任务自动获得全局规划能力。

> 核心方案：Plan 不是模式切换，而是 ReAct 循环中的一个普通工具（）。

### 设计思路：Plan 即工具

传统做法需要在 ReAct 和 Plan 之间切换模式（两套循环逻辑），本项目的做法是——Plan 就是一个工具调用，和 `query_weather` 没有本质区别：

┌──────────────────────────────────────────────────────────┐

│ 同一个 ReAct 循环 │

│ │

│ 简单任务: Think → Act(query\_weather) → Answer │

│ │

│ 复杂任务: Think → Act(todo: 创建计划) │

│ → Act(step1 工具) → Act(todo: 更新状态) │

│ → Act(step2 工具) → Act(todo: 更新状态) │

│ → Answer │

│ │

│ 计划调整: Think(发现新情况) → Act(todo: 替换整个计划) │

│ → 继续执行新计划... │

└──────────────────────────────────────────────────────────┘

### todo 工具 Schema：行为规范嵌入 description

todo 的行为规范完全写在工具 description 中，不污染 system prompt，又可以按需进行规划：

\# tools/todo\_tool.py — 工具 schema + handler

TODO\_SCHEMA = {

"type": "function",

"function": {

"name": "todo",

"description": (

"Manage your task list for the current session. "

"Use for complex tasks with 3+ steps or when the user "

"provides multiple tasks. "

"Call with no parameters to read the current list.\\n\\n"

"Writing:\\n"

"- Provide 'todos' array to create/update items\\n"

"- merge=false (default): replace the entire list\\n"

"- merge=true: update existing items by id, add new ones\\n\\n"

"Each item: {id, content, status: pending|in\_progress|completed|cancelled}\\n"

"List order is priority. Only ONE item in\_progress at a time.\\n"

"Mark items completed immediately when done."

),

"parameters": {

"type": "object",

"properties": {

"todos": {

"type": "array",

"description": "Task items to write. Omit to read current list.",

"items": {

"type": "object",

"properties": {

"id": {"type": "string"},

"content": {"type": "string"},

"status": {"type": "string",

"enum": \["pending", "in\_progress",

"completed", "cancelled"\]},

},

"required": \["id", "content", "status"\],

},

为什么每次返回完整列表：LLM 没有"记住上次工具调用结果"的可靠能力。如果只返回 diff（"任务 3 已完成"），LLM 很容易忘记其他任务的状态。返回完整列表虽然多用些 tokens，但保证 LLM 在做下一步决策时有全局视角。

### 纯内存保存任务进度

Todo 的存储设计刻意选择了最简单的方案——纯内存 `list[dict]` ，不需要数据库，不需要文件 IO：

\# tools/todo\_tool.py — TodoStore 核心实现

\# 合法的任务状态值

VALID\_STATUSES = {"pending", "in\_progress", "completed", "cancelled"}

class TodoStore:

"""会话级内存任务列表。每个 Agent 实例持有一个独立实例。

任务项有序——列表位置即优先级。每个任务项包含：

\- id: 唯一字符串标识符（由 LLM 选择）

\- content: 任务描述

\- status: pending | in\_progress | completed | cancelled

"""

def \_\_init\_\_(self):

self.\_items: List\[Dict\[str, str\]\] = \[\]

为什么是纯内存而不是持久化：Todo 是会话级的——这次对话的任务计划，下次对话不需要。持久化到数据库只会增加复杂度，而且 todo 的状态已经通过 `format_for_injection()` 在上下文压缩时保留了。

### 两种写入模式：替换 vs 合并

这是 todo 工具最关键的设计——通过 `merge` 参数支持两种写入语义：

\# tools/todo\_tool.py — 写入逻辑

def write(self, todos: List\[Dict\[str, Any\]\], merge: bool = False) -> List\[Dict\[str, str\]\]:

"""写入任务列表。返回写入后的完整列表。"""

if not merge:

\# ═══ 替换模式：用新列表完全替换 ═══

\# 场景：创建新计划、发现新情况需要推翻重来

self.\_items = \[self.\_validate(t) for t in self.\_dedupe\_by\_id(todos)\]

else:

\# ═══ 合并模式：按 id 增量更新已有项，追加新项 ═══

\# 场景：完成一步后更新状态，或发现需要追加新步骤

existing = {item\["id"\]: item for item in self.\_items}

for raw\_todo in self.\_dedupe\_by\_id(todos):

item\_id = str(raw\_todo.get("id", "")).strip()

if not item\_id:

continue

if item\_id in existing:

\# 只更新 LLM 实际提供的字段（不会意外覆盖其他字段）

if "content" in raw\_todo and raw\_todo\["content"\]:

existing\[item\_id\]\["content"\] = str(raw\_todo\["content"\]).strip()

if "status" in raw\_todo and raw\_todo\["status"\]:

status = str(raw\_todo\["status"\]).strip().lower()

if status in VALID\_STATUSES:

existing\[item\_id\]\["status"\] = status

else:

\# 新项——完整验证后追加到末尾

validated = self.\_validate(raw\_todo)

existing\[validated\["id"\]\] = validated

self.\_items.append(validated)

\# 重建列表保持原始顺序

seen: set = set()

rebuilt: List\[Dict\[str, str\]\] = \[\]

for item in self.\_items:

current = existing.get(item\["id"\], item)

if current\["id"\] not in seen:

rebuilt.append(current)

为什么需要 `_dedupe_by_id` ：LLM 有时会在同一个工具调用中发送重复的 id（比如先创建一个任务，然后在同一批次中又更新它的状态）。去重保留最后一个，确保意图得到正确执行。

### store 注入机制

TodoStore 是每个 Agent 实例私有的，通过 ToolDispatcher 在运行时注入：

\# agent/tool\_dispatcher.py — store 注入

def \_dispatch(self, tool\_name: str, arguments: Dict\[str, Any\]) -> str:

#...

if tool\_name == "todo":

\# 将 Agent 实例的私有 TodoStore 注入到 handler 参数中

execution\_args = {\*\*arguments, "store": self.\_todo\_store}

else:

execution\_args = arguments

result = tool\_entry.handler(\*\*execution\_args)

为什么不用全局单例：如果用全局 TodoStore，主 Agent 和子 Agent 会共享任务列表——子 Agent 完成的任务会影响主 Agent 的计划。每个 Agent 实例持有独立的 TodoStore，实现计划隔离。

### 压缩后计划存活机制

上下文压缩后，未完成的 todo 会被自动注入回 messages。这是确保长任务不会因为 context 管理而"失忆"的关键：

\# tools/todo\_tool.py — 确保计划在压缩后不丢失

def format\_for\_injection(self) -> Optional\[str\]:

"""渲染任务列表用于上下文压缩后注入。

仅输出 pending 和 in\_progress 的任务——

已完成和已取消的任务会导致 LLM 在压缩后误以为需要重做。

"""

if not self.\_items:

return None

markers = {

"completed": "\[x\]",

"in\_progress": "\[>\]",

"pending": "\[ \]",

"cancelled": "\[~\]",

}

active\_items = \[

item for item in self.\_items

if item\["status"\] in ("pending", "in\_progress")

\]

if not active\_items:

return None # 全部完成，不需要注入

lines = \["\[Your active task list was preserved across context compression\]"\]

for item in active\_items:

marker = markers.get(item\["status"\], "\[?\]")

lines.append(f"- {marker} {item\['id'\]}. {item\['content'\]} ({item\['status'\]})")

return "\\n".join(lines)

注入时机在 `context_compressor.py` 的 `_inject_todo_state()` 中：

\# agent/context\_compressor.py — 压缩后自动注入 todo 状态

def \_inject\_todo\_state(self, messages: List\[Dict\], todo\_store) -> None:

"""将未完成的 todo 注入压缩后的 messages。"""

if todo\_store is None:

return

injection = todo\_store.format\_for\_injection()

if injection:

messages.append({"role": "user", "content": injection})

### 中断历史任务回复

如果用户的会话被恢复（比如从持久化的消息历史重新加载），TodoStore 需要从历史中恢复状态：

\# agent/tool\_dispatcher.py — 从对话历史恢复 todo 状态

def hydrate\_todo\_store(self, messages: List\[Dict\[str, Any\]\]) -> None:

"""从对话历史恢复 TodoStore 状态。"""

if self.\_todo\_store.has\_items():

return # 已有内容，不覆盖

\# 从最近的消息往前找，找到第一个包含 todos 的工具返回值

for message in reversed(messages):

if message.get("role")!= "tool":

continue

content = message.get("content", "")

if '"todos"' not in content:

continue

try:

data = json.loads(content)

todos = data.get("todos")

if isinstance(todos, list):

self.\_todo\_store.write(todos, merge=False)

return # 找到最近的状态即可

except (json.JSONDecodeError, TypeError, KeyError):

continue

这保证了即使对话被压缩或会话被恢复，LLM 仍然知道"接下来该做什么"——Plan 的状态不会因为上下文管理而丢失。

### 设计优势

采用如下方案有如下优势，对比传统各种agent方案均较优。

<table><colgroup><col width="208"> <col width="250"> <col width="438"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>优势</p></td><td rowspan="1" colspan="1"><p>传统方案</p></td><td rowspan="1" colspan="1"><p>本项目方案</p></td></tr><tr><td rowspan="1" colspan="1"><p>简单任务</p></td><td rowspan="1" colspan="1"><p>也要走 Plan 阶段（浪费）</p></td><td rowspan="1" colspan="1"><p>直接 ReAct 执行，零开销</p></td></tr><tr><td rowspan="1" colspan="1"><p>循环逻辑</p></td><td rowspan="1" colspan="1"><p>需要两套（ReAct loop + Plan loop）</p></td><td rowspan="1" colspan="1"><p>只有一套 ReAct loop</p></td></tr><tr><td rowspan="1" colspan="1"><p>计划调整</p></td><td rowspan="1" colspan="1"><p>需要专门的 re-plan 触发机制</p></td><td rowspan="1" colspan="1"><div><code>todo(merge=False)</code> 随时替换</div></td></tr><tr><td rowspan="1" colspan="1"><p>压缩存活</p></td><td rowspan="1" colspan="1"><p>计划可能被压缩丢失</p></td><td rowspan="1" colspan="1"><div><code>format_for_injection()</code> 自动注入</div></td></tr></tbody></table>

## Skill 设计

> 设计目标：用最少的 context 占用提供最丰富的能力，每个能力自带完整的操作规范。

> 核心方案：SKILL.md 标准 + 四阶段加载 + MCP 工具联动 + 路径安全检查。

### 核心问题：为什么需要 Skill 系统

一个 agent 可能有 50+ 个工具，如果全部注入 LLM 的 tools 列表：

●

context 膨胀：每个工具 schema 约 200-500 tokens，50 个工具就占 10K-25K tokens

●

选择困难：工具越多，LLM 选对的概率越低（实测超过 20 个工具后准确率明显下降）

●

指令冲突：不同场景的操作规范混在一起，LLM 容易串台

Skill 的解决思路是：把工具+指令+资源打包成一个"能力包"，按需加载。LLM 平时只看到"这里有 N 个能力可用"（每个约 100 tokens），选中后才展开完整指令和工具。

### SKILL.md 标准（如何定义一个 Skill）

每个 skill 是一个独立目录，核心是 `SKILL.md` 文件（YAML frontmatter 声明元数据 + Markdown body 定义操作手册）：

skill/ # skill 根目录

└── log-diagnosis/ # 一个 skill = 一个子目录

├── SKILL.md # 必需：YAML frontmatter + Markdown 指令

├── scripts/ # 可选：可执行 Python 脚本

│ └── parse\_trace.py

├── references/ # 可选：参考文档（按需加载）

│ └── error-patterns.md

└── assets/ # 可选：模板、配置等静态资源

\---

name: log-diagnosis

description: >

闲鱼圈子日志诊断助手。当用户需要排查圈子服务的线上错误时使用此 skill。

tools:

\- query\_sls\_logs # 声明需要的全局 MCP 工具

metadata:

max\_rounds: 10 # skill 内 ReAct 最大轮次

mcp\_servers: # skill 专属 MCP 服务器（非共享）

\- name: sls

url: https://mcp-sls.example.com/sse

\---

\# 闲鱼圈子日志诊断助手

\## 工作流程

1\. 收集查询信息（时间范围、关键词、traceId）

2\. 调用 query\_sls\_logs 查询日志

3\. 加载 references/error-patterns.md 匹配历史错误模式

4\. 输出结构化诊断报告

\## 输出格式

\- 错误类型 + 根因分析 + 建议操作

\## 边界处理

\- 无 traceId 时：引导用户提供请求时间范围

\- 日志量过大时：缩小时间窗口后重试

### Skill 解析：从文件到对象

\# skill/skills\_loader.py — Skill 类：SKILL.md 的运行时表示

class Skill:

"""一个已解析的 Skill。"""

def \_\_init\_\_(self, directory: str, metadata: dict, instructions: str):

self.directory = directory

self.name = metadata.get("name", os.path.basename(directory))

self.description = metadata.get("description", "")

self.metadata = metadata

self.instructions = instructions # SKILL.md 的 Markdown body 部分

\# skill 级 MCP 服务器配置

self.mcp\_servers: list\[dict\] = metadata.get("mcp\_servers", \[\])

\# skill 级 ReAct 最大轮次（嵌套在 metadata.metadata 中）

self.max\_rounds: int | None = None

meta\_sub = metadata.get("metadata")

if isinstance(meta\_sub, dict):

raw = meta\_sub.get("max\_rounds")

if raw is not None:

self.max\_rounds = int(raw)

\# SKILL.md 解析：分离 YAML frontmatter 和 Markdown body

@staticmethod

def \_parse\_skill\_md(filepath: str) -> tuple\[dict, str\]:

with open(filepath, "r", encoding="utf-8") as file:

content = file.read()

if not content.startswith("---"):

return {}, content

parts = content.split("---", 2) # 按 "---" 分割为三段

if len(parts) < 3:

return {}, content

frontmatter\_text = parts\[1\].strip() # 中间段是 YAML

instructions = parts\[2\].strip() # 最后段是 Markdown

metadata = yaml.safe\_load(frontmatter\_text) or {}

return metadata, instructions

为什么用 YAML frontmatter 而不是 JSON 配置文件：SKILL.md 是给两个"读者"看的——人看 Markdown body 理解操作规范，机器解析 YAML frontmatter 获取元数据。一个文件解决两个问题，比 `skill.json` + `instructions.md` 两个文件的方案更简洁，也减少了同步维护的负担。

### 四阶段渐进式加载：完整实现

┌──────────────────────────────────────────────────────────────────────┐

│ 渐进式加载四阶段 │

│ │

│ 阶段 1: Advertise (启动时，一次性) │

│ ┌────────────────────────────────────────────────────────────┐ │

│ │ 扫描所有 skill 目录 → 解析 SKILL.md frontmatter │ │

│ │ 注入 system prompt: "- log-diagnosis: 日志诊断助手..." │ │

│ │ 开销: ~100 tokens/skill │ │

│ └───────────────────────────────┬────────────────────────────┘ │

│ │ LLM 判断匹配 → load\_skill() │

│ 阶段 2: Load (按需) ▼ │

│ ┌────────────────────────────────────────────────────────────┐ │

│ │ 返回完整 SKILL.md body (操作手册) │ │

│ │ 触发 MCP 工具注入 (inject\_skill\_mcp\_tools) │ │

│ │ 开销: 500-2000 tokens（仅在需要时） │ │

│ └───────────────────────────────┬────────────────────────────┘ │

│ │ 指令中引用了参考资料 │

│ 阶段 3: Read (按需) ▼ │

│ ┌────────────────────────────────────────────────────────────┐ │

│ │ read\_skill\_resource("references/error-patterns.md") │ │

│ │ 含路径穿越安全检查 (os.path.realpath 比较) │ │

│ └───────────────────────────────┬────────────────────────────┘ │

│ │ 需要执行脚本 │

│ 阶段 4: Run (按需) ▼ │

│ ┌────────────────────────────────────────────────────────────┐ │

│ │ run\_skill\_script("scripts/parse\_trace.py", args=\[...\]) │ │

│ │ subprocess + 30s 超时 + cwd=skill.directory │ │

│ └────────────────────────────────────────────────────────────┘ │

└──────────────────────────────────────────────────────────────────────┘

\# skill/skills\_loader.py — 四阶段完整实现

class SkillsLoader:

def \_\_init\_\_(self, skills\_dirs: list\[str\]):

self.skills\_dirs = skills\_dirs

self.skills: dict\[str, Skill\] = {}

self.\_discover\_skills() # 构造时立即执行阶段 1

\# ═══ 阶段 1: Advertise — 启动时扫描，只提取 name + description ═══

def \_discover\_skills(self):

"""扫描所有 skill 目录，解析 SKILL.md 的 frontmatter。"""

for skills\_dir in self.skills\_dirs:

if not os.path.isdir(skills\_dir):

continue

for entry in sorted(os.listdir(skills\_dir)):

skill\_path = os.path.join(skills\_dir, entry)

skill\_md\_path = os.path.join(skill\_path, "SKILL.md")

if not os.path.isdir(skill\_path) or not os.path.isfile(skill\_md\_path):

continue # 没有 SKILL.md 的目录不是 skill

try:

metadata, instructions = self.\_parse\_skill\_md(skill\_md\_path)

skill = Skill(directory=skill\_path, metadata=metadata,

instructions=instructions)

self.skills\[skill.name\] = skill

except Exception as error:

logging.error(f"\[Skills\] Failed to parse {skill\_md\_path}: {error}")

def get\_advertise\_prompt(self) -> str:

"""生成注入 system prompt 的 skill 摘要（~100 tokens/skill）。"""

lines = \["## Available Skills", "",

"The following skills are available. When a user's request matches "

"a skill's description, use the \`load\_skill\` tool to load its full "

"instructions before proceeding.", ""\]

for skill in self.skills.values():

\# disable-model-invocation 的 skill 只能由用户主动触发

### 工具注册：条件注册策略

Skill 系统的工具注册不是"一股脑全注册"，而是按能力有无条件注册——如果没有任何 skill 包含脚本，就不注册 `run_skill_script` 工具，避免给 LLM 无用选项：

\# skill/skill\_service.py — 条件注册的关键逻辑

class SkillService:

def register\_tools\_to\_registry(self) -> None:

\# load\_skill — 始终注册（只要有 skill 就需要加载能力）

registry.register(name="load\_skill", handler=\_handle\_load\_skill,

toolset=SKILLS\_TOOLSET,...)

\# read\_skill\_resource — 仅当存在含资源文件的 skill 时注册

has\_resources = any(

self.loader.has\_resources(name) for name in self.loader.skills

)

if has\_resources:

registry.register(name="read\_skill\_resource",...)

\# run\_skill\_script — 仅当存在含脚本的 skill 时注册

has\_scripts = any(

self.loader.has\_scripts(name) for name in self.loader.skills

)

if has\_scripts:

registry.register(name="run\_skill\_script",...)

为什么条件注册而不是全部注册：每个注册的工具都会出现在 LLM 的 tools 列表中占用 tokens。如果系统中没有任何 skill 包含脚本， `run_skill_script` 这个工具定义就是纯浪费（约 200 tokens）。条件注册确保 LLM 看到的每个工具都是实际可用的。

### skill工具按需加载

如下代码示例可以看到，会根据skill中的内容，判断是否需要加载以及按需加载执行脚本工具、加载资源工具、mcp工具等：

\# skill/skill\_service.py — 四源工具组装

def get\_all\_tools\_for\_skill(self, skill\_name: str) -> list\[dict\]:

"""构建 skill 的完整工具列表。"""

tools = \[\]

\# ── 来源 1: scoped 原生工具 - run\_script ──

\# 只有当 skill 目录下有 scripts/ 子目录时才提供

if self.loader.has\_scripts(skill\_name):

scripts = self.loader.list\_scripts(skill\_name) # 列出可用脚本

scripts\_desc = ", ".join(scripts) if scripts else "scripts/ 目录下的脚本"

tools.append({

"type": "function",

"function": {

"name": "run\_script", # scoped 命名（不含 skill\_name 参数）

"description": f"执行当前 skill 内置的 Python 脚本。可用脚本：{scripts\_desc}",

\# 把可用脚本列表写入 description，帮助 LLM 选择正确的脚本

"parameters": {...},

},

})

\# ── 来源 2: scoped 原生工具 - read\_resource ──

if self.loader.has\_resources(skill\_name):

resources = self.loader.list\_resources(skill\_name)

resources\_desc = ", ".join(resources) if resources else "references/ 下的文件"

tools.append({

"type": "function",

"function": {

"name": "read\_resource",

"description": f"读取当前 skill 的参考文档。可用资源：{resources\_desc}",

"parameters": {...},

},

})

\# ── 来源 3: 全局 MCP 工具（SKILL.md 的 tools: 字段引用）──

\# 从 SKILL.md 的 tools: \[query\_sls\_logs\] 字段读取工具名

### skill调用工具逻辑

当 skill 执行期间 LLM 发起工具调用时， `dispatch_tool_call` 按优先级路由到正确的后端：

\# skill/skill\_service.py — 统一分发路由

def dispatch\_tool\_call(self, skill\_name: str, tool\_name: str, arguments: dict) -> str:

"""统一分发工具调用到正确的后端。"""

\# 优先级 1: scoped 原生工具 - run\_script

if tool\_name == "run\_script":

return self.loader.run\_skill\_script(

skill\_name, arguments.get("script\_path", ""), arguments.get("args"))

\# 优先级 2: scoped 原生工具 - read\_resource

if tool\_name == "read\_resource":

return self.loader.read\_skill\_resource(

skill\_name, arguments.get("resource\_path", ""))

\# 优先级 3: skill 专属 MCP 工具

\# 检查该工具是否属于当前 skill 的专属 MCP 服务器

if tool\_name in self.\_skill\_tool\_to\_client:

owner\_skill, client = self.\_skill\_tool\_to\_client\[tool\_name\]

if owner\_skill == skill\_name: # 确认工具归属正确

return run\_async(client.call\_tool(tool\_name, arguments))

\# 优先级 4: 全局 MCP 工具（兜底）

return self.mcp\_service.call\_tool(tool\_name, arguments)

为什么 scoped 优先级最高：scoped 原生工具（run\_script、read\_resource）是 skill 自带的，不依赖外部服务，执行最快且最可靠。如果全局 MCP 恰好有同名工具，scoped 版本应该优先，因为它是 skill 作者特意为这个场景定制的。

### 端到端流程：一次 Skill 调用的完整生命周期

用户: "帮我查一下圈子服务昨天的报错日志"

│

▼

LLM 看到 system prompt 中的 skill 摘要:

"- log-diagnosis: 闲鱼圈子日志诊断助手。当用户需要排查..."

│

▼ LLM 判断匹配 → 调用 load\_skill("log-diagnosis")

│

▼ 返回完整 SKILL.md body（工作流程、输出格式、边界处理...）

│ 同时触发 inject\_skill\_mcp\_tools → query\_sls\_logs 注入 LLM tools 列表

│

▼ LLM 按 SKILL.md 中的工作流程执行:

│ 1. 调用 query\_sls\_logs(time\_range="昨天", keyword="ERROR")

│ 2. 调用 read\_resource("references/error-patterns.md")

│ 3. 综合分析 → 输出结构化诊断报告

│

▼

用户看到: "发现 3 类错误: 1) NullPointerException..."

## 最后

Agent 不像传统的 Java 工程——写完、测完、上线，就算交付了。它本质上是一个概率系统嫁接在确定性工程上的产物：今天跑得好好的链路，明天模型升级一个版本，可能 tool calling 的格式变了、推理偏好漂移了，一批业务场景就悄悄退化了。

这意味着两件事：

1.

观测比开发更重要。建立完善的可观测体系（轨迹录制、成功率统计、badcase 自动归因），然后结合真实业务场景持续挖掘退化 case、持续打磨 prompt 和容错逻辑——这不是上线后的"维护"，而是 agent 工程的常态。

2.

保持对前沿方案的敏感度。这个领域半年一个代际，一个好的架构思路（比如渐进式加载、结构化压缩）往往比堆人力调参有效 10 倍。与其闷头优化旧方案，不如花 20% 的时间看看社区在做什么。

END

前言

agent 理论

起：从时间线看各项技术由来

大模型出现：万能百科全书

记忆出现：让对话连续

问题本质

记忆体系分类

短期记忆：上下文窗口管理

长期记忆：跨会话持久化

市场主流记忆方案对比

记忆系统的高级设计

从记忆到用户画像

从记忆到技能生成（Memory → Skill）

完整转化链路

递进式学习转化

具体示例：从纠正到技能的演化过程

技能转化方式：自动or主动

记忆系统核心挑战与解决思路

RAG 出现：解决信息滞后/缺少业务知识

核心原理

环节一：文档分块（Chunking）

环节二：向量化（Embedding）

环节三：向量存储

环节四：检索优化

高级 RAG 模式

RAG 核心问题与解决方案

RAG 评估体系（RAGAS 框架）

小结

Function Call & MCP 出现：从"说"到"做"

演进历程

Function Calling 原理

MCP 深度解析

Function Calling vs MCP：如何选择

生产中的核心挑战

小结

Agent 出现：开始完成完整任务

Agent 的本质

主流循环范式对比

ReAct（Reasoning + Acting）

Plan-then-Execute

Plan-React 混合

LATS（Language Agent Tree Search）

Reflexion（自反思模式）

范式综合对比

生产中的最佳实践

引出下一个问题

Skill 出现：精准执行任务

问题本质

渐进式加载（Progressive Disclosure）

Token 效率对比

Skill = SOP + 工具 + 资源

Multi-Agent 出现：专家协作，并行探索

单 Agent 的三大困境

Multi-Agent 架构模式

模式一：主从委托（Orchestrator-Worker）

模式二：接力传递（Sequential / Pipeline）

模式三：对等讨论（Peer Discussion / Debate）

模式四：层级分治（Hierarchical / Manager-of-Managers）

模式五：竞争选优（Competition / Voting）

模式六：评估反馈（Generator-Critic / Self-Refinement）

模式七：动态路由（Router / Dispatch）

七种模式综合对比

生产中的组合使用

核心收益

关键设计挑战

Harness：让 Agent 稳定运行

什么是 Agent Harness

为什么需要 Harness —— 从裸奔到防护

Harness 的定位

Harness 的核心子系统

子系统 1：错误分类与恢复

子系统 2：上下文工程 (Context Engineering)

子系统 3：迭代控制 (Iteration Control)

子系统 4：工具治理 (Tool Governance)

子系统 5：安全防护 (Security)

子系统 6：可观测性 (Observability)

Harness 设计原则

Harness 的演进趋势

小结

Claw 出现：每个人的私人秘书

止：终点未到，变化依旧

Agent 实践

项目总览

一句话定位

系统架构

核心 Loop 设计

loop流程

保障及触发条件

上下文压缩详细设计

压缩的触发时机

压缩的流程

工具输出修剪的代码实现

LLM 驱动的结构化摘要

降级策略：解决压缩失败问题

防抖机制

执行计划重新注入，防止被压缩

错误分类与重试详细设计

错误细分归类

分类后的错误具体使用代码示例

记忆模块

概述

用户画像沉淀

记忆围栏：防止记忆被输出

记忆预取注入

围栏构建与清洗

StreamingContextScrubber：防止围栏泄漏

工具模块

通用性抽象设计

工具注册执行流程

mcp工具按需注入

异常自动修复

进度预览：给用户可读的执行状态

SubAgent 设计

流程示意

子agent定义示意

子 Agent 执行流程

子agent资源控制

主子agent权限隔离

ReAct 模式下的 Plan 能力

设计思路：Plan 即工具

todo 工具 Schema：行为规范嵌入 description

纯内存保存任务进度

两种写入模式：替换 vs 合并

store 注入机制

压缩后计划存活机制

中断历史任务回复

设计优势

Skill 设计

核心问题：为什么需要 Skill 系统

SKILL.md 标准（如何定义一个 Skill）

Skill 解析：从文件到对象

四阶段渐进式加载：完整实现

工具注册：条件注册策略

skill工具按需加载

skill调用工具逻辑

端到端流程：一次 Skill 调用的完整生命周期

最后

**

**

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
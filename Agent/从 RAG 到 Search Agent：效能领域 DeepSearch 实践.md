---
title: "从 RAG 到 Search Agent：效能领域 DeepSearch 实践"
source: "https://ata.atatech.org/articles/12020521666?spm=ata.23639746.0.0.3808645a7iDZAr"
author:
published:
created: 2026-05-17
description:
tags:
  - "clippings"
---

相关阅读：[知识库赋能 AI 研发，让资料随手可得，生码减少幻觉](https://ata.atatech.org/articles/12020521666)

## 背景

### 什么是 Deep(Re)Search

DeepSearch 是一种迭代式的搜索范式，通过搜索、阅读和推理的循环迭代，逐步优化搜索结果，直至找到最优答案。相比于传统 RAG，其优势在于其深度搜索能力，能够模拟人类的搜索、阅读和推理过程，从而获取更深入、完整的信息。

DeepResearch 是在 DeepSearch 的基础上，增加了一个结构化的框架，用于生成长篇的研究报告。它的工作流程一般从创建目录开始，然后系统性地将 DeepSearch 应用于报告的每一个所需部分：从引言到相关工作、再到方法论，直至最后的结论。报告的每个章节都是通过将特定的研究问题输入到 DeepSearch 中来生成的。最后将所有章节进行整合，以提高报告整体叙述的连贯性。

### DeepSearch 和 DeepResearch 的对比

| 特性 | Deep Search | Deep Research |
| --- | --- | --- |
| 主要功能 | 通过迭代搜索提高信息的准确性和完整性 | 撰写高质量、可读性强的长篇研究报告 |
| 输出形式 | 简洁的答案，附带相关网址作为参考 | 结构化的长篇报告，包含多个章节、图表、表格和参考文献 |
| 处理时间 | 相对较短（秒级到分钟级） | 较长（可能需要数分钟甚至数小时） |
| 适用场景 | 信息收集、初步调研、日常问答 | 深度分析、报告生成 |
| 资源消耗 | 中等 | 大 |
| 关系 | 是 DeepResearch 的基础组件 | 构建于 DeepSearch 之上，核心在于结构化的报告生成 |

## 业界调研

### 信息检索范式的演进

搜索范式的演进主要经历了4个主要阶段：1）传统的 Web 检索；2）作为聊天机器人的 LLM；3）检索增强生成（RAG）；4）深度搜索/研究（Deep(Re)Search）。核心思路及其优劣势总结如下。

| 范式 | 思路 | 优点 | 缺点 |
| --- | --- | --- | --- |
| 传统Web搜索 | 主要包含爬取、索引和排序三个基本流程。爬虫系统性地收集网页内容，随后将这些内容分析整理成便于检索的倒排索引。当用户提交查询时，搜索引擎利用复杂算法评估文档的相关性和重要性。 | 速度快，近实时响应 | 准确性低，很多查询结果跟用户query不相关 |
| LLM chatbot | 大模型通过参数学习聚合海量外部知识，成为在线信息的浓缩表达。通过指令微调、强化学习等手段，优化回答的准确性、相关性和用户偏好匹配度。同时，针对性的提示工程以及对话上下文管理，进一步提升了多轮交互的连贯性和成熟度。 | 直接生成答案，无需用户多次搜索/浏览，人工聚合答案 | 幻觉现象，生成看似合理但不准确的内容；对最新信息缺乏认知，回答时效性不足 |
| RAG | RAG 将大型语言模型的生成能力与检索系统结合，实现动态获取相关外部信息。早期的 RAG 实现主要采用简单的"先检索后阅读"流程，通常从预定义的本地数据库或文档集合中进行单步检索。 | 解决大模型静态知识的局限，以及幻觉问题 | 面对复杂查询（如多跳问题）准确率仍然不足 |
| DeepSearch | DeepSearch 通过多步骤、交互式地紧密结合检索和推理，系统能够逐步提升知识的相关性和深度，同时不断完善查询理解中的推理过程，从而产生更准确且语境丰富的回答。在此过程中，推理会动态影响检索（如基于中间推断优化查询），而检索结果则反过来递归地改善推理，形成动态反馈循环。 | 解决单次检索难以获取全面信息的问题 | 耗时长，复杂任务可能需要分钟级的生成时长 |

### Deep(Re)Search的演进

Deep(Re)search 在业界的演进大致可以分为3个阶段：

**早期探索（2023-2025.2）**：诸如 n8n、QwenLM/Qwen-Agent 等工作流程自动化框架早在 DeepResearch 兴起之前就已经存在。DeepResearch 的概念来源于 AI 助手向 Agent 的转变。2024年12月，Gemini 发布首个 DeepResearch 实现，聚焦基础的多步骤推理和知识整合。该阶段为后续的进步奠定了基础，开启了更为复杂的AI驱动研究工具的发展道路。许多进展都是建立在早期的工作流程自动化工具（如 n8n）以及自动化任务执行代理框架（如 AutoGPT 和 BabyAGI）的基础之上。其他早期贡献还包括开创集成 research 工作流的 cline2024 等。

**技术突破（2025.2-2025.3）**：2025年2月，OpenAI 发布了 Deep Research，基于 o3 模型，实现了自主研究规划、跨领域分析和高质量报告生成等功能，在复杂任务中准确率超越基准。Perplexity 在2025年2月推出免费的 Deep Research。开源项目如 nickscamara/open-deep-research、mshumer/OpenDeepResearcher、btahir_open_deep_research 及 GPT-researcher 等陆续出现。其他还包括适合本地执行的轻量级实现 Automated-AI-Web-Researcher-Ollama，以及可定制化的模块化框架 Langchain-AI/Open_deep_research。

**生态扩展（2025.3-现在）**：开源项目如 Jina-AI/node-DeepResearch 支持本地部署与定制化。OpenAI 和谷歌的闭源商业版本持续突破，具备多模态支持和多智能体协作功能。同时，Manus、AutoGLM-Research、MGX 及 Devin 等平台不断引入 AI research 能力。2025年4月，Anthropic 推出 Claude/Research，引入了智能搜索功能，能够系统性、多角度地探索查询并提供含可验证引文的答案。

### 业界实现

#### 实现范式举例

**Single Agent**

单 Agent 的实现较为简洁，与 ReAct 范式基本一致。核心是一个 LLM 驱动的 while loop，当存在信息缺口时，LLM 进一步决定下一步需要搜索的信息，当检索到的信息足以生成准确、全面的答案时，停止搜索，生成答案。

- [zilliztech/deep-searcher 的实现](https://github.com/zilliztech/deep-searcher)
- [jina-ai/node-DeepResearch 的实现](https://github.com/jina-ai/node-DeepResearch)

**Multi Agent**

多 agent 的实现，比单 agent 稍复杂且更"重"一点。这里以 Anthropic 的实现为例，进行介绍。多 agent 的架构，通常包含一个主 agent，其复责整体搜索流程的调度，可以创建一系列子 agent 对用户提问的不同侧面进行搜索，每一个子 agent 也就是上面的 single agent。子 agent 可以迭代式地搜索主 agent 交给它的检索任务，同时主 agent 也可以迭代式地创建子 agent 持续搜索，直到信息完整，足以回答用户提问。本质上是一个双重while loop。最后还有一个 citation agent 用来生成正确的引用。

- [Anthropic 的实现](https://www.anthropic.com/research/building-effective-agents)

#### 闭源实现集合

| 平台 | 描述 | 发布时间 |
| --- | --- | --- |
| Gemini Deep Research | 谷歌面向深度分析的高级研究助手 | 2024年12月11日 |
| Deep Research [API Guide] | OpenAI 的深度研究平台 | 2025年2月2日 |
| Perplexity Deep Research | Perplexity 的深入研究和分析产品 | 2025年2月14日 |
| Grok Agents | xAI 基于 Grok-3 的自主 DeepSearch 智能体 | 2025年2月19日 |
| Copilot Researcher | Microsoft 365 Copilot 中的研究和分析助手 | 2025年3月25日 |
| Research | Anthropic 的查找和推理信息研究平台 | 2025年4月15日 |
| Manus | manus研究与分析平台 | 2025年3月6日 |
| DeerFlow | 字节跳动的研究与分析解决方案 | 2025年5月9日 |
| Deep Research | 阿里巴巴的 Qwen 驱动研究助手 | 2025年5月14日 |
| Kimi-Researcher | Moonshot 基于 Kimi 的研究助手 | 2025年6月20日 |

#### 开源实现集合

| 仓库 | 描述 | GitHub star数 |
| --- | --- | --- |
| gemini-fullstack-langgraph-quickstart | Gemini 全栈与 LangGraph 集成。 | |
| multi-agent research system | Anthropic 的多智能体研究系统。博客文章 | |
| gpt-researcher | 用于综合研究任务的自主智能体。 | |
| DeerFlow | 字节跳动开源的深度研究框架。 | |
| r1-reasoning-rag | 具备推理能力的检索增强生成框架。 | |
| nanoDeepResearch | 轻量级深度研究工具包。 | |
| deep-research (Aomni) | Aomni 开发的深度研究助手。 | |
| deep-research (u14app) | u14app 的深度研究平台。 | |
| open-deep-research | 开源深度研究框架。 | |
| deep-searcher | 深度搜索与研究工具包。 | |
| node-DeepResearch | 用于寻找正确答案的深度研究工具包。 | |
| Auto-Deep-Research | 自动化深度研究智能体。 | |
| langgraph-deep-research | 使用 LangGraph 实现的深度研究工作流。 | |
| DeepResearchAgent | SkyworkAI 提供的深度研究智能体。 | |
| OpenManus | 用于构建通用 AI 智能体的开源框架。 | |
| AtomSearcher | 自动化深度研究智能体。 | |

## 我们的实践

### 产品入口

- **DeepWiki/仓库问答**
  - [DeepWiki 入口](https://deepwiki.antcode.antgroup-inc.cn/)
  - [Antcode Copilot 入口](https://antcode.alipay.com/copilot)
  - [Skybase 入口](https://skybase.alipay.com/)
- **研发知识库问答**
- **联网搜索**

### 技术能力

#### 从 RAG 到 DeepSearch 的范式转变

在效能领域，知识问答的两个重要应用场景：代码仓库问答、研发知识问答。这两部分能力分别于去年和今年上半年完成建设，但还都属于 RAG 的检索范式。

RAG 存在明显的缺陷：1）单轮检索只能搜索浅层的相关信息，对于复杂的任务（如多跳问题），搜索深度不足；2）单纯的 retrieval，无论是传统的关键字检索还是向量检索，对于多样化的搜索能力支持不足。

基于此，我们转向 DeepSearch 的搜索范式。相对 RAG，我们的 DeepSearch 方案的核心变化主要包括：1）支持多轮迭代式深度搜索；2）支持工具使用，其中传统 RAG 的 retrieval 能力只是工具之一，除此之外，支持了更多通用/专用工具。

#### 技术方案

##### 搜索范式

我们采用简洁的 ReAct 范式，核心是一个由 LLM 驱动的 while loop。每一轮迭代，都由 LLM 借助于其强大的推理能力，判断是否存在信息缺失（information gap），如果存在，则选择（若干）合适的工具进行信息检索，检索完成后，LLM 会基于当前收集到的信息，进一步判断是否仍然存在信息缺失，以及是否进一步调用搜索工具补充信息。在 reason-search 的不断迭代中，信息最终完善，此时 LLM 会基于检索到的信息，生成最终答案。

下图展示了我们从 RAG 范式到 DeepSearch 范式核心搜索流程的转变。

##### 上下文管理

DeepSearch 的上下文膨胀来源于两方面：1）单轮问答中的多检索轮，每次检索都返回较长的内容；2）历史对话中的多轮问答。这两方面因素叠加起来，导致 DeepSearch agent 的上下文长度急剧增长。不仅导致模型响应变慢，更重要的是超长的上下文长度最终会突破 LLM 的上下文窗口极限。

为了解决这个问题，我们当前采取对话历史截断+工具调用结果折叠的策略。

- 只保留最近 m 轮的对话历史；
- 在最近 m 轮对话历史内部，所有的用户提问、工具调用schema、模型回答都会保留。但工具返回的结果不会完整保留，而是有一个字符级 budget B，当工具返回结果总长度超过 B 时，只保留最近 n 个搜索结果，且满足总长度小于 B。其他搜索结果会被折叠，用如下内容代替：

```
tool result is collapsed to reduce the token usage of the chat history, re-invoke the tool in latter turns if this piece of information is needed. \n
```

在我们的实现中，我们取 m=10， B=256k。

#### 垂直场景 DeepSearch Agent

基于以上的技术方案，结合不同场景下的搜索工具集，我们在3个垂直场景落地了 DeepSearch Agent。

**repo wiki/仓库问答**

- 源码检索语义
- 文档语义检索检索：仓库 wiki / 中间件文档等
- 程序分析工具集：如获取类/方法的实现
- bash 命令类：如读文件、查看目录结构

**研发知识库问答**

- 文档语义检索
- 文档阅读
- 知识卡片、工单、研发实体等检索

**联网搜索**

- 网页检索
- 网页阅读

#### SkyBase 研发知识库

DeepSearch 作为上层搜索范式，底层基于 SkyBase 研发 AI 知识库构建的完善的产研数据体系和原子检索能力。

**打通蚂蚁产研数据**

当前已打通代码类（如源码、仓库wiki等）、非代码类（如技术文档、工单等）、研发平台类（如dima需求、产品等实体数据）。

**技术能力**

**索引&检索流程**

Skybase 研发知识库打通了 研发数据采集 - 加工 - 文档切分 - 索引 - 搜索 - RAG 链路。主要流程如下图：

**多模态能力**

**开放能力**

基于以上数据和能力，SkyBase 通过研发知识库小助手提供知识库搜索、问答等开放能力。Skybase 研发知识库小助手可以理解为 AI 知识库的轻量化 Agent，可以通过小助手将多个知识库作为数据源，包装成一个 RAG 服务，对外提供独立页面、内嵌 iframe、API 或 MCP 接口。详情见：[知识小助手 Ant](https://ata.atatech.org/articles/11020521666)

#### Ant DeepWiki

2025年4月27日，Cognition AI（Cognition Labs）发布了 DeepWiki，它是基于其明星产品 Devin 开发的一款旨在通过AI技术为 GitHub 代码仓库生成交互式文档和知识库的工具。自发布以来，DeepWiki 迅速成为开发者社区的热门工具，被誉为"GitHub的维基百科"。

研发效能&程序分析团队也于今年下半年完成了蚂蚁版 DeepWiki 能力的建设，为更准更快的仓库问答提供了重要的信息输入。详情参考：[Ant Deepwiki —— 你的蚂蚁代码仓库，现在会自己写文档了](https://ata.atatech.org/articles/11020521666)

### 效果演示

#### DeepWiki 问答

##### 仓库问答

**case 1**：针对开源仓库 Llama-Factory，我们提问"llama factory 每个 training step 的指标保存在哪"。

分别在 Devin DeepWiki 和 Antcode DeepWiki 上进行提问，结果如下图所示。

- 我们的结果：准确，答案比 Devin DeepWiki 更详细一些
- Devin DeepWiki 的结果：准确

##### 仓库报错排查

- case 1
- case 2

#### 研发知识问答

##### 常规问答

- case 1、应用如何接入spanner？
- case 2、maya部署模型的流程
- case 3、如何通过离线数据表查询dima需求下面关联的缺陷列表？

##### 多模态问答

- case 1、分析图片中的报错原因

##### 联网搜索

- case 1、寻找符合条件的列车车次
- case 2、调研deepsearch和deepresearch的关系

## 未来规划

### DeepSearch agent 能力优化

**上下文工程**：上下文管理是 agent 构建的重要环节。当前上下文管理机制较为简单，后续将探索更优的上下文管理机制。

**Test Time Scaling（TTS）**：DeepSearch 本质上是用更多的模型推理步骤换取更好的检索效果，可以看作是 TTS 的一种，后续将探索更复杂的 TTS 策略，进一步提高 agent 性能。

### 评测能力建设

尽管 DeepSearch 相比于 RAG 的回答效果在体感上已经有了很大提升，但仍缺乏可量化的评价指标对进一步的 agent 优化进行指导，评测数据集和评测体系构建是需要下一步做的事。

## 项目组成员

- Ant Code Copilot: 承谐、乾欢、尤七、云辰、竹年
- DeepWiki/Code Insight: 不恶、发散、合明、嘉珩、谨敕、山苍
- Skybase/DeepSearch: 根鸟、黄莹莹、羚牛、慕冕、耐安、泉百、王月月、崖鹰、瞩恒

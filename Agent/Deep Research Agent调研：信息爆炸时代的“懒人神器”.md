---
title: "Deep Research Agent调研：信息爆炸时代的“懒人神器”"
source: "https://ata.atatech.org/articles/11020441644?spm=ata.23639420.0.0.15527536V0hoNP"
author:
published:
created: 2026-05-18
description:
tags:
  - "clippings"
---
云智能集团





收录于专题



2025-07-30发表2025-08-14更新2.8k浏览






## 引言

是不是感觉每天眼睛一睁，就被各种信息轰炸得头都大了？尤其是老板突然让你明天交一份XX分析报告的时候，心里是不是咯噔一下？

传统的搜索引擎，问它一个问题，哗啦一下丢给你一堆链接，里面混着广告、过时信息、还有各路大神（和水军）的观点，让你自己在信息的海洋里玩“大家来找茬”，真假难辨不说，还累得要死

后来，带联网功能的LLM聊天机器人来了，它们好像聪明了点，能直接给你一段总结好的答案，但用多了你就发现，它更像是一个“高段位的复读机”，经常把几篇文章缝合一下就交差了，深度不太足够，甚至有的时候，还会被有问题的信源带跑偏，开始一本正经地胡说八道

所以，真正的“懒人神器”，Deep Research Agent，逐渐浮出水面，让你做分析时就像点外卖一样简单，你只需说出想吃什么（你的研究问题），就有人帮你买好菜、洗好、切好，甚至直接做成一道大餐（一份结构清晰的报告）端到你面前

本文将带你了解Deep Research的核心技术，业界现状以及未来可能的改进点

## 什么是Deep Research Agent

严谨一些：它是由LLM驱动的AI Agent，集成了动态推理、自适应规划、多轮外部数据检索、工具使用等能力，能够为复杂研究任务生成全面的分析报告 [1]

直观一点：你可以把它想象成一个AI研究员，它不只是个搜索框，而是会像真人专家一样，自己去规划、去查找、去思考，最后直接给你一份逻辑清晰、内容详实的深度报告

![[c74c7141-53ae-4053-b12e-569cd1b0ccae.png]]

## 庖丁解牛 -- Deep Reserach的核心技术拆解

### 1）信息获取：Agent的“眼睛”与“耳朵”

![[ebb10661-69d7-4568-b8a2-d93996985c85.png]]

任何研究的起点是搜集足够的信息，仅凭借LLM自身的世界知识，难以让最终的报告全面且完善，如何让Agent能够从外部世界获取信息成为了关键点，当前主流的信息获取方式主要有两种：

#### 基于API的检索

通过调用搜索引擎API（如Google, Bing）或专业数据库API（如arXiv, PubMed）来获取结构化信息

- `Gemini Deep Research`: 调用Google Search API和arXiv API，一次性可检索成百上千个网页或论文

- `Grok DeepSearch`: 持续通过新闻源API和Wikipedia API更新其知识索引，保证信息的时效性

- `AI Scientist`: 调用Semantic Scholar API来验证研究想法的新颖性和论文引用关系

- `Search-o1`: Bing Search API用于搜索，Jina Reader API用于对长文本进行摘要

缺点：

需要用户交互/通过JS动态加载的内容无法获取，受限于API提供的功能和数据范围

#### 基于浏览器的探索

在沙箱中操作浏览器，模拟点击、滚动、填写表单、执行JS等操作，实时提取网页内容。

- 以下为开源项目Browser-Use [7] 的Demo视频，视频中执行的任务为：Read my CV & find ML jobs, save them to a file, and then start applying for them in new tabs, if you need help, ask me.

<video src="https://oss-ata.alibaba.com/articleVideo/2025/07/a8cef022-2038-468f-a683-6692debca72a.mp4" controls=""></video>

缺点：

资源消耗高、网页布局变化导致定位元素的代码出错，容易被反爬虫机制检测

### 2）工具调用：Agent的“万能百宝箱”

#### 代码解释器（数据分析）

在沙箱环境中执行Python代码，通常用于数据处理、算法验证、模型模拟等计算任务

- 通过代码解释器对数据进行分析：自动计算均值、方差、中位数等；生成交互式可视化：创建图表、热力图等，帮助理解数据；提取数据并进行量化评估：从文本或表格中提取关键指标并进行比较。

- `CoSearchAgent` ：集成SQL查询能力，对数据库进行聚合分析并生成报告

- `AutoGLM` ：能从网页的表格中直接提取结构化数据并进行分析

#### 多模态内容的处理

让模型读取图像、音频和视频，并在输出中也加入多模内容

- 输入：用于分析图表中的数据趋势、识别视频中的关键帧、从地图图片中提取位置信息

- 输出：创建数据可视化图表、生成流程图、3D轨迹图（如Grok DeepSearch）

- 只有少数成熟的商业或开源项目支持，Manus, OWL, OpenAI Deep Resesarch, Gemini Deep Research, Grok DeepSearch 等都具备此能力。

#### 操作计算机 (Computer Use)

像人一样操作整个计算机，包括文件系统、桌面应用和复杂的Web应用

`AutoGLM Rumination`: 像人一样自主浏览网页，还能与需要用户登录认证的平台（如知网、小红书、微信公众号）进行交互

### 3）架构与工作流：Agent的“大脑与神经中枢”

Agent架构与工作流的设计，决定了它在复杂解决问题时，是遵循固定的静态流程，还是自主规划、动态调整。当前主流的Deep Research Agent架构可以分为两种：

#### 静态工作流

任务被分解为固定的几个阶段，由不同的模块或智能体按顺序执行，例如：

`AI Scientist` ：严格遵循“构思 -> 实验 -> 报告”的科学发现流程。

`Agent Laboratory` ：遵循“文献回顾 -> 实验 -> 综合”的固定阶段。

![[aa03cf54-6954-471e-bc65-e70845910a67.png]]

#### 动态工作流

不依赖固定的流程，而是基于初始任务和持续的反馈，自主地、动态地规划、执行、反思和调整其研究步骤。动态工作流主要有两种实现范式，单智能体模式与多智能体模式：

单智能体模式：有一个统一的、强大的推理模型作为决策核心，独自完成规划、工具调用、执行和反思的完整闭环

例如 `Agent-R1`, `ReSearch`, `Search-R1` ：它们都遵循ReAct框架，通过“推理-行动-反思”的迭代循环来完成任务

![[19ea07b4-94d5-4646-a6ac-0b15d2cebace.png]]

模型发展路径：对于单智能体架构，模型本身也在不断进化，从普通的文本大模型，到支持思考的大模型，目前发展到使用专门训练的大模型，例如：GPT 4 --> o3 / DeepSeek R1 --> o3-deep-research

OpenAI Deep Research 和 Gemini Deep Research 也被归类为单智能体架构（这是之前的论调，Deep Research技术是在不断发展的，现在这两句也不一定是单智能体结构）

- 优点： 易于进行端到端优化（如RL）。

- 缺点： 对单个模型的能力要求极高。

多智能体模式

通常有一个“协调者/规划者” Agent，负责将任务分解，并动态地分配给多个Expert Agent（如搜索专家、代码专家、数据分析专家等）来执行

![[17807311-a6de-409b-be62-ffa3a17a0efe.png]]

`OpenManus` 和 `Manus` ：采用分层的“规划者-工具调用者”架构

`OWL` ：采用“workforce-oriented model”，一个承担中央管理功能的Agent，协调多个执行智能体

- 优点：分工明确，降低了对单个模型的要求；可扩展性强，可以方便地增加新的Agent；适合处理复杂的、可并行的任务

- 缺点：Agent之间的协调和通信开销大，系统复杂性高；难以进行有效的端到端优化（因为奖励信号需要分配给多个独立的智能体）

### 4）能力调优：Agent的“进化之路”

为了使Deep Research Agent的能力不断提升，可以采用多种调优策略，以下是四种常用的方法：

#### 提示词工程

最直接、成本最低的方法

1）CoT（Chain-of-Thought），ReAct（Reason + Act），这是最直接且使用最广泛的方法

2）局限：性能天花板受限于LLM本身，Prompt Engineering是个体力活，需要反复尝试

#### 有监督微调 SFT

在高质量、任务相关的数据集上进行微调，来系统性地优化LLM在研究任务中的特定能力。

提升查询质量：

1）训练模型更好地过滤无关信息，如 `Open-RAG`

2）构建“基于推理的指令数据集”，让模型学会自主规划检索查询，并进行多轮交互，如 `AUTO-RAG`

3）通过微调教让模型学会自主规划检索查询，并进行多轮交互，如 `DeepRAG`

#### 强化学习

让Agent在与环境的真实交互中通过“试错”来学习，根据获得的奖励信号直接优化其行为策略

1） `DeepRetrieval` ：优化查询生成，使用RL技术实现对搜索查询质量的优化

2） `ReSearch` 和 `R1-Searcher` ：优化检索与推理，将RL扩展到对检索到的信息进行自适应推理

3） `Agent-R1` ：端到端优化，将RL应用于端到端的Agent训练，整合了API、搜索引擎和数据库等多种工具，实现了自主多步任务执行

- 奖励模型（Reward Model）： 大多数开源实现采用规则驱动的奖励（如答案是否正确）

- 策略优化算法（Policy Optimization）：PPO，GRPO

#### 非参数持续学习（Non-parametric Continual Learning）

不更新模型权重，而是通过优化其外部知识库、工作流或工具配置，来提升表现

1）基于相似案例进行推理:

当Agent遇到新问题时，从一个案例库中检索过去成功的、结构化的问题解决路径，并进行调整和复用（类似于RAG的做法，只不过检索的内容从原先的相关文档chunk，变成了检索相似的案例）

`Agent K` ：通过一个基于奖励的记忆策略，动态地从外部案例库中检索和重用经验

`AgentRxiv` ：作者模拟了一个类似arXiv的在线预印本服务器，Agent可以将自己的研究报告上传分享，也可以检索其他智能体的研究成果作为参考，这个共享平台本身就构成了一个不断增长的、高质量的“案例库”

2）动态更新外部工具：

`Alita`: Agent根据任务需求，在运行时动态配置和启用新MCP服务，实现外部工具集的动态扩展

### 5）记忆管理：Agent的“记忆宫殿”

当前的Deep Research，单次运行通常会数十万甚至上百万Token，记忆管理的核心作用是让Agent能够持久地获取多轮迭代中的上下文信息，从而减少冗余查询，提升研究效率和结果的连贯性。

#### 扩展上下文窗口长度

最直接、最暴力的方法，具体效果取决于模型的长上下文能力

1） `Google Gemini系列` ：支持百万级Token的上下文窗口

- 优点：简单直观，理论上效果好。

- 缺点：计算成本极高，在实际部署中可能导致资源利用效率低下

#### 压缩中间步骤

不直接处理所有原始信息，而是对中间的推理步骤或文档进行压缩、总结，从而减少输入给模型的token数量

1） `The AI Scientist`, `CycleResearcher` ：在不同工作流阶段之间传递“摘要”信息

2） `Reason-in-Documents` ：利用轻量级的模型压缩文档，减少token量

例如在互联网搜索步骤中，先使用轻量级的模型，对网页内容进行总结和提炼关键点，再提供给LLM做后续的分析和整合

- 优点：显著提升处理效率和输出质量

- 缺点：有信息丢失的风险，可能会牺牲细节，从而影响后续推理的精确度

#### 利用外部结构化存储

将历史信息和中间结果存储在模型上下文窗口之外的外部系统中，需要时再进行检索

1） `简单文件系统` ：使用外部文件存储中间结果和历史数据，例如 `Manus`, `OWL`, `Open Manus`

2） `向量数据库` ：将历史对话信息与搜索到的内容存储在向量数据库中，通过相似度检索提取相关内容作为当前轮次的上下文，例如 `WebThinker`, `AutoAgent`

3） `知识图谱` ：捕捉推理过程，实现更精准的信息复用。

4） `案例库` ： `Agentrxiv` 存储和检索其他代理的研究成果（类似于arXiv）

- 优点：极大地扩展了记忆容量，提升了检索速度和语义相关性，结构化方法在检索效率和准确性上更优

- 缺点：需要精心设计数据结构，开发和维护成本更高

## 抛砖引玉 -- Deep Research核心应用场景一览

这一部分是我用LLM从综述 [2] 中提取总结的，大家看一下就好，仅做抛砖引玉（AI味太浓了，不好意思让大家花太多时间看），具体应用还是需要看深入看业务场景的实际需求


| 应用领域   | 核心应用场景                                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 学术研究   | • 文献综述： 自动分析海量文献，进行系统性综述，发现研究模式与空白点。• 假设生成： 依据现有理论生成新的研究假设，并进行初步评估。• 跨学科创新： 打通不同学科间的知识壁垒，促进研究方法融合与创新。                              |
| 科学发现   | • 数据模式识别： 分析大规模科学数据，识别异常模式与潜在规律。• 实验设计优化： 辅助优化实验方案，结合仿真工具加速理论验证。• 科学信息整合： 整合论文中的文本、图表和数据，形成更全面的理解。• 自主科学探索： 探索从提出假设到修正理论的自动化研究全流程。 |
| 商业智能   | • 市场与竞争分析： 分析市场情报与竞品动态，洞察行业趋势与商业机会。• 战略决策支持： 为投资、风控等重大决策提供数据洞察与分析支持。• 业务流程优化： 分析行业最佳实践，为企业优化内部流程提供建议。                              |
| 金融分析   | • 投资研究与尽调： 整合多维度信息，对金融资产进行全面评估与尽职调查。• 趋势分析与风控： 识别多层次的金融市场趋势，进行深度风险评估与建模。                                                           |
| 教育应用   | • 个性化学习： 为学生动态生成个性化的学习路径、内容和定制化问答。• 教学内容开发： 辅助教师高效开发课程，创建图文并茂的教学材料。• 科研能力训练： 通过引导与反馈，训练学生和初学者的科研方法与思维。                             |
| 个人知识管理 | • 信息组织： 帮助个人构建知识库，自动整理信息、发现关联并生成摘要。• 学习与发展： 支持探索式学习，为个人技能提升提供规划与资源建议。• 个人决策辅助： 为职业规划、财务管理等复杂个人决策提供多维度分析。                           |


## 群雄逐鹿 -- 巨头、初创与开源社区争相发力Deep Research

### 闭源项目：

#### OpenAI Deep Research

介绍页面： [https://openai.com/index/introducing-deep-research/](https://openai.com/index/introducing-deep-research/)

OpenAI公布的框架图（其实只公布了研究计划澄清与改写的部分，最核心的研究过程没有额外的信息透露，个人猜测主要是想推销他们的Deep Research专用模型）

![[5f1dfcf6-d7c4-4d39-aea2-3f11be6e0758.png]]

特点：

1\. 交互式意图澄清：先与用户对话，明确研究目标（使用轻量级的模型，如gpt-4.1）

2\. 迭代式工作流：根据过程中的发现不断调整研究计划

Clarifying Questions步骤使用的Prompt（ [原文链接](https://platform.openai.com/docs/guides/deep-research) ）

使用的模型为 `gpt-4.1-2025-04-14`

suggested_clariying_prompt = """"

You will be given a research task by a user. Your job is NOT to complete the task yet, but instead to ask clarifying questions that would help you or another researcher produce a more specific, efficient, and relevant answer.

GUIDELINES:

1\. **Maximize Relevance**

\- Ask questions that are *directly necessary* to scope the research output.

\- Consider what information would change the structure, depth, or direction of the answer.

2\. **Surface Missing but Critical Dimensions**

\- Identify essential attributes that were not specified in the user’s request (e.g., preferences, time frame, budget, audience).

\- Ask about each one *explicitly*, even if it feels obvious or typical.

3\. **Do Not Invent Preferences**

\- If the user did not mention a preference, *do not assume it*. Ask about it clearly and neutrally.

4\. **Use the First Person**

\- Phrase your questions from the perspective of the assistant or researcher talking to the user (e.g., “Could you clarify...” or “Do you have a preference for...”)

5\. **Use a Bulleted List if Multiple Questions**

\- If there are multiple open questions, list them clearly in bullet format for readability.

6\. **Avoid Overasking**

\- Prioritize the 3–6 questions that would most reduce ambiguity or scope creep. You don’t need to ask *everything*, just the most pivotal unknowns.

7\. **Include Examples Where Helpful**

\- If asking about preferences (e.g., travel style, report format), briefly list examples to help the user answer.

8\. **Format for Conversational Use**

\- The output should sound helpful and conversational—not like a form. Aim for a natural tone while still being precise.

"""

Rewriting步骤所使用的Prompt（ [原文链接](https://platform.openai.com/docs/guides/deep-research) ）

使用的模型为 `gpt-4.1-2025-04-14`

suggested_rewriting_prompt = """

You will be given a research task by a user. Your job is to produce a set of instructions for a researcher that will complete the task. Do NOT complete the task yourself, just provide instructions on how to complete it.

GUIDELINES:

1\. **Maximize Specificity and Detail**

\- Include all known user preferences and explicitly list key attributes or dimensions to consider.

\- It is of utmost importance that all details from the user are included in the instructions.

2\. **Fill in Unstated But Necessary Dimensions as Open-Ended**

\- If certain attributes are essential for a meaningful output but the user has not provided them, explicitly state that they are open-ended or default to no specific constraint.

3\. **Avoid Unwarranted Assumptions**

\- If the user has not provided a particular detail, do not invent one.

\- Instead, state the lack of specification and guide the researcher to treat it as flexible or accept all possible options.

4\. **Use the First Person**

\- Phrase the request from the perspective of the user.

5\. **Tables**

\- If you determine that including a table will help illustrate, organize, or enhance the information in the research output, you must explicitly request that the researcher provide them.

Examples:

\- Product Comparison (Consumer): When comparing different smartphone models, request a table listing each model's features, price, and consumer ratings side-by-side.

\- Project Tracking (Work): When outlining project deliverables, create a table showing tasks, deadlines, responsible team members, and status updates.

\- Budget Planning (Consumer): When creating a personal or household budget, request a table detailing income sources, monthly expenses, and savings goals.

Competitor Analysis (Work): When evaluating competitor products, request a table with key metrics, such as market share, pricing, and main differentiators.

6\. **Headers and Formatting**

\- You should include the expected output format in the prompt.

\- If the user is asking for content that would be best returned in a structured format (e.g. a report, plan, etc.), ask the researcher to format as a report with the appropriate headers and formatting that ensures clarity and structure.

7\. **Language**

\- If the user input is in a language other than English, tell the researcher to respond in this language, unless the user query explicitly asks for the response in a different language.

8\. **Sources**

\- If specific sources should be prioritized, specify them in the prompt.

\- For product and travel research, prefer linking directly to official or primary websites (e.g., official brand sites, manufacturer pages, or reputable e-commerce platforms like Amazon for user reviews) rather than aggregator sites or SEO-heavy blogs.

Deep Research Model所使用的Prompt（ [原文链接](https://platform.openai.com/docs/guides/deep-research) ）

使用的模型为 `o3-deep-research`

system_message = """

You are a professional researcher preparing a structured, data-driven report on behalf of a global health economics team. Your task is to analyze the health question the user poses.

Do:

\- Focus on data-rich insights: include specific figures, trends, statistics, and measurable outcomes (e.g., reduction in hospitalization costs, market size, pricing trends, payer adoption).

\- When appropriate, summarize data in a way that could be turned into charts or tables, and call this out in the response (e.g., “this would work well as a bar chart comparing per-patient costs across regions”).

\- Prioritize reliable, up-to-date sources: peer-reviewed research, health organizations (e.g., WHO, CDC), regulatory agencies, or pharmaceutical earnings reports.

\- Include inline citations and return all source metadata.

Be analytical, avoid generalities, and ensure that each section supports data-backed reasoning that could inform healthcare policy or financial modeling.

"""

个人使用体感：

1）OpenAI Deep Research的分析能力和工具调用能力比较强，使用API的话，在Web Search的基础上可以引入Remote MCP Server

2）报告的结构化做的比较好（有表单，有对比），相对来说比较深入，适合想直接获取到可输出版本报告

#### Google Gemini Deep Research

介绍页面： [https://gemini.google/overview/deep-research/](https://gemini.google/overview/deep-research/)

特点：

1\. 交互式生成研究规划：先生成研究计划，提供给用户审查和修改

2\. 异步任务管理：并行处理多个子任务，效率比较高

3\. 超长上下文：支持对百万级长上下文进行总结分析

个人使用体感：

1）Gemini Deep Research的信息搜集能力更强（毕竟是做搜索引擎的，搜索质量确实更好），最终生成的报告，体感上更像是一个综述，会提供更多视角的信息源，适合参考它给出的版本，然自己改写出最终的报告

2）在深度上稍逊于OpenAI，但有时在报告中也可以给出有趣的Insight，例如问它“华为盘古大模型套壳是怎么一回事”，它在报告里指出“这场风波中，阿里的Qwen实际是隐形受益者，间接证明了Qwen是一个不错的底模”

3）和Google全家桶的结合比较好（毕竟有生态优势），可以直接将报告导入Google Docs

#### Qwen Deep Research

体验地址： [https://chat.qwen.ai/?inputFeature=deep_research](https://chat.qwen.ai/?inputFeature=deep_research)

特点：

1\. 交互式的问题澄清和改写：用户输入问题后，会反问用户明确要研究哪个方面

2\. 迭代式工作流：会根据上一轮的搜索结果，决定下一步的方向

个人使用体感：

1）上来会先做问题澄清和改写（类似于OpenAI），最终报告风格上感觉和Gemini比较像，整体效果还可以，但是速度比Gemini慢（可能是因为免费使用的原因）

2）搜索的信息源全部都是英语的，感觉是刻意为之，这是说明中文信息源质量太差了吗

#### Perplexity Deep Research

介绍页面： [https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research](https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research)

特点：

1\. 迭代式的信息检索：多轮搜索并评估信源，确保信息的全面准确

2\. 动态模型选择：根据任务需求自动选择最合适的模型组合

个人使用体感（使用次数的比较少可能感受不准）：最终报告的生成速度很快，通常只需要几分钟，显著快于OpenAI Deep Research，也快于Gemini Deep Research，体感上更像是“开启了联网搜索的LLM”（也可能因为用的是免费版，调用的模型不一样）,欢迎使用过的同学在评论区发表看法

### 开源项目：

开源的Deep Research项目有很多，这边只列举一部分影响力较大的项目

#### assafelovic/gpt-researcher


| 整体框架图 | 备注                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
|       | Github Star数量：22.5k 是一个非常全面的项目，配套有完整的前端、后端和存储，展示效果好，开箱方便 整体思路是Planner + Researcher，由Planner将问题进行拆解，针对每一个子问题，触发对应的爬虫去搜索相应的信息，最终将所有信息整合为一份报告 |


#### google-gemini/gemini-fullstack-langgraph


| 整体框架图 | 备注                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|       | Github Star数量：15.9k 整体项目的代码结构非常简单，容易理解和上手，建议可以先从这个项目开始阅读源码，理解Deep Research的整体流程和LangGraph的用法，大部分的开源项目都使用LangGraph搭建Agent状态转移图 先将用户问题扩写为多个搜索词句，然后逐个进入“搜索-->反思-->生成新问题”的循环，当反思模块认为收集到了足够的信息，整合所有的信息生成报告 其中生成报告时采用的Citation Replace操作是一个常用的技巧（各类LLM联网搜索功能中都有用到），它将原本很长的URL变为 [Source X-N] 的短标记，生成完毕后，再通过后处理将短标记更换回URL，可以有效节约token数量和LLM在总结报告时URL抄写出错的情况， 参考代码 |


#### langchain-ai/open_deep_research


| 整体框架图 | 备注                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- |
|       | Github Star数量：6.5k 整体项目结构也相对简单，新版本的Deep Research在调用工具时采用了大量LangChain和LangGraph的高层次API以及异步API，如果不太了解这些API的实现逻辑，调试起来比其他几个项目麻烦一些 |


#### langchain-ai/local-deep-researcher


| 整体框架 | 备注                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
|      | Github Star数量：7.9k 代码结构简洁，容易理解和上手 整体思路和langchain-ai/open_deep_research中提供的 Legacy版本 比较相似，可以参考不同项目中，类似功能模块的Prompt写法 |


## 关键瓶颈 -- 当前Deep Research Agent的“阿喀琉斯之踵”

- 痛点一：信息来源受限，难以触及高价值的“内部信息”

现有的Deep Research Agent大部分都依赖Web Search去搜索公开可用的网络内容，这使得它们无法触及企业内部的私域知识，结果就是，它做的研究报告，虽然看起来高大上，但跟咱们的实际业务贴不上边，没法直接用

1）内部的知识资产：例如内部文档，SOP操作手册，内部代码库等等难以访问

2）核心的业务数据：ERP中的财务数据、CRM中的客户数据、内部数据库的运营指标等，这些最关键的数据拿不到，给出的分析自然也就不接地气了

3）专业的付费工具：对于金融、法律行业高度依赖特定付费终端（如彭博、万得、路透、LexisNexis），现有的系统难以连接、难以配置

- 痛点二：不透明、难控制的“黑盒”式推理

当前研究Agent的内部工作机制，包括它的推理、决策和执行路径，对用户来说几乎是完全不透明的

1）工具选择的不确定性：用户无法精确控制Agent该调用哪个工具。例如，在数据分析这一步，你希望它用工具A做精确分析，它却可能调用了功能相似但逻辑有偏差的工具B。用户除了反复“猜谜”式地调整工具描述外，几乎没有直接干预的手段，导致结果难以预测

2）任务流程固化，难以产出有领域特色的内容：Agent内部的任务拆解和执行流程（如分析逻辑、摘要风格）往往是提前“写死”的，难以调整。当默认的流程不符合特定的业务需求时，用户无法对其进行微调，只能被动接受不理想的中间结果，最终影响报告的整体质量

3）执行过程的“失控”风险：由于无法观察和干预Agent的推理过程，一旦它因为理解偏差或对复杂问题“想多了”，就可能走错方向，导致整个研究任务“跑偏”。用户很难在早期发现并纠正，只能等待最终的失败结果，造成时间与计算资源的双重浪费

## 破局之道 —— 在Dify on DMS上，构建企业专属版Deep Research Agent

借用一下Dify的核心理念 Do It For Yourself，让我们换个思路：不再是把Deep Research Agent当成一个搞不懂的“黑箱”，而是亲手搭建一个看得懂、管得住、还能自由组合的“白盒”系统

下一篇文章，我们会手把手教大家，怎么 [在 Dify on DMS 上打造一个企业专属版Deep Research Agent](https://ata.atatech.org/articles/11020448429)

## 参考文献

[1] Huang, Yuxuan, et al. "Deep Research Agents: A Systematic Examination And Roadmap." arXiv, 2024, arXiv:2406.18096, [https://arxiv.org/abs/2406.18096](https://arxiv.org/abs/2406.18096).

[2] Xu, Renjun, and Jingwen Peng. "A Comprehensive Survey of Deep Research: Systems, Methodologies, and Applications." arXiv, 2024, arXiv:2406.12594, [https://arxiv.org/abs/2406.12594](https://arxiv.org/abs/2406.12594).

[3] Google Team. Introducing gemini deep research. [https://gemini.google/overview/deep-research/](https://gemini.google/overview/deep-research/)

[4] OpenAI. Introducing deep research. [https://openai.com/index/introducing-deep-research/](https://openai.com/index/introducing-deep-research/)

[5] OpenAI. Introduction to deep research api. [https://cookbook.openai.com/examples/deep_research_api/introduction_to_deep_research_api](https://cookbook.openai.com/examples/deep_research_api/introduction_to_deep_research_api)

[6] xAI Team. Introducing grok deepsearch. [https://x.ai/news/grok-3](https://x.ai/news/grok-3)

[7] Browser-use. [https://github.com/browser-use/browser-use](https://github.com/browser-use/browser-use)

[8] Perplexity Team. Introducing perplexity deep research. [https://www.perplexity.ai/hub/blog/](https://www.perplexity.ai/hub/blog/)

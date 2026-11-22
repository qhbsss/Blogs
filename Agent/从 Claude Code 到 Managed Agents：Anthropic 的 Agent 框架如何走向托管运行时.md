---
title: "从 Claude Code 到 Managed Agents：Anthropic 的 Agent 框架如何走向托管运行时"
source: "https://ata.atatech.org/articles/11020743213?spm=ata.23639420.0.0.155275366KKsA5"
author:
  - "[[徐本胜(琳峰)]]"
published:
created: 2026-10-19
description:
tags:
  - "clippings"
---
> Agent 框架的终点，不是再封装一层模型 API，而是把推理、状态、执行、权限和验证变成一套可以长期运行的系统。

本文基于截至 2026 年 8 月的 Anthropic 官方工程文章与 Claude Platform 文档撰写；Managed Agents 目前仍处于 Beta，具体接口与能力可能继续调整。

![](338f12d6-675e-47d1-bc5b-32549de5b6e3.png)

图 1：Agent 能力从个人开发工具，逐步抽象为可编程 harness，最终成为可规模化运行的托管系统。

过去两年，Agent 框架的讨论大多围绕三个词：规划、工具调用和多智能体。但真正把 Agent 放进生产环境后，最棘手的问题往往不是“模型会不会调用工具”，而是另外一些更像分布式系统的问题：任务运行一个小时后进程崩了怎么办？上下文压缩后丢掉的信息去哪了？工具执行到一半如何恢复？凭据要不要交给 Agent？多个 Agent 如何共享文件，又如何隔离上下文？最后，又由谁判断它真的完成了任务？

Anthropic 的产品演进提供了一条很有代表性的路线：从面向开发者的 Claude Code，到把核心能力开放出来的 Claude Code SDK（后更名为 Claude Agent SDK），再到将运行时整体托管起来的 Claude Managed Agents。这不是三个互相替代的产品，而是 Agent 能力逐层抽象的三个层次：

![](7e8d4ed8-0ab0-496a-b652-e0e94d5617b4.svg)

理解这条演进路径，也就理解了 Anthropic 对 Agent 框架设计的核心判断：模型只是“大脑”，真正决定 Agent 能否工作的，是大脑周围的 harness；真正决定 Agent 能否进入生产的，则是 harness 周围的运行时。

---

## 一、什么是 Agent 框架

最小的工具调用循环并不复杂：把用户消息发给模型；模型如果返回工具请求，应用执行工具，再把结果发回模型；如此循环，直到模型返回最终答案。

```messages
messages = [user_message]

while True:
    response = call_model(messages, tools)
    messages.append(response)

    if response.has_tool_calls:
        results = execute_tools(response.tool_calls)
        messages.extend(results)
    else:
        break
```

这几十行代码可以运行 Demo，却还不能称为一个成熟的 Agent 框架。真实的 Agent harness 至少要回答七个问题：

| 层次 | 必须回答的问题 |
| --- | --- |
| 推理循环 | 什么时候继续，什么时候停止，什么时候转向？ |
| 工具系统 | 工具怎样描述、路由、授权、并发和返回错误？ |
| 上下文 | 哪些历史进入当前 context window，超长后怎么处理？ |
| 状态 | 进程退出、容器故障或任务暂停后，怎样继续？ |
| 执行环境 | Agent 写文件、运行代码和访问网络时，边界在哪里？ |
| 可观测性 | 应用怎样知道 Agent 正在思考、调用工具、等待确认或失败？ |
| 质量控制 | 谁来定义“完成”，又如何验证产物？ |

Anthropic 三层产品的差别，主要不在模型，而在这些责任由谁承担。

---

## 二、第一层：Claude Code，把 Agent loop 做成一个好用的产品

Claude Code 首先是一个面向开发者的成品，而不是通用框架。用户给出目标，它会自行搜索代码库、读取文件、修改代码、运行命令和测试，再把结果交还给开发者。Anthropic 对它的描述是“agentic, not autocomplete”：开发者决定目标和是否提交，执行循环则由 Claude 独立推进。

它最重要的贡献，不是增加了一个 Bash 工具，而是验证了一套通用 Agent loop：

![](53672a6a-1d75-4b69-8085-b9e40390568e.svg)

1\. 文件系统不只是工具，也是 Agent 的外部工作记忆

传统聊天产品主要把状态放在消息历史里；Claude Code 则把仓库和工作目录变成了 Agent 的外部环境。模型不必一次性把整个代码库塞进上下文，而是可以用 `grep`、`glob`、`read` 和 Bash 按需检索。

这是一个关键设计转变：不要让模型记住整个世界，而要让它学会重新读取世界。

文件也可以承载比代码更多的状态：计划、进度、测试结果、失败记录和交接说明。Anthropic 在长时间运行 Agent 的研究中发现，仅靠上下文压缩并不足以让 Agent 连续完成大型任务；更可靠的方式，是让不同阶段通过结构化文件和清晰的增量交付协议交接。

2\. Harness 是对模型弱点的一组假设

Claude Code 的系统提示词、工具说明、权限策略、上下文压缩、计划模式和任务管理，共同构成了 harness。它们都在弥补模型某个阶段的能力缺口。

但这里存在一个容易被忽略的问题：模型会升级，能力缺口也会变化。Anthropic 曾为模型接近上下文上限时过早收尾的问题加入 context reset；当更强模型不再出现同样行为时，这套机制反而可能成为负担。

因此，一个优秀的 Agent 框架不能把今天的最佳策略写死。它需要允许提示词、上下文组织方式、工具策略甚至整个 harness 被替换。

3\. Claude Code 的边界

Claude Code 的优势也决定了它的边界：它默认围绕“一个用户、一台机器、一个工作区、一次交互式任务”设计。

如果要把同样能力嵌入 IDE、CI/CD、客服系统或企业内部产品，开发者会马上遇到新的问题：

- 如何从代码中发起任务，而不是从终端输入？
- 如何替换系统提示词和工具？
- 如何捕获中间事件并接入自己的 UI？
- 如何为不同用户创建隔离的会话？
- 如何把编码 Agent 改造成研究、法务或 SRE Agent？

这就需要第二层抽象。

---

## 三、第二层：Claude Code SDK，把产品里的 harness 变成开发能力

Claude Code SDK 后来更名为 Claude Agent SDK。官方给出的理由很直接：它已经不再只服务于编码任务，而是可以用于研究、金融、客服、SRE 等更广泛的 Agent 场景。

Anthropic 对它的定位是：把驱动 Claude Code 的同一套底层 harness 提供给开发者。Xcode 集成 Claude Agent SDK 时也明确强调，它获得的是 Claude Code 背后的能力，包括子 Agent、后台任务和插件。

1\. SDK 抽出来的不是模型客户端，而是自主循环

普通 Messages API 客户端解决的是：

```如何调用
如何调用 Claude？
```

Agent SDK 解决的是：

```如何让
如何让 Claude 持续工作，直到任务完成？
```

开发者不再手写每一轮 tool-use loop，而是配置：

- 模型与系统提示词；
- 内置工具和自定义工具；
- MCP Server；
- 权限模式；
- hooks、skills 和 subagents；
- 会话与上下文管理。

然后通过 `query()` 或 `ClaudeSDKClient` 驱动一个完整 Agent。

2\. 从“带默认人格的产品”走向“显式配置的框架”

这次更名还伴随着一项很有意义的变化：新版 Agent SDK 默认不再自动继承 Claude Code 的完整系统提示词和本机文件配置。要获得原有行为，需要显式选择 Claude Code preset 或指定 `settingSources`。

这不是简单的 API 调整，而是产品边界的澄清：

> Claude Code 可以替用户选择合理默认值；Agent SDK 必须让应用开发者明确选择行为和配置来源。

否则，在 CI、多租户服务或生产容器里偷偷读取本机 `CLAUDE.md`、用户设置和插件，会造成不可预测的行为甚至跨租户配置泄漏。

3\. SDK 把“应用”交给你，也把“运行时责任”交给你

Agent SDK 让开发者获得了很强的可编程性，但它仍运行在开发者管理的进程和基础设施里。这意味着你还需要负责：

- 部署和扩缩容；
- 进程崩溃后的恢复；
- 会话状态持久化；
- 容器和工作目录生命周期；
- 网络与文件系统隔离；
- API Key 和第三方凭据；
- 长连接、任务队列、重试和监控。

Anthropic 的托管教程把 Agent SDK 的部署成熟度分成单机 Docker、Serverless 和 Kubernetes 等层次，也恰好说明：SDK 解决了 Agent loop，但没有替你消除生产运行时。

于是第三层出现了。

---

## 四、第三层：Managed Agents，把 Agent 从进程升级为托管资源

Managed Agents 不是“云端版 Claude Code”这么简单。官方把它定义为运行在托管基础设施中的、预构建且可配置的 Agent harness，适合长时间、异步和有状态任务。平台提供 Agent loop、工具执行、Sandbox、上下文管理、状态持久化以及流式事件。

它真正完成的抽象，是把一个 Agent 进程拆成四类资源：

| 资源 | 含义 | 变化频率 |
| --- | --- | --- |
| `Agent` | 模型、系统提示词、工具、MCP、Skills、多 Agent 配置 | 相对稳定，可版本化 |
| `Environment` | Session 在哪里执行：Anthropic Cloud 或自托管 Sandbox | 基础设施级 |
| `Session` | 某个 Agent 在某个 Environment 中的一次有状态运行 | 每个任务或用户会话 |
| `Event` | 用户输入、Agent 输出、工具调用、状态和追踪记录 | 持续追加 |

这种拆分的意义是：Agent 定义不再等于一个正在运行的进程，Session 也不再依附某一台容器。

1\. 从一体式容器到 Brain、Hands 和 Session

Managed Agents 最初也走过一体式架构：Session、harness 和 Sandbox 全部放在同一个容器中。

![](6aca557c-f029-48cf-8fc8-6f405fb68871.png)

图 2：推理循环、持久事件记录与执行环境各自独立；任意一层失败，都不必连带丢失整个 Session。

它的优点很直接：文件读写就是本地 syscall，不需要设计远程协议。但问题也同样直接：容器一旦卡死，Session、执行环境和 Agent loop 一起丢失；为了恢复任务，工程师不得不“抢救”这台装有用户数据的容器。

Anthropic 最终把它拆成三部分：

![](750dcb67-11e2-4c80-b629-dec3c47375a0.svg)
- Brain：Claude 与驱动它的 harness，负责选择下一步。
- Hands：Sandbox、Bash、文件工具、MCP 和自定义工具，负责产生现实副作用。
- Session：独立于二者的持久事件日志，记录发生过的一切。

这是一条非常经典的系统设计原则：把计算与状态分开。Brain 可以崩溃并由另一个无状态 harness 接管；Sandbox 可以失败并重新创建；只要 Session 日志仍在，任务就有恢复依据。

Anthropic 把 Sandbox 统一抽象成类似下面的接口：

```provision(resources)execute(name,
provision(resources)
execute(name, input) -> result
```

于是 harness 不必知道“手”究竟是容器、企业 VPC 里的机器、MCP 服务，还是其他执行设备。官方披露，这种按需创建 Sandbox 的方式使 p50 首 Token 延迟降低约 60%，p95 降低超过 90%，因为不需要每个 Session 一开始就等待完整容器启动。

2\. Session 不是 Claude 的 context window

这是理解 Managed Agents 最重要的一句话。

Context window 是模型某一轮真正看到的 Token；Session 则是服务端保存的、可重新读取的事件历史。二者关系更像“数据库”和“查询结果”，而不是同一个东西。

![](da4143d5-9ba1-416f-88f8-3d4fc97a71cd.svg)

当上下文变长时，harness 可以：

- 从某个事件位置继续读取；
- 回退几步重新查看因果链；
- 对旧工具结果做裁剪；
- 把历史压缩成摘要；
- 针对新模型替换整套上下文工程策略。

但原始事件仍然保存在 Session 中。这把“可恢复的事实记录”和“本轮模型需要看到什么”解耦了，也避免把某一种 compaction 策略固化成平台接口。

Managed Agents 的通信因此是事件驱动的。应用发送 `user.*` 事件，并接收 `agent.*`、`session.*` 和 `span.*` 事件；持久事件带有处理状态，SSE 中的增量文本只是预览，最终持久化的 `agent.message` 才是权威记录。

3\. Tools：平台执行、外部执行与标准协议三分法

Managed Agents 的工具不是同一种运行模式。

| 工具类型 | 谁执行 | 典型用途 |
| --- | --- | --- |
| 内置 Agent tools | Managed Agents 的 Sandbox | Bash、Read、Write、Edit、Glob、Grep、Web Search、Web Fetch |
| MCP tools | 平台通过 MCP 代理调用 | Slack、GitHub、数据库和企业服务 |
| Custom tools | 调用方自己的应用 | 订单、审批、内部业务 API |

内置工具由平台在 Session 中自主执行；自定义工具则采用事件交接：Claude 发出 `agent.custom_tool_use`，调用方执行后发送 `user.custom_tool_result`，Agent 再继续工作。

这也解释了“多工具并行到底由谁控制”：

- 模型和平台可以提出或调度多个相互独立的工具调用；
- 内置工具的具体执行由平台运行时负责；
- 自定义工具真正何时启动、并发多少、如何限流和回滚，仍由调用方负责；
- 涉及共享状态和副作用时，不应因为平台支持并行就默认并行。

换句话说，平台负责 Agent 的逻辑并发，业务系统仍要负责副作用的事务边界。

4\. Memory：跨 Session 的记忆不是恢复旧对话

![](f215cefd-6dba-44ba-b735-65df75475c5b.png)

图 3：Memory 负责延续知识，Outcome 负责独立验收，Sandbox、Vault 与权限边界负责限制行动范围。

每个新 Session 默认从新上下文开始。需要跨 Session 保存用户偏好、项目约定或过去错误时，可以挂载 Memory Store。它在 Sandbox 中表现为：

```/mnt/memory/{store-name}
/mnt/memory/{store-name}
```

Agent 使用普通文件工具读写；应用也可以通过 REST API 检查、播种、纠正和导出这些文件。每次修改形成不可变版本，便于审计和回溯。

这里需要区分三种“记忆”：

| 状态 | 保存什么 | 是否跨 Session |
| --- | --- | --- |
| Context window | 当前推理所需的部分信息 | 否 |
| Session event log | 一次运行的完整事件历史 | 属于该 Session |
| Memory Store | 筛选后的长期知识 | 是 |

Memory 不是模型训练，也不是自动 RAG，更不是权威业务数据库。它更像 Agent 与应用共同维护的一本长期笔记。用户余额、订单状态、权限等关键事实仍应从业务数据库读取；Memory 中的内容则应记录来源、更新时间和过期策略，并防止提示注入被写成永久规则。

5\. Outcomes：把“完成”从模型感觉变成独立验收

Agent 很擅长生成“看起来完成”的结果，却不一定真的满足全部要求。Managed Agents 的 Outcomes 为 Session 创建一个独立 Grader：开发者提供任务描述和 rubric；Writer 交付产物后，Grader 在独立上下文里逐项验证；如果失败，反馈回 Writer 修改，直到通过或达到迭代上限。

![](fa9ebc5c-b27a-4ee9-aea1-0607e0289f64.svg)

独立上下文很关键：Grader 看不到 Writer 的推理和借口，只能根据 rubric、产物和验证工具判断。

但 Outcomes 也不是绝对正确性证明。Writer 与 Grader 可能共享模型盲点，rubric 也可能写得含糊。比较稳妥的质量架构应该是：

```确定性检查（测试、schema、计算）
确定性检查（测试、Schema、计算）
              ↓
Outcome Grader（覆盖度、语义、证据）
              ↓
高风险场景人工审批
```

能用代码确定的，不要只让另一个 LLM 判断。

6\. Multiagent：共享执行现场，隔离推理上下文

Managed Agents 支持 Coordinator 调度多个 Agent。不同 Agent 拥有各自的模型、系统提示词、工具和 Session thread，可以并行工作；但它们共享同一个 Sandbox、文件系统和 Vault 凭据。

![](5a52b240-0ad0-49d8-b165-91f3e7af1986.svg)

这里的设计不是“所有东西都隔离”，而是有意选择：

- 上下文隔离，避免每个专家被其他人的推理污染；
- 工作区共享，让多个 Agent 能通过文件交接产物；
- 工具配置隔离，让研究员、定价员和审查员拥有不同能力；
- Vault 共享意味着权限设计必须按最坏情况处理。

适合并行的是独立检索、分文件分析和不同专业视角；会同时修改同一文件、依赖前一步结果或产生不可逆业务副作用的任务，更适合串行或显式构建 DAG。

7\. Vault 与 Sandbox：凭据不应该进入 Agent 能读取的环境

在一体式容器中，Claude 生成的代码与访问令牌处在同一环境。只要一次提示注入诱导 Agent 读取环境变量，凭据就可能泄漏。

Managed Agents 的结构性解决方案，是把凭据放在 Sandbox 外的 Vault 中。MCP 调用通过代理取得 Session 对应的凭据；环境变量型凭据可以在出站请求时用不透明占位符替换，Agent 不需要看到真实值。

这体现了 Anthropic 在 Agent 安全上的基本立场：人类审批和模型安全判断都是概率性的，真正可靠的是环境边界。只要凭据从未进入 Sandbox，无论问题来自用户、模型还是提示注入，它都无法被直接读走。

当然，“看不到密钥”不等于“无法滥用权限”。工具代理仍要约束：

- 以哪个用户身份调用；
- 能访问哪些资源；
- 可以执行哪些动作；
- 是否需要确认；
- 请求能否携带本地文件；
- 写操作是否幂等、可审计和可撤销。

域名白名单也不是充分条件。允许访问一个可信 API，不代表 Agent 无法使用攻击者自己的账户把数据上传到该 API。

---

## 五、三层架构到底如何选择

三者不是简单的“低配、中配、高配”，而是控制权与运行责任的不同组合。

| 维度 | Claude Code | Claude Agent SDK | Managed Agents |
| --- | --- | --- | --- |
| 主要形态 | 开发者产品 | 应用内库 / harness | 托管 Agent 服务 |
| 运行位置 | 用户机器 | 开发者管理的进程和基础设施 | Anthropic Cloud 或自托管 Environment |
| Agent loop | 产品内置 | SDK 内置 | 平台托管，可演进 |
| 状态持久化 | 本地会话与文件 | 开发者负责 | Session/Event 服务端持久化 |
| Sandbox | 本机权限与 OS 隔离 | 开发者负责 | 托管或自托管 Sandbox |
| 工具执行 | Claude Code 运行时 | SDK 进程 | 内置工具、MCP、调用方工具分层 |
| 凭据 | 用户本机环境与连接器 | 开发者负责 | Vault 与工具代理 |
| 适合场景 | 个人和团队编码 | 自定义 Agent、CI、嵌入式集成 | 长任务、异步、多租户、规模化运行 |

可以用一个简单判断来选择：

- 目标是让开发者直接完成代码工作：选 Claude Code。
- 需要把 Claude Code 的 Agent 能力嵌入自己的进程，并愿意掌控部署：选 Claude Agent SDK。
- 需要大量长时间 Session、异步恢复、托管 Sandbox、事件流、Memory、Outcomes 和多 Agent：考虑 Managed Agents。
- 如果只是一次或少量固定步骤的模型调用：Messages API 往往更简单，不必为了“Agent”引入整套运行时。

---

## 六、从 Anthropic 的演进中，可以提炼出七条 Agent 框架设计原则

原则一：稳定接口，允许 harness 随模型演进

模型能力变化很快。不要把某一代模型所需的规划模板、上下文重置和重试策略写成不可替换的基础设施。稳定的应该是 Session、Event、Tool 和 Sandbox 接口，而不是今天的最佳提示词。

原则二：状态独立于计算

Agent loop 和 Sandbox 都应该可以失败、替换和扩缩容。真正需要持久化的是事件、产物和必要的恢复点。一个必须“抢救原容器”才能继续的 Agent，不具备生产可靠性。

原则三：Session 不等于上下文

完整历史应该可恢复；当前上下文应该可裁剪、重排和压缩。把二者混为一谈，要么让 Token 无限增长，要么让压缩后的信息永久丢失。

原则四：把工具视为能力授权，而不只是函数调用

工具定义除了参数 Schema，还必须包含身份、权限、确认策略、网络边界、幂等性和审计。多工具并行也必须服从副作用边界，而不是单纯追求更低延迟。

原则五：长期记忆必须是可审计的外部状态

不要把 Memory 神秘化。它应该可读取、可纠正、可版本化、可删除，并与权威数据库分开。凡是 Agent 能写入的长期记忆，都要假设它可能被错误信息或提示注入污染。

原则六：把质量标准写成可执行的验收合同

“请仔细检查”不是质量系统。把完成标准写成 rubric，把确定性部分交给测试和 Schema，把语义部分交给独立 Grader，把高风险决策留给人。

原则七：先限制爆炸半径，再提高自主程度

Agent 越自主，越不能把安全寄托在用户每次都认真审批。Sandbox、只读挂载、网络出口控制、Vault、最小权限和工具代理，是让高能力 Agent 可部署的前提。

---

## 结语：Agent 框架正在变成一种新的应用运行时

从 Claude Code 到 Claude Agent SDK，再到 Managed Agents，Anthropic 完成了三次抽象：

1. Claude Code 证明了模型可以在真实计算环境中，通过工具循环完成复杂工作；
2. Claude Agent SDK 把这套循环从编码产品中抽出，变成可嵌入任意应用的 harness；
3. Managed Agents 再把 harness 从单个进程中抽出，将 Agent、Environment、Session 和 Event 变成持久、可组合、可运维的云资源。

最终得到的并不是一个更大的 Prompt 框架，而是一套近似“Agent 操作系统”的结构：Session 提供可恢复状态，harness 负责调度思考，Sandbox 提供受限计算，Tools 连接外部世界，Memory 延续长期知识，Outcomes 定义完成标准，Vault 则限制每一双“手”能够触及的范围。

但“近似操作系统”不代表平台替开发者做完了一切。Managed Agents 提供的是原语；真正的产品仍然必须回答三个问题：

> 什么是真相？什么值得记住？Agent 被允许做什么？

这三件事分别对应质量、状态和权限。谁能把它们定义清楚，谁才真正拥有了一个可进入生产环境的 Agent 框架。

---

## 参考资料

- [Scaling Managed Agents: Decoupling the brain from the hands](https://www.anthropic.com/engineering/managed-agents)
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- [Migration from Claude Agent SDK to Managed Agents](https://platform.claude.com/docs/en/managed-agents/migration)
- [Session event stream](https://platform.claude.com/docs/en/managed-agents/events-and-streaming)
- [Managed Agents tools](https://platform.claude.com/docs/en/managed-agents/tools)
- [Multiagent orchestration](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration)
- [Build agents that remember your users](https://platform.claude.com/cookbook/managed-agents-cma-remember-user-preferences)
- [Outcomes: agents that verify their own work](https://platform.claude.com/cookbook/managed-agents-cma-verify-with-outcome-grader)
- [How we contain Claude across products](https://www.anthropic.com/engineering/how-we-contain-claude)
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

中
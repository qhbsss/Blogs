---
title: "调研了一圈 ClaudeCode 的平替，最后留下了 OpenCode 和 omp"
source: "https://ata.atatech.org/articles/11020716008?spm=ata.23639746.0.0.717cf84bF5Likt#OTE3OTMz"
author:
  - "[[张睿(岩敬)]]"
published:
created: 2026-10-17
description:
tags:
  - "clippings"
---
## 一、背景

集团 7 月 10 号之后停用 Claude Code。

过去半年多，Claude Code 已经嵌进了不少同学的日常工作流：写业务代码、跑存量迁移、review PR、排查线上问题。工作流建立在工具之上，工具下线意味着流程要重搭。所以在期限之前，得先把替代方案定下来。

这周花了几天时间把主流的 CLI Coding Agent 撸了一遍：Codex CLI、QwenCode、Qoder CLI、OpenCode、Crush、MiMoCode、Kilo Code、Oh My Pi、Kimi Code。有的只看了文档和 README，有的实际装上跑了几天，有的用相同的内网 gateway 做了连通性测试。

这篇是调研记录。中间涉及的数字（star 数、模型数量等）都是当时的公开信息，可能会有出入；主观结论都会明确标注是"我实测"、"看文档"还是"听其他同学反馈"，方便同学们判断。整理过程借助了 AI 辅助，如有理解或表述不准确的地方，欢迎指正。

## 二、什么算合格的"平替"

对比之前，先明确评估标准。这次找平替，核心诉求有四条：

**1\. 使用习惯尽量贴近 Claude Code**

Claude Code 已经用了大半年，命令行手感、Plan/Build 模式切换、`CLAUDE.md`/`AGENTS.md` 记忆约定、Skills 调用方式、TUI 交互习惯这些已经形成肌肉记忆。如果新工具需要花一周重建工作流，那这周的效率损失可能比停用本身还大。

**2\. Agent 能力尽量接近 Claude Code**

Claude Code 好用不光是因为 Claude 模型强（Opus 在别处也能调），而是因为它把"Agent 工程"这一层做到了产品级。评估平替不能只看"能不能对话生成代码"，这一层所有工具都能做。真正拉开差距的是这些：

| 能力 | 说明 |
| --- | --- |
| Agent Loop | 循环状态机的稳定性、工具调用出错后的恢复机制 |
| Plan / Build 模式 | 只读思考 vs 允许修改的清晰边界 |
| 子 Agent 编排 | 主 Agent 派生子任务的能力 |
| 项目级记忆 | 手动 + 自动维护的项目知识文件 |
| MCP 生态 | 接第三方能力的通用协议 |
| Skills 体系 | 可复用技能包 |
| Hooks 机制 | 生命周期钩子，改造 Agent 行为 |
| 多端形态 | CLI / VS Code / JetBrains / Web / 移动端 |

**3\. 必须能接内网模型网关**

集团内网环境，模型只能通过内部 gateway 走，不能直连 Anthropic/OpenAI 官方 API。这一条是硬约束，卡掉了不少候选。

**4\. 必须是 CLI 形态**

CLI 形态方便嵌进脚本、CI、服务端调用。纯 IDE 插件形态（比如 Cline 早期）不满足。

这四条组合起来就是筛选漏斗： **手感相似 + 能力齐全 + 兼容内网网关 + CLI 形态** 。下面每个工具都会挨着这四条看。

## 三、先说结论

调研之后留在我电脑上的是 **两个：OpenCode 和 omp** 。两个都实测能接内网 gateway、能被 Web Coding Agent 平台通过 ACP 集成，各有明显的优势：

- **OpenCode** （`anomalyco/opencode`）—— **UI 更规整、支持鼠标操作、生态最完整** （Superpowers 等 skill 包第一手支持，issue 搜到的最多）
- **omp / Oh My Pi** （`can1357/oh-my-pi`）—— **工程质量更硬 + 架构上更向 Claude Code 靠拢** ，长任务不掉链子，功能密度高

两个不是"哪个更好"的关系，而是按具体场景选。第七节展开三个维度的对比。

## 四、逐个盘点

### 4.1 Codex CLI

OpenAI 官方出品，安装即用。从公开的 README 和 docs 看，功能对齐 Claude Code 的程度是本次调研里最高的：AGENTS.md 记忆、Sub-agent、Skills、Hooks、Plugin、MCP 都有，OS 级沙箱比 Claude Code 更完整。

但在我们的场景下用不了，原因是 **模型这一层** 。

Codex CLI 默认走 OpenAI 家的模型。理论上可以通过 `model_providers` 指向任意兼容 provider，但官方 [config-reference](https://developers.openai.com/codex/config-file/config-reference) 里 `wire_api` 字段明确写了：\*\*"Protocol used by the provider. `responses` is the only supported value, and it is the default when omitted."\*\*（Responses API 是唯一支持的协议）。

也就是说 Codex CLI 现在 **只跑 OpenAI Responses API** ，不兼容 Chat Completions 协议。网关如果提供的是 OpenAI Chat Completions 兼容协议，大概率接不上。要么走一层路由，要么走 Amazon Bedrock。从其他用过的同学的实测反馈看有两个问题：

- **Codex + 非 OpenAI 模型的组合智力不太行**——Codex 的整套 prompt 和工具描述都是围绕 OpenAI 自家模型深度调优的，换成 Opus 之类经常"迟钝"、指令跟随度下降
- **Codex 执行风格偏激进**——很多改动不问一声直接动手，大规模重构、批量创建文件是常规操作。生产项目里要频繁开权限确认

**结论** ：不想强绑定 OpenAI 模型；加路由做协议转换个人使用没问题，但作为团队方案，中间环节会随上游演进变得不可控。所以它是第一个被淘汰的。

### 4.2 QwenCode

通义的 CLI **技术上是 Google Gemini CLI v0.8.2 的 fork** （ [README Acknowledgments](https://github.com/QwenLM/qwen-code#acknowledgments) 有标出 "This project was originally based on Google Gemini CLI v0.8.2"），Qwen Code v0.1 之后停止同步、独立发展。Apache 2.0 协议，25.9k stars。README 里给出了一张 Qwen Code vs Claude Code 的对比表，从表里能看到已对齐了 Claude Code 的核心能力面，并额外提供了 daemon 模式（多端共享 agent 会话）和多语言 SDK。

**实测：内网 gateway 能接** 。通过自定义 provider 后能正常调用内网模型，接入过程和 OpenCode / omp 差不多顺畅。

不过实测的时候遇到一个交互层的问题： **对话框里粘贴图片时终端会卡死** ，只能关 Tab 重开。作为高频路径上的 bug 影响比较大。

**结论** ：内网 gateway 能跑，是平替 CLI 里综合能力较强的选项。当前版本主要是打磨阶段的交互层小 bug（粘图卡死），主力工作流可以在这些修好后再深度切换。作为 OpenCode / omp 之外的第三候选值得持续关注。

### 4.3 Qoder CLI

Qoder 推出的 CLI（`@qoder-ai/qodercli`），共享账号和 Credits 体系。功能面很完整：MCP、Sub-agent、Skills、Hooks、Plugin、Permissions 都有，产品成熟度是这次调研工具里较高的。

它的模型接入设计是"托管为主 + 有限 BYOK"，参考 [Qoder CLI 模型文档](https://docs.qoder.com/en/cli/model.md) ，分三档：

- **Tiered Models** ：Qoder 托管的分级模型池（Auto / Ultimate / Performance / Efficient / Lite），按 Credit 计费
- **Frontier Models** ：Qoder 直选的一批第三方模型（Qwen、DeepSeek、GLM、Kimi、MiniMax 等）
- **Custom Models（BYOK）** ：允许用户用自己的 API Key，从固定的 provider 白名单里选（Alibaba Cloud Model Studio / DeepSeek / Z.ai / Kimi / MiniMax / Xiaomi MIMO）；BYOK 场景下费用直接结算到 provider 侧，不消耗 Qoder Credits

三档模型的鉴权都走 Qoder Personal Access Token，从这个设计看，模型调用应该都是经过 Qoder 官方后端做统一的流量入口。卡点很具体： **Custom Models 的接入方式是从固定的 provider 白名单里选** （官方文档列出了 6 家：Alibaba Cloud Model Studio、DeepSeek、Z.ai、Kimi、MiniMax、Xiaomi MIMO），没有开放 endpoint / baseURL 字段，也不能接入自建的 OpenAI 兼容 API。所以在任何需要接入自有网关的场景下，这类以托管服务为定位的 CLI 都用不了。

**结论** ：Qoder CLI 本身完成度不错，团队更新活跃。如果你的场景能走公网、能接受它托管模型池（付费）或者白名单里的 provider Key，是完全可用的选择。内网 gateway 场景下用不上，是因为它的产品定位是托管服务，和"接入任意 OpenAI 兼容 endpoint"这条路径设计上就不重合，不是产品做得不好。

### 4.4 OpenCode vs Crush：先把名字搞清楚

搜索 "opencode" 会搜到三个相关的仓库，容易混淆。它们之间不是简单的 fork 关系，而是"同名不同源"，下面讲清楚三者的来龙去脉：

- **[`opencode-ai/opencode`](https://github.com/opencode-ai/opencode) （Go，13.3k stars，已存档）**——最早的 OpenCode 原始项目，作者是 [Kujtim Hoxha](https://github.com/kujtimiihoxha) 。 **仓库现在的 README 顶部有一句官方声明** ："This repository is no longer maintained and has been archived for provenance. The project has continued under the name Crush, developed by the original author and the Charm team."（项目已延续为 Crush，由原作者与 Charm 团队维护）
- **[`charmbracelet/crush`](https://github.com/charmbracelet/crush) （Go，26.3k stars）**——就是上面官方声明里说的 Crush。原作者被 [Charm](https://charm.land/) （做 bubbletea / lipgloss / gum / glow 等知名 TUI 库的团队）招募后，把项目 fork 进 Charm 品牌下重新打包。 **LICENSE.md 底部仍然保留了 `Copyright (c) 2025-03-21 - 2025-05-30 Kujtim Hoxha` 这段 MIT 版权** ，对应的正是 opencode-ai 时期的代码
- **[`anomalyco/opencode`](https://github.com/anomalyco/opencode) （TypeScript，184k stars）**——OpenCode 这个名字被另一群独立开发者接手，用 TS 完全重写，在 anomalyco 这个组织下继续叫 OpenCode。 **这个团队和 Charm 没有关系** ，也不是 Kujtim 的项目

一个补充信息：Crush 借着 fork 的机会，把主体协议从 MIT 换成了 **FSL-1.1-MIT** （Functional Source License），source-available 但\*\*禁止"Competing Use"\*\*（禁止拿去做和 Crush 竞争的商业服务），两年后自动转 MIT。因为不是标准 OSI 意义上的开源，部分 Linux 发行版和 Homebrew 仓库对它的分发有限制。

我们讨论"作为 Claude Code 平替"时，通常指的是 **后两个还在维护的** ：Crush（Go，Charm 团队）和 OpenCode（TS，anomalyco 团队）。两者路线：

| 维度 | Crush | OpenCode（`anomalyco/opencode`） |
| --- | --- | --- |
| 语言 | Go | TypeScript / Bun |
| 许可证 | FSL-1.1-MIT（source-available） | MIT（标准开源） |
| 主打 | 精致 TUI + Charm 生态整合（Hyper 订阅、Catwalk 模型库） | Plugin/Skills/MCP/Custom Tools 组合的可扩展 Agent 框架 |
| 扩展机制 | LSP、MCP、Skills 齐全，Hooks 官方标注为 "preliminary support" | Plugin、Skills、MCP、Hooks、Custom Tools、LSP、Rules、Commands 等一整套 |
| 内网网关兼容 | `openai-compat` / `anthropic-compat` provider 都能自定义 | 支持 OpenAI 兼容 provider，也能配 Anthropic 兼容 |

两者都能接内网网关。 **在 OpenCode 和 Crush 之间** 我优先选 OpenCode（`anomalyco/opencode`），原因是：

1. **官方原生支持 ACP** （Crush 不支持）——这对我们特别关键。团队后续沉淀的 skill / plugin 需要在 Web Coding 平台里也能复用，OpenCode 官方原生 ACP 意味着"CLI 里能跑的 skill，Web 沙箱里也能直接跑"；Crush 没有 ACP 支持，团队沉淀的资产就锁在终端里，Web 平台完全接不进去
2. **插件 + Skills 生态更成熟**——Superpowers、Sequential Thinking 这类社区扩展基本都是先在 OpenCode 生态跑起来
3. **协议更纯粹**——MIT 允许任意商业使用和二次分发，没有 FSL 的"Competing Use"限制，长期用起来更放心

Crush 也在快速迭代（3 天一版），比 OpenCode 界面更精致（Charm 团队一贯的强项），追求终端颜值的可以试。

### 4.5 MiMoCode：值得单独展开

MiMoCode 是小米 MiMo 团队基于 OpenCode 的 fork（README 里注明了"MiMoCode is built as a fork of OpenCode"），保留 OpenCode 核心之上加了几块 Claude Code 都没有的能力。这里按 README 描述罗列：

- **持久化记忆** ：基于 SQLite FTS5 全文搜索，跨 session 维护 `MEMORY.md`（项目知识）、`checkpoint.md`（会话快照）、`notes.md`、`tasks/T1/progress.md`
- **智能上下文管理** ：上下文接近满时自动 checkpoint，恢复时按 token 预算重建上下文
- **Compose 工作流** ：内置 `compose`、`deep-research`、`fact-check` 三个开箱即用的 workflow
- \*\*`/goal`\*\*：用独立裁判模型判断任务是否真的完成
- \*\*`/dream` + `/distill`\*\*：从历史 session 提取知识、从重复操作总结出可复用 skill
- **语音输入 + 十几个内置 Skills** （arxiv、Office 文档、学术写作等）

从架构看，MiMoCode 补齐的正好是 OpenCode 相对 Claude Code 最缺的三块： **持久记忆、工作流编排、自主判定** 。方向是对的。

但实测下来遇到两个坑，暂时回退到了 OpenCode：

**坑一：配置迁移的 schema 差异**

从 OpenCode 复制 provider 配置过来直接报错，大致是这样的信息：

```
Invalid input: expected array, received undefined
provider.<provider>.models.<model-id>.modalities.output
```

OpenCode 允许 `modalities.output` 省略，MiMoCode 的 schema 严格要求显式声明 `["text"]`。文档没提这个差异。

**坑二：Superpowers 装不上**

Superpowers 在 OpenCode 里的官方安装方式是让 Agent 去 fetch 一个 INSTALL.md：

```
Fetch and follow instructions from 
https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md
```

同样的指令在 MiMoCode 里跑，Agent 会提示"当前不是 opencode cli"直接拒绝。翻 Superpowers 官方文档也没列 MiMoCode 的适配路径。

这两件事说明：MiMoCode 虽然是 OpenCode 的 fork，但插件生态并不能无缝互通。 **fork 一个复杂的 CLI Agent 本身就是系统工程——schema 迁移、扩展身份识别、插件契约、命名空间等一整套要考虑的地方很多，任何一处偏离上游都会在生态兼容上暴露出来** 。这也是 fork 类项目的普遍挑战，不是 MiMoCode 独有。

**结论** ：MiMoCode 的方向是对的，Compose 工作流和自动 checkpoint 是我很想要的能力。但项目还在早期，稳定性和生态兼容都需要时间。愿意折腾的可以关注，追求稳定的先用它的上游 OpenCode。

### 4.6 Kilo Code CLI

Kilo Code 是一家做 AI Coding 商业产品的公司，产品线包括 VS Code / JetBrains 插件、CLI（`@kilocode/cli`）、Cloud Agent 等。 **Kilo Code 的 CLI 部分本身是 OpenCode 的 fork** （ [官方 README](https://github.com/Kilo-Org/kilocode) 明确写了 "Kilo CLI is a fork of OpenCode, enhanced to work within the Kilo agentic engineering platform"）。

Kilo 相对上游的一个区别是 **它对 "agent" 概念的扩展** ：除了继承 OpenCode 的 subagent 编排能力（Code / Plan / Debug 这几个 agent 都能通过 `task` 派发 subagent， [官方文档](https://kilo.ai/docs/code-with-ai/agents/using-agents) 确认），Kilo 还额外提供了 5 种预设 mode： **Code** （默认编码）、 **Plan** （架构设计与实现方案，只读+受限编辑）、 **Ask** （只答不改）、 **Debug** （问题追踪）、 **Review** （代码审查）——用户按当前任务在这几种 mode 之间快速切换，每种预设锁定不同的工具权限。所以 Kilo 同时具备"subagent 并行编排" + "任务模式切换" 两套能力，相当于是 OpenCode 上加了一层任务模式的封装

**结论** ：CLI 部分能力和上游 OpenCode 基本一致，Kilo 加的都是它自家商业产品栈的对接（Cloud Agent、Teams 协作等）。我们的场景（内网、单人日常开发）用不到这些商业化增值， **直接用上游 OpenCode 就够，装 Kilo CLI 只是多绕一层** 。

### 4.7 Oh My Pi（omp）

Oh My Pi 是 [Pi](https://github.com/earendil-works/pi) （原 `badlogic/pi-mono`，由 Mario Zechner 创建，项目现在归 earendil-works 组织维护）的 fork，主维护者 `can1357`，MIT 协议。技术路线和其他候选完全不同：核心是约 55,000 行 Rust（拆成 `pi-natives` / `pi-shell` / `pi-ast` / `pi-iso` 四个 crate），把 ripgrep、LSP、tree-sitter、AST-grep 甚至 bash（换成进程内的 `brush`）全部集成进主进程，避免 fork-exec 开销。

功能密度是本次调研里最高的。README 顶部的数据条明确写着： **40+ providers · 32 built-in tools · 14 lsp ops · 28 dap ops · ~55k lines of Rust core** 。README 里也逐个介绍了这些特色能力（每一条都对应 README 的独立小节，可核）：

- **真 DAP 调试器** （第 03 节）——lldb / dlv / debugpy，Agent 能下断点、看变量
- **进程内 LSP** （第 02 节）——14 个操作，符号级代码理解
- **Hindsight 长期记忆** （第 13 节）——retain / recall / reflect 三个工具
- **端到端加密的实时协作** （第 07 节 `/collab`）——原文 "Frames are sealed client-side; the relay never sees your keys"
- **Hashline 编辑** （第 11 节）——内容哈希锚点定位，README 引用 "Grok 4 Fast spends 61% fewer output tokens on the same work"
- **Time-Traveling Stream Rules** （第 04 节）——正则中止流、注入规则、重试
- **自动继承已有配置** （第 15 节）——`.claude` / `.cursor` / `.gemini` / `.codex` 等目录直接读取，迁移成本低

代价也很实：

- 配置项和工具数量多，但 **从 CC / OpenCode 切过来其实挺平滑** （omp 已经把常用的都集成好了），只是少数快捷键和交互习惯不太一样，比如进 Plan 模式在 CC / OpenCode 是 `Shift+Tab`，在 omp 是 `/plan` 命令
- 主要由 `can1357` 主导维护，社区活跃但节奏取决于主维护者
- 没有 VS Code / JetBrains 插件，但通过 [ACP 协议](https://github.com/zed-industries/agent-client-protocol) 原生集成到 Zed 编辑器
- 中文社区几乎没有

**实测：内网 gateway 完全跑通。** Homebrew 装完（`brew install can1357/tap/omp`），在 `~/.omp/agent/models.yml` 里声明一个 `type: openai-completions` 的自定义 provider 指向内网 gateway，非交互模式 `omp -p` 首次请求就正确返回。omp monorepo 里自己维护的 provider 层（`@oh-my-pi/pi-ai`，fork 自上游 pi 生态后独立演进）对不严格符合 OpenAI SSE 契约的响应比较宽容——这也是它跑通内网 gateway 的关键（后面提到的 Kimi Code 就吃了这个亏）。

**实测后的两个意外收获** （对比 OpenCode）：

1. **MCP OAuth 没有 OpenCode 那种端口冲突问题**——第九节坑四里 OpenCode 的 `19876` 端口冲突 + CSRF 报错在 omp 上完全没出现，装同一个 MCP 一次通过、无需绕路。
2. **工程素质明显更好**——长内容生成不会像 OpenCode 那样 silently fail（第九节坑一），长任务能完整执行到结束，不会中途卡死或者丢内容。这个差异应该来自 Rust 核心 + pi-ai 成熟 provider 层的组合。

**结论** ：原本以为 omp 只是"功能超配的备胎"，实测下来发现 **工程质量反而比 OpenCode 更硬** ，长任务和 MCP 集成场景可能是更好的选择。从 CC / OpenCode 迁过来切换成本远比想象中低，值得试。

### 4.8 Kimi Code

Kimi Code（ [`MoonshotAI/kimi-code`](https://github.com/MoonshotAI/kimi-code) ）是月之暗面 Moonshot 官方开源的终端 AI 编码 Agent，MIT 协议，3k+ stars，发版活跃（0.23 系列每周多个 release）。定位很清楚： **Claude Code-style 的国产 CLI** ，从 slash 命令命名（`/login`、`/plugins`、`/mcp-config`）、`AGENTS.md` 记忆约定、subagent 分工（`coder` / `explore` / `plan`）到 Hooks / Skills / Permission 规则，交互设计和 Claude Code 高度一致。单二进制分发（macOS/Linux/Windows），不依赖 Node.js。TUI 底层基于 `pi-tui`（和 omp 同源），但 Agent 引擎和 provider 客户端是月之暗面自己实现的。

按官方文档它明确支持自定义 OpenAI 兼容 endpoint（`type = "openai"` + `base_url` 自定义），文档甚至专门举了 DeepSeek / Qwen / One API 这类第三方 gateway 的例子，看起来是国产 CLI 里对内网 gateway 场景最友好的候选。

**实测：内网 gateway 用不了** （调研版本 kimi-code 0.23.3）。

用相同的 API Key、baseURL、模型（OpenCode / omp 都能跑通的那份）配好 `~/.kimi-code/config.toml`，`kimi provider list` 也能正常列出 provider，`kimi doctor` 通过。但一发实际请求就崩：

```
error: failed to run prompt: provider.api_error:
Error: Cannot read properties of undefined (reading 'content')
```

根因是 SSE 流式响应的实现差异：

- 用 `curl` 直接抓 gateway 的流式响应，发现有些 chunk 只有 `{"choices":[{"index":0}]}`， **没有 `delta` 字段** （首 chunk、中间空 chunk、带 `finish_reason` 的末尾 chunk 都会这样）
- 标准 OpenAI SSE 契约会保证每个 chunk 至少带一个空的 `delta: {}`
- kimi-code 内嵌的是 OpenAI 官方 `openai-node` SDK，其 `ChatCompletionStream` 直接访问 `choice.delta.content`（源码见打包产物 `dist/main.mjs:48347`），遇到没有 `delta` 的 chunk 就抛 `TypeError: Cannot read properties of undefined`
- **OpenCode 和 omp 都能跑通** 同一个 gateway，说明它们的 parser 对这类边缘情况更宽容——omp 用的是自家 monorepo 的 `@oh-my-pi/pi-ai`（fork 自上游 pi 生态），OpenCode 自己实现的流处理也做了防御

所以这个坑不是 kimi-code 的"设计错误"（它直接用官方 SDK，理论上是最标准的做法），也不是内网 gateway 的 bug（大部分 chunk 完全合规，只是在少数边界 chunk 上省略了空对象填充），但 **两方组合起来就是跑不了** 。gateway 侧改动涉及内部共享基础设施，要评估对所有下游客户端的影响，短期难推动；kimi-code 侧等官方后续版本自然修复即可。

**结论** ：官方文档承诺 + 完整的 Claude Code-style Agent 设计，理论上是国产 CLI 里最有希望的候选。但落到我们这个内网 gateway 上， **实测目前用不了** ，需要等其中一侧调整。放这里作为一个"观察名单"上的项目，值得后续 kimi-code 或者 gateway 有变化时再回来复测。

## 五、这些工具的血缘关系

这些工具之间有不少 fork 和复用关系，理清楚有助于理解为什么某些工具行为相似（比如 MiMoCode / Kilo Code CLI 的很多能力都继承自 OpenCode）、为什么某些工具在同一场景下表现却完全不同（比如 omp 和 Kimi Code 都用 pi-tui，但内网 gateway 兼容性差别很大——因为 omp 复用了整个 pi-ai provider 层，Kimi Code 只用了 UI 层）。

| 工具 | 血缘来源 | 关系 |
| --- | --- | --- |
| Claude Code / Codex CLI / Qoder CLI | 无 | 独立自研 |
| **Crush** | 原 Go 版 opencode-ai/opencode | Fork，原作者加入 Charm 后继续维护 |
| **OpenCode (TS)** | 继承 opencode-ai 的名字 | 独立团队用 TS 重写 |
| **MiMoCode** | OpenCode (TS) | Fork |
| **Kilo Code CLI** | OpenCode (TS) | Fork |
| **Oh My Pi** | Can Bölük fork 自 Mario Zechner 的 pi-mono | 深度重写扩展（自研 provider 层 pi-ai、~55k 行 Rust 原生模块、LSP/DAP/ACP 全套） |
| **Kimi Code** | 独立自研，vendor 了上游 pi-tui | 只用 TUI 层，Agent / provider 全部自研 |
| **QwenCode** | Google Gemini CLI v0.8.2 | Fork，v0.1 后独立发展 |

所有血缘关系都有 README / LICENSE 一手证据可核，这里就不逐个引用了。 **一个值得说的现象** ：Claude Code 官方源码闭源（npm 包是 bundle 过的），本身没有直接的开源 fork。但它反而成了整个生态的心智模型标杆。所有平替都是独立实现，只是 **在心智模型上互相对齐** ：AGENTS.md 记忆、subagent、slash 命令、Plan / Build 模式切换、Skills / Hooks / MCP 一套约定，跨工具已经形成了事实标准。即使源头完全不同（QwenCode 源自 Gemini CLI、omp 源自 pi-mono），落到用户能看到的交互层都相当接近。

## 六、横向对比

评级只反映"作为 Claude Code 平替"这一个维度下的判断，不代表工具本身的绝对优劣。表格里 ✅ 表示明确支持、❌ 表示明确缺失、⚠️ 表示存在但有限制（悬停或阅读单元格备注可看具体说明）。

" **Web 沙箱集成 (ACP)** " 这一行说明一下：ACP（ [Agent Client Protocol](https://agentclientprotocol.com/) ）是一个开放协议，用来标准化 Editor / Web 沙箱和 AI Agent 之间的通信。Coding Agent 平台通过 ACP 驱动各种 CLI，让用户在 Web 端就能用这些工具。如果一个 CLI 官方原生支持 ACP，它就更容易被这类平台集成——反之要么绕 adapter，要么彻底集成不了。这个维度对个人开发者不重要，对 **要在团队/平台层规模化推广** 的场景很关键。

每格评价的依据是 [Zed 官方 ACP 支持清单](https://zed.dev/acp)——**页面上列出的每个 agent 都有 ACP 支持** 。有两个 "继承上游" 的特殊情况：

- **omp** 没单独出现在清单里，但其上游 Pi (pi-mono) 有官方支持，omp 作为完整 fork 继承了这个能力，实际 README 也确认了 `omp acp` 子命令
- **MiMoCode** 也没在清单里，但 README 里明确 "keeps all core OpenCode capabilities"，OpenCode 有 `opencode acp`，理论上 `mimo acp` 也应该继承（未实测确认）

| 维度 | Claude Code | OpenCode | Crush | Codex CLI | Qoder CLI | MiMoCode | Kilo Code | Oh My Pi | Kimi Code | QwenCode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 开源 | 核心闭源 | MIT | FSL-1.1-MIT | Apache-2.0 | 闭源 | MIT | MIT | MIT | MIT | Apache-2.0 |
| 实现语言 | TS | TS/Bun | Go | Rust | TS | TS/Bun | TS | Rust+TS | TS | TS/Node |
| 支持内网网关 | ✅（但集团已禁用） | ✅ 实测跑通 | ✅ | ❌ 只支持 Responses API | ❌（无自定义 endpoint） | ✅ | ✅ | ✅ 实测跑通 | ⚠️ 文档支持但实测崩溃 | ✅ 实测跑通 |
| MCP | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 子 Agent | ✅ | ✅（默认单层，可配置） | ⚠️ 极简（coder + task 两个 named agent） | ✅ | ✅ | ✅（增强） | ✅（继承 OpenCode） | ✅（plan/designer/reviewer/librarian/explore） | ✅（coder/explore/plan） | ✅ |
| Skills | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅（Auto-Skills） |
| Hooks | ✅ | ✅（通过 Plugin 订阅事件实现） | ⚠️ preliminary support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 预设 mode | 4 种（Default / Accept Edits / Plan / bypassPermissions，Shift+Tab 循环前 3 种） | 2 种（Build / Plan，Tab / Shift+Tab 切换） | ❌（只有 tool 白名单/权限档位） | 3 种 permission mode（`/permissions` 命令切换） | 5 种 permission mode（default / accept\_edits / auto / YOLO / dont\_ask，Shift+Tab 切换）+ Plan work state | 3 种（build / plan / compose，Tab 切换） | 5 种（Code / Plan / Ask / Debug / Review，Cmd+. / Ctrl+. / dropdown / `/agents` 命令） | 多种（plan/tiny/task/commit/designer 等 role，`/plan` 等 slash 命令切换） | 3 种（Default / Plan / YOLO，Shift+Tab 或 `--plan` / `--yolo` 启动参数） | 5 种（Plan / Default / Auto-Edit / Auto / YOLO，Shift+Tab 或 `/approval-mode` 命令切换） |
| 持久记忆 | 手动（CLAUDE.md） | 手动（AGENTS.md） | 手动（CRUSH.md / AGENTS.md，自动加载） | ✅ AGENTS.md + Memories + Chronicle | 手动 | ✅ 自动 checkpoint | 手动（AGENTS.md，继承 OpenCode） | ✅ Hindsight（跨 session 自动） | 手动（AGENTS.md） | ✅ Auto-Memory |
| IDE 插件 | ✅ 官方（VS Code / JetBrains） | ✅ SDK / ACP | ❌ | ✅ 官方（VS Code / JetBrains） | ✅ 官方（VS Code / JetBrains） | ✅（继承 OpenCode） | ✅ 官方（VS Code / JetBrains） | ✅ ACP（Zed / JetBrains） | ✅ ACP（Zed / JetBrains） | ✅ 官方（VS Code / JetBrains / Zed） |
| Web 沙箱集成 (ACP) | ⚠️ 需 adapter | ✅ | ❌ | ✅ | ✅ | ⚠️ 继承 OpenCode | ✅ | ✅（上游 Pi） | ✅ | ✅ |
| 工程质量 | 极高 | 高 | 高 | 极高 | 高 | ⚠️ 早期，bug 多 | 高 | 极高（实测最稳） | 高（活跃迭代） | ⚠️ 打磨中 |

## 七、当前的两个选择：OpenCode 和 omp

对着表看，OpenCode 和 omp 各有明显优势，我实测下来两个都留在电脑上，还没定死谁是"主力"，打算再深度用一段时间再判断。先说各自的强项：

**OpenCode 的强项：**

- **UI 更规整**——布局偏专业/企业风，信息层级清晰
- **支持鼠标操作**——TUI 里能用鼠标点选，符合传统 IDE 用户的习惯
- **生态最完整**——MCP / Plugin / Skill 三件套，Superpowers 这类社区扩展第一手支持
- **社区规模最大**——截至撰稿时是 star 数最多的开源 CLI Coding Agent 项目，遇到问题在 issue 里能查到
- **和主流工具的心智模型最一致**——从 Claude Code 切过来几乎无感

**omp 的强项：**

- **工程质量更硬**——长任务、MCP OAuth、Rust 核心的稳定性都比 OpenCode 好（第九节 OpenCode 的写大文件 silently fail 和 subagent 权限问题，omp 上都没有）
- **性能更好**——Rust 写的核心，进程内集成 ripgrep / LSP / brush，避免 fork-exec 开销
- **有三块能力是 Claude Code 和 OpenCode 都没有原生提供的**——自动化持久记忆（Hindsight 跨 session 累积项目知识）、反向审查模型（Advisor 独立模型旁路监督主 Agent 每一步）、进程内 LSP + Hashline 结构化编辑，开箱即用不需要装 MCP 或 plugin 补齐
- **功能密度更高**——README 官方数据 "32 built-in tools · 14 lsp ops · 28 dap ops"，另外还有 DAP 真调试器、端到端加密的 `/collab` 协作、TTSR 时间旅行流规则等 OpenCode / Claude Code 都没有的能力
- **自动继承已有配置**——`.claude` / `.cursor` / `.gemini` / `.codex` 等目录直接读取，从 Claude Code 迁移零重配

**两个的共同优势：**

- 都实测能接内网 gateway
- 都官方原生支持 ACP 协议，能被 Web Coding Agent 平台直接驱动——个人和平台层用的是同一套 CLI，不用维护"CLI 版本 + Web 版本"两条链路
- 都完全开源（MIT）

**当前判断（按场景切分）：**

- **想复用 Superpowers 之类的现成 skill 包 / 遇到问题好搜 issue** → **OpenCode** （生态最活跃，社区扩展第一手支持在这里）
- **想让长任务不掉链子、MCP OAuth 无端口冲突、Rust 性能红利** → **omp** （工程质量层面 omp 明显更硬）
- **想让"同一份提示词 + 同一份 `CLAUDE.md`/`skills` → 产出物形态最接近 Claude Code"** → **omp** （架构上更同构：SYSTEM.md/append-system-prompt 契约 + 直读 `.claude/CLAUDE.md` + 32 built-in tools 覆盖 CC 核心工具集 + "专精 role" subagent 模型；OpenCode 只有 13 tools + "能力档位" subagent，同 prompt 跑出来解题路径不同）

两个都是很有竞争力的选择，深度用一段时间之后大概率会有更明确的偏好。

## 八、给 OpenCode 加装备：踩过之后剩下的组合

OpenCode 裸奔够用，但要往 Claude Code 完整体验靠一步，可以通过 plugin + MCP 补齐记忆、深度推理、大项目下的代码理解。

一开始按社区推荐规划了四件套（Superpowers + Context7 + Sequential Thinking + Serena），实测下来撤了两个，剩下两个：

**目前保留在 `~/.config/opencode/opencode.json` 里的：**

- **Superpowers plugin** ：Jesse Vincent（Prime Radiant）开发的 skill 集合，覆盖 brainstorming、writing-plans、systematic-debugging、TDD、dispatching-parallel-agents 等场景。项目 star 数很高、更新活跃，安装方式是让 Agent fetch 一个 INSTALL.md 脚本，非常干净
- **Sequential Thinking MCP** ：结构化推理链，零依赖、无本地状态、无网络请求，Agent 自主判断何时调用。装完等于白捡的能力，对复杂重构和架构设计场景收益明显

**试过之后撤掉的：**

- **Context7 MCP** ：设计上是"实时拉主流库官方文档"，能解决 LLM 对 API 版本认知过时的问题。但 **必须在 prompt 里显式写 `use context7` 才会触发** ，不能做到 Agent 无感调用。日常写代码不会记得每次都加这一句，价值就打折了
- **Serena MCP** ：定位是准 IDE 后台服务——Python 项目 + 77 个依赖 + 独立 dashboard + 需要单独的 `~/.serena/` 目录存状态。太重了，不像"标准 MCP"（stdio 起停干净、无外部状态）的直觉。而且它主打的符号级代码操作和记忆管理，OpenCode 自身也有 LSP 集成，加装 Serena 的边际收益不足以抵消这份部署成本

**MCP 选型上的一点经验** ：优先选 **无状态、无外部依赖、Agent 自主调用** 的 MCP。任何需要显式 prompt 触发、或者需要单独维护本地服务的 MCP，都要评估一下是不是值得那份维护成本。

## 九、切到 OpenCode 遇到的几个坑

既然把 OpenCode 留在候选里，就要说清楚它的短板。四个都是实际踩过的（ **坑一、坑二、坑四在 omp 上都没出现** ，这也是我把 omp 保留下来的重要原因）。

**坑一：写大文件会 silently fail** （ [issue #19604](https://github.com/anomalyco/opencode/issues/19604) ，Open）

Write 工具在生成 **约 800-1200 行以上** 的文件时开始静默失败——tool call 返回成功，实际没写入。作者标 High 影响，也提到"appears to be a recent regression"。官方 workaround 是 **先用 Write 写前 300-400 行，剩下用 Edit 分段追加** 。规避成本很低：长文档写完主动跑 `wc -l` 核对一下行数即可。

**坑二：subagent 默认不能再派发下一级 subagent**

多层任务编排跑不通，查日志发现每个 subagent 创建时被自动注入了 `task: deny` 权限：

```
permission="[{\"permission\":\"task\",\"pattern\":\"*\",\"action\":\"deny\"}]"
```

如果你设计的工作流是 orchestrator → subagent → 更深层 subagent 这种多层结构，在 OpenCode 默认配置下 **跑不通** 。 [官方 agents 文档](https://opencode.ai/docs/agents) 里其实有说明可以通过自定义 agent 的 `permission.task` 白名单打开（例如 `"orchestrator-*": "allow"`），但没在显眼位置提醒。坑主要在 **现象不直观**——报错不明显、日志得挖。

**坑三：skill name 规范和 Claude Code 不同**

从 CC 迁过来一个中文命名的 skill 死活触发不了。两个约束：

1. OpenCode 会同时扫描 `.claude/` 和 `.opencode/` 两个目录， **同名 skill 会冲突告警**
2. **skill name 要求英文小写 + kebab-case** ，中文命名的 skill 触发链路会出问题（CC 对中文 name 相对宽松）

规避： **从 CC 迁过来的 skill 先做一遍 name 检查** ，改名的同时要改所有内部触发词引用。

**坑四：MCP OAuth 授权跑不通** （ [issue #30888](https://github.com/anomalyco/opencode/issues/30888) ）

`opencode mcp auth` 命令触发浏览器授权后，回调页面报误导性的 "Invalid or expired state parameter - potential CSRF attack"。根因： **OAuth 回调服务默认硬编码用 `127.0.0.1:19876` 端口，端口被占用时会静默 fallback** ，然后浏览器回调打到别的进程上。

社区两个相关修复都还没落地： [PR #31490](https://github.com/anomalyco/opencode/pull/31490) 提了"直接报清楚"的最小修， **被 automated-pr-cleanup bot 以"1 个月内 <2 个正面 reaction"的理由自动关闭** ；maintainer 后续接手的 [PR #33715](https://github.com/anomalyco/opencode/pull/33715) 做更完整的原子性修复，目前仍 Open 未合并。 **这从侧面反映了当前 issue 3.6k+ / PR 1.1k+ 的规模下，非核心路径 bug 的修复周期偏长** 。

两条实际可用的绕过方案：

- **换端口** ：MCP 配置的 `oauth.callbackPort` 字段官方文档没写，但源码里已 wired（issue #30888 作者原话："fields already exist on `McpOAuthConfig` and are wired through `ensureRunning`"），可以直接改端口避开冲突
- **跳过 OAuth 自动化** ：改用 `oauth: false + Bearer token`，自己写脚本走标准 OAuth PKCE 拿 token（Python 标准库就够），塞到环境变量里让 OpenCode 直接读

```json
"<mcp-server-name>": {
  "type": "remote",
  "url": "<mcp-server-url>",
  "oauth": false,
  "headers": { "Authorization": "Bearer {env:<TOKEN_ENV>}" },
  "enabled": true
}
```

## 十、omp 的一个架构性坑：在 omp 里问 OpenCode 的行为，会得到 omp 自己的规则

深度用了一段时间后踩到一个不好描述但很有代表性的坑： **在 omp 会话里问 OpenCode 的行为细节，omp 会把 OpenCode 当成自己，用 omp 自己的规则来回答** 。一开始以为是模型幻觉，跟进分析之后发现不是随机错误，而是架构定位决定的。

一个容易被误解的地方： **omp 和 OpenCode 都会读其他家的配置目录** （比如都会读 `.claude/skills/`），差别不在"兼不兼容"，而在 **兼容广度和自省信息暴露方式** 。

先看 **兼容广度** 。omp 是 Rust + TypeScript 打包成的单文件可执行程序，Homebrew 装完在 `/opt/homebrew/Cellar/omp/*/bin/omp`。我用 `strings` 命令把里面所有可读的字符串常量抽出来看，能看到 `Load skills from .claude/skills/*/SKILL.md`、`Load MCP servers from opencode.json mcp key`、`Load AGENTS.md from ~/.config/opencode/`、`Load skills from ~/.codex/skills`、`Load MCP servers from ~/.cursor/mcp.json`、`Load MCP servers from Windsurf config` 等描述，至少覆盖 `.claude/` / `.opencode/` / `.codex/` / `.cursor/` / `.gemini/` / `.windsurf/` / `.github/` 7 家 IDE，跨 skills / hooks / MCP / AGENTS.md / commands / plugins 多个配置维度。对比之下，OpenCode 的官方 [Agent Skills 文档](https://opencode.ai/docs/skills) 列出的兼容目录只有 `.claude/skills/` 和 `.agents/skills/`，只在 skill 一个维度做兼容。

再看 **自省信息暴露方式** 。omp 还提供了一个 `omp://` 协议把兼容规则暴露给 agent，让 agent 在会话里可以主动查询"我自己是怎么工作的"（在编程语言里这类能力叫 reflection / 自省）。同样从 `strings` 输出能看到 `omp://` 这个协议前缀的字面以及绑定给它的 tool 描述文本，agent 通过这个协议能读到一份编译时嵌入的 harness 文档，内容就是"omp 怎么兼容各家 IDE"这套描述。有意思的是作者自己在这个 tool 描述里加了一句 `omp://: harness docs; AVOID unless the user asks about the harness itself.`，可见他自己也知道这套自省文档会引起混淆。而 OpenCode 没有类似的自省协议，兼容行为只在官方文档里描述，agent 会话里拉不到。

那 **为什么会混淆** ？我的理解是这样：`Load skills from ~/.config/opencode/skills/` 这句描述在上下文层面本身是有归属的，它出现在 omp 自己的 discovery provider 定义里（源码上是 `opencode.ts` 这类模块名），语义上讲的是"omp 从 `.opencode/skills/` 读取 skills"，不是"opencode 从这里读 skills"。所以问题不在 omp 文档写得不清楚，而在 **agent 检索文档时只按关键字匹配、不做归属分析** ：用户问 "OpenCode 的 skill 优先级怎么算"，agent 通过 `omp://` 匹配到 "Load skills from `~/.config/opencode/skills/`"，看到 "opencode + skills" 关键字全对上，就默认这条在回答 "OpenCode 的行为"，把宾语目录误当成了主语。这算是"聚合器 + agent 检索问答"这个组合的通病，改 omp 的文档也很难根治。

反过来看 **OpenCode 为什么天然不容易命中** ，我觉得有三个原因：兼容维度少（只 skill 一个维度，可被检索到的"字面重叠区"小得多）；没有 `omp://` 这类自省协议（agent 缺少触发这个 bug 的入口）；OpenCode 从设计到文档都聚焦"自己是什么"，不承担"我如何兼容别人"这类需要大量引用外部术语的自述任务。三个因素叠加，命中概率低一个量级。 **这不代表 OpenCode 更好** ，只是它没有 omp 那种"想做聚合器"的野心，两者是不同定位下的取舍。

**怎么规避** ？我自己的经验是这个坑没法彻底避免，只能降低概率。相对可靠的做法是 **别在 omp 会话里问其他 IDE 的行为** ，想查 OpenCode 就切回 OpenCode 官方文档，或者启一个 OpenCode 会话直接问它自己。如果必须在 omp 里问，至少加一句"这个问题是问 OpenCode 本身的行为，不是问 omp 如何兼容 OpenCode"，能降低但不能完全消除混淆概率。

## 十一、写在最后

选平替这件事，容易陷入"追最强模型"的思维定势。实际用下来发现，模型只是产品的一部分。Claude Code 好用是因为它把 Agent Loop、工具调用、错误恢复、上下文管理、多端形态这些非模型的部分都做到位了。

评估平替也要看这些非模型的部分：

- Agent Loop 稳不稳
- 工具生态成不成熟
- 记忆 / Skills / Hooks / MCP 齐不齐
- 长期维护有没有保障
- 团队场景合不合适

按这个标准过一遍会发现，开源社区在这一层已经卷得很凶。我最后留在电脑上的是 **两个** ：OpenCode 和 omp——两个都能顶上 Claude Code 的日常场景，也都跑通了内网 gateway，怎么选取决于你更看重生态、工程质量还是"和 Claude Code 的架构同构度"（第七节展开）。没明确偏好的话，两个都值得上手一个礼拜再决定。

Claude Code 停用了，如果还没试过其他工具，OpenCode 值得优先上手（截至撰稿时 184k stars）。官方推荐的安装方式如下（ [出处](https://opencode.ai/docs/#install) ）：

```bash
# 官方安装脚本（macOS / Linux）
curl -fsSL https://opencode.ai/install | bash

# 或用 npm
npm install -g opencode-ai

# 或用 Homebrew（注意 tap 是 anomalyco，别装错成 opencode-ai 那个）
brew install anomalyco/tap/opencode
```

⚠️ 注意：Homebrew 下有个同名 tap `opencode-ai/tap/opencode`，那是 **已存档的 Go 版原 OpenCode** （就是第 4.4 节提到的最早那个仓库），不是我们要的项目，别装错。

初始化上，进入项目目录后执行 `opencode`，再在 TUI 里跑一次 `/init`，OpenCode 会分析代码库并生成 `AGENTS.md`。如果你原来有 `CLAUDE.md`，把内容合并到 `AGENTS.md` 里就行；日常工作流基本不用重构。

## 十一、留个问题

选平替这件事，本质上是在开源生态里挑一个"当前最适合"的选择，但生态每周都在变。我这次的调研未必是最优解，也肯定有我没关注到的工具或者用法。

**想听听其他同学的想法：**

- 有没有更适合内网 gateway 场景的 CLI Agent？
- 已经用上 OpenCode 的同学，Superpowers / Serena 这类 plugin + MCP 组合有没有实测经验，收益怎么样？
- 有没有正在试用某个我文档里 pass 掉的工具（比如 Codex CLI、Qoder CLI 等），能补充第一手感受？
- 有没有踩过我这次没写到的坑，或者已经沉淀出自己的 workaround？

**附：调研涉及的工具 GitHub 地址**

- OpenCode（TS 版，当前主力维护）: [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)
- OpenCode（Go 版原始项目，已存档）: [https://github.com/opencode-ai/opencode](https://github.com/opencode-ai/opencode)
- Crush: [https://github.com/charmbracelet/crush](https://github.com/charmbracelet/crush)
- Codex CLI: [https://github.com/openai/codex](https://github.com/openai/codex)
- Qoder CLI: [https://qoder.com/cli](https://qoder.com/cli) （闭源，npm 包 `@qoder-ai/qodercli`）
- MiMoCode: [https://github.com/XiaomiMiMo/MiMo-Code](https://github.com/XiaomiMiMo/MiMo-Code)
- Kilo Code: [https://github.com/Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode)
- Oh My Pi: [https://github.com/can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)
- Kimi Code: [https://github.com/MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code)
- Aider: [https://github.com/Aider-AI/aider](https://github.com/Aider-AI/aider)
- Superpowers: [https://github.com/obra/superpowers](https://github.com/obra/superpowers)
- Pi（Oh My Pi 和 Kimi Code 的 TUI 上游，原 `badlogic/pi-mono`）: [https://github.com/earendil-works/pi](https://github.com/earendil-works/pi)
- Google Gemini CLI（QwenCode 的 fork 上游）: [https://github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
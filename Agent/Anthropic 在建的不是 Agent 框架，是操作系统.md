---
title: "Anthropic 在建的不是 Agent 框架，是操作系统"
source: "https://ata.atatech.org/articles/11020625280?spm=ata.23639420.0.0.15527536i4WRdP"
author:
published:
created: 2026-05-08
description:
tags:
  - "clippings"
---
十眠

** 73

** 55

** 5

**

**

[泮圣伟(十眠)](https://ata.atatech.org/users/11000620412)

5月6日发表5月6日更新1.4k浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章45:54

**

> 从 Firecracker 逆向工程到 Agent OS 设计哲学

一位开发者从 Anthropic"Claude Code"Remote 的 Session 内部拿到了一个 root shell，其中 PID 1 不是 systemd，而是一个 Rust 写的 `process_api` 。内核 ACPI 表的 OEM ID 全部写着 FIRECK，并且 VM 的 dmesg 里有一段 48.5 小时的时间跳跃，指向 Firecracker microVM 的快照恢复机制。我们发现这个沙箱里跑着的，并不是 Claude Code 本身，而是 Managed Agents 平台的通用基础设施。

我们在里面还发现了：一套近 20 种消息类型的 WebSocket 协议（ `execute(name, input) -> string` 的真实面目）、Firecracker 快照恢复驱动的百毫秒级沙箱启动、三种完全不同的产品（CCR / Baku / BYOC）跑在同一套基础设施上且唯一区别是一个 JSON 字段。更值得注意的是，Managed Agents 的 Agent Loop 独立于 Claude Code 且不支持 context compaction（超过 1M token 直接报错），而它和传统操作系统之间存在一张几乎一一对应的完整 OS 映射表。

![Managed Agents 沙箱解剖：Firecracker microVM 内部结构](redirect.webp)

Managed Agents 沙箱解剖：Firecracker microVM 内部结构

这篇文章拆解这些发现，并尝试回答一个问题：Anthropic 在建的到底是什么？

如果你对 Anthropic 的工程博客 *[Scaling Managed Agents: Decoupling the brain from the hands](https://www.anthropic.com/engineering/managed-agents)* 有印象，你会知道他们把 Agent 拆成了 Brain（推理）和 Hands（执行）两部分，中间用一个极简接口 `execute(name, input) -> string` 连接。博客写得很漂亮，但它没有告诉你接口之下到底是什么。

深度挖掘下去后，我得到了答案。而这个答案，让我想到了 Richard Sutton 在 2019 年写下的 *The Bitter Lesson* （苦涩的教训）。

## 每一行 harness 代码都是一个会过期的赌注

先说 Bitter Lesson 为什么重要。

Anthropic 的工程博客里藏着一个不太起眼的技术细节 \[1\]：Claude Sonnet 4.5 会在感知到上下文窗口极限时过早结束任务，团队内部称之为"context anxiety"。工程师在 Harness 里加了 context resets 来修补。但当他们在 Opus 4.5 上使用同一个 Harness 时，这个行为消失了。那些 resets 变成了多余的负担（原文用词：dead weight）。

这就是 Sutton 核心论点的具体体现：利用大规模计算的方法，总是最终战胜利用人类知识编码的方法。翻译成 Agent 的语言—— **你为模型的局限性写的每一行补偿代码，都会在模型变强的那一天变成技术债。而模型变强的速度，比你还技术债的速度快得多。**

![Bitter Lesson：每一行 harness 代码的保质期都在缩短](redirect_1.webp)

Bitter Lesson：每一行 harness 代码的保质期都在缩短

推广一下这个例子。LangChain 的 chain、CrewAI 的固定角色分工、AutoGPT 风格的任务分解树，本质上都是同一类东西：用工程脚手架补偿模型能力的不足。 **每一个 Agent 框架都是一组关于"模型做不到什么"的假设的工程化表达。** 这类假设的半衰期正在急剧缩短——两年前的合理假设，今天可能已经是多余的。一年后？可能是有害的。

当然，并非所有框架编排都在补偿模型缺陷。权限控制、审计日志、数据验证，这些是业务逻辑层的需求，无论模型多强都不会消失。我说的是那些专门为模型局限性而存在的编排：chain 是因为模型不能一步到位，role 是因为模型不能多角色切换，task tree 是因为模型不能自主规划。

Anthropic 的工程博客在开头以超链接的形式暗引了 Bitter Lesson \[4\]，然后得出了一个关键的设计决策。用我的话概括： **不要建一个 harness，建一个 meta-harness，对接口有主见，对实现不做假设。** Anthropic 在另一篇关于 Agent harness 最佳实践的文章 \[7\] 中也讨论了类似的思路：harness 的价值在于让 Agent 聚焦核心能力，而好的 harness 应当随着模型进步而简化。

他们把这个理念具体化为：Managed Agents 不假设任何特定的 harness 实现，包括他们自己当前的。他们知道 Claude Code 的 Harness 是好的，但他们也知道它终将被更好的实现替代。所以他们选择赌接口的稳定性，而不是赌当前实现的正确性。

博客引述了 Eric Raymond 在《Unix 编程艺术》\[5\] 中讨论的一个经典命题（以下是 Anthropic 博客中的原文表述）：

> "How to design a system for programs as yet unthought of."（如何为尚未被构想出来的程序设计系统。）

这句话让我停下来想了很久。如果 Anthropic 真的在做这件事，为"尚未被构想出来的 Agent"设计基础设施，那他们到底建了什么？

上一节讲了"为什么"。现在看看代码。

## 拆开沙箱：PID 1 是 Rust，内核是 Firecracker

以下分析基于一份公开的逆向工程研究 \[3\]。入口是一个"Claude Code"Remote 的 Session，但发现的是 Managed Agents 平台的通用基础设施。

### PID 1 不是 systemd

第一步，看看内核说了什么：

```bash
$ dmesg | grep -i FIRECK
# ACPI 表 OEM ID 均为 "FIRECK"
```

这是一个 **Firecracker microVM** ，AWS 开源的轻量级虚拟化技术，每个 VM 的内存开销只有几 MB，启动时间在 125 毫秒以内。

然后看看 PID 1 是谁：

```bash
$ cat /proc/1/cmdline
/process_api --firecracker-init --addr 0.0.0.0:2024 --max-ws-buffer-size 32768 --block-local-connections
```

PID 1 不是 systemd，不是 init，是一个叫 `process_api` 的 **Rust 二进制** 。它做了 init 进程该做的所有事情：挂载 /proc、/sys、/dev，初始化 cgroups 和网络。然后监听端口 2024 的 WebSocket，等待外部指令。

在同一个 VM 里，还有一个 Go 编写的 `environment-manager` ，负责更高层的编排：Git 凭证代理、MCP 服务器管理、部署流程。这个二进制的符号表没有被剥离，甚至保留了 debug\_info，于是它的完整内部包结构被恢复了出来：

```
internal/
├── claude/           # Claude Code 进程管理
├── envtype/
│   ├── anthropic/    # Anthropic 托管环境
│   └── byoc/         # Bring Your Own Cloud
├── gitproxy/         # Git 凭证代理
├── mcp/              # MCP 服务器
│   └── servers/
│       ├── codesign/ # 代码签名
│       └── supabase/ # 数据库
├── orchestrator/     # 会话编排
├── session/          # 会话状态
├── tunnel/           # WebSocket 隧道
│   └── actions/
│       ├── deploy/   # 部署
│       └── snapshot/ # 状态快照
```

构建元数据显示它依赖 `github.com/anthropics/anthropic/api-go` at `(devel)` ，从 Anthropic 的 monorepo 直接构建。包结构中的 `envtype/anthropic/` 和 `envtype/byoc/` 直接对应 Managed Agents 的两种部署模式。也就是说，逆向工程的入口虽然是一个"Claude Code"的 Session，但发现的是 **Managed Agents 平台的通用基础设施** 。

为什么上述 Claude Code 都加了引号？因为 Managed Agents 平台中的 Agent Loop 其实是独立于 Claude Code 的 Agent 服务。我们发现它还没支持压缩，并且主子 Agent 的实现与 Claude Code 也不一致。（实际测试中，Managed Agents 的 Agent 在上下文超过 1M token 后会直接报错，而不是像 Claude Code 那样触发压缩。）  
![](redirect_2.webp)  
这个差异值得多想一层。Claude Code 做了 context compaction，因为它是面向用户的产品，session 可以持续几小时，上下文必然会爆。Compaction 是一个 UX 妥协：丢失一部分上下文信息，换取 session 继续运行。但 compaction 说白了就是一个关于"模型上下文窗口不够用"的工程补偿。上下文窗口从 4K 到 8K 到 32K 到 200K 到 1M，按这个趋势，10M 甚至更大只是时间问题。到那时，compaction 本身就成了 dead weight，和 Sonnet 4.5 的 context anxiety resets 一样。

Managed Agents 选择不做 compaction，直接在 1M 处报错，看起来像是"没做完"。但从 meta-harness 的框架来理解这个选择：不把关于模型局限性的假设烧进平台层。如果某个 harness（比如 Claude Code 的）需要 compaction，那是 harness 自己的事情，平台不替你做这个决定。

这和 Session = filesystem 的类比也对得上：操作系统的文件系统不会主动对你的文件做有损压缩，它提供原始存储空间，让应用自己决定怎么管理数据。当然，Managed Agents 未来也完全可能在平台层加入 opt-in 的 compaction 能力，但那会是一个 harness 可选的配置项，而不是一个默认行为。关键问题是"谁来决定做不做"。这个决策权留在 harness 还是平台，体现的是两种不同的抽象哲学。

这也揭示了 Claude Code 和 Managed Agents 之间一个容易被忽略的定位差异。Claude Code 是面向开发者的核心产品，它必须处理各种 messy 的现实场景（长 session、context anxiety、用户中途改需求），所以 compaction、子 agent、各种 harness tricks 都是合理的产品决策，它在为今天的用户体验负责。Managed Agents 是面向开发者的 Agent API，它的客户不是终端用户而是构建 Agent 应用的工程师，这些工程师可以设计任务边界、程序化处理错误、用多个 session 串联大任务。对 API 来说，给明确的错误信号比做有损的自动补偿更合理，不把假设烧进平台层比默认开启 compaction 更正确。同一家公司，两个产品，各自为自己的场景做了对的选择。而 Managed Agents 的选择恰好也是对 Bitter Lesson 更友好的那个：当上下文窗口增长到 10M 时，Claude Code 需要把 compaction 逻辑简化或移除，Managed Agents 什么都不用改。产品层和平台层各自承担不同类型的技术债。

### execute() 的真面目：近 20 种 WebSocket 消息

现在回到 Anthropic 工程博客。博客把 Brain 和 Hands 之间的接口描述得极度简洁： `execute(name, input) -> string` 。一个名字、一个输入、一个字符串返回。优雅，极简。

但实际实现是什么？是一套多路 WebSocket 协议。 `process_api` 的 Server->Client 消息类型有近 20 种：ProcessCreated、ProcessExited、ProcessTimedOut、ProcessOutOfMemory、ContainerOutOfMemory、ExpectStdOut、StdOutEOF...

它用两步序列处理 stdin（先发文本帧声明"接下来是 stdin"，再发二进制帧传输原始字节），用同样的两步序列处理 stdout 和 stderr。它支持 Detach（断开但进程继续运行）和重连。

`execute(name, input) -> string` 是对外的抽象。内部是一个完整的远程进程管理协议。简洁的接口和复杂的实现之间不矛盾，好的抽象就是这样的。Unix 的 `read()` 系统调用也是一个极简接口：文件描述符、缓冲区、大小。但内核内部， `read()` 经过了 VFS 层、文件系统驱动、页缓存、块设备驱动、中断处理... 复杂度在接口之下被完全屏蔽。

Anthropic 在做同样的事：用一个极简的接口屏蔽了底层的全部复杂性。

### 快照恢复：TTFT 优化的秘密

Anthropic 博客报告了显著的性能提升 \[1\]：解耦后 p50 TTFT 降低约 60%，p95 降低超过 90%。但博客没有解释具体是怎么做到的。逆向工程给出了答案： **Firecracker microVM 快照恢复** 。比"推迟创建容器"复杂得多，是虚拟机级别的冻结-恢复-热替换。

VM 的 dmesg 时间线里有一个关键的跳跃：

```
[  30.731516] Run /process_api as init process
                    ~~~ 48.5 小时间隔 ~~~
[174695.927758] virtio_blk: [vdc] new size: 24848 sectors
[174695.953952] random: crng reseeded due to virtual machine fork
```

时间从 30 秒跳到了 174695 秒（48.5 小时后），中间的空白是 VM 被冻结为快照的时间。然后 VM 从快照恢复，块设备被热替换为新的后端。每个 Session 拿到自己的 rootfs（Ubuntu 24.04 的 ext4 分区）、Claude Code 程序（squashfs 只读分区）、和环境运行器（squashfs 只读分区）。

完整的机制是：一次性创建模板 VM， `process_api` 作为 PID 1 完成基础初始化后发出 SNAPSTART\_READY 信号；Firecracker 拍摄完整 VM 快照（内存、CPU 寄存器、设备状态全部冻结）；每个新 Session 从快照恢复（几乎瞬时，因为内核和 init 已经在内存中）；块设备在恢复时被替换为该 Session 的专用后端； `process_api` 唤醒后检测到 VM fork，丢弃页缓存，重挂文件系统，启动 `environment-manager` 。

ext4 分区的 mount count = 11，说明同一个 rootfs 模板至少被 11 个不同的 Session 复用过。内核级的 `init_on_free=1` 确保释放的内存页被清零，防止 Session 间数据泄露。CRNG 在 VM fork 时自动重新播种，防止密码学状态复用。

所谓"懒加载容器"，做的是虚拟机级别的基础设施工程。

![Managed Agents 沙箱架构蓝图：从 Host 层到 Agent 层的五层架构、五层安全隔离、快照恢复流水线](redirect_3.webp)

Managed Agents 沙箱架构蓝图：从 Host 层到 Agent 层的五层架构、五层安全隔离、快照恢复流水线

### 同一基础设施，三个完全不同的"应用程序"

逆向工程揭示了一个最能说明问题的发现：同一套 `process_api` + `environment-manager` 基础设施，通过不同的启动配置，支撑了 Managed Agents 平台上三种截然不同的产品形态。

- CCR（Claude Code Remote），标准的代码开发环境。项目源是用户的 GitHub 仓库，通过 git proxy 注入凭证，通过内置 Stop hook 检查 git push 状态和未提交更改。
- Baku，claude.ai 上的 Web 应用构建器（内部代号）。项目源是预装的 Vite 模板。内置 Supabase MCP 服务器（6 个工具：provision\_database、execute\_query、apply\_migration...），自动配置数据库，部署目标是 Anthropic 自己的内部平台 Antspace。Stop hook 检查 Vite dev server 错误和 TypeScript 类型错误，如果检查失败，Claude 收到反馈并继续修复，而不是停下来。
- BYOC（Bring Your Own Cloud），客户在自己的云环境中运行 Hands，Brain 仍在 Anthropic 侧。环境主动轮询工作： `POST /v1/environments/{id}/work/poll` ，确认后执行，通过 WebSocket tunnel 报告结果。这个 long-polling 模式是"many brains, many hands"架构的协议桥梁——客户侧的 Hands 完全自治，只通过 poll 接口与 Anthropic 侧的 Brain 建立松耦合连接。Brain 不需要知道 Hands 在哪里、怎么运行，只需要知道有人在 poll 工作。

三个产品，同一个 Managed Agents 基础设施。唯一的区别是启动时的一个 JSON 配置 `environment_type` 字段的值。

这让我想起了 Anthropic 工程博客引用的那句话："为尚未被构想出来的程序设计系统"， CCR、Baku、BYOC 就是运行在 Managed Agents 这个系统上的三个"程序"。但系统本身不关心具体是哪个程序，它只提供进程管理（ `process_api` ）、会话编排（ `environment-manager` ）、和标准化的通信协议（WebSocket + Tunnel）。

我们再仔细想想，这不就是操作系统的定义吗？

## 一张完整的 OS 映射表

我在读 Anthropic 工程博客时，最初把 OS 类比当作一种修辞手法。但随着逆向深入，我突然意识到 **这是字面意义上的操作系统工程。**

![传统 OS 与 Agent OS（Managed Agents）的完整映射](redirect_4.webp)

传统 OS 与 Agent OS（Managed Agents）的完整映射

先看一张完整的映射：

| 传统操作系统 | Managed Agents 对应 | 证据来源 |
| --- | --- | --- |
| **init 进程（PID 1）** | `process_api` （Rust 二进制） | 逆向：字面上就是 PID 1，挂载 fs、初始化 cgroups |
| **硬件虚拟化** | Firecracker microVM | 逆向：ACPI OEM ID = "FIRECK"，完整 VM 隔离 |
| **系统调用（ `read()` ）** | `execute(name, input) -> string` | 博客 + 逆向：近 20 种 WebSocket 消息的极简封装 |
| **进程状态机** | Session 生命周期：rescheduling -> running <-> idle -> terminated | API 文档 \[2\]：结构同构于 OS 进程状态 |
| **文件系统** | Session 事件日志（append-only，支持 `lseek` + `read` 语义） | API 文档 \[2\]： `getEvents()` 支持位置切片 |
| **页面置换 / 虚拟内存** | Context Compaction（概念对应成立，当前平台将决策权留给 harness） | 博客 + 逆向：harness 层可选实现 |
| **分环保护（Ring 0/3）** | 多层安全：VM 隔离 -> cgroup -> 凭证代理 -> JWT -> token 擦除 | 逆向：5 层 defense in depth |
| **网络 Socket** | MCP 协议（发现 -> 描述 -> 调用） | API 文档 \[2\]：类似地址解析 -> 协商 -> 传输 |
| **包管理器（apt/npm）** | Skills API（版本管理、从 /mnt/skills 加载 zip） | 逆向 + API \[2\]：semver 管理、预打包能力注入 |
| **Keychain / Credential Manager** | Vault（OAuth 凭证，write-only，平台代理注入） | API 文档 \[2\]：应用不直接接触凭证 |
| **信号处理（SIGTERM -> SIGKILL）** | Stop Hook（自动质量检查 -> 递归守卫防无限循环） | 逆向：Baku 的三项检查 + 第二次失败允许停止 |
| **网络文件系统（NFS）** | FUSE 挂载外部存储（含 vfs\_cache\_mode、backend\_cache\_ttl） | 逆向：用户态文件系统协议挂载远程存储 |

这些映射是 Managed Agents 透出的工程事实，不是后贴的类比。

### Session 的双重身份：为什么文件系统和进程不需要分开

但内核映射只是表层。更有意思的是 Session 这个概念，它在 Agent OS 中同时扮演了传统操作系统中两个分离的角色。

**第一重身份：Session 是文件系统。** Anthropic 博客把 Session 描述为一种 append-only 的事件日志。 `getEvents()` 接口支持位置切片，从任意位置开始读、向前或向后。语义上等价于 `lseek()` + `read()` 。Session 和 Claude 的上下文窗口是分离的，就像文件系统和进程内存是分离的：一个是持久存储，一个是工作内存。

**第二重身份：Session 是进程。** Managed Agents API 定义了 Session 的生命周期状态机：

```
rescheduling -> running <-> idle -> terminated
```

对比操作系统的进程状态：

```
new -> ready -> running <-> waiting -> terminated
```

两者有明显的结构相似性。 `rescheduling` 对应"可恢复的中断后重新调度"，比 OS 的 `ready` 更丰富，因为它包含了 Agent 特有的"从错误中恢复上下文"的语义； `running` 就是 `running` （正在执行）； `idle` 对应 `waiting` （等待外部输入）； `terminated` 就是 `terminated` （不可逆终止）。甚至 `running <-> idle` 的双向转换，Agent 执行到需要用户确认时进入 idle，用户回应后回到 running，也对应了进程在 running 和 waiting 之间的切换。映射不是一一对应的（Agent 的 `rescheduling` 比 OS 的 `ready` 多了恢复语义），但结构同构性是清晰的。

在传统操作系统中，"文件系统"和"进程"是两个完全独立的概念。文件存数据，进程跑计算。它们通过系统调用交互（进程 `read()` 文件），但确实是不同的东西。

Anthropic 把它们合二为一了。Session 既是状态的持久存储（事件日志），又是计算的运行单元（有生命周期、有状态转换、有调度）。这可能是 Agent OS 和传统 OS 最深层的结构差异： **在 Agent 的世界里，计算历史本身就是计算状态。** Agent 的"记忆"不是从文件系统中读取的外部数据，它就是 Agent 本身。Context window 是工作内存，Session 日志是持久存储，两者共同构成了 Agent 的"自我"。

所以 Anthropic 要在 Session 上同时实现 Events API（十余种事件类型，SSE 流式 + 轮询两种消费方式）。Events API 是 Session 作为文件系统的接口，外部通过它读写 Session 的状态。而 Context Compaction 的概念对应的是 Session 作为进程时的内存管理，但正如前文分析的，当前 Managed Agents 平台将 compaction 的决策权留给了 harness，而非内置为默认行为。

一个概念，两套 API，服务于两种完全不同的需求。这种设计的优雅之处在于：它在回答"如果操作系统是为 Agent 而非人类设计的，文件系统和进程还需要分开吗？"这个问题。答案显然是不需要。

## Brain-Hands 分离是三维优化

到目前为止，我一直在从"是什么"的角度拆解 Managed Agents。现在切换到"为什么"。Brain-Hands 分离是一个在安全、速度、成本三个维度上同时做优化的设计决策。Anthropic 在"Building effective agents"\[6\] 中讨论了 Agent 设计的一般原则，而 Managed Agents 的具体实现把这些原则推到了极致。

![Brain-Hands 三维分离架构蓝图：核心架构、execute() 协议桥、三维优化收益、工具路由策略](redirect_5.webp)

Brain-Hands 三维分离架构蓝图：核心架构、execute() 协议桥、三维优化收益、工具路由策略

### 安全：你的 Agent 框架可能在同一个进程里跑 Brain 和 Hands

在传统的 Agent 框架中，Brain（推理循环）和 Hands（工具执行）跑在同一个进程里。LangChain 的 Agent 调用一个 tool，tool 的输出直接回到同一个 Python 进程的内存空间。

恶意的工具输出可以直接污染推理。如果一个 bash 命令的输出包含精心构造的 prompt injection，它会直接进入模型的上下文窗口。更严重的是，如果工具执行涉及不受信任的代码（用户提交的脚本、从网上拉取的依赖），这些代码和 Agent 的推理引擎跑在同一个安全边界内。

Brain-Hands 分离彻底改变了这个安全模型：Brain 运行在 Anthropic 的编排层，Hands 运行在隔离的 Firecracker microVM 里，两者通过事件协议（WebSocket）通信。工具输出必须经过序列化、传输、反序列化才能到达 Brain，这个过程本身就是一层消毒。恶意代码在 VM 里随便折腾，但 VM 有 cgroup 限制、有网络隔离、有内存清零。它影响不了 Brain，也影响不了其他 Session。

操作系统中"用户态/内核态"分离的安全逻辑也是一样的。用户态程序（Hands）不能直接操作硬件（Brain 的推理引擎），必须通过系统调用（ `execute()` ）经过内核（编排层）的权限检查。Managed Agents 的 Permission Policy（ `always_allow` / `always_ask` ）就是 syscall 级别的访问控制，某些工具调用需要用户确认，就像某些系统调用需要 root 权限。

逆向工程发现的多层安全印证了这一点：Firecracker VM 隔离（硬件级）-> cgroup 限制（OS 级）-> 凭证不进入沙箱（应用级）-> JWT 认证（网络级）-> 启动后 token 擦除（运行时级）。每一层都假设上一层可能被突破。这正是 defense in depth，操作系统安全的基本原则。

### 速度：大量 tool call 根本不需要沙箱

Anthropic 博客报告的性能数据很惊人：解耦后 p50 TTFT 降低约 60%，p95 降低超过 90%。但数据背后的洞察更值得关注：大量 tool call 根本不需要沙箱。

想想一个典型的 Agent Session：用户说"帮我调研一下竞品的定价策略"。Agent 的工作流程可能是：先 `web_search` 搜索几个关键词，再 `web_fetch` 抓取几个页面，然后调用 MCP 工具在 Notion 里创建一个文档，最后把分析结果写进去。整个过程没有一行代码需要在沙箱里执行，没有 bash、没有文件读写、没有代码编译。

如果这个 Session 一开始就要等待 Firecracker VM 启动、块设备挂载、文件系统初始化... 那这些等待时间就是纯粹的浪费。

Brain-Hands 分离让一种更精细的策略成为可能：按 tool call 类型智能路由。

| 沙箱需求 | 工具类型 | 执行方式 |
| --- | --- | --- |
| **不需要沙箱** | `web_search` 、 `web_fetch` 、MCP 工具调用（GitHub API、Linear、Asana 等）、自定义工具（客户端侧） | 编排层直接执行，零沙箱开销 |
| **需要代码沙箱** | `bash` 、 `read` 、 `write` 、 `edit` 、 `glob` 、 `grep` | 在隔离 VM 内执行，需要文件系统和进程隔离 |
| **需要浏览器沙箱** | 浏览器操作 | 独立浏览器实例，与代码沙箱隔离 |

更聪明的做法是异步预热：Brain 开始推理时不启动沙箱。推理阶段如果 Brain 判断接下来可能需要文件操作，提前发出信号异步拉起 VM。等到第一个 `bash` 或 `write` 调用真正到来时，VM 已经就绪。用户感知到的延迟从"推理时间 + 沙箱构建时间"缩短为 `max(推理时间, 沙箱构建时间)` ，而推理通常比 VM 启动更慢。

这解释了 Anthropic 用 Firecracker 而不是普通容器的原因。Firecracker 的快照恢复机制让异步预热变得极其高效：跳过"拉镜像、启动 OS、安装依赖"的分钟级冷启动，直接"从内存快照恢复 + 热替换块设备"，百毫秒级完成。快照恢复 + 异步预热 + 按需路由，三者结合才是 TTFT 优化的完整故事。

### 成本：从"每 Session 一个 VM"到"按需分配"

速度优化的另一面就是成本优化。如果每个 Session 都需要一个完整的 Firecracker VM，那成本结构是固定的，不管 Agent 用不用沙箱，VM 的内存和 CPU 都在那里消耗着。

按需路由彻底改变了成本模型。一个只做 web\_search + MCP 调用的 Session，完全不需要分配 VM 资源。只有真正需要代码执行的 Session 才拉起沙箱，而且沙箱可以在工具调用完成后回收。类似 EC2（固定分配）到 Lambda（按调用计费）的转变，只不过这次是在 Agent 基础设施层面。

Anthropic 工程博客指出 \[1\]，Brain 和 Hands 解耦后容器的大部分时间都在空闲。换个角度看，这其实是一个经济学问题。假设容器大部分时间在等待 Brain 推理（推理是计算密集但不在容器里发生的），那你在为空闲的内存和 CPU 付费。解耦之后，容器可以在空闲时被回收或释放给其他 Session，资源利用率大幅提升。

Brain-Hands 分离之所以是一个好的架构决策，在于它同时带来了安全、速度、成本等多方面好处。协议隔离提升了安全性，按需路由提升了速度，空闲回收降低了成本。所以我倾向于把 Brain-Hands 分离看作一个设计原则，而非实现细节。 **它更接近于 Agent 基础设施的"用户态/内核态"分离原则。** 操作系统设计中用户态/内核态分离同时服务于安全、性能、资源管理，因为它是正确的抽象层级划分。

![Brain-Hands 三维分离架构蓝图：核心架构、execute() 协议桥、三维优化收益、工具路由策略](redirect_6.webp)

Brain-Hands 三维分离架构蓝图：核心架构、execute() 协议桥、三维优化收益、工具路由策略

## 在调用过程中加速自进化飞轮

如果你只看 Anthropic 的工程博客，Brain-Hands 分离的好处是运行时层面的：更快、更安全、更便宜。但结合 Managed Agents API 的完整设计来看，我认为还有一个更深的维度没有被公开讨论过。以下分析是基于架构推断的合理推测，而非已证实的事实：

**Brain-Hands 分离可能创造了一个自进化的飞轮。**

### 每一次工具调用都是一条正反馈数据

想想 Brain-Hands 之间的交互：Brain 决定调用哪个工具、传什么参数（决策）；Hands 执行并返回结果（反馈）；Brain 基于结果决定下一步（学习）。

当这个交互通过标准化的事件协议进行时，每一步都被自动记录在 Session 的事件日志中。Managed Agents API 定义了结构化的事件类型： `agent.tool_use` （Brain 决定使用工具）、 `agent.tool_result` （工具执行结果）、 `agent.mcp_tool_use` （MCP 工具调用）、 `agent.mcp_tool_result` （MCP 工具结果），加上推理过程的 span 事件（包含 token 用量）。

如果 Anthropic 有意愿将这些数据用于模型训练（这是合理但未经证实的推测），那这就构成了一套完整的、结构化的正反馈经验，而且是自动产生的。

每个 Session 记录了：Brain 做了什么决策（tool\_use 事件）、环境给了什么反馈（tool\_result 事件）、Session 最终的完成状态（正常结束、被用户中断、还是出错终止）、过程中消耗了多少资源（token 用量和 Session 轮次数）。这些要素和 Reinforcement Learning 的基本框架高度吻合：状态（上下文）、动作（tool call）、奖励信号（执行结果 + 完成状态）、轨迹（完整 Session 历史）。不过从"结构上可以用"到"实际在用"还有距离，数据质量、隐私合规、奖励信号的噪声等问题都需要解决。但架构层面的准备是显而易见的。

需要指出的是，Anthropic 的 API Terms of Service 明确声明 API 输入输出默认不用于模型训练（用户可 opt-in）。所以即使架构上完全具备这个能力，实际操作方式可能是：仅对 opt-in 用户或内部 dogfood 数据启用训练管线，或通过匿名化+聚合的方式提取模式而非直接使用原始 Session。 **架构准备好了飞轮的可能性，ToS 和隐私合规决定了飞轮实际转多快。**

### 分离使大规模离线自进化成为可能

这是关键的一步：如果 Brain 和 Hands 在同一个进程里，你要复现一个 Session 的行为数据，就必须实际启动沙箱、实际执行工具、实际等待结果。这个过程很慢（每个 Session 可能几分钟到几小时），而且很贵（每个复现都需要 VM 资源）。

**Brain-Hands 分离之后，Brain 不依赖真实的 Hands。** 你可以用模拟的工具结果（从历史 Session 中提取的 tool\_result）来喂给 Brain，让它在不启动任何 VM 的情况下"经历"成千上万个 Session。这正是 offline RL / 合成反馈的价值所在，训练成本从"每个 Session 需要一个 VM"降到"每个 Session 只需要存储的事件日志"。

而且因为事件协议是标准化的，不同产品（CCR、Baku、BYOC）产生的数据格式完全一致。Brain 不关心数据来自哪个 Hands 实现。一个在 Baku 上构建 Web 应用的 Session，和一个在 CCR 上做代码重构的 Session，产生的执行数据都可以被同一个训练管线消费。

Anthropic 博客指出 \[1\]，Managed Agents 平台的目标是 matching Claude's intelligence over time。我倾向于认为这句话有另一层含义：被动"匹配"之外，还有主动"驱动"模型进步的意图。

### Bitter Lesson 的自我加速

这里出现了一个漂亮的正反馈循环：

1. **Bitter Lesson** 说模型会变强，harness 假设会过期
2. **meta-harness** 设计让基础设施在假设过期时不需要改变
3. **Brain-Hands 分离** 让每个 Session 自动产生结构化训练数据
4. **训练数据** 驱动模型变得更强
5. **更强的模型** 让更多 harness 假设过期
6. 回到第 1 步

![自进化飞轮：架构在加速自己的前提条件成立](redirect_7.webp)

自进化飞轮：架构在加速自己的前提条件成立

架构在加速自己的前提条件成立。Anthropic 在"利用" Bitter Lesson。meta-harness 是防御策略（让基础设施不被模型进步淘汰），自进化飞轮是进攻策略（用基础设施加速模型进步）。防守和进攻用的是同一个架构。

这可能是 Brain-Hands 分离最深层的战略意义。速度和安全是工程收益，成本结构是经济收益，训练数据供给是飞轮收益。三层叠在一起，才是全貌。

当然，我无法确认 Anthropic 内部是否真的在用 Session 数据做后训练，他们没有公开说过。但架构本身已经为此做好了准备：标准化的事件日志、结构化的 tool\_use/tool\_result 对、Session 级别的成功/失败信号、Brain 和 Hands 的协议解耦。 **如果他们没有在这样做，那他们浪费了自己最好的架构决策。**

## 你的 Agent 框架是应用层，不是平台层

拆完 Managed Agents 的架构之后，回到一个很多开发者关心的实际问题：

如果 Managed Agents 是 OS 层，那 LangChain、CrewAI、AutoGPT 是什么？

它们是用户态应用。用户态应用是操作系统存在的意义。但它意味着两件事。

第一，它们不是平台。就像一个 Linux 应用不能取代 Linux 内核一样，一个 Agent 框架不能取代 Agent OS。框架提供的是特定的编排策略（chain、role、task tree），OS 提供的是基础能力（进程管理、状态持久化、安全隔离、工具接口）。两者不在同一层。

第二，它们中补偿模型缺陷的部分会被模型进步淘汰。这是 Bitter Lesson 的推论，但需要做更细粒度的拆分。

框架中用于补偿模型局限性的编排（chain 是因为模型不能一步到位，task tree 是因为模型不能自主规划）有保质期，而且保质期越来越短。但框架中用于实现业务逻辑的编排（RAG pipeline 的数据源管理、多 API 编排的错误处理、合规审计的记录链路）不会因为模型变强而消失。

问题在于，很多框架把这两种编排混在了一起，没有清晰的分层。当模型变强时，你需要拆掉补偿性编排但保留业务编排，如果它们纠缠在一起，这个拆解会非常痛苦。

OS 层则不同。 `execute(name, input) -> string` 不编码关于模型能力的假设。它只假设 Agent 需要操作状态和执行计算，这个假设不会过期，就像 `read()` 假设进程需要读取数据一样基本。

但 `execute()` 也有自己的假设：它假设 Agent 与环境的交互是离散的工具调用，输入输出是字符串。如果未来出现某种连续状态交互的范式，这个接口也会过时。但相比"模型不能多步推理"这种短命假设，"Agent 通过工具与环境交互"这个假设显然更基础、更持久。抽象层级的差异决定了保质期的差异。

Anthropic 博客指出 \[1\]，Managed Agents 可以容纳各种 harness 实现，随着 Claude 智能的提升而匹配。Claude Code 的 Harness 是一个优秀的用户态应用。但 Managed Agents 的设计目标是：当 Claude Code 的 Harness 过时的那一天（而那一天一定会来），基础设施不需要任何改变。

## Agent API 的野心：让 Model API 成为实现细节

上一节讨论的是框架和平台的层级关系。但如果我们把视野再拉高一层，会看到一个更大的趋势。

回想一下逆向工程中的一个细节：CCR、Baku、BYOC 三种完全不同的产品，唯一的区别是 `environment_type` 字段的值。Managed Agents 的 API 不暴露模型选择、不暴露 harness 实现、甚至不暴露执行环境的类型。它把所有这些都变成了平台侧的实现细节。这个设计选择指向一个更大的野心： **Agent API 正在试图吃掉 Model API。**

先说一个可能被忽略的组织信号。从逆向工程的证据看，Managed Agents 团队和 Claude Code 团队可能不是同一个团队。Agent Loop 是两套独立实现（Managed Agents 的不支持压缩、主子 Agent 行为和 Claude Code 不一致）；API 设计的语言是纯粹的平台/PaaS 风格（四大 CRUD 原语、版本管理、Events API、Permission Policy）；工程博客的叙事视角是"Managed Agents 平台"而不是"Claude Code 产品"。这更像是一个 Agent Infrastructure 团队，Claude Code 是他们最大的内部客户。

如果这个判断成立，那一个独立的基础设施团队做出来的 API，其战略意图往往比单个产品团队的视野更大。

### Model API 是 TCP，Agent API 是 HTTP

今天，大多数 AI 应用开发者的默认接口是 Model API（Messages API）。你发送一组 messages，指定 temperature 和 max\_tokens，处理 tool\_use 的 JSON 格式，自己管理上下文窗口，自己写重试逻辑，自己做状态持久化。这很像早期的 TCP socket 编程：你有完全的控制权，但你也承担全部的复杂性。

Agent API 做的事情是：你定义一个 Agent（工具集、权限策略、Skill 配置），创建一个 Session，然后描述你要它做什么。平台帮你管 Agent Loop（推理-工具调用循环）、管 Session 生命周期（rescheduling、idle、terminated）、管上下文（Session 事件日志）、管安全（Permission Policy、Vault 凭证代理）、管执行环境（Firecracker VM、快照恢复）。

你不再需要理解 Agent 是怎么工作的。你只需要知道你的业务需要什么工具、什么权限、什么任务。

HTTP 对 TCP 做的就是这件事。HTTP 没有消灭 TCP，今天做高频交易、做游戏服务器的人还是直接写 socket。但 99% 的应用开发者不再需要关心 TCP 握手、拥塞控制、重传机制。HTTP 把这些全部抽象掉了，开发者只需要理解 request/response。

注意 Agent API 的一个关键设计选择：你创建的是 Agent，不是"一个用 Claude Sonnet 4.5 的 chat session"。模型是平台侧的实现细节。今天你的 Agent 背后跑的是 Sonnet 4.5，明天平台升级到 Opus 5，你的 Agent 定义不需要改一行。有意为之的抽象：把模型从接口中彻底隐藏。

### 行业在集体往上走

Anthropic 之外的几家也在往同一个方向走：

OpenAI \[8\]：Completions API -> Chat Completions -> Assistants API（2026 年 8 月废弃）-> Responses API（内置 web search、code interpreter、file search）。Assistants API 的废弃特别值得注意，它说明 OpenAI 在重新校准抽象层级，方向是把更多能力内置到平台层。

Google：Model API -> Vertex AI Agent Builder（含 Agent Development Kit），三层架构 Build/Runtime/Govern，把 Agent 生命周期管理做成平台能力。

AWS：Bedrock（Model API）-> Bedrock Agents -> AgentCore（框架无关的 Agent 基础设施，2025 年下半年正式发布）。AgentCore 的核心卖点是"bring your own framework"，平台只管执行环境和工具集成。

**所有大厂都在从"卖模型调用"走向"卖 Agent 运行时"。** 抽象层级自然上移的结果。就像云计算从 IaaS（卖虚拟机）走向 PaaS（卖运行时）再走向 Serverless（卖函数调用），AI 基础设施也在从 Model API（卖推理调用）走向 Agent API（卖任务完成）。

![Agent API 抽象层级演进蓝图：Model API vs Agent API 对比、四大厂商行业趋同、云计算抽象层级对照](redirect_8.webp)

Agent API 抽象层级演进蓝图：Model API vs Agent API 对比、四大厂商行业趋同、云计算抽象层级对照

### Bitter Lesson 的第二层推论

回到 Bitter Lesson。第一层推论我们已经讨论过：harness 代码会过期，因为模型会变强。但还有第二层：

"你需要理解 Agent 架构"这件事本身，也是一个会过期的假设。

今天，建一个好的 Agent 产品需要你理解 context window 管理、tool calling 的最佳实践、ReAct 循环的调试技巧、multi-agent 协作的编排模式。这些知识很有价值，但它们的价值建立在一个前提上：平台还没有把这些事做好。

当 Agent API 成熟到一定程度，开发者的工作就简化为三件事：定义工具（你的业务能力有哪些）、定义权限（哪些操作需要审批）、描述任务意图。至于 Agent 怎么规划、怎么推理、怎么处理上下文、怎么从错误中恢复，全部由平台处理。就像今天的 web 开发者不需要理解 TCP 握手一样。

不过，这个愿景有一个重要的前提：Agent API 的抽象泄漏必须足够小。

HTTP 的抽象泄漏是可控的：请求要么成功要么失败，状态码告诉你发生了什么，重试逻辑是确定性的。但 Agent 的抽象泄漏要大得多：Agent 可能"看起来完成了但其实做错了"，可能在第 47 步偏离了正确路径但你在第 50 步才发现，可能因为上下文压缩丢失了关键信息。这种不确定性意味着开发者目前还不能完全放手，还需要理解底层发生了什么才能有效地调试和监控。

Managed Agents 的 Events API 的重要性也在于此。十余种事件类型、SSE 流式消费、完整的 Session 历史回放，这些是让"抽象泄漏可观测"的基础设施。好的抽象承认复杂性的存在，但在需要的时候让你看穿它。HTTP 有 DevTools，Agent API 有 Events。

所以 Agent API 吃掉 Model API 不是一夜之间的事。它需要模型变得更可靠（减少幻觉）、平台变得更可观测（Events + 审计）、行业建立新的质量标准（类似 HTTP 状态码的"Agent 完成度"指标）。但方向是清晰的，而 Anthropic 的 Managed Agents 可能是目前走得最远的一个实现。

## 回到 Bitter Lesson

Context anxiety 的故事值得最后再看一眼，因为它揭示了一条在 AI 基础设施领域几乎无人谈论的规律：

**模型能力的提升会让应用变好，也会让基础设施中编码的假设过时。**

传统软件的基础设施假设（TCP 不可靠、磁盘比内存慢、网络有延迟）在几十年的时间尺度上都是稳定的。但 AI 基础设施的假设（模型不能多步推理、模型需要外部记忆、模型会幻觉）在几个月的时间尺度上就可能过时。你的底层假设正在以前所未有的速度变成谎言。

Anthropic 选择了一条看似矛盾的路：在假设快速过时的领域里，构建一个设计为永久存续的系统。 他们的解法是操作系统范式，赌接口，不赌实现。 `read()` 不关心磁盘技术怎么变， `execute()` 不关心模型能力怎么变。

他们还在进攻。

如果前面关于自进化飞轮的分析是对的，如果 Brain-Hands 分离确实创造了一个正反馈循环，那么 Anthropic 的架构在"加速"模型进步。每一个在 Managed Agents 上运行的 Session，都在产生结构化的训练信号。模型变强了，Session 的质量提高了，训练数据变好了，模型进一步变强... 正反馈循环。

**Bitter Lesson 说利用计算的方法总是赢。Anthropic 在建一个让计算自我增值的系统。**

Unix 的 `read()` 诞生于 1970 年代。五十年后，它还在那里。

Anthropic 在赌 `execute(name, input) -> string` 能做到同样的事。

这是一个大胆的赌注，也是一个可能犯错的赌注。 `read()` 的持久性来自于"进程需要数据输入"这个几乎不可颠覆的基本需求；"Agent 通过字符串接口调用工具"未必有同等的持久性。如果 Agent 的交互模式发生范式变化，比如从离散调用变为连续环境感知，今天的三元抽象就会面临和 CORBA 一样的命运。

但逆向工程的发现摆在那里：Firecracker 快照恢复的工程深度，三种完全不同的产品跑在同一套基础设施上，三维设计空间的精妙权衡，自进化飞轮的战略纵深。这不是 PPT 架构。这是一个在运行的操作系统，已经在承载真实的工作负载，并且可能在用这些工作负载训练下一代模型。

**而大多数人还在争论哪个 Agent 框架更好。**

值得想清楚的是： **你在建的到底是应用，还是平台？** 因为 Bitter Lesson 告诉我们，应用层的假设会过期，但平台层的接口可以存活。而最好的平台，还会加速假设过期的速度。

## 给 Agent 开发者的三个自检问题

如果你正在建 Agent 产品，这篇文章的分析可以浓缩成三个值得问自己的问题：

![Agent 开发者自检：三个关键问题](redirect_9.webp)

Agent 开发者自检：三个关键问题

**1\. 你的代码里有多少行是在补偿模型的缺陷？**

把你的编排逻辑分成两类：业务逻辑编排（权限控制、数据验证、审计日志）和补偿性编排（因为模型不能 X 所以我用工程手段做 Y）。后者有保质期，而且保质期可能比你预期的短得多。如果你 60% 的代码是补偿性编排，你需要一个 Plan B。

**2\. 你的 Brain 和 Hands 是在同一个安全边界内吗？**

如果你的 Agent 推理和工具执行跑在同一个进程/容器里，你的安全模型依赖的是"工具输出都是可信的"这个假设。当你的 Agent 开始执行不受信任的代码、访问不受信任的网页、处理不受信任的用户输入时，这个假设会被打破。问问自己：如果一个工具返回了精心构造的 prompt injection，你的 Brain 会不会被污染？

**3\. 你在建的是应用，还是平台？**

如果你在建应用，确保你的核心价值不完全建立在"模型做不到 X"之上。如果你在建平台，确保你的接口不编码关于模型能力的假设。 `execute(name, input) -> string` 之所以可能持久，是因为它只假设 Agent 需要操作环境，不假设 Agent 需要什么样的帮助。

这三个问题没有标准答案。但如果你从来没有想过它们，现在是时候了。

---

我们正在基于这些洞察探索自己的 Agent 基础设施。如果你对"在内部落地一个 Agent OS"这个方向感兴趣，后续文章会详细展开我们的设计选择——哪些地方对齐了 Managed Agents 的思路，哪些地方基于我们的场景做了不同的判断。欢迎各位 AI Coding 爱好者加入"AI Coding 技术交流"，钉钉群号：165280029330。

---

**参考资料**

1. Anthropic Engineering, *"Scaling Managed Agents: Decoupling the brain from the hands"*, April 2026. [链接](https://www.anthropic.com/engineering/managed-agents)
2. Claude Managed Agents API Documentation. [链接](https://platform.claude.com/docs/en/managed-agents/overview)
3. Richard Sutton, *"The Bitter Lesson"*, 2019. [链接](https://www.incompleteideas.net/IncIdeas/BitterLesson.html)
4. Eric S. Raymond, *"The Art of Unix Programming"*, Chapter 3. [链接](https://www.catb.org/esr/writings/taoup/html/ch03s01.html)
5. Anthropic Engineering, *"Building effective agents"*. [链接](https://www.anthropic.com/engineering/building-effective-agents)
6. Anthropic Engineering, *"Effective harnesses for long-running agents"*. [链接](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
7. OpenAI, *"New tools for building agents"*, March 2025. [链接](https://openai.com/index/new-tools-for-building-agents/)

END

每一行 harness 代码都是一个会过期的赌注

拆开沙箱：PID 1 是 Rust，内核是 Firecracker

PID 1 不是 systemd

execute() 的真面目：近 20 种 WebSocket 消息

快照恢复：TTFT 优化的秘密

同一基础设施，三个完全不同的"应用程序"

一张完整的 OS 映射表

Session 的双重身份：为什么文件系统和进程不需要分开

Brain-Hands 分离是三维优化

安全：你的 Agent 框架可能在同一个进程里跑 Brain 和 Hands

速度：大量 tool call 根本不需要沙箱

成本：从"每 Session 一个 VM"到"按需分配"

在调用过程中加速自进化飞轮

每一次工具调用都是一条正反馈数据

分离使大规模离线自进化成为可能

Bitter Lesson 的自我加速

你的 Agent 框架是应用层，不是平台层

Agent API 的野心：让 Model API 成为实现细节

Model API 是 TCP，Agent API 是 HTTP

行业在集体往上走

Bitter Lesson 的第二层推论

回到 Bitter Lesson

给 Agent 开发者的三个自检问题

内部资料

INTERNAL

495838
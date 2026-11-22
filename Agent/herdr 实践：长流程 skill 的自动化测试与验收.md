---
title: "herdr 实践：长流程 skill 的自动化测试与验收"
source: "https://ata.atatech.org/articles/11020781693?spm=ata.23639746.0.0.452d5ee2t6qAPg"
author:
  - "[[郭志凯(萧竹)]]"
published:
created: 2026-10-14
description:
tags:
  - "clippings"
---
本文为内部分享文章，因实习生无 ATA 权限，代替进行发布

安装指引

macOS 可以通过官方脚本安装：

```curl
curl -fsSL https://herdr.dev/install.sh | sh
herdr
```

一键让agent学会herdr skill：

```https://github.com/herdrdev/herdr/tree/master/skills/herdr
https://github.com/herdrdev/herdr/tree/master/skills/herdr
```

## 1 为什么做这次实践

做这次实践的起因很直接：qodercli 提供了免费的 `Peach-07-17-DogFooding` 模型，适合承担耗时较长、交互轮次较多的测试任务。我们希望用它测试开发中的 skill，也希望在主 agent 忙于其他工作时，把一部分任务交给 qodercli 执行。

真正开始尝试后，问题很快从“能不能启动一个 qodercli”变成了“怎么让它稳定地完成测试”。长流程中会多次询问凭证、确认方案和等待后台任务；skill 又处在持续迭代中，每一轮测试都可能使用新版本；不同 harness 需要复用相同场景；多个测试并行时还要避免目录和运行状态互相污染。

| 遇到的问题 | 对测试的影响 | 这次的处理方式 |
| --- | --- | --- |
| 长流程需要多轮交互 | 单条提示词无法覆盖凭证、确认、进度和异常分支 | 用 herdr 保持同一个 qodercli 会话，循环执行“派活、等待、读取、判断、继续” |
| skill 版本持续变化 | 每次修改后重新安装成本高，也容易污染全局环境 | 源码阶段使用 workspace scope 的 `skills link`，交付阶段覆盖解压目录并重跑 `install.sh` |
| 需要比较不同 harness | 测试流程和验收标准容易随工具变化 | 由 herdr 统一 pane、状态和输入输出，只替换 `agent start --kind` 与启动参数 |
| 多个场景需要并发执行 | skill、任务状态和结果可能相互干扰 | 每个场景使用独立 workspace、pane、agent 名称和 `AGENTRL_HOME` |

具体实现分在三个位置。herdr 管理 agent 进程和交互，qodercli 的 workspace scope 管理待测 skill，测试 workflow 拆分长流程并验收每个阶段。

## 2 为什么选择 herdr

### 2.1 tmux 先解决了会话持久化

tmux（Terminal Multiplexer，终端复用器）采用 client-server 架构：server 常驻后台并持有终端会话，终端窗口仅作为客户端视图。因此，关闭窗口或 SSH 断线不会中断会话内的进程，通过 `tmux attach` 可以恢复原来的终端现场。tmux 使用“会话 → 窗口 → 窗格”三层结构，在一个终端中组织多个并行任务。

graph LR A\["终端窗口 1"\] -->|"attach（会话保持存活）"| S\["tmux server\<br/>后台常驻"\] B\["终端窗口 2"\] -->|"attach（随时恢复连接）"| S S --- C\["会话 → 窗口 → 窗格"\] C --- P1\["vim"\] C --- P2\["Agent"\] C --- P3\["shell"\]

![](13351b13-b2b2-4eea-a954-c54677325de7.png)
- 会话（session）：独立工作环境，也是 detach/attach 的单位。
- 窗口（window）：类似标签页，用于按任务组织窗格。
- 窗格（pane）：独立伪终端，用于并排运行命令和进程。

### 2.2 herdr 补上 agent 识别与控制

tmux 已经解决了终端会话断连和多任务分屏的问题，但它并不知道 pane 中运行的是普通命令还是 agent，也无法判断 agent 正在执行、等待确认还是已经完成。herdr 在终端复用能力上增加了 agent 识别，并把状态、输入输出和管理命令开放给人、脚本或其他 agent。

herdr 在保留终端会话持久化和分屏能力的基础上，增加了面向 agent 的识别、状态感知和自动化控制：

- agent 原生识别与状态感知：识别 codex、claude、qodercli 等 agent CLI，并判断 working、blocked、done、idle 等生命周期状态，将 workspace 中的 agent 状态汇总到侧边栏，便于快速定位。
- CLI 自动化控制：herdr CLI 通过 session 的本地 socket 与控制面通信，可以创建 pane、启动 agent、发送任务、读取输出和等待状态。未指定 session 时操作 `default`，跨 session 时使用 `--session <name>`。
- 鼠标与键盘交互：支持点击聚焦、拖拽分屏和拖选复制，也可以使用 `Ctrl+B` 前缀键操作。

graph TD T\["终端窗口"\] -->|"attach / detach"| S\["会话 session（持久化单位）"\] S --> W1\["工作区 workspace"\] S --> W2\["工作区 workspace"\] W1 --> T1\["标签页 tab 1"\] W1 --> T2\["标签页 tab 2"\] T1 --> P1\["窗格 pane"\] T1 --> P2\["窗格 pane"\] T2 --> P3\["窗格 pane"\] P1 --> A1\["agent A\<br/>working"\] P2 --> A2\["agent B\<br/>blocked"\] P3 --> A3\["agent C\<br/>idle"\]

### 2.3 本次采用子 agent 编排

herdr 可以承载三种常见的控制关系。本次需要由一个控制 agent 推进测试并处理过程中的分支，因此采用子 agent 编排。

![](692941c4-0798-4c69-87d8-1db1918ed6ee.png)
- 子 agent 编排模式：由控制 agent 统一调度一个或多个子 agent，通过 herdr 发送任务、等待状态并读取终端输出；长结果也可以写入共享目录交付。
- 多 agent 协作模式：不设置固定的控制 agent，任意 agent 都可以向其他 agent 发起任务、读取输出和等待状态，请求仍由 herdr 控制面中转。
- 多 agent 管理模式：人通过 TUI 或 CLI 观察所有 agent，只在 blocked、异常或验收阶段介入。
![](99892314-0b43-479a-8314-b299f0f81f13.png)

三种方式的控制请求都经过 herdr 控制面中转，agent 之间不直接读取彼此的终端。结果可以通过 `read` 获取终端输出，也可以在内容较长时写入共享目录，图中统一标为“共享目录 / 读屏显示”。

### 2.4 让 agent 学会调用 herdr

herdr 提供 ，说明如何创建和拆分 pane、启动 agent、发送任务、读取输出以及等待状态。

```#
# -g 为全局安装；省略则安装到当前项目
npx skills add herdrdev/herdr --skill herdr -g

# 输出与当前 herdr 版本匹配的内置副本
herdr --skill
```

官方 skill 默认检查 `HERDR_ENV=1`，确保 agent 在 herdr pane 中操作当前 session。该检查属于安全规则，不是 CLI 限制；外部脚本或 agent 也可以通过 `--session <name>` 操作指定 session。

### 2.5 适用场景

1. 长流程 Agent 任务：构建、测试和长对话可以在后台持续运行，detach/reattach 或连接中断不会影响 pane 内的进程；`--remote` 支持远端执行、本地观察。
2. 异构 harness：codex、qodercli、claude 等 Agent CLI 可以并排运行，由 herdr 统一识别并呈现状态，便于开展并行测试和横向对比。
3. 固定不同角色 Agent 协作：herdr 负责派发任务、读取输出和等待状态，具体编排逻辑由 Agent 或脚本实现。控制关系由任务约定决定，机制上不限制主从角色。
4. 人集中观察、按需介入：侧边栏跨 workspace 汇总 blocked、working、done 和 idle 状态，人只需处理等待确认、异常和结果验收。

## 3 怎么基于herdr控制一个子 agent

很多 agent harness 都提供内置 subagent，可以在当前任务中拆分工作、并行执行，再把结果交回控制 agent。基于 herdr 的子 agent 运行在独立 pane 中，实际启动 qodercli、codex、claude 等 CLI，并把进程、状态和终端输入输出交给 herdr 管理。

| 对比项 | 内置 subagent | 基于 herdr 的子 agent（更灵活） |
| --- | --- | --- |
| 执行对象 | harness 内部创建的子任务 | 独立运行的真实 agent CLI 进程 |
| 模型与资源 | 受当前 harness 的 subagent 能力约束 | 每个 agent 可以单独选择 harness、模型和启动参数 |
| 过程观察 | 由 harness 提供任务状态和最终结果 | 可以读取 TUI、终端标题、工具输出和生命周期状态 |
| 交互控制 | 通过 harness 内部接口派发任务和回收结果 | 可用 `prompt`、`wait`、`read` 和 `send-keys` 处理多轮交互 |
| 生命周期 | 跟随当前任务及其内部调度 | 由 herdr server 持有，控制方断开后仍可继续运行 |
| 人工介入 | 介入方式取决于 harness | 人可以 attach 到 pane，直接查看和操作现场 |
| 环境隔离 | 由 harness 决定 | 可以为每个 pane 设置独立 cwd、skill 和运行状态目录 |

在 skill 测试中，这些差异直接影响测试范围、模型资源、长任务执行、过程介入和并发隔离。

- 测试的是真实 qodercli：workspace skill 的发现、TUI 启动、权限确认、`agent_prompt_stalled` 和会话恢复都会进入测试范围。内置 subagent 无法替代这些 CLI 级行为验证。
- 控制 agent 与执行模型解耦：控制 agent 负责编排和验收，长时间执行交给免费的 `Peach-07-17-DogFooding`，不会持续占用控制 agent 的模型调用。
- 长任务不会被一次调用的超时截断：`prompt --wait` 超时后，qodercli 仍在 pane 中继续执行；控制 agent 可以稍后通过 `agent get` 和 `agent read` 接着观察。
- 过程可观察、可干预：blocked 时可以查看具体提示并发送按键，生成卡住时可以发送 `esc`，必要时人可以直接 attach 到现场。
- 异构和并发使用同一套接口：切换 qodercli、codex 等 harness 时仍使用相同的 herdr 命令；并发场景可以分别设置 pane、cwd、skill 和 `AGENTRL_HOME`。

内置 subagent 更适合在单一 harness 内完成代码搜索、审查和结果汇总。这里关注真实 CLI 的 skill 加载、长流程执行和多轮交互，因此后续采用基于 herdr 的子 agent。

### 3.1 创建、启动、派活与回收

控制 agent 先创建 pane 并启动子 agent，再发送任务，最后根据状态读取结果或处理交互。

%%{init: {'theme': 'neutral', 'themeVariables': {'fontSize': '16px'}}}%%sequenceDiagram participant S as "控制 agent（pane w1:p1）" participant H as "herdr CLI" participant T as "子 agent tester（pane w1:p3）" S->>H: ① pane split --no-focus H-->>S: 返回新 pane id S->>H: ② agent start tester --kind qodercli H->>T: 启动 qodercli，确认就绪后返回 S->>H: ③ agent prompt "跑一遍测试流程" --wait H->>T: 发送任务 T-->>H: 状态变化为 idle、done 或 blocked H-->>S: 返回当前状态 alt blocked：需要输入或确认 S->>H: ④ agent read + agent send-keys else idle/done：本轮结束 S->>H: ④ agent read + 独立验收 end

下面的命令串起了图中的完整流程：

```split=$(herdr
split=$(herdr pane split --current --direction right --cwd "$PWD" --no-focus)
pane_id=$(printf '%s\n' "$split" | jq -r '.result.pane.pane_id')

herdr agent start tester --kind qodercli --pane "$pane_id" --timeout 90000 \
  -- --yolo -m Peach-07-17-DogFooding

herdr agent prompt tester "安装这个 skill，跑一遍测试流程" \
  --wait --timeout 120000

herdr agent read tester --source recent-unwrapped --lines 120
```

pane id 应从创建命令的 JSON 结果中读取。`agent start` 要求目标 pane 已停在 shell 提示符，成功返回表示 agent 已被识别并可以接收输入。遇到 blocked 时，先用 `agent read --source visible` 查看界面，再通过 `agent send-keys` 处理确认。

### 3.2 启动方式与 qodercli 会话

herdr 既能识别人手动启动的 agent，也能通过 `agent start` 程序化启动：

| 启动方式 | 使用方式 | 主要区别 |
| --- | --- | --- |
| 手动启动 | 在 pane 中直接执行 `qodercli`、`codex` 或 `claude` | 启动命令不等待就绪，默认通过 pane id 定位，可再用 `agent rename` 命名 |
| 程序化启动 | 调用 `herdr agent start` | 启动时命名，并在识别成功且可以接收输入后返回 |

自动化测试采用程序化启动。qodercli 的模型和权限参数放在 `--` 后透传；`--yolo` 可以减少执行期间的权限确认：

```qodercli
qodercli --list-models
```

### 3.3 等待、观察与读取结果

`agent get` 和 `agent list` 返回结构化状态，常用字段包括：

- `agent_status`：working、idle、done、blocked 或 unknown。
- `state_change_seq`：状态变化序号，用于判断 agent 是否继续活动。
- `terminal_title_stripped`：当前任务标题。
- `agent_session.value`：原生 session id。
- `cwd`：当前工作目录。

`agent prompt --wait` 会在发送任务后阻塞，默认等待 idle、done 或 blocked。`--wait` 不是必需项；不需要同步等待时可以直接发送 prompt，再按需查询：

```herdr
herdr agent prompt tester "安装这个 skill，跑一遍测试流程"
herdr agent get tester
herdr agent read tester --source recent-unwrapped --lines 120
```

自动化场景建议设置 `--timeout`。等待命令没有默认超时；达到超时时间后，只结束 CLI 等待，pane 中的 agent 仍会继续执行。需要单独等待特定状态时使用：

```herdr
herdr agent wait tester \
  --until done \
  --until blocked \
  --timeout 120000
```

人可以通过 herdr TUI 实时查看侧边栏和 pane。控制 agent 可以重复调用 `agent get` 和 `agent read` 获取最新快照；`agent wait` 只等待状态变化，不提供逐行日志流。

`agent read` 支持不同读取范围：

| source | 内容 | 适用场景 |
| --- | --- | --- |
| `visible` | 当前可见视口 | 查看确认框、提问和当前错误 |
| `recent` | 最近输出和回滚内容 | 查看近期多轮交互 |
| `recent-unwrapped` | 将终端折行恢复为连续文本 | grep、解析和提取结果 |
| `detection` | 状态检测器读取的底部区域 | 排查状态识别错误 |

部分 TUI 会折叠较长的工具输出，可以通过 `agent send-keys tester ctrl+o` 展开后重新读取。完整报告应让子 agent 写入文件，只在回复中返回文件路径。

## 4 怎么让 skill 版本随改随测

herdr 解决了 agent 的控制问题，接下来要让待测 skill 稳定进入子 agent。开发期间 skill 会频繁修改，测试又不能影响用户已经安装的版本，因此 skill 文件和运行状态需要分别隔离。

![](d34ee0e9-e1a8-47d1-9bf6-96d8aa9205f6.png)

### 4.1 用 workspace scope 隔离待测 skill

Qoder CLI 的通用配置分为个人、项目和本地三个范围；Skills CLI 没有完全照搬这三个名称，`skills link/install --scope` 只提供 `user` 和 `workspace`。其中 `workspace` 对应文档里的项目级 Skill。

| Skills CLI scope | 存储位置 | 生效范围 | 适用场景 |
| --- | --- | --- | --- |
| `user` | `~/.qoder/skills/` | 当前用户的所有项目；也是 CLI 默认值 | 长期使用的个人 skill |
| `workspace` | `<项目>/.qoder/skills/` | 仅当前项目 | 项目共享 skill，或放在临时 workspace 中做隔离测试 |

配置文档中的“本地”指 `<项目>/.qoder/settings.local.json`，只用于当前机器的项目配置。Skills CLI 没有对应的 `local` scope。测试时可以把 workspace 建在临时目录中，达到仅本机、仅本轮测试可见的效果。

每轮测试都使用独立临时目录和 `--scope workspace`，待测 skill 不会写入用户级目录。同名的用户级 Skill 会覆盖项目级 Skill，因此测试前需要确认 `~/.qoder/skills/` 中没有同名版本。整个测试过程没有生成全局 `~/.qoder/skills`。

确定 scope 后，再选择装载动作：

| 动作 | qodercli 的处理 | 源目录更新后 |
| --- | --- | --- |
| `skills link` | 创建指向本地源目录的符号链接 | 立即生效，无需重新安装 |
| `skills install` | 把本地目录、Git 仓库、zip 或 `.skill` 包复制到指定 scope | 不会自动更新，需要重新安装 |

这里使用的是 `skills link --scope workspace`，没有使用 `skills install`。源码测试时，link 直接指向开发目录，修改 SKILL.md 后可以马上开始下一轮：

```cd
cd /tmp/skilltest
qodercli skills link /path/to/skill --scope workspace --consent
```

二进制交付测试也使用 link，但需要先解压制品并运行 `install.sh`，生成 SKILL.md 约定调用的二进制 shim，然后把解压目录 link 到当前 workspace。完整命令见 4.3。

测试完成后，从当前 workspace 卸载：

```qodercli
qodercli skills uninstall <name> --scope workspace
```

单独使用 `--config-dir <tmp>` 时，凭证文件受系统级保护，复制后的配置无法登录。因此这里沿用原有登录配置，只用 workspace scope 隔离 skill。安装结果可以在相同 cwd 中通过 `qodercli skills list` 检查。

### 4.2 用 AGENTRL\_HOME 隔离运行状态

workspace scope 只隔离 skill 文件。agentrl-image 运行时还会生成任务数据库、缓存、凭证、workflow 和运行记录，默认写入 `~/.agentrl/`。多轮或并发测试共用该目录时，前一轮数据会影响下一轮，schema 变化也可能导致旧数据无法读取。

agentrl-image 通过 `AGENTRL_HOME` 切换全部运行时状态目录：

```export
export AGENTRL_HOME=/tmp/skilltest-xxx/.agentrl
```

| 路径 | 用途 |
| --- | --- |
| `$AGENTRL_HOME/tasks.db` | 任务数据库 |
| `$AGENTRL_HOME/specs/` | 生成的 spec YAML |
| `$AGENTRL_HOME/credentials.env` | 凭证文件 |
| `$AGENTRL_HOME/task-specs/` | 持久化的 task spec |
| `$AGENTRL_HOME/workflows/` | workflow 定义 |
| `$AGENTRL_HOME/runs/<task-id>/` | 运行历史 |
| `$AGENTRL_HOME/inspect-cache/` | 镜像 inspect 缓存 |
| `$AGENTRL_HOME/eip-pool.yaml` | EIP 池状态 |

启动 agent 前，在目标 pane 中设置环境变量：

```herdr
herdr pane run w1:p3 "export AGENTRL_HOME=$PWD/.agentrl"
herdr agent start tester --kind qodercli --pane w1:p3 --timeout 90000 \
  -- --yolo -m Peach-07-17-DogFooding
```

测试完成后卸载 workspace skill 并清理临时目录，即可同时移除 skill 文件和运行状态。不设置 `AGENTRL_HOME` 时仍回退到 `~/.agentrl`。

### 4.3 源码与二进制使用不同更新方式

源码开发阶段使用 `skills link`。符号链接指向开发目录，修改 SKILL.md 后无需重新安装，直接启动下一轮测试即可。

客户实际接收的是去除源码的二进制 zip，因此交付测试需要执行完整的打包、安装和装载过程。打包脚本先执行测试门控，再通过 PyInstaller onedir 生成二进制目录、剔除源码并产出单层目录 zip：

```#
# 1. 开发侧打包：自测只构建 darwin-arm64
cd /Users/yuanxun/rl/image-tools
./scripts/pack-binary-release.sh --skip-docker

# 2. 客户侧安装：解压并生成平台 shim
mkdir -p /tmp/skilltest-xxx && cd /tmp/skilltest-xxx
unzip -qo .../pack/agentrl-image-<version>-<ts>.zip
( cd agentrl-image && bash install.sh )

# 3. 装入 qodercli 的 workspace scope
qodercli skills link /tmp/skilltest-xxx/agentrl-image --scope workspace --consent
qodercli skills list
```

安装顺序和启动目录会直接影响 skill 是否可用：

- 先执行 `install.sh`，再执行 `skills link`。`install.sh` 会探测平台、校验 sha256，并生成 `.venv/bin/agentrl-image` shim。
- qodercli 必须以临时 workspace 为 cwd 启动，否则看不到该目录下的 workspace skill。
- 安装后可以观察 qodercli TUI 的 skill 计数。测试时计数从 16 增加到 17；transcript 中还会出现 `Skill "agentrl-image" activated`，可以确认任务确实调用了 skill。

更新二进制包时，可以覆盖 link 指向的解压目录并重新运行 `install.sh`。测试结束后执行：

```qodercli
qodercli skills uninstall agentrl-image --scope workspace
```

### 4.4 一轮 skill 测试怎么跑

skill 装载和卸载由主 agent 在 workspace 中执行，待测任务交给 qodercli 子 agent：

```herdr
herdr agent start skill-demo --kind qodercli --pane w1:p4 --timeout 90000 \
  -- --yolo -m Peach-07-17-DogFooding

herdr agent prompt skill-demo \
  "用 agentrl-image 完成测试，完整产物写到 /tmp/skilltest/ 下" \
  --wait --timeout 120000
```

验收分三步：先用 `qodercli skills list` 或 TUI skill 计数确认 skill 已装载，再从 transcript 中确认 skill 被激活，最后独立检查任务产物。启动后的第一条 prompt 偶尔会返回 `agent_prompt_stalled`；确认输入没有生效后原样重发。

此处为语雀视频卡片，点击链接查看： [录屏2026-08-10-13.48.42.mov](https://aliyuque.antfin.com/tm41gb/tn6nll/xuoiplw1c5gf0ze1#AzYxW)

## 5 怎么组织长流程和多个测试场景

单个 agent 能稳定收发任务后，测试还会遇到长时间执行、切换 harness 和多个场景并发的问题。下面分别说明任务推进、测试协议和环境隔离。

### 5.1 长流程按阶段推进

长流程 skill 通常会经历多次提问、确认和长时间执行。固定提示词无法覆盖这些分支，因此主 agent 每轮只推进一个明确阶段：

1. 向子 agent 派发当前阶段任务。
2. 等待 idle、done 或 blocked。
3. 读取状态和终端输出。
4. 根据凭证、确认、异常或完成状态选择下一步。
5. 独立验收当前阶段产物，通过后再进入下一阶段。

短任务可以使用一次 `agent prompt --wait` 等待结束。同步和构建等长任务可能超过等待超时；超时只表示本次 CLI 等待结束，子 agent 仍在后台运行。此时不要重复发送同一任务，应改用：

```herdr
herdr agent get tester
herdr agent read tester --source recent-unwrapped --lines 120
```

`agent_status` 用于判断当前分支，`state_change_seq` 用于判断两次观察之间是否发生变化。子 agent blocked 时读取界面并发送明确回应；模型生成长时间不推进时发送 `esc`，回到 idle 后再重新派发当前步骤。

### 5.2 不同 harness 复用同一套测试协议

herdr 将 codex、qodercli、claude 等 harness 统一为 pane 和 agent 命令。横向测试时保持任务输入、测试数据和验收规则不变，只调整以下部分：

| 变量 | 示例 |
| --- | --- |
| agent 类型 | `--kind codex`、`--kind qodercli`、`--kind claude` |
| 模型参数 | `-- -m <model>` |
| 权限模式 | qodercli 的 `--yolo`，或其他 harness 对应的授权参数 |
| skill 装载方式 | 各 harness 的 workspace/project scope |
| integration | 按需上报原生 session identity；状态能力以该 harness 的检测规则为准 |

横向比较时记录 skill 是否激活、完成率、交互轮次、blocked 次数、错误归因、总耗时和独立验收结果。任务输入、测试数据和验收规则保持一致，避免把模型、权限策略和环境差异混在一起。

本文完成的是 qodercli 路径。codex 在 herdr 中使用相同的启动、派活和读取流程，但尚未用同一批 agentrl-image 场景完成横向评分，因此目前不能给出哪个 harness 效果更好的结论。

### 5.3 并发场景各自隔离

并发测试可以让一个主 agent 同时管理多个子 agent，但每个场景需要独立持有以下资源：

- workspace 或临时工作目录；
- pane 和唯一 agent 名称；
- workspace scope 的 skill 安装；
- `AGENTRL_HOME`；
- 输入数据副本和结果目录；
- 必要时使用独立的 herdr 命名 session。

例如，两个场景分别使用 `case-a` 和 `case-b`：

```#
# 为两个场景创建独立 pane；实际 pane id 从 JSON 返回值读取
herdr pane split --current --direction right --cwd /tmp/case-a --no-focus
herdr pane split --current --direction down  --cwd /tmp/case-b --no-focus

# 分别设置运行目录
herdr pane run <pane-a> "export AGENTRL_HOME=/tmp/case-a/.agentrl"
herdr pane run <pane-b> "export AGENTRL_HOME=/tmp/case-b/.agentrl"

# 使用唯一名称启动
herdr agent start case-a --kind qodercli --pane <pane-a> -- --yolo -m Peach-07-17-DogFooding
herdr agent start case-b --kind qodercli --pane <pane-b> -- --yolo -m Peach-07-17-DogFooding
```

主 agent 分别调用 `agent wait` 或 `agent get`，哪个场景先 blocked 就先处理哪个，哪个场景完成就先验收哪个。并发数还需要结合模型服务限流、集群容量和外部 API 配额控制。本文给出了隔离与调度方法，尚未给出最大并发数。

## 6 实际效果：agentrl-image 全链路测试

前面的做法最终需要用真实任务检验。正式交给控制 agent 编排前，先由人按客户使用方式完整操作一遍，记录每个阶段的输入、agent 提问、人工确认、异常处理和验收信号，再把这条问答轨迹整理成 SOP。控制 agent 参考 SOP 判断当前处于哪个阶段、哪些信息需要补充、什么条件满足后才能继续，但仍根据子 agent 的实际输出选择下一步，不照搬固定话术。

完成基线梳理后，再由控制 agent 通过 herdr 驱动 qodercli，安装二进制 skill，并依次执行 agentrl-image 的四个业务环节。

### 6.1 测试对象与基本约束

agentrl-image 是镜像编排 skill，对客使用去除源码的二进制包交付。测试从 SWE-Lego-Real-Data 中随机抽取 60 个 task，覆盖数据集分析、标准化、镜像同步和镜像构建。

%%{init: {'theme': 'neutral', 'themeVariables': {'fontSize': '18px'}}}%%flowchart LR A\["① 数据集分析\<br/>格式识别 镜像清单推导"\] --> B\["② 数据集标准化\<br/>Harbor 任务目录 + 门控"\] B --> C\["③ 镜像同步\<br/>Docker Hub 到 ACR"\] C --> D\["④ 镜像构建\<br/>ACS buildah 分片"\] style A fill:#eef2f7,stroke:#5b7a9d style B fill:#eef2f7,stroke:#5b7a9d style C fill:#eef2f7,stroke:#5b7a9d style D fill:#eef2f7,stroke:#5b7a9d

人工跑通后，将问答轨迹、阶段门控和验收方法写入 SOP，供控制 agent 判断当前阶段和继续条件。自动执行时还要遵守以下边界。

- 不预设完整对话脚本：SOP 定义阶段、分支和通过条件，不固定每轮提示词；控制 agent 根据子 agent 的实际输出决定下一条指令。
- 凭证只写入 env 文件：子 agent 需要凭证时必须主动询问，控制 agent 将凭证写入对应文件，仅回复“凭证已填写，不要显式传输”。
- 确认前先核对方案：子 agent 给出字段映射、spec、plan 或构建方案后，控制 agent 核对 bucket、命名空间、分片数、资源配额和抽样范围，再决定是否继续。

### 6.2 把全链路拆成可验收的阶段

整条链路包含安装和四个业务阶段。每一段都定义入口条件、交互点和独立验收，当前阶段通过后才进入下一阶段。

%%{init: {'theme': 'neutral', 'themeVariables': {'fontSize': '17px'}}}%%flowchart TD S0\["安装\<br/>二进制解压 install.sh"\] --> V0{"验收：skill 计数 16 到 17\<br/>--help 正常"} V0 --> S1\["① 分析\<br/>格式识别 镜像清单推导"\] S1 --> V1{"验收：report.json 落盘\<br/>归类与清单抽查"} V1 --> S2\["② 标准化\<br/>映射确认 60 任务包 门控"\] S2 --> V2{"验收：validate-harbor\<br/>60/60 通过"} V2 --> S3\["③ 同步\<br/>spec 确认 慢启动 地址回写"\] S3 --> V3{"验收：ACR OpenAPI 比对\<br/>60/60 入库"} V3 --> S4\["④ 构建\<br/>形态切换 buildah 分片"\] S4 --> V4{"验收：ACR 比对 60/60\<br/>verify ready=true"} style S0 fill:#eef2f7,stroke:#5b7a9d style S1 fill:#eef2f7,stroke:#5b7a9d style S2 fill:#eef2f7,stroke:#5b7a9d style S3 fill:#eef2f7,stroke:#5b7a9d style S4 fill:#eef2f7,stroke:#5b7a9d style V0 fill:#e8f3ec,stroke:#2f9e63 style V1 fill:#e8f3ec,stroke:#2f9e63 style V2 fill:#e8f3ec,stroke:#2f9e63 style V3 fill:#e8f3ec,stroke:#2f9e63 style V4 fill:#e8f3ec,stroke:#2f9e63

skill 自带的 `validate-harbor`、`spec validate` 和 `build verify` 直接作为阶段门控。门控失败时停止推进并处理问题，避免错误进入后续长任务。

分析和标准化是分钟级任务，可以使用 `prompt --wait`。同步和构建可能持续几十分钟，超过等待超时后切换到 `agent get` 和 `agent read` 观察进度。

### 6.3 根据子 agent 的状态继续推进

控制 agent 每次派发任务后读取状态和输出，再决定补充凭证、确认方案、处理异常或验收结果。

%%{init: {'theme': 'neutral', 'themeVariables': {'fontSize': '17px'}}}%%flowchart TD P\["agent prompt 派活 --wait"\] --> R\["agent read 读输出"\] R --> J{"子 agent 停在什么状态"} J -->|"询问凭证"| F\["填写 env 文件，回复凭证已填"\] J -->|"请求确认 spec/plan"| C\["核对后确认或要求修改"\] J -->|"报错或卡住"| D\["独立查集群、API 和日志，再给指令"\] J -->|"任务完成"| V\["独立验收产物"\] F --> P C --> P D --> P style P fill:#eef2f7,stroke:#5b7a9d style R fill:#eef2f7,stroke:#5b7a9d style V fill:#e8f3ec,stroke:#2f9e63

1. 询问凭证：子 agent 应主动询问，控制 agent 只把必要凭证写入 env 文件。测试中，子 agent 识别出 `cr_temp_user` 是临时令牌，拒绝直接开始长任务，并要求更换固定密码。
2. 请求方案确认：控制 agent 检查字段映射、同步 spec、执行计划和构建形态，确认正确后再继续。
3. 进度或卡住：通过 `agent_status`、`state_change_seq` 和终端输出判断任务是否推进。模型生成卡住时发送 `esc`，回到 idle 后重发当前步骤。
4. 报错：控制 agent 独立检查集群、API 和 Pod 日志，再向子 agent 提供更准确的原因和下一步动作。

长结果统一写入文件。分析报告、门控输出等产物由子 agent 落盘，控制 agent 直接读取文件验收，不依赖终端回滚。

### 6.4 跑出来的结果

测试覆盖了多轮交互、二进制安装、skill 激活、四阶段执行和独立验收。全链路开始前，先用口令记忆、累加计数器和历史任务回忆做了 10 轮递进交互；上下文与状态流转正常，恢复会话后仍能回答早期信息，10 轮后 ctx 使用量为 2%。业务结果见下表。

| 环节 | 关键动作 | 结果 |
| --- | --- | --- |
| 安装 | 解压二进制 zip，`install.sh` 生成 shim，workspace scope 装载 | skill 计数从 16 增加到 17，`--help` 正常 |
| ① 分析 | 读取 parquet，识别格式，推导镜像清单 | 18036 个实例均存在 Docker Hub 预构建镜像，架构为 x86\_64 |
| ② 标准化 | 制定字段映射，组装 60 个任务包，执行 `validate-harbor` | 60/60 通过，0 个错误，120 个警告均不阻断 |
| ③ 同步 | 生成 spec，执行集群预检，按 1→3→6→10 慢启动 | 60/60 进入 ACR，task.toml 回写 ACR 地址 |
| ④ 构建 | 切换构建形态，通过 OSS 分发上下文，执行 buildah 分片 | 60 个镜像进入构建和推送流程 |

标准化阶段，子 agent 先读取参照文档并抽样检查字段模式，再提交映射方案等待确认；门控产生 W007 警告后，子 agent 逐项解释了警告不阻断的依据，其中引用的 `python3` 镜像在目标环境中必然存在。这些 transcript 记录可以证明任务调用了 skill 中的流程，而非绕开 skill 自行处理。

## 7 展望：用 LLM as Judge 实时评测 skill

现有流程能驱动 agent 并检查最终产物，下一步是在每个 workflow 阶段结束、进入 blocked 或发生异常时，引入独立的 Judge agent 进行评分。

herdr 提供状态变化和 transcript，任务目录提供产物，集群或 Registry API 提供外部结果。脚本先检查文件、门控和数量等确定性事实；LLM 再评价流程是否符合 skill、交互是否清楚、错误归因是否合理。LLM 评分不能替代确定性检查。

%%{init: {'theme': 'neutral', 'themeVariables': {'fontSize': '16px'}}}%%flowchart LR A\["被测 agent\<br/>执行 skill"\] --> C\["采集证据\<br/>状态 transcript 产物"\] C --> R\["脚本检查\<br/>门控与外部结果"\] C --> J\["LLM Judge\<br/>流程与交互评分"\] R --> D{"继续 / 重试\<br/>人工介入 / 停止"} J --> D style A fill:#eef2f7,stroke:#5b7a9d style C fill:#eef2f7,stroke:#5b7a9d style R fill:#e8f3ec,stroke:#2f9e63 style J fill:#e8f3ec,stroke:#2f9e63 style D fill:#fff4dd,stroke:#d99a2b

评分使用固定 rubric，并保存分数、理由和证据位置。不同 harness 使用相同任务、初始环境和验收规则；Judge 与被测 agent 使用不同模型，关键失败仍交给人工复核。

落地时先回放已有 transcript，与人工结论校准；评分稳定后接入阶段门控，先只记录结果，再逐步用于继续、重试、人工介入或停止等实时决策。

中
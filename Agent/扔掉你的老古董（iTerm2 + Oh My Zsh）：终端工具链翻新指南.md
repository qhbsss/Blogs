---
title: "扔掉你的老古董（iTerm2 + Oh My Zsh）：终端工具链翻新指南"
source: "https://ata.atatech.org/articles/12020601374?spm=ata.23639420.0.0.1552753627PeGd"
author:
published:
created: 2026-05-02
description:
tags:
  - "clippings"
---
蚂蚁集团





AI 辅助创作

收录于专题







Claude Code 用多了之后，写代码、看文件、查日志、提交 Git 这些事基本都在终端里完成了。IDEA 越来越像一个只在CR时才打开的重型武器。
既然终端变成了主战场，那用了多年的 iTerm2 + Oh My Zsh 就显得寒碜了。不是它们不好，是新工具实在太香。
推荐下面5 个工具，每个都是"用了就回不去"级别的。

| 工具 | 一句话 | 替代 |
| --- | --- | --- |
| **Ghostty** | GPU 加速的现代终端模拟器，秒开、丝滑、省内存 | iTerm2 |
| **Starship** | 彩虹色命令提示符，显示 Git/语言版本/耗时 | Oh My Zsh + Powerlevel10k |
| **Lazygit** | 终端里的 Git 可视化操作界面，直接看 diff | git 命令行 / IDEA Git |
| **Yazi** | 终端文件管理器，直接预览文件如 Markdown | ls + cd + Finder |
| **Zoxide** | 智能目录跳转，打几个字母就到目的地 | cd 命令 |

### 懒人安装：复制这段 Prompt 给 Claude Code

如果你也在用 Claude Code（或者任何 AI 编码助手），直接把下面这段话丢给它：

> 帮我安装以下终端工具并完成配置：
>
> 1. Ghostty（终端模拟器）—— brew cask 安装，配置 Catppuccin Mocha 主题
> 2. Starship（命令提示符）—— brew 安装，应用 gruvbox-rainbow preset，配置到 zshrc
> 3. Lazygit（Git TUI）—— brew 安装即可
> 4. Yazi（文件管理器）—— brew 安装，附带 ffmpegthumbnailer 和 poppler
> 5. Zoxide（智能 cd）—— brew 安装，配置到 zshrc，用 --cmd cd 替换原生 cd
> 6. JetBrainsMono Nerd Font —— brew cask 安装，配置到终端字体
> 7. 卸载 Oh My Zsh，zshrc 中补上 history 和 completion 基础配置
>
> 我用的终端是 Ghostty（如果还没装就先装），shell 是 zsh。

五分钟后你就有一个全新的终端环境了。是的，连装工具这件事本身都可以让 AI 代劳。

下面是每个工具的详细介绍，感兴趣的继续往下看。

---

## 1\. Ghostty —— 终端模拟器该换代了

**替代对象** ：iTerm2 / Terminal.app

### 为什么换？

iTerm2 是 macOS 上的终端标杆，用了好多年，但它有个问题—— **慢** 。打开一个新窗口能明显感觉到延迟，分屏多了之后更明显。另外它是 Objective-C 写的老项目，维护节奏越来越慢。

Ghostty 是 Zig 写的 GPU 加速终端，作者是 HashiCorp 的联合创始人 Mitchell Hashimoto。对，就是做 Terraform、Vagrant 那位。他从 HashiCorp 离职后全职写了这个终端。

### 体感差异

- **启动速度** ：秒开。不是"快了一点"，是"按下图标就出现"
- **渲染** ：GPU 加速，滚动大量日志输出丝滑如德芙
- **配置** ：一个纯文本文件搞定，不用在 GUI 里点来点去
- **内存** ：开 10 个 tab 占用比 iTerm2 开 3 个还少

### 安装

brew install --cask ghostty

### 我的配置（~/.config/ghostty/config）

theme = Catppuccin Mocha
font-family = JetBrainsMono Nerd Font
font-size = 14
font-thicken = true
adjust-cell-height = 20%

# 背景图 —— 对，终端也能设壁纸
background-image = ~/Documents/照片/zen.jpg
background-image-fit = cover
background-image-opacity = 0.5

window-padding-x = 12
window-padding-y = 8
macos-titlebar-style = tabs
cursor-style = bar
cursor-style-blink = true
mouse-hide-while-typing = true
copy-on-select = clipboard

### 小技巧

- `Cmd+D` 水平分屏， `Cmd+Shift+D` 垂直分屏，跟 iTerm2 一样的快捷键
- 配置文件改了 **自动热加载** ，不用重启终端
- 原生支持 Nerd Font，图标显示完美

---

## 2\. Starship —— 彩虹色的命令提示符

**替代对象** ：Oh My Zsh + Powerlevel10k

### 为什么换？

Oh My Zsh 最大的问题是 **启动慢** 。 `source ~/.zshrc` 之后要等一两秒才能打字。Powerlevel10k 虽然做了 instant prompt 优化，但本质上还是在 Oh My Zsh 这个臃肿的框架上打补丁。

Starship 用 Rust 写的，单一二进制，不依赖任何 shell 框架。启动时间从"能感知"变成"测不出来"。

### 体感差异

- **启动** ：< 10ms，你根本感觉不到
- **跨 shell** ：zsh、bash、fish、PowerShell 通吃，同一份配置
- **信息密度** ：当前目录、Git 状态、语言版本、命令耗时，一行搞定
- **主题** ：内置十几种 preset，一条命令切换

### 安装

brew install starship

# 在 ~/.zshrc 末尾加上
eval "$(starship init zsh)"

### 选主题

Starship 内置了好几种 preset，我用的是 gruvbox-rainbow：

# 查看所有可用 preset
starship preset --list

# 直接应用（会覆盖现有配置）
starship preset gruvbox-rainbow -o ~/.config/starship.toml

可选的 preset 还有：

- `pastel-powerline` —— 柔和色彩，适合浅色背景
- `nerd-font-symbols` —— 图标流，信息通过图标传递
- `pure-preset` —— 极简风，只有目录和 Git
- `tokyo-night` —— 东京之夜配色，暗色系

👇🏻java目录，还会有个java小图标
![[Image 21.jpg]]

---

## 3\. Lazygit —— Git 操作从此告别命令行

**替代对象** ： `git add/commit/push/log/diff/stash/rebase...` 一堆命令 / IDEA Git 面板
有些简单的Git操作，打开IDE要吃掉2-4G的内存，每个项目都得开一个IDE窗口，但是Lazygit只要0.1秒启动，项目在终端直接切换。

### 安装

brew install lazygit

然后在任何 Git 仓库里输入 `lazygit` 就行。

### 核心功能

**五栏布局** ：

┌─ Status ─┬─ Files ──────┬─ Commits ─────────┐
│          │ M README.md  │ abc1234 fix: xxx  │
│ branch:  │ M src/app.ts │ def5678 feat: yyy │
│ master   │ ? new-file   │ ghi9012 docs: zzz │
├──────────┴──────────────┴───────────────────┤
│               Diff / Preview                 │
└──────────────────────────────────────────────┘

有一个特别实用的： **直接看 diff** 。在 commit 列表里上下移动，下方实时显示每个 commit 改了什么，语法高亮，上下文行数随时调。以前想看某个 commit 的改动要 `git show abc1234` ，输出一坨纯文本，看得眼花。现在光标移过去就行了。
![[Image 22.jpg]]
（不好意思背景有点花）

---

## 4\. Yazi —— 终端里的文件管理器

**替代对象** ： `ls` + `cd` + `cat` + `cp` + `mv` + Finder

### 为什么用？

你有没有这种体验：想找一个文件， `ls` 看一眼， `cd` 进去，再 `ls` ，再 `cd`...反反复复。或者用 Finder，但 Finder 预览要逐个打开，非常麻烦。

Yazi（日语"矢"的意思，取"快如箭矢"之意）是一个终端文件管理器，Rust 写的，异步加载，速度极快。它不是 `ranger` 的替代品——它是 ranger 该有的样子。

### 安装

brew install yazi ffmpegthumbnailer poppler
# ffmpegthumbnailer: 视频缩略图
# poppler: PDF 预览

然后输入 `yazi` 进入。

### 核心功能

**三栏 Miller Columns 布局** ：

┌─ 父目录 ──┬─ 当前目录 ────┬─ 预览 ─────────┐
│ workspace │ > src/       │ // app.ts     │
│ Documents │   package.json│ import xxx    │
│ Downloads │   README.md  │ from 'yyy'   │
│ .config   │   tsconfig   │ ...          │
└───────────┴──────────────┴────────────────┘

左边是父目录，中间是当前目录，右边是 **文件预览** 。对，直接在终端里预览：

- **代码文件** ：语法高亮，跟编辑器里看到的一样
- **Markdown** ：不是显示原始标记语法，是渲染后的效果——标题加粗、列表缩进、代码块高亮，光标移到.md 文件上就能看内容，不用打开任何编辑器
- **图片** ：终端内直接显示（Ghostty 支持图片协议）
- **PDF** ：文本预览
- **视频** ：显示缩略图

用 Claude Code 的同学应该有感觉：AI 帮你改了一堆文件，你想快速扫一眼改了什么。以前要么 `cat` 一个个看，要么打开 IDE。现在 `yazi` 进去，光标上下移动，右边实时预览，几秒钟就能把所有改动扫完。

![[Image 23.jpg]]
emmm还能预览图片，甚至视频
![[Image 24.jpg]]

### 日常操作

| 按键 | 操作 |
| --- | --- |
| `j/k` | 上下移动（vim 风格） |
| `l` / `Enter` | 进入目录 / 打开文件 |
| `h` | 返回上级 |
| `空格` | 选中文件（可多选） |
| `y` | 复制选中文件 |
| `x` | 剪切 |
| `p` | 粘贴 |
| `d` | 删除（会确认） |
| `r` | 重命名 |
| `/` | 搜索 |
| `z` | 跳转（集成 zoxide！） |
| `q` | 退出 |

### 跟 zoxide 的联动

在 yazi 里按 `z` ，会弹出 zoxide 的智能跳转。你输入目录名的片段，它就帮你跳过去。两个工具的化学反应，比单独用强太多。

### 小技巧

- 退出 yazi 时自动 `cd` 到你最后浏览的目录（需要配置 shell wrapper）
- 支持插件系统，我装了 glow 插件来预览 Markdown
- 批量重命名：选中多个文件按 `r` ，会打开编辑器让你批量改名

---

## 5\. Zoxide —— cd 命令的终极进化

**替代对象** ： `cd` / `autojump` / `z.lua`

### 为什么用？

每天敲 `cd ~/workspace/some-project/src/main/java/com/xxx` 这种长路径，手指都要抽筋了。autojump 我也用过，但它是 Python 写的，启动有延迟，而且匹配算法一般。

Zoxide 的逻辑很简单： **记录你去过的目录，下次输入关键词就能跳过去** 。Rust 写的，快到感觉不到。说白了就是—— **你再也不用打目录全名了** 。

### 安装

brew install zoxide

# 在 ~/.zshrc 加上（替换内置 cd 命令）
eval "$(zoxide init zsh --cmd cd)"

注意最后的 `--cmd cd` ，这会直接替换掉你的 `cd` 命令。意思是你不用学新命令，正常用 `cd` 就行，它会自动加持。

### 使用

举几个我日常的例子：

# 以前
cd ~/workspace/aiworkspace
cd ~/workspace/fintgkteam
cd ~/workspace/finfundtrade

# 现在
cd aiwor       # → ~/workspace/aiworkspace
cd fintgk      # → ~/workspace/fintgkteam
cd fin trade   # → ~/workspace/finfundtrade（多个关键词，空格分隔）

就这么简单。你打 `cd aiwor` 就到 aiworkspace 了，不用按 Tab 补全，不用敲全名，它就是知道你要去哪。

它的匹配算法叫 **frecency** （frequency + recency），越常去、越近去的目录权重越高。比如 `cd src` 会跳到你最近最常去的那个 src 目录，而不是随机匹配一个。用了一周之后，几乎所有目录都能 2-3 个字母跳到。

### 跟 Tab 补全比

你可能会说：zsh 自带的 Tab 补全也能少打字啊。区别在于：

- **Tab 补全** ： `cd ~/work<Tab>/fint<Tab>` —— 你得记住路径层级，一级一级补
- **Zoxide** ： `cd fintgk` —— 不用管路径在哪一层，直接打目的地的片段

就像手机打字从九宫格进化到全键盘拼音——你不用精确输入了，给个模糊的线索就行。

### 进阶

# 交互模式：列出所有匹配结果让你选
cdi fint
# > ~/workspace/fintgkteam
#   ~/workspace/fintranscore
#   ~/workspace/finfundtrade
# 用方向键选，回车确认

# 查看数据库里记录了哪些目录
zoxide query --list

# 手动添加一个常用目录
zoxide add ~/some/deep/path

---

## 组合技：这些工具的化学反应

单独用每个工具都很爽，但它们组合起来才是最佳体验：

一个典型的工作流：

1. 打开 Ghostty，Starship 显示当前状态 ✨
2. `cd proj` （zoxide 跳到项目目录）
3. 终端分屏，左边打开claude code开始工作，右边 `yazi` 查看文件
4. 需要手改的时候，按 `Enter` 用编辑器打开
5. `lazygit` 打开 Git UI，stage + commit + push

全程不用离开终端，全程键盘操作，全程丝滑。
![[Image 25.jpg]]

---

## 写在最后

以前的工作流是 IDE 为中心：IDEA 打开项目，里面写代码、看 diff、提交 Git、搜文件，终端只是个附属品。

现在是终端为中心：Claude Code 写代码，Yazi 看文件，Lazygit 管版本，Zoxide 跳目录，Starship 告诉你在哪。IDE 反而变成了偶尔才打开的重武器——解个复杂冲突，调个断点，仅此而已。

去试试吧。反正 `brew install` 又不要钱。不想自己折腾的，把开头那段 Prompt 丢给 Claude Code 就行。

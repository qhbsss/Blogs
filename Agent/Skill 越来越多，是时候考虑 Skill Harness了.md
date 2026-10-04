---
title: "Skill 越来越多，是时候考虑 Skill Harness了"
source: "https://ata.atatech.org/articles/11020606123?spm=ata.23639746.0.0.3d222a29mpDFWf"
author:
published:
created: 2026-05-11
description:
tags:
  - "clippings"
---
内部资料







> 本文纯手搓，AI 含量无（有张配图由 Gemini 润色了样式），抛砖引玉，欢迎评论区交流。

从 A 厂提出 Skill 规范之后，这种渐进式加载、兼具泛化（自然语言 MD）+约束（代码脚本）的形态迅速成为 AI 时代应用层能力分发的事实标准。Skill 聚焦特定领域能力沉淀，如何让多个 Skill 在实际 Agent 环境中长程、稳定、符合预期执行，Harness Engineering 这个概念又火了起来，个人理解从 PE，CE 到 HE 最大的变化是从静态环境/上下文 到了 动态驾驭（注意从名词变成了动词），HE 是在 CE 基础上加了变化的约束和动态迭代优化，变化的约束意味着 Spec 需要能自动保鲜，动态迭代意味着对抗熵增，类似防止架构腐化。

Harness Engineering 不在于又造了个新词，而在于把这个之前很多工程团队或多或少在做的事情放到了聚光灯下。构建 AI 友好工作环境已经成为共识，一个月前在 Aone 开放平台为团队建了个专属 Skill 空间，很快大家就上架了 30+ Skill，同时也观察到一些现象：

## 背景

- 团队在 Aone 开放平台探索和沉淀了不少 AI 提效相关工具，这些 Skill 涵盖广泛的工作环节、适用业务场景迥然不同，具体质量也是千差万别。

![[5a1275ca-544d-48d7-adf7-7113932e2b4d.png]] ●

以个人沉淀的一个商详工单排查 Skill 为例，为了提升结果确定性，逐步添加了很多业务约束，比如商详特有的模块 JSON 结构匹配，而这些约束不同的业务差异巨大，而且会随着日常迭代发生变化。

![[4a0592a5-caeb-4ef5-aee4-d819f7687586.png]] ●

从 0 到 1 沉淀的同时，业务 Skill 也在与时俱进，不断迭代优化，从个人经验变成团队经验，目前主要靠口口相传，或者是手动追加到团队规范。

![[659e599f-1e23-4cf5-9764-3518e6205a22.png]]

上面几个场景，能看到一些非常显著的问题，或者说是机会点：

- 效率问题贯穿工作方方面面，如何快速从 0 到 1 创建高质量 Skill？

- Skill 规模爆炸后如何找到场景高度匹配、拿来即用且能真正解决实际问题的 Skill？

- 个人在特定场景使用 Skill 发现的新问题、新经验如何快速扩展为团队可复用知识？

- 随着业务和代码的发展演进，Skill 如何对抗熵增，越用越好用？

要回答这些问题，需要看看业界发生了什么？

## 趋势

趋势一：AI 工具 UI 层正在收敛为几类超级入口，超级对话框 GUI（CoWork，QoderWork，AccioWork，悟空等），简洁极客范AI 更友好的 CLI/TUI（ClaudeCode，CodeX CLI，Qoder CLI 等）， 成熟 IM 驱动的个人助理（OpenClaw，AoneClaw、QClaw 等），另一方面以 Gemini 为代表的模型厂商也在探索内置支持 Generative-UI/Dynamic UI，由此业务团队专门定制复杂 UI 的必要性就越来越低，反而需要把重点放在如何持续打磨质量更高的领域解决方案 Skill/MCP 上。

趋势二：从 Prompt Engineering、Context Engineering 到 Harness Engineering，都在做的事情就是如何打造更 AI（模型） 友好的工作环境，提升结果预期满足度。但 Harness Engineering 这个筐很大（有一种说法是Harness ≈ Agent - Model），任何除过模型之外的工程优化都可以装进去，OpenAI 的博客打了个样（如下图），主要包括上下文工程（可以理解为 Context Engineering）、架构约束（可以理解为 SDD，团队特有的约束），和垃圾回收（可以理解为评估和持续迭代）：根据这个理解再来看前面的问题，是不是很清晰，如果 Skill 是 AI 时代堪比 APP 的应用分发形态，那么围绕业务 Skill 生命周期的 Harness 会比单纯讲 Harness Engineering 更聚焦，更务实，而且这个评估和优化只有懂业务的人才能做得更好。

![[eb36fab6-439e-4dae-9213-d9d6aecc12c2.png]]

趋势三：针对 Skill 的 Harness 已经形成三个重点方向：

- 自动生成：现在的主流 AI 工具都支持让它把对话的业务流程自动创建 Skill，但需要一些规范（我把 A 厂 Skill 最佳时间包装了一个 [Skill](https://open.aone.alibaba-inc.com/skill/skill-authoring-best-practice) ，增加了一些 checklist，包括前面案例中团队同学增加的 MCP 工具在沙箱外执行约束），或者直接用 A 厂官方的 skill-creator（ [分析文档](https://aliyuque.antfin.com/lkk4c3/xoy73g/lqap2nw46imggyro?singleDoc#%20%E3%80%8Askill-creator%E5%88%86%E6%9E%90%E3%80%8B) ），2.0 版本已经从生成扩展到了评估和持续迭代，这个在各大工具的技能市场已经是标配了。

![[84403112-27d3-450b-8d64-e8c4c2698779.png]] ●

长期记忆：这个一直是学术和产业界研究的热点，也有各种开源的 long-term memory 框架，包括一些云数据库厂商也推出了探索性的产品（比如 [mem9](https://mem9.ai/) ），openclaw、泄露版 claude code 里都有相关 feature，上周在听千问 Memory 直播也提到已经在内部多个业务使用的分层记忆框架，其中的睡眠记忆和 cc 的 AutoDream 思路很像，最新的龙虾更新也提供了实验版的 [Dreaming 机制](https://docs.openclaw.ai/concepts/dreaming) 。

![[95cbca1b-5775-4505-a588-b08123638fa8.png]] ●

评估&自迭代：skill-creator2.0 中除过生成 skill 本身，也增加了评估和迭代的能力，另外 AI 大神 Kaparthy 开源了一个 [autoresearch 框架](https://github.com/karpathy/autoresearch) ，这个框架赋予 AI Agent 一个真实可用的 GPT 训练环境，让其自主进行实验：修改代码、运行 5 分钟的短时训练、评估结果，并决定保留还是丢弃每次更改。只要你的 token 够，这就是一个非常朴素的自迭代逻辑，所以基于这个框架思想，诞生了很多针对 [claude code](https://github.com/uditgoenka/autoresearch) ， [codex](https://github.com/leo-lilinxiao/codex-autoresearch) 等环境的 Agent 优化 skill，甚至还有 [autoresearch paper](https://github.com/aiming-lab/AutoResearchClaw) 的，对，万物皆可 Skill。

![[8a48ea3c-4e6f-4cd4-9fe6-d6bfbe54e359.png]]

## 思路

有了这个想法，当时就在本子上随手画了一张草图（下图是借助 Gemini 润色，未改变原意），核心是一个围绕 Skill LC 的 LOOP，以问题驱动，创建 Skill，评估优化，上线使用再反馈迭代。

![[eddabd5d-ab57-4ee5-a891-871b701082da.png]]

## 特性

> 基于前面思路目前快速实现了一个 BETA 版本

## 基于业务场景查找

- 根据自然语言，从团队 Skill 中挑选最合适的推荐，并基于评估质量分做 ranking

- 查询到的 SKILL，可以通过 aone-kit 命令一键批量安装到本地

- 提供团队增强版的 find-skill SKILL（ [链接](https://open.aone.alibaba-inc.com/skill/buyer-base-find-skill) ），可以直接在 IDE/Claw/Work/CLI 中集成

![[c7c2f813-ac08-4404-bc96-03461c027e4d.png]] ![[77f2488d-6aaa-44e9-931b-2ce7d273adc9.png]]

## Skill 评估&优化

- 指定环境说明、评估模式和 Checklist 跑评估任务，给出整体质量分，Checklist 通过报告以及优化建议（基于 Aone Agent 实现）。

![[d0fc0746-7202-4d64-b805-f21f58f84d85.png]] ●

AB 实验对照模式会同时启动两个会话，以用户输入和 checklist 为提示词，一个安装 Skill，一个不安装对比评估，正在做 V2 vs. V1 版本的 SKILL 评估优化效果。

![[7ec52a7a-15c9-4731-bd3c-01f94d747c6e.png]] ![[3c93c060-3fa8-4cd7-b751-515c71d14b2b.png]] ●

参考 CI/CD 理念，通过持续构建的形式来优化迭代，通过配置迭代轮次和目标质量分，后台任务持续评估和优化已有 Skill。

![[3457fc4a-2756-4440-91fd-15d3d709abd3.png]]

## 让 Skill 越用越好用

这部分当前只做了个雏形，Agent Memory 在学术和产业界发展演进很快，后续离线加工更多借助已有成熟方案，比如千问 Memory，CC 的分层 Memory 机制等。目前支持 hook 机制采集保存raw data 到 kbase memory，提供类似下面的安装脚本：

bash buyer-base-memory-hook/install.sh # 默认全部安装 hook

bash buyer-base-memory-hook/install.sh --target cursor # 只为 cursor 添加 hook

bash buyer-base-memory-hook/install.sh --target claude-code # 只为 cc 添加 hook

bash buyer-base-memory-hook/install.sh --target qoder # 只为 qoder 添加 hook

bash buyer-base-memory-hook/install.sh --target aone-copilot # 只为 aone copilot 添加 hook

## 最后

以上只是当前阶段的小尝试，有了 AI Coding 可以更快验证想法。上周末重新思考，还有一些矫正和迭代，比如 Local First 替代中心化的评估和记忆、比如如何指挥多 Agent 工作而降低 Human 的 Context 切换困扰，这方面正在进行新的实践，后续整理再分享。

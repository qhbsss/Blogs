---
title: "给 Claude Code 装上 Hermes 的大脑"
source: "https://ata.atatech.org/articles/11020628509?spm=ata.23639746.0.0.3d222a29mpDFWf"
author:
published:
created: 2026-05-11
description:
tags:
  - "clippings"
---
内部资料







## 记一次对 AI 编程助手的改造

---

## 前言：为什么不直接换 Hermes

去年底 Nous Research 开源了 Hermes Agent，138k star，中文社区也传开了。看完 README 之后确实有点眼热——它有一个特性叫"自我学习闭环"，大意是 Agent 跑完复杂任务后会自动把经验提炼成可复用的 Skill，而且这个 Skill 会在后续使用过程中持续改进。跨 session 有全文搜索，用过几次之后它就越来越懂你。

但我没有换。

原因很实际：Claude Code 上已经积累了几十个定制 Skill，迁移成本不小。更重要的是，Claude Code 和 Anthropic 的模型绑定得很深，prompt cache 命中率、工具调用格式、thinking block 的处理方式都有针对性的优化，换到 Hermes 之后这些就全没了。Hermes 支持 200+ 模型是优点，但选择太多对我来说反而是负担，我只用 Claude。

还有一个原因没法忽视：Claude Code 的源码就在本地。

---

## 关于"源码在本地"这件事

官方安装方式是 `npm install -g @anthropic-ai/claude-code` ，这个命令只下载编译好的 dist，你能用 `claude` 命令，但看不到 TypeScript 源码，也改不了任何东西。

我用的是另一种方式：直接 clone 源码仓库，本地 `bun run build` 出 `dist/cli.js` ，然后 alias 指向这个文件。这样能改任何东西，代价是不会自动更新——Anthropic 推新版时要手动 `git pull` 再重新 build，如果他们改了你动过的文件还会有冲突。

---

## 发现：功能已经写好了，只是没开放

顺着这个思路，我把 `~/claude-code/src/` 翻了一遍。

翻出来的结果有点出乎意料。Skill 自动改进、记忆自动提取、用户画像——这些功能 Anthropic 已经实现了，代码就在那里，完整的逻辑，完整的 prompt，甚至有单元测试。但它们统一被一套叫 GrowthBook 的 feature flag 系统锁住了，普通用户拿不到。

```javascript
// src/utils/hooks/skillImprovement.ts
export function initSkillImprovement(): void {
    if (
```
    feature('SKILL_IMPROVEMENT') &&
```java
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_copper_panda', false)
  ) {
    registerPostSamplingHook(createSkillImprovementHook())
  }
}
```

`feature('SKILL_IMPROVEMENT')` 这个调用会去问 GrowthBook 的服务器：你有没有给这个用户开这个功能？答案默认是 no。而解锁的路只给 Anthropic 内部员工留着：

// 只对 USER_TYPE=ant 的员工生效
if (process.env.USER_TYPE === 'ant') {
  const raw = process.env.CLAUDE_INTERNAL_FC_OVERRIDES
  // 用环境变量强制覆盖 feature flag
}

所以整件事变得很清晰：不需要移植 Hermes 的代码，只需要把 Claude Code 自己写好的代码解锁。

---

## 整体架构：改了什么，加了什么

<svg id="mermaid-1778504944279-6ul7v" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 2399.71875px;" viewBox="0 0 2399.71875 584" role="graphics-document document" aria-roledescription="flowchart-v2"><g><marker id="mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944279-6ul7v_flowchart-v2-pointStart" viewBox="0 0 10 10" refX="4.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 5 L 10 10 L 10 0 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944279-6ul7v_flowchart-v2-circleEnd" viewBox="0 0 10 10" refX="11" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1778504944279-6ul7v_flowchart-v2-circleStart" viewBox="0 0 10 10" refX="-1" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1778504944279-6ul7v_flowchart-v2-crossEnd" viewBox="0 0 11 11" refX="12" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944279-6ul7v_flowchart-v2-crossStart" viewBox="0 0 11 11" refX="-1" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><g><g></g><g></g><g></g><g><g transform="translate(0, 0)"><g><g id="改动后" data-look="classic"><rect style="" x="8" y="8" width="1552.9140625" height="568"></rect><g transform="translate(760.45703125, 8)"><foreignObject width="48" height="56"><p>改动后</p></foreignObject></g></g></g><g><path d="M169.5,326L175.75,326C182,326,194.5,326,206.333,326C218.167,326,229.333,326,234.917,326L240.5,326" id="L_A2_B2_0" style=";" data-edge="true" data-et="edge" data-id="L_A2_B2_0" data-points="W3sieCI6MTY5LjUsInkiOjMyNn0seyJ4IjoyMDcsInkiOjMyNn0seyJ4IjoyNDQuNSwieSI6MzI2fV0=" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M346.252,283L359.011,265.5C371.77,248,397.287,213,422.746,195.5C448.204,178,473.604,178,486.304,178L499.004,178" id="L_B2_C2_0" style=";" data-edge="true" data-et="edge" data-id="L_B2_C2_0" data-points="W3sieCI6MzQ2LjI1MjM0OTAyODcxNjIsInkiOjI4M30seyJ4Ijo0MjIuODA0Njg3NSwieSI6MTc4fSx7IngiOjUwMy4wMDM5MDYyNSwieSI6MTc4fV0=" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M627.004,178L640.37,178C653.737,178,680.47,178,706.425,178C732.38,178,757.557,178,770.146,178L782.734,178" id="L_C2_D2_0" style=";" data-edge="true" data-et="edge" data-id="L_C2_D2_0" data-points="W3sieCI6NjI3LjAwMzkwNjI1LCJ5IjoxNzh9LHsieCI6NzA3LjIwMzEyNSwieSI6MTc4fSx7IngiOjc4Ni43MzQzNzUsInkiOjE3OH1d" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M962.672,135.985L975.927,129.654C989.182,123.323,1015.693,110.662,1034.531,104.331C1053.37,98,1064.536,98,1070.12,98L1075.703,98" id="L_D2_E2_0" style=";" data-edge="true" data-et="edge" data-id="L_D2_E2_0" data-points="W3sieCI6OTYyLjY3MTg3NSwieSI6MTM1Ljk4NTA3NDYyNjg2NTY3fSx7IngiOjEwNDIuMjAzMTI1LCJ5Ijo5OH0seyJ4IjoxMDc5LjcwMzEyNSwieSI6OTh9XQ==" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M921.473,221L941.594,239.5C961.716,258,1001.96,295,1028.05,313.5C1054.141,332,1066.078,332,1072.047,332L1078.016,332" id="L_D2_F2_0" style=";" data-edge="true" data-et="edge" data-id="L_D2_F2_0" data-points="W3sieCI6OTIxLjQ3MjYwNTUxOTQ4MDYsInkiOjIyMX0seyJ4IjoxMDQyLjIwMzEyNSwieSI6MzMyfSx7IngiOjEwODIuMDE1NjI1LCJ5IjozMzJ9XQ==" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M1252.508,98L1258.758,98C1265.008,98,1277.508,98,1291.867,98C1306.225,98,1322.443,98,1330.551,98L1338.66,98" id="L_E2_G2_0" style=";" data-edge="true" data-et="edge" data-id="L_E2_G2_0" data-points="W3sieCI6MTI1Mi41MDc4MTI1LCJ5Ijo5OH0seyJ4IjoxMjkwLjAwNzgxMjUsInkiOjk4fSx7IngiOjEzNDIuNjYwMTU2MjUsInkiOjk4fV0=" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M1250.195,332L1256.831,332C1263.466,332,1276.737,332,1288.956,332C1301.174,332,1312.341,332,1317.924,332L1323.508,332" id="L_F2_H2_0" style=";" data-edge="true" data-et="edge" data-id="L_F2_H2_0" data-points="W3sieCI6MTI1MC4xOTUzMTI1LCJ5IjozMzJ9LHsieCI6MTI5MC4wMDc4MTI1LCJ5IjozMzJ9LHsieCI6MTMyNy41MDc4MTI1LCJ5IjozMzJ9XQ==" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M385.305,326L391.555,326C397.805,326,410.305,326,426.738,326C443.172,326,463.539,326,473.723,326L483.906,326" id="L_B2_I2_0" style=";" data-edge="true" data-et="edge" data-id="L_B2_I2_0" data-points="W3sieCI6Mzg1LjMwNDY4NzUsInkiOjMyNn0seyJ4Ijo0MjIuODA0Njg3NSwieSI6MzI2fSx7IngiOjQ4Ny45MDYyNSwieSI6MzI2fV0=" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M642.102,326L652.952,326C663.802,326,685.503,326,706.905,326C728.307,326,749.411,326,759.964,326L770.516,326" id="L_I2_J2_0" style=";" data-edge="true" data-et="edge" data-id="L_I2_J2_0" data-points="W3sieCI6NjQyLjEwMTU2MjUsInkiOjMyNn0seyJ4Ijo3MDcuMjAzMTI1LCJ5IjozMjZ9LHsieCI6Nzc0LjUxNTYyNSwieSI6MzI2fV0=" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M343.901,369L357.052,388.5C370.202,408,396.503,447,415.237,466.5C433.971,486,445.138,486,450.721,486L456.305,486" id="L_B2_K2_0" style=";" data-edge="true" data-et="edge" data-id="L_B2_K2_0" data-points="W3sieCI6MzQzLjkwMTA5ODYzMjgxMjUsInkiOjM2OX0seyJ4Ijo0MjIuODA0Njg3NSwieSI6NDg2fSx7IngiOjQ2MC4zMDQ2ODc1LCJ5Ijo0ODZ9XQ==" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M669.703,486L675.953,486C682.203,486,694.703,486,706.536,486C718.37,486,729.536,486,735.12,486L740.703,486" id="L_K2_L2_0" style=";" data-edge="true" data-et="edge" data-id="L_K2_L2_0" data-points="W3sieCI6NjY5LjcwMzEyNSwieSI6NDg2fSx7IngiOjcwNy4yMDMxMjUsInkiOjQ4Nn0seyJ4Ijo3NDQuNzAzMTI1LCJ5Ijo0ODZ9XQ==" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path></g><g><g><g data-id="L_A2_B2_0" transform="translate(0, 0)"></g></g><g><g data-id="L_B2_C2_0" transform="translate(0, 0)"></g></g><g><g data-id="L_C2_D2_0" transform="translate(0, 0)"></g></g><g><g data-id="L_D2_E2_0" transform="translate(0, 0)"></g></g><g><g data-id="L_D2_F2_0" transform="translate(0, 0)"></g></g><g><g data-id="L_E2_G2_0" transform="translate(0, 0)"></g></g><g><g data-id="L_F2_H2_0" transform="translate(0, 0)"></g></g><g><g data-id="L_B2_I2_0" transform="translate(0, 0)"></g></g><g><g data-id="L_I2_J2_0" transform="translate(0, 0)"></g></g><g><g data-id="L_B2_K2_0" transform="translate(0, 0)"></g></g><g><g data-id="L_K2_L2_0" transform="translate(0, 0)"></g></g></g><g><g id="flowchart-A2-7" transform="translate(107.5, 326)"><rect style="" x="-62" y="-43" width="124" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-32, -28)"><rect></rect><foreignObject width="64" height="56"><p>用户对话</p></foreignObject></g></g><g id="flowchart-B2-8" transform="translate(314.90234375, 326)"><rect style="" x="-70.40234375" y="-43" width="140.8046875" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-40.40234375, -28)"><rect></rect><foreignObject width="80.8046875" height="56"><p>Agent 循环</p></foreignObject></g></g><g id="flowchart-C2-10" transform="translate(565.00390625, 178)"><rect style="" x="-62" y="-43" width="124" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-32, -28)"><rect></rect><foreignObject width="64" height="56"><p>回答用户</p></foreignObject></g></g><g id="flowchart-D2-12" transform="translate(874.703125, 178)"><rect style="" x="-87.96875" y="-43" width="175.9375" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-57.96875, -28)"><rect></rect><foreignObject width="115.9375" height="56"><p>Stop Hook 触发</p></foreignObject></g></g><g id="flowchart-E2-14" transform="translate(1166.10546875, 98)"><rect style="" x="-86.40234375" y="-55" width="172.8046875" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-56.40234375, -40)"><rect></rect><foreignObject width="112.8046875" height="80"><p>记忆提取 Agent<br>fork 后台运行</p></foreignObject></g></g><g id="flowchart-F2-16" transform="translate(1166.10546875, 332)"><rect style="" x="-84.08984375" y="-55" width="168.1796875" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-54.08984375, -40)"><rect></rect><foreignObject width="108.1796875" height="80"><p>FTS5 索引更新<br>后台脚本</p></foreignObject></g></g><g id="flowchart-G2-18" transform="translate(1425.4609375, 98)"><rect style="fill:#ccffcc !important" x="-82.80078125" y="-55" width="165.6015625" height="110" stroke="currentColor"></rect><g style="" transform="translate(-52.80078125, -40)"><rect></rect><foreignObject width="105.6015625" height="80"><p>memory/ 目录<br>4类结构化记忆</p></foreignObject></g></g><g id="flowchart-H2-20" transform="translate(1425.4609375, 332)"><rect style="fill:#ccffcc !important" x="-97.953125" y="-55" width="195.90625" height="110" stroke="currentColor"></rect><g style="" transform="translate(-67.953125, -40)"><rect></rect><foreignObject width="135.90625" height="80"><p>session_search.db<br>全文索引</p></foreignObject></g></g><g id="flowchart-I2-22" transform="translate(565.00390625, 326)"><rect style="" x="-77.09765625" y="-55" width="154.1953125" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-47.09765625, -40)"><rect></rect><foreignObject width="94.1953125" height="80"><p>每5条消息<br>Skill改进检测</p></foreignObject></g></g><g id="flowchart-J2-24" transform="translate(874.703125, 326)"><rect style="fill:#ccffcc !important" x="-100.1875" y="-43" width="200.375" height="86" stroke="currentColor"></rect><g style="" transform="translate(-70.1875, -28)"><rect></rect><foreignObject width="140.375" height="56"><p>自动更新 SKILL.md</p></foreignObject></g></g><g id="flowchart-K2-26" transform="translate(565.00390625, 486)"><rect style="" x="-104.69921875" y="-55" width="209.3984375" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-74.69921875, -40)"><rect></rect><foreignObject width="149.3984375" height="80"><p>每3条消息<br>SessionMemory更新</p></foreignObject></g></g><g id="flowchart-L2-28" transform="translate(874.703125, 486)"><rect style="fill:#ccffcc !important" x="-130" y="-55" width="260" height="110" stroke="currentColor"></rect><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>session-memory/summary.md</p></foreignObject></g></g></g></g><g transform="translate(1602.9140625, 206)"><g><g id="改动前" data-look="classic"><rect style="" x="8" y="8" width="780.8046875" height="156"></rect><g transform="translate(374.40234375, 8)"><foreignObject width="48" height="56"><p>改动前</p></foreignObject></g></g></g><g><path d="M169.5,86L175.75,86C182,86,194.5,86,206.333,86C218.167,86,229.333,86,234.917,86L240.5,86" id="L_A1_B1_0" style=";" data-edge="true" data-et="edge" data-id="L_A1_B1_0" data-points="W3sieCI6MTY5LjUsInkiOjg2fSx7IngiOjIwNywieSI6ODZ9LHsieCI6MjQ0LjUsInkiOjg2fV0=" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M385.305,86L391.555,86C397.805,86,410.305,86,422.138,86C433.971,86,445.138,86,450.721,86L456.305,86" id="L_B1_C1_0" style=";" data-edge="true" data-et="edge" data-id="L_B1_C1_0" data-points="W3sieCI6Mzg1LjMwNDY4NzUsInkiOjg2fSx7IngiOjQyMi44MDQ2ODc1LCJ5Ijo4Nn0seyJ4Ijo0NjAuMzA0Njg3NSwieSI6ODZ9XQ==" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M584.305,86L590.555,86C596.805,86,609.305,86,621.138,86C632.971,86,644.138,86,649.721,86L655.305,86" id="L_C1_D1_0" style=";" data-edge="true" data-et="edge" data-id="L_C1_D1_0" data-points="W3sieCI6NTg0LjMwNDY4NzUsInkiOjg2fSx7IngiOjYyMS44MDQ2ODc1LCJ5Ijo4Nn0seyJ4Ijo2NTkuMzA0Njg3NSwieSI6ODZ9XQ==" marker-end="url(#mermaid-1778504944279-6ul7v_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path></g><g><g><g data-id="L_A1_B1_0" transform="translate(0, 0)"></g></g><g><g data-id="L_B1_C1_0" transform="translate(0, 0)"></g></g><g><g data-id="L_C1_D1_0" transform="translate(0, 0)"></g></g></g><g><g id="flowchart-A1-0" transform="translate(107.5, 86)"><rect style="" x="-62" y="-43" width="124" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-32, -28)"><rect></rect><foreignObject width="64" height="56"><p>用户对话</p></foreignObject></g></g><g id="flowchart-B1-1" transform="translate(314.90234375, 86)"><rect style="" x="-70.40234375" y="-43" width="140.8046875" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-40.40234375, -28)"><rect></rect><foreignObject width="80.8046875" height="56"><p>Agent 循环</p></foreignObject></g></g><g id="flowchart-C1-3" transform="translate(522.3046875, 86)"><rect style="" x="-62" y="-43" width="124" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-32, -28)"><rect></rect><foreignObject width="64" height="56"><p>回答用户</p></foreignObject></g></g><g id="flowchart-D1-5" transform="translate(705.3046875, 86)"><rect style="fill:#ffcccc !important" x="-46" y="-43" width="92" height="86" stroke="currentColor"></rect><g style="" transform="translate(-16, -28)"><rect></rect><foreignObject width="32" height="56"><p>结束</p></foreignObject></g></g></g></g></g></g></g></svg>

一共动了 5 个源文件，加了 1 个 Python 脚本，1 个 Skill，改了 1 个配置文件。下面逐一说。

---

## 第一步：解锁 Skill 自动改进

### 它做什么

这个功能的核心逻辑在 `src/utils/hooks/skillImprovement.ts` ，大约 200 行。运行机制是这样的：当你在使用某个项目级 Skill 的时候，每累计 5 条用户消息，后台会悄悄用一个小模型（Haiku 级别）分析最近的对话，找出你说过的偏好和纠正，然后自动 patch 对应的 SKILL.md 文件。

举个例子：你在用一个"代码审查"的 Skill，过程中说了一句"以后帮我顺便检查一下 test coverage"，下次这个 Skill 被调用时，它已经把这条需求写进去了。

有个前置条件值得注意：这个功能只对 **项目级 Skill** 生效，也就是 skill 路径以 `projectSettings:` 开头的。放在 `~/.claude/skills/` 下的全局 Skill 不触发。另外必须是 CLI 交互模式，SDK/pipe 模式不触发。

### 怎么改的

原代码：

export function initSkillImprovement(): void {
  if (
    feature('SKILL_IMPROVEMENT') &&
```java
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_copper_panda', false)
  ) {
    registerPostSamplingHook(createSkillImprovementHook())
  }
}
```

改后：

```javascript
export function initSkillImprovement(): void {
    registerPostSamplingHook(createSkillImprovementHook())
}
```

把 if 判断删掉，让 hook 无条件注册。

### 内部实现值得细看

Skill 改进的 prompt 设计得很克制，只找"用户明确表达的偏好"：

Look for:
- Requests to add, change, or remove steps: "can you also ask me X"
- Preferences about how steps should work
- Corrections: "no, do X instead", "always use Y"

Ignore:
- Routine conversation that doesn't generalize
- Things the skill already does

这个边界很重要。如果不加限制，每次对话里随口说的话都会写进 Skill，很快就变成一团乱。Anthropic 的工程师在这里做了有意识的取舍。

---

## 第二步：解锁记忆自动提取

这是整个改造里最复杂的部分，因为有三层 flag 在拦。

### 三层锁的结构

<svg id="mermaid-1778504944333-t7wf0" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 614.39453125px;" viewBox="0 0 614.39453125 1724.40625" role="graphics-document document" aria-roledescription="flowchart-v2"><g><marker id="mermaid-1778504944333-t7wf0_flowchart-v2-pointEnd" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944333-t7wf0_flowchart-v2-pointStart" viewBox="0 0 10 10" refX="4.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 5 L 10 10 L 10 0 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944333-t7wf0_flowchart-v2-circleEnd" viewBox="0 0 10 10" refX="11" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1778504944333-t7wf0_flowchart-v2-circleStart" viewBox="0 0 10 10" refX="-1" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1778504944333-t7wf0_flowchart-v2-crossEnd" viewBox="0 0 11 11" refX="12" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944333-t7wf0_flowchart-v2-crossStart" viewBox="0 0 11 11" refX="-1" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><g><g></g><g><path d="M179.197,94L179.197,98.167C179.197,102.333,179.197,110.667,179.197,118.333C179.197,126,179.197,133,179.197,136.5L179.197,140" id="L_A_B_0" style=";" data-edge="true" data-et="edge" data-id="L_A_B_0" data-points="W3sieCI6MTc5LjE5NzI2NTYyNSwieSI6OTR9LHsieCI6MTc5LjE5NzI2NTYyNSwieSI6MTE5fSx7IngiOjE3OS4xOTcyNjU2MjUsInkiOjE0NH1d" marker-end="url(#mermaid-1778504944333-t7wf0_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M125.837,400.64L116.531,418.367C107.225,436.093,88.612,471.547,79.306,497.44C70,523.333,70,539.667,70,547.833L70,556" id="L_B_Z1_0" style=";" data-edge="true" data-et="edge" data-id="L_B_Z1_0" data-points="W3sieCI6MTI1LjgzNzQ4NjA2MTU2MjkxLCJ5Ijo0MDAuNjQwMjIwNDM2NTYyOX0seyJ4Ijo3MCwieSI6NTA3fSx7IngiOjcwLCJ5Ijo1NjB9XQ==" marker-end="url(#mermaid-1778504944333-t7wf0_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M232.557,400.64L241.863,418.367C251.17,436.093,269.782,471.547,279.088,497.44C288.395,523.333,288.395,539.667,288.395,547.833L288.395,556" id="L_B_C_0" style=";" data-edge="true" data-et="edge" data-id="L_B_C_0" data-points="W3sieCI6MjMyLjU1NzA0NTE4ODQzNzEsInkiOjQwMC42NDAyMjA0MzY1NjI5fSx7IngiOjI4OC4zOTQ1MzEyNSwieSI6NTA3fSx7IngiOjI4OC4zOTQ1MzEyNSwieSI6NTYwfV0=" marker-end="url(#mermaid-1778504944333-t7wf0_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M288.395,646L288.395,650.167C288.395,654.333,288.395,662.667,288.395,670.333C288.395,678,288.395,685,288.395,688.5L288.395,692" id="L_C_D_0" style=";" data-edge="true" data-et="edge" data-id="L_C_D_0" data-points="W3sieCI6Mjg4LjM5NDUzMTI1LCJ5Ijo2NDZ9LHsieCI6Mjg4LjM5NDUzMTI1LCJ5Ijo2NzF9LHsieCI6Mjg4LjM5NDUzMTI1LCJ5Ijo2OTZ9XQ==" marker-end="url(#mermaid-1778504944333-t7wf0_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M237.527,897.539L225.838,914.85C214.15,932.161,190.772,966.784,179.083,994.262C167.395,1021.74,167.395,1042.073,167.395,1052.24L167.395,1062.406" id="L_D_Z2_0" style=";" data-edge="true" data-et="edge" data-id="L_D_Z2_0" data-points="W3sieCI6MjM3LjUyNzA0NTY5MzM0NTY2LCJ5Ijo4OTcuNTM4NzY0NDQzMzQ1Nn0seyJ4IjoxNjcuMzk0NTMxMjUsInkiOjEwMDEuNDA2MjV9LHsieCI6MTY3LjM5NDUzMTI1LCJ5IjoxMDY2LjQwNjI1fV0=" marker-end="url(#mermaid-1778504944333-t7wf0_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M339.262,897.539L350.951,914.85C362.64,932.161,386.017,966.784,397.706,992.262C409.395,1017.74,409.395,1034.073,409.395,1042.24L409.395,1050.406" id="L_D_E_0" style=";" data-edge="true" data-et="edge" data-id="L_D_E_0" data-points="W3sieCI6MzM5LjI2MjAxNjgwNjY1NDM0LCJ5Ijo4OTcuNTM4NzY0NDQzMzQ1Nn0seyJ4Ijo0MDkuMzk0NTMxMjUsInkiOjEwMDEuNDA2MjV9LHsieCI6NDA5LjM5NDUzMTI1LCJ5IjoxMDU0LjQwNjI1fV0=" marker-end="url(#mermaid-1778504944333-t7wf0_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M409.395,1164.406L409.395,1168.573C409.395,1172.74,409.395,1181.073,409.395,1188.74C409.395,1196.406,409.395,1203.406,409.395,1206.906L409.395,1210.406" id="L_E_F_0" style=";" data-edge="true" data-et="edge" data-id="L_E_F_0" data-points="W3sieCI6NDA5LjM5NDUzMTI1LCJ5IjoxMTY0LjQwNjI1fSx7IngiOjQwOS4zOTQ1MzEyNSwieSI6MTE4OS40MDYyNX0seyJ4Ijo0MDkuMzk0NTMxMjUsInkiOjEyMTQuNDA2MjV9XQ==" marker-end="url(#mermaid-1778504944333-t7wf0_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M358.06,1473.072L349.449,1490.461C340.838,1507.85,323.616,1542.628,315.005,1568.184C306.395,1593.74,306.395,1610.073,306.395,1618.24L306.395,1626.406" id="L_F_Z3_0" style=";" data-edge="true" data-et="edge" data-id="L_F_Z3_0" data-points="W3sieCI6MzU4LjA2MDEyNjEwNTMwNTQ3LCJ5IjoxNDczLjA3MTg0NDg1NTMwNTV9LHsieCI6MzA2LjM5NDUzMTI1LCJ5IjoxNTc3LjQwNjI1fSx7IngiOjMwNi4zOTQ1MzEyNSwieSI6MTYzMC40MDYyNX1d" marker-end="url(#mermaid-1778504944333-t7wf0_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M460.729,1473.072L469.34,1490.461C477.951,1507.85,495.173,1542.628,503.784,1568.184C512.395,1593.74,512.395,1610.073,512.395,1618.24L512.395,1626.406" id="L_F_G_0" style=";" data-edge="true" data-et="edge" data-id="L_F_G_0" data-points="W3sieCI6NDYwLjcyODkzNjM5NDY5NDUzLCJ5IjoxNDczLjA3MTg0NDg1NTMwNTV9LHsieCI6NTEyLjM5NDUzMTI1LCJ5IjoxNTc3LjQwNjI1fSx7IngiOjUxMi4zOTQ1MzEyNSwieSI6MTYzMC40MDYyNX1d" marker-end="url(#mermaid-1778504944333-t7wf0_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path></g><g><g><g data-id="L_A_B_0" transform="translate(0, 0)"></g></g><g transform="translate(70, 507)"><g data-id="L_B_Z1_0" transform="translate(-41.81640625, -28)"><foreignObject width="83.6328125" height="56"><p>false，被锁</p></foreignObject></g></g><g transform="translate(288.39453125, 507)"><g data-id="L_B_C_0" transform="translate(-14.68359375, -28)"><foreignObject width="29.3671875" height="56"><p>true</p></foreignObject></g></g><g><g data-id="L_C_D_0" transform="translate(0, 0)"></g></g><g transform="translate(167.39453125, 1001.40625)"><g data-id="L_D_Z2_0" transform="translate(-41.81640625, -28)"><foreignObject width="83.6328125" height="56"><p>false，被锁</p></foreignObject></g></g><g transform="translate(409.39453125, 1001.40625)"><g data-id="L_D_E_0" transform="translate(-14.68359375, -28)"><foreignObject width="29.3671875" height="56"><p>true</p></foreignObject></g></g><g><g data-id="L_E_F_0" transform="translate(0, 0)"></g></g><g transform="translate(306.39453125, 1577.40625)"><g data-id="L_F_Z3_0" transform="translate(-41.81640625, -28)"><foreignObject width="83.6328125" height="56"><p>false，被锁</p></foreignObject></g></g><g transform="translate(512.39453125, 1577.40625)"><g data-id="L_F_G_0" transform="translate(-14.68359375, -28)"><foreignObject width="29.3671875" height="56"><p>true</p></foreignObject></g></g></g><g><g id="flowchart-A-0" transform="translate(179.197265625, 51)"><rect style="" x="-100.6015625" y="-43" width="201.203125" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-70.6015625, -28)"><rect></rect><foreignObject width="141.203125" height="56"><p>对话结束 Stop 触发</p></foreignObject></g></g><g id="flowchart-B-1" transform="translate(179.197265625, 299)"><polygon points="155,0 310,-155 155,-310 0,-155" transform="translate(-154.5, 155)" fill="none" stroke="currentColor"></polygon><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>feature EXTRACT_MEMORIES?</p></foreignObject></g></g><g id="flowchart-Z1-3" transform="translate(70, 603)"><rect style="" x="-62" y="-43" width="124" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-32, -28)"><rect></rect><foreignObject width="64" height="56"><p>直接跳过</p></foreignObject></g></g><g id="flowchart-C-5" transform="translate(288.39453125, 603)"><rect style="" x="-106.39453125" y="-43" width="212.7890625" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-76.39453125, -28)"><rect></rect><foreignObject width="152.7890625" height="56"><p>isExtractModeActive</p></foreignObject></g></g><g id="flowchart-D-7" transform="translate(288.39453125, 822.203125)"><polygon points="126.203125,0 252.40625,-126.203125 126.203125,-252.40625 0,-126.203125" transform="translate(-125.703125, 126.203125)" fill="none" stroke="currentColor"></polygon><g style="" transform="translate(-83.203125, -28)"><rect></rect><foreignObject width="166.40625" height="56"><p>tengu_passport_quail?</p></foreignObject></g></g><g id="flowchart-Z2-9" transform="translate(167.39453125, 1109.40625)"><rect style="" x="-62" y="-43" width="124" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-32, -28)"><rect></rect><foreignObject width="64" height="56"><p>直接跳过</p></foreignObject></g></g><g id="flowchart-E-11" transform="translate(409.39453125, 1109.40625)"><rect style="" x="-130" y="-55" width="260" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>executeExtractMemoriesImpl</p></foreignObject></g></g><g id="flowchart-F-13" transform="translate(409.39453125, 1369.40625)"><polygon points="155,0 310,-155 155,-310 0,-155" transform="translate(-154.5, 155)" fill="none" stroke="currentColor"></polygon><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>再次检查 tengu_passport_quail</p></foreignObject></g></g><g id="flowchart-Z3-15" transform="translate(306.39453125, 1673.40625)"><rect style="" x="-62" y="-43" width="124" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-32, -28)"><rect></rect><foreignObject width="64" height="56"><p>直接跳过</p></foreignObject></g></g><g id="flowchart-G-17" transform="translate(512.39453125, 1673.40625)"><rect style="" x="-94" y="-43" width="188" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-64, -28)"><rect></rect><foreignObject width="128" height="56"><p>真正开始提取记忆</p></foreignObject></g></g></g></g></g></svg>

三道门，每道都需要 GrowthBook 放行。逐一打开：

**第一道门** — `src/query/stopHooks.ts` ：

删掉 `feature('EXTRACT_MEMORIES')` 判断，同时把 `extractMemories` 模块的加载方式从条件 `require` 改成 static import——这步是后来测试时才发现必须做的，原来用 `feature()` 做条件 require 会被 bun 的 dead code elimination 把整个模块砍掉，导致运行时 null 调用崩溃（见后面踩坑记录）。

- const extractMemoriesModule = feature('EXTRACT_MEMORIES')

-   ? require('../services/extractMemories/extractMemories.js')

-   : null

+ import { executeExtractMemories } from '../services/extractMemories/extractMemories.js'

- if (

-   feature('EXTRACT_MEMORIES') &&

-   !toolUseContext.agentId &&

-   isExtractModeActive()

- ) {

+ if (

+   !toolUseContext.agentId &&

```java
+   isExtractModeActive()
+ ) {

- void extractMemoriesModule!.executeExtractMemories(...)
+ void executeExtractMemories(...) 
 第二道门 — src/memdir/paths.ts： - export function isExtractModeActive(): boolean {
-   if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_passport_quail', false)) {
-     return false
-   }
-   return (
-     !getIsNonInteractiveSession() ||
-     getFeatureValue_CACHED_MAY_BE_STALE('tengu_slate_thimble', false)
-   )
- }
+ export function isExtractModeActive(): boolean {
+   return !getIsNonInteractiveSession()
+ } 
 第三道门 — src/services/extractMemories/extractMemories.ts： - if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_passport_quail', false)) {
-   if (process.env.USER_TYPE === 'ant' && !hasLoggedGateFailure) {
-     hasLoggedGateFailure = true
-     logEvent('tengu_extract_memories_gate_disabled', {})
-   }
-   return
- } 
+ (getFeatureValue_CACHED_MAY_BE_STALE('tengu_bramble_lintel', null) ?? 3) 
-   return getFeatureValue_CACHED_MAY_BE_STALE('tengu_session_memory', false)
- }
```
-     return false

-   }

-   return (

-     !getIsNonInteractiveSession() ||

-     getFeatureValue_CACHED_MAY_BE_STALE('tengu_slate_thimble', false)

-   )

- }

+ export function isExtractModeActive(): boolean {

+   return !getIsNonInteractiveSession()

+ }

**第三道门** — `src/services/extractMemories/extractMemories.ts` ：

- if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_passport_quail', false)) {

-   if (process.env.USER_TYPE === 'ant' && !hasLoggedGateFailure) {

-     hasLoggedGateFailure = true

-     logEvent('tengu_extract_memories_gate_disabled', {})

-   }

-   return

- }

### 提高提取频率

原来的逻辑是"每次 stop 才跑一次提取"，实际上内部有个 throttle 参数 `tengu_bramble_lintel` ，默认值是 1（即每 1 个合格 turn 才提取一次）。改成 3，让它每 3 轮对话提取一次：

- (getFeatureValue_CACHED_MAY_BE_STALE('tengu_bramble_lintel', null) ?? 1)

+ (getFeatureValue_CACHED_MAY_BE_STALE('tengu_bramble_lintel', null) ?? 3)

3 是个平衡点——太频繁会在每次短对话后都跑一个后台模型，cost 飙升；太稀疏则失去"实时感知"的意义。Hermes 是每 turn 都跑，退了一步但保留了高频感。

### 记忆的分类结构

提取后的记忆会按 4 种类型写入 `~/.claude/projects/<hash>/memory/` 目录：

| 类型 | 存什么 | 使用场景 |
| --- | --- | --- |
| `user` | 用户角色、技术背景、知识水平 | 调整解释粒度和术语选用 |
| `feedback` | 用户纠正过的行为、确认过的做法 | 避免重复同样的错误，延续有效模式 |
| `project` | 项目上下文、截止日期、技术决策 | 理解需求背后的动机 |
| `reference` | 外部系统地址、工具链接 | 知道去哪里查 |

每个记忆文件有 frontmatter，包含 name、description、type，下次 session 开始时会被扫描成 manifest 注入 system prompt。

---

## 第三步：解锁 SessionMemory

这个功能在代码里叫 `tengu_session_memory` ，同样被 flag 锁住：

- function isSessionMemoryGateEnabled(): boolean {

-   return getFeatureValue_CACHED_MAY_BE_STALE('tengu_session_memory', false)

- }

+ function isSessionMemoryGateEnabled(): boolean {

+   return true

+ }

SessionMemory 和记忆提取不一样。记忆提取是在对话结束后把"值得长期记住的信息"写入分类文件；SessionMemory 是在对话进行中，每隔一段时间维护一个结构化的 session 摘要，存在 `session-memory/summary.md` 里，格式是固定模板：

# Session Title
# Current State
# Task specification
# Files and Functions
# Workflow
# Errors & Corrections
# Codebase and System Documentation
# Learnings
# Key results
# Worklog

触发条件也有门槛：对话 token 总量需要超过 10000 才初始化，之后每累计 3 次 tool call 更新一次。短对话不会触发。这个文件对跨 session 搜索很有价值，因为它比原始 JSONL 更结构化，信噪比高得多。

---

## 第四步：构建 FTS5 跨 session 搜索

这是整个改造里唯一需要从零写代码的部分。

### 为什么原来没有

Claude Code 其实有一个叫 `agenticSessionSearch` 的实现（ `src/utils/agenticSessionSearch.ts` ），但它是给 UI 层的会话历史浏览器用的，不是给对话中的模型用的。它用一个 LLM 做语义搜索，但没办法在对话里直接调用它。

FTS5 的方案更简单：一个独立的 SQLite 数据库，一个 Python 脚本，模型通过 Bash 工具调用，不依赖任何内部 API。

### 数据流

<svg id="mermaid-1778504944355-w9ysg" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 1878.435546875px;" viewBox="0 0 1878.435546875 1320.309326171875" role="graphics-document document" aria-roledescription="flowchart-v2"><g><marker id="mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944355-w9ysg_flowchart-v2-pointStart" viewBox="0 0 10 10" refX="4.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 5 L 10 10 L 10 0 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944355-w9ysg_flowchart-v2-circleEnd" viewBox="0 0 10 10" refX="11" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1778504944355-w9ysg_flowchart-v2-circleStart" viewBox="0 0 10 10" refX="-1" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1778504944355-w9ysg_flowchart-v2-crossEnd" viewBox="0 0 11 11" refX="12" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944355-w9ysg_flowchart-v2-crossStart" viewBox="0 0 11 11" refX="-1" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><g><g><g id="SQLite" data-look="classic"><rect style="" x="1348.865234375" y="819.6315975189209" width="521.5703125" height="492.6776828765869"></rect><g transform="translate(1584.423828125, 819.6315975189209)"><foreignObject width="50.453125" height="56"><p>SQLite</p></foreignObject></g></g><g id="索引脚本" data-look="classic"><rect style="" x="678.865234375" y="802.5629615783691" width="620" height="458.53308486938477"></rect><g transform="translate(956.865234375, 802.5629615783691)"><foreignObject width="64" height="56"><p>索引脚本</p></foreignObject></g></g><g id="数据源" data-look="classic"><rect style="" x="8" y="859.8828125" width="620.865234375" height="364"></rect><g transform="translate(294.4326171875, 859.8828125)"><foreignObject width="48" height="56"><p>数据源</p></foreignObject></g></g></g><g><path d="M448.433,949.883L478.505,949.883C508.577,949.883,568.721,949.883,602.96,949.883C637.199,949.883,645.532,949.883,653.865,949.883C662.199,949.883,670.532,949.883,683.428,954.726C696.323,959.569,713.782,969.256,722.511,974.099L731.24,978.942" id="L_A_C_0" style=";" data-edge="true" data-et="edge" data-id="L_A_C_0" data-points="W3sieCI6NDQ4LjQzMjYxNzE4NzUsInkiOjk0OS44ODI4MTI1fSx7IngiOjYyOC44NjUyMzQzNzUsInkiOjk0OS44ODI4MTI1fSx7IngiOjY1My44NjUyMzQzNzUsInkiOjk0OS44ODI4MTI1fSx7IngiOjY3OC44NjUyMzQzNzUsInkiOjk0OS44ODI4MTI1fSx7IngiOjczNC43MzczMjczOTgyNTU4LCJ5Ijo5ODAuODgyODEyNX1d" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M448.433,1121.883L478.505,1121.883C508.577,1121.883,568.721,1121.883,602.96,1121.883C637.199,1121.883,645.532,1121.883,653.865,1121.883C662.199,1121.883,670.532,1121.883,683.428,1117.04C696.323,1112.196,713.782,1102.51,722.511,1097.667L731.24,1092.823" id="L_B_C_0" style=";" data-edge="true" data-et="edge" data-id="L_B_C_0" data-points="W3sieCI6NDQ4LjQzMjYxNzE4NzUsInkiOjExMjEuODgyODEyNX0seyJ4Ijo2MjguODY1MjM0Mzc1LCJ5IjoxMTIxLjg4MjgxMjV9LHsieCI6NjUzLjg2NTIzNDM3NSwieSI6MTEyMS44ODI4MTI1fSx7IngiOjY3OC44NjUyMzQzNzUsInkiOjExMjEuODgyODEyNX0seyJ4Ijo3MzQuNzM3MzI3Mzk4MjU1OCwieSI6MTA5MC44ODI4MTI1fV0=" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M949.068,1090.883L955.701,1094.049C962.334,1097.216,975.599,1103.549,985.732,1106.716C995.865,1109.883,1002.865,1109.883,1006.365,1109.883L1009.865,1109.883" id="L_C_D_0" style=";" data-edge="true" data-et="edge" data-id="L_C_D_0" data-points="W3sieCI6OTQ5LjA2NzkzNzA3NzcwMjcsInkiOjEwOTAuODgyODEyNX0seyJ4Ijo5ODguODY1MjM0Mzc1LCJ5IjoxMTA5Ljg4MjgxMjV9LHsieCI6MTAxMy44NjUyMzQzNzUsInkiOjExMDkuODgyODEyNX1d" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M890.957,980.883L907.275,965.163C923.593,949.443,956.229,918.003,981.736,902.283C1007.243,886.563,1025.62,886.563,1034.809,886.563L1043.998,886.563" id="L_C_E_0" style=";" data-edge="true" data-et="edge" data-id="L_C_E_0" data-points="W3sieCI6ODkwLjk1NzQ0MjQ1OTczOTIsInkiOjk4MC44ODI4MTI1fSx7IngiOjk4OC44NjUyMzQzNzUsInkiOjg4Ni41NjI5NjE1NzgzNjkxfSx7IngiOjEwNDcuOTk4MDQ2ODc1LCJ5Ijo4ODYuNTYyOTYxNTc4MzY5MX1d" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M1232.471,1164.883L1243.536,1171.752C1254.602,1178.621,1276.734,1192.358,1291.966,1199.227C1307.199,1206.096,1315.532,1206.096,1323.865,1206.096C1332.199,1206.096,1340.532,1206.096,1348.199,1206.096C1355.865,1206.096,1362.865,1206.096,1366.365,1206.096L1369.865,1206.096" id="L_D_G_0" style=";" data-edge="true" data-et="edge" data-id="L_D_G_0" data-points="W3sieCI6MTIzMi40NzA1MDg4Mjg1MDQ4LCJ5IjoxMTY0Ljg4MjgxMjV9LHsieCI6MTI5OC44NjUyMzQzNzUsInkiOjEyMDYuMDk2MDQ2NDQ3NzU0fSx7IngiOjEzMjMuODY1MjM0Mzc1LCJ5IjoxMjA2LjA5NjA0NjQ0Nzc1NH0seyJ4IjoxMzQ4Ljg2NTIzNDM3NSwieSI6MTIwNi4wOTYwNDY0NDc3NTR9LHsieCI6MTM3My44NjUyMzQzNzUsInkiOjEyMDYuMDk2MDQ2NDQ3NzU0fV0=" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M1232.471,1054.883L1243.536,1048.014C1254.602,1041.145,1276.734,1027.407,1291.966,1020.538C1307.199,1013.67,1315.532,1013.67,1323.865,1013.67C1332.199,1013.67,1340.532,1013.67,1348.199,1013.67C1355.865,1013.67,1362.865,1013.67,1366.365,1013.67L1369.865,1013.67" id="L_D_H_0" style=";" data-edge="true" data-et="edge" data-id="L_D_H_0" data-points="W3sieCI6MTIzMi40NzA1MDg4Mjg1MDQ4LCJ5IjoxMDU0Ljg4MjgxMjV9LHsieCI6MTI5OC44NjUyMzQzNzUsInkiOjEwMTMuNjY5NTc4NTUyMjQ2MX0seyJ4IjoxMzIzLjg2NTIzNDM3NSwieSI6MTAxMy42Njk1Nzg1NTIyNDYxfSx7IngiOjEzNDguODY1MjM0Mzc1LCJ5IjoxMDEzLjY2OTU3ODU1MjI0NjF9LHsieCI6MTM3My44NjUyMzQzNzUsInkiOjEwMTMuNjY5NTc4NTUyMjQ2MX1d" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M1239.732,886.563L1249.588,886.563C1259.443,886.563,1279.154,886.563,1293.176,886.563C1307.199,886.563,1315.532,886.563,1323.865,886.563C1332.199,886.563,1340.532,886.563,1366.782,886.563C1393.032,886.563,1437.199,886.563,1481.365,886.563C1525.532,886.563,1569.699,886.563,1604.305,901.461C1638.912,916.36,1663.959,946.156,1676.482,961.054L1689.006,975.953" id="L_E_F_0" style=";" data-edge="true" data-et="edge" data-id="L_E_F_0" data-points="W3sieCI6MTIzOS43MzI0MjE4NzUsInkiOjg4Ni41NjI5NjE1NzgzNjkxfSx7IngiOjEyOTguODY1MjM0Mzc1LCJ5Ijo4ODYuNTYyOTYxNTc4MzY5MX0seyJ4IjoxMzIzLjg2NTIzNDM3NSwieSI6ODg2LjU2Mjk2MTU3ODM2OTF9LHsieCI6MTM0OC44NjUyMzQzNzUsInkiOjg4Ni41NjI5NjE1NzgzNjkxfSx7IngiOjE0ODEuMzY1MjM0Mzc1LCJ5Ijo4ODYuNTYyOTYxNTc4MzY5MX0seyJ4IjoxNjEzLjg2NTIzNDM3NSwieSI6ODg2LjU2Mjk2MTU3ODM2OTF9LHsieCI6MTY5MS41Nzk2NTc4ODI5OTQ1LCJ5Ijo5NzkuMDE0NzIzMzA1NDgzNn1d" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M1588.865,1206.096L1593.032,1206.096C1597.199,1206.096,1605.532,1206.096,1623.288,1187.821C1641.044,1169.546,1668.222,1132.996,1681.811,1114.721L1695.4,1096.445" id="L_G_F_0" style=";" data-edge="true" data-et="edge" data-id="L_G_F_0" data-points="W3sieCI6MTU4OC44NjUyMzQzNzUsInkiOjEyMDYuMDk2MDQ2NDQ3NzU0fSx7IngiOjE2MTMuODY1MjM0Mzc1LCJ5IjoxMjA2LjA5NjA0NjQ0Nzc1NH0seyJ4IjoxNjk3Ljc4NzEyODczOTMxMzIsInkiOjEwOTMuMjM1NjI4MjEwMDY4Mn1d" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path></g><g><g><g data-id="L_A_C_0" transform="translate(0, 0)"></g></g><g><g data-id="L_B_C_0" transform="translate(0, 0)"></g></g><g><g data-id="L_C_D_0" transform="translate(0, 0)"></g></g><g><g data-id="L_C_E_0" transform="translate(0, 0)"></g></g><g><g data-id="L_D_G_0" transform="translate(0, 0)"></g></g><g><g data-id="L_D_H_0" transform="translate(0, 0)"></g></g><g><g data-id="L_E_F_0" transform="translate(0, 0)"></g></g><g><g data-id="L_G_F_0" transform="translate(0, 0)"></g></g></g><g><g transform="translate(25, 0)"><g><g id="搜索" data-look="classic"><rect style="" x="8" y="8" width="570.865234375" height="816.8828125"></rect><g transform="translate(277.4326171875, 8)"><foreignObject width="32" height="56"><p>搜索</p></foreignObject></g></g></g><g><path d="M285.74,131.5L285.74,137.75C285.74,144,285.74,156.5,285.74,168.333C285.74,180.167,285.74,191.333,285.74,196.917L285.74,202.5" id="L_I_J_0" style=";" data-edge="true" data-et="edge" data-id="L_I_J_0" data-points="W3sieCI6Mjg1Ljc0MDIzNDM3NSwieSI6MTMxLjV9LHsieCI6Mjg1Ljc0MDIzNDM3NSwieSI6MTY5fSx7IngiOjI4NS43NDAyMzQzNzUsInkiOjIwNi41fV0=" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M244.603,344.245L229.466,362.018C214.33,379.791,184.058,415.337,168.921,443.36C153.785,471.383,153.785,491.883,153.785,502.133L153.785,512.383" id="L_J_K_0" style=";" data-edge="true" data-et="edge" data-id="L_J_K_0" data-points="W3sieCI6MjQ0LjYwMjU4MjMyMjQxNTEsInkiOjM0NC4yNDUxNjA0NDc0MTUxfSx7IngiOjE1My43ODUxNTYyNSwieSI6NDUwLjg4MjgxMjV9LHsieCI6MTUzLjc4NTE1NjI1LCJ5Ijo1MTYuMzgyODEyNX1d" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M326.878,344.245L342.014,362.018C357.15,379.791,387.423,415.337,402.559,443.36C417.695,471.383,417.695,491.883,417.695,502.133L417.695,512.383" id="L_J_L_0" style=";" data-edge="true" data-et="edge" data-id="L_J_L_0" data-points="W3sieCI6MzI2Ljg3Nzg4NjQyNzU4NDksInkiOjM0NC4yNDUxNjA0NDc0MTUxfSx7IngiOjQxNy42OTUzMTI1LCJ5Ijo0NTAuODgyODEyNX0seyJ4Ijo0MTcuNjk1MzEyNSwieSI6NTE2LjM4MjgxMjV9XQ==" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M153.785,602.383L153.785,608.633C153.785,614.883,153.785,627.383,162.155,639.5C170.525,651.617,187.265,663.352,195.635,669.219L204.005,675.087" id="L_K_M_0" style=";" data-edge="true" data-et="edge" data-id="L_K_M_0" data-points="W3sieCI6MTUzLjc4NTE1NjI1LCJ5Ijo2MDIuMzgyODEyNX0seyJ4IjoxNTMuNzg1MTU2MjUsInkiOjYzOS44ODI4MTI1fSx7IngiOjIwNy4yODA0NTgxOTI1Njc1NSwieSI6Njc3LjM4MjgxMjV9XQ==" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M417.695,602.383L417.695,608.633C417.695,614.883,417.695,627.383,409.325,639.5C400.955,651.617,384.215,663.352,375.845,669.219L367.475,675.087" id="L_L_M_0" style=";" data-edge="true" data-et="edge" data-id="L_L_M_0" data-points="W3sieCI6NDE3LjY5NTMxMjUsInkiOjYwMi4zODI4MTI1fSx7IngiOjQxNy42OTUzMTI1LCJ5Ijo2MzkuODgyODEyNX0seyJ4IjozNjQuMjAwMDEwNTU3NDMyNDUsInkiOjY3Ny4zODI4MTI1fV0=" marker-end="url(#mermaid-1778504944355-w9ysg_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path></g><g><g><g data-id="L_I_J_0" transform="translate(0, 0)"></g></g><g transform="translate(153.78515625, 450.8828125)"><g data-id="L_J_K_0" transform="translate(-16, -28)"><foreignObject width="32" height="56"><p>英文</p></foreignObject></g></g><g transform="translate(417.6953125, 450.8828125)"><g data-id="L_J_L_0" transform="translate(-36, -28)"><foreignObject width="72" height="56"><p>中文/日文</p></foreignObject></g></g><g><g data-id="L_K_M_0" transform="translate(0, 0)"></g></g><g><g data-id="L_L_M_0" transform="translate(0, 0)"></g></g></g><g><g id="flowchart-I-8" transform="translate(285.740234375, 88.5)"><rect style="" x="-124.59375" y="-43" width="249.1875" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-94.59375, -28)"><rect></rect><foreignObject width="189.1875" height="56"><p>session_search.py search</p></foreignObject></g></g><g id="flowchart-J-9" transform="translate(285.740234375, 295.94140625)"><polygon points="89.44140625,0 178.8828125,-89.44140625 89.44140625,-178.8828125 0,-89.44140625" transform="translate(-88.94140625, 89.44140625)" fill="none" stroke="currentColor"></polygon><g style="" transform="translate(-46.44140625, -28)"><rect></rect><foreignObject width="92.8828125" height="56"><p>是否含 CJK?</p></foreignObject></g></g><g id="flowchart-K-10" transform="translate(153.78515625, 559.3828125)"><rect style="" x="-91.5703125" y="-43" width="183.140625" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-61.5703125, -28)"><rect></rect><foreignObject width="123.140625" height="56"><p>查 messages_fts</p></foreignObject></g></g><g id="flowchart-L-11" transform="translate(417.6953125, 559.3828125)"><rect style="" x="-122.33984375" y="-43" width="244.6796875" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-92.33984375, -28)"><rect></rect><foreignObject width="184.6796875" height="56"><p>查 messages_fts_trigram</p></foreignObject></g></g><g id="flowchart-M-12" transform="translate(285.740234375, 732.3828125)"><rect style="" x="-130" y="-55" width="260" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>返回 JSON\n含 snippet 高亮</p></foreignObject></g></g></g></g><g id="flowchart-A-0" transform="translate(318.4326171875, 949.8828125)"><rect style="" x="-130" y="-55" width="260" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>JSONL 对话文件\n~/.claude/projects/</p></foreignObject></g></g><g id="flowchart-B-1" transform="translate(318.4326171875, 1121.8828125)"><rect style="" x="-130" y="-67" width="260" height="134" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -52)"><rect></rect><foreignObject width="200" height="104"><p>SessionMemory 摘要\nsession-memory/summary.md</p></foreignObject></g></g><g id="flowchart-C-2" transform="translate(833.865234375, 1035.8828125)"><rect style="" x="-130" y="-55" width="260" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>session_search.py index\n增量扫描 mtime</p></foreignObject></g></g><g id="flowchart-D-3" transform="translate(1143.865234375, 1109.8828125)"><rect style="" x="-130" y="-55" width="260" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>解析 JSONL\n提取 user/assistant 消息</p></foreignObject></g></g><g id="flowchart-E-4" transform="translate(1143.865234375, 886.5629615783691)"><rect style="" x="-95.8671875" y="-43" width="191.734375" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-65.8671875, -28)"><rect></rect><foreignObject width="131.734375" height="56"><p>读取 summary.md</p></foreignObject></g></g><g id="flowchart-F-5" transform="translate(1742.150390625, 1035.8828125)"><path d="M0,15.575151386630852 a103.28515625,15.575151386630852 0,0,0 206.5703125,0 a103.28515625,15.575151386630852 0,0,0 -206.5703125,0 l0,86.57515138663085 a103.28515625,15.575151386630852 0,0,0 206.5703125,0 l0,-86.57515138663085" style="" label-offset-y="15.575151386630852" transform="translate(-103.28515625, -58.862727079946275)" fill="none" stroke="currentColor"></path><g style="" transform="translate(-95.78515625, -18)"><rect></rect><foreignObject width="191.5703125" height="56"><p>sessions 表\n元数据+摘要</p></foreignObject></g></g><g id="flowchart-G-6" transform="translate(1481.365234375, 1206.096046447754)"><path d="M0,15.808823529411764 a107.5,15.808823529411764 0,0,0 215,0 a107.5,15.808823529411764 0,0,0 -215,0 l0,110.80882352941177 a107.5,15.808823529411764 0,0,0 215,0 l0,-110.80882352941177" style="" label-offset-y="15.808823529411764" transform="translate(-107.5, -71.21323529411765)" fill="none" stroke="currentColor"></path><g style="" transform="translate(-100, -30)"><rect></rect><foreignObject width="200" height="80"><p>messages_fts\nunicode61 tokenizer</p></foreignObject></g></g><g id="flowchart-H-7" transform="translate(1481.365234375, 1013.6695785522461)"><path d="M0,15.808823529411764 a107.5,15.808823529411764 0,0,0 215,0 a107.5,15.808823529411764 0,0,0 -215,0 l0,110.80882352941177 a107.5,15.808823529411764 0,0,0 215,0 l0,-110.80882352941177" style="" label-offset-y="15.808823529411764" transform="translate(-107.5, -71.21323529411765)" fill="none" stroke="currentColor"></path><g style="" transform="translate(-100, -30)"><rect></rect><foreignObject width="200" height="80"><p>messages_fts_trigram\ntrigram tokenizer</p></foreignObject></g></g></g></g></g></svg>

### 双表设计的原因

标准 FTS5 用 `unicode61` tokenizer，它对 CJK 字符的处理是把每个字切开，这样"商家诊断"会被切成"商"、"家"、"诊"、"断"四个 token，FTS5 的短语搜索就失效了。

Hermes 用了同样的解法：维护两张 FTS5 表，一张普通，一张 trigram。Trigram tokenizer 会把每 3 个字符切成一个 token，所以"商家诊断"会有"商家诊"、"家诊断"这样的 token，子串搜索就能工作了。查询时检测输入是否包含 CJK 字符，自动选择合适的表。单个汉字没有对应 token，搜不到，这是 trigram 的固有限制。

### 核心实现

def extract_text(content):
    """提取消息内容，处理字符串和 block 数组两种格式。"""
```java
    if isinstance(content, str):
        return content
    if isinstance(content, list):
```
        parts = []
```java
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "tool_result":
                    for sub in block.get("content", []):
                        if isinstance(sub, dict) and sub.get("type") == "text":
                            parts.append(sub.get("text", ""))
        return " ".join(p for p in parts if p)
    return ""
```

增量索引用文件 mtime 做判断，不重复扫描没变过的文件：

mtime = datetime.fromtimestamp(jsonl_path.stat().st_mtime).isoformat()
row = conn.execute(
    "SELECT last_indexed FROM sessions WHERE session_id=?", (session_id,)
```java
).fetchone()
if row and row[0] >= mtime:
    return 0  # 没变，跳过
```

### 自动更新：Stop Hook

每次对话结束后，通过 `settings.json` 的 Stop hook 触发索引更新：

"hooks": {
  "Stop": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "python3 ~/.claude/scripts/session_search.py index > /dev/null 2>&1 &"
        }
      ]
    }
  ]
}

`&` 让它在后台跑，不阻塞 Claude Code 的响应。

### 使用方式

做成一个 Skill，让模型知道这个工具的存在和调用方式。当你问"上次我们怎么处理那个 feature flag 的问题"，模型会自动调用 Bash 执行搜索脚本，把结果拿回来分析。脚本和 SKILL.md 放在同一个目录 `~/.claude/skills/session-search/` 下方便管理。

---

## 效果对比

### 和 Hermes 的差距还剩多少

| 特性 | Hermes | 改后的 Claude Code | 差距 |
| --- | --- | --- | --- |
| Skill 自动创建 | Agent 循环原生感知 | Stop hook 自动检测 | 基本对齐 |
| Skill 自动改进 | 内置，任意 Skill | 已解锁，仅项目级 Skill | 小差距 |
| 记忆提取频率 | 每 turn | 每 3 turn | 可接受 |
| 用户画像 | Honcho 独立服务 | memory/user 文件 | 更新频率略低 |
| 跨 session 搜索 | FTS5 实时索引 | FTS5 Stop hook 更新 | 基本对齐 |
| Session 实时摘要 | 无 | SessionMemory | Claude Code 反而领先 |
| 多平台 Gateway | Telegram/Discord 等 | 无 | 不是需求 |
| 多模型支持 | 200+ | Claude 系列 | 不是需求 |

到这里，和 Hermes 的核心差距已经基本填平。剩下的两项（多平台 Gateway、多模型支持）本来就不是需求。

---

## 第五步：Skill 自动创建

这是最后一块拼图，也是实现起来最有意思的部分。

### 解锁 /skillify

`/skillify` 是 Anthropic 内置的一个交互式 Skill 生成工具，被硬编码锁在内部员工账号下：

```javascript
// src/skills/bundled/skillify.ts
export function registerSkillifySkill(): void {
  if (process.env.USER_TYPE !== 'ant') {
    return   // 普通用户直接返回，功能不注册
  }
  registerBundledSkill({ name: 'skillify', ... })
}
```

把那个 if 删掉：

- export function registerSkillifySkill(): void {

-   if (process.env.USER_TYPE !== 'ant') {

-     return

-   }

-   registerBundledSkill({

+ export function registerSkillifySkill(): void {

+   registerBundledSkill({

解锁后可以在任意对话末尾调用 `/skillify` ，它会通过多轮 `AskUserQuestion` 交互，把这次对话的完整步骤提炼成 SKILL.md，包括参数定义、成功标准、工具权限等。

### 自动 Skill 创建（autoSkillify.ts）

`/skillify` 是手动的，Hermes 是全自动的。要补上这个差距，需要在 stop hook 里加一个后台判断逻辑。

新建 `src/utils/hooks/autoSkillify.ts` ，整体流程：

<svg id="mermaid-1778504944384-p37zs" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 577.6953125px;" viewBox="0 0 577.6953125 1401.03125" role="graphics-document document" aria-roledescription="flowchart-v2"><g><marker id="mermaid-1778504944384-p37zs_flowchart-v2-pointEnd" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944384-p37zs_flowchart-v2-pointStart" viewBox="0 0 10 10" refX="4.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 5 L 10 10 L 10 0 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944384-p37zs_flowchart-v2-circleEnd" viewBox="0 0 10 10" refX="11" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1778504944384-p37zs_flowchart-v2-circleStart" viewBox="0 0 10 10" refX="-1" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1778504944384-p37zs_flowchart-v2-crossEnd" viewBox="0 0 11 11" refX="12" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1778504944384-p37zs_flowchart-v2-crossStart" viewBox="0 0 11 11" refX="-1" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><g><g></g><g><path d="M217.801,94L217.801,98.167C217.801,102.333,217.801,110.667,217.801,118.333C217.801,126,217.801,133,217.801,136.5L217.801,140" id="L_A_B_0" style=";" data-edge="true" data-et="edge" data-id="L_A_B_0" data-points="W3sieCI6MjE3LjgwMDc4MTI1LCJ5Ijo5NH0seyJ4IjoyMTcuODAwNzgxMjUsInkiOjExOX0seyJ4IjoyMTcuODAwNzgxMjUsInkiOjE0NH1d" marker-end="url(#mermaid-1778504944384-p37zs_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M172.928,300.159L159.773,316.471C146.619,332.783,120.309,365.407,107.155,389.886C94,414.365,94,430.698,94,438.865L94,447.031" id="L_B_C_0" style=";" data-edge="true" data-et="edge" data-id="L_B_C_0" data-points="W3sieCI6MTcyLjkyODE2NDE4NzQwMjI3LCJ5IjozMDAuMTU4NjMyOTM3NDAyM30seyJ4Ijo5NCwieSI6Mzk4LjAzMTI1fSx7IngiOjk0LCJ5Ijo0NTEuMDMxMjV9XQ==" marker-end="url(#mermaid-1778504944384-p37zs_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M262.673,300.159L275.828,316.471C288.983,332.783,315.292,365.407,328.447,389.886C341.602,414.365,341.602,430.698,341.602,438.865L341.602,447.031" id="L_B_D_0" style=";" data-edge="true" data-et="edge" data-id="L_B_D_0" data-points="W3sieCI6MjYyLjY3MzM5ODMxMjU5NzcsInkiOjMwMC4xNTg2MzI5Mzc0MDIzfSx7IngiOjM0MS42MDE1NjI1LCJ5IjozOTguMDMxMjV9LHsieCI6MzQxLjYwMTU2MjUsInkiOjQ1MS4wMzEyNX1d" marker-end="url(#mermaid-1778504944384-p37zs_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M341.602,537.031L341.602,541.198C341.602,545.365,341.602,553.698,341.602,561.365C341.602,569.031,341.602,576.031,341.602,579.531L341.602,583.031" id="L_D_E_0" style=";" data-edge="true" data-et="edge" data-id="L_D_E_0" data-points="W3sieCI6MzQxLjYwMTU2MjUsInkiOjUzNy4wMzEyNX0seyJ4IjozNDEuNjAxNTYyNSwieSI6NTYyLjAzMTI1fSx7IngiOjM0MS42MDE1NjI1LCJ5Ijo1ODcuMDMxMjV9XQ==" marker-end="url(#mermaid-1778504944384-p37zs_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M341.602,697.031L341.602,701.198C341.602,705.365,341.602,713.698,341.602,721.365C341.602,729.031,341.602,736.031,341.602,739.531L341.602,743.031" id="L_E_F_0" style=";" data-edge="true" data-et="edge" data-id="L_E_F_0" data-points="W3sieCI6MzQxLjYwMTU2MjUsInkiOjY5Ny4wMzEyNX0seyJ4IjozNDEuNjAxNTYyNSwieSI6NzIyLjAzMTI1fSx7IngiOjM0MS42MDE1NjI1LCJ5Ijo3NDcuMDMxMjV9XQ==" marker-end="url(#mermaid-1778504944384-p37zs_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M291.646,857.031L283.623,865.865C275.6,874.698,259.554,892.365,251.531,909.365C243.508,926.365,243.508,942.698,243.508,950.865L243.508,959.031" id="L_F_G_0" style=";" data-edge="true" data-et="edge" data-id="L_F_G_0" data-points="W3sieCI6MjkxLjY0NjQxMjAzNzAzNzA3LCJ5Ijo4NTcuMDMxMjV9LHsieCI6MjQzLjUwNzgxMjUsInkiOjkxMC4wMzEyNX0seyJ4IjoyNDMuNTA3ODEyNSwieSI6OTYzLjAzMTI1fV0=" marker-end="url(#mermaid-1778504944384-p37zs_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M391.557,857.031L399.58,865.865C407.603,874.698,423.649,892.365,431.672,909.365C439.695,926.365,439.695,942.698,439.695,950.865L439.695,959.031" id="L_F_H_0" style=";" data-edge="true" data-et="edge" data-id="L_F_H_0" data-points="W3sieCI6MzkxLjU1NjcxMjk2Mjk2MjkzLCJ5Ijo4NTcuMDMxMjV9LHsieCI6NDM5LjY5NTMxMjUsInkiOjkxMC4wMzEyNX0seyJ4Ijo0MzkuNjk1MzEyNSwieSI6OTYzLjAzMTI1fV0=" marker-end="url(#mermaid-1778504944384-p37zs_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M439.695,1049.031L439.695,1053.198C439.695,1057.365,439.695,1065.698,439.695,1073.365C439.695,1081.031,439.695,1088.031,439.695,1091.531L439.695,1095.031" id="L_H_I_0" style=";" data-edge="true" data-et="edge" data-id="L_H_I_0" data-points="W3sieCI6NDM5LjY5NTMxMjUsInkiOjEwNDkuMDMxMjV9LHsieCI6NDM5LjY5NTMxMjUsInkiOjEwNzQuMDMxMjV9LHsieCI6NDM5LjY5NTMxMjUsInkiOjEwOTkuMDMxMjV9XQ==" marker-end="url(#mermaid-1778504944384-p37zs_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M439.695,1233.031L439.695,1237.198C439.695,1241.365,439.695,1249.698,439.695,1257.365C439.695,1265.031,439.695,1272.031,439.695,1275.531L439.695,1279.031" id="L_I_J_0" style=";" data-edge="true" data-et="edge" data-id="L_I_J_0" data-points="W3sieCI6NDM5LjY5NTMxMjUsInkiOjEyMzMuMDMxMjV9LHsieCI6NDM5LjY5NTMxMjUsInkiOjEyNTguMDMxMjV9LHsieCI6NDM5LjY5NTMxMjUsInkiOjEyODMuMDMxMjV9XQ==" marker-end="url(#mermaid-1778504944384-p37zs_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path></g><g><g><g data-id="L_A_B_0" transform="translate(0, 0)"></g></g><g transform="translate(94, 398.03125)"><g data-id="L_B_C_0" transform="translate(-8, -28)"><foreignObject width="16" height="56"><p>否</p></foreignObject></g></g><g transform="translate(341.6015625, 398.03125)"><g data-id="L_B_D_0" transform="translate(-8, -28)"><foreignObject width="16" height="56"><p>是</p></foreignObject></g></g><g><g data-id="L_D_E_0" transform="translate(0, 0)"></g></g><g><g data-id="L_E_F_0" transform="translate(0, 0)"></g></g><g transform="translate(243.5078125, 910.03125)"><g data-id="L_F_G_0" transform="translate(-8, -28)"><foreignObject width="16" height="56"><p>否</p></foreignObject></g></g><g transform="translate(439.6953125, 910.03125)"><g data-id="L_F_H_0" transform="translate(-8, -28)"><foreignObject width="16" height="56"><p>是</p></foreignObject></g></g><g><g data-id="L_H_I_0" transform="translate(0, 0)"></g></g><g><g data-id="L_I_J_0" transform="translate(0, 0)"></g></g></g><g><g id="flowchart-A-0" transform="translate(217.80078125, 51)"><rect style="" x="-100.6015625" y="-43" width="201.203125" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-70.6015625, -28)"><rect></rect><foreignObject width="141.203125" height="56"><p>对话结束 Stop 触发</p></foreignObject></g></g><g id="flowchart-B-1" transform="translate(217.80078125, 244.515625)"><polygon points="100.515625,0 201.03125,-100.515625 100.515625,-201.03125 0,-100.515625" transform="translate(-100.015625, 100.515625)" fill="none" stroke="currentColor"></polygon><g style="" transform="translate(-57.515625, -28)"><rect></rect><foreignObject width="115.03125" height="56"><p>tool calls &gt;= 8?</p></foreignObject></g></g><g id="flowchart-C-3" transform="translate(94, 494.03125)"><rect style="" x="-86" y="-43" width="172" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-56, -28)"><rect></rect><foreignObject width="112" height="56"><p>跳过，太简单了</p></foreignObject></g></g><g id="flowchart-D-5" transform="translate(341.6015625, 494.03125)"><rect style="" x="-111.6015625" y="-43" width="223.203125" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-81.6015625, -28)"><rect></rect><foreignObject width="163.203125" height="56"><p>提取最近60条消息摘要</p></foreignObject></g></g><g id="flowchart-E-7" transform="translate(341.6015625, 642.03125)"><rect style="" x="-130" y="-55" width="260" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>读取已有 auto-generated skill 列表</p></foreignObject></g></g><g id="flowchart-F-9" transform="translate(341.6015625, 802.03125)"><rect style="" x="-130" y="-55" width="260" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>小模型判断:\n是可复用工作流且不重复?</p></foreignObject></g></g><g id="flowchart-G-11" transform="translate(243.5078125, 1006.03125)"><rect style="" x="-46" y="-43" width="92" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-16, -28)"><rect></rect><foreignObject width="32" height="56"><p>跳过</p></foreignObject></g></g><g id="flowchart-H-13" transform="translate(439.6953125, 1006.03125)"><rect style="" x="-100.1875" y="-43" width="200.375" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-70.1875, -28)"><rect></rect><foreignObject width="140.375" height="56"><p>生成完整 SKILL.md</p></foreignObject></g></g><g id="flowchart-I-15" transform="translate(439.6953125, 1166.03125)"><rect style="" x="-130" y="-67" width="260" height="134" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -52)"><rect></rect><foreignObject width="200" height="104"><p>写入 ~/.claude/skills/auto-generated/name/</p></foreignObject></g></g><g id="flowchart-J-17" transform="translate(439.6953125, 1338.03125)"><rect style="" x="-130" y="-55" width="260" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -40)"><rect></rect><foreignObject width="200" height="80"><p>appendSystemMessage 通知用户</p></foreignObject></g></g></g></g></g></svg>

阈值设 8 个 tool call 是有意为之的——8 次工具调用意味着至少经历了 4-5 个有意义的步骤，这种复杂度的任务才值得提炼成可复用模式。简单的"帮我看一下这个文件"绝对不会触发。

判断 prompt 的核心约束：

决定这个对话是否值得保存为可复用 Skill，标准：
1. 有清晰的可重复步骤，适用于类似的未来任务
2. 不和已有的 auto-generated skill 重复
3. 不是只针对当前特定上下文的一次性任务
4. 至少有 3 个有意义的步骤

保守策略——不确定就输出 NO

这个"保守策略"很重要。如果模型每次对话都创建 Skill，很快就堆成一堆垃圾。宁可漏掉，不要乱创建。

### 挂入 stop hook

在 `src/query/stopHooks.ts` 的 `!isBareMode()` 块里追加：

```javascript
import { executeAutoSkillify } from '../utils/hooks/autoSkillify.js'

// 在 executeAutoDream 之后追加
if (!toolUseContext.agentId) {
    void executeAutoSkillify(stopHookContext, toolUseContext.appendSystemMessage)
}
```

和其他后台任务一样，fire-and-forget，不阻塞主对话。

### 生成的 Skill 长什么样

写到 `~/.claude/skills/auto-generated/<name>/SKILL.md` ，格式和手写 Skill 一致：

---
name: hermes-source-analysis
description: 分析开源 Agent 框架源码并提取核心设计模式
when_to_use: Use when analyzing a GitHub repository's architecture. Examples: '分析这个项目的源码', 'read the codebase'
---

# Hermes Source Analysis

## Goal
系统性读取 GitHub 项目的核心模块，输出架构分析报告

## Steps

### 1. 获取目录结构
通过 GitHub API 列出根目录和关键子目录内容

**Success criteria**: 拿到完整的目录树，识别出核心模块路径

### 2. 读取关键文件
...

用户可以直接编辑这个文件精修，或者用 `/skillify` 重新走交互式生成流程得到更完整的版本。

---

## 技术细节：bun 的 dead code elimination 和条件 require

`feature()` 的导入来自 `bun:bundle` ，这是 Bun 的一个特殊模块， **bundle 时会把 `feature('X')` 替换成编译期常量 `true` 或 `false` ，再让 dead code elimination 删掉不可达分支** 。所以 `feature('SKILL_IMPROVEMENT')` 在 dist 里就是 `false` ，整个 if 分支被删了。

这个机制在大多数地方是透明的——删掉 if 条件就等于解锁。但 `extractMemories` 的加载方式特殊：它用了条件 require：

const extractMemoriesModule = feature('EXTRACT_MEMORIES')
  ? require('../services/extractMemories/extractMemories.js')
  : null

bun 把 `feature('EXTRACT_MEMORIES')` 替换成 `false` ，整个三元表达式变成 `null` ，同时把 `extractMemories` 模块当死代码一起砍掉——连 `executeExtractMemories` 函数都不在 dist 里了。我们删掉 if 条件之后，调用的还是 null，必然 TypeError，而且因为是 `void` 调用（fire-and-forget）错误被静默吞掉。

解法是改成 static import，让 bun 无论如何都把模块打进 dist：

- const extractMemoriesModule = feature('EXTRACT_MEMORIES')

-   ? require('../services/extractMemories/extractMemories.js')

-   : null

+ import { executeExtractMemories } from '../services/extractMemories/extractMemories.js'

---

## 踩过的坑

### 坑一：以为只有一层 flag

第一次改完 `stopHooks.ts` 之后满以为完了，结果记忆提取还是不跑。读了 `extractMemories.ts` 才发现里面还有一个 `tengu_passport_quail` 检查，是第三道门，不是第二道。在 `paths.ts` 里的是第二道。三道门串联在一起，任何一道没打开都不行。

### 坑二：CJK 搜索失效

最开始只建了 `messages_fts` 一张表，搜"hermes agent"完全正常，搜"商家诊断"返回空。加了 trigram 表之后中文就有了，但 trigram 表对英文的搜索质量不如 unicode61，所以最终保留两张表分别处理。

### 坑三：JSONL 里 content 字段的格式

Claude Code 的消息格式有两种：content 是字符串（早期简单消息），或者 content 是 block 数组（tool_use、tool_result、text 混在一起）。最开始只处理了字符串格式，导致有大量对话的实际内容没有被索引进去。把 `extract_text` 函数改成处理 block 数组之后才正常。

### 坑四：autoSkillify 的 } 多了一个

在 `stopHooks.ts` 里插代码时，手滑多加了一个 `}` ，把函数提前关闭了，后面两百行代码变成了孤立的语句，build 直接报"yield outside generator"。错误信息和实际原因差了很远，排查花了一点时间。

### 坑五：条件 require 被 bun DCE 删掉

记忆提取改完 build 之后，运行时完全没有任何报错，但记忆一条都没提取出来。后来专门做了测试才发现： `extractMemoriesModule` 在 dist 里是 `null` ，因为 bun 把整个条件 require 当死代码删了（见上面的技术细节）。改成 static import 才解决。这个坑特别难发现，因为调用是 `void` 包裹的，TypeError 被静默吞掉。

---

## 最后

整件事从发现 Hermes 到改完 Claude Code到后来又做测试把坑五挖出来修掉。代码改动本身不多，大部分时间在读源码理解结构。

对 Anthropic 的工程师来说，这些功能可能还在内测阶段，还没准备好面向所有用户开放。但代码质量很高，设计也很扎实——特别是记忆提取那套"forked agent + ephemeral injection + prompt cache 保护"的组合，每个决策背后都有明确的理由。能读到这个级别的内部实现，比 Hermes 给的那套外部接口学到的东西多得多。

有时候最好的"开源替代品"就在闭源工具的源码里藏着，差的只是一把钥匙。

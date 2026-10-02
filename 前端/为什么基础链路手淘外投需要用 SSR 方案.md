---
title: "为什么基础链路手淘外投需要用 SSR 方案"
source: "https://ata.atatech.org/articles/11000239411?spm=ata.25287382.0.0.7f9018382iF7fl"
author:
published:
created: 2026-06-29
description:
tags:
  - "clippings"
---
中国电商事业群-淘天集团

勋章

粉丝 349影响力 3.5k

** 51

** 28

** 7

** 原创文章

** 内部资料

发表到圈儿

[大淘宝前端技术-TaoFED](https://ata.atatech.org/community/team/11) / [Web开发](https://ata.atatech.org/community/team/11?cid=91) (首发)

**

[吴佐衍(永霸)](https://ata.atatech.org/users/11000071770)

2022-06-08发表2023-08-13更新1.4k浏览

** 字号

** 笔记

** 分享 **

基础链路团队从 2018 年新奥创升级开始，不断在探索手淘内与手淘外的体验方案。在 2019 年，集团与蚂蚁小程序容器统一的背景下，我们建设了 [基础链路小程序电商套件](https://ata.alibaba-inc.com/articles/186486?spm=ata.25287382.0.0.4d437536mICZ4l) ，以此希望提升集团二方 APP 场景下的浏览与购物体验；从 2020 年 MiniDetail，到 2021 年 NewDetail/ [NewBuy](https://ata.alibaba-inc.com/articles/218800?spm=ata.25287382.0.0.4d437536mICZ4l) 两个项目，我们尝试了 [Native 业务容器 + Weex UI 的混合架构方案](https://ata.alibaba-inc.com/articles/239265) ，探索手淘内体验与研发效率的双重平衡；随着集团与蚂蚁断流，2021 年微信单聊与群聊场景放开了淘系的链接拦截，我们需要探索手淘端外的性能体验方案；本文是针对过去一年 [基础链路外投场景性能优化](https://ata.alibaba-inc.com/articles/219497?spm=ata.25287382.0.0.1ff77536KYncSa) 的阶段性总结，当然基础链路的体验优化，包括手淘内、PC、H5 一直在持续进行中。

名词解释：

●

SSR（Server Side Rendering）：在服务器端渲染完整的页面 HTML

●

CSR（Client Side Rendering）：在浏览器端渲染完整的页面 HTML

●

端外：手淘之外的环境，包括浏览器、微信、集团二方 APP、百川媒体等。

### 外投场景（非手淘，以 H5 详情为例）

●

微信与 QQ：在 2021 年 9 月工信部展开互联互通专项治理，QQ 支持打开淘系外链；微信在单聊与群聊场景放开了淘系的链接访问，同时手淘分享到微信的淘口令也从文本切到文本+链接的模式，支持直接在微信内打开。近一周微信详情的 UV/PV 均值为 360W/1000W，QQ UV/PV 为 20W/40W。

●

手淘极简包：在 2021 年 3 月启动了手淘极简包项目，期望通过 3M 极简小包与厂商预装包为手淘拉新，预装包场景使用 H5 承载基础交易，日均 70W 左右的活跃设备

●

集团二方 APP：在一淘、闲鱼、支付宝、菜鸟、高德、蜂鸟、千牛等集团二方 APP 中有合作与广告投放，普遍使用 H5 承载基础交易。日均 UV/PV 在 1200W/4000W

●

媒体&浏览器：以阿里妈妈外投广告、百川媒体、浏览器的自然流量为主，这些场景以唤起手淘 APP 为主要目标，日均 UV/PV 在 400W/1000W

![[605f27e8-d4b0-4c4e-b2df-6e1a2c95c5ce.png]]

### 为什么要做性能优化

在媒体&浏览器场景中，以唤端为主，同时由于唤端导致这些场景的基础链路基本不能用；集团二方主要使用小程序来承载；基于上述原因站外 H5 的体验没有作为高优的项目去推进。当前由于以下内外部环境的变化，我们需要重新考虑站外性能优化。

●

微信生态闭环：目前在微信场景里 iOS 虽然支持 universallink，但经常被微信封杀，需要与微信频繁攻防，不确定性高；Android 只能通过打开浏览器再唤端，唤端链路长、效率低。在微信 H5 访问用户中通过唤端回到手淘的占比只有 1.5%，日均 5.5W。同时，当前微信对淘系的开放是有限的，不支持微信开放 SDK 与微信小程序。为了提升微信场景里用户的浏览与购物体验，性能优化是必要的。

●

集团二方 APP：2019 年在集团二方场景，我们构建了小程序电商套件来解决集团 APP 内的体验问题，但从今天视角看，除了淘宝、支付宝、高德之外，大部分 APP 没有接小程序容器且未来也没有计划。

●

极简包：极简包的用户以 Android 低端机为主，对页面的打开性能有强诉求。

●

竞对体验：对外 PDD 与 JD，我们的 H5 性能差距很大。

vivo Y67 淘宝详情 CSR vs PDD 详情微信场景下打开速度对比，淘宝详情打开速度远远落后 PDD

<video src="https://oss-ata.alibaba.com/articleVideo/2024/03/609217fb-bb39-484a-bfe8-30520c8e21e0.mp4" controls=""></video>

### 手淘内性能优化方案

●

从 13 年 ALLIN 无线开始，手淘的 H5 架构转向彻底前后端架构分离的 CSR 渲染模式，即前端负责页面的研发与用户的交互逻辑，服务端只提供数据。

●

在手淘内打开一个普通的 H5 页面加载过程如下，路由->容器->WebView->HTML加载->JS/CSS 加载->Mtop 请求->内容渲染->图片/视频资源加载。问题：关键渲染链路非常的长，给人 H5 体验不好的印象。

![[cc630730-c9fd-453e-88ea-068c4dd29919.png]] ●

CSR 的网络加载瀑布流（第 34 个请求是主图）

![[1b04f279-0a1d-435f-88c9-842e49c8e6a6.png]] ●

为了解决这个问题，这些年淘系前端与客户端团队沉淀了一套非常好的性能优化方案。该方案构建在手淘统一的 Web 容器上，核心思路是：减少网络请求次数与体积、提升单位时间内渲染效率。

○

离线化：通过 zcache/离线包提前将 JS 等关键资源内置到用户端，用户访问时直接从本地读取；

○

预渲染：在合适时机提前创建 WebView，并执行页面的离屏预渲染，将渲染结果缓存于内存。在用户真正点击手淘内的某个入口时，自动将当前缓存页面直接展示，移除用户等待过程，浏览体验上实现了“直接可视”。当前除了会场外，大部分业务享受不到。

○

预加载：利用 data-prefetch 等方案，在用户点击时提前进行页面主接口数据的预取，将原来的串行链路改为并行。

○

UC WebView：手淘 Android 默认集成 UC WebView 为业务提供统一的高性能渲染容器，解决 Andorid WebView 碎片化、渲染性能不佳的问题

![[48be740b-1382-4b98-ad38-bfb83fe4bd92.png]]

### 端外性能优化挑战

●

基础设施不统一：集团与蚂蚁的端侧方案是两套不同的技术体系，同时集团二方 APP 的端侧基础设施也不一致。这导致需要多端投放的业务很难复用手淘优化方案，性能优化成本很高。例如，资源内置（zcache）集团与蚂蚁需要走两套独立的打包与发布流程，且集团 APP 间实现上的不一致可能引发潜在故障。

●

中低端设备占比高：在极简包场景中，由于大部分设备都是 Android 低端机，网络 IO 与 JS 的执行效率低下。

●

缺少可控容器：在微信场景中，缺少可控的统一容器，传统 CSR 优化方案性能提升有限。

### 站外 SSR 性能方案

为了解决站外缺少统一可控容器的问题，我们将渲染逻辑从用户端前置到服务端，让服务端作为统一容器，即 SSR。服务端统一渲染容器具有以下优势：

●

统一的高性能渲染容器，对比端侧复杂的环境，在线的 FaaS 容器一般来说具有更高的执行性能。

●

高效的 I/O 通信，在 FaaS 场景中 JS 在本地，业务数据请求属于机房内/间的通信，对比 CSR 渲染在网络的请求次数与请求时间明显下降。

●

极简关键渲染路径，Faas 端直接返回完整的页面内容，在用户端 HTML 加载完成即可完成页面内容的渲染。

![[0122c188-fd9a-4f0a-8867-d5122abbd439.png]] ●

SSR 的网络加载瀑布流（第 2 个网络请求是主图）

![[824c1c00-3222-4327-b6a0-a64472ea07d6.png]]

### 为什么用 FaaS

2019 年随着云原生基础设施的发展和阿里云函数计算产品共建的 Node.js FaaS 的设施逐渐完善，广泛应用到很多 BU 的业务场景中，目前已经比较成熟，在单个单元提供 SLA 99.95 的承诺。主要考虑到 React SSR 的前后端同构，以及 FaaS 架构较为细粒度的故障隔离域，还有比较低的运维成本，综合来看比较合适。

Node.js Faas 在稳定性、研发效率、运维成本等方面对比其他方案具有明显优势。

<table><colgroup><col width="108"> <col width="108"> <col width="108"> <col width="108"> <col width="108"> <col width="108"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>方案</p></td><td rowspan="1" colspan="1"><p>稳定性</p></td><td rowspan="1" colspan="1"><p>研发效率</p></td><td rowspan="1" colspan="1"><p>运维成本</p></td><td rowspan="1" colspan="1"><p>性能</p></td><td rowspan="1" colspan="1"><p>可复用性</p></td></tr><tr><td rowspan="1" colspan="1"><p>Java VM 渲染</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>中</p></td><td rowspan="1" colspan="1"><p>差</p></td></tr><tr><td rowspan="1" colspan="1"><p>Java + Node 同机部署方案</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>中</p></td><td rowspan="1" colspan="1"><p>差</p></td></tr><tr><td rowspan="1" colspan="1"><p>Node.js FaaS</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>高</p></td><td rowspan="1" colspan="1"><p>低</p></td><td rowspan="1" colspan="1"><p>好</p></td><td rowspan="1" colspan="1"><p>好</p></td></tr></tbody></table>

面向 SSR 的使用场景，集团内的 FaaS 提供了基本满足使用的能力：

1.

单元化：对齐电商的单元化部署需求，在张家口、上海、深圳都有部署，可以对齐单元化容灾

2.

CSR 降级能力：面向 SSR 场景，提供了当 SSR 超时（默认 1s）降级为 CSR 的能力

3.

中间件：中间件团队官方提供了多语言中间件方案，解决了原来 Node.js 低质量的中间件实现问题

4.

观测性：分布式链路、Metrics 等基本的观测性能力，也比较完善

5.

Node.js/V8 VM 的异常诊断：这一块淘系这边能力的储备也比较完善

### 性能优化结果

●

线下数据：数据指标为点击到首屏完全展示，测试环境是微信的 wifi 环境，4 次取均值。

<table><colgroup><col width="216"> <col width="216"> <col width="216"></colgroup><tbody><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><p>pdd</p></td><td rowspan="1" colspan="1"><p>tb</p></td></tr><tr><td rowspan="1" colspan="1"><p>高端机（iOS 13 pro）</p></td><td rowspan="1" colspan="1"><p>1.25s</p></td><td rowspan="1" colspan="1"><p>0.88s</p></td></tr><tr><td rowspan="1" colspan="1"><p>低端机（vivo Y67）</p></td><td rowspan="1" colspan="1"><p>2.8s</p></td><td rowspan="1" colspan="1"><p>2.2s</p></td></tr></tbody></table>

●

vivo Y67 淘宝详情 SSR 版本 vs PDD 详情微信场景下打开速度对比，淘宝详情已经超过 PDD；

<video src="https://oss-ata.alibaba.com/articleVideo/2024/03/418b051c-453f-4c85-abd9-211dd70f3fa2.mp4" controls=""></video>●

线上数据：以首图渲染完成为准，SSR 详情除了首字节与白屏略慢于 CSR 之外，首屏性能提升非常明显

<table><colgroup><col width="108"> <col width="108"> <col width="108"> <col width="108"> <col width="108"> <col width="108"></colgroup><tbody><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><p>首字节（均值）</p></td><td rowspan="1" colspan="1"><p>白屏（均值）</p></td><td rowspan="1" colspan="1"><p>白屏（90分位）</p></td><td rowspan="1" colspan="1"><p>首屏（均值）</p></td><td rowspan="1" colspan="1"><p>首屏（90分位）</p></td></tr><tr><td rowspan="1" colspan="1"><p>CSR 详情</p></td><td rowspan="1" colspan="1"><p>557ms</p></td><td rowspan="1" colspan="1"><p>953ms</p></td><td rowspan="1" colspan="1"><p>1625ms</p></td><td rowspan="1" colspan="1"><p>2403ms</p></td><td rowspan="1" colspan="1"><p>4424ms</p></td></tr><tr><td rowspan="1" colspan="1"><p>SSR 详情</p></td><td rowspan="1" colspan="1"><p>655ms</p></td><td rowspan="1" colspan="1"><p>979ms</p></td><td rowspan="1" colspan="1"><p>1624ms</p></td><td rowspan="1" colspan="1"><p>1207ms</p></td><td rowspan="1" colspan="1"><p>2074ms</p></td></tr></tbody></table>

●

SSR 详情渲染性能稳定性比 CSR 好非常多

○

SSR 详情（首屏）：性能分布居中在左侧，渲染稳定性非常好

![[c4d0c107-7898-401c-8eb4-444a429b5608.png]] ○

CSR 详情（首屏）：性能分布比较长尾，渲染稳定性较差

![[cf7c3d35-5531-4b65-9bb0-7d51a8af029c.png]]

### 业务结果

●

在手淘极简包场景中，SSR 详情对比 CSR 详情 加购+0.8%，下单 +5.2%（数据为 2.8~2.12）

●

在非手淘里搜索到详情场景 A/B 实验（5天平均数据）UV landing 率（搜索点击/详情渲染成功）： SSR VS CSR 为 93.34% VS 75.88%，提升 23%，详情下单转化 17.78% VS 15.16%，提升 17.25%

5.8~5.12 非手淘环境，搜索跳转 SSR 与 CSR 详情 A/B 数据：

<table><colgroup><col width="108"> <col width="108"> <col width="108"> <col width="108"> <col width="108"> <col width="108"></colgroup><tbody><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="1"><p>landing 率</p></td><td rowspan="1" colspan="1"><p>搜索下单转化</p></td><td rowspan="1" colspan="1"><p>搜索加购转化</p></td><td rowspan="1" colspan="1"><p>详情下单转化</p></td><td rowspan="1" colspan="1"><p>详情加购转化</p></td></tr><tr><td rowspan="1" colspan="1"><p>CSR</p></td><td rowspan="1" colspan="1"><p>75.88%</p></td><td rowspan="1" colspan="1"><p>11.5%</p></td><td rowspan="1" colspan="1"><p>7.05%</p></td><td rowspan="1" colspan="1"><p>15.16%</p></td><td rowspan="1" colspan="1"><p>9.3%</p></td></tr><tr><td rowspan="1" colspan="1"><p>SSR</p></td><td rowspan="1" colspan="1"><p>93.34% (+23.01%)</p></td><td rowspan="1" colspan="1"><p>16.59%(+44.23%)</p></td><td rowspan="1" colspan="1"><p>9.55% (+35.3%)</p></td><td rowspan="1" colspan="1"><p>17.78% (+17.25%)</p></td><td rowspan="1" colspan="1"><p>10.22% (+10%)</p></td></tr></tbody></table>

●

landing 率：详情完全展现/搜索点击

●

搜索下单转化：跳转下单/搜索点击

●

搜索加购转化：加购成功/搜索点击

●

详情下单转化：跳转下单/详情完全展现

●

详情加购转化：加购成功/详情完全展现

### 总结与展望

●

SSR 详情在性能与业务数据方面对比 CSR 详情有明显优势。但有两个问题需要考虑：1、SSR 对比 CSR 增加了运维成本，但 FaaS 已经比较成熟，运维难度比较低。另外资源费用方面还可以接受（600W PV 一年预算 1-2 万左右）；2、安全反爬，当前在 SSR 场景下安全基础设施还不够完备，在防爬上需要跟安全团队有更多尝试。例如，将详情提前渲染好，放在 CDN 上，性能可以有进一步的提升，但安全侧会有更大的压力。

●

后续会将集团 APP 和微信场景全量切到 SSR 详情，同时会将基础链路核心页面逐步迁移到 SSR 的版本中。

END

外投场景（非手淘，以 H5 详情为例）

为什么要做性能优化

手淘内性能优化方案

端外性能优化挑战

站外 SSR 性能方案

为什么用 FaaS

性能优化结果

业务结果

总结与展望

**

**

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
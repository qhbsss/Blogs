---
title: "Wormhole 渲染 Serverless Worker 化升级"
source: "https://ata.atatech.org/articles/11000265491?utm_source=open&utm_medium=hsf&utm_campaign=_OPEN_AONE"
author:
  - "[[费翔(碎空)]]"
published:
created: 2026-11-08
description:
tags:
  - "clippings"
---
经历了一年的技术架构改造迁移，将 Wormhole的中心化维护的渲染服务迁移到了基于 Gaia FaaS 函数基座的 [Noslate Worker](https://noslate.midwayjs.org/docs/noslate_workers/intro) 架构上，并且基于这套 Worker 架构开始向淘宝提供无运维的自适应渲染链路。这篇文章记录一下做了什么以及为什么做。

## 背景:

先简单介绍一下 Wormhole 的重要迭代历史

- 1.0 支持国内业务的无运维渲染托管
- 2.0 支持国际化业务，部署5个国际机房
- 3.0 提供去中心化版本 Wormhole SDK ，满足业务定制诉求，重点支持了业务的数据网关建设、SSR渲染、以及支持使用 JavaScript 语法替代 Xtemplate 编写模板提升开发者体验

3.0 版本的诞生是业务体验的驱动，也是 Wormhole 开始面向体验升级的渲染架构的变化起点。累计有 20+ 的应用使用了 Wormhole 3.0 版本。 Wormhole 3.0 虽然提供了渐进式的接入方案来作为中心化渲染服务的增强，但是业务需要新建一个函数或者应用来承载，这给使用者带来了一定的维护成本。拿业务需要支持SSR来举例子，这里的维护成本体现在： 对于业务开发者，如果只是普通的 CSR 渲染，只需要关注业务逻辑本身，页面的静态资源有CDN的存在，几乎不需要关注流量的影响。 如果是要做 SSR，需要做的事情拆解：

1\. 业务代码适配 SSR 环境

2\. 新建一个函数应用，完成函数运维的考试 （或者是一个普通Aone应用）

3\. 学习服务端基本概念以及 midway 框架的使用

4\. 长期维护一个应用，关注应用的稳定性情况、容灾、压测、安全问题

对比一下 SSR 使用成本比 CSR 高出很多，不是所有的业务都能够投入人力来做。 Wormhole Serverless Worker 化改造期望能够降低业务使用SSR的成本， 让业务回到像CSR一样只需要关注业务逻辑，重点解决需要独立维护一个函数应用的问题。

## 方案选型：

要完成上面的这个命题，我们先定义出要解决的问题:

1. 区别于 wormhole 2.0 中心化集群提供的 Xtemplate 模板的渲染托管，要支持 React/Rax SSR 意味着要直接给用户暴露在服务端执行 JavaScript 的能力。相比 Xtemplate 受限的指令而言，容易写出死循环、内存泄漏的代码
2. 需要有对业务使用能力的约束，限定业务只能做SSR渲染。而不是任意的调用接口、连接数据库提交数据等操作，这样出问题我们才能感知业务可能的出错点，在有限的能力控制下才有可能做到托管运维
3. 成本考虑，流量小的业务能限制在更小规格的容器范围内，比如一个单核进程、甚至一个 v8 context 下隔离运行。页面使用的资源能够跟随流量弹性扩缩。
4. 可降级的方案，保证业务SSR渲染出错的情况下，能够有CSR做兜底。

总结一下：核心是限制能力、资源隔离、可降级， 进而为规模化运维提供保障。

在做技术选型前， Node架构团队已经在探索高密度混合Serverless架构， 详见 [这篇文章](https://aliyuque.antfin.com/chengzhong.wcz/kb/vkhlxp?) ，比较清晰的讲解了如何解决成本和函数发布速度的问题。 Wormhole 结合 Worker 这套架构方案，进一步把场景限制在页面SSR 渲染的托管上。

## 改造细节：

整体的 worker 化迁移改造其实分为了2个大的部分:

- CDN 静态缓存回源链路:
	- Wormhole 原有中心化维护的 Xtemplate 渲染集群迁移到 worker 上
		- 提供无运维的可缓存React SSR页面的渲染托管
		- SSR 页面异常时降级到 CSR 链路承载
- [自适应渲染](https://aliyuque.antfin.com/wormhole/kiigw8) ：提供成本与体验的最佳平衡，最低成本、最大限度提升业务体验

### CDN 静态缓存回源链路

这里说一下为什么把现有的 Xtemplate 渲染集群也切过去了

- 验证 noslate worker 方案的可靠性，为大规模无运维JS托管做技术探索
- 借助函数隔离，按业务拆分现有大集群，提升业务模板的缓存利用，也更好的评估不同业务之间的性能，更准确的评估容量。

最终迁移后的CDN 回源 WormholeSource 链路的架构如下：

Wormholesource应用从原来的路由、兜底、渲染的职责变成专注于路由和兜底，耗费资源的渲染迁移到了 worker上。

![](3af9693f-7543-43b9-9d4b-fb9de7b71740.png)

### 自适应渲染

自适应渲染是我们现在重点基于 worker 建设的面向体验的架构，核心链路已经能够串通，整体周边还在建设中。 自适应体现在结合端、ER、流式SSR 给业务带来成本与体验的最佳平衡，详见这篇文章介绍 [https://aliyuque.antfin.com/wormhole/kiigw8](https://aliyuque.antfin.com/wormhole/kiigw8)

![](8c861b31-e45c-4a32-86c0-b3ce4d67f2cb.png)

中
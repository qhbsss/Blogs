---
title: "业务基础技术学习专题-UMP"
source: "https://ata.atatech.org/articles/11020495215?spm=ata.23639746.0.0.781b20bf2IcCeD#YTcwODFi"
author:
  - "[[姚士杰(书景)]]"
published:
created: 2026-11-16
description:
tags:
  - "clippings"
---
随着团队的业务拓展和复杂度提升，带来了技术横向视野和纵向深度上的挑战，为增强团队对基础技术平台认知，我们启动了「业务基础技术学习计划」，针对常见技术平台进行系列分享课程。经过内部票选， 第一期围绕招商、营销、商品、拉菲、投放、物流等9大主题展开，学习分享内容以普适、新人友好为设计原则，涵盖技术背景、系统链路、对接方式、常见问题解析等，帮助大家快速学习上手。

📢「准备好你的咖啡和键盘， 让我们一起开启这场技术之旅吧！🚀🚀🚀」----天猫技术新品营销

第一期目录： [汇总链接](https://1d.alibaba-inc.com/apps/01LfQvZQ)

1. 第一章-招商： [ATA链接](https://ata.atatech.org/articles/11020494823)
2. 第二章-营销UMP： [ATA链接](https://ata.atatech.org/articles/11020495215?spm=ata.25287382.0.0.28177536MU3U43)
3. 第三章-商品：待补充ATA链接
4. 第四章-库存：待补充ATA链接
5. 第五章-拉菲：待补充ATA链接
6. 第六章-供应链：待补充ATA链接
7. 第七章-阿拉丁：待补充ATA链接
8. 第八章-召回引擎：待补充ATA链接
9. 第九章-搭建：待补充ATA链接

【声明】本文内容为学习整理与归纳，部分文字、图片、案例等素材源自ATA及公开资料，仅用于个人学习研究。所有引用内容已尽可能标明出处，若有疏漏或涉及版权问题，请联系删除，感谢原作者的辛勤创作。本系列内容难免疏漏，抛砖引玉，还望斧正

---

阅读完本篇文章你将对ump诞生背景，产品能力，核心架构设计及领域划分有一个基本的了解。紧接着，我们再深入了解ump的核心的3个流程（优惠计算、创建以及在导购交易链路的接入），至此，你将对ump的整体有一个比较清晰认识，接下来我们通过一个实际的业务场景，带大家实践一遍，如何对接ump实现自己的业务需求，最后，我们针对线上遇到的一些问题做一些排查思路及工具的分享，提升大家后续运维效率

![](e50b111f-a234-4c9a-8982-24bb4230a60f.png)

---

## 概述

> 技术/系统背景：简要说明系统的起源、发展历程

> 核心链路简述：简要说明系统的核心链路、产品能力

### 1.1 系统发展背景

- 什么是ump

Unity marketing platform（统一营销平台），支撑了集团多个平台的营销玩法，主要的职责为提供通用且可扩展的营销相关（大促，优惠，卡券等）相关的营销玩法的功能，核心也可以说是优惠活动组装和优惠计算。

1. ump诞生的背景

淘宝各业务线个性化营销需求旺盛，现有官方营销工具靠过去一对一式地开发难以及时快速地响应需求，同时牵一发而动全身，所以需要有一个统一的营销平台来承接营销业务场景的需求，UMP则在这个背景下应运而生。

- ump1/ump2/ump3

UMP2 是对 UMP 进行了 TMF2 架构升级之后的系统。UMP3 是在 UMP2 提供海外市场支持的架构升级之后的系统。UMP3 不是单独的应用，存在于 UMP2 中，通过 maven profile 进行环境隔离打包。

![](8213b928-8242-4739-82b2-ef05c126ccc2.png)

1）商业能力可以有自己的能力及扩展点

2）商业能力是对域能力扩展点的定制实现，在扩展点实现中可以调用商业能力自身的能力

3）营销系统分为5类商业能力：单品优惠、店铺优惠、跨店优惠、商家优惠券、平台卡券

每个商业能力提供了各自的产品模板用于创建行业产品。 行业产品都是基于某一类商业能力进行扩展定制。

### 1.2 产品能力

![](97f044c8-b156-4359-af1b-a08f133b4812.png)

## 核心价值

> 解决的问题：系统要解决什么场景的问题，核心痛点是什么（如：性能瓶颈、扩展性不足、流程复杂等）

> 提供的价值：总结系统带来的优势是什么（如：业务扩展性、提升效率、降低成本等）

- 提供基于人、货、场的优惠计算能力，赋能各个垂直业务的营销团队，形成面向消费者的特定形式的玩法或活动。
![](a4ae5925-77f9-42b1-aa15-ca4aefc1f1b9.png)

## 3\. 核心业务流程

> 流程图：用图示展示核心业务流程

> 步骤分解：按步骤描述流程的关键环节

### 3.1 核心业务模型

![](0617ab51-26b2-4ebd-86af-313cab5dae4a.png)

## 4\. 架构设计

### 4.1 整体架构

> 架构图：提供系统架构的可视化图示

> 模块划分：说明各模块的职责划分和协作关系，列出技术/系统的组成模块或关键功能单元

> 核心概念：定义核心术语（如：招商的领域语言，小皮-activityId、报名记录-signRecordId、报名商品-juId）

### 4.2 架构图

![](308612e9-02af-442b-8f1f-0fb2f5c3fcda.png)
- 商业能力依赖域扩展SDK，业务&产品依赖商业能力扩展SDK
- 静态流程编排使用tbbpm流程引擎，解决不同业务场景流程的差异性，比如搜索和下单，优惠计算的流程有一定差异
- 动态流程编排使用qlExpress引擎，通过脚本的方式解决不同优惠工具对能力使用上的差异，比如定向优惠需要过人群，大促优惠不需要过

### 4.3 领域模型

![](f6b87730-fce0-4d5a-a326-c9736ac3c4df.jpg)

### 4.4 模块划分

| 模块 | 操作的实现&值对象 | 功能定义 |
| --- | --- | --- |
| 优惠模块 | 优惠实例 | 通过订单信息和调用信息查找对应的营销活动，生成优惠实例。 |
| 场景模块 | 调用信息 | 对调用信息进行校验。 |
| 会员模块 | 买家 | 校验买家会员级别。 |
| 限购模块 | 预算 | 多维度分析资源预算是否已使用完，防止超卖资损。 |
| 资产模块 | 买家资产 | 使用优惠时对资产的扣减和回补，以及礼品的赠送。 |
| 价格模块 | 商品价格 | 根据商品作用范围、商品价格、优惠算法计算商品的优惠金额。 |
| 规则模块 | 优惠规则 | 主要处理优惠之间排它、互斥、叠加关系，对多个优惠结果进行最优解选择。 |
| 文案模块 | 营销文案 | 根据营销活动配置信息生成预热提示、潜在优惠、大促氛围、优惠表达等营销文案。 |
| 交易模块 | 结果视图 | 负责将计算结果转换为下游系统易于读取的统一视图。 |

### 4.5 营销黑话

| 名词 | 描述 |
| --- | --- |
| 单品优惠 | 针对某个商品或商品的SKU的优惠，也称为商品优惠或商品级优惠。 |
| sku级优惠 | 针对不同SKU设置不同优惠力度（如一个SKU打9折，另一个打8折），现都合并到单品优惠中。老UMP系统部分工具不支持SKU级优惠，1688仍使用旧表。 |
| 店铺优惠 | 作用范围为单个店铺内所有商品或部分商品，常见形式为满减、店铺优惠券、商品优惠券，计算维度以店铺为单位。 |
| 跨店优惠 | 作用范围覆盖一个或多个店铺的所有商品或部分商品，例如淘宝跨店满减、会员卡、购物券等。 |
| 最低折扣 | 卖家设置的折扣保护值，若单品优惠低于此折扣（通过减钱或一口价折算），则优惠不生效。例外情况可通过白名单（`mkt_core.tool_white_list`）解除限制。 |
| 优惠规则 | 控制优惠之间关系的规则，如叠加、互斥、优先级、最优解等，具体见优惠规则章节。 |
| 优惠工具 | 老UMP系统中的概念，UMP2中称为“营销产品”。 |
| 营销产品 | UMP2中对营销玩法的统称。 |
| UMP1（老UMP）与UMP2 | UMP2是营销系统TMF2化后的系统，TMF2是ATA架构下的技术框架。 |
| GCIH | Java GC Invisible Heap，JVM中不进行GC的堆区域，UMP用作本地缓存。 |
| 实时改价 | 修改UMP机器缓存数据的方案，用于调整营销活动时更新每台UMP机器的本地缓存预热数据。 |
| Marketing Detail | 优惠详情表（detail表），存储优惠活动的核心信息（如条件、折扣率等）。 |
| 百宝箱 | 营销数据查询与问题排查工具，网址： [http://marketingbox.taobao.com/](http://marketingbox.taobao.com/) |
| 渠道库存 | 绑定优惠活动的库存，使用该优惠下单会消耗对应渠道库存（普通库存），聚划算、淘抢购等场景使用。 |
| BBQ | 天猫维护的限购系统，支持优惠活动的限购功能。 |
| 搜索Dump | 搜索数据汇总中心，整合商品、用户、营销数据，为搜索引擎提供数据支持。 |
| Summary | 搜索Summary引擎，实时提供商品、价格、优惠等信息，数据来源于优惠的Dump数据。 |
| 新预售 | 2018年推出的预售模式，支持预售商品与现货商品合并下单（区别于老预售只能单独下单）。 |

### 4.6 核心概念

#### 4.6.1 优惠活动

> 【带有明确商业目的（如扩大销量、扩大GMV、获取更高的利润等），由平台运营或者商家发起的，消费者可参与并最终在消费者导购&交易环节给到相应的优惠利益（价格减免、实物赠送等）】的【一系列有组织的动作】，比如商家设置的全店商品满100元减50元活动。

- 属性构成

生效条件：满元、满件、特定人群、特定支付方式等

优惠利益：减钱、打折、促销价、送权益、送赠品等

优惠作用费用项：货款、运费、税费、支付手续费、分期费用、餐盒费等

优惠库存：周期性库存如每日库存、每周库存、每月库存

- 行为构成

商家/平台创建优惠活动、投放优惠活动；消费者获取实际优惠利益

- 具体案例
	- 消费者完成前置型的营销任务，不看成优惠活动。类似的，淘气值到1000后可以以优惠价200购买iphone13，当下我的淘气值只有996，在增长到1000过程中的行为，不看成优惠活动。
		- 点击领取优惠券，看成是互动任务的一部分。不是优惠活动，这次活动本身还没有促进销售达成。
		- 连续点赞15天，可以获得20元无门槛红包。不是优惠活动，这次活动本身还没有促进销售达成。不是优惠活动，这次活动本身还没有促进销售。
		- 所有用户可以88元购买一个88VIP卡【活动1】，拥有该卡后购买商品可以享受95折，每月封顶500元【活动2】；【活动1】不是优惠活动，【活动2】是优惠活动
		- 淘气值1000以上用户可以一口价88元购买88vip，淘气值1000以下用户购买88vip需要花888元【活动1】，拥有该卡后购买商品可以享受95折，每月封顶500元【活动2】。【活动1】是优惠活动，【活动2】也是优惠活动
		- 用户签约芝麻GO协议，平台发放50元红包【活动2】，用户承诺3天拉新人5个。如果没有拉够5个新人，将追回发放给用户的50元红包【活动1】。【活动1】整体上并不是优惠活动，属于互动任务【活动2】50元红包是优惠活动。

#### 4.6.2 优惠工具

> 【为了便于业务快速开展同类型的优惠活动，进行抽象提炼】的【一种固定做法】，比如淘系商家常用的单品宝、店铺宝、优惠券等。

优惠工具可以抽象的描述为：用户在购买某些商品时，满足某些条件，就可以享受某些利益（好处）。其中生效条件和优惠利益平台提供尽可能多的可复用条件判定和优惠利益算法实现，便于业务实现新的优惠工具复用，另对生效条件和优惠利益提供粗力度的SPI扩展机制，支持业务自定义生效条件和优惠利益实现

- 生效条件包括
	- 是否目标人群、
		- 是否指定优惠渠道，
		- 购买的商品是否在圈定范围内、
		- 这些商品的费用项（货款、邮费、税费等）是否满足要求、
		- 是否满足优惠限购要求等
- 优惠利益包括
	- 减钱、
		- 打折、
		- 促销价、
		- 送赠品、
		- 送权益等优惠利益

#### 4.6.3 优惠活动和优惠工具的关系

我们常见的优惠活动是通过优惠工具创建出来的，优惠工具和优惠活动是1对n的关系：

![](683721f3-f7e5-4aaf-bebb-9d207b992630.png)

在我们接入N件N元优惠工具之后，业务可以自己定一个toolCode。

常见的业务优惠工具：

| 业务 | 优惠工具 |
| --- | --- |
| 淘系 | 单品宝、店铺宝、优惠券、品类券、跨店满减、红包 |
| 淘特 | 官方补贴、优惠券、N件N元、品类券、红包 |
| 饿了么 | 外卖单品优惠、外卖店铺满减、配送优惠券、单品券、外卖平台券、超值换购单品优惠 |

#### 4.6.3 优惠规则

> 【为了清晰描述多个优惠活动之间的关系，而抽象定义的作用在优惠工具上】的【规则】，比如叠加规则、排他规则等

| 优惠规则 | 定义 | 举例 |
| --- | --- | --- |
| 叠加规则 | 一个商品被多个优惠活动圈定，多个优惠可以同时生效。 | 猫超内五常大米可以同时生效下单立减5元优惠和买返10元猫超卡两个优惠 |
| 排它规则 | 一个商品被多个优惠活动A和B圈定，生效优惠A则不生效优惠B，如果A不生效则B生效。 | 猫超内花生油生效了聚划算8折优惠，则不能生效下单立减5元优惠 |
| 排序规则 | 用于指定优惠活动计算环节的先后顺序 | 聚划算工具优先级为1000，单品宝工具优先级为20，此时根据优先级规则判断，指定先计算聚划算工具 |

优惠规则主要是定义了除了优惠本身怎么享用折扣或者利益之外的其它规则，比如叠加规则（优惠工具A和优惠工具B可以叠加使用）、排他规则（使用优惠工具A则不可以使用优惠工具B）等等。

优惠规则主要作用在优惠工具上，优惠活动通过优惠工具创建出来后同样会被优惠规则作用到。

![](d498a4bb-9658-4d09-9c0c-02fee40f4055.png)

#### 4.6.4 计算模式

> 【多层级优惠活动逐级计算时的金额门槛】的【规则】，比如平行满减、递进满减等

- 平行满减

以某种优惠工具后的价格作为所有后续优惠计算满减门槛的平行铺开计算方式

- 递进满减

以前一个优惠工具的惠后值做为当前优惠的计算满减门槛，层级递进计算方式

为了更好地帮助理解，示例如下：

![](c730ce5e-8114-4aba-be74-48846b33beba.png)

## 5\. 详细模块及流程设计

### 5.1 优惠活动创建

#### 5.1.1 创建优惠活动

- 接口：MarketingActivityWriteService#addMarketingActivity
![](d188e549-7f78-4aa0-90bb-bc48d9573113.png)

1.1.1：检查“创建者Id/活动名称/provider\_key/活动描述/开始时间/结束时间/...”等参数合法/非空。

1.1.2：检查工具id/工具code非空，且对应存在于spec表中。

1.3.1：设置活动status（正常、冻结、删除）；

设置活动options（是否一次性活动）；

设置活动participate\_range(针对全部/部分/分组/排除商品）；

#### 5.1.2 创建优惠详情

- 接口：MarketingDetailWriteService#addMarketingDetail
![](9b968ab1-e24b-4a23-8d7b-606bac3cb595.png)

2:传入marketingDetailDTO，包含：participateId(商品id/店铺id)、participatetype(商品/店铺/卖家/sku/商品分类/店铺分类)、sellerId、shopId、activityId、toolId、toolCode、calculateLevel(单品/订单/跨店）、.....

2.1 根据activityId、creatorId、MarketPlace在marketingActivity表中查询活动，返回activityDTO

2.2 根据toolCode在toolProductSpec表中查询该工具产品，返回toolProductSpecDTO

2.3 合并marketingDetailDTO、activityDTO的op参数和根据toolProductSpecDTO中的QL EXPRESS进行QL Engine执行，返回qlResponce（具体优惠信息promotionInfo）

2.6.2 检查活动是否是私有的，如果是，则不允许其他卖家参与

2.7.1 是公有活动且不存在活动-卖家关系，则将活动-卖家关系写入数据库

2.7.4 如果是线下新零售的活动，且为分组参与的，需要更新分组主表promotion\_range\_cluster的信息，用于pos离线数据同步；非新零售活动在这一步会发出一个活动详情变更的notify消息

### 5.2 优惠计算

#### 5.2.1 核心概念

| 术语 | 解释 |
| --- | --- |
| 计算流程 | 给出N个优惠和M个叠加排他规则，计算出最优解的过程是一次计算流程  目前系统支持一次请求通过多次计算流程进行计算，但是还没有业务场景使用，现在都是一次请求只会有一次计算流程 |
| 计算簇 | 将优惠活动分成若干簇，簇内求最优，簇和簇之间叠加，最终得到局部最优解  举例：  目前绝大部分分簇都是按照单品级优惠、店铺级优惠、跨店级优惠进行划分，所以通常优惠在计算前会被分为单品计算簇、店铺计算簇、和跨店计算簇  特殊配置：在 [自定义簇配置](https://diamond.alibaba-inc.com/diamond-ops/static/pages/config-detail/index.html?spm=0.0.0.0&dataId=com.taobao.ump2.rule.cross.calculate.group.type&group=UMP2&tenant=&serverId=center&version=) 里的工具会生成单独的计算簇 |
| 计算分组 | 一个簇内分成若干计算分组，每个组内的优惠默认互斥，可以通过配置叠加规则把多个优惠活动变成叠加，并得出组内最优解  举例：  比如下单有A店铺购买商品a、b，B店铺购买商品c、d；  在单品计算簇中，会分别为四个商品生成四个计算分组，每个商品都可能会存在有多个优惠（比如商品可能会存在天梯优惠和单品宝两种优惠），在每个计算分组中为每个商品从一个或多个优惠中选出一个最优优惠；  在店铺计算簇中，会为两个店铺生成两个店铺计算组，在每个店铺组内，取店铺内的优惠最优解； |
| 叠加组合 | 通过叠加规则生成叠加组合 |
| 最小叠加单元 | 叠加规则处理的最小单元  一般场景下最小叠加单元和优惠活动是一一对应的  特殊场景：  - 多档优惠：多个档位的优惠活动对应的最小叠加单元是同一个 - 不支持自叠加的优惠券：同一个券模板领的多张券对应的最小叠加单元是同一个 |

#### 5.2.2 一个例子

> 同一个店铺下2个商品AB下单，AB可以享受

> P1 大促优惠 优惠范围是商品A

> P2 单品宝优惠 优惠范围是商品AP3 大促优惠 优惠范围是商品B

> P4 商品券 优惠范围是商品AP5 商品券 优惠范围是商品B

> P6 店铺宝 优惠范围是商品AB

> P7 品类券 优惠范围是商品AB

> P8 88vip 优惠范围是商品A

![](6dba1d4e-2d6c-4290-8ccd-89ed57ae7d9b.png)

根据排他规则，大促优惠P1排单品宝优惠P2，所以一共可以分为4个分簇共5个分组：

- Node1 单品级别簇
	- Group1 分组1 P1
		- Group2 分组2 P3
- Node2 店铺级别簇
	- Group3 P4,P5,P6
- Node3 跨店级别-品类券簇
	- Group4 P7
- Node4 跨店级别-88vip簇
	- Group5 P8

是不是想问跨店为啥2个簇，问就是簇是ump自己定义的，配在diamond上的 ：）

![](160413df-4c62-49ba-9d55-57ef9cfa5740.png)

然后每个分簇分别计算最优解：

- Node1 单品级别簇 计算
	- Group1 下P1生效
		- Group2下P3生效
		- 最优解计算
		- 假设P1和P3设置了同一个活动限购1件，在最优解时需要解决资源冲突，P1消耗了一件活动限购，则P3不能使用，最终得到Node1下最优解为P1
- Node2 店铺级别簇 计算
	- 假设Group3中商品券不相交可以叠加，商品券和店铺宝也可以叠加，执行叠加规则得到叠加组合
		- P6
				- P4 P5
				- P4 P5 P6
		- 循环计算每个叠加优惠，对组合优惠结果进行排序
		- 最优解计算
		- Group3下P4 P5 P6优惠结果排序第一，则Node2下最优解为P4 P5 P6
- Node3和Node4计算同上

最终得到最优解为P1、P4、P5、P6、P7、P8

#### 5.2.3 优惠计算流程

![](1867cd27-8928-482a-9b53-47e89d6ca493.png)

#### 5.2.4 分组计算算法

> 最优解流程核心算法详解

> 问题定义：

> 给定一个优惠集合 
> $$
> Pn= [P1,P2.....,Pn]
> $$
>  ，和一个规则集 
> $$
> R=\{{Px∩Py=ϕ;Px,Py∈Pn}\}
> $$

> 优惠集合中包含当前计算分组可以参与的所有优惠，规则集合规定哪些优惠能叠加，哪些组合不能叠加，则这个优惠一共有多少种组合，并且哪一种组合是最优组合。

| 算法 | 默认分组计算算法（待废弃） | 默认分组计算优化算法 | 最长叠加组合计算算法 | 叠加矩阵算法 |
| --- | --- | --- | --- | --- |
| 适用场景 | 适用于所有场景，由于一层层进行遍历求解，性能较差 | 适用于所有场景，会求所有的叠加组合，包含子集。在using场景下有优化，直接求最长的叠加组合，即最优解 | 适用于不需要子集的场景，如导购，购物车，支持平行满减和递进满减 | 只适用于平行满减场景 |
| 算法简介 | 1、通过广度优先遍历算法一层层求叠加组合，结合叠加缓存计算叠加组合的优惠结果  2、执行计算后排他规则，排除部分优惠 | 1、先计算最小叠加单元，剔除无效优惠  2、执行计算后排他规则，排除部分优惠  3、构建Graph,通过Bron–Kerbosch算法求出所有叠加组合，叠加组合从短到长排序，结合叠加缓存计算叠加组合的优惠结果 | 1、先计算最小叠加单元，剔除无效优惠  2、执行计算后排他规则，排除部分优惠  3、构建Graph,通过Bron–Kerbosch算法求出所有叠加组合，叠加组合从长到短排序，如果最长叠加组合生效则不需要计算子集 | 1、先计算最小叠加单元，剔除无效优惠  2、执行计算后排他规则，排除部分优惠  3、构建Graph,通过Bron–Kerbosch算法求出所有叠加组合  4、平行满减场景下，直接通过单个优惠结果累加即可计算除叠加组合的优惠结果 |

- 一些概念解释

| 概念 | 解释 | 举例 |
| --- | --- | --- |
| 无向图 | 边无方向性，用无箭头线段表示（如 A−B），表示顶点 A 和 B之间的双向连接。 | 适用于表示无方向性或双向关系，如社交网络、化学分子结构等场景 |
| 完全子图/团 | 在无向图中，若某个顶点子集内的任意两个不同顶点都存在边直接相连，则该子集与其边构成的子图称为完全子图，也叫团。 |  |
| 最大完全子图/最大团 | 所有完全子图中顶点数最大的团，也叫最大团。 |  |
| 有向图 | 边具有明确的方向性，通常用带箭头的线段表示（如 A→B），表示从顶点 A 到顶点 B的单向关系。  邻接矩阵通常非对称（例如 A→B 和 B→A被视为两条独立的边）。 | 适用于表示具有方向性的关系，网页链接、任务调度等场景。 |
| 回溯法 | 把问题的解空间转化为图或者树的结构，然后使用 [深度优先搜索](https://zhida.zhihu.com/search?content_id=119136049&content_type=Article&match_order=1&q=%E6%B7%B1%E5%BA%A6%E4%BC%98%E5%85%88%E6%90%9C%E7%B4%A2&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3NTI5ODM5NDQsInEiOiLmt7HluqbkvJjlhYjmkJzntKIiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoxMTkxMzYwNDksImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.n49uhaajpz1HLk5BoU73Kc4DmLgHvRH5TZ-ClxooQQA&zhida_source=entity) 策略进行遍历，再遍历的过程中记录和寻找所有可行解或者最优解； |  |

默认分组计算优化算法

每个最小叠加单元作为图的顶点，如果最小叠加单元之间可以叠加，则生成一条边，这样就构建了一个无向图。

求所有叠加组合的过程就是求图中所有顶点都两两相连的子图，即完全子图。

![](cfa736a3-1c20-44c7-9abb-6515617a4396.jpg)

如图所示的，完全子图为 「通过 [Bron-Kerbosch算法](https://en.wikipedia.org/wiki/Bron%E2%80%93Kerbosch_algorithm) 可以快速获取最大完全子图/最大团」

P1,P2,P4

P2,P3

P4,P6

P3,P6

P3,P5

如果需要获取所有的叠加组合，还需要求完全子图的子集，上面P1,P2,P4还可以拆成P1P2, P1P4, P2P4三个子集

求全组合，当假设原有元素n个，则最终组合结果是2^n个。

最长叠加组合算法

适用场景：默认算法可以得到最优优惠组合和所有的优惠组合，在购物车，券后价等场景下，只需要获取最优优惠组合即可

同样先求出所有可能的叠加组合，叠加组合从长到短排序，优先计算最长叠加组合优惠，如果满足就可以不用计算子集。

叠加矩阵算法

适用场景：平行满减场景下，店铺和跨店优惠都是基于单品优惠后的价格进行计算，在不同叠加组合中，单个优惠的计算结果是相同的，则可以通过结果累加快速获取叠加组合的优惠结果。

下面是用AI生成了BK算法的伪代码，可以帮助理解BK算法怎么在计算优惠场景使用的（不代表真实的ump优惠计算逻辑，如有理解偏差，欢迎指正 ）。

构造一个优惠的实体

```/**
/**
 * 优惠实体类
 */
public class Promotion {
    private int id;              // 优惠ID
    private String name;         // 优惠名称
    private PromotionType type;  // 优惠类型
    private String shopId;       // 店铺ID
    private double amount;       // 优惠金额

    public enum PromotionType {
        SINGLE_ITEM,    // 单品优惠
        SHOP,          // 店铺优惠
        CROSS_SHOP     // 跨店优惠
    }

    public Promotion(int id, String name, PromotionType type, String shopId, double amount) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.shopId = shopId;
        this.amount = amount;
    }

    // Getters
    public int getId() { return id; }
    public String getName() { return name; }
    public PromotionType getType() { return type; }
    public String getShopId() { return shopId; }
    public double getAmount() { return amount; }

    @Override
    public String toString() {
        return String.format("Promotion{id=%d, name='%s', type=%s, shopId='%s', amount=%.2f}",
                id, name, type, shopId, amount);
    }
```

按照假定的规则进行优惠计算

```import
import java.util.*;

/**
 * 优惠计算器
 */
public class PromotionCalculator {
    private List<Promotion> promotions;
    private Map<Integer, Set<Integer>> compatibilityGraph;

    public PromotionCalculator(List<Promotion> promotions) {
        this.promotions = promotions;
        this.compatibilityGraph = buildCompatibilityGraph();
    }

    /**
     * 构建优惠兼容性图
     * 如果两个优惠可以叠加，则在图中连接这两个节点
     */
    private Map<Integer, Set<Integer>> buildCompatibilityGraph() {
        Map<Integer, Set<Integer>> graph = new HashMap<>();
        
        // 初始化图
        for (int i = 0; i < promotions.size(); i++) {
            graph.put(i, new HashSet<>());
        }

        // 构建边（优惠兼容关系）
        for (int i = 0; i < promotions.size(); i++) {
            for (int j = i + 1; j < promotions.size(); j++) {
                if (arePromotionsCompatible(promotions.get(i), promotions.get(j))) {
                    graph.get(i).add(j);
                    graph.get(j).add(i);
                }
            }
        }
```

Bron-Kerbosch算法

```import
import java.util.*;

/**
 * Bron-Kerbosch算法实现：用于查找无向图中的所有最大团
 */
public class BronKerbosch {

    // 邻接表表示无向图
    private Map<Integer, Set<Integer>> graph;

    public BronKerbosch(Map<Integer, Set<Integer>> graph) {
        this.graph = graph;
    }

    /**
     * 查找所有最大团
     * @return 最大团列表，每个团是一个顶点集合
     */
    public List<Set<Integer>> findMaximalCliques() {
        
        List<Set<Integer>> cliques = new ArrayList<>();
        
        // 当前节点集合
        Set<Integer> R = new HashSet<>();

        // 候选节点集合
        Set<Integer> P = new HashSet<>(graph.keySet());

        // 已排除的节点
        Set<Integer> X = new HashSet<>();

        // 执行算法
        bronKerbosch(R, P, X, cliques);
        return cliques;
    }
```

测试用例：

```import
import java.util.*;

/**
 * Bron-Kerbosch算法测试用例
 */
public class BronKerboschTest {
    public static void main(String[] args) {
        // 顶点用整数表示，A=0, B=1, C=2, D=3
        Map<Integer, Set<Integer>> graph = new HashMap<>();
        graph.put(0, new HashSet<>(Arrays.asList(1, 2))); // A
        graph.put(1, new HashSet<>(Arrays.asList(0, 2, 3))); // B
        graph.put(2, new HashSet<>(Arrays.asList(0, 1, 3))); // C
        graph.put(3, new HashSet<>(Arrays.asList(1, 2))); // D

        BronKerbosch bk = new BronKerbosch(graph);
        List<Set<Integer>> cliques = bk.findMaximalCliques();

        // 打印结果，并将整数映射为字母
        for (Set<Integer> clique : cliques) {
            System.out.println(toLetterSet(clique));
        }
        // 期望输出：[A, B, C] 和 [B, C, D]
    }

    // 辅助方法：将整数集合映射为字母集合
    private static Set<String> toLetterSet(Set<Integer> clique) {
        String[] letters = {"A", "B", "C", "D", "E", "F", "G", "H", "I", "J"};
        Set<String> result = new HashSet<>();
        for (Integer i : clique) {
            if (i >= 0 && i < letters.length) {
                result.add(letters[i]);
            } else {
                result.add(i.toString());
            }
        }
        return result;
```

```import
import java.util.*;

/**
 * 优惠计算器测试类
 */
public class PromotionCalculatorTest {
    public static void main(String[] args) {
        // 创建测试数据
        List<Promotion> promotions = new ArrayList<>();
        
        // 店铺A的优惠（大型电器店铺）
        promotions.add(new Promotion(1, "店铺A满1000减100", Promotion.PromotionType.SHOP, "shop_a", 100.0));
        promotions.add(new Promotion(2, "店铺A满2000减300", Promotion.PromotionType.SHOP, "shop_a", 300.0));
        promotions.add(new Promotion(3, "店铺A满3000减500", Promotion.PromotionType.SHOP, "shop_a", 500.0));
        promotions.add(new Promotion(4, "电视机优惠200元", Promotion.PromotionType.SINGLE_ITEM, "shop_a", 200.0));
        promotions.add(new Promotion(5, "冰箱优惠150元", Promotion.PromotionType.SINGLE_ITEM, "shop_a", 150.0));
        promotions.add(new Promotion(6, "空调优惠180元", Promotion.PromotionType.SINGLE_ITEM, "shop_a", 180.0));
        
        // 店铺B的优惠（服装店铺）
        promotions.add(new Promotion(7, "店铺B满300减50", Promotion.PromotionType.SHOP, "shop_b", 50.0));
        promotions.add(new Promotion(8, "店铺B满500减100", Promotion.PromotionType.SHOP, "shop_b", 100.0));
        promotions.add(new Promotion(9, "新款连衣裙优惠30元", Promotion.PromotionType.SINGLE_ITEM, "shop_b", 30.0));
        promotions.add(new Promotion(10, "夏季T恤优惠20元", Promotion.PromotionType.SINGLE_ITEM, "shop_b", 20.0));
        
        // 店铺C的优惠（食品店铺）
        promotions.add(new Promotion(11, "店铺C满200减20", Promotion.PromotionType.SHOP, "shop_c", 20.0));
        promotions.add(new Promotion(12, "店铺C满400减60", Promotion.PromotionType.SHOP, "shop_c", 60.0));
        promotions.add(new Promotion(13, "进口零食满100减15", Promotion.PromotionType.SINGLE_ITEM, "shop_c", 15.0));
        promotions.add(new Promotion(14, "饮料满50减10", Promotion.PromotionType.SINGLE_ITEM, "shop_c", 10.0));

        // 跨店优惠
        promotions.add(new Promotion(15, "跨店满1000减150", Promotion.PromotionType.CROSS_SHOP, null, 150.0));
        promotions.add(new Promotion(16, "跨店满2000减400", Promotion.PromotionType.CROSS_SHOP, null, 400.0));
        promotions.add(new Promotion(17, "跨店满3000减700", Promotion.PromotionType.CROSS_SHOP, null, 700.0));
        
        // 平台会员优惠（可以看作特殊的跨店优惠）
```

### 5.3 ump对导购链路的接入

#### 5.3.1 券后价

- 使用场景

搜索，会场，店铺等导购链路；主要侧重优惠表达、利益点透出（包括当前、未来、券后价、折后价）来引导交易。以券后价为例：

- 接口：UmpReadServiceImpl#findPromotion4Predict
![](4052c7e4-2485-4aa9-a101-8c5aa89b879a.png)
- 券后价计算策略升级

券后价优惠计算和传统的优惠计算逻辑有很大区别，主要体现在由原来的一次请求的所有商品一起计算优惠变成一次请求的所有商品单独计算优惠。比如：a,b,c,d四个商品计算优惠，之前是查询出这四个商品的所有有效优惠，然后一次算出这四个商品一起能享受到的优惠。券后价接口逻辑，查询出这四个商品所有有效优惠，然后每个商品单独算出能够享受的优惠，每个商品一个优惠结果。最简单的方式，直接用之前的接口每个商品调用一次优惠计算接口，能够解决这个问题。但是性能会跟不上，特别是搜索场景。搜索接口对优惠计算接口性能要求是13个商品耗时最多70ms。如果用之前的老接口，13个商品在70ms内肯定算不完。后面采取了13个商品一次查询出所优惠，然后将每个商品能够享受的优惠打散。打散后优惠数可能会按商品数，倍数增加。之前一个优惠作用5个商品，只有一个promotion，打散后会变成5个promotion，每个promotion的作用范围变了，由之前的5个商品id变成1个商品id。打平后每个商品从线程池分配一个线程计算，最后阻塞获取每个线程的计算结果。券后价优惠计算的耗时就变成了一次优惠获取时间 + 单个商品优惠计算时间。

- 接入方式
	1. 券后价接入文档： [https://aliyuque.antfin.com/shared-promotion/mqpke1/dx2zo4](https://aliyuque.antfin.com/shared-promotion/mqpke1/dx2zo4)
		2. 阿拉丁券后价补全服务： [https://ald-dev.alibaba-inc.com/#/contentService/307/fieldList](https://ald-dev.alibaba-inc.com/#/contentService/307/fieldList)

### 5.4 ump对交易链路的接入

交易链路主要侧重当前享受订单(货品、支付、运费)主体能享受多少优惠。以用户下单场景为例，核心流程包括：Find流程、Use流程和Deal流程。

接口：

- com.taobao.ump.service.client.UmpPromotionReadServiceClientV2#findAllPromotion4ConfirmOrder
- com.taobao.ump.service.client.UmpPromotionReadServiceClientV2#usingPromotion
- com.taobao.ump.service.client.UmpPromotionWriteServiceClientV2#dealAfterPromotion
![](370b6a6a-b0ae-4638-b05d-ce51aa86eaa2.jpg)

#### 5.4.1 Find流程

Find流程是指buy2下单渲染页的调用链路。手淘上对应的操作可以理解为在商品详情页点击立即购买之后，渲染下单页的这个过程中就会计算优惠，调用的就是Find流程。

![](9944c6ae-9539-4367-ba8e-67c37be423e0.png)

此时查询的优惠是走的缓存，如果直接查询数据库可能会流量比较大，有不少场景是用户想要渲染下单页查看商品的最终价格，不一定会成交。并且Find流程查询的是所有的优惠。

![](addabc93-db69-4dc1-81f6-9840e5d5e7f5.jpg)

XmpClient代码在umpapi中。Find流程调用链路详细描述如下：

1. com.taobao.xmp.core.service.client.PromotionReadServiceClient#findTradePromotion
2. com.taobao.ump.service.client.UmpPromotionReadServiceClientV2#findAllPromotion4ConfirmOrder
3. 该接口不是强走单元化的，流量按照上游走com.alibaba.ump.hsf.provider.PromotionReadServiceImpl#findAllPromotion4ConfirmOrder\*
4. ump2内部计算流程，这里不详细说明
5. 服务端阻断没实现
6. 客户端阻断逻辑：com.taobao.ump.manager.impl.PromotionInterruptManagerClient#needToInterrupt

Find流程中，服务端阻断没实现，所以阻断不会发生在服务端。

客户端存在阻断逻辑，阻断逻辑主要针对大促商品，当计算不出优惠的时候（如服务端超时，有异常等），会阻断下单页的渲染。阻断后，下单页会报错，提示优惠信息异常。

#### 5.4.2 Use流程

Use流程就是用户在下单页去点击提交订单时再去查询一次优惠。

![](64401bc2-a2ef-41ba-90b5-64db800ab93b.png)

Use则会请求数据库，虽然缓存的数据也比较可靠，但是与钱相关的最后一定要保证万无一失，如果此时查询的优惠和Find流程渲染时的优惠不一致，会阻断下单流程，只有都一致才会走后续的deal流程去冻结优惠。并且此时查优惠只会去查渲染下单页中用户选中的优惠，此时的压力也减少了很多。

![](bf430d93-ee07-413e-a4f2-eab4b985c93e.jpg)

Use流程的调用链路程如下：

1. com.taobao.xmp.core.service.client.PromotionReadServiceClient#usingPromotion
2. com.taobao.ump.service.client.UmpPromotionReadServiceClientV2#usingPromotion
3. 该接口不是强走单元化的，流量按照上游走com.alibaba.ump.hsf.provider.PromotionReadServiceImpl#usingPromotion
4. 优惠计算，这里和Find流程的最大区别在于，只会计算用户下单页选中的优惠，另外获取这些优惠的过程大部分是以DB为准，不走缓存，除了特殊的优惠（如店铺VIP）。
5. 服务端阻断com.alibaba.ump.functions.rule.service.impl.PromotionConsistencyCheckerImpl#processUsingPromotion
6. com.taobao.ump.manager.PromotionInterruptManager#needToInterruptUsing

服务端阻断：若用户选中了某个优惠，但是这个优惠Use流程计算不出来，那么服务端会进行阻断。

客户端阻断：若服务端服务提供异常，如超时、找不到服务，会直接阻断。若服务端能正常返回结果，那么会校验当前下单商品是否是大促商品（天猫大促、淘宝2882大促），如果大促商品没有使用任何优惠，那么也会进行阻断。

#### 5.4.2 Deal流程

Deal流程则是当点击提交订单之后，调用了Use流程，发现计算的优惠结果和Find流程计算的一致，那么就会调用Deal流程去冻结优惠，所以如果正常下单的情况下，点击提交订单会先执行Use流程，然后执行Deal流程。

![](ae4d5973-3416-4ae7-b259-6a4d10bb2a1c.png) ![](466ee1c6-252d-4a0f-a5fe-d1ab428404e0.jpg)

Deal流程的调用链路如下：

1. com.taobao.xmp.core.service.client.PromotionWriteServiceClient#dealAfterPromotion
2. com.taobao.ump.service.client.UmpPromotionWriteServiceClientV2#dealAfterPromotion
3. 该接口是强走单元化的，按照用户所在单元强制路由com.alibaba.ump.hsf.provider.UnitPromotionWriteServiceImpl#dealAfterPromotion
4. 优惠相关资源（如限购数、积分、优惠券等）的冻结。
5. com.alibaba.ump.functions.rule.service.impl.PromotionConsistencyCheckerImpl#processDealAfterCreateOrder
6. com.taobao.ump.service.client.UmpPromotionWriteServiceClientV2#checkNeedInterrupt

5中服务端阻断，主要判断是否冻结成功。

6中客户端阻断比较复杂，见下图说明：

![](87fc1d0d-43fb-4af8-8d3a-bc59e4a16cd6.svg)

## 6\. 使用方式简介

我们可以登录营销中台： [https://alimkt.alibaba-inc.com/ui/alimarketing/frontend\_layout/Workbench](https://alimkt.alibaba-inc.com/ui/alimarketing/frontend_layout/Workbench) ，展示了业务可用的丰富优惠工具以及对应的接入文档，业务可以按需查阅。

![](87380f00-2e50-4d25-9fe0-f0d80c5f35d5.png)

### 6.1 对接流程（以跨店优惠能力使用为例）

#### 6.1.1 创建工具

1. 优惠工具基础信息填写
![](f30fbce8-613b-4d4e-89d1-8747ddf44a49.png)
1. 能力选择
![](9d1def27-d7f1-4317-9a8b-ec182badbef6.png) ![](ed52d8d6-67cf-4bfd-9e12-9da852f549f8.png)
1. 代码研发

首先是工具表达式的编写，平台会根据业务前置选择给你自动生成一份模板，除了一些定制需求，一般都不需要在上面进行更改。

![](0ea6df39-9d3a-4e7d-ae8c-043cc47cb274.png)

同时如果有定制编写的需求，可以参考提供的QL表达式说明文档： [https://aliyuque.antfin.com/shared-promotion/mqpke1/gmto69](https://aliyuque.antfin.com/shared-promotion/mqpke1/gmto69) 。

1. 其次是产品包的关联：
![](9f7bcfb3-7dd1-487b-8090-3a7cf14cdfba.png)
1. 配置推送
![](c958961a-6c01-455c-bd38-69689dec4ccd.png)
1. 规则配置

一个工具，既有叠加规则，又具有排他规则。顾名思义，叠加规则就是表示它可以和哪些优惠工具互相叠加使用，排他规则表示它需要和哪些工具保持互斥。

![](a0a09ee5-18d9-4fdc-b2e2-00903b0f1f73.png)
1. 工具验证&上线

以上配置完毕后，即可以在预发环境中结合自己的业务场景进行验证，验证成功后，即可发布上线。

#### 6.1.2 产品包开发

若代码涉及产品包的开发，则我们需要做两件事：

- 开发自己业务的优惠产品包
- 打包
- 优惠主代码（ump2）升级业务产品包版本
![](aecaaa90-83f0-4ff9-8487-d15d4dac2ee0.png) ![](60f6dc60-5d97-465d-a949-111d1aea3a0f.png)

要注意的是，我们并没有ump2的代码编辑权限（一般不放开），所以添加或更新我们产品包，需要通过他们的开放工具： [https://marketingbox.taobao.com/tool/modifyVersion.htm](https://marketingbox.taobao.com/tool/modifyVersion.htm)

![](9d1621e4-9bef-41e9-ae51-3d2ce16dc05c.png)

#### 6.1.3 优惠设置

| 优惠层级 | 跨店级别 |
| --- | --- |
| 优惠门槛 | 满件 |
| 优惠方式 | 自定义金额计算：当件数满足优惠门槛件数（本次需求内为2/4/6件）之后，各商品按照打Y折进行计算。 |
| 出资方式 | - 纯平台出资：申请预算“交易直减补贴”资金池 - 商家出资 - 混合出资 |
| 圈品方式 | - 直接商品报名 - 分组报名 |
| 优惠生效条件 | 1. 渠道条件：如仅U先会场生效，umpChannel = tmallutry（待定） 2. 场景条件：不限 3. 人群条件：不限 |
| 优惠限购 | - 优惠活动维度单日买家限购 - 商品本身有「优惠限购」逻辑，优惠本身不限制使用次数 |

#### 6.1.4 商品报名

当业务需求某个商品具备某种优惠的时候，除了前置优惠工具的准备外，还需要经历下面的流程：

![](01a4d4ac-8a03-483d-8668-c7082f867bc4.png)

## 7.排查工具分享

- 百宝箱： [https://marketingbox.taobao.com/querytool/findPromotion.htm](https://marketingbox.taobao.com/querytool/findPromotion.htm)
- 渠道库存： [https://inventory.taobao.org/index.htm?spm=a1z2e.8101737.0.0.32374f9bbqJa4K](https://inventory.taobao.org/index.htm?spm=a1z2e.8101737.0.0.32374f9bbqJa4K)

### 7.1 查看生效的优惠

- [https://marketingbox.taobao.com/tool/logAnalyse.htm](https://marketingbox.taobao.com/tool/logAnalyse.htm)
	- case: 订单id：4634637948590550849 or traceId：2136014617528299429554306e0d82
![](5b33e003-c951-4862-a58a-4a21c21ea61f.png)

按订单查询

![](b3505a48-4a68-4f0e-b3fc-c2a3d1149aad.png)

### 7.2 优惠活动查询

- [https://marketingbox.taobao.com/querytool/detailList.htm?status=1&participateId=928465621475&seller=890482188](https://marketingbox.taobao.com/querytool/detailList.htm?status=1&participateId=928465621475&seller=890482188)
![](54daf3e8-c6ba-4350-8993-739003270d04.png)

从这个查询结果中可以看到：优惠人群标，渠道code、优惠活动生效时间等信息。

### 7.3 BSP订单渲染日志查询

- 通过商品id、用户id、时间范围，可以查询用户订单页是否渲染成功，是否存在限购的情况
- [https://bsp.alibaba-inc.com/find\_logs?dimension=mix&dimensionValue=app%3Abuy2&env=online&query=723350093433%202907465052&start=1740276000000&end=1740279600000&type=all&appFile=buy2%3Atrace-confirm-biz](https://bsp.alibaba-inc.com/find_logs?dimension=mix&dimensionValue=app%3Abuy2&env=online&query=723350093433%202907465052&start=1740276000000&end=1740279600000&type=all&appFile=buy2%3Atrace-confirm-biz)
![](ab3410ca-19c3-4df6-8409-04763ed50410.png)
- 通过trace找下下单的ump决策优惠，判断生效的时哪个优惠
![](572b008d-98c5-4b51-a7f2-a4517e3e916d.png)

[https://bsp.alibaba-inc.com/trace\_query?spm=epoch.applist.0.0.60df234aIM7Mlb&traceId=2150437017473980940452197e8c7c](https://bsp.alibaba-inc.com/trace_query?spm=epoch.applist.0.0.60df234aIM7Mlb&traceId=2150437017473980940452197e8c7c)

### 7.4 BSP下单日志查询

- [https://bsp.alibaba-inc.com/find\_logs?app=buy2&\_\_app\_file=buy2%3Atrace-createorder-biz&logFiles=buy2%3Aasdp-biz-routing%2Cbuy2%3Abizmonitor%2Cbuy2%3Abuy2%2Cbuy2%3Aclient\_error\_log%2Cbuy2%3Adelivery%2Cbuy2%3Adeliverys%2Cbuy2%3Adispatch%2Cbuy2%3Aentrancelog%2Cbuy2%3Afailorder%2Cbuy2%3Agc\_log%2Cbuy2%3Agray-remote-data-v1v2%2Cbuy2%3Ahsf%2Cbuy2%3Aignore\_failorder%2Cbuy2%3Aignore\_order\_metaq%2Cbuy2%3Aip\_query\_biz%2Cbuy2%3Amtop-monitor%2Cbuy2%3Aparallel%2Cbuy2%3Apresell%2Cbuy2%3Apricetrace%2Cbuy2%3Apromotionv3-createorder%2Cbuy2%3Apromotionv3\_renderorder%2Cbuy2%3Asdk-routing%2Cbuy2%3Asentinel-block%2Cbuy2%3Aservice\_product-halo-routing%2Cbuy2%3Asplitorderlog%2Cbuy2%3Ataobao-access\_log%2Cbuy2%3Atmf2-trace%2Cbuy2%3Atq-client%2Cbuy2%3Atrace-confirm-biz%2Cbuy2%3Atrace-createorder-biz%2Cbuy2%3Atrace-failorder&bu=%E4%B8%9A%E5%8A%A1%E5%B9%B3%E5%8F%B0%E4%BA%8B%E4%B8%9A%E9%83%A8&dimensionValue=app%3Abuy2&start=1739408400000&end=1739412000000&env=online&dimension=mix&apps=buy2&type=all&appFile=buy2%3Atrace-createorder-biz&query=820216189](https://bsp.alibaba-inc.com/find_logs?app=buy2&__app_file=buy2%3Atrace-createorder-biz&logFiles=buy2%3Aasdp-biz-routing%2Cbuy2%3Abizmonitor%2Cbuy2%3Abuy2%2Cbuy2%3Aclient_error_log%2Cbuy2%3Adelivery%2Cbuy2%3Adeliverys%2Cbuy2%3Adispatch%2Cbuy2%3Aentrancelog%2Cbuy2%3Afailorder%2Cbuy2%3Agc_log%2Cbuy2%3Agray-remote-data-v1v2%2Cbuy2%3Ahsf%2Cbuy2%3Aignore_failorder%2Cbuy2%3Aignore_order_metaq%2Cbuy2%3Aip_query_biz%2Cbuy2%3Amtop-monitor%2Cbuy2%3Aparallel%2Cbuy2%3Apresell%2Cbuy2%3Apricetrace%2Cbuy2%3Apromotionv3-createorder%2Cbuy2%3Apromotionv3_renderorder%2Cbuy2%3Asdk-routing%2Cbuy2%3Asentinel-block%2Cbuy2%3Aservice_product-halo-routing%2Cbuy2%3Asplitorderlog%2Cbuy2%3Ataobao-access_log%2Cbuy2%3Atmf2-trace%2Cbuy2%3Atq-client%2Cbuy2%3Atrace-confirm-biz%2Cbuy2%3Atrace-createorder-biz%2Cbuy2%3Atrace-failorder&bu=%E4%B8%9A%E5%8A%A1%E5%B9%B3%E5%8F%B0%E4%BA%8B%E4%B8%9A%E9%83%A8&dimensionValue=app%3Abuy2&start=1739408400000&end=1739412000000&env=online&dimension=mix&apps=buy2&type=all&appFile=buy2%3Atrace-createorder-biz&query=820216189)
![](b614cbd1-6bc3-4fbc-9d09-49e211d268c1.png)

这里可以看到错误码，这里可以根据错误码去文档搜索对应的原因，然后找正向交易的同学去看。BLOCK\_BY\_MTEE代表是安全拦截

## 8\. 参考资料

\[1\] [营销百科全书](https://aliyuque.antfin.com/shared-promotion/yxbk)

\[2\] [营销平台新人资料](https://aliyuque.antfin.com/shared-promotion/zgwc47)

\[3\] [Bron-kerbosch算法](https://www.bilibili.com/video/BV1kK411677v?spm_id_from=333.788.player.switch)

---

中
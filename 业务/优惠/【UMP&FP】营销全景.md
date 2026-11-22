---
title: "【UMP&FP】营销全景"
source: "https://ata.atatech.org/articles/11000228970?spm=ata.25287382.0.0.7b607536pF9k2i"
author:
  - "[[杨玉娟(西柚)]]"
published:
created: 2026-11-15
description:
tags:
  - "clippings"
---
## 一 项目背景

集团营销平台是业务中台核心领域，支撑着天猫，淘宝，飞猪，本地生活（口碑，饿了么），盒马，淘菜菜等集团及生态业务的营销场景。也正是因为支撑着越来越多的业务，导致平台定义的概念越来越多，玩法越发复杂。业务同学了解UMP，往往只能做碎片化的知识收集；平台同学做需求，基本只能依靠口口相传；营销简化的口号一直在喊，但营销工具的生命周期缺乏治理，新玩法层出不穷，旧玩法难以下线；营销规则不支持多维度查询，业务查找某些满足特定条件的规则时常常还需要平台技术同学协助......

为了解决以上问题，我们设计了多营销应用统一视角的营销全景，旨在可视化，数据化营销业务，玩法及规则，实现优惠工具可管理，可分析，可治理，同时提升营销业务，产品及规则的有效性。

## 二 基础知识

## 2.1 营销市场

UMP在设计之初，为了对营销规则按照业务区分配置，定义了【市场】的概念，不同的营销业务身份可能映射到不同的市场（无映射的默认兜底taobao市场）。

这份映射关系配置存储在diamond中，DataID=com.taobao.ump2.rule.route，以ump2应用为例：

```taobao
taobao = ali.china.taobao.idle,ali.china.taobao.lite,ali.china.taobao,ali.china.taobao.vacation,ali.china.damai,ali.china.taobao.hotel,ali.china.health.consult,ali.china.health.o2o,ali.china.tmall.jrzj,ali.china.1688,ali.china.lst
tmall = ali.china.ihome.c2m,ali.china.tmall.wt.ecard.mobile,ali.china.tmall.wt.ecard,ali.china.tmall.wt.ecard.flow,ali.china.tmall.wt.ecard.network,ali.china.tmall.wt.ecard.fixline,ali.china.tmall.wt.ecard.hfyx,ali.china.tmall,ali.china.tmall.car,ali.china.tmall.wt,ali.china.tmall.wt.pay,ali.china.tmall.wt.vt,ali.china.tmall.car.service.selfsupport,ali.china.tmall.wt.tianji,ali.china.tmall.wt.vt.old,ali.china.tmall.wt.vt.operator,ali.china.tmall.wt.secret,ali.china.trip.vacation,ali.china.trip.hotel.group,ali.china.tmall.vacation,ali.china.health.b2b,ali.china.tmall.supermarket,ali.china.tmall.yiyao.rx,ali.china.tmall.yiyao.ziying,ali.china.tmall.yiyao.normal,ali.china.tmall.hotel,ali.china.alsc.sales.eleme,ali.china.alsc.sales.koubei,ali.china.tmall.fresh,ali.china.tmall.maoxiang,ali.china.maoxiang.crossborder
retail = ali.china.hema,ali.china.tmall.retail,ali.china.tmall.onehour
trip=ali.china.trip.hotel.calendar,ali.china.trip.airticket.inland,ali.china.trip.airticket.abroad,ali.china.trip.trainticket,ali.china.trip.busticket,ali.china.trip.vacation.line.airportpickup,ali.china.trip.vacation.line.abroadcar,ali.china.trip.vacation.domestic.rentcar,ali.china.trip.vacation.tf
mmc=ali.china.mmc
```

营销规则的存储就是按照市场区隔存储的，主要是为了避免不同市场之间配置的相互影响。

## 2.2 营销规则

营销的规则种类很多，包含别名规则，优先级规则，排他规则，叠加规则，最优解规则等等。如图所示，一次优惠咨询的链路下，各种营销规则会按该顺序执行，其中排他和叠加规则还可能根据类型出现在不同节点。

![](51f2ccb1-1b33-4b57-8d56-0361bd380e92.png)

这里只简单介绍几种常用的规则及其存储。

### 2.2.1 优先级规则

优先级规则定义了优惠名A/优惠别名a在某业务市场M1下的优先级大小，如：shopbonus的优先级为2620。

```[{
[{
    "ruleConstants": [{
        "name": "shopbonus",
        "value": "2620"
    }],
    "id": "shopbonusPriority"
}]
```

作用

- 控制优惠计算顺序，同级别优惠，优先级高的优惠先算，优先级低的优惠后算。
- 控制一个优惠组合中，优惠活动的排列顺序。
- 影响优惠结果排序，同等优惠力度的2个优惠结果，优先级高的优惠排在优先级低的之前。
- 决定排他规则是否能执行。假设存在排他规则R1【优先级为P1的优惠A，排除优先级为P2的优惠B】，只有P2>P1，或规则R1的优先级P3>P1时，规则才能执行。

存储

优先级规则配置存储在diamond中，DataID用市场market作为区隔，主站和apos站点用GroupID区分，独立应用则用AppName区分。

- DataID：com.taobao.mrc.rule.data.priority.$(market)
- GroupID：mrc（主站）/APOS(五道口）
- AppName：ump2/fliggy-ump3/liteump/alsc-ump
![](66e53957-8479-4e63-9cdb-1658d428ad95.png)

### 2.2.2 别名规则

优惠别名是根据当前优惠活动及上下文信息，赋予该优惠活动的另外一个名称。它会影响优惠规则处理的逻辑，但不影响单个优惠活动计算的逻辑。别名的存在，主要是为了定义一类优惠的优先级以及不同上下文中的优惠优先级。

栗子🌰

栗子1：“toolGroup1”是calculateLevel（计算级别）为店铺级，且优惠名不在excludePromName中的所有优惠的别名。

```toolgroup1={
toolGroup1={
    "calculateLevel":"Order",
    "excludePromName":"tmallShopMemberRight,cashCoupon,quotaPick,coupon1exchange,AliB2B0coupon1redEnvelope"
}
```

栗子2：“huoCheZhanAlias”是promotionName为saleCommon且subPromotionName是saleSubXgo，当前交易渠道为taolitexgo的优惠别名。

```huochezhanalias
huoCheZhanAlias = {
    "channelKey":"taolitexgo",
    "includePromName":"saleCommon",
    "includeSubPromName":"saleSubXgo"
}
```

存储

优惠别名规则配置存储在diamond中，主站和apos站点用GroupID区分，独立应用则用AppName区分。

- DataID：com.taobao.ump2.rule.promotionAlias
- GroupID：UMP2（主站）/APOS(五道口）
- AppName：ump2/fliggy-ump3/liteump/alsc-ump

### 2.2.3 排他规则

排他规则用于在满足某些条件时排除某些优惠（优惠存在，但不可生效）。如：包含一段奶粉标的商品，不能享受A优惠；报名了天猫大促的商品，不能享受单品宝优惠等。

如下图所示，配置排他规则有一些关键的要素。如：规则唯一编码，规则生效时间，规则优先级；

生效条件——该规则生效必须满足的一系列上下文条件，如商品标，卖家id，当前优惠名等等；

生效阶段——规则作用节点（获取优惠/计算前/计算后）& 生效方式（预热/非预热，排outId/排优惠对象);

排他方式及对象——黑名单（排除的工具列表），白名单（保留的工具列表，不在列表的都排掉）；

![](441bbe66-ee85-494a-966c-e606f5c22b9c.png)

存储

排他&叠加规则数据存储在DB表里，不同独立应用分逻辑表存储，如ump2的排他&叠加规则存储在marketing\_promotion\_rule表中。目前已有的几张表和表字段如下图所示：

![](9d3092f7-4354-4a23-a547-0d3268b4db63.png) ![](6259e556-0f9e-49bd-8780-cc5d801d6eef.png)

规则关键要素以json串存在content字段里，如：

```{
{
    "id":"MMC_channel_exclude_mmcEgg",
    "ruleActions":[
        {
            "paramMap":{
                "whiteList":"qualifiedPromotion",
                "type":"0",
                "targetLevel":"1,2,3"
            },
            "type":"exclude"
        }
    ],
    "ruleConditions":[
        {
            "isNot":"false",
            "paramMap":{
                "value":"mmcEgg"
            },
            "type":"channelKey"
        }
    ],
    "ruleConstants":[
        {
            "name":"priority",
            "value":"99999999"
        }
    ]
}
```

### 2.2.4 叠加规则

叠加规则是能指定圈品不重合的P1优惠能和P2优惠叠加计算和使用的规则。

自叠加：同一个优惠工具T所生成的不同优惠实例叠加使用，该场景必须指定自叠加数量上限。

如下图所示，叠加规则主要关注叠加条件（当前优惠工具）和可叠加优惠工具，并要求他们属于同一计算级别。

![](b46b5a73-ea1b-430b-9824-26eb01faddc7.png)

存储

叠加存储和排他一样，主要区别的是rule\_type（规则类型：排他是0，叠加是1）和content（规则内容）字段。

```{
{
    "id":"MJHemaxMSOverlying",
    "ruleActions":[
        {
            "paramMap":{
                "promName":"wdkShopHemaxMS"
            },
            "type":"overlying"
        }
    ],
    "ruleConditions":[
        {
            "isNot":"false",
            "paramMap":{
                "promName":"wdkShopMJ"
            },
            "type":"promName"
        }
    ]
}
```

## 2.3 业务身份

业务身份是在基于星环建设的中台交易链路中一直穿越的重要概念，具体可以参考这篇文章： [https://ata.alibaba-inc.com/articles/108510](https://ata.alibaba-inc.com/articles/108510)

为什么在营销里单独谈业务身份，是因为营销的业务身份和实际交易下单的业务身份往往不同，下单的业务身份走到营销里会映射成营销自己的业务身份，进而路由到营销划分的不同的市场里，找寻对应的营销规则。

交易下单业务映射营销业务身份的配置存储在diamond，DataID=com.taobao.ump3.bizcode.mapping

```ali.china.tmall.daogoubao.inshop.passport=ali.china.tmallali.china.tmall.daogoubao.cloudstore=ali.china.tmallali.china.tmall.daogoubao.retailcore=ali.china.tmallali.china.tmall.daogoubao.downpayment.onestep=ali.china.tmallali.china.tmall.daogoubao.downpayment.steppay=ali.china.tmallali.china.taobao.passportprime=ali.china.tmallali.china.taobao.ticket=ali.china.taobaoali.china.tmall.ticket=ali.china.tmallali.china.tmall.car.entirety.lease=ali.china.tmallali.china.tmall.car.entirety.sepsale=ali.china.taobaoali.china.tmall.car.preauth=ali.china.tmallali.china.taobao.car.preauth=ali.china.taobaoali.china.tmall.car=ali.china.tmall......
ali.china.tmall.daogoubao.inshop.passport=ali.china.tmall
ali.china.tmall.daogoubao.cloudstore=ali.china.tmall
ali.china.tmall.daogoubao.retailcore=ali.china.tmall
ali.china.tmall.daogoubao.downpayment.onestep=ali.china.tmall
ali.china.tmall.daogoubao.downpayment.steppay=ali.china.tmall
ali.china.taobao.passportprime=ali.china.tmall
ali.china.taobao.ticket=ali.china.taobao
ali.china.tmall.ticket=ali.china.tmall
ali.china.tmall.car.entirety.lease=ali.china.tmall
ali.china.tmall.car.entirety.sepsale=ali.china.taobao
ali.china.tmall.car.preauth=ali.china.tmall
ali.china.taobao.car.preauth=ali.china.taobao
ali.china.tmall.car=ali.china.tmall

......
```

## 2.4 营销工具（产品）

营销工具是一种优惠玩法在营销内部定义的概念，如单品宝，店铺券，聚划算，跨店满减这些玩法都对应着一种营销工具；而1个营销产品可能对应着多个营销工具，如isv营销产品对应着非常多的isv工具，由于公用一个产品，它们具有相同的营销能力。

营销工具存储在tool\_product\_spec表，其中tool\_code是唯一工具编码，product\_code对应注册在星环上的产品，同时绑定营销产品包，product\_express是优惠计算的QL表达式，其他字段不做赘述。

![](23295fa1-f630-434b-9010-a70e55eb721d.png)

## 2.5 营销独立应用

飞猪，特价板，本地生活以及盒马都基于ump2建立了独立的营销平台应用，初始化时代码及配置都拷贝自ump2（主站应用），后期能实现业务迭代其需求，不依赖于主站资源及发布节奏。但一旦需要主站新提供的能力时，则需要合并主站代码，若主站做架构升级，独立应用合并主站代码的难度和风险则非常大，因此中台目前其实并不太提倡这种独立应用的模式。

## 三 页面概览及核心接口

## 3.1 全景首页

### 3.1.1 按应用市场数据查询

如下图所示，全景首页，默认展示通用营销应用（ump2）的市场信息，包含市场管理员，业务身份数量，营销工具数量及叠加排他规则数量。

![](84a1bbe9-2f74-49e6-8f45-92e04ba93a5e.png)

点击应用tab可以切换独立营销应用，查看不同应用的市场数据。

- ![](4c679017-b961-4320-b44c-0e35c051ab7f.png)

单应用的市场数据查询流程如上图所示，需要说明的是，【市场映射的全部业务身份】包含了2.3中配置映射的交易下单业务身份，因为对于大部分业务同学来说，下单所用的业务身份更加常用和准确。

![](6415fd85-92db-44e9-a7b8-1dfcbb4df48d.png)

### 3.1.2 多条件模糊查询

首页还支持按照业务身份/营销工具/营销规则的名称和编码在各个市场进行模糊搜索。

#### 3.1.2.1 按业务身份模糊查询

模糊搜索业务身份名称或编码，如“tmall”相关的业务身份只在天猫，淘宝和新零售市场存在。其中，天猫市场中有55个，淘宝市场有2个，新零售市场有2个。

![](db7599fd-bf3b-4d3b-9652-7c1678e78fca.png)

#### 3.1.2.2 按工具模糊查询

模糊搜索工具名称或编码，如“tmall”相关的工具在天猫，淘宝，飞猪和新零售市场存在。其中，天猫市场中有14个，淘宝市场有7个，飞猪市场有2个，新零售市场有1个。

![](57a74243-7b79-45f9-bf7a-607d9cda3eab.png)

#### 3.1.2.3 按规则模糊查询

模糊搜索工具名称或编码，如“tmall”相关的工具在天猫，淘宝，淘菜菜和新零售市场存在。其中，天猫市场中有35个，淘宝市场有6个，淘菜菜市场有2个，新零售市场有2个。

![](7bc1f58b-90cc-4388-931e-9e854b0d46d9.png)

按照不同条件在各个市场做模糊搜索的流程如下图所示：

![](9158a858-33e0-48d1-96cb-bfdbaa8aebc1.png)

## 3.2 业务身份列表页

在首页点击任意一个市场的业务，会进到业务身份信息列表页，展示出该应用该市场下所有的业务身份及相关信息，如名称，编码，负责人，叠加工具数，有效工具数，营销复杂度，其中营销复杂度根据有效工具数来界定——高：业务生效工具>100；中：生效工具数100-20；低\<20。同时，还支持跳转到业务身份叠加的工具列表页和有效的工具列表页。

![](d0a8a39a-85f8-4880-9af5-33b25ed2bf0d.png)

该页面核心接口流程如下图所示：

![](6f8727ff-956d-493b-a5ca-b1aa659dd433.png)

## 3.3 营销工具列表页

在首页点击任意一个市场的工具，或从业务身份列表页中查询叠加/有效的工具，能进到营销工具列表页。

左侧导航栏展示该应用+市场下的所有工具类型及数量，搜索框1支持按照工具名称/编码模糊搜索，搜索框2支持按照优惠级别进行筛选，如下图所示，筛选出店铺级别的优惠工具共184条，和左侧导航栏店铺优惠+商家优惠券数量总和一致。

![](61f3acae-7119-4bc9-af99-674cf31a8aba.png)

该页面核心接口流程如下图所示：

![](e9931ec0-f593-4c58-a170-7d3de30d2aad.png)

## 3.4 营销规则列表页

由于排他规则和叠加列表表达内容不大相同，因此规则列表页分为排他规则列表页面和叠加规则列表页面。

页面接口流程如下图所示：

![](391105f9-5da1-43e9-8cd4-a4dfb1e1d95e.png)

### 3.4.1 排他规则

在首页点击任意一个市场的规则，或从工具列表页中点击相关排他规则链接，能进到排他规则列表页。查询框1支持按照规则名称/编码进行模糊搜索，如下图所示，输入考拉能搜索出考拉相关的排他规则。

排他规则信息包括名称，编码，排他阶段，排他类型，排他工具清单，规则优先级，规则调用成功率，调用频率等元素。其中，规则调用频率和成功率的数据通过在营销咨询链路中埋点+离线统计到odps表获得。

![](06d7e67d-0d94-481a-95fb-8eaa1c18fabb.png)

查询框2支持按照指定条件和值进行查询，目前支持查询的规则条件有：

![](4451ca1d-2f2b-45ab-b83c-ccb2aab39972.png)

如下图所示，搜索条件为【IC商品标=2131650】的规则，可以查到【kaolavipdiscountexclude】这条规则。

![](6480cfbb-2999-49f6-943f-2b10a7484206.png)

查询框3支持按相关工具（A工具排它或它排工具A）进行查询，如下图所示，查询排掉shopFreeSendGiftPart工具的规则有34条：

![](7ba3dcce-6417-44e4-bdbe-e759bf4be851.png)

点击详情可以查看该条规则详情：

![](463ae659-f7a6-4d2c-bb83-a212396fb06d.png)

### 3.4.2 叠加规则

叠加规则页面和排他规则类似，能够按照规则名称/编码模糊搜索规则，也能按照指定相关工具进行查询。

如下图所示：

![](b8866608-e2a1-4cf6-9d55-bceb2f400a47.png)

## 四 后续工作

- 按应用查询多市场数据时，遍历市场会重复调用远程服务及访问数据库，若市场变多，接口耗时会倍增；
- 类似工具数据缓存，规则数据也可以在应用启动时进行查询和缓存，这样工具列表页能够实现统计每个工具的相关规则数量，规则查询时也不需要访问数据库；
- 营销工具详情页面：营销工具的元素很多，并非列表页能展示完全的，如工具QL表达式，产品编码，甚至关联产品的定制点，可叠加工具等等，可以通过新的详情页面完整表达；
- 优惠运维工具：基于营销全景的可视化数据化，可以搭建优惠运维工具，如不生效原因定位等；

## 五 结尾

营销全景是相对比较单纯的前后端交互项目，不涉及跨域。基于BI统计的订单，规则调用数据和星环提供的接口以及对营销内部概念的理解就可以完成。项目虽小，但却是营销数据可视化的第一步，也是开启无效数据治理的基础。毕竟，平台的完善不仅要关注业务需求上的快速支撑，也要重视业务接入平台的理解成本以及效能，避免成为功能强大的黑盒子。

感谢PD [@布斯(busi.lb)](https://yuque.antfin-inc.com/busi.lb) ，BI [@曦颜(sunyue.sun)](https://yuque.antfin-inc.com/sunyue.sun) ，星环 [@雪饮(xk240315)](https://yuque.antfin-inc.com/xk240315) ，前端 [@彼洋(gengyang.gy)](https://yuque.antfin-inc.com/gengyang.gy) ，@王白露 以及测试 [@潮头(chaotou.zc)](https://yuque.antfin-inc.com/chaotou.zc) 同学的配合。

写在休大长假之前，9月再见～

中
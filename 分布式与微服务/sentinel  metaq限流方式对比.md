---
title: "sentinel  metaq限流方式对比"
source: "https://ata.atatech.org/articles/11020828468?spm=ata.23639746.0.0.59fc36295g08Ue#MWU1ZmNi"
author:
  - "[[吴圣炜(圣炜)]]"
published:
created: 2026-11-06
description:
tags:
  - "clippings"
---
## 简述

本次对比的是sentinel的排队模式的限流对metaq消费的不同方式对比，总体来说，两者都能实现被限流topic的匀速调用，但是使用sentinel官方提供的限流方式，未被限流的也能进入消费，就是速率慢一点，但是直接自定义埋点会卡死消费线程，导致需要等被限流消费完之后才能消费其他的

## 方式一：使用sentinel提供的接入方式（推荐）

接入文档： [https://yuque.alibaba-inc.com/sentinel2c/sentinelfaq/kfoai7gu4ffmc827#mKhHM](https://yuque.alibaba-inc.com/sentinel2c/sentinelfaq/kfoai7gu4ffmc827#mKhHM)

## 限流配置：

资源点位格式 metaq:consumer:${cid}:${topic} ![](d8a77152-95c0-45ab-898b-97f45463a13d.png)

## 限流效果

配置的限流的流量会和均匀，同时其他消息能消费，就是速率会慢一点

LEADS\_CENTER\_METAQ\_QPS\_TEST （配置了限流的）

![](a315ac89-c597-4f47-89ae-69ce75de972a.png)

LEADS\_CENTER\_METAQ\_QPS\_TEST2 （没配置限流）

![](9f76a31a-7f07-4634-af11-0761f5f3ff84.png)

除被限流topic外的整体

![](b09621da-008a-4a13-b2b6-f399c7632b22.png)

## 方式二：使用自定义埋点模式

接入方式，在消费监听器中自己使用限流代码

![](ba9bbac6-802e-41e6-8233-15998a0bbcaa.png)

## 限流配置

![](861e3f10-5c80-4e66-bcaf-d09adfa5fce8.png)

## 限流效果

配置了限流的流量很平均，但是，会完全阻塞其他消息的消费

LEADS\_CENTER\_METAQ\_QPS\_TEST （配置了限流的）

![](f4f8807b-e5d9-484d-acb9-3d5496143197.png)

LEADS\_CENTER\_METAQ\_QPS\_TEST2 （没配置限流）

![](928737a3-09bc-465a-bc1e-e2bfba368db6.png)

除被限流topic外的整体

![](9ea834d5-e841-4084-a0a2-c899856afcc5.png)

## 附录1-sentinel接入metaq限流实现代码位置

MessageListenerConcurrentlyWrapper

![](48ada4e4-84c5-4c8e-a3b4-506ce2c184fe.png)

## 附录2-超时时间计算逻辑

超时时间需要按照metaq线程数来算

## metaq线程获取

com.alibaba.rocketmq.client.consumer.DefaultMQPushConsumer#consumeThreadMin

com.alibaba.rocketmq.client.consumer.DefaultMQPushConsumer#consumeThreadMax

这两个值是线程配置，注意！metaq不是动态线程，所以max那个值没用，因此min就是线程数，单机默认是20，配置集群时需要根据机器数量进行计算

参考文档： [https://aliyuque.antfin.com/coreengine/metaq\_wiki/cmnixt](https://aliyuque.antfin.com/coreengine/metaq_wiki/cmnixt)

![](59b68fdc-567e-4261-bedd-aed592fce61f.png)

## 最小超时时间计算

公式： 
$$
timeout(ms) = Math.max(metaq总线程数 \times \frac{1000ms}{qps}, 3000ms)
$$

中
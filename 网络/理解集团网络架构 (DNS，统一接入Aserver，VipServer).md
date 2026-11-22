---
title: "理解集团网络架构 (DNS，统一接入Aserver，VipServer)"
source: "https://ata.atatech.org/articles/11000248963?spm=ata.23639746.0.0.57a578114IhJWk"
author:
  - "[[胡学字(向灏)]]"
published:
created: 2026-10-09
description:
tags:
  - "clippings"
---
【更新中】

最近在给 [DoveWebPlayer](https://dove.alibaba-inc.com/) 搭建官网，涉及域名申请、站点搭建、文档编写等。虽然有现成的平台（如pages）可以快速搭建，但自己还是想亲自体验网站部署流程，顺便尝鲜一下集团Faas Serverless部署技术，于是采用Midway一体化方案完成站点搭建与运维。

但在域名申请过程中，发现自己掌握的集团网络架构知识确实不够，过程中处处碰壁，在此记录下自己的学习路径，所以本文主讲在申请域名过程中，以探索视角尝试理解集团网络架构，大家共同进步。

## 关键概念

先简单看下关键概念，后面进行探索之旅时，也好有个印象。

网关（gateway）：将2个使用不同协议的网络链接在一起的设备，可理解为一个网络到另一个网络的“关口”。

集群：多台独立的计算器组成的一个系统。

统一接入：集团的转发网关，将你的请求，转发至应用机器。

VIP：（Virtual IP）统一接入的IP地址。统一接入包含n个集群，当你的域名接入统一接入后，请求会先通过cname跑到统一接入的集群中。

VipServer：VipServer域名只是一个标识，该标识可以对应具体服务器ip+端口，该标识可以关联aone应用，进而关联具体服务ip。

AServer: 集团统一接入网关。集团内部几乎所有web流量都走Aserver。AServer会关联VipServer，通过VipServer获取服务ip地址，将流量转发到具体的服务器。既 浏览器请求 → 1 AServer → 2 VipServer - 3 流量转发到具体应用ip上（应用部署的机器资源在Normandy申请）。

## 探索之旅

探索开始，我们从浏览器访问内网域名 [dove.alibaba-inc.com](https://ata.atatech.org/articles/dove.alibaba-inc.com) 开始，慢慢揭开面纱。

### DNS解析

通过dig命令，看到DNS解析过程，推荐带上+trace选项更清晰。

![](3efa20cf-8d6a-4099-a38c-dae4aa60a6f0.png)

Round1

本地请求LoacalDNS|公共DNS

Q: 请告诉我dove.alibaba-inc.com的地址？

A：我不知道，你去问问这13个顶级域名服务器吧（a.root-servers.net.~k.root-servers.net.）。

Round2

随机选择了m.root-servers.net.

Q: 请告诉我dove.alibaba-inc.com的地址？

A：我不知道，你去问问这13个com.域名服务器吧（a.gtld-servers.net.~k.gtld-servers.net.）。

Round3

随机选择了i.gtld-servers.net

Q: 请告诉我dove.alibaba-inc.com的地址？

A：我不知道，你去问问这2个alibaba-inc.com.域名服务器吧（ns1.alibaba-inc.com~ns2.alibaba-inc.com）。

Round4

随机选择了ns2.alibabadns.com

Q: 请告诉我dove.alibaba-inc.com的地址？

A：我知道！dove.alibaba-inc.com的cname记录是work.tengine.ingress.alibabacorp.com

可以看到，最终解析出的结果并不是ip地址，而是一个cname记录，这是阿里的权威DNS服务器。

我们继续dig这个cname，发现依然是cname，依次dig，最终找到ip地址。

![](4621a9ff-f6af-4798-9f65-c651f9e08bb9.png) ![](ff8213bf-f66b-453f-9b8d-e2c3f8164c4b.png) ![](eeabff7a-7658-4b91-8513-1d9ee5cfd5b3.png)

上面的解析流程如下图

![](f1487791-a54d-44f6-b263-891fc84d9abe.png)

为了验证解析的正确性，我们也可以从集团 [iDns](http://idns.alibaba-inc.com/) 平台查询域名记录。

![](ad9dd91d-c592-46d5-a20f-bfdcc5c5d41a.png) ![](cd108aa3-7986-4c24-b43a-5243a4b18f47.png) ![](18a6ef33-5aee-4b4b-b19d-22f93a30dccc.png) ![](439770f0-ae7f-42a4-a5eb-e0f02216ae74.png)

发现是吻合的，说明从第一个cname（work.tengine.ingress.alibabacorp.com.）开始，就进入到了集团的DNS解析流程中，最终由集团DNS服务器解析返回IP地址。

### ADNS

上面的集团内域名解析过程，涉及到了ADNS。

ADNS是集团自研的高性能权威DNS，主要包含以下特性：

- 线路智能解析
- 机房自动/手动灾备切换
- 分机房流量调度

业务域名升级至ADNS后，DNS系统会自动为业务域名创建出一个CNAME域名且后缀gds.alibabadns.com (上面看到的)。目前集团ADNS采用业务域名CNAME至gds域名的方式，即work.tengine.ingress.alibabacorp.com. CNAME 至work.tengine.ingress.alibabacorp.com.gds.alibabadns.com，再为work.tengine.ingress.alibabacorp.com.gds.alibabadns.com分配对应的A解析IP地址。

### LVS负载均衡

那么，最终解析出来的这个ip是什么呢？

去诺曼底平台搜索ip：59.82.113.244

![](a6a72d67-ca9b-4a85-908e-4e2cd57ae205.png)

发现这是一个VIP，这里又提到了集团负载均衡器LVS，而VIP就是LVS的出口IP。

LVS是Linux Virtual Server的简称，也就是Linux虚拟服务器，关于LVS的介绍大家可以自行ata。

### 统一接入AServer

从上图可以看到，ip所属应用是aserver-ingress，AServer很重要，也叫统一接入。

统一接入层是一个Tengine运行的web server代理，由它主要负责承担全网用户的http/https请求，然后请求转发(proxy\_pass)给后端的应用服务器。目前95%以上的对外应用的流量都通过统一接入层转发，可以说统一接入层是阿里业务架构中的最前端也最基础的服务。

这里提到了另外一个阿里产品Tengine，Tengine是由淘宝网发起的Web服务器项目。它在Nginx的基础上,针对大访问量网站的需求,添加了很多高级功能和特性。

回头来看统一接入官方的架构图：

![](018b8cfd-772c-4e9e-a82a-dc2c13e079ef.png)

继续往下，用户的请求都到统一接入层了，那统一接入这里如何进行路由呢？如果直接修改Tengine配置，集团这么大规模的机器，频繁的变更，这个配置更新将会是一个灾难。而如果统一接入到应用走域名，那这里需要再次进行DNS解析，并且每个应用的集群都需要搭建负载均衡，这个成本也是很高的，也导致又经过一层负载均衡性能降低。针对这个问题，轮到VipServer出马了。

### VipServer

VIPServer，是中间件软负载团队推出的一个软负载产品，用于取消内网使用的VIP负载均衡方式，实现P2P直连。

和基于LVS VIP方式的负载均衡方式相比，VIPServer通过集中式的配置向客户提供路由信息，以非网关的形式实现负载均衡功能。

假设内网有两个集群A和B。现在有一个请求要从A集群转发到B集群，请求链路是怎样的呢？

- 基于LVS负载均衡的方式：请求到B集群的某个LVS VIP，通过LVS转发给B集群的某台机器上。这种方式下LVS相当于一个网关，所有到B集群的请求需要经过LVS转发，存在性能瓶颈。
- 基于VIPServer软负载的方式：首先B集群得在VIPServer OPS上集中配置该集群（由VIPServer key标识）的机器列表信息。然后A传入B的VIPServerKey向VIPServer查询，得到B集群某台机器的IP地址后直接发送请求到该机器。这种方式下，调用方和被调用方通过直连的方式通讯，VIPServer并不不负责转发请求，VIPServer在调用链路的旁路上。

VIPServer目前在接入层、业务层、中间件、数据库都发挥了重要作用。其中，接入层（Aserver）通过 VIPServer 发现后端可用机器；业务层通过 VIPServer 做服务发现和调用；中间件通过 VIPServer 做环境路由；数据库（corona）则通过 VIPServer 解决 DNS 解析和优雅上、下线问题。VIPServer在系统中的位置如下图所示（ [图片来源](http://gitlab.alibaba-inc.com/middleware/vipserver/wikis/home) ）：

![](3aa2638b-36bd-4a36-9c02-2cac5dea488d.png)

VIPServer是如何帮助Aserver将请求正确地路由到对应的业务集群上的呢？

业务第一次上统一接入层时需要到先到VIPserver添加VIPServer key和应用分组等信息，在PSP提交接入申请时需要填写域名和VIPServer key。参考 [官方wiki](http://gitlab.alibaba-inc.com/ali-devops/devops/wikis/aserver-maul) 得知，VIPServer Key和域名是一对多的关系。

在注册了上述这些关键信息后，当一个外部请求通过LVS集群转发到Aserver时，Aserver就可以借助VIPServer路由到对应的业务集群上了，主要步骤如下：

- Aserver首先从请求头中获取请求的域名，
- 然后根据域名找到对应的VIPServer Key，
- 最后根据VIPServer Key到VIPserver查询后端业务集群的机器IP并转发

### 应用层

截止到现在，请求打到了我们web服务器上。集团Serverless的Faas函数也部署在一个Pouch容器。

TODO://应用层细节

## 总结转发流程

前置：当你已经为dove.alibab-inc.com申请统一接入，并且申请对应的vipServerKey为dove.vipserver。

流程：当请求dove.alibab-inc.com，首先会通过cname到统一接入集群，统一接入发现请求头为dove.alibab-inc.com，就会找到dove.alibab-inc.com对应的vipServerKey为dove.vipserver，然后去vipserver后台查到你应用的机器，最终将流量转发到这台机器上。

![](3a6f06d3-df35-4874-9aa5-6ebfd80579c1.png)

## 域名申请

iDNS注册域名

注册地址： [http://idns.alibaba-inc.com/domain\_manage/domain\_change\_index](http://idns.alibaba-inc.com/domain_manage/domain_change_index/?spm=ata.21736010.0.0.77514f02whHHqF)

申请vipserverKey

一个key下可以有多个域名，统一接入层根据域名找到对应的Key，再根据key到VIPserver获取后端集群的机器列表。

申请地址： [http://vipserver.alibaba.net/app/pages/domain-list/index.html](http://vipserver.alibaba.net/app/pages/domain-list/index.html)

申请统一接入

[https://fs.alibaba-inc.com/?spm=a1zek.8769333.0.0.686920c4ZBF7fh#/ingressManage](https://fs.alibaba-inc.com/?spm=a1zek.8769333.0.0.686920c4ZBF7fh#/ingressManage)

参考：

集团网络架构总结： [https://ata.alibaba-inc.com/articles/135529?spm=ata.23639746.0.0.322f3566lPgDKI](https://ata.alibaba-inc.com/articles/135529?spm=ata.23639746.0.0.322f3566lPgDKI)

统一接入原理： [https://tengineops.alibaba-inc.com/?spm=ata.21736010.0.0.10ca5ff9rjekAK#/z3jfz](https://tengineops.alibaba-inc.com/?spm=ata.21736010.0.0.10ca5ff9rjekAK#/z3jfz)

统一接入AServer： [https://ata.alibaba-inc.com/articles/190762?spm=ata.23639746.0.0.6aa16809pOmfeY#OoZ0paPF](https://ata.alibaba-inc.com/articles/190762?spm=ata.23639746.0.0.6aa16809pOmfeY#OoZ0paPF)

阿里接入层浅析： [https://ata.alibaba-inc.com/articles/190762?spm=ata.23639746.0.0.6aa16809pOmfeY#OoZ0paPF](https://ata.alibaba-inc.com/articles/190762?spm=ata.23639746.0.0.6aa16809pOmfeY#OoZ0paPF)

中
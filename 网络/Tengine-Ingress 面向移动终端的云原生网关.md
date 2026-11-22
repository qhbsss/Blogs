---
title: "Tengine-Ingress 面向移动终端的云原生网关"
source: "https://ata.atatech.org/articles/11020338830?spm=ata.23639746.0.0.7da6625chNzdfX#MDM2Njk5"
author:
  - "[[李亮(海苍)]]"
published:
created: 2026-10-09
description:
tags:
  - "clippings"
---
## 1\. 引言

在AServer无线网关Ingress架构升级演进项目中，基于Tengine-Ingress高可靠性架构，对齐mtop功能和配置，实现接入网关的技术栈统一。平稳无缝完成mtop链路迁移，支持导购交易17w+ API路由配置的无损动态生效以及TLS证书的动态加载和续期，RT与成功率持平，内存占用由40%下降至32%，单机节省内存11GB。Ingress规模化进一步扩大，ingress域名数量超过9w+，兜底集团经济体所有流量，淘宝天猫所有顶级域全量迁移ingress，ingress域名峰值QPS已达500w+，业务端到端RT平均降低9ms。

本文将阐述统一接入新应用AServer-Ingress基于云原生ingress标准实现内部架构统一，其技术底座Tengine-Ingress不断提升自身的可用性和稳定性，全面兼容MTOP API以适配手淘无线移动终端。

## 2\. 术语

- AServer-Ingress: 基于K8s云原生ingress标准，实现阿里统一接入层架构升级的新应用。
- Tengine-Ingress：应用AServer-Ingress的技术底座，由Tengine-Ingress控制器和Tengine-Proxy组成。
- MTOP: Mobile Taobao Open Platform的简称，为集团移动终端 (Native)和H5提供统一可靠的API基础能力。
- Ultramax-backend: 面向用户侧具备MTOP API配置变更能力的控制台。
- FreeStream: 应用AServer-Ingress的控制台，面向用户侧的应用域名和证书变更操作平台，同时包含网关集群管理能力。
- AMDC: 集团内部面向移动终端的DNS服务器。
- TNET: Taobao Network的简称，面向移动终端的淘宝网络库。
- VIP: Virtual IP的缩写，4层负载均衡SLB的IP地址。
- Kubenest: 作为AServer-Ingress集群侧管控系统，负责AServer-Ingress发布，灰度，升级，扩缩容，VIP申请，资源配置和配置变更。
- K8s: Kubernetes简称为K8s，K8s是用于自动部署、扩展和管理容器化应用程序的分布式系统。
- ASI：AlibabaCloud Serverless Infrastructure的简称，面向云原生应用的统一基础设施，提供全托管和半托管K8s集群运维服务。
- Configmap：K8s系统中的一种API对象，用来将非机密性的数据保存到键值对中。
- StatefulSet: K8s用来管理有状态应用的工作负载 API 对象。
- CloneSet: OpenKruise对K8s系统的扩展，提供了高效管理无状态应用的Set类型工作负载。
- Ingress: K8s集群向外部提供访问集群内部服务的HTTP(S)七层负载均衡，TLS卸载和路由转发的系统原生资源。
- Secret: K8s集群中用户定义加密数据的系统原生资源，可以包含证书，私钥，密码，token，key等信息。
- Annotations: K8s注解；ingress和secret系统原生资源通过注解 (annotations) 扩展七层负载均衡，TLS卸载和路由转发相关的配置信息。
- CRD: CustomResourceDefinition的简称，在K8s系统中用于定义API服务器上可公开访问的用户自定义资源。
- API Server: API服务器是K8s集群的一个关键组件，通过K8s API和JSON over HTTP提供K8s的内部和外部接口。API服务器处理和验证REST请求并更新API对象在etcd中的状态，从而允许客户端在工作节点之间配置工作负载和容器。
- Etcd: 用于存储K8s集群中配置数据的一种持久性，轻量型，分布式的键-值数据存储组件。
- MD5: Message-Digest Algorithm的简称，一种被广泛使用的密码杂凑函数，可以产生出一个128位元 (16个字节) 的散列值，用于确保信息传输完整一致。
- TLS: Transport Layer Security的简称，其前身为SSL (Secure Sockets Layer)，TLS是一种安全传输协议，为互联网通信提供安全和数据完整性保障。
- SNI: Server Name Indication的简称， TLS协议的扩展字段，用于标识客户端请求的主机名称 (域名)。

## 3\. 架构

Tengine-Ingress作为7层流量入口网关的技术底座，兼容支持业界主流的7层网络应用协议。移动终端默认通过AMDC获取网关集群的4层负载均衡SLB的VIP，兜底降级使用DNS作域名解析，互联网HTTPS请求首先路由到4层负载均衡SLB，SLB在4层 (TCP/UDP) 将HTTPS报文转发到7层网关Tengine-Ingress，Tengine-Ingress基于动态ingress (MTOP域名)和secret证书配置本地卸载TLS，基于ingress (MTOP API)中的单元化和路由策略向后端应用转发HTTP/1.1明文请求。

![](9bc3dcc7-8428-4c00-a222-6e16c8f2e2b2.png)

图1. Tengine-Ingress 系统架构

## 4\. 云原生

Tengine-Ingress在兼容K8s ingress标准规范的基础上持续扩展和优化，兼容MTOP域名和API，通用单元化和HTTP3/QUIC协议，以适配移动终端的多API，大流量，高并发，低延迟的特殊场景。

## 4.1 MTOP

MTOP是Mobile Taobao Open Platform的简称，移动终端App (Andorid, iOS, HarmonyOS) 基于客户端MTOP SDK统一封装端侧的API请求。Tengine-Ingress作为标准7层入口网关，在传统web域名基础上，针对MTOP提供了MTOP域名和MTOP API相关的ingress注解，无缝对接客户端MTOP SDK。

表1. MTOP域名ingress注解

<table><colgroup><col width="90"> <col width="167"> <col width="70"> <col width="62"> <col width="81"> <col width="401"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>注解名称</p></td><td rowspan="1" colspan="1"><p>值类型</p></td><td rowspan="1" colspan="1"><p>默认值</p></td><td rowspan="1" colspan="1"><p>生效维度</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/ingress-type</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>"web"</p></td><td rowspan="1" colspan="1"><p>域名</p></td><td rowspan="1" colspan="1"><p>Ingress类型：默认标准web域名</p><ul><li>"web": 标准web域名</li><li>"mtop": mtop域名</li></ul></td></tr></tbody></table>

MTOP的核心在于API，终端App的业务模块实际并不感知应用域名的存在，不同的业务模块基于MTOP SDK统一封装的API接口实现其自身的业务逻辑。对于MTOP类型的域名而言，Tengine-Ingress在TLS建链握手过程中基于ClientHello的SNI动态匹配TLS证书。除此之外，所有TLS和HTTPS相关的配置 (例如：强制HTTPS和指定TLS协议版本) 都需要归属在MTOP域名这一层级。在TLS建链完成后，Tengine-Ingress通过HTTP URL提取其中的API信息，在共享内存中查询MTOP API对应的路由配置，从而将MTOP API的请求转发到后端应用对应的机器分组中。

![](c16f1cc6-e499-463a-b428-57a39861f2f0.png)

图2. MTOP域名和MTOP API

通过在ingress资源对象中增加注解nginx.ingress.kubernetes.io/ingress-type: mtop，显示地将其标识为MTOP域名。在MTOP域名的ingress资源对象中，主要定义了MTOP域名对应的secret资源对象名称，每个secret资源对象定义了一张TLS证书信息和对应的TLS私钥。以手淘的导购域名guide-acs.m.taobao.com为例，除了基本的后端服务超时时间nginx.ingress.kubernetes.io/proxy-read-timeout和强制HTTPS跳转nginx.ingress.kubernetes.io/ssl-redirect的ingress注解以外，核心点是通过secret资源对象名称显示地关联了导购域名的ECC和RSA两张TLS证书。

Ingress实例: MTOP域名

99

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

▶

apiVersion: networking.k8s.io/v1

kind: Ingress

metadata:

annotations:

nginx.ingress.kubernetes.io/ingress-type: mtop

nginx.ingress.kubernetes.io/proxy-read-timeout: "60"

nginx.ingress.kubernetes.io/ssl-redirect: "false"

name: alibaba-tao-mtop-guide-acs-m-taobao-com-2140947

namespace: aserver-ingress-tao-mtop

spec:

ingressClassName: aserver-ingress-tao-mtop

rules:

\- host: guide-acs.m.taobao.com

tls:

\- hosts:

\- guide-acs.m.taobao.com

secretName: alibaba-tao-mtop--taobao-com-415

\- hosts:

\- guide-acs.m.taobao.com

secretName: alibaba-tao-mtop--taobao-com-416

在MTOP域名关联了TLS证书之后，通过MTOP API的ingress资源对象规划具体的HTTP路由信息。MTOP API与MTOP域名之间并没有强耦合关系，一个应用可以定义多个MTOP API，每个MTOP API都有唯一的路由信息。通过在ingress资源对象中增加注解nginx.ingress.kubernetes.io/api，不仅显示地将其标识为MTOP API，同时通过该注解定义了具体的API信息。注解nginx.ingress.kubernetes.io/app是API实际归属的应用名，通过该信息可以规划应用维度的高级路由，应用维度的高级路由可同时在相同应用的所有MTOP API中动态生效。最后，注解nginx.ingress.kubernetes.io/api-referrer描述了MTOP API的来源系统，Tengine-Ingress基于来源系统白名单，在运行时动态决定MTOP API是否最终生效。

表2. MTOP API ingress注解

<table><colgroup><col width="90"> <col width="233"> <col width="114"> <col width="103"> <col width="476"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>注解名称</p></td><td rowspan="1" colspan="1"><p>值类型</p></td><td rowspan="1" colspan="1"><p>生效维度</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/api</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>mtop域名</p></td><td rowspan="1" colspan="1"><p>API信息</p></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/app</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>mtop域名</p></td><td rowspan="1" colspan="1"><p>API实际归属的应用名</p></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/api-referrer</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>mtop域名</p></td><td rowspan="1" colspan="1"><p>API信息的来源系统</p></td></tr></tbody></table>

以手淘的TPP推荐平台无线访问接口为例，API "mtop.relationrecommend.WirelessRecommend.recommend\_2.0"归属在应用relationrecommend下，后端服务超时时间nginx.ingress.kubernetes.io/proxy-read-timeout为20秒。MTOP API与MTOP域名可以同时定义相同的ingress注解，MTOP API的优先级要高于MTOP域名。如果该API通过上述导购域名生成HTTP请求，实际生效的后端服务超时时间将是API维度配置的20秒。API的来源系统是ultramax-backend，所有不在Tengine-Ingress来源系统白名单中的MTOP API将被丢弃处理。基于后端应用服务的ingress注解nginx.ingress.kubernetes.io/backend-vipserver，Tengine-Ingress会将API的所有请求轮询转发到vipserver key "mtop.uncenter.relationrecommend"挂载的IP列表中。

Ingress实例: MTOP API

99

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

21

22

▶

apiVersion: networking.k8s.io/v1

kind: Ingress

metadata:

annotations:

nginx.ingress.kubernetes.io/api: mtop.relationrecommend.WirelessRecommend.recommend\_2.0

nginx.ingress.kubernetes.io/api-referrer: ultramax-backend

nginx.ingress.kubernetes.io/app: relationrecommend

nginx.ingress.kubernetes.io/backend-vipserver.mtop-2euncenter-2erelationrecommend: mtop.uncenter.relationrecommend

nginx.ingress.kubernetes.io/proxy-read-timeout: "20"

name: rpc-5emtop.relationrecommend.wirelessrecommend.recommend-5e2.0

namespace: aserver-ingress-tao-mtop

spec:

ingressClassName: aserver-ingress-tao-mtop

rules:

\- http:

paths:

\- backend:

service:

name: mtop-2euncenter-2erelationrecommend

port:

number: 80

pathType: ImplementationSpecific

## 4.2 单元化

单元是一种面向业务形态的流量分片，将不同地域的物理机房划分为多个逻辑域的单元。逻辑域的单元屏蔽了底层物理机房的概念，不同的应用服务之间通过逻辑域的单元，保证业务数据链路的一致性。移动终端服务可以在MTOP域名和MTOP API两个维度配置不同的单元化路由策略。

![](145fd3d7-a263-45cf-850d-d78150af6da4.png)

图3. Tengine-Ingress 单元化路由模型

统一接入网关Tengine-Ingress在单元的基础上，面向移动终端业务提供了通用单元化路由的ingress注解nginx.ingress.kubernetes.io/unit，通用单元化具体包括交易单元化，导购单元化和仅中心三种路由策略。手淘移动终端的交易MTOP域名和导购MTOP域名分别采用了交易单元化和导购单元化路由策略，其它MTOP域名默认仅中心路由。

表3. 通用单元化ingress注解

<table><colgroup><col width="90"> <col width="172"> <col width="109"> <col width="556"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>注解名称</p></td><td rowspan="1" colspan="1"><p>值类型</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/unit</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>通用单元化路由</p><ul><li>"trade_unit" 交易单元化</li><li>"guide_unit" 导购单元化</li><li>"center" 仅中心</li></ul></td></tr></tbody></table>

表4. 通用单元化路由策略

<table><colgroup><col width="90"> <col width="53"> <col width="332"> <col width="498"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>通用单元化</p></td><td rowspan="1" colspan="1"><p>路由策略</p></td><td rowspan="1" colspan="1"><p>重试路由策略</p></td></tr><tr><td rowspan="1" colspan="2"><p>交易单元化</p></td><td rowspan="1" colspan="1"><p>默认向同单元同机房的后端应用转发请求</p></td><td rowspan="1" colspan="1"><p>错误500, 502, 503时，同单元跨机房重试请求。</p></td></tr><tr><td rowspan="1" colspan="2"><p>导购单元化</p></td><td rowspan="1" colspan="1"><p>默认向同单元同机房的后端应用转发请求</p></td><td rowspan="1" colspan="1"><p>错误500, 502, 503时，全局随机重试请求。</p></td></tr><tr><td rowspan="1" colspan="2"><p>仅中心</p></td><td rowspan="1" colspan="1"><p>默认向中心单元同机房的后端应用转发请求</p></td><td rowspan="1" colspan="1"><p>错误500, 502, 503时，仅中心随机重试请求。</p></td></tr></tbody></table>

在通用单元化路由的基础上，移动终端业务可以通过ingress注解nginx.ingress.kubernetes.io/unit-redirect定义单元重定向路由策略，统一接入网关Tengine-Ingress可以将指定源单元的请求全部转发到后端服务指定目的单元的机器分组。

表5. 单元重定向ingress注解

<table><colgroup><col width="90"> <col width="165"> <col width="64"> <col width="667"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>注解名称</p></td><td rowspan="1" colspan="1"><p>值类型</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/unit-redirect</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>单元重定向</p><ul><li>值格式：&lt;source-unit&gt;:&lt;dest-unit&gt;[||&lt;source-unit&gt;:&lt;dest-unit&gt;]*</li><li>&lt;source-unit&gt;: tengine-ingress所在单元</li><li>&lt;dest-unit&gt;: 转发请求到目标单元</li></ul></td></tr></tbody></table>

例如，MTOP API "mtop.relationrecommend.WirelessRecommend.recommend\_2.0"后端服务vipsever key "mtop.uncenter.relationrecommend"的机器分组仅在中心单元center和南通unsh单元有实际部署，在日常态定义了下述单元重定向策略，统一接入网关Tengine-Ingress将会把源中心混部单元unzbmix25g和unzbmix的请求重定向转发到后端应用的中心单元center，并将南通混部单元une1和unn1的请求全部转发到后端应用南通unsh单元。

Ingress实例: 单元重定向路由策略

99

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

21

22

23

▶

apiVersion: networking.k8s.io/v1

kind: Ingress

metadata:

annotations:

nginx.ingress.kubernetes.io/api: mtop.relationrecommend.WirelessRecommend.recommend\_2.0

nginx.ingress.kubernetes.io/api-referrer: ultramax-backend

nginx.ingress.kubernetes.io/app: relationrecommend

nginx.ingress.kubernetes.io/backend-vipserver.mtop-2euncenter-2erelationrecommend: mtop.uncenter.relationrecommend

nginx.ingress.kubernetes.io/proxy-read-timeout: "60"

nginx.ingress.kubernetes.io/unit-redirect: unzbmix25g:center||une1:unsh||unzbmix:center||unn1:unsh

name: rpc-5emtop.relationrecommend.wirelessrecommend.recommend-5e2.0

namespace: aserver-ingress-tao-mtop

spec:

ingressClassName: aserver-ingress-tao-mtop

rules:

\- http:

paths:

\- backend:

service:

name: mtop-2euncenter-2erelationrecommend

port:

number: 80

pathType: ImplementationSpecific

最后，Tengine-Ingress通过ingress注解nginx.ingress.kubernetes.io/unit-weight面向移动终端服务提供了基于权重的单元化路由策略。同一个MTOP域名或者MTOP API只允许配置一种单元化路由策略。通用单元化的优先级最高，其次是单元重定向，最后才是基于权重的单元化路由策略。如果同时配置了多个单元化路由策略，只生效优先级最高的单元化路由，忽略其它低优先级策略。

表6. 基于权重单元化路由ingress注解

<table><colgroup><col width="111"> <col width="140"> <col width="657"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>注解名称</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/unit-weight</p></td><td rowspan="1" colspan="1"><p>基于权重的单元化路由</p><ul><li>值格式：&lt;consistent hashing&gt;&amp;&lt;unit&gt;:&lt;weight&gt;[||&lt;unit&gt;:&lt;weight&gt;]*</li><li>&lt;consistent hashing&gt;: 是否基于设备ID采用一致性哈希负载均衡模式，默认false；<ul><li>true：开启一致性哈希转发模式，基于设备ID按权重转发请求到指定单元内；</li><li>false：不开启一致性哈希转发模式，按权重转发请求到后端应用的不同单元内。</li></ul></li><li>&lt;unit&gt;: 单元；&lt;weight&gt;: 权重，值范围：[1, 100]</li></ul></td></tr></tbody></table>

## 4.3 HTTP3

Tengine-Ingress已全面支持HTTP3协议，为移动终端带来了更安全，更快速，更可靠的协议接入能力，满足移动终端在高并发和大流量场景下的低延迟体验。每个域名都可以通过ingress注解nginx.ingress.kubernetes.io/enable-h3动态启用和关闭HTTP3/QUIC协议接入能力，客户端通过HTTP/1.1发起请求到Tengine-Ingress网关后，Tengine-Ingress通过响应Header alt-svc: h3=":443"; ma=2592000,h3-29=":443"; ma=2592000通知客户端，原HTTP/1.1的域名可以安全升级到HTTP/3协议，服务端的HTTP/3协议服务端口为443，HTTP/3协议可用时长2592000秒。如果客户端支持HTTP/3协议，那么相同域名的后续请求将会升级使用HTTP/3协议与服务端进行交互，从而平滑地从原HTTP/1.1升级到HTTP/3。当然，对于原生HTTP/3客户端，例如手淘移动终端的交易和导购域名，因在AMDC移动终端DNS服务器显示地配置了HTTP/3协议，手淘默认将使用HTTP/3建链请求，从而极大地缩短了请求时延，为用户带来了更好的体验。

表7. HTTP3 ingress注解

<table><colgroup><col width="90"> <col width="150"> <col width="61"> <col width="61"> <col width="518"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>注解名称</p></td><td rowspan="1" colspan="1"><p>值类型</p></td><td rowspan="1" colspan="1"><p>默认值</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/enable-h3</p></td><td rowspan="1" colspan="1"><p>bool</p></td><td rowspan="1" colspan="1"><p>false</p></td><td rowspan="1" colspan="1"><p>动态开启单个域名HTTP3/QUIC协议接入</p><p>默认禁止HTTP3/QUIC；</p><p>值为true时，支持应用域名通过HTTP3/QUIC协议与客户端交互。</p></td></tr></tbody></table>

Ingress实例: 启用HTTP/3协议

99

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

21

22

23

24

25

26

27

28

29

30

31

▶

apiVersion: networking.k8s.io/v1

kind: Ingress

metadata:

annotations:

nginx.ingress.kubernetes.io/backend-vipserver.tengine-taobao-org-vipserver: tengine.taobao.org.vipserver

nginx.ingress.kubernetes.io/enable-h3: "true"

nginx.ingress.kubernetes.io/ingress-type: web

nginx.ingress.kubernetes.io/proxy-read-timeout: "60"

nginx.ingress.kubernetes.io/ssl-redirect: "true"

name: alibaba-domestic-tengine-taobao-org-2277202

namespace: aserver-ingress-domestic

spec:

ingressClassName: aserver-ingress-domestic

rules:

\- host: tengine.taobao.org

http:

paths:

\- backend:

service:

name: tengine-taobao-org-vipserver

port:

number: 80

path: /

pathType: ImplementationSpecific

tls:

\- hosts:

\- tengine.taobao.org

secretName: alibaba-domestic--alibabacorp-com-789

\- hosts:

\- tengine.taobao.org

secretName: alibaba-domestic--alibabacorp-com-788

技术底座Tengine-Ingress默认支持HTTP/3请求流式和响应流式。HTTP请求是否携带Header Content-Length并不是强制性的，在Content-Length存在的情况下，如果Tengine-Ingress实际接收的报文长度大于Header Content-Length的值，那么Tengine-Ingress默认将返回HTTP 413 Content Too Large错误状态码，终止本次流式请求。在请求消息未携带Header Content-Length的场景下，无论请求消息传输多少报文，Tengine-Ingress都将默认按照流式将请求报文实时地转发到后端应用服务。

![](9e911cdc-e7ed-468b-bb10-604c954ae5a0.png)

图4. HTTP/1与HTTP/3

移动终端业务除了默认通过TNET网络库触发HTTP/3请求以外，业务模块同时可以利用原生移动浏览器发起HTTP/3。Tengine-Ingress已全面兼容业界主流浏览器，包括Chrome，Firefox，Edge和Safari。

## 5\. 高可用

Tengine-Ingress作为7层流量入口网关应用AServer-Ingress的技术底座，面对移动终端17w+ 线上API，大流量，API高频变更等复杂极端场景，通过内部进程解耦，存储分离，分批灰度和全局一致性校验等多种系统架构方案，满足移动终端对高可用的严苛要求。

## 5.1 进程解耦

应用AServer-Ingress的技术底座Tengine-Ingress由两部分组成，Tengine-Ingress控制器和Tengine-Proxy。Tengine-Ingress控制器是一个基于Tengine-Proxy的ingress控制器，在兼容云原生ingress标准规范的基础上扩展了Server，Backend，VIPServer，TLS和Location。Tengine-Ingress控制器通过订阅和处理ingress (MTOP域名)，ingress (MTOP API)和secret证书资源，基于tengine ingress模板序列化为动态配置写入共享内存。Tengine-Proxy订阅共享内存变化写入内部运行时共享内存，将终端用户的外部流量路由到K8s集群中的应用服务。

![](8ce6526e-57a8-4fa1-baa8-fb94d7914da2.png)

图5. Tengine-Ingress 内部架构

Tengine-Ingress控制器在初次启动后，首先从ASI Core集群获取指定命名空间内的公共配置Configmap，基于tengine ingress模板序列化为配置文件，校验通过后的配置文件持久化在本地磁盘。与此同时，Tengine-Ingress控制器会从ASI存储集群获取用户面相关的ingress (MTOP域名)，ingress (MTOP API)和secret证书配置，校验MTOP域名，MTOP API和证书配置的合法性和全局一致性，符合ingress标准和X509证书规范的用户面配置信息将全量写入系统共享内存。在全量配置校验通过后，Tengine-Ingress控制器会再拉起Tengine-Proxy进程树，在Tengine-Proxy所有worker进程正常启动后，最后再设置健康检查通过的配置文件，网关实例开始对外接入服务。

虽然Tengine-Ingress控制器与Tengine-Proxy之间属于父子进程的关系，但两者在运行态保持进程解耦。在父进程Tengine-Ingress控制器异常退出后，就无法再自动更新配置，子进程Tengine-Proxy可以继续正常运行，健康检查并不受父进程异常退出的影响，网关实例继续对外提供服务，保证存量服务的可用性。在子进程Tengine-Proxy异常退出后，父进程Tengine-Ingress控制器不再拉起子进程Tengine-Proxy，健康检查自动校验失败，网关实例不再对外提供接入服务。因此，在Tengine-Ingress网关实例进入运行态并正式提供服务后，无论是Tengine-Ingress控制器异常还是Tengine-Proxy异常，都不会对彼此产生实质性的影响。

Tengine-Ingress进程解耦的相关配置卷

9

1

2

3

4

5

6

7

8

9

▶

volumeMounts:

\- mountPath: /etc/tengine/htdocs

name: autogen

subPath: status-taobao

\- mountPath: /etc/tengine/conf

name: autogen

subPath: tengine-conf

\- mountPath: /dev/shm

name: shm-volume

为了快速消除上述进程异常导致的各种风险，Tengine-Ingress会持久化本地配置文件并保存面向用户态系统共享内存的快照副本，快照副本范围包括ingress (MTOP域名)，ingress (MTOP API)，secret证书，路由，高级配置等所有用户态配置信息，每小时生成一次配置快照，保留最近7 \*24小时的快照副本，在此基础上增加了健康检查status-taobao，配置文件tengine-conf和共享内存shm-volume的三个卷，并提供了ingress快恢工具ingressctl可一键恢复网关实例到最近一次的正常配置状态，为网关系统的高可用性提供了坚实的兜底策略。

Tengine-Ingress快恢工具

9

1

2

3

4

▶

Usage: ingressctl -a \[(all|ingress|secret)\] -t \[YYYY-MM-DD-HH\]

\-a: rollback action (ingress + secret, ingress, secret)

\-h: rollback to the time

\-k: skip the confirmation notification for rollback action

## 5.2 存储分离

Tengine-Ingress基于ASI Core核心集群与ASI ingress存储集群相隔离的高可靠性方案，将网关运行态和用户面配置存储态完全分离。针对MTOP API数十万级的数据量，云原生网关Tengine-Ingress实例部署运行在ASI Core核心集群，将用户面相关的ingress (MTOP域名)，ingress (MTOP API)和secret证书配置存储在独立的ASI ingress存储集群。独立的ASI ingress集群仅保存用户面配置信息，其自身API服务器和etcd性能稳定，不受ASI Core核心集群的任何影响，即使在ASI Core集群核心组件API服务器和etcd不可用的高危场景下，Tengine-Ingress通过访问远端独立的ASI存储集群也能正常实时获取到用户面配置的变更信息，向外提供稳定的7层转发服务。

![](b3d1eff5-ee8e-4781-81e3-590f2416804a.png)

图6. Tengine-Ingress 存储分离

## 5.3 分批灰度

Tengine-Ingress作为7层流量入口网关应用AServer-Ingress的技术底座，每天存在三百次以上的MTOP API新增和修改的变更操作。然而，K8s原生资源对象ingress在被写入etcd后，所有监听控制器默认都会处理资源对象的配置更新，即相同命名空间内的所有Pod会同时加载新的配置对象，如果配置存在错误和脏数据，变更影响将会触发全局风险，导致线上事故。Tengine-Ingress作为云原生网关，必然通过K8s API处理和验证资源对象，这就需要我们扩展支持ingress (MTOP API) 的灰度能力，保障变更操作的可灰度，可中断和可回滚。

表8. 分批灰度ingress注解

<table><colgroup><col width="175"> <col width="193"> <col width="118"> <col width="66"> <col width="677"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>注解名称</p></td><td rowspan="1" colspan="1"><p>值类型</p></td><td rowspan="1" colspan="1"><p>默认值</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/ingress-rollout</p></td><td rowspan="1" colspan="1"><p>bool</p></td><td rowspan="1" colspan="1"><p>false</p></td><td rowspan="1" colspan="1"><p>Ingress资源对象分批次滚动生效开关。</p></td></tr><tr><td rowspan="2" colspan="2"><p>nginx.ingress.kubernetes.io/ingress-rollout-current-revision</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>""</p></td><td rowspan="1" colspan="1"><p>Ingress资源对象的当前运行版本号。</p></td></tr><tr><td rowspan="1" colspan="3"><ul><li>对于“扩容”/“重建”/“重启”的Pod，如果不在当前分批生效范围内，则从ingress资源对象的当前运行版本号ingress-rollout-current-revision对应的controllerrevision加载ingress资源对象。</li></ul></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/ingress-rollout-update-revision</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>""</p></td><td rowspan="1" colspan="1"><p>Ingress资源对象的升级版本号。</p></td></tr><tr><td rowspan="2" colspan="2"><p>nginx.ingress.kubernetes.io/ingress-rollout-index-id</p></td><td rowspan="1" colspan="1"><p>number</p></td><td rowspan="1" colspan="1"><p>0</p></td><td rowspan="1" colspan="1"><p>Ingress资源对象分批次滚动生效范围。</p></td></tr><tr><td rowspan="1" colspan="3"><ul><li>只有Pod序号索引小于ingress-rollout-index-id的网关实例才会动态更新ingress资源对象。</li><li>如果注解ingress-rollout-index-id: -1，则ingress资源对象在网关集群全量生效，不再分批次灰度逐级生效。</li></ul></td></tr></tbody></table>

K8s v1.28版本StatefulSet正式引入Pod索引标签，当StatefulSet控制器创建一个Pod时，新的Pod会被打上apps.kubernetes.io/pod-index标签，标签的取值为Pod的序号索引。集团环境下，ASI默认部署的工作负载是CloneSet，因此CloneSet控制器需要显示地为新的Pod打上apps.kubernetes.io/pod-index标签，以便兼容StatefulSet的Pod序号索引。

集群内的每个Tengine-Ingress实例会实时监听指定命名空间内的所有ingress (MTOP API) 资源对象，Tengine-Ingress监听获取到资源对象的更新事件后，会首先判断自身是否在本次配置变更Pod的范围内，变更资源对象的rollout注解 (nginx.ingress.kubernetes.io/ingress-rollout-index-id) 会圈定每个灰度批次生效范围的Pod序号索引，只有在Pod序号索引范围内的Tengine-Ingress实例才会处理变更资源对象，Tengine-Ingress会按照ingress标准校验ingress (MTOP API) 内容的合法性，并基于ingress全局一致性方案验证所有ingress (MTOP API) 的全局正确性和全局完整性，最后将符合协议规范和全局一致性的配置信息全量写入系统共享内存中。

在ingress (MTOP API) 分批次灰度生效的变更过程中，用户可通过QPS和成功率等Prometheus监控指标状态，随时主动终止和回滚本次配置变更，将风险缩小到可控范围内，保障MTOP API变更的可灰度，可监控，可回滚。

![](9f42eaf8-31bb-41e7-ab5a-b1e206dea992.png)

图7. Tengine-Ingress 分批灰度MTOP API

## 5.4 全局一致性

Tengine-Ingress在每个ASI Core核心集群部署有上千的运行实例，线上环境保存有17w+的MTOP API配置信息，网关集群的每个实例都必须在运行态持有相同的用户面配置，用户面配置的全局不一致性会导致网关总体成功率的下跌，在用户态会出现TLS握手失败，HTTP 404和路由错误等各类异常。因此，如何保障网关集群中每个实例运行态的用户面配置的全局一致性是至关重要的。K8s分布式系统本身可以保障单个资源对象配置的一致性，但分布式环境是无法保证用户存储在etcd中用户面配置的全局正确性和全局完整性，并且在API服务器和etcd不可用的情况下，用户面配置的可用性更是无法保障。

表9. MTOP API数量

<table><colgroup><col width="58"> <col width="52"> <col width="52"> <col width="52"> <col width="56"> <col width="52"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>环境</p></td><td rowspan="1" colspan="4"><p>MTOP API数量</p></td></tr><tr><td rowspan="1" colspan="2"><p>线上</p></td><td rowspan="1" colspan="4"><p>175117</p></td></tr><tr><td rowspan="1" colspan="2"><p>预发</p></td><td rowspan="1" colspan="4"><p>219662</p></td></tr><tr><td rowspan="1" colspan="2"><p>日常</p></td><td rowspan="1" colspan="4"><p>133297</p></td></tr></tbody></table>

CRD MtopApiIngressChecksum

9

1

2

3

4

5

6

7

▶

// MtopApiIngressChecksum's specification

type MtopApiIngressChecksumSpec struct {

// \`Timestamp\` is the time when the md5 of all the mtop api was calculated.

Timestamp metav1.Time \`json:"timestamp" protobuf:"bytes,1,opt,name=timestamp"\`

// \`Checksum\` is the md5 of all the mtop api.

Checksum string \`json:"checksum,omitempty" protobuf:"bytes,2,opt,name=checksum"\`

}

因此，Tengine-Ingress提出了一种分布式环境下ingress (MTOP API) 全局一致性方案。控制台Ultramax-backend负责计算全局ingress (MTOP API) 配置信息的一致性校验MD5，并写入CRD MtopApiIngressChecksum；数据面Tengine-Ingress监听ingress (MTOP API) 资源和CRD MtopApiIngressChecksum，通过相同的算法计算全局ingress (MTOP API) 配置信息的一致性校验MD5值，如果MD5值与CRD MtopApiIngressChecksum资源对象中的MD5值相匹配，则ingress (MTOP API) 全局一致性校验通过，Tengine-Ingress才会将ingress (MTOP API) 资源对象更新到本地缓存，并写入系统共享内存，基于最新的ingress (MTOP API) 执行7层路由转发。如果校验失败，表明更新的资源对象全局不一致，系统存在脏数据，Tengine-Ingress不再更新本地缓存和共享内存，仍旧使用存量的ingress (MTOP API) 配置执行路由转发，保证运行态应用流量的可靠性。

表10. 全局一致性ingress注解

<table><colgroup><col width="90"> <col width="245"> <col width="139"> <col width="95"> <col width="321"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>注解名称</p></td><td rowspan="1" colspan="1"><p>值类型</p></td><td rowspan="1" colspan="1"><p>默认值</p></td><td rowspan="1" colspan="1"><p>说明</p></td></tr><tr><td rowspan="1" colspan="2"><p>nginx.ingress.kubernetes.io/version</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>""</p></td><td rowspan="1" colspan="1"><p>MTOP API版本号</p></td></tr></tbody></table>

除此之外，当K8s的API服务器和etcd不可用时，Tengine-Ingress将无法正常通过API服务器的接口获取到ingress (MTOP API) 资源的更新配置，在API服务器或etcd异常误删除等特殊场景下，ASI系统会错误地触发ingress (MTOP API) 资源对象删除事件，如果被动消费删除事件清空MTOP API配置，将会导致手淘移动终端流量跌零。基于分布式环境下ingress (MTOP API) 全局一致性方案，Tengine-Ingress在全局MD5值无法正常匹配或匹配失败的情况下，都将默认系统数据不再信任可靠，Tengine-Ingress进入自保护状态，不再更新本地缓存，仍旧使用缓存中存量的ingress (MTOP API) 配置，对外提供永不停机的移动终端接入服务。

表11. MD5计算公式

<table><colgroup><col width="364"> <col width="140"> <col width="79"> <col width="95"> <col width="105"> <col width="58"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>MD5计算公式</p></td><td rowspan="1" colspan="5"><p>说明</p></td></tr><tr><td rowspan="1" colspan="1"><p>md5.Sum("MTOP API配置ID1","MTOP API配置ID2",...)</p></td><td rowspan="1" colspan="5"><ul><li>MTOP API配置ID的值格式：name-version<ul><li>name是MTOP API资源对象的名称；</li><li>version是上述MTOP API版本号注解的值；</li><li>API配置ID的分隔符是'-';</li></ul></li><li>MTOP API配置ID之间的分隔符是','；</li><li>MTOP API配置ID按照字符串顺序排序。</li></ul></td></tr></tbody></table>

## 6\. 应用实践

Tengine-Ingress作为统一接入应用AServer-Ingress的技术底座，事实已成为集团ingress网关第一入口，兜底集团经济体所有流量。Tengine-Ingress不仅面向移动终端，第三方小程序，服务器，浏览器，IoT设备等多种终端，同时还可用于边缘节点，海外加速等不同的应用场景。除此之外，通过Tengine-Ingress基础镜像赋能AIDC，菜鸟，高德和企业智能，新增20+独立7层网关集群，Tengine-Ingress独立自建集群也得到了大范围应用。

应用AServer-Ingress已全场景覆盖移动终端的线上，预发和日常的互联网和办公网所有应用场景，对外提供集团淘系电商mtop集群，集团淘系电商mtop预发集群和集团淘系电商mtop日常集群，已接入线上17w+，预发22w+和日常13w+的ingress (MTOP API) 配置，导购和交易已全面接入ingress，目前应用AServer-Ingress日常已承载约60万QPS的无线导购和交易流量，未来将接管手淘移动终端上的所有流量。

![](f918af7d-52a7-4d9e-94b7-af60dd454ed7.png)

图8. RT性能对比数据

Tengine-Ingress支持数十万级别API路由配置的无损动态生效以及TLS证书的无损动态加载和续期，RT与成功率与Tengine持平。以无线交易MTOP域名trade-acs.m.taobao.com为例，双十一大促阶段Tengine-Ingress与Tengine的请求平均响应时间 (RT) 均为104ms。

表12. 双11大促1峰和2峰数据

<table><colgroup><col width="96"> <col width="132"> <col width="138"> <col width="138"> <col width="158"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>单元/机房</p></td><td rowspan="1" colspan="1"><p>单机QPS</p></td><td rowspan="1" colspan="1"><p>HTTP/3 QPS</p></td><td rowspan="1" colspan="1"><p>HTTP/3 连接数</p></td><td rowspan="1" colspan="1"><p>加载MTOP API数量</p></td></tr><tr><td rowspan="1" colspan="1"><p>unsh/EA119</p></td><td rowspan="1" colspan="1"><p>3.3k</p></td><td rowspan="1" colspan="1"><p>2.3k</p></td><td rowspan="1" colspan="1"><p>8.2k</p></td><td rowspan="1" colspan="1"><p>175k</p></td></tr><tr><td rowspan="1" colspan="1"><p>unsh/EA119</p></td><td rowspan="1" colspan="1"><p>3k</p></td><td rowspan="1" colspan="1"><p>1.9k</p></td><td rowspan="1" colspan="1"><p>7.0k</p></td><td rowspan="1" colspan="1"><p>175k</p></td></tr></tbody></table>

![](5ec8b7cc-477a-4f95-b7b9-7cb9c214022d.png)

图9. 内存消耗对比数据

针对手淘无线移动终端，由于Tengine实际运行时会加载大量的MTOP API的静态配置信息，32个worker进程需要各自申请一份内存，整个进程树就会占用较多的内存；而Tengine-Ingress使用动态配置，所有32个worker进程共享一份MTOP API配置信息，内存使用大幅下降，内存占用由40%下降至32%。双十一大促阶段，以南通unsh单元EA119机房为例，运行时加载175k的MTOP API配置，单机QPS 3.3k，其中HTTP/3协议QPS 2.3k，HTTP/3连接数8.2k，Tengine-Ingress内存消耗29.76G，Tengine内存消耗40.48G，Tengine-Ingress单机节省内存约11G。

## 7\. 标准演进

Ingress API定义了K8s集群向外部提供访问集群内部服务的HTTP(S)七层负载均衡，TLS卸载和路由转发的标准 (K8s v1.19 GA/2021-10-28)。Ingress标准通过注解 (annotations) 和CRD来扩展七层负载均衡，TLS卸载和路由转发相关的配置信息。兼容ingress标准的网关有Nginx-Ingress, Tengine-Ingress，GKE Gateway, Azure Application Gateway, AWS ALB Ingress, Ambassador, Istio Ingress, HAProxy Ingress, Kong Ingress, Traefik, Gloo等。各个厂家的网关都在ingress API标准规范的基础上通过增加注解和CRD的方式扩展其自身的功能和特性，这不仅导致了ingress标准的碎片化，也增加了应用服务在不同网关之间配置迁移和复用的复杂性。

由SIG-NETWORK社区主导的开源项目gateway-api (v1alpha1/2020-11-19)，为解决ingress标准的碎片化问题，在ingress基础上通过面向角色，可表达，可扩展，可移植的方式定义各种服务网络资源，提供面向4层~7层所有网络协议的标准定义。Tengine-Ingress正向通用API网关方向持续演进和发展，已实现gateway-api规范v1版本，并在日常环境完成POC。Tengine-Ingress将通过集团实际应用和落地，补充完善gateway-api标准规范，提升阿里巴巴技术影响力，目前已向SIG Network提交gateway-api相关3篇草案。

表13. Gateway API路由类型

<table><colgroup><col width="90"> <col width="52"> <col width="97"> <col width="116"> <col width="156"> <col width="228"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>路由类型</p></td><td rowspan="1" colspan="1"><p>OSI层</p></td><td rowspan="1" colspan="1"><p>路由标识符</p></td><td rowspan="1" colspan="1"><p>TLS</p></td><td rowspan="1" colspan="1"><p>用途</p></td></tr><tr><td rowspan="1" colspan="2"><p>HTTPRoute</p></td><td rowspan="1" colspan="1"><p>7层</p></td><td rowspan="1" colspan="1"><p>HTTP协议内容</p></td><td rowspan="1" colspan="1"><p>TLS卸载</p></td><td rowspan="1" colspan="1"><p>HTTP和HTTPS路由</p></td></tr><tr><td rowspan="1" colspan="2"><p>TLSRoute</p></td><td rowspan="1" colspan="1"><p>4层~7层</p></td><td rowspan="1" colspan="1"><p>SNI或TLS属性</p></td><td rowspan="1" colspan="1"><p>TLS透传或TLS卸载</p></td><td rowspan="1" colspan="1"><p>基于TLS协议的路由</p></td></tr><tr><td rowspan="1" colspan="2"><p>TCPRoute</p></td><td rowspan="1" colspan="1"><p>4层</p></td><td rowspan="1" colspan="1"><p>目的端口号</p></td><td rowspan="1" colspan="1"><p>TLS透传或TLS卸载</p></td><td rowspan="1" colspan="1"><p>TCP路由</p></td></tr><tr><td rowspan="1" colspan="2"><p>UDPRoute</p></td><td rowspan="1" colspan="1"><p>4层</p></td><td rowspan="1" colspan="1"><p>目的端口号</p></td><td rowspan="1" colspan="1"><p>不涉及</p></td><td rowspan="1" colspan="1"><p>UDP路由</p></td></tr><tr><td rowspan="1" colspan="2"><p>GRPCRoute</p></td><td rowspan="1" colspan="1"><p>7层</p></td><td rowspan="1" colspan="1"><p>gRPC协议内容</p></td><td rowspan="1" colspan="1"><p>TLS卸载</p></td><td rowspan="1" colspan="1"><p>gRPC over HTTP/2和HTTP/2明文</p></td></tr></tbody></table>

## 8\. 展望

Tengine-Ingress在不断完善增强ingress标准能力和产品化的基础上，将新增对Kubernetes Gateway API规范的支持，并参与社区标准建设，Tengine-Ingress将向通用API网关方向持续演进和发展，在7层HTTP应用流量入口网关的基础上，逐步支持4/7层TLS，TCP和UDP多协议路由能力，适配不同终端和不同应用，打造全场景通用网关，持续保持业界领先地位。

中
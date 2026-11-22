---
title: "Tengine-Ingress 高性能高可用的云原生网关"
source: "https://ata.atatech.org/articles/11000253416?spm=ata.23639746.0.0.7da6625chNzdfX"
author:
  - "[[李亮(海苍)]]"
published:
created: 2026-10-09
description:
tags:
  - "clippings"
---
2022 手淘终端体验平台年终技术盘点，更多技术沉淀请点击： [https://www.atatech.org/specials/1647](https://www.atatech.org/specials/1647)

作者：(大淘宝) 海苍，光锥，天敬，慧甫，(CTO) 少东，贾岛

## 引言

统一接入作为集团7层应用流量入口网关，主要由应用 [AServer](https://psp.alibaba-inc.com/cmdb/appInfo.htm?spm=a1zek.8768574.0.0.6c204e4diF5jxA&app=aserver) 和 [Wagbridge](https://psp.alibaba-inc.com/cmdb/appInfo.htm?spm=a1zek.8768574.0.0.69897ec40dFLGY&app=wagbridge) 构成，技术底座 [Tengine](https://tengine.taobao.org/) 作为高性能的HTTP和反向代理web服务器，日常承载约1500万QPS的HTTP(S)流量，双11大促峰值流量更是高达3000万QPS，全年保持零事故，对外提供永不停机的HTTP(S)接入服务。

虽然 [Tengine](https://tengine.taobao.org/) 以高性能和高可用著称，但统一接入的一些限制却一直为人诟病，最典型的就是应用域名新增和更新生效时间慢；新增证书和加签域名生效时间慢；新增域名如何选择接入层的集群和流量入口；统一接入不支持TLS 1.3；用户侧HTTP(S)流量可配置性和可观测性能力弱；HTTP(S)路由能力弱；不支持应用分域名灰度变更等。与此同时，作为应用 [AServer](https://psp.alibaba-inc.com/cmdb/appInfo.htm?spm=a1zek.8768574.0.0.6c204e4diF5jxA&app=aserver) 和 [Wagbridge](https://psp.alibaba-inc.com/cmdb/appInfo.htm?spm=a1zek.8768574.0.0.69897ec40dFLGY&app=wagbridge) 的职责团队，TLS卸载服务扩展性弱，成本负担高；集团泛证书域名混用； [环境平台](http://env.alibaba-inc.com/) 灰度应用和资源受限；接入层集群变更范围影响过大等问题也一直困扰着我们。

随着云原生 [ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) 入口网关规范的事实标准化以及集团ASI的大范围落地，统一接入新应用 [AServer-Ingress](https://psp.alibaba-inc.com/cmdb/appInfo.htm?spm=a1zek.8768574.0.0.69897ec40dFLGY&app=aserver-ingress) 基于云原生 [ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) 标准实现了统一接入层的架构升级，其技术底座Tengine-Ingress在深度优化 [kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx) 基础上融合 [Tengine-proxy](https://tengine.taobao.org/) ，不断提升自身性能和可用性，彻底根除了上述痛点和问题，并将反哺 [Tengine开源社区](https://github.com/alibaba/tengine) ，持续保持 [Tengine](https://tengine.taobao.org/) 业界领先地位。

## 术语

- AServer-Ingress: 基于K8s云原生 [ingress标准](https://kubernetes.io/docs/concepts/services-networking/ingress/) ，实现阿里统一接入层架构升级的新应用，为集团淘宝，天猫，高德，阿里妈妈，国际化，菜鸟，UC，钉钉，考拉等BU提供稳定的7层应用流量入口网关。
- Tengine-Ingress：应用AServer-Ingress的技术底座，在深度优化 [kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx) 基础上融合 [Tengine-proxy](https://tengine.taobao.org/) 。
- K8s: Kubernetes简称为K8s，K8s是用于自动部署、扩展和管理容器化应用程序的分布式系统。
- ASI：AlibabaCloud Serverless Infrastructure的简称，面向云原生应用的统一基础设施，提供全托管和半托管K8s集群运维服务。
- ingress: K8s集群向外部提供访问集群内部服务的HTTP(S)七层负载均衡，TLS卸载和路由转发的系统原生资源。
- annotations: 注解，ingress通过注解 (annotations) 来扩展七层负载均衡，TLS卸载和路由转发相关的配置信息。
- etcd: 用于存储K8s集群中配置数据的一种持久性，轻量型，分布式的键-值数据存储组件。
- API server: API服务器是K8s集群的一个关键组件，通过K8s API和JSON over HTTP提供K8s的内部和外部接口。API服务器处理和验证REST请求并更新API对象在etcd中的状态，从而允许客户端在工作节点之间配置工作负载和容器。
- CRD: CustomResourceDefinition的简称，用于定义API服务器上可公开访问的用户自定义资源。
- MD5: Message-Digest Algorithm的简称，一种被广泛使用的密码杂凑函数，可以产生出一个128位元 (16个字节) 的散列值，用于确保信息传输完整一致。

## 架构

应用AServer-Ingress作为7层应用流量入口网关，公网/办公网/内网HTTPS请求首先路由到4层负载均衡SLB，SLB在4层将HTTPS报文转发到7层网关AServer-Ingress，AServer-Ingress基于动态ingress域名和secret证书配置本地卸载TLS，基于单元化和路由策略向后端应用转发HTTP请求。

![](c66bc59f-9ccd-49ba-9acb-3fdf1ab4e53d.jpg)

图1. AServer-Ingress流量链路

应用AServer-Ingress部署运行在ASI core集群，ingress域名和secret证书配置存储在ASI ingress存储集群。用户通过 [FreeStream](https://fs.alibaba-inc.com/) 申请应用域名和证书的新增和变更操作，基于应用域名的运行环境和网络类型自动匹配对应的接入层集群，全覆盖集团日常，预发和线上的互联网，互联网(阿里郎鉴权)，办公网和内网所有应用场景。应用AServer-Ingress的集群运维在 [KubeNest](https://kubenest.aliyun-inc.com/) 管控系统。AServer-Ingress通过prometheus格式的统计数据向用户侧提供分域名的HTTP(S)监控，基于Kmonitor和Sunfire两套监控体系，增强统一接入层的告警覆盖面和可靠性。VIPServer继续作为后端upstream基础路由，在新增域名时会自动在VIPServer对应的环境执行多注册，用户无需关心接入层集群的机房部署和流量入口，保证应用域名一键接入，全球可用。

![](7e260c35-af23-4ce2-a2ca-357717598de2.png)

图2. 应用AServer-Ingress系统架构图

应用AServer-Ingress的技术底座Tengine-Ingress由两部分组成，Tengine-Ingress控制器和Tengine-proxy。Tengine-Ingress控制器是一个基于Tengine-proxy的ingress控制器，在兼容云原生 [ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) 标准规范的基础上扩展了Server，Backend，VIPServer，TLS和Location。应用AServer-Ingress Pod由staragent运维容器，xagent安全容器，main主容器组成，其中主容器包含Tengine-Ingress控制器和Tengine-proxy。Tengine-Ingress控制器通过订阅和处理ingress域名资源和secret证书资源，基于tengine ingress模板转换为动态配置写入共享内存。Tengine-proxy订阅共享内存变化写入内部运行时共享内存，将终端用户的外部流量路由到K8s集群中的应用服务。

![](ff96caa3-50c1-4642-9db1-102ae37281cc.png)

图3. Tengine-Ingress网关架构图

Tengine-Ingress在Tengine基础上新增很多新特性和功能，最显著的变化是配置动态无损生效，无论是应用域名新增和路由变更，还是证书新增和加签域名，都无需tengine reload，配置无损实时生效，长连接保持不变，成功率不受影响，应用变更效率提升翻倍，集群稳定性进一步得到增强。支持分域名和单证书独立分批次逐级生效，用户可按需中断和继续变更，应用侧风险可控，变更影响面小。TLS加解密全面支持TLSv1，TLSv1.1，TLSv1.2和TLSv1.3，允许同时加载ECC，RSA和国密多证书。在应用域名灰度方面，支持基于request header，header值，header值正则匹配，cookie和权重的流量切分，满足应用在灰度发布，蓝绿部署和A/B测试不同场景的需求。在可观测性方面，支持应用分域名独立监控，用户可实时查看单域名QPS，成功率，RT和报文大小相关的监控信息。Tengine-Ingress复用k8s ingress注解（高级配置）规范，基于内部运行时共享内存，通过tengine ingress模板构造HTTP(S)高级功能，支持动态无损实时生效，满足用户基于不同应用场景下的HTTP(S)高级配置需求，例如用户可配置应用域名是否允许网络爬虫和应用域名CORS (跨域资源共享)。综上所述，Tengine-Ingress在应用配置更新模型，系统稳定性，TLS加解密，灰度路由，可观测，HTTP(S)高级配置等多方面得到了显著提升。

表1. Tengine-Ingress和Tengine技术栈对比

<table><colgroup><col width="38"> <col width="134"> <col width="344"> <col width="348"></colgroup><tbody><tr><td rowspan="1" colspan="2"><p>功能特性</p></td><td rowspan="1" colspan="1"><p>Tengine-Ingress</p></td><td rowspan="1" colspan="1"><p>Tengine</p></td></tr><tr><td rowspan="1" colspan="2"><p>域名动态生效</p></td><td rowspan="1" colspan="1"><p>支持域名无损动态生效，新增和更新域名及其配置即时生效，域名生效时间从平均3小时缩短为15分钟，效率提升1200%。</p></td><td rowspan="1" colspan="1"><p>不支持域名动态生效，需要tengine reload，长连接会被断开，且对成功率有影响。</p></td></tr><tr><td rowspan="1" colspan="2"><p>证书动态生效</p></td><td rowspan="1" colspan="1"><p>支持证书无损动态生效，新增和更新证书即时生效，证书生效时间从平均4小时缩短为15分钟，效率提升1600%</p></td><td rowspan="1" colspan="1"><p>不支持证书动态生效，需要keyless定时更新TLS Key，且需要tengine reload，长连接会被断开，且对成功率有影响。</p></td></tr><tr><td rowspan="1" colspan="2"><p>TLS协议</p></td><td rowspan="1" colspan="1"><p>TLSv1, TLSv1.1, TLSv1.2, TLSv1.3</p></td><td rowspan="1" colspan="1"><p>TLSv1, TLSv1.1, TLSv1.2</p></td></tr><tr><td rowspan="1" colspan="2"><p>证书</p></td><td rowspan="1" colspan="1"><p>ECC, RSA, 国密</p></td><td rowspan="1" colspan="1"><p>ECC, RSA, 国密</p></td></tr><tr><td rowspan="1" colspan="2"><p>协议支持</p></td><td rowspan="1" colspan="1"><p>http/https, http2, websocket, grpc, tcp/udp</p></td><td rowspan="1" colspan="1"><p>http/https, http2, websocket, grpc, tcp/udp</p></td></tr><tr><td rowspan="1" colspan="2"><p>基础路由</p></td><td rowspan="1" colspan="1"><p>vipserver</p></td><td rowspan="1" colspan="1"><p>vipserver</p></td></tr><tr><td rowspan="1" colspan="2"><p>灰度路由</p></td><td rowspan="1" colspan="1"><p>header, header value, header值的正则匹配, cookie, 权重</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/0caef328-a2dc-4b28-8f17-2dc34192ec42?#%20%E3%80%8ATengine%20UFE%20%E7%81%B0%E5%BA%A6%E6%A8%A1%E5%9D%97%E3%80%8B">UFE (基于header, cookie)</a> ，且 <a href="http://env.alibaba-inc.com/">环境平台</a> 已不再支持ufe灰度的新应用和新规则的对外接入。</p></td></tr><tr><td rowspan="1" colspan="2"><p>单元化</p></td><td rowspan="1" colspan="1"><p>支持</p></td><td rowspan="1" colspan="1"><p>支持</p></td></tr><tr><td rowspan="1" colspan="2"><p>应用域名灰度生效</p></td><td rowspan="1" colspan="1"><p>支持分域名及其配置独立分批次逐级生效，用户可按需中断和继续变更。</p></td><td rowspan="1" colspan="1"><p>不支持分域名独立生效，所有应用域名打包整体变更，用户不可中断变更，业务侧风险不可控，变更影响面大。</p></td></tr><tr><td rowspan="1" colspan="2"><p>证书灰度生效</p></td><td rowspan="1" colspan="1"><p>支持单张证书分批次逐级生效，用户可按需中断和继续变更。</p></td><td rowspan="1" colspan="1"><p>不支持单张证书独立生效，所有证书打包整体变更，用户不可中断变更，业务侧风险不可控，变更影响面大。</p></td></tr><tr><td rowspan="1" colspan="2"><p>WAF</p></td><td rowspan="1" colspan="1"><p>xmodule + xagent + 霸下</p></td><td rowspan="1" colspan="1"><p>xmodule + xagent + 霸下</p></td></tr><tr><td rowspan="1" colspan="2"><p>DDoS</p></td><td rowspan="1" colspan="1"><p>支持DDoS逃逸逻辑</p></td><td rowspan="1" colspan="1"><p>支持DDoS逃逸逻辑</p></td></tr><tr><td rowspan="1" colspan="2"><p>基础监控</p></td><td rowspan="1" colspan="1"><p>Kmonitor (Prometheus格式), Sunfire</p></td><td rowspan="1" colspan="1"><p>Sunfire</p></td></tr><tr><td rowspan="1" colspan="2"><p>应用分域名监控</p></td><td rowspan="1" colspan="1"><p>Kmonitor (Prometheus格式)，应用域名负责人可通过AServer-Ingress的管控系统freestream实时查看域名QPS，成功率，RT和报文大小相关的监控信息。</p></td><td rowspan="1" colspan="1"><p>不支持应用分域名独立监控，应用域名负责人需要申请接入层Sunfire独立租户权限，新增监控配置后才能查看应用域名统计信息。</p></td></tr><tr><td rowspan="3" colspan="1"><p>高</p><p>级</p><p>配</p><p>置</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/2a1345d2-a2f4-477c-912d-bea64b9efc0a?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E5%B1%82AServer-ingress%E9%AB%98%E7%BA%A7%E6%B3%A8%E8%A7%A3%E3%80%8B">搜索引擎收录</a></p><p><a href="https://yuque.alibaba-inc.com/docs/share/2a1345d2-a2f4-477c-912d-bea64b9efc0a?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E5%B1%82AServer-ingress%E9%AB%98%E7%BA%A7%E6%B3%A8%E8%A7%A3%E3%80%8B">(网络爬虫)</a></p></td><td rowspan="1" colspan="1"><p>用户可配置应用域名是否允许网络爬虫，分批次逐级实时动态无损生效。</p></td><td rowspan="1" colspan="1"><p>不支持用户自主配置应用域名的网络爬虫，需要静态配置修改，通过tengine reload生效。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/2a1345d2-a2f4-477c-912d-bea64b9efc0a?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E5%B1%82AServer-ingress%E9%AB%98%E7%BA%A7%E6%B3%A8%E8%A7%A3%E3%80%8B">CORS</a></p><p><a href="https://yuque.alibaba-inc.com/docs/share/2a1345d2-a2f4-477c-912d-bea64b9efc0a?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E5%B1%82AServer-ingress%E9%AB%98%E7%BA%A7%E6%B3%A8%E8%A7%A3%E3%80%8B">(跨域资源共享)</a></p></td><td rowspan="1" colspan="1"><p>用户可配置应用域名CORS (跨域资源共享)，分批次逐级实时动态无损生效。</p></td><td rowspan="1" colspan="1"><p>不支持用户自主配置应用域名的CORS (跨域资源共享)。</p></td></tr><tr><td rowspan="1" colspan="1"><p>更多功能</p></td><td rowspan="1" colspan="1"><p>Tengine-Ingress复用k8s ingress注解（高级配置）规范，基于内部运行时共享内存，通过tengine ingress模板构造HTTP(S)高级功能，支持ingress注解动态无损实时生效，满足用户基于不同应用场景下的HTTP(S)高级配置需求。</p></td><td rowspan="1" colspan="1"><p>可扩展性弱，且需要静态配置修改，通过tengine reload生效。</p></td></tr></tbody></table>

## 云原生

Tengine-Ingress全面兼容K8s [ingress标准](https://kubernetes.io/docs/concepts/services-networking/ingress/) ，在此基础上不断扩展和完善，相对于原生Kubernetes Ingress和NGINX Ingress，主要有以下优点和增强：

1. 支持域名和证书接入的无损动态实时生效， Tengine-Ingress控制器实时监听ASI ingress存储集群中的ingress域名和secret证书资源对象，在ingress域名和secret证书配置发生变化时，校验域名和证书配置的合法性和全局一致性，符合 [ingress标准](https://kubernetes.io/docs/concepts/services-networking/ingress/) 和 [X509证书规范](https://datatracker.ietf.org/doc/html/rfc5280) 的配置信息将全量写入系统共享内存。Tengine-proxy感知系统共享内存变更，strategy进程刷新运行时共享内存，双缓存切换，worker进程运行时读取配置动态生效。
![](f4b340f5-9608-4949-af81-deb4bdb672a1.png)

图4. 配置动态生效模型

1. Tengine-Ingress支持域名同时使用ECC和RSA双证书，默认原生系统只能使用单张证书，Tengine-Ingress扩展标准ingress规范，在兼容单证书的场景下，满足ECC和RSA双证书同时动态生效的应用场景，且可以继续扩展为ECC，RSA和国密的三证书复杂场景。

9

1

2

3

4

5

6

7

▶

tls:

\- hosts:

\- {host1}

secretName: {secret name1}

\- hosts:

\- {host1}

secretName: {secret name2}

1. Tengine-Ingress在基于云原生ASI的基础上，利用标准化的k8s资源ingress和secret分别存储域名路由配置和TLS证书秘钥信息，在此基础上提出单个ingress域名和单张secret证书分批次逐级生效机制，这不仅满足了用户侧新增和修改应用域名和证书的灰度需求，同时保障接入层集群整体运行的稳定性和可靠性。新增下述ingress和secret注解，用于标识域名和证书逐级分批次灰度范围。

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

▶

1\. ingress灰度开关

● annotation: nginx.ingress.kubernetes.io/ingress-rollout

注释：是否灰度ingress

值类型：bool

默认值：false

2\. ingress当前版本

● annotation: nginx.ingress.kubernetes.io/ingress-rollout-current-revision

注释：ingress当前运行版本号

值类型：string

默认值：""

3\. ingress升级版本

● annotation: nginx.ingress.kubernetes.io/ingress-rollout-update-revision

注释：ingress升级版本号

值类型：string

默认值：""

4\. ingress灰度范围

● annotation: nginx.ingress.kubernetes.io/ingress-rollout-index-id

注释：只有Pod序号小于ingress-rollout-index-id的Pod才会更新ingress。

○ 0..N-1为Pod所在的序号，从0开始到N-1。

○ For a StatefulSet with N replicas, each Pod in the StatefulSet will be assigned an integer ordinal, from 0 up through N-1, that is unique over the Set.

值类型：number

默认值：-1

1. Tengine-Ingress通过全局一致性校验机制保障内存中运行态持有的用户侧ingress域名和secret证书的有效性和正确性，秒级校验集团10w+域名和1000+集团泛证书，在域名配置和证书信息不符合标准化k8s资源ingress和secret规范及其相关RFC标准时，将不再更新本地缓存，并实时告警通知，保障运行态永远可正常向外提供7层转发服务。新增CRD IngressCheckSum和SecretCheckSum，用于定义全局一致性校验信息。

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

▶

type IngressCheckSum struct {

metav1.ObjectMeta

Spec IngressCheckSumSpec

}

type IngressCheckSumList struct {

metav1.TypeMeta

metav1.ListMeta

Items \[\]IngressCheckSum

}

type IngressCheckSumSpec struct {

// \`Timestamp\` is the time when the md5 of all the ingress was calculated.

Timestamp metav1.Time

// \`Checksum\` is the md5 of all the ingress.

Checksum string

// \`ids\` describes which id will match this ingress.

Ids \[\]string

}

1. Tengine-Ingress复用k8s ingress注解（高级配置）规范，基于内部运行时共享内存，通过tengine ingress模板构造HTTP(S)高级功能，支持ingress注解动态实时生效，满足用户基于不同应用场景下的HTTP(S)高级配置需求。

表2. AServer-Ingress高级注解 (配置)

<table><colgroup><col width="363"> <col width="72"> <col width="89"> <col width="340"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>注解名称</p></td><td rowspan="1" colspan="1"><p>值类型</p></td><td rowspan="1" colspan="1"><p>默认值</p></td><td rowspan="1" colspan="1"><p>备注</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/disable-robots</p></td><td rowspan="1" colspan="1"><p>bool</p></td><td rowspan="1" colspan="1"><p>false</p></td><td rowspan="1" colspan="1"><p>禁止搜索引擎收录</p><p>默认允许爬虫；</p><p>值为true时，应用域名禁止网络爬虫。</p></td></tr><tr><td rowspan="1" colspan="4"><p>CORS (跨域资源共享)</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/enable-cors</p></td><td rowspan="1" colspan="1"><p>bool</p></td><td rowspan="1" colspan="1"><p>false</p></td><td rowspan="1" colspan="1"><p>开启跨域资源共享</p><p>默认禁止跨域资源共享；</p><p>值为true时，应用域名开启跨域资源共享。</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/cors-allow-origin</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>*</p></td><td rowspan="1" colspan="1"><p>服务端允许跨域请求的源列表</p><p>默认允许所有源都可以跨域资源请求</p><p>值格式：&lt;origin&gt;[, &lt;origin&gt;] | *</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/cors-max-age</p></td><td rowspan="1" colspan="1"><p>number</p></td><td rowspan="1" colspan="1"><p>1728000</p></td><td rowspan="1" colspan="1"><p>预检请求的响应内容可缓存的最大时间</p><p>有效期内客户端跨域资源请求都不再需要预检请求</p><p>单位：秒</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/cors-allow-credentials</p></td><td rowspan="1" colspan="1"><p>bool</p></td><td rowspan="1" colspan="1"><p>true</p></td><td rowspan="1" colspan="1"><p>用于控制是否允许在跨域请求中携带认证信息</p><p>认证信息：cookies/header Authorization/客户端证书</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/cors-allow-methods</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>表4</p></td><td rowspan="1" colspan="1"><p>服务端允许跨域资源请求的HTTP Method列表</p><p>值格式：&lt;method&gt;[, &lt;method&gt;]*</p><p>值校验：以','分割，只允许字母</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/cors-allow-headers</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>表4</p></td><td rowspan="1" colspan="1"><p>服务端允许跨域资源请求的HTTP Header列表</p><p>值格式：&lt;header-name&gt;[, &lt;header-name&gt;]*</p><p>值校验：以','分割，只允许字母，数字，_ 和 -</p></td></tr></tbody></table>

表3. AServer-Ingress高级注解 (配置) 默认值列表

<table><colgroup><col width="343"> <col width="92"> <col width="89"> <col width="340"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>注解名称</p></td><td rowspan="1" colspan="3"><p>默认值</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/cors-allow-methods</p></td><td rowspan="1" colspan="3"><p>"GET, PUT, POST, DELETE, PATCH, OPTIONS"</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/cors-allow-headers</p></td><td rowspan="1" colspan="3"><p>"DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization"</p></td></tr></tbody></table>

1. Tengine-Ingress在兼容 [ingress canary注解](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#canary) 的基础上，支持基于request header，header值，header值正则匹配，cookie和权重的流量切分，无需tengine reload，所有应用域名的ingress金丝雀规则实时动态无损生效。目前，已在Aone/Koastline的项目环境隔离中得到应用。

表4. Ingress域名金丝雀灰度注解 (配置)

<table><colgroup><col width="372"> <col width="72"> <col width="68"> <col width="352"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>注解名称</p></td><td rowspan="1" colspan="1"><p>值类型</p></td><td rowspan="1" colspan="1"><p>默认值</p></td><td rowspan="1" colspan="1"><p>备注</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/canary</p></td><td rowspan="1" colspan="1"><p>bool</p></td><td rowspan="1" colspan="1"><p>false</p></td><td rowspan="1" colspan="1"><p>应用域名灰度开关</p><p>默认禁止应用域名灰度；</p><p>值为true时，允许应用域名灰度发布。</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/canary-by-header</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>""</p></td><td rowspan="1" colspan="1"><p>基于HTTP请求header灰度路由请求到不同后端服务</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/canary-by-header-value</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>""</p></td><td rowspan="1" colspan="1"><p>基于HTTP请求header值灰度路由到不同后端服务</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/canary-by-cookie</p></td><td rowspan="1" colspan="1"><p>string</p></td><td rowspan="1" colspan="1"><p>""</p></td><td rowspan="1" colspan="1"><p>基于HTTP请求cookie灰度路由到不同后端服务</p></td></tr><tr><td rowspan="1" colspan="1"><p>nginx.ingress.kubernetes.io/canary-weight</p></td><td rowspan="1" colspan="1"><p>0-100</p></td><td rowspan="1" colspan="1"><p>0</p></td><td rowspan="1" colspan="1"><p>基于后端服务权重灰度路由到不同后端服务</p></td></tr></tbody></table>

![](7ddb6ed0-373c-4bae-a382-7bf508571df3.png)

图5. 应用域名金丝雀灰度路由模型

## 高可用

Tengine-Ingress作为7层流量入口网关应用 [AServer-Ingress](https://psp.alibaba-inc.com/cmdb/appInfo.htm?spm=a1zek.8768574.0.0.69897ec40dFLGY&app=aserver-ingress) 的技术底座，对于高可用有严苛的要求。任何的变更操作都必须可灰度，可监控，可回滚。然而，K8s原生资源对象包括ingress域名，secret证书，configmap配置，service服务等，在被写入etcd后，所有监听控制器默认都会处理资源对象的配置更新，即相同命名空间内的所有Pod会同时加载新的配置对象，如果配置存在错误和脏数据，变更影响将会触发全局风险，导致线上事故。统一接入每天大约存在上百次的应用域名新增，修改和删除的变更操作，每周都存在数十次的证书新增和加签域名的变更操作，接入层任何一次应用域名和证书的配置变更都至关重要。Tengine-Ingress作为云原生网关，必然通过K8s API处理和验证资源对象，这就需要我们扩展支持ingress应用域名和secret证书的灰度能力，保障变更操作的可灰度，可中断和可回滚。

以ingress应用域名变更为例，按照相同命名空间内Tengine-Ingress Pod数量，通过新增的ingress灰度注解确定每批次ingress资源对象动态生效的Pod范围。配置变更Pod范围内的Tengine-Ingress监听到ingress资源对象的更新事件，校验域名配置的合法性和全局一致性，将符合 [ingress标准](https://kubernetes.io/docs/concepts/services-networking/ingress/) 的配置信息全量写入系统共享内存。在ingress域名分批次灰度生效的变更过程中，用户可以基于应用域名成功率等监控指标随时主动终止和回滚本次配置变更，将风险缩小到可控范围内，保障应用域名变更的可灰度，可监控，可回滚。

![](d1b2f4eb-9bfd-4464-adb5-0fea09306cb9.png)

图6. Ingress域名和Secret证书配置分批次逐级生效模型

Tengine-Ingress通过ASI core集群与ASI ingress存储集群相隔离的高可靠性方案，将运行态和存储态相分离，独立ASI ingress集群可以保证自身API服务器和etcd性能稳定，并且在core集群核心组件API服务器和etcd不可用的高危场景下也能正常向外提供7层转发服务。以ASI ingress存储集群标准3实例API服务器 (16C64G, 100G ESSD)和3实例etcd (8C32G, 100G ESSD) 资源规格为条件，2万个ingress域名资源对象 (1KB大小) 作为背景数据，以10 QPS更新ingress资源对象，随着Tengine-Ingress pod个数的增加，监听ingress配置更新的时延也会相应增加，即使是6000个Tengine-Ingress pod的超大规模集群，watch和list时延均在可控范围内。

表5. Ingress存储集群性能基线

<table><colgroup><col width="253"> <col width="220"> <col width="391"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>Tengine-Ingress Pod个数</p></td><td rowspan="1" colspan="1"><p>List p95/p99</p></td><td rowspan="1" colspan="1"><p>Watch p95/p99（update QPS = 10）</p></td></tr><tr><td rowspan="1" colspan="1"><p>100</p></td><td rowspan="1" colspan="1"><p>1.75s/1.75s</p></td><td rowspan="1" colspan="1"><p>9ms/10.5ms</p></td></tr><tr><td rowspan="1" colspan="1"><p>500</p></td><td rowspan="1" colspan="1"><p>3.8s/3.9s</p></td><td rowspan="1" colspan="1"><p>12ms/13ms</p></td></tr><tr><td rowspan="1" colspan="1"><p>1000</p></td><td rowspan="1" colspan="1"><p>24.2s/25.1s</p></td><td rowspan="1" colspan="1"><p>16ms/17ms</p></td></tr><tr><td rowspan="1" colspan="1"><p>3000</p></td><td rowspan="1" colspan="1"><p>30.0s/34.1s</p></td><td rowspan="1" colspan="1"><p>30ms/40ms</p></td></tr><tr><td rowspan="1" colspan="1"><p>6000</p></td><td rowspan="1" colspan="1"><p>37.0s/45.0s</p></td><td rowspan="1" colspan="1"><p>38ms/47ms</p></td></tr></tbody></table>

K8s分布式系统本身可以保障单个ingress资源的一致性，但分布式环境是无法保证用户存储在etcd中ingress域名配置的全局正确性和全局完整性，并且在API服务器和etcd不可用的情况下，ingress域名配置的可用性更是无法保障。因此，Tengine-Ingress提出了一种分布式环境下ingress全局一致性方案，在新增和更新域名时，Tengine-Ingress基于ingress全局一致性校验算法计算全局MD5值，与CRD ingresschecksums资源对象中的MD5值相匹配，则表明本次更新的ingress资源对象是全局一致性，即可将ingress资源对象更新到本地缓存，并写入共享内存，开始使用最新的ingress域名配置对外提供HTTP(S)七层负载均衡，TLS卸载和路由转发功能；否则表明更新的ingress资源对象全局不一致，系统存在脏数据，不再更新本地缓存和共享内存，仍旧使用存量的ingress域名配置对外提供HTTP(S)接入服务，保证运行态域名接入和路由服务的正确性和可靠性。

![](918adb39-91c2-41d7-8a6e-0cd38a9bc3f2.png)

图7. Ingress域名配置全局一致性校验模型

分布式系统K8s的核心组件是API服务器和etcd，etcd作为K8s集群中配置数据的存储组件，而API服务器对外提供标准接口处理客户端请求并更新资源对象在etcd中的状态，从而允许客户端在工作节点之间配置各种流量负载和容器。因此，在API服务器和etcd因内部或外部原因导致其不可正常提供服务的情况下，客户端必然会出现各种服务异常。针对ingress资源对象，客户端将无法正常通过API服务器的接口获取ingress的更新配置，并且在API服务器或etcd异常误删除等特殊场景下，系统会错误地触发ingress删除事件，客户端会清空域名配置，这将导致客户端无法再对外提供HTTP(S)接入服务。基于分布式环境下ingress全局一致性方案，Tengine-Ingress在全局MD5值无法正常匹配或匹配失败的情况下，默认系统数据不再信任可靠，Tengine-Ingress进入自保护状态，不再更新本地缓存，仍旧使用缓存中存量的ingress域名配置继续对外提供HTTP(S)接入服务。Secret证书资源对象采用了类似的全局一致性方案。

综上所述，基于分布式环境下ingress和secret全局一致性方案，Tengine-Ingress保证用户存储在etcd中ingress域名和secret证书配置的全局正确性和全局完整性，并且在分布式系统K8s核心组件API服务器或etcd不可用的情况下，仍然可以保障ingress域名和secret证书配置的可用性，对外提供永不停机的HTTPS接入服务。

![](0747d53c-a933-4d68-a783-40afcdd00613.png)

图8. Ingress全局一致性校验流程图

## 高性能

接入层应用 [AServer](https://psp.alibaba-inc.com/cmdb/appInfo.htm?spm=a1zek.8768574.0.0.6c204e4diF5jxA&app=aserver) 和 [Wagbridge](https://psp.alibaba-inc.com/cmdb/appInfo.htm?spm=a1zek.8768574.0.0.69897ec40dFLGY&app=wagbridge) 基于远端Keyless服务获取TLS私钥，新架构 [AServer-Ingress](https://psp.alibaba-inc.com/cmdb/appInfo.htm?spm=a1zek.8768591.0.0.340a71a98aBBEw&app=aserver-ingress) 应用本地TLS加解密，对比新旧架构在HTTPS短链接场景下的性能差异。压测模型使用HTTPS短连接，TLS 1.2协议ECDHE-RSA-AES128-GCM-SHA256算法，后端应用返回22KB响应报文，被压机Pod使用32核96G内存。

表6. 被压环境

<table><colgroup><col width="153"> <col width="132"> <col width="140"> <col width="439"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>被压网关</p></td><td rowspan="1" colspan="1"><p>加载域名数量</p></td><td rowspan="1" colspan="1"><p>被压测Pod</p></td><td rowspan="1" colspan="1"><p>被压测宿主机</p></td></tr><tr><td rowspan="1" colspan="1"><p>Tengine</p></td><td rowspan="1" colspan="1"><p>34251个</p></td><td rowspan="1" colspan="1"><p><a href="https://psp.alibaba-inc.com/cmdb/hostInfo.htm?spm=a1zek.8768591.0.0.52097ec4fSXIOJ&amp;host=wagbridge.033007228116.na620">33.7.228.116</a></p><p>32C96G</p></td><td rowspan="1" colspan="1"><p><a href="https://psp.alibaba-inc.com/cmdb/hostInfo.htm?spm=a1zek.8768591.0.0.1b1c6c7b4i0myW&amp;host=wagbridge033033045188.na620">33.33.45.188</a></p><p>ecs.ebmg6es-inc.26xlarge</p><p>Alibaba Group Enterprise Linux Server 7.2 (Paladin)</p><p>4.9.151-015.ali3000.alios7.x86_64%。</p></td></tr><tr><td rowspan="1" colspan="1"><p>Tengine-Ingress</p></td><td rowspan="1" colspan="1"><p>34443个</p></td><td rowspan="1" colspan="1"><p><a href="https://psp.alibaba-inc.com/cmdb/hostInfo.htm?spm=a1zek.8768591.0.0.52097ec4fSXIOJ&amp;host=33.44.40.176">33.44.40.176</a></p><p>32C96G</p></td><td rowspan="1" colspan="1"><p><a href="https://psp.alibaba-inc.com/cmdb/hostInfo.htm?spm=a1zek.8768591.0.0.2c8e120dzxbB1d&amp;host=wagbridge033033045093.na620">33.33.45.93</a></p><p>ecs.ebmg6es-inc.26xlarge</p><p>Alibaba Group Enterprise Linux Server 7.2 (Paladin)</p><p>4.9.151-015.ali3000.alios7.x86_64</p></td></tr></tbody></table>

表7. 压测模型

<table><colgroup><col width="151"> <col width="122"> <col width="287"> <col width="304"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>HTTP协议</p></td><td rowspan="1" colspan="1"><p>TLS协议</p></td><td rowspan="1" colspan="1"><p>加密套件</p></td><td rowspan="1" colspan="1"><p>响应报文大小</p></td></tr><tr><td rowspan="1" colspan="1"><p>HTTP1.1 短链接</p></td><td rowspan="1" colspan="1"><p>TLS 1.2</p></td><td rowspan="1" colspan="1"><p>ECDHE-RSA-AES128-GCM-SHA256</p></td><td rowspan="1" colspan="1"><p>22KB</p></td></tr></tbody></table>

RT：由于Tengine-Ingress在TLS握手过程中减少了与远端Keyless服务的交互过程，HTTPS 1.1短链接场景下Tengine-Ingress相比Tengine，请求平均响应时间 (RT) 可降低约9ms。

![](602f9e85-12d7-4b4b-9998-3d893ca73d80.png)

图9. RT性能对比数据

表8. TLS握手时延细分对比

<table><colgroup><col width="162"> <col width="191"> <col width="79"> <col width="198"> <col width="233"></colgroup><tbody><tr><td rowspan="1" colspan="1"></td><td rowspan="1" colspan="2"><p>Tengine-Ingress</p></td><td rowspan="1" colspan="2"><p>Tengine</p></td></tr><tr><td rowspan="2" colspan="1"><p>TLS握手</p></td><td rowspan="2" colspan="1"><p>客户端与网关交互</p></td><td rowspan="2" colspan="1"><p>5.794ms</p></td><td rowspan="1" colspan="1"><p>客户端与网关交互</p></td><td rowspan="1" colspan="1"><p>5.492ms</p></td></tr><tr><td rowspan="1" colspan="1"><p>网关与Keyless交互</p></td><td rowspan="1" colspan="1"><p>9.365ms</p></td></tr><tr><td rowspan="1" colspan="1"><p>总耗时</p></td><td rowspan="1" colspan="2"><p>5.794ms</p></td><td rowspan="1" colspan="2"><p>14.857ms</p></td></tr></tbody></table>

CPU：Tengine在HTTPS建链过程中消耗的CPU由远端Keyless服务与本端Tengine-proxy两部分组成，而Tengine-Ingress在本端完成所有的TLS加解密。对比每1万QPS所消耗的CPU，换算成CPU消耗比例，Tengine-Ingress每1万QPS消耗67.3% CPU，而Tengine需要消耗81.9% CPU，Tengine-Ingress在HTTPS短链接场景下性能提升约20.7%。

![](70c00630-3afb-4f44-8b36-105fd8690b13.png)

图10. CPU开销对比数据

Mem：由于Tengine实际运行时会加载大量的应用域名和路由的静态配置信息，32个worker进程需要各自申请一份内存，整个进程树就会占用较多的内存；而Tengine-Ingress使用动态配置，所有32个worker进程共享一份应用域名和路由配置信息，内存使用大幅下降，内存占用由20.4%下降至8.8%，单机节省内存11G。

![](9ab67140-b4a4-4064-862e-4d795eedd3fc.png)

图11. 内存消耗对比数据

## 现状

应用AServer-Ingress已全场景覆盖集团日常，预发和线上的互联网，互联网(阿里郎鉴权)，办公网和内网所有应用场景，已向外提供蚂蚁企业智能互联网集群，蚂蚁企业智能办公网集群，集团国际化集群，集团办公网集群，集团内网集群，集团办公网开放集群；蚂蚁企业智能预发集群，集团预发集群和集团日常集群。

应用AServer-Ingress已支撑线上Ingress域名3.7k+，预发Ingress域名3.4w+，日常Ingress域名2.4w+，域名生效时间从平均3小时缩短为15分钟，效率提升1200%；证书生效时间从平均4小时缩短为15分钟，效率提升1600%。在2022年双11和AE黑五期间，应用AServer-Ingress内存消耗下降57%，HTTPS短链接场景下，性能提升约20.7%，请求RT平均下降36%，各项基础指标符合预期，Tengine-Ingress作为高性能高可用的云原生网关得到了初步的考验。

表8. 应用AServer-Ingress集群分布现状

<table><colgroup><col width="178"> <col width="147"> <col width="104"> <col width="435"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>集群</p></td><td rowspan="1" colspan="1"><p>环境</p></td><td rowspan="1" colspan="1"><p>网络</p></td><td rowspan="1" colspan="1"><p>集群说明</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/a0cdbc4a-538b-43df-a868-9535152ab120?#%20%E3%80%8A%E6%8E%A5%E5%85%A5%E5%B1%82AServer-ingress%E5%9B%BD%E9%99%85%E5%8C%96%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">集团国际化集群</a></p><p><a href="https://yuque.alibaba-inc.com/docs/share/a0cdbc4a-538b-43df-a868-9535152ab120?#%20%E3%80%8A%E6%8E%A5%E5%85%A5%E5%B1%82AServer-ingress%E5%9B%BD%E9%99%85%E5%8C%96%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">(alibaba-international)</a></p></td><td rowspan="1" colspan="1"><p>线上</p><p>(含小流量安全生产)</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">互联网</a></p></td><td rowspan="1" colspan="1"><p>线上集群，域名一键接入，全球通用。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/497b558b-b829-4bae-bb7c-cc8db2571c60?#%20%E3%80%8A%E6%8E%A5%E5%85%A5%E5%B1%82AServer-ingress%E5%8A%9E%E5%85%AC%E7%BD%91%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">集团办公网集群</a></p><p><a href="https://yuque.alibaba-inc.com/docs/share/497b558b-b829-4bae-bb7c-cc8db2571c60?#%20%E3%80%8A%E6%8E%A5%E5%85%A5%E5%B1%82AServer-ingress%E5%8A%9E%E5%85%AC%E7%BD%91%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">(alibaba-work)</a></p></td><td rowspan="1" colspan="1"><p>线上</p><p>(含小流量安全生产)</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">办公网</a></p></td><td rowspan="1" colspan="1"><p>线上集群，域名一键接入，在全球各办公网和阿里机房均可正常访问。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/90072c70-0fb8-4a53-8a8b-ad3829079fe9?#%20%E3%80%8A%E6%8E%A5%E5%85%A5%E5%B1%82AServer-ingress%E9%9B%86%E5%9B%A2%E5%8A%9E%E5%85%AC%E7%BD%91%E5%BC%80%E6%94%BE%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">集团办公网开放集群</a></p><p><a href="https://yuque.alibaba-inc.com/docs/share/90072c70-0fb8-4a53-8a8b-ad3829079fe9?#%20%E3%80%8A%E6%8E%A5%E5%85%A5%E5%B1%82AServer-ingress%E9%9B%86%E5%9B%A2%E5%8A%9E%E5%85%AC%E7%BD%91%E5%BC%80%E6%94%BE%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">(alibaba-work-alilang)</a></p></td><td rowspan="1" colspan="1"><p>线上</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">互联网</a></p><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">(阿里郎鉴权)</a></p></td><td rowspan="1" colspan="1"><p>线上集群，应用域名被外部互联网用户访问时会强制跳转阿里郎鉴权，同时在办公网络和阿里各机房也可访问。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/1e3b808c-9dfd-4e76-8cc7-898722ccfcd7?#%20%E3%80%8AIngress%E6%8E%A5%E5%85%A5%E5%B1%82%E9%9B%86%E5%9B%A2%E5%86%85%E7%BD%91%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">集团内网集群</a></p><p><a href="https://yuque.alibaba-inc.com/docs/share/1e3b808c-9dfd-4e76-8cc7-898722ccfcd7?#%20%E3%80%8AIngress%E6%8E%A5%E5%85%A5%E5%B1%82%E9%9B%86%E5%9B%A2%E5%86%85%E7%BD%91%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">(alibaba-inner)</a></p></td><td rowspan="1" colspan="1"><p>线上</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">内网</a></p></td><td rowspan="1" colspan="1"><p>线上集群，域名只允许在阿里网内的各机房间可以访问，在办公网络无法访问。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/8fad3311-0c56-4da2-8947-014d3554966a?#%20%E3%80%8AIngress%E6%8E%A5%E5%85%A5%E5%B1%82%E9%9B%86%E5%9B%A2%E9%A2%84%E5%8F%91%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">集团预发集群</a></p><p><a href="https://yuque.alibaba-inc.com/docs/share/8fad3311-0c56-4da2-8947-014d3554966a?#%20%E3%80%8AIngress%E6%8E%A5%E5%85%A5%E5%B1%82%E9%9B%86%E5%9B%A2%E9%A2%84%E5%8F%91%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">(alibaba-pre)</a></p></td><td rowspan="1" colspan="1"><p>预发</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">办公网</a></p></td><td rowspan="1" colspan="1"><p>预发集群，域名一键接入，在全球各办公网和阿里机房均可正常访问。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/1ceb081a-41f0-44bd-8de6-64457386d35d?#%20%E3%80%8AIngress%E6%8E%A5%E5%85%A5%E5%B1%82%E9%9B%86%E5%9B%A2%E6%97%A5%E5%B8%B8%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">集团日常集群</a></p><p><a href="https://yuque.alibaba-inc.com/docs/share/1ceb081a-41f0-44bd-8de6-64457386d35d?#%20%E3%80%8AIngress%E6%8E%A5%E5%85%A5%E5%B1%82%E9%9B%86%E5%9B%A2%E6%97%A5%E5%B8%B8%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">(daily)</a></p></td><td rowspan="1" colspan="1"><p>日常</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">办公网</a> (默认)</p><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">内网</a></p></td><td rowspan="1" colspan="1"><p>日常集群，域名只允许在办公网和日常机器间访问。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/9ae9b3cc-60f8-4b14-b4d5-2ede288da1a7?#%20%E3%80%8AIngress%E6%8E%A5%E5%85%A5%E5%B1%82%E8%9A%82%E8%9A%81EI%E9%A2%84%E5%8F%91%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">蚂蚁企业智能预发集群(alibaba-ant-ei-pre)</a></p></td><td rowspan="1" colspan="1"><p>预发</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">办公网</a></p></td><td rowspan="1" colspan="1"><p>预发集群，蚂蚁集团企业智能专用。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/cae93ab1-0d71-47e0-848c-63eb97347c42?#%20%E3%80%8AIngress%E6%8E%A5%E5%85%A5%E5%B1%82%E8%9A%82%E8%9A%81EI%E5%85%AC%E7%BD%91%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">蚂蚁企业智能互联网集群(alibaba-ant-ei)</a></p></td><td rowspan="1" colspan="1"><p>线上</p><p>(含小流量安全生产)</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">互联网</a></p></td><td rowspan="1" colspan="1"><p>线上集群，蚂蚁集团企业智能专用。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/4ac6e6d5-796e-4682-a9da-f41baab680b9?#%20%E3%80%8AIngress%E6%8E%A5%E5%85%A5%E5%B1%82%E8%9A%82%E8%9A%81EI%E5%8A%9E%E5%85%AC%E7%BD%91%E9%9B%86%E7%BE%A4%E5%8C%BA%E5%9F%9F%E5%88%86%E5%B8%83%E3%80%8B">蚂蚁企业智能办公网集群(alibaba-ant-ei-work)</a></p></td><td rowspan="1" colspan="1"><p>线上</p><p>(含小流量安全生产)</p></td><td rowspan="1" colspan="1"><p><a href="https://yuque.alibaba-inc.com/docs/share/762a2ddc-1ba8-4df6-8fea-a66451d0e181?#%20%E3%80%8A%E7%BB%9F%E4%B8%80%E6%8E%A5%E5%85%A5%E9%9B%86%E7%BE%A4%E7%BD%91%E7%BB%9C%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E%E3%80%8B">办公网</a></p></td><td rowspan="1" colspan="1"><p>线上集群，蚂蚁集团企业智能专用。</p></td></tr></tbody></table>

## 展望

应用AServer-Ingress将在S2正式上线淘系电商集群，覆盖所有淘宝和天猫域名，ingress规模化100万QPS。TLS证书灰度和证书全局一致性校验功能即将上线发布，应用AServer-Ingress的可靠性将进一步得到增强。对外提供基于Request Header，服务权重和cookie的流量切分，适用于应用域名的灰度发布，蓝绿部署和A/B测试。Tengine-Ingress将复用k8s ingress注解（高级配置）规范，基于内部运行时共享内存，通过tengine ingress模板构造HTTP(S)高级功能，支持更多ingress注解动态实时生效，持续满足用户基于不同应用场景下的HTTP(S)高级配置需求。

确定开源Tengine 3.0功能特性范围：升级nginx core [1.22](http://nginx.org/en/CHANGES-1.22) 稳定版本；基于 [XQUIC](https://github.com/alibaba/xquic) 支持QUIC和HTTP3协议；基于 [k8s ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) 标准规范，支持域名和证书无损动态生效，ingress域名和secret证书配置的灰度分批生效，ingress和secret全局一致性校验，ECC和RSA双证书，分布式环境下动态服务发现，应用域名的灰度发布，蓝绿部署和A/B测试。

展望未来，Tengine将向通用API网关方向持续演进和发展，在HTTP应用流量入口网关的基础上，逐步支持4/7层TLS，TCP，UDP和GRPC多协议路由能力，适配不同终端和不同应用，打造全场景通用网关，持续保持 [Tengine](https://tengine.taobao.org/) 业界领先地位。

致谢：

- Koastline团队@贾岛和@少东，跨团队与CTO线Koastline团队的贾岛和少东共建统一接入ingress云原生架构升级项目，统一接入新的用户侧控制台发布上线： [https://fs.alibaba-inc.com/](https://fs.alibaba-inc.com/) 正式向集团用户提供域名接入服务，全场景覆盖集团日常，预发和线上的互联网，互联网(阿里郎鉴权)，办公网和内网所有应用场景，15分钟域名和证书动态无损生效，实时HTTP(S)流量观察，用户侧HTTP(S)高级配置及其实时动态无损生效。这次合作不仅解决了统一接入的诸多痛点问题，同时为CTO线的Subway管控系统和Normandy统一接入控制台的云原生改造提供了坚实的基础。
- ASI团队@韩堂 @沉醉，@墨封，@意真，@幻云，@柘远和@基成，跨团队与阿里云ASI团队的韩堂紧密配合，ASI首次发布半托管ASI集群，AServer-Ingress通过ASI core集群与ASI ingress存储集群（即半托管ASI集群）相隔离的高可靠性方案，将运行态和存储态相分离，在ASI核心组件API服务器和etcd不可用的高危场景下也能正常向外提供7层转发服务。这是一次双赢的合作，ASI团队在集团通过统一接入云原生新应用AServer-Ingress首次发布和上线半托管ASI集群新产品，为阿里云ASI带来了新的营收和新的市场，通过AServer-Ingress样板间项目，会有更多的业务团队深耕云原生的创新和发展。
- Kubenest团队@承吉，@靖瑜，@尙书，@午巳和@奎若，Kubenest作为AServer-Ingress集群侧管控系统，负责AServer-Ingress发布，灰度，升级，扩缩容，VIP申请，资源配置和配置变更。
- Kmonitor团队@隐元和@泽诚，跨团队与CTO线监控团队的隐元紧密合作，首次在统一接入层使用Kmonitor监控，AServer-Ingress通过prometheus格式的统计数据向用户侧提供分域名的HTTP(S)监控，同时基于Kmonitor监控ingress全局一致性校验和证书共享内存相关的告警，基于Kmonitor和Sunfire两套监控体系，增强统一接入层的告警覆盖面和可靠性。通过这次合作，Kmonitor监控实现了在统一接入的应用，并在集团日常环境发现并更新了多个稳定性问题，大大提升了Kmonitor的可靠性。
- VIPServer团队@正己和@三辰，VIPServer作为AServer-Ingress默认upstream基础路由。

中
---
title: "漫谈 Shadowsocks 代理和 DNS 解析"
source: "https://blog.terrychan.me/2017/thoughts-on-shadowsocks-dns?spm=ata.21736010.0.0.40b77536OQGk5S"
author:
  - "[[Terry Chan]]"
published: 2017-01-17
created: 2026-10-20
description: "没有哪个国家的开发者像我们一样热衷于网络拥塞的解决，数据加密传输，以及各种代理技术的开发。 @openerdns Shadowsocks 分流策略 关于 Shadowsocks 分流策略，主要有 gfwlist 黑名单和中国路由表白名单。 ..."
tags:
  - "clippings"
---
## 知道怎么走最近很重要。

> 没有哪个国家的开发者像我们一样热衷于网络拥塞的解决，数据加密传输，以及各种代理技术的开发。
> 
> @openerdns

## Shadowsocks 分流策略

关于 Shadowsocks 分流策略，主要有 gfwlist 黑名单和中国路由表白名单。

根据 IP 地址分流应该是目前大局域网环境下一个比较好的策略。让国外 IP 通过一条线路优秀的 VPS 代理能很好地提高访问体验。

对于中国路由表的来源，以往很多人推荐从 [APNIC](https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest) 获取，但是这个 IP 表并不是特别准确。第二个是 [IPIP.net](https://github.com/17mon/china_ip_list) 整理的中国 IP 段，两个月更新一次，推荐使用后者。

## 解析的问题

实际上我们访问互联网，几乎都是通过域名去获得对应的 IP 地址的。域名通过 DNS 解析为 IP 地址，计算机再通过这个 IP 访问服务器。由于国内普遍对某些地址存在污染，会解析出错误的 IP 地址，所以即使 Shadowsocks 解决了 IP 封锁问题，也无法正常上网。

![](8423171411_734947.webp)

既然选择了 IP 分流，就要解决 DNS 解析的问题。

到这里，有人要有疑问了，为何以前使用 gfwlist 的时候，不需要考虑这样的问题呢。

其实这里涉及到代理的一些问题，Shadowsocks 本质是一个 SOCKS 代理。对于一个 SOCKS 代理，它能对域名或者 IP 的连接进行代理，当代理服务器发现发起的连接的目标地址是一个域名的时候，它会由代理服务器在服务端进行解析，得到 IP 之后再去连接，这个就是代理的远端解析。因为此时 DNS 解析是在服务端进行的，这样可以避免了 DNS 污染。

其实远端解析是有很多好处的，因为 DNS 还有一个功能是实现负载均衡，通过不同地区不同运营商解析到不同的 CDN，使得在任何地方的客户端都能连接最近的 CDN。举个例子，假若你的 Shadowsocks 是美国的服务器，而你在大陆访问 Google 的时候，Google 被解析到香港的服务器，这样去访问的话，即使你的线路有多优秀，一个 RTT 都接近 400ms，体验是绝对很差的。

这时候有人要拍脑袋说了，这还不简单，走代理的域名就远端解析，不走代理的域名就本地解析，这不就好了吗？但是认真想想，我们是根据 IP 分流的，而在 DNS 解析完成之前，我们并不知道一个域名的 IP 地址，这样仿佛是一个死循环。

这里提供一个的思路，对一个 DNS 请求同时进行本地解析和远端解析，若本地解析获得的是国内 IP，则采用；若不是国内 IP，则采用远端解析的结果。这个思路是基于 GFW 进行 DNS 污染时的一个特点，污染地址都是国外 IP。

## 搭建免维护无污染本地 DNS 的思路

如何搭建无污染而且解析正确的 DNS 是一个有意思的问题，下面提供一个免维护的思路。

假设系统运行了 ss-local，在本地 1080 端口开启了 SOCKS 代理。

DNS Server 我采用的是两款轻量级的开源软件 [dns2socks](http://dns2socks.sourceforge.io/) 和 [overture](https://github.com/holyshawn/overture) 。这里提一下 overture 的作者 holyshawn，我之前也推荐过他的另一款开源软件 ballade。

~~dns2socks 可以将 DNS 查询通过 SOCKS 代理进行，而 overture 可以按照我上面提到的思路进行过滤解析。~~

overture 可以支持通过 SOCKS 代理进行 DNS 查询，请查阅 GitHub 中的文档。

```bash
dns2socks 127.0.0.1:1080 8.8.4.4:53 127.0.0.1:5335
overture -c config.json
```

```json
{
  "BindAddress": ":53",
  "PrimaryDNSAddress": "114.114.115.115:53",
  "PrimaryDNSMethod": "udp",
  "AlternativeDNSAddress": "127.0.0.1:5335",
  "AlternativeDNSMethod": "udp",
  "Timeout": 6,
  "RedirectIPv6Record": true,
  "IPNetworkFilePath": "./china_ip_list.txt",
  "DomainFilePath": "./gfwlist.txt",
  "DomainBase64Decode": true
}
```

Google Public DNS 8.8.4.4 在全球很多地方都有 Anycast，基本可以做到国外域名最佳解释。国内 DNS 使用 114.114.115.115 是照顾到了笔记本用户可能有在电信移动联通环境下频繁切换的可能，这里使用运营商 DNS 是不合适的。

最后可以看看成果，我当前网络是广州电信 + 香港阿里云。

![](8423171387_013924.webp)

www.facebook.com 解析到香港

![](8423171363_734457.webp)

static.32ph.com (UPYUN CDN) 解析到广东惠州

现在我把 Shadowsocks 切换到美国洛杉矶的节点。

![](8423171342_996956.webp)

可以看到 Facebook 的解析自动换到了美国了。

[![Terry Chan](8374779921_487915.jpg)](https://blog.terrychan.me/by/terrychan/)
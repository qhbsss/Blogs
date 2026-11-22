---
title: "wormhole内外网判断原理"
source: "https://ata.atatech.org/articles/11000074103?spm=ata.25287382.0.0.340f7536u3wUYQ"
author:
  - "[[费翔(碎空)]]"
published:
created: 2026-11-08
description:
tags:
  - "clippings"
---
wormhole有一个api可以判断当前访问用户是否是内网用户，这个api在某些时候很有作用，比如内部测试。 wormhole的文档中并没有暴露该API，原因也是使用这个api要慎重，需要明白它的原理。

## 原理

这里来说下内外网判断的原理，其实核心原理就是dns劫持。 比如用户访问pages.tmall.com原本应该解析到CDN上，如图。  
![screenshot.png](30ba1114-83a8-4c06-aa07-237b147fa0d9.avif)

但是在内网下，你发现结果是这样的，只有一条A记录指向140.205.164.9。

![screenshot.png](17923417-afc5-4b3d-92c2-91ff16e47402.avif)

看到这里你大概明白了，内网访问实际上是访问了专门的渲染机器，wormhole会判断如果是指定的机器就是来自内网的用户。

如果你在办公网想测试外网访问的内容，可以设置你的dns为外网的dns，例如 8.8.8.8 114.114.114.114，这时候你看到的就会是外网的内容。

如果你的是mac电脑，这里提供几个快速切换dns的命令绑定，方便你快速的在内外网dns之间切换。

```
alias dnsgoogle="sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4"
alias dnsv2ex="sudo networksetup -setdnsservers Wi-Fi 199.91.73.222 178.79.131.110"
alias dns114="sudo networksetup -setdnsservers Wi-Fi 114.114.114.114 114.114.115.115"
alias dnsali="sudo networksetup -setdnsservers Wi-Fi 10.65.1.1 10.20.0.4 10.65.1.3 10.20.0.97 "
```

如果你自己的系统也想做这样的功能，可以到 [http://beta.alibaba-inc.com/](http://beta.alibaba-inc.com/) 去申请。

## 注意事项

1. 可以看到原理是dns劫持，如果你使用的域名并没有加入dns劫持的话，内外网判断的功能是没有用的。
2. 同上，因为原理是dns劫持，所以只能在客户端访问的请求中判断，服务端请求是无法判断成功的。
3. 手淘和手猫客户端因为用了httpdns，没有走localdns，所以劫持也会失效。 但是手淘手猫都集成了网络库，支持内外网的IP的调度(也相当于dns劫持)，这时可以联系网络库的开发 “天晖” 配置。
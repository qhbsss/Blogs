---
title: "openclaw 源码debug指南"
source: "https://ata.atatech.org/articles/11020604091?spm=ata.23639746.0.0.31603059aKwxA7"
author:
published:
created: 2026-04-13
description:
tags:
  - "clippings"
---
中国电商事业群-淘天集团

粉丝 8影响力 158

** 5

** 5

** 2

** 原创文章

**

[唐辉(淡月)](https://ata.atatech.org/users/11001028505)

3月18日发表3月18日更新81次浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章04:33

Powered by 通义语音合成

通义语音合成

**

## 背景

这个文档就一件事：帮你快速上手 openclaw 源码调试。不扯概念，直接上操作。

安装文档可以参考： [https://ata.atatech.org/articles/11020599648](https://ata.atatech.org/articles/11020599648)

---

## 找到源代码

首先得知道代码装在哪了。openclaw 是通过 npm 全局安装的，所以先找一下可执行文件的位置：

which openclaw

返回：

/Users/danyue/.nvs/node/24.12.0/arm64/bin/openclaw

发现是个软链接，继续追踪：

ls -la $(which openclaw)

返回：

lrwxr-xr-x@ 1 danyue staff 41 3 18 14:20 /Users/danyue/.nvs/node/24.12.0/arm64/bin/openclaw ->../lib/node\_modules/openclaw/openclaw.mjs

所以真正的源码目录在这里：

/Users/danyue/.nvs/node/24.12.0/arm64/lib/node\_modules/openclaw

把这个目录用 VSCode 打开，就可以开始调试了。

类似

qoder /Users/danyue/.nvs/node/24.12.0/arm64/lib/node\_modules/openclaw

或者

code /Users/danyue/.nvs/node/24.12.0/arm64/lib/node\_modules/openclaw

> 如果没有code指令 可以参考

> ![[Image.png]]

> ![[Image 1.png]]

---

## 配置 VSCode 调试

配置一下 VSCode 的 launch.json，这样可以用图形化界面调试。

在openclaw项目根目录创建 `.vscode/launch.json` ，内容如下：

> 可以直接复制一份，然后让qoder给你改对就行，可能项目路径，node版本需要调整

![[Image 2.png]]

{

"version": "0.2.0",

"configurations": \[

{

"name": "Debug OpenClaw Gateway",

"type": "node",

"request": "launch",

"program": "/Users/danyue/.nvs/node/24.12.0/arm64/lib/node\_modules/openclaw/openclaw.mjs",

"args": \["gateway"\],

"runtimeExecutable": "/Users/danyue/.nvs/node/24.12.0/arm64/bin/node",

"env": {

"OPENCLAW\_SKIP\_CHANNELS": "0",

"OPENCLAW\_GATEWAY\_TOKEN": "7cad9a0099aa5b63c0ebe48959b5da1e6622d9c80492a6c7"

},

"resolveSourceMapLocations": \[

"${workspaceFolder}/\*\*",

"!\*\*/node\_modules/\*\*"

\],

"skipFiles": \[

"<node\_internals>/\*\*"

\],

"console": "integratedTerminal",

"sourceMaps": true

}

\]

}

![[a808a45f-42c2-48f2-b206-98d59aea03b1.png]]

几点说明：

●

`program` 指向 openclaw 的入口文件

●

`args` 是传给 openclaw 的参数，这里用的是 `gateway` 子命令

●

`env` 里放了一些环境变量，根据你的实际情况调整

●

`sourceMaps` 开启后可以在 TypeScript 源码里打断点

配置好后，按 F5 或者点击左侧调试图标里的「Debug OpenClaw Gateway」就可以启动了。

![[Image 3.png]]

在合适地方断点

例如可以搜 createAgentSession，然后每个地方都断一下

![[Image 4.png]]

然后访问 [http://127.0.0.1:18789/#token=7cad9a0099aa5b63c0ebe48959b5da1e6622d9c80492a6c7](http://127.0.0.1:18789/#token=7cad9a0099aa5b63c0ebe48959b5da1e6622d9c80492a6c7)

随便输入内容

![[Image 5.png]]

然后理论上就可以快乐看全链路调用啦

![[Image 6.png]]

## 相关可交叉参考地址

代码： [https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)

文档： [https://docs.openclaw.ai/zh-CN](https://docs.openclaw.ai/zh-CN)

deepwiki: [https://deepwiki.com/openclaw/openclaw](https://deepwiki.com/openclaw/openclaw)

END

背景

找到源代码

配置 VSCode 调试

相关可交叉参考地址

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
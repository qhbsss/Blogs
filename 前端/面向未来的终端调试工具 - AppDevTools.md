---
title: "面向未来的终端调试工具 - AppDevTools"
source: "https://ata.atatech.org/articles/11000249835?spm=ata.23639746.0.0.370f3e028H9eaK"
author:
published:
created: 2026-09-06
description:
tags:
  - "clippings"
---
2022-10-27发表2023-07-27更新477次浏览




![](https://oss-ata.alibaba.com/article/2023/11/138bfe24-404d-4137-a5f2-cb70e94f719d.png)

## 背景

伴随着技术的演进，前端和客户端技术在不断地相互交融。在融合成新终端体系的大背景下，新的研发工具也决定着终端体系的生产效率和研发体验。

随着容器/引擎从前端适配到遵循 Web 标准思路的转变，终端技术大概率会向着 JS + 渲染处理的模式演进。目前研发链路还算完善，吐槽较多的是问题排查的链路。

从前端和客户端协作的角度看，集团内相关终端解决方案有小程序、PHA、Weex 1.0 (停止维护)、NativeJS 、Flutter、和 Weex 2.0 等，传统调试方案有：


|                | 开发环境            | 生产环境            | 调试体验                                   |
| -------------- | --------------- | --------------- | -------------------------------------- |
| 前端             | Chrome DevTools | Chrome DevTools | 优势 体验一致，能力完备，拓展性好，支持多种场景 不足 移动端调试有一定成本 |
| 客户端            | Xcode           | 日志、掌中测、Debug 包等 | 优势 客户端深层调试 不足 不同环境调试方式不同，生产环境调试难       |
| Android Studio |                 |                 |                                        |


终端研发在实际真机环境中调试时，存在着很多问题：

- 黑盒客户端，运行状况，后台进程，一概不知

- 真机与 PC 浏览器模拟器差异较大，真机调试成本高，难以覆盖全面

- Debug 包体验较差，稳定性难保障

- ...

## AppDevTools

从面向 Web 标准调试工具的最佳实践 - Chrome Devtools 中得到启发，如果统一终端调试协议，会有很多可能性，甚至有机会彻底改善调试体验，AppDevTools 便是其中一种方案。

体验地址： [https://appdevtools.alibaba-inc.com/](https://appdevtools.alibaba-inc.com/)

AppDevTools 是一款基于 CDP (Chrome Devtools Protocol) 面向 Web 标准，不限环境且易于扩展的远程调试工具。

## 特性

### 1\. 快速简单

不侵入页面源码，无需 USB 连接，只需要扫码认证后，直接打开页面就可以开启调试，并提供熟悉的 Chrome DevTools 调试体验。

<video src="https://oss-ata.alibaba.com/articleVideo/2024/03/209e681a-fb95-405b-93d9-665b4044e9b3.mp4" controls=""></video>

Chrome DevTools 通用调试功能演示

相比于在真机中打开一个调试面板（掌中测、vConsole、Eruda 等方案），AppDevTools 不受限于手机端的操作界面，更适合做一些表单输入、JS 调试等复杂调试操作，使用 PC 调试真机的方案体验更好。

### 2\. 不限环境

支持 Debug 包和正式包。不限调试本地、测试或生产环境的页面。对接 CDP 协议可快速支持对应容器，支持 WindVane、PHA 及 Weex 2.0 的调试。

<video src="https://oss-ata.alibaba.com/articleVideo/2024/03/7fdcb95a-85a0-4379-908c-67bb91691ef6.mp4" controls=""></video>

Debug 包调试 WEEX 页面演示

面向 Web 标准的 Weex 2.0 和 Web 页面调试体验一致，支持页面节点、控制台、网络、内存及 JS 断点调试等能力，调试体验良好，这也是我向往的调试体验。

### 3\. 掌控客户端

可调试在客户端中进入后台的页面，查看客户端日志信息及客户端中页面渲染方案。

<video src="https://oss-ata.alibaba.com/articleVideo/2024/03/6e7a0668-5fbd-4dff-a14e-abf1d0a97c8e.mp4" controls=""></video>

后台页面及客户端日志调试演示

### 4\. 覆盖集团前端大多数真机调试场景

目前 AppDevTools 提供： Chrome DevTools 通用调试 、容器调试、MTOP 调试、资源代理及业务定制调试能力，对应了集团前端大多数的真机调试场景。

### 5\. 业务易扩展

和 Chrome DevTools 一致，AppDevTools 也支持通过插件快速定制和扩展调试能力。

开发 AppDevTools 插件不但可满足不同业务的调试需求，并且可同步发布 Chrome 插件市场（AppDevTools 插件可完全运行于 AppDevTools 及 Chrome 浏览器中）。

<video src="https://oss-ata.alibaba.com/articleVideo/2024/03/ed751eeb-1647-438c-a1ce-562cd1f48706.mp4" controls=""></video>

AppDevTools 插件开发调试演示

## 实现

![](https://oss-ata.alibaba.com/article/2023/11/256823ef-2967-4eee-9d82-5719a655d1fd.png)

调试页中的 DevTools 基于 Chrome Devtools 源码工程，并进行了相应的定制修改。

通过在调试页面注入的 backend.js 脚本，调试 Web 页面。backend.js 中实现了 CDP 协议的处理器 及 JS 模拟调试响应。

客户端同时增强调试能力，弥补纯 JS 架构存在无法满足实际业务调试的需求，例如：

- 资源请求代理及监听

- 客户端日志分析

- 同层渲染组件调试

- 实时内存分析

- Weex 调试

- ...

![](https://oss-ata.alibaba.com/article/2023/11/f030c101-0113-4b2b-bf35-cbebb9281d8c.png)

AppDevTools 的实现离不开服务端、前端及客户端的配合，实现架构如下：

![](https://oss-ata.alibaba.com/article/2023/11/8b5d4e1b-ab1f-443c-9d22-85495eb397b2.png)

AppDevTools 实现文档： [https://yuque.antfin-inc.com/apptools/dev-appdevtoos/agidpb](https://yuque.antfin-inc.com/apptools/dev-appdevtoos/agidpb)

## 山海关

另外介绍一款淘系前端最为常用的调试工具 - 山海关。

[下载安装 - 山海关](https://chrome.google.com/webstore/detail/guan-extension/jfalnandddhgfnmejfgjgfbfnnkhljog)

山海关是一款 Chrome 插件，主要功能有：MTOP 调试、模块代理，资源代理，接口代理等，通过山海关提供的代理服务也可以进行手机端调试。

![](https://oss-ata.alibaba.com/article/2023/11/c2293550-5903-46d7-98d4-f6f02c10b4cc.png)

山海关无疑是一款优秀的 Web 调试工具，也许下一代会演进成面向未来终端的调试工具，同样值得期待。


|             | PHA | Weex 1.0 | NativeJS | Weex 2.0 |
| ----------- | --- | -------- | -------- | -------- |
| AppDevTools | 支持  | 不支持      | 不支持      | 支持       |
| 山海关         | 支持  | 支持部分调试能力 | 支持部分调试能力 | 不支持      |


## 写在最后

研发提效是个非常大的命题，他包含了很多课题：

![](https://oss-ata.alibaba.com/article/2023/11/14bf00a2-3049-4977-882b-40dd8439fb89.jpeg)

调试工具是稳定性保障和快速定位问题的基础，彻底解决线上线下及真机调试难的痛点，要做的事情很多，要攻克的问题也不少。

若所有参与终端基础设施建设的同学们能意识到统一 Web 标准及相关协议标准所带来的先进性和可发展性，并达成共识时，我相信终端的未来一定会更加美好。

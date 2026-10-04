---
title: "不挂VPN也能用Claude/GPT-5 GitHub Copilot订阅全攻略"
source: "https://ata.atatech.org/articles/11020605387?spm=ata.23639746.0.0.3d222a29mpDFWf"
author:
published:
created: 2026-05-13
description:
tags:
  - "clippings"
---
## 为什么要订阅GitHub Copilot

GitHub Copilot 模型能力强、使用门槛低

相比国内AI编程工具，Github Copilot能用到更强的前沿模型

相比直接订阅海外AI服务（如Claude、ChatGPT），Copilot购买方便、价格更低、不用挂VPN

GitHub Copilot支持的模型

- claude-opus-4.6

- claude-sonnet-4.6

- gpt-5.4

- gpt-5.3-codex

- gemini-3.1-pro-preview

- 此处省略20个其他模型

当然如果懒得折腾，使用aone Copilot也是一个很好的选择，最近额度已经涨到2000次调用了

## 如何订阅GitHub Copilot

## 前置准备

国际信用卡，招商银行可办，感谢青也大哥支招


| 1、搜visa | 2、选国际信用卡（填写信息） | 3、下载掌上生活去【我的-资料管理-地址信息】维护邮卡地址 | 4、等待邮寄即可，从办理到邮寄到北京大概2天 |
| ------- | -------------- | ----------------------------- | ---------------------- |


## 购买订阅

[GitHub Copilot · Plans & pricing](https://github.com/features/copilot/plans?ref_cta=See+pricing+and+plans&ref_loc=hero&ref_page=%2Ffeatures_copilot_copilot_ai_code_editor&cft=copilot_li.features_copilot)

> ●
>
> 注册技巧：强烈推荐使用 阿里邮箱 (@alibaba-inc.com) 注册 GitHub 账号。

> ○
>
> 优势：便于后续可能的企业版福利关联、找回密码更安全、符合公司身份认证规范。

> ●
>
> 学生认证：如果有教育背景，如何利用学生身份免费获取 Pro 版权益。

> ●
>
> 订阅档位选择：可根据自己的使用强度选择档位，pro 300次调用，pro+ 1500次调用

接下来需要填写地址信息，这里的信息需要跟你的信用卡地址填写一致，又到了活用大模型的时候了。

注意最下边那个VAT是信用卡背面右侧的一个三位数字

经过一通CV（复制粘贴）后，点这个绿绿的按钮就成功消费了，注意没有二次确认，没有密码输入，直接扣款（知道我为什么打那么多码了吗）

后续的用量可以从这里看： [Build software better, together](https://github.com/settings/copilot/features)

## 订阅完的第一件事

取消自动续费

![[957414a7-8eb7-46f8-92e0-3d742f7f56e7.png]]

[传送门](https://github.com/settings/billing/licensing) （巨难找）

![[84f9928e-7dcf-4044-8216-45a313e312a6.png]]

## 接入编程工具

## Opencode（省心推荐）

开源软件，截止目前141K star

[GitHub - anomalyco/opencode: The open source coding agent.](https://github.com/anomalyco/opencode)

1、进入opencode后，输入/connect ![[506e7bcf-3e80-42a7-833b-b0f870be5e19.png]]

2、搜索github（太多了）

![[6a5f335a-cea9-444f-b43e-0d47286201dd.png]] ![[f79079d0-1935-4c6f-ba30-2f64ef62d888.png]]

3、去网页授权（点点点）

![[51b84568-58a9-4476-9b2e-32950d321720.png]] ![[98dc5907-92bf-4621-838e-43f4a83c9626.png]] ![[2e6fd9f3-b0fb-4e9a-ac79-a4ad0ba32de0.png]] ![[7c61aafd-f2a9-4568-8793-0e54c27dadc0.png]]

4、成为有模人

![[c9bc606d-6833-4daf-89e9-66639ce93bb0.png]] ![[b1d94226-89a6-4da3-9529-f25548e1f497.png]]

## Claude code

没跑通

试了四种方案都失败了，应该是最近有更新协议，预计近期会解决掉，目前没找到好的解决方案，有能跑通的大佬能分享下就更好了


| copilot-api（业界先进）                  | ‘max_tokens’ is not supported with this model · Issue #222 · ericc-ch/copilot-api |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| cc switch（看着专业）                    | 来自路良的调研                                                                           |
| Agent Maestro（vs code插件代理）         |                                                                                   |
| VS Code Copilot Proxy（vs code插件代理） |                                                                                   |


## 效能评估与报销

## AI Coding Analytics · 研效数据平台（报销需要）

可产出水单！报销需要， [快去安装](https://coding.alibaba-inc.com/dashboard) （只代表飞猪BU，其他BU不了解）

报销大于20$的需要提供月维度消耗一个亿token的水单

![[da1eaee7-2267-4f8b-901f-df124ad08b6e.png]]

只支持三个工具

## AI Coding采集方案

需要按规范安装，支持的工具多

可通过此网站查询使用情况： [https://charity-web.alibabafoundation.com/api/auth/code-detail](https://charity-web.alibabafoundation.com/api/auth/code-detail)

## 一点扩展

[GitHub - golutra/golutra](https://github.com/golutra/golutra)

最近在做应用的架构设计，和一个模型聊总怕聊的不够全面，尝试使用了golutra在架构设计场景做多Agent辩论，可使用 `opencode --model github-copilot/claude-sonnet-4.6` 命令使用不同的模型讨论，推荐一波。

![[03bb34e9-1da3-4d3d-baad-2867d388544b.png]]

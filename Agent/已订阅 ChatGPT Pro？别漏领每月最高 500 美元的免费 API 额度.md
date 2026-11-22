---
title: "已订阅 ChatGPT Pro？别漏领每月最高 500 美元的免费 API 额度"
source: "https://ata.atatech.org/articles/11020826131?spm=ata.23639420.0.0.15527536AfWiiV"
author:
  - "[[罗继列(唯宸)]]"
published:
created: 2026-11-05
description:
tags:
  - "clippings"
---
【注意】只能在网页端领取！【一键直达】 [https://chatgpt.com/settings/billing](https://chatgpt.com/settings/billing?spm=ata.21736010.0.0.e60a7536Z3i12G)

你可能已经在为 ChatGPT Pro 付费，却还不知道订阅中有一项需要主动领取的福利： **OpenAI 为符合条件的 Pro 用户提供 API 额度。Pro 200 对应每个完整月度账期 US$200，Pro 500 对应 US$500。**  
![](redirect_123.png)

这笔额度无需在订阅费之外另行购买，但也不会因为开通了 Pro 就自动出现在 API 账户中。 **首次需要完成领取，并绑定一个 OpenAI API 组织。** [OpenAI 官方开发者文档](https://developers.openai.com/api/docs/guides/chatgpt-api-credits?spm=ata.21736010.0.0.e60a7536Z3i12G)

> 本文依据 2026 年 11 月 5 日可查的 OpenAI 官方说明整理。领取资格、金额和有效期，请以账号内实际显示为准。

## 一、Pro 200 和 Pro 500 分别能领多少？

| 订阅档位 | 每月订阅价格 | 完整月度账期对应的免费 API 额度 |
| --- | --- | --- |
| Pro 100 | US$100 | US$100 |
| **Pro 200** | **US$200** | **US$200** |
| **Pro 500** | **US$500** | **US$500** |

OpenAI 的 [Pro 档位说明](https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers) 列出了订阅价格； [API 额度福利说明](https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions) 列出了各档位在完整月度账期内对应的额度。

**注意“完整月度账期”四个字。** 首次领取时，OpenAI 会按当前订阅账期的剩余时间折算。因此，即使你订阅的是 Pro 200，第一次领取也可能少于 US$200；Pro 500 同理。确认领取前，应查看页面显示的本次发放金额及到期时间。

## 二、谁可以免费领取？

领取前，先检查以下条件：

- 你持有 **已付费且仍有效** 的 Pro 订阅，并且该订阅已持续至少 **7 天** 。试用或赠送订阅不符合条件。
- 你是 ChatGPT Pro 订阅的所有者，同时也是接收额度的 **API 组织所有者** 。
- ChatGPT 账号与用于绑定 API 组织的账号使用 **同一邮箱** 。

如果此前没有使用过 OpenAI API，也可以使用与订阅邮箱关联的 *Personal API Organization* 。一个符合条件的订阅只能绑定一个接收额度的 API 组织，选择时应仔细核对。 [OpenAI 帮助中心：领取资格与绑定要求](https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions)

## 三、怎么领取？两种官方入口

### 方法一：从 ChatGPT 领取

1. 登录持有 Pro 订阅的 [ChatGPT](https://chatgpt.com/) 账号。
2. 打开 **Settings → Billing** 。
3. 找到 **API credits** 福利，进入领取流程。
4. 选择接收额度的 API 组织，核对本次金额后确认。
5. 打开该组织的 [API Platform Billing 页面](https://platform.openai.com/settings/organization/billing/overview) ，检查赠送额度是否到账。

### 方法二：从 API Platform 领取

1. 使用与 Pro 订阅相同的邮箱登录 [OpenAI API Platform](https://platform.openai.com/) 。
2. 选择自己拥有、准备接收额度的 API 组织。
3. 在 **Billing** 页面找到 API credits 福利。
4. 选择符合条件的 Pro 订阅，核对信息并确认绑定。
5. 返回该组织的 Billing 页面，查看实际发放记录。

两条路径领取的是 **同一项订阅福利** ，选择其中一条即可。领取流程显示成功后，仍应在接收额度的 API 组织中核对余额；绑定成功与额度到账是两个需要分别确认的结果。 [OpenAI 官方领取指南](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

## 四、领到的额度怎么用？

这笔免费额度用于 **所绑定 API 组织产生的适用 API Platform 费用** 。例如，你可以用它测试文本和代码生成、图像能力、实时语音，以及适用的内置工具。

最短的上手路径是：

1. 在 [API Platform](https://platform.openai.com/) 中切换到 **领取额度时绑定的组织** 。
2. 在该组织下创建项目和 API Key。
3. 按照 [OpenAI API 快速入门](https://developers.openai.com/api/docs/quickstart) 发起调用，或先使用 Playground 测试。
4. 在组织的 **Billing → Credit grants** 查看赠送额度，在 **Usage** 查看用量。

调用时要使用 **绑定组织下的项目 API Key** 。如果切换到了别的组织，即使使用同一个邮箱，也不能把这笔额度用于另一个组织的调用。赠送 API 额度会先于该组织已购买的 API 额度消耗。 [OpenAI 帮助中心：适用范围与余额查询](https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions)

## 五、续费后每月还要重新领吗？

**不需要。** 首次激活后，只要订阅持续符合条件，且 OpenAI 继续提供这项福利，订阅续费时会自动发放下一账期的额度。

不过， **本账期没有用完的额度会在账期结束时过期，不会结转到下个月** 。取消订阅或变更为不符合条件的档位，也会影响后续发放。 [OpenAI 帮助中心：续费与到期规则](https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions)

## 六、几个容易误解的地方

**“免费领”不等于免费订阅 Pro。** 这是符合条件的付费 Pro 订阅所附带的 API 福利，不能兑换现金，也不是订阅费退款。

**API 额度不是 ChatGPT 使用次数。** 这笔额度不会提高 ChatGPT 或登录态 Codex 的使用上限，也不适用于通过 API Key 使用 Codex 的费用。 [OpenAI 官方适用范围](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

**有余额也仍受 API 限制。** 模型、组织及项目的速率或用量限制依然适用。赠送额度用完后，如果组织还有已购买的 API 额度，调用会继续消耗已购买额度；如果没有任何剩余额度，请求会因余额耗尽而失败。 [OpenAI 帮助中心：额度耗尽后的行为](https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions)

## 最后，花一分钟检查一下

如果你已经订阅 **Pro 200 或 Pro 500** ，现在就可以打开 **ChatGPT → Settings → Billing** ，查看是否有待领取的 API credits 福利。按页面提示完成组织绑定，再到 API Platform 核对实际到账金额和到期时间。

**已经付费的订阅福利，别让它在 Billing 页面里被忽略。**

## 实测效果

![](redirect_124.png)  
![](redirect_125.png)

> 如果帮助到你 别忘一键三连
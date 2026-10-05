---
title: "巨能抓 (Mega Fetch)：成功率超高的网页抓取转 Markdown 工具"
source: "https://ata.atatech.org/articles/11020607668?spm=ata.23639746.0.0.5b2d3aa088HX3H"
author:
published:
created: 2026-10-05
description:
tags:
  - "clippings"
---
云智能集团


原创文章

AI辅助创作 50%


[云智能技术服务圈](https://ata.atatech.org/community/team/619) / [新金融交付](https://ata.atatech.org/community/team/619?cid=2876) (首发)


[孟铮(星烈)](https://ata.atatech.org/users/11000069506)

4月1日发表9月21日更新


![](redirect_110.png)

## 背景

网页转 Markdown，这个需求听起来很简单。

市面上不缺这类工具——jina.ai 的 r.jina.ai 能把页面变 Markdown，GitHub 上成百上千个 html-to-markdown 项目，各种 SaaS 服务更是多如牛毛。

**但它们都有一个共同问题：面对稍微「不配合」的网站，就歇菜。**

- 知乎、微博、B 站？大部分工具连门都进不去
- 微信公众号？要么不支持，要么要折腾一堆配置
- 飞书文档？企业内网更是想都别想

我想解决的就是这个问题： **让「抓不下来」这三个字，从我这里消失。**

我研究了市面上常见的网页抓取解决方案，然后集各家之长，现在这个skill可以做到你网页能渲染的，我就能又快又稳的抓取到。

---

## 核心设计：自动路由 + 逐级 fallback

mega-fetch 的设计思路很简单： **让简单的方案先上，不行了再换复杂的。**

### 1\. 自动路由

拿到一个 URL，我首先判断它是什么类型的网站，然后分配最合适的处理方式：

| URL 类型 | 处理方式 | 为什么 |
| --- | --- | --- |
| GitHub | gh CLI | 官方接口，极速且稳定 |
| 微信公众号 | Playwright | 需要渲染 JS，还要处理微信特殊 DOM |
| 飞书文档 | 飞书 Open API | 企业文档有正规接口，直接调 API 最靠谱 |
| 其他网站 | 通用抓取 | 走 fallback 流程 |

这一步的目的很简单： **能用官方接口就用官方接口，能省不少事。**

### 2\. 通用网页的 5 级 fallback

通用网页（也就是前面没匹配到的）走的是一套渐进式方案：

**第一级：直接请求**  
用 requests 发送 HTTP 请求，拿到 HTML，用 BeautifulSoup 解析。80% 的网站这一步就搞定了。

**第二级：agent-fetch**  
如果直接请求失败或被识别为爬虫，尝试 agent-fetch。这是一个带浏览器指纹模拟的工具，能绕过基础的 UA 检测。

**第三级：r.jina.ai**  
Jina 官方提供的 Markdown 提取服务，输入 URL 返回 Markdown。很多博客、文档站点用这个效果不错。

**第四级：defuddle.md**  
另一个内容提取服务，作为备选。有时候 Jina 搞不定的页面，它能行。

**第五级：CDP 终极兜底**

这是最关键的一级。

**CDP = Chrome DevTools Protocol。** 简单说，就是直接控制一台 Chrome 浏览器，让它打开页面、渲染 JavaScript、然后把渲染后的内容抓出来。

为什么这是「终极」方案？

因为它根本不是在「爬」网站——它就是在用一台真的浏览器。网站所有的反爬检测，面对一个真正的浏览器实例，都是无效的。你检测 UA？我用的是真实 Chrome 的 UA。你检测 Selenium 特征？我根本不用 Selenium。你检测 Headless 模式？我可以用有窗口模式。

**这就不是在爬，这是在「自动化操作浏览器」。**

---

## 反爬网站的特殊优化

知乎、微博、B 站、抖音、小红书——这些网站的反爬是出了名的难搞。

市面上大部分工具的做法是：先试试简单方案，失败了再慢慢升级。但对于这些网站，这套流程完全是浪费时间——它们连第一关都过不了。

所以我加了预判机制： **在真正抓取之前，先判断这个 URL 属不属于「反爬钉子户」。如果是，直接开 CDP，省掉前面的试错过程。**

代码里是这样定义的：

```python
STRICT_ANTIBOT_DOMAINS = [
    'zhihu.com', 'weibo.com', 'xiaohongshu.com', 'bilibili.com',
    'douyin.com', 'tiktok.com', 'taobao.com', 'tmall.com', 'jd.com'
]
```

遇到这些网站，二话不说，CDP 启动。

---

## CDP 实现的一些细节

既然都到这一步了，不如展开说说 CDP 这个方案我是怎么做优化的：

**1\. 实例复用**

每次抓取都重新启动 Chrome？太慢了。第一次抓取后，Chrome 进程保持运行，下一次直接复用。新开一个 tab 就能继续抓，不需要重新启动浏览器。

**2\. 智能等待**

页面加载需要时间，但不需要等所有资源加载完。我设置的策略是：检测到主体内容（超过 500 字符）就算加载完成，最多等 15 秒。保证速度的同时不牺牲成功率。

**3\. 有窗口 vs 无头**

无头模式（headless）更快，但如果被检测到，回退到有窗口模式（headed）。有窗口模式更难被识别为爬虫，因为网站看到的是一台「真实的、正在被操作的浏览器」。

**4\. 反爬拦截检测**

抓完内容后，我会检查是否被反爬页面「截胡」了。如果返回的是「暂时限制本次访问」之类的内容，主动放弃，避免给用户喂垃圾数据。

---

## 跟其他工具对比

| 维度 | mega-fetch | r.jina.ai | Firecrawl | 各种开源脚本 |
| --- | --- | --- | --- | --- |
| 支持网站类型 | 几乎所有 | 简单页面 | 较多 | 单一 |
| 反爬能力 | CDP 兜底 | 无 | 有 | 弱 |
| 微信公众号 | ✅ | ❌ | ❌ | 少 |
| 飞书文档 | ✅ | ❌ | ❌ | 极少 |
| GitHub | ✅ (gh CLI) | 部分 | 部分 | 各自为政 |
| 成功率 | 接近 100% | 看运气 | 较高 | 不稳定 |
| 配置复杂度 | 装完即用 | 无需配置 | 需要 API Key | 各不相同 |

**一句话概括：mega-fetch 是一个「几乎不需要关注对方是什么网站」的工具。**

---

## 适用场景

- **内容收藏** ：看到一篇好文章，想保存为 Markdown 慢慢看
- **竞品分析** ：批量抓取某个领域的所有文章，做分析
- **知识管理** ：把公众号、飞书文档、知乎回答统一转成 Markdown，喂给笔记软件
- **数据采集** ：做研究需要大量网页内容，不需要自己写爬虫

---

## 怎么用

在 Claude Code 里，我已经把它做成了 skill。

你只需要告诉 Claude：「帮我把这个页面转成 Markdown」，剩下的它会自动处理。

如果不用 Claude Code，也可以直接命令行：

```bash
python3 scripts/fetch_main.py "https://..."
```

---

## 总结

mega-fetch 这个工具，核心就两点：

1. **能抓的网站尽量用轻量方案**——快
2. **抓不下来的用 CDP**——稳

从「轻量请求」到「CDP 终极兜底」，中间有 5 级过渡。每失败一级，自动切换下一级。用户不需要知道中间发生了什么，只需要一个结果： **我要的内容** 。

下载见这里: [https://gts.work/yunchuang-assets/skillHub/detail?spm=a2cqb.yunchuang-assets\_skillhub\_myskills.0.0.4a4d58c8ti75nK&id=270&scene=MY](https://gts.work/yunchuang-assets/skillHub/detail?spm=a2cqb.yunchuang-assets_skillhub_myskills.0.0.4a4d58c8ti75nK&id=270&scene=MY)

END

背景

核心设计：自动路由 + 逐级 fallback

1\. 自动路由

2\. 通用网页的 5 级 fallback

反爬网站的特殊优化

CDP 实现的一些细节

跟其他工具对比

适用场景

怎么用

总结


有什么问题，和我聊聊吧～


内部资料

INTERNAL

495838
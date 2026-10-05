---
title: "Playwright 网页自动化抓取实践：从录制到脚本化"
source: "https://ata.atatech.org/articles/11020604995?spm=ata.23639746.0.0.6c7558746xkUbr"
author:
published:
created: 2026-04-22
description:
tags:
  - "clippings"
---
AI 辅助创作






## Playwright Web Scraper Skill 使用说明

> Aone市场链接： [https://open.aone.alibaba-inc.com/console/skill/jipengju-jpj-playwright-web-scraper](https://open.aone.alibaba-inc.com/console/skill/jipengju-jpj-playwright-web-scraper?spm=ata.21736010.0.0.33b77536WgidBy)

### 写在前面

作为一名身处总部中台的运营同学，我的日常往往被大量的数据核对、竞品监测和信息搜集所占据。坦白说，我的 Coding 能力仅限于“Hello World”水平，面对那些需要登录、点击、滚动加载的动态网页，过去我只能选择最原始的方式——人工手动截图、复制、粘贴。这不仅效率低下，更挤占了我用于深度思考和业务策略规划的时间。
这次介绍的 playwright-web-scraper Skill，正是我在这个问题上的一个务实探索。它不需要我精通 Python 或 JavaScript，而是通过“录制-回放”的直观方式，将复杂的网页交互转化为可重复执行的自动化脚本。这篇文章不谈高深的架构设计，只想从一个普通运营同学的视角，分享如何利用这个工具，把重复劳动交给机器，把创造力还给自己。

### 概述

Playwright Web Scraper 是一个基于 Playwright Python 库的自动化网页爬虫 Skill，专为 QoderWork 平台设计。它帮助用户通过浏览器自动化的方式抓取网页数据，尤其擅长处理需要交互操作（如点击、填写表单、滚动加载）的动态页面。该 Skill 还集成了 Playwright 的 codegen 录制功能，允许用户通过可视化操作直接生成爬虫脚本，大幅降低编写爬虫的门槛。
适合非技术向同学的

### 适用场景

本 Skill 适合以下典型需求：需要从动态渲染页面（JavaScript/AJAX）抓取数据；需要自动化表单填写、筛选、下拉框选择等交互后再提取数据；需要处理分页列表或无限滚动页面的批量数据采集；需要在登录保护的页面上定期提取信息；以及希望通过"录制-回放"方式快速生成爬虫脚本的场景。

不建议在以下场景使用：目标页面为纯静态 HTML（直接用 HTTP 请求更高效）、目标站点提供了公开 API（直接调 API 更稳定）、仅需简单 Token 认证即可获取数据的情况。

### 环境要求与安装

使用前需确保本地安装了 Python 3.7+ 和 pip。首次使用时运行以下命令安装 Playwright 及其浏览器驱动：

pip3 install playwright
python3 -m playwright install

安装完成后可通过 `python3 -m playwright --version` 验证是否安装成功。

### 文件结构

整个 Skill 包含以下文件：

playwright-web-scraper/
├── SKILL.md                              # 核心指令文件，定义 Skill 的工作流程和行为规范
├── references/
│   └── quick_reference.md                # 快速参考手册，汇总常用选择器、操作和命令
└── templates/
    ├── table_scraper.py                  # 表格数据抓取模板
    ├── pagination_scraper.py             # 分页列表抓取模板
    ├── form_scraper.py                   # 表单筛选后抓取模板
    └── dynamic_content_scraper.py        # 动态内容/无限滚动抓取模板

### 核心工作流程

该 Skill 遵循五个阶段的标准工作流程。

**第一阶段：需求确认。** AI 助手会先与你沟通目标 URL、需要抓取的数据字段、是否需要交互操作（如登录、筛选）、以及期望的输出格式（JSON、CSV 或 Excel）。

**第二阶段：录制操作。** 通过 Playwright 的 codegen 工具打开目标网页，你在浏览器中手动执行所有操作（点击、输入、翻页等），工具会实时录制并生成对应的 Python 代码。录制命令为：

python3 -m playwright codegen --target python <目标URL>

录制时请注意：操作尽量放慢以保证录制完整；在输入密码等敏感信息时暂停录制；页面跳转后等待加载完毕再进行下一步；如果页面涉及分页、筛选器或动态加载元素，建议在录制过程中也执行一遍这些操作以确保生成的代码覆盖完整流程。

**第三阶段：脚本优化。** AI 助手会基于录制生成的代码进行完善，包括添加错误处理、实现数据提取逻辑、格式化输出，以及处理登录状态的持久化。Skill 内置了两个实用的工具函数可直接复用： `safe_click(page, selector, timeout)` 提供带超时和异常捕获的安全点击操作， `extract_table_data(page, table_selector)` 可一行代码完成表格数据的批量提取。

**第四阶段：测试迭代。** 运行脚本并验证数据准确性，修复选择器失效、超时等问题，处理空数据等边界情况。

**第五阶段（可选）：封装复用。** 如果你需要定期运行该爬虫，可以借助 QoderWork 的 `skill-creator` Skill 将其封装为独立的可复用 Skill。

### 四大模板详解

#### 表格抓取模板（table_scraper.py）

适用于页面上有 HTML `<table>` 标签的数据表格。该模板自动定位表格元素，逐行提取所有单元格文本，支持导出为 JSON 或 CSV 格式。使用时只需替换目标 URL 和表格选择器即可。

#### 分页抓取模板（pagination_scraper.py）

适用于数据分布在多个分页中的列表页面。模板会自动点击"下一页"按钮并累积数据，支持设置最大翻页数以防止无限循环。当检测到下一页按钮不可用或不存在时自动停止。

#### 表单筛选抓取模板（form_scraper.py）

适用于需要先设置筛选条件（日期、下拉框、输入框等）再提取数据的看板或报表页面。模板支持通过字典方式传入多组筛选条件，自动识别输入框类型（ `<select>` 、 `<input>` 或自定义组件）并分别处理。

#### 动态内容抓取模板（dynamic_content_scraper.py）

适用于使用无限滚动或 AJAX 异步加载的页面。提供两种抓取策略：一是模拟滚动到底部并等待新内容加载，循环直到没有更多数据为止（设有最大滚动次数保护）；二是直接拦截页面的 API 请求，从响应中获取结构化 JSON 数据，这种方式通常更高效且更稳定。

### 登录状态管理

对于需要认证的页面，Skill 支持将登录状态保存到 `auth_state.json` 文件中。首次运行时手动完成登录流程，脚本会自动保存 cookies 和 session 信息；后续运行时直接加载该文件即可跳过登录。这对于定时执行的爬虫任务非常实用。

### 快速参考手册

`references/quick_reference.md` 文件提供了日常开发中最常用的 Playwright 操作速查，涵盖 CSS/Text/Role 三种选择器语法、点击/输入/等待/截图等常用操作、登录状态保存与复用、重试与超时处理机制、Headless 模式切换等性能优化建议，以及完整的命令行参考。开发过程中可随时查阅。

### 输出格式支持

所有模板均支持 JSON 和 CSV 两种导出格式，通过输出文件扩展名自动切换。用户也可要求 AI 助手将数据进一步转换为 Excel 格式或生成数据分析摘要。

### 安全与合规提醒

使用本 Skill 时请注意以下事项：切勿将真实密码硬编码在脚本中，应使用登录状态文件或环境变量管理凭证；使用前请确认目标网站的 robots.txt 和服务条款，尊重网站的访问限制；在请求之间添加适当延迟（模板中已包含 `time.sleep` 和 `wait_for_load_state` ），避免对目标服务器造成过大压力。

### 常见问题与解决方案

如果遇到"元素找不到"，通常是因为页面结构发生了变化，建议使用 codegen 重新录制以获取最新选择器，或改用更稳定的 role 选择器。

如果遇到"需要登录"，可以使用上文介绍的登录状态管理方案（将登录状态保存到 `auth_state.json` 后续复用），或者先手动在浏览器中完成登录，再启动爬虫脚本。

如果遇到"数据不完整"，常见原因有三种：页面使用了无限滚动但脚本未添加滚动加载逻辑（可参考动态内容抓取模板）、超时值过短导致数据未完全加载（增大 `timeout` 参数即可）、或数据实际通过 AJAX 接口异步加载（此时使用 `scrape_with_ajax_wait` 方法直接拦截 API 响应更为稳定高效）。

如果页面加载缓慢导致超时，可以增大 `timeout` 参数值，或者将 `wait_until` 从 `"networkidle"` 改为 `"domcontentloaded"` 以加快初始加载。

如果遇到反爬检测，可以尝试切换浏览器引擎（firefox 或 webkit），或在操作间添加随机延迟模拟人类行为。

如果脚本运行过慢，将 `headless` 设置为 `True` 可以显著提升速度，同时减少不必要的等待时间和及时关闭不再使用的页面实例以避免内存泄漏。

### 触发示例

以下用户请求会触发本 Skill：

- "帮我爬取这个网站的数据: https://..."
- "我需要定时监控这个看板的数据"
- "帮我把这个页面的表格数据导出"
- "这个页面需要点击筛选器才能看到数据，能自动化吗？"
- "帮我录制一个爬虫脚本"
- "Scrape data from this website for me"
- "Record a browser automation script"

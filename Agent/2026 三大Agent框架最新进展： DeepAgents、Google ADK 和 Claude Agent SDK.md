---
title: "2026 三大Agent框架最新进展： DeepAgents、Google ADK 和 Claude Agent SDK"
source: "https://ata.atatech.org/articles/12020590826?spm=ata.23639746.0.0.40ce237dzIFDFW"
author:
published:
created: 2026-05-31
description:
tags:
  - "clippings"
---
蚂蚁集团

粉丝 2影响力 42

** 20

** 26

** 1

** 原创文章

** AI 辅助创作

[本文正在参加《ATA FY26年终总结征文 | 主题一：我的FY26技术进化年》征文活动](https://ata.atatech.org/articles/11020572828)

收录于专题

[AI4All](https://ata.atatech.org/specials/10000003909)

开放访问

**

复制专用链接

**

[王锦策(万襜)](https://ata.atatech.org/users/12002167795)

2月14日发表2月27日更新694次浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章12:16

**

## 2026 Agent 框架大爆发：深度解析三大框架的架构进化

如果你还在用 `Prompt + API` 硬撸 Agent，那你真的out了。

最近 LangChain、Anthropic 和 Google 纷纷亮出了底牌。今天咱们不玩虚的，直接拆解 **DeepAgents** 、 **Google ADK** 和 **Claude Agent SDK** 这三个最具代表性的框架，看看它们是怎么把 Agent 从"只会复读的复读机"变成"能干活的数字员工"的。

---

## 一、DeepAgents：开箱即用的"数字管家"

DeepAgents 是 LangChain 推出的 Agent 框架，它不是一个新的库，而是一个 **完整的 Agent 解决方案** ——你可以把它理解成一个"Agent 脚手架"，内置了任务规划、文件管理、子 Agent 派生等核心能力。

### 1.1 核心架构：三层设计

DeepAgents 的架构分为三层，每一层都解决了一个特定的痛点：

<svg id="mermaid-1780242715883-4ys5a" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 1398.21875px;" viewBox="0 0 1398.21875 756" role="graphics-document document" aria-roledescription="flowchart-v2"><g><marker id="mermaid-1780242715883-4ys5a_flowchart-v2-pointEnd" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1780242715883-4ys5a_flowchart-v2-pointStart" viewBox="0 0 10 10" refX="4.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 5 L 10 10 L 10 0 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1780242715883-4ys5a_flowchart-v2-circleEnd" viewBox="0 0 10 10" refX="11" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1780242715883-4ys5a_flowchart-v2-circleStart" viewBox="0 0 10 10" refX="-1" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1780242715883-4ys5a_flowchart-v2-crossEnd" viewBox="0 0 11 11" refX="12" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1780242715883-4ys5a_flowchart-v2-crossStart" viewBox="0 0 11 11" refX="-1" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><g><g><g id="底层引擎" data-look="classic"><rect style="" x="84.61328125" y="404" width="1200.359375" height="344"></rect><g transform="translate(652.79296875, 404)"><foreignObject width="64" height="56"><p>底层引擎</p></foreignObject></g></g><g id="中间件层" data-look="classic"><rect style="" x="8" y="194" width="1382.21875" height="160"></rect><g transform="translate(667.109375, 194)"><foreignObject width="64" height="56"><p>中间件层</p></foreignObject></g></g><g id="应用层" data-look="classic"><rect style="" x="84.61328125" y="8" width="633.6484375" height="136"></rect><g transform="translate(377.4375, 8)"><foreignObject width="48" height="56"><p>应用层</p></foreignObject></g></g></g><g><path d="M326.098,96.737L296.468,104.614C266.839,112.491,207.579,128.246,177.95,140.289C148.32,152.333,148.32,160.667,148.32,169C148.32,177.333,148.32,185.667,148.32,193.333C148.32,201,148.32,208,148.32,211.5L148.32,215" id="L_A_B_0" style=";" data-edge="true" data-et="edge" data-id="L_A_B_0" data-points="W3sieCI6MzI2LjA5NzY1NjI1LCJ5Ijo5Ni43MzY3ODU4Mzk3MzQ4OH0seyJ4IjoxNDguMzIwMzEyNSwieSI6MTQ0fSx7IngiOjE0OC4zMjAzMTI1LCJ5IjoxNjl9LHsieCI6MTQ4LjMyMDMxMjUsInkiOjE5NH0seyJ4IjoxNDguMzIwMzEyNSwieSI6MjE5fV0=" marker-end="url(#mermaid-1780242715883-4ys5a_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M411.286,119L411.982,123.167C412.679,127.333,414.072,135.667,414.768,144C415.465,152.333,415.465,160.667,415.465,169C415.465,177.333,415.465,185.667,415.465,193.333C415.465,201,415.465,208,415.465,211.5L415.465,215" id="L_A_C_0" style=";" data-edge="true" data-et="edge" data-id="L_A_C_0" data-points="W3sieCI6NDExLjI4NTczMDY5ODUyOTQsInkiOjExOX0seyJ4Ijo0MTUuNDY0ODQzNzUsInkiOjE0NH0seyJ4Ijo0MTUuNDY0ODQzNzUsInkiOjE2OX0seyJ4Ijo0MTUuNDY0ODQzNzUsInkiOjE5NH0seyJ4Ijo0MTUuNDY0ODQzNzUsInkiOjIxOX1d" marker-end="url(#mermaid-1780242715883-4ys5a_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M482.098,94.82L516.068,103.017C550.039,111.213,617.98,127.607,651.951,139.97C685.922,152.333,685.922,160.667,685.922,169C685.922,177.333,685.922,185.667,685.922,193.333C685.922,201,685.922,208,685.922,211.5L685.922,215" id="L_A_D_0" style=";" data-edge="true" data-et="edge" data-id="L_A_D_0" data-points="W3sieCI6NDgyLjA5NzY1NjI1LCJ5Ijo5NC44MjAyNDIwMDU5MDQ2Mn0seyJ4Ijo2ODUuOTIxODc1LCJ5IjoxNDR9LHsieCI6Njg1LjkyMTg3NSwieSI6MTY5fSx7IngiOjY4NS45MjE4NzUsInkiOjE5NH0seyJ4Ijo2ODUuOTIxODc1LCJ5IjoyMTl9XQ==" marker-end="url(#mermaid-1780242715883-4ys5a_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M148.32,329L148.32,333.167C148.32,337.333,148.32,345.667,148.32,354C148.32,362.333,148.32,370.667,148.32,379C148.32,387.333,148.32,395.667,222.928,410.936C297.535,426.205,446.75,448.409,521.358,459.511L595.965,470.614" id="L_B_G_0" style=";" data-edge="true" data-et="edge" data-id="L_B_G_0" data-points="W3sieCI6MTQ4LjMyMDMxMjUsInkiOjMyOX0seyJ4IjoxNDguMzIwMzEyNSwieSI6MzU0fSx7IngiOjE0OC4zMjAzMTI1LCJ5IjozNzl9LHsieCI6MTQ4LjMyMDMxMjUsInkiOjQwNH0seyJ4Ijo1OTkuOTIxODc1LCJ5Ijo0NzEuMjAyNDE4MTQ3NzMzNzR9XQ==" marker-end="url(#mermaid-1780242715883-4ys5a_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M415.465,329L415.465,333.167C415.465,337.333,415.465,345.667,415.465,354C415.465,362.333,415.465,370.667,415.465,379C415.465,387.333,415.465,395.667,445.568,408.738C475.672,421.809,535.879,439.618,565.983,448.522L596.086,457.427" id="L_C_G_0" style=";" data-edge="true" data-et="edge" data-id="L_C_G_0" data-points="W3sieCI6NDE1LjQ2NDg0Mzc1LCJ5IjozMjl9LHsieCI6NDE1LjQ2NDg0Mzc1LCJ5IjozNTR9LHsieCI6NDE1LjQ2NDg0Mzc1LCJ5IjozNzl9LHsieCI6NDE1LjQ2NDg0Mzc1LCJ5Ijo0MDR9LHsieCI6NTk5LjkyMTg3NSwieSI6NDU4LjU2MTU3ODM0NjgzNzd9XQ==" marker-end="url(#mermaid-1780242715883-4ys5a_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M685.922,329L685.922,333.167C685.922,337.333,685.922,345.667,685.922,354C685.922,362.333,685.922,370.667,685.922,379C685.922,387.333,685.922,395.667,685.922,403.333C685.922,411,685.922,418,685.922,421.5L685.922,425" id="L_D_G_0" style=";" data-edge="true" data-et="edge" data-id="L_D_G_0" data-points="W3sieCI6Njg1LjkyMTg3NSwieSI6MzI5fSx7IngiOjY4NS45MjE4NzUsInkiOjM1NH0seyJ4Ijo2ODUuOTIxODc1LCJ5IjozNzl9LHsieCI6Njg1LjkyMTg3NSwieSI6NDA0fSx7IngiOjY4NS45MjE4NzUsInkiOjQyOX1d" marker-end="url(#mermaid-1780242715883-4ys5a_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M972.301,329L972.301,333.167C972.301,337.333,972.301,345.667,972.301,354C972.301,362.333,972.301,370.667,972.301,379C972.301,387.333,972.301,395.667,939.546,408.983C906.792,422.3,841.283,440.6,808.529,449.75L775.774,458.9" id="L_E_G_0" style=";" data-edge="true" data-et="edge" data-id="L_E_G_0" data-points="W3sieCI6OTcyLjMwMDc4MTI1LCJ5IjozMjl9LHsieCI6OTcyLjMwMDc4MTI1LCJ5IjozNTR9LHsieCI6OTcyLjMwMDc4MTI1LCJ5IjozNzl9LHsieCI6OTcyLjMwMDc4MTI1LCJ5Ijo0MDR9LHsieCI6NzcxLjkyMTg3NSwieSI6NDU5Ljk3NTg4NDIyMjQ0MzV9XQ==" marker-end="url(#mermaid-1780242715883-4ys5a_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M1252.633,329L1252.633,333.167C1252.633,337.333,1252.633,345.667,1252.633,354C1252.633,362.333,1252.633,370.667,1252.633,379C1252.633,387.333,1252.633,395.667,1173.174,411.05C1093.716,426.434,934.799,448.867,855.341,460.084L775.883,471.301" id="L_F_G_0" style=";" data-edge="true" data-et="edge" data-id="L_F_G_0" data-points="W3sieCI6MTI1Mi42MzI4MTI1LCJ5IjozMjl9LHsieCI6MTI1Mi42MzI4MTI1LCJ5IjozNTR9LHsieCI6MTI1Mi42MzI4MTI1LCJ5IjozNzl9LHsieCI6MTI1Mi42MzI4MTI1LCJ5Ijo0MDR9LHsieCI6NzcxLjkyMTg3NSwieSI6NDcxLjg1OTc3MTk4NDcyNTQ2fV0=" marker-end="url(#mermaid-1780242715883-4ys5a_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M685.922,539L685.922,543.167C685.922,547.333,685.922,555.667,685.922,563.333C685.922,571,685.922,578,685.922,581.5L685.922,585" id="L_G_H_0" style=";" data-edge="true" data-et="edge" data-id="L_G_H_0" data-points="W3sieCI6Njg1LjkyMTg3NSwieSI6NTM5fSx7IngiOjY4NS45MjE4NzUsInkiOjU2NH0seyJ4Ijo2ODUuOTIxODc1LCJ5Ijo1ODl9XQ==" marker-end="url(#mermaid-1780242715883-4ys5a_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path></g><g><g><g data-id="L_A_B_0" transform="translate(0, 0)"></g></g><g><g data-id="L_A_C_0" transform="translate(0, 0)"></g></g><g><g data-id="L_A_D_0" transform="translate(0, 0)"></g></g><g><g data-id="L_B_G_0" transform="translate(0, 0)"></g></g><g><g data-id="L_C_G_0" transform="translate(0, 0)"></g></g><g><g data-id="L_D_G_0" transform="translate(0, 0)"></g></g><g><g data-id="L_E_G_0" transform="translate(0, 0)"></g></g><g><g data-id="L_F_G_0" transform="translate(0, 0)"></g></g><g><g data-id="L_G_H_0" transform="translate(0, 0)"></g></g></g><g><g id="flowchart-A-0" transform="translate(404.09765625, 76)"><rect style="" x="-78" y="-43" width="156" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-48, -28)"><rect></rect><foreignObject width="96" height="56"><p>你的业务代码</p></foreignObject></g></g><g id="flowchart-B-1" transform="translate(148.3203125, 274)"><rect style="" x="-105.3203125" y="-55" width="210.640625" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-75.3203125, -40)"><rect></rect><foreignObject width="150.640625" height="80"><p>TodoListMiddleware<br>任务追踪</p></foreignObject></g></g><g id="flowchart-C-2" transform="translate(415.46484375, 274)"><rect style="" x="-111.82421875" y="-55" width="223.6484375" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-81.82421875, -40)"><rect></rect><foreignObject width="163.6484375" height="80"><p>FilesystemMiddleware<br>文件系统</p></foreignObject></g></g><g id="flowchart-D-3" transform="translate(685.921875, 274)"><rect style="" x="-108.6328125" y="-55" width="217.265625" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-78.6328125, -40)"><rect></rect><foreignObject width="157.265625" height="80"><p>SubAgentMiddleware<br>子智能体派生</p></foreignObject></g></g><g id="flowchart-E-4" transform="translate(972.30078125, 274)"><rect style="" x="-127.74609375" y="-55" width="255.4921875" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-97.74609375, -40)"><rect></rect><foreignObject width="195.4921875" height="80"><p>SummarizationMiddleware<br>历史摘要</p></foreignObject></g></g><g id="flowchart-F-5" transform="translate(1252.6328125, 274)"><rect style="" x="-102.5859375" y="-55" width="205.171875" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-72.5859375, -40)"><rect></rect><foreignObject width="145.171875" height="80"><p>MemoryMiddleware<br>长期记忆</p></foreignObject></g></g><g id="flowchart-G-6" transform="translate(685.921875, 484)"><rect style="" x="-86" y="-55" width="172" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-56, -40)"><rect></rect><foreignObject width="112" height="80"><p>LangGraph<br>有向图执行引擎</p></foreignObject></g></g><g id="flowchart-H-7" transform="translate(685.921875, 656)"><rect style="" x="-130" y="-67" width="260" height="134" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-100, -52)"><rect></rect><foreignObject width="200" height="104"><p>各种 Backend<br>State/File/Store/Composite</p></foreignObject></g></g></g></g></g></svg>

这个设计极其聪明：

- **中间件层** 是核心创新点。它把 Agent 开发中那些"重复造轮子"的事情（任务拆解、文件管理、子任务派生）都给你封装好了。
- **Backend 抽象** 则解决了持久化的问题。你可以选择内存存储、本地文件系统，甚至是专门的云存储，换底层完全不需要改业务代码。

### 1.2 代码实战：一个会规划的研究 Agent

来，直接上代码。这是 DeepAgents 的 Hello World：

```python
from typing import Literal
from tavily import TavilyClient
from deepagents import create_deep_agent

# 第一步：定义你的工具
tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
):
    """Run a web search"""
    return tavily_client.search(query, max_results=max_results, topic=topic)

# 第二步：创建 Deep Agent
research_instructions = """
You are an expert researcher. Your job is to conduct thorough research
and then write a polished report.

You have access to an internet search tool as your primary means of gathering information.
"""

agent = create_deep_agent(
    tools=[internet_search],
    system_prompt=research_instructions,
    backend=FilesystemBackend(root_dir="./research_data")
)

# 第三步：运行
result = agent.invoke({
    "messages": [{
        "role": "user",
        "content": "What is LangGraph and why is it important for agents?"
    }]
})
```

就这么简单？是的。但神奇的是，这个 Agent 会自动做这些事：

1. **自动规划** ：内置的 `write_todos` 工具会把任务拆解成若干步骤
2. **自动存档** ：搜索结果太大时，会自动写到文件系统里避免 Token 溢出
3. **自动派生子任务** ：复杂任务会启动专门的子 Agent 处理
4. **自动汇总** ：最后把所有结果整合成一份报告

### 1.3 流程图：Agent 的自我进化

下面是 DeepAgents 处理复杂任务的完整流程：

<svg id="mermaid-1780242715944-1fpl5" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 1085px;" viewBox="-50 -10 1085 1055" role="graphics-document document" aria-roledescription="sequence"><g><rect x="835" y="969" fill="#eaeaea" stroke="#666" width="150" height="65" name="FS" rx="3" ry="3"></rect><text x="910" y="1001.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="910" dy="0">文件系统</tspan></text></g> <g><rect x="635" y="969" fill="#eaeaea" stroke="#666" width="150" height="65" name="SubAgent" rx="3" ry="3"></rect><text x="710" y="1001.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="710" dy="0">子 Agent</tspan></text></g> <g><rect x="435" y="969" fill="#eaeaea" stroke="#666" width="150" height="65" name="TodoList" rx="3" ry="3"></rect><text x="510" y="1001.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="510" dy="-8">TodoList</tspan></text> <text x="510" y="1001.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="510" dy="8">中间件</tspan></text></g> <g><rect x="235" y="969" fill="#eaeaea" stroke="#666" width="150" height="65" name="MainAgent" rx="3" ry="3"></rect><text x="310" y="1001.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="310" dy="0">主 Agent</tspan></text></g> <g><rect x="0" y="969" fill="#eaeaea" stroke="#666" width="150" height="65" name="User" rx="3" ry="3"></rect><text x="75" y="1001.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="75" dy="0">User</tspan></text></g> <g><line id="actor4" x1="910" y1="65" x2="910" y2="969" stroke-width="0.5px" stroke="#999" name="FS"></line><g id="root-4"><rect x="835" y="0" fill="#eaeaea" stroke="#666" width="150" height="65" name="FS" rx="3" ry="3"></rect><text x="910" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="910" dy="0">文件系统</tspan></text></g></g> <g><line id="actor3" x1="710" y1="65" x2="710" y2="969" stroke-width="0.5px" stroke="#999" name="SubAgent"></line><g id="root-3"><rect x="635" y="0" fill="#eaeaea" stroke="#666" width="150" height="65" name="SubAgent" rx="3" ry="3"></rect><text x="710" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="710" dy="0">子 Agent</tspan></text></g></g> <g><line id="actor2" x1="510" y1="65" x2="510" y2="969" stroke-width="0.5px" stroke="#999" name="TodoList"></line><g id="root-2"><rect x="435" y="0" fill="#eaeaea" stroke="#666" width="150" height="65" name="TodoList" rx="3" ry="3"></rect><text x="510" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="510" dy="-8">TodoList</tspan></text> <text x="510" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="510" dy="8">中间件</tspan></text></g></g> <g><line id="actor1" x1="310" y1="65" x2="310" y2="969" stroke-width="0.5px" stroke="#999" name="MainAgent"></line><g id="root-1"><rect x="235" y="0" fill="#eaeaea" stroke="#666" width="150" height="65" name="MainAgent" rx="3" ry="3"></rect><text x="310" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="310" dy="0">主 Agent</tspan></text></g></g> <g><line id="actor0" x1="75" y1="65" x2="75" y2="969" stroke-width="0.5px" stroke="#999" name="User"></line><g id="root-0"><rect x="0" y="0" fill="#eaeaea" stroke="#666" width="150" height="65" name="User" rx="3" ry="3"></rect><text x="75" y="32.5" dominant-baseline="central" alignment-baseline="central" style="text-anchor: middle; font-size: 16px; font-weight: 400; font-family: sans-serif;"><tspan x="75" dy="0">User</tspan></text></g></g> <g></g><defs><symbol id="computer" width="24" height="24"><path transform="scale(.5)" d="M2 2v13h20v-13h-20zm18 11h-16v-9h16v9zm-10.228 6l.466-1h3.524l.467 1h-4.457zm14.228 3h-24l2-6h2.104l-1.33 4h18.45l-1.297-4h2.073l2 6zm-5-10h-14v-7h14v7z"></path></symbol></defs><defs><symbol id="database" fill-rule="evenodd" clip-rule="evenodd"><path transform="scale(.5)" d="M12.258.001l.256.004.255.005.253.008.251.01.249.012.247.015.246.016.242.019.241.02.239.023.236.024.233.027.231.028.229.031.225.032.223.034.22.036.217.038.214.04.211.041.208.043.205.045.201.046.198.048.194.05.191.051.187.053.183.054.18.056.175.057.172.059.168.06.163.061.16.063.155.064.15.066.074.033.073.033.071.034.07.034.069.035.068.035.067.035.066.035.064.036.064.036.062.036.06.036.06.037.058.037.058.037.055.038.055.038.053.038.052.038.051.039.05.039.048.039.047.039.045.04.044.04.043.04.041.04.04.041.039.041.037.041.036.041.034.041.033.042.032.042.03.042.029.042.027.042.026.043.024.043.023.043.021.043.02.043.018.044.017.043.015.044.013.044.012.044.011.045.009.044.007.045.006.045.004.045.002.045.001.045v17l-.001.045-.002.045-.004.045-.006.045-.007.045-.009.044-.011.045-.012.044-.013.044-.015.044-.017.043-.018.044-.02.043-.021.043-.023.043-.024.043-.026.043-.027.042-.029.042-.03.042-.032.042-.033.042-.034.041-.036.041-.037.041-.039.041-.04.041-.041.04-.043.04-.044.04-.045.04-.047.039-.048.039-.05.039-.051.039-.052.038-.053.038-.055.038-.055.038-.058.037-.058.037-.06.037-.06.036-.062.036-.064.036-.064.036-.066.035-.067.035-.068.035-.069.035-.07.034-.071.034-.073.033-.074.033-.15.066-.155.064-.16.063-.163.061-.168.06-.172.059-.175.057-.18.056-.183.054-.187.053-.191.051-.194.05-.198.048-.201.046-.205.045-.208.043-.211.041-.214.04-.217.038-.22.036-.223.034-.225.032-.229.031-.231.028-.233.027-.236.024-.239.023-.241.02-.242.019-.246.016-.247.015-.249.012-.251.01-.253.008-.255.005-.256.004-.258.001-.258-.001-.256-.004-.255-.005-.253-.008-.251-.01-.249-.012-.247-.015-.245-.016-.243-.019-.241-.02-.238-.023-.236-.024-.234-.027-.231-.028-.228-.031-.226-.032-.223-.034-.22-.036-.217-.038-.214-.04-.211-.041-.208-.043-.204-.045-.201-.046-.198-.048-.195-.05-.19-.051-.187-.053-.184-.054-.179-.056-.176-.057-.172-.059-.167-.06-.164-.061-.159-.063-.155-.064-.151-.066-.074-.033-.072-.033-.072-.034-.07-.034-.069-.035-.068-.035-.067-.035-.066-.035-.064-.036-.063-.036-.062-.036-.061-.036-.06-.037-.058-.037-.057-.037-.056-.038-.055-.038-.053-.038-.052-.038-.051-.039-.049-.039-.049-.039-.046-.039-.046-.04-.044-.04-.043-.04-.041-.04-.04-.041-.039-.041-.037-.041-.036-.041-.034-.041-.033-.042-.032-.042-.03-.042-.029-.042-.027-.042-.026-.043-.024-.043-.023-.043-.021-.043-.02-.043-.018-.044-.017-.043-.015-.044-.013-.044-.012-.044-.011-.045-.009-.044-.007-.045-.006-.045-.004-.045-.002-.045-.001-.045v-17l.001-.045.002-.045.004-.045.006-.045.007-.045.009-.044.011-.045.012-.044.013-.044.015-.044.017-.043.018-.044.02-.043.021-.043.023-.043.024-.043.026-.043.027-.042.029-.042.03-.042.032-.042.033-.042.034-.041.036-.041.037-.041.039-.041.04-.041.041-.04.043-.04.044-.04.046-.04.046-.039.049-.039.049-.039.051-.039.052-.038.053-.038.055-.038.056-.038.057-.037.058-.037.06-.037.061-.036.062-.036.063-.036.064-.036.066-.035.067-.035.068-.035.069-.035.07-.034.072-.034.072-.033.074-.033.151-.066.155-.064.159-.063.164-.061.167-.06.172-.059.176-.057.179-.056.184-.054.187-.053.19-.051.195-.05.198-.048.201-.046.204-.045.208-.043.211-.041.214-.04.217-.038.22-.036.223-.034.226-.032.228-.031.231-.028.234-.027.236-.024.238-.023.241-.02.243-.019.245-.016.247-.015.249-.012.251-.01.253-.008.255-.005.256-.004.258-.001.258.001zm-9.258 20.499v.01l.001.021.003.021.004.022.005.021.006.022.007.022.009.023.01.022.011.023.012.023.013.023.015.023.016.024.017.023.018.024.019.024.021.024.022.025.023.024.024.025.052.049.056.05.061.051.066.051.07.051.075.051.079.052.084.052.088.052.092.052.097.052.102.051.105.052.11.052.114.051.119.051.123.051.127.05.131.05.135.05.139.048.144.049.147.047.152.047.155.047.16.045.163.045.167.043.171.043.176.041.178.041.183.039.187.039.19.037.194.035.197.035.202.033.204.031.209.03.212.029.216.027.219.025.222.024.226.021.23.02.233.018.236.016.24.015.243.012.246.01.249.008.253.005.256.004.259.001.26-.001.257-.004.254-.005.25-.008.247-.011.244-.012.241-.014.237-.016.233-.018.231-.021.226-.021.224-.024.22-.026.216-.027.212-.028.21-.031.205-.031.202-.034.198-.034.194-.036.191-.037.187-.039.183-.04.179-.04.175-.042.172-.043.168-.044.163-.045.16-.046.155-.046.152-.047.148-.048.143-.049.139-.049.136-.05.131-.05.126-.05.123-.051.118-.052.114-.051.11-.052.106-.052.101-.052.096-.052.092-.052.088-.053.083-.051.079-.052.074-.052.07-.051.065-.051.06-.051.056-.05.051-.05.023-.024.023-.025.021-.024.02-.024.019-.024.018-.024.017-.024.015-.023.014-.024.013-.023.012-.023.01-.023.01-.022.008-.022.006-.022.006-.022.004-.022.004-.021.001-.021.001-.021v-4.127l-.077.055-.08.053-.083.054-.085.053-.087.052-.09.052-.093.051-.095.05-.097.05-.1.049-.102.049-.105.048-.106.047-.109.047-.111.046-.114.045-.115.045-.118.044-.12.043-.122.042-.124.042-.126.041-.128.04-.13.04-.132.038-.134.038-.135.037-.138.037-.139.035-.142.035-.143.034-.144.033-.147.032-.148.031-.15.03-.151.03-.153.029-.154.027-.156.027-.158.026-.159.025-.161.024-.162.023-.163.022-.165.021-.166.02-.167.019-.169.018-.169.017-.171.016-.173.015-.173.014-.175.013-.175.012-.177.011-.178.01-.179.008-.179.008-.181.006-.182.005-.182.004-.184.003-.184.002h-.37l-.184-.002-.184-.003-.182-.004-.182-.005-.181-.006-.179-.008-.179-.008-.178-.01-.176-.011-.176-.012-.175-.013-.173-.014-.172-.015-.171-.016-.17-.017-.169-.018-.167-.019-.166-.02-.165-.021-.163-.022-.162-.023-.161-.024-.159-.025-.157-.026-.156-.027-.155-.027-.153-.029-.151-.03-.15-.03-.148-.031-.146-.032-.145-.033-.143-.034-.141-.035-.14-.035-.137-.037-.136-.037-.134-.038-.132-.038-.13-.04-.128-.04-.126-.041-.124-.042-.122-.042-.12-.044-.117-.043-.116-.045-.113-.045-.112-.046-.109-.047-.106-.047-.105-.048-.102-.049-.1-.049-.097-.05-.095-.05-.093-.052-.09-.051-.087-.052-.085-.053-.083-.054-.08-.054-.077-.054v4.127zm0-5.654v.011l.001.021.003.021.004.021.005.022.006.022.007.022.009.022.01.022.011.023.012.023.013.023.015.024.016.023.017.024.018.024.019.024.021.024.022.024.023.025.024.024.052.05.056.05.061.05.066.051.07.051.075.052.079.051.084.052.088.052.092.052.097.052.102.052.105.052.11.051.114.051.119.052.123.05.127.051.131.05.135.049.139.049.144.048.147.048.152.047.155.046.16.045.163.045.167.044.171.042.176.042.178.04.183.04.187.038.19.037.194.036.197.034.202.033.204.032.209.03.212.028.216.027.219.025.222.024.226.022.23.02.233.018.236.016.24.014.243.012.246.01.249.008.253.006.256.003.259.001.26-.001.257-.003.254-.006.25-.008.247-.01.244-.012.241-.015.237-.016.233-.018.231-.02.226-.022.224-.024.22-.025.216-.027.212-.029.21-.03.205-.032.202-.033.198-.035.194-.036.191-.037.187-.039.183-.039.179-.041.175-.042.172-.043.168-.044.163-.045.16-.045.155-.047.152-.047.148-.048.143-.048.139-.05.136-.049.131-.05.126-.051.123-.051.118-.051.114-.052.11-.052.106-.052.101-.052.096-.052.092-.052.088-.052.083-.052.079-.052.074-.051.07-.052.065-.051.06-.05.056-.051.051-.049.023-.025.023-.024.021-.025.02-.024.019-.024.018-.024.017-.024.015-.023.014-.023.013-.024.012-.022.01-.023.01-.023.008-.022.006-.022.006-.022.004-.021.004-.022.001-.021.001-.021v-4.139l-.077.054-.08.054-.083.054-.085.052-.087.053-.09.051-.093.051-.095.051-.097.05-.1.049-.102.049-.105.048-.106.047-.109.047-.111.046-.114.045-.115.044-.118.044-.12.044-.122.042-.124.042-.126.041-.128.04-.13.039-.132.039-.134.038-.135.037-.138.036-.139.036-.142.035-.143.033-.144.033-.147.033-.148.031-.15.03-.151.03-.153.028-.154.028-.156.027-.158.026-.159.025-.161.024-.162.023-.163.022-.165.021-.166.02-.167.019-.169.018-.169.017-.171.016-.173.015-.173.014-.175.013-.175.012-.177.011-.178.009-.179.009-.179.007-.181.007-.182.005-.182.004-.184.003-.184.002h-.37l-.184-.002-.184-.003-.182-.004-.182-.005-.181-.007-.179-.007-.179-.009-.178-.009-.176-.011-.176-.012-.175-.013-.173-.014-.172-.015-.171-.016-.17-.017-.169-.018-.167-.019-.166-.02-.165-.021-.163-.022-.162-.023-.161-.024-.159-.025-.157-.026-.156-.027-.155-.028-.153-.028-.151-.03-.15-.03-.148-.031-.146-.033-.145-.033-.143-.033-.141-.035-.14-.036-.137-.036-.136-.037-.134-.038-.132-.039-.13-.039-.128-.04-.126-.041-.124-.042-.122-.043-.12-.043-.117-.044-.116-.044-.113-.046-.112-.046-.109-.046-.106-.047-.105-.048-.102-.049-.1-.049-.097-.05-.095-.051-.093-.051-.09-.051-.087-.053-.085-.052-.083-.054-.08-.054-.077-.054v4.139zm0-5.666v.011l.001.02.003.022.004.021.005.022.006.021.007.022.009.023.01.022.011.023.012.023.013.023.015.023.016.024.017.024.018.023.019.024.021.025.022.024.023.024.024.025.052.05.056.05.061.05.066.051.07.051.075.052.079.051.084.052.088.052.092.052.097.052.102.052.105.051.11.052.114.051.119.051.123.051.127.05.131.05.135.05.139.049.144.048.147.048.152.047.155.046.16.045.163.045.167.043.171.043.176.042.178.04.183.04.187.038.19.037.194.036.197.034.202.033.204.032.209.03.212.028.216.027.219.025.222.024.226.021.23.02.233.018.236.017.24.014.243.012.246.01.249.008.253.006.256.003.259.001.26-.001.257-.003.254-.006.25-.008.247-.01.244-.013.241-.014.237-.016.233-.018.231-.02.226-.022.224-.024.22-.025.216-.027.212-.029.21-.03.205-.032.202-.033.198-.035.194-.036.191-.037.187-.039.183-.039.179-.041.175-.042.172-.043.168-.044.163-.045.16-.045.155-.047.152-.047.148-.048.143-.049.139-.049.136-.049.131-.051.126-.05.123-.051.118-.052.114-.051.11-.052.106-.052.101-.052.096-.052.092-.052.088-.052.083-.052.079-.052.074-.052.07-.051.065-.051.06-.051.056-.05.051-.049.023-.025.023-.025.021-.024.02-.024.019-.024.018-.024.017-.024.015-.023.014-.024.013-.023.012-.023.01-.022.01-.023.008-.022.006-.022.006-.022.004-.022.004-.021.001-.021.001-.021v-4.153l-.077.054-.08.054-.083.053-.085.053-.087.053-.09.051-.093.051-.095.051-.097.05-.1.049-.102.048-.105.048-.106.048-.109.046-.111.046-.114.046-.115.044-.118.044-.12.043-.122.043-.124.042-.126.041-.128.04-.13.039-.132.039-.134.038-.135.037-.138.036-.139.036-.142.034-.143.034-.144.033-.147.032-.148.032-.15.03-.151.03-.153.028-.154.028-.156.027-.158.026-.159.024-.161.024-.162.023-.163.023-.165.021-.166.02-.167.019-.169.018-.169.017-.171.016-.173.015-.173.014-.175.013-.175.012-.177.01-.178.01-.179.009-.179.007-.181.006-.182.006-.182.004-.184.003-.184.001-.185.001-.185-.001-.184-.001-.184-.003-.182-.004-.182-.006-.181-.006-.179-.007-.179-.009-.178-.01-.176-.01-.176-.012-.175-.013-.173-.014-.172-.015-.171-.016-.17-.017-.169-.018-.167-.019-.166-.02-.165-.021-.163-.023-.162-.023-.161-.024-.159-.024-.157-.026-.156-.027-.155-.028-.153-.028-.151-.03-.15-.03-.148-.032-.146-.032-.145-.033-.143-.034-.141-.034-.14-.036-.137-.036-.136-.037-.134-.038-.132-.039-.13-.039-.128-.041-.126-.041-.124-.041-.122-.043-.12-.043-.117-.044-.116-.044-.113-.046-.112-.046-.109-.046-.106-.048-.105-.048-.102-.048-.1-.05-.097-.049-.095-.051-.093-.051-.09-.052-.087-.052-.085-.053-.083-.053-.08-.054-.077-.054v4.153zm8.74-8.179l-.257.004-.254.005-.25.008-.247.011-.244.012-.241.014-.237.016-.233.018-.231.021-.226.022-.224.023-.22.026-.216.027-.212.028-.21.031-.205.032-.202.033-.198.034-.194.036-.191.038-.187.038-.183.04-.179.041-.175.042-.172.043-.168.043-.163.045-.16.046-.155.046-.152.048-.148.048-.143.048-.139.049-.136.05-.131.05-.126.051-.123.051-.118.051-.114.052-.11.052-.106.052-.101.052-.096.052-.092.052-.088.052-.083.052-.079.052-.074.051-.07.052-.065.051-.06.05-.056.05-.051.05-.023.025-.023.024-.021.024-.02.025-.019.024-.018.024-.017.023-.015.024-.014.023-.013.023-.012.023-.01.023-.01.022-.008.022-.006.023-.006.021-.004.022-.004.021-.001.021-.001.021.001.021.001.021.004.021.004.022.006.021.006.023.008.022.01.022.01.023.012.023.013.023.014.023.015.024.017.023.018.024.019.024.02.025.021.024.023.024.023.025.051.05.056.05.06.05.065.051.07.052.074.051.079.052.083.052.088.052.092.052.096.052.101.052.106.052.11.052.114.052.118.051.123.051.126.051.131.05.136.05.139.049.143.048.148.048.152.048.155.046.16.046.163.045.168.043.172.043.175.042.179.041.183.04.187.038.191.038.194.036.198.034.202.033.205.032.21.031.212.028.216.027.22.026.224.023.226.022.231.021.233.018.237.016.241.014.244.012.247.011.25.008.254.005.257.004.26.001.26-.001.257-.004.254-.005.25-.008.247-.011.244-.012.241-.014.237-.016.233-.018.231-.021.226-.022.224-.023.22-.026.216-.027.212-.028.21-.031.205-.032.202-.033.198-.034.194-.036.191-.038.187-.038.183-.04.179-.041.175-.042.172-.043.168-.043.163-.045.16-.046.155-.046.152-.048.148-.048.143-.048.139-.049.136-.05.131-.05.126-.051.123-.051.118-.051.114-.052.11-.052.106-.052.101-.052.096-.052.092-.052.088-.052.083-.052.079-.052.074-.051.07-.052.065-.051.06-.05.056-.05.051-.05.023-.025.023-.024.021-.024.02-.025.019-.024.018-.024.017-.023.015-.024.014-.023.013-.023.012-.023.01-.023.01-.022.008-.022.006-.023.006-.021.004-.022.004-.021.001-.021.001-.021-.001-.021-.001-.021-.004-.021-.004-.022-.006-.021-.006-.023-.008-.022-.01-.022-.01-.023-.012-.023-.013-.023-.014-.023-.015-.024-.017-.023-.018-.024-.019-.024-.02-.025-.021-.024-.023-.024-.023-.025-.051-.05-.056-.05-.06-.05-.065-.051-.07-.052-.074-.051-.079-.052-.083-.052-.088-.052-.092-.052-.096-.052-.101-.052-.106-.052-.11-.052-.114-.052-.118-.051-.123-.051-.126-.051-.131-.05-.136-.05-.139-.049-.143-.048-.148-.048-.152-.048-.155-.046-.16-.046-.163-.045-.168-.043-.172-.043-.175-.042-.179-.041-.183-.04-.187-.038-.191-.038-.194-.036-.198-.034-.202-.033-.205-.032-.21-.031-.212-.028-.216-.027-.22-.026-.224-.023-.226-.022-.231-.021-.233-.018-.237-.016-.241-.014-.244-.012-.247-.011-.25-.008-.254-.005-.257-.004-.26-.001-.26.001z"></path></symbol></defs><defs><symbol id="clock" width="24" height="24"><path transform="scale(.5)" d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.848 12.459c.202.038.202.333.001.372-1.907.361-6.045 1.111-6.547 1.111-.719 0-1.301-.582-1.301-1.301 0-.512.77-5.447 1.125-7.445.034-.192.312-.181.343.014l.985 6.238 5.394 1.011z"></path></symbol></defs><defs><marker id="arrowhead" refX="7.9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M -1 0 L 10 5 L 0 10 z"></path></marker></defs><defs><marker id="crosshead" markerWidth="15" markerHeight="8" orient="auto" refX="4" refY="4.5"><path fill="none" stroke="#000000" stroke-width="1pt" d="M 1,2 L 6,7 M 6,2 L 1,7" style="stroke-dasharray: 0, 0;"></path></marker></defs><defs><marker id="filled-head" refX="15.5" refY="7" markerWidth="20" markerHeight="28" orient="auto"><path d="M 18,7 L9,13 L14,7 L9,1 Z"></path></marker></defs><defs><marker id="sequencenumber" refX="15" refY="15" markerWidth="60" markerHeight="40" orient="auto"><circle cx="15" cy="15" r="6"></circle></marker></defs><g><rect x="285" y="484" fill="#EDF2AE" stroke="#666" width="650" height="43"></rect><text x="610" y="489" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;"><tspan x="610">结果太大，写入文件</tspan></text></g> <text x="191" y="80" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">"帮我研究 LangGraph"</text> <line x1="76" y1="121" x2="306" y2="121" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="409" y="136" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">调用 write_todos</text> <line x1="311" y1="177" x2="506" y2="177" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="412" y="192" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">任务拆解：</text> <text x="412" y="215" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">1. 搜索定义</text> <text x="412" y="237" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">2. 查看架构</text> <text x="412" y="260" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">3. 分析应用场景</text> <line x1="509" y1="302" x2="314" y2="302" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="stroke-dasharray: 3, 3; fill: none;"></line><text x="311" y="317" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">执行任务 1（搜索定义）</text> <path d="M 311,358 C 371,348 371,388 311,378" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></path><text x="311" y="403" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">执行任务 2（查看架构）</text> <path d="M 311,444 C 371,434 371,474 311,464" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></path><text x="609" y="542" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">write_file("langgraph_arch.md")</text> <line x1="311" y1="583" x2="906" y2="583" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="612" y="598" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">文件路径</text> <line x1="909" y1="639" x2="314" y2="639" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="stroke-dasharray: 3, 3; fill: none;"></line><text x="509" y="654" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">派生子任务：分析应用场景</text> <line x1="311" y1="695" x2="706" y2="695" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="512" y="710" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">分析报告</text> <line x1="709" y1="751" x2="314" y2="751" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="stroke-dasharray: 3, 3; fill: none;"></line><text x="409" y="766" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">更新待办列表</text> <line x1="311" y1="807" x2="506" y2="807" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></line><text x="311" y="822" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">综合所有结果</text> <path d="M 311,863 C 371,853 371,893 311,883" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="fill: none;"></path><text x="194" y="908" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="1em" style="font-family: sans-serif; font-size: 16px; font-weight: 400;">最终研究报告</text><line x1="309" y1="949" x2="79" y2="949" stroke-width="2" stroke="none" marker-end="url(#arrowhead)" style="stroke-dasharray: 3, 3; fill: none;"></line></svg>

### 1.4 2026 Q1 的三大新特性

LangChain 团队在最近几个月推出了几个重磅功能：

#### 特性一：Sandbox 隔离执行

这是 DeepAgents 最大的进步。以前 Agent 能操作文件系统，但这就带来了安全隐患——万一它删了你的生产代码怎么办？

现在支持了多种 Sandbox 后端：

```python
from langchain_modal import ModalSandbox
import modal

# 创建一个隔离的沙箱环境
app = modal.App.lookup("your-app")
modal_sandbox = modal.Sandbox.create(app=app)
backend = ModalSandbox(sandbox=modal_sandbox)

agent = create_deep_agent(
    system_prompt="You are a Python coding assistant with sandbox access.",
    backend=backend,  # 所有文件操作都在沙箱里，绝对不会影响本机
)

result = agent.invoke({
    "messages": [{
        "role": "user",
        "content": "Create a Python package and run pytest"
    }]
})

modal_sandbox.terminate()  # 用完就销毁
```

支持 Modal、Runloop、Daytona 三种沙箱。这对于需要 Agent 真正写代码、跑测试的场景来说，是革命性的。

#### 特性二：Human-in-the-loop 细粒度控制

Agent 的一个痛点是"不可控"。DeepAgents 现在可以针对不同工具设置不同级别的控制：

```python
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

@tool
def delete_file(path: str) -> str:
    """Delete a file from the filesystem."""
    return f"Deleted {path}"

@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email."""
    return f"Sent email to {to}"

checkpointer = MemorySaver()

agent = create_deep_agent(
    tools=[delete_file, send_email],
    interrupt_on={
        "delete_file": True,  # 审批通过/编辑/拒绝
        "send_email": {
            "allowed_decisions": ["approve", "reject"]  # 只能审批或拒绝，不能编辑
        },
    },
    checkpointer=checkpointer
)
```

你可以配置：

- 完全打断（需要人工审批）
- 仅审批（不能修改）
- 自动通过（默认）

#### 特性三：Structured Output 原生支持

不再需要自己写正则解析了。DeepAgents 现在直接支持 Pydantic schema，返回结构化数据：

```python
from pydantic import BaseModel, Field
from deepagents import create_deep_agent

class WeatherReport(BaseModel):
    """A structured weather report"""
    location: str = Field(description="Location for this report")
    temperature: float = Field(description="Temperature in Celsius")
    condition: str = Field(description="Weather condition")
    forecast: str = Field(description="24h forecast")

agent = create_deep_agent(
    response_format=WeatherReport,  # 强制返回这个结构
    tools=[internet_search]
)

result = agent.invoke({
    "messages": [{
        "role": "user",
        "content": "What's the weather in San Francisco?"
    }]
})

print(result["structured_response"])
# 输出：WeatherReport(location='San Francisco', temperature=18.3, ...)
```

---

## 二、Google ADK：多语言的"大厂范儿"

如果说 DeepAgents 是"Python 独角兽"，那 Google ADK 就是"多语言全能手"——它原生支持 Python、Go、Java、TypeScript 四种语言。

### 2.1 核心设计：极简主义 + 生态整合

Google ADK 的核心理念是： **不要重复造轮子** 。它不试图做一个"大而全"的框架，而是专注做三件事：

1. **统一接口** ：无论你用哪种语言，Agent 的定义方式都是一样的
2. **模型无关** ：支持 Google 自家的 Gemini，也支持 OpenAI、Anthropic 等
3. **生产就绪** ：直接集成 Vertex AI 的监控、部署能力

### 2.2 代码实战：30 秒跑通一个 Agent

```bash
# 第一步：安装
pip install google-adk

# 第二步：创建项目
adk create my_agent
cd my_agent

# 第三步：定义 Agent
```

```python
# my_agent/agent.py
from google.adk.agents.llm_agent import Agent

def get_current_time(city: str) -> dict:
    """Returns the current time in a specified city."""
    return {"status": "success", "city": city, "time": "10:30 AM"}

root_agent = Agent(
    model='gemini-3-flash-preview',
    name='root_agent',
    description="Tells the current time in a specified city.",
    instruction="You are a helpful assistant. Use 'get_current_time' tool.",
    tools=[get_current_time],
)

# 第四步：运行
adk run my_agent
# 或者启动 Web UI：adk web --port 8000
```

就这么简单。但 ADK 的真正威力在于 **多 Agent 协作** ：

```python
from google.adk.agents.llm_agent import Agent

# 定义子 Agent
researcher = Agent(
    name='researcher',
    instruction="You are a research assistant. Search for information.",
    tools=[search_tool]
)

writer = Agent(
    name='writer',
    instruction="You are a writer. Draft articles based on research.",
)

# 定义主 Agent，可以委托给子 Agent
root_agent = Agent(
    name='root_agent',
    instruction="You delegate tasks to researcher and writer.",
    delegation_targets=[researcher, writer]  # 委托目标
)
```

### 2.3 Agent 团队协作流程

<svg id="mermaid-1780242715959-528wj" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 855.75px;" viewBox="0 0 855.75 442" role="graphics-document document" aria-roledescription="flowchart-v2"><g><marker id="mermaid-1780242715959-528wj_flowchart-v2-pointEnd" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1780242715959-528wj_flowchart-v2-pointStart" viewBox="0 0 10 10" refX="4.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 5 L 10 10 L 10 0 z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1780242715959-528wj_flowchart-v2-circleEnd" viewBox="0 0 10 10" refX="11" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1780242715959-528wj_flowchart-v2-circleStart" viewBox="0 0 10 10" refX="-1" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" style="stroke-width: 1; stroke-dasharray: 1, 0;"></circle></marker><marker id="mermaid-1780242715959-528wj_flowchart-v2-crossEnd" viewBox="0 0 11 11" refX="12" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><marker id="mermaid-1780242715959-528wj_flowchart-v2-crossStart" viewBox="0 0 11 11" refX="-1" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" style="stroke-width: 2; stroke-dasharray: 1, 0;"></path></marker><g><g><g id="subGraph1" data-look="classic"><rect style="" x="8" y="274" width="680.75" height="160"></rect><g transform="translate(307.97265625, 274)"><foreignObject width="80.8046875" height="56"><p>Agent 团队</p></foreignObject></g></g><g id="subGraph0" data-look="classic"><rect style="" x="8" y="8" width="797.75" height="160"></rect><g transform="translate(364.84765625, 8)"><foreignObject width="84.0546875" height="56"><p>Root Agent</p></foreignObject></g></g></g><g><path d="M306.973,113.658L269.386,122.715C231.799,131.772,156.626,149.886,119.04,167.776C81.453,185.667,81.453,203.333,81.453,221C81.453,238.667,81.453,256.333,84.015,268.789C86.577,281.245,91.702,288.49,94.264,292.112L96.826,295.734" id="L_A_B_0" style=";" data-edge="true" data-et="edge" data-id="L_A_B_0" data-points="W3sieCI6MzA2Ljk3MjY1NjI1LCJ5IjoxMTMuNjU3OTQ0Mjc3MTA4NDR9LHsieCI6ODEuNDUzMTI1LCJ5IjoxNjh9LHsieCI6ODEuNDUzMTI1LCJ5IjoyMjF9LHsieCI6ODEuNDUzMTI1LCJ5IjoyNzR9LHsieCI6OTkuMTM1NjIwMTE3MTg3NSwieSI6Mjk5fV0=" marker-end="url(#mermaid-1780242715959-528wj_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M178.886,299L181.98,294.833C185.075,290.667,191.264,282.333,194.359,269.333C197.453,256.333,197.453,238.667,197.453,221C197.453,203.333,197.453,185.667,215.081,170.304C232.709,154.942,267.965,141.884,285.594,135.355L303.222,128.826" id="L_B_A_0" style=";" data-edge="true" data-et="edge" data-id="L_B_A_0" data-points="W3sieCI6MTc4Ljg4NTYyMDExNzE4NzUsInkiOjI5OX0seyJ4IjoxOTcuNDUzMTI1LCJ5IjoyNzR9LHsieCI6MTk3LjQ1MzEyNSwieSI6MjIxfSx7IngiOjE5Ny40NTMxMjUsInkiOjE2OH0seyJ4IjozMDYuOTcyNjU2MjUsInkiOjEyNy40MzcyMTA2NDgxNDgxNX1d" marker-end="url(#mermaid-1780242715959-528wj_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M344.703,143L339.495,147.167C334.286,151.333,323.87,159.667,318.661,172.667C313.453,185.667,313.453,203.333,313.453,221C313.453,238.667,313.453,256.333,315.704,268.768C317.955,281.203,322.456,288.405,324.707,292.007L326.958,295.608" id="L_A_C_0" style=";" data-edge="true" data-et="edge" data-id="L_A_C_0" data-points="W3sieCI6MzQ0LjcwMzEyNSwieSI6MTQzfSx7IngiOjMxMy40NTMxMjUsInkiOjE2OH0seyJ4IjozMTMuNDUzMTI1LCJ5IjoyMjF9LHsieCI6MzEzLjQ1MzEyNSwieSI6Mjc0fSx7IngiOjMyOS4wNzgxMjUsInkiOjI5OX1d" marker-end="url(#mermaid-1780242715959-528wj_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M397.828,299L400.432,294.833C403.036,290.667,408.245,282.333,410.849,269.333C413.453,256.333,413.453,238.667,413.453,221C413.453,203.333,413.453,185.667,413.453,173.333C413.453,161,413.453,154,413.453,150.5L413.453,147" id="L_C_A_0" style=";" data-edge="true" data-et="edge" data-id="L_C_A_0" data-points="W3sieCI6Mzk3LjgyODEyNSwieSI6Mjk5fSx7IngiOjQxMy40NTMxMjUsInkiOjI3NH0seyJ4Ijo0MTMuNDUzMTI1LCJ5IjoyMjF9LHsieCI6NDEzLjQ1MzEyNSwieSI6MTY4fSx7IngiOjQxMy40NTMxMjUsInkiOjE0M31d" marker-end="url(#mermaid-1780242715959-528wj_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M482.203,143L487.411,147.167C492.62,151.333,503.036,159.667,508.245,172.667C513.453,185.667,513.453,203.333,513.453,221C513.453,238.667,513.453,256.333,516.015,268.789C518.577,281.245,523.702,288.49,526.264,292.112L528.826,295.734" id="L_A_D_0" style=";" data-edge="true" data-et="edge" data-id="L_A_D_0" data-points="W3sieCI6NDgyLjIwMzEyNSwieSI6MTQzfSx7IngiOjUxMy40NTMxMjUsInkiOjE2OH0seyJ4Ijo1MTMuNDUzMTI1LCJ5IjoyMjF9LHsieCI6NTEzLjQ1MzEyNSwieSI6Mjc0fSx7IngiOjUzMS4xMzU2MjAxMTcxODc1LCJ5IjoyOTl9XQ==" marker-end="url(#mermaid-1780242715959-528wj_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M610.886,299L613.98,294.833C617.075,290.667,623.264,282.333,626.359,269.333C629.453,256.333,629.453,238.667,629.453,221C629.453,203.333,629.453,185.667,611.825,170.304C594.197,154.942,558.941,141.884,541.313,135.355L523.685,128.826" id="L_D_A_0" style=";" data-edge="true" data-et="edge" data-id="L_D_A_0" data-points="W3sieCI6NjEwLjg4NTYyMDExNzE4NzUsInkiOjI5OX0seyJ4Ijo2MjkuNDUzMTI1LCJ5IjoyNzR9LHsieCI6NjI5LjQ1MzEyNSwieSI6MjIxfSx7IngiOjYyOS40NTMxMjUsInkiOjE2OH0seyJ4Ijo1MTkuOTMzNTkzNzUsInkiOjEyNy40MzcyMTA2NDgxNDgxNX1d" marker-end="url(#mermaid-1780242715959-528wj_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path><path d="M519.934,110.881L564.236,120.401C608.539,129.921,697.145,148.96,741.447,167.313C785.75,185.667,785.75,203.333,785.75,221C785.75,238.667,785.75,256.333,785.75,270.667C785.75,285,785.75,296,785.75,301.5L785.75,307" id="L_A_E_0" style=";" data-edge="true" data-et="edge" data-id="L_A_E_0" data-points="W3sieCI6NTE5LjkzMzU5Mzc1LCJ5IjoxMTAuODgwNzY1NTE4MTA5NzF9LHsieCI6Nzg1Ljc1LCJ5IjoxNjh9LHsieCI6Nzg1Ljc1LCJ5IjoyMjF9LHsieCI6Nzg1Ljc1LCJ5IjoyNzR9LHsieCI6Nzg1Ljc1LCJ5IjozMTF9XQ==" marker-end="url(#mermaid-1780242715959-528wj_flowchart-v2-pointEnd)" fill="none" stroke="currentColor"></path></g><g><g transform="translate(81.453125, 221)"><g data-id="L_A_B_0" transform="translate(-48, -28)"><foreignObject width="96" height="56"><p>委托研究任务</p></foreignObject></g></g><g transform="translate(197.453125, 221)"><g data-id="L_B_A_0" transform="translate(-48, -28)"><foreignObject width="96" height="56"><p>返回研究资料</p></foreignObject></g></g><g transform="translate(313.453125, 221)"><g data-id="L_A_C_0" transform="translate(-48, -28)"><foreignObject width="96" height="56"><p>委托写作任务</p></foreignObject></g></g><g transform="translate(413.453125, 221)"><g data-id="L_C_A_0" transform="translate(-32, -28)"><foreignObject width="64" height="56"><p>返回草稿</p></foreignObject></g></g><g transform="translate(513.453125, 221)"><g data-id="L_A_D_0" transform="translate(-48, -28)"><foreignObject width="96" height="56"><p>委托审稿任务</p></foreignObject></g></g><g transform="translate(629.453125, 221)"><g data-id="L_D_A_0" transform="translate(-48, -28)"><foreignObject width="96" height="56"><p>返回审稿意见</p></foreignObject></g></g><g transform="translate(785.75, 221)"><g data-id="L_A_E_0" transform="translate(-32, -28)"><foreignObject width="64" height="56"><p>最终整合</p></foreignObject></g></g></g><g><g id="flowchart-A-0" transform="translate(413.453125, 88)"><rect style="" x="-106.48046875" y="-55" width="212.9609375" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-76.48046875, -40)"><rect></rect><foreignObject width="152.9609375" height="80"><p>用户请求<br>写一篇关于 AI 的文章</p></foreignObject></g></g><g id="flowchart-B-1" transform="translate(138.037109375, 354)"><rect style="" x="-71.90625" y="-55" width="143.8125" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-41.90625, -40)"><rect></rect><foreignObject width="83.8125" height="80"><p>Researcher<br>研究员</p></foreignObject></g></g><g id="flowchart-C-2" transform="translate(363.453125, 354)"><rect style="" x="-52.609375" y="-55" width="105.21875" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-22.609375, -40)"><rect></rect><foreignObject width="45.21875" height="80"><p>Writer<br>写手</p></foreignObject></g></g><g id="flowchart-D-3" transform="translate(570.037109375, 354)"><rect style="" x="-63.59375" y="-55" width="127.1875" height="110" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-33.59375, -40)"><rect></rect><foreignObject width="67.1875" height="80"><p>Reviewer<br>审稿人</p></foreignObject></g></g><g id="flowchart-E-17" transform="translate(785.75, 354)"><rect style="" x="-62" y="-43" width="124" height="86" fill="none" stroke="currentColor"></rect><g style="" transform="translate(-32, -28)"><rect></rect><foreignObject width="64" height="56"><p>最终文章</p></foreignObject></g></g></g></g></g></svg>

这种"Agent 团队"模式在 ADK 里是原生支持的。每个 Agent 都可以有自己的工具、指令，甚至使用不同的模型。

### 2.4 Google ADK 的特性

Google ADK 虽然发布相对较晚，但进步很快：

#### 特性一：安全回调机制

企业最担心的是 Agent "失控"。你可以在调用工具之前自行实现参数校验：

```python
# Hypothetical callback function
def validate_tool_params(
    callback_context: CallbackContext, # Correct context type
    tool: BaseTool,
    args: Dict[str, Any],
    tool_context: ToolContext
    ) -> Optional[Dict]: # Correct return type for before_tool_callback

  print(f"Callback triggered for tool: {tool.name}, args: {args}")

  # Example validation: Check if a required user ID from state matches an arg
  expected_user_id = callback_context.state.get("session_user_id")
  actual_user_id_in_args = args.get("user_id_param") # Assuming tool takes 'user_id_param'

  if actual_user_id_in_args != expected_user_id:
      print("Validation Failed: User ID mismatch!")
      # Return a dictionary to prevent tool execution and provide feedback
      return {"error": f"Tool call blocked: User ID mismatch."}

  # Return None to allow the tool call to proceed if validation passes
  print("Callback validation passed.")
  return None

# Hypothetical Agent setup
root_agent = LlmAgent( # Use specific agent type
    model='gemini-2.0-flash',
    name='root_agent',
    instruction="...",
    before_tool_callback=validate_tool_params, # Assign the callback
    tools = [
      # ... list of tool functions or Tool instances ...
      # e.g., query_tool_instance
    ]
)
```

#### 特性二：企业级部署支持

这是 ADK 相比其他框架的独特优势。它直接集成到 Vertex AI，你可以：

- 一键部署到 Google Cloud
- 自动监控 Agent 的调用指标
- 设置配额和限流
- A/B 测试不同版本的 Agent

## 三、Claude Agent SDK：代码库自动化专家

Claude Agent SDK 是 Anthropic 推出的官方 Agent 框架，让 Claude 能够自主读写文件、运行命令、搜索代码。它提供了和 Claude Code 相同的工具、Agent 循环和上下文管理能力，可以通过 Python 和 TypeScript 编程使用。

### 3.1 核心定位

Claude Agent SDK 的核心定位是： **让 Claude 自主处理代码库和文件系统任务** 。

**与传统 Client SDK 的区别：**

```python
# Client SDK：你需要自己实现工具循环
response = client.messages.create(...)
while response.stop_reason == "tool_use":
    result = your_tool_executor(response.tool_use)
    response = client.messages.create(tool_result=result, **params)

# Agent SDK：Claude 自主处理工具调用
async for message in query(prompt="Fix the bug in auth.py"):
    print(message)
```

### 3.2 内置工具（开箱即用）

Claude Agent SDK 包含丰富的内置工具：

| 工具 | 功能 |
| --- | --- |
| **Read** | 读取工作目录中的任何文件 |
| **Write** | 创建新文件 |
| **Edit** | 对现有文件进行精确编辑 |
| **Bash** | 运行终端命令、脚本、git 操作 |
| **Glob** | 按模式查找文件（ `**/*.ts` 、 `src/**/*.py` ） |
| **Grep** | 用正则搜索文件内容 |
| **WebSearch** | 搜索网页获取最新信息 |
| **WebFetch** | 获取并解析网页内容 |
| **AskUserQuestion** | 向用户提出有选项的澄清问题 |

**示例：代码审查 Agent**

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Find all TODO comments and create a summary",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Glob", "Grep"]),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

### 3.3 核心扩展能力

#### Hooks：生命周期钩子

在 Agent 生命周期的关键点运行自定义代码，用于验证、日志、拦截或转换 Agent 行为。

**可用的钩子：** `PreToolUse` 、 `PostToolUse` 、 `Stop` 、 `SessionStart` 、 `SessionEnd` 、 `UserPromptSubmit` 等。

**示例：记录所有文件变更到审计日志**

```python
import asyncio
from datetime import datetime
from claude_agent_sdk import query, ClaudeAgentOptions, HookMatcher

async def log_file_change(input_data, tool_use_id, context):
    file_path = input_data.get("tool_input", {}).get("file_path", "unknown")
    with open("./audit.log", "a") as f:
        f.write(f"{datetime.now()}: modified {file_path}\n")
    return {}

async def main():
    async for message in query(
        prompt="Refactor utils.py to improve readability",
        options=ClaudeAgentOptions(
            permission_mode="acceptEdits",
            hooks={
                "PostToolUse": [
                    HookMatcher(matcher="Edit|Write", hooks=[log_file_change])
                ]
            },
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

#### Subagents：子 Agent 系统

派生专门的 Agent 来处理聚焦的子任务。主 Agent 委托工作，子 Agent 返回结果。

**示例：定义一个代码审查 Agent**

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

async def main():
    async for message in query(
        prompt="Use the code-reviewer agent to review this codebase",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob", "Grep", "Task"],
            agents={
                "code-reviewer": AgentDefinition(
                    description="Expert code reviewer for quality and security reviews.",
                    prompt="Analyze code quality and suggest improvements.",
                    tools=["Read", "Glob", "Grep"],
                )
            },
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

#### MCP：外部系统集成

通过 Model Context Protocol 连接外部系统：数据库、浏览器、API 等。

**示例：通过 Playwright 实现浏览器自动化**

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Open example.com and describe what you see",
        options=ClaudeAgentOptions(
            mcp_servers={
                "playwright": {"command": "npx", "args": ["@playwright/mcp@latest"]}
            }
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

**支持的 MCP 服务器：**

- Playwright（浏览器自动化）
- PostgreSQL、MySQL（数据库）
- Slack、GitHub、Jira（API 集成）
- 数百种其他服务器： [https://github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)

#### Sessions：会话管理

跨多次交换维护上下文。Claude 记住读取的文件、做过的分析、对话历史。可以稍后恢复会话，或分叉会话以探索不同的方法。

**示例：捕获会话 ID 并恢复**

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    session_id = None

    # 第一次查询：捕获会话 ID
    async for message in query(
        prompt="Read the authentication module",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Glob"]),
    ):
        if hasattr(message, "subtype") and message.subtype == "init":
            session_id = message.session_id

    # 恢复会话，保持完整上下文
    async for message in query(
        prompt="Now find all places that call it",  # "it" = auth module
        options=ClaudeAgentOptions(resume=session_id),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

#### Permissions：权限控制

精确控制 Agent 可以使用哪些工具。允许安全操作、阻止危险操作，或对敏感操作要求批准。

**示例：创建只读 Agent**

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Review this code for best practices",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob", "Grep"],
            permission_mode="bypassPermissions"
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

### 3.4 适用场景

Claude Agent SDK 最适合这些场景：

1. **代码重构与审查** ：搜索代码库、优化代码结构、审查代码质量
2. **Bug 修复** ：定位问题、修改代码、运行测试
3. **文档生成** ：读取代码、生成文档、更新 README
4. **自动化任务** ：批量处理文件、运行脚本、执行 CI/CD 任务
5. **研究与调查** ：搜索网页、整理信息、生成报告

---

## 四、Agent 研发的发展趋势

从这三个框架的迭代中，我们可以看到几个明显的趋势：

### 趋势一：从"单点智能"到"团队协作"

以前一个 Agent 包打天下的时代已经结束了。现在流行的是 **"Agent 团队"模式** ——每个 Agent 专精一个领域，通过协作完成任务。

DeepAgents 的 Subagent 机制、Claude Agent SDK 的 Subagents 功能，都是这种思想的体现。

### 趋势二：从"玩具"到"生产级"

安全、持久化、监控，这些在以前还属于"高级功能"的东西，现在已经是标配了。

- **Sandbox 隔离** （DeepAgents）
- **Sessions 会话管理** （Claude Agent SDK）
- **Hooks 生命周期钩子** （Claude Agent SDK）
- **企业级部署** （Google ADK）

这些功能的出现，标志着 Agent 已经准备好进入生产环境了。

### 趋势三：从"Prompt 工程"到"架构工程"

以前的 Agent 开发是：写好 Prompt，调调参数，差不多了。

现在的 Agent 开发是：

- 设计 Agent 的架构（单 Agent vs 多 Agent 团队）
- 设计工具链和扩展能力
- 设计数据流和状态管理
- 设计安全和审核机制

**Prompt 只是其中的一小部分。**

### 趋势四：从"通用"到"垂直化"

虽然这三个框架都是通用的，但它们都在往"垂直化"发展：

- DeepAgents 提供了 **Skills 机制** ，可以让 Agent "学"特定领域的知识
- Google ADK 提供了 **多语言支持** ，适合不同技术栈的团队
- Claude Agent SDK 专注于 **代码库自动化** 和 **文件系统操作**

未来，我们可能会看到更多"开箱即用"的垂直 Agent 框架。

---

## 五、怎么选？

简单来说：

1. **Python 主打、需要任务规划和文件管理** ：选 **DeepAgents**
2. **多语言团队、企业级部署** ：选 **Google ADK**
3. **代码库自动化、Bug 修复、重构** ：选 **Claude Agent SDK**
4. **要极致控制、自己造轮子** ：选 **LangGraph**

但最关键的已经不是"选哪个框架"了，而是" **你的 Agent 需要解决什么问题** "。框架只是工具，真正决定成败的是你的架构设计能力。

Agent 的时代才刚刚开始。🚀

---

## 参考文档

- **DeepAgents**: [https://docs.langchain.com/oss/python/deepagents/overview](https://docs.langchain.com/oss/python/deepagents/overview)
- **Google ADK**: [https://google.github.io/adk-docs/get-started/](https://google.github.io/adk-docs/get-started/)
- **Claude Agent SDK**: [https://platform.claude.com/docs/en/agent-sdk/overview](https://platform.claude.com/docs/en/agent-sdk/overview)

END

2026 Agent 框架大爆发：深度解析三大框架的架构进化

一、DeepAgents：开箱即用的"数字管家"

1.1 核心架构：三层设计

1.2 代码实战：一个会规划的研究 Agent

1.3 流程图：Agent 的自我进化

1.4 2026 Q1 的三大新特性

特性一：Sandbox 隔离执行

特性二：Human-in-the-loop 细粒度控制

特性三：Structured Output 原生支持

二、Google ADK：多语言的"大厂范儿"

2.1 核心设计：极简主义 + 生态整合

2.2 代码实战：30 秒跑通一个 Agent

2.3 Agent 团队协作流程

2.4 Google ADK 的特性

特性一：安全回调机制

特性二：企业级部署支持

三、Claude Agent SDK：代码库自动化专家

3.1 核心定位

3.2 内置工具（开箱即用）

3.3 核心扩展能力

Hooks：生命周期钩子

Subagents：子 Agent 系统

MCP：外部系统集成

Sessions：会话管理

Permissions：权限控制

3.4 适用场景

四、Agent 研发的发展趋势

趋势一：从"单点智能"到"团队协作"

趋势二：从"玩具"到"生产级"

趋势三：从"Prompt 工程"到"架构工程"

趋势四：从"通用"到"垂直化"

五、怎么选？

参考文档

**

**

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
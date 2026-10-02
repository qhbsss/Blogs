---
title: "LangChain新项目 DeepAgents 源码分析和思考"
source: "https://ata.atatech.org/articles/12020485204?spm=ata.23639746.0.0.40ce237dzIFDFW"
author:
published:
created: 2026-05-31
description:
tags:
  - "clippings"
---
蚂蚁集团

粉丝 3影响力 139

** 19

** 23

** 3

** 原创文章

发表到圈儿

[蚂蚁数智引擎技术部](https://ata.atatech.org/community/team/716) (首发)

[安全大数据技术](https://ata.atatech.org/community/team/100051)

**

[刘萌(浅斟)](https://ata.atatech.org/users/12000203476)

2025-10-12发表2025-10-13更新549次浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章15:19

**

## 前言

DeepAgents是LangChain的CEO Harrison Chase 在25年8月左右个人写的一个框架，开始是他周末时间写的Demo project（没错，CEO亲自写代码），现在已经放入了LangChain的官方Git，算是进入公司的主分支了，已经获得了4.2K stars， 并且一直在保持更新。

Harrison在 [博客](https://blog.langchain.com/deep-agents/) 中提到，他受到了Claude Code的启发，他发现人们使用Claude Code可以完成除了Coding之外的一些事情，于是想到了Claude Code的设计理念是通用的，他抽象并概括了Claude Code的重要特性。可以说，DeepAgents代表了一种Agents的设计思想，蚂蚁内部的Agent平台新发布的 [规划智能体](https://yuque.antfin.com/red1p5/agent/qqz28n3pvidqt2d0) 也借鉴了这种思想。尽管DeepAgents这个项目还不是很完善，不能直接拿来在生产环境中使用，但是用来学习和理解深度智能体是挺不错的 ~

结合我使用过OpenManus、Coze、n8n和蚂蚁灵矽， 我们从目标、方案、现状和RoadMap来分析一下DeepAgents这个项目。

## 项目目标

用互联网黑化总结，项目提出并验证了一个深度智能体的设计的通用范式。Harrison提出，当今最常用的智能体架构是使用 LLM 循环调用工具，这虽然这种方法适用于简单任务，但当面对需要规划、上下文管理和在更长的时间范围内持续执行的多步骤挑战时，它就不够用了，下面是常见的React Agent：

![[d9c2dac6-a418-43b2-83ee-bcdf8c77a5cd.png]]

Harrison在研究了Claude Code、OpenAI Deep Research 和来自中国的Manus 三个成功的智能体之后，对比了这类“深度智能体”和 “简单智能体” 的根本区别，提出了“深度智能体”的四大要素，具备这四个关键特征的智能体就可以叫做“深度智能体”：

![[32c75a76-4cbc-43ea-a032-eb81d8e51656.png]] ●

规划能力：可以将大型任务分解为可管理的子任务，并根据工作进展调整计划。别想的太高大上哈，这个规划能力的实现其实可以非常简单~ Claude Code 使用 [Todo 列表工具](https://claudelog.com/faqs/what-is-todo-list-in-claude-code/?ref=blog.langchain.com) ， 实际上是一个空操作 (no-op)，它只是一种让智能体保持正轨的上下文工程策略。而DeepAgents里面更加简单，仅仅使用了一个Markdown列表，存储在虚拟文件系统中。

●

Sub-agent: 子Agent委派，深度代理可以启动专门的子代理来处理任务的重点部分。子Agent可以带来几个明显的好处：专注于子任务，消耗更多的token（思考更充分），DeepAgents里提出了一个对我而言很新颖的观点：子Agent的使用可以避免“上下文污染”，在Claude Code中更加极端的，子Agent不能访问主Agent的上下文，子 Agent 拥有自己独立的上下文窗口，与主 Agent 的上下文是隔离的。收到主Agent指令后，子Agent只会把最终、精炼、结构化的结果返回给主 Agent，主Agent将其添加到上下文中。

●

文件系统：这是一个“划时代”的重要概念，根据需要持久化和检索信息，实现了超越单个对话轮次的真正“记忆”。Claude Code 可以访问文件系统以完成任务和记笔记，它也作为所有智能体协作的共享工作区。 [Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus?ref=blog.langchain.com) 也大量使用文件系统作为记忆。文件系统实现“引用”+“读写”机制代替完整上下文传递，可以减轻LLM的上下文负担。这个共享文件系统就像团队白板或项目文档库，记录了项目最终目标、计划&进度、中间产物。

●

复杂系统提示词：深度智能体遵循明确的流程以确保一致性和可靠性，同时执行复杂的指令和示例。虽然模型的能力在增强，但是复杂任务中仍然需要数百甚至上千行提示词，包含明确定义工具使用规则、任务目标、期望行为、停止条件等等包含全栈逻辑知道，而非简化语言。

按照四大要素的设计思想，Harrison参考了 Claude Code 并使其更加通用，于是有了DeepAgents的项目。

## 核心组件源码分析

## 规划工具

Harrison参考了Claude Code用Todo list做规划工具，就是把任务写到文件系统(markdown文件)中。这个方法非常简单，早先cursor里面也用markdown记录一些事情，但是Claude Code是把Todo list放入到文件系统中。当你在处理任务时，Claude Code 会自动创建和更新待办事项列表。

待办事项有三个状态：待办（未开始）、进行中（当前正在工作）和已完成（已完成）。

class PlanningMiddleware(AgentMiddleware):

state\_schema = PlanningState

tools = \[write\_todos\]

def modify\_model\_request(self, request: ModelRequest, agent\_state: PlanningState, runtime: Runtime) -> ModelRequest:

request.system\_prompt = request.system\_prompt + "\\n\\n" + WRITE\_TODOS\_SYSTEM\_PROMPT

return request

## 子代理

在DeepAgents里，Harrison仅仅使用了一个字典类型定义子Agent。这里说一下子Agent和工具的区别。我的理解其实本质上是一样的，子Agent在父Agent眼里就是一个工具，但是子Agent用了LLM所以能力更加强大，而且子Agent之间可以用协议做数据交换，极大的拓展了工具的能力边界。

class SubAgent(TypedDict):

name: str

description: str

prompt: str

tools: NotRequired\[list\[str\]\]

model: NotRequired\[Union\[LanguageModelLike, dict\[str, Any\]\]\]

middleware: NotRequired\[list\[AgentMiddleware\]\]

class CustomSubAgent(TypedDict):

name: str

description: str

graph: Runnable

这里看到一个中间件的概念，这个概念是LangChain新提出来的概念，这里不展开了~ 感兴趣的可以读一读官方的文档 [https://docs.langchain.com/oss/python/langchain/middleware](https://docs.langchain.com/oss/python/langchain/middleware)

子代理的使用

research\_subagent = {

"name": "research-agent",

"description": "Used to research more in depth questions",

"prompt": sub\_research\_prompt,

"tools": \[internet\_search\]

}

subagents = \[research\_subagent\]

agent = create\_deep\_agent(

tools,

prompt,

subagents=subagents

)

#### 自定义子代理

对于更复杂的使用场景，可以提供自己的预构建 LangGraph 图作为子代理：

from langchain.agents import create\_agent

\# Create a custom agent graph

custom\_graph = create\_agent(

model=your\_model,

tools=specialized\_tools,

prompt="You are a specialized agent for data analysis..."

)

\# Use it as a custom subagent

custom\_subagent = {

"name": "data-analyzer",

"description": "Specialized agent for complex data analysis tasks",

"graph": custom\_graph

}

subagents = \[custom\_subagent\]

agent = create\_deep\_agent(

tools,

prompt,

subagents=subagents

)

子代理的设计Harrison也沿用了上下文隔离的思想，这里也不展开，有兴趣可以参考以下文档： [https://www.dbreunig.com/2025/06/26/how-to-fix-your-context.html#context-quarantine](https://www.dbreunig.com/2025/06/26/how-to-fix-your-context.html#context-quarantine)

## 文件系统

目前Harrison使用的实际不是真的文件系统，而是LangGraph的State对象模拟一个文件系统。这样有一个好处，可以在同一台机器上轻松运行许多这些代理，而不用担心它们会编辑相同的底层文件。

目前，“文件系统”只有一级深度（没有子目录）。

文件系统的Tools列表如下：

●

`write_todos`: 用于编写待办事项的工具

●

`write_file`: 用于在虚拟文件系统中写入文件的工具

●

`read_file`:虚拟文件系统中读取文件的工具

●

`ls`: 虚拟文件系统中列出文件的工具

●

`edit_file`:虚拟文件系统中编辑文件的工具

## 系统提示词

毫无疑问，系统提示词是非常重要的，详细的提示词不代表冗余和低效，在当前的模型能力基础上，详细的提示词还是非常关键的，尤其是和上下文工程相互配合才可以发挥Agent的能力。我在开发agent的时候也花大量精力打磨提示词。哈哈，harrison直接在博客宣布，他的系统提示词大部分都是copy的Claude Code的系统提示词，可谓真实不装。

DEEP\_AGENT\_SYSTEM\_PROMPT = """

You are an expert research assistant capable of conducting thorough,

multi-step investigations. Your capabilities include:

PLANNING: Break complex tasks into subtasks using the todo\_write tool

RESEARCH: Use internet\_search extensively to gather comprehensive information

DELEGATION: Spawn sub-agents for specialized tasks using the call\_subagent tool

DOCUMENTATION: Maintain detailed notes using the file system tools

When approaching a complex task:

1\. First, create a plan using todo\_write

2\. Research systematically, saving important findings to files

3\. Delegate specialized work to appropriate sub-agents

4\. Synthesize findings into a comprehensive response

Examples:

\[Detailed few-shot examples follow...\]

"""

## 人机协同

DeepAgents 支持人机协同的执行审批， 可以配置特定的工具，在执行前需要人工审批。在tool\_configs里面加入allow\_respond、allow\_edit、allow\_accept三个参数。

from deepagents import create\_deep\_agent

from langgraph.checkpoint.memory import InMemorySaver

\# Create agent with file operations requiring approval

agent = create\_deep\_agent(

tools=\[your\_tools\],

instructions="Your instructions here",

tool\_configs={

\# You can specify a dictionary for fine grained control over what interrupt options exist

"tool\_1": {

"allow\_respond": True,

"allow\_edit": True,

"allow\_accept":True,

},

\# You can specify a boolean for shortcut

\# This is a shortcut for the same functionality as above

"tool\_2": True,

}

)

checkpointer= InMemorySaver()

agent.checkpointer = checkpointer

## MCP

DeepAgents库可以和MCP工具一起运行，通过langchain\_mcp\_adapters库来实现。

import asyncio

from langchain\_mcp\_adapters.client import MultiServerMCPClient

from deepagents import create\_deep\_agent

async def main():

\# Collect MCP tools

mcp\_client = MultiServerMCPClient(...)

mcp\_tools = await mcp\_client.get\_tools()

\# Create agent

agent = async\_create\_deep\_agent(tools=mcp\_tools,....)

\# Stream the agent

async for chunk in agent.astream(

{"messages": \[{"role": "user", "content": "what is langgraph?"}\]},

stream\_mode="values"

):

if "messages" in chunk:

chunk\["messages"\]\[-1\].pretty\_print()

asyncio.run(main())

## 使用案例

使用起来可以说非常的简单：

import os

from typing import Literal

from tavily import TavilyClient

from deepagents import create\_deep\_agent

tavily\_client = TavilyClient(api\_key=os.environ\["TAVILY\_API\_KEY"\])

\# Search tool to use to do research

def internet\_search(

query: str,

max\_results: int = 5,

topic: Literal\["general", "news", "finance"\] = "general",

include\_raw\_content: bool = False,

):

"""Run a web search"""

return tavily\_client.search(

query,

max\_results=max\_results,

include\_raw\_content=include\_raw\_content,

topic=topic,

)

\# Prompt prefix to steer the agent to be an expert researcher

research\_instructions = """You are an expert researcher. Your job is to conduct thorough research, and then write a polished report.

You have access to a few tools.

\## \`internet\_search\`

Use this to run an internet search for a given query. You can specify the number of results, the topic, and whether raw content should be included.

"""

\# Create the agent

agent = create\_deep\_agent(

\[internet\_search\],

代码仓库examples/research/research\_agent.py 是一个更复杂的示例。

## 路线图

Harrison 给出了项目的RoadMap，现在项目已经成为了LangChain的官方项目，路线图的落地应该是有保障的。

允许用户自定义完整系统提示

代码整洁性（类型提示、文档字符串、格式化）

允许更强大的虚拟文件系统

创建一个基于此构建的深度编码代理示例

基准测试

## 参考文档

●

项目地址： [https://github.com/langchain-ai/deepagents](https://github.com/langchain-ai/deepagents?tab=readme-ov-file)

●

上下文隔离： [https://www.dbreunig.com/2025/06/26/how-to-fix-your-context.html#context-quarantine](https://www.dbreunig.com/2025/06/26/how-to-fix-your-context.html#context-quarantine)

●

Manus的上下文工程： [https://manus.im/zh-cn/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus?ref=blog.langchain.com](https://manus.im/zh-cn/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus?ref=blog.langchain.com)

●

Claude Code 逆向工程： [https://github.com/shareAI-lab/analysis\_claude\_code](https://github.com/shareAI-lab/analysis_claude_code)

END

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
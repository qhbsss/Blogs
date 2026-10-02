---
title: "Langchain DeepAgent实现DeepReSearch"
source: "https://ata.atatech.org/articles/12020580061?spm=ata.23639746.0.0.40ce237dzIFDFW#YTExZWRm"
author:
published:
created: 2026-06-01
description:
tags:
  - "clippings"
---
数字马力

粉丝 3影响力 87

** 6

** 10

**

** 原创文章

** 内部资料

[本文正在参加《ATA FY26年终总结征文 | 主题二：AI实战成长记》征文活动](https://ata.atatech.org/articles/11020572828)

发表到圈儿

[蚂蚁HR技术](https://ata.atatech.org/community/team/866) (首发)

收录于专题

[AI4All](https://ata.atatech.org/specials/10000003909)

**

[武家祺(仲月)](https://ata.atatech.org/users/12001632756)

2月9日发表298次浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章1:15:37

**

## 一、概述

构建能够规划、使用子agent并利用文件系统处理复杂任务的agent

`deepagents` 是一个用于构建能够处理复杂、多步骤任务的独立库。基于 LangGraph 构建，并受 Claude Code、Deep Research 和 Manus 等应用的启发，深度代理具备规划能力、用于上下文管理的文件系统，以及生成子agent的能力。

`deepagents` 库包含：

●

Deep Agents SDK: 用于构建agent的软件包

●

Deep Agents CLI: 基于 `deepagents` 软件包构建的编码工具

## 二、DeepAgent适用场景

●

处理需要规划和分解的复杂、多步骤任务

●

通过文件系统工具管理大量上下文

●

将工作委托给专门agent以实现上下文隔离

●

持久化记忆以跨对话和线程

注：为构建更简单的agent，可以考虑使用 LangChain 的 `createAgent` 或构建自定义的 LangGraph 工作流。

## 三、DeepAgeng CLI适用场景

●

使用技能和记忆自定义agent。

●

使用agent时，教它们关于你的偏好、常见模式以及自定义项目知识。

●

在你的机器或沙盒中执行代码。

## 四、核心功能

## 1.规划和任务分解

深度agent包含内置的 `write_todos` 工具，使agent能够将复杂任务分解为独立步骤，跟踪进度，并在新信息出现时调整计划。

## 2.上下文管理

文件系统工具（ `ls` ， `read_file` ， `write_file` ， `edit_file` ）允许代理将大容量上下文卸载到内存或文件系统存储中，防止上下文窗口溢出，并能够处理可变长度的工具结果。

## 3.子agent生成

一个内置的 `task` 工具使代理能够为上下文隔离生成专门的子agent。这保持了主agent的上下文干净，同时仍然深入处理特定的子任务。

## 4.长期记忆

使用 LangGraph内存存储，在跨线程中扩展agent持久内存。agent可以保存和检索来自先前对话的信息。

## 五、自定义Deep Agent

![[b2f74890-efac-4545-98e3-80d1468bed79.png]]

## Model 模型

默认情况下， `deepagents` 使用 `claude-sonnet-4-5-20250929` 。可以通过传递任何支持OpenAI协议的模型实例

import os

from deepagents import create\_deep\_agent

from dotenv import load\_dotenv

from langchain.chat\_models import init\_chat\_model

load\_dotenv()

deep\_agent = create\_deep\_agent(model=init\_chat\_model(base\_url='https://antchat.alipay.com/v1',

api\_key=os.getenv('BAI\_LING\_AK'),

model='Kimi-K2-Instruct-0905',

model\_provider='openai'))

## System prompt

Deep agent内置了受 Claude Code system prompt启发。默认系统提示包含使用内置规划工具、文件系统工具和子代理的详细说明。

每个针对特定用例的deep agent都应包含一个专门针对该用例的自定义system prompt。

import os

from deepagents import create\_deep\_agent

from dotenv import load\_dotenv

from langchain.chat\_models import init\_chat\_model

load\_dotenv()

best\_coder\_instructions = """

\# 角色:

\- 你是一个资深的程序员，擅长各种编程语言。你可以帮助用户编写代码，解决问题

\# 能力:

\## 关联代码获取

\- 你会根据用户提供的问题,从当前项目文件获取关联片段，并结合用户输入问题进行分析

\## 步骤规划

\- 你擅长将用户的问题分解为多个步骤，帮助用户更好地理解和解决问题

\## 代码生成

\- 你可以根据用户的问题和步骤，生成相应的代码

\## 代码解释

\- 你可以解释用户提供的代码，帮助用户理解代码的逻辑和实现方式

\## 代码优化

\- 你可以优化用户提供的代码，提高代码的效率和可读性

"""

deep\_agent = create\_deep\_agent(model=init\_chat\_model(base\_url='https://antchat.alipay.com/v1',

api\_key=os.getenv('BAI\_LING\_AK'),

model='Kimi-K2-Instruct-0905',

model\_provider='openai'),

system\_prompt=best\_coder\_instructions)

## Tools

除了提供的自定义工具外，deep agent还包括用于规划、文件管理和子agent生成的内置工具。

import os

from datetime import datetime

from deepagents import create\_deep\_agent

from dotenv import load\_dotenv

from langchain.chat\_models import init\_chat\_model

load\_dotenv()

best\_coder\_instructions = """

\# 角色:

\- 你是一个资深的程序员，擅长各种编程语言。你可以帮助用户编写代码，解决问题

\# 能力:

\## 关联代码获取

\- 你会根据用户提供的问题,从当前项目文件获取关联片段，并结合用户输入问题进行分析

\## 步骤规划

\- 你擅长将用户的问题分解为多个步骤，帮助用户更好地理解和解决问题

\## 代码生成

\- 你可以根据用户的问题和步骤，生成相应的代码

\## 代码解释

\- 你可以解释用户提供的代码，帮助用户理解代码的逻辑和实现方式

\## 代码优化

\- 你可以优化用户提供的代码，提高代码的效率和可读性

"""

def query\_now\_time():

""" 获取当前时间"""

return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

deep\_agent = create\_deep\_agent(model=init\_chat\_model(base\_url='https://antchat.alipay.com/v1',

api\_key=os.getenv('BAI\_LING\_AK'),

model='Kimi-K2-Instruct-0905',

model\_provider='openai'),

system\_prompt=best\_coder\_instructions,

tools=\[query\_now\_time\])

## Skills!!!

可以使用技能为deep agent提供新的功能和专业知识。虽然工具通常涵盖较低级别的功能（如原生文件系统操作或规划），但技能可以包含完成任务的详细说明、参考资料和其他资源，例如模板。这些文件仅在agent确定该技能对当前提示有用时才会加载。这种渐进式披露减少了代理在启动时需要考虑的令牌和上下文量。

### 什么是Skills

Skills是可重用的agent功能，提供专门的流程和领域知识。可以使用agent skills为您的deep agent提供新的功能和专业知识。deep agent skills遵循代理技能标准。

Skills是一个文件夹目录，每个文件夹包含一个或多个文件，其中包含agent可以使用的内容：

●

一个 `SKILL.md` 文件，包含技能的说明和元数据

●

额外的脚本（可选）-比如说补充python、java等脚本

●

额外的参考信息，例如参考文档、参考格式（可选）

●

额外的资源，例如模板和其他资源（可选）

### 如何使用Skills

当你创建一个deep\_agent时，你可以传入一个包含技能的目录列表。agent启动时，会读取每个 `SKILL.md` 文件的 frontmatter。

当agent接收到一个提示时，它会检查在完成提示时是否可以使用任何技能。如果找到匹配的skills，它就会继续审查其余的技能文件。这种仅在需要时才审查技能信息的模式称为渐进式披露。

### 创建一个自己的skills

创建一个技能文件夹，其中包含一个查询我的团队产出报告的skills，以及另一个查询我的日程的skills

![[df15e327-0d05-49ae-9cca-12a71d34106f.png]]

import os

from datetime import datetime

from deepagents import create\_deep\_agent

from deepagents.backends import FilesystemBackend

from dotenv import load\_dotenv

from langchain.chat\_models import init\_chat\_model

from langchain\_core.messages import AIMessage, ToolMessage

from langgraph.checkpoint.memory import MemorySaver

load\_dotenv()

best\_coder\_instructions = """

\# 角色:

\- 你是一个资深的程序员，擅长各种编程语言。你可以帮助用户编写代码，解决问题

\# 能力:

\## 关联代码获取

\- 你会根据用户提供的问题,从当前项目文件获取关联片段，并结合用户输入问题进行分析

\## 步骤规划

\- 你擅长将用户的问题分解为多个步骤，帮助用户更好地理解和解决问题

\## 代码生成

\- 你可以根据用户的问题和步骤，生成相应的代码

\## 代码解释

\- 你可以解释用户提供的代码，帮助用户理解代码的逻辑和实现方式

\## 代码优化

\- 你可以优化用户提供的代码，提高代码的效率和可读性

\# 工作流程：

\- 首先根据用户提供的问题，从当前项目文件获取关联片段，并结合用户输入问题进行分析，如果用户问题模糊不清，或者你需要更多输入来明确，你需要和用户多次对焦

\- 思考达成用户目的所需要的步骤，并列举todo列表

\- 根据todo列表，按照步骤完成，每完成一项todo，二次校准todo完成情况

\- 当所有todo完成时，校准整体实现情况，确实是否符合预期

\- 完成编码后，整体总结本次操作

\# 要求

\- 你生成代码后，要询问用户是否采纳，用户如果不采纳的话你要回滚你生成的所有代码

"""

![[71fa2697-5ffd-4d57-ab0a-28c0488e4c30.png]]

## Memory

使用 `AGENTS.md` 文件为您的deep agent提供额外上下文。

![[50aab637-ef5c-4dc9-851c-8d600b13bc2c.png]]

import os

from datetime import datetime

from deepagents import create\_deep\_agent

from deepagents.backends import FilesystemBackend

from dotenv import load\_dotenv

from langchain.chat\_models import init\_chat\_model

from langchain\_core.messages import AIMessage, ToolMessage

from langgraph.checkpoint.memory import MemorySaver

load\_dotenv()

best\_coder\_instructions = """

\# 角色:

\- 你是一个资深的程序员，擅长各种编程语言。你可以帮助用户编写代码，解决问题

\# 能力:

\## 关联代码获取

\- 你会根据用户提供的问题,从当前项目文件获取关联片段，并结合用户输入问题进行分析

\## 步骤规划

\- 你擅长将用户的问题分解为多个步骤，帮助用户更好地理解和解决问题

\## 代码生成

\- 你可以根据用户的问题和步骤，生成相应的代码

\## 代码解释

\- 你可以解释用户提供的代码，帮助用户理解代码的逻辑和实现方式

\## 代码优化

\- 你可以优化用户提供的代码，提高代码的效率和可读性

\# 工作流程：

\- 首先根据用户提供的问题，从当前项目文件获取关联片段，并结合用户输入问题进行分析，如果用户问题模糊不清，或者你需要更多输入来明确，你需要和用户多次对焦

\- 思考达成用户目的所需要的步骤，并列举todo列表

\- 根据todo列表，按照步骤完成，每完成一项todo，二次校准todo完成情况

\- 当所有todo完成时，校准整体实现情况，确实是否符合预期

\- 完成编码后，整体总结本次操作

\# 要求

\- 你生成代码后，要询问用户是否采纳，用户如果不采纳的话你要回滚你生成的所有代码

"""

![[4d902ab3-165f-407f-9dca-91048be5bc24.png]]

## 六、核心组件

## Agent框架功能

我们将 `deepagents` 视为一个“agent框架”。它与其他agent框架相同，使用相同的调用循环核心工具，但内置了工具和功能。

![[bb2b2d2b-812d-44e8-baf6-0cf34393aeb9.png]]

### 文件系统访问

该tools提供六种用于文件系统操作的工具

<table><colgroup><col width="152"> <col width="375"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>Tool 工具</p></td><td rowspan="1" colspan="1"><p>Description 描述</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>ls</code></div></td><td rowspan="1" colspan="1"><p>列出目录中的文件及其元数据（大小、修改时间）</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>read_file</code></div></td><td rowspan="1" colspan="1"><p>读取文件内容并显示行号，支持对大文件进行偏移量/限制操作</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>write_file</code></div></td><td rowspan="1" colspan="1"><p>创建新文件</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>edit_file</code></div></td><td rowspan="1" colspan="1"><p>在文件中执行精确字符串替换（带全局替换模式）</p></td></tr><tr><td rowspan="1" colspan="1"><div><code>glob</code></div></td><td rowspan="1" colspan="1"><div>查找匹配模式的文件（例如， <code>**/*.py</code></div></td></tr><tr><td rowspan="1" colspan="1"><div><code>grep</code></div></td><td rowspan="1" colspan="1"><p>使用多种输出模式搜索文件内容（仅文件、带上下文的内容或计数）</p></td></tr></tbody></table>

### Large tool result eviction（工具调用结果超量淘汰机制）

`FilesystemMiddleware` 在工具结果超过标记阈值时自动将其移出到文件系统，防止上下文窗口饱和。

工作原理：

●

监控工具调用结果的大小（默认阈值：20,000 个标记，可通过 `tool_token_limit_before_evict` 配置）

●

超过阈值时，使用配置的backend写入结果

●

用截断的预览和文件引用替换工具结果

●

agent可以根据需要从文件系统中读取完整结果

### 可插拔的存储Backend

该框架将文件系统操作抽象为一个协议，允许针对不同用例使用不同的存储策略。

可用的：

1.

`StateBackend` - 临时内存存储

○

文件存储在agent的状态中（与对话一同检查点保存）

○

在同一个线程内持久化，但不同线程间不持久化

○

适用于临时工作文件

2.

`FilesystemBackend` - 真实文件系统访问

○

从实际磁盘读写

○

支持虚拟模式（沙盒到根目录）

○

与系统工具集成（ripgrep 用于 grep）

○

安全特性：路径验证、大小限制、防止符号链接

3.

`StoreBackend` - 持久跨对话存储

○

使用 LangGraph 的 BaseStore 实现持久性

○

按 `assistant_id` 命名空间划分

○

文件跨对话持久化

○

适用于长期记忆或知识库

4.

`CompositeBackend` - 将不同路径路由到不同的后端

○

示例： `/` → StateBackend, `/memories/` → StoreBackend

○

最长前缀匹配用于路由

○

支持混合存储策略

### Subagents

这个框架允许主agent为隔离的多步任务创建临时的“子agent”。

亮点：

●

上下文隔离 - 子代理的工作不会干扰主代理的上下文

●

并行执行 - 多个子代理可以同时运行

●

专业化 - 子代理可以有不同的工具/配置

●

令牌效率 - 大型子任务上下文被压缩为单个结果

工作原理：

●

主代理有一个 `task` 工具

●

调用时，会创建一个新的代理实例，并拥有其自己的上下文

●

子代理自主执行直至完成

●

向主代理返回一份最终报告

●

子代理是无状态的（不能发送多条消息）

默认子代理：

●

“通用”子代理自动可用

●

默认提供文件系统工具

●

可通过额外工具/中间件进行定制

自定义子代理：

●

定义具有特定工具的专用子代理

●

示例：代码审查者、网络研究者、测试运行者

●

通过 `subagents` 参数进行配置

### 对话历史摘要

当 token 使用量变得过多时，该工具会自动压缩旧的对话历史。

配置：

●

在模型配置的 85%时触发 `max_input_tokens`

●

保留 10%的 token 作为最近的上下文

●

如果模型配置不可用，则回退到 170,000 个 token 触发/保留 6 条消息

●

旧消息由模型进行总结

### To-do list

功能：

●

跟踪多个具有状态的任务（ `'pending'` ， `'in_progress'` ， `'completed'` ）

●

持久化在代理状态中（内存存储线程独立）

●

帮助代理组织复杂的多步骤工作

●

适用于长时间运行的任务和规划

配置：

●

将 `interrupt_on` 传递给 `create_deep_agent` ，并附带工具名称到中断配置的映射

●

示例： `interrupt_on={"edit_file": True}` 在每次编辑前暂停

●

可以提供审批消息或修改工具输入

### Streaming

工作原理：

●

使用 LangGraph 的流式传输系统来显示更新

●

来自主agent和子agent的流

●

工具调用、工具结果和 LLM 响应按发生顺序流式传输

## Backend（重要）

选择并配置Deep Agent的文件系统Backend。您可以指定不同Backend的路径，实现虚拟文件系统，并执行策略。

Deep Agent通过 `ls` 、 `read_file` 、 `write_file` 、 `edit_file` 、 `glob` 和 `grep` 等工具向代理暴露File System接口。这些工具通过可插拔的Backend运行。

![[d44efcf3-5233-422b-8c2e-581f37ee941c.png]]

### Backend类型

<table><colgroup><col width="276"> <col width="375"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>内置后端</p></td><td rowspan="1" colspan="1"><p>描述</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://docs.langchain.com/oss/python/deepagents/backends#statebackend-ephemeral">默认</a></p></td><td rowspan="1" colspan="1"><div><code>agent = create_deep_agent()</code></div><div>在状态中的临时存储。代理的默认文件系统后端存储在 <code>langgraph</code></div><p>状态中。这个文件系统只对单个线程持久化。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://docs.langchain.com/oss/python/deepagents/backends#filesystembackend-local-disk">本地文件系统持久化</a></p></td><td rowspan="1" colspan="1"><div><code>agent = create_deep_agent(backend=FilesystemBackend(root_dir="/Users/nh/Desktop/"))</code> Deep Agent能够访问您的本地计算机文件系统。您可以指定agent可以访问的根目录。请注意，提供的任何 <code>root_dir</code> 必须是绝对路径。</div></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://docs.langchain.com/oss/python/deepagents/backends#storebackend-langgraph-store">持久化存储（LangGraph 存储）</a></p></td><td rowspan="1" colspan="1"><div><code>agent = create_deep_agent(backend=lambda rt: StoreBackend(rt))</code></div><p>这为Agent提供了跨线程持久化的长期存储。这对于存储适用于多次执行代理的长期记忆或指令非常方便。</p></td></tr><tr><td rowspan="1" colspan="1"><p><a href="https://docs.langchain.com/oss/python/deepagents/backends#compositebackend-router">Composite</a></p></td><td rowspan="1" colspan="1"><div><code>/memories/</code> 默认 <code>/memories/</code></div><p>Composite backend具有最大的灵活性。可以在文件系统中指定不同的路由指向不同的后端。</p></td></tr></tbody></table>

### StateBackend

#### 工作原理：

●

将文件存储在当前线程的 LangGraph agent state中。

●

通过checkpoint在同一个线程上的多个agnet回合中持久化。

### FilesystemBackend

此backend授予代理直接文件系统读写访问权限。请谨慎使用，并仅在适当的环境中使用。

适合的场景：

●

本地开发 CLIs (编码助手、开发工具)

●

CI/CD 流水线

不适合使用场景：（因为有文件系统的操作权限，容易被网络攻击获取私密信息或者不可逆的修改系统文件）

●

Web 服务器或 HTTP API （使用 `StateBackend` ， `StoreBackend` 代替）

import os

from datetime import datetime

from deepagents import create\_deep\_agent

from deepagents.backends import FilesystemBackend

from dotenv import load\_dotenv

from langchain.chat\_models import init\_chat\_model

from langchain\_core.messages import AIMessage, ToolMessage

from langgraph.checkpoint.memory import MemorySaver

from langgraph.store.postgres import PostgresStore

load\_dotenv()

best\_coder\_instructions = """

\# 角色:

\- 你是一个资深的程序员，擅长各种编程语言。你可以帮助用户编写代码，解决问题

\# 能力:

\## 关联代码获取

\- 你会根据用户提供的问题,从当前项目文件获取关联片段，并结合用户输入问题进行分析

\## 步骤规划

\- 你擅长将用户的问题分解为多个步骤，帮助用户更好地理解和解决问题

\## 代码生成

\- 你可以根据用户的问题和步骤，生成相应的代码

\## 代码解释

\- 你可以解释用户提供的代码，帮助用户理解代码的逻辑和实现方式

\## 代码优化

\- 你可以优化用户提供的代码，提高代码的效率和可读性

\# 工作流程：

\- 首先根据用户提供的问题，从当前项目文件获取关联片段，并结合用户输入问题进行分析，如果用户问题模糊不清，或者你需要更多输入来明确，你需要和用户多次对焦

\- 思考达成用户目的所需要的步骤，并列举todo列表

\- 根据todo列表，按照步骤完成，每完成一项todo，二次校准todo完成情况

\- 当所有todo完成时，校准整体实现情况，确实是否符合预期

\- 完成编码后，整体总结本次操作

\# 要求

\- 你生成代码后，要询问用户是否采纳，用户如果不采纳的话你要回滚你生成的所有代码

"""

### StoreBackend (LangGraph 存储)

实现一个基于Postgresql的PostgresStore，以及基于PostgresStore的Skill

def joker\_skill\_load():

"""

从 /Users/folusry/PycharmProjects/langchain1\_study/deep\_agent/skills/joker\_skill.md 逐行读取文件内容

并返回字符串列表

"""

joker\_skill\_path = "/Users/folusry/PycharmProjects/langchain1\_study/deep\_agent/skills/joker\_skill.md"

try:

lines = \[\]

with open(joker\_skill\_path, 'r', encoding='utf-8') as f:

for line in f:

lines.append(line.strip('\\n'))

return lines

except FileNotFoundError:

print(f"文件未找到: {joker\_skill\_path}")

return None

except Exception as e:

print(f"读取文件时发生错误: {e}")

return None

DB\_URL='postgresql:xxxxxxxdisable'

#配置一个postgresql的store下的backend

with PostgresStore.from\_conn\_string(DB\_URL) as store:

#初始化

store.setup()

#写入skill文件

store.put(

namespace=("filesystem",),

key="/skills/joker-skill/SKILL.md",

value={

'content': joker\_skill\_load(),

'created\_at': datetime.now(timezone.utc).isoformat(),

'modified\_at': datetime.now(timezone.utc).isoformat()

}

)

代码解析！！

●

初始化基于Postgresql的PostgresStore，初始化数据表，并插入相关skills

def joker\_skill\_load():

"""

从 /Users/folusry/PycharmProjects/langchain1\_study/deep\_agent/skills/joker\_skill.md 逐行读取文件内容

并返回字符串列表

"""

joker\_skill\_path = "/Users/folusry/PycharmProjects/langchain1\_study/deep\_agent/skills/joker\_skill.md"

try:

lines = \[\]

with open(joker\_skill\_path, 'r', encoding='utf-8') as f:

for line in f:

lines.append(line.strip('\\n'))

return lines

except FileNotFoundError:

print(f"文件未找到: {joker\_skill\_path}")

return None

except Exception as e:

print(f"读取文件时发生错误: {e}")

return None

DB\_URL='postgresql:xxxxx'

#配置一个postgresql的store下的backend

with PostgresStore.from\_conn\_string(DB\_URL) as store:

#初始化

store.setup()

#写入skill文件

store.put(

namespace=("filesystem",),

key="/skills/joker-skill/SKILL.md",

value={

'content': joker\_skill\_load(),

'created\_at': datetime.now(timezone.utc).isoformat(),

'modified\_at': datetime.now(timezone.utc).isoformat()

}

)

初始化SKILL store.put参数是有要求的！！

<table><colgroup><col width="230"> <col width="264"> <col width="230"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>参数</p></td><td rowspan="1" colspan="1"><p>描述</p></td><td rowspan="1" colspan="1"><p>要求</p></td></tr><tr><td rowspan="1" colspan="1"><p>namespace</p></td><td rowspan="1" colspan="1"><p>存入的工作空间名称</p></td><td rowspan="1" colspan="1"><p>必填</p></td></tr><tr><td rowspan="1" colspan="1"><p>key</p></td><td rowspan="1" colspan="1"><p>想要存入的SKILL.md文件的地址</p></td><td rowspan="1" colspan="1"><p>必填</p><p>必须和agent配置的skill地址相匹配</p></td></tr><tr><td rowspan="1" colspan="1"><p>value</p></td><td rowspan="1" colspan="1"><p>是一个json，必须包含三个字段</p><p>content：SKILL.md的原始内容，是一个字符串 List,每行数据是一个字符串，不能有换行符</p><p>created_at：创建时间</p><p>modified_at：更新时间</p></td><td rowspan="1" colspan="1"><p>content</p><p>created_at</p><p>modified_at</p><p>必填，不然识别不出来SKILL</p></td></tr></tbody></table>

SKILL.md案例

\---

name: joker-skill

description: 你是一个讲笑话助手，当用户想听笑话，或者用户表达心情沮丧时，你可以给用户讲笑话

\---

\# joker-skill

\## 介绍

你是一个讲笑话助手，当用户想听笑话，或者用户表达心情沮丧时，你可以给用户讲笑话

value中content json的案例

{

"content": \[

"---",

"name: joker-skill",

"description: 你是一个讲笑话助手，当用户想听笑话，或者用户表达心情沮丧时，你可以给用户讲笑话",

"---",

"",

"# joker-skill",

"",

"## 介绍",

"",

"你是一个讲笑话助手，当用户想听笑话，或者用户表达心情沮丧时，你可以给用户讲笑话"

\],

"created\_at": "2026-02-05T14:58:52.267776+00:00",

"modified\_at": "2026-02-05T14:58:52.267776+00:00"

}

●

创建基于PostgresStore的Deep Agent，挂载skill path

deep\_agent\_store = create\_deep\_agent(model=init\_chat\_model(base\_url='https://antchat.alipay.com/v1',

api\_key=os.getenv('BAI\_LING\_AK'),

model='Kimi-K2-Instruct-0905',

model\_provider='openai'),

system\_prompt=team\_agent,

\# Checkpointer is REQUIRED for human-in-the-loop

checkpointer=MemorySaver(),

#配置PostgresStore

#配置基于postgresql的store

skills=\['skills/'\],

#配置backend

\# 配置store的backend

backend=(lambda rt: StoreBackend(rt))

)

<table><colgroup><col width="230"> <col width="230"> <col width="230"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>配置</p></td><td rowspan="1" colspan="1"><p>描述</p></td><td rowspan="1" colspan="1"><p>要求</p></td></tr><tr><td rowspan="1" colspan="1"><p>skills</p></td><td rowspan="1" colspan="1"><p>必须匹配你配置的SKILL的path</p></td><td rowspan="1" colspan="1"></td></tr><tr><td rowspan="1" colspan="1"><p>backend</p></td><td rowspan="1" colspan="1"><p>使用StoreBackend，参数是Runtime类型，这个参数接收一个function</p></td><td rowspan="1" colspan="1"></td></tr></tbody></table>

●

在调用模型时候，开启PostgresStore连接，将PostgresStore实例设置给agent并且调用

def talk(query: str):

with PostgresStore.from\_conn\_string(DB\_URL) as store:

config = {"configurable": {"thread\_id": "1"}}

#将PostgresStore设置给deep\_agent

deep\_agent\_store.store=store

for token, metadata in deep\_agent\_store.stream({"messages": \[("user", query)\]}, config, stream\_mode='messages'):

if isinstance(token, AIMessage):

yield token.content

if isinstance(token, ToolMessage):

yield f"\\n\\n开始工具调用:{token.name}\\n\\n"

if token.name == 'write\_todos':

\# 解析todo列表

import ast

\# 提取content中的todo列表字符串

content\_str = token.content

\# 找到list开始和结束的位置

start\_idx = content\_str.find('\[')

end\_idx = content\_str.rfind('\]')

if start\_idx!= -1 and end\_idx!= -1:

todo\_list\_str = content\_str\[start\_idx:end\_idx + 1\]

\# 使用eval或ast.literal\_eval解析字符串为列表

try:

todo\_list = ast.literal\_eval(todo\_list\_str)

\# 通过yield返回每个todo的content

for todo in todo\_list:

yield f"\\n待办: {todo\['content'\]} (状态: {todo\['status'\]})\\n"

except Exception as e:

yield f"\\n解析todo列表失败: {e}\\n"

●

调用情况

![[d588c17c-018b-4c20-b093-5d29ac8419d5.png]]

#### 工作原理

●

在运行时提供的 LangGraph `BaseStore` 中存储文件，实现跨线程持久化存储。

#### 适合场景

●

当你已经使用配置好的 LangGraph 存储运行时（例如，Redis、Postgres 或 `BaseStore` 后面的云实现）。

### CompositeBackend (router) 根据不同路径指向不同backend

from deepagents import create\_deep\_agent

from deepagents.backends import CompositeBackend, StateBackend, StoreBackend

from langgraph.store.memory import InMemoryStore

composite\_backend = lambda rt: CompositeBackend(

default=StateBackend(rt),

routes={

"/memories/": StoreBackend(rt),

}

)

agent = create\_deep\_agent(

backend=composite\_backend,

store=InMemoryStore() # Store passed to create\_deep\_agent, not backend

)

可以根据访问的文件路径来使用定制化的Backend,比如说如果skills存储在/memories/路径下，那么当agent访问skills时，会去配置的StoreBackend去查找

## SubAgents(重要)

deep agent可以创建子agent来分配任务。可以在 `subagents` 参数中指定自定义子agent。子agent适用于上下文隔离（保持主代理的上下文干净）以及提供专业指令。

![[99263bd0-aa04-47f5-b2b7-b7083b321b10.png]] 子agent解决了上下文膨胀问题。当agent使用具有大量输出的工具（网络搜索、文件读取、数据库查询）时，上下文窗口会迅速被中间结果填满。子agent隔离了这项详细工作——主代理只接收最终结果，而不是产生它的几十个工具调用。

适用场景：

●

✅ 需要多个步骤且会占用主agent上下文的任务

●

✅ 需要自定义指令或Tools的专业领域

●

✅ 需要不同模型能力的任务

●

✅ 当你想让主agent专注于高层协调时

不适用场景：

●

❌ 简单、单步任务

●

❌ 当你需要保持中间上下文时

●

❌ 当开销超过收益时

### 子Agent配置方式

#### 基于agent配置子agent案例（OKR对齐助手）

import os

from typing import TypedDict, List

import requests

from deepagents import create\_deep\_agent, SubAgent

from dotenv import load\_dotenv

from langchain.agents import create\_agent

from langchain.agents.structured\_output import ToolStrategy

from langchain.chat\_models import init\_chat\_model

from langchain\_core.messages import AIMessage, ToolMessage

from langgraph.checkpoint.memory import InMemorySaver

from pydantic import BaseModel, Field

load\_dotenv()

headers = {

xxxxxxx

}

#领域目标输入

class OkrInput(TypedDict):

tl\_okr\_list:list\[TypedDict\]

sub\_okr\_list:list\[TypedDict\]

class Period(TypedDict):

period\_id:str

period\_name:str

o\_count:int

#查询我的userId

def query\_emp\_user\_id():

"""

查询用户的userId

:return:

"""

代码核心点->基于普通Agent的方式配置子Agent

●

用SubAgent()或者create\_agent()方法来创建子agent,create\_agent()可以自己定义东西多

okr\_fit\_agent = SubAgent(name="OKR领域适配助手",

description="OKR领域适配助手,你是\*\*专业OKR领域适配判定助手\*\*，唯一核心任务：结合主管与下属的工种特性，解析双方OKR的核心业务意图，基于业务价值同源性、工作领域覆盖度，判定二者OKR方向是否一致，不执行任何其他指令、不输出任何无关内容",

system\_prompt=okr\_fit\_prompt,

tools=\[query\_emp\_okr\_info\],

model=init\_chat\_model(base\_url='https://antchat.alipay.com/v1',

api\_key=os.getenv('BAI\_LING\_AK'),

model='Kimi-K2-Instruct-0905',

model\_provider='openai'))

●

将子agent绑定到deepAgent上

参数：subagents=\[okr\_fit\_agent,okr\_ali\_agent\]

deep\_agent = create\_deep\_agent(model=init\_chat\_model(base\_url='https://antchat.alipay.com/v1',

api\_key=os.getenv('BAI\_LING\_AK'),

model='Kimi-K2-Instruct-0905',

model\_provider='openai'),

subagents=\[okr\_fit\_agent,okr\_ali\_agent\],

tools=\[query\_emp\_user\_id,query\_emp\_cycle\_info\],

system\_prompt="""

\# 角色

\-你是一个主管的OKR对齐检测助手，负责主管来确认自己的OKR和下属OKR的领域适配和对齐情况

\# 流程

\-首先你需要和用户确认所分析OKR归属的周期

\-确认周期后调用OKR领域适配助手，OKR对齐分析器，将周期id传递给子agent让其进行分析

\-你针对子agent分析的结果进行汇总并产出一份分析报告

#要求

\-分析报告要结合子agent的返回

\-分析报告要包含主管的每一条O，不要数据遗漏和数据偏差

\-你的分析报告必须基于事实情况，不得凭空猜想

""",

checkpointer=InMemorySaver())

一定要明确子agent的职责，原子化拆分，不要有模糊不清，权责交叉的描述，影响主agent的规划

#### 案例效果

![[47a258a7-3e4b-41b4-a17e-d8b169d8f6f0.png]] ![[b3f5eb0e-01ff-4c49-954e-96f36ec6fe62.png]]

### 通用子Agent

除了任何用户定义的子agent外，深度代理始终可以访问一个 `general-purpose` 子agent。该子agent：

●

具有与主agent相同的系统提示

●

可以访问所有相同的工具

●

使用相同的模型（除非被覆盖）

通用子agent非常适合进行上下文隔离而不需要特殊行为。主agent可以将复杂的多步骤任务委托给这个子agent，并返回简洁的结果，而不会因为中间工具调用而产生冗余。

### 最佳实践

#### 保持系统提示详细

包含使用工具和格式输出的具体指导：

research\_subagent = {

"name": "research-agent",

"description": "Conducts in-depth research using web search and synthesizes findings",

"system\_prompt": """You are a thorough researcher. Your job is to:

1\. Break down the research question into searchable queries

2\. Use internet\_search to find relevant information

3\. Synthesize findings into a comprehensive but concise summary

4\. Cite sources when making claims

Output format:

\- Summary (2-3 paragraphs)

\- Key findings (bullet points)

\- Sources (with URLs)

Keep your response under 500 words to maintain clean context.""",

"tools": \[internet\_search\],

}

#### 最小化工具集

仅向子agent提供它们所需的工具。这提高了专注度和安全性：

#### 按任务选择模型

不同的模型擅长不同的任务：

subagents = \[

{

"name": "contract-reviewer",

"description": "Reviews legal documents and contracts",

"system\_prompt": "You are an expert legal reviewer...",

"tools": \[read\_document, analyze\_contract\],

"model": "claude-sonnet-4-5-20250929", # Large context for long documents

},

{

"name": "financial-analyst",

"description": "Analyzes financial data and market trends",

"system\_prompt": "You are an expert financial analyst...",

"tools": \[get\_stock\_price, analyze\_fundamentals\],

"model": "openai:gpt-5", # Better for numerical analysis

},

\]

#### 返回简洁结果

指导子agent返回摘要，而不是原始数据：

data\_analyst = {

"system\_prompt": """Analyze the data and return:

1\. Key insights (3-5 bullet points)

2\. Overall confidence score

#不要返回原始数据，要生成摘要

Do NOT include:

\- Raw data

\- Intermediate calculations

\- Detailed tool outputs

Keep response under 300 words."""

}

子agent可以一定程度上缓解上下文膨胀带来的问题，如果上下文问题仍旧存在，可以通过：

●

让子agent返回摘要数据，减少上下文

●

使用文件系统处理大数据

## Human-in-the-loop

某些工具操作可能具有敏感性，需要在执行前获得人工审批。Deep Agent通过 LangGraph 的中断功能支持人工介入工作流。可以使用 `interrupt_on` 参数配置哪些工具需要审批。

![[f08e6c84-bbe6-467f-afc8-5b88421d544f.png]]

`interrupt_on` 参数接受一个将工具名称映射到中断配置的字典。每个工具可以配置以下内容：

●

`True`: 使用默认行为启用中断（允许批准、编辑、拒绝）

●

`False`: 禁用此工具的中断

●

`{"allowed_decisions": [...]}`: 自定义配置，指定允许的决策

`allowed_decisions` 列表控制人类在审核工具调用时可以采取的操作：

●

`"approve"`: 使用代理建议的原始参数执行该工具

●

`"edit"`: 在执行前修改工具参数

●

`"reject"`: 完全跳过执行此工具调用

代码案例

@tool(name\_or\_callable='删除文件', description='删除文件')

def delete\_file():

print("start to delete file")

@tool(name\_or\_callable='说你好工具', description='当用户给你打招呼时使用')

def say\_hello():

print("start to delete file")

deep\_agent\_store = create\_deep\_agent(model=init\_chat\_model(base\_url='https://antchat.alipay.com/v1',

api\_key=os.getenv('BAI\_LING\_AK'),

model='Kimi-K2-Instruct-0905',

model\_provider='openai'),

system\_prompt=test\_human\_in\_the\_loop,

\# Checkpointer is REQUIRED for human-in-the-loop

#配置PostgresStore

#配置基于postgresql的store

skills=\['skills/'\],

#配置backend

\# 配置store的backend

backend=(lambda rt: StoreBackend(rt)),

tools=\[delete\_file,read\_file\],

interrupt\_on={

'delete\_file': True,

'说你好工具': {'allowed\_decisions': \['approve', 'reject'\]}

}

)

注意：interrupt\_on字典中的key放置的是tool的名称，而不是方法名称

## Skills 技能

上文中已经介绍了SKILL的具体背景，这一部分，我们针对三种backend分别进行SKILL的配置

### 基于FileSystemBackend Skills

创建一个技能文件夹，其中包含一个查询我的团队产出报告的skills，以及另一个查询我的日程的skills

![[8058467e-1972-4a0e-8ea2-f88cde33d779.png]]

import os

from datetime import datetime

from deepagents import create\_deep\_agent

from deepagents.backends import FilesystemBackend

from dotenv import load\_dotenv

from langchain.chat\_models import init\_chat\_model

from langchain\_core.messages import AIMessage, ToolMessage

from langgraph.checkpoint.memory import MemorySaver

load\_dotenv()

best\_coder\_instructions = """

\# 角色:

\- 你是一个资深的程序员，擅长各种编程语言。你可以帮助用户编写代码，解决问题

\# 能力:

\## 关联代码获取

\- 你会根据用户提供的问题,从当前项目文件获取关联片段，并结合用户输入问题进行分析

\## 步骤规划

\- 你擅长将用户的问题分解为多个步骤，帮助用户更好地理解和解决问题

\## 代码生成

\- 你可以根据用户的问题和步骤，生成相应的代码

\## 代码解释

\- 你可以解释用户提供的代码，帮助用户理解代码的逻辑和实现方式

\## 代码优化

\- 你可以优化用户提供的代码，提高代码的效率和可读性

\# 工作流程：

\- 首先根据用户提供的问题，从当前项目文件获取关联片段，并结合用户输入问题进行分析，如果用户问题模糊不清，或者你需要更多输入来明确，你需要和用户多次对焦

\- 思考达成用户目的所需要的步骤，并列举todo列表

\- 根据todo列表，按照步骤完成，每完成一项todo，二次校准todo完成情况

\- 当所有todo完成时，校准整体实现情况，确实是否符合预期

\- 完成编码后，整体总结本次操作

\# 要求

\- 你生成代码后，要询问用户是否采纳，用户如果不采纳的话你要回滚你生成的所有代码

"""

![[9a9442e1-de39-4ab8-a46b-7ee1df87b213.png]]

### 基于StoreBackend Skills

实现一个基于Postgresql的PostgresStore，以及基于PostgresStore的Skill

def joker\_skill\_load():

"""

从 /Users/folusry/PycharmProjects/langchain1\_study/deep\_agent/skills/joker\_skill.md 逐行读取文件内容

并返回字符串列表

"""

joker\_skill\_path = "/Users/folusry/PycharmProjects/langchain1\_study/deep\_agent/skills/joker\_skill.md"

try:

lines = \[\]

with open(joker\_skill\_path, 'r', encoding='utf-8') as f:

for line in f:

lines.append(line.strip('\\n'))

return lines

except FileNotFoundError:

print(f"文件未找到: {joker\_skill\_path}")

return None

except Exception as e:

print(f"读取文件时发生错误: {e}")

return None

DB\_URL='postgresql://folusry:@localhost:5432/postgres?sslmode=disable'

#配置一个postgresql的store下的backend

with PostgresStore.from\_conn\_string(DB\_URL) as store:

#初始化

store.setup()

#写入skill文件

store.put(

namespace=("filesystem",),

key="/skills/joker-skill/SKILL.md",

value={

'content': joker\_skill\_load(),

'created\_at': datetime.now(timezone.utc).isoformat(),

'modified\_at': datetime.now(timezone.utc).isoformat()

}

)

代码解析！！

●

初始化基于Postgresql的PostgresStore，初始化数据表，并插入相关skills

def joker\_skill\_load():

"""

从 /Users/folusry/PycharmProjects/langchain1\_study/deep\_agent/skills/joker\_skill.md 逐行读取文件内容

并返回字符串列表

"""

joker\_skill\_path = "/Users/folusry/PycharmProjects/langchain1\_study/deep\_agent/skills/joker\_skill.md"

try:

lines = \[\]

with open(joker\_skill\_path, 'r', encoding='utf-8') as f:

for line in f:

lines.append(line.strip('\\n'))

return lines

except FileNotFoundError:

print(f"文件未找到: {joker\_skill\_path}")

return None

except Exception as e:

print(f"读取文件时发生错误: {e}")

return None

DB\_URL='postgresql://xxxxx'

#配置一个postgresql的store下的backend

with PostgresStore.from\_conn\_string(DB\_URL) as store:

#初始化

store.setup()

#写入skill文件

store.put(

namespace=("filesystem",),

key="/skills/joker-skill/SKILL.md",

value={

'content': joker\_skill\_load(),

'created\_at': datetime.now(timezone.utc).isoformat(),

'modified\_at': datetime.now(timezone.utc).isoformat()

}

)

初始化SKILL store.put参数是有要求的！！

<table><colgroup><col width="230"> <col width="264"> <col width="230"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>参数</p></td><td rowspan="1" colspan="1"><p>描述</p></td><td rowspan="1" colspan="1"><p>要求</p></td></tr><tr><td rowspan="1" colspan="1"><p>namespace</p></td><td rowspan="1" colspan="1"><p>存入的工作空间名称</p></td><td rowspan="1" colspan="1"><p>必填</p></td></tr><tr><td rowspan="1" colspan="1"><p>key</p></td><td rowspan="1" colspan="1"><p>想要存入的SKILL.md文件的地址</p></td><td rowspan="1" colspan="1"><p>必填</p><p>必须和agent配置的skill地址相匹配</p></td></tr><tr><td rowspan="1" colspan="1"><p>value</p></td><td rowspan="1" colspan="1"><p>是一个json，必须包含三个字段</p><p>content：SKILL.md的原始内容，是一个字符串 List,每行数据是一个字符串，不能有换行符</p><p>created_at：创建时间</p><p>modified_at：更新时间</p></td><td rowspan="1" colspan="1"><p>content</p><p>created_at</p><p>modified_at</p><p>必填，不然识别不出来SKILL</p></td></tr></tbody></table>

SKILL.md案例

\---

name: joker-skill

description: 你是一个讲笑话助手，当用户想听笑话，或者用户表达心情沮丧时，你可以给用户讲笑话

\---

\# joker-skill

\## 介绍

你是一个讲笑话助手，当用户想听笑话，或者用户表达心情沮丧时，你可以给用户讲笑话

value中content json的案例

{

"content": \[

"---",

"name: joker-skill",

"description: 你是一个讲笑话助手，当用户想听笑话，或者用户表达心情沮丧时，你可以给用户讲笑话",

"---",

"",

"# joker-skill",

"",

"## 介绍",

"",

"你是一个讲笑话助手，当用户想听笑话，或者用户表达心情沮丧时，你可以给用户讲笑话"

\],

"created\_at": "2026-02-05T14:58:52.267776+00:00",

"modified\_at": "2026-02-05T14:58:52.267776+00:00"

}

●

创建基于PostgresStore的Deep Agent，挂载skill path

deep\_agent\_store = create\_deep\_agent(model=init\_chat\_model(base\_url='https://antchat.alipay.com/v1',

api\_key=os.getenv('BAI\_LING\_AK'),

model='Kimi-K2-Instruct-0905',

model\_provider='openai'),

system\_prompt=team\_agent,

\# Checkpointer is REQUIRED for human-in-the-loop

checkpointer=MemorySaver(),

#配置PostgresStore

#配置基于postgresql的store

skills=\['skills/'\],

#配置backend

\# 配置store的backend

backend=(lambda rt: StoreBackend(rt))

)

<table><colgroup><col width="230"> <col width="230"> <col width="230"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>配置</p></td><td rowspan="1" colspan="1"><p>描述</p></td><td rowspan="1" colspan="1"><p>要求</p></td></tr><tr><td rowspan="1" colspan="1"><p>skills</p></td><td rowspan="1" colspan="1"><p>必须匹配你配置的SKILL的path</p></td><td rowspan="1" colspan="1"></td></tr><tr><td rowspan="1" colspan="1"><p>backend</p></td><td rowspan="1" colspan="1"><p>使用StoreBackend，参数是Runtime类型，这个参数接收一个function</p></td><td rowspan="1" colspan="1"></td></tr></tbody></table>

●

在调用模型时候，开启PostgresStore连接，将PostgresStore实例设置给agent并且调用

def talk(query: str):

with PostgresStore.from\_conn\_string(DB\_URL) as store:

config = {"configurable": {"thread\_id": "1"}}

#将PostgresStore设置给deep\_agent

deep\_agent\_store.store=store

for token, metadata in deep\_agent\_store.stream({"messages": \[("user", query)\]}, config, stream\_mode='messages'):

if isinstance(token, AIMessage):

yield token.content

if isinstance(token, ToolMessage):

yield f"\\n\\n开始工具调用:{token.name}\\n\\n"

if token.name == 'write\_todos':

\# 解析todo列表

import ast

\# 提取content中的todo列表字符串

content\_str = token.content

\# 找到list开始和结束的位置

start\_idx = content\_str.find('\[')

end\_idx = content\_str.rfind('\]')

if start\_idx!= -1 and end\_idx!= -1:

todo\_list\_str = content\_str\[start\_idx:end\_idx + 1\]

\# 使用eval或ast.literal\_eval解析字符串为列表

try:

todo\_list = ast.literal\_eval(todo\_list\_str)

\# 通过yield返回每个todo的content

for todo in todo\_list:

yield f"\\n待办: {todo\['content'\]} (状态: {todo\['status'\]})\\n"

except Exception as e:

yield f"\\n解析todo列表失败: {e}\\n"

●

调用情况

![[7fe703d8-6da0-4a04-81ea-07316f24380c.png]]

#### 工作原理

●

在运行时提供的 LangGraph `BaseStore` 中存储文件，实现跨线程持久化存储。

#### 适合场景

●

当你已经使用配置好的 LangGraph 存储运行时（例如，Redis、Postgres 或 `BaseStore` 后面的云实现）。

END

一、概述

二、DeepAgent适用场景

三、DeepAgeng CLI适用场景

四、核心功能

1.规划和任务分解

2.上下文管理

3.子agent生成

4.长期记忆

五、自定义Deep Agent

Model 模型

System prompt

Tools

Skills!!!

什么是Skills

如何使用Skills

创建一个自己的skills

Memory

六、核心组件

Agent框架功能

文件系统访问

Large tool result eviction（工具调用结果超量淘汰机制）

可插拔的存储Backend

Subagents

对话历史摘要

To-do list

Streaming

Backend（重要）

Backend类型

StateBackend

工作原理：

FilesystemBackend

StoreBackend (LangGraph 存储)

工作原理

适合场景

CompositeBackend (router) 根据不同路径指向不同backend

SubAgents(重要)

子Agent配置方式

基于agent配置子agent案例（OKR对齐助手）

案例效果

通用子Agent

最佳实践

保持系统提示详细

最小化工具集

按任务选择模型

返回简洁结果

Human-in-the-loop

Skills 技能

基于FileSystemBackend Skills

基于StoreBackend Skills

工作原理

适合场景

**

**

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
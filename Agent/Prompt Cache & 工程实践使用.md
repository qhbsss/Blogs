---
title: "Prompt Cache & 工程实践使用"
source: "https://ata.atatech.org/articles/11020653241?spm=ata.23639420.0.0.15527536HVAU71"
author:
published:
created: 2026-05-29
description:
tags:
  - "clippings"
---
中国电商事业群-淘天集团

粉丝 3影响力 37

** 4

** 1

**

** 原创文章

** AI辅助优化 30%

** 内部资料

**

[刘旭东(竺沐)](https://ata.atatech.org/users/11001234517)

昨天10:28发表32次浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章13:27

**

一个好的 Prompt Cache 稳定的系统可以带来的收益：响应速度、成本。

> Reduce latency and cost with prompt caching.

下面将从基础使用以及 CC 源码中的一些工程实践借鉴进行介绍。

### Prompt Cache 特性

首先 Prompt Cache 是一个需要模型层面支持的能力，这里参考 Claude 文档相关介绍，Qwen 模型同样也具备该能力，特性和使用上也是类似。分类

●

Explicit cache breakpoints：将 `cache_control` 添加到 content block 中，单次请求最多支持加入4 个 cache\_control 进行标记，精细化的对当前 Prompt 进行一个缓存分层控制。

●

Automatic caching：开启只在需在最外层去添加 ，系统自动在对话消息末尾追加 `cache_control` 并移动。

> Claude 模型默认 Prompt Cache 能力关闭，需要通过以上两种选其一手动开启

Cache 最小 Token 限制只有当达到可缓存的最小 Token 限制的时候，且开启 Prompt Cache 能力，cache\_control 才会生效。

<table><colgroup><col width="325"> <col width="325"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>最小缓存 Token 数</p></td><td rowspan="1" colspan="1"><p>模型</p></td></tr><tr><td rowspan="1" colspan="1"><p>4,096</p></td><td rowspan="1" colspan="1"><p>Claude Opus 4.7、Claude Opus 4.6</p></td></tr><tr><td rowspan="1" colspan="1"><p>1,024</p></td><td rowspan="1" colspan="1"><p>Claude Sonnet 4.6</p></td></tr></tbody></table>

#### Explicit cache breakpoints 的使用

在 tools, system，messages 中，可以显示添加 cache\_control 到 content block 中，默认缓存时间 5 min，命中后重置，ttl 可选开启 1 h（支持两种 ttl 混合使用）。

response = client.messages.create(

model="claude-opus-4-7",

max\_tokens=1024,

system=\[

{

"type": "text",

"text": "...long system prompt",

"cache\_control": {"type": "ephemeral"},

}

\],

messages=\[

#...long conversation so far

{

"role": "user",

"content": \[

{"type": "text", "text": "Good to know."},

{

"type": "text",

"text": "Tell me more about Mars.",

"cache\_control": {"type": "ephemeral"},

},

\],

},

\],

tools=\[

#... other tool definition

{

"name": "get\_time",

"description": "Get the current time in a given time zone",

"input\_schema": {

"type": "object",

"properties": {

"timezone": {"type": "string"}

},

"required": \["timezone"\]

},

"cache\_control": { "type": "ephemeral", "ttl": "1h" }

}

\]

)

Prompt Cache 的工作方式：

●

写入：只在标记 cache\_control 的位置处，以开始到当前 cache\_control 位置的内容作为一个缓存块记录。cache\_control 之前的内容不会作为缓存块记录。

●

匹配：cache\_control 前缀（hash）完全一致时命中，多 cache\_control 时选取最长的匹配前缀作为命中的缓存块。

查找：LookBack Window (20 block)，从 cache\_control 的位置作开始。最多回溯 20 个 block 去寻找是否有之前写入的内容，未找到就继续往前从其它 cache\_control 位置匹配&查找。 ![[31a38b34-4523-47cb-9480-54168e2d7ccb.png]]

#### 实际命中测试

##### 缓存命中

代码：claude\_prompt\_cache\_hit.pyTurn1输入：在 message 的最后一个 block 增加缓存控制。

{

"content": \[

//... 其它内容,

{

"text": "请简述杭州西湖历史与特色。",

"type": "text",

"cache\_control": {

"type": "ephemeral"

}

}

\],

"role": "user"

}

token 用量输出：

cache\_creation\_input\_tokens: 2760 (这次新创建缓存写入的 token 数量)1.25 倍价格

cache\_read\_input\_tokens: 0 （没有命中缓存，从缓存中读取 token 数量为 0）

input\_tokens: 3

output\_tokens: 116

Turn2输入：增加新的消息，同时移动 cache\_control 的位置到最后一个 block

{

"content": \[

//... 一些其它内容

{

"text": "请简述杭州西湖的历史与特色。",

"type": "text"

}

\],

"role": "user"

},

{

"content": \[

{

"text": "模型回复消息",

"type": "text"

}

\],

"role": "assistant"

},

{

"content": \[

//... 5 条其它内容

{

"text": "请简述杭州西溪湿地的历史与特色。",

"type": "text",

"cache\_control": {

"type": "ephemeral"

}

}

\],

"role": "user"

}

token 用量输出：

cache\_creation\_input\_tokens: 600 （上次模型的返回+下次输入内容，新创建的缓存写入 token）

cache\_read\_input\_tokens: 2760 （命中上次的写入，从缓存中读取）0.1 倍价格

input\_tokens: 3

output\_tokens: 116

边界测试：LookBack 边界测试：不同 Prompt 内容 LookBack 不同的类型细节上会有不一样，但从特性上和文档 LookBack 机制一致。

●

tools 部分追加后移动 cache\_control 不会触发 LookBack ，官方文档中也没找到明确说明，猜测是 tools 整个作为一个 block，而不是一个 tool 一个 block。PromptCacheWithToolsChange.py

●

在 LookBack 的时候，message 消息会往前回溯 20 步去寻找之前的。claude\_prompt\_cache\_hit\_add\_more\_block.py

●

System 追加 block，并移动 cache\_control ，可以触发 LookBack。PromptCacheWithSystemPromptChange.py测试代码目录： [https://code.alibaba-inc.com/lxd330820/AnthropicStart/tree/main/anthropic](https://code.alibaba-inc.com/lxd330820/AnthropicStart/tree/main/anthropic)

#### Qwen 中的 Prompt Cache 机制

整体机制同 Claude Prompt Cache 机制一致：

●

显示缓存：需主动开启，同 claude 。

●

隐式缓存：此为自动模式，无需额外配置，且无法关闭，适合追求便捷的通用场景。系统会自动识别请求内容的公共前缀并进行缓存，但缓存命中率不确定。

○

自己测试自己的功能试了下比较难命中，256 的最小阈值 1300 左右 token 20 次请求命中 1 次，token 数量越大概率相对提升。

### CC 工程链路中 Prompt Cache 机制的使用

在 claude code 源码中，是一个多 cache\_control 显示 & 结合 TTL 5min/1h 控制，在代码中 System、Tools、Messages 都有 cache\_control 相关的代码逻辑。（根据 source 选择开启 ttl 1h）

●

System：buildSystemPromptBlocks 时添加 cache\_control ，cache\_control 不移动。

○

Claude cache prefixes are created in the following order: `tools`, `system`, then `messages`

●

Messages：cache\_control 随消息增长移动，默认每次移动到最后一条消息，（runForkedAgent 执行时可控制不移动 cache\_control）。

#### runForkedAgent 链路

在 Claude Code 源码中，runForkedAgent 是一个比较通用的能力：很多和主 Agent 上下文相关的功能都有用到：

<table><colgroup><col width="156"> <col width="650"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>使用该机制的模块</p></td><td rowspan="1" colspan="1"><div><code>auto_dream</code> | <code>extract_memories</code> | <code>session_memory</code> | <code>compact_conversation</code> | <code>agent_summary</code> | <code>prompt_suggestion</code> | <code>side_question</code></div></td></tr></tbody></table>

runForkedAgent 确保 Prompt Cache 稳定的核心机制：运行时将任务所需的提示词约束作为 UserMessage 添加到 messages 的末尾。 ![[16dd6ca1-7431-44a4-80e7-8144d22cefba.png]]

●

执行管控：ForkedAgent 拥有主 Agent 所有工具，在启动时 传入 canUseTool ，在 hook 层面做工具执行拦截。

#### MicroCompact 链路

在压缩链路处理工具结果时，会对 Prompt Cache 的 TTL 时效进行判断，根据 Cache 的有效行选择压缩的策略：

●

Prompt Cache TTL 失效：缓存失效，下次再请求也是直接处理全量 Prompt ，直接在本地发起工具结果的裁剪压缩。

●

Prompt Cache 未失效：使用 cache\_edit 的能力，本地消息不动，上报需要服务端需要 cache\_edit 的工具结果，然后服务端进行删除，后续请求都会带着这个编辑信息，

#### Cache 生效范围控制

●

多用户共享同一 system prompt（一次 prewarm 摊给 N 次请求），Claude 中是 workspace 级别共享缓存。

○

Claude code 源码中利用此特性：scope 有 org、global 两种选项。

■

scope 为 org：缓存同一组织/账户生效。

■

scope 为 global 全局缓存（业务范畴的 Global，claude 模型 API 文档中并没有这个范围）。

#### ToolSearchTool & deferLoading

CC 的源码中在创建工具的时候也有 deferLoading 的机制（MCP Tool 默认 defer），使用时结合 claude 模型 ToolSearchTool 机制，保证 Prompt Cache 稳定。

1.

工具开启 defer\_loading 后，在未实际使用该工具的时候，只会将工具名加载到上下文中。

2.

实际使用时通过 ToolSearchTool 进行搜索，搜索返回会得到 tool\_reference ，标识搜索到的工具结果，自动在当前 turn 中展开工具信息。

●

不在前缀中插入，只在当前会话插入，不修改前缀内容。

实际使用的时候在 一个 Turn 中的示例：

工具：defer\_loading ：

{

"name": "get\_weather",

"description": "Get the current weather at a specific location. Returns temperature, condition, humidity and wind speed.",

...

"defer\_loading": true

}

问题： What is the weather in San Francisco?

模型： Response：

{

...

"content": \[

{

"type": "text",

"text": "I don't currently have a weather tool available to check the weather in San Francisco. Let me search to see if there's one I can access."

},

{

"type": "server\_tool\_use",

"id": "srvtoolu\_016cYB4iQRJp57fyYtyGVEoU",

"name": "tool\_search\_tool\_regex",

"input": {

"pattern": "weather|forecast|temperature"

}

},

{

"type": "tool\_search\_tool\_result",

"tool\_use\_id": "srvtoolu\_016cYB4iQRJp57fyYtyGVEoU",

"content": {

"type": "tool\_search\_tool\_search\_result",

"tool\_references": \[

{

"type": "tool\_reference",

"tool\_name": "get\_weather"

}

\]

}

claude\_tool\_search\_tool.py

#### Prompt Cache 命中率监控

Claude code 系统中，也将 Prompt Cache 的命中率作为自己的一个监控项。

●

进行 Prompt 内容记录（pre-call 时机），计算不同模块的 hash 值。

recordPromptState()

│

├─ 计算各维度 hash

│ ├─ systemHash（去除 cache\_control 后的 system prompt）

│ ├─ toolsHash（去除 cache\_control 后的 tool schemas）

│ ├─ cacheControlHash（仅 cache\_control 部分，捕获 scope/TTL 变化）

│ ├─...

│

├─ 和之前的记录内容 → 逐项比较变化并记录变化项，在上报时给出 Prompt Cache 未命中解释

│ ├─ systemPromptChanged

│ ├─ toolSchemasChanged

│ ├─ modelChanged

│ ├─...

└─ 记录新的 Prompt 状态快照值

●

Prompt 变化监控上报（post-call 时机）：

checkResponseForCacheBreak()

│

├─ \*\*判断是否发生缓存中断\*\*

│ ├─ cache read tokens 相比上次 下降超过 5% 且 token 下降值超 2000 tokens

│

├─ \*\*构建原因说明\*\*（reason）

│ ├─ 有 pendingChanges → 逐项拼接变化描述

│ │ ├─ model changed (A → B)

│ │ ├─ system prompt changed (+/-N chars)

│ │ ├─ tools changed (+N/-M tools)

│ │ ├─ fast mode toggled

│ │ ├─ global cache strategy changed

│ │ ├─ cache\_control changed (scope or TTL)

│ │ ├─...

│

├─ \*\*上报事件\*\* logEvent('tengu\_prompt\_cache\_break', {...})

│ └─ 包含所有变化标志、token 数据、时间差、requestId 等

### End

关于 TTFT ，自己因为是测试开发功能，token 数据量比较少，结果没啥代表性。大家可以基于自己的大 token 消耗的场景测试实际效果，评估下收益和当前 Cache 命中情况。

> Claude Code is built around prompt caching from day one; for the best results when building an agent, we suggest you do, too.

### 参考

END

Prompt Cache 特性

Explicit cache breakpoints 的使用

实际命中测试

缓存命中

Qwen 中的 Prompt Cache 机制

CC 工程链路中 Prompt Cache 机制的使用

runForkedAgent 链路

MicroCompact 链路

Cache 生效范围控制

ToolSearchTool & deferLoading

Prompt Cache 命中率监控

End

参考

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
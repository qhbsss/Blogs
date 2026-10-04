---
title: "AI从入门到精通第一篇：一文带你了解Spring Ai Alibaba ReactAgent底层原理"
source: "https://ata.atatech.org/articles/11020607623?spm=ata.23639420.0.0.15527536ZRM4Kl"
author:
published:
created: 2026-06-01
description:
tags:
  - "clippings"
---
## 一、前言：为什么要看 ReactAgent 的源码？

如果你最近在用 Spring AI Alibaba 做 Agent 开发，大概率会碰到 `ReactAgent` 这个类。它是框架里实现 ReAct（Reasoning + Acting）模式的核心组件，说白了就是让 LLM "想一步、做一步"，不断循环直到任务完成。

但用着用着我产生了一些疑问：

- `call()` 方法一调用，里面到底发生了什么？

- 工具是怎么注册进去的？LLM 是怎么"看到"这些工具的？

- Hook 和 Interceptor 这两个扩展机制，到底有什么区别？

- Skill 渐进式披露是怎么实现的，为什么 LLM 要先 `read_skill` 才能用工具？

这篇文章就从源码层面把这些问题搞清楚。我不会逐行贴代码，而是挑关键逻辑讲，配合流程图和时序图来建立起对 ReactAgent 底层原理的整体认知。

---

## 二、整体架构

在深入细节之前，我们先退一步看全局。ReactAgent 的核心组件关系大概长这样：

![[745e2631-9162-4eb9-8b7f-b9501d7e8b40.png]]

简单来说，ReactAgent 就是把 LLM 节点和工具节点编排成一个状态图，然后在图上跑 ReAct 循环。而 Hook 和 Interceptor 是两层扩展机制，让你可以在不改框架代码的情况下往里面"塞"自定义逻辑。

类继承关系也很清晰：

Agent (抽象基类，定义 invoke/stream API)

└─ BaseAgent (中间层，增加 schema 和 outputKey 管理)

└─ ReactAgent (具体实现，ReAct 循环的编排和执行)

接下来我们从 `call()` 方法开始，一路跟下去。

---

## 三、从 call() 出发 — 一次完整的执行流程

### 3.1 入口方法

当你写下 `reactAgent.call("帮我查一下今天杭州的天气")` 的时候，调用链是这样的：

```java
// ReactAgent.java
public AssistantMessage call(String message) {
    return doMessageInvoke(message, null);
}
private AssistantMessage doMessageInvoke(Object message, RunnableConfig config) {
    Map<String, Object> inputs = buildMessageInput(message); // 把 String 包装成 messages 列表
    return extractAssistantMessage(doInvoke(inputs, config)); // 执行图 + 提取最终消息
}
```

`buildMessageInput` 会把你传的字符串包装成 `UserMessage` ，放到一个 `{messages: [...], input: "..."}` 的 Map 里。这个 Map 就是状态图的初始输入。

### 3.2 完整时序图

下面这张时序图展示了从用户调用到拿到结果的完整流程。注意看 ReAct 循环那部分，这就是 ReactAgent 的核心：

![[f724e4ef-fdba-4fc4-9860-62f568da85fb.png]]

### 3.3 关键点解读

看完这个时序图，有几个关键点值得注意：

1\. 图的懒编译

`CompiledGraph` 不是在 `ReactAgent` 构造的时候就编译好的，而是第一次调用时才编译，并且加了 `synchronized` 锁保证线程安全：

```java
// Agent.java
public synchronized CompiledGraph getAndCompileGraph() {
    if (compiledGraph == null) {
        compiledGraph = getGraph().compile(compileConfig);
    }
    return compiledGraph;
}
```

2\. ReAct 循环的退出条件

LLM 返回的 `AssistantMessage` 如果没有 `tool_calls` ，就说明 LLM 认为任务完成了，循环就结束。这个路由逻辑在 `makeModelToTools()` 方法里：

```java
// ReactAgent.java - 简化版
private EdgeAction makeModelToTools(String modelDestination, String endDestination) {
    return state -> {
        Message lastMessage = getLastMessage(state);
        if (lastMessage instanceof AssistantMessage am && am.hasToolCalls()) {
            return AGENT_TOOL_NAME; // 有工具调用 → 去工具节点
        }
        return endDestination; // 没有工具调用 → 结束
    };
}
```

3\. 结果提取

最终从状态里取结果的逻辑也很有意思。如果配了 `outputKey` ，就从那个 key 取；否则从 `messages` 列表里取最后一个 `AssistantMessage` ：

```java
// ReactAgent.java
private AssistantMessage extractAssistantMessage(Optional<OverAllState> state) {
    if (StringUtils.hasLength(outputKey)) {
        return state.flatMap(s -> s.value(outputKey)).map(msg -> (AssistantMessage) msg).orElseThrow();
    }
    // 从 messages 列表中取最后一个 AssistantMessage
    return state.flatMap(s -> s.value("messages")).stream()
        .flatMap(list -> ((List<?>) list).stream().filter(msg -> msg instanceof AssistantMessage))
        .reduce((first, second) -> second) // 取最后一个
        .orElseThrow();
}
```

---

## 四、图的编排 — initGraph() 把零件组装成引擎

上一章我们看到了执行流程，但这个流程是怎么"编排"出来的呢？答案就在 `initGraph()` 方法里。ReactAgent 重写了父类的 `initGraph()` ，在里面构建了完整的状态图。

### 4.1 HookPosition — 四个卡位点

在讲图编排之前，先要理解 Hook 的四个位置，因为它们直接决定了图的拓扑结构：


| 位置             | 执行时机       | 频率            |
| -------------- | ---------- | ------------- |
| `BEFORE_AGENT` | Agent 启动前  | 整个 call 只执行一次 |
| `BEFORE_MODEL` | 每次 LLM 调用前 | 每轮循环都执行       |
| `AFTER_MODEL`  | 每次 LLM 调用后 | 每轮循环都执行       |
| `AFTER_AGENT`  | Agent 结束后  | 整个 call 只执行一次 |


### 4.2 编排出来的图长什么样

根据有没有配 Hook，图的形状会不一样。下面是配了所有类型 Hook 的完整拓扑：

![[20407472-3c36-4d40-b5f5-9dd22ac814b5.png]]

看到那个从 `TOOL → BM` 的回边了吗？这就是 ReAct 循环的核心：工具执行完之后，不是直接返回结果，而是回到 `BeforeModel Hook` ，重新进入下一轮 LLM 推理。这样 LLM 就能根据工具的执行结果来决定下一步怎么做。

### 4.3 源码里是怎么编排的

`initGraph()` 里的代码其实挺长的，但核心逻辑可以归纳为以下步骤：

```java
// ReactAgent.java initGraph() 简化版
protected StateGraph initGraph() {
    StateGraph graph = new StateGraph(name, keyStrategyFactory, stateSerializer);
    // 1. 添加核心节点
    graph.addNode(AGENT_MODEL_NAME, this.llmNode);
    if (hasTools) {
        graph.addNode(AGENT_TOOL_NAME, this.toolNode);
    }
    // 2. 把 Hook 按位置分类
    List<Hook> beforeAgentHooks = filterHooksByPosition(hooks, BEFORE_AGENT);
    List<Hook> afterAgentHooks = filterHooksByPosition(hooks, AFTER_AGENT);
    List<Hook> beforeModelHooks = filterHooksByPosition(hooks, BEFORE_MODEL);
    List<Hook> afterModelHooks = filterHooksByPosition(hooks, AFTER_MODEL);
    // 3. 为每个 Hook 创建图节点
    for (Hook hook: beforeAgentHooks) {
        graph.addNode(hookName + ".before", agentHook::beforeAgent);
    }
    //... 其他位置的 Hook 类似
    // 4. 确定入口/出口/循环入口/循环出口
    String entryNode = determineEntryNode(beforeAgentHooks, beforeModelHooks);
    String loopEntryNode = determineLoopEntryNode(beforeModelHooks);
    String loopExitNode = determineLoopExitNode(afterModelHooks);
    String exitNode = determineExitNode(afterAgentHooks);
    // 5. 连边
    graph.addEdge(START, entryNode);
    setupHookEdges(graph,...); // Hook 之间的连边
    setupToolRouting(graph,...); // 工具路由的条件边
    return graph;
}
```

这里有个很巧妙的设计：如果没有配任何 Hook，那 `entryNode` 就直接是 `AGENT_MODEL_NAME` ， `exitNode` 就是 `END` ，图退化成最简单的 `START → Model ⇆ Tool → END` 。Hook 是完全可选的，不用担心没有 Hook 的情况会出错。

### 4.4 JumpTo — Hook 的流程控制超能力

Hook 不仅仅能做"在某个时机执行一段逻辑"这么简单，它还能通过 `JumpTo` 枚举来控制执行流程的走向：


| JumpTo 值       | 含义           | 场景                     |
| -------------- | ------------ | ---------------------- |
| `JumpTo.model` | 跳转到 Model 节点 | 跳过后续 Hook，直接让 LLM 重新推理 |
| `JumpTo.tool`  | 跳转到 Tool 节点  | 跳过 LLM，直接执行工具          |
| `JumpTo.end`   | 终止 Agent     | 不需要继续了，直接结束            |


这是通过在状态里设置 `jump_to` 字段来实现的。图的条件边会检查这个字段来决定下一步去哪：

```java
// ReactAgent.java
EdgeAction router = state -> {
    JumpTo jumpTo = (JumpTo) state.value("jump_to").orElse(null);
    return resolveJump(jumpTo, modelDestination, endDestination, defaultDestination);
};
```

---

## 五、LLM 节点 — AgentLlmNode 的内幕

AgentLlmNode 是 ReactAgent 里最复杂的节点，因为它不只是简单地调一下 LLM，还要处理一堆前置和后置逻辑。

### 5.1 三层 Prompt 构建

LLM 节点在构建请求的时候，会叠加三层 prompt：

┌─────────────────────────────────────────────┐

│ Layer 1: System Prompt (系统级指令) │

│ "你是一个故障诊断专家..." │

├─────────────────────────────────────────────┤

│ Layer 2: Instruction (任务级指令) │

│ 插入到 messages 最前面作为 UserMessage │

│ "根据以下告警信息进行诊断..." │

├─────────────────────────────────────────────┤

│ Layer 3: OutputSchema (输出格式约束) │

│ 追加到最后一个 UserMessage 后面 │

│ "请以 JSON 格式输出: {analyseResult:...}" │

└─────────────────────────────────────────────┘

这三层是独立配置的，非常灵活。System Prompt 是全局不变的指令，Instruction 可以每次调用都不同（适合 SubGraph 场景），OutputSchema 则约束输出格式。

### 5.2 ModelInterceptor 拦截器链

在真正调用 LLM 之前，请求会经过一个拦截器链。这个链用的是经典的责任链模式：

![[8cfa0d74-fda3-443f-ab4f-46d84174b937.png]]

`InterceptorChain` 的组织方式是从后往前包裹，这样列表里排在前面的拦截器就在最外层：

```java
// InterceptorChain.java 简化版
public static ModelCallHandler chainModelInterceptors(
List<ModelInterceptor> interceptors, ModelCallHandler baseHandler) {
    ModelCallHandler current = baseHandler;
    // 从后往前包裹，确保第一个拦截器在最外层
    for (int i = interceptors.size() - 1; i >= 0; i--) {
        ModelInterceptor interceptor = interceptors.get(i);
        ModelCallHandler next = current;
        current = request -> interceptor.interceptModel(request, next);
    }
    return current;
}
```

### 5.3 动态工具注入

这是一个非常重要的机制。AgentLlmNode 在构建 ChatClient 请求时，会做两件事：

1. 过滤工具：如果 `ModelRequest` 指定了 `tools` 列表（工具名称），就只暴露这些工具给 LLM

2. 合并动态工具：把 `ModelRequest.dynamicToolCallbacks` （来自拦截器注入的）合并进去

```java
// AgentLlmNode.java 简化版
private List<ToolCallback> filterToolCallbacks(ModelRequest modelRequest) {
    List<ToolCallback> filtered;
    if (modelRequest.getTools()!= null &&!modelRequest.getTools().isEmpty()) {
        // 只保留请求指定的工具
        filtered = this.toolCallbacks.stream()
            .filter(cb -> modelRequest.getTools().contains(cb.getToolDefinition().name()))
            .collect(toList());
    } else {
        filtered = new ArrayList<>(this.toolCallbacks);
    }
    // 合并动态工具（来自 Interceptor 注入）
    if (modelRequest.getDynamicToolCallbacks()!= null) {
        filtered.addAll(modelRequest.getDynamicToolCallbacks());
    }
    return filtered;
}
```

动态工具会通过 `RunnableConfig.context()` 传递给 `AgentToolNode` ，这样 ToolNode 在执行时也能找到这些动态注入的工具。

---

## 六、工具执行 — AgentToolNode 的魔法

当 LLM 返回了 `tool_calls` ，执行流程就到了 AgentToolNode。这个节点负责找到对应的工具并执行它。

### 6.1 工具解析优先级

LLM 返回的 `tool_calls` 里只有工具名称和参数，AgentToolNode 需要根据名称找到对应的 `ToolCallback` 。查找顺序是这样的：

![[89b135f3-3dc8-42a1-9970-947f5978cabb.png]]

这个三级查找机制保证了工具的灵活性：你既可以在构建 Agent 时静态注册工具，也可以通过拦截器动态注入，还可以用 Resolver 做统一的工具管理。

### 6.2 顺序 vs 并行执行

AgentToolNode 支持两种执行策略。如果 LLM 一次返回了多个 `tool_calls` （比如同时查天气和查日历），可以选择并行执行：

顺序执行（默认）：

```java
// 每个工具用独立的 ConcurrentHashMap 存状态更新
for (AssistantMessage.ToolCall toolCall: toolCalls) {
    Map<String, Object> toolSpecificUpdate = new ConcurrentHashMap<>();
    ToolCallResponse response = executeToolCallWithInterceptors(toolCall, state, config, toolSpecificUpdate);
    toolResponses.add(response.toToolResponse());
    mergedUpdates.putAll(toolSpecificUpdate); // 立即合并，不怕后面超时清空
}
```

并行执行（配置 `parallelToolExecution=true` ）：

// 用 Semaphore 控制并发度，CompletableFuture 并行执行

Semaphore semaphore = new Semaphore(maxParallelTools); // 默认最多 5 个

List<CompletableFuture<Void>> futures = toolCalls.stream().map(toolCall ->

```java
CompletableFuture.runAsync(() -> {
    semaphore.acquire();
    try {
        // 执行工具
    } finally {
        semaphore.release();
    }
}, executor)
.orTimeout(toolExecutionTimeout.toMillis(), TimeUnit.MILLISECONDS)

).toList();

CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
```
并行模式下有个很精巧的设计：每个工具的状态更新是隔离的（通过 `ToolStateCollector` ），如果某个工具超时了，只清空它自己的状态更新，不影响已经成功的工具。而且超时的工具还支持"协作式取消"——通过 `CancellationToken` 通知工具优雅停止。

### 6.3 ToolInterceptor 拦截链

和 ModelInterceptor 类似，工具执行前后也有拦截器链：

```java
// AgentToolNode.java
ToolCallHandler baseHandler = req -> {
    ToolCallback toolCallback = resolve(req.getToolName(), config);
    String result = toolCallback.call(req.getArguments(), context);
    return ToolCallResponse.of(req.getToolCallId(), req.getToolName(), result);
};
// 套上拦截器链
ToolCallHandler chainedHandler = InterceptorChain.chainToolInterceptors(toolInterceptors, baseHandler);
return chainedHandler.call(request);
```

你可以在工具拦截器里做参数校验、调用日志、结果缓存、权限控制等横切逻辑。

---

## 七、Hook 和 Interceptor — 双层扩展体系

看到这里你可能会觉得 Hook 和 Interceptor 有点像，都是在某个时机插入自定义逻辑。但它们的定位其实很不一样：

### 7.1 核心区别


| 维度     | Hook             | Interceptor                          |
| ------ | ---------------- | ------------------------------------ |
| 作用层面   | 生命周期管理           | 请求/响应拦截                              |
| 执行方式   | 作为图中的独立节点执行      | 嵌入到 LlmNode/ToolNode 内部执行            |
| 返回值    | `Map` 状态更新       | `ModelResponse` / `ToolCallResponse` |
| 能力     | 可以控制流程走向（JumpTo） | 可以修改请求/响应内容                          |
| 适用场景   | 初始化、清理、中断、统计     | 重试、降级、缓存、校验                          |
| 在图中的位置 | 有独立的节点和边         | 在节点内部的拦截器链里                          |


一句话总结：Hook 管"什么时候做"，Interceptor 管"怎么做"。

### 7.2 一个 Hook 可以同时提供 Interceptor 和 Tool

这是一个很重要的设计：Hook 不只是一个简单的回调，它可以通过几个方法"贡献"更多能力给 Agent：

```java
public interface Hook {
    // 提供 Model 拦截器
    List<ModelInterceptor> getModelInterceptors();
    // 提供 Tool 拦截器
    List<ToolInterceptor> getToolInterceptors();
    // 提供额外工具
    List<ToolCallback> getTools();
    // 定义允许的流程跳转
    List<JumpTo> canJumpTo();
    // 定义状态合并策略
    Map<String, KeyStrategy> getKeyStrategys();
}
```

这意味着一个 Hook 可以同时做三件事：在特定时机执行代码、注入拦截器、注入工具。这种设计让 Hook 成为了一个能力聚合点。

### 7.3 实战案例：SkillsAgentHook 的渐进式工具披露

我们用一个实际的例子来看 Hook + Interceptor 是怎么协作的。 `SkillsAgentHook` 实现了一个叫"渐进式工具披露"的机制：不是一开始就把所有工具都暴露给 LLM，而是让 LLM 先读 Skill 说明，读了之后才把对应的工具加进来。

为什么要这么做？因为工具太多的话，LLM 会"选择困难"，而且 token 也会浪费在工具描述上。

看看时序图就清楚了：

![[e78864f0-b9fd-45b2-a281-17671eb1ef2a.png]]

整个流程涉及三个组件的配合：

1. SkillsAgentHook（Hook）：在 `beforeAgent` 时可选 reload Skills，通过 `getModelInterceptors()` 提供 SkillsInterceptor，通过 `getTools()` 提供 `read_skill` 工具

2. SkillsInterceptor（ModelInterceptor）：每轮 LLM 调用前，扫描消息历史里的 `read_skill` 调用，把对应 Skill 的工具动态注入到 `dynamicToolCallbacks`

3. ReadSkillTool（ToolCallback）：被 LLM 调用来读取 SKILL.md 的内容

关键源码：

```java
// SkillsInterceptor.java
public ModelResponse interceptModel(ModelRequest request, ModelCallHandler handler) {
    // 1. 扫描历史消息中的 read_skill 调用
    Set<String> readSkillNames = extractReadSkillNames(request.getMessages());
    // 2. 把对应 Skill 的工具加到动态工具列表
    List<ToolCallback> skillTools = new ArrayList<>(request.getDynamicToolCallbacks());
    for (String skillName: readSkillNames) {
        List<ToolCallback> toolsForSkill = groupedTools.get(skillName);
        if (toolsForSkill!= null) {
            skillTools.addAll(toolsForSkill);
        }
    }
    // 3. 注入 Skill 元数据到 system prompt
    String skillsPrompt = buildSkillsPrompt(skills, skillRegistry);
    SystemMessage enhanced = enhanceSystemMessage(request.getSystemMessage(), skillsPrompt);
    // 4. 构建修改后的请求
    ModelRequest modified = ModelRequest.builder(request)
        .systemMessage(enhanced)
        .dynamicToolCallbacks(skillTools)
        .build();
    return handler.call(modified);
}
```

注意一个重要的细节：工具一旦注入就会一直存在，因为 `extractReadSkillNames()` 每次都扫描所有历史消息。如果 LLM 先读了 Skill A 再读了 Skill B，那之后 A 和 B 的工具都可用。这是累积的，没有"卸载"机制。

---

## 八、Builder 模式 — 把零件组装成 Agent

最后我们来看看 `ReactAgent.builder().xxx().build()` 的时候到底发生了什么。 `DefaultBuilder` 的 `build()` 方法是整个组装过程的入口：

```java
// DefaultBuilder.java build() 简化版
public ReactAgent build() {
    // 1. 收集所有工具（五个来源）
    List<ToolCallback> allTools = gatherLocalTools();
    // 2. 构建 LLM 节点
    AgentLlmNode llmNode = AgentLlmNode.builder()
        .chatClient(chatClient)
        .instruction(instruction)
        .systemPrompt(systemPrompt)
        .outputSchema(outputSchema)
        .toolCallbacks(allTools)
        .build();
    // 3. 构建工具节点
    AgentToolNode toolNode = AgentToolNode.builder()
        .toolCallbacks(allTools)
        .parallelToolExecution(parallelToolExecution)
        .toolExecutionTimeout(toolExecutionTimeout)
        .build();
    // 4. 组装 ReactAgent
    return new ReactAgent(llmNode, toolNode, compileConfig, this);
}
```

工具的收集逻辑 `gatherLocalTools()` 是最有意思的部分，它从五个来源收集工具，按优先级排列：

hookTools ← 最高优先级，来自 Hook.getTools()

interceptorTools ← 来自 ModelInterceptor.getTools()

regularTools ← 直接通过.tools() 方法添加的

providerTools ← 来自 ToolCallbackProvider

resolverTools ← 来自 ToolCallbackResolver（兜底）

合并顺序很重要：Hook 工具排最前面，保证它们一定在 LLM 的工具列表里能被看到（有些 LLM 对工具列表靠前的工具有偏好）。

ReactAgent 的构造函数里还会做一件关键的事——把 Hook 提供的拦截器和 Builder 直接配的拦截器合并：

```java
// ReactAgent 构造函数

List<ModelInterceptor> mergedModelInterceptors = collectAndMergeModelInterceptors();

// 合并规则：名称相同的，Builder 直接配的优先（跳过 Hook 提供的同名拦截器）
```

---

## 九、总结 — 设计模式和架构亮点

### 9.1 用到的设计模式

回顾一下 ReactAgent 用到的设计模式，会发现框架的设计还是很讲究的：


| 设计模式    | 应用位置                      | 解决的问题                 |
| ------- | ------------------------- | --------------------- |
| 模板方法    | `Agent.initGraph()` 由子类重写 | 统一执行框架，子类只关心图编排       |
| 建造者模式   | `DefaultBuilder`          | 灵活组装复杂的 ReactAgent 对象 |
| 责任链模式   | `InterceptorChain`        | 多个拦截器按顺序处理请求/响应       |
| 策略模式    | `KeyStrategy` 、 `JumpTo`  | 可插拔的状态合并策略和流程控制       |
| 观察者模式   | Hook 的 before/after 回调    | 在生命周期关键点通知外部逻辑        |
| 装饰器模式   | Hook 给 Agent 添加能力         | 不修改 Agent 代码也能增加功能    |
| DCL 懒加载 | `getAndCompileGraph()`    | 线程安全 + 延迟编译           |


### 9.2 架构亮点

1. 图驱动的执行引擎：底层基于 LangGraph4J 的 StateGraph，Hook 的位置直接映射为图节点，条件边驱动 ReAct 循环。这让执行流程非常清晰可控。

2. Hook + Interceptor 双层扩展：Hook 管生命周期（做什么时候做），Interceptor 管请求处理（怎么做）。两者职责分明，又能通过 Hook.getModelInterceptors() 协作。

3. 渐进式工具披露：通过 SkillsAgentHook + SkillsInterceptor 实现了"先读说明再用工具"的模式，有效解决了工具过多导致 LLM 选择困难的问题。

4. 三级工具解析：静态注册 → 动态注入 → Resolver 兜底，既有编译期的确定性，又有运行时的灵活性。

5. 并行工具执行 + 状态隔离：并行模式下每个工具有独立的状态更新空间，超时了只丢弃自己的更新，不影响其他工具。

### 9.3 和其他框架的对比

跟 LangChain 的 AgentExecutor 或者 AutoGen 的 Agent 相比，Spring AI Alibaba 的 ReactAgent 有几个显著不同：

- 更 Java 原生：完全基于 Spring 生态（ChatClient、ToolCallback），不是 Python 框架的移植

- 图编排而非硬编码循环：ReAct 循环是通过 StateGraph 的条件边实现的，而不是一个 while 循环。这让流程的可观测性和可扩展性都更好

- 拦截器体系：ModelInterceptor 和 ToolInterceptor 的设计借鉴了 Spring MVC 的 HandlerInterceptor，对 Java 开发者来说非常熟悉

- Skill 机制：渐进式工具披露是一个独特的设计，其他框架通常是一次性把所有工具都给 LLM

---
title: "AgentScope源码探究：入门Agent推理主流程"
source: "https://ata.atatech.org/articles/11020602880?spm=ata.23639746.0.0.3d222a29mpDFWf"
author:
published:
created: 2026-05-11
description:
tags:
  - "clippings"
---

最近收到一个Agent的项目开发，过去一直在看大模型推理的知识，对于整个Agent的了解并不是很多，然后这次借着对AgentScope这款Agent框架的研究，一次性带着大家梳理完整个Agent推理过程中的各个流程，以及其是在AgentScope这样的框架中是如何实现的？

<https://github.com/agentscope-ai>

在AgentScope在github仓库上面贴了一张非常显眼的架构图，这里我借用一下：

![[2155ee6c-4aee-4792-8ff3-0a31c15f6aac.png]]

AgentScope是阿里巴巴通义实验室开发的一款全链路生态的Agent框架；包含了现今Agent框架能力中需要的几乎所有能力，比如MCP，Tool，Rag，Hook等等。其次也支持了市场上常用的大模型api和中间件能力，为开发者提供了大量易用的api进行集成，对Agent开发者来说非常易用；

官网总结了AgentScope的如下特点：

- Simple yet powerful: start building your agents in 5 minutes with built-in ReAct agent, tools, skills, human-in-the-loop steering, memory, planning, realtime voice, evaluation, model finetuning, etc.
- Extensible: large number of ecosystem integrations for tools, memory and observability; built-in support for protocols such as MCP, A2A and agent skills; message hub for flexible multi-agent orchestration and workflows.
- Production-ready：deploy and serve your agents locally, as serverless in the cloud, or on your K8s cluster with built-in OTel support and multi-language support.

我后面的介绍主要针对AgentScope-java版来，也方便大量的后端程序员学习和理解。

## Reactor响应式编程

响应式这个词语实际上在前端用的比较多，比如著名的响应式框架Vue。这是一种通过事件驱动，并执行回调函数一种异步实现方式。

在Java的Reactor的响应式库中，用两个比较重要异步操作模型，Mono和Flux，其实这两个差不太多，Mono是单值异步操作模型，Flux是多值异步模型；

先提供一个入门的例子带大家看一下 Mono是如何使用的：

```java
Mono.just("Hello")
    .doOnTerminate(() -> System.out.println("执行完成"))
    .subscribe(value -> System.out.println("值是：" + value),
               error -> System.out.println("发生错误：" + error));
```

在这个例子中，整个过程主要分为三步：

1. 首先 Mono.just("Hello") 创建一个Mono实例，其value为"Hello"；此时Mono并没有执行
2. 然后subscribe调用进行订阅，然后Mono执行执行异步操作，返回value值
3. 最终，回调subscribe的内部函数逻辑，完成整个流程。

其次，Mono和Flux的另一个能力就是通过这种异步编程的模型，进行链式流程的串联执行；这种符合流程编排的执行模式非常适用于Agent推理过程中的多步流程执行。

![[037ef334-d327-4772-8250-942718ccb0de.png]]

如上图所示，Reactor可以将多个Flux或者Mono实例拼接在一起，形成一个链式的flow，然后提供了map发放进行输出类型转换，异常方法终止流程等方式增加了整个flow的可编程性。可以参考如下代码：

```java
getUserById(userId)
    .flatMap(user -> getOrdersByUser(user.getId()))
    .flatMap(orders -> getProductsFromOrders(orders))
    .subscribe(products -> {
        System.out.println("最终商品列表：" + products);
    });
```

Reactor 响应式编程提供的异步操作 以及 流程编排能力非常适用于Agent推理过程中的多步执行，因此在AgentScope的推理主流程中也是通过Reactor 响应式框架中的Mono和Flux这两个实例对象完成的。

## ReActAgent初始化

ReActAgent是AgentScope框架提供的一个智能体，提供了包括tool，prompt，hook等基本能力，初始化方式如下

```java
ReActAgent agent = ReActAgent.builder().name("资源投放推荐机器人")
    .sysPrompt(SystemPrompt.SMART_HELPER_SYS_PROMPT)
    .model(model)
    .toolkit(toolkit)
    .hook(new StudioMessageHook(StudioManager.getClient()))
    .build();
```

ReActAgent的各个参数说明大家可以看官方文档的说明，都是一些Agent需要用到的信息：

[创建 ReAct 智能体 - AgentScope Java](https://java.agentscope.io/zh/quickstart/agent.html#)

## Hook钩子

这里我单独讲一下Hook钩子这个概念，这个在AgentScope中非常重要，后面我们会发现其在整个推理流程中几乎无处不在；Hook相当于在Agent推理过程中向编程者提供的一些自定义流程的手段，可以作用在Agent执行过程中的不同阶段，非常灵活；

AgentScope Java 使用统一事件模型，所有 Hook 都需要实现 `onEvent(HookEvent)` 方法：

- 基于事件：所有智能体活动生成事件
- 类型安全：对事件类型进行模式匹配
- 优先级排序：钩子按优先级执行（值越小优先级越高）
- 可修改：某些事件允许修改执行上下文

Hook提供了不同时期的事件执行类型，方便使用者在不同的阶段使用，主要的支持类型如下：

| 事件类型                | 时机     | 可修改 | 描述                  |
| ------------------- | ------ | --- | ------------------- |
| PreCallEvent        | 智能体调用前 | ❌   | 智能体开始处理之前（仅通知）      |
| PostCallEvent       | 智能体调用后 | ✅   | 智能体完成响应之后（可修改最终消息）  |
| PreReasoningEvent   | 推理前    | ✅   | LLM 推理之前（可修改输入消息）   |
| PostReasoningEvent  | 推理后    | ✅   | LLM 推理完成之后（可修改推理结果） |
| ReasoningChunkEvent | 推理流式期间 | ❌   | 流式推理的每个块（仅通知）       |
| PreActingEvent      | 工具执行前  | ✅   | 工具执行之前（可修改工具参数）     |
| PostActingEvent     | 工具执行后  | ✅   | 工具执行之后（可修改工具结果）     |
| ActingChunkEvent    | 工具流式期间 | ❌   | 工具执行进度块（仅通知）        |
| ErrorEvent          | 发生错误时  | ❌   | 发生错误时（仅通知）          |

举个简单的例子：如下是一个基于PreReasoningEvent的Hook，当Agent注册了该hook之后，会在推理执行前执行其内部逻辑，使用者可自定义定制。

```java
public class PromptEnhancingHook implements Hook {

    @Override
    public <T extends HookEvent> Mono<T> onEvent(T event) {
        if (event instanceof PreReasoningEvent e) {
            List<Msg> messages = new ArrayList<>(e.getInputMessages());
            messages.add(0, Msg.builder()
                    .role(MsgRole.SYSTEM)
                    .content(List.of(TextBlock.builder().text("逐步思考。").build()))
                    .build());
            e.setInputMessages(messages);
            return Mono.just(event);
        }
        return Mono.just(event);
    }
}
```

不难发现，Hook中的onEvent方法返回的实际上就是一个Mono实例；结合前面我们说的Reactor编程知识，整个Agent推理流程都是通过Mono/Flux的异步编程模型串联起来的。

## Agent推理入口

接下来，我们正式开始研究ReActAgent内部是如何执行的。

首先通过call方法进入推理流程：

```java
msg = agent.call(Msg.builder().textContent(userInput).build()).block();
```

这里的agent.call会返回一个Mono\<Msg\>实例，这是一个异步操作对象，其返回类型为Msg，也就是整个Agent执行完成之后的输出结果；

`block()` 是一个阻塞方法，它会等待 `Mono` 完成（成功或失败），并返回它的结果。如果 `Mono` 成功发射了值，则返回该值；如果出错，则抛出异常；如果没有值（如空的 `Mono<Void>` ），则返回 `null` 。所以这里就是等待Agent的执行完成，是一个阻塞等待的过程。

## call执行方法

call内部的执行就是Agent的推流大致流程，我们直接看代码：

```java
public final Mono<Msg> call(List<Msg> msgs) {
    return Mono.using(
            () -> {
                if (checkRunning && !running.compareAndSet(false, true)) {
                    throw new IllegalStateException(
                            "Agent is still running, please wait for it to finish");
                }
                resetInterruptFlag();
                return this;
            },
            resource -> TracerRegistry.get().callAgent(
                    this,
                    msgs,
                    () -> notifyPreCall(msgs)
                            .flatMap(this::doCall)
                            .flatMap(this::notifyPostCall)
                            .onErrorResume(createErrorHandler(msgs.toArray(new Msg[0])))),
            resource -> running.set(false),
            true);
}
```

Mono.using方式也是一个实例化Mono异步操作的方式，核心在于它的第三个参数，也就是：

```java
() -> notifyPreCall(msgs)                   // 前置Hook处理
       .flatMap(this::doCall)           // Agent推理执行
       .flatMap(this::notifyPostCall)   // 后置Hook处理
       .onErrorResume(createErrorHandler(msgs.toArray(new Msg[0]))))
```

call将整个执行过程拆成了三步：

1. 前置Hook处理：获取注册的hooks，执行hook内部的PreCallEvent事件；
2. Agent推理执行：执行流程中最重要的阶段，完成输入到输出的核心推理步骤，后文中详细介绍；
3. 后置Hook处理：获取注册的hooks，执行hook内部的PostCallEvent事件。

这里我以前置Hook处理为例说明：从源码可以看到，notifyPreCall方法会按照优先级取出hooks，通过链式调用的方法逐步执行其内部逻辑；这里的onEvent方法的传参是PreCallEvent，这样只要hook有对PreCallEvent事件的处理，就能实现hook逻辑。

```java
private Mono<List<Msg>> notifyPreCall(List<Msg> msgs) {
    PreCallEvent event = new PreCallEvent(this, msgs);
    Mono<PreCallEvent> result = Mono.just(event);
    for (Hook hook : getSortedHooks()) {
        result = result.flatMap(hook::onEvent);
    }
    return result.map(PreCallEvent::getInputMessages);
}
```

## Reasoning推理主流程

接下来，探究下整个Agent推理过程中最核心的主流程框架，也就是前面提到的doCall方法，doCall方法是一个抽象方法，不同的Agent框架可以通过实现该方法来自定义自己的执行过程；这里我们主要以ReActAgent智能体为例进行说明。

观察源码可以看到，ReActAgent的doCall执行的主要是reasoning方法，该方法梳理了整体的执行流程

```java
private Mono<Msg> reasoning(int iter, boolean ignoreMaxIters) {
    // Check maxIters unless ignoreMaxIters is set
    if (!ignoreMaxIters && iter >= maxIters) {
        return summarizing();
    }

    ReasoningContext context = new ReasoningContext(getName());

    return checkInterruptedAsync()                              // 检查请求是否中断
            .then(notifyPreReasoningEvent(prepareMessages()))   // 推理前置hook处理流程
            .flatMapMany(                                       // 将输入msg以及tools输入到大模型，完成推理输出
                    event -> {
                        GenerateOptions options =
                                event.getEffectiveGenerateOptions() != null
                                        ? event.getEffectiveGenerateOptions()
                                        : buildGenerateOptions();
                        return model.stream(
                                        event.getInputMessages(),
                                        toolkit.getToolSchemas(),
                                        options)
                                .concatMap(chunk -> checkInterruptedAsync().thenReturn(chunk));
                    })
            .doOnNext(                                          // 处理推理输出,写入上下文
                    chunk -> {
                        List<Msg> chunkMsgs = context.processChunk(chunk);
                        // Notify streaming hooks for each chunk message
                        for (Msg msg : chunkMsgs) {
                            notifyReasoningChunk(msg, context).subscribe();
                        }
                    })
            .then(Mono.defer(() -> Mono.justOrEmpty(context.buildFinalMessage())))  // 构建最终消息
            .onErrorResume(
                    InterruptedException.class,
                    error -> {
                        // Save accumulated message before propagating interrupt
                        Msg msg = context.buildFinalMessage();
                        if (msg != null) {
                            memory.addMessage(msg);
                        }
                        return Mono.error(error);
                    })
            .flatMap(this::notifyPostReasoning)                 // 推理后置hook处理流程
            .flatMap(                                           // 判断是否继续进行推理
                    event -> {
                        Msg msg = event.getReasoningMessage();
                        if (msg != null) {
                            memory.addMessage(msg);
                        }

                        // HITL stop
                        if (event.isStopRequested()) {
                            return Mono.just(
                                    msg.withGenerateReason(
                                            GenerateReason.REASONING_STOP_REQUESTED));
                        }

                        // gotoReasoning requested (e.g., by StructuredOutputHook)
                        if (event.isGotoReasoningRequested()) {
                            // Validation already done in PostReasoningEvent.gotoReasoning()
                            List<Msg> gotoMsgs = event.getGotoReasoningMsgs();
                            if (gotoMsgs != null) {
                                gotoMsgs.forEach(memory::addMessage);
                            }
                            // Continue to next iteration, ignoring maxIters for this entry
                            return reasoning(iter + 1, true);
                        }

                        // Check finish conditions
                        if (isFinished(msg)) {
                            return Mono.just(msg);
                        }

                        // Continue to acting
                        return checkInterruptedAsync().then(acting(iter));
                    })
            .switchIfEmpty(
                    Mono.defer(
                            () -> {
                                // No message was produced
                                return Mono.justOrEmpty((Msg) null);
                            }));
}
```

我对上面的流程按照源码执行步骤进行了拆分，主要分为以下几步：

1. 创建推理上下文：创建一个推理上下文对象，用于累积模型流式输出的chunk
2. 中断检查与前置事件通知：检查是否中断请求，准备消息列表，通知所有注册的前置推理hook
3. 模型流式推理：使用模型对输入消息和工具模式进行流式推理，对每个输出块都检查中断状态
4. chunk处理与hook通知：处理每个流式输出chunk，将其添加到推理上下文中；为每个chunk消息通知推理块事件钩子
5. 构建最终消息：从上下文构建最终的推理消息
6. 后置事件通知：通知所有注册的后置推理事件钩子
7. 执行决策逻辑：这是关键的决策步骤，会根据不同执行请求完成不同
8. 空结果处理：处理没有产生任何消息的情况

接下来我们对上面的每一个过程进行详细的说明

### 1、ReasoningContext推理上下文

```java
ReasoningContext context = new ReasoningContext(getName());
```

ReasoningContext用来存储整个推理主流程中的输入和输出信息，方便流程各个阶段进行交互和使用，主要的信息有：

```java
public class ReasoningContext {
    private final String agentName;    // agent名称
    private String messageId;          // 消息id

    private final TextAccumulator textAcc = new TextAccumulator();                // 累积text内容块，支持流式文本的实时显示和最终聚合
    private final ThinkingAccumulator thinkingAcc = new ThinkingAccumulator();    // 累积thinking内容块，支持模型思考过程的实时流式展
    private final ToolCallsAccumulator toolCallsAcc = new ToolCallsAccumulator(); // 累积tool调用内容块，支持多个并行的工具调用，处理片段化的工具调用数据

    private final List<Msg> allStreamedChunks = new ArrayList<>();  // 存储所有流式消息片段

    // ChatUsage
    private int inputTokens = 0;     // 输入token计数
    private int outputTokens = 0;    // 输出token计数
    private double time = 0;         // 推理时间计数
}
```

### 2、中断检查与前置推理事件通知

这部分比较简单，直接看源码吧；

中断检查：检查当前agent是否处于interrupt中断状态，中断状态的设置可以通过调用interreupt方法完成；

```java
protected Mono<Void> checkInterruptedAsync() {
    return Mono.defer(
            () ->
                    interruptFlag.get()
                            ? Mono.error(
                                    new InterruptedException("Agent execution interrupted"))
                            : Mono.empty());
}
```

前置推理事件通知：和hook机制一样，只是使用的Event不同，这个阶段使用的是PreReasoningEvent；注意这里有一个prepareMessages方法，这里会对大模型输入的信息进行整合，主要包括system prompt, user prompt以及history（后两个都放在了memory当中）；

```java
private List<Msg> prepareMessages() {
    List<Msg> messages = new ArrayList<>();
    if (sysPrompt != null && !sysPrompt.trim().isEmpty()) {
        messages.add(
                Msg.builder()
                        .name("system")
                        .role(MsgRole.SYSTEM)
                        .content(TextBlock.builder().text(sysPrompt).build())
                        .build());
    }
    messages.addAll(memory.getMessages());
    return messages;
}
```

### 3、模型流式推理

核心来了，这里Agent会完成和大模型model的交互，将前面处理和整合完成的输入信息提供给大模型，然后得到输出结果；

源码中大模型的输出是通过调用model.stream方法完成的，model就是我们在初始化ReActAgent时写入的model实例，比如阿里百炼平台的DashScopeModel：

```java
DashScopeChatModel model = DashScopeChatModel.builder()
    .apiKey(BaseSwitch.QWEN_API_KEY).modelName("qwen3-max").build();
```

model.stream方法的内部通过执行不同model类型的doStream方法完成，不同平台的Model实现doStream方法完成流式推理，这里以阿里百炼的DashScopeModel为例：

```java
protected Flux<ChatResponse> doStream(
        List<Msg> messages, List<ToolSchema> tools, GenerateOptions options) {

    Flux<ChatResponse> responseFlux = streamWithHttpClient(messages, tools, options);

    // Apply timeout and retry if configured
    return ModelUtils.applyTimeoutAndRetry(
            responseFlux, options, defaultOptions, modelName, "dashscope");
}
```

doStream内部调用streamWithHttpClient，其会封装http请求和大模型完成交互：

```java
private Flux<ChatResponse> streamWithHttpClient(
        List<Msg> messages, List<ToolSchema> tools, GenerateOptions options) {
    Instant start = Instant.now();
    boolean useMultimodal = httpClient.requiresMultimodalApi(modelName, endpointType);

    // Merge options with defaultOptions (options takes precedence)
    GenerateOptions effectiveOptions = GenerateOptions.mergeOptions(options, defaultOptions);
    ToolChoice toolChoice = effectiveOptions.getToolChoice();

    // Format messages using formatter
    List<DashScopeMessage> dashScopeMessages;
    if (useMultimodal) {
        if (formatter instanceof DashScopeChatFormatter chatFormatter) {
            dashScopeMessages = chatFormatter.formatMultiModal(messages);
        } else if (formatter instanceof DashScopeMultiAgentFormatter multiAgentFormatter) {
            dashScopeMessages = multiAgentFormatter.formatMultiModal(messages);
        } else {
            throw new IllegalStateException(
                    "DashScope vision models require DashScopeChatFormatter or"
                            + " DashScopeMultiAgentFormatter, but got: "
                            + formatter.getClass().getName());
        }
    } else {
        dashScopeMessages = formatter.format(messages);
    }

    // Build request using formatter
    DashScopeRequest request;
    if (formatter instanceof DashScopeChatFormatter chatFormatter) {
        request =
                chatFormatter.buildRequest(
                        modelName,
                        dashScopeMessages,
                        stream,
                        options,
                        defaultOptions,
                        tools,
                        toolChoice);
    } else if (formatter instanceof DashScopeMultiAgentFormatter multiAgentFormatter) {
        request = multiAgentFormatter.buildRequest(modelName, dashScopeMessages, stream);
        // Apply options and tools manually for multi-agent formatter
        multiAgentFormatter.applyOptions(request, options, defaultOptions);
        multiAgentFormatter.applyTools(request, tools);
        multiAgentFormatter.applyToolChoice(request, toolChoice);
    } else {
        throw new IllegalStateException(
                "Unsupported formatter type: " + formatter.getClass().getName());
    }

    // Apply thinking mode if enabled
    applyThinkingMode(request, effectiveOptions);

    // Set endpoint type for endpoint selection
    request.setEndpointType(endpointType);

    if (stream) {
        // Streaming mode
        return httpClient.stream(
                        request,
                        effectiveOptions.getAdditionalHeaders(),
                        effectiveOptions.getAdditionalBodyParams(),
                        effectiveOptions.getAdditionalQueryParams())
                .map(response -> formatter.parseResponse(response, start));
    } else {
        // Non-streaming mode
        return Flux.defer(
                        () -> {
                            try {
                                DashScopeResponse response =
                                        httpClient.call(
                                                request,
                                                effectiveOptions.getAdditionalHeaders(),
                                                effectiveOptions.getAdditionalBodyParams(),
                                                effectiveOptions.getAdditionalQueryParams());
                                ChatResponse chatResponse =
                                        formatter.parseResponse(response, start);
                                return Flux.just(chatResponse);
                            } catch (Exception e) {
                                log.error("DashScope HTTP client error: {}", e.getMessage(), e);
                                return Flux.error(
                                        new ModelException(
                                                "DashScope API call failed: " + e.getMessage(),
                                                e));
                            }
                        })
                .subscribeOn(Schedulers.boundedElastic());
    }
}
```

1、处理options参数：主要是大模型相关的参数(top-k等)

2、格式化输入构建DashScopeMessage：判断输入是否为useMultimodal，这种格式相对于用户输入中的消息包含了role信息，比如system，tool等等；而反之就是简单的用户输入，都是user prompt。

可以看到DashScopeMessage对象内部的属性其实就是对应的标准OpenAI API的JSON格式化信息。不清楚的可以看下这个博客，介绍的很清晰：

<https://juejin.cn/post/7616943516188655616>

```java
public class DashScopeMessage {

    /** Message role: "system", "user", "assistant", or "tool". */
    @JsonProperty("role")
    private String role;

    /**
     * Message content.
     * Can be String for text-only, or List<DashScopeContentPart> for multimodal.
     */
    @JsonProperty("content")
    private Object content;

    /** Tool name (for role="tool"). */
    @JsonProperty("name")
    private String name;

    /** Tool call ID (for role="tool"). */
    @JsonProperty("tool_call_id")
    private String toolCallId;

    /** Tool calls made by assistant. */
    @JsonProperty("tool_calls")
    private List<DashScopeToolCall> toolCalls;

    /** Reasoning/thinking content (for assistant messages with thinking enabled). */
    @JsonProperty("reasoning_content")
    private String reasoningContent;
}
```

3、构建模型请求DashScopeRequest：请求封装，主要的信息如下：

```java
public class DashScopeRequest {

    /** The model name (e.g., "qwen-plus", "qwen-vl-max"). */
    @JsonProperty("model")
    private String model;     // 使用模型

    /** The input containing messages. */
    @JsonProperty("input")
    private DashScopeInput input;   // 前面的DashScoputMessage封装在该对象中

    /** The generation parameters. */
    @JsonProperty("parameters")
    private DashScopeParameters parameters;   // 大模型推理参数，对应Options
}
```

4、通过HttpClient请求大模型：主流的大模型Api厂商大多数都提供了开放的api调用方式，这里就是通过Http请求的方式和百炼平台进行交互，获取输出信息。

主要有stream-mode和Non-steram mode两种形式，这个相信大家都很清楚，stream-mode就是类似一个字一个字持续输出的形式，相反Non-steram mode就是一次性完成请求。这里我将stream-mode的流式输出模式单独拎出来讲一下，也带着大家熟悉一下SSE协议；

Stream-mode流式现在主流的交互方案是SSE协议，这个协议可以和过去大家熟悉的WebSocket协议进行对比学习，这里我贴一张图来说明二者的区别：

| 特性   | SSE (Server-Sent Events) | WebSocket              |
| ---- | ------------------------ | ---------------------- |
| 通信方向 | 单向(服务器 -> 客户端)           | 双向(全双工)                |
| 协议   | HTTP                     | 独立的 WS/WSS 协议 (基于 TCP) |
| 数据格式 | 文本(UTF-8)                | 文本和二进制帧                |
| 复杂度  | 简单                       | 相对复杂                   |
| 自动重连 | 内置支持                     | 需要手动实现                 |

![[9de584e2-0905-44c2-a3dc-719f062dbeb4.png]]

简单来说，SSE就是一个通过Server-Client的持续单向交互协议，这种形式基本上完美的适配了当前的大模型交互需求；我结合AgentScope内部的JdkHttpTransport方法进行说明：

```java
public Flux<String> stream(HttpRequest request) {
    if (closed.get()) {
        return Flux.error(new HttpTransportException("Transport has been closed"));
    }

    var jdkRequest = buildJdkRequest(request);

    // Check status code and read error body immediately when CompletableFuture completes
    // to avoid stream being closed before we can read it
    CompletableFuture<java.net.http.HttpResponse<InputStream>> future =
            client.sendAsync(jdkRequest, BodyHandlers.ofInputStream())
                    .thenApply(
                            response -> {
                                int statusCode = response.statusCode();
                                if (statusCode < 200 || statusCode >= 300) {
                                    // Read error body immediately while stream is still open
                                    String errorBody = readInputStream(response.body());
                                    log.warn(
                                            "HTTP request failed. URL: {} | Status: {} | Error:"
                                                    + " {}",
                                            request.getUrl(),
                                            statusCode,
                                            errorBody);
                                    throw new CompletionException(
                                            new HttpTransportException(
                                                    "HTTP request failed with status "
                                                            + statusCode
                                                            + " | "
                                                            + errorBody,
                                                    statusCode,
                                                    errorBody));
                                }
                                return response;
                            });

    return Mono.fromCompletionStage(future)
            .flatMapMany(response -> processStreamResponse(response, request))
            .publishOn(Schedulers.boundedElastic())
            .onErrorMap(
                    e -> !(e instanceof HttpTransportException),
                    e -> {
                        Throwable cause = e instanceof CompletionException ? e.getCause() : e;
                        if (cause instanceof HttpTransportException) {
                            return (HttpTransportException) cause;
                        }
                        return new HttpTransportException(
                                "SSE/NDJSON stream failed: " + e.getMessage(), e);
                    })
            .subscribeOn(Schedulers.boundedElastic());
}
```

这里会构建一个sse的异步请求，请求内部会塞上SSE的头信息("X-DashScope-SSE","enable")，告诉平台这是一个SSE的流式请求：

```java
if (streaming) {
    headers.put("X-DashScope-SSE", "enable");
}
```

请求之后，HttpClient客户端会得到response响应的流式对象InputStream，这个对象就是SSE协议中进行Event事件交互的实例，Server服务端会不断往这个流中塞入信息，Client持续读取知道读取到结束符。

```java
private Flux<String> readSseLines(BufferedReader reader) {
    return Flux.fromStream(reader.lines())
            .filter(line -> line.startsWith(SSE_DATA_PREFIX))
            .map(line -> line.substring(SSE_DATA_PREFIX.length()).trim())
            .takeWhile(data -> !SSE_DONE_MARKER.equals(data))
            .doOnNext(data -> log.debug("Received SSE data chunk"))
            .filter(data -> !data.isEmpty());
}
```

这里的 `Flux.fromStream(reader.lines())` 实际上就是个多值的异步操作，每次从reader中读出一行，然后进行解析处理处理交给上层，直到读到休止符"[DONE]"。

然后将模型文本输出进行格式化得到模型格式化输出DashScopeResponse；

```java
transport.stream(httpRequest)
    .map(
            data -> {
                try {
                    // Decrypt response if encryption is enabled
                    if (finalEncryptionContext != null) {
                        data = decryptResponse(data, finalEncryptionContext);
                    }
                    return JsonUtils.getJsonCodec()
                            .fromJson(data, DashScopeResponse.class);
                } catch (JsonException e) {
                    log.warn(
                            "Failed to parse SSE data: {}. Error: {}",
                            data,
                            e.getMessage());
                    // Return null and filter out later
                    return null;
                }
            })
```

### 5、将模型格式化输出DashScopeResponse转为ChatResponse

```java
public ChatResponse parseResponse(DashScopeResponse result, Instant startTime) {
    return responseParser.parseResponse(result, startTime);
}
```

### 4、chunk处理与hook通知

当我们拿到了模型的输出chunk之后，需要对chuck进行处理；也可以针对每个chunk定制hook逻辑。

chunk处理：主要是将chunk的推理输出信息记录到Reasoning推理上下文中，用于本次的推理使用。

```java
public List<Msg> processChunk(ChatResponse chunk) {
    this.messageId = chunk.getId();

    // Accumulate ChatUsage
    ChatUsage usage = chunk.getUsage();
    if (usage != null) {
        inputTokens = usage.getInputTokens();
        outputTokens = usage.getOutputTokens();
        time = usage.getTime();
    }

    List<Msg> streamingMsgs = new ArrayList<>();

    for (ContentBlock block : chunk.getContent()) {
        if (block instanceof TextBlock tb) {
            textAcc.add(tb);

            // Emit text block immediately
            Msg msg = buildChunkMsg(tb);
            streamingMsgs.add(msg);
            allStreamedChunks.add(msg);

        } else if (block instanceof ThinkingBlock tb) {
            thinkingAcc.add(tb);

            // Emit thinking block immediately
            Msg msg = buildChunkMsg(tb);
            streamingMsgs.add(msg);
            allStreamedChunks.add(msg);

        } else if (block instanceof ToolUseBlock tub) {
            // Accumulate tool calls and emit immediately for real-time streaming
            toolCallsAcc.add(tub);

            // Emit ToolUseBlock chunk immediately for real-time display
            // Each tool call chunk is emitted separately, supporting multiple parallel tool
            // calls
            // For fragments (placeholder names like "__fragment__"), we need to include
            // the correct tool call ID so users can properly concatenate the chunks
            ToolUseBlock outputBlock = enrichToolUseBlockWithId(tub);
            Msg msg = buildChunkMsg(outputBlock);
            streamingMsgs.add(msg);
            allStreamedChunks.add(msg);
        }
    }

    return streamingMsgs;
}
```

hook通知：举个简单的例子，在流式输出的场景中，我们需要将SSE流中的每个chunk立马显示到客户端，形成一种流式输出的UI形式，这时候就需要在这个地方使用hook了，这是针对chunk使用的hook事件执行；使用的是ReasoningChunkEvent。

```java
// Notify streaming hooks for each chunk message
for (Msg msg : chunkMsgs) {
    notifyReasoningChunk(msg, context).subscribe();
}
```

可以看到，这个hook实例化之后立马使用了 `subscribe()` 执行，相当于在主流程中执行的子线程，并不是和其他主流程阶段一样使用串行的模型。

### 5、构建最终消息

这一步比较简单，就是将ReasoningContext上下文中的推理信息进行整合，然后拼接成最终的输出信息：

```java
public Msg buildFinalMessage() {
    List<ContentBlock> blocks = new ArrayList<>();

    // Add thinking content if present
    if (thinkingAcc.hasContent()) {
        blocks.add(thinkingAcc.buildAggregated());
    }

    // Add text content if present
    if (textAcc.hasContent()) {
        blocks.add(textAcc.buildAggregated());
    }

    // Add all tool calls
    List<ToolUseBlock> toolCalls = toolCallsAcc.buildAllToolCalls();
    blocks.addAll(toolCalls);

    // If no content at all, return null
    if (blocks.isEmpty()) {
        return null;
    }

    // Build metadata with accumulated ChatUsage
    Map<String, Object> metadata = new HashMap<>();
    if (inputTokens > 0 || outputTokens > 0 || time > 0) {
        ChatUsage chatUsage =
                ChatUsage.builder()
                        .inputTokens(inputTokens)
                        .outputTokens(outputTokens)
                        .time(time)
                        .build();
        metadata.put(MessageMetadataKeys.CHAT_USAGE, chatUsage);
    }

    return Msg.builder()
            .id(messageId)
            .name(agentName)
            .role(MsgRole.ASSISTANT)
            .content(blocks)
            .metadata(metadata)
            .build();
}
```

### 6、后置推理事件通知

和前面的hook的类似，这里使用的后置推理事件PostReasoningEvent

```java
private Mono<PostReasoningEvent> notifyPostReasoning(Msg msg) {
    return notifyHooks(new PostReasoningEvent(this, model.getModelName(), null, msg));
}
```

### 7、执行决策逻辑

这里主要就是对推理执行的判断，是否结束推理，或者继续推理；

```java
event -> {
    Msg msg = event.getReasoningMessage();
    if (msg != null) {
        memory.addMessage(msg);
    }

    // HITL stop
    if (event.isStopRequested()) {
        return Mono.just(
                msg.withGenerateReason(
                        GenerateReason.REASONING_STOP_REQUESTED));
    }

    // gotoReasoning requested (e.g., by StructuredOutputHook)
    if (event.isGotoReasoningRequested()) {
        // Validation already done in PostReasoningEvent.gotoReasoning()
        List<Msg> gotoMsgs = event.getGotoReasoningMsgs();
        if (gotoMsgs != null) {
            gotoMsgs.forEach(memory::addMessage);
        }
        // Continue to next iteration, ignoring maxIters for this entry
        return reasoning(iter + 1, true);
    }

    // Check finish conditions
    if (isFinished(msg)) {
        return Mono.just(msg);
    }

    // Continue to acting
    return checkInterruptedAsync().then(acting(iter));
})
```

我主要讲一下 `event.isGotoReasoningRequested()` 判断这个地方，这是一个继续推理的标志，当为true时，Agent会递归调用reasoning方法进行下一轮的推理。通常用于需要连续和大模型进行交互的场景，我这里以AgentScope内部的一个结构化输出功能为例，看看他是怎么做的。

首先我们要清楚，如果要实现这种连续推理，需要将PostReasoningEvent的gotoReasoningMsgs填充进去，用于下次递归推理，我们来看看结构化输出StructuredOutputHook怎么做的。

在StructuredOutputHook，会执行gotoReasoning来填充PostReasoningEvent的gotoReasoningMsgs信息。

```java
private void handlePostReasoning(PostReasoningEvent event) {
    Msg msg = event.getReasoningMessage();
    if (msg == null) {
        return;
    }

    boolean hasCall = !msg.getContentBlocks(ToolUseBlock.class).isEmpty();

    if (!hasCall && retryCount < MAX_RETRIES) {
        retryCount++;
        log.debug(
                "Model didn't call any tool, requesting retry ({}/{})",
                retryCount,
                MAX_RETRIES);

        // Add reminder message and goto reasoning
        event.gotoReasoning(createReminderMessage(reminderMode));
    }
    // If max retries exceeded, let it continue to summarizing which will report error
}
```

Msg输入信息如下，可以看到StructuredOutputHook递归推理时补充了prompt信息："Please call the 'generate_response' function to provide your response"，这里相当于要求大模型调用generate_response方法区结构化输出。

```java
private Msg createReminderMessage(StructuredOutputReminder mode) {
    Map<String, Object> metadata =
            Map.of(
                    MessageMetadataKeys.STRUCTURED_OUTPUT_REMINDER,
                    true,
                    MessageMetadataKeys.STRUCTURED_OUTPUT_REMINDER_TYPE,
                    mode.toString());

    return Msg.builder()
            .name("system")
            .role(MsgRole.USER)
            .content(
                    TextBlock.builder()
                            .text(
                                    "Please call the 'generate_response' function to provide"
                                            + " your response.")
                            .build())
            .metadata(metadata)
            .build();
}
```

generate_response就是在初始化Agent时写入的一个tool，其作用就是进行输出格式化；

```java
// Create and register temporary tool
Map<String, Object> jsonSchema =
        targetClass != null
                ? JsonSchemaUtils.generateSchemaFromClass(targetClass)
                : JsonSchemaUtils.generateSchemaFromJsonNode(schemaDesc);
AgentTool structuredOutputTool =
        createStructuredOutputTool(jsonSchema, targetClass, schemaDesc);
toolkit.registerAgentTool(structuredOutputTool);
```

### 8、空结果处理

```java
.switchIfEmpty(
        Mono.defer(
                () -> {
                    // No message was produced
                    return Mono.justOrEmpty((Msg) null);
                }));
```

## Acting工具调用

上一个部分我们聊完了reasoning推理，接下来我们来看看agent的第二个主流程，也就是acting的工具调用；首先我先了解什么是acting，以及调用acting的时机是什么时候；

acting其实也就是tool调用，我们知道现在的agent之所以这么强大，就是因为其具备了tool调用的能力，也就是过去常说的function call，我们可以看到大模型交互的协议中，除了user system prompt这些输入信息之外，另外一个比较重要的信息就是tool。

```json
{
   "tools": [
     {
      "name": "interact_case_detail",
      "description": "检索现有的所有互动案例信息，在用户需要"查询已有案例"或者需要"根据案例和剧情进行结合"，"推荐案例投放点位"等情况时查询使用",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      },
      "strict": null
    }
   ]
}
```

那么agent怎么知道什么时候去使用tool呢？其实也是通过大模型推理判断的，当我们将大量的prompt和tool信息交给大模型之后，大模型会除了会返回基本的text文本或者其他多模态信息之外，另外一个非常重要的就是tool_use信息，也就是告诉agent需要调用哪个tool，当agent收到之后就会去执行具体的调用过程：

```json
{
    "type": "tool_use",
    "id": "call_10ca8081261f4ad09cbcd484",
    "name": "plot_search_interact",
    "input": {
        "vdoEp": "长安二十四计 17"
    },
    "content": "{\"vdoEp\": \"长安二十四计 17\"}",
    "metadata": {}
}
```

接下来，正式进入agentscope的acting调用流程讲解：

## Acting流程入口

前面也提到了，执行acting工具调用的判断就是大模型的返回中用没有明确通过 tool_use 的指示来指定工具调用；因此在前面的reasoning推理过程中的 第七步. 执行决策逻辑中，就有这样的流程：

```java
// Check finish conditions
if (isFinished(msg)) {
    return Mono.just(msg);
}
// Continue to acting
return checkInterruptedAsync().then(acting(iter));
```

深入到 isFinished 和checkInterruptedAsync 方法中

```java
private boolean isFinished(Msg msg) {
    if (msg == null) {
        return true;
    }
    List<ToolUseBlock> toolCalls = msg.getContentBlocks(ToolUseBlock.class);
    // No tool calls - finished
    // If there are tool calls (even non-existent ones), continue to acting phase
    // where ToolExecutor will return "Tool not found" error for the model to see
    return toolCalls.isEmpty();
}
```

isFinished方法本质上刚刚我们提到的，检查大模型的输出当中有没有明确指出使用tool_use，如果有的话表示推理并没有结束，需要继续执行acting过程；

checkInterruptedAsync就是检查中断，这个是用户手动执行的，不再过多赘述。

## Acting主链路分析

和Reasoning类型，Acting也是将整体的调用流程拆成了多个部分，我们可以通过源码看一下

```java
private Mono<Msg> acting(int iter) {
    // Extract only pending tool calls (those without results in memory)
    List<ToolUseBlock> pendingToolCalls = extractPendingToolCalls();

    if (pendingToolCalls.isEmpty()) {
        // No pending tools have been executed, continue to next iteration
        return executeIteration(iter + 1);
    }

    // Set chunk callback for streaming tool responses
    toolkit.setChunkCallback((toolUse, chunk) -> notifyActingChunk(toolUse, chunk).subscribe());

    // Execute only pending tools (those without results in memory)
    return notifyPreActingHooks(pendingToolCalls)
            .flatMap(this::executeToolCalls)
            .flatMap(
                    results -> {
                        // Separate success and pending results
                        List<Map.Entry<ToolUseBlock, ToolResultBlock>> successPairs =
                                results.stream()
                                        .filter(e -> !e.getValue().isSuspended())
                                        .toList();
                        List<Map.Entry<ToolUseBlock, ToolResultBlock>> pendingPairs =
                                results.stream()
                                        .filter(e -> e.getValue().isSuspended())
                                        .toList();

                        // If no success results to process
                        if (successPairs.isEmpty()) {
                            if (!pendingPairs.isEmpty()) {
                                return Mono.just(buildSuspendedMsg(pendingPairs));
                            }
                            return executeIteration(iter + 1);
                        }

                        // Process success results through hooks and add to memory
                        return Flux.fromIterable(successPairs)
                                .concatMap(this::notifyPostActingHook)
                                .last()
                                .flatMap(
                                        event -> {
                                            // HITL stop (also triggered by
                                            // StructuredOutputHook when completed)
                                            if (event.isStopRequested()) {
                                                return Mono.just(
                                                        event.getToolResultMsg()
                                                                .withGenerateReason(
                                                                        GenerateReason
                                                                                .ACTING_STOP_REQUESTED));
                                            }

                                            // If there are pending results, build suspended Msg
                                            if (!pendingPairs.isEmpty()) {
                                                return Mono.just(
                                                        buildSuspendedMsg(pendingPairs));
                                            }

                                            // Continue next iteration
                                            return executeIteration(iter + 1);
                                        });
                    });
}
```

1. 提取待执行工具tool_use ：获取大模型输出中的tool_use 信息，用于后续的tool调用
2. 注册流式回调：Hook Event中的一种，用于工具执行中的流式 chunk 实时通知
3. 前置Acting事件通知：Hook Event中的一种，用于acting执行前的hook
4. 执行tool工具调用：实际执行工具
5. 处理执行结果（分流）：对执行结果进行分析

接下来我们从上面五个步骤逐一讲解

### 1\. 提取待执行工具tool_use

```java
private List<ToolUseBlock> extractPendingToolCalls() {
    List<ToolUseBlock> allToolCalls = extractRecentToolCalls();
    if (allToolCalls.isEmpty()) {
        return List.of();
    }
    Set<String> pendingIds = getPendingToolUseIds();
    return allToolCalls.stream()
        .filter(toolUse -> pendingIds.contains(toolUse.getId()))
        .toList();
}
```

提取大模型输出中的tool_use的信息，和大模型输入中的可用的tool进行匹配分析；

注意：这里的pending tool提取是不包含memory上下文中的tool块的，其不可用。

### 2\. 注册流式回调

这一步会为toolkit注册一个回调的hook onEvent执行，用户处理工具调用过程中的流式输出chunk

```java
private Mono<Void> notifyActingChunk(ToolUseBlock toolUse, ToolResultBlock chunk) {
    ActingChunkEvent event =
            new ActingChunkEvent(
                    this,
                    toolkit,
                    toolUse,
                    chunk.withIdAndName(toolUse.getId(), toolUse.getName()));
    return Flux.fromIterable(getSortedHooks()).flatMap(hook -> hook.onEvent(event)).then();
}
```

使用到的event是 ActingChunkEvent ，工具调用chunk事件处理。

### 3\. 前置Acting事件通知

和前面的Event类似，这里用到的Event是PreActingEvent，用于acting调用工具调用前的hook执行

```java
private Mono<List<ToolUseBlock>> notifyPreActingHooks(List<ToolUseBlock> toolCalls) {
    return Flux.fromIterable(toolCalls)
        .concatMap(tool -> notifyHooks(new PreActingEvent(this, toolkit, tool)))
        .map(PreActingEvent::getToolUse)
        .collectList();
}
```

### 4\. 执行tool工具调用

到这里整个acting工具调用流程才进入到重点，和reasoning中的agent与模型的交互类似，这里会涉及到agent和tool的交互，我们来看看是怎么做的吧；

1、首先，tool调用的过程会交给ToolExecutor进行执行，其分为两种执行方式：Parallel并行执行 或者 sequential 并行执行。这个执行方式是通过Flux的响应式编程方法实现的。

```java
// Map each tool call to an execution Mono
List<Mono<ToolResultBlock>> monos =
        toolCalls.stream()
                .map(
                        toolCall ->
                                executeWithInfrastructure(
                                        toolCall, executionConfig, agent, agentContext))
                .toList();

// Parallel or sequential execution
if (parallel) {
    return Flux.mergeSequential(monos).collectList();
}
return Flux.concat(monos).collectList();
```

2、深入到 executeWithInfrastructure 内部，整个execute执行分为了以下几步

```java
// Build tool call parameter
ToolCallParam param =
        ToolCallParam.builder()
                .toolUseBlock(toolCall)
                .agent(agent)
                .context(agentContext)
                .build();

// Get core execution
Mono<ToolResultBlock> execution = execute(param);

// Apply infrastructure layers
execution = applyScheduling(execution);
execution = applyTimeout(execution, executionConfig, toolCall);
execution = applyRetry(execution, executionConfig, toolCall);

// Add tool metadata and error handling
return execution
        .map(result -> result.withIdAndName(toolCall.getId(), toolCall.getName()))
        .onErrorResume(
                e -> {
                    logger.warn("Tool call failed: {}", toolCall.getName(), e);
                    String errorMsg = ExceptionUtils.getErrorMessage(e);
                    return Mono.just(
                            ToolResultBlock.error("Tool execution failed: " + errorMsg));
                });
```

- 构建tool请求参数：使用到agent注册的tool上下文和大模型返回的tool_use信息
- 执行核心调用流程：适配不同的客户端，比如MCP等，执行具体的调用
- 叠加基础能力：线程池分配、超时控制、失败重试等能力
- 封装tool调用结构：对tool返回进行对象封装

3、核心execute执行流程

```java
ToolUseBlock toolCall = param.getToolUseBlock();
AgentTool tool = toolRegistry.getTool(toolCall.getName());

if (tool == null) {
    return Mono.just(ToolResultBlock.error("Tool not found: " + toolCall.getName()));
}

// Check tool activation
RegisteredToolFunction registered = toolRegistry.getRegisteredTool(toolCall.getName());
if (registered != null && !groupManager.isActiveTool(toolCall.getName())) {
    String errorMsg =
            String.format(
                    "Unauthorized tool call: '%s' is not available", toolCall.getName());
    logger.warn(errorMsg);
    return Mono.just(ToolResultBlock.error(errorMsg));
}

// Validate input against schema
String validationError =
        ToolValidator.validateInput(toolCall.getContent(), tool.getParameters());
if (validationError != null) {
    String errorMsg =
            String.format(
                    "Parameter validation failed for tool '%s': %s\n"
                            + "Please correct the parameters and try again.",
                    toolCall.getName(), validationError);
    logger.debug(errorMsg);
    return Mono.just(ToolResultBlock.error(errorMsg));
}

// Merge context
ToolExecutionContext toolkitContext = config.getDefaultContext();
ToolExecutionContext finalContext =
        ToolExecutionContext.merge(param.getContext(), toolkitContext);

// Create emitter for streaming
ToolEmitter toolEmitter = new DefaultToolEmitter(toolCall, chunkCallback);

// Merge preset parameters with input
Map<String, Object> mergedInput = new HashMap<>();
if (registered != null) {
    mergedInput.putAll(registered.getPresetParameters());
}
if (param.getInput() != null && !param.getInput().isEmpty()) {
    mergedInput.putAll(param.getInput());
} else if (toolCall.getInput() != null) {
    mergedInput.putAll(toolCall.getInput());
}

// Build final execution param
ToolCallParam executionParam =
        ToolCallParam.builder()
                .toolUseBlock(toolCall)
                .input(mergedInput)
                .agent(param.getAgent())
                .context(finalContext)
                .emitter(toolEmitter)
                .build();

return tool.callAsync(executionParam)
        .onErrorResume(
                ToolSuspendException.class,
                e -> {
                    // Convert ToolSuspendException to suspended result
                    logger.debug(
                            "Tool '{}' suspended: {}",
                            toolCall.getName(),
                            e.getReason() != null ? e.getReason() : "no reason");
                    return Mono.just(ToolResultBlock.suspended(toolCall, e));
                })
        .onErrorResume(
                e -> {
                    String errorMsg =
                            e.getMessage() != null
                                    ? e.getMessage()
                                    : e.getClass().getSimpleName();
                    return Mono.just(
                            ToolResultBlock.error("Tool execution failed: " + errorMsg));
                });
```

到这里就是tool调用的 "校验 + 准备 + 执行"的过程三部曲

- 前置校验：
    - 检查工具是否存在且已经注册到agent中
    - 入参 Schema 校验：会根据tool的入参要求检查tool_use中的入参拼装是否正确
- 执行准备：
    - 构建流式输出toolEmitter，这个用于tool调用时的chunk回调函数event使用，前文有提到
    - 合并预设参数 + LLM 传入参数：有值时优先使用tool_use的入参，无值时使用默认参数
- 执行
    - 通过不同的client客户端执行调用操作，如MCP client

4、不同客户端执行工具调用，我这里以mcp client为例

![[1180288e-b508-43d8-8a0c-9e8b06ac2047.png]]

可以看到agentscope支持了不同的mcp客户端执行方式，比如同步和异步的执行等等。

其内部的调用，就是使用封装好的MCP Client客户端工具完成的远程调用;

```java
return client.callTool(request)
        .doOnSuccess(
                result -> {
                    if (Boolean.TRUE.equals(result.isError())) {
                        logger.warn(
                                "MCP tool '{}' returned error: {}",
                                toolName,
                                result.content());
                    } else {
                        logger.debug("MCP tool '{}' completed successfully", toolName);
                    }
                })
        .doOnError(
                e ->
                        logger.error(
                                "Failed to call MCP tool '{}': {}",
                                toolName,
                                e.getMessage()));
```

### 5\. 处理执行结果（分流）

这一步就是对tool调用后的结果进行处理：

```java
results -> {
    // Separate success and pending results
    List<Map.Entry<ToolUseBlock, ToolResultBlock>> successPairs =
            results.stream()
                    .filter(e -> !e.getValue().isSuspended())
                    .toList();
    List<Map.Entry<ToolUseBlock, ToolResultBlock>> pendingPairs =
            results.stream()
                    .filter(e -> e.getValue().isSuspended())
                    .toList();

    // If no success results to process
    if (successPairs.isEmpty()) {
        if (!pendingPairs.isEmpty()) {
            return Mono.just(buildSuspendedMsg(pendingPairs));
        }
        return executeIteration(iter + 1);
    }

    // Process success results through hooks and add to memory
    return Flux.fromIterable(successPairs)
            .concatMap(this::notifyPostActingHook)
            .last()
            .flatMap(
                    event -> {
                        // HITL stop (also triggered by
                        // StructuredOutputHook when completed)
                        if (event.isStopRequested()) {
                            return Mono.just(
                                    event.getToolResultMsg()
                                            .withGenerateReason(
                                                    GenerateReason
                                                            .ACTING_STOP_REQUESTED));
                        }

                        // If there are pending results, build suspended Msg
                        if (!pendingPairs.isEmpty()) {
                            return Mono.just(
                                    buildSuspendedMsg(pendingPairs));
                        }

                        // Continue next iteration
                        return executeIteration(iter + 1);
                    });
});
```

1. 取出执行成功和执行挂起的tool调用
2. 如果有执行挂起的情况，一般需要用户进行确认，重新执行下一轮的推理迭代，交由用户确认
3. 遍历tool调用的执行结果，并执行acting后置执行hook事件 PostActingEvent
4. 进行下一轮迭代 reasoning

到这里，整个acting和reasoning的迭代执行就已经串起来了；

相当于reasoning的过程中，如果需要进行工具调用，就会进入到acting流程中，acting执行完，再回来执行reasoning，这是一个循环迭代的过程；

![[a5612185-2a63-4bde-beaf-75dd33b1dd09.png]]

## 结语

AI时代已经来临，希望借助这篇小文章帮助大家了解Agent的主推理流程是如何规划，大家也可以基于AgentScope的思路完成自己的Agent的流程搭建。

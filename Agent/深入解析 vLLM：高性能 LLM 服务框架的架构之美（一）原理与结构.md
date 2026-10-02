---
title: "深入解析 vLLM：高性能 LLM 服务框架的架构之美（一）原理与结构"
source: "https://ata.atatech.org/articles/11020371653?spm=ata.21736010.0.0.24d975368dZiu8"
author:
published:
created: 2026-05-17
description:
tags:
  - "clippings"
---
ATH事业群-通义实验室

勋章

粉丝 121影响力 1.4k

** 118

** 239

** 5

** 原创文章

** 内部资料

发表到圈儿

[达摩院语音工程团队](https://ata.atatech.org/community/team/757) (首发)

[AIGC-AI内容生成ChatGPT爱好者](https://ata.atatech.org/community/group/3432)

**

[杨贤(临景)](https://ata.atatech.org/users/11000899730)

发表更新4.0k浏览

** 朗读

** 字号

** 笔记

** 分享 **

朗读文章31:14

**

| 修改内容 | 时间 |
| --- | --- |
| 2.4.1处理请求的流程，引用更好的流程图 | 2025.02.11 |
| 首发 | 2025.02.08 |

[【头条文章🔥🔥🔥】 深入解析 vLLM：高性能 LLM 服务框架的架构之美（一）原理与结构](https://ata.atatech.org/articles/11020371653)  
[【头条文章🔥🔥🔥】深入解析 vLLM：高性能 LLM 服务框架的架构之美（二）调度管理](https://ata.atatech.org/articles/11020369333)  
[【头条文章🔥🔥🔥】深入解析 vLLM：高性能 LLM 服务框架的架构之美（三）模型推理](https://ata.atatech.org/articles/11020386445)

## 1\. vLLM 整体代码架构

### 1.1 vLLM 的设计目标与特点

vLLM 是一个高性能的大语言模型服务框架。在大语言模型日益普及的今天，如何高效地提供推理服务成为一个重要挑战。传统的服务框架在处理并发请求时往往会遇到性能瓶颈、内存管理效率低下等问题。vLLM 正是为解决这些关键挑战而生。

在性能优化方面，vLLM 最大的创新在于引入了突破性的 PagedAttention 机制。这项技术巧妙地将传统的连续注意力计算改造为基于页的形式，使得 GPU 内存的利用效率得到极大提升。通过精心设计的连续批处理机制，vLLM 能够充分利用 GPU 算力，显著提升推理速度。

说到内存效率，vLLM 采用了独特的动态内存管理方案。通过对 KV Cache 的动态管理和页式存储，它能够有效减少内存碎片，提高内存利用率。这就像是在有限的空间里实现了"完美俄罗斯方块"，让每一块内存都物尽其用。

在并发处理能力上，vLLM 表现同样出色。它采用灵活的调度策略，能够同时处理大量并发请求，并通过动态负载均衡确保资源的最优分配。这种设计让 vLLM 能够轻松应对高并发场景，就像一个经验丰富的交通指挥官，让所有请求都能高效有序地通行。

作为一个服务框架，vLLM 的架构设计非常灵活。它不仅支持单机部署，还能轻松扩展到分布式环境。框架兼容主流的 LLM 模型，并提供简洁的 API 接口，大大降低了开发者的使用门槛。

在实际应用中，vLLM 展现出了令人印象深刻的性能表现。相比传统方案，它能够将推理服务的吞吐量提升 2-4 倍，同时显著降低请求延迟。这种性能提升不仅体现在数据上，更为用户带来了明显的体验改善。

对开发者而言，vLLM 提供了完善的工具支持。从简单的集成方式，到丰富的监控指标和调优选项，都体现了框架在易用性方面的深思熟虑。这使得开发者能够快速上手，并根据实际需求进行灵活调整。

### 1.2 核心组件概览

![[Image 26.jpg|J51BBg]]

vLLM 的系统架构由几个关键组件构成，它们各司其职又相互协作，共同支撑起整个服务框架。让我们深入了解每个组件的核心功能：

Engine 是整个系统的中枢，负责协调其他组件的工作。它就像一个指挥家，统筹管理着模型加载、请求分发、结果收集等核心流程。Engine 接收用户请求后，会将其转化为内部任务，并交由其他组件处理。

Worker 是实际执行推理计算的工作单元。每个 Worker 都可以独立处理分配给它的计算任务，就像工厂中的熟练工人。在分布式部署时，多个 Worker 可以并行工作，大大提升系统的处理能力。

Scheduler 是 vLLM 的调度大脑，它的主要职责是合理分配计算资源和管理请求队列。通过精心设计的调度算法，Scheduler 能够权衡不同请求的优先级、资源需求和系统负载，确保系统高效运转。

BlockManager 负责内存资源的精细化管理。它采用块式管理策略，将 GPU 内存划分为多个块，并通过智能的分配和回收机制，最大化内存使用效率。这就像是一个经验丰富的仓库管理员，让每一寸空间都得到充分利用。

PagedAttention 是 vLLM 最具创新性的组件。它重新设计了注意力机制的实现方式，引入页式管理的概念，使得 KV Cache 的管理更加灵活高效。这项技术显著提升了推理性能，是 vLLM 性能优势的关键所在。

CacheEngine 专注于缓存策略的实现。它通过智能的缓存机制，减少重复计算，提升响应速度。就像是系统的记忆库，能够快速调用常用的计算结果。

这些组件通过精心设计的接口相互配合，形成了一个高效协同的整体。每个组件都可以独立优化和扩展，这种模块化的设计既保证了系统的灵活性，也便于维护和升级。

### 1.3 系统架构与工作流程

vLLM 的系统架构采用了模块化设计，各个组件之间通过清晰的接口进行交互。下面这张架构图展示了各个核心组件及其关系：  
![[Image 27.jpg|B0lniS]]

当用户发起一个推理请求时，整个处理流程是这样的：首先，请求会经由 Engine 接收和解析。Engine 会对请求进行初步处理，包括参数验证、格式转换等。这就像是前台接待员，确保所有进入系统的请求都是规范的。

接下来，Engine 会将请求交给 Scheduler 进行调度分析。Scheduler 会根据当前系统的负载状况、可用资源情况，为这个请求制定处理计划。它会考虑多个因素：是否有空闲的 Worker？内存资源是否充足？是否需要进行批处理优化？这个过程就像是一个经验丰富的项目经理，在有限的资源下做出最优的任务分配。

在执行阶段，Worker 承担着最重要的计算任务。它们在 Scheduler 的指挥下，有条不紊地进行模型推理计算。这时，BlockManager 会密切配合，确保所需的内存资源能够及时到位。如果发现内存不足，BlockManager 会启动交换机制，像变魔术一样腾出空间来。

PagedAttention 在这个过程中发挥着关键作用。它创新性地使用页式管理方式处理注意力计算，使得长序列推理变得更加高效。这就像是给计算过程装上了"加速器"，显著提升了处理速度。

CacheEngine 则在整个过程中不断优化性能。它会智能地缓存一些计算结果，在遇到相似请求时直接复用，避免重复计算。这就像是系统的"备忘录"，能够快速提供历史经验。

最后，处理结果会再次回到 Engine，由它负责结果的整理和返回。整个过程环环相扣，每个组件都各司其职又紧密协作，共同确保了请求处理的高效性。

在分布式部署场景下，这个架构还能轻松扩展。多个 Worker 节点可以并行工作，Scheduler 会自动协调它们的任务分配，就像是一个指挥交响乐团的指挥家，让所有乐器都能配合得天衣无缝。

## 2\. vLLM 处理请求的流程

一个请求在 vLLM 中的生命周期是一个精心编排的过程，涉及多个组件的协同工作。主要实现在 `vllm/engine/llm_engine.py` 和 `vllm/engine/ray_worker.py` 中。

### 2.1 初始化并加载模型权重

![[Image 28.jpg|xL0fCE]]

如上图所示，vLLM 的初始化过程包括模型加载、模型参数初始化、KV Cache 预分配等关键步骤。  
vLLM需要初始化并加载模型权重，支持从HF Hub加载模型，也支持从本地加载模型。在加载过程中，vLLM将模型权重加载到GPU中，以便后续推理在GPU运行。

#### 2.2 估计KV Cache的物理块数量

![[Image 29.jpg|qIQ4Mt]]

在模型部署的初始化阶段，vLLM 会通过一个模拟实验步骤来决定 GPU 和 CPU 上可以分配的 KV cache 物理块数量，确保后续推理时的内存分配不会导致显存溢出。这个步骤在 vLLM 中被称为 determine\_num\_available\_blocks。

首先，在启动 LLMEngine 时，系统会进行一个 “假数据模拟” 来测量模型的内存使用情况。它通过构造假数据并执行一次模拟前向推理，来观察 GPU 上模型运行时的峰值内存需求。在这次前向推理中，系统不使用 KV cache，而是单纯地模拟模型推理所需的基本内存。这种方式可以帮助确定整个推理过程会占用多少显存，从而为后续的内存分配提供依据。

在完成内存需求的测量后，vLLM 会使用测得的内存数据来计算可分配给 KV cache 的显存总量。具体来说，分配给 KV cache 的显存等于 GPU 总显存减去在不使用 KV cache 时推理所占用的显存（包括模型本身和推理过程中的中间数据）。这样可以确保显存分配合理，不会因为内存不足而导致 OOM（Out Of Memory）错误。

接下来，通过计算显存中可以分配的物理块数量，vLLM 会确定 GPU 上可以使用的 KV cache 数量。物理块的大小由用户定义，包括多个参数，例如 block\_size、num\_heads、head\_size、num\_layers 以及数据类型的大小（如 fp16 对应的字节数是 2）。计算公式会依据这些参数来估算单个物理块的大小，然后根据剩余显存估算出可以分配的物理块总数。

#### 2.3 预分配 KV Cache

![[Image 30.jpg|quECx7]]

在确定好 KV cache 块的大小之后，vLLM 会进行显存的预分配，以确保后续推理过程中有足够的内存来存储 KV cache。这一过程的核心是创建空的张量（empty tensor），并将它们直接分配到 GPU 上，从而锁定一定的显存空间专门用于 KV cache。这种显存预分配的方式能够避免推理过程中频繁的动态内存分配，提升系统的稳定性和推理效率。

预分配的显存专门用于 KV cache，因此在 vLLM 初始化后，你可能会注意到显存的占用比单纯加载模型时要多一些。这是因为这些额外的显存已经被预先分配给了 KV cache，确保它们在推理时不会受到其他任务的影响。通过这种显存的预先规划和锁定，系统在处理推理请求时能够更高效地管理内存资源，避免了推理阶段因显存分配不足而出现的瓶颈。

### 2.4 处理请求

#### 2.4.1 请求到达 LLMEngine

![[Image 31.jpg|TXbOGg]]

图中展示了 vLLM 引擎的工作流程，可以分成两部分深入探索：异步(async)和同步(sync)流程。

**异步流程**

1. `API-Server` 接受请求：当用户发送请求时， `API` 服务器首先会接收到这些请求并解析其中的参数。这些参数告诉系统后续进行什么样的处理。
2. 生成请求参数(async\_args)： `API-Server` 会根据请求参数生成一个 `async_args` 对象，它包含了请求的详细信息，比如模型 ID、输入文本、推理参数等。
3. 请求加入队列：请求加入队列后，会等待调度器调度。
4. 引擎主循环开始(`run_engine_loop`)：在异步流程中，引擎主循环会不断从队列中获取请求，并进行处理。
5. 处理请求(`get_new_and_abort_requests`)：在处理过程中，系统会检查新的请求以及是否有请求被终止，确保每个请求被及时处理。
6. 执行推理步骤(`engine_step`): engine 开始处理请求，决定哪个请求可以执行。
7. 异步步骤完成(`add_request_async`): 将请求传递到 LLMEngine
8. 请求加入调度(`add_seq_group`): 将请求包装为 seq\_group 对象，并加入调度器
9. 返回调度结果(`sche_output`): 调度执行，对 waiting,running, swapped 队列中的请求进行调度，返回调度结果，等待模型推理。
10. 单步推理(`step_async`): 模型推理，生成一个step 的输出结果。
11. 引擎推理(`engine_step`): 引擎推理，处理请求，生成一个step 的输出结果。
12. 模型推理(`execute_model_req`): model\_executor 执行推理，生成一个step 的输出结果。
13. 结果返回(`return_output`): 将结果返回给 AsyncLLMEngine，包装为 request\_output 对象。
14. 返回结果(`return_output_async`): 回抛结果
15. 流式输出(`stream_output`): 流式输出结果
16. 请求完成(`request_done`): 请求完成，流式将结果返回API-Server。

**同步流程**  
同步流程相对简单，主要是在执行过程中直接返回结果：

1. 初始化(`init`): 同步流程开始时，系统会初始化所有必要的参数和资源。
2. 请求处理(`add_request`): 此时，系统直接处理请求并开始执行。
3. 推理计算(`step`): 系统会一步一步地处理推理任务，直到完成。
4. 生成并返回结果(`output`): 处理完成后，系统会直接返回推理结果。

总体来说，vLLM 的工作流程就像一个工厂，API 服务器像一个接收原材料的入口，它把请求交给引擎进行处理，处理的方式有两种：一种是异步的，一种是同步的。每个请求都会经过一系列步骤，最终模型给出答案。

#### 2.4.2 调度器的任务

![[Image 32.jpg|YziHGR]]

在请求进入调度器后，Scheduler 会根据当前的资源情况（如可用的 KV 缓存块）来决定如何执行任务。调度器维护了三个请求队列：

- `Waiting Queue` ：等待执行的请求。
- `Running Queue` ：当前正在处理的请求。
- `Swapped Queue` ：由于显存不足而被暂时置换出去的请求。

调度器会判断是否有足够的内存块可以分配给新的 tokens。如果有足够的可用 KV 块，则请求从等待队列移动到正在运行的队列（waiting → running）；如果内存不足，调度器会将一些运行中的请求交换到 CPU 内存（running → swapped），以腾出空间让新请求进入运行队列。

#### 2.4.3 Worker 执行推理

![[Image 33.jpg|0zKzhN]]

当请求进入运行队列后，Scheduler 会将任务分发给多个 Worker。每个 Worker 在 GPU 上运行，负责实际的推理计算。在这一过程中，CacheEngine 会按照调度器的指示管理缓存块，包括在 GPU 和 CPU 之间交换内存块，确保内存资源得到高效利用。此外，CacheEngine 还会对共享缓存块执行写时复制（copy-on-write），以确保数据的一致性和高效性。

#### 2.4.4 模型的推理过程

![[Image 33.jpg|0zKzhN]]

每个 Worker 中的 Worker.model 模块负责加载并执行模型推理。在这个过程中，它会依赖 PagedAttention 来实现高效的注意力计算。PagedAttention 是优化的注意力机制实现，适用于大规模的 Transformer 模型，并使用诸如 xformers 或 FlashAttention 等技术来加速推理。

此外，模型的其他部分（例如线性层、量化层等）也进行了优化，以便在分布式执行和张量并行的情况下达到最高性能。在推理阶段，Sampler 会负责选择下一个生成的 token，使用贪心算法、随机采样或者 Beam Search 等策略。

#### 2.4.5 请求的完成和结果返回

推理完成后，结果会被发送回 LLMEngine。LLMEngine 会对生成的 tokens 进行 detokenization，将它们转换回可读的文本，并最终将生成的结果流式地返回给用户。这一流程使得生成的结果可以尽快交付给用户，而无需等待整个请求的完全完成。

整个请求的处理流程由 LLMEngine 进行协调调度，通过 Scheduler 管理内存和资源的有效利用，Worker 在 GPU 上执行具体的推理计算，最终将结果流式地返回给用户。

## 3\. vLLM 输入数据的预处理

在 vLLM 处理用户请求之前，需要对输入数据进行一系列预处理操作，以确保数据能够被模型正确处理。这个过程就像是将原始材料加工成标准化的零件，为后续的推理计算做好准备。

### 3.1 Tokenization 处理

Tokenization 是输入预处理的第一道关卡。vLLM 使用与原始语言模型相同的分词器，将输入文本转换为模型可以理解的 token 序列。主要实现在 `vllm/engine/llm_engine.py` 和 `vllm/engine/tokenizer.py` 中。  
![[Image 34.jpg|xVh4L6]]

这个过程包含几个关键步骤：

1. 文本规范化：首先对输入文本进行清理和标准化，包括处理特殊字符、统一空白字符等。这就像是将各种形状的原料整理成统一的形态。
2. 分词处理：使用模型对应的 tokenizer 将文本切分成 token。这个过程会考虑词频、语义完整性等因素，就像是将长木材切割成大小合适的木块。
3. 批处理优化：vLLM 创新性地实现了动态批处理机制。它会智能地将多个请求的 token 组合在一起处理，就像是将多个订单的相似零件放在一起加工，显著提升处理效率。

### 3.2 Prompt 模板与格式化

vLLM 支持灵活的 prompt 模板系统，帮助用户更好地构造输入。相关实现在 `vllm/engine/arg_utils.py` 和 `vllm/engine/sampling_params.py` 中：

1. 模板定义：用户可以预定义不同场景的 prompt 模板，包括系统提示、用户输入、历史对话等部分。
2. 变量替换：模板中的变量可以动态替换，使得同一个模板能够适应不同的输入场景。
3. 格式验证：系统会自动检查填充后的 prompt 是否符合预期格式，确保输入的规范性。

### 3.3 输入验证与优化

为了确保系统稳定性和性能，vLLM 会对输入进行全面的验证和优化：

1. 长度检查：验证输入是否超过模型的最大上下文长度，必要时进行截断或分段处理。
2. 特殊标记处理：自动添加或处理模型所需的特殊标记（如开始符、结束符等）。
3. 资源评估：预估处理该输入所需的计算资源和内存需求，为后续调度做准备。(实现在 `vllm/engine/llm_engine.py` 中的 `add_request` 方法)
4. 缓存优化：分析输入是否能够利用已有的 KV Cache，提前进行优化决策。(实现在 `vllm/core/block_manager.py` 中)

### 3.4 深入解析 add\_request

接下来我们将深入分析 LLMEngine 的请求处理流程。通过 LLMEngine.add\_request 方法接收到的请求会经过一系列预处理、调度、执行和输出处理步骤。

```python
def add_request(
    self,
    request_id: str,
    prompt: Optional[PromptType] = None,
    params: Optional[Union[SamplingParams, PoolingParams]] = None,
    arrival_time: Optional[float] = None,
    lora_request: Optional[LoRARequest] = None,
    trace_headers: Optional[Mapping[str, str]] = None,
    prompt_adapter_request: Optional[PromptAdapterRequest] = None,
    priority: int = 0,
    *,
    inputs: Optional[PromptType] = None,  # DEPRECATED
) -> None:
"""Add a request to the engine's request pool.

The request is added to the request pool and will be processed by the
scheduler as \`engine.step()\` is called. The exact scheduling policy is
determined by the scheduler.

Args:
    request_id: The unique ID of the request.
    prompt: The prompt to the LLM. See :class:\`~vllm.inputs.PromptType\`
        for more details about the format of each input.
    params: Parameters for sampling or pooling.
        :class:\`~vllm.SamplingParams\` for text generation.
        :class:\`~vllm.PoolingParams\` for pooling.
    arrival_time: The arrival time of the request. If None, we use
        the current monotonic time.
    trace_headers: OpenTelemetry trace headers.
    priority: The priority of the request.
        Only applicable with priority scheduling.

Details:
    - Set arrival_time to the current time if it is None.
    - Set prompt_token_ids to the encoded prompt if it is None.
    - Create \`n\` number of :class:\`~vllm.Sequence\` objects.
    - Create a :class:\`~vllm.SequenceGroup\` object
        from the list of :class:\`~vllm.Sequence\`.
    - Add the :class:\`~vllm.SequenceGroup\` object to the scheduler.

Example:
    >>> # initialize engine
    >>> engine = LLMEngine.from_engine_args(engine_args)
    >>> # set request arguments
    >>> example_prompt = "Who is the president of the United States?"
    >>> sampling_params = SamplingParams(temperature=0.0)
    >>> request_id = 0
    >>>
    >>> # add the request to the engine
    >>> engine.add_request(
    >>>    str(request_id),
    >>>    example_prompt,
    >>>    SamplingParams(temperature=0.0))
    >>> # continue the request processing
    >>> ...
"""
```

首先，add\_request 方法接受了多个参数，其中关键的参数包括：

- request\_id：每个请求的唯一标识符，用于跟踪和调度。
- prompt：请求的提示词，通常是用户输入的自然语言文本，定义了生成任务的起点。
- params：这是生成任务的参数，可能是 SamplingParams（采样生成参数）或者 PoolingParams（池化生成参数），这将影响生成的策略，比如温度、采样方法等。
- arrival\_time：请求到达的时间，用于统计和分析请求的延迟。
- lora\_request：用于处理 LoRA 模型的特定请求，如果模型使用了 LoRA 技术。
- trace\_headers：用于跟踪请求的元数据，通常用于日志记录和调试。
- prompt\_adapter\_request：用于处理提示适配器的特定请求，如果模型使用了提示适配器。
- priority：请求的优先级，用于调度器决定请求的执行顺序。
- inputs：这是一个可选参数，用于兼容旧版本，通常可以忽略。

#### 3.4.1 preprocess 入口

在 LLMEngine 中，当我们使用 add\_request 方法添加一个请求时，系统首先会调用 InputPreprocessor 对输入进行预处理，这一过程确保用户的输入被模型正确处理。InputPreprocessor 类负责解析和处理不同类型的输入（包括文本、tokens 等），并将其转换为模型可以使用的标准化格式。

```python
def preprocess(
    self,
    prompt: PromptType,
    request_id: str,
    lora_request: Optional[LoRARequest] = None,
    prompt_adapter_request: Optional[PromptAdapterRequest] = None,
) -> ProcessorInputs:
    """Preprocess the input prompt."""
    if self.model_config.is_encoder_decoder:
        # Encoder-decoder model requires special mapping of
        # input prompts to encoder & decoder
        return self._process_encoder_decoder_prompt(
            prompt,
            request_id=request_id,
        )

    if is_explicit_encoder_decoder_prompt(prompt):
        raise ValueError("Cannot pass encoder-decoder prompt "
                            "to decoder-only models")

    # Decoder-only operation
    return self._process_decoder_only_prompt(
        prompt,
        request_id=request_id,
        lora_request=lora_request,
        prompt_adapter_request=prompt_adapter_request,
    )
```

对于 encoder-decoder 模型，输入需要分为 encoder prompt 和 decoder prompt，每一部分都需要分别进行处理。\_process\_encoder\_decoder\_prompt 是专门为 encoder-decoder 模型设计的，它能够处理同时包含编码器和解码器的 prompt。

现在我们只考虑 decoder-only 模型，对于 decoder-only 模型，输入处理相对简单，仅需要处理单一的解码器 prompt。\_process\_decoder\_only\_prompt 的逻辑如下：

```python
def _process_decoder_only_prompt(
    self,
    prompt: SingletonPrompt,
    request_id: str,
    lora_request: Optional[LoRARequest] = None,
    prompt_adapter_request: Optional[PromptAdapterRequest] = None,
) -> DecoderOnlyInputs:
    """
    For decoder-only models:
    Process an input prompt into an :class:\`DecoderOnlyInputs\` instance.

    Arguments:

    * prompt: input prompt
    * request_id
    * lora_request
    * prompt_adapter_request

    Returns:

    * :class:\`DecoderOnlyInputs\` instance
    """

    prompt_comps = self._prompt_to_llm_inputs(
        prompt,
        request_id=request_id,
        lora_request=lora_request,
    )

    return self._build_decoder_only_llm_inputs(
        prompt_comps,
        prompt_adapter_request=prompt_adapter_request,
    )
```

`_prompt_to_llm_inputs` 方法负责将输入的 `prompt` 转换为模型可以理解的格式。它根据 `prompt` 的类型（字符串、tokens 或文本）进行不同的处理。

```python
def _prompt_to_llm_inputs(
        self,
        prompt: SingletonPrompt,
        request_id: str,
        lora_request: Optional[LoRARequest] = None,
    ) -> SingletonInputs:
        """
        Extract the singleton inputs from a prompt.

        Arguments:

        * request_id
        * prompt: single encoder or decoder input prompt
        * lora_request: this is only valid for decoder prompts

        Returns:

        * :class:\`SingletonInputs\` instance
        """
        parsed = parse_singleton_prompt(prompt)

        if parsed["type"] == "str":
            prompt_text = parsed["content"]
            prompt_token_ids = self._tokenize_prompt(
                prompt_text,
                request_id=request_id,
                lora_request=lora_request,
            )

            return token_inputs(
                prompt=prompt_text,
                prompt_token_ids=prompt_token_ids,
            )

        if parsed["type"] == "tokens":
            tokens_content = parsed["content"]

            prompt_token_ids = tokens_content["prompt_token_ids"]
            token_type_ids = tokens_content.get("token_type_ids")
            multi_modal_data = tokens_content.get("multi_modal_data")
            mm_processor_kwargs = tokens_content.get("mm_processor_kwargs")

            if multi_modal_data is not None and self._can_process_multimodal():
                return self._process_multimodal(
                    prompt_token_ids,
                    multi_modal_data,
                    mm_processor_kwargs,
                    lora_request=lora_request,
                )

            return token_inputs(
                prompt_token_ids=prompt_token_ids,
                prompt_embeds=tokens_content.get("prompt_embeds"),
                token_type_ids=token_type_ids,
                multi_modal_data=multi_modal_data,
                mm_processor_kwargs=mm_processor_kwargs,
            )

        if parsed["type"] == "text":
            text_content = parsed["content"]

            prompt_text = text_content["prompt"]
            multi_modal_data = text_content.get("multi_modal_data")
            mm_processor_kwargs = text_content.get("mm_processor_kwargs")

            if multi_modal_data is not None and self._can_process_multimodal():
                return self._process_multimodal(
                    prompt_text,
                    multi_modal_data,
                    mm_processor_kwargs,
                    lora_request=lora_request,
                )

            prompt_token_ids = self._tokenize_prompt(
                prompt_text,
                request_id=request_id,
                lora_request=lora_request,
            )

            return token_inputs(
                prompt=prompt_text,
                prompt_token_ids=prompt_token_ids,
                prompt_embeds=text_content.get("prompt_embeds"),
                multi_modal_data=multi_modal_data,
                mm_processor_kwargs=mm_processor_kwargs,
            )

        assert_never(parsed)
```

`_tokenize_prompt` 方法负责将输入的文本转换为 token 序列。它使用模型对应的 tokenizer 将文本切分成 token，并返回对应的 token ID 列表。

```python
def _tokenize_prompt(
        self,
        prompt: str,
        request_id: str,
        lora_request: Optional[LoRARequest],
    ) -> List[int]:
        """
        Apply the model's tokenizer to a text prompt, returning the
        corresponding token IDs.
        """
        tokenizer = self.get_tokenizer_group()
        add_special_tokens = None
        if self.model_config.hf_config.model_type == "whisper":
            # For Whisper, special tokens should be provided by the user based
            # on the task and language of their request. Also needed to avoid
            # appending an EOS token to the prompt which disrupts generation.
            add_special_tokens = False
        return tokenizer.encode(request_id=request_id,
                                prompt=prompt,
                                lora_request=lora_request,
                                add_special_tokens=add_special_tokens)
```

- **获取 Tokenizer** ：通过 `get_tokenizer_group()` 获取当前模型对应的分词器。这个分词器通常在模型初始化时就已经加载，与模型使用相同的词表和分词规则。
- **特殊标记处理** ：
	- 默认情况下， `add_special_tokens` 为 None，表示使用模型默认的特殊标记处理方式
		- 对于 Whisper 模型等特殊情况，会设置 `add_special_tokens=False` ，因为这些模型需要用户根据具体任务和语言来提供特殊标记
		- 这样的设计确保了不同模型的特殊标记（如开始符、结束符等）能够被正确处理
- **Token 编码** ：调用 tokenizer 的 encode 方法，将文本转换为 token ID 序列。这个过程包括：
	- 将输入文本分割成子词（subwords）
		- 将每个子词映射到对应的 token ID
		- 根据需要添加特殊标记（如果 add\_special\_tokens 为 True）
		- 处理 LoRA 相关的特殊需求（如果提供了 lora\_request）
- **请求追踪** ：通过传入 request\_id，确保能够追踪每个请求的 tokenization 过程，这对于调试和性能分析很有帮助。

### 3.4 创建 sequence 和 sequence\_group

通过这些精心设计的预处理步骤，vLLM 能够将各种形式的输入转换为标准化、高效的形式，为后续的推理计算打下坚实基础。这就像是一个细心的厨师，在烹饪之前将所有食材都准备妥当，确保整个烹饪过程的顺畅进行。

在预处理之后，我们得到了 `ProcessorInputs` 实例，它包含了处理后的输入数据。接下来，我们调用 `_add_processed_request` 方法将处理后的请求添加到引擎的请求池中。

```python
def _add_processed_request(
        self,
        request_id: str,
        processed_inputs: ProcessorInputs,
        params: Union[SamplingParams, PoolingParams],
        arrival_time: float,
        lora_request: Optional[LoRARequest],
        prompt_adapter_request: Optional[PromptAdapterRequest],
        trace_headers: Optional[Mapping[str, str]] = None,
        priority: int = 0,
    ) -> Optional[SequenceGroup]:
        """Add a processed request to the engine's request pool.
        return the created sequence group.
        """
        if isinstance(params, SamplingParams) and params.n > 1:
            ParallelSampleSequenceGroup.add_request(
                request_id,
                self,
                params,
                processed_inputs=processed_inputs,
                arrival_time=arrival_time,
                lora_request=lora_request,
                trace_headers=trace_headers,
                prompt_adapter_request=prompt_adapter_request,
                priority=priority,
            )
            return None

        self._validate_model_inputs(processed_inputs, lora_request)
        # Create the sequences.
        block_size = self.cache_config.block_size
        seq_id = next(self.seq_counter)
        eos_token_id = self.input_preprocessor.get_eos_token_id(lora_request)

        if is_encoder_decoder_inputs(processed_inputs):
            decoder_inputs = processed_inputs["decoder"]
            encoder_inputs = processed_inputs["encoder"]
        else:
            decoder_inputs = processed_inputs
            encoder_inputs = None

        seq = Sequence(seq_id, decoder_inputs, block_size, eos_token_id,
                       lora_request, prompt_adapter_request)

        encoder_seq = (None if encoder_inputs is None else Sequence(
            seq_id, encoder_inputs, block_size, eos_token_id, lora_request,
            prompt_adapter_request))

        # Create a SequenceGroup based on SamplingParams or PoolingParams
        if isinstance(params, SamplingParams):
            seq_group = self._create_sequence_group_with_sampling(
                request_id,
                seq,
                params,
                arrival_time=arrival_time,
                lora_request=lora_request,
                trace_headers=trace_headers,
                prompt_adapter_request=prompt_adapter_request,
                encoder_seq=encoder_seq,
                priority=priority)
        elif isinstance(params, PoolingParams):
            seq_group = self._create_sequence_group_with_pooling(
                request_id,
                seq,
                params,
                arrival_time=arrival_time,
                lora_request=lora_request,
                prompt_adapter_request=prompt_adapter_request,
                encoder_seq=encoder_seq,
                priority=priority)
        else:
            raise ValueError(
                "Either SamplingParams or PoolingParams must be provided.")

        # Add the sequence group to the scheduler with least unfinished seqs.
        costs = [
            scheduler.get_num_unfinished_seq_groups()
            for scheduler in self.scheduler
        ]
        min_cost_scheduler = self.scheduler[costs.index(min(costs))]
        min_cost_scheduler.add_seq_group(seq_group)

        return seq_group
```

`SequenceGroup` 表示的是多个 `Sequence` 的集合，通常是因为这些 `Sequence` 共享相同的采样参数（如温度、采样策略等）以及优先级调度策略（如 priority）。 `SequenceGroup` 的创建是通过 `_create_sequence_group_with_sampling` 或 `_create_sequence_group_with_pooling` 方法完成的，具体取决于是否采用采样策略或者池化策略。

SamplingParams 是用于控制模型生成文本时的行为的参数，比如温度（temperature）、采样概率（top\_p）等。SamplingParams 会影响生成的策略，比如生成的多样性、生成的质量等。

```python
def _create_sequence_group_with_sampling(
        self,
        request_id: str,
        seq: Sequence,
        sampling_params: SamplingParams,
        arrival_time: float,
        lora_request: Optional[LoRARequest],
        trace_headers: Optional[Mapping[str, str]] = None,
        prompt_adapter_request: Optional[PromptAdapterRequest] = None,
        encoder_seq: Optional[Sequence] = None,
        priority: int = 0,
    ) -> SequenceGroup:
        """Creates a SequenceGroup with SamplingParams."""
        max_logprobs = self.get_model_config().max_logprobs
        if (sampling_params.logprobs
                and sampling_params.logprobs > max_logprobs) or (
                    sampling_params.prompt_logprobs
                    and sampling_params.prompt_logprobs > max_logprobs):
            raise ValueError(f"Cannot request more than "
                             f"{max_logprobs} logprobs.")

        sampling_params = self._build_logits_processors(
            sampling_params, lora_request)

        # Defensive copy of SamplingParams, which are used by the sampler,
        # this doesn't deep-copy LogitsProcessor objects
        sampling_params = sampling_params.clone()

        sampling_params.update_from_generation_config(
            self.generation_config_fields, seq.eos_token_id)

        # Create the sequence group.
        seq_group = SequenceGroup(
            request_id=request_id,
            seqs=[seq],
            arrival_time=arrival_time,
            sampling_params=sampling_params,
            lora_request=lora_request,
            trace_headers=trace_headers,
            prompt_adapter_request=prompt_adapter_request,
            encoder_seq=encoder_seq,
            priority=priority)

        return seq_group
```

#### 3.4.1 深入理解 SequenceGroup

SequenceGroup 是 vLLM 中一个核心概念，它代表了一组共享相同采样参数和调度优先级的序列集合。让我们通过一个具体的生命周期来理解 SequenceGroup：

![[Image 35.jpg|SequenceGroup]]

SequenceGroup

  
**初始化阶段**

- 每个 SequenceGroup 初始时只包含一个序列(seq)，这个序列对应用户输入的 prompt
- 初始序列的状态被设置为 `waiting` ，等待调度器分配资源

**第一次推理阶段（Prefill）**

- 当调度器选中该 SequenceGroup 后，会首先执行 prefill 操作
- 如果采样参数中设置了 n > 1（例如 n = 4），系统会基于初始序列生成 n 个分支
- 所有生成的序列状态都变为 `running` ，开始并行生成 tokens

**资源竞争阶段（Preemption）**  
当 GPU 资源不足时，调度器会触发抢占机制。此时根据序列数量采取不同策略：

a) **Swap 策略** (序列数量 > 1)

- 适用于多序列场景
- 将 SequenceGroup 下所有序列的 KV Cache 从 GPU 转移到 CPU
- 所有序列状态变为 `swapped`
- 保留已计算的 KV Cache，避免重复计算

b) **Recomputation 策略** (序列数量 = 1)

- 适用于单序列场景
- 释放该 SequenceGroup 占用的所有 GPU 内存块
- 将序列重新放入 waiting 队列
- 下次调度时从 prefill 阶段重新开始
- 选择重计算的原因：单序列重新计算 KV Cache 的成本相对较低

sequence\_group 的属性：

- **seqs\_dict**

```python
self.seqs_dict: Dict[int, Sequence] = {}
```

- 存储序列ID到Sequence对象的映射
- 使用字典结构实现快速查找和管理
- 每个 Sequence 对象包含序列的状态、token 历史等信息
- **sampling\_params**

```python
self.sampling_params: SamplingParams
```

- 控制文本生成的关键参数
- 包含温度(temperature)、top\_p、top\_k等采样策略
- 影响生成文本的多样性和质量
- **metrics**
	```python
	self.metrics: Dict[str, Any] = {
	    "arrival_time": float,
	    "first_scheduled_time": Optional[float],
	    "first_token_time": Optional[float],
	    ...
	}
	```
	- 记录序列组的关键时间点和性能指标
		- 用于调度器进行决策和性能分析
		- 包括到达时间、首次调度时间、首个token生成时间等
- **max\_running\_steps**
	```python
	def get_max_num_running_steps(self) -> int:
	    """计算剩余生命周期内的最大并行序列数"""
	```
	- 预估序列组在整个生成过程中需要的最大并行步数
		- 帮助调度器进行资源规划和分配
		- 考虑了采样参数和当前生成状态

实现细节：

```python
class SequenceGroup:
    """A group of sequences that are generated from the same prompt.

    Args:
        request_id: The ID of the request.
        seqs: The list of sequences.
        sampling_params: The sampling parameters used to generate the outputs.
        arrival_time: The arrival time of the request.
        lora_request: LoRA request.
        pooling_params: The parameters used to generate the pooler
            for a pooling model.
        pooled_data: The extracted hidden states from a pooling model.
        encoder_seq: Optional, the single encoder sequence. Should be None
                     unless you are working with an encoder/decoder model.
        trace_headers: OpenTelemetry trace headers.
        prompt_adapter_request: Prompt Adapter request.
        priority: User-defined priority of the request.
    """

    def __init__(
        self,
        request_id: str,
        seqs: List[Sequence],
        arrival_time: float,
        sampling_params: Optional[SamplingParams] = None,
        lora_request: Optional[LoRARequest] = None,
        pooling_params: Optional[PoolingParams] = None,
        pooled_data: Optional[torch.Tensor] = None,
        encoder_seq: Optional[Sequence] = None,
        trace_headers: Optional[Mapping[str, str]] = None,
        prompt_adapter_request: Optional[PromptAdapterRequest] = None,
        priority: int = 0,
    ) -> None:
        self.request_id = request_id
        self.seqs = seqs
        self.first_seq = seqs[0]
        self.arrival_time = arrival_time
        self.is_single_seq = len(seqs) == 1
        self.seqs_dict = {seq.seq_id: seq for seq in seqs}

        self.sampling_params = sampling_params
        self.metrics = RequestMetrics(arrival_time=arrival_time,
                                      last_token_time=arrival_time,
                                      first_scheduled_time=None,
                                      first_token_time=None,
                                      time_in_queue=None)
        self.last_token_latency = 0.0
        self.lora_request = lora_request
        self.prompt_logprobs: Optional[PromptLogprobs] = None
        self.state = SequenceGroupState()
        self.pooling_params = pooling_params
        self.pooled_data = pooled_data
        self.prompt_adapter_request = prompt_adapter_request
        self.encoder_seq = encoder_seq
        self.trace_headers = trace_headers
        self.priority = priority

        self.cached_request_output = None
```

## 4\. 小结

在这篇文章中，我们踏上了探索 vLLM 架构的旅程，就像解构一台精密的机器，我们逐层剖析了它的核心组件和运作机制。从整体架构设计开始，我们看到了 Engine、Worker、Scheduler 等组件如何协同工作，就像一个精心编排的交响乐团，每个部分都在演奏着自己的乐章，共同谱写出高效服务的乐章。

在深入研究请求处理流程时，我们见证了一个请求从诞生到完成的完整生命历程。就像一颗种子从播种到生长，每个阶段都经过精心的规划和呵护。从最初的模型初始化，到 KV Cache 的预分配，再到请求的具体处理，vLLM 展现出了令人印象深刻的工程智慧。

特别值得一提的是输入数据的预处理机制，这就像是一个细心的厨师在烹饪前的准备工作。通过精心设计的 Tokenization 处理、灵活的 Prompt 模板系统，以及严谨的请求验证流程，vLLM 确保了每个输入都能被完美处理。而在序列管理方面，Sequence 和 SequenceGroup 的设计则展现了框架在处理复杂场景时的优雅解决方案。

这次的探索之旅让我们对 vLLM 的基础架构有了深入的认识，但这仅仅是开始。在下一篇文章中，我们将继续深入探讨 vLLM 最引人注目的两大核心机制：调度器（Scheduler）的智能调度策略和内存管理器（BlockManager）的高效内存管理。这两个机制就像是 vLLM 的双翼，让它能够在高并发的天空中自由翱翔。我们将看到调度器如何像一个睿智的指挥官，统筹安排每个请求的处理时机，以及内存管理器如何通过创新的 PagedAttention 机制，让有限的显存发挥出最大效能。

## 5\. 参考资料

- [vLLM 官方文档](https://docs.vllm.ai/en/latest/)
- [vLLM 源码](https://github.com/vllm-project/vllm)
- [vLLM 博客](https://blog.vllm.ai/2023/06/20/vllm.html)
- [vLLM 社区](https://github.com/vllm-project/vllm/discussions)
- [Yan Feng's blog](https://fy2462.github.io/2024/09/vllm-diagram-overview/)
- [vLLM 源码解析](https://github.com/PaddleJitLab/CUDATutorial/blob/develop/docs/16_vllm_source_code/03_scheduler.md)

END

1\. vLLM 整体代码架构

1.1 vLLM 的设计目标与特点

1.2 核心组件概览

1.3 系统架构与工作流程

2\. vLLM 处理请求的流程

2.1 初始化并加载模型权重

2.2 估计KV Cache的物理块数量

2.3 预分配 KV Cache

2.4 处理请求

2.4.1 请求到达 LLMEngine

2.4.2 调度器的任务

2.4.3 Worker 执行推理

2.4.4 模型的推理过程

2.4.5 请求的完成和结果返回

3\. vLLM 输入数据的预处理

3.1 Tokenization 处理

3.2 Prompt 模板与格式化

3.3 输入验证与优化

3.4 深入解析 add\_request

3.4.1 preprocess 入口

3.4 创建 sequence 和 sequence\_group

3.4.1 深入理解 SequenceGroup

4\. 小结

5\. 参考资料

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
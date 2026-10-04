---
title: "vLLM开发专题系列-入门指引"
source: "https://ata.atatech.org/articles/11020590435?spm=ata.23639746.0.0.39f24cf8vz6Xom#NGM4MDcx"
author:
published:
created: 2026-05-17
description:
tags:
  - "clippings"
---
## 前言

不知不觉在AI Infra上投入已经有快一年时间了，其中与vLLM接触最多，收获也最为丰厚。期间一直想抽时间将学习vLLM过程中的知识点系统整理一番，临近假期，终于有了相对充裕的时间。

本文将从LLM推理的基本概念入手，逐步引出推理框架的定位于核心指标，最后再尝试对vLLM框架进行全景式梳理，目的是为后续的vLLM开发洗礼专题做铺垫，让读者在深入vLLM具体模块的功能实现之前，先初步建立整体的认知，避免一开始就陷入细节而迷失方向。

### 指引

文章大致分为四个部分

1. LLM基础知识

2. 推理框架概览

3. vLLM核心功能梳理

4. 结语

## LLM基础知识

### LLM是什么？

LLM（Large Language Model，大语言模型） 是指参数量巨大（通常达数十亿至数千亿级别）、通过海量文本数据训练而成的深度学习模型。

### 基本原理

一切要从论文《Attention is all you need》提出的经典transformer架构说起。

![[009927f0-0ca3-4568-8af8-a98a44de3fb7.png]]

Google团队提出的创新性的transformer架构完全基于attention实现，对于长上下文有着更好的重点信息提取，同时相对于传统自回归模型上在计算并行上有了极大的飞跃，为后续大模型大爆发提供了扎实的理论基础。

LLM在推理阶段仍旧是自回归模式，即decode阶段依旧是根据先前的信息生成下一个token，那么其本质仍旧可以简化抽象成一个数学概率问题，简化公式如下所示：

$$
\begin{align*}
P(y_1, y_2, \dots, y_T \mid x)
&= P(y_1 \mid x) \cdot P(y_2 \mid x, y_1) \cdot P(y_3 \mid x, y_1, y_2) \cdots P(y_T \mid x, y_1, \dots, y_{T-1}) \\
&= \prod_{t=1}^{T} P(y_t \mid x, y_1, \dots, y_{t-1}) \\
&= \prod_{t=1}^{T} P(y_t \mid x, y_{<t})
\end{align*}
$$

从公式可以看出，大模型本质上是基于超维数据计算自回归生成的一连串高概率token的组合，自身并不善于计算，或者说根本没有数学计算的能力。此前网上疯传的bad case " [9.11和9.9哪个大](https://zhuanlan.zhihu.com/p/709093105) " 大模型集体翻车就可见一斑。

再举一个如今依然存在的数学运算的bad case：

![[e9167e8f-3df0-415a-8702-e447b1758035.png]]

强如deepseek也没有得到正确的结果（如果采用意图识别+cmd agent，运行结果会有质的提升，不过那是应用产品的范畴，不在本次讨论范围之内）

### 适用场景

虽说LLM不擅长数学计算，但其在其它领域有极为广泛的应用，包括但不限于以下几种：

- 对话与问答：类人工自然对话，垂直、通用知识问答。

- 内容创作：撰写文章、邮件、报告、诗歌、剧本、营销文案等。

- 代码辅助：生成、解释、调试代码、测试开发。

- 信息总结与提取：提炼长文档、会议记录、面试总结等。

- 翻译：在多语言间进行高质量的翻译。

- 知识推理：根据上下文进行逻辑分析、解答谜题、解决数学问题。

- 商品推荐：基于用户历史消费、用户上下文的综合推荐。

- 等等等等....

如此广凡应用场景的适应性真堪称21世纪极端模型参数所展示出的暴力美学！

同时因为其极其低的使用门槛，LLM一度消除了一些领域内应用算法的技术壁垒，甚至抹平了部分工程和部分算法之间的鸿沟。

很多业务场景落地几乎可以简化为3步：

1. 调研与业务场景相似的大模型

2. 模型部署

3. 应用开发对接

至此，一款高端、大气、上档次的AI应用就顺利落地了，相比以前AI相关的开发项目都不用写多少代码。

至于你说成本？我就问你落地快不快吧！

自从Google 2017年提出transformer的概念到如今各大厂商LLM模型百家争鸣，只经过了不到10年的时间。

现如今LLM已经成为各大互联网厂商重点投入的对象，主流的包括：Anthropic 的 [Claude](https://www.ibm.com/cn-zh/think/topics/claude-ai) 、OpenAI 的 [ChatGPT](https://www.ibm.com/cn-zh/think/topics/chatgpt) 、Meta 的 [Llama 系列](https://www.ibm.com/cn-zh/think/topics/llama-2) ，Google 的 [Gemini](https://www.ibm.com/cn-zh/think/topics/google-gemini) ，幻方量化的 [Deepseek](https://www.deepseek.com/) ，字节的 [Seed](https://seed.bytedance.com/zh/models?view_from=homepage_tab) 系列以及阿里的 [千问](https://www.qianwen.com/) 系列等等。

![[debc2a7e-d69a-4ab7-8c24-657ee606f8b2.png]]

正如当初《Attention is all you need》所述：

> We are excited about the future of attention-based models and plan to apply them to other tasks. We

> plan to extend the Transformer to problems involving input and output modalities other than text and

> to investigate local, restricted attention mechanisms to efficiently handle large inputs and outputs

> such as images, audio and video. Making generation less sequential is another research goals of ours.

毫无疑问，这一愿景正在成为现实。

## 推理框架概览

### 为什么会有推理框架？

前面略微夸张的提过一款AI应用的开发落地大致只需要3部，其中最有“技术门槛”的模型应用也极其简单，提炼代码大致如下：

\# Select model

MODEL = "Qwen/Qwen3-Omni-30B-A3B-Instruct"

\# Load model

model = Qwen3OmniMoeForConditionalGeneration.from_pretrained(

MODEL,

dtype="auto",

device_map="auto",

attn_implementation="flash_attention_2",

)

\# Inference

inputs = build_input()

result = model.generate(**inputs,

speaker="Ethan",

thinker_return_dict_in_generate=True,

use_audio_in_video=USE_AUDIO_IN_VIDEO)

但需要注意的是，生产环境的要求远不止如此：

- 多卡、多机部署的支持

- 低延迟、高吞吐的推理性能

- 高效的资源存利用率

- 丰富的模型支持

- 生产易用性

- 灵活的二次开发能力

- 等等等等

综合考虑以上问题，仅仅是上述可以运行的Demo就不够了，需要更为专业的推理框架支持，后文重点介绍的vLLM便是其中之一。

### 核心指标

在介绍推理框架之前，先介绍在线、离线两类指标，也是推理优化时需要关注的重要指标。

#### 在线

##### TTFT（Time to first token）

也就是LLM从收到请求到完成第一个token输出的时间，如果时间过长，用户会以为服务端不响应，进而认为系统服务体不稳定。

从LLM推理阶段来说，此阶段对应prefill阶段，属于专属指标。

##### TPOT（Time per output token）

一般是指第二个token之后的每个token输出时间，直观体验就是服务开始响应之后，页面上的吐字耗时，便于和TTFT的token区分开。此阶段如果耗时较长，用户会认为系统性能差，影响用户体验。

从LLM推理阶段来说，此阶段对应decode阶段，也属于专属指标。

可以发现，以上两种指标都是侧重延迟的指标，这也说明了在线服务对于延迟往往有着很高的要求。

#### 离线

##### Token Throughput

系统单位时间内生成的token数。

##### Request Throughput

系统单位时间内完成的请求数。

两项指标对于延迟均没有诉求，重点是尽可能提高硬件资源的利用率，提升整体服务的吞吐，使得在有限的时间可以处理更多的数据。

### 框架选型参考

![[859783fc-a64f-44c9-b4a1-85eb8e96e1df.png]]

从时间上来说，LLM推理框架发展时间并不久，但迭代极为迅速，其中知名的有vLLM（也就是下面会重点介绍的框架），sglang，TensorRT-LLM以及阿里自研的rtp-llm等。

以上都是十分优秀的推理框架，在业务选型上可以参考官方的文档说明。个人在这里基于有限的经验给一些粗略的建议：

- 如果自身业务依赖众多开源模型，有多种厂商显卡的支持需求，同时需要寻求开源社区的技术支持，推荐使用vLLM和sglang

- 如果仅限定与NVDIA的显卡，对于N卡有着极致的性能诉求，推荐用TensorRT-LLM

- 如果是阿里内部业务，对于超大规模参数的moe模型（如deepseek）以及内部自研大模型有极致的性能诉求，推荐使用rtp-llm

## vLLM核心功能梳理

本篇为vLLM开发专题系列的开篇，下面对于vLLM相关的功能细节进行初步介绍，结合近一年来遇到的开发、业务、运维等实际需求整理出以下13个部分，包括：架构设计、模型支持、Continuous Batching、KV Cache、Paged Attention、Prefix Caching、Attention Backend、量化、PD分离、并行策略、投机解码、约束解码、CUDA Graph设计。

由于本篇是概览篇，主要用于入门指引，各个部分不会做特别深入的分析，后续将开放相应的专题篇进行详细解读。同时由于vLLM涉及到的功能点非常庞杂，本次整理难免对于一些功能点有所疏漏，欢迎各位交流学习。

### 架构设计

vLLM自2023年发布以来，凭借其高效的推理性能吸引了大量开发者，但期间为了快速支持各种开源模型，早期架构设计上存在一些不足，例如模型推理阶段的prefill&decode拆分导致的推理逻辑冗余，采样逻辑耦合导致功能迭代时各种模型代码牵一发动全身不易维护等

在 [v0.11.0](https://github.com/vllm-project/vllm/releases) 版本vLLM正式启用了V1架构并明确废弃了V0架构，故以下仅对于V1架构进行介绍。

![[6006ffe7-a176-41fb-8540-b02df263bf8b.png]]

经过重构之后，整个架构变得更加简洁，调度逻辑也变得更加简单。CPU处理和GPU处理的多进程剥离使得各自的资源利用率可以更好的提升。

#### API Server

框架对外透出的HTTP服务，协议兼容OpenAI，是在线服务调用模型推理的统一入口。

#### AsyncLLM

推理引擎的异步封装，承接API server的请求输入并透出给EngineCore进行推理，自身主要包括了EngineCore推理前的input process和推理后的output process，此部分主要为CPU计算，解耦后可以提升GPU资源利用率。

#### EngineCore

真正的模型推理引擎，负责完成推理过程中的相关组件初始化、内部请求调度、显存管理、模型推理等核心链路。目前的V1架构中已是独立的进程服务，可以更专注于GPU计算相关的工作。

至于内部其他模块包括：Scheduler，ModelExecutor，ModelRunner，KVCacheManager等内容细节较多，本篇不再过多分析。

V1重构之后对于prefill和decode流程进行了合并统一，chunked prefill的执行流程也变得十分简洁优雅。

![[93fd5fd6-2ca8-4277-bd72-2e2328737cbd.png]]

只有一个小的注意点：prefill和decode统一之后，vllm将无法严格的保证prefill优先还是decode优先。V1架构新增加了参数max_num_batched_tokens，默认值是2048。如果期望降低TPOT，可以适当调小此值; 如果期望降低TTFT，可以适当调高此值。

### 模型支持

模型快速适配可以说是一个推理框架非常重要非常核心的组成部分。

便捷的开发调试才能使得算法+工程同学参与进来，推理框架进而会更快的支持新的模型，而不断丰富的模型库又会吸引更多的用户参与开发，进而形成良性循环。

![[a43d0a89-e511-4d20-917b-fba8baa7c1a9.png]]

反之，一个推理框架即便性能优异，但自身支持的模型太少，也很难推广开来。

简单总结模型开发的流程大概只有4个部分：

1. 按照vllm的规范重新加载权重

2. 按照vllm的接口规范进行适配实现

3. 注册模型

4. 算子替换为vllm的高效实现（性能优化项，推荐）

因为开发简单，vllm目前覆盖text generation、rerank、classify、embedding等多种类型，具体的模型细节详见「 [support models](https://docs.vllm.ai/en/latest/models/supported_models/#list-of-text-only-language-models) 」。在算法实验尝试新模型时可以先在此页面查找，如果存在可直接使用。

### Continuous Batching

有的文章或论文也称之为：iteration batching或者inflight batching，核心思想是一样的。

![[4a8d8694-6142-4d00-a35f-7e0d9f46e290.png]]

在线推理和离线训练在处理的数据格式上有很大的差异。

在线的请求数不固定，请求的长短也不固定，采用离线的static batching方式会有很明显的空洞（如上图左所示），且如果请求的差异化越大，空洞越严重。为了避免资源浪费，更好的提升资源的利用率，于是诞生了continuous batching的概念。

最早此概念的提出见于论文《Orca: A Distributed Serving System for Transformer-Based Generative Models》的iteration-level scheduling，之后vllm基于scheduler实现的continuous batching也是类似的思想。

改进之后（如上图右所示），相对于之前显著避免了计算资源的浪费。Anyscale 公布的数据显示vLLM改进后吞吐提升了23倍，个人感觉测试结果对于测试数据有一定依赖关系，不过也充分说明了Continous Batching的高效性。

### KV Cache

前面介绍过，LLM推理过程是一个自回归的过程，其中的attention计算需要反复用到此前的K,V的计算结果，如果不进行缓存会浪费巨量的计算资源，同时推理的延迟也会显著升高，采用空间换时间的方案缓存之前计算的K cache和V cache，可以有效提升推理性能，这就是推理框架目前的标配：KV Cache

其原理如下图所示：

![[54a7c2c6-6854-4ab6-85ac-03dca9fe8017.png]]

其中紫色的部分便是K cache与V cache，只是一般省略为KV cache。

#### 伪代码对比分析

为了便于进一步理解其执行过程，针对KV cache 的 decode部分补充对应的伪代码实现：

先定义一个投影和attention计算的函数

def project(x, W):

return x @ W

def attention(Q, K, V):

return softmax(Q @ K.T) @ V

不带KV cache 计算时：

def decode_without_cache(inputs, total_steps):

for step in range(total_steps - 1):

X = inputs

```java
Q = project(X, W_Q)
K = project(X, W_K)
V = project(X, W_V)
next = attention(Q, K, V)
inputs.append(next)
```

带有KV cache计算时：

def decode_with_cache(inputs, total_steps):

K_cache = None

V_cache = None

for step in range(total_steps - 1):

X = inputs[-1]

```java
Q = project(X, W_Q)
K = project(X, W_K)
V = project(X, W_V)
if K_cache is None:
```

K_cache = K[:]

V_cache = V[:]

else:

K_cache += K

V_cache += V

next = attention(Q, K_cache, V_cache)

inputs.append(next)

### Paged Attention

#### 显存开销

有了KV cache这一神器，可以有效的提升推理性能，但带来了不小的显存开销。

一个粗略的计算方式，定义如下参数：

- batch size B：并行处理的序列数量

- 序列长度 T：包含prompt以及生成的token总数

- 层数 L：Transformer 解码器的层数

- 注意力头数H

- 注意力头维度dk

- 隐藏维度 dmodel：模型的隐藏层维度（一般dmodel=H×dk）

- 数据类型大小 s：每个元素占用的字节数（例如 float16 为2字节，float32 为4字节，int8 为1字节）

那么KV cache显存占用的计算公式为：

$$
\text{KV cache} = 2 \times B \times T \times L \times d_{model} \times s
$$

或者：

$$
\text{KV cache} = 2 \times B \times T \times L \times H \times d_k \times s
$$

两者计算结果是完全等价的。

单纯从公式来看对于KV cache显存占用的开销可能不够直观，假定：B = 32，T = 8192，L = 64，dmodel = 2048，s = 2

带入计算后：

KV cache = 2 * 32 * 2048 * 64 * 2048 * 2 = 128GB

这是一笔非常大的开销，现如今还有很多显卡单卡都没有这么大的显存，仅仅KV cache的开销甚至比模型本身占用的开销还大。而且在线服务由于不能事先预估请求长度的大小，往往会按照一个固定值预分配显存的大小，当显存空间申请是连续的，序列长度与预分配不符时会导致比较严重的显存浪费问题。

vllm之后采用paged attention进行了深度显存优化，它借鉴了操作系统中的虚拟内存分页技术，将 KV Cache 分块存储在非连续的内存地址中，配合 block-level 的共享与 copy-on-write 机制，极大提升了显存利用率，侧面进一步提高了模型的吞吐能力。

改进后的显存分配过程如下图所示：

![[494e3ca6-1c43-453f-83c0-ab44afd14b13.png]]

原来是地主家的傻儿子只会花百元大钞，省了一堆零钱不知道怎么用，没想到化零为整之后其实能挤出来非常多的油水！

据实验统计，使用paged attention进行KV cache显存优化后，显存利用率从之前的20.4% – 38.2%提高到了96%，这是非常可观的提升！

### Prefix Caching

经过Paged Attention的优化，硬件层面的显存使用率已经得到了有效的提升，但是特定的业务场景下，还存在一些针对数据特征的显存优化手段。

![[adc9f409-28d0-4131-90db-a4ba175d251d.png]]

如上图所示，一些业务的prompt有着惊人的相似性，尤其是前缀部分，这意味着多个请求所对应的KV Cache在很大程度上有重叠不需要重复存储，从而避免浪费珍贵的显存资源，这是Prefix Caching优化的基础条件。

由于该思想大家所熟知的Trie树思想上极为相似，这里不再赘述。

需要注意的是：V1架构下的vLLM默认开启了prefix caching，在压测的时候需要注意关闭（配置 `enable_prefix_caching=false` ），否则压测的结果会过于乐观导致压测报告失真。

### Attention Backend

pytorch自带的SDPA（scaled dot product attention）覆盖多种mask计算，可以满足算法原型开发的功能需求甚至一些小数据规模的性能需求。但其为attention的通用实现，在矩阵运算上没有做深度定制的优化，对于在线性能要求较高的场景仍有一些不足。

torch.nn.functional.scaled_dot_product_attention(

query, key, value, attn_mask=None, dropout_p=0.0, is_causal=False, scale=None, enable_gqa=False

) -> torch.Tensor

"""

Args:

query (Tensor): Query tensor; shape:math:\`(N,..., Hq, L, E)\`.

key (Tensor): Key tensor; shape:math:\`(N,..., H, S, E)\`.

value (Tensor): Value tensor; shape:math:\`(N,..., H, S, Ev)\`.

attn_mask (optional Tensor): Attention mask; shape must be broadcastable to the shape of attention weights,

which is:math:\`(N,..., L, S)\`. Two types of masks are supported.

A boolean mask where a value of True indicates that the element *should* take part in attention.

A float mask of the same type as query, key, value that is added to the attention score.

dropout_p (float): Dropout probability; if greater than 0.0, dropout is applied

is_causal (bool): If set to true, the attention masking is a lower triangular matrix when the mask is a

square matrix. The attention masking has the form of the upper left causal bias due to the alignment

(see:class:\`torch.nn.attention.bias.CausalBias\`) when the mask is a non-square matrix.

An error is thrown if both attn_mask and is_causal are set.

scale (optional float, keyword-only): Scaling factor applied prior to softmax. If None, the default value is set

to:math:\`\\frac{1}{\\sqrt{E}}\`.

enable_gqa (bool): If set to True, Grouped Query Attention (GQA) is enabled, by default it is set to False.

"""

vllm根据推理需求结合attention极致优化的开源项目flash-attention，flashinfer，flashMLA等补充了其他attention backend的支持：

标准版（包含MHA,MQA以及GQA），包括以下4种：

- FLASHINFER

- FLASH_ATTN

- TRITON_ATTN

- FLEX_ATTN

deepseek版（MLA），包括以下多种实现：

- FLASHINFER_MLA

- FLASH_ATTN_MLA

- TRITON_ATTN_MLA

- CUTLASS_MLA

- ....

![[45d5b9f9-f6d1-448a-a34f-974aae9c43b4.png]]

不同backend在不同的显卡以及不同的模型上性能表现会有所不同，可以根据自己的环境进行实验。至于各个backend的实现原理以及MLA的具体优化本篇不再展开。

需要补充注意的一点是：除FLEX_ATTN以及TRITON_ATTN外，其他attention backend均只支持fp16/bf16精度，如果原生模型强依赖fp32精度，需要评估迁移backend带来的精度损失问题。

### 量化

以NVIDIA的显卡来说，低精度算力通常是高精度算力的2倍及以上。

![[018aa8b7-8e1d-407b-9e81-fd67dcae8c90.png]]

如上图的H100和B100，它们的FP16/BF16的算力是TF32的2倍，FP8/INT8又是FP16/BF16算力的2倍。

如果能有科学的办法将模型推理的计算精度从高精度降为更低的精度，那么算力将直接翻倍；同时由于数值精度的降低，显存的开销也会显著降低，这些优化可以显著的提升推理性能，而量化就属于这一种行之有效的手段。

最为常用的也比较通用的非对称量化原理如下图所示：

![[3cd90399-a737-497b-82ca-ea936f2aa043.png]]

公式表示如下：

$$
q = \text{round}\left( \frac{x - \min(x)}{\Delta} \right), \quad \Delta = \frac{\max(x) - \min(x)}{2^{8} - 1}
$$

其中的
$$
{\Delta}
$$
 即为大家所熟知的scale因子，量化相关代码中会频繁出现。

vllm支持众多量化方法，包括但不限于以下几种：

[AutoAWQ](https://docs.vllm.ai/en/latest/features/quantization/auto_awq/)

[INT4 W4A16](https://docs.vllm.ai/en/latest/features/quantization/int4/)

[INT8 W8A8](https://docs.vllm.ai/en/latest/features/quantization/int8/)

[FP8 W8A8](https://docs.vllm.ai/en/latest/features/quantization/fp8/)

等等等等...

具体量化策略的逐个分析本篇不再展开，需要注意的是：量化对于效果来说是有损的，需要根据业务场景评估对于效果的损失是否可以接受。

### PD分离

PD分离即prefill和decode阶段服务分离部署。

以vllm官方的设计流程为例：

![[0aad8ca9-bc1c-4a2b-ac7c-f28bb0cecd21.png]]

vllm的prefill server在处理request的prefill阶段时异步的将KV cache传递给decode server，后续持续的token生成将在decode server中进行。

#### Roofline

看起来是将原本完整的组合在一起的推理的功能拆分开了，链路反而变得更加复杂，那么为什么要额外增加这种开发+运维成本呢？

![[bf177d7d-fa2d-48d9-9831-670667d900ee.png]]

推理性能不仅取决于GPU的运行速度，也取决于数据传输的速度。因此诞生出一个概念：计算强度，即浮点数运算次数与总访存量的比值。

以上图roofline为例：

横轴表示计算强度，此值的范围极广，但好在我们仅需要关心图中的拐点即可。该拐点表示为算力与带宽同时达到峰值的数据点，拐点对应的横坐标的计算强度即为分界线，左侧为访存瓶颈，右侧为计算瓶颈。

我们注意到（注意力惊人），prefill通常计算瓶颈，decode是访存瓶颈。那么理论上prefill应该使用算力更高的显卡，而decode应该使用显存更大的显卡，PD分离之后其实可以更高效的发挥异构的硬件资源，这便是PD分离的理论依据。

### 并行策略

这里仅介绍常见的四种单一并行场景：DP、TP、EP、PP，可满足大多数运维部署需求，更加复杂的组合方式内容过多，不在本篇展开。

#### DP（Data Parallel）

![[cbf21dbd-b6c8-4299-8a60-c700b604cad7.png]]

适合模型比较小，但是卡资源比较富裕的场景。

每张显卡均加载完整的模型并可以独立处理请求。理论上采用此种方式可以使吞吐线性增加。

#### TP（Tensor Parallel）

![[de5c46b3-20e1-4c3e-b7f0-933e370376ad.png]]

当单卡无法加载整个模型时均可以使用此策略。

该策略每张显卡只保存模型水平等分的一部分，显著的降低了显存的压力，同时由于多卡可以并行计算，当计算节省的耗时大于通信的开始时，还可以降低推理整体的时延。不过需要注意的是：因为每张显卡仅保存部分模型，整个forward计算涉及大量的all reduce操作，在并发压力打满的情况下会有不小的通信开销会一定程度影响性能，使用时最好根据模型大小+业务场景吞吐需求酌情配置tp的数值。

#### EP（Expert Parallel）

![[3c255672-c359-4879-aa37-a487a554c317.png]]

只有moe模型才有专家的概念，此策略仅限定于moe模型。

该策略每张显卡依然是仅保存模型的一部分，和tp模式不同的是按照专家的粒度进行拆分，同样可以显著的降低显存的压力。

由于expert可以独立的处理完整的信息，采用ep后forward仅涉及一些all to all操作，无论是通信频率还是通信数据量都要比tp模式要低，建议高并发场景的moe模型需要多卡时一定要用ep模式，低并发场景tp模式可能因为并行计算使得延迟更低，请根据自身业务特点使用。

vllm针对不同场景做了深度优化，实现了多种alltoall backend可供选择：


| Backend                 | 适用场景 | 特点               |
| ----------------------- | ---- | ---------------- |
| allgather_reducescatter | 默认   | 通用               |
| pplx                    | 单节点  | 适合单机多卡环境         |
| deepep_high_throughtput | 多节点  | 适合prefill server |
| deepep_low_throughtput  | 多节点  | 适合decode server  |
| flashinfer_all2all      | 多节点  | 适合系统为跨节点NVLink环境 |
| naive                   | 本地环境 | 方便调试             |


#### PP（Pipeline Parallel）

![[70cc57b9-1c4b-4a55-9a56-1e9afdd36dfa.png]]

和tp的横向切分不同，pp采用的是按照模型垂直切分的方式，相对于tp模式来说减少了all reduce操作，但由于GPU之间有着前后依赖的关系，导致当吞吐较低时，整体的GPU使用率总会空闲，一般为：(N-1)/N（N为显卡数量）,在最新的vllm版本中pp支持异步后性能有了一些提升，不过缺少和其他并行模式比对的详实的实验数据。

### 投机解码

在大模型推理性能优化方面小有一个新颖的角度：既然大模型推理比较慢，如果用小模型来推理大模型只负责验证，是不是会快一点？就像优秀的导师带着学生做项目，自己只偶尔做一些关键的检查，万事都亲力亲为导师累趴了不说可能也产出不了多少评职称的成果。

#### MTP（Deepseek）

在《DeepSeek-V3 Technical Report》中提到了MTP（Multi-Token Prediction）的思想，如下图所示：

![[c69af9b0-0eaa-4aa2-937b-9545d3c61608.png]]

即MTP模型中的每一个module分别预测不同的token。

例如：Module 1 仅预测 token 6， Module 2 仅预测token 7，依次类推。由于每个Module都是单层结构，推理单个token计算量相对于原模型来说将大大降低。

#### EAGLE

由于目前没有知名的大模型开源自身的draft model，导致Deepseek版本的MTP使用场景并不多，生产上大多使用EAGLE模式(下图所示)。

![[Image 56.png]]

EAGLE模式只能进行单层预测，不过其不依赖于离线联合训练，仅通过base model导出最后一层即可，使用起来极为方便，虽然接收率比多层的MTP要低一些，也是很不错的选择。

但需要注意的是，由于验证阶段的计算量并不少，叠加起来总体的计算量甚至是更高的，只是验证阶段可以高效的并行处理而已，投机解码适合GPU算力充足但对于延迟有诉求的场景。

在vllm中封装了整个投机解码的流程，通过配置在线推理使用时和使用单个模型推理体感一致，非常简单。

from vllm import LLM, SamplingParams

prompts = [

"Hello eagle",

]

sampling_params = SamplingParams(temperature=0.8, top_p=0.95)

llm = LLM(

model="meta-llama/Meta-Llama-3-8B-Instruct",

tensor_parallel_size=4,

speculative_config={

"model": "yuhuili/EAGLE-LLaMA3-Instruct-8B",

"draft_tensor_parallel_size": 1,

"num_speculative_tokens": 2,

"method": "eagle",

},

)

outputs = llm.generate(prompts, sampling_params)

### 约束解码

大模型推理文本生成的结果通常是由模型决定的，很多情况下输出结果存在一定程度的不可控。比如：当你希望模型严格的返回一个json结构时，模型是不能100%做到的，这对于强依赖数据格式的应用场景是比较难处理的，需要反复重试或者采取兜底策略。

为了解决此类问题，推理框架本身设计出一种严谨的纯工程的解决方案: guided decoding，有的地方也称为constrained decoding或structured decoding。

![[0ed0cfd9-1449-41ad-8780-40677ff38187.png]]

如上图所示，当限定约束输出结构为：

{

"name": "[\\w\\d\\s]+",

"age": [0-9]+,

"house": "(Gryffindor|slytherin|Ravenclaw|Hufflepuff)"

}

模型decode的输出结果采样时将不再按照最高的概率进行选择，而是在此有限状态机的限制下进行选择。

当已输出的结果为：

{

"name": "Harry",

"

采样的结果将仅会选择token:`age` ，舍弃其他的所有token（无论概率是多少），然后状态机进入下一个状态检测，依次输出“"”、“:”、“数字”...

当状态机执行完毕时，最终输出的结果将100%符合约束条件。

vllm中内置了几种策略：

- `guided_choice`: 输出结果将恰好是其中一个。

- `guided_regex`: 输出将遵循正则表达式。

- `guided_json`: 输出将遵循 JSON格式。

- `guided_grammar`: 输出将遵循特定的语法，比如sql。

开箱即用，只是因为有了额外的判定检测，可能会有一些性能损耗，但由于避免了大模型随意发挥，输出token更加稳定，也可能有一定程度的性能提升，可以根据自身的业务场景进行实验。

### CUDA Graph设计

LLM流行以前，pytorch由于其保持着编写开发运行调试的一致性，非常适合原型迭代，深受学术圈的喜爱。但也因其动态图的执行模式和GPU之间有很多的不必要操作，导致性能远不如静态图的tensorflow，工业生产环境很少使用。

![[6b3e6076-a0fd-4816-b546-2fa9ed39f697.png]]

直到pytorch 2.x增加了torch compile技术，可以将现有的python代码以极低的改造成本编译出可与静态图执行效率匹配的代码，弥补了pytorch在工业生产环境效率不高的缺陷，才使得pytorch在工业界也变得受宠起来。

vllm深度依赖torch compile，不过由于其需要对LLM推理进行更加灵活、更加定制的优化，vllm在此基础指向提供了其他的cuda graph模式，包括以下5种:


| 类型                 | 特点                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------- |
| NONE               | 关闭cuda graph，虽然性能很差但适合本地调试，在查一些推理问题时会很有帮助。                                         |
| PIECEWISE          | 非常灵活，attention或其他与cuda graph不兼容的算子不做融合，其他部分都融合进cuda graph。                         |
| FULL               | 对于prefill和decode均使用完整的cuda graph，但多数情况下效果并不比PIECEWISE的分段图模式性能更优。                   |
| FULL_DECODE_ONLY   | decode阶段使用完整cuda graph，prefill/mixed阶段无cuda graph，适合在P/D分离环境中的decode服务中，节省一部分显存开销。 |
| FULL_AND_PIECEWISE | 在官方的大量小模型以及海量参数的moe模型测试中表现最佳，通常是性能最高的配置，也是官方默认指定的模式，缺点是占用显存最多，捕获时间最长。              |


总体设计流程如下：

![[cd3bab90-881c-4f0b-b1d6-bfd64f8784d7.png]]

虽然模式很多，但是本质上都是基于torch的compile结果的二次改造，利用dynamo得到的FX graph进行针对性的拆分处理，最后使用inductor等编译器进行最终编译。因此，深入学习torch compile的原理是非常必要的。

## 结语

大模型推理框架涉及的知识点远不止以上这些。本文根据有限的个人经验进行了初步的整理，每个功能点的进一步分析将在后续的专题中展开，遗漏之处后续也会进行补充更新。

希望这份入门指引对于有意了解大模型推理框架甚至从事相关开发工作的同学能提供一些帮助，也欢迎大家交流指正。

最后，感谢vLLM的开源分享，感谢AI Infra小组一起工作学习的各位小伙伴：@凌葭，@文央，@景荣，@允厥，@恭信，@小天，@启勤，感谢团队老板的支持：@万喜，@梓羽

享受开源，分享开源，参与开源，贡献开源。

## 附录

1. [https://docs.vllm.ai/en/latest/](https://docs.vllm.ai/en/latest/)

2. [https://blog.vllm.ai/](https://blog.vllm.ai/)

3. [https://docs.sglang.io/](https://docs.sglang.io/)

4. [https://docs.nvidia.com/](https://docs.nvidia.com/)

5. [https://pytorch.org/blog/](https://pytorch.org/blog/)

6. [https://nvidia.github.io/TensorRT-LLM/reference/support-matrix.html](https://nvidia.github.io/TensorRT-LLM/reference/support-matrix.html)

7. [https://rtp-llm.ai/](https://rtp-llm.ai/)

8. [https://turing-scholar.alibaba-inc.com/scholar/papers/semantic-204e3073870fae3d05bcbc2f6a8e263d9b72e776](https://turing-scholar.alibaba-inc.com/scholar/papers/semantic-204e3073870fae3d05bcbc2f6a8e263d9b72e776)

9. [https://turing-scholar.alibaba-inc.com/scholar/papers/107574-176913426815747d83a8e?spm=tb-scholar.collection.0.0.75081e9431hXyk](https://turing-scholar.alibaba-inc.com/scholar/papers/107574-176913426815747d83a8e?spm=tb-scholar.collection.0.0.75081e9431hXyk)

10. [https://turing-scholar.alibaba-inc.com/scholar/papers/107574-1771043946395f715154b](https://turing-scholar.alibaba-inc.com/scholar/papers/107574-1771043946395f715154b)

11. [https://turing-scholar.alibaba-inc.com/scholar/papers/semantic-a9780bdecdf142d31a106322e43ec811ced7e10a](https://turing-scholar.alibaba-inc.com/scholar/papers/semantic-a9780bdecdf142d31a106322e43ec811ced7e10a)

12. [https://huggingface.co/deepseek-ai/DeepSeek-V3.2](https://huggingface.co/deepseek-ai/DeepSeek-V3.2)

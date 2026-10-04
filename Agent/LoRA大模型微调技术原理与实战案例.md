---
title: "LoRA大模型微调技术原理与实战案例"
source: "https://ata.atatech.org/articles/11020453641?spm=ata.23639746.0.0.39f2f527H2uqDa"
author:
published:
created: 2026-04-21
description:
tags:
  - "clippings"
---
内部资料







## 一、大模型微调的背景

近年来，随着深度学习技术的飞速发展，大规模预训练语言模型（Large Language Models, LLMs）如GPT、BERT、T5、LLaMA等在自然语言处理（NLP）任务中取得了显著成果。这些模型通常拥有数十亿甚至数千亿参数，在海量无标注数据上进行预训练，具备强大的语言理解与生成能力。然而，尽管这些模型具备强大的通用性，但在特定下游任务（如医疗问答、法律文本分类、客服对话系统等）中，其表现仍有提升空间。

为此，模型微调（Fine-tuning） 成为连接通用大模型与具体应用场景之间的关键桥梁。微调是指在预训练模型的基础上，使用特定任务的小规模标注数据进行进一步训练，以适配目标任务的分布和语义特征。

## 二、微调主要分类

### 1\. 全参数微调（Full Fine-tuning）

📌 原理： 在预训练模型的基础上，使用下游任务的标注数据，解冻所有模型参数，通过反向传播更新整个模型的权重。 公式：

$$
W' = W + \Delta W
$$

其中ΔW 是完整的梯度更新，维度与原始权重W相同。

✅ 优点：

- 性能最强，能充分适配目标任务；

- 支持复杂任务（如长文本生成、多轮对话）；

- 不改变模型结构，推理无额外开销。

❌ 缺点：

- 计算成本极高：需更新数十亿参数，训练需要多卡 GPU；

- 存储开销大：每个任务都要保存一整套完整模型；

- 易过拟合：在小样本任务上容易 memorize 而非泛化；

- 灾难性遗忘：更新所有参数可能导致遗忘预训练知识。

🎯 适用场景： 数据量大、任务关键、追求极致性能的场景，如医疗诊断、金融风控等专业领域。

### 2\. Adapter 模块微调（Adapter Tuning）

📌 原理： 在 Transformer 的每一层中插入小型神经网络模块，只训练这些新增的 Adapter 参数，原始模型权重冻结。

结构示意：

![[37cd1e46-04a4-4cfe-a43a-1444adc2786f.png]]

✅ 优点：

- 参数效率高：仅需训练 0.5%~5% 的参数；

- 模块化设计，易于插拔和复用；

- 可实现多任务并行（每个任务挂一个 Adapter）；

- 避免灾难性遗忘。

❌ 缺点：

- 增加推理延迟：每层都要运行额外网络；

- 模型结构被修改，部署需支持 Adapter；

- 设计复杂：需决定插入位置、大小、非线性函数等；

- 性能略低于全微调。

🎯 适用场景： 多任务系统、资源受限环境（如边缘设备）、需要快速切换任务的场景。

### 3\. Prefix-tuning

📌 原理： 在输入序列前添加一组可学习的连续向量（称为“prefix”），并将这些向量注入到每一层 Transformer 的注意力输入中。原始模型参数冻结，只优化 prefix 向量。

本质是：用一组“软提示”引导模型行为，而不是人工设计的“硬提示”。

✅ 优点：

- 参数极省（通常 <1%）；

- 无需修改模型结构；

- 对小样本任务表现良好；

- 可实现零样本/少样本迁移。

❌ 缺点：

- prefix 长度和初始化敏感，需调参；

- 效果不稳定，对复杂任务（如长文本生成）支持弱；

- 推理时需缓存 prefix 向量，增加管理成本。

🎯 适用场景： 少样本学习、零样本任务适配、开放域问答等轻量级应用。

### 4\. Prompt-tuning

📌 原理： 与 Prefix-tuning 类似，但更聚焦于输入层。它将可学习的 embedding 向量拼接在输入 token 的前面，形成“软提示”（soft prompt），仅训练这些 prompt embeddings，模型其余部分冻结。

例如：

[Prompt_1][Prompt_2]...[Prompt_k][input tokens] → 模型输出

✅ 优点：

- 训练成本极低，仅需优化几十到几百个 embedding 向量；

- 无需标注数据即可启动（可用模板初始化）；

- 适合快速原型开发。

❌ 缺点：

- 性能受限，难以处理复杂逻辑任务；

- prompt 设计依赖经验，效果波动大；

- 对输入长度敏感，长序列中 prompt 信息易稀释。

🎯 适用场景： 小样本分类、快速实验验证、低资源环境下的模型适配。

---

### 5\. LoRA（Low-Rank Adaptation）

📌 原理： 核心思想是：权重更新 ΔW 具有低内在秩。因此不直接更新原始权重 W，而是将其变化分解为两个低秩矩阵的乘积：

$$
\Delta W = A B, \quad A \in \mathbb{R}^{d \times r},\ B \in \mathbb{R}^{r \times k},\ r \ll \min(d,k)
$$

✅ 优点：

- 参数效率极高：通常仅需 0.1%~1% 的可训练参数（如 r=8）；

- 无推理开销：训练后可合并到 W中，部署时完全透明；

- 性能接近全微调，显著优于其他 PEFT 方法；

- 易集成：只需替换线性层，无需修改架构；

- 支持多任务：不同任务用不同 LoRA 权重即可。

❌ 缺点：

- 需要选择合适的秩（经验调参）；

- 并非所有层都适合加 LoRA（通常用于 Q/V 投影层）；

- 初始实现略复杂（需拦截线性层）。

🎯 适用场景： 绝大多数 SFT 场景的理想选择，尤其是：

- 快速迭代实验

- 多任务适配

- 显存受限训练

- 开源社区微调（如 HuggingFace + PEFT 库）

### 总结


| 方法                       | 原理简述                                       | 可训练参数比例            | 是否修改模型结构 | 推理是否有额外开销       | 训练效率     | 性能表现       | 典型适用场景                                |
| ------------------------ | ------------------------------------------ | ------------------ | -------- | --------------- | -------- | ---------- | ------------------------------------- |
| 全参数微调 (Full Fine-tuning) | 解冻所有参数，端到端更新整个模型权重                         | 100%               | ❌ 否      | ❌ 否             | ⭐ 低      | ⭐⭐⭐⭐⭐ 极高   | - 高性能关键任务 - 数据量大的专业领域（如医疗、金融）         |
| Adapter                  | 在 Transformer 层间插入小型 MLP 模块，仅训练该模块         | 0.5% ~ 5%          | ✅ 是      | ✅ 是 （增加计算）      | ⭐⭐⭐ 中    | ⭐⭐⭐☆ 较高    | - 多任务系统 - 边缘设备部署 - 避免灾难性遗忘            |
| Prefix-tuning            | 在每层输入前添加可学习的“前缀向量”，仅优化这些向量                 | <1%                | ❌ 否      | ✅ 是 （需传 prefix） | ⭐⭐⭐⭐ 高   | ⭐⭐☆ 中等偏低   | - 少样本学习 - 零样本任务适配 - 开放域问答             |
| Prompt-tuning            | 将可学习 embedding 拼接在输入前作为“软提示”，仅优化 prompt 向量 | <0.1% ~ 1%         | ❌ 否      | ❌ 否             | ⭐⭐⭐⭐⭐ 极高 | ⭐⭐ 偏低      | - 小样本分类 - 快速原型验证 - 低资源环境              |
| LoRA                     | 用低秩矩阵分解近似权重更新                              | 0.1% ~ 1% （r=4~16） | ❌ 否      | ❌ 否 （可合并无开销）    | ⭐⭐⭐⭐⭐ 极高 | ⭐⭐⭐⭐ 接近全微调 | - 通用 SFT 场景 - 快速迭代实验 - 多任务适配 - 显存受限训练 |


## 三、LoRA的提出与核心思想

LoRA（Low-Rank Adaptation）由Microsoft Research在2021年提出（论文：LoRA: Low-Rank Adaptation of Large Language Models），其核心思想是：在不修改原始预训练模型权重的前提下，通过引入低秩矩阵分解的方式，对模型的权重更新进行近似，从而实现高效微调。

在传统全参数微调中，模型的权重矩阵在训练过程中直接更新为：

$$
W' = W + \Delta W
$$

其中
$$
\Delta W
$$
 是通过反向传播计算出的梯度更新。对于大模型而言，
$$
\Delta W
$$
 的维度与
$$
W
$$
 相同，即
$$
d \times k
$$
 ，参数量巨大。

LoRA 的关键洞察是：权重更新
$$
\Delta W
$$
 在实际训练中往往具有低内在秩（low intrinsic rank）。也就是说，尽管
$$
\Delta W
$$
 是一个高维矩阵，但其有效信息可以由少数几个方向（低秩子空间）近似表示。

因此，LoRA 不直接学习
$$
\Delta W
$$
 ，而是将其分解为两个低秩矩阵的乘积：

$$
\Delta W = A B, \quad \text{其中 } A \in \mathbb{R}^{d \times r}, B \in \mathbb{R}^{r \times k}, \quad r \ll \min(d, k)
$$

其中
$$
r
$$
 是人为设定的秩（rank），通常取值为4、8、16等小整数。

## 四、LoRA的数学原理与公式推导

#### 1\. 基本形式

LoRA的原理示意图如下：

![[caf36b19-1baf-4864-9e63-5f6808121500.png]]

考虑Transformer架构中的某一个线性层（如注意力机制中的
$$
Q, K, V
$$
 投影层或前馈网络中的全连接层），其前向传播为：

$$
h = W x
$$

其中
$$
W \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}
$$
 是原始权重，
$$
x \in \mathbb{R}^{d_{\text{in}}}
$$
 是输入，
$$
h \in \mathbb{R}^{d_{\text{out}}}
$$
 是输出。

在LoRA中，我们不更新
$$
W
$$
 ，而是引入可训练的低秩矩阵
$$
A
$$
 和
$$
B
$$
 ，使得：

$$
h = W x + \Delta W x = W x + A B x
$$

等价于：

$$
h = (W + A B) x
$$

其中
$$
A \in \mathbb{R}^{d_{\text{out}} \times r}
$$
,
$$
B \in \mathbb{R}^{r \times d_{\text{in}}}
$$
 。

#### 2\. 低秩分解的合理性

LoRA之所以能够在显著降低可训练参数量的同时保持优异的微调性能，其根本原因在于深度神经网络中权重更新（weight updates）具有潜在的低秩结构。这一现象可从矩阵的奇异值分解（Singular Value Decomposition, SVD）出发证明。

设预训练模型中某一层的权重矩阵为
$$
\mathbf{W}_0 \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}
$$
 ，在微调过程中，其更新量为
$$
\Delta \mathbf{W} \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}
$$
 。根据奇异值分解（SVD），该更新矩阵可表示为：

$$
\Delta \mathbf{W} = \mathbf{U} \mathbf{\Sigma} \mathbf{V}^\top
$$

其中
$$
\mathbf{U} \in \mathbb{R}^{d_{\text{out}} \times r}
$$
 和
$$
\mathbf{V} \in \mathbb{R}^{d_{\text{in}} \times r}
$$
 为左、右奇异向量矩阵，
$$
\mathbf{\Sigma} = \mathrm{diag}(\sigma_1, \sigma_2, \dots, \sigma_r)
$$
 为按降序排列的奇异值对角矩阵，r = rank(ΔW)。若奇异值衰减迅速，衰减迅速，即前
$$
k \ll r
$$
 个奇异值主导了 Frobenius 范数
$$
\|\Delta \mathbf{W}\|_F
$$
 的大部分能量，则
$$
\Delta \mathbf{W}
$$
 可被一个低秩矩阵高效逼近。

大量实证研究表明，在对大型语言模型进行下游任务微调时，权重更新矩阵的奇异值谱呈现出显著的“长尾衰减”特性：前几个奇异值集中了绝大部分的谱能量，而后续分量贡献微弱。这一现象表明，
$$
\Delta \mathbf{W}
$$
 的本质维度远低于其原始参数空间的维度，因而具备强低秩近似潜力。


| 奇异值序号 | 1   | 2   | 3   | 4   | 5   | ... | 100    |
| ----- | --- | --- | --- | --- | --- | --- | ------ |
| 值     | 15  | 8   | 3   | 1   | 0.2 | ... | ~0.001 |


这意味着：只要保留前 4~8 个奇异向量（即秩 r=4~8），就能捕获超过 90% 的更新能量。

基于此，LoRA 将权重更新显式地参数化为两个低秩矩阵的乘积：

$$
\Delta \mathbf{W} = \mathbf{A} \mathbf{B}, \quad \text{其中 } \mathbf{A} \in \mathbb{R}^{d_{\text{out}} \times r},\ \mathbf{B} \in \mathbb{R}^{r \times d_{\text{in}}},\ r \ll \min(d_{\text{out}}, d_{\text{in}})
$$

该形式等价于对
$$
\Delta \mathbf{W}
$$
 施加秩约束
$$
\mathrm{rank}(\Delta \mathbf{W}) \leq r
$$
 ，从而在参数空间中强制学习其主导更新方向。从 SVD 视角看，这种分解可视为对
$$
\Delta \mathbf{W}
$$
 的前
$$
r
$$
 个主奇异成分的隐式逼近，保留了更新中最关键的语义方向，同时滤除噪声或冗余变化。

综上所述，从 SVD 出发的谱分析为 LoRA 中的低秩假设提供了坚实的理论支撑：权重更新的低秩性并非人为强加的简化，而是深度模型微调过程中普遍存在的内在属性。LoRA 正是通过显式建模这一属性，实现了高效、紧凑且表达力强的参数更新机制。

#### 3\. 参数量对比

设原始权重矩阵
$$
W
$$
 的大小为
$$
d \times k
$$
 ，则全参数微调需更新
$$
d \times k
$$
 个参数。

而LoRA仅需学习
$$
A
$$
 和
$$
B
$$
 ，参数量为：

$$
\text{LoRA参数量} = d \times r + r \times k = r(d + k)
$$

参数节省比例为：

$$
\frac{r(d + k)}{d k} = r \left( \frac{1}{d} + \frac{1}{k} \right)
$$

例如，当
$$
d = k = 1024
$$
,
$$
r = 8
$$
 时：

- 全参数更新：
$$
1024 \times 1024 = 1,048,576
$$
 参数

- LoRA参数：
$$
8 \times (1024 + 1024) = 16,384
$$
 参数

- 节省比例：约 98.4%

#### 4\. 初始化与训练策略

- 初始化：矩阵
$$
A
$$
 通常从随机高斯分布初始化，而
$$
B
$$
 初始化为零矩阵。这样在训练初期，
$$
\Delta W = AB \approx 0
$$
 ，保证模型行为接近原始预训练模型。

- 梯度更新：仅对
$$
A
$$
 和
$$
B
$$
 进行梯度反向传播，原始
$$
W
$$
 冻结。

- 推理时合并：训练完成后，可将
$$
A B
$$
 合并到原始权重中：
$$
W_{\text{new}} = W + A B
$$
 ，从而实现零额外推理开销。

## 五、LoRA微调实战

通过一个完整的实战案例，展示如何使用LoRA对大模型进行高效微调。

#### 1.安装大模型

在modelscope下载对应模型，由于机器资源受限，我选择了1.5B的千问模型。

\# 下载地址

https://www.modelscope.cn/models/Qwen/Qwen2.5-1.5B-Instruct

\# git下载

git lfs install

git clone https://www.modelscope.cn/Qwen/Qwen2.5-1.5B-Instruct.git

#### 2\. 环境准备

\# 安装微调所必须的依赖

\# 安装大模型核心库（加载、训练、推理）

pip install transformers

\# 高效加载和处理数据集（如 jsonl 文件）

pip install datasets

\# 支持 CPU/GPU 自动加速，简化训练

pip install accelerate

\# 实现 LoRA 微调（小参数、快训练）

pip install peft

\# 支持 8-bit 量化，降低显存占用

pip install bitsandbytes

\# 支持 Qwen 等模型的分词功能

pip install sentencepiece

#### 3\. 构建专业知识数据集

以内部的智能风控平台——超觉的相关知识进行数据集构建。

```java
{"instruction": "什么是超觉？", "input": "", "output": "“超觉”是“超感官知觉（ESP）”的简称，寓意用超感知能力赋能风控。它是“超觉一站式智能风控平台”的核心，基于数据、策略、模型、流程的一站式定制、仿真、预测，构建对风险的遥视和透视能力。"}
{"instruction": "超觉的愿景是什么？", "input": "", "output": "打造一站式、全链路、智能化的风控解决方案，持续提高场景金融的风控管理能力。"}
{"instruction": "超觉平台能做什么？", "input": "", "output": "超觉平台能通过数据仿真、策略推演、模型预测，实现对风险的遥视、透视、影响和控制，赋能客户和集团，让信用价值被看见。"}
{"instruction": "为什么叫“超觉”？", "input": "", "output": "“超觉”源自“超感官知觉（ESP）”，俗称“第六感”。平台以此命名，寓意用超感知能力驾驭风险，实现对风险的预知和致动。"}
{"instruction": "超觉如何帮助风控？", "input": "", "output": "超觉通过一站式定制、仿真、预测、推演，构建对风险的遥视能力和透视能力，实现对风险的影响、控制、预知、致动。"}
{"instruction": "超觉的英文是什么？", "input": "", "output": "“超觉”的英文是“UltraSense”，寓意超感知、超能力。"}
{"instruction": "超觉是谁开发的？", "input": "", "output": "超觉是阿里巴巴-场景金融-金融平台团队自主研发的一站式智能风控平台，基于对数据、策略、模型、流程的深度整合。"}
{"instruction": "超觉和传统风控的区别？", "input": "", "output": "传统风控依赖规则和经验，超觉则通过数据仿真和模型推演，实现对风险的遥视和透视，具备预知和致动能力。"}
{"instruction": "超觉的核心能力", "input": "", "output": "一站式定制、仿真、预测、推演，构建对风险的遥视和透视能力，实现影响、控制、预知、致动。"}
{"instruction": "超觉的目标客户", "input": "", "output": "超觉适用于需要场景金融风控的机构，如消费金融、供应链金融、互联网平台等。"}
```

#### 4\. 训练配置与训练过程

\# -*- coding: utf-8 -*-

"""

使用本地 Qwen2.5-1.5B-Instruct 模型进行 LoRA 微调

"""

import os

os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch

from transformers import (

```java
AutoTokenizer,
AutoModelForCausalLM,
TrainingArguments,
Trainer,
```

DataCollatorForSeq2Seq

)

from peft import get_peft_model, LoraConfig

from datasets import load_dataset

\# ========================================

\# 1. 配置路径

\# ========================================

LOCAL_MODEL_PATH = "/Users/sishangyu/Qwen2.5-1.5B-Instruct"

DATA_PATH = "./data.jsonl"

OUTPUT_DIR = "./lora-checkpoint-qwen2.5-new"

```java
os.makedirs(OUTPUT_DIR, exist_ok=True)

if not os.path.exists(DATA_PATH):

raise FileNotFoundError(f"数据文件不存在：{DATA_PATH}")
```

\# ========================================

\# 2. 加载分词器和模型

\# ========================================

print("🔧 正在加载分词器...")

tokenizer = AutoTokenizer.from_pretrained(

#### 5\. 推理展示

\# -*- coding: utf-8 -*-

"""

🔍 LoRA 微调模型 vs 原始模型 对比推理脚本（静默模式）

✅ 适配 CPU 环境（device_map="cpu"）

✅ 彻底屏蔽 generation 警告

✅ 输出干净，仅显示对比结果

"""

```java
import os

import warnings

import torch
```

from transformers import AutoTokenizer, AutoModelForCausalLM, logging as transformers_logging

from peft import PeftModel

\# ----------------------------------------------------------------------------------

\# 配置路径

\# ----------------------------------------------------------------------------------

BASE_MODEL_PATH = "/Users/sishangyu/Qwen2.5-1.5B-Instruct"

LORA_PATH = "./lora-checkpoint-qwen2.5-new" # 确保该目录下有 adapter_config.json 和 adapter_model.bin

\# ----------------------------------------------------------------------------------

\# 加载分词器

\# ----------------------------------------------------------------------------------

```java
print("🔧 正在加载分词器...")

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_PATH, trust_remote_code=True)

if tokenizer.pad_token is None:
```

tokenizer.pad_token = tokenizer.eos_token

tokenizer.pad_token_id = tokenizer.eos_token_id

\# ----------------------------------------------------------------------------------

\# 加载原始模型（微调前）

\# ----------------------------------------------------------------------------------

print("🟢 正在加载原始模型（微调前）...")

model_raw = AutoModelForCausalLM.from_pretrained(

BASE_MODEL_PATH,

device_map="cpu",

#### 6.结果展示

输出结果对比

![[1911b41f-3165-4bda-a46b-ce9d0c05b03f.png]] ![[887e93ce-b788-496c-a621-1b25d4e38393.png]] ![[5973e06d-4c15-42ed-b252-a9eed55a74e3.png]]

训练参数量对比

利用model.print_trainable_parameters()命令打印训练参数结果，结果如下

可以看到，本次微调我们使用了1.5B的模型，总参数量约为15.45亿，LoRA实际训练的参数量为218万，只动用了0.14%的参数，与全量微调相比确实大大节约了资源。

## 六、LoRA的优势与局限性分析

#### 1\. 优势

- 高参数效率：仅需微调极小部分参数，显著降低训练成本。

- 低显存占用：梯度计算仅涉及低秩矩阵，适用于消费级GPU。

- 易于部署：支持权重合并，推理无额外开销。

- 任务隔离性：不同任务可保留独立的LoRA权重，实现多任务快速切换。

- 兼容性强：可与量化（如QLoRA）、梯度检查点等技术结合，进一步压缩资源。

#### 2\. 局限性

- 表达能力受限：低秩假设在某些复杂任务中可能不足以捕捉全部更新信息。

- 超参数敏感：秩
$$
r
$$
 、alpha、dropout等需调优，不同任务最优配置可能不同。

- 初始化影响大：零初始化
$$
B
$$
 可能导致训练初期梯度不稳定。

- 不适用于所有层：某些非线性层或归一化层难以直接应用LoRA。

## 七、LoRA在工业界的应用实践

#### 1\. 个性化对话系统

企业可为每个客户或业务线训练独立的LoRA适配器，共享基础大模型，实现低成本定制化服务。

#### 2\. 多任务学习平台

通过保存多个LoRA权重（如客服LoRA、销售LoRA、技术支持LoRA），实现单模型多技能切换。

#### 3\. 边缘设备部署

结合量化与LoRA，可在手机、IoT设备上部署轻量级大模型微调版本。

#### 4\. 持续学习系统

当新任务到来时，仅需训练新的LoRA模块，避免对旧任务的灾难性遗忘。

## 八、未来发展方向

尽管LoRA已取得成功，未来仍有多个值得探索的方向：

1. 自动化秩分配：基于任务复杂度或数据分布动态调整各层的秩。

2. 结构化低秩分解：结合卷积、稀疏性等先验知识，进一步提升效率。

3. 跨模态LoRA：将LoRA扩展至视觉、语音等多模态大模型。

4. 理论分析：从优化动态、泛化误差等角度建立LoRA的理论基础。

## 九、总结

LoRA作为一种高效、简洁且性能优越的参数微调方法，正在深刻改变大模型的应用范式。它通过低秩矩阵分解的思想，巧妙地将微调过程从“全量更新”转变为“增量适配”，在保持模型性能的同时，将训练成本降低两个数量级以上。

本文系统介绍了LoRA的技术背景、数学原理、公式推导、实战案例及其优缺点，验证了LoRA在真实场景中的有效性。

对于研究人员和工程师而言，掌握LoRA不仅是提升模型开发效率的实用技能，更是理解“参数高效学习”这一前沿方向的重要入口。随着大模型技术的持续演进，LoRA及其衍生方法有望在个性化AI、边缘智能、多任务学习等领域发挥更大作用。

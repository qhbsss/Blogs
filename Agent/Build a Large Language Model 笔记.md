---
title: "Build a Large Language Model 笔记"
source: "https://ata.atatech.org/articles/11020596006?spm=ata.21736010.0.0.4bf075365aHapE"
author:
published:
created: 2026-04-21
description:
tags:
  - "clippings"
---
云智能集团










近期读了Build a Large Language Model 这本书，觉得是一个很好的大模型入门书籍，因此记录一下相关笔记。

构建LLM主要需要下面的步骤，书中按照顺序对每一步进行了描述

![[00bc35bc-ac69-4bed-b532-e7940c1e9bd6.png]]

## 文本数据处理

## embeddings 的理解

深度神经网络模型，包括大型语言模型（LLM），无法直接处理原始文本。由于文本与用于实现和训练神经网络的数学运算不兼容。因此，我们需要一种方法将单词表示为连续值向量。将数据转换为向量格式的概念通常被称为嵌入 `embedding` 。通过使用特定的神经网络层或其他预训练神经网络模型，我们可以嵌入不同类型的数据——例如视频、音频和文本。

从本质上讲，嵌入是一种将离散对象（如单词、图像甚至整个文档）映射到连续向量空间中的方法——嵌入的主要目的是将非数字数据转换为神经网络可以处理的格式。虽然词嵌入是文本嵌入中最常见的形式，但也存在用于句子、段落或整个文档的嵌入。句子或段落嵌入是增强检索生成（retrieval-augmented generation）的流行选择。增强检索生成将生成（如生成文本）与检索（如搜索外部知识库）结合起来，以在生成文本时提取相关信息。

大型语言模型（LLM）通常会生成自己的嵌入，这些嵌入是输入层的一部分，并在训练过程中更新。嵌入大小根据具体的模型而不同。这是在性能和效率之间的权衡。最小的 GPT-2 模型（117M 和 125M 参数）使用 768 维的嵌入来提供具体示例。最大的 GPT-3 模型（175B 参数）使用 12,288 维的嵌入。

## Tokenizing text

这一步将输入文本拆分为单独的token，

![[061339f8-5909-4229-b699-6472e8a06834.png]]

一个简单的 tokenizer 如下所示：

preprocessed = re.split(r'([,.:;?_!"()\\']|--|\\s)', raw_text)

preprocessed = [item.strip() for item in preprocessed if item.strip()]

print(len(preprocessed))

在开发一个简单的分词器时，是否应该将空格编码为独立的字符或只是将其移除，取决于我们的应用及其需求。移除空格可以减少内存和计算需求。然而，如果我们训练的模型对文本的具体结构敏感（例如，对缩进和空格敏感的 Python 代码），保留空格可能会很有用。

## Token转化为TokenID

这一步转换是将TokenID 转换为嵌入向量之前的中间步骤。为了将之前生成的Token映射为TokenID，我们必须首先建立一个词汇表(vocabulary)。这个词汇表定义了如何将每个独特的单词和特殊字符映射为唯一的整数。

当我们想将大型语言模型的输出从数字转换回文本时，我们需要一种将TokenID转换为文本的方法。为此，我们可以创建一个词汇表的逆向版本，将TokenID映射回相应的文本。

如图所示

![[af6ea036-4c25-4116-9c58-302b9c6b682f.png]]

class SimpleTokenizerV1:

def __init__(self, vocab):

self.str_to_int = vocab

self.int_to_str = {i:s for s,i in vocab.items()}

def encode(self, text):

preprocessed = re.split(r'([,.?_!"()\\']|--|\\s)', text)

preprocessed = [

item.strip() for item in preprocessed if item.strip()

]

ids = [self.str_to_int[s] for s in preprocessed]

return ids

def decode(self, ids):

```java
text = " ".join([self.int_to_str[i] for i in ids])

text = re.sub(r'\\s+([,.?!"()\\'])', r'\\1', text)

return text
```

## 添加特殊token

我们需要修改分词器以处理未知词。我们还需要解决特殊上下文标记的使用和添加问题，这些标记可以增强模型对文本中上下文或其他相关信息的理解。这些特殊标记可以包括未知词标记和文档边界标记。例如，我们将修改词汇表和分词器 SimpleTokenizerV2，以支持两个新标记，<|unk|> 和 <|endoftext|>

```java
all_tokens = sorted(list(set(preprocessed)))
all_tokens.extend(["<|endoftext|>", "<|unk|>"])
vocab = {token:integer for integer,token in enumerate(all_tokens)}
class SimpleTokenizerV2:
```

def __init__(self, vocab):

self.str_to_int = vocab

self.int_to_str = { i:s for s,i in vocab.items()}

def encode(self, text):

preprocessed = re.split(r'([,.:;?_!"()\\']|--|\\s)', text)

preprocessed = [

item.strip() for item in preprocessed if item.strip()

]

preprocessed = [item if item in self.str_to_int

else "<|unk|>" for item in preprocessed]

ids = [self.str_to_int[s] for s in preprocessed]

return ids

def decode(self, ids):

```java
text = " ".join([self.int_to_str[i] for i in ids])

text = re.sub(r'\\s+([,.:;?!"()\\'])', r'\\1', text)

return text
```

## Byte pair encoding

byte pair encoding（BPE）是一种更复杂的分词方案。BPE 分词器被用于训练像 GPT-2、GPT-3 以及最初用于 ChatGPT 的模型这样的大型语言模型。实现BPE可能相对复杂，我们可以用已有的实现

`pip install tiktoken`

tokenizer = tiktoken.get_encoding("gpt2")

text = (

"Hello, do you like tea? <|endoftext|> In the sunlit terraces"

"of someunknownPlace."

)

integers = tokenizer.encode(text, allowed_special={"<|endoftext|>"})

print(integers)

BPE算法将其预定义词汇表中不存在的单词拆分为更小的子词单元，甚至是单个字符，从而能够处理词汇表外的单词。因此，得益于BPE算法，如果分词器在分词过程中遇到不熟悉的单词，它可以将其表示为一系列子词标记或字符。

![[ed7ccaf5-514b-4e3e-83be-81062c020ebe.png]]

BPE算法的实现，简而言之，它通过迭代地将频繁出现的字符合并为子词，以及将频繁出现的子词合并为单词，从而构建其词汇表。例如，BPE 最初会将所有单个字符添加到其词汇表中（“a”、“b”等）。在下一阶段，它将频繁一起出现的字符组合合并为子词。

## 使用滑动窗口进行数据采样

下一步是生成训练LLM所需的输入-目标对（input-target pairs），我们需要实现一个高效的数据加载器，遍历输入数据集并返回（PyTorch tensors 格式）。

![[291700df-f0eb-4058-8f32-c53c962c663d.png]] ![[3c37b9dd-303c-4030-8f95-91982e3f4b24.png]]

from torch.utils.data import Dataset, DataLoader

class GPTDatasetV1(Dataset):

def __init__(self, txt, tokenizer, max_length, stride):

self.input_ids = []

self.target_ids = []

\# Tokenize the entire text

token_ids = tokenizer.encode(txt, allowed_special={"<|endoftext|>"})

assert len(token_ids) > max_length, "Number of tokenized inputs must at least be equal to max_length+1"

\# Use a sliding window to chunk the book into overlapping sequences of max_length

for i in range(0, len(token_ids) - max_length, stride):

input_chunk = token_ids[i:i + max_length]

target_chunk = token_ids[i + 1: i + max_length + 1]

self.input_ids.append(torch.tensor(input_chunk))

self.target_ids.append(torch.tensor(target_chunk))

def __len__(self):

return len(self.input_ids)

def __getitem__(self, idx):

return self.input_ids[idx], self.target_ids[idx]

def create_dataloader_v1(txt, batch_size=4, max_length=256,

stride=128, shuffle=True, drop_last=True,

num_workers=0):

\# Initialize the tokenizer

tokenizer = tiktoken.get_encoding("gpt2")

\# Create dataset

dataset = GPTDatasetV1(txt, tokenizer, max_length, stride)

按照如下方法调用

with open("the-verdict.txt", "r", encoding="utf-8") as f:

raw_text = f.read()

dataloader = create_dataloader_v1(

raw_text, batch_size=1, max_length=4, stride=1, shuffle=False)

```java
data_iter = iter(dataloader)

first_batch = next(data_iter)

print(first_batch)
```

## 创建token embeddings

为大型语言模型训练准备输入文本的最后一步是将TokenID转换为嵌入向量，我们需要用随机值初始化这些嵌入权重。这种初始化作为大型语言模型（LLM）学习过程的起点。后面的步骤中，需要通过训练来学习这些权重

## 位置编码

原则上，token embeddings是大型语言模型（LLM）适合的输入。然而，LLM 的一个小缺点是它们的自注意力机制对于序列中令牌的位置或顺序没有概念。相同的令牌 ID 总是映射到相同的向量表示，不管该令牌 ID 在输入序列中的位置如何。为此，我们可以使用两大类位置感知嵌入：相对位置嵌入和绝对位置嵌入。绝对位置嵌入直接与序列中的具体位置相关联。对于输入序列中的每个位置，都将向令牌的嵌入添加唯一的嵌入，以传达其精确位置。相对于关注一个标记的绝对位置，相对位置嵌入的重点在于标记之间的相对位置或距离。这意味着模型学习的是“相距多远”而不是“确切位置在哪”。这样做的好处是模型能够更好地泛化到不同长度的序列，即使在训练期间没有看到过这样的长度。两种类型的位置嵌入都旨在增强大型语言模型理解标记顺序和关系的能力，从而确保预测更加准确且具有上下文感知性。选择哪种方式通常取决于具体的应用情况和所处理数据的性质。OpenAI 的 GPT 模型使用的是在训练过程中优化的位置嵌入，而不是像原始 Transformer 模型中的位置编码那样固定或预定义。这个优化过程是模型训练本身的一部分。

![[6671d544-7a46-449f-82ad-e544d79dda43.png]]

## 注意力机制

## 长序列建模的问题

在深入探讨大型语言模型（LLM）核心的自注意力机制之前，让我们先考虑一下不包含注意力机制的前LLM架构所存在的问题。假设我们想开发一个将文本从一种语言翻译成另一种语言的模型。我们不能简单地逐字翻译文本，因为源语言和目标语言的语法结构不同。在编码器-解码器 RNN 中，输入文本被送入编码器，编码器会按顺序处理它。编码器在每一步都会更新其隐藏状态（隐藏层的内部值），试图在最终隐藏状态中捕捉输入句子的整体含义，如图 所示。然后解码器使用这个最终隐藏状态开始生成翻译句子，一次生成一个单词。它也会在每一步更新其隐藏状态，这个状态应携带预测下一个单词所需的上下文信息。

![[37af560c-8d10-4da1-ab27-a8b7ae4afc63.png]]

虽然我们不需要了解这些编码器-解码器RNN的内部工作原理，但关键思想是编码器部分将整个输入文本处理成一个隐藏状态（记忆单元）。然后解码器使用这个隐藏状态来生成输出。你可以将这个隐藏状态视为一个嵌入向量。编码器-解码器RNN的一个大限制是，在解码阶段，RNN无法直接访问编码器的早期隐藏状态。因此，它完全依赖于当前的隐藏状态，这个状态封装了所有相关信息。这可能导致上下文丢失，尤其是在依赖关系可能跨越较长距离的复杂句子中。

## 一个没有可训练权重的简单自注意力机制

自注意力机制是一种允许输入序列中的每个位置在计算序列表示时考虑与同一序列中所有其他位置的相关性的算法。它是基于transformer架构的现代大语言模型（如GPT系列）的关键组成部分。

### 计算单个token的context vector

![[f65e18f7-7eb2-45bb-8a16-105cd9e05631.png]]

上图展示了一个输入序列，其中每个token对应了一个三维的嵌入向量，在自注意力机制中，我们需要计算每一个x(i)对应的上下文向量z(i),为了说明这一点，我们用x(2)为例子

import torch

inputs = torch.tensor(

[[0.43, 0.15, 0.89], # Your (x^1)

[0.55, 0.87, 0.66], # journey (x^2)

[0.57, 0.85, 0.64], # starts (x^3)

[0.22, 0.58, 0.33], # with (x^4)

[0.77, 0.25, 0.10], # one (x^5)

[0.05, 0.80, 0.55]] # step (x^6)

)

![[7f321a71-4b67-4365-8165-216fc7d156f8.png]]

首先计算一个中间值w,也就是注意力分数(attention scores)，通过将query token与其他的token进行点乘得到注意力得分，针对query token为x(2),将x(2)与每一个input进行点乘

query = inputs[1]

```java
attn_scores_2 = torch.empty(inputs.shape[0])
for i, x_i in enumerate(inputs):
attn_scores_2[i] = torch.dot(x_i, query)
print(attn_scores_2)
```

![[290fc795-0302-4957-9239-3e48da958e24.png]]

然后对得到的注意力分数进行归一化，如上图所示，最终得到了总和为一的一个向量。实践中，通常使用softmax

def softmax_naive(x):

```java
return torch.exp(x) / torch.exp(x).sum(dim=0)
attn_weights_2_naive = softmax_naive(attn_scores_2)
print("Attention weights:", attn_weights_2_naive)
print("Sum:", attn_weights_2_naive.sum())
```

与相应的注意力权重相乘，然后将得到的向量求和来计算上下文向量 z(2)


![[f715c82d-5212-4896-9d4f-7629953422a6.png]]

然后把上面的方法推广以计算所有的z(i)

### 为所有输入token计算注意力权重

上面介绍了计算一个token的z(i),下面把这个方法推广到所有的z(i)

![[a5391603-73bd-49f5-b01f-266615d6472f.png]]

对所有的input应用上面的步骤,首先计算点积：

```java
attn_scores = torch.empty(6, 6)
for i, x_i in enumerate(inputs):
for j, x_j in enumerate(inputs):
attn_scores[i, j] = torch.dot(x_i, x_j)
print(attn_scores)
```

通过for循环计算会比较慢，可以使用矩阵乘法来实现上面的步骤

attn_scores = inputs @ inputs.T

print(attn_scores)

也就是输入乘以它的转置，这里input是一个矩阵，每一行代表一个词的vector表示，然后执行归一化。这里为什么要乘以转置呢？回想上一节里面，计算单个词的注意力权重，需要把这个词（一维的向量），与其他所有的词进行点乘，而执行乘以自己的转置，第一行第一列对应的是第一个词与自己的点积，第一行第二列对应的是第一个词与第二个词的点积，以此类推，最后的注意力权重中，第一行对应的就是第一个词作为query的注意力权重。以此类推，第二行是第二个词的注意力权重。

attn_weights = torch.softmax(attn_scores, dim=-1)

这里在最后一维度进行归一化，最后的结果就是每一行的和都为1,如下：

tensor([[0.2098, 0.2006, 0.1981, 0.1242, 0.1220, 0.1452],

[0.1385, 0.2379, 0.2333, 0.1240, 0.1082, 0.1581],

[0.1390, 0.2369, 0.2326, 0.1242, 0.1108, 0.1565],

[0.1435, 0.2074, 0.2046, 0.1462, 0.1263, 0.1720],

[0.1526, 0.1958, 0.1975, 0.1367, 0.1879, 0.1295],

[0.1385, 0.2184, 0.2128, 0.1420, 0.0988, 0.1896]]

最后我们需要将token与算出来的注意力权重相乘，对应矩阵运算如下：

all_context_vecs = attn_weights @ inputs

print(all_context_vecs)

这里input是一个矩阵，每一行代表一个词。上面讲到，注意力权重的第一行对应的是第一个词的注意力权重，按照上一节的计算，我们应该将这一行的第一个元素乘以input的第一个词，第二个元素乘以第二个词，然后再相加变成一个向量。对应矩阵乘法 `attn_weights @ inputs` 中，第一个元素就是注意力权重的第一行，乘以对应每一个input的第一个元素，然后相加，也就是说 `all_context_vecs` 的每一行，对应的是上文的z(i)。

## 实现一个带有可训练权重的自注意力机制

接下来我们实现一个可训练权重的自注意力机制。我们需要为上面的步骤引入在模型训练过程中更新的权重矩阵。

![[9d38b946-cfb6-47a1-b868-27e0c35362fe.png]]

我们将通过引入三个可训练的权重矩阵 Wq、Wk 和 Wv，逐步实现自注意力机制。这三个矩阵用于将嵌入的输入token x(i) 分别投影到query,key,value。

上文通过计算x(2)对应的z(2)作为例子，这里仍然使用一个词来说明

x_2 = inputs[1] #输入的第二个词，x2

d_in = inputs.shape[1] # 第二个维度的大小，也就是Embedding Dimension，这里的例子里是3

d_out = 2 # GPT里，输入和输出通常是一样的，这里为了说明，设定成不一样的

torch.manual_seed(123)

W_query = torch.nn.Parameter(torch.rand(d_in, d_out), requires_grad=False)# requires_grad 设置为 False来减少输出的杂乱

W_key = torch.nn.Parameter(torch.rand(d_in, d_out), requires_grad=False)

W_value = torch.nn.Parameter(torch.rand(d_in, d_out), requires_grad=False)

query_2 = x_2 @ W_query

key_2 = x_2 @ W_key

value_2 = x_2 @ W_value

print(query_2)

这里，我们将输入与每一个权重矩阵相乘来获取query, key, value。

注意这里的权重矩阵指的是weight parameters,与上面说的注意力权重（attention weights）不是一个东西。

![[e1bdbb5a-f65a-4ab2-9cb0-a0cbcc39b6a7.png]]

以第二个输入为例，注意力分数需要用对应的query点乘key，在上一节中，query和key都是用的input来代替，这里则是通过权重矩阵获得

keys_2 = keys[1]

attn_score_22 = query_2.dot(keys_2)

print(attn_score_22)

同理，计算keys_2所有的注意力分数,需要用对应query乘以key的转置

attn_scores_2 = query_2 @ keys.T

print(attn_scores_2)

然后对最后一个维度进行归一化，得到注意力权重attn_weights，除以d_k**0.5是为了缩放,避免反向传播时梯度太小

d_k = keys.shape[-1]

attn_weights_2 = torch.softmax(attn_scores_2 / d_k**0.5, dim=-1)

print(attn_weights_2)

最后一步就是将注意力权重乘以value，求和得到Context vector，如下，在上面的简单版本中，value也是用的input代替

context_vec_2 = attn_weights_2 @ values

![[8b19535b-06ed-48c7-91d4-e74de062babb.png]]

然后我们可以将上面的步骤写成python实现

import torch.nn as nn

class SelfAttention_v1(nn.Module):

def __init__(self, d_in, d_out):

```java
super().__init__()
self.W_query = nn.Parameter(torch.rand(d_in, d_out))
self.W_key = nn.Parameter(torch.rand(d_in, d_out))
self.W_value = nn.Parameter(torch.rand(d_in, d_out))
```

def forward(self, x):

keys = x @ self.W_key

queries = x @ self.W_query

values = x @ self.W_value

attn_scores = queries @ keys.T # omega

attn_weights = torch.softmax(

attn_scores / keys.shape[-1]**0.5, dim=-1

)

context_vec = attn_weights @ values

```java
return context_vec
torch.manual_seed(123)
sa_v1 = SelfAttention_v1(d_in, d_out)
print(sa_v1(inputs))
```

最后的输出如下

tensor([[0.2996, 0.8053],

[0.3061, 0.8210],

[0.3058, 0.8203],

[0.2948, 0.7939],

[0.2927, 0.7891],

[0.2990, 0.8040]], grad_fn=<MmBackward0>)

完整的图解步骤如下：

![[d608967e-a186-44ba-be4c-e9eb80bc44be.png]]

然后我们可以优化下上面的实现,使用 `nn.Linear`

class SelfAttention_v2(nn.Module):

def __init__(self, d_in, d_out, qkv_bias=False):

```java
super().__init__()
self.W_query = nn.Linear(d_in, d_out, bias=qkv_bias)
self.W_key = nn.Linear(d_in, d_out, bias=qkv_bias)
self.W_value = nn.Linear(d_in, d_out, bias=qkv_bias)
```

def forward(self, x):

```java
keys = self.W_key(x)

queries = self.W_query(x)

values = self.W_value(x)
```

attn_scores = queries @ keys.T

attn_weights = torch.softmax(attn_scores / keys.shape[-1]**0.5, dim=-1)

context_vec = attn_weights @ values

```java
return context_vec
torch.manual_seed(789)
sa_v2 = SelfAttention_v2(d_in, d_out)
print(sa_v2(inputs))
```

## 使用因果注意力隐藏未来的词

对于许多大语言模型任务，当预测序列中的下一个 token 时，你会希望自注意力机制只考虑出现在当前位置之前的 token。因果注意力，也称为掩码注意力，是自注意力的一种特殊形式。具体做法是在注意力权重的矩阵中，屏蔽掉未出现的词，然后再进行一次归一化

![[4efe7576-5f10-4304-bb12-938cf9de3cdb.png]]

#获得注意力权重

queries = sa_v2.W_query(inputs)

keys = sa_v2.W_key(inputs)

attn_scores = queries @ keys.T

attn_weights = torch.softmax(attn_scores / keys.shape[-1]**0.5, dim=-1)

print(attn_weights)

\# 构建一个对角线上为0，其余为1的矩阵

context_length = attn_scores.shape[0]

mask_simple = torch.tril(torch.ones(context_length, context_length))

print(mask_simple)

#逐个元素相乘

masked_simple = attn_weights*mask_simple

print(masked_simple)

#归一化

row_sums = masked_simple.sum(dim=-1, keepdim=True)

masked_simple_norm = masked_simple / row_sums

print(masked_simple_norm)

利用softmax的数学性质改进上面的步骤,把 `attn_scores` 的对角线上面的部分替换为 `-inf`

```java
mask = torch.triu(torch.ones(context_length, context_length), diagonal=1)
masked = attn_scores.masked_fill(mask.bool(), -torch.inf)
print(masked)
attn_weights = torch.softmax(masked / keys.shape[-1]**0.5, dim=-1)
print(attn_weights)
```

## 使用dropout丢弃额外的注意力权重

深度学习中的 dropout 是一种技术，在训练过程中随机忽略隐藏层单元，相当于“丢弃”它们。这种方法有助于防止过拟合，通过确保模型不会过度依赖任何特定的隐藏层单元来实现。需要强调的是，dropout 仅在训练期间使用，之后会被禁用。在 transformer 架构中，包括 GPT 这样的模型，注意力机制中的 dropout 通常在两个特定时间点应用：计算注意力权重之后，或者将注意力权重应用到值向量之后。在这里，我们将在计算注意力权重后应用 dropout 掩码

torch.manual_seed(123)

dropout = torch.nn.Dropout(0.5) # dropout rate of 50%

print(dropout(attn_weights))

![[6d548320-57b0-43e5-88ad-0d63f6a9b037.png]]

结合上面的流程，我们可以有下面的实现

batch = torch.stack((inputs, inputs), dim=0)

print(batch.shape) # 2 inputs with 6 tokens each, and each token has embedding dimension 3

class CausalAttention(nn.Module):

def __init__(self, d_in, d_out, context_length,

dropout, qkv_bias=False):

super().__init__()

self.d_out = d_out

```java
self.W_query = nn.Linear(d_in, d_out, bias=qkv_bias)

self.W_key = nn.Linear(d_in, d_out, bias=qkv_bias)

self.W_value = nn.Linear(d_in, d_out, bias=qkv_bias)
```

self.dropout = nn.Dropout(dropout) # New

self.register_buffer('mask', torch.triu(torch.ones(context_length, context_length), diagonal=1)) # New

def forward(self, x):

b, num_tokens, d_in = x.shape # New batch dimension b

\# For inputs where \`num_tokens\` exceeds \`context_length\`, this will result in errors

\# in the mask creation further below.

\# In practice, this is not a problem since the LLM (chapters 4-7) ensures that inputs

\# do not exceed \`context_length\` before reaching this forward method.

```java
keys = self.W_key(x)

queries = self.W_query(x)

values = self.W_value(x)
```

attn_scores = queries @ keys.transpose(1, 2) # Changed transpose

attn_scores.masked_fill_( # New, _ ops are in-place

self.mask.bool()[:num_tokens,:num_tokens], -torch.inf) # \`:num_tokens\` to account for cases where the number of tokens in the batch is smaller than the supported context_size

attn_weights = torch.softmax(

attn_scores / keys.shape[-1]**0.5, dim=-1

)

attn_weights = self.dropout(attn_weights) # New

context_vec = attn_weights @ values

return context_vec

torch.manual_seed(123)

## 多头注意力机制实现

“多头”一词指的是将注意力机制划分为多个“头”，每个头独立运行。在这种情况下，单个因果注意力模块可以被视为单头注意力，其中只有一组注意力权重按顺序处理输入。我们将从因果注意力扩展到多头注意力。首先，我们将通过堆叠多个因果注意力模块直观地构建一个多头注意力模块。然后，我们将以一种更复杂但计算上更高效的方式实现相同的多头注意力模块。

![[4f1bea52-3d14-4e78-9edd-44fd60c894ab.png]]

如前所述，多头注意力的主要思想是通过不同的、学习得到的线性投影多次（并行地）运行注意力机制

一个最简单的实现如下：

class MultiHeadAttentionWrapper(nn.Module):

def __init__(self, d_in, d_out, context_length, dropout, num_heads, qkv_bias=False):

super().__init__()

self.heads = nn.ModuleList(

[CausalAttention(d_in, d_out, context_length, dropout, qkv_bias)

for _ in range(num_heads)]

)

def forward(self, x):

return torch.cat([head(x) for head in self.heads], dim=-1)

torch.manual_seed(123)

context_length = batch.shape[1] # This is the number of tokens

d_in, d_out = 3, 2

mha = MultiHeadAttentionWrapper(

d_in, d_out, context_length, 0.0, num_heads=2

)

```java
context_vecs = mha(batch)

print(context_vecs)

print("context_vecs.shape:", context_vecs.shape)
```

这个实现是通过堆叠多个头实现的，下面我们通过weight splits来实现

class MultiHeadAttention(nn.Module):

def __init__(self, d_in, d_out, context_length, dropout, num_heads, qkv_bias=False):

super().__init__()

assert (d_out % num_heads == 0), \\

"d_out must be divisible by num_heads"

self.d_out = d_out

self.num_heads = num_heads

self.head_dim = d_out // num_heads # Reduce the projection dim to match desired output dim

```java
self.W_query = nn.Linear(d_in, d_out, bias=qkv_bias)

self.W_key = nn.Linear(d_in, d_out, bias=qkv_bias)

self.W_value = nn.Linear(d_in, d_out, bias=qkv_bias)
```

self.out_proj = nn.Linear(d_out, d_out) # Linear layer to combine head outputs

self.dropout = nn.Dropout(dropout)

self.register_buffer(

"mask",

torch.triu(torch.ones(context_length, context_length),

diagonal=1)

)

def forward(self, x):

b, num_tokens, d_in = x.shape

\# As in \`CausalAttention\`, for inputs where \`num_tokens\` exceeds \`context_length\`,

\# this will result in errors in the mask creation further below.

\# In practice, this is not a problem since the LLM (chapters 4-7) ensures that inputs

\# do not exceed \`context_length\` before reaching this forward method.

```java
keys = self.W_key(x) # Shape: (b, num_tokens, d_out)

queries = self.W_query(x)

values = self.W_value(x)
```

\# We implicitly split the matrix by adding a \`num_heads\` dimension

\# Unroll last dim: (b, num_tokens, d_out) -> (b, num_tokens, num_heads, head_dim)

keys = keys.view(b, num_tokens, self.num_heads, self.head_dim)

values = values.view(b, num_tokens, self.num_heads, self.head_dim)

上面的实现里面有一些需要注意的地方

维度转换：

首先把d_out，转换成 num_heads, head_dim

(b, num_tokens, d_out) -> (b, num_tokens, num_heads, head_dim)

然后转置中间两个维度，把num_heads提前，这样最后的两个维度变成num_tokens, head_dim，就跟之前的计算方法一样了，也就是用queries 乘 num_tokens, head_dim的转置得到attn_scores

(b, num_tokens, num_heads, head_dim) -> (b, num_heads, num_tokens, head_dim)

最后 `attn_weights @ values).transpose(1, 2)` 把维度变成(b, num_tokens, num_heads, head_dim)

然后重新组合成(b, num_tokens, self.d_out)

![[92d80c23-d2a2-44e5-a36b-22eaef905ae1.png]]

包含kv cache实现的版本

class MultiHeadAttention(nn.Module):

def __init__(self, d_in, d_out, context_length, dropout, num_heads, qkv_bias=False):

super().__init__()

assert d_out % num_heads == 0, "d_out must be divisible by num_heads"

self.d_out = d_out

self.num_heads = num_heads

self.head_dim = d_out // num_heads # Reduce the projection dim to match desired output dim

```java
self.W_query = nn.Linear(d_in, d_out, bias=qkv_bias)

self.W_key = nn.Linear(d_in, d_out, bias=qkv_bias)

self.W_value = nn.Linear(d_in, d_out, bias=qkv_bias)
```

self.out_proj = nn.Linear(d_out, d_out) # Linear layer to combine head outputs

self.dropout = nn.Dropout(dropout)

self.register_buffer(

"mask",

torch.triu(torch.ones(context_length, context_length), diagonal=1),

persistent=False

)

####################################################

\# NEW

self.register_buffer("cache_k", None, persistent=False)

self.register_buffer("cache_v", None, persistent=False)

self.ptr_current_pos = 0

####################################################

def forward(self, x, use_cache=False):

b, num_tokens, d_in = x.shape

```java
keys_new = self.W_key(x) # Shape: (b, num_tokens, d_out)

values_new = self.W_value(x)

queries = self.W_query(x)
```

\# We implicitly split the matrix by adding a \`num_heads\` dimension

\# Unroll last dim: (b, num_tokens, d_out) -> (b, num_tokens, num_heads, head_dim)

## 从头实现一个 GPT 模型

## LLM基本架构编写

![[a70d04e6-7753-43d4-9f01-a188c5fa3eec.png]]

首先我们确定一些基本的配置

GPT_CONFIG_124M = {

"vocab_size": 50257, # Vocabulary size

"context_length": 1024, # Context length

"emb_dim": 768, # Embedding dimension

"n_heads": 12, # Number of attention heads

"n_layers": 12, # Number of layers

"drop_rate": 0.1, # Dropout rate

"qkv_bias": False # Query-Key-Value bias

}

vocab_size 指的是由 BPE 分词器生成的大小为50,257 的词汇表。

context_length 表示模型通过位置嵌入可以处理的最大输入 token 数量。

emb_dim 表示嵌入向量的大小，将每个 token 转换为 768 维向量。

n_heads 表示多头注意力机制中的注意力头数量

n_layers 指模型中的 Transformer 块数

drop_rate 表示 dropout 的概率。

qkv_bias 决定是否在多头注意力的 Linear 层中为q,k,v计算包含偏置向量

下面是一个简单的实现，旨在展示不同模块之间是如何组合的，下面将会介绍每一个模块的实现

```java
import torch

import torch.nn as nn

class DummyGPTModel(nn.Module):
```

def __init__(self, cfg):

```java
super().__init__()
self.tok_emb = nn.Embedding(cfg["vocab_size"], cfg["emb_dim"])
self.pos_emb = nn.Embedding(cfg["context_length"], cfg["emb_dim"])
self.drop_emb = nn.Dropout(cfg["drop_rate"])
```

\# Use a placeholder for TransformerBlock

self.trf_blocks = nn.Sequential(

*[DummyTransformerBlock(cfg) for _ in range(cfg["n_layers"])])

\# Use a placeholder for LayerNorm

self.final_norm = DummyLayerNorm(cfg["emb_dim"])

self.out_head = nn.Linear(

cfg["emb_dim"], cfg["vocab_size"], bias=False

)

def forward(self, in_idx):

batch_size, seq_len = in_idx.shape

tok_embeds = self.tok_emb(in_idx)

pos_embeds = self.pos_emb(torch.arange(seq_len, device=in_idx.device))

x = tok_embeds + pos_embeds

```java
x = self.drop_emb(x)
x = self.trf_blocks(x)
x = self.final_norm(x)
logits = self.out_head(x)
return logits
class DummyTransformerBlock(nn.Module):
```

def __init__(self, cfg):

super().__init__()

![[92e2b5b7-3cba-4b4a-94c8-1ee07b95eb9a.png]]

## layer normalization

训练具有多层的深度神经网络时，会遇到梯度消失或梯度爆炸等问题。这些问题会导致训练不稳定，使网络难以有效地调整其权重，这意味着学习过程难以找到一组能够最小化损失函数的神经网络参数（权重）。

我们需要实现层归一化，以提高神经网络训练的稳定性和效率。层归一化的主要思想是调整神经网络层的激活值（输出），使其具有均值为0和方差为1的特性，也称为单位方差。这种调整加快了有效权重的收敛速度，并确保训练的一致性和可靠性。在GPT-2和现代Transformer架构中，层归一化通常应用于多头注意力模块之前和之后。

步骤如下：

```java
mean = out.mean(dim=-1, keepdim=True)
var = out.var(dim=-1, keepdim=True)
out_norm = (out - mean) / torch.sqrt(var)
class LayerNorm(nn.Module):
```

def __init__(self, emb_dim):

super().__init__()

self.eps = 1e-5

self.scale = nn.Parameter(torch.ones(emb_dim))

self.shift = nn.Parameter(torch.zeros(emb_dim))

def forward(self, x):

```java
mean = x.mean(dim=-1, keepdim=True)
var = x.var(dim=-1, keepdim=True, unbiased=False)
norm_x = (x - mean) / torch.sqrt(var + self.eps)
return self.scale * norm_x + self.shift
```

其中scale 和 shift 是两个可训练的参数（与输入维度相同）

## 实现一个使用 GELU 激活函数的前馈网络

Gaussian error linear unit,其近似实现如下：

![[55323526-d9d1-41c8-9261-c5f7e5c6cbe6.png]]

class GELU(nn.Module):

def __init__(self):

super().__init__()

def forward(self, x):

```java
return 0.5 * x * (1 + torch.tanh(

torch.sqrt(torch.tensor(2.0 / torch.pi)) *

(x + 0.044715 * torch.pow(x, 3))
```

))

两种激活函数的对比

![[88b747ef-c40a-4e86-a4c3-6b324197ceea.png]]

ReLU 在零点处有一个尖锐的拐角，这有时会使优化变得更加困难，尤其是在非常深或架构复杂的网络中。此外，与对任何负输入都输出零的 ReLU 不同，GELU 会对负值产生一个小的非零输出。这一特性意味着在训练过程中，接收到负输入的神经元仍然可以对学习过程做出贡献，尽管比正输入的贡献要小。

最后，FeedForward的实现如下：

class FeedForward(nn.Module):

def __init__(self, cfg):

super().__init__()

self.layers = nn.Sequential(

nn.Linear(cfg["emb_dim"], 4 * cfg["emb_dim"]),

GELU(),

nn.Linear(4 * cfg["emb_dim"], cfg["emb_dim"]),

)

def forward(self, x):

return self.layers(x)

## 添加残差连接

残差连接最初是为计算机视觉中的深度网络（特别是在残差网络中）提出的，以缓解梯度消失的问题。梯度消失问题是指梯度（在训练过程中指导权重更新）在向后传播穿过各层时会逐渐变小，从而使得有效训练前面的层变得困难。残差连接通过跳过一个或多个层为梯度在网络中流动创建了一条替代的、更短的路径，通过将一层的输出添加到后面一层的输出来实现的。

![[60c37312-4848-4cce-bcee-01fa6ac75919.png]]

上图用代码表示如下：

关键实现在于将输入加到输出上

class ExampleDeepNeuralNetwork(nn.Module):

def __init__(self, layer_sizes, use_shortcut):

super().__init__()

self.use_shortcut = use_shortcut

self.layers = nn.ModuleList([

```java
nn.Sequential(nn.Linear(layer_sizes[0], layer_sizes[1]), GELU()),
nn.Sequential(nn.Linear(layer_sizes[1], layer_sizes[2]), GELU()),
nn.Sequential(nn.Linear(layer_sizes[2], layer_sizes[3]), GELU()),
nn.Sequential(nn.Linear(layer_sizes[3], layer_sizes[4]), GELU()),
nn.Sequential(nn.Linear(layer_sizes[4], layer_sizes[5]), GELU())
```

])

def forward(self, x):

for layer in self.layers:

\# Compute the output of the current layer

layer_output = layer(x)

\# Check if shortcut can be applied

if self.use_shortcut and x.shape == layer_output.shape:

x = x + layer_output

else:

x = layer_output

return x

## 构建transformer block

我们可以把上面的每一个组件合并起来，组成TransformerBlock

class TransformerBlock(nn.Module):

def __init__(self, cfg):

super().__init__()

self.att = MultiHeadAttention(

d_in=cfg["emb_dim"],

d_out=cfg["emb_dim"],

context_length=cfg["context_length"],

num_heads=cfg["n_heads"],

dropout=cfg["drop_rate"],

qkv_bias=cfg["qkv_bias"])

```java
self.ff = FeedForward(cfg)
self.norm1 = LayerNorm(cfg["emb_dim"])
self.norm2 = LayerNorm(cfg["emb_dim"])
self.drop_shortcut = nn.Dropout(cfg["drop_rate"])
```

def forward(self, x):

\# Shortcut connection for attention block

shortcut = x

x = self.norm1(x)

x = self.att(x) # Shape [batch_size, num_tokens, emb_size]

x = self.drop_shortcut(x)

x = x + shortcut # Add the original input back

\# Shortcut connection for feed forward block

shortcut = x

```java
x = self.norm2(x)

x = self.ff(x)

x = self.drop_shortcut(x)
```

x = x + shortcut # Add the original input back

```java
return x
torch.manual_seed(123)
x = torch.rand(2, 4, 768)
block = TransformerBlock(GPT_CONFIG_124M)
```

结构如下图：

![[5daea281-e87c-41ab-81a5-0a4d180f7c6d.png]]

有几个注意的点：

‒

Transformer模块的输入与输出的维度相同，这是特地设计的，使其能够在各种序列到序列的任务中有效应用，其中每个输出向量直接对应一个输入向量，保持一一对应关系。同时，输出包含整个输入序列的信息。这意味着虽然序列的物理维度（长度和特征大小）在通过Transformer模块时保持不变，但每个输出向量的内容会被重新编码，以整合来自整个输入序列的上下文信息。

‒

归一化层用在注意力机制与前馈网络之前

‒

中间使用残差连接

## GPT模型编写

以GPT-2为例：

![[1a97b61e-75af-4285-bc93-205bfa8cac29.png]]

我们可以把开始的DummyGPTModel补全成下面的代码

class GPTModel(nn.Module):

def __init__(self, cfg):

```java
super().__init__()
self.tok_emb = nn.Embedding(cfg["vocab_size"], cfg["emb_dim"])
self.pos_emb = nn.Embedding(cfg["context_length"], cfg["emb_dim"])
self.drop_emb = nn.Dropout(cfg["drop_rate"])
```

self.trf_blocks = nn.Sequential(

*[TransformerBlock(cfg) for _ in range(cfg["n_layers"])])

self.final_norm = LayerNorm(cfg["emb_dim"])

self.out_head = nn.Linear(

cfg["emb_dim"], cfg["vocab_size"], bias=False

)

def forward(self, in_idx):

batch_size, seq_len = in_idx.shape

tok_embeds = self.tok_emb(in_idx)

pos_embeds = self.pos_emb(torch.arange(seq_len, device=in_idx.device))

x = tok_embeds + pos_embeds # Shape [batch_size, num_tokens, emb_size]

```java
x = self.drop_emb(x)
x = self.trf_blocks(x)
x = self.final_norm(x)
logits = self.out_head(x)
return logits
torch.manual_seed(123)
model = GPTModel(GPT_CONFIG_124M)
out = model(batch)
print("Input batch:\\n", batch)
print("\\nOutput shape:", out.shape)
print(out)
```

其中：

`self.tok_emb = nn.Embedding(cfg["vocab_size"], cfg["emb_dim"])` 把 `vocab_size` 映射到 `emb_dim` 这个组件把50257维度的ont-hot编码投影成768维的表示，它是一个可学习的矩阵

输出层把768维映射回去50257维，也就是重新映射成token。GPT-2中，重用了输入与输出的token embedding 矩阵

`self.pos_emb = nn.Embedding(cfg["context_length"], cfg["emb_dim"])` 是位置编码， `context_length` 决定了输入的最大长度

## 文本生成

接下来我们将GPT输出的结果转化为文本。模型最后会输出一个矩阵，其中包含表示潜在下一个token的向量。从中提取与下一个token对应的向量，并通过 softmax 函数将其转换为概率分布。在包含生成概率分数的向量中，找到最大值的索引，这对应于token ID。然后，将该token ID 解码回文本。

![[c4907544-a308-4731-9e80-9445b25ed023.png]]

def generate_text_simple(model, idx, max_new_tokens, context_size):

\# idx is (batch, n_tokens) array of indices in the current context

for _ in range(max_new_tokens):

\# Crop current context if it exceeds the supported context size

\# E.g., if LLM supports only 5 tokens, and the context size is 10

\# then only the last 5 tokens are used as context

idx_cond = idx[:, -context_size:]

\# Get the predictions

with torch.no_grad():

logits = model(idx_cond)

\# Focus only on the last time step

\# (batch, n_tokens, vocab_size) becomes (batch, vocab_size)

logits = logits[:, -1,:]

\# Apply softmax to get probabilities

probas = torch.softmax(logits, dim=-1) # (batch, vocab_size)

\# Get the idx of the vocab entry with the highest probability value

idx_next = torch.argmax(probas, dim=-1, keepdim=True) # (batch, 1)

\# Append sampled index to the running sequence

idx = torch.cat((idx, idx_next), dim=1) # (batch, n_tokens+1)

return idx

这段代码演示了使用 PyTorch 为语言实现生成文本的简单方法。它迭代生成指定数量的新token，将当前上下文裁剪到模型的最大上下文大小，计算预测概率，然后根据最高概率预测选择下一个标记。为了编写 generate_text_simple 函数，我们使用 softmax 函数将 logits 转换为概率分布，从中通过 torch.argmax 找到具有最高值的位置。softmax 函数是单调的，这意味着在转换为输出时它保留了输入的顺序。因此，在实际操作中，softmax 步骤是多余的，因为 softmax 输出张量中得分最高的位置与 logits 张量中的位置相同。换句话说，我们可以直接对 logits 张量应用 torch.argmax 函数，并得到相同的结果。当我们在下一章实现 GPT 训练代码时，我们将使用额外的采样技术修改 softmax 输出，以便模型不总是选择最可能的标记。这会在生成的文本中引入多样性和创造力。

## 在无标签数据上进行预训练

之前我们已经实现了文本数据处理，以及一个GPT模型，接下来实现预训练部分

## 生成式文本模型的评估

我们首先实现 `text_to_token_ids` `token_ids_to_text` 实现tokenid到text的转换，

配合上面的 `generate_text_simple` 就可以简单生成文本了。可以注意到，生成的文本是杂乱无章的，因为还没有训练

import tiktoken

from previous_chapters import generate_text_simple

\# Alternatively:

\# from llms_from_scratch.ch04 import generate_text_simple

def text_to_token_ids(text, tokenizer):

encoded = tokenizer.encode(text, allowed_special={'<|endoftext|>'})

encoded_tensor = torch.tensor(encoded).unsqueeze(0) # add batch dimension

return encoded_tensor

def token_ids_to_text(token_ids, tokenizer):

flat = token_ids.squeeze(0) # remove batch dimension

return tokenizer.decode(flat.tolist())

start_context = "Every effort moves you"

tokenizer = tiktoken.get_encoding("gpt2")

token_ids = generate_text_simple(

model=model,

idx=text_to_token_ids(start_context, tokenizer),

max_new_tokens=10,

context_size=GPT_CONFIG_124M["context_length"]

)

print("Output text:\\n", token_ids_to_text(token_ids, tokenizer))

### 计算loss

下图展示了从输入到输出的全流程

![[14dbc1bf-f199-460c-b589-c60842158845.png]]

输入和输出大概是这样的

inputs = torch.tensor([[16833, 3626, 6100], # ["every effort moves",

[40, 1107, 588]]) # "I really like"]

targets = torch.tensor([[3626, 6100, 345 ], # [" effort moves you",

[1107, 588, 11311]]) # " really like chocolate"]

可以注意到预期输出应该是文本后移了一位

当我们从模型中获取输出时,最终会得到一个概率分布的向量

```java
with torch.no_grad():
logits = model(inputs)
probas = torch.softmax(logits, dim=-1)
print(probas.shape)
torch.Size([2, 3, 50257])
```

分别对应了，batch size,每个输入的token长度，vocabulary size

然后我们使用argmax获取最大概率的下一个tokenid

token_ids = torch.argmax(probas, dim=-1, keepdim=True)

print("Token IDs:\\n", token_ids)

Token IDs:

tensor([[[16657],

[ 339],

[42826]],

[[49906],

[29669],

[41751]]])

最后把tokenid转换为text,我们会发现生成的文本与预期文本有很大的不同

所以我们现在希望通过loss以数字方式评估模型生成文本的性能。这不仅有助于衡量生成文本的质量，也为实现训练函数提供了基础，我们将使用该函数来更新模型的权重以改进生成的文本。最终最大化目标token的softmax概率。

使用的方法是深度学习的标准技术，反向传播更新模型权重，它需要一个loss函数来衡量输出与目标的差异。

首先我们可以把两个target对应的输出的softmax概率值打印出来

注意probas的维度是 `torch.Size([2, 3, 50257])`

text_idx = 0

target_probas_1 = probas[text_idx, [0, 1, 2], targets[text_idx]]

print("Text 1:", target_probas_1)

text_idx = 1

target_probas_2 = probas[text_idx, [0, 1, 2], targets[text_idx]]

print("Text 2:", target_probas_2)

如下：

Text 1: tensor([7.4541e-05, 3.1061e-05, 1.1563e-05])

Text 2: tensor([1.0337e-05, 5.6776e-05, 4.7559e-06])

我们应该让这些概率都尽可能的大，首先拼接target_probas，然后应用log函数。

为什么使用log，因为在数学优化中，处理这些概率分数的对数比直接处理概率分数更容易

然后求平均取负数，最后的目标就是让这个值缩小到0

```java
log_probas = torch.log(torch.cat((target_probas_1, target_probas_2)))
print(log_probas)
tensor([ -9.5042, -10.3796, -11.3677, -11.4798, -9.7764, -12.2561])
avg_log_probas = torch.mean(log_probas)
print(avg_log_probas)
```

neg_avg_log_probas = avg_log_probas * -1

print(neg_avg_log_probas)

![[4d8202fa-3d49-4305-81c0-d70c2ddfb52e.png]]

上面讲的就是交叉熵损失函数。

在实现之前，我们需要看看logits和target 的维度

```java
print("Logits shape:", logits.shape)
print("Targets shape:", targets.shape)
Logits shape: torch.Size([2, 3, 50257])
Targets shape: torch.Size([2, 3])
```

我们把这些tensor在batch维度展平

```java
logits_flat = logits.flatten(0, 1)

targets_flat = targets.flatten()

print("Flattened logits:", logits_flat.shape)
```

print("Flattened targets:", targets_flat.shape

Flattened logits: torch.Size([6, 50257])

Flattened targets: torch.Size([6])

这个时候，targets里面是我们需要的tokenid，而logits是未进行softmax之前的概率分布。

前面的步骤中，我们应用了 softmax 函数，选择了对应token ID 的概率分数，并计算了负的平均对数概率。PyTorch 的 cross_entropy已经实现了这些

loss = torch.nn.functional.cross_entropy(logits_flat, targets_flat)

print(loss)

### 计算训练集和验证集的损失

首先应该准备训练用的测试集和验证集。这里文章的作者使用了一个非常小的文本作为数据集。

import os

import requests

file_path = "the-verdict.txt"

url = "https://raw.githubusercontent.com/rasbt/LLMs-from-scratch/main/ch02/01_main-chapter-code/the-verdict.txt"

```java
if not os.path.exists(file_path):

response = requests.get(url, timeout=30)

response.raise_for_status()
```

text_data = response.text

with open(file_path, "w", encoding="utf-8") as file:

file.write(text_data)

else:

with open(file_path, "r", encoding="utf-8") as file:

text_data = file.read()

from previous_chapters import create_dataloader_v1

\# Alternatively:

\# from llms_from_scratch.ch02 import create_dataloader_v1

\# Train/validation ratio

train_ratio = 0.90

split_idx = int(train_ratio * len(text_data))

train_data = text_data[:split_idx]

val_data = text_data[split_idx:]

torch.manual_seed(123)

train_loader = create_dataloader_v1(

train_data,

batch_size=2,

max_length=GPT_CONFIG_124M["context_length"],

stride=GPT_CONFIG_124M["context_length"],

drop_last=True,

shuffle=True,

num_workers=0

)

val_loader = create_dataloader_v1(

val_data,

batch_size=2,

max_length=GPT_CONFIG_124M["context_length"],

stride=GPT_CONFIG_124M["context_length"],

drop_last=False,

shuffle=False,

num_workers=0

)

![[3a02f3bf-49f9-40fc-9da6-9630c927c83a.png]]

用下面的方法计算batch的平均loss

def calc_loss_batch(input_batch, target_batch, model, device):

```java
input_batch, target_batch = input_batch.to(device), target_batch.to(device)
logits = model(input_batch)
loss = torch.nn.functional.cross_entropy(logits.flatten(0, 1), target_batch.flatten())
return loss
```

def calc_loss_loader(data_loader, model, device, num_batches=None):

total_loss = 0.

if len(data_loader) == 0:

return float("nan")

elif num_batches is None:

num_batches = len(data_loader)

else:

\# Reduce the number of batches to match the total number of batches in the data loader

\# if num_batches exceeds the number of batches in the data loader

```java
num_batches = min(num_batches, len(data_loader))
for i, (input_batch, target_batch) in enumerate(data_loader):
if i < num_batches:
loss = calc_loss_batch(input_batch, target_batch, model, device)
total_loss += loss.item()
```

else:

break

return total_loss / num_batches

## LLM训练

![[05da69d7-7d8b-4a13-bedf-f73d6d8aaef8.png]]

上图中的流程图展示了一个典型的 PyTorch 神经网络训练工作流程。

我们可以写出代码，实际上大部分的工作pytorch都替我们做了。这里用到的optimizer是AdamW，通常不用SGD

def train_model_simple(model, train_loader, val_loader, optimizer, device, num_epochs,

eval_freq, eval_iter, start_context, tokenizer):

\# Initialize lists to track losses and tokens seen

train_losses, val_losses, track_tokens_seen = [], [], []

tokens_seen, global_step = 0, -1

\# Main training loop

```java
for epoch in range(num_epochs):
model.train() # Set model to training mode
for input_batch, target_batch in train_loader:
optimizer.zero_grad() # Reset loss gradients from previous batch iteration
loss = calc_loss_batch(input_batch, target_batch, model, device)
loss.backward() # Calculate loss gradients
optimizer.step() # Update model weights using loss gradients
tokens_seen += input_batch.numel()
```

global_step += 1

\# Optional evaluation step

if global_step % eval_freq == 0:

train_loss, val_loss = evaluate_model(

model, train_loader, val_loader, device, eval_iter)

```java
train_losses.append(train_loss)

val_losses.append(val_loss)

track_tokens_seen.append(tokens_seen)
```

print(f"Ep {epoch+1} (Step {global_step:06d}): "

f"Train loss {train_loss:.3f}, Val loss {val_loss:.3f}")

\# Print a sample text after each epoch

generate_and_print_sample(

model, tokenizer, device, start_context

)

return train_losses, val_losses, track_tokens_seen

开始训练

```java
torch.manual_seed(123)
model = GPTModel(GPT_CONFIG_124M)
model.to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=0.0004, weight_decay=0.1)
```

num_epochs = 10

train_losses, val_losses, tokens_seen = train_model_simple(

model, train_loader, val_loader, optimizer, device,

num_epochs=num_epochs, eval_freq=5, eval_iter=5,

start_context="Every effort moves you", tokenizer=tokenizer

)

打印loss

import matplotlib.pyplot as plt

from matplotlib.ticker import MaxNLocator

def plot_losses(epochs_seen, tokens_seen, train_losses, val_losses):

fig, ax1 = plt.subplots(figsize=(5, 3))

\# Plot training and validation loss against epochs

```java
ax1.plot(epochs_seen, train_losses, label="Training loss")
ax1.plot(epochs_seen, val_losses, linestyle="-.", label="Validation loss")
ax1.set_xlabel("Epochs")
ax1.set_ylabel("Loss")
ax1.legend(loc="upper right")
```

ax1.xaxis.set_major_locator(MaxNLocator(integer=True)) # only show integer labels on x-axis

\# Create a second x-axis for tokens seen

ax2 = ax1.twiny() # Create a second x-axis that shares the same y-axis

```java
ax2.plot(tokens_seen, train_losses, alpha=0) # Invisible plot for aligning ticks
ax2.set_xlabel("Tokens seen")
fig.tight_layout() # Adjust layout to make room
plt.savefig("loss-plot.pdf")
plt.show()
epochs_tensor = torch.linspace(0, num_epochs, len(train_losses))
plot_losses(epochs_tensor, tokens_seen, train_losses, val_losses)
```

![[6271389f-8098-42c2-843e-41cae5412b47.png]]

## 控制文本生成

### Temperature scaling

之前我们使用 torch.argmax 采样具有最高概率的token作为下一个token。为了生成更多样化的文本，我们可以将 argmax 替换为一个从概率分布中采样的函数，按照概率采样token。同时我们可以在softmax时对logits进行缩放，以控制概率的分布。可以看出，越小的temperature会使得最后的概率分布差别更大,类似argmax,越大的temperature使得概率分布跟均匀，结果更多样化

def softmax_with_temperature(logits, temperature):

scaled_logits = logits / temperature

return torch.softmax(scaled_logits, dim=0)

![[fa4007a2-509c-47e7-9d90-0005d21e3a3d.png]]

### Top-k sampling

Temperature scaling虽然能够使得输出更加多样化，但是它有时会导致语法错误或完全荒谬的输出。Top-k 采样，当结合概率采样和温度缩放使用时，可以改善文本生成的结果。在 top-k 采样中，我们可以将采样的标记限制在最可能的前 k 个标记，并通过屏蔽它们的概率分数将所有其他标记排除在选择过程之外。

实现如下：

top_k = 3

top_logits, top_pos = torch.topk(next_token_logits, top_k)

new_logits = torch.where(

condition=next_token_logits < top_logits[-1],

input=torch.tensor(float("-inf")),

other=next_token_logits

)

```java
print(new_logits)
tensor([4.5100, -inf, -inf, 6.7500, -inf, -inf, -inf, 6.2800, -inf])
topk_probas = torch.softmax(new_logits, dim=0)
print(topk_probas)
```

最后文本生成的函数如下：

def generate(model, idx, max_new_tokens, context_size, temperature=0.0, top_k=None, eos_id=None):

\# For-loop is the same as before: Get logits, and only focus on last time step

for _ in range(max_new_tokens):

idx_cond = idx[:, -context_size:]

with torch.no_grad():

logits = model(idx_cond)

logits = logits[:, -1,:]

\# New: Filter logits with top_k sampling

if top_k is not None:

\# Keep only top_k values

top_logits, _ = torch.topk(logits, top_k)

min_val = top_logits[:, -1]

logits = torch.where(logits < min_val, torch.tensor(float("-inf")).to(logits.device), logits)

\# New: Apply temperature scaling

if temperature > 0.0:

logits = logits / temperature

\# New (not in book): numerical stability tip to get equivalent results on mps device

\# subtract rowwise max before softmax

logits = logits - logits.max(dim=-1, keepdim=True).values

\# Apply softmax to get probabilities

probs = torch.softmax(logits, dim=-1) # (batch_size, context_len)

\# Sample from the distribution

idx_next = torch.multinomial(probs, num_samples=1) # (batch_size, 1)

\# Otherwise same as before: get idx of the vocab entry with the highest logits value

else:

idx_next = torch.argmax(logits, dim=-1, keepdim=True) # (batch_size, 1)

if idx_next == eos_id: # Stop generating early if end-of-sequence token is encountered and eos_id is specified

break

## 在 PyTorch 中加载和保存模型权重

预训练 LLM 计算成本很高。因此，能够保存 LLM 非常重要，这样我们就不必每次在新的会话中使用它时都重新运行训练。

这部分工作torch替我们做了

save

torch.save(model.state_dict(), "model.pth")

load

```java
model = GPTModel(GPT_CONFIG_124M)

if torch.cuda.is_available():

device = torch.device("cuda")
```

elif torch.backends.mps.is_available():

\# Use PyTorch 2.9 or newer for stable mps results

```java
major, minor = map(int, torch.__version__.split(".")[:2])

if (major, minor) >= (2, 9):

device = torch.device("mps")
```

else:

```java
device = torch.device("cpu")
print("Device:", device)
model.load_state_dict(torch.load("model.pth", map_location=device, weights_only=True))
model.eval();
```

同理optimizer的参数也应该保存下来

torch.save({

"model_state_dict": model.state_dict(),

"optimizer_state_dict": optimizer.state_dict(),

},

"model_and_optimizer.pth"

)

```java
checkpoint = torch.load("model_and_optimizer.pth", weights_only=True)
model = GPTModel(GPT_CONFIG_124M)
model.load_state_dict(checkpoint["model_state_dict"])
optimizer = torch.optim.AdamW(model.parameters(), lr=0.0005, weight_decay=0.1)
optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
model.train();
```

## 加载openai的预训练权重

上面的内容里，我们训练了自己的GPT2，使用一个很小的数据集。openAI开源了GPT-2的权重，所以我们不用耗费更多资源去训练，而是直接加载权重。后面我们会对这个模型进行fine-tune。

OpenAI 最初是通过 TensorFlow 保存 GPT-2 权重的，因此我们必须安装 TensorFlow 才能在 Python 中加载这些权重。

import urllib.request

url = (

"https://raw.githubusercontent.com/rasbt/"

"LLMs-from-scratch/main/ch05/"

"01_main-chapter-code/gpt_download.py"

)

filename = url.split('/')[-1]

urllib.request.urlretrieve(url, filename)

from gpt_download import download_and_load_gpt2

settings, params = download_and_load_gpt2(

model_size="124M", models_dir="gpt2"

)

我们需要把配置改成对应的GPT-2模型的配置，例如emb_dim，qkv_bias等

```java
model_configs = {
    "gpt2-small (124M)": {"emb_dim": 768, "n_layers": 12, "n_heads": 12},
    "gpt2-medium (355M)": {"emb_dim": 1024, "n_layers": 24, "n_heads": 16},
    "gpt2-large (774M)": {"emb_dim": 1280, "n_layers": 36, "n_heads": 20},
    "gpt2-xl (1558M)": {"emb_dim": 1600, "n_layers": 48, "n_heads": 25},
}
```

\# Copy the base configuration and update with specific model settings

model_name = "gpt2-small (124M)" # Example model name

```java
NEW_CONFIG = GPT_CONFIG_124M.copy()
NEW_CONFIG.update(model_configs[model_name])
NEW_CONFIG.update({"context_length": 1024, "qkv_bias": True})
gpt = GPTModel(NEW_CONFIG)
gpt.eval();
```

然后把对应的权重赋值过去

import numpy as np

def assign(left, right):

```java
if left.shape!= right.shape:

raise ValueError(f"Shape mismatch. Left: {left.shape}, Right: {right.shape}")

return torch.nn.Parameter(torch.tensor(right))
```

def load_weights_into_gpt(gpt, params):

```java
gpt.pos_emb.weight = assign(gpt.pos_emb.weight, params['wpe'])

gpt.tok_emb.weight = assign(gpt.tok_emb.weight, params['wte'])

for b in range(len(params["blocks"])):
```

q_w, k_w, v_w = np.split(

(params["blocks"][b]["attn"]["c_attn"])["w"], 3, axis=-1)

gpt.trf_blocks[b].att.W_query.weight = assign(

gpt.trf_blocks[b].att.W_query.weight, q_w.T)

gpt.trf_blocks[b].att.W_key.weight = assign(

gpt.trf_blocks[b].att.W_key.weight, k_w.T)

gpt.trf_blocks[b].att.W_value.weight = assign(

gpt.trf_blocks[b].att.W_value.weight, v_w.T)

q_b, k_b, v_b = np.split(

(params["blocks"][b]["attn"]["c_attn"])["b"], 3, axis=-1)

gpt.trf_blocks[b].att.W_query.bias = assign(

gpt.trf_blocks[b].att.W_query.bias, q_b)

gpt.trf_blocks[b].att.W_key.bias = assign(

gpt.trf_blocks[b].att.W_key.bias, k_b)

gpt.trf_blocks[b].att.W_value.bias = assign(

gpt.trf_blocks[b].att.W_value.bias, v_b)

gpt.trf_blocks[b].att.out_proj.weight = assign(

gpt.trf_blocks[b].att.out_proj.weight,

params["blocks"][b]["attn"]["c_proj"]["w"].T)

gpt.trf_blocks[b].att.out_proj.bias = assign(

gpt.trf_blocks[b].att.out_proj.bias,

params["blocks"][b]["attn"]["c_proj"]["b"])

## Fine-tuning for classification

微调常见的有两种，instruction fine-tuning和classification fine-tuning

指令微调指的是在一组任务上训练语言模型，以提高其理解和执行自然语言提示中描述的任务的能力。

分类微调指的是模型被训练为能分类特定label。

指令微调模型通常可以执行更广泛的任务。分类微调模型视为高度专业化的模型，通常来说，开发一个专门模型比开发一个在各种任务中表现良好的通用模型更容易。

这一章讲如何微调模型以适配分类任务。

## 数据集准备

我们将使用一个由垃圾短信和非垃圾短信组成的文本消息数据集。数据集需要有对应的标签。

```java
import requests

import zipfile

import os
```

from pathlib import Path

url = "https://archive.ics.uci.edu/static/public/228/sms+spam+collection.zip"

zip_path = "sms_spam_collection.zip"

extracted_path = "sms_spam_collection"

data_file_path = Path(extracted_path) / "SMSSpamCollection.tsv"

def download_and_unzip_spam_data(url, zip_path, extracted_path, data_file_path):

if data_file_path.exists():

print(f"{data_file_path} already exists. Skipping download and extraction.")

return

\# Downloading the file

response = requests.get(url, stream=True, timeout=60)

response.raise_for_status()

with open(zip_path, "wb") as out_file:

```java
for chunk in response.iter_content(chunk_size=8192):

if chunk:

out_file.write(chunk)
```

\# Unzipping the file

with zipfile.ZipFile(zip_path, "r") as zip_ref:

zip_ref.extractall(extracted_path)

\# Add.tsv file extension

original_file_path = Path(extracted_path) / "SMSSpamCollection"

os.rename(original_file_path, data_file_path)

print(f"File downloaded and saved as {data_file_path}")

try:

download_and_unzip_spam_data(url, zip_path, extracted_path, data_file_path)

![[1923917a-7e29-4ea6-b294-1478d9333d2c.png]]

用下面的代码创建一个label平衡的数据集

def create_balanced_dataset(df):

\# Count the instances of "spam"

num_spam = df[df["Label"] == "spam"].shape[0]

\# Randomly sample "ham" instances to match the number of "spam" instances

ham_subset = df[df["Label"] == "ham"].sample(num_spam, random_state=123)

\# Combine ham "subset" with "spam"

```java
balanced_df = pd.concat([ham_subset, df[df["Label"] == "spam"]])
return balanced_df
balanced_df = create_balanced_dataset(df)
print(balanced_df["Label"].value_counts())
```

然后分解为训练集和验证集

def random_split(df, train_frac, validation_frac):

\# Shuffle the entire DataFrame

df = df.sample(frac=1, random_state=123).reset_index(drop=True)

\# Calculate split indices

train_end = int(len(df) * train_frac)

validation_end = train_end + int(len(df) * validation_frac)

\# Split the DataFrame

train_df = df[:train_end]

validation_df = df[train_end:validation_end]

test_df = df[validation_end:]

return train_df, validation_df, test_df

train_df, validation_df, test_df = random_split(balanced_df, 0.7, 0.1)

\# Test size is implied to be 0.2 as the remainder

```java
train_df.to_csv("train.csv", index=None)

validation_df.to_csv("validation.csv", index=None)

test_df.to_csv("test.csv", index=None)
```

然后按照下面的方法创建dataloader。SpamDataset 类从我们之前创建的 CSV 文件中加载数据，使用 tiktoken 中的 GPT-2 分词器对文本进行分词，并padding到统一长度。

import torch

from torch.utils.data import Dataset

class SpamDataset(Dataset):

def __init__(self, csv_file, tokenizer, max_length=None, pad_token_id=50256):

self.data = pd.read_csv(csv_file)

\# Pre-tokenize texts

self.encoded_texts = [

tokenizer.encode(text) for text in self.data["Text"]

]

if max_length is None:

self.max_length = self._longest_encoded_length()

else:

self.max_length = max_length

\# Truncate sequences if they are longer than max_length

self.encoded_texts = [

encoded_text[:self.max_length]

for encoded_text in self.encoded_texts

]

\# Pad sequences to the longest sequence

self.encoded_texts = [

encoded_text + [pad_token_id] * (self.max_length - len(encoded_text))

for encoded_text in self.encoded_texts

]

def __getitem__(self, index):

encoded = self.encoded_texts[index]

label = self.data.iloc[index]["Label"]

```java
return (

torch.tensor(encoded, dtype=torch.long),

torch.tensor(label, dtype=torch.long)
```

)

获得训练集和测试集

val_dataset = SpamDataset(

csv_file="validation.csv",

max_length=train_dataset.max_length,

tokenizer=tokenizer

)

test_dataset = SpamDataset(

csv_file="test.csv",

max_length=train_dataset.max_length,

tokenizer=tokenizer

)

这些数据集跟之前的无标签数据集的区别是target不是下一个token而是label

然后我们用之前的方法加载模型，并且初始化

## 修改输出层

我们需要修改预训练的大语言模型（LLM），以准备进行分类微调。为此，我们将原始输出层替换掉，该层将隐藏表示映射到50,257个词汇中，改为一个更小的输出层，将其映射到两个类别：0（“非垃圾邮件”）和1（“垃圾邮件”）。我们使用与之前相同的模型，只是替换了输出层

![[dac2b5b5-5755-4c50-955a-118a0dea1698.png]]

fine tune部分层与所有的层的区别：由于我们从预训练模型开始，所以没有必要微调所有模型层。在基于神经网络的语言模型中，底层通常捕捉适用于广泛任务和数据集的基本语言结构和语义。因此，仅微调最后几层（即接近输出的层），这些层更针对细微的语言模式和任务特定特征，通常就足以将模型适应到新任务。

#freeze model

for param in model.parameters():

param.requires_grad = False

torch.manual_seed(123)

#替换最后一层

num_classes = 2

model.out_head = torch.nn.Linear(in_features=BASE_CONFIG["emb_dim"], out_features=num_classes)

技术上来说，仅训练我们刚刚添加的输出层就足够了。然而实际中，微调额外的层可以明显提高模型的预测性能。

因此我们还将最后的 Transformer 模块和连接该模块与输出层的最终 LayerNorm 模块配置为可训练。为了使最终的 LayerNorm 和最后的 Transformer 模块可训练，我们将它们各自的 requires_grad 设置为 True

for param in model.trf_blocks[-1].parameters():

param.requires_grad = True

for param in model.final_norm.parameters():

param.requires_grad = True

由于因果注意力掩码的设置，序列中的最后一个token积累了最多的信息，因为它是唯一可以访问所有前面标记数据的标记。因此，在我们的垃圾邮件分类任务中，我们在微调过程中关注这个最后的标记。现在我们准备将最后一个标记转换为类别标签预测，并计算模型的初始预测准确率。随后，我们将针对垃圾邮件分类任务微调模型。

## 计算loss和准确率

![[fe11c09d-bdaa-4bbf-9d42-4d8e5f649ca1.png]]

这一步跟之前其实差不多

def calc_accuracy_loader(data_loader, model, device, num_batches=None):

model.eval()

correct_predictions, num_examples = 0, 0

if num_batches is None:

num_batches = len(data_loader)

else:

```java
num_batches = min(num_batches, len(data_loader))
for i, (input_batch, target_batch) in enumerate(data_loader):
if i < num_batches:
input_batch, target_batch = input_batch.to(device), target_batch.to(device)
with torch.no_grad():
```

logits = model(input_batch)[:, -1,:] # Logits of last output token

predicted_labels = torch.argmax(logits, dim=-1)

num_examples += predicted_labels.shape[0]

correct_predictions += (predicted_labels == target_batch).sum().item()

else:

break

```java
return correct_predictions / num_examples

if torch.cuda.is_available():

device = torch.device("cuda")
```

elif torch.backends.mps.is_available():

\# Use PyTorch 2.9 or newer for stable mps results

```java
major, minor = map(int, torch.__version__.split(".")[:2])

if (major, minor) >= (2, 9):

device = torch.device("mps")
```

else:

device = torch.device("cpu")

else:

device = torch.device("cpu")

loss使用交叉熵

def calc_loss_batch(input_batch, target_batch, model, device):

input_batch, target_batch = input_batch.to(device), target_batch.to(device)

logits = model(input_batch)[:, -1,:] # Logits of last output token

loss = torch.nn.functional.cross_entropy(logits, target_batch)

return loss

def calc_loss_loader(data_loader, model, device, num_batches=None):

total_loss = 0.

if len(data_loader) == 0:

return float("nan")

elif num_batches is None:

num_batches = len(data_loader)

else:

\# Reduce the number of batches to match the total number of batches in the data loader

\# if num_batches exceeds the number of batches in the data loader

```java
num_batches = min(num_batches, len(data_loader))
for i, (input_batch, target_batch) in enumerate(data_loader):
if i < num_batches:
loss = calc_loss_batch(input_batch, target_batch, model, device)
total_loss += loss.item()
```

else:

break

```java
return total_loss / num_batches
with torch.no_grad(): # Disable gradient tracking for efficiency because we are not training, yet
train_loss = calc_loss_loader(train_loader, model, device, num_batches=5)
val_loss = calc_loss_loader(val_loader, model, device, num_batches=5)
test_loss = calc_loss_loader(test_loader, model, device, num_batches=5)
print(f"Training loss: {train_loss:.3f}")
print(f"Validation loss: {val_loss:.3f}")
print(f"Test loss: {test_loss:.3f}")
```

## 进行fine-tune

模型训练部分基本与之前相同

def evaluate_model(model, train_loader, val_loader, device, eval_iter):

```java
model.eval()
with torch.no_grad():
train_loss = calc_loss_loader(train_loader, model, device, num_batches=eval_iter)
val_loss = calc_loss_loader(val_loader, model, device, num_batches=eval_iter)
model.train()
return train_loss, val_loss
```

def train_classifier_simple(model, train_loader, val_loader, optimizer, device, num_epochs,

eval_freq, eval_iter):

\# Initialize lists to track losses and examples seen

train_losses, val_losses, train_accs, val_accs = [], [], [], []

examples_seen, global_step = 0, -1

\# Main training loop

```java
for epoch in range(num_epochs):
model.train() # Set model to training mode
for input_batch, target_batch in train_loader:
optimizer.zero_grad() # Reset loss gradients from previous batch iteration
loss = calc_loss_batch(input_batch, target_batch, model, device)
loss.backward() # Calculate loss gradients
optimizer.step() # Update model weights using loss gradients
```

examples_seen += input_batch.shape[0] # New: track examples instead of tokens

global_step += 1

\# Optional evaluation step

if global_step % eval_freq == 0:

train_loss, val_loss = evaluate_model(

model, train_loader, val_loader, device, eval_iter)

train_losses.append(train_loss)

val_losses.append(val_loss)

print(f"Ep {epoch+1} (Step {global_step:06d}): "

f"Train loss {train_loss:.3f}, Val loss {val_loss:.3f}")

训练

```java
import time
start_time = time.time()
torch.manual_seed(123)
optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5, weight_decay=0.1)
```

num_epochs = 5

train_losses, val_losses, train_accs, val_accs, examples_seen = train_classifier_simple(

model, train_loader, val_loader, optimizer, device,

num_epochs=num_epochs, eval_freq=50, eval_iter=5,

)

end_time = time.time()

execution_time_minutes = (end_time - start_time) / 60

print(f"Training completed in {execution_time_minutes:.2f} minutes.")

最后fine-tune之后，可以通过下面的函数进行调用

def classify_review(text, model, tokenizer, device, max_length=None, pad_token_id=50256):

model.eval()

\# Prepare inputs to the model

input_ids = tokenizer.encode(text)

supported_context_length = model.pos_emb.weight.shape[0]

\# Note: In the book, this was originally written as pos_emb.weight.shape[1] by mistake

\# It didn't break the code but would have caused unnecessary truncation (to 768 instead of 1024)

\# Truncate sequences if they too long

input_ids = input_ids[:min(max_length, supported_context_length)]

assert max_length is not None, (

"max_length must be specified. If you want to use the full model context, "

"pass max_length=model.pos_emb.weight.shape[0]."

)

assert max_length <= supported_context_length, (

f"max_length ({max_length}) exceeds model's supported context length ({supported_context_length})."

)

\# Alternatively, a more robust version is the following one, which handles the max_length=None case better

\# max_len = min(max_length,supported_context_length) if max_length else supported_context_length

\# input_ids = input_ids[:max_len]

\# Pad sequences to the longest sequence

input_ids += [pad_token_id] * (max_length - len(input_ids))

input_tensor = torch.tensor(input_ids, device=device).unsqueeze(0) # add batch dimension

\# Model inference

with torch.no_grad():

logits = model(input_tensor)[:, -1,:] # Logits of the last output token

predicted_label = torch.argmax(logits, dim=-1).item()

\# Return the classified result

return "spam" if predicted_label == 1 else "not spam"

## Fine-tuning to follow instructions

预训练的LLM在处理特定指令时往往表现不佳，因此需要进行指令微调来优化LLM在具体任务上的表现。

具体流程如下：

## 数据准备

```java
import json

import os

import urllib
```

def download_and_load_file(file_path, url):

if not os.path.exists(file_path):

with urllib.request.urlopen(url) as response:

text_data = response.read().decode("utf-8")

with open(file_path, "w", encoding="utf-8") as file:

file.write(text_data)

else:

with open(file_path, "r", encoding="utf-8") as file:

text_data = file.read()

with open(file_path, "r") as file:

data = json.load(file)

return data

file_path = "instruction-data.json"

url = (

"https://raw.githubusercontent.com/rasbt/LLMs-from-scratch"

"/main/ch07/01_main-chapter-code/instruction-data.json"

)

data = download_and_load_file(file_path, url)

print("Number of entries:", len(data))

文件的内容如下格式，包含instruction,input,output

{'instruction': 'Identify the correct spelling of the following word.',

'input': 'Ocassion', 'output': "The correct spelling is 'Occasion.'"}

有很多方法（也就是不同的prompt style）把上面的数据格式化以应用于LLM，如下，

![[ad3452bd-5cd8-43f2-8abc-ff12d67ff6c2.png]]

对应的format代码如下：

def format_input(entry):

instruction_text = (

f"Below is an instruction that describes a task. "

f"Write a response that appropriately completes the request."

f"\\n\\n### Instruction:\\n{entry['instruction']}"

)

input_text = (

f"\\n\\n### Input:\\n{entry['input']}" if entry["input"] else ""

)

return instruction_text + input_text

同样需要区分测试集和训练集

train_portion = int(len(data) * 0.85) # 85% for training

test_portion = int(len(data) * 0.1) # 10% for testing

val_portion = len(data) - train_portion - test_portion # Remaining 5% for validation

train_data = data[:train_portion]

test_data = data[train_portion:train_portion + test_portion]

val_data = data[train_portion + test_portion:]

然后我们把数据转换为训练用的batch，按照如下的流程

![[b4696744-4341-4746-8c96-2c031b3f1ed0.png]]

这里有个注意的点，padding的时候不是把所有的值都用end of text代替，而是用-100，为了将他们排除出training loss

因为pytorch中，交叉熵默认会忽略-100, `cross_entropy(...,ignore_index=-100)`,所以我们通过替换为-100来mask不需要的token

![[703d21aa-189d-4174-adb5-048047bfe01c.png]]

def custom_collate_fn(

batch,

pad_token_id=50256,

ignore_index=-100,

allowed_max_length=None,

device="cpu"

):

\# Find the longest sequence in the batch

batch_max_length = max(len(item)+1 for item in batch)

\# Pad and prepare inputs and targets

inputs_lst, targets_lst = [], []

for item in batch:

new_item = item.copy()

\# Add an <|endoftext|> token

new_item += [pad_token_id]

\# Pad sequences to max_length

padded = (

new_item + [pad_token_id] *

(batch_max_length - len(new_item))

)

inputs = torch.tensor(padded[:-1]) # Truncate the last token for inputs

targets = torch.tensor(padded[1:]) # Shift +1 to the right for targets

\# New: Replace all but the first padding tokens in targets by ignore_index

mask = targets == pad_token_id

indices = torch.nonzero(mask).squeeze()

if indices.numel() > 1:

targets[indices[1:]] = ignore_index

\# New: Optionally truncate to maximum sequence length

if allowed_max_length is not None:

inputs = inputs[:allowed_max_length]

targets = targets[:allowed_max_length]

除了padding,有时还会mask掉除了response之外的部分。屏蔽指令能否对模型性能有改进目前还没有定论

![[fbe713d8-f00e-43fc-8570-30ec6d3603e3.png]]

## 训练

剩下的部分跟之前基本差不多，创建数据集，加载模型，然后进行训练

![[f78947e6-828a-430d-b206-fefe90087ab6.png]]

## 验证finetune之后的大模型

这部分讲使用另一个更大的大模型来自动评估微调后的大模型的响应。文中使用了llama3来实现

通过使用api来调用大模型对finetune之后的模型评估

import psutil

def check_if_running(process_name):

running = False

for proc in psutil.process_iter(["name"]):

if process_name in proc.info["name"]:

running = True

break

```java
return running
ollama_running = check_if_running("ollama")
if not ollama_running:
raise RuntimeError("Ollama not running. Launch ollama before proceeding.")
print("Ollama running:", check_if_running("ollama"))
import json
```

from tqdm import tqdm

file_path = "instruction-data-with-response.json"

with open(file_path, "r") as file:

test_data = json.load(file)

def format_input(entry):

instruction_text = (

f"Below is an instruction that describes a task. "

f"Write a response that appropriately completes the request."

f"\\n\\n### Instruction:\\n{entry['instruction']}"

)

input_text = f"\\n\\n### Input:\\n{entry['input']}" if entry["input"] else ""

return instruction_text + input_text

import requests # noqa: F811

\# import urllib.request

def query_model(

prompt,

model="llama3",

\# If you used OLLAMA_HOST=127.0.0.1:11435 ollama serve

\# update the address from 11434 to 11435

url="http://localhost:11434/api/chat"

):

\# Create the data payload as a dictionary

data = {

"model": model,

"messages": [

{"role": "user", "content": prompt}

],

"seed": 123,

"temperature": 0,

"num_ctx": 2048

}

}

"""

\# Convert the dictionary to a JSON formatted string and encode it to bytes

payload = json.dumps(data).encode("utf-8")

\# Create a request object, setting the method to POST and adding necessary headers

request = urllib.request.Request(

url,

data=payload,

method="POST"

)

request.add_header("Content-Type", "application/json")

for entry in test_data[:3]:

prompt = (

f"Given the input \`{format_input(entry)}\` "

f"and correct output \`{entry['output']}\`, "

f"score the model response \`{entry['model_response']}\`"

f" on a scale from 0 to 100, where 100 is the best score. "

)

```java
print("\\nDataset response:")
print(">>", entry['output'])
print("\\nModel response:")
print(">>", entry["model_response"])
print("\\nScore:")
print(">>", query_model(prompt))
print("\\n-------------------------")
```

---
title: "BERT原理简述及PAI上实战"
source: "https://ata.atatech.org/articles/11000162485?spm=ata.25287382.0.0.78ed7536XpeFmy"
author:
published:
created: 2026-04-20
description:
tags:
  - "clippings"
---
云智能集团

勋章

粉丝 1.3k影响力 14k

** 16

** 48

**

** 原创文章

内部资料

发表到圈儿

[全球技术服务部](https://ata.atatech.org/community/team/66) / [阿里云售后技术](https://ata.atatech.org/community/team/66?cid=292) (首发)

**

[姜剑(飞樰)](https://ata.atatech.org/users/11000429133)

发表更新2.1k浏览

** 字号

** 笔记

** 分享 **

## 一、前言

NLP领域近几年基于深度学习的技术发展迅速，其中我选取了一些关键技术在 [《NLP核心技术演进简述》](https://www.atatech.org/articles/172038) 中有介绍，本文主要会简单的展开介绍下BERT的原理和在PAI上的实战，行文仓促，如有问题，还请斧正~

## 二、BERT介绍

**BERT（** **Bidirectional Encoder Representation from Transformers** **）** <sup>[1]</sup> 是Google在2018年提出的一种预训练模型，一经提出可谓是吸睛无数，下图中左边是各个媒体对BERT的描述，右边是BERT刚出的时候在SQuAD排行榜上的排名。

![[9d4e2036-fa05-4932-98aa-1e450acbd610.png|image.png]]

其实，BERT本质上就是上面讲的“ **Embedding** **+** **Language** **Model** **\+ Transformer** ”，BERT是一种基于Transformer结构的语言模型，用来训练Embedding给下游任务使用的。下图是BERT模型的预训练方法，分半监督与监督学习两种，通过开源的数据库和维基百科，Google训练了大量的语料，完成了BERT模型的训练。

Google训练的BERT模型一般每种语言分为两种，Base和Large，其中Large的参数量可达3亿多，所以BERT的模型文件一般都比较大。

那么，拿到一个预训练好的BERT模型该如何使用呢？下图中可以看到，直接将文本输入进去，可以拿到其对应的词向量Embedding：

然后将这个Embedding放入 **下游的分类器** 中，如下图所示，就可以完成一个分类任务（下图是一个垃圾文本分类任务）：

## 三、BERT的原理与实战

## 3.1 BERT网络结构

BERT模型的结构是怎样的呢？下图是与GPT、ELMo的对比图，可以看到，BERT是 **双向Transformer结构，而** GPT是单向Transformer结构，ELMo是双向LSTM结构，因此BERT是可以根据 **上下文信息获取语义** 的，并且可以并行化运算，比ELMo运算效率更高。

BERT在Embedding的时候也有一定的创新，使用了三层Embedding，如下图所示，其分别将分词(字)、分句、位置(语序)信息分为了三层Embedding，这样就可以在训练的时候考虑上 **词(字)、句字、词序** 这三个方面，并且还讲时态进行了拆分，如将playing拆分为play和#ing以学习其时态特征。

## 3.2 Pretrain

### 3.2.1 Pretrain介绍

Google在做预训练的时候采用了 **Mask** **Language** **Model (MLM)** 的方式训练BERT，MLM就是类似“完形填空”一样，将其中某些词替换为\[MASK\]标签，然后接入一个前馈神经网络去训练，最终得到BERT内部的表达式参数，这一步完成能够学到 **词之间的上下文信息** 。

除此之外，BERT还做了 **Next Sentence Prediction (NSP)** ，BERT将文章的上下文相邻句子拼成正样本，不同文章抽取不相邻的句子作为负样本，接入一个前馈神经网络来训练输入的某一句话是否是给定句子的下一句，从而得到BERT的参数，如下图所示：

### 3.2.2 Continue Pretrian 实战

PAI平台提供了比较好的迁移学习的能力，利用PAI的 **PAI-EasyTransfer** （原ATP）可以很方便的对BERT进行预训练，以下是本人 **亲测可行** 的操作过程哦~ 关于PAI-EasyTransfer的介绍可以参考 [《中文CLUE榜单登顶之路--基于EasyTransfer的预训练语言模型范式实践》](https://www.atatech.org/articles/162231) 。

从头pretrain一个bert模型所耗费的资源较大，所以此处是在已经开源的pretrain模型的基础上在自己的语料上continue pretrain模型，此处讲述下可以按照这篇文章（ [https://yuque.antfin-inc.com/pai/transfer-learning/rkw4vf#XZseF](https://yuque.antfin-inc.com/pai/transfer-learning/rkw4vf#XZseF) ）来做数据格式的预处理和模型的配置，将数据处理为如下的输入数据格式，pretrain是无监督的过程，内部的训练label都是取自与文本自身，因此无需label，但会有masked lm相关的一些字段：

```python
create table bert_pretrain_input_data(
   input_ids STRING,
   input_mask STRING,
   segment_ids STRING,
   masked_lm_positions STRING,
   masked_lm_ids STRING,
   masked_lm_weights STRING
   );
```

然后调用PAI命令执行，其中方括号中的内容是需要根据你具体项目中的项目名称、地址来修改的：

```python
pai -name easytransfer
-project algo_platform_dev
-DenableJITDeviceTuning=false
-Dtables='odps://[project_name]/tables/bert_pretrain_input_raw'
-Doutputs='odps://[project_name]/tables/bert_pretrain_input_data'
-Dscript='preprocess.tar.gz'
-DentryFile='preprocess/main_preprocess.py'
-Dbuckets="oss://[path]/?role_arn=[role_arn]&host=[endpoint]"
-DuserDefinedParameters='--config=oss://[path]/preprocess_config.json'
-DgpuRequired=100
-DcpuRequired=200
;
```

之后将数据处理完成之后，再调用如下的pai命令来做预训练：

```python
pai -name easytransfer
-project algo_platform_dev
-DenableJITDeviceTuning=false
-Dtables='odps://[project_name]/tables/bert_pretrain_train_data,odps://[project_name]/tables/bert_pretrain_dev_data'
-Dscript='pretrain_roberta.tar.gz'
-DentryFile='pretrain/main_continue_pretrain.py'
-Dbuckets="oss://[path]/?role_arn=[role_arn]&host=[host]"
-DuserDefinedParameters='--config=oss://[path]/continue_pretrain_config.json --vocab_size=[vocab_size]'
-DgpuRequired=100
-DcpuRequired=200;
```

## 3.3 Fine-tuning

我们在拿到Google的BERT模型之后，既可以像上文一样继续训练BERT参数，也可在下游任务的基础上Fine-tuning BERT模型，不同任务的Fine-tuning过程如右图所示，具体不展开讲述了，有兴趣同学可参考原论文：

BERT的Fine-tuning比较适合用在有监督的下游任务中，因此需要有label，在此之前也是需要将数据做预处理，可以处理为如下的输入数据格式，并且相比pretrain来讲，减少了mask lm相关的字段：

```python
create table bert_finetune_input_data(
   input_ids STRING,
   input_mask STRING,
   segment_ids STRING,
   label STRING
   );
```

然后调用PAI命令执行预训练，此处和pretrain过程一致，知识在config文件中配置"decode\_output\_format": "bert\_finetune"，详细内容请参考EasyTransfer的文档，此处不再赘述。将数据处理完成之后，再调用如下的pai命令来做fine-tuning：

```python
pai -name easytransfer
-project algo_platform_dev
-DenableJITDeviceTuning=false
-Dtables='odps://[project_name]/tables/bert_finetune_train_data,odps://[project_name]/tables/bert_finetune_dev_data'
-Dscript='pretrain_roberta.tar.gz'
-DentryFile='pretrain/main_finetune.py'
-Dbuckets="oss://[path]/?role_arn=[role_arn]&host=[host]"
-DuserDefinedParameters='--config=oss://[path]/finetune_config.json'
-DgpuRequired=100
-DcpuRequired=200;
```

## 3.4 句向量生成

在预训练完成BERT之后，可以继续使用fine-tuning的方式来做具体下游任务的调优，可以用来做分类、机器阅读等多种方式的有监督学习。但是我们也可以使用BERT模型来生成句子向量，通过BERT对文本较好的表征能力可以得到比较好的Embedding，可以用来做文本的相似性计算、输入下游模型作为特征等多种作用。句子向量的生成有多种方式，比较常见的一种是用输入文本的\[CLS\]位所对应的pooled\_output（一般是768维）输出，另一种是用encoder\_layers（一般是768\*128维）中的某一层做一次pooling降维到768维来作为句向量的表达，这块是参考了github中的开源项目Bert-as-service <sup>[2]</sup> 中的句向量实现，将其改造到了在pai上做预测。

在PAI提供的predict（在main\_finetune.py中）的python文件中做如下修改即可，两种方式的核心代码实现如下：

1. **方式一：**
	```python
	def build_vector(self, features, mode=None):
	    if self.config.mode == "train":
	        input_ids, input_mask, segment_ids, label_ids = self.build_inputs(features)
	    elif self.config.mode == "predict":
	        instance_id, input_ids, input_mask, segment_ids= self.build_inputs(features)
	    is_training = mode == tf.estimator.ModeKeys.TRAIN
	    model = bert(input_ids, input_mask, segment_ids, is_training, name=self.config.model_name,
	                       pretrained_model=self.config.pretrain_model_path, finetune_from=True, continue_pretrain_from=False)
	    pooled_output = model.get_pooled_output()    
	    if mode == tf.estimator.ModeKeys.PREDICT:
	        ret = {
	            "instance_id": instance_id,
	            "vector": pooled_output
	        }
	        return ret
	    return label_ids
	```

其中，输出的vector即是根据\[CLS\]位所对应的pooled\_output的输出。

1. **方式二：**
	```python
	def build_vector(self, features, mode=None):
	    if self.config.mode == "train":
	        input_ids, input_mask, segment_ids, label_ids = self.build_inputs(features)
	    elif self.config.mode == "predict":
	        instance_id, input_ids, input_mask, segment_ids= self.build_inputs(features)
	    is_training = mode == tf.estimator.ModeKeys.TRAIN
	    model = bert(input_ids, input_mask, segment_ids, is_training, name=self.config.model_name,
	                       pretrained_model=self.config.pretrain_model_path, finetune_from=True, continue_pretrain_from=False)
	    encoder_layer = model.get_all_encoder_layers()[-2]
	    
	    mul_mask = lambda x, m: x * tf.expand_dims(m, axis=-1)
	    masked_reduce_mean = lambda x, m: tf.reduce_sum(mul_mask(x, m), axis=1) / (
	                tf.reduce_sum(m, axis=1, keepdims=True) + 1e-10)
	    input_mask = tf.cast(input_mask, tf.float32)
	    layer_output = masked_reduce_mean(encoder_layer, input_mask)
	    if mode == tf.estimator.ModeKeys.PREDICT:
	        ret = {
	            "instance_id": instance_id,
	            "vector": layer_output
	        }
	        return ret
	    return label_ids
	```

其中的get\_all\_encoder\_layers后面可以取其它层，在经过试验的测试，通常取-2层的Embedding效果较好，最后vector中得到的就是最终的句向量。

在完成上述BERT预训练和句向量生成的过程中，感谢PAI平台的同润、岑鸣等同学的帮助。

## 四、ALBERT

在BERT碾压了很多排行榜之后，很多人对BERT进行了各种改进，出现了如XLNet、RoBERTa、ELECTRA、ERNIE等多种模型，但是其中比较有影响力的是Google后来自己提出的ALBERT。 **ALBERT(****A Lite BERT for Self-supervised Learning of Language Representations****)** <sup>[3]</sup> 是一种通过一些技术方式对BERT中的参数进行了压缩，效果甚至超越了BERT。ALBERT主要是做了如下三件事情：

**1\. Factorized embedding** **parameterization**

在BERT里，Embedding的维数一般与隐层H相同，但是ALBERT打破了Embedding大小E与隐层大小H之间的绑定关系，从而减小模型的参数量，同时提升模型表现。主要做法是将Embedding Matrix分解为 **V \* E** 与 **E \* H** 两个矩阵，使得复杂度从 **O(V\*H) -> O(V\*E+E\*H)。**

**2.** **Cross-layer parameter sharing**

ALBERT的参数共享有三种：只共享Feed-forward Network的参数、只共享Attention的参数、共享全部参数，在不同的任务中大家可以尝试不通的共享方式。

**3\. Inter-sentence coherence loss**

BERT的NSP任务的正样本是文章中连续的两个句子，负样本则是从两篇文档中各选一个句子构造而成。由于两篇文章的话题（topic）不同，模型更多的是学习了句子见的话题（topic）关系，而非连贯性性（coherence）。而ALBERT提出 **Sentence-order prediction (SOP)** 来取代了NSP，正样本与NSP相同，但负样本是通过选择一篇文档中的两个连续的句子并将它们的顺序交换构造的。这样两个句子就会有相同的话题，模型会学习到的就更多是句子间的连贯性。

在完成上述几个步骤之后，ALBERT的large模型才只有1千8百万个参数，比BERT的3个亿小多了，而且由于使用了SOP来训练，模型效果比BERT也有所提升。

## 五、总结

本文阐述了BERT模型与其相关的ALBERT模型的原理简述，并在pai上实战了BERT的continue pretrain、fine-tuning和句向量生成，都是介绍层面的，有兴趣的同学可以根据参考文献找到其原论文阅读，也欢迎大家多交流，有错误还请帮忙指出，大家互相学习，共同提高！

## 六、参考文献

1\. Devlin J, et al. Bert: Pre-training of deep bidirectional transformers for language understanding\[C\]. NAACL 2018

2.[https://github.com/hanxiao/bert-as-service](https://github.com/hanxiao/bert-as-service)

3\. Lan Z, et al. Albert: A lite bert for self-supervised learning of language representations\[C\]. ICLR 2020

注：本文中的部分图片来自网络与相关论文。

END

一、前言

二、BERT介绍

三、BERT的原理与实战

3.1 BERT网络结构

3.2 Pretrain

3.2.1 Pretrain介绍

3.2.2 Continue Pretrian 实战

3.3 Fine-tuning

3.4 句向量生成

四、ALBERT

五、总结

六、参考文献

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
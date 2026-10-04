---
title: "安全同学讲Maven间接依赖场景的仲裁机制"
source: "https://mp.weixin.qq.com/s/flniMiP-eu3JSBnswfd_Ew"
author:
  - "[[唐天龙(唐礼)]]"
published:
created: 2026-08-12
description: "本文尝试调研了Maven的源码和做了一些本地的测试实验，做出了总结。"
tags:
  - "clippings"
---
唐天龙(唐礼) 千问AI平台 *2022年9月22日 09:00*

![图片](https://mmbiz.qpic.cn/mmbiz_jpg/Z6bicxIx5naLHPVMEpdGop35VVkgLCpdtsRNjCXkicDvOvxuTaTDPOKQoM8LQx7j3Dkjl26TOSsPk9ekGedBriaKg/640?wx_fmt=jpeg&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=0)

## 一 背景

**为什么想写此文**

去年的Log4j-core的安全问题，再次把供应链安全推向了高潮。在供应链安全的场景，蚂蚁集团在静态代码扫描平台-STC和资产威胁透视平台-哈勃这2款产品的联动合作下，优势互补，很好的解决了直接依赖和间接依赖的场景。

但是由于STC是基于事前，受限于扫描效率存在遗漏的风险面，而哈勃又是基于事后，存在修复时间上的风险。基于此，笔者尝试寻找一种方式可以同时解决2款产品的短板。笔者尝试研究了一下Maven是如何处理一个项目中的直接依赖和间接依赖的，并且在遇到相同依赖时，Maven是如何进行抉择的，这里的如何抉择其实就是Maven的仲裁机制。带着这些问题，笔者尝试调研了Maven的源码和做了一些本地的测试实验。总结了这篇文章。

**坐标是什么?**

在空间坐标系中，我们可以通过xyz表示一个点，同样在Maven的世界里，我们可以通过一组GAV在依赖的世界里明确表示一个依赖，比如：

\<groupId>: com.alibaba 一般是公司的名称

\<artifactId>: fastjson 项目名称

\<version>: 1.2.24 版本号

**影响依赖的标签都有哪些**

**1.\<dependencies>**

直接引入具体的依赖信息。注意是不在\<dependencyManagement>标签内的情况。如果是在\<dependencyManagement>内的情况，请参考2号标签。

**2.\<dependencyManagement>**

只声明但不发生实际引入，作为依赖管理。依赖管理是指真正发生依赖的时候，再去参考依赖管理的数据。

- 这样使用dependency的时候，可以缺省version。
- 另外\<dependencyManagement> 还可以管控所有的间接依赖，即使间接依赖声明了version，也要被覆盖掉。

**3.\<parent>**

声明自己的父亲，Maven的继承哲学跟Java很类似，因为Maven本身也是用Java实现的，满足单继承。

- 一旦子pom继承了父pom，那么会把父pom里的 \<dependencies> ，\<dependencyManagement>等等属性都继承过来的。当然如果在继承的过程中，出现一样的元素，也是子去覆盖父亲，和Java类似。
- 继承时，会分类继承。dependencies继承dependencies，dependencyManagement里的依赖管理只能继承dependencyManagement范围内的依赖管理。
- 每一个pom文件都会有一个父亲，即使不声明Parent，也会默认有一个父亲。和Java的Object设计哲学类似。后面在源码分析中我们还会提到。

**4.\<properties>**

代表当前自己的项目的一个属性的集合。

properties仅仅代表属性的声明，一个属性声明了，和他是否被引用并无关系。我完全可以声明一系列不被人使用的属性。

**依赖的作用域都有哪些**

一个依赖在引入的时候，是可以声明这个依赖的作用范围的。比如这个依赖只对本地起作用，比如只对测试起作用等等。作用域一共有compile，provided，system，test，import，runtime 这几个值。

简单总结一下：

- compile和runtime会参与最后的打包环节，其余的都不会。compile可以不写。
- test只会对 src/test目录下的测试代码起作用。
- provided是指线上已经提供了这个Jar包，打包的时候不需要在考虑他了，一般像servlet的包很多都是provided。
- system和provided没什么太大的区别。
- import只会出现在dependencyManagement标签内的依赖中，是为了解决Maven的单继承。引入了这个作用域的话，maven会把此依赖的所有的dependencyManagement内的元素加载到当前pom中的，但不会引入当前节点。如下图，并不会引入fastjson作为依赖管理的元素，只是会把fastjson文件定义的依赖管理引入进来。
<dependencyManagement><dependencies>  <dependency>    <groupId>com.alibaba</groupId>    <artifactId>fastjson</artifactId>    <version>1.2.24</version>    <scope>import</scope>  </dependency><dependencies><dependencyManagement>

## 二 单个Pom树的依赖竞争

**Pom文件本质**

**一个Pom文件的本质就是一棵树。**

在人的视角来观察一个Pom文件的时候，我们会认为他是一个线状的一个依赖列表，我们会认为下图的Pom文件抽象出来的结果是C依赖了A,B,D。但我们的视角是不完备的，Maven的视角来看，Maven会把这一个Pom文件直接抽象成一个依赖树。Maven的视角能看到除了ABD之外的节点。而人只能看到ABD三个节点。

既然是在一棵树上，那么相同的节点就必然会存在竞争关系。这个竞争关系就是我们提到了仲裁机制。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcx1L61LjiaiancnJgqQLzBxXQiauQtFAX1pE1BYdFOY1WfdicH26YLnLYgLw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=1)

**Maven仲裁机制原则**
**1.依赖竞争时，越靠近主干的越优先。**
**2.单颗树在依赖在竞争时(dependencies)（注意：不是dependencyManagement里的dependencies）：**
**当deep=1，即直接依赖。同级是靠后优先。**
**当deep>1，即间接依赖。同级是靠前优先。**
**3.单颗树在依赖管理在竞争时(注意：是dependencyManagement里的dependencies)是靠前优先的。**
**4.maven里最重要的2个关系，分别是继承关系和依赖关系。我们所有的规律都应该只从这2个关系入手。**

下图中分别是2个子pom文件（方块代表依赖的节点，A-1 表示A这个节点使用的是1版本，字母代表节点，数字代表版本）。

左边这个子pom生成的树依赖了 D-1，D-2和D-5。满足依赖竞争原则1，即越靠近树的左侧越优先的原则，所以D-5会竞争成功。

但是B-1和B-2同时都位于树的同一深度，并且深度为1，由于B-2更加靠后，所以B-2会竞争成功。

右边的子pom生成的树依赖了 D-1和D-2，并且位于同一深度，但由于D-1和D-2是属于间接依赖的范围，deep大于1，所以是靠前优先，那么也就是D-1会竞争成功。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxU7dldK8uTcbmtn0thFMaOibp73ibWbr8tvB8j75Af4FnyLbibPJ2cXHhw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=2)

**常见场景**

看到这里，想必大家已经了解了Maven的仲裁原则。但是在实际的工作中，光有原则还需要在代码中可以灵活的运用才能有属于自己的理解，这里笔者准备了5个场景，每个场景对应的答案都在后面，大家阅读时，可以自己尝试用Maven的原则来去推理，看看有没有哪里不符合预期的情况。

### 场景一 难度(*)

#### 场景描述

主POM里有<fastjson.version> 这个属性为1.2.24。

父亲是spring-boot-starter-parent-3.13.0。父亲里的<fastjson.version>是1.2.77。

并且在主pom中，消费了这个属性。

那么针对主POM这颗树，他最终会是使用哪一个fastjson呢？

#### 场景示例

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcx3sgty04UThUdMJGPSdsuIvgKPUvzF63pACoJXxv5h8viacsLIGCNRBw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=3)

#### 结构图

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxnqfhq4oSoricF1xHRPgKMApBjGle5iaiavwF0j8b12jzU8GUGBMiaTxCQQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=5)

### 场景二 难度(**)

在同一个主POM或者子POM中的dependencies中同时使用了Fastjson，第一个声明了1.2.24的版本，第二个声明了1.2.25版本。那么针对主POM或者子pom这棵树，最终会选择fastjson 1.2.24还是1.2.25呢？

#### 场景示例

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxUnm25HJ0K6icDfNnMYOmialYVt7dt2LBKXVy72CLQJd3kr4Wibq8ibWqWA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=6)

#### 结构图

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxBeH9s31S3utfs2mrCIO3r2TeZ8cuDfR5ZTYzLc410P5LWEOhm8fmNQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=7)

### 场景三 难度(***)

下图中左图为主POM文件内的dependencyManagement里的fastjson为1.2.77，这个时候子POM中显示声明自己的版本1.2.78。那么针对子POM这颗树，子POM会选择听从父命还是遵从内心呢？

#### 场景示例

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxGk41hlqugylicK3IicdtmNpfKReocHSnBXHplWgg2p32WqQXyg76CzzQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=8)

#### 结构图

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxBVkpnsBFmClooZhdMKrezsJnVGiciaufqJeVLNsibd0o1DAYuvT8PJxlQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=9)

### 场景四 难度(****)

主POM的dependencies **Fastjson:1.2.24** 主POM的dependencymanagent **Fastjson:1.2.77**

主POM的父亲（springboot）的dependencies **Fastjson 1.2.78**

子POM里的dependencies **Fastjson 1.2.25**

这种情况下针对子pom来说，他会选择4个版本中的哪一个呢？

#### 场景示例

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxGrdoXojWU3icmfnU3NTRjMicCX6n8OKT43XxY96NjJFfVKB7xt5GXXPw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=10)

#### 结构图

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxjI9WoKF4K0icMHg6mgiaHMErYgRX6lBaxLGDq7CzsWLJKsicdojjibeTfQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=11)

### 场景五 难度(*****)

主POM的dependencies **Fastjson:1.2.24** 主POM的dependencymanagent **Fastjson:1.2.77**

主POM的父亲（springboot）的dependencies **Fastjson 1.2.78**

子POM里的dependencies 不写version

场景五跟场景四整体没有差别，只是将子pom的dependencies的版本进行缺省。

这种情况下针对子pom来说，针对子pom，他会选择3个版本中的哪一个呢？

#### 场景示例

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxibqfLTYc7ZEnZR6b9MfODOPzpFNiaYY7PJA0gxtU47TObnbIGP6nR2Mg/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=12)

#### 结构图

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxxuSJqF0zxTAIm7RZ1Vlgnicc4iaDGIMZ0iaJFmLeZ65lher8Z2iayGJOhA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=13)

**答案**

#### 场景一

1.2.24会最终生效。

因为子会继承父亲的属性，但是由于自己有这个属性，那么则覆盖！

继承一定会伴随着覆盖的，这个设计在编程语言中还是比较普遍的。

#### 场景二

1.2.25会最终生效。

参考 单颗树在依赖在竞争时：当deep=1，即直接依赖。同级是靠后优先。

满足Maven的核心竞争依赖策略！

#### 场景三

1.2.78最终会生效。

一个项目里的dependencyManagement只能对不声明version的dependency和间接依赖有效！

#### 场景四

1.2.25会最终生效。这个比较复杂。

〇: 首先根据父子的继承关系，1.2.24会覆盖掉1.2.78。所以78版本淘汰

一: 由于一个项目里的dependencyManagement只能对不声明version的dependency和间接依赖有效，所以

1.2.77无法对1.2.25起作用。

二: 由于父子的继承关系，1.2.25会覆盖掉1.2.24.

所以最终1.2.25胜出！

#### 场景五

1.2.77会最终生效。

〇: 首先根据父子的继承关系，1.2.24会覆盖掉1.2.78。所以78版本淘汰

一: 由于一个项目里的dependencyManagement是可以对不声明的version起作用，所以子pom的版本为1.2.77

二: 由于父子的继承关系，1.2.77会覆盖掉1.2.24.

所以最终1.2.77胜出！

## 三 多个Pom树合并打包

**多棵树构建顺序原则**

现在的项目一般都是多模块管理，会存在非常多的pom文件。多棵树的情况下每棵树的出场顺序都是事先已经被计算好的。

这个功能在Maven的源码中是一个叫Reactor（反应堆）实现的。它主要做了一件事情就是决定一个项目中，多个子pom谁先进行build的顺序，这个出厂顺序很重要，在合并打包时，往往决定了最终谁会在多个pom之间胜出的问题。

**Reactor的原则**
**多棵树（多个子pom）构建的顺序是按照被依赖方的要在前，依赖方在后的原则。**
**项目要保证这里是不能出现循环依赖的。**
**Reactor的原则图解**

如下图子pom1 在被子pom2和子pom3同时依赖，所以子pom1最先被构建，子pom3没有人被依赖，所以最后构建。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcx4PydHj3mfHeEnNrYOKOy0avkbBzRKrLkurS2cXLfvo3f7ibSGheEViaQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=14)

**SpringBoot Fatjar打包的策略**

SpringBoot 打包会打成一个Fatjar,所有的依赖都会放在BOOT-INF/lib/目录下。SpringBoot的打包是越靠后的构建pom越优先，因为一般会把springboot的打包插件放在最不被依赖的module里(比如上图里的Pom3)。（SpringBoot的打包插件一般放在bootstrap pom里,这个名字可以我们自己起，一般都是依赖关系最靠上的module。在多模块管理的springboot应用内，bootstrap往往是最不被依赖的那个module。）

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxEKKWa5eIU3RbnoJFTTl05VImdfwCia3cBKaYGKhuAgD92XZjKnL4fEA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=15)

子pom3最后参与构建，而且SpringBoot打包插件一般打的就是这个module。所以最终进入到SpringBoot打包产物的有A-2,B-2,E-2,F-2和D-1。因为A-2和B-2相比于其他几个相同节点更靠近树的主干。E-2和F-2也是同理。这个规律体感上是靠后优先了，因为靠后的树天然更加靠近主干。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcx4wjuPCgGzAwHHYsLEUBCicWAmkPTuSIibjgKwITlq1YBfBJdfAjudNag/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=16)

## 四 仲裁机制在Maven源码中的实现

以Maven的3.6.3版本的源码进行分析，我们尝试分析Maven中对依赖处理的几处原则，方能从源码的层面上正向的证明仲裁机制的准确性。另外从源码上也可以看出一些Maven上的机制为什么是这样，而不是单单的他的机制是什么样。因为笔者相信，任何机制都无法保证与时俱进下的先进性，所以笔者认为上文中提到的所有的仲裁机制有一天可能会发生变化，这些结论并非最重要，而是如何调研这些结论更为重要！

**Maven是如何实现出继承并且相同属性子覆盖父的**

Maven中有2条非常重要的主线。一个是依赖，另一个就是继承。Maven在源码中实现继承大体如下。在下图中使用readParent进行对父亲的模型获取之后，便让自己陷入这个循环中。唯一可以出去这个循环的方式就是追不到父亲为止。并且把每次取到模型数据放到linega这个对象当中。下图中最下面的assembleInheritance我们看他消费了linega这个对象，目的就是完成真实的继承和覆盖。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxbjVdN6HBZ9s6LroLEy4AFzVMqZHun4rzgs2Ne1m386JN9BCgDOSJ9g/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=17)

在assembleInheritance中我们会发现一个很有意思的现象，lingage是倒着进行遍历，并且是从倒数第二个元素开始，这正是上文中我们提到了的Maven的一个设计哲学。Maven认为这个世界上所有的pom文件都存在一个父亲，类似Java的Object。这里便是对这个哲学处理的一个浅逻辑。

另外Maven自上而下的去遍历，更加方便自己去实现相同的元素子覆盖父的能力，这也是笔者认为在编码上的一个小心思。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcx7rX7XqsUibNEBsne40LFXANMGnlxLPhzia59veLfAyAjD7vIctiaLBWsQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=18)

**Reactor反应堆在源码中的实现**

上文中我们还提到了一个非常重要的概念，就是反应堆。反应堆直接决定了各个子pom是如何决定构建顺序的。在Maven的源码中，他是在getProjectsForMavenReactor函数中进行实现的。并且我们从下图中也可以看到，Maven的反应堆是不能解决循环依赖的，他直接捕获了这种异常！

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxp4GuxTG4WR2V9eTtiaFrK6fds6E9R2O33WAOEALKwJsGceZia9kKf9sA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=19)

真正实现反应堆算法的是在ProjectSorter的构造函数中通过Dag进行实现的。Dag（有向无环图）和广度优先搜索是解决依赖场景是一个很好的方式。

在有向无环图中通过每次挑选出入度为0的节点，再删除该节点和此节点的相邻边，不断重复上述步骤。就可以高效率的计算出DAG上的所有节点的依赖顺序，Maven也正是用到了这个思路。

从这个源码的视角也可以解释为什么Maven必须要保证每一个子pom之前不能出现循环依赖。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcx8N5j3icdAtWMtibest0ySKWKRticzlTRUrRz5QlGsB7xRXcMawMeDowyw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=20)

**同一个Pom文件内dependency 后声明的优先的实现**

在处理Dependencies时，Maven并没有对此进行特殊处理，是直接使用的Map的方式进行覆盖的。关于这里为什么这么设计，笔者并不清楚。笔者曾一度猜测这么设计是为了让开发同学更好的编写，因为靠后优先往往符合大部分人的编码习惯。但是在这里我们看到了作者的一行注释，意思大概是说，这样设计是为了向后兼容Maven2.x，因为Maven2.x 是不会去校验一个文件是否只存在一个同GA的唯一依赖。所以后面的maven的版本应该也是延续了这种风格。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxQLMEgTyjqJHicqbLIfl1AGKXcic9FIOiamTiaDL3P0TP75QDXickXE9Pl8w/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=21)

当循环进行处理到1.2.25的时候，依然进行对normalized这个map进行put操作导致了 key值相同的情况下的覆盖。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naLuhG7N3QAzCo20QpOQwIcxiaTfhD3HnqdJPmpWAXv0Z2c6bGTUiabyOCDBy5H4xphAdbYibUsibX0hmw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=22)

## 五 安全视角应如何避免间接依赖

**分析**

作为安全同学，笔者更希望的是针对这种多module的Maven项目可以梳理出一个经验，怎样去避免间接依赖的问题。

经过上面的分析，我们可以得出3条结论：

**1.子pom声明版本在安全视角是非常危险的，子pom不应该显示声明版本。**

由于子pom会继承主pom的元素，并且在继承的时候会出现覆盖的场景。那么针对CE或者SpringBoot打包时，有可能出现子pom的build的顺序位置天然非常有优势，容易造成子pom的版本进入最终的打包产物。

**2.主POM的dependencyManagent可以管控到 间接依赖 和 不显示声明version的直接依赖。**

**3.主POM的dependencies不能出现危险版本。否则子pom天然的继承了这个危险版本参与打包。**

**结论**

以上几条同时满足，便可以解决间接依赖的问题。

即：

针对SpringBoot而言，子pom不应该显示声明版本，主Pom的dependencyManagent应该管控安全版本的依赖，并且主pom不能出现危险版本。（主Pom dependencies强行写上安全版本更佳，这样可以避免掉依赖的父亲里存在残留的不安全的依赖）

## 六 最后

#### Maven的源码地址

https://archive.apache.org/dist/maven/maven-3/

#### 我是怎么分析的

本人在本地针对SpringBoot，做多轮测试。在根目录下执行mvn clean package即可！

mvn clean org.apache.maven.plugins:maven-dependency-plugin:3.3.0:tree -Dverbose=true 会帮助分析到具体的节点。

另外就是尝试在源码中找到这里的实现，这样更能加深理解！

#### 常用的分析命令

0\. mvn clean package -DSkipTest 直接进行打包，进行结果分析

1\. mvn dependency:tree 会把整个的maven的树形结构输出

2.mvn help:effective-pom -Dverbose 这个命令输出的信息更加完整，输出的是effectivepom

3.mvn clean org.apache.maven.plugins:maven-dependency-plugin:3.3.0:tree -Dverbose=true

4.mvn -D maven.repo.local =你的目录 compile阶段用到的依赖。

推荐阅读

1.[如何写出一篇好的技术方案？](http://mp.weixin.qq.com/s?__biz=MzIzOTU0NTQ0MA==&mid=2247508668&idx=1&sn=5a29aa4c1c5911a62696b6373d3650e0&chksm=e92a9fb3de5d16a5f018a32ca479528646cda1ac76c8625267fda75d986c1f613bd5817d05d5&scene=21#wechat_redirect)

2.[阿里10年沉淀｜那些技术实战中的架构设计方法](http://mp.weixin.qq.com/s?__biz=MzIzOTU0NTQ0MA==&mid=2247508638&idx=1&sn=e6425733e85439970f6b94bbbda2e084&chksm=e92a9f91de5d1687a499d9714eaf6bea292171cafe7d9609cf64009e00e963ff5746cb4e4942&scene=21#wechat_redirect)

3.[如何做好“防御性编码”？](http://mp.weixin.qq.com/s?__biz=MzIzOTU0NTQ0MA==&mid=2247508471&idx=1&sn=0221ea266aa82519b0d1138bec7f7044&chksm=e92a9cf8de5d15ee9b3e1e02d36bc1dddad1c8edeca00744be5628a6986bac2cad58ad59ab72&scene=21#wechat_redirect)

**阿里云产品测评—开源PolarDB-PG**

体验阿里云自主研发的云原生关系型数据库产品，100% 兼容 PostgreSQL，高度兼容Oracle语法；采用基于 Shared-Storage 的存储计算分离架构，具有极致弹性、毫秒级延迟、HTAP 的能力和高可靠、高可用、弹性扩展等企业级数据库特性。发布评测，写下你的感受与评价即可获得多重福利。

点击阅读原文查看详情。

阅读原文

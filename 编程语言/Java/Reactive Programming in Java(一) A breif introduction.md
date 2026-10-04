---
title: "Reactive Programming in Java(一): A breif introduction"
source: "https://ata.atatech.org/articles/11000097198?spm=ata.23639746.0.0.655af4a606aAWY"
author:
published:
created: 2026-05-31
description:
tags:
  - "clippings"
---
阿里健康









`Reactive Programming` 会越来越主流,但并不是特别容易理解,网上的文章也良莠不齐,甚至还要很多错误,所以准备写一个系列,介绍 Java 生态里 `Reactive Programming` 的方方面面,由于能力有限,文中难免有所疏漏,欢迎大家挑刺.
本篇是该系列的第一篇,主要从宏观方面介绍 Reactive Programming,让大家对它的一系列概念有一个整体上的认知.(读后面的参考文献效果比读本文效果好的多...)

## 术语

为了方便,先来说几个缩写,后文说到相关概念就直接用缩写了.
RP: [Reactive Programming](https://en.m.wikipedia.org/wiki/Reactive_programming)

FP: [Functional Programming](https://en.m.wikipedia.org/wiki/Functional_programming)

FRP:[Functional Reactive Programming](https://en.m.wikipedia.org/wiki/Functional_reactive_programming).
先看下维基的定义:

Functional reactive programming (FRP) is a programming paradigm for reactive programming (asynchronous dataflow programming) using the building blocks of functional programming (e.g. map, reduce, filter).
看起来好像是采用了函数式编程的异步编程就是 FRP, 但是学术界貌似对此争议很大,我们不用太过纠结这个区别,但是在使用和讨论的时候还是要稍微注意一下,详细了解可以看下面两个链接.
[https://stackoverflow.com/questions/5385377/the-difference-between-reactive-and-functional-reactive-programming](https://stackoverflow.com/questions/5385377/the-difference-between-reactive-and-functional-reactive-programming)
[http://conal.net/blog/posts/early-inspirations-and-new-directions-in-functional-reactive-programming](http://conal.net/blog/posts/early-inspirations-and-new-directions-in-functional-reactive-programming)

## What is Reactive Programming

让我们先从 [Reactive Streams](http://www.reactive-streams.org/) 的倡议看起.它是Pivotal(Spring全家桶), Netflix(Spring Cloud 大礼包以及美剧), 和 Typesafe(Scala 全家桶)的工程师在2013年发起的:

Reactive Streams is an initiative to provide a standard for asynchronous stream processing with non-blocking back pressure.

从这里我们基本可以看出RP两个最重要的概念:`asynchronous` 和 `back pressure`.
RP就是通过生产者消费者模型异步的处理数据和控制数据流动.生产者,消费者和异步是大家耳熟能详的概念,不细说,这里着重讨论一下 `back pressure`,它的中文翻译是背压,无论从中文还是英文我们都没办法从字面上直观的理解出它的意思.网上对它的理解莫衷一是,我也没找到这个概念的源头,下面是我的一些理解:
大部分异步编程包括RP可以抽象成生产者消费者模式,生产者提交任务给消费者,消费者处理任务.当生产者提交任务的速度小于消费者处理任务的速度时,系统可以正常的运行,但是当提交任务的速度大于处理任务的速度时.`pressure` 出现了.传统的异步模型,比如我们最熟悉的 MQ, 是将这个 `pressure` 放到消费者那端,即生产者只要有任务就提交,那些处理不了的任务交给消费者处理,消费者可以缓存,也可以丢弃.线程池的任务队列和 `RejectedExecutionHandler` 就是最典型的在消费者端处理的例子.而 RP里是把这个 `pressure` 施加到生产者端,消费者告诉生产者自己能处理的极限,生产者每次都给消费者那么多数据,多余的数据则由生产者去处理,比如降低生产速度,缓存,丢弃等.仔细想一下,把这个压力放在生产端要比放在消费端处理更合理,有一些控制,比如降低生产速度,只有生产端才能完成.

上面其实将 `back pressure` 和处理策略杂糅在一起说了,下面我们说下各种文献里对 `back pressure` 的定义,有的地方将把 `pressure` 交给生产者处理叫 `back pressure`,这个也符合 `back pressure` 在工程学上的定义(回压,反向压力),有的人信誓旦旦的说当设置了 buffer, 并且超过了 buffer 上限才叫 `back pressure`,也有的人认为只有限制生产者的速度这种处理方式才是 `back pressure`.我的理解是生产的速度大于消费的速度产生的 `pressure` 就是 `back pressure`,这个 `back` 和 `backlog` 里的 `back` 有相似的含义,代表积压,也就是由于处理不及时而积聚的压力,至于是把它给消费者还是给生产者,是 `buffer` 还是 `throttling` 还是 `sample`,都是处理这种 `pressure` 的一个策略.
具体那种说法对,大家还是自行阅读参考文献判断吧,别被我带到沟里去.也欢迎大家留言讨论.

## Reactive Programming的优劣

### 优势

RP并不会提高处理数据的速度,事实上,由于上下文切换,它比传统的 Blocking 模型想比还会慢一些,但是它却有更好的并行处理能力,能更好的利用多核处理器的性能:

- 提高应用程序的性能
- 提高多核系统的资源利用率
- 是一种可维护性较高的异步编程范式
- back pressure 可以避免资源的过度使用

### 劣势

- 有一定门槛
- 测试比较困难

## Reactive Programming in reality

介绍 Java 世界中的 Reactive Programming的各种类库(基本来自Studying Reactive Programming With Java9一书)

### Java9 Reactive

Java9提供了对Reactive Programming的支持,完全兼容了 Reactive Streams标准,我们下一篇着重介绍,这里只先说下几个基本概念

| Components | The API | 描述 |
| --- | --- | --- |
| Publisher | interface Publisher<T> | 生产者 |
| Subscriber | interface Subscriber<T> | 消费者 |
| Subscription | interface Subscription | 生产者和消费者通信的媒介或者订阅关系或者通信手段 |
| Processor | interface Processor <T,R> | 生产者和消费者的中间态,既是生产者,又是消费者 |

### RxJava

Netflix在2014年开发,有 JavaScript, Ruby, C#, Scala, C++, Java等语言的实现

### Project Reactor

它是 [Reactive Streams](https://ata.atatech.org/articles/reactive-streams.org) 标准的实现,支持 JDK8,也兼容 和上面说的JDK9的 Reactive API有完全对等的实现.它也是 Spring5里 Reactive 编程默认的实现

### Akka Streams

Akka 是 Scala家族的杀手级应用,采用 actor 模式的消息驱动的异步编程框架.
Akka Streams 实现了Reactive Streams 的接口去传送数据,但是它却完全和它们不耦合,即使用者在使用的时候根本发现不了Reactive Streams的接口,它( akka stream)提供了更好的 API.

### vert.x

Eclipse 开源的非常主流的异步编程框架,有多种语言实现.

### 其它

还有Ratpack Quasar Slick等等,就不一一介绍了,有兴趣的同学可以自行搜索, Spring5开始主推响应式编程, Spring Data 也对 Rp 有了一定的支持,大家都可以自行了解.

## AD Time

国际惯例,给我们的读书群[独来读往]打个广告,欢迎喜欢读书的小伙伴加入我们,一起交流,一起成长.详见
[https://lark.alipay.com/growth/notes/zdu5a4](https://lark.alipay.com/growth/notes/zdu5a4)

## 后记

个人感觉RP 应该会更火一点,一是现在计算机已经需要靠堆 CPU 的核数来提高性能,程序在多核 CPU 下的表现直接影响了系统的效率,而 RP 在这方面有极大的优势,二是随着 spring boot的出现,搭建一个系统或者开发一个功能已经极快,但是部署系统的时间却很慢,怎样优化部署系统时间可能是未来一个很主要的研究方向. 不管Servless或者 FAAS的方向对不对,减少部署时间必然会减少部署的功能,会增加线程和进程间的通信, RP 在这方面的优势也保证了它在未来的优势.但现实情况是雷声大,雨点小,网上叫的欢,采用 RP 编程的人却不多,可能是最近这几年技术的演进太快,从传统的单体应用到 SOA, 到微服务再到 Servless,恨不得每天都有一种新的架构模式,而大部分程序员迫于对舒适区的留恋,以及沉重的业务压力和道德压力,对架构的理解还停留在单体应用上,虽然这也能比较好的完成任务,但是如果能多了解一下编程模型和范式,设计系统的时候也可以思路更开阔一些,把系统设计的更好一些,也能工作的更有趣些吧,最少也能被辞退的慢些吧...

## 参考文献

[https://spring.io/blog/2016/04/19/understanding-reactive-types](https://spring.io/blog/2016/04/19/understanding-reactive-types)
[https://github.com/reactive-streams/reactive-streams-jvm/tree/v1.0.2#specification](https://github.com/reactive-streams/reactive-streams-jvm/tree/v1.0.2#specification)
[https://spring.io/blog/2016/06/07/notes-on-reactive-programming-part-i-the-reactive-landscape](https://spring.io/blog/2016/06/07/notes-on-reactive-programming-part-i-the-reactive-landscape)
[https://akarnokd.blogspot.co.uk/2016/03/operator-fusion-part-1.html](https://akarnokd.blogspot.co.uk/2016/03/operator-fusion-part-1.html)
[https://github.com/ReactiveX/RxJava/wiki/Backpressure](https://github.com/ReactiveX/RxJava/wiki/Backpressure)

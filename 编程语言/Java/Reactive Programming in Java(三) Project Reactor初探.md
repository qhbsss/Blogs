---
title: "Reactive Programming in Java(三): Project Reactor初探"
source: "https://ata.atatech.org/articles/11000102274?spm=ata.25287382.0.0.6b137536HfCFml"
author:
published:
created: 2026-05-31
description:
tags:
  - "clippings"
---
阿里健康









Java的RP类库主要有三个,分别是 [Akka-Streams](https://doc.akka.io/docs/akka/2.5.5/scala/stream/index.html),[RxJava](https://github.com/ReactiveX/RxJava) 和 [Project Reactor](https://ata.atatech.org/articles/projectreactor.io), 完全出于个人喜好,我们从 [Project Reactor](https://ata.atatech.org/articles/projectreactor.io) 开始,为了行文方便,下面的Reactor都是指 [Project Reactor](https://ata.atatech.org/articles/projectreactor.io).

## Project Reacotr简介

Reactor是实现了 [reactive-streams](https://ata.atatech.org/articles/www.reactive-streams.org) 标准的第四代Reactive 类库,主用用于在jvm上构建non-blocking应用.所谓第四代,没有特别搞懂,但并不影响我们的使用,非要搞懂的话可以看下这个链接(虽然写的也很含糊,但是是我找到的唯一一个关于分代的介绍了,原文还无法访问):
[https://blog.piasy.com/AdvancedRxJava/2017/05/01/operator-fusion-part-1/](https://blog.piasy.com/AdvancedRxJava/2017/05/01/operator-fusion-part-1/)

## Hello World

为了后面的概念介绍更直观,我们先上个代码.Reactor对版本的管理也采用了 `BOM (Bill of Materials)` 方式,目前最新版本是 `BISMUTH-SR7`.
我们以 `maven` 工程为例,`gradle` 请自行转换.

我们在pom文件里加上如下内容:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>io.projectreactor</groupId>
            <artifactId>reactor-bom</artifactId>
            <version>BISMUTH-SR7</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <dependency>
        <groupId>io.projectreactor</groupId>
        <artifactId>reactor-core</artifactId>

    </dependency>
    <dependency>
        <groupId>io.projectreactor</groupId>
        <artifactId>reactor-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

这种依赖的使用方法和我们平时工作中的用法一样,就不展开说明了,直接看我瞎写的一段代码:

```java
// map和flatMap的操作可以合并,这里只是演示操作,不要考虑合理性
public static void main(String[] args) {
        Flux.just("Hello world!")
            .map(it -> it.split(""))
            .flatMap(Flux::fromArray)
            .zipWith(Flux.range(1, 100), (str,count) -> count + str)
            .subscribe(System.out::println);
    }
```

它的输出是:

1H
2e
3l
4l
5o
6
7w
8o
9r
10l
11d
12!

如果你也得到了结果,恭喜你完成了一个没啥意义却有用的RP程序.

## 基本概念

### Mono and Flux

上面代码里的 `Flux` 是生产者,即我们之前提到的 `Publisher`,它代表的是一个包含0-N个元素的异步序列,它还有一个特例,叫 `Mono`,代表0-1个元素,如果不需要生产任何元素,只是需要一个完成任务的信号,可以使用Mono.

之所以区分 `Flux` 和 `Mono`,我理解是为了更精确的语义,`Flux` 相当于 `List`,`Mono` 相当于 `Optional`,虽然我们在编程中所有的结果都可以用 `List` 表示,但是当只返回一个或者没有结果时,用 `Optional` 要更精确.
`Mono` 和 `Flux` 都提供了一堆工厂方法,用来创建相关的实例:

```java
Flux.just("foo", "bar");
Flux.fromIterable(Arrays.asList("foo","bar"));
Flux.error(new IllegalStateException());
Flux.interval(Duration.ofMillis(100)).take(10);
Mono.empty();
Mono.never();
Mono.just("foo");
Mono.error(new IllegalStateException());
```

### Operator

上面我们看到的所有函数调用基本都是 `Reactor` 的 `Operator`,比如产生序列的 `just`,做转换的 `map`,`flatMap` 等等, `Operator` 是一系列函数式的便捷操作,可以链式调用,我们在Java8的stream上做的操作基本上都能在这里找到对应,全部的操作可以在 [这里](http://projectreactor.io/docs/core/release/reference/#which-operator) 找到.

### Processor

`Processor` 的具体含义参考 [上一篇文章](https://www.atatech.org/articles/98002),它既是一个生产者,又是一个消费者,绝大部分功能都能通过 `operator` 的组合实现,Reactor强烈不推荐使用 `Processor`,因为非常容易出错,如果一定要用,先深呼吸,然后想个办法用 `operator` 替代它,实在想不到,看下这个 [文档](http://projectreactor.io/docs/core/release/reference/#processor-overview).

### Subscriber

这里请回忆一下之前的内容:当 `Publisher` 没有被订阅(`subscribe`)时,即没有消费者给它发送 `request` 信号,什么也不会发生.这和Java8的stream的惰性求值类似,当然只是形式上的类似,其实内部差很多,这次不说的这么深入,以后再介绍.`subscribe` 有如下几种方式:

```java
//只触发序列的计算操作
subscribe();
//对每个值进行消费,hello world程序里就是调用的这个方法
subscribe(Consumer<? super T> consumer);

//加上错误处理
```
subscribe(Consumer<? super T> consumer,
          Consumer<? super Throwable> errorConsumer);
//完成之后再额外进行一些处理
subscribe(Consumer<? super T> consumer,
          Consumer<? super Throwable> errorConsumer,
          Runnable completeConsumer);
....

可以看到,参数都是函数式接口,可以用lambda方便的调用.

### backpressure

说到RP,`backpressure` 是永远无法跳过去的概念.不过Reactor没搞啥幺蛾子,基本上和协议以及我们之前的文章里介绍的保持一致:
一个订阅者可以没有限制,只要生产者有消息就都推给他,也可以通过 `request` 方法,告诉生产者它最多可以处理多少消息,`request` 方法可以参考 [这篇文章](https://www.atatech.org/articles/98002) 的介绍.

### Hot and Cold

热序列和冷序列.冷序列是指每个订阅者都能收到生产者产生的所有消息(数据),而热序列是指订阅者只能收到它订阅时刻之后的消息(数据),一般来讲,即使没有订阅者,热序列也是有可能发出消息的,冷热序列的详细解读可以参考这部分 [文档](http://projectreactor.io/docs/core/release/reference/#reactor.hotCold)

## 如何测试

RP最大的痛点就是测试和定位问题比较复杂,还好Reactor提供了 `StepVerifier` 这个工具,看下我改写的文档上的例子:

@Test
```java
public void testVerify() {
    Flux<String> source = Flux.just("foo","bar").concatWith(Mono.error(new IllegalStateException("boom")));

    StepVerifier.create(source)
        .expectNext("foo")
        .expectNext("bar")
        .expectErrorMessage("boom")
        .verify();
}
```

`StepVerifier.create` 是一个工厂方法,可以传递任意的 `Publisher`,`expectNext`,`expectErrorMessage` 用来验证序列是否产生了正确的消息,其它验证方法可以查看API文档,`verify` 方法注意一定要调用,否则不会开启验证.`StepVerifier` 还提供了一些其它的 `verify` 方法,比如 `verifyComplete`,`verifyError`,具体的可以查看文档.
`StepVerifier` 还提供了虚拟时间的验证方式,用来验证一些依赖时间的序列比如

```java
StepVerifier.withVirtualTime(() -> Flux.interval(Duration.ofSeconds(1)).take(3600))
.thenAwait(Duration.ofHours(1))
.expectNextCount(3600)
.verifyComplete();
```

这个序列需要一个小时才能产生所有需要的3600个元素,但是我们也不能等一个小时就为了验证这么一个没用的玩意,于是Reactor贴心的提供了StepVerifier.withVirtualTime来包装一个Publisher,注意上面给这个方法传递的参数:
`() -> Flux.interval(Duration.ofSeconds(1)).take(3600)`,这是一个产生Flux的Supplier,这里是用了函数式编程里惰性求值,有兴趣可以了解一下. 目的是延迟产生实例的时间,为时间调度做准备.

## 调试模式

可以通过调用 Hooks.onOperatorDebug()启动调试模式,启动该模式之后,当有错误发生,Reactor会记录额外的堆栈,当然该模式会有性能损耗,如果程序运行正常,能不开启尽量不要开启.

## 学习资料

最好的资料是官方文档:
[http://projectreactor.io/docs/core/release/reference/](http://projectreactor.io/docs/core/release/reference/)
其它的(包括本文)都是对文档的提炼...

其次是上手写代码:
[https://github.com/reactor/lite-rx-api-hands-on](https://github.com/reactor/lite-rx-api-hands-on)
这个练习可以帮你更好的掌握Reactor的一些API,里面提供了单测,实在写不出可以切换到 `complete` 分支查看答案.

## AD Time

国际惯例,给我们的读书群[独来读往]打个广告,新群规大幅降低了读书要求和频次以及处罚力度.欢迎喜欢读书的小伙伴加入我们,一起交流,一起成长.详见
[https://lark.alipay.com/growth/notes/ewqntu](https://lark.alipay.com/growth/notes/ewqntu)

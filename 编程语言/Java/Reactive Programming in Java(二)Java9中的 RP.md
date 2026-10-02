---
title: "Reactive Programming in Java(二):Java9中的 RP"
source: "https://ata.atatech.org/articles/11000098002?spm=ata.25287382.0.0.6b137536HfCFml"
author:
published:
created: 2026-05-31
description:
tags:
  - "clippings"
---
阿里健康

勋章

粉丝 49影响力 826

** 7

** 5

** 3

** 原创文章

发表到圈儿

[阿里健康技术](https://ata.atatech.org/community/team/186) / [中间件](https://ata.atatech.org/community/team/186?cid=1253) (首发)

**

[刘金龙(诗翁)](https://ata.atatech.org/users/11000276723)

** 字号

** 笔记

** 分享 **

[上一篇文章](https://www.atatech.org/articles/97198) 从高空俯视了 RP 的全貌,本篇文章将深入到地下介绍 Java9 对 RP 的支持(之前的版本无原生支持).

---

## Java中的数据处理

我们已经了解到RP的本质是数据的流转和处理,在JDK8之前，我们依赖各种集合框架，必须用循环语句处理数据:

```java
List<Integer> list = Arrays.asList(0, 1, 2, 3, 4);
for (Integer i : list) {
   System.out.println(i*i);
}
```

在JDK8引入了函数式编程的概念,增加了Stream和lambda，我们有了更简便更直观的处理数据的方法：

```java
LongStream.range(0,100).map(lt -> lt*lt).forEach(System.out::println);
```

ps: 虽然Java的lambda只是语法糖,但我们从上面两个简单的例子里还是可以看出指令式编程和函数式编程的一些区别,指令式编程需要我们写指令,告诉程序该如何做,而函数式编程却倾向于告诉程序要做什么,并不关心怎么做到.  
言归正传,对于数据的处理stream其实挺简洁,但是它还是存在传统的push模型存在的问题:当生产的速度大于消费的速度时,数据会在消费端积压,并且由于同步处理,无法很好的利用多核处理器的性能.为了更好的解决这个问题,Java9引入了RP,或者说兼容了 [Reactive Streams](http://www.reactive-streams.org/) 的标准,毕竟人家标准和实现都早就有了,而Java9只是照搬了人家的标准,但是由于Java9里定义的足够简单,我们正好可以从中一窥RP运行的本质.

我们知道RP是基于发布订阅模式做数据流转,传统的发布订阅模式存在两种模型,一种是push模型,消息(或者数据之类的)由发布者推给订阅者,另一种是pull模型,由订阅者主动向发布者取数据(每次都会想起拉力大于推力),而Java9的RP是一种混合模型,先由订阅者请求数据,然后发布者再把数据推给订阅者,数据流转示意图如下:  
![15152320020481.jpg](https://oss-ata.alibaba.com/article/2023/11/3320d1f6-44f2-4823-94d0-e274be5757ff.jpg?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

在具体的流转过程中,当订阅者消费速度比较快时,它表现的会像一个pull模型,当消费者生产速度比较快时,它表现的会像一个push模型.下面我们来看下具体的API.

## Java9中的RP

Java9里RP的API全部定义在 `java.util.concurrent.Flow` 中,它完全遵循了 [Reactive Streams](http://www.reactive-streams.org/) 的标准,供包含如下几个接口:

```java
java.util.concurrent.Flow.Publisher<T>
java.util.concurrent.Flow.Subscriber<T>
java.util.concurrent.Flow.Subscription
java.util.concurrent.Flow.Processor<T,R> extends Subscriber<T>, Publisher<R>
```

我们先分别看下每个接口的作用:

### java.util.concurrent.Flow.Publisher

顾名思义,这个就是发布者了,它是个函数接口,定义如下:

```java
@FunctionalInterface
public static interface Publisher<T> {
      public void subscribe(Subscriber<? super T> subscriber);
}
```

它只提供一个 `subscribe` 方法,供订阅者订阅,如果只看这个定义估计大家都比较茫然,不知道该如何使用,好在Java9里提供了一个实现 `java.util.concurrent.SubmissionPublisher<T>`,可以让我们窥探如何使用 `Publisher`,`java.util.concurrent.SubmissionPublisher` 里异步的实现依赖了 `java.util.concurrent.CompletableFuture` 和 `java.util.concurrent.ForkJoinPool`,这两个类具体的介绍这里不细说(否则这篇文章得写到猴年马月了),大家可以自己看下源码,或者随便搜一下,网上一大把.我们先来看一下 `java.util.concurrent.SubmissionPublisher` 定义的方法:

- public int submit(T item)  
	最简单的产生数据的方法,这个方法会在submit的item对所有订阅者可用后返回,这里需要注意的是对订阅者可用,而不是被消费,它会返回一个估算的所有还未被消费的item的数量
- public int offer(T item, long timeout, TimeUnit unit,BiPredicate<Flow.Subscriber<? super T>,? super T> onDrop)

通过调用 `Flow.Subscriber#onNext(Object)(下面详细说这个方法)` 来发布数据,可以指定超时时间,如果在指定时间还没被订阅者消费,则drop, 这是会触发onDrop判断,如果返回true,会重新尝试一次offer.它的返回值为负数时,表示被drop的数量,为正时,和submit有相同的含义.

- public CompletableFuture consume(Consumer<? super T> consumer)

一个快速订阅的方法,consumer会被包装成一个订阅者,并返回CompletableFuture,用来获取它的状态.

- public void subscribe(Flow.Subscriber<? super T> subscriber)

这个就是Publisher接口的方法

下面看下如何使用 `java.util.concurrent.SubmissionPublisher`:

```java
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.SubmissionPublisher;
import java.util.stream.LongStream;
public class SimplestSubmissionPublisherMain {
    public static void main(String[] args) throws ExecutionException, InterruptedException {
        SubmissionPublisher<Long> publisher = new SubmissionPublisher<>();
        //此处会把consumer包装成一个subscriber
        CompletableFuture<?> future = publisher.consume(System.out::println);
        LongStream.range(0, 1000).forEach(publisher::submit);
    }
}
```

上面是一个最简单的发布订阅,执行这个程序,控制台输出不到999就会退出(如果到了,请重新运行一次),可以说明submit这个方法并不是等待提交的item被消费完的,也从另一个层面说明RP对性能有一定损耗.

### java.util.concurrent.Flow.Subscriber

再顾名思义一下,这个就是订阅者,负责消费和处理数据.它需要订阅一个'Publisher'才可以获取数据,和传统的发步订阅不一样的是它必须主动请求数据之后,数据才会被发布给它.  
我们来看下这个接口的定义:

```java
public static interface Subscriber<T> {
       public void onSubscribe(Subscription subscription);
       public void onNext(T item);
       public void onError(Throwable throwable);
       public void onComplete();
   }
```

订阅Publisher之后,Publisher会回调 `onSubscribe` 的方法,并传一个 `subscription` 用来维护二者的关系,`onSubscribe` 是每个 `Subscriber` 第一个调用的方法.其余的三个方法从名字即可以看出作用,不细说,关于 `Subscriber` 的实现,我们可以先看下上文提到的 `java.util.concurrent.SubmissionPublisher` 对consumer的包装的方法:

```java
public CompletableFuture<Void> consume(Consumer<? super T> consumer) {
       if (consumer == null)
           throw new NullPointerException();
       CompletableFuture<Void> status = new CompletableFuture<>();
       subscribe(new ConsumerSubscriber<T>(status, consumer));
       return status;
   }
```

可以看到每个 `consumer` 都被包装成一个 `ConsumerSubscriber`,它的实现如下:

```java
private static final class ConsumerSubscriber<T>
       implements Flow.Subscriber<T> {
       final CompletableFuture<Void> status;
       final Consumer<? super T> consumer;
       Flow.Subscription subscription;
       ConsumerSubscriber(CompletableFuture<Void> status,
                          Consumer<? super T> consumer) {
           this.status = status; this.consumer = consumer;
       }
       public final void onSubscribe(Flow.Subscription subscription) {
           this.subscription = subscription;
           status.whenComplete((v, e) -> subscription.cancel());
           if (!status.isDone())
               subscription.request(Long.MAX_VALUE);
       }
       public final void onError(Throwable ex) {
           status.completeExceptionally(ex);
       }
       public final void onComplete() {
           status.complete(null);
       }
       public final void onNext(T item) {
           try {
               consumer.accept(item);
           } catch (Throwable ex) {
               subscription.cancel();
               status.completeExceptionally(ex);
           }
       }
   }
```

可以看到item的消费发生在onNext方法里.上文说的需要主动请求元素发生在 `onSubscribe` 里,  
它调用了 `subscription.request(Long.MAX_VALUE);`这个request方法的参数代表向 `Publisher` 请求多少个元素,当值是Long.MAX\_VALUE时,表示不限制数量.在具体使用或实现之前,我们需要了解下面这个接口.

### java.util.concurrent.Flow.Subscription

这个不太容易顾名思义,它是用来控制 `Publisher` 和 `Subscriber` 之间的数据流转的,我们先来看下它的定义:

```java
public static interface Subscription {
        public void request(long n);
        public void cancel();
    }
```

`request(n)` 用来发起请求数据,其中n表示请求数据的数量,它必须大于0,否则会抛出 `IllegalArgumentException`,并触发 `onError`,`request` 的调用会累加,如果没有终止,最后会触发相应次数的 `onNext` 方法.  
`cancel` 相当于取消订阅,调用之后,后续不会再收到订阅,`onError` 和 `onComplete` 也不会被触发.

### public static interface Processor<T,R> extends Subscriber, Publisher

从定义可以看出,Processor既是一个 `Subscriber`,又是一个 `Publisher`,它的作用如名字所示,夹在第一个Publisher和最后一个Subscriber中间,对数据进行处理,它的地位可以参考 `stream` 里的 `map`,`filter` 等方法.具体在数据流转中,`Processor` 以 `Subscriber` 的身份订阅 `Publisher` 接受数据,又以 `Publisher` 的方式接受其它 `Subscriber` 的订阅,它从自己订阅的 `Publisher` 收到数据后,做一些处理,然后转发给订阅它的 `Subscriber`.

### 数据流转

我们已经了解了所有的API,下面看下具体的数据流转过程:

![15152935202533.jpg](https://oss-ata.alibaba.com/article/2023/11/432879bd-e380-42fe-95f7-36f60d7c6f90.jpg?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

这张图(虽然是照别人的图画的)基本上说清楚了调用顺序,需要注意item在6.1 push给 `Subscriber`.6.2 6.3 6.4都会导致数据流转结束.

## AD Time

国际惯例,给我们的读书群\[独来读往\]打个广告,欢迎喜欢读书的小伙伴加入我们,一起交流,一起成长.详见  
[https://lark.alipay.com/growth/notes/zdu5a4](https://lark.alipay.com/growth/notes/zdu5a4)

## 小结

不得不说 Java 对并发和异步支持的越来越好了,虽然依然没有 `Coroutine`

## 参考文献

1.Reactive Programming With Java 9  
2\. Java doc

END

Java中的数据处理

Java9中的RP

java.util.concurrent.Flow.Publisher

java.util.concurrent.Flow.Subscriber

java.util.concurrent.Flow.Subscription

public static interface Processor<T,R> extends Subscriber, Publisher

数据流转

AD Time

小结

参考文献

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
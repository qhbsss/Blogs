---
title: "响应式编程（1）-Reactor_io.projectreactor-CSDN博客"
source: "https://blog.csdn.net/wang852575989/article/details/107748307?spm=1001.2014.3001.5501"
author:
  - "[[成就一亿技术人!]]"
  - "[[hope_wisdom 发出的红包]]"
published:
created: 2026-05-31
description: "文章浏览阅读964次。本文深入探讨Reactor响应式编程库在Java中的应用，包括其核心概念如Flux和Mono，常见操作符的使用，错误处理策略，调度器的作用，以及如何进行单元测试和调试。通过实际代码示例，读者将了解如何创建、操作和处理响应式流，掌握异步编程和非阻塞IO的实践技巧。"
tags:
  - "clippings"
---
### 1、 响应式编程 的出现

我们平时写的代码大多数都是串行的，也就是传统编程，就会带来了以下的问题：

- 阻塞导致性能瓶颈和浪费资源
- 增加线程可能会引起资源竞争和并发问题（这是解决其中的一种办法）

引入了异步编程，然后也会带来了一下问题：

- Callbacks 是解决非阻塞的方案，但是随着业务代码太多了，回调也会很多，他们之间很难组合，最终导致网中流行的“Callback Hell”，翻译为回调地狱
- Futures 相对于 Callbacks 好一点，不过还是无法组合，但是到了java8中，引入了 CompletableFuture 能够提升这方面的不足点。

官方文档： [Reactor 3 Reference Guide](https://projectreactor.io/docs/core/release/reference/#core-features)

后边引入了Reactive Programming概念，出现了Rxjava，Reactor等，其实他们都是用的同一个api的，也就是Reactor-streams。spring5 webFlux 其实就是用的Reactor的API，所以本文主要介绍Reactor的。

### 2、Reactor 简介

在 Java 程序中使用 Reactor 库非常的简单，只需要通过 Maven 或 Gradle 来添加对 io.projectreactor:reactor-core 的依赖即可，下面是我这次演示引用的包。

```xml
<dependency>
    <groupId>io.projectreactor</groupId>
    <artifactId>reactor-core</artifactId>
    <version>3.2.3.RELEASE</version>
</dependency>
<dependency>
    <groupId>io.projectreactor</groupId>
    <artifactId>reactor-test</artifactId>
    <version>3.2.3.RELEASE</version>
    <scope>test</scope>
</dependency>
```
java1234567891011

### 3、Flux 和 Mono

Flux 和 Mono 是 Reactor 中的两个基本概念。其实Flux 和 Mono 之间可以进行 转换 ，对一个 Flux 序列进行计数操作，得到的结果是一个 Mono对象。把两个 Mono 序列合并在一起，得到的是一个 Flux 对象。下面我主要是介绍了flux的api使用。

### 4、创建Flux

1. 通过 Flux 类的静态方法创建 Flux 序列
```java
private static void simple() {
        System.out.println("*******");
        Flux.just("Hello", "World").subscribe(System.out::println);
        Flux.fromArray(new Integer[] {1, 2, 3}).subscribe(System.out::println);
        Flux.empty().subscribe(System.out::println);
        Flux.range(1, 10).subscribe(System.out::println);
        Flux.interval(Duration.of(10, ChronoUnit.SECONDS)).subscribe(System.out::println);
        Flux.intervalMillis(1000).subscribe(System.out::println);
    }
```
java123456789
2. 使用 generate()方法生成 Flux 序列
```java
private static void generate() {
        System.out.println("*******");
        Flux.generate(sink -> {
            sink.next("Hello");
            sink.complete();
        }).subscribe(System.out::println);

        final Random random = new Random();
        Flux.generate(ArrayList::new, (list, sink) -> {
            int value = random.nextInt(100);
            list.add(value);
            sink.next(value);
            if (list.size() == 10) {
                sink.complete();
            }
            return list;
        }).subscribe(System.out::println);
    }
```
java123456789101112131415161718
3. create()方法
```java
private static void create() {
        System.out.println("*******");
        Flux.create(sink -> {
            for (int i = 0; i < 10; i++) {
                sink.next(i);
            }
            sink.complete();
        }).subscribe(System.out::println);
    }
```
java123456789

### 5、操作符

1. buffer 相关操作符
```java
private static void buffer() {
        Flux.range(1, 100).buffer(10).subscribe(System.out::println);
        Flux.intervalMillis(100).bufferMillis(1001).take(1).toStream().forEach(System.out::println);
        Flux.range(1, 10).bufferUntil(i -> i % 2 == 0).subscribe(System.out::println);
        Flux.range(1, 10).bufferWhile(i -> i % 2 == 0).subscribe(System.out::println);
        Flux.range(1, 10).filter(i -> i % 2 == 0).subscribe(System.out::println);
    }
```
java1234567
2. filter 操作符使用示例
```java
private static void filter() {
        Flux.range(1, 10).filter(i -> i % 2 == 0).subscribe(System.out::println);
    }
```
java123
3. window 操作符使用示例
```java
private static void window() {
        Flux.range(1, 100).window(20).subscribe(System.out::println);
        Flux.intervalMillis(100).windowMillis(1001).take(2).toStream().forEach(System.out::println);
    }
```
java1234
4. zipWith 操作符使用示例
```java
private static void zipWith() {
        Flux.just("a", "b")
                .zipWith(Flux.just("c", "d"))
                .subscribe(System.out::println);
        Flux.just("a", "b")
                .zipWith(Flux.just("c", "d"), (s1, s2) -> String.format("%s-%s", s1, s2))
                .subscribe(System.out::println);
    }
```
java12345678
5. take 系列操作符使用示例
```java
private static void take() {
        Flux.range(1, 1000).take(10).subscribe(System.out::println);
        Flux.range(1, 1000).takeLast(10).subscribe(System.out::println);
        Flux.range(1, 1000).takeWhile(i -> i < 10).subscribe(System.out::println);
        Flux.range(1, 1000).takeUntil(i -> i == 10).subscribe(System.out::println);
    }
```
java123456
6. reduce 和 reduceWith 操作符使用示例
```java
private static void reduce() {
        Flux.range(1, 100).reduce(Integer::sum).subscribe(System.out::println);
        Flux.range(1, 100).reduceWith(() -> 100, Integer::sum).subscribe(System.out::println);
    }
```
java1234
7. merge 和 mergeSequential 操作符使用示例
```java
Flux.merge(Flux.intervalMillis(0, 100).take(5), Flux.intervalMillis(50, 100).take(5))
                .toStream()
                .forEach(System.out::println);
        Flux.mergeSequential(Flux.intervalMillis(0, 10000).take(5), Flux.intervalMillis(50, 100).take(5))
                .toStream()
                .forEach(System.out::println);
```
java123456
8. flatMap 操作符使用示例
```java
private static void flatMap() {
        Flux.just(5, 10)
                .flatMap(x -> Flux.intervalMillis(x * 10, 100).take(x))
                .toStream()
                .forEach(System.out::println);
        Flux.just(5, 10)
                .flatMapSequential(x -> Flux.intervalMillis(x * 10, 100).take(x))
                .toStream()
                .forEach(System.out::println);
    }
```
java12345678910
9. concatMap 操作符使用示例
```java
private static void concatMap() {
        Flux.just(5, 10)
                .concatMap(x -> Flux.intervalMillis(x * 10, 100).take(x))
                .toStream()
                .forEach(System.out::println);
    }
```
java123456
10. combineLatest 操作符使用示例
private static void combineLatest() {
        Flux.combineLatest(
                Arrays::toString,
```java
                Flux.intervalMillis(100).take(5),
                Flux.intervalMillis(50, 10000).take(5)
        ).toStream().forEach(System.out::println);
        Flux.intervalMillis(100).take(1).toStream().forEach(System.out::println);
    }
```
java12345678

### 6、消息处理

1. 通过 subscribe()方法处理正常和错误消息
```java
private static void subscribe() {
        Flux.just(1, 2)
                .concatWith(Mono.error(new IllegalStateException()))
                .subscribe(System.out::println, System.err::println);
    }
```
java12345
2. 出现错误时返回默认值
```java
private static void onErrorReturn() {
        Flux.just(1, 2)
                .concatWith(Mono.error(new IllegalStateException()))
                .onErrorReturn(0)
                .subscribe(System.out::println);
    }
```
java123456
3. 出现错误时使用另外的流
```java
private static void switchOnError() {
        Flux.just(1, 2)
                .concatWith(Mono.error(new IllegalStateException()))
                .switchOnError(Flux.just(1,3))
                .subscribe(System.out::println);
    }
```
java123456
4. 出现错误时根据异常类型来选择流
```java
private static void onErrorResumeWith() {
        Flux.just(1, 2)
                .concatWith(Mono.error(new IllegalArgumentException()))
                .onErrorResumeWith(e -> {
                    if (e instanceof IllegalStateException) {
                        return Mono.just(0);
                    } else if (e instanceof IllegalArgumentException) {
                        return Mono.just(-1);
                    }
                    return Mono.empty();
```
                })
                .subscribe(System.out::println);
    }
java12345678910111213
5. 使用 retry 操作符进行重试
```java
private static void retry() {
        Flux.just(1, 2)
                .concatWith(Mono.error(new IllegalStateException()))
                .retry(1)
                .subscribe(System.out::println,System.err::println);
    }
```
java123456

### 7、调度器

1. 使用调度器切换操作符执行方式
```java
public static void main(String[] args) {
        Flux.create(sink -> {
            sink.next(Thread.currentThread().getName());
            sink.complete();
```
        })
```java
        .publishOn(Schedulers.single())
        .map(x -> String.format("[%s] %s", Thread.currentThread().getName(), x)).log()
        .publishOn(Schedulers.elastic())
        .map(x -> String.format("[%s] %s", Thread.currentThread().getName(), x)).log()
        .subscribeOn(Schedulers.parallel())
        .toStream()
        .forEach(System.out::println);
    }
```
java12345678910111213

### 8、测试

1. 使用 StepVerifier 验证流中的元素
```java
public void simpleTest() {
        StepVerifier.create(Flux.just("a", "b"))
                .expectNext("a")
                .expectNext("b")
                .verifyComplete();

    }
```
java1234567
2. 操作测试时间
```java
public void testWithTime() {
        StepVerifier.withVirtualTime(() -> Flux.interval(Duration.ofHours(4), Duration.ofDays(1)).take(2))
                .expectSubscription()
                .expectNoEvent(Duration.ofHours(4))
                .expectNext(0L)
                .thenAwait(Duration.ofDays(1))
                .expectNext(1L)
                .verifyComplete();
    }
```
java123456789
3. 使用 TestPublisher 创建测试所用的流
```java
public void withTestPublisher() {
        final TestPublisher<String> testPublisher = TestPublisher.create();
        testPublisher.next("a");
        testPublisher.next("b");
        testPublisher.complete();

        StepVerifier.create(testPublisher)
                .expectNext("a")
                .expectNext("b")
                .expectComplete();
    }
```
java1234567891011

### 9、调试

1. 启用调试模式，使用 checkpoint 操作符
```java
public static void main(String[] args) {
        Hooks.onOperator(providedHook -> providedHook.operatorStacktrace());
        Flux.just(1, 0).map(x -> 1 / x).checkpoint("test").log("wdh").subscribe(System.out::println);
//        Flux.just(1, 0).map(x -> 1 / x).subscribe(System.out::println);
    }
```
java12345

### 10、日志记录

1. 使用 log 操作符记录事件
```java
public static void main(final String[] args) {
        Flux.range(1, 2).log("wangdehui").subscribe(System.out::println);
    }
```
java123

### 11、“冷”与”热”序列

1. 热序列
```java
public static void main(String[] args) throws InterruptedException {
        final Flux<Long> source = Flux.intervalMillis(1000)
                .take(10)
                .publish()
                .autoConnect();
        source.subscribe();
        Thread.sleep(5000);
        source.toStream().forEach(System.out::println);
    }
```
java123456789

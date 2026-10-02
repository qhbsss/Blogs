---
title: "Reactive Programming in Java(四): Reactive in Spring"
source: "https://ata.atatech.org/articles/11000104398?spm=ata.25287382.0.0.6b137536HfCFml"
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

** 6

** 1

** 原创文章

发表到圈儿

[阿里健康技术](https://ata.atatech.org/community/team/186) / [中间件](https://ata.atatech.org/community/team/186?cid=1253) (首发)

**

[刘金龙(诗翁)](https://ata.atatech.org/users/11000276723)

** 字号

** 笔记

** 分享 **

Spring5主推RP,提供了全方位的支持,主要包括提供HTTP接口的 `WebFlux`,发起HTTP请求的 `WebClient`,面向数据读取的 `Spring data` (mongo,redis,Couchbase,Cassandra都有支持,就是没有jpa..),此外还支持WebSocket.对 `Spring Web Reactive` 也提供了mock对象方便测试.  
Spring5支持多种RP框架,此文已 [Reactor](https://projectreactor.io/) 为例.所以涉及到 `Publisher`,用的都是 `Flux` 和 `Mono`.熟悉其他RP框架可以自行脑补对应的 `Publisher`,关于 `Reactor` 的基础知识请阅读我的上一篇文章.  
本文涉及代码都在 `git@gitlab.alibaba-inc.com:ljl133110/spring-boot-reactive-demo.git` 可以下载运行,运行之前请先看下 `README`.

## WebFlux

Spring5开使推出了 `Spring WebFlux`,它是非阻塞的架构,全面支持 [Reactive Streams](http://www.reactive-streams.org/) 和 `back pressure`,兼容了主流的RP框架,并且可以在 `Netty`, `Undertow`, 和 `Servlet 3.1+` 的容器上运行.我们都知道,异步不会比同步消耗的时间少,甚至可能还会稍微增加,但异步可以使用少量的线程处理大量请求,降低硬件消耗,另一方面,RP的函数式写法,可以让代码更精简.Servlet3 就开始支持异步API,这次终于有了像样的支持(虽然默认用 `Netty`).  
`WebFlux` 提供了两种使用方案,一种是和传统的 `Spring MVC` 基本一模一样的 `Annotated Controllers`,另一种是更轻量级的更函数式的 `Functional Endpoints`,这两种方式对RP的支持基本一致,`Functional Endpoints` 额外对 `RequestBody` 有一定的支持,我们后文再展开.这里我们需要注意的是 `Annotated Controllers` 和传统的 `Spring MVC` 框架采用了一模一样的注解,我们在编写代码的时候一定要区分自己是运行在那个web框架下.`WebFlux` 这种基于 `Reactor` 模型的非阻塞式的框架,只提供了一个很小的线程池处理请求,如果你做阻塞操作,可能会导致请求无法处理,这个要特别特别特别注意.

### Annotated Controllers

基于注解的实现和原来的Spring MVC在使用上基本没有区别,他们共用了一套注解.区别是 `WebFlux` 的Controller返回的是Mono或者Flux.先看个简单的实例.

```java
@RestController
@RequestMapping("/annotation/user")
public class UserController {

   private UserService userService;
   public UserController(UserService userService) {
       this.userService = userService;
   }

   @GetMapping("/{id}")
   Mono<UserVO> find(@PathVariable("id") Integer id) {
       return userService.findById(id).map(UserVO::toMe);
   }
}
```

`userService.findById` 返回的类型时 `Mono<User>`,通过 `map` 转化为了 `Mono<UserVO>`,全部代码可以在 [git仓库](https://ata.atatech.org/articles/git@gitlab.alibaba-inc.com:ljl133110/spring-boot-reactive-demo.git),启动程序后,访问 `http://127.0.0.1:8080/annotation/user/1`,返回结果为:

```json
{
id: 1,
name: "jim",
password: "123456",
age: 111
}
```

使用就是这么简单,和传统的 `MVC` 比起来只是返回类型多包了一层Flux或者Mono,完全看不出反应式编程优势,只有当程序复杂以后,RP对性能的提升才比较明显,对比效果可以参考集团架构升级的战果.  
[https://www.atatech.org/articles/104319](https://www.atatech.org/articles/104319)

### Functional Endpoints

这种写法是WebFlux独有,它需要 `HandlerFunction` 去处理HTTP请求,`HandlerFunction` 是一个参数为 `ServerRequest`,返回值为 `Mono<ServerResponse>` 的函数式接口.它基本上完全和注解了 `RequestMapping` 的方法对等,除了不能指定访问URL.URL需要通过 `RouterFunctions.route(RequestPredicate, HandlerFunction)` 指定,具体方法如下:

```java
@Bean
 public RouterFunction<?> routerFunctionUser() {
     return RouterFunctions.route(path("/function/user/{id}"), userHandler::get)
         .andRoute(path("/function/users"), userHandler::all);
 }
```

每个RouteFuntion可以有很多个route,但是为了可读性,自己做个分组可能会好一点.  
下面是 `UserHandler` 的实现:

```
public class UserHandler {

    private UserService userService;
    private UserHandler(UserService userService) {
       this.userService = userService;
    }

    public Mono<ServerResponse> get(final ServerRequest request) {
        Integer id = Integer.parseInt(request.pathVariable("id"));
        Mono<UserVO> user = userService.findById(id).map(UserVO::toMe);
        return ServerResponse.ok().contentType(APPLICATION_JSON_UTF8).body(user, UserVO.class);

    }

    public Mono<ServerResponse> all(ServerRequest request) {
        return ServerResponse.ok().contentType(APPLICATION_JSON_UTF8).body(
            userService.findAll().map(UserVO::toMe), UserVO.class);
    }
}
```

`UserHandler` 里的每个方法都在 `route` 里映射成了一个 `HandlerFunction`,运行程序后,可以访问 `http://127.0.0.1:8080/function/user/1` 查看程序效果,他和Controller的返回完全相同.

通过上面的代码可以看到这种写法更函数式,还有一个优势是可以通过 `ServerRequest.bodyToMono()` 异步的处理RequestBody,这是注解方式无法提供的能力.但是route的写法个人感觉比较麻烦和臃肿,没有注解直观.

### ServerSentEvents

服务器推送事件是服务器持续的向客户端推送消息,是W3C推荐规范,基本IE以外的浏览器都支持,缺点是只能单向推送,没有WebSocket强大.这种模型非常契合反应式编程,在 `Webflux` 中实现也很简单.只要返回一个 `Flux<ServerSentEvent>` 即可,构造 `Flux<ServerSentEvent>` 的代码如下:

```java
@Service
public class PushService {

    public Flux<ServerSentEvent<Integer>> create() {
        return Flux.interval(Duration.ofSeconds(1))
            .map(seq -> Tuples.of(seq, ThreadLocalRandom.current().nextInt()))
            .map(this::create);
    }

    private ServerSentEvent<Integer> create(Tuple2<Long, Integer> data) {
        return ServerSentEvent.<Integer>builder()
            .event("hehe")
            .id(Long.toString(data.getT1()))
            .data(data.getT2())
            .build();
    }
}
```

`Controller` 代码:

```java
@RestController
@RequestMapping("/annotation")
public class PushController {

    private PushService pushService;

    public PushController(PushService pushService) {
        this.pushService = pushService;
    }

    @GetMapping("/push")
    public Flux<ServerSentEvent<Integer>> randomNumbers() {
        return pushService.create();
    }
}
```

`Function` 的代码省略,可查看git仓库,启动程序后,访问  
`http://127.0.0.1:8080/function/push` 或者 `http://127.0.0.1:8080/annotation/push` 可以看到浏览器上展示的数据一直在增加.

## Spring Data

上文说过在反应式编程中不应该出现阻塞,而IO操作往往是阻塞的重灾区,数据读取更是灾区中的灾区,Spring Data是Spring提供的一套读取数据的框架,包括Database,Mongo,Redis等等常用的数据存储容器.Spring5开始对mongo,redis,Couchbase,Cassandra提供反应式支持,但是最常用的JPA(数据库访问)却没有提供支持,可以说是很无奈.我们已Mongo为例看下怎么使用:  
1\. 引入jar包

```xml
<dependency>
           <groupId>org.springframework.boot</groupId>
           <artifactId>spring-boot-starter-data-mongodb-reactive</artifactId>
       </dependency>
```

1. 配置地址  
	这里我们用本地默认端口且没有开启权限校验的mongo

```
spring.data.mongodb.host=127.0.0.1
spring.data.mongodb.port=27017
```

1. 写接口

```java
public interface UserMongoRepository extends ReactiveCrudRepository<User, Integer> {
}
```

一个CRUD就搞定了..Spring data会自动生成相关实现类.再看下调用:

```java
public Mono<User> findById(Integer id) {
       return enableMongo ? mongoRepository().findById(id) : mockRepository.findById(id);
   }
```

把 `application.properties` 里 `demo.mongo.enable` 的值改为 `true`,启动应用后,访问上面的URL,就是从localhost:27017的mongo里读取数据.写到现在,大家应该可以发现,在Spring5中使用Reactive编程,和传统的编程除了返回值多包装了一层,并没有其它额外的工作量.

## WebClient

日常工作中,阻塞的IO调用有两个大头,一个是对各类数据库,文件系统的访问,由Spring data解决,另一个就是RPC.WebClient可以用来解决RPC中的HTTP调用.有了它,终于可以不用忍受apache那个异常臃肿又特别改变构造方法的HttpClient库了.使用方法如下:

```java
public class WebClientTest {

    @Test
    public void testGetUser() {
        WebClient webClient = WebClient.create("http://127.0.0.1:8080");
        Mono<UserVO> result = webClient.get().uri("/function/user/{id}", 1).
            accept(APPLICATION_JSON_UTF8).retrieve().bodyToMono(UserVO.class);
        Assert.assertTrue("id is 1", result.filter(it -> it.getId().equals(1)).hasElement().block());
    }
}
```

运行前,需要先把Web服务启动起来.

## Test

Spring5提供了 `WebTestClient` 对 `WebFlux` 进行测试.它是对 `WebClient` 的一层封装,可以测试任何HTTP请求,也可以绑定到 `WebFlux` 的Controller或者 `RouterFunction` 上进行测试.直接看下代码:

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class UserControllerTest {

    @Autowired
    private UserService userService;
    @Autowired
    private RouterFunction<?> routerFunctionUser;

    @Test
    public void testRealGetUser() {
        WebTestClient client = WebTestClient.bindToServer().baseUrl("http://localhost:8080").build();
        testClient(client, "/annotation/user/1");
    }

    @Test
    public void testControllerGetUser() {
        WebTestClient client = WebTestClient.bindToController(new UserController(userService)).build();
        testClient(client, "/annotation/user/1");
    }

    @Test
    public void testRoutesGetUser() {
        WebTestClient client = WebTestClient.bindToRouterFunction(routerFunctionUser).build();
        testClient(client, "/function/user/1");
    }

    private void testClient(WebTestClient client, String uri) {
        client.get().uri(uri)
            .exchange()
            .expectStatus().isOk()
            .expectBody().jsonPath("id").isEqualTo(1);
    }

}
```

从上面可以看出,只是通过不同的方式去构建 `WebTestClient`,具体测试的时候都是使用 `WebTestClient` 封装好的API.

## 总结

从 [集团升级架构的战报来看](https://www.atatech.org/articles/104319),反应式编程对性能的提升比较明显,但周边设施还不是很完善,阻塞式API还是大行其道,虽然 `Reactor` 和 `RxJava` 都提供了 `publishOn` 来处理阻塞式API的调用(提交到别的线程处理),但是如果稍不注意,就容易走到坑里,全面普及的道路还很漫长.

## 写在后面

反应式编程系列终于从最下面一直介绍到最上面,虽然写的不怎么好,但是看完的同学最少知到了名词,可以自行搜索相关知识,我也算是为反应式编程的普及做了一点点贡献,鉴于集团的架构升级采用的框架是 `RxJava2`,后续的文章可能会开始介绍 `RxJava2` 的使用和原理.我也是一边写,一边学,欢迎大家一起探讨.

## AD Time

国际惯例,给我们的读书群\[独来读往\]打个广告,新群规大幅降低了书籍的要求,读书的频次以及处罚力度.欢迎喜欢读书的小伙伴加入我们,一起交流,一起成长.详见  
[https://lark.alipay.com/growth/notes/ewqntu](https://lark.alipay.com/growth/notes/ewqntu)

END

WebFlux

Annotated Controllers

Functional Endpoints

ServerSentEvents

Spring Data

WebClient

Test

总结

写在后面

AD Time

**

**

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
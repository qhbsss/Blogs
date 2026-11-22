---
title: "【新人视角】TMF3.0 / lattice 光速入门"
source: "https://ata.atatech.org/articles/11000239908?spm=ata.23639746.0.0.336f6642Al2id2"
author:
  - "[[王灿达(舞夜)]]"
published:
created: 2026-11-15
description:
tags:
  - "clippings"
---
TMF 全称 Trade Modularization Framework，而我觉得这三个字母还有另外一层含义：tai ma fan。

相信很多第一次使用TMF的同学会和我有同样的感受。被“业务”、“业务身份”、“能力”、“商业能力”、“域服务”、“拓展点”给弄的一头雾水。还没开始动手实践写代码，就已经在理论层面绕晕了方向。

虽然TMF对新人很不友好，虽然TMF学习曲线陡峭，虽然TMF上手难度较高，但是，找对方向，咱们避虚就实，还是可以曲径通幽，一窥究竟的。

避虚：不去看TMF官方文档那些高大上的定义。

就实：用大白话、接地气、朴实无华的语言简单聊聊TMF。

（ps：文末有完整的示例代码）

## TMF是什么，有啥用？

官方定义：业务管理域与运行域分离的框架，基于此框架定义的规范实施的各领域系统，最终可形成业务全链路管理视角并支撑业务经营管理。

反正我第一次看不能get到TMF是个啥。

简单来说：TMF是开发框架，不是像spring、mybatis这样的技术框架，而是基于技术框架的业务框架。它不解决http请求处理、数据库访问等技术问题，它解决的是开发复杂业务时面临的种种问题。

SO，都有什么问题呢？

官方定义：1）缺少全链路视角的需求管理机制，协同效率低 。2）平台准入门槛高，新小业务无法快速试错 。3）业务与平台没有很好分离，无法支撑业务自助式（Self-Service）发展 。4）缺少可复用业务资产。

嗯，如果是P7的老同学可能读完能理解，但对于刚落地阿里的新同学来说，读完之后真的很难有体感。

简单来说：TMF解决的是能力复用与拓展的问题。复用平台的能力，并灵活拓展平台的能力去满足各行业的需求。

什么是平台？淘宝是平台、数字供应链是平台、阿里云也是平台。平台是横向的，能支持多种业务。

什么是行业？大家电是行业、服装是行业、生鲜食品也是行业。行业是纵向的，需要依赖平台提供的各种能力。

所以问题来了，淘宝支持了那么多的行业，每个行业或多或少都有自己独特的需求啊。那怎么满足各行各业的需求呢？是if-else？是策略模式？还是是模板方法模式？行业代码与平台代码怎么解耦合？怎么灵活拓展？……

TMF就是针对这些问题的一套解决方案。

## 聊聊前置概念：业务、业务身份、域服务、能力、拓展点

说到这些概念，ata上很多人都会推荐阅读 [毗卢](https://yuque.antfin-inc.com/tmf/documents/business-definition) 大佬的系列文章。但我觉得刚开始略读一下就行，不要去深究。因为对于新手来说，首先读完这些文章对于上手开发写代码帮助不大；其次文章内容比较抽象，容易在理论层面迷失。等有了一定的业务积累，再去研究，才会有体感。

对于业务、业务身份，限于能力，我也没办法给出简单明了的定义。但从程序设计的角度去看，业务最终都会转变为需求。暂且就把业务理解为需求的前身。同一个需求针对不同的行业，有着不同的实现方式。以发货中心为例，发货是横向通用性的业务，从淘系卖出的商品都会经由发货中心发货。不通行业的发货需求是纵向定制性的业务，比如有点需要物流有点不需要物流。所有针对同一个的业务（需求），针对不同的场景也有着不同的处理方式。那么如何区分不同的场景呢？这就用到了业务身份。不同的业务身份对应着不同的处理逻辑。

如果同学有了解过DDD相关的知识，对于域的概念肯定也不陌生。如果没有，也没关系，从面向对象的角度出发，这其实就是一次抽象归类。域服务只是定义，具体干活的还得靠能力与拓展点。能力支撑着域服务，一个域服务可能需要几个能力，简单理解为又一次的细分分类。拓展点也是如此，一个能力需要若干个拓展点支持实现，这又是一次细化。不同的业务身份对应着不同的处理逻辑，也可以说为不同的业务身份对应着不同的拓展点。

![](ed8d6c68-3e1b-4a71-9c22-bf5c91061b53.png)

## 先跑起来再说

空说概念总会让人迷茫，试图搞明白各种设计思想、设计理念，这很容易陷入理论的漩涡，不能自拔。理论指导实践，实践又反作用于理论。我们先跑一个tmf的demo，然后再回过头来看看这些理论或许有新的理解和收获。

### 假设一个业务需求

APP1、APP2是两个购物软件，从APP1、APP2卖出的商品都要使用发货中心来进行发货。但是呢，APP1、APP2都有着自己指定的物流服务商。发货时，对于APP1卖出的商品，必须使用APP1指定的物流公司才能发货，APP2亦然。

需求很简单，一个if else就能搞定，但是如果APP1、APP2售卖的商品种类数以千计，不同的商品种类还可能有不同的处理逻辑，再加上来自各方面的各种规则限制，那仅仅靠if else就难以支撑发货中心了。此时就需要一个可以隔离平台与应用的可灵活拓展的框架。

### 程序架构

![](53177558-1146-4e4f-8037-f4e2ace0f1c8.png)

demo-core里是平台的主要业务逻辑；demo-app1里是针对购物软件APP1的定制逻辑；demo-app2亦然；demo-product1是对某类商品的定制逻辑；demo-sdk是拓展点的接口定义与一些相关的数据模型，供demo-core、demo-app1、demo-app2使用。

### 程序入口

把大象装进冰箱共需要三步，使用tmf的主流程也可分为三步：

1. 初始化
2. 构造入参
3. 调用域服务。

```public
public class TMF3DemoApplication {
    public static void main(String[] args) throws Throwable {
        // 1. 初始化
        init();
        // 2. 构造入参，设置BizInstanceId，定义业务身份
        OrderModel orderModel = new OrderModel();
        orderModel.setBizInstanceId("tmf3.demo.app2");
        orderModel.setGoodCategoryId("001");
        // 3. 使用域服务，满足业务需求
        LogisticDomain logisticDomain = new LogisticDomain();
        List<IBizInstance> bizInstances = Lists.newArrayList(orderModel);
        new BizSessionScope(bizInstances) {
            @Override
            protected String _execute() {
                return logisticDomain.chooseLogisticService(orderModel);
            }
        }.invoke();
    }

    private static void init() {
        LatticeRegister latticeRegister = new LatticeRegister();
        latticeRegister.register();
    }

}
```

这三步基本上都是固定的套路，这样看tmf似乎好像也没那么麻烦。其实麻烦的地方不在这，而在于要定义域服务、能力、拓展点。

### 定义域服务

上一小节中使用了`LogisticDomain`这个域来处理不同APP选择不同物流的需求。这小节中就来定义一下这个域服务。

```@domain(code
@Domain(code = LogisticDomain.CODE, name = "物流域")
public class LogisticDomain {
    public static final String CODE = "com.alibaba.tmf3.domain.demoDomain";

    public String chooseLogisticService(OrderModel orderModel) {
        // 服务调用能力
        LogisticChooseAbility ability = LatticeInvoker.getFirstAbility(LogisticChooseAbility.class, orderModel);
        return ability.chooseLogistic(orderModel);
    }
}
```

这里主要使用了@Domain这一注解，来标明这是一个域。物流域提供了选择物流的服务：`chooseLogisticService(OrderModel orderModel)`注意这里的orderModel，要被tmf处理的model一定要有标识业务身份的字段：`BizInstanceId<String> bizInstanceId`;

### 定义能力

其实域服务不是必须的，我们也可以少去这一层抽象，直接调用能力，在tmf3.0的官方demo中就是这样做的。

“能力”相关的代码如下：

```@ability(name
@Ability(name = "物流选择能力")
public class LogisticChooseAbility extends BaseLatticeAbility<IBizInstance, LogisticChooseExt> {
    public String chooseLogistic(OrderModel orderModel) {
        // 入参：业务实体、拓展点Code、lambda表达式 要执行的拓展点的方法
        // 能力 调用 拓展点 --完成--> 选择物流 的需求
        return this.executeFirstMatched(orderModel, LogisticChooseExt.CHOOSE_LOGISTIC, logisticChooseExt -> logisticChooseExt.chooseOne(orderModel));
    }

    @Override
    public LogisticChooseExt getDefaultRealization() {
        return null;
    }
}
```

这里使用`@Ability`注解来标明这是一个“能力”。仔细看代码：`LogisticChooseExt getDefaultRealization()`。这个方法标明了我们可以在定义能力的时候直接给出一个默认拓展实现。其实能力也可以不调用拓展点直接完成业务逻辑的处理。但，若不用拓展点，那干嘛还要用tmf呢？

### 定义拓展点

拓展点就是一个接口

```public
public interface LogisticChooseExt extends BusinessExt {
    String CHOOSE_LOGISTIC = "CHOOSE_LOGISTIC";

    @ExtensionPoint(code = CHOOSE_LOGISTIC, name = "自定义物流选择策略")
    public String chooseOne(OrderModel orderModel);
}
```

### 重头戏：实现拓展点

前文中说道：业务可分为横向业务与纵向业务。比如淘宝、天猫是平台可以立即为横向业务，家电、服装、五金是品类可以理解为纵向业务。横纵交错，就像X轴Y轴坐标定位一样，有了一个个具体的业务点（需求）。

需要注意点是：横向业务与纵向业务时相对的，不是绝对的。以行业的视角来看：淘宝、天猫是横向的，行业是纵向的。但从发货中心来看：发货中心才是横向的，淘宝、天猫、淘特、闲鱼都是纵向的。

所以tmf3.0中的拓展点也可以分为两类：一种是以`@Business`标注的横向拓展点，一种是以`@Product`

标注的纵向拓展点。

此处以APP1对应的横向拓展点为例：

先写个配置类，标明当前这个包是个tmf插件包（拓展点包），并标明哪些BizCode需要交给这个配置类关联的拓展点来处理。

```@business(value
@Business(value = {@BizCode(code = "tmf3.demo.app1"),})
public class App1Plugin extends BusinessTemplate {
}
```

note：这个配置类在tmf2.0中是不存在的，tmf2.0中是一个配置文件。tmf3.0中进行了升级，用注解代替了配置文件。这样一想，是不是有点SpringBoot那味儿了。所以嘛，技术设计都是相通的。

接着写实际的拓展点：

```@templateext(codes
@TemplateExt(codes = "tmf3.demo.app1")
public class APP1LogisticChoose implements LogisticChooseExt {
    @Override
    public String chooseOne(OrderModel orderModel) {
        System.out.print("APP1 选择了 APP1指定物流 ");
        return "APP1指定物流";
    }
}
```

实现拓展点就是实现相关接口。同时要用@TemplateExt注解，来标明这个拓展点的实现对应这哪种业务身份（BizInstanceId）。

APP1写好了，APP2依葫芦画瓢即可。

这时就能根据不同的业务身份来调用不同的拓展点，完成不同的业务处理逻辑了。

![](be36b801-3487-4c42-937d-e1700a440a38.png)

### 又来一个需求

现在有个Q产品在购物应用APP1卖的不错，为了给消费者提供更好的购物体验，在APP1购买Q产品需要指定另外一个物流。那么此时怎么搞呢？这时候就能体现出tmf的灵活拓展能力了。

### 重头戏：再来个拓展点

APP1对应一个业务身份（BizInstanceId），APP2对应一个业务身份，那现在要实现APP1里某个产品的业务需求肯定不能再定义一个新的业务身份了，应该是再原有的业务身份基础上再进行判断。故为了实现上述需求，可以定义一个纵向拓展点。纵向拓展点与APP1这个横向拓展点交错，在其基础上再进行一层判断。

老规矩写个配置类：

```@product(code
@Product(code = Product1.CODE, name = "Product1")
public class Product1 extends ProductTemplate {
    public static final String CODE = "com.alibaba.tmf3.ext.APP2Product";

    @Override
    public boolean isEffect(IProductInput iProductInput) {
        if (iProductInput instanceof OrderModel) {
            OrderModel orderModel = (OrderModel) iProductInput;
            // 通过商品品类Id进行判断
            return orderModel.getGoodCateId().equals("001");
        }
        return true;
    }
}
```

isEffect方法提供了更细粒度的判断方式，判断当前拓展点是否生效。

具体拓展点：

```@templateext(codes
@TemplateExt(codes = Product1.CODE)
public class Product1LogisticsChoose implements LogisticChooseExt {
    @Override
    public String chooseOne(OrderModel orderModel) {
        System.out.print("APP1 选择了  001品类指定物流 ");
        return "APP1 Product 指定物流";
    }
}
```

此时写的不再是具体的业务身份，而是通过`Product1.CODE`与`Product1`配置类关联。

APP1包里配置文件

这个配置文件关联起来了`Product1`与APP1 。以后若APP2有需要，直接再APP2里配置一下即可。

```<?xml
<?xml version="1.0" encoding="UTF-8"?>

<businessManagement>
    <business-config bizCode="tmf3.demo.app1" version="1.0.0" system="demo">
        <template-configs>
            <template-config code="com.alibaba.tmf3.ext.APP2Product">
                <extension-configs>
                    <extension-config extension="CHOOSE_LOGISTIC"/>
                </extension-configs>
            </template-config>
        </template-configs>
        <conflict-priorities>
            <conflict-priority extension="CHOOSE_LOGISTIC">
                <priority>
                    <instance-ref code="com.alibaba.tmf3.ext.APP2Product"/>
                    <instance-ref code="tmf3.demo.app1"/>
                </priority>
            </conflict-priority>
        </conflict-priorities>
    </business-config>

</businessManagement>
```

这样做得好处就是，如果哪天Q产品在APP2也需要指定物流了，那么直接配置即可，无需再次开发。

![](ae234641-71f0-4312-8b9d-432c167741cb.png)

## 总结一下

跑完这个demo，能够对tmf有个大概的感觉，能够体会到它的灵活拓展性。主要是能够理解：域-->能力--->拓展点 这个调用链路，抓住了主干就不怕它的千变万化了。我个人感觉，tmf对新手不太友好很大一份的原因在于其官方文档写的不够通俗易通，故特意写这篇文章，一来是对自己学习的一个总结，二来是希望能够帮助到一些新同学快速上手tmf。

我也在想：为何官方文档写的不够通俗易懂？为何我们一眼看不透官方文档？然后得出如下结论：

写官方技术文档是经过大量具体实例后，归纳总结抽象出的东西。而一个初学者没有这种大量项目的经历，直接看这种 抽象的东西当然难以立即。所以 学习理解的最好方式是从具体的小点开始，慢慢延伸。如果写官方技术文档的人能再提供一个 具体的 白话文的 那种文档是最好不过的了。

但是不能奢求每个项目都能有完备清晰通俗易懂的文档，努力提升自我水平，才是王道！

## 附件：

##### tmf3.0-demo.zip

165.3KB

中
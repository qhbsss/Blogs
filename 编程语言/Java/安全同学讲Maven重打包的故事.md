---
title: "安全同学讲Maven重打包的故事"
source: "https://mp.weixin.qq.com/s/xsJkB0onUkakrVH0wejcIg"
author:
  - "[[唐天龙(唐礼)]]"
published:
created: 2026-08-12
description: "一个好的故事是应该可以打破一个人的部分认知，本文分享了一些思考。"
tags:
  - "clippings"
---
唐天龙(唐礼) 千问AI平台 *2022年10月25日 09:00*

![图片](https://mmbiz.qpic.cn/mmbiz_jpg/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZffL6VwQIj7446QpbAsJbiclArm8clibWvYsXjaklibW9GRCgEEmyZAXUg/640?wx_fmt=jpeg&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=0)

## 一、背景

经过去年的Log4j-core的治理工作，我们通过Maven的依赖仲裁机制，在蚂蚁集团静态代码扫描平台-STC 和资产威胁透视-哈勃2款产品的联动合作下，很好的完成了直接依赖和间接依赖场景下的治理工作。但路还很远，新的场景层出不穷，故事还远远没有结束，我们要做的事情还非常多。

**新的故事**

在今年的某一天，一位好朋友找到了我，给我讲了一个有意思的故事。

"他说他发现他负责的Bu的生产服务器上，有危险版本log4j-core的pom文件和相关的字节码文件。"

听到这里我下意识地说："在主pom的依赖和依赖管理的位置引入安全版本，并且子pom不要写任何版本号就可以了"。已经不知道今年看到多少这种问题了，不自觉的产生了肌肉反应。

"不不不不"，他急促的打断了我，我开始意识到事情应该没那么简单了。

"是业务引入了一个不是很流行的三方Jar包，这个三方Jar包又把log4j的源代码给打进去了(但是没有修改包路径)，并且业务同学由于安全团队给他发了工单，业务同学也按照我们说的方式，重新引入了安全版本的Log4j。这个时候，应用上就同时拥有了安全版本的Log4j和危险版本的。"

讲到这里，我已经听明白了。一个应用同时引入了安全版本的Log4j 和 经过重打包之后的危险版本的Log4j。由于重打包的Jar包并不是很流行，其作者也不会第一时间重新打一个安全版本。这样就造成了短时间重打包版本不能升级的情况下，这个应用到底是安全的，还是不安全的，还是说这个结果是不可预测的？

最后我也是答应我的好朋友尝试研究一下这个问题，争取给他一个满意的答复！

**散落一地的细节**

挂完电话，我把已知的一些细节尝试梳理了一下。此时线上服务的依赖情况应该是下图这个样子。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZaxAQ2q3oEIqHZYribicm6ekD61OnqPppDVMoOmBLS02F42ic4iaiaznNCYA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=1)

**猜想**

业务代码在依赖JDK，安全版本的Log4j和重打包的危险版本log4j时，此时此刻无非就4个猜想的答案。

1.这个时候确定是安全的

毕竟我都引入了安全版本，毕竟重打包是少数。但是这个听起来没什么说服力。

2.这个时候确定是危险的

3.此时应用应该是既危险又安全

第三种带着一点量子力学的味道。此时应用应该是既危险又安全，我们无法直接说是安全还是危险，只能是代码真正运行时的那一刻通过观察得到一个具体的结果。

当调用到某不知名三方Jar的时候，由于他重打包了危险版本，这个时候他会用他重打包的代码。所以是危险的。当业务的代码调用是在不知名的三方Jar之外的范围，这个时候，应用会智能的选择安全版本，这个时候反而安全了。感觉还是有点道理的。

4.此时应用一定是安全或者危险的，但我们缺少一些关键的信息导致我们无法进行预测。

正所谓上帝不掷骰子，背后肯定会有一些其他的关键信息被隐藏了起来。我们现在无法预测结果，本质是因为缺失了这部分信息。

## 二、故事的本质

经过了一段时间的调研，笔者把目光定位到了JVM的类加载器(ClassLoader)和Maven的打包机制上。认为故事的本质在于JVM是按照什么样的偏好对类进行加载以及Maven是如何进行打包的这2个核心命题。

**ClassLoader 类仲裁机制**

从我们开发代码的视角，我们写代码这件事，好像是JVM在按照约定给我们干活。但其实反过来，从JVM的视角，我们写代码本质上是在取悦JVM。那既然是取悦，那么JVM的偏好就显得尤为重要！

JVM中进行类的加载这件事情是由类加载器进行工作的。类加载器进行加载类的时候，除了满足双亲委派机制的条件下，每一个ClassLoader加载的时候都是严格按照每个ClassLoader的classpath的顺序进行加载的，一旦在某个classpath完成了加载，那么后面的classpath便不会再次进行寻找对应的字节码文件。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZV6rJUZG7tcbGgL0vrJNmBgZaCvLDYqibpvqXRxZh4icAkRnSpImiaCrCg/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=2)

ClassPath就是由一群文件目录或者Jar包组成的列表。ClassLoader就是按照图中的列表顺序加载，比如当类加载器在加载 log4j的 org.apache.logging.log4j.core.lookup.JndiLookup 字节码时，按顺序找到图中的黄色Jar包，发现自己找到了,并且经过验证这个classs是合法的字节码时，此时便终止继续向下进行遍历。

**黑盒验证**

笔者对此模型也进行了一个实验，选择对象是fastjson，因为这个依赖比较轻，打包比较快。分别手动打包了一个重打包版本fastjson (dobulepackage)和一个安全版本的fastjson (fastjson-1.2.68-noneautotype)。并且设定好他们的classpath顺序。故意让重打包的版本靠前。笔者这里写了一段代码去加载ParserConfig类，结果输出的是重打包版本的。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZKUYeJbJweEn0wsl26AtnVkIRZOwQyUH8lvjG6fZpmBtpXHHJ2cKicfA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=3)

看到这里，笔者认为，ClassLoader进行类加载时，无论从性能角度还是稳定性角度考虑，按顺序加载这么做都是非常正确的。但是这个时候就会存在当重打包版本万一排名在安全版本之前，就会造成业务同学认为我的代码已经修复了的假象！

于是，故事的核心矛盾就变成了每一个应用的classpath的顺序到底是谁决定的，是怎么决定的？

最后我把视线从ClassLoader转移到了在角落里的Maven上。直觉告诉我，这个秘密藏在Maven中。

**Maven打包机制**

Maven本身是一个开放的基础平台，他是允许其他公司或者某个个体来实现自己的插件。当然，Maven官方也是同样提供了很多官方插件的。

常规的Jar包很多都是通过Maven的打包插件生成的。Jar包的产生要归功于各式各样的打包插件。Springboot打包插件是Spring官方在Maven这个平台上自研的，并且实现了很多魔法。我们今天说的ClassPath的生成信息其实就是藏匿在每一个打包插件中的。

**也就是说，Maven的打包机制决定了ClassPath的顺序，进而决定了相同类的加载顺序。**

接下来我们可以按照 Springboot，以及其他可执行的Fatjar 这2个类别分别进行阐述。因为这2种类型的应用的使用的打包插件是不一样的，所以生成ClassPath的逻辑也是各有千秋，百花齐放。所以接下来我就按照这2种类型分门别类的进行阐述和解释。

**SpringBoot打包**

Springboot在真正运行之前，是会打包成一个Fatjar的。所谓Fatjar就是包含了程序运行期间需要的所有依赖，会把所有的依赖都打入到BOOT-INF/lib目录下。但是这个Fatjar是在基本Jar包格式下扩展出来的，只能适用于Springboot的自定义ClassLoader，普通类加载器是没办法使用的。（下图为Springboot包的作为Jar包方式运行的结构图）

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZjWPHpaPG6DVQRicAMJ7R6Igv5O8WClicOTdkxBrEPjnZ07Qn8njmaoIQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=4)

Springboot在以Jar包方式运行起来的时候，本质上是使用的自定义ClassLoader。由于Springboot在Jar包内做了一些黑魔法，导致ClassLoader可以正常加载BOOT-INF/lib目录下的Jar包，并且会按照Jar文件的entry的顺序生成好ClassPath顺序，加载到ClassLoader的ucp属性中。这个ClassPath的顺序其实跟classpath.idx文件中的顺序其实就是一致的 (注意，Springboot启动其实并没有直接读取classpath.idx文件，而是读取Jar文件的entry的顺序。但效果其实是一样的)。

Springboot的Fatjar里的ClassPath是存放在BOOT-INF下的classpath.idx文件内的，打开文件我们可以一览无余。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZkZscEVJzPglicVPBkloMKxs6T8hMiaibWC2KcTADM2XQsL22AKzlFpl3g/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=5)

这个文件的顺序是直接消费了Springboot bundle下的依赖树的深度遍历结果。因为在Springboot中，我们打包插件是通常是放在bootstrap(每个springboot应用看哪个module打包，主要是看spring-boot-maven-plugin插件的声明所在module)的pom.xml文件内的。假设我们的bootstrap的pom.xml的依赖树如下，那么经过深度遍历之后的顺序为1,4,7,5,2,6,3。最后将这个顺序写入到classpath.idx文件中去。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZza7yFSKRwQkJj4AQs9zPngqKYn6nF9F5LjX31wtVvj3joF7ZE1mRLA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=6)

经过上图我们发现，这种深度遍历对安全来说是致命的，是非常不友好的。因为这种遍历导致很多间接依赖都排在了很多直接依赖之前，倘若1号Jar包下的7号包 是一个重打包版本，我们发现7号包在最终的classpath排名第三，排在了直接依赖2和3之前。这是非常危险的。也就是说，如果业务同学的2或3是安全的修复版本，同样也被一个不知名的间接依赖的重打包的危险版本进行管控了。

看到这里，有些同学会自己主动检查一下自己的Jar包，但是发现自己的Springboot jar包里并没有上文提到的classpath.idx文件。这是因为上面的classpath.idx是在Springboot的打包插件 2.3版本之后才加入的。

那么如果我的Springboot版本低于2.3之前，我的Fatjar的classpath顺序是怎样的呢？

答案其实还是一样的，就是上文我们提到的entry的顺序。下图你会发现其实lib目录跟存在classpath.idx文件的内容的顺序其实是一致的。都是pom的深度遍历结果。(下图左边就是zip文件的文件entry排序，springboot在启动创建类加载器之前会过滤掉不是classes目录和不是BOOT-INF/lib目录)

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZDMDvLHt4plZBQQfefY2BND8lfJqsOqqp6vscHGvcvLoj9Yapia4613A/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=7)

**普通Fatjar**

这里专门把普通FatJar单独拿出来进行阐述

原因在于普通Fatjar和Springboot这种Jar包格式不一样，Springboot把所有的Jar包都放在lib目录下的。这个前面也提到过了，这是一种“不符合规范”的Jar包格式。

真正符合规范的，同时Maven官方也提供了相关打包插件。是将所有依赖的字节码文件的全路径名都以平铺的方式打入到Jar包内的根目录中，如下图。比较流行的插件有maven-shade-plugin 和 maven-assembly-plugin。这2个都是maven官方的。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZH3sRBaEiammjYyRoMXiav4v4JxsdAmWG7jQxzfUDryj5n7oAZTkicyfVA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=8)

在这种平铺的打包方式下，相同全类路径名的class文件，由于文件系统的限制（不允许出现同目录下的相同名字的文件）。天然的保证了在Jar包打完之后就已经实现了竞争。

**在maven-shade-plugin和maven-assembly-plugin插件默认配置中，二者都不约而同的展现出了先打包先优先的原则。相同文件第二次打包时，会检查当前文件目录下是否已存在该文件，如果存在，便舍弃第二次准备打包的文件。**

整个顺序同样是按照打包插件所在的module的依赖树的深度遍历顺序为基础的。以下图为例，打包的顺序为1,4,7,5,2,6,3

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZAX9bFwKTGVTSDe7ficia5bPBYhcUHE8dC3iaawmYiatcePDHHZ5XIWzfIA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=9)

由于Jar包7是安全版本的，但是在依赖树的深度遍历排序中在4之后，导致7的代码没有被打进最终的Fatjar。所以此时Fatjar运行的时候，执行的是危险版本的Jar包4里的字节码文件。

看到这里我们会发现，平铺式的Fatjar和Springboot的顺序生成逻辑是一样的，确实如此。但我们不得不停下来思考下，我既然分开写，那定然存在一些区别，二者的区别是什么呢？

**我这里抛传引玉一下，Springboot的方式会把危险的class字节码和安全的class字节码依旧会打进去，但是平铺式Fatjar这种压根只会选择1个。本质上他们是在竞争的时机不一样，Springboot竞争是在运行时，平铺式Fatjar是在打包时。**

## 三、故事的结局

讲到这里，故事该有个结局了。故事里的应用是一个SpringBoot应用，我们可以看下Jar包内的classpath.idx文件，就知道这个应用到底受不受影响了，进而知道这个应用到底是安全的还是危险的。

文章之初的猜想4是最终的答案。

确实，在调研之初，从体感上我会觉得只有调用到Fatjar内部的代码才会使用重打包版本的字节码，但是事实往往是有惊喜，好故事会打破人的认知。类加载机制的设计推翻了这一切。

## 四、从源码层面看待结论

从源码上我们也可以看出Maven和ClassLoader的机制为什么是这样，而不是单单的他的机制是什么样。因为笔者相信，任何机制都无法保证与时俱进下的先进性，所以笔者认为上文中提到的所有的仲裁机制有一天可能会发生变化，这些结论并非最重要，而是如何调研这些结论更为重要！

前面我们分别介绍了ClassLoader的加载类时的仲裁机制和Maven在打包时对ClassPath的处理。接下来我们寻找下相关的源码进行理解。

**ClassLoader 类仲裁机制的实现**

在JDK8中，我们最常用的其实就是应用类加载器。在应用类加载器中，当Java去加载一个类时，首先会根据ucp的顺序去尝试加载。在JDK9中，类加载器机制出现了一定的变化，这里我们不详细阐述。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZvq4mibrQYkWkHEWNIQZG5E0JQUcYETngNoeUKByAlfl96Jib8qu6JeUA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=10)

一旦加载不到，便会顺着ucp的顺序进行获取下一个jar包。一旦加载的结果var6不为空时，便会直接返回，不会再继续加载了。

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZGZ135QvQg8k2kMBcVm3TjOD5lI7ptAuEuMSlAyV07pbUqMicaDnU3fw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=11)

**Maven打包插件的源码实现**

在maven-shade-plugin 插件中，实现拷贝的能力是使用的IOUtils。如果第二次发生了相同文件的拷贝，这里会提示已经存在一个相同的文件。"We have a duplicate in jar"

![图片](https://mmbiz.qpic.cn/mmbiz_png/Z6bicxIx5naIQTQdTJ5Pyy0kv5rDvmrpZYJxyVQeGGrx41VSgRVicjibsJZAdAZ5GpWZAmQW7TnsxrqUiatQjyacicA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=12)

## 五、思考

这次这个重打包Log4j场景下的故事给我带来了一些额外的思考。我觉得一个好的故事是应该可以打破一个人的部分认知的。在我调研这个故事之前，我其实心里更多的认为是重打包的危险版本并不会生效，只会在调用重打包范围内代码时才可能生效。现在想想虽然有些可笑，但却不乏收获。

我主要有以下3点思考尝试分享给大家。

**尝试去对看似合理的事物保持猎奇**

很多事情在现有的技术体系下看似是合理的，就好比00后出生的小孩，他可能觉得移动支付天然就应该是这个样子。在我没有接触到蚂蚁STC之前，我也一样的认为在IDEA中，点一下函数的调用就可以跳转到函数的实现是一件很普通不过的事情。后来在做蚂蚁STC这个产品之后，我发现这背后要处理的工作非常之大，要考虑到各种函数情况下的函数关系，变量关系的构建，可以说非常的复杂。

只有保持猎奇，才有可能挖掘出事物的本源。

**用技术去反向牵引思考**

我一直很反对为了思考而思考。我觉得好的思考应该是主动的，而非被迫的。我觉得技术本身是可以牵引一个人去思考的，当然不仅技术可以做到牵引思考。

只有技术慢慢深耕，才会看到一些之前没有看到的视角和盲区，才会自然而然的引发对这片盲区的思考，以及会站在之前的视角尝试去思考现在已经发现的盲区，试问自己该如何能更早的发现这片盲区。

**去成为领域专家而不是岗位专家**

可以给自己的岗位下一个角色的定义，去用边界来描述自己的岗位。但不要给自己设定边界，更不要给自己的领域设定边界。

人们认识这个世界，发现这个世界不过几千年而已。在这几千年的沉淀下，我们人类诞生了语言，数学，相对论等等无数优秀之作。但我们所说的数学家也好，物理学家也好依旧是按照人的想法去描述这个世界。

但这个世界并不是按照人类所说的这些分门别类的学科进行运转的，我们设定这些学科仅仅是方便我们自己去理解。方便我们理解的初心不要成为现实中的绊脚石。故不要给自己轻易定下条条框框。

## 附录

#### 1、Maven的源码地址

https://archive.apache.org/dist/maven/maven-3/

#### 2、SpringBoot的打包插件源码地址（托管在Springboot源码中）

https://github.com/spring-projects/spring-boot

3、SpringBoot的打包插件官方文档

https://docs.spring.io/spring-boot/docs/current/reference/html/executable-jar.html

#### 4、maven-shade-plugin 插件源码地址

https://github.com/apache/maven-shade-plugin

#### 5、maven-assembly-plugin插件源码地址

https://github.com/apache/maven-assembly-plugin

往期推荐

1.[聊一聊分布式锁的设计模型](http://mp.weixin.qq.com/s?__biz=MzIzOTU0NTQ0MA==&mid=2247510452&idx=1&sn=60ac84d7c70df435a40c0143aa422890&chksm=e92a94bbde5d1dadb6f3514d2abc92a3cd755cb5c5c56f723629216ab531bb375777f5e5d000&scene=21#wechat_redirect)

2.[阿里10年沉淀｜那些技术实战中的架构设计方法](http://mp.weixin.qq.com/s?__biz=MzIzOTU0NTQ0MA==&mid=2247508638&idx=1&sn=e6425733e85439970f6b94bbbda2e084&chksm=e92a9f91de5d1687a499d9714eaf6bea292171cafe7d9609cf64009e00e963ff5746cb4e4942&scene=21#wechat_redirect)
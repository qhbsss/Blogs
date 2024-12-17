[TOC]
# 消息队列
把消息队列看作是一个存放消息的容器，当我们需要使用消息的时候，直接从容器中取出消息供自己使用即可。由于队列 Queue 是一种先进先出的数据结构，所以消费消息时也是按照顺序来消费的。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/message-queue-small.png)

参与消息传递的双方称为 **生产者** 和 **消费者** ，生产者负责发送消息，消费者负责处理消息。

![发布/订阅（Pub/Sub）模型](https://oss.javaguide.cn/github/javaguide/high-performance/message-queue/message-queue-pub-sub-model.png)

操作系统中的进程通信的一种很重要的方式就是消息队列。我们这里提到的消息队列稍微有点区别，更多指的是各个服务以及系统内部各个组件/模块之前的通信，属于一种 **中间件** 。
## 消息队列作用

通常来说，使用消息队列主要能为我们的系统带来下面三点好处：

1. 异步处理
2. 削峰/限流
3. 降低系统耦合性

除了这三点之外，消息队列还有其他的一些应用场景，例如实现分布式事务、顺序保证和数据流处理。

如果在面试的时候你被面试官问到这个问题的话，一般情况是你在你的简历上涉及到消息队列这方面的内容，这个时候推荐你结合你自己的项目来回答。

### 异步处理

![通过异步处理提高系统性能](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/Asynchronous-message-queue.png)

将用户请求中包含的耗时操作，通过消息队列实现异步处理，将对应的消息发送到消息队列之后就立即返回结果，减少响应时间，提高用户体验。随后，系统再对消息进行消费。

因为用户请求数据写入消息队列之后就立即返回给用户了，但是请求数据在后续的业务校验、写数据库等操作中可能失败。因此，**使用消息队列进行异步处理之后，需要适当修改业务流程进行配合**，比如用户在提交订单之后，订单数据写入消息队列，不能立即返回用户订单提交成功，需要在消息队列的订单消费者进程真正处理完该订单之后，甚至出库后，再通过电子邮件或短信通知用户订单成功，以免交易纠纷。这就类似我们平时手机订火车票和电影票。

### 削峰/限流

**先将短时间高并发产生的事务消息存储在消息队列中，然后后端服务再慢慢根据自己的能力去消费这些消息，这样就避免直接把后端服务打垮掉。**

举例：在电子商务一些秒杀、促销活动中，合理使用消息队列可以有效抵御促销活动刚开始大量订单涌入对系统的冲击。如下图所示：

![削峰](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/%E5%89%8A%E5%B3%B0-%E6%B6%88%E6%81%AF%E9%98%9F%E5%88%97.png)

### 降低系统耦合性

使用消息队列还可以降低系统耦合性。如果模块之间不存在直接调用，那么新增模块或者修改模块就对其他模块影响较小，这样系统的可扩展性无疑更好一些。

生产者（客户端）发送消息到消息队列中去，消费者（服务端）处理消息，需要消费的系统直接去消息队列取消息进行消费即可而不需要和其他系统有耦合，这显然也提高了系统的扩展性。

![发布/订阅（Pub/Sub）模型](https://oss.javaguide.cn/github/javaguide/high-performance/message-queue/message-queue-pub-sub-model.png)

**消息队列使用发布-订阅模式工作，消息发送者（生产者）发布消息，一个或多个消息接受者（消费者）订阅消息。** 从上图可以看到**消息发送者（生产者）和消息接受者（消费者）之间没有直接耦合**，消息发送者将消息发送至分布式消息队列即结束对消息的处理，消息接受者从分布式消息队列获取该消息后进行后续处理，并不需要知道该消息从何而来。**对新增业务，只要对该类消息感兴趣，即可订阅该消息，对原有系统和业务没有任何影响，从而实现网站业务的可扩展性设计**。

例如，我们商城系统分为用户、订单、财务、仓储、消息通知、物流、风控等多个服务。用户在完成下单后，需要调用财务（扣款）、仓储（库存管理）、物流（发货）、消息通知（通知用户发货）、风控（风险评估）等服务。使用消息队列后，下单操作和后续的扣款、发货、通知等操作就解耦了，下单完成发送一个消息到消息队列，需要用到的地方去订阅这个消息进行消息即可。

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/message-queue-decouple-mall-example.png)

另外，为了避免消息队列服务器宕机造成消息丢失，会将成功发送到消息队列的消息存储在消息生产者服务器上，等消息真正被消费者服务器处理后才删除消息。在消息队列服务器宕机后，生产者服务器会选择分布式消息队列服务器集群中的其他服务器发布消息。

**备注：** 不要认为消息队列只能利用发布-订阅模式工作，只不过在解耦这个特定业务环境下是使用发布-订阅模式的。除了发布-订阅模式，还有点对点订阅模式（一个消息只有一个消费者），我们比较常用的是发布-订阅模式。另外，这两种消息模型是 JMS 提供的，AMQP 协议还提供了另外 5 种消息模型。


## JMS 两种消息模型
### 点到点（P2P）模型

![队列模型](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/message-queue-queue-model.png)

使用**队列（Queue）**作为消息通信载体；满足**生产者与消费者模式**，一条消息只能被一个消费者使用，未被消费的消息在队列中保留直到被消费或超时。比如：我们生产者发送 100 条消息的话，两个消费者来消费一般情况下两个消费者会按照消息发送的顺序各自消费一半（也就是你一个我一个的消费。）

### 发布/订阅（Pub/Sub）模型

![发布/订阅（Pub/Sub）模型](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/message-queue-pub-sub-model.png)

发布订阅模型（Pub/Sub） 使用**主题（Topic）**作为消息通信载体，类似于**广播模式**；发布者发布一条消息，该消息通过主题传递给所有的订阅者。

## 消息中间件推和拉模式对比

### Push推模式：
服务端除了负责消息存储、处理请求，还需要保存推送状态、保存订阅关系、消费者负载均衡；推模式的实时性更好；如果push能力大于消费能力，可能导致消费者崩溃或大量消息丢失
1. Push模式的主要优点是：

- 对用户要求低，方便用户获取需要的信息

- 及时性好，服务器端即时地向客户端推送更行的动态信息

2. Push模式的主要缺点是：

- 推送的信息可能并不能满足客户端的个性化需求

- Push消息大于消费者消费速率额，需要有协调QoS机制做到消费端反馈

### Pull拉模式：
客户端除了消费消息，还要保存消息偏移量offset，以及异常情况下的消息暂存和recover；不能及时获取消息，数据量大时容易引起broker消息堆积。

1. Pull拉模式的主要优点是：

- 针对性强，能满足客户端的个性化需求

- 客户端按需获取，服务器端只是被动接收查询，对客户端的查询请求做出响应

2. Pull拉模式主要的缺点是：

- 实时较差，针对于服务器端实时更新的信息，客户端难以获取实时信息

- 对于客户端用户的要求较高，需要维护位点

## 分布式消息队列技术选型
| 对比方向 | 概要                                                         |
| -------- | ------------------------------------------------------------ |
| 吞吐量   | 万级的 ActiveMQ 和 RabbitMQ 的吞吐量（ActiveMQ 的性能最差）要比十万级甚至是百万级的 RocketMQ 和 Kafka 低一个数量级。 |
| 可用性   | 都可以实现高可用。ActiveMQ 和 RabbitMQ 都是基于主从架构实现高可用性。RocketMQ 基于分布式架构。 Kafka 也是分布式的，一个数据多个副本，少数机器宕机，不会丢失数据，不会导致不可用 |
| 时效性   | RabbitMQ 基于 Erlang 开发，所以并发能力很强，性能极其好，延时很低，达到微秒级，其他几个都是 ms 级。 |
| 功能支持 | Pulsar 的功能更全面，支持多租户、多种消费模式和持久性模式等功能，是下一代云原生分布式消息流平台。 |
| 消息丢失 | ActiveMQ 和 RabbitMQ 丢失的可能性非常低， Kafka、RocketMQ 和 Pulsar 理论上可以做到 0 丢失。 |

>Kafka比RocketMQ吞吐量大的原因？

kafka使用的是零拷贝-sendfile, 把内核态数据发送到网卡, 减少两次拷贝,
而rocketmq使用的是零拷贝-mmp, 把内核态数据映射到用户态, 只减少一次拷贝,
所以kafka吞吐量会大一些。

>为什么rocketmq要用mmp?

因为mmp 在用户态的应用程序可以读到 消息内容 并做一些额外功能(把消息加到死信队列, 补发消息),这是用sendfile不行的。

# Kafka
## Kafka 核心概念
Kafka 将生产者发布的消息发送到 **Topic（主题）** 中，需要这些消息的消费者可以订阅这些 **Topic（主题）**，如下图所示：

![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/message-queue20210507200944439.png)

上面这张图也为我们引出了，Kafka 比较重要的几个概念：

1. **Producer（生产者）** : 产生消息的一方。
2. **Consumer（消费者）** : 消费消息的一方。
3. **Broker（代理）** : 可以看作是一个独立的 Kafka 实例。多个 Kafka Broker 组成一个 Kafka Cluster。

同时，你一定也注意到每个 Broker 中又包含了 Topic 以及 Partition 这两个重要的概念：

- **Topic（主题）** : Producer 将消息发送到特定的主题，Consumer 通过订阅特定的 Topic(主题) 来消费消息。
- **Partition（分区）** : Partition 属于 Topic 的一部分。一个 Topic 可以有多个 Partition ，并且同一 Topic 下的 Partition 可以分布在不同的 Broker 上，这也就表明一个 Topic 可以横跨多个 Broker 。这正如我上面所画的图一样。(**Kafka 中的 Partition（分区） 实际上可以对应成为消息队列中的队列。这样是不是更好理解一点？**)
## Kafka 的多副本机制

分区（Partition）中的多个副本之间会有一个叫做 leader 的家伙，其他副本称为 follower。我们发送的消息会被发送到 leader 副本，然后 follower 副本才能从 leader 副本中拉取消息进行同步。

> 生产者和消费者只与 leader 副本交互。你可以理解为其他副本只是 leader 副本的拷贝，它们的存在只是为了保证消息存储的安全性。当 leader 副本发生故障时会从 follower 中选举出一个 leader,但是 follower 中如果有和 leader 同步程度达不到要求的参加不了 leader 的竞选。

>**Kafka 的多分区（Partition）以及多副本（Replica）机制有什么好处呢？**

1. Kafka 通过给特定 Topic 指定多个 Partition, 而各个 Partition 可以分布在不同的 Broker 上, 这样便能提供比较好的并发能力（负载均衡）。
2. Partition 可以指定对应的 Replica 数, 这也极大地提高了消息存储的安全性, 提高了容灾能力，不过也相应的增加了所需要的存储空间。
### Kafka多副本的同步机制
Kafka 中副本分为：Leader 和 Follower。Kafka 生产者只会把数据发往 Leader， 然后 Follower 找 Leader 进行同步数据。
读写由leader来完成，follower只备份，和leader同步数据，leader发生故障，follower顶上去。
leader副本：可以理解为某个分区中，除了不是副本的那个分区。

Kafka 分区中的所有副本统称为 AR（Assigned Repllicas）。
AR = ISR + OSR
- ISR：表示和 Leader 保持同步的 Follower 集合。如果 Follower 长时间未向 Leader 发送通信请求或同步数据，则该 Follower 将被踢出 ISR。该时间阈值由 replica.lag.time.max.ms参数设定，默认 30s。Leader 发生故障之后，就会从 ISR 中选举新的 Leader。
- OSR：表示 Follower 与 Leader 副本同步时，超时的副本集合。
#### 副本与分区（Patition）和Broker的关系
**eg**:
假设创建4个节点，5个分区，2个副本，那么分区，副本的关系，如下图所示：
```
root@VM_15_71_centos kafka_2.11-1.0.0]# bin/kafka-topics.sh --describe --zookeeper localhost:2181 --topic test-part
[2019-06-28 01:23:50,646] INFO Accepted socket connection from /127.0.0.1:41204 (org.apache.zookeeper.server.NIOServerCnxnFactory)
[2019-06-28 01:23:50,646] INFO Client attempting to establish new session at /127.0.0.1:41204 (org.apache.zookeeper.server.ZooKeeperServer)
[2019-06-28 01:23:50,649] INFO Established session 0x16b99ec1ce1000c with negotiated timeout 30000 for client /127.0.0.1:41204 (org.apache.zookeeper.server.ZooKeeperServer)
Topic:test-part PartitionCount:5    ReplicationFactor:2 Configs:
        Topic: test-part    Partition: 0    Leader: 0   Replicas: 0,2   Isr: 0,2
        Topic: test-part    Partition: 1    Leader: 1   Replicas: 1,3   Isr: 1,3
        Topic: test-part    Partition: 2    Leader: 2   Replicas: 2,0   Isr: 2,0
        Topic: test-part    Partition: 3    Leader: 3   Replicas: 3,1   Isr: 3,1
        Topic: test-part    Partition: 4    Leader: 0   Replicas: 0,3   Isr: 0,3
[2019-06-28 01:23:50,899] INFO Processed session termination for sessionid: 0x16b99ec1ce1000c (org.apache.zookeeper.server.PrepRequestProcessor)
[2019-06-28 01:23:50,904] INFO Closed socket connection for client /127.0.0.1:41204 which had sessionid 0x16b99ec1ce1000c (org.apache.zookeeper.server.NIOServerCnxn)
```
通过以上信息我们可以分析得出：

1. topic:test-part PartitionCount:5    ReplicationFactor:2 Configs:
    一个主题： test-part， 5个分区，2个副本。

2. Partition这一列竖着看，【0，1，2，3，4】共5个分区。

3. Replicas 这一列竖着看，将所有boker的id去重后【[0,2],[1,3],[2,0],[3,1],[0,3]】，得到的集合个数为节点的数目【0，1，2，3】

4. Replicas 这一列，选择任意一行横着看，boker的id的集合大小为，副本的个数，如【0，2】副本数为2。
    梳理存储分布图： 

  ![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/575453000b865ec64c69f9a1b0fa6e16.png)

#### kafka的分区leader副本选举
leader选举思想
按照：在 isr中存活为前提，按照 AR中排在前面的优先顺序
选举规则：在 isr 中存活为前提，按 照AR中排在前面的优先。例如 ar[1,0,2], isr [1， 0 ， 2] ，那么 leader 就会按照1 ， 0 ， 2 的顺序轮询。
**eg**:
1. 创建一个新的 topic ， 4 个分区， 4 个副本

   ![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/6387036346493d6946982c7d8d384cff.png)

2. 查看 Leader 分布情况

   ![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/e51276db7e6e20a8242a0c008f35faf2.png)

3. 停止掉 hadoop105 的 kafka 进程，并查看 Leader 分区情况

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/d06258a21c90cbafb74b3be861c1e583.png)可以看到按照AR中的顺序，3021中3挂掉，0成为主节点。

#### leader与follower的故障处理
**LEO和HW**

LEO （ Log End Offset ）： 每个副本的最后一个 offset ， LEO 其实就是最新的 offset+ 1 。
HW （ High Watermark ）： 所有副本中最小的 LEO 。

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/d697b24066f32f4ff85bb7701319cf0a.png)
##### follower发生故障
1. Follower发生故障后会被临时踢出ISR

2. 这个期间Leader和Follower继续接收数据（不管follower是否还能接收到，二者还是在通信同步数据）

3. 待该Follower恢复后，Follower会读取本地磁盘记录的上次的HW，并将log文件高于HW的部分截取掉，从HW开始向Leader进行同步。

4. 等该Follower的LEO大于等于该Partition的HW，即Follower追上Leader之后，就可以重新加入ISR了。
##### leader发生故障

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures/2dda2bc44f3b89ea854eb7551487b1f5.png)

> PS:注意：**这只能保证副本之间的数据一致性（一个topic有多个patition,每个patition有多个副本），并不能保证数据不丢失或者不重复。**
为了让kafka broker保证消息的可靠性和一致性，我们要做如下的配置：

- 设置 生产者producer 的配置acks=all或者-1。leader 在返回确认或错误响应之前，会等待所有副本收到悄息，需要配合min.insync.replicas配置使用。这样就意味着leader和follower的LEO对齐。
- 设置topic 的配置replication.factor>=3副本大于 3 个，并且 min.insync.replicas>=2表示至少两个副本应答。
- 设置broker配置unclean.leader.election.enable=false，默认也是 false，表示不对落后leader很多的follower也就是非ISR队列中的副本选择为Leader, 这样可以避免数据丢失和数据 不一致，但是可用性会降低。

## kafka如何保证消息有序
### 原因
kafka中一个topic会有多个patition，每个patition接收同一个topic下的不同的消息，消费者读取时可能会从多个patition读取，因此会发生即使消息生产时间有先后但不保序的问题。
### 解决
要保证全局有序只能用一个Patition，局部有序可指定每个Topic对应的Patition。这样会损失性能，但是不可兼顾。
1. 1 个 Topic 只对应一个 Partition。
2. （推荐）发送消息的时候指定 key/Partition。
## Kafka 如何保证消息不重复消费？

### kafka 出现消息重复消费的原因：

- 服务端侧已经消费的数据没有成功提交 offset（根本原因）。
- Kafka 侧 由于服务端处理业务时间长或者网络链接等等原因让 Kafka 认为服务假死，触发了分区 rebalance。

### 解决方案：

- 消费消息服务做幂等校验，比如 Redis 的 set、MySQL 的主键等天然的幂等功能。这种方法最有效。
- 将 **`enable.auto.commit`** 参数设置为 false，关闭自动提交，开发者在代码中手动提交 offset。那么这里会有个问题：**什么时候提交 offset 合适？**
  - 处理完消息再提交：依旧有消息重复消费的风险，和自动提交一样
  - 拉取到消息即提交：会有消息丢失的风险。允许消息延时的场景，一般会采用这种方式。然后，通过定时任务在业务不繁忙（比如凌晨）的时候做数据兜底。
## Kafka 如何保证消息不丢失？
### 生产者丢失消息的情况
#### 原因
生产者(Producer) 调用`send`方法发送消息之后，消息可能因为网络问题并没有发送过去。
#### 解决方案
所以，我们不能默认在调用`send`方法发送消息之后消息发送成功了。为了确定消息是发送成功，我们要判断消息发送的结果。但是要注意的是 Kafka 生产者(Producer) 使用 `send` 方法发送消息实际上是异步的操作，我们可以通过 `get()`方法获取调用结果，但是这样也让它变为了同步操作
```java
SendResult<String, Object> sendResult = kafkaTemplate.send(topic, o).get();
if (sendResult.getRecordMetadata() != null) {
  logger.info("生产者成功发送消息到" + sendResult.getProducerRecord().topic() + "-> " + sendRe
              sult.getProducerRecord().value().toString());
}
```

但是一般不推荐这么做！可以采用为其添加回调函数的形式，示例代码如下：

```java
        ListenableFuture<SendResult<String, Object>> future = kafkaTemplate.send(topic, o);
        future.addCallback(result -> logger.info("生产者成功发送消息到topic:{} partition:{}的消息", result.getRecordMetadata().topic(), result.getRecordMetadata().partition()),
                ex -> logger.error("生产者发送消失败，原因：{}", ex.getMessage()));
```
如果消息发送失败的话，我们检查失败的原因之后重新发送即可！

另外，这里推荐为 Producer 的`retries`（重试次数）设置一个比较合理的值，一般是 3 ，但是为了保证消息不丢失的话一般会设置比较大一点。设置完成之后，当出现网络问题之后能够自动重试消息发送，避免消息丢失。另外，建议还要设置重试间隔，因为间隔太小的话重试的效果就不明显了，网络波动一次你 3 次一下子就重试完了。

### 消费者丢失消息的情况
#### 原因
当消费者拉取到了分区的某个消息之后，消费者会自动提交了 offset。自动提交的话会有一个问题，试想一下，当消费者刚拿到这个消息准备进行真正消费的时候，突然挂掉了，消息实际上并没有被消费，但是 offset 却被自动提交了。
#### 解决方案
**解决办法也比较粗暴，我们手动关闭自动提交 offset，每次在真正消费完消息之后再自己手动提交 offset 。** 但是，细心的朋友一定会发现，这样会带来消息被重新消费的问题。比如你刚刚消费完消息之后，还没提交 offset，结果自己挂掉了，那么这个消息理论上就会被消费两次。

### Kafka 弄丢了消息
#### 原因
**试想一种情况：假如 leader 副本所在的 broker 突然挂掉，那么就要从 follower 副本重新选出一个 leader ，但是 leader 的数据还有一些没有被 follower 副本的同步的话，就会造成消息丢失。**
#### 解决方案
- **设置 acks = all**
解决办法就是我们设置 **acks = all**。acks 是 Kafka 生产者(Producer) 很重要的一个参数。
acks 的默认值即为 1，代表我们的消息被 leader 副本接收之后就算被成功发送。当我们配置 **acks = all** 表示只有所有 ISR 列表的副本全部收到消息时，生产者才会接收到来自服务器的响应. 这种模式是最高级别的，也是最安全的，可以确保不止一个 Broker 接收到了消息. 该模式的延迟会很高.
- **设置 replication.factor >= 3**
为了保证 leader 副本能有 follower 副本能同步消息，我们一般会为 topic 设置 **replication.factor >= 3**。这样就可以保证每个 分区(partition) 至少有 3 个副本。虽然造成了数据冗余，但是带来了数据的安全性。
- **设置 min.insync.replicas > 1**
一般情况下我们还需要设置 **min.insync.replicas> 1** ，这样配置代表消息至少要被写入到 2 个副本才算是被成功发送。**min.insync.replicas** 的默认值为 1 ，在实际生产中应尽量避免默认值 1。
但是，为了保证整个 Kafka 服务的高可用性，你需要确保 **replication.factor > min.insync.replicas** 。为什么呢？设想一下假如两者相等的话，只要是有一个副本挂掉，整个分区就无法正常工作了。这明显违反高可用性！一般推荐设置成 **replication.factor = min.insync.replicas + 1**。
- **设置 unclean.leader.election.enable = false**
> **Kafka 0.11.0.0 版本开始 unclean.leader.election.enable 参数的默认值由原来的 true 改为 false**

我们最开始也说了我们发送的消息会被发送到 leader 副本，然后 follower 副本才能从 leader 副本中拉取消息进行同步。多个 follower 副本之间的消息同步情况不一样，当我们配置了 **unclean.leader.election.enable = false** 的话，当 leader 副本发生故障时就不会从 follower 副本中和 leader 同步程度达不到要求的副本中选择出 leader ，这样降低了消息丢失的可能性。


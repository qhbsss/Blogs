[TOC]
#使用Protobuf处理Kafka消息
## 一、Protobuf 的定义

Google Protocol Buffers（Protobuf）是一种轻量级、高效的数据序列化格式，用于结构化数据的序列化和反序列化。

## 二、Protobuf 的优点

**高效性：**Protobuf 序列化后的二进制数据通常比其他序列化格式（例如Json）更小，并且序列化和反序列化的速度更快。

**简洁性：**Protobuf 使用一种定义消息格式的语法，允许定义字段类型、顺序和规则，消息结构更加清晰和简洁。

**版本兼容性：**Protobuf 支持向前和向后兼容的版本控制，使得在消息格式发生变化时可以更容易的处理不同版本的通信。

**语言无关性：**Protobuf 定义的消息格式可以在多种编程语言中使用，有助于跨语言的通信的数据交换（支持C++/C#/Dart/Go/Java/Kotlin/Python）。

**自动生成代码：**Protobuf 通常和相应的工具一起使用，可以自动生成代码，包括序列化/反序列化代码和相关的类（减少了手动编写代码的工作量，提高效率）。

## 三、Protobuf 在Kafka消息处理中的应用

### 1、model/pom.xml

```xml
<!-- 依赖的库 -->
<dependencies>
    <dependency>
        <groupId>io.grpc</groupId>
        <artifactId>grpc-protobuf</artifactId>
    </dependency>
</dependencies>

<!-- 构建参数，用于自动生成protobuf代码以及生成路径 -->
<build>
    <extensions>
        <extension>
            <groupId>kr.motd.maven</groupId>
            <artifactId>os-maven-plugin</artifactId>
        </extension>
    </extensions>
    <plugins>
        <plugin>
            <groupId>org.xolstice.maven.plugins</groupId>
            <artifactId>protobuf-maven-plugin</artifactId>
            <configuration>
                <protocArtifact>com.google.protobuf:protoc:${protobuf.version}:exe:${os.detected.classifier}
                </protocArtifact>
                <pluginId>grpc-java</pluginId>
                <pluginArtifact>io.grpc:protoc-gen-grpc-java:${grpc.version}:exe:${os.detected.classifier}
                </pluginArtifact>
                <outputDirectory>${project.basedir}/src/main/java</outputDirectory>
                <clearOutputDirectory>false</clearOutputDirectory>
            </configuration>
            <executions>
                <execution>
                    <goals>
                        <goal>compile</goal>
                        <goal>compile-custom</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
```

### 2、定义protobuf 消息结构

protobuf 常用类型：

| protobuf 类型 | java 类型 |
| ------------- | --------- |
| double        | double    |
| float         | float     |
| int32         | int       |
| int64         | long      |
| bool          | boolean   |
| string        | String    |

protobuf 文件定义（*.proto）：

```protobuf
// protobuf版本
syntax = "proto3";
// 代码生成的路径
option java_package = "com.huawei.esight.entfullstackviewservice.kafka.model";
// 代码生成的java类名（注意不能和消息结构名一样，否则编译会报错）
option java_outer_classname = "DemoMsg";

// 消息结构定义
message DemoMsgModel {

  int32 id = 1 [default = 123]; // default用于指定默认值

  string name = 2;

  repeated int32 idList = 3; // 数组，用repeated表示

  map<int32, string> idToNameMap = 4; // Map

  DetailInfo detailInfo = 5; // 嵌套结构

  Role role = 6; // 枚举
}

// 嵌套结构
message DetailInfo {
  int32 subId = 1;
  string subName = 2;
}

// 枚举，包含具体枚举值
enum Role {
  A = 0;
  B = 1;
  C = 3;
}
```

消息文件定义后，maven编译会在指定的目录下生成代码：

![image-20240819161614966](https://wiki.huawei.com/vision-file-storage/api/file/download/upload-v2/WIKI202408194349906/11233491/image.png)

### 3、消息生产者端demo

```java
import com.huawei.esight.kafka.producer.IProducerRecord;
import com.huawei.esight.entfullstackviewservice.kafka.model.DemoMsg;

@Service
public class DemoMsgProducer {
    
    private volatile IProducer<String, byte[]> producer;
    
    public void sendMsg(int id, String name, int subId, String subName) {
        // 配置消息模型参数
        DemoMsg.DemoMsgModel demoMsg = DemoMsg.DemoMsgModel.newBuilder()
            .setId(id)
            .setName(name)
            .setIdList(0, id)
            .setDetailInfo(DemoMsg.DetailInfo.newBuilder().setSubId(subId).setSubName(subName).build())
            .setRole(DemoMsg.Role.A)
            .build();
        producer.send(new IProducerRecord<String, byte[]>() {
            @Override
            public String key() {
                return null;
            }
            
            @Override
            public byte[] value() {
                // 消息模型转字节数组，发送出去
                demoMsg.toByteArray();
            }
            
            @Override
            public String topic() {
                return "demo-topic";
            }

            @Override
            public Integer partition() {
                return null;
            }
        });
    }
}
```

### 4、消息消费者端demo

```java
import com.huawei.esight.kafka.consumer.IConsumerRecord;
import com.huawei.esight.entfullstackviewservice.kafka.model.DemoMsg;

@Service
public class DemoMsgConsumer {
    
    private IConsumer<K, V> pollConsumer;
    
    public void consumeMsg() {
        while (true) {
            try {
                IConsumerRecords<K, V> records = pollConsumer.poll(2000);
                if (records != null && !records.isEmpty()) {
                    // 处理消息
                    oncePollHandle(records);
                }
            } catch (Exception e) {
                LOGGER.error("consume msg failed.");
            } finally {
                ThreadUtil.sleep(2000);
            }
        }
    }
    
    private void oncePollHandle(IConsumer<String, byte[]> records) {
        for (final IConsumerRecord<String, byte[]> record : records.records()) {
            try {
                // 解析消息模型
            	DemoMsg.DemoMsgModel demoMsg = DemoMsg.DemoMsgModel.parseFrom(record.value());
                // 处理消费的消息
                handleMsg(demoMsg);
            } catch (InvalidProtocolBufferException e) {
                LOGGER.error("parse msg failed.");
            }
        }
    }
}
```

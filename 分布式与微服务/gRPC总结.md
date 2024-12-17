## 1.gRPC是什么？

所谓RPC(remote procedure call 远程过程调用)框架实际是提供了一套机制，使得应用程序之间可以进行通信，而且也遵从server/client模型。使用的时候客户端调用server端提供的接口就像是调用本地的函数一样。如下图所示就是一个典型的RPC结构图。

![image](https://wiki.huawei.com/vision-file-storage/api/file/download/upload-v2/WIKI202407174050119/10041024/image.png)

## 2.gRPC的优点     (高性能、轻量化、跨平台、支持流式传输)

1. **高性能和轻量级**：‌gRPC使用HTTP/2作为传输协议，‌支持二进制数据传输，‌相比HTTP 1.1，‌HTTP/2提供了多路复用、‌双向全双工通信和流式处理等高级功能，‌从而显著提高了数据传输效率。‌此外，‌gRPC的数据编码使用Protocol Buffers (protobuf) 格式，‌这种格式的序列化速度比JSON快8倍，‌消息大小减少60%到80%，‌使得gRPC在性能上具有明显优势。‌
2. **跨平台和跨语言支持**：‌gRPC支持多种编程语言，‌包括Java、‌C#、‌Go、‌Python等，‌这使得开发者可以轻松地跨平台、‌跨语言实现远程过程调用。‌与偏向于Microsoft堆栈的NetTCP不同，‌gRPC的跨平台特性使其成为一个更加灵活的选择。‌
3. **易于使用**：‌gRPC的API设计简单易用，‌开发者可以轻松地定义服务和消息类型，‌并使用生成的代码进行开发。‌这种简洁的接口和自动代码生成功能大大简化了开发过程，‌提高了开发效率。‌
4. **支持流式数据传输**：‌gRPC支持多种流式数据传输方式，‌包括客户端和服务器之间的双向流、‌服务器端流、‌客户端流等，‌这些特性使得gRPC非常适合实时数据处理和流媒体应用等场景。‌
5. **安全性**：‌作为基于HTTP/2的协议，‌gRPC天然支持HTTPS，‌提供了数据传输的安全性和身份验证机制，‌保护了通信过程中的数据安全。‌
6. **云原生系统的关注**：‌随着云计算的发展，‌gRPC在云原生系统方面的应用也获得了越来越多的关注。‌其性能优势以及开发方面的轻松度使其成为构建微服务和分布式系统的理想选择。‌

## 3.gRPC的缺点   (不适合开放给外部、依赖HTTP2生态)

1. **不适合面向外部的服务**：
   
   ‌当需要将应用程序或服务提供给外部客户端使用时，‌gRPC可能不是最合适的协议，‌因为大多数外部使用者对gRPC还比较陌生。‌此外，‌gRPC服务的协议驱动、‌强类型化特性可能会降低向外部提供的服务的灵活性。‌
2. **生态系统相对较小**：
   
   ‌与传统的REST/HTTP协议相比，‌gRPC的生态系统仍然相对较小，‌这意味着在使用gRPC时可能无法享受到像REST/HTTP那样丰富的第三方服务和工具支持。‌
3. **不能从浏览器直接调用**：
   
   ‌gRPC Web虽然提供了在浏览器中有限的gRPC支持，‌但它并不支持所有的gRPC功能。‌特别是客户端和双向流的支持有限，‌对服务器流的支持也有限。‌
4. **缺乏连接池和高级网络特性**：
   
   ‌gRPC尚未提供连接池和“服务发现”、‌“负载均衡”等机制，‌这些功能需要开发者自行实现。‌
5. **基于HTTP2的支持问题**：‌
   
   由于gRPC基于HTTP2，‌但绝大部多数HTTP Server、‌Nginx都尚不支持gRPC。‌这意味着Nginx不能将gRPC请求作为HTTP请求来负载均衡，‌而是作为普通的TCP请求处理（‌尽管nginx 1.9版本已开始支持）

## 3.gRPC vs. Restful API （gRPC更高效但不方便开放给外部）

gRPC和restful API都提供了一套通信机制，用于server/client模型通信，而且它们都使用http作为底层的传输协议(严格地说, gRPC使用的http2.0，而restful api则不一定)。不过gRPC还是有些特有的优势，如下：

1. gRPC可以通过protobuf来定义接口，从而可以有更加严格的接口约束条件。
2. 另外，通过protobuf可以将数据序列化为二进制编码，这会大幅减少需要传输的数据量，从而大幅提高性能。
3. gRPC可以方便地支持流式通信(理论上通过http2.0就可以使用streaming模式, 但是通常web服务的restful api似乎很少这么用，通常的流式数据应用如视频流，一般都会使用专门的协议如HLS，RTMP等，这些就不是我们通常web服务了，而是有专门的服务器应用。）

## 4.gRPC使用场景 （微服务场景、移动通信场景、IOT设备通信场景）

- **gRPC的使用场景非常广泛，‌包括但不限于微服务架构、‌跨语言通信、‌移动应用通信、‌实时数据流、‌分布式系统通信、‌容器化环境、‌API后端服务以及IoT设备通信。‌**
  
  1. **微服务架构**：‌gRPC非常适合用于微服务架构中，‌可以用于服务之间的通信，‌提供高性能、‌类型安全和易于维护的通信机制。‌它支持多种编程语言，‌使得不同微服务可以使用不同的编程语言实现。‌
  2. **跨语言通信**：‌gRPC支持多种编程语言，‌因此可以轻松地在不同的技术栈中进行通信。‌这对于跨团队协作、‌不同技术栈的应用程序集成以及构建多语言系统非常有用。‌
  3. **移动应用通信**：‌gRPC的轻量级性能使其成为移动应用与后端服务器之间进行高效通信的理想选择。‌它可以用于移动应用与云服务或后端API之间的通信，‌以获取数据或执行操作。‌
  4. **实时数据流**：‌gRPC支持双向流和服务器端流式处理，‌这使得它非常适合构建实时应用程序，‌如聊天应用、‌在线游戏、‌股票市场数据传输等。‌
  5. **分布式系统通信**：‌gRPC可以用于分布式系统中不同节点之间的通信，‌包括数据同步、‌任务分发和集群管理等场景。‌
  6. **容器化环境**：‌由于其轻量级性能和支持多语言的特性，‌gRPC在容器化环境中非常流行，‌如Docker和Kubernetes。‌它可以用于微服务在容器之间的通信以及容器编排中的服务发现和通信。‌
  7. **API后端服务**：‌许多大型互联网公司使用gRPC来构建其API后端服务，‌因为它提供了高性能、‌可扩展性和易于维护的方式来处理客户端请求。‌
  8. **IoT设备通信**：‌gRPC的低资源消耗和高效性能使其成为连接IoT设备和传感器的理想通信协议。‌它可以用于实时监控、‌数据采集和设备控制。（Telemetry协议）‌

## 5.gRPC的四种请求/响应模式

**1.简单模式(Simple RPC)**

这种模式最为传统,即客户端发起一次请求,服务端响应一个数据

**2.服务端数据流模式（Server-side streaming RPC）**

这种模式是客户端发起一次请求，服务端返回一段连续的数据流。典型的例子是客户端向服务端发送一个股票代码，服务端就把该股票的实时数据源源不断的返回给客户端。

**3.客户端数据流模式（Client-side streaming RPC）**

与服务端数据流模式相反，这次是客户端源源不断的向服务端发送数据流，而在发送结束后，由服务端返回一个响应。典型的例子是物联网终端向服务器报送数据。
这种模式是客户端发起一次请求，服务端返回一段连续的数据流。典型的例子是客户端向服务端发送一个股票代码，服务端就把该股票的实时数据源源不断的返回给客户端。

**4.双向数据流模式（Bidirectional streaming RPC）**

顾名思义，这是客户端和服务端都可以向对方发送数据流，这个时候双方的数据可以同时互相发送，也就是可以实现实时交互。典型的例子是聊天机器人。

## 6.DEMO

#### pom依赖

```xml
        <dependency>
            <groupId>io.grpc</groupId>
            <artifactId>grpc-netty-shaded</artifactId>
        </dependency>
        <dependency>
            <groupId>io.grpc</groupId>
            <artifactId>grpc-protobuf</artifactId>
        </dependency>
        <dependency>
            <groupId>io.grpc</groupId>
            <artifactId>grpc-stub</artifactId>
        </dependency>
        <dependency>
            <groupId>io.grpc</groupId>
            <artifactId>grpc-core</artifactId>
        </dependency>
```

#### protobuf文件定义

```protobuf
syntax = "proto3";

option java_package = "com.huawei.esight.groundcollaborationservice.grpc.protobuf";
option java_outer_classname = "TestProto";
option java_multiple_files = true;

package grpc;

service Test {
  // 简单模式
  rpc report (Entity) returns (Entity) {}

  // 服务端数据流模式
  rpc report2 (Entity) returns (stream Entity) {}

  // 客户端数据流模式
  rpc report3 (stream Entity) returns (Entity) {}

  // 双向数据流模式
  rpc report4 (stream Entity) returns (stream Entity) {}
}

message Entity {
  string clientId = 1;
  bool isSuccess = 2;
  string message = 3;
}
```

需要maven编译生成对应的模型和代码

#### Server demo

```java
public class GrpcServer {

    @SneakyThrows
    public static void main(String[] args) {
        // 初始化 SSL 上下文
        File keyCertChainFile = new File("C:\\Users\\l00639382\\Desktop\\新建文件夹\\cert\\server.cer");
        File keyFile = new File("C:\\Users\\l00639382\\Desktop\\新建文件夹\\cert\\server_key.pem");
        SslContextBuilder builder = SslContextBuilder.forServer(keyCertChainFile, keyFile, "eSight_123");
        SslContext sslContext = GrpcSslContexts.configure(builder).build();

        // 构建 Server
        Server server = NettyServerBuilder.forAddress(new InetSocketAddress(9090))
            // 添加服务
            // .addService(new HelloServiceImpl())
            .addService(new TestImpl())
            .sslContext(sslContext).build();

        // 启动 Server
        server.start();
        System.out.println("服务端启动成功");

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                server.awaitTermination(10, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }));

        // 保持运行
        server.awaitTermination();
    }

}
```

#### 服务端方法实现类：

```java
public class TestImpl extends TestGrpc.TestImplBase {

    @Override
    public void report(Entity entity, StreamObserver<Entity> responseObserver) {
        System.out.println("report end:" + entity.toString());
        Entity response = Entity.newBuilder().setMessage("response message").setClientId("dataReportType").build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void report2(Entity entity, StreamObserver<Entity> responseObserver) {
        System.out.println("report end:" + entity.toString());
        Entity response = Entity.newBuilder().setMessage("response message1").setClientId("dataReportType").build();
        responseObserver.onNext(response);

        Entity response2 = Entity.newBuilder().setMessage("response message2").setClientId("dataReportType").build();
        responseObserver.onNext(response2);

        responseObserver.onCompleted();
    }

    @Override
    public StreamObserver<Entity> report3(StreamObserver<Entity> responseObserver) {
        return new StreamObserver<Entity>() {
            @Override
            public void onNext(Entity value) {
                Entity response = Entity.newBuilder().setMessage("response message1").setClientId("dataReportType").build();
                responseObserver.onNext(response);
                responseObserver.onNext(response);
            }

            @Override
            public void onError(Throwable t) {

            }

            @Override
            public void onCompleted() {

            }
        };
    }

    @Override
    public StreamObserver<Entity> report4(StreamObserver<Entity> responseObserver) {
        return new StreamObserver<Entity>() {
            @Override
            public void onNext(Entity value) {
                Entity response = Entity.newBuilder().setMessage("response message1").setClientId("dataReportType").build();
                responseObserver.onNext(response);
            }

            @Override
            public void onError(Throwable t) {

            }

            @Override
            public void onCompleted() {

            }
        };
    }


}
```

#### 客户端demo：

```java
public class GrpcClient {

    public static void main(String[] args) throws SSLException, InterruptedException, Exception {
        // 使用证书
        File trustCertCollectionFile = new File("C:\\Users\\l00639382\\Desktop\\新建文件夹\\cert\\cacert.pem");
        SslContextBuilder builder = GrpcSslContexts.forClient();
        SslContext sslContext = builder.trustManager(trustCertCollectionFile).build();
        ClientInfo clientInfo = new ClientInfo("f7e4da15-5297-434a-bb32-1f12a53e61f2", "f7e4da15-5297-434a-bb32-1f12a53e61f2");
        // 构建 Channel，如果不用证书，则使用usePlaintext配置
        ManagedChannel channel = NettyChannelBuilder.forAddress("127.0.0.1", 9090)
                .overrideAuthority("neosight")
                .intercept(new ConcurrentClientInterceptor(clientInfo))
                // .usePlaintext()
                .sslContext(sslContext)
                .build();

        // 使用 Channel 构建 BlockingStub
        TestGrpc.TestBlockingStub blockingStub = TestGrpc.newBlockingStub(channel);

        // 场景1：简单模式：构建消息
        Entity entity = Entity.newBuilder().setMessage("test message").setClientId("dataReportType").build();
        // 发送消息，并返回响应
        Entity response = blockingStub.report(entity);
        System.out.println("1: receive message :" + response.getMessage());

        // 场景2：服务端数据流模式
        Iterator<Entity> response2 = blockingStub.report2(entity);
        while (response2.hasNext()) {
            System.out.println("2: receive message :" + response2.next());
        }

        // 场景3：客户端数据流模式
        TestGrpc.TestStub stub = TestGrpc.newStub(channel);
        ReportStreamObserver reportStreamObserver = new ReportStreamObserver();
        StreamObserver<Entity> entity3stream = stub.report3(reportStreamObserver);

        // 给服务端发送消息
        Entity entity3 = Entity.newBuilder().setMessage("response message3").setClientId("dataReportType").build();
        entity3stream.onNext(entity3);


        // 场景4和场景3写法基本相同
        StreamObserver<Entity> entity4stream = stub.report4(reportStreamObserver);

        // 等待终止
        channel.awaitTermination(60, TimeUnit.SECONDS);
    }

    /**
     * 消息流接收对象
     */
    static class ReportStreamObserver implements StreamObserver<Entity> {
        @Override
        public void onNext(Entity entity) {
            System.out.println("report success, message: " + entity.getMessage());
        }

        @Override
        public void onError(Throwable throwable) {
            System.out.println("onError: " + throwable);
        }

        @Override
        public void onCompleted() {
            System.out.println("onCompleted");
        }
    }

}
```

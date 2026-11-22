---
title: "AI Infra全栈性能分析之大模型推理链路解析"
source: "https://ata.atatech.org/articles/11020384042?spm=ata.25287382.0.0.21ee7536iMCDKf"
author:
  - "[[刘派(瑾珝)]]"
published:
created: 2026-10-07
description:
tags:
  - "clippings"
---
联合作者：瑾珝、丞禹、牧原、壹贝、苏染、十雨、浩游、嘉佩

## 1\. 引言

近两年随着ChatGPT兴起，以Transformer为基础、生成式AI为范式的各种大模型训练、推理以及上层应用的需求场景井喷式增长，伴随2025年春节前后deepseek-R1开源而彻底引爆。

训推两场景对于GPU显存、算力、网络、存储等iaas层设施；ACK、PAI\\PAI灵骏等云原生计算平台；Pytorch、TensorFlow、Ray、DeepSpeed等分布式、深度学习框架的依赖差异大，同时性能要求也高，业务\\runtime的环境多样且复杂。这都为我们进行性能分析带来了一定的难度。

对此，本文总结了综合场景下，如何在推理任务的不同阶段中进行性能异常等问题的定界以及相关性能分析的一套方法，并以推理服务客户端到服务端请求的场景展开，结合不同环境以及手动注入的预设差异，进行端到端全链路性能分析方法的概述和解析。

## 2\. 推理场景全链路性能分析方案

## 2.1. 概述

在大模型规模化落地的背景下，推理全链路性能分析是保障服务稳定性、优化资源效能的核心环节。本方案聚焦从Client端用户请求到结果返回的全流程性能瓶颈的分析定位，构建覆盖模型、推理框架、CUDA层、OS Kernel、GPU、CPU、内存、RDMA网络等多维度分析体系，旨在实现毫秒级的延迟分析。

下文基于Ray分布式框架与vLLM推理引擎的环境，构建八层观测栈：Client Networks → API Server → Tokenizer → Prefill/Decode → CUDA API → GPU Kernel → PCIE传输 → RDMA网络。

![](d86071b7-cc9e-4ba9-a8d5-898694e6c6bd.png)

接下来会从Client Network、CPU调度、Memory使用、GPU计算、RDMA传输五个模块，进行多维度性能指标采集分析说明。

<table><colgroup><col width="399"> <col width="468"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>模块</p></td><td rowspan="1" colspan="1"><p>分析工具</p></td></tr><tr><td rowspan="1" colspan="1"><h2>Client Network</h2></td><td rowspan="1" colspan="1"><p>Tcpdump、Wireshark</p></td></tr><tr><td rowspan="1" colspan="1"><p>CPU</p></td><td rowspan="1" colspan="1"><p>py-spy、perf</p></td></tr><tr><td rowspan="1" colspan="1"><p>Memory</p></td><td rowspan="1" colspan="1"><p>Changeplus、NC、CLI</p></td></tr><tr><td rowspan="1" colspan="1"><p>GPU</p></td><td rowspan="1" colspan="1"><p>Nsight System、Nsight Compute</p></td></tr><tr><td rowspan="1" colspan="1"><p>RDMA</p></td><td rowspan="1" colspan="1"><p>eadm、perftest、齐天监控、灵机</p></td></tr></tbody></table>

## 2.2. Client Network Profiling

### 2.2.1. 使用工具

Tcpdump、Wireshark

### 2.2.2. 采集方案

登陆主机（如果是pod部署则切换net ns，或者特权模式pod内抓取）

tcpdump -i any port 8080(模型监听的webserver端口) -s 0 -w vllm.pcap

如果涉及长时间抓取，可以开启轮转参数 -C 100 -W 20 (100m一个，最多20个)

### 2.2.3. 指标分析

使用wireshark分析，可以看各个阶段的耗时，比如说三次握手，post请求到达时间，server端返回时间

![](051aadb0-da49-4231-a99b-520053c3a789.png)

结合netstat也可以看到 流式非流式传输再字节大小上是有所不同的

![](b9ec1ffb-2d12-4c6b-b0f3-4ed6808fa2be.png)

通过抓包还可以看出来一些错误，比如说400的报错

99

1

2

3

4

5

6

7

8

9

10

11

▶

00:42:39.103966 lo In IP6 (flowlabel 0x2f1f7, hlim 64, next-header TCP (6) payload length: 259)::1.45476 >::1.8080: Flags \[P.\], cksum 0x010b (incorrect -> 0x3ca0), seq 1:228, ack 1, win 512, options \[nop,nop,TS val 1035555403 ecr 1035555403\], length 227: HTTP, length: 227

POST /v1/chat/completions HTTP/1.1

Host: localhost:8080

Authorization: Bearer None

Accept: \*/\*

Accept-Encoding: gzip, deflate

User-Agent: Python/3.12 aiohttp/3.11.12

Content-Length: 199

Content-Type: application/json

0x0000: 86dd 0000 0000 0001 0304 0006 0000 0000

没传server-model-name或者model的目录不对时，可能得到的是400 bad request

9

1

2

3

4

5

6

7

8

9

▶

00:42:39.104745 lo In IP6 (flowlabel 0xfc29b, hlim 64, next-header TCP (6) payload length: 532)::1.8080 >::1.45476: Flags \[P.\], cksum 0x021c (incorrect -> 0x7acf), seq 1:501, ack 427, win 512, options \[nop,nop,TS val 1035555404 ecr 1035555403\], length 500: HTTP, length: 500

HTTP/1.1 400 Bad Request

date: Fri, 14 Feb 2025 08:42:38 GMT

server: uvicorn

content-length: 365

content-type: application/json

{"object":"error","message":"\[{'type': 'missing', 'loc': ('body', 'messages'), 'msg': 'Field required', 'input': {'model': '/model/DeepSeek-R1/', 'prompt': 'Do you know the book Traction by Gino Wickman', 'temperature': 0.0, 'best\_of': 1, 'max\_tokens': 122, 'logprobs': None, 'stream': True, 'ignore\_eos': False}}\]","type":"BadRequestError","param":null,"code":400} \[|http\]

0x0000: 86dd 0000 0000 0001 0304 0006 0000 0000

## 2.3. CPU profiling

大模型推理，乃至训练在内的场景下都是通过Python语言启动任务，如：

9

1

2

3

4

5

6

7

8

▶

\# 以vllm\\sglang推理服务启动场景为例

python -m vllm.entrypoints.api\_server

python -m sglang.launch\_server

\# 以Pytorch ddp训练启动场景为例

python -m torch.distributed.launch

python -m torch.distributed.run

torchrun

后根据模型的训练框架使用Pytorch或TensorFlow等深度学习框架加载模型，并通过框架内置的高性能c++ Shared Library到指定的Host或Device上进行计算。调用链路上涉及如下图所示的Python -> c++ -> cuda -> GPU的调用栈。

对于这类程序，网上各种多到令人眼花缭乱profiler工具对于上述场景的支持程度也有所不同。

![](94562357-b780-4997-885b-3662cc50fb39.png)

### 2.3.1. 采集工具

如下图（图片来自网络）所示例举了较为常见的若干个cpu profiler工具，对于大模型推理场景，经过实践观测，这里主要推荐2个工具，py-spy以及perf。

![](60477e5f-b314-456f-b3de-4c2f9c12927c.png)

py-spy是Python线程profiler，与其他观测Python线程调用栈的工具相比，可以额外观测c++拓展的调用栈，对于我们观测性能问题堆栈调用：从自定义训推任务xx.py -> Pytorch -> libtorch.so\\libcuda.so，都是可以覆盖到的，文档参考： [https://github.com/benfred/py-spy](https://github.com/benfred/py-spy) ，本文场景中vllm推理框架对于CPU调用栈的采集也是采用的这个开源库。

perf是系统级profiler，我们主要用来观测训推中的CPython解释器的调用栈以及C/C++拓展的调用栈和纯C/C++线程，但不涉及解析Python函数的调用栈，文档参考： [https://github.com/linux-doc/linux/tree/master/tools/perf](https://github.com/linux-doc/linux/tree/master/tools/perf) 。

### 2.3.2. 采集方案

9

1

2

3

4

▶

py-spy record \\

\-o profile.svg \\ # 火焰图文件名

\--native \\ # c++堆栈

python xx.py

9

1

2

3

▶

perf top -g

perf record -g

perf report -g --stdio

### 2.3.3. 指标分析

#### 2.3.3.1. py-spy

可以通过py-spy看到某个场景中的堆栈调用以及耗时所在。如下图1所示，我们可以看到模型前向传播的forward方法，其中包含了Linear的线性layer以及relu的激活函数，分别看向较深的堆栈可以看到libcublasLt.so进行矩阵乘法以及libcudart.so的LaunchKernel提交任务到GPU运算。

![](0e2cca6b-f119-4d91-8f6a-3d0e8ba40742.png)

如下图2所示，我们可以看到整体耗时在手写数据集图片的灰度图通过ToTensor的转换时耗时较久。

![](2bfa80f3-59b7-492d-b86c-aaadc529afe8.png)

#### 2.3.3.2. perf

对于linux内核的cpu高等场景，可以通过perf命令进行相关的问题观测以及分析

![](e1fc8ee4-75e7-4353-b4b8-52b7f03b4cf1.png) ![](ad4e52cc-2b8a-4d09-a552-e21be6f67218.png)

使用perf record -g可以记录调用栈信息，而后使用perf report -g --stdio分析

![](f19558ce-0cb9-47f3-b645-a70153971ec5.png)

亦可perf生成火焰图观察

![](eba0d72d-d800-480a-9fd0-9a33e1cb8b66.png)

vllm模型multiprocessing的进程perf 火焰图，可以看到cuda的一些信息，这个进程是主要干活的

![](e1dda800-994e-4c67-a28d-c6da14067741.png)

vllm主进程，这里是分活的，容器化部署会导致很多symbol解析不了，目前没有解决方案

![](e04b9cf4-ece4-4b83-833d-3f82e0007d7a.png)

## 2.4. Memory profiling

### 2.4.1. 使用工具

Changeplus 节点监控-内存带宽监控 、NC、/proc/pagetypeinfo 、/proc/buddyinfo

### 2.4.2. 采集方案

NC-dmidecode -t memory 、cat /proc/pagetypeinfo 、cat /proc/buddyinfo

### 2.4.3. 指标分析

memory profiling的场景比较少，结合GPU的场景，我们关注物理机的内存带宽以及内存带宽使用量即可

内存带宽需要登录nc看

![](52e1a497-65bc-4958-a4c8-200d0f74826a.png)

内存带宽使用量 从changeplus看即可

![](8fd5a8ed-82fa-4f33-8129-06f04102f988.png)

如果怀疑内存碎片较多，可以通过查看buddyinfo以及dropcache来规整一下，如下所示，drop\_cache后不同大小的页都有很多释放

![](76b75877-dc1f-44b5-a4fd-493c2146da34.png)

pagetype参考可使用 cat /proc/pagetypeinfo

![](e282de05-8828-4983-9ecd-1f97c247e9e2.png)

## 2.5. GPU profiling

### 2.5.1. 使用工具

[Nsight System](https://docs.nvidia.com/nsight-systems/UserGuide/index.html) 与 [Nsight Compute](https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html#metrics-decoder) 是Nvidia提供的工具。Nsight System 更适合于需要全面了解系统级性能表现的场景，如全面了解 CPU 和 GPU 的协同工作情况、识别并优化应用程序中的瓶颈等；Nsight Compute 更适合于需要深入分析和优化单个 CUDA 内核性能的情况。

![](f22c41b7-f3ff-4346-9472-6a7a53541864.png)

Nsight System (nsys) 核心能力：

- CPU/GPU 调度与执行：提供对 CPU 和 GPU 上的 kernel 调度、负载平衡和执行情况的深入分析。
- GPU 指标：监控GPU利用率、显存使用情况、SM（流多处理器）效率、 warp 调度效率、吞吐量等关键性能指标。
- 系统级可视化：以时序图的形式展示数百万个系统级别的事件，包括 kernel 执行、内存操作、CUDA API 调用和 NCCL 通信等。

Nsight Compute (ncu) 核心能力：

- 详细内核分析：当使用 Nsight System 确定某个 kernel 算子存在性能问题时，Nsight Compute 可以进一步深入分析该 kernel 的性能瓶颈，如Compute Analysis, Memory Analysis等详细的性能指标和优化建议，帮助开发者识别并解决性能问题。
![](7c7356c7-506d-4824-bd6e-651bf959a8ae.png)

工具局限性：

目前Nsight系列工具目前还不支持对已经运行的应用进行实时性能分析，在采集profile时需要以nsys/ncu指定参数重启目标应用，对原始应用会有一定影响。

### 2.5.2. 采集方案

99

1

2

3

4

5

6

7

8

9

10

11

▶

$NSYS\_PATH/nsys profile -w true \\

\-t cuda,nvtx,osrt,cudnn,cublas,mpi,oshmem,ucx \\ #需要追踪的API的trace

\-s cpu --cudabacktrace=kernel:500 -x true \\

\--cuda-memory-usage true \\

\--gpu-metrics-devices all \\ #开启GPU指标采集

\--stats true \\

\--trace-fork-before-exec true \\

\--gpuctxsw true \\

\-o outputfile \\

\--cuda-graph-trace node \\ # 若vllm以graph运行，需要拆开node粒度采集

vllm serve <启动参数> #应用启动命令

### 2.5.3. 指标分析

nsys gpu监控指标：

![](75a0a274-9c2b-4987-8c96-098a45695af6.png)

nsys调用事件/内核算子分析：

![](d7b20482-f02c-46ca-bf15-906ddabcd1be.png)

nsys state统计分析

![](d02407d0-92b8-48f1-9a0e-762b67cabb7a.png)

nsys expert模式分析

![](73cc6396-938e-4c18-95ca-f264ce93180f.png)

ncu kernel性能分析：

![](9bef5a63-9695-4cc0-9a1f-85482edf92b0.png)

## 2.6. RDMA profilling

### 2.6.1. 使用工具

eadm，perftest，齐天监控，灵机

### 2.6.2. 采集方案

#### 2.6.2.1. 流量采集方案

- 在ECS内，可以通过eRDMA驱动默认部署的eadm工具采集。
- 在齐天平台，可以监控ECS的出入rdma流量，以及出入硬转rdma流量。
- 在NC上，可以使用研发运维命令进行流量采集。

#### 2.6.2.2. 丢包采集方案

- 在ECS内，可以通过eRDMA驱动默认部署的eadm工具采集。
- 在齐天平台，可以监控ECS的出入rdma丢包速率，以及出入硬转rdma丢包速率。
- 在NC上，可以使用研发运维命令进行rdma丢包情况采集。

#### 2.6.2.3. 时延采集方案

- 在ECS上通过perftest工具集提供的命令进行rdma时延测试，根据测试结果采集时延指标。
- 在NC上通过iohub-rdma-tools工具查看NC级别的时延。

### 2.6.3. 指标分析

#### 2.6.3.1. eadm

eadm是eRDMA驱动程序默认自动部署的一个用户态的管理工具，是自研的ECS内部的诊断与实时监测工具。

- 实时监测eRDMA设备的实时流量信息

9

1

▶

eadm stat -d erdma\_0 -l

![](90877d17-15f9-400d-9603-19f3b0b7e57b.png)
- 获取eRDMA设备的统计信息。

9

1

▶

eadm stat -d erdma\_0

![](ea7cff9e-91c2-434f-bdf5-54dfc66f6ef5.png)

#### 2.6.3.2. perftest

使用ib\_send\_bw测试来采集机间平均带宽情况

9

1

2

▶

sudo ib\_send\_bw -d erdma\_0 -x 1 -q 10 --run\_infinitely

sudo ib\_send\_bw -d erdma\_0 -x 1 -q 10 --run\_infinitely 10.0.0.125 -F

![](d7f47d88-50d3-4a82-8732-b54edf06f903.png)
- `#bytes`：消息大小，测试过程中使用的payload大小，从2字节到8388608字节不等。
- `#iterations`：迭代次数，表示每个消息大小的测试重复了多少次。
- `BW peak[MiB/sec]`：带宽峰值，单位是百万字节每秒，表示整个测试过程中的的带宽峰值，在--run\_infinitely选项开启时不显示。
- `BW average[MiB/sec]`：平均带宽，单位是百万字节每秒，表示测试过程中的平均带宽。
- `MsgRate[Mpps]`：每秒发送的消息数量，单位是百万每秒，表示测试过程中每秒发送的消息数量。

使用ib\_send\_lat测试来采集机间时延情况

9

1

2

▶

sudo ib\_send\_lat -d erdma\_0 -a

sudo ib\_send\_lat -d erdma\_0 -a -F 10.0.0.125

![](a18096c0-aa29-4756-b119-572f9fd55622.png)
- `#bytes`：消息大小，测试过程中使用的payload大小，从2字节到8388608字节不等。
- `#iterations`：迭代次数，表示每个消息大小的测试重复了多少次。
- `t_min[usec]`：最小延迟，单位是微秒，表示在所有测量中记录到的最小延迟时间。
- `t_max[usec]`：最大延迟，单位是微秒，表示在所有测量中记录到的最大延迟时间。
- `t_typical[usec]`：典型延迟，单位是微秒，示在测试中常见的延迟时间。
- `t_avg[usec]`：平均延迟，单位是微秒，表示所有测量值的平均延迟时间。
- `t_stdev[usec]`：延迟的标准差，单位是微秒，表示延迟值的变异程度。
- `99% percentile[usec]`：99%分位数的延迟，单位是微秒，表示99%的测量值都低于这些值。
- `99.9% percentile[usec]`：99.9%分位数的延迟，单位是微秒，表示99.9%的测量值都低于这些值。

#### 2.6.3.3. 齐天监控

齐天当前支持的监控指标有：

- 流量
![](c75a35e2-4893-49c6-893b-640561417c30.png)

包括入方向rdma流量带宽，出方向rdma流量带宽，入方向硬转rdma流量带宽，出方向硬转rdma流量带宽。

- 数据包
![](5f37e348-ff7d-4a2f-a3ef-ef14e53ed252.png)

包括入方向rdma丢包速率，出方向rdma丢包速率，入方向硬转rdma 丢包速率，出方向硬转rdma 丢包速率，入方向硬转rdma 转发速率，出方向硬转rdma 转发速率，入方向rdma转发速率，出方向rdma转发速率。

- 连接数
![](c773ec9d-7a64-40b3-bdef-140387f12c72.png)

包括入方向 rdma session 查找失败数目，出方向 rdma session 查找失败数目，入方向rdma session 更新失败数目，出方向rdma session 更新失败数目，入方向rdma session 更新成功数目，出方向rdma session 更新成功数目。

#### 2.6.3.4. 灵机

整机eRDMA采集指标

- 查看NC网络带宽
![](edf4a9b1-9fe8-4529-a48b-bab7dda4c37a.png)
- 查看丢包重传
![](55a83346-fed8-4374-9389-ae1bb9f48b8a.png)
- 查看网络下半部延时
![](9056d732-6f7e-48eb-9e63-bdcb1e55c64f.png)
- 查看网络拥塞情况
![](7dce8e26-d9f3-480f-90ba-398cfca75bb8.png)

## 3\. 实战分析

## 3.1. 单请求推理差异

### 3.1.1. 环境信息

99

1

2

3

4

5

6

7

8

9

10

11

12

13

14

▶

\# ACK\\ECS均采用如下的实例规格：

ecs.gn7i-c8g1.2xlarge

8 vCPU

30 GiB

GPU：NVIDIA A10

\# 推理及分布式框架版本：

vllm==0.7.2

ray==2.42.1

\# 模型版本，根据单机单卡\\单机多卡\\多机多卡选择了 7B\\14B\\32B的ds蒸馏模型

https://www.modelscope.cn/models/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B

https://www.modelscope.cn/models/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B

https://www.modelscope.cn/models/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B

### 3.1.2. 差异预设与手动注入

9

1

2

3

4

5

6

7

8

9

▶

\# ACK CUDA及驱动相关信息：

NVIDIA-SMI 535.161.07

Driver Version: 535.161.07

CUDA Version: 12.2

\# ECS CUDA及驱动相关信息：

NVIDIA-SMI 550.127.08

Driver Version: 550.127.08

CUDA Version: 12.4

### 3.1.3. GPU基础监控

ACK结合arms Prometheus监控GPU，目前可以采集到较多信息。基础信息参考

![](7f4b4022-6542-4399-9956-7437120e1997.png) ![](8fcb0b07-5979-4c37-babc-e329c3335284.png)

profiling信息及可以多关注的

![](bcbf36e6-039b-4c9c-8a60-b72d94303312.png) ![](3d12903b-8a0f-4b3d-9fa3-54a6803ee74f.png) ![](58876d67-c7e8-41f0-bea0-36e1042b2d23.png)

### 3.1.4. nsys差异细分对比

ack部署环境一次推理请求耗时 17.1s ， egs部署环境一次推理请求耗时14.5s，相差2.6s左右。

#### 3.1.4.1. 初步分析时间差异

从nsys查看stats数据，可以看到耗时差异最大的cudaMemcpyAsync，一次问答中共调用11793次。

![](a37f0fad-c285-455c-a3b8-0ba5790a04f4.png)

从event视角对cudaMemcpyAsync进一步拆分， 可以看到耗时差异最大的调用分别是ack 一次调用31ms， ecs 一次调用26ms, 两个系统都是共调用512次 。正好对应两个系统的差异 5ms\*512=2.5s 。

![](6067a97f-8ddf-46e9-82e7-79b56ddd2a5e.png)

从mem拷贝到token生成的decode过程，expert模式可以看到每次从device显存到peagable内存的传输字节为8B，刚好对应512个token的处理。

![](e1e1d381-c907-4f3d-82b1-d4fc1cdc7b4b.png)

#### 3.1.4.2. 分析CPU与GPU耗时

对cudaMemcpyAsync分析CPU耗时，发现两个系统中的latency是造成事件处理差异的主要原因：

![](318913a8-b6cf-4579-9300-779304f30d07.png)

何为latency? 简单理解，就是CPU耗时与GPU耗时的差异。 CUDA API中记录的duration 是从cpu开始调用kernel， 执行kernel lancher, 提交kernel给GPU，经历队列等待，最终GPU执行结束时间。 而latency代表的是从cpu调用开始到gpu中开始执行计算之间的等待时间。

从HW角度分析，同一个correleationID 的cudaMemcpyAsync， 在GPU的执行时间只有1.3us, API调用中的duration主要是由于latency延迟。

![](f4658503-1b16-42e7-bce2-98a236cf6844.png)

#### 3.1.4.3. 分析CPU latency原因

继续分析latency的原因，可以看到graph执行时长正好对应cudaMemcpyAsync 的latency等待时间，而其他算子的GPU耗时都在us级别。

![](288a09e0-f2a7-4557-abaa-ff4b69a2c731.png) ![](5daadd5d-96fb-4a73-909c-3a90a70aecde.png)

而点击所有event观察其对应的CPU耗时与GPU耗时，可以发现所有在graph 执行期间被CPU调用的算子，都需要等待graph计算完成方可执行。

![](992a937f-8bba-4b21-9352-db6711de9da8.png)

阶段分析总结：ACK与ECS两个系统推理一次问答共需要输出512个token, 每个token的推理都需要一次cudagraph计算，而cudagraph在两个系统中分别需要31ms/26ms，执行一次cudagraph的5ms差异造成了5ms\*512=2.6s的总差距。

### 3.1.5. GPU Kernel分析

调整nsys采集参数，--cuda-graph-trace node ，将graph打开观察具体kernel算子：

![](bbe2fbd3-710e-40e6-a5a1-9d33d7fa79dd.png)

对比两个系统的cudagraph内部kernel算子，发现kernel2这个算子的耗时差异在每个token的推理时间差异总占比2.8ms/5ms 。

![](f7e7af96-f996-4a12-a6db-245dcbd0f7bd.png)

99

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

▶

void cutlass::Kernel2<cutlass\_80\_tensorop\_bf16\_s16816gemm\_relu\_bf16\_256x64\_32x4\_tn\_align8>(T1::Params)

Begins: 97.3425s

Ends: 97.343s (+497.249 μs)

grid: <<<8, 19, 4>>>

block: <<<128, 1, 1>>>

Launch Type: Regular

Static Shared Memory: 0 bytes

Dynamic Shared Memory: 81,920 bytes

Registers Per Thread: 224

Local Memory Per Thread: 0 bytes

Local Memory Total: 101,449,728 bytes

Shared Memory executed: 102,400 bytes

Shared Memory Bank Size: 4 B

Graph Node Id: 446676598806

Theoretical occupancy: 8.33333 %

Launched from thread: 116081

Latency: ←1.130 ms

Correlation ID: 746644

Stream: Default stream 7

提取其中一个kernel2算子分析，由于kernel2来自cutlass标准库，两个系统中引用的参数都是一致的，cutlass\_80\_tensorop\_bf16\_s16816gemm\_relu\_bf16\_256x64\_32x4\_tn\_align8，算子本身的可调优空间有限，大概率是两个系统的CUDA驱动版本不一致带来的标准算子的执行时间差异。

![](fc3d4392-a961-4838-b26b-1570f3fc04e6.png)

## 3.2. 单机多卡看tp nvlink

声明 ：本次模拟环境中，双卡之间p2p not supported，GPU之间通信采用的PCIE PHB方式。

![](dbf546fa-e50a-4831-8dd3-5007da5ad7e0.png) ![](b123bd3e-36c6-4b14-8858-e5d9221f6cbc.png)

在排查多卡通信性能时，可先采用nvidia-smi topo指令查看机器中多卡之间的拓扑，如nvlink、p2p等获取机器多卡通信拓扑概览信息。

99

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

21

22

23

24

25

26

27

28

29

30

31

32

33

34

35

36

▶

\# nvidia-smi topo

topo -- Display topological information about the system.

Usage: nvidia-smi topo \[options\]

Options include:

\[-m | --matrix\]: Display the GPUDirect communication matrix for the system.

\[-mp | --matrix\_pci\]: Display the GPUDirect communication matrix for the system (PCI Only).

\[-i | --id\]: Enumeration index, PCI bus ID or UUID. Provide comma

separated values for more than one device

Must be used in conjuction with -n or -p.

\[-c | --cpu\]: CPU number for which to display all GPUs with an affinity.

\[-n | --nearest\_gpus\]: Display the nearest GPUs for a given traversal path.

0 = a single PCIe switch on a dual GPU board

1 = a single PCIe switch

2 = multiple PCIe switches

3 = a PCIe host bridge

4 = an on-CPU interconnect link between PCIe host bridges

5 = an SMP interconnect link between NUMA nodes

Used in conjunction with -i which must be a single device ID.

\[-p | --gpu\_path\]: Display the most direct path traversal for a pair of GPUs.

Used in conjunction with -i which must be a pair of device IDs.

\[-p2p | --p2pstatus\]: Displays the p2p status between the GPUs of a given p2p capability

r - p2p read capabiity

w - p2p write capability

n - p2p nvlink capability

a - p2p atomics capability

p - p2p pcie capability

\[-C | --get-numa-id-of-nearby-cpu\]: Displays NUMA ID of the nearest CPU for a GPU

Used in conjunction with -i which must be a single device ID.

\[-M | --get-numa-id-of-nearby-mem\]: Displays NUMA ID of the nearest memory for a GPU

Used in conjunction with -i which must be a single device ID.

\[-gnid | --gpu-numa-id\]: Displays NUMA ID of the specified GPU

Used in conjunction with -i which must be a single device ID.

### 3.2.1. NCCL观测

NCCL是Nvidia的GPU多卡通信框架，以在PCIe、Nvlink、InfiniBand等实现较高的通信速度。使用nsight system ui可以观察NCCL的event 如Allreduce, Broadcast, Collnet等通信方法的时序、耗时等。以此作为切入点，进一步分析nvlink、p2p等是否存在性能瓶颈。 ![](c1bfdf29-0b6b-4506-9754-884f7330d88e.png)

NVTX通常用于在代码中打点加注释采集应用级别的上下文信息与性能， NCCL的活动目前看默认支持经过NVTX 进行检测，可在“stats system view”中查看其push/pop信息等。

![](4d9090cc-0190-4820-b5c6-0eaa0696fb56.png)

结合NCCL原理分析监控中NCCL事件，监控中包含NCCL中的BroadCast、AllReduce，工作原理如下图所示

BroadCast：

![](31cbad43-a1c6-4821-9718-50b2c572e313.png)

AllReduce：

AllReduce操作包含传输与sum计算，充分利用gpu的传输和计算能力，实现并行

![](aed7396e-3d17-411c-b651-526c95608d02.png)

在推理的过程中，NCCL可以用在传输参数，传输完成后开始调用算子计算，计算结束再调用NCCL传输参数，结合如下监控图分析，allreduce操作耗时174us，allreduce后紧跟计算操作，gpu无空闲，计算资源充分利用。

![](058902cf-506a-4fda-8bb9-8c2d6643d862.png)

### 3.2.2. p2p nvlink观测

查看机器中p2p nvlink 能力： nvidia-smi topo -p2p <r|w|n|a|p> ![](960af8b9-58ac-43ad-8d89-49a0b4a4cfdb.png)

NVIDIA 社区中提供了p2p测速脚本 [p2pBandwidthLatencyTest](https://github.com/NVIDIA/cuda-samples/blob/master/Samples/5_Domain_Specific/p2pBandwidthLatencyTest/p2pBandwidthLatencyTest.cu) ，用于测试GPU卡之间的带宽与延时。由于没有申请到支持p2p的GPU机器，无法进行实战演示，下图脚本采集结果来自网络。

![](fe421706-c6a6-46d1-a35b-40510d4d16cd.png)

## 3.3. 多机单卡看pp rdma

### 3.3.1. rdma观测

调整nsys采集参数，--nic-metrics=true --enable network\_interface ，观察推理中网口发送和接收的字节数：

![](3636cdf4-206f-4abd-8851-d284ddf415c5.png)

在齐天监控上，查看head节点、worker节点在推理过程中的流量和数据包指标，单次推理过程，机间erdma流量平均流量较小。head节点在单次推理中的流量指标：

![](ea2ba861-5a67-4351-98bd-6129aa632bd8.png)

worker节点在单次推理中的流量指标：

![](ed1385c5-e7a8-455b-b31e-d6e60f8ad1f7.png)

head节点在单次推理中的数据包指标：

![](40f2ecb1-a8c7-4a3c-b627-3dca951efe59.png)

worker节点在单次推理中的数据包指标：

![](fa079ba2-0340-40f4-bd74-882086b5b16f.png)

NC层面上观察链路情况，aver\_inflight较aver\_cwnd存在较大差距，单次推理所占用的带宽资源较少：

![](ec9aaf09-47c3-458e-a3fe-c78526ad6774.png)

链路时延处于正常水平：

![](20949855-dad2-4c94-a5f5-73f26dbb2e19.png)

## 4.总结

本文从推理过程的全链路出发，梳理出了一套覆盖模型、推理框架、CUDA层、GPU、OS Kernel（CPU、内存）、RDMA网络的多维度的推理性能分析方案，希望可以帮助到更多的同学和用户。本系列后续会在GPU、网络、存储、CUDA、算法、框架等单技术领域，持续沉淀性能分析相关文档。同时也会补充梳理训练、模型加载等场景的性能分析方案，为大模型全生命周期提供性能保障方案。

中
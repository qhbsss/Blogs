---
title: "AI Infra （基础设施）"
source: "https://ata.atatech.org/articles/11020686003?spm=ata.23639746.0.0.39f24cf87GV0Un#ZWU2YTNh"
author:
  - "[[周亮(兵烽)]]"
published:
created: 2026-10-07
description:
tags:
  - "clippings"
---
## 1\. 绪论

本培训材料系统性地介绍 AI 基础设施全栈架构，该架构分为 五个层级，从底层的硬件基础设施到顶层的应用服务，逐层构建起支撑大模型训练、部署与运营的完整技术栈。

五层架构覆盖了从物理硬件基础到终端用户应用服务的所有关键组件，包括算力、芯片加速、云平台、模型开发工具和应用框架。每一层都建立在下层之上，形成紧密耦合的技术体系。

![](4b3fb6d1-fd1e-4af4-88b8-9a5ea3b3a1bb.png)

图 1：AI 基础设施全栈架构总览

下表总结了五层架构及其核心要素：

<table><colgroup><col width="80"> <col width="160"> <col width="213"> <col width="170"></colgroup><tbody><tr><td rowspan="1" colspan="1"><p>层级</p></td><td rowspan="1" colspan="1"><p>名称</p></td><td rowspan="1" colspan="1"><p>核心组件</p></td><td rowspan="1" colspan="1"><p>关键技术</p></td></tr><tr><td rowspan="1" colspan="1"><p>第一层</p></td><td rowspan="1" colspan="1"><p>算力与硬件基础层</p></td><td rowspan="1" colspan="1"><p>数据中心、GPU集群、CPU服务器、高速网络、分布式存储</p></td><td rowspan="1" colspan="1"><p>InfiniBand、NVMe、液冷散热</p></td></tr><tr><td rowspan="1" colspan="1"><p>第二层</p></td><td rowspan="1" colspan="1"><p>芯片与加速层</p></td><td rowspan="1" colspan="1"><p>AI训练芯片、推理加速卡、高带宽内存、芯片互联</p></td><td rowspan="1" colspan="1"><p>GPU/TPU/NPU、HBM3、NVLink、RDMA</p></td></tr><tr><td rowspan="1" colspan="1"><p>第三层</p></td><td rowspan="1" colspan="1"><p>平台与中间件层</p></td><td rowspan="1" colspan="1"><p>云平台、容器编排、向量数据库、推理服务</p></td><td rowspan="1" colspan="1"><p>Kubernetes、vLLM、Milvus、Prometheus</p></td></tr><tr><td rowspan="1" colspan="1"><p>第四层</p></td><td rowspan="1" colspan="1"><p>模型与开发层</p></td><td rowspan="1" colspan="1"><p>大模型训练、深度学习框架、模型优化、MLOps</p></td><td rowspan="1" colspan="1"><p>PyTorch、DeepSpeed、LoRA、LangChain</p></td></tr><tr><td rowspan="1" colspan="1"><p>第五层</p></td><td rowspan="1" colspan="1"><p>应用与服务层</p></td><td rowspan="1" colspan="1"><p>大模型应用、AI Agent、API服务、提示词工程</p></td><td rowspan="1" colspan="1"><p>RAG、Function Calling、OpenAI API</p></td></tr></tbody></table>

## 2\. 第一层：算力与硬件基础层

算力与硬件基础层是整个 AI 基础设施栈的物理底座，涵盖数据中心设施、GPU 计算集群、CPU 服务器集群、高速网络设备、分布式存储系统以及供电与散热基础设施。

## 2.1 数据中心基础设施

现代 AI 数据中心需要专为极端功率密度和散热需求设计的专用设施：

- 机房布局：优化的机柜排列，采用冷热通道封闭设计，实现高效气流管理
- 精密空调：专用 HVAC 系统，维持最佳温度（18-27°C）和湿度水平
- UPS 电源系统：不间断电源保障电力切换期间的持续运行
- 配电系统（PDU）：智能配电单元，支持逐插座监控和远程管理
- 消防安全与环境监控：先进的检测系统配合实时传感器网络

## 2.2 GPU 计算集群

GPU 集群是 AI 训练和推理的主要计算引擎，当前主流配置包括：

- NVIDIA H100：80GB HBM3 内存，1200 Gbps 互联，350-560W TDP，配备 Transformer Engine 支持 FP8 精度
- NVIDIA A100：提供 40GB 和 80GB 两种版本，1200 Gbps 互联，400W TDP，第三代 Tensor Core
- 昇腾 910B（华为）：256 TOPS 算力，200GB 内存，代表国产 AI 算力水平

## 2.3 CPU 服务器集群

CPU 服务器承担数据预处理、推理编排和通用计算任务：

- Intel Xeon：企业级处理器，支持 AVX-512 向量化指令集
- AMD EPYC：高核心数处理器，适合并行数据处理
- 鲲鹏 920（华为）：ARM 架构服务器处理器，满足国产化计算需求

## 2.4 高速网络设备

低延迟、高带宽网络对分布式训练至关重要：

- InfiniBand 交换机：单端口提供高达 400 Gbps 带宽，超低延迟（约 1μs）
- RoCE（RDMA over Converged Ethernet）：在标准以太网基础设施上实现 RDMA 能力
- Spine-Leaf 架构：无阻塞网络拓扑，确保所有节点对之间延迟可预测

## 2.5 分布式存储与供电系统

- 全闪存 NVMe 阵列：为训练数据管道提供百万级 IOPS
- 对象存储（OSS/S3）：可扩展存储，用于模型检查点和训练数据集
- 液冷散热（CDU/浸没式冷却）：先进热管理技术，可实现 PUE 低至 1.2

## 2.6 深度架构图

下图展示了第一层的完整深度架构，包含所有子组件：

![](d90d2cc5-7bdc-4dcf-92c4-90402b967c31.png)

图 2：第一层深度架构 — 算力与硬件基础层

## 3\. 第二层：芯片与加速层

芯片与加速层专注于驱动 AI 计算的专用硅片和互联技术，覆盖 AI 训练芯片、国产替代方案、推理加速器、高带宽内存层次、芯片间互联以及 RDMA 网络。

## 3.1 AI 训练芯片

训练大语言模型需要专为矩阵乘法和混合精度运算优化的处理器：

- GPU 架构：NVIDIA GPU 配备 Tensor Core 支持 FP16/BF16/FP8 混合精度训练，CUDA Core 用于通用计算，HBM 内存提供高带宽数据访问
- TPU 架构：Google 的张量处理单元，采用矩阵乘法单元（MXU）、统一缓冲池和脉动阵列设计，专为神经网络负载优化
- NPU 架构：神经网络处理单元，提供专用神经网络加速，功耗更低，适合边缘和嵌入式推理

## 3.2 国产 AI 芯片

中国国产 AI 芯片生态正在快速成熟：

- 华为昇腾 910：支持 FP16/INT8 性能，集成多模态能力，融入华为全栈 AI 解决方案
- 寒武纪（MLU）：提供竞争力的 FLOPS 和优秀的能效比
- 海光 DCU：峰值性能 200P FLOPS，内存带宽超过 200GB/s
- 壁仉科技：推理 FLOPS 200P，训练 FLOPS 20P

## 3.3 推理加速

- NVIDIA L40S：专为 Transformer 模型推理优化，支持 INT8 量化和多模态能力
- Intel Gaudi：专业级推理加速器，性价比竞争力强
- AMD MI300：CDNA 架构，支持大规模多模态推理
- 边缘芯片与 ASIC：低功耗、高效率的定制硅片，用于嵌入式和边缘部署

## 3.4 高带宽内存与芯片互联

- HBM3 内存：3D 堆叠内存，带宽超过 2TB/s，是饲养 GPU 计算管线的关键
- NVLink：900 GB/s 双向带宽，用于节点内多 GPU 通信
- NVSwitch：全互联交换，实现任意 GPU 之间的通信
- CXL 协议：Compute Express Link 实现 CPU-GPU-内存的缓存一致性互联
- RDMA/GPUDirect：跨节点 GPU 内存零拷贝数据传输，绕过 CPU 开销

## 3.5 深度架构图

![](db4d61be-a767-4078-84a8-c504310d46d2.png)

图 3：第二层深度架构 — 芯片与加速层

## 4\. 第三层：平台与中间件层

平台与中间件层提供云基础设施、容器编排、数据管理、推理服务和运维监控能力，是连接硬件层和模型开发层的桥梁。

## 4.1 云平台服务

主流云服务商提供专用的 AI/ML 服务：

- 阿里云 / 腾讯云 / 华为云：国内云平台，提供 GPU 实例、托管 AI 服务和数据合规保障
- AWS / Azure / GCP：全球云平台，分别提供 SageMaker、Azure ML 和 Vertex AI
- 多云管理：跨多个云服务商的工作负载管理工具，用于成本优化和供应商灵活性

## 4.2 容器编排

- Kubernetes (K8s)：核心编排平台，Master 节点（etcd、API Server、Scheduler、Controller Manager）和 Worker 节点（kubelet、kube-proxy、容器运行时）
- Helm：Kubernetes 应用包管理器，简化 AI 工作负载的部署
- Kubeflow：基于 K8s 的 ML 专用工具套件，提供 Notebook、Pipeline、TFJob 和 KFP 等端到端 ML 工作流

## 4.3 向量数据库

向量数据库是 RAG（检索增强生成）和相似度搜索的核心组件：

- Milvus：开源向量数据库，支持十亿级向量和混合搜索
- Weaviate：向量搜索引擎，内置向量化模块
- Qdrant：基于 Rust 的向量数据库，支持高级过滤能力
- Pinecone：全托管 SaaS 向量数据库，API 简单易用
- FAISS：Facebook AI 相似度搜索库，支持 IVF-Flat、HNSW 等多种索引策略

## 4.4 推理服务

- vLLM：高性能 LLM 推理引擎，采用 PagedAttention 实现高效 KV-Cache 管理
- TensorRT-LLM：NVIDIA 深度优化的推理引擎，支持模型专属的 Attention 优化
- TGI（Text Generation Inference）：Hugging Face 的生产级推理服务器
- Triton Inference Server：NVIDIA 多框架服务平台，支持 TensorRT、PyTorch、ONNX 后端，并支持动态批处理

## 4.5 分布式存储与监控运维

- Ceph / MinIO / JuiceFS：分布式存储解决方案，支持块、文件和对象接口
- Prometheus + Grafana：指标采集与可视化，监控 GPU 利用率、吞吐量和延迟
- ELK Stack：集中式日志管理（Elasticsearch + Logstash + Kibana），用于调试和审计
- Jaeger：分布式追踪，用于调试推理请求在微服务间的流转

## 4.6 深度架构图

![](9e4eb784-1805-4b6b-837d-f0adb9be9710.png)

图 4：第三层深度架构 — 平台与中间件层

## 5\. 第四层：模型与开发层

模型与开发层涵盖了在整个生命周期内训练、优化和管理大语言模型所使用的工具、框架和方法论。

## 5.1 大模型训练

分布式训练框架使模型训练能够扩展到数百块 GPU：

- Megatron-LM：NVIDIA 的框架，支持张量并行、流水线并行和数据并行的大规模 Transformer 模型训练
- DeepSpeed：微软的优化库，以 ZeRO（零冗余优化器）Stage 1-3 著称，实现内存高效训练
- Colossal-AI：开源框架，支持多种并行策略，API 友好
- PyTorch FSDP：全分片数据并行，PyTorch 原生分布式训练，支持参数/梯度/优化器状态分片

## 5.2 深度学习框架

核心框架提供编程模型和计算图执行：

- PyTorch：动态计算图 + 即时执行，在研究领域占据主导地位，生产环境采用率也在提升
- TensorFlow：静态图 + 即时模式，通过 TF Serving 和 TFLite 提供强大的生产部署能力
- MindSpore（华为）：统一框架支持动态图和静态图，专为昇腾硬件优化
- PaddlePaddle（百度）：国产框架，拥有丰富的工业级模型库

## 5.3 模型优化

优化技术在保持质量的同时减小模型尺寸和推理成本：

- 量化：将模型权重从 FP32 转换为 INT8/INT4，内存占用减少 4-8 倍，质量损失极小
- LoRA / QLoRA：低秩适配技术，用少量参数实现微调；QLoRA 将 LoRA 与 4-bit 量化结合
- 知识蒸馏：训练较小的“学生模型”模仿较大“教师模型”的行为
- 模型剪枝：移除冗余权重和 Attention Head，减少计算量

## 5.4 MLOps 平台

- Kubeflow / MLflow：端到端 ML 生命周期管理，包括实验追踪、模型注册和部署管道
- DVC（数据版本控制）：将数据集和模型产物与代码一起进行版本控制
- CI/CD 流水线：从 Git 提交到构建、测试、部署的自动化管道
- 模型生命周期：训练 → 评估 → 部署 → 监控循环，支持自动回滚

## 5.5 RAG（检索增强生成）

- LangChain / LlamaIndex：构建 RAG 管道的框架，支持文档加载、切分、向量化和检索
- 文档处理流水线：文档 → 切分 → 向量化 → 向量存储 → 检索 → LLM
- Embedding 模型：将文本转换为稠密向量表示，用于语义相似度搜索

## 5.6 模型仓库

- HuggingFace：最大的开源模型仓库，支持 SafeTensors 格式和社区驱动的模型卡
- ModelScope（阿里）：国内模型仓库，为国内用户提供优化的下载加速

## 5.7 深度架构图

![](94bd2a84-3843-4eaa-922a-5847d4d5488e.png)

图 5：第四层深度架构 — 模型与开发层

## 6\. 第五层：应用与服务层

应用与服务层是最顶层，AI 能力通过应用、智能体、API 和企业解决方案交付给终端用户。

## 6.1 应用场景

- 智能问答系统：基于 RAG 的客服聊天机器人和知识库助手
- 代码生成助手：AI 驱动的编程工具（Copilot/Cursor），提升开发者生产力
- 文档分析处理：自动化处理 PDF、Word 文档和 Excel 电子表格
- 内容创作：AI 辅助的文案写作、海报设计和营销材料生成
- 数据分析 Agent：自然语言接口的商业智能和数据探索

## 6.2 AI Agent 智能体架构

AI Agent 代表了自主 AI 系统的前沿：

- 单 Agent 架构（ReAct/Plan-Execute）：观察 → 思考 → 行动循环，实现逐步推理和工具使用
- 多 Agent 协作（AutoGen/MetaGPT）：多个专业化 Agent 通过 API 通信和共享内存进行协作
- Function Calling：结构化工具调用，使 Agent 能够使用计算器、地图、API 等外部工具
- 记忆管理：短期记忆（上下文窗口）和长期记忆（向量数据库），跨交互维持状态
- Agent 编排：基于决策树的工作流管理，用于复杂的多步骤任务

## 6.3 API 服务网关

- OpenAI 兼容接口：标准化 RESTful 接口（GET/POST/PUT/DELETE），实现无缝集成
- SSE（Server-Sent Events）：流式响应协议，用于实时 Token 生成
- 认证鉴权（OAuth2/JWT）：基于 Token 的安全控制，管理 API 访问权限
- 限流熔断：保护后端推理服务免受过载

## 6.4 提示词工程

- Prompt 模板：结构化提示词模式，确保输出格式一致
- Few-shot 学习：提供示例输入输出对，引导模型行为
- Chain-of-Thought（CoT）：逐步推理提示词，提高复杂任务的准确性
- System Prompt：基于角色的指令，定义 AI 助手的人设和能力边界

## 6.5 应用开发与企业解决方案

- Streamlit / Gradio：快速原型开发框架，用于构建交互式 AI 演示
- FastAPI / LangServe：生产级后端框架，用于 AI API 服务
- 企业解决方案：多租户架构、数据安全与隐私合规、SLA 保障（99.9%+）、成本优化策略
- 系统集成：ERP、CRM 和内部知识库集成，实现企业级 AI 部署

## 6.6 深度架构图

![](c0f99632-b029-4e7b-afe9-248cf2c1b8b6.png)

图 6：第五层深度架构 — 应用与服务层

## 7\. 总结

AI 基础设施全栈架构为理解驱动现代 AI 系统的复杂技术生态提供了结构化框架。五个层级各司其职：

- 第一层（硬件基础）确保充足的计算、存储和网络容量
- 第二层（芯片与加速）提供使 AI 计算可行的专用硅片
- 第三层（平台与中间件）提供可扩展部署的云原生基础设施
- 第四层（模型与开发）支持 AI 模型的高效训练、优化和管理
- 第五层（应用与服务）通过智能应用和 Agent 向终端用户交付 AI 能力

全面理解这一架构对于从事 AI 基础设施工作的人员至关重要，无论是容量规划、系统设计、模型部署还是应用开发。各层之间深度耦合——某一层的优化可以级联到整个栈，任何一层的瓶颈都可能限制整体系统性能。

随着 AI 模型规模和复杂度的持续增长，支撑它们的基础设施也必须相应演进。值得关注的关键趋势包括：国产 AI 芯片的采用加速、液冷和能效技术的进步、新的推理优化技术的涌现，以及 AI Agent 框架在企业自动化中的重要性日益提升。

中
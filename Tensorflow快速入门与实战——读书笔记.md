[TOC]



# Tensorflow架构

![image-20241111162937196](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241111162937196.png)

![image-20241111162954001](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241111162954001.png)

># cuda和opencl的区别
>
>## cuda
>
>CUDA 是统一计算设备架构（Compute Unified Device Architecture）的代表，这个架构是 NVIDIA 于 2007 年发布的并行编程范例。CUDA 使用类 C 语言，用于开发图形处理器软件和大量 GPU 通用应用程序，这些应用程序本质上是可以高度并行开发。
>
>CUDA 是一种专有 API，因此仅支持基于 Tesla 体系结构的 NVIDIA GPU。CUDA 适用于 GeForce 8 系列、Tesla 和 Quadro 等显卡。CUDA 编程范例是串行和并行执行的组合，包含一个 *kernel* 的特殊 C 函数。这个 C 函数可在显卡上并发执行固定数量的线程。
>
>>CUDA编程是一种用于并行计算的编程模型和平台，主要用于利用显卡的并行计算能力。CUDA编程通常使用以下两种语言：
>>
>>1. CUDA C / C++：CUDA C / C++是用于CUDA编程的主要语言。它是基于C和C++的编程语言扩展，可以利用NVIDIA GPU的并行计算能力。CUDA C / C++语言具有与传统C / C++类似的语法和结构，但增加了一些特殊的关键字和函数，用于从主机端代码控制GPU设备和执行并行计算任务。
>>2. CUDA Fortran：CUDA Fortran是针对Fortran程序员的CUDA编程语言。Fortran是科学和工程领域广泛使用的高级语言，CUDA Fortran在其基础上增加了一些特殊的关键字和函数，使Fortran程序员能够利用GPU并行计算能力。
>>
>>CUDA编程主要使用CUDA C / C++语言，因为C / C++是较为通用的编程语言，适用于各种应用领域。但对于已经熟悉Fortran的科学和工程领域的程序员来说，CUDA Fortran也是一个不错的选择，可以直接将现有的Fortran代码移植到GPU上进行并行计算。
>>
>>此外，CUDA编程还可以使用GPU驱动程序提供的API，如CUDA Runtime API和CUDA Driver API，这些API可以使用C / C++语言进行编程。它们提供了访问GPU硬件和执行并行计算任务所需的各种函数和操作。
>
>>CUDA核函数
>>CUDA（Compute Unified Device Architecture）是一种由NVIDIA开发的并行计算平台和编程模型。CUDA核函数是指在CUDA程序中，由GPU执行的函数。这些函数被设计为在GPU上并行运行，以提高计算效率。CUDA核函数通常用于执行大规模的数值计算任务，如图形渲染、科学计算、机器学习等。
>>
>>例子：
>>在CUDA中，一个简单的核函数可能看起来像这样：
>>
>>cuda
>>__global__ void add(int *a, int *b, int *c, int n) {
>>int index = threadIdx.x + blockIdx.x * blockDim.x;
>>if (index < n) {
>>c[index] = a[index] + b[index];
>>}
>>}
>>
>>这个核函数`add`的作用是将两个整数数组`a`和`b`的对应元素相加，并将结果存储在数组`c`中。核函数通过`__global__`关键字声明，可以在GPU上并行执行。
>
>## opencl
>
>OpenCL是开放计算语言的缩略词，由苹果公司和 Khronos 集团推出，旨在为异构计算提供一个基准，突破 NVIDIA GPU 的限制。OpenCL为GPU编程提供了一种可移植语言，使用了 CPU、GPU、数字信号处理器等。这种可移植语言用于设计程序或应用程序，让程序具有足够的通用性，可以在迥异的体系结构上运行，同时保持足够的适应性，提升每个硬件平台的性能。
>
>OpenCL 提供可移植程序，同时这些程序不会因生产设计厂商或设备不同而发生障碍，因此这些程序能够在各种不同的硬件平台上进行加速。OpenCL C 语言是 C99 语言的限制版本，可进行扩展，并在不同设备上执行数据并行代码。
>
>> 为了使用GPU的强大运算能力，需要进行GPU编程。然而现在GPU形形色色，比如Nvidia、AMD、Intel都推出了自己的GPU。
>> 每个GPU生产公司都推出自己的编程库显然会让学习成本上升很多，因此苹果公司就推出了标准OpenCL，说各个生产商都支持该标准，只要有一套OpenCL的编程库就能对各类型的GPU芯片适用。当然了，OpenCL做到通用不是没有代价的，会带来一定程度的性能损失，在Nvidia的GPU上，CUDA性能明显比OpenCL高出一大截。
>> 目前CUDA和OpenCL是最主流的两个GPU编程库。

![image-20241111171515952](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241111171515952.png)

# Tensorflow数据流图

![image-20241111171812923](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241111171812923.png)

并行计算快

分布式计算快(CPU, GPU, TPU)

预编译优化（XLA）

可移植性好

>PyTorch和TensorFlow在底层实现上采用了不同的方式。PyTorch采用了动态图的方式，即在运行时构建计算图，这使得其代码更加直观易懂。而TensorFlow则采用了静态图的方式，即在编译时构建计算图，这使得其代码更加高效且可读性较差。

# Tensorflow张量

在 TensorFlow 中，张量 (Tensor) 表示某种相同数据类型的多维数组。
因此，张量有两个重要属性：
1. 数据类型 (如浮点型、整型、字符串)
2. 数组形状 (各个维度的大小)

在 TensorFlow 中，有几类比较特别的张量，由以下操作产生：
- tf.constant //常量
- tf.placeholder //占位符
- tf.Variable //变量

# Tensorflow变量

TensorFlow 变量 ( Variable) 的主要作用是维护特定节点的状态，如深度学习或机器学习的模型参数。
tf.Variable 方法是操作，返回值是变量 (特殊张量)。

通过 tf.Variable 方法创建的变量，与张量一样，可以作为操作的输入和输出。不同之处在于：
- 张量的生命周期通常随依赖的计算完成而结束，内存也随即释放。
- 变量则常驻内存，在每一步训练时不断更新其值，以实现模型参数的更新。

# Tensorflow操作

TensorFlow 操作

TensorFlow 用数据流图表示算法模型。数据流图由节点和有向边组成，
每个节点均对应一个具体的操作。因此，操作是模型功能的实际载体。

数据流图中的节点按照功能不同可以分为 3 种 :
- 存储节点：有状态的变量操作，通常用来存储模型参数；
- 计算节点 : 无状态的计算或控制操作，主要负责算法逻辑表达或流程控制；
- 数据节点：数据的占位符操作，用于描述图外输入数据的属性。

操作的输入和输出是张量或操作 (函数式编程)

TensorFlow 使用占位符操作表示图外输入的数据，如训练和测试数据。 TensorFlow数据流图描述了算法模型的计算拓扑，其中的各个操作 （节点）都是抽象的函数映射或数学表达式。
换句话说，数据流图本身是一个具有计算拓扑和内部结构的"壳"。在用户向数据流图填充数据前，图中并没有真正执行任何计算。

```
# x = tf.placeholder(dtype, shape, name)
x = tf.placeholder(tf.int16, shape=(), name="x")
y = tf.placeholder(tf.int16, shape=(), name="y")
with tf.Session() as sess:
    # 填充数据后,执行操作
    print(sess.run(add, feed_dict={x: 2, y: 3}))
    print(sess.run(mul, feed_dict={x: 2, y: 3}))
```

# Tensorflow会话

会话提供了估算张量和执行操作的运行环境，它是发放计算任务的客户端，所有计算任务都由它连接的执行引擎完成。一个会话的典型使用流程分为以下3步：

![image-20241111191029101](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241111191029101.png)

当我们调用sess.run(train_op)语句执行训练操作时：
- 首先，程序内部提取操作依赖的所有前置操作。这些操作的节点共同组成一幅子图。
- 然后，程序会将子图中的计算节点、存储节点和数据节点按照各自的执行设备分类，相同设备上的节点组成了一幅局部图。
- 最后，每个设备上的局部图在实际执行时，根据节点间的依赖关系将各个节点有序地加载到设备上执行。

对于单机程序来说，相同机器上不同编号的CPU或GPU就是不同的设备，我们可以在创建节点时指定执行该节点的设备。

![image-20241111191233864](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241111191233864.png)

# 优化器

优化器是实现优化算法的载体。
一次典型的迭代优化应该分为以下 3 个步骤：
1. 计算梯度 : 调用compute_gradients方法；
2. 处理梯度 : 用户按照自己需求处理梯度值，如梯度裁剪和梯度加权等；
3. 应用梯度: 调用apply_gradients方法，将处理后的梯度值应用到模型参数。

![image-20241111191603562](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241111191603562.png)



# HDFS

HDFS (Hadoop Distributed File System, 分布式文件系统) 是 Google 公司的 GFS 论文思想的实现，也作为 Hadoop 的存储系统，它包含客户端 (Client)、元数据节点(NameNode)、备份节点(Secondary NameNode) 以及数据存储节点(DataNode)。  
![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures2790988-20220321234710707-2077002317.png)

Client
------

HDFS 利用分布式集群节点来存储数据，并提供统一的文件系统访问接口。这样，用户在使用分布式文件系统时就如同在使用普通的单节点文件系统一样，仅通过对 NameNode 进行交互访问就可以实现操作 HDFS 中的文件。HDFS 提供了非常多的客户端，包括命令行接口、Java API、Thrift 接口、Web 界面等。

NameNode
--------

NameNode 作为 HDFS 的管理节点，负责保存和管理分布式系统中所有文件的元数据信息，如果将 HDFS 比作一本书，那么 NameNode 可以理解为这本书的目录。

其职责主要有以下三点：

1.  负责接收 Client 发送过来的读写请求；
2.  管理和维护 HDFS 的命名空间: 元数据是以镜像文件 (fsimage) 和编辑日志 (editlog) 两种形式存放在本地磁盘上的，可以记录 Client 对 HDFS 的各种操作，比如修改时间、访问时间、数据块信息等。
3.  监控和管理 DataNode：负责监控集群中 DataNode 的健康状态，一旦发现某个 DataNode 宕掉，则将该 DataNode 从 HDFS 集群移除并在其他 DataNode 上重新备份该 DataNode 的数据 (该过程被称为数据重平衡，即 rebalance)，以保障数据副本的完整性和集群的高可用性。

SecondaryNameNode
-----------------

SecondaryNameNode 是 NameNode 元数据的备份，在 NameNode 宕机后，SecondaryNameNode 会接替 NameNode 的工作，负责整个集群的管理。并且出于可靠性考虑，SecondaryNameNode 节点与 NameNode 节点运行在不同的机器上，且 SecondaryNameNode 节点与 NameNode 节点的内存要一样大。

同时，为了减小 NameNode 的压力，NameNode 并不会自动合并 HDFS 中的元数据镜像文件 (fsimage) 和编辑日志(editlog)，而是将该任务交由 SecondaryNameNode 来完成，在合并完成后将结果发送到 NameNode, 并再将合并后的结果存储到本地磁盘。

DataNode
--------

存放在 HDFS 上的文件是由数据块组成的，所有这些块都存储在 DataNode 节点上。DataNode 负责具体的数据存储，并将数据的元信息定期汇报给 NameNode，并在 NameNode 的指导下完成数据的 I/O 操作。

实际上，在 DataNode 节点上，数据块就是一个普通文件，可以在 DataNode 存储块的对应目录下看到（默认在 $(dfs.data.dir)/current 的子目录下），块的名称是 blk_ID，其大小可以通过 dfs.blocksize 设置，默认为 128MB。

初始化时，集群中的每个 DataNode 会将本节点当前存储的块信息以块报告的形式汇报给 NameNode。在集群正常工作时，DataNode 仍然会定期地把最新的块信息汇报给 NameNode，同时接收 NameNode 的指令，比如创建、移动或删除本地磁盘上的数据块等操作。

HDFS 数据副本
---------

HDFS 文件系统在设计之初就充分考虑到了容错问题，会将同一个数据块对应的数据副本（副本个数可设置，默认为 3）存放在多个不同的 DataNode 上。在某个 DataNode 节点宕机后，HDFS 会从备份的节点上读取数据，这种容错性机制能够很好地实现即使节点故障而数据不会丢失。

HDFS 的工作机制
==========

NameNode 工作机制
-------------

NameNode 简称 NN

*   NN 启动后, 会将镜像文件 (fsimage) 和编辑日志 (editlog) 加载进内存中；
*   客户端发来增删改查等操作的请求；
*   NN 会记录下操作，并滚动日志，然后在内存中对操作进行处理。

![](https://img2022.cnblogs.com/blog/2790988/202203/2790988-20220321234745309-182808170.png)

SecondaryNameNode 工作机制
----------------------

SecondaryNameNode 简称 2NN

*   当编辑日志数据达到一定量或者每隔一定时间，就会触发 2NN 向 NN 发出 checkpoint 请求；
*   如果发出的请求有回应，2NN 将会请求执行 checkpoint 请求；
*   2NN 会引导 NN 滚动更新编辑日志，并将编辑日志复制到 2NN 中；
*   同编辑日志一样，将镜像文件复制到 2NN 本地的 checkpoint 目录中；
*   2NN 将镜像文件导入内存中，回放编辑日志，将其合并到新的 fsimage.ckpt；
*   将 fsimage.ckpt 压缩后写入到本地磁盘；
*   2NN 将 fsimage.ckpt 传给 NN；
*   NN 会将新的 fsimage.ckpt 文件替换掉原来的 fsimage，然后直接加载和启用该文件。

HDFS 文件的读取流程
------------

![](https://img2022.cnblogs.com/blog/2790988/202203/2790988-20220321234803766-666107785.png)

*   客户端调用 FileSystem 对象的 open() 方法，其实获取的是一个分布式文件系统（DistributedFileSystem）实例；
*   将所要读取文件的请求发送给 NameNode，然后 NameNode 返回文件数据块所在的 DataNode 列表（是按照 Client 距离 DataNode 网络拓扑的远近进行排序的），同时也会返回一个文件系统数据输入流（FSDataInputStream）对象；
*   客户端调用 read() 方法，会找出最近的 DataNode 并连接；
*   数据从 DataNode 源源不断地流向客户端。

HDFS 文件的写入流程
------------

![](https://img2022.cnblogs.com/blog/2790988/202203/2790988-20220321234815181-748049775.png)

*   客户端通过调用分布式文件系统（DistributedFileSystem）的 create() 方法创建新文件；
*   DistributedFileSystem 将文件写入请求发送给 NameNode，此时 NameNode 会做各种校验，比如文件是否存在，客户端有无权限去创建等；
*   如果校验不通过则会抛出 I/O 异常。如果校验通过，NameNode 会将该操作写入到编辑日志中，并返回一个可写入的 DataNode 列表，同时，也会返回文件系统数据输出流（FSDataOutputStream）的对象；
*   客户端在收到可写入列表之后，会调用 write() 方法将文件切分为固定大小的数据包，并排成数据队列；
*   数据队列中的数据包会写入到第一个 DataNode，然后第一个 DataNode 会将数据包发送给第二个 DataNode，依此类推。
*   DataNode 收到数据后会返回确认信息，等收到所有 DataNode 的确认信息之后，写入操作完成。

# SWIG

SWIG 是一个软件开发工具，能够简化不同编程语言与 C 和 C++ 程序连接的开发任务。
简而言之，SWIG 是一款编译器，它可以获取 C/C++ 声明并创建访问这些声明所需的包装器，从而可从包括 Perl、Python、Tcl、Ruby、Guile 和 Java 在内的其他语言访问这些声明。SWIG 通常不需要修改现有代码，而且通常只需几分钟即可构建一个可用的接口。

本质上，SWIG 是一个为生成代码而设计的工具，该工具可以让各种其他编程语言调用 C/C++ 代码。这些更高级的编程语言是 SWIG 代码生成器的目标语言，而 C 或 C++ 是输入语言。在运行 SWIG 时必须指定一种目标语言。这将为 C/C++ 和指定的目标语言生成代码，以便相互进行接口

这种将 C/C++ 与许多不同目标语言连接的能力是 SWIG 的核心优势和特性之一。

# 库模式与框架模式

基础平台层软件的设计模式多种多样，它们对应用层开发者体现出的工作形态也有所差别。在众多平台设计模式中，存在两类基础而典型的模式，即图1-2所示的库模式和框架模式。在库模式下，平台层软件以静态或动态的开发库（如.a、.so文件）形式存在，应用层开发者需要编写程序调用这些库提供的函数，实现计算逻辑。程序的入口（如main函数）及整体流程控制权把握在应用层开发者手中。在框架模式下，平台层软件以可执行文件形式存在，并以前端交互式程序或后端守护进程方式独立运行。应用层开发者需要遵从平台规定的接口约束，开发包含计算逻辑在内的子程序，交由框架性质的平台层软件调度执行。程序的入口及整体流程控制权由框架把握。

![platform-mode](https://github.com/DjangoPeng/tensorflow-in-depth/raw/master/text/1_overview/images/platform-mode.png)

在高性能与大数据计算领域，典型的库模式软件有用于计算的Eigen、NumPy，以及用于通信的MPI、ZeroMQ等。基于这些库开发应用时，编程方式比较灵活，部署模式也相对轻量。应用开发者具有较大的自由度，但不得不编写业务逻辑之外的不少“脚手架”代码，以便将算法代码片段转变为完整可用的软件。典型的框架模式软件有大数据计算平台Hadoop、Spark，以及基于SQL和类SQL语言的数据库、数据仓库等。使用这些框架开发应用时，开发者的工作相对轻松，只需要编写与业务逻辑密切相关的算法代码，不用关心运行时机制的复杂性。不过，程序的灵活性将受制于框架的约束。

TensorFlow的设计采用了库模式。之所以如此，是出于灵活通用、端云结合及高性能等设计目标的考虑。库模式的平台层软件便于与各种既有的框架协同工作，不对软件的运行时组件添加新的约束，应用范围也不受制约。除了依赖最基本的编程语言库和操作系统调用，这类平台层软件同其他环境因素解耦，从而可以做到高度的可移植性。在单机和终端等场景下，由于没有守护进程和调度框架的开销，有效计算逻辑的资源利用率也会提高，进而有助于性能优化。

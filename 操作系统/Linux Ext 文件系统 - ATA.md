---
title: "Linux Ext 文件系统 - ATA"
source: "https://ata.atatech.org/articles/11000192101?layout=%2Fvelocity%2Flayout%2Fblank.vm"
author:
published:
created: 2026-04-08
description:
tags:
  - "clippings"
---
中国电商事业群-飞猪

粉丝 190影响力 1.9k

** 2

** 2

**

** 原创文章

开放访问

**

复制专用链接

**

## Linux Ext 文件系统

[陈阳(逸殊)](https://ata.atatech.org/users/11000967975)

2021-01-11发表2023-03-28更新200次浏览

** 字号

** 笔记

** 分享 **

## 引言

本文整理了 Linux 内核中 Ext 文件系统的相关知识，其他 Linux 相关文章均收录于 [贝贝猫的文章目录](https://www.atatech.org/articles/192584) 。  

## 文件系统种类

前面我们讨论了虚拟文件系统，它对所有下层文件系统进行了封装，统一了上层接口并粘合了下层文件系统，这时候应用开发者就接触不到硬盘的数据组织，但是大家一定很好奇，在文件系统这一层是如何组织并有效的利用硬盘的。接下来，我们将介绍 Ext 文件系统的实现方案，同时会顺带着介绍一下无持久存储的文件系统（/proc）。

### Ext 文件系统

Ext 文件系统这里主要介绍 Ext2 和 Ext3，它们的特性如下：

- Ext2 文件系统: 该文件系统一直伴随着 Linux，它已经成为许多服务器和桌面系统的支柱，工作极其出色。Ext2 文件系统的设计利用了与虚拟文件系统非常类似的结构，因为开发 Ext2 时，目标就是要优化与 Linux 的互操作，但它也可以用于其他的操作系统。
- Ext3 文件系统: 这是 Ext2 的演化和发展。它仍然与 Ext2 兼容，但提供了扩展日志功能，这对系统崩溃的恢复特别有用。除此之外，Ext3 和 Ext2 基本相同。

在管理基于磁盘文件系统的存储空间时，会遇到一个特殊的问题：碎片。随着文件的移动和新文件的增加，可用空间变得越来越支离破碎，特别是在文件很小的情况下。由于这对访问速度有负面影响，所以文件系统必须尽可能减少碎片发生。

另一个重要的需求是有效利用存储空间，文件系统要想做到这一点必须存储大量的管理数据，这就需要进行一定的折中，来保证管理数据不会过分的侵占文件内容的存储空间。

维护文件一致性也是一个关键，需要在规划和实现文件系统时充分考量。内核可能猝然停工，可能是软件错误，也可能由于断电、硬件故障等其他原因。即使此类事故将造成不可恢复的错误(例如，如果修改被缓存在物理内存中，没有写回磁盘，那么修改会丢失)，文件系统的实现必须尽可能快速、全面地纠正可能出现的损坏。它必须能够将文件系统还原到一个可用状态。

#### Ext2

这里我们先介绍一下文件系统的数据，包括文件内容，目录层次的表示，相关管理数据（权限，用户，组），以及文件系统的内部信息，这些数据都会保存在硬盘上来持久保存，一般来说内核为了高速访问都会将这些数据复制到内存中，并在合适的时机将内存中的副本刷回硬盘。

块的含义：

- 有些文件系统存储在面向块的设备上，与设备之间的数据传输都以块为单位进行，不会传输单个字符。
- 另一方面，Ext2 文件系统是一种基于块的文件系统，它将硬盘划分为若干块，每个块的长度都相同，按块管理元数据和文件内容。这意味着底层存储介质的结构影响到了文件系统的结构，这很自然也会影响到所用的算法和数据结构的设计。

在将硬盘划分为固定长度的块时，特别重要的一个方面是文件占用的存储空间只能是块长度的整数倍。这会对存储空间的利用造成一定的影响，我们以下例来介绍这种影响，假定块长为5个单位。我们需要存储 3 个文件，它们的长度分别是 11，4，2 个单位。  

![[0af1a2b1-47b6-4678-99cf-247dbcab0846.png|block-file-system-example]]

block-file-system-example

  
很明显，上面的方案空间利用率更高，但是它有个缺点，就是需要保存不同文件的边界，这部分管理数据实际上也会很大，这就抵消了这种方案节省的空间。所以，Ext 文件系统采用的是下面的方案，每个文件占用的存储空间不仅包括数据的实际长度，还要根据块长度向上取整到块长的整数倍。Ext2 的块长是可指定的，活用块长配置可以在不同的场景（许多大文件或许多小文件）提高文件系统的效率。

理解了块的概念后，我们看一看块组，它是 Ext2 的基本成分，容纳了文件系统的其他结构。  

![[708b0334-f3be-494a-806c-8d12bfaa624f.png|block-group]]

block-group

  
块组中各个结构的介绍：

- 超级块是用于存储文件系统自身元数据的核心结构。其中的信息包括空闲与已使用块的数目、块长度、当前文件系统状态(在启动时用于检测前一次崩溃)、各种时间戳(例如，上一次装载文件系统的时间以及上一次写入操作的时间)，它还包括一个表示文件系统类型的魔数，这样 mount 能够确认文件系统的类型是否正确。内核只使用第一个块组的超级块读取文件系统的元信息，即使在多个超级块中都有数据时，也是如此，这是一种数据冗余。
- 组描述符包含的信息反映了文件系统中各个块组的状态，例如，块组中空闲块和 inode 的数目。每个块组都包含了文件系统中所有块组的组描述符信息。
- 数据块位图和 inode 位图用于保存长的比特位串，这些结构中的每个比特位都对应了一个数据块或 inode，用于表示对应的数据块或 inode 是空闲的，还是被使用中。
- inode 表包含了块组中所有的 inode，inode 用于保存文件系统中与各个文件和目录相关的所有元数据。
- 顾名思义，数据块部分包含了文件系统中的文件的有用数据。

每个文件系统都由大量的块组组成，在硬盘上相继排布，就如下图所示。  

![[6d50cd82-f7d5-48ed-93dc-924161defaa4.png|lots-of-block-group]]

lots-of-block-group

  
启动扇区是硬盘上的一个区域，在系统加电启动时，其内容由 BIOS 自动装载并执行。它包含一个启动装载程序，用于从计算机安装的操作系统中选择一个启动，还负责继续启动过程。显然，该区域不可能填充文件系统的数据。启动装载程序并非在所有系统上都是必须的。在需要启动装载程序的系统上，它们通常位于硬盘的起始处，以避免影响其后的分区。

磁盘上剩余的空间由连续的许多块组占用，存储了文件系统元数据和各个文件的有用数据。从前面的块组内部构造中，你会看到每个块组都包含超级块数据，这实际上冗余的。它存在的价值主要有如下两点：

- 如果系统崩溃破坏了超级块，有关文件系统结构和内容的所有信息都会丢失。如果有冗余的副本，该信息是可能恢复的(难度极高，大多数用户可能一点也恢复不了)。
- 通过使文件和管理数据尽可能接近，减少了磁头寻道和旋转，这可以提高文件系统的性能。

实际上，超级块数据并非在每个块组中都复制，内核也只用超级块的第一个副本工作，通常这就足够了。在进行文件系统检查时，会将第一个超级块的数据传播到剩余的超级块，供紧急情况下读取。因为该方法也会消耗大量的存储空间，Ext2 的后续版本采用了稀疏超级块(sparse super block)技术。该做法中，超级块不再存储到文件系统的每个块组中，而是只存入到块组0、块组 1 和其他可以表示为3、5、7 的幂的块组中。

在系统内存中，从内核的角度来看，内存划分为长度相同的页，按唯一的页号或指针寻址。硬盘与内存类似，块也通过编号唯一标识。这使得存储在 inode 结构中的文件元数据，能够关联到位于硬盘数据块部分的文件内容。二者之间的关联，是通过将数据块的地址存储在 inode 中建立的。

文件占用的数据块不见得是连续的(虽然出于性能考虑，连续数据块是我们想要的一种情况)，也可能散布到整个硬盘上。如果我们将文件涉及的所有块的块号都存在 inode 中，那么一个 inode 中能够存放的块数量肯定是有最大限制的，否则 inode 就会过大。所以，inode 通过一种间接的方式来组织一个文件散布在整个硬盘上的所以数据块。

在 inode 中有少量字节存储直接块号，它们用来表示长度较小的文件。对较大的文件，指向文件内容的各个数据块的指针(块号)是间接存储的，如下图所示。这种方法容许对大小文件的灵活存储，因为用于存储块号的区域的长度，将随文件实际长度的变化而动态变化。inode 本身长度是固定的，用于间接引用的其他数据块是动态分配的。  

![[eadf786f-7246-48f3-ac06-50ae2cd9bf1f.png|inode-store-block]]

inode-store-block

  
因为 inode 中最多包含 15 个块号（12 个直接块号，3 个间接寻址块），所以 inode 的长度是固定的，而且占用的硬盘空间比较小。当文件较小时，这些 inode 中的直接块号指向的就是文件全部数据块，当文件较大时，通过间接寻址块，就能拓展 inode 管理的文件最大容量。这里每个块号是 4 个字节，当一个块的大小是 b 时，一级寻址块内就能存放 `b/4` 个块号，同理二级间接寻址能够存放 `(b / 4) * (b / 4)` ，三级间接寻址能够存放 `(b / 4) * (b / 4) * (b / 4)` 个块号。总结一下就是 Ext2 文件系统中一个文件的最大大小等于 `(b/4)3+(b/4)2+b/4+12` 块，b 为块的大小，下表展示了对于不同的块大小，Ext2 所能管理的最大单个文件的尺寸。  
![[4cba8796-282f-4cb1-9c67-8676e73f69d0.png|ext2-max-file-size]]

ext2-max-file-size

  
仔细回想一下，内核在管理内存页时用到的页表也是采用的相同的思路，通过这种间接存储块号的方式，可以有效地减少 inode 的大小，但是因为必须通过间接寻址才能得到最终的数据块，所以势必会造成性能上的损失（越大的文件，访问速度越慢），不过这也是一种折中。

此外，磁盘存储的块管理和内存的管理上类似，也存在碎片问题。随着时间的推移，文件系统中许多文件从磁盘随机位置删除，又添加了新的文件，这使得空闲磁盘空间变成长度不同的存储区，因此碎片不可避免地出现了。  

![[3ff9f51d-f5f7-40e4-88ff-3ef04732a000.png|file-system-segment]]

file-system-segment

  
尽管数据在磁盘上是散布在随机位置的，但是这些对用户来说是透明的，用户总能通过直接块号，一级二级三级间接块号，顺序的访问文件的所有数据，而不会考虑到磁盘上数据碎片的程度。但是，如果碎片严重的话，访问速度是会受到严重影响的，如果文件的所有块在磁盘上是连续的话，磁头读取数据时移动将降到最低，因此提高了数据传输速度。相反的，如果文件散布在磁盘的各个角落，那么磁头读取时，就需要不停地寻道，这就降低访问速度。因此 Ext2 会尽量防止碎片，在无法避免碎片时，它会尽可能将同一文件的块维持在一个块组中，此外像 defrag.ext2 这样的系统工具还可以用来重新整理磁盘块，将磁盘碎片重组成连续数据。

然后，我们来讨论一下在 Ext2 中如何描述目录，它定义了文件系统的拓扑结构。在经典的 Unix 文件系统中，目录不过是一种特殊的文件，其 inode 指向的块中描述了该目录下所包含的所有文件和子目录的名称，以及它们对应的 inode 编号。下图展示的就是一个目录 inode 的块内容，前段存储了 inode 编号，后端存储了文件类型和文件名的内容。  

![[365b8495-5f52-4278-bf4a-4bd929f58d4b.png|inode-store-directory]]

inode-store-directory

  
前两项总是. 和.. 它们分别指向了当前目录和父目录。rec\_len 是文件名的长度，因为文件名必须为 4 的整数倍，所以空白的部分会用 `\0` 填充。文件类型并未定义在 inode 自身，而是定义在目录数据块的 file\_type 字段中。值得一提的是，只有目录和普通文件才会占用磁盘的数据块，而其他类型的文件都可以通过 inode 中的信息完全描述。

- 目标路径长度小于 60 字节的符号链接，保存在原来用来保存目录块号的那 15 \* 4 字节中。
- 设备文件，命名管道，持久套接字。

为提高块分配的性能，Ext2 文件系统采用了一种称之为预分配的机制。每当对一个文件请求许多新块时，不会只分配所需要的块数。能够用于连续分配的块，会另外被秘密标记出来，供后续使用。内核确保各个保留的区域是不重叠的。这在进行新的分配时可以节省时间以及防止碎片，特别是在有多个文件并发增长时。应该强调的是: 预分配并不会降低可用空间的利用率。由一个 inode 预分配的空间，如果有需要，那么随时可能被另一个 inode 覆盖。但内核会尽力避免这种做法，只有当迫不得已时才会分配保留区。文件系统使用红黑树来维护预留块的数据，根据预留窗口的边界，对节点进行排序，这样在需要确认某一块是否被预留时，能够快速地找到目标块所在的预分配区域。同时，在 inode 信息中也存储了预留空间的信息，这样在要为该 inode 代表的文件中分配新的块时可以检查是否有预留块，如果有的话则优先从预留块中分配。  

![[0fe8c12b-6803-4b92-8bf5-8353fae3630e.png|ext2-reserve-block]]

ext2-reserve-block

  
最后我们针对，Ext2 文件系统中的主要操作行为进行总结，概述每种操作处理过程：

- 创建文件系统：通过 mke2fs 用户空间工具创建，它初始化超级块，超级块中的魔数表明了该文件系统是 Ext2，并分配一个 inode 和数据块，初始化根目录，数据块中包括. 和.. 它们都指向根目录本身，此外还有一个 lost+found 的目录，它用来保存发现的坏块。
- 装载文件系统：通过 mount 命令可以将文件系统过载在 VFS 的一个路径上，该路径上原内容会被隐藏，只显示新文件系统的根目录内容。将超级块的元数据保存在内存中，方便快速使用，同时在适当的时候刷回硬盘持久保存。
- 创建 inode：创建文件或者创建目录时，会创建新的 inode，分配 inode 时会尽可能在同一个块组中分配，如果同一块组不能分配，则会尽可能靠近的分配，如果没有满足条件的空 inode，则会选择一个 inode 使用较少的块组，这样后续的分配过程会更加容易。如果创建的是目录，则需要在目录数据块中加入. 和..。
- 找到文件数据块：用户通过文件路径访问文件，会先经过 VFS 层，该层将调用底层文件系统的函数，它会通过缓存的目录项查找该文件的 inode，如果缓存不存在，它需要逐级解析硬盘上的 inode 目录的内容，最终找到目标文件的 inode 继而查出数据块位置，如果文件较小，通过直接块号就能访问文件数据，反之则需要间接块号寻址，才能找到目标文件的数据块。
- 写入数据：在检测到有必要添加新块时，需要判断是否需要间接块寻址，以及间接层次是怎样的，然后在存储介质上分配合适的空闲块（尽可能分配临近的块），并将新分配的块记录在块列表中（直接块号，间接块号），在这个过程中，为了获得更好的性能，内核会进行块预留，如果一个文件有预留块，那么分配过程会优先选择预留块。处理完所有这些后，才会将文件内容写入其对应的数据块中。
- 删除 inode：删除前先确认硬连接减一后数目是否为 0，如果没有硬链接了就可以删除 inode。从父目录的 inode 数据区中删除当前 inode 对应的项，接下来释放硬盘上已经分配的数据块（不会对数据块置零，而只会对块位图置零）。

#### Ext3

Ext3 相较于 Ext2 增加了一个日志特性，记录了对文件系统数据所进行的操作。在发生系统崩溃之后，该机制有助于缩短恢复时间。由于在 Ext3 文件系统中，与新的日志机制无关的底层文件系统概念没有改变，我在这里只讨论 Ext3 的新功能。

事务(transaction)概念起源于数据库领域，它有助于在操作未能完成的情况下保证数据的一致性。一致性问题同样也会发生在文件系统中(不是 Ext 特有的)。如果文件系统操作被无意中断(例如，停电或用户直接切断电源)，这种情况下元数据的正确性和一致性如何保证？

Ext3 的基本思想在于，将对文件系统元数据的每个操作都视为事务，在执行之前要先行记录到日志中。在事务结束后(即，对元数据的预期修改已经完成)，相关的信息从日志删除。如果事务数据已经写入到日志之后，而实际操作执行之前(或期间)，发生了系统错误，那么在下一次装载文件系统时，将会完全执行待决的操作。接下来，文件系统自动恢复到一致状态。如果在事务数据尚未写到日志之前发生错误，那么在系统重启时，由于关于该操作的数据已经丢失，因而不会执行该操作，但至少保证了文件系统的一致性。

但 Ext3 不能创造奇迹。系统崩溃仍然可能造成数据丢失。但在此后，文件系统总是可以非常快速地恢复到一致状态。

事务日志当然是需要额外开销的，因而 Ext3 的性能与 Ext2 相比，是有所降低的。为了在所有情况下，在性能和数据完整性之间维持适当的均衡，内核能够以 3 种不同的方式访问 Ext3 文件系统。

1. 回写(write back)模式，日志只记录对元数据的修改。对实际数据的操作不记入日志，这种模式提供了最高的性能，但数据保护是最低的。
2. 顺序(ordered)模式，日志只记录对元数据的修改。但对实际数据的操作会群集起来，总是在对元数据的操作之前执行，因而该模式比回写模式稍慢.
3. 日志模式，对元数据和实际数据的修改，都写入日志。这提供了最高等级的数据保护，但速度是最慢的。丢失数据的可能性降到最低。

日志不仅可以存储在一个专门的文件中，也可以放置在一个独立的分区中。事务并不是一个整块的结构，由于文件系统的结构，必须将事务分解为更小的单位。  
![[d94cd360-9570-4228-8327-2d2ba29857a1.png|ext3-transaction.png]]

- 日志记录是可以记入日志的最小单位。每个记录表示对某个块的一个更新。
- (原子)句柄在系统级收集了几个日志记录。例如，如果使用 write 系统调用发出一个写请求，那么所有与该操作相关的日志记录都会群集到个句柄中。
- 事务是几个句柄的集合，用于保证提供更好的性能。

### 无持久存储文件系统

一般来说，文件系统用于管理在块设备上的持久存储数据，但是也可以用通过文件系统来组织不存储在块设备上的信息，这些信息可以由内核动态生成。这里我们着重介绍这三类：

- proc 文件系统(proc filesystem)，它使得内核可以生成与系统的状态和配置有关的信息。该信息可以由用户和系统程序从普通文件读取，而无需专门的工具与内核通信。在某些情况下，个简单的 cat 命令就足够了。数据不仅可以从内核读取，还可以通过向 proc 文件系统的文件写入字符中，来向内核发送数据。 `echo "value" > /proc/file:` 不会有比这更容易的从用户空间向内核传输信息的方式了。该虚拟文件系统会即时产生文件信息，只有发出读操作请求时，才会生成信息。对于此类文件系统，不需要专用的硬盘分区或其他块存储设备。除了 proc 文件系统之外，内核还提供了许多其他的虚拟文件系统，用于不同的目的。例如，以目录层次结构的形式，对所有设备和系统资源进行编目。即使设备驱动程序也可以在虚拟文件系统中提供状态信息，USB 子系统就是一个例子。
- sysfs 按照惯例一般是装载在 /sys 目录。它设计为从内核向用户层导出非常结构化的信息，对于想要收集系统中的硬件和设备间拓扑关联方面详细信息的工具而言，该文件系统是非常有用的。
- 用于专门目的的小文件系统，可以由内核提供的标准函数构建。在内核内部，libfs 库提供了这个功能。此外，内核提供了易于实现顺序文件的方法。在调试文件系统 debugfs 中同时使用了这两种技术，该文件系统使得内核开发者能够快速地向用户空间导出值或从用户空间导入值，而无需创建定制的接口或专门的文件系统。

#### proc

proc 文件系统（Process data filesystem，进程数据文件系统）是种虚拟文件系统，通常装载在 /proc，其信息不能从块设备读取。只有在读取文件内容时，才动态生成相应的信息。使用 proc 文件系统，可以获得有关内核各子系统的信息(例如，内存利用率、附接的外设，等等)，也可以在不重新编译内核源代码的情况下修改内核的行为，或重启系统。与该文件系统密切相关的是系统控制机制(system control mechanism，简称 sysctl)。proc 文件系统提供了种接口，可用于该机制导出的所有选项，使得可以不费力气地修改参数。无需开发专门的通信程序，只需要个 shell 和标准的 cat、echo 程序。

/proc 的信息可以分为以下几大类:

- 内存管理
- 系统进程的特征数据
- 文件系统
- 设备驱动程序
- 系统总线
- 电源管理
- 终端
- 系统控制参数

每个系统进程，无论当前状态如何，都有一个对应的子目录(与其 PID 同名)，包含了该进程的有关信息。顾名思义，进程数据系统(process data system，简称 proc)的初衷就是传递进程数据。特定于进程的目录保存了哪些信息？简单的一个 `ls -l` 命令，就能看到一些信息:

```bash
cd /proc/1
ls -l
total 0
dr-xr-xr-x 2 root root 0 Nov 18 16:45 attr
-rw-r--r-- 1 root root 0 Nov 18 16:45 autogroup
-r-------- 1 root root 0 Nov 18 16:45 auxv
-r--r--r-- 1 root root 0 Nov 18 16:40 cgroup
--w------- 1 root root 0 Nov 18 16:45 clear_refs
-r--r--r-- 1 root root 0 Nov 18 16:40 cmdline
-rw-r--r-- 1 root root 0 Nov 18 16:40 comm
-rw-r--r-- 1 root root 0 Nov 18 16:45 coredump_filter
-r--r--r-- 1 root root 0 Nov 18 16:45 cpuset
lrwxrwxrwx 1 root root 0 Nov 18 16:45 cwd -> /
-r-------- 1 root root 0 Nov 18 16:40 environ
lrwxrwxrwx 1 root root 0 Nov 18 16:40 exe -> /usr/lib/systemd/systemd
dr-x------ 2 root root 0 Nov 18 16:45 fd
dr-x------ 2 root root 0 Nov 18 16:45 fdinfo
-rw-r--r-- 1 root root 0 Nov 18 16:45 gid_map
-r-------- 1 root root 0 Nov 18 16:45 io
-r--r--r-- 1 root root 0 Nov 18 16:45 limits
-rw-r--r-- 1 root root 0 Nov 18 16:40 loginuid
dr-x------ 2 root root 0 Nov 18 16:45 map_files
-r--r--r-- 1 root root 0 Nov 18 16:45 maps
-rw------- 1 root root 0 Nov 18 16:45 mem
-r--r--r-- 1 root root 0 Oct 25 08:17 mountinfo
-r--r--r-- 1 root root 0 Nov 18 16:45 mounts
-r-------- 1 root root 0 Nov 18 16:45 mountstats
dr-xr-xr-x 7 root root 0 Nov 18 16:39 net
dr-x--x--x 2 root root 0 Nov 18 16:40 ns
-r--r--r-- 1 root root 0 Nov 18 16:45 numa_maps
-rw-r--r-- 1 root root 0 Nov 18 16:45 oom_adj
-r--r--r-- 1 root root 0 Nov 18 16:45 oom_score
-rw-r--r-- 1 root root 0 Nov 18 16:45 oom_score_adj
-r-------- 1 root root 0 Nov 18 16:45 pagemap
-r-------- 1 root root 0 Nov 18 16:45 personality
-rw-r--r-- 1 root root 0 Nov 18 16:45 projid_map
lrwxrwxrwx 1 root root 0 Nov 18 16:45 root -> /
-rw-r--r-- 1 root root 0 Nov 18 16:45 sched
-r--r--r-- 1 root root 0 Nov 18 16:45 schedstat
-r--r--r-- 1 root root 0 Nov 18 16:40 sessionid
-rw-r--r-- 1 root root 0 Nov 18 16:45 setgroups
-r--r--r-- 1 root root 0 Nov 18 16:45 smaps
-r--r--r-- 1 root root 0 Nov 18 16:45 smaps_rollup
-r-------- 1 root root 0 Nov 18 16:45 stack
-r--r--r-- 1 root root 0 Nov 18 16:40 stat
-r--r--r-- 1 root root 0 Nov 18 16:45 statm
-r--r--r-- 1 root root 0 Nov 18 16:40 status
-r-------- 1 root root 0 Nov 18 16:45 syscall
dr-xr-xr-x 3 root root 0 Nov 18 16:45 task
-r--r--r-- 1 root root 0 Nov 18 16:45 timers
-rw-rw-rw- 1 root root 0 Nov 18 16:45 timerslack_ns
-rw-r--r-- 1 root root 0 Nov 18 16:45 uid_map
-r--r--r-- 1 root root 0 Nov 18 16:45 wchan
```

上例是 PID 为 1 的 systemd，我们可以通过 `cmdline` 文件查看其起始命令行。

```bash
cat cmdline
/usr/lib/systemd/systemd--switched-root--system--deserialize22
# od 命令可以显示分隔符 nul
od -t a cmdline
0000000   /   u   s   r   /   l   i   b   /   s   y   s   t   e   m   d
0000020   /   s   y   s   t   e   m   d nul   -   -   s   w   i   t   c
0000040   h   e   d   -   r   o   o   t nul   -   -   s   y   s   t   e
0000060   m nul   -   -   d   e   s   e   r   i   a   l   i   z   e nul
0000100   2   2 nul
0000103
```

environ 表示进程的所有环境变量，maps 以文本形式列出了进程的所有库的内存映射。

```bash
cat maps
55e5a4004000-55e5a4165000 r-xp 00000000 fd:00 391970                     /usr/lib/systemd/systemd
55e5a4365000-55e5a4388000 r--p 00161000 fd:00 391970                     /usr/lib/systemd/systemd
55e5a4388000-55e5a4389000 rw-p 00184000 fd:00 391970                     /usr/lib/systemd/systemd
55e5a5a2f000-55e5a5c3a000 rw-p 00000000 00:00 0                          [heap]
7fb0b4000000-7fb0b4029000 rw-p 00000000 00:00 0
7fb0b4029000-7fb0b8000000 ---p 00000000 00:00 0
7fb0bc000000-7fb0bc029000 rw-p 00000000 00:00 0
7fb0bc029000-7fb0c0000000 ---p 00000000 00:00 0
7fb0c2d10000-7fb0c2d11000 ---p 00000000 00:00 0
7fb0c2d11000-7fb0c3511000 rw-p 00000000 00:00 0
7fb0c3511000-7fb0c3512000 ---p 00000000 00:00 0
7fb0c3512000-7fb0c3d12000 rw-p 00000000 00:00 0
7fb0c3d12000-7fb0c3d16000 r-xp 00000000 fd:00 33622816                   /usr/lib64/libuuid.so.1.3.0
7fb0c3d16000-7fb0c3f15000 ---p 00004000 fd:00 33622816                   /usr/lib64/libuuid.so.1.3.0
7fb0c3f15000-7fb0c3f16000 r--p 00003000 fd:00 33622816                   /usr/lib64/libuuid.so.1.3.0
7fb0c3f16000-7fb0c3f17000 rw-p 00004000 fd:00 33622816                   /usr/lib64/libuuid.so.1.3.0
7fb0c3f17000-7fb0c3f53000 r-xp 00000000 fd:00 33622914                   /usr/lib64/libblkid.so.1.1.0
7fb0c3f53000-7fb0c4152000 ---p 0003c000 fd:00 33622914                   /usr/lib64/libblkid.so.1.1.0
7fb0c4152000-7fb0c4155000 r--p 0003b000 fd:00 33622914                   /usr/lib64/libblkid.so.1.1.0
7fb0c4155000-7fb0c4156000 rw-p 0003e000 fd:00 33622914                   /usr/lib64/libblkid.so.1.1.0
7fb0c4156000-7fb0c4157000 rw-p 00000000 00:00 0
7fb0c4157000-7fb0c416c000 r-xp 00000000 fd:00 33622807                   /usr/lib64/libz.so.1.2.7
7fb0c416c000-7fb0c436b000 ---p 00015000 fd:00 33622807                   /usr/lib64/libz.so.1.2.7
7fb0c436b000-7fb0c436c000 r--p 00014000 fd:00 33622807                   /usr/lib64/libz.so.1.2.7
7fb0c436c000-7fb0c436d000 rw-p 00015000 fd:00 33622807                   /usr/lib64/libz.so.1.2.7
...
```

status 包含了有关进程的一般信息：

```bash
cat status
Name:systemd
Umask:0000
Tgid:1
Ngid:0
Pid:1
PPid:0
TracerPid:0
Uid:0 0 0 0
Gid: 0 0 0 0
FDSize:128
Groups:
NStgid:1
NSpid:1
NSpgid:1
NSsid:1
VmPeak:257688 kB
VmSize:192120 kB
VmLck:0 kB
VmPin:0 kB
VmHWM:6400 kB
VmRSS:4808 kB
RssAnon:1584 kB
RssFile:3224 kB
RssShmem:0 kB
VmData:19032 kB
VmStk:132 kB
VmExe:1412 kB
VmLib:3728 kB
VmPTE:136 kB
VmSwap:952 kB
HugeTLBPages:0 kB
CoreDumping:0
THP_enabled:1
Threads:1
SigQ:0/128117
SigPnd:0000000000000000
ShdPnd:0000000000000000
SigBlk:7be3c0fe28014a03
SigIgn:0000000000001000
SigCgt:00000001800004ec
CapInh:0000000000000000
CapPrm:0000003fffffffff
CapEff:0000003fffffffff
CapBnd:0000003fffffffff
CapAmb:0000000000000000
NoNewPrivs:0
Seccomp:0
Speculation_Store_Bypass:vulnerable
Cpus_allowed:ffff
Cpus_allowed_list:0-15
Mems_allowed:00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000000，00000001
Mems_allowed_list:0
voluntary_ctxt_switches:685576
nonvoluntary_ctxt_switches:1178
```

其中不仅包括了 UID/GID 以及进程其他数值信息，还包含内存分配，进程能力，各个信号掩码的状态（待决，阻塞，等）。

stat 和 statm 以连串数字的形式，提供了进程及其内存消耗的更多状态信息。fd 子目录包含了一些文件，文件名都是数字。这些文件名表示进程的各个文件描述符。这里的每个文件都是一个符号链接，指向文件名对应的文件描述符在文件系统中的位置，当然得假定该描述符确实是文件。其他的文件类型，如果也能够通过文件描述符访问(如管道)，那么将给出个链接目标，如 `pipe:[1434]` 。此外，还有其他指向与进程相关的文件和命令的符号链接:

- cwd 指向进程当前工作目录。如果用户有适当的权限，则可以使用 `cd cwd` 切换到该目录，而无需知道 cwd 到底指向哪个目录。
- exe 指向包含了应用程序代码的二进制文件。
- root 指向进程的根目录。

/proc 不仅包含进程的信息，还包含了一些一般性的内容，如 iomem 和 ioports 提供了用于设备通信的内存地址和端口的有关信息。

```bash
cat iomem
00000000-00000fff : Reserved
00001000-0009ffff : System RAM
000a0000-000bffff : PCI Bus 0000:00
000c0000-000ce7ff : Video ROM
000f0000-000fffff : System ROM
00100000-2f7ae017 : System RAM
  01000000-01c00dc0 : Kernel code
  01c00dc1-024177ff : Kernel data
  0267f000-029fffff : Kernel bss
2f7ae018-2f7bf057 : System RAM
2f7bf058-2f7c0017 : System RAM
2f7c0018-2f7dfa57 : System RAM
2f7dfa58-39005fff : System RAM
39006000-39d63fff : Reserved
39d64000-3a01cfff : System RAM
3a01d000-3abc9fff : ACPI Non-volatile Storage
3abca000-3b5befff : Reserved
3b5bf000-3b5bffff : System RAM
3b5c0000-3b645fff : Reserved
3b646000-3bffffff : System RAM
3c000000-3dffffff : Reserved
40000000-4fffffff : PCI MMCONFIG 0000 [bus 00-ff]
  40000000-4fffffff : Reserved
50000000-fbffbfff : PCI Bus 0000:00
  e0000000-f1ffffff : PCI Bus 0000:08
    e0000000-efffffff : 0000:08:00.0
    f0000000-f1ffffff : 0000:08:00.0
      f1000000-f11d4fff : efifb
...
cat ioports
0000-0cf7 : PCI Bus 0000:00
  0000-001f : dma1
  0020-0021 : pic1
  0040-0043 : timer0
  0050-0053 : timer1
  0060-0060 : keyboard
  0061-0061 : PNP0800:00
  0064-0064 : keyboard
  0070-0071 : rtc0
  0080-008f : dma page reg
  00a0-00a1 : pic2
  00c0-00df : dma2
  00f0-00ff : fpu
    00f0-00f0 : PNP0C04:00
  02f8-02ff : serial
  03f8-03ff : serial
  0400-0403 : ACPI PM1a_EVT_BLK
  0404-0405 : ACPI PM1a_CNT_BLK
  0408-040b : ACPI PM_TMR
  0420-042f : ACPI GPE0_BLK
  0430-0433 : iTCO_wdt.0.auto
  0450-0450 : ACPI PM2_CNT_BLK
  0454-0457 : pnp 00:00
  0460-047f : iTCO_wdt.0.auto
  0500-057f : pnp 00:02
  0580-059f : 0000:00:1f.3
    0580-059f : pnp 00:02
      0580-059f : i801_smbus
...
```

类似的，一些文件提供了当前内存管理状况的粗略概览。buddyinfo 和 slabinfo 提供了伙伴系统和 slab 分配器的当前使用状况，而 meminfo 给出了一般性的内存使用情况，总内存，空闲内存，已分配内存，交换内存，共享区域，回写内存等。vmstat 给出了内存管理的其他特征，包括当前内存管理各个子系统中内存页的数目。

interrupts 保存了当前操作期间引发的中断的说明。其中不仅给出中断数目，还对每个中断号，给出了相关设备的名称或者中断处理程序。

```bash
cat interrupts
           CPU0       CPU1       CPU2       CPU3       CPU4       CPU5       CPU6       CPU7       CPU8       CPU9       CPU10      CPU11      CPU12      CPU13      CPU14      CPU15
  0:        120          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-IO-APIC   2-edge      timer
  8:          0          0          0          0          0          0          0          0          0          0          0          0          0          1          0          0  IR-IO-APIC   8-edge      rtc0
  9:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-IO-APIC   9-fasteoi   acpi
 18:          0          0         64          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-IO-APIC  18-fasteoi   ehci_hcd:usb1，ehci_hcd:usb2，i801_smbus
 26:          0          0          0         88          0          0          0          0          0          0          0          0          0          0          0          0  IR-IO-APIC  21-fasteoi   snd_hda_intel:card1
 27:          0          0          0   47874329          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 327680-edge      xhci_hcd
 28:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 5242880-edge      xhci_hcd
 29:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 5242881-edge      xhci_hcd
 30:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 5242882-edge      xhci_hcd
 31:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 5242883-edge      xhci_hcd
 32:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 5242884-edge      xhci_hcd
 33:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 5242885-edge      xhci_hcd
 34:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 5242886-edge      xhci_hcd
 35:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 5242887-edge      xhci_hcd
 36:          0          0          0          0          0          0          0          0          0          0          0          0   42607110          0          0          0  IR-PCI-MSI 5767168-edge      xhci_hcd
 37:          0          0          0          0          0          0          0          0          0          0          0        598          0          0         55  276072274  IR-PCI-MSI 409600-edge      eth-mange
 39:          0         11          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 360448-edge      mei_me
 40:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 2097152-edge      enp4s0
 41:          0          0         34          0          0          1          0          0          0          0          0          0          0    2103625          0          0  IR-PCI-MSI 2621440-edge      eth-heart
 42:          0          0   57018749          0          0          0         19          0          0          0          0          0          0          0          0        469  IR-PCI-MSI 3145728-edge      eth-service
 43:         17          0          0          0    1519201          0          0          1          0          0          0          0          0          0          0          0  IR-PCI-MSI 3670016-edge      eth-wifigw
 44:          0          0        717          0          0          0          0          0          0          0          0          0          0          0          0          0  IR-PCI-MSI 442368-edge      snd_hda_intel:card0
 46:          0          0          0          0          0          0    6131938          0          0          0          0          0          0          0         78          0  IR-PCI-MSI 4194304-edge      nvidia
 48:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  DMAR-MSI   0-edge      dmar0
 49:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0  DMAR-MSI   1-edge      dmar1
NMI:       2780       2224       2245       2157       2137       2121       2104       2217       1857       1816       1825       1791       1832       1831       1788       2336   Non-maskable interrupts
LOC:  433300356  429345247  457302412  437722924  441344798  434002656  432015345  434776052  423329985  424677384  422606229  417769274  421891248  435559863  413607939  481916427   Local timer interrupts
SPU:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Spurious interrupts
PMI:       2780       2224       2245       2157       2137       2121       2104       2217       1857       1816       1825       1791       1832       1831       1788       2336   Performance monitoring interrupts
IWI:          0          1          0          0          0          0          2          1          0          0          0          1          1          0          0          2   IRQ work interrupts
RTR:          5          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   APIC ICR read retries
RES:   74472650   16932032    5114688    2549839    2040440    1731617    1649749    1658706    1557117    1501392    1461381    1485469    1519270    1507120    1516898    2085564   Rescheduling interrupts
CAL:    9448043    9229567    9268374    9302406    9363137    9393311    9363026    9424404    9003492    8957503    8994174    8898119    8892964    8759141    8922722    8683982   Function call interrupts
TLB:   12034456   12188838   12247965   12196588   12302215   12343219   12252331   12436445   12096334   12112658   12178260   12088858   12123932   11800291   12130182   11829129   TLB shootdowns
TRM:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Thermal event interrupts
THR:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Threshold APIC interrupts
DFR:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Deferred Error APIC interrupts
MCE:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Machine check exceptions
MCP:       6426       6427       6427       6427       6427       6427       6427       6427       6427       6427       6427       6427       6427       6427       6427       6427   Machine check polls
HYP:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Hypervisor callback interrupts
HRE:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Hyper-V reenlightenment interrupts
HVS:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Hyper-V stimer0 interrupts
ERR:          0
MIS:          0
PIN:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Posted-interrupt notification event
NPI:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Nested posted-interrupt event
PIW:          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0          0   Posted-interrupt wakeup event
```

最后，我们还得提一下两个重要的数据项 loadavg 和 uptime。前者给出了过去 60 秒，5 分钟，15 分钟的平均系统负荷，后者给出了系统的运行时间，从系统启动经过的时间。

/proc/net 子目录提供了内核的各种网络选项的有关数据。其中保存了各种协议和设备数据，包括以下几个有趣的数据项。

- udp 和 tcp 提供了 IPv4 的 UDP 和 TCP 套接字的统计数据。IPv6 的对应数据保存在 udp6 和 tcp6 中。UNIX 套接字的统计数据记录在 unix。
- 用于反向地址解析的 ARP 表，可以在 arp 文件中查看。
- dev 保存了通过系统的网络接口传输的数据量的统计数据。该信息可用于检查网络的传输质量，因为其中也包括了传输不正确的数据包、被丢弃的数据包和冲突相关的数据。

用于动态地检查和修改内核行为的系统控制参数，在 proc 文件系统的数据项中，属于最多的一部分。sysctl 参数由一个独立的子目录 /proc/sys 管理，它进一步划分为各种子目录，对应于内核的各个子系统。

```bash
ls -l
total 0
dr-xr-xr-x 1 root root 0 Nov 18 17:30 abi
dr-xr-xr-x 1 root root 0 Nov 18 17:30 debug
dr-xr-xr-x 1 root root 0 Nov 18 17:30 dev
dr-xr-xr-x 1 root root 0 Oct 25 08:17 fs
dr-xr-xr-x 1 root root 0 Nov 18 17:30 fscache
dr-xr-xr-x 1 root root 0 Oct 25 08:17 kernel
dr-xr-xr-x 1 root root 0 Nov 18 17:29 net
dr-xr-xr-x 1 root root 0 Nov 18 17:30 sunrpc
dr-xr-xr-x 1 root root 0 Nov 18 17:30 user
dr-xr-xr-x 1 root root 0 Nov 18 17:30 vm
```

各个子目录中包含了一系列文件，反映了对应的内核子系统的特征数据，例如 /proc/sys/vm 包含如下数据项：

```bash
ls -l
total 0
-rw-r--r-- 1 root root 0 Nov 18 17:34 admin_reserve_kbytes
-rw-r--r-- 1 root root 0 Nov 18 17:34 block_dump
--w------- 1 root root 0 Nov 18 17:34 compact_memory
-rw-r--r-- 1 root root 0 Nov 18 17:34 compact_unevictable_allowed
-rw-r--r-- 1 root root 0 Nov 18 17:34 dirty_background_bytes
-rw-r--r-- 1 root root 0 Nov 18 17:34 dirty_background_ratio
-rw-r--r-- 1 root root 0 Nov 18 17:34 dirty_bytes
-rw-r--r-- 1 root root 0 Nov 18 17:34 dirty_expire_centisecs
-rw-r--r-- 1 root root 0 Nov 18 17:34 dirty_ratio
-rw-r--r-- 1 root root 0 Nov 18 17:34 dirty_writeback_centisecs
-rw-r--r-- 1 root root 0 Nov 18 17:34 dirtytime_expire_seconds
...
```

不同于前面讨论的文件，这里的这些文件不仅可以读，还可以通过普通的文件操作，向其中写入新值，例如 `echo "80" > /proc/sys/vm/swappiness` 。

#### sysfs

kobject（内核对象）包含在一个层次化的组织中。 它们可以有一个父对象，可以包含到一个 kset 中。这决定了 kobject 现在 sysfs 层次结构中的位置: 如果存在父对象，那么需要在父对象对应的目录中新建一项。否则，将其放置到 kobject 所在的 kset 所属的 kobject 对应的目录中。

- 每个 kobject 在 sysfs 中都表示为个目录。出现在该目录中的文件是对象的属性。用于导出和设置属性的操作由对象所属的子系统提供(类、驱动程序，等等)。
- 总线、设备、驱动程序和类是使用 kobject 机制的主要内核对象，因而也占据了 sysfs 中几乎所有的数据项。

### 扩展属性和 ACL

传统 UNIX 和 Linux 使用自主访问控制模型来判断哪些用户可以访问给定的资源，资源指文件系统中的文件。尽管该方法工作得很好，但它是一种非常粗粒度的安全手段，在某些环境中可能是不适用的。

为了解决这个问题，我们可以通过 ACL 向文件系统对象提供更细粒度的访问控制手段，即为每个对象附加一个访问控制规则的列表。一般来说我们会通过扩展属性来实现 ACL，扩展属性方法能够向文件系统对象增加额外的、更复杂的属性。

#### 扩展属性

从文件系统用户的角度来看，一个扩展属性就是与文件系统对象关联的个“名称/值”对。名称是个普通的字符串，内核对值的内容不作限制。它可以是文本串，但也可以包含任意的二进制数据。属性可以定义，也可以不定义(如果文件没有关联属性，就是这种情形)。如果定义了属性，可以有值，也可以没有。属性名称会按命名空间细分。这意味着，访问属性也要给出命名空间。按照符号约定，用一个点来分隔命名空间和属性名(例如 user.mime\_type)。

内核提供了几个系统调用来读写扩展属性，它们都是作用于 inode：

- setxattr 用于设置或替换某个扩展属性的值，或创建个新的扩展属性
- getxattr 获取某个扩展属性的值
- removexattr 删除一个扩展属性
- listxattr 列出与给定的文件系统对象相关的所有扩展属性

#### ACL

POSIX 访问控制表 (ACL) 是 POSIX 标准定义的一种扩展，用于细化 Linux 的自主访问控制 (DAC) 模型。ACL 借助扩展属性实现，但是它自成一派，ACL 用到的拓展属性被称为 ACL 专用拓展属性，修改 ACL 拓展属性所用的方法与其他普通扩展属性也是相同的。内核对其他普通扩展属性的内容并不感兴趣，但 ACL 扩展属性将被内核集成到 inode 的权限检查中。

用户层函数 getfacl、setfacl 和 chacl 可以用于获取、设置和修改 ACL 的内容。它们使用可以操作扩展属性的标准系统调用，并不需要与内核进行非标准交互。除了用户应用访问文件时会受到 ACL 的权限检查外，许多其他实用程序（如 ls）都内建了对访问控制表的支持。

下面我们介绍一个 ACL 的例子，下列是某一文件的 getfacl 输出内容，这里面的 `user` `user:joe` 等就是前面提到的 ACL 扩展属性，而后面的 `rwx` 就是扩展属性的值，这里我们可以看到用户组 `group:cool` 的权限被限制为只读 `r--` ，有效属性是 `r-x` ，other 属性没有权限限制 `other::rwx` ，那么当我们以 cool 组的账号访问该文件时，ACL 会检查发现该组用户具有读权限，但是没有执行权限，写权限的 ACL 检查被跳过，但是由于 other 中存在该权限，所以最后 cool 组的用户也有写权限。这里要注意 ACL 检查和 other 检查结果是要相与的（ACL 检查 & other），只有所有条件都满足时，才能得到相应的权限。

```
1:  # file: somedir/
 2:  # owner: lisa
 3:  # group: staff
 4:  # flags: -s-
 5:  user::rwx  # 文件创建者权限
 6:  user:joe:rwx  # 用户 joe 的权限
 7:  group::rwx # 文件创建者所在组权限
 8:  group:cool:r-- # 组 cool 的权限
 9:  mask::r-x # 有效权限(mask) 即用户（joe）或组（cool）所设置的权限必须要存在于 mask 的权限设置范围内才会生效，创建人，创建人所在的组，other 的检查不受 mask 的限制
10:  other::rwx # 其他用户权限
```

## 参考内容

\[1\]《Linux内核设计与实现》  
\[2\]《Linux系统编程》  
\[3\]《深入理解Linux内核》  
\[4\]《深入Linux内核架构》  
\[5\] [Linux 内核进程管理之进程ID](https://www.cnblogs.com/hazir/p/linux_kernel_pid.html)  
\[6\] [服务器三大体系SMP、NUMA、MPP介绍](http://server.51cto.com/sCollege-198840.htm)  
\[7\] [Linux中的物理内存管理 \[一\]](https://zhuanlan.zhihu.com/p/68465952)  
\[8\] [Linux内核中的page migration和compaction机制简介](http://www.voidcn.com/article/p-ahfmecnz-brq.html)  
\[9\] [物理地址、虚拟地址（线性地址）、逻辑地址以及MMU的知识](https://blog.csdn.net/macrossdzh/article/details/5954763)  
\[10\] [逻辑地址](https://baike.baidu.com/item/%E9%80%BB%E8%BE%91%E5%9C%B0%E5%9D%80)  
\[11\] [linux内核学习笔记-struct vm\_area\_struct](https://blog.csdn.net/ywf861029/article/details/6114794)  
\[12\] [Linux中匿名页的反向映射](http://liujunming.top/2017/09/03/Linux%E4%B8%AD%E5%8C%BF%E5%90%8D%E9%A1%B5%E7%9A%84%E5%8F%8D%E5%90%91%E6%98%A0%E5%B0%84/#%E5%8F%8D%E5%90%91%E6%98%A0%E5%B0%84%E7%9A%84%E5%BC%95%E5%85%A5)  
\[13\] [系统调用过程详解](https://blog.csdn.net/sodawaterer/article/details/53456516)  
\[14\] [再谈Linux内核中的RCU机制](http://www.voidcn.com/article/p-odbijlps-bob.html)  
\[15\] [Unix domain socket 和 TCP/IP socket 的区别](https://jaminzhang.github.io/network/the-difference-between-unix-domain-socket-and-tcp-ip-socket/)  
\[16\] [Linux通用块设备层](https://www.ilinuxkernel.com/files/Linux.Generic.Block.Layer.pdf)  
\[17\] [ext2文件系统结构分析](https://blog.csdn.net/YuZhiHui_No1/article/details/50256713)  
\[18\] [linux ACL权限规划：getfacl,setfacl使用](https://blog.51cto.com/guodong810/1176427)  
\[18\] [查找——图文翔解RadixTree（基数树）](https://blog.csdn.net/yang_yulei/article/details/46371975)  
\[19\] [页缓存page cache和地址空间address\_space](http://roux.top/2017/10/28/page%20cache%E5%92%8Caddress_space/)  
\[20\] [rocketmq使用的系统参数（dirty\_background\_ration dirty\_ratio）](https://blog.csdn.net/arkblue/article/details/45796551)  
\[21\] [Linux内存调节之zone watermark](https://zhuanlan.zhihu.com/p/73539328)  
\[22\] [Linux的内存回收和交换](https://blog.csdn.net/renwotao2009/article/details/51979343)  
\[23\] [Linux中的内存回收\[一\]](https://zhuanlan.zhihu.com/p/70964195)  
\[24\] [linux内存源码分析 - 内存回收(整体流程)](https://www.cnblogs.com/tolimit/p/5435068.html)  
\[25\] [Linux 软中断机制分析](https://blog.csdn.net/li_wen01/article/details/82659406)  
\[26\] [对 jiffies 溢出、回绕及 time\_after 宏的理解](https://blog.csdn.net/DLUTBruceZhang/article/details/9919453)  
\[27\] [learn-linux-network-namespace](https://github.com/caisan/myblog/blob/master/learn-linux-network-namespace.md)  
\[28\] [显式拥塞通知](https://zh.wikipedia.org/wiki/%E6%98%BE%E5%BC%8F%E6%8B%A5%E5%A1%9E%E9%80%9A%E7%9F%A5)  
\[29\] [聊聊 TCP 长连接和心跳那些事](https://www.cnkirito.moe/tcp-talk/)  
\[30\] [关于 TCP/IP，必知必会的十个问题](https://juejin.im/post/598ba1d06fb9a03c4d6464ab)  
\[31\] [TCP协议三次握手连接四次握手断开和DOS攻击](https://blog.csdn.net/fw0124/article/details/7452695)  
\[32\] [TCP 的那些事儿（上）](https://coolshell.cn/articles/11564.html)  
\[33\] [TCP 的那些事儿（下）](https://coolshell.cn/articles/11609.html)

END

引言

文件系统种类

Ext 文件系统

Ext2

Ext3

无持久存储文件系统

proc

sysfs

扩展属性和 ACL

扩展属性

ACL

参考内容

**

**

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
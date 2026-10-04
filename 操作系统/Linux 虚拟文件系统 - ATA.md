---
title: "Linux 虚拟文件系统 - ATA"
source: "https://ata.atatech.org/articles/11000192100?layout=%2Fvelocity%2Flayout%2Fblank.vm"
author:
published:
created: 2026-04-08
description:
tags:
  - "clippings"
---
## Linux 虚拟文件系统

2021-01-11发表2021-06-11更新185次浏览




## 引言

本文整理了 Linux 内核中虚拟文件系统的相关知识，其他 Linux 相关文章均收录于 [贝贝猫的文章目录](https://www.atatech.org/articles/192584) 。

## 虚拟文件系统

为了支持各种本机文件系统，且同时允许访问其他操作系统的文件，Linux 内核在用户进程与实际文件系统实现之间引入了一个抽象层，该层称为虚拟文件系统。它的任务并不简单，一方面它要提供一套管理所有文件，目录的统一方法。另一方面它要和具体文件系统支持的功能达成妥协，因为每种文件系统实现都差别迥异。

![[2e802e0f-d4bf-4fee-abc6-447ff23195a2.png|virtual-file-system]]

virtual-file-system

### 文件系统类型

文件系统一般分为如下三种：

1. 基于磁盘的文件系统，在非易失介质上存储文件的经典方法。
2. 虚拟文件系统，内核生成的虚拟结构，可用于与用户通信，比如 proc 文件系统。
3. 网络文件系统，允许通过网络访问另一台计算机上的数据。

正是因为虚拟文件系统的存在，上层应用才不会看到本地文件系统与网络文件系统的区别，它们可以通过一套统一的接口操作下层文件系统上的文件，比如打开，读，写，删除等。

### 通用文件模型

VFS 不仅为文件系统提供了方法和抽象，还支持文件系统中对象(或文件)的统一视图。文件这个术语的含义看起来似乎很清楚，但由于各个文件系统的底层实现不同，其语义经常有许多小而微妙的差异。并非所有文件系统都支持同样的功能，而有些操作(对“普通”文件是不可缺少的)对某些对象完全没有意义，例如集成到 VFS 中的命名管道。

并非每一种文件系统都支持 VFS 中的所有抽象。设备文件无法存储在源自其他系统的文件系统中(如FAT)，后者的设计没有考虑到此类对象。

如果我们定义一个最小的通用模型，来支持内核中所有文件系统都实现的那些功能，显然不太好。因为这样会损失许多本质性的功能特性，或者导致这些特性只能通过特定文件系统访问。VFS 的方案完全相反: 提供一种结构模型，包含了一个强大文件系统所应具备的所有组件。但该模型只存在于虚拟中，必须使用各种对象和函数指针与每种文件系统适配。所有文件系统的实现都必须提供与 VFS 定义的结构配合的接口，以弥合两种视图之间的差异。

在处理文件时，内核空间和用户空间使用的主要对象是不同的。对用户程序来说，一个文件由一个文件描述符标识。该描述符是一个整数，在所有有关文件的操作中用作标识文件的参数。文件描述符是在打开文件时由内核分配，只在一个进程内部有效。两个不同进程可以使用同样的文件描述符，但二者并不指向同一个文件。基于同一个描述符来共享文件是不可能的。

内核处理文件的关键是 inode。每个文件(和目录)都有且只有一个对应的 inode，其中包含元数据(如访问权限、上次修改的日期，等等)和指向文件数据的指针。除了 inode 之外，VFS 中还有一个目录项的概念，它用来描述一个路径中的各个部分，可以代表一个目录或者文件，这里我们以 `/usr/bin/emac` 为例，为了查找其对应的 inode，会从 `/` 目录项出发，该目录项中包括它所对应的 inode，以及该目录或文件的名称。为了在其中查找 `usr` 目录，内核会搜索 `/` inode 指向的数据内容，这里包括了在 `/` 目录下包含的所有目录和文件。就这样，内核不断地重复上述过程就找到了目标文件对应的 inode。最后一个 inode `emacs` 和前三个 inode 不同，前三个都是目录，其 inode 指向的内容是目录列表，而 emacs 文件的 inode 指向的数据是文件的内容。这就是 VFS 查找一个文件的简略过程。

![[83e8c899-39e0-442b-bd87-fe2ab2aa6f2b.png|vfs-find-file]]

vfs-find-file


除了 inode 和目录项之外，VFS 中还有一个链接的概念，它用于创建文件系统对象之间的联系，有两种链接的类型，分别是软链接和硬链接。

软链接可以认为是方向指针，它描述了某个文件存在于某一特定的位置，实际文件的位置很可能在其他地方，这有点像 Windows 中的快捷方式。每个软链接都有一个独立的 inode，inode 指向的数据包含了一个字符串，指向链接的目标路径。当目标文件删除时，软链接也不会删除。

和软链接不同，软链接可以区分原始文件和链接，而硬链接无法区分，当硬链接建立后，所有硬链接具有完全相同的地位，硬链接的目录项会指向原始文件的 inode，这和软链接有很大的不同，软链接有自己独立的 inode，这个 inode 中记录了目标文件的路径。硬链接的删除也很不同，对软连接来说被删除不会影响到原始文件，而如果硬链接如果被删除，其对应的原始文件 inode 的引用数就会减一，当 inode 的引用数为 0 时，代表当前没有任何一个硬链接指向该 inode，这时候该 inode 就会被删除。

当用户通过系统调用（传入文件路径）打开一个文件时，内核会为该文件分配一个文件描述符，实际上它是一个起始于 3 的整数（0，1，2 分别被标准输入，标准输出，标准错误占用），当文件打开后，所有对文件的操作都已和文件路径无关了，接下来用户进程需要通过该文件描述符来进行进一步的操作，比如读写。

在 Linux 中有一个万物皆文件的设计思想，除了少数部分（网络设备）之外，内核中大部分的导出功能都可以通过 VFS 定义的文件接口访问，例如：

- 字符和块设备
- 进程间通讯管道
- 用于交互式输入输出的终端
- 用于网络协议的套接字

值得一提的是，并不是所有上述对象都能够在 VFS 中以文件的形式显示给用户，例如管道是通过特殊系统调用创建的，它无法在文件目录结构中找到对应的项，但是它实际上是由 VFS 管理的。

VFS 由两个部分组成：文件和文件系统，这些都需要管理和抽象。下图展示了 VFS 各个组件的相互关系，其中主要包括了进程打开文件的管理，下层文件系统的管理，文件 inode 管理，以及文件内存映射地址空间的管理。

![[4df62fd0-e7c3-46fb-9320-0d68bf94a710 1.png|vfs-all-kinds-of-component]]

vfs-all-kinds-of-component


因为打开的文件总是分配到系统中一个特定的进程，内核必须在数据结构中存储文件和进程之间的关联。task_struct 包含一个成员，其中保存了所有打开的文件(通过一种迂回方式)。该成员是一个数组，访问时使用文件描述符作为索引。各个数组项包含的对象不仅关联到对应文件的 inode，还包含一个指针，指向用于加速查找操作的目录项缓存的一个成员。

VFS 支持的文件系统类型通过一种特殊的内核对象连接进来，该对象提供了一种读取超级块的方法。除了文件系统的关键信息(块长度、最大文件长度，等等)之外，超级块还包含了读、写、操作 inode 的函数指针。

内核还建立了一个链表，包含所有活动文件系统的超级块实例。之所以使用活动(active)这个术语替代已装载(mounted)，是因为在某些环境中，有可能使用一个超级块对应几个装载点（一个文件系统被装载到多个目录）。内核以树形结构来组织装载点，下图给出了 3 种不同的文件系统，全局根目录 / 使用了 Ext2 文件系统，/mnt 为 Reiserfs 文件系统， 而 /mnt/cdrom 使用了 ISO9660 格式，这通常用于光盘。其中 /mnt /mnt/cdrom 被称为装载点，因为这是装载文件系统的位置。将文件系统装载到一个目录时，装载点的内容会被替换为即将装载的文件系统的相对根目录内容。该目录之前的内容将会消失，直到新文件系统卸载才会重现(在此期间，旧文件系统的数据不会丢失，只是无法查看)。

![[6d74a340-14bd-4440-b8b9-873349335a12.png|vfs-mount-tree]]

vfs-mount-tree


超级块结构的一个重要成员是一个列表，包括相关文件系统中所有修改过的 inode(脏inode)。根据该列表很容易标识已经修改过的文件和目录，以便将其回写到存储介质。回写必须经过协调，保证在一定程度上最小化开销，因为这是一个非常费时的操作(硬盘、软盘驱动器及其他介质与系统其余组件相比，速度很慢)。另一方面，如果写回修改数据的间隔太长也可能有严重后果，因为系统崩溃(或者停电)会导致不能恢复的数据丢失。内核会周期性扫描脏块的列表，并将修改传输到底层硬件。

## 参考内容

[1]《Linux内核设计与实现》
[2]《Linux系统编程》
[3]《深入理解Linux内核》
[4]《深入Linux内核架构》
[5] [Linux 内核进程管理之进程ID](https://www.cnblogs.com/hazir/p/linux_kernel_pid.html)
[6] [服务器三大体系SMP、NUMA、MPP介绍](http://server.51cto.com/sCollege-198840.htm)
[7] [Linux中的物理内存管理 [一]](https://zhuanlan.zhihu.com/p/68465952)
[8] [Linux内核中的page migration和compaction机制简介](http://www.voidcn.com/article/p-ahfmecnz-brq.html)
[9] [物理地址、虚拟地址（线性地址）、逻辑地址以及MMU的知识](https://blog.csdn.net/macrossdzh/article/details/5954763)
[10] [逻辑地址](https://baike.baidu.com/item/%E9%80%BB%E8%BE%91%E5%9C%B0%E5%9D%80)
[11] [linux内核学习笔记-struct vm_area_struct](https://blog.csdn.net/ywf861029/article/details/6114794)
[12] [Linux中匿名页的反向映射](http://liujunming.top/2017/09/03/Linux%E4%B8%AD%E5%8C%BF%E5%90%8D%E9%A1%B5%E7%9A%84%E5%8F%8D%E5%90%91%E6%98%A0%E5%B0%84/#%E5%8F%8D%E5%90%91%E6%98%A0%E5%B0%84%E7%9A%84%E5%BC%95%E5%85%A5)
[13] [系统调用过程详解](https://blog.csdn.net/sodawaterer/article/details/53456516)
[14] [再谈Linux内核中的RCU机制](http://www.voidcn.com/article/p-odbijlps-bob.html)
[15] [Unix domain socket 和 TCP/IP socket 的区别](https://jaminzhang.github.io/network/the-difference-between-unix-domain-socket-and-tcp-ip-socket/)
[16] [Linux通用块设备层](https://www.ilinuxkernel.com/files/Linux.Generic.Block.Layer.pdf)
[17] [ext2文件系统结构分析](https://blog.csdn.net/YuZhiHui_No1/article/details/50256713)
[18] [linux ACL权限规划：getfacl,setfacl使用](https://blog.51cto.com/guodong810/1176427)
[18] [查找——图文翔解RadixTree（基数树）](https://blog.csdn.net/yang_yulei/article/details/46371975)
[19] [页缓存page cache和地址空间address_space](http://roux.top/2017/10/28/page%20cache%E5%92%8Caddress_space/)
[20] [rocketmq使用的系统参数（dirty_background_ration dirty_ratio）](https://blog.csdn.net/arkblue/article/details/45796551)
[21] [Linux内存调节之zone watermark](https://zhuanlan.zhihu.com/p/73539328)
[22] [Linux的内存回收和交换](https://blog.csdn.net/renwotao2009/article/details/51979343)
[23] [Linux中的内存回收[一]](https://zhuanlan.zhihu.com/p/70964195)
[24] [linux内存源码分析 - 内存回收(整体流程)](https://www.cnblogs.com/tolimit/p/5435068.html)
[25] [Linux 软中断机制分析](https://blog.csdn.net/li_wen01/article/details/82659406)
[26] [对 jiffies 溢出、回绕及 time_after 宏的理解](https://blog.csdn.net/DLUTBruceZhang/article/details/9919453)
[27] [learn-linux-network-namespace](https://github.com/caisan/myblog/blob/master/learn-linux-network-namespace.md)
[28] [显式拥塞通知](https://zh.wikipedia.org/wiki/%E6%98%BE%E5%BC%8F%E6%8B%A5%E5%A1%9E%E9%80%9A%E7%9F%A5)
[29] [聊聊 TCP 长连接和心跳那些事](https://www.cnkirito.moe/tcp-talk/)
[30] [关于 TCP/IP，必知必会的十个问题](https://juejin.im/post/598ba1d06fb9a03c4d6464ab)
[31] [TCP协议三次握手连接四次握手断开和DOS攻击](https://blog.csdn.net/fw0124/article/details/7452695)
[32] [TCP 的那些事儿（上）](https://coolshell.cn/articles/11564.html)
[33] [TCP 的那些事儿（下）](https://coolshell.cn/articles/11609.html)

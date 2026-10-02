---
title: "Linux 系统调用 - ATA"
source: "https://ata.atatech.org/articles/11000192097?layout=%2Fvelocity%2Flayout%2Fblank.vm"
author:
published:
created: 2026-04-08
description:
tags:
  - "clippings"
---
中国电商事业群-飞猪

粉丝 190影响力 1.9k

** 3

** 4

** 1

** 原创文章

开放访问

**

复制专用链接

**

## Linux 系统调用

[陈阳(逸殊)](https://ata.atatech.org/users/11000967975)

2021-01-11发表2023-03-31更新184次浏览

** 字号

** 笔记

** 分享 **

## 引言

本文整理了 Linux 内核中系统调用的相关知识，其他 Linux 相关文章均收录于 [贝贝猫的文章目录](https://www.atatech.org/articles/192584) 。  

## 系统调用实现

既然前面在介绍缺页异常的时候引到了系统调用的知识，这里我们就紧接着介绍一下 Linux 的系统调用。从某种角度来看，可以将内核视作个综合性的库，它包含了各种可向用户层应用程序提供的功能。系统调用是应用程序与该库之间的接口。通过调用系统调用，应用程序可以向内核请求一个服务，内核接下来满足该请求。

### 设计基础

基本上，我们都是通过标准库来开发自己的软件，标准库提供了各种基本函数，这些基本函数下层可能就是组合了数个系统调用。因为通用编程语言正在向越来越高的抽象层次发展，所以大家可能对这些系统调用没有那么直观的感受。但是在有些情况下，软件开发者必须充分了解系统底层的原理，才能让软件更有效率的运行，比如数据库。

#### 追踪系统调用

下例展示了使用标准库的程序例子，通过追踪其执行过程，你就会发现在标准库函数之下，实际上隐藏了很多的系统调用：

```cpp
#include<stdio.h>
#include<fcntl.h>
#include<unistd.h>
#include<malloc.h>
int main() {
    int handle，bytes;
    void* ptr;
    handle = open("/tmp/test.txt"，O_RDONLY);
    ptr = (void*)malloc(150);
    bytes = read(handle，ptr，150);
    printf("%s"，ptr);
    close(handle);
    return 0;
}
```

上例程序打开文件 `/tmp/test/txt` ，读取了前 150 个字节然后打印到标准输出，这是 UNIX head 命令的一个简单版本。我们可以通过 strace 工具来追踪该程序的运行过程 `strace -o log.txt ./shead` 。

```
execve("./shead"，["./shead"]，[/* 27 vars */]) = 0
uname(sys="Linux"，node="jupiter"，...) = 0
brk(0) = 0x8049750
old_mmap(NULL，4096，PROT_READ|PROT_WRITE，...，-1，0) = 0x40017000
open("/etc/ld.so.preload"，O_RDONLY) = -1 ENOENT (No such file or directory)
open("/etc/ld.so.cache"，O_RDONLY) = 3
fstat64(3，st_mode=S_IFREG|0644，st_size=85268，...) = 0
old_mmap(NULL，85268，PROT_READ，MAP_PRIVATE，3，0) = 0x40018000
close(3) = 0
open("/lib/i686/libc.so.6"，O_RDONLY) = 3 # 打开 C 标准库文件
read(3，"\177ELF\1\1\1\0\0\0\0\0\0\0\0\0\3\0\3\0\1\0\0\0\200\302"...，1024) = 1024
fstat64(3，st_mode=S_IFREG|0755，st_size=5634864，...) = 0
old_mmap(NULL，1242920，PROT_READ|PROT_EXEC，MAP_PRIVATE，3，0) = 0x4002d000
mprotect(0x40153000，38696，PROT_NONE) = 0
old_mmap(0x40153000，24576，PROT_READ|PROT_WRITE，...，3，0x125000) = 0x40153000 # C 标准库的动态映射
old_mmap(0x40159000，14120，PROT_READ|PROT_WRITE，...，-1，0) = 0x40159000 # C 标准库的动态映射
close(3) = 0
munmap(0x40018000，85268) = 0
getpid() = 10604
open("/tmp/test.txt"，O_RDONLY) = 3 # 打开文件的系统调用
brk(0) = 0x8049750 # 堆的系统调用
brk(0x8049800) = 0x8049800 # 堆的系统调用
brk(0x804a000) = 0x804a000 # 堆的系统调用
read(3，"A black cat crossing your path s"...，150) = 109 # 读文件
fstat64(1，st_mode=S_IFCHR|0620，st_rdev=makedev(136，1)，...) = 0
mmap2(NULL，4096，PROT_READ|PROT_WRITE，MAP_PRIVATE|MAP_ANONYMOUS，-1，0) = 0x40018000
ioctl(1，TCGETS，B38400 opost isig icanon echo ...) = 0
write(1，"A black cat crossing your path s"...，77) = 77 # 写到标准输出
write(1，" -- Groucho Marx\n"，32) = 32
munmap(0x40018000，4096) = 0
_exit(0) = ？
```

跟踪记录显示，该应用程序进行了大量源代码中没有明确列出的系统调用。这说明了应用程序与内核之间强烈的依赖关系，上例反复使用了系统调用。

#### 标准

在所有类型的 UNIX 操作系统中，系统调用都是特别重要的。系统调用的作用范围、速度、高效实现是影响系统性能的一个主要因素。Linux 中系统调用的实现非常高效而且种类繁多。在 UNIX 大家庭中，有很多的标准，这些标准使得不同系统的接口具有一致性。这样上层应用程序就可以在多个 UNIX 系统中兼容。

POSIX标准(这是Portable Operating System Interface for UNIX)已经成为该领域的主导标准。Linux 和 C 标准库尽力遵循 POSIX 标准。从20世纪80年代末POSIX第一个版本发布以来，该标准涵盖的范围急速扩展，现在许多程序员认为它已经太长也太复杂。

除了POSIX之外，还有其他标准，这些不是由某个委员会制定的，而是来源于 UNIX 和类 UNIX 操作系统的开发。在 UNIX 的历史中，两条开发主线产生了两个独立的系统，一个是SystemV(直接起源于AT&T的原始代码)，另一个是BSD (Berkeley Software Distribution，在加州大学开发，现在市场上的 NetBSD、 FreeBSD、 OpenBSD 都是基于 BSD 的，还有基于BSD的商业系统，如 MacOS。Linux 提供的系统调用汲取自所有上述 3 个来源。

#### 系统调用的重启

在系统调用与信号（进程通讯机制之一，我们随后就介绍它）冲突时，会发生一个有趣的问题。如果在一个进程执行系统调用时，向该进程发送一个信号，那么在处理时，二者的优先级如何分配呢？应该等到系统调用结束再处理信号，还是中断系统调用，以便尽快将信号投递到该进程？第一种方案导致的问题显然比较少，也是比较简单的方案。但是，只有在所有系统调用都能够快速结束、不会让进程等待太长时间的情况下，这个方案才能正确运作。但有些情况下，系统调用不仅需要一定的执行时间，而且在最坏情况下，很可能使进程睡眠(例如，没有数据可供读取时)。对同时发生的信号而言，这意味着信号投递的严重延迟。因而，必须不惜任何代价防止这种情况。

如果我们采取第二种方案，将正在执行的系统调用中断，转而执行信号处理程序，正在进行的系统调用应该返回什么样的返回值呢？在通常的场景下，只有两种情况: 调用成功或者失败。在出错的情况下，将返回一个错误码，使用户进程能够确定错误的原因，并适当地做出反应。倘若系统调用被中断，则发生了第三种情况（被打断）: 必须通知应用程序。

在这种情况下，Linux(和其他System V变体) 下将使用 -EINTR 常数作为系统调用的返回值。该过程的副作用也很大。它迫使用户空间应用程序的程序员必须明确检查所有系统调用的返回值，并在返回值为 -EINTR 的情况下，重新启动被中断的系统调用，直至该调用不再被信号中断。用这种方法重启的系统调用称作可重启系统调用(restartable system call)，该技术则称为重启(restarting)。

上述方案将新信号的快速投递和系统调用的中断组合起来，但它并非是唯一的解决方案。BSD 内核将中断系统调用的执行并切换到用户态执行信号处理程序。在发生这种情况时，该系统调用不会有返回值，内核在信号处理程序结束后将自动重启该调用。因为该行为对用户应用程序是透明的，也不再需要重复实现对 -EINTR 返回值的检查和调用的重启，所以与 SystemV 方法相比，这种方案更受程序员的欢迎。

Linux 则兼容上述的两种方案，通过 SA\_RESTART 标志来开启 BSD 方案，可以在安装信号处理程序时按需对具体信号指定该标志。而 SystemV 提议的机制用作 Linux 的默认方案，之所以这么做是因为 BSD 机制偶尔会引发一些问题，如下列例子所示。

```cpp
#include <signal.h>
#include <stdio.h>
#include <unistd.h>

volatile int signaled = 0;

void handler (int signum) {
   printf("signaled called\n");
   signaled = 1;
}
int main() {
   char ch;
   struct sigaction sigact;
   sigact.sa_handler = handler;
   sigact.sa_flags = SA_RESTART;
   sigaction(SIGINT，&sigact，NULL);
   # 字面上看：当接收到信号或者从标准输入读入一个字符时就执行结束
   while (read(STDIN_FILENO，&ch，1) != 1 && !signaled);
}
```

如果在上例中采用 BSD 的方案，那么当我们给该进程发送信号后，进程不会立即结束，虽然信号处理程序会将 signaled 置为 1，但是因为 read 系统调用会被自动重启，所以如果用户不输入一个字符，该进程仍然不会关闭，这就和进程结束条件的字面含义冲突 `接收到信号或者标准输入读到一个字符就终止` 。

这个时候如果采用的是 SystemV 的方案就不会出现这个问题，当信号处理程序执行时，read 系统调用会被中断并返回 -EINTR，当信号处理程序执行结束时会将 signaled 置为 1，然后切换回原先的应用执行栈，它会重新检查退出条件，发现 `!signaled = 0` 后，会退出进程。

### 实现

在系统调用的实现中，不仅需要讨论提供所需函数的内核源代码，还需要阐述调用这些函数的方式。这些函数的调用方式与普通的 C 函数不同，因为需要跨越用户态和核心态的边界。这引发了各种问题，这些问题需要由平台相关的汇编语言代码处理。

#### 系统调用设计

实现系统调用的内核代码可以划分为两个不同的部分。

1. 系统调用执行实际任务的实际是一个 C 函数，与其余内核代码几乎没有差别。
2. 用于调用上述处理函数的部分则和体系结构直接相关，因而这部分使用汇编语言代码。

我们这里先来分析一下这个完成实际任务的部分，即 C 函数。我们知道，在系统调用的处理函数的更下层，是各个内核服务。这些底层服务散布在内核中的各个角落，因为这些函数都嵌入到了与其目的关系最密切的代码中。例如，所有文件相关的系统调用都在 fs/ 内核子目录下，因为它们与虚拟文件系统直接交互。同样地，所有的内存管理调用都在 mm/ 子目录的文件中。

系统调用的处理函数，在形式上有如下几个共同的特性。

- 每个函数的名称前缀都是 sys\_，每一个这样的函数对应了一个系统调用。
- 所有的处理函数都最多接受5个参数。这些参数在参数列表中指定，与普通的 C 函数相同。
- 所有的系统调用都在核心态执行。我们前面说过了，内核态不能随便直接访问用户态的内存。所以我们才使用 copy\_from\_user、copy\_to\_user 或其他同类函数，这些函数是为了确保在进行实际读写操作之前目标内存区必须在内核内存中，也就是说不能出现缺页异常。

在内核将控制权转移给处理函数后，控制流就进入了和平台无关的代码中，即不依赖于特定的 CPU 或体系结构。但因为各种原因，也有一些例外。有少量处理程序函数是针对各个平台分别实现的。

在返回结果时，处理程序函数无须进行特别的操作，简单的一个 return 后接返回值即可。在核心态和用户态之间的切换，由特定于平台的内核代码执行，这与中断处理函数是无关的。下图说明了这个过程，我们可以看到在调用真正的处理程序前后，都有一段内核代码，这些代码都是和体系结构相关的汇编代码，它们负责调用实际的处理函数，并将处理函数的返回值交给应用程序。  

![[225c5b1b-2e72-421a-8b13-d6bb765a0a3e.png|system-call-switch]]

system-call-switch

  
图中的处理程序大多是 C 语言实现的，其中有一些实现非常简单，就比如获取当前进程 UID 的系统调用 getuid：

```cpp
asmlinkage long sys_getuid(void)
{
    return current->uid;
}
```

介绍完处理实际任务的 C 函数部分之后，我们来详细地介绍一下上图中的其他部分，我们会按照从左到右的顺序介绍这个过程，这样理解起来更加容易。

当我们的应用程序调用一个 C 标准库的函数（假设该函数下层使用到了系统调用）之后，会涉及到从用户态到内核态的转换，调用实际处理任务的函数，以及参数传递，这些都是由汇编语言实现的，先说从用户态到内核态的转换，我们前面介绍进程周期性调度的时候也提过这个转换过程，那时是通过一个硬件（周期性时钟）触发了硬中断，进而打断当前的执行指令，转而进入内核态并执行中断处理程序。而在系统调用时，C 标注库帮我们做了类似的事，它通过一条专门的机器指令，引起处理器和内核的关注，进而转入内核态并开始处理系统调用。

#### 访问用户空间

尽管内核尽可能保持内核空间和用户空间的独立，但有些情况下，内核代码必须访问用户应用程序的虚拟内存。需要强调的一点是，内核访问应用虚拟内存需要应用进程和内核是同步（互斥）地访问，而不是异步的。如果是异步的，显然会出现问题。

对系统调用的处理就是内核与应用进程同步执行的一个典型的例子，应用进程指派给内核一个任务，然后该进程所处的 CPU 同步的切换到内核态同步地执行应用程序指派的任务。那么什么时候，内核必须访问应用程序的地址空间呢？

- 如果一个系统调用需要超过6个不同的参数，它们只能借助进程内存空间中的 C 结构实例来传递。系统调用将借助寄存器，将其指向该结构实例的一个指针传递给内核。
- 如果系统调用产生了多个返回数据，没法不能通过返回值机制传递给用户进程。必须通过指定的内存区交换该数据。当然，该内存区必须在用户空间中，使得用户应用程序能够访问。

前面我们提到过 Linux 一个约定：在内核访问自身的内存区时，虚拟地址和物理内存页之间的映射必须时刻存在的，不能出现被换出的情况。但用户空间的内存则不同，页可能被换出，甚至可能尚未分配物理内存页。因而，内核不能简单地反引用用户空间的指针，而必须采用特定的函数，确保目标内存区已经在物理内存中。为确保内核遵守了这种约定，内核在进行实际的系统调用前会将用户内存拷贝到内核（copy\_from\_user）。而当内核需要将一些内容拷贝到用户空间时会使用 copy\_to\_user。

下面概述了一些流行的体系结构上进行系统调用的方法。

- 在 IA-32 系统上，使用汇编语言指令 `int $0x80` 来引发软件中断 128。这是一个调用门(call gate)，CPU 会跳到对应的一个内核函数中来继续进行系统调用的处理。系统调用的函数名会以编号的形式传达给内核，这是通过寄存器 eax 来传递这个编号的，而参数则通过寄存器 ebx、ecx、edx、esi 和 edi 传递。
- PowerPC 处理器提供了一条优雅的汇编语言指令，称作sc(systemcall)。该指令专门用于实现系统调用。寄存器 r3 保存系统调用编号，而参数保存在寄存器 r4 到 r8 中。
- AMD64 体系结构在实现系统调用时，也提供了自身的汇编语言指令，其名称为 syscall。系统调用编号保存在 raw 寄存器中，而参数保存在 rdi、rsi、rdx、r10、r8 和 r9中。

上述的这些对汇编指令的调用都是 C 标准库帮我们实现的，我们的应用程序将参数传递给 C 标准库，C 标准库帮我们把相关参数存入寄存器，并发出和 CPU 体系结构对应的汇编指令，进而让 CPU 切换到内核态，并跳转到内核中的系统调用中枢处理函数。

然后内核面临的任务就是找到和系统调用编号对应的实际处理函数，并向该函数提供必要的参数。内核通过一个 sys\_call\_table 表来查找和系统调用编号对应的处理函数。IA-32 处理器上，对应的系统调用表如下：

```cpp
ENTRY(sys_call_table)
.long sys_restart_syscall /* 0 - old "setup()" system call，used for restarting */ .long sys_exit
.long sys_fork
.long sys_read
.long sys_write
.long sys_open /* 5 */
.long sys_close
...
.long sys_utimensat /* 320 */
.long sys_signalfd
.long sys_timerfd
.long sys_eventfd
.long sys_fallocate
```

内核在使用该表时，就像使用一个数组一样，sys\_call\_table 会指向上表的基地址，当系统调用编号是 5 时，内核就会将该基地址加上编号 5 就是对应处理函数的地址，在调用该处理函数之前，内核会将寄存器中保存的系统调用参数（还记得吗？系统调用通过寄存器传递参数）压入内核栈中，然后内核跳转到对应的处理函数中执行。

> 因为内核态和用户态使用两个不同的栈，用户栈在虚拟内存中，内核栈在 task\_struct 结构中保存。系统调用的参数不能像普通用户态进程那样直接在栈上传递，这两个栈之间的切换，在有的体系结构中是由 CPU 特权级别从用户态切换到内核态时 CPU 自动完成，而在其他体系结构中是由内核通过汇编语言完成。

系统调用实际处理函数返回值代表了这次系统调用的执行情况，一般来说负数表示错误，0 或者正数表示成功。从错误码到其实际语义的对应关系如下：

```cpp
#define EPERM /*操作不允许 */
#define ENOENT /*文件或目录不存在*/
#define ESRCH /*进程不存在*/
#define EINTR /*中断的系统调用 */
#define EIO /* I/0错误*/
#define ENXIO /*设备或地址不存在*/
#define E2BIG /*参数列表太长*/
#define ENOEXEC /*错误的可执行文件格式*/
#define EBADF /*错误的文件编号 */
#define ECHILD 12345678900 /*没有子进程*/
...
```

当系统调用的实际处理函数返回后，会将返回值放置在内核栈上，然后内核要负责将核心态转换回用户态，然后将系统调用的返回值传递给用户进程，这个返回值的传递和系统调用参数的传递类似，内核会将内核栈上的返回值复制到一个特定的处理器寄存器上（IA-32 上的 eax，Alpha 系统上的 a3 等），标准库会处理该寄存器并将寄存器中的返回值传递给应用程序。

这里还有一个问题，内核是如何跳转回用户进程的执行流中的呢？它怎么知道用户进程原来执行到哪一行的呢？这实际上也是通过内核栈来完成的，在调用实际的处理函数之前，内核不仅将参数寄存器压入内核栈，还将用户进程的指令执行相关的寄存器入栈，在需要返回用户进程的时候，通过栈内保存的内容恢复指令执行相关的寄存器，这个过程我们称之为现场保护和现场恢复。下图就整个系统调用的过程。  

![[b0de1d37-f3fd-4bdd-841d-08e963c4b286.png|system-call-stack]]

system-call-stack

  
在上图中，我们还能看到在系统调用处理函数中会判断是否需要执行调度，这一点我们在介绍系统调度的时候就提过，由于有的系统调用耗时较长（周期调度器已经希望收回其执行权，设置了 TIF\_NEED\_RESCHED，但是因为没开启内核抢占，所以只能等主动调度器来完成这部分工作），甚至会阻塞等待资源，这些时候就会执行调度程序，切换进程。

在系统调用结束后，会执行信号处理程序（如果有信号到来），我们之前也介绍了，Linux 默认会沿用 SystemV 的策略：信号到来会打断系统调用并返回 -EINTR，系统调用被打断后处理信号。

### 系统调用种类

在 linux 中每个系统调用都通过一个符号常数标识，符号常数的定义是和平台相关的。因为并非所有的体系结构都支持所有系统调用，不同平台的可用调用数目有一些不同，粗略地说，总共有 200 多个系统调用。接下来，我将按照功能对这些系统调用进行划分，其中很多功能可能还没有介绍到，所以这里大家没必要完全理解每个系统调用的作用，只需要知道系统调用是将内核的各个底层服务整合起来以统一的一套接口暴露给应用进程使用的。

- 进程管理：进程处于系统的中心，因此进程管理方面有大量系统调用。这些系统调用提供的功能很多，从查询简单的信息，到启动新进程，等等。
- 时间操作：时间操作很关键，不仅可用来查询和设置当前系统时间，还使进程能够执行基于时间的操作，如睡眠和定时器。
- 信号处理：信号是在进程之间交换有限信息以及促进进程间通信的最简单(也最古老)的方法。这里包括发送信号，检查信号等。
- 调度：与调度相关的系统调用都与系统进程有关，比如设置优先级获取优先级等。
- 模块：前面提到过模块可用于实现热插拔一些服务，所以这里的模块相关系统调用就包括了增加模块和移除模块。
- 文件系统：所有关于文件系统的调用都起始于 VFS 层（虚拟文件系统），它是对各类文件系统的一个上层抽象，从 VFS 开始，各个调用转发到具体的文件系统的实现中，进而访问块层（磁盘等）。它们包括文件的创建，删除，打开，关闭，读，写等。
- 内存管理：在通常的环境下，用户应用程序很少或从未接触到内存管理系统调用，因为这个领域被标准库的 API 屏蔽起来了，C 标准库提供了 malloc、balloc 和 calloc 等函数。实现通常与编程语言相关，因为每种语言都有不同的动态内存管理需求，还经常会提供垃圾收集这样的特性，需要对内核提供的内存进行精巧而复杂的分配。和内存相关的系统调用有内存映射，堆的修改等。
- 进程间通讯与网络：有两个系统调用用来处理进程间通讯和网络相关的任务，他们分别是 socketcall 和 ipc。
- 系统信息和设置：通常必须查询当前运行内核及其配置和系统配置的有关信息（sysinfo）。类似地，需要设置内核参数（sysctl），有些信息必须保存到系统日志文件（syslog）。
- 系统安全和能力：传统的 UNIX 安全模型基于用户、组和一个“万能的”root用户，对现代需求而言已经不够灵活。这就导致引入了能力系统，该系统根据细粒度方案，使得非 root 进程能够拥有额外的权限和能力。capset 和 capget 负责设置和查询进程的能力。此外，LSM (Linux security modules，Linux安全模块)子系统提供了一个通用接口，支持内核在各个位置通过挂钩调用模块函数来执行安全检查。security 是个系统调用的多路分解器，用于实现 LSM。

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

系统调用实现

设计基础

追踪系统调用

标准

系统调用的重启

实现

系统调用设计

访问用户空间

系统调用种类

参考内容

**

**

有什么问题，和我聊聊吧～

**

内部资料

INTERNAL

495838
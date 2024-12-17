> 本文由 [简悦 SimpRead](http://ksria.com/simpread/) 转码， 原文地址 [www.bingjie.vip](https://www.bingjie.vip/index.php/archives/158/)

> 前言 rootfs 在讲 overlay2 之前，我们需要先简单了解下什么是 rootfs： rootfs 也叫 根文件系统，是 Linux 使用的最基本的文件系统，是内核启动时挂载的第一个文件...

前言

rootfs

在讲 overlay2 之前，我们需要先简单了解下什么是 rootfs：

rootfs 也叫 根文件系统，是 Linux 使用的最基本的文件系统，是内核启动时挂载的第一个文件系统，提供了根目录 /，根文件系统包含了系统启动时所必须的目录和关键性文件，以及使其他文件系统得以挂载所必要的文件。在根目录下有根文件系统的各个目录，例如 /bin、/etc、/mnt 等，再将其他分区挂载到 /mnt，/mnt 目录下就有了这个分区的各个目录和文件。

docker 容器中使用的同样也是 rootfs 这种文件系统，当我们通过 docker exec 命令进入到容器内部时也可以看到在根目录下有 /bin、/etc、/tmp 等目录，但是在 docker 容器中与 Linux 不同的是，在挂载 rootfs 后，docker deamon 会利用联合挂载技术在已有的 rootfs 上再挂载一个读写层，容器在运行过程中文件系统发生的变化只会在读写层进行修改，并通过 whiteout 文件隐藏只读层中的旧版本文件。

whiteout 文件：

whiteout 概念存在于联合文件系统（UnionFS）中，代表某一类占位符形态的特殊文件，当用户文件夹与系统文件夹的共通部分联合到一个目录时（例如 bin 目录），用户可删除归属于自己的某些系统文件副本，但归属于系统级的原件仍存留于同一个联合目录中，此时系统将产生一份 whiteout 文件，表示该文件在当前用户目录中已删除，但系统目录中仍然保留。

### 联合挂载技术

所谓联合挂载技术（Union Mount），就是将原有的文件系统中的不同目录进行合并（merge），最后向我们呈现出一个合并后文件系统。在 overlay2 文件结构中，联合挂载技术通过联合三个不同的目录来实现：lower 目录、upper 目录和 work 目录，这三个目录联合挂载后得到 merged 目录

*   lower 目录：只读层，可以有多个，处于最底层目录
*   upper 目录：读写层，只有一个
*   work 目录：工作基础目录，挂载后内容被清空，且在使用过程中其内容不可见
*   merged 目录：联合挂载后得到的视图，其中本身并没有实体文件，实际文件都在 upper 目录和 lower 目录中，在 merged 目录中对文件进行编辑，实际会修改 upper 目录中文件，而在 upper 目录与 lower 目录中修改文件，都会影响我们在 merged 目录中看到的结果

### overlayFS

在介绍 docker 中使用的 overlay2 文件结构前，我们先通过对 overlay 文件系统进行简单的操作演示以便更深入理解不同层不同目录之间的关系

先创建几个文件夹和文件

```
[root@localhost mnt]# mkdir A B C
[root@localhost mnt]# mkdir worker
[root@localhost mnt]# echo "From A" > A/a.txt
[root@localhost mnt]# echo "From A" > A/b.txt
[root@localhost mnt]# echo "From A" > A/c.txt
[root@localhost mnt]# echo "From B" > B/a.txt
[root@localhost mnt]# echo "From B" > B/d.txt
[root@localhost mnt]# echo "From C" > C/b.txt
[root@localhost mnt]# echo "From C" > C/e.txt
[root@localhost mnt]# tree .
.
├── A
│   ├── a.txt
│   ├── b.txt
│   └── c.txt
├── B
│   ├── a.txt
│   └── d.txt
└── C
│   ├── b.txt
│   └── e.txt
└── worker


```

使用 mount 命令挂载成 overlayFS 文件系统，格式如下

```
mount -t overlay overlay -o lowerdir=lower1:lower2:lower3,upperdir=upper,workdir=work merged_dir


```

在这个例子中，我们用 A 和 B 两个文件夹作为 lower 目录，用 C 作为 upper 目录，worker 作为 work 目录，挂载到 /mnt/merged 目录下

```
mkdir /mnt/merged
mount -t overlay overlay -o lowerdir=A:B,upperdir=C,workdir=worker /mnt/merged


```

挂载后我们可以查看一下 merged 目录下的文件

```
[root@localhost mnt]# tree merged
merged
├── a.txt
├── b.txt
├── c.txt
├── d.txt
└── e.txt


```

可以看到我们原本 A B C 三个目录下的文件已经被合并，相同文件名的文件将会选择性的显示，在 merged 中会显示离 merged 层更近的文件，upper 层比 lower 层更近，同样的 lower 层中，排序靠前比排序靠后更近，在这个例子中就是 A 比 B 更靠近 merged 层

根据这个规律，我们可以先分析下 merged 层中的文件来源，a.txt 在 A 和 B 中都有，但 A 比 B 更优先，所以 merged 中的 a.txt 应该来自 A 目录，b.txt 在 A 和 C 中都有，但 C 是 upper 层，所以 b.txt 应该来自 C 目录，我们可以核实一下

```
[root@localhost mnt]# cd merged/
[root@localhost merged]# cat a.txt 
From A
[root@localhost merged]# cat b.txt 
From C


```

接下来我们可以看下 upper 层、lower 层 和 merged 层之间的关系，上文已经提到了 upper 层是 读写层 而 lower 层是 只读层，merged 层是联合挂载后的视图，那如果我们在 merged 层中对文件进行操作会发生什么

```
[root@localhost merged]# echo "AAA" > a.txt
[root@localhost merged]# cat a.txt 
AAA
[root@localhost merged]# cat ../A/a.txt 
From A
[root@localhost merged]# ls ../C/
a.txt  b.txt  e.txt


```

我们修改 merged 层的 a.txt 文件，可以看到 merged 层的 a.txt 内容虽然改变，但 A 目录（只读层）下的 a.txt 内容并没有发生变化，而在 C 目录（读写层）下多了一个 a.txt 文件，内容就是我们修改过的 a.txt 的内容，这就是只读层与读写层的关系，在 merged 目录对文件进行修改并不会影响到只读层的源文件，只会在读写层进行编辑

如果我们在 merged 目录删除文件会发生什么

```
[root@localhost merged]# cd ..
[root@localhost mnt]# rm -f merged/c.txt 
[root@localhost mnt]# ls C/
a.txt  b.txt  c.txt  e.txt
[root@localhost mnt]# ls merged/
a.txt  b.txt  d.txt  e.txt


```

可以看到在 merged 目录中已经没有 c.txt 文件，但在 C 目录下却多了一个 c.txt ，这个文件就是我们在一开始提到的 **whiteout 文件**，它是一种主 / 次设备号都为 0 的字符设备，overlay 文件结构通过使用这种特殊文件来实现文件删除功能，在 merged 目录下使用 ls 命令来查看文件时，overlay 会自动过滤掉 upper 目录下的 whiteout 文件以及在 lower 目录下的同名文件，以此来实现文件删除效果

还有一个值得提到的点：overlay 在对文件进行操作时用到了**写时复制（Copy on Write）**技术，在没有对文件进行修改时，merged 目录直接使用 lower 目录下的文件，只有当我们在 merged 目录对文件进行修改时，才会把修改的文件复制到 upper 目录

### Docker overlay2

有了对 overlayFS 的基本了解，我们接下来就可以着手分析 Docker 的 overlay2 文件结构了，实际上 Docker 支持的存储驱动有很多种：overlay、overlay2、aufs、vfs 等，在 Ubuntu 较新版本的 Docker 中普遍采用了 overlay2 这种文件结构，其具有更优越的驱动性能，而 overlay 与 overlay2 的本质区别就是二者在镜像层之间的共享数据方法不同：

*   overlay 通过 **硬链接** 的方式共享数据，只支持，增加了磁盘 inode 负担
*   overlay2 通过将多层 lower 文件联合在一起

简而言之，overlay2 就是 overlay 的改进版本，我们可以通过 docker info 命令查看

```
[root@localhost mnt]# docker info|grep -i "storage driver"
 Storage Driver: overlay2


```

在 Docker 中，我们日常操作主要涉及两个层面：镜像层与容器层，镜像层就是我们通过 docker pull 等命令下载到本机中的镜像，而容器层则是我们通过 docker exec 等命令进入的交互式终端，如果你使用过 Docker，你会发现我们只用一个镜像，通过 docker run 可以产生很多个容器，这就可以类比 upper 与 lower 两层，镜像作为 lower 层，只读提供文件系统基础，而容器作为 upper 层，我们可以在其中进行任意文件操作，只用同一个镜像就可以引申出不同的容器，这也是一种节约空间资源的方式吧（我的推测

接下来我们稍微详细地探讨下镜像层与容器层，还有他们的元数据

### 镜像层

我们可以通过 docker image inspect [IMAGE ID] 来查看镜像配置

```
        "GraphDriver": {
            "Data": {
                "LowerDir": "/var/lib/docker/overlay2/d408a0f412e919757ed37904883d3237b21e0da1dca0d4a6cd81437cdd6d1c1e/diff:/var/lib/docker/overlay2/08549638c61177a0112f50ba71885c37fb0dc600ee3f02c8dc38bdc6b81e52cf/diff:/var/lib/docker/overlay2/9038e63e1a266b75dedf809dc3b265dc9e5c36db62461dc25871b25acd0278b6/diff:/var/lib/docker/overlay2/ec28511aa7d9c61f04a81f34bdd63bd7e81727fd656ae664248f5b8dfabefc91/diff:/var/lib/docker/overlay2/a41bf86c918f88e52588a68e91b749b739bfb069793a04a73688158272e21172/diff",
                "MergedDir": "/var/lib/docker/overlay2/641e809288c914b1eab5e3f318613fc76e48a6c3bec1d98c295429cb4d70d830/merged",
                "UpperDir": "/var/lib/docker/overlay2/641e809288c914b1eab5e3f318613fc76e48a6c3bec1d98c295429cb4d70d830/diff",
                "WorkDir": "/var/lib/docker/overlay2/641e809288c914b1eab5e3f318613fc76e48a6c3bec1d98c295429cb4d70d830/work"
            },
            "Name": "overlay2"
        },


```

其中的 GraphDriver 字段中有关于 overlay2 文件结构的目录信息

每一层的对应都在配置信息中体现的非常清楚，但是有一点问题，我们在实际查看文件夹的时候，可以发现镜像层其实并没有 /merged 目录，我的理解是镜像层作为 Docker 容器的最底层（只读层）并不需要有视图的功能，我们在实际使用过程中也并不会直接对镜像进行操作，所以其在配置信息中显示也仅仅是为了呈现完整的 overlay2 文件结构（不一定对

可以看到镜像的目录是在 /var/lib/docker/overlay2 下，我们打开一个镜像层看一看其中都有哪些文件

```
[root@localhost mnt]# cd /var/lib/docker/overlay2/
[root@localhost overlay2]# cd d408a0f412e919757ed37904883d3237b21e0da1dca0d4a6cd81437cdd6d1c1e
[root@localhost d408a0f412e919757ed37904883d3237b21e0da1dca0d4a6cd81437cdd6d1c1e]# ls -al
total 44
drwx-----x   4 root root    72 Aug  4  2021 .
drwx-----x 390 root root 32768 May 16 08:17 ..
-rw-------   1 root root     0 Aug  4  2021 committed
drwxr-xr-x   3 root root    33 Aug  4  2021 diff
-rw-r--r--   1 root root    26 Aug  4  2021 link
-rw-r--r--   1 root root   115 Aug  4  2021 lower
drwx------   2 root root     6 Aug  4  2021 work


```

其中我们关注下 diff 目录、link 和 lower 文件

#### diff 目录

在这个目录中存放的是当前镜像层的文件，刚刚在介绍 over 个 lay2 与 overlay 区别的时候提到了 overlay2 是将多个 lower 层联合到一起，在上面的图中也可以看到，多个 lower 层之间用 **:** 分割，在这些层中每一层都有一部分文件，把他们联合到一起就得到了完整的 rootfs

```
[root@localhost overlay2]# ls /var/lib/docker/overlay2/ec28511aa7d9c61f04a81f34bdd63bd7e81727fd656ae664248f5b8dfabefc91/diff
docker-entrypoint.d  etc  lib  tmp  usr  var
[root@localhost overlay2]# ls /var/lib/docker/overlay2/a41bf86c918f88e52588a68e91b749b739bfb069793a04a73688158272e21172/diff
bin  boot  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var


```

#### link 文件

link 文件中的内容是当前层的软链接名称

```
[root@localhost overlay2]# cat d408a0f412e919757ed37904883d3237b21e0da1dca0d4a6cd81437cdd6d1c1e/link 
VXUXFA5G2ZAXFHHJESEZZPB4CW


```

这些链接都在 /var/lib/docker/overlay2/l 目录下

```
[root@localhost overlay2]# cd l
[root@localhost l]# ls -al
lrwxrwxrwx   1 root root    72 Dec  7  2022 23PRQNK6DIVHKNG4RI5OIVFJ4M -> ../84ab04e78217852530535277c7fc36543c81788e0a8370aed0a3e1f1189fb986/diff
lrwxrwxrwx   1 root root    77 Dec  3  2021 26UZSWOK7RX5J5HNSYSMIU2XXP -> ../75f746ca408926b02e8218a95e55e118c39b54d2d238aaf6c09b8c63c4b24596-init/diff


```

使用软链接的目的是为了避免达到 mount 命令参数的长度限制

#### lower 文件

lower 文件中的内容是**在此层之下的所有层的软链接名称**，最底层不存在该文件，我们知道 upper 层在 lower 层之上，而 lower 层中越靠后则越在底层

我们查看 upper 层对应目录下 lower 文件，可以发现其中有 5 个软链接

```
"UpperDir": "/var/lib/docker/overlay2/641e809288c914b1eab5e3f318613fc76e48a6c3bec1d98c295429cb4d70d830/diff",
[root@localhost overlay2]# cat 641e809288c914b1eab5e3f318613fc76e48a6c3bec1d98c295429cb4d70d830/lower |grep 'l'
l/VXUXFA5G2ZAXFHHJESEZZPB4CW:l/S2RVEF6525ZDEBONFX647ODQVK:l/6CDNISWDXT6OBNCUEW4ZTVJALZ:l/IZABA25LEVWNMZDZBJWD6S5PO3:l/R4KNVXGMP6DXH6YCVLAYMYNJQ5

恰好 lower 目录中有5个镜像层

"LowerDir": "/var/lib/docker/overlay2/d408a0f412e919757ed37904883d3237b21e0da1dca0d4a6cd81437cdd6d1c1e/diff:/var/lib/docker/overlay2/08549638c61177a0112f50ba71885c37fb0dc600ee3f02c8dc38bdc6b81e52cf/diff:/var/lib/docker/overlay2/9038e63e1a266b75dedf809dc3b265dc9e5c36db62461dc25871b25acd0278b6/diff:/var/lib/docker/overlay2/ec28511aa7d9c61f04a81f34bdd63bd7e81727fd656ae664248f5b8dfabefc91/diff:/var/lib/docker/overlay2/a41bf86c918f88e52588a68e91b749b739bfb069793a04a73688158272e21172/diff",


```

在 lower 层中，处于最底层的则应该是在 **:** 最后的目录，即

```
/var/lib/docker/overlay2/a41bf86c918f88e52588a68e91b749b739bfb069793a04a73688158272e21172

查看这一目录下的文件，可以发现它并没有 lower 文件

[root@localhost overlay2]# ls -al a41bf86c918f88e52588a68e91b749b739bfb069793a04a73688158272e21172
total 40
drwx-----x   3 root root    47 Aug  4  2021 .
drwx-----x 390 root root 32768 May 16 08:17 ..
-rw-------   1 root root     0 Aug  4  2021 committed
drwxr-xr-x  21 root root   224 Aug  4  2021 diff
-rw-r--r--   1 root root    26 Aug  4  2021 link

这一层对应的软链接即 link 文件内容为 
# cat a41bf86c918f88e52588a68e91b749b739bfb069793a04a73688158272e21172/link 
R4KNVXGMP6DXH6YCVLAYMYNJQ5

我们查看其上一层的 lower 文件内容
[root@localhost overlay2]# cat ec28511aa7d9c61f04a81f34bdd63bd7e81727fd656ae664248f5b8dfabefc91/lower 
l/R4KNVXGMP6DXH6YCVLAYMYNJQ5

可以发现确实对应了最底层目录的软链接


```

### 元数据

Docker 的元数据存储目录为 /var/lib/docker/image/overlay2

```
[root@localhost overlay2]# cd /var/lib/docker/image/overlay2
[root@localhost overlay2]# ls
distribution  imagedb  layerdb  repositories.json


```

我们主要看 imagedb 和 layerdb 这两个文件夹

#### imagedb

这个文件夹中存储了镜像相关的元数据，具体位置是在 /imagedb/content/sha256 目录下，这个目录下的文件以 IMAGE ID 来命名

```
[root@localhost overlay2]# docker images
REPOSITORY                                            TAG            IMAGE ID       CREATED         SIZE
nginx                                                 latest         08b152afcfae   2 years ago     133MB
root@localhost overlay2]# ls /var/lib/docker/image/overlay2/imagedb/content/sha256/
05b923b3fde285e0f98ad43491b360effa28c43af16282ec2a6f47ef4bb7fd5b
08b152afcfae220e9709f00767054b824361c742ea03a9fe936271ba520a0a4b


```

这个文件的内容就是我们通过 docker image inspect [IMAGE ID] 命令查看到的信息，其中我们关注 RootFS 字段

```
[root@localhost overlay2]# docker image inspect 08b152afcfae
        "RootFS": {
            "Type": "layers",
            "Layers": [
                "sha256:814bff7343242acfd20a2c841e041dd57c50f0cf844d4abd2329f78b992197f4",
                "sha256:7c0b223167b96d7deaacf1e1d2d35892166645b09b17bcc8675a4d882ef84893",
                "sha256:59b01b87c9e7f668b740d23eb872c5964636c33aef795f1186f08b172197bc35",
                "sha256:988d9a3509bbb7ea8037d4eba3a5e0ada5dc165144c8ff0df89c0048d1ac6132",
                "sha256:b857347059916922b353147882544f17bb96e64c639081c0677bf386c446be4f",
                "sha256:e3135447ca3e69c6975aee1621c406e3865e0e143c807bbdcf05abefa56054a2"
            ]
        },


```

可以看到这个字段中有许多 sha256 值，这些哈希值称为 diff_id，其从上至下的顺序就表示镜像层最底层到最顶层，也就是说每个 diff_id 都对应了一个镜像层，实际上，对应每一个镜像层的还有另外两个 id：**cache_id 和 chain_id**

```
cache_id 就是在 docker/overlay2 目录下看到的文件夹名称，也是我们通过 docker image inspect [IMAGE ID] 命令查看 GraphDriver 字段对应不同的 Dir，其本质是宿主机随机生成的 uuid"LowerDir": "/var/lib/docker/overlay2/d408a0f412e919757ed37904883d3237b21e0da1dca0d4a6cd81437cdd6d1c1e/diff


```

chain_id 是通过 diff_id 计算出来的，是 Docker 内容寻址机制采用的索引 ID

*   chain_id 在目录 /docker/image/overlay2/layerdb/sha256 查看
*   如果当前镜像层为最底层，则其 chain_id 与 diff_id 相同
*   如果当前镜像层不是最底层，则其 chain_id 计算方式为：sha256(上层 chain_id + “ “ + 本层 diff_id)

这三个 id 之间存在一一对应的关系，我们可以通过 diff_id 计算得到 chain_id，又可以通过 chain_id 找到对应的 cache_id，下面我们举个栗子说明一下：

我们刚刚提到了 diff_id 从上至下是最底层到最顶层

```
RootFS
"sha256:814bff7343242acfd20a2c841e041dd57c50f0cf844d4abd2329f78b992197f4", 最底层

"sha256:e3135447ca3e69c6975aee1621c406e3865e0e143c807bbdcf05abefa56054a2" 最顶层

查看 chain_id

ls /var/lib/docker/image/overlay2/layerdb/sha256/


```

**可以看到其中确实有一个 chain_id 与 最底层的 diff_id 相同** 814bff7343242acfd20a2c841e041dd57c50f0cf844d4abd2329f78b992197f4，有了最底层的 chain_id 我们就可以计算出下一层的 chain_id，至于具体如何计算，以及如何通过 chain_id 找到对应的 cache_id，我们需要先了解 layerdb 目录下的内容

#### layerdb

我们现在已知 Docker 的镜像层作为只读层，容器层作为读写层，而 Docker 实际上定义了 roLayer 接口与 mountLayer 接口，分别用来描述（只读）镜像层与（读写）容器层，这两个接口的元数据就在目录 docker/image/overlay2/layerdb 下

#### roLayer

rolayer 接口用来描述镜像层，元数据的具体目录在 layerdb/sha256/ 下，在此目录下每个文件夹都以每个镜像层的 chain_id 命名

```
[root@localhost sha256]# pwd
/var/lib/docker/image/overlay2/layerdb/sha256
[root@localhost sha256]# ls -l 814bff7343242acfd20a2c841e041dd57c50f0cf844d4abd2329f78b992197f4
total 256
-rw-r--r-- 1 root root     64 Aug  4  2021 cache-id
-rw-r--r-- 1 root root     71 Aug  4  2021 diff
-rw-r--r-- 1 root root      8 Aug  4  2021 size
-rw-r--r-- 1 root root 249642 Aug  4  2021 tar-split.json.gz


```

在文件夹中主要有这 5 个文件，我们简单介绍一下：

*   cache-id：当前 chain_id 对应的 cache_id，用来索引镜像层
*   diff：当前 chain_id 对应的 diff_id
*   parent：当前 chain_id 对应的镜像层的下一层（父层）镜像 chain_id，最底层不存在该文件
*   size：当前 chain_id 对应的镜像层物理大小，单位是字节
*   tar-split.json.gz：当前 chain_id 对应镜像层压缩包的 split 文件，可以用来还原镜像层的 tar 包，通过 docker save 命令导出镜像时会用到

我们在上一节中已经判断出了最底层镜像对应的 chain_id，不妨查看下对应目录下的文件

可以看到该目录下确实没有 parent 文件，那么我们再查看其下一层，通过 RootFS 中的 diff_id 的顺序我们可以得知其下一层的 diff_id 为 7c0b223167b96d7deaacf1e1d2d35892166645b09b17bcc8675a4d882ef84893，通过 [计算 sha256](https://www.uutils.com/enc/sha.htm)，我们可以得出下一层的 chain_id

第一个上层镜像的 chain_id, 即 parent 文件内容

第二个当前镜像的 diff_id, 即 diff 文件内容

注意两个中间有空格

```
sha256:814bff7343242acfd20a2c841e041dd57c50f0cf844d4abd2329f78b992197f4 sha256:7c0b223167b96d7deaacf1e1d2d35892166645b09b17bcc8675a4d882ef84893


```

进行 sha256 计算得到最底层的下一层镜像 chain_id 为

```
c0d318592b21711dc370e180acd66ad5d42f173d5b58ed315d08b9b09babb84a

确实存在该目录，证明计算无误，再查看此目录下 diff 文件与 parent 文件内容
[root@localhost sha256]# cat c0d318592b21711dc370e180acd66ad5d42f173d5b58ed315d08b9b09babb84a/diff 
sha256:7c0b223167b96d7deaacf1e1d2d35892166645b09b17bcc8675a4d882ef84893
[root@localhost sha256]# cat c0d318592b21711dc370e180acd66ad5d42f173d5b58ed315d08b9b09babb84a/parent 
sha256:814bff7343242acfd20a2c841e041dd57c50f0cf844d4abd2329f78b992197f4


```

可以看到与我们计算用到的两个值也完全相同

#### mountLayer

mountLayer 接口用来描述容器层，元数据的具体目录在 layerdb/mounts/，在此目录下的文件夹以每个容器的容器 ID（CONTAINER ID）命名

```
[root@localhost mounts]# pwd
/var/lib/docker/image/overlay2/layerdb/mounts
[root@localhost mounts]# docker ps
CONTAINER ID   IMAGE
af9dbce95691   nginx 
[root@localhost mounts]# ls -l|grep af9dbce95691
drwxr-xr-x 2 root root 51 Aug  4  2021 af9dbce9569155e2b255518a1794bebd6e29affacb75f71fcfd0907608f95ee9
[root@localhost mounts]# docker inspect af9dbce95691
[
    {
        "Id": "af9dbce9569155e2b255518a1794bebd6e29affacb75f71fcfd0907608f95ee9",


```

在这个文件夹下只有 3 个文件，内容如下

```
[root@localhost af9dbce9569155e2b255518a1794bebd6e29affacb75f71fcfd0907608f95ee9]# ls -l
total 12
-rw-r--r-- 1 root root 69 Aug  4  2021 init-id
-rw-r--r-- 1 root root 64 Aug  4  2021 mount-id
-rw-r--r-- 1 root root 71 Aug  4  2021 parent


```

简单介绍一下这 3 个文件：

*   init-id：对应容器 init 层目录名，源文件在 /var/lib/docker/overlay2 目录下
*   mount-id：容器层存储在 /var/lib/docker/overlay2 目录下的名称
*   parent：容器的镜像层最顶层镜像的 chain_id

我们可以查看 parent 这个文件中 chain_id 对应目录下的 diff 文件

```
# pwd
/var/lib/docker/image/overlay2/layerdb/mounts/af9dbce9569155e2b255518a1794bebd6e29affacb75f71fcfd0907608f95ee9
# cat init-id 
de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd-init
# cat mount-id 
de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd
# cat parent 
sha256:97386f823dd75e356afac10af0def601f2cd86908e3f163fb59780a057198e1b


# pwd
/var/lib/docker/image/overlay2/layerdb/mounts
[root@localhost mounts]# ls af9dbce9569155e2b255518a1794bebd6e29affacb75f71fcfd0907608f95ee9
init-id  mount-id  parent

[root@localhost sha256]# pwd
/var/lib/docker/image/overlay2/layerdb/sha256
[root@localhost sha256]# ls 97386f823dd75e356afac10af0def601f2cd86908e3f163fb59780a057198e1b/
cache-id  diff  parent  size  tar-split.json.gz
[root@localhost sha256]# cat 97386f823dd75e356afac10af0def601f2cd86908e3f163fb59780a057198e1b/diff 
sha256:e3135447ca3e69c6975aee1621c406e3865e0e143c807bbdcf05abefa56054a2


```

根据 RootFS 部分 diff_id 从上至下的顺序，我们可以确定这个 diff_id 的确是镜像层的最顶层

```
                "sha256:e3135447ca3e69c6975aee1621c406e3865e0e143c807bbdcf05abefa56054a2"
            ]
        },


```

在这里我们引入了一个叫做 init 层 的概念，实际上，一个完整的容器分为 3 层：镜像层、init 层和容器层，镜像层提供完整的文件系统基础（rootfs），容器层提供给用户进行交互操作与读写权限，而 init 层则是对应每个容器自己的一些系统配置文件，我们可以看一下 init 层的内容

```
[root@localhost overlay2]# pwd
/var/lib/docker/overlay2
[root@localhost overlay2]# tree de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd-init
de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd-init
├── committed
├── diff
│   ├── dev
│   │   ├── console
│   │   ├── pts
│   │   └── shm
│   └── etc
│       ├── hostname
│       ├── hosts
│       ├── mtab -> /proc/mounts
│       └── resolv.conf
├── link
├── lower
└── work
    └── work


```

可以看到在 diff 目录中有一些 /etc/hosts、/etc/resolv.conf 等配置文件，需要这一层的原因是当容器启动的时候，有一些每个容器特定的配置文件（例如 hostname），但由于镜像层是只读层无法进行修改，所以就在镜像层之上单独挂载一层 init 层，用户通过修改每个容器对应 init 层中的一些配置文件从而达到修改镜像配置文件的目的，而在 init 层中的配置文件也仅对当前容器生效，通过 docker commit 命令创建镜像时也不会提交 init 层

#### 容器层

最后我们来看一看容器层的构造，刚刚我们在 mountLayer 一节的讲述中提到了 mount-id 这个文件，而这个文件的内容就是容器层目录的名称，我们通过 docker inspect [CONTAINER ID] 命令也可以判断

```
[root@localhost overlay2]# docker inspect af9dbce95691|grep "GraphDriver" -A 10
        "GraphDriver": {
            "Data": {
                "LowerDir": "/var/lib/docker/overlay2/de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd-init/diff:/var/lib/docker/overlay2/641e809288c914b1eab5e3f318613fc76e48a6c3bec1d98c295429cb4d70d830/diff:/var/lib/docker/overlay2/d408a0f412e919757ed37904883d3237b21e0da1dca0d4a6cd81437cdd6d1c1e/diff:/var/lib/docker/overlay2/08549638c61177a0112f50ba71885c37fb0dc600ee3f02c8dc38bdc6b81e52cf/diff:/var/lib/docker/overlay2/9038e63e1a266b75dedf809dc3b265dc9e5c36db62461dc25871b25acd0278b6/diff:/var/lib/docker/overlay2/ec28511aa7d9c61f04a81f34bdd63bd7e81727fd656ae664248f5b8dfabefc91/diff:/var/lib/docker/overlay2/a41bf86c918f88e52588a68e91b749b739bfb069793a04a73688158272e21172/diff",
                "MergedDir": "/var/lib/docker/overlay2/de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd/merged",
                "UpperDir": "/var/lib/docker/overlay2/de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd/diff",
                "WorkDir": "/var/lib/docker/overlay2/de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
[root@localhost overlay2]# pwd
/var/lib/docker/overlay2
[root@localhost overlay2]# cat ../image/overlay2/layerdb/mounts/af9dbce9569155e2b255518a1794bebd6e29affacb75f71fcfd0907608f95ee9/mount-id 
de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd[root@localhost overlay2]#


```

可以看到其实容器层的目录与镜像层、init 层都在同一目录下，其实也就说明了他们在文件结构上都是相同的

```
[root@localhost overlay2]# cd /var/lib/docker/overlay2/de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd
[root@localhost de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd]# ls -l
total 8
drwxr-xr-x 9 root root  87 Aug  4  2021 diff
-rw-r--r-- 1 root root  26 Aug  4  2021 link
-rw-r--r-- 1 root root 202 Aug  4  2021 lower
drwxr-xr-x 1 root root  87 Aug  4  2021 merged
drwx------ 3 root root  18 May 16 08:17 work


```

同样都是这几个文件，但不同的是，我们可以看到在容器层确实有了 merged 这个目录，与我们在文章一开始实现的 overlayFS 是相同的

#### merged 目录

```
# pwd
/var/lib/docker/overlay2/de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd
# ls merged/
bin  boot  dev  docker  docker-entrypoint.d  docker-entrypoint.sh  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var


```

在 merged 目录下展现了完整的 rootfs 文件系统，这就是 overlay2 通过联合挂载技术，将镜像层、init 层与容器层挂载到一起呈现的结果，这也是我们通过 docker exec 命令进入容器的交互式终端看到的结果，也就是所谓的

#### 视图

```
# docker exec -it af9dbce95691 /bin/bash
root@af9dbce95691:/# ls
bin  boot  dev    docker    docker-entrypoint.d  docker-entrypoint.sh  etc    home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var


```

#### link & lower 文件

我们在镜像层的时候已经讲过这两个文件了，在容器层中这两个文件与镜像层作用是相同的，不过我们可以看一下 lower 文件的内容

```
# pwd
/var/lib/docker/overlay2/de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd
# cat lower |grep 'l/'
l/IBB2L4YEQC6N4OWTT5L4KZ6NNR:l/NPWIV7JNKVUQYYLU6IIFYRRZX7:l/VXUXFA5G2ZAXFHHJESEZZPB4CW:l/S2RVEF6525ZDEBONFX647ODQVK:l/6CDNISWDXT6OBNCUEW4ZTVJALZ:l/IZABA25LEVWNMZDZBJWD6S5PO3:l/R4KNVXGMP6DXH6YCVLAYMYNJQ5


```

前面讲过，lower 文件的内容是在此层之下的所有层的软链接名称，我们已知此镜像的镜像层共 5 层（lower 层 5 个，upper 层 1 个），但是我们从上图可以看到在容器层之下有 7 个层，那多出来的一个就是我们在上一节中提到的 init 层，init 层也有其对应的软链接（看上一节中的图），所以在 docker/overlay2/l 目录下实际上有 8 个软连接（6 个镜像层，1 个 init 层，1 个容器层）

而通过 docker inspect [CONTAINER ID] 命令我们也可以判断出容器层是最顶层，其次是 init 层，最下面是镜像层，也对应了 lower 文件中软链接的顺序

```
[root@localhost overlay2]# docker inspect af9dbce95691|grep "GraphDriver" -A 10
        "GraphDriver": {
            "Data": {
                "LowerDir": "/var/lib/docker/overlay2/de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd-init


```

#### diff 目录

这个目录实际上就是 overlayFS 文件结构中的 upper 层（上图中也能看到），所以它的用途就是保存用户在容器中（merged 层）对文件进行的编辑

```
[root@localhost de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd]# tree diff/


```

很明显这些文件，例如 BitLocker 恢复密钥都不可能是镜像本身就有的，而是操作者在容器中后添加的，我们也可以自己尝试在容器中编辑一个文件

我们在容器内的 /etc 目录下创建了一个 test.txt 文件，可以看到在 diff 目录下也体现了出来，我们再尝试在容器中删除原本镜像自带的文件看一看效果

```
[root@localhost de27c42d309aafdbf996add32b24ae824f4492203778a3fc5855debec16d6dfd]# tree diff/etc/


```

我们在容器中删除 /etc 目录下的 shadow 文件，可以看到在 diff 目录下的 /etc 中多了一个 shadow 文件，而这个文件实际上就是我们在文章一开始讲到的 whiteout 文件，用来隐藏我们已经删掉的 shadow 文件，而实际上镜像层的 shadow 文件并没有被删除

至此，我们对于 Docker 使用的 overlay2 文件结构分析结束。

转载自：

[https://cloud.tencent.com/developer/article/2272892](https://cloud.tencent.com/developer/article/2272892)
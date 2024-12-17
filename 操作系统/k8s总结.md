# k8s的总体架构

![](https://ilearning.huawei.com/edx/catalog/api/v1/third_partner/proxy/static001.geekbang.org/resource/image/8e/67/8ee9f2fa987eccb490cfaa91c6484f67.png?wh=1920*1080)
Kubernetes项目的架构，由Master和Node两种节点组成，而这两种角色分别对应着控制节点和计算节点。

其中，控制节点，即Master节点，由三个紧密协作的独立组件组合而成，它们分别是负责API服务的kube-apiserver、负责调度的kube-scheduler，以及负责容器编排的kube-controller-manager。整个集群的持久化数据，则由kube-apiserver处理后保存在Etcd中。(**master节点中也有kubelet**)

而计算节点上最核心的部分，则是一个叫作kubelet的组件。(**kubelet运行在宿主机上，不以容器运行**)
>kubelet是Kubernetes项目用来操作Docker等容器运行时的核心组件。可是，除了跟容器运行时打交道外，kubelet在配置容器网络、管理容器数据卷时，都需要直接操作宿主机。
而如果现在kubelet本身就运行在一个容器里，那么直接操作宿主机就会变得很麻烦。对于网络配置来说还好，kubelet容器可以通过不开启Network Namespace（即Docker的host network模式）的方式，直接共享宿主机的网络栈。可是，要让kubelet隔着容器的Mount Namespace和文件系统，操作宿主机的文件系统，就有点儿困难了。
比如，如果用户想要使用NFS做容器的持久化数据卷，那么kubelet就需要在容器进行绑定挂载前，在宿主机的指定目录上，先挂载NFS的远程目录。
可是，这时候问题来了。由于现在kubelet是运行在容器里的，这就意味着它要做的这个“mount -F nfs”命令，被隔离在了一个单独的Mount Namespace中。即，kubelet做的挂载操作，不能被“传播”到宿主机上。
对于这个问题，有人说，可以使用setns()系统调用，在宿主机的Mount Namespace中执行这些挂载操作；也有人说，应该让Docker支持一个–mnt=host的参数。
但是，到目前为止，在容器里运行kubelet，依然没有很好的解决办法，我也不推荐你用容器去部署Kubernetes项目。
正因为如此，kubeadm选择了一种妥协方案：
把kubelet直接运行在宿主机上，然后使用容器部署其他的Kubernetes组件。

在Kubernetes项目中，kubelet主要负责同容器运行时（比如Docker项目）打交道。而这个交互所依赖的，是一个称作CRI（Container Runtime Interface）的远程调用接口，这个接口定义了容器运行时的各项核心操作，比如：启动一个容器需要的所有参数。

这也是为何，Kubernetes项目并不关心你部署的是什么容器运行时、使用的什么技术实现，只要你的这个容器运行时能够运行标准的容器镜像，它就可以通过实现CRI接入到Kubernetes项目当中。

而具体的容器运行时，比如Docker项目，则一般通过OCI这个容器运行时规范同底层的Linux操作系统进行交互，即：把CRI请求翻译成对Linux操作系统的调用（操作Linux Namespace和Cgroups等）。

此外，kubelet还通过gRPC协议同一个叫作Device Plugin的插件进行交互。这个插件，是Kubernetes项目用来管理GPU等宿主机物理设备的主要组件，也是基于Kubernetes项目进行机器学习训练、高性能作业支持等工作必须关注的功能。

而kubelet的另一个重要功能，则是调用网络插件和存储插件为容器配置网络和持久化存储。这两个插件与kubelet进行交互的接口，分别是CNI（Container Networking Interface）和CSI（Container Storage Interface）。
# k8s的部署过程
2017年，在志愿者的推动下，社区才终于发起了一个独立的部署工具，名叫：kubeadm。
这个项目的目的，就是要让用户能够通过这样两条指令完成一个Kubernetes集群的部署：
```bash
# 创建一个Master节点
$ kubeadm init

# 将一个Node节点加入到当前集群中
$ kubeadm join <Master节点的IP和端口>
```

使用kubeadm的第一步，是在机器上手动安装kubeadm、kubelet和kubectl这三个二进制文件。当然，kubeadm的作者已经为各个发行版的Linux准备好了安装包，所以你只需要执行：
```bash
$ apt-get install kubeadm
```
>**kubelet、kubectl、kubeadm都是安装在宿主机上的，不以容器化运行**
## kubeadm init工作流程
1. 当你执行kubeadm init指令后，kubeadm首先要做的，是一系列的检查工作，以确定这台机器可以用来部署Kubernetes。
2. 在通过了Preflight Checks之后，kubeadm要为你做的，是生成Kubernetes对外提供服务所需的各种证书和对应的目录。

Kubernetes对外提供服务时，除非专门开启“不安全模式”，否则都要通过HTTPS才能访问kube-apiserver。这就需要为Kubernetes集群配置好证书文件。
kubeadm为Kubernetes项目生成的证书文件都放在Master节点的/etc/kubernetes/pki目录下。在这个目录下，最主要的证书文件是ca.crt和对应的私钥ca.key。

>此外，用户使用kubectl获取容器日志等streaming操作时，需要通过kube-apiserver向kubelet发起请求(**这一步也可以看出，宿主机上的kubectl向master节点上的容器化运行的kube-apiserver通信时，也要通过master节点上的kubelet进行，所以master节点上也是要有kubelet的**)，这个连接也必须是安全的。kubeadm为这一步生成的是apiserver-kubelet-client.crt文件，对应的私钥是apiserver-kubelet-client.key。
3. 证书生成后，kubeadm接下来会为其他组件生成访问kube-apiserver所需的配置文件。

这些文件的路径是：/etc/kubernetes/xxx.conf：


```
ls /etc/kubernetes/
admin.conf  controller-manager.conf  kubelet.conf  scheduler.conf
```
这些文件里面记录的是，当前这个Master节点的服务器地址、监听端口、证书目录等信息。这样，对应的客户端（比如scheduler，kubelet等），可以直接加载相应的文件，使用里面的信息与kube-apiserver建立安全连接。
4. 接下来，kubeadm会为Master组件生成Pod配置文件

Kubernetes有三个Master组件kube-apiserver、kube-controller-manager、kube-scheduler，而它们都会被使用Pod的方式部署起来。
>你可能会有些疑问：这时，Kubernetes集群尚不存在，难道kubeadm会直接执行docker run来启动这些容器吗？
当然不是。
在Kubernetes中，有一种特殊的容器启动方法叫做“Static Pod”。它允许你把要部署的Pod的YAML文件放在一个指定的目录里。这样，**当这台机器上的kubelet启动时，它会自动检查这个目录，加载所有的Pod YAML文件，然后在这台机器上启动它们**。
从这一点也可以看出，**kubelet在Kubernetes项目中的地位非常高，在设计上它就是一个完全独立的组件，而其他Master组件，则更像是辅助性的系统容器。**

在kubeadm中，Master组件的YAML文件会被生成在/etc/kubernetes/manifests路径下。

```
$ ls /etc/kubernetes/manifests/
etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml
```
一旦这些YAML文件出现在被kubelet监视的/etc/kubernetes/manifests目录下，kubelet就会自动创建这些YAML文件中定义的Pod，即Master组件的容器。
5. 然后，kubeadm就会为集群生成一个bootstrap token

在后面，只要持有这个token，任何一个安装了kubelet和kubadm的节点，都可以通过kubeadm join加入到这个集群当中。

6. 在token生成之后，kubeadm会将ca.crt等Master节点的重要信息，通过ConfigMap的方式保存在Etcd当中，供后续部署Node节点使用。这个ConfigMap的名字是cluster-info。

7. kubeadm init的最后一步，就是安装默认插件。

Kubernetes默认kube-proxy和DNS这两个插件是必须安装的。它们分别用来提供整个集群的服务发现和DNS功能。**其实，这两个插件也只是两个容器镜像而已，所以kubeadm只要用Kubernetes客户端创建两个Pod就可以了。**

## kubeadm join的工作流程
kubeadm init生成bootstrap token之后，你就可以在任意一台安装了kubelet和kubeadm的机器上执行kubeadm join了。

>可是，为什么执行kubeadm join需要这样一个token呢？
因为，任何一台机器想要成为Kubernetes集群中的一个节点，就必须在集群的kube-apiserver上注册。可是，要想跟apiserver打交道，这台机器就必须要获取到相应的证书文件（CA文件）。可是，为了能够一键安装，我们就不能让用户去Master节点上手动拷贝这些文件。
所以，kubeadm至少需要发起一次“不安全模式”的访问到kube-apiserver，从而拿到保存在ConfigMap中的cluster-info（它保存了APIServer的授权信息）。而bootstrap token，扮演的就是这个过程中的安全验证的角色。
只要有了cluster-info里的kube-apiserver的地址、端口、证书，从节点上的kubelet就可以以“安全模式”连接到apiserver上，这样一个新的节点就部署完成了。
## 通过Taint/Toleration调整Master执行Pod的策略
默认情况下Master节点是不允许运行用户Pod的。而Kubernetes做到这一点，依靠的是Kubernetes的Taint/Toleration机制。

它的原理非常简单：一旦某个节点被加上了一个Taint，即被“打上了污点”，那么所有Pod就都不能在这个节点上运行，因为Kubernetes的Pod都有“洁癖”。

除非，有个别的Pod声明自己能“容忍”这个“污点”，即声明了Toleration，它才可以在这个节点上运行。

其中，为节点打上“污点”（Taint）的命令是：


```
$ kubectl taint nodes node1 foo=bar:NoSchedule
```
这时，该node1节点上就会增加一个键值对格式的Taint，即：foo=bar:NoSchedule。其中值里面的NoSchedule，意味着这个Taint只会在调度新Pod时产生作用，而不会影响已经在node1上运行的Pod，哪怕它们没有Toleration。

那么Pod又如何声明Toleration呢？

我们只要在Pod的.yaml文件中的spec部分，加入tolerations字段即可：


```
apiVersion: v1
kind: Pod
...
spec:
  tolerations:
  - key: "foo"
    operator: "Equal"
    value: "bar"
    effect: "NoSchedule"
```
这个Toleration的含义是，这个Pod能“容忍”所有键值对为foo=bar的Taint（ operator: “Equal”，“等于”操作）。

现在回到我们已经搭建的集群上来。这时，如果你通过kubectl describe检查一下Master节点的Taint字段，就会有所发现了：


```
$ kubectl describe node master

Name:               master
Roles:              master
Taints:             node-role.kubernetes.io/master:NoSchedule
```
可以看到，Master节点默认被加上了node-role.kubernetes.io/master:NoSchedule这样一个“污点”，其中“键”是node-role.kubernetes.io/master，而没有提供“值”。

此时，你就需要像下面这样用“Exists”操作符（operator: “Exists”，“存在”即可）来说明，该Pod能够容忍所有以foo为键的Taint，才能让这个Pod运行在该Master节点上：


```
apiVersion: v1
kind: Pod
...
spec:
  tolerations:
  - key: "foo"
    operator: "Exists"
    effect: "NoSchedule"
```
当然，如果你就是想要一个单节点的Kubernetes，删除这个Taint才是正确的选择：

```
$ kubectl taint nodes --all node-role.kubernetes.io/master-
```
如上所示，我们在“node-role.kubernetes.io/master”这个键后面加上了一个短横线“-”，这个格式就意味着移除所有以“node-role.kubernetes.io/master”为键的Taint。

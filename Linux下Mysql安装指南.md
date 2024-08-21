# Linux下安装Mysql指南

## Linux环境查看系统版本
**Linux内核版本**：
Linux内核是操作系统的核心部分，它提供了操作系统的基本功能和底层支持。内核版本是指Linux内核的特定版本号，例如3.14、4.19、5.10等。每个内核版本都有其独特的功能、改进和修复。

**Linux发行版本**：
Linux发行版本是基于Linux内核的完整操作系统，包含了内核以及其他周边的软件和工具。发行版本通常由Linux社区、开发者或组织来维护和提供支持。一些常见的Linux发行版本包括Ubuntu、Debian、CentOS、Fedora等。

```bash
uname -a
// Linux NeoSight01 5.10.0-136.12.0.86.h1905.eulerosv2r12.x86_64 #1 SMP Wed Jul 3 06:00:00 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux
cat /proc/version
// Linux version 5.10.0-136.12.0.86.h1905.eulerosv2r12.x86_64 (abuild@szxrtosci10000) (gcc_old (GCC) 10.3.1, GNU ld (GNU Binutils) 2.37) #1 SMP Wed Jul 3 06:00:00 UTC 2024

```
## Linux包下载
以8.0.24为例
从官网上下载对应的tar包并上传到服务器上
mysql-8.0.24-linux-glibc2.12-x86_64.tar（https://downloads.mysql.com/archives/get/p/23/file/mysql-8.0.24-linux-glibc2.12-x86_64.tar）

## Mysql解压
解压jar包
```bash
tar xvf mysql-8.0.24-linux-glibc2.12-x86_64.tar
tar xvJf mysql-8.0.24-linux-glibc2.12-x86_64.tar.xz
```
将解压出来的包移动到/usr/local目录下（这一步是必要的，因为在root用户的家目录下安装的mysql，后续初始化时会出现权限问题）
```bash
mv /root/mysql-8.0.24-linux-glibc2.12-x86_64 /usr/local/mysql-8.0.24-linux-glibc2.12-x86_64
```
## 创建用户名密码并授权
1.进入mysql目录，创建data文件夹
```bash
cd /usr/local/mysql-8.0.24-linux-glibc2.12-x86_64
mkdir data
```
2. 创建用户组，用户名并对用户进行授权
```bash
groupadd mysql
useradd -g mysql mysql
chown -R mysql.mysql ./
```
3. 进入bin目录并初始化mysql
```bash
cd bin
./mysqld --user=mysql --basedir=/usr/local/mysql-8.0.24-linux-glibc2.12-x86_64 --datadir=/usr/local/mysql-8.0.24-linux-glibc2.12-x86_64 --initialize
```
./mysqld：这是 MySQL 服务器的可执行文件。./ 表示在当前目录下查找该文件
--user=mysql：指定 MySQL 服务器进程运行的用户
--basedir=/usr1/mysql8：指定 MySQL 服务器的安装目录。这里要进行路径替换
--datadir=/usr1/mysql8/data：指定 MySQL 数据文件的存储目录。这里也要进行路径替换
--initialize：这个参数告诉 MySQL 服务器执行初始化操作

# 
### PS:依赖包报错安装
在进行初始化时，出现了“error while loading shared libraries: libnuma.so.1: cannot open shared object file: No such file or directory;”和“error while loading shared libraries: libtinfo.so.5: cannot open shared object file: No such file or directory”的错误，都是因为环境中缺少相关的包导致的，需要用yum安装相应的依赖包，但用yum之前又要配置相关的源
#### 1.yum源配置
##### 确认操作系统架构和版本信息
```bash
cat /etc/euleros-latest
\\eulerversion=EulerOS_Server_V200R012C00SPC503B870_x86_64
\\compiletime=2024-07-03-14-00-00
\\kernelversion=5.10.0-136.12.0.86.h1905
```
从上可以看到为Euler 2.12版本的X86_64架构
##### 配置yum源
1. 在路径/etc/yum.repos.d/下创建或修改repo文件,如创建base.repo。
```bash
vim base.repo
```
2. 在文件中写入如下信息。

```
[base]
name=base
baseurl=http://mirrors.tools.huawei.com/euler/2.9/os/x86_64/
enabled=1
gpgcheck=1
gpgkey=http://mirrors.tools.huawei.com/euler/2.9/os/RPM-GPG-KEY-EulerOS
```
3. 执行yum clean all清除原有yum缓存。

```
yum clean all
```
4. 执行yum makecache生成新的缓存。

```
yum makecache
```
5. 执行yum makecache时可能报错“Curl error (6): Couldn't resolve host name for https://mirrors.tools.huawei.com/kubernetes/yum/repos/kubernetes-el7-x86_64/repodata/repomd.xml”，增加DNS服务器即可
```bash
echo "search huawei.com
nameserver 10.72.255.100
nameserver 10.72.55.82
nameserver 10.98.48.39">>/etc/resolv.conf
```
#### 2.依赖包安装

1. 安装numactl软件包（“error while loading shared libraries: libnuma.so.1: cannot open shared object file: No such file or directory;”）

```
yum -y install numactl
```
2. 安装ncurses-libs软件包，并添加软链接到libtinfo.so.5（“error while loading shared libraries: libtinfo.so.5: cannot open shared object file: No such file or directory”）
```bash
yum install ncurses-libs
ln -s /usr/lib64/libtinfo.so.6 /usr/lib64/libtinfo.so.5

```
# 
4. 编辑my.cnf文件并根据初始化信息修改路径
```bash
vi /etc/my.cnf
```
my.cnf配置如下：
```
[mysqld]
port=3306
basedir=/usr/local/mysql-8.0.24-linux-glibc2.12-x86_64
datadir=/usr/local/mysql-8.0.24-linux-glibc2.12-x86_64/data
socket=/usr/local/mysql-8.0.24-linux-glibc2.12-x86_64/mysql.sock
character-set-server=utf8
```
## 添加mysql服务
1. 添加mysql服务到系统
cp -a ./support-files/mysql.server /etc/init.d/mysql
# 
### PS:linux中服务启动的原理
1. init
以前的Linux启动都是用init进程。启动服务：
```bash
sudo /etc/init.d/apache2 start
# 或者
service apache2 start
```
(缺点：
启动时间长。init进程是串行启动，只有前一个进程启动完，才会启动下一个进程。
启动脚本复杂。init进程只是执行启动脚本，不管其他事情。脚本需要自己处理各种情况，这往往使得脚本变得很长。)
2. systemd
在较新的linux系统上，都使用systemd 取代了init，成为系统的第一个进程（PID 等于 1），其他进程都是它的子进程。systemd为系统启动和管理提供了完整的解决方案。它提供了一组命令。字母d是守护进程（daemon）的缩写。systemctl是 systemd 的主命令，用于管理系统。查看systemd 的版本:
```bash
$ systemctl --version
```
systemctl命令的实质是管理和操作systemd下的Unit，如/etc/systemd/system、/lib/systemd/system以及/usr/lib/systemd/system等
1. 目录/lib/systemd/system以及/usr/lib/systemd/system其实指向的是同一目录, /usr/lib/systemd/system是/lib/systemd/system的软链接。
2. /lib/systemd/system/ 该目录中包含的是软件包安装的单元,也就是说通过yum、dnf、rpm等软件包管理命令管理的systemd单元文件，都放置在该目录下。
3. /etc/systemd/system/(系统管理员安装的单元, 优先级更高)，在一般的使用场景下，每一个 Unit（服务等） 都有一个配置文件，告诉 Systemd 怎么启动这个 Unit 。Systemd 默认从目录/etc/systemd/system/读取配置文件。但是，里面存放的大部分文件都是符号链接，指向目录/usr/lib/systemd/system/，真正的配置文件存放在这个目录。
system目录下主要包含以下文件类型：
- mount：为程序定义一个挂载点（放到哪个目录运行）；
- target：定义了一些基础的组件供.service文件调用；
- wants：定义了一些要执行文件的合集的目录，每次执行该合集时，目录里所有的文件都会被执行；
- service：定义了一个服务（分为三部分）；
# 
2. 授权mysql
```bash
chmod +x /etc/init.d/mysql
```
3. 添加服务
```bash
chkconfig --add mysql
```
## 启动mysql
1. 启动mysql

```bash
systemctl start mysql
```
# 
### PS:sock位置错误
此处执行时出现了报错“ERROR 2002 (HY000): Can't connect to local MySQL server through socket”，是无法找到正确的mysql.sock的位置，可用`mysql -S /usr/local/mysql-8.0.24-linux-glibc2.12-x86_64/mysql.sock -u root -p`命令指定sock位置， 也可以将我们之前设置的mysql.sock软链接到错误查找的位置
```bash
ln -s /usr/local/mysql-8.0.24-linux-glibc2.12-x86_64/mysql.sock /tmp/mysql.sock
```
# 
2. 将mysql命令添加到环境变量中，采用软链接将mysql命令加入到/usr/bin目录中

```bash
ln -s /usr/local/mysql-8.0.24-linux-glibc2.12-x86_64/bin/mysql /usr/bin/mysql
```
3. 登录mysql,密码使用之前随机生成的密码
```bash
mysql -uroot -p
```
4. 修改root密码
```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'ABC';
```
‘ABC’为修改后的密码，需自己拟定
刷新权限使密码生效
```sql
flush privileges;
```


---
title: "Claude Code不被封实战-VPS住宅代理链路搭建指南"
source: "https://ata.atatech.org/articles/12020682803?spm=ata.23639420.0.0.15527536bRffno"
author:
  - "[[秦世名(夜斯)]]"
published:
created: 2026-10-20
description:
tags:
  - "clippings"
---
这篇操作文档最初只是在自己团队内小范围分享，后来有幸被同学转发到其他组，累计阅读2000+，帮助了数百位同学顺利完成安装。此前蚂蚁文档受权限所限，很多人需要私聊申请权限才能查看；为方便更多人，想发布到ATA，希望能帮到正需要的你。

## VPS 住宅代理链路搭建指南

> 公司或者自己电脑都可以安装。若在公司电脑，已跟蚂蚁数安超人的安全同事确认，该方案可以正常操作。另外，注意敏感数据不要使用外部模型。

从零开始，搭建一条让 AI 服务走干净住宅 IP 出口的代理链路。cc、codex等同理可适用。

## 先别慌，看这里

整个搭建只需要 买两样东西 + 跑两段配置，半小时内能搞定：

你需要买的：

1. 一台海外 VPS 服务器（最便宜的就行，约 $20/年）
2. 一个海外静态 ISP 住宅代理（约 $3/月）

你需要做的：

1. 在 VPS 上跑一个部署脚本（复制粘贴，替换账号密码，一键完成）
2. 在本地装一个 Clash 客户端，导入一份配置文件

就这些。下面的文档会一步步带你走完，遇到问题随时问 AI。

---

## 一、为什么需要这条链路

AI 服务商（Claude、ChatGPT、Gemini 等）会检测访问者的 IP 类型。如果你的出口 IP 属于机房或数据中心（`hosting=true`），大概率被 Cloudflare 拦截或触发风控。因此，流量的最终出口必须是一个干净的家庭宽带 IP（住宅 IP），才能正常使用这些服务。

本机先通过 Trojan 协议连接租用的VPS（流量伪装成普通 HTTPS，不会被运营商拦截），再由 VPS 转发到住宅代理，最终以住宅 IP 的身份访问 AI 服务。

---

## 二、架构总览

```
Trojan 加密隧道                 SOCKS5 代理
                     (伪装为 HTTPS)               (仅 AI 流量走此路)
                                                  
┌──────────┐          ┌──────────┐          ┌──────────────┐          ┌──────────┐
│          │  ──①──>  │          │  ──②──>  │              │  ──③──>  │          │
│  你的电脑  │          │   VPS    │          │  ISP 住宅代理  │          │  AI 服务  │
│ (Clash)  │          │(sing-box)│          │(静态住宅 IP)   │          │(Claude等) │
│          │  <─────  │          │  <─────  │              │  <─────  │          │
└──────────┘          └──────────┘          └──────────────┘          └──────────┘
     │                      │
     │ 阿里系/国内流量        │ 非 AI 流量
     ↓ 直连（不进隧道）       ↓ VPS 自身 IP 直连
 阿里内网/国内站点         普通网站
```

### 三段链路各自的职责

| 段落 | 路径 | 协议 | 作用 |
| --- | --- | --- | --- |
| ① | 电脑 → VPS | Trojan（TLS 加密，SNI 伪装为 `www.microsoft.com`） | 穿透运营商封锁，流量看起来像在访问微软官网 |
| ② | VPS → ISP 住宅代理 | SOCKS5（仅匹配 AI 域名的流量） | 将 AI 流量转发到住宅代理，其余流量由 VPS 直连 |
| ③ | ISP 住宅代理 → AI 服务 | HTTPS | 以住宅 IP 身份访问 AI 服务，不触发机房 IP 风控 |

### 分流策略

```
┌─ 阿里系域名/进程 ──→ 本地直连（不进隧道）
                       │
本地 Clash 判断 ────────┼─ AI 域名 ─────────→ 隧道 → VPS → ISP 住宅代理 → AI 服务
                       │
                       ├─ 国内流量(GEOIP CN)→ 本地直连
                       │
                       └─ 其他流量 ─────────→ 兜底组（默认直连，可手动切到 VPS）
```

| 流量类型 | 走向 | 原因 |
| --- | --- | --- |
| 阿里系域名/进程 | 本地直连 | 阿里内网必须直连，走代理会超时 |
| AI 域名（Claude / OpenAI / Gemini 等） | VPS → ISP 住宅代理 | 需要干净住宅 IP |
| IP 探测站点（ipinfo.io 等） | VPS → ISP 住宅代理 | 用于验证出口 IP 是否正确 |
| 国内流量（GEOIP CN） | 本地直连 | 无需代理 |
| 其他海外流量 | 兜底组（默认直连，可手动切换） | 按需选择 |

---

## 三、名词解释

| 名词 | 一句话解释 |
| --- | --- |
| VPS | 你在海外租的一台 Linux 服务器，充当代理中转站 |
| 住宅 IP | ISP 分配给家庭宽带的真实 IP，AI 服务商不会当作代理封锁 |
| 静态 ISP 代理 | 固定住宅 IP 的 SOCKS5 代理服务（非轮转），每次出口 IP 不变 |
| Trojan | 代理协议，把流量伪装成普通 HTTPS 请求，极难被识别封锁 |
| sing-box | 运行在 VPS 上的开源代理平台，负责接收入站、分流、转发 |
| Clash Verge Rev | macOS/Windows 代理客户端（Mihomo 内核），负责本地流量分流 |
| SNI | TLS 握手时的域名字段，Trojan 利用它伪装成访问正常网站 |
| SOCKS5 | 通用代理协议，ISP 住宅代理通过它提供接入 |
| 自签证书 | 自己生成的 TLS 证书，客户端需设置 `skip-cert-verify: true` |
| blackmatrix7 规则集 | 社区维护的在线分流规则（OpenAI/Claude/Gemini/Copilot），每日更新 |

---

## 四、你需要购买什么

### 4.1 一台 VPS 服务器

推荐购买地址： [RackNerd 特价套餐](https://www.racknerd.com/specials/)

购买最便宜的这个就行。21.99美元。可支付宝支付。

![](25bd33c7-00c7-498b-b968-e2d194f114ce.png)

| 项目 | 要求 |
| --- | --- |
| 服务商 | RackNerd（推荐）/ 搬瓦工 / Vultr 等 |
| 机房 | 美国（洛杉矶 / 圣何塞 / 芝加哥） |
| 系统 | Ubuntu 22.04+（CentOS 7 坑多，强烈不推荐） |
| 配置 | 最低 1 核 1G 即可 |
| 需记录 | VPS IP、SSH 端口（默认 22）、root 密码 |

> 购买完成后，VPS 的 IP 地址、SSH 端口、root 密码等登录信息会发送到你的注册邮箱，注意查收。

买好后确认能 SSH 连上：

```ssh
ssh root@<VPS_IP>
```

### 4.2 一个静态 ISP 住宅代理

推荐购买地址： [Proxy-Seller 美国 ISP 代理](https://proxy-seller.com/zh/isp/?region=3758)

购买最便宜的就行，3美元一个月，可续约，需要visa卡支付。

![](b75bb913-7a7a-4fcf-9610-b17ba04a5994.png)

| 项目 | 要求 |
| --- | --- |
| 服务商 | Proxy-Seller（推荐）/ IPRoyal / Soax / Smartproxy 等 |
| 类型 | 静态 IP（非轮转），美国地区 |
| 协议 | SOCKS5 |
| IP 质量 | 购买后务必验证是纯净住宅 IP（见下方检测方法） |
| 需记录 | 代理 IP、SOCKS5 端口、HTTP 端口、用户名、密码 |

IP 纯净度检测：购买后用以下网站验证 IP 质量，确认 `hosting=false` / `proxy=false` / 风险评分低：

| 检测网站 | 地址 | 重点关注 |
| --- | --- | --- |
| Ping0 | [https://ping0.cc/](https://ping0.cc/) | 原生 IP 检测、IP 类型、风险等级 |
| IPQualityScore | [https://www.ipqualityscore.com](https://www.ipqualityscore.com/) | Fraud Score、proxy/VPN/hosting 标记 |
| IPInfo | [https://ipinfo.io](https://ipinfo.io/) | IP 类型（isp/hosting）、地理位置 |

---

## 五、VPS 端部署（一键脚本）

### 5.1 准备信息

| 信息 | 示例值 |
| --- | --- |
| VPS IP | `203.0.113.10`（替换为你的 VPS IP） |
| Trojan 端口 | `8443`（自选，1024-65535） |
| ISP 代理 IP | `192.0.2.50`（替换为你的住宅代理 IP） |
| ISP 代理端口 | `50101`（Proxy-Seller 提供的 SOCKS5 端口） |
| ISP 代理用户名 | `myuser`（替换为你的代理用户名） |
| ISP 代理密码 | `mypassword`（替换为你的代理密码） |

### 5.2 部署脚本

将以下脚本保存为 `deploy.sh`，修改配置区的变量为你自己的信息（可以丢给本地的大模型帮你替换）：脚本

```#!/bin/bash#
#!/bin/bash
# ============================================================
# VPS 住宅代理链路一键部署脚本
# 架构：本地 Clash → VPS Trojan 入站 → 静态 ISP 代理出站 → AI 服务
# 适用系统：Ubuntu 22.04+
# ============================================================

set -e

# ======================== 配置区（改这里） ========================
VPS_IP="你的VPS_IP"
TROJAN_PORT=8443
TROJAN_PASSWORD=$(openssl rand -hex 16)

ISP_PROXY_IP="你的ISP代理IP"
ISP_PROXY_PORT=50101
ISP_PROXY_USERNAME="你的ISP代理用户名"
ISP_PROXY_PASSWORD="你的ISP代理密码"

SINGBOX_VERSION="1.13.11"
SINGBOX_DIR="/etc/sing-box"
CERT_DIR="${SINGBOX_DIR}/cert"
CONFIG_FILE="${SINGBOX_DIR}/config.json"
SERVICE_FILE="/etc/systemd/system/sing-box.service"
SNI="www.microsoft.com"
# ==============================================================

echo "============================================"
echo "  VPS 住宅代理链路部署脚本"
echo "============================================"
echo ""
echo "VPS IP:        ${VPS_IP}"
echo "Trojan 端口:   ${TROJAN_PORT}"
echo "Trojan 密码:   ${TROJAN_PASSWORD}"
echo "ISP 代理:      ${ISP_PROXY_IP}:${ISP_PROXY_PORT}"
echo "sing-box 版本: ${SINGBOX_VERSION}"
```

### 5.3 上传并执行

```#
# 上传脚本到 VPS
scp deploy.sh root@<VPS_IP>:/root/

# SSH 登录并执行
ssh root@<VPS_IP> "bash /root/deploy.sh"
```

### 5.4 确认部署成功

脚本执行完毕后，应看到：

```
[7/7] 验证部署...
--- VPS 直连出口 IP ---
203.0.113.10            ← 应显示你的 VPS IP
--- ISP 代理出口 IP ---
192.0.2.50              ← 应显示你的 ISP 住宅 IP

============================================
  部署完成！
============================================
```

务必记录输出的 Trojan 密码，后续本地配置需要用到。

手动验证命令：

```#
# 检查 sing-box 服务状态
ssh root@<VPS_IP> "systemctl status sing-box"

# 检查 VPS 直连 IP
ssh root@<VPS_IP> "curl -s4 https://ipinfo.io/json"

# 检查 ISP 代理出口 IP（替换为你的代理信息）
ssh root@<VPS_IP> "curl -s4 --socks5 <用户名>:<密码>@<ISP代理IP>:<端口> https://ipinfo.io/json"
```

---

## 六、本地 Clash Verge Rev 配置

### 6.1 安装

从 [GitHub Release](https://github.com/clash-verge-rev/clash-verge-rev/releases) 下载安装。

可以直接找我（夜斯）发给你安装包也行。从git上下载很慢。

![](7b9d752a-a265-4140-8217-2d22072a66e8.png)

### 6.2 导入配置

将以下配置内容保存为文件 `clash-local-ai.yaml`（放在任意目录，如下载目录）。

操作路径：订阅 → 新建 → Local 类型 → 选择文件 `clash-local-ai.yaml` 导入。

![](0c68e782-c05d-4792-ae76-a0b15abcc954.png)

端口7897

![](c93c1e5a-5a32-4806-86a0-697bd6131705.png)

> 替换两个字段：`server` 改为你的 VPS IP，`password` 改为部署脚本输出的 Trojan 密码。（可以通过大模型帮你替换）脚本

```#
# ================================================================
# Clash Verge Rev 完整配置
# 架构：本地 Clash → VPS Trojan → ISP 住宅代理 → AI 服务
# ================================================================

mixed-port: 7897
allow-lan: false
mode: rule
log-level: info
ipv6: true
unified-delay: true

profile:
  store-selected: true

tun:
  enable: false
  stack: gvisor
  auto-route: true
  strict-route: false
  auto-detect-interface: true
  dns-hijack:
    - any:53

dns:
  enable: true
  listen: :1053
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - 223.5.5.5
    - 119.29.29.29
  fallback:
    - 8.8.8.8
    - 1.1.1.1
  fallback-filter:
```

### 6.3 激活配置

1. 订阅页面 → 右键点击刚导入的配置 → 右键「使用」→ 点击右上角火苗图标重新激活
![](305dfea3-6344-4b6e-952f-6b3a3d83c92e.png)
2. 代理页面 → 确认出现「AI Only」和「兜底」两个组
3. 「AI Only」组选择 VPS-住宅IP，「兜底」组选择 DIRECT
![](55ffdfad-0f22-4f36-bb52-b5075ecc07a8.png)
4. 首页左侧「当前节点」模块 → 代理组选 AI Only，节点选 VPS-住宅IP，代理模式选 规则（Rule）
![](5790bf6a-32e3-43a9-a4c4-308492b5acb6.png)
5. 首页右侧「网络设置」→ 打开 系统代理 开关
![](4e9ed6e2-7461-4c96-a0da-ea1553241f32.png)

### 6.4 踩坑经验

1. 看不到节点/代理组：配置文件本身没问题，但 Clash Verge Rev 加载偶尔会抽风。解决办法：删除配置重新导入、重启软件、多试几次。
2. 开了系统代理后百度都打不开：进入「代理」页面，确认「兜底」组选的是 DIRECT（直连）。如果还不行，尝试切到其他选项再切回 DIRECT，多点几次触发重载。
3. 实在搞不定：问 Claude Code（CC），把报错信息贴给它，它会一步步帮你排查。

---

## 七、终端代理配置（让命令行也走 Clash）

开了 Clash 系统代理后，浏览器的流量会自动走 Clash 分流。但终端里的命令行工具（curl、git、npm、claude CLI 等）默认不走系统代理，需要手动配置环境变量。

在 `~/.zshrc`（macOS 默认 shell）末尾添加：

```#
# Clash 代理（终端流量走 Clash 分流）
export HTTP_PROXY="http://127.0.0.1:7897"
export HTTPS_PROXY="http://127.0.0.1:7897"
export NO_PROXY="localhost,127.0.0.1"
```

保存后执行 `source ~/.zshrc` 使其生效。

三行各自的作用：

| 变量 | 作用 |
| --- | --- |
| `HTTP_PROXY` | HTTP 请求交给 Clash 处理 |
| `HTTPS_PROXY` | HTTPS 请求交给 Clash 处理 |
| `NO_PROXY` | 访问 localhost / 127.0.0.1 时不走代理，避免本地开发出问题 |

> 注意：配了这三行后，终端工具依赖 Clash 运行。如果 Clash 没开，终端请求会报 `Connection refused`。临时取消代理可执行：`unset HTTP_PROXY HTTPS_PROXY`（仅当前窗口生效）。

---

## 八、端到端验证

部署完成后，依次验证三件事：

### 7.1 出口 IP 是住宅 IP【重要】

【重要】返回住宅ip，代表整个链路搭建成功

【重要】返回住宅ip，代表整个链路搭建成功

【重要】返回住宅ip，代表整个链路搭建成功

```curl
curl -x http://127.0.0.1:7897 https://ipinfo.io/json
```

期望输出：

```{
{
  "ip": "192.0.2.50",          ← 应显示你的 ISP 住宅 IP，不是本地 IP
  "city": "Los Angeles",
  "region": "California",
  "country": "US"
}
```

### 7.2 AI 服务可达

```#
# curl 不带浏览器 UA 会被 Cloudflare 拦截返回 403，这是正常的
curl -x http://127.0.0.1:7897 https://claude.ai -o /dev/null -w "%{http_code}\n"
# 期望：403

# 真正的验证：用浏览器打开 claude.ai，应能正常登录使用
```

### 7.3 阿里流量未走代理

```curl
curl -x http://127.0.0.1:7897 https://www.taobao.com -o /dev/null -w "%{http_code}\n"
# 期望：200（直连，未经过 VPS）
```

### 7.4 开启Claude Code

可以使用原生的claude命名进入之后，输入登录命令，会弹出一个链接，点击之后就授权成功了。

![](a75bf29d-3c79-4b34-94fd-c079867e7bb8.png)

切换模型 /model opus

![](545d739c-3027-4e06-82c0-132e78091f7e.png)

---

## 九、排障指南

### 常见问题

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| curl 返回本地 IP | 模式不是「规则」或 AI Only 组未选节点 | 切到「规则」模式，确认 AI Only 选中 VPS-住宅IP |
| SSL\_ERROR\_SYSCALL | 隧道连通但数据中断 | 查 VPS 日志：`journalctl -u sing-box -n 30` |
| 节点延迟超时 | VPS 端口不可达 | 检查防火墙 `ufw status`，确认 8443 已放行；检查云服务商安全组 |
| claude.ai 浏览器也 403 | ISP 代理 IP 不干净 | 联系代理服务商换 IP |
| sing-box 启动失败 | 配置语法错误 | `sing-box check -c /etc/sing-box/config.json` |
| 阿里网站超时 | 全局模式下阿里流量走了 VPS | 切回「规则」模式 |
| ISP 代理连接失败 | 代理服务异常或信息错误 | 在 VPS 上测试：`curl --socks5 用户名:密码@IP:端口 https://ipinfo.io/json` |
| 看不到代理组 | 配置类型选错了 | 确认使用 Local（独立） 类型，不是 Merge |

### 常用调试命令

```#
# 查看 sing-box 日志
ssh root@<VPS_IP> "journalctl -u sing-box --no-pager -n 50"

# 查看 Trojan 密码
ssh root@<VPS_IP> "cat /root/trojan-password.txt"

# 重启 sing-box
ssh root@<VPS_IP> "systemctl restart sing-box"
```

---

## 十、日常维护

### 更换 ISP 代理

ISP 代理的 IP/端口/密码变更时：

```ssh
ssh root@<VPS_IP>
vi /etc/sing-box/config.json    # 修改 isp-proxy-out 的 server/server_port/username/password
systemctl restart sing-box
```

### 更换 Trojan 密码

需要 VPS 和本地同步修改：

1. VPS 端：修改 `/etc/sing-box/config.json` 中 `users[0].password`，然后 `systemctl restart sing-box`
2. 本地端：修改 Clash 配置中的 `password` 字段，重新激活配置

### 升级 sing-box

```ssh
ssh root@<VPS_IP>
wget -O /tmp/sing-box.tar.gz "https://github.com/SagerNet/sing-box/releases/download/v<新版本>/sing-box-<新版本>-linux-amd64.tar.gz"
cd /tmp && tar xzf sing-box.tar.gz
cp sing-box-*/sing-box /usr/local/bin/sing-box
systemctl restart sing-box
rm -rf /tmp/sing-box*
```

### 添加新 AI 域名

在 Clash 配置的 `rules` 区域，AI 域名部分添加一行：

```-
- DOMAIN-SUFFIX,新域名.com,AI Only
```

保存后重新激活配置即可。

---

最后，感谢@冷松 @宁晔的技术支持

---

感谢阅读，若有帮助，感谢点个小赞赞~

中
# 环境搭建
用openssl命令在环境上创建证书
```bash
\\产生密钥文件
openssl genpkey -algorithm RSA -out key.pem -aes256
\\产生证书
openssl req -new -x509 -key key.pem -out cert.pem -days 365
```
用openssl在环境上开户端口并监听
```bash
s_server -accept 31943 -cert cert.pem -key key.pem -www
```
用curl命令发送https请求
```
curl -k https://127.0.0.1:31943
```
用tcpdump抓取指定端口的包
```
sudo tcpdump -i lo port 31943 -w ssl.cap
```

# 结果分析
![](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_PicturesSnipaste_2024-08-18_12-21-37.png)
如上图所示，握手过程均已被抓包，需要注意的是，在TLS握手过程中，每一次握手都会应答一个TCP的ACK报文，而ACK报文是不携带字节数的，所以后续的握手过程中的SEQ和ACK没有与TCP的ACK报文一致。

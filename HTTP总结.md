# HTTP
## HTTP 基本概念
HTTP 是超文本传输协议，也就是**H**yper**T**ext **T**ransfer **P**rotocol。

HTTP 的名字「超文本协议传输」，它可以拆成三个部分：

- 超文本: **超越了普通文本的文本**，它是文字、图片、视频等的混合体，最关键有超链接，能从一个超文本跳转到另外一个超文本;
- 传输: HTTP 是一个在计算机世界里专门用来在**两点之间传输数据**的约定和规范。
- 协议: HTTP 是一个用在计算机世界里的**协议**。它使用计算机能够理解的语言确立了一种计算机之间交流通信的规范（**两个以上的参与者**），以及相关的各种控制和错误处理方式（**行为约定和规范**）。

![三个部分](https://cdn.xiaolincoding.com/gh/xiaolincoder/ImageHost/计算机网络/HTTP/3-HTTP三部分.png)

## HTTP报文格式

![image-20240828224921462](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240828224921462.png)

### 请求报文
#### 请求行
请求报文的第一行称为请求行，这一行有三部分由空格分隔开并且被两个字符(回车和换行）终止。这些字段称为方法、URL和版本。
##### 方法字段
方法字段定义了请求类型。在 HTTP1.1版中定义了若干种方法。绝大多数情况下，客户使用GET方法发送一个请求。在这种情况下，报文的主体是空的。当客户仅需要从服务器获得关于网页的信息，如上次修改的时间，这时使用HEAD方法。它也可以用来检测URL 的有效性。这种情况下的响应报文只有头部;主体是空的。PUT方法与GET方法是相反的;它允许客户将一个新的页面发送到服务器上（如果允许的话)。POST方法与PUT方法类似，但是它用来发送一些信息到服务器上，这些信息被加入网页或用来修改网页。TRACE方法用来调试;客户要求服务器回送请求来检查服务器是否正在获得请求。如果客户获得许可，DELETE方法允许客户删除一个服务器上的网页。CONNECT方法原先作为预留方法，这个方法可能被代理服务器使用。最后，OPTIONS方法允许客户询问网页属性。

![image-20240828225432341](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240828225432341.png)

##### URL
统一资源定位符（Uniform Resource Locator，URL)
作为文件，网页需要有一个唯一的标识符来与其他网页区别开。为了定义一个网页，我们需要三个标识符，主机、端口以及路径。然而在定义网页之前，我们需要告知浏览器我们想使用哪个客户-服务器应用，这称为协议。这意味着我们需要四个标识符来定义网页。第一个是用来获取网页的运载工具形式，后三项组合在一起定义了目的对象（网页)。
##### 版本
版本，给出了协议的版本，HTTP最常用的版本是1.1。
#### 请求头部
在请求行之后有一个或多个请求头部( request header)行。每一个头部行都从客户端向服务器发送额外的信息。例如,客户可以请求以某种特定格式发送文档。每个头部行有头部名字、一个冒号、一个空格和一个头部值。表2-2列出了一些请求中常用的头部名字。值字段定义了与每个头部名字相关的值。值列表可以在相应的RFC中查找到。

![image-20240828225912537](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240828225912537.png)
#### 主体
主体可以出现在请求报文中。通常，当使用POST 或 PUT方法时，它包含要发送的评论或要发布到网站上的文档。
### 响应报文
响应报文包含状态行、头部行并且有时包含主体。
#### 状态行
响应报文的第一行称为状态行。这一行有三个字段，它们由空格分隔开并且被两个字符(回车和换行)终止。第一个字段定义了HTTP协议的版本，通常为1.1。状态码字段定义了请求的状态。它包含三个数字。在100范围内的代码只代表一个报告，在200范围内的代码表示这是一个成功的请求。在300范围内的代码表示把客户端重定向到另一个URL，在400范围内的代码表示在客户端发生错误。最后，在500范围内的代码表示错误发生在服务器端。
>HTTP 常见的状态码有哪些？
![ 五大类 HTTP 状态码 ](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures6-%E4%BA%94%E5%A4%A7%E7%B1%BBHTTP%E7%8A%B6%E6%80%81%E7%A0%81.png)

`1xx` 类状态码属于**提示信息**，是协议处理中的一种中间状态，实际用到的比较少。

- 「**101 Switching Protocols**」协议切换，服务器已经理解了客户端的请求，并将通过 Upgrade 消息头通知客户端采用不同的协议来完成这个请求。比如切换到一个实时且同步的协议（如 WebSocket）以传送利用此类特性的资源。

`2xx` 类状态码表示服务器**成功**处理了客户端的请求，也是我们最愿意看到的状态。

- 「**200 OK**」是最常见的成功状态码，表示一切正常。如果是非 `HEAD` 请求，服务器返回的响应头都会有 body 数据。

- 「**204 No Content**」也是常见的成功状态码，与 200 OK 基本相同，但响应头没有 body 数据。

- 「**206 Partial Content**」是应用于 HTTP 分块下载或断点续传，表示响应返回的 body 数据并不是资源的全部，而是其中的一部分，也是服务器处理成功的状态。

`3xx` 类状态码表示客户端请求的资源发生了变动，需要客户端用新的 URL 重新发送请求获取资源，也就是**重定向**。 

- 「**301 Moved Permanently**」表示永久重定向，说明请求的资源已经不存在了，需改用新的 URL 再次访问。

- 「**302 Found**」表示临时重定向，说明请求的资源还在，但暂时需要用另一个 URL 来访问。

301 和 302 都会在响应头里使用字段 `Location`，指明后续要跳转的 URL，浏览器会自动重定向新的 URL。

- 「**304 Not Modified**」不具有跳转的含义，表示资源未修改，重定向已存在的缓冲文件，也称缓存重定向，也就是告诉客户端可以继续使用缓存资源，用于缓存控制。

`4xx` 类状态码表示客户端发送的**报文有误**，服务器无法处理，也就是错误码的含义。

- 「**400 Bad Request**」表示客户端请求的报文有错误，但只是个笼统的错误。

- 「**403 Forbidden**」表示服务器禁止访问资源，并不是客户端的请求出错。

- 「**404 Not Found**」表示请求的资源在服务器上不存在或未找到，所以无法提供给客户端。

`5xx` 类状态码表示客户端请求报文正确，但是**服务器处理时内部发生了错误**，属于服务器端的错误码。

- 「**500 Internal Server Error**」与 400 类似，是个笼统通用的错误码，服务器发生了什么错误，我们并不知道。

- 「**501 Not Implemented**」表示客户端请求的功能还不支持，类似“即将开业，敬请期待”的意思。

- 「**502 Bad Gateway**」通常是服务器作为网关或代理时返回的错误码，表示服务器自身工作正常，访问后端服务器发生了错误。

- 「**503 Service Unavailable**」表示服务器当前很忙，暂时无法响应客户端，类似“网络服务正忙，请稍后重试”的意思。
#### 响应状况
在状态行之后,我们可以有一个或多个响应头部行。每一个头部行都从服务器向客户端发送额外的信息。例如，发送方可以发送关于文档的额外信息。每个头部行都有一个头部名称、一个冒号、一个空格和一个头部值。
![image-20240828230350490](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20240828230350490.png)
#### 主体
主体包含了从服务器发送给客户的文档。除非响应是一个错误报文，否则主体是存在的。

>GET 和 POST 有什么区别？

GET 的语义是请求获取指定的资源。GET 方法是安全、幂等、可被缓存的。
POST 的语义是根据请求负荷（报文主体）对指定的资源做出处理，具体的处理方式视资源类型而不同。POST 不安全，不幂等，（大部分实现）不可缓存。

根据 RFC 规范，**GET 的语义是从服务器获取指定的资源**，这个资源可以是静态的文本、页面、图片视频等。GET 请求的参数位置一般是写在 URL 中，URL 规定只能支持 ASCII，所以 GET 请求的参数只允许 ASCII 字符，而且浏览器会对 URL 的长度有限制（HTTP 协议本身对 URL 长度并没有做任何规定）。

比如，你打开我的文章，浏览器就会发送 GET 请求给服务器，服务器就会返回文章的所有文字及资源。

![GET 请求](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures12-Get%E8%AF%B7%E6%B1%82.png)

根据 RFC 规范，**POST 的语义是根据请求负荷（报文 body）对指定的资源做出处理**，具体的处理方式视资源类型而不同。POST 请求携带数据的位置一般是写在报文 body 中，body 中的数据可以是任意格式的数据，只要客户端与服务端协商好即可，而且浏览器不会对 body 大小做限制。

比如，你在我文章底部，敲入了留言后点击「提交」（**暗示你们留言**），浏览器就会执行一次 POST 请求，把你的留言文字放进了报文 body 里，然后拼接好 POST 请求头，通过 TCP 协议发送给服务器。

![POST 请求](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures13-Post%E8%AF%B7%E6%B1%82.png)

- **GET 方法就是安全且幂等的**，因为它是「只读」操作，无论操作多少次，服务器上的数据都是安全的，且每次的结果都是相同的。所以，**可以对 GET 请求的数据做缓存，这个缓存可以做到浏览器本身上（彻底避免浏览器发请求），也可以做到代理上（如 nginx），而且在浏览器中 GET 请求可以保存为书签**。
- **POST** 因为是「新增或提交数据」的操作，会修改服务器上的资源，所以是**不安全**的，且多次提交数据就会创建多个资源，所以**不是幂等**的。所以，**浏览器一般不会缓存 POST 请求，也不能把 POST 请求保存为书签**。

>安全和幂等的概念：
- 在 HTTP 协议里，所谓的「安全」是指请求方法不会「破坏」服务器上的资源。
- 所谓的「幂等」，意思是多次执行相同的操作，结果都是「相同」的。

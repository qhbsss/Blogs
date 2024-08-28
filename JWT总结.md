# 认证 (Authentication) 和授权 (Authorization)的区别

- **认证 (Authentication)：** 你是谁。
- **授权 (Authorization)：** 你有权限干什么。

稍微正式点（啰嗦点）的说法就是：

- **Authentication（认证）** 是验证您的身份的凭据（例如用户名/用户 ID 和密码），通过这个凭据，系统得以知道你就是你，也就是说系统存在你这个用户。所以，Authentication 被称为身份/用户验证。
- **Authorization（授权）** 发生在 **Authentication（认证）** 之后。授权嘛，光看意思大家应该就明白，它主要掌管我们访问系统的权限。比如有些特定资源只能具有特定权限的人才能访问比如 admin，有些对系统资源操作比如删除、添加、更新只能特定人才具有。

认证：

![认证登录](https://oss.javaguide.cn/github/javaguide/system-design/security/authentication-login.png)

授权：

![没有权限](https://oss.javaguide.cn/github/javaguide/system-design/security/20210604161032412.png)

这两个一般在我们的系统中被结合在一起使用，目的就是为了保护我们系统的安全性。

# Cookie
![](https://oss.javaguide.cn/github/javaguide/system-design/security/cookie-sessionId.png)

`Cookie` 和 `Session` 都是用来跟踪浏览器用户身份的会话方式，但是两者的应用场景不太一样。

**`Cookie` 存放在客户端，一般用来保存用户信息**。

下面是 `Cookie` 的一些应用案例：

1. 我们在 `Cookie` 中保存已经登录过的用户信息，下次访问网站的时候页面可以自动帮你登录的一些基本信息给填了。除此之外，`Cookie` 还能保存用户首选项，主题和其他设置信息。
2. **使用 `Cookie` 保存 `SessionId` 或者 `Token` ，向后端发送请求的时候带上 `Cookie`，这样后端就能取到 `Session` 或者 `Token` 了。这样就能记录用户当前的状态了，因为 HTTP 协议是无状态的。**
3. `Cookie` 还可以用来记录和分析用户行为。举个简单的例子你在网上购物的时候，因为 HTTP 协议是没有状态的，如果服务器想要获取你在某个页面的停留状态或者看了哪些商品，一种常用的实现方式就是将这些信息存放在 `Cookie`
4. ……

# Session
在WEB开发中，服务器可以为每个用户浏览器创建一个会话对象（session对象），注意：一个浏览器独占一个session对象（默认情况下）。因此，在需要保存用户数据时，服务器程序可以把用户数据写到用户浏览器独占的 session 中，当用户使用浏览器访问其它程序时，其它程序可以从用户的 session 中取出该用户的数据，为用户服务。

Session 代表着服务器和客户端一次会话的过程。Session 对象存储特定用户会话所需的信息。这样，当用户在应用程序的 Web 页之间跳转时，存储在 Session 对象中的信息将不会丢失，而是在整个用户会话中一直存在下去。当客户端关闭会话，或者 Session 超时失效时会话结束。也就是说，session 的作用是能够让服务器在某一用户登录之后，用户进行的所有操作都保持在同一会话之内，这样就能够记住用户的状态，并且能记住用户在这次会话中进行的一系列操作和保存的信息。

**session 存储在服务器端，session 是用来存储信息的，在 cookie 里面插入的只是 session id，是识别某一 session 的唯一标识。**
## Cookie 和 Session 有什么区别？

**`Session` 的主要作用就是通过服务端记录用户的状态。** 典型的场景是购物车，当你要添加商品到购物车的时候，系统不知道是哪个用户操作的，因为 HTTP 协议是无状态的。服务端给特定的用户创建特定的 `Session` 之后就可以标识这个用户并且跟踪这个用户了。

`Cookie` 数据保存在客户端(浏览器端)，`Session` 数据保存在服务器端。相对来说 `Session` 安全性更高。如果使用 `Cookie` 的一些敏感信息不要写入 `Cookie` 中，最好能将 `Cookie` 信息加密然后使用到的时候再去服务器端解密。
## 如何使用 Session-Cookie 方案进行身份验证？

很多时候我们都是通过 `SessionID` 来实现特定的用户，`SessionID` 一般会选择存放在 Redis 中。举个例子：

1. 用户成功登陆系统，然后返回给客户端具有 `SessionID` 的 `Cookie` 。
2. 当用户向后端发起请求的时候会把 `SessionID` 带上，这样后端就知道你的身份状态了。

关于这种认证方式更详细的过程如下：

![](https://oss.javaguide.cn/github/javaguide/system-design/security/session-cookie-authentication-process.png)

1. 用户向服务器发送用户名、密码、验证码用于登陆系统。
2. 服务器验证通过后，服务器为用户创建一个 `Session`，并将 `Session` 信息存储起来。
3. 服务器向用户返回一个 `SessionID`，写入用户的 `Cookie`。
4. 当用户保持登录状态时，`Cookie` 将与每个后续请求一起被发送出去。
5. 服务器可以将存储在 `Cookie` 上的 `SessionID` 与存储在内存中或者数据库中的 `Session` 信息进行比较，以验证用户的身份，返回给用户客户端响应信息的时候会附带用户当前的状态。

使用 `Session` 的时候需要注意下面几个点：

- 依赖 `Session` 的关键业务一定要确保客户端开启了 `Cookie`。
- 注意 `Session` 的过期时间。

## 为什么 Cookie 无法防止 CSRF 攻击，而 Token 可以？
### CSRF攻击
**CSRF(Cross Site Request Forgery)** 一般被翻译为 **跨站请求伪造** 。那么什么是 **跨站请求伪造** 呢？说简单点，就是用你的身份去发送一些对你不友好的请求。举个简单的例子：

小壮登录了某网上银行，他来到了网上银行的帖子区，看到一个帖子下面有一个链接写着“科学理财，年盈利率过万”，小壮好奇的点开了这个链接，结果发现自己的账户少了 10000 元。这是这么回事呢？原来黑客在链接中藏了一个请求，这个请求直接利用小壮的身份给银行发送了一个转账请求,也就是通过你的 Cookie 向银行发出请求。

```html
<a src=http://www.mybank.com/Transfer?bankId=11&money=10000>科学理财，年盈利率过万</>
```
### 原因分析
**因为sessionId直接存放在cookie中，当用户点击陷阱链接时，cookie中存放的sessionId一起被发送过去了，但是当使用token时，因为token存放在localStorage中，只有当用户要发送向特定服务器的请求时，才会去后端读取token写入到cookie中，因此即使用户误点了陷阱链接，此时cookie中并没有存放发往特定服务器的sessionId，因此能够避免CSRF攻击。**

上面也提到过，进行 `Session` 认证的时候，我们一般使用 `Cookie` 来存储 `SessionId`,当我们登陆后后端生成一个 `SessionId` 放在 Cookie 中返回给客户端，服务端通过 Redis 或者其他存储工具记录保存着这个 `SessionId`，客户端登录以后每次请求都会带上这个 `SessionId`，服务端通过这个 `SessionId` 来标示你这个人。如果别人通过 `Cookie` 拿到了 `SessionId` 后就可以代替你的身份访问系统了。

`Session` 认证中 `Cookie` 中的 `SessionId` 是由浏览器发送到服务端的，借助这个特性，攻击者就可以通过让用户误点攻击链接，达到攻击效果。

但是，我们使用 `Token` 的话就不会存在这个问题，在我们登录成功获得 `Token` 之后，一般会选择存放在 `localStorage` （浏览器本地存储）中。然后我们在前端通过某些方式会给每个发到后端的请求加上这个 `Token`,这样就不会出现 CSRF 漏洞的问题。因为，即使你点击了非法链接发送了请求到服务端，这个非法请求是不会携带 `Token` 的，所以这个请求将是非法的。

![](https://oss.javaguide.cn/github/javaguide/system-design/security/20210615161108272.png)

## 不论是 `Cookie` 还是 `Token` 都无法避免 **跨站脚本攻击（Cross Site Scripting）XSS** 

### XSS攻击
跨站脚本攻击（Cross Site Scripting）缩写为 CSS 但这会与层叠样式表（Cascading Style Sheets，CSS）的缩写混淆。因此，有人将跨站脚本攻击缩写为 XSS。
XSS 中攻击者会用各种方式将恶意代码注入到其他用户的页面中。就可以通过脚本盗用信息比如 `Cookie` 。
### 解决方案
JWT也会存在 XSS 攻击的风险。为了避免 XSS 攻击，你可以选择将 JWT 存储在标记为httpOnly 的 Cookie 中。但是，这样又导致了你必须自己提供 CSRF 保护，因此，实际项目中我们通常也不会这么做。
常见的避免 XSS 攻击的方式是过滤掉请求中存在 XSS 攻击风险的可疑字符串。

# JWT

JWT （JSON Web Token） 是目前最流行的跨域认证解决方案，是一种基于 Token 的认证授权机制。 从 JWT 的全称可以看出，JWT 本身也是 Token，一种规范化之后的 JSON 结构的 Token。

JWT 自身包含了身份验证所需要的所有信息，因此，我们的服务器不需要存储 Session 信息。这显然增加了系统的可用性和伸缩性，大大减轻了服务端的压力。

可以看出，**JWT 更符合设计 RESTful API 时的「Stateless（无状态）」原则** 。

并且， 使用 JWT 认证可以有效避免 CSRF 攻击，因为 JWT 一般是存在在 localStorage 中，使用 JWT 进行身份验证的过程中是不会涉及到 Cookie 的。

## JWT组成
![JWT 组成](https://oss.javaguide.cn/javaguide/system-design/jwt/jwt-composition.png)

JWT 本质上就是一组字串，通过（`.`）切分成三个为 Base64 编码的部分：

- **Header（头部）** : 描述 JWT 的元数据，定义了生成签名的算法以及 `Token` 的类型。Header 被 Base64Url 编码后成为 JWT 的第一部分。
- **Payload（载荷）** : 用来存放实际需要传递的数据，包含声明（Claims），如`sub`（subject，主题）、`jti`（JWT ID）。Payload 被 Base64Url 编码后成为 JWT 的第二部分。
- **Signature（签名）**：服务器通过 Payload、Header 和一个密钥(Secret)使用 Header 里面指定的签名算法（默认是 HMAC SHA256）生成。生成的签名会成为 JWT 的第三部分。

## 如何基于 JWT 进行身份验证？

在基于 JWT 进行身份验证的的应用程序中，服务器通过 Payload、Header 和 Secret(密钥)创建 JWT 并将 JWT 发送给客户端。客户端接收到 JWT 之后，会将其保存在 Cookie 或者 localStorage 里面，以后客户端发出的所有请求都会携带这个令牌。

![ JWT 身份验证示意图](https://oss.javaguide.cn/github/javaguide/system-design/jwt/jwt-authentication%20process.png)

简化后的步骤如下：

1. 用户向服务器发送用户名、密码以及验证码用于登陆系统。
2. 如果用户用户名、密码以及验证码校验正确的话，服务端会返回已经签名的 Token，也就是 JWT。
3. 用户以后每次向后端发请求都在 Header 中带上这个 JWT 。
4. 服务端检查 JWT 并从中获取用户相关信息。

两点建议：

1. 建议将 JWT 存放在 localStorage 中，放在 Cookie 中会有 CSRF 风险。
2. 请求服务端并携带 JWT 的常见做法是将其放在 HTTP Header 的 `Authorization` 字段中（`Authorization: Bearer Token`）。


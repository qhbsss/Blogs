---
title: "前端调试技巧-Chrome DevTools"
source: "https://ata.atatech.org/articles/11000192172?spm=ata.23639746.0.0.7e531130Qx829d"
author:
published:
created: 2026-09-06
description:
tags:
  - "clippings"
---
云智能集团








从事前端项目的开发工作，难免会遇到一些问题，如何做到快速的定位并解决问题，这就需要一些调试上的技巧，好的调试技巧能够帮你事半功倍的找出问题所在，高效地解决问题，这也是技术经验积累的体现。

前端开发必然要和我们的老朋友浏览器打交道，而在众多浏览器中占据统治地位，并且前端开发人员接触最多的也就是 Chrome 浏览器了。本文将针对 Chrome 内置的一组用于网页制作和调试的工具 Chrome DevTools，分享一些调试上经常用到的小技巧，希望能够提高你的调试效率。

本文主要侧重点是一些有效但不一定广为人知的调试技巧，对于非常基础的调试操作，就略过不做科普性介绍。

## Elements 面板

打开 Elements 面板，我们就能以 DOM 树的形式查看当前页面的所有 **元素** 及其对应的 **样式** ，同时能够对这样元素和样式进行实时的可视化编辑。

> 我们可以对 DOM 树上的元素做任意修改（元素类型、属性、拖动位置、删除节点等），当然这些修改都是临时的，不会保存，刷新页面所有的修改都会重置。

Elements 面板左侧部分为元素面板、右侧部分为样式面板。

![image.png](https://oss-ata.alibaba.com/article/2023/11/6eb6c6df-2f95-405b-8206-6530c550c940.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

在左侧的元素面板中，选中一个元素，右键或点击元素前的【...】都能呼出相应的操作面板。我们重点说明其中的 **Force state** 和 **Break on** 。

### Force state 调试特殊状态的元素

对于一些在元素处于特定状态下的样式（如 hover），我们在调试时不太方便，很难在维持元素状态同时进行一些调试操作。

使用 **Force state** 可以让所选元素处于相应的状态（支持多个状态同时选中），让我们方便地调试特殊状态的元素。

![image.png](https://oss-ata.alibaba.com/article/2023/11/1a44dd21-b3bd-4cb9-b39c-8ddcc64a901c.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

该功能也能在样式面板中开启，让调试的操作步骤更少。

![image.png](https://oss-ata.alibaba.com/article/2023/11/29dadbdd-0b6d-431f-b1a2-6e6f363d7e4d.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

### Break on 设置 DOM 断点

断点更常见的是在 JS 代码中设置，其实 DOM 元素也是支持添加断点的。它主要用来监听 JS 代码对 DOM 节点所做的一些修改。

![image.png](https://oss-ata.alibaba.com/article/2023/11/6cb730c6-80c1-4dc8-aab2-2c59145c533e.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

支持 3 种类型的 DOM 断点：

- subtree modifications: 所选节点的 **子节点发生修改** 时触发
- attribute modifications: 所选节点的 **属性发生修改** 时触发
- node removal: 所选节点 **被删除** 时触发

例如，我为 `application-main` 元素设置了一个 attribute modifications 断点。

![image.png](https://oss-ata.alibaba.com/article/2023/11/01df819f-21db-4a50-a841-a986ecc3499b.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

> 在样式面板中，选择【DOM Breakpoints】tab，可以看到所有设置 DOM 断点的元素及其断点类型。

并在控制台输入代码对其属性进行修改，

document.getElementsByClassName('application-main ')[0].setAttribute('id', 'main');

回车时，就会自动触发断点，暂停代码执行，并跳到修改属性的代码所在的位置。

![image.png](https://oss-ata.alibaba.com/article/2023/11/5cef7610-c694-42f9-8977-31d22fa54d92.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

当我们在遇到 DOM 节点发生改变，但是又不清楚是哪里的代码对其产生了影响时，使用 DOM 断点调试非常有效。

### 巧用 setTimeout 与 debugger

前端页面中，经常会遇到一些通过事件触发渲染的 DOM，例如 Tooltip、模态框等，它们的位置可能脱离了正常的 DOM 结构，或者直接是通过 JS 生成的，这时候要想找到它们的位置进行调试，就很麻烦。

这里介绍一个小技巧，同样是利用断点，将 `setTimeout` 与 `debugger` 结合使用，通过事件触发这些 DOM 渲染之后，自动触发断点，暂停代码执行，就可以对这些 DOM 进行调试了。

操作起来也很简单：

1. 在控制台输入 `setTimeout(() => { debugger; }, 2000);` ，回车执行
2. 在页面触发事件，如 mouseover 触发 Tooltip，等待 `debugger;` 触发，自动跳转到 Sources 面板
3. 切换到 Elements 面板，进行 DOM 和样式调试

![image.png](https://oss-ata.alibaba.com/article/2023/11/5dda0139-31bb-4f45-87de-a56e0d544391.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

### Style 面板中的一些小技巧

#### 让 Minified 样式文件可读

在查看样式规则定义的源文件时，经常会遇到一些 minified 样式文件，完全不具备可读性，要让这些文件可读，其实很简单，只需点击 Format 图标。

![image.png](https://oss-ata.alibaba.com/article/2023/11/93660af7-a97d-481a-975a-3205bff5d886.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

#### 快速修改样式面板中的数值

在编辑样式面板中的一些数值型的值（如 `margin` 、 `font-size` ），可以使用键盘快捷键进行快速操作：

- Up/Down，将值以 1 为单位进行修改，如果当前值在 -1 到 1 之间，则修改单位为 0.1
- Option + Up/Down，将值以 0.1 为单位进行修改
- Shift + Up/Down，将值以 10 为单位进行修改
- Shift + Command + Up/Down，将值以 100 为单位进行修改

#### 选择要添加规则的样式表

当添加样式规则时，我们还可以选择将该样式规则添加到哪个样式表文件中，只需在点击添加新样式规则时按住不放，就可以选择样式表文件。在涉及到多个样式表文件的样式规则覆盖时，该选项比较适用。

![image.png](https://oss-ata.alibaba.com/article/2023/11/ae7f282c-4963-482b-a850-362591a391ed.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

## Console 面板

Console 面板是我们使用最多的一个面板，它主要提供两个功能：

1. 打印记录页面在执行过程中所有的代码诊断信息
2. 提供执行 JS 代码的能力，作为 shell 与文档和 DevTools 交互

Console 面板提供的 tab 项，主要是用于对控制台打印的信息进行过滤筛选，如根据类型、文件名、执行环境等，这里不做展开。

### 执行表达式

我们可以在 Console 面板中输入任何表达式，按回车执行。而 Chrome DevTools 也自带了一些有用的表达式和 API，这里简单介绍下。

[控制台实用工具 API](https://developers.google.com/web/tools/chrome-devtools/console/utilities) 包含一组用于执行常见任务的函数集：

- 选择和检查 DOM 元素
- 以可读格式显示数据
- 停止和启动分析器
- 监听 DOM 事件

#### $_

`$_` 返回最近一次执行的表达式的值。

#### 0,1, 2,3, $4

`$0` 、 `$1` 、 `$2` 、 `$3` 和 `$4` 命令作为对 Elements 面板中检查的最后 5 个 DOM 元素或 Profiles 面板中选择的最后 5 个 JavaScript 堆对象的历史引用。 `$0` 返回最近选中的元素或 JavaScript 对象， `$1` 返回第二最近选中的元素，依此类推。

#### $(selector, [startNode])

`$(selector)` 返回指定 CSS 选择器的第一个 DOM 元素的引用。当用一个参数调用时，这个函数是 `document.querySelector()` 函数的别名。

#### (selector, [startNode])

`(selector)` 返回一个数组元素匹配给定的 CSS 选择器。该命令相当于调用 `document.querySelectorAll()` 。

#### $x(path, [startNode])

`$x(path)` 返回与给定 XPath 表达式匹配的 DOM 元素数组。

XPath（XML Path Language）使用路径表达式来选取 XML 文档中的节点或节点集。XPath 语法这里不做展开，有兴趣可以参考 [XPath | MDN](https://developer.mozilla.org/en-US/docs/Web/XPath) 。

#### clear()

`clear()` 清除控制台的历史记录。

#### copy(object)

`copy(object)` 将指定对象的字符串表示形式复制到剪贴板。

#### debug(function)

当调用了指定的函数时，就会进入 debug 模式，中断函数执行，并进入 Sources panel，可以开始调试。

使用 `undebug(fn)` 取消对函数设置的断点，或使用 UI 禁用所有断点。

#### dir(object)

`dir(object)` 显示所有指定对象属性的对象样式列表。该方法是等价于 `console.dir()` 方法。

#### dirxml(object)

`dirxml(object)` 打印指定对象的 XML 表示形式，如 Elements 选项卡中所示。该方法等价于 `console.dirxml()` 方法。

#### inspect(object/function)

`inspect(object/function)` 打开并在适当的面板中选择指定的元素或对象：DOM 元素的 Elements 面板或JavaScript 堆对象的 Profiles 面板。

当传递一个函数给 `inspect` 时，该函数将在 Sources 面板中打开。

#### getEventListeners(object)

`getEventListeners(object)` 返回在指定对象上注册的事件监听器。

#### keys(object)

返回一个数组，其中包含属于指定对象的属性的名称。要获得相同属性的关联值，可以使用values()。

#### monitor(function)

`monitor(function)` 当调用指定的函数时，将一条消息记录到控制台，该控制台指明了函数名以及在调用函数时传递给函数的参数。

使用 `unmonitor(function)` 停止监视。

#### monitorEvents(object[, events])

`monitorEvents(object[, events])` 当指定对象上发生指定的事件之一时，该事件对象将在控制台打印。可以指定要监视的单个事件、事件数组或映射到预定义事件集合的通用事件“类型”之一。

`unmonitorEvents(object[, events])` 停止监视指定对象和事件的事件。

#### profile([name])

`profile()` 用一个可选的名称启动一个 JavaScript CPU 分析会话。
`profileEnd()` 完成 profile 并在 Profile 面板中显示结果。

#### queryObjects(Constructor)

从控制台调用 `queryObjects(Constructor)` 以返回使用指定构造函数创建的对象数组。 例如：

- `queryObjects(Promise)`, 返回所有 Promise。
- `queryObjects(HTMLElement)`, 返回所有 HTML 元素。
- `queryObjects(foo)`, 其中 foo 是函数名称。 返回通过 `new foo()` 实例化的所有对象。

`queryObjects()` 的范围是控制台中当前选择的执行上下文。

#### table(data[, columns])

通过传入带可选列标题的数据对象，记录带有表格式的对象数据。

### 实时表达式

如果需要在控制台中重复输入相同的 JavaScript 表达式，更简单的方式是创建 live 表达式。在 live 表达式中，只需输入一个表达式，就会自动固定到控制台顶部。表达式的值会实时更新。

![image.png](https://oss-ata.alibaba.com/article/2023/11/0ff3c3a4-cd7d-46d9-bff1-10720e71b33e.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

## Sources 面板

在初学 JavaScript 时，我们应该都用过 `console.log()` 调试大法，与 Sources 面板相比，这种方法实在是太低效。Sources 面板也是我们在遇到 JavaScript 问题时，使用最多的一个面板了。Sources 面板分为三部分：

1. “文件导航”窗格。 页面请求的每个文件都在此处列出。
2. “代码编辑器”窗格。在“文件导航”窗格中选择一个文件后，该文件的内容将显示在这里。
3. “JavaScript 调试”窗格。用于检查页面 JavaScript 的各种工具。

![Sources 面板的三部分](https://oss-ata.alibaba.com/article/2023/11/28f3c6e3-8dc2-4692-b40b-b18c006ae44d.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

Sources 面板的三部分

下面介绍一些 Sources 面板相关的知识与调试小技巧，这是假设你已经对 Sources 面板的基本调试流程比较熟悉，如果还不太了解，可以先参考 [Get Started with Debugging JavaScript in Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools/javascript) 。

### 断点类型

最著名的断点类型是代码行。 但是，代码行断点的设置效率可能很低，尤其是在不知道确切位置或正在使用大型代码库的情况下。 通过了解如何以及何时使用其他类型的断点，可以在调试时节省时间。

- 代码行（line-of-code）断点：在确切的代码区域暂停
- 条件代码行（conditional line-of-code）断点：在确切的代码区域暂停，并且只有指定的条件为 true 时生效
- DOM 断点：在修改或移除指定 DOM 节点或它的子节点的代码暂停
- XHR 断点：当 XHR URL 包含了指定的字符串模式时暂停
- 事件监听断点：在触发事件(如 click)后运行的代码上暂停
- 异常断点：在抛出捕获或未捕获异常的代码行上暂停
- 函数断点：每当调用特定函数时暂停

#### 代码行断点

代码行断点是最常用的断点类型，如何设置就不做展开了，这里补充一点，也可以使用 `debugger` 实现代码行断点。区别在于，这种方法是在你的代码里设置断点的，而不是在 DevTools 中。

```javascript
console.log('a');
console.log('b');
debugger;
console.log('c');
```

#### 条件代码行断点

在要设置断点的代码行右击，然后选择“添加条件断点”，输入条件代码，回车之后，就能看到黄色的断点标志了。

![条件代码行断点](https://oss-ata.alibaba.com/article/2023/11/00046d62-54fc-4d48-ae41-2b274162343a.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

#### DOM 断点

前文已经介绍过 DOM 断点，这里不再复述。

#### XHR/Fetch 断点

当 XHR 的请求 URL 包含指定的字符串时，需要中断，可以使用 XHR 断点。DevTools 会暂停在 XHR 调用 `send()` 的那行代码上（Fetch 请求同样使用）。

如果页面正在请求一个错误的 URL，并且你想要快速查找导致错误请求的 AJAX 或 Fetch 源代码，使用该断点非常适用。

![添加 XHR 断点](https://oss-ata.alibaba.com/article/2023/11/b1a169ac-ba96-4e77-a79a-f8ea265f53f1.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

#### 事件监听断点

如果想在事件触发后运行的事件监听代码上暂停时，使用事件监听断点，可以选择特定事件（例如 “click”）或事件类别（例如所有鼠标事件）。

![添加事件监听断点](https://oss-ata.alibaba.com/article/2023/11/119afbec-63b8-40ef-90b1-aaa63dd50954.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

#### 异常断点

如果想在抛出捕获或未捕获异常的代码行上暂停时，可以使用异常断点。

![启用异常断点](https://oss-ata.alibaba.com/article/2023/11/6691d925-1707-45d8-a102-4e2ebca296c2.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

如果除了未捕获的异常外，还想暂停捕获的异常，勾选 “Pause On Caught Exceptions” 即可。

#### 函数断点

调用 `debug(functionName)` ，其中 `functionName` 是你想要调试的函数。每次函数调用时都会暂停。可以将 `debug()` 插入到代码中或者直接在控制台使用。 `debug()` 等价于在函数的第一行设置代码行断点。

> 需要注意的一点：指定的目标函数，需要在当前作用域中，否则会抛出异常。

```javascript
(function () {
  function hey() {
    console.log('hey');
  }
  function yo() {
    console.log('yo');
  }
  debug(yo); // This works.
  yo();
})();
debug(hey); // This doesn't work. hey() is out of scope.
```

如果在控制台执行 `debug()` ，要想确保作用域就很麻烦了，这里有个小技巧：

1. 在函数作用域内的某处设置代码行断点
2. 触发断点
3. 当代码仍然在代码行断点上暂停时，在 DevTools 控制台中调用 `debug()`

### 快速执行代码到指定行

有时候我们会调试很长的函数或者打了很多的断点，可能有很多与调试的问题无关的代码，我们想要代码执行到某一行，一种方法是在这一行添加断点，然后逐步执行到这个位置，另一种更推荐的快捷方法是：右击当前行，选择“Continue to here”，DevTools 会运行所有代码，然后在该行上暂停。

![Continue to here](https://oss-ata.alibaba.com/article/2023/11/073d9326-315b-4ff5-a991-2455de36d52c.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

Continue to here

### 重启调用堆栈的顶层函数

我们在调试时，很多时候都会遇到执行过了打断点的位置，但是又没有定位到问题的情况，大多数人的做法都是重复一次问题复现的流程，再次触发断点。

这种方法非常低效，这里非常推荐 Chrome DevTools 提供的一种高效的方法，重启调用堆栈的顶层函数。

当在一行代码上暂停时，右击调用堆栈窗格中的任何地方，并选择“Restart Frame”就能重新暂停到调用堆栈中顶层函数的第一行，顶层函数是最后一个被调用的函数，然后就可以重新继续你的调试了。

![Restart Frame](https://oss-ata.alibaba.com/article/2023/11/b7eb1c40-b37e-49f8-afd5-1386c7b94a3e.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

Restart Frame

### 强制脚本执行

若要忽略所有断点并恢复脚本执行，除了可以禁用所有的断点，还有一种方式强制脚本执行，点击并按住“Resume Script Execution”然后选择“Force script execution”。

![Force script execution](https://oss-ata.alibaba.com/article/2023/11/fd697e48-cc21-4846-9952-2cff96154941.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

Force script execution

### 设置脚本黑名单

调试时，如果想忽略某些脚本，例如可信的第三方库脚本，确定问题与其无关时，可以为其设置黑名单，在逐步执行代码时，就不会执行到该脚本的函数。

设置脚本黑名单的三种方式：

1. 在编辑面板打开文件，右击，选择“Blackbox Script”
2. 在调用栈面板，右击脚本中的函数，选择“Blackbox Script”
3. 打开“Setting”，选择“Blackboxing”Tab，点击“Add pattern”，输入脚本名或一个正则，这种方式支持为多个脚本设置黑名单

### 直接编辑脚本

我们的调试问题时，如果想要验证当前修复是否有效，完全不需要修改本地代码，然后重新加载浏览器页面。只需要在编辑面板修改脚本，并保存，就可以进行验证。

### Snippet

如果需要在控制台中重复运行相同的代码，可以将代码另存为 Snippet。 Snippet 是在 Sources 面板中编写的脚本，它们可以访问页面的 JavaScript 上下文，可以在任何页面上运行它们。

使用方法参考 [Run Snippets Of JavaScript On Any Page With Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools/javascript/snippets) 。

## Network 面板

网络相关的常见问题及解法。

### 请求处于队列中或停滞状态

6个请求正在同时下载。在此之后，一系列请求被排队或停止。一旦前六个请求中的一个完成，队列中的一个请求就会启动。

原因：

- 在单个域上发送了太多请求。 在 HTTP/1.0 或 HTTP/1.1 连接上，Chrome 最多允许每个主机同时建立 TCP 连接。

解法：

- 如果必须使用 HTTP/1.0 或 HTTP/1.1 连接，实现域分片（domain sharding）
- 使用 HTTP/2，无需考虑域分片
- 删除或延迟不必要的请求，以便重要的请求可以更早下载

### Time To First Byte (TTFB) 很慢

请求要花很长时间等待从服务器接收第一个字节。

原因：

- 客户端与服务器之间的连接很慢
- 服务器响应缓慢。在本地托管服务器，以确定是连接速度慢还是服务器速度慢。如果使用本地服务时，TTFB仍然很慢，则服务器速度很慢

解法：

- 如果连接速度慢，考虑将内容托管在CDN上或更改托管提供商
- 如果服务器速度较慢，考虑优化数据库查询、实现缓存或修改服务器配置

### 内容下载很慢

请求需要很长时间才能下载。

原因：

- 客户端与服务器之间的连接很慢
- 很多内容正在被下载

解法：

- 考虑在CDN上托管内容或改变托管提供商。
- 通过优化请求，发送更少的字节。

### 请求的时间分解

单击请求表的“Name”列下的请求的URL，选择“Timing” tab，可以看到关于每个阶段的时间信息。

- Queueing.
	当以下情况发生时，浏览器会将请求排队：
	- 有优先级更高的请求
		- 对于这个源，已经有 6 个 TCP 连接打开，仅针对 HTTP/1.0 或 HTTP/1.1 连接
		- 浏览器正在磁盘缓存中短暂分配空间
- Stalled
	Queueing 中描述的任何原因，请求都可能被 Stalled。
- DNS Lookup
	浏览器正在解析请求的IP地址。
- Initial connection
	浏览器正在建立连接，包括 TCP 握手/重试和协商 SSL。
- Proxy negotiation
	浏览器正在与代理服务器协商请求。
- Request sent
	正在发送请求。
- ServiceWorker Preparation
	浏览器正在启动service worker。
- Request to ServiceWorker
	请求正在被发送到service worker。
- Waiting(TTFB)
	浏览器正在等待响应的第一个字节。TTFB 表示到第一个字节的时间。这个计时包括一个来回的延迟和服务器准备响应的时间。
- Content Download
	浏览器正在接收响应。
- Receiving Push
	浏览器正在通过 HTTP/2 服务器推送接收此响应的数据。
- Reading Push
	浏览器正在读取先前接收的本地数据。

### 请求的发起者和依赖项

请求表中还支持查看当前请求的发起者和依赖它的请求。按住 Shift 并将鼠标悬停在请求表中的请求上，发起者显示为绿色，依赖项显示为红色。

![initiators and dependencies](https://oss-ata.alibaba.com/article/2023/11/17d895ff-ca54-488a-b96c-fcd328f26198.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

initiators and dependencies

当请求表按时间顺序排列时，悬停在请求之上的第一个绿色请求就是依赖项的启动器。如果在它上面有另一个绿色的请求，那个更高的请求就是启动器的启动器。

### DOMContentLoaded 与 load 事件

网络面板的多个地方显示 `DOMContentLoaded` 和 `load` 事件的时间。 `DOMContentLoaded` 事件是蓝色的， `load` 事件是红色的。

![DOMContentLoaded and load events in the Network panel](https://oss-ata.alibaba.com/article/2023/11/85ade986-e561-4a85-bea5-ec7d3769f21e.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

DOMContentLoaded and load events in the Network panel

简单说明这两个事件的区别：

- `DOMContentLoaded` 事件会在初始 HTML 文档完全加载和解析后触发，而不需要等待样式表、图像和子 frame 完成加载。
```javascript
	window.addEventListener('DOMContentLoaded', (event) => {
	console.log('DOM fully loaded and parsed');
	});
```
- `load` 事件应该只用于检测一个完全加载的页面。一个常见的错误是在 `DOMContentLoaded` 更合适的地方使用 `load` 。
```javascript
	window.addEventListener('load', (event) => {
	 console.log('page is fully loaded');
	});
```

## Performance 面板

Performance 面板主要用于分析页面运行时的性能，这里不做展开。

## Memory 面板

内存问题很重要，因为用户通常可以通过以下几种方式感知内存问题：

- 页面的性能会随着时间的推移而逐渐变差，这可能是内存泄漏引起的。
- 页面的性能总是很差。这可能是内存膨胀的症状。内存膨胀是指一个页面使用的内存超过了最佳页面速度所需的内存。
- 页面的性能会延迟或频繁出现暂停。这可能是频繁的垃圾收集的症状。在收集期间，所有脚本执行都暂停。因此，如果浏览器进行了大量的垃圾收集，脚本执行将会经常暂停。

可以通过 chrome 的任务管理器，简单查看当前所有 tab 页使用的内存情况。

如果想要看更多的内存信息，就需要使用 Memory 面板了，由于这块在日常开发中接触比较少，下面简单介绍一下其使用方法。

### 内存相关术语

在介绍 Memory 面板之前，先对其中涉及到的一些术语做简单说明。

#### 对象大小

对象持有内存的两种方式：

- 直接由对象本身
- 隐式地持有对其他对象的引用，从而防止这些对象被垃圾收集器（简称GC）自动处理

#### Shallow Size & Retained Size

Shallow Size 是对象本身持有的内存大小。

典型的 JavaScript 对象保留一些内存用于其描述和存储立即值。 通常，只有数组和字符串可以具有较大的 Shallow Size。 但是，字符串和外部数组通常将其主要存储在渲染器内存中，从而仅在JavaScript堆上公开一个小的包装对象。

渲染器内存是呈现被检查页面的进程的所有内存：原生内存 + 页面的 JS 堆内存 + 该页面启动的所有 worker 的 JS 堆内存。 然而，通过防止其他对象被自动垃圾收集过程丢弃，即使是很小的对象也可以间接地保留大量内存。

Retained Size 是在删除对象本身以及它的依赖对象(这些依赖对象无法从 GC 根访问)后释放的内存大小。

GC 根由在 V8 外部从本地代码引用 JavaScript 对象时创建的句柄(本地或全局)组成。所有这些句柄都可以在GC roots > Handle scope and GC roots > Global handles 下的堆快照中找到。

有许多内部 GC 根，其中大多数用户并不感兴趣。从应用的角度来看，有以下几种根：

- window 全局对象(在每个 iframe 中)。堆快照中有一个 distance 字段，它是指从 window 开始的最短保留路径上的属性引用的数量。
- 由遍历文档可到达的所有本地 DOM 节点组成的文档 DOM 树。
- 有时，对象可能被调试器上下文和 DevTools 控制台保留(例如，在控制台求值之后)。

内存图从根开始，根可以是浏览器的窗口对象，也可以是 Node.js 模块的全局对象。你不能控制这个根对象如何被 GC。

![memory graph](https://oss-ata.alibaba.com/article/2023/11/480c1959-42df-47c1-bd32-7c52f40e6c22.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

memory graph

任何不能从 GC 根访问的对象都会被 GC。

#### 对象保留树（Objects retaining tree）

内存图（memory graph）是由边和节点连接成的，两者都有对应的标记：

- 节点（或对象）使用用于构建它们的构造函数的名称进行标记。
- 边使用属性名称进行标记。

Memory 面板分析结果中底部展示的一部分就是对象保留树。

### 内存泄漏识别

节点被从 DOM 树中删除，但是任然被某些 JavaScript 代码引用，这样的节点叫做“分离”节点。分离节点是内存泄漏的常见原因。

> 仅当页面的 DOM 树和 JavaScript 代码都没有对 DOM 节点引用时，才可以对其进行垃圾回收。

堆快照是识别分离节点的一种方法。 堆快照展示了在快照时间点页面的 JS 对象和 DOM 节点之间的内存是如何分配的。

通过对比两个快照之间的差异。如进行某个操作前和操作后内存快照。检查已释放内存中的增量和引用计数可以确认内存泄漏的存在和原因。

分配时间线是另一个可以识别内存泄漏的工具。分析结果中，那些蓝色的条表示新的内存分配。这些新的内存分配是内存泄漏的候选对象。

使用方法参考 [Discover detached DOM tree memory leaks with Heap Snapshots](https://developers.google.com/web/tools/chrome-devtools/memory-problems#discover_detached_dom_tree_memory_leaks_with_heap_snapshots) 。

需要注意的点：

- 每次执行内存分析记录时，先手动执行一次垃圾回收
- 内存调试时，只打开一个页面，因为同一个域名的内存会一起计算

## 参考链接

- [Chrome 开发者工具](https://developers.google.com/web/tools/chrome-devtools)

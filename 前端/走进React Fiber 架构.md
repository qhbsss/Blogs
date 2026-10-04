---
title: "走进React Fiber 架构"
source: "https://ata.atatech.org/articles/11000239927?spm=ata.23639746.0.0.2f711663nyXgXu#MDY5MzMw"
author:
published:
created: 2026-09-14
description:
tags:
  - "clippings"
---
> 本文重点：介绍React重构的起因和目的，理解Fiber tree单向链表结构中各属性含义，梳理调度过程和核心实现手段，深入新的生命周期，hooks，suspense，异常捕获等特性的用法和原理。

当react刚推出的时候，最具革命性的特性就是虚拟dom，因为这大大降低了应用开发的难度，相比较以往告诉浏览器我需要怎么更新我的ui，现在我们只需要告诉react我应用ui的下个状态是怎么样的，react会帮我们自动处理两者之间的所有事宜。

这让我们可以从属性操作、事件处理和手动 DOM 更新这些在构建应用程序时必要的操作中解放出来。宿主树的概念让这个优秀的框架有无限的可能性，react native便是其在原生移动应用中伟大的实现。

但在享受舒适开发体验的同时，有一些疑问一直萦绕在我们脑海中：

- 是什么导致了react用户交互、动画频繁卡顿
- 如何视线优雅的异常处理，进行异常捕获和备用ui渲染
- 如何更好实现组件的复用和状态管理 这究竟是人性的扭曲，还是道德的沦丧 /狗头

Fiber能否给我们答案，又将带给我们什么惊喜，卷起一波新的浪潮，欢迎收看《走进Fiber》

那么，简而言之，React Fiber是什么？

> **Fiber** 是对React核心算法的重构，2年重构的产物就是Fiber reconciler。

## react协调是什么

![](redirect_20.png)

> 协调是react中重要的一部分，其中包含了如何对新旧树差异进行比较以达到仅更新差异的部分。

现在的react经过重构后Reconciliation和Rendering被分为两个不同的阶段。

- **reconciler协调阶段** ：当组件次初始化和其后的状态更新中，React会创建两颗不相同的虚拟树，React 需要基于这两棵树之间的差别来判断如何有效率的更新 UI 以保证当前 UI 与最新的树保持同步，计算树哪些部分需要更新。
- **renderer阶段** ：渲染器负责将拿到的虚拟组件树信息，根据其对应环境真实地更新渲染到应用中。有兴趣的朋友可以看一下dan自己的博客中的文章=》 [运行时的react=》渲染器](https://overreacted.io/react-as-a-ui-runtime/#renderers) ，介绍了react的Renderer渲染器如react-dom和react native等，其可以根据不同的主环境来生成不同的实例。

## 为什么要重写协调

> 动画是指由许多帧静止的画面，以一定的速度（如每秒16张）连续播放时，肉眼因视觉残象产生错觉，而误以为画面活动的作品。——维基百科

老一辈人常常把电影称为“移动的画”，我们小时候看的手翻书就是快速翻动的一页页画，其本质上实现原理跟动画是一样的。

![](redirect_21.png)

帧：在动画过程中，每一幅静止画面即为一“帧”；
帧率：是用于测量显示帧数的量度，测量单位为“每秒显示帧数”（Frame per Second，FPS）或“赫兹”；
帧时长：即每一幅静止画面的停留时间，单位一般是ms(毫秒)；
丢帧：在帧率固定的动画中，某一帧的时长远高于平均帧时长，导致其后续数帧被挤压而丢失的现象；

当前大部分笔记本电脑和手机的常见帧率为60hz，即一秒显示60帧的画面，一帧停留的时间为16.7ms(1000/60≈16.7)，这就留给了开发者和UI系统大约16.67ms来完成生成一张静态图片（帧）所需要的所有工作。如果在这分派的16.67ms之内没有能够完成这些工作，就会引发‘丢帧’的后果，使界面表现的不够流畅。

浏览器中的GUI渲染线程和JS引擎线程

![](redirect_22.png)

> 在浏览器中GUI渲染线程与JS引擎线程是互斥的，当JS引擎执行时GUI线程会被挂起（相当于被冻结了），GUI更新会被保存在一个队列中等到JS引擎空闲时立即被执行。

![](redirect_23.png)
浏览器拥挤的主线程

React16 推出Fiber之前协调算法是Stack Reconciler，即递归遍历所有的 Virtual DOM 节点执行Diff算法，一旦开始便无法中断，直到整颗虚拟dom树构建完成后才会释放主线程，因其JavaScript单线程的特点，若当下组件具有复杂的嵌套和逻辑处理，diff便会堵塞UI进程，使动画和交互等优先级相对较高的任务无法立即得到处理，造成页面卡顿掉帧，影响用户体验。

16年在 facebook 上 Seb 正式提到了 Fiber 这个概念，解释为什么要重写框架：

> Once you have each stack frame as an object on the heap you can do clever things like reusing it during future updates and yielding to the event loop without losing any of your currently in progress data.
> 一旦将每个堆栈帧作为堆上的对象，您就可以做一些聪明的事情，例如在将来的更新中重用它并暂停于事件循环，而不会丢失任何当前正在进行的数据。

我们来做一个实验

```javascript
function randomHexColor() {
  return (
    "#" + ("0000" + ((Math.random() * 0x1000000) << 0).toString(16)).substr(-6)
  );
}

var root = document.getElementById("root");

// 一次性遍历100000次
function a() {
  setTimeout(function() {
    var k = 0;
    for (var i = 0; i < 10000; i++) {
      k += new Date() - 0;
      var el = document.createElement("div");
      el.innerHTML = k;
      root.appendChild(el);
      el.style.cssText = \`background:${randomHexColor()};height:40px\`;
    }
  }, 1000);
}

// 每次只操作100个节点，共100次
function b() {
  setTimeout(function() {
    function loop(n) {
      var k = 0;
      console.log(n);
      for (var i = 0; i < 100; i++) {
        k += new Date() - 0;
        var el = document.createElement("div");
        el.innerHTML = k;
        root.appendChild(el);
        el.style.cssText = \`background:${randomHexColor()};height:40px\`;
      }
      if (n) {
        setTimeout(function() {
          loop(n - 1);
        }, 40);
      }
    }
    loop(100);
  }, 1000);
}
```

a执行性能截图：掉帧严重，普遍fps为1139.6ms
![](redirect_24.png)

b执行性能截图: fps处于15ms～19ms
![](redirect_25.png)

> 究其原因是因为浏览器的主线程需要处理GUI描绘，时间器处理，事件处理，JS执行，远程资源加载等，当做某件事，只有将它做完才能做下一件事。如果有足够的时间，浏览器是会对我们的代码进行编译优化（JIT）及进行热代码优化，一些DOM操作，内部也会对reflow进行处理。reflow是一个性能黑洞，很可能让页面的大多数元素进行重新布局。

而作为一只有梦想的前端菜🐤，为用户爸爸呈现最好的交互体验是我们义不容辞的责任，把困难扛在肩上，让我们see see react是如何解决以上的问题。

## Fiber你是个啥（第四音

那么我们先看看作为看看解决方案的Fiber是什么，然后在分析为什么它能解决以上问题。

#### 定义：

1. react Reconciliation协调核心算法的一次重新实现
2. 虚拟堆栈帧
3. 具备扁平化的链表数据存储结构的js对象，Reconciliation阶段所能拆分的最小工作单元

#### 针对其定义我们来进行拓展：

##### 虚拟堆栈帧：

Andrew Clark的 [React Fiber体系文档](https://github.com/acdlite/react-fiber-architecture) 很好地解释了Fiber实现背后的想法，我在这里引用一下：

> Fiber是堆栈的重新实现，专门用于React组件。
> 您可以将单个Fiber视为虚拟堆栈框架。
> 重新实现堆栈的优点是，您可以将堆栈帧保留在内存中，并根据需要（以及在任何时候）执行它们。
> 这对于实现调度的目标至关重要。

##### JavaScript的执行模型：call stack

JavaScript原生的执行模型：通过调用栈来管理函数执行状态。
其中每个栈帧表示一个工作单元（a unit of work），存储了函数调用的返回指针、当前函数、调用参数、局部变量等信息。
因为JavaScript的执行栈是由引擎管理的，执行栈一旦开始，就会一直执行，直到执行栈清空。无法按需中止。

react以往的渲染就是使用原生执行栈来管理组件树的递归渲染，当其层次较深component不断递归子节点，无法被打断就会导致主线程堵塞ui卡顿。

![](redirect_26.png)

##### 可控的调用栈

所以理想状况下reconciliation的过程应该是像下图所示一样，将繁重的任务划分成一个个小的工作单元，做完后能够“喘口气儿”。我们需要一种增量渲染的调度，Fiber就是重新实现一个堆栈帧的调度，这个堆栈帧可以按照自己的调度算法执行他们。另外由于这些堆栈是可将可中断的任务拆分成多个子任务，通过按照优先级来自由调度子任务，分段更新，从而将之前的同步渲染改为异步渲染。

它的特性就是时间分片(time slicing)和暂停(supense)。

![](redirect_27.png)

#### 具备扁平化的链表数据存储结构的js对象：

fiber是一个js对象，fiber的创建是通过React元素来创建的，在整个React构建的虚拟DOM树中，每一个元素都对应有一个fiber，从而构建了一棵fiber树，每个fiber不仅仅包含每个元素的信息，还包含更多的信息，以方便Scheduler来进行调度。

让我们看一下fiber的结构

type Fiber = {|
```javascript
  // 标记不同的组件类型
  //export const FunctionComponent = 0;
  //export const ClassComponent = 1;
  //export const HostRoot = 3； 可以理解为这个fiber是fiber树的根节点，根节点可以嵌套在子树中
  //export const Fragment = 7;
  //export const SuspenseComponent = 13;
  //export const MemoComponent = 14;
  //export const LazyComponent = 16;
  tag: WorkTag,

  // ReactElement里面的key
  // 唯一标示。我们在写React的时候如果出现列表式的时候，需要制定key，这key就是对应元素的key。
  key: null | string,

  // ReactElement.type，也就是我们调用\`createElement\`的第一个参数
  elementType: any,

  // The resolved function/class/ associated with this fiber.
  // 异步组件resolved之后返回的内容，一般是\`function\`或者\`class\`
  type: any,

  // The local state associated with this fiber.
  // 跟当前Fiber相关本地状态（比如浏览器环境就是DOM节点）
  // 当前组件实例的引用
  stateNode: any,

  // 指向他在Fiber节点树中的\`parent\`，用来在处理完这个节点之后向上返回
  return: Fiber | null,

  // 单链表树结构
  // 指向自己的第一个子节点
  child: Fiber | null,
  // 指向自己的兄弟结构
  // 兄弟节点的return指向同一个父节点
  sibling: Fiber | null,
  index: number,

  // ref属性
  ref: null | (((handle: mixed) => void) & {_stringRef: ?string}) | RefObject,

  // 新的变动带来的新的props
  pendingProps: any,
  // 上一次渲染完成之后的props
  memoizedProps: any,

  // 该Fiber对应的组件产生的Update会存放在这个队列里面
  updateQueue: UpdateQueue<any> | null,

  // 上一次渲染的时候的state
  // 用来存放某个组件内所有的 Hook 状态
  memoizedState: any,

  // 一个列表，存放这个Fiber依赖的context
  firstContextDependency: ContextDependency<mixed> | null,

  // 用来描述当前Fiber和他子树的\`Bitfield\`
  // 共存的模式表示这个子树是否默认是异步渲染的
  // Fiber被创建的时候他会继承父Fiber
  // 其他的标识也可以在创建的时候被设置
  // 但是在创建之后不应该再被修改，特别是他的子Fiber创建之前
  //用来描述fiber是处于何种模式。用二进制位来表示（bitfield），后面通过与来看两者是否相同//这个字段其实是一个数字.实现定义了一下四种//NoContext: 0b000->0//AsyncMode: 0b001->1//StrictMode: 0b010->2//ProfileMode: 0b100->4
  mode: TypeOfMode,

  // Effect
  // 用来记录Side Effect具体的执行的工作的类型：比如Placement，Update等等
  effectTag: SideEffectTag,

  // 单链表用来快速查找下一个side effect
  nextEffect: Fiber | null,

  // 子树中第一个side effect
  firstEffect: Fiber | null,
  // 子树中最后一个side effect
  lastEffect: Fiber | null,

  // 代表任务在未来的哪个时间点应该被完成
  // 不包括他的子树产生的任务
  // 通过这个参数也可以知道是否还有等待暂停的变更、没有完成变更。
  // 这个参数一般是UpdateQueue中最长过期时间的Update相同，如果有Update的话。
  expirationTime: ExpirationTime,

  // 快速确定子树中是否有不在等待的变化
  childExpirationTime: ExpirationTime,

  //当前fiber对应的工作中的Fiber。
  // 在Fiber树更新的过程中，每个Fiber都会有一个跟其对应的Fiber
  // 我们称他为 current <==> workInProgress
  // 在渲染完成之后他们会交换位置
  alternate: Fiber | null,
  ...
|};
```

[ReactWorkTags组件类型](https://github.com/facebook/react/blob/master/packages/shared/ReactWorkTags.js)

### 链表结构

![](redirect_28.png)
fiber中最为重要的是return、child、sibling指针，连接父子兄弟节点以构成一颗单链表fiber树，其扁平化的单链表结构的特点将以往递归遍历改为了循环遍历，实现深度优先遍历。

React16特别青睐于链表结构，链表在内存里不是连续的，动态分配，增删方便，轻量化，对异步友好

### current与workInProgress

**current树** ：React 在 render 第一次渲染时，会通过 React.createElement 创建一颗 Element 树，可以称之为 Virtual DOM Tree，由于要记录上下文信息，加入了 Fiber，每一个 Element 会对应一个 Fiber Node，将 Fiber Node 链接起来的结构成为 Fiber Tree。它反映了用于渲染 UI 和映射应用状态。这棵树通常被称为 current 树（当前树，记录当前页面的状态）。

**workInProgress树** ：当React经过current当前树时，对于每一个先存在的fiber节点，它都会创建一个替代（alternate）节点，这些节点组成了workInProgress树。这个节点是使用render方法返回的React元素的数据创建的。一旦更新处理完以及所有相关工作完成，React就有一颗替代树来准备刷新屏幕。一旦这颗workInProgress树渲染（render）在屏幕上，它便成了当前树。下次进来会把current状态复制到WIP上，进行交互复用，而不用每次更新的时候都创建一个新的对象，消耗性能。这种同时缓存两棵树进行引用替换的技术被称为 **双缓冲技术** 。

```javascript
function createWorkInProgress(current, ...) {
  let workInProgress = current.alternate;
  if (workInProgress === null) {
    workInProgress = createFiber(...);
  }
  ...
  workInProgress.alternate = current;
  current.alternate = workInProgress;
  ...
  return workInProgress;
}
```

![](redirect_29.png)
**alternate** fiber可以理解为一个fiber版本池，用于交替记录组件更新（切分任务后变成多阶段更新）过程中fiber的更新，因为在组件更新的各阶段，更新前及更新过程中fiber状态并不一致，在需要恢复时（如发生冲突），即可使用另一者直接回退至上一版本fiber。

Dan在 [Beyond React 16](https://reactjs.org/blog/2018/03/01/sneak-peek-beyond-react-16.html) 演讲中用了一个非常恰当的比喻，那就是Git 功能分支，你可以将 WIP 树想象成从旧树中 Fork 出来的功能分支，你在这新分支中添加或移除特性，即使是操作失误也不会影响旧的分支。当你这个分支经过了测试和完善，就可以合并到旧分支，将其替换掉。

### Update

- 用于记录组件状态的改变
- 存放于fiber的updateQueue里面
- 多个update同时存在

比如设置三个setState()，React是不会立即更新的，而是放到UpdateQueue中，再去更新

> ps: setState一直有人疑问为啥不是同步，将 setState() 视为请求而不是立即更新组件的命令。为了更好的感知性能，React 会延迟调用它，然后通过一次传递更新多个组件。React 并不会保证 state 的变更会立即生效。

```javascript
export function createUpdate(
  expirationTime: ExpirationTime,
  suspenseConfig: null | SuspenseConfig,
): Update<*> {
  let update: Update<*> = {
    //任务过期事件
    //在创建每个更新的时候，需要设定过期时间，过期时间也就是优先级。过期时间越长，就表示优先级越低。
    expirationTime,
    // suspense的配置
    suspenseConfig,

  // export const UpdateState = 0; 表示更新State
  // export const ReplaceState = 1; 表示替换State
  // export const ForceUpdate = 2; 强制更新
  // export const CaptureUpdate = 3; 捕获更新（发生异常错误的时候发生）
  // 指定更新的类型，值为以上几种
    tag: UpdateState,
    // 更新内容，比如\`setState\`接收的第一个参数
    payload: null,
    // 更新完成后的回调，\`setState\`，\`render\`都有
    callback: null,

    // 指向下一个update
    // 单链表update queue通过 next串联
    next: null,

    // 下一个side effect
    // 最新源码被抛弃 next替换
    //nextEffect: null,
  };
  if (__DEV__) {
    update.priority = getCurrentPriorityLevel();
  }
  return update;
}
```

#### UpdateQueue

```javascript
//创建更新队列
export function createUpdateQueue<State>(baseState: State): UpdateQueue<State> {
  const queue: UpdateQueue<State> = {
    //应用更新后的state
    baseState,
    //队列中的第一个update
    firstUpdate: null,
    //队列中的最后一个update
    lastUpdate: null,
     //队列中第一个捕获类型的update
    firstCapturedUpdate: null,
    //队列中最后一个捕获类型的update
    lastCapturedUpdate: null,
    //第一个side effect
    firstEffect: null,
    //最后一个side effect
    lastEffect: null,
    firstCapturedEffect: null,
    lastCapturedEffect: null,
  };
  return queue;
}
```

update中的payload：通常我们现在在调用setState传入的是一个对象，但在使用fiber conciler时，必须传入一个函数，函数的返回值是要更新的state。react从很早的版本就开始支持这种写法了，不过通常没有人用。在之后的react版本中，可能会废弃直接传入对象的写法。

setState({}, callback); // stack conciler
setState(() => { return {} }, callback); // fiber conciler

[ReactUpdateQueue源码](https://github.com/facebook/react/blob/0f3838a01b0fda0ac5fd054c6be13166697a113c/packages/react-reconciler/src/ReactUpdateQueue.js)

#### Updater

每个组件都会有一个Updater对象，它的用处就是把组件元素更新和对应的fiber关联起来。监听组件元素的更新，并把对应的更新放入该元素对应的fiber的UpdateQueue里面，并且调用ScheduleWork方法，把最新的fiber让scheduler去调度工作。

```javascript
const classComponentUpdater = {
  isMounted,
  enqueueSetState(inst, payload, callback) {
    const fiber = getInstance(inst);
    const currentTime = requestCurrentTimeForUpdate();
    const suspenseConfig = requestCurrentSuspenseConfig();
    const expirationTime = computeExpirationForFiber(
      currentTime,
      fiber,
      suspenseConfig,
    );

    const update = createUpdate(expirationTime, suspenseConfig);
    update.payload = payload;
    if (callback !== undefined && callback !== null) {
      if (__DEV__) {
        warnOnInvalidCallback(callback, 'setState');
      }
      update.callback = callback;
    }

    enqueueUpdate(fiber, update);
    scheduleWork(fiber, expirationTime);
  },
  enqueueReplaceState(inst, payload, callback) {
    //一样的代码
    //...
    update.tag = ReplaceState;
    //...
  },
  enqueueForceUpdate(inst, callback) {
    //一样的代码
    //...
    update.tag = ForceUpdate;
    //...
  },
};
```

[ReactUpdateQueue=>classComponentUpdater](https://github.com/facebook/react/blob/9ac42dd074c42b66ecc0334b75200b1d2989f892/packages/react-reconciler/src/ReactFiberClassComponent.js#L182)

### Effect list

**Side Effects**:我们可以将React中的一个组件视为一个使用state和props来计算UI的函数。每个其他活动，如改变DOM或调用生命周期方法，都应该被认为是side-effects，react文档中是这样描述的side-effects的：

> You’ve likely performed data fetching, subscriptions, or manually changing the DOM 的from React components before. We call these operations “side effects” (or “effects” for short) because they can affect other components and can’t be done during rendering.

React能够非常快速地更新，并且为了实现高性能，它采用了一些有趣的技术。其中之一是构建带有side-effects的fiber节点的线性列表，其具有快速迭代的效果。迭代线性列表比树快得多，并且没有必要在没有side effects的节点上花费时间。

每个fiber节点都可以具有与之相关的effects, 通过fiber节点中的effectTag字段表示。

![](redirect_30.png)
![](redirect_31.png)

此列表的目标是标记具有DOM更新或与其关联的其他effects的节点，此列表是WIP tree的子集，并使用nextEffect属性，而不是current和workInProgress树中使用的child属性进行链接。

## How it work

#### 核心目标

- 把可中断的工作拆分成多个小任务
- 为不同类型的更新分配任务优先级
- 更新时能够暂停，终止，复用渲染任务

### 更新过程概述

我们先看看其Fiber的更新过程，然后再针对过程中的核心技术进行展开。

Reconciliation分为两个阶段：reconciliation 和 commit

#### reconciliation

![](redirect_32.png)
从图中可以看到，可以把reconciler阶段分为三部分，分别以红线划分。简单的概括下三部分的工作：

1. 第一部分从 ReactDOM.render() 方法开始，把接收的React Element转换为Fiber节点，并为其设置优先级，记录update等。这部分主要是一些数据方面的准备工作。
2. 第二部分主要是三个函数：scheduleWork、requestWork、performWork，即安排工作、申请工作、正式工作三部曲。React 16 新增的异步调用的功能则在这部分实现。
3. 第三部分是一个大循环，遍历所有的Fiber节点，通过Diff算法计算所有更新工作，产出 EffectList 给到commit阶段使用。这部分的核心是 beginWork 函数。

#### commit阶段

![](redirect_33.png)

这个阶段主要做的工作拿到reconciliation阶段产出的所有更新工作，提交这些工作并调用渲染模块（react-dom）渲染UI。完成UI渲染之后，会调用剩余的生命周期函数，所以异常处理也会在这部分进行

### 分配优先级

其上所列出的fiber结构中有个expirationTime。

> expirationTime本质上是fiber work执行的优先级。

```javascript
// 源码中的priorityLevel优先级划分
export const NoWork = 0;
// 仅仅比Never高一点 为了保证连续必须完整完成
export const Never = 1;
export const Idle = 2;
export const Sync = MAX_SIGNED_31_BIT_INT;//整型最大数值，是V8中针对32位系统所设置的最大值
export const Batched = Sync - 1;
```

源码中的 [computeExpirationForFiber函数](https://github.com/facebook/react/blob/16.8.4/packages/react-reconciler/src/ReactFiberScheduler.js#L1595) ，该方法用于计算fiber更新任务的最晚执行时间，进行比较后，决定是否继续做下一个任务。

```javascript
//为fiber对象计算expirationTime
function computeExpirationForFiber(currentTime: ExpirationTime, fiber: Fiber) {
  ...
  // 根据调度优先级计算ExpirationTime
    const priorityLevel = getCurrentPriorityLevel();
    switch (priorityLevel) {
      case ImmediatePriority:
        expirationTime = Sync;
        break;
        //高优先级 如由用户输入设计交互的任务
      case UserBlockingPriority:
        expirationTime = computeInteractiveExpiration(currentTime);
        break;
        // 正常的异步任务
      case NormalPriority:
        // This is a normal, concurrent update
        expirationTime = computeAsyncExpiration(currentTime);
        break;
      case LowPriority:
      case IdlePriority:
        expirationTime = Never;
        break;
      default:
        invariant(
          false,
          'Unknown priority level. This error is likely caused by a bug in ' +
            'React. Please file an issue.',
        );
    }
    ...
}

export const LOW_PRIORITY_EXPIRATION = 5000
export const LOW_PRIORITY_BATCH_SIZE = 250

export function computeAsyncExpiration(
  currentTime: ExpirationTime,
): ExpirationTime {
  return computeExpirationBucket(
    currentTime,
    LOW_PRIORITY_EXPIRATION,
    LOW_PRIORITY_BATCH_SIZE,
  )
}

export const HIGH_PRIORITY_EXPIRATION = __DEV__ ? 500 : 150
export const HIGH_PRIORITY_BATCH_SIZE = 100

export function computeInteractiveExpiration(currentTime: ExpirationTime) {
    return computeExpirationBucket(
    currentTime,
    HIGH_PRIORITY_EXPIRATION,
    HIGH_PRIORITY_BATCH_SIZE,
  )
}
function computeExpirationBucket(
```
```java
  currentTime,
  expirationInMs,
  bucketSizeMs,
): ExpirationTime {
  return (
```
    MAGIC_NUMBER_OFFSET -
```java
    ceiling(
    // 之前的算法
     //currentTime - MAGIC_NUMBER_OFFSET + expirationInMs / UNIT_SIZE,
```
      MAGIC_NUMBER_OFFSET - currentTime + expirationInMs / UNIT_SIZE,
      bucketSizeMs / UNIT_SIZE,
    )
```java
  );
}

// 我们把公式整理一下：
// low
```
 1073741821-ceiling(1073741821-currentTime+500,25) =>
 1073741796-((1073742321-currentTime)/25 | 0)*25
// high
1073741821-ceiling(1073741821-currentTime+15,10)

简单来说，最终结果是以25为单位向上增加的，比如说我们输入102 - 126之间，最终得到的结果都是625，但是到了127得到的结果就是650了，这就是除以25取整的效果。

即计算出的React低优先级update的expirationTime间隔是25ms， React让两个相近（25ms内）的update得到相同的expirationTime，目的就是让这两个update自动合并成一个Update，从而达到批量更新的目的。就像提到的doubleBuffer一样，React为提高性能，考虑得非常全面！

expiration算法源码

- [ReactFiberExpirationTime](https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberExpirationTime.js)
- [SchedulerWithReactIntegration](https://github.com/facebook/react/blob/969f4b5bb8302afb3eb1656784130651047c3718/packages/react-reconciler/src/SchedulerWithReactIntegration.js)

推荐阅读： [jokcy大神解析=》expirationTime计算](https://react.jokcy.me/book/update/expiration-time.html)

### 执行优先级

那么Fiber是如何做到异步实现不同优先级任务的协调执行的

这里要介绍介绍浏览器提供的两个API：requestIdleCallback和requestAnimationFrame:

> requestIdleCallback：
> 在浏览器空闲时段内调用的函数排队。是开发人员可以在主事件循环上执行后台和低优先级工作而不会影响延迟关键事件，如动画和输入响应。

![](redirect_34.png)

其在回调参数中IdleDeadline可以获取到当前帧剩余的时间。利用这个信息可以合理的安排当前帧需要做的事情，如果时间足够，那继续做下一个任务，如果时间不够就歇一歇。

> requestAnimationFrame：告诉浏览器你希望执行一个动画，并且要求浏览器在下次重绘之前调用指定的回调函数更新动画

![](redirect_35.png)

> 合作式调度:这是一种’契约‘调度，要求我们的程序和浏览器紧密结合，互相信任。比如可以由浏览器给我们分配执行时间片，我们要按照约定在这个时间内执行完毕，并将控制权还给浏览器。

![](redirect_36.png)
![](redirect_37.png)

Fiber所做的就是需要分解渲染任务，然后根据优先级使用API调度，异步执行指定任务：

- 低优先级任务由requestIdleCallback处理，限制任务执行时间，以切分任务，同时避免任务长时间执行，阻塞UI渲染而导致掉帧。
- 高优先级任务，如动画相关的由requestAnimationFrame处理；

并不是所有的浏览器都支持requestIdleCallback，但是React内部实现了自己的polyfill，所以不必担心浏览器兼容性问题。polyfill实现主要是通过rAF+postmessage实现的(最新版本去掉了rAF，有兴趣的童鞋可以看看=》 [SchedulerHostConfig](https://github.com/facebook/react/blob/a2e05b6c148b25590884e8911d4d4acfcb76a487/packages/scheduler/src/forks/SchedulerHostConfig.default.js)

## 生命周期

因为其在协调阶段任务可被打断的特点，任务在切片后运行完一段便将控制权交还到react负责任务调度的模块，再根据任务的优先级，继续运行后面的任务。所以会导致某些组件渲染到一半便会打断以运行其他紧急，优先级更高的任务，运行完却不会继续之前中断的部分，而是重新开始，所以在协调的所有生命周期都会面临这种被多次调用的情况。
为了限制这种被多次重复调用，耗费性能的情况出现，react官方一步步把处在协调阶段的部分生命周期进行移除。

![](redirect_38.png)

废弃：

- componentWillMount
- componentWillUpdate
- componentWillReceiveProps

新增：

- [static getDerivedStateFromProps(props, state)](https://zh-hans.reactjs.org/docs/react-component.html#static-getderivedstatefromprops)
- [getSnapshotBeforeUpdate(prevProps, prevState)](https://zh-hans.reactjs.org/docs/react-component.html#getsnapshotbeforeupdate)
- [componentDidcatch](https://zh-hans.reactjs.org/docs/react-component.html#componentdidcatch)
- [staic getderivedstatefromerror](https://zh-hans.reactjs.org/docs/react-component.html#static-getderivedstatefromerror)

![newLifeCircle](redirect_39.png)

newLifeCircle

#### 为什么新的生命周期用static

static 是ES6的写法，当我们定义一个函数为static时，就意味着无法通过this调用我们在类中定义的方法

通过static的写法和函数参数，可以感觉React在和我说：请只根据newProps来设定derived state，不要通过this这些东西来调用帮助方法，可能会越帮越乱。用专业术语说：getDerivedStateFromProps应该是个纯函数，没有副作用(side effect)。

#### getDerivedStateFromError和componentDidCatch之间的区别是什么？

简而言之，因为所处 **阶段的不同** 而功能不同。

getDerivedStateFromError是在reconciliation阶段触发，所以getDerivedStateFromError进行捕获错误后进行组件的状态变更，不允许出现副作用。

```java
static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染可以显降级 UI
    return { hasError: true };
}
```

componentDidCatch因为在commit阶段，因此允许执行副作用。 它应该用于记录错误之类的情况：

```java
componentDidCatch(error, info) {
    // "组件堆栈" 例子:
    //   in ComponentThatThrows (created by App)
    //   in ErrorBoundary (created by App)
    //   in div (created by App)
    //   in App
    logComponentStackToMyService(info.componentStack);
  }
```

生命周期相关资料点这里=》 [生命周期](https://blog.csdn.net/Napoleonxxx/article/details/81120854)

## Suspense

Suspense的实现很诡异，也备受争议。
用Dan的原话讲：你将会恨死它，然后你会爱上他。

**Suspense** 功能想解决从react出生到现在都存在的「异步副作用」的问题，而且解决得非常的优雅，使用的是「异步但是同步的写法」.

Suspense暂时只是用于搭配lazy进行代码分割，在组件等待某事时“暂停”渲染的能力，并显示加载的loading，但他的作用远远不止如此，当下在concurrent mode实验阶段文档下提供了一种suspense处理异步请求获取数据的方法。

### 用法

```javascript
// 懒加载组件切换时显示过渡组件
const ProfilePage = React.lazy(() => import('./ProfilePage')); // Lazy-loaded

// Show a spinner while the profile is loading
<Suspense fallback={<Spinner />}>
<ProfilePage />
</Suspense>

// 异步获取数据
import { unstable_createResource } from 'react-cache'

const resource = unstable_createResource((id) => {
    return fetch(\`/demo/${id}\`)
})
function ProfilePage() {
  return (
    <Suspense fallback={<h1>Loading profile...</h1>}>
      <ProfileDetails />
      <Suspense fallback={<h1>Loading posts...</h1>}>
        <ProfileTimeline />
      </Suspense>
    </Suspense>
  );
}

function ProfileDetails() {
  // Try to read user info, although it might not have loaded yet
  const user = resource.user.read();
  return <h1>{user.name}</h1>;
}

function ProfileTimeline() {
  // Try to read posts, although they might not have loaded yet
  const posts = resource.posts.read();
  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.text}</li>
      ))}
```
```java
    </ul>
  );
}
```

- 在render函数中，我们可以写入一个异步请求，请求数据
- react会从我们缓存中读取这个缓存
- 如果有缓存了，直接进行正常的render
- 如果没有缓存，那么会抛出一个异常，这个异常是一个promise
- 当这个promise完成后（请求数据完成），react会继续回到原来的render中（实际上是重新执行一遍render），把数据render出来
- 完全同步写法，没有任何异步callback之类的东西

如果你还没有明白这是什么意思那我简单的表述成下面这句话：

> 调用render函数->发现有异步请求->悬停，等待异步请求结果->再渲染展示数据

看着是非常神奇的，用同步方法写异步，而且没有yield/async/await，简直能把人看傻眼了。这么做的好处自然就是，我们的思维逻辑非常的简单，清楚，没有callback，没有其他任何玩意，不能不说，看似优雅了非常多而且牛逼。

官方文档指出它还将提供官方的方法进行数据获取

### 原理

看一下react提供的unstable_createResource源码

```javascript
export function unstable_createResource(fetch, maybeHashInput) {
  const resource = {
    read(input) {
      ...
      const result = accessResult(resource, fetch, input, key);
      switch (result.status) {
        // 还未完成直接抛出自身promise
        case Pending: {
          const suspender = result.value;
          throw suspender;
        }
        case Resolved: {
          const value = result.value;
          return value;
        }
        case Rejected: {
          const error = result.value;
          throw error;
        }
        default:
          // Should be unreachable
          return (undefined: any);
      }
    },
  };
  return resource;
}
```
        default:
```javascript
          // Should be unreachable
          return (undefined: any);
      }
    },
  };
  return resource;
}
```

![](redirect_40.png)

为此，React使用Promises。
组件可以在其render方法（或在组件的渲染过程中调用的任何东西，例如新的静态getDerivedStateFromProps）中抛出Promise。
React捕获了抛出的Promise，并在树上寻找最接近的Suspense组件，Suspense其本身具有componentDidCatch，将promise当成error捕获，等待其执行完成其更改状态重新渲染子组件。

Suspense组件将一个元素（fallback 作为其后备道具，无论子节点在何处或为什么挂起，都会在其子树被挂起时进行渲染。

#### 如何达成异常捕获

1. reconciliation阶段的 renderRoot 函数，对应异常处理方法是 throwException
2. commit阶段的 commitRoot 函数，对应异常处理方法是 dispatch

#### reconciliation阶段的异常捕获

react-reconciler中的 [performConcurrentWorkOnRoot](https://github.com/facebook/react/blob/e039e690b5c45c458dd4026f3db16bac18ed0e47/packages/react-reconciler/src/ReactFiberWorkLoop.js#L642)

```javascript
// This is the entry point for every concurrent task, i.e. anything that
// goes through Scheduler.
// 这里是每一个通过Scheduler的concurrent任务的入口
function performConcurrentWorkOnRoot(root, didTimeout) {
    ...
    do {
        try {
            //开始执行Concurrent任务直到Scheduler要求我们让步
            workLoopConcurrent();
            break;
        } catch (thrownValue) {
            handleError(root, thrownValue);
        }
    } while (true);
    ...
}

function handleError(root, thrownValue) {
    ...
      throwException(
        root,
        workInProgress.return,
```
```java
        workInProgress,
        thrownValue,
        renderExpirationTime,
      );
      workInProgress = completeUnitOfWork(workInProgress);
   ...
}
```

[throwException](https://github.com/facebook/react/blob/f523b2e0d369e3f42938b56784f9ce1990838753/packages/react-reconciler/src/ReactFiberThrow.js#L178)

```javascript
function performConcurrentWorkOnRoot(root, didTimeout) {
    ...
    do {
        try {
            //开始执行Concurrent任务直到Scheduler要求我们让步
            workLoopConcurrent();
            break;
        } catch (thrownValue) {
            handleError(root, thrownValue);
        }
    } while (true);
    ...
}
```
          (workInProgress.effectTag & DidCapture) === NoEffect &&
          (typeof ctor.getDerivedStateFromError === 'function' ||
            (instance !== null &&
              typeof instance.componentDidCatch === 'function' &&
```java
              !isAlreadyFailedLegacyErrorBoundary(instance)))
        ) {
          workInProgress.effectTag |= ShouldCapture;
          workInProgress.expirationTime = renderExpirationTime;
          // Schedule the error boundary to re-render using updated state
          const update = createClassErrorUpdate(
            workInProgress,
            errorInfo,
            renderExpirationTime,
          );
          enqueueCapturedUpdate(workInProgress, update);
          return;
        }
    }
    ...
}
```

throwException函数分为两部分
1、遍历当前异常节点的所有父节点，找到对应的错误信息（错误名称、调用栈等），这部分代码在上面中没有展示出来

2、第二部分是遍历当前异常节点的所有父节点，判断各节点的类型，主要还是上面提到的两种类型，这里重点讲ClassComponent类型，判断该节点是否是异常边界组件（通过判断是否存在componentDidCatch生命周期函数等），如果是找到异常边界组件，则调用 createClassErrorUpdate函数新建update，并将此update放入此节点的异常更新队列中，在后续更新中，会更新此队列中的更新工作

#### commit阶段

ReactFiberWorkLoop中的 [finishConcurrentRender](https://github.com/facebook/react/blob/e039e690b5c45c458dd4026f3db16bac18ed0e47/packages/react-reconciler/src/ReactFiberWorkLoop.js#L1709) =》
[commitRoot](https://github.com/facebook/react/blob/e039e690b5c45c458dd4026f3db16bac18ed0e47/packages/react-reconciler/src/ReactFiberWorkLoop.js#L1709) =》
[commitRootImpl](https://github.com/facebook/react/blob/e039e690b5c45c458dd4026f3db16bac18ed0e47/packages/react-reconciler/src/ReactFiberWorkLoop.js#L1718) =》 [captureCommitPhaseError](https://github.com/facebook/react/blob/e039e690b5c45c458dd4026f3db16bac18ed0e47/packages/react-reconciler/src/ReactFiberWorkLoop.js#L2280)

commit被分为几个子阶段，每个阶段都try catch调用了一次captureCommitPhaseError

1. 突变(mutate)前阶段：我们在突变前先读出主树的状态，getSnapshotBeforeUpdate在这里被调用
2. 突变阶段：我们在这个阶段更改主树，完成WIP树转变为current树
3. 样式阶段：调用从被更改后主树读取的effect

```javascript
export function captureCommitPhaseError(sourceFiber: Fiber, error: mixed) {
  if (sourceFiber.tag === HostRoot) {
    // Error was thrown at the root. There is no parent, so the root
    // itself should capture it.
    captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
    return;
  }

  let fiber = sourceFiber.return;
  while (fiber !== null) {
    if (fiber.tag === HostRoot) {
      captureCommitPhaseErrorOnRoot(fiber, sourceFiber, error);
      return;
    } else if (fiber.tag === ClassComponent) {
      const ctor = fiber.type;
      const instance = fiber.stateNode;
      if (
        typeof ctor.getDerivedStateFromError === 'function' ||
        (typeof instance.componentDidCatch === 'function' &&
          !isAlreadyFailedLegacyErrorBoundary(instance))
      ) {
        const errorInfo = createCapturedValue(error, sourceFiber);
        const update = createClassErrorUpdate(
          fiber,
          errorInfo,
          // TODO: This is always sync
          Sync,
        );
        enqueueUpdate(fiber, update);
        const root = markUpdateTimeFromFiberToRoot(fiber, Sync);
        if (root !== null) {
          ensureRootIsScheduled(root);
          schedulePendingInteractions(root, Sync);
        }
        return;
      }
    }
    fiber = fiber.return;
  }
}
```
        typeof ctor.getDerivedStateFromError === 'function' ||
        (typeof instance.componentDidCatch === 'function' &&
```javascript
          !isAlreadyFailedLegacyErrorBoundary(instance))
      ) {
        const errorInfo = createCapturedValue(error, sourceFiber);
        const update = createClassErrorUpdate(
          fiber,
          errorInfo,
          // TODO: This is always sync
          Sync,
        );
        enqueueUpdate(fiber, update);
        const root = markUpdateTimeFromFiberToRoot(fiber, Sync);
        if (root !== null) {
          ensureRootIsScheduled(root);
          schedulePendingInteractions(root, Sync);
        }
        return;
      }
    }
    fiber = fiber.return;
  }
}
```

captureCommitPhaseError函数做的事情和上部分的 throwException 类似，遍历当前异常节点的所有父节点，找到异常边界组件（有componentDidCatch生命周期函数的组件），新建update，在update.callback中调用组件的componentDidCatch生命周期函数。

细心的小伙伴应该注意到，throwException 和 captureCommitPhaseError在遍历节点时，是从异常节点的父节点开始遍历，所以异常捕获一般由拥有componentDidCatch或getDerivedStateFromError的异常边界组件进行包裹，而其是无法捕获并处理自身的报错。

## Hook相关

### Function Component和Class Component

Class component 劣势

1. 状态逻辑难复用：在组件之间复用状态逻辑很难，可能要用到 render props （渲染属性）或者 HOC（高阶组件），但无论是渲染属性，还是高阶组件，都会在原先的组件外包裹一层父容器（一般都是 div 元素），导致层级冗余 趋向复杂难以维护：
2. 在生命周期函数中混杂不相干的逻辑（如：在 componentDidMount 中注册事件以及其他的逻辑，在 componentWillUnmount 中卸载事件，这样分散不集中的写法，很容易写出 bug ） 类组件中到处都是对状态的访问和处理，导致组件难以拆分成更小的组件
3. this 指向问题：父组件给子组件传递函数时，必须绑定 this

但是在16.8之前react的函数式组件十分羸弱，基本只能作用于纯展示组件，主要因为缺少state和生命周期。

hooks优势

- 能优化类组件的三大问题
- 能在无需修改组件结构的情况下复用状态逻辑（自定义 Hooks ）
- 能将组件中相互关联的部分拆分成更小的函数（比如设置订阅或请求数据）
- 副作用的关注点分离：副作用指那些没有发生在数据向视图转换过程中的逻辑，如 ajax 请求、访问原生dom 元素、本地持久化缓存、绑定/解绑事件、添加订阅、设置定时器、记录日志等。以往这些副作用都是写在类组件生命周期函数中的。而 useEffect 在全部渲染完毕后才会执行，useLayoutEffect 会在浏览器 layout 之后，painting 之前执行。

### capture props和capture value特性

#### capture props

```javascript
class ProfilePage extends React.Component {
  showMessage = () => {
    alert("Followed " + this.props.user);
  };

  handleClick = () => {
    setTimeout(this.showMessage, 3000);
  };

  render() {
    return <button onClick={this.handleClick}>Follow</button>;
  }
}

function ProfilePage(props) {
  const showMessage = () => {
    alert("Followed " + props.user);
  };

  const handleClick = () => {
    setTimeout(showMessage, 3000);
  };

  return <button onClick={handleClick}>Follow</button>;
}
```

这两个组件都描述了同一个逻辑：点击按钮 3 秒后 alert 父级传入的用户名。

那么 React 文档中描述的 props 不是不可变（Immutable） 数据吗？为啥在运行时还会发生变化呢？

原因在于，虽然 props 不可变，是 this 在 Class Component 中是可变的，因此 this.props 的调用会导致每次都访问最新的 props。

无可厚非，为了在生命周期和render重能拿到最新的版本react本身会实时更改this，这是this在class组件的本职。

这揭露了关于用户界面的有趣观察，如果我们说ui从概念上是一个当前应用状态的函数，事件处理就是render结果的一部分，我们的事件处理属于拥有特定props或state的render。每次 Render 的内容都会形成一个快照并保留下来，因此当状态变更而 Rerender 时，就形成了 N 个 Render 状态，而每个 Render 状态都拥有自己固定不变的 Props 与 State。

然而在setTimeout的回调中获取this.props会打断这种的关联，失去了与某一特定render绑定，所以也失去了正确的props。

而 Function Component 不存在 this.props 的语法，因此 props 总是不可变的。

[测试地址](https://codesandbox.io/s/pjqnl16lm7)

#### hook中的capture value

```javascript
function MessageThread() {
  const [message, setMessage] = useState("");

  const showMessage = () => {
    alert("You said: " + message);
  };

  const handleSendClick = () => {
    setTimeout(showMessage, 3000);
  };

  const handleMessageChange = e => {
    setMessage(e.target.value);
  };

  return (
```
    <>
      <input value={message} onChange={handleMessageChange} />
      <button onClick={handleSendClick}>Send</button>
    </>
  );
}

hook重同样有capture value，每次渲染都有自己的 Props and State，如果要时刻获取最新的值，规避 capture value 特性，可以用useRef

```javascript
const lastest = useRef("");

const showMessage = () => {
    alert("You said: " + lastest.current);
};

const handleSendClick = () => {
    setTimeout(showMessage, 3000);
};

const handleMessageChange = e => {
    lastest.current = e.target.value;
};
```

[测试地址](https://codesandbox.io/s/93m5mz9w24)

### Hooks实现原理

在上面fiber结构分析可以看出现在的Class component的state和props是记录在fiber上的,在fiber更新后才会更新到component的this.state和props里面，而并不是class component自己调理的过程。这也给了实现hooks的方便，因为hooks是放在function component里面的，他没有自己的this，但我们本身记录state和props就不是放在class component this上面，而是在fiber上面，所以我们有能力记录状态之后，也有能力让function component更新过程当中拿到更新之后的state。

### React 依赖于 Hook 的调用顺序

日常调用三次

```javascript
function Form() {
  const [hero, setHero] = useState('iron man');
  if(hero){
    const [surHero, setSurHero] = useState('Captain America');
  }
  const [nbHero, setNbHero] = useState('hulk');
  // ...
}
```

来看看我们的useState是怎么实现的

```javascript
// useState 源码中的链表实现
import React from 'react';
import ReactDOM from 'react-dom';

let firstWorkInProgressHook = {memoizedState: null, next: null};
let workInProgressHook;

function useState(initState) {
    let currentHook = workInProgressHook.next ? workInProgressHook.next : {memoizedState: initState, next: null};

    function setState(newState) {
        currentHook.memoizedState = newState;
        render();
    }

    // 假如某个 useState 没有执行，会导致Next指针移动出错，数据存取出错
    if (workInProgressHook.next) {
        // 这里只有组件刷新的时候，才会进入
        // 根据书写顺序来取对应的值
        // console.log(workInProgressHook);
        workInProgressHook = workInProgressHook.next;
    } else {
        // 只有在组件初始化加载时，才会进入
        // 根据书写顺序，存储对应的数据
        // 将 firstWorkInProgressHook 变成一个链表结构
        workInProgressHook.next = currentHook;
        // 将 workInProgressHook 指向 {memoizedState: initState, next: null}
        workInProgressHook = currentHook;
        // console.log(firstWorkInProgressHook);
    }
    return [currentHook.memoizedState, setState];
}

function Counter() {
    // 每次组件重新渲染的时候，这里的 useState 都会重新执行
    const [name, setName] = useState('计数器');
    const [number, setNumber] = useState(0);
    return (
```
        <>
```java
            <p>{name}:{number}</p>
            <button onClick={() => setName('新计数器' + Date.now())}>新计数器</button>
            <button onClick={() => setNumber(number + 1)}>+</button>
```
        </>
    )
```javascript
}

function render() {
    // 每次重新渲染的时候，都将 workInProgressHook 指向 firstWorkInProgressHook
    workInProgressHook = firstWorkInProgressHook;
    ReactDOM.render(<Counter/>, document.getElementById('root'));
}

render();
```

我们来还原一下这个过程
大家看完应该了解，当下设置currentHook其实是上个workInProgressHook通过next指针进行绑定获取的，所以如果在条件语句中打破了调用顺序，将会导致next指针指向出现偏差，这个时候你传进去的setState是无法正确改变对应的值，因为

各种自定义封装的hooks =》 [react-use](https://github.com/streamich/react-use)

[为什么顺序调用对 React Hooks 很重要？](https://overreacted.io/zh-hans/why-do-hooks-rely-on-call-order/)

## react 18更新

### 1\. 正式引入了对并发模式/特性的「渐进升级」策略

### 2\. 自动批处理

不同于以往，promise、setTimeout、本机事件处理程序或任何其他事件中的更新都会batchUpdate，可使用 flushSync退出批处理。

> ps: 让我们把沉重的心智负担交还给框架

### 3\. 新的api

1. startTransition
2. useTransition
3. useDeferredValue()
4. useId()
5. useSYncExternalStore()

#### startTransitionAPI

##### 作用

帮助划分任务优先级

##### 栗子

```javascript
import  {  startTransition  }  from  'react' ;

// 紧急：显示输入的内容
setInputValue ( input ) ;

// 将内部的任何状态更新标记为转换
startTransition ( ( )  =>  {
    // Transition: 显示结果
    setSearchQuery ( input ) ;
} ) ;
```

个人感觉跟react native的 InteractionManager 非常类似。

##### 场景：

1. 需要发起请求从后台获取数据
2. 更新需要时间，React 需要执行大量工作才能转换 UI 以显示结果

### 4\. Suspense SSR

你可能知道也不知道的是，完全用 React 重写的新 Facebook.com 是用 Hermes 做 SSR 来优化首屏渲染得，所以 SSR 的优化就成为了 React 团队的优先级之一啦……但是传统 SSR 的一个问题是，全量渲染话延迟太高了。而 CM + Suspence 就可以做到用 Suspence boundary 将应用分片，然后以此为单位做流式 SSR，是不是有重新发明 BigPipe 的感觉了？

## 参考：

[如何以及为什么React Fiber使用链表遍历组件树](https://github.com/dawn-plex/translate/blob/master/articles/the-how-and-why-on-reacts-usage-of-linked-list-in-fiber-to-walk-the-components-tree.md)
[React Fiber架构](https://zhuanlan.zhihu.com/p/37095662)
[React 源码解析 - reactScheduler 异步任务调度](https://www.jianshu.com/p/4a3a09925a28)
[展望 React 17，回顾 React 往事 全面 深入](https://zhuanlan.zhihu.com/p/40160380)
[这可能是最通俗的 React Fiber(时间分片) 打开方式](https://juejin.im/post/6844903975112671239) =>调度策略
[全面了解 React 新功能: Suspense 和 Hooks 生命周期](https://segmentfault.com/a/1190000017483690?utm_source=tag-newest)
[详谈 React Fiber 架构(1)](https://github.com/crazylxr/deep-in-react/blob/master/analysis/%E8%AF%A6%E8%B0%88%20React%20Fiber%20%E6%9E%B6%E6%9E%84\(1\).md)

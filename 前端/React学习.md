---
title: React 学习笔记（后端视角）
created: 2026-09-14
tags:
  - React
  - 前端
  - Fiber
  - 学习笔记
---

# React 学习笔记（后端视角）

> [!abstract] 导读
> 这份笔记以一个真实小项目「素材配置后台」（React 18 + TypeScript + Tailwind + react-router-dom v6，一个电商活动页素材配置工具）为贯穿案例，以**后端工程师已有的心智模型**（Spring、JVM、线程、事务、RPC）为参照系，系统性梳理 React 的核心知识：
>
> 全文分**四部分**：① **心智模型与基本概念**（第 1–3 章）→ ② **运行时机制**（第 4–8 章）→ ③ **工程实践**（第 9–11 章）→ ④ **速查与附录**（第 12 章）。
>
> 三种读法：**快速上手** 读第一部分 + 第九、十章；**搞懂机制** 沿第二部分顺序读（事件与线程 → render/commit → Fiber → Hook → 生命周期）；**当手册查** 直接跳第四部分。

## 目录

**第一部分｜心智模型与基本概念（第 1–3 章）**

- [[#一、框架定位：React 是什么]] —— UI = f(state) · Spring 类比 · 部署模型 · JS 与浏览器的两个世界
- [[#二、组件与 JSX]] —— 组件 = 返回 JSX 的函数 · JSX 的编译本质 · 组件树、实例与 key
- [[#三、Props 与 State]] —— props 下行与回调上行 · 单向数据流 · state 快照 · 不可变更新 · 派生值

**第二部分｜运行时机制（第 4–8 章）**

- [[#四、事件机制与线程模型]] —— 合成事件与委托 · 点击到上屏的链路 · 单线程事件循环 · 主线程互斥与帧预算
- [[#五、渲染机制：从函数重跑到 DOM 更新]] —— 工作循环 · render/commit 两阶段 · 与浏览器阶段的对应（帧与渲染机会）· 为什么 render 必须纯
- [[#六、Fiber：可中断的渲染架构]] —— 三层定义与字段解剖 · 三指针与"栈→堆"账本 · 双缓冲 · 更新对象与队列 · Effect list · 调度（Scheduler vs rIC）· lanes · 时序全景 · 错误边界
- [[#七、Hook 机制]] —— fiber 上的格子链 · 顺序即地址 · setState 真实行为 · hook 家族 · 类 vs 函数组件 · capture value
- [[#八、生命周期与 useEffect]] —— 生命周期映射与演进史 · 依赖数组四形态 · useEffect 四拍 · useLayoutEffect · 副作用判定 · 事务类比

**第三部分｜工程实践（第 9–11 章）**

- [[#九、组件通信]] —— 五种机制总览 · 状态提升 · props 通道再深入 · Context 原理与实现（压栈取值 / 订阅广播 / 稳定性三招）· 失效模式与选型判据 · Preview bug 实战 · Redux 与全局 store
- [[#十、路由：react-router-dom v6]] —— 路由结构 · URL 即 state · 切换全链路 · 状态存亡
- [[#十一、扩展：Suspense 与懒加载]] —— React.lazy 用法 · 抛出的 Promise · Suspense 的更多用法

**第四部分｜速查与附录（第 12 章）**

- [[#十二、Java ⇄ React 对照总表（速查）]] · [[#概念速查卡]] · [[#参考资料]] · [[#相关笔记]]

---

# 第一部分｜心智模型与基本概念

> 第 1–3 章：React 是什么、和 Spring 的类比 → 组件与 JSX 的编译本质 → props 单向流动、state 快照与不可变更新。

## 一、框架定位：React 是什么

### 1.1 一句话定义

React 是一个**视图层库**，核心心智模型只有一条公式：

> [!tip] UI = f(state)
> 界面是状态的函数。state 一变，React 重新执行函数（组件），算出新的界面描述，再以最小代价更新真实 DOM。**你不再手写"怎么改 DOM"，只声明"界面长什么样"。**

对比命令式写法（原生 JS）：

```js
// 命令式：手动找 DOM、手动算新值、手动改
btn.addEventListener('click', () => {
  count++;
  label.textContent = '点击了 ' + count + ' 次';
});
```

```tsx
// 声明式：只描述"界面是 count 的函数"
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>点击了 {count} 次</button>;
}
```

### 1.2 和 Spring 的类比：React ≈ 浏览器侧的 Spring

对后端来说最快的理解路径：

| Spring 世界 | React 世界 | 说明 |
| --- | --- | --- |
| Spring 框架 / 容器 | React 运行时 | 提供组件模型 + 生命周期管理 |
| Bean 定义 | 组件函数（返回 JSX 的函数） | 声明"是什么" |
| Bean 实例 | 组件实例（fiber + hook 链表） | 运行时对象，承载本次渲染的状态 |
| 构造器参数注入 | props | 外部传入，只读 |
| Bean 的字段 | state | 实例私有、会变化的数据 |
| @PostConstruct | `useEffect(fn, [])` | 挂载后执行一次 |
| @PreDestroy | useEffect 返回的 cleanup | 卸载时执行 |
| ApplicationContext.getBean | `useContext` | 从上下文按"就近原则"取依赖 |
| DispatcherServlet | 根容器上的合成事件系统 | 统一入口、统一分发 |

### 1.3 关键差异：部署模型（理解一切"状态丢失"现象的钥匙）

- **Spring 应用**：打包成 jar 部署到服务器，**所有用户共享同一份实例和内存状态**；
- **React 应用**：打包成 bundle.js 部署到 CDN，**每个用户的浏览器各下载一份、各跑一份**。页面刷新 = 进程重启（等价于把 jar 重新部署），所有内存状态归零。

由此可以解释几乎所有"前端状态消失"的现象：

- 刷新页面，编辑内容没了 → 状态在内存里，没持久化；
- 换个浏览器打开，数据不一样 → 每个浏览器进程都有自己独立的一份；
- 切到"预览页"数据空了 → 见第 9.5 节，那是**两个独立实例**的问题，不是"数据丢了"。

### 1.4 与浏览器的关系：两个世界

| | JS 世界 | 浏览器引擎世界 |
| --- | --- | --- |
| 对象 | V8 堆里的普通 JS 对象（变量、fiber、虚拟 DOM） | C++ 原生 DOM 节点 |
| 谁管 | JS 引擎（V8） | 渲染引擎（Blink） |
| 交互方式 | 通过 DOM API 跨世界调用 | 接收调用、维护真实 DOM |

- **"React 唯一产出：DOM API 调用序列"**——React 从头到尾只做一件事：在恰当的时机，替你把一串 `document.createElement` / `appendChild` / `setAttribute` 之类的调用发到"引擎世界"。其余全是 JS 世界里的普通对象运算。
- 类比：DOM API 调用 ≈ JNI / RMI 式的跨世界调用；DOM 在 JS 侧只是一个"代理对象"。
- 赋值 `el.textContent = 'x'` 不是立刻可见：引擎只是打"脏标记"，真正的样式计算/布局/绘制**按帧批量**在下一个渲染时机执行。

### 1.5 构建与运行时的对应关系

- 源码 `index.tsx` → Webpack + babel-loader 打包 → bundle.js（≈ 源码编译成 jar 的过程）；
- `<React.StrictMode>`：开发模式下的"严格校验"（会故意双调用渲染与 effect），生产构建会被剥离。

---

## 二、组件与 JSX

### 2.1 组件 = 返回 JSX 的函数

```tsx
const PageTabs: React.FC<PageTabsProps> = ({ pages, activePageId, onPageChange }) => {
  return <div>...</div>;
};
```

- 名字**必须大写开头**（React 靠大小写区分"组件"还是"原生标签"）；
- 接收 props 参数，返回 JSX；
- 项目里的组件分层：
  - **页面组件**：`TemplateEditor`、`Preview`、`Settings`（对应路由）；
  - **布局组件**：`Layout`（顶部导航 + `<Outlet />`）；
  - **展示组件**：`PageTabs`、`SlotList`、`JsonPreview`（纯渲染，数据全从 props 来）；
  - **交互组件**：`FieldSlot`（有拖拽/选中逻辑）、`AssetPanel`（有表单交互）。

### 2.2 JSX 的编译本质

JSX 不是 HTML，只是**语法糖**，Babel 编译后是普通函数调用：

```tsx
// 你写的
<div className="box">Hello</div>

// 编译后（概念等价）
React.createElement('div', { className: 'box' }, 'Hello')
// → 返回一个普通 JS 对象（老的叫"虚拟 DOM 元素"），内容形如：
// { type: 'div', props: { className: 'box', children: 'Hello' } }
```

所以：**JSX ≈ 描述界面的数据结构**；组件返回的不是 DOM，而是一棵普通对象树。真正的 DOM 由 React 之后的渲染流程创建（见第五、六章）。

### 2.3 组件树与"实例"

- 组件是"定义"，`<FieldSlot />` 写一次就创建**一个实例**；
- 模板「电商活动页」共 3 页、28 个字段槽位：`TemplateCanvas` 用 `page.fields.map(...)` 一次性渲染出当前页的所有 `FieldSlot` 实例（首页 8 个），每个实例**自己的状态互相独立**：

```tsx
const FieldSlot: React.FC<FieldSlotProps> = ({ field, value, isSelected, scale, onSelect, onImageDrop }) => {
  const [isDragOver, setIsDragOver] = React.useState(false);  // 每个实例一份
  ...
};
```

> [!info] 实例的独立性
> 某个 `FieldSlot` 拖拽变高亮（`isDragOver = true`），只影响它自己那一个格子；另外 27 个不受影响——这是"状态是实例私有的"最直观的例子。

- `map` 渲染列表时必须给每个实例一个稳定的 `key`（项目用 `key={field.fieldKey}`），React 靠它识别"这几个是同一批实例"，决定复用还是重建（diff 的依据之一）。

---

## 三、Props 与 State

### 3.1 props：下行数据 + 上行回调

props 是父组件传给子组件的参数，**只读**（子组件不允许直接改）。项目里的典型接口：

```tsx
interface TemplateCanvasProps {
  page: PageTemplate;                 // 数据 props：往下传
  pageValues: PageFieldValues;
  selectedFieldKey: string | null;
  onFieldSelect: (fieldKey: string) => void;              // 回调 props：把"事件"往上传
  onImageDrop: (fieldKey: string, dataUrl: string, url: string, meta: {...}) => void;
  scale: number;
}
```

回调传来传去时经常需要"包装补参"——因为子组件只知道"我被点了"，父组件需要知道"是哪个槽位被点了"：

```tsx
// TemplateCanvas 内部：把 field.fieldKey 预先绑进回调
<FieldSlot
  key={field.fieldKey}
  field={field}
  onSelect={() => onFieldSelect(field.fieldKey)}
  onImageDrop={(dataUrl, url, meta) => onImageDrop(field.fieldKey, dataUrl, url, meta)}
/>
```

### 3.2 单向数据流：谁的数据谁负责改

- 数据（state）只有唯一的所有者（这里是 `TemplateEditor` 里的 `store`）；
- 子组件通过 props 拿到**值**和**回调**；
- 想改数据？调回调让所有者去改；所有者改完，新值重新流下来。

> [!tip] 一句话铁律
> **谁的数据谁负责改。** 子组件永远不直接改父组件的数据，只"上报事件"。

### 3.3 state：快照模型

- state = 组件私有的、会变化的数据，用 `useState` 声明：

```tsx
const [activePageId, setActivePageId] = useState<string>(template.pages[0].pageId);
```

- **每次渲染 = 一张冻结快照**：这一次渲染中，所有 props/state/事件回调捕获的都是这一帧的值，渲染内的读取永远一致；
- 两个经典推论：
  1. 在同一个事件处理里连写两次 `setCount(count + 1)` **只会 +1**——两次都是"旧快照 +1"，提交了两次相同的变更申请；
  2. 需要"基于最新值连续变更"时用 **updater 函数形式**：`setCount(prev => prev + 1)`；
- React 18 会**自动批处理**：同一个事件回调里的多次 setState 合并成一次渲染。

### 3.4 setState 不是赋值，是"提交变更申请"

`setActivePageId('page-detail')` 不是往变量里写值，而是：

1. 生成一条"更新记录"；
2. 挂到对应状态的更新队列上；
3. 通知 React 调度一次重渲染；
4. 重渲染时，React 按顺序应用这些记录，算出最新的 state。

### 3.5 不可变更新（Immutable Update）

state 是对象/数组时，**不许原地改（mutate）**，必须返回新对象。因为 React 用 `Object.is`（引用比较）判断"变没变"——原地改引用没变，React 认为没变，不渲染。

项目实例（`configStore.ts` 的核心 setter）：

```tsx
const setFieldValue = useCallback((pageId, fieldKey, value, type, fieldName, required, meta?) => {
  setAllPageValues(prev => ({
    ...prev,                                    // 复制第一层
    [pageId]: {
      ...(prev[pageId] || {}),                  // 复制第二层
      [fieldKey]: { fieldKey, fieldName, type, required, value, meta },
    },
  }));
}, []);
```

> [!warning] Java 直觉的陷阱
> 类比 HashSet/HashMap 的 key 突变问题：对象作为 key 后你改了它的字段，容器"找不到"它了。React 同理——改对象内部字段而不换引用，比较时"看起来没变"。**先复制、再修改、返回新引用** 是唯一正确姿势。

### 3.6 派生值不要存 state

能从现有 state 算出来的值（校验结果、格式化 JSON、已填数量）**不要**再存一份 state，用 `useMemo` 在渲染时计算：

```tsx
const validation = useMemo(() => validateConfig(template, allPageValues), [template, allPageValues]);
const filledFields = useMemo(() => { /* 遍历统计 */ }, [template, allPageValues]);
```

否则就要手工维护"两处数据同步"，必然出 bug。

---

# 第二部分｜运行时机制

> 第 4–8 章：事件与线程 → render/commit 两阶段 → Fiber（栈→堆、调度、优先级、错误边界）→ Hook 格子链 → 生命周期与 useEffect。

## 四、事件机制与线程模型

### 4.1 合成事件与事件委托

- 你写的 `onClick={...}` 不是"给这个按钮挂监听器"，只是 props 里的一个**回调数据**；
- React 17 起，**唯一的一个原生监听器挂在根容器（#root）上**，所有点击都冒泡到这里统一处理——这就是**事件委托**，类比后端的 DispatcherServlet：一个入口，统一分发；
- 分发逻辑：拿到 `event.target` → 找到对应的 fiber → 沿 fiber 树向上收集所有 `onClick`（含冒泡/捕获顺序）→ 依次执行；
- 好处：海量节点零监听器开销（项目的画布有几十个槽位，若每个都挂原生监听器开销不小）。

### 4.2 从点击到上屏的完整链路（初版）

以"编辑器里点击某个字段槽位"为例：

1. 原生 click 事件冒泡到根容器，React 的唯一监听器触发；
2. React 从 target 的 fiber 向上收集 onClick 链，依次调用；
3. 回调里执行 `store.setSelectedFieldKey(...)` → 提交状态变更申请；
4. React 调度一次渲染：重跑受影响的组件函数、diff、commit 改真实 DOM；
5. 浏览器在下一个渲染时机把变化画到屏幕上。

### 4.3 线程模型：单线程事件循环

- 浏览器为页面分配**一条主线程**：JS 执行、样式计算、布局、绘制都在这条线上；
- 事件循环模型：从任务队列取一个**宏任务**执行 → 清空**微任务**队列 → （有机会的话）执行渲染 → 取下一个宏任务；
- **JS 没有多线程能力**（Web Worker 是另一条线，但碰不了 DOM）——所有 React 代码都跑在这一条主线程上。

### 4.4 关键互斥：JS 执行与渲染管线共用主线程

```
主线程时间轴 →
[ 事件回调/JS任务 ][ 渲染机会: style→layout→paint ][ JS任务 ][ 渲染机会 ]...
```

- 主线程跑 JS 时，样式/布局/绘制全部排队等待 → **长任务直接卡死页面**；
- 合成器线程（真线程）能把已画好的图层合成上屏，还能独立跑 `transform` / `opacity` 动画——所以只改这两类属性的动画可以"不卡"；改 `left/top` 等触发重排的属性则必须回主线程。
- **帧与帧率**：屏幕约每 **16.7ms**（60Hz）要出一帧新画面，上面时间轴里"渲染机会"出现的节奏就是它。若某个 JS 任务跑了 200ms，期间攒下的帧全部作废——用户看到的就是**掉帧**（卡顿感）；
- 推论：**单个 JS 任务越短、越不阻塞主线程，帧越不容易丢**。React 把一次大渲染切成 5ms 一片（第六章），就是朝这个目标优化。

### 4.5 React 18 的 concurrent：协作式调度，不是多线程

- React 的"并发特性"**没有开新线程**：仍是单线程，只是把渲染工作切成小片，主动让出让浏览器有机会喘息（见第六章）；
- 危险点与 Java 不同：不是数据竞争（无锁、无线程安全概念），而是**阻塞主线程**与**异步交错**（渲染可能被中断重做，因此 render 必须"纯"）。

---

## 五、渲染机制：从函数重跑到 DOM 更新

### 5.1 工作循环

```
state 变 → 重跑组件函数（得到新 JSX 对象树）→ 与上次结果对比（diff）
        → 算出最小 DOM 变更清单 → 应用变更（commit）→ 浏览器绘制
```

### 5.2 两个大阶段：render 与 commit

| 阶段 | 做什么 | 可中断？ |
| --- | --- | --- |
| **render 阶段** | 执行组件函数、创建/更新 fiber、diff 出变更标记；**全程只碰内存对象** | ✅ 可暂停、可恢复、可整体丢弃重算 |
| **commit 阶段** | 把算好的变更应用到真实 DOM | ❌ 不可中断（界面不能"更新一半"） |

commit 内部三个子阶段：

| 子阶段 | 做什么 |
| --- | --- |
| beforeMutation | 读取 DOM 前的最后准备（类组件的 getSnapshotBeforeUpdate） |
| mutation | 真正 insert / update / delete 真实 DOM；卸载组件（执行清理） |
| layout | useLayoutEffect 回调、ref 赋值——**同步，绘制之前** |

commit 完成后：浏览器绘制 → `useEffect`（passive effects）在绘制后**异步批量执行**。

> [!info] 这就是"React 唯一产出：DOM API 调用序列"的确切出处
> render 阶段不产生任何 DOM 调用；**所有 DOM API 调用都来自 commit 阶段的 mutation**。

### 5.3 render / commit 对应浏览器的哪个阶段？

**都不对应"浏览器渲染管线"——render 和 commit 都只是主线程上的 JS 任务（事件循环的"JS 执行"段）；真正的 style→layout→paint 发生在它们之后的"渲染机会"里。**

```
主线程时间轴：
[ JS：render 切片1 ][ JS：render 切片2 ] … [ JS：commit（一气呵成） ] → [ 渲染机会：style→layout→paint → 提交合成器 ] → [ JS：useEffect flush ]
     纯内存计算，可中断、可让出              改真实 DOM，不可中断           浏览器自己的事，与 React 无关                 绘制之后的异步任务
```

| React 阶段 | 事件循环中的位置 | 浏览器渲染管线的状态 |
| --- | --- | --- |
| **render 阶段** | JS 任务（并发模式下可切成多个宏任务） | 完全没碰 DOM；每次让出，浏览器才有机会插进一个"渲染机会" |
| **commit：mutation** | 同一个 JS 任务内 | 发 DOM API → 引擎只打"脏标记"，布局/绘制还没做 |
| **commit：layout** | 仍在同一个 JS 任务内 | `useLayoutEffect` 里**读**布局会迫使浏览器**同步**做一次 style+layout（强制同步布局），所以能"改完立刻量、量完再改"，防闪烁 |
| **浏览器绘制** | commit 结束后的下一个渲染机会 | style → layout → paint → composite，这才是真正的"上屏" |
| **useEffect flush** | 绘制之后的异步任务 | 无关；effect 里改 DOM 可能让用户看到中间态 |

两个容易混的点：

- **React 的"render 阶段"和浏览器的 rendering 不是一回事**（名字误导）：它只是"算出要改什么"，一行 DOM 都不改——5.2 的"React 唯一产出：DOM API 调用序列"全部出自 commit；
- **commit 不可中断的真正原因**：mutation 改的是真 DOM，若切成两片，浏览器可能在两片之间插一个渲染机会，把"更新一半的界面"画给用户看；render 只碰内存草稿树，切任意刀都安全。

> [!info] 顺带纠一个常见的过度期待：普通 setState 并不切片
> React 18 里普通点击触发的 setState（SyncLane）是**同步一条龙**跑完 render+commit；只有 transition 等低优先级更新才真正走"切多片、可被抢占"。切片是能力，不是常态。

**帧、渲染机会、commit 的三角关系**——三个概念先分清：

| 概念 | 是什么 | 归属 |
| --- | --- | --- |
| **帧** | 显示器按 vsync 出图的节拍（60Hz ≈ 16.7ms 一拍） | 显示器 + 合成器 |
| **渲染机会** | 事件循环里的"Update the rendering"步骤：跑 rAF 回调 → style→layout→paint → 提交给合成器 | 主线程 |
| **上屏** | 合成器在某个 vsync 把图层合成输出 | 合成器线程 |

**"渲染机会 = 一帧"吗？约等于，但有四个偏差**：

1. **可空转**：没有 rAF 回调、没有待重算的样式/布局时，机会来了无事可做，不产出新画面；
2. **节拍会变**：120Hz 屏 8.3ms 一拍、LTPO 动态变频、后台标签页几乎不给机会；主线程被长任务占住时机会被顺延——"掉帧"的本质是机会没按时来或预算已花光；
3. **上屏晚半步**：机会只负责"算完并提交"，出图要等合成器在下一个 vsync 合成——"渲染机会执行"≠"用户看到了"；
4. **反向案例：有帧、无机会**——纯 `transform` / `opacity` 动画跑在合成器线程，屏幕每帧都在更新，主线程一次渲染机会都没有。

结论：**渲染机会是"帧节拍在主线程上的投影"**，典型活跃页面下接近 1:1，但它是"约"。

**"commit = 一帧"吗？完全不对应**，三个方向都要说清：

- **commit 不挑 vsync**：时机由优先级决定——点击（SyncLane）在事件回调里同步 render+commit，transition 则异步来；
- **一次 commit → 之后的 0 或 1 次渲染机会**：commit 只负责改 DOM、打脏标记；画不画由浏览器在"下一次"机会决定，没有视觉变化时空转；
- **N 次 commit 可以共享 1 次渲染机会**：

```
[任务1: render+commit][任务2: render+commit][任务3: render+commit]  [渲染机会]
                                                                    ↑ 三次 commit 只上屏最终态

[任务1: render+commit][渲染机会←中间态上屏][任务2: render+commit]  [渲染机会←新态上屏]
                                   ↑ vsync 边界插进来时，中间态会露脸
```

同一个任务内的多次 commit **必然**共享一次机会（这是批处理"不闪"的另一面）；跨任务的多次 commit 则要看 vsync 边界落在哪——这也解释了 **useLayoutEffect 不闪、useEffect 可能闪**（8.4）：前者与 mutation 同任务、永远赶在机会之前；后者在绘制后执行，改的 DOM 要等下一次机会。

- 反例证明"管线 ≠ 机会"：`useLayoutEffect` 里读布局会让浏览器在**同一个 JS 任务内**同步做 style+layout（强制同步布局）——布局算了，但没有任何渲染机会发生。

**总时间轴**：

```
主线程任务          : [render 切片][render 切片][commit]        [useEffect flush]
渲染机会（≈每帧一拍）:      [机会：空转/无变化]  [机会：style→layout→paint]       [机会]
屏幕（vsync 输出）  :                            [此时才出现新界面]
```

- render 可以跨多个任务、多次让出，甚至跨多次渲染机会（transition 渲染期间用户一直看旧界面，页面保持响应）；
- commit 永远只发生一次、落在某一个任务里。

> [!tip] 口诀
> 渲染机会 ≈ 主线程的帧节拍（约等于：可空转、可顺延、可缺席）；commit = JS 任务里的同步一段，与帧无绑定——对应"下一次机会"的 0 或 1 次，而 N 次 commit 共用一次机会上屏是常态。

### 5.4 为什么 render 必须"纯"

fiber 架构下 render 可能被中断、重做、甚至整体丢弃重算（见 6.7），所以组件函数体必须满足：

1. **同样输入 → 同样输出**（可重放）；
2. **除了返回值，不产生任何外部可观测影响**（不碰 DOM、不发请求、不写存储、不改外部变量）；

这不是风格建议，是架构硬约束。所有"跨界操作"必须搬进 `useEffect`（见第八章）。

---

## 六、Fiber：可中断的渲染架构

### 6.1 要解决的问题

React 15 的旧架构（Stack Reconciler）用**递归**遍历组件树，一旦开始就无法暂停——组件树一大，主线程被占住几百毫秒，页面卡死。

Fiber（React 16 重写）的核心思想一句话：

> **把"递归调用栈"从栈上搬进堆对象，让遍历变成"循环 + 游标"，可以随时暂停、恢复、甚至丢弃重算。**

> [!quote] Sebastian Markbåge（React 核心团队，意译）
> "Fiber 的本质，是把调用栈帧（stack frame）从'栈'搬到'堆'上——一个栈帧变成了一个对象。这样一来，我们就能按需暂停它、恢复它、甚至丢掉它。"

### 6.2 Fiber 是什么：三层定义与字段解剖

**三层定义**：

| 层次 | 定义 | 一句话 |
| --- | --- | --- |
| **架构层** | React 16 对协调引擎（Reconciler）的重写 | 目标是**增量渲染**：把大渲染任务切成可暂停的小片 |
| **数据结构层** | 一棵"虚拟调用栈"：用三根指针（return / child / sibling）串成的链表树 | 调用栈帧从"栈"搬到了"堆" |
| **工作单元层** | 每处理完一个 fiber = 一个最小工作单元 | "让出"的边界就是"一个 fiber 处理完" |

**字段解剖**——每个组件（及 DOM 节点）在运行时对应一个 fiber 对象，它同时是**树节点 + 工作单元 + 状态载体**：

| 字段 | 含义 |
| --- | --- |
| `type` / `tag` | 是什么（函数组件 / div / …） |
| `key` | 列表稳定标识（2.3 节那个 key） |
| `stateNode` | host 组件对应的真实 DOM 节点（通往引擎世界的桥） |
| `return` / `child` / `sibling` | 三根指针：父 / 第一个子 / 右兄弟 |
| `pendingProps` | 本次渲染将要用的 props（尚未应用） |
| `memoizedProps` | 上次渲染用过的 props 快照 |
| `memoizedState` | **hook 链表头**（第七章主角） |
| `updateQueue` | 更新队列（类组件的 setState 队列 / hooks 的 effect 环，见 6.5） |
| `ref` | 对外暴露的引用（DOM 节点或组件实例） |
| `alternate` | 双缓冲的孪生兄弟（见 6.4） |
| `lanes` / `childLanes` | 本节点/子树上挂着的更新优先级（见 6.8） |
| `flags` / `subtreeFlags` | 本节点/子树需要做的 DOM 操作标记（diff 的产出，见 6.6） |

### 6.3 三指针：把递归栈搬进堆

遍历规则完全不用递归：

```
有 child  → 往下走
没 child  → 找 sibling
都没有    → 沿 return 往上退
```

React 内部的核心循环（简化）：

```js
let nextUnitOfWork = root;

function workLoop() {
  while (nextUnitOfWork !== null && !shouldYield()) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);  // 处理一个 fiber
  }
  if (nextUnitOfWork !== null) scheduleCallback(workLoop); // 活没干完，回头继续
}
```

**暂停时，遍历进度只停留在 `nextUnitOfWork` 这个普通变量里，调用栈上没有任何东西**——这就是"可中断"的全部秘密。

> [!tip] Java 类比
> 相当于把深度递归遍历改写成显式 `Deque` 迭代：遍历状态从"栈帧"搬到了"堆对象"。再进一步就是虚拟线程 continuation——一个"可挂起、可恢复"的执行流。区别是：JVM 能挂起在任意字节码位置，**JS 做不到**，只能在"任务边界"（一个 fiber 处理完）处让出。

> [!info] 为什么用"指针链表"而不是数组/树的孩子列表
> - **动态增长**：组件树形态运行时才确定，链表天然支持任意增删；
> - **内存不连续**：不需要一整块连续内存，避免大数组整体搬迁；
> - **对中断友好**：续跑只需要 `nextUnitOfWork` 一个引用，无需保存"下标栈"式的遍历上下文；
> - **便于分类处理**：遍历到任意节点，按它的 `tag` 派发不同处理逻辑。

**"把调用栈搬到堆上"的完整账本**——递归里每个隐式状态，在 fiber 上都有一个显式化身：

| 递归时的隐式状态 | 递归版存在哪 | Fiber 版的显式字段 |
| --- | --- | --- |
| 当前处理到哪 | 函数调用上下文 | 全局游标 `nextUnitOfWork` / `workInProgress` |
| 处理完当前节点回到哪 | 栈帧里的返回地址 | `fiber.return` 指针 |
| 下一个兄弟在哪 | 局部循环下标 | `fiber.sibling` |
| 深入子节点 | 压栈（函数调用） | `fiber.child` |
| props / state / hook 链 | 栈帧的局部变量区 | `memoizedProps` / `memoizedState` / `stateNode` |
| "执行到第几行"（程序计数器） | PC 寄存器 | **不需要**——见下 |

**为什么不需要程序计数器**：遍历被设计成"进入 / 离开"两遍式协议（向下 `beginWork`、向上 `completeWork`），任何时刻"下一步去哪"都能由**当前节点 + 遍历规则**推导出来。所以暂停时唯一必须保存的，就是那个全局游标。

由此，**暂停瞬间**只有三条事实：

1. JS 调用栈**是空的**（`workLoop` 已返回，主线程完全交还）；
2. 全部进度 = 一个堆指针 + WIP 树上的字段/flags（中间结果**物化在堆上**，而不是局部变量里）；
3. current 树一个字节没动（双缓冲兜底，见 6.4）。

而**恢复**能成立，靠前面章节立下的三条前提：render 必须纯（5.4）、输入全部可重建（props/state 都在 fiber 字段上）、双缓冲隔离（6.4）。

> [!warning] 粒度边界：Fiber 保证"组件之间"可让出，不保证"组件内部"可让出
> JS 引擎不支持"在函数的第 37 行暂停、原样保留栈帧"（没有 continuation 原语；generator 需要把渲染代码整体生成器化，侵入大、开销高——React 评估过这条路，最终选择手写遍历状态机）。所以暂停点只能落在"函数与函数之间"，即工作单元边界。推论：**某个组件函数单次执行 300ms，这一片就超时了，切片救不了它**——长列表要靠虚拟化、拆组件来治，而不是指望调度器。

这次搬运换来三种能力，与后端三个同构物一一对应：

| 能力 | 依赖什么 | 后端同构物 |
| --- | --- | --- |
| 可暂停 / 可恢复（时间切片） | 进度 = 一个堆指针 | async/await 编译期状态机、Loom continuation——把栈帧搬进堆 |
| 可丢弃 / 可重放（优先级抢占、Suspense 重试） | 中间结果全在堆上 + render 纯 | 工作流引擎：状态持久化后可重试/补偿 |
| 可观测 / 可复用（双缓冲复用旧树、DevTools） | "调用栈"被物化成了对象 | 执行现场外置成可读数据（fiber 树 = 可遍历的调用栈） |

一句话收束：**递归不可中断是 JS 运行时的物理事实，Fiber 的解法不是和运行时对抗，而是自己实现了一台"把栈状态放在堆上"的迷你执行引擎**——JS 没有编译期协程，React 手写了这台状态机（呼应 6.1 引文）。

### 6.4 双缓冲：current 树 与 workInProgress 树

```
current 树（屏幕正在显示的）        workInProgress 树（内存里的草稿）
    App          ⇄ alternate ⇄           App'
   /   \                               /   \
Layout  ...                         Layout' ...

commit 结束后：root.current = workInProgress 树（O(1) 指针切换）
```

- 所有渲染计算都在草稿树（WIP）上做，一个字节都不碰屏幕上的 current 树；
- 好处：**用户永远看不到半成品**；**算到一半被丢弃也无所谓**；旧树不销毁，下一轮当草稿纸复用。

一个贴切的比喻：**双缓冲 ≈ Git 的功能分支**——所有改动先在 `workInProgress` 分支上做，主分支（屏幕上的 current 树）分毫不动；干成了 `commit` 合并（`root.current` 切换指针，O(1)），干砸了（被高优先级抢占）直接丢弃分支、重新开工。若只有一棵树，就只能"边改边用"，改到一半用户必然看到半成品。

### 6.5 更新对象与更新队列："变更申请"的实体形态

第 3.4 节说 setState 是"提交变更申请"——这条"申请"在内存里就是一个 **Update 对象**（简化）：

```js
// 一条更新记录
{
  lane,        // 优先级（React 16/17 里是 expirationTime，见 6.8）
  tag,         // 类型：UpdateState（值为新状态）/ ReplaceState / ForceUpdate / CaptureUpdate
  payload,     // 变更内容：新值，或 updater 函数（prev => next）
  callback,    // 更新应用后的回调（setState 的第二参数）
  next,        // 指向队列中下一条（环形链表）
}
```

- **入队**：`queue.pending` 指向环形链表的"最后一条"，它的 `next` 又回到"第一条"——追加 O(1)，且遍历永远有起点（从 `pending.next` 开始）；
- **多个来源共用一条队列**：对同一个状态的多次 set 依次入队，render 时按顺序回放（3.4 的"按顺序应用"在此落地）；
- **类组件的 updater 三部曲**（React 内部的 `classComponentUpdater`）：
  1. `enqueueSetState`：`this.setState` 先到这里——构造 Update 对象；
  2. `enqueueUpdate`：把 Update 挂进该 fiber 的 `updateQueue.pending`；
  3. `scheduleWork`：给 fiber 打 lane（优先级）、上报调度器；
- **函数组件的 setter 是同一套路**：`useState` 返回的 dispatch 拿到格子的 `queue`，塞入 `{ lane, action, hasEagerState, eagerState, next }` 后同样走调度（详见 7.3）。

> [!tip] 统一心智模型
> 无论 `this.setState` 还是 `useState` 的 setter，本质都是"**往某个更新队列追加一条带优先级的命令 + 通知调度器**"；算新值是 render 阶段的事。这正是"redo log 追加 + replay"比喻的实体结构版（3.4 节）。

### 6.6 Effect list：render 阶段产出的"DOM 待办清单"

render 阶段结束时，一批 fiber 被标记了 `flags`（Placement 插入 / Update 更新 / Deletion 删除 / Passive / Callback…），但 commit 阶段**并不重新遍历整棵树**去找这些标记：

- React 16/17 在 render 过程中维护了一条 **Effect list**——所有"有副作用的 fiber"按采集顺序串成一条 `nextEffect` 单链表，挂在 `root.firstEffect / lastEffect` 上，commit 直接沿链执行，**O(effects) 而不是 O(nodes)**；
- **仅收集有标记的节点**：没副作用的子树整棵跳过（这就是"只更新变化的部分"在机制层的落点）；
- **顺序先子后父**：在 completeWork 自下而上汇总时串链，对应 commit 里"子组件优先处理"的次序；
- **React 18 的改动**：Effect list 被移除，改为直接用 `flags` + `subtreeFlags` 在 commit 阶段**深度优先遍历**（省去维护链表本身的开销）——面试问"React 18 为什么删掉 Effect list"，答这个；
- **与 useEffect 的关系**：useEffect 的"登记"（8.3 节的 effect 环挂在 fiber 上）是**每个节点自己的副作用清单**；commit 走到带 `Passive` 标记的节点时，再把它的 effect 环推入全局待执行队列，绘制后统一 flush。Effect list 管"commit 的工作路线"，两者分工不同。

### 6.7 调度：时间切片与主动让出

- `shouldYield()`：每处理完一个 fiber 检查一次——本次已占用约 **5ms** 就把主线程还回去；
- 让出方式：用 `MessageChannel` 发一个**宏任务**，此刻浏览器可以响应输入、执行渲染；宏任务触发后从 `nextUnitOfWork` 继续；
- 被打断的两种命运：
  1. **只是让出**：进度不丢，续跑后从原处继续；
  2. **被高优先级抢占 / 本轮作废**：丢弃草稿树，从根重算（所以 render 必须纯，见 5.4）。

调度的手段演进：从 requestIdleCallback 到自研 Scheduler。

早期合作式调度的原理（rAF + rIC 组合）：

- `requestAnimationFrame` 在**每帧渲染之前**回调，用来"对齐帧节奏"（拿帧时间戳、标记帧开始）；
- `requestIdleCallback` 在**帧的渲染工作做完后**若有剩余时间才回调，参数 `deadline.timeRemaining()` 给出本帧剩余预算（上限约 50ms），`didTimeout` 表示是否被饿到超时才被强制调用；
- 组合起来：rAF 里标记新帧开始，rIC 里跑渲染工作单元，每处理几个就查 `timeRemaining() > 0`，耗尽就停、等下一帧——典型的**合作式调度**：任务自己切片，浏览器按帧提供可运行窗口。

弃用原因与替代方案对比：

| 维度 | requestIdleCallback（早期尝试） | 自研 Scheduler（现在） |
| --- | --- | --- |
| 时间窗口 | 帧末空闲段——给不给、给多久由浏览器按帧的忙碌程度决定 | 自己的 `MessageChannel` 宏任务——一定被事件循环调度，落在两次渲染机会之间 |
| 预算控制 | 被动查 `timeRemaining()`；忙帧里恒为 0，任务被**饿死** | 自己定 **5ms**，超时主动 `postMessage` 让出 |
| 优先级能力 | 无（只有"有空/没空"） | 5 档优先级堆（Immediate / UserBlocking 250ms / Normal 5s / Low 10s / Idle 不过期）+ **过期催熟**防饿死 + 切片边界插队 |
| 可预期性 | 差：Safari 长期不支持；后台标签页被节流甚至不回调 | 好：行为由 React 自己定义 |

- 一句话：rIC 是"等别人施舍时间"，Scheduler 是"自己定时、到点还回去"——`MessageChannel` 保证"一定轮到我"（且没有 `setTimeout` 嵌套被钳到 4ms 的延迟问题），5ms 自律保证"绝不赖着不走"，优先级堆保证"急的先跑"；
- **调度三部曲**：安排（`scheduleCallback` 把回调交给 Scheduler）→ 决定（`shouldYield`：时间用完让出，或更高优先级插队）→ 执行（`performWorkUntilDeadline` 循环处理工作单元）；
- 注意管辖范围：调度器只作用于 **render 阶段**；commit 一经开始同步跑到黑，不经过调度器。

### 6.8 lanes：优先级

- 优先级用**位掩码**（lanes）表达，挂在 `fiber.lanes` 上；
- 点击等**离散事件** → 最高优先级（SyncLane），保证交互即时；
- `startTransition` 标记的低优先级更新（如列表过滤）可被高优先级**抢占**：React 先扔下算了一半的草稿，先处理用户点击，回头再重算。

优先级模型的演进（面试常问）：

- React 16/17 用 `expirationTime`：一个**数值**代表"截止时间"；新来的更新按 **25ms 时间桶**批量合并，同一个桶内的更新合并处理；
- 缺陷：数值一次只能表达"一档"优先级，"判断子树里有没有高优更新"要做数值比较、难以批量表达；
- React 18 换成 **lanes 位掩码**：一个整数里每一位（bit）是一档优先级；判断"某子树里有没有高优更新"只需 `childLanes & 目标位` 的按位与——O(1)，且支持"同时挂起多种优先级"，批处理语义更清晰。

### 6.9 全景时序（一次 setFieldValue 的完整旅程）

1. `onClick` → 合成事件分发 → `store.setFieldValue(...)`；
2. 生成 Update 对象（见 6.5）挂进 hook 队列的环形链表，给 fiber 打 lane，`scheduleUpdateOnFiber` 沿 return 链上报到 root；
3. Scheduler 决定何时开工（点击是最高优先级，基本立即）；
4. **render 阶段**：从 root `beginWork` 向下——执行组件函数、读取最新 state、diff、标记需要变更的节点；`completeWork` 自下而上汇总；
5. **commit 阶段**：mutation 应用 DOM 变更 → layout 阶段；
6. 浏览器**绘制**；
7. `useEffect` 回调在绘制后异步执行。

### 6.10 异常捕获：渲染树上的"异常冒泡"

render 阶段与 commit 阶段各有自己的异常处理函数：

| 阶段 | React 内部函数 | 行为 |
| --- | --- | --- |
| **render 阶段** | `throwException` | 从出错 fiber 沿 return 链**向上找最近的错误边界**；命中后把边界标记为错误状态，由 `static getDerivedStateFromError`（纯函数）算出降级 state，再重渲染边界 |
| **commit 阶段** | `captureCommitPhaseError` | 同样向上找边界；命中后调用 `componentDidCatch(error, info)`，允许做副作用（如日志上报） |

错误边界就是一个实现了这两个方法的**类组件**：

```tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError(error) {   // render 阶段：纯函数，只算兜底 state
    return { hasError: true };
  }
  componentDidCatch(error, info) {           // commit 阶段：允许副作用（日志上报）
    reportError(error, info);
  }
  render() {
    return this.state.hasError ? <Fallback /> : this.props.children;
  }
}
```

两个限制：

1. **只捕获子组件的异常，捕获不了自身的**——向上找的是父节点，边界救不了自己；
2. **不捕获异步异常**（setTimeout / Promise 回调里抛的），那些得自己 try-catch。

没有任何边界兜住时，React 16+ 的做法是**卸载整棵组件树**（白屏）——所以工程惯例：至少给路由层挂一个全局错误边界。

> [!tip] Java 类比
> 沿 return 链向上找边界 ≈ 异常沿调用栈向上传播找 `catch`；`getDerivedStateFromError`（纯）≈ 在 catch 里"算出兜底返回值"，`componentDidCatch`（有副作用）≈ 在 catch 里"写日志、告警"。Servlet 容器的全局 error-page 对应路由级 ErrorBoundary。

---

## 七、Hook 机制

### 7.1 hook 的状态存在哪：fiber 上的"格子链"

函数组件的 fiber 没有"实例对象"，它的一切"实例字段"都挂在 `fiber.memoizedState` 上：**一个单链表，每次 hook 调用 = 一个格子**：

```
fiber.memoizedState ──► 格子1 {memoizedState: 值, queue: 更新队列, next} 
                          └─► 格子2 {..., next}
                                └─► 格子3 {..., next} ──► null
```

项目实例：`useConfigStore()` 在 TemplateEditor 的 fiber 上有 **16 个格子**，顺序与代码书写顺序完全一致：

| # | 调用 | 作用 |
| --- | --- | --- |
| 1 | `useState(template)` | 模板（只读） |
| 2 | `useState(activePageId)` | 当前页 |
| 3 | `useState(selectedFieldKey)` | 选中的字段 |
| 4 | `useState(allPageValues)` | **所有已填值（核心数据）** |
| 5–8 | `useMemo × 4` | 派生：activePage / activePageValues / selectedField / selectedFieldValue |
| 9–10 | `useCallback × 2` | setFieldValue / clearFieldValue |
| 11–16 | `useMemo × 6` | validation / pageValidationSummary / configOutput / configJson / totalFields / filledFields |

两个反直觉事实：

- `useMemo` / `useCallback` **也各占一格**（格子里存"上次的值 + 上次的依赖"）；
- 每调用一次 `useConfigStore()`，就是长出一条**全新的 16 格链表**——TemplateEditor 一条、Preview 一条，互不相通（第 9.5 节的核心坑）。

### 7.2 顺序即地址

渲染组件时 React 做两件事：

- 置模块级变量 `currentlyRenderingFiber = 当前 fiber`（相当于 hook 的隐式 `this`）；
- 每遇到一次 hook 调用，游标 `workInProgressHook` 就沿链表往前挪一格。

所以 **`useState` 根本不知道"你要哪个状态"——它只知道"取下一格"**。第 1 次调用必然对第 1 格，第 N 次调用必然对第 N 格。

用伪代码看清这条机制（概念示意）：

```js
function renderWithHooks(fiber) {
  currentlyRenderingFiber = fiber;      // 相当于 hook 的"隐式 this"
  workInProgressHook = null;            // 游标归零，本次渲染从第一格重新走
  fiber.memoizedState = null;           // 在草稿（WIP）树上重新串链
  const children = Component(props);    // 执行你的组件函数
  // ...
}

function mountWorkInProgressHook() {    // 每次 useState / useMemo 调用都走这里
  const hook = { memoizedState: null, queue: null, next: null };
  if (workInProgressHook === null) {
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;  // 第一格
  } else {
    workInProgressHook = workInProgressHook.next = hook;                // 挂到链尾
  }
  return workInProgressHook;            // "取下一格"就是返回它
}

// setState 的绑定：格子创建时就把 dispatch 绑死到"当前 fiber + 本格队列"
hook.queue.dispatch = dispatchAction.bind(null, currentlyRenderingFiber, hook.queue);
```

> [!warning] Hook 铁规：只在函数顶层调用，不许放条件/循环里
> 地址 = 顺序。条件分支会让格子错位：数量变了 React 直接抛错（"Rendered more/fewer hooks"）；**数量一样但分支不同 = 静默读错别人的状态**，最阴险。

配套铁规的其它两条：**渲染必须纯**（render 会被重做，链表会被反复走）；**状态随组件卸载消失**（fiber 被摘除，整条链被 GC）。

### 7.3 setState 的真实行为

`setAllPageValues(updater)` 干的事：

1. 造一个更新对象 `{ lane, action: updater }`；
2. 追加进该格子的 `queue.pending`（环形链表，O(1) 追加）；
3. 给 fiber 打 lane，交给调度器；
4. **新值不在此刻计算**——下一次 render 走到这格时，按顺序应用队列里的更新算出结果。

细节补充：

- 若 fiber 上没有待处理工作，React 会"提前试算"（eager state）：算出来和当前值一样就**直接跳过调度**——这就是"set 同样的值不触发渲染"的来源；
- 用一个比喻统摄：**setState ≈ 往 redo log 追加一条命令，render ≈ 按 log replay 出新状态**。

### 7.4 hook 家族分工

| hook | 职责 | 一句话 |
| --- | --- | --- |
| `useState` | 可变状态 | 快照模型，set 提交变更申请 |
| `useMemo` | 缓存计算结果 | 派生值专用，依赖变了才重算 |
| `useCallback` | 缓存函数引用 | 稳定传给子组件的回调身份 |
| `useEffect` | 副作用出口 | 渲染之外的操作，见第八章 |
| `useRef` | 跨渲染的"盒子" | 不触发渲染的可变值 / DOM 引用（项目里 `fileInputRef`） |

### 7.5 函数组件 vs 类组件

| 维度 | 类组件（历史） | 函数 + Hooks（现在） |
| --- | --- | --- |
| 范式 | 面向对象：this、方法、实例 | 函数式：闭包、组合 |
| 状态 | `this.state`，`setState` **浅合并** | 每个 useState 独立格子，set **整体替换** + updater |
| 逻辑组织 | 按生命周期方法拆分（同一功能散落多处） | **按功能组织**（一个功能一个 effect） |
| 逻辑复用 | HOC / render props（嵌套地狱） | 自定义 Hook（就是函数） |
| this 绑定 | 需要 bind，容易出错 | 没有 this，闭包天然捕获 |
| 实例 | React 内部真的 `new` 出类实例 | **没有可见实例对象**，fiber + 钩子链模拟 |

Hooks 要解决的类组件三个痛点（官方动机）：

1. **逻辑复用难**：跨组件复用"带状态的逻辑"只能靠 HOC / render props——层层包裹（wrapper hell），数据来源难追踪，命名冲突不断；
2. **关注点分散**：同一个功能（比如订阅）的代码被硬拆进 `componentDidMount` / `componentDidUpdate` / `componentWillUnmount` 三个方法，和别的功能混在一起；Hooks 让"一个功能 = 一个 effect"，聚合在一处；
3. **this 心智负担**：`this` 指向、事件处理函数 bind、类字段初始化顺序，全是高频出错点；函数组件没有 this，闭包天然捕获。

> [!info] "实例"的真相
> 类组件时代"实例"是字面真实的（this 就是实例）；Hooks 时代"实例"是**虚拟**的：那个 16 格链表 + fiber 就是实例的化身。`currentlyRenderingFiber` 相当于隐式的 this 指针；`setFieldValue` 闭包捕获了"该 fiber 的 dispatch"——所以你从 store 里拿到的 setter，天然只作用于"这条链"。

### 7.6 hook 与 fiber 的关联总结

| hook 机制 | 依赖 fiber 的什么 |
| --- | --- |
| 状态存储 | `fiber.memoizedState` 格子链 |
| "取下一个状态" | `currentlyRenderingFiber` + `workInProgressHook` 游标 |
| setState 找目标 | 格子里的 `queue.dispatch`（创建时绑定了所属 fiber） |
| 卸载即销毁 | fiber 被移除 → 链表与状态一起被回收 |

### 7.7 闭包快照（capture value）：类组件与函数组件的经典差异

看一个经典案例——Follow 按钮：点击后 3 秒内，如果 `user` prop 变了，alert 里显示谁？

```tsx
// 类组件：this.props 是"现读"的，3 秒后拿到的是最新 user
handleClick = () => {
  this.setState({ isFollowing: true });
  setTimeout(() => {
    this.setState({ isFollowing: false });
    alert('已关注：' + this.props.user);   // 最新值
  }, 3000);
};

// 函数组件：闭包捕获"点击那一次渲染"的快照
function FollowButton({ user }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const handleClick = () => {
    setIsFollowing(true);
    setTimeout(() => {
      setIsFollowing(false);
      alert('已关注：' + user);            // 点击时刻的旧快照
    }, 3000);
  };
  return <button onClick={handleClick}>{isFollowing ? '关注中' : '关注'}</button>;
}
```

- **机制**：函数组件的每次渲染都是一次独立的函数调用，本次的 props/state 被闭包冻结（3.3 的快照模型）；类组件的方法通过 `this.props` 每次现取，所以总能看到最新值；
- **这不是 bug**：绝大多数场景"快照"才是对的语义（3 秒内 user 变了，你要处理的仍是当时那个人）；社区把这种行为叫 **stale closure（陈旧闭包）**，它在 useEffect 里的同款表现就是"依赖数组漏写导致读到旧值"（8.2）；
- **需要"最新值"时**：用 `useRef` 当"最新值盒子"——

```tsx
function FollowButton({ user }) {
  const latestUser = useRef(user);
  useEffect(() => { latestUser.current = user; });   // 每次渲染后把盒子更新为最新
  // setTimeout / 订阅回调里读 latestUser.current，即是最新值
}
```

> [!info] 什么时候会踩到
> 同步链路（点击 → setState → 本次渲染结束）里闭包来不及"过期"，问题只在**跨渲染的异步等待**（setTimeout、请求回调、订阅回调）中显形——这也是为什么把回调放进 useEffect 时必须严格写依赖数组。

---

## 八、生命周期与 useEffect

### 8.1 三个阶段与类组件映射

组件的生命只有三件事：**挂载（mount）→ 更新（update，N 次）→ 卸载（unmount）**。类组件方法的函数组件等价物：

| 类组件 | 函数组件等价物 |
| --- | --- |
| `constructor` / 初始化 state | `useState` 初始值 |
| `componentDidMount` | `useEffect(fn, [])` |
| `componentDidUpdate` | `useEffect(fn)` / 带依赖数组 |
| `componentWillUnmount` | `useEffect` 返回的 cleanup 函数 |
| `render` | **函数体本身**（每次渲染都会跑） |
| `shouldComponentUpdate` / PureComponent | `React.memo` / `useMemo` |
| `static getDerivedStateFromProps` | 渲染时直接算（派生值不存 state，见 3.6） |
| `getSnapshotBeforeUpdate` | `useLayoutEffect`（时机最接近） |
| `getDerivedStateFromError` / `componentDidCatch` | 无官方 hook 等价物（错误边界必须类组件写法，见 6.10） |

> [!info] 生命周期演进史：为什么 `componentWillXxx` 被废弃
> React 16 引入 Fiber 后，render 阶段**可被打断、可重做**；而 `componentWillMount` / `componentWillReceiveProps` / `componentWillUpdate` 这些"render 之前"的钩子会被**重复调用**——在里面发请求、写外部状态，必然错乱。
>
> - 对策一：改名加 `UNSAFE_` 前缀（如 `UNSAFE_componentWillMount`），字面提醒"它不安全"；
> - 对策二：新增两个"为并发而生"的替代者——`static getDerivedStateFromProps`（渲染前按 props 派生 state，**静态纯函数**，拿不到 this、天然无法写副作用）与 `getSnapshotBeforeUpdate`（commit 改 DOM 之前最后一次读取，典型用途：保存滚动位置）；
> - 一句话原则：**render 之前的一切必须纯**（呼应 5.4）。

### 8.2 useEffect 依赖数组：四种形态

| 写法 | 时机 |
| --- | --- |
| `useEffect(fn)`（不传数组） | **每次渲染后**都执行（少用） |
| `useEffect(fn, [])` | **挂载后一次**；卸载时执行 cleanup |
| `useEffect(fn, [a, b])` | 挂载后 + **a/b 变化后**；重跑前先清理上一轮 |
| `return () => {...}` | cleanup：重跑前 + 卸载时（两种时机都会来） |

依赖数组的双重身份：**机械上是"触发关键词"**（决定要不要重跑），**语义上是"正确性声明"**（用的是谁就必须声明谁，漏一个就会读到旧闭包）。

> [!tip] 依赖数组表达"全部时机"
> 四种写法覆盖了"什么时候跑"的所有可能：从不跑 / 只跑一次 / 依赖变化就跑 / 每次渲染都跑。写依赖数组 = 在回答"这件事什么时候该发生"。

### 8.3 useEffect 的执行机制：登记、决策、执行、清理

useEffect **不参与"算出界面长什么样"**，它是独立登记的"事后动作"：

```
render 阶段（执行组件函数）
   └─ 走到 useEffect(fn, deps) → 只"登记"记录 {create, deps}，fn 不跑    ← 登记
        ↓
（同一次 render 内）deps 与上次逐项 Object.is 比较 → 决定要不要执行       ← 决策
        ↓
commit 阶段（改 DOM）→ layout 阶段 → 浏览器绘制
        ↓
passive flush：先跑上轮 cleanup，再跑新 create（批量、异步）             ← 执行
        ↓
（组件卸载时）commit 处理 fiber 删除 → React 保证把 cleanup 安排好        ← 清理
```

补充两点：

- 同一次 flush 中，**子组件的 effect 先于父组件执行**；
- effect 执行时拿到的闭包，是**登记那一次渲染**捕获的 props/state（"旧值问题"的本质：不是执行得晚，而是快照是旧的）；
- 开发模式下 `<React.StrictMode>` 会故意把 mount 时的 effect 跑两遍（create → cleanup → create），专抓"清理没写对"。

### 8.4 useLayoutEffect vs useEffect

| | useLayoutEffect | useEffect |
| --- | --- | --- |
| 执行时机 | commit 的 layout 阶段，**同步、绘制之前** | commit 之后、绘制之后**异步** |
| 阻塞绘制？ | 是 | 否 |
| 适用 | 需要读 DOM 布局并同步修正（防闪烁） | 绝大多数副作用（请求、订阅、日志） |

### 8.5 副作用：定义、判断标准、常见误区

**副作用 = 与 React 外部世界的交互**（删掉它，外部世界不会留下痕迹；或它依赖 React 之外的东西）。清单：

| 类型 | 例子 |
| --- | --- |
| 改真实 DOM / 浏览器 API | 命令式操作 DOM、focus 输入框、`document.title` |
| 网络请求 | 上传图片、拉配置 |
| 订阅 / 退订 | addEventListener、WebSocket |
| 定时器 | setInterval |
| 浏览器存储 | localStorage（Settings 页用） |
| 日志上报 | 埋点 |

> [!tip] 判断标准："次数"测试
> 从渲染里挪走一条逻辑：效果只与"有没有执行过"有关 → **纯计算**（留在渲染/useMemo）；效果与"执行了几次"有关 → **副作用**（交给 useEffect 管时机）。

**两个常见误区**：

1. **用 useEffect 同步状态**——在 effect 里 setState 会多触发一轮渲染；能从 props/state 直接算的，渲染时算（经典反面教材：列表过滤 `setFiltered(...)` 应改成渲染时直接 `list.filter(...)`）；
2. **把"事件响应"放进 useEffect**——点击发送请求就该写在 `onClick` 里（"用户做了 A 所以做 B"是事件逻辑）；放 effect 里还得用 state 当前导，绕一圈且时机含糊。

### 8.6 事务类比：登记与执行分离

useEffect 完整生命周期完全由 fiber 驱动——登记在 render 的 fiber 工作里、执行标记在 commit 里、销毁跟着 fiber 卸载走。它与 Spring 事务的"提交后回调"是同一个设计套路：

```java
// 业务方法里（≈ render）只登记，不执行
TransactionSynchronizationManager.registerSynchronization(
    new TransactionSynchronization() {
        @Override public void afterCommit() { /* 提交后才跑 */ }      // ≈ useEffect 的 create
        @Override public void afterCompletion(int status) { /* 清理 */ } // ≈ cleanup
    }
);
```

| 事务体系 | React |
| --- | --- |
| 业务逻辑里注册 synchronization | render 里 `useEffect(fn)` 登记 |
| 事务提交后框架统一回调 afterCommit | commit 完成、绘制后统一 flush create |
| 事务回滚 → 回调**永不触发** | 渲染被打断/丢弃 → 登记随草稿作废，从不执行 |
| 回调挂在事务上下文上 | effect 挂在 fiber 上（`updateQueue` 的 effect 环） |
| afterCompletion 释放资源 | cleanup 在重跑前/卸载时保证执行 |

### 8.7 状态随 fiber 生死（正反两面）

- **反面**：路由从编辑器切到预览 → 编辑器页面 fiber 被卸载 → 那 16 格链表销毁 → 下次回来从初始值重建；所以"页面自己记数据"靠不住；
- **正面**：把 store 提到 App 层（如 Context 修复后），路由切换时 App 的 fiber 不卸载、格子不销毁 → 数据跨页面存活。

---

# 第三部分｜工程实践

> 第 9–11 章：组件通信（props / 状态提升 / Context / Redux）→ 路由 → Suspense 与懒加载。

## 九、组件通信

### 9.1 五种机制总览

| 机制 | 方向 / 范围 | 适用场景 | 项目实例 |
| --- | --- | --- | --- |
| props 下行 | 父 → 子（逐级） | 相邻层级传数据 | `page/pageValues` 传给画布 |
| 回调上行 | 子 → 父（逐级） | 子组件触发父改数据 | `onSelect` / `onImageDrop` |
| 状态提升 | 数据搬到最近公共祖先 | 兄弟组件共享 | store 放在两页面共同祖先 |
| Context | **跨层级直投** | 深层嵌套 / 跨路由共享 | `ConfigContext`（项目半成品） |
| 全局 store | React 树之外的单例 + 订阅 | 大型应用 | Redux / Zustand 思路 |

### 9.2 状态提升（Lifting State Up）

- props 只能沿组件树**垂直流动**，跨不了"兄弟"；
- 兄弟要共享数据？把数据的所有者提到"能同时罩住两者的最近公共祖先"，再往下分；
- 缺点：层级深时数据要一路透传（prop drilling），中间组件被迫当"二传手"。

### 9.3 props 通道再深入：调用实参、缓存与组合

**本质：props 不是"父子之间连的管子"，而是"每次调用的实参"。** 父组件函数每次执行到 `<Child x={...} />` 那一行，等于"重新调用一次 Child 函数"，props 就是这次调用的实参（JSX 求值成新对象，附着到新 fiber 上）。三个推论全由此展开：

| 现象 | 机制解释 |
| --- | --- |
| props 只读 | 它是"本次调用的实参"——改它无意义，下次渲染用新实参重新调用 |
| 父渲染 → 子默认跟着渲染 | "父函数执行到那一行"本身就是"调用子函数"的动作，不存在"值没变就不调用"的默认行为 |
| `React.memo` 有价值 | memo = 给"调用"加一层缓存：浅比较入参，命中就复用上次结果、跳过本次调用 |

后端类比：普通函数调用 vs 带缓存的调用（Caffeine `get(key, loader)`）——memo 就是那层 cache，**key 是 props 的浅比较**。key 里只要有一个"新建对象引用"（函数/字面量），缓存必然 miss——这就是"回调 props 要 useCallback"的全部原因。

**引用比较是唯一标尺**：浅比较的每一项用 `Object.is`——对对象是**引用比较**，不是值比较。相当于把一个**没重写 `equals` 的 DTO** 当缓存 key：内容一样的新对象照样 miss。两条实践：

- 对象/数组 props：用 `useMemo` 稳定引用，或靠上游不可变更新保证"没变就是同一引用"（3.5 节的不可变性在这里收利息：引用即内容指纹）；
- 回调 props：`useCallback` 的**依赖数组 = 缓存失效条件**——漏了依赖，缓存的就是一个抓着旧闭包的函数（capture value 在回调维度的表现，见 7.7）；
- 反向提醒：useCallback 不是免费的（依赖比较 + 占 hook 格子），只需治两类场景：① 传给 memo 子组件；② 作为其他 hook 的依赖。**无脑全包是负优化**。

**`children` 也是 props——"组合先于 Context"**：`<Layout>{jsx}</Layout>` 编译后是 `React.createElement(Layout, null, jsx)`，children 只是 props 的一个普通键。由此有一条比 Context 更轻的免透传解法：**数据在哪层，JSX 就在哪层构造**：

```tsx
// TopBar 需要 store，但 Layout 不感知它
<Layout right={<TopBarRight store={store} />} />   // 数据层现场构造，当 prop 传下去
```

附带优化：中间组件因自身原因重渲染时，这份"外来 JSX"引用不变 → 该子树直接命中 bailout 不重跑；若 JSX 是中间组件内部现造的，则每次重建、全子树重跑。React 官方对"深层传参"的建议次序：**先试组合（children/插槽）→ 再考虑 Context**。

### 9.4 Context：跨层级直投

三件套：

```tsx
export const ConfigContext = createContext<ConfigStore | null>(null);   // ① 创建"通道"

export function useConfigContext() {                                    // ② 消费入口（fail-fast）
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfigContext must be used within ConfigContext.Provider');
  return ctx;
}

return (
  <ConfigContext.Provider value={store}>                               // ③ 划定作用域
    ...
  </ConfigContext.Provider>
);
```

各自本质：

- **`createContext(default)`**：创建的不是"值容器"，而是一个**通道标识**（对象引用）；默认值只在"上方没有任何 Provider"时生效——配 `null` + 抛错 hook 是"找不到依赖立即失败"（类比 `getBean` 抛 NoSuchBeanDefinitionException）；
- **`<Provider value={...}>`**：Provider 自己也是个 fiber，**作用域 = 它下方的一切 fiber**；
- **`useContext`**：读 context 的**当前值**并把自己登记为订阅者——注意"沿 return 链向上找最近的 Provider"只是**概念模型**，真实机制是**渲染时压栈取值**（见下）；value 变了，登记过的消费者被点名重渲染（`Object.is` 比较，对象字面量每次都是新引用，注意稳定性）。

**实现原理（压缩版）**：

```js
const ctx = { _currentValue: '默认值' };    // ① 建频道：createContext 就是个普通对象

// ② 渲染进 / 出 Provider 子树（DFS 遍历的进 / 出时机）
ctx._currentValue = newValue;               //    进：换值（旧值记下）
ctx._currentValue = oldValue;               //    出：还原

const v = ctx._currentValue;                // ③ useContext：读一眼当前值（O(1)）
register(currentFiber, ctx);                //    + 在自己的 fiber 上登记"我订阅了"

// ④ value 变了（Object.is 比较，引用没变就不广播）
for (f of 名册中登记过这条频道的 fiber) 标记 f 重渲染;
```

- **② 为什么天然"就近"**：前序遍历中"进入 / 离开子树"的时机，决定当前值 = 路径上最近一次设置——这就是**动态作用域**（按执行时最近一次设置解析，而非代码位置），类似 ThreadLocal 的 set / restore：域内读 O(1)、出域自动还原；
- **④ 通知是"点名制"**：真实实现里"名册"挂在每个 fiber 的 `dependencies` 链表上、由 Provider 变化时扫描子树来查（理解成"全局名册"即可）。两个关键性质：
  - **读即订阅**：只有 `useContext` 才登记——**在 Provider 下渲染 ≠ 消费者**，身处作用域但不读就不被唤醒；
  - **点名不认门卫**：扫描不看 memo——埋在 memo 分支里的消费者照样被点名重渲染。

| | props 通道 | Context 通道 |
| --- | --- | --- |
| 更新路径 | 沿树自上而下：父重渲染 → 重新"调用"子 | 扁平广播：扫描名册 → 直接点名 |
| memo 拦截力 | 拦得住（浅比较命中即跳过） | **拦不住**：扫描不看 memo |
| 谁被唤醒 | 所有"被重新调用"的（默认全子树） | 只有登记过订阅的组件 |
| 中间组件 | 参与接力（重执行或 bailout） | 不重跑函数体（bailout + 下钻到消费者） |

一句话：**props 是"逐级转发的通知"（每层门卫可以拒绝转发）；Context 是"订阅直投"（门卫拦不住，订阅者被点名）**。

**粒度：整个 value 是一颗"原子"**——Context 没有字段级订阅，value 里任一字段变（引用变）则**全部消费者**重渲染。稳定性三招：

1. `useMemo` 稳定 value 引用（最直接）；
2. **按更新频率拆频道**：高频数据与低频数据分成两个 context（按 topic 拆订阅者）；
3. **state / dispatch 两分**："只写"的组件订阅永远稳定的 dispatchContext，"要读"的才订阅 stateContext（官方 Scaling Up with Reducer and Context 模式）。

工程习惯：**Provider 放高、消费者放低**——消费端越靠叶子，重渲染波及面越小。

**多实例能力（Context 独有）**：同一个 Context 对象可挂多个 Provider 实例、划出互不相通的隔离作用域（就近原则 = 各自子树读各自那份）。要在同一页并排渲染两份编辑器，各包一个 Provider 即可。全局 store（模块单例）做不到"每实例一份"，props 天然多实例但要逐级传——**多实例 + 免层传**是 Context 不可替代的能力组合。反过来的坑：子树被意外的另一层同名 Provider 罩住时会静默读到另一份值，排查看 DevTools 的 Provider 层级。

> [!warning] 作用域由位置决定
> Provider 放在哪，取决于**谁需要共享**。能小别大（只有子树的子组件共享 → 就近放）；要跨路由共享 → 必须抬到路由的公共祖先之上。这是**结构问题，不是写法问题**。

Context 不打破单向数据流：它只是把"投递"从"逐级接力"改成"直投"，数据的所有者与 setter 机制不变。

### 9.5 项目实战：一个 store 引发的 bug（Preview 更新不生效）

**症状**：编辑器里填满字段，切到"线上预览"页 → 全是灰色占位与"未填充"。

**诊断**（三层推理）：

1. `Preview` 组件里又写了一句 `const store = useConfigStore();` ——这是**第二次调用**该 hook；
2. hook 机制决定：每调用一次 = 在**那条 fiber 上**长出一条**全新的 16 格链表**（第 7.1 节）——两个页面各有一条链，数据互不相通；
3. 编辑器填的所有 `allPageValues` 都写在第一条链上，预览页读的是第二条空链——**数据一比特都没丢，只是存在了另一条链上**。

**项目里的 Context 是个"半成品"**：`ConfigContext` 创建了、`Provider` 也包了编辑器子树、`useConfigContext` 写好了——但（a）没有任何组件调用 `useConfigContext`（全靠 props 取数）；（b）Provider 的作用域**罩不到 Preview**（兄弟路由，不在它下方）。

```
        App
         │
      HashRouter
         │
       Routes
         │
       Layout
      /      \
TemplateEditor  Preview     ← 兄弟！
   │
   │ ┌── ConfigContext.Provider 作用域（只覆盖编辑器内部）──┐
   ├─┼─ PageTabs / SlotList / TemplateCanvas / ...          │
   └─┴─────────────────────────────────────────────────────┘
                           ✗ Preview 在作用域外
```

**修复路径（4 步）**：

1. **搬家**：把 `ConfigContext` + `useConfigContext` 挪到 `configStore.ts`（与 `ConfigStore` 类型同处）；
2. **在最上层创建唯一实例**：

```tsx
// App.tsx
const App: React.FC = () => {
  const store = useConfigStore();          // 全应用唯一一份
  return (
    <ConfigContext.Provider value={store}> {/* 罩住所有路由 */}
      <HashRouter>
        <Routes>...</Routes>
      </HashRouter>
    </ConfigContext.Provider>
  );
};
```

3. **TemplateEditor 改消费**：`useConfigStore()` → `useConfigContext()`，并删掉组件内自己的 Provider（否则内外两层，内层赢，白改）；页面局部的 UI state（scale、选中的 tab）保持 local useState 不动；
4. **Preview 改消费**：同样换成 `useConfigContext()`。

**结果**：编辑器更新 → App 的格子更新 → App 重渲染 → Provider value 更新 → 两个页面消费者收到新值 → 预览页原样呈现。App 重渲染时 Routes 也重渲染，但 React 按 fiber diff 复用现有页面实例（type/位置没变），页面内局部 state 不丢。

**修复后还剩两个坑**：

- **坑 1：value 稳定性**——App 里 `const store = useConfigStore();`。若这个 hook 返回的是裸对象字面量（`return { allPageValues, setFieldValue, ... }`），则 App **任何原因**的重渲染都会产生新 value → 全消费者被广播一遍（哪怕数据一点没变）。修法：返回对象用 `useMemo` 包住，或采用 state/dispatch 两分（9.4 节"稳定性三招"）；
- **坑 2（概念层）：为什么"hook 版 store"天生不共享、外部 store 天生共享**——`useConfigStore` 的状态（那 16 格链表）声明在**调用它的 fiber** 上，状态所有权绑在组件树上，两次调用 = 两份（本 bug 的根源）；Zustand/Redux 的状态在**模块作用域**（React 树外），组件通过 subscribe 订阅，所有人访问同一块内存，天然单例。Context 方案是"用提升到 App + 广播在树内解决所有权"；外部 store 是"把所有权搬到树外"——两条路选的是"这份状态要不要交给这棵树管"。

### 9.6 Context vs 全局 store

| | Context | 全局 store（Redux / Zustand 思路） |
| --- | --- | --- |
| 值的归属 | 挂在持有组件（App）的 fiber 上 | React 树**外面**的模块级单例 |
| 手段 | Provider + useContext 订阅 | store.subscribe + 选择器 hook |
| 优势 | 无依赖、结构直观 | 不受树结构限制、可细粒度订阅、DevTools |
| 适用 | 中后台、中小应用 | 大型应用、复杂状态 |

> [!info] 项目的"假全局 store"
> `useConfigStore` 的 API 长得像 Zustand（一组 state + 一组 setter 打包返回），但它是"**每次调用都新建一份**"的页内实例，不是单例——这正是 Preview bug 的土壤。社区库 zustand 的 `create()` 只会创建一份。

### 9.7 Redux：树外 store 与精确订阅

先拆清三个词的归属（它们分属三层）：

```
Redux 核心库（与 React 完全无关，可单独用）
  ├─ store      状态容器（getState / dispatch / subscribe）
  └─ reducer    (state, action) => newState 纯函数

react-redux（React 绑定库）
  ├─ <Provider store={store}>   借 React Context 把 store 注入组件树
  ├─ useSelector(selector)      切片订阅（精确唤醒）
  └─ useDispatch()              拿 dispatch
```

**Redux 是什么**：把"状态变更"全部收敛成 `(state, action) => state` 的纯函数，状态放在 React 树之外的单一容器里。三条铁律：① 单一数据源（一棵 state 树）；② 状态只读，只能 `dispatch(action)` 描述"发生了什么"；③ 变更由纯 reducer 计算新 state。

对后端来说它一点都不陌生——**Redux ≈ 事件溯源 + 状态机**：

| Redux | 后端对应 |
| --- | --- |
| `action {type, payload}` | Command DTO / 领域事件（描述意图） |
| `reducer` | `(State, Command) -> State` 状态转移纯函数（可重放、可测试） |
| `dispatch(action)` | `commandBus.send(cmd)` / 提交一条命令 |
| `store` | 内存状态存储 + 命令日志（redo log） |
| `store.subscribe` | 监听器 / CDC 变更订阅 |
| DevTools 时间旅行 | 把 redo log 逐条回放 / 回退 |

呼应 7.3 的比喻（setState ≈ 追加 redo log）：Redux 就是把这套模式**显式化、全局化**。reducer 必须纯、action 不许夹带副作用，异步 / 日志 / 埋点放 middleware（≈ dispatch 链上的 Filter/AOP）。现代写法用 Redux Toolkit（`configureStore` + `createSlice`）抹掉样板代码，机制不变。

**store**：核心对象 `{ getState(), dispatch(action), subscribe(listener) }`，内部就是一个闭包变量 + 监听器数组；`dispatch` 干的事 = `currentState = reducer(currentState, action)` + 通知订阅者。**store 是模块作用域里创建的单例，活在 React 树之外**——这正是 9.6 表格"值的归属"那一行的由来，也是它与 `useConfigStore()`（树内、每调用一份）的本质差异。

**Provider**：`<Provider store={store}>` 是 react-redux 的组件（不属于 Redux 核心），实现手段就是 React Context 三件套。注意：它的 value 是**稳定引用**（store 对象 + 库内 memo 过的上下文对象），所以它几乎从不因 state 变化而广播——只负责"把 store 送到手边"，不负责"通知数据变化"。类比：把 DataSource 注册进容器，业务组件随处注入。

**Context 在 Redux 里的角色（最容易混的点）**：

> **react-redux 用 Context 传的是"store 这个定位"（引用稳定的管道），不用 Context 传"state"（会变化的数据）。**

为什么 state 不走 Context？就是 9.4 的结论：无字段级订阅，value 一变全消费者重渲染、还穿透 memo。数据变化的通知走**另一条通道**——`store.subscribe` + `useSelector`：

```tsx
const allPageValues = useSelector(s => s.allPageValues);   // 只订阅这一个切片
const dispatch = useDispatch();
dispatch(setFieldValue({ ... }));
```

`useSelector` 渲染时：① 跑 selector 取"我关心的切片"；② 向 store 登记订阅（v8 起内部用 React 18 的 `useSyncExternalStore`，兼容 concurrent 渲染）。之后每次 dispatch：每个 `useSelector` 重跑自己的 selector，用 `Object.is` 与上次选值比较——**只有变了的组件重渲染**（selector ≈ 查询 + 结果变化推送）。

**一次 dispatch 的闭环**：

```
dispatch(action) → reducer 算新 state → store 更新快照、遍历订阅回调
→ 各 useSelector 重算选择值并比较 → 变了的组件重渲染 → commit 更新 DOM
```

**四个方案横向对照**：

| 能力 | Redux（+ react-redux） | 项目手写 Context store | Zustand | useConfigStore（现状） |
| --- | --- | --- | --- | --- |
| 状态居所 | 树外单例 | 树内（提升到 App 的 fiber） | 树外单例 | 树内，每调用一份（bug 根源） |
| 定位手段 | Provider（用 Context） | Provider（手写） | 无需 Provider（hook 直连） | 无 |
| 更新传播 | useSelector + Object.is，按切片精确唤醒 | value 引用变 → 全消费者重渲染 | selector 订阅 | 不共享，无从谈起 |
| 变更逻辑 | reducer 纯函数统一收口 | 散在 setter 里 | setter + 中间件 | setter |
| DevTools / 时间旅行 | 有 | 无 | 有 | 无 |

有个值得记住的对应：**修好的 `ConfigContext` + `useConfigContext` 本质上是"手写版 react-redux 的前一半"**——Provider 传 store 那一半；缺的是后一半"selector 精确订阅"。消费者多了、或 value 稳定性变差时，要么补 state/dispatch 两分 + 拆 context，要么直接换 Redux/Zustand 拿现成的细粒度订阅。

一句话总结：**store 是状态的居所，Context 是投递管道，Provider 是触发投递的组件**——而"数据变化的通知"在 Redux 体系里根本不走 Context，走的是 store 的订阅机制。

### 9.8 失效模式与选型判据

**排障清单（两条通道各自的典型故障）**：

| 失效模式 | props 通道 | Context 通道 |
| --- | --- | --- |
| 数据没到 | 忘传 / 传错名 → undefined（TS 可拦） | Provider 不在上方 → **静默**读到默认值（所以 default 用 null + 抛错 hook，fail-fast） |
| 更新不生效 | 原地改对象没换引用 → 浅比较认为"没变" | value 引用不稳 → 反而是"过度更新"；value 稳但内部字段原地改 → 消费者拿旧对象 |
| 更新范围失控 | 回调引用不稳 → memo 失效，全子树重跑 | 无字段级订阅 → value 一变全家重渲染 |
| 找不到数据来源 | 沿 JSX 一眼可见 | 必须搜"谁包了 Provider"（隐式依赖） |

**选型判据：四个问题**：

1. **数据被谁读？** 相邻两层 → props；深层多点 / 跨路由 → Context；
2. **变化频率？** 高频大对象 → 拆 context 或外部 store（带 selector 的细粒度订阅）；
3. **需要几个实例？** 要"每实例独立一份" → Context 多 Provider；确定单例 → 外部 store 更直接；
4. **依赖该不该可见？** props 是**显式契约**（依赖写在组件签名上，改接口立即暴露）；Context 是**隐式依赖**（读函数体才知道它从哪取数）——"Context 是服务定位器"的批评都源于此。

后端对照：props ≈ **构造器注入**（显式、装配点清晰）；Context ≈ **字段 @Autowired / 服务定位器**（隐式，但深层共享时省掉整条透传链）。

次序口诀：**就近 useState → props → 组合（children）→ Context → 全局 store**。

---

## 十、路由：react-router-dom v6

### 10.1 项目真实路由结构

```tsx
// App.tsx
<HashRouter>
  <Routes>
    <Route path="/" element={<Layout />}>
      <Route index element={<Navigate to="/editor" replace />} />
      <Route path="editor" element={<TemplateEditor />} />
      <Route path="preview" element={<Preview />} />
      <Route path="settings" element={<Settings />} />
    </Route>
  </Routes>
</HashRouter>
```

| 概念 | 作用 |
| --- | --- |
| `HashRouter` | 用 URL 的 hash（`#/editor`）承载路由状态，免服务端配置 |
| `Routes` / `Route` | 路由表：`path` 匹配 → 渲染 `element` |
| `index` + `Navigate` | 默认重定向：`/` → `/editor`（replace 不留历史） |
| `Layout` + `Outlet` | 布局组件：顶部导航常驻，`<Outlet />` 是子页面占位 |
| `NavLink` | 导航链接，`className={({ isActive }) => ...}` 按激活态高亮 |
| `useNavigate` | 编程式导航（命令式跳转） |

导航的两种写法（项目中都有）：

```tsx
<NavLink to="/editor" className={({ isActive }) => isActive ? '...' : '...'}>模板编辑</NavLink>
// 或
<button onClick={() => navigate('/preview')}>预览</button>
```

### 10.2 URL 即 state

`HashRouter` 内部把当前 location 存成**React state**，并监听 hash 变化（`history.listen` → `setState`）。所以路由的本质：

> **URL 就是一份 state，路由切换 = 改 state 触发重渲染。**

### 10.3 点击 NavLink 到页面切换的全链路

1. 点击 NavLink → 合成事件回调（NavLink 内部）→ `preventDefault()` 阻止浏览器默认跳转 → 改 hash；
2. HashRouter 收到变化 → `setState(newLocation)`；
3. App 重渲染 → `Routes` 按新 path 重新匹配 → 命中新的 Route；
4. diff 时发现 element 的**组件 type 变了**（TemplateEditor → Preview）→ **卸载旧页面 fiber、挂载新页面 fiber**；
5. commit 更新 DOM，新页面首次渲染（mount effect 触发）。

### 10.4 路由切换与状态存亡

- **type 不同 → 整个页面卸载重挂**：旧页面所有纤维被销毁（局部 state 清零、cleanup 执行），新页面从初始值开始；
- 这就是"编辑页填的数据进预览页就没了"的**机制背景**（叠加 9.5 的双实例问题，就是完整的 Preview bug）；
- 想让数据跨页面存活，唯一正解：**把状态提到公共祖先**（Context / 全局 store），让承载它的 fiber 不被卸载。

---

## 十一、扩展：Suspense 与懒加载

### 11.1 用法：React.lazy + Suspense

项目当前的路由组件都是静态 `import`（全部打进一个 bundle）。要做**代码分割**（按路由拆包、用到才下载），标准做法：

```tsx
const TemplateEditor = React.lazy(() => import('./pages/TemplateEditor'));
const Preview = React.lazy(() => import('./pages/Preview'));

<Suspense fallback={<div>加载中…</div>}>
  <Routes>
    <Route path="editor" element={<TemplateEditor />} />
    <Route path="preview" element={<Preview />} />
  </Routes>
</Suspense>
```

- `React.lazy(fn)`：fn 返回一个 Promise（动态 import）——打包器会把该模块拆成独立 chunk；
- `<Suspense fallback={...}>`：划定"等待区"——子树没准备好时显示 fallback。

### 11.2 原理：抛出来的 Promise

1. lazy 组件首次渲染时，内部 `read()` 发现模块还没加载 → **不是返回，而是 `throw` 一个 Promise**；
2. React 在 render 阶段接住"抛出来的不是 Error 而是 Promise" → 找到**最近的 Suspense** 边界，渲染 fallback；
3. 该 Promise resolve（模块下载完）后 → React 收到通知，**重试渲染**；
4. 第二次渲染时 `read()` 命中缓存 → 正常返回模块，渲染真实内容。

> [!tip] 一句话本质
> Suspense 是**用异常机制表达的"控制流等待"**：`throw Promise` 相当于"挂起，等我好了再来"；React 接住后先渲染 fallback，Promise 落定后自动重试。它和错误边界（6.10）共用同一套"从下往上找边界"的机制，只不过一个接住 Error，一个接住 Promise。

### 11.3 延伸：Suspense 不止于懒加载

React 18 里 Suspense 的定位是**统一的异步数据获取模型**（配合 Relay / React Query 等支持 suspense 的数据层，数据请求也可以"抛出 Promise"）；当前项目体量还用不到，理解"throw Promise → fallback → 重试"这一条主线即可。

---

# 第四部分｜速查与附录

> 第 12 章 + 附录：Java ⇄ React 对照总表 · 概念速查卡 · 参考资料。

## 十二、Java ⇄ React 对照总表（速查）

| Java / Spring | React | 备注 |
| --- | --- | --- |
| Spring 容器 | React 运行时 | 组件模型 + 生命周期管理 |
| Bean 定义 / Bean 实例 | 组件函数 / 组件实例（fiber + 钩子链） | 实例是运行时的虚拟物 |
| 构造器注入 | props | 外部传入、只读 |
| Bean 字段 | state | 实例私有、会变化 |
| @PostConstruct / @PreDestroy | `useEffect(fn, [])` / cleanup | 挂载、卸载时机 |
| ApplicationContext.getBean | `useContext` | 就近原则取依赖 |
| ThreadLocal 隐式上下文 | `currentlyRenderingFiber` | hook 的隐式 this |
| DispatcherServlet | 根容器合成事件 | 统一入口、统一分发 |
| 递归调用栈 | fiber 三指针链表 | 状态从栈搬进堆，可暂停 |
| 线程池（抢占式并行） | 协作式调度（单线程主动让出） | 不是一回事，别混 |
| TransactionSynchronization.afterCommit | useEffect 执行时机 | 登记与执行分离，回滚即作废 |
| 不可变对象 / final 字段 | 不可变更新 | 靠引用比较（Object.is）驱动 |
| jar 部署一台服务器 | bundle.js 每个浏览器一份 | 状态不共享，刷新即重置 |
| JNI / RMI 跨语言调用 | DOM API 跨"世界"调用 | "React 唯一产出：DOM 调用序列" |
| 异常沿调用栈找 catch | 异常沿 fiber 树找 ErrorBoundary | 只救子组件，救不了自己（6.10） |
| "结果未就绪，稍后重试"的等待 | Suspense：throw Promise + 重试 | 控制流由异常机制实现（11.2） |

## 概念速查卡

- **组件** = 返回 JSX 的函数（大写开头）；
- **props** = 父给子的只读入参（下行数据 + 上行回调）；
- **state** = 组件私有快照；`setState` 是提交变更申请，不是赋值；
- **渲染** = 重跑函数 + diff（render 阶段，可中断）→ 应用 DOM（commit 阶段，不可中断）；
- **渲染机会** = 事件循环里"更新渲染"的步骤，≈ 帧节拍在主线程的投影；commit 与帧无绑定：N 次 commit 可共享一次机会上屏（5.3）；
- **fiber** = 可中断的工作单元链表 + 双缓冲草稿树 + lanes 优先级；"栈→堆"：遍历进度 = 一个全局游标（6.3）；
- **hook** = fiber 上的格子链表；顺序即地址；只在顶层调用；
- **useEffect** = 副作用出口；登记在 render、执行在 commit 之后的异步 flush；
- **Context** = 跨层级直投；作用域由 Provider 在树中的位置决定；
- **路由** = URL 即 state；路由切换 = 卸载旧页面 fiber + 挂载新页面 fiber；
- **Update 对象** = setState 的"变更申请"实体：挂在环形队列里，render 时顺序回放（6.5）；
- **Effect list** = render 阶段扫出的"DOM 待办清单"；React 18 改为 `flags/subtreeFlags` 深度优先遍历（6.6）；
- **错误边界** = `getDerivedStateFromError`（纯，render 阶段）+ `componentDidCatch`（副作用，commit 阶段）；只救子组件、不救异步（6.10）；
- **capture value** = 每次渲染的闭包快照；需要最新值时用 `useRef` 盒子（7.7）；
- **Suspense** = `React.lazy` + `throw Promise` + fallback 重试；路由级代码分割的标准姿势（11）。

## 参考资料

- [走进 React Fiber 架构（ATA 技术文章）](https://ata.atatech.org/articles/11000239927) —— 本笔记第六章（更新对象、Effect list、调度与优先级演进、异常捕获）及 capture value、Suspense 等小节以该文大纲为参照整理
- [[浏览器工作原理与实践——学习笔记1]] —— 主线程、渲染流水线与帧预算的详细展开

## 相关笔记

- [[浏览器工作原理与实践——学习笔记1]]
- [[面向后端的前端学习指南]]
- [[前端打包工具：Webpack、Vite、Rollup、Parcel 和 esbuild]]
- [[JS中的原型]]

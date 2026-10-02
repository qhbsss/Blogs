---
title: JavaScript 中的原型与原型链
tags:
  - frontend/javascript
  - javascript/prototype
aliases:
  - JS 原型
  - 原型链
---
[TOC]

# JavaScript 中的原型与原型链

> [!abstract] 一句话
> JavaScript 对象通过内部的 `[[Prototype]]` 建立继承关系；读取属性时会沿着这条关系向上查找。函数的 `.prototype` 则是构造实例时使用的“模板对象”，不要把两者混为一谈。

本文根据《前端篇》中的原型章节整理，并以现代 JavaScript 语义校正其中的旧式表述。

## 对象、函数与函数对象

### 对象是属性的集合，函数是特殊对象

JavaScript 中的对象可以拥有属性，并通过 `[[Prototype]]` 继承属性：

```js
const user = { name: 'Alice' }
user.role = 'admin'
```

函数也可以拥有属性，但它比普通对象多出“可执行”的内部能力：

```js
function greet(name) {
  return `Hi, ${name}`
}

greet.version = '1.0'

greet('Alice')     // 像函数一样调用
greet.version       // 像对象一样读取属性
```

因此“函数对象”不是“一个包含函数属性的普通对象”，而是指：**函数本身就是对象，同时可被调用。**

```text
普通对象：有属性和 [[Prototype]]
函数对象：有属性和 [[Prototype]]，并额外具有 [[Call]]
构造函数：函数对象中还具有 [[Construct]] 的那部分函数
```

- `[[Call]]`：使 `fn()` 成立；
- `[[Construct]]`：使 `new Fn()` 成立；
- 这两个是规范内部能力，不能直接通过属性读取。

```js
const plainObject = {}
const arrow = () => {}
function User() {}

// plainObject() // TypeError：没有 [[Call]]
arrow()            // 有 [[Call]]
User()             // 有 [[Call]]
new User()         // 有 [[Construct]]
// new arrow()    // TypeError：箭头函数没有 [[Construct]]
```

> [!note] 与 Java 的区别
> Java 方法通常依附于类或对象；JavaScript 函数是一级值，能被传递、返回、保存到数组或 Map，并且能自行携带属性。它更像一个同时实现了“可调用能力”的对象，而不是 Java 中孤立的方法定义。

### `typeof` 只能做粗分类

```js
typeof {}           // 'object'
typeof function () {} // 'function'
typeof null         // 'object'，历史遗留行为
typeof []           // 'object'
```

`typeof value === 'function'` 能判断它通常可调用；但不能完整说明是否可构造、继承了什么，仍需结合 `new`、`Object.getPrototypeOf()` 或具体 API 判断。

## 先区分两个容易混淆的概念

### `[[Prototype]]`：对象的“父对象链接”

每个普通对象都有一个内部槽位 `[[Prototype]]`，它要么指向另一个对象，要么为 `null`。

```js
const animal = {
  eat() {
    return 'eating'
  },
}

const dog = Object.create(animal)

dog.eat() // 'eating'
```

此处：

```text
dog.[[Prototype]] === animal
```

不要直接依赖 `__proto__`。它是历史遗留的访问器，推荐使用：

```js
Object.getPrototypeOf(dog) === animal // true
Object.setPrototypeOf(dog, animal)
```

`Object.create(null)` 创建的对象没有原型，因此没有继承来的 `toString`、`hasOwnProperty`，通常也无法通过 `obj.__proto__` 访问原型。

### `.prototype`：函数用于构造实例的对象

普通可构造函数有 `.prototype` 属性：

```js
function User(name) {
  this.name = name
}

User.prototype.sayHi = function () {
  return `Hi, ${this.name}`
}

const alice = new User('Alice')
```

`new User('Alice')` 创建出的 `alice` 会满足：

```js
Object.getPrototypeOf(alice) === User.prototype // true
```

因此：

```text
alice 的 [[Prototype]] ─────→ User.prototype
User.prototype.constructor ─→ User（默认情况下）
```

> [!warning] 不要倒着理解
> `alice` 的原型是 `User.prototype`；不是说 `alice.prototype` 指向 `User`。普通实例通常没有 `.prototype` 属性。

## 原型链：属性如何查找

访问 `obj.key` 时，JavaScript 按以下步骤解析：

1. 查找 `obj` 自身是否有 `key`；
2. 没有则查找 `obj.[[Prototype]]`；
3. 继续沿每一级 `[[Prototype]]` 查找；
4. 到达 `null` 仍未找到，结果为 `undefined`。

```js
const animal = { category: 'animal' }
const dog = Object.create(animal)
dog.name = 'Lucky'

console.log(dog.name)     // Lucky：自身属性
console.log(dog.category) // animal：从原型继承
console.log(dog.age)      // undefined：链尾仍未找到
```

```text
dog
 ├─ own: name
 └─ [[Prototype]] → animal
                    ├─ own: category
                    └─ [[Prototype]] → Object.prototype
                                         └─ [[Prototype]] → null
```

### 读、写与遮蔽

读取会沿原型链向上查找；但普通赋值通常在当前对象创建或修改自身属性，而不是修改原型属性。

```js
const animal = { category: 'animal' }
const dog = Object.create(animal)

dog.category = 'dog'

console.log(dog.category)    // dog
console.log(animal.category) // animal
```

`dog.category` 遮蔽了从 `animal` 继承来的同名属性。

### 自身属性与继承属性

```js
const proto = { inherited: true }
const obj = Object.create(proto)
obj.own = true

Object.hasOwn(obj, 'own')       // true
Object.hasOwn(obj, 'inherited') // false
'inherited' in obj              // true
```

- `Object.hasOwn(obj, key)`：只检查自身属性；
- `key in obj`：检查自身属性和原型链；
- `for...in`：遍历自身及原型链上**可枚举**的字符串属性。

遍历对象键时，通常应明确过滤自身属性：

```js
for (const key in obj) {
  if (Object.hasOwn(obj, key)) {
    console.log(key)
  }
}
```

## 函数原型：函数身上同时存在两套关系

函数也是对象，但它比普通对象多出“可调用”能力；部分函数还可被 `new` 调用。因此讨论函数时，必须同时看两件完全不同的事：

1. **函数对象自己的 `[[Prototype]]`**：决定函数能使用哪些方法；
2. **函数的 `.prototype` 属性**：决定 `new` 该函数时，实例连接到哪个原型对象。

```js
function User() {}

Object.getPrototypeOf(User) === Function.prototype // true
Object.getPrototypeOf(User.prototype) === Object.prototype // true
```

```text
函数对象 User
├─ User.[[Prototype]] → Function.prototype
│                       └─ 提供 call / apply / bind 等函数方法
└─ User.prototype      → 用于 new User() 所创建实例的原型对象
                           └─ [[Prototype]] → Object.prototype
```

### 函数为什么有 `call`、`apply`、`bind`

这些方法不是复制到每个函数对象上的。普通函数对象会沿自己的原型链从 `Function.prototype` 找到它们：

```js
function greet() {}

greet.hasOwnProperty('call') // false
Object.getPrototypeOf(greet) === Function.prototype // true
greet.call(null) // 可以调用
```

这与实例调用 `alice.sayHi()` 的机制相同：都是先找自身属性，找不到就走原型链。

### `.prototype` 不是“函数自己的父原型”

```js
function User(name) {
  this.name = name
}

User.prototype.sayHi = function () {
  return `Hi, ${this.name}`
}

const alice = new User('Alice')
```

```text
alice ──[[Prototype]]──→ User.prototype ──[[Prototype]]──→ Object.prototype ──→ null
                              │
                              └─ constructor → User

User ──[[Prototype]]──→ Function.prototype ──[[Prototype]]──→ Object.prototype ──→ null
```

- `alice.sayHi()`：通过 `alice → User.prototype` 找到；
- `User.call(...)`：通过 `User → Function.prototype` 找到；
- `User.prototype` 与 `User.[[Prototype]]` 是两条不同的边；
- 改 `User.prototype` 不会改变 `User` 的 `call`、`bind` 等能力；
- `Object.setPrototypeOf(User, other)` 改的是函数对象自己的 `[[Prototype]]`，不会改 `new User()` 实例使用的 `User.prototype`。

> [!warning] 不要只看名称
> `.prototype` 是一个普通属性名；它不等于任何对象的内部 `[[Prototype]]`。它的特殊含义只在可构造函数被 `new` 时体现。

### 可调用与可构造不是同一件事

普通 `function` 声明通常既可调用又可构造：

```js
function User() {}

User()      // 可调用
new User()  // 可构造
```

箭头函数只可调用，不能作为构造函数：

```js
const ArrowUser = () => {}

ArrowUser.prototype // undefined
// new ArrowUser()  // TypeError: ArrowUser is not a constructor
```

对象简写方法也不能作为构造函数：

```js
const tools = {
  run() {},
}

// new tools.run() // TypeError
```

因此，不能只用“有没有 `.prototype`”判断某个值能否 `new`。例如绑定函数可能没有自己的 `.prototype`，但若其目标函数可构造，它仍可被 `new`：

```js
function User(name) {
  this.name = name
}

const BoundUser = User.bind(null, 'Alice')
const alice = new BoundUser()

alice instanceof User // true
```

### `class` 的两条继承链

`class extends` 同时建立实例方法继承和静态成员继承：

```js
class Parent {
  static kind = 'parent'

  sayHi() {
    return 'hi'
  }
}

class Child extends Parent {}

Object.getPrototypeOf(Child) === Parent // 静态成员链
Object.getPrototypeOf(Child.prototype) === Parent.prototype // 实例方法链

Child.kind // 'parent'
new Child().sayHi() // 'hi'
```

```text
Child ──[[Prototype]]──→ Parent ──[[Prototype]]──→ Function.prototype

new Child() ──[[Prototype]]──→ Child.prototype ──[[Prototype]]──→ Parent.prototype
```

这就是为什么 `Child` 能读取 `Parent` 的静态成员，而 `new Child()` 能读取 `Parent.prototype` 上的实例方法。

### `Function` 与 `Object`

以下关系是理解内建构造器的关键：

```js
Object.getPrototypeOf(Function) === Function.prototype // true
Object.getPrototypeOf(Object) === Function.prototype   // true
Object.getPrototypeOf(Function.prototype) === Object.prototype // true
Object.getPrototypeOf(Object.prototype) === null // true
```

不要把这些关系理解为“谁先创建谁”的时间顺序；这是语言规范定义的对象关系图。

### 函数关系最小实验

```js
function User(name) {
  this.name = name
}

User.prototype.sayHi = function () {
  return `Hi, ${this.name}`
}

const alice = new User('Alice')

console.log(Object.getPrototypeOf(User) === Function.prototype)
console.log(User.hasOwnProperty('prototype'))
console.log(Object.getPrototypeOf(alice) === User.prototype)
console.log(alice.sayHi())
console.log(User.hasOwnProperty('call'))
console.log(typeof User.call)

const ArrowUser = () => {}
console.log(ArrowUser.prototype)
```

## 构造函数与 `new`

“构造函数”不是一种独立的数据类型，而是一个**具有 `[[Construct]]` 且被 `new` 调用的函数**。传统约定用大写开头区分：

```js
function User(name) {
  this.name = name
}

const alice = new User('Alice')
```

这里 `User` 同时是：

```text
函数对象：可调用，能有静态属性，也继承 Function.prototype 的方法
构造函数：这一次被 new 调用，用来初始化 alice
实例原型提供者：User.prototype 成为 alice 的 [[Prototype]]
```

普通函数可以直接调用，也通常可以被 `new` 调用；`class User {}` 产生的类也有构造能力和 `.prototype`，但类**必须**通过 `new` 调用：

```js
class Account {}

new Account()
// Account() // TypeError: Class constructor Account cannot be invoked without 'new'
```

`new User('Alice')` 可近似理解为：

```js
function emulateNew(Ctor, ...args) {
  const instance = Object.create(Ctor.prototype)
  const result = Ctor.apply(instance, args)

  return result !== null && (typeof result === 'object' || typeof result === 'function')
    ? result
    : instance
}
```

步骤是：

1. 创建一个新对象；
2. 将其 `[[Prototype]]` 指向 `Ctor.prototype`；
3. 以该对象作为 `this` 调用构造函数；
4. 构造函数若显式返回对象或函数，`new` 表达式返回这个显式对象；否则返回新对象。

```js
function ReturnObject() {
  this.name = 'created instance'
  return { name: 'explicit object' }
}

new ReturnObject().name // explicit object
```

> [!note]
> 构造函数显式返回对象时，`new` 并非“没有生效”；新对象确实被创建并执行了构造逻辑，只是最终表达式结果被显式返回对象替换。

## `constructor` 不是可靠的类型判断工具

默认的 `User.prototype` 通常带有：

```js
User.prototype.constructor === User // true
```

但它容易被覆盖：

```js
function User() {}
User.prototype = {
  sayHi() {
    return 'Hi'
  },
}

User.prototype.constructor === User // false
```

若采用旧式原型继承并整体替换 `.prototype`，需要手动恢复它：

```js
Child.prototype = Object.create(Parent.prototype)
Child.prototype.constructor = Child
```

即便如此，`constructor` 也只是惯例，不应作为跨运行环境、跨 iframe 或安全场景下的可靠类型判断依据。

## `=`、`===`、`==` 与 `Object.is`

### `=`：赋值，不是比较

`=` 将右侧的值写入左侧变量、属性或解构目标；表达式结果也是被赋的值。

```js
let count = 0
count = 1

const user = {}
user.name = 'Alice'
```

在条件中误写赋值是常见错误：

```js
let enabled = false

if (enabled = true) {
  // 条件实际是 true；应写 enabled === true，或直接写 enabled
}
```

### `===`：严格相等，日常首选

`===` 不做隐式类型转换：类型不同一定是 `false`；对象则比较是否为同一个引用。

```js
1 === 1       // true
1 === '1'     // false
null === undefined // false

const a = { id: 1 }
const b = { id: 1 }
const c = a

a === b // false：内容相同，但不是同一个对象
a === c // true：同一个引用
```

对象、数组、函数使用 `===` 比较的是身份，不会进行深度比较。

### `==`：宽松相等，会发生类型转换

`==` 会依照复杂的抽象相等规则做隐式转换：

```js
1 == '1'          // true
false == 0        // true
'' == 0           // true
null == undefined // true
```

业务代码通常应避免 `==`，使用 `===`。一个常见且有意的例外是同时判断 `null` 与 `undefined`：

```js
if (value == null) {
  // 仅当 value 为 null 或 undefined 时进入
}
```

### `Object.is`：处理两个边界差异

`Object.is` 与 `===` 大多数场景一致，但：

```js
NaN === NaN           // false
Object.is(NaN, NaN)   // true

0 === -0              // true
Object.is(0, -0)      // false
```

> [!tip] 实践规则
> 默认用 `===`；需要将 `null` 和 `undefined` 视为同一类“缺失值”时，可明确使用 `value == null`；需要区分 `-0` 或识别 `NaN` 时，使用 `Object.is` 或 `Number.isNaN`。

## `instanceof`：检查构造函数原型是否出现在链中

```js
function Animal() {}
function Dog() {}

Dog.prototype = Object.create(Animal.prototype)
Dog.prototype.constructor = Dog

const dog = new Dog()

dog instanceof Dog    // true
dog instanceof Animal // true
```

`obj instanceof Ctor` 的核心是：`Ctor.prototype` 是否出现在 `obj` 的原型链中，而不是只比较直接原型。

可近似理解为：

```js
function instanceOf(obj, Ctor) {
  let proto = Object.getPrototypeOf(obj)

  while (proto !== null) {
    if (proto === Ctor.prototype) return true
    proto = Object.getPrototypeOf(proto)
  }

  return false
}
```

`instanceof` 与 `===` 的用途不同：

```js
const dog = new Dog()

dog instanceof Animal // 原型链关系：true
dog === Animal        // 是否同一个值：false
```

它不能替代所有类型判断：

```js
[] instanceof Array // true
Array.isArray([])   // true，更适合判断数组

'text' instanceof String      // false：左侧是原始值
new String('text') instanceof String // true：左侧是包装对象
```

限制：

- 原始值通常不适用于此检查；
- 跨 iframe / realm 时，内建构造函数不是同一个对象，因此外部窗口创建的数组可能 `instanceof Array === false`；此时使用 `Array.isArray()`；
- 它检查继承关系，不检查对象的业务“结构”。例如判断对象是否有某字段，使用 `Object.hasOwn()`、`in` 或显式的运行时校验；
- `Symbol.hasInstance` 可以自定义行为，因此结果不一定完全等同于手写的原型链遍历。

## 原型继承与 `class`

### 旧式写法

```js
function Parent(name) {
  this.name = name
}

Parent.prototype.sayName = function () {
  return this.name
}

function Child(name, grade) {
  Parent.call(this, name)
  this.grade = grade
}

Child.prototype = Object.create(Parent.prototype)
Child.prototype.constructor = Child

Child.prototype.sayGrade = function () {
  return this.grade
}
```

- `Parent.call(this, name)`：初始化每个实例独有的状态；
- `Object.create(Parent.prototype)`：让方法继承关系进入原型链；
- 重设 `constructor`：恢复惯例性的反向引用。

旧式继承的本质不是把父类属性“复制”给子类，而是同时完成两件事：

```text
每个 Child 实例自身：由 Parent.call(this, ...) 写入 name 等独有状态
每个 Child 实例的原型链：Child 实例 → Child.prototype → Parent.prototype
```

因此 `Child` 实例可共享访问 `Parent.prototype.sayName`，但每个实例拥有各自的 `name`。传统写法不会自动继承父构造函数对象上的静态成员；若确有需要，必须额外建立函数对象之间的关系：

```js
Object.setPrototypeOf(Child, Parent)
```

### 现代写法

```js
class Parent {
  constructor(name) {
    this.name = name
  }

  sayName() {
    return this.name
  }
}

class Child extends Parent {
  constructor(name, grade) {
    super(name)
    this.grade = grade
  }

  sayGrade() {
    return this.grade
  }
}
```

`class extends` 仍然基于原型链，只是把原型连接、`super` 调用等样板代码交给语言完成。

> [!tip]
> 原型上适合放共享的、无状态的方法；数组、对象等可变状态应在构造函数中放到 `this` 上。否则所有实例会共享同一个可变值。

```js
function BadUser() {}
BadUser.prototype.tags = []

const a = new BadUser()
const b = new BadUser()
a.tags.push('admin')

b.tags // ['admin']
```

## 与静态成员的关系

构造函数本身是对象，所以可以有“静态成员”：

```js
function User(name) {
  this.name = name
}

User.createGuest = function () {
  return new User('Guest')
}

User.prototype.sayHi = function () {
  return `Hi, ${this.name}`
}
```

```text
User.createGuest：属于函数对象 User
alice.sayHi：通过 alice → User.prototype 的链找到
alice.createGuest：通常不存在
```

实例不会自动继承构造函数对象上的静态成员。

## 常见误区速查

| 误区 | 正确理解 |
|---|---|
| 每个对象都有 `__proto__` | 每个对象有内部 `[[Prototype]]`；`__proto__` 是遗留访问器，`Object.create(null)` 例外。 |
| 每个对象都有 `.prototype` | 只有函数等特定可构造对象通常有 `.prototype`；普通实例没有。 |
| `prototype` 等于原型 | 函数的 `.prototype` 是给 `new` 创建实例使用的对象；对象实际原型是 `[[Prototype]]`。 |
| `instanceof` 只比较直接原型 | 它会遍历整个原型链。 |
| `constructor` 能可靠判断类型 | 它可被覆盖或伪造，只是惯例。 |
| 原型属性会复制到实例 | 不会复制；实例通过链查找共享访问。 |
| 原型链最终一定到 `Object.prototype` | `Object.create(null)` 的链可直接到 `null`。 |

## 最小实验

在浏览器控制台或 Node.js 中执行：

```js
function User(name) {
  this.name = name
}

User.prototype.sayHi = function () {
  return `Hi, ${this.name}`
}

const alice = new User('Alice')

console.log(Object.getPrototypeOf(alice) === User.prototype)
console.log(Object.getPrototypeOf(User) === Function.prototype)
console.log(Object.getPrototypeOf(User.prototype) === Object.prototype)
console.log(alice.hasOwnProperty('name'))
console.log(Object.hasOwn(alice, 'sayHi'))
console.log(alice instanceof User)
console.log(alice instanceof Object)
console.log(alice.sayHi())
```

建议逐行画出 `alice`、`User.prototype`、`Object.prototype` 与 `null` 的连接关系，再检查每个表达式从哪里找到属性。

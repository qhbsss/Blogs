---
title: "js逆向：js基础-函数进阶-原型链（prototype、__proto__、构造函数-this绑定对象）"
source: "https://ata.atatech.org/articles/11000219671#MjFiM2Zk"
author:
published:
created: 2026-09-02
description:
tags:
  - "clippings"
---
### 文章目录

- [一、js基础](https://blog.csdn.net/weixin_44238683/article/details/118503753#js_9)
- [二、js原型链](https://blog.csdn.net/weixin_44238683/article/details/118503753#js_25)
- - [1、原型链概念](https://blog.csdn.net/weixin_44238683/article/details/118503753#1_29)
		- [2、prototype（显示原型）、constructor（构造器）](https://blog.csdn.net/weixin_44238683/article/details/118503753#2prototypeconstructor_37)
		- [3、 `__proto__` (隐式原型)](https://blog.csdn.net/weixin_44238683/article/details/118503753#3__proto___53)
		- [4、原型链详解](https://blog.csdn.net/weixin_44238683/article/details/118503753#4_77)
- [三、函数进阶](https://blog.csdn.net/weixin_44238683/article/details/118503753#_139)
- [四、面向对象](https://blog.csdn.net/weixin_44238683/article/details/118503753#_208)
- - [1、封装](https://blog.csdn.net/weixin_44238683/article/details/118503753#1_209)
		- [2、继承](https://blog.csdn.net/weixin_44238683/article/details/118503753#2_398)
		- [3、多态](https://blog.csdn.net/weixin_44238683/article/details/118503753#3_458)
- [五、this与new](https://blog.csdn.net/weixin_44238683/article/details/118503753#thisnew_494)
- - [1、默认、隐式、显示绑定](https://blog.csdn.net/weixin_44238683/article/details/118503753#1_513)
		- [2、new绑定](https://blog.csdn.net/weixin_44238683/article/details/118503753#2new_542)
		- [3、箭头函数绑定](https://blog.csdn.net/weixin_44238683/article/details/118503753#3_554)

## 一、js基础

菜鸟教程 js基础（详细）
[https://www.runoob.com/js/js-tutorial.html](https://www.runoob.com/js/js-tutorial.html)

书籍推荐（深入）
[https://book.douban.com/subject/35175321/](https://book.douban.com/subject/35175321/)

js基础检测网址
[https://www.w3school.com.cn/quiz/quiz.asp?quiz=js](https://www.w3school.com.cn/quiz/quiz.asp?quiz=js)

## 二、js原型链

> 安全工程师，会在原型链路做一些手脚，且原型链用法居多，因此弄懂js原型链相对重要

## 1、原型链概念

1. 每个函数都有 `prototype` 和 `__proto__`
2. 每一个对象/构造函数实例（this也是对象）都有 `__proto__`
3. 实例的 `__proto__` 指向构造函数的 `prototype` 。这个称为构造函数的原型对象
4. js 引擎会沿着 `__proto__` -> `ptototype` 的顺序一直往上方查找，找到 `window.Object.prototype` 为止， `Object` 为原生底层对象，到这里就停止了查找， 如果没有找到，就会报错或者返回 undefined
5. 而构造函数的 `__proto__` 指向 Function.prototype �0�6 () { [native code] }
6. `__proto__` 是浏览器厂商实现的，W3C规范中并没有这个东西

## 2、prototype（显示原型）、constructor（构造器）

查看windows

- 仔细查看，可以看到这个windows包含了很多方法，属性

![在这里插入图片描述](redirect.png)
一个窗口有一个基类对象 `Object` ，并且有个 `prototype`,其中有个属性 `constructor`

1. 其中windows有个 `Object` ，翻译为“ `对象` ”
2. `对象` 有个 `prototype` ，这个单词称翻译为“ `显示原型` ”
3. `原型` 中有个“ `constructor` ”，翻译为“ `构造器` ” 可以看到构造器

最后得到一个 `[native code]` 表示浏览器底层实现的c++机器语言代码，这已经到达了底层代码

![在这里插入图片描述](redirect_1.png)

## 3、__proto__(隐式原型)

这个单词翻译过来，为 `隐式原型` ！！！！（联想到前面提到的 `prototype 显示原型` ）

有一句话，万物皆对象，那么，变量，函数，类，都存在此种说法

- 首先定义了a = 0，属于js基本数据类型 number类型
- 定义了一个b方法、dog类
- 然后打印三个对象的 `__proto__` 属性，b方法和dog类，直接输出到了c++底层代码部分
- 重点看a，打印的是一个 `Number` 对象，那么说明 `__proto__` 指向的是 `Number` 数据类型对象，展开 `Number` 对象可以看到其拥有 `__proto__`,
- 方法，和类原型
	![在这里插入图片描述](redirect_2.png)
	那么如果多打印一次此属性，可以发现 `constructor` 指向的是 `Object（）` ，对象！！！并且再无 `__proto__`
	![在这里插入图片描述](redirect_3.png)
	如果继续打印呢,可看到为空，那么这个其实已经结束，知道定位到 `window.Object.prototype` 为止
	![在这里插入图片描述](redirect_4.png)
	打印，prototype， `原型形态` ，可以看到a变量没有 `显示原型` ，只有函数类有
	![在这里插入图片描述](redirect_5.png)
	结论理解：

1、 `__proto__` 有点想下一级查找的意思，查找 `constructor`
2、每一个（函数，方法）构造器’ `constructor` '都有‘ `prototype` ’属性即 `显示原型`
3、层级查找直到windows.Object.prototype为止，此时打印显示原型 undefined，隐式原型为 null

![在这里插入图片描述](redirect_6.png)

## 4、原型链详解

### 4.1 原型

数组的构造函数是 Array; js中内置的；

var a = [1,2,3];
a.__proto__ === Array.prototype; // true
12

![在这里插入图片描述](redirect_7.png)

①所有引用类型都有一个_proto_(隐式原型)属性，属性值是一个普通的对象 (__proto__指向prototype,所以也可以说值直接是 prototype)
②所有函数都有一个prototype(原型)属性，属性值是一个普通的对象
③所有引用类型的__proto__属性指向它构造函数的prototype

### 4.2原型链

当访问一个对象的某个属性时，会先在这个对象本身属性上查找，如果没有找到，则会去它的 `_proto_ 隐式原型` 上查找，即它的构造函数的 `prototype` ，如果还没有找到就会再在构造函数的 `prototype` 的 `_proto_` 中查找，直到找到Object对象的原型， `Object对象的原型没有原型` ，如果在Object原型中依然没有找到，则返回undefined。这样一层一层向上查找就会形成一个链式结构，我们称为 `原型链` 。

```javascript
function Person(name) {
        this.name = name;
    }

    var child = new Person('小王')
```
12345

![在这里插入图片描述](redirect_8.png)
在child中查找某个属性时，会执行下面步骤 ：
![在这里插入图片描述](redirect_9.png)

访问链路：
![在这里插入图片描述](redirect_10.png)

①一直往上层查找，直到到null还没有找到，则返回 undefined
②Object.prototype.*proto* === null
③所有从原型或更高级原型中的得到、执行的方法，其中的this在执行时，指向当前这个触发事件执行的对象

总结：

- 1、构造函数就是 类
- 2、实例就是构造函数 new 出来的，也就是我们通常说的实例对象，这里的 person1 就是Person的实例。
- 3、对象数据类型（普通对象、实例、prototype，也就是所有引用类型的数据) 都有一个__proto__隐式原型，其值就是构造函数的prototype
- 4、原型对象中有一个属性，constructor，它指向构造函数本身;
- 5、构造函数中有一个 prototype 属性，指向实例原型，实例原型中又有一个constructor属性指向构造函数, 通过构造函数new出来的实例中有一个__proto__也指向实例原型(prototype)；

```javascript
function Person() {}
    var person = new Person()
    console.log(person.__proto__ === Person.prototype)//true
    console.log(Person.prototype.constructor===Person)//true
```
1234

![在这里插入图片描述](redirect_11.png)
Object是JS中所有对象数据类型的基类(最顶层的类)在Object.prototype上没有 `_proto_` 这个属性
![在这里插入图片描述](redirect_12.png)
相关文章：
[https://zhuanlan.zhihu.com/p/93263239](https://zhuanlan.zhihu.com/p/93263239)
[https://blog.csdn.net/MrWangJB/article/details/107932306](https://blog.csdn.net/MrWangJB/article/details/107932306)
[https://www.jianshu.com/p/72156bc03ac1](https://www.jianshu.com/p/72156bc03ac1)

## 三、函数进阶

JS中所有事物都是对象，对象是拥有属性和方法的数据。所以函数也是对象

当创建一个函数的时候，发生了什么？

实际上，函数是Function类型的实例，此时可以把每一个创建出来的函数，当成是Function类型的实例对象，所以函数本身拥有的对象属性，来源于FunctionFn. Constructor 即为 Function但是与此同时要注意：Function.prototype.**proto** === Object.prototype可以理解为：构造器函数的构造函数是Object
也可以简单的理解：函数即对象

## 1、构造函数

在js中，用new 关键字调用的函数，称为构造函数，构造函数一般大写，p为实例对象。

```javascript
function Person() {
        console.log('hello')
    }
    p = new Person()
```
1234
p.constructor.__proto__ === Function.prototype
true
12

- 1、当以 new 关键字调用时，会创建一个新的内存空间，标记为 Person 的实例
- 2、函数体内部的 this 指向该内存,每当创建一个实例的时候，就会创建一个新的内存空间
- 3、给 this 添加属性，就相当于给实例添加属性
- 4、由于函数体内部的this指向新创建的内存空间，默认返回 this ，就相当于默认返回了该内存空间

## 2、匿名函数

- **声明式**
	声明式会导致函数提升，function会被解释器优先编译。即我们用声明式写函数，可以在任何区域声明，不会影响我们调用
- **函数表达式**
	函数表达式我们经常使用，而函数表达式中的function则不会出现函数提升。而是JS解释器逐行解释，到了这一句才会解释。因此如果调用在函数表达式之前，则会调用失败。

```javascript
// 函数表达式
    a();
    function a() {
        console.log('aaaaaa')
    };
    // 声明式
    b();
    b = function () {
        console.log('bbbbb')
    }
```
12345678910

程序都是自上运行，在声明式中，因为执行到b()，还没有定义函数，则报错，但是a()是函数式，是全局可以调用的，这也就为什么在看js文件时候，发现一些函数写在最后，也能运行
![在这里插入图片描述](redirect_13.png)

匿名函数扩展

(function(){alert('111')})(); // 返回值
!function(){alert('111')}() //返回布尔值
12

三种函见匿名函数

```java
~function(){}()
-function(){}()
+function(){}()
```
123

## 四、面向对象

## 1、封装

定义：

> 把客观事物封装成抽象的类，隐藏属性和方法，仅对外公开接口。

> 在ES6之前，是不存在class这个语法糖类的。所以实现大多采用原型对象和构造函数
> 当你使用class的时候，它会默认调用constructor这个函数，来接收一些参数，并构造出一个新的实例对象(this)并将它返回，因此它被称为constructor构造方法(函数)

私有属性和方法

> 只能在构造函数内访问不能被外部所访问(在构造函数内使用var声明的属性)

公有属性和方法

> 对象外可以访问到对象内的属性和方法(在构造函数内使用this设置，或者设置在构造函数原型对象上比如Cat.prototype.xxx)

静态属性和方法

> 定义在构造函数上的方法(比如Cat.xxx)，不需要实例就可以调用(例如Object.assign())

### 1.1 私有属性

```javascript
function Person(name) {
        this.name = name;
        this.sex = 'man';
        var say = '我是稳稳';
        aa = 123;
        var pickNose = function () {
            console.log('我会吃饭，但是你看不见')
        };
        return name
    }
    var me = new Person('稳稳')
```
1234567891011

可以发现，其中say和pickNose并没有

- 这是因为，var声明了是私有属性

![在这里插入图片描述](redirect_14.png)

那么通过return也不能真正返回
![在这里插入图片描述](redirect_15.png)

### 1.2 特权方法

但是存在 `特权方法` （利用闭包概念）

1. 内部创建一个闭包,闭包可以访问私有变量;因此创建用于访问私有变量的公用方法，称作特权方法
2. 这种方法的缺点是会为每一个实例创建一组新的方法，不能实现共享。

```javascript
function People() {
        var name = '张三'; // 私有变量; 外部无法访问
        var age = '30';

        function say() {  // 私有函数;
            return '我是......';
        };

        this.getname = function () { // 对外公共的特权方法; 外部可以访问
            return name;
        };

        this.getsay = function () {
            return say()
        };
    }

    var p = new People();
    console.log(p.getname()); //张三
    console.log(p.getsay()); // 我是....
```
1234567891011121314151617181920

### 1.3 静态私有属性

1. 多个实例共享同个属性
2. 初始化未经声明的变量，总是会创建一个全局变量

```javascript
(function() {
    var privateVariable = 10;
    function privateFun() {
        return false;
    }
    // 构造函数
    myObject = function() {

    };
    myObject.prototype.publicMethod = function() {
        privateVariable++;
        return privateFun();
    }
})();
```
1234567891011121314

这个模式创建了一个私有作用域，并在其中封装了一个构造函数及相应的方法。在私有作用域中，首先定义了私有变量和私有函数，然后又定义了构造函数及其公有方法。公有方法是在原型上定义的，这一点体现了典型的原型模式。需要注意的是，这个模式在定义构造函数时并没有使用函数声明，而是使用了函数表达式。函数声明只能创建局部函数，但那并不是我们想要的。出于同样的原因，我们也没有在声明MyObject时使用var关键字。记住： `初始化未经声明的变量，总是会创建一个全局变量` 。因此，MyObject就成了一个全局变量，能够在私有作用域之外被访问到。但也要知道， `在严格模式下给未经声明的变量赋值会导致错误` 。

这个模式与在构造函数中定义特权方法的主要区别，就在于私有变量和函数是由实例共享的。由于特权方法是在原型上定义的，因此所有实例都使用同一个函数，而这个特权方法，作为闭包，总是保存着对包含作用域的引用。来看一看下面的代码。

```javascript
(function() {
    var name = "";
    Person = function(value) {
        name = value;
    };
    Person.prototype.setName = function(value) {
        name = value;
    }
    Person.prototype.getName = function() {
        return name;
    }
})();
```
123456789101112

![在这里插入图片描述](redirect_16.png)

> 这个例子中的Person构造函数与getName()和setName()方法一样，都有权访问私有变量name。在这种模式下，变量name就变成了一个静态的、由所有实例共享的属性。也就是说，在一个实力上调用setName()会影响所有实例。而调用setName()或新建一个Person实例都会赋予name属性一个新值。结果就是所有实例都会返回相同的值。
>
> 以这种方式创建静态私有变量会因为使用原型而增进代码复用，但 **每个实例都没有自己的私有变量。到底是使用实例变量，还是静态私有变量** ，最后还是要视你的具体需求而定。

### 1.4 模块模式

- 为单例创建私有变量和特权方法（即访问私有变量的方法）
- 只有一个实例对象，JS中的单例用对象字面量来表示

```javascript
var singleton = function() {
    var privateVariable = 10;
    function privateFun() {
        return false;
    }

    return { // 返回的对象字面量中只包含可以公开的属性和方法
        publicProperty: privateVariable,
        publicMethod: function() {
            privateVariable++;
            return privateFun();
        }
    };
}();
```
singleton
123456789101112131415

这个模块模式使用了一个返回对象的匿名函数。在这个匿名函数内部，首先定义了私有变量和函数。然后，将一个对象字面量最为函数的值返回。返回的对象字面量中只包含可以公开的属性和方法。由于这个对象是在匿名函数内部定义的，因此它的公有方法有权访问私有变量和函数。从本质上来讲，这个对象字面量定义的是单例的公共接口。这种模式在需要对单例进行某些初始化，同时又需要维护其私有变量时时非常有用的，例如：

```javascript
var application = function(){
    // 私有变量和函数
    var components = new Array();
    //初始化
    components.push(new BaseComponent());
    //公共
    return {
        getComponentCount: function(){
            return components.length;
        },
        registerComponent:function(component){
            if(typeof component == "object"){
                components.push(component);
            }
        }
    };
}()
1234567891011121314151617

```

在web应用程序中，经常需要使用一个单例来管理应用程序级的信息。这个简单的例子创建了一个用于管理组件的application对象。在创建这个对象的过程中，首先声明了一个私有的components数组，并向数组中添加了一个BaseComponent的新实例(在这里不需要关心BaseComponent的代码，我们只是用它来展示初始化操作)。而返回对象的getComponentCount()和registerComponent()方法，都是有权访问数组components的特权方法。前者只是返回已注册的组件数目，后者用于注册新组件。

简言之，如果必须创建一个对象并以某些数据对其进行初始化，同时还要公开一些能够访问这些私有数据的方法，那么久可以使用模块模式。以这种模式创建的每个单例都是object的实例，因为最终要通过一个对象字面量来表示他。事实上，这也没有什么；毕竟，单例通常都是作为全局对象存在的，我们不会将它传递给一个函数。因此，也就没有什么必要使用instanceof操作符来检查其对象类型了。


### 1.5 增强模块模式

- 模块实例+单例必须是某种类型的实例

```javascript
var singleton = function() {
    var privateVariable = 10;
    function privateFun() {
        return false;
    }

    // 创建对象
    var object = new customType(); // customType为一个对象类型, 暂且用new Object()代替
    object.publicProperty = privateVariable;
    object.publicMethod = function() {
        privateVariable++;
        return privateFun();
    };

    return object;
}();
```
12345678910111213141516

## 2、继承

继承就是子类可以使用父类的所有功能，并且对这些功能进行扩展

比如我有个构造函数A，然后又有个构造函数B，但是B想要使用A里的一些属性和方法，一种办法就是让我们自身化身为CV侠，复制粘贴一波。还有一种就是利用继承，我让B直接继承了A里的功能，这样我就能用它了。

1. 原型链继承
2. 构造继承
3. 组合继承
4. 寄生组合继承
5. 原型式继承
6. 寄生继承
7. 混入式继承
8. class中的extends继a承

以下讲常见用的最多的

### 2.1 原型链继承

```javascript
function Parent(){
    this.name ='Parent';
    this.sex = 'box';
}
function Child(){
    this.name = 'child';
}
// 继承
Child.prototype = new Parent() //指定原型对象，匿名实例
var child1 = new Child()
```
child1.__proto__
child1.sex
123456789101112

在Child中有 `name` 属性，但是没有 `sex` 属性，在设置继承后，先是打印 `name` ，会直接到 `child1` 实例对象查找，查找到了，所以输出为“ `child` ”，那么打印 `sex` 时候， `child1` 实例对象并没有，于是 `__proto__` 继续查找，其 `显示原型` ，即构造函数的 `prototype`,于是在 `显示原型` 找到了 `sex` ，输出 `box`
![在这里插入图片描述](redirect_17.png)

### 2.2 class类继承：extends、super()

class Parent {
        constructor(name) {
            this.name = name
```javascript
        }
        getName() {
            console.log(this.name)
        }
    }

    class Child extends Parent {
        constructor(name) {
            super(name)
```
            this.sex = 'boy'
```java
        }
    }
    child = new Child('儿子')
```
12345678910111213141516

![在这里插入图片描述](redirect_18.png)
相关文章
[https://www.cnblogs.com/ndos/p/8138263.html](https://www.cnblogs.com/ndos/p/8138263.html)
![在这里插入图片描述](redirect_19.png)

## 3、多态

多态的实际含义是：同一操作作用于不同的对象上，可以产生不同的解释和不同的执行结果。

```javascript
function makeSound(animal) {
        if (animal.sound instanceof Function) { // 判断是否有animal.sound且该属性为函数
            animal.sound()
        }
    }

    class Cat {
        sound() {
            console.log('喵喵喵～')
        }
    }

    class Dog {
        sound() {
            console.log('汪汪汪！')
        }
    }

    class Pig {
        sound() {
            console.log('啂妮妮')
        }
    }
    makeSound(new Cat()); // '喵喵喵～'
    makeSound(new Dog()); // '汪汪汪！'
    makeSound(new Pig()) // '啂妮妮'
```
1234567891011121314151617181920212223242526

[https://juejin.cn/post/6844904126011146254](https://juejin.cn/post/6844904126011146254)

## 五、this与new

目的：js代码中，会存在大量的this，需要缕清楚才能读懂代码

this，是指当前的本身，在非严格模式下this指向的是全局对象window，而在严格模式下会绑定到undefined。

this 永远指向最后调用它的那个对象

this的5种绑定方式：

1. 默认绑定(非严格模式下this指向全局对象, 严格模式下this会绑定到undefined)
2. 隐式绑定(当函数引用有上下文对象时, 如 obj.foo()的调用方式, foo内的this指向obj)
3. 显示绑定(通过call()或者apply()方法直接指定this的绑定对象, 如foo.call(obj))
4. new绑定
5. 箭头函数绑定(this的指向由外层作用域决定的)

相关文章（练习下面这个网址所有题目就能搞明白了~~）

[https://juejin.cn/post/6844904083707396109#heading-15](https://juejin.cn/post/6844904083707396109#heading-15)

## 1、默认、隐式、显示绑定

**默认绑定**:
当没有对象调用的时候，都是指向windows

**隐式绑定** ：
this 永远指向最后调用它的那个对象

**隐式绑定丢失问题** ：

- 使用另一个变量来给函数取别名
- 将函数作为参数传递时会被隐式赋值，回调函数丢失this绑定

**显示绑定** ：

1. 都是对函数的操作，使用方式：函数.call
2. 都是用来改变函数的 this 对象的指向的。
3. 第一个参数都是 this 要指向的对象。
4. 都可以利用后续参数传参。
5. call 接受函数传参方式为：fn.call(this, 1, 2, 3)
6. apply 接受函数传参方式为：fn.apply(this,[1, 2, 3])
7. bind 的返回值为一个新的函数，需要再次调用： fn.bind(this)(1, 2, 3)

**总结** ：

- this 永远指向最后调用它的那个对象
- 匿名函数的this永远指向window
- 使用.call()或者.apply()的函数是会直接执行的
- bind()是创建一个新的函数，需要手动调用才会执行
- 如果call、apply、bind接收到的第一个参数是空或者null、undefined的话，则会忽略这个参数
- forEach、map、filter函数的第二个参数也是能显式绑定this的

## 2、new绑定

`new` 会将构造函数，实例成实例函数，绑定到实例对象

function Person (name) {
  this.name = name
}
var name = 'window'
var person1 = new Person('LinDaiDai')
console.log(person1.name) //LinDaiDai
123456

## 3、箭头函数绑定

在前面 `this永远指向最后调用它的那个对象` 。 但对于箭头函数来说不是的， `它里面的this是由外层作用域来决定的` ，且指向函数定义时的this而非执行时。

var name = 'window'
```javascript
var obj1 = {
    name: 'obj1',
    foo: function () {
        console.log(this.name)
    }
}

var obj2 = {
    name: 'obj2',
    foo: () => {
        console.log(this.name)
    }
}

obj1.foo() //obj1
obj2.foo() //window
```
1234567891011121314151617

```javascript

```

不使用箭头函数的obj1.foo()是由obj1调用的，所以this.name为obj1。 使用箭头函数的obj2.foo()的外层作用域是window，所以this.name为window。


```javascript
var obj = {
  name: 'obj',
  foo1: () => {
    console.log(this.name)
  },
  foo2: function () {
    console.log(this.name)
    return () => {
      console.log(this.name)
    }
  }
}

```
var name = 'window'
```java
obj.foo1() //windwos
obj.foo2()() // obj obj

```

对于obj.foo1()函数的调用，它的外层作用域是window，对象obj当然不属于作用域了(我们知道作用域只有全局作用域window和局部作用域函数)。所以会打印出window
obj.foo2()()，首先会执行obj.foo2()，这不是个箭头函数，所以它里面的this是调用它的obj对象，因此打印出obj，而返回的匿名函数是一个箭头函数，它的this由外层作用域决定，那也就是函数foo2，那也就是它的this会和foo2函数里的this一样，就也打印出了obj。

123456789101112131415161718
var name = 'window'
```javascript
var obj1 = {
  name: 'obj1',
  foo: function () {
    console.log(this.name)
    return function () {
      console.log(this.name)
    }
  }
}
var obj2 = {
  name: 'obj2',
  foo: function () {
    console.log(this.name)
    return () => {
      console.log(this.name)
    }
  }
}
var obj3 = {
  name: 'obj3',
  foo: () => {
    console.log(this.name)
    return function () {
      console.log(this.name)
    }
  }
}
var obj4 = {
  name: 'obj4',
  foo: () => {
    console.log(this.name)
    return () => {
      console.log(this.name)
    }
  }
}

obj1.foo()() // 'obj1' 'window'
obj2.foo()() // 'obj2' 'obj2'
obj3.foo()() // 'window' 'window'
obj4.foo()() // 'window' 'window'

obj1.foo()()两层都是普通函数，类似于题目4.6，分别打印出obj1和window。
obj2.foo()()外层为普通函数，内层为箭头，类似于题目7.1，都是打印出obj2。
obj3.foo()()外层为箭头函数，内层为普通函数，箭头函数的this由外层作用域决定，因此为window，内层普通函数由调用者决定，调用它的是window，因此也为window。
obj4.foo()()两层都是箭头函数，第一个箭头函数的this由外层作用域决定，因此为window，第二个箭头函数的this也由外层作用域决定，它的外层作用域是第一个箭头函数，而第一个箭头函数的this是window，因此内层的this也是window。
```
1234567891011121314151617181920212223242526272829303132333435363738394041424344454647
var name = 'window'
function Person (name) {
  this.name = name
```javascript
this.foo1 = function () {
    console.log(this.name)
}
this.foo2 = () => {
    console.log(this.name)
}
}
var person2 = {
    name: 'person2',
    foo2: () => {
        console.log(this.name)
    }
}
var person1 = new Person('person1')
person1.foo1() // person1
person1.foo2() // person1
person2.foo2() // window

person1.foo1()是个普通函数，this由最后调用它的对象决定，即person1。
person1.foo2()为箭头函数，this由外层作用域决定，且指向函数定义时的this而非执行时，在这里它的外层作用域是函数Person，且这个是构造函数，并且使用了new来生成了对象person1，所以此时this的指向是为person1。
person2.foo2()字面量创建的的对象person2中的foo2是个箭头函数，由于person2是直接在window下创建的，你可以理解为它所在的作用域就是在window下，因此person2.foo2()内的this应该是window。
```
12345678910111213141516171819202122232425
var name = 'window'
function Person (name) {
  this.name = name
```javascript
  this.foo1 = function () {
    console.log(this.name)
    return function () {
      console.log(this.name)
    }
  }
  this.foo2 = function () {
    console.log(this.name)
    return () => {
      console.log(this.name)
    }
  }
  this.foo3 = () => {
    console.log(this.name)
    return function () {
      console.log(this.name)
    }
  }
  this.foo4 = () => {
    console.log(this.name)
    return () => {
      console.log(this.name)
    }
  }
}
var person1 = new Person('person1')
person1.foo1()() // 'person1' 'window'
person1.foo2()() // 'person1' 'person1'
person1.foo3()() // 'person1' 'window'
person1.foo4()() // 'person1' 'person1'
```
123456789101112131415161718192021222324252627282930313233

箭头函数的this无法通过bind、call、apply来直接修改，但是可以通过改变作用域中this的指向来间接修改。

var name = 'window'
```javascript
var obj1 = {
  name: 'obj1',
  foo1: function () {
    console.log(this.name)
    return () => {
      console.log(this.name)
    }
  },
  foo2: () => {
    console.log(this.name)
    return function () {
      console.log(this.name)
    }
  }
}
var obj2 = {
```
  name: 'obj2'
```java
}
obj1.foo1.call(obj2)()
obj1.foo1().call(obj2)
obj1.foo2.call(obj2)()
obj1.foo2().call(obj2)
```


答案：
```java
// 'obj2' 'obj2'
// 'obj1' 'obj1'
// 'window' 'window'
// 'window' 'obj2'
```


obj1.foo1.call(obj2)()第一层为普通函数，并且通过.call改变了this指向为obj2，所以会打印出obj2，第二层为箭头函数，它的this和外层作用域中的this相同，因此也是obj2。
obj1.foo().call(obj2)第一层打印出obj1，第二层为箭头函数，使用了.call想要修改this的指向，但是并不能成功，因此.call(obj2)对箭头函数无效，还是打印出obj1。
obj1.foo2.call(obj2)()第一层为箭头函数，并且想要通过.call(obj2)改变this指向，但是无效，且它的外层作用域是window，所以会打印出window，第二层为普通函数，this是最后调用者window，所以也会打印出window。
obj1.foo2().call(obj2)第一层为箭头函数，外层作用域是window，打印出window，第二层为普通函数，且使用了.call(obj2)来改变this指向，所以打印出了obj2。


在这道题中，obj1.foo1.call(obj2)()就相当于是通过改变作用域间接改变箭头函数内this的指向。
123456789101112131415161718192021222324252627282930313233343536373839404142

**避免使用的场景**

1.使用箭头函数定义对象的方法

```javascript
let obj = {
    value: 'LinDaiDai',
    getValue: () => console.log(this.value)
}
obj.getValue() // undefined
```
12345

2.定义原型方法

function Foo (value) {
    this.value = value
```javascript
}
Foo.prototype.getValue = () => console.log(this.value)

const foo1 = new Foo(1)
foo1.getValue() // undefined
```

12345678

3.构造函数使用箭头函数

```javascript
const Foo = (value) => {
    this.value = value;
}
const foo1 = new Foo(1)
// 事实上直接就报错了 Uncaught TypeError: Foo is not a constructor
console.log(foo1);
```

1234567

4.作为事件的回调函数

```javascript
const button = document.getElementById('myButton');
button.addEventListener('click', () => {
    console.log(this === window); // => true
    this.innerHTML = 'Clicked button';
});

var circle = {
    radius: 10,
    getRadius() {
        console.log(this.radius);
    }
};
circle.getRadius(); // 打印 10

// 使用临时变量self
var circle = {
    radius: 10,
    outerDiameter() {
        var self = this;
        var innerDiameter = function() {
            console.log(2 * self.radius);
        };
        innerDiameter();
    }
};
circle.outerDiameter(); // 打印20

// innerDiameter函数中的this是window
var circle = {
    radius: 10,
    outerDiameter() {
        var innerDiameter = function() {
            console.log(this === window);
        };
        innerDiameter();
    }
};
circle.outerDiameter(); // 打印true

// 使用普通函数
var circle = {
    radius: 10,
    outerDiameter() {
        var innerDiameter = function() {
            console.log(2 * this.radius);
        };
        innerDiameter();
    }
};
circle.outerDiameter(); // 打印NaN

// 使用.bind(this)
var circle = {
    radius: 10,
    outerDiameter() {
        var innerDiameter = function() {
            console.log(2 * this.radius);
        };
        innerDiameter = innerDiameter.bind(this);
        innerDiameter();
    }
};
circle.outerDiameter(); // 打印20

// 使用箭头函数
var circle = {
    radius: 10,
    outerDiameter() {
        var innerDiameter = () => {
            console.log(2 * this.radius);
        };
        innerDiameter();
    }
};
circle.outerDiameter(); // 打印20
```

#### 备注： 文章为csdn拷贝而来！！！由于之前找的，现在作者已经删掉了文章，无法放原链

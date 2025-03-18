[TOC]

![image-20241029164737507](C:\Users\dell\AppData\Roaming\Typora\typora-user-images\image-20241029164737507.png)

# 数据结构

## 列表和元组

列表和元组，都是**一个可以放置任意数据类型的有序集合**。

- **列表是动态的**，长度大小不固定，可以随意地增加、删减或者改变元素（mutable）。

  Python列表在内存中是通过动态数组的方式进行存储的、每个元素在列表中是通过引用进行存储的、列表在扩展时会进行动态分配内存。

  Python列表是通过动态数组来实现的。这意味着列表在内存中是一块连续的内存空间，这块内存空间不仅存储了列表的元素，还存储了一些额外的信息，比如当前列表的大小和容量。

  1. **内存布局**：在内存中，Python列表的存储包括三个部分：
     - **指针数组**：指向实际元素的指针数组。
     - **元素存储区**：实际存储列表元素的内存区域。
     - **元数据**：包括列表的大小和容量。
  2. **扩展机制**：由于列表的大小是动态的，因此在添加新元素时，列表可能需要扩展。如果当前容量不足以容纳新元素，Python会分配一个更大的内存空间，并将现有元素复制到新的内存空间。这种扩展机制通常会以一定的比例（通常是1.125倍）进行，以减少频繁的内存分配操作，从而提高效率。

  > ```c
  > typedef struct {
  >     PyObject_VAR_HEAD
  >     /* Vector of pointers to list elements.  list[0] is ob_item[0], etc. */
  >     PyObject **ob_item;
  >     /* ob_item contains space for 'allocated' elements.  The number
  >      * currently in use is ob_size.
  >      * Invariants:
  >      *     0 <= ob_size <= allocated
  >      *     len(list) == ob_size
  >      *     ob_item == NULL implies ob_size == allocated == 0
  >      * list.sort() temporarily sets allocated to -1 to detect mutations.
  >      *
  >      * Items must normally not be NULL, except during construction when
  >      * the list is not yet visible outside the function that builds it.
  >      */
  >     Py_ssize_t allocated;
  > } PyListObject;
  > ```
  >
  > list 本质上是一个长度可变的连续数组。
  >
  > 其中 ob_item 是一个指针列表，里边的每一个指针都指向列表中的元素，而 allocated 则用于存储该列表目前已被分配的空间大小。
  >
  > 需要注意的是，allocated 和列表的实际空间大小不同，列表实际空间大小，指的是 len(list) 返回的结果，也就是上边代码中注释中的 ob_size，表示该列表总共存储了多少个元素。
  >

- **而元组是静态的**，长度大小固定，无法增加删减或者改变（immutable）。

  > ```c
  > typedef struct {
  >     PyObject_VAR_HEAD
  >     PyObject *ob_item[1];
  >     /* ob_item contains space for 'ob_size' elements.
  >      * Items must normally not be NULL, except during construction when
  >      * the tuple is not yet visible outside the function that builds it.
  >      */
  > } PyTupleObject;
  > ```
  >
  > `tuple` 和 `list` 相似，本质也是一个数组，但是空间大小固定。不同于一般数组，Python 的 tuple 做了许多优化，来提升在程序中的效率。

> `PyObject *ob_item[1]` 和 `PyObject **ob_item` 是两种不同的指针类型，它们在用法和内存管理上有显著区别。以下是它们的主要区别：
>
> 1. **类型**：
>    - `PyObject *ob_item[1]`：这是一个数组类型，表示一个具有固定大小（在这个例子中是 1）的 `PyObject *` 指针数组。通常用于表示一个包含 `PyObject *` 指针的数组，但数组的大小在编译时是固定的。
>    - `PyObject **ob_item`：这是一个指向指针的指针，通常用于动态分配内存或表示一个不定大小的 `PyObject *` 指针数组。可以用来访问或修改指向的数组的大小和内容。
> 2. **内存管理**：
>    - 使用 `PyObject *ob_item[1]` 时，数组的大小在编译时是固定的，通常在结构体中作为一种技巧来创建可变大小的数组。它通常用作结构体的最后一个成员，配合其他成员一起使用。
>    - 使用 `PyObject **ob_item` 时，可以通过动态内存分配（如 `malloc` 或 `calloc`）来创建任意大小的数组，使用后需要手动释放内存。
> 3. **使用场景**：
>    - `PyObject *ob_item[1]` 通常在需要固定大小或作为结构体中的成员时使用，通常是为了在堆栈上或结构体中高效地管理数据。
>    - `PyObject **ob_item` 则更灵活，适合需要动态大小的场景，例如在运行时确定数组大小。
>
> 总结来说，`PyObject *ob_item[1]` 是一个固定大小的数组，而 `PyObject **ob_item` 是一个指向指针的指针，允许动态管理指针数组的大小和内容。

### 字典和集合

字典是一系列由键（key）和值（value）配对组成的元素的集合，在 Python3.7+，字典被确定为有序（注意：在 3.6 中，字典有序是一个 implementation detail，在 3.7 才正式成为语言特性，因此 3.6 中无法 100% 确保其有序性），而 3.6 之前是无序的，其长度大小可变，元素可以任意地删减和改变。

集合和字典基本相同，唯一的区别，就是集合没有键和值的配对，是一系列无序的、唯一的元素组合。

不同于其他数据结构，字典和集合的内部结构都是一张哈希表。

- 对于字典而言，这张表存储了哈希值（hash）、键和值这 3 个元素。
- 而对集合来说，区别就是哈希表内没有键和值的配对，只有单一的元素了。

为了提高存储空间的利用率，现在的哈希表除了字典本身的结构，会把索引和哈希值、键、值单独分开，也就是下面这样新的结构：

```
Indices
----------------------------------------------------
None | index | None | None | index | None | index ...
----------------------------------------------------
 
Entries
--------------------
hash0   key0  value0
---------------------
hash1   key1  value1
---------------------
hash2   key2  value2
---------------------
        ...
---------------------
```

### 字符串

字符串是由独立字符组成的一个序列，通常包含在单引号（`''`）双引号（`""`）或者三引号之中（`''' '''`或`""" """`，两者一样）

可以把字符串想象成一个由单个字符组成的数组，所以，Python 的字符串同样支持索引，切片和遍历等等操作。

Python 的字符串是不可变的（immutable）。Python 中字符串的改变，通常只能通过创建新的字符串来完成。

> 使用加法操作符`'+='`的字符串拼接方法。因为它是一个例外，打破了字符串不可变的特性。
>
> eg:
>
> ```
> s = ''
> for n in range(0, 100000):
>     s += str(n)
> ```
>
> 每次循环，似乎都得创建一个新的字符串；而每次创建一个新的字符串，都需要 O(n) 的时间复杂度。因此，总的时间复杂度就为 O(1) + O(2) + … + O(n) = O(n^2)。这样到底对不对呢？
>
> 乍一看，这样分析确实很有道理，但是必须说明，这个结论只适用于老版本的 Python 了。自从 Python2.5 开始，每次处理字符串的拼接操作时（str1 += str2），Python 首先会检测 str1 还有没有其他的引用。如果没有的话，就会尝试原地扩充字符串 buffer 的大小，而不是重新分配一块内存来创建新的字符串并拷贝。这样的话，上述例子中的时间复杂度就仅为 O(n) 了。

# 面向对象

## 自定义函数

```python
def name(param1, param2, ..., paramN):
    statements
    return/yield value # optional
```

在 Python 中，函数是一等公民（first-class citizen），函数也是对象。我们可以把函数赋予变量

```python
def func(message):
    print('Got a message: {}'.format(message))
    
send_message = func
send_message('hello world')
 
# 输出
Got a message: hello world
```

可以把函数当作参数，传入另一个函数中

```python
def get_message(message):
    return 'Got a message: ' + message
 
 
def root_call(func, message):
    print(func(message))
    
root_call(get_message, 'hello world')
 
# 输出
Got a message: hello world
```



### 调用顺序

def 是可执行语句，这意味着函数直到被调用前，都是不存在的。当程序调用函数时，def 语句才会创建一个新的函数对象，并赋予其名字。

>这句话的意思是，在 Python 中，**函数的定义（使用 `def` 关键字）并不会立即创建函数对象，而是在运行到该定义时才会创建**。换句话说，函数在被调用之前并不存在。
>
>### 具体解释
>
>- **与编译型语言的区别**：在编译型语言（如 C 语言）中，函数的声明和定义会在编译时进行处理，编译器会在编译阶段检查所有函数的存在性和类型。这意味着在编译期间，所有函数都已经被定义和处理。
>
>- **Python 的动态特性**：而在 Python 中，`def` 语句是一个可执行语句，当解释器运行到 `def` 语句时，它才会创建函数对象并将其绑定到指定的名称。这意味着如果在定义之前尝试调用该函数，程序会抛出一个错误，因为此时函数还未被定义。
>
>### 举个例子
>
>```python
>def my_function():
>    print("Hello, World!")
>
># 在这里，my_function 已经被定义，可以被调用
>my_function()  # 输出: Hello, World!
>```
>
>如果尝试在 `def` 之前调用 `my_function`，比如：
>
>```python
>my_function()  # 会抛出 NameError，因为函数尚未定义
>
>def my_function():
>    print("Hello, World!")
>```
>
>在这种情况下，Python 会抛出一个 `NameError`，因为在调用时 `my_function` 并不存在。这种特性使得 Python 具有很强的动态性，可以在运行时定义和修改函数。

但是，如果在函数内部调用其他函数，函数间哪个声明在前、哪个在后就无所谓，因为 def 是可执行语句，函数在调用之前都不存在，只需保证调用时，所需的函数都已经声明定义：

>在 Python 中，函数的定义顺序不影响它们在函数内部的相互调用，因为只要调用时所有函数都已经定义过，就不会出错。这是因为 Python 会在执行代码时逐行处理 `def` 语句，所以**即使函数相互调用，只要在调用它们之前都已经被定义了**，那么这些函数就可以正常调用。
>
>### 具体解释
>
>1. **顺序无关**：因为 `def` 是一个可执行语句，Python 解释器会在运行时逐行定义函数，并将其名称绑定到函数对象。只要代码在调用函数之前已经执行完 `def` 语句，函数就可以正常调用。所以，函数之间的定义顺序无所谓。
>2. **内部调用的时机**：函数内的代码（包括其他函数的调用）只有在该函数被调用时才会执行。所以，即便函数内部调用了其他函数，这些被调用的函数不需要先定义在外层函数的前面，只需要在调用时它们已经定义即可。
>
>eg:
>
>```python
>def my_func(message):
>    my_sub_func(message) # 调用 my_sub_func() 在其声明之前不影响程序执行
>    
>def my_sub_func(message):
>    print('Got a message: {}'.format(message))
> 
>my_func('hello world')
> 
># 输出
>Got a message: hello world
>```
>
>```python
>def my_func(message):
>    my_sub_func(message) # 调用 my_sub_func() 在其声明之前不影响程序执行
>    
>my_func('hello world')
>
>def my_sub_func(message):
>    print('Got a message: {}'.format(message))
># 输出
>NameError: name 'my_sub_func' is not defined
>```

### 多态

Python 和其他语言相比的一大特点是，Python 是 dynamically typed 的，可以接受任何数据类型（整型，浮点，字符串等等）。对函数参数来说，这一点同样适用。Python 不用考虑输入的数据类型，而是将其交给具体的代码去判断执行，同样的一个函数，可以同时应用在整型、列表、字符串等等的操作中。在编程语言中，我们把这种行为称为**多态**。这也是 Python 和其他语言，比如 Java、C 等很大的一个不同点。当然，Python 这种方便的特性，在实际使用中也会带来诸多问题。因此，必要时请你在开头加上数据的类型检查。

### 函数嵌套

Python 函数的另一大特性，是 Python 支持函数的嵌套。所谓的函数嵌套，就是指函数里面又有函数。

其实，函数的嵌套，主要有下面两个方面的作用。

第一，函数的嵌套能够保证内部函数的隐私。内部函数只能被外部函数所调用和访问，不会暴露在全局作用域，因此，如果你的函数内部有一些隐私数据（比如数据库的用户、密码等），不想暴露在外，那你就可以使用函数的的嵌套，将其封装在内部函数中，只通过外部函数来访问。

第二，合理的使用函数嵌套，能够提高程序的运行效率。

### 函数变量作用域

Python 函数中变量的作用域和其他语言类似。如果变量是在函数内部定义的，就称为局部变量，只在函数内部有效。一旦函数执行完毕，局部变量就会被回收，无法访问。

相对应的，全局变量则是定义在整个文件层次上的，可以在文件内的任何地方被访问，当然在函数内部也是可以的。不过，我们**不能在函数内部随意改变全局变量的值**。这是因为，Python 的解释器会默认函数内部的变量为局部变量，但是又发现局部变量并没有声明，因此就无法执行相关操作。所以，如果我们一定要在函数内部改变全局变量的值，就必须加上 global 这个声明。这里的 global 关键字，并不表示重新创建了一个全局变量，而是告诉 Python 解释器，函数内部的变量 就是之前定义的全局变量，并不是新的全局变量，也不是局部变量。这样，程序就可以在函数内部访问全局变量，并修改它的值了。

如果遇到函数内部局部变量和全局变量同名的情况，那么在函数内部，局部变量会覆盖全局变量。

对于嵌套函数来说，内部函数可以访问外部函数定义的变量，但是无法修改，若要修改，必须加上 nonlocal 这个关键字。如果不加上 nonlocal 这个关键字，而内部函数的变量又和外部函数变量同名，那么同样的，内部函数变量会覆盖外部函数的变量。

### 闭包

闭包其实和刚刚讲的嵌套函数类似，不同的是，这里外部函数返回的是一个函数，而不是一个具体的值。返回的函数通常赋于一个变量，这个变量可以在后面被继续执行调用。

eg:

```python
def nth_power(exponent):
    def exponent_of(base):
        return base ** exponent
    return exponent_of # 返回值是 exponent_of 函数
 
square = nth_power(2) # 计算一个数的平方
cube = nth_power(3) # 计算一个数的立方 
square
# 输出
<function __main__.nth_power.<locals>.exponent(base)>
 
cube
# 输出
<function __main__.nth_power.<locals>.exponent(base)>
 
print(square(2))  # 计算 2 的平方
print(cube(2)) # 计算 2 的立方
# 输出
4 # 2^2
8 # 2^3
```

## 匿名函数

```python
lambda argument1, argument2,... argumentN : expression
```

匿名函数的关键字是 lambda，之后是一系列的参数，然后用冒号隔开，最后则是由这些参数组成的表达式。

**第一，lambda 是一个表达式（expression），并不是一个语句（statement）**。

lambda 可以用在一些常规函数 def 不能用的地方，比如，lambda 可以用在列表内部，而常规函数却不能; 

lambda 可以被用作某些函数的参数，而常规函数 def 也不能;

常规函数 def 必须通过其函数名被调用，因此必须首先被定义。但是作为一个表达式的 lambda，返回的函数对象就不需要名字了。

**第二，lambda 的主体是只有一行的简单表达式，并不能扩展成一个多行的代码块。**

### python函数式编程

所谓函数式编程，是指代码中每一块都是不可变的（immutable），都由纯函数（pure function）的形式组成。这里的纯函数，是指函数本身相互独立、互不影响，对于相同的输入，总会有相同的输出，没有任何副作用。

Python 主要提供了这么几个函数：map()、filter() 和 reduce()，通常结合匿名函数 lambda 一起使用。

map(function, iterable) 函数，表示对 iterable 中的每个元素，都运用 function 这个函数，最后返回一个新的可遍历的集合。

filter(function, iterable) 函数，它和 map 函数类似，function 同样表示一个函数对象。filter() 函数表示对 iterable 中的每个元素，都使用 function 判断，并返回 True 或者 False，最后将返回 True 的元素组成一个新的可遍历的集合。

reduce(function, iterable) 函数，它通常用来对一个集合做一些累积操作。function 同样是一个函数对象，规定它有两个参数，表示对 iterable 中的每个元素以及上一次调用后的结果，运用 function 进行计算，所以最后返回的是一个单独的数值。

## 类

- 类：一群有着相似性的事物的集合，这里对应 Python 的 class。

- 对象：集合中的一个事物，这里对应由 class 生成的某一个 object。
- 属性：对象的某个静态特征。

> 如果一个属性以 __ （注意，此处有两个 _） 开头，我们就默认这个属性是私有属性。

- 函数：对象的某个动态能力。

>类函数、成员函数和静态函数三个概念, 前两者产生的影响是动态的，能够访问或者修改对象的属性；而静态函数则与类没有什么关联，最明显的特征便是，静态函数的第一个参数没有任何特殊性。
>
>一般而言，静态函数可以用来做一些简单独立的任务，既方便测试，也能优化代码结构。静态函数还可以通过在函数前一行加上 @staticmethod 来表示。
>
>而类函数的第一个参数一般为 cls，表示必须传一个类进来。类函数最常用的功能是实现不同的 **init** 构造函数。类似的，类函数需要装饰器 @classmethod 来声明。如果是类调用该函数，cls指的是这个类*如果是对象调用该函数，cls指得就是这个对象的类型
>
>成员函数则是我们最正常的类的函数，它不需要任何装饰器声明，第一个参数 self 代表当前对象的引用，可以通过此函数，来实现想要的查询 / 修改类的属性等功能。

### 继承

每个类都有构造函数，继承类在生成对象的时候，是不会自动调用父类的构造函数的，因此你必须在 **init**() 函数中显式调用父类的构造函数。它们的执行顺序是 子类的构造函数 -> 父类的构造函数。

### 抽象函数和抽象类

抽象类是一种特殊的类，它生下来就是作为父类存在的，一旦对象化就会报错。同样，抽象函数定义在抽象类之中，子类必须重写该函数才能使用。相应的抽象函数，则是使用装饰器 @abstractmethod 来表示。

### 模块化

通常，一个 Python 文件在运行的时候，都会有一个运行时位置，最开始时即为这个文件所在的文件夹。当然，这个运行路径以后可以被改变。运行 `sys.path.append("..")` ，则可以改变当前 Python 解释器的位置。

对于一个独立的项目，所有的模块的追寻方式，最好从项目的根目录开始追溯，这叫做相对的绝对路径。以项目的根目录作为最基本的目录，所有的模块调用，都要通过根目录一层层向下索引的方式来 import。

Python 解释器在遇到 import 的时候，它会在一个特定的列表中寻找模块。这个特定的列表，可以用下面的方式拿到：

```python
import sys  
 
print(sys.path)
 
########## 输出 ##########
 
['', '/usr/lib/python36.zip', '/usr/lib/python3.6', '/usr/lib/python3.6/lib-dynload', '/usr/local/lib/python3.6/dist-packages', '/usr/lib/python3/dist-packages']
```

#### 神奇的 `if __name__ == '__main__'`

Python 是脚本语言，和 C++、Java 最大的不同在于，不需要显式提供 main() 函数入口。

import 在导入文件的时候，会自动把所有暴露在外面的代码全都执行一遍。因此，如果你要把一个东西封装成模块，又想让它可以执行的话，你必须将要执行的代码放在 `if __name__ == '__main__'`下面。`__name__` 作为 Python 的魔术内置参数，本质上是模块对象的一个属性。我们使用 import 语句时，`__name__` 就会被赋值为该模块的名字，自然就不等于 `__main__`了。

>每个python模块（python文件）都包含内置的变量 __name__，当该模块被直接执行的时候，__name__ 等于文件名（包含后缀 .py ）；如果该模块 import 到其他模块中，则该模块的 __name__ 等于模块名称（不包含后缀.py）。
>
>而 “__main__” 始终指当前执行模块的名称（包含后缀.py）。进而当模块被直接执行时，__name__ == 'main' 结果为真。
>

# python拷贝

等于（==）和 is 是 Python 中对象比较常用的两种方式。简单来说，`'=='`操作符比较对象之间的值是否相等，而`'is'`操作符比较的是对象的身份标识是否相等，即它们是否是同一个对象，是否指向同一个内存地址。在 Python 中，每个对象的身份标识，都能通过函数 id(object) 获得。因此，`'is'`操作符，相当于比较对象之间的 ID 是否相等。

eg:

```python
a = 10
b = 10
 
a == b
True
 
id(a)
4427562448
 
id(b)
4427562448
 
a is b
True
```

这里，首先 Python 会为 10 这个值开辟一块内存，然后变量 a 和 b 同时指向这块内存区域，即 a 和 b 都是指向 10 这个变量，因此 a 和 b 的值相等，id 也相等，`a == b`和`a is b`都返回 True。不过，需要注意，对于整型数字来说，以上`a is b`为 True 的结论，只适用于 -5 到 256 范围内的数字。

事实上，出于对性能优化的考虑，Python 内部会对 -5 到 256 的整型维持一个数组，起到一个缓存的作用。这样，每次你试图创建一个 -5 到 256 范围内的整型数字时，Python 都会从这个数组中返回相对应的引用，而不是重新开辟一块新的内存空间。但是，如果整型数字超过了这个范围，Python 则会 开辟两块内存区域，因此 a 和 b 的 ID 不一样，`a is b`就会返回 False 了。

>这里注意，比较操作符`'is'`的速度效率，通常要优于`'=='`。因为`'is'`操作符不能被重载，这样，Python 就不需要去寻找，程序中是否有其他地方重载了比较操作符，并去调用。执行比较操作符`'is'`，就仅仅是比较两个变量的 ID 而已。
>
>但是`'=='`操作符却不同，执行`a == b`相当于是去执行`a.__eq__(b)`，而 Python 大部分的数据类型都会去重载`__eq__`这个函数，其内部的处理通常会复杂一些。

## 浅拷贝

浅拷贝，是指重新分配一块内存，创建一个新的对象，里面的元素是原对象中子对象的引用。因此，如果原对象中的元素不可变，那倒无所谓；但如果元素可变，浅拷贝通常会带来一些副作用，尤其需要注意。

eg:

```python
l1 = [[1, 2], (30, 40)]
l2 = list(l1)
l1.append(100)
l1[0].append(3)
 
l1
[[1, 2, 3], (30, 40), 100]
 
l2
[[1, 2, 3], (30, 40)]
 
l1[1] += (50, 60)
l1
[[1, 2, 3], (30, 40, 50, 60), 100]
 
l2
[[1, 2, 3], (30, 40)]
```

首先初始化了一个列表 l1，里面的元素是一个列表和一个元组；然后对 l1 执行浅拷贝，赋予 l2。因为浅拷贝里的元素是对原对象元素的引用，因此 l2 中的元素和 l1 指向同一个列表和元组对象。

接着往下看。`l1.append(100)`，表示对 l1 的列表新增元素 100。这个操作不会对 l2 产生任何影响，因为 l2 和 l1 作为整体是两个不同的对象，并不共享内存地址。操作过后 l2 不变，l1 会发生改变.

`l1[0].append(3)`，这里表示对 l1 中的第一个列表新增元素 3。因为 l2 是 l1 的浅拷贝，l2 中的第一个元素和 l1 中的第一个元素，共同指向同一个列表，因此 l2 中的第一个列表也会相对应的新增元素 3。操作后 l1 和 l2 都会改变.

最后是`l1[1] += (50, 60)`，因为元组是不可变的，这里表示对 l1 中的第二个元组拼接，然后重新创建了一个新元组作为 l1 中的第二个元素，而 l2 中没有引用新元组，因此 l2 并不受影响。操作后 l2 不变，l1 发生改变.

### 浅拷贝方式

- 常见的浅拷贝的方法，是使用数据类型本身的构造器

- 对于可变的序列，我们还可以通过切片操作符`':'`完成浅拷贝

- Python 中也提供了相对应的函数 copy.copy()，适用于任何数据类型

>对于元组，使用 tuple() 或者切片操作符`':'`不会创建一份浅拷贝，相反，它会返回一个指向相同元组的引用

## 深拷贝

深度拷贝，是指重新分配一块内存，创建一个新的对象，并且将原对象中的元素，以递归的方式，通过创建新的子对象拷贝到新对象中。因此，新对象和原对象没有任何关联。

Python 中以 copy.deepcopy() 来实现对象的深度拷贝。

不过，深度拷贝也不是完美的，往往也会带来一系列问题。如果被拷贝对象中存在指向自身的引用，那么程序很容易陷入无限循环：

```python
import copy
x = [1]
x.append(x)
 
x
[1, [...]]
 
y = copy.deepcopy(x)
y
[1, [...]]
```

列表 x 中有指向自身的引用，因此 x 是一个无限嵌套的列表。但是我们发现深度拷贝 x 到 y 后，程序并没有出现 stack overflow 的现象。这是为什么呢？

其实，这是因为深度拷贝函数 deepcopy 中会维护一个字典，记录已经拷贝的对象与其 ID。拷贝过程中，如果字典里已经存储了将要拷贝的对象，则会从字典直接返回.

```python
def deepcopy(x, memo=None, _nil=[]):
    """Deep copy operation on arbitrary Python objects.
    	
	See the module's __doc__ string for more info.
	"""
	
    if memo is None:
        memo = {}
    d = id(x) # 查询被拷贝对象 x 的 id
	y = memo.get(d, _nil) # 查询字典里是否已经存储了该对象
	if y is not _nil:
	    return y # 如果字典里已经存储了将要拷贝的对象，则直接返回
        ...    
```

## python变量及其赋值

- 变量的赋值，只是表示让变量指向了某个对象，并不表示拷贝对象给变量；而一个对象，可以被多个变量所指向。
- 可变对象（列表，字典，集合等等）的改变，会影响所有指向该对象的变量。
- 对于不可变对象（字符串，整型，元祖等等），所有指向该对象的变量的值总是一样的，也不会改变。但是通过某些操作（+= 等等）更新不可变对象的值时，会返回一个新的对象。
- 变量可以被删除，但是对象无法被删除。

## python函数的参数传递

Python 的参数传递是**赋值传递** （pass by assignment），或者叫作对象的**引用传递**（pass by object reference）。Python 里所有的数据类型都是对象，所以参数传递时，只是让新变量与原变量指向相同的对象而已，并不存在值传递或是引用传递一说。

需要注意的是，这里的赋值或对象的引用传递，不是指向一个具体的内存地址，而是指向一个具体的对象。

- 如果对象是可变的，当其改变时，所有指向这个对象的变量都会改变。
- 如果对象不可变，简单的赋值只能改变其中一个变量的值，其余变量则不受影响。

# 装饰器

```python
def my_decorator(func):
    def wrapper():
        print('wrapper of decorator')
        func()
    return wrapper
 
def greet():
    print('hello world')
 
greet = my_decorator(greet)
greet()
 
# 输出
wrapper of decorator
hello world
```

变量 greet 指向了内部函数 wrapper()，而内部函数 wrapper() 中又会调用原函数 greet()，因此，最后调用 greet() 时，就会先打印`'wrapper of decorator'`，然后输出`'hello world'`。

这里的函数 my_decorator() 就是一个装饰器，它把真正需要执行的函数 greet() 包裹在其中，并且改变了它的行为，但是原函数 greet() 不变。

事实上，上述代码在 Python 中有更简单、更优雅的表示：

```python
def my_decorator(func):
    def wrapper():
        print('wrapper of decorator')
        func()
    return wrapper
 
@my_decorator
def greet():
    print('hello world')
 
greet()
```

这里的`@`，我们称之为语法糖，`@my_decorator`就相当于前面的`greet=my_decorator(greet)`语句，只不过更加简洁。因此，如果你的程序中有其它函数需要做类似的装饰，你只需在它们的上方加上`@decorator`就可以了，这样就大大提高了函数的重复利用和程序的可读性。

### 原函数带有参数的装饰器

通常情况下，我们会把`*args`和`**kwargs`，作为装饰器内部函数 wrapper() 的参数。`*args`和`**kwargs`，表示接受任意数量和类型的参数，因此装饰器就可以写成下面的形式：

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print('wrapper of decorator')
        func(*args, **kwargs)
    return wrapper
```

### 带有自定义参数的装饰器

其实，装饰器还有更大程度的灵活性。刚刚说了，装饰器可以接受原函数任意类型和数量的参数，除此之外，它还可以接受自己定义的参数。

举个例子，比如我想要定义一个参数，来表示装饰器内部函数被执行的次数，那么就可以写成下面这种形式：

```
def repeat(num):
    def my_decorator(func):
        def wrapper(*args, **kwargs):
            for i in range(num):
                print('wrapper of decorator')
                func(*args, **kwargs)
        return wrapper
    return my_decorator
 
 
@repeat(4)
def greet(message):
    print(message)
 
greet('hello world')
 
# 输出：
wrapper of decorator
hello world
wrapper of decorator
hello world
wrapper of decorator
hello world
wrapper of decorator
hello world
```

### 类装饰器

前面我们主要讲了函数作为装饰器的用法，实际上，类也可以作为装饰器。类装饰器主要依赖于函数`__call_()`，每当你调用一个类的示例时，函数`__call__()`就会被执行一次。

我们来看下面这段代码：

```
class Count:
    def __init__(self, func):
        self.func = func
        self.num_calls = 0
 
    def __call__(self, *args, **kwargs):
        self.num_calls += 1
        print('num of calls is: {}'.format(self.num_calls))
        return self.func(*args, **kwargs)
 
@Count
def example():
    print("hello world")
 
example()
 
# 输出
num of calls is: 1
hello world
 
example()
 
# 输出
num of calls is: 2
hello world
 
...
```

这里，我们定义了类 Count，初始化时传入原函数 func()，而`__call__()`函数表示让变量 num_calls 自增 1，然后打印，并且调用原函数。因此，在我们第一次调用函数 example() 时，num_calls 的值是 1，而在第二次调用时，它的值变成了 2。

### 装饰器的嵌套

回顾刚刚讲的例子，基本都是一个装饰器的情况，但实际上，Python 也支持多个装饰器，比如写成下面这样的形式：

```
@decorator1
@decorator2
@decorator3
def func():
    ...
```

它的执行顺序从里到外，所以上面的语句也等效于下面这行代码：

```
decorator1(decorator2(decorator3(func)))
```

> Python3.0之后加入新特性Decorators，以@为标记修饰function和class。有点类似c++的宏和java的注解。Decorators用以修饰约束function和class，分为带参数和不带参数，影响原有输出，例如类静态函数我们要表达的时候需要函数前面加上修饰@staticmethod或@classmethod
>
> 装饰器是一种语法糖，如下列代码所示，在函数上添加`@dec`相当于`func = dec(func)`。python 装饰器实现了23种设计模式之一的装饰器模式，在不修改原有函数的情况下，为函数代码的情况下为函数添加功能。
>
> 被装饰函数的返回值 作为参数传给闭包函数执行（这个闭包函数名前面加个@，就是装饰器），说白了装饰器就是一个闭包函数。

# metaclass

## 1. 所有的 Python 的用户定义类，都是 type 这个类的实例。

可能会让你惊讶，事实上，类本身不过是一个名为 type 类的实例。在 Python 的类型世界里，type 这个类就是造物的上帝。这可以在代码中验证：

```
# Python 3 和 Python 2 类似
class MyClass:
  pass
 
instance = MyClass()
 
type(instance)
# 输出
<class '__main__.C'>
 
type(MyClass)
# 输出
<class 'type'>
```

你可以看到，instance 是 MyClass 的实例，而 MyClass 不过是“上帝”type 的实例。

## 2. 用户自定义类，只不过是 type 类的`__call__`运算符重载。

当我们定义一个类的语句结束时，真正发生的情况，是 Python 调用 type 的`__call__`运算符。简单来说，当你定义一个类时，写成下面这样时：

```
class MyClass:
  data = 1
```

Python 真正执行的是下面这段代码：

```
class = type(classname, superclasses, attributedict)
```

这里等号右边的`type(classname, superclasses, attributedict)`，就是 type 的`__call__`运算符重载，它会进一步调用：

```
type.__new__(typeclass, classname, superclasses, attributedict)
type.__init__(class, classname, superclasses, attributedict)
```

当然，这一切都可以通过代码验证，比如下面这段代码示例：

```
class MyClass:
  data = 1
  
instance = MyClass()
MyClass, instance
# 输出
(__main__.MyClass, <__main__.MyClass instance at 0x7fe4f0b00ab8>)
instance.data
# 输出
1
 
MyClass = type('MyClass', (), {'data': 1})
instance = MyClass()
MyClass, instance
# 输出
(__main__.MyClass, <__main__.MyClass at 0x7fe4f0aea5d0>)
 
instance.data
# 输出
1
```

由此可见，正常的 MyClass 定义，和你手工去调用 type 运算符的结果是完全一样的。

## 3. metaclass 是 type 的子类，通过替换 type 的`__call__`运算符重载机制，“超越变形”正常的类。

## eg:

 ```python
 class Monster(yaml.YAMLObject):
   yaml_tag = u'!Monster'
   def __init__(self, name, hp, ac, attacks):
     self.name = name
     self.hp = hp
     self.ac = ac
     self.attacks = attacks
   def __repr__(self):
     return "%s(name=%r, hp=%r, ac=%r, attacks=%r)" % (
        self.__class__.__name__, self.name, self.hp, self.ac,      
        self.attacks)
  
 yaml.load("""
 --- !Monster
 name: Cave spider
 hp: [2,6]    # 2d6
 ac: 16
 attacks: [BITE, HURT]
 """)
  
 Monster(name='Cave spider', hp=[2, 6], ac=16, attacks=['BITE', 'HURT'])
  
 print yaml.dump(Monster(
     name='Cave lizard', hp=[3,6], ac=16, attacks=['BITE','HURT']))
  
 # 输出
 !Monster
 ac: 16
 attacks: [BITE, HURT]
 hp: [3, 6]
 name: Cave lizard
 ```



YAML 的动态序列化 / 逆序列化是由 metaclass 实现的。只看 YAMLObject 的 load() 功能。简单来说，我们需要一个全局的注册器，让 YAML 知道，序列化文本中的 `!Monster` 需要载入成 Monster 这个 Python 类型。

看过 YAML 的源码，就会发现，正是 metaclass 解决了这个问题。

```
# Python 2/3 相同部分
class YAMLObjectMetaclass(type):
  def __init__(cls, name, bases, kwds):
    super(YAMLObjectMetaclass, cls).__init__(name, bases, kwds)
    if 'yaml_tag' in kwds and kwds['yaml_tag'] is not None:
      cls.yaml_loader.add_constructor(cls.yaml_tag, cls.from_yaml)
  # 省略其余定义
 
# Python 3
class YAMLObject(metaclass=YAMLObjectMetaclass):
  yaml_loader = Loader
  # 省略其余定义
 
# Python 2
class YAMLObject(object):
  __metaclass__ = YAMLObjectMetaclass
  yaml_loader = Loader
  # 省略其余定义
```

你可以发现，YAMLObject 把 metaclass 都声明成了 YAMLObjectMetaclass，尽管声明方式在 Python 2 和 3 中略有不同。在 YAMLObjectMetaclass 中， 下面这行代码就是魔法发生的地方：

```
cls.yaml_loader.add_constructor(cls.yaml_tag, cls.from_yaml) 
```

YAML 应用 metaclass，拦截了所有 YAMLObject 子类的定义。也就说说，在你定义任何 YAMLObject 子类时，Python 会强行插入运行下面这段代码，把我们之前想要的`add_constructor(Foo)`给自动加上。

```
cls.yaml_loader.add_constructor(cls.yaml_tag, cls.from_yaml)
```

所以 YAML 的使用者，无需自己去手写`add_constructor(Foo)` 。

# 生成器和迭代器

## 迭代器

在 Python 中一切皆对象，对象的抽象就是类，而对象的集合就是容器。列表（list: [0, 1, 2]），元组（tuple: (0, 1, 2)），字典（dict: {0:0, 1:1, 2:2}），集合（set: set([0, 1, 2])）都是容器。所有的容器都是可迭代的（iterable）。迭代器（iterator）提供了一个 next 的方法。调用这个方法后，你要么得到这个容器的下一个对象，要么得到一个 StopIteration 的错误（苹果卖完了）。可迭代对象，通过 iter() 函数返回一个迭代器，再通过 next() 函数就可以实现遍历。for in 语句将这个过程隐式化。

## 生成器

**生成器是懒人版本的迭代器**。

```python
import os
import psutil
 
# 显示当前 python 程序占用的内存大小
def show_memory_info(hint):
    pid = os.getpid()
    p = psutil.Process(pid)
    
    info = p.memory_full_info()
    memory = info.uss / 1024. / 1024
    print('{} memory used: {} MB'.format(hint, memory))
def test_iterator():
    show_memory_info('initing iterator')
    list_1 = [i for i in range(100000000)]
    show_memory_info('after iterator initiated')
    print(sum(list_1))
    show_memory_info('after sum called')
 
def test_generator():
    show_memory_info('initing generator')
    list_2 = (i for i in range(100000000))
    show_memory_info('after generator initiated')
    print(sum(list_2))
    show_memory_info('after sum called')
 
%time test_iterator()
%time test_generator()
 
########## 输出 ##########
 
initing iterator memory used: 48.9765625 MB
after iterator initiated memory used: 3920.30078125 MB
4999999950000000
after sum called memory used: 3920.3046875 MB
Wall time: 17 s
initing generator memory used: 50.359375 MB
after generator initiated memory used: 50.359375 MB
4999999950000000
after sum called memory used: 50.109375 MB
Wall time: 12.5 s
```

声明一个迭代器很简单，`[i for i in range(100000000)]`就可以生成一个包含一亿元素的列表。每个元素在生成后都会保存到内存中，你通过代码可以看到，它们占用了巨量的内存，内存不够的话就会出现 OOM 错误。

不过，我们并不需要在内存中同时保存这么多东西，比如对元素求和，我们只需要知道每个元素在相加的那一刻是多少就行了，用完就可以扔掉了。

于是，生成器的概念应运而生，在你调用 next() 函数的时候，才会生成下一个变量。生成器在 Python 的写法是用小括号括起来，`(i for i in range(100000000))`，即初始化了一个生成器。

这样一来，你可以清晰地看到，生成器并不会像迭代器一样占用大量内存，只有在被使用的时候才会调用。

```python
def generator(k):
    i = 1
    while True:
        yield i ** k
        i += 1
 
gen_1 = generator(1)
gen_3 = generator(3)
print(gen_1)
print(gen_3)
 
def get_sum(n):
    sum_1, sum_3 = 0, 0
    for i in range(n):
        next_1 = next(gen_1)
        next_3 = next(gen_3)
        print('next_1 = {}, next_3 = {}'.format(next_1, next_3))
        sum_1 += next_1
        sum_3 += next_3
    print(sum_1 * sum_1, sum_3)
 
get_sum(8)
 
########## 输出 ##########
 
<generator object generator at 0x000001E70651C4F8>
<generator object generator at 0x000001E70651C390>
next_1 = 1, next_3 = 1
next_1 = 2, next_3 = 8
next_1 = 3, next_3 = 27
next_1 = 4, next_3 = 64
next_1 = 5, next_3 = 125
next_1 = 6, next_3 = 216
next_1 = 7, next_3 = 343
next_1 = 8, next_3 = 512
1296 1296
```

这段代码中，你首先注意一下 generator() 这个函数，它返回了一个生成器。

接下来的 yield 是魔术的关键, 函数运行到这一行的时候，程序会从这里暂停，然后跳出，不过跳到哪里呢？答案是 next() 函数。那么 `i ** k` 是干什么的呢？它其实成了 next() 函数的返回值。

这样，每次 next(gen) 函数被调用的时候，暂停的程序就又复活了，从 yield 这里向下继续执行；同时注意，局部变量 i 并没有被清除掉，而是会继续累加。我们可以看到 next_1 从 1 变到 8，next_3 从 1 变到 512。

这个生成器居然可以一直进行下去，迭代器是一个有限集合，生成器则可以成为一个无限集。我只管调用 next()，生成器根据运算会自动生成新的元素，然后返回给你，非常便捷。

>只要函数里有yield关键字就是生成器函数
>生成器函数不是普通的函数，生成器函数返回的是生成器对象
>Python中一切皆对象，生成器对象产生的时机是Python编译字节码的时候就产生了，而不是当函数调用的时候
>生成器对象也是实现了迭代器协议，所以我们可以用for in 去遍历其值
>可以多次yield，第一次调用next()会返回第一个yield的值，第二次调用next()会返回第二个yield，以此类推。
>生成器的出现，为惰性求值、延迟求值提供了可能。好处就是当调用的时候才会去计算，这样就避免了一开始就消耗很多的内存。

### 生成器原理

#### Python中函数的工作原理

```python
def foo():
    bar()
def bar():
    pass
foo()
```

python.exe即Python解释器会用一个叫做 PyEval_EvalFramEx 的C语言函数，去执行foo函数，当执行的时候会先创建一个栈帧（stack frame）对象，Python一切皆对象，所以栈帧也是对象，然后会把代码转成字节码对象（查看字节码使用dis模块），当foo函数调用子函数bar时，又会创建一个栈帧，所有的栈帧都是分配在堆内存上的，这就决定了栈帧可以独立于调用者存在。堆内存的特性是：不去释放它，它就会一直存在于内存当中。

Python 的堆栈帧是分配在堆内存中的，理解这一点非常重要！Python 解释器是个普通的 C 程序，所以它的堆栈帧就是普通的堆栈。但是它操作的 Python 堆栈帧是在堆上的。除了其他惊喜之外，这意味着 Python 的堆栈帧可以在它的调用之外存活。(FIXME: 可以在它调用结束后存活)。

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures1f4dedfed17d7d079449e1bfd3725e86.png)

#### 生成器原理

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturespauuhd800s.png)

```python
def gen_fn():
    result = yield 1
    print('result of yield: {}'.format(result))
    result2 = yield 2
    print('result of 2nd yield: {}'.format(result2))
    return 'done'
```

当 Python 将 gen_fn 编译为字节码时，它会看到 yield 语句，然后知道 gen_fn 是个生成器函数，而不是普通函数。它会设置一个标志来记住这个事实：

```python
>>> # The generator flag is bit position 5.
>>> generator_bit = 1 << 5
>>> bool(gen_fn.__code__.co_flags & generator_bit)
True
```

当你调用一个生成器函数时，Python 会看到生成器标志，实际上并不运行该函数，而是创建一个生成器（generator）：

```
>>> gen = gen_fn() 
>>> type(gen) <**class** 'generator'>
```

Python 生成器封装了一个堆栈帧和一个对生成器函数代码的引用，在这里就是对 gen_fn 函数体的引用：

```
>>> gen.gi_code.co_name 
'gen_fn'
```

调用 gen_fn 产生的所有生成器都指向同一个代码对象，但是每个都有自己的堆栈帧。这个堆栈帧并不存在于实际的堆栈上，它在堆内存上等待着被使用

堆栈帧有个 “last instruction”(FIXME: translate this or not?) 指针，指向最近执行的那条指令。刚开始的时候 last instruction 指针是 -1，意味着生成器尚未开始：

> \>>> gen.gi_frame.f_lasti -1

当我们调用 send 时，生成器达到第一个 yield 处然后暂停执行。send 的返回值是 1，这是因为 gen 把 1 传给了 yield 表达式：

> \>>> gen.send(**None**) 1

现在生成器的指令指针（instruction pointer）向前移动了 3 个字节码，这些是编译好的 56 字节的 Python 代码的一部分：

> \>>> gen.gi_frame.f_lasti 3 >>> len(gen.gi_code.co_code) 56

生成器可以在任何时候被任何函数恢复执行，因为它的堆栈帧实际上不在堆栈上——它在堆（内存）上。生成器在调用调用层次结构中的位置不是固定的，它不需要遵循常规函数执行时遵循的先进后出顺序。生成器被是被解放了的，它像云一样浮动。

我们可以将 “hello” 发送到这个生成器中，它会成为 yield 表达式的值，然后生成器会继续执行，直到产出（yield）了 2：

> \>>> gen.send('hello') result of **yield**: hello 2

现在这个生成器的堆栈帧包含局部变量 result：

> \>>> gen.gi_frame.f_locals {'result': 'hello'}

从 gen_fn 创建的其他生成器将具有自己的堆栈帧和局部变量。

当我们再次调用 send 时，生成器将从它第二个 yield 处继续执行，然后以产生特殊异常 StopIteration 结束：

> \>>> gen.send('goodbye') result of 2nd **yield**: goodbye Traceback (most recent call last): File "<input>", line 1, **in** <module> StopIteration: done

异常有一个值，它是那个生成器的返回值：字符串 “done”。

# python协程

## 协程的概念

### 从普通函数到协程

#### 普通的函数

我们先来看一个普通的函数，这个函数非常简单：

```python
def func():
    print("a")
    print("b")
    print("c")
```

这是一个简单的普通函数，当我们调用这个函数时会发生什么？

1. 调用func

2. func开始执行，直到return

3. func执行完成，返回函数A

是不是很简单，函数func执行直到返回，并打印出：abc

![image-20241102121923729](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241102121923729.png)

#### 协程

和普通函数只有一个返回点不同，协程可以有**多个返回点**。  

```python
void func() {
    print("a")
    暂停并返回
    print("b")
    暂停并返回
    print("c")
}
```

普通函数下，只有当执行完print("c")这句话后函数才会返回，但是在协程下当执行完print("a")后func就会因“暂停并返回”这段代码返回到调用函数。  

直接写一个return语句确实也能返回，**但这样写的话return后面的代码都不会被执行到了**。

协程之所以神奇就神奇在当我们从协程返回后**还能继续调用该协程**，并且是**从该协程的上一个返回点后继续执行**。

当普通函数返回后，进程的地址空间中不会再保存该函数运行时的任何信息，而协程返回后，函数的运行时信息是需要保存下来的  .

![image-20241102121934181](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241102121934181.png)

>函数只是协程的一种特例，和普通函数不同的是，协程能知道自己上一次执行到了哪里。
>
>协程会在函数被暂停运行时保存函数的运行状态，并可以从保存的状态中恢复并继续运行。
>
>很熟悉的味道有没有，这不就是操作系统对
>
>**线程**的调度嘛，线程也可以被暂停，操作系统保存线程运行状态然后去调度其它线程，此后该线程再次被分配CPU时还可以继续运行，就像没有被暂停过一样。
>
>只不过线程的调度是操作系统实现的，这些对程序员都不可见，而协程是在用户态实现的，对程序员可见。
>
>这就是为什么有的人说可以把协程理解为用户态线程的原因。

## 协程的原理

协程的本质是什么呢？其实就是可以被暂停以及可以被恢复运行的函数。

协程之所以可以被暂停也可以继续，那么一定要记录下被暂停时的状态，也就是上下文，当继续运行的时候要恢复其上下文(状态)，那么接下来很自然的一个问题就是，函数运行时的状态是什么？函数运行时所有的状态信息都位于函数运行时栈中。

函数运行时栈就是我们需要保存的状态，也就是所谓的上下文，如图所示

![image-20241102122206397](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241102122206397.png)

函数的运行时状态就保存在栈区的栈帧中，既然函数的运行时状态保存在栈区的栈帧中，那么如果我们想暂停协程的运行就必须保存整个栈帧的数据，那么我们该将整个栈帧中的数据保存在哪里呢？

想一想这个问题，整个进程的内存区中哪一块是专门用来长时间(进程生命周期)存储数据的？很显然，这就是堆区啊，heap，我们可以将栈帧保存在堆区中，那么我们该怎么在堆区中保存数据呢？我们需要做的就是在堆区中申请一段空间，让后把协程的整个栈区保存下，当需要恢复协程的运行时再从堆区中copy出来恢复函数运行时状态。

再仔细想一想，为什么我们要这么麻烦的来回copy数据呢？实际上，我们需要做的是直接把协程的运行需要的栈帧空间直接开辟在堆区中，这样都不用来回copy数据了，如图所示。

![image-20241102122357468](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241102122357468.png)

该程序中开启了两个协程，这两个协程的栈区都是在堆上分配的，这样我们就可以随时中断或者恢复协程的执行了。

进程地址空间最上层的栈区现在的作用依然是用来保存函数栈帧的，只不过这些函数并不是运行在协程而是普通线程中的。在上图中实际上有3

个执行流：

1. 一个普通线程

2. 两个协程

虽然有3个执行流但我们创建了几个线程呢？**一个线程**。

使用协程理论上我们可以**开启无数并发执行流，只要堆区空间足够**，同时还没有创建线程的开销，所有协程的调度、切换都发生在用户态，这就是为什么协程也被称作用户态线程的原因所在。  

## python协程写法

```python
import asyncio
 
async def crawl_page(url):
    print('crawling {}'.format(url))
    sleep_time = int(url.split('_')[-1])
    await asyncio.sleep(sleep_time)
    print('OK {}'.format(url))
 
async def main(urls):
    for url in urls:
        await crawl_page(url)
 
%time asyncio.run(main(['url_1', 'url_2', 'url_3', 'url_4']))
 
########## 输出 ##########
 
crawling url_1
OK url_1
crawling url_2
OK url_2
crawling url_3
OK url_3
crawling url_4
OK url_4
Wall time: 10 s
```

在 Python 3.7 以上版本中，使用协程写异步程序非常简单。

import asyncio，这个库包含了大部分我们实现协程所需的魔法工具。

async 修饰词声明异步函数，于是，这里的 crawl_page 和 main 都变成了异步函数。而调用异步函数，我们便可得到一个协程对象（coroutine object）。

举个例子，如果你 `print(crawl_page(''))`，便会输出`<coroutine object crawl_page at 0x000002BEDF141148>`，提示你这是一个 Python 的协程对象，而并不会真正执行这个函数。

执行协程有多种方法，这里我介绍一下常用的三种。

1. 首先，我们可以通过 await 来调用。await 执行的效果，和 Python 正常执行是一样的，也就是说程序会阻塞在这里，进入被调用的协程函数，执行完毕返回后再继续，而这也是 await 的字面意思。代码中 `await asyncio.sleep(sleep_time)` 会在这里休息若干秒，`await crawl_page(url)` 则会执行 crawl_page() 函数。

   >await后面是一个可等待对象，如协程对象、协程任务，用于告诉even loop在此协程中需要等待后面的函数运行完成后才能继续，运行完成后返回结果。
   >协程函数调用时，前面不加await会显示以下内容
   >
   >RuntimeWarning: coroutine ‘xxx’ was never awaited
   >
   >await要在协程函数里面，否则会显示以下内容
   >
   >‘await’ outside function
   >

2. 其次，我们可以通过 asyncio.create_task() 来创建任务。

3. 最后，我们需要 asyncio.run 来触发运行。asyncio.run 这个函数是 Python 3.7 之后才有的特性，可以让 Python 的协程接口变得非常简单，你不用去理会事件循环怎么定义和怎么使用的问题（我们会在下面讲）。一个非常好的编程规范是，asyncio.run(main()) 作为主程序的入口函数，在程序运行周期内，只调用一次 asyncio.run。

>协程确实是与 Python 的生成器非常相似，也都有一个 send 方法。我们可以通过调用 send 方法来启动一个协程的执行。

**上面虽然将协程都执行起来了，但是并没有做到交替执行**

await 是同步调用，因此， crawl_page(url) 在当前的调用结束之前，是不会触发下一次调用的。于是，这个代码效果相当于我们用异步接口写了个同步代码。

```python
import asyncio
 
async def crawl_page(url):
    print('crawling {}'.format(url))
    sleep_time = int(url.split('_')[-1])
    await asyncio.sleep(sleep_time)
    print('OK {}'.format(url))
 
async def main(urls):
    tasks = [asyncio.create_task(crawl_page(url)) for url in urls]
    for task in tasks:
        await task
 
%time asyncio.run(main(['url_1', 'url_2', 'url_3', 'url_4']))
 
########## 输出 ##########
 
crawling url_1
crawling url_2
crawling url_3
crawling url_4
OK url_1
OK url_2
OK url_3
OK url_4
Wall time: 3.99 s
```

有了协程对象后，便可以通过 `asyncio.create_task` 来创建任务。任务创建后很快就会被调度执行，这样，我们的代码也不会阻塞在任务这里。所以，我们要等所有任务都结束才行，用`for task in tasks: await task` 即可。

### Asyncio工作原理

Asyncio 和其他 Python 程序一样，是单线程的，它只有一个主线程，但是可以进行多个不同的任务（task），这里的任务，就是特殊的 future 对象。这些不同的任务，被一个叫做 event loop 的对象所控制。

假设任务只有两个状态：一是预备状态；二是等待状态。所谓的预备状态，是指任务目前空闲，但随时待命准备运行。而等待状态，是指任务已经运行，但正在等待外部的操作完成，比如 I/O 操作。

在这种情况下，event loop 会维护两个任务列表，分别对应这两种状态；并且选取预备状态的一个任务（具体选取哪个任务，和其等待的时间长短、占用的资源等等相关），使其运行，一直到这个任务把控制权交还给 event loop 为止。

当任务把控制权交还给 event loop 时，event loop 会根据其是否完成，把任务放到预备或等待状态的列表，然后遍历等待状态列表的任务，查看他们是否完成。

- 如果完成，则将其放到预备状态的列表；
- 如果未完成，则继续放在等待状态的列表。

而原先在预备状态列表的任务位置仍旧不变，因为它们还未运行。

这样，当所有任务被重新放置在合适的列表后，新一轮的循环又开始了：event loop 继续从预备状态的列表中选取一个任务使其执行…如此周而复始，直到所有任务完成。

值得一提的是，对于 Asyncio 来说，它的任务在运行时不会被外部的一些因素打断，因此 Asyncio 内的操作不会出现 race condition 的情况，这样你就不需要担心线程安全的问题了。

# GIL

Python 多线程另一个很重要的话题——GIL（Global Interpreter Lock，即全局解释器锁）

Python 的线程，的的确确封装了底层的操作系统线程，在 Linux 系统里是 Pthread（全称为 POSIX Thread），而在 Windows 系统里是 Windows Thread。另外，Python 的线程，也完全受操作系统管理，比如协调何时执行、管理内存资源、管理中断等等。

GIL，是最流行的 Python 解释器 CPython 中的一个技术术语。它的意思是全局解释器锁，本质上是类似操作系统的 Mutex。每一个 Python 线程，在 CPython 解释器中执行时，都会先锁住自己的线程，阻止别的线程执行。

CPython 引进 GIL 其实主要就是这么两个原因：

- 一是设计者为了规避类似于内存管理这样的复杂的竞争风险问题（race condition）；
- 二是因为 CPython 大量使用 C 语言库，但大部分 C 语言库都不是原生线程安全的（线程安全会降低性能和增加复杂度）。

## GIL工作原理

![image-20241102172618377](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesimage-20241102172618377.png)

Thread 1、2、3 轮流执行，每一个线程在开始执行时，都会锁住 GIL，以阻止别的线程执行；同样的，每一个线程执行完一段后，会释放 GIL，以允许别的线程开始利用资源。

为什么 Python 线程会去主动释放 GIL 呢？毕竟，如果仅仅是要求 Python 线程在开始执行时锁住 GIL，而永远不去释放 GIL，那别的线程就都没有了运行的机会。

没错，CPython 中还有另一个机制，叫做 check_interval，意思是 CPython 解释器会去轮询检查线程 GIL 的锁住情况。每隔一段时间，Python 解释器就会强制当前线程去释放 GIL，这样别的线程才能有执行的机会。

## python线程安全

有了 GIL，并不意味着我们 Python 编程者就不用去考虑线程安全了。即使我们知道，GIL 仅允许一个 Python 线程执行，但前面我也讲到了，Python 还有 check interval 这样的抢占机制。我们来考虑这样一段代码：

```python
import threading
 
n = 0
 
def foo():
    global n
    n += 1
 
threads = []
for i in range(100):
    t = threading.Thread(target=foo)
    threads.append(t)
 
for t in threads:
    t.start()
 
for t in threads:
    t.join()
 
print(n)
```

如果你执行的话，就会发现，尽管大部分时候它能够打印 100，但有时侯也会打印 99 或者 98。

这其实就是因为，`n+=1`这一句代码让线程并不安全。如果你去翻译 foo 这个函数的 bytecode，就会发现，它实际上由下面四行 bytecode 组成：

```python
>>> import dis
>>> dis.dis(foo)
LOAD_GLOBAL              0 (n)
LOAD_CONST               1 (1)
INPLACE_ADD
STORE_GLOBAL             0 (n)
```

# python垃圾回收

## 计数引用

Python 中一切皆对象。因此，你所看到的一切变量，本质上都是对象的一个指针。

怎么知道一个对象，是否永远都不能被调用了呢？当这个对象的引用计数（指针数）为 0 的时候，说明这个对象永不可达，自然它也就成为了垃圾，需要被回收。

## 循环引用

Python 使用标记清除（mark-sweep）算法和分代收集（generational），来启用针对循环引用的自动垃圾回收。

在 Python 的垃圾回收实现中，mark-sweep 使用双向链表维护了一个数据结构，并且只考虑容器类的对象（只有容器类对象才有可能产生循环引用）。

Python 将所有对象分为三代。刚刚创立的对象是第 0 代；经过一次垃圾回收后，依然存在的对象，便会依次从上一代挪到下一代。而每一代启动自动垃圾回收的阈值，则是可以单独指定的。当垃圾回收器中新增对象减去删除对象达到相应的阈值时，就会对这一代对象启动垃圾回收。

事实上，分代收集基于的思想是，新生的对象更有可能被垃圾回收，而存活更久的对象也有更高的概率继续存活。因此，通过这种做法，可以节约不少计算量，从而提高 Python 的性能。

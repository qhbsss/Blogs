[TOC]

# 注解

`Annotation` （注解） 是 Java5 开始引入的新特性，可以看作是一种特殊的注释，主要用于修饰类、方法或者变量，提供某些信息供程序在编译或者运行时使用。

注解本质是一个继承了`Annotation` 的特殊接口：

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.SOURCE)
public @interface Override {

}

public interface Override extends Annotation{

}
```
注解不会对代码有直接的影响，只是起到标记的作用，需要编写额外的代码去利用注解，否则注解一无所用。幸运的是，无论是框架还是java编译器已经提供了相应的注解处理代码。

![img](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/60edd709edda490685dfa53e292e6325~tplv-k3u1fbpfcp-zoom-in-crop-mark:1512:0:0:0.awebp)

## 注解的解析方法
注解相当于给某些代码贴了个标签。我们既**可以通过注解处理器在编译时解析这些标签，也可以在运行时通过反射解析这些标签**。解析后都会有一系列动作，这些动作就是对标签语义的诠释。

注解只有被解析之后才会生效，常见的解析方法有两种：

### 1. **编译期直接扫描**：
编译器在编译 Java 代码的时候扫描对应的注解并处理，比如某个方法使用`@Override` 注解，编译器在编译的时候就会检测当前的方法是否重写了父类对应的方法。
#### 注解处理器

##### Java 编译器的工作流程

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures64e93f67c3b422afd90966bfe9aaf5b8.png)

Java 源代码的编译过程可分为三个步骤：
1. 将源文件解析为抽象语法树；

2. 调用已注册的注解处理器；

3. 生成字节码。

如果在第 2 步调用注解处理器过程中生成了新的源文件，那么编译器将重复第 1、2 步，解析并且处理新生成的源文件。每次重复我们称之为一轮（Round）。

所有的注解处理器类都需要实现接口Processor。该接口主要有四个重要方法。其中，init方法用来存放注解处理器的初始化代码。之所以不用构造器，是因为在 Java 编译器中，注解处理器的实例是通过反射 API 生成的。也正是因为使用反射 API，每个注解处理器类都需要定义一个无参数构造器。

JDK 提供了一个实现Processor接口的抽象类AbstractProcessor。该抽象类实现了init、getSupportedAnnotationTypes和getSupportedSourceVersion方法。

它的子类可以通过@SupportedAnnotationTypes和@SupportedSourceVersion注解来声明所支持的注解类型以及 Java 版本。

### 2. **运行期通过反射处理**
注解本质是一个继承了Annotation的特殊接口，其具体实现类是Java运行时生成的动态代理类。通过代理对象调用自定义注解（接口）的方法，会最终调用AnnotationInvocationHandler的invoke方法。该方法会从memberValues这个Map中索引出对应的值。而memberValues的来源是Java常量池。

反射注解的工作原理：

1. 首先，我们通过键值对的形式可以为注解属性赋值，像这样：@Hello(value = "hello")。

2. 接着，你用注解修饰某个元素，编译器将在编译期扫描每个类或者方法上的注解，会做一个基本的检查，你的这个注解是否允许作用在当前位置，最后会将注解信息写入元素的属性表。

3. 然后，当你进行反射的时候，虚拟机将所有生命周期在 RUNTIME的注解取出来放到一个 map 中，并创建一个 AnnotationInvocationHandler 实例，把这个 map 传递给它。

4. 最后，虚拟机将采用 JDK 动态代理机制生成一个目标注解的代理类，并初始化好处理器。


像框架中自带的注解(比如 Spring 框架的 `@Value`、`@Component`)都是通过反射来进行处理的。
- 一般情况下，继承于class类的子类可以通过class基类的方法反射获取得到子类的property，method等，但是对于注解，子类如何通过父类得到呢？这里的class类需要对AnnotatedElement接口进行实现，这个接口提供要返回的Annotation的方法。
- Java反射机制解析注解主要是通过java.lang.reflect包下的提供的AnnotatedElement接口，Class<T>实现了该接口定义的方法，返回本元素/所有的注解（Annotation接口）。
![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures076e4647149398d41eb6610106890d73.jpeg)

- AnnotatedElement是所有注解元素的父接口，所有的注解元素都可以通过某个类反射获取AnnotatedElement对象，该对象有以下4个方法来访问Annotation信息。AnnotatedElement接口定义如下：    

    public interface AnnotatedElement {
        
        default boolean isAnnotationPresent(Class<? extends Annotation> annotationClass)     {
            return getAnnotation(annotationClass) != null;
        }
        
         <T extends Annotation> T getAnnotation(Class<T> annotationClass);
        
        Annotation[] getAnnotations();
        
        default <T extends Annotation> T getDeclaredAnnotation(Class<T> annotationClass) {}
        
        default <T extends Annotation> T[] getDeclaredAnnotationsByType(Class<T> annotationClass) {
            ...
        }
        
        Annotation[] getDeclaredAnnotations();
    }
这个接口有default方法，Class类可直接使用。

java反射中与注解相关的API包括：

1. 判断某个注解是否存在于Class、Field、Method、Constructor：Xxx.isAnnotationPresent(Class)
2. 读取注解：Xxx.getAnnotation(Class)
#### eg:
自定义一个名为@IDAuthenticator的注解去验证Student类的学号，要求学号的长度必须为4，对不满足要求的学号抛出异常。
首先我们定义注解：
```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface IDAuthenticator {
    int length() default 8;
}
```

然后应用注解:

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Student {
    private  String name;
    @IDAuthenticator(length = 4)
    private String id;

}
```

最后解析注解:

```java
public  void check(Student student) throws IllegalAccessException {
    for(Field field:student.getClass().getDeclaredFields()){

        if(field.isAnnotationPresent(IDAuthenticator.class)){
            IDAuthenticator idAuthenticator = field.getAnnotation(IDAuthenticator.class);
            field.setAccessible(true);
            //只有id有@IDAuthenticator注解，
            //也只要当field为id时@IDAuthenticator才不为空，才能满足判断条件，
            // 体会，注解的本质是标签，起筛选作用
            Object value=field.get(student);
            if(value instanceof String){
                String id=(String) value;
                if(id.length()!=idAuthenticator.length()){
                    throw  new  IllegalArgumentException("the length of "+field.getName()+" should be "+idAuthenticator.length());
                }

            }

        }
    }
```

测试

```java
@Test
public void useAnnotation(){
    Student student01 = new Student("小明", "20210122");
    Student student02 = new Student("小军", "2021");
    Student student03 = new Student("小花", "20210121");
    
    for(Student student:new Student[]{student01,student02,student03}){
        try{
            check(student);
            System.out.println(" Student "+student+" checks ok ");
        } catch (IllegalArgumentException | IllegalAccessException e) {
            System.out.println(" Student "+student+" checks failed "+e);
        }
    }
}
```

![img](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures9c42d2df2fcd49699cfaf6db52b18a43%7Etplv-k3u1fbpfcp-zoom-in-crop-mark%3A1512%3A0%3A0%3A0.awebp)


#### 反射返回动态代理对象 & 注解实现类

注解本质上是继承了 Annotation 接口的接口，而当你通过反射获取一个注解类实例的时候，其实 JDK 是通过动态代理机制生成一个实现我们注解（接口）的代理类。该动态代理类实现了注解所对应的接口，对该注解接口内定义的方法通过定义一个代理方法，该代理方法内通过AnnotationInvocationHandler的类通过反射调用注解接口内对应的方法。该方法会从memberValues这个Map中索引出对应的值，而memberValues的来源是Java常量池。

![在这里插入图片描述](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Pictures013586c59e690beac6d83f14ef46d057.png)

![在这里插入图片描述](https://raw.githubusercontent.com/qhbsss/Pictures/main/Blog_Picturesc69c6edf4a62dade860333771a527f8a.png)
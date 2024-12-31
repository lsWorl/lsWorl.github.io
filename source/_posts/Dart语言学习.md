---
title: Dart语言学习
date: 2022-09-06 22:47:21
tags:
 - dart
 - android
 - flutter
categories: flutter
---





最近想开发一个即时通讯的app，想要通过跨端平台来做一个app，众所周知，目前比较流行的跨端平台有`electron`(主要桌面开发)、`uniapp`(小程序方面应用多)、`react native`(和`flutter`在app占比差不多)和`flutter`。当时技术选型时，因为本人是对`Vue`为主要前端框架进行深入学习，所以开发app时候`react native`就没有纳入我的范围，`uniapp`又因为觉得做小程序比较多，在网上搜索`uniapp`对app的兼容不如`react native`和`flutter`，所以最后就决定选择学习`flutter`来作为主要开发工具。

本文主要介绍`Dart`的基本语法，`Dart`大部分都是为了`flutter`而服务，所以这里并不会对`Dart`进行过多的了解，相信要是有`javascript`或`java`语言等高级语言基础的话，可以很快的进行入门。



> 文章参考了[Dart](https://dart.cn/)的官网。

****



### 前言

`Dart`和`Java`一样是面向对象的语言，所以他们都有一个`main`方法，要是数据不是在函数体内声明，则默认为全局方法，不会像`Javascript`那种面向编程的语言一样，无论在什么环境修改变量都不会报错，在`Dart`中，全局是默认只能声明不能进行修改的，要想数据必须在`void main(){}`中，所以以下的代码测试默认处于`void main(){}`环境。



### Dart数据类型

`Dart`的数据类型基本与`Java`的相同，作为一个类型安全的语言，虽然其中可以使用`var`来声明变量，但声明后就不能修改类型。



```dart
var name = '小明';
name = 123; //报错
```



所以要用类型最好就在声明时候确定下来。

```dart
String name = '小明';
```



#### Dart数据类型种类



|           类型           |                             用法                             |
| :----------------------: | :----------------------------------------------------------: |
|     Numbers（数字）      |                  int a = 1;或double = 2.1;                   |
|    Strings（字符串）     |                      String a = '你好';                      |
|     Booleans（布尔）     |                        bool b = true;                        |
|      Lists（数组）       |                    var list = [1, 2, 3];                     |
|     Sets（无序集合）     | var halogens = {'fluorine', 'chlorine', 'bromine', 'iodine', 'astatine'}; 或 var names = <String>{}; |
| Map（对象，即Key:value） | var gifts = {'first': 'partridge',   'second': 'turtledoves',   'fifth': 'golden rings' }; 或构造器创建：var gifts = Map<String, String>(); |
|          Runes           | 需要导入 [characters 包](https://pub.flutter-io.cn/packages/characters)，可以用Unicode字符来显示emoji表情，如：大笑的 emoji 表情（😆）的 Unicode 为 `\u{1f600}`。 |
|  Symbols（用的比较少）   |               Symbol obj = new Symbol('name');               |
|           null           |                         null即为null                         |

**各种数值类型具体使用方法下方介绍！（以下Numbers，Strings，Booleans皆可用var声明）**



##### Numbers（数字类型）

```dart
//定义整数类型
int a = 1;

a = 10.9; //报错
a = '123'; //报错

//定义浮点数类型
double b = 1.9;

b = 2 ; //不报错
b = '123'; //报错

```



##### Strings（字符串）

```dart
//定义字符串
String s = '123';
s = 123; //报错
s = '147'; //不报错
```



##### Booleans（布尔）

```dart
//定义布尔
bool b = true;
b = 1; //报错
b = false; //不报错
```



##### Lists（数组）

```dart
//定义一个内部全为字符串的数组 <>符号是为了限制类型
List<String> arr = [];
arr = ['1','2']; //不报错
arr = [1,2]; //报错
```



##### Sets（无序集合）

```dart
//用{}创建时候默认为Map，Dart通过调用方法来判断为Set还是Map <>用来限制Set里面为String类型
var elements = <String>{};
elements.add('fluorine');
elements.addAll({'a', 'b'});
print(elements); //输出{fluorine, a, b}


Set<num> s = new Set();
s.add(2);
print(s); //输出 {2}
```



##### Map（对象）

```dart
//定义一个key和value都是字符串的对象
Map<String,String> m = {};

m = {'a': 'a的value'};
print(m['a']); //输出 a的value
```



**Runes和Symbol目前用的比较少，所以也没有过多研究，等到时候摸透了再回来补....**




---
title: TypeScript的语法与使用
date: 2022-05-16 14:02:13
categories: TypeScript
top: true
tags:
 - TypeScript
---



### TypeScript的安装

因为TypeScript只是相当于JavaScript的拓展，JavaScript所有语法并对其进行一些语法的增加，安装可以通过Node.js的npm包控制管理进行安装。使用`npm i -g typescript`进行全局安装。

浏览器目前默认识别不了ts文件，需要通过`tsc xxx.ts`来进行将ts转变为js，使用`tsc xxx.ts -w`会自动监听ts文件的变更。



#### TypeScript配置

在根目录创建`tsconfig.json`对ts进行配置，在命令行中使用`tsc`或`tsc -w`来运行配置文件



```json
//tsconfig.json文件
{
    //"compilerOptions"编译器的选项
    "compilerOptions": {

        //"target"用来指定ts编译为js的版本
        "target": "ES6",

        //"module"指定要使用的模块化的规范
        "module": "ES6",
        
        //"strict"所有严格检查开关
        "strict": true,

        //"lib"指定项目中要使用的库(一般不配置)
        "lib": [],

        //"outDir"指定编译后的文件所在目录
        "outDir": "./dist",

        //"outFile"用于将代码合并为一个文件
        "outFile": "/dist/app.js",

        //"allowJs"是否对js文件进行编译
        "allowJs": false,

        //"checkJs"是否对js文件进行ts语法检查
        "checkJs": false,

        //"removeComments"是否移除注释
        "removeComments": false,

        //"noEmit"不生成编译后的文件
        "noEmit": false,

        //"noEmitOnError"有错误时不生成编译后的文件
        "noEmitOnError": false,

        //"alwaysStrict"编译后的文件是否开启严格模式
        "alwaysStrict": true,

        //"noImplicitAny"不允许隐式的any类型
        "noImplicitAny": false,

        //"noImplicitThis"不允许不明确的this
        "noImplicitThis": false,

        //"strictNullChecks"严格检查空值
        "strictNullChecks": false


    },
    /*
    "include"指定哪些ts文件需要被编译
     **表示 递归匹配任意子目录
     *表示 匹配0或多个字符（不包括目录分隔符）
    */
    "include": [
        "./src/**/*"
    ],
    //"exclude"指定不需要被编译的文件目录
    "exclude": [
        "./src/hello/**/*"
    ]
}
```



### 语法

####  基本类型

ts引入了类型的概念，可以对变量或形参进行类型的判断，如果类型不符则会直接报错



|  类型   |                             描述                             |
| :-----: | :----------------------------------------------------------: |
| number  |                           任意数字                           |
| string  |                          任意字符串                          |
| boolean |                      布尔值true或false                       |
| 字面量  |                 限制变量的值就是该字面量的值                 |
|   any   |                           任意类型                           |
| unknown |                        类型安全的any                         |
|  void   |                            没有值                            |
|  never  |                         不能是任何值                         |
| object  | 表示除`number`，`string`，`boolean`，`symbol`，`null`或`undefined`之外的类型 |
|  array  |                         任意的js数组                         |
|  tuple  |                    元组（长度固定的数组）                    |
|  enum   |                             枚举                             |



```typescript
//声明一个变量a，同时指定它的类型是Number 以后a赋值只能为number类型 赋值其他类型会报错
let a:number
a = 100

//声明变量类型为number并直接赋值 以后b的类型只能为number，修改会报错
let b = 1

//声明函数接收到的形参和返回值必须为数字
function sum(a: number, b: number): number{
    return a + b
}

//声明函数 使用 void 表示函数没有返回值（但可以返回undefined和null） 有返回值会报错
function fn(): void{}

//声明函数 使用 never 表示函数不会有返回结果
function fn2(): never{
    throw console.error('出错');
}


//使用 | 来连接多个类型， 这里c之后只能赋值成字符串或布尔类型
let c: string | boolean

//使用 any 相当于对变量关闭类型限制
let d:any

//使用 unknown 表示未知类型的值 不能将 unknown类型的值赋值给其他已知类型的值，但any类型不受限制
let e: unknown

//可以使用 类型断言 将unknown的值赋值给其他已知类型 有以下两种语法
a = e as number
a = <number>e

//指定变量f为一个对象，赋值内容必须包含name age?表示age属性为可选属性
//[propName: string] : any 表示 属性名为任意字符串， 属性值为任意类型 就可以在后方追加属性了
let f: {name: string, age?:number , [propName: string] : unknown}
f = {name: '名字'}

//设置函数结构的类型声明
let g : (a:number,b:number) => number //表示形参只能有两个而且为number 返回值也为number
g = function(a,b){
    return a - b
}

//设置数组内部的数据类型
//语法1
let h : string[] //表明数组内部只能是字符串
h = ['a','b']
//语法2
let j : Array<string> //表明数组内部只能是字符串
j = ['a','b']

//定义元组
let k: [string,number]////表明数组内部第一个是字符串，第二个是数字
k = ['s' , 123]

//定义枚举类型
enum Gender{
    male,
    female
}
let l : {name:string,gender:Gender} //使用枚举类型来判断性别
l = {
    name: '名字',
    gender: Gender.male
}
console.log(l.gender === Gender.male)

//使用type关键字来为类型取别名
type myType = number
let i : myType //此时类型和number是相同的

```



#### 类型断言

当确定一个值的类型时但ts却出现报错的情况下，可以使用类型断言来断定当前变量的值一定为所断言的值。

断言的两种语法

- `<类型>变量`，在要断言数据前面使用尖括号
- 使用`as`语法 (当在TypeScript里使用JSX时，只有 `as`语法断言是被允许的)

```typescript
//使用尖括号
let str:any = 'some thing'
let strLength:number = (<string>str).length

//使用 as
let str:any = 'some thing'
let strLength:number = (str as string).length
```



#### 面向对象

面向对象主要包括属性和方法。面向对象简而言之就是，万物皆是对象。

#####  类（class）

通过类来创建不同的对象



```typescript
//定义一个类 对象中主要包含了两个部分： 属性  方法
class Person{
    //定义实例属性
    name: string = '名字'

    //在属性前舒勇static关键字可以定义属性为静态属性
    static age: number = 18

    //定义只读属性只能看不能改
    readonly render: string = '男'

    //定义方法

    sayHello(){
        console.log('hello')
    }
}

const per = new Person()

console.log(per.name)
// console.log(per.age) 此时会报错

console.log(Person.age)//需要通过类进行访问

//per.render = '女' 此时会报错
console.log(per.render)

//调用方法 要是static修饰则为类方法
per.sayHello()
```



##### 构造函数

每次对类进行实例化时候会先调用一次构造函数，可以选择接收的参数，每次根据实例化对象的不同`this`指向也不同



```typescript
//定义一个类
class Person{
    name: string
    age: number
    //创建构造函数  构造函数会在对象创建时调用 不初始化值的话，调用构造函数必须传值
    constructor (name:string = '张三',age:number = 18){
        this.name = name
        this.age = age
        console.log(this)//在构造函数中this表示当前的实例对象
    }
    

    sayHello(){
        console.log('hello')
    }
}
const per = new Person()
const per = new Person('李四',20)
```



##### 继承

让子类继承父类的方法和属性，提高代码的复用性。

如果子类当中添加了父类相同的方法，会覆盖掉父类的方法。这称为方法的重写

在继承中有`super`关键字，表示当前类的父类。

在子类中写构造函数必须通过`super`对父类构造函数进行调用

```typescript
//定义动物类
class Animal{
    name: string
    age: number
    //创建构造函数
    constructor (name:string,age:number){
        this.name = name
        this.age = age
        console.log(this)//在构造函数中this表示当前的实例对象
    }

    sayHello(){
        console.log('动物在叫')
    }
}
//让Dog类继承动物类
class Dog extends Animal{
    constructor(name:string,age:number){
        super(name,age) //继承父类构造函数
    }
    sayHello(){
        console.log('汪汪汪')
    }
}
//让Cat类继承动物类
class Cat extends Animal{
    
    sayHello(){
        console.log('喵喵喵')
    }
}
//让Tiger类继承动物类
class Tiger extends Animal{
    
    sayHello(){
        super.sayHello() //继承父类方法
    }
}
const dog = new Dog('旺财',3)//输出 Dog {name: '旺财', age: 3}
dog.sayHello()//输出 汪汪汪

const cat = new Cat('咪咪',2)//输出 Cat {name: '咪咪', age: 2}
cat.sayHello()//输出 喵喵喵

const tiger = new Tiger('虎',5) //输出 Tiger {name: '虎', age: 5}
tiger.sayHello()//输出 动物在叫
```



##### 抽象类

使用`abstract`来定义抽象类，此类只能被继承不能直接调用，就是专门用来继承的类

抽象类可以使用`abstract`添加抽象方法，抽象方法没有方法体，抽象方法只能定义在抽象类中，子类必须对抽象方法进行重写，不然会报错



```typescript
//定义抽象动物类
abstract class Animal{
    name: string
    //创建构造函数
    constructor (name:string){
        this.name = name
        console.log(this)//在构造函数中this表示当前的实例对象
    }
    //定义抽象方法
    abstract sayHello():void
}
//让Dog类继承动物类
class Dog extends Animal{
    age: number
    constructor(name:string,age:number){
        super(name) //继承父类构造函数
        this.age = age
    }
    sayHello(){
        console.log('汪汪汪')
    }
}
```



##### 接口

使用`interface`关键字用来定义一个类结构，定义一个类中应该包含哪些属性和方法，接口也可以当成类型声明去使用。

接口只定义对象的结构，不能有实际的值

用`implements`来实现一个接口



```typescript
//定义接口
interface objInterface{
    name:string
    age:number
}
//接口当作类型声明使用
const obj: objInterface = {
    name:'张三',
    age: 18
}

//定义接口
interface myInter{
    name: string

    sayHello():void
}
//实现接口
class Person implements myInter{
    name: string

    constructor(name:string){
        this.name = name
    }
    sayHello(){
        console.log('HelloWorld')
    }
}
```



##### 封装

封装是为了防止外部对属性进行修改，使用`private`进行修饰的属性则为私有属性（属性默认值为`public`），不允许在函数外部进行访问



```typescript
//定义动物类
class Animal{
    private name: string
    //创建构造函数
    constructor (name:string){
        this.name = name
    }

    //通过函数来获得内部的name
    getName(){
        return this.name
    }

    //ts提供的get方法来获取name
    get _name(){
        console.log('执行get _name()')
        return this.name
    }

    //通过函数来设置内部的name
    setName(name:string){
        this.name = name
    }

    //ts提供的set方法来设置name
    set _name(name:string){
        console.log('执行set _name()')
        this.name = name
    }

    sayHello(){
        console.log('动物在叫')
    }
}
const animal = new Animal('dog')

animal.setName('cat')

console.log(animal.getName())//输出 cat

console.log(animal._name)//调用get方法

animal._name = 'tiger' //调用set方法
```



##### 泛型

在定义函数或者类时，如果遇到类型不明确时可以使用泛型



```typescript
//定义一个泛型为K，只有函数执行时才知道K的类型
function fn<K>(a: K): K{
    return a
}

//调用时候会自动判断传入的类型
let result = fn(10)
console.log(typeof result)

//手动指定泛型为string
let result2 = fn<string>('hello')
console.log(typeof result2)

//定义接口
interface Inter{
    length: number 
}
//让T继承接口Inter的类型
function fn2<T extends Inter>(a:T): number{
    return a.length
}

console.log(fn2('123')) //输出3
```


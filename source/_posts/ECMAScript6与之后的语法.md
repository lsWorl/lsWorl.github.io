---
title: ECMAScript6与之后的语法
date: 2022-04-17 17:06:47
categories: javascript
top: true
tags:
 - es6
 - javascript
---

**注意：具体内容可以去参考[ECMA](https://www.ecma-international.org/)官方文档，这里只是对某些语法进行总结与参考**

### ES6语法

#### 变量声明

`let`不能重复声明`var`可以重复声明

`let`用来声明变量`const`用来声明常量`const`声明后不可以重新赋值，`let`可以重新赋值。`const`一定要赋初始值。

cs6后新增了块级作用域，使用`let`和`const`声明只在代码块中生效

`let`和`const`不存在变量提升，用`var`声明变量会参与预加载

而且不影响作用域链

```javascript
{
    let example = '例子'
    function fn(){
        console.log(example)
    }
    fn() //最终输出'例子'
}
```



#### 解构赋值

ES6允许按照一定模式从数组和对象中提取值，对变量进行赋值，这称为解构赋值

```javascript
//数组解构
const example = ['例子1','例子2','例子3']
let ['example1','example2','example3'] = example
//对象解构
const exampleObj = {
    title: 'title',
    content: 'content',
    fn: function(){
        console.log('这是一个方法')
    }
}
//let {title,content,fn} = exampleObj
//可以单独解构出某一条你想用的方法或参数，可以直接调用函数
let {fn} = exampleObj
fn();

//可以多级解构赋值，以对象为例子
const reduplicate = {
    title: 'title',
    content: 'content',
    obj:{
        innterTitle: '内部标题'
    }
}
let {obj:{innterTitle}} = reduplicate
console.log(innterTitle)//控制台输出'内部标题'
```



#### 模板字符串

ES6引入了新的声明字符串方式`[``]`

特性：

```javascript
//内容可以直接出现换行符
let str = `<ul>
			<li>不会报错</li>
			</ul>`
//可以进行变量拼接
let example = '例子1'
let out = `${example}是第一个例子` //${}是固定格式，里面放要拼接的变量名
console.log(out)//输出'例子1是第一个例子'
```



#### 简化对象写法

ES6 允许在大括号里面，直接写入变量和函数，作为对象的属性和方法

```javascript
let example = '例子1'
let fn = function(){
    console.log('fn')
}
const obj = {
    //完整写法
    //example:example,
    //fn:fn
    //简化写法
    example,
    fn,
    //可以简化对象写法，不用再加function
    Second:(){
    console.log('第二个')
}
}
```



#### 箭头函数

箭头函数this始终指向函数声明时所在作用域下的this的值

普通函数this谁调用指向谁

```javascript
//判断箭头函数this指向
function fn1(){
    console.log(this.a)
}
let fn2 = () => {
    console.log(this.a)
}
//设置window的a属性
window.a = 'window中的a'
const obj = {
    a: '对象中的a'
}
fn1()//输出'window中的a'
fn2()//输出'window中的a'

//接下来用call方法来调用改变this
fn1.call(obj)//对象中的a
fn2.call(obj)//输出'window中的a'

```



箭头函数不能作为构造实例化对象

```javascript
//判断箭头函数是否能构造实例化对象
let Person = (name,age) =>{
    this.name = name
    this.age = age
}
let i = new Person('h',20)
console.log(i)//结果报错Person is not a constructor
```



箭头函数不能使用`arguments`变量（arguments是函数内部用来保存实参）

```javascript
//判断箭头函数是否能使用使用arguments变量
let fn = function (){
	console.log(arguments)
}
fn(1,2,3)//输出Arguments

let fn2 = ()=>{
    console.log(arguments)
}
fn(1,2,3)//结果报错arguments is not defined
```



箭头函数的简写

```javascript
//当形参有且只有一个的时候可以省略小括号
let add = n => {
    return n + n ;
}
console.log(add(1))//输出'2'
//当代码提只有一条需要return语句的时候，可以省略花括号
let pow = n => n*n
console.log(pow(2))//输出'4'
```



#### 函数参数默认值

ES6允许给函数参数赋值初始值

```javascript
//具有默认值的参数，一般位置要靠后
function add(a=1,b=2,c=3){
    return a + b + c
}
let result = add()
console.log(result)//输出'6'
```

可以与解构赋值相结合

```javascript
//没有传参数则用初始值
function connect({host='127.0.0.1',username}){
    console.log(host)//输出'127.0.0.1'
    console.log(username)//输出'root'
}
connect({
    username:'root'
})
```



#### `rest`参数

ES6引入`rest`参数，用于获取函数的实参，用来代替`arguments`

```javascript
function date(...args){
    console.log(args)//输出的是数组，可以使用数组的API，arguments输出的是对象
}
date('数据','数据2')
//如果要形参有多个，rest参数必须要放在最后
```



#### 拓展运算符

[...]扩展运算符能将[数组]转换为逗号分隔的[参数序列]

```javascript
//声明一个数组
const example = ['例子1','例子2','例子3']
//声明一个函数
function fn(){
    console.log(arguments)//输出对象，对象中包含'0: "例子1"  1: "例子2"  2: "例子3"'
}
fn(...example)
```



扩展运算符可以用于数组的合并

```javascript
const example = ['例子1','例子2','例子3']
const example2 = ['例子4','例子5','例子6']
//const gather = example.concat(example2)  传统方法
const gather = [...example,...example2]
console.log(gather)//输出['例子1', '例子2', '例子3', '例子4', '例子5', '例子6']
```



还能将伪数组转为真正的数组

```html
<body>
    <div>
    </div>
    <div>
    </div>
    <div>
    </div>
</body>
<script>
	const divs = document.querySelectorAll('div')
    const divArr = [...divs]
    console.log(divArr)//输出 [div, div, div]
</script>
```



#### `Symbol`数据类型

`ES6`引入了一种新的原始数据类型`Symbol`，用来表示独一无二的值，是一种字符串类型。

`Symbol`特点

1. `Symbol`的值是唯一的，用来解决命名冲突的问题。
2. `Symbol`值不能与其他数据进行运算。
3. `Symbol`定义的对象属性不能使用 `for...in` 循环遍历，但是可以使用`Reflect.ownKeys`来获取对象的所有键名。

```javascript
//创建Symbol
let s = Symbol('例子')
let s2 = Symbol('例子')
console.log(s2 === s)//输出false

//Symbol.for 创建
let s3 = Symbol.for('例子')
let s4 = Symbol.for('例子')
console.log(s3===s4)//输出true

//在不确定对象里是否有要创建的值的时候可以使用Symbol来添加方法
//向对象中添加up down方法
let game= {
    up: function(){
        console.log('gameup')
    }
}
let methods = {
    up: Symbol(),
    down: Symbol()
} 
game[methods.up] = function(){
    console.log('up')
}
game[methods.down] = function(){
    console.log('down')
}

game.up()//输出'gameup'
game[methods.up]()//输出'up'

//在对象中直接定义Symbol
const example = Symbol('example')
const obj = {
   [example]: function(){
       console.log('例子')
   } 
}
obj[example]()//输出'例子'
```



`Sybol`的`hasInstance()`可以自己控制类型检测值。

```javascript
class Person{
    static [Symbol.hasInstance](param){//param是判断类型的值
        console.log(param)//这里因为和o判断所以输出的就是{}
        return true
    }
}
let o = {}
console.log(o instanceof Person)//因为上方return true 输出的就是true
```

剩下的方法可以通过官方文档了解更多，这里就不过多赘述了。



#### 迭代器（iterator）

迭代器（iterator）是一种接口，为各种不同的数据结构提供统一的访问机制。任何数据结构只要部署Iterator接口，就可以完成遍历操作。

`ES6`创造了一种新的遍历命令`for...of`循环，iterator接口主要供`for...of`消费

原生具备iterator接口的数据

- Array
- Arguments
- Set
- Map
- String
- TypedArray
- NodeList

```javascript
//只要有Symbol.iterator()就可以使用for...of
const e = ['exam','exam2','exam3']
//先用for...in循环遍历
for(let v in e){
    console.log(v)//保存的是键名，输出'0 1 2'
}
//使用for...of遍历
for(let v of e){
    console.log(v)//保存的是键值，输出'exam exam2 exam3
}
```

**工作原理**

- 创建一个指针对象，指向当前数据结构的起始位置
- 第一次调用对象的`next`方法，指针自动指向数据结构的第一个成员
- 接下来不断调用`next`方法，指针一直往后移动，直到指向最后一个成员
- 每调用`next`方法返回一个包含`value`和`done`属性的对象
- 当`value`为`undefined`且`done`为`true`时，结束调用

```javascript
//手写调用iterator()
//声明一个对象
const obj = {
    name:'name',
    arr:[
        'arr1',
        'arr2',
        'arr3'
    ],
    [Symbol.iterator](){//对象中没有迭代器方法，我们手动添加
        //用索引变量来判断是否超过了数组的长度
        let index = 0
        return{
            next: ()=>{
                if(index < this.arr.length){
                    const result = {//原本的迭代器需要返回value和done属性，所以我们也要添加上
                    	value: this.arr[index],
                    	done:false,
                	}
                    index++
                    return result
                }else{
                    return {value:undefined , done:true}
                }
            }
        }
    }
}
//遍历这个对象,不使用obj.arr拿到arr中数据
for(let v of obj){
    console.log(v)//结果输出'arr1 arr2 arr3'
}
```



#### 生成器

生成器函数是ES6提供的一种异步编程解决方案，语法行为与传统函数完全不同

生成器是一种特殊的函数

```javascript
//生成器函数必须要加*
function * gen(){
    console.log('helloWorld')
    //内部可以使用yield来作为分隔符
    yield 'slide'
    console.log('helloHTML')
    yield 'slide2'
    console.log('helloJS')
    yield 'slide3'
}
let iterator = gen()
//使用迭代器方法调用
iterator.next()//输出'helloWorld'
iterator.next()//输出'helloHTML'
iterator.next()//输出'helloJS'
//也可以使用for...of遍历
for(let v of gen()){
    console.log(v)//输出'helloWorld' 加上分隔符名 'slide' 'helloHTML' 加上分隔符名 'slide'以此类推
}
```



生成器函数参数传递

```javascript
function * gen(){
    let one = yield 111
    console.log(one)//输出next()传递的'one中的BBB'
    let two = yield 222
    console.log(two)//输出next()传递的'two中的BBB'
    let three = yield 333
    console.log(three)//输出next()传递的'three中的BBB'
}
const interator = gen()
interator.next()//第一次调用
interator.next('one中的BBB')//第二次调用作为第一次yield的返回结果
interator.next('two中的BBB')//第三次调用作为第二次yield的返回结果
interator.next('three中的BBB')//第四次调用作为第三次yield的返回结果
```



#### Promise

`promise`是`ES6`引入的异步编程的新解决方案。用来封装异步操作并可以获取其成功或失败的结果

- `Promise`构造函数：`Promise(excutor){}`
- `Promise.prototype.then`方法
- `Promise.prototype.catch`方法(就是捕获`promise`失败,这里就不过多介绍了)

```javascript
//实例化Promise
const p = new Promise((resolve,reject)=>{
    setTimeout(()=>{
        const data = '数据'
        resolve(data)//调用resolve即为成功
        const err = '错误'
        //reject(err)  调用reject即为失败
    },1000)
})
//then方法返回的也是promise对象，可以继续调用promise方法。状态由回调函数的结果决定
//如果返回的是非promise类型的属性，状态为成功，返回值为对象的成功值
//then中是异步调用，Promise中式同步调用
const result = p.then(value=>{ 
    console.log(value)//输出'数据'
    return throw 1 //不返回默认undifiend 返回错误或者在promise中调用reject都是返回失败的promise
},reason=>{//失败时候会调用reason
})
console.log(result) //输出中PromiseResult值为1
```



#### Set(集合)

`ES6`提供了新的数据结构`Set`(集合)。它类似于数组，但成员的值都是唯一的，集合实现了`iterator`接口，所以可以使用扩展运算符和`for...of`进行遍历

```javascript
const s = new Set([1,2,1,3,4])//自动去重1就只输出一次
console.log(s)//输出Set中包含'1 2 3 4'

console.log(s.size)//输出'4' 类似数组length方法

s.add(5) //添加新的元素
console.log(s)//输出Set中包含'1 2 3 4 5'

s.delete(1)//删除元素
console.log(s)//输出Set中包含'2 3 4 5'

console.log(s.has(5))//检测是否有5这个元素  输出'true'

s.clear()//清空集合
console.log(s)//输出元素为空
```



#### Map

`ES6`提供了`Map`数据结构。它类似于对象，也是键值对的集合。但是“键”的范围不限于字符串，各种类型的值（包括对象）都可以当作键。`Map`也实现了`iterator`接口，所以可以使用扩展运算符和`for...of`进行遍历

```javascript
let m = new Map()
let key = {
    title:'title'
}
m.set(key,['title1','title2'])
console.log(m)//元素的键为对象，值为数组

//查看长度
console.log(m.size)//输出1

//获取元素
console.log(m.get(key))//输出的是上方数组

//删除元素
console.log(m.delete(key))//返回true
console.log(m)//为空对象
```



#### Class类

`ES6`提供了更接近传统语言的写法，引入了`Class`（类）这个概念，作为对象的模板。通过class关键字，可以定义类。基本上，`ES6`的`class`可以看作只是一个语法糖，它的绝大部分功能，`ES5`都可以做到，新的`class`写法只是让对象原型的写法更加清晰、更加面向对象编程的语法

```javascript
class Phone{
    //构造方法 名字不能修改
    constructor(brand, price){
        this.brand = brand
        this.price = price
    }
    //方法必须使用该语法，不能使用ES5的对象完整写法
    call(){
        console.log('我可以打电话')
    }
}

let HW = new Phone('max' , 9999)
console.log(HW)//输出函数
```



static静态成员

```javascript
class Phone{
    //使用static标识的只属于Phone这个类
    static name = '手机'
}
let nokia = new Phone()
console.log(nokia.name)//输出'undifined'
console.log(Phone.name)//输出'手机'
```



对象继承

```javascript
//ES6之前实现继承，原理是使用原型链来实现继承
function Phone(brand,price){
    this.brand = brand
    this.price = price
}

Phone.prototype.call = function(){
    console.log('我可以打电话')
}

//子级构造函数
function SmartPhone(brand,price,color,size){
    Phone.call(this,brand,price)//用call()方法改变this指向
    this.color = color
    this.size = size
}

//设置子级构造函数的原型
SmartPhone.prototype = new Phone
SmartPhone.prototype.constructor = SmartPhone

//声明调用子类的方法
SmartPhone.prototype.photo = function(){
    console.log('我可以拍照')
}

const chuizi = new SmartPhone('锤子',2499,'黑色','5.5')
console.log(chuizi)//父类方法在原型链上
```



```javascript
//ES6实现继承
class Phone{
    constructor(brand, price){
        this.brand = brand
        this.price = price
    }
    call(){
        console.log('我可以打电话')
    }
}

class SmartPhone extends Phone {
    constructor(brand,price,color,size){
        //用super来继承父类,super只能再创建对象时候调用，不能直接调用父类方法
        super(brand,price)
        this.color = color
    	this.size = size
    }
    
    photo(){
        console.log('拍照')
    }
    //因为父类有了call方法，子类再添加相同名的方法会进行重写call的方法
    call(){
        console.log('我可以视频通话')
    }
}
const chuizi = new SmartPhone('锤子',2499,'黑色','5.5')
console.log(chuizi)//父类方法在原型链上
chuizi.call()//输出'我可以视频通话'
```



`getter`和`setter`设置

```javascript
class Phone{
    //只要被读取就会触发get方法
    get price(){
        console.log('价格被读取了')
        return 'get返回了'//返回值就是属性值
    }
    set price(newVal){//必须设置参数
        console.log('价格属性被修改了')
    }
}

let s = new Phone()
s.price = '1'
console.log(s.price)//输出'get返回了'
```



#### 数值扩展

```javascript
//Number.EPSILON 是 JavaScript 表示的最小精度 
console.log(0.1 + 0.2 === 0.3)//因为浮点数精度问题 返回的是false
function equal(a,b){
    if(Math.abs(a-b) < Number.EPSILON){//判断传过来的两数之差的绝对值是否小于最小精度
        return true//小于就认为两数相等
    }else{
        return false
    }
}
console.log(equal(0.1+0.2,0.3))//输出true

//Number.isFinite 检测一个数值是否为有限数
console.log(Number.isFinite(100))//返回true
console.log(Number.isFinite(100/0))//返回false

//Number.isNaN 检测是否为NaN
console.log(Number.isNaN(123))//返回false

//Number.isInteger 判断是否为整数
console.log(Number.isInteger(123))//返回true

//Math.trunc 将数字的小数部分抹掉
console.log(Math.trunc(123.123))//输出'123'

//Math.sign 判断一个数为正数 负数 还是零
console.log(Math.sign(123))//输出'1'
console.log(Math.sign(0))//输出'0'
console.log(Math.sign(-123))//输出'-1'
```



#### ES6模块化

模块化是指将一个大的程序文件，拆分成许多小的文件，然后将小文件组合起来。

模块化的好处：

1. 防止命名冲突
2. 代码复用
3. 高维护性

模块功能主要由两个命令构成：`export`和`import`

- `export`用于规定模块的对外接口
- `import`用于输入其他模块提供的功能

```javascript
//要暴露的文件 所有使用的语法就全在这代码块中演示了，不做分割了
export const title = '标题'

export function content(){
    console.log('这里是内容')
}

//统一暴露
const title = '标题'
function content(){
    console.log('这里是内容')
}
export {title,content}

//默认暴露,内容以对象居多
export default {
    title: '标题',
    content: function(){
        console.log('这里是内容')
    }
}
```

```javascript
//引入上方的文件
//通用的导入方式
import * as m1 from './src/js/m1.js' //'*'表示全引入

//解构赋值形式
import {title,content} from './src/js/m1.js' //使用方法就和解构语法一样

//简便形式 针对默认暴露
import m3 from './src/js/m1.js'
```



### ES7新特性

`Array.includes`来判断数组中是否有当前元素

```javascript
const arr = [1,2,3,4,5]
console.log(arr.includes(1))//输出true

//之前可以使用indexOf来判断是否有当前元素，返回的是下标，不存在则返回-1
console.log(arr.indexOf(5))//输出4
console.log(arr.indexOf(6))//输出-1
```



幂运算`**`

```javascript
console.log(2 ** 3 )//输出8
console.log(Math.pow(2,3))//输出8 效果相同
```



### ES8新特性

`async`和`await`可以让异步代码像同步代码一样

`async`函数返回值是`promise`对象

`promise`对象的结果由`async`函数执行的返回值决定

`await`必须写在`async`函数中

`await`右侧的表达式一般为`promise`对象

`await`返回的是`promise`成功的值

`await`的`promise`失败了将会抛出异常，需要通过`try...catch`捕获处理

```javascript
async function fn (){//async中的函数为同步执行
    console.log(111)
}
setTimeout(()=>{
    console.log(333)
},0)
console.log(222)
fn()
//输出结果为 222 111 333
```



### ES9扩展运算符与`rest`参数

`rest`参数与`spread`扩展运算符在`ES6`中以及引入，不过`ES6`中只针对于数组，在`ES9`中为对象提供了像数组一样的`rest`参数和扩展运算符

```javascript
const ip = {
    host:'127.0.0.1'
}
const name = {
    username: 'root'
}
const pwd = {
    password:'root'
}
const connect = {...ip,...name,...pwd}//将三个对象的属性放在了一个对象中
console.log(connect)//输出对象包含上面三个属性
```

**`ES9`新增的正则扩展就不介绍了**



### ES10扩展方法

对象扩展方法`Object.fromEntries`

```javascript
//创建一个二维数组
const result = Object.fromEntries([
    ['name','名字'],
    ['title','标题']
])
console.log(result)//输出{name: '名字', title: '标题'}
//与ES8中的Object.entries相当于逆运算
//Object.fromEntries是把二维数组转换为对象
//Object.entries是把对象转换为二维数组
const arr = Object.entries({
    name:'名字'
})
console.log(arr)//输出[Array(2)]
```



字符串方法扩展

```javascript
//trim用来清除字符串空白字符
//ES10中引入trimStart trimEnd来选择清除开始还是结束的空白字符
let str = '   e    '
console.log(str)//输出'   e    '
console.log(str.trimStart())//输出'e    '
console.log(str.trimEnd())//输出'   e'
```



数组方法扩展

```javascript
//flat 
//将多维数组转化为低维数组
const arr = [1,2,[3,[4,5,6]]]//创建一个三维数组
console.log(arr.flat())//输出  [1, 2, 3, Array(3)]  三维数组变成了二维数组
console.log(arr.flat(2))//输出 [1, 2, 3, 4, 5, 6] 二维数组变成了一维数组  flat默认深度为1
```



### ES11特性

私有属性

```javascript
class Person{
    //公有属性
    name
    //私有属性
    #age
    #weight
    
    constructor(name,age,weight){
        this.name = name
        this.#age = age
        this.#weight = weight
    }
    
    intro(){
        console.log(this.name)
        console.log(this.#age)
        console.log(this.#weight)
    }
}
//实例化
const gril = new Person ('小红', 18 , '45kg')

console.log(gril)
gril.intro()//输出 小红 18 45kg
console.log(gril.#age)//报语法错误，不能在类外部调用
```



`Promise.allSettled`

```javascript
//声明两个promise对象
const p1 = new Promise((resolve,reject)=>{
    setTimeout(()=>{
        resolve('第一个')
    },1000)
})
const p2 = new Promise((resolve,reject)=>{
    setTimeout(()=>{
        reject('第二个')
    },1000)
})
//调用allSettled方法
const result = Promise.allSettled([p1,p2])
console.log(result)//输出promise成功的值和结果数组  无论结果失败成功都会输出成功状态

//调用all方法
const result2 = Promise.all([p1,p2])
console.log(result2)//值为失败并报错
```



可选链操作符

```javascript
// ?. 用于判断前前面的值是否存在
function main(config){
    const db = config && config.db && config.db.host //原先的判断方法，当全为true再赋值
    const newDb = config?.db?.host
    console.log(db)//输出172.0.0.1
    console.log(newDb)//输出172.0.0.1
}
main({
    db:{
        host:'172.0.0.1'
    }
})

```



动态`import`

```javascript
//要引入的文件
export function fn(){
    console.log('这是要暴露的文件')
}
```



```javascript
//在要使用的时候在引入文件
import('./fn').then(module=>{ //是一个promise对象  路径是我随便瞎写的，根据实际情况调整
    console.log(moudule)//使用的时候才会调用
})
```



`BigInt`

```javascript
let n = 123n //加了n就表示大整形，bigInt用于更大数值的运算，bigInt不能和普通整形运算，必须都为bigInt
let max = Number.MAX_SAFE_INTEGER //获取整数最大安全值
console.log(max)//输出9007199254740991
console.log(n+BigInt(max))//输出9007199254741114n
console.log(n+ 1)//报错
```



`globalThis`如字面意思，`this`始终指向全局对象，无论在任何环境，这里就不作代码介绍了。

------



> 目前就到这里先结束了，以后要是有新总结会新添加
>
> 文章参考了尚硅谷的ES6教程，非常感谢老师们的辛勤付出！！！


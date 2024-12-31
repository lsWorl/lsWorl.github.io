---
title: JavaScript常见的数组方法与使用
date: 2022-05-26 16:50:06
categories: JavaScript
tags:
 - JavaScript
---





数组Array是大家日常开发中使用的比较多的数据类型，这里就不进行过多赘述了，本文主要介绍一些数组常用的方法与操作，以供在写算法或在开发中更好的解决问题。（这里只做了一些我平常用到较多的方法，更多的方法参考[MDN Web Docs (mozilla.org)](https://developer.mozilla.org/zh-CN/)官方文档）

#### 数组的常见操作

##### 创建数组

```javascript
//使用new Array()创建数组
let arr = new Array(1,2,3)

console.log(arr) //[1, 2, 3]
//使用字面量来创建数组
let arr = [1,2,3]

console.log(arr) //[1, 2, 3]
```



##### 访问数组元素

```javascript
let arr = [1,2,3]

console.log(arr[0]) // 1
console.log(arr[3]) // undefined JavaScript中访问一个不存在的元素不会报错，会返回undefined
```



##### 遍历数组

```javascript
//使用for循环遍历数组
let arr = [1,2,3]
for(let i = 0; i <arr.length; i++){
    console.log(arr[i]) //依次输出 1 2 3
}

//使用for...of遍历数组
let arr = [1,2,3]
for(let value of arr){
    console.log(value) //依次输出 1 2 3
}

//使用forEach进行遍历数组
let arr = [1,2,3]

arr.forEach((item,index,array)=>{ //item表示内容 index表示索引值 array表示原数组
    console.log(item,index,array) //依次输出 "1 0 [1, 2, 3]" "2  (3) [1, 2, 3]" "3 2 (3) [1, 2, 3]"
})
```



##### 添加元素到数组的末尾

```javascript
let arr = [1,2,3]

arr.push(4) //使用push()方法会改变原数组
console.log(arr) // [1, 2, 3, 4]
```



##### 添加元素到数组的首部

```javascript
let arr = [1,2,3]

arr.unshift(4) //使用unshift()方法会改变原数组
console.log(arr) // [4, 1, 2, 3]
```



##### 删除数组末尾的元素

```javascript
let arr = [1,2,3,4]

arr.pop() //使用pop()方法会改变原数组
console.log(arr) // [1, 2, 3]
```



##### 找出某个元素在数组中的索引

```javascript
let arr = ['元素1','元素2','元素3']

//使用indexOf value存在返回index 不存在则返回-1
console.log(arr.indexOf('元素2')) // 1
console.log(arr.indexOf('元素4')) // -1
```



##### 通过索引删除元素

语法

`splice(start,deleteCount,item1,...)`

- `start`用于指定修改的开始位置（从0计数）
- `deleteCount`表示要移除的数组元素的个数
- `item1,...`表示要添加仅数组的元素，从`start`位置开始



```javascript
let arr = ['元素1','元素2','元素3']
let newArr = arr.splice(0,1) //使用splice改变原数组内容并返回包含删除元素的新数组

console.log('原数组',arr,'新数组',newArr) // 原数组 ['元素2', '元素3'] 新数组 ['元素1']
```



##### 复制一个数组

```javascript
let arr = ['元素1','元素2','元素3']
let newArr = arr.slice()

console.log('原数组',arr,'新数组',newArr) // 原数组 ['元素1', '元素2', '元素3'] 新数组 ['元素1', '元素2', '元素3']
console.log(arr === newArr) // false 此为深拷贝，修改新数组不会影响原数组

newArr.push('元素4')
console.log('原数组',arr,'新数组',newArr) //原数组 ['元素1', '元素2', '元素3'] 新数组 ['元素1', '元素2', '元素3', '元素4']
```



### 数组常见方法

了解数组的一些基本操作后，可以使用JavaScript中数组方法能协助我们更好的开发。

#### `Array.from()`

对一个类似数组或可迭代对象创建一个新的，浅拷贝的数组实例。

##### 语法

`Array.from(arrayLike,mapFn,thisArg)`

- `arrLike`表示想要转换成数组的伪数组对象或可迭代对象
- `mapFn`可选参数，为新数组中每个元素都会执行的回调函数
- `thisArg`可选参数，执行回调函数`mapFn`时的`this`对象

`from()`返回值为一个新的数组实例

`from()`函数主要将`String`、`Set`、`Map`或类数组对象转变为数组，也可以在转变时做逻辑处理

```javascript
let str = 'abc'


let arr = [1,2,3]
console.log(Array.from(arr,(x)=>x+x)) // [2, 4, 6] 

let s = new Set([1,2,2]) //它类似于数组，但成员的值都是唯一的
console.log(Array.from(s)) // [1, 2]

let mapper = new Map([['1','abc'],['2','bcd']]) //它map类似于对象，也是键值对的集合
console.log(Array.from(mapper)) // ['1', 'abc'],['2', 'bcd']
```



#### `Array.isArray()`

用来判断某个变量是否是一个数组对象



```javascript
Array.isArray([1, 2, 3]);  // true
Array.isArray({foo: 123}); // false
Array.isArray('foobar');   // false
```



#### `Array.prototype.concat()`

用于合并两个或多个数组。此方法不会更改现有数组，而是返回一个新数组。（在ES6后有拓展运算符可以直接实现数组的合并）



```javascript
let arr = [1,2,3]
let arr2 = [4,5,6]
let arr3 = [...arr,...arr2]
console.log(arr.concat(arr2)) // [1, 2, 3, 4, 5, 6]
console.log(arr3) // [1, 2, 3, 4, 5, 6]
```



#### `Array.prototype.fill()`

此方法用第一个传入的参数作为固定值，将起始索引值到终止索引值的所有值都用固定值来填充。

**此方法会对原数组进行修改，不会开辟新的内存**

##### 语法

`arr.fill(value,start,end)`

- `value`表示用于填充数组的固定值
- `start`可选值，起始索引，默认为0。如果是负数则会被自动计算为`length+start`
- `end`可选值，终止索引，默认值为`this.length`，即数组的长度。如果是负数则会被自动计算为`length+end`
- 返回值为修改后的数组



```javascript
let array1 = ['a', 'b', 'c'];
let array2 = array1.fill('d',0,1)

console.log(array2) // ['d', 'b', 'c']
console.log(array1 === array2) // true

let array3 = [1,2,3,4]
let array4 = array3.fill(5,-4,-3)

console.log(array4) // [5, 2, 3, 4]
```



#### `Array.prototype.filter()`

用于过滤出数组中想要的元素**（这种方法不会改变原数组）**

##### 语法

`arr.filter(callback,element,index,array,thisArg)`

- `callback`表示要执行的回调函数，所有逻辑都写在这个参数中
- `element`表示当前在回调函数中正在处理的元素
- `index`可选值，表示当前在回调函数中正在处理的元素的索引值
- `array`可选值，数组本身
- `thisArg`可选值，执行`callback`回调函数的`this`的值
- 返回值为一个新的过滤后的数组，若没有元素符合回调函数的逻辑判断则返回空数组

在`callback`调用可以传入三个参数

1. 元素的值
2. 元素的索引
3. 被遍历的数组本身



```javascript
let arr = [10,20,30,40,50]
let arr2 = arr.filter( x => x > 20 )

console.log(arr2) //[30, 40, 50]
console.log(arr) //[10, 20, 30, 40, 50]
```





#### `Array.prototype.map()`

这个方法会创建一个新数组，这个新数组由原数组中的每个元素都调用一次提供的函数后的返回值组成。(类似于`arr.filter`，与`arr.filter`不同的是`arr.map`方法数组的个数是不会改变的)

##### 语法

`arr.map(callback,currentValue,index,array,thisArg)`

- `callback`表示要执行的回调函数，所有逻辑都写在这个参数中
- `currentValue`表示当前在回调函数中正在处理的元素
- `index`可选值，表示当前在回调函数中正在处理的元素的索引值
- `array`可选值，数组本身
- `thisArg`可选值，执行`callback`回调函数的`this`的值
- 返回值为由原数组每个元素执行回调结果返回所组成的新数组，不符合的则返回`undefined`

在`callback`调用可以传入三个参数

1. 元素的值
2. 元素的索引
3. 被遍历的数组本身



```javascript
let arr = [1,2,3,4,5,6,7]
let arr2 = arr.map(value=>{
let num = 0
if(value > 4){
let num = value
return num
}
})
console.log(arr2) // [undefined, undefined, undefined, undefined, 5, 6, 7]
console.log(arr) // [1, 2, 3, 4, 5, 6, 7]
```



在`callback`调用可以传入三个参数

1. 元素的值
2. 元素的索引
3. 被遍历的数组本身



#### `Array.prototype.find()`

返回数组中满足提供的测试函数的第一个元素的值，否则返回 `undefined`

##### 语法

`arr.find(callback,element,index,array,thisArg)`

这个方法的内容与`arr.filter`基本相似，就不过多赘述了

返回值为数组中第一个满足要求的元素的值



```javascript
let arr = ['apple','peach','application']
let arr2 = arr.find((value)=>{
    let reg = /^ap/gi  //匹配以ap开头的字母
    return reg.test(value) 
})
console.log(arr2) // apple
```



#### `Array.prototype.flat()`

用于数组扁平化(此方法不会改变原数组)

##### 语法

`arr.flat(depth)`

- `depth`需要扁平的深度，默认为1
- 返回扁平后的新数组



```javascript
let arr = [1,[2,3,[4,5,6]]]
			
console.log(arr.flat()) // [1, 2, 3, Array(3)]
console.log(arr.flat(2)) // [1, 2, 3, 4, 5, 6]
console.log(arr) //[1, Array(3)]
```



#### `Array.prototype.includes()`

用来判断数组中是否包含指定的值，有返回`true`，没有返回`false`

##### 语法

`arr.includes(valueToFind,fromIndex)`

- `valueToFind`表示需要查找的值
- `fromIndex`可选值，从`fromIndex`开始查找值，如果为负值，则按升序从 `array.length + fromIndex`（要是计算还为负的话则默认为全部搜索） 的索引开始搜 ，默认为0



```javascript
let arr = [1,2,3,4,5,6]

console.log(arr.includes(2)) // true
console.log(arr.includes(7)) // false
console.log(arr.includes(2,-100)) //true
```



#### `Array.prototype.indexOf()`

用来查找给定元素的第一个索引值，有返回索引值，没有则返回-1

##### 语法

`arr.indexOf(searchElement,fromIndex)`

- `searchElement`表示要查找的元素
- `fromIndex`可选值，表示开始查找的位置，如果该索引值大于或等于数组长度，则直接返回-1。要是该值为-1则表示从数组的最后一位开始查找，-2表示从倒数第二个元素开始查找 ，以此类推。注意：如果参数中提供的索引值是一个负值，并不改变其查找顺序，默认值为0



```javascript
let arr = [1,2,3,4,5,6]

console.log(arr.indexOf(4)) // 3
console.log(arr.indexOf(4,-1)) // -1
console.log(arr.indexOf(6,-1)) // 5
```



#### `Array.prototype.join()`

将数组拼接称为一个字符串

##### 语法

`arr.join(separator)`

- `separator`可选值，指定一个字符串来分割数组的每个元素，默认用","
- 返回值为数组元素连接的字符串，如果数组没有元素则返回空字符串。如果一个元素为 `undefined` 或 `null`，它会被转换为空字符串。



```javascript
let arr = ['a','p','p','l','e']
			
console.log(arr.join()) // a,p,p,l,e
console.log(arr.join('')) // apple
```



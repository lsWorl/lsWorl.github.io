---
title: node.js初步学习
date: 2022-07-08 12:22:21
categories: node.js
top: true
tags:
 - node.js

---



### 命令行运行node.js

`app.js`为要运行的主程序文件。

```bash
node app.js
```



#### 退出node.js程序

```javascript
console.log(123)
process.exit(1)  
console.log(1234) //1234 将不会输出
```

exit(1)中 exit()括号中默认的退出码为0，表示成功。



### 在node.js中导入其他包

`node.js`中使用的模块化语法为`common.js`，所以在导入文件时使用`require`，暴露文件则用`exports`



#### 第一种方式

```js
//export.js文件
const obj = {
  name: '小王'
}
module.exports = obj
```



```js
//导入文件
const obj = require('./export.js')
console.log(obj) //控制台输出 { name: '小王' }
```



#### 第二种方式

```js
//export.js文件
exports.person = {
  name: '张三',
  age: 20
}
```



```js
const obj = require('./export.js')

console.log(obj.person) //控制台输出 { name: '张三', age: 20 }
```



#### 两个方式的区别

`module.exports`公开了它指向的对象。 `exports.obj`公开了它指向的对象的属性。

**当`module.exports`和`exports.obj`共同使用时会默认使用`module.exports`**



### `package-lock.json`文件介绍

该文件主要锁定项目目前所使用的所有`npm`包的版本号，当其他用户在`git`等平台使用了你的代码时能保证所依赖包的版本相同导致一些不必要的错误。

`package-lock.json` 文件需要被提交到 Git 仓库，以便被其他人获取（如果项目是公开的或有合作者，或者将 Git 作为部署源）。

**当运行 `npm update` 时，`package-lock.json` 文件中的依赖的版本会被更新。**



### Node.js中的函数

#### process.nextTick()

该函数类似于`Promise`，可以异步执行其中的代码，执行顺序在计时器之前

```js
console.log(123)
setTimeout(() => {
  console.log(123456)
}, 0);
process.nextTick(()=>{
  console.log(1234)
})
console.log(12345)

//最终输出 123 12345 1234 123456
```



#### setImmediate()

该函数也是将数据进行异步处理，顺序在`process.nextTick()`之后，与定时器的顺序根据定时器的时间而变。

```js
console.log('外部内容1')
setImmediate(()=>{
  console.log('setImmediate')
})
setTimeout(() => {
  console.log('setTimeout')
},0);
process.nextTick(()=>{
  console.log('nextTick')
})
console.log('外部内容2')

//最终输出 外部内容1 外部内容2 nextTick setTimeout setImmediate
```





### Node.js事件触发器

类似于vue中的子组件与父组件的参数传递

```js
const { EventEmitter } = require('stream')
const eventEmitter = new EventEmitter()
//用 on来添加触发器
eventEmitter.on('start',(num1,num2)=>{
  console.log(`数字，${num1}+${num2}`)
})
//用emit触发触发器
eventEmitter.emit('start',1,2)
```



### 搭建HTTP服务器

搭建一个简单的HTTP web 服务器

```js
//获取HTTP模块
const http = require('http')
// 设置端口号
const port = 3000
// 创建
const server = http.createServer((req, res) => {
  //req接收浏览器传的参数
  //res 返回渲染的内容
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html;charset=utf-8')
  res.end('你好世界\n')
})

// 监听端口是否被访问，访问则输出其中内容
server.listen(port, () => {
  console.log(`服务器已经启动`)
})
```


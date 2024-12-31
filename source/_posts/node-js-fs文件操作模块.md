---
title: node.js-fs文件操作模块
date: 2022-07-14 12:15:32
categories: node.js
tags:
 - node.js
---









### fs文件操作模块

`fs`作为node.js的内置模块，只需用`require("fs")`引入后即可使用。可以用js来实现对计算机文件的增删改查操作



#### 创建目录

```js
//在根目录下创建avatar文件夹 创建成功err为null，反之则有失败的原因
fs.mkdir('./avatar',(err)=>{
  console.log(err)
})
```



#### 目录重命名

```js
//将avatar改名为avatar2
fs.rename('./avatar','./avatar2',err=>{
  console.log(err)
})
```



#### 删除目录

```js
//删除名为avatar2的目录
fs.rmdir('./avatar2',err=>{
  console.log(err)
})
```



#### 往文件中写入数据  会覆盖其中内容

```js
//往text.txt文件中写入helloworld 文件不存在会自动创建
fs.writeFile('./text.txt','helloWorld',err=>{
   console.log(err)
})
```



#### 往文件中追加数据

```js
//往text.txt文件中追加123 文件不存在会自动创建
fs.appendFile('./text.txt','\n123',err=>{
  console.log(err)
})
```



#### 读取文件 

```js
// 读取的为字符流需转换 文件不存在则data为undefined 并且err有值
fs.readFile('./text.txt','utf-8',(err,data)=>{
   console.log(data.toString())
})
```



#### 删除文件

```js
fs.unlink('./text.txt',err=>{
   console.log(err)
 })
```



#### 读取文件夹下的所有文件名和文件类型

```js
//读取dir目录下的所有文件 目录不存在则报错 返回值为数组
fs.readdir('./dir',(err,data)=>{
   console.log(data)
})
```



#### 同步删除文件

```js
fs.readdir('./dir',(err,data)=>{
   data.forEach(item=>{
     //使用Sync会将异步代码转为同步执行
     fs.unlinkSync(`./dir/${item}`)
   })
```



#### Promise读取文件

使用`promise`需要读取fs模块下的`promises`方法，即`const fs = require('fs').promises`



```js
//这样读取的好处是不需要用sync来特地将代码转换为同步读取
fs.mkdir('./dir').then(res=>{
   console.log(res)
 })
```



#### 使用Promise来删除文件夹下的所有文件

```js
try {
   fs.readdir('./dir').then((data)=>{
     data.forEach(item=>{
       fs.unlink(`./dir/${item}`)
     })
  	 //删除内部文件后再删除目录
     fs.rmdir('./dir')
   })
 } catch (error) {
   console.log(error)
 }
```


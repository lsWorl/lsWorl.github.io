---
title: node.js-http模块
date: 2022-07-12 15:20:19
categories: node.js
tags:
 - node.js
---







### 启动服务器热更新

默认方式重启服务器为`node file`。

在全局安装`npm i -g nodemon`后可以自动服务器热更新

输入命令`nodemon file`即可开启热更新



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



#### url模块介绍

在引入`url`模块后，可以很好的对路由参数进行处理。

首先要使用`new URL(input[, base])`对路径进行解析

```js
const url = require('url')

const myURL =
  new URL('https://user:pass@sub.example.com:8080/p/a/t/h?query=string#hash');
  console.log(myURL)

```

上方输出一个对象

```js
{
  href: 'https://user:pass@sub.example.com:8080/p/a/t/h?query=string#hash',
  origin: 'https://sub.example.com:8080',
  protocol: 'https:',
  username: 'user',
  password: 'pass',
  host: 'sub.example.com:8080',
  hostname: 'sub.example.com',
  port: '8080',
  pathname: '/p/a/t/h',
  search: '?query=string',
  searchParams: URLSearchParams { 'query' => 'string' },
  hash: '#hash'
}
```



当传入的`input`为相对路径的情况下

```js
const url = require('url')

const myURL = new URL('/foo', 'https://example.org/');
console.log(myURL)
// https://example.org/foo
```



#### http服务器端发请求

因为在浏览器端向服务器发送数据有时候会产生跨域问题，而在服务器端互相发送请求不会产生跨域，就产生用node来作为中间件进行发送请求，然后再将node获取的数据传回给前端，这样就不会产生跨域问题。

```js
//获取HTTP模块
const http = require('http')
const https = require('https')
// 设置端口号
const port = 3000
// 创建
const server = http.createServer((req, res) => {
  res.writeHead(200,{
     //设置请求头
    "Content-Type": "application/json;charset=utf-8",
    //允许跨域
    "access-control-allow-origin": "*"
  })
  //调用get方法  以回调函数形式写入数据
  httpGet(data=>{res.end(data)})
    
  //调用post方法 
  //HttpPost(data=>{res.end(data)})
})

// 监听端口是否被访问，访问则输出其中内容
server.listen(port, () => {
  console.log(`服务器已经启动`)
})
```



##### 使用http发送get请求

```js
//httpGet 函数 
function httpget(rs){
  let data = ''
  //模拟向猫眼发送请求数据
  https.get('https://i.maoyan.com/api/mmdb/movie/v3/list/hot.json?ct=%E6%9D%AD%E5%B7%9E&ci=50&channelId=4',res=>{
    //返回数据流，在data将数据保存
    res.on('data',chunk=>{
        data +=chunk
    })
	//在end模块将数据返回到服务器中
    res.on('end',()=>{
      rs(data)
    })
  })
}
```



##### 使用http发送post请求

```js
//HttpPost 函数
function HttpPost(cb){
  let data = ''
  //模拟向小米优品获取数据
  let options = {
    hostname:'m.xiaomiyoupin.com',
    //http协议端口号默认80 https协议端口号默认443
    port:'443',
    path:'/mtop/mf/resource/data/batchList',
    method:'POST',
    headers:{
      "Content-Type":"application/json"
    }
  }
  let req = https.request(options,(res)=>{
    res.on('data',chunk=>{
      data +=chunk
    })

    res.on('end',()=>{
      cb(data)
    })
  })

  req.write(JSON.stringify([{}, ["newer_popup_ad", "download_options"]]))
  req.end()
}
```



### node搭建路由

路由作为web开发中不可或缺的一部分，掌握路由可以更好的协助开发，并且能让代码显现的更有条理性。

搭建一个路由总共有以下几部分：

1. 开启服务器
2. 静态资源管理
3. 接口的提供



#### 开启服务器

开启服务器可以直接使用`node`自带的`http`模块

```js
const server = require('http')
server.createServer((req, res) => {
    //这里用于使用下方的api接口路径
    
     console.log(req) 
  }).listen(3000, () => {
    console.log('server start')
  })
```

这样就在本地的3000端口开启了一台本地服务器



#### 静态资源管理

每次访问服务器时，要判断是不是要访问静态资源中的文件，如果是的话要对其访问进行放行。

在编写代码前需要引入node内置的`path`和`fs`模块，即`require('fs')`和`require('path')`

```js
// 静态资源管理
function readStaticFile(res,req){
  const myURL = new URL(req.url,'http://127.0.0.1')
  //__dirname为node内置的静态变量，可以获取当前目录
  //十四用path.join将当前目录和发请求的url地址进行拼接
  pathname = (path.join(__dirname,myURL.pathname))
  if(fs.existsSync(pathname)){
     //这里判断了为css样式的，其他需要额外添加
    setHead(res,'text/css',pathname)
    return true
  }else{
    return false
  }
  // console.log(__dirname,__dirname+myURL.pathname)
}
```

根据上面代码可以做一个简单的静态资源管理，调用该函数判断是属于静态资源范围则认为是合法路径，不是则返回false，进行下一步的逻辑。



#### api接口

这里只写了`get`和`post`两种请求，实际开发可能会根据`Restful`接口规范开发。



```js
//这里定义的apiRouter对象用于暴露给其他模块
const apiRouter = {
    //因为上方在本地3000端口开的服务器，所以当访问 http://127.0.0.1/api/login走当前函数
  '/api/login': (res, req) => {
    const myURL = new URL(req.url, "http://127.0.0.1")
    //这里判断前端传来的参数，即 http://127.0.0.1/api/login?username=123
    if (myURL.searchParams.get('username') === '123') {
      render(res, 'application/json', `{"ok":1}`)
    } else {
      render(res, 'application/json', `{"error":"错误"}`)
    }
  },
  //发送的为post请求
  '/api/loginpost': (res, req) => {
    var post = ''
    //将数据收集
    req.on('data',chunk=>{
      post += chunk
    })
	//当数据收集结束后向前端返回数据
    req.on('end',()=>{
      console.log(post)
      post = JSON.parse(post)
      console.log(post)
      render(res, 'application/json', `{"ok":0}`)
    })

  }
}
//该函数用于复用上方重复的操作
function render(res, type = 'application/json', data, status = 200) {
  res.writeHead(status, { "Content-Type": `${type};charset=utf-8` })
   //end即表示返回给前端的数据
  res.end(data)
}
```


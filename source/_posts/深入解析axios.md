---
title: axios的基本使用
date: 2022-04-21 16:58:04
categories: ajax
top: true
tags:
 - axios
 - ajax
---

**本文的后台数据通过`json-server`来模拟，对`json-server`感兴趣可以去看[typicode](https://github.com/typicode)的github源网站**

#### axios的基本使用

在`axios`的作者[jasonsaayman](https://github.com/axios/axios/commits?author=jasonsaayman)可以看到`axios`的几种引入方式

```
Using npm:
$ npm install axios

Using bower:
$ bower install axios

Using yarn:
$ yarn add axios

Using jsDelivr CDN:
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>

Using unpkg CDN:
<script src="https://unpkg.com/axios/dist/axios.min.js"></script>

```

**这里以`script`方式引入来进行介绍**

##### 使用`axios()`方法来发送请求

```html
<head>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
</head>
<body>
    <button>发送GET请求</button>
    <button>发送POST请求</button>
    <button>发送PUT请求</button>
    <button>发送DELETE请求</button>
    <script>
        //接收数据
        const btns = document.querySelectorAll('button')//获取元素
        btns[0].onclick = function(){
            axios({
                //请求类型
                method: 'GET',//发送GET请求
                //URL
                url: 'http://localhost:3000/posts' //地址是json-server的地址
            }).then(response=>{//axios返回结果是promise，用then方法来接收
                console.log(response)//输出返回结果
            })
        }
        
        //发送数据
        btns[1].onclick = function(){
            axios({
                //请求类型
                method:'POST',//发送POST请求
                //URL
                url: 'http://localhost:3000/posts',//根据json-server的规则来编写地址
            	//设置请求体
                data:{//要发送的数据
                    title:'今天天气不错',
                    author:'张三'
                }//此时在自己的json-server中创建的json文件中就会看到发送到的数据
            })then(response=>{
                console.log(response)//输出返回结果
            })
        }
        
        //更新数据
        btns[2].onclick = function(){
            axios({
                //请求类型
                method:'PUT',//发送PUT请求
                //URL
                url: 'http://localhost:3000/posts/3',// /3表示要修改id为3的内容
            	//设置请求体
                data:{//要发送的数据
                    title:'今天天气不错',
                    author:'李四'
                }//此时在自己的json-server中创建的json文件中就会看到发送到的数据
            }).then(response=>{
                console.log(response)//输出返回结果
            })
        }
        
        //删除数据
        btns[3].onclick = function(){
            axios({
                //请求类型
                method:'DELETE',//发送DELETE请求
                //URL
                url: 'http://localhost:3000/posts/3',// /3表示要删除id为3的内容
            }).then(response=>{
                console.log(response)//输出返回结果
            })
        }
    </script>
</body>
```

##### 使用`axios.request()`来发送请求

```html
<head>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
</head>
<body>
    <button>发送GET请求</button>
    <script>
        const btns = document.querySelectorAll('button')
        btns[0].onclick = function(){
            axios.request({
                method:'GET',//发送GET请求
                url: 'http://localhost:3000/posts'
            }).then(response =>{
                console.log(response)
            })
        }
    </script>
</body>
```

##### 使用`axios.post()`来发送请求

```html
<head>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
</head>
<body>
    <button>发送POST请求</button>
    <script>
        const btns = document.querySelectorAll('button')
        btns[0].onclick = function(){
            //axios.post(url[, data[, config]])
            //post第一个参数为url,第二个为请求体内容,第三个为配置 二三都是可选的
            axios.post('http://localhost:3000/comments',{//向comments部分发送数据
                "body": "some comment",
                "postId": "2"
            }).then(response=>{//发送成功的回调
                console.log(response)
            })
        }
    </script>
</body>
```

多余的`axios`方法基本都与上方相同，就不再过多演示了



##### `axios`默认配置

可以设置一些默认配置来减少代码的冗余

```html
<head>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
</head>
<body>
    <button>发送GET请求</button>
    <script>
        const btns = document.querySelectorAll('button')
        axios.defaults.method = 'GET' //设置默认的请求类型为 GET
        axios.defaults.baseURL = 'http://localhost:3000' //设置基础URL
        btns[0].onclick = function(){
            axios.request({
                url: '/posts'
            }).then(response =>{
                console.log(response)//返回成功内容
            })
        }
    </script>
</body>
```

##### `axios`创建实例对象来发送请求

当想对两个域名不相同的服务器发送请求就可以使用创建实例对象来发送

```html
<head>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
</head>
<body>
    <button>发送服务器1GET请求</button>
    <button>发送服务器2GET请求</button>
    <script>
        const btns = document.querySelectorAll('button')
        const server1 = axios.create({
            baseURL: 'https://api.bilibili.com', //演示这里的api就随便写了
            timeout:2000//设置2秒超时终止
        })
        const server2 = axios.create({
            baseURL: 'https://sentry.music.163.com', //演示这里的api就随便写了
            timeout:2000//设置2秒超时终止
        })
        btns[0].onclick = function(){
            server1({
                url:'/x/web-interface/zone?jsonp=jsonp'//发送请求
            })
        }
        btns[1].onclick = function(){
            server2({
                url:'/wapm/api/sdk/collect'//发送请求
            })
        }
    </script>
</body>
```

##### `axios`拦截器

```html
<!--结果：输出：  请求拦截器 成功   响应拦截器 成功   发送请求成功-->
<body>
    <button>发送GET请求</button>
<script>
    const btns = document.querySelectorAll('button')
    btns[0].onclick = function(){
        //发送请求
            axios({
                method: 'GET',
                url:'http://localhost:3000/posts'
            }).then(response=>{
                console.log('发送请求成功')
            }).catch(reason=>{
                console.log('失败回调')//请求拦截器失败会输出
            })
        }
// 添加请求拦截器
axios.interceptors.request.use(function (config) {//use相当于promise的then方法，前面返回成功值，后面返回失败值
    console.log('请求拦截器 成功')
    return config;//这里要是抛出异常或promise返回值为失败则响应拦截器为失败
  }, function (error) {
    console.log('请求拦截器 失败')
    return Promise.reject(error);
  });

// 添加响应拦截器
axios.interceptors.response.use(function (response) {//只要请求码是2xx就是会接收到响应
    console.log('响应拦截器 成功')
    return response;
  }, function (error) {
    console.log('响应拦截器 失败')
    return Promise.reject(error);
  });
</script>
</body>
```


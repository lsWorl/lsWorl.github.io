---

title: VueRouter
date: 2022-04-14 20:23:38
categories: Vue
top: true
tags:
 - Vue
 - VueRouter
---

#### 路由的基本概念

**2022年2月7日以后，`vue-router`的默认版本，为Vue3专属的4版本**

`Vue`的一个插件库，专门来实现SPA应用

##### 路由就是一组key-value的对应关系

`key`为路径，`value`肯使`function`或`component`

`route`规则: `/example` => 例子组件

#### 基本路由

先创建两个组件



```vue
<!--组件1-->
<template>
	<h2>
        我是About内容
    </h2>
</template>

<script>
  export default {
      name:'About'
  }
</script>
```

```vue
<!--组件2-->
<template>
	<h2>
        我是Home内容
    </h2>
</template>

<script>
  export default {
      name:'Home'
  }
</script>
```

```javascript
//入口文件main.js
//引入Vue
import Vue from 'vue'
//引入App
import App from './App.vue'
//引入VueRouter
import VueRouter from 'vue-router'
//引入路由器
import router from './router'
new Vue({
  el:'#app',
  router:router,
  render: h => h(app)
})
```

新建路由器文件

```javascript
//router的index.js文件
import VueRouter from 'vue-router'
//引入组件
import About from '../components/About'
import Home from '../components/Home'
//创建一个路由器
export default new VueRouter({
    routers:[
        {
            path:'/about',
            component:About
        },
        {
            path:'/home',
            component:Home
        }
    ]
})

```

在`App`入口文件中新建样式引用组件

```vue
<template>
	<!--原始html中用a标签实现页面的跳转-->
	<!-- <a href="./about.html">About</a> -->
	<!-- <a href="./home.html">Home</a> -->
	<!--原始html中用a标签实现页面的跳转 active-class是激活时候的样式-->
	<router-link to="/about" active-class="">About</router-link>
	<router-link to="/home">Home</router-link>
	<!--router-view-->
	<router-view></router-view>
</template>
```

路由的基本功能就能实现了。

#### 多级路由

以上方页面为基准，修改`index.js`路由文件和新建两个子级路由。

```vue
<!--Message页面-->
<template>
	<div>
        <ul>
            <li>消息</li>
    	</ul>
    </div>
</template>
<script>
	export default{
        name:'Message'
    }
</script>
```



```vue
<!--News页面-->
<template>
	<div>
        <ul>
            <li>新闻</li>
    	</ul>
    </div>
</template>
<script>
	export default{
        name:'News'
    }
</script>
```

```javascript
//router的index.js文件
import VueRouter from 'vue-router'
//引入组件
import About from '../components/About'
import Home from '../components/Home'
import News from '../components/News'
import Message from '../components/Message'
//创建一个路由器
export default new VueRouter({
    routers:[
        {
            path:'/about',
            component:About
        },
        {
            path:'/home',
            component:Home,
            children:[ //子路由
                {
                    path:'news',//子路由就不需要再加'/'
                    component:News
                },
                {
                    path:'message',//子路由就不需要再加'/'
                    component:Message
                }
            ]
        }
    ]
})
```

再将需要调用的home页面中的`a`标签进行修改为`router-link`。并用`router-view`进行子路由的显示。

**`router-link`中的`to`路径要为“/一级路由/二级路由/....”**

#### 路由传参

##### 以`query`进行传参

把上方的写死的数据存在`data`中来进行传参。

```vue
<!--Message页面-->
<template>
	<div>
        <ul>
            <li v-for="m in massageList" :key="m.id">
               <!--传参以'?'进行分割,to的字符串写法-->
               <router-link :to=`/home/message/detail?id={m.id}&title={m.title}`>{{m.title}}</router-link>
                <!--传参以'?'进行分割,to的对象写法-->
               <router-link :to="{
                  path:'/home/message/detail',
                  query:{
                    id:m.id,
                    title:m.title
                  }
                }">
                   {{m.title}}
    		   </router-link>
    		</li>
    	</ul>
        <!--展示detail页面-->
        <router-view></router-view>
    </div>
</template>
<script>
	export default{
        name:'Message',
        data () {
            return {
                massageList:[
                    {id:'001',title:'消息1'},
                    {id:'002',title:'消息2'},
                    {id:'003',title:'消息3'}
                ]
            }
        }
    }
</script>
```

```vue
<!--用来接收传递过来数据的Detail页面-->
<template>
	<ul>
        <li>消息编号：{{$route.query.id}}</li>
        <li>消息标题：{{$route.query.id}}</li>
    </ul>
</template>
<script>
  export default{
      name:'Detail'
  }
</script>
```

再对路由配置信息页面进行修改

```javascript
//router的index.js文件
import VueRouter from 'vue-router'
//引入组件
import About from '../components/About'
import Home from '../components/Home'
import News from '../components/News'
import Message from '../components/Message'
import Detail from '../components/Detail'
//创建一个路由器
export default new VueRouter({
    routers:[
        {
            path:'/about',
            component:About
        },
        {
            path:'/home',
            component:Home,
            children:[ //子路由
                {
                    path:'news',//子路由就不需要再加'/'
                    component:News
                },
                {
                    path:'message',//子路由就不需要再加'/'
                    component:Message,
                    children:[
                        {
                    		path:'detail',
                    		component:Detail
                		}
                    ]
                }
            ]
        }
    ]
})
```



##### 以`params`进行传参

```vue
<!--传参格式 '路由/参数/参数/...'-->
<router-link :to="/detail/66/消息"></router-link>
```

```javascript
//路由的index.js
path:'detail/:id/:title'
```

在页面使用对象方法传参配置时候不能使用`path`作为路径跳转必须舒勇`name`形式。剩下部分与`query`基本相同。



#### 路由的`props`配置

传参的时候以`query`方式进行传参

```javascript
//路由的index.js
component:Detail,
//props第一种写法，值为对象，该对象中的所有key-value都会以props的形式传给Detail组件
//用的比较少，传递的为死数据
props:{a:1,b:'helloWorld'}
//props第二种写法，值为布尔值，若布尔值为真，就会把该路由组件收到的所有params参数，以props的形式传给Detail组件
props:true
//props第三种写法，值为函数
props({query:{id,title}}){//直接用解构来获取$router中query参数
    return{id:'id',title:'title'}
}
```

在`Detail`组件中接收

```vue
<template>
	<ul>
        <!--<li>{{a}}</li>-->
        <!--<li>{{b}}</li>-->
    </ul>
</template>
<script>
    export default{
        name:'Detail',
        //id和title由上方Message组件传递
        //第一种方式接收
        props:['a','b'],
        //第二种方式接收
        computed:{
            id(){
                return this.$route.query.id
            },
            title(){
                return this.$route.query.title
            }
        }
        //第三种方式接收
        props:['id','title']
        ...//方便演示就不显示其他数据了
    }
</script>
```



#### 浏览器历史记录

​	浏览器的结构为栈形式。

​	浏览器默认保存历史记录的方式为`push`，即压栈。

​	`router-link`默认开启的为`push`模式，可以在`router-link`中添加`replace`改变浏览器的保存历史记录模式。（只对使用的连接起作用）

#### 编程式路由导航

`routuer-link`在页面中默认转换为`a`标签，要想让按钮等能触发点击的事件进行页面跳转，就得使用编程式路由导航。

```vue
<!--前面写的Message页面，其他就不再重复写了-->
<template>
	<button @click="pushShow">
        跳转到Home页面
    </button>
</template>
<script>
	export default {
        name:'Message',
        methods: {
            pushShow(){
                //push为默认的方式，可更换为replace 
                this.$router.push({
                    path:'/home',
                    query:{
                        id:this.$store.query.id,
                        title:this.$store.query.title
                    }
                })
            }
        }
    }
</script>
```



#### 两个新生命钩子

当路由被缓存并在挂载前设定了`setInterval`等方法。因为组件被路由缓存了并不会触发销毁流程但页面又没有进行显示，此时会浪费浏览器资源就需要用新的生命钩子来对方法进行清除。

##### activated(激活)

当路由被激活时该钩子被调用

##### deactivated(失活)

当路由失活时候该钩子被调用



#### 路由守卫

路由守卫用来设置权限

```javascript
//router的index.js文件
import VueRouter from 'vue-router'
//引入组件
import About from '../components/About'
...
//创建一个路由器
const router = new VueRouter({
    routers:[
        {
            path:'/about',
            component:About,
            //用meta来判断是否需要权限校验，meta可以创建路由独有的信息
            meta:{isAuth:true},
            //独享路由守卫  与全局路由守卫功能相同
            beforeEnter((to,from,next)=>{
            
        })
        }
        ...
    ]
})

//全局前置路由守卫  初始化的时候被调用、每次路由切换之前调用
router.beforeEach((to,from,next)=>{
    //to表示要跳转到的路由页面，from表示从哪个路由开始跳转的
    //next表示可以放行，可以跳转路由页面
    //可以通过逻辑判断来让用户是否可以跳转到目标页面
    if(to.meta.isAuth){
        next()
    }
})

//全局后置路由守卫  初始化的时候被调用、每次路由切换之后被调用
router.afterEach((to,from)=>{
    //to表示要跳转到的路由页面，from表示从哪个路由开始跳转的
    //next表示可以放行，可以跳转路由页面
    //能进入后置守卫表示能成功进入页面
    //可以实现点击后页面标题的切换等功能
})
export default router
```

组件内路由守卫

```vue
<template>
	...
</template>
<script>
	export default{
        ...,
        //通过路由规则，进入该组件时被调用
        beforeRouteEnter(to,from,next){
            //写的逻辑判断由组件独有
            next()
        },
        //通过路由规则，离开该组件时被调用
        beforeRouteLeave(to,from,next){
            next()
        }
    }
</script>
```



#### `history`模式与`hash`模式

使用路由时地址栏会新增`#`，称为`hash`，不会随着http请求发给服务器。默认开启的`hash`模式。

改变路由模式：

```javascript
//在路由配置中修改
export default new VueRouter({
    //改为history模式，history没有#显示
    mode:'history',
    ...
})
```

`history`模式的兼容比`hash`模式差



#### 路由的几个注意事项

1.未被路由调用的页面会被销毁而不是隐藏

2.使用路由的页面会增加路由规则，`$route`和`$router`。`$route`存放自己的路由信息，每个页面均不相同，`$router`相同

3.路由组件通常存放在`pages`文件夹

4.可以通过`keep-alive`对路由组件进行缓存不会进行销毁，`keep-alive`放在一级路由中

```vue
<template>
	<!--include来记录要缓存的组件(里面填组件名)，其他的则不缓存。不写则都缓存-->
	<!--缓存多个写法： :include="['第一个组件名','第二个组件名']"-->
	<keep-alive include="">
    	<router-view></router-view>
    </keep-alive>
</template>
```


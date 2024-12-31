---
title: Vue3新特性
date: 2022-05-09 18:59:21
categories: Vue
top : true
tags:
 - Vue3
---







#### 常用`Composition API`



##### `setup`

组件中所需要用到的数据方法等，均要配置在`setup`中，`setup`值为一个函数

有两种返回值：

1. 若返回一个对象，则对象中的属性、方法，在模板中均可以直接使用
2. 若返回时一个渲染函数：则可以自定义渲染内容

`setup`函数会接收到两个参数，第一个为`props`为组件数据传递，第二个为`context`上下文

`setup`不能使用`async`，但如果父组件中使用`Suspense`来修饰子组件并用动态引入则可以返回`Promise`

**`setup`会在`beforeCreate`之前执行一次，`this`是`undefined`**



##### `ref`函数

原先`vue2`中的`ref`写在标签内部作为一个标识一样的存在

使用需要`import {ref} from 'vue'`引入

数据经过`ref`加工变成`Reflmpl{}`进行包装实现响应式

`ref`函数内部如果为对象等引用数据类型则会额外使用`reactive`函数



##### `reactive`函数

用于定义一个对象类型的响应式数据，通过`proxy`来实现响应式，并通过`reflect`操作源对象内部的数据调用数据可以不加`.value`



##### `computed`函数

定义在`setup`内部

```vue
<template>
  <h1>{{person.fullName}}</h1>
</template>

<script>
import {computed,reactive} from 'vue' //引入vue中的函数
export default {
  name: 'Demo',
  setup(){
      const person = reactive({
          firstName:'firstName',
          lastName: 'lastName'
      })
	  //只读，不考虑写
      person.fullName = computed(()=>{
          return person.firstName + '-' + person.lastName
      })
	  //考虑读写
      person.fullName = computed({
          get(){
              return person.firstName + '-' + person.lastName
          },
          set(value){
            const nameArr = value.split('-')
            person.firstName = nameArr[0]
            person.lastName = nameArr[1]
          }
      })
      return {
          person
      }
  }
}
</script>
```



##### `watch`函数

定义在`setup`内部，用法和vue2中差不多，只不过是在`setup`中定义

`watch`接收三个参数：

- 第一个为监视的数据
- 第二个为`(newValue,oldValue)=>{}`函数
- 第三个为可以配置的参数，如`{immediate:true}`



```javascript
<template>
  <h1>当前求和为:{{sum}}</h1>
  <button @click="sum++">+1</button>
  <h1>当前求和为:{{num}}</h1>
  <button @click="num--">-1</button>
  <hr>
  <h2>firstName:{{person.firstName}}</h2>
  <h2>lastName:{{person.lastName}}</h2>
  <h2>b:{{person.a.b}}</h2>
  <button @click="person.firstName+='@'">修改firstName</button>
  <button @click="person.lastName +='!'">修改lastName</button>
  <button @click="person.a.b++">修改b</button>
</template>

<script>
import {watch,ref,reactive} from 'vue' //引入vue中的函数
export default {
  name: 'Demo',
  setup(){
      /**
       * 监视ref定义的属性
       */
      let sum = ref(0)
      let num = ref(0)
      //监视单个ref所定义的响应式数据
      watch(sum,(newValue,oldValue)=>{
          console.log('sum+1',newValue,oldValue)
      })
      
      //监视多个ref定义的响应式数据
      watch([sum,num],(newValue,oldValue)=>{
          console.log('sum或num改变了',newValue,oldValue)
      },{immediate:true})

      /**
       * 监视reactive定义的属性
       */
      const person = reactive({
          firstName:'firstName',
          lastName: 'lastName',
          a:{
              b:200
          }
      })

      //监视reactive中的所有属性,此处监视的newValue,oldValue值一致，无法正确的进行监视,并且会强制开启了深度监视
      watch(person,(newValue,oldValue)=>{
          console.log('person变化了',newValue,oldValue)
      })

      //监视reactive的某一个属性 此时可以正常监视
      watch(()=>person.lastName,(newValue,oldValue)=>{
          console.log('person变化了',newValue,oldValue)
      })

      //监视reactive的某一个属性 套用了数组和函数返回的方式，成功监视正常监视reactive中的属性
      watch([()=>person.lastName,()=>person.firstName],(newValue,oldValue)=>{
          console.log('person变化了',newValue,oldValue)
      })

      //监视reactive的嵌套属性  修改内部属性必须开深度监视才能监视到
      watch([()=>person.a,()=>person.firstName],(newValue,oldValue)=>{
          console.log('person变化了',newValue,oldValue)
      },{deep:true})//此时深度监视生效

      return{
          sum,
          num,
          person
      }
  }
}
</script>
```



##### `watchEffect`函数

只有当`watchEffect`当中有调用了属性才会进行监视，并且在打开浏览器时就会进行一次监视。但不提供深度监视等配置



```vue
<template>
  <h1>当前求和为:{{sum}}</h1>
  <button @click="sum++">+1</button>
</template>

<script>
import {ref,watchEffect} from 'vue' //引入vue中的函数
export default {
  name: 'Demo',
  setup(){
      /**
       * 监视ref定义的属性
       */
      let sum = ref(0)
      watchEffect(()=>{
          let a = sum.value
          console.log('watchEffect执行',a)
      })
      return{
          sum
      }
  }
}
</script>
```



##### `toRef`函数和`toRefs`函数

可以用于引用`reactive`所创建的对象。

`toRef`用于获取某一个数据，`toRefs`用于获取所有数据



```vue
<template>
  <h2>firstName:{{firstName}}</h2>
  <h2>lastName:{{lastName}}</h2>
  <!--toRefs来取深层次数据-->
  <h2>b:{{a.b}}</h2>
  <!--toRef来取深层次数据，因为在返回已经取到所以可以直接使用-->
  <h2>b:{{b}}</h2>
  <button @click="firstName+='@'">修改firstName</button>
  <button @click="lastName +='!'">修改lastName</button>
  <!--toRefs来取深层次数据-->
  <button @click="a.b++">修改b</button>
  <!--toRef来取深层次数据，因为在返回已经取到所以可以直接使用-->
  <button @click="b++">修改b</button>
</template>

<script>
import {reactive, toRef} from 'vue' //引入vue中的函数
export default {
  name: 'Demo',
  setup(){
      //用reactive创建响应式数据
      const person = reactive({
          firstName:'firstName',
          lastName: 'lastName',
          a:{
              b:200
          }
      })
      
      return{
          //使用toRef来实现响应式，在模板部分可以不用Person前缀
          firstName: toRef(person,'firstName'),
          lastName: toRef(person,'lastName'),
          b: toRef(person.a,'b')
          //使用toRefs来实现响应式，在模板部分可以不用Person前缀
          ...toRefs(person)
      }
  }
}
</script>
```



##### `shallowReactive` 与 `shallowRef`

`shallowReactive` 与 `shallowRef`只考虑最外层的数据，对象嵌套的内部数据进行更改无法进行响应式。





##### `customRef`

用于创建一个自定义的`ref`，并对其依赖跟踪和更新触发进行显式控制



```vue
<!-- 使用customRef实现延迟1秒更新数据 -->
<template>
  <input type="text" v-model="keyWord">
  <h2>{{keyWord}}</h2>
</template>

<script>
import {customRef} from 'vue' //引入vue中的函数
export default {
  name: 'Demo2',
  setup(){
      function myRef(value,delay){//创建myRef函数
          let timer //定义定时器，用于到时候清除定时器
          return  customRef((track,trigger)=>{//调用customRef
              return {
                  get(){
                      track() //让vue对数据改变进行追踪
                      return value
                  },
                  set(newValue){
                      clearTimeout(timer)
                      value = newValue
                      timer = setTimeout(() => {
                          trigger() //让vue重新解析模板
                      }, delay);
                  }
              }
          })
      }
      let keyWord = myRef('hello',1000)
      
      return{
          keyWord
      }
  }
}
</script>
```



##### `provide`与`inject`

用于实现祖与后代组件间的通信

使用祖组件的`provide`来提供数据，后代组件的`inject`来使用数据



```vue
<!--祖组件-->
<template>
<div>
  <h2>祖组件data1:{{data1}}，data2:{{data2}}</h2>
  <FirstChild></FirstChild>
</div>
</template>

<script>
import { reactive, toRefs } from '@vue/reactivity'
import FirstChild from './components/FirstChild.vue'
import { provide } from '@vue/runtime-core'

export default {
  name: 'App',
  components:{FirstChild},
  setup(){
    let data = reactive({
      data1: '数据1',
      data2: '数据2'
    })
    provide('data',data)//给后代传递数据

    return{
      ...toRefs(data)
    }
  }
}
</script>
```



```vue
<!--子组件-->
<template>
  <div>
      <h3>子组件收到的数据{{data1}}，{{data2}}</h3>
      <SecondChild></SecondChild>
  </div>
</template>

<script>
import SecondChild from '../components/SecondChild.vue'
import { inject, toRefs } from '@vue/runtime-core'
export default {
    name:'FirstChild',
    components:{SecondChild},
    setup(){
      let data = inject('data')

      return{...toRefs(data)}
    }
}
</script>
```



```vue
<!--孙组件-->
<template>
  <div>
      <h3>孙组件收到的数据{{data1}}，{{data2}}</h3>
  </div>
</template>

<script>
import { inject, toRefs } from '@vue/runtime-core'
export default {
    name:'SecondChild',
    setup(){
      let data = inject('data')

      return{...toRefs(data)}
    }
}
</script>
```



##### `Teleport`组件

用于将组件内部的模块传送到其他部分去



```vue
<!--引用上方的孙组件，并在其中实现模态框的效果-->
<template>
  <div class="child2">
      <h3>孙组件收到的数据{{data1}}，{{data2}}</h3>
      <button @click="isShow = true">显示</button>
       <teleport to="html"> <!--to代表跳转到的页面根标签 -->
          <div v-if="isShow" class="mask">
            <div class="dialog">
              <button @click="isShow = false">隐藏</button>
            </div>
          </div>
      </teleport>
  </div>
</template>

<script>
import { inject, toRefs , ref } from '@vue/runtime-core'
export default {
    name:'SecondChild',
    setup(){
      const isShow = ref(false)
      let data = inject('data')

      return{...toRefs(data),isShow}
    }
}
</script>

<style>
  .child2{
    background-color: greenyellow;
    padding: 10px;
  }
  .mask{
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    background-color: rgba(0, 0, 0, 0.5);
    
  }
  .dialog{
    line-height: 300px;
    text-align: center;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%,-50%);
    width: 300px;
    height: 300px;
    background-color: aqua;
  }
</style>
```



#### Vue2响应式与Vue3响应式对比

##### Vue2的响应式

- 实现原理
  - 对象类型：通过`Object.defineProperty()`对属性进行读取，进行数据劫持
  - 数组类型：通过重写数组的方法来实现拦截
- 存在问题：
  - 对对象中元素进行新增页面不会更新
  - 直接通过数组下标对数组修改页面不会更新

Vue2对存在问题提供的解决方案：

- 对象：使用`set`方法来新增数据，使用`delete`方法来删除数据

- 数据：使用`set`方法来新增数据或者使用数组中的`splice`进行更改

  

```vue
<script>
	export default{
        data(){
            person:{
                name:'张三',
                age:18,
                hobby:['学习','吃饭']
            }
        },
        methods: {
            addSex(){
                this.$set(this.person,'sex','男')//新增sex，并页面会进行更新
            },
            deleteName(){
                this.$delete(this.person,'name')//删除name，并页面会进行更新
            },
            updateHobby(){
                this.$set(this.person.hobby,0,'游戏')//修改数组第一个元素
                this.person.hobby.splice(0,1,'游戏')//修改数组第一个元素
            }
        }
    }
</script>
```



##### Vue3的响应式

Vue3中解决了以上Vue2中存在的问题

通过`proxy`来实现数据代理，实现一些基本操作的拦截。再在返回的时候通过`Reflect`进行数据返回。

```javascript
new Proxy(data,{
    //拦截读取属性值
    get (target, prop){
        return Reflect.get(target, prop)
    },
    //拦截设置属性值或添加新属性
    set (target,prop,value){
        return Reflect.set(target,prop,value)
    },
    //拦截删除属性
    deleteProperty (target,prop) {
        return Reflect.deleteProperty(target,prop)
    }
})
```



#### 单文件组件

##### 基本语法

在vue3中可以在组件的`<script></script>`标签中加入`setup`，使整个变为`setup`函数。

效果与`<script>setup(){}</script>`相同，可以使整个代码更加的简洁。

在单文件组件中使用的变量、函数声明，以及import引入的内容都能在模板中直接引用

```vue
<script setup>
    const msg = ref('Hello')//使用ref包裹会自动return,可以直接在模块中调用
    function log() {
  		console.log(msg)
	}
</script>
<template>
	<div @click="log">{{ msg }}</div>
</template>
```



##### 组件数据传递

在原先的vue2.x中使用`props`来接收从父组件从来的数据，而在vue3.x中推荐组件式API，因此使用`defineProps`来代替了`props`。（这里使用TypeScript展示）

```vue
<script setup>
    const props = defineProps({
  		foo: String
        bar?: number//? 表示可选参数
	})
</script>
```


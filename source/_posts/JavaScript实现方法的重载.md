---
title: JavaScript实现方法的重载
date: 2022-08-26 15:23:53
tags:
 - javascript
 - 基础
categories: javascript
---



最近在使用`node.js`做后端时，想使用方法重载来实现一个函数可以接收不同的参数，但是`javascript`作为一个弱类型语言，无法实现方法的重载，就只能通过奇淫技巧来实现。

目前发现的方法有：

- 使用`arguments` 参数的长度来判断传入参数的数量，从而实现不同业务逻辑

```javascript
//使用arguments来实现方法重载
function OverLoad(name,age){
    //arguments.length===0说明没有传入参数
    switch(arguments.length){
        case 0:
           代码块
           break;
        //传入了name走这块
        case 1:
           代码块
           break;
        //传入了age走这块
        case 2:
           代码块
           break;
    }
}
```



- 直接判断传入的参数是否为`undefined`。

  ```javascript
  function OverLoad(name,age){
      if(name===undefined){
  		//走这说明没有传参
          代码块
          return
      }
      if(age===undefined){
          //走这说明只传了一个参数
          代码块
          return
      }
      //走这说明只参数都传了
      代码块
  }
  ```

  

用上面几种方法都有大量的判断语句，没有很好的实现重载，网上还有些通过闭包来实现，但现在可以使用`class`中的`#`来实现属性的私有，这里就没有介绍闭包的方法了。

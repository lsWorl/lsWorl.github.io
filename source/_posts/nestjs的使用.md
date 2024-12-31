---
title: nestjs的模块，控制器，提供者介绍
date: 2022-10-15 14:58:40
tags:
 - nestjs
 - node.js
categories: node.js
---

<meta name="referrer" content="no-referrer"/>

### 介绍

> 本文参考了[nestjs官方文档](https://docs.nestjs.com/)

在使用了用`nodejs`搭建的`koa`和`express`框架后发现使用前端的语法也可以搭建一个不错的后端，而现在又逐渐趋势于用`typescript`来开发，就发现了`nestjs`可以很好的支持`typescript`并进行一个工程化的开发。



### 新建

在开始之前，可以使用nest的脚手架来快速搭建一个nest项目。（确保Node.js（>=10.13.0,v13除外））

```bash
npm i -g @nestjs/cli
nest new project-name #project-name为项目名，会在当前目录下新建一个nestjs项目
```

创建时会让你选择用什么作为包管理工具，这里默认使用npm。

![start](https://img-blog.csdnimg.cn/b5f16a74f7e84eb5ab019f1c48fd4909.png)

等待完成后就可以进入到项目中使用`npm run start`来运行项目了。（也可以使用`npm run start:dev`来运行启动热更新。）



### 文件介绍

项目创建后，自动在`src`生成了一下文件：

app.controller.ts

app.controller.spec.ts

app.module.ts

app.service.ts

main.ts

`main.ts`作为项目入口文件，默认监听了`3000`端口，并将`AppModule`进行了挂载。根据`nestjs`自动生成的这些文件就可以大概了解一个`nestjs`项目应该如何书写。

![main.ts](https://img-blog.csdnimg.cn/4b38cf21d8334bffbd63a97067b49438.png)

#### `module`

因为在`main.ts`的入口文件中引入了`AppModule`，所以首先我们先看`module`文件。

![module](https://img-blog.csdnimg.cn/d2abea4b6830477fbb30cd36c68c1da5.png)

根据上图可以看到先前的`AppController`和`AppService`文件都是经过`AppModule`模块，这里就涉及nestjs很重要的概念，**`Controllers`和`Providers`**，这就像后端很经典的`MVC`架构，将控制层和服务层分层进行，将所有对数据库的操作都放在`Providers`(但不是所有的`Providers`都是用于操作数据库)中，将要返回前端的数据逻辑都在`Controllers`中进行，而`Module`主要为了管理控制层和服务层，有可能一个接口中需要调用多个数据库的操作，这时候就需要在`Module`中注册。

![module](https://img-blog.csdnimg.cn/e1d57f967ad6405db6f83e7970197951.png)

在目前的Module的`imports`的部分就会用到上图的模块管理，也可以在其中结合`TypeOrm`来实现用`ORM`框架来对数据库进行操作。

总之，在每次新建了控制器或提供者就需要在`module`中进行引入，这样nest才能识别的到。

#### `Controller`

在控制器中，主要处理要返回给客户端的相应相关的数据。

![controller](https://nestjs.bootcss.com/assets/Controllers_1.png)

可以使用路由来实现一个基本的接口。

```typescript
//@Controller创建一个以/text为路径的控制器
@Controller('/text')
export class Ctroll{
    //当发送以/text为路径的请求并以Get的方式时会走这
    @Get()
    find(@Query()query){//以query的形式发送，即localhost:3000/text?a=1  query的值就是{a:1}
        return query;
    }
}
```

使用控制器可以接收三种类型的参数，除了上方用到的`query`，还有`param`和`body`。

- `query`就是以`localhost:3000/text?a=1`的形式进行发送
- `param`就是以`localhost:3000/text/:id`的形式进行发送

```typescript
@Get(':id') //以路径的形式发送
find(@Param()param){
    return param
}
```

- `body`则是以对象的形式进行发送(常用于POST请求)

例：

```typescript
//发送数据
axios.post('/user', {
    firstName: 'Fred',
    lastName: 'Flintstone'
  })
```

```typescript
//接收数据
@Post()
find(@Body()body){
    return body
}
```

此时要是不需要操作数据库的话，就已经实现了一个简单的后端接口了，当然，还有许多如设置相应头，相应码等功能，就得通过官方文档来了解了。

#### `Providers`

`Providers`是基于nestjs的一个概念，`Providers`可以是操作数据库的服务层，也可以是`helpers`，或者其他，主要就是为了提供一些注入的依赖。

![providers](https://docs.nestjs.com/assets/Components_1.png)

在使用`Service`之前，我们可以先连接数据库，这里以`mysql`为例，需要先下载`mysql`和`typeorm`的依赖，当然`typeorm`不是必要的,即`npm i mysql2`和`npm install typeorm --save`。

```typescript
//app.module.ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTable } from './entity/userTable.entity';
@Module({
    imports:[
        //连接数据库
        // 连接数据库
    	TypeOrmModule.forRoot({
      	  type: 'mysql',
      	  host: 'ip地址',
      	  port: 端口,
      	  username: '用户',
      	  password: '密码',
      	  database: '表',
      	  entities: [UserTable],//添加的实体 UserTable在代码在下方
      	// 数据库同步更新
      	synchronize: true,
    	}),
    ]
})
```

不过目前最多还是用来对于数据库的增删改查。`Providers`一般以`@Injectable()`开头，使用类来包裹，用构造函数来注入要修改的数据，构造函数中声明了以后，在调用函数就可以通过`this`来调用其中的函数。

```typescript
//service
@Injectable()
export class TextService{
    constructor(
      @InjectRepository(UserTable) //userTable是一个用typeorm的实体，代码在下方，要是不了解typeorm可以去查看下他的官方文档
      private readonly userTableRepository: Repository<UserTable>, //添加私人与只读属性防止修改
    ){}
    async findAll(){
        return this.userTableRepository.find();//find是typeorm的一个方法，类似于sql语句的SELECT * FROM userTable;
    }
}
```

```typescript
@Entity()
export class UserTable{
    @PrimaryGeneratedColumn()
  	id: number;
    @Column()
    userName:string
}
```

当然，上方是连接了mysql后所可以进行的操作，要是没有连接mysql，则nest就会直接报错。

##### controller中运用service

在nest中基本都是通过构造函数的方式来传递相互的数据，当然这些都需要在Module模块中进行注册。

```typescript
import { TextService } from './financial_table.service';

@Controller('/text')
export class Ctroll{
    //这里就获取了Textservice了
    constructor(private readonly textService: TextService) {}、
    @Get()
    async find(){
        return await this.textService.findAll()
    }
}
```

这样就完成了基本的数据库操作了，也可以实现最基础的后端接口了，当然还有其他使用`Pipe`进行管道验证等功能可以通过官方文档来了解更多。

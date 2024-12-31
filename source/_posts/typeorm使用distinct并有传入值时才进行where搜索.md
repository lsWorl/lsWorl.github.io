---
title: typeorm使用distinct并有传入值时才进行where搜索
date: 2022-11-05 23:07:03
tags:
 - node.js
 - typeorm
 - nestjs
categories: node.js
---



### TypeOrm介绍

`typeorm`是一个对象关系映射模式，主要就是为了解决面向对象与关系数据库存在的互不匹配的技术。当然使用`typeorm`可能有时候不如直接`sql`语法查询，但是使用`orm`框架可以更容易写出高内聚低耦合的代码来，主要就是为了减少重复代码的书写。

### 使用distinct与where配合搜索

在一些场景中，`typeorm`所提供的`Repository API`并不能满足我们查询的需求，这时候就只有两种方案，一种是直接使用`typeorm`提供的`query()`方法直接使用`sql`语句来进行复杂查询，还有就是使用查询构造器`Query Builder`来进行查询。

当然，既然我们都用`orm`框架了，当然是要减少使用`sql`语句的场景的。

此时这就有个需求，当我们需要查询数据有多条，但我们只需要其中一条，并且他的`where`的值可能是不存在的，这种场景单纯使用`find()`是解决不了的，就需要使用`Query Builder`。

#### 例子：

就如这有个`User`表，结构为：

```sql
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  `phone` varchar(11) NOT NULL
);
```

这时为这张表添加三个用户，让名字和手机号各有两个为相同。

```sql
INSERT INTO `user` VALUES ('1', '张三', '12345678910');
INSERT INTO `user` VALUES ('2', '李四', '12345678910');
INSERT INTO `user` VALUES ('3', '张三', '09876543210');
```

此时我们要是只是想单纯查出名字叫张三的人用`find()`就能实现。

```typescript
this.Repository.find({
    where:{name:'张三'}
})
//转换成的sql语句：SELECT * FROM user WHERE name = '张三'
```

此时再加一个需求，要是查询的时候没有name这个`name`字段并且还需要对手机号进行去重后要求返回所有数据。（这里业务可能不太清晰，主要为了实现功能...）此时可能就需要使用`distinct`并且来判断`name`字段是否为空。

很显然`find()`方法中没有这个`distinct`方法，此时就得使用`Query Builder`来协助我们完成这个需求。

```typescript
//因为要是直接使用where({phone:xxx})来进行查询，当传入值为null的时候就会生成WHERE phone = null这样的sql语句，显然是不符合我们的需求的，就需要动态来添加

// 条件对象
const whereInfo = {};
if(phone != null){
    //如果传入的手机不为空，我们就动态为对象添加一个key 只有当phone有值的时候才会添加，否则默认全查询
    whereInfo['phone'] = phone
}

this.Repository
      .createQueryBuilder()
      .select([
        'user.phone as phone',
      ])
      .from(User, 'user') //这里的User是实体Entity的User，别名为user
      .distinct(true)//开启distinct
      .where(whereInfo)//使用where，里面传入数组
      .getRawMany();//获取数据
```

使用上方语句，要是没传参应该是默认会获取到：

```json
{
    [
    	"phone":12345678910
    ],
    [
    	"phone":09876543210
    ]
}
```

如上两条数据，当我们传入`phone`参数为：12345678910时，获取到：

```json
{
    [
    	"phone":12345678910
    ]
}
```

这样就完美符合我们的业务需求了，使用`distinct`来去除相同数据并使用`where`动态进行搜索。

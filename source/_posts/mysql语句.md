---
title: mysql常用语句总结
date: 2022-09-01 11:30:16
tags:
 - mysql
categories: mysql
---



### 创建数据库

```mysql
CREATE DATABASE 数据库名；
```



### 删除数据库

```mysql
drop database 数据库名;
```



### 创建表

```mysql
#IF NOT 表示不存在就创建
CREATE TABLE IF NOT 表名 (column_name column_type);
```



例子：

```mysql
#AUTO_INCREMENT 表示自增 NOT NULL表示不为空 PRIMARY表示主键
CREATE TABLE IF NOT user(
id int PRIMARY KEY NOT NULL AUTO_INCREMENT,
name VARCHAR(20) NOT NULL
);
```



### 表创建时添加外键约束

两个表之间需要相关的值的话就可以使用外键约束，并且设置外键的字段名所用的是主表的主键字段才行。

#### 表创建时添加外键约束

```mysql
CONSTRAINT 外键名 FOREIGN KEY(从表的外键字段名) REFERENCES 主表名(主表的主键字段名)
```



例子：

```mysql
#主表
CREATE TABLE IF NOT user(
id int PRIMARY KEY NOT NULL AUTO_INCREMENT,
name VARCHAR(20) NOT NULL
);
#从表
CREATE TABLE user_contacts (
	id INT PRIMARY KEY NOT NULL,
	name VARCHAR(20) not null,
	avatar VARCHAR(40),
	user_id INT,
    #添加外键约束
	CONSTRAINT fk_user_contacts_user FOREIGN KEY(user_id) REFERENCES user(id)
);
```



#### 已存在表添加外键约束

```mysql
ALTER TABLE 从表名 ADD CONSTRAINT 外键名 FOREIGN KEY(从表的外键字段名) REFERENCES 主表名(主表的主键字段名)
```



例子：

```mysql
#主表用上方的user表
ALTER TABLE user_contacts ADD CONSTRAINT fk_user_contacts_user FOREIGN KEY(user_id) REFERENCES user(id)
```



### 删除表

```mysql
DROP TABLE table_name ;
```



### 插入数据

```mysql
INSERT INTO table_name ( field1, field2,...fieldN ) VALUES ( value1, value2,...valueN );
```



例子：

```mysql
INSERT INTO user(id,name,phone,permissions) VALUES(1,'张三','17857956137','管理员')
```



### 为已有表添加字段

```mysql
alter table 表名 ADD 字段名 字段类型
```



例子：

```mysql
alter table user ADD password varchar(20)
```



### 将已有字段设置为非空字段



```mysql
alter table 表名 CHANGE 字段名 字段名 字段类型 NOT NULL;
```





例子：

```mysql
alter table login_user CHANGE phone phone VARCHAR(11) NOT NULL;
```



### 删除字段

```mysql
ALTER TABLE 表名 DROP 字段名;
```



例子：

```mysql
ALTER TABLE user DROP name;
```



### 更新表字段数据



#### 更新所有

```mysql
update 表名 set 字段名 = 要修改的数据
```



例子：

```mysql
update user set password = '123456'
```



### 字段默认值

#### 创建表时添加默认值

```mysql
create table 表名(
  name varchar(50) not null default '0'
)
```



#### 为已存在字段附上默认值

```mysql
ALTER TABLE 表名 ALTER COLUMN 字段名 SET DEFAULT 默认值
```

**(注：已有默认值的话需要先删除默认值后再添加，删除语法：`alter table 表名 alter column 字段名 drop default`)**



例子：

```mysql
ALTER TABLE login_user ALTER COLUMN password SET DEFAULT '123456'
```



### 查询语句



#### 查询所有

```mysql
SELECT * FROM 表名
```



#### 条件查询



##### 查询表中的字段数量

```mysql
SELECT count(*)  FROM 表名
```



##### 查询出固定数量

```mysql
#偏移量不填默认为0
SELECT * FROM 表名 LIMIT 偏移量,数量 
```



例子：

```mysql
#查出user表中第10条开始，取出11条数据
SELECT * FROM user LIMIT 10,11
```



#### 使用distinct去重查询

```sql
SELECT DISTINCT 列,列... from 表
```



例子：

```sql
#查出user表中name和address不相同的数据
SELECT DISTINCT name,address from user
```



#### 查询列为空的值

```sql
select * from 表 where 字段 is null
```



例子：

```sql
#查出user表中address为空的值
select * from user where address is null
```


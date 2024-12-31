---
title: C语言自定义数据类型
date: 2023-09-06 20:26:12
categories: C
tags:
 - C
---



#### 结构体的声明

结构体是用于自定义一个复杂类型（可以包括整形、字符串、浮点数等）

```c
struct tag{
    member-list:
}variable-list;
//例如描述一个学生：
struct stu{
    char name[20];
    int age;
    char id[20];
};
```



##### 结构体的使用

```c
typedef struct Stu{
  char name[20];
  char tele[12];
  char sex[10];
  int age;
} s4,s5,s6; //s4  s5  s6也是全局变量

//创建全局变量
struct Stu s3;

//匿名结构体
struct 
{
  int a;
  char c;
}s; //使用时通过 s 来进行取值

//结构体的自引用
//这里用链表的节点举例
struct Node
{
  int data;
  struct Node* next; //保存下一个节点的地址
};


int main()
{
  struct Stu s1 = { "zhang", "1234567891", "male", 18 }; //赋值
  struct Stu s2;
  printf("%s %s %s %d",s1.name,s1.tele,s1.sex,s1.age); //取值
  return 0;
}
```



#### 结构体内存对齐

> 结构体对齐规则：
>
> 1. 第一个成员在与结构体变量偏移量为0的地址处。
>
> 2. 其他成员变量对齐到某个数字（对齐数）的整数倍的地址处。
>
>    **对齐数**==编译器默认的一个对齐数与该成员大小的较小值。（`VScode`中默认为8）
>
> 3. 结构体总大小为对齐数（结构体中最大的）的整数倍。
>
> 4. 如果是嵌套结构体，则内部嵌套的结构体的对齐数大小就是嵌套结构体数据中最大的对齐数的整数倍。
>
> 



```c
struct s1
{
  char c1; //vscode的默认对齐数为8 , char为1字节，取较小值，则c1占首地址偏移量为0的地址。
  int a; //int占4字节，与默认对齐数8小，所以取4，而成员要放在对齐数的整数倍，即4的整数倍，所以放的位置为首地址偏移4，随后占4字节
  char c2; //char占1字节 和 默认8 相比，取1，以1的整数倍，所以放的位置为首地址偏移9（a总共大小占了4字节）
};
//经过以上偏移后再对s1进行大小计算，由于结构体大小为最大的对齐数的整数倍（这里为4），此时上方所计算出来的大小默认为9字节，要成为4的整数倍，所以最终计算结果为12字节，即下方所打印。

//s2和s1同理
struct s2
{
  char c1;
  char c2;
  int a;
};

int main()
{
  struct s1 s1 = {0};
  struct s2 s2 = {0};
  printf("%d\n",sizeof(s1)); // 12
  printf("%d\n",sizeof(s2)); // 8
  return 0;
}
```



##### 修改默认对齐数

```c
#pragma pack(k) //可将默认对齐数修改成k

#pragma pack() //什么都不填，取消设置的对齐数
```



例：

```c
#pragma pack(1)

struct s1
{
  char c1;
  int a;
  char c2;
};
int main()
{
  struct s1 s1 = {0};
  printf("%d\n",sizeof(s1)); //结果为6
  return 0;
}
```



#### 结构体传参



```c
struct s1
{
  char c1;
  int a;
  char c2;
};
//传地址要是不想修改结构体值可以前加const ，变成const struct s1 *ps
void Init(struct s1 *ps){
  //将1赋值给a
  ps->a = 1;
}


int main()
{
  struct s1 s1 = {};
  //传入s1的地址
  Init(&s1);
  printf("%d\n",s1.a);//打印 1
  return 0;
}
```





#### 位段

> 什么是位段：
>
> 1. 位段的成员必须是`int`、`unsigned int`或`signed int`。
> 2. 位段的成员名后边有一个冒号和一个数字。

```c
//例：
struct S
{
  int a : 2; //意味着a只占2bit
  int b : 5; //意味着b只占5bit
  int c : 10; //意味着c只占10bit
  int d : 30; //意味着d只占30bit
}
```



##### 位段的内存分配

> 1. 位段的空间是按照以4个字节(`int`)或1个字节(`char`)来开辟的。
> 2. 位段涉及很多不确定因素，可移植的程序慎用。

```c
struct S
{
  int a : 2; //意味着a只占2bit
  int b : 5; //意味着b只占5bit
  int c : 10; //意味着c只占10bit
  int d : 30; //意味着d只占30bit
};

int main()
{
  struct S s = {0};
  printf("%d",sizeof(s)); //打印 8  内存首先分配4个字节供 a b c占用，剩下d再占4字节
  return 0;
}
```



#### 枚举类型

就是将把可能的取值一一列举。

```c
//赋值只能赋值里面有的常量 值默认从0开始
enum Gender
{
  MALE,// 0
  FEMALE,// 1
  SECRET// 2
};
```





#### 联合（共用体）

联合是一种特殊的自定义类型，这种类型定义的变量包含一系列的成员，并公用同一块空间。

```c
union Un
{
  char c;
  int i;
};
int main()
{
 union Un u;
 printf("%d\n",sizeof(u)); //打印 4 共用同一块空间，大小为最大成员的大小
  return 0;
}
```



##### 联合体大小的计算

- 联合的大小至少是最大成员的大小。
- 当最大成员大小不是最大对齐数的整数倍的时候，就要对齐到最大对齐数的整数倍。

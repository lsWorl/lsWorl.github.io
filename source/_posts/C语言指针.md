---
title: C语言指针
date: 2023-08-20 23:08:10
categories: C
tags:
 - C
 - 指针
---





#### 指针类型的意义：

> 1.指针类型决定了指针解引用操作符能访问几个字节： char* p能访问1个字节， int* p 能访问4个字节
>
> 2.指针类型决定了指针+1，-1，加的或者减的时几个字节：char* p；p+1，跳过一个字节。int* p; p+1，跳过四个字节。



```c
  int a = 0x11223344;
  char* cp = (char*)&a;
  int* ip = &a;
  printf("%p\n",*cp);//00 00 00 44
  printf("%p\n",*ip);//11 22 33 44
```





#### 字符指针

在指针类型中将`char*`称为字符指针。

```c
  char a[] = "abcdef";
  char* p = a;
  printf("%s\n",a); //abcdef
  printf("%s\n",p); //abcdef

  const char* p1 = "abcdef";
  const char* p2 = "abcdef";
  if (p1==p2)
  {
    printf("相同");//会进行打印，说明p1和p2指向同一块内存空间
  }
```



#### 指针数组

指针数组是用来存放指针的数组。即`Elemtype* p[count]`，例：`int* p[4]`（存放整形指针的数组）。

```c
  int a = 10;
  int b = 20;
  int *arr[2] = {&a, &b};
  for (size_t i = 0; i < 2; i++)
  {
    printf("%d\n", *(arr[i])); //10 20
  }

  int arr1[] = {1, 2, 3, 4};
  int arr2[] = {5, 6, 7, 8};
  int arr3[] = {9, 10, 11, 12};
  int *parr[] = {arr1, arr2, arr3};
  for (size_t j = 0; j < 3; j++)
  {
    printf("%d\n",*(parr[j])); // 1  5  9
    printf("%d\n",*(parr[j] + 1));// 2  6  10  parr[j] + 1代表向后偏移一位
  }
```



#### 数组指针

数组指针就是用来存放数组的指针。

##### 一维数组

```c
  int arr[10] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
  // arr -首元素地址
  //&arr[0] -首元素地址，和上面意思相同
  //&arr -数组的地址
  int(*p)[10] = &arr;//存数组的地址 p就是数组指针

  //取址打印 最简便的方法还是另 int *p = arr; 然后(*p + i) 来取各个元素
  for (size_t i = 0; i < 10; i++)
  {
    //方法一
    printf("%d\n",(*p)[i]);
    //方法二 *p == arr
    printf("%d\n", *(*p + i));
  }

  char* arr2[5];//字符指针
  char* (*pa)[5]= &arr2; //存放字符数组指针
```



##### 二维数组

```c
  int arr[2][3] = {{1, 2, 3}, {4, 5, 6}};
  int (*p)[3] = arr;//arr代表首元素的地址，
  for (size_t i = 0; i < 2; i++)
  {
    for (size_t j = 0; j < 3; j++)
    {
      printf("%d ", *(*(p + i) + j)); //*(p+i) == arr[i] == p[i] 表示第i行的数据 *(*(p+i) + j) == (*(p + i))[j] == p[i][j] 表示第i行j列的数据
    }
    printf("\n");
  }
```



> 总结举例：
>
> `int arr[5]`是一个5个元素的整形数组
>
> `int *parr1[10]`是一个10个元素的类型为`int*`的指针数组
>
> `int (*parr2)[10]`是一个数组指针，指向了一个有10个元素的数组，每个元素的类型是`int`
>
> `int (*parr3[10])[5]`是一个数组，有10个元素，每个元素是一个指向5个元素的数组指针（即第一层是放着10个指针元素的数组，每个指针所指向的是一个包含5个`int`类型元素的数组）。



#### 数组参数、指针参数

##### 一维数组传参

```c
//以下方法均可以接受到参数
void test(int arr[]){}
void test(int arr[10]){}
void test(int *arr){}

void test2(int *arr[]){}
void test2(int **arr){}
int main(){
    int arr[10] = {0};
    int *arr2[20] = {0};
    test(arr);
    test2(arr2);
    return 0;
}
```



##### 二维数组传参

```c
//二维数组传参时不能省略列

void test(int arr[][3]){}//正常运行
void test(int arr[2][3]){}//正常运行
void test(int arr[2][]){}//报错
void test(int arr[][]){}//报错
int main()
{
  int arr[2][3] = {{1, 2, 3}, {4, 5, 6}};
  
  test(arr);
  return 0;
}
```



传二维数组以指针形式接收

```c
void test(int (*arr)[3]){} //(*arr)表示首元素的指针即arr[0]
int main()
{
  int arr[2][3] = {{1, 2, 3}, {4, 5, 6}};
  
  test(arr);
  return 0;
}
```



##### 一级指针传参

```c
void test(int *p){}
int main()
{
  int a = 10;
  int *p = &a;
  test(&a);
  test(p);//两个结果相同
  return 0;
}
```



##### 二级指针传参

```c
void test(int **ptr){}
int main()
{
  int a = 10;
  int *p = &a;
  int **pp = &p;
  test(pp);
  test(&p);//两个结果相同
  //也可以传指针数组
  int* arr[10] = {0};
  test(arr);
  return 0;
}
```



#### 函数指针

函数指针就是指向函数的指针。

```c
int test(int x){ return 0; }
void test2(char *content){ printf(content); }
int main(int argc, char const *argv[])
{
  int (*p)(int) = test; //这就将函数test的地址赋值给了p
  void (*p2)() = test2; //存储无返回值的函数
  //通过指针调用函数
  (*p2)("Hello World\n"); //可以打印出 Hello World
  //结果相同，均为函数test的地址值
  printf("%p\n",test);
  printf("%p\n",&test);
  return 0;
}
```



##### 分析函数指针代码

```c
void (*signal(int , void(*)(int)))(int);
//从内层往外层看，显然内部的signal为一个函数声明，第一个参数为int类型，第二个参数为函数指针类型（返回值为void 接收参数为int），而外层的void(* )(int)则也是函数指针，说明signal的返回值也为函数指针类型

//进行简化
typedef void(*pfun_t)(int);//将函数指针重定名为pfun_t
pfun_t signal(int,pfun_t);
```



##### 创建函数指针的数组

```c
int Add(int x, int y)
{
  return x + y;
}
int Sub(int x, int y)
{
  return x - y;
}
int Mul(int x, int y)
{
  return x * y;
}
int Div(int x, int y)
{
  return x / y;
}
int main()
{
  int (*parr[4])(int, int) = {Add, Sub, Mul, Div};
  //调用函数
  for (size_t i = 0; i < 4; i++)
  {
    printf("%d\n",parr[i](2,3)); //5  -1  6  0
  }
  return 0;
}
```



#### 回调函数

回调函数即用函数来调用其他函数。

```c
int test1(int x, int y){ 
  printf("test1调用成功\n");
  return x+y; }
void test2(int (*pf)(int,int)){
  printf("test2调用成功,结果为:%d\n",pf(2,3));
}

int main(){
   int (*p)(int,int) = test1;
   test2(p); //两个结果都会打印.
}
```



> `void* p` 类型的指针可以接受任意类型的地址。(**但无法进行解引用，和加减等与和地址有关的操作！！！**)
>
> 例：
>
> `int a = 1; void* p = &a;`成立。
>
> `char b = 'a'; void* p = &b;`成立。 

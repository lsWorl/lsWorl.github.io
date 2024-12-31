---
title: C语言动态内存管理
date: 2023-09-08 21:04:44
categories: C
tags:
 - C
---





#### 动态内存函数

为解决动态的开辟内存空间的需求，C语言提供了一个动态内存开辟的函数：

`void *malloc( size_t size);`

> 这个函数向内存申请一块连续可用的空间，并返回指向这块空间的指针。
>
> - 开辟成功后会返回指向这片空间的指针。
> - 若失败则会返回NULL指针。

并且提供了`void free(void *ptr)`来释放不再使用的动态内存空间。

```c
  //向内存申请10个整形的空间
  int* p = (int*)malloc(10*sizeof(int));

  //向内存申请失败打印错误原因
  if(p ==NULL){
    printf("%s\n",strerror(errno));
  }
  //当动态申请空间不再使用则释放
  free(p);
  p = NULL;
```



##### 开辟动态数组

`void *calloc(size_t num,size_t size)`会在内存中开辟一个初始全为0的数组。

```c
  // 向内存申请10个整形的空间
  int *p = (int *)calloc(10, sizeof(int));

  // 当动态申请空间不再使用则释放
  free(p);
  p = NULL;
```



##### 调整动态开辟空间的大小

`void *realloc(void *memblock,size_t size)`当使用`calloc`或`malloc`开辟的内存空间不够用可以用`realloc`增加空间或进行调整。

> 若原先开辟的空间再增加新的空间之后有足够的内存空间，则直接追加，返回原先所开辟空间的地址。
>
> 若没有足够的内存空间，则`realloc`会新开辟一个内存空间，并且将原先数据拷贝，并释放旧的内存空间，最后返回新开辟的内存地址。



```c
  // 向内存申请10个整形的空间
  int *p = (int *)calloc(10, sizeof(int));

  // 为p调整到4个整形的空间
  int *ptr = (int *)realloc(p, 4 * sizeof(int));
  // 追加成功后再赋值地址
  if (ptr != NULL)
  {
    p = ptr;
  }

  // 当动态申请空间不再使用则释放
  free(p);
  p = NULL;
```


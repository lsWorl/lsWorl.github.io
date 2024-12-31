---
title: C语言实现任何类型的冒泡排序
date: 2023-08-30 21:34:39
categories: C
tags:
 - C
---



> 根据qsort函数来实现冒泡排序版本，实现后时间复杂度为O(n^3)，仅供练习使用，实际运用效率过于低下。

#### `qsort` 函数

定义于`<stdlib.h>`头文件中，主要接收参数：

`void qsort( void *ptr, [size_t] count, [size_t] size,int (*comp)(const void *, const void *) );`

- `ptr`为传入的数组
- `count`为数组的长度
- `size`为类型所占字节大小
- `comp`为一个比较函数，若前一个元素大于后面的元素则返回大于0的数，反之返回小于0的数，相等则返回0。

了解`qsort`基本参数后就可将要实现的排序通过这些参数为标准来进行设计。



```c
//主要排序函数实现

// base:要排序的数组 sz:数组长度 width:类型所占字节大小 cmp:排序所要传的函数(通过正负来判断大小)
void bubble_sort(void *base, int sz, int width, int (*cmp)(void *e1, void *e2))
{
  for (size_t i = 0; i < sz - 1; i++)
  {
    for (size_t j = 0; j < sz - i - 1; j++)
    {
      //将强制转化为char *表示无论什么元素都只查找一个字节，但加上width后则表示当前数组单个元素所占字节大小，因此进行比较。
      if (cmp((char *)base + width * j, (char *)base + width * (j + 1)) > 0)
      {
        Swap((char *)base + width * j, (char *)base + width * (j + 1), width);
      }
    }
  }
}
```



```c
//交换函数实现
//char*表示每次只查找一个字节，通过++的方式能实现一个一个字节进行交换。
void Swap(char *buf1, char *buf2, int width)
{
  for (size_t i = 0; i < width; i++)
  {
    char tmp = *buf1;
    *buf1 = *buf2;
    *buf2 = tmp;
    buf1++;
    buf2++;
  }
}
```



```c
//要传入的排序类型实现

// 排序整数类型
int cmp_int(void *e1, void *e2)
{
  if (*(int *)e1 > *(int *)e2)
  {
    return 1;
  }
  else if (*(int *)e1 < *(int *)e2)
  {
    return -1;
  }
  else
  {
    return 0;
  }
}

// 排序浮点数类型
int cmp_float(void *e1, void *e2)
{
  if (*(float *)e1 > *(float *)e2)
  {
    return 1;
  }
  else if (*(float *)e1 < *(float *)e2)
  {
    return -1;
  }
  else
  {
    return 0;
  }
}

// 结构体类型
struct Student
{
  char name[20];
  int age;
};
int cmp_struct(void*e1,void*e2){
  if (((struct Student*)e1)->age > ((struct Student*)e2)->age)
  {
    return 1;
  }
  else if (((struct Student*)e1)->age < ((struct Student*)e2)->age)
  {
    return -1;
  }
  else
  {
    return 0;
  }
}
```



```c
//测试
int main()
{
  int arrInt[10] = {9, 8, 7, 6, 5, 4, 3, 2, 1, 0};
  int szInt = sizeof(arrInt) / sizeof(*arrInt);
  bubble_sort(arrInt, szInt, sizeof(arrInt[0]), cmp_int);//排序后数组： 0 1 2 3 4 5 6 7 8 9
  
  float arrFloat[5] = {3.1, 4.5, 3.0, 1.0, 2.0};
  int szFloat = sizeof(arrFloat) / sizeof(*arrFloat);
  bubble_sort(arrFloat, szFloat, sizeof(arrFloat[0]), cmp_float);//排序后数组： 1.0 2.0 3.0 3.1 4.5

  struct Student s[3] = {{name : "zhangsan", age : 18}, {name : "lisi", age : 14}, {name : "wangwu", age : 20}};
  int szStu = sizeof(s) / sizeof(*s);
  bubble_sort(s, szStu, sizeof(s[0]), cmp_struct); //排序后数组 {name : "lisi", age : 14} {name : "zhangsan", age : 18} {name : "wangwu", age : 20}

  return 0;
}
```


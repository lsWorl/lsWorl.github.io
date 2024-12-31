---
title: C语言字符串函数
date: 2023-09-03 19:43:30
categories: C
tags:
 - C
---





> 使用以下所有函数需要引入头文件`#include <string.h>`

#### `strlen()`函数



`size_t strlen(const char *string)`传入字符串返回字符串长度，这里`size_t == unsigned int`所以这里要是直接进行比较将会以无符号数进行比较。

例：

```c
  
  // strlen("abc") == 3  strlen("abcef") == 5 (strlen("abc") - strlen("abcef")) == 2 无符号数加减符号位默认为正
  if (strlen("abc") - strlen("abcef") > 0)
  {
    printf("unsigned");//这条语句将会打印
  }
  else
  {
    printf("signed");
  }
```



##### 递归实现`strlen()函数`

```c
int Strlen(const char *str)
{
  //当查询到为\0时结束递归
  if (*str == '\0')
  {
    return 0;
  }
  else
  {
    //每次递归指针往后走一位，并值+1
    return 1 + my_strlen(str + 1);
  }
}
```



#### `strcpy()`函数

`char* strcpy( char* dest, const char* src )`用于字符串拷贝，拷贝的时候会将`src`的`'\0'`一同拷贝，长度不受限制。

> 想用拷贝固定个数的用`char* strncpy( char* dest, const char* src, size_t count )`用于字符串拷贝，长度受限制。
>
> **使用函数时需要注意：**
>
> - 源字符串`src`必须以`'\0'`结束。
> - 会将源字符串中的`'\0'`拷贝到目标空间`dest`。
> - 目标空间必须足够大，以确保能放下源字符串。
> - 目标空间必须可变。

```c
  char arr1[] = "abcdef";
  char arr2[] = "abc";
  strcpy(arr1,arr2); //地址查看arr1结果为 {'a','b','c','\0','e','f','\0'}

  char arr3[10] = "abcdef";
  char arr4[] = "abc";
  strncpy(arr3,arr4,6); //地址查看arr1结果为 {'a','b','c','\0','\0','\0','\0','\0','\0'} 当要拷贝字符串长度不够会补'\0'
```



##### 实现`strcpy()`和`strnpy()`函数

```c
//src在这函数内并没有需要进行值变化，所以用const声明保证不可变
char* Strcpy(char *dest,const char *src)
{
  //断言保证传入的不是空指针
  assert(dest != NULL);
  assert(src != NULL);
  char* ret = dest;
  while ( *src != '\0')
  {
    //将src的值赋值给dest的值后指针往后查找
    *dest++ = *src++;
  }
  *dest = '\0';
  //返回dest的起始地址
  return ret;
}


char *Strncpy(char *dest, const char *src, int count)
{
  //循环count次
  for (size_t i = 0; i < count; i++)
  {
    //当src没到'\0'说明不是最后一个字符
    if (*src != '\0')
    {
      *dest = *src;
      dest++;
      src++;
    }
    else
    {
      //当到最后一个字符但次数还没用完就剩下字符全为'\0'
      *dest = '\0';
      dest++;
    }
  }
}
```





#### `strcat()`函数

`char *strcat( char *strDestination, const char *strSource)` 将`strSource`追加到`strDestination`字符串中（此函数不可目标字符串和资源字符串相同，会因找不到`\0`而陷入死循环）。

> 想用追加固定个数的用`char* strncat( char* strDest, const char* strSource, size_t count )`用于字符串追加，追加完后会补'\0'，**要是`count`个数大于`strSource`长度不会补'\0'**。
>
> **使用函数时需要注意：**
>
> - 源字符串`strSource`必须以`'\0'`结束。
> - 目标空间必须足够大，以确保能放下源字符串。
> - 目标空间必须可变。

```c
  char arr1[30] = "hello ";
  char arr2[] = "world";
  strcat(arr1, arr2);
  printf("%s\n",arr1);//输出 hello world 
  
  char arr3[30] = "abcdef\0xxxxxxxx";
  char arr4[] = "world";
  strncat(arr3,arr4,3);
  printf("%s\n",arr3);//输出 abcdefwor 后面的xxx由于前面遇到'\0’就无法显示了
```



##### 实现`strcat()`和`strncat()`函数

```c
char *my_strcat(char *strDestination, const char *strSource)
{
  assert(strDestination);
  assert(strSource);
  char *ret = strDestination;
  //当strDestination值不为'\0'就继续循环查找。
  while (*strDestination)
  {
    strDestination++;
  }
  //这部分实现和strcpy()实现基本相同，这种写法更加简便，边自增边赋值并没有搜寻到'\0'就继续循环。
  while (*strDestination++ = *strSource++)
  {
    ;
  }
  return ret;
}

//根据个数追加字符串
char *Strncat(char *strDest, const char *strSource, int count)
{
  char *ret = strDest;
  while (*strDest)
  {
    strDest++;
  }
  
  while (count && *strSource)
  {
    *strDest = *strSource;
    strDest++;
    strSource++;
    count--;
  }
  //不管strDest的'\0'后是否还有值，直接添加完strSource的字符后添加'\0'
  *strDest = '\0';
  
  return ret;
}
```



#### `strcmp()`函数

`int strcmp( const char *str1, const char *str2 )`

> `int strncmp( const char *str1, const char *str2 ,size_t count )` 用于比较固定数量的字符串大小
>
> 按从左往右的顺序比较两字符串在ASCLL表中的大小。
>
> - `str1`大返回大于0的数字
> - `str2`大返回小于0的数字
> - 相等返回0。

```c
  //用char *声明保证是常量
  char *arr1 = "abcdef";
  char *arr2 = "abc";
  char *arr3 = "abc";
  
  int ret1 = strcmp(arr1,arr2);
  int ret2 = strcmp(arr2,arr1);
  int ret3 = strcmp(arr2,arr3);
  printf("%d\n", ret1);//1
  printf("%d\n", ret2);//-1
  printf("%d\n", ret3);//0

  const char *arr4 = "abcdjf";
  const char *arr5 = "abcfgh";
  int ret4 = strncmp(arr4, arr5, 3);
  int ret5 = strncmp(arr4, arr5, 4);
  printf("%d\n", ret4); // 输出 0
  printf("%d\n", ret5); // d小于f 输出 -2
```



##### `strcmp()`函数实现

```c
int my_strcmp(const char *str1, const char *str2)
{
  assert(str1 && str2);
  //当前值相等就指针往后继续查询
  while (*str1 == *str2)
  {
    if (*str1 == '\0')
      return 0;
    str1++;
    str2++;
  }
  return ( *str1 - *str2 ); //前者大返回大于0的数字，后者大返回小于0的数字
}
```





#### `strstr()`函数

`char *strstr( const char *string, const char *strCharSet)`用于查找一个子字符串`strCharSet`。

```c
  const char *p1 = "abcdjf";
  const char *p2 = "bc";
  char* ret = strstr(p1,p2);
  if(ret==NULL){
    printf("Not Find\n");
  }else{
    printf("%s\n",ret); //打印 bcdjf
  }
```





##### `strstr()`函数实现

```c
char *Strstr(const char *str1, const char *str2)
{
  assert(str1);
  assert(str2);
   char *s1 ,*s2;
   char *cur = (char *)str1;
  // str2为空字符串
  if (!*str2)
    return (char *)str1;

  while (*cur)
  {
    char *s1 = cur;
    char *s2 = (char *)str2;
    while ((*s1 != '\0') && (*s2 != '\0') && (*s1 == *s2))
    {
      s1++;
      s2++;
      
    }
    if (*s2 == '\0')
    {
      return (char *)cur;
    }
    cur++;
  }

  return NULL;//找不到字符串
}
```



#### `strtok()`函数

`char * strtok( char * str, const char * sep)`用于分切字符串。

> 第一个参数指定要切割的字符串。
>
> `strtok`函数会通过`sep`集合来找到标记，并将其用`\0`结尾，返回一个指向这个标记的指针。（此函数会改变被操作的字符串，所以要使用建议先临时拷贝）。
>
> `strtok`函数的第一个参数不为`NULL`，函数将找到`str`中的第一个标记，并保存它在字符串中的位置。以此循环，直到`sep`中的标记全部被查找完成，返回`NULL`指针。



```c
  char arr[] = "192.168.0.123a@b.1";
  char *p = ".@";

  char buf[1027] = {0};
  strcpy(buf, arr);
  char *ret = NULL;
  for (ret = strtok(buf, p); ret != NULL; ret = strtok(NULL, p))
  {
    printf("%s\n", ret);//192 168 0 123a b 1
  }

  return 0;
```



#### `memcpy()`函数

`void *memcpy( void * destination, const void * source, size_t num)`用于拷贝数组。

> - 从`source`的位置开始向后复制`num`个字节的数据到`destination`的内存位置。
> - 这个函数在遇到`'\0'`时候并不会停止。
> - 如果`source`和`destination`有任何的重叠，复制的结果都是未定义的。



```c
  int arr1[] = {1,2,3,4,5};
  int arr2[5] = {0};

  memcpy(arr2,arr1,sizeof(arr1));
  for (size_t i = 0; i < sizeof(arr2) / sizeof(arr1 + 0); i++)
  {
    printf("%d ",arr2[i]); //打印 1 2 3 4 5
  }
```



##### `memcpy()`实现

```c
void *Mmemcpy(void *dest, const void *src, size_t num)
{
  void * ret = dest;
  assert(dest && src);
  while (num--)
  {
    //转化为char *来通过一个一个字节来进行交换
    *(char *)dest = *(char *)src;
    (char *)dest++;
    (char *)src++;
  }
    
  return ret;
}
```



#### `memmove()`函数

`void *memmove( void * destination, const void * source, size_t num)`用于移动一个字符流到另一个中。

```c
  int arr1[] = {1, 2, 3, 4, 5,6,7,8};
  //把 1 2 3 4 5 拷贝到arr1[2]开始的数字后去，20==4*5代表移动5位
  memmove(arr1 + 2, arr1, 20);
  for (size_t i = 0; i < sizeof(arr1) / sizeof(arr1 + 0); i++)
  {
    printf("%d ", arr1[i]); //1 2 1 2 3 4 5 8
  }
```



##### `memmove()`实现

```c
void *Memmove(void *dest, const void *src, size_t num)
{
  assert(dest && src);
  void *ret = dest;
  //从左往右进行替换 从第一个字节往后进行替换
  if (dest < src || dest > ((char*)src + num))
  {
    while (num--)
    {
      *(char *)dest = *(char *)src;
      (char *)dest++;
      (char *)src++;
    }
  }
  //从右往左进行替换
  else if (dest > src && dest < (src + num)){
    //for和while循环均可以实现 保证从最后一个字节往前进行替换即可
    for (size_t i = num   ; i > 0; i--)
    {
     *((char *)(dest + i - 1)) = *((src + i - 1));
    }
    // while (num--)
    // {
    //   *((char *)(dest + num)) = *((char *)(src + num));
    // }
  }
    return ret;
}
```



#### `memocmp()`函数

`int memcmp( const void *ptr1, const void *ptr2, size_t num)`用于比较两个内存的大小。

> - `ptr1 > ptr2`返回大于0的数。
> - `ptr1 < ptr2`返回小于0的数。
> - `ptr1 == ptr2`返回0。  



```c
  int arr1[] = {1, 2, 3, 4, 5};
  int arr2[] = {1, 2, 5, 4, 3};
  int ret = memcmp(arr1, arr2, 8);
  int ret2 = memcmp(arr1, arr2, 9);
  printf("%d\n", ret); //打印0 表示前8个字节结果一样
  printf("%d\n", ret2); //打印-1 说明arr1小于arr2
```


---
title: 数据结构-线性表的概念与C语言实现
date: 2023-09-13 22:30:06
categories: 数据结构
mathjax: true
tags:
 - C
 - 数据结构
---





### 线性表的定义

> **注：线性表是一个逻辑结构！并不是真正物理意义上的地址相邻，而是在抽象层面的相邻，不要和顺序表搞混！**
>
> 线性表是具有相同数据类型的n个数据元素的有限序列。除了第一个元素意外，每个元素有且仅有一个直接前驱。除最后一个元素外，每个元素有且仅有一个直接后继。



**例：**
$$
设有一个线性表 L=(a_1,a_2,...,a_i,a_{i+1},...,a_n)(a_1到a_n皆为int类型)\\此时a_2的直接前驱为a_1,直接后继为a_3,以此类推。
$$


> 由此，可以得出以下特点：
>
> - 表中元素的个数有限
> - 表中元素具有逻辑上的顺序性
> - 表中元素的数据类型相同，所占存储空间大小相同
> - 元素都是数据元素，每个元素都是单个元素

**线性表是逻辑结构，顺序表和链表指的是存储结构，两者概念不相同。**



### 顺序表的定义与实现



#### 顺序表的定义

> 顺序表是用一组地址连续的存储单元依次存储线性表中的数据元素，使每个元素即在逻辑上相邻也在物理位置上相邻。
>
> 顺序表的第一个元素表示顺序表的起始位置，接下来的元素地理位置都是在第一个元素之后，所以可得顺序表的特点是元素的逻辑顺序（即线性表）和物理顺序相同。



例：

```C
//创建了一个元素都为int类型且最大长度为10的顺序表
#define MaxSize 10
typedef struct{
    int data[MaxSize]; //顺序表的元素
    int length;		   //顺序表的当前长度
}SqList;
```



也可以采用动态分配的形式来创建顺序表（配合`malloc`函数）。

```c
typedef struct{
    int *data;         //顺序表的元素，采用指针的形式
    int length;		   //顺序表的当前长度
    int MaxSize;	   //顺序表的最大容量
}SqList;
```

当然，数组也是顺序表表的一种。例：`int arr[10]`就相当于定义了一个最大长度为10且类型都为`int`的顺序表。



> 顺序表最主要的特点就是**随机访问**，即通过首地址和元素序号可以在时间O(1)内找到置顶的元素，但同样也有缺点，由于顺序表物理位置相邻，插入和删除操作时都必须移动大量元素。



#### 静态顺序表的实现



##### 顺序表的创建

```c
// 定义布尔值
#define bool char
#define true 1
#define false 0

// 定义元素类型
#define ElemType int
// 定义顺序表最大长度
#define MaxSize 10
// 静态分配结构体
typedef struct
{
  ElemType data[MaxSize]; // 元素
  int length;             // 长度
} SqList;
```



##### 顺序表的初始化

```c
// 静态顺序表初始化
void InitList(SqList *L)
{
  int i;
  for (i = 0; i < MaxSize; i++)
  {
    L->data[i] = 0;
  }
  L->length = 0; //默认长度为0
}
```



##### 顺序表的插入操作

```c
// 顺序表插入操作      i为位置 e为元素
bool SqListInsert(SqList *L, int i, ElemType e)
{
  // 插入位置不合法
  if (i < 1 || i > L->length + 1)
  {
    printf("This is an invalid action");
    return false;
  }
  //当前存储空间已满
  if (L->length >= MaxSize)
    return false;
  //将所有元素后移
  for (size_t j = L->length; j >= i; j--)
  {
    L->data[j] = L->data[j - 1];
  }
  L->data[i - 1] = e;
  L->length++; //长度增加
  return true;
}
```



##### 顺序表的删除操作

```c
// 顺序表删除操作            i为位置  e用于接受删除的元素
bool SqListDelete(SqList *L, int i, ElemType *e)
{
  int j;
  //判断输入的位置是否合法
  if (i < 1 || i > L->length + 1)
  {
    printf("This is an invalid action");
    return false;
  }
  // 将删除元素告诉主函数
  *e = L->data[i - 1];
  //将删除元素后的每一位都向前移
  for (j = i; j < L->length; j++)
  {
    L->data[j - 1] = L->data[j];
  }
  L->length--;
  return true;
}
```



##### 顺序表按指查找

```c
// 顺序表按值查找                  e为要查找的类型
int SqListLocateElem(SqList *L, ElemType e)
{
  // 返回-1代表顺序表为空
  if (SqListIsEmpty(*L)) //SqListIsEmpty是用于查询顺序表是否为空
    return -1;
  for (size_t i = 0; i < L->length; i++)
  {
    if (*(L->data + i) == e)
    {
      return i + 1;
    }
  }
  //返回0代表顺序表中无要查找的元素 
  return 0;
}
```



### 线性表的链式表示

> 使用链式存储形式可以以"链"来建立起元素之间的逻辑关系，因此可以通过修改指针来进行插入和删除操作，但也会失去顺序表可随机存取的优点。



#### 单链表的定义

> 线性表的链式存储又称单链表，它是通过一组任意的存储单元来存储线性表中的数据单元。

单链表的节点类型如下：

```c
typedef struct LNode{    //定义单链表的结点类型
    ElemType data;       //数据域
    struct LNode *next;  //指针域
}LNode, *LinkList;//重命名为LNode表示单个节点 *LinkList表示链表
```

由于链表非随机存取的存储结构，每次要寻找一个特定的节点时，需要从表头开始遍历，依次查找。

在单链表中也分为带头节点与不带头节点。引入头节点，可以带来两个优点：

> - 由于第一个数据结点的位置被存放在头节点的指针域中，因此在链表的第一个位置上的操作与其他表的操作一致，无需像不带头节点一样特殊处理。
> - 无论链表是否为空，其头指针都是指向头节点的非空指针，因此空表和非空表的处理也就得到了统一。



##### 循环单链表

> 循环单链表和单链表的区别就在于最后一个节点的`next`指向的是头节点，从而整个链表形成一个环。使单链表无论从哪开始扫描都能获得全部元素。

由于没有节点会指向`NULL`，当判空就变成了`L->next == L`，判断链表的下一个节点是否指向本身，由于循环单链表的插入、删除算法与单链表几乎一样，除了在最后一个节点需特殊处理将后一节点指向于头节点，以让单链表保持循环的性质。



#### 单链表的基本操作实现

##### 初始化链表

```c
// 初始化带头节点的链表
LNode* InitLNode(LinkList L)
{
  //动态开辟内存空间
  L = (LNode *)malloc(sizeof(LNode));
  //将链表指向下一个元素为空
  L->next = NULL;
  //返回链表
  return L;
}
```



##### 判断链表是否为空

```c
// 判断链表是否为空
bool LinkIsEmpty(LinkList L)
{
  return (L == NULL);
}
```



##### 按位序插入元素

```c
// 插入元素到单链表  在i的位置插入元素e
bool ListInsert(LNode* L, int i, ElemType e)
{
  if (i < 1)
    return false;
  if (LinkIsEmpty(L))
    return false;
  LNode *p = L;
  int j = 0;                     // 当前链表所指向的位置
  while (p != NULL && j < i - 1) // 找到第i-1位置的节点
  {
    p = p->next; // 每次循环让p指向下一个节点
    j++;
  }
  if (p == NULL)
    return false; // 如果P==NULL说明没有找到

  LNode *newNode = (LNode *)malloc(sizeof(LNode));
  newNode->data = e;
  newNode->next = p->next;
  p->next = newNode;
  return true;
}
```



##### 尾插法

```c
// 在节点后插入元素
bool InsertNextNode(LNode *L, ElemType e)
{
  // 判断是否为空
  if (LinkIsEmpty(L))
    return false;
  LNode *newNode = (LNode *)malloc(sizeof(LNode));
  // 空间不足，插入失败
  if (newNode == NULL)
    return false;
  newNode->data = e;

  newNode->next = L->next;
  L->next = newNode;
  return true;
}
```



##### 头插法

```c
// 在节点前插入元素  LNode为要插入的节点
bool InsertPriorNode(LNode *p, ElemType e)
{
  // 判断是否为空
  if (LinkIsEmpty(p))
    return false;

  LNode *newNode = (LNode *)malloc(sizeof(LNode));
  newNode->data = p->data;
  p->data = e;
  newNode->next = p->next;
  p->next = newNode; 

  return true;
}
```



##### 删除操作

```c
// 删除节点
bool ListDelete(LinkList L, int i, ElemType *e)
{
  if (LinkIsEmpty(L))
    return false;
  LNode *tmp;
  while (i)
  {
    if (i == 1)
    {
      tmp = L;
    }
    L = L->next;
    i--;
  }

  *e = L->data;
  tmp->next = L->next;
  free(L);
  return true;
}
```



##### 删除指定节点(无法实现要删除的元素为最后一个)

```c
//删除指定节点
bool DeleteNode(LNode *p){
  if(p==NULL)return false;
  LNode *q = p->next;
  p->data = q->data;
  p->next = q->next;
  free(q);
  return true;
}
```



##### 按位查找节点

```c
//按位查找
LNode GetElem(LinkList L, int i){
  if (LinkIsEmpty(L))
    return *(LNode *)NULL;
  while (i)
  {
    L = L->next;
    i--;
  }
  if(!L)return *(LNode *)NULL;
  
  return *L;
}
```



##### 按值查找节点

```c
//按值查找
LNode LocateElem(LinkList L, ElemType e)
{
  if (LinkIsEmpty(L))
    return *(LNode *)NULL;
  while (L->data != e && L != NULL)
  {
    L = L->next;
  }
  if (!L)
    return *(LNode *)NULL;
  return *L;
}
```



##### 求表长

```c
//求表长
int ListLength(LinkList L){
  int length = 0;
  while (L !=NULL)
  {
    L = L->next;
    length++;
  }
  return length  - 1; //减去表头
}
```



#### 双链表的定义

> 单链表中只有一个指向后继的指针，使得链表只能从头节点依次顺序地向后遍历。为了克服单链表中的求点，引入了双链表，双链表节点中有两个指针`prior`和`next`，分别用来指向前驱节点和后继节点。

类型定义如下：

```c
typedef struct DNode{
  ElemType data; //数据域
  struct DNode *prior,*next;  //前继和后继指针
}DNode, *DLinkList;
```



> 双链表在单链表的节点中增加了指向前驱指针`prior`，由此可以通过`prior`找到前驱节点，因此，插入、删除操作的时间复杂度仅为O(1).



##### 循环双链表

> 循环双链表的定义和循环单链表基本相同，就是将最后一个节点的`next`指向头节点，并将头节点的`prior`指向最后一个节点，即形成闭环。判空操作也于循环单链表如出一辙，判断`L->next == L && L->prior == L`即可，而其他删除插入等操作都与双链表几乎相同。



#### 双链表的基本操作实现

##### 双链表的初始化

```c
//初始化带头节点的双链表
DNode *InitDLinkList(DLinkList L)
{
  L = (DNode *)malloc(sizeof(DNode)); //分配内存空间
  if (L == NULL)
    return (DNode *)NULL;
    L->data = 0;
  L->prior = NULL; //前驱节点永远指向NULL
  L->next = NULL;
  return L;
}
```



##### 双链表的插入操作

```c
// 双链表的插入操作,p节点后插入s节点
bool InsertNextDNode(DNode *p, DNode *s)
{
  if (p == NULL || s == NULL)
    return false;
  s->next = p->next;
  // 判断p是否是最后一个节点
  if (p->next != NULL)
  {
    p->next->prior = s;
  }
  s->prior = p;
  p->next = s;
  return true;
}
```



##### 双链表的删除操作

```c
//双链表的删除操作 将p节点删除
bool DeleteDNode(DNode * p){
  if(p==NULL) return false;
 p->prior->next = p->next;
 //判断是否为最后一个元素
 if(p->next !=NULL)
 p->next->prior = p->prior;
 free(p);
}
```



```c
// 删除p节点的后继节点
bool DeleteNextDNode(DNode *p)
{
  if (p == NULL)
    return false;
  // 存储p的下一个节点
  DNode *q = p->next;
  // 判断p的后继节点是否为空
  if (q == NULL)
    return false;
  if (q->next != NULL)
  {
    p->next = q->next;
    q->next->prior = p;
  }
  else
  {
    p->next = NULL;
  }

  free(q);

  return true;
}
```



```c
//摧毁链表
void DestoryDLinkList(DLinkList L){
  while (L->next !=NULL)
  {
    //这函数即是上方用于删除后继节点
    DeleteNextDNode(L);
  }
  free(L);
  L = NULL;
}
```



> 查询操作和单链表基本相同，就不再过多赘述。



#### 静态链表

> 静态链表借用数组的特性来描述链式存储结构，即使链表在物理上也实现临近，节点也有数据域`data`和指针域`next`，只不过`next`是存放节点的相对地址（数组下标），又称游标。与顺序表一样，静态链表也要预先分配一块连续的内存空间。静态链表以`next == -1`作为其结束的标志。

**静态链表结构类型**

```c
#define MaxSize 10
#define ElemType int

typedef struct SNode
{
  ElemType data; //存储数据元素
  int next; //下个元素的数组下标
} SNode;
```



### 顺序表和链表的比较

- **存储（读写）方式**

  顺序表可以顺序存取，也可以随机存取，链表只能从表头顺序存取元素。例如在第`i`个位置上执行存或取的操作，顺序表仅需依次访问，而链表则需从表头开始依次访问`i`次。

- **逻辑结构与物理结构**

​	采用顺序存储时，逻辑上相邻的元素，对应的物理存储位置也相邻。采用链式存储时，逻辑上相邻物理上并不一定相邻，得通过指针来进行查找下一个元素。

- **查找、插入和删除操作**

​	对于按值查找，顺序表无序时，两者的时间复杂度都为`O(n)`;顺序表有序可使用二分查找，复杂度为`O(log_2 n)`。

​	对于序号查找，顺序表支持随机访问，时间复杂度为`O(1)`，而链表复杂度为`O(n)`。

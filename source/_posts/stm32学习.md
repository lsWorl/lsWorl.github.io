---
title: stm32标准库
date: 2024-12-30 13:54:55 
categories: 嵌入式
tags:
 - 单片机
---

<meta name="referrer" content="no-referrer"/>



### 标准库初始化

------

> [!IMPORTANT]
>
> 采用Keil IDE基于C语言进行编写stm32运行代码（以stm32f10x系列为例），使用标准库首先需要引入相应的库文件，该文件需要自己去网上下载  



#### 新建工程

编写逻辑代码前需要对keil将文件夹中的内容读入到IDE中 ，点击keil上方tab栏中的`Project`里面的`New μVisioon Project...`，找到存放共工程的文件夹，并在该文件夹中在下方的文件名中输入该工程的名称，后点击保存。

![选择芯片](https://i-blog.csdnimg.cn/direct/4ea1f7c781d04b82b40bdb6a10f51acf.png)   

在芯片选择中选择`STM32F1x`对应的芯片，后点击OK，后续的窗口直接关闭即可。  

后面再将对应的固件库文件放入到该工程文件夹中。



##### keil中把文件导入工程

在keil中点击三个方块样式的工程管理按钮

![](https://i-blog.csdnimg.cn/direct/39bdbbf0c37f4ec3991068162084ba65.png)  

在`Project Items`中的`Groups`可添加对应名的文件夹，然后在再右侧的`files`的下方`Add Files`添加对应的固件库文件，即可成功创建文件。  

然后点击三个方块样式旁边的魔术棒按钮。

![](https://i-blog.csdnimg.cn/direct/746be52f03874323a14db7cf49249dd8.png)  

在Tab栏中C/C++中的`Include Paths`中添加工程所用到的文件以及`Define`中改为`USE_STDPERIPH_DRIVER`。

![](https://i-blog.csdnimg.cn/direct/2b966ba0e35a4e9487f5e41258f9129c.png)

**注：程序烧入到单片机中需要在该tab中的`Debug`中设置**  

这样就成功完成了工程创建。



#### 操作STM32的GPIO所需的初始化

> 先引入包`#include "stm32f10x.h"`再进行后续操作

首先需要将stm32的时钟使能，对应的函数方法在`stm32f10x_rcc.h`中，主要函数为以下三个

```c
void RCC_AHBPeriphClockCmd(uint32_t RCC_AHBPeriph, FunctionalState NewState); //使能AHB的外设时钟
void RCC_APB2PeriphClockCmd(uint32_t RCC_APB2Periph, FunctionalState NewState); //使能PB2的外设时钟
void RCC_APB1PeriphClockCmd(uint32_t RCC_APB1Periph, FunctionalState NewState); //使能PB1的外设时钟
```

还需要使用`void GPIO_Init(GPIO_TypeDef* GPIOx, GPIO_InitTypeDef* GPIO_InitStruct)`函数，使用结构体的参数来初始化GPIO口，使用该函数需要定义以该结构体`GPIO_InitTypeDef`为类型的结构体变量，以下为例：  

```c
GPIO_InitTypeDef GPIO_InitStructure;
GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;	//
GPIO_InitStructure.GPIO_Pin = GPIO_Pin_13; 		//
GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
GPIO_Init(GPIOA,&GPIO_InitStructure);
```

  

加上以上操作的完整代码为：

```c
#include "stm32f10x.h"                  // Device header

int main(void)
{
    //ENABLE CLOCK
    GPIO_InitTypeDef GPIO_InitStructure;
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA,ENABLE);
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;	//采用推挽输出模式
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_0 | GPIO_Pin_1 | GPIO_Pin_2;			//使用GPIO0，1，2号引脚
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;	//输出速度设置为50MHz
    GPIO_Init(GPIOA,&GPIO_InitStructure);				//初始化GPIOA外设的0号引脚
    while(1)
    {
        
    }
}

```



##### GPIO的工作模式

```c
typedef enum
{ GPIO_Mode_AIN = 0x0,			//模拟输入
  GPIO_Mode_IN_FLOATING = 0x04, //浮空输入
  GPIO_Mode_IPD = 0x28,			//下拉输入
  GPIO_Mode_IPU = 0x48,			//上拉输入
  GPIO_Mode_Out_OD = 0x14,		//开漏输出
  GPIO_Mode_Out_PP = 0x10,		//推挽输出
  GPIO_Mode_AF_OD = 0x1C,		//复用开漏
  GPIO_Mode_AF_PP = 0x18		//复用推挽
}GPIOMode_TypeDef;
```



### GPIO的函数使用



##### 设置函数

```c
void GPIO_SetBits(GPIO_TypeDef* GPIOx, uint16_t GPIO_Pin);					//将GPIO_Pin设置为高电平，支持多引脚
void GPIO_ResetBits(GPIO_TypeDef* GPIOx, uint16_t GPIO_Pin);				//将GPIO_Pin设置为低电平，支持多引脚
void GPIO_WriteBit(GPIO_TypeDef* GPIOx, uint16_t GPIO_Pin, BitAction BitVal);//第三个参数为Bit_SET置为高电平，Bit_RESET置为低电平，仅支持单引脚配置
void GPIO_Write(GPIO_TypeDef* GPIOx, uint16_t PortVal);
```



使用实例：

```c
GPIO_SetBits(GPIOA,GPIO_Pin_0); //将GPIOA端口的第0号引脚置为高电平

GPIO_ResetBits(GPIOA,GPIO_Pin_0); //将GPIOA端口的第0号引脚置为低电平

GPIO_WriteBit(GPIOA,GPIO_Pin_0,Bit_RESET); //将GPIOA端口的第0号引脚置为低电平

GPIO_Write(GPIOA,~0x0001);  //将GPIOA端口的第0号引脚置为低电平
```



##### 读取函数

```c
uint8_t GPIO_ReadInputDataBit(GPIO_TypeDef* GPIOx, uint16_t GPIO_Pin);	//读取GPIO_Pin的输入值，返回值代表该端口的电平
uint16_t GPIO_ReadInputData(GPIO_TypeDef* GPIOx);						//读取整个输入寄存器，返回每一位端口的电平
uint8_t GPIO_ReadOutputDataBit(GPIO_TypeDef* GPIOx, uint16_t GPIO_Pin); //
uint16_t GPIO_ReadOutputData(GPIO_TypeDef* GPIOx);						//
```


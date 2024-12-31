---
title: 如何对后端传来的数据进行JSON序列化
date: 2022-11-09 22:06:50
tags:
 - Flutter
 - JSON
categories: Flutter
---



## 引言

在传统Web开发领域我们通过ajax请求接收到后端发来的数据时，浏览器都已经帮我们完成了`json`的序列化，而在`Flutter`显然是不支持直接显示后端接收到的请求的，如此我们就需要对请求接收到的数据进行序列化，转变成为我们能看懂的东西。这里我主要介绍[JSON 和序列化数据 - Flutter 中文文档 - Flutter 中文开发者网站 - Flutter](https://flutter.cn/docs/development/data-and-backend/json)中的三种序列化方式。



- 直接使用内联序列化JSON数据（这种方式很方便，但是在代码运行前你都无法知道你取的类型是否正确，导致代码很容易出错）
- 



### 内联序列化JSON数据

实现方法很简单，主要依靠`Flutter`内置的`json.decode()`函数来对接收到后端的数据进行解码。

先说结论，主要用的就是`json.decode(value.toString());`，就是将获取到的数据转为字符串后进行`json`解码。

```dart
//发送请求类 这里使用的是dio来进行发请求 就简易的实现发送get请求
import 'package:dio/dio.dart';
class Request{
    // 配置实例
  	static final BaseOptions _options = BaseOptions(
    // baseUrl配置要发请求的地址
    baseUrl: 'http://127.0.0.1:3000/',
    //连接超时时间
    connectTimeout: 5000,
    //接收超时时间
    receiveTimeout: 5000);
    // 创建Dio实例
    static Dio _dio = Dio(_options);
    Future get(String path, {Map<String, dynamic>? params}) {
    if (params != null) {
      return _dio.get(path, queryParameters: params);
    }
    return _dio.get(path);
  }
}
```

有了发送请求类，接下来就是调用像后端发送请求。

```dart
//这里是发送请求获取具体数据的类
import 'package:imapp/http/request.dart';
class ContactsModel {
  //创建请求实例
  Request http = Request();
  //根据传入的userId来向后端发送请求
  Future getContactsInfo(int userId) {
    return http.get('/userContacts', params: {"userId": userId});
  }
}
```

经过上面一系列的操作后，就是具体视图层的操作。**这里是主要进行序列化的地方**

```dart
//获取联系人模型，就是将上方的类进行实例化
ContactsModel contactsModel = new ContactsModel();
//用来存放获取的用户数据
late Map<String, dynamic> contactsResult;

// 获取联系人
await contactsModel
    .getContactsInfo(id)
    .then((value) {
        print('------------联系人数据----------');
        //主要序列化的方式
        contactsResult = json.decode(value.toString());
        if (contactsResult['code'] == 200) {
            //这就获取到了后端的数据了
            print(contactsResult['data']);
        }
    });
```

使用上方这种方法，想获取内部数据就只能用`map['name']`这种形式来读取，就很难判断类型，因此需要更好的方法。



### 在模型类中序列化 JSON 数据

在上方代码中新建一个模型类来解决难以判断类型的方法。代码如下：

```dart
//模型类 这里直接拷贝文档的代码了，想了解更多可以去阅读官方文档（文档很清晰！！！）
class User {
  final String name;
  final String email;

  User(this.name, this.email);

  User.fromJson(Map<String, dynamic> json)
      : name = json['name'],
        email = json['email'];

  Map<String, dynamic> toJson() => {
        'name': name,
        'email': email,
      };
}
```

接下来在上方获取联系人的时候使用这个模型类

```dart
ContactsModel contactsModel = new ContactsModel();
//用来存放获取的用户数据
late Map<String, dynamic> contactsResult;

// 获取联系人
await contactsModel
    .getContactsInfo(id)
    .then((value) {
        print('------------联系人数据----------');
        //主要序列化的方式
        contactsResult = json.decode(value.toString());
        if (contactsResult['code'] == 200) {
            //这就获取到了后端的数据了
            print(contactsResult['data']);
            //主要操作在这！！！！！
            var user = User.fromJson(contactsResult['data'])
            //就可以直接使用user.email来获取到数据了
            print(user.email);//打印email
        }
    });
```

虽然这种方法解决了无法判断类型的问题，但仍然不是最优的方法，有没有一种方法可以直接根据我们提供的参数自动生成`json`序列化格式呢？当然是有的，官方就推荐了使用`json_serializable`。

具体如下。



## 使用代码生成库序列化 JSON 数据

在此之前，需要安装依赖：

```yaml
#这些都需要安装
dependencies:
  # 生成依赖
  json_annotation: <latest_version>

dev_dependencies:
  # 开发依赖
  build_runner: <latest_version>
  json_serializable: <latest_version>
```

在项目根目录下运行`flutter pub get 包名`或者直接在`pubspec.yaml`进行安装。

安装完成后，以上方当时的`User`模型类来作为例子。

```dart
import 'package:json_annotation/json_annotation.dart';

part 'user.g.dart';//这部分在使用flutter pub run build_runner watch来进行监听后会自动根据类型来生成，所以要保证前后端的参数名要一致
class User {
  final String name;
  final String email;

  User(this.name, this.email);

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
  Map<String, dynamic> toJson() => _$UserToJson(this);
}
```

这样就会和原先达到相同的效果，但是以更加灵活的方式来实现，调用的方法还是与第二种方法是相同的。

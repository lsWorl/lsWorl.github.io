---
title: Flutter中运用Provider
date: 2022-09-29 17:25:31
tags:
 - Flutter
 - Provider
categories: Flutter
---

<meta name="referrer" content="no-referrer"/>

### 前言

要明白为什么用`Provider`，在原先修改数据都是通过`setState`来进行修改，这样导致视图和逻辑无法分层，使后续代码难以维护，所以可以通过`Provider`来进行更好的维护。想在`Flutter`中实现MVVC架构的话通过`Provider`是一个不错的选择，而且在`Provider`官方文档也有比较清晰的说明，这里主要就是总结我做时候的方案。（本文参考了[Flutter的官方文档](https://flutter.cn/docs/development/data-and-backend/state-mgmt/simple#consumer)）



### 安装包

可以通过直接在`pubspec.yaml`在`dependencies`中添加`provider: 版本号`来直接安装`provider`。

![addPackage](https://img-blog.csdnimg.cn/b63b2cd543e74f18b9c0ceea51d0a409.png)



### 创建逻辑类

创建一个类来继承`Provider`的`ChangeNotifier`，这里用来当作改变状态的通知者。每次当状态要修改时候需要条用`notifyListeners()`才能使`Provider`知道你修改了里面的值。

![notifier](https://img-blog.csdnimg.cn/57f746a8fa8441d8bc6fc9a895cfccd6.png)

```dart
class ContactsViewModel extends ChangeNotifier {
  // 好友列表
  List _friendsList = [];
  // 添加好友
  void addFriend() {
    _friendsList.add({
      "img":"图片",
      "name": "李四"
    });
    // 更新后通知
    notifyListeners();
  }

  List get friendsList {
    return _friendsList;
  }
}

```



### 在`main.dart`中接收状态

在这不一定是非要在`main.dart`文件中使用，也可以在你需要数据文件的子组件的父组件使用，使用`MultiProvider`是因为可以有多个状态类需要监听，也可以使用单个，这里就不做演示了。（这里因为main就是父组件了，所以就直接在main这里使用）

![main](https://img-blog.csdnimg.cn/1199db5596a84bd9afabd467cfe188c9.png)

```dart
void main() {
  runApp(MultiProvider(providers: [
    ChangeNotifierProvider(create: (context) => ContactsViewModel())
  ], child: const MyApp()));
}
```

**也可以在build里面中使用**

```dart
class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (context) => ContactsViewModel())
        ],
        child: MaterialApp(
          title: 'app标题',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(primaryColor: Colors.white),
        ));
  }
}
```



### 数据更改与获取

获取数据有两种方式，一个是通过`Provider.of<逻辑类>(context, listen: false).数据名`和` Consumer`包裹。

使用`Provider.of`来获取的话不会更新UI，即更新数据但用户看到的视图并不会进行改变，想要视图进行变更需要通过`Consumer`进行包裹， 这样可以减少`builder`的重复渲染。



#### `Provider.of`来更改数据

在上方在`main.dart`中对所有`Widget`进行监听后，使用`Provider.of<逻辑类>(context, listen: false).数据名`的方式来进行数据修改。

![provider](https://img-blog.csdnimg.cn/6ff1a90c49ac484d9a258be843c6870f.png)

这里调用了上方的`addFriend()`方法，当我点击右侧显示的聊天列表即会添加一个好友进`friendsList`数组中。并且在联系人的这部分使用`Consumer`来包裹，里面的数据则是用`friendsList`的数组。

![consumer](https://img-blog.csdnimg.cn/3dfb47389e1c4f10a4c63765f5cc2285.png)

当点击后就向数组中`add`一个新对象，因为联系人列表中使用了`Consumer`包裹，所以当监听到数据有更新了，UI层也会跟着做出相应的变化。

![contact](https://img-blog.csdnimg.cn/c979f4e2fbd049ffb18ca84056b8dcc5.png)




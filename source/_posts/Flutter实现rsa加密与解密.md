---
title: Flutter实现rsa加密与解密
date: 2022-09-16 23:11:11
tags:
 - Flutter
 - Dart
categories: Flutter
---

<meta name="referrer" content="no-referrer"/>

## 前言

在想使用rsa加密前，应该首先了解什么是rsa加密。rsa作为目前流行的非对称加密，所需要公钥和私钥两把钥匙才能解开传输的数据。所以要使用rsa加密算法，首先就得要设置**公钥**和**私钥**（私钥一般都是放在后端，私钥在前端极其不安全，前端的代码几乎都是透明的，这里演示就全在前端中演示）。



### 导包与获取钥匙

在`Flutter`中使用加密算法，需先在`pubspec.yaml`文件中导如`encrypt`包（版本以flutter社区的最新版为准），修改文件后保存会自动导包。

![importPackage](https://img-blog.csdnimg.cn/a09eb410d52943a7b7e6474bf1814dad.png)

然后去获取公钥和私钥（可以在网页上生成），并放在静态资源文件夹中。

![key](https://img-blog.csdnimg.cn/66197e0ad4da47658847b835ce1788df.png)



公钥格式为：（`-----BEGIN PUBLIC KEY-----`和结尾的`-----END PUBLIC KEY-----`是必加的，中间内容为公钥，私钥同理）

```pem
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2/vF49zKHdP0EY1B9Zim
5t4X1GsnP1TEYgYMnWXQNLluWV53iInEJBmw/xf++Ohbgp7WhAFcjlRJ6Bxnqj6n
CtAsXAjIXnv1UDCabw/pUb2Tm349I990wSGEeIbuSRPD/t1O4qOTgpvCWRDgVVfX
PILWBkshMhQA7xs0LeEXtimtCLnjUywlXw+Hthlx2Zi6Ba656HKro9EPZ2BRGGUd
mbPLWibeD7MF8ETz5R0w/N+3GyTnizPihsFU4sPOnWwhsR0FWz0i+uVeYrIkpyo6
hkXFQMLt4RzA9VVsd+nk5h/SQ/NQ38VrpUlLfcL4K/pzUXCrJ6X5KYOIfEcG16QG
sQIDAQAB
-----END PUBLIC KEY-----
```

私钥格式为：

```pem
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDb+8Xj3Mod0/QR
jUH1mKbm3hfUayc/VMRiBgydZdA0uW5ZXneIicQkGbD/F/746FuCntaEAVyOVEno
HGeqPqcK0CxcCMhee/VQMJpvD+lRvZObfj0j33TBIYR4hu5JE8P+3U7io5OCm8JZ
EOBVV9c8gtYGSyEyFADvGzQt4Re2Ka0IueNTLCVfD4e2GXHZmLoFrrnocquj0Q9n
YFEYZR2Zs8taJt4PswXwRPPlHTD837cbJOeLM+KGwVTiw86dbCGxHQVbPSL65V5i
siSnKjqGRcVAwu3hHMD1VWx36eTmH9JD81DfxWulSUt9wvgr+nNRcKsnpfkpg4h8
RwbXpAaxAgMBAAECggEAOXZP39CJnzcBVyBd7WhdmIrFEMCYtOtQjQZlfyvcMhmJ
4KBTev/5kzB+0nOTL7OKS9lv0XWFlswfrhjVX1wUSDfOjo/gvwWEM9kuTfqLCMYL
a5+TGu7A0b4Om2krjz0xgj6O35a47nH/V0KYRtK2L2FBxM0VM76T6+FgROe6SOOn
8BOvAiljHu+hzxOAx8T881daO2TpLXGcwSHcT8UfhIIiE7KBjqUmgDQwkBNcZvhd
uhNsSMBjNpf0sws6N2bJ3fK/Yo+23obW03yKqdWOXZ1/QD8PfdRn1gkNn1HwNKTU
JuC2K7gUNfHugYDywz2wL2YMiGwzBKOdVULMMPhzkQKBgQD3e2bOIcW5+OOeabIq
gGBzoOLaElUwJtFKZBNPG84t+mfYAzwHYkf416WXsR6ql0mLsmZaKBGYk+H5/Kco
1xxPfHlENHHZVfof1K1pQLxLoF9vW7rtMVT+CwdgbppBXoVDcqkri8h9aVPTPL/D
q6a9qFfcTO+wlfnCgaxXqlDAtQKBgQDjjhPx8sf55G7dZjl9wzfgGjsBRxOeecWr
dcfRy4S/WxTC0NwTNaPMyb534RbwHh/MDg9naoLg0kUZQ+AfzleUC5D/PI0G8fO7
qADXenb2ZwflBkyw5JmSsk2iJ8tREFgLfqAKrGDTSVc33q6mfm+fZHvZsGVUgxvr
riB1EZc3jQKBgFlUib9OIXkHheHgdRcyT55tLHVauLUwzcr0ZKPhfYLLKECoqjpg
F2qTLIqcvF0HTtzGAHv6ip9wgdkigZQUUXu/imY8J/wzNJ3Yvt+HJnCF6uzfR5Hm
hK9Oe9MrGTMPUzsNYFL/mdbq9f8BppaSlxVOdqhmfP5YpFa5R+Q87fkhAoGBAKnT
rGEC72o5qOAFXdzVKEtRaD4A3MyGVxcq1NFnUZA6mpj2pXiUrMW2vzbav3K/GL4C
tE5bOIgvhbBgbtFt/wCXTUSf3SSUyHGB5fbrCAPHSyYK+IuAYHkSJ0xg5KWATCVw
AGNW2QB3GOeygqfxbr8HkEMcGdPj8Z+IGeMlGLU1AoGBANpu3Sx5J6ELxpL3110I
6GfhmADZ/k8rTlkST+sfUJI1R3TcKqLBbyiNd1id1O1rKrnPfym41lNWz6MWRn6m
1GPrdTNZIfMJugEfJyaF2vojWyFXMEA/pvjfHeEjQLsoEoupKXLH/Tkm6zaNunJH
cX2rgz3C2PGugq1h2EZGBU5z
-----END PRIVATE KEY-----
```



### 代码

接下来就是通过函数来进行全局使用。

```dart
import 'package:encrypt/encrypt.dart';
import 'package:flutter/services.dart';

// 加密 Future代表异步操作
Future<String> encodeString(String content) async {
  final publicPem = await rootBundle.loadString('key/public.pem'); //key/public.pem为我上方放的公钥位置 这里不可使用encrypt文档中的parseKeyFromFile方法，会显示找不到文件
  dynamic publicKey = RSAKeyParser().parse(publicPem);

  final encrypter = Encrypter(RSA(publicKey: publicKey)); //加密使用公钥

  return encrypter.encrypt(content).base64; //返回加密后的base64格式文件
}

// 解密
Future<String> decodeString(String content) async {
  final privatePem = await rootBundle.loadString('key/private.pem');
  dynamic privateKey = RSAKeyParser().parse(privatePem); 

  final encrypter = Encrypter(RSA(privateKey: privateKey));//解密使用私钥
    
  return encrypter.decrypt(Encrypted.fromBase64(content));
}
```



### 实际运行



![show](https://img-blog.csdnimg.cn/0aa9eb0c8e8d4a2080c56893cff7e530.png)

我在按钮中添加了点击事件，当点击后会调用`encodeString`方法，因为方法使用了`Future`包裹为异步返回结果，所以都用`then`进行取值（前端的小伙伴应该很熟悉），最后进行打印，然后又将获得的加密数据进行解密并打印（实际运行结果看下面结果图）。

![final](https://img-blog.csdnimg.cn/d7a0233a28744dedbd0afdc76324c3e9.png)

可见数据成功进行了加密并解密了。


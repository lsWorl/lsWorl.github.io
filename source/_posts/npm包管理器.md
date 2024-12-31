---
title: npm包管理器
date: 2022-07-08 15:16:56
categories: 前端工程化
tags:
 - 前端工程化
 - node.js
 - npm
---



### npm包管理器简介

`npm` 是 Node.js 标准的软件包管理器。现在也可以使用`yarn`来代替`npm`作为一个包管理器。



#### npm常用命令

- 下载`npm` 可以管理项目依赖:`npm i ` 或 `npm install` 

  它会在 `node_modules` 文件夹（如果尚不存在则会创建）中安装项目所需的所有东西。

  

- 安装单个软件包`npm i <package-name> ` 或 `npm install <package-name>` 

  - 在安装软件包的时候添加`--save`表明安装并添加条目到 `package.json` 文件的 dependencies。

  - `--save-dev` 安装并添加条目到 `package.json` 文件的 devDependencies。

    区别主要是，`devDependencies` 通常是开发的工具（例如测试的库），而 `dependencies` 则是与生产环境中的应用程序相关。

- 更新所有软件包：`npm update`

- 更新指定软件包：`npm update <package-name>`

- 运行指定任务：

  在项目的`package.json`中的`scripts`配置了指定命令行任务可以通过`npm run <task-name>`进行运行。

  ```json
  //webpack中启动服务器同理
  {
    "scripts": {
      "watch": "webpack --watch --progress --colors --config webpack.conf.js",
      "dev": "webpack --progress --colors --config webpack.conf.js",
      "prod": "NODE_ENV=production webpack -p --config webpack.conf.js",
    },
  }
  ```

  

#### npm软件包安装位置

当使用 `npm` 安装软件包时，可以执行两种安装类型：

- 本地安装
- 全局安装

默认情况下，当输入 `npm install` 命令时，默认将所有包安装到当前项目的`node_modules`文件夹中。

在这种情况下，`npm` 还会在当前文件夹中存在的 `package.json` 文件的 `dependencies` 属性中添加所安装包名的条目。

使用 `-g` 标志可以执行全局安装：`npm install -g`

在 macOS 或 Linux 上，此位置可能是 `/usr/local/lib/node_modules`。 在 Windows 上，可能是 `C:\Users\YOU\AppData\Roaming\npm\node_modules`。

但是，如果使用 `nvm` 管理 Node.js 版本，则该位置会有所不同。

例如，使用 `nvm`，则软件包的位置可能为 `/Users/joe/.nvm/versions/node/v8.9.0/lib/node_modules`。



#### 使用npm安装的软件包

在node.js中使用`require`来引入npm安装的包

```bash
npm install lodash
```



```js
const _ = require('lodash')
```



通过`npm i`命令下载了一些可执行文件，一般都会放在`node_modules/.bin/` 文件夹下。

当想要执行这些文件可以输入 `./node_modules/.bin/name` 来运行它，但是最新版本的 npm（自 5.2 起）中包含的 npx 是更好的选择。 只需运行：

```bash
npx name
```

通过npx执行只需要在项目根目录就可输入，不需要进行下一步寻找路径。



#### 查看npm包安装的版本

使用`npm list`可以查看当前目录下已安装的所有`npm`软件包：

```bash
D:\Study\node.js>npm list
node.js@ D:\Study\node.js
+-- cowsay@1.5.0
`-- express@4.18.1
```



使用`npm list -g`可以获取全局安装的软件包：

```bash
D:\Study\node.js>npm list -g
C:\Users\sink\AppData\Roaming\npm
+-- @vue/cli@5.0.4
+-- hexo-cli@4.3.0
+-- json-server@0.17.0
+-- nodemon@2.0.15
+-- typescript@4.6.4
`-- vercel@24.2.4
```



若要仅获取顶层的软件包（基本上就是告诉 npm 要安装并在 `package.json` 中列出的软件包），则运行 `npm list --depth=0`：

```
D:\Study\node.js>npm list --depth=0
node.js@ D:\Study\node.js
+-- cowsay@1.5.0
`-- express@4.18.1
```

想要查看`npm`包中所依赖的包有哪些将`depth`的值进行修改即可。



#### 安装npm包中的旧版本

可以使用 `@` 语法来安装 npm 软件包的旧版本：

```bash
npm install <package>@<version>
```

使用以下命令可以安装 1.2.0 版本：

```bash
npm install cowsay@1.2.0
```

全局的软件包也可以这样做：

```bash
npm install -g webpack@4.16.4
```

可能还有需要列出软件包所有的以前的版本。 可以使用 `npm view <package> versions`：

```bash
 npm view cowsay versions
[ '1.0.0',  '1.0.1',  '1.0.2',  '1.0.3',  '1.1.0',  '1.1.1',  '1.1.2',  '1.1.3',  '1.1.4',  '1.1.5',  '1.1.6',  '1.1.7',  '1.1.8',  '1.1.9',  '1.2.0',  '1.2.1',  '1.3.0',  '1.3.1' ]
```



#### 查看npm的依赖包是否需要更新

使用`npm outdated`命令可以查看当亲目录下的包的版本与最新版本，可以根据自己需要调用`npm update`来对包进行更新，运行`npmupdate`不会更新目前已经是主流版本的包



#### npm版本控制说明

在`package.json`或`package-lock.json`的  `version`块中，通常版本分为`x.y.z`（x表示主版本，y表示次版本,z表示补丁版本）三个数字。



当发布新的版本时，不仅仅是随心所欲地增加数字，还要遵循以下规则：

- 当进行不兼容的 API 更改时，则升级主版本。
- 当以向后兼容的方式添加功能时，则升级次版本。
- 当进行向后兼容的缺陷修复时，则升级补丁版本。

该约定在所有编程语言中均被采用，每个 `npm` 软件包都必须遵守该约定，这一点非常重要，因为整个系统都依赖于此。



`npm` 设置了一些规则，可用于在 `package.json` 文件中选择要将软件包更新到的版本（当运行 `npm update` 时）。



规则使用的符号如下：

- `^`: 该符号更新次版本之后的内容，不会进行大版本的更新，如`^0.13.0`使用`npm update`可以更新次版本到`0.14.0`或进行补丁更新`0.13.1`



- `~`: 如果写入的是 `〜0.13.0`，则当运行 `npm update` 时，会更新到补丁版本：即 `0.13.1` 可以，但 `0.14.0` 不可以。



- `>`: 接受高于指定版本的任何版本。



- `>=`: 接受等于或高于指定版本的任何版本。



- `<=`: 接受等于或低于指定版本的任何版本。



- `<`: 接受低于指定版本的任何版本。



- `=`: 接受确切的版本。



- `-`: 接受一定范围的版本。例如：`2.1.0 - 2.6.2`。



- `||`: 组合集合。例如 `< 2.1 || > 2.6`。



可以合并其中的一些符号，例如 `1.0.0 || >=1.1.0 <1.2.0`，即使用 1.0.0 或从 1.1.0 开始但低于 1.2.0 的版本。





还有其他的规则：

- 无符号: 仅接受指定的特定版本（例如 `1.2.1`）。
- `latest`: 使用可用的最新版本。



#### 卸载npm包



若要卸载之前在本地安装（在 `node_modules` 文件夹使用 `npm install <package-name>`）的软件包，则从项目的根文件夹（包含 `node_modules` 文件夹的文件夹）中运行：

```bash
npm uninstall <package-name>
```



如果使用 `-S` 或 `--save` 标志，则此操作还会移除 `package.json` 文件中的引用。

```bash
npm uninstall -S <package-name>
```



如果程序包是开发依赖项（列出在 `package.json` 文件的 devDependencies 中），则必须使用 `-D` 或 `--save-dev` 标志从文件中移除：

```bash
npm uninstall -D <package-name>
```



如果该软件包是全局安装的，则需要添加 `-g` 或 `--global` 标志：

```bash
npm uninstall -g <package-name>
```

可以在系统上的任何位置运行此命令，因为当前所在的文件夹无关紧要。





### 当出现全局和本地安装相同包情况

可以是在项目的根目录下使用`npx`命令来调用当前目录的`npm`包，而不会使用全局的包。


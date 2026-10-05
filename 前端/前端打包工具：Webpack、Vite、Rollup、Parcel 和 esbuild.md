---
title: "前端打包工具：Webpack、Vite、Rollup、Parcel 和 esbuild"
source: "https://ata.atatech.org/articles/12020431222?spm=ata.23639746.0.0.84a24884HorMNi#ZjFkYzFj"
author:
published:
created: 2026-04-12
description:
tags:
  - "clippings"
---
数字马力













随着前端技术的不断发展，JavaScript 的打包工具也日益丰富，各具特色。本文将详细介绍几款主流的打包工具，包括 Webpack、 Vite、Rollup、Parcel 和 esbuild ，并分析它们的特点、优势以及适用场景，同时提供相关代码示例。

## 1\. Webpack

### 1.1 特点与优势

Webpack 是 JavaScript 社区中最主流的打包工具之一，其核心设计理念是 "一切皆模块"，通过模块化机制将项目中的资源（JS、CSS、图片、字体等）视为模块进行统一管理。以下是 Webpack 的核心优势：

#### 核心特性

- 模块化打包：支持 ES Module、CommonJS、AMD 等多种模块规范，并通过 loader 处理非 JS 资源（如 CSS、图片等）。

- 插件系统：通过 plugin 实现代码压缩、环境变量注入、热更新（HMR）、代码分割等高级功能。

- 开发体验优化：内置 dev server 支持热更新、Source Map 调试，提供开发环境快速迭代能力。

- 生产环境优化：支持 Tree Shaking、Code Splitting、懒加载等特性，优化最终打包体积和运行性能。

![[ff6b62e5-2912-4b7d-b247-018bf14c4865.jpeg]]

### 1.2 配置与使用

Webpack 的核心是通过配置文件进行管理，以下是一个基本的 Webpack 配置示例：

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  // 入口文件配置
  entry: './src/app.js',
  // 输出配置
  output: {
    filename: 'bundle.js', // 打包后的文件名
    path: path.resolve(__dirname, 'dist'), // 输出目录（绝对路径）
    publicPath: '/', // 资源访问路径
  },
  // 模式配置（development/production）
  mode: 'development',
  // 模块规则配置
  module: {
    rules: [
      {
        test: /\.js$/, // 匹配 JS 文件
        exclude: /node_modules/, // 排除 node_modules
        use: {
          loader: 'babel-loader', // 使用 Babel 转换 ES6/JSX
        },
      },
      {
        test: /\.css$/, // 匹配 CSS 文件
        use: ['style-loader', 'css-loader'], // 处理 CSS 的 loader 链
      },
    ],
  },
  // 开发服务器配置
  devServer: {
    contentBase: path.join(__dirname, 'dist'), // 静态资源目录
    compress: true, // 启用 gzip 压缩
    port: 9000, // 服务端口
    hot: true, // 启用 HMR 热更新
    open: true, // 自动打开浏览器
    watchContentBase: true, // 监听静态资源变化
    proxy: {
      // 设置代理（开发环境常用）
      '/api': 'http://localhost:3000'
    },
    devMiddleware: {
      publicPath: '/', // 与 output.publicPath 保持一致
    },
    staticOptions: {
      dotfiles: 'ignore', // 忽略 .dot 文件
    }
  },
  // 优化配置
  optimization: {
    splitChunks: {
      chunks: 'all', // 所有类型 chunk 都进行分割
      minSize: 20000, // 最小分割大小
      maxSize: 0, // 最大分割大小
      minChunks: 1, // 最小引用次数
      maxAsyncRequests: 30, // 最大异步请求数
      maxInitialRequests: 5, // 最大初始请求数
      automaticNameDelimiter: '~', // 分割文件名连接符
      name: true, // 使用模块名称生成文件名
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/, // 抽离 node_modules 模块
          priority: -10, // 优先级
          filename: 'vendors.js' // 输出文件名
        },
        default: {
          minChunks: 2, // 最小引用次数
          priority: -20, // 优先级
          reuseExistingChunk: true, // 复用已存在的 chunk
          filename: 'common.js' // 输出文件名
        }
      }
    }
  },
  // 缓存配置
  cache: {
    type: 'filesystem', // 使用文件系统缓存
    buildDependencies: {
      config: [__filename], // 依赖的配置文件
    },
  },
  // 解析配置
  resolve: {
    extensions: ['.js', '.json', '.wasm'], // 自动解析后缀
    modules: [path.resolve(__dirname, 'src'), 'node_modules'], // 模块查找路径
    alias: {
      '@': path.resolve(__dirname, 'src'), // 设置路径别名
    }
  },
  // 性能提示
  performance: {
    hints: 'warning', // 性能警告级别
    maxAssetSize: 250000, // 单个资源最大体积
    maxEntrypointSize: 500000, // 入口点最大体积
    assetFilter: function(assetFilename) {
      return assetFilename.endsWith('.js') || assetFilename.endsWith('.css');
    }
  }
}; 执行打包命令： webpack --config webpack.config.js 1.3 支持的功能 Hot Module Replacement (HMR): HMR 允许在开发过程中更新模块而无需完全重新加载页面。这极大地提高了开发效率，因为你可以立即看到代码更改的结果，而不会中断你的工作流程。 实现原理: Webpack 通过在浏览器中创建一个 WebSocket 连接来实现 HMR。当代码发生更改时，Webpack 会构建更新的模块，并将这些模块通过 WebSocket 发送到浏览器。浏览器接收这些更新的模块后，会使用这些模块替换旧的模块，而不会重新加载整个页面。这需要浏览器端和 Webpack 开发服务器端的协同工作，通常需要安装 webpack-dev-server 并配置相应的选项。 示例: 在 webpack.config.js 中配置 devServer 部分： module.exports = {
  // ... other configurations ...
  devServer: {
    hot: true, // Enable HMR
    // ... other devServer options ...
  },
```

然后在你的代码中，你可以使用 module.hot.accept() 来监听模块变化并处理更新： if (module.hot) {

```javascript
  module.hot.accept('./other-module.js', () => {
    // other-module.js 模块更新后执行的代码
    console.log('other-module.js updated!');
    //重新渲染或者更新相关组件
  });
} Code Splitting 将代码拆分成多个较小的块，按需加载。这减少了初始加载时间，并提高了应用性能，尤其是在大型应用中。 实现原理: Webpack 提供了多种代码分割的方法，例如：import() 动态导入、require.ensure() (已过时，建议使用 import())、以及通过 optimization.splitChunks 配置进行自动代码分割。动态导入允许你根据需要加载模块，而不会在初始加载时加载所有代码。 示例: 使用动态导入： // 异步加载组件

```

filename: 'bundle.js', // 打包后的文件名

path: path.resolve(__dirname, 'dist'), // 输出目录（绝对路径）

publicPath: '/', // 资源访问路径

```java
},
// 模式配置（development/production）
mode: 'development',
// 模块规则配置
module: {
```

rules: [

{

test: /\\.js$/, // 匹配 JS 文件

exclude: /node_modules/, // 排除 node_modules

use: {

loader: 'babel-loader', // 使用 Babel 转换 ES6/JSX

```java
},

},

{
```

test: /\\.css$/, // 匹配 CSS 文件

use: ['style-loader', 'css-loader'], // 处理 CSS 的 loader 链

},

],

```java
},

// 开发服务器配置

devServer: {
```

contentBase: path.join(__dirname, 'dist'), // 静态资源目录

compress: true, // 启用 gzip 压缩

port: 9000, // 服务端口

hot: true, // 启用 HMR 热更新

执行打包命令：

webpack --config webpack.config.js

### 1.3 支持的功能

#### Hot Module Replacement (HMR):

- HMR 允许在开发过程中更新模块而无需完全重新加载页面。这极大地提高了开发效率，因为你可以立即看到代码更改的结果，而不会中断你的工作流程。

- 实现原理: Webpack 通过在浏览器中创建一个 WebSocket 连接来实现 HMR。当代码发生更改时，Webpack 会构建更新的模块，并将这些模块通过 WebSocket 发送到浏览器。浏览器接收这些更新的模块后，会使用这些模块替换旧的模块，而不会重新加载整个页面。这需要浏览器端和 Webpack 开发服务器端的协同工作，通常需要安装 `webpack-dev-server` 并配置相应的选项。

- 示例: 在 `webpack.config.js` 中配置 `devServer` 部分：

```javascript
module.exports = {
  // 入口文件配置
  entry: './src/app.js',
  // 输出配置
  output: {
    filename: 'bundle.js', // 打包后的文件名
    path: path.resolve(__dirname, 'dist'), // 输出目录（绝对路径）
    publicPath: '/', // 资源访问路径
  },
  // 模式配置（development/production）
  mode: 'development',
  // 模块规则配置
  module: {
    rules: [
      {
        test: /\.js$/, // 匹配 JS 文件
        exclude: /node_modules/, // 排除 node_modules
        use: {
          loader: 'babel-loader', // 使用 Babel 转换 ES6/JSX
        },
      },
      {
        test: /\.css$/, // 匹配 CSS 文件
        use: ['style-loader', 'css-loader'], // 处理 CSS 的 loader 链
      },
    ],
  },
  // 开发服务器配置
  devServer: {
    contentBase: path.join(__dirname, 'dist'), // 静态资源目录
    compress: true, // 启用 gzip 压缩
    port: 9000, // 服务端口
    hot: true, // 启用 HMR 热更新
    open: true, // 自动打开浏览器
    watchContentBase: true, // 监听静态资源变化
    proxy: {
      // 设置代理（开发环境常用）
      '/api': 'http://localhost:3000'
    },
    devMiddleware: {
      publicPath: '/', // 与 output.publicPath 保持一致
    },
    staticOptions: {
      dotfiles: 'ignore', // 忽略 .dot 文件
    }
  },
  // 优化配置
  optimization: {
    splitChunks: {
      chunks: 'all', // 所有类型 chunk 都进行分割
      minSize: 20000, // 最小分割大小
      maxSize: 0, // 最大分割大小
      minChunks: 1, // 最小引用次数
      maxAsyncRequests: 30, // 最大异步请求数
      maxInitialRequests: 5, // 最大初始请求数
      automaticNameDelimiter: '~', // 分割文件名连接符
      name: true, // 使用模块名称生成文件名
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/, // 抽离 node_modules 模块
          priority: -10, // 优先级
          filename: 'vendors.js' // 输出文件名
        },
        default: {
          minChunks: 2, // 最小引用次数
          priority: -20, // 优先级
          reuseExistingChunk: true, // 复用已存在的 chunk
          filename: 'common.js' // 输出文件名
        }
      }
    }
  },
  // 缓存配置
  cache: {
    type: 'filesystem', // 使用文件系统缓存
    buildDependencies: {
      config: [__filename], // 依赖的配置文件
    },
  },
  // 解析配置
  resolve: {
    extensions: ['.js', '.json', '.wasm'], // 自动解析后缀
    modules: [path.resolve(__dirname, 'src'), 'node_modules'], // 模块查找路径
    alias: {
      '@': path.resolve(__dirname, 'src'), // 设置路径别名
    }
  },
  // 性能提示
  performance: {
    hints: 'warning', // 性能警告级别
    maxAssetSize: 250000, // 单个资源最大体积
    maxEntrypointSize: 500000, // 入口点最大体积
    assetFilter: function(assetFilename) {
      return assetFilename.endsWith('.js') || assetFilename.endsWith('.css');
    }
  }
}; 执行打包命令： webpack --config webpack.config.js 1.3 支持的功能 Hot Module Replacement (HMR): HMR 允许在开发过程中更新模块而无需完全重新加载页面。这极大地提高了开发效率，因为你可以立即看到代码更改的结果，而不会中断你的工作流程。 实现原理: Webpack 通过在浏览器中创建一个 WebSocket 连接来实现 HMR。当代码发生更改时，Webpack 会构建更新的模块，并将这些模块通过 WebSocket 发送到浏览器。浏览器接收这些更新的模块后，会使用这些模块替换旧的模块，而不会重新加载整个页面。这需要浏览器端和 Webpack 开发服务器端的协同工作，通常需要安装 webpack-dev-server 并配置相应的选项。 示例: 在 webpack.config.js 中配置 devServer 部分： module.exports = {
  // ... other configurations ...
  devServer: {
    hot: true, // Enable HMR
    // ... other devServer options ...
  },
```

然后在你的代码中，你可以使用 module.hot.accept() 来监听模块变化并处理更新： if (module.hot) {

```javascript
  module.hot.accept('./other-module.js', () => {
    // other-module.js 模块更新后执行的代码
    console.log('other-module.js updated!');
    //重新渲染或者更新相关组件
  });
} Code Splitting 将代码拆分成多个较小的块，按需加载。这减少了初始加载时间，并提高了应用性能，尤其是在大型应用中。 实现原理: Webpack 提供了多种代码分割的方法，例如：import() 动态导入、require.ensure() (已过时，建议使用 import())、以及通过 optimization.splitChunks 配置进行自动代码分割。动态导入允许你根据需要加载模块，而不会在初始加载时加载所有代码。 示例: 使用动态导入： // 异步加载组件

```

hot: true, // Enable HMR

```java
//... other devServer options...

},

};
```

然后在你的代码中，你可以使用 `module.hot.accept()` 来监听模块变化并处理更新：

```javascript
if (module.hot) {
    module.hot.accept('./other-module.js', () => {
        // other-module.js 模块更新后执行的代码
        console.log('other-module.js updated!');
        //重新渲染或者更新相关组件
    });
}
```

#### Code Splitting

- 将代码拆分成多个较小的块，按需加载。这减少了初始加载时间，并提高了应用性能，尤其是在大型应用中。

- 实现原理: Webpack 提供了多种代码分割的方法，例如： `import()` 动态导入、 `require.ensure()` (已过时，建议使用 `import()`)、以及通过 `optimization.splitChunks` 配置进行自动代码分割。动态导入允许你根据需要加载模块，而不会在初始加载时加载所有代码。

- 示例: 使用动态导入：

```javascript
// 异步加载组件
const getComponent = () => import('./MyComponent');
const button = document.createElement('button');
button.addEventListener('click', async () => {
    const { default: MyComponent } = await getComponent();
    // 使用加载的组件
    render(<MyComponent />, document.getElementById('root'));
});
document.body.appendChild(button);
```

`optimization.splitChunks` 配置可以根据公共模块自动进行代码分割，优化代码包的大小

```javascript
module.exports = {
  // 入口文件配置
  entry: './src/app.js',
  // 输出配置
  output: {
    filename: 'bundle.js', // 打包后的文件名
    path: path.resolve(__dirname, 'dist'), // 输出目录（绝对路径）
    publicPath: '/', // 资源访问路径
  },
  // 模式配置（development/production）
  mode: 'development',
  // 模块规则配置
  module: {
    rules: [
      {
        test: /\.js$/, // 匹配 JS 文件
        exclude: /node_modules/, // 排除 node_modules
        use: {
          loader: 'babel-loader', // 使用 Babel 转换 ES6/JSX
        },
      },
      {
        test: /\.css$/, // 匹配 CSS 文件
        use: ['style-loader', 'css-loader'], // 处理 CSS 的 loader 链
      },
    ],
  },
  // 开发服务器配置
  devServer: {
    contentBase: path.join(__dirname, 'dist'), // 静态资源目录
    compress: true, // 启用 gzip 压缩
    port: 9000, // 服务端口
    hot: true, // 启用 HMR 热更新
    open: true, // 自动打开浏览器
    watchContentBase: true, // 监听静态资源变化
    proxy: {
      // 设置代理（开发环境常用）
      '/api': 'http://localhost:3000'
    },
    devMiddleware: {
      publicPath: '/', // 与 output.publicPath 保持一致
    },
    staticOptions: {
      dotfiles: 'ignore', // 忽略 .dot 文件
    }
  },
  // 优化配置
  optimization: {
    splitChunks: {
      chunks: 'all', // 所有类型 chunk 都进行分割
      minSize: 20000, // 最小分割大小
      maxSize: 0, // 最大分割大小
      minChunks: 1, // 最小引用次数
      maxAsyncRequests: 30, // 最大异步请求数
      maxInitialRequests: 5, // 最大初始请求数
      automaticNameDelimiter: '~', // 分割文件名连接符
      name: true, // 使用模块名称生成文件名
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/, // 抽离 node_modules 模块
          priority: -10, // 优先级
          filename: 'vendors.js' // 输出文件名
        },
        default: {
          minChunks: 2, // 最小引用次数
          priority: -20, // 优先级
          reuseExistingChunk: true, // 复用已存在的 chunk
          filename: 'common.js' // 输出文件名
        }
      }
    }
  },
  // 缓存配置
  cache: {
    type: 'filesystem', // 使用文件系统缓存
    buildDependencies: {
      config: [__filename], // 依赖的配置文件
    },
  },
  // 解析配置
  resolve: {
    extensions: ['.js', '.json', '.wasm'], // 自动解析后缀
    modules: [path.resolve(__dirname, 'src'), 'node_modules'], // 模块查找路径
    alias: {
      '@': path.resolve(__dirname, 'src'), // 设置路径别名
    }
  },
  // 性能提示
  performance: {
    hints: 'warning', // 性能警告级别
    maxAssetSize: 250000, // 单个资源最大体积
    maxEntrypointSize: 500000, // 入口点最大体积
    assetFilter: function(assetFilename) {
      return assetFilename.endsWith('.js') || assetFilename.endsWith('.css');
    }
  }
}; 执行打包命令： webpack --config webpack.config.js 1.3 支持的功能 Hot Module Replacement (HMR): HMR 允许在开发过程中更新模块而无需完全重新加载页面。这极大地提高了开发效率，因为你可以立即看到代码更改的结果，而不会中断你的工作流程。 实现原理: Webpack 通过在浏览器中创建一个 WebSocket 连接来实现 HMR。当代码发生更改时，Webpack 会构建更新的模块，并将这些模块通过 WebSocket 发送到浏览器。浏览器接收这些更新的模块后，会使用这些模块替换旧的模块，而不会重新加载整个页面。这需要浏览器端和 Webpack 开发服务器端的协同工作，通常需要安装 webpack-dev-server 并配置相应的选项。 示例: 在 webpack.config.js 中配置 devServer 部分： module.exports = {
  // ... other configurations ...
  devServer: {
    hot: true, // Enable HMR
    // ... other devServer options ...
  },
```

然后在你的代码中，你可以使用 module.hot.accept() 来监听模块变化并处理更新： if (module.hot) {

```javascript
  module.hot.accept('./other-module.js', () => {
    // other-module.js 模块更新后执行的代码
    console.log('other-module.js updated!');
    //重新渲染或者更新相关组件
  });
} Code Splitting 将代码拆分成多个较小的块，按需加载。这减少了初始加载时间，并提高了应用性能，尤其是在大型应用中。 实现原理: Webpack 提供了多种代码分割的方法，例如：import() 动态导入、require.ensure() (已过时，建议使用 import())、以及通过 optimization.splitChunks 配置进行自动代码分割。动态导入允许你根据需要加载模块，而不会在初始加载时加载所有代码。 示例: 使用动态导入： // 异步加载组件

```

chunks: 'all', // 针对所有类型chunks进行优化

minSize: 0, // 即使很小的模块也分割

cacheGroups: {

vendors: {

test: /[\\\\/]node_modules[\\\\/]/, // 抽取第三方模块

name: 'vendors',

chunks: 'all'

```java
}
}
}
}
};
```

#### Tree Shaking

- 移除未使用的代码。Webpack 可以静态分析你的代码，并移除未导入或未使用的模块和代码。

- 实现原理: Tree Shaking 主要依赖于 ES Modules (ESM) 的静态导入特性。Webpack 通过分析代码的依赖关系，确定哪些模块是必需的，哪些模块是未使用的，然后移除未使用的模块。这需要你的代码使用 ES Modules 语法，并且使用 `mode: 'production'` 进行生产环境构建。

- 示例: 使用 ES Modules 导入：

```javascript
// 只导入需要的函数
import { add } from 'math-utils';
// 未使用的函数不会被打包
import { subtract } from 'math-utils'; // 不会被包含在最终打包文件中，前提是使用production模式编译
```

#### Asset Management: 资源管理

- Webpack 可以处理各种类型的静态资源，例如图片、字体、CSS 文件等。它可以优化这些资源，例如压缩图片、压缩 CSS 文件等。

- 实现原理: Webpack 使用 Loader 来处理各种类型的静态资源。Loader 是一种插件，它可以处理各种类型的文件，并将它们转换为 Webpack 可以理解的模块。例如， `file-loader` 可以处理图片文件， `css-loader` 和 `style-loader` 可以处理 CSS 文件。

- 示例: 使用 `url-loader` 处理图片：

module.exports = {

module: {

rules: [

{

test: /\\.(png|svg|jpg|jpeg|gif)$/i,

type: 'asset/resource', // 将图片作为资源打包

},

],

},

};

### 1.4 Loader与Plugin

Webpack 的强大之处在于其灵活的插件（Plugin）和加载器（Loader）系统，它们允许你自定义和扩展 Webpack 的功能，以处理各种类型的文件和执行各种任务。

#### Loader (加载器):

- 作用: Loader 负责处理 Webpack 无法直接处理的文件类型。例如，Webpack 本身只能理解 JavaScript 模块，但你可能需要处理 CSS、图片、字体等文件。Loader 将这些文件转换成 Webpack 可以理解的模块，通常是 JavaScript 模块。 它们在打包 之前 处理文件。

- 工作原理: Loader 按照配置的顺序链式执行。 一个文件可以经过多个 Loader 的处理，最终转换成 Webpack 可以处理的模块。 每个 Loader 都接收输入，进行处理，然后输出结果传递给下一个 Loader。

- 类型: Loader 类型繁多，根据功能可以大致分为：

- 模块加载器 (Module Loaders): 这是最常见的类型，用于处理各种类型的文件，例如：

- `babel-loader` ：将 ES6+ 代码转换为 ES5 代码。

- `css-loader` ：将 CSS 文件解析为 JavaScript 模块。

- `style-loader` ：将 CSS 代码注入到 HTML 的 `<style>` 标签中。

- `less-loader`, `sass-loader`, `stylus-loader` ：处理各种 CSS 预处理器文件。

- `file-loader`, `url-loader`, `svg-inline-loader` ：处理图片、字体等静态资源文件。

- `ts-loader` ：处理 TypeScript 文件。

- 其他 Loader: 一些 Loader 并不直接处理模块，而是执行其他任务，例如：

- 配置: Loader 在 `webpack.config.js` 文件的 `module.exports.module.rules` 中配置，通常是一个数组，每个元素代表一个 Loader 规则：

module.exports = {

module: {

rules: [

{

test: /\\.css$/i, // 正则表达式匹配.css 文件

use: ['style-loader', 'css-loader'], // 使用 style-loader 和 css-loader

```java
},

{

    test: /\\.(png|svg|jpg|jpeg|gif)$/i,
```

type: 'asset/resource', // 使用 asset/resource 模块类型处理图片

```java
},

{

    test: /\\.js$/,
```

exclude: /node_modules/, // 排除 node_modules 目录

```java
use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
```

presets: ['@babel/preset-env']

```java
}

}

}
```

],

},

};

#### Plugin (插件):

- 作用: Plugin 扩展了 Webpack 的功能，它们可以执行更广泛的任务，例如：优化、压缩、代码分割、环境变量替换等。 它们在整个构建 过程 的不同阶段执行操作。

- 工作原理: Plugin 通过在 Webpack 构建生命周期的不同点（钩子）上注册函数来工作。 这些钩子允许插件在构建的不同阶段进行干预和操作。 例如，可以在构建开始时添加一些环境变量，或者在构建完成时生成 HTML 文件。

- 类型: Plugin 的种类非常多，涵盖了 Webpack 的几乎所有方面，例如：

- 优化类: `TerserWebpackPlugin` (代码压缩), `webpack.optimize.AggressiveMergingPlugin` (合并模块)

- 代码分割类: `SplitChunksPlugin` (代码分割), `ImportModulesPlugin` (异步加载模块)

- 环境变量类: `DefinePlugin` (定义环境变量)

- HTML生成类: `HtmlWebpackPlugin` (生成 HTML 文件，并自动插入打包后的 JS 文件)

- 资源处理类: `CopyWebpackPlugin` (复制文件)

- 分析类: `BundleAnalyzerPlugin` (打包文件分析)

- 配置: Plugin 在 `webpack.config.js` 文件的 `plugins` 数组中配置，每个元素是一个 Plugin 的实例：

```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin'); // 引入插件
const path = require('path');
module.exports = {
    //... other configurations...
```

plugins: [

new HtmlWebpackPlugin({

template: './src/index.html', // 模板文件

filename: './index.html' // 输出文件

}),

//... other plugins...

],

output: {

path: path.resolve(__dirname, 'dist'),

filename: '[name].bundle.js'

}

};

Loader 和 Plugin 的区别总结:


| 特性   | Loader         | Plugin                  |
| ---- | -------------- | ----------------------- |
| 作用   | 处理单个文件         | 扩展 Webpack 功能，作用于整个构建流程 |
| 执行时机 | 构建前，对模块进行转换    | 构建过程中，在不同阶段执行           |
| 配置方式 | `module.rules` | `plugins`               |
| 使用方式 | 针对特定文件类型       | 针对整个构建过程或特定任务           |
| 返回值  | 转换后的文件内容       | 无特定返回值，通过钩子函数操作Webpack  |


总而言之，Loader 和 Plugin 是 Webpack 的核心组成部分，它们协同工作，使 Webpack 能够处理各种复杂的构建任务。 通过恰当的 Loader 和 Plugin 组合，你可以构建出高效、灵活的 Web 应用。

## 2\. Vite

### 2.1 特点与优势

Vite 是新一代前端构建工具，其核心设计理念是 "极致开发体验 + 生产环境优化"。它结合了 esbuild 的极速编译能力 和 Rollup 的生产构建优化，为开发者提供了革命性的开发体验。

#### 核心特性：

1. 开发启动速度快

- 使用 esbuild 的原生 JavaScript 解析能力，冷启动速度比 Webpack 快 10-100 倍

- 开发服务器启动时间 < 1 秒（空项目）

- 支持多核 CPU 并行编译

2. 原生 ES Module 开发体验

- 直接利用浏览器原生 ESM 支持，无需打包即可运行

- 支持 Vue/React/Vue3/Svelte 等框架的原生开发体验

- 实时热更新（HMR）速度提升 50%+

3. 零配置开箱即用

- 默认支持 TypeScript、CSS 预处理器、JSX、Vue 单文件组件

- 内置开发服务器、热更新、模块热替换等核心功能

4. 智能生产构建

- 生产环境使用 Rollup 进行代码优化

- 自动代码分割、Tree Shaking、Tree Shaking

- 支持 Code Splitting 和懒加载优化

#### 执行流程

![[f66170d6-6edc-4573-979f-a106c71ac689.jpeg]] ![[a15702a3-02be-4c17-9ce1-6b5c3c78ab72.jpeg]]

### 2.2 项目创建与配置

#### 创建项目

\# 使用 npm 创建新项目

npm init vite@latest my-project --template vue

cd my-project

npm install

#### 项目结构

my-project/

├── index.html # 入口 HTML

├── package.json # 项目配置

├── public/ # 静态资源

├── src/

│ ├── main.js # 入口 JS

│ └── App.vue # Vue 组件

├── vite.config.js # Vite 配置

└──.env # 环境变量

#### 配置文件

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
```

plugins: [vue()], // 插件系统

server: {

port: 3000, // 自定义端口

open: true, // 启动时自动打开浏览器

proxy: { // 代理配置

'/api': 'http://localhost:4000'

```java
}

},

build: {
```

outDir: 'dist', // 输出目录

assetsDir: 'assets', // 静态资源目录

```java
rollupOptions: { // Rollup 配置
    output: {
        manualChunks(id) {
            if (id.includes('node_modules')) {
                return id.toString().split('node_modules/')[1].split('/')[0];
            }
        }
    }
}
}
});
```

### 2.3 开发与构建流程

#### 开发服务器

npm run dev

- 自动开启开发服务器（默认端口 3000）

- 支持热模块替换（HMR）

- 实时编译 TypeScript/Vue 单文件组件

- 内置模块热更新性能监控

#### 生产构建

npm run build

- 使用 Rollup 进行生产环境优化

- 输出到 `dist/` 目录

- 自动添加资源哈希防止缓存

- 支持 Tree Shaking 和代码压缩

#### 构建优化配置

export default defineConfig({

build: {

minify: 'terser', // 使用 Terser 压缩

terserOptions: {

compress: {

drop_console: true, // 移除 console

drop_debugger: true // 移除 debugger

}

},

chunkSizeWarningLimit: 1000, // 警告大 chunk 阈值

```java
rollupOptions: { // Rollup 配置
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return id.toString().split('node_modules/')[1].split('/')[0];
          }
        }
      }
    }
```

vendor: ['vue', 'lodash'], // 手动拆分 vendor

utils: ['src/utils/**'] // 拆分 utils 模块

```java
}
}
}
}
});
```

### 2.4 ES6 模块加载机制

#### 开发模式工作原理

1. 浏览器原生 ESM 加载

2. 按需加载依赖模块

3. 实时热更新机制

```javascript
// src/main.js
import { createApp } from 'vue';
import App from './App.vue';
createApp(App).mount('#app');
```

#### 生产模式优化

- 自动将 ESM 转换为 UMD/CJS

- 使用 Rollup 进行 Tree Shaking

- 代码分割优化

### 2.5 插件系统

#### 常用插件

npm install -D @vitejs/plugin-vue @vitejs/plugin-react

```javascript
// vite.config.js
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';
export default defineConfig({
```

plugins: [

vue(), // Vue 支持

react(), // React 支持

{

name: 'custom-plugin', // 自定义插件

```javascript
transform(code, id) {
    if (id.endsWith('.txt')) {
        return \`export default ${JSON.stringify(code)}\`;
    }
}
}
```

]

});

#### 插件 API

```javascript
export default function myPlugin() {
    return {
        name: 'my-plugin',
        transform(code, id) {
            // 代码转换
        },
        resolveId(id, importer) {
            // 解析模块 ID
        },
        load(id) {
            // 加载模块
        },
        generateBundle() {
            // 生成资源
        }
    };
}
```

## 3\. Rollup

### 3.1 特点与优势

Rollup 是一个专注于 JavaScript 打包的工具，特别适合于打包库和框架。相较于 Webpack，Rollup 生成的打包文件更精简，代码附加量少，且具备优秀的 tree shaking 特性。

![[c75fecd9-f5b6-4a73-8202-9962a57d7e5a.jpeg]]

### 3.2 配置与使用

Rollup 通过简单的配置文件 `rollup.config.js` 操作，以下是一个基础的配置示例：

```javascript
// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
export default {
    input: 'src/app.js',
    output: {
        file: 'dist/bundle.js',
format: 'iife', // 输出格式
},
```
plugins: [resolve(), commonjs()], // 支持 CommonJS 模块

};

执行打包命令：

rollup -c

### 3.3 Tree Shaking 示例

Rollup 的 tree shaking 功能基于 ES6 模块的静态分析能力，能够在打包时识别并剔除未引用的模块。

```javascript
// util.js
export function add(a, b) {
    return a + b;
}
export function sub(a, b) {
    return a - b; // 未使用
}
// app.js
import { add } from './util';
console.log(\`2 + 3 = ${add(2, 3)}\`);
```

最终的打包结果将不会包含没有使用的 `sub` 函数。

### 3.4 支持多种模块格式

Rollup 允许开发者通过配置 `output.format` 输出不同的模块形式，包括 CommonJS、ESM、UMD 等，极大地提高了库的兼容性。

## 4\. Parcel

### 4.1 特点与优势

Parcel 是一个较新的打包工具，以其零配置和较高的打包速度受到开发者喜爱。Parcel 利用多线程和文件系统缓存来提高打包效率。

![[1edc1283-7ca9-416c-b818-64d946b104f0.jpeg]]

### 4.2 零配置使用示例

只需创建 HTML 文件作为入口：

<!-- index.html -->

```java
<html>
<body>
<script src="./index.js"></script>
</body>
</html>
```

执行打包命令：

parcel index.html

Parcel 自动处理依赖关系，并在 `dist` 目录生成打包输出。

### 4.3 CSS 和图片处理示例

Parcel 支持直接引入 CSS 和图片资源。

```javascript
// index.js
import './styles.css'; // 引入 CSS 文件
import logo from './logo.png'; // 引入图片
const img = document.createElement('img');
img.src = logo;
document.body.appendChild(img);
document.write('Hello, Parcel!');
```

### 4.4 打包速度

Parcel 的打包速度比 Webpack 快约8倍，主要得益于其创新的资源处理流程，边编译边缓存，极大减少了重复的 AST 解析工作。

## 5\. esbuild

### 5.1 特点与优势

esbuild 是一个基于 Go 语言开发的打包工具，声称其速度比 Rollup 和 Webpack 快10到100倍，特别适合需要高性能编译的项目。

![[f905a751-a198-4605-b432-80a5aa847770.jpeg]]

### 5.2 打包速度示例

使用 esbuild 打包的基本命令如下：

\# 安装 esbuild

npm install --save-dev esbuild

\# 打包命令

npx esbuild src/app.js --bundle --outfile=dist/bundle.js

### 5.3 支持 TypeScript 和 JSX

esbuild 支持 TypeScript 和 JSX 语法，无需额外配置。

```javascript
// src/app.tsx
const App = () => {
    return <h1>Hello, esbuild!</h1>;
};
// 入口文件
import React from 'react';
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));
```

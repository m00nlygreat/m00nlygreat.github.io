const path = require("path");


// process.env.NODE_ENV = 'production';
// 프로덕션에서는 이 코드를 넣어주고 아래 mode: 역시 'production'으로 바꿔준다.

module.exports = {
  name: "react-webgame",
  mode: "development",
  devtool: "eval",

  resolve: {
      extensions: ['.js', '.jsx'],
  },

  entry: {
    app: ['./client'],
  },

  module: {
      rules: [{
          test: /\.jsx?/,
          loader: 'babel-loader',
          options: {
              presets: [['@babel/preset-env', {
                targets: {
                  browsers: ['> 1% in KR'],
                },
              }], '@babel/preset-react'],
              plugins: [
                '@babel/plugin-proposal-class-properties',
            ],
          }
      }]

  },
  
  output: {
    path: path.join(__dirname, "dist"),
    filename: "app.js",
  },

  devServer: {
    publicPath: '/dist/',
    hot: true,
  },

};

// client.js와 WordRelay.jsx 를 합쳐서 ./dist/app.js로 합쳐줌.
// WordRelay.jsx는 client.jsx가 이미 require 하고 있으므로, webpack이 알아서 합쳐준다.

// resolve, extensions:: entry에 확장자 생략.
// dist directory는 예제를 복잡하게 하기 위한 것. __dirname은 현재 디렉토리
// mode: 'development'는 실 서비스에서는 production으로 변경.

// @babel/core
// @babel/preset-env 환경에 맞게 알아서 바꿔줌 (브라우저 버전 등.)
// preset은 plugin 들의 모음. preset만의 설정에 접근하려면, preset-env를 배열로 감싸고, 2번째 배열요소에 객체로 설정 첨부.
  // https://github.com/browserslist/browserslist
  // browsers list는 바벨의 플러그인으로, 자연어 형태의 버전 프리셋을 제공하여, 대응 브라우저 버전을 편하게 설정할 수 있다.
  // plugins, rules 등이 너무 많아서 뭔지 모르겠다면, 최대한 제거하고 에러메시지를 탐색해가면서 하나씩 추가해본다.

// @babel/preset-react JSX 사용을 가능케해줌.
// babel-loader 웹팩과 바벨을 연결해줌.

// @babel/plugin-proposal-class-properties 뭔진 모르겠지만 에러 떠서 추가.

// 핫 리로드 react-refresh, webpack dev server 설치법
// 1. webpack-dev-server / react-refresh / @pmmmwh/react-refresh-webpack-plugin NPM에서 설치
// 2. package.json의 scripts의 명령어를 'webpack server --env development' 로 변경
// 3. webpack.config.js 에 '@pmmmwh/react-refresh-webpack-plugin' require하고, plugins 아래에 new ㅇㅇㅇ() 선언
// 4. babel-loader plugins에 react-refresh/babel 추가
// 5. dev server설정 devServer 아래에 publicPath, hot properties 추가
// webpack dev server가 기본적으로 reload를 지원
// react-refresh / react-refresh-webpack-plugin이 핫 리로딩을 지원

// output의 path는 실제 경로, publicPath는 가상 경로이다? Node.js의 아래 코드와 비슷한 관계
// app.use('/dist', express.static(__dirname, 'dist');
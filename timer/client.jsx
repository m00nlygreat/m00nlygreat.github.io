const React = require("react");
const ReactDom = require("react-dom");
import Timer from './Timer'


ReactDom.render(<Timer minutes="30"/>, document.querySelector("#root"));

// JSX 문법을 쓰고 싶으면 jsx 확장자로
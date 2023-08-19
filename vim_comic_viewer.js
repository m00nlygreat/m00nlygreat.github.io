// ==UserScript==
// @name           vim comic viewer
// @name:ko        vim comic viewer
// @description    Universal comic reader
// @description:ko 만화 뷰어 라이브러리
// @version        9.0.0
// @namespace      https://greasyfork.org/en/users/713014-nanikit
// @exclude        *
// @match          http://unused-field.space/
// @author         nanikit
// @license        MIT
// @resource       @stitches/react  https://cdn.jsdelivr.net/npm/@stitches/react@1.2.8/dist/index.cjs
// @resource       fflate           https://cdn.jsdelivr.net/npm/fflate@0.7.4/lib/browser.cjs
// @resource       object-assign    https://cdn.jsdelivr.net/npm/object-assign@4.1.1/index.js
// @resource       react            https://cdn.jsdelivr.net/npm/react@18.2.0/cjs/react.production.min.js
// @resource       react-dom        https://cdn.jsdelivr.net/npm/react-dom@18.2.0/cjs/react-dom.production.min.js
// @resource       scheduler        https://cdn.jsdelivr.net/npm/scheduler@0.23.0/cjs/scheduler.production.min.js
// ==/UserScript==
// deno-fmt-ignore-file
// deno-lint-ignore-file


var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var mod_exports = {};
__export(mod_exports, {
  Viewer: () => Viewer,
  download: () => download,
  initialize: () => initialize,
  setTampermonkeyApi: () => setTampermonkeyApi,
  transformToBlobUrl: () => transformToBlobUrl,
  types: () => types_exports,
  utils: () => utils_exports
});
module.exports = __toCommonJS(mod_exports);
var React = __toESM(require("react"));
var deps_exports = {};
__export(deps_exports, {
  Fragment: () => import_react.Fragment,
  createRef: () => import_react.createRef,
  forwardRef: () => import_react.forwardRef,
  useCallback: () => import_react.useCallback,
  useEffect: () => import_react.useEffect,
  useImperativeHandle: () => import_react.useImperativeHandle,
  useMemo: () => import_react.useMemo,
  useReducer: () => import_react.useReducer,
  useRef: () => import_react.useRef,
  useState: () => import_react.useState
});
__reExport(deps_exports, require("@stitches/react"));
__reExport(deps_exports, require("fflate"));
var import_react = require("react");
__reExport(deps_exports, require("react-dom"));
var { styled, css, keyframes } = (0, deps_exports.createStitches)({});
var Svg = styled("svg", {
  opacity: "50%",
  filter: "drop-shadow(0 0 1px white) drop-shadow(0 0 1px white)",
  color: "black",
  cursor: "pointer",
  "&:hover": {
    opacity: "100%",
    transform: "scale(1.1)"
  }
});
var downloadCss = { width: "40px", marginLeft: "20px" };
var fullscreenCss = {
  right: "24px",
  position: "absolute",
  width: "40px",
  bottom: "8px"
};
var DownloadIcon = (props) =>  React.createElement(
  Svg,
  {
    version: "1.1",
    xmlns: "http://www.w3.org/2000/svg",
    x: "0px",
    y: "0px",
    viewBox: "0 -34.51 122.88 122.87",
    css: downloadCss,
    ...props
  },
   React.createElement("g", null,  React.createElement("path", { d: "M58.29,42.08V3.12C58.29,1.4,59.7,0,61.44,0s3.15,1.4,3.15,3.12v38.96L79.1,29.4c1.3-1.14,3.28-1.02,4.43,0.27 s1.03,3.25-0.27,4.39L63.52,51.3c-1.21,1.06-3.01,1.03-4.18-0.02L39.62,34.06c-1.3-1.14-1.42-3.1-0.27-4.39 c1.15-1.28,3.13-1.4,4.43-0.27L58.29,42.08L58.29,42.08L58.29,42.08z M0.09,47.43c-0.43-1.77,0.66-3.55,2.43-3.98 c1.77-0.43,3.55,0.66,3.98,2.43c1.03,4.26,1.76,7.93,2.43,11.3c3.17,15.99,4.87,24.57,27.15,24.57h52.55 c20.82,0,22.51-9.07,25.32-24.09c0.67-3.6,1.4-7.5,2.44-11.78c0.43-1.77,2.21-2.86,3.98-2.43c1.77,0.43,2.85,2.21,2.43,3.98 c-0.98,4.02-1.7,7.88-2.36,11.45c-3.44,18.38-5.51,29.48-31.8,29.48H36.07C8.37,88.36,6.3,77.92,2.44,58.45 C1.71,54.77,0.98,51.08,0.09,47.43L0.09,47.43z" }))
);
var FullscreenIcon = (props) =>  React.createElement(
  Svg,
  {
    version: "1.1",
    xmlns: "http://www.w3.org/2000/svg",
    x: "0px",
    y: "0px",
    viewBox: "0 0 122.88 122.87",
    css: fullscreenCss,
    ...props
  },
   React.createElement("g", null,  React.createElement("path", { d: "M122.88,77.63v41.12c0,2.28-1.85,4.12-4.12,4.12H77.33v-9.62h35.95c0-12.34,0-23.27,0-35.62H122.88L122.88,77.63z M77.39,9.53V0h41.37c2.28,0,4.12,1.85,4.12,4.12v41.18h-9.63V9.53H77.39L77.39,9.53z M9.63,45.24H0V4.12C0,1.85,1.85,0,4.12,0h41 v9.64H9.63V45.24L9.63,45.24z M45.07,113.27v9.6H4.12c-2.28,0-4.12-1.85-4.12-4.13V77.57h9.63v35.71H45.07L45.07,113.27z" }))
);
var ErrorIcon = styled("svg", {
  width: "10vmin",
  height: "10vmin",
  fill: "hsl(0, 50%, 20%)",
  margin: "2rem"
});
var CircledX = (props) => {
  return  React.createElement(
    ErrorIcon,
    {
      version: "1.1",
      id: "Layer_1",
      xmlns: "http://www.w3.org/2000/svg",
      x: "0px",
      y: "0px",
      viewBox: "0 0 122.881 122.88",
      "enable-background": "new 0 0 122.881 122.88",
      ...props
    },
     React.createElement("g", null,  React.createElement("path", { d: "M61.44,0c16.966,0,32.326,6.877,43.445,17.996c11.119,11.118,17.996,26.479,17.996,43.444 c0,16.967-6.877,32.326-17.996,43.444C93.766,116.003,78.406,122.88,61.44,122.88c-16.966,0-32.326-6.877-43.444-17.996 C6.877,93.766,0,78.406,0,61.439c0-16.965,6.877-32.326,17.996-43.444C29.114,6.877,44.474,0,61.44,0L61.44,0z M80.16,37.369 c1.301-1.302,3.412-1.302,4.713,0c1.301,1.301,1.301,3.411,0,4.713L65.512,61.444l19.361,19.362c1.301,1.301,1.301,3.411,0,4.713 c-1.301,1.301-3.412,1.301-4.713,0L60.798,66.157L41.436,85.52c-1.301,1.301-3.412,1.301-4.713,0c-1.301-1.302-1.301-3.412,0-4.713 l19.363-19.362L36.723,42.082c-1.301-1.302-1.301-3.412,0-4.713c1.301-1.302,3.412-1.302,4.713,0l19.363,19.362L80.16,37.369 L80.16,37.369z M100.172,22.708C90.26,12.796,76.566,6.666,61.44,6.666c-15.126,0-28.819,6.13-38.731,16.042 C12.797,32.62,6.666,46.314,6.666,61.439c0,15.126,6.131,28.82,16.042,38.732c9.912,9.911,23.605,16.042,38.731,16.042 c15.126,0,28.82-6.131,38.732-16.042c9.912-9.912,16.043-23.606,16.043-38.732C116.215,46.314,110.084,32.62,100.172,22.708 L100.172,22.708z" }))
  );
};
var MenuIcon = (props) =>  React.createElement(
  Svg,
  {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    width: "40px",
    height: "40px",
    ...props
  },
   React.createElement("path", { d: "M 3 5 A 1.0001 1.0001 0 1 0 3 7 L 21 7 A 1.0001 1.0001 0 1 0 21 5 L 3 5 z M 3 11 A 1.0001 1.0001 0 1 0 3 13 L 21 13 A 1.0001 1.0001 0 1 0 21 11 L 3 11 z M 3 17 A 1.0001 1.0001 0 1 0 3 19 L 21 19 A 1.0001 1.0001 0 1 0 21 17 L 3 17 z" })
);
var defaultScrollbar = {
  "scrollbarWidth": "initial",
  "scrollbarColor": "initial",
  "&::-webkit-scrollbar": { all: "initial" },
  "&::-webkit-scrollbar-thumb": {
    all: "initial",
    background: "#00000088"
  },
  "&::-webkit-scrollbar-track": { all: "initial" }
};
var Container = styled("div", {
  position: "relative",
  height: "100%",
  userSelect: "none"
});
var ScrollableLayout = styled("div", {
  outline: 0,
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexFlow: "row-reverse wrap",
  overflowY: "auto",
  ...defaultScrollbar,
  variants: {
    fullscreen: {
      true: {
        display: "flex",
        position: "fixed",
        top: 0,
        bottom: 0,
        overflow: "auto"
      }
    },
    dark: {
      true: {
        "&::-webkit-scrollbar-thumb": {
          all: "initial",
          background: "#ffffff88"
        }
      }
    }
  }
});
var utils_exports = {};
__export(utils_exports, {
  defer: () => defer,
  getSafeFileName: () => getSafeFileName,
  insertCss: () => insertCss,
  isTyping: () => isTyping,
  save: () => save,
  saveAs: () => saveAs,
  timeout: () => timeout,
  waitDomContent: () => waitDomContent
});
var timeout = (millisecond) => new Promise((resolve) => setTimeout(resolve, millisecond));
var waitDomContent = (document2) => document2.readyState === "loading" ? new Promise(
  (r) => document2.addEventListener("readystatechange", r, { once: true })
) : true;
var insertCss = (css2) => {
  const style = document.createElement("style");
  style.innerHTML = css2;
  document.head.append(style);
};
var isTyping = (event) => {
  var _a, _b, _c, _d;
  return ((_c = (_b = (_a = event.target) == null ? void 0 : _a.tagName) == null ? void 0 : _b.match) == null ? void 0 : _c.call(_b, /INPUT|TEXTAREA/)) || ((_d = event.target) == null ? void 0 : _d.isContentEditable);
};
var saveAs = async (blob, name) => {
  const a = document.createElement("a");
  a.download = name;
  a.rel = "noopener";
  a.href = URL.createObjectURL(blob);
  a.click();
  await timeout(4e4);
  URL.revokeObjectURL(a.href);
};
var getSafeFileName = (str) => {
  return str.replace(/[<>:"/\\|?*\x00-\x1f]+/gi, "").trim() || "download";
};
var save = (blob) => {
  return saveAs(blob, `${getSafeFileName(document.title)}.zip`);
};
var defer = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
var maybeNotHotkey = (event) => event.ctrlKey || event.altKey || event.metaKey || isTyping(event);
var useDefault = ({
  enable,
  controller
}) => {
  const defaultKeyHandler = async (event) => {
    var _a;
    if (maybeNotHotkey(event)) {
      return;
    }
    switch (event.key) {
      case "x":
      case "ArrowDown":
        controller.goNext();
        break;
      case "z":
      case "ArrowUp":
        controller.goPrevious();
        break;
      case ";":
        await ((_a = controller.downloader) == null ? void 0 : _a.downloadWithProgress());
        break;
      case "/":
        controller.compactWidthIndex++;
        break;
      case "?":
        controller.compactWidthIndex--;
        break;
      case "'":
        controller.reloadErrored();
        break;
      default:
        break;
    }
  };
  const defaultGlobalKeyHandler = (event) => {
    if (maybeNotHotkey(event)) {
      return;
    }
    if (["KeyI", "Numpad0", "Enter"].includes(event.code)) {
      controller.toggleFullscreen();
    }
  };
  (0, import_react.useEffect)(() => {
    if (!controller || !enable) {
      return;
    }
    controller.container.addEventListener("keydown", defaultKeyHandler);
    addEventListener("keydown", defaultGlobalKeyHandler);
    return () => {
      controller.container.removeEventListener("keydown", defaultKeyHandler);
      removeEventListener("keydown", defaultGlobalKeyHandler);
    };
  }, [controller, enable]);
};
var useFullscreenElement = () => {
  const [element, setElement] = (0, import_react.useState)(
    document.fullscreenElement || void 0
  );
  (0, import_react.useEffect)(() => {
    const notify = () => setElement(document.fullscreenElement || void 0);
    document.addEventListener("fullscreenchange", notify);
    return () => document.removeEventListener("fullscreenchange", notify);
  }, []);
  return element;
};
var tampermonkeyApi = {};
function setTampermonkeyApi(api) {
  tampermonkeyApi = api != null ? api : {};
}
var gmFetch = (resource, init) => {
  const method = (init == null ? void 0 : init.body) ? "POST" : "GET";
  const xhr = (type) => {
    return new Promise((resolve, reject) => {
      var _a;
      const request = tampermonkeyApi.GM_xmlhttpRequest({
        method,
        url: resource,
        headers: init == null ? void 0 : init.headers,
        responseType: type === "text" ? void 0 : type,
        data: init == null ? void 0 : init.body,
        onload: (response) => {
          if (type === "text") {
            resolve(response.responseText);
          } else {
            resolve(response.response);
          }
        },
        onerror: reject,
        onabort: reject
      });
      (_a = init == null ? void 0 : init.signal) == null ? void 0 : _a.addEventListener(
        "abort",
        () => {
          request.abort();
        },
        { once: true }
      );
    });
  };
  return {
    blob: () => xhr("blob"),
    json: () => xhr("json"),
    text: () => xhr("text")
  };
};
var fetchBlob = async (url, init) => {
  var _a;
  try {
    const response = await fetch(url, init);
    return await response.blob();
  } catch (error) {
    if ((_a = init == null ? void 0 : init.signal) == null ? void 0 : _a.aborted) {
      throw error;
    }
    const isOriginDifferent = new URL(url).origin !== location.origin;
    if (isOriginDifferent && tampermonkeyApi.GM_xmlhttpRequest) {
      return await gmFetch(url, init).blob();
    } else {
      throw new Error("CORS blocked and cannot use GM_xmlhttpRequest", {
        cause: error
      });
    }
  }
};
var imageSourceToIterable = (source) => {
  if (typeof source === "string") {
    return async function* () {
      yield source;
    }();
  } else if (Array.isArray(source)) {
    return async function* () {
      for (const url of source) {
        yield url;
      }
    }();
  } else {
    return source();
  }
};
var transformToBlobUrl = (source) => async () => {
  const imageSources = await source();
  return imageSources.map(
    (imageSource) => async function* () {
      for await (const url of imageSourceToIterable(imageSource)) {
        try {
          const blob = await fetchBlob(url);
          yield URL.createObjectURL(blob);
        } catch (error) {
          console.log(error);
        }
      }
    }
  );
};
var isGmCancelled = (error) => {
  return error instanceof Function;
};
async function* downloadImage({ source, signal }) {
  for await (const url of imageSourceToIterable(source)) {
    if (signal == null ? void 0 : signal.aborted) {
      break;
    }
    try {
      const blob = await fetchBlob(url, { signal });
      yield { url, blob };
    } catch (error) {
      if (isGmCancelled(error)) {
        yield { error: new Error("download aborted") };
      } else {
        yield { error };
      }
    }
  }
}
var getExtension = (url) => {
  if (!url) {
    return ".txt";
  }
  const extension = url.match(/\.[^/?#]{3,4}?(?=[?#]|$)/);
  return (extension == null ? void 0 : extension[0]) || ".jpg";
};
var guessExtension = (array) => {
  const { 0: a, 1: b, 2: c, 3: d } = array;
  if (a === 255 && b === 216 && c === 255) {
    return ".jpg";
  }
  if (a === 137 && b === 80 && c === 78 && d === 71) {
    return ".png";
  }
  if (a === 82 && b === 73 && c === 70 && d === 70) {
    return ".webp";
  }
  if (a === 71 && b === 73 && c === 70 && d === 56) {
    return ".gif";
  }
};
var download = (images, options) => {
  const { onError, onProgress, signal } = options || {};
  let startedCount = 0;
  let resolvedCount = 0;
  let rejectedCount = 0;
  let hasCancelled = false;
  const reportProgress = ({ isCancelled, isComplete } = {}) => {
    if (hasCancelled) {
      return;
    }
    if (isCancelled) {
      hasCancelled = true;
    }
    const total = images.length;
    const settled = resolvedCount + rejectedCount;
    onProgress == null ? void 0 : onProgress({
      total,
      started: startedCount,
      settled,
      rejected: rejectedCount,
      isCancelled: hasCancelled,
      isComplete
    });
  };
  const downloadWithReport = async (source) => {
    const errors = [];
    startedCount++;
    reportProgress();
    for await (const event of downloadImage({ source, signal })) {
      if ("error" in event) {
        errors.push(event.error);
        onError == null ? void 0 : onError(event.error);
        continue;
      }
      if (event.url) {
        resolvedCount++;
      } else {
        rejectedCount++;
      }
      reportProgress();
      return event;
    }
    return {
      url: "",
      blob: new Blob([errors.map((x) => `${x}`).join("\n\n")])
    };
  };
  const cipher = Math.floor(Math.log10(images.length)) + 1;
  const toPair = async ({ url, blob }, index) => {
    var _a;
    const array = new Uint8Array(await blob.arrayBuffer());
    const pad = `${index}`.padStart(cipher, "0");
    const name = `${pad}${(_a = guessExtension(array)) != null ? _a : getExtension(url)}`;
    return { [name]: array };
  };
  const archiveWithReport = async (sources) => {
    const result = await Promise.all(sources.map(downloadWithReport));
    if (signal == null ? void 0 : signal.aborted) {
      reportProgress({ isCancelled: true });
      throw new Error("aborted");
    }
    const pairs = await Promise.all(result.map(toPair));
    const data = Object.assign({}, ...pairs);
    const value = defer();
    const abort = (0, deps_exports.zip)(data, { level: 0 }, (error, array) => {
      if (error) {
        value.reject(error);
      } else {
        reportProgress({ isComplete: true });
        value.resolve(array);
      }
    });
    signal == null ? void 0 : signal.addEventListener("abort", abort, { once: true });
    return value.promise;
  };
  return archiveWithReport(images);
};
var useRerender = () => {
  const [, rerender] = (0, import_react.useReducer)(() => ({}), {});
  return rerender;
};
var isNotAbort = (error) => !/aborted/i.test(`${error}`);
var logIfNotAborted = (error) => {
  if (isNotAbort(error)) {
    console.error(error);
  }
};
var makeDownloader = (images) => {
  let aborter = new AbortController();
  let rerender;
  let progress = {
    value: 0,
    text: "",
    error: false
  };
  const startDownload = (options) => {
    aborter = new AbortController();
    return download(images, { ...options, signal: aborter.signal });
  };
  const downloadAndSave = async (options) => {
    const zip2 = await startDownload(options);
    if (zip2) {
      await save(new Blob([zip2]));
    }
  };
  const reportProgress = (event) => {
    const { total, started, settled, rejected, isCancelled, isComplete } = event;
    const value = started / total * 0.1 + settled / total * 0.89;
    const text = `${(value * 100).toFixed(1)}%`;
    const error = !!rejected;
    if (isComplete || isCancelled) {
      progress = { value: 0, text: "", error: false };
      rerender == null ? void 0 : rerender();
    } else if (text !== progress.text) {
      progress = { value, text, error };
      rerender == null ? void 0 : rerender();
    }
  };
  const downloadWithProgress = async () => {
    try {
      await downloadAndSave({
        onProgress: reportProgress,
        onError: logIfNotAborted
      });
    } catch (error) {
      if (isNotAbort(error)) {
        throw error;
      }
    }
  };
  const guard = (event) => {
    event.preventDefault();
  };
  const useInstance = () => {
    const { error, text } = progress;
    rerender = useRerender();
    (0, import_react.useEffect)(() => {
      if (error || !text) {
        return;
      }
      addEventListener("beforeunload", guard);
      return () => removeEventListener("beforeunload", guard);
    }, [error || !text]);
  };
  return {
    get progress() {
      return progress;
    },
    download: startDownload,
    downloadAndSave,
    downloadWithProgress,
    cancelDownload: () => aborter.abort(),
    useInstance
  };
};
var makePageController = ({ source, observer }) => {
  let imageLoad;
  let state;
  let setState;
  let key = "";
  const load = async () => {
    const urls = [];
    key = `${Math.random()}`;
    for await (const url of imageSourceToIterable(source)) {
      urls.push(url);
      imageLoad = defer();
      setState == null ? void 0 : setState({ src: url, state: "loading" });
      const result = await imageLoad.promise;
      switch (result) {
        case true:
          setState == null ? void 0 : setState({ src: url, state: "complete" });
          return;
        case null:
          return;
      }
    }
    setState == null ? void 0 : setState({ urls, state: "error" });
  };
  const useInstance = ({ ref }) => {
    [state, setState] = (0, import_react.useState)({ src: "", state: "loading" });
    (0, import_react.useEffect)(() => {
      load();
    }, []);
    (0, import_react.useEffect)(() => {
      const target = ref == null ? void 0 : ref.current;
      if (target && observer) {
        observer.observe(target);
        return () => observer.unobserve(target);
      }
    }, [observer, ref.current]);
    return {
      key,
      ...state.src ? { src: state.src } : {},
      onError: () => imageLoad.resolve(false),
      onLoad: () => imageLoad.resolve(true)
    };
  };
  return {
    get state() {
      return state;
    },
    reload: async () => {
      setState == null ? void 0 : setState({ state: "complete" });
      imageLoad.resolve(null);
      await load();
    },
    useInstance
  };
};
var useIntersectionObserver = (callback, options) => {
  const [observer, setObserver] = (0, import_react.useState)();
  (0, import_react.useEffect)(() => {
    const newObserver = new IntersectionObserver(callback, options);
    setObserver(newObserver);
    return () => newObserver.disconnect();
  }, [callback, options]);
  return observer;
};
var useIntersection = (callback, options) => {
  const memo = (0, import_react.useRef)( new Map());
  const filterIntersections = (0, import_react.useCallback)(
    (newEntries) => {
      const memoized = memo.current;
      for (const entry of newEntries) {
        if (entry.isIntersecting) {
          memoized.set(entry.target, entry);
        } else {
          memoized.delete(entry.target);
        }
      }
      callback([...memoized.values()]);
    },
    [callback]
  );
  return useIntersectionObserver(filterIntersections, options);
};
var useResize = (target, transformer) => {
  const [value, setValue] = (0, import_react.useState)(() => transformer(void 0));
  const callbackRef = (0, import_react.useRef)(transformer);
  callbackRef.current = transformer;
  (0, import_react.useEffect)(() => {
    if (!target) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      setValue(callbackRef.current(entries[0]));
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [target, callbackRef]);
  return value;
};
var getCurrentPage = (container, entries) => {
  if (!entries.length) {
    return container.firstElementChild || void 0;
  }
  const children = [...container.children];
  const fullyVisibles = entries.filter((x) => x.intersectionRatio === 1);
  if (fullyVisibles.length) {
    fullyVisibles.sort((a, b) => {
      return children.indexOf(a.target) - children.indexOf(b.target);
    });
    return fullyVisibles[Math.floor(fullyVisibles.length / 2)].target;
  }
  return entries.sort((a, b) => {
    const ratio = {
      a: a.intersectionRatio,
      b: b.intersectionRatio
    };
    const index = {
      a: children.indexOf(a.target),
      b: children.indexOf(b.target)
    };
    return (ratio.b - ratio.a) * 1e4 + (index.a - index.b);
  })[0].target;
};
var makePageNavigator = (ref) => {
  let currentPage;
  let ratio;
  let ignoreIntersection = false;
  const resetAnchor = (entries) => {
    const container = ref.current;
    if (!(container == null ? void 0 : container.clientHeight) || entries.length === 0) {
      return;
    }
    if (ignoreIntersection) {
      ignoreIntersection = false;
      return;
    }
    const page = getCurrentPage(container, entries);
    const y = container.scrollTop + container.clientHeight / 2;
    currentPage = page;
    ratio = (y - page.offsetTop) / page.clientHeight;
  };
  const goNext = () => {
    ignoreIntersection = false;
    if (!currentPage) {
      return;
    }
    const originBound = currentPage.getBoundingClientRect();
    let cursor = currentPage;
    while (cursor.nextElementSibling) {
      const next = cursor.nextElementSibling;
      const nextBound = next.getBoundingClientRect();
      if (originBound.bottom < nextBound.top) {
        next.scrollIntoView({ block: "center" });
        break;
      }
      cursor = next;
    }
  };
  const goPrevious = () => {
    ignoreIntersection = false;
    if (!currentPage) {
      return;
    }
    const originBound = currentPage.getBoundingClientRect();
    let cursor = currentPage;
    while (cursor.previousElementSibling) {
      const previous = cursor.previousElementSibling;
      const previousBound = previous.getBoundingClientRect();
      if (previousBound.bottom < originBound.top) {
        previous.scrollIntoView({ block: "center" });
        break;
      }
      cursor = previous;
    }
  };
  const restoreScroll = () => {
    const container = ref.current;
    if (!container || ratio === void 0 || currentPage === void 0) {
      return;
    }
    const restoredY = currentPage.offsetTop + currentPage.clientHeight * (ratio - 0.5);
    container.scroll({ top: restoredY });
    ignoreIntersection = true;
  };
  const intersectionOption = { threshold: [0.01, 0.5, 1] };
  let observer;
  const useInstance = () => {
    observer = useIntersection(resetAnchor, intersectionOption);
    useResize(ref.current, restoreScroll);
  };
  return {
    get observer() {
      return observer;
    },
    goNext,
    goPrevious,
    useInstance
  };
};
var usePageNavigator = (ref) => {
  const navigator = (0, import_react.useMemo)(() => makePageNavigator(ref), [ref]);
  navigator.useInstance();
  return navigator;
};
var makeViewerController = ({ ref, navigator, rerender }) => {
  var _a, _b, _c;
  const compactPageKey = "vim_comic_viewer.single_page_count";
  let options = {};
  let images = [];
  let status = "loading";
  let compactWidthIndex = (_c = (_b = (_a = tampermonkeyApi).GM_getValue) == null ? void 0 : _b.call(_a, compactPageKey, 1)) != null ? _c : 1;
  let downloader;
  let pages = [];
  const toggleFullscreen = () => {
    var _a2;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      (_a2 = ref.current) == null ? void 0 : _a2.requestFullscreen();
    }
  };
  const loadImages = async (source) => {
    try {
      [images, downloader] = [[], void 0];
      if (!source) {
        status = "complete";
        return;
      }
      [status, pages] = ["loading", []];
      rerender();
      images = await source();
      if (!Array.isArray(images)) {
        throw new Error(`Invalid comic source type: ${typeof images}`);
      }
      status = "complete";
      downloader = makeDownloader(images);
      pages = images.map(
        (x) => makePageController({ source: x, observer: navigator.observer })
      );
    } catch (error) {
      status = "error";
      console.log(error);
      throw error;
    } finally {
      rerender();
    }
  };
  const reloadErrored = () => {
    window.stop();
    for (const controller of pages) {
      if (controller.state.state !== "complete") {
        controller.reload();
      }
    }
  };
  return {
    get options() {
      return options;
    },
    get status() {
      return status;
    },
    get container() {
      return ref.current;
    },
    get compactWidthIndex() {
      return compactWidthIndex;
    },
    get downloader() {
      return downloader;
    },
    get download() {
      var _a2;
      return (_a2 = downloader == null ? void 0 : downloader.download) != null ? _a2 : () => Promise.resolve(new Uint8Array());
    },
    get pages() {
      return pages;
    },
    set compactWidthIndex(value) {
      var _a2, _b2;
      compactWidthIndex = Math.max(0, value);
      (_b2 = (_a2 = tampermonkeyApi).GM_setValue) == null ? void 0 : _b2.call(_a2, compactPageKey, compactWidthIndex);
      rerender();
    },
    setOptions: async (value) => {
      const { source } = value;
      const isSourceChanged = source !== options.source;
      options = value;
      if (isSourceChanged) {
        await loadImages(source);
      }
    },
    goPrevious: navigator.goPrevious,
    goNext: navigator.goNext,
    toggleFullscreen,
    reloadErrored,
    unmount: () => (0, deps_exports.unmountComponentAtNode)(ref.current)
  };
};
var useViewerController = ({ ref, scrollRef }) => {
  const rerender = useRerender();
  const navigator = usePageNavigator(scrollRef);
  const controller = (0, import_react.useMemo)(
    () => makeViewerController({ ref, navigator, rerender }),
    [ref, navigator]
  );
  return controller;
};
var stretch = keyframes({
  "0%": {
    top: "8px",
    height: "64px"
  },
  "50%": {
    top: "24px",
    height: "32px"
  },
  "100%": {
    top: "24px",
    height: "32px"
  }
});
var SpinnerContainer = styled("div", {
  position: "absolute",
  left: "0",
  top: "0",
  right: "0",
  bottom: "0",
  margin: "auto",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  div: {
    display: "inline-block",
    width: "16px",
    margin: "0 4px",
    background: "#fff",
    animation: `${stretch} 1.2s cubic-bezier(0, 0.5, 0.5, 1) infinite`
  },
  "div:nth-child(1)": {
    "animation-delay": "-0.24s"
  },
  "div:nth-child(2)": {
    "animation-delay": "-0.12s"
  },
  "div:nth-child(3)": {
    "animation-delay": "0"
  }
});
var Spinner = () =>  React.createElement(SpinnerContainer, null,  React.createElement("div", null),  React.createElement("div", null),  React.createElement("div", null));
var Overlay = styled("div", {
  position: "relative",
  margin: "4px 0.5px",
  maxWidth: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "@media print": {
    margin: 0
  },
  variants: {
    placeholder: {
      true: { width: "45%" }
    },
    fullWidth: {
      true: { width: "100%" }
    }
  }
});
var LinkColumn = styled("div", {
  display: "flex",
  flexFlow: "column nowrap",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "1px 1px 3px",
  padding: "1rem 1.5rem",
  transition: "box-shadow 1s easeOutExpo",
  "&:hover": {
    boxShadow: "2px 2px 5px"
  },
  "&:active": {
    boxShadow: "0 0 2px"
  }
});
var Image = styled("img", {
  position: "relative",
  height: "100%",
  objectFit: "contain",
  maxWidth: "100%"
});
var Page = ({
  fullWidth,
  controller,
  ...props
}) => {
  const ref = (0, import_react.useRef)(null);
  const imageProps = controller.useInstance({ ref });
  const { state, src, urls } = controller.state;
  const reloadErrored = (0, import_react.useCallback)(async (event) => {
    event.stopPropagation();
    await controller.reload();
  }, []);
  return  React.createElement(Overlay, { ref, placeholder: state !== "complete", fullWidth }, state === "loading" &&  React.createElement(Spinner, null), state === "error" &&  React.createElement(LinkColumn, { onClick: reloadErrored },  React.createElement(CircledX, null),  React.createElement("p", null, "이미지를 불러오지 못했습니다"),  React.createElement("p", null, src ? src : urls == null ? void 0 : urls.join("\n"))),  React.createElement(Image, { ...imageProps, ...props }));
};
var Svg2 = styled("svg", {
  position: "absolute",
  bottom: "8px",
  left: "8px",
  cursor: "pointer",
  "&:hover": {
    filter: "hue-rotate(-145deg)"
  },
  variants: {
    error: {
      true: {
        filter: "hue-rotate(140deg)"
      }
    }
  }
});
var Circle = styled("circle", {
  transform: "rotate(-90deg)",
  transformOrigin: "50% 50%",
  stroke: "url(#aEObn)",
  fill: "#fff8"
});
var GradientDef =  React.createElement("defs", null,  React.createElement("linearGradient", { id: "aEObn", x1: "100%", y1: "0%", x2: "0%", y2: "100%" },  React.createElement("stop", { offset: "0%", style: { stopColor: "#53baff", stopOpacity: 1 } }),  React.createElement("stop", { offset: "100%", style: { stopColor: "#0067bb", stopOpacity: 1 } })));
var CenterText = styled("text", {
  dominantBaseline: "middle",
  textAnchor: "middle",
  fontSize: "30px",
  fontWeight: "bold",
  fill: "#004b9e"
});
var CircularProgress = (props) => {
  const { radius, strokeWidth, value, text, ...otherProps } = props;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - value * circumference;
  const center = radius + strokeWidth / 2;
  const side = center * 2;
  return  React.createElement(Svg2, { height: side, width: side, ...otherProps }, GradientDef,  React.createElement(
    Circle,
    {
      ...{
        strokeWidth,
        strokeDasharray: `${circumference} ${circumference}`,
        strokeDashoffset,
        r: radius,
        cx: center,
        cy: center
      }
    }
  ),  React.createElement(CenterText, { x: "50%", y: "50%" }, text || ""));
};
var LeftBottomFloat = (0, deps_exports.styled)("div", {
  position: "absolute",
  bottom: "0.5%",
  left: "0.5%",
  display: "flex",
  flexFlow: "column"
});
var MenuActions = (0, deps_exports.styled)("div", {
  display: "flex",
  alignItems: "center"
});
var ColorInput = (0, deps_exports.styled)("input", {
  marginLeft: "20px"
});
var SupplementaryActionMenu = ({ downloader, color, onColorChange }) => {
  var _a;
  const { value, text, error } = (_a = downloader.progress) != null ? _a : {};
  downloader.useInstance();
  const [isOpen, setIsOpen] = (0, import_react.useState)(false);
  return  React.createElement(LeftBottomFloat, null, !!text &&  React.createElement(
    CircularProgress,
    {
      radius: 50,
      strokeWidth: 10,
      value: value != null ? value : 0,
      text,
      error,
      onClick: downloader.cancelDownload
    }
  ),  React.createElement(MenuActions, null,  React.createElement(
    MenuIcon,
    {
      onClick: () => {
        setIsOpen((value2) => !value2);
      }
    }
  ), !!isOpen &&  React.createElement(React.Fragment, null,  React.createElement(DownloadIcon, { onClick: downloader.downloadWithProgress }),  React.createElement(
    ColorInput,
    {
      type: "color",
      value: color,
      onChange: (event) => {
        onColorChange == null ? void 0 : onColorChange(event.currentTarget.value);
      }
    }
  ))));
};
var Viewer = (0, import_react.forwardRef)((props, refHandle) => {
  const { useDefault: enableDefault, options: viewerOptions, ...otherProps } = props;
  const ref = (0, import_react.useRef)();
  const scrollRef = (0, import_react.useRef)();
  const fullscreenElement = useFullscreenElement();
  const controller = useViewerController({ ref, scrollRef });
  const {
    options,
    pages,
    status,
    downloader,
    toggleFullscreen,
    compactWidthIndex
  } = controller;
  const navigate = (0, import_react.useCallback)((event) => {
    var _a;
    const height = (_a = ref.current) == null ? void 0 : _a.clientHeight;
    if (!height || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const isTop = event.clientY < height / 2;
    if (isTop) {
      controller.goPrevious();
    } else {
      controller.goNext();
    }
  }, [controller]);
  const blockSelection = (0, import_react.useCallback)(
    (event) => {
      if (event.detail >= 2) {
        event.preventDefault();
      }
      if (event.buttons === 3) {
        controller.toggleFullscreen();
        event.preventDefault();
      }
    },
    [controller]
  );
  useDefault({ enable: props.useDefault, controller });
  const backgroundColorKey = "vim_comic_viewer.background_color";
  const [backgroundColor, setBackgroundColor] = (0, import_react.useState)(() => {
    var _a, _b, _c;
    return (_c = (_b = (_a = tampermonkeyApi).GM_getValue) == null ? void 0 : _b.call(_a, backgroundColorKey, "#eeeeee")) != null ? _c : "#eeeeee";
  });
  (0, import_react.useImperativeHandle)(refHandle, () => controller, [controller]);
  (0, import_react.useEffect)(() => {
    controller.setOptions(viewerOptions);
  }, [controller, viewerOptions]);
  (0, import_react.useEffect)(() => {
    var _a, _b;
    if (ref.current && fullscreenElement === ref.current) {
      (_b = (_a = ref.current) == null ? void 0 : _a.focus) == null ? void 0 : _b.call(_a);
    }
  }, [ref.current, fullscreenElement]);
  return  React.createElement(
    Container,
    {
      ref,
      tabIndex: -1,
      className: "vim_comic_viewer",
      css: { backgroundColor }
    },
     React.createElement(
      ScrollableLayout,
      {
        ref: scrollRef,
        dark: isDarkColor(backgroundColor),
        fullscreen: fullscreenElement === ref.current,
        onClick: navigate,
        onMouseDown: blockSelection,
        children: status === "complete" ? pages.map((controller2, index) =>  React.createElement(
          Page,
          {
            key: index,
            controller: controller2,
            fullWidth: index < compactWidthIndex,
            ...options == null ? void 0 : options.imageProps
          }
        )) :  React.createElement("p", null, status === "error" ? "에러가 발생했습니다" : "로딩 중..."),
        ...otherProps
      }
    ),
     React.createElement(FullscreenIcon, { onClick: toggleFullscreen }),
    downloader ?  React.createElement(
      SupplementaryActionMenu,
      {
        downloader,
        color: backgroundColor,
        onColorChange: (newColor) => {
          var _a, _b;
          (_b = (_a = tampermonkeyApi).GM_setValue) == null ? void 0 : _b.call(_a, backgroundColorKey, newColor);
          setBackgroundColor(newColor);
        }
      }
    ) : false
  );
});
function isDarkColor(rgbColor) {
  const match = rgbColor.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (!match) {
    return false;
  }
  const [_, r, g, b] = match.map((x) => parseInt(x, 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}
var types_exports = {};
var getDefaultRoot = () => {
  const div = document.createElement("div");
  div.setAttribute(
    "style",
    "width: 0; height: 0; position: fixed;"
  );
  document.body.append(div);
  return div;
};
var initialize = (options) => {
  const ref = (0, import_react.createRef)();
  (0, deps_exports.render)( React.createElement(Viewer, { ref, options, useDefault: true }), getDefaultRoot());
  return Promise.resolve(ref.current);
};
Ask AI to edit or generate...

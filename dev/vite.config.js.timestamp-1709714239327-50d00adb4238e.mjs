// dev/vite.config.ts
import "file:///C:/Code/weavy/frontend/uikit-web/node_modules/dotenv/config.js";
import { defineConfig } from "file:///C:/Code/weavy/frontend/uikit-web/node_modules/vite/dist/node/index.js";

// package.json
var package_default = {
  name: "@weavy/uikit-web",
  version: "1.0.0",
  author: "Weavy",
  description: "Web components UI-kit for Weavy",
  homepage: "https://github.com/weavy/weavy-uikit-web",
  license: "MIT",
  type: "module",
  files: [
    "cli",
    "dist",
    "lib",
    "test",
    "*.json",
    "*.md"
  ],
  main: "./dist/weavy.js",
  module: "./dist/weavy.esm.js",
  types: "./dist/types/index.d.ts",
  exports: {
    ".": {
      import: "./dist/weavy.esm.js",
      require: "./dist/weavy.js",
      types: "./dist/types/index.d.ts"
    }
  },
  customElements: "dist/custom-elements.json",
  scripts: {
    clean: "rimraf dist/**/* --glob",
    prepack: "run-s clean build",
    prebuild: "run-p types localize-build",
    build: "vite build --config dev/vite.config.js",
    watch: "vite build --config dev/vite.config.js --watch",
    start: "run-p auth serve",
    auth: "node cli/auth-server.mjs",
    serve: "vite --config dev/vite.config.js",
    "localize-build": "lit-localize build --config=dev/lit-localize.json",
    "localize-extract": "lit-localize extract --config=dev/lit-localize.json",
    docs: "wca analyze lib --format markdown --outDir dist/docs",
    lint: "eslint lib",
    types: "tsc",
    analyze: "lit-analyzer lib/**/*",
    pretest: "run-p lint analyze types",
    test: "run-p watch test:watch",
    "pretest:build": "run-s build",
    "test:build": "web-test-runner --config dev/web-test-runner.config.mjs",
    "test:watch": "web-test-runner --config dev/web-test-runner.config.mjs --watch"
  },
  bin: {
    weavy: "./cli/weavy-cli.mjs"
  },
  dependencies: {
    "@atlaskit/embedded-confluence": "^2.14.0",
    "@codemirror/autocomplete": "^6.12.0",
    "@codemirror/commands": "^6.3.3",
    "@codemirror/lang-markdown": "^6.2.4",
    "@codemirror/language": "^6.10.1",
    "@codemirror/language-data": "^6.4.1",
    "@codemirror/state": "^6.4.0",
    "@codemirror/view": "^6.24.0",
    "@lit/context": "^1.1.0",
    "@lit/localize": "^0.12.1",
    "@material/material-color-utilities": "^0.2.7",
    "@mdi/js": "^7.4.47",
    "@microsoft/signalr": "^7.0.14",
    "@popperjs/core": "^2.11.8",
    "@tanstack/query-core": "^5.20.1",
    "@tanstack/query-persist-client-core": "^5.20.1",
    "@tanstack/query-sync-storage-persister": "^5.20.1",
    dotenv: "^16.4.2",
    lit: "^3.1.2",
    "lit-modal-portal": "mindroute/lit-modal-portal#dist-v5",
    "lodash.throttle": "^4.1.1",
    "pdfjs-dist": "^3.11.174",
    react: "^16.14.0",
    "react-dom": "^16.14.0"
  },
  devDependencies: {
    "@lit/localize-tools": "^0.7.2",
    "@open-wc/testing": "^4.0.0",
    "@tanstack/eslint-plugin-query": "^5.20.1",
    "@tanstack/query-devtools": "^5.20.1",
    "@types/lodash.throttle": "^4.1.9",
    "@types/mocha": "^10.0.6",
    "@types/react": "^16.14.57",
    "@types/react-dom": "^16.9.24",
    "@typescript-eslint/eslint-plugin": "^7.1.0",
    "@typescript-eslint/parser": "^7.1.0",
    "@web/test-runner": "^0.18.0",
    cors: "^2.8.5",
    eslint: "^8.56.0",
    "eslint-plugin-lit": "^1.11.0",
    "eslint-plugin-lit-a11y": "^4.1.2",
    "eslint-plugin-wc": "^2.0.4",
    express: "^4.18.2",
    "lit-analyzer": "^2.0.3",
    "node-fetch": "^3.3.2",
    "npm-run-all": "^4.1.5",
    rimraf: "^5.0.5",
    "rollup-plugin-minify-html-literals": "^1.2.6",
    sass: "^1.70.0",
    "ts-lit-plugin": "^2.0.2",
    typescript: "^5.3.3",
    vite: "^5.1.3",
    "vite-plugin-cem": "^0.6.0",
    "vite-plugin-dts": "^3.7.2",
    "vite-plugin-node-polyfills": "^0.21.0",
    "web-component-analyzer": "^2.0.0"
  }
};

// dev/vite.config.ts
import dts from "file:///C:/Code/weavy/frontend/uikit-web/node_modules/vite-plugin-dts/dist/index.mjs";
import fs from "fs";
import VitePluginCustomElementsManifest from "file:///C:/Code/weavy/frontend/uikit-web/node_modules/vite-plugin-cem/dist/index.js";
var sourceName = process.argv.find((s) => s.startsWith("--source-name="))?.split("=")[1] || package_default.name;
var version = process.argv.find((s) => s.startsWith("--version="))?.split("=")[1] || package_default.version;
console.log(sourceName, version);
var httpsConfig;
if (process.env.HTTPS_PEM_CERT_PATH && process.env.HTTPS_PEM_KEY_PATH) {
  httpsConfig = {
    key: fs.readFileSync(process.env.HTTPS_PEM_KEY_PATH),
    cert: fs.readFileSync(process.env.HTTPS_PEM_CERT_PATH)
  };
}
if (process.env.HTTPS_PFX_PATH) {
  httpsConfig = {
    pfx: fs.readFileSync(process.env.HTTPS_PFX_PATH),
    passphrase: process.env.HTTPS_PFX_PASSWORD
  };
}
function weavyImportUrlPlugin() {
  const options = {
    name: "weavy-import-url",
    renderDynamicImport({
      //customResolution,
      //format,
      //moduleId,
      targetModuleId
    }) {
      if (targetModuleId && this.getModuleInfo(targetModuleId)?.isExternal) {
        return {
          left: "import(",
          right: ")"
        };
      } else {
        return {
          left: `import(/* webpackIgnore: true */ /* @vite-ignore */ new URL(`,
          right: `, typeof WEAVY_IMPORT_URL === "string" && (!import.meta.url || !(new URL(import.meta.url).href.startsWith(WEAVY_IMPORT_URL))) ? WEAVY_IMPORT_URL : import.meta.url).href)`
        };
      }
    }
    /*resolveImportMeta(property, { moduleId }) {
    			if (property === 'url') {
            const relUrl = path.relative(
              process.cwd(),
              moduleId
            ).split(path.sep).join("/")
    
    				//return `new URL('${relUrl}', document.baseURI).href`;
    				return `'${relUrl}'`;
    			}
    			return null;
    		}*/
  };
  return options;
}
function weavyChunkNames(chunkInfo) {
  let name;
  if (chunkInfo.facadeModuleId) {
    name = chunkInfo.facadeModuleId.split("node_modules/")[1];
  } else if (chunkInfo.moduleIds.length === 1) {
    name = chunkInfo.moduleIds[0].split("node_modules/")[1];
  } else {
    name = `[name]`;
  }
  if (name?.includes("?")) {
    name = name.split("?")[0];
  }
  if (name?.endsWith(".js")) {
    name = name.slice(0, -1 * ".js".length);
  }
  return `[format]/${name}.${chunkInfo.format === "cjs" ? "cjs" : "js"}`;
}
function utf8BomPlugin() {
  const options = {
    name: "utf-8-bom",
    generateBundle(options2, bundle, _isWrite) {
      Object.keys(bundle).forEach((chunkId) => {
        const chunk = bundle[chunkId];
        if (typeof chunk.code === "string") {
          if (!chunk.code.startsWith("\uFEFF")) {
            chunk.code = "\uFEFF" + chunk.code;
          }
        }
      });
    }
  };
  return options;
}
var vite_config_default = defineConfig({
  publicDir: "public",
  envPrefix: "WEAVY_",
  plugins: [
    dts({
      tsconfigPath: "dev/tsconfig.build.json",
      outDir: "dist/types",
      include: ["lib"],
      entryRoot: "lib"
    }),
    VitePluginCustomElementsManifest({
      files: ["./lib/**/wy-*.ts"],
      lit: true
    }),
    weavyImportUrlPlugin()
  ],
  define: {
    WEAVY_SOURCE_NAME: JSON.stringify(sourceName),
    WEAVY_VERSION: JSON.stringify(version),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV)
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001/"
    },
    https: httpsConfig
  },
  esbuild: {
    legalComments: "none",
    charset: "utf8"
    //banner: "\ufeff", // UTF-8 BOM
  },
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: "lib/index.ts",
      name: "WeavyLib",
      // the proper extensions will be added
      fileName: "weavy"
    },
    sourcemap: false,
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      //external: ["react", "react-dom"],
      plugins: [
        // @ ts-expect-error wrong type
        //minifyHTMLLiterals.default()
        utf8BomPlugin()
      ],
      output: [
        {
          format: "esm",
          minifyInternalExports: false,
          preserveModules: false,
          manualChunks: {
            editor: [
              "./lib/utils/editor/editor",
              "@codemirror/view",
              "@codemirror/state",
              "@codemirror/language",
              "@codemirror/autocomplete",
              "@codemirror/lang-markdown",
              "@codemirror/language-data",
              "@codemirror/legacy-modes/mode/simple-mode",
              "@lezer/common",
              "@lezer/highlight",
              "@lezer/lr",
              "@lezer/markdown"
            ],
            react: ["react", "react-dom"],
            pdfjs: ["pdfjs-dist"],
            "locales/sv-SE": ["./locales/sv-SE"]
          },
          chunkFileNames: weavyChunkNames
        },
        {
          format: "umd",
          entryFileNames: "weavy.js",
          name: "WeavyLib",
          exports: "named",
          footer: `
            // Expose WeavyLib in root
            if (!(typeof exports == "object" && typeof module < "u" || typeof define == "function" && define.amd)) {
              const root = typeof globalThis < "u" ? globalThis : this || self;
              for (const exportName in root.WeavyLib) {
                if (exportName !== "default") {
                  root[exportName] = root.WeavyLib[exportName];
                }
              }
            }
          `
        }
        /*{
          format: "esm",
          name: "WeavyLib",
          entryFileNames: "weavy.js",
          exports: "named",
          inlineDynamicImports: true,
          plugins: [
            getBabelOutputPlugin({
              presets: [['@babel/preset-env', { modules: "umd" }], "@babel/preset-react"],
              minified: true,
              comments: false,
            }),
          ],
        },
        {
          format: "es",
          entryFileNames: "weavy.es5.esm.js",
          plugins: [
            getBabelOutputPlugin({
              presets: [['@babel/preset-env', { modules: "auto" }], "@babel/preset-react"],
              minified: true,
              comments: false,
            }),
          ],
        },*/
      ]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZGV2L3ZpdGUuY29uZmlnLnRzIiwgInBhY2thZ2UuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXENvZGVcXFxcd2VhdnlcXFxcZnJvbnRlbmRcXFxcdWlraXQtd2ViXFxcXGRldlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcQ29kZVxcXFx3ZWF2eVxcXFxmcm9udGVuZFxcXFx1aWtpdC13ZWJcXFxcZGV2XFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Db2RlL3dlYXZ5L2Zyb250ZW5kL3Vpa2l0LXdlYi9kZXYvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgXCJkb3RlbnYvY29uZmlnXCI7XHJcbmltcG9ydCB7IFBsdWdpbk9wdGlvbiwgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHBhY2thZ2VKc29uIGZyb20gXCIuLi9wYWNrYWdlLmpzb25cIiBhc3NlcnQgeyB0eXBlOiBcImpzb25cIiB9O1xyXG5pbXBvcnQgZHRzIGZyb20gXCJ2aXRlLXBsdWdpbi1kdHNcIjtcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG4vL2ltcG9ydCB7IGdldEJhYmVsT3V0cHV0UGx1Z2luIH0gZnJvbSBcIkByb2xsdXAvcGx1Z2luLWJhYmVsXCI7XHJcbmltcG9ydCBWaXRlUGx1Z2luQ3VzdG9tRWxlbWVudHNNYW5pZmVzdCBmcm9tICd2aXRlLXBsdWdpbi1jZW0nO1xyXG4vL2ltcG9ydCBtaW5pZnlIVE1MTGl0ZXJhbHMgZnJvbSAncm9sbHVwLXBsdWdpbi1taW5pZnktaHRtbC1saXRlcmFscyc7XHJcblxyXG4vL3Byb2Nlc3MuZW52W1wiTk9ERV9UTFNfUkVKRUNUX1VOQVVUSE9SSVpFRFwiXSA9IFwiMFwiO1xyXG5cclxuY29uc3Qgc291cmNlTmFtZSA9IHByb2Nlc3MuYXJndi5maW5kKChzKSA9PiBzLnN0YXJ0c1dpdGgoXCItLXNvdXJjZS1uYW1lPVwiKSk/LnNwbGl0KFwiPVwiKVsxXSB8fCBwYWNrYWdlSnNvbi5uYW1lO1xyXG5jb25zdCB2ZXJzaW9uID0gcHJvY2Vzcy5hcmd2LmZpbmQoKHMpID0+IHMuc3RhcnRzV2l0aChcIi0tdmVyc2lvbj1cIikpPy5zcGxpdChcIj1cIilbMV0gfHwgcGFja2FnZUpzb24udmVyc2lvbjtcclxuXHJcbmNvbnNvbGUubG9nKHNvdXJjZU5hbWUsIHZlcnNpb24pO1xyXG5cclxubGV0IGh0dHBzQ29uZmlnO1xyXG5cclxuaWYgKHByb2Nlc3MuZW52LkhUVFBTX1BFTV9DRVJUX1BBVEggJiYgcHJvY2Vzcy5lbnYuSFRUUFNfUEVNX0tFWV9QQVRIKSB7XHJcbiAgaHR0cHNDb25maWcgPSB7XHJcbiAgICBrZXk6IGZzLnJlYWRGaWxlU3luYyhwcm9jZXNzLmVudi5IVFRQU19QRU1fS0VZX1BBVEgpLFxyXG4gICAgY2VydDogZnMucmVhZEZpbGVTeW5jKHByb2Nlc3MuZW52LkhUVFBTX1BFTV9DRVJUX1BBVEgpLFxyXG4gIH07XHJcbn1cclxuXHJcbmlmIChwcm9jZXNzLmVudi5IVFRQU19QRlhfUEFUSCkge1xyXG4gIGh0dHBzQ29uZmlnID0ge1xyXG4gICAgcGZ4OiBmcy5yZWFkRmlsZVN5bmMocHJvY2Vzcy5lbnYuSFRUUFNfUEZYX1BBVEgpLFxyXG4gICAgcGFzc3BocmFzZTogcHJvY2Vzcy5lbnYuSFRUUFNfUEZYX1BBU1NXT1JELFxyXG4gIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdlYXZ5SW1wb3J0VXJsUGx1Z2luKCkge1xyXG4gIGNvbnN0IG9wdGlvbnM6IFBsdWdpbk9wdGlvbiA9IHtcclxuICAgIG5hbWU6IFwid2VhdnktaW1wb3J0LXVybFwiLFxyXG4gICAgcmVuZGVyRHluYW1pY0ltcG9ydCh7XHJcbiAgICAgIC8vY3VzdG9tUmVzb2x1dGlvbixcclxuICAgICAgLy9mb3JtYXQsXHJcbiAgICAgIC8vbW9kdWxlSWQsXHJcbiAgICAgIHRhcmdldE1vZHVsZUlkLFxyXG4gICAgfSkge1xyXG4gICAgICBpZiAodGFyZ2V0TW9kdWxlSWQgJiYgdGhpcy5nZXRNb2R1bGVJbmZvKHRhcmdldE1vZHVsZUlkKT8uaXNFeHRlcm5hbCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICBsZWZ0OiBcImltcG9ydChcIixcclxuICAgICAgICAgIHJpZ2h0OiBcIilcIixcclxuICAgICAgICB9O1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICBsZWZ0OiBgaW1wb3J0KC8qIHdlYnBhY2tJZ25vcmU6IHRydWUgKi8gLyogQHZpdGUtaWdub3JlICovIG5ldyBVUkwoYCxcclxuICAgICAgICAgIHJpZ2h0OiBgLCB0eXBlb2YgV0VBVllfSU1QT1JUX1VSTCA9PT0gXCJzdHJpbmdcIiAmJiAoIWltcG9ydC5tZXRhLnVybCB8fCAhKG5ldyBVUkwoaW1wb3J0Lm1ldGEudXJsKS5ocmVmLnN0YXJ0c1dpdGgoV0VBVllfSU1QT1JUX1VSTCkpKSA/IFdFQVZZX0lNUE9SVF9VUkwgOiBpbXBvcnQubWV0YS51cmwpLmhyZWYpYCxcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgLypyZXNvbHZlSW1wb3J0TWV0YShwcm9wZXJ0eSwgeyBtb2R1bGVJZCB9KSB7XHJcblx0XHRcdGlmIChwcm9wZXJ0eSA9PT0gJ3VybCcpIHtcclxuICAgICAgICBjb25zdCByZWxVcmwgPSBwYXRoLnJlbGF0aXZlKFxyXG4gICAgICAgICAgcHJvY2Vzcy5jd2QoKSxcclxuICAgICAgICAgIG1vZHVsZUlkXHJcbiAgICAgICAgKS5zcGxpdChwYXRoLnNlcCkuam9pbihcIi9cIilcclxuXHJcblx0XHRcdFx0Ly9yZXR1cm4gYG5ldyBVUkwoJyR7cmVsVXJsfScsIGRvY3VtZW50LmJhc2VVUkkpLmhyZWZgO1xyXG5cdFx0XHRcdHJldHVybiBgJyR7cmVsVXJsfSdgO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fSovXHJcbiAgfTtcclxuXHJcbiAgcmV0dXJuIG9wdGlvbnM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdlYXZ5Q2h1bmtOYW1lcyhjaHVua0luZm8pIHtcclxuICBsZXQgbmFtZTogU3RyaW5nO1xyXG4gIGlmIChjaHVua0luZm8uZmFjYWRlTW9kdWxlSWQpIHtcclxuICAgIG5hbWUgPSBjaHVua0luZm8uZmFjYWRlTW9kdWxlSWQuc3BsaXQoXCJub2RlX21vZHVsZXMvXCIpWzFdO1xyXG4gIH0gZWxzZSBpZiAoY2h1bmtJbmZvLm1vZHVsZUlkcy5sZW5ndGggPT09IDEpIHtcclxuICAgIG5hbWUgPSBjaHVua0luZm8ubW9kdWxlSWRzWzBdLnNwbGl0KFwibm9kZV9tb2R1bGVzL1wiKVsxXTtcclxuICB9IGVsc2Uge1xyXG4gICAgLy9uYW1lID0gYCR7Y2h1bmtJbmZvLmlzRHluYW1pY0VudHJ5ID8gXCJkeW5hbWljL1wiIDogXCJcIn1bbmFtZV1gO1xyXG4gICAgbmFtZSA9IGBbbmFtZV1gO1xyXG4gIH1cclxuXHJcbiAgaWYgKG5hbWU/LmluY2x1ZGVzKFwiP1wiKSkge1xyXG4gICAgbmFtZSA9IG5hbWUuc3BsaXQoXCI/XCIpWzBdO1xyXG4gIH1cclxuXHJcbiAgaWYgKG5hbWU/LmVuZHNXaXRoKFwiLmpzXCIpKSB7XHJcbiAgICBuYW1lID0gbmFtZS5zbGljZSgwLCAtMSAqIFwiLmpzXCIubGVuZ3RoKTtcclxuICB9XHJcbiAgLy9yZXR1cm4gYGVzbS8ke2NodW5rSW5mby5pc0R5bmFtaWNFbnRyeSA/IFwiZHluYW1pYy9cIiA6IFwiXCJ9JHtuYW1lfS5qc2A7XHJcbiAgcmV0dXJuIGBbZm9ybWF0XS8ke25hbWV9LiR7Y2h1bmtJbmZvLmZvcm1hdCA9PT0gXCJjanNcIiA/IFwiY2pzXCIgOiBcImpzXCJ9YDtcclxufVxyXG5cclxuZnVuY3Rpb24gdXRmOEJvbVBsdWdpbigpe1xyXG4gIGNvbnN0IG9wdGlvbnM6IFBsdWdpbk9wdGlvbiA9IHtcclxuICAgIG5hbWU6IFwidXRmLTgtYm9tXCIsXHJcbiAgICBnZW5lcmF0ZUJ1bmRsZShvcHRpb25zLCBidW5kbGUsIF9pc1dyaXRlKSB7XHJcbiAgICAgIE9iamVjdC5rZXlzKGJ1bmRsZSkuZm9yRWFjaChjaHVua0lkID0+IHtcclxuICAgICAgICBjb25zdCBjaHVuayA9IGJ1bmRsZVtjaHVua0lkXVxyXG4gICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgY2h1bmsgdHlwZVxyXG4gICAgICAgIGlmICh0eXBlb2YgY2h1bmsuY29kZSA9PT0gXCJzdHJpbmdcIikgeyBcclxuICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgY2h1bmsgdHlwZVxyXG4gICAgICAgICAgaWYgKCFjaHVuay5jb2RlLnN0YXJ0c1dpdGgoXCJcXHVmZWZmXCIpKSB7XHJcbiAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgY2h1bmsgdHlwZVxyXG4gICAgICAgICAgICBjaHVuay5jb2RlID0gXCJcXHVmZWZmXCIgKyBjaHVuay5jb2RlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBvcHRpb25zO1xyXG59XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwdWJsaWNEaXI6IFwicHVibGljXCIsXHJcbiAgZW52UHJlZml4OiBcIldFQVZZX1wiLFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIGR0cyh7XHJcbiAgICAgIHRzY29uZmlnUGF0aDogXCJkZXYvdHNjb25maWcuYnVpbGQuanNvblwiLFxyXG4gICAgICBvdXREaXI6IFwiZGlzdC90eXBlc1wiLFxyXG4gICAgICBpbmNsdWRlOiBbXCJsaWJcIl0sXHJcbiAgICAgIGVudHJ5Um9vdDogXCJsaWJcIixcclxuICAgIH0pLFxyXG4gICAgVml0ZVBsdWdpbkN1c3RvbUVsZW1lbnRzTWFuaWZlc3Qoe1xyXG4gICAgICBmaWxlczogWycuL2xpYi8qKi93eS0qLnRzJ10sXHJcbiAgICAgIGxpdDogdHJ1ZSxcclxuICAgIH0pLFxyXG4gICAgd2VhdnlJbXBvcnRVcmxQbHVnaW4oKSxcclxuICBdLFxyXG4gIGRlZmluZToge1xyXG4gICAgV0VBVllfU09VUkNFX05BTUU6IEpTT04uc3RyaW5naWZ5KHNvdXJjZU5hbWUpLFxyXG4gICAgV0VBVllfVkVSU0lPTjogSlNPTi5zdHJpbmdpZnkodmVyc2lvbiksXHJcbiAgICBcInByb2Nlc3MuZW52Lk5PREVfRU5WXCI6IEpTT04uc3RyaW5naWZ5KHByb2Nlc3MuZW52Lk5PREVfRU5WKSxcclxuICB9LFxyXG4gIHNlcnZlcjoge1xyXG4gICAgcHJveHk6IHtcclxuICAgICAgXCIvYXBpXCI6IFwiaHR0cDovL2xvY2FsaG9zdDozMDAxL1wiLFxyXG4gICAgfSxcclxuICAgIGh0dHBzOiBodHRwc0NvbmZpZyxcclxuICB9LFxyXG4gIGVzYnVpbGQ6IHtcclxuICAgIGxlZ2FsQ29tbWVudHM6IFwibm9uZVwiLFxyXG4gICAgY2hhcnNldDogJ3V0ZjgnLFxyXG4gICAgLy9iYW5uZXI6IFwiXFx1ZmVmZlwiLCAvLyBVVEYtOCBCT01cclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBsaWI6IHtcclxuICAgICAgLy8gQ291bGQgYWxzbyBiZSBhIGRpY3Rpb25hcnkgb3IgYXJyYXkgb2YgbXVsdGlwbGUgZW50cnkgcG9pbnRzXHJcbiAgICAgIGVudHJ5OiBcImxpYi9pbmRleC50c1wiLFxyXG4gICAgICBuYW1lOiBcIldlYXZ5TGliXCIsXHJcbiAgICAgIC8vIHRoZSBwcm9wZXIgZXh0ZW5zaW9ucyB3aWxsIGJlIGFkZGVkXHJcbiAgICAgIGZpbGVOYW1lOiBcIndlYXZ5XCIsXHJcbiAgICB9LFxyXG4gICAgc291cmNlbWFwOiBmYWxzZSxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgLy8gbWFrZSBzdXJlIHRvIGV4dGVybmFsaXplIGRlcHMgdGhhdCBzaG91bGRuJ3QgYmUgYnVuZGxlZFxyXG4gICAgICAvLyBpbnRvIHlvdXIgbGlicmFyeVxyXG4gICAgICAvL2V4dGVybmFsOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiXSxcclxuXHJcbiAgICAgIHBsdWdpbnM6W1xyXG4gICAgICAgIC8vIEAgdHMtZXhwZWN0LWVycm9yIHdyb25nIHR5cGVcclxuICAgICAgICAvL21pbmlmeUhUTUxMaXRlcmFscy5kZWZhdWx0KClcclxuICAgICAgICB1dGY4Qm9tUGx1Z2luKCksXHJcbiAgICAgIF0sXHJcbiAgICAgIG91dHB1dDogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGZvcm1hdDogXCJlc21cIixcclxuICAgICAgICAgIG1pbmlmeUludGVybmFsRXhwb3J0czogZmFsc2UsXHJcbiAgICAgICAgICBwcmVzZXJ2ZU1vZHVsZXM6IGZhbHNlLFxyXG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAgIGVkaXRvcjogW1xyXG4gICAgICAgICAgICAgIFwiLi9saWIvdXRpbHMvZWRpdG9yL2VkaXRvclwiLFxyXG4gICAgICAgICAgICAgIFwiQGNvZGVtaXJyb3Ivdmlld1wiLFxyXG4gICAgICAgICAgICAgIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIixcclxuICAgICAgICAgICAgICBcIkBjb2RlbWlycm9yL2xhbmd1YWdlXCIsXHJcbiAgICAgICAgICAgICAgXCJAY29kZW1pcnJvci9hdXRvY29tcGxldGVcIixcclxuICAgICAgICAgICAgICBcIkBjb2RlbWlycm9yL2xhbmctbWFya2Rvd25cIixcclxuICAgICAgICAgICAgICBcIkBjb2RlbWlycm9yL2xhbmd1YWdlLWRhdGFcIixcclxuICAgICAgICAgICAgICBcIkBjb2RlbWlycm9yL2xlZ2FjeS1tb2Rlcy9tb2RlL3NpbXBsZS1tb2RlXCIsXHJcbiAgICAgICAgICAgICAgXCJAbGV6ZXIvY29tbW9uXCIsXHJcbiAgICAgICAgICAgICAgXCJAbGV6ZXIvaGlnaGxpZ2h0XCIsXHJcbiAgICAgICAgICAgICAgXCJAbGV6ZXIvbHJcIixcclxuICAgICAgICAgICAgICBcIkBsZXplci9tYXJrZG93blwiLFxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICByZWFjdDogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIl0sXHJcbiAgICAgICAgICAgIHBkZmpzOiBbXCJwZGZqcy1kaXN0XCJdLFxyXG4gICAgICAgICAgICBcImxvY2FsZXMvc3YtU0VcIjogW1wiLi9sb2NhbGVzL3N2LVNFXCJdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGNodW5rRmlsZU5hbWVzOiB3ZWF2eUNodW5rTmFtZXMsXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBmb3JtYXQ6IFwidW1kXCIsXHJcbiAgICAgICAgICBlbnRyeUZpbGVOYW1lczogXCJ3ZWF2eS5qc1wiLFxyXG4gICAgICAgICAgbmFtZTogXCJXZWF2eUxpYlwiLFxyXG4gICAgICAgICAgZXhwb3J0czogXCJuYW1lZFwiLFxyXG4gICAgICAgICAgZm9vdGVyOiBgXHJcbiAgICAgICAgICAgIC8vIEV4cG9zZSBXZWF2eUxpYiBpbiByb290XHJcbiAgICAgICAgICAgIGlmICghKHR5cGVvZiBleHBvcnRzID09IFwib2JqZWN0XCIgJiYgdHlwZW9mIG1vZHVsZSA8IFwidVwiIHx8IHR5cGVvZiBkZWZpbmUgPT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpKSB7XHJcbiAgICAgICAgICAgICAgY29uc3Qgcm9vdCA9IHR5cGVvZiBnbG9iYWxUaGlzIDwgXCJ1XCIgPyBnbG9iYWxUaGlzIDogdGhpcyB8fCBzZWxmO1xyXG4gICAgICAgICAgICAgIGZvciAoY29uc3QgZXhwb3J0TmFtZSBpbiByb290LldlYXZ5TGliKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZXhwb3J0TmFtZSAhPT0gXCJkZWZhdWx0XCIpIHtcclxuICAgICAgICAgICAgICAgICAgcm9vdFtleHBvcnROYW1lXSA9IHJvb3QuV2VhdnlMaWJbZXhwb3J0TmFtZV07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICBgLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyp7XHJcbiAgICAgICAgICBmb3JtYXQ6IFwiZXNtXCIsXHJcbiAgICAgICAgICBuYW1lOiBcIldlYXZ5TGliXCIsXHJcbiAgICAgICAgICBlbnRyeUZpbGVOYW1lczogXCJ3ZWF2eS5qc1wiLFxyXG4gICAgICAgICAgZXhwb3J0czogXCJuYW1lZFwiLFxyXG4gICAgICAgICAgaW5saW5lRHluYW1pY0ltcG9ydHM6IHRydWUsXHJcbiAgICAgICAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgICAgIGdldEJhYmVsT3V0cHV0UGx1Z2luKHtcclxuICAgICAgICAgICAgICBwcmVzZXRzOiBbWydAYmFiZWwvcHJlc2V0LWVudicsIHsgbW9kdWxlczogXCJ1bWRcIiB9XSwgXCJAYmFiZWwvcHJlc2V0LXJlYWN0XCJdLFxyXG4gICAgICAgICAgICAgIG1pbmlmaWVkOiB0cnVlLFxyXG4gICAgICAgICAgICAgIGNvbW1lbnRzOiBmYWxzZSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgZm9ybWF0OiBcImVzXCIsXHJcbiAgICAgICAgICBlbnRyeUZpbGVOYW1lczogXCJ3ZWF2eS5lczUuZXNtLmpzXCIsXHJcbiAgICAgICAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgICAgIGdldEJhYmVsT3V0cHV0UGx1Z2luKHtcclxuICAgICAgICAgICAgICBwcmVzZXRzOiBbWydAYmFiZWwvcHJlc2V0LWVudicsIHsgbW9kdWxlczogXCJhdXRvXCIgfV0sIFwiQGJhYmVsL3ByZXNldC1yZWFjdFwiXSxcclxuICAgICAgICAgICAgICBtaW5pZmllZDogdHJ1ZSxcclxuICAgICAgICAgICAgICBjb21tZW50czogZmFsc2UsXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICB9LCovXHJcbiAgICAgIF0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pO1xyXG4iLCAie1xyXG4gIFwibmFtZVwiOiBcIkB3ZWF2eS91aWtpdC13ZWJcIixcclxuICBcInZlcnNpb25cIjogXCIxLjAuMFwiLFxyXG4gIFwiYXV0aG9yXCI6IFwiV2VhdnlcIixcclxuICBcImRlc2NyaXB0aW9uXCI6IFwiV2ViIGNvbXBvbmVudHMgVUkta2l0IGZvciBXZWF2eVwiLFxyXG4gIFwiaG9tZXBhZ2VcIjogXCJodHRwczovL2dpdGh1Yi5jb20vd2Vhdnkvd2VhdnktdWlraXQtd2ViXCIsXHJcbiAgXCJsaWNlbnNlXCI6IFwiTUlUXCIsXHJcbiAgXCJ0eXBlXCI6IFwibW9kdWxlXCIsXHJcbiAgXCJmaWxlc1wiOiBbXHJcbiAgICBcImNsaVwiLFxyXG4gICAgXCJkaXN0XCIsXHJcbiAgICBcImxpYlwiLFxyXG4gICAgXCJ0ZXN0XCIsXHJcbiAgICBcIiouanNvblwiLFxyXG4gICAgXCIqLm1kXCJcclxuICBdLFxyXG4gIFwibWFpblwiOiBcIi4vZGlzdC93ZWF2eS5qc1wiLFxyXG4gIFwibW9kdWxlXCI6IFwiLi9kaXN0L3dlYXZ5LmVzbS5qc1wiLFxyXG4gIFwidHlwZXNcIjogXCIuL2Rpc3QvdHlwZXMvaW5kZXguZC50c1wiLFxyXG4gIFwiZXhwb3J0c1wiOiB7XHJcbiAgICBcIi5cIjoge1xyXG4gICAgICBcImltcG9ydFwiOiBcIi4vZGlzdC93ZWF2eS5lc20uanNcIixcclxuICAgICAgXCJyZXF1aXJlXCI6IFwiLi9kaXN0L3dlYXZ5LmpzXCIsXHJcbiAgICAgIFwidHlwZXNcIjogXCIuL2Rpc3QvdHlwZXMvaW5kZXguZC50c1wiXHJcbiAgICB9XHJcbiAgfSxcclxuICBcImN1c3RvbUVsZW1lbnRzXCI6IFwiZGlzdC9jdXN0b20tZWxlbWVudHMuanNvblwiLFxyXG4gIFwic2NyaXB0c1wiOiB7XHJcbiAgICBcImNsZWFuXCI6IFwicmltcmFmIGRpc3QvKiovKiAtLWdsb2JcIixcclxuICAgIFwicHJlcGFja1wiOiBcInJ1bi1zIGNsZWFuIGJ1aWxkXCIsXHJcbiAgICBcInByZWJ1aWxkXCI6IFwicnVuLXAgdHlwZXMgbG9jYWxpemUtYnVpbGRcIixcclxuICAgIFwiYnVpbGRcIjogXCJ2aXRlIGJ1aWxkIC0tY29uZmlnIGRldi92aXRlLmNvbmZpZy5qc1wiLFxyXG4gICAgXCJ3YXRjaFwiOiBcInZpdGUgYnVpbGQgLS1jb25maWcgZGV2L3ZpdGUuY29uZmlnLmpzIC0td2F0Y2hcIixcclxuICAgIFwic3RhcnRcIjogXCJydW4tcCBhdXRoIHNlcnZlXCIsXHJcbiAgICBcImF1dGhcIjogXCJub2RlIGNsaS9hdXRoLXNlcnZlci5tanNcIixcclxuICAgIFwic2VydmVcIjogXCJ2aXRlIC0tY29uZmlnIGRldi92aXRlLmNvbmZpZy5qc1wiLFxyXG4gICAgXCJsb2NhbGl6ZS1idWlsZFwiOiBcImxpdC1sb2NhbGl6ZSBidWlsZCAtLWNvbmZpZz1kZXYvbGl0LWxvY2FsaXplLmpzb25cIixcclxuICAgIFwibG9jYWxpemUtZXh0cmFjdFwiOiBcImxpdC1sb2NhbGl6ZSBleHRyYWN0IC0tY29uZmlnPWRldi9saXQtbG9jYWxpemUuanNvblwiLFxyXG4gICAgXCJkb2NzXCI6IFwid2NhIGFuYWx5emUgbGliIC0tZm9ybWF0IG1hcmtkb3duIC0tb3V0RGlyIGRpc3QvZG9jc1wiLFxyXG4gICAgXCJsaW50XCI6IFwiZXNsaW50IGxpYlwiLFxyXG4gICAgXCJ0eXBlc1wiOiBcInRzY1wiLFxyXG4gICAgXCJhbmFseXplXCI6IFwibGl0LWFuYWx5emVyIGxpYi8qKi8qXCIsXHJcbiAgICBcInByZXRlc3RcIjogXCJydW4tcCBsaW50IGFuYWx5emUgdHlwZXNcIixcclxuICAgIFwidGVzdFwiOiBcInJ1bi1wIHdhdGNoIHRlc3Q6d2F0Y2hcIixcclxuICAgIFwicHJldGVzdDpidWlsZFwiOiBcInJ1bi1zIGJ1aWxkXCIsXHJcbiAgICBcInRlc3Q6YnVpbGRcIjogXCJ3ZWItdGVzdC1ydW5uZXIgLS1jb25maWcgZGV2L3dlYi10ZXN0LXJ1bm5lci5jb25maWcubWpzXCIsXHJcbiAgICBcInRlc3Q6d2F0Y2hcIjogXCJ3ZWItdGVzdC1ydW5uZXIgLS1jb25maWcgZGV2L3dlYi10ZXN0LXJ1bm5lci5jb25maWcubWpzIC0td2F0Y2hcIlxyXG4gIH0sXHJcbiAgXCJiaW5cIjoge1xyXG4gICAgXCJ3ZWF2eVwiOiBcIi4vY2xpL3dlYXZ5LWNsaS5tanNcIlxyXG4gIH0sXHJcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xyXG4gICAgXCJAYXRsYXNraXQvZW1iZWRkZWQtY29uZmx1ZW5jZVwiOiBcIl4yLjE0LjBcIixcclxuICAgIFwiQGNvZGVtaXJyb3IvYXV0b2NvbXBsZXRlXCI6IFwiXjYuMTIuMFwiLFxyXG4gICAgXCJAY29kZW1pcnJvci9jb21tYW5kc1wiOiBcIl42LjMuM1wiLFxyXG4gICAgXCJAY29kZW1pcnJvci9sYW5nLW1hcmtkb3duXCI6IFwiXjYuMi40XCIsXHJcbiAgICBcIkBjb2RlbWlycm9yL2xhbmd1YWdlXCI6IFwiXjYuMTAuMVwiLFxyXG4gICAgXCJAY29kZW1pcnJvci9sYW5ndWFnZS1kYXRhXCI6IFwiXjYuNC4xXCIsXHJcbiAgICBcIkBjb2RlbWlycm9yL3N0YXRlXCI6IFwiXjYuNC4wXCIsXHJcbiAgICBcIkBjb2RlbWlycm9yL3ZpZXdcIjogXCJeNi4yNC4wXCIsXHJcbiAgICBcIkBsaXQvY29udGV4dFwiOiBcIl4xLjEuMFwiLFxyXG4gICAgXCJAbGl0L2xvY2FsaXplXCI6IFwiXjAuMTIuMVwiLFxyXG4gICAgXCJAbWF0ZXJpYWwvbWF0ZXJpYWwtY29sb3ItdXRpbGl0aWVzXCI6IFwiXjAuMi43XCIsXHJcbiAgICBcIkBtZGkvanNcIjogXCJeNy40LjQ3XCIsXHJcbiAgICBcIkBtaWNyb3NvZnQvc2lnbmFsclwiOiBcIl43LjAuMTRcIixcclxuICAgIFwiQHBvcHBlcmpzL2NvcmVcIjogXCJeMi4xMS44XCIsXHJcbiAgICBcIkB0YW5zdGFjay9xdWVyeS1jb3JlXCI6IFwiXjUuMjAuMVwiLFxyXG4gICAgXCJAdGFuc3RhY2svcXVlcnktcGVyc2lzdC1jbGllbnQtY29yZVwiOiBcIl41LjIwLjFcIixcclxuICAgIFwiQHRhbnN0YWNrL3F1ZXJ5LXN5bmMtc3RvcmFnZS1wZXJzaXN0ZXJcIjogXCJeNS4yMC4xXCIsXHJcbiAgICBcImRvdGVudlwiOiBcIl4xNi40LjJcIixcclxuICAgIFwibGl0XCI6IFwiXjMuMS4yXCIsXHJcbiAgICBcImxpdC1tb2RhbC1wb3J0YWxcIjogXCJtaW5kcm91dGUvbGl0LW1vZGFsLXBvcnRhbCNkaXN0LXY1XCIsXHJcbiAgICBcImxvZGFzaC50aHJvdHRsZVwiOiBcIl40LjEuMVwiLFxyXG4gICAgXCJwZGZqcy1kaXN0XCI6IFwiXjMuMTEuMTc0XCIsXHJcbiAgICBcInJlYWN0XCI6IFwiXjE2LjE0LjBcIixcclxuICAgIFwicmVhY3QtZG9tXCI6IFwiXjE2LjE0LjBcIlxyXG4gIH0sXHJcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xyXG4gICAgXCJAbGl0L2xvY2FsaXplLXRvb2xzXCI6IFwiXjAuNy4yXCIsXHJcbiAgICBcIkBvcGVuLXdjL3Rlc3RpbmdcIjogXCJeNC4wLjBcIixcclxuICAgIFwiQHRhbnN0YWNrL2VzbGludC1wbHVnaW4tcXVlcnlcIjogXCJeNS4yMC4xXCIsXHJcbiAgICBcIkB0YW5zdGFjay9xdWVyeS1kZXZ0b29sc1wiOiBcIl41LjIwLjFcIixcclxuICAgIFwiQHR5cGVzL2xvZGFzaC50aHJvdHRsZVwiOiBcIl40LjEuOVwiLFxyXG4gICAgXCJAdHlwZXMvbW9jaGFcIjogXCJeMTAuMC42XCIsXHJcbiAgICBcIkB0eXBlcy9yZWFjdFwiOiBcIl4xNi4xNC41N1wiLFxyXG4gICAgXCJAdHlwZXMvcmVhY3QtZG9tXCI6IFwiXjE2LjkuMjRcIixcclxuICAgIFwiQHR5cGVzY3JpcHQtZXNsaW50L2VzbGludC1wbHVnaW5cIjogXCJeNy4xLjBcIixcclxuICAgIFwiQHR5cGVzY3JpcHQtZXNsaW50L3BhcnNlclwiOiBcIl43LjEuMFwiLFxyXG4gICAgXCJAd2ViL3Rlc3QtcnVubmVyXCI6IFwiXjAuMTguMFwiLFxyXG4gICAgXCJjb3JzXCI6IFwiXjIuOC41XCIsXHJcbiAgICBcImVzbGludFwiOiBcIl44LjU2LjBcIixcclxuICAgIFwiZXNsaW50LXBsdWdpbi1saXRcIjogXCJeMS4xMS4wXCIsXHJcbiAgICBcImVzbGludC1wbHVnaW4tbGl0LWExMXlcIjogXCJeNC4xLjJcIixcclxuICAgIFwiZXNsaW50LXBsdWdpbi13Y1wiOiBcIl4yLjAuNFwiLFxyXG4gICAgXCJleHByZXNzXCI6IFwiXjQuMTguMlwiLFxyXG4gICAgXCJsaXQtYW5hbHl6ZXJcIjogXCJeMi4wLjNcIixcclxuICAgIFwibm9kZS1mZXRjaFwiOiBcIl4zLjMuMlwiLFxyXG4gICAgXCJucG0tcnVuLWFsbFwiOiBcIl40LjEuNVwiLFxyXG4gICAgXCJyaW1yYWZcIjogXCJeNS4wLjVcIixcclxuICAgIFwicm9sbHVwLXBsdWdpbi1taW5pZnktaHRtbC1saXRlcmFsc1wiOiBcIl4xLjIuNlwiLFxyXG4gICAgXCJzYXNzXCI6IFwiXjEuNzAuMFwiLFxyXG4gICAgXCJ0cy1saXQtcGx1Z2luXCI6IFwiXjIuMC4yXCIsXHJcbiAgICBcInR5cGVzY3JpcHRcIjogXCJeNS4zLjNcIixcclxuICAgIFwidml0ZVwiOiBcIl41LjEuM1wiLFxyXG4gICAgXCJ2aXRlLXBsdWdpbi1jZW1cIjogXCJeMC42LjBcIixcclxuICAgIFwidml0ZS1wbHVnaW4tZHRzXCI6IFwiXjMuNy4yXCIsXHJcbiAgICBcInZpdGUtcGx1Z2luLW5vZGUtcG9seWZpbGxzXCI6IFwiXjAuMjEuMFwiLFxyXG4gICAgXCJ3ZWItY29tcG9uZW50LWFuYWx5emVyXCI6IFwiXjIuMC4wXCJcclxuICB9XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEwUyxP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QUFPLENBQUMsa0JBQWtCO0FBQUEsTUFDMUIsS0FBSztBQUFBLElBQ1AsQ0FBQztBQUFBLElBQ0QscUJBQXFCO0FBQUEsRUFDdkI7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLG1CQUFtQixLQUFLLFVBQVUsVUFBVTtBQUFBLElBQzVDLGVBQWUsS0FBSyxVQUFVLE9BQU87QUFBQSxJQUNyQyx3QkFBd0IsS0FBSyxVQUFVLFFBQVEsSUFBSSxRQUFRO0FBQUEsRUFDN0Q7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxJQUNWO0FBQUEsSUFDQSxPQUFPO0FBQUEsRUFDVDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsZUFBZTtBQUFBLElBQ2YsU0FBUztBQUFBO0FBQUEsRUFFWDtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsS0FBSztBQUFBO0FBQUEsTUFFSCxPQUFPO0FBQUEsTUFDUCxNQUFNO0FBQUE7QUFBQSxNQUVOLFVBQVU7QUFBQSxJQUNaO0FBQUEsSUFDQSxXQUFXO0FBQUEsSUFDWCxlQUFlO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFLYixTQUFRO0FBQUE7QUFBQTtBQUFBLFFBR04sY0FBYztBQUFBLE1BQ2hCO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTjtBQUFBLFVBQ0UsUUFBUTtBQUFBLFVBQ1IsdUJBQXVCO0FBQUEsVUFDdkIsaUJBQWlCO0FBQUEsVUFDakIsY0FBYztBQUFBLFlBQ1osUUFBUTtBQUFBLGNBQ047QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Y7QUFBQSxZQUNBLE9BQU8sQ0FBQyxTQUFTLFdBQVc7QUFBQSxZQUM1QixPQUFPLENBQUMsWUFBWTtBQUFBLFlBQ3BCLGlCQUFpQixDQUFDLGlCQUFpQjtBQUFBLFVBQ3JDO0FBQUEsVUFDQSxnQkFBZ0I7QUFBQSxRQUNsQjtBQUFBLFFBQ0E7QUFBQSxVQUNFLFFBQVE7QUFBQSxVQUNSLGdCQUFnQjtBQUFBLFVBQ2hCLE1BQU07QUFBQSxVQUNOLFNBQVM7QUFBQSxVQUNULFFBQVE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBV1Y7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BMEJGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJvcHRpb25zIl0KfQo=

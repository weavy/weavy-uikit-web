import { defineConfig, loadEnv } from "vite";
import packageJson from "../package.json";
import fs from "node:fs";
import path from "node:path";
//import { getBabelOutputPlugin } from "@rollup/plugin-babel";
import { utf8BomPlugin, excludeNodeInPdfJS } from "../utils/vite-plugins";
//import minifyHTMLLiterals from 'rollup-plugin-minify-html-literals';
import litCss from "vite-plugin-lit-css";

//process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

const sourceName = process.argv.find((s) => s.startsWith("--source-name="))?.split("=")[1] || packageJson.name;
const version = process.argv.find((s) => s.startsWith("--version="))?.split("=")[1] || packageJson.version;

// https://vitejs.dev/config/

export default defineConfig(({ mode }) => {
  console.log(sourceName, version);

  const env = loadEnv(mode, process.cwd(), "");

  let httpsConfig;

  if (env.HTTPS_PEM_CERT_PATH && env.HTTPS_PEM_KEY_PATH) {
    httpsConfig = {
      key: fs.readFileSync(env.HTTPS_PEM_KEY_PATH),
      cert: fs.readFileSync(env.HTTPS_PEM_CERT_PATH),
    };
  }

  if (env.HTTPS_PFX_PATH) {
    httpsConfig = {
      pfx: fs.readFileSync(env.HTTPS_PFX_PATH),
      passphrase: env.HTTPS_PFX_PASSWORD,
    };
  }

  return {
    publicDir: "public",
    envPrefix: "WEAVY_",
    plugins: [
      excludeNodeInPdfJS(),
      litCss(),
      //weavyImportUrlPlugin(),
    ],
    define: {
      WEAVY_SOURCE_NAME: JSON.stringify(sourceName),
      WEAVY_VERSION: JSON.stringify(version),
      "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV),
    },
    /*optimizeDeps: {
      esbuildOptions: {
        target: "esnext",
      },
    },*/
    resolve: {
      alias: [
        {
          find: "@microsoft/signalr",
          replacement: "@microsoft/signalr/dist/browser/signalr.min.js",
        },
        {
          find: /@lit\/reactive-element$/,
          replacement: path.resolve("./node_modules/@lit/reactive-element/node/reactive-element.js"),
        },
        {
          find: /@lit\/reactive-element\/(.*)/,
          replacement: `${path.resolve("./node_modules/@lit/reactive-element/node")}${path.sep}$1`,
        },
        {
          find: /lit-html$/,
          replacement: path.resolve("./node_modules/lit-html/node/lit-html.js"),
        },
        {
          find: /lit-html\/(.)/,
          replacement: `${path.resolve("./node_modules/lit-html/node")}${path.sep}$1`,
        },
        /*{
          find: "pdfjs-dist",
          replacement: "pdfjs-dist/legacy/build/pdf.mjs",
        },*/
        /*{
          find: /pdfjs-dist$/,
          replacement: path.resolve("./dist/es/pdfjs-dist/legacy/build/pdf.mjs"),
        },
        {
          find: /pdfjs-dist\/(.*)/,
          replacement: `${path.resolve("./node_modules/pdfjs-dist/legacy")}${path.sep}$1`,
        },*/
      ],
    },
    server: {
      /*proxy: {
        "/api": "http://localhost:3001/",
      },*/
      https: httpsConfig,
    },
    esbuild: {
      legalComments: "none",
      charset: "utf8",
      //banner: "\ufeff", // UTF-8 BOM
      //keepNames: true,
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler", // or "modern"
        },
      },
    },
    build: {
      outDir: "dist/build",
      emptyOutDir: false,
      lib: {
        // Could also be a dictionary or array of multiple entry points
        entry: "lib/index.ts",
        name: "WeavyLib",
        // the proper extensions will be added
        fileName: "weavy",
      },
      sourcemap: false,
      rollupOptions: {
        // make sure to externalize deps that shouldn't be bundled
        // into your library
        //external: ["react", "react-dom"],

        plugins: [
          // @ ts-expect-error wrong type
          //minifyHTMLLiterals.default()
          utf8BomPlugin(),
        ],
        output: [
          {
            format: "esm",
            //dir: "dist/build",
            entryFileNames: "weavy.esm.bundle.js",
            minifyInternalExports: false,
            preserveModules: false,
            inlineDynamicImports: true,
          },
          {
            format: "umd",
            entryFileNames: "weavy.js",
            minifyInternalExports: false,
            preserveModules: false,
            inlineDynamicImports: true,
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
          `,
          },
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
        ],
      },
    },
  };
});

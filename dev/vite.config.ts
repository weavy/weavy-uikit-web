import { defineConfig, loadEnv } from "vite";
import packageJson from "../package.json" assert { type: "json" };
import dts from "vite-plugin-dts";
import fs from "fs";
//import { getBabelOutputPlugin } from "@rollup/plugin-babel";
import VitePluginCustomElementsManifest from "vite-plugin-cem";
import { utf8BomPlugin, weavyChunkNames, weavyImportUrlPlugin } from "./vite.plugins";
//import minifyHTMLLiterals from 'rollup-plugin-minify-html-literals';

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

  if (process.env.HTTPS_PFX_PATH) {
    httpsConfig = {
      pfx: fs.readFileSync(env.HTTPS_PFX_PATH),
      passphrase: env.HTTPS_PFX_PASSWORD,
    };
  }

  return {
    publicDir: "public",
    envPrefix: "WEAVY_",
    plugins: [
      dts({
        tsconfigPath: "dev/tsconfig.build.json",
        outDir: "dist/types",
        include: ["lib"],
        entryRoot: "lib",
      }),
      VitePluginCustomElementsManifest({
        files: ["./lib/**/wy-*.ts"],
        lit: true,
      }),
      weavyImportUrlPlugin(),
    ],
    define: {
      WEAVY_SOURCE_NAME: JSON.stringify(sourceName),
      WEAVY_VERSION: JSON.stringify(version),
      "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV),
    },
    optimizeDeps: {
      esbuildOptions: {
        target: "esnext",
      },
    },
    resolve: {
      alias: {
        "@microsoft/signalr": "@microsoft/signalr/dist/browser/signalr.min.js",
      },
    },
    server: {
      proxy: {
        "/api": "http://localhost:3001/",
      },
      https: httpsConfig,
    },
    esbuild: {
      legalComments: "none",
      charset: "utf8",
      //banner: "\ufeff", // UTF-8 BOM
      keepNames: true,
    },
    build: {
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
                "@lezer/markdown",
              ],
              react: ["react", "react-dom"],
              pdfjs: ["pdfjs-dist"],
              "locales/sv-SE": ["./locales/sv-SE"],
            },
            chunkFileNames: weavyChunkNames,
          },
          {
            format: "esm",
            entryFileNames: "weavy.esm.bundle.js",
            minifyInternalExports: false,
            preserveModules: false,
            inlineDynamicImports: true,
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

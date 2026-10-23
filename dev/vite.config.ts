import { defineConfig, loadEnv } from "vite";
import packageJson from "../package.json" with { type: "json" };
import dts from "unplugin-dts/vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
//import { getBabelOutputPlugin } from "@rollup/plugin-babel";
import VitePluginCustomElementsManifest from "vite-plugin-cem";
import {
  checkVersionPrefix,
  utf8BomPlugin,
  weavyAuthServer,
  weavyChunkNames,
  weavyImportUrlPlugin,
  excludeNodeInPdfJS,
} from "../utils/vite-plugins.js";
//import minifyHTMLLiterals from 'rollup-plugin-minify-html-literals';
import litCss from "vite-plugin-lit-css";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fixOverlayInCodemirror } from "../utils/vite-plugins.js";

// CEM Plugins
import { jsdocExamplePlugin } from "cem-plugin-jsdoc-example";

//process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

const sourceName = packageJson.name;
const version = packageJson.version;

checkVersionPrefix(packageJson, fileURLToPath(new URL("..", import.meta.url)));

// https://vitejs.dev/config/

export default defineConfig(({ command, mode }) => {
  console.log(sourceName, version);

  const env = loadEnv(mode, process.cwd(), "");

  const define: Record<string, unknown> = {
    WEAVY_SOURCE_NAME: JSON.stringify(sourceName),
    WEAVY_VERSION: JSON.stringify(version),
    "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV),
  };

  if (command === "serve") {
    define.WEAVY_SOURCE_FORMAT = `undefined`;
    define.WEAVY_IMPORT_URL = `"/dist/"`;
  }

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
      fixOverlayInCodemirror(),
      dts({
        tsconfigPath: "dev/tsconfig.build.json",
        outDirs: "dist/types",
        include: ["lib"],
        entryRoot: "lib",
      }),
      // https://github.com/Kamiapp-fr/vite-plugin-cem
      VitePluginCustomElementsManifest({
        files: ["./lib/classes/*.ts", "./lib/**/wy-*.ts"],
        lit: true,
        output: "../custom-elements.json",
        plugins: [
          // https://custom-elements-manifest.open-wc.org/analyzer/plugins/intro/
          jsdocExamplePlugin(),
        ],
      }),
      viteStaticCopy({
        targets: [
          {
            src: "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
            dest: "pdfjs",
            rename: { stripBase: true }
          },
          {
            src: "node_modules/pdfjs-dist/cmaps/*.bcmap",
            dest: "pdfjs/cmaps",
            rename: { stripBase: true }
          },
          {
            src: "node_modules/pdfjs-dist/iccs/*.icc",
            dest: "pdfjs/iccs",
            rename: { stripBase: true }
          },
          {
            src: "node_modules/pdfjs-dist/standard_fonts/*.@(pfb|ttf)",
            dest: "pdfjs/fonts",
            rename: { stripBase: true }
          },
          {
            src: "node_modules/pdfjs-dist/wasm/*.wasm",
            dest: "pdfjs/wasm",
            rename: { stripBase: true }
          },
        ],
      }),
      weavyImportUrlPlugin(),
      litCss(),
      weavyAuthServer(command),
    ],
    define,
    optimizeDeps: {
      // Needed for web test runner to work
      exclude: ['/__web-dev-server__web-socket.js'],
      rolldownOptions: {
        transform: {
          target: "esnext",
        },
        output: {
          keepNames: true,
        },
      },
    },
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
      ],
    },
    server: {
      /*proxy: {
        "/api": "http://localhost:3001/",
      },*/
      https: httpsConfig,
    },
    build: {
      outDir: "dist",
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
            dir: "dist/build",
            minifyInternalExports: false,
            preserveModules: false,
            intro: `const WEAVY_SOURCE_FORMAT = "esm/dynamic";`,
            codeSplitting: {
              groups: [
                {
                  name: "editor",
                  test: (id: string) =>
                    [
                      "/lib/utils/editor/editor.ts",
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
                    ].some((searchId) => id.includes(searchId)),
                },
                {
                  name: "pdfjs",
                  test: "pdfjs-dist",
                },
                {
                  name: "locales/sv-SE",
                  test: "./locales/sv-SE",
                },
                /* {
                  name "tools": 
                  test: "@tanstack/query-devtools"
                }*/
              ],
            },
            chunkFileNames: weavyChunkNames,
          },
        ],
      },
    },
  };
});

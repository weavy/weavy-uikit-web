import "dotenv/config";
import { PluginOption, defineConfig } from "vite";
import packageJson from "../package.json" assert { type: "json" };
import dts from "vite-plugin-dts";
import fs from "fs";
//import { getBabelOutputPlugin } from "@rollup/plugin-babel";
import VitePluginCustomElementsManifest from "vite-plugin-cem";
//import minifyHTMLLiterals from 'rollup-plugin-minify-html-literals';

//process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

const sourceName = process.argv.find((s) => s.startsWith("--source-name="))?.split("=")[1] || packageJson.name;
const version = process.argv.find((s) => s.startsWith("--version="))?.split("=")[1] || packageJson.version;

console.log(sourceName, version);

let httpsConfig;

if (process.env.HTTPS_PEM_CERT_PATH && process.env.HTTPS_PEM_KEY_PATH) {
  httpsConfig = {
    key: fs.readFileSync(process.env.HTTPS_PEM_KEY_PATH),
    cert: fs.readFileSync(process.env.HTTPS_PEM_CERT_PATH),
  };
}

if (process.env.HTTPS_PFX_PATH) {
  httpsConfig = {
    pfx: fs.readFileSync(process.env.HTTPS_PFX_PATH),
    passphrase: process.env.HTTPS_PFX_PASSWORD,
  };
}

function weavyImportUrlPlugin() {
  const options: PluginOption = {
    name: "weavy-import-url",
    renderDynamicImport({
      //customResolution,
      //format,
      //moduleId,
      targetModuleId,
    }) {
      if (targetModuleId && this.getModuleInfo(targetModuleId)?.isExternal) {
        return {
          left: "import(",
          right: ")",
        };
      } else {
        return {
          left: `import(/* webpackIgnore: true */ /* @vite-ignore */ new URL(`,
          right: `, typeof WEAVY_IMPORT_URL === "string" && (!import.meta.url || !(new URL(import.meta.url).href.startsWith(WEAVY_IMPORT_URL))) ? WEAVY_IMPORT_URL : import.meta.url).href)`,
        };
      }
    },
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
  let name: String;
  if (chunkInfo.facadeModuleId) {
    name = chunkInfo.facadeModuleId.split("node_modules/")[1];
  } else if (chunkInfo.moduleIds.length === 1) {
    name = chunkInfo.moduleIds[0].split("node_modules/")[1];
  } else {
    //name = `${chunkInfo.isDynamicEntry ? "dynamic/" : ""}[name]`;
    name = `[name]`;
  }

  if (name?.includes("?")) {
    name = name.split("?")[0];
  }

  if (name?.endsWith(".js")) {
    name = name.slice(0, -1 * ".js".length);
  }
  //return `esm/${chunkInfo.isDynamicEntry ? "dynamic/" : ""}${name}.js`;
  return `[format]/${name}.${chunkInfo.format === "cjs" ? "cjs" : "js"}`;
}

function utf8BomPlugin() {
  const options: PluginOption = {
    name: "utf-8-bom",
    generateBundle(options, bundle, _isWrite) {
      Object.keys(bundle).forEach((chunkId) => {
        const chunk = bundle[chunkId];
        // @ts-expect-error chunk type
        if (typeof chunk.code === "string") {
          // @ts-expect-error chunk type
          if (!chunk.code.startsWith("\ufeff")) {
            // @ts-expect-error chunk type
            chunk.code = "\ufeff" + chunk.code;
          }
        }
      });
    },
  };

  return options;
}

// https://vitejs.dev/config/

export default defineConfig({
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
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
  },
  resolve: {
    alias: {
      "@microsoft/signalr": "@microsoft/signalr/dist/browser/signalr.min.js"
    }
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
});

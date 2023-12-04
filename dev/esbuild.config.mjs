import { sassPlugin } from "esbuild-sass-plugin";
import packageJson from "../package.json" assert { type: "json" };

const sourceName = process.argv.find((s) => s.startsWith("--source-name="))?.split("=")[1] || packageJson.name;
const version = process.argv.find((s) => s.startsWith("--version="))?.split("=")[1] || packageJson.version;

console.log(sourceName, version);

export const esbuildConfig = {
  entryPoints: [{ in: "src/index.ts", out: "weavy.esm" }, "locales/*.ts"],
  outdir: "dist",
  outbase: ".",
  format: "esm",
  platform: "browser",
  charset: "utf8",
  banner: { js: "\ufeff" },
  bundle: true,
  minify: true,
  sourcemap: true,
  metafile: false,
  splitting: false,
  chunkNames: "libs/[name]-[hash]",
  plugins: [
    sassPlugin({
      type: "lit-css",
    }),
  ],
  resolveExtensions: [".ts", ".js", ".scss"],
  legalComments: "none",
  define: {
    WEAVY_SOURCE_NAME: `'${sourceName}'`,
    WEAVY_VERSION: `'${version}'`,
  },
  alias: {
    //'lit-element/lit-element.js': 'lit-element',
  },
  external: [
    //"@codemirror/legacy-modes"
  ],
};

export const esbuildConfigESM = {
  ...esbuildConfig,
  format: "esm",
  bundle: true,
  minify: true,
  sourcemap: false,
  metafile: true,
  //drop: ["console"],
  pure: ["console.log", "console.debug"],
};

export const esbuildConfigIIFE = {
  ...esbuildConfig,
  entryPoints: [{ in: "src/index.ts", out: "weavy.iife" }],
  format: "iife",
  globalName: "WeavyLib",
  bundle: true,
  minify: true,
  sourcemap: false,
  metafile: false,
  //drop: ["console"],
  pure: ["console.log", "console.debug"],
  footer: {
    js: `var { Weavy, WyContext, WyChat, WyFiles, WyMessenger, WyPosts } = WeavyLib;`
  }
};

export const esbuildConfigUMD = {
  ...esbuildConfig,
  entryPoints: [{ in: "src/index.ts", out: "weavy" }],
  format: "iife",
  bundle: true,
  minify: true,
  sourcemap: true,
  metafile: false,
  //drop: ["console"],
  pure: ["console.log", "console.debug"],
  banner: { js: `\ufeff(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
      define(factory);
    } else if (typeof module === 'object' && module.exports) {
      module.exports = factory();
    } else {
      const WeavyLib = factory();
      root.WeavyLib = WeavyLib;
      for (const exportName in WeavyLib) {
        if (exportName !== "default") {
          root[exportName] = WeavyLib[exportName];
        }
      }

    }
  }(typeof self !== 'undefined' ? self : this, () => {` },
  globalName: "WeavyLib",
  footer: { 
    js: `return WeavyLib;
    }));`
  }
};

export const esbuildTestingConfig = {
  ...esbuildConfig,
  minify: false,
  sourcemap: false,
  metafile: false,
};

export const esbuildDevelopmentConfig = {
  ...esbuildConfig,
  entryPoints: [...esbuildConfig.entryPoints, "dev/tools/tanstack-dev-tools.ts", "src/scss/variables.scss"],
  minify: false,
  sourcemap: true,
  metafile: false,
  //drop: [],
};

export default esbuildConfig;

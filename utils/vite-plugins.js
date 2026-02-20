import { getServerConfig, getUsers, getAuthServer, syncUsers } from "./auth-server.js";

export function weavyImportUrlPlugin() {
  const options = {
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
          right: `, typeof WEAVY_IMPORT_URL === "string" && (!import.meta.url || !(new URL(import.meta.url).href.startsWith(WEAVY_IMPORT_URL))) ? new URL(WEAVY_IMPORT_URL, globalThis.location.href) : import.meta.url).href)`,
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

export function weavyChunkNames(chunkInfo) {
  let name;
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

  /*if (name?.endsWith(".mjs")) {
    name = name.slice(0, -1 * ".mjs".length);
  }*/

  if (!name && chunkInfo.name === "__vite-browser-external") {
    name = "empty-polyfills";
  }

  //return `esm/${chunkInfo.isDynamicEntry ? "dynamic/" : ""}${name}.js`;
  
  //return `[format]/${name}.${chunkInfo.format === "cjs" ? "cjs" : "js"}`;
  return `[format]/${name}-[hash].${chunkInfo.format === "cjs" ? "cjs" : "js"}`;
}

export function utf8BomPlugin() {
  const options = {
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

export function weavyAuthServer(command = "serve") {
  const apiProxy = {
    "/api": {}, // proxy our /api route to nowhere
  };

  return command === "serve"
    ? {
        name: "weavy-auth-server",
        config() {
          return {
            server: { proxy: apiProxy },
            preview: { proxy: apiProxy },
          };
        },
        configureServer(server) {
          const serverConfig = getServerConfig();
          const users = getUsers();
          const authServer = getAuthServer(serverConfig, users);
          server.middlewares.use(authServer);
          syncUsers(serverConfig, users);
        },
      }
    : undefined;
}

/**
 * Explicitly sets `isNodeJS = true` in pdf.mjs, which enables treeshaking of all node specific stuff.
 * @type 
 */
export function excludeNodeInPdfJS() {
  const fileRegex = /pdfjs-dist\/.*\/pdf\.mjs$/;
  return {
    name: "fix-pdfjs",
    transform(src, id) {
      if (fileRegex.test(id)) {
        const isNodeRegex = /const isNodeJS = (.*);/;
        return {
          code: src.replace(isNodeRegex, "const isNodeJS = false;"),
          map: null, // provide source map if available
        };
      }
    },
  };
}

export function removeImportMetaUrl() {
  return {
    name: "remove-import-meta-url",

    transform(src, _id) {
      return {
        code: src.replace("import.meta.url", "undefined"),
        map: null, // provide source map if available
      };
    },
  };
}
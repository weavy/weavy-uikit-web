import { PluginOption } from "vite";

//process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

export function weavyImportUrlPlugin() {
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

export function weavyChunkNames(chunkInfo) {
  let name: string;
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

  //return `esm/${chunkInfo.isDynamicEntry ? "dynamic/" : ""}${name}.js`;
  return `[format]/${name}.${chunkInfo.format === "cjs" ? "cjs" : "js"}`;
}

export function utf8BomPlugin() {
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
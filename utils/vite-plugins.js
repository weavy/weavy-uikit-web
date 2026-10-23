import { getServerConfig, getUsers, getAuthServer, syncUsers } from "./auth-server.js";
import MagicString from "magic-string";
import fs from "node:fs";
import path from "node:path";

/**
 * Ensures that the package.json version matches `<VersionPrefix>` in the monorepo `Directory.Build.props`.
 *
 * The UI kits bake their package.json version into `WEAVY_VERSION`, which is compared against the version of the
 * Weavy environment. VersionPrefix is the source of truth, and the SetVersion target in weavy.proj updates it together
 * with the package.json files. This guard catches a manual edit of either one so a local build never reports a mismatch.
 *
 * The props file is looked up at a fixed path two levels above the package root (`frontend/<package>` in the monorepo),
 * so the public repos, npm packages and dumps in `artifacts/repos/<package>` have no props file and skip the check.
 *
 * Example of the parsed `Directory.Build.props`:
 * ```xml
 * <Project>
 *   <PropertyGroup>
 *     <VersionPrefix>33.0.0</VersionPrefix>
 *   </PropertyGroup>
 * </Project>
 * ```
 *
 * @param {{ name: string, version: string }} packageJson - The package.json of the package being built.
 * @param {string} packageRoot - The root folder of the package being built.
 * @throws {Error} When the package.json version differs from VersionPrefix.
 */
export function checkVersionPrefix(packageJson, packageRoot) {
  const propsPath = path.resolve(packageRoot, "../../Directory.Build.props");
  if (!fs.existsSync(propsPath)) {
    return;
  }

  const versionPrefix = /<VersionPrefix>\s*([^<\s]+)\s*<\/VersionPrefix>/.exec(fs.readFileSync(propsPath, "utf8"))?.[1];
  if (versionPrefix && versionPrefix !== packageJson.version) {
    throw new Error(
      `${packageJson.name} version ${packageJson.version} does not match VersionPrefix ${versionPrefix} in ${propsPath}. Run \`dotnet build -t:SetVersion\` in the repository root.`,
    );
  }
}

/**
 * 
 * @returns {import("vite").Plugin}
 */
export function weavyImportUrlPlugin() {
  return {
    name: "weavy-import-url",
    renderChunk(code) {
      // Fast path: skip if there are no dynamic imports
      if (typeof code !== "string" || !code.includes("import(")) return null;

      const ms = new MagicString(code);
      
      // Matches static dynamic imports like import("./chunk-XYZ.js")
      const importRegex = /\bimport\((['"`])([^'"`]+)\1\)/g;
      let match;
      let hasReplacements = false;

      while ((match = importRegex.exec(code)) !== null) {
        const fullMatch = match[0];
        const quote = match[1];
        const importPath = match[2];

        // Heuristic for external dependencies:
        // Vite/Rolldown internal chunks are always output as relative paths ('./' or '../').
        // Bare specifiers (e.g., 'react') or absolute URLs are external.
        const isExternal = !importPath.startsWith(".") && !importPath.startsWith("/");

        if (!isExternal) {
          const start = match.index;
          const end = start + fullMatch.length;

          // Replicate the original 'left' and 'right' wrapping
          const replacement = `import(/* webpackIgnore: true */ /* @vite-ignore */ new URL(${quote}${importPath}${quote}, typeof WEAVY_IMPORT_URL === "string" && (!import.meta.url || !(new URL(import.meta.url).href.startsWith(WEAVY_IMPORT_URL))) ? new URL(WEAVY_IMPORT_URL, globalThis.location.href) : import.meta.url).href)`;

          ms.overwrite(start, end, replacement);
          hasReplacements = true;
        }
      }

      if (!hasReplacements) return null;

      return {
        code: ms.toString(),
        map: ms.generateMap({ hires: true }),
      };
    },
  };
}

/**
 * 
 * @param {import("rollup").PreRenderedChunk} chunkInfo 
 * @returns {string}
 */
export function weavyChunkNames(chunkInfo) {
  let name;
  if (chunkInfo.facadeModuleId) {
    name = chunkInfo.facadeModuleId.split("node_modules/")[1];
  } else if (chunkInfo.moduleIds && chunkInfo.moduleIds.length === 1) {
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

  if (!name && chunkInfo.name === "__vite-browser-external") {
    name = "empty-polyfills";
  }

  return `[format]/${name}-[hash].${chunkInfo.format === "cjs" ? "cjs" : "js"}`;
}

/**
 * 
 * @returns {import("vite").Plugin}
 */
export function utf8BomPlugin() {
  return {
    name: "utf-8-bom",
    generateBundle(options, bundle, _isWrite) {
      Object.keys(bundle).forEach((chunkId) => {
        const chunk = bundle[chunkId];
        if (typeof chunk.code === "string") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          if (!chunk.code.startsWith("\ufeff")) {
            chunk.code = "\ufeff" + chunk.code;
          }
        }
      });
    },
  };
}

// Shared across vite's in-process restarts, see configureServer below. Symbol.for() so that the
// key is the same even though this module is re-evaluated by every restart.
const AUTH_SERVER_KEY = Symbol.for("weavy.vite.authServer");

export function weavyAuthServer(command = "serve") {
  // The auth server runs as a standalone HTTP server that vite proxies /api to.
  // It must NOT be mounted as vite middleware: with server.https, vite (>= 7.2) always
  // serves HTTP/2 (see resolveHttpServer in vite/src/node/http.ts), and connect/express
  // middlewares crash on Http2ServerRequest objects. Proxying keeps express on plain
  // HTTP/1.1 regardless of how vite serves the pages.
  const authPort = process.env.WEAVY_AUTH_PORT || 3001;
  const apiProxy = {
    "/api": { target: `http://localhost:${authPort}` },
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
        /**
         *
         * @param {import("vite").ViteDevServer} server
         */
        async configureServer(server) {
          // vite restarts itself in-process whenever the config, its imports, .env files or
          // package.json change. Each restart re-bundles and re-evaluates the config, so this
          // module (and any module-level state) is a fresh copy every time; only globalThis
          // survives. Without this bookkeeping the new listener raced the previous one for the
          // port: `listener.close()` from the old httpServer's "close" handler only stops
          // accepting connections and releases the port asynchronously (after keep-alive
          // connections have ended), so the new `listen()` failed with an unhandled
          // `EADDRINUSE` error event and the whole vite process exited, taking the token
          // endpoint with it. The previous listener is therefore kept on globalThis and
          // awaited to be fully closed before listening again.
          const registry = /** @type {Record<symbol, { close: () => Promise<void> } | undefined>} */ (
            /** @type {unknown} */ (globalThis)
          );
          const previous = registry[AUTH_SERVER_KEY];
          if (previous) {
            await previous.close();
          }

          const serverConfig = getServerConfig();
          const users = getUsers();
          const authServer = getAuthServer(serverConfig, users);
          const listener = authServer.listen(authPort);

          // A port conflict (typically another uikit-web/uikit-react dev server, or a stray
          // `node utils/auth-server.js`) must not crash vite: report it and keep serving the
          // pages, the /api proxy then fails per request instead.
          listener.on("error", (error) => {
            console.error(
              `[weavy-auth-server] could not listen on port ${authPort} (${error.code ?? error.message}). ` +
                `Is another dev server running? Set WEAVY_AUTH_PORT to use a different port.`
            );
          });

          // `closeAllConnections()` drops idle and active keep-alive connections, otherwise
          // `close()` waits for the browser to end them, which can take a long time.
          /** @type {Promise<void> | undefined} */
          let whenClosed;
          const close = () => {
            whenClosed ??= new Promise((resolve) => {
              listener.closeAllConnections();
              listener.close(() => resolve());
            });
            return whenClosed;
          };

          registry[AUTH_SERVER_KEY] = { close };

          // vite restarts (config change, ctrl+c) close the http server; follow suit so
          // the port is free for the next instance. The promise is memoized, so the next
          // configureServer awaits this same close instead of racing it.
          server.httpServer?.on("close", () => void close());
          void syncUsers(serverConfig, users);
        },
      }
    : undefined;
}

/**
 * Explicitly sets `isNodeJS = true` in pdf.mjs, which enables treeshaking of all node specific stuff.
 * @returns {import("vite").Plugin}
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

/**
 * 
 * @returns {import("vite").Plugin}
 */
export function removeImportMetaUrl() {
  return {
    name: "remove-import-meta-url",

    transform(src, _id) {
      return {
        code: src.replaceAll("import.meta.url", "undefined"),
        map: null, // provide source map if available
      };
    },
  };
}

/**
 * Fixes invalid scroll area (boundary) when codemirror is placed in a `top-layer` dialog.
 * 
 * The top-layer is the same size as the browser window, but codemirror incorrectly uses the size of the node where the dialog is placed (if it has `overflow: scroll` or similar).
 * 
 * Patches `function visiblePixelRange(dom, paddingTop)` by returning when codemirror is in an overlay. 
 * @returns {import("vite").Plugin}
 */
export function fixOverlayInCodemirror() {
  const fileContentFind = "function visiblePixelRange(dom, paddingTop)";
  return {
    name: "fix-codemirror",
    transform(src, id) {
      if (src.includes(fileContentFind)) {
        console.log("\nApplying codemirror top-layer/overlay fix for:", id);
        const styleRow = `let style = window.getComputedStyle(parent);`;

        const topLayerFix = `
          const isOverlay =
              parent instanceof HTMLElement && (
                parent.localName === "wy-overlay" ||
                parent.popover ||
                style.position === "fixed" ||
                style.overlay === "auto"
              );
          if (isOverlay) { break; };
        `;

        if (!src.includes(styleRow)) {
          throw new Error("vite plugin fixOverlayInCodemirror(): Could not apply Codemirror overlay fix! Maybe it has changed or been fixed?");
        }

        return {
          code: src.replace(styleRow, styleRow + topLayerFix),
          map: null, // provide source map if available
        };
      }
    },
  };
}

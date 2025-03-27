import { ProxyOptions, ViteDevServer } from "vite";
import type { PreRenderedChunk } from "rollup/dist/rollup.js";
export declare function weavyImportUrlPlugin(): import("vite").Plugin;
export declare function weavyChunkNames(chunkInfo: PreRenderedChunk): string;
export declare function utf8BomPlugin(): import("vite").Plugin;
export declare function weavyAuthServer(command: "build" | "serve" = "serve"): {
    name: string;
    config(): {
        server: {
            proxy: Record<string, string | ProxyOptions>;
        };
        preview: {
            proxy: Record<string, string | ProxyOptions>;
        };
    };
    configureServer(server: ViteDevServer): void;
} | undefined;
export declare function excludeNodeInPdfJS(): import("vite").Plugin;
export declare function removeImportMetaUrl(): import("vite").Plugin;

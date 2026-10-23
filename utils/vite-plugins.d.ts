export declare function checkVersionPrefix(packageJson: { name: string; version: string }, packageRoot: string): void;
export declare function weavyImportUrlPlugin(): import("vite").Plugin;
export declare function weavyChunkNames(chunkInfo: any): string;
export declare function utf8BomPlugin(): import("vite").Plugin;
export declare function weavyAuthServer(command: "build" | "serve"): {
    name: string;
    config(): {
        server: {
            proxy: Record<string, string | import("vite").ProxyOptions>;
        };
        preview: {
            proxy: Record<string, string | import("vite").ProxyOptions>;
        };
    };
    configureServer(server: import("vite").ViteDevServer): Promise<void>;
} | undefined;
export declare function excludeNodeInPdfJS(): import("vite").Plugin;
export declare function removeImportMetaUrl(): import("vite").Plugin;
export declare function fixOverlayInCodemirror(): import("vite").Plugin;

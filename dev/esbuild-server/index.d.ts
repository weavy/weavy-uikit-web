/// <reference types="node" />
import { ServerOptions as HttpServerOptions, IncomingMessage } from 'http';
import { ServerOptions as HttpsServerOptions } from 'https';
import { BuildOptions } from 'esbuild';
export declare type ProxyRewriteFunction = (path: string) => string | undefined | null | void;
export declare type ServerOptions = {
    static?: string;
    port?: number;
    historyApiFallback?: boolean;
    injectLiveReload?: boolean;
    open?: boolean | string;
    proxy?: ProxyRewriteFunction | Record<string, string>;
    onProxyRewrite?: (proxyRes: IncomingMessage, localUrl: string, proxyUrl: string) => IncomingMessage;
    http?: HttpServerOptions;
    https?: HttpsServerOptions;
};
export declare function createServer(buildOptions?: BuildOptions, serverOptions?: ServerOptions): {
    start: () => Promise<void>;
    stop: () => void;
    url: string;
};
export default createServer;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = void 0;
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
const esbuild_1 = require("esbuild");
const mime_1 = require("./mime.cjs");
const openUrl_1 = require("./openUrl.cjs");
const LIVE_RELOAD_SCRIPT_PATH = path_1.default.join(__dirname, 'livereload.js');
const injectScript = (html, scriptSource) => {
    const bodyEndPosition = html.lastIndexOf('</body>');
    const injectPosition = bodyEndPosition === -1 ? html.length : bodyEndPosition;
    return (html.substring(0, injectPosition) +
        `<script>${scriptSource}</script>\n` +
        html.substring(injectPosition));
};
function createProxyRewriter(proxy) {
    if (typeof proxy === 'function') {
        return proxy;
    }
    else if (proxy !== null &&
        typeof proxy === 'object' &&
        Object.keys(proxy).length !== 0) {
        const keys = Object.keys(proxy);
        return (path) => {
            for (const key of keys) {
                if (path.startsWith(key)) {
                    return proxy[key] + path;
                }
            }
            return null;
        };
    }
    return () => null;
}
function createServerSentEventHandler() {
    const listeners = new Set();
    const setupConnection = (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });
        listeners.add(res);
        req.on('close', () => {
            listeners.delete(res);
        });
    };
    const sendMessage = (data) => {
        listeners.forEach((res) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        });
    };
    return { setupConnection, sendMessage };
}
function createServer(buildOptions = {}, serverOptions = {}) {
    const { historyApiFallback = false, host = "localhost", port = 8080, injectLiveReload = true, open = false, proxy, onProxyRewrite = (proxyRes) => proxyRes, onSendHtml } = serverOptions;
    const serverUrl = `${serverOptions.https ? "https" : "http"}://${host}:${port}`;
    const buildDir = path_1.default.resolve(buildOptions.outfile
        ? path_1.default.dirname(buildOptions.outfile)
        : buildOptions.outdir ??
            fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'esbuild-')));
    const staticDirs = [buildDir];
    const staticDir = serverOptions.static && path_1.default.resolve(serverOptions.static);
    if (staticDir) {
        staticDirs.push(staticDir);
    }
    let buildStart = Date.now();
    let buildResolver = () => { };
    let buildPromise = Promise.resolve();
    const buildListeners = createServerSentEventHandler();
    const proxyRewrite = createProxyRewriter(proxy);
    const buildStatusPlugin = {
        name: 'build-status',
        setup(build) {
            build.onStart(() => {
                buildStart = Date.now();
                buildPromise = new Promise((resolve) => {
                    buildResolver = resolve;
                });
                buildListeners.sendMessage({ type: 'build-start' });
            });
            build.onEnd((result) => {
                const duration = Date.now() - buildStart;
                buildStart = -1;
                buildResolver();
                const success = result.errors.length === 0;
                buildListeners.sendMessage({ type: 'build-end', duration, success });
            });
        },
    };
    function sendHtml(res, html, status = 200) {
        html = injectLiveReload
            ? injectScript(html, fs_1.default.readFileSync(LIVE_RELOAD_SCRIPT_PATH, { encoding: 'utf8' }))
            : html;
        html = onSendHtml && typeof onSendHtml === "function"
            ? onSendHtml(html, status)
            : html;
        res.writeHead(status, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': Buffer.byteLength(html),
            'Cache-Control': 'no-store, must-revalidate',
        });
        return res.end(html);
    }
    async function sendFile(res, filePath) {
        const file = await fs_1.default.promises.open(filePath, 'r');
        try {
            const stat = await file.stat();
            if (!stat.isFile()) {
                const err = new Error('Path is directory');
                err.code = 'EISDIR';
                throw err;
            }
            const contentType = (0, mime_1.getMimeType)(filePath);
            if (contentType === 'text/html') {
                // Treat html differently so we can inject livereload script
                const html = await file.readFile({ encoding: 'utf8' });
                file.close();
                return sendHtml(res, html);
            }
            const headers = {
                'Content-Length': stat.size,
                'Cache-Control': 'no-store, must-revalidate',
            };
            if (contentType) {
                headers['Content-Type'] = contentType;
            }
            res.writeHead(200, headers);
            // @ts-ignore – for some reason the types doesn't include this one
            const readStream = file.createReadStream({ autoClose: true });
            readStream.pipe(res, { end: true });
            readStream.on('close', () => {
                file.close();
            });
        }
        catch (err) {
            file.close();
            throw err;
        }
    }
    const handler = async (req, res) => {
        const url = new url_1.URL(`${serverUrl}${req.url}`);
        switch (url.pathname) {
            case '/esbuild-livereload': {
                return buildListeners.setupConnection(req, res);
            }
            case '/esbuild-livereload.js': {
                return await sendFile(res, LIVE_RELOAD_SCRIPT_PATH);
            }
        }
        const rewrite = proxyRewrite(req.url);
        if (rewrite) {
            const target = new url_1.URL(rewrite);
            if (target.protocol !== 'http:' && target.protocol !== 'https:') {
                throw new Error('Proxy rewrites must return an absolute http/https URL');
            }
            const request = target.protocol === 'http:' ? http_1.default.request : https_1.default.request;
            return req.pipe(request(rewrite, {
                method: req.method,
                headers: { ...req.headers, host: target.host },
            }, (proxyRes) => {
                const finalRes = onProxyRewrite(proxyRes, req.url, rewrite);
                res.writeHead(finalRes.statusCode, finalRes.headers);
                finalRes.pipe(res, { end: true });
            }), { end: true }).on('error', (err) => {
                const msg = `Error connecting to the proxy via ${rewrite}`;
                console.error(msg, err);
                res.writeHead(502, { 'Content-Type': 'text/plain' }).end(msg);
            });
        }
        // Stall request while rebuilding to not serve stale files
        if (buildStart !== -1) {
            await buildPromise;
        }
        // Attempt to serve file from build or static directory
        for (const dir of staticDirs) {
            const staticFilePath = path_1.default.normalize(path_1.default.join(dir, url.pathname === '/' ? 'index.html' : url.pathname));
            if (staticFilePath.startsWith(dir)) {
                try {
                    return await sendFile(res, staticFilePath);
                }
                catch (err) {
                    if (err.code !== 'ENOENT' && err.code !== 'EISDIR') {
                        throw err;
                    }
                }
            }
        }
        if (historyApiFallback && staticDir && path_1.default.extname(url.pathname) === '') {
            try {
                return await sendFile(res, path_1.default.join(staticDir, 'index.html'));
            }
            catch (err) {
                if (err.code !== 'ENOENT') {
                    throw err;
                }
            }
        }
        sendHtml(res, '<h1>Not found</h1>', 404);
    };
    const server = serverOptions.https ? https_1.default.createServer(serverOptions.https, handler) : http_1.default.createServer(serverOptions.http ?? {}, handler);
    let stopped = false;
    let ctx;
    const start = async () => {
        server.listen({port, host});
        ctx = await (0, esbuild_1.context)({
            outdir: !buildOptions.outdir && !buildOptions.outfile ? buildDir : undefined,
            ...buildOptions,
            plugins: (buildOptions.plugins ?? []).concat(buildStatusPlugin),
        });
        if (!stopped) {
            await ctx.watch();
        }
        if (open) {
            (0, openUrl_1.openUrl)(`${serverUrl}${typeof open === 'string' ? open : '/'}`);
        }
    };
    const stop = () => {
        stopped = true;
        server.close();
        if (ctx) {
            ctx.cancel();
        }
    };
    return { start, stop, url: serverUrl };
}
exports.createServer = createServer;
exports.default = createServer;

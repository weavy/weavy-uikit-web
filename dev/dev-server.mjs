import "dotenv/config";
import { esbuildDevelopmentConfig } from "./esbuild.config.mjs";
import { createServer } from "./esbuild-server/index.cjs";

const server = createServer(esbuildDevelopmentConfig, {
  port: 8000,
  static: "./demo",
  proxy: (path) => {
    if (path.startsWith("/api")) {
      return path.replace(/^\/api/, "http://localhost:3001");
    }
  },
  onSendHtml: (html) => {
    html = html.replace("{WEAVY_URL}", process.env.WEAVY_URL);
    html = html.replace("{ZOOM_AUTH_URL}", process.env.ZOOM_AUTH_URL);
    return html;
  },
  open: true,
});

await server.start();

console.log(`Development server running at ${server.url}/`);

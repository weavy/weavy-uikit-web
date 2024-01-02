import "dotenv/config";
import { esbuildDevelopmentConfig } from "./esbuild.config.mjs";
import { createServer } from "./esbuild-server/index.cjs";
import fs from "fs";

let httpsConfig;

if (process.env.HTTPS_PEM_CERT_PATH && process.env.HTTPS_PEM_KEY_PATH) {
  httpsConfig = {
    key: fs.readFileSync(process.env.HTTPS_PEM_KEY_PATH),
    cert: fs.readFileSync(process.env.HTTPS_PEM_CERT_PATH),
  }
}

if (process.env.HTTPS_PFX_PATH) {
  httpsConfig = {
    pfx: fs.readFileSync(process.env.HTTPS_PFX_PATH),
    passphrase: process.env.HTTPS_PFX_PASSWORD
  }
}


const server = createServer(esbuildDevelopmentConfig, {
  host: process.env.HOSTNAME || 'localhost',
  port: 8000,
  static: "./demo",
  proxy: (path) => {
    if (path.startsWith("/api")) {
      return path.replace(/^\/api/, "http://localhost:3001/api");
    }
  },
  onSendHtml: (html) => {
    html = html.replace("{WEAVY_URL}", process.env.WEAVY_URL);
    html = html.replace("{ZOOM_AUTH_URL}", process.env.ZOOM_AUTH_URL);
    return html;
  },
  open: true,
  https: httpsConfig
});

await server.start();

console.log(`Development server running at ${server.url}/`);

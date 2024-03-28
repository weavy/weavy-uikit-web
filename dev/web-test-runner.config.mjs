import packageJson from "../package.json" assert { type: "json" };
import { vitePlugin } from '@remcovaes/web-test-runner-vite-plugin';

const version = process.argv.find((s) => s.startsWith("--version="))?.split("=")[1] || packageJson.version;
const sourceName = process.argv.find((s) => s.startsWith("--source-name="))?.split("=")[1] || packageJson.name;

export default {
  files: ["test/**/*.test.ts", "test/**/*.spec.ts"],
  nodeResolve: true,
  rootDir: "../",
  plugins: [
    vitePlugin({
      //configFile: "./vite.config.ts"
    })
  ],
  define: {
    WEAVY_VERSION: `'${version.split("+")[0]}+test.${Date.now()}'`,
    WEAVY_SOURCE_NAME: `'${sourceName}'`,
  },
};

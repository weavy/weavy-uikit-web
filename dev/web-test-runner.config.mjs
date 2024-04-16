import { vitePlugin } from '@remcovaes/web-test-runner-vite-plugin';

const showDebug = Boolean(process.argv.find((s) => s.startsWith("--debug")))

export default {
  files: [
    "tests/**/*.test.ts", 
    //"tests/**/*.spec.ts"
  ],
  nodeResolve: true,
  browserLogs: showDebug,
  rootDir: ".",
  plugins: [
    vitePlugin({
      configFile: "dev/vite.config.ts",
    })
  ],
};

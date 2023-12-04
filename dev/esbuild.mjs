import esbuild from "esbuild";
import { esbuildTestingConfig, esbuildDevelopmentConfig, esbuildConfigESM, esbuildConfigUMD } from "./esbuild.config.mjs";

const production = process.argv.includes("--mode=production");
const testing = process.argv.includes("--mode=testing");
const development = !production && !testing;

console.log("Mode:", development ? "development" : "production");

if (development) {
  const context = await esbuild.context(testing ? esbuildTestingConfig : esbuildDevelopmentConfig);
  await context.watch();
} else {
  const resultESM = await esbuild.build(esbuildConfigESM);
  if (production) {
    await esbuild.build(esbuildConfigUMD);

    console.log(
      await esbuild.analyzeMetafile(resultESM.metafile, {
        verbose: false,
      })
    );
  }
}

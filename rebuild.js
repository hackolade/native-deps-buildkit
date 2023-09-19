import { platform, arch } from "node:os";
import { log } from "#lib/logger.js";
import { prebuildNativeModule } from "#lib/prebuilds.js";
import { npmCommand, exec } from "#lib/commands.js";
import modules from "./modulesToBuild.json" assert { type: "json" };
import { ROOT_DIR } from "#root";
import { mkdir, rename, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { writePkgTpl } from "#lib/publish.js";

// run patch package
await exec(npmCommand, ["run", `patch-package`]);

const modulesToBuild = modules.filter(
  (mod) => mod.targetPlatform === platform() && mod.targetArch === arch(),
);

for (const { module, targetPlatform, targetArch } of modulesToBuild) {
    log("building custom native bindings for module %o", module);
    await prebuildNativeModule(module);

    const nativeModuleScopedPackage = path.join(
      ROOT_DIR,
      "node_modules",
      "@hackolade",
      `${module.name}-${targetPlatform}-${targetArch}`,
    );
    await rm(nativeModuleScopedPackage, { force: true, recursive: true });
    await mkdir(nativeModuleScopedPackage, { force: true, recursive: true });

    const releaseContent = await readdir(
      path.resolve(module.baseDir, "build", "Release"),
      {
        withFileTypes: true,
      },
    );
    const [prebuild] = releaseContent
      .filter((entry) => entry.isFile() && entry.name.endsWith(".node"))
      .map((entry) => entry.name);
    const prebuildSrc = path.join(module.baseDir, "build", "Release", prebuild);
    await rename(
      prebuildSrc,
      path.join(nativeModuleScopedPackage, "prebuild.node"),
    );
    await writePkgTpl({
      moduleName: module.name,
      targetPlatform,
      targetArch,
      scopedPackagePath: nativeModuleScopedPackage,
      version: module.version,
    });
    const ghPackageNpmrc = `//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
        @hackolade:registry=https://npm.pkg.github.com
        always-auth=true`;
    await writeFile(
      path.join(nativeModuleScopedPackage, ".npmrc"),
      ghPackageNpmrc,
    );
    await exec(npmCommand, ["publish"], { cwd: nativeModuleScopedPackage });
  }
}

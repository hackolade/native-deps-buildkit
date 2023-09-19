import { platform, arch } from "node:os";
import { log } from "#lib/logger.js";
import { prebuildNativeModule } from "#lib/prebuilds.js";
import { npmCommand, exec } from "#lib/commands.js";
import modules from "./modulesToBuild.json" assert { type: "json" };
import { ROOT_DIR } from "#root";
import { mkdir, cp, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { publishToGitHubPackages, writePkgTpl } from "#lib/publish.js";

// run patch package
await exec(npmCommand, ["run", `patch-package`]);

const modulesToBuild = modules.filter(
  (mod) => mod.targetPlatform === platform() && mod.targetArch === arch(),
);

for (const { module, targetPlatform, targetArch } of modulesToBuild) {

  await rm(
    path.join(module.baseDir, "build", "Release"),
    {recursive: true, force: true},
  );

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
  
    log("normalizing prebuild name: %o - %o", module.baseDir, prebuild);
  const prebuildSrc = path.join(module.baseDir, "build", "Release", prebuild);
  
  await cp(
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

  await publishToGitHubPackages(nativeModuleScopedPackage);
}

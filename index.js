import { join, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { ROOT_DIR } from "#root";
import { discoverRegularNativeModules, getElectronAbi } from "#lib/module.js";
import { installAvailablePrebuilts } from "#lib/install.js";
import { log } from "#lib/logger.js";
import { exec, npmCommand } from "#lib/commands.js";
import {
  publishToGitHubPackages,
  prepareParcelWatcherPrebuildsPackages,
} from "#lib/publish.js";

await exec(npmCommand, [
  "install",
  "--force",
  "--no-save",
  "@parcel/watcher-darwin-arm64@2.3.0",
  "@parcel/watcher-darwin-x64@2.3.0",
  "@parcel/watcher-linux-arm64-glibc@2.3.0",
  "@parcel/watcher-linux-x64-glibc@2.3.0",
  "@parcel/watcher-win32-x64@2.3.0",
]);

// run patch package
await exec(npmCommand, ["run", `patch-package`]);

const electron = await getElectronAbi();
const installedNativeModules = await discoverRegularNativeModules(
  join(ROOT_DIR, "node_modules"),
);

log("discovered native modules: %O", installedNativeModules);

const targets = [
  { targetPlatform: "darwin", targetArch: "arm64" },
  { targetPlatform: "darwin", targetArch: "x64" },
  { targetPlatform: "linux", targetArch: "x64" },
  { targetPlatform: "win32", targetArch: "x64" },
];

const custom = [];
const toPublish = await prepareParcelWatcherPrebuildsPackages();

for (const module of installedNativeModules) {
  for (const { targetPlatform, targetArch } of targets) {
    const installOutput = await installAvailablePrebuilts({
      module,
      targetPlatform,
      targetArch,
      electron,
    });
    if (installOutput.toBuild) {
      custom.push(installOutput);
    } else {
      toPublish.push(installOutput.scopedPackagePath);
    }
  }
}

// write to file as input for other platforms
await writeFile(
  resolve(ROOT_DIR, "modulesToBuild.json"),
  JSON.stringify(custom),
);

log('publishing packages to internal GitHub registry of Hackolade organization...');
for(const packagePath of toPublish){ 

  await publishToGitHubPackages(packagePath);
  log('---> %o published', packagePath);
}
 
// then trigger other jobs for each platform and upload artifacts
//https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts
// This is done as GitHub actions steps

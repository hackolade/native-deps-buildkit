import path from "node:path";
import {getAbi} from "node-abi";
import { exit } from "node:process";
import { access, readFile, readdir } from "node:fs/promises";
import { log } from "#lib/logger.js";
import { isNAPI, isNative } from "#lib/native.js";
import { ROOT_DIR } from "#root";

export async function readPackageData(modulePath) {
  const rawPkgAsJson = await readFile(path.join(modulePath, "package.json"));

  return JSON.parse(rawPkgAsJson.toString("utf8"));
}

export async function getElectronAbi() {
  const parentPath = ROOT_DIR + "/node_modules";
  const moduleDirectory = "electron";
  const electronPkgInformation = await getModulePkg({
    moduleDirectory,
    parentPath,
  });

  const electronConf =
    electronPkgInformation &&
    electronPkgInformation.length >= 1 &&
    electronPkgInformation[0];

  const version = electronConf && electronConf.version;
  const abi = version && getAbi(version, "electron");

  log("detected Electron version: %o - ABI : %o", version, abi);

  return { abi, version };
}

async function canInspectBaseDirectory(baseDirectory) {
  try {
    await access(baseDirectory);
  } catch (err) {
    if (baseDirectory !== ROOT_DIR && !baseDirectory.endsWith("node_modules")) {
      log(
        "[error] failed to access and read the content of base directory %o with %O",
        baseDirectory,
        err
      );
    }

    if (baseDirectory === ROOT_DIR) {
      exit(1);
    }
  }
}

async function listModulesInBaseDirectory(baseDirectory) {
  const installedModules = await readdir(baseDirectory, {
    withFileTypes: true,
  });

  return installedModules
    .filter((fsEntry) => fsEntry.isDirectory())
    .map((fsEntry) => fsEntry.name);
}

const ignoreDirectories = (discoveredModuleDirectories) => {
  // fsevents installs only on mac os with the correct arch no need for explicit prebuilds
  // .bin and .cache folders ar not modules

  const directoriesThatAreNotModule = [".bin", ".cache", "fsevents"];
  const modulesToIgnore = ["couchbase", "watcher"];

  return discoveredModuleDirectories.filter(
    (dir) => !directoriesThatAreNotModule.includes(dir)
  ).filter(
    (dir) => !modulesToIgnore.includes(dir)
  );
};

const keepOnlyNativeModules = (allDiscoveredModules) =>
  allDiscoveredModules.filter((module) => module.native);

async function getModulePkg({ moduleDirectory, parentPath }) {
  try {
    const pkg = await readPackageData(`${parentPath}/${moduleDirectory}`);

    const modulePkg = {
      baseDir: `${parentPath}/${moduleDirectory}`,
      name: pkg.name,
      version: pkg.version,
      native: isNative(pkg),
      napi: isNAPI(pkg),
    };

    const moduleDependenciesPackages = await discoverRegularNativeModules(
      `${parentPath}/${moduleDirectory}/node_modules`
    );

    return [modulePkg, ...moduleDependenciesPackages];
  } catch (err) {
    if (err.code !== "ENOENT" && !moduleDirectory.endsWith("node_modules")) {
      // handle potential missing nested node_modules
      log(
        "%o - fail to get module packages in %o with %O",
        moduleDirectory,
        parentPath,
        err
      );
    }
    return [];
  }
}

async function gatherInstalledModuleInformation({
  baseDirectory,
  moduleDirectory,
}) {
  // handle specific case of namespaced modules
  if (moduleDirectory.startsWith("@")) {
    return discoverRegularNativeModules(`${baseDirectory}/${moduleDirectory}`);
  } else {
    return getModulePkg({ moduleDirectory, parentPath: baseDirectory });
  }
}

export async function discoverRegularNativeModules(baseDirectory) {
  try {
    await canInspectBaseDirectory(baseDirectory);

    const modulesInBaseDirectory = await listModulesInBaseDirectory(
      baseDirectory
    );
    const sanitizedListOfInstalledModules = ignoreDirectories(
      modulesInBaseDirectory
    );

    const allModulesWithInfo = await Promise.all(
      sanitizedListOfInstalledModules.map(
        async (moduleDirectory) =>
          await gatherInstalledModuleInformation({
            baseDirectory,
            moduleDirectory,
          })
      )
    );

    return keepOnlyNativeModules(allModulesWithInfo.flat());
  } catch (err) {
    if (err.code !== "ENOENT" && !baseDirectory.endsWith("node_modules")) {
      // handle potential missing nested node_modules
      log(
        "failed discovering native modules from directory %o with %O ",
        baseDirectory,
        err
      );
    }

    return [];
  }
}

import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { ROOT_DIR } from "#root";
import { exec, npmCommand } from "#lib/commands.js";
import electron from "electron/package.json" assert { type: "json" };
import semver from "semver";
import { log } from "#lib/logger.js";

export const electronVersion = semver.major(electron.version);
export const githubOrganizationScope = "@hackolade";

// forces @hackolade organization scope to be published to Github Packages
export const ghPackageNpmrc = `
        //npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
        @hackolade:registry=https://npm.pkg.github.com
        access=public
        always-auth=true`;

export const pkgTpl = ({
  githubOrganizationScope,
  moduleName,
  targetPlatform,
  targetArch,
  version,
}) => {
  const mainFile =
    (moduleName === "desktop-trampoline" && "desktop-trampoline") ||
    "prebuild.node";

  return {
    name: `${githubOrganizationScope}/${moduleName}-${targetPlatform}-${targetArch}`,
    version: `${version}-${electronVersion}`,
    main: mainFile,
    files: [mainFile],
    publishConfig: {
      access: "public",
    },
  };
};

export async function writePkgTpl({
  moduleName,
  targetPlatform,
  targetArch,
  version,
  scopedPackagePath,
}) {
  const packageJsonContentForModule = pkgTpl({
    githubOrganizationScope,
    moduleName,
    targetPlatform,
    targetArch,
    version,
    scopedPackagePath,
  });
  await writeFile(
    path.resolve(scopedPackagePath, "package.json"),
    JSON.stringify(packageJsonContentForModule),
  );
}

export async function copyReleaseBuild({ module, scopedPackagePath }) {
  if (module.name === "desktop-trampoline") {
    const prebuildSrc = path.join(module.baseDir, "build", "Release");
    await rename(prebuildSrc, scopedPackagePath);
  } else {
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
    await rename(prebuildSrc, path.join(scopedPackagePath, "prebuild.node"));
  }
}

export async function preparePackage({ module, targetPlatform, targetArch }) {
  const scopedPackagePath = path.join(
    ROOT_DIR,
    "node_modules",
    githubOrganizationScope,
    `${module.name}-${targetPlatform}-${targetArch}`,
  );
  await rm(scopedPackagePath, { force: true, recursive: true });
  await mkdir(scopedPackagePath, { force: true, recursive: true });

  await copyReleaseBuild({ module, scopedPackagePath });
  await writePkgTpl({
    moduleName: module.name,
    targetPlatform,
    targetArch,
    scopedPackagePath,
    version: module.version,
  });

  return scopedPackagePath;
}

//Parcel already publishes all the prebuilts as expected but with OS and CPU constraints
// forcing us to use npm install --force which we don't want to
export async function prepareParcelWatcherPrebuildsPackages() {
  log('prepare @parcel watcher dependencies...')
  const parcelScopedPackagesBasePath = path.join(
    ROOT_DIR,
    "node_modules",
    "@parcel",
  );
  const parcelPackages = await readdir(parcelScopedPackagesBasePath, {
    withFileTypes: true,
  });
  const parcelWatchPrebuilds = parcelPackages
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("watcher-") && !entry.name.includes("musl"))
    .map((entry) => {
      return {
        dir: path.join(parcelScopedPackagesBasePath, entry.name),
        name: entry.name,
      };
    });

  const hackoladeScopedPackagesPaths = [];
  for (const { name, dir } of parcelWatchPrebuilds) {
    const hackoladeScopedPkgPath = path.join(
      ROOT_DIR,
      "node_modules",
      "@hackolade",
      name,
    );
    await mkdir(path.join(ROOT_DIR, "node_modules", "@hackolade"), {
      force: true,
      recursive: true,
    });
    await rename(dir, hackoladeScopedPkgPath);

    // Tweak package.json to remove useless information
    const pkgRaw = await readFile(
      path.join(hackoladeScopedPkgPath, "package.json"),
    );
    const pkg = JSON.parse(pkgRaw);
    delete pkg.repository;
    delete pkg.funding;
    delete pkg.cpu;
    delete pkg.os;

    pkg.name = `@hackolade/${name}`;
    const version = pkg.version;
    pkg.version = `${version}-${electronVersion}`;

    pkg.publishConfig = { access: "public" }

    await writeFile(
      path.join(hackoladeScopedPkgPath, "package.json"),
      JSON.stringify(pkg),
    );
    await writeFile(path.join(hackoladeScopedPkgPath, ".npmrc"), ghPackageNpmrc);
    hackoladeScopedPackagesPaths.push(hackoladeScopedPkgPath);
  }
  log('@parcel watcher dependencies moved under @hackolade scope')
  return hackoladeScopedPackagesPaths;
}

export async function publishToGitHubPackages(scopedPackagePath) {
  await writeFile(path.join(scopedPackagePath, ".npmrc"), ghPackageNpmrc);
  await exec(npmCommand, ["publish"], { cwd: scopedPackagePath });
}

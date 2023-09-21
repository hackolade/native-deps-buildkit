import { platform, arch } from 'node:os';
import { log } from '#lib/logger.js';
import { prebuildNativeModule } from '#lib/prebuilds.js';
import { npmCommand, exec } from '#lib/commands.js';
import modules from './modulesToBuild.json' assert { type: 'json' };
import { ROOT_DIR } from '#root';
import { mkdir, cp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { checkPackageVersionAlreadyExists, publishToGitHubPackages, writePkgTpl } from '#lib/publish.js';
import winAddon from './winapi-detect-remote-desktop-addon/package.json' assert { type: 'json' };

// run patch package
await exec(npmCommand, ['run', 'patch-package']);

const modulesToBuild = modules
	.filter(mod => mod.targetPlatform === platform() && mod.targetArch === arch())
	.map(module => {
		// Base dir might have changed between runs
		const oldBaseDir = module.module.baseDir;
    const reg = new RegExp('.+/native-deps-buildkit/node_modules', 'gi')
    const fixedBaseDir = oldBaseDir.replaceAll(reg, `${ROOT_DIR}/node_modules`)
    log('--> using new baseDir: %o', fixedBaseDir);
		module.module.baseDir = fixedBaseDir;
		return module;
	});

// Handle our custom module for windows remote desktop detection
if (platform() === 'win32') {
	const remoteDesktopDetectionAddon = {
		'targetPlatform': 'win32',
		'targetArch': 'x64',
		'name': winAddon.name,
		'module': {
			'baseDir': `${ROOT_DIR}/${winAddon.name}`,
			'name': winAddon.name,
			'version': winAddon.version,
			'native': true,
			'napi': true,
		},
		'toBuild': true,
	};

	modulesToBuild.push(remoteDesktopDetectionAddon);
}

log(">>>>>>>>>>>>>>>>>> modulesToBuild %O", modulesToBuild);
const filterOutPackagesWithVersionAlreadyPublished = await Promise.all(
	modulesToBuild.map(async module => {
		const token = process.env.NODE_AUTH_TOKEN;
		const checkVersionExistsResult =  await checkPackageVersionAlreadyExists({token, packageName: module.name, version: module.module.version});
		if(checkVersionExistsResult.isPackageVersionAlreadyPublished){

			const githubPackageVersionsURL = `https://github.com/orgs/hackolade/packages/npm/${checkVersionExistsResult.name}/versions`;
			const deletePackageCurlCmd = `curl -L -X DELETE -H "Accept: application/vnd.github+json" -H "Authorization: Bearer <token>" "https://api.github.com/orgs/hackolade/packages/npm/${checkVersionExistsResult.name}"`;
			log('--> skip publish package %o with version %o is already published to GitHub packages', checkVersionExistsResult.name, checkVersionExistsResult.version );
			log('--> check %o to delete the version %o', githubPackageVersionsURL, checkVersionExistsResult.version );
			log('--> or use the following command with your Personnal Access Token to delete the version %o', deletePackageCurlCmd );
		}

		return checkVersionExistsResult && Object.assign(module, checkVersionExistsResult) || module;
	})
);

log(">>>>>>>>>>>>>>>>>> %O", filterOutPackagesWithVersionAlreadyPublished);
const finalPackageListToBuildAndPublish = filterOutPackagesWithVersionAlreadyPublished.filter( module => !module.isPackageVersionAlreadyPublished);

log(">>>>>>>>>>>>>>>>>> %O", finalPackageListToBuildAndPublish);
for (const { module, targetPlatform, targetArch } of finalPackageListToBuildAndPublish) {
	await rm(path.join(module.baseDir, 'build', 'Release'), { recursive: true, force: true });

	log('building custom native bindings for module %o', module);
	await prebuildNativeModule(module);

	const nativeModuleScopedPackage = path.join(
		ROOT_DIR,
		'node_modules',
		'@hackolade',
		`${module.name}-${targetPlatform}-${targetArch}`,
	);
	await rm(nativeModuleScopedPackage, { force: true, recursive: true });
	await mkdir(nativeModuleScopedPackage, { force: true, recursive: true });

	const releaseContent = await readdir(path.resolve(module.baseDir, 'build', 'Release'), {
		withFileTypes: true,
	});
	const [prebuild] = releaseContent
		.filter(entry => entry.isFile() && entry.name.endsWith('.node'))
		.map(entry => entry.name);

	log('normalizing prebuild name: %o - %o', module.baseDir, prebuild);
	const prebuildSrc = path.join(module.baseDir, 'build', 'Release', prebuild);

	await cp(prebuildSrc, path.join(nativeModuleScopedPackage, 'prebuild.node'));
	await writePkgTpl({
		moduleName: module.name,
		targetPlatform,
		targetArch,
		scopedPackagePath: nativeModuleScopedPackage,
		version: module.version,
	});

	await publishToGitHubPackages(nativeModuleScopedPackage);
}

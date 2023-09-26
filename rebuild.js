import { platform, arch } from 'node:os';
import { env } from 'node:process';
import { log } from '#lib/logger.js';
import { prebuildNativeModule } from '#lib/prebuilds.js';
import { npxCommand, exec } from '#lib/commands.js';
import modules from './modulesToBuild.json' assert { type: 'json' };
import { ROOT_DIR } from '#root';
import { mkdir, cp, readdir,readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { checkPackageVersionExistsFromPath, publishToGitHubPackages, writePkgTpl } from '#lib/publish.js';
import winAddon from './winapi-detect-remote-desktop-addon/package.json' assert { type: 'json' };
import os from 'node:os';

// run patch package
await exec(npxCommand, ['patch-package']);

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

// Detect Ubuntu version to know if we need to specifically build modules for Openssl 1 like Couchbase
const detectOpenSSLVersion = async () => {
	try{
		if(os.platform() === 'linux'){
				const ubuntuReleaseFile = await readFile(path.resolve('/etc/os-release'));
				const ubuntuReleaseFileContent = ubuntuReleaseFile.toString();
				const ubuntuReleaseFileLines = ubuntuReleaseFileContent.split('\n') || [];

				return ubuntuReleaseFileLines.filter(line => line.includes('VERSION_ID=20.04')).length > 0 ;
		}else{
			return false;
		}
	}catch(_){return false;}
}

const mustBuildForOpenSSL1 = await detectOpenSSLVersion();
log('--> detect if we must build for Openssl1: %O', mustBuildForOpenSSL1);


const modulesToBuildOnlyForOpenSSL1 = modulesToBuild.filter(module => module.name === 'couchbase');

for (const { module, targetPlatform, targetArch } of mustBuildForOpenSSL1 ? modulesToBuildOnlyForOpenSSL1: modulesToBuild) {
	const opensslSuffix = modulesToBuildOnlyForOpenSSL1? '-openssl1': '';
	const prebuildModuleNameForTarget = `${module.name}-${targetPlatform}-${targetArch}${opensslSuffix}`;
	const nativeModuleScopedPackage = path.join(
		ROOT_DIR,
		'node_modules',
		'@hackolade',
		`${prebuildModuleNameForTarget}`,
	);
	await rm(nativeModuleScopedPackage, { force: true, recursive: true });
	await mkdir(nativeModuleScopedPackage, { force: true, recursive: true });

	await writePkgTpl({
		moduleName: module.name,
		targetPlatform,
		targetArch,
		scopedPackagePath: nativeModuleScopedPackage,
		version: module.version,
		forOpenSSL1: modulesToBuildOnlyForOpenSSL1,
	});

	const token = env.NODE_AUTH_TOKEN;
	const check = await checkPackageVersionExistsFromPath({packagePath: nativeModuleScopedPackage, token});

	if(check.isPackageVersionAlreadyPublished){
		const githubPackageVersionsURL = `https://github.com/orgs/hackolade/packages/npm/${prebuildModuleNameForTarget}/versions`;
		const deletePackageCurlCmd = `curl -L -X DELETE -H "Accept: application/vnd.github+json" -H "Authorization: Bearer <token>" "https://api.github.com/orgs/hackolade/packages/npm/${prebuildModuleNameForTarget}"`;
		log('--> skip publish package %o with version %o is already published to GitHub packages', prebuildModuleNameForTarget, module.version );
		log('--> check %o to delete the version %o', githubPackageVersionsURL, module.version );
		log('--> or use the following command with your Personal Access Token to delete the version %o', deletePackageCurlCmd );
	}
	else{
		log('building custom native bindings for module %o', module);
		await rm(path.join(module.baseDir, 'build', 'Release'), { recursive: true, force: true });
		await prebuildNativeModule(module);
		const releaseContent = await readdir(path.resolve(module.baseDir, 'build', 'Release'), {
			withFileTypes: true,
		});
		const [prebuild] = releaseContent
			.filter(entry => entry.isFile() && entry.name.endsWith('.node'))
			.map(entry => entry.name);

		log('normalizing prebuild name: %o - %o', module.baseDir, prebuild);
		const prebuildSrc = path.join(module.baseDir, 'build', 'Release', prebuild);

		await cp(prebuildSrc, path.join(nativeModuleScopedPackage, 'prebuild.node'));

		await publishToGitHubPackages(nativeModuleScopedPackage);
	}
}

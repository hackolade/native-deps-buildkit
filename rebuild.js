// import { platform, arch } from 'node:os';
// import { env } from 'node:process';
import { LOGGER } from '#lib/logger.js';
import { build } from '#lib/build.js';
// import { npxCommand, exec } from '#lib/commands.js';
import modules from './modulesToBuild.json' assert { type: 'json' };
import {rescopeOfficialPrebuildsFromPackage} from './lib/pack.js';
// import { ROOT_DIR } from '#root';
// import { mkdir, cp, readdir,readFile, rm } from 'node:fs/promises';
// import path from 'node:path';
// import { checkPackageVersionExistsFromPath, publishToGitHubPackages, writePkgTpl } from '#lib/publish.js';
// import winAddon from './winapi-detect-remote-desktop-addon/package.json' assert { type: 'json' };
// import os from 'node:os';
import { runPatchPackage } from './lib/install.js';
import {publishToNPM} from './lib/publish.js';

const log = LOGGER.extend('rebuild');

// run patch package
await runPatchPackage();

const relocateWorkdir = (workdir) => {
    // Base dir might have changed between runs
    const reg = new RegExp('.+/native-deps-buildkit/node_modules', 'gi')
    return workdir.replaceAll(reg, `${ROOT_DIR}/node_modules`)   
};

const modulesToBuild = modules.filter(({to_build}) => to_build).map(module =>{
    const {moduleBaseDir, rescopedModuleBaseDir, prebuildsAsNpmDependencies} = module;
    module.moduleBaseDir = relocateWorkdir(moduleBaseDir);
    module.rescopedModuleBaseDir = relocateWorkdir(rescopedModuleBaseDir);

    module.prebuildsAsNpmDependencies = prebuildsAsNpmDependencies.map(dep => {
        const {moduleBaseDir, rescopedModuleBaseDir} = dep;
        dep.moduleBaseDir = relocateWorkdir(moduleBaseDir);
        dep.rescopedModuleBaseDir = relocateWorkdir(rescopedModuleBaseDir);
    });
    return module;
});

log("MODULES: %O", modulesToBuild);

for(const mod of modulesToBuild){
	await build(mod);
}

const moduleToPublish = await rescopeOfficialPrebuildsFromPackage({buildMetadata: modulesToBuild, rescopeOnlyPrebuilds: true});

for(const moduleToPublishBaseDir of moduleToPublish){
    await publishToNPM(moduleToPublishBaseDir);
}

// const modulesToBuild = modules
// 	.filter(mod => mod.targetPlatform === platform() && mod.targetArch === arch())
// 	.map(module => {
// 		// Base dir might have changed between runs
// 		const oldBaseDir = module.module.baseDir;
//     const reg = new RegExp('.+/native-deps-buildkit/node_modules', 'gi')
//     const fixedBaseDir = oldBaseDir.replaceAll(reg, `${ROOT_DIR}/node_modules`)
//     log('--> using new baseDir: %o', fixedBaseDir);
// 		module.module.baseDir = fixedBaseDir;
// 		return module;
// 	});

// Handle our custom module for windows remote desktop detection
// if (platform() === 'win32') {
// 	const remoteDesktopDetectionAddon = {
// 		'targetPlatform': 'win32',
// 		'targetArch': 'x64',
// 		'name': winAddon.name,
// 		'module': {
// 			'baseDir': `${ROOT_DIR}/${winAddon.name}`,
// 			'name': winAddon.name,
// 			'version': winAddon.version,
// 			'native': true,
// 			'napi': true,
// 		},
// 		'toBuild': true,
// 	};

// 	modulesToBuild.push(remoteDesktopDetectionAddon);
// }

// Detect Ubuntu version to know if we need to specifically build modules for Openssl 1 like Couchbase
// const detectOpenSSLVersion = async () => {
// 	try{
// 		if(os.platform() === 'linux'){
// 				const ubuntuReleaseFile = await readFile(path.resolve('/etc/os-release'));
// 				const ubuntuReleaseFileContent = ubuntuReleaseFile.toString();
// 				const ubuntuReleaseFileLines = ubuntuReleaseFileContent.split('\n') || [];
// 				log('ubuntu release file lines %O', ubuntuReleaseFileLines);	
// 				const withOnlyVersionID = ubuntuReleaseFileLines.filter(line => line.includes('VERSION_ID="20.04"'));
// 				log('ubuntu release file lines withOnlyVersionID %O', withOnlyVersionID);	
// 				return withOnlyVersionID.length > 0 ;
// 		}else{
// 			return false;
// 		}
// 	}catch(err){
// 		log('[ERROR] detectOpenSSLVersion failed with %O', err);	
// 		return false;
// 	}
// }

// const mustBuildForOpenSSL1 = await detectOpenSSLVersion();
// log('--> detect if we must build for Openssl1: %O', mustBuildForOpenSSL1);


// const modulesToBuildOnlyForOpenSSL1 = modulesToBuild.filter(module => module.name === 'couchbase');

// for (const { module, targetPlatform, targetArch } of mustBuildForOpenSSL1 ? modulesToBuildOnlyForOpenSSL1: modulesToBuild) {
// 	const opensslSuffix = mustBuildForOpenSSL1? '-openssl1': '';
// 	const prebuildModuleNameForTarget = `${module.name}-${targetPlatform}-${targetArch}${opensslSuffix}`;
// 	const nativeModuleScopedPackage = path.join(
// 		ROOT_DIR,
// 		'node_modules',
// 		'@hackolade',
// 		`${prebuildModuleNameForTarget}`,
// 	);
// 	await rm(nativeModuleScopedPackage, { force: true, recursive: true });
// 	await mkdir(nativeModuleScopedPackage, { force: true, recursive: true });

// 	await writePkgTpl({
// 		moduleName: module.name,
// 		targetPlatform,
// 		targetArch,
// 		scopedPackagePath: nativeModuleScopedPackage,
// 		version: module.version,
// 		forOpenSSL1: mustBuildForOpenSSL1,
// 	});

// 	const token = env.NODE_AUTH_TOKEN;
// 	const check = await checkPackageVersionExistsFromPath({packagePath: nativeModuleScopedPackage, token});

// 	if(check.isPackageVersionAlreadyPublished){
// 		const githubPackageVersionsURL = `https://github.com/orgs/hackolade/packages/npm/${prebuildModuleNameForTarget}/versions`;
// 		const deletePackageCurlCmd = `curl -L -X DELETE -H "Accept: application/vnd.github+json" -H "Authorization: Bearer <token>" "https://api.github.com/orgs/hackolade/packages/npm/${prebuildModuleNameForTarget}"`;
// 		log('--> skip publish package %o with version %o is already published to GitHub packages', prebuildModuleNameForTarget, module.version );
// 		log('--> check %o to delete the version %o', githubPackageVersionsURL, module.version );
// 		log('--> or use the following command with your Personal Access Token to delete the version %o', deletePackageCurlCmd );
// 	}
// 	else{
// 		log('building custom native bindings for module %o', module);
// 		await rm(path.join(module.baseDir, 'build', 'Release'), { recursive: true, force: true });
// 		await prebuildNativeModule(module);
// 		const releaseContent = await readdir(path.resolve(module.baseDir, 'build', 'Release'), {
// 			withFileTypes: true,
// 		});
// 		const [prebuild] = releaseContent
// 			.filter(entry => entry.isFile() && entry.name.endsWith('.node'))
// 			.map(entry => entry.name);

// 		log('normalizing prebuild name: %o - %o', module.baseDir, prebuild);
// 		const prebuildSrc = path.join(module.baseDir, 'build', 'Release', prebuild);

// 		await cp(prebuildSrc, path.join(nativeModuleScopedPackage, 'prebuild.node'));

// 		await publishToGitHubPackages(nativeModuleScopedPackage);
// 	}
// }

import { LOGGER } from '#lib/logger.js';
import { exec } from './exec.js';
import { npmCommand } from './commands.js';
import { pack } from './pack.js';
import { checkPackageVersionAlreadyExistsOnNPM } from './publish.js';
import { access } from "node:fs/promises";
import { join } from "node:path";
import { cp, mkdir } from './fs.js';
import { platform, arch } from 'node:os';
import { publishToNPM } from './publish.js';

const log = LOGGER.extend('build');

export const ensureModuleBaseDirExists = async (moduleBaseDir) => {
	log('check cwd exists for rebuilding native module: %o ...', moduleBaseDir);
	try{
		await access(moduleBaseDir);
		log('[ok] building module in cwd: %o ...', moduleBaseDir);
	}
	catch(err){
		log('[error] unable to build module, cwd does not exists: %o ...', moduleBaseDir);
		throw err
	}
}

export const installModuleDependencies = async (moduleBaseDir) => {
	log('install native module dependencies for build: %o ...', moduleBaseDir);
	await exec({
		command: npmCommand, parameters: [ 'install' ], options: {
		cwd: moduleBaseDir,
	}});
}

export const rebuildModule = async (moduleBaseDir) => {
	log('build native module in : %o ...', moduleBaseDir);
	await exec({command: npmCommand, parameters: ['run', 'rebuild'], options: {
		cwd: moduleBaseDir,
	}});
	log('native module successfully rebuild in %o', moduleBaseDir);
}

export async function generateTemporaryPrebuildDirForTarget({moduleBaseDir, targetArch, targetPlatform}){

	log('generateTemporaryPrebuildDirForTarget from %o with target %o-%o', moduleBaseDir, targetArch, targetPlatform);
	// create temporary prebuilds folders by platform
	const buildDir = releaseBuildPath(moduleBaseDir);
	const targetPrebuildDir = temporaryPrebuildBuildPath({moduleBaseDir, targetArch, targetPlatform});
	await mkdir(targetPrebuildDir);
	await cp({src: buildDir, dest: targetPrebuildDir});
	// await rm(buildDir);
}

export async function build({ name, moduleBaseDir,  prebuildsAsNpmDependencies}) {

	const prebuildToBuild = await Promise.all(prebuildsAsNpmDependencies
		.map( async prebuildMetadataForTarget => {
			const {targetPlatform, targetArch, modulePkg} = prebuildMetadataForTarget;
			if(targetPlatform === platform() && targetArch === arch()){
				const {name, version} = modulePkg;
				if( !await checkPackageVersionAlreadyExistsOnNPM({name, version})){
					return prebuildMetadataForTarget;
				}
			}
		}));
	
	const [prebuildMetadata] = prebuildToBuild.flat().filter(Boolean);
	const toPublish = [];

	if(prebuildMetadata){

		log('build native module: %o', name);
		log('build native module with metadata: %O', prebuildMetadata);

		await ensureModuleBaseDirExists(moduleBaseDir);

		await installModuleDependencies(moduleBaseDir);

		await rebuildModule(moduleBaseDir);

		await generateTemporaryPrebuildDirForTarget({ moduleBaseDir, targetArch: arch(), targetPlatform: platform()});

		const moduleToPublishBaseDir = await pack({
			srcBaseDir: prebuildMetadata.moduleBaseDir,
			destBaseDir: prebuildMetadata.rescopedModuleBaseDir,
			packageJSONData: prebuildMetadata.modulePkg,
			modulesToPublish: toPublish
		});
		log('native module added to publish list: %O', toPublish);

		await publishToNPM(moduleToPublishBaseDir);
	}


	return toPublish;
}

export const releaseBuildPath = (moduleBaseDir) => join(moduleBaseDir, 'build', 'Release');
export const temporaryPrebuildsPath = ({moduleBaseDir}) => join(moduleBaseDir, 'prebuilds');
export const temporaryPrebuildBuildPath = ({moduleBaseDir, targetArch, targetPlatform}) => join(temporaryPrebuildsPath({moduleBaseDir}),`${targetPlatform}-${targetArch}`);

import { npmCommand } from './commands.js';
import { exec } from './exec.js';
import { LOGGER } from './logger.js';
import { env as processEnvironment } from 'node:process';
import { targetsDetails } from './build-metadata.js';
import { generateTemporaryPrebuildDirForTarget, releaseBuildPath, temporaryPrebuildsPath } from './build.js';
import { rm } from './fs.js';

const log = LOGGER.extend('install');
export async function getOfficialPrebuildsAsNpmOptionalDependencies(optionalDependencies) {
	return Object.entries(optionalDependencies).map(([depName, depVersion]) => `${depName}@${depVersion}`);
}

export async function runPatchPackage() {
	await exec({
		command: npmCommand,
		parameters: ['run', 'patch-package'],
		options: {shell: true},
	});
}

export function setNPMConfForNAPI(existingRuntimeEnv, targetPlatform, targetArch) {
	return {
		npm_config_platform: targetPlatform,
		npm_config_arch: targetArch,
		npm_config_runtime: 'napi',
		...existingRuntimeEnv,
	};
}

export async function installPrebuildForTarget({ name, moduleBaseDir, version, targetPlatform, targetArch }) {
	log(`\t ${name} - v${version} - for ${targetPlatform}-${targetArch} - installing prebuilt binaries...`);
	await exec({
		command: npmCommand,
		parameters: ['run', 'install'],
		options: {
			cwd: moduleBaseDir,
			env: setNPMConfForNAPI(processEnvironment, targetPlatform, targetArch),
			shell: true,
		},
	});

	log(`\t ${name} - v${version} - for ${targetPlatform}-${targetArch} prebuilt binaries installed [OK]`);
}

export async function installPrebuiltsForTargets({ name, moduleBaseDir, version, to_build, prebuild_install }) {
	if (!to_build && prebuild_install) {
		const prebuildsFromPrebuildInstallDir = temporaryPrebuildsPath({ moduleBaseDir });
		const prebuildInstallDir = releaseBuildPath(moduleBaseDir);
		await rm(prebuildsFromPrebuildInstallDir);
		await rm(prebuildInstallDir);

		for (const { targetPlatform, targetArch } of targetsDetails) {
			await installPrebuildForTarget({ name, moduleBaseDir, version, targetPlatform, targetArch });
			await generateTemporaryPrebuildDirForTarget({ moduleBaseDir, targetArch, targetPlatform });
		}
	} else {
		log('%o requires a custom build for each target, no official prebuilt is available', name);
	}
}

export async function installAllPrebuildsProvidedAsNPMDependencies(modulesBuildMetadata) {
	const prebuildsToInstall = modulesBuildMetadata
		.filter(moduleMeta => moduleMeta.prebuildsAsNpmDependencies.length > 0)
		.map(({ prebuildsAsNpmDependencies }) => prebuildsAsNpmDependencies.map(({ npmInstallPragma }) => npmInstallPragma))
		.flat()
		.filter(Boolean);

	// When prebuilds are published as real npm packages they have install check constraints declared on platform and cpu (e.g. arch)
	// Which typically blocks us from being able to install all targets like we need for cross building the application
	// The only way to workaround that is to force npm to ignore any check or issue during installation, which is in general a bad idea but we don't have any other way.
	// We also don't want to have this installation being persisted in our top level package.json file nor in the lock file: thus the use of --no-save
	await exec({ 
		command: npmCommand, 
		parameters: ['install', '--force', '--no-save', ...prebuildsToInstall],
		options: {shell: true},
	});
}

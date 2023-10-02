import process from 'node:process';
import { exec, npmCommand, prebuildCommand } from '#lib/commands.js';
import { log } from '#lib/logger.js';
import { preparePackage } from '#lib/publish.js';

function setNPMConfForNAPI(existingRuntimeEnv, targetPlatform, targetArch) {
	return Object.assign(existingRuntimeEnv, {
		npm_config_platform: targetPlatform,
		npm_config_arch: targetArch,
		npm_config_runtime: 'napi',
	});
}

async function installNAPIPrebuilts({ module, targetPlatform, targetArch }) {
	log(
		`\t ${module.name} - v${module.version} - for ${targetPlatform}-${targetArch} - installing prebuilt binaries for NAPI...`,
	);
	await exec(npmCommand, ['run', 'install'], {
		cwd: module.baseDir,
		env: setNPMConfForNAPI(process.env, targetPlatform, targetArch),
	});

	log(
		`\t ${module.name} - v${module.version} - for ${targetPlatform}-${targetArch} prebuilt binaries for NAPI installed [OK]`,
	);
}

async function installElectronPrebuilts({ module, targetPlatform, targetArch, electron }) {
	log(
		`\t ${module.name} - v${module.version} - for ${targetPlatform}-${targetArch} installing available prebuilt binaries for Electron ABI ${electron.abi} and version ${electron.version}...`,
	);
	
	await exec(
		prebuildCommand,
		[
			`-f`,
			`--verbose`,
			'--runtime',
			'electron',
			'--platform',
			targetPlatform,
			'--arch',
			targetArch,
			'--target',
			electron.version,
		],
		{
			cwd: module.baseDir,
		},
	);

	log(
		`\t ${module.name} - v${module.version} for ${targetPlatform}-${targetArch} - prebuilt binaries for Electron installed [OK]`,
	);
}

export async function installAvailablePrebuilts({ module, targetPlatform, targetArch, electron }) {
	log(`------------------------------------------------------------------------------------------------`);
	log(
		`- module ${module.name} => Using platform ${targetPlatform} and CPU architecture ${targetArch}) to install available upstream native binary bindings`,
	);
	// We know couchbase has prebuilts from upstream but we also know we can't use them with electron as they are broken
	if (module.name === 'couchbase') {
		return {
			targetPlatform,
			targetArch,
			name: module.name,
			module,
			toBuild: true,
		};
	}

	try {

		const scopedPackagePath = await preparePackage({
			module,
			targetPlatform,
			targetArch,
			electron,
		});
		log(
			`\t ${module.name} - v${module.version} - for ${targetPlatform}-${targetArch} prebuilt binaries for electron successfully installed from upstream...`,
		);
		return {
			targetPlatform,
			targetArch,
			name: module.name,
			module,
			toBuild: false,
			scopedPackagePath,
		};
	} catch (err) {
		log(
			`\t ${module.name} - v${module.version} - for ${targetPlatform}-${targetArch} no upstream prebuilt ${module.name} binaries for electron (ABI ${electron.abi}) nor NAPI.`,
		);
		log(`\t ${module.name} - v${module.version} - %O`, err);
		return {
			targetPlatform,
			targetArch,
			name: module.name,
			module,
			toBuild: true,
		};
	}
}

export async function installForElectronOrNAPI({ module, targetPlatform, targetArch, electron }) {
	if (module.napi) {
		await installNAPIPrebuilts({ module, targetPlatform, targetArch });
	} else {
		await installElectronPrebuilts({
			module,
			targetPlatform,
			targetArch,
			electron,
		});
	}
}

import {exec, npmCommand, prebuildCommand} from '#lib/commands.js';
import {mkdir, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import { log } from '#lib/logger.js';
import { ROOT_DIR} from '#root';

function setNPMConfForNAPI(existingRuntimeEnv, targetPlatform, targetArch){
    return Object.assign(existingRuntimeEnv, {
        'npm_config_platform': targetPlatform,
        'npm_config_arch': targetArch,
        'npm_config_runtime': 'napi',
    });
}

async function installNAPIPrebuilts({module, targetPlatform, targetArch}){
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

async function installElectronPrebuilts({module, targetPlatform, targetArch, electron}){
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
            electron.version
        ],
        {
            cwd: module.baseDir,
        },
    );

    log(
        `\t ${module.name} - v${module.version} for ${targetPlatform}-${targetArch} - prebuilt binaries for Electron installed [OK]`,
    );
}

export async function installAvailablePrebuilts({module, targetPlatform, targetArch, electron}) {
    log(`------------------------------------------------------------------------------------------------`);
    log(`- module ${module.name} => Using platform ${targetPlatform} and CPU architecture ${targetArch}) to install available upstream native binary bindings`);
	try {
        const nativeModuleScopedPackage = path.join(ROOT_DIR, 'node_modules', '@hck', `${module.name}-${targetPlatform}-${targetArch}`)
        await mkdir(nativeModuleScopedPackage, {force: true, recursive: true})
		if (module.napi) {
			await installNAPIPrebuilts({module, targetPlatform, targetArch});
		} else {
			await installElectronPrebuilts({module, targetPlatform, targetArch, electron});
		}
		
        await rename(path.resolve(module.baseDir, 'build', 'Release'), nativeModuleScopedPackage, {force: true, recursive: true});
        await writePkgTpl({moduleName: module.name, targetPlatform, targetArch, scopedPkgPath: nativeModuleScopedPackage, version: '1.0.0'});

        log(
			`\t ${module.name} - v${module.version} - for ${targetPlatform}-${targetArch} prebuilt binaries for electron successfully installed from upstream...`,
		);
        return {
            targetPlatform,
            targetArch,
            name: module.name,
            module,
            toBuild: false
        };

	} catch (err) {
		log(
			`\t ${module.name} - v${module.version} - for ${targetPlatform}-${targetArch} no upstream prebuilt ${module.name} binaries for electron (ABI ${electron.abi}) nor NAPI.`,
		);
        return {
            targetPlatform,
            targetArch,
            name: module.name,
            module,
            toBuild: true
        };
	}
}

export async function writePkgTpl({moduleName, targetPlatform, targetArch, version, scopedPkgPath}){
    
    const pkgTpl = {
        "name": `@hck/${moduleName}-${targetPlatform}-${targetArch}`,
        "version": version,
        "main": `${moduleName}.node`,
        "repository": {
            "type": "git",
            "url": "https://github.com/hackolade/custom-native-deps-prebuilds.git"
        },
        "publishConfig": {
            "access": "public"
        },
        "files": [
            `${moduleName}.node`,
        ]
    };
    await writeFile(path.resolve(scopedPkgPath, 'package.json'), JSON.stringify(pkgTpl));
}

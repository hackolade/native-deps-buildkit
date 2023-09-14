import {join, resolve} from "node:path";
import {readdir, writeFile} from "node:fs/promises";
import {ROOT_DIR} from "#root";
import {discoverRegularNativeModules, getElectronAbi} from "#lib/module.js";
import {installAvailablePrebuilts} from "#lib/install.js";
import {log} from "#lib/logger.js";
import {exec, npmCommand} from '#lib/commands.js';

// run patch package
await exec(
    npmCommand,
    [
        'run', 
        `patch-package`,
    ]
);

const electron = await getElectronAbi();
const installedNativeModules = await discoverRegularNativeModules(join(ROOT_DIR, 'node_modules'));

log('discovered native modules: %O', installedNativeModules);

const targets = [{targetPlatform: 'darwin', targetArch : 'arm64'}, {targetPlatform: 'darwin', targetArch : 'x64'}, {targetPlatform: 'linux', targetArch : 'x64'}, {targetPlatform: 'win32', targetArch : 'x64'}];

const custom = [];

for( const module of installedNativeModules){
    for( const {targetPlatform, targetArch} of targets){
        const installOutput = await installAvailablePrebuilts({module, targetPlatform, targetArch, electron});
        if(installOutput.toBuild){
            custom.push(installOutput);
        }
    }
}

await writeFile(resolve(ROOT_DIR, 'modulesToBuild.json'), JSON.stringify(custom));
// write to file as input for other platforms



// trigger other jobs for each platform and upload artifacts
//https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts

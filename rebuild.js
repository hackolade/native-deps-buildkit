import { LOGGER } from '#lib/logger.js';
import { build } from '#lib/build.js';
import modules from './modulesToBuild.json' assert { type: 'json' };
import {rescopeOfficialPrebuildsFromPackage} from './lib/pack.js';
import { ROOT_DIR } from '#root';
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
        return dep;
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

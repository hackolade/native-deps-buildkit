import { build } from '#lib/build.js';
import modules from './modulesToBuild.json' assert { type: 'json' };
import { LOGGER } from '#lib/logger.js';
import { ROOT_DIR } from '#root';
import { runPatchPackage } from './lib/install.js';
import { publishToNPM } from './lib/publish.js';

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

log('Building modules: %O', modulesToBuild);
const modulesToPublish = [];

for( const module of modulesToBuild){
    const [moduleToPublish] = await build(module);
    modulesToPublish.push(moduleToPublish);
}

log('module prebuilds to publish to NPM registry: %O', modulesToPublish);

const toPublish = modulesToPublish.flat();
if(toPublish.length > 0){
    log('module prebuilds to publish to NPM registry: %O', toPublish);
    for(const moduleToPublishBaseDir of toPublish){
        await publishToNPM(moduleToPublishBaseDir);
    }
}
else{
    log('no module prebuilds to publish to NPM registry!');
}

import { getNativeModulesMetadata } from '../lib/build-metadata.js';
import {
	installAllPrebuildsProvidedAsNPMDependencies,
	installPrebuiltsForTargets,
	runPatchPackage,
} from '../lib/install.js';
import { rescopeOfficialPrebuildsFromPackage } from '../lib/pack.js';
import { publishToNPM } from '../lib/publish.js';
import { writeFile } from 'node:fs/promises';
import { ROOT_DIR } from '#root';
import { resolve } from 'node:path';

const modulesBuildMetadata = await getNativeModulesMetadata();

await installAllPrebuildsProvidedAsNPMDependencies(modulesBuildMetadata);

for (const moduleMeta of modulesBuildMetadata.filter(({ prebuilds_as_npm_packages }) => !prebuilds_as_npm_packages)) {
	await installPrebuiltsForTargets(moduleMeta);
}

await runPatchPackage();

const moduleToPublish = await rescopeOfficialPrebuildsFromPackage({ buildMetadata: modulesBuildMetadata });

// write to file as input for rebuild custom prebuilds
await writeFile(resolve(ROOT_DIR, 'modulesToBuild.json'), JSON.stringify(modulesBuildMetadata));

for (const moduleToPublishBaseDir of moduleToPublish) {
	await publishToNPM(moduleToPublishBaseDir);
}

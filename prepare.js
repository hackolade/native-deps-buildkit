import { join, resolve } from 'node:path';
import { env } from 'node:process';
import { writeFile } from 'node:fs/promises';
import { ROOT_DIR } from '#root';
import { discoverRegularNativeModules, getElectronAbi } from '#lib/module.js';
import { installAvailablePrebuilts } from '#lib/install.js';
import { log } from '#lib/logger.js';
import { exec, npmCommand, npxCommand } from '#lib/commands.js';
import {
	checkPackageVersionExistsFromPath,
	publishToGitHubPackages,
	prepareParcelWatcherPrebuildsPackages,
	normalizeNativeModulesUnderHackolade,
} from '#lib/publish.js';

await exec(npmCommand, [
	'install',
	'--force',
	'--no-save',
	'@parcel/watcher-darwin-arm64@2.3.0',
	'@parcel/watcher-darwin-x64@2.3.0',
	'@parcel/watcher-linux-arm64-glibc@2.3.0',
	'@parcel/watcher-linux-x64-glibc@2.3.0',
	'@parcel/watcher-win32-x64@2.3.0',
]);

// run patch package
await exec(npxCommand, [`patch-package`]);

const electron = await getElectronAbi();
const installedNativeModules = await discoverRegularNativeModules(join(ROOT_DIR, 'node_modules'));

log('discovered native modules: %O', installedNativeModules);

const targets = [
	{ targetPlatform: 'darwin', targetArch: 'arm64' },
	{ targetPlatform: 'darwin', targetArch: 'x64' },
	{ targetPlatform: 'linux', targetArch: 'x64' },
	{ targetPlatform: 'win32', targetArch: 'x64' },
];

const custom = [];
const customizedNativeModules = await normalizeNativeModulesUnderHackolade(installedNativeModules);
const parcelPrebuilds = await prepareParcelWatcherPrebuildsPackages();

const toPublish = [...parcelPrebuilds, ...customizedNativeModules];

for (const module of installedNativeModules) {
	for (const { targetPlatform, targetArch } of targets) {
		const installOutput = await installAvailablePrebuilts({
			module,
			targetPlatform,
			targetArch,
			electron,
		});

		log("##########################@ %O", installOutput);
		if (installOutput.toBuild) {
			custom.push(installOutput);
		} else {
			toPublish.push(installOutput.scopedPackagePath);
		}
	}
}

// write to file as input for other platforms
await writeFile(resolve(ROOT_DIR, 'modulesToBuild.json'), JSON.stringify(custom));

log('publishing packages to internal GitHub registry of Hackolade organization...');

const filterOutPackagesWithVersionAlreadyPublished = await Promise.all(
	toPublish.map(async packagePath => {
		const token = env.NODE_AUTH_TOKEN;
		return await checkPackageVersionExistsFromPath({token, packagePath});
	})
);


const finalPackageListToPublish = filterOutPackagesWithVersionAlreadyPublished.filter(({name,  version, isPackageVersionAlreadyPublished}) => {
	
	if(isPackageVersionAlreadyPublished){
		const githubPackageVersionsURL = `https://github.com/orgs/hackolade/packages/npm/${name}/versions`;
		const deletePackageCurlCmd = `curl -L -X DELETE -H "Accept: application/vnd.github+json" -H "Authorization: Bearer <token>" "https://api.github.com/orgs/hackolade/packages/npm/${name}"`;
		log('--> skip publish package %o with version %o is already published to GitHub packages', name, version );
		log('--> check %o to delete the version %o', githubPackageVersionsURL, version );
		log('--> or use the following command with your Personal Access Token to delete the version %o', deletePackageCurlCmd );
	}
	return !isPackageVersionAlreadyPublished;
})

for (const {packagePath} of finalPackageListToPublish) {
	await publishToGitHubPackages(packagePath);
	log('---> %o published', packagePath);
}

// then trigger other jobs for each platform and upload artifacts
//https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts
// This is done as GitHub actions steps

import { LOGGER } from '#lib/logger.js';
import { cp, mkdir, readdir, rm } from './fs.js';
import { writeFile } from 'fs/promises';
import { join } from 'node:path';
import { readPackageData } from './module.js';
import { sanitizeModulePackageJSON } from './build-metadata.js';

const log = LOGGER.extend('pack');

async function relocatePrebuildAndBinaries({
	baseDir,
	relocatePrebuilds,
	isWindows,
	mainFromConfig,
	filesFromConfig = [],
}) {
	log('relocatePrebuildAndBinaries from base directory: %o', baseDir);
	log('relocatePrebuildAndBinaries: %o', filesFromConfig);
	if (relocatePrebuilds) {
		if (mainFromConfig) {
			if (isWindows) {
				return {
					main: `${mainFromConfig}.exe`,
					files: filesFromConfig.map(fileEntry => `${fileEntry}.exe`),
				};
			}
			return {
				main: mainFromConfig,
				files: filesFromConfig,
			};
		} else {
			const pkgFiles = await readdir(baseDir);
			const [prebuild] = pkgFiles
				.filter(entry => entry.isFile() && entry.name.endsWith('.node'))
				.map(entry => join(baseDir, entry.name));

			const prebuildName = 'prebuild.node';
			await cp({ src: prebuild, dest: join(baseDir, prebuildName) });

			const files = [prebuildName];

			return { files, main: prebuildName };
		}
	} else {
		return {};
	}
}

export async function pack({
	srcBaseDir,
	destBaseDir,
	packageJSONData,
	modulesToPublish,
	mainFromConfig,
	filesFromConfig,
	relocatePrebuilds = true,
}) {
	log('pack module from base directory: %o to %o', srcBaseDir, destBaseDir);
	await rm(destBaseDir);
	await mkdir(destBaseDir);

	await cp({ src: srcBaseDir, dest: destBaseDir });
	await rm(join(destBaseDir, 'deps'))

	const isWindows = packageJSONData?.name?.includes('-win32-');
	const prebuildMeta = await relocatePrebuildAndBinaries({
		baseDir: destBaseDir,
		mainFromConfig,
		filesFromConfig,
		isWindows,
		relocatePrebuilds,
	});
	log('prepare package.json for module in directory: %o ', destBaseDir);
	log('prepare package.json using files: %o ', filesFromConfig);
	await writeFile(join(destBaseDir, 'package.json'), JSON.stringify({ ...packageJSONData, ...prebuildMeta,}));

	modulesToPublish.push(destBaseDir);
	return destBaseDir;
}

export async function rescopeOfficialPrebuildsFromPackage({ buildMetadata, rescopeOnlyPrebuilds = false }) {
	const toPublish = [];

	for (const meta of buildMetadata) {
		log(">>>>>>>>>>>> RESCOPE: %O", meta);
		if (!rescopeOnlyPrebuilds) {
			const modulePkg = await readPackageData(meta.moduleBaseDir);
			const newJSONPkg = sanitizeModulePackageJSON({
				rescopedModuleName: meta.rescopedModuleName,
				modulePkg,
				version: meta.version,
			});
			await pack({
				srcBaseDir: meta.moduleBaseDir,
				destBaseDir: meta.rescopedModuleBaseDir,
				packageJSONData: newJSONPkg.modulePkg,
				modulesToPublish: toPublish,
				relocatePrebuilds: false,
			});
		}
		for (const {moduleBaseDir, modulePkg: modulePkgMeta ,rescopedModuleBaseDir, prebuildsAsNpmDependencies, rescopedModuleName} of meta.prebuildsAsNpmDependencies) {
			if (meta.prebuilds_as_npm_packages) {
				const modulePkg = await readPackageData(moduleBaseDir);
				const newJSONPkg = sanitizeModulePackageJSON({
					prebuildsAsNpmDependencies,
					rescopedModuleName,
					modulePkg,
					version: meta.version,
					isPrebuild: true,
				});

				await pack({
					srcBaseDir: moduleBaseDir,
					destBaseDir: rescopedModuleBaseDir,
					packageJSONData: newJSONPkg.modulePkg,
					modulesToPublish: toPublish,
					mainFromConfig: meta.prebuildPackageMainEntry,
					filesFromConfig: meta.prebuildPackageFiles,
				});
			} else {
				if (!meta.to_build) {
					await pack({
						srcBaseDir: moduleBaseDir,
						destBaseDir: rescopedModuleBaseDir,
						packageJSONData: modulePkgMeta,
						modulesToPublish: toPublish,
						mainFromConfig: meta?.prebuildPackageMainEntry,
						filesFromConfig: meta?.prebuildPackageFiles,
					});
				}
			}
		}
	}
	return toPublish;
}

import path from 'node:path';

import { readFile, readdir } from 'node:fs/promises';
import { ROOT_DIR } from '#root';

export async function readPackageData(modulePath) {
	const rawPkgAsJson = await readFile(path.join(modulePath, 'package.json'));

	return JSON.parse(rawPkgAsJson.toString('utf8'));
}

export const PROJECT_NODE_MODULES = path.join(ROOT_DIR, 'node_modules');

export async function listModulesInBaseDirectory(baseDirectory) {
	const installedModules = await readdir(baseDirectory, {
		withFileTypes: true,
	});
	const scopes = installedModules.filter(fsEntry => fsEntry.isDirectory() && fsEntry.name.startsWith('@'));

	const scopedModules = await Promise.all(
		scopes.map(async fsEntry => {
			const packages = await readdir(path.join(baseDirectory, fsEntry.name), {
				withFileTypes: true,
			});

			return packages
				.filter(fsEnt => fsEnt.isDirectory())
				.map(fsEnt => path.join(PROJECT_NODE_MODULES, fsEntry.name, fsEnt.name));
		}),
	);

	const topLevelModules = installedModules
		.filter(fsEntry => fsEntry.isDirectory() && !fsEntry.name.startsWith('@'))
		.map(fsEntry => path.join(PROJECT_NODE_MODULES, fsEntry.name));

	return [...topLevelModules, ...scopedModules].flat();
}

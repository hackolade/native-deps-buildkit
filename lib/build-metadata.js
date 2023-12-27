import pkg from '../package.json' assert { type: 'json' };
import electron from 'electron/package.json' assert { type: 'json' };
import semver from 'semver';
import { join, resolve, sep } from 'node:path';

import { PROJECT_NODE_MODULES, listModulesInBaseDirectory, readPackageData } from './module.js';

export const electronVersion = semver.major(electron.version);

export const npmScope = '@hackolade';

export const { buildMetadata } = pkg;
export const { nativeModules } = buildMetadata;

export const targets = ['linux-x64', 'darwin-arm64', 'darwin-x64', 'win32-x64'];
export const targetsDetails = [
	{
		targetPlatform: 'linux',
		targetArch: 'x64',
	},
	{
		targetPlatform: 'darwin',
		targetArch: 'x64',
	},
	{
		targetPlatform: 'darwin',
		targetArch: 'arm64',
	},
	{
		targetPlatform: 'win32',
		targetArch: 'x64',
	},
];

export const setModuleNameWithoutScopeUnderNewScope = name => `${npmScope}/${name}`;

export const scopeReplacementRexp = scope => new RegExp(scope, 'gi');

export function getModuleNameWithoutScope({ name, scope }) {
	if (scope && scope !== '') {
		return name.replaceAll(scopeReplacementRexp(scope), '').replaceAll('/', '', 'gi');
	}

	return name;
}

export function rescopeModuleBaseDir({ moduleBaseDir, scope, newScope }) {
	if (scope && scope !== '' && moduleBaseDir.includes(scope)) {
		return moduleBaseDir.replaceAll(scopeReplacementRexp(scope), `${newScope}${sep}`);
	}

	const moduleBaseDirParts = moduleBaseDir.split(sep);
	const module = moduleBaseDirParts.pop();

	return resolve(sep, ...moduleBaseDirParts, newScope, module);
}

export function rescopePackage({ name, moduleBaseDir, scope }) {
	return {
		rescopedModuleName: setModuleNameWithoutScopeUnderNewScope(getModuleNameWithoutScope({ name, scope })),
		rescopedModuleBaseDir: rescopeModuleBaseDir({ moduleBaseDir, scope, newScope: npmScope }),
	};
}

export async function getOfficialPrebuildsFromNpmOptionalDependencies({ scope, optionalDependencies = [], version }) {
	const keepOnlyPrebuildsForTargetPlatforms = dependencyName =>
		targets.filter(target => dependencyName.includes(target)).length > 0 && !dependencyName.includes('musl');

	return Promise.all(
		Object.entries(optionalDependencies)
			.filter(([depName, _]) => keepOnlyPrebuildsForTargetPlatforms(depName))
			.map(async ([name, sourceVersion]) => {
				const npmInstallPragma = `${name}@${sourceVersion}`;
				const moduleBaseDir = join(PROJECT_NODE_MODULES, name);

				const meta = {
					npmInstallPragma,
					moduleBaseDir,
					...rescopePackage({ name, moduleBaseDir, scope }),
				};

				const dependencyToAddToRescopedParentPackage = { [meta.rescopedModuleName]: version };

				return { ...meta, dependencyToAddToRescopedParentPackage };
			}),
	);
}

export async function getPrebuildsMetadata({ name, version, scope }) {
	return targetsDetails.map(({ targetPlatform, targetArch }) => {
		const moduleName = `${name}-${targetPlatform}-${targetArch}`;
		const moduleBaseDir = join(PROJECT_NODE_MODULES, moduleName);
		const prebuildBaseDir = join(PROJECT_NODE_MODULES, name, 'prebuilds', `${targetPlatform}-${targetArch}`);
		const meta = rescopePackage({ name: moduleName, moduleBaseDir, scope });

		const dependencyToAddToRescopedParentPackage = { [meta.rescopedModuleName]: version };

		const modulePkg = getPackageJSONForPrebuild({ name: meta.rescopedModuleName, version });

		return {
			...meta,
			modulePkg,
			moduleBaseDir: prebuildBaseDir,
			dependencyToAddToRescopedParentPackage,
			targetPlatform,
			targetArch,
		};
	});
}

export async function definePrebuildsAsNPMDependencies({
	prebuilds_as_npm_packages,
	name,
	version,
	scope,
	optionalDependencies,
}) {
	if (prebuilds_as_npm_packages) {
		return await getOfficialPrebuildsFromNpmOptionalDependencies({
			scope,
			optionalDependencies,
			version,
		});
	}

	return await getPrebuildsMetadata({
		name,
		scope,
		optionalDependencies,
		version,
	});
}

export async function getNativeModulesMetadata() {
	const moduleInstalledPaths = await listModulesInBaseDirectory(PROJECT_NODE_MODULES);

	const nativeModulesWithProjectPath = Object.entries(nativeModules).map(async ([moduleName, meta]) => {
		const baseDirectories = moduleInstalledPaths.filter(path => {
			return path.endsWith(`${sep}${moduleName.replaceAll('/', sep, 'g')}`);
		});

		const [moduleBaseDir] = baseDirectories;
		const modulePkg = await readPackageData(moduleBaseDir, moduleName);
		const { optionalDependencies } = modulePkg;
		const scope = meta.prebuilds_scope;
		const version = meta.version;

		const prebuildsAsNpmDependencies = await definePrebuildsAsNPMDependencies({
			...meta,
			name: moduleName,
			scope,
			optionalDependencies,
			version,
		});

		const metadata = {
			name: moduleName,
			version,
			prebuildsAsNpmDependencies,
			moduleBaseDir,
			...rescopePackage({ name: moduleName, moduleBaseDir, scope }),
			...meta,
		};
		const newPackageJson = sanitizeModulePackageJSON({ modulePkg, version, ...metadata });

		return {
			...metadata,
			...newPackageJson,
		};
	});

	return Promise.all(nativeModulesWithProjectPath);
}

export const getPackageJSONForPrebuild = ({ name, version }) => {
	const files = ['*.node'];

	const pkg = {
		name,
		version,
		files: files,
		description: `Node Prebuild for ${name}`,
		repository: { type: 'git', url: 'https://github.com/hackolade/native-deps-buildkit.git' },
	};

	return pkg;
};

// Tweak package.json to remove useless information
export function sanitizeModulePackageJSON({
	modulePkg,
	rescopedModuleName,
	version,
	prebuildsAsNpmDependencies = [],
	isPrebuild = false,
}) {
	delete modulePkg.repository;
	delete modulePkg.funding;
	delete modulePkg.cpu;
	delete modulePkg.os;
	delete modulePkg.devDependencies;
	delete modulePkg.scripts;
	delete modulePkg.husky;
	if (modulePkg.dependencies && modulePkg.dependencies['prebuild-install']) {
		delete modulePkg.dependencies['prebuild-install']; // should be patched but this is there to make sure we don't embed useless dependencies
	}
	if (modulePkg.dependencies && modulePkg.dependencies['bindings']) {
		delete modulePkg.dependencies['bindings']; // the module should be patched to avoid having to use this package and just require the expected prebuild as an npm dependency directly
	}
	delete modulePkg.gypfile;
	delete modulePkg.bugs;
	delete modulePkg.tsd;
	delete modulePkg.keywords;
	delete modulePkg.optionalDependencies;
	delete modulePkg.readmeFilename;
	delete modulePkg.libc;

	if (modulePkg['lint-staged']) {
		delete modulePkg['lint-staged'];
	}

	modulePkg.name = rescopedModuleName;
	modulePkg.repository = { type: 'git', url: 'https://github.com/hackolade/native-deps-buildkit.git' };

	const sourceVersionBeforeRescoping = modulePkg.version;
	modulePkg.version = version;

	const upstreamDescription = modulePkg.description;

	modulePkg.description = `Re-published version to have all prebuilds defined as npm packages without platform constraints for cross building an Electron application - ${upstreamDescription}`;
	if (!isPrebuild) {
		const prebuildsDependencies =
			prebuildsAsNpmDependencies.length === 0
				? {
						[`${modulePkg.name}-linux-x64`]: version,
						[`${modulePkg.name}-win32-x64`]: version,
						[`${modulePkg.name}-darwin-x64`]: version,
						[`${modulePkg.name}-darwin-arm64`]: version,
				  }
				: prebuildsAsNpmDependencies
						.map(({ dependencyToAddToRescopedParentPackage }) => dependencyToAddToRescopedParentPackage)
						.reduce((acc, prebuildDep) => {
							return { ...acc, ...prebuildDep };
						}, {});

		const sourceDependenciesWithoutPrebuildsAsNpmPackages = modulePkg.dependencies;
		modulePkg.dependencies = { ...sourceDependenciesWithoutPrebuildsAsNpmPackages, ...prebuildsDependencies };
	}

	return { sourceVersionBeforeRescoping, modulePkg };
}

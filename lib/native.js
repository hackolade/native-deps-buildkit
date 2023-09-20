// because with prebuildify the prebuilt binaries are provided by the source package
// for all platforms and archs we don't need to worry about these packages as they provide the expected structure already
const prebuildified = pkg =>
	(pkg.devDependencies && pkg.devDependencies.prebuildify) || (pkg.dependencies && pkg.dependencies.prebuildify);

export const isNative = pkg => {
	return Boolean(
		!prebuildified(pkg) &&
			pkg.dependencies &&
			(pkg.dependencies.bindings ||
				pkg.dependencies.prebuild ||
				pkg.dependencies['prebuild-install'] ||
				pkg.dependencies['node-addon-api'] ||
				pkg.dependencies['node-pre-gyp'] ||
				pkg.dependencies['node-gyp'] ||
				pkg.dependencies['node-gyp-build']),
	);
};

export const isNAPI = pkg => {
	return Boolean(isNative && pkg.binary && pkg.binary.napi_versions);
};

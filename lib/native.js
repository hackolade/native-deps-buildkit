export const isNative = pkg => {
	return Boolean(
				( pkg.dependencies &&
					(
						pkg.dependencies.bindings ||
						pkg.dependencies.prebuild ||
						pkg.dependencies['prebuild-install'] ||
						pkg.dependencies['node-addon-api'] ||
						pkg.dependencies['node-pre-gyp'] ||
						pkg.dependencies['node-gyp'] ||
						pkg.dependencies['node-gyp-build']
					)
				) ||
				( pkg.devDependencies &&
					(
						pkg.devDependencies.prebuild ||
						pkg.devDependencies['prebuild-install'] ||
						pkg.devDependencies['node-gyp'] ||
						pkg.devDependencies['node-gyp-build']
					)
				)
	);
};

export const isNAPI = pkg => {
	return Boolean(isNative && pkg.binary && pkg.binary.napi_versions);
};

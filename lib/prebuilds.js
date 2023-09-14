async function prebuildNativeModule(moduleDescriptor, dir) {
	logger.info('prebuilding native module: %o for version %o', moduleDescriptor.name, moduleDescriptor.version);

	logger.info('prebuilding native module: %o for electron', moduleDescriptor.name);

	await exec(npxCommand, ['electron-rebuild', '-o', moduleDescriptor.name], {
		cwd: dir,
	});
}

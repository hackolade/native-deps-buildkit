import { log } from '#lib/logger.js';
import { exec, npmCommand } from '#lib/commands.js';

export async function prebuildNativeModule({ name, baseDir }) {
	log('prebuilding native module: %o for electron', name);

	await exec("/Users/runner/hostedtoolcache/node/18.17.1/x64/bin/npm", ['install'], {
		cwd: baseDir,
	});
	await exec(npmCommand, ['run', 'rebuild'], {
		cwd: baseDir,
	});
}

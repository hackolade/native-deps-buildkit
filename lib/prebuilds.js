import { log } from '#lib/logger.js';
import { exec, npmCommand } from '#lib/commands.js';
import { access } from "node:fs/promises";

export async function prebuildNativeModule({ name, baseDir }) {
	log('prebuilding native module: %o for electron', name);

	log('check cwd exists: %o ...', baseDir);
	try{
		await access(baseDir);
		log('[OK] executing in cwd: %o ...', baseDir);
	}catch(err){
		log('[ERROR] cwd does not exists: %o ...', baseDir);
		throw err
	}

	await exec(npmCommand, [ 'install' ], {
		cwd: baseDir,
	});

	await exec(npmCommand, ['run', 'rebuild'], {
		cwd: baseDir,
	});
}

import os from 'node:os';
import {stderr, stdout } from 'node:process';
import { spawn } from 'node:child_process';
import { log } from '#lib/logger.js';

const runtimePlatformIsWindows = os.platform() === 'win32';

export const npmCommand = runtimePlatformIsWindows ? 'npm.cmd' : 'npm';
export const npxCommand = runtimePlatformIsWindows ? 'npx.cmd' : 'npx';
export const prebuildCommand = runtimePlatformIsWindows ? 'prebuild-install.cmd' : 'prebuild-install';

export const exec = (command, parameters, options) =>
	new Promise((resolve, reject) => {
		log('spawn cmd: %o', `${command} ${parameters.join(' ')}`);
		const proc = spawn(command, parameters, options);

		proc.stdout.pipe(stdout);
		proc.stderr.pipe(stderr);

		proc.on(runtimePlatformIsWindows ? 'exit' : 'close', code => {
			if (code === 0) {
				resolve(0);
			} else {
				reject(code);
			}
		});

		proc.on('error', error => {
			log('[error] exec process: %O', error);
			reject(1);
		});
	});

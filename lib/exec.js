import { platform } from 'node:os';
import { spawn } from 'node:child_process';
import { stderr, stdout } from 'node:process';
import { LOGGER } from './logger.js';

const log = LOGGER.extend('exec');

export const windowsPlatformID = 'win32';
export const runtimePlatformIsWindows = platform() === windowsPlatformID;

export const exec = ({ command, parameters, options, silentStdout = false, silentStderr = false }) =>
	new Promise((resolve, reject) => {
		log('spawn cmd: %o parameters', command, parameters);
		const proc = spawn(command, parameters, options);

		if (!silentStdout) {
			proc.stdout.on('data', x => {
				stdout.write(x.toString());
			});
		}
		if (!silentStderr) {
			proc.stderr.on('data', x => {
				stderr.write(x.toString());
			});
		}

		proc.on(runtimePlatformIsWindows ? 'exit' : 'close', code => {
			if (code === 0) {
				resolve({ code, stdout });
			} else {
				reject({ code });
			}
		});

		proc.on('error', error => {
			log('[error] exec process: %O', error);
			const code = 1;
			reject({ code });
		});
	});

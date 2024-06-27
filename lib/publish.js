import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LOGGER } from '#lib/logger.js';
import { npmCommand } from '#lib/commands.js';
import { exec } from '#lib/exec.js';
import { publish } from 'libnpmpublish';
import pack  from 'libnpmpack';
import { env } from 'node:process';

const log = LOGGER.extend('publish');

export const npmrc = `
        //registry.npmjs.org/:_authToken=\${NODE_AUTH_TOKEN}
        always-auth=true`;

export async function checkPackageVersionAlreadyExistsOnNPM({ name, version }) {
	log('--> checking package %o has version %o already published to https://www.npmjs.com', name, version);

	try {
		await exec({
			command: npmCommand,
			parameters: ['view', `${name}@${version}`, 'version', '--json'],
			silentStderr: true,
			silentStdout: true,
			options: {shell: true}
		});

		return true;
	} catch (_) {
		return false;
	}
}

export async function publishToNPM(scopedPackagePath) {
	const pkgRaw = await readFile(path.join(scopedPackagePath, 'package.json'));
	const pkg = JSON.parse(pkgRaw);
	pkg.scripts =  {};
	log("Package before publish from path: %O", path.join(scopedPackagePath, 'package.json'));
	log("Package before publish: %O", pkg);
	await writeFile(path.join(scopedPackagePath, 'package.json'), JSON.stringify(pkg));
	const { name, version } = pkg;

	const doesPackageExistsOnNPM = await checkPackageVersionAlreadyExistsOnNPM({ name, version });

	if (doesPackageExistsOnNPM) {
		log('--> skip publish package %o with version %o is already published to https://www.npmjs.com', name, version);
		log('--> consider bumping the version in package.json buildMetadata the version.');
		return false;
	} else {
		log('--> package %o with version %o is not yet published to https://www.npmjs.com', name, version);
		log('publishing package to registry of Hackolade organization from %o', scopedPackagePath);

		const tarball = await pack(scopedPackagePath);

		await publish(pkg, tarball, {
			access: 'public',
			forceAuth: {
				token: env.NODE_AUTH_TOKEN,
			},
		});
		return true;
	}
}

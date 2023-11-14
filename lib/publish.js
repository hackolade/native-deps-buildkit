import { readFile,  writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LOGGER } from '#lib/logger.js';
import { npmCommand } from '#lib/commands.js';
import { exec } from '#lib/exec.js';

const log = LOGGER.extend('publish');

export const npmrc = `
        //registry.npmjs.org/:_authToken=\${NODE_AUTH_TOKEN}
        always-auth=true`;

export async function publishToGitHubPackages(scopedPackagePath) {
	await writeFile(path.join(scopedPackagePath, '.npmrc'), ghPackageNpmrc);
	await exec(npmCommand, ['publish' ], { cwd: scopedPackagePath });
}

export async function checkPackageVersionAlreadyExistsOnNPM({name, version}){
	log('--> checking package %o has version %o already published to https://www.npmjs.com', name, version);

	try{
		await exec({
			command: npmCommand,
			parameters: ['view', `${name}@${version}`, 'version', '--json'],
			silentStderr: true,
			silentStdout: true
		});

		return true;
	}catch(_){
		return false;
	}
}

export async function publishToNPM(scopedPackagePath) {
	const pkg = await readFile(path.join(scopedPackagePath, 'package.json'));
	const {name, version} = JSON.parse(pkg);

	const doesPackageExistsOnNPM = await checkPackageVersionAlreadyExistsOnNPM({name, version});
	if(doesPackageExistsOnNPM){
		log('--> skip publish package %o with version %o is already published to https://www.npmjs.com', name, version );
		log('--> consider bumping the version in package.json buildMetadata the version.' );
	}else{
		log('--> package %o with version %o is not yet published to https://www.npmjs.com', name, version );
		log('publishing package to registry of Hackolade organization from %o', scopedPackagePath);
		await writeFile(path.join(scopedPackagePath, '.npmrc'), npmrc);
		await exec({
			command: npmCommand, parameters: ['publish' ], options: { cwd: scopedPackagePath }});
	}
}

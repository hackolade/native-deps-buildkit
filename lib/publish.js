import { cp, mkdir, readFile, readdir, stat, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from '#root';
import pkg from '../package.json' assert { type: 'json' };
import electron from 'electron/package.json' assert { type: 'json' };
import semver from 'semver';
import { LOGGER } from '#lib/logger.js';
import { npmCommand } from '#lib/commands.js';
import { exec } from '#lib/exec.js';
import {} from '#lib/install.js';
import { Octokit } from '@octokit/rest';
import os from 'node:os';

const log = LOGGER.extend('publish');

let githubClient;

const createGithubClient = token => new Octokit({ auth: token });

const getGithubClient = token => {
	if (githubClient) {
		return githubClient;
	}

	githubClient = createGithubClient(token);
	return githubClient;
};

// forces @hackolade organization scope to be published to Github Packages
export const ghPackageNpmrc = `
        //npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
        @hackolade:registry=https://registry.npmjs.org
        always-auth=true`;

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

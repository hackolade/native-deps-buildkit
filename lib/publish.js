import { cp, mkdir, readFile, readdir, stat, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from '#root';
import electron from 'electron/package.json' assert { type: 'json' };
import semver from 'semver';
import { log } from '#lib/logger.js';
import { exec, npmCommand } from '#lib/commands.js';
import { Octokit } from '@octokit/rest';

let githubClient;

const createGithubClient = token => new Octokit({ auth: token });

const getGithubClient = token => {
	if (githubClient) {
		return githubClient;
	}

	githubClient = createGithubClient(token);
	return githubClient;
};

export const electronVersion = semver.major(electron.version);
export const githubOrganizationScope = '@hackolade';

// forces @hackolade organization scope to be published to Github Packages
export const ghPackageNpmrc = `
        //npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
        @hackolade:registry=https://npm.pkg.github.com
        always-auth=true`;

export const pkgTpl = ({ githubOrganizationScope, moduleName, targetPlatform, targetArch, version, forOpenSSL1 }) => {
	const mainFile = (moduleName === 'desktop-trampoline' && 'desktop-trampoline') || 'prebuild.node';
	const opensslSuffix = forOpenSSL1? '-openssl1': '';

	return {
		name: `${githubOrganizationScope}/${moduleName}-${targetPlatform}-${targetArch}${opensslSuffix}`,
		version: `${version}-${electronVersion}`,
		main: mainFile,
		files: [mainFile],
		publishConfig: {
			"registry": "https://npm.pkg.github.com"
		}
	};
};

export async function writePkgTpl({ moduleName, targetPlatform, targetArch, version, scopedPackagePath, forOpenSSL1 }) {
	const packageJsonContentForModule = pkgTpl({
		githubOrganizationScope,
		moduleName,
		targetPlatform,
		targetArch,
		version,
		scopedPackagePath,
		forOpenSSL1,
	});
	await writeFile(path.resolve(scopedPackagePath, 'package.json'), JSON.stringify(packageJsonContentForModule));
}

export async function copyReleaseBuild({ module, scopedPackagePath }) {
	if (module.name === 'desktop-trampoline') {
		const prebuildSrc = path.join(module.baseDir, 'build', 'Release');
		await cp(prebuildSrc, scopedPackagePath, {force:true, recursive: true});
	} else {
		const releaseContent = await readdir(path.resolve(module.baseDir, 'build', 'Release'), {
			withFileTypes: true,
		});
		const [prebuild] = releaseContent
			.filter(entry => entry.isFile() && entry.name.endsWith('.node'))
			.map(entry => entry.name);
		const prebuildSrc = path.join(module.baseDir, 'build', 'Release', prebuild);
		await cp(prebuildSrc, path.join(scopedPackagePath, 'prebuild.node'), {force:true, recursive: true});
	}
}

export async function preparePackage({ module, targetPlatform, targetArch }) {
	const scopedPackagePath = path.join(
		ROOT_DIR,
		'node_modules',
		githubOrganizationScope,
		`${module.name}-${targetPlatform}-${targetArch}`,
	);
	await rm(scopedPackagePath, { force: true, recursive: true });
	await mkdir(scopedPackagePath, { force: true, recursive: true });

	await copyReleaseBuild({ module, scopedPackagePath });
	await writePkgTpl({
		moduleName: module.name,
		targetPlatform,
		targetArch,
		scopedPackagePath,
		version: module.version,
	});
	return scopedPackagePath;
}

//Parcel already publishes all the prebuilts as expected but with OS and CPU constraints
// forcing us to use npm install --force which we don't want to
export async function prepareParcelWatcherPrebuildsPackages() {
	log('prepare @parcel watcher dependencies...');
	const parcelScopedPackagesBasePath = path.join(ROOT_DIR, 'node_modules', '@parcel');
	const parcelPackages = await readdir(parcelScopedPackagesBasePath, {
		withFileTypes: true,
	});
	const parcelWatchPrebuilds = parcelPackages
		.filter(entry => entry.isDirectory() && !entry.name.includes('musl'))
		.map(entry => {
			return {
				dir: path.join(parcelScopedPackagesBasePath, entry.name),
				name: entry.name,
			};
		});

	const hackoladeScopedPackagesPaths = [];
	for (const { name, dir } of parcelWatchPrebuilds) {
		const hackoladeScopedPkgPath = path.join(ROOT_DIR, 'node_modules', '@hackolade', name);
		await mkdir(hackoladeScopedPkgPath, {
			force: true,
			recursive: true,
		});
		log('copy source files from %o under @hackolade scope to %o', dir, hackoladeScopedPkgPath);
		await cp(dir, hackoladeScopedPkgPath, { recursive: true, force: true, filter: (path) => !path.includes('.bin') });

		// Tweak package.json to remove useless information
		const pkgRaw = await readFile(path.join(hackoladeScopedPkgPath, 'package.json'));
		const pkg = JSON.parse(pkgRaw);
		delete pkg.repository;
		delete pkg.funding;
		delete pkg.cpu;
		delete pkg.os;
		delete pkg.scripts;


		pkg.name = `@hackolade/${name.replace(/\-glibc/gi, '')}`;
		pkg.repository= 'https://github.com/hackolade/native-deps-buildkit.git';
		const version = pkg.version;
		pkg.version = `${version}-${electronVersion}`;

		log('write new package.json with @hackolade scope for %o', name);
		await writeFile(path.join(hackoladeScopedPkgPath, 'package.json'), JSON.stringify(pkg));
		await writeFile(path.join(hackoladeScopedPkgPath, '.npmrc'), ghPackageNpmrc);
		hackoladeScopedPackagesPaths.push(hackoladeScopedPkgPath);
		log('-------------------------');
	}
	log('@parcel watcher dependencies moved under @hackolade scope');
	return hackoladeScopedPackagesPaths;
}

export async function normalizeNativeModulesUnderHackolade(nativeModules) {
	log('moving native dependencies under @hackolade scope...');
	const hackoladeScopedPackagesPaths = [];
	for (const { name, baseDir } of nativeModules) {
		const sanitizedName = name.replaceAll(/@parcel/gi, '');
		const hackoladeScopedPkgPath = path.join(ROOT_DIR, 'node_modules', '@hackolade', sanitizedName);
		await mkdir(path.join(ROOT_DIR, 'node_modules', '@hackolade'), {
			force: true,
			recursive: true,
		});

		await cp(baseDir, hackoladeScopedPkgPath, { recursive: true, force: true });

		// Tweak package.json to remove useless information
		const pkgRaw = await readFile(path.join(hackoladeScopedPkgPath, 'package.json'));
		const pkg = JSON.parse(pkgRaw);
		delete pkg.repository;
		delete pkg.funding;
		delete pkg.cpu;
		delete pkg.os;
		delete pkg.devDependencies;
		delete pkg.scripts;

		pkg.name = `@hackolade/${sanitizedName}`;
		pkg.repository= 'https://github.com/hackolade/native-deps-buildkit.git';
		const version = pkg.version;

		const prebuildPkgVersion = `${version}-${electronVersion}`;

		pkg.version = `${version}-electron${electronVersion}`;
		const depsByTarget = {
			[`${pkg.name}-linux-x64`]: prebuildPkgVersion,
			[`${pkg.name}-win32-x64`]: prebuildPkgVersion,
			[`${pkg.name}-darwin-x64`]: prebuildPkgVersion,
			[`${pkg.name}-darwin-arm64`]: prebuildPkgVersion,
		};

		// add openssl1 variant for listed modules that require it
		if(name === 'couchbase'){
			depsByTarget[`${pkg.name}-linux-x64-openssl1`] = prebuildPkgVersion;
		}

		const deps = pkg.dependencies;
		pkg.dependencies = Object.assign(deps, depsByTarget);

		await writeFile(path.join(hackoladeScopedPkgPath, 'package.json'), JSON.stringify(pkg));
		await writeFile(path.join(hackoladeScopedPkgPath, '.npmrc'), ghPackageNpmrc);
		hackoladeScopedPackagesPaths.push(hackoladeScopedPkgPath);
	}
	log('native dependencies moved under @hackolade scope');
	return hackoladeScopedPackagesPaths;
}

export async function publishToGitHubPackages(scopedPackagePath) {
	await writeFile(path.join(scopedPackagePath, '.npmrc'), ghPackageNpmrc);
	await exec(npmCommand, ['publish' ], { cwd: scopedPackagePath });
}

// curl -L \
//   -H "Accept: application/vnd.github+json" \
//   -H "Authorization: Bearer <token>" \
//   "https://api.github.com/orgs/hackolade/packages/npm/couchbase/versions"
export async function checkPackageVersionAlreadyExists({token, packageName, version, packagePath}){
	// @hackolade scope is abstracted when calling the GitHub REST endpoint by implicitly setting up the organization
	// having the scope in the package name results always in NOT FOUND 404
	const name = packageName.replaceAll(/@hackolade\//gi, '');

	try{
		const client = getGithubClient(token);

		

		// https://docs.github.com/en/rest/packages/packages?apiVersion=2022-11-28#list-package-versions-for-a-package-owned-by-an-organization
		const response = await client.packages.getAllPackageVersionsForPackageOwnedByOrg({
			package_type: 'npm',
			org: 'hackolade',
			package_name: name,
			state: 'active'
		});

		const isPackageVersionAlreadyPublished = response.data.filter(({name}) => name === version).length > 0;

		return { name, version, isPackageVersionAlreadyPublished, packagePath };
	}catch(pkgError){
		if(pkgError.status === 404 ){
			const isPackageVersionAlreadyPublished = false;
			return { name, version, isPackageVersionAlreadyPublished, packagePath };
		}
		throw pkgError;
	}
}

export async function checkPackageVersionExistsFromPath({packagePath, token}){

	const pkg = await readFile(path.join(packagePath, 'package.json'));
	const {name, version} = JSON.parse(pkg);

	return await checkPackageVersionAlreadyExists({token, packageName: name, version, packagePath});
}
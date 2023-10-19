import { Octokit } from '@octokit/rest';
import { LOGGER } from '#lib/logger.js';

// kept for testing purpose when developping packages

const log = LOGGER.extend('github');

let githubClient;

const createGithubClient = token => new Octokit({ auth: token });

export const getGithubClient = token => {
	if (githubClient) {
		return githubClient;
	}

	githubClient = createGithubClient(token);
	return githubClient;
};

// forces @hackolade organization scope to be published to Github Packages
export const ghPackageNpmrc = `
        //npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
        @hackolade:registry=https://npm.pkg.github.com
        always-auth=true`;

// curl -L \
//   -H "Accept: application/vnd.github+json" \
//   -H "Authorization: Bearer <token>" \
//   "https://api.github.com/orgs/hackolade/packages/npm/couchbase/versions"
export async function checkPackageVersionAlreadyExists({ token, packageName, version, packagePath }) {
	// @hackolade scope is abstracted when calling the GitHub REST endpoint by implicitly setting up the organization
	// having the scope in the package name results always in NOT FOUND 404
	const name = packageName.replaceAll(/@hackolade\//gi, '');

	log('--> checking package %o has version %o already published to GitHub packages', packageName, version);

	try {
		const client = getGithubClient(token);

		// https://docs.github.com/en/rest/packages/packages?apiVersion=2022-11-28#list-package-versions-for-a-package-owned-by-an-organization
		const response = await client.packages.getAllPackageVersionsForPackageOwnedByOrg({
			package_type: 'npm',
			org: 'hackolade',
			package_name: name,
			state: 'active',
		});

		const isPackageVersionAlreadyPublished = response.data.filter(({ name }) => name === version).length > 0;

		return { name, version, isPackageVersionAlreadyPublished, packagePath };
	} catch (pkgError) {
		if (pkgError.status === 404) {
			const isPackageVersionAlreadyPublished = false;
			return { name, version, isPackageVersionAlreadyPublished, packagePath };
		}
		throw pkgError;
	}
}

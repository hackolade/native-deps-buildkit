import pkg from '../modulesToBuild.json' assert { type: 'json' };
import { platform } from 'node:os';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { publishToNPM } from '../lib/publish.js';

const deps = pkg.map(({ rescopedModuleName, version }) => `${rescopedModuleName}@${version}`);

const windowsSpecificDep = platform() === 'win32' ? ['@hackolade/winapi-detect-rdp@1.1.0'] : [];

const { default: studioNativesPkg } = await import('../studio-natives-modules/package.json', {
	assert: { type: 'json' },
});
studioNativesPkg.dependencies = [...deps, ...windowsSpecificDep];

await writeFile(resolve('./studio-natives-modules/package.json'), JSON.stringify(studioNativesPkg));
await publishToNPM(resolve('./studio-natives-modules'));

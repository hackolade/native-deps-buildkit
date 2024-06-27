import pkg from '../modulesToBuild.json' with { type: 'json' };
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { publishToNPM } from '../lib/publish.js';

const deps = pkg.map(({ name, rescopedModuleName, version }) => {
	return { [name]: `npm:${rescopedModuleName}@${version}`};
});

const windowsSpecificDep = [{'@hackolade/winapi-detect-rdp': '1.1.0'}];

const { default: studioNativesPkg } = await import('../studio-natives-modules/package.json', {
	with: { type: 'json' },
});
studioNativesPkg.dependencies = [...deps, ...windowsSpecificDep].reduce((acc, dep) => {return {...dep, ...acc}}, {});


console.log("- studio native modules pkg:", studioNativesPkg);
await writeFile(resolve('./studio-natives-modules/package.json'), JSON.stringify(studioNativesPkg));
await publishToNPM(resolve('./studio-natives-modules'));

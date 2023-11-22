import { npmCommand } from '../lib/commands.js';
import { exec } from '../lib/exec.js';

import pkg from '../modulesToBuild.json' assert { type: 'json' };
import { platform } from 'node:os';

const deps = pkg.map(({ rescopedModuleName, version }) => `${rescopedModuleName}@${version}`);

const windowsSpecificDep = platform() === 'win32' ? ['@hackolade/winapi-detect-rdp@1.1.0'] : [];

await exec({
	command: 'node',
	parameters: ['../node_modules/electron/install.js'],
});

await exec({
	command: npmCommand,
	parameters: ['install', '--save', 'false', '-w', 'test', ...deps, ...windowsSpecificDep],
});

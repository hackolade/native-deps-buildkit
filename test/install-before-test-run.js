import {npmCommand} from '../lib/commands.js';
import {exec} from '../lib/exec.js';

import pkg from '../modulesToBuild.json' assert { type: 'json' };
import { platform } from 'node:os';


const deps = pkg.map(({rescopedModuleName, version}) => `${rescopedModuleName}@${version}`);

const windowsSpecificDep = platform() === "wind32"? [ "@hackolade/winapi-detect-remote-desktop-addon-win32-x64@22.1.0" ]: [];
await exec(npmCommand, ['install','--save', 'false', '-w', 'test', ...deps, ...windowsSpecificDep]);

import {npmCommand, exec} from '../lib/commands.js';
import {electronVersion} from '../lib/publish.js';

import pkg from '../package.json' assert { type: 'json' };
import { platform } from 'node:os';


const deps = await Promise.all(Object.keys(pkg.dependencies).map(async (depName) => `@hackolade/${depName.replaceAll(/@parcel\//gi, '')}@${electronVersion}`));

const windowsSpecificDep = platform() === "wind32"? [ "winapi-detect-remote-desktop-addon-win32-x64" ]: [];
await exec(npmCommand, ['install','--save', 'false', '-w', 'test', ...deps, ...windowsSpecificDep]);

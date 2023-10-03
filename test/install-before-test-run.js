import {npmCommand, exec} from '../lib/commands.js';
import {electronVersion} from '../lib/publish.js';

import pkg from '../package.json' assert { type: 'json' };

for(const depName of Object.keys(pkg.dependencies) ){
    const sanitizedName = depName.replaceAll(/@parcel\//gi, '');
    await exec(npmCommand, ['install', '-w', 'test', `@hackolade/${sanitizedName}@${electronVersion}`])
}
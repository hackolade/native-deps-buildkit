import semver from 'semver';
import electron from 'electron/package.json' assert { type: 'json' };

console.log(semver.major(electron.version));

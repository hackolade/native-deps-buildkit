import semver from 'semver';
import electron from 'electron/package.json' with { type: 'json' };

console.log(semver.major(electron.version));

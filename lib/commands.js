import { runtimePlatformIsWindows } from './exec.js';

export const npmCommand = runtimePlatformIsWindows ? 'npm.cmd' : 'npm';
export const npxCommand = runtimePlatformIsWindows ? 'npx.cmd' : 'npx';
export const prebuildCommand = runtimePlatformIsWindows ? 'prebuild-install.cmd' : 'prebuild-install';

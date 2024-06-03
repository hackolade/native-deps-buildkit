import { runtimePlatformIsWindows } from './exec.js';

export const npmCommand = runtimePlatformIsWindows ? 'npm.ps1' : 'npm';
export const npxCommand = runtimePlatformIsWindows ? 'npx.ps1' : 'npx';

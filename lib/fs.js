import { cp as fsCP, mkdir as fsMKDIR, rename, readdir as fsREADDIR, rm as fsRM } from 'node:fs/promises';

export const defaultOptions = { force: true, recursive: true };

export async function cp({ src, dest }) {
	await fsCP(src, dest, defaultOptions);
}

export async function mkdir(dir) {
	await fsMKDIR(dir, defaultOptions);
}

export async function mv({ src, dest }) {
	await rename(src, dest);
}

export async function readdir(dir) {
	return await fsREADDIR(dir, {
		withFileTypes: true,
	});
}

export async function rm(fileOrDir) {
	await fsRM(fileOrDir, defaultOptions);
}

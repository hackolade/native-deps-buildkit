import  { expect } from 'chai';

import { stat, access } from 'fs/promises';
import { constants } from 'fs';

import { getDesktopTrampolinePath, getSSHWrapperPath } from '@hackolade/desktop-trampoline';

describe('desktop trampoline', async function () {
	this.timeout(10000);
	
	const trampolinePath = getDesktopTrampolinePath();
	const sshWrapperPath = getSSHWrapperPath();

	const testPathExec = async (path) => { 
		await access(path, constants.X_OK);
		return path;
	}

	it('desktop-trampoline binary executable exists and is a regular file', async function(){
		expect((await stat(trampolinePath)).isFile()).is.eq(true);
	});

	it('desktop-trampoline binary can be executed by current process', async function(){
		expect(await testPathExec(trampolinePath)).equals(trampolinePath);
	});

	it('ssh-wrapper binary executable exists and is a regular file', async function(){
		expect((await stat(sshWrapperPath)).isFile()).is.eq(true);
	});

	it('ssh-wrapper binary can be executed by current process', async function(){
		expect(await testPathExec(sshWrapperPath)).equals(sshWrapperPath);
	});
	
});


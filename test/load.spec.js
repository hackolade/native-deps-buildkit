import _ from 'lodash';
import  { expect } from 'chai';
import os from 'node:os';

describe('custom native modules', () => {
	it('kerberos should be imported', async function () {
		this.timeout(10000);
		const kerberos = await import('@hackolade/kerberos');

		expect(Boolean(kerberos), 'imported as falsy value').to.be.equal(true);
	});

	it('kerberos for plugins should be imported', async function () {
		this.timeout(10000);
		const kerberos = await import('@hackolade/kerberos-plugins');

		expect(Boolean(kerberos), 'imported as falsy value').to.be.equal(true);
	});

	it('couchbase should be imported', async function () {
		this.timeout(10000);
		const couchbase = await import('@hackolade/couchbase');

		expect(Boolean(couchbase), 'imported as falsy value').to.be.equal(true);
	});

	it('mongodb-client-encryption should be imported', async function () {
		this.timeout(10000);
		const clientEncryption = await import('@hackolade/mongodb-client-encryption');

		expect(Boolean(clientEncryption.ClientEncryption), 'imported as falsy value').to.be.equal(true);
	});

	it('os-dns-native should be imported', async function () {
		this.timeout(10000);
		const osDnsNative = await import('@hackolade/os-dns-native');

		expect(Boolean(osDnsNative), 'imported as falsy value').to.be.equal(true);
	});

	it('watcher should be imported', async function () {
		this.timeout(10000);
		const watcher = await import('@hackolade/watcher');

		expect(Boolean(watcher), 'imported as falsy value').to.be.equal(true);
	});

	it('keytar should be imported', async function () {
		this.timeout(10000);
		const keytar = await import('@hackolade/keytar');

		expect(_.isFunction(keytar.getPassword), 'imported as falsy value').to.be.equal(true);
	});

	it('krb5 should be imported', async function () {
		this.timeout(10000);
		const krb5 = await import('@hackolade/krb5');

		expect(Boolean(krb5), 'imported as falsy value').to.be.equal(true);
	});

	if(os.platform() === 'win32'){
		it('winapi addon should be imported', async function () {
			this.timeout(10000);
			const winApi = await import('@hackolade/winapi-detect-remote-desktop-addon-win32-x64');
	
			expect(Boolean(winApi.isCurrentSessionRemoteable), 'imported as falsy value').to.be.equal(true);
		});
	}
});

describe('desktop trampoline', async function () {
	this.timeout(10000);
	const { stat, access } = await import('fs/promises');
	const { constants } = await import('fs');
	const { getDesktopTrampolinePath } = await import('@hackolade/desktop-trampoline');

	const trampolinePath = getDesktopTrampolinePath();
	console.log("Looking for trampoline at", trampolinePath)
	it('exists and is a regular file', async () => expect((await stat(trampolinePath)).isFile()).is.eq(true));

	it('can be executed by current process', async () => await access(trampolinePath, constants.X_OK));
});


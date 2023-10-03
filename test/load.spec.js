import _ from 'lodash';
import  { expect } from 'chai';

describe('custom native modules', () => {
	it('kerberos should be imported', async function () {
		this.timeout(10000);
		const kerberos = await import('@hackolade/kerberos');

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

	it('keytar should be imported', async function () {
		this.timeout(10000);
		const keytar = await import('@hackolade/keytar');

		expect(_.isFunction(keytar.getPassword), 'imported as falsy value').to.be.equal(true);
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

	it('krb5 should be imported', async function () {
		this.timeout(10000);
		const krb5 = await import('@hackolade/krb5');

		expect(Boolean(krb5), 'imported as falsy value').to.be.equal(true);
	});
});

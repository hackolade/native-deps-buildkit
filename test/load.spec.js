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

		console.log(">>>>>>", clientEncryption);

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
		const { execFile } = await import('child_process');
		const { promisify } = await import('util');
		const { getDesktopTrampolinePath } = await import('@hackolade/desktop-trampoline');
        const split2 = await import('split2');
		const { createServer } = await import('net');

		const trampolinePath = getDesktopTrampolinePath();
        const run = promisify(execFile);
        
		it('exists and is a regular file', async () => expect((await stat(trampolinePath)).isFile()).is.eq(true));

		it('can be executed by current process', async () => await access(trampolinePath, constants.X_OK));

        it('forwards arguments and valid environment variables correctly', async () => {
			const output = [];
			const server = createServer(socket => {
				socket.pipe(split2(/\0/)).on('data', data => {
					output.push(data.toString('utf8'));
				});

				// Don't send anything and just close the socket after the trampoline is
				// done forwarding data.
				socket.end();
			});
			server.unref();

			const startTrampolineServer = async () => {
				return new Promise((resolve, reject) => {
					server.on('error', e => reject(e));
					server.listen(0, '127.0.0.1', () => {
						resolve(server.address().port);
					});
				});
			};

			const port = await startTrampolineServer();
			const env = {
				DESKTOP_TRAMPOLINE_IDENTIFIER: '123456',
				DESKTOP_PORT: port,
				DESKTOP_USERNAME: 'hackolade-user',
				DESKTOP_USERNAME_FAKE: 'fake-user',
				INVALID_VARIABLE: 'foo bar',
			};
			const opts = { env };

			await run(trampolinePath, ['baz'], opts);

			const outputArguments = output.slice(1, 2);
			expect(outputArguments).to.deep.eq(['baz']);
			// output[2] is the number of env variables
			const outputEnv = output.slice(3);
			expect(outputEnv).to.have.length(2);
			expect(outputEnv).contains('DESKTOP_TRAMPOLINE_IDENTIFIER=123456');
			expect(outputEnv).contains(`DESKTOP_USERNAME=hackolade-user`);

			server.close();
		});
	});

	it('krb5 should be imported', async function () {
		this.timeout(10000);
		const krb5 = await import('@hackolade/krb5');

		expect(Boolean(krb5), 'imported as falsy value').to.be.equal(true);
	});
});

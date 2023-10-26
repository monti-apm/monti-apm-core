import assert from 'assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
import server from './tests/server';
import Monti from './index';
import { ByPassRetryError } from './retry';
import { Readable } from 'stream';
import { expect } from 'chai';
import { hostname } from 'os';

describe('monti', function () {
  const endpoint = 'http://localhost:8000';
  const validAuth = { appId: 'test-app-id', appSecret: 'test-app-secret' };
  const validOpts = Object.assign({ endpoint }, validAuth);
  const invldOpts = Object.assign({ endpoint });

  function inRange(n, min, max) {
    return n <= max && n >= min;
  }

  beforeEach(function (done) {
    server.setCount(0);
    server.start(done);
  });

  afterEach((done) => {
    server.stop(done);
  });

  describe('connect', function () {
    it('should throw with wrong info', async function () {
      let erred = false;
      const monti = new Monti(invldOpts);

      try {
        await monti.connect();
      } catch (e) {
        assert.strictEqual(e instanceof ByPassRetryError, true);
        erred = true;
      }

      assert(erred);
      monti.disconnect();
    });

    it('should connect with correct info', async function () {
      const monti = new Monti(validOpts);
      await monti.connect();
      monti.disconnect();
    });

    it('should sync the diff value', async function () {
      const monti = new Monti(validOpts);
      await monti.connect();
      monti.disconnect();
      assert(inRange(monti._clock._diff, -1100, -900));
    });
  });

  describe('sendData', function () {
    it('should send data to the server', async function () {
      const options = Object.assign({}, validOpts, { dataFlushInterval: 100 });
      const monti = new Monti(options);
      await monti.connect();
      monti.disconnect();

      await monti.sendData({
        test1: [{ a: 'b' }, { c: 'd' }],
        test2: [{ e: 'f' }],
      });

      assert.deepStrictEqual(server.getData(), {
        host: monti._options.hostname,
        test1: [{ a: 'b' }, { c: 'd' }],
        test2: [{ e: 'f' }],
      });
    });

    it('should support large data objects', async function () {
      this.timeout(1000 * 10);
      const dataString = Buffer.alloc(30000000, '0').toString();

      const options = Object.assign({}, validOpts, { dataFlushInterval: 100 });
      const monti = new Monti(options);
      await monti.connect();
      monti.disconnect();

      await monti.sendData({ content: dataString });

      expect(server.getData()).to.deep.equal({
        content: dataString,
        host: hostname(),
      });
    });

    it('should send agent version', async () => {
      const options = Object.assign({}, validOpts, {
        dataFlushInterval: 100,
        agentVersion: '1.5.0',
      });
      const monti = new Monti(options);
      await monti.connect();
      monti.disconnect();

      await monti.sendData({});
      assert.strictEqual(server.getHeaders()['monti-agent-version'], '1.5.0');
    });

    it('should reject when unable to stringify json', (done) => {
      const options = Object.assign({}, validOpts, {
        dataFlushInterval: 100,
        agentVersion: '1.5.0',
      });
      const monti = new Monti(options);

      const a = {};
      a.a = a;

      monti.sendData(a).catch((e) => {
        assert.strictEqual(e.message.includes('circular structure'), true);
        done();
      });
    });
  });

  describe('get', function () {
    it('should make get request', async function () {
      const options = Object.assign({}, validOpts);
      const monti = new Monti(options);
      await monti.connect();
      monti.disconnect();

      const result = await monti.get('/_test/text');
      assert.strictEqual(result, 'hello-world');
    });

    it('should allow disabling retries', async function () {
      this.timeout(20000);
      const options = Object.assign({}, validOpts);
      const monti = new Monti(options);
      await monti.connect();
      monti.disconnect();
      server.setCount(0);

      try {
        await monti.get('/_test/e5xx', { noRetry: true });
      } catch (e) {
        assert.strictEqual(server.getCount(), 1);
        assert.strictEqual(e.message, 'Request failed: 500');
        return;
      }

      assert.fail('request did not fail');
    });

    it('should allow disabling retries for network errors', async function () {
      this.timeout(20000);
      const options = Object.assign({}, validOpts);
      const monti = new Monti(options);
      await monti.connect();
      monti.disconnect();
      server.setCount(0);

      try {
        await monti.get('/_test/network-err', { noRetry: true });
      } catch (e) {
        assert.strictEqual(server.getCount(), 1);
        assert.strictEqual(e.message, 'socket hang up');
        return;
      }

      assert.fail('request did not fail');
    });
  });

  describe('sendStream', function () {
    it('should send stream to the server', async function () {
      const options = Object.assign({}, validOpts);
      const monti = new Monti(options);
      await monti.connect();
      monti.disconnect();

      const s = new Readable();
      s.push('content');
      s.push(null);

      await monti.sendStream('/stream', s);

      assert.strictEqual(server.getData(), 'content');
    });
  });

  describe('updateJob', function () {
    it('should send data to the server', async function () {
      const monti = new Monti(validOpts);
      await monti.connect();
      await monti.updateJob('job-0', { foo: 'bar' });

      assert.deepStrictEqual(server.getJobs(), {
        action: 'set',
        params: { id: 'job-0', foo: 'bar' },
      });

      monti.disconnect();
    });
  });

  describe('getJob', function () {
    it('should send data to the server', async function () {
      const monti = new Monti(validOpts);
      await monti.connect();

      const res = await monti.getJob('job-0');
      assert.deepStrictEqual(res, { aa: 10 });
      assert.deepStrictEqual(server.getJobs(), {
        action: 'get',
        params: { id: 'job-0' },
      });

      monti.disconnect();
    });
  });

  describe('_checkAuth', () => {
    describe('with correct login info', () => {
      it('should just return', async () => {
        const monti = new Monti(validOpts);
        await monti._checkAuth();
        monti.disconnect();
      });
    });

    describe('with bad login info', () => {
      it('should throw an error', (done) => {
        const monti = new Monti(invldOpts);
        monti._checkAuth().catch((err) => {
          assert.strictEqual(err.message, 'Unauthorized');
          done();
        });
        monti.disconnect();
      });
    });
  });
});

import assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'mocha';
import server from './_server.js';
import Kadira from '../index.js';
import { ByPassRetryError } from '../retry.js';
import { Readable } from 'stream';
import { Feature } from '../constants';

describe('kadira', function () {
  const endpoint = 'http://localhost:8000';
  const validAuth = { appId: 'test-app-id', appSecret: 'test-app-secret' };
  const validOpts = Object.assign({ endpoint }, validAuth);
  const invldOpts = Object.assign({ endpoint });

  function inRange(n, min, max) {
    return n <= max && n >= min;
  }

  beforeEach(function (done) {
    server.setCount(0);
    return server.start(done);
  });

  afterEach(function (done) {
    return server.stop(done);
  });

  describe('connect', function () {
    it('should throw with wrong info', async function () {
      let erred = false;
      const kadira = new Kadira(invldOpts);

      try {
        await kadira.connect();
      } catch (e) {
        assert.strictEqual(e instanceof ByPassRetryError, true);
        erred = true;
      }

      assert(erred);
      kadira.disconnect();
    });

    it('should connect with correct info', async function () {
      const kadira = new Kadira(validOpts);
      await kadira.connect();
      kadira.disconnect();
    });

    it('should sync the diff value', async function () {
      const kadira = new Kadira(validOpts);
      await kadira.connect();
      kadira.disconnect();
      assert(inRange(kadira._clock._diff, -1100, -900));
    });
  });

  describe('sendData', function () {
    it('should send data to the server', async function () {
      const options = Object.assign({}, validOpts, { dataFlushInterval: 100 });
      const kadira = new Kadira(options);
      await kadira.connect();
      kadira.disconnect();

      await kadira.sendData({
        test1: [ { a: 'b' }, { c: 'd' } ],
        test2: [ { e: 'f' } ],
      });

      assert.deepStrictEqual(server.getData(), {
        host: kadira._options.hostname,
        test1: [ { a: 'b' }, { c: 'd' } ],
        test2: [ { e: 'f' } ],
      });
    });

    it('should support large data objects', async function () {
      this.timeout(1000 * 10);
      const dataString = Buffer.alloc(30000000, '0').toString();

      const options = Object.assign({}, validOpts, { dataFlushInterval: 100 });
      const kadira = new Kadira(options);
      await kadira.connect();
      kadira.disconnect();

      await kadira.sendData({ content: dataString });

      assert.deepStrictEqual(server.getData(), {
        content: dataString,
        host: 'localhost'
      });
    });

    it('should send agent version', async () => {
      const options = Object.assign(
        {},
        validOpts,
        { dataFlushInterval: 100, agentVersion: '1.5.0' }
      );
      const kadira = new Kadira(options);
      await kadira.connect();
      kadira.disconnect();

      await kadira.sendData({});
      assert.strictEqual(server.getHeaders()['monti-agent-version'], '1.5.0');
    });

    it('should reject when unable to stringify json', (done) => {
      const options = Object.assign(
        {},
        validOpts,
        { dataFlushInterval: 100, agentVersion: '1.5.0' }
      );
      const kadira = new Kadira(options);

      let a = {};
      a.a = a;

      kadira.sendData(a)
        .catch((e) => {
          assert.strictEqual(e.message.includes('circular structure'), true);
          done();
        });
    });
  });

  describe('get', function () {
    it('should make get request', async function () {
      const options = Object.assign({}, validOpts);
      const kadira = new Kadira(options);
      await kadira.connect();
      kadira.disconnect();

      const result = await kadira.get('/_test/text');
      assert.strictEqual(result, 'hello-world');
    });

    it('should allow disabling retries', async function () {
      this.timeout(20000);
      const options = Object.assign({}, validOpts);
      const kadira = new Kadira(options);
      await kadira.connect();
      kadira.disconnect();
      server.setCount(0);

      try {
        await kadira.get('/_test/e5xx', { noRetry: true });
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
      const kadira = new Kadira(options);
      await kadira.connect();
      kadira.disconnect();
      server.setCount(0);

      try {
        await kadira.get('/_test/network-err', { noRetry: true });
      } catch (e) {
        assert.strictEqual(server.getCount(), 1);
        assert.strictEqual(e.message, 'socket hang up');
        return;
      }

      assert.fail('request did not fail');
    });
  });

  describe('sendJsonStream', function () {
    it('should send json stream to the server', async function () {
      const options = Object.assign({}, validOpts);
      const kadira = new Kadira(options);
      await kadira.connect();

      kadira._allowedFeatures[Feature.JSON_STREAMING] = true;

      kadira.disconnect();

      await kadira.sendData({ foo: 'bar' });

      assert.deepEqual({ foo: 'bar', host: 'localhost' }, server.getData());
    });
  });

  describe('sendJsonStream', function () {
    it('should send stream to the server', async function () {
      const options = Object.assign({}, validOpts);
      const kadira = new Kadira(options);
      await kadira.connect();
      kadira.disconnect();

      var s = new Readable();
      s.push('content');
      s.push(null);

      await kadira.sendStream('/stream', s);

      assert.strictEqual(server.getData(), 'content');
    });

    it('should reject when unable to stringify json in stream', (done) => {
      const options = Object.assign(
        {},
        validOpts,
        { dataFlushInterval: 100, agentVersion: '1.5.0' }
      );

      const kadira = new Kadira(options);
      kadira._supportsJsonSeq = true;

      let a = {};
      a.a = a;

      kadira.sendData(a)
        .catch((e) => {
          assert.strictEqual(e.message.includes('circular structure'), true);
          done();
        });
    });
  });

  describe('updateJob', function () {
    it('should send data to the server', async function () {
      const kadira = new Kadira(validOpts);
      await kadira.connect();
      kadira.disconnect();

      await kadira.updateJob('job-0', { foo: 'bar' });

      assert.deepStrictEqual(server.getJobs(), {
        action: 'set',
        params: { id: 'job-0', foo: 'bar' },
      });
    });
  });

  describe('getJob', function () {
    it('should send data to the server', async function () {
      const kadira = new Kadira(validOpts);
      await kadira.connect();
      kadira.disconnect();

      const res = await kadira.getJob('job-0');
      assert.deepStrictEqual(res, { aa: 10 });
      assert.deepStrictEqual(server.getJobs(), {
        action: 'get',
        params: { id: 'job-0' },
      });
    });
  });

  describe('_checkAuth', () => {
    describe('with correct login info', () => {
      it('should just return', done => {
        const kadira = new Kadira(validOpts);
        kadira._checkAuth().then(() => {
          done();
        });
      });
    });

    describe('with bad login info', () => {
      it('should throw an error', done => {
        const kadira = new Kadira(invldOpts);
        kadira._checkAuth().catch(err => {
          assert.strictEqual(err.message, 'Unauthorized');
          done();
        });
      });
    });
  });
});

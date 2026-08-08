import assert from 'assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
import Monti from './index';
import server from './tests/server';
import { WebSocketEvents } from './utils/websocket-utils';
import { WebSocketEvent } from './constants';

describe('proxy', function () {
  const endpoint = 'http://127.0.0.1:8000';
  const auth = { appId: 'test-app-id', appSecret: 'test-app-secret' };
  const retryOptions = { authRetryDelay: 1, maxRetries: 0 };
  const credentials = 'proxy-user:proxy-password';

  let monti;
  let originalHttpsProxy;

  beforeEach(async function () {
    originalHttpsProxy = process.env.HTTPS_PROXY;
    delete process.env.HTTPS_PROXY;

    server.setCount(0);
    await server.startAsync();
  });

  afterEach(async function () {
    if (monti) {
      monti.disconnect();
      monti = undefined;
    }

    WebSocketEvents.removeAllListeners();

    if (originalHttpsProxy === undefined) {
      delete process.env.HTTPS_PROXY;
    } else {
      process.env.HTTPS_PROXY = originalHttpsProxy;
    }

    await server.stopAsync();
  });

  it('should send data through the configured proxy', async function () {
    monti = new Monti({
      ...auth,
      endpoint,
      proxy: server.getProxyUrl(credentials),
      retryOptions,
    });

    await monti.sendData({ source: 'proxy option' });

    const [proxyRequest] = server.getProxyRequests();

    assert.strictEqual(server.getProxyRequests().length, 1);
    assert.strictEqual(proxyRequest.url, '127.0.0.1:8000');
    assert.strictEqual(
      proxyRequest.headers['proxy-authorization'],
      `Basic ${Buffer.from(credentials).toString('base64')}`,
    );

    assert.strictEqual(server.getHeaders()['kadira-app-id'], auth.appId);
    assert.deepStrictEqual(server.getData(), {
      host: monti._options.hostname,
      source: 'proxy option',
    });
  });

  it('should not use a tunnel when no proxy is configured', async function () {
    monti = new Monti({ ...auth, endpoint, retryOptions });

    await monti.sendData({ source: 'no proxy' });

    assert.strictEqual(server.getProxyRequests().length, 0);
  });

  it('should check auth through the configured proxy', async function () {
    monti = new Monti({
      ...auth,
      endpoint,
      proxy: server.getProxyUrl(),
      retryOptions,
    });

    await monti._checkAuth();

    assert.strictEqual(server.getCount(), 1);
    assert.strictEqual(server.getProxyRequests().length, 1);
  });

  it('should sync the clock through the configured proxy', async function () {
    monti = new Monti({
      ...auth,
      endpoint,
      proxy: server.getProxyUrl(),
      retryOptions,
    });

    await monti._clock.sync();

    assert.strictEqual(server.getCount(), 2);
    assert.strictEqual(server.getProxyRequests().length, 2);
  });

  it('should connect the websocket through the configured proxy', async function () {
    monti = new Monti({
      ...auth,
      endpoint,
      proxy: server.getProxyUrl(),
      retryOptions,
    });

    await monti.connect();
    await WebSocketEvents.waitFor(WebSocketEvent.WEBSOCKET_CONNECTED, 2000);

    // Auth, two clock requests, and the WebSocket should each use the proxy.
    assert.strictEqual(server.getProxyRequests().length, 4);
  });

  it('should use HTTPS_PROXY when no proxy option is configured', async function () {
    process.env.HTTPS_PROXY = server.getProxyUrl();

    monti = new Monti({ ...auth, endpoint, retryOptions });

    await monti.sendData({ source: 'HTTPS_PROXY' });

    assert.strictEqual(server.getProxyRequests().length, 1);
  });
});

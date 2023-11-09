import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { WebSocketEvents } from './utils/websocket-utils';
import { CoreEvent, EngineEvent, WebSocketEvent } from './constants';
import Monti from './index';
import { sleep } from './utils';
import server, { connections, wss } from './tests/server';

function send(data) {
  connections.values().next().value.send(JSON.stringify(data));
}

describe('WebSockets', function () {
  const endpoint = 'http://localhost:8000';
  const options = {
    appId: 'test-app-id',
    appSecret: 'test-app-secret',
    endpoint,
  };

  beforeEach((done) => {
    server.setCount(0);
    server.start(done);
  });

  afterEach((done) => {
    server.stop(done);
  });

  it('should be enabled', async () => {
    const monti = new Monti(options);

    await monti.connect();

    expect(monti._allowedFeatures).to.be.deep.equal({
      websockets: true,
    });

    monti.disconnect();
  });

  it('should receive new events', async () => {
    const monti = new Monti(options);

    monti.connect();

    await WebSocketEvents.waitFor(WebSocketEvent.WEBSOCKET_CONNECTED);

    send({
      event: EngineEvent.JOB_CREATED,
      data: {
        _id: 'id1',
        foo: 'bar',
      },
    });

    const [job] = await monti.waitFor(CoreEvent.JOB_ADDED);

    expect(job).to.be.deep.equal({
      _id: 'id1',
      foo: 'bar',
    });

    monti.disconnect();
  });

  it('should emit event for new jobs and ignore jobs already added', async () => {
    const monti = new Monti(options);

    monti.connect();

    await WebSocketEvents.waitFor(WebSocketEvent.WEBSOCKET_CONNECTED);

    send({
      event: EngineEvent.JOB_CREATED,
      data: {
        _id: 'id1',
        foo: 'bar',
      },
    });

    const [event] = await monti.waitFor(CoreEvent.JOB_ADDED);

    expect(event).to.be.deep.equal({ _id: 'id1', foo: 'bar' });

    send({
      event: EngineEvent.JOB_CREATED,
      data: {
        _id: 'id1',
        foo: 'bar',
      },
    });

    const [job] = await monti.waitFor(CoreEvent.JOB_ADDED);

    expect(job).to.be.deep.equal({ _id: 'id1', foo: 'bar' });

    monti.disconnect();
  });

  it('should attempt connection reconnection until stopped', async () => {
    let attemptCount = 0;

    wss._webSocketEnabled = false;

    const monti = new Monti(options);

    WebSocketEvents.on(WebSocketEvent.WEBSOCKET_ATTEMPT, () => {
      attemptCount++;
    });

    await monti.connect();

    await sleep(1000);

    expect(attemptCount).to.be.greaterThan(1);

    wss._webSocketEnabled = true;

    await WebSocketEvents.waitFor(WebSocketEvent.WEBSOCKET_CONNECTED, 2000);

    monti.disconnect();
  }).timeout(10000);

  it('should contain supported features header', async () => {
    const monti = new Monti(options);

    monti.connect();

    await WebSocketEvents.waitFor(WebSocketEvent.WEBSOCKET_CONNECTED);

    expect(monti._websocketHeaders).to.contain({
      'monti-supported-features': 'websockets',
    });

    monti.disconnect();
  });

  it('should timeout if no pong message received', async () => {
    const monti = new Monti(options);

    monti.connect();

    const [ws] = await WebSocketEvents.waitFor(
      WebSocketEvent.WEBSOCKET_CONNECTED,
    );

    let pingCount = 0;

    ws.on('ping', () => {
      pingCount++;
    });

    // We override the pong method to prevent the client from sending a pong
    // eslint-disable-next-line no-empty-function
    ws.pong = () => {};

    await sleep(300);

    expect(ws.readyState).to.be.equal(3);
    expect(pingCount).to.be.above(0);

    monti.disconnect();
  });

  it('should maintain connection if pong message received', async () => {
    const monti = new Monti(options);

    monti.connect();

    const [ws] = await WebSocketEvents.waitFor(
      WebSocketEvent.WEBSOCKET_CONNECTED,
    );

    let pingCount = 0;

    ws.on('ping', () => {
      pingCount++;
    });

    await sleep(300);

    expect(ws.readyState).to.be.equal(1);

    expect(pingCount).to.be.above(0);

    monti.disconnect();
  });
});

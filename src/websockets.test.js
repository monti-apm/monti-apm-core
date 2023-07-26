/* eslint-disable max-len */
import { afterEach, beforeEach, describe, it } from 'mocha';
import server, { connections, wss } from './tests/server.js';
import Kadira from './index.ts';
import { expect } from 'chai';
import { CoreEvent, EngineEvent } from '@/constants';
import { sleep } from '@/utils';
import { connectWithBackoff, connectWithRetry } from '@/utils/websocket-utils';

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
    const kadira = new Kadira(options);

    await kadira.connect();

    expect(kadira._allowedFeatures).to.be.deep.equal({
      websockets: true,
    });

    kadira.disconnect();
  });

  it('should receive new events', async () => {
    const kadira = new Kadira(options);

    kadira.connect();

    await kadira.waitFor(CoreEvent.WEBSOCKET_CONNECTED);

    send({
      event: EngineEvent.JOB_CREATED,
      data: {
        _id: 'id1',
        foo: 'bar',
      },
    });

    await sleep(20);

    expect(kadira._jobQueue).to.be.deep.equal([
      {
        _id: 'id1',
        foo: 'bar',
      },
    ]);

    kadira.disconnect();
  });

  it('should emit event for new jobs and ignore jobs already added', async () => {
    const kadira = new Kadira(options);

    kadira.connect();

    await kadira.waitFor(CoreEvent.WEBSOCKET_CONNECTED);

    send({
      event: EngineEvent.JOB_CREATED,
      data: {
        _id: 'id1',
        foo: 'bar',
      },
    });

    const event = await kadira.waitFor(CoreEvent.JOB_ADDED);

    expect(event).to.be.deep.equal([{ _id: 'id1', foo: 'bar' }]);

    send({
      event: EngineEvent.JOB_CREATED,
      data: {
        _id: 'id1',
        foo: 'bar',
      },
    });

    await sleep(20);

    // Should not have added the job again (more than one entry)
    expect(kadira._jobQueue).to.have.length(1);
    expect(kadira._jobQueue).to.be.deep.equal([{ _id: 'id1', foo: 'bar' }]);

    kadira.disconnect();
  });

  it('should attempt connection 4x and use the backoff strategy for maximum reliability', async () => {
    connectWithRetry._timeout = 10;
    connectWithBackoff._failAfter = 3;

    let attemptCount = 0;
    let backoffCount = 0;

    wss._webSocketEnabled = false;

    const kadira = new Kadira(options);

    kadira.on(CoreEvent.WEBSOCKET_ATTEMPT, () => {
      attemptCount++;
    });

    kadira.on(CoreEvent.WEBSOCKET_BACKOFF, () => {
      backoffCount++;
    });

    await kadira.connect();

    // Needs to wait for the backoff to fail
    await kadira.waitFor(CoreEvent.WEBSOCKET_BACKOFF_FAIL);

    wss._webSocketEnabled = true;

    expect(attemptCount).to.be.equal(16);
    expect(backoffCount).to.be.equal(3);
  }).timeout(10000);

  it('should contain supported features header', async () => {
    const kadira = new Kadira(options);

    kadira.connect();

    await kadira.waitFor(CoreEvent.WEBSOCKET_CONNECTED);

    expect(kadira._websocketHeaders).to.contain({
      'monti-supported-features': 'websockets',
    });

    kadira.disconnect();
  });

  it('should timeout if no pong message received', async () => {
    connectWithBackoff._disableBackoff = true;

    const kadira = new Kadira(options);

    kadira.connect();

    await kadira.waitFor(CoreEvent.WEBSOCKET_CONNECTED);

    let pingCount = 0;

    kadira._ws.on('ping', () => {
      pingCount++;
    });

    // We override the pong method to prevent the client from sending a pong
    // eslint-disable-next-line no-empty-function
    kadira._ws.pong = () => {};

    await sleep(300);

    expect(kadira._ws.readyState).to.be.equal(3);
    expect(pingCount).to.be.above(0);

    kadira.disconnect();

    connectWithBackoff._disableBackoff = false;
  });

  it('should maintain connection if pong message received', async () => {
    const kadira = new Kadira(options);

    kadira.connect();

    await kadira.waitFor(CoreEvent.WEBSOCKET_CONNECTED);

    let pingCount = 0;

    kadira._ws.on('ping', () => {
      pingCount++;
    });

    await sleep(300);

    expect(kadira._ws.readyState).to.be.equal(1);

    expect(pingCount).to.be.above(0);

    kadira.disconnect();
  });
});

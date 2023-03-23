/* eslint-disable max-len */
import { afterEach, beforeEach, describe, it } from 'mocha';
import server, { connections } from './_server.js';
import Kadira from '../index.js';
import { expect } from 'chai';
import { WSEvent } from '../constants';
import { sleep } from '../utils';

function send(data) {
  connections.values().next().value.send(JSON.stringify(data));
}

describe('WebSockets', function () {
  const endpoint = 'http://localhost:8000';
  const options = {
    appId: 'test-app-id',
    appSecret: 'test-app-secret',
    endpoint
  };

  beforeEach((done) => {
    server.setCount(0);
    return server.start(done);
  });

  afterEach((done) => {
    return server.stop(done);
  });

  it('should be enabled', async () => {
    const kadira = new Kadira(options);

    await kadira.connect();

    expect(kadira._allowedFeatures).to.be.deep.equal({
      websockets: true
    });
  });

  it('should receive new events', async () => {
    const kadira = new Kadira(options);

    await kadira.connect();

    send({
      event: WSEvent.JOB_CREATED,
      data: {
        _id: 'id1',
        foo: 'bar'
      }
    });

    await sleep(20);

    expect(kadira._jobQueue).to.be.deep.equal([ {
      _id: 'id1', foo: 'bar'
    } ]);
  });

  it('should emit event for new jobs and ignore jobs already added', async () => {
    const kadira = new Kadira(options);

    await kadira.connect();

    send({
      event: WSEvent.JOB_CREATED,
      data: {
        _id: 'id1',
        foo: 'bar'
      }
    });

    const event = await kadira.waitFor('job:added');


    expect(event).to.be.deep.equal([ { _id: 'id1', foo: 'bar' } ]);

    send({
      event: WSEvent.JOB_CREATED,
      data: {
        _id: 'id1',
        foo: 'bar'
      }
    });

    await sleep(20);

    // Should not have added the job again (more than one entry)
    expect(kadira._jobQueue).to.have.length(1);
    expect(kadira._jobQueue).to.be.deep.equal([ { _id: 'id1', foo: 'bar' } ]);
  });
});

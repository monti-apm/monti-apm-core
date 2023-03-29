import Clock from './clock.js';
import debug from 'debug';
import {
  ContentType,
  CoreEvent,
  EngineEvent,
  Feature,
  HttpHeader,
  SupportedFeatures
} from './constants';
import { axiosRetry, parseAllowedFeaturesHeader } from './utils';
import { hostname } from 'os';
import { v4 as uuid } from 'uuid';
import EventEmitter2 from 'eventemitter2';
import { connectWithBackoff } from './utils/websocket-utils';

const logger = debug('kadira-core:transport');

const DEFAULTS = {
  appId: '',
  appSecret: '',
  agentVersion: 'unknown',
  endpoint: 'https://enginex.kadira.io',
  hostname: hostname(),
  clockSyncInterval: 1000 * 60,
  dataFlushInterval: 1000 * 10,
  retryOptions: {
    maxRetries: 3, // Same as the previous 4 not counting the first try.
  }
};

// exporting this for if we need to get this as a NPM module.
export class Kadira extends EventEmitter2 {
  _id = uuid();
  _supportedFeatures = SupportedFeatures;
  _allowedFeatures = {};
  _jobQueue = [];
  _instancedAt = Date.now();

  constructor(_options) {
    super();

    this._options = Object.assign({}, DEFAULTS, _options);
    this._headers = {
      'content-type': ContentType.JSON,
      accepts: ContentType.JSON,
      'kadira-app-id': this._options.appId,
      'kadira-app-secret': this._options.appSecret,
      'monti-agent-version': this._options.agentVersion,
      'monti-agent-hostname': this._options.hostname,
      'monti-connection-uuid': this._id,
    };

    this._clock = new Clock({
      endpoint: this._options.endpoint + '/simplentp/sync',
    });

    this._clockSyncInterval = null;
  }

  get _websocketHeaders() {
    return {
      ...this._headers,
      'monti-uptime': Date.now() - this._instancedAt
    };
  }

  connect() {
    logger('connecting with', this._options);
    return this._checkAuth()
      .then(() => this._clock.sync())
      .then(() => {
        this._clockSyncInterval = setInterval(
          () => this._clock.sync(),
          this._options.clockSyncInterval
        );
      });
  }

  disconnect() {
    logger('disconnect');
    clearInterval(this._clockSyncInterval);

    this.emit(CoreEvent.DISCONNECT);
  }

  getJob(id) {
    const data = { action: 'get', params: {} };
    Object.assign(data.params, { id });

    const url = this._options.endpoint + '/jobs';
    const params = {
      data,
      headers: this._headers,
    };

    logger('get job', id);
    return this._send(url, params);
  }

  updateJob(id, diff) {
    const data = { action: 'set', params: {} };
    Object.assign(data.params, diff, { id });

    const url = this._options.endpoint + '/jobs';
    const params = {
      data,
      headers: this._headers,
    };

    logger('update job', id);
    return this._send(url, params);
  }

  // send the given payload to the server
  sendData(_payload) {
    // Needs to be inside a promise so the errors thrown below it
    // are properly caught.
    return new Promise((resolve) => {
      const payload = {
        ..._payload,
        host: this._options.hostname
      };

      const url = this._options.endpoint;

      logger('send data...');

      const params = {
        data: Buffer.from(JSON.stringify(payload)),
        headers: {
          'content-type': ContentType.JSON
        }
      };

      return resolve(this._send(url, params));
    });
  }

  get(path, options = {}) {
    const url = this._options.endpoint + path;
    const params = {
      headers: {
        ...this._headers
      },
      noRetry: options.noRetry
    };
    logger(`get request to ${url}`);
    return this._send(url, params);
  }

  sendStream(path, stream) {
    const url = this._options.endpoint + path;
    const params = {
      data: stream,
      headers: {
        ...this._headers,
        'content-type': ContentType.STREAM
      },
    };

    logger(`send stream to ${url}`);
    return this._send(url, params);
  }

  _handleJobEvent(job) {
    if (this._jobQueue.find(j => j._id === job._id)) {
      return;
    }

    this._jobQueue.push(job);

    this.emit(CoreEvent.JOB_ADDED, job);
  }

  _handleMessage(message) {
    try {
      const { event, data } = JSON.parse(message.data);

      switch (event) {
        case EngineEvent.JOB_CREATED:
          this._handleJobEvent(data);
      }
    } catch (error) {
      console.log('Monti APM: Failed to parse message', message.data);
    }
  }

  async _initWebSocket() {
    if (this._ws) {
      return;
    }

    try {
      await connectWithBackoff(
        this
      );
    } catch (e) {
      console.error('Monti APM WebSocket: Failed to connect');
      this._ws = undefined;
    }
  }

  // ping the server to check whether appId and appSecret
  // are valid and correct. Data sent inside http headers.
  async _checkAuth() {
    const uri = this._options.endpoint + '/ping';

    const params = { headers: this._headers };

    const res = await axiosRetry(uri, params, this._options.retryOptions);

    this._allowedFeatures =
      parseAllowedFeaturesHeader(res.headers[HttpHeader.ACCEPT_FEATURES]);

    if (!this._allowedFeatures[Feature.WEBSOCKETS]) {
      return res.data;
    }

    // It should wait for websocket connection to be established.
    // Explicit is better than implicit.
    await this._initWebSocket();

    return res.data;
  }

  // communicates with the server with http
  // Also handles response http status codes and retries
  _send(url, params) {
    return axiosRetry(url, {
      ...params,
      headers: {
        ...this._headers,
        ...params.headers,
      },
    }, this._options.retryOptions).then(res => res.data);
  }
}

export default Kadira;

export * from './constants';

import Clock from './clock.js';
import debug from 'debug';
import {
  ContentType,
  Feature,
  HttpHeader,
  SupportedFeatures
} from './constants';
import { axiosRetry, parseAllowedFeaturesHeader } from './utils';
import { WebSocket } from 'ws';
import { hostname } from 'os';
import { v4 as uuid } from 'uuid';

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
export class Kadira {
  _id = uuid();
  _supportedFeatures = SupportedFeatures;
  _allowedFeatures = {};

  constructor(_options) {
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

  // ping the server to check whether appId and appSecret
  // are valid and correct. Data sent inside http headers.
  _checkAuth() {
    const uri = this._options.endpoint + '/ping';

    const params = { headers: this._headers };

    return axiosRetry(uri, params, this._options.retryOptions).then(res => {
      this._allowedFeatures =
        parseAllowedFeaturesHeader(res.headers[HttpHeader.ACCEPT_FEATURES]);

      if (this._allowedFeatures[Feature.WEBSOCKETS]) {
        this._ws = new WebSocket(
          this._options.endpoint
            .replace('https://', 'wss://')
            .replace('http://', 'ws://'),
          {
            headers: this._headers
          });

        this._ws.on('open', () => {
          console.log('connected to websocket');
        });
      }

      return res.data;
    });
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

import Clock from './clock.js';
import debug from 'debug';
import {
  ContentType,
  Feature,
  HttpHeader,
  SupportedFeatures
} from './constants';
import {
  axiosRetry,
  hasCircularReference,
  parseAllowedFeaturesHeader,
  StreamStringify
} from './utils';

const logger = debug('kadira-core:transport');

const DEFAULTS = {
  appId: '',
  appSecret: '',
  agentVersion: 'unknown',
  endpoint: 'https://enginex.kadira.io',
  hostname: 'localhost',
  clockSyncInterval: 1000 * 60,
  dataFlushInterval: 1000 * 10,
};

// exporting this for if we need to get this as a NPM module.
export class Kadira {
  _supportedFeatures = SupportedFeatures;
  _allowedFeatures = {};

  constructor(_options) {
    this._supportsJsonSeq = false;
    this._options = Object.assign({}, DEFAULTS, _options);
    this._headers = {
      'content-type': ContentType.JSON,
      accepts: ContentType.JSON,
      'KADIRA-APP-ID': this._options.appId,
      'KADIRA-APP-SECRET': this._options.appSecret,
      'MONTI-AGENT-VERSION': this._options.agentVersion,
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

      if (this._allowedFeatures[Feature.JSON_STREAMING]) {
        return resolve(this._sendJsonStream(url, { data: payload }));
      }

      const params = {
        data: JSON.stringify(payload),
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

    return axiosRetry(uri, params).then(res => {
      this._allowedFeatures =
        parseAllowedFeaturesHeader(res.headers[HttpHeader.ALLOWED_FEATURES]);

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
    }).then(res => res.data);
  }

  _sendJsonStream(url, params) {
    if (hasCircularReference(params.data)) {
      throw new Error('Converting circular structure to JSON');
    }

    return axiosRetry(url, {
      ...params,
      data: StreamStringify(params.data),
      headers: {
        ...this._headers,
        ...params.headers,
        'content-type': ContentType.JSON_SEQ
      },
    }).then(res => res.data);
  }
}

export default Kadira;

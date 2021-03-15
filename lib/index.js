import axios from 'axios';
import Clock from './clock.js';
import retry from './retry.js';
import {ByPassRetryError} from './retry.js';
import debug from 'debug';

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
  constructor(_options) {
    this._options = Object.assign({}, DEFAULTS, _options);
    this._headers = {
      'content-type': 'application/json',
      accepts: 'application/json',
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
    const data = {action: 'get', params: {}};
    Object.assign(data.params, {id});

    const url = this._options.endpoint + '/jobs';
    const params = {
      data,
      headers: this._headers,
    };

    logger('get job', id);
    return this._send(url, params);
  }

  updateJob(id, diff) {
    const data = {action: 'set', params: {}};
    Object.assign(data.params, diff, {id});

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
    const payload = {
      ..._payload,
      host: this._options.hostname
    };

    const url = this._options.endpoint;
    const data = JSON.stringify(payload);
    const params = {
      data,
      headers: this._headers,
    };

    logger(`send data - ${data.substr(0, 50)}...`);
    return this._send(url, params);
  }

  sendStream(path, stream) {
    const url = this._options.endpoint + path;
    const params = {
      data: stream,
      headers: {
        ...this._headers,
        'content-type': 'application/octet-stream'
      },
    };

    logger(`send stream to ${url}`);
    return this._send(url, params);
  }

  // ping the server to check whether appId and appSecret
  // are valid and correct. Data sent inside http headers.
  _checkAuth() {
    const uri = this._options.endpoint + '/ping';
    const params = {headers: this._headers};
    return this._send(uri, params);
  }

  // communicates with the server with http
  // Also handles response http status codes and retries
  _send(url, params) {
    let retryEnabled = true;

    if (params.noRetry) {
      retryEnabled = false;
      delete params.noRetry;
    }

    return retry(() => {
      return new Promise((resolve, reject) => {
        axios({
          url,
          ...params,
          method: params.method || 'POST'
        }).then((res) => {
          return resolve(res.data);
        })
          .catch(err => {
            if (err.response && err.response.status) {
              let status = err.response.status;

              if (status === 401) {
            logger('Error: Unauthorized');
            return reject(new ByPassRetryError('Unauthorized'));
              } else if (status >= 400 && status < 500) {
                const message = `Agent Error: ${status}`;
                logger(`Error: ${message}`);
                return reject(new ByPassRetryError(message));
          }

              const message = `Request failed: ${status}`;
              const ErrConstructor = retryEnabled ? Error : ByPassRetryError;

            logger(`Error: ${message}`);
              return reject(new ErrConstructor(message));
          }

            if (!retryEnabled) {
              let oldErr = err;
              // eslint-disable-next-line no-param-reassign
              err = new ByPassRetryError(oldErr.message);
              err.stack = oldErr.stack;
            }

            return reject(err);
        });
      });
    });
  }
}

export default Kadira;

import Clock from './clock.js';
import debug from 'debug';
// eslint-disable-next-line max-len
import {
  ContentType,
  CoreEvent,
  EngineEvent,
  Feature,
  HttpHeader,
  SupportedFeatures,
} from './constants';
// eslint-disable-next-line max-len
import {
  axiosRetry,
  parseAllowedFeaturesHeader,
  stringifySupportedFeatures,
} from './utils';
import { hostname } from 'os';
import EventEmitter2 from 'eventemitter2';
import { persistentConnectWebSocket } from './utils/websocket-utils';

const logger = debug('kadira-core:transport');
const jobLogger = debug('kadira-core:jobs');

export type Job = {
  id: string;
  [key: string]: any;
};

export type KadiraOptions = {
  appId: string;
  appSecret: string;
  agentVersion: string;
  endpoint: string;
  hostname: string;
  clockSyncInterval: number;
  dataFlushInterval: number;
  retryOptions: {
    maxRetries: number;
  };
};

const defaultOptions = {
  appId: '',
  appSecret: '',
  agentVersion: 'unknown',
  endpoint: 'https://enginex.kadira.io',
  hostname: hostname(),
  clockSyncInterval: 1000 * 60,
  dataFlushInterval: 1000 * 10,
  retryOptions: {
    maxRetries: 3, // Same as the previous 4 not counting the first try.
  },
};

// exporting this for if we need to get this as a NPM module.
export class Kadira extends EventEmitter2 {
  _supportedFeatures = SupportedFeatures;
  _allowedFeatures = {};
  _options: KadiraOptions;
  _headers: Record<string, string> = {};
  _clock: Clock;
  _clockSyncInterval: NodeJS.Timeout | null;
  _disconnectWebSocket: (() => void) | null = null;

  constructor(_options?: Partial<KadiraOptions>) {
    super();

    this._options = Object.assign({}, defaultOptions, _options);
    this._headers = {
      'content-type': ContentType.JSON,
      accepts: ContentType.JSON,
      'kadira-app-id': this._options.appId,
      'kadira-app-secret': this._options.appSecret,
      'monti-agent-version': this._options.agentVersion,
      'monti-agent-hostname': this._options.hostname,
    };

    this._clock = new Clock({
      endpoint: this._options.endpoint + '/simplentp/sync',
    });

    this._clockSyncInterval = null;
  }

  get _websocketHeaders() {
    return {
      ...this._headers,
      'monti-supported-features': stringifySupportedFeatures(
        this._supportedFeatures,
      ),
    };
  }

  featureSupported(feature: string) {
    return Boolean(this._allowedFeatures[feature]);
  }

  async connect() {
    logger('connecting with', this._options);

    await this._checkAuth();

    this._initWebSocket();

    await this._clock.sync();

    this._clockSyncInterval = setInterval(
      () => this._clock.sync(),
      this._options.clockSyncInterval,
    );
  }

  disconnect() {
    logger('disconnect');

    if (this._clockSyncInterval) {
      clearInterval(this._clockSyncInterval);
    }

    this._disconnectWebSocket?.();
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

  updateJob(id: string, diff: Record<string, any>) {
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

  sendData(_payload: Record<string, any>) {
    // Needs to be inside a promise so the errors thrown below it
    // are properly caught.
    return new Promise((resolve) => {
      const payload = {
        ..._payload,
        host: this._options.hostname,
      };

      const json = JSON.stringify(payload);

      const url = this._options.endpoint;

      logger('sending data', json.slice(0, 100));

      const params = {
        data: Buffer.from(json),
        headers: {
          'content-type': ContentType.JSON,
        },
      };

      return resolve(this._send(url, params));
    });
  }

  get(
    path: string,
    options: {
      noRetry?: boolean;
    } = {},
  ) {
    const url = this._options.endpoint + path;
    const params = {
      headers: {
        ...this._headers,
      },
      noRetry: options.noRetry,
    };
    logger(`get request to ${url}`);
    return this._send(url, params);
  }

  sendStream(path: string, stream: ReadableStream) {
    const url = this._options.endpoint + path;
    const params = {
      data: stream,
      headers: {
        ...this._headers,
        'content-type': ContentType.STREAM,
      },
    };

    logger(`send stream to ${url}`);
    return this._send(url, params);
  }

  _handleJobEvent(job: Job) {
    this.emit(CoreEvent.JOB_ADDED, job);
  }

  _handleMessage(message: string) {
    try {
      const { event, data } = JSON.parse(message);

      switch (event) {
        case EngineEvent.JOB_CREATED:
          return this._handleJobEvent(data);
        default:
          jobLogger(`unknown event ${event}`);
      }
    } catch (error: any) {
      console.error('Monti APM: Failed to parse message', message);
      console.error(error.stack);
    }
  }

  _initWebSocket() {
    if (!this.featureSupported(Feature.WEBSOCKETS)) {
      return;
    }

    const { disconnect } = persistentConnectWebSocket(
      this,
      this._options.endpoint,
      this._websocketHeaders,
      this._handleMessage.bind(this),
    );

    this._disconnectWebSocket = disconnect;
  }

  // ping the server to check whether appId and appSecret
  // are valid and correct. Data sent inside http headers.
  async _checkAuth() {
    const uri = this._options.endpoint + '/ping';

    const params = { headers: this._headers };

    const res = await axiosRetry(uri, params, this._options.retryOptions);

    this._allowedFeatures = parseAllowedFeaturesHeader(
      res.headers[HttpHeader.ACCEPT_FEATURES],
    );

    return res.data;
  }

  // communicates with the server with http
  // Also handles response http status codes and retries
  async _send(url: string, params: Record<string, any>) {
    const res = await axiosRetry(
      url,
      {
        ...params,
        headers: {
          ...this._headers,
          ...params.headers,
        },
      },
      this._options.retryOptions,
    );
    return res.data;
  }
}

export default Kadira;

export * from './constants';

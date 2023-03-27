export const CoreEvent = {
  JOB_ADDED: 'job:added',

  DISCONNECT: 'disconnect',

  WEBSOCKET_CONNECTED: 'websocket:connected',
  WEBSOCKET_ATTEMPT: 'websocket:attempt',
  WEBSOCKET_CLOSED: 'websocket:closed',
  WEBSOCKET_BACKOFF: 'websocket:backoff',
  WEBSOCKET_BACKOFF_READY: 'websocket:backoff:ready',
  WEBSOCKET_BACKOFF_FAIL: 'websocket:backoff:fail',
  WEBSOCKET_BACKOFF_RESET: 'websocket:backoff:reset',
};


export const WebSocketEvent = {
  OPEN: 'open',
  CLOSE: 'close',
  MESSAGE: 'message',
  ERROR: 'error',
};

export const BackoffEvent = {
  READY: 'ready',
  BACKOFF: 'backoff',
  FAIL: 'fail',
};

export const ContentType = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  STREAM: 'application/octet-stream',
};

export const EngineEvent = {
  JOB_CREATED: 'job:created',
};

export const HttpHeader = {
  ACCEPT_FEATURES: 'accept-features',
};

export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
};

export const Feature = {
  WEBSOCKETS: 'websockets'
};

export const SupportedFeatures = {
  [Feature.WEBSOCKETS]: {
    version: '1.0',
  }
};

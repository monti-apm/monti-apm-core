export const CoreEvent = {
  JOB_ADDED: 'job:added',

  DISCONNECT: 'disconnect',

  WEBSOCKET_CONNECTED: 'websocket:connected',
  WEBSOCKET_ATTEMPT: 'websocket:attempt',
  WEBSOCKET_CLOSED: 'websocket:closed',
};


export const WebSocketEvent = {
  OPEN: 'open',
  CLOSE: 'close',
  MESSAGE: 'message',
  ERROR: 'error',
  PING: 'ping',
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
  [Feature.WEBSOCKETS]: true
};

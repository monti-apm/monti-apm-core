export const CoreEvent = {
  JOB_CREATED: 'job:created',

  DISCONNECT: 'disconnect',
};

export const WebSocketEvent = {
  OPEN: 'open',
  CLOSE: 'close',
  MESSAGE: 'message',
  ERROR: 'error',
  PING: 'ping',

  WEBSOCKET_CONNECTED: 'websocket:connected',
  WEBSOCKET_ATTEMPT: 'websocket:attempt',
  WEBSOCKET_CLOSED: 'websocket:closed',
};

export enum ContentType {
  JSON = 'application/json',
  TEXT = 'text/plain',
  STREAM = 'application/octet-stream',
}

export enum EngineEvent {
  JOB_CREATED = 'job:created',
}

export enum HttpHeader {
  ACCEPT_FEATURES = 'accept-features',
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

export enum Feature {
  WEBSOCKETS = 'websockets',
}

export const SupportedFeatures = {
  [Feature.WEBSOCKETS]: true,
};

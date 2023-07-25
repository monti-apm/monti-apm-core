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
}

export enum WebSocketEvent {
  OPEN = 'open',
  CLOSE = 'close',
  MESSAGE = 'message',
  ERROR = 'error',
  PING = 'ping',
}

export enum BackoffEvent {
  READY = 'ready',
  BACKOFF = 'backoff',
  FAIL = 'fail',
}

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
}

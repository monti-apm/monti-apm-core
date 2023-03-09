export const ContentType = {
  JSON: 'application/json',
  JSON_SEQ: 'application/json-seq',
  TEXT: 'text/plain',
  STREAM: 'application/octet-stream',
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

export const ContentType = {
  JSON: 'application/json',
  JSON_SEQ: 'application/json-seq',
  TEXT: 'text/plain',
  STREAM: 'application/octet-stream',
};

export const HttpHeader = {
  ALLOWED_FEATURES: 'allowed-features',
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
  JSON_STREAMING: 'json-streaming'
};

export const SupportedFeatures = {
  [Feature.JSON_STREAMING]: {
    version: '1.0',
  }
};

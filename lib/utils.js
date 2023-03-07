import retry, { ByPassRetryError } from './retry';
import axios from 'axios';
import debug from 'debug';
import { HttpMethod, SupportedFeatures } from './constants';
import { stringifyStream } from 'zipson-stream/lib';

const logger = debug('kadira-core:transport');

export function promisifyStream(stream) {
  let data = '';

  return new Promise((resolve, reject) => {
    stream.on('data', chunk => {
      data += chunk;
    });

    stream.on('end', () => {
      resolve(data);
    });

    stream.on('error', reject);
  });
}

export function StreamStringify(object) {
  return stringifyStream(object);
}

export function hasCircularReference(obj, visited = new WeakSet()) {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  if (visited.has(obj)) {
    return true;
  }

  visited.add(obj);

  if (Array.isArray(obj)) {
    for (let item of obj) {
      if (hasCircularReference(item, visited)) {
        return true;
      }
    }
  } else {
    for (let prop in obj) {
      if (hasCircularReference(obj[prop], visited)) {
        return true;
      }
    }
  }

  return false;
}

export function getAxiosConfig(params) {
  return {
    ...params,
    // Axios defaults to 10mb. Increases limit to 100mb.
    maxBodyLength: 100 * 1024 * 1024,
    method: params.method || HttpMethod.POST,
    maxRedirects: 0,
  };
}

export function axiosRetry(url, params) {
  let retryEnabled = true;

  if (params.noRetry) {
    retryEnabled = false;
    delete params.noRetry;
  }

  return retry(() => {
    return new Promise((resolve, reject) => {
      axios(url, getAxiosConfig(params)).then((res) => {
        return resolve(res);
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

export function parseAllowedFeaturesHeader(header) {
  const result = {};

  if (header) {
    header.split(',').map(feature => {
      const [ name, version ] = feature.split(':');

      if (SupportedFeatures[name].version === version) {
        result[name] = true;
      }
    });
  }

  return result;
}

import retry, { ByPassRetryError, RetryOptions } from '../retry';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import debug from 'debug';
import { Feature, HttpMethod, SupportedFeatures } from '../constants';

const logger = debug('monti-apm-core:transport');

export function getAxiosConfig(params: AxiosRequestConfig): AxiosRequestConfig {
  return {
    ...params,
    // Axios defaults to 10mb. Increases limit to 3gb
    // (large enough for most heap snapshots).
    maxBodyLength: 3 * 1024 * 1024 * 1024,
    method: params.method || HttpMethod.POST,
    proxy: false,
  };
}

export function axiosRetry(
  url: string,
  params: {
    noRetry?: boolean;
  } & AxiosRequestConfig<any>,
  retryOptions?: RetryOptions,
): Promise<AxiosResponse> {
  let retryEnabled = true;

  if (params.noRetry) {
    retryEnabled = false;
    delete params.noRetry;
  }

  return retry(() => {
    return new Promise((resolve, reject) => {
      axios(url, getAxiosConfig(params))
        .then((res) => {
          return resolve(res);
        })
        .catch((err) => {
          if (err.response && err.response.status) {
            const status = err.response.status;

            if (status === 401) {
              logger('Error: Unauthorized');
              return reject(new ByPassRetryError('Unauthorized'));
            } else if (status >= 400 && status < 500) {
              const message = `Agent Error: ${status}`;
              logger(`Error: ${message}`);

              const bypassError = new ByPassRetryError(message);
              bypassError.original = err;

              return reject(bypassError);
            }

            const message = `Request failed: ${status}`;
            const ErrConstructor = retryEnabled ? Error : ByPassRetryError;

            logger(`Error: ${message}`);
            return reject(new ErrConstructor(message));
          }

          if (!retryEnabled) {
            const oldErr = err;
            // eslint-disable-next-line no-param-reassign
            err = new ByPassRetryError(oldErr.message);
            err.stack = oldErr.stack;
          }

          return reject(err);
        });
    });
  }, retryOptions);
}

export function parseAllowedFeaturesHeader(header: string) {
  const result: Record<string, boolean> = {};

  if (header) {
    header.split(',').map((feature) => {
      if (SupportedFeatures[feature as Feature]) {
        result[feature] = true;
      }
    });
  }

  return result;
}

export function stringifySupportedFeatures(features: Record<string, boolean>) {
  return Object.entries(features)
    .reduce((acc: string[], [key, value]) => {
      if (value) {
        acc.push(key);
      }

      return acc;
    }, [])
    .join(',');
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

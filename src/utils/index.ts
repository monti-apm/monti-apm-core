import retry, {ByPassRetryError, RetryOptions} from '../retry';
import axios, {AxiosResponse} from 'axios';
import debug from 'debug';
import {HttpMethod, SupportedFeatures} from '@/constants';

const logger = debug('kadira-core:transport');

export function getAxiosConfig(params: {
  headers?: Record<string, string | undefined> | undefined;
  noRetry?: boolean | undefined;
  method?: any;
}) {
  return {
    ...params,
    // Axios defaults to 10mb. Increases limit to 100mb.
    maxBodyLength: 100 * 1024 * 1024,
    method: params.method || HttpMethod.POST,
    maxRedirects: 0,
  };
}

export function axiosRetry(
  url: string,
  params: {
    headers?: Record<string, string | undefined>;
    noRetry?: boolean;
  },
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
              return reject(new ByPassRetryError(message));
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
  const result = {};

  if (header) {
    header.split(',').map((feature: string | number) => {
      if (SupportedFeatures[feature]) {
        result[feature] = true;
      }
    });
  }

  return result;
}

export function stringifySupportedFeatures(features: Record<string, boolean>) {
  return entries(features)
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

export const entries = <T extends Record<string, any>>(obj: T) =>
    Object.keys(obj).map((key) => [key, obj[key]] as [keyof T, T[keyof T]]);
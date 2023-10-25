import { sleep } from './utils';
import { merge } from 'remeda';

export class MaxRetryError extends Error {
  /**
   * Reject the promise with this error when run out of retry attempts.
   */
  constructor(message: string) {
    super(message);
    this.message = message;
  }
}

export class ByPassRetryError extends Error {
  /**
   * reject the promise with this error (in getPromise) to stop retrying.
   */
  constructor(message: string) {
    super(message);
    this.message = message;
  }
}

export type RetryOptions = {
  maxRetries?: number;
  timeFunction?: (i: number) => number;
};

/**
 * Retry module takes a `getPromise` function as the main argument.
 * The `getPromise` function should return a promise which will be used
 * to decide whether the task ran successfully. If the task failed,
 * it will retry by running the `getPromise` function again. Retry will
 * stop when it has tried `maxRetries` times or if the promise fails
 * with the special error `ERR_ENDRETRY`.
 */
export default function retry<T = any>(
  getPromise: () => Promise<T>,
  _options?: Partial<RetryOptions>,
): Promise<T> {
  const options = merge(
    {
      maxRetries: 3,
      timeFunction: (i: number) => retry._initialDelay * Math.pow(i, 2),
    },
    _options,
  );

  // The retry module returns a promise which will end when the task
  // is successful or when the retry fails by retry count or by user.
  // It will also collect start/end times for each retry attempt.
  return new Promise(function (resolve, reject) {
    let count = 0;

    const onError = function (err: any) {
      if (err instanceof ByPassRetryError) {
        reject(err);
      } else {
        attempt(err);
      }
    };

    const attempt = function (lastError: any = null) {
      // Does not include the first attempt to avoid confusion as the
      // option is `max[Re]tries`.
      if (count++ > options.maxRetries) {
        const message = `Reached maximum retry limit for ${
          lastError?.message ?? 'unknown error'
        }`;
        const err = new MaxRetryError(message);
        return reject(err);
      }

      // stop a few milliseconds between retries
      const millis = options.timeFunction(count);
      sleep(millis)
        .then(() => {
          return getPromise();
        })
        .then(resolve, onError);
    };

    // start!
    attempt();
  });
}

retry._initialDelay = 5000;

import assert from 'assert';
import { describe, it } from 'mocha';
import retry, { ByPassRetryError, MaxRetryError } from './retry.ts';

describe('retry', function () {
  it('should retry N times', async function () {
    this.timeout(6e4);
    let erred = false;
    let result;
    let count = 0;
    const err = new Error('Some Error');

    try {
      result = await retry(
        () => {
          count += 1;
          return new Promise((_, r) => r(err));
        },
        { maxRetries: 3 },
      );
    } catch (e) {
      assert.strictEqual(e instanceof MaxRetryError, true);
      assert.strictEqual(
        e.message,
        `Reached maximum retry limit for ${err.message}`,
      );
      erred = true;
    }

    assert(erred);
    assert.strictEqual(result, undefined);
    assert.strictEqual(count, 4);
  });

  it('should stop on success', async function () {
    this.timeout(6e4);
    let erred = false;
    let result;

    try {
      result = await retry(() => Promise.resolve('result'));
    } catch (e) {
      erred = true;
    }

    assert(!erred);
    assert.strictEqual(result, 'result');
  });

  it('should stop on endretry', async function () {
    this.timeout(6e4);
    let erred = false;
    let result;

    try {
      result = await retry(() => {
        return new Promise((_, reject) => reject(new ByPassRetryError('ERR')));
      });
    } catch (e) {
      assert.strictEqual(e instanceof ByPassRetryError, true);
      assert.strictEqual(e.message, 'ERR');
      erred = true;
    }

    assert(erred);
    assert.strictEqual(result, undefined);
  });
});

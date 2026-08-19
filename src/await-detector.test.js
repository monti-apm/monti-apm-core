import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { sleep } from './utils';
import { SupportsAsyncLocalStorage } from './utils/platform';

(SupportsAsyncLocalStorage ? describe : describe.skip)(
  'AwaitDetector',
  async () => {
    let AwaitDetector;
    if (SupportsAsyncLocalStorage) {
      AwaitDetector = require('./await-detector').AwaitDetector;
    }

    let detector;

    beforeEach(() => {
      detector = new AwaitDetector({
        logging: true,
      });
    });

    afterEach(() => {
      mock.reset();
      detector.destroy();
    });

    describe('promise constructor', () => {
      it('should replace the global promise constructor', () => {
        const originalPromise = AwaitDetector.OldPromiseConstructor;

        assert.notStrictEqual(global.Promise, originalPromise);
        assert.strictEqual(global.Promise[AwaitDetector.Symbol], true);
      });

      it('should unwrap the promise constructor', () => {
        const originalPromise = AwaitDetector.OldPromiseConstructor;

        detector.destroy();

        assert.strictEqual(global.Promise, originalPromise);
        assert.strictEqual(global.Promise[AwaitDetector.Symbol], undefined);
      });

      it('should have native promises instanceof wrapped promise', () => {
        const WrappedPromise = detector.createWrappedPromiseConstructor(
          global.Promise,
        );
        const prom = (async () => {
          await 0;
        })();
        assert(prom instanceof WrappedPromise);
      });
    });

    describe('detecting await', () => {
      it('should run onAwaitStart and onAwaitEnd', async () => {
        console.log(detector);

        const onAwaitStartSpy = mock.method(detector, 'onAwaitStart');
        const onAwaitEndSpy = mock.method(detector, 'onAwaitEnd');

        const result = await detector.detect(async () => {
          await sleep(10);

          return true;
        });

        assert.strictEqual(result, true);

        assert.strictEqual(onAwaitStartSpy.mock.callCount(), 1);
        assert.strictEqual(onAwaitEndSpy.mock.callCount(), 1);

        assert.strictEqual(onAwaitStartSpy.mock.calls[0].arguments.length, 2);
        assert.strictEqual(onAwaitEndSpy.mock.calls[0].arguments.length, 2);
      });

      it('should resolve awaits in the correct order', async () => {
        const onAwaitStartSpy = mock.method(detector, 'onAwaitStart');
        const onAwaitEndSpy = mock.method(detector, 'onAwaitEnd');

        const result = await detector.detect(async () => {
          await sleep(10);
          await sleep(20);
          await sleep(30);
          return true;
        });

        assert.strictEqual(result, true);

        assert.strictEqual(onAwaitStartSpy.mock.callCount(), 3);
        assert.strictEqual(onAwaitEndSpy.mock.callCount(), 3);

        const starts = onAwaitStartSpy.mock.calls.map(
          (call) => call.arguments[0],
        );
        const ends = onAwaitEndSpy.mock.calls.map((call) => call.arguments[0]);

        assert.deepStrictEqual(starts, ends);
      });

      it('should track a complicated scenario', async () => {
        const onAwaitStartSpy = mock.method(detector, 'onAwaitStart');
        const onAwaitEndSpy = mock.method(detector, 'onAwaitEnd');

        const result = await detector.detect(async () => {
          let promise = Promise.resolve();
          console.log('before Promise.all');
          await Promise.all([promise]);
          await Promise.resolve(promise).then(async () => {
            console.log('before await');
            // await 0
            console.log('after await');
          });
          console.log('after Promise.all');
          await sleep(10);
          await sleep(20);
          await sleep(30);
          return true;
        });

        assert.strictEqual(result, true);

        assert.strictEqual(onAwaitStartSpy.mock.callCount(), 5);
        assert.strictEqual(onAwaitEndSpy.mock.callCount(), 5);

        const starts = onAwaitStartSpy.mock.calls.map(
          (call) => call.arguments[0],
        );
        const ends = onAwaitEndSpy.mock.calls.map((call) => call.arguments[0]);

        assert.deepStrictEqual(starts, ends);
      });

      it('should track a complicated scenario', async () => {
        const onAwaitStartSpy = mock.method(detector, 'onAwaitStart');
        const onAwaitEndSpy = mock.method(detector, 'onAwaitEnd');

        const result = await detector.detect(async () => {
          let promise = Promise.resolve();
          console.log('before Promise.all');
          await Promise.all([
            promise,
            Promise.resolve(promise).then(async () => {
              console.log('before await');
              await 0;
              console.log('after await');
            }),
          ]);
          console.log('after Promise.all');
          await sleep(10);
          await sleep(20);
          await sleep(30);
          return true;
        });

        assert.strictEqual(result, true);

        assert.strictEqual(onAwaitStartSpy.mock.callCount(), 4);
        assert.strictEqual(onAwaitEndSpy.mock.callCount(), 4);

        const starts = onAwaitStartSpy.mock.calls.map(
          (call) => call.arguments[0],
        );
        const ends = onAwaitEndSpy.mock.calls.map((call) => call.arguments[0]);

        assert.deepStrictEqual(starts, ends);
      });

      it('should ignore awaits', async () => {
        const onAwaitStartSpy = mock.method(detector, 'onAwaitStart');
        const onAwaitEndSpy = mock.method(detector, 'onAwaitEnd');

        const result = await detector.detect(async () => {
          await sleep(10);

          await detector.ignore(async () => {
            await sleep(30);
            await sleep(30);
            await sleep(30);
            await sleep(30);
          });

          await sleep(20);

          return true;
        });

        assert.strictEqual(result, true);

        assert.strictEqual(onAwaitStartSpy.mock.callCount(), 2);
        assert.strictEqual(onAwaitEndSpy.mock.callCount(), 2);

        const starts = onAwaitStartSpy.mock.calls.map(
          (call) => call.arguments[0],
        );
        const ends = onAwaitEndSpy.mock.calls.map((call) => call.arguments[0]);

        assert.deepStrictEqual(starts, ends);
      });

      it('should detect await for nested async function', async () => {
        const onAwaitStartSpy = mock.method(detector, 'onAwaitStart');
        const onAwaitEndSpy = mock.method(detector, 'onAwaitEnd');

        async function asyncTest() {
          await 0;
          await 0;
        }

        await detector.detect(async () => {
          await 0;
          await asyncTest();
        });

        assert.strictEqual(onAwaitStartSpy.mock.callCount(), 3);
        assert.strictEqual(onAwaitEndSpy.mock.callCount(), 3);
      });

      it('should detect await for sleep function', async () => {
        const onAwaitStartSpy = mock.method(detector, 'onAwaitStart');
        const onAwaitEndSpy = mock.method(detector, 'onAwaitEnd');

        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        await detector.detect(async () => {
          await sleep(1);
          await sleep(1);
        });

        assert.strictEqual(onAwaitStartSpy.mock.callCount(), 2);
        assert.strictEqual(onAwaitEndSpy.mock.callCount(), 2);
      });

      it('should not error when calling detect on destroyed detector', () => {
        detector.destroy();

        assert.doesNotThrow(() => detector.detect(() => {}));
      });

      it.skip('should stop detecting after clean', async () => {
        const onAwaitStartSpy = mock.method(detector, 'onAwaitStart');
        const onAwaitEndSpy = mock.method(detector, 'onAwaitEnd');

        const result = await detector.detect(async () => {
          await sleep(10);
          detector.clean(detector.getStore());
          await sleep(20);

          return true;
        });

        assert.strictEqual(result, true);

        assert.strictEqual(onAwaitStartSpy.mock.callCount(), 1);
        assert.strictEqual(onAwaitEndSpy.mock.callCount(), 1);

        const starts = onAwaitStartSpy.mock.calls.map(
          (call) => call.arguments[0],
        );
        const ends = onAwaitEndSpy.mock.calls.map((call) => call.arguments[0]);

        assert.deepStrictEqual(starts, ends);
      });
    });
  },
);

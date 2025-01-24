import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { spy } from 'sinon';
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
      detector.destroy();
    });

    describe('promise constructor', () => {
      it('should replace the global promise constructor', () => {
        const originalPromise = AwaitDetector.OldPromiseConstructor;

        expect(global.Promise).to.not.equal(originalPromise);
        expect(global.Promise[AwaitDetector.Symbol]).to.be.true;
      });

      it('should unwrap the promise constructor', () => {
        const originalPromise = AwaitDetector.OldPromiseConstructor;

        detector.destroy();

        expect(global.Promise).to.equal(originalPromise);
        expect(global.Promise[AwaitDetector.Symbol]).to.be.undefined;
      });
    });

    describe('detecting await', () => {
      it('should run onAwaitStart and onAwaitEnd', async () => {
        console.log(detector);

        const onAwaitStartSpy = spy(detector, 'onAwaitStart');
        const onAwaitEndSpy = spy(detector, 'onAwaitEnd');

        const result = await detector.detect(async () => {
          await sleep(10);

          return true;
        });

        expect(result).to.be.true;

        expect(onAwaitStartSpy.calledOnce).to.be.true;
        expect(onAwaitEndSpy.calledOnce).to.be.true;

        expect(onAwaitStartSpy.getCall(0).args).to.have.length(2);
        expect(onAwaitEndSpy.getCall(0).args).to.have.length(2);

        onAwaitStartSpy.restore();
        onAwaitEndSpy.restore();
      });

      it('should resolve awaits in the correct order', async () => {
        const onAwaitStartSpy = spy(detector, 'onAwaitStart');
        const onAwaitEndSpy = spy(detector, 'onAwaitEnd');

        const result = await detector.detect(async () => {
          await sleep(10);
          await sleep(20);
          await sleep(30);
          return true;
        });

        expect(result).to.be.true;

        expect(onAwaitStartSpy.callCount).to.be.equal(3);
        expect(onAwaitEndSpy.callCount).to.be.equal(3);

        const starts = onAwaitStartSpy.getCalls().map((call) => call.args[0]);
        const ends = onAwaitEndSpy.getCalls().map((call) => call.args[0]);

        expect(starts).to.be.deep.equal(ends);

        onAwaitStartSpy.restore();
        onAwaitEndSpy.restore();
      });

      it('should track a complicated scenario', async () => {
        const onAwaitStartSpy = spy(detector, 'onAwaitStart');
        const onAwaitEndSpy = spy(detector, 'onAwaitEnd');

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

        expect(result).to.be.true;

        expect(onAwaitStartSpy.callCount).to.be.equal(5);
        expect(onAwaitEndSpy.callCount).to.be.equal(5);

        const starts = onAwaitStartSpy.getCalls().map((call) => call.args[0]);
        const ends = onAwaitEndSpy.getCalls().map((call) => call.args[0]);

        expect(starts).to.be.deep.equal(ends);

        onAwaitStartSpy.restore();
        onAwaitEndSpy.restore();
      });

      it('should track a complicated scenario', async () => {
        const onAwaitStartSpy = spy(detector, 'onAwaitStart');
        const onAwaitEndSpy = spy(detector, 'onAwaitEnd');

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

        expect(result).to.be.true;

        expect(onAwaitStartSpy.callCount).to.be.equal(4);
        expect(onAwaitEndSpy.callCount).to.be.equal(4);

        const starts = onAwaitStartSpy.getCalls().map((call) => call.args[0]);
        const ends = onAwaitEndSpy.getCalls().map((call) => call.args[0]);

        expect(starts).to.be.deep.equal(ends);

        onAwaitStartSpy.restore();
        onAwaitEndSpy.restore();
      });

      it('should ignore awaits', async () => {
        const onAwaitStartSpy = spy(detector, 'onAwaitStart');
        const onAwaitEndSpy = spy(detector, 'onAwaitEnd');

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

        expect(result).to.be.true;

        expect(onAwaitStartSpy.callCount).to.be.equal(2);
        expect(onAwaitEndSpy.callCount).to.be.equal(2);

        const starts = onAwaitStartSpy.getCalls().map((call) => call.args[0]);
        const ends = onAwaitEndSpy.getCalls().map((call) => call.args[0]);

        expect(starts).to.be.deep.equal(ends);

        onAwaitStartSpy.restore();
        onAwaitEndSpy.restore();
      });

      it('should detect await for nested async function', async () => {
        const onAwaitStartSpy = spy(detector, 'onAwaitStart');
        const onAwaitEndSpy = spy(detector, 'onAwaitEnd');

        async function asyncTest() {
          await 0;
          await 0;
        }

        await detector.detect(async () => {
          await 0;
          await asyncTest();
        });

        expect(onAwaitStartSpy.callCount).to.be.equal(3);
        expect(onAwaitEndSpy.callCount).to.be.equal(3);

        onAwaitStartSpy.restore();
        onAwaitEndSpy.restore();
      });

      it('should detect await for sleep function', async () => {
        const onAwaitStartSpy = spy(detector, 'onAwaitStart');
        const onAwaitEndSpy = spy(detector, 'onAwaitEnd');

        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        await detector.detect(async () => {
          await sleep(1);
          await sleep(1);
        });

        expect(onAwaitStartSpy.callCount).to.be.equal(2);
        expect(onAwaitEndSpy.callCount).to.be.equal(2);

        onAwaitStartSpy.restore();
        onAwaitEndSpy.restore();
      });

      it('should not error when calling detect on destroyed detector', () => {
        detector.destroy();

        expect(() => detector.detect(() => {})).to.not.throw();
      });

      it.skip('should stop detecting after clean', async () => {
        const onAwaitStartSpy = spy(detector, 'onAwaitStart');
        const onAwaitEndSpy = spy(detector, 'onAwaitEnd');

        const result = await detector.detect(async () => {
          await sleep(10);
          detector.clean(detector.getStore());
          await sleep(20);

          return true;
        });

        expect(result).to.be.true;

        expect(onAwaitStartSpy.callCount).to.be.equal(1);
        expect(onAwaitEndSpy.callCount).to.be.equal(1);

        const starts = onAwaitStartSpy.getCalls().map((call) => call.args[0]);
        const ends = onAwaitEndSpy.getCalls().map((call) => call.args[0]);

        expect(starts).to.be.deep.equal(ends);

        onAwaitStartSpy.restore();
        onAwaitEndSpy.restore();
      });
    });
  },
);

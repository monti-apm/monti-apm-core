import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { spy } from 'sinon';
import { sleep } from './utils';
import { SupportsAsyncHooks } from './utils/platform';

(SupportsAsyncHooks ? describe : describe.skip)('AwaitDetector', async () => {
  const { AwaitDetector, AwaitDetectorSymbol } = SupportsAsyncHooks
    ? await import('./await-detector')
    : {};

  let detector;

  beforeEach(() => {
    detector = new AwaitDetector({
      logging: true,
    });
  });

  afterEach(() => {
    detector.unregister();
  });

  describe('enable and disable', () => {
    it('should enable and disable the hook', () => {
      const enableSpy = spy(detector.hook, 'enable');
      const disableSpy = spy(detector.hook, 'disable');

      detector.enable();
      expect(enableSpy.calledOnce).to.be.true;

      detector.disable();
      expect(disableSpy.calledOnce).to.be.true;

      enableSpy.restore();
      disableSpy.restore();
    });
  });

  describe('promise constructor', () => {
    it('should replace the global promise constructor', () => {
      const originalPromise = AwaitDetector.OldPromiseCtor;

      expect(global.Promise).to.not.equal(originalPromise);
      expect(global.Promise[AwaitDetectorSymbol]).to.be.true;
    });

    it('should unwrap the promise constructor', () => {
      const originalPromise = AwaitDetector.OldPromiseCtor;

      detector.unregister();

      expect(global.Promise).to.equal(originalPromise);
      expect(global.Promise[AwaitDetectorSymbol]).to.be.undefined;
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
  });
});

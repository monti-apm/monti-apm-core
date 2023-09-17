import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { spy } from 'sinon';
import { AwaitDetector, AwaitDetectorSymbol } from './await-detector';
import { sleep } from './utils';

describe('AwaitDetector', () => {
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
      const originalPromise = AwaitDetector.OLD_PROMISE_CONSTRUCTOR;

      expect(global.Promise).to.not.equal(originalPromise);
      expect(global.Promise[AwaitDetectorSymbol]).to.be.true;
    });

    it('should unwrap the promise constructor', () => {
      const originalPromise = AwaitDetector.OLD_PROMISE_CONSTRUCTOR;

      detector.unregister();

      expect(global.Promise).to.equal(originalPromise);
      expect(global.Promise[AwaitDetectorSymbol]).to.be.undefined;
    });
  });

  describe('detecting await', () => {
    it('should run onAwaitStart and onAwaitEnd', async () => {
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
  });
});

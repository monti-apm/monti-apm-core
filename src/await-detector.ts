import { writeSync } from 'fs';
import { stdout } from 'process';
import {
  AsyncHook,
  AsyncLocalStorage,
  createHook,
  executionAsyncId,
} from 'async_hooks';

type AsyncCallback = (asyncId: number, triggerAsyncId: number) => void;

export class AwaitDetector {
  static OldPromiseCtor = global.Promise;
  static Storage = new AsyncLocalStorage();
  static Symbol = Symbol('AsyncDetector');

  start = Date.now();

  asyncFunctions = new Set();
  awaits = new Set();
  afterAwaits = new Map();
  ignoreNextPromise = 0;

  awaitData = new Map<number, [number]>();

  hook: AsyncHook;

  logging: boolean;
  onAwaitStart: AsyncCallback;
  onAwaitEnd: AsyncCallback;

  constructor({
    logging = false,
    onAwaitStart = () => {},
    onAwaitEnd = () => {},
  }: {
    logging?: boolean;
    onAwaitStart?: AsyncCallback;
    onAwaitEnd?: AsyncCallback;
  } = {}) {
    this.logging = logging;
    this.onAwaitStart = onAwaitStart;
    this.onAwaitEnd = onAwaitEnd;

    this.registerPromiseConstructor();

    this.hook = createHook({
      init: this.init.bind(this),
      before: this.before.bind(this),
      destroy: this.destroy.bind(this),
      promiseResolve: this.promiseResolve.bind(this),
    });

    this.enable();
  }

  enable() {
    this.hook.enable();
  }

  disable() {
    this.hook.disable();
  }

  unregister() {
    this.disable();
    global.Promise = AwaitDetector.OldPromiseCtor;
  }

  log(...args: any[]) {
    if (!this.logging) {
      return;
    }

    writeSync(
      stdout.fd,
      `${args.join(' ')} [at ${Date.now() - this.start}ms]\n`,
    );
  }

  registerPromiseConstructor() {
    if (global.Promise[AwaitDetector.Symbol]) {
      return;
    }

    const self = this;

    global.Promise = class<T> extends Promise<T> {
      constructor(
        executor: (
          resolve: (value: T | PromiseLike<T>) => void,
          reject: (reason?: any) => void,
        ) => void,
      ) {
        self.ignoreNextPromise++;
        super(executor);
      }
    };

    global.Promise[AwaitDetector.Symbol] = true;
  }

  isWithinContext() {
    const store = AwaitDetector.Storage.getStore();

    if (store?.[AwaitDetector.Symbol] === this) return true;
    if (store?.[AwaitDetector.Symbol] === undefined) return false;

    throw new Error(
      'AwaitDetectorStorage is being used by another AwaitDetector instance',
    );
  }

  init(asyncId: number, type: string, triggerAsyncId: number) {
    if (type !== 'PROMISE') {
      return;
    }

    if (!this.isWithinContext()) {
      return;
    }

    if (this.ignoreNextPromise > 0) {
      this.ignoreNextPromise--;
      return;
    }

    const isAsyncFunction = triggerAsyncId === executionAsyncId();

    if (isAsyncFunction) {
      this.asyncFunctions.add(asyncId);
      this.log(`${type}(${asyncId}): async function start`);
      return;
    }

    if (this.asyncFunctions.has(triggerAsyncId)) {
      this.onAwaitStart(asyncId, triggerAsyncId);
      this.awaits.add(asyncId);
      this.awaitData.set(asyncId, [triggerAsyncId]);
      this.log(
        `${type}(${asyncId}): await start - async function: ${triggerAsyncId}`,
      );
    } else if (this.awaits.has(triggerAsyncId)) {
      this.afterAwaits.set(asyncId, triggerAsyncId);
    }
  }

  before(asyncId: number) {
    if (!this.isWithinContext()) {
      return;
    }

    if (this.afterAwaits.has(asyncId)) {
      const awaitAsyncId = this.afterAwaits.get(asyncId);

      if (!this.awaitData.has(awaitAsyncId)) return;
      const [triggerAsyncId] = this.awaitData.get(awaitAsyncId) as [number];
      this.onAwaitEnd(awaitAsyncId, triggerAsyncId);
      this.awaitData.delete(awaitAsyncId);
      // Awaited a thenable or non-promise value
      this.log(`await end:  ${this.afterAwaits.get(asyncId)} (A)`);
    } else if (this.awaits.has(asyncId)) {
      // Awaited a native promise
      this.log(`await end:  ${asyncId} (B)`);
    }
  }

  destroy(asyncId: number) {
    if (!this.isWithinContext()) {
      return;
    }

    if (this.asyncFunctions.has(asyncId)) {
      this.asyncFunctions.delete(asyncId);
      return;
    }

    if (this.awaits.has(asyncId)) {
      this.awaits.delete(asyncId);
    }
  }

  promiseResolve(asyncId: number) {
    if (!this.isWithinContext()) {
      return;
    }

    if (this.asyncFunctions.has(asyncId)) {
      this.asyncFunctions.delete(asyncId);
    } else if (this.awaits.has(asyncId)) {
      this.awaits.delete(asyncId); // Added later
    } else if (this.afterAwaits.has(asyncId)) {
      this.log(`promise resolve: ${asyncId} (C)`);
      this.afterAwaits.delete(asyncId); // Added later
    }
  }

  detect(callback: (...args: any[]) => any) {
    return AwaitDetector.Storage.run(
      {
        [AwaitDetector.Symbol]: this,
      },
      callback,
    );
  }
}

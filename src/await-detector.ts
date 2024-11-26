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
  static IgnoreStorage = new AsyncLocalStorage();
  static Symbol = Symbol('AsyncDetector');

  start = Date.now();

  afterAwaits = new Map();
  ignoreNextPromise = 0;

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
    // @ts-ignore
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

    // @ts-ignore
    global.Promise[AwaitDetector.Symbol] = true;
  }

  isWithinContext() {
    const store = AwaitDetector.Storage.getStore() as any;

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

    if (AwaitDetector.IgnoreStorage.getStore()) return;

    const store = AwaitDetector.Storage.getStore() as any;

    const isAsyncFunction = triggerAsyncId === executionAsyncId();

    if (isAsyncFunction) {
      store.asyncFunctions.add(asyncId);
      this.log(`${type}(${asyncId}): async function start`);
      return;
    }

    if (store.asyncFunctions.has(triggerAsyncId)) {
      this.onAwaitStart(asyncId, triggerAsyncId);
      store.awaits.add(asyncId);
      store.awaitData.set(asyncId, [triggerAsyncId]);
      this.log(
        `${type}(${asyncId}): await start - async function: ${triggerAsyncId}`,
      );
    } else if (store.awaits.has(triggerAsyncId)) {
      this.afterAwaits.set(asyncId, triggerAsyncId);
    }
  }

  before(asyncId: number) {
    if (!this.isWithinContext()) {
      return;
    }

    const store = AwaitDetector.Storage.getStore() as any;

    if (this.afterAwaits.has(asyncId)) {
      const awaitAsyncId = this.afterAwaits.get(asyncId);

      if (!store.awaitData.has(awaitAsyncId)) return;
      const [triggerAsyncId] = store.awaitData.get(awaitAsyncId) as [number];
      this.onAwaitEnd(awaitAsyncId, triggerAsyncId);
      store.awaitData.delete(awaitAsyncId);
      // Awaited a thenable or non-promise value
      this.log(`await end:  ${this.afterAwaits.get(asyncId)} (A)`);
    } else if (store.awaits.has(asyncId)) {
      if (!store.awaitData.has(asyncId)) return;
      const [triggerAsyncId] = store.awaitData.get(asyncId) as [number];
      this.onAwaitEnd(asyncId, triggerAsyncId);
      store.awaitData.delete(asyncId);
      // Awaited a native promise
      this.log(`await end:  ${asyncId} (B)`);
    }
  }

  promiseResolve(asyncId: number) {
    if (!this.isWithinContext()) {
      return;
    }

    const store = AwaitDetector.Storage.getStore() as any;

    if (store.asyncFunctions.has(asyncId)) {
      store.asyncFunctions.delete(asyncId);
    } else if (store.awaits.has(asyncId)) {
      store.awaits.delete(asyncId); // Added later
    } else if (this.afterAwaits.has(asyncId)) {
      this.log(`promise resolve: ${asyncId} (C)`);
      this.afterAwaits.delete(asyncId); // Added later
    }
  }

  detect(callback: (...args: any[]) => any) {
    return AwaitDetector.Storage.run(
      {
        [AwaitDetector.Symbol]: this,
        asyncFunctions: new Set(),
        awaits: new Set(),
        awaitData: new Map(),
      },
      callback,
    );
  }

  getStore() {
    if (!this.isWithinContext) {
      return;
    }

    return AwaitDetector.Storage.getStore() as any;
  }

  clean(store: any) {
    if (store && store[AwaitDetector.Symbol] === this) {
      // Set to undefined to disable the store
      store[AwaitDetector.Symbol] = undefined;
      store.asyncFunctions.clear();
      store.awaits.clear();
      store.awaitData.clear();
    }
  }

  ignore(callback: (...args: any[]) => any) {
    return AwaitDetector.IgnoreStorage.run(true, callback);
  }
}

import { writeSync } from 'fs';
import { stdout } from 'process';
import {
  AsyncHook,
  AsyncLocalStorage,
  createHook,
  executionAsyncId,
  executionAsyncResource,
} from 'async_hooks';

type AsyncCallback = (asyncId: number, triggerAsyncId: number) => void;

export class AwaitDetector {
  static OldPromiseCtor = global.Promise;
  static Storage = new AsyncLocalStorage();
  static IgnoreStorage = new AsyncLocalStorage();
  static Symbol = Symbol('AsyncDetector');
  static IsAwait = Symbol('IsAwait');
  static IsAsyncFunction = Symbol('IsAsyncFunction');

  start = Date.now();

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

  init(asyncId: number, type: string, triggerAsyncId: number, resource: any) {
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

    const isAsyncFunction = triggerAsyncId === executionAsyncId();

    if (isAsyncFunction) {
      resource[AwaitDetector.IsAsyncFunction] = true;
      this.log(`${type}(${asyncId}): async function start`);
      return;
    }

    const triggerResource = executionAsyncResource() as any;

    if (triggerResource[AwaitDetector.IsAsyncFunction]) {
      this.onAwaitStart(asyncId, triggerAsyncId);
      resource[AwaitDetector.IsAwait] = true;
      this.awaitData.set(asyncId, [triggerAsyncId]);
      this.log(
        `${type}(${asyncId}): await start - async function: ${triggerAsyncId}`,
      );
    } else if (triggerResource[AwaitDetector.IsAwait]) {
      this.afterAwaits.set(asyncId, triggerAsyncId);
    }
  }

  before(asyncId: number) {
    if (!this.isWithinContext()) {
      return;
    }

    const resource = executionAsyncResource() as any;

    if (this.afterAwaits.has(asyncId)) {
      const awaitAsyncId = this.afterAwaits.get(asyncId);

      if (!this.awaitData.has(awaitAsyncId)) return;
      const [triggerAsyncId] = this.awaitData.get(awaitAsyncId) as [number];
      this.onAwaitEnd(awaitAsyncId, triggerAsyncId);
      this.awaitData.delete(awaitAsyncId);
      // Awaited a thenable or non-promise value
      this.log(`await end:  ${this.afterAwaits.get(asyncId)} (A)`);
    } else if (resource[AwaitDetector.IsAwait]) {
      if (!this.awaitData.has(asyncId)) return;
      const [triggerAsyncId] = this.awaitData.get(asyncId) as [number];
      this.onAwaitEnd(asyncId, triggerAsyncId);
      this.awaitData.delete(asyncId);
      // Awaited a native promise
      this.log(`await end:  ${asyncId} (B)`);
    }
  }

  promiseResolve(asyncId: number) {
    if (!this.isWithinContext()) {
      return;
    }

    if (this.afterAwaits.has(asyncId)) {
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

  ignore(callback: (...args: any[]) => any) {
    return AwaitDetector.IgnoreStorage.run(true, callback);
  }
}

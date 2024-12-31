import { promiseHooks } from 'node:v8';

const IS_ASYNC_FUNCTION = 0;
const IS_FROM_ASYNC_FUNCTION_1 = 1;
const IS_FROM_ASYNC_FUNCTION_2 = 2;

const ContextSymbol = Symbol('monti-await-detector-context');
const TypeSymbol = Symbol('monti-await-detector-type');

type PromiseWithSymbols = Promise<any> & {
  [ContextSymbol]: object;
  [TypeSymbol]: number;
};

export class AwaitDetector {
  static OldPromiseConstructor = global.Promise;
  static Symbol = Symbol('monti-await-detector-constructor');

  public destroyed: boolean;
  private trackingContext: null | object;

  // eslint-disable-next-line @typescript-eslint/ban-types
  private stopHookSet: Function;
  private nextPromiseFromConstructor: boolean;
  private onAwaitStart: (promise: Promise<any>, context: object) => void;
  private onAwaitEnd: (promise: Promise<any>, context: object) => void;

  constructor({
    onAwaitStart = () => {},
    onAwaitEnd = () => {},
  }: {
    onAwaitStart: () => void;
    onAwaitEnd: () => void;
  }) {
    this.onAwaitStart = onAwaitStart;
    this.onAwaitEnd = onAwaitEnd;
    this.destroyed = false;
    this.trackingContext = null;
    this.nextPromiseFromConstructor = false;

    this.stopHookSet = promiseHooks.createHook({
      init: (_promise, _parent) => {
        const promise = _promise as PromiseWithSymbols;
        const parent = _parent as PromiseWithSymbols;

        if (this.nextPromiseFromConstructor) {
          this.nextPromiseFromConstructor = false;
          return;
        }

        if (parent === undefined) {
          if (this.trackingContext) {
            promise[TypeSymbol] = IS_ASYNC_FUNCTION;
            promise[ContextSymbol] = this.trackingContext;
          }

          return;
        }

        const parentType = parent[TypeSymbol];

        if (parentType === IS_ASYNC_FUNCTION) {
          promise[TypeSymbol] = IS_FROM_ASYNC_FUNCTION_1;
          promise[ContextSymbol] = parent[ContextSymbol];
        } else if (parentType === IS_FROM_ASYNC_FUNCTION_1) {
          promise[TypeSymbol] = IS_FROM_ASYNC_FUNCTION_2;
          promise[ContextSymbol] = parent[ContextSymbol];
          this.onAwaitStart(promise, parent[ContextSymbol]);
        }
      },
      before: (_promise) => {
        const promise = _promise as PromiseWithSymbols;
        if (promise[TypeSymbol] !== IS_FROM_ASYNC_FUNCTION_2) {
          return;
        }
        this.trackingContext = promise[ContextSymbol];
        this.onAwaitEnd(promise, this.trackingContext);
      },
      after: () => {
        this.trackingContext = null;
      },
      settled: () => {
        this.trackingContext = null;
      },
    });

    this.registerPromiseConstructor();
  }

  destroy() {
    this.stopHookSet();
    global.Promise = AwaitDetector.OldPromiseConstructor;
    this.destroyed = true;
  }

  detect(fn: () => any, context: object = {}) {
    if (this.destroyed) {
      throw new Error('This instance of AwaitDetector was destroyed');
    }

    const oldContext = this.trackingContext;
    this.trackingContext = context;

    try {
      return fn();
    } finally {
      this.trackingContext = oldContext;
    }
  }

  ignore(fn: () => any) {
    const oldContext = this.trackingContext;
    this.trackingContext = null;
    try {
      return fn();
    } finally {
      this.trackingContext = oldContext;
    }
  }

  createWrappedPromiseConstructor(OrigPromise: typeof global.Promise) {
    const self = this;

    // @ts-ignore
    if (OrigPromise[AwaitDetector.Symbol]) {
      return OrigPromise;
    }

    const wrapped = class Promise<T> extends OrigPromise<T> {
      constructor(
        executor: (
          resolve: (value: T | PromiseLike<T>) => void,
          reject: (reason?: any) => void,
        ) => void,
      ) {
        self.nextPromiseFromConstructor = true;
        super(executor);
      }
    };

    // @ts-ignore
    wrapped[AwaitDetector.Symbol] = true;

    return wrapped;
  }

  registerPromiseConstructor() {
    global.Promise = this.createWrappedPromiseConstructor(global.Promise);
  }
}

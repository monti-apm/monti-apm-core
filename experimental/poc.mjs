import async_hooks from 'node:async_hooks';
import fs from 'node:fs';
import { stdout } from 'node:process';
import { executionAsyncId, triggerAsyncId } from 'async_hooks';

const start = Date.now();
const log = (...str) => fs.writeSync(stdout.fd, `${str.join(' ')} [at ${Date.now() - start}ms]\n`);

const ids = new Set();
const trigger = new Map()

async_hooks.createHook({
  init(asyncId, type, triggerAsyncId) {
    if (type !== 'PROMISE') {
      return;
    }

    ids.add(asyncId);
    trigger.set(asyncId, triggerAsyncId)

    const isAsyncFunction = triggerAsyncId === executionAsyncId();

    log(`${triggerAsyncId} >>> ${asyncId}: init`, isAsyncFunction);
    log('init executionAsyncId', executionAsyncId())
  },
  before(asyncId) {
    if (!ids.has(asyncId)) {
      return;
    }

    log(`(${asyncId}): before`);
  },
  destroy(asyncId) {
    if (!ids.has(asyncId)) {
      return;
    }

    log(`(${asyncId}): destroy`);
  },
  promiseResolve(asyncId) {
    if (!ids.has(asyncId)) {
      return;
    }

    log(`(${asyncId}): promiseResolve`);
    log('promiseResolve executionAsyncId', executionAsyncId())
  }
}).enable();

export const sleep = (ms) => {
  log('creating promise');
  let promise = new Promise((resolve) => setTimeout(() => {
    log('resolve timeout');
    resolve();
  }, ms))
  log('promise created')
  return promise;
};

async function runAsync(loop) {
  log(executionAsyncId(), triggerAsyncId())

  sleep(50)

  await sleep(100);
  //
  // log(executionAsyncId(), triggerAsyncId())
  //
  // await sleep(100);
  //
  // log(executionAsyncId(), triggerAsyncId())
  //
  // await sleep(100);
  //
  // log(executionAsyncId(), triggerAsyncId())
}

console.log('before run');
runAsync(true)
console.log('after run');

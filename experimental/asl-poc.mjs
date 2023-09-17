import async_hooks from 'node:async_hooks';
import fs from 'node:fs';
import { stdout } from 'node:process';
import { executionAsyncId, triggerAsyncId } from 'async_hooks';

const start = Date.now();

const tlog = (...args) => fs.writeSync(stdout.fd, `${args.join(' ')} [at ${Date.now() - start}ms]\n`);

let indent = 0;
let asyncFunctions = new Set();
let awaits = new Set();
let afterAwaits = new Map();
let ignoreNextPromise = 0;

async_hooks.createHook({
  init(asyncId, type, triggerAsyncId) {
    if (type !== 'PROMISE') {
      return;
    }
    if (ignoreNextPromise > 0) {
      ignoreNextPromise--;
      return;
    }
    const isAsyncFunction = triggerAsyncId === async_hooks.executionAsyncId();
    const indentStr = ' '.repeat(indent);
    if (isAsyncFunction) {
      asyncFunctions.add(asyncId);
      tlog(`${indentStr}${type}(${asyncId}): async function start`);
      return;
    }

    if (asyncFunctions.has(triggerAsyncId)) {
      awaits.add(asyncId);
      tlog(`${indentStr}${type}(${asyncId}): await start - async function: ${triggerAsyncId}`);
    } else if (awaits.has(triggerAsyncId)) {
      afterAwaits.set(asyncId, triggerAsyncId);
      // fs.writeSync(fd, `after await resolve, ${type}, ${asyncId}, ${triggerAsyncId}, ${async_hooks.executionAsyncId()}\n`);
    }
  },
  before(asyncId) {
    const indentStr = ' '.repeat(indent);
    if (afterAwaits.has(asyncId)) {
      // Awaited a thenable or non-promise value
      tlog(`${indentStr} await end:  ${afterAwaits.get(asyncId)} (A)`);
    } else if (awaits.has(asyncId)) {
      // Awaited a native promise
      tlog(`${indentStr} await end:  ${asyncId} (B)`);
    }
  },
  destroy(asyncId) {
    if (asyncFunctions.has(asyncId)) {
      asyncFunctions.delete(asyncId);
      const indentStr = ' '.repeat(indent);
      // fs.writeSync(fd, `${indentStr}async func destroy:  ${asyncId}\n`);
      return;
    }
    if (awaits.has(asyncId)) {
      awaits.delete(asyncId);
      const indentStr = ' '.repeat(indent);
      // fs.writeSync(fd, `${indentStr}await destroy:  ${asyncId}\n`);
    }
  },
  promiseResolve(asyncId) {
    const indentStr = ' '.repeat(indent);
    if (asyncFunctions.has(asyncId)) {
      asyncFunctions.delete(asyncId);
      // fs.writeSync(
      //   fd,
      //   `${indentStr}(${asyncId}):` +
      //   ` async func resolve\n`);
      return;
    } else if (awaits.has(asyncId)) {

    } else if (afterAwaits.has(asyncId)) {
      // fs.writeSync(fd, `${indentStr}resolve after await:  ${asyncId}\n`);
    }

  }
}).enable();

const oldPromise = Promise;
global.Promise = class A extends oldPromise {
  constructor(...args) {
    console.log('construct');
    ignoreNextPromise++;
    super(...args);
  }
}
// global.Promise = function Promise(...args) {
//   ignoreNextPromise++;
//   return new oldPromise(...args);
// };

// global.Promise.prototype = oldPromise.prototype;
// global.Promise.resolve = oldPromise.resolve;

// let oldThen = Promise.prototype.then;
// Promise.prototype.then = function () {
//   ignoreNextPromise++;
//   return Promise.resolve(this);
//   return oldThen.apply(this, arguments);
// }


export const sleep = (ms) => {
  tlog('creating promise');
  let promise = new Promise((resolve) => setTimeout(() => {
    tlog('resolve timeout');
    resolve();
  }, ms))
  tlog('after promise');
  return promise;
};

async function test() {
  console.log('in test - before await');
  await 0;
  console.log('in test - after await');
}

async function runAsync(loop) {
  // console.log('before resolve')
  // let promise = Promise.resolve(0);
  // console.log('before test')
  // let prom = test();
  // console.log('before await');
  // await prom;
  // console.log('after await');
  // await prom;
  // console.log("before test");
  // await test();
  tlog('before sleep');

  // sleep(50)

  tlog('1', executionAsyncId(), triggerAsyncId())

  await sleep(100);
  await sleep(110);
  await sleep(120);

  // console.log('2', executionAsyncId(), triggerAsyncId())
  //
  // await sleep(100)
  //
  // console.log('3', executionAsyncId(), triggerAsyncId())
  //
  // await sleep(100)
  //
  // console.log('4', executionAsyncId(), executionAsyncId())
  //
  // console.log('after sleep 1');

  // await sleep(200);
  //
  // console.log('after sleep 2');
  //
  // console.log('before return');
  //
  // return sleep(300);
}

// console.log('before run');
runAsync(true).then(() => {});
// console.log('after run');

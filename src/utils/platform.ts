import { AsyncLocalStorage } from 'async_hooks';

export const SupportsAsyncLocalStorage =
  typeof AsyncLocalStorage !== 'undefined';

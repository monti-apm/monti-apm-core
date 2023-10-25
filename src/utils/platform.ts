export const NodeMajorVersion = parseInt(
  process.version.match(/v(\d+)/)?.[1] as string,
  10,
);

/**
 * We get "AsyncLocalStorage is not a constructor" before Node 12.
 */
export const SupportsAsyncHooks = NodeMajorVersion >= 12;

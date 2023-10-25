export const NodeVersion = parseInt(
  process.version.match(/v(\d+)/)?.[1] as string,
  10,
);

export const SupportsAsyncHooks = NodeVersion >= 8;

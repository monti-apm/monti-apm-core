import WebSocket from 'faye-websocket';
import { CoreEvent } from '../constants';

const maxAttempts = 4;

export function getWsUrl(url) {
  return url.replace('https://', 'wss://')
    .replace('http://', 'ws://');
}

export function connectWebSocket(url, headers) {
  return new Promise((resolve, reject) => {
    const errorHandler = (event) => {
      reject(event);
    };

    const ws = new WebSocket.Client(getWsUrl(url), {
      headers
    });

    ws.on('close', errorHandler);
    ws.on('error', errorHandler);

    ws.on('open', () => {
      resolve(ws);

      // Need to remove the handlers, otherwise they will
      // be called again in normal operation
      ws.off('close', errorHandler);
      ws.off('error', errorHandler);
    });
  });
}

export async function connectWithRetry(
  url,
  headers,
  emitter,
  attempts = maxAttempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      if (emitter) {
        emitter.emit(CoreEvent.WEBSOCKET_ATTEMPT);
      }

      // Connection successful; exit the loop and return the WebSocket instance
      return await connectWebSocket(url);
    } catch (error) {
      // eslint-disable-next-line no-console,max-len
      console.error(`Monti APM WebSocket: Attempt ${i + 1} of ${attempts} failed`);
      if (i === attempts) {
        throw error;
      }
    }
    // Wait for a while before retrying (e.g., 1000ms)
    await new Promise((resolve) =>
      setTimeout(resolve, connectWithRetry._timeout));
  }
}

connectWithRetry._timeout = 5000;

import WebSocket from 'faye-websocket';
import { CoreEvent } from '../constants';

const maxRetries = 3;

export function getWsUrl(url) {
  return url.replace('https://', 'wss://')
    .replace('http://', 'ws://');
}

export function connectWebSocket(url, headers) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket.Client(getWsUrl(url), {
      headers
    });

    ws.on('open', () => {
      resolve(ws);
    });

    ws.on('error', (event) => {
      reject(event);
    });
  });
}

export async function connectWithRetry(
  url,
  headers,
  emitter,
  retries = maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      if (emitter && i > 0) {
        emitter.emit(CoreEvent.WEBSOCKET_RETRY);
      }

      // Connection successful; exit the loop and return the WebSocket instance
      return await connectWebSocket(url);
    } catch (error) {
      // eslint-disable-next-line no-console,max-len
      console.error(`Monti APM WebSocket: Retry attempt ${i + 1} of ${retries} failed`);
      if (i === retries - 1) {
        throw error;
      }
    }
    // Wait for a while before retrying (e.g., 1000ms)
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

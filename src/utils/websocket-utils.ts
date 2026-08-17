import WebSocket from 'ws';
import debug from 'debug';
import { WebSocketEvent } from '../constants';
import { sleep } from './index';
import EventEmitter2 from 'eventemitter2';

const logger = debug('monti-apm-core:transport');

export const WebSocketEvents = new EventEmitter2();

export function getWsUrl(url: string) {
  return url.replace('https://', 'wss://').replace('http://', 'ws://');
}

export function connectWebSocket(
  url: string,
  headers: Record<string, string>,
  onMessage: (data: string) => void = () => ({}),
  agent?: any,
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const errorHandler = (error: Error) => {
      reject(error);
    };
    const closeHandler = (code: number, reason: Buffer) => {
      const error = new Error(
        reason.length > 0
          ? reason.toString()
          : `WebSocket closed before connecting (${code})`,
      );

      Object.assign(error, { code });

      reject(error);
    };

    WebSocketEvents.emit(WebSocketEvent.WEBSOCKET_ATTEMPT);

    const ws = new WebSocket(getWsUrl(url).concat('/websocket'), {
      headers,
      agent,
      perMessageDeflate: false,
    });

    ws.once(WebSocketEvent.CLOSE, closeHandler);
    ws.once(WebSocketEvent.ERROR, errorHandler);

    ws.on(WebSocketEvent.OPEN, () => {
      ws.off(WebSocketEvent.CLOSE, closeHandler);
      ws.off(WebSocketEvent.ERROR, errorHandler);

      // Errors after a connection is established are followed by a close event,
      // which triggers reconnection. Keep a listener so EventEmitter does not
      // treat the error as uncaught.
      ws.on(WebSocketEvent.ERROR, (error) => {
        logger('WebSocket error after connecting: %O', error);
      });

      ws.on(WebSocketEvent.MESSAGE, (message) => {
        const data = message.toString();

        if (!data) {
          return;
        }

        if (data === 'ping') {
          ws.emit(WebSocketEvent.PING);
          ws.send('pong');
          return;
        }

        onMessage(data);
      });

      ws.on(WebSocketEvent.CLOSE, () =>
        WebSocketEvents.emit(WebSocketEvent.WEBSOCKET_CLOSED),
      );

      resolve(ws);
    });
  });
}

export const once = async (ws: WebSocket, event: string) =>
  new Promise<void>((resolve) => {
    ws.once(event, () => resolve());
  });

export const MAX_DELAY = 60000;

export function persistentConnectWebSocket(
  endpoint: string,
  headers: Record<string, string>,
  onMessage: (data: string) => void = () => undefined,
  agent?: any,
  timeFunction = (i: number) =>
    Math.min(64 * Math.pow(i, 2), MAX_DELAY) * (0.9 + 0.2 * Math.random()),
) {
  let stopped: boolean;
  let ws: WebSocket | null = null;

  async function connect() {
    stopped = false;

    let attempts = 0;

    while (!stopped) {
      try {
        ws = await connectWebSocket(endpoint, headers, onMessage, agent);

        attempts = 0;

        if (stopped) {
          ws.close();
          break;
        }

        WebSocketEvents.emit(WebSocketEvent.WEBSOCKET_CONNECTED, ws);

        await once(ws, 'close');

        ws = null;
      } catch (error: any) {
        // Ignore errors from us closing the client
        if (error.code !== 1006) {
          // Avoid showing too many errors in the logs. Show the 10th error
          // and every 100th error
          if (attempts === 10 || (attempts > 0 && attempts % 100 === 0)) {
            // eslint-disable-next-line no-console
            console.error(
              `Monti APM: Failed connecting websocket: ${error.message}`,
            );
          }
        }

        attempts++;
      }

      await sleep(timeFunction(attempts));
    }
  }

  connect();

  return {
    disconnect() {
      stopped = true;

      if (ws) {
        ws.close();
      }
    },
  };
}

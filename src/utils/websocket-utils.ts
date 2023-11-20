import WebSocket from 'faye-websocket';
import { WebSocketEvent } from '../constants';
import { sleep } from './index';
import EventEmitter2 from 'eventemitter2';

export const WebSocketEvents = new EventEmitter2();

export function getWsUrl(url: string) {
  return url.replace('https://', 'wss://').replace('http://', 'ws://');
}

export function connectWebSocket(
  url: string,
  headers: Record<string, string>,
  onMessage: (data: string) => void = () => ({}),
): Promise<WebSocket.Client> {
  return new Promise((resolve, reject) => {
    const errorHandler = (event: any) => {
      reject(event);
    };

    WebSocketEvents.emit(WebSocketEvent.WEBSOCKET_ATTEMPT);

    const ws = new WebSocket.Client(getWsUrl(url).concat('/websocket'), null, {
      headers,
    });

    ws.pong = () => {
      ws.send('pong');
    };

    ws.on(WebSocketEvent.CLOSE, errorHandler);
    ws.on(WebSocketEvent.ERROR, errorHandler);

    ws.on(WebSocketEvent.OPEN, () => {
      ws.removeEventListener(WebSocketEvent.CLOSE, errorHandler);
      ws.removeEventListener(WebSocketEvent.ERROR, errorHandler);

      WebSocketEvents.emit(WebSocketEvent.WEBSOCKET_CONNECTED, ws);

      ws.on(WebSocketEvent.MESSAGE, (event) => {
        const data = event.data.toString();

        if (!data) {
          return;
        }

        if (data === 'ping') {
          ws.emit(WebSocketEvent.PING);
          ws.pong();
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

export const once = async (ws: WebSocket.Client, event: string) =>
  new Promise((resolve) => {
    ws.once(event, resolve);
  });

export const MAX_DELAY = 60000;

export function persistentConnectWebSocket(
  endpoint: string,
  headers: Record<string, string>,
  onMessage: (data: string) => void = () => undefined,
  timeFunction = (i: number) =>
    Math.min(64 * Math.pow(i, 2), MAX_DELAY) * (0.9 + 0.2 * Math.random()),
) {
  let stopped: boolean;
  let ws: WebSocket.Client | null = null;

  async function connect() {
    stopped = false;

    let attempts = 0;

    while (!stopped) {
      try {
        ws = await connectWebSocket(endpoint, headers, onMessage);

        attempts = 0;

        if (stopped) {
          ws.close();
          break;
        }

        await once(ws, 'close');

        ws = null;
      } catch (error: any) {
        // If not closed locally by the client, we log the error
        if (attempts > 10 && error.code !== 1006) {
          console.error(
            `Monti APM WebSocket: Attempt ${attempts + 1} failed (${
              error.message
            })`,
          );
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

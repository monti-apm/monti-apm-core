import WebSocket from 'faye-websocket';
import { CoreEvent, WebSocketEvent } from '../constants';
import { sleep } from '../utils';
import EventEmitter2 from 'eventemitter2';

export const WebSocketEvents = new EventEmitter2();

export function getWsUrl(url) {
  return url.replace('https://', 'wss://')
    .replace('http://', 'ws://');
}

export function connectWebSocket(url, headers, onMessage) {
  return new Promise((resolve, reject) => {
    const errorHandler = (event) => {
      reject(event);
    };

    WebSocketEvents.emit(CoreEvent.WEBSOCKET_ATTEMPT);

    /**
     * @type {WebSocket} Not the same but the signature is similar to this type.
     */
    const ws = new WebSocket.Client(getWsUrl(url).concat('/websocket'), null, {
      headers
    });

    ws.pong = () => {
      ws.send('pong');
    };

    ws.addEventListener(WebSocketEvent.MESSAGE, event => {
      if (event.data.toString() === 'ping') {
        ws.emit(WebSocketEvent.PING);
        ws.pong();
      }
    });

    ws.on(WebSocketEvent.CLOSE, errorHandler);
    ws.on(WebSocketEvent.ERROR, errorHandler);

    ws.on(WebSocketEvent.OPEN, () => {
      // Need to remove the handlers, otherwise they will
      // be called again in normal operation
      ws.off(WebSocketEvent.CLOSE, errorHandler);
      ws.off(WebSocketEvent.ERROR, errorHandler);

      WebSocketEvents.emit(CoreEvent.WEBSOCKET_CONNECTED, ws);

      ws.on(WebSocketEvent.MESSAGE, onMessage);

      ws.on(WebSocketEvent.CLOSE, () =>
        WebSocketEvents.emit(CoreEvent.WEBSOCKET_CLOSED)
      );

      resolve(ws);
    });
  });
}

export const once = async (ws, event) => new Promise((resolve) => {
  ws.once(event, resolve);
});

export const MAX_DELAY = 60000;

export function persistentConnectWebSocket(
  endpoint,
  headers,
  onMessage,
  timeFunction = (i) =>
    Math.min(64 * Math.pow(i, 2), MAX_DELAY) *
      (0.9 + (0.2 * Math.random()))
) {
  let stopped;
  let ws;

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

      } catch (error) {
        console.error(`Monti APM WebSocket: Attempt ${attempts + 1} failed`);

        if (error.code !== 1006) {
          console.error(error);
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
    }
  };
}


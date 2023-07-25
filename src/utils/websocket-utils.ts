import WebSocket from 'faye-websocket'
import { BackoffEvent, CoreEvent, WebSocketEvent } from '@/constants'
import * as backoff from 'backoff'
import { sleep } from '@/utils'

const maxAttempts = 4

export function getWsUrl(url) {
  return url.replace('https://', 'wss://').replace('http://', 'ws://')
}

export function connectWebSocket(url, headers): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const errorHandler = event => {
      reject(event)
    }

    /**
     * Not the same but the signature is similar to this type.
     */
    const ws = new WebSocket.Client(getWsUrl(url).concat('/websocket'), null, {
      headers,
    })

    ws.pong = () => {
      ws.send('pong')
    }

    ws.addEventListener(WebSocketEvent.MESSAGE, event => {
      if (event.data.toString() === 'ping') {
        ws.emit(WebSocketEvent.PING)
        ws.pong()
      }
    })

    ws.addEventListener(WebSocketEvent.CLOSE, errorHandler)
    ws.addEventListener(WebSocketEvent.ERROR, errorHandler)

    ws.addEventListener(WebSocketEvent.OPEN, () => {
      // Need to remove the handlers, otherwise they will
      // be called again in normal operation
      ws.removeEventListener(WebSocketEvent.CLOSE, errorHandler)
      ws.removeEventListener(WebSocketEvent.ERROR, errorHandler)

      resolve(ws)
    })
  })
}

export async function connectWithRetry(core, attempts = maxAttempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      if (core) {
        core.emit(CoreEvent.WEBSOCKET_ATTEMPT)
      }

      // Connection successful; exit the loop and return the WebSocket instance
      const ws = await connectWebSocket(
        core._options.endpoint,
        core._websocketHeaders,
      )

      core._ws = ws

      ws.on(WebSocketEvent.MESSAGE, message => core._handleMessage(message))

      // Emit an event, so we can handle reconnection elsewhere
      ws.on(WebSocketEvent.CLOSE, () => core.emit(CoreEvent.WEBSOCKET_CLOSED))

      setTimeout(() => {
        core.emit(CoreEvent.WEBSOCKET_CONNECTED)
      }, 0)

      return ws
    } catch (error) {
      if (error.code !== 1006) {
        console.error(error)
      }
      // eslint-disable-next-line no-console,max-len
      console.error(
        `Monti APM WebSocket: Attempt ${i + 1} of ${attempts} failed`,
      )
      if (i + 1 === attempts) {
        throw error
      }
    }
    // Wait for a while before retrying (e.g., 1000ms)
    await new Promise(resolve => setTimeout(resolve, connectWithRetry._timeout))
  }
}

connectWithRetry._timeout = 5000

export async function connectWithBackoff(core) {
  let ws = null

  const _backoff = backoff.exponential({
    randomisationFactor: 1,
    initialDelay: 64,
    maxDelay: connectWithBackoff._maxDelay,
  })

  const onDisconnect = () => {
    if (ws) {
      ws.removeAllListeners()
      ws.close()
      ws = null
    }

    _backoff.reset()

    core.off(CoreEvent.DISCONNECT, onDisconnect)
  }

  core.on(CoreEvent.DISCONNECT, onDisconnect)

  const connect = async () => {
    try {
      ws = await connectWithRetry(core)

      await core.waitFor(CoreEvent.WEBSOCKET_CONNECTED)

      _backoff.reset()

      ws.on(WebSocketEvent.CLOSE, event => {
        _backoff.backoff(event)
      })
    } catch (error) {
      _backoff.backoff(error)
    }
  }

  _backoff.failAfter(connectWithBackoff._failAfter)

  _backoff.on(BackoffEvent.READY, async (number, delay) => {
    core.emit(CoreEvent.WEBSOCKET_BACKOFF_READY, number, delay)
  })

  _backoff.on(BackoffEvent.BACKOFF, async (number, delay, error) => {
    if (connectWithBackoff._disableBackoff) {
      return
    }
    // eslint-disable-next-line no-console,max-len
    console.log(
      `Monti APM WebSocket: Reconnection attempt #${
        number + 1
      } with a delay of ${delay}ms`,
    )
    core.emit(CoreEvent.WEBSOCKET_BACKOFF, number, delay, error)
    await sleep(delay)
    await connect()
  })

  _backoff.on(BackoffEvent.FAIL, () => {
    // eslint-disable-next-line no-console,max-len
    console.error(
      'Monti APM WebSocket: Reconnection Failed (Exhausted Backoff)',
    )
    core.emit(CoreEvent.WEBSOCKET_BACKOFF_FAIL)
  })

  await connect()
}

connectWithBackoff._failAfter = 10
connectWithBackoff._maxDelay = 60000
connectWithBackoff._disableBackoff = false

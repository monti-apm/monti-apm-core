import { EventEmitter } from 'events'

declare module 'faye-websocket' {
  export interface MessageEvent {
    data: any
  }

  export interface CloseEvent {
    code: number
    reason: string
    wasClean: boolean
  }

  export class Client extends EventEmitter {
    constructor(
      url: string,
      protocols?: Array<string> | null,
      options?: Record<string, unknown>,
    )

    send(data: string): void

    close(code?: number, reason?: string): void

    pong(): void
  }
}

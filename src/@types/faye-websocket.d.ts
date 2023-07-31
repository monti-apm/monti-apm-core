declare module 'faye-websocket' {
  export interface MessageEvent {
    data: any;
  }

  export interface CloseEvent {
    code: number;
    reason: string;
    wasClean: boolean;
  }

  export class Client {
    constructor(
      url: string,
      protocols?: Array<string> | null,
      options?: Record<string, unknown>,
    );

    send(data: string): void;

    close(code?: number, reason?: string): void;

    pong(): void;

    on(event: string, listener: (event: MessageEvent) => void): void;

    addEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void;

    removeEventListener(
      type: string,
      listener: (event: MessageEvent) => voi,
    ): void;

    emit(type: string): void;

    removeAllListeners(type?: string): void;
  }
}

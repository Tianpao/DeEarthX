type EventHandler = (...args: unknown[]) => void;

class StubSocket {
  connected = false;
  id = 'stub-socket';

  connect(): void {
    console.warn('Socket.io is not available in Wails v3. Use Wails Events instead.');
  }
  disconnect(): void {}
  on(_event: string, _handler: EventHandler): this { return this; }
  once(_event: string, _handler: EventHandler): this { return this; }
  off(_event: string): this { return this; }
  emit(_event: string, ..._args: unknown[]): this { return this; }
}

export function io(_url?: string, _opts?: Record<string, unknown>): StubSocket {
  return new StubSocket();
}

export type Socket = StubSocket;

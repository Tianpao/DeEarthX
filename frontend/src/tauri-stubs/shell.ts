export class Command {
  static create(_name: string) {
    return new Command();
  }
  spawn(): Promise<void> {
    console.warn('Tauri Command.spawn is not available in Wails v3');
    return Promise.resolve();
  }
  on(_event: string, _callback: (...args: unknown[]) => void): void {}
}

export async function open(_url: string): Promise<void> {
  console.warn('Tauri shell.open is not available in Wails v3');
}

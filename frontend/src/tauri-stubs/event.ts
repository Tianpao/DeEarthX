export type UnlistenFn = () => void;

export async function listen<T>(_event: string, _handler: (event: T) => void): Promise<UnlistenFn> {
  console.warn('Tauri event.listen is not available in Wails v3');
  return () => {};
}

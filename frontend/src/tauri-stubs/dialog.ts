export async function open(_options?: unknown): Promise<string | string[] | null> {
  console.warn('Tauri dialog.open is not available in Wails v3');
  return null;
}

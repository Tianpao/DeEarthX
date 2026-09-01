/** Unwrap Wails v3 Events.On payload (`ev.data`). */
export function eventData<T = any>(ev: any): T {
  if (ev == null) {
    return {} as T;
  }
  if (typeof ev === "object" && "data" in ev) {
    return (ev.data ?? {}) as T;
  }
  return ev as T;
}

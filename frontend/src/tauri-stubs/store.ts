export class Store {
  constructor(_name: string) {}
  async get<T>(_key: string): Promise<T | null> { return null; }
  async set(_key: string, _value: unknown): Promise<void> {}
  async save(): Promise<void> {}
}

declare module '@meteorrn/core' {
  type Selector = string | Record<string, unknown>
  type FindOptions = {
    sort?: Record<string, 1 | -1>
    limit?: number
    skip?: number
    fields?: Record<string, 0 | 1>
  }

  interface Cursor<T> {
    fetch(): T[]
    count(): number
    forEach(cb: (doc: T, index: number, cursor: Cursor<T>) => void): void
    map<U>(cb: (doc: T, index: number, cursor: Cursor<T>) => U): U[]
  }

  class MongoCollection<T> {
    constructor(name: string | null, options?: { transform?: (doc: T) => T })
    find(selector?: Selector, options?: FindOptions): Cursor<T>
    findOne(selector?: Selector, options?: FindOptions): T | undefined
    insert(
      item: Partial<T>,
      callback?: (err?: unknown, id?: string) => void,
    ): string
    update(
      id: string,
      modifier: Record<string, unknown>,
      options?: Record<string, unknown>,
      callback?: (err?: unknown, id?: string) => void,
    ): void
    remove(id: string, callback?: (err?: unknown, res?: unknown) => void): void
  }

  export const Mongo: {
    Collection: typeof MongoCollection
  }
}

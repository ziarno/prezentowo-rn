import { getRandomBytesAsync } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import {
  type SQLiteDatabase,
  deleteDatabaseAsync,
  openDatabaseAsync,
} from 'expo-sqlite'

import type { CacheRow, CacheStore } from './cache'

// The offline cache on disk: SQLite built with SQLCipher (the `expo-sqlite`
// plugin's `useSQLCipher` in app.json), keyed before the first statement so
// nothing is ever written in the clear — `PRAGMA rekey` can't retrofit
// encryption (ADR 0004). The key is random and lives in SecureStore.
// Kept out of `index.ts` so the Node tests never load the native modules.

const DB_NAME = 'offline-cache.db'
const KEY_NAME = 'prezentowo.cacheKey'

async function databaseKey(): Promise<string> {
  const stored = await SecureStore.getItemAsync(KEY_NAME)
  if (stored) return stored
  const bytes = await getRandomBytesAsync(32)
  const key = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  await SecureStore.setItemAsync(KEY_NAME, key)
  return key
}

async function openKeyed(key: string): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DB_NAME)
  // A raw 256-bit key, so SQLCipher skips its passphrase derivation.
  await db.execAsync(`PRAGMA key = "x'${key}'";`)
  // Fails here, not later, when the key doesn't open the file.
  await db.getFirstAsync('SELECT count(*) FROM sqlite_master')
  const cipher = await db.getFirstAsync('PRAGMA cipher_version')
  if (!cipher) {
    await db.closeAsync()
    throw new Error('expo-sqlite is not built with SQLCipher; rebuild the app')
  }
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS snapshots (
      key TEXT PRIMARY KEY NOT NULL,
      eventId TEXT,
      data TEXT NOT NULL
    );`,
  )
  return db
}

async function open(): Promise<SQLiteDatabase> {
  const key = await databaseKey()
  try {
    return await openKeyed(key)
  } catch (error) {
    // A file this key can't open (its key was lost, say) is unreadable for
    // good: start over. Anything else is left alone.
    if (!/not a database/i.test(String(error))) throw error
    await deleteDatabaseAsync(DB_NAME).catch(() => {})
    return openKeyed(key)
  }
}

export function encryptedCacheStore(): CacheStore {
  let db: Promise<SQLiteDatabase> | null = null
  const database = () => (db ??= open())

  return {
    load: async () =>
      (await database()).getAllAsync<CacheRow>(
        'SELECT key, eventId, data FROM snapshots',
      ),
    put: async ({ key, eventId, data }) => {
      await (
        await database()
      ).runAsync(
        'INSERT OR REPLACE INTO snapshots (key, eventId, data) VALUES (?, ?, ?)',
        key,
        eventId,
        data,
      )
    },
    remove: async keys => {
      const conn = await database()
      for (const key of keys) {
        await conn.runAsync('DELETE FROM snapshots WHERE key = ?', key)
      }
    },
    clear: async () => {
      await (await database()).runAsync('DELETE FROM snapshots')
    },
  }
}

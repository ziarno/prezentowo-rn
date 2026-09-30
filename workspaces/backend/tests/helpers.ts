import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'
import { MongoInternals } from 'meteor/mongo'

type MethodHandler = (
  this: Meteor.MethodThisType,
  ...args: unknown[]
) => unknown

// Meteor keeps registered methods here; @types/meteor doesn't declare it.
const methodHandlers = () =>
  (
    Meteor as unknown as {
      server: { method_handlers: Record<string, MethodHandler> }
    }
  ).server.method_handlers

/**
 * Empties every collection in the app database. Refuses to run outside
 * `meteor test`, so it can never wipe a dev or production database.
 */
export async function resetDatabase() {
  if (!Meteor.isTest && !Meteor.isAppTest) {
    throw new Error('resetDatabase() only runs under `meteor test`')
  }
  const { db } = MongoInternals.defaultRemoteCollectionDriver().mongo
  const collections = await db.collections()
  await Promise.all(
    collections
      .filter(c => !c.collectionName.startsWith('system.'))
      .map(c => c.deleteMany({})),
  )
}

/**
 * Runs a registered Meteor method as `userId` (or signed out, with `null`),
 * the way it runs for a DDP client, without a connection.
 */
export async function callAsUser<T = unknown>(
  userId: string | null,
  name: string,
  ...args: unknown[]
): Promise<T> {
  const handler = methodHandlers()[name]
  if (!handler) throw new Error(`No method registered as "${name}"`)

  const invocation = {
    userId,
    isSimulation: false,
    connection: null,
    unblock: () => {},
    setUserId: () => {
      throw new Error('callAsUser() has no connection to log in on')
    },
  } as unknown as Meteor.MethodThisType

  return (await handler.apply(invocation, args)) as T
}

type PublishHandler = (
  this: Subscription,
  ...args: unknown[]
) => unknown | Promise<unknown>

// Meteor keeps registered publications here; @types/meteor doesn't declare it.
const publishHandlers = () =>
  (
    Meteor as unknown as {
      server: { publish_handlers: Record<string, PublishHandler> }
    }
  ).server.publish_handlers

type Fields = Record<string, unknown>

type Subscription = {
  userId: string | null
  connection: null
  added: (collection: string, id: string, fields: Fields) => void
  changed: (collection: string, id: string, fields: Fields) => void
  removed: (collection: string, id: string) => void
  ready: () => void
  onStop: (fn: () => void) => void
  error: (error: Error) => void
  stop: () => void
}

// What a publication returns to publish one cursor. The bundled type defs
// lag behind on the async observer and the internal description.
type PublishedCursor = {
  _cursorDescription: { collectionName: string }
  observeChangesAsync: (callbacks: {
    added: (id: string, fields: Fields) => void
    changed: (id: string, fields: Fields) => void
    removed: (id: string) => void
  }) => Promise<{ stop: () => void }>
}

const isCursor = (value: unknown): value is PublishedCursor =>
  typeof (value as PublishedCursor | null)?.observeChangesAsync === 'function'

export type SubscriptionMessage =
  | { msg: 'added'; collection: string; id: string; fields: Fields }
  | { msg: 'changed'; collection: string; id: string; fields: Fields }
  | { msg: 'removed'; collection: string; id: string }

/**
 * Runs a registered publication as `userId` (or signed out, with `null`) and
 * records what it would send to a DDP client. `docs(collection)` is the
 * client-side view (merged fields per id); `messages` is every `added` /
 * `changed` / `removed` in order. Resolves once the publication is ready.
 * A publication that returns a cursor has it published as Meteor would.
 * Call `stop()` when done so its observers are torn down.
 */
export async function subscribeAsUser(
  userId: string | null,
  name: string,
  ...args: unknown[]
) {
  const handler = publishHandlers()[name]
  if (!handler) throw new Error(`No publication registered as "${name}"`)

  const messages: SubscriptionMessage[] = []
  const store = new Map<string, Map<string, Fields>>()
  const stopCallbacks: (() => void)[] = []
  const collectionStore = (collection: string) => {
    let docs = store.get(collection)
    if (!docs) store.set(collection, (docs = new Map()))
    return docs
  }

  let markReady!: () => void
  const ready = new Promise<void>(resolve => (markReady = resolve))

  const sub: Subscription = {
    userId,
    connection: null,
    added: (collection, id, fields) => {
      messages.push({ msg: 'added', collection, id, fields })
      collectionStore(collection).set(id, { ...fields })
    },
    changed: (collection, id, fields) => {
      messages.push({ msg: 'changed', collection, id, fields })
      const doc = collectionStore(collection).get(id)
      if (!doc) throw new Error(`changed() for unknown ${collection}/${id}`)
      for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) delete doc[key]
        else doc[key] = value
      }
    },
    removed: (collection, id) => {
      messages.push({ msg: 'removed', collection, id })
      collectionStore(collection).delete(id)
    },
    ready: () => markReady(),
    onStop: fn => void stopCallbacks.push(fn),
    error: error => {
      throw error
    },
    stop: () => stopCallbacks.forEach(fn => fn()),
  }

  const result = await handler.apply(sub, args)
  if (isCursor(result)) {
    // Publish the returned cursor the way Meteor does for a DDP client.
    const collection = result._cursorDescription.collectionName
    const handle = await result.observeChangesAsync({
      added: (id, fields) => sub.added(collection, id, fields),
      changed: (id, fields) => sub.changed(collection, id, fields),
      removed: id => sub.removed(collection, id),
    })
    sub.onStop(() => handle.stop())
    sub.ready()
  } else if (result !== undefined) {
    throw new Error(
      'subscribeAsUser() supports publications that call ready() or return one cursor',
    )
  }
  await ready

  return {
    messages,
    docs: (collection: string) => collectionStore(collection),
    stop: () => sub.stop(),
  }
}

/**
 * Polls `predicate` until it returns true, for waiting on live publication
 * updates that arrive asynchronously after a write.
 */
export async function waitFor(predicate: () => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('waitFor() timed out')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

/**
 * Issues a resume login token for `userId`, the one a DDP client holds after
 * logging in and sends as `Authorization: Bearer <token>` over HTTP.
 */
export async function createLoginToken(userId: string) {
  const stamped = Accounts._generateStampedLoginToken()
  // accounts-base has it; @types/meteor doesn't declare it.
  await (
    Accounts as unknown as {
      _insertLoginToken: (
        userId: string,
        token: typeof stamped,
      ) => Promise<void>
    }
  )._insertLoginToken(userId, stamped)
  return stamped.token
}

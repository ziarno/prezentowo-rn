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

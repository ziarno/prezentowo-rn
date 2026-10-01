import { Meteor } from 'meteor/meteor'
import { isAbsolute, resolve } from 'path'

/**
 * The directory `key` names in settings.json. A relative path is resolved
 * against the app directory `meteor` runs in. Throws when it isn't set.
 */
export function settingsDir(key: string): string {
  const dir: unknown = Meteor.settings[key]
  if (typeof dir !== 'string' || !dir) {
    throw new Error(`Meteor.settings.${key} is not set`)
  }
  // `meteor run` starts the server inside .meteor/local/build, but keeps the
  // PWD of the shell it was started from.
  return isAbsolute(dir) ? dir : resolve(process.env.PWD ?? process.cwd(), dir)
}

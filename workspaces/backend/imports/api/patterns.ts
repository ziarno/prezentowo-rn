import { Match } from 'meteor/check'

// A string with something in it, e.g. an upload id or a stock avatar key.
export const nonEmptyString = Match.Where(
  (value: unknown) => typeof value === 'string' && value !== '',
)

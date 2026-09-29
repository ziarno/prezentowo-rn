// The part of accounts-express 1.0.0 we use. tsconfig.json maps
// meteor/accounts-express here: the generic meteor/* mapping would fall
// through to zodern:types' generated packages.d.ts, whose declarations clash
// with @types/meteor.
import type { RequestHandler } from 'express'

/**
 * Express middleware that authenticates a request by its Meteor login token,
 * sent as `Authorization: Bearer <token>` or the `meteor_login_token` cookie,
 * and sets `req.userId`. With `required: true` it responds 401 instead of
 * calling the next handler when the token is missing, unknown or expired.
 */
export function createAuthMiddleware(options?: {
  required?: boolean
}): RequestHandler

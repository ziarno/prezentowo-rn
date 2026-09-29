import type * as express from 'express'

// @types/meteor still types meteor/webapp as the Connect-era API. Meteor 3's
// WebApp.handlers is an Express 5 app (webapp 2.3.0 ships express 5.1.0).
declare module 'meteor/webapp' {
  namespace WebApp {
    var handlers: express.Express
  }
}

declare global {
  namespace Express {
    interface Request {
      // Set by accounts-express's createAuthMiddleware: the signed-in user, or
      // null when auth is optional and the request carries no valid token.
      userId?: string | null
    }
  }
}

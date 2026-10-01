import type { Request, Response } from 'express'
import { Meteor } from 'meteor/meteor'
import { WebApp } from 'meteor/webapp'

import { ANDROID_PACKAGE, IOS_BUNDLE_ID } from './landing.stores'

// settings.json `appLinks`: the Apple team that signs the app, and the
// SHA-256 fingerprints of every key an installed Android build can be signed
// with (the debug key for dev builds, Play App Signing's key in production).
type AppLinksSettings = {
  appleTeamId?: unknown
  androidCertFingerprints?: unknown
}

const appLinksSettings = (): AppLinksSettings =>
  (Meteor.settings.appLinks as AppLinksSettings | undefined) ?? {}

// The OS fetches these files itself, caches them, and follows no redirect.
function sendJson(res: Response, body: unknown) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  })
  res.end(JSON.stringify(body))
}

/**
 * Universal Links for `https://prezentowo.pl/e/<code>` (docs/spec.md §3.4).
 * The card image under the same prefix stays a plain file.
 */
function appleAppSiteAssociation(_req: Request, res: Response) {
  const { appleTeamId } = appLinksSettings()
  if (typeof appleTeamId !== 'string' || !appleTeamId) {
    res.status(404).end()
    return
  }
  sendJson(res, {
    applinks: {
      details: [
        {
          appIDs: [`${appleTeamId}.${IOS_BUNDLE_ID}`],
          components: [
            { '/': '/e/*/og.png', exclude: true },
            { '/': '/e/*' },
          ],
        },
      ],
    },
  })
}

/** App Links for the same paths; the intent filter in app.json scopes them. */
function assetLinks(_req: Request, res: Response) {
  const { androidCertFingerprints } = appLinksSettings()
  const fingerprints = Array.isArray(androidCertFingerprints)
    ? androidCertFingerprints.filter(f => typeof f === 'string' && f)
    : []
  if (fingerprints.length === 0) {
    res.status(404).end()
    return
  }
  sendJson(res, [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ])
}

WebApp.handlers.get(
  '/.well-known/apple-app-site-association',
  appleAppSiteAssociation,
)
WebApp.handlers.get('/.well-known/assetlinks.json', assetLinks)

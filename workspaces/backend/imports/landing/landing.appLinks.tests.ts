import assert from 'assert'
import { Meteor } from 'meteor/meteor'

import './landing.appLinks'

const TEAM_ID = 'ABCDE12345'
const FINGERPRINTS = [
  'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C',
  '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF',
]

// The OS fetches these without following redirects, so a 3xx counts as a
// failure too.
const get = (path: string) =>
  fetch(Meteor.absoluteUrl(path.replace(/^\//, '')), { redirect: 'manual' })

type Aasa = {
  applinks: {
    details: {
      appIDs: string[]
      components: { '/': string; exclude?: boolean }[]
    }[]
  }
}

type AssetLinks = {
  relation: string[]
  target: {
    namespace: string
    package_name: string
    sha256_cert_fingerprints: string[]
  }
}[]

// Whether iOS opens `path` in the app: the first component that matches it
// decides, and a path no component matches stays in the browser.
function opensInApp(aasa: Aasa, path: string) {
  const toRegExp = (pattern: string) =>
    new RegExp(
      `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
    )
  const match = aasa.applinks.details[0].components.find(c =>
    toRegExp(c['/']).test(path),
  )
  return !!match && !match.exclude
}

describe('Universal Links and App Links', function () {
  let saved: unknown

  before(function () {
    saved = Meteor.settings.appLinks
  })

  after(function () {
    Meteor.settings.appLinks = saved
  })

  beforeEach(function () {
    Meteor.settings.appLinks = {
      appleTeamId: TEAM_ID,
      androidCertFingerprints: FINGERPRINTS,
    }
  })

  describe('GET /.well-known/apple-app-site-association', function () {
    it('is served as JSON, without a redirect', async function () {
      const res = await get('/.well-known/apple-app-site-association')

      assert.strictEqual(res.status, 200)
      assert.match(res.headers.get('content-type') ?? '', /^application\/json/)
      await res.json()
    })

    it('names the app by team id and bundle id', async function () {
      const aasa = (await (
        await get('/.well-known/apple-app-site-association')
      ).json()) as Aasa

      assert.deepStrictEqual(aasa.applinks.details[0].appIDs, [
        `${TEAM_ID}.com.prezentowo.app`,
      ])
    })

    it('opens invite links in the app, and nothing else', async function () {
      const aasa = (await (
        await get('/.well-known/apple-app-site-association')
      ).json()) as Aasa

      assert.ok(opensInApp(aasa, '/e/Ab3x'))
      assert.ok(!opensInApp(aasa, '/e/Ab3x/og.png'))
      assert.ok(!opensInApp(aasa, '/og.png'))
      assert.ok(!opensInApp(aasa, '/'))
      assert.ok(!opensInApp(aasa, '/images/abc'))
    })

    it('is a 404 until the team id is configured', async function () {
      Meteor.settings.appLinks = { androidCertFingerprints: FINGERPRINTS }

      const res = await get('/.well-known/apple-app-site-association')

      assert.strictEqual(res.status, 404)
    })
  })

  describe('GET /.well-known/assetlinks.json', function () {
    it('is served as JSON, without a redirect', async function () {
      const res = await get('/.well-known/assetlinks.json')

      assert.strictEqual(res.status, 200)
      assert.match(res.headers.get('content-type') ?? '', /^application\/json/)
      await res.json()
    })

    it('lets the app handle links for every configured signing key', async function () {
      const links = (await (
        await get('/.well-known/assetlinks.json')
      ).json()) as AssetLinks

      assert.deepStrictEqual(links, [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: 'com.prezentowo.app',
            sha256_cert_fingerprints: FINGERPRINTS,
          },
        },
      ])
    })

    it('is a 404 until a fingerprint is configured', async function () {
      Meteor.settings.appLinks = { appleTeamId: TEAM_ID }

      const res = await get('/.well-known/assetlinks.json')

      assert.strictEqual(res.status, 404)
    })
  })
})

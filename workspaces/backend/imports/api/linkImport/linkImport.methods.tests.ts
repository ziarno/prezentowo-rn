import type { LinkImportOutcome } from '@prezentowo/types'
import assert from 'assert'

import { createUser } from '../../../tests/fixtures'
import { callAsUser, resetDatabase } from '../../../tests/helpers'
import botWall403 from '../../../tests/shopPages/botWall403'
import ceneoProduct from '../../../tests/shopPages/ceneoProduct'
import empikProduct from '../../../tests/shopPages/empikProduct'
import moreleProduct from '../../../tests/shopPages/moreleProduct'
import xkomCategory from '../../../tests/shopPages/xkomCategory'
import xkomProduct from '../../../tests/shopPages/xkomProduct'
import './linkImport.methods'

type Route = Response | ((init: RequestInit) => Response | Promise<Response>)

const html = (body: string, init: ResponseInit = {}) =>
  new Response(body, {
    status: 200,
    ...init,
    headers: { 'content-type': 'text/html; charset=utf-8', ...init.headers },
  })

// A minimal page with the given head tags.
const page = (...head: string[]) =>
  `<!doctype html><html><head>${head.join('')}</head><body></body></html>`
const ogMeta = (property: string, content: string) =>
  `<meta property="og:${property}" content="${content}"/>`
const pickError = (e: Error) => {
  const { error, reason } = e as Error & { error?: unknown; reason?: unknown }
  return { error, reason }
}
const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`

describe('gifts.importLink', function () {
  const realFetch = globalThis.fetch
  const realInfo = console.info
  let routes: Record<string, Route>
  let requests: { url: string; init: RequestInit }[]
  let logged: string[]
  let userId: string

  beforeEach(async function () {
    await resetDatabase()
    userId = await createUser('Ola')
    routes = {}
    requests = []
    logged = []
    globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
      const url = String(input)
      requests.push({ url, init })
      const route = routes[url]
      if (!route) throw new TypeError('fetch failed')
      return typeof route === 'function' ? route(init) : route.clone()
    }) as typeof fetch
    console.info = (...args: unknown[]) => void logged.push(args.join(' '))
  })

  afterEach(function () {
    globalThis.fetch = realFetch
    console.info = realInfo
  })

  const importLink = (url: string) =>
    callAsUser<LinkImportOutcome>(userId, 'gifts.importLink', { url })

  describe('blocked shop list', function () {
    for (const [url, shop] of [
      ['https://allegro.pl/oferta/rower-123', 'allegro.pl'],
      ['https://www.mediaexpert.pl/komputery/laptop', 'mediaexpert.pl'],
      ['https://ALLEGRO.PL./oferta/rower-123', 'allegro.pl'],
    ]) {
      it(`answers ${url} as unreadable, naming the shop, without fetching`, async function () {
        assert.deepStrictEqual(await importLink(url), {
          outcome: 'unreadable',
          blockedShop: shop,
        })
        assert.strictEqual(requests.length, 0)
      })
    }

    it('does not block a lookalike domain', async function () {
      routes['https://notallegro.pl/p/1'] = html(xkomProduct)

      const result = await importLink('https://notallegro.pl/p/1')

      assert.strictEqual(result.outcome, 'success')
    })

    it('does not block Zalando', async function () {
      await importLink('https://www.zalando.pl/buty-1.html')

      assert.strictEqual(requests.length, 1)
    })
  })

  describe('saved shop pages', function () {
    it('reads an x-kom product, with JSON-LD winning over OG', async function () {
      const url =
        'https://www.x-kom.pl/p/1583405-smartfon-telefon-google-pixel-11-5g-12-256gb-czarny.html'
      routes[url] = html(xkomProduct)

      assert.deepStrictEqual(await importLink(url), {
        outcome: 'success',
        fields: {
          // JSON-LD's name, not OG's SEO title.
          title: 'Google Pixel 11 5G 12/256GB Czarny',
          // x-kom's JSON-LD has no description, so OG fills it.
          description:
            'Google Pixel 11 5G 12/256GB Czarny w x-kom.pl > Odbiór za 0 zł w dowolnym salonie, błyskawiczna wysyłka.',
          url,
          imageUrl:
            'https://cdn.x-kom.pl/i/setup/images/prod/big/product-new-big,,2026/8/pr_2026_8_21_9_28_27_699_00.jpg',
          missing: [],
        },
      })
    })

    it('reads a Morele product, taking the JSON-LD description', async function () {
      const url =
        'https://www.morele.net/zasilacz-msi-pro-a850pl-pcie5-850w-pro-a850pl-pcie5-16222853/'
      routes[url] = html(moreleProduct)

      const result = await importLink(url)

      assert.strictEqual(result.outcome, 'success')
      const { fields } = result as Extract<
        typeof result,
        { outcome: 'success' }
      >
      assert.strictEqual(
        fields.title,
        'Zasilacz MSI PRO A850PL PCIE5 850W (PRO-A850PL-PCIE5)',
      )
      assert.match(
        fields.description ?? '',
        /^Zasilacz MSI PRO A850PL PCIE5 – niezawodny fundament/,
      )
      assert.strictEqual(fields.url, url)
      assert.strictEqual(
        fields.imageUrl,
        'https://images.morele.net/i1064/16222853_5_i1064.jpg',
      )
      assert.deepStrictEqual(fields.missing, [])
    })

    it('reads a Ceneo product', async function () {
      const url = 'https://www.ceneo.pl/199941317'
      routes[url] = html(ceneoProduct)

      const result = await importLink(url)

      assert.strictEqual(result.outcome, 'success')
      const { fields } = result as Extract<
        typeof result,
        { outcome: 'success' }
      >
      assert.strictEqual(fields.title, 'Apple iPhone 18 Pro Burgund 256GB')
      assert.match(fields.description ?? '', /^iPhone 18 Pro\./)
      assert.strictEqual(fields.url, url)
      assert.strictEqual(
        fields.imageUrl,
        'https://image.ceneostatic.pl/data/products/199941317/i-apple-iphone-18-pro-burgund-256gb.jpg',
      )
      assert.deepStrictEqual(fields.missing, [])
    })

    it('reads an Empik product from OG alone (partial)', async function () {
      const url =
        'https://www.empik.com/depilator-ipl-philips-lumea-9900-senseiq-smartskin-3-nasadki-bri953-02,p1729665860,agd-p'
      routes[url] = html(empikProduct)

      const result = await importLink(url)

      assert.strictEqual(result.outcome, 'success')
      const { fields } = result as Extract<
        typeof result,
        { outcome: 'success' }
      >
      assert.strictEqual(
        fields.title,
        'Depilator IPL Philips Lumea 9900 SenseIQ SmartSkin + 3 nasadki BRI953/02',
      )
      assert.match(fields.description ?? '', /w sklepie empik\.com/)
      assert.strictEqual(
        fields.imageUrl,
        'https://ecsmedia.pl/c/depilator-ipl-philips-lumea-9900-senseiq-smartskin-3-nasadki-bri953-02-b-iext220609379.jpg',
      )
      assert.deepStrictEqual(fields.missing, [])
    })

    it('answers a category page as unreadable', async function () {
      const url = 'https://www.x-kom.pl/g-4/c/1590-smartfony-i-telefony.html'
      routes[url] = html(xkomCategory)

      assert.deepStrictEqual(await importLink(url), { outcome: 'unreadable' })
    })

    it('answers a 403 bot-wall shell as unreadable', async function () {
      const url = 'https://www.sklep.pl/p/1'
      routes[url] = html(botWall403, {
        status: 403,
        headers: { 'cf-mitigated': 'challenge' },
      })

      assert.deepStrictEqual(await importLink(url), { outcome: 'unreadable' })
    })

    it('answers a timeout as an infra failure', async function () {
      const url = 'https://www.sklep.pl/p/1'
      routes[url] = () => {
        throw new DOMException('The operation timed out.', 'TimeoutError')
      }

      assert.deepStrictEqual(await importLink(url), {
        outcome: 'infra-failure',
      })
    })
  })

  describe('outcome mapping', function () {
    const url = 'https://www.sklep.pl/p/1'

    it('answers a network error as an infra failure', async function () {
      // No route: the stub rejects the way undici does when the host is down.
      assert.deepStrictEqual(await importLink(url), {
        outcome: 'infra-failure',
      })
    })

    it('answers a shop 5xx as an infra failure', async function () {
      routes[url] = html('Bad gateway', { status: 502 })

      assert.deepStrictEqual(await importLink(url), {
        outcome: 'infra-failure',
      })
    })

    it('answers a 5xx bot challenge as unreadable', async function () {
      routes[url] = html('Just a moment...', {
        status: 503,
        headers: { 'cf-mitigated': 'challenge' },
      })

      assert.deepStrictEqual(await importLink(url), { outcome: 'unreadable' })
    })

    it('answers a shop 4xx as unreadable', async function () {
      routes[url] = html(xkomProduct, { status: 404 })

      assert.deepStrictEqual(await importLink(url), { outcome: 'unreadable' })
    })

    it('answers a 200 challenge page with no product data as unreadable', async function () {
      routes[url] = html(botWall403)

      assert.deepStrictEqual(await importLink(url), { outcome: 'unreadable' })
    })

    it('answers a non-HTML response as unreadable', async function () {
      routes[url] = new Response('%PDF-1.7', {
        headers: { 'content-type': 'application/pdf' },
      })

      assert.deepStrictEqual(await importLink(url), { outcome: 'unreadable' })
    })

    it('answers a body that fails mid-read as an infra failure', async function () {
      routes[url] = () =>
        new Response(
          new ReadableStream({
            pull: controller => controller.error(new TypeError('terminated')),
          }),
          { headers: { 'content-type': 'text/html' } },
        )

      assert.deepStrictEqual(await importLink(url), {
        outcome: 'infra-failure',
      })
    })

    it('answers an oversized body as unreadable', async function () {
      routes[url] = () =>
        html(
          page(
            ogMeta('type', 'product'),
            ogMeta('title', 'x'.repeat(9_000_000)),
          ),
        )

      assert.deepStrictEqual(await importLink(url), { outcome: 'unreadable' })
    })

    it('fetches like a browser, with a timeout', async function () {
      routes[url] = html(xkomProduct)

      await importLink(url)

      const [{ init }] = requests
      const headers = new Headers(init.headers)
      assert.match(headers.get('user-agent') ?? '', /Mozilla\/5\.0.*Chrome/)
      assert.match(headers.get('accept') ?? '', /text\/html/)
      assert.ok(init.signal instanceof AbortSignal)
    })
  })

  describe('reading the page', function () {
    const url = 'https://www.sklep.pl/p/1?utm_source=x'

    it('lists what the page had nothing for, falling back to the pasted URL', async function () {
      routes[url] = html(
        page(ogMeta('type', 'product'), ogMeta('title', 'Kubek')),
      )

      assert.deepStrictEqual(await importLink(url), {
        outcome: 'success',
        fields: { title: 'Kubek', url, missing: ['description', 'image'] },
      })
    })

    it('finds a Product inside @graph, typed with an array, with an ImageObject', async function () {
      routes[url] = html(
        page(
          jsonLd({
            '@context': 'https://schema.org',
            '@graph': [
              { '@type': 'BreadcrumbList' },
              {
                '@type': ['Product', 'Thing'],
                name: '  Kubek\n  termiczny ',
                description: '<p>Trzyma ciepło &amp; zimno</p>',
                image: { '@type': 'ImageObject', url: '/img/kubek.jpg' },
                url: '/p/kubek',
              },
            ],
          }),
        ),
      )

      assert.deepStrictEqual(await importLink(url), {
        outcome: 'success',
        fields: {
          title: 'Kubek termiczny',
          description: 'Trzyma ciepło & zimno',
          url: 'https://www.sklep.pl/p/kubek',
          imageUrl: 'https://www.sklep.pl/img/kubek.jpg',
          missing: [],
        },
      })
    })

    it('takes the canonical link when there is no og:url', async function () {
      routes[url] = html(
        page(
          ogMeta('type', 'product'),
          ogMeta('title', 'Kubek'),
          '<link rel="canonical" href="/p/1"/>',
        ),
      )

      const result = await importLink(url)

      assert.strictEqual(result.outcome, 'success')
      assert.strictEqual(
        (result as Extract<typeof result, { outcome: 'success' }>).fields.url,
        'https://www.sklep.pl/p/1',
      )
    })

    it('ignores non-http image and canonical URLs', async function () {
      routes[url] = html(
        page(
          ogMeta('type', 'product'),
          ogMeta('title', 'Kubek'),
          ogMeta('image', 'data:image/png;base64,AAAA'),
          ogMeta('url', 'javascript:alert(1)'),
        ),
      )

      assert.deepStrictEqual(await importLink(url), {
        outcome: 'success',
        fields: { title: 'Kubek', url, missing: ['description', 'image'] },
      })
    })

    it('skips unparseable JSON-LD and falls back to OG', async function () {
      routes[url] = html(
        page(
          '<script type="application/ld+json">{ not json }</script>',
          ogMeta('type', 'product'),
          ogMeta('title', 'Kubek'),
        ),
      )

      const result = await importLink(url)

      assert.strictEqual(result.outcome, 'success')
    })

    it('follows redirects, resolving relative URLs against the final page', async function () {
      routes['https://sklep.pl/k'] = new Response(null, {
        status: 301,
        headers: { location: '/p/kubek' },
      })
      routes['https://sklep.pl/p/kubek'] = html(
        page(
          ogMeta('type', 'product'),
          ogMeta('title', 'Kubek'),
          ogMeta('image', 'k.jpg'),
        ),
      )

      assert.deepStrictEqual(await importLink('https://sklep.pl/k'), {
        outcome: 'success',
        fields: {
          title: 'Kubek',
          // No canonical URL on the page: the pasted one, not the redirect's.
          url: 'https://sklep.pl/k',
          imageUrl: 'https://sklep.pl/p/k.jpg',
          missing: ['description'],
        },
      })
    })

    it('gives up on a redirect loop as unreadable', async function () {
      routes['https://sklep.pl/a'] = new Response(null, {
        status: 302,
        headers: { location: '/a' },
      })

      assert.deepStrictEqual(await importLink('https://sklep.pl/a'), {
        outcome: 'unreadable',
      })
    })
  })

  describe('private hosts', function () {
    for (const url of [
      'http://localhost:8100/api',
      'http://127.0.0.1/',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
      'http://172.16.0.1/',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'http://[fd00::1]/',
      'http://0.0.0.0/',
      'http://intranet.localhost/',
      'http://mongo:27017/',
      'http://[::ffff:127.0.0.1]/',
    ]) {
      it(`answers ${url} as unreadable without fetching`, async function () {
        assert.deepStrictEqual(await importLink(url), { outcome: 'unreadable' })
        assert.strictEqual(requests.length, 0)
      })
    }

    it('refuses to follow a redirect to a private host', async function () {
      routes['https://sklep.pl/k'] = new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1:27017/' },
      })

      assert.deepStrictEqual(await importLink('https://sklep.pl/k'), {
        outcome: 'unreadable',
      })
      assert.strictEqual(requests.length, 1)
    })
  })

  describe('arguments', function () {
    it('rejects a signed-out caller', async function () {
      await assert.rejects(
        callAsUser(null, 'gifts.importLink', { url: 'https://sklep.pl/p/1' }),
        (e: Error) => {
          assert.deepStrictEqual(pickError(e), {
            error: 'notAuthorized',
            reason: 'mustBeLoggedIn',
          })
          return true
        },
      )
    })

    for (const url of ['', 'not a url at all', 'ftp://sklep.pl/p/1']) {
      it(`rejects ${JSON.stringify(url)} as an invalid URL`, async function () {
        await assert.rejects(importLink(url), (e: Error) => {
          assert.deepStrictEqual(pickError(e), {
            error: 'invalidArgs',
            reason: 'invalidUrl',
          })
          return true
        })
      })
    }

    it('assumes https for a pasted URL with no scheme', async function () {
      routes['https://www.sklep.pl/p/1'] = html(xkomProduct)

      const result = await importLink('  www.sklep.pl/p/1 ')

      assert.strictEqual(result.outcome, 'success')
    })
  })

  describe('logging', function () {
    it('logs the domain and outcome class only', async function () {
      routes['https://www.sklep.pl/p/secret-path?user=ola'] = html(xkomProduct)

      await importLink('https://www.sklep.pl/p/secret-path?user=ola')
      await importLink('https://allegro.pl/oferta/secret-path')
      await importLink('https://down.sklep.pl/p/secret-path')

      assert.deepStrictEqual(logged, [
        'linkImport www.sklep.pl success',
        'linkImport allegro.pl unreadable',
        'linkImport down.sklep.pl infra-failure',
      ])
      assert.ok(logged.every(line => !line.includes('secret-path')))
      assert.ok(logged.every(line => !line.includes(userId)))
    })
  })
})

import assert from 'assert'
import { Meteor } from 'meteor/meteor'

import { createFamilyEvent } from '../../tests/fixtures'
import { callAsUser, resetDatabase } from '../../tests/helpers'
import { Events } from '../api/events/events.collection'
import { rotateInvite } from '../api/invites/invites.codes'
import { Invites, createInviteIndexes } from '../api/invites/invites.collection'
import { dateChip, pickLanguage, todayInWarsaw } from './landing.i18n'
import './landing.server'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

type Page = { status: number; html: string; head: string; body: string }

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(Meteor.absoluteUrl(path.replace(/^\//, '')), {
    headers,
  })
  const html = await res.text()
  return {
    status: res.status,
    html,
    head: html.slice(0, html.indexOf('</head>')),
    // Only what the page renders, without Meteor's own boilerplate.
    body:
      /<div id="react-target">[\s\S]*?<\/main><\/div>/.exec(html)?.[0] ?? '',
  } satisfies Page
}

const meta = (page: Page, property: string) =>
  new RegExp(`<meta property="${property}" content="([^"]*)"`).exec(
    page.head,
  )?.[1]

// The store links in the order the page shows them, with their look.
const stores = (page: Page) =>
  [...page.body.matchAll(/<a class="store( secondary)?" href="([^"]*)"/g)].map(
    ([, secondary, href]) => ({
      store: href.includes('apple.com') ? 'appStore' : 'play',
      filled: !secondary,
      href: href.replace(/&amp;/g, '&'),
    }),
  )

// YYYY-MM-DD, `days` from today in Warsaw: calendar days, so DST can't skew
// it.
const warsawDay = (days: number) => {
  const today = new Date(`${todayInWarsaw()}T00:00:00Z`)
  return new Date(today.getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

describe('invite landing page', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  let code: string

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
    code = (await Invites.findOneAsync({ eventId: family.eventId }))!.code
  })

  describe('GET /e/:code', function () {
    it('invites the visitor to the event by the inviter’s name', async function () {
      const page = await get(`/e/${code}`)

      assert.strictEqual(page.status, 200)
      assert.match(page.body, /<b>Ola<\/b> zaprasza Cię do/)
      assert.match(page.body, /<h1[^>]*>Wigilia<\/h1>/)
      assert.match(page.body, /📅 czw\., 24 grudnia 2026/)
      assert.match(page.body, /Pobierz aplikację, żeby dołączyć/)
      assert.match(
        page.body,
        /Po instalacji kliknij link z zaproszeniem jeszcze raz\./,
      )
    })

    it('shows no participant or placeholder', async function () {
      const page = await get(`/e/${code}`)

      for (const name of ['Bartek', 'Celina', 'Dziadek']) {
        assert.doesNotMatch(page.html, new RegExp(name))
      }
    })

    it('counts down to the event', async function () {
      await Events.updateAsync(family.eventId, { $set: { date: warsawDay(0) } })
      assert.match((await get(`/e/${code}`)).body, / · dziś</)

      await Events.updateAsync(family.eventId, { $set: { date: warsawDay(1) } })
      assert.match((await get(`/e/${code}`)).body, / · jutro</)

      await Events.updateAsync(family.eventId, { $set: { date: warsawDay(9) } })
      assert.match((await get(`/e/${code}`)).body, / · za 9 dni</)
    })

    it('links “Open the invite” to the app’s own scheme', async function () {
      const page = await get(`/e/${code}`)

      assert.match(
        page.body,
        new RegExp(
          `Masz już Prezentowo\\? <a href="prezentowo://e/${code}">Otwórz zaproszenie</a>`,
        ),
      )
    })

    it('escapes the title and the inviter’s name', async function () {
      await Events.updateAsync(family.eventId, {
        $set: { title: '<script>alert("x")</script>' },
      })
      await Meteor.users.updateAsync(family.users.ola, {
        $set: { 'profile.name': 'Ola "<b>"' },
      })
      const page = await get(`/e/${code}`)

      assert.doesNotMatch(page.html, /<script>alert/)
      assert.match(page.body, /&lt;script&gt;alert/)
      assert.strictEqual(
        meta(page, 'og:title'),
        'Ola &quot;&lt;b&gt;&quot; zaprasza Cię do: &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
      )
    })

    describe('store buttons', function () {
      it('puts the App Store first and filled on an iPhone', async function () {
        const page = await get(`/e/${code}`, { 'User-Agent': IPHONE })

        assert.deepStrictEqual(
          stores(page).map(({ store, filled }) => ({ store, filled })),
          [
            { store: 'appStore', filled: true },
            { store: 'play', filled: false },
          ],
        )
      })

      it('puts Google Play first and filled on Android', async function () {
        const page = await get(`/e/${code}`, { 'User-Agent': ANDROID })

        assert.deepStrictEqual(
          stores(page).map(({ store, filled }) => ({ store, filled })),
          [
            { store: 'play', filled: true },
            { store: 'appStore', filled: false },
          ],
        )
      })

      it('fills both on a desktop', async function () {
        const page = await get(`/e/${code}`, { 'User-Agent': DESKTOP })

        assert.deepStrictEqual(
          stores(page).map(({ store, filled }) => ({ store, filled })),
          [
            { store: 'appStore', filled: true },
            { store: 'play', filled: true },
          ],
        )
      })

      it('hands the code to the app through the Play install referrer', async function () {
        const page = await get(`/e/${code}`, { 'User-Agent': ANDROID })

        assert.strictEqual(
          stores(page).find(s => s.store === 'play')!.href,
          `https://play.google.com/store/apps/details?id=com.prezentowo.app&referrer=code%3D${code}`,
        )
      })
    })

    describe('language', function () {
      it('defaults to Polish', async function () {
        const page = await get(`/e/${code}`)

        assert.match(page.html, /<html[^>]* lang="pl"/)
        assert.match(page.body, /zaprasza Cię do/)
      })

      it('follows Accept-Language', async function () {
        const page = await get(`/e/${code}`, {
          'Accept-Language': 'en-GB,en;q=0.9',
        })

        assert.match(page.html, /<html[^>]* lang="en"/)
        assert.match(page.body, /<b>Ola<\/b> invited you to/)
        assert.match(page.body, /📅 Thu, 24 December 2026/)
        assert.match(page.body, /Get the app to join/)
        assert.match(
          page.body,
          /Already have Prezentowo\? <a [^>]*>Open the invite</,
        )
      })

      it('falls back to Polish for any other language', async function () {
        const page = await get(`/e/${code}`, { 'Accept-Language': 'de-DE,de' })

        assert.match(page.body, /zaprasza Cię do/)
      })

      it('lets ?lang= override the header', async function () {
        const en = await get(`/e/${code}?lang=en`, { 'Accept-Language': 'pl' })
        const pl = await get(`/e/${code}?lang=pl`, { 'Accept-Language': 'en' })

        assert.match(en.body, /invited you to/)
        assert.match(pl.body, /zaprasza Cię do/)
      })

      it('links PL · EN to ?lang=', async function () {
        const page = await get(`/e/${code}?lang=en`)

        assert.match(
          page.body,
          /<a href="\?lang=pl">PL<\/a> · <a href="\?lang=en" class="on" aria-current="true">EN<\/a>/,
        )
      })
    })

    describe('link preview', function () {
      it('carries the event’s OG tags in Polish, whatever the visitor’s language', async function () {
        const page = await get(`/e/${code}?lang=en`, {
          'Accept-Language': 'en',
        })

        assert.strictEqual(
          meta(page, 'og:title'),
          'Ola zaprasza Cię do: Wigilia',
        )
        assert.strictEqual(
          meta(page, 'og:description'),
          'Dołącz do wspólnej listy prezentów w Prezentowo.',
        )
        assert.strictEqual(
          meta(page, 'og:url'),
          Meteor.absoluteUrl(`e/${code}`),
        )
        assert.match(
          meta(page, 'og:image')!,
          new RegExp(`^${Meteor.absoluteUrl(`e/${code}/og.png`)}\\?v=\\w+$`),
        )
        assert.strictEqual(meta(page, 'og:image:width'), '1200')
        assert.strictEqual(meta(page, 'og:image:height'), '630')
      })

      it('points og:image at a new card once the title changes', async function () {
        const before = meta(await get(`/e/${code}`), 'og:image')
        await callAsUser(family.users.ola, 'events.update', {
          eventId: family.eventId,
          title: 'Wigilia 2026',
        })
        const after = meta(await get(`/e/${code}`), 'og:image')

        assert.notStrictEqual(after, before)
      })
    })

    describe('a code that doesn’t open an event', function () {
      it('says the link doesn’t work, with HTTP 404', async function () {
        const page = await get('/e/zzzz')

        assert.strictEqual(page.status, 404)
        assert.match(page.body, /🔗/)
        assert.match(page.body, /Ten link z zaproszeniem już nie działa/)
        assert.match(page.body, /Mógł zostać zastąpiony nowym\./)
        assert.match(
          page.body,
          /Prezentowo to wspólna lista prezentów dla rodziny i znajomych\./,
        )
        // No code to hand over through the install referrer.
        assert.strictEqual(
          stores(page).find(s => s.store === 'play')!.href,
          'https://play.google.com/store/apps/details?id=com.prezentowo.app',
        )
      })

      it('carries the generic OG tags and the brand card', async function () {
        const page = await get('/e/zzzz')

        assert.strictEqual(meta(page, 'og:title'), 'Prezentowo')
        assert.strictEqual(
          meta(page, 'og:description'),
          'Wspólna lista prezentów dla rodziny i znajomych.',
        )
        assert.strictEqual(meta(page, 'og:image'), Meteor.absoluteUrl('og.png'))
      })

      it('renders a rotated code exactly like one that never existed', async function () {
        await rotateInvite(family.eventId)
        const rotated = await get(`/e/${code}`)
        const never = await get('/e/zzzz')

        assert.strictEqual(rotated.status, 404)
        assert.strictEqual(rotated.body, never.body)
        assert.strictEqual(rotated.head, never.head)
      })

      it('treats a deleted event’s code the same', async function () {
        await callAsUser(family.users.ola, 'events.delete', {
          eventId: family.eventId,
        })

        assert.strictEqual((await get(`/e/${code}`)).status, 404)
      })

      it('is in the visitor’s language too', async function () {
        const page = await get('/e/zzzz', { 'Accept-Language': 'en' })

        assert.match(page.body, /This invite link doesn’t work anymore/)
      })
    })
  })

  describe('GET / (brand page)', function () {
    it('says what Prezentowo is, with HTTP 200', async function () {
      const page = await get('/')

      assert.strictEqual(page.status, 200)
      assert.match(page.body, /<h1[^>]*>Prezentowo<\/h1>/)
      assert.match(
        page.body,
        /Wspólna lista prezentów dla rodziny i znajomych\./,
      )
      assert.match(page.body, /Prezentowo to wspólna lista prezentów\./)
      assert.doesNotMatch(page.body, /prezentowo:\/\//)
    })

    it('is not hydrated', async function () {
      assert.doesNotMatch((await get('/')).html, /id="landing-props"/)
    })

    it('serves /index.html the same', async function () {
      const root = await get('/')
      const index = await get('/index.html')

      assert.strictEqual(index.status, 200)
      assert.strictEqual(index.body, root.body)
    })

    it('carries the brand OG tags and a canonical root URL', async function () {
      const page = await get('/?lang=en', { 'Accept-Language': 'en' })

      assert.match(page.head, /<title>Prezentowo<\/title>/)
      assert.strictEqual(meta(page, 'og:title'), 'Prezentowo')
      assert.strictEqual(
        meta(page, 'og:description'),
        'Wspólna lista prezentów',
      )
      assert.strictEqual(meta(page, 'og:image'), Meteor.absoluteUrl('og.png'))
      assert.strictEqual(meta(page, 'og:url'), Meteor.absoluteUrl())
      assert.match(
        page.head,
        new RegExp(`<link rel="canonical" href="${Meteor.absoluteUrl()}"/>`),
      )
      assert.doesNotMatch(page.head, /name="robots"/)
    })

    it('links the stores without a referrer, the visitor’s first', async function () {
      const page = await get('/', { 'User-Agent': ANDROID })

      assert.deepStrictEqual(stores(page), [
        {
          store: 'play',
          filled: true,
          href: 'https://play.google.com/store/apps/details?id=com.prezentowo.app',
        },
        {
          store: 'appStore',
          filled: false,
          href: 'https://apps.apple.com/search?term=Prezentowo',
        },
      ])
    })

    it('is in the visitor’s language, Polish by default', async function () {
      const pl = await get('/', { 'Accept-Language': 'de' })
      const en = await get('/', { 'Accept-Language': 'en' })

      assert.match(pl.html, /<html[^>]* lang="pl"/)
      assert.match(en.html, /<html[^>]* lang="en"/)
      assert.match(en.body, /A shared gift list for family and friends\./)
    })

    it('answers any unknown path as a 404 the crawlers skip', async function () {
      for (const path of ['/foo', '/e/', '/e/abc/def']) {
        const page = await get(path)

        assert.strictEqual(page.status, 404, path)
        assert.match(page.body, /<h1[^>]*>Prezentowo<\/h1>/, path)
        assert.match(
          page.head,
          /<meta name="robots" content="noindex"\/>/,
          path,
        )
      }
    })
  })

  describe('pickLanguage', function () {
    it('takes the best of en and pl from Accept-Language', function () {
      assert.strictEqual(pickLanguage(undefined, undefined), 'pl')
      assert.strictEqual(pickLanguage('en-US,en;q=0.9', undefined), 'en')
      assert.strictEqual(pickLanguage('pl-PL', undefined), 'pl')
      assert.strictEqual(pickLanguage('de-DE,de;q=0.9', undefined), 'pl')
      assert.strictEqual(pickLanguage('de,en;q=0.8', undefined), 'en')
      assert.strictEqual(pickLanguage('en;q=0.5,pl;q=0.9', undefined), 'pl')
      assert.strictEqual(pickLanguage('*', undefined), 'pl')
      assert.strictEqual(pickLanguage('EN', undefined), 'en')
      assert.strictEqual(pickLanguage('en;q=0', undefined), 'pl')
    })

    it('lets ?lang= win when it names en or pl', function () {
      assert.strictEqual(pickLanguage('pl', 'en'), 'en')
      assert.strictEqual(pickLanguage('en', 'pl'), 'pl')
      assert.strictEqual(pickLanguage('en', 'de'), 'en')
      assert.strictEqual(pickLanguage('en', ['pl', 'en']), 'pl')
    })
  })

  describe('dateChip', function () {
    it('formats the day and how far off it is', function () {
      assert.strictEqual(
        dateChip('2026-12-24', '2026-09-27', 'en'),
        'Thu, 24 December 2026 · in 88 days',
      )
      assert.strictEqual(
        dateChip('2026-12-24', '2026-09-27', 'pl'),
        'czw., 24 grudnia 2026 · za 88 dni',
      )
      assert.strictEqual(
        dateChip('2026-09-28', '2026-09-27', 'en'),
        'Mon, 28 September 2026 · tomorrow',
      )
      assert.strictEqual(
        dateChip('2026-09-27', '2026-09-27', 'pl'),
        'niedz., 27 września 2026 · dziś',
      )
    })

    it('leaves out the countdown once the day is past', function () {
      assert.strictEqual(
        dateChip('2026-01-06', '2026-09-27', 'en'),
        'Tue, 6 January 2026',
      )
    })
  })
})

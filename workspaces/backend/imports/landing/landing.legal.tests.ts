import assert from 'assert'
import { Meteor } from 'meteor/meteor'

import { createFamilyEvent } from '../../tests/fixtures'
import { resetDatabase } from '../../tests/helpers'
import { Invites, createInviteIndexes } from '../api/invites/invites.collection'
import './landing.server'

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(Meteor.absoluteUrl(path.replace(/^\//, '')), {
    headers,
  })
  const html = await res.text()
  return {
    status: res.status,
    type: res.headers.get('content-type'),
    html,
    head: html.slice(0, html.indexOf('</head>')),
  }
}

// The section headings, in order.
const headings = (html: string) =>
  [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map(([, text]) => text)

// The links in the page's footer.
const footer = (html: string) =>
  [
    ...(/<footer[\s\S]*?<\/footer>/.exec(html)?.[0] ?? '').matchAll(
      /<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g,
    ),
  ].map(([, href, text]) => ({ href, text }))

describe('legal pages', function () {
  const pages = [
    { path: '/privacy', pl: 'Polityka prywatności', en: 'Privacy policy' },
    { path: '/terms', pl: 'Regulamin', en: 'Terms of use' },
  ]

  for (const { path, pl, en } of pages) {
    describe(`GET ${path}`, function () {
      it('is plain HTML in Polish by default, with HTTP 200', async function () {
        const page = await get(path)

        assert.strictEqual(page.status, 200)
        assert.match(page.type!, /^text\/html; charset=utf-8/i)
        assert.match(page.html, /^<!DOCTYPE html><html lang="pl">/)
        assert.match(page.head, new RegExp(`<title>${pl} · Prezentowo</title>`))
        assert.match(page.html, new RegExp(`<h1[^>]*>${pl}</h1>`))
        assert.match(page.html, /Ostatnia aktualizacja: \d+ \p{L}+ \d{4}/u)
        assert.doesNotMatch(page.html, /Polish version is binding/)
      })

      it('has no JS', async function () {
        assert.doesNotMatch((await get(path)).html, /<script/i)
      })

      it('is indexed, under its own canonical URL', async function () {
        const page = await get(`${path}?lang=en`)

        assert.doesNotMatch(page.head, /name="robots"/)
        assert.match(
          page.head,
          new RegExp(
            `<link rel="canonical" href="${Meteor.absoluteUrl(path.slice(1))}"/>`,
          ),
        )
      })

      it('is in English when asked, saying the Polish text is binding', async function () {
        for (const page of [
          await get(path, { 'Accept-Language': 'en-GB,en;q=0.9' }),
          await get(`${path}?lang=en`, { 'Accept-Language': 'pl' }),
        ]) {
          assert.strictEqual(page.status, 200)
          assert.match(page.html, /<html lang="en">/)
          assert.match(
            page.head,
            new RegExp(`<title>${en} · Prezentowo</title>`),
          )
          assert.match(page.html, new RegExp(`<h1[^>]*>${en}</h1>`))
          assert.match(page.html, /Last updated: \d+ [A-Z][a-z]+ \d{4}/)
          assert.match(page.html, /The Polish version is binding/)
        }
      })

      it('falls back to Polish for any other language', async function () {
        const page = await get(path, { 'Accept-Language': 'de-DE,de' })

        assert.match(page.html, new RegExp(`<h1[^>]*>${pl}</h1>`))
      })

      it('links PL · EN to ?lang=', async function () {
        const page = await get(`${path}?lang=en`)

        assert.match(
          page.html,
          /<a href="\?lang=pl">PL<\/a> · <a href="\?lang=en" class="on" aria-current="true">EN<\/a>/,
        )
      })

      it('links the other two legal pages in its language', async function () {
        const others = ['/privacy', '/terms', '/delete-account'].filter(
          other => other !== path,
        )
        for (const lang of ['pl', 'en']) {
          const page = await get(`${path}?lang=${lang}`)
          for (const other of others) {
            assert.match(
              page.html,
              new RegExp(`<a href="${other}\\?lang=${lang}"`),
              `${lang} ${other}`,
            )
          }
        }
      })
    })
  }

  describe('the privacy policy', function () {
    it('has the twelve sections of the outline, in both languages', async function () {
      assert.deepStrictEqual(headings((await get('/privacy?lang=en')).html), [
        '1. Who we are',
        '2. What we collect, and why',
        '3. People who aren’t users',
        '4. Who sees what',
        '5. Who processes your data for us',
        '6. Transfers outside the EEA',
        '7. How long we keep it',
        '8. Deleting your account',
        '9. Your rights',
        '10. Children',
        '11. What we don’t do',
        '12. Changes to this policy',
      ])
      assert.strictEqual(
        headings((await get('/privacy?lang=pl')).html).length,
        12,
      )
    })

    it('names the controller and the contact', async function () {
      for (const lang of ['pl', 'en']) {
        const { html } = await get(`/privacy?lang=${lang}`)

        assert.match(html, /Filip Jarno/)
        assert.match(
          html,
          /<a href="mailto:prezentowo@jarno.pl">prezentowo@jarno.pl<\/a>/,
        )
      }
    })

    it('names the mail provider', async function () {
      for (const lang of ['pl', 'en']) {
        assert.match((await get(`/privacy?lang=${lang}`)).html, /Scaleway/)
      }
    })

    it('lists what stays after deletion, as the deletion confirm does', async function () {
      const { html } = await get('/privacy?lang=en')

      assert.match(html, /Your chat messages stay, shown as “Deleted user”\./)
      assert.match(html, /Backups rotate out within 30 days\./)
    })
  })

  describe('the terms of use', function () {
    it('have the eight sections of the outline, in both languages', async function () {
      assert.deepStrictEqual(headings((await get('/terms?lang=en')).html), [
        '1. The service',
        '2. Who can use it',
        '3. Acceptable use',
        '4. Your content',
        '5. What stays when you leave',
        '6. Ending your use',
        '7. Changes to these terms',
        '8. Governing law',
      ])
      assert.strictEqual(headings((await get('/terms?lang=pl')).html).length, 8)
    })
  })
})

describe('landing footer', function () {
  let code: string

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    const family = await createFamilyEvent()
    code = (await Invites.findOneAsync({ eventId: family.eventId }))!.code
  })

  it('links the legal pages in the page’s language', async function () {
    for (const path of ['/', `/e/${code}`, '/e/zzzz', '/foo']) {
      assert.deepStrictEqual(
        footer((await get(path)).html),
        [
          { href: '/privacy?lang=pl', text: 'Polityka prywatności' },
          { href: '/terms?lang=pl', text: 'Regulamin' },
          { href: '/delete-account?lang=pl', text: 'Usuń konto' },
        ],
        path,
      )
      assert.deepStrictEqual(
        footer((await get(path, { 'Accept-Language': 'en' })).html),
        [
          { href: '/privacy?lang=en', text: 'Privacy policy' },
          { href: '/terms?lang=en', text: 'Terms' },
          { href: '/delete-account?lang=en', text: 'Delete account' },
        ],
        path,
      )
    }
  })
})

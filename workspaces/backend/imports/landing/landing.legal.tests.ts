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

// The page's text between two markers, tags stripped.
const textBetween = (html: string, from: RegExp, to: RegExp) => {
  const start = html.search(from)
  const rest = html.slice(start)
  return rest
    .slice(0, rest.search(to))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
}

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

    it('opens with a short summary for young readers, above the sections', async function () {
      const summary = async (lang: string) =>
        textBetween(
          (await get(`/privacy?lang=${lang}`)).html,
          /<aside[^>]*class="[^"]*summary/,
          /<h2/,
        )

      const pl = await summary('pl')
      assert.match(pl, /od 13 lat/)
      assert.match(pl, /poniżej 16 lat/)
      assert.match(pl, /push/)
      assert.match(pl, /po imieniu/)
      assert.match(pl, /rodzic lub opiekun/)
      assert.match(pl, /datę urodzenia/)
      assert.match(pl, /nikt inny/)
      assert.match(pl, /w dniu 16\. urodzin/)

      const en = await summary('en')
      assert.match(en, /13 or older/)
      assert.match(en, /under 16/i)
      assert.match(en, /push/)
      assert.match(en, /by name/)
      assert.match(en, /parent or guardian/)
      assert.match(en, /date of birth/)
      assert.match(en, /no one else/)
      assert.match(en, /on your 16th birthday/)
    })

    it('says in section 2 that the date of birth is kept, why, who sees it and that it goes with the account', async function () {
      const section = async (lang: string) =>
        textBetween(
          (await get(`/privacy?lang=${lang}`)).html,
          /<h2[^>]*>2\./,
          /<h2[^>]*>3\./,
        )

      const pl = await section('pl')
      assert.match(pl, /data urodzenia/)
      assert.match(pl, /widzisz ją tylko Ty/i)
      assert.match(pl, /usuwamy ją razem z kontem/)

      const en = await section('en')
      assert.match(en, /date of birth/)
      assert.match(en, /only you can see it/i)
      assert.match(en, /deleted with your account/)
    })

    it('says in section 4 that nobody else sees the date of birth', async function () {
      const section = async (lang: string) =>
        textBetween(
          (await get(`/privacy?lang=${lang}`)).html,
          /<h2[^>]*>4\./,
          /<h2[^>]*>5\./,
        )

      const pl = await section('pl')
      assert.match(pl, /Data urodzenia/)
      assert.match(pl, /widzisz ją tylko Ty/i)
      assert.match(
        pl,
        /w wyszukiwarce, w wydarzeniach, w aktywności ani na czacie/,
      )

      const en = await section('en')
      assert.match(en, /Your date of birth/)
      assert.match(en, /only you can see it/i)
      assert.match(en, /search, events, activity or chat/)
    })

    it('no longer says that no birth date is asked or kept', async function () {
      for (const lang of ['pl', 'en']) {
        assert.doesNotMatch(
          (await get(`/privacy?lang=${lang}`)).html,
          /Nie pytamy o datę|nie zapisujemy daty urodzenia|never a birth date|never store a birth date|don’t ask for a birth date|don’t store a birth date/,
          lang,
        )
      }
    })

    it('says accounts start at 13, and what changes under 16, in the children section', async function () {
      const section = async (lang: string) =>
        textBetween(
          (await get(`/privacy?lang=${lang}`)).html,
          /<h2[^>]*>10\./,
          /<h2[^>]*>11\./,
        )

      const pl = await section('pl')
      assert.match(pl, /od 13 lat/)
      assert.match(pl, /poniżej 13 lat nie zakładamy konta/)
      assert.match(pl, /usuwamy/)
      assert.match(pl, /nie dostają powiadomień push/)
      assert.match(pl, /nie mogą ich znaleźć po imieniu/)
      assert.match(pl, /zapisujemy Twoją datę urodzenia/)
      assert.match(pl, /widzisz ją tylko Ty/i)
      assert.match(pl, /w dniu 16\. urodzin/)

      const en = await section('en')
      assert.match(en, /aged 13 and over/)
      assert.match(en, /under 13 we don’t make an account/)
      assert.match(en, /delete/)
      assert.match(en, /get no push notifications/)
      assert.match(en, /can’t find them by name/)
      assert.match(en, /store your date of birth/)
      assert.match(en, /only you can see it/i)
      assert.match(en, /on their 16th birthday/)
    })

    it('says only people from 16 can be found by name, and get push', async function () {
      for (const [lang, search, push] of [
        [
          'pl',
          /(?:od|co najmniej) 16 lat.*po imieniu|po imieniu.*(?:od|co najmniej) 16 lat/,
          /(?:od|co najmniej) 16 lat.*push/,
        ],
        [
          'en',
          /16 or older.*by name|by name.*16 or older/,
          /16 or older.*push/,
        ],
      ] as const) {
        const { html } = await get(`/privacy?lang=${lang}`)
        const body = textBetween(html, /<h2[^>]*>2\./, /<h2[^>]*>3\./)
        const who = textBetween(html, /<h2[^>]*>4\./, /<h2[^>]*>5\./)

        assert.match(who, search, `${lang} section 4`)
        assert.match(body, push, `${lang} section 2`)
      }
    })

    it('says an unconfirmed account goes after 7 days, and at once on an under-13 answer', async function () {
      for (const [lang, sevenDays, atOnce] of [
        ['pl', /po 7 dniach/, /poniżej 13 lat.*od razu/],
        ['en', /after 7 days/, /under 13.*at once/],
      ] as const) {
        const { html } = await get(`/privacy?lang=${lang}`)
        const keeping = textBetween(html, /<h2[^>]*>7\./, /<h2[^>]*>8\./)

        assert.match(keeping, sevenDays, `${lang} 7 days`)
        assert.match(keeping, atOnce, `${lang} under 13`)
      }
    })

    it('does not give 16 as the minimum age anywhere', async function () {
      const minimum16 =
        /osoby od 16 lat|ukończyły 16 lat|aged 16 and over|be 16 or older|anyone under 16/
      for (const path of ['/privacy', '/terms']) {
        for (const lang of ['pl', 'en']) {
          assert.doesNotMatch(
            (await get(`${path}?lang=${lang}`)).html,
            minimum16,
            `${path} ${lang}`,
          )
        }
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

    it('say you must be 13 to have an account, and ask under-18s to check with a parent, in both languages', async function () {
      const section = async (lang: string) =>
        textBetween(
          (await get(`/terms?lang=${lang}`)).html,
          /<h2[^>]*>2\./,
          /<h2[^>]*>3\./,
        )

      const pl = await section('pl')
      assert.match(pl, /ukończyły 13 lat/)
      assert.match(pl, /poniżej 18 lat/)
      assert.match(pl, /rodzic lub opiekun/)

      const en = await section('en')
      assert.match(en, /13 or older/)
      assert.match(en, /under 18/)
      assert.match(en, /parent or guardian/)
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

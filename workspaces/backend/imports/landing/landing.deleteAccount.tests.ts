import { ACCOUNT_DELETION_CONSEQUENCES } from '@prezentowo/types'
import assert from 'assert'
import { Accounts } from 'meteor/accounts-base'
import { Email } from 'meteor/email'
import { Meteor } from 'meteor/meteor'

import { useFakeChatServer } from '../../tests/chat'
import { createUser } from '../../tests/fixtures'
import { resetDatabase, whileFailing } from '../../tests/helpers'
import {
  type DeletionState,
  resetDeletionLimits,
} from '../api/users/users.webDeletion'
import './landing.server'

type SentEmail = { to?: string; from?: string; subject?: string; text?: string }

async function request(
  path: string,
  {
    form,
    headers = {},
  }: { form?: Record<string, string>; headers?: Record<string, string> } = {},
) {
  const res = await fetch(Meteor.absoluteUrl(path.replace(/^\//, '')), {
    method: form ? 'POST' : 'GET',
    headers: form
      ? { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }
      : headers,
    body: form ? new URLSearchParams(form).toString() : undefined,
    redirect: 'manual',
  })
  const html = await res.text()
  return {
    status: res.status,
    type: res.headers.get('content-type'),
    html,
    head: html.slice(0, html.indexOf('</head>')),
  }
}

// The page's text, tags stripped, so assertions read like the copy.
const textOf = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

// The forms on the page, as `method action`.
const forms = (html: string) =>
  [...html.matchAll(/<form[^>]*method="([^"]*)"[^>]*action="([^"]*)"/g)].map(
    ([, method, action]) => `${method} ${action}`,
  )

const tokenIn = (mail: SentEmail) =>
  /\/delete-account\/([A-Za-z0-9_-]+)/.exec(mail.text ?? '')?.[1]

const userExists = async (userId: string) =>
  !!(await Meteor.users.findOneAsync(userId, { fields: { _id: 1 } }))

const deletionState = async (userId: string) =>
  (
    (await Meteor.users.findOneAsync(userId)) as
      | (Meteor.User & { services?: { accountDeletion?: DeletionState } })
      | undefined
  )?.services?.accountDeletion

// Moves the user's deletion token `ms` into the past.
const age = async (userId: string, ms: number) => {
  const state = (await deletionState(userId))!
  await Meteor.users.updateAsync(userId, {
    $set: {
      'services.accountDeletion.createdAt': new Date(
        state.createdAt.getTime() - ms,
      ),
    },
  })
}

const SAME_ANSWER = /If an account exists for this address, we’ve sent a link/

describe('web account deletion', function () {
  useFakeChatServer()
  let sent: SentEmail[]
  let hook: { stop: () => void }
  let ola: string

  before(function () {
    sent = []
    // email 3.2.0 returns the hook's handle; @types/meteor says void.
    hook = Email.hookSend(mail => {
      sent.push(mail as SentEmail)
      return false
    }) as unknown as { stop: () => void }
  })

  after(function () {
    hook.stop()
  })

  beforeEach(async function () {
    await resetDatabase()
    resetDeletionLimits()
    sent.length = 0
    ola = await createUser('Ola')
  })

  // Asks for a link for `email` and returns the token it mails, if any.
  async function requestLink(email: string, path = '/delete-account?lang=en') {
    const before = sent.length
    const page = await request(path, { form: { email } })
    assert.strictEqual(page.status, 200)
    assert.match(textOf(page.html), /exists for this address|istnieje konto/)
    // The email goes out after the answer; give it a moment.
    await new Promise(resolve => setTimeout(resolve, 50))
    return sent.length > before ? tokenIn(sent[sent.length - 1]!) : undefined
  }

  describe('GET /delete-account', function () {
    it('is plain HTML in Polish by default: the in-app path, the form, then the contact', async function () {
      const page = await request('/delete-account')

      assert.strictEqual(page.status, 200)
      assert.match(page.type!, /^text\/html; charset=utf-8/i)
      assert.match(page.html, /^<!DOCTYPE html><html lang="pl">/)
      assert.doesNotMatch(page.html, /<script/i)
      assert.doesNotMatch(page.head, /name="robots"/)
      assert.match(
        page.head,
        new RegExp(
          `<link rel="canonical" href="${Meteor.absoluteUrl('delete-account')}"/>`,
        ),
      )
      const text = textOf(page.html)
      const inApp = text.indexOf('Profil → Usuń konto')
      const form = page.html.indexOf('<form')
      const contact = page.html.indexOf('mailto:prezentowo@jarno.pl')
      assert.ok(inApp >= 0, 'names the in-app path')
      assert.ok(
        page.html.indexOf('Profil → Usuń konto') < form && form < contact,
        'in-app path, then the form, then the contact',
      )
      assert.deepStrictEqual(forms(page.html), ['post /delete-account?lang=pl'])
      assert.match(page.html, /<input[^>]*type="email"[^>]*name="email"/)
    })

    it('is in English when asked', async function () {
      const page = await request('/delete-account', {
        headers: { 'Accept-Language': 'en' },
      })

      assert.match(page.html, /<html lang="en">/)
      assert.match(textOf(page.html), /Profile → Delete account/)
      assert.deepStrictEqual(forms(page.html), ['post /delete-account?lang=en'])
    })
  })

  describe('POST /delete-account', function () {
    it('mails a known address a single link in the page’s language', async function () {
      const token = await requestLink('Ola@Example.com ')

      assert.ok(token)
      assert.strictEqual(sent.length, 1)
      const mail = sent[0]!
      assert.strictEqual(mail.to, 'ola@example.com')
      // The sign-in email's sender.
      assert.strictEqual(mail.from, Accounts.emailTemplates.from)
      assert.match(mail.text!, /delete your Prezentowo account/)
      assert.ok(
        mail.text!.includes(Meteor.absoluteUrl(`delete-account/${token}`)),
      )
      assert.match(mail.text!, /expires in 1 hour/)
      assert.match(mail.text!, /If you didn’t ask for this, ignore it/)
      assert.doesNotMatch(mail.text!, /<[a-z]/i, 'plain text')

      const state = (await deletionState(ola))!
      assert.ok(state.hashedToken)
      assert.notStrictEqual(state.hashedToken, token, 'stored hashed')
    })

    it('mails in Polish from a Polish page', async function () {
      await requestLink('ola@example.com', '/delete-account')

      assert.match(sent[0]!.text!, /usunąć konto w Prezentowo/)
      assert.match(sent[0]!.text!, /wygaśnie za godzinę/)
    })

    it('gives an unknown address the same answer, sends nothing, and creates no user', async function () {
      const known = await request('/delete-account?lang=en', {
        form: { email: 'ola@example.com' },
      })
      const unknown = await request('/delete-account?lang=en', {
        form: { email: 'nobody@example.com' },
      })
      await new Promise(resolve => setTimeout(resolve, 50))

      assert.strictEqual(unknown.status, known.status)
      assert.strictEqual(unknown.html, known.html)
      assert.match(textOf(unknown.html), SAME_ANSWER)
      assert.strictEqual(sent.length, 1)
      assert.strictEqual(
        await Meteor.users.findOneAsync({
          'emails.address': 'nobody@example.com',
        }),
        undefined,
      )
      assert.strictEqual(await Meteor.users.find().countAsync(), 1)
    })

    it('answers the same to a missing or odd email field', async function () {
      const known = await request('/delete-account?lang=en', {
        form: { email: 'ola@example.com' },
      })
      for (const form of [
        {},
        { email: '' },
        { email: 'x'.repeat(5000) },
        // Past the body limit.
        { email: 'x'.repeat(20_000) },
      ] as Record<string, string>[]) {
        const page = await request('/delete-account?lang=en', { form })
        assert.strictEqual(page.status, 200)
        assert.strictEqual(page.html, known.html)
      }
    })

    it('sends nothing for a repeat within 60 s, and the old link still works', async function () {
      const first = await requestLink('ola@example.com')
      const repeat = await requestLink('ola@example.com')

      assert.strictEqual(repeat, undefined)
      assert.strictEqual(sent.length, 1)
      assert.strictEqual(
        (await request(`/delete-account/${first}`)).status,
        200,
      )
    })

    it('a new link after 60 s replaces the old one', async function () {
      const first = await requestLink('ola@example.com')
      await age(ola, 61_000)
      const second = await requestLink('ola@example.com')

      assert.ok(second)
      assert.notStrictEqual(second, first)
      assert.strictEqual(
        (await request(`/delete-account/${first}`)).status,
        410,
      )
      assert.strictEqual(
        (await request(`/delete-account/${second}`)).status,
        200,
      )
    })

    it('caps one address at about 10 requests an hour, with the same answer', async function () {
      const others = []
      for (let i = 0; i < 11; i++) others.push(await createUser(`User${i}`))

      for (let i = 0; i < 10; i++) {
        assert.ok(await requestLink(`user${i}@example.com`), `request ${i + 1}`)
      }
      assert.strictEqual(await requestLink('user10@example.com'), undefined)
      assert.strictEqual(sent.length, 10)
      assert.strictEqual(await deletionState(others[10]!), undefined)
    })

    describe('behind a proxy', function () {
      // `meteor test` serves the app through its own proxy, which adds a
      // hop: the one in front of it here is the second.
      const { HTTP_FORWARDED_COUNT } = process.env
      before(function () {
        process.env.HTTP_FORWARDED_COUNT = '2'
      })
      after(function () {
        if (HTTP_FORWARDED_COUNT === undefined) {
          delete process.env.HTTP_FORWARDED_COUNT
        } else process.env.HTTP_FORWARDED_COUNT = HTTP_FORWARDED_COUNT
      })

      it('caps the address the proxy saw', async function () {
        for (let i = 0; i < 11; i++) await createUser(`User${i}`)
        const from = (ip: string, email: string) =>
          request('/delete-account?lang=en', {
            form: { email },
            headers: { 'X-Forwarded-For': `10.0.0.9, ${ip}` },
          })

        for (let i = 0; i < 10; i++) {
          await from('203.0.113.1', `user${i}@example.com`)
        }
        await from('203.0.113.1', 'user10@example.com')
        await from('203.0.113.2', 'ola@example.com')
        await new Promise(resolve => setTimeout(resolve, 50))

        assert.strictEqual(sent.length, 11)
        assert.deepStrictEqual(
          sent.slice(-2).map(mail => mail.to),
          ['user9@example.com', 'ola@example.com'],
        )
      })
    })
  })

  describe('GET /delete-account/:token', function () {
    it('only shows the confirm page: the email, the consequences, a POST button', async function () {
      const token = await requestLink('ola@example.com')

      for (let i = 0; i < 2; i++) {
        const page = await request(`/delete-account/${token}?lang=en`)
        assert.strictEqual(page.status, 200)
        assert.doesNotMatch(page.html, /<script/i)
        assert.match(page.head, /<meta name="robots" content="noindex"/)
        const text = textOf(page.html)
        assert.match(text, /ola@example\.com/)
        for (const line of ACCOUNT_DELETION_CONSEQUENCES.en) {
          assert.ok(text.includes(line), line)
        }
        assert.match(text, /This can’t be undone/)
        assert.deepStrictEqual(forms(page.html), [
          `post /delete-account/${token}?lang=en`,
        ])
        assert.match(
          page.html,
          /<button[^>]*type="submit"[^>]*>Delete my account</,
        )
        assert.doesNotMatch(page.html, /name="email"/, 'no retyped email')
      }
      assert.ok(await userExists(ola), 'a GET never deletes')
    })

    it('is in Polish with the Polish consequences', async function () {
      const token = await requestLink('ola@example.com')
      const text = textOf((await request(`/delete-account/${token}`)).html)

      for (const line of ACCOUNT_DELETION_CONSEQUENCES.pl) {
        assert.ok(text.includes(line), line)
      }
    })
  })

  describe('POST /delete-account/:token', function () {
    it('deletes the account, then says so', async function () {
      const token = await requestLink('ola@example.com')
      const page = await request(`/delete-account/${token}?lang=en`, {
        form: {},
      })

      assert.strictEqual(page.status, 200)
      assert.match(textOf(page.html), /Account deleted/)
      assert.strictEqual(await userExists(ola), false)
    })

    it('spends the token: a second POST or GET finds it expired', async function () {
      const token = await requestLink('ola@example.com')
      await request(`/delete-account/${token}`, { form: {} })

      for (const page of [
        await request(`/delete-account/${token}?lang=en`, { form: {} }),
        await request(`/delete-account/${token}?lang=en`),
      ]) {
        assert.strictEqual(page.status, 410)
        assert.match(textOf(page.html), /This link has expired/)
      }
    })

    it('keeps the token when the deletion dies half-way, so a retry finishes it', async function () {
      const token = await requestLink('ola@example.com')

      const failed = await whileFailing(Meteor.users, 'removeAsync', () =>
        request(`/delete-account/${token}?lang=en`, { form: {} }),
      )
      assert.strictEqual(failed.status, 500)
      assert.doesNotMatch(textOf(failed.html), /Account deleted/)
      assert.ok(await userExists(ola))

      const retried = await request(`/delete-account/${token}?lang=en`, {
        form: {},
      })
      assert.strictEqual(retried.status, 200)
      assert.match(textOf(retried.html), /Account deleted/)
      assert.strictEqual(await userExists(ola), false)
    })
  })

  describe('an expired, spent or unknown token', function () {
    it('expires after 1 hour', async function () {
      const token = await requestLink('ola@example.com')
      await age(ola, 60 * 60 * 1000 + 1000)

      const shown = await request(`/delete-account/${token}?lang=en`)
      const posted = await request(`/delete-account/${token}?lang=en`, {
        form: {},
      })

      for (const page of [shown, posted]) {
        assert.strictEqual(page.status, 410)
        assert.match(textOf(page.html), /This link has expired/)
      }
      assert.ok(await userExists(ola), 'an expired link deletes nothing')
    })

    it('gets "This link has expired" with the request form, HTTP 410', async function () {
      for (const lang of ['en', 'pl'] as const) {
        const page = await request(`/delete-account/nonsense?lang=${lang}`)
        assert.strictEqual(page.status, 410)
        assert.match(page.head, /<meta name="robots" content="noindex"/)
        assert.match(
          textOf(page.html),
          lang === 'en' ? /This link has expired/ : /Ten link wygasł/,
        )
        assert.deepStrictEqual(forms(page.html), [
          `post /delete-account?lang=${lang}`,
        ])
      }
      assert.ok(await userExists(ola))
    })
  })
})

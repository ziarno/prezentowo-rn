import { ACCOUNT_DELETION_CONSEQUENCES } from '@prezentowo/types'
import type express from 'express'
import type { Request, Response } from 'express'
import { WebApp } from 'meteor/webapp'
import type { ReactNode } from 'react'

import {
  accountForDeletionToken,
  deleteAccountByToken,
  requestAccountDeletion,
} from '../api/users/users.webDeletion'
import type { Lang } from './landing.i18n'
import { Contact } from './landing.legalParts'
import { languageOf, plainHtml } from './landing.page'
import { Footer, TopBar } from './landing.parts'

// Deleting an account without the app, as Google Play requires
// (docs/spec.md §3.6): ask by email, open the emailed link, confirm with a
// POST. Plain HTML forms, no JS.

const PAGE_COPY = {
  en: {
    title: 'Delete your account',
    description:
      'Delete your Prezentowo account, with or without the app: we email you a link to confirm.',
    inApp: (
      <>
        In the app: <b>Profile → Delete account</b>.
      </>
    ),
    withoutApp:
      'Without the app: enter your account’s email and we’ll send you a link to confirm.',
    emailLabel: 'Your email',
    send: 'Send the link',
    contact: (
      <>
        Can’t use email links? Write to <Contact /> and we’ll delete it for you.
      </>
    ),
    sentTitle: 'Check your email',
    sent: 'If an account exists for this address, we’ve sent a link. It expires in 1 hour.',
    confirmTitle: 'Delete your account?',
    account: 'Account:',
    whatHappens: 'What happens:',
    cantUndo: 'This can’t be undone.',
    confirm: 'Delete my account',
    deletedTitle: 'Account deleted',
    deleted:
      'Your Prezentowo account is gone. Devices still signed in are signed out the next time they connect.',
    expiredTitle: 'This link has expired',
    expired: 'Links work once, for 1 hour. Ask for a new one:',
    failedTitle: 'We couldn’t finish',
    failed:
      'Something went wrong while deleting your account. The link still works: try again.',
  },
  pl: {
    title: 'Usuń konto',
    description:
      'Usuń konto w Prezentowo, z aplikacją lub bez: wyślemy Ci link do potwierdzenia.',
    inApp: (
      <>
        W aplikacji: <b>Profil → Usuń konto</b>.
      </>
    ),
    withoutApp:
      'Bez aplikacji: wpisz e-mail swojego konta, a wyślemy Ci link do potwierdzenia.',
    emailLabel: 'Twój e-mail',
    send: 'Wyślij link',
    contact: (
      <>
        Nie możesz skorzystać z linku w e-mailu? Napisz na <Contact />, a
        usuniemy konto za Ciebie.
      </>
    ),
    sentTitle: 'Sprawdź skrzynkę',
    sent: 'Jeśli istnieje konto dla tego adresu, wysłaliśmy link. Wygaśnie za godzinę.',
    confirmTitle: 'Usunąć konto?',
    account: 'Konto:',
    whatHappens: 'Co się stanie:',
    cantUndo: 'Tego nie da się cofnąć.',
    confirm: 'Usuń moje konto',
    deletedTitle: 'Konto usunięte',
    deleted:
      'Twoje konto w Prezentowo zostało usunięte. Urządzenia, na których jesteś zalogowany, wylogują się przy następnym połączeniu.',
    expiredTitle: 'Ten link wygasł',
    expired: 'Link działa raz, przez godzinę. Poproś o nowy:',
    failedTitle: 'Nie udało się dokończyć',
    failed:
      'Coś poszło nie tak podczas usuwania konta. Link nadal działa: spróbuj jeszcze raz.',
  },
} satisfies Record<Lang, Record<string, ReactNode>>

function Page({
  lang,
  title,
  children,
}: {
  lang: Lang
  title: string
  children: ReactNode
}) {
  return (
    <main className="landing">
      <TopBar lang={lang} />
      <article className="legal">
        <h1 className="display">{title}</h1>
        {children}
      </article>
      <Footer lang={lang} />
    </main>
  )
}

const RequestForm = ({ lang }: { lang: Lang }) => (
  <form className="ask" method="post" action={`/delete-account?lang=${lang}`}>
    <label htmlFor="email">{PAGE_COPY[lang].emailLabel}</label>
    <input
      id="email"
      type="email"
      name="email"
      autoComplete="email"
      required
      maxLength={254}
    />
    <button type="submit">{PAGE_COPY[lang].send}</button>
  </form>
)

const ConfirmForm = ({ lang, token }: { lang: Lang; token: string }) => (
  <form
    method="post"
    action={`/delete-account/${encodeURIComponent(token)}?lang=${lang}`}
  >
    <button type="submit" className="danger">
      {PAGE_COPY[lang].confirm}
    </button>
  </form>
)

type Shown = { status: number; html: string }

const show = (
  lang: Lang,
  title: string,
  children: ReactNode,
  { status = 200, indexed = false } = {},
): Shown => ({
  status,
  html: plainHtml({
    title,
    description: PAGE_COPY[lang].description,
    lang,
    ...(indexed ? { canonical: 'delete-account' } : { noindex: true }),
    children: (
      <Page lang={lang} title={title}>
        {children}
      </Page>
    ),
  }),
})

const requestPage = (lang: Lang) =>
  show(
    lang,
    PAGE_COPY[lang].title,
    <>
      <p>{PAGE_COPY[lang].inApp}</p>
      <p>{PAGE_COPY[lang].withoutApp}</p>
      <RequestForm lang={lang} />
      <p className="muted">{PAGE_COPY[lang].contact}</p>
    </>,
    { indexed: true },
  )

const sentPage = (lang: Lang) =>
  show(lang, PAGE_COPY[lang].sentTitle, <p>{PAGE_COPY[lang].sent}</p>)

const confirmPage = (lang: Lang, token: string, email: string) =>
  show(
    lang,
    PAGE_COPY[lang].confirmTitle,
    <>
      <p>
        {PAGE_COPY[lang].account} <b>{email}</b>
      </p>
      <p>{PAGE_COPY[lang].whatHappens}</p>
      <ul>
        {ACCOUNT_DELETION_CONSEQUENCES[lang].map(line => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>
        <b>{PAGE_COPY[lang].cantUndo}</b>
      </p>
      <ConfirmForm lang={lang} token={token} />
    </>,
  )

const deletedPage = (lang: Lang) =>
  show(lang, PAGE_COPY[lang].deletedTitle, <p>{PAGE_COPY[lang].deleted}</p>)

const expiredPage = (lang: Lang) =>
  show(
    lang,
    PAGE_COPY[lang].expiredTitle,
    <>
      <p>{PAGE_COPY[lang].expired}</p>
      <RequestForm lang={lang} />
    </>,
    { status: 410 },
  )

const failedPage = (lang: Lang, token: string) =>
  show(
    lang,
    PAGE_COPY[lang].failedTitle,
    <>
      <p>{PAGE_COPY[lang].failed}</p>
      <ConfirmForm lang={lang} token={token} />
    </>,
    { status: 500 },
  )

// The client's address, as DDP reads it: the socket's, or with
// HTTP_FORWARDED_COUNT proxies in front, the one the outermost proxy saw.
function clientAddress(req: Request): string {
  const forwardedCount = parseInt(process.env.HTTP_FORWARDED_COUNT ?? '', 10)
  if (!(forwardedCount > 0)) return req.socket.remoteAddress ?? 'unknown'
  const header = req.headers['x-forwarded-for']
  const hops = (typeof header === 'string' ? header : '')
    .split(',')
    .map(hop => hop.trim())
  return hops[hops.length - forwardedCount] ?? 'unknown'
}

// Token pages carry the token in the URL: never cached, never sent on as a
// referrer.
function send(res: Response, { status, html }: Shown, privateUrl = false) {
  res.status(status).set({
    'Content-Type': 'text/html; charset=utf-8',
    Vary: 'Accept-Language',
    ...(privateUrl
      ? { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
      : {}),
  })
  res.send(html)
}

const tokenOf = (req: Request) => String(req.params.token)

async function askForLink(req: Request, res: Response) {
  const lang = languageOf(req)
  try {
    await requestAccountDeletion(req.body?.email, lang, clientAddress(req))
  } catch (error) {
    // The answer never changes, so a failure here is only logged.
    console.error('POST /delete-account failed', error)
  }
  send(res, sentPage(lang))
}

async function showConfirm(req: Request, res: Response) {
  const lang = languageOf(req)
  // Only shows: mail scanners fetch links, so a GET never deletes.
  const account = await accountForDeletionToken(tokenOf(req))
  send(
    res,
    account
      ? confirmPage(lang, tokenOf(req), account.email)
      : expiredPage(lang),
    true,
  )
}

async function confirm(req: Request, res: Response) {
  const lang = languageOf(req)
  try {
    const deleted = await deleteAccountByToken(tokenOf(req))
    send(res, deleted ? deletedPage(lang) : expiredPage(lang), true)
  } catch (error) {
    console.error('POST /delete-account/:token failed', error)
    send(res, failedPage(lang, tokenOf(req)), true)
  }
}

// webapp 2.3.0 exposes its Express; @types/meteor doesn't declare it.
const { urlencoded } = (WebApp as unknown as { express: typeof express })
  .express
const parseForm = urlencoded({ extended: false, limit: '16kb' })
// A body it can't read (too big, malformed) still gets the same answer.
const formBody = (req: Request, res: Response, next: () => void) =>
  parseForm(req, res, () => next())

WebApp.handlers.get('/delete-account', (req: Request, res: Response) =>
  send(res, requestPage(languageOf(req))),
)
WebApp.handlers.post('/delete-account', formBody, askForLink)
WebApp.handlers.get('/delete-account/:token', showConfirm)
WebApp.handlers.post('/delete-account/:token', confirm)

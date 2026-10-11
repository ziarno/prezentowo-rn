import type { Request, Response } from 'express'
import { Meteor } from 'meteor/meteor'
import { WebApp } from 'meteor/webapp'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { LANDING_CSS } from './landing.css'
import { type Lang, longDate, pickLanguage } from './landing.i18n'
import type { LegalDoc } from './landing.legalParts'
import { Footer, TopBar } from './landing.parts'
import { PRIVACY } from './landing.privacy'
import { TERMS } from './landing.terms'

// The privacy policy and the terms of use (docs/spec.md §3.7). Polish is
// binding; English is a translation.

// When either document last changed, as `YYYY-MM-DD`. Both share it, so a
// change to one dates both.
export const LAST_UPDATED = '2026-10-11'

const CHROME: Record<Lang, { updated: string; translation: ReactNode }> = {
  en: {
    updated: 'Last updated',
    translation: (
      <>
        This is a translation. The Polish version is binding:{' '}
        <a href="?lang=pl">read it in Polish</a>.
      </>
    ),
  },
  pl: { updated: 'Ostatnia aktualizacja', translation: null },
}

function LegalPage({ doc, lang }: { doc: LegalDoc; lang: Lang }) {
  const chrome = CHROME[lang]
  return (
    <main className="landing">
      <TopBar lang={lang} />
      <article className="legal">
        <h1 className="display">{doc.title}</h1>
        <p className="muted">{`${chrome.updated}: ${longDate(LAST_UPDATED, lang)}`}</p>
        {chrome.translation && <p className="note">{chrome.translation}</p>}
        {doc.body}
      </article>
      <Footer lang={lang} />
    </main>
  )
}

/**
 * The whole document, written here rather than through webapp's boilerplate,
 * so the page carries no client bundle: no JS at all.
 */
export function legalHtml(
  docs: Record<Lang, LegalDoc>,
  path: string,
  lang: Lang,
): string {
  const doc = docs[lang]
  return `<!DOCTYPE html>${renderToStaticMarkup(
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${doc.title} · Prezentowo`}</title>
        <meta name="description" content={doc.description} />
        <link rel="canonical" href={Meteor.absoluteUrl(path)} />
        <link rel="icon" href="/icon.png" />
        <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      </head>
      <body>
        <LegalPage doc={doc} lang={lang} />
      </body>
    </html>,
  )}`
}

const serve =
  (docs: Record<Lang, LegalDoc>, path: string) =>
  (req: Request, res: Response) => {
    const lang = pickLanguage(
      req.headers['accept-language'],
      req.query.lang as string | string[] | undefined,
    )
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      Vary: 'Accept-Language',
    })
    res.send(legalHtml(docs, path, lang))
  }

WebApp.handlers.get('/privacy', serve(PRIVACY, 'privacy'))
WebApp.handlers.get('/terms', serve(TERMS, 'terms'))

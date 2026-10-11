import type { Request, Response } from 'express'
import { WebApp } from 'meteor/webapp'
import type { ReactNode } from 'react'

import { type Lang, longDate } from './landing.i18n'
import type { LegalDoc } from './landing.legalParts'
import { languageOf, plainHtml } from './landing.page'
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

/** The document `docs` in `lang`, served at `path`. */
const legalHtml = (
  docs: Record<Lang, LegalDoc>,
  path: string,
  lang: Lang,
): string =>
  plainHtml({
    title: docs[lang].title,
    description: docs[lang].description,
    lang,
    canonical: path,
    children: <LegalPage doc={docs[lang]} lang={lang} />,
  })

const serve =
  (docs: Record<Lang, LegalDoc>, path: string) =>
  (req: Request, res: Response) => {
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      Vary: 'Accept-Language',
    })
    res.send(legalHtml(docs, path, languageOf(req)))
  }

WebApp.handlers.get('/privacy', serve(PRIVACY, 'privacy'))
WebApp.handlers.get('/terms', serve(TERMS, 'terms'))

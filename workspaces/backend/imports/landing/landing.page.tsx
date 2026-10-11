import type { Request } from 'express'
import { Meteor } from 'meteor/meteor'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { LANDING_CSS } from './landing.css'
import { type Lang, pickLanguage } from './landing.i18n'

// The server-only pages (the legal pages, account deletion): the whole
// document, written here rather than through webapp's boilerplate, so the
// page carries no client bundle: no JS at all.

export type PlainPage = {
  title: string
  description: string
  lang: Lang
  /** The path for `<link rel="canonical">`, without the leading slash. */
  canonical?: string
  noindex?: boolean
  children: ReactNode
}

export function plainHtml({
  title,
  description,
  lang,
  canonical,
  noindex,
  children,
}: PlainPage): string {
  return `<!DOCTYPE html>${renderToStaticMarkup(
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${title} · Prezentowo`}</title>
        <meta name="description" content={description} />
        {noindex && <meta name="robots" content="noindex" />}
        {canonical !== undefined && (
          <link rel="canonical" href={Meteor.absoluteUrl(canonical)} />
        )}
        <link rel="icon" href="/icon.png" />
        <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      </head>
      <body>{children}</body>
    </html>,
  )}`
}

/** The page's language, from `?lang=` and then `Accept-Language`. */
export const languageOf = (req: Request) =>
  pickLanguage(
    req.headers['accept-language'],
    req.query.lang as string | string[] | undefined,
  )

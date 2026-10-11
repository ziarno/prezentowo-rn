import type { ReactNode } from 'react'

import type { Lang } from './landing.i18n'

// What the privacy policy and the terms are written with.

/** One document in one language. */
export type LegalDoc = {
  title: string
  description: string
  body: ReactNode
}

export const CONTACT = 'filip@jarno.pl'

export const Contact = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>

/** Another page of the site, in the same language. */
export const PageLink = ({
  path,
  lang,
  children,
}: {
  path: '/privacy' | '/terms' | '/delete-account'
  lang: Lang
  children: ReactNode
}) => <a href={`${path}?lang=${lang}`}>{children}</a>

/** A page elsewhere, such as a processor's own policy. */
export const ExternalLink = ({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) => (
  <a href={href} rel="noopener">
    {children}
  </a>
)

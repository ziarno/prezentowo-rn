import { COPY, type Lang } from './landing.i18n'
import { Garland, StoreButtons, TopBar } from './landing.parts'
import { type Platform } from './landing.stores'

export type BrandProps = { lang: Lang; platform: Platform }

/**
 * `GET /`, and every path that is no other page (docs/spec.md §3.5): what
 * Prezentowo is, and where to get it. Rendered on the server only; it has no
 * interactivity and isn't hydrated.
 */
export function BrandLanding({ lang, platform }: BrandProps) {
  const c = COPY[lang]
  return (
    <main className="landing">
      <TopBar lang={lang} />
      <section className="card">
        <Garland />
        <h1 className="display brand-title">Prezentowo</h1>
        <p className="tagline">{c.tagline}</p>
        <div className="rule" />
        <StoreButtons lang={lang} platform={platform} />
      </section>
      <p className="what muted">{c.what}</p>
    </main>
  )
}

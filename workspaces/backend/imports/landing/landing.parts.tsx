import type { ReactNode } from 'react'

import { GARLAND_VIEWBOX, garlandSvg } from './landing.garland'
import { COPY, type Lang } from './landing.i18n'
import { APP_STORE_URL, type Platform, playStoreUrl } from './landing.stores'

// The pieces every landing page shares: the garland, the top bar and the
// store buttons.

export const Garland = () => (
  <svg
    className="garland"
    viewBox={GARLAND_VIEWBOX}
    preserveAspectRatio="none"
    aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: garlandSvg() }}
  />
)

// A plain link: `?lang=` overrides Accept-Language, and no cookie is set.
const LangLink = ({ lang, current }: { lang: Lang; current: Lang }) => (
  <a
    href={`?lang=${lang}`}
    className={lang === current ? 'on' : undefined}
    aria-current={lang === current ? 'true' : undefined}
  >
    {lang.toUpperCase()}
  </a>
)

export const TopBar = ({ lang }: { lang: Lang }) => (
  <header className="top">
    <div className="brand">
      <img src="/icon.png" alt="" width={28} height={28} />
      <span>Prezentowo</span>
    </div>
    <nav className="langs">
      <LangLink lang="pl" current={lang} />
      {' · '}
      <LangLink lang="en" current={lang} />
    </nav>
  </header>
)

const AppleGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 7.2c-1.4-1-3.9-1.1-5.4.4C5 9.2 4.8 12 5.7 14.8 6.6 17.6 8.4 20 10 20c1 0 1.2-.5 2-.5s1 .5 2 .5c1.6 0 3.4-2.4 4.3-5.2.9-2.8.7-5.6-.9-7.2-1.5-1.5-4-1.4-5.4-.4zM12.2 6.4c0-2 1.5-3.6 3.3-3.8.1 2-1.4 3.7-3.3 3.8z"
    />
  </svg>
)

const PlayGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M6 3.5v17L20 12z" />
  </svg>
)

export function StoreButtons({
  lang,
  platform,
  code,
}: {
  lang: Lang
  platform: Platform
  code?: string
}) {
  const c = COPY[lang]
  const button = (
    store: 'appStore' | 'play',
    href: string,
    glyph: ReactNode,
  ) => {
    // On a phone the visitor's own store is filled and first; the other is
    // outlined. A desktop gets both filled.
    const own = store === (platform === 'android' ? 'play' : 'appStore')
    const [small, big] = c[store]
    return (
      <a
        key={store}
        className={platform === 'desktop' || own ? 'store' : 'store secondary'}
        href={href}
      >
        <span className="glyph">{glyph}</span>
        <span>
          <small>{small}</small>
          <b>{big}</b>
        </span>
      </a>
    )
  }
  const appStore = button('appStore', APP_STORE_URL, <AppleGlyph />)
  const play = button('play', playStoreUrl(code), <PlayGlyph />)
  return (
    <div className="stores">
      {platform === 'android' ? [play, appStore] : [appStore, play]}
    </div>
  )
}

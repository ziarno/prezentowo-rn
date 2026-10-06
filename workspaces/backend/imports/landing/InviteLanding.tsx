import type { InvitePreview } from '@prezentowo/types'

import { COPY, type Lang, dateChip } from './landing.i18n'
import { Garland, StoreButtons, TopBar } from './landing.parts'
import { type Platform } from './landing.stores'

// What the page shows of an `InvitePreview`: no participants, no background.
export type LandingInvite = Pick<
  InvitePreview,
  'code' | 'title' | 'date' | 'inviterName'
>

// The element the server renders the page into, and the JSON script
// carrying the props the client bundle hydrates it with.
export const TARGET_ID = 'react-target'
export const PROPS_ID = 'landing-props'

export type LandingProps = {
  lang: Lang
  platform: Platform
  // `YYYY-MM-DD` the page was rendered on, so the client's hydration counts
  // down from the same day as the server.
  today: string
  // Null for a code that doesn't open an event.
  invite: LandingInvite | null
}

function Invitation({
  invite,
  lang,
  platform,
  today,
}: LandingProps & { invite: LandingInvite }) {
  const c = COPY[lang]
  return (
    <>
      <section className="card">
        <Garland />
        <p className="eyebrow">
          <b>{invite.inviterName}</b>
          {` ${c.eyebrow}`}
        </p>
        <h1 className="display">{invite.title}</h1>
        <span className="chip">{`📅 ${dateChip(invite.date, today, lang)}`}</span>
        <div className="rule" />
        <p className="getapp">{c.getApp}</p>
        <StoreButtons lang={lang} platform={platform} code={invite.code} />
        <p className="after muted">{c.after}</p>
      </section>
      <p className="what muted">{c.what}</p>
      <p className="openapp muted">
        {`${c.haveApp} `}
        <a href={`prezentowo://e/${encodeURIComponent(invite.code)}`}>
          {c.openApp}
        </a>
      </p>
    </>
  )
}

function Invalid({ lang, platform }: LandingProps) {
  const c = COPY[lang]
  return (
    <section className="invalid">
      <div className="glyph-big" aria-hidden="true">
        🔗
      </div>
      <h1 className="display">{c.bad}</h1>
      <p>{c.badP}</p>
      <p className="muted badsub">{c.badSub}</p>
      <StoreButtons lang={lang} platform={platform} />
    </section>
  )
}

/**
 * `GET /e/:code` (docs/spec.md §3.4): the invitation card, or the "link
 * doesn't work anymore" page. Rendered on the server and hydrated by the
 * client bundle; it has no interactivity.
 */
export function InviteLanding(props: LandingProps) {
  return (
    <main className="landing">
      <TopBar lang={props.lang} />
      {props.invite ? (
        <Invitation {...props} invite={props.invite} />
      ) : (
        <Invalid {...props} />
      )}
    </main>
  )
}

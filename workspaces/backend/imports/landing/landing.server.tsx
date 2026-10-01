import type { IncomingHttpHeaders } from 'http'
import { Meteor } from 'meteor/meteor'
import { type ServerSink, onPageLoad } from 'meteor/server-render'
import { WebApp } from 'meteor/webapp'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'

import { loadInvitePreview } from '../api/invites/invites.preview'
import {
  InviteLanding,
  type LandingProps,
  PROPS_ID,
  TARGET_ID,
} from './InviteLanding'
import { LANDING_CSS } from './landing.css'
import { OG_COPY, pickLanguage, todayInWarsaw } from './landing.i18n'
import { CARD_HEIGHT, CARD_WIDTH, cardKey } from './landing.ogCard'
import './landing.routes'
import { platformOf } from './landing.stores'

// What webapp hands onPageLoad and the HTML attribute hooks as the request.
type PageRequest = {
  path: string
  url: { query: Record<string, string> }
  headers: IncomingHttpHeaders
}

// The invite code in `/e/:code`, or undefined for any other path.
function landingCode({ path }: PageRequest): string | undefined {
  const match = /^\/e\/([^/]+)\/?$/.exec(path)
  if (!match) return undefined
  try {
    return decodeURIComponent(match[1])
  } catch {
    // Malformed percent-encoding: a code that opens nothing.
    return ''
  }
}

const languageOf = (request: PageRequest) =>
  pickLanguage(
    request.headers['accept-language'] as string | undefined,
    request.url.query.lang,
  )

// The <head> additions: the page title and the link preview, always in Polish.
function Head({ invite }: Pick<LandingProps, 'invite'>) {
  const og = invite
    ? {
        title: OG_COPY.title(invite.inviterName, invite.title),
        description: OG_COPY.description,
        image: `${Meteor.absoluteUrl(`e/${encodeURIComponent(invite.code)}/og.png`)}?v=${cardKey(invite)}`,
        url: Meteor.absoluteUrl(`e/${encodeURIComponent(invite.code)}`),
      }
    : {
        title: OG_COPY.invalidTitle,
        description: OG_COPY.invalidDescription,
        image: Meteor.absoluteUrl('og.png'),
      }
  return (
    <>
      <title>{invite ? `${invite.title} · Prezentowo` : 'Prezentowo'}</title>
      <meta name="description" content={og.description} />
      <link rel="icon" href="/icon.png" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Prezentowo" />
      <meta property="og:locale" content="pl_PL" />
      <meta property="og:title" content={og.title} />
      <meta property="og:description" content={og.description} />
      {og.url && <meta property="og:url" content={og.url} />}
      <meta property="og:image" content={og.image} />
      <meta property="og:image:width" content={String(CARD_WIDTH)} />
      <meta property="og:image:height" content={String(CARD_HEIGHT)} />
      <meta name="twitter:card" content="summary_large_image" />
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
    </>
  )
}

// JSON inside <script> must not be able to close the tag.
const scriptJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c')

/**
 * Renders `GET /e/:code` (docs/spec.md §3.4): the invitation for a code that
 * opens an event, and one identical 404 page for any other code — unknown,
 * rotated, or its event deleted.
 */
async function renderLanding(sink: ServerSink) {
  const request = sink.request as unknown as PageRequest
  const code = landingCode(request)
  if (code === undefined) return

  const preview = code ? await loadInvitePreview(code) : null
  const props: LandingProps = {
    lang: languageOf(request),
    platform: platformOf(request.headers['user-agent']),
    today: todayInWarsaw(),
    invite: preview && {
      code: preview.code,
      title: preview.title,
      date: preview.date,
      inviterName: preview.inviterName,
    },
  }

  if (!props.invite) sink.setStatusCode(404)
  sink.appendToHead(renderToStaticMarkup(<Head invite={props.invite} />))
  // The target is written here rather than in client/main.html, so the page
  // doesn't depend on a client build (`meteor test` has none).
  sink.appendToBody(
    `<div id="${TARGET_ID}">${renderToString(<InviteLanding {...props} />)}</div>` +
      `<script type="application/json" id="${PROPS_ID}">${scriptJson(props)}</script>`,
  )
}

onPageLoad(sink => renderLanding(sink as ServerSink))

// `<html lang>` follows the page's language. webapp's typings lag behind.
;(
  WebApp as unknown as {
    addHtmlAttributeHook: (
      hook: (request: PageRequest) => Record<string, string> | null,
    ) => void
  }
).addHtmlAttributeHook(request =>
  landingCode(request) === undefined ? null : { lang: languageOf(request) },
)

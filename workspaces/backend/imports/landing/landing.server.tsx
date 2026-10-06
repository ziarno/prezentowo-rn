import type { IncomingHttpHeaders } from 'http'
import { Meteor } from 'meteor/meteor'
import { type ServerSink, onPageLoad } from 'meteor/server-render'
import { WebApp } from 'meteor/webapp'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'

import { loadInvitePreview } from '../api/invites/invites.preview'
import { BrandLanding } from './BrandLanding'
import {
  InviteLanding,
  type LandingInvite,
  type LandingProps,
  PROPS_ID,
  TARGET_ID,
} from './InviteLanding'
import './landing.appLinks'
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

// What a page puts in <head>: the title and the link preview, always in
// Polish.
type HeadMeta = {
  title: string
  og: { title: string; description: string; image: string; url?: string }
  canonical?: string
  noindex?: boolean
}

function inviteMeta(invite: LandingInvite | null): HeadMeta {
  if (!invite) {
    return {
      title: 'Prezentowo',
      og: {
        title: OG_COPY.invalidTitle,
        description: OG_COPY.invalidDescription,
        image: Meteor.absoluteUrl('og.png'),
      },
    }
  }
  const path = `e/${encodeURIComponent(invite.code)}`
  return {
    title: `${invite.title} · Prezentowo`,
    og: {
      title: OG_COPY.title(invite.inviterName, invite.title),
      description: OG_COPY.description,
      image: `${Meteor.absoluteUrl(`${path}/og.png`)}?v=${cardKey(invite)}`,
      url: Meteor.absoluteUrl(path),
    },
  }
}

// The brand page, also served (unindexed) as the 404 for any unknown path.
const brandMeta = (found: boolean): HeadMeta => ({
  title: 'Prezentowo',
  og: {
    title: OG_COPY.brandTitle,
    description: OG_COPY.brandDescription,
    image: Meteor.absoluteUrl('og.png'),
    url: Meteor.absoluteUrl(),
  },
  canonical: Meteor.absoluteUrl(),
  noindex: !found,
})

function Head({ title, og, canonical, noindex }: HeadMeta) {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={og.description} />
      {noindex && <meta name="robots" content="noindex" />}
      {canonical && <link rel="canonical" href={canonical} />}
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
async function renderInvite(
  sink: ServerSink,
  request: PageRequest,
  code: string,
) {
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
  sink.appendToHead(
    renderToStaticMarkup(<Head {...inviteMeta(props.invite)} />),
  )
  // The target is written here rather than in client/main.html, so the page
  // doesn't depend on a client build (`meteor test` has none).
  sink.appendToBody(
    `<div id="${TARGET_ID}">${renderToString(<InviteLanding {...props} />)}</div>` +
      `<script type="application/json" id="${PROPS_ID}">${scriptJson(props)}</script>`,
  )
}

/**
 * Renders the brand page (docs/spec.md §3.5) for `/`, and as a 404 for every
 * other path no route claims. No props script, so the client leaves it alone.
 */
function renderBrand(sink: ServerSink, request: PageRequest) {
  const found = request.path === '/' || request.path === '/index.html'
  if (!found) sink.setStatusCode(404)
  sink.appendToHead(renderToStaticMarkup(<Head {...brandMeta(found)} />))
  sink.appendToBody(
    `<div id="${TARGET_ID}">${renderToStaticMarkup(
      <BrandLanding
        lang={languageOf(request)}
        platform={platformOf(request.headers['user-agent'])}
      />,
    )}</div>`,
  )
}

onPageLoad(page => {
  const sink = page as ServerSink
  const request = sink.request as unknown as PageRequest
  const code = landingCode(request)
  return code === undefined
    ? renderBrand(sink, request)
    : renderInvite(sink, request, code)
})

// `<html lang>` follows the page's language. webapp's typings lag behind.
;(
  WebApp as unknown as {
    addHtmlAttributeHook: (
      hook: (request: PageRequest) => Record<string, string> | null,
    ) => void
  }
).addHtmlAttributeHook(request => ({ lang: languageOf(request) }))

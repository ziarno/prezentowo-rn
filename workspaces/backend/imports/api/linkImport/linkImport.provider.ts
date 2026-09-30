import type { LinkImportOutcome } from '@prezentowo/types'
import { Agent } from 'undici'

import {
  PrivateAddressError,
  guardedLookup,
  isPrivateHost,
} from './linkImport.hosts'
import { readProductPage } from './linkImport.page'

/** Resolves a pasted shop URL. Never throws for shop-side failures. */
export interface LinkImportProvider {
  importLink(url: URL): Promise<LinkImportOutcome>
}

const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5
// Well above the biggest real shop page seen (~2.4 MB, an x-kom category).
const MAX_PAGE_BYTES = 8 * 1024 * 1024

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'pl-PL,pl;q=0.9,en;q=0.8',
}

// Every connection's address is checked as it's resolved (see guardedLookup),
// which also covers DNS rebinding between hops. `undici` is pinned to the
// major bundled with Meteor's Node, so global fetch accepts its Agent.
const dispatcher = new Agent({ connect: { lookup: guardedLookup() } })

const unreadable: LinkImportOutcome = { outcome: 'unreadable' }
const infraFailure: LinkImportOutcome = { outcome: 'infra-failure' }

// fetch rejects with `TypeError('fetch failed')`, the lookup error in `cause`.
const isPrivateAddressError = (error: unknown): boolean =>
  error instanceof PrivateAddressError ||
  (error instanceof Error && isPrivateAddressError(error.cause))

const isHtml = (response: Response) =>
  /html/i.test(response.headers.get('content-type') ?? 'text/html')

const charsetOf = (response: Response) =>
  /charset=["']?([\w-]+)/i.exec(response.headers.get('content-type') ?? '')?.[1]

// Reads the body as text, or `undefined` once it passes MAX_PAGE_BYTES.
// Rejects when the connection fails mid-body, including on timeout.
async function readPage(response: Response) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_PAGE_BYTES) {
      await reader.cancel()
      return undefined
    }
    chunks.push(value)
  }
  let decoder: TextDecoder
  try {
    decoder = new TextDecoder(charsetOf(response) ?? 'utf-8')
  } catch {
    decoder = new TextDecoder('utf-8')
  }
  return decoder.decode(Buffer.concat(chunks))
}

// Fetches `url`, following redirects by hand so every hop is host-checked.
// Resolves the final response and its URL, or `undefined` when a hop is
// private or there are too many.
async function fetchPage(url: URL, signal: AbortSignal) {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (isPrivateHost(current.hostname)) return undefined
    // Node's fetch takes `dispatcher`; the DOM RequestInit type doesn't know it.
    const init: RequestInit & { dispatcher: Agent } = {
      headers: BROWSER_HEADERS,
      redirect: 'manual',
      signal,
      dispatcher,
    }
    const response = await fetch(current.href, init)
    const location = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || !location) {
      return { response, pageUrl: current }
    }
    await response.body?.cancel()
    current = new URL(location, current)
  }
  return undefined
}

/**
 * Fetches the page itself — global `fetch`, a browser-like UA, 10 s for the
 * whole exchange — and reads it with `readProductPage`.
 */
export const selfHostedProvider: LinkImportProvider = {
  async importLink(url) {
    const signal = AbortSignal.timeout(TIMEOUT_MS)

    let fetched: Awaited<ReturnType<typeof fetchPage>>
    try {
      fetched = await fetchPage(url, signal)
    } catch (error) {
      // A host resolving to a private address is the link's fault.
      if (isPrivateAddressError(error)) return unreadable
      // Network error, DNS failure or timeout: our side, not the shop's.
      return infraFailure
    }
    if (!fetched) return unreadable

    const { response, pageUrl } = fetched
    if (response.headers.get('cf-mitigated') === 'challenge') return unreadable
    if (response.status >= 500) return infraFailure
    if (!response.ok || !isHtml(response)) return unreadable

    let html: string | undefined
    try {
      html = await readPage(response)
    } catch {
      return infraFailure
    }
    if (html === undefined) return unreadable

    const fields = await readProductPage(html, pageUrl, url.href)
    return fields ? { outcome: 'success', fields } : unreadable
  },
}

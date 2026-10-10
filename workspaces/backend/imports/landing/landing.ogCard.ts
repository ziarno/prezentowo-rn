import { createHash } from 'crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'fs/promises'
import { Random } from 'meteor/random'
import * as opentype from 'opentype.js'
import { join } from 'path'
import sharp from 'sharp'

import { settingsDir } from '../api/settingsDir'
import type { LandingInvite } from './InviteLanding'
import { GARLAND_VIEWBOX, garlandSvg } from './landing.garland'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

// Bump to re-render every cached card after a design change.
const CARD_VERSION = 1

const INK = '#1d1a14'
const GREEN = '#2f5b3a'
const PAPER = '#fffaf2'

/**
 * Where rendered cards are cached, from `ogCardsDir` in settings.json. It's
 * a cache: anything in it can be deleted and is rendered again on request.
 * Superseded cards (an old title, a rotated code) are pruned daily by
 * sweepStaleOgCards (docs/spec.md §3.8).
 */
export const ogCardsDir = () => settingsDir('ogCardsDir')

/**
 * Names the card for what's drawn on it, so a new title (or inviter name) or
 * a rotated code gets a fresh card, and `og:image` a fresh URL.
 */
export const cardKey = (invite: LandingInvite) =>
  createHash('sha256')
    .update(
      [CARD_VERSION, invite.code, invite.title, invite.inviterName].join('\n'),
    )
    .digest('hex')
    .slice(0, 32)

// The file names in the cache: the static brand card, and one per invite
// the card key names.
export const BRAND_CARD_FILE = `brand-${CARD_VERSION}.png`
export const cardFile = (invite: LandingInvite) => `${cardKey(invite)}.png`

// The display face, then Inter for whatever it lacks. sharp's own text
// rendering can't be pointed at a font file on every platform (Pango on
// macOS ignores it), so text is drawn as SVG paths from the fonts directly.
// Meteor's server global for files under private/. @types/meteor declares
// it only inside a module there is no runtime package for.
declare const Assets: { absoluteFilePath: (assetPath: string) => string }

type Fonts = { display: opentype.Font; sans: opentype.Font; icon: Buffer }
let fonts: Promise<Fonts> | undefined

const loadFont = async (asset: string) => {
  const bytes = await readFile(Assets.absoluteFilePath(asset))
  return opentype.parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  )
}

const loadFonts = () =>
  (fonts ??= Promise.all([
    loadFont('fonts/FoglihtenNo07.ttf'),
    loadFont('fonts/Inter-Regular.ttf'),
    readFile(Assets.absoluteFilePath('brand/icon.png')),
  ]).then(([display, sans, icon]) => ({ display, sans, icon })))

type Placed = { font: opentype.Font; glyph: opentype.Glyph }

// Each character from the first font that has it. A character none has (an
// emoji, say) is left out rather than drawn as a box.
const place = (text: string, faces: opentype.Font[]): Placed[] =>
  Array.from(text).flatMap(char => {
    for (const font of faces) {
      const glyph = font.charToGlyph(char)
      if (glyph.index !== 0) return [{ font, glyph }]
    }
    return []
  })

const advance = ({ font, glyph }: Placed, size: number) =>
  ((glyph.advanceWidth ?? 0) * size) / font.unitsPerEm

const measure = (text: string, faces: opentype.Font[], size: number) =>
  place(text, faces).reduce((width, p) => width + advance(p, size), 0)

// SVG path data for `text` with its baseline starting at (x, y).
function textPath(
  text: string,
  faces: opentype.Font[],
  size: number,
  x: number,
  y: number,
) {
  let pen = x
  return place(text, faces)
    .map(p => {
      const d = p.glyph.getPath(pen, y, size).toPathData(1)
      pen += advance(p, size)
      return d
    })
    .join('')
}

/**
 * Breaks `text` into lines no wider than `maxWidth`, at spaces where it can
 * and anywhere inside a word too long for a line of its own.
 */
export function wrapLines(
  text: string,
  faces: opentype.Font[],
  size: number,
  maxWidth: number,
): string[] {
  const fits = (line: string) => measure(line, faces, size) <= maxWidth
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (fits(candidate)) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = ''
    for (const char of Array.from(word)) {
      if (line && !fits(line + char)) {
        lines.push(line)
        line = ''
      }
      line += char
    }
  }
  if (line) lines.push(line)
  return lines
}

// Cuts `text` down, with an ellipsis, until it fits `maxWidth`.
function truncate(
  text: string,
  faces: opentype.Font[],
  size: number,
  maxWidth: number,
) {
  const chars = Array.from(text)
  if (measure(text, faces, size) <= maxWidth) return text
  while (chars.length && measure(`${chars.join('')}…`, faces, size) > maxWidth)
    chars.pop()
  return `${chars.join('').trimEnd()}…`
}

const PAD_X = 90
const TEXT_WIDTH = CARD_WIDTH - 2 * PAD_X
const GARLAND_HEIGHT = 84
const TITLE_SIZES = [110, 96, 84, 72, 64]
const MAX_TITLE_LINES = 3
const TITLE_LINE_HEIGHT = 1.05
// "{inviterName} zaprasza Cię do", and its space above the title.
const WHO_SIZE = 40
const WHO_GAP = 20
// The wordmark, bottom-right.
const MARK_SIZE = 56
const MARK_RIGHT = CARD_WIDTH - 60
const MARK_BASELINE = CARD_HEIGHT - 44
// Where a line's baseline sits below its top, as a fraction of its size.
const BASELINE = 0.8

const garland = `<svg x="0" y="0" width="${CARD_WIDTH}" height="${GARLAND_HEIGHT}" viewBox="${GARLAND_VIEWBOX}" preserveAspectRatio="none">${garlandSvg()}</svg>`

const card = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">` +
  `<rect width="100%" height="100%" fill="${PAPER}"/>${garland}${content}</svg>`

// The event's card: who invites, the title in the display face, and the
// wordmark bottom-right — all in Polish, like the rest of the preview.
function inviteCardSvg(invite: LandingInvite, { display, sans }: Fonts) {
  const titleFaces = [display, sans]
  const sansFaces = [sans, display]

  // The largest size that fits the title in three lines; past the smallest,
  // the third line is cut short.
  const size =
    TITLE_SIZES.find(
      s =>
        wrapLines(invite.title, titleFaces, s, TEXT_WIDTH).length <=
        MAX_TITLE_LINES,
    ) ?? TITLE_SIZES[TITLE_SIZES.length - 1]
  let lines = wrapLines(invite.title, titleFaces, size, TEXT_WIDTH)
  if (lines.length > MAX_TITLE_LINES) {
    lines = lines.slice(0, MAX_TITLE_LINES)
    lines[MAX_TITLE_LINES - 1] = truncate(
      `${lines[MAX_TITLE_LINES - 1]}…`,
      titleFaces,
      size,
      TEXT_WIDTH,
    )
  }

  const who = truncate(
    `${invite.inviterName} zaprasza Cię do`,
    sansFaces,
    WHO_SIZE,
    TEXT_WIDTH,
  )
  const lineHeight = size * TITLE_LINE_HEIGHT

  // The block sits centred between the garland and the wordmark.
  const blockHeight = WHO_SIZE + WHO_GAP + lines.length * lineHeight
  const areaTop = GARLAND_HEIGHT + 20
  const areaBottom = MARK_BASELINE - MARK_SIZE
  const top = areaTop + Math.max(0, (areaBottom - areaTop - blockHeight) / 2)

  const whoPath = textPath(
    who,
    sansFaces,
    WHO_SIZE,
    PAD_X,
    top + WHO_SIZE * BASELINE,
  )
  const titlePaths = lines
    .map((line, i) =>
      textPath(
        line,
        titleFaces,
        size,
        PAD_X,
        top + WHO_SIZE + WHO_GAP + i * lineHeight + size * BASELINE,
      ),
    )
    .join('')
  const markX = MARK_RIGHT - measure('Prezentowo', [display], MARK_SIZE)
  const mark = textPath(
    'Prezentowo',
    [display],
    MARK_SIZE,
    markX,
    MARK_BASELINE,
  )

  return card(
    `<path d="${whoPath}" fill="${INK}" fill-opacity="0.6"/>` +
      `<path d="${titlePaths}" fill="${GREEN}"/>` +
      `<path d="${mark}" fill="${INK}"/>`,
  )
}

// For a code that opens nothing: garland, app icon and wordmark.
function brandCardSvg({ display, icon }: Fonts) {
  const iconSize = 132
  const markSize = 120
  const gap = 28
  const markWidth = measure('Prezentowo', [display], markSize)
  const left = (CARD_WIDTH - (iconSize + gap + markWidth)) / 2
  const iconTop = GARLAND_HEIGHT + (CARD_HEIGHT - GARLAND_HEIGHT - iconSize) / 2
  const mark = textPath(
    'Prezentowo',
    [display],
    markSize,
    left + iconSize + gap,
    iconTop + iconSize / 2 + markSize * 0.3,
  )
  return card(
    `<clipPath id="icon"><rect x="${left}" y="${iconTop}" width="${iconSize}" height="${iconSize}" rx="30"/></clipPath>` +
      `<image x="${left}" y="${iconTop}" width="${iconSize}" height="${iconSize}" clip-path="url(#icon)" xlink:href="data:image/png;base64,${icon.toString('base64')}"/>` +
      `<path d="${mark}" fill="${INK}"/>`,
  )
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  )

// Renders the card into the cache unless it's there already. Written under
// a temporary name and renamed, so a concurrent request never reads half a
// file.
async function cached(file: string, render: () => Promise<string>) {
  const path = join(ogCardsDir(), file)
  if (await exists(path)) return path
  const png = await sharp(Buffer.from(await render()))
    .png()
    .toBuffer()
  await mkdir(ogCardsDir(), { recursive: true })
  const partial = `${path}.${Random.id()}.tmp`
  await writeFile(partial, png)
  await rename(partial, path)
  return path
}

/**
 * The path of the 1200 × 630 PNG link-preview card for `invite`, rendered on
 * first request and cached. Null gets the static brand card.
 */
export async function ogCardFor(invite: LandingInvite | null) {
  if (!invite) {
    return cached(BRAND_CARD_FILE, async () => brandCardSvg(await loadFonts()))
  }
  return cached(cardFile(invite), async () =>
    inviteCardSvg(invite, await loadFonts()),
  )
}

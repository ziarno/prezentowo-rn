// The garland across the top of the page's card and the link-preview card.

export const GARLAND_VIEWBOX = '0 0 400 44'

const BULB_COLORS = ['#c7973d', '#9a3a25', '#2f5b3a', '#c7973d', '#9a3a25']

/** SVG content for a string of bulbs on a sagging wire, in GARLAND_VIEWBOX. */
export function garlandSvg(): string {
  const bulbs = Array.from({ length: 13 }, (_, i) => {
    const x = 20 + i * 30
    const y = 12 + Math.sin((i / 12) * Math.PI) * 14
    return (
      `<line x1="${x}" y1="${y - 2}" x2="${x}" y2="${y + 3}" stroke="#1d1a14" stroke-width="1.5"/>` +
      `<ellipse cx="${x}" cy="${y + 9}" rx="5" ry="7" fill="${BULB_COLORS[i % 5]}"/>`
    )
  }).join('')
  return `<path d="M0,8 Q200,40 400,8" fill="none" stroke="#1d1a14" stroke-width="1.5"/>${bulbs}`
}

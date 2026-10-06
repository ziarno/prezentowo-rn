// The landing pages' two languages and their copy, per "Design the web invite
// landing page" (#29) and "Web brand page at /" (#77). Shared by the server
// render and the client bundle.

export type Lang = 'en' | 'pl'

const isLang = (value: unknown): value is Lang =>
  value === 'en' || value === 'pl'

/**
 * `?lang=` when it names en or pl, else the best of the two by
 * `Accept-Language` q-values, else pl.
 */
export function pickLanguage(
  acceptLanguage: string | undefined,
  langParam: string | string[] | undefined,
): Lang {
  // A repeated `?lang=` takes its first value, as in the PL · EN links.
  const param = Array.isArray(langParam) ? langParam[0] : langParam
  if (isLang(param)) return param

  let best: { lang: Lang; q: number } | undefined
  for (const range of (acceptLanguage ?? '').split(',')) {
    const [tag, ...params] = range.trim().toLowerCase().split(';')
    const lang = tag.split('-')[0]
    if (!isLang(lang)) continue
    const qParam = params.find(p => p.trim().startsWith('q='))
    const q = qParam ? Number(qParam.trim().slice(2)) : 1
    if (!(q > 0)) continue
    if (!best || q > best.q) best = { lang, q }
  }
  return best?.lang ?? 'pl'
}

export const COPY = {
  en: {
    eyebrow: 'invited you to',
    getApp: 'Get the app to join',
    after: 'After installing, tap the invite link again to join.',
    what: 'Prezentowo is a shared gift list. Everyone adds ideas, you quietly mark what you’re buying — and the person getting the present never sees it.',
    haveApp: 'Already have Prezentowo?',
    openApp: 'Open the invite',
    bad: 'This invite link doesn’t work anymore',
    badP: 'It may have been replaced with a new one. Ask the person who sent it for a fresh link.',
    badSub: 'Prezentowo is a shared gift list for family and friends.',
    tagline: 'A shared gift list for family and friends.',
    appStore: ['Download on the', 'App Store'],
    play: ['Get it on', 'Google Play'],
  },
  pl: {
    // Present tense on purpose: "zaprosił/a" would need the inviter's gender.
    eyebrow: 'zaprasza Cię do',
    getApp: 'Pobierz aplikację, żeby dołączyć',
    after: 'Po instalacji kliknij link z zaproszeniem jeszcze raz.',
    what: 'Prezentowo to wspólna lista prezentów. Każdy dodaje pomysły, Ty po cichu zaznaczasz, co kupujesz — a obdarowany tego nie widzi.',
    haveApp: 'Masz już Prezentowo?',
    openApp: 'Otwórz zaproszenie',
    bad: 'Ten link z zaproszeniem już nie działa',
    badP: 'Mógł zostać zastąpiony nowym. Poproś osobę, która go wysłała, o aktualny link.',
    badSub: 'Prezentowo to wspólna lista prezentów dla rodziny i znajomych.',
    tagline: 'Wspólna lista prezentów dla rodziny i znajomych.',
    appStore: ['Pobierz z', 'App Store'],
    play: ['Pobierz z', 'Google Play'],
  },
} satisfies Record<Lang, Record<string, string | string[]>>

// Link previews are always Polish: crawlers don't send the reader's language.
export const OG_COPY = {
  title: (inviterName: string, title: string) =>
    `${inviterName} zaprasza Cię do: ${title}`,
  description: 'Dołącz do wspólnej listy prezentów w Prezentowo.',
  invalidTitle: 'Prezentowo',
  invalidDescription: 'Wspólna lista prezentów dla rodziny i znajomych.',
  brandTitle: 'Prezentowo',
  brandDescription: 'Wspólna lista prezentów',
}

// Spelled out rather than taken from Intl, so the server and every browser
// render the same string and hydration matches.
const WEEKDAYS: Record<Lang, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  pl: ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'],
}
const MONTHS: Record<Lang, string[]> = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  // Genitive: "24 grudnia".
  pl: [
    'stycznia',
    'lutego',
    'marca',
    'kwietnia',
    'maja',
    'czerwca',
    'lipca',
    'sierpnia',
    'września',
    'października',
    'listopada',
    'grudnia',
  ],
}

const COUNTDOWN: Record<Lang, (days: number) => string> = {
  en: days =>
    days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`,
  pl: days => (days === 0 ? 'dziś' : days === 1 ? 'jutro' : `za ${days} dni`),
}

const utcDay = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * The date chip's text for an event on `date`, seen on `today` (both
 * `YYYY-MM-DD`): "Thu, 24 December 2026 · in 88 days". A past date has no
 * countdown.
 */
export function dateChip(date: string, today: string, lang: Lang): string {
  const day = utcDay(date)
  const weekday = WEEKDAYS[lang][day.getUTCDay()]
  const month = MONTHS[lang][day.getUTCMonth()]
  const label = `${weekday}, ${day.getUTCDate()} ${month} ${day.getUTCFullYear()}`
  const days = Math.round(
    (day.getTime() - utcDay(today).getTime()) / 86_400_000,
  )
  return days < 0 ? label : `${label} · ${COUNTDOWN[lang](days)}`
}

// Today in Poland, where the audience is, as `YYYY-MM-DD`.
export const todayInWarsaw = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(now)

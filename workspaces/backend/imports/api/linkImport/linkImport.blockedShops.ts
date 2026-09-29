// Shops confirmed durably unreadable, checked before any fetch so the caller
// gets shop-named messaging. A shop belongs here only once its block is known
// to hold — which is why Zalando isn't on it.
export const BLOCKED_SHOPS = ['mediaexpert.pl', 'allegro.pl'] as const

/** The blocked shop `hostname` belongs to (itself or a subdomain), if any. */
export const matchBlockedShop = (hostname: string) =>
  BLOCKED_SHOPS.find(shop => hostname === shop || hostname.endsWith(`.${shop}`))

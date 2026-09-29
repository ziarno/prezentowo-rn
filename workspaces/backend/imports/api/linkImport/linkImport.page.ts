import type { ImportedFields } from '@prezentowo/types'
import ogs from 'open-graph-scraper'

type JsonLdNode = Record<string, unknown>

// og:type values that mean "one product" — not `product.group`, which is
// what category pages use.
const PRODUCT_OG_TYPES = ['product', 'product.item', 'og:product']

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1].toLowerCase() === 'x'
          ? parseInt(name.slice(2), 16)
          : parseInt(name.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
    }
    return ENTITIES[name.toLowerCase()] ?? entity
  })

// JSON-LD text is often HTML: strip tags and entities, collapse whitespace.
const cleanText = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const text = decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  return text || undefined
}

const toHttpUrl = (value: unknown, base: URL) => {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value.trim(), base)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

// Every node in the page's JSON-LD blocks, including those nested in arrays
// and `@graph`.
const jsonLdNodes = (value: unknown): JsonLdNode[] => {
  if (Array.isArray(value)) return value.flatMap(jsonLdNodes)
  if (!value || typeof value !== 'object') return []
  const node = value as JsonLdNode
  return [node, ...jsonLdNodes(node['@graph'])]
}

const isProduct = (node: JsonLdNode) => {
  const type = node['@type']
  return Array.isArray(type) ? type.includes('Product') : type === 'Product'
}

// schema.org `image` is a URL, an ImageObject, or a list of either.
const firstImage = (image: unknown): unknown => {
  if (Array.isArray(image)) return firstImage(image[0])
  if (image && typeof image === 'object') {
    const object = image as JsonLdNode
    return object.url ?? object.contentUrl
  }
  return image
}

/**
 * Reads a shop page's product fields, JSON-LD `Product` winning over Open
 * Graph field by field. Resolves `undefined` when the page carries no product
 * data at all: no JSON-LD `Product` and no product og:type.
 */
export async function readProductPage(
  html: string,
  pageUrl: URL,
  pastedUrl: string,
): Promise<ImportedFields | undefined> {
  let og: Awaited<ReturnType<typeof ogs>>['result']
  try {
    og = (await ogs({ html })).result
  } catch {
    // ogs rejects a page it can't parse at all, such as an empty body.
    return undefined
  }

  const product = jsonLdNodes(og.jsonLD).find(isProduct)
  if (!product && !PRODUCT_OG_TYPES.includes(og.ogType ?? '')) {
    return undefined
  }

  const title = cleanText(product?.name) ?? cleanText(og.ogTitle)
  const description =
    cleanText(product?.description) ?? cleanText(og.ogDescription)
  const imageUrl =
    toHttpUrl(firstImage(product?.image), pageUrl) ??
    toHttpUrl(og.ogImage?.[0]?.url, pageUrl)
  const url =
    toHttpUrl(product?.url, pageUrl) ??
    toHttpUrl(og.ogUrl, pageUrl) ??
    pastedUrl

  const missing: ImportedFields['missing'] = []
  if (!title) missing.push('title')
  if (!description) missing.push('description')
  if (!imageUrl) missing.push('image')

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    url,
    ...(imageUrl ? { imageUrl } : {}),
    missing,
  }
}

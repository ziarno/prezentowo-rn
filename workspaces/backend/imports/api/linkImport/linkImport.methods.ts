import type { LinkImportOutcome } from '@prezentowo/types'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { matchBlockedShop } from './linkImport.blockedShops'
import {
  type LinkImportProvider,
  selfHostedProvider,
} from './linkImport.provider'

const provider: LinkImportProvider = selfHostedProvider

// A pasted link without a scheme ("x-kom.pl/p/…") is taken as https.
const parseShopUrl = (pasted: string) => {
  const trimmed = pasted.trim()
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url
  } catch {
    // Falls through to the error below.
  }
  throw new Meteor.Error('invalidArgs', 'invalidUrl')
}

// Domain and outcome class only: never the URL (it can identify the present
// or the user) and never the user.
const logOutcome = (domain: string, result: LinkImportOutcome) =>
  console.info('linkImport', domain, result.outcome)

const errorName = (error: unknown) =>
  error instanceof Error ? error.name : typeof error

const importLink = async function (
  this: Meteor.MethodThisType,
  options: { url: string },
): Promise<LinkImportOutcome> {
  check(options, Match.ObjectIncluding({ url: String }))

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const url = parseShopUrl(options.url)
  const domain = url.hostname.replace(/\.$/, '')

  const blockedShop = matchBlockedShop(domain)
  if (blockedShop) {
    const result: LinkImportOutcome = { outcome: 'unreadable', blockedShop }
    logOutcome(domain, result)
    return result
  }

  let result: LinkImportOutcome
  try {
    result = await provider.importLink(url)
  } catch (error) {
    // A provider bug must still not surface as a thrown shop-side failure.
    // Only the error's class is logged: its message can carry the URL.
    console.error('linkImport', domain, 'provider failed', errorName(error))
    result = { outcome: 'infra-failure' }
  }
  logOutcome(domain, result)
  return result
}

Meteor.methods({
  'gifts.importLink': importLink,
})

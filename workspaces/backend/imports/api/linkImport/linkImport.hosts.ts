import { type LookupAddress, type LookupAllOptions, promises as dns } from 'dns'
import { BlockList, type LookupFunction, isIP } from 'net'

// Loopback, private, link-local (cloud metadata), CGNAT and reserved ranges.
const privateRanges = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 3],
] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
  ['::', 127],
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv6')
}

const isPrivateAddress = (address: string, family: number) =>
  privateRanges.check(address, family === 6 ? 'ipv6' : 'ipv4')

// Hosts a shop link can't legitimately point at, judged from the URL alone:
// private literal addresses and single-label names. A public name resolving
// to a private address is caught at connect time by `guardedLookup`.
export const isPrivateHost = (hostname: string) => {
  const address = hostname.replace(/^\[|\]$/g, '')
  const version = isIP(address)
  if (version) return isPrivateAddress(address, version)
  return (
    !hostname.includes('.') ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost')
  )
}

/** A shop host resolved to a private address. Carries neither host nor address. */
export class PrivateAddressError extends Error {
  name = 'PrivateAddressError'
  code = 'EPRIVATEADDRESS'
  constructor() {
    super('Host resolves to a private address')
  }
}

export type Resolver = (
  hostname: string,
  options: LookupAllOptions,
) => Promise<LookupAddress[]>

const systemResolver: Resolver = (hostname, options) =>
  dns.lookup(hostname, options)

/**
 * A `net` lookup that resolves every address of the host and fails with
 * `PrivateAddressError` if any is private, so the address the socket
 * connects to is the one that was checked. DNS errors pass through as-is.
 */
export const guardedLookup =
  (resolve: Resolver = systemResolver): LookupFunction =>
  (hostname, options, callback) => {
    resolve(hostname, { ...options, all: true }).then(
      addresses => {
        if (
          !addresses.length ||
          addresses.some(({ address, family }) =>
            isPrivateAddress(address, family),
          )
        ) {
          callback(new PrivateAddressError(), '', 0)
        } else if (options.all) {
          callback(null, addresses)
        } else {
          callback(null, addresses[0].address, addresses[0].family)
        }
      },
      (error: NodeJS.ErrnoException) => callback(error, '', 0),
    )
  }

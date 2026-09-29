import { BlockList, isIP } from 'net'

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

// Hosts a shop link can't legitimately point at. A literal-address and
// single-label check only: a public name resolving to a private address
// still gets through.
export const isPrivateHost = (hostname: string) => {
  const address = hostname.replace(/^\[|\]$/g, '')
  const version = isIP(address)
  if (version) {
    return privateRanges.check(address, version === 6 ? 'ipv6' : 'ipv4')
  }
  return (
    !hostname.includes('.') ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost')
  )
}

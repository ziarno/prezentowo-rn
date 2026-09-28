// - `timeout`: no result within the call's timeout. It may or may not have
//   reached the server.
// - `disconnected`: the call was sent, then the connection dropped before its
//   result came back. It may have run on the server.
export type NetworkErrorKind = 'timeout' | 'disconnected'

export class NetworkError extends Error {
  readonly kind: NetworkErrorKind
  readonly method: string

  constructor(kind: NetworkErrorKind, method: string) {
    super(
      kind === 'timeout'
        ? `${method}: no result before the timeout`
        : `${method}: connection lost before the result arrived`,
    )
    this.name = 'NetworkError'
    this.kind = kind
    this.method = method
  }
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError
}

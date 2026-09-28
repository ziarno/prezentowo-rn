// Node 25 exposes a `localStorage` global whose getter throws unless
// `--localstorage-file` is set, and jest-environment-node 29 reads every
// global while building the sandbox. No test uses Web Storage, so drop it.
delete globalThis.localStorage

module.exports = require('jest-environment-node').TestEnvironment

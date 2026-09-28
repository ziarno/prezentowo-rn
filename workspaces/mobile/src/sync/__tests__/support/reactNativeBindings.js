// Stand-in for @meteorrn/core/helpers/reactNativeBindings.js under Node: the
// same fallbacks the library itself uses when react-native isn't resolvable.
const batchedUpdates = cb => cb()
const runAfterInteractions = fn => setTimeout(() => fn(), 50)

module.exports = { batchedUpdates, runAfterInteractions }

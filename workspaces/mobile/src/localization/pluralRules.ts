// Hermes has no Intl.PluralRules, without which i18next picks `_other` for
// every count. `polyfill-force` skips the slow detection on Android.
//
// `require`, not `import`: the import sorter would hoist the locale data above
// the polyfill, and each file silently skips registering when it isn't there.
/* eslint-disable @typescript-eslint/no-require-imports */
require('@formatjs/intl-pluralrules/polyfill-force.js')
require('@formatjs/intl-pluralrules/locale-data/en.js')
require('@formatjs/intl-pluralrules/locale-data/pl.js')

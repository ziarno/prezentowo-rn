import type { LinguiConfig } from '@lingui/conf'

const config: LinguiConfig = {
  sourceLocale: 'en',
  locales: ['en', 'pl'],
  catalogs: [
    {
      path: '<rootDir>/src/localization/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: ['**/src/localization/locales/**'],
    },
  ],
}

export default config

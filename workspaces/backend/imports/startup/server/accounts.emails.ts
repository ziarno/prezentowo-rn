import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'

const passwordless = Meteor.settings.accounts?.passwordless ?? {}

const FROM: string = passwordless.from ?? 'no-reply@example.com'
const APP_NAME: string = passwordless.appName ?? 'Prezentowo'
const SCHEME: string = passwordless.magicLinkScheme ?? 'prezentowo://'
const PATH: string = passwordless.magicLinkPath ?? 'magic-link'

function buildMagicLink(email: string, sequence: string) {
  const params = new URLSearchParams({ email, token: sequence })
  const base = SCHEME.endsWith('/') ? SCHEME : `${SCHEME}/`
  return `${base}${PATH}?${params.toString()}`
}

Accounts.emailTemplates.from = FROM
Accounts.emailTemplates.siteName = APP_NAME

type SendLoginTokenUser = { emails?: { address: string }[] }
type SendLoginTokenTemplate = {
  subject: () => string
  text: (
    user: SendLoginTokenUser,
    url: string,
    extra: { sequence: string },
  ) => string
}

// accounts-passwordless adds `sendLoginToken`, but @types/meteor doesn't know
// about it.
;(
  Accounts.emailTemplates as unknown as {
    sendLoginToken: SendLoginTokenTemplate
  }
).sendLoginToken = {
  subject: () => `Your ${APP_NAME} sign-in code`,
  text: (
    user: SendLoginTokenUser,
    _url: string,
    extra: { sequence: string },
  ) => {
    const email = user.emails?.[0]?.address ?? ''
    const link = buildMagicLink(email, extra.sequence)
    return [
      `Hi,`,
      ``,
      `Your sign-in code is: ${extra.sequence}`,
      ``,
      `Or tap this link on the device where you started signing in:`,
      link,
      ``,
      `This code expires in 1 hour. If you didn't request it, you can ignore this email.`,
      ``,
      `— ${APP_NAME}`,
    ].join('\n')
  },
}

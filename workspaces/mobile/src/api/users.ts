import Meteor from '@meteorrn/core'

export type CurrentUser = {
  _id: string
  createdAt?: Date | string
  emails?: { address: string; verified: boolean }[]
  profile?: { name?: string }
}

export function getCurrentUser(): CurrentUser | undefined {
  return Meteor.user() as CurrentUser | undefined
}

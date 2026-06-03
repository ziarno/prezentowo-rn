import Meteor, { type MeteorError } from '@meteorrn/core'
import type { UpdateUserArgs } from '@prezentowo/types'

export type CurrentUser = {
  _id: string
  createdAt?: Date | string
  emails?: { address: string; verified: boolean }[]
  profile?: { name?: string; avatar?: string }
}

export function getCurrentUser(): CurrentUser | undefined {
  return Meteor.user() as CurrentUser | undefined
}

export function updateUser(args: UpdateUserArgs): Promise<void> {
  return new Promise((resolve, reject) => {
    Meteor.call('updateUser', args, (err: MeteorError | undefined) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

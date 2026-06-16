export type RegisterNewUserArgs = {
  email: string
  password: string
  name: string
}

export type UpdateUserArgs = {
  name?: string
  email?: string
  avatar?: string
}

export type LoginCredentials = {
  id: string
  token: string
}

export type RequestMagicLinkArgs = {
  email: string
}

export type EventParticipantInput =
  | { kind: 'real'; userId: string }
  | { kind: 'placeholder'; name: string; color: string; avatar?: string }

export type EventParticipant =
  | { id: string; kind: 'real'; userId: string }
  | {
      id: string
      kind: 'placeholder'
      name: string
      color: string
      avatar?: string
    }

export type CreateEventArgs = {
  title: string
  date: string
  participants: EventParticipantInput[]
}

export type EventDoc = {
  _id: string
  title: string
  date: string
  ownerId: string
  participants: EventParticipant[]
  createdAt: Date
}

export type GiftDoc = {
  _id: string
  eventId: string
  // The participant (by EventParticipant.id) this gift is intended for.
  forParticipantId: string
  title: string
  description?: string
  price?: string
  url?: string
  // Present illustration key, e.g. "p3".
  image?: string
  // userIds who have reserved this gift. Hidden from the recipient by the
  // gifts.byEvent publication — "claim quietly".
  claimedBy: string[]
  createdBy: string
  createdAt: Date
}

export type AddGiftArgs = {
  eventId: string
  forParticipantId: string
  title: string
  description?: string
  price?: string
  url?: string
  image?: string
}

export type UpdateGiftArgs = {
  giftId: string
  title?: string
  description?: string
  price?: string
  url?: string
  image?: string
}

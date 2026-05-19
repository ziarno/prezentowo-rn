export type RegisterNewUserArgs = {
  email: string
  password: string
  name: string
}

export type UpdateUserArgs = {
  userId: string
  name?: string
  email?: string
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
  | { kind: 'placeholder'; name: string; color: string }

export type EventParticipant =
  | { id: string; kind: 'real'; userId: string }
  | { id: string; kind: 'placeholder'; name: string; color: string }

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

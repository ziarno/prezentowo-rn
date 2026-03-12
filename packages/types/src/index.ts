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

import { create } from 'zustand'

type AuthState = {
  userToken: string | null
}

type AuthActions = {
  setUserToken: (token: AuthState['userToken']) => void
}

export const useAuthStore = create<AuthState & AuthActions>()(set => ({
  userToken: null,
  setUserToken: (userToken: AuthState['userToken']) => set({ userToken }),
}))

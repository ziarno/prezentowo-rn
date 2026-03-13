import { create } from 'zustand'

type AuthState = {
  isLoading: boolean
  userToken: string | null
}

type AuthActions = {
  setLoading: (isLoading: AuthState['isLoading']) => void
  setUserToken: (token: AuthState['userToken']) => void
}

export const useAuthStore = create<AuthState & AuthActions>()(set => ({
  isLoading: true,
  userToken: null,
  setLoading: (isLoading: boolean) => set({ isLoading }),
  setUserToken: (userToken: AuthState['userToken']) => set({ userToken }),
}))

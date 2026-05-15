import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'

const ONBOARDING_KEY = 'prezentowo.onboardingCompleted'

type AuthState = {
  userToken: string | null
  // null until secure-store has been read, then true/false
  hasCompletedOnboarding: boolean | null
  // user just opened a magic link and still needs to set name + avatar
  firstLoginPending: boolean
  // email captured on the sign-in screen, displayed on "check your email"
  pendingEmail: string | null
}

type AuthActions = {
  setUserToken: (token: AuthState['userToken']) => void
  setPendingEmail: (email: AuthState['pendingEmail']) => void
  setFirstLoginPending: (pending: boolean) => void
  completeOnboarding: () => Promise<void>
  loadPersistedState: () => Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>()(set => ({
  userToken: null,
  hasCompletedOnboarding: null,
  firstLoginPending: false,
  pendingEmail: null,

  setUserToken: userToken => set({ userToken }),
  setPendingEmail: pendingEmail => set({ pendingEmail }),
  setFirstLoginPending: firstLoginPending => set({ firstLoginPending }),

  completeOnboarding: async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, '1')
    set({ hasCompletedOnboarding: true })
  },

  loadPersistedState: async () => {
    const value = await SecureStore.getItemAsync(ONBOARDING_KEY)
    set({ hasCompletedOnboarding: value === '1' })
  },
}))

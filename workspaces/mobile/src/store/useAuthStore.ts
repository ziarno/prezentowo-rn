import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'

const ONBOARDING_KEY = 'prezentowo.onboardingCompleted'

type AuthState = {
  // null until secure-store has been read, then true/false
  hasCompletedOnboarding: boolean | null
  // email captured on the sign-in screen, displayed on "check your email"
  pendingEmail: string | null
  // Someone answered "under 13" at first login: the account is gone and a
  // stop message stays up until they tap Back (docs/spec.md §1.15). Memory
  // only: nothing about it is kept.
  underAge: boolean
}

type AuthActions = {
  setPendingEmail: (email: AuthState['pendingEmail']) => void
  setUnderAge: (underAge: boolean) => void
  completeOnboarding: () => Promise<void>
  loadPersistedState: () => Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>()(set => ({
  hasCompletedOnboarding: null,
  pendingEmail: null,
  underAge: false,

  setPendingEmail: pendingEmail => set({ pendingEmail }),
  setUnderAge: underAge => set({ underAge }),

  completeOnboarding: async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, '1')
    set({ hasCompletedOnboarding: true })
  },

  loadPersistedState: async () => {
    const value = await SecureStore.getItemAsync(ONBOARDING_KEY)
    set({ hasCompletedOnboarding: value === '1' })
  },
}))

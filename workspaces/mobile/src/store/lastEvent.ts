import * as SecureStore from 'expo-secure-store'

const KEY = 'prezentowo.lastEvent'

// The event whose sections were open when the app was last left, so a cold
// start reopens it; none means the app was left outside an event (Home, or
// signed out), and the app starts on Home.

// What was stored when the app launched: undefined until read, then taken
// once.
let atLaunch: string | null | undefined
// Writes go one after another, so leaving one event for another can't land
// the clear after the new one.
let writing: Promise<unknown> = Promise.resolve()

export async function loadLastEvent() {
  atLaunch = await SecureStore.getItemAsync(KEY).catch(() => null)
}

// The event to reopen at launch, once.
export function takeLastEvent(): string | null {
  const eventId = atLaunch ?? null
  atLaunch = null
  return eventId
}

export function rememberLastEvent(eventId: string | null) {
  writing = writing
    .then(() =>
      eventId
        ? SecureStore.setItemAsync(KEY, eventId)
        : SecureStore.deleteItemAsync(KEY),
    )
    .catch(() => {})
}

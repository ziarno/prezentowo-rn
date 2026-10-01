import { hydrateRoot } from 'react-dom/client'

import {
  InviteLanding,
  type LandingProps,
  PROPS_ID,
  TARGET_ID,
} from './InviteLanding'

/**
 * Hydrates the page the server rendered for `/e/:code`, with the props it
 * rendered it from. Any other page has none, and is left alone.
 */
export function hydrateLanding() {
  const props = document.getElementById(PROPS_ID)?.textContent
  const target = document.getElementById(TARGET_ID)
  if (!props || !target) return
  hydrateRoot(
    target,
    <InviteLanding {...(JSON.parse(props) as LandingProps)} />,
  )
}

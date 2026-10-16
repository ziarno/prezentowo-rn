import type { PresentThemeId } from '@prezentowo/types'

import { Confetti } from './Confetti'
import { Polaroid } from './Polaroid'
import { PopArt } from './PopArt'
import { Rays } from './Rays'
import { Snowfall } from './Snowfall'
import { Sticker } from './Sticker'
import { Torn } from './Torn'
import { Wrapped } from './Wrapped'
import { StillContext, type ThemeProps } from './shared'

const THEMES: Record<PresentThemeId, (props: ThemeProps) => React.ReactNode> = {
  polaroid: Polaroid,
  rays: Rays,
  wrapped: Wrapped,
  confetti: Confetti,
  snowfall: Snowfall,
  torn: Torn,
  popArt: PopArt,
  sticker: Sticker,
}

/**
 * `1e`'s picture, staged by the present's theme over the gift tag tone,
 * edge to edge behind the details. `still` draws it without motion, for the
 * theme picker's thumbnails.
 */
export function PresentHero({
  theme,
  still = false,
  ...props
}: ThemeProps & { theme: PresentThemeId; still?: boolean }) {
  const Theme = THEMES[theme]
  return (
    <StillContext.Provider value={still}>
      <Theme {...props} />
    </StillContext.Provider>
  )
}

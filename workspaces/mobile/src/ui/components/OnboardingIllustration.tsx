import { LocalSvg } from 'react-native-svg/css'

import claimAsset from '@/assets/svg/onboarding-claim.svg'
import introAsset from '@/assets/svg/onboarding-intro.svg'
import wishlistAsset from '@/assets/svg/onboarding-wishlist.svg'

type Kind = 'intro' | 'wishlist' | 'claim'

type Props = {
  kind: Kind
}

const illustrationAssets = {
  intro: introAsset,
  wishlist: wishlistAsset,
  claim: claimAsset,
} as const

export function OnboardingIllustration({ kind }: Props) {
  return <LocalSvg asset={illustrationAssets[kind]} width={220} height={200} />
}

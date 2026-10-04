import { View } from 'react-native'

import type { ActivityLine } from '@/api/activityFeed'
import {
  CheckIcon,
  GiftIcon,
  LightbulbIcon,
  PersonPlusIcon,
  UndoIcon,
} from '@/components/ui/icon'
import { garland } from '@/constants/colors'

// What each kind of activity item looks like. Keyed by the line's kind, not
// the stored one: a self-added present and a suggestion are both `gift-added`
// but read differently. Decorative throughout: the sentence beside it already
// says what happened.
const ACTIVITY_ICON: Record<
  ActivityLine['kind'],
  { Icon: typeof CheckIcon; color: string }
> = {
  joined: { Icon: PersonPlusIcon, color: garland.green },
  'self-added': { Icon: GiftIcon, color: garland.amber },
  suggested: { Icon: LightbulbIcon, color: garland.amber },
  claimed: { Icon: CheckIcon, color: garland.green },
  unclaimed: { Icon: UndoIcon, color: garland.berry },
}

// Home's (`3a`) compact lines: the glyph alone, in its colour.
export function ActivityKindIcon({
  kind,
  size,
}: {
  kind: ActivityLine['kind']
  size: number
}) {
  const { Icon, color } = ACTIVITY_ICON[kind]
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Icon width={size} height={size} color={color} />
    </View>
  )
}

// The feed's (`3c`) badge, pinned to the bottom-right of the actor's avatar:
// the glyph in paper on a disc of its colour, ringed in paper so it lifts off
// the avatar.
export function ActivityKindBadge({ kind }: { kind: ActivityLine['kind'] }) {
  const { Icon, color } = ACTIVITY_ICON[kind]
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className="absolute -bottom-1 -right-1 size-[18px] items-center justify-center rounded-full border-2 border-garland-paper"
      style={{ backgroundColor: color }}
    >
      <Icon width={10} height={10} color={garland.paper} />
    </View>
  )
}

import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { BellIcon, ChatIcon, GiftIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'

export type EventTab = 'home' | 'chat' | 'activity'

type TabDef = {
  id: EventTab
  labelKey: string
  Icon: typeof GiftIcon
}

const TABS: TabDef[] = [
  { id: 'home', labelKey: 'eventDetail.tabEvent', Icon: GiftIcon },
  { id: 'chat', labelKey: 'eventDetail.tabChat', Icon: ChatIcon },
  { id: 'activity', labelKey: 'eventDetail.tabActivity', Icon: BellIcon },
]

// Bottom tab bar shared by the event-scoped screens. Chat and Activity are
// shown for layout fidelity but aren't wired up yet — only the active Event
// tab is meaningful here.
export function EventTabs({ active = 'home' }: { active?: EventTab }) {
  const { t } = useTranslation()
  return (
    <View className="flex-row border-t border-garland-ink-08 bg-garland-paper px-1.5 pb-1.5 pt-1">
      {TABS.map(tab => {
        const isActive = tab.id === active
        const color = isActive ? garland.ink : garland.ink40
        const Icon = tab.Icon
        return (
          <View
            key={tab.id}
            className="flex-1 items-center gap-[3px] pb-1 pt-2"
          >
            {isActive ? (
              <View className="absolute top-0 h-0.5 w-7 rounded-full bg-garland-green" />
            ) : null}
            <View>
              <Icon width={22} height={22} color={color} />
              {tab.id === 'activity' && !isActive ? (
                <View className="absolute -right-0.5 -top-px size-[7px] rounded-full border-[1.5px] border-garland-paper bg-garland-berry" />
              ) : null}
            </View>
            <Text
              className="text-[10px] font-bold uppercase"
              style={{ color, letterSpacing: 0.8 }}
            >
              {t(tab.labelKey)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

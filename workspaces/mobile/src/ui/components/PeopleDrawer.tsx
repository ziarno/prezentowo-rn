import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'

import { CloseIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { ParticipantRow } from '@/ui/components/ParticipantRow'

export type PersonItem = {
  id: string
  name: string
  avatarKey?: string
  color?: string
  isYou: boolean
  subtitle: string
}

type PeopleDrawerProps = {
  eventTitle: string
  people: PersonItem[]
  onClose: () => void
  onInvite: () => void
  onSelectPerson: (id: string) => void
}

// Slides in from the left over the event detail, listing every participant.
// Tapping a person opens their wishlist.
export function PeopleDrawer({
  eventTitle,
  people,
  onClose,
  onInvite,
  onSelectPerson,
}: PeopleDrawerProps) {
  const { t } = useTranslation()
  return (
    <View className="absolute inset-0 z-20">
      <Pressable className="absolute inset-0 bg-black/35" onPress={onClose} />
      <View
        className="absolute bottom-0 left-0 top-0 bg-garland-paper"
        style={{
          width: '82%',
          shadowColor: '#000',
          shadowOffset: { width: 20, height: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 30,
          elevation: 16,
        }}
      >
        <View className="flex-row items-center justify-between px-[22px] pt-3.5">
          <Pressable onPress={onClose} hitSlop={12}>
            <CloseIcon width={20} height={20} color={garland.ink60} />
          </Pressable>
          <Pressable
            onPress={onInvite}
            hitSlop={12}
            className="active:opacity-60"
          >
            <Text className="text-[13px] text-garland-ink-60">
              {t('eventDetail.invite')}
            </Text>
          </Pressable>
        </View>

        <View className="px-[22px] pb-4 pt-3.5">
          <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
            {eventTitle}
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {people.map(p => (
            <ParticipantRow
              key={p.id}
              name={p.name}
              avatarKey={p.avatarKey}
              color={p.color}
              subtitle={p.subtitle}
              isYou={p.isYou}
              youLabel={t('eventDetail.you')}
              onPress={() => onSelectPerson(p.id)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

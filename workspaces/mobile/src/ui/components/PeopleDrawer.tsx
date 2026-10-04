import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { ParticipantRow } from '@/ui/components/ParticipantRow'

export type PersonItem = {
  id: string
  name: string
  avatarKey?: string
  photo?: string
  color?: string
  isYou: boolean
  subtitle?: string
  presentCount?: number
}

type PeopleDrawerProps = {
  people: PersonItem[]
  onSelectPerson: (id: string) => void
}

// The event's participants, as the people section of the event drawer
// (`3d`/`3d2`). Tapping a person opens their presents.
export function PeopleDrawer({ people, onSelectPerson }: PeopleDrawerProps) {
  const { t } = useTranslation()
  return (
    <View>
      {people.map(p => (
        <ParticipantRow
          key={p.id}
          name={p.name}
          avatarKey={p.avatarKey}
          photo={p.photo}
          color={p.color}
          subtitle={p.subtitle}
          presentCount={p.presentCount}
          isYou={p.isYou}
          youLabel={t('shell.you')}
          onPress={() => onSelectPerson(p.id)}
        />
      ))}
    </View>
  )
}

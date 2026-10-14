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
  // The person whose list is on screen.
  selectedId?: string
}

// The event's participants, as the people section of the event drawer
// (`3d`/`3d2`). Tapping a person opens their presents.
export function PeopleDrawer({
  people,
  onSelectPerson,
  selectedId,
}: PeopleDrawerProps) {
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
          selected={p.id === selectedId}
          onPress={() => onSelectPerson(p.id)}
        />
      ))}
    </View>
  )
}

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
  // False for someone whose list the viewer can't open.
  canOpen?: boolean
}

type PeopleDrawerProps = {
  people: PersonItem[]
  onSelectPerson: (id: string) => void
  // The person whose list is on screen.
  selectedId?: string
}

// The event's participants, as the people section of the event drawer
// (`3d`/`3d2`). Tapping a person opens their presents, where they can be.
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
          onPress={p.canOpen === false ? undefined : () => onSelectPerson(p.id)}
        />
      ))}
    </View>
  )
}

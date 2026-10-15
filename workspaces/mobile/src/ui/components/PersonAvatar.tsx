import type { ResolvedParticipant } from '@/api/participants'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'

// A resolved participant's avatar; a blank initial circle for someone who
// isn't (or is no longer) in the event.
export function PersonAvatar({
  person,
  size,
}: {
  person: ResolvedParticipant | undefined
  size?: number
}) {
  return (
    <ParticipantAvatar
      name={person?.name ?? ''}
      avatarKey={person?.avatarKey}
      photo={person?.photo}
      color={person?.color}
      size={size}
    />
  )
}

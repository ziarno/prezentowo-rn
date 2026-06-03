import { useTranslation } from 'react-i18next'

import type { AvatarGender } from '@/constants/avatars'
import { SelectHorizontal } from '@/ui/components/SelectHorizontal'

const GENDERS: readonly AvatarGender[] = ['female', 'male']

type Props = {
  gender: AvatarGender
  onChange: (gender: AvatarGender) => void
}

export function GenderToggle({ gender, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <SelectHorizontal
      options={GENDERS.map(value => ({
        value,
        label: t(`avatarPicker.${value}`),
      }))}
      value={gender}
      onChange={onChange}
    />
  )
}

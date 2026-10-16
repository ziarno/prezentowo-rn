import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import {
  BackIcon,
  CheckIcon,
  ChevronIcon,
  PlusIcon,
} from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'

// The chrome the create-event (`4a`–`4e`) and add-present (`5a`–`5d`)
// wizards share: a step progress bar, the step heading, and Back / Next.

export function WizardProgress({
  index,
  count,
}: {
  index: number
  count: number
}) {
  const { t } = useTranslation()
  return (
    <View className="px-[22px] pb-4">
      <View
        className="flex-row gap-1.5"
        accessibilityRole="progressbar"
        accessibilityLabel={t('wizard.stepOf', {
          step: index + 1,
          count,
        })}
      >
        {Array.from({ length: count }, (_, i) => (
          <View
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i <= index ? 'bg-garland-ink' : 'bg-garland-ink-15'
            }`}
          />
        ))}
      </View>
      <Text className="mt-2 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
        {t('wizard.stepOf', { step: index + 1, count })}
      </Text>
    </View>
  )
}

export function StepHeading({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-[22px] mt-1.5 font-garland-display text-[28px] leading-[31px] text-garland-ink">
      {children}
    </Text>
  )
}

// What the primary button does: `forward` to the next step (its arrow
// trails the label), or `add` / `save` on the last one.
export type WizardPrimaryIcon = 'forward' | 'add' | 'save'

const ICON_SIZE = 18

export function WizardFooter({
  primaryLabel,
  primaryIcon,
  onPrimary,
  onBack,
  submitting,
  disabled = false,
}: {
  primaryLabel: string
  primaryIcon: WizardPrimaryIcon
  onPrimary: () => void
  // Omitted on the first step.
  onBack?: () => void
  submitting: boolean
  // Busy elsewhere on the step, e.g. `5a`'s link import.
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <View className="flex-row gap-3 border-t border-garland-ink-08 px-[22px] pb-2 pt-3">
      {/* Wrapped so both halves are equal: the button's own padding
          skews flex-1 on the button itself. */}
      {onBack ? (
        <View className="flex-1">
          <GarlandButton
            variant="outline"
            onPress={onBack}
            disabled={submitting || disabled}
            className="gap-1.5"
          >
            <BackIcon
              width={ICON_SIZE}
              height={ICON_SIZE}
              color={garland.ink}
            />
            <GarlandButtonText>{t('wizard.back')}</GarlandButtonText>
          </GarlandButton>
        </View>
      ) : null}
      <View className="flex-1">
        <GarlandButton
          onPress={onPrimary}
          loading={submitting}
          disabled={disabled}
          className="gap-1.5"
        >
          {primaryIcon === 'add' ? (
            <PlusIcon
              width={ICON_SIZE}
              height={ICON_SIZE}
              color={garland.paper}
            />
          ) : primaryIcon === 'save' ? (
            <CheckIcon
              width={ICON_SIZE}
              height={ICON_SIZE}
              color={garland.paper}
            />
          ) : null}
          <GarlandButtonText>{primaryLabel}</GarlandButtonText>
          {primaryIcon === 'forward' ? (
            <ChevronIcon
              width={ICON_SIZE}
              height={ICON_SIZE}
              color={garland.paper}
            />
          ) : null}
        </GarlandButton>
      </View>
    </View>
  )
}

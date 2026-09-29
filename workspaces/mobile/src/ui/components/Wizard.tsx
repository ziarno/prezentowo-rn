import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Text } from '@/components/ui/text'
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

export function WizardFooter({
  primaryLabel,
  onPrimary,
  onBack,
  submitting,
}: {
  primaryLabel: string
  onPrimary: () => void
  // Omitted on the first step.
  onBack?: () => void
  submitting: boolean
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
            disabled={submitting}
          >
            <GarlandButtonText>{t('wizard.back')}</GarlandButtonText>
          </GarlandButton>
        </View>
      ) : null}
      <View className="flex-1">
        <GarlandButton onPress={onPrimary} loading={submitting}>
          <GarlandButtonText>{primaryLabel}</GarlandButtonText>
        </GarlandButton>
      </View>
    </View>
  )
}

import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, Platform, Pressable, View } from 'react-native'

import { parseEventDate, toEventDate } from '@/api/eventList'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { formatEventDate } from '@/localization/eventDates'

const IOS = Platform.OS === 'ios'

// A `YYYY-MM-DD` day picked natively, styled like `GarlandField`. Android
// opens the system dialog; iOS unfolds a spinner under the field, the one
// iOS display that honours the app language.
export function DateField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (date: string) => void
}) {
  const { t, i18n } = useTranslation()
  const [spinnerOpen, setSpinnerOpen] = useState(false)
  const picked = parseEventDate(value)
  const shown = picked ? formatEventDate(i18n.language, value) : undefined
  // Where the picker opens: the current date in edit mode, else today.
  const initial = picked ?? new Date()
  const pick = (_event: unknown, date: Date) => onChange(toEventDate(date))

  const openPicker = () => {
    Keyboard.dismiss()
    if (IOS) setSpinnerOpen(!spinnerOpen)
    else
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        onValueChange: pick,
      })
  }

  // The spinner only reports a change, so keeping the day it opened on
  // (today, before any pick) takes an explicit Done.
  const done = () => {
    onChange(toEventDate(initial))
    setSpinnerOpen(false)
  }

  return (
    <View className="mb-3.5 border-b border-garland-ink-08 pb-3.5">
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: shown ?? placeholder }}
        accessibilityState={IOS ? { expanded: spinnerOpen } : undefined}
      >
        <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
          {label}
        </Text>
        <Text
          className={`mt-1.5 text-[15px] leading-[18px] ${
            shown ? 'text-garland-ink' : 'text-garland-ink-40'
          }`}
        >
          {shown ?? placeholder}
        </Text>
      </Pressable>
      {IOS && spinnerOpen ? (
        <>
          <DateTimePicker
            value={initial}
            mode="date"
            display="spinner"
            locale={i18n.language}
            themeVariant="light"
            textColor={garland.ink}
            onValueChange={pick}
          />
          <Pressable
            onPress={done}
            accessibilityRole="button"
            className="self-end px-1 py-1.5 active:opacity-60"
          >
            <Text className="text-[15px] font-bold text-garland-berry">
              {t('createEvent.details.dateDone')}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  )
}

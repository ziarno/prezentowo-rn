import { TextInput, type TextInputProps, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'

type GarlandFieldProps = TextInputProps & {
  label: string
  errorMessage?: string
  // A quiet line under the input, shown when there's no error.
  note?: string
}

export function GarlandField({
  label,
  errorMessage,
  note,
  style,
  ...inputProps
}: GarlandFieldProps) {
  const invalid = !!errorMessage
  return (
    <View
      className={`mb-3.5 border-b pb-3.5 ${
        invalid ? 'border-garland-berry' : 'border-garland-ink-08'
      }`}
    >
      <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
        {label}
      </Text>
      <View className="mt-1.5 flex-row items-center">
        <TextInput
          placeholderTextColor={garland.ink40}
          {...inputProps}
          className="flex-1 text-[15px] leading-[18px] text-garland-ink"
          style={style}
        />
      </View>
      {invalid ? (
        <Text className="mt-1.5 text-xs text-garland-berry">
          {errorMessage}
        </Text>
      ) : note ? (
        <Text className="mt-1.5 text-xs leading-[17px] text-garland-ink-60">
          {note}
        </Text>
      ) : null}
    </View>
  )
}

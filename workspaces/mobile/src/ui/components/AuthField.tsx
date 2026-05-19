import { TextInput, type TextInputProps, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'

type Props = TextInputProps & {
  label: string
  hint?: string
  errorMessage?: string
}

export function AuthField({
  label,
  hint,
  errorMessage,
  style,
  ...inputProps
}: Props) {
  const invalid = !!errorMessage
  return (
    <View className="gap-1.5">
      <Text className="text-[11px] font-bold uppercase tracking-[1px] text-garland-ink-40">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={garland.ink40}
        {...inputProps}
        className={`border-b-[1.5px] py-1.5 pb-2 text-base text-garland-ink ${
          invalid ? 'border-garland-berry' : 'border-garland-ink-15'
        }`}
        style={style}
      />
      {invalid ? (
        <Text className="text-xs text-garland-berry">{errorMessage}</Text>
      ) : hint ? (
        <Text className="text-[11px] text-garland-ink-40">{hint}</Text>
      ) : null}
    </View>
  )
}

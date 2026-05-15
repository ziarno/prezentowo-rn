import { TextInput, type TextInputProps, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { garland } from '@/constants/garland'

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
    <View style={{ gap: 6 }}>
      <Text
        className="font-bold uppercase"
        style={{ fontSize: 11, color: garland.ink40, letterSpacing: 1 }}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={garland.ink40}
        {...inputProps}
        style={[
          {
            fontSize: 16,
            color: garland.ink,
            paddingVertical: 6,
            paddingBottom: 8,
            borderBottomWidth: 1.5,
            borderBottomColor: invalid ? garland.berry : garland.ink15,
          },
          style,
        ]}
      />
      {invalid ? (
        <Text style={{ fontSize: 12, color: garland.berry }}>
          {errorMessage}
        </Text>
      ) : hint ? (
        <Text style={{ fontSize: 11, color: garland.ink40 }}>{hint}</Text>
      ) : null}
    </View>
  )
}

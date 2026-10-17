import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { inviteCodeFromText } from '@/api/invites'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { GarlandField } from '@/ui/components/GarlandField'
import { ScreenHeader } from '@/ui/components/ScreenHeader'
import { SheetKeyboardAvoidingView } from '@/ui/components/SheetKeyboardAvoidingView'

// `7b`: join with a pasted invite link, for when tapping it didn't open the
// app. A link found in the text opens its invite (`7a`) in this screen's
// place, which does the rest. The clipboard is read only on Paste: iOS's
// native paste control needs no permission prompt.
export function JoinEventScreen() {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  // Whether to say the text has no link: after a paste or once it's
  // submitted, not while someone types the link out.
  const [checked, setChecked] = useState(false)

  const take = (next: string, pasted: boolean) => {
    setText(next)
    setChecked(pasted)
    const code = inviteCodeFromText(next)
    if (code) router.replace({ pathname: '/e/[code]', params: { code } })
  }

  const pasteFromClipboard = async () =>
    take(await Clipboard.getStringAsync(), true)

  const noLink = checked && text.trim() !== ''

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <SheetKeyboardAvoidingView>
        <ScreenHeader title={t('join.title')} variant="modal" />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="mb-6 mt-2 text-[15px] leading-[22px] text-garland-ink-60">
            {t('join.body')}
          </Text>
          <GarlandField
            label={t('join.label')}
            value={text}
            // More than one character at once is a paste.
            onChangeText={next => take(next, next.length - text.length > 1)}
            onBlur={() => setChecked(true)}
            onSubmitEditing={() => setChecked(true)}
            placeholder={t('join.placeholder')}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            keyboardType="url"
            returnKeyType="done"
            errorMessage={noLink ? t('join.noLink') : undefined}
          />
          {Clipboard.isPasteButtonAvailable ? (
            <Clipboard.ClipboardPasteButton
              acceptedContentTypes={['plain-text']}
              onPress={data => {
                if (data.type === 'text') take(data.text, true)
              }}
              backgroundColor={garland.ink}
              foregroundColor={garland.paper}
              cornerStyle="capsule"
              displayMode="iconAndLabel"
              style={{ height: 48, width: 120 }}
            />
          ) : (
            <GarlandButton
              variant="outline"
              onPress={pasteFromClipboard}
              className="self-start"
            >
              <GarlandButtonText>{t('join.paste')}</GarlandButtonText>
            </GarlandButton>
          )}
        </ScrollView>
      </SheetKeyboardAvoidingView>
    </SafeAreaView>
  )
}

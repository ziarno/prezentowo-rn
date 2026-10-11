import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  deletionConsequences,
  emailMatches,
  isEmailMismatch,
} from '@/api/accountDeletion'
import { Text } from '@/components/ui/text'
import { useAuth } from '@/hooks/useAuth'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOffline } from '@/hooks/useOffline'
import { errorMessage } from '@/localization/errorMessage'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { GarlandField } from '@/ui/components/GarlandField'
import { ScreenHeader } from '@/ui/components/ScreenHeader'
import { SheetKeyboardAvoidingView } from '@/ui/components/SheetKeyboardAvoidingView'

// The typed-email deletion confirm, from Profile's Danger zone (docs/spec.md
// §10.4). Online-only, never queued. On success the session ends and the
// guards land the app signed out.
export function DeleteAccountScreen() {
  const { t, i18n } = useTranslation()
  const offline = useOffline()
  const { deleteAccount } = useAuth()
  const email = useCurrentUser()?.emails?.[0]?.address
  const [typed, setTyped] = useState('')
  const [touched, setTouched] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const matches = emailMatches(typed, email)
  const mismatch = touched && typed.trim() !== '' && !matches
  const canSubmit = matches && !offline

  const submit = () => {
    if (!canSubmit || deleting) return
    setDeleting(true)
    setError(null)
    deleteAccount({
      email: typed,
      onError: err => {
        setDeleting(false)
        setError(
          isEmailMismatch(err)
            ? t('deleteAccount.emailMismatch')
            : errorMessage(err, t('common.somethingWentWrong')),
        )
      },
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <SheetKeyboardAvoidingView>
        <ScreenHeader title={t('deleteAccount.title')} variant="modal" />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="mt-2 font-garland-display text-[30px] leading-[34px] text-garland-ink">
            {t('deleteAccount.heading')}
          </Text>
          <Text className="mt-3 text-[15px] leading-[22px] text-garland-ink-60">
            {t('deleteAccount.cantUndo')}
          </Text>

          <View className="mb-7 mt-5 gap-3">
            {deletionConsequences(i18n.language).map(line => (
              <View key={line} className="flex-row gap-2.5">
                <Text className="text-garland-ink-40">•</Text>
                <Text className="flex-1 text-sm leading-5 text-garland-ink">
                  {line}
                </Text>
              </View>
            ))}
          </View>

          <GarlandField
            label={t('deleteAccount.emailLabel')}
            value={typed}
            onChangeText={text => {
              setTyped(text)
              setError(null)
            }}
            onBlur={() => setTouched(true)}
            onSubmitEditing={submit}
            placeholder={email}
            editable={!deleting}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            keyboardType="email-address"
            returnKeyType="done"
            errorMessage={
              error ?? (mismatch ? t('deleteAccount.emailMismatch') : undefined)
            }
            note={
              offline
                ? t('deleteAccount.offline')
                : t('deleteAccount.typeEmail', { email: email ?? '' })
            }
          />

          <GarlandButton
            className="mt-3 bg-garland-berry data-[active=true]:bg-garland-berry"
            disabled={!canSubmit}
            loading={deleting}
            onPress={submit}
          >
            <GarlandButtonText>{t('deleteAccount.confirm')}</GarlandButtonText>
          </GarlandButton>
        </ScrollView>
      </SheetKeyboardAvoidingView>
    </SafeAreaView>
  )
}

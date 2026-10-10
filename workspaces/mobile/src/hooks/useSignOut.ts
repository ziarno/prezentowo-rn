import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'

import { useAuth } from '@/hooks/useAuth'
import { useQueuedWrites } from '@/hooks/useQueuedWrites'
import { errorMessage } from '@/localization/errorMessage'

// Sign out from Profile or the drawer: always confirmed, and the confirm says
// how many offline writes — pending or failed — signing out would lose
// (docs/spec.md §10.1). A failed sign-out is shown; the user stays signed in.
export function useSignOut() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const unsynced = useQueuedWrites().length

  const confirmSignOut = () =>
    Alert.alert(
      t('signOut.title'),
      unsynced > 0
        ? t('signOut.loseBody', { count: unsynced })
        : t('signOut.body'),
      [
        { text: t('signOut.cancel'), style: 'cancel' },
        {
          text:
            unsynced > 0
              ? t('signOut.confirmLose', { count: unsynced })
              : t('signOut.confirm'),
          style: 'destructive',
          onPress: () =>
            signOut({
              onError: err =>
                Alert.alert(
                  t('signOut.failed'),
                  errorMessage(err, t('common.somethingWentWrong')),
                ),
            }),
        },
      ],
    )

  return { unsynced, confirmSignOut }
}

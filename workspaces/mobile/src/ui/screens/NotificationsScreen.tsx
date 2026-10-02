import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { NotificationTarget } from '@/api/notificationInbox'
import { Text } from '@/components/ui/text'
import { useNotificationInbox } from '@/hooks/useNotificationInbox'
import { JoinsRow, NotificationRow } from '@/ui/components/NotificationRow'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

const open = (target: NotificationTarget | null) =>
  target ? () => router.push(target) : undefined

// The notifications inbox (#28): one list, newest first, in New / Earlier
// this week / Older. Opening it marks everything read.
export function NotificationsScreen() {
  const { t } = useTranslation()
  const { ready, sections, details } = useNotificationInbox()
  const now = new Date()

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={t('shell.notifications')} variant="back" />
      {sections.length === 0 ? (
        ready ? (
          <View className="items-center px-9 pt-[70px]">
            <Text className="mb-3 text-[44px]">🔔</Text>
            <Text className="mb-2 text-center font-garland-display text-[28px] text-garland-ink">
              {t('notifications.emptyTitle')}
            </Text>
            <Text className="mb-2 text-center text-[13px] text-garland-ink-60">
              {t('notifications.emptyBody')}
            </Text>
            <Text className="text-center text-[13px] text-garland-ink-60">
              {t('notifications.emptyIgnored')}
            </Text>
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-garland-ink-60">
              {t('notifications.loading')}
            </Text>
          </View>
        )
      ) : (
        <ScrollView contentContainerClassName="pb-10">
          {sections.map(section => (
            <View key={section.key}>
              <Text
                className="px-[18px] pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-garland-ink-40"
                accessibilityRole="header"
              >
                {t(`notifications.sections.${section.key}`)}
              </Text>
              {section.rows.map(row =>
                row.kind === 'joins' ? (
                  <JoinsRow
                    key={row.joins[0]!._id}
                    joins={row.joins}
                    detailsOf={details}
                    isNew={row.isNew}
                    now={now}
                    onPress={open(details(row.joins[0]!).target)}
                  />
                ) : (
                  <NotificationRow
                    key={row.notification._id}
                    notification={row.notification}
                    details={details(row.notification)}
                    isNew={row.isNew}
                    now={now}
                    onPress={open(details(row.notification).target)}
                  />
                ),
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

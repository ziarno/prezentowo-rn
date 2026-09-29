import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { claimGift, unclaimGift } from '@/api/gifts'
import { type ClaimAction, claimAction, isHiddenFrom } from '@/api/presentLists'
import { LinkIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useGiftById } from '@/hooks/useGiftById'
import { usePersonName } from '@/hooks/usePersonName'
import { errorMessage } from '@/localization/errorMessage'
import { BuyerChips } from '@/ui/components/BuyerChips'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LockNote } from '@/ui/components/LockNote'
import { PresentTile } from '@/ui/components/PresentTile'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

const CTA_KEY: Record<ClaimAction, string> = {
  claim: 'present.claim',
  claimToo: 'present.claimToo',
  unclaim: 'present.unclaim',
}

const hrefOf = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`

// `1e`: a present's photo or illustration, who it's for and who added it,
// its description and link, and — for everyone but its recipient — who is
// buying it and the claim/unclaim action.
export function PresentDetailScreen({
  eventId,
  giftId,
}: {
  eventId: string
  giftId: string
}) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { event } = useEventById(eventId)
  const { gift, ready } = useGiftById(giftId, eventId)
  const { resolve, resolveUser } = useEventParticipants(eventId)
  const nameOf = usePersonName()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A suggestion for the viewer (a stale local copy) reads as missing.
  if (!gift || !event || !user || isHiddenFrom(event, gift, user._id)) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <ScreenHeader title={t('shell.present')} />
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {ready ? t('present.notFound') : t('present.loading')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const recipient = resolve(gift.forParticipantId)
  const creator = resolveUser(gift.createdBy)
  const action = claimAction(event, gift, user._id)
  // Only ever resolved for a viewer who may see them (claim-quietly rule).
  const buyers = action
    ? (gift.claimedBy ?? []).map(id => nameOf(resolveUser(id)))
    : []

  const toggleClaim = () => {
    if (!action || submitting) return
    setError(null)
    setSubmitting(true)
    const call = action === 'unclaim' ? unclaimGift : claimGift
    call(gift._id)
      .catch((err: unknown) =>
        setError(errorMessage(err, t('common.somethingWentWrong'))),
      )
      .finally(() => setSubmitting(false))
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={event.title} />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="items-center px-[22px] pt-2">
          <PresentTile
            image={gift.image}
            size={220}
            imageSize={190}
            radius={24}
            derivative={1000}
          />
        </View>

        <View className="px-[22px] pt-5">
          <Text className="font-garland-display text-[30px] leading-[34px] text-garland-ink">
            {gift.title}
          </Text>

          <View className="mt-3 flex-row flex-wrap gap-1.5">
            <Tag>
              {recipient?.isYou
                ? t('present.forYou')
                : t('present.forName', { name: nameOf(recipient) })}
            </Tag>
            <Tag>
              {creator?.isYou
                ? t('present.addedByYou')
                : t('present.addedBy', { name: nameOf(creator) })}
            </Tag>
          </View>

          {gift.description ? (
            <Text className="mt-4 text-sm leading-[21px] text-garland-ink-60">
              {gift.description}
            </Text>
          ) : null}

          {gift.url ? (
            <Pressable
              onPress={() => void Linking.openURL(hrefOf(gift.url!))}
              accessibilityRole="link"
              hitSlop={6}
              className="mt-3 flex-row items-center gap-1.5 active:opacity-60"
            >
              <LinkIcon width={14} height={14} color={garland.green} />
              <Text
                className="flex-1 text-[13px] font-bold text-garland-green"
                numberOfLines={1}
              >
                {gift.url}
              </Text>
            </Pressable>
          ) : null}

          {action ? (
            <>
              <Text className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
                {t('present.buying')}
              </Text>
              {buyers.length > 0 ? (
                <BuyerChips names={buyers} />
              ) : (
                <Text className="text-sm text-garland-ink-60">
                  {t('present.nobodyBuying')}
                </Text>
              )}
              <GarlandButton
                variant={action === 'unclaim' ? 'outline' : 'solid'}
                className="mt-6"
                loading={submitting}
                onPress={toggleClaim}
              >
                <GarlandButtonText>{t(CTA_KEY[action])}</GarlandButtonText>
              </GarlandButton>
              {error ? (
                <Text className="mt-3 text-xs text-garland-berry">{error}</Text>
              ) : null}
            </>
          ) : (
            <LockNote className="mt-6">{t('present.onYourList')}</LockNote>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Tag({ children }: { children: string }) {
  return (
    <View className="rounded-full border border-garland-ink-15 px-2.5 py-1">
      <Text className="text-[11px] font-semibold text-garland-ink-60">
        {children}
      </Text>
    </View>
  )
}

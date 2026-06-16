import type { MeteorError } from '@meteorrn/core'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { claimGift, unclaimGift } from '@/api/gifts'
import { BackIcon, LinkIcon, MoreIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useGiftById } from '@/hooks/useGiftById'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { GiftFlag } from '@/ui/components/GiftFlag'
import { PresentTile } from '@/ui/components/PresentTile'

export function GiftDetailScreen({
  giftId,
  eventId,
}: {
  giftId?: string
  eventId?: string
}) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const event = useEventById(eventId)
  const gift = useGiftById(giftId, eventId)
  const { resolve } = useEventParticipants(event)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!gift || !giftId) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <View className="flex-row px-[22px] pt-3.5">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <BackIcon width={22} height={22} color={garland.ink} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {t('giftDetail.loading')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const forP = resolve(gift.forParticipantId)
  const forName = forP?.isYou ? t('eventDetail.you') : (forP?.name ?? '')
  const isMine = forP?.isYou ?? false
  const claimedByMe = !!user && (gift.claimedBy ?? []).includes(user._id)
  const claimedCount = gift.claimedBy?.length ?? 0

  const eyebrow = gift.price
    ? t('giftDetail.forNamePrice', { name: forName, price: gift.price })
    : t('giftDetail.forName', { name: forName })

  const toggleClaim = () => {
    if (submitting || !giftId) return
    setError(null)
    setSubmitting(true)
    const action = claimedByMe ? unclaimGift : claimGift
    action(giftId)
      .then(() => setSubmitting(false))
      .catch((err: MeteorError) => {
        setSubmitting(false)
        setError(
          err.reason ?? err.error?.toString() ?? t('common.somethingWentWrong'),
        )
      })
  }

  const openLink = () => {
    if (!gift.url) return
    const href = /^https?:\/\//i.test(gift.url)
      ? gift.url
      : `https://${gift.url}`
    void Linking.openURL(href)
  }

  const goEdit = () =>
    router.push(`/add-gift?eventId=${eventId}&giftId=${giftId}`)

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center justify-between px-[22px] pt-3.5">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <BackIcon width={22} height={22} color={garland.ink} />
          </Pressable>
          <Pressable onPress={goEdit} hitSlop={12}>
            <MoreIcon width={20} height={20} color={garland.ink60} />
          </Pressable>
        </View>

        <View className="px-[22px] pb-4 pt-2">
          <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
            {eyebrow}
          </Text>
          <Text className="mb-3 mt-1.5 font-garland-display text-[30px] leading-[31px] text-garland-ink">
            {gift.title}
          </Text>

          <View className="flex-row items-start gap-3.5">
            <PresentTile
              image={gift.image}
              size={90}
              imageSize={74}
              radius={18}
            />
            <View className="min-w-0 flex-1">
              {gift.description ? (
                <Text className="text-sm leading-[21px] text-garland-ink-60">
                  {gift.description}
                </Text>
              ) : null}
              {gift.url ? (
                <Pressable
                  onPress={openLink}
                  className="mt-2 flex-row items-center gap-1.5 active:opacity-60"
                  hitSlop={6}
                >
                  <LinkIcon width={12} height={12} color={garland.green} />
                  <Text
                    className="text-xs font-bold uppercase text-garland-green"
                    style={{ letterSpacing: 0.8 }}
                  >
                    {gift.url}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {!isMine ? (
            <View className="mt-3.5">
              <GiftFlag claimed={claimedCount > 0} claimers={claimedCount} />
            </View>
          ) : null}

          {isMine ? (
            <View className="mt-5">
              <View className="flex-row items-center gap-2.5 rounded-2xl bg-garland-paper2 px-4 py-3.5">
                <Text className="flex-1 text-[13px] leading-[19px] text-garland-ink-60">
                  {t('giftDetail.onYourWishlist')}
                </Text>
              </View>
              <GarlandButton
                variant="outline"
                className="mt-3"
                onPress={goEdit}
              >
                <GarlandButtonText>{t('giftDetail.edit')}</GarlandButtonText>
              </GarlandButton>
            </View>
          ) : (
            <GarlandButton
              variant={claimedByMe ? 'outline' : 'solid'}
              className="mt-[18px]"
              loading={submitting}
              onPress={toggleClaim}
            >
              <GarlandButtonText>
                {claimedByMe
                  ? t('giftDetail.unclaim')
                  : t('giftDetail.claimThis')}
              </GarlandButtonText>
            </GarlandButton>
          )}

          {error ? (
            <Text className="mt-3 text-xs text-garland-berry">{error}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

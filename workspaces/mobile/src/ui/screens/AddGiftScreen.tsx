import type { MeteorError } from '@meteorrn/core'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { addGift, updateGift } from '@/api/gifts'
import { CheckIcon, LockIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { PRESENT_KEYS } from '@/constants/presents'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { GarlandField } from '@/ui/components/GarlandField'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { PresentTile } from '@/ui/components/PresentTile'

const SUGGESTED = PRESENT_KEYS.slice(0, 10)

export function AddGiftScreen({
  eventId,
  forParticipantId,
  giftId,
}: {
  eventId?: string
  forParticipantId?: string
  giftId?: string
}) {
  const { t } = useTranslation()
  const event = useEventById(eventId)
  const gifts = useEventGifts(eventId)
  const { participants, resolve } = useEventParticipants(event)
  const existing = giftId ? gifts.find(g => g._id === giftId) : undefined
  const isEdit = !!giftId

  const [title, setTitle] = useState(existing?.title ?? '')
  const [forId, setForId] = useState<string | undefined>(
    existing?.forParticipantId ?? forParticipantId,
  )
  const [description, setDescription] = useState(existing?.description ?? '')
  const [price, setPrice] = useState(existing?.price ?? '')
  const [url, setUrl] = useState(existing?.url ?? '')
  const [image, setImage] = useState<string | undefined>(existing?.image)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)

  const forPerson = forId ? resolve(forId) : undefined
  const forIsYou = forPerson?.isYou ?? false

  const save = () => {
    if (submitting) return
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError(t('common.required'))
      return
    }
    if (!eventId || !forId) {
      setError(t('addGift.pickRecipient'))
      return
    }
    setError(null)
    setSubmitting(true)
    const op = isEdit
      ? updateGift({
          giftId,
          title: trimmed,
          description,
          price,
          url,
          ...(image ? { image } : {}),
        })
      : addGift({
          eventId,
          forParticipantId: forId,
          title: trimmed,
          description,
          price,
          url,
          ...(image ? { image } : {}),
        })
    op.then(() => {
      setSubmitting(false)
      router.back()
    }).catch((err: MeteorError) => {
      setSubmitting(false)
      setError(
        err.reason ?? err.error?.toString() ?? t('common.somethingWentWrong'),
      )
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-[22px] pb-2 pt-3.5">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-sm text-garland-ink-60">
              {t('addGift.cancel')}
            </Text>
          </Pressable>
          <Text className="text-[13px] font-bold uppercase tracking-[0.8px] text-garland-ink">
            {isEdit ? t('addGift.editTitle') : t('addGift.newTitle')}
          </Text>
          <Pressable onPress={save} hitSlop={8} disabled={submitting}>
            <Text className="text-sm font-bold text-garland-green">
              {t('addGift.save')}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-[18px] mt-1.5 font-garland-display text-[28px] leading-[31px] text-garland-ink">
            {t('addGift.heading')}
          </Text>

          <GarlandField
            label={t('addGift.fieldTitle')}
            value={title}
            onChangeText={text => {
              setTitle(text)
              if (titleError) setTitleError(null)
            }}
            placeholder={t('addGift.titlePlaceholder')}
            errorMessage={titleError ?? undefined}
          />

          {/* For — participant picker */}
          <View className="mb-3.5 border-b border-garland-ink-08 pb-3.5">
            <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
              {t('addGift.fieldFor')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 10 }}
            >
              {participants.map(p => {
                const selected = p.id === forId
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setForId(p.id)}
                    className={`flex-row items-center gap-2 rounded-full border px-2.5 py-1.5 active:opacity-70 ${
                      selected
                        ? 'border-garland-green bg-garland-green/10'
                        : 'border-garland-ink-15'
                    }`}
                  >
                    <ParticipantAvatar
                      name={p.name}
                      avatarKey={p.avatarKey}
                      color={p.color}
                      size={22}
                    />
                    <Text
                      className={`text-[13px] ${
                        selected
                          ? 'font-bold text-garland-ink'
                          : 'text-garland-ink-60'
                      }`}
                    >
                      {p.isYou ? t('eventDetail.you') : p.name}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>

          <GarlandField
            label={t('addGift.fieldDescription')}
            value={description}
            onChangeText={setDescription}
            placeholder={t('addGift.descriptionPlaceholder')}
            multiline
          />

          <View className="flex-row gap-3.5">
            <View className="flex-1">
              <GarlandField
                label={t('addGift.fieldPrice')}
                value={price}
                onChangeText={setPrice}
                placeholder={t('addGift.pricePlaceholder')}
              />
            </View>
            <View className="flex-1">
              <GarlandField
                label={t('addGift.fieldLink')}
                value={url}
                onChangeText={setUrl}
                placeholder={t('addGift.linkPlaceholder')}
                autoCapitalize="none"
              />
            </View>
          </View>

          {forPerson && !forIsYou ? (
            <View className="mt-1 flex-row items-center gap-3 rounded-2xl bg-garland-paper2 px-4 py-3.5">
              <LockIcon width={16} height={16} color={garland.green} />
              <Text className="flex-1 text-[13px] leading-[19px] text-garland-ink-60">
                {t('addGift.secretHint', { name: forPerson.name })}
              </Text>
            </View>
          ) : null}

          <View className="mt-6">
            <Text className="mb-2.5 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
              {t('addGift.suggested')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {SUGGESTED.map(key => {
                const selected = key === image
                return (
                  <Pressable
                    key={key}
                    onPress={() => setImage(key)}
                    className="active:opacity-70"
                    style={{
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: selected ? garland.green : 'transparent',
                    }}
                  >
                    <PresentTile
                      image={key}
                      size={72}
                      imageSize={58}
                      radius={12}
                    />
                    {selected ? (
                      <View className="absolute -right-1 -top-1 size-5 items-center justify-center rounded-full border-2 border-garland-paper bg-garland-green">
                        <CheckIcon
                          width={10}
                          height={10}
                          color={garland.paper}
                        />
                      </View>
                    ) : null}
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>

          {error ? (
            <Text className="mt-4 text-xs text-garland-berry">{error}</Text>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

import type { EventDoc } from '@prezentowo/types'
import { router, useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  type GiftDraft,
  type GiftWizardMode,
  draftFromGift,
  emptyGiftDraft,
  giftStepError,
  giftWizardSteps,
  recipientOptions,
  startingRecipient,
  toAddGiftArgs,
  toUpdateGiftArgs,
} from '@/api/giftWizard'
import { addGift, updateGift } from '@/api/gifts'
import { canEditGift } from '@/api/presentLists'
import { Text } from '@/components/ui/text'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useGiftById } from '@/hooks/useGiftById'
import { usePersonName } from '@/hooks/usePersonName'
import { errorMessage } from '@/localization/errorMessage'
import { GarlandField } from '@/ui/components/GarlandField'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { PresentTile } from '@/ui/components/PresentTile'
import { ScreenHeader } from '@/ui/components/ScreenHeader'
import { SheetKeyboardAvoidingView } from '@/ui/components/SheetKeyboardAvoidingView'
import {
  StepHeading,
  WizardFooter,
  WizardProgress,
} from '@/ui/components/Wizard'

// `5a`–`5d`: adds a present for `forParticipantId` (the list it was opened
// from), or, with `giftId`, edits one from `1e` on the summary.
export function AddGiftScreen({
  eventId,
  forParticipantId,
  giftId,
}: {
  eventId: string
  forParticipantId?: string
  giftId?: string
}) {
  return giftId ? (
    <EditGift eventId={eventId} giftId={giftId} />
  ) : (
    <AddGift eventId={eventId} forParticipantId={forParticipantId} />
  )
}

function AddGift({
  eventId,
  forParticipantId,
}: {
  eventId: string
  forParticipantId?: string
}) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { event, ready } = useEventById(eventId)

  if (!event || !user) {
    return (
      <Message title={t('shell.addPresent')}>
        {ready ? t('addPresent.eventNotFound') : t('present.loading')}
      </Message>
    )
  }

  return (
    <GiftWizard
      mode="add"
      event={event}
      initialDraft={emptyGiftDraft(
        startingRecipient(event, forParticipantId, user._id),
      )}
      onSubmit={async draft => {
        await addGift(toAddGiftArgs(event._id, draft))
        router.back()
      }}
    />
  )
}

function EditGift({ eventId, giftId }: { eventId: string; giftId: string }) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { event } = useEventById(eventId)
  const { gift, ready } = useGiftById(giftId, eventId)

  if (!event || !gift || !canEditGift(gift, user?._id)) {
    return (
      <Message title={t('shell.editPresent')}>
        {ready ? t('present.notFound') : t('present.loading')}
      </Message>
    )
  }

  return (
    <GiftWizard
      mode="edit"
      event={event}
      initialDraft={draftFromGift(gift)}
      onSubmit={async draft => {
        await updateGift(toUpdateGiftArgs(gift, draft))
        router.back()
      }}
    />
  )
}

function Message({ title, children }: { title: string; children: string }) {
  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={title} variant="modal" />
      <View className="flex-1 items-center justify-center px-7">
        <Text className="text-center text-sm text-garland-ink-60">
          {children}
        </Text>
      </View>
    </SafeAreaView>
  )
}

function GiftWizard({
  mode,
  event,
  initialDraft,
  onSubmit,
}: {
  mode: GiftWizardMode
  event: EventDoc
  initialDraft: GiftDraft
  // Navigates away on success; a rejection is shown on the summary.
  onSubmit: (draft: GiftDraft) => Promise<void>
}) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [draft, setDraft] = useState(initialDraft)
  const [step, setStep] = useState(giftWizardSteps(mode)[0]!)
  const [showError, setShowError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Set just before the wizard leaves on purpose (close, or after saving),
  // so the back-steps-back guard lets that navigation through.
  const leaving = useRef(false)

  const steps = giftWizardSteps(mode)
  const index = steps.indexOf(step)
  const isLast = index === steps.length - 1
  const error = giftStepError(step, draft)

  const goBack = () => {
    setShowError(false)
    setSubmitError(null)
    setStep(steps[index - 1]!)
  }

  // Hardware back and the modal swipe step back; only step 1 dismisses.
  usePreventRemove(index > 0, ({ data }) => {
    if (leaving.current) navigation.dispatch(data.action)
    else goBack()
  })

  const next = async () => {
    if (error) {
      setShowError(true)
      return
    }
    setShowError(false)
    if (!isLast) {
      setStep(steps[index + 1]!)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    leaving.current = true
    try {
      await onSubmit(draft)
    } catch (e) {
      leaving.current = false
      setSubmitError(
        errorMessage(
          e,
          mode === 'add'
            ? t('addPresent.addFailed')
            : t('addPresent.saveFailed'),
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const primaryLabel =
    step === 'photo'
      ? t('common.skip')
      : !isLast
        ? t('wizard.next')
        : mode === 'add'
          ? t('addPresent.add')
          : t('addPresent.save')

  const titleError =
    showError && error === 'titleRequired'
      ? t('addPresent.errors.titleRequired')
      : undefined

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <SheetKeyboardAvoidingView>
        <ScreenHeader
          title={
            mode === 'add' ? t('shell.addPresent') : t('shell.editPresent')
          }
          variant="modal"
          onClose={() => {
            leaving.current = true
            router.back()
          }}
        />
        {steps.length > 1 ? (
          <WizardProgress index={index} count={steps.length} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'title' ? (
            <>
              <StepHeading>{t('addPresent.title.heading')}</StepHeading>
              <TitleField
                draft={draft}
                onChange={setDraft}
                errorMessage={titleError}
                autoFocus
                onSubmitEditing={next}
              />
            </>
          ) : step === 'photo' ? (
            <PhotoStep />
          ) : step === 'details' ? (
            <>
              <StepHeading>{t('addPresent.details.heading')}</StepHeading>
              <DetailFields draft={draft} onChange={setDraft} />
              <Text className="text-xs leading-[17px] text-garland-ink-60">
                {t('addPresent.details.hint')}
              </Text>
            </>
          ) : (
            <SummaryStep
              mode={mode}
              event={event}
              draft={draft}
              onChange={setDraft}
              titleError={titleError}
              recipientError={
                showError && error === 'recipientRequired'
                  ? t('addPresent.errors.recipientRequired')
                  : undefined
              }
            />
          )}

          {submitError ? (
            <Text className="mt-3 text-xs text-garland-berry">
              {submitError}
            </Text>
          ) : null}
        </ScrollView>

        <WizardFooter
          primaryLabel={primaryLabel}
          onPrimary={next}
          onBack={index > 0 ? goBack : undefined}
          submitting={submitting}
        />
      </SheetKeyboardAvoidingView>
    </SafeAreaView>
  )
}

type FieldsProps = {
  draft: GiftDraft
  onChange: (draft: GiftDraft) => void
}

function TitleField({
  draft,
  onChange,
  errorMessage,
  autoFocus,
  onSubmitEditing,
}: FieldsProps & {
  errorMessage?: string
  autoFocus?: boolean
  onSubmitEditing?: () => void
}) {
  const { t } = useTranslation()
  return (
    <GarlandField
      label={t('addPresent.nameLabel')}
      value={draft.title}
      onChangeText={title => onChange({ ...draft, title })}
      placeholder={t('addPresent.namePlaceholder')}
      errorMessage={errorMessage}
      autoFocus={autoFocus}
      returnKeyType={onSubmitEditing ? 'next' : 'done'}
      onSubmitEditing={onSubmitEditing}
      submitBehavior={onSubmitEditing ? 'submit' : undefined}
    />
  )
}

function DetailFields({ draft, onChange }: FieldsProps) {
  const { t } = useTranslation()
  return (
    <>
      <GarlandField
        label={t('addPresent.descriptionLabel')}
        value={draft.description}
        onChangeText={description => onChange({ ...draft, description })}
        placeholder={t('addPresent.descriptionPlaceholder')}
        multiline
      />
      <GarlandField
        label={t('addPresent.linkLabel')}
        value={draft.url}
        onChangeText={url => onChange({ ...draft, url })}
        placeholder={t('addPresent.linkPlaceholder')}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </>
  )
}

// `5b`: uploading a photo or picking one of ours lands with the photos
// slice; until then the only way on is without one.
function PhotoStep() {
  const { t } = useTranslation()
  return (
    <>
      <StepHeading>{t('addPresent.photo.heading')}</StepHeading>
      <View className="items-center py-4">
        <PresentTile image={undefined} size={140} radius={20} />
      </View>
      <Text className="text-center text-[13px] leading-[19px] text-garland-ink-60">
        {t('addPresent.photo.noPhoto')}
      </Text>
    </>
  )
}

// `5d`: every field editable in place. The recipient is write-once, so it
// can only be picked while adding.
function SummaryStep({
  mode,
  event,
  draft,
  onChange,
  titleError,
  recipientError,
}: FieldsProps & {
  mode: GiftWizardMode
  event: EventDoc
  titleError?: string
  recipientError?: string
}) {
  const { t } = useTranslation()
  const { resolve } = useEventParticipants(event._id)
  const nameOf = usePersonName()
  const options = mode === 'add' ? recipientOptions(event) : []

  return (
    <>
      <StepHeading>{t('addPresent.summary.heading')}</StepHeading>

      <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
        {t('addPresent.summary.forLabel')}
      </Text>
      {options.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-[22px] mt-2"
          contentContainerStyle={{ paddingHorizontal: 22, gap: 8 }}
        >
          {options.map(id => {
            const person = resolve(id)
            const selected = id === draft.forParticipantId
            return (
              <Pressable
                key={id}
                onPress={() => onChange({ ...draft, forParticipantId: id })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                className={`flex-row items-center gap-2 rounded-full border-[1.5px] py-1 pl-1 pr-3.5 active:opacity-70 ${
                  selected
                    ? 'border-garland-ink bg-garland-paper2'
                    : 'border-garland-ink-15'
                }`}
              >
                <ParticipantAvatar
                  name={person?.name ?? ''}
                  avatarKey={person?.avatarKey}
                  color={person?.color}
                  size={28}
                />
                <Text className="text-sm font-semibold text-garland-ink">
                  {nameOf(person)}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : (
        <Text className="mt-1.5 text-[15px] text-garland-ink">
          {nameOf(
            draft.forParticipantId
              ? resolve(draft.forParticipantId)
              : undefined,
          )}
        </Text>
      )}
      {recipientError ? (
        <Text className="mt-1.5 text-xs text-garland-berry">
          {recipientError}
        </Text>
      ) : null}

      <View className="my-4 flex-row items-center gap-3.5 border-b border-garland-ink-08 pb-4">
        <PresentTile image={draft.image} size={64} />
        <Text className="flex-1 text-[13px] leading-[18px] text-garland-ink-60">
          {draft.image
            ? t('addPresent.summary.photoKept')
            : t('addPresent.photo.noPhoto')}
        </Text>
      </View>

      <TitleField draft={draft} onChange={onChange} errorMessage={titleError} />
      <DetailFields draft={draft} onChange={onChange} />
    </>
  )
}

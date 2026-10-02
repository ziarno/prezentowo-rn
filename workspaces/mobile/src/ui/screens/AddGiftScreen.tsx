import type { EventDoc, ImportedFields } from '@prezentowo/types'
import { router, useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { uploadDraftImage } from '@/api/draftImage'
import {
  type GiftDraft,
  type GiftWizardMode,
  draftFromGift,
  draftFromImport,
  emptyGiftDraft,
  giftStepError,
  giftWizardSteps,
  recipientOptions,
  startingRecipient,
  toAddGiftArgs,
  toUpdateGiftArgs,
} from '@/api/giftWizard'
import { addGift, updateGift } from '@/api/gifts'
import { downloadImage, uploadImage } from '@/api/images'
import { blockedShopName, importLink } from '@/api/linkImport'
import { canEditGift } from '@/api/presentLists'
import { Text } from '@/components/ui/text'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useGiftById } from '@/hooks/useGiftById'
import { useOffline } from '@/hooks/useOffline'
import { usePersonName } from '@/hooks/usePersonName'
import { errorMessage } from '@/localization/errorMessage'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { GarlandField } from '@/ui/components/GarlandField'
import { ImagePickerGrid } from '@/ui/components/ImagePickerGrid'
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

// Fields a link import couldn't fill, for the import review hint on `5d`.
type Missing = ImportedFields['missing']

// `5a`'s link import, short of a success (which moves on to `5d`).
type LinkImportState =
  | { status: 'idle' }
  | { status: 'importing' }
  | { status: 'unreadable'; blockedShop?: string }
  | { status: 'failed' }

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
  const offline = useOffline()
  const [draft, setDraft] = useState(initialDraft)
  const [step, setStep] = useState(giftWizardSteps(mode)[0]!)
  const [showError, setShowError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [linkImport, setLinkImport] = useState<LinkImportState>({
    status: 'idle',
  })
  // Set by a successful link import: the client-only import review hint.
  // Never saved, and gone with the wizard.
  const [review, setReview] = useState<Missing | null>(null)
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
      // Kept in the draft, so a retry after a failed save doesn't upload
      // the photo again.
      const image = await uploadDraftImage(
        draft.image,
        uploadImage,
        downloadImage,
      )
      const uploaded = { ...draft, image }
      setDraft(uploaded)
      await onSubmit(uploaded)
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

  // `5a`'s 🔗 Create from link: a success fills the draft and jumps to `5d`;
  // otherwise the link stays in its field with a note under it.
  const createFromLink = async () => {
    if (!draft.url.trim() || linkImport.status === 'importing') return
    setShowError(false)
    setLinkImport({ status: 'importing' })
    const result = await importLink(draft.url)
    if (result.outcome === 'success') {
      setDraft(current => draftFromImport(current, result.fields))
      setReview(result.fields.missing)
      setLinkImport({ status: 'idle' })
      setStep('summary')
    } else if (result.outcome === 'unreadable') {
      setLinkImport({ status: 'unreadable', blockedShop: result.blockedShop })
    } else {
      setLinkImport({ status: 'failed' })
    }
  }

  const primaryLabel =
    step === 'photo' && !draft.image
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
              <LinkImport
                url={draft.url}
                onChangeUrl={url => {
                  setDraft({ ...draft, url })
                  if (linkImport.status !== 'importing')
                    setLinkImport({ status: 'idle' })
                }}
                state={linkImport}
                onImport={createFromLink}
              />
            </>
          ) : step === 'photo' ? (
            <>
              <StepHeading>{t('addPresent.photo.heading')}</StepHeading>
              <PresentPhoto
                draft={draft}
                onChange={setDraft}
                size={160}
                mode={mode}
              />
            </>
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
              review={review}
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
          disabled={linkImport.status === 'importing' || (isLast && offline)}
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
  note,
  autoFocus,
  onSubmitEditing,
}: FieldsProps & {
  errorMessage?: string
  note?: string
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
      note={note}
      autoFocus={autoFocus}
      returnKeyType={onSubmitEditing ? 'next' : 'done'}
      onSubmitEditing={onSubmitEditing}
      submitBehavior={onSubmitEditing ? 'submit' : undefined}
    />
  )
}

function DetailFields({
  draft,
  onChange,
  descriptionNote,
}: FieldsProps & { descriptionNote?: string }) {
  const { t } = useTranslation()
  return (
    <>
      <GarlandField
        label={t('addPresent.descriptionLabel')}
        value={draft.description}
        onChangeText={description => onChange({ ...draft, description })}
        placeholder={t('addPresent.descriptionPlaceholder')}
        note={descriptionNote}
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

// `5a`'s other way in: paste a shop link and the import fills the rest. The
// link is the draft's own, so after a failed import it stays for `5c`.
function LinkImport({
  url,
  onChangeUrl,
  state,
  onImport,
}: {
  url: string
  onChangeUrl: (url: string) => void
  state: LinkImportState
  onImport: () => void
}) {
  const { t } = useTranslation()
  const offline = useOffline()
  const importing = state.status === 'importing'
  return (
    <View className="mt-2">
      <View className="mb-5 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-garland-ink-08" />
        <Text className="text-xs text-garland-ink-40">
          {t('addPresent.link.or')}
        </Text>
        <View className="h-px flex-1 bg-garland-ink-08" />
      </View>
      <GarlandField
        label={t('addPresent.link.label')}
        value={url}
        onChangeText={onChangeUrl}
        placeholder={t('addPresent.link.placeholder')}
        note={state.status === 'idle' ? t('addPresent.link.hint') : undefined}
        editable={!importing}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={onImport}
      />
      <GarlandButton
        variant="outline"
        onPress={onImport}
        disabled={!url.trim() || offline}
        loading={importing}
      >
        <GarlandButtonText>{t('addPresent.link.create')}</GarlandButtonText>
      </GarlandButton>
      {state.status === 'unreadable' ? (
        <Text className="mt-3 text-xs leading-[17px] text-garland-ink-60">
          {state.blockedShop
            ? t('addPresent.link.blocked', {
                shop: blockedShopName(state.blockedShop),
              })
            : t('addPresent.link.unreadable')}
        </Text>
      ) : state.status === 'failed' ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-x-2">
          <Text className="text-xs leading-[17px] text-garland-ink-60">
            {t('addPresent.link.failed')}
          </Text>

          <GarlandButton variant="link" onPress={onImport} hitSlop={10}>
            <GarlandButtonText className="text-xs font-semibold text-garland-ink">
              {t('addPresent.link.tryAgain')}
            </GarlandButtonText>
          </GarlandButton>
        </View>
      ) : null}
    </View>
  )
}

// `5b`, and the picture on `5d`: one photo or illustration per present, or
// none (the fallback). While editing it can be removed, and so can an
// imported shop photo, so it need not be kept.
function PresentPhoto({
  draft,
  onChange,
  size,
  mode,
  layout,
}: FieldsProps & {
  size: number
  mode: GiftWizardMode
  layout?: 'grid' | 'row'
}) {
  const { t } = useTranslation()
  return (
    <ImagePickerGrid
      art="present"
      value={draft.image}
      onChange={image => onChange({ ...draft, image })}
      removable={mode === 'edit' || draft.image?.kind === 'remote'}
      layout={layout}
      preview={
        draft.image ? (
          <PresentTile
            gift={{ _id: '', image: draft.image }}
            size={size}
            radius={20}
            derivative={1000}
          />
        ) : (
          <View
            className="items-center justify-center rounded-[20px] border-[1.5px] border-dashed border-garland-ink-15 px-3"
            style={{ width: size, height: size }}
          >
            <Text className="text-center text-[13px] leading-[19px] text-garland-ink-60">
              {t('addPresent.photo.noPhoto')}
            </Text>
          </View>
        )
      }
    />
  )
}

// `5d`: every field editable in place. The recipient is write-once, so it
// can only be picked while adding.
function SummaryStep({
  mode,
  event,
  draft,
  onChange,
  review,
  titleError,
  recipientError,
}: FieldsProps & {
  mode: GiftWizardMode
  event: EventDoc
  // Set after a link import: the import review hint.
  review: Missing | null
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

      {review ? (
        <Text className="-mt-3 mb-5 rounded-xl bg-garland-paper2 px-3.5 py-2.5 text-xs leading-[17px] text-garland-ink-60">
          {t('addPresent.review.generic')}
        </Text>
      ) : null}

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

      <View className="my-4 border-b border-garland-ink-08 pb-5">
        <PresentPhoto
          draft={draft}
          onChange={onChange}
          size={120}
          mode={mode}
          layout="row"
        />
        {review?.includes('image') ? (
          <Text className="mt-3 text-center text-xs leading-[17px] text-garland-ink-60">
            {t('addPresent.review.image')}
          </Text>
        ) : null}
      </View>

      <TitleField
        draft={draft}
        onChange={onChange}
        errorMessage={titleError}
        note={
          review?.includes('title') ? t('addPresent.review.title') : undefined
        }
      />
      <DetailFields
        draft={draft}
        onChange={onChange}
        descriptionNote={
          review?.includes('description')
            ? t('addPresent.review.description')
            : undefined
        }
      />
    </>
  )
}

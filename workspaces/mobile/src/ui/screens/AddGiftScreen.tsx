import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import type { EventDoc, GiftDoc, ImportedFields } from '@prezentowo/types'
import { router, useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { type DraftImage, uploadDraftImage } from '@/api/draftImage'
import {
  type GiftDraft,
  type GiftWizardMode,
  draftFromGift,
  draftFromImport,
  emptyGiftDraft,
  giftStepError,
  giftWizardSteps,
  isWebLink,
  startingRecipient,
  toAddGiftArgs,
  toUpdateGiftArgs,
  withStockImage,
} from '@/api/giftWizard'
import { addGift, removeGift, updateGift } from '@/api/gifts'
import { downloadImage, uploadImage } from '@/api/images'
import { blockedShopName, importLink } from '@/api/linkImport'
import { canEditGift, claimCountForRemoval } from '@/api/presentLists'
import { CloseIcon, LinkIcon, PencilIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
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
// from), or, with `giftId`, edits one from `1e` on the summary, where it can
// also be deleted.
export function AddGiftScreen({
  eventId,
  forParticipantId,
  giftId,
}: {
  eventId: string
  forParticipantId?: string
  giftId?: string
}) {
  return (
    // The app-wide provider sits under this native modal, where its sheets
    // would never show; the summary's picture sheet needs one inside.
    <BottomSheetModalProvider>
      {giftId ? (
        <EditGift eventId={eventId} giftId={giftId} />
      ) : (
        <AddGift eventId={eventId} forParticipantId={forParticipantId} />
      )}
    </BottomSheetModalProvider>
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
        // A link import's photo is fetched to the device now, so a queued
        // add carries a local file, not the shop's URL (docs/spec.md §6.3).
        const image =
          draft.image?.kind === 'remote'
            ? {
                kind: 'local' as const,
                uri: await downloadImage(draft.image.uri),
              }
            : draft.image
        await addGift(toAddGiftArgs(event._id, { ...draft, image }))
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
      footer={<DeleteGift gift={gift} />}
    />
  )
}

// Always through a confirm dialog, which adds "N people claimed this" only
// when the viewer's copy carries `claimedBy`. Online-only. On success it
// leaves the deleted present's `1e` too.
function DeleteGift({ gift }: { gift: GiftDoc }) {
  const { t } = useTranslation()
  const offline = useOffline()
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setError(null)
    setRemoving(true)
    try {
      await removeGift(gift._id)
      router.dismiss(2)
    } catch (err) {
      setError(errorMessage(err, t('common.somethingWentWrong')))
      setRemoving(false)
    }
  }

  const confirmRemove = () => {
    const claimCount = claimCountForRemoval(gift)
    Alert.alert(
      t('present.deleteTitle', { title: gift.title }),
      [
        t('present.deleteMessage'),
        claimCount ? t('present.deleteClaimed', { count: claimCount }) : null,
      ]
        .filter(Boolean)
        .join(' '),
      [
        { text: t('present.deleteCancel'), style: 'cancel' },
        {
          text: t('present.delete'),
          style: 'destructive',
          onPress: () => void remove(),
        },
      ],
    )
  }

  return (
    <View className="mt-10 border-t border-garland-ink-08 pt-5">
      <GarlandButton
        variant="link"
        onPress={confirmRemove}
        loading={removing}
        disabled={offline}
        className="self-start"
        hitSlop={12}
      >
        <GarlandButtonText className="text-sm font-bold text-garland-berry">
          {t('present.delete')}
        </GarlandButtonText>
      </GarlandButton>
      {error ? (
        <Text className="mt-3 text-xs text-garland-berry">{error}</Text>
      ) : null}
    </View>
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
  | { status: 'invalid' }
  | { status: 'unreadable'; blockedShop?: string }
  | { status: 'failed' }

function GiftWizard({
  mode,
  event,
  initialDraft,
  onSubmit,
  footer,
}: {
  mode: GiftWizardMode
  event: EventDoc
  initialDraft: GiftDraft
  // Navigates away on success (or once an add is queued); a rejection is
  // shown on the summary.
  onSubmit: (draft: GiftDraft) => Promise<void>
  // Under the last step, e.g. the edit's Delete present.
  footer?: ReactNode
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
      const nextStep = steps[index + 1]!
      if (nextStep === 'summary' && mode === 'add')
        setDraft(withStockImage(draft))
      setStep(nextStep)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    leaving.current = true
    try {
      if (mode === 'add') {
        // The add uploads its own photo — later, if it's queued offline.
        await onSubmit(draft)
      } else {
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
      }
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
    if (!isWebLink(draft.url)) {
      setLinkImport({ status: 'invalid' })
      return
    }
    setLinkImport({ status: 'importing' })
    const result = await importLink(draft.url)
    if (result.outcome === 'success') {
      setDraft(current =>
        withStockImage(draftFromImport(current, result.fields)),
      )
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
  const linkError =
    showError && error === 'linkInvalid'
      ? t('addPresent.errors.linkInvalid')
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
              <PresentPhoto draft={draft} onChange={setDraft} />
            </>
          ) : step === 'details' ? (
            <>
              <StepHeading>{t('addPresent.details.heading')}</StepHeading>
              <View className="gap-5">
                <DetailFields
                  draft={draft}
                  onChange={setDraft}
                  linkError={linkError}
                />
              </View>
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
              linkError={linkError}
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

          {isLast ? footer : null}
        </ScrollView>

        <WizardFooter
          primaryLabel={primaryLabel}
          primaryIcon={!isLast ? 'forward' : mode === 'add' ? 'add' : 'save'}
          onPrimary={next}
          onBack={index > 0 ? goBack : undefined}
          submitting={submitting}
          // An add queues offline (docs/spec.md §6.3); an edit can't.
          disabled={
            linkImport.status === 'importing' ||
            (isLast && offline && mode === 'edit')
          }
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
  linkError,
}: FieldsProps & { descriptionNote?: string; linkError?: string }) {
  const { t } = useTranslation()
  return (
    <>
      <GarlandField
        label={t('addPresent.descriptionLabel')}
        value={draft.description}
        onChangeText={description => onChange({ ...draft, description })}
        note={descriptionNote}
        multiline
      />
      <GarlandField
        label={t('addPresent.linkLabel')}
        value={draft.url}
        onChangeText={url => onChange({ ...draft, url })}
        errorMessage={linkError}
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
    <View>
      <Text className="mb-8 mt-6 text-center text-xs text-garland-ink-40">
        {t('addPresent.link.or')}
      </Text>
      <GarlandField
        label={t('addPresent.link.label')}
        value={url}
        onChangeText={onChangeUrl}
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
        <LinkIcon width={18} height={18} color={garland.ink} />
        <GarlandButtonText>{t('addPresent.link.create')}</GarlandButtonText>
      </GarlandButton>
      {state.status === 'invalid' ? (
        <Text className="mt-3 text-xs leading-[17px] text-garland-berry">
          {t('addPresent.link.invalid')}
        </Text>
      ) : state.status === 'unreadable' ? (
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

// `5b`: one photo or illustration per present, or none (the fallback). An
// imported shop photo can be removed, so it need not be kept.
function PresentPhoto({ draft, onChange }: FieldsProps) {
  return (
    <ImagePickerGrid
      art="present"
      value={draft.image}
      onChange={image => onChange({ ...draft, image })}
      removable={draft.image?.kind === 'remote'}
      preview={<PhotoPreview image={draft.image} size={160} />}
    />
  )
}

// How the present's picture will look, or a note when there's none.
function PhotoPreview({
  image,
  size,
}: {
  image: DraftImage | undefined
  size: number
}) {
  const { t } = useTranslation()
  return image ? (
    <PresentTile
      gift={{ _id: '', image }}
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

// `5d`'s picture, with a ✎: tapping it opens `5b`'s picker in a sheet, which
// closes on a pick. While editing the picture can be removed, and so can an
// imported shop photo.
function SummaryPhoto({
  draft,
  onChange,
  mode,
}: FieldsProps & { mode: GiftWizardMode }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheetModal>(null)
  const dismiss = () => sheetRef.current?.dismiss()

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.4}
    />
  )

  return (
    <>
      <Pressable
        onPress={() => sheetRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel={t('addPresent.photo.change')}
        className="self-center active:opacity-70"
      >
        <PhotoPreview image={draft.image} size={120} />
        <View className="absolute -bottom-2 -right-2 h-9 w-9 items-center justify-center rounded-full border border-garland-ink-08 bg-garland-paper">
          <PencilIcon width={16} height={16} color={garland.ink} />
        </View>
      </Pressable>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['85%']}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: garland.paper }}
        handleIndicatorStyle={{ backgroundColor: garland.ink40 }}
      >
        <View className="flex-row items-center justify-between px-[22px] pb-3 pt-1">
          <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
            {t('addPresent.photo.sheetTitle')}
          </Text>
          <Pressable onPress={dismiss} hitSlop={12}>
            <CloseIcon width={20} height={20} color={garland.ink40} />
          </Pressable>
        </View>
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <ImagePickerGrid
            art="present"
            value={draft.image}
            onChange={image => {
              onChange({ ...draft, image })
              dismiss()
            }}
            removable={mode === 'edit' || draft.image?.kind === 'remote'}
            deselectable={false}
          />
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  )
}

// `5d`: every field editable in place, but the recipient: it's write-once,
// set by the list the wizard was opened from.
function SummaryStep({
  mode,
  event,
  draft,
  onChange,
  review,
  titleError,
  linkError,
  recipientError,
}: FieldsProps & {
  mode: GiftWizardMode
  event: EventDoc
  // Set after a link import: the import review hint.
  review: Missing | null
  titleError?: string
  linkError?: string
  recipientError?: string
}) {
  const { t } = useTranslation()
  const { resolve } = useEventParticipants(event._id)
  const nameOf = usePersonName()
  const person = draft.forParticipantId
    ? resolve(draft.forParticipantId)
    : undefined

  return (
    <>
      {/* Editing opens straight on this step: the header says it all. */}
      {mode === 'add' ? (
        <StepHeading>{t('addPresent.summary.heading')}</StepHeading>
      ) : null}

      {review ? (
        <Text className="-mt-3 mb-5 rounded-xl bg-garland-paper2 px-3.5 py-2.5 text-xs leading-[17px] text-garland-ink-60">
          {t('addPresent.review.generic')}
        </Text>
      ) : null}

      <Text
        className={`text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40 ${mode === 'edit' ? 'mt-4' : ''}`}
      >
        {t('addPresent.summary.forLabel')}
      </Text>
      {draft.forParticipantId ? (
        <View className="mt-2 flex-row items-center gap-2 self-start rounded-full bg-garland-paper2 py-1 pl-1 pr-3.5">
          <ParticipantAvatar
            name={person?.name ?? ''}
            avatarKey={person?.avatarKey}
            photo={person?.photo}
            color={person?.color}
            size={28}
          />
          <Text className="text-sm font-semibold text-garland-ink">
            {nameOf(person)}
          </Text>
        </View>
      ) : null}
      {recipientError ? (
        <Text className="mt-1.5 text-xs text-garland-berry">
          {recipientError}
        </Text>
      ) : null}

      <View className="my-4 pb-5">
        <SummaryPhoto draft={draft} onChange={onChange} mode={mode} />
        {review?.includes('image') ? (
          <Text className="mt-4 text-center text-xs leading-[17px] text-garland-ink-60">
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
        linkError={linkError}
      />
    </>
  )
}

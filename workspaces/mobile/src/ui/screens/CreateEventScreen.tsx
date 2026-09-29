import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { router, useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  type DraftPerson,
  type EventDraft,
  type EventType,
  type WizardMode,
  type WizardStep,
  addPlaceholder,
  draftFromEvent,
  emptyDraft,
  firstInvalidStep,
  removePerson,
  setPlaceholderAvatar,
  stepError,
  toCreateEventArgs,
  toUpdateEventArgs,
  wizardSteps,
} from '@/api/eventWizard'
import { createEvent, updateEvent } from '@/api/events'
import { CheckIcon, CloseIcon, PlusIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { type AvatarKey, isAvatarKey } from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { errorMessage } from '@/localization/errorMessage'
import {
  AvatarPickerModal,
  type AvatarPickerModalHandle,
} from '@/ui/components/AvatarPickerModal'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { GarlandField } from '@/ui/components/GarlandField'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { ScreenHeader } from '@/ui/components/ScreenHeader'
import { SheetKeyboardAvoidingView } from '@/ui/components/SheetKeyboardAvoidingView'

// How a person in the draft is shown.
type PersonView = { name: string; avatarKey?: string; color?: string }

const placeholderView = (
  person: Extract<DraftPerson, { kind: 'placeholder' }>,
): PersonView => ({
  name: person.name,
  avatarKey: person.avatar,
  color: person.color,
})

// `4a`–`4e`: creates an event, or, with `eventId`, edits one from `6a`
// starting at `start`.
export function CreateEventScreen({
  start,
  eventId,
}: {
  start: WizardStep
  eventId?: string
}) {
  return (
    // The app-wide provider sits under this native modal, where its sheets
    // would never show; the avatar picker needs one inside.
    <BottomSheetModalProvider>
      {eventId ? (
        <EditEvent eventId={eventId} start={start} />
      ) : (
        <CreateEvent start={start} />
      )}
    </BottomSheetModalProvider>
  )
}

function CreateEvent({ start }: { start: WizardStep }) {
  const user = useCurrentUser()
  const { t } = useTranslation()
  const you: PersonView = {
    name: user?.profile?.name ?? t('createEvent.people.you'),
    avatarKey: user?.profile?.avatar,
  }

  return (
    <EventWizard
      mode="create"
      start={start}
      initialDraft={emptyDraft()}
      viewOf={person =>
        person.kind === 'placeholder' ? placeholderView(person) : you
      }
      onSubmit={async draft => {
        if (!user) throw new Error('signedOut')
        const { _id } = await createEvent(toCreateEventArgs(draft, user._id))
        router.replace({
          pathname: '/event/[eventId]',
          params: { eventId: _id },
        })
      }}
    />
  )
}

function EditEvent({ eventId, start }: { eventId: string; start: WizardStep }) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { event, ready } = useEventById(eventId)
  const { resolve } = useEventParticipants(eventId)

  if (!event || !user) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <ScreenHeader title={t('shell.editEvent')} variant="modal" />
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {ready ? t('createEvent.notFound') : t('createEvent.loading')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <EventWizard
      mode="edit"
      start={start}
      initialDraft={draftFromEvent(event, user._id)}
      viewOf={person => {
        if (person.kind === 'placeholder') return placeholderView(person)
        const resolved = resolve(person.key)
        return {
          name: resolved?.name ?? '',
          avatarKey: resolved?.avatarKey,
          color: resolved?.color,
        }
      }}
      onSubmit={async draft => {
        await updateEvent(toUpdateEventArgs(event, draft))
        router.back()
      }}
    />
  )
}

function EventWizard({
  mode,
  start,
  initialDraft,
  viewOf,
  onSubmit,
}: {
  mode: WizardMode
  start: WizardStep
  initialDraft: EventDraft
  viewOf: (person: DraftPerson) => PersonView
  // Navigates away on success; a rejection is shown on the last step.
  onSubmit: (draft: EventDraft) => Promise<void>
}) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [draft, setDraft] = useState(initialDraft)
  const [chosenStep, setStep] = useState(start)
  const [showError, setShowError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Set just before the wizard leaves on purpose (close, or after saving),
  // so the back-steps-back guard lets that navigation through.
  const leaving = useRef(false)

  const steps = wizardSteps(mode, start, draft.type)
  // A step can drop out (e.g. `4e` before a kind is chosen); show the first.
  const step = steps.includes(chosenStep) ? chosenStep : steps[0]!
  const index = steps.indexOf(step)
  const isLast = index === steps.length - 1
  const error = stepError(step, draft)

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

  const leave = (navigate: () => void) => {
    leaving.current = true
    navigate()
  }

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
    const unfinished = firstInvalidStep(steps, draft)
    if (unfinished) {
      setStep(unfinished)
      setShowError(true)
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
          mode === 'create'
            ? t('createEvent.createFailed')
            : t('createEvent.saveFailed'),
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const title =
    mode === 'create' ? t('shell.createEvent') : t('shell.editEvent')
  const primaryLabel = !isLast
    ? t('createEvent.next')
    : mode === 'create'
      ? t('createEvent.create')
      : t('createEvent.save')

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <SheetKeyboardAvoidingView>
        <ScreenHeader
          title={title}
          variant="modal"
          onClose={() => leave(() => router.back())}
        />
        {steps.length > 1 ? (
          <Progress index={index} count={steps.length} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'details' ? (
            <DetailsStep draft={draft} onChange={setDraft} />
          ) : step === 'kind' ? (
            <KindStep
              type={draft.type}
              onChange={type => setDraft({ ...draft, type })}
            />
          ) : step === 'people' ? (
            <PeopleStep draft={draft} onChange={setDraft} viewOf={viewOf} />
          ) : (
            <BeneficiaryStep
              draft={draft}
              onChange={beneficiaryKey =>
                setDraft({ ...draft, beneficiaryKey })
              }
              viewOf={viewOf}
            />
          )}

          {showError && error ? (
            <Text className="mt-3 text-xs text-garland-berry">
              {t(`createEvent.errors.${error}`)}
            </Text>
          ) : null}
          {submitError ? (
            <Text className="mt-3 text-xs text-garland-berry">
              {submitError}
            </Text>
          ) : null}
        </ScrollView>

        <View className="flex-row gap-3 border-t border-garland-ink-08 px-[22px] pb-2 pt-3">
          {/* Wrapped so both halves are equal: the button's own padding
              skews flex-1 on the button itself. */}
          {index > 0 ? (
            <View className="flex-1">
              <GarlandButton
                variant="outline"
                onPress={goBack}
                disabled={submitting}
              >
                <GarlandButtonText>{t('createEvent.back')}</GarlandButtonText>
              </GarlandButton>
            </View>
          ) : null}
          <View className="flex-1">
            <GarlandButton onPress={next} loading={submitting}>
              <GarlandButtonText>{primaryLabel}</GarlandButtonText>
            </GarlandButton>
          </View>
        </View>
      </SheetKeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Progress({ index, count }: { index: number; count: number }) {
  const { t } = useTranslation()
  return (
    <View className="px-[22px] pb-4">
      <View
        className="flex-row gap-1.5"
        accessibilityRole="progressbar"
        accessibilityLabel={t('createEvent.stepOf', {
          step: index + 1,
          count,
        })}
      >
        {Array.from({ length: count }, (_, i) => (
          <View
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i <= index ? 'bg-garland-ink' : 'bg-garland-ink-15'
            }`}
          />
        ))}
      </View>
      <Text className="mt-2 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
        {t('createEvent.stepOf', { step: index + 1, count })}
      </Text>
    </View>
  )
}

function StepHeading({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-[22px] mt-1.5 font-garland-display text-[28px] leading-[31px] text-garland-ink">
      {children}
    </Text>
  )
}

// `4a`
function DetailsStep({
  draft,
  onChange,
}: {
  draft: EventDraft
  onChange: (draft: EventDraft) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <StepHeading>{t('createEvent.details.heading')}</StepHeading>
      <GarlandField
        label={t('createEvent.details.nameLabel')}
        value={draft.title}
        onChangeText={title => onChange({ ...draft, title })}
        placeholder={t('createEvent.details.namePlaceholder')}
        returnKeyType="next"
      />
      <GarlandField
        label={t('createEvent.details.dateLabel')}
        value={draft.date}
        onChangeText={date => onChange({ ...draft, date })}
        placeholder={t('createEvent.details.datePlaceholder')}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        maxLength={10}
      />
      <Text className="text-xs leading-[17px] text-garland-ink-60">
        {t('createEvent.details.dateHint')}
      </Text>
    </>
  )
}

// `4b`
function KindStep({
  type,
  onChange,
}: {
  type: EventType | undefined
  onChange: (type: EventType) => void
}) {
  const { t } = useTranslation()
  const options: { type: EventType; title: string; examples: string }[] = [
    {
      type: 'many-to-many',
      title: t('createEvent.kind.manyToMany'),
      examples: t('createEvent.kind.manyToManyExamples'),
    },
    {
      type: 'many-to-one',
      title: t('createEvent.kind.manyToOne'),
      examples: t('createEvent.kind.manyToOneExamples'),
    },
  ]
  return (
    <>
      <StepHeading>{t('createEvent.kind.heading')}</StepHeading>
      <View className="gap-3">
        {options.map(option => {
          const selected = option.type === type
          return (
            <Pressable
              key={option.type}
              onPress={() => onChange(option.type)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`flex-row items-center gap-3 rounded-2xl border-[1.5px] px-4 py-4 active:opacity-70 ${
                selected
                  ? 'border-garland-ink bg-garland-paper2'
                  : 'border-garland-ink-15'
              }`}
            >
              <View className="min-w-0 flex-1">
                <Text className="text-base font-bold text-garland-ink">
                  {option.title}
                </Text>
                <Text className="mt-0.5 text-[13px] text-garland-ink-60">
                  {option.examples}
                </Text>
              </View>
              <Check selected={selected} />
            </Pressable>
          )
        })}
      </View>
    </>
  )
}

// `4d`
function PeopleStep({
  draft,
  onChange,
  viewOf,
}: {
  draft: EventDraft
  onChange: (draft: EventDraft) => void
  viewOf: (person: DraftPerson) => PersonView
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [avatarTarget, setAvatarTarget] = useState<string | null>(null)
  const avatarPicker = useRef<AvatarPickerModalHandle>(null)

  const add = () => {
    onChange(addPlaceholder(draft, name))
    setName('')
  }

  const target = draft.people.find(p => p.key === avatarTarget)
  const targetAvatar =
    target?.kind === 'placeholder' && isAvatarKey(target.avatar)
      ? target.avatar
      : null

  return (
    <>
      <StepHeading>{t('createEvent.people.heading')}</StepHeading>
      <View className="border-t border-garland-ink-08">
        {draft.people.map(person => {
          const view = viewOf(person)
          const isPlaceholder = person.kind === 'placeholder'
          return (
            <View
              key={person.key}
              className="flex-row items-center gap-3 border-b border-garland-ink-08 py-3"
            >
              <Pressable
                disabled={!isPlaceholder}
                onPress={() => {
                  // The keyboard would cover the sheet.
                  Keyboard.dismiss()
                  setAvatarTarget(person.key)
                  avatarPicker.current?.present()
                }}
                accessibilityRole={isPlaceholder ? 'button' : undefined}
                accessibilityLabel={
                  isPlaceholder
                    ? t('createEvent.people.pickAvatar', { name: view.name })
                    : undefined
                }
                className="active:opacity-70"
              >
                <ParticipantAvatar
                  name={view.name}
                  avatarKey={view.avatarKey}
                  color={view.color}
                  size={36}
                />
              </Pressable>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text
                    className="text-sm font-bold text-garland-ink"
                    numberOfLines={1}
                  >
                    {view.name}
                  </Text>
                  {person.kind === 'you' ? (
                    <Text className="text-[10px] font-bold uppercase tracking-[1px] text-garland-green">
                      {t('createEvent.people.host')}
                    </Text>
                  ) : null}
                </View>
                <Text className="mt-0.5 text-[11px] text-garland-ink-40">
                  {isPlaceholder
                    ? t('createEvent.people.addedByName')
                    : t('createEvent.people.onPrezentowo')}
                </Text>
              </View>
              {isPlaceholder ? (
                <Pressable
                  onPress={() => onChange(removePerson(draft, person.key))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('createEvent.people.remove', {
                    name: view.name,
                  })}
                >
                  <CloseIcon width={16} height={16} color={garland.ink40} />
                </Pressable>
              ) : null}
            </View>
          )
        })}

        <View className="flex-row items-center gap-3 py-3">
          <View className="size-9 items-center justify-center rounded-full border-[1.5px] border-dashed border-garland-ink-15">
            <PlusIcon width={14} height={14} color={garland.ink40} />
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={add}
            submitBehavior="submit"
            returnKeyType="done"
            placeholder={t('createEvent.people.namePlaceholder')}
            placeholderTextColor={garland.ink40}
            accessibilityLabel={t('createEvent.people.namePlaceholder')}
            className="flex-1 py-2.5 text-sm text-garland-ink"
          />
          <GarlandButton
            variant="link"
            onPress={add}
            disabled={!name.trim()}
            hitSlop={10}
          >
            <GarlandButtonText className="font-bold text-garland-green">
              {t('createEvent.people.add')}
            </GarlandButtonText>
          </GarlandButton>
        </View>
      </View>

      <View className="mt-4 rounded-xl bg-garland-paper2 px-3.5 py-2.5">
        <Text className="text-xs leading-[17px] text-garland-ink-60">
          {t('createEvent.people.joinLater')}
        </Text>
      </View>

      <AvatarPickerModal
        ref={avatarPicker}
        value={targetAvatar}
        onConfirm={(key: AvatarKey) => {
          if (avatarTarget)
            onChange(setPlaceholderAvatar(draft, avatarTarget, key))
        }}
      />
    </>
  )
}

// `4e`
function BeneficiaryStep({
  draft,
  onChange,
  viewOf,
}: {
  draft: EventDraft
  onChange: (key: string) => void
  viewOf: (person: DraftPerson) => PersonView
}) {
  const { t } = useTranslation()
  return (
    <>
      <StepHeading>{t('createEvent.beneficiary.heading')}</StepHeading>
      <Text className="-mt-3 mb-4 text-[13px] text-garland-ink-60">
        {t('createEvent.beneficiary.hint')}
      </Text>
      <View className="border-t border-garland-ink-08">
        {draft.people.map(person => {
          const view = viewOf(person)
          const selected = person.key === draft.beneficiaryKey
          return (
            <Pressable
              key={person.key}
              onPress={() => onChange(person.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className="flex-row items-center gap-3 border-b border-garland-ink-08 py-3 active:opacity-70"
            >
              <ParticipantAvatar
                name={view.name}
                avatarKey={view.avatarKey}
                color={view.color}
                size={36}
              />
              <Text
                className="min-w-0 flex-1 text-sm font-bold text-garland-ink"
                numberOfLines={1}
              >
                {person.kind === 'you'
                  ? t('createEvent.beneficiary.you', { name: view.name })
                  : view.name}
              </Text>
              <Check selected={selected} />
            </Pressable>
          )
        })}
      </View>
    </>
  )
}

function Check({ selected }: { selected: boolean }) {
  return (
    <View
      className={`size-6 items-center justify-center rounded-full border-[1.5px] ${
        selected ? 'border-garland-ink bg-garland-ink' : 'border-garland-ink-15'
      }`}
    >
      {selected ? (
        <CheckIcon width={14} height={14} color={garland.paper} />
      ) : null}
    </View>
  )
}

// PROTOTYPE (#86) — throwaway. Floating variant switcher + fake-state panel.
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/ui/text'

import { type Permission, VARIANTS, setProto, useProto } from './store'

const PERMISSIONS: Permission[] = ['undetermined', 'granted', 'denied']

export function PrototypeBar({ showVariants }: { showVariants: boolean }) {
  const s = useProto()
  const insets = useSafeAreaInsets()
  if (!__DEV__) return null

  const index = VARIANTS.findIndex(v => v.key === s.variant)
  const current = VARIANTS[index]
  const step = (d: number) =>
    setProto({
      variant: VARIANTS[(index + d + VARIANTS.length) % VARIANTS.length].key,
    })

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 8,
        alignItems: 'center',
      }}
    >
      {s.panelOpen ? (
        <View className="mb-2 w-[92%] gap-2 rounded-2xl bg-[#222] p-3">
          <Row label="OS permission">
            {PERMISSIONS.map(p => (
              <Chip
                key={p}
                label={p}
                on={s.permission === p}
                onPress={() => setProto({ permission: p })}
              />
            ))}
          </Row>
          <Row label="Connection">
            <Chip
              label="online"
              on={!s.offline}
              onPress={() => setProto({ offline: false })}
            />
            <Chip
              label="offline"
              on={s.offline}
              onPress={() => setProto({ offline: true })}
            />
          </Row>
          <Row label="Queued writes">
            {[0, 1, 3].map(n => (
              <Chip
                key={n}
                label={String(n)}
                on={s.queued === n}
                onPress={() => setProto({ queued: n })}
              />
            ))}
          </Row>
          <Row label="Own photo">
            <Chip
              label="stock"
              on={!s.hasPhoto}
              onPress={() => setProto({ hasPhoto: false })}
            />
            <Chip
              label="photo"
              on={s.hasPhoto}
              onPress={() => setProto({ hasPhoto: true })}
            />
          </Row>
          <Chip
            label="▶ Show pre-prompt (after 1st create/join)"
            on={false}
            onPress={() => setProto({ prePromptOpen: true, panelOpen: false })}
          />
        </View>
      ) : null}

      <View className="flex-row items-center gap-1 rounded-full bg-[#222] px-2 py-1.5">
        {showVariants ? (
          <>
            <BarButton label="‹" onPress={() => step(-1)} />
            <Text className="min-w-[150px] text-center text-[13px] font-semibold text-white">
              {current.key} — {current.name}
            </Text>
            <BarButton label="›" onPress={() => step(1)} />
          </>
        ) : (
          <Text className="px-2 text-[13px] font-semibold text-white">
            Prototype state
          </Text>
        )}
        <BarButton
          label={s.panelOpen ? '✕' : '⚙'}
          onPress={() => setProto({ panelOpen: !s.panelOpen })}
        />
      </View>
    </View>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="w-[92px] text-[11px] text-white/60">{label}</Text>
      {children}
    </View>
  )
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string
  on: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-2.5 py-1 ${on ? 'bg-white' : 'bg-white/15'}`}
    >
      <Text
        className={`text-[11px] font-semibold ${on ? 'text-black' : 'text-white'}`}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function BarButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="size-8 items-center justify-center rounded-full bg-white/15"
    >
      <Text className="text-base font-bold text-white">{label}</Text>
    </Pressable>
  )
}

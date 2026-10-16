import { PRESENT_THEME_IDS, type PresentThemeId } from '@prezentowo/types'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'

import type { DraftImage } from '@/api/draftImage'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { PresentHero } from '@/ui/components/presentHero/PresentHero'

const WIDTH = 88
const HEIGHT = 84
const TILE = 54
const RADIUS = 12

// `5b` and `5d`: how the present's picture is staged on `1e`, each theme a
// still thumbnail of this present's picture on its tone, in a sideways row
// with a ring on the current pick.
export function PresentThemePicker({
  value,
  onChange,
  gift,
  tone,
}: {
  value: PresentThemeId
  onChange: (theme: PresentThemeId) => void
  // The picture to show; `_id` seeds the fallback illustration.
  gift: { _id: string; image?: DraftImage }
  tone: string
}) {
  const { t } = useTranslation()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-[22px]"
      contentContainerStyle={{ paddingHorizontal: 22, gap: 8 }}
    >
      {PRESENT_THEME_IDS.map(id => {
        const selected = id === value
        const name = t(`addPresent.theme.names.${id}`)
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={name}
            className="items-center active:opacity-70"
          >
            <View
              style={{
                width: WIDTH,
                height: HEIGHT,
                borderRadius: RADIUS,
                borderWidth: 2.5,
                borderColor: selected ? garland.green : 'transparent',
                padding: 2,
              }}
            >
              <View
                className="flex-1 overflow-hidden"
                style={{ borderRadius: RADIUS - 3 }}
              >
                <PresentHero
                  theme={id}
                  still
                  gift={gift}
                  tone={tone}
                  tile={TILE}
                  tileTop={9}
                  width={WIDTH - 9}
                  height={HEIGHT - 9}
                  pending={false}
                  heroStyle={{ height: HEIGHT - 9 }}
                />
              </View>
            </View>
            <Text
              className={`mt-1 text-[11px] ${selected ? 'font-bold text-garland-ink' : 'text-garland-ink-60'}`}
              numberOfLines={1}
            >
              {name}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

import { Button, ButtonIcon } from '@/components/ui/button'
import { GlobeIcon } from '@/components/ui/icon'
import { switchLocale } from '@/localization/provider'

export function LanguageToggle() {
  return (
    <Button
      variant="link"
      action="default"
      onPress={switchLocale}
      className="h-auto p-1 opacity-50 data-[active=true]:opacity-30"
    >
      <ButtonIcon
        as={GlobeIcon}
        height={20}
        width={20}
        className="text-garland-ink"
      />
    </Button>
  )
}

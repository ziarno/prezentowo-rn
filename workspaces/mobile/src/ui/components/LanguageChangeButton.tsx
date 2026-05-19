import { Button, ButtonIcon } from '@/components/ui/button'
import { GlobeIcon } from '@/components/ui/icon'
import { useLanguageModal } from '@/localization/LanguageModalProvider'

export function LanguageChangeButton() {
  const { open } = useLanguageModal()
  return (
    <Button
      variant="link"
      action="default"
      onPress={open}
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

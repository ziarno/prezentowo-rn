import { type ReactNode, createContext, useContext } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button'
import { garland } from '@/constants/garland'

export type GarlandButtonVariant = 'solid' | 'outline' | 'link'

const VariantContext = createContext<GarlandButtonVariant>('solid')

const BUTTON_CLASS: Record<GarlandButtonVariant, string> = {
  solid:
    'h-auto rounded-full bg-garland-ink px-[18px] py-[15px] data-[active=true]:bg-garland-ink data-[active=true]:opacity-70',
  outline:
    'h-auto rounded-full border-[1.5px] border-garland-ink-15 bg-transparent px-[18px] py-[13px] gap-2.5 data-[active=true]:opacity-70',
  link: 'data-[active=true]:opacity-50',
}

const TEXT_CLASS: Record<GarlandButtonVariant, string> = {
  solid: 'text-base font-semibold text-garland-paper',
  outline: 'text-base font-semibold text-garland-ink',
  link: 'text-[13px] text-garland-ink-60',
}

type GarlandButtonProps = {
  variant?: GarlandButtonVariant
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  children?: ReactNode
  className?: string
  hitSlop?:
    | number
    | { top: number; right: number; bottom: number; left: number }
}

export function GarlandButton({
  variant = 'solid',
  onPress,
  disabled,
  loading = false,
  children,
  className,
  hitSlop,
}: GarlandButtonProps) {
  return (
    <VariantContext.Provider value={variant}>
      <Button
        variant={variant === 'link' ? 'link' : 'solid'}
        action="default"
        onPress={onPress}
        disabled={disabled || loading}
        hitSlop={hitSlop}
        className={twMerge(BUTTON_CLASS[variant], className)}
      >
        {loading ? (
          <ButtonSpinner
            color={variant === 'solid' ? garland.paper : garland.ink}
          />
        ) : (
          children
        )}
      </Button>
    </VariantContext.Provider>
  )
}

type GarlandButtonTextProps = {
  children?: ReactNode
  className?: string
}

export function GarlandButtonText({
  children,
  className,
}: GarlandButtonTextProps) {
  const variant = useContext(VariantContext)
  return (
    <ButtonText className={twMerge(TEXT_CLASS[variant], className)}>
      {children}
    </ButtonText>
  )
}

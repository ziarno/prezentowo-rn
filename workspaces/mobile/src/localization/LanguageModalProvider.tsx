import {
  type BottomSheetModal,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet'
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react'

import { LanguageBottomModal } from '@/ui/components/LanguageBottomModal'

type LanguageModalContextValue = { open: () => void }

const LanguageModalContext = createContext<LanguageModalContextValue | null>(
  null,
)

export function LanguageModalProvider({ children }: { children: ReactNode }) {
  const modalRef = useRef<BottomSheetModal>(null)

  const open = useCallback(() => {
    modalRef.current?.present()
  }, [])

  const value = useMemo(() => ({ open }), [open])

  return (
    <BottomSheetModalProvider>
      <LanguageModalContext.Provider value={value}>
        {children}
        <LanguageBottomModal ref={modalRef} />
      </LanguageModalContext.Provider>
    </BottomSheetModalProvider>
  )
}

export function useLanguageModal() {
  const ctx = useContext(LanguageModalContext)
  if (!ctx) {
    throw new Error(
      'useLanguageModal must be used within a LanguageModalProvider',
    )
  }
  return ctx
}

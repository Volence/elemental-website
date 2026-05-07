import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { ConfirmDialogProvider } from '@/components/ConfirmDialog'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <HeaderThemeProvider>
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      </HeaderThemeProvider>
    </ThemeProvider>
  )
}

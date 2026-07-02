import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { ConfirmDialogProvider } from '@/components/ConfirmDialog'
import ChunkReloadGuard from '@/components/ChunkReloadGuard'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <HeaderThemeProvider>
        <ConfirmDialogProvider>
          <ChunkReloadGuard />
          {children}
        </ConfirmDialogProvider>
      </HeaderThemeProvider>
    </ThemeProvider>
  )
}

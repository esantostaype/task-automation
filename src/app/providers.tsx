'use client'
import { ToastNotification } from '@/components'
import { CssVarsProvider } from '@mui/joy'
import { dynamicTheme } from '@/themes/dynamicTheme'
import { QueryProvider } from '@/providers/QueryProvider'
import { AuthProvider } from '@/contexts/AuthContext'

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryProvider>
      <CssVarsProvider theme={dynamicTheme} defaultMode="dark">
          <AuthProvider>
            {children}
          </AuthProvider>
        <ToastNotification />
      </CssVarsProvider>
    </QueryProvider>
  )
}
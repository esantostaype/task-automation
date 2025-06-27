'use client'
import { ToastNotification } from '@/components'
import { CssVarsProvider } from '@mui/joy'
import { dynamicTheme } from '@/theme/dynamicTheme'

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
    <CssVarsProvider theme={ dynamicTheme } defaultMode="dark">
      { children }
      <ToastNotification/>
    </CssVarsProvider>
    </>
  )
}
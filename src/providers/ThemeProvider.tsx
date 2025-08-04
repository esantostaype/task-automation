'use client'
import { CssVarsProvider } from '@mui/joy';
import { dynamicTheme } from '@/themes/dynamicTheme';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <CssVarsProvider theme={dynamicTheme} defaultMode="dark">      
      {children}
    </CssVarsProvider>
  )
}
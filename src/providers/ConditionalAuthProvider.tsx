// src/providers/ConditionalAuthProvider.tsx - NUEVO ARCHIVO
'use client'

import { usePathname } from 'next/navigation'
import { AuthProvider } from '@/contexts/AuthContext'

// Rutas que NO necesitan AuthProvider
const PUBLIC_ROUTES = [
  '/login',
  '/register', // si lo tienes
  '/forgot-password', // si lo tienes
]

interface ConditionalAuthProviderProps {
  children: React.ReactNode
}

export function ConditionalAuthProvider({ children }: ConditionalAuthProviderProps) {
  const pathname = usePathname()
  
  // Si está en una ruta pública, no usar AuthProvider
  const isPublicRoute = pathname ? PUBLIC_ROUTES.includes(pathname) : false
  
  if (isPublicRoute) {
    console.log(`🔓 Public route detected: ${pathname} - Skipping AuthProvider`)
    return <>{children}</>
  }
  
  console.log(`🔒 Protected route detected: ${pathname} - Using AuthProvider`)
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}
// src/contexts/AuthContext.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  email: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Verificar autenticación al cargar
  const checkAuth = async () => {
    try {
      console.log('🔍 Checking authentication status...')
      
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      })

      const data = await response.json()
      console.log('Auth check result:', data)

      if (data.success && data.user) {
        setUser(data.user)
        console.log('✅ User authenticated:', data.user.email)
      } else {
        setUser(null)
        console.log('❌ User not authenticated')
      }
    } catch (error) {
      console.error('Error checking auth:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // Función de login
  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting login...')
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })

      const data = await response.json()
      console.log('Login response:', data)

      if (data.success) {
        setUser(data.user)
        console.log('✅ Login successful')
        
        // Obtener la URL de redirección de los query params
        const urlParams = new URLSearchParams(window.location.search)
        const from = urlParams.get('from') || '/'
        
        // Pequeño delay para asegurar que la cookie se establezca
        setTimeout(() => {
          router.push(from)
          router.refresh()
        }, 100)
        
        return { success: true }
      } else {
        console.log('❌ Login failed:', data.message)
        return { success: false, message: data.message }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, message: 'Network error occurred' }
    }
  }

  // Función de logout
  const logout = async () => {
    try {
      console.log('🚪 Logging out...')
      
      await fetch('/api/auth/login', {
        method: 'DELETE',
        credentials: 'include',
      })

      setUser(null)
      console.log('✅ Logout successful')
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      // Limpiar estado local incluso si hay error
      setUser(null)
      router.push('/login')
    }
  }

  // Verificar autenticación al montar el componente
  useEffect(() => {
    checkAuth()
  }, [])

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    checkAuth
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
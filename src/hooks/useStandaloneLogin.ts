// src/hooks/useStandaloneLogin.ts - NUEVO ARCHIVO
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface LoginResult {
  success: boolean
  message?: string
}

export function useStandaloneLogin() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true)
    
    try {
      console.log('🔐 Standalone Login: Attempting login...')
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })

      const data = await response.json()

      if (data.success) {
        console.log('✅ Standalone Login: Login successful')
        
        // Redirigir después del login exitoso
        router.push('/')
        
        return { success: true }
      } else {
        console.log('❌ Standalone Login: Login failed:', data.message)
        return { success: false, message: data.message }
      }
    } catch (error) {
      console.error('❌ Standalone Login: Login error:', error)
      return { success: false, message: 'Network error occurred' }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    login,
    isLoading
  }
}
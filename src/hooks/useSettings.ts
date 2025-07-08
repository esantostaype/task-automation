/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/useSettings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { toast } from 'react-toastify'

interface SettingItem {
  id: string
  category: string
  key: string
  value: any
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array'
  label: string
  description?: string
  minValue?: number
  maxValue?: number
  options?: any[]
  required: boolean
}

interface SettingsGroup {
  [groupName: string]: SettingItem[]
}

interface SettingsResponse {
  settings: SettingsGroup
  groups: string[]
  totalSettings: number
}

interface UpdateSettingParams {
  category: string
  key: string
  value: any
}

// Query Keys
export const settingsKeys = {
  all: ['settings'] as const,
  groups: () => [...settingsKeys.all, 'groups'] as const,
}

// Get all settings grouped
export const useSettings = () => {
  return useQuery({
    queryKey: settingsKeys.groups(),
    queryFn: async (): Promise<SettingsResponse> => {
      const { data } = await axios.get('/api/settings')
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Update multiple settings
export const useUpdateSettings = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (updates: UpdateSettingParams[]) => {
      const { data } = await axios.put('/api/settings', { updates })
      return data
    },
    onSuccess: (data) => {
      // Invalidate settings cache
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      
      const { success, errors } = data
      
      if (success > 0) {
        toast.success(`${success} settings updated successfully`)
      }
      
      if (errors > 0) {
        toast.error(`${errors} settings failed to update`)
        console.error('Settings update errors:', data.errors)
      }
    },
    onError: (error: any) => {
      console.error('❌ Settings update error:', error)
      const message = error.response?.data?.error || error.message
      toast.error(`Settings update failed: ${message}`)
    },
  })
}

// Reset all settings to defaults
export const useResetSettings = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.post('/api/settings/reset', { 
        confirmReset: true 
      })
      return data
    },
    onSuccess: () => {
      // Invalidate settings cache
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      toast.success('All settings reset to defaults successfully')
    },
    onError: (error: any) => {
      console.error('❌ Settings reset error:', error)
      const message = error.response?.data?.error || error.message
      toast.error(`Settings reset failed: ${message}`)
    },
  })
}
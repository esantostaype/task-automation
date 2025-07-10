/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { toast } from 'react-toastify'

interface Setting {
  id: string
  category: string
  key: string
  value: any
  dataType: string
  label: string
  description?: string
  group: string
  order: number
  minValue?: number
  maxValue?: number
  options?: any
  required: boolean
}

interface SettingsResponse {
  settings: Record<string, Setting[]>
  groups: string[]
  totalSettings: number
}

interface UpdateSettingPayload {
  category: string
  key: string
  value: any
}

// Obtener configuraciones
export const useSettings = () => {
  return useQuery<SettingsResponse>({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await axios.get('/api/settings')
      
      // Agrupar settings por grupo
      const grouped: Record<string, Setting[]> = {}
      const settings = response.data.settings || []
      
      settings.forEach((setting: Setting) => {
        if (!grouped[setting.group]) {
          grouped[setting.group] = []
        }
        grouped[setting.group].push(setting)
      })
      
      // Ordenar cada grupo por order
      Object.keys(grouped).forEach(group => {
        grouped[group].sort((a, b) => a.order - b.order)
      })
      
      return {
        settings: grouped,
        groups: Object.keys(grouped),
        totalSettings: settings.length
      }
    }
  })
}

// Actualizar configuraciones
export const useUpdateSettings = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (updates: UpdateSettingPayload[]) => {
      const response = await axios.patch('/api/settings', { updates })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error updating settings')
    }
  })
}

// Reset configuraciones
export const useResetSettings = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const response = await axios.post('/api/settings/reset')
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings reset to defaults')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error resetting settings')
    }
  })
}
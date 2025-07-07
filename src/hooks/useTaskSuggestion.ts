import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { SuggestedAssignment } from '@/interfaces'

export const useTaskSuggestion = (
  typeId: number | undefined,
  durationDays: string,
  brandId?: string, // ✅ OPCIONAL: Si no hay brand, usar lógica global
  triggerSuggestion?: number
) => {
  const [suggestedAssignment, setSuggestedAssignment] = useState<SuggestedAssignment | null>(null)
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false)

  useEffect(() => {
    const getSuggestion = async () => {
      console.log('🔍 useTaskSuggestion - Evaluating conditions:', {
        typeId,
        durationDays,
        brandId: brandId || 'global',
        triggerSuggestion
      });

      // ✅ VALIDACIÓN SIMPLIFICADA: Solo necesitamos typeId y durationDays válida
      if (!typeId || !durationDays) {
        console.log('❌ Missing typeId or durationDays - skipping suggestion')
        setSuggestedAssignment(null)
        setFetchingSuggestion(false)
        return
      }

      const duration = parseFloat(durationDays)
      if (duration <= 0) {
        console.log('❌ Invalid duration - skipping suggestion')
        setSuggestedAssignment(null)
        setFetchingSuggestion(false)
        return
      }

      console.log(`🔄 Fetching user suggestion based on type (${typeId}) and duration (${duration})`)
      setFetchingSuggestion(true)

      try {
        // ✅ PARÁMETROS OPCIONALES: brandId es opcional
        const params: Record<string, string | number> = {
          typeId,
          durationDays: duration
        }

        // Solo agregar brandId si está disponible
        if (brandId) {
          params.brandId = brandId
        }

        const response = await axios.get(`/api/tasks/suggestion/simple`, {
          params
        })
        
        const { suggestedUserId } = response.data

        setSuggestedAssignment({
          userId: suggestedUserId,
          durationDays: duration,
        })

        console.log('✅ User suggestion obtained:', suggestedUserId)
      } catch (error) {
        console.error('Error al obtener sugerencia de usuario:', error)
        setSuggestedAssignment(null)
        
        // Solo mostrar toast para errores que no sean de validación
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 400) {
            console.log('Validation error, not showing toast:', error.response.data.error)
          } else {
            toast.error('Error al obtener sugerencia de asignación.')
          }
        }
      } finally {
        setFetchingSuggestion(false)
      }
    }

    getSuggestion()
  }, [typeId, durationDays, brandId, triggerSuggestion])

  return { suggestedAssignment, fetchingSuggestion }
}
// src/hooks/useTaskSuggestion.ts - VERSIÓN MEJORADA CON RE-CÁLCULO AUTOMÁTICO

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { SuggestedAssignment } from '@/interfaces'

export const useTaskSuggestion = (
  typeId: number | undefined,
  durationDays: string,
  brandId?: string,
  triggerSuggestion?: number
) => {
  const [suggestedAssignment, setSuggestedAssignment] = useState<SuggestedAssignment | null>(null)
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false)

  // ✅ NUEVO: Referencias para detectar cambios y debouncing
  const lastValidSuggestion = useRef<SuggestedAssignment | null>(null)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  const lastParams = useRef<string>('')

  // ✅ NUEVO: Función para determinar si los parámetros son válidos
  const areParamsValid = (typeId: number | undefined, durationDays: string) => {
    if (!typeId || !durationDays) return false
    const duration = parseFloat(durationDays)
    return !isNaN(duration) && duration > 0
  }

  // ✅ NUEVO: Función para crear clave de parámetros para detectar cambios
  const createParamsKey = (typeId: number | undefined, durationDays: string, brandId?: string) => {
    return `${typeId || 'none'}-${durationDays || 'none'}-${brandId || 'global'}`
  }

  // ✅ MEJORADO: Función de obtención de sugerencias con debouncing
  const getSuggestion = async (immediate = false) => {
    const currentParams = createParamsKey(typeId, durationDays, brandId)

    console.log('🔍 useTaskSuggestion - Evaluating conditions:', {
      typeId,
      durationDays,
      brandId: brandId || 'global',
      triggerSuggestion,
      immediate,
      paramsChanged: currentParams !== lastParams.current
    })

    // Validar parámetros
    if (!areParamsValid(typeId, durationDays)) {
      console.log('⚠️ Invalid parameters - waiting for valid duration')
      setFetchingSuggestion(false)
      // No limpiar la sugerencia inmediatamente, esperar a que llegue una duración válida
      return
    }

    const duration = parseFloat(durationDays)
    lastParams.current = currentParams

    // ✅ NUEVO: Implementar debouncing solo para cambios de duración manual
    if (!immediate && debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    const executeSuggestion = async () => {
      console.log(`🔄 Fetching user suggestion based on type (${typeId}) and duration (${duration})`)
      setFetchingSuggestion(true)

      try {
        const params: Record<string, string | number> = {
          typeId: typeId ?? 0,
          durationDays: duration
        }

        if (brandId) {
          params.brandId = brandId
        }

        const response = await axios.get(`/api/tasks/suggestion/simple`, {
          params
        })

        const { suggestedUserId, userInfo } = response.data

        const newSuggestion: SuggestedAssignment = {
          userId: suggestedUserId,
          durationDays: duration,
        }

        // ✅ NUEVO: Detectar cambios en la sugerencia para notificar al usuario
        const suggestionChanged = lastValidSuggestion.current &&
          lastValidSuggestion.current.userId !== newSuggestion.userId

        if (suggestionChanged) {
          console.log(`🔄 Suggestion changed from ${lastValidSuggestion.current?.userId} to ${newSuggestion.userId}`)
          console.log(`📊 Reason: Duration changed from ${lastValidSuggestion.current?.durationDays} to ${duration} days`)

          // ✅ NUEVO: Log detallado del cambio para debugging
          if (userInfo) {
            console.log(`👤 New suggested user: ${userInfo.name}`)
            console.log(`📈 Current load: ${userInfo.totalAssignedDurationDays} days`)
            console.log(`📅 Available from: ${userInfo.availableFrom}`)
          }
        }

        setSuggestedAssignment(newSuggestion)
        lastValidSuggestion.current = newSuggestion

        console.log('✅ User suggestion obtained:', {
          userId: suggestedUserId,
          duration: duration,
          changed: suggestionChanged
        })

      } catch (error) {
        console.error('Error al obtener sugerencia de usuario:', error)
        setSuggestedAssignment(null)

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

    // ✅ NUEVO: Ejecutar inmediatamente o con debounce
    if (immediate) {
      await executeSuggestion()
    } else {
      // Debounce de 300ms para cambios de duración manual
      debounceTimeout.current = setTimeout(executeSuggestion, 300)
    }
  }

  // ✅ MEJORADO: Effect principal con mejor detección de cambios
  useEffect(() => {
    const currentParams = createParamsKey(typeId, durationDays, brandId)
    const paramsChanged = currentParams !== lastParams.current
    const shouldTriggerImmediate = triggerSuggestion !== undefined && triggerSuggestion > 0

    if (paramsChanged || shouldTriggerImmediate) {
      console.log(`🚀 Triggering suggestion: paramsChanged=${paramsChanged}, triggerSuggestion=${shouldTriggerImmediate}`)
      getSuggestion(shouldTriggerImmediate)
    }

    // Cleanup timeout on unmount
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [typeId, durationDays, brandId, triggerSuggestion])

  // ✅ NUEVO: Función para forzar re-cálculo inmediato
  const forceSuggestionUpdate = () => {
    console.log('🔄 Forcing immediate suggestion update')
    getSuggestion(true)
  }

  return {
    suggestedAssignment,
    fetchingSuggestion,
    forceSuggestionUpdate // ✅ NUEVO: Exponer función para forzar update
  }
}
import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { SuggestedAssignment } from '@/interfaces'

export const useTaskSuggestion = (
  brandId: string, 
  categoryId: string, 
  priority: string,
  // ✅ Nuevos parámetros para manejar categorías manuales
  isNewCategory?: boolean,
  manualDuration?: string, // Duración en días como string
  typeId?: number,
  triggerSuggestion?: number // ✅ Para forzar actualización
) => {
  const [suggestedAssignment, setSuggestedAssignment] = useState<SuggestedAssignment | null>(null)
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false)

  useEffect(() => {
    const getSuggestion = async () => {
      console.log('🔍 useTaskSuggestion - Evaluating conditions:', {
        brandId,
        priority,
        isNewCategory,
        categoryId,
        manualDuration,
        typeId,
        triggerSuggestion
      });

      // ✅ Si los parámetros están vacíos (durante envío), no hacer nada
      if (!brandId || !priority) {
        console.log('❌ Missing brandId or priority - skipping suggestion')
        setSuggestedAssignment(null)
        setFetchingSuggestion(false)
        return
      }

      // ✅ NUEVA LÓGICA: Si hay duración manual para cualquier tipo de categoría
      if (manualDuration && parseFloat(manualDuration) > 0) {
        const durationDays = parseFloat(manualDuration)
        
        console.log('🔄 Fetching suggestion with MANUAL DURATION:', {
          durationDays,
          isNewCategory,
          categoryId,
          typeId,
          brandId,
          priority
        });
        
        setFetchingSuggestion(true)
        
        try {
          let response;
          
          if (isNewCategory && typeId) {
            // Para nuevas categorías, usar endpoint manual con typeId
            console.log('🆕 Using manual endpoint for NEW category')
            response = await axios.get(`/api/tasks/suggestion/manual`, {
              params: { 
                brandId, 
                typeId, 
                priority, 
                durationDays 
              },
            })
          } else if (!isNewCategory && categoryId) {
            // ✅ NUEVO: Para categorías existentes con duración manual, usar endpoint híbrido
            console.log('🔧 Using hybrid endpoint for EXISTING category with manual duration')
            response = await axios.get(`/api/tasks/suggestion/hybrid`, {
              params: { 
                brandId, 
                categoryId, 
                priority,
                manualDuration: durationDays // ✅ NUEVO: Pasar duración manual
              },
            })
          } else {
            console.log('❌ Invalid combination for manual duration suggestion')
            setSuggestedAssignment(null)
            setFetchingSuggestion(false)
            return
          }
          
          const { suggestedUserId } = response.data
          
          setSuggestedAssignment({
            userId: suggestedUserId,
            durationDays: durationDays, // ✅ Usar duración manual
          })

          console.log('✅ Sugerencia obtenida con duración manual:', {
            userId: suggestedUserId,
            durationDays: durationDays
          })
          
        } catch (error) {
          console.error('Error al obtener sugerencia con duración manual:', error)
          setSuggestedAssignment(null)
          if (axios.isAxiosError(error) && error.response?.status !== 400) {
            toast.error('Error al obtener sugerencia de asignación.')
          }
        } finally {
          setFetchingSuggestion(false)
        }
        
        return
      }

      // ✅ Para categorías existentes SIN duración manual (usa duración de categoría)
      if (!isNewCategory && categoryId && !manualDuration) {
        console.log('🔄 Fetching suggestion for existing category WITHOUT manual duration')
        setFetchingSuggestion(true)
        try {
          const response = await axios.get(`/api/tasks/suggestion/hybrid`, {
            params: { brandId, categoryId, priority },
          })
          
          const { suggestedUserId, estimatedDurationHours } = response.data
          const estimatedDurationDays = estimatedDurationHours / 8

          setSuggestedAssignment({
            userId: suggestedUserId,
            durationDays: estimatedDurationDays,
          })
        } catch (error) {
          console.error('Error al obtener sugerencia para categoría existente:', error)
          setSuggestedAssignment(null)
          if (axios.isAxiosError(error) && error.response?.status !== 400) {
            toast.error('Error al obtener sugerencia de asignación.')
          }
        } finally {
          setFetchingSuggestion(false)
        }
      }
      // ✅ Limpiar sugerencia si no hay datos suficientes
      else {
        setSuggestedAssignment(null)
      }
    }

    getSuggestion()
  }, [brandId, categoryId, priority, isNewCategory, manualDuration, typeId, triggerSuggestion])

  return { suggestedAssignment, fetchingSuggestion }
}
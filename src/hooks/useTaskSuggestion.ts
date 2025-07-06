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
        setFetchingSuggestion(false) // ✅ Asegurar que se detenga el loading
        return
      }

      // ✅ Para categorías existentes
      if (!isNewCategory && categoryId) {
        console.log('🔄 Fetching suggestion for existing category')
        setFetchingSuggestion(true)
        try {
          const response = await axios.get(`/api/tasks/suggestion`, {
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
          toast.error('Error al obtener sugerencia de asignación.')
        } finally {
          setFetchingSuggestion(false)
        }
      }
      // ✅ Para nuevas categorías con duración manual
      else if (isNewCategory && manualDuration && typeId) {
        const durationDays = parseFloat(manualDuration)
        
        console.log('🔄 Fetching suggestion for NEW category:', {
          durationDays,
          typeId,
          brandId,
          priority
        });
        
        if (durationDays > 0) {
          setFetchingSuggestion(true)
          try {
            // ✅ Hacer llamada al endpoint de sugerencia pero usando typeId y duración manual
            console.log('🤖 Obteniendo sugerencia para nueva categoría:', {
              typeId,
              brandId,
              priority,
              durationDays
            })

            // Como no tenemos categoryId, vamos a hacer la llamada con datos mínimos
            // y luego procesar la respuesta localmente
            const response = await axios.get(`/api/tasks/suggestion/manual`, {
              params: { 
                brandId, 
                typeId, 
                priority, 
                durationDays 
              },
            })
            
            const { suggestedUserId } = response.data

            setSuggestedAssignment({
              userId: suggestedUserId,
              durationDays: durationDays,
            })

            console.log('✅ Sugerencia obtenida para nueva categoría:', suggestedUserId)
          } catch (error) {
            console.error('Error al obtener sugerencia para nueva categoría:', error)
            
            // ✅ Fallback: Si no hay endpoint específico, intentar con el existente usando el primer type
            try {
              console.log('🔄 Intentando fallback con sugerencia general...')
              
              // Aquí podrías hacer una llamada alternativa o usar lógica local
              // Por ahora, simplemente limpiamos la sugerencia
              setSuggestedAssignment(null)
            } catch (fallbackError) {
              console.error('Error en fallback:', fallbackError)
              setSuggestedAssignment(null)
            }
          } finally {
            setFetchingSuggestion(false)
          }
        } else {
          setSuggestedAssignment(null)
        }
      }
      // ✅ Limpiar sugerencia si no hay datos suficientes
      else {
        setSuggestedAssignment(null)
      }
    }

    getSuggestion()
  }, [brandId, categoryId, priority, isNewCategory, manualDuration, typeId, triggerSuggestion]) // ✅ Agregar triggerSuggestion

  return { suggestedAssignment, fetchingSuggestion }
}
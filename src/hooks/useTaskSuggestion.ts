import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { SuggestedAssignment } from '@/interfaces'

export const useTaskSuggestion = (brandId: string, categoryId: string, priority: string) => {
  const [suggestedAssignment, setSuggestedAssignment] = useState<SuggestedAssignment | null>(null)
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false)

  useEffect(() => {
    const getSuggestion = async () => {
      if (brandId && categoryId && priority) {
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
          console.error('Error al obtener sugerencia:', error)
          setSuggestedAssignment(null)
          toast.error('Error al obtener sugerencia de asignación.')
        } finally {
          setFetchingSuggestion(false)
        }
      } else {
        setSuggestedAssignment(null)
      }
    }

    getSuggestion()
  }, [brandId, categoryId, priority])

  return { suggestedAssignment, fetchingSuggestion }
}
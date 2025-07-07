/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react'
import { useFormikContext } from 'formik'
import { FormLabel, Input } from '@mui/joy'
import { HugeiconsIcon } from '@hugeicons/react'
import { DateTimeIcon, RefreshIcon } from '@hugeicons/core-free-icons'
import { FormValues } from '@/interfaces'
import { formatDaysToReadable } from '@/utils/duration-utils'
import { TextFieldError, TextFieldHelp } from '@/components'

interface ExtendedFormValues extends FormValues {
  isNewCategory: boolean
}

interface DurationFieldProps {
  fetchingSuggestion: boolean
  touched?: boolean
  error?: string
  isTypingNewCategory?: boolean
  onDurationComplete?: (duration: string) => void
  allCategories?: any[]
  // ✅ NUEVO: Props para mejor integración con sugerencias
  onDurationChange?: (duration: string) => void
  suggestionChanged?: boolean
  suggestedUser?: { name: string } | null
}

export const DurationField: React.FC<DurationFieldProps> = ({
  fetchingSuggestion,
  touched, 
  error,
  isTypingNewCategory = false,
  onDurationComplete,
  allCategories = [],
  onDurationChange, // ✅ NUEVO
  suggestionChanged = false, // ✅ NUEVO
  suggestedUser = null // ✅ NUEVO
}) => {
  const { values, setFieldValue } = useFormikContext<ExtendedFormValues>()
  
  const [localInputValue, setLocalInputValue] = React.useState('')
  const [hasManualEdit, setHasManualEdit] = React.useState(false)
  // ✅ NUEVO: Estado para mostrar indicador de cambio de sugerencia
  const [showSuggestionChangeIndicator, setShowSuggestionChangeIndicator] = React.useState(false)
  
  const numberOfAssignees = values.assignedUserIds.length
  const originalDuration = parseFloat(localInputValue) || 0
  const effectiveDuration = numberOfAssignees > 0 ? originalDuration / numberOfAssignees : originalDuration

  // Sincronizar con Formik solo cuando no hay edición manual activa
  React.useEffect(() => {
    if (!hasManualEdit && values.durationDays !== localInputValue) {
      setLocalInputValue(values.durationDays as string || '')
    }
  }, [values.durationDays, hasManualEdit])

  // ✅ NUEVO: Efecto para mostrar indicador de cambio de sugerencia
  React.useEffect(() => {
    if (suggestionChanged && suggestedUser) {
      setShowSuggestionChangeIndicator(true)
      const timer = setTimeout(() => {
        setShowSuggestionChangeIndicator(false)
      }, 3000) // Mostrar por 3 segundos
      
      return () => clearTimeout(timer)
    }
  }, [suggestionChanged, suggestedUser])

  // Determinar la fuente de la duración
  const getDurationSource = () => {
    if (isTypingNewCategory || values.isNewCategory) {
      return 'manual'
    }
    
    if (hasManualEdit) {
      return 'manual'
    }
    
    if (fetchingSuggestion) {
      return 'calculating'
    }
    
    if (localInputValue && !values.isNewCategory && values.categoryId) {
      const selectedCategory = allCategories.find(cat => cat.id.toString() === values.categoryId)
      if (selectedCategory && selectedCategory.duration.toString() === localInputValue) {
        return 'category'
      }
    }
    
    if (localInputValue && !fetchingSuggestion) {
      return 'suggested'
    }
    
    return null
  }

  // Determinar si mostrar indicador y su texto/color
  const getStatusIndicator = () => {
    const source = getDurationSource()
    
    switch (source) {
      case 'manual':
        return { text: "(Manual)", color: 'var(--joy-palette-warning-500)' }
      case 'calculating':
        return { text: "(Calculating...)", color: 'var(--joy-palette-primary-500)' }
      case 'category':
        return { text: "(From Category)", color: 'var(--joy-palette-success-500)' }
      case 'suggested':
        return { text: "(Suggested)", color: 'var(--joy-palette-info-500)' }
      default:
        return null
    }
  }

  const statusIndicator = getStatusIndicator()

  const getPlaceholder = () => {
    if (fetchingSuggestion) {
      return "Calculating suggested duration..."
    }
    if (values.isNewCategory) {
      return "Enter duration in days"
    }
    return "Duration in days"
  }

  // ✅ MEJORADO: Manejar cambios del usuario con notificación inmediata
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    setLocalInputValue(newValue)
    setFieldValue('durationDays', newValue)
    
    // Marcar que el usuario ha editado manualmente
    if (newValue !== values.durationDays) {
      setHasManualEdit(true)
    }

    // ✅ NUEVO: Notificar cambio inmediatamente para recálculo de sugerencias
    if (onDurationChange && newValue.trim()) {
      const duration = parseFloat(newValue)
      if (duration > 0) {
        console.log('⏰ Duration changed in real-time:', newValue)
        onDurationChange(newValue)
      }
    }
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (!event || !event.target) {
      console.error('❌ handleBlur: event or event.target is undefined', { event });
      return;
    }

    const value = event.target.value.trim()
    
    if (onDurationComplete && value) {
      const durationValue = parseFloat(value)
      if (durationValue > 0) {
        console.log('⏰ Duration completed by user:', value)
        onDurationComplete(value)
      }
    }
  }

  // Resetear estado manual cuando cambia la categoría
  React.useEffect(() => {
    setHasManualEdit(false)
    setShowSuggestionChangeIndicator(false)
  }, [values.categoryId, values.isNewCategory])

  return (
    <div>
      <FormLabel>
        <HugeiconsIcon
          icon={DateTimeIcon}
          size={20}
          strokeWidth={1.5}
        />
        Duration
        {/* Mostrar indicador de estado dinámico */}
        {statusIndicator && (
          <span style={{ color: statusIndicator.color, marginLeft: '4px' }}>
            {statusIndicator.text}
          </span>
        )}
        {/* ✅ NUEVO: Indicador de cambio de sugerencia */}
        {showSuggestionChangeIndicator && suggestedUser && (
          <span style={{ 
            color: 'var(--joy-palette-success-500)', 
            marginLeft: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px'
          }}>
            <HugeiconsIcon icon={RefreshIcon} size={12} strokeWidth={2} />
            Suggestion updated!
          </span>
        )}
      </FormLabel>
      
      <Input
        name="durationDays"
        type="number"
        value={localInputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={getPlaceholder()}
        error={touched && !!error}
        disabled={fetchingSuggestion && !hasManualEdit}
        slotProps={{
          input: {
            step: 0.1,
          },
        }}
      />

      {/* ✅ NUEVO: Información sobre cambio de sugerencia */}
      {showSuggestionChangeIndicator && suggestedUser && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--joy-palette-success-500)',
          marginTop: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <HugeiconsIcon icon={RefreshIcon} size={14} strokeWidth={1.5} />
          Suggestion changed to: <strong>{suggestedUser.name}</strong>
        </div>
      )}

      {/* Mostrar información de duración efectiva */}
      {numberOfAssignees > 1 && originalDuration > 0 && (
        <TextFieldHelp>
          Effective duration per user: {formatDaysToReadable(effectiveDuration)}
          <br />
          ({numberOfAssignees} users working in parallel)
        </TextFieldHelp>
      )}
      
      {numberOfAssignees === 1 && originalDuration > 0 && (
        <TextFieldHelp>
          Total duration: {formatDaysToReadable(originalDuration)}
        </TextFieldHelp>
      )}
      
      {touched && error && <TextFieldError label={error} />}
    </div>
  )
}
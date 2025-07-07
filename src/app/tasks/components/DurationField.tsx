/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/tasks/components/DurationField.tsx
import React from 'react'
import { useFormikContext } from 'formik'
import { FormLabel, Input } from '@mui/joy'
import { HugeiconsIcon } from '@hugeicons/react'
import { DateTimeIcon } from '@hugeicons/core-free-icons'
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
  allCategories?: any[] // ✅ NUEVO: Para determinar fuente de duración
}

export const DurationField: React.FC<DurationFieldProps> = ({
  fetchingSuggestion,
  touched, 
  error,
  isTypingNewCategory = false,
  onDurationComplete,
  allCategories = []
}) => {
  const { values, setFieldValue } = useFormikContext<ExtendedFormValues>()
  
  // ✅ CORRECCIÓN: Estado local para el input que siempre permite edición
  const [localInputValue, setLocalInputValue] = React.useState('')
  // ✅ Estado para trackear si el usuario ha editado manualmente
  const [hasManualEdit, setHasManualEdit] = React.useState(false)
  
  const numberOfAssignees = values.assignedUserIds.length
  const originalDuration = parseFloat(localInputValue) || 0
  const effectiveDuration = numberOfAssignees > 0 ? originalDuration / numberOfAssignees : originalDuration

  // ✅ CORRECCIÓN: Sincronizar con Formik solo cuando no hay edición manual activa
  React.useEffect(() => {
    if (!hasManualEdit && values.durationDays !== localInputValue) {
      setLocalInputValue(values.durationDays as string || '')
    }
  }, [values.durationDays, hasManualEdit])

  // ✅ NUEVO: Determinar la fuente de la duración
  const getDurationSource = () => {
    // Si está escribiendo una nueva categoría, siempre es manual
    if (isTypingNewCategory || values.isNewCategory) {
      return 'manual'
    }
    
    // Si hay edición manual, es manual
    if (hasManualEdit) {
      return 'manual'
    }
    
    // Si se está buscando sugerencia, es calculando
    if (fetchingSuggestion) {
      return 'calculating'
    }
    
    // Si hay valor y es categoría existente, verificar si viene de la categoría
    if (localInputValue && !values.isNewCategory && values.categoryId) {
      const selectedCategory = allCategories.find(cat => cat.id.toString() === values.categoryId)
      if (selectedCategory && selectedCategory.duration.toString() === localInputValue) {
        return 'category'
      }
    }
    
    // Si hay valor y no es manual, es sugerido
    if (localInputValue && !fetchingSuggestion) {
      return 'suggested'
    }
    
    return null
  }

  // ✅ Determinar si mostrar indicador y su texto/color
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

  // ✅ CORRECCIÓN: Manejar cambios del usuario
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    setLocalInputValue(newValue)
    setFieldValue('durationDays', newValue)
    
    // ✅ Marcar que el usuario ha editado manualmente
    if (newValue !== values.durationDays) {
      setHasManualEdit(true)
    }
  }

  // ✅ CORRECCIÓN: Manejar cuando se pierde el foco
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (!event || !event.target) {
      console.error('❌ handleBlur: event or event.target is undefined', { event });
      return;
    }

    const value = event.target.value.trim()
    
    // Si hay callback y valor válido, notificar al padre
    if (onDurationComplete && value) {
      const durationValue = parseFloat(value)
      if (durationValue > 0) {
        console.log('⏰ Duration completed by user:', value)
        onDurationComplete(value)
      }
    }
  }

  // ✅ CORRECCIÓN: Resetear estado manual cuando cambia la categoría
  React.useEffect(() => {
    setHasManualEdit(false)
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
        {/* ✅ Mostrar indicador de estado dinámico */}
        {statusIndicator && (
          <span style={{ color: statusIndicator.color, marginLeft: '4px' }}>
            {statusIndicator.text}
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
        // ✅ CORRECCIÓN: Solo deshabilitar durante carga, no cuando hay valor sugerido
        disabled={fetchingSuggestion && !hasManualEdit}
        slotProps={{
          input: {
            step: 0.1,
          },
        }}
      />

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
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
  // ✅ Nueva prop para saber si se está escribiendo una nueva categoría
  isTypingNewCategory?: boolean
  // ✅ Nueva prop para notificar cuando se completa la duración
  onDurationComplete?: (duration: string) => void
}

export const DurationField: React.FC<DurationFieldProps> = ({
  fetchingSuggestion,
  touched, 
  error,
  isTypingNewCategory = false, // ✅ Nueva prop
  onDurationComplete // ✅ Nueva prop
}) => {
  const { values, setFieldValue } = useFormikContext<ExtendedFormValues>()
  
  // ✅ Estado para el valor del input en tiempo real
  const [inputValue, setInputValue] = React.useState('')
  
  const numberOfAssignees = values.assignedUserIds.length
  const originalDuration = parseFloat(values.durationDays as string) || 0
  const effectiveDuration = numberOfAssignees > 0 ? originalDuration / numberOfAssignees : originalDuration

  // ✅ Determinar si mostrar "(Manual)" - cuando está escribiendo nueva categoría O cuando hay input manual
  const showManualIndicator = React.useMemo(() => {
    // Si está escribiendo una nueva categoría, es manual
    if (isTypingNewCategory) return true
    
    // Si es una nueva categoría confirmada, es manual
    if (values.isNewCategory) return true
    
    // Si hay input pero no hay sugerencia activa, es manual
    return inputValue.trim() !== '' && !fetchingSuggestion
  }, [isTypingNewCategory, values.isNewCategory, inputValue, fetchingSuggestion])

  // ✅ Sincronizar inputValue con el valor de Formik
  React.useEffect(() => {
    setInputValue(values.durationDays as string || '')
  }, [values.durationDays])

  const getPlaceholder = () => {
    if (fetchingSuggestion) {
      return "Calculating suggested duration..."
    }
    if (values.isNewCategory) {
      return "Enter duration in days"
    }
    return "Duration in days"
  }

  // ✅ Manejar cambios en el input
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    setInputValue(newValue)
    setFieldValue('durationDays', newValue)
  }

  // ✅ Manejar cuando se pierde el foco (blur)
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    // Add defensive checks to ensure event and event.target are defined
    if (!event || !event.target) {
      console.error('❌ handleBlur: event or event.target is undefined', { event });
      return; // Exit early if event is not valid
    }

    const value = event.target.value.trim()
    
    // Si hay callback y valor válido, notificar al padre
    if (onDurationComplete && value) {
      const durationValue = parseFloat(value)
      if (durationValue > 0) {
        console.log('⏰ Duration completed:', value)
        onDurationComplete(value)
      }
    }
  }

  return (
    <div>
      <FormLabel>
        <HugeiconsIcon
          icon={DateTimeIcon}
          size={20}
          strokeWidth={1.5}
        />
        Duration
        {/* ✅ Mostrar "(Manual)" cuando se detecta que está escribiendo nueva categoría o entrada manual */}
        {showManualIndicator && (
          <span style={{ color: 'var(--joy-palette-warning-500)', marginLeft: '4px' }}>
            (Manual)
          </span>
        )}
      </FormLabel>
      
      <Input
        name="durationDays"
        type="number"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur} // ✅ Agregar handler de blur
        placeholder={getPlaceholder()}
        error={touched && !!error}
        disabled={fetchingSuggestion}
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
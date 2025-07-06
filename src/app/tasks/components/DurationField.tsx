import React from 'react'
import { Field, useFormikContext } from 'formik'
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
}

export const DurationField: React.FC<DurationFieldProps> = ({
  fetchingSuggestion,
  touched, 
  error 
}) => {
  const { values } = useFormikContext<ExtendedFormValues>()
  
  const numberOfAssignees = values.assignedUserIds.length
  const originalDuration = parseFloat(values.durationDays as string) || 0
  const effectiveDuration = numberOfAssignees > 0 ? originalDuration / numberOfAssignees : originalDuration

  const getPlaceholder = () => {
    if (fetchingSuggestion) {
      return "Calculating suggested duration..."
    }
    if (values.isNewCategory) {
      return "Enter duration in days"
    }
    return "Duration in days"
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
        {values.isNewCategory && (
          <span style={{ color: 'var(--joy-palette-warning-500)', marginLeft: '4px' }}>
            (Manual)
          </span>
        )}
      </FormLabel>
      
      <Field
        as={Input}
        name="durationDays"
        type="number"
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
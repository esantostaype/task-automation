import React from 'react'
import { Field, useFormikContext } from 'formik'
import { FormLabel, Input, Typography } from '@mui/joy'
import { HugeiconsIcon } from '@hugeicons/react'
import { DateTimeIcon } from '@hugeicons/core-free-icons'
import { FormValues } from '@/interfaces'
import { formatDaysToReadable } from '@/utils/duration-utils' // ✅ Importar la nueva utilidad

interface DurationFieldProps {
  fetchingSuggestion: boolean
  touched?: boolean
  error?: string
}

export const DurationField: React.FC<DurationFieldProps> = ({
  touched, 
  error 
}) => {
  const { values } = useFormikContext<FormValues>()
  
  const numberOfAssignees = values.assignedUserIds.length
  const originalDuration = parseFloat(values.durationDays as string) || 0
  const effectiveDuration = numberOfAssignees > 0 ? originalDuration / numberOfAssignees : originalDuration

  return (
    <div>
      <FormLabel>
        <HugeiconsIcon
          icon={DateTimeIcon}
          size={20}
          strokeWidth={1.5}
        />
        Duration
      </FormLabel>
      <Field
        as={Input}
        name="durationDays"
        type="number"
        placeholder="Duration in days"
        error={touched && !!error}
        slotProps={{
          input: {
            step: 0.1,
          },
        }}
      />
      
      {/* ✅ Mostrar duración efectiva con formato legible cuando hay múltiples usuarios */}
      {numberOfAssignees > 1 && originalDuration > 0 && (
        <Typography level="body-sm" color="primary" sx={{ mt: 0.5 }}>
          Effective duration per user: {formatDaysToReadable(effectiveDuration)}
          <br />
          ({numberOfAssignees} users working in parallel)
        </Typography>
      )}
      
      {/* ✅ Mostrar duración total con formato legible */}
      {numberOfAssignees === 1 && originalDuration > 0 && (
        <Typography level="body-sm" color="neutral" sx={{ mt: 0.5 }}>
          Total duration: {formatDaysToReadable(originalDuration)}
        </Typography>
      )}
      
      {touched && error && (
        <Typography level="body-sm" color="danger">{error}</Typography>
      )}
    </div>
  )
}
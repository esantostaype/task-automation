import React from 'react'
import { Field } from 'formik'
import { Input, Typography } from '@mui/joy'
import { Spinner } from '@/components'

interface DurationFieldProps {
  fetchingSuggestion: boolean
  touched?: boolean
  error?: string
}

export const DurationField: React.FC<DurationFieldProps> = ({ 
  fetchingSuggestion, 
  touched, 
  error 
}) => (
  <div>
    <Typography level="body-sm" sx={{ mb: 0.5 }}>
      Duración estimada (días):
    </Typography>
    <Field
      as={Input}
      name="durationDays"
      type="number"
      placeholder="Duración en días"
      error={touched && !!error}
      slotProps={{
        input: {
          step: 0.1,
        },
      }}
      startDecorator={fetchingSuggestion ? <Spinner isActive={true} /> : null}
    />
    {touched && error && (
      <Typography level="body-xs" color="danger">{error}</Typography>
    )}
  </div>
)
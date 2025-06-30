import React from 'react'
import { Field } from 'formik'
import { FormLabel, Input, Typography } from '@mui/joy'
import { HugeiconsIcon } from '@hugeicons/react'
import { Note01Icon } from '@hugeicons/core-free-icons'

interface TaskNameFieldProps {
  touched?: boolean
  error?: string
}

export const TaskNameField: React.FC<TaskNameFieldProps> = ({ touched, error }) => (
  <div>
    <FormLabel>
      <HugeiconsIcon
        icon={ Note01Icon }
        size={ 20 }
        strokeWidth={ 1.5 }
      />
      Task Name
    </FormLabel>
    <Field
      as={Input}
      name="name"
      error={touched && !!error}
    />
    {touched && error && (
      <Typography level="body-sm" color="danger">{error}</Typography>
    )}
  </div>
)
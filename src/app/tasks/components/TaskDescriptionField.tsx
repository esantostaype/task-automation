import React from 'react'
import { Field } from 'formik'
import { Textarea, Typography } from '@mui/joy'

interface TaskDescriptionFieldProps {
  touched?: boolean
  error?: string
}

export const TaskDescriptionField: React.FC<TaskDescriptionFieldProps> = ({ 
  touched, 
  error 
}) => (
  <div>
    <Field
      as={Textarea}
      name="description"
      placeholder="Descripción de la tarea (opcional)"
      minRows={2}
      maxRows={4}
    />
    {touched && error && (
      <Typography level="body-xs" color="danger">{error}</Typography>
    )}
  </div>
)
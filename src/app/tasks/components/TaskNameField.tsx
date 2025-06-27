import React from 'react'
import { Field } from 'formik'
import { Input, Typography } from '@mui/joy'

interface TaskNameFieldProps {
  touched?: boolean
  error?: string
}

export const TaskNameField: React.FC<TaskNameFieldProps> = ({ touched, error }) => (
  <div>
    <Field
      as={Input}
      name="name"
      placeholder="Nombre de la tarea"
      error={touched && !!error}
    />
    {touched && error && (
      <Typography level="body-xs" color="danger">{error}</Typography>
    )}
  </div>
)
import React from 'react'
import { Field } from 'formik'
import { FormLabel, Textarea, Typography } from '@mui/joy'
import { TextAlignLeft } from '@phosphor-icons/react'
import TextFieldLayout from '@/components/TextFieldLayout'

interface TaskDescriptionFieldProps {
  touched?: boolean
  error?: string
}

export const TaskDescriptionField: React.FC<TaskDescriptionFieldProps> = ({ 
  touched, 
  error 
}) => (
  <TextFieldLayout icon={<TextAlignLeft size={32} weight="thin" />}>
    <FormLabel>Task Description</FormLabel>
    <Field
      as={Textarea}
      name="description"
      minRows={2}
      maxRows={4}
    />
    {touched && error && (
      <Typography level="body-sm" color="danger">{error}</Typography>
    )}
  </TextFieldLayout>
)
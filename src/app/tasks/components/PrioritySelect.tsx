import React from 'react'
import { Select, Option, Typography } from '@mui/joy'

interface PrioritySelectProps {
  value: string
  onChange: (value: string) => void
  touched?: boolean
  error?: string
}

export const PrioritySelect: React.FC<PrioritySelectProps> = ({ 
  value, 
  onChange, 
  touched, 
  error 
}) => (
  <div>
    <Select
      value={value}
      onChange={(_, val) => onChange(val as string)}
    >
      <Option value="LOW">Baja</Option>
      <Option value="NORMAL">Normal</Option>
      <Option value="HIGH">Alta</Option>
      <Option value="URGENT">Urgente</Option>
    </Select>
    {touched && error && (
      <Typography level="body-xs" color="danger">{error}</Typography>
    )}
  </div>
)
import React from 'react'
import { Select, Option, Typography } from '@mui/joy'
import { TaskCategory } from '@/interfaces'

interface CategorySelectProps {
  categories: (TaskCategory & { typeName: string })[]
  value: string
  onChange: (value: string) => void
  onCategoryChange: () => void
  touched?: boolean
  error?: string
}

export const CategorySelect: React.FC<CategorySelectProps> = ({ 
  categories, 
  value, 
  onChange, 
  onCategoryChange,
  touched, 
  error 
}) => (
  <div>
    <Select
      value={value}
      onChange={(_, val) => {
        onChange(val as string)
        onCategoryChange()
      }}
      placeholder="Seleccionar categoría"
    >
      {categories.map((cat) => (
        <Option key={cat.id} value={cat.id.toString()}>
          {cat.typeName} - {cat.name} (Tier {cat.tier} - {cat.duration} días)
        </Option>
      ))}
    </Select>
    {touched && error && (
      <Typography level="body-xs" color="danger">{error}</Typography>
    )}
  </div>
)
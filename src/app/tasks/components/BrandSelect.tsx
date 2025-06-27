import React from 'react'
import { Select, Option, Typography } from '@mui/joy'
import { Brand } from '@/interfaces'

interface BrandSelectProps {
  brands: Brand[]
  value: string
  onChange: (value: string) => void
  touched?: boolean
  error?: string
}

export const BrandSelect: React.FC<BrandSelectProps> = ({ 
  brands, 
  value, 
  onChange, 
  touched, 
  error 
}) => (
  <div>
    <Select
      value={value}
      onChange={(_, val) => onChange(val as string)}
      placeholder="Seleccionar brand"
    >
      {brands.map((brand) => (
        <Option key={brand.id} value={brand.id}>
          {brand.name} {brand.clickupListId ? '(ClickUp ✓)' : ''}
        </Option>
      ))}
    </Select>
    {touched && error && (
      <Typography level="body-xs" color="danger">{error}</Typography>
    )}
  </div>
)
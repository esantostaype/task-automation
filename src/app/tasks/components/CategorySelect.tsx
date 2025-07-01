import React from 'react'
import { Select, Option, FormLabel } from '@mui/joy'
import { TaskCategory } from '@/interfaces'
import { HugeiconsIcon } from '@hugeicons/react'
import { LabelImportantIcon } from '@hugeicons/core-free-icons'
import { TextFieldError } from '@/components'

interface CategorySelectProps {
  categories: (TaskCategory & { typeName: string })[]
  value: string
  onChange: (value: string) => void
  onCategoryChange: () => void
  touched?: boolean
  error?: string
  loading?: boolean
}

export const CategorySelect: React.FC<CategorySelectProps> = ({ 
  categories, 
  value, 
  onChange, 
  onCategoryChange,
  touched, 
  error,
  loading = false
}) => (
  <div>
    <FormLabel>
      <HugeiconsIcon
        icon={ LabelImportantIcon }
        size={ 20 }
        strokeWidth={ 1.5 }
      />
      Category
    </FormLabel>
    <Select
      value={value}
      onChange={(_, val) => {
        onChange(val as string)
        onCategoryChange()
      }}
      placeholder={loading ? "Loading categories..." : "Select a Category"}
      disabled={loading}
    >
      {loading ? (
        <Option value="" disabled>Loading categories...</Option>
      ) : (
        <>
          <Option value="">Select a Category</Option>
          {categories.map((cat) => (
            <Option key={cat.id} value={cat.id.toString()}>
              { cat.name }
            </Option>
          ))}
        </>
      )}
    </Select>
    { touched && error && ( <TextFieldError label={ error } /> )}
</div>
)
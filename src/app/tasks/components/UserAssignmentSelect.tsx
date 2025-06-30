'use client'

import React from 'react'
import { Select, Option, Typography, Chip, FormLabel } from '@mui/joy'
import { User } from '@/interfaces'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserCheck01Icon } from '@hugeicons/core-free-icons'
import { useFormikContext } from 'formik'
import { FormValues } from '@/interfaces'
import { formatDaysToReadable } from '@/utils/duration-utils' // ✅ Importar la nueva utilidad

interface UserAssignmentSelectProps {
  users: User[]
  values: string[]
  onChange: (value: string[]) => void
  suggestedUser?: User | null
  fetchingSuggestion: boolean
  touched: boolean | undefined
  error: string | undefined
  loading?: boolean
}

export const UserAssignmentSelect: React.FC<UserAssignmentSelectProps> = ({
  users,
  values,
  onChange,
  suggestedUser,
  fetchingSuggestion,
  touched,
  error,
  loading = false,
}) => {
  const { values: formValues } = useFormikContext<FormValues>()
  
  const getPlaceholder = () => {
    if (fetchingSuggestion) return "Searching for suggestion.."
    if (loading) return "Loading designers..."
    return "Assign User(s)"
  }

  // Calcular duración efectiva
  const originalDuration = parseFloat(formValues.durationDays as string) || 0
  const numberOfAssignees = values.length
  const effectiveDuration = numberOfAssignees > 0 ? originalDuration / numberOfAssignees : originalDuration

  return (
    <div>
      <FormLabel>
        <HugeiconsIcon
          icon={UserCheck01Icon}
          size={20}
          strokeWidth={1.5}
        />
        Assignee
      </FormLabel>
      <Select
        name="assignedUserIds"
        multiple
        value={values}
        key={values.join(',')}
        onChange={(_, val) => onChange(val as string[])}
        placeholder={getPlaceholder()}
        disabled={fetchingSuggestion || loading}
        renderValue={(selected) => (
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {selected.map((selectedId) => {
              const user = users.find((u) => u.id === selectedId.value)
              return user ? <Chip key={user.id}>{user.name}</Chip> : null
            })}
          </div>
        )}
      >
        {loading ? (
          <Option value="" disabled>Loading designers...</Option>
        ) : (
          users.map((user) => (
            <Option key={user.id} value={user.id}>
              {user.name}
              {suggestedUser && suggestedUser.id === user.id && " (Suggested)"}
            </Option>
          ))
        )}
      </Select>
      
      {/* ✅ Mostrar información de duración con formato legible cuando hay usuarios seleccionados */}
      {numberOfAssignees > 1 && originalDuration > 0 && (
        <Typography level="body-sm" color="success" sx={{ mt: 0.5 }}>
          💡 With {numberOfAssignees} users: {formatDaysToReadable(effectiveDuration)} each (parallel work)
        </Typography>
      )}
      
      {touched && error && (
        <Typography level="body-sm" color="danger">{error}</Typography>
      )}
      {suggestedUser && values.length === 0 && !fetchingSuggestion && !loading && (
        <Typography level="body-sm" color="warning" sx={{ mt: 0.5 }}>
          Suggestion: {suggestedUser.name}
        </Typography>
      )}
    </div>
  )
}
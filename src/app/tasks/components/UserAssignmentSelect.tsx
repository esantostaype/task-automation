'use client'

import React from 'react'
import { Select, Option, Chip, FormLabel } from '@mui/joy'
import { User } from '@/interfaces'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserCheck01Icon } from '@hugeicons/core-free-icons'
import { TextFieldError } from '@/components'

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
  
  const getPlaceholder = () => {
    if (fetchingSuggestion) return "Searching for suggestion.."
    if (loading) return "Loading designers..."
    return "Assign User(s)"
  }

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
      { touched && error && ( <TextFieldError label={ error } /> )}
    </div>
  )
}
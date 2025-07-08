/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/designers/Designers.tsx - FIXED VERSION WITH WORKING MUTATIONS
'use client'

import React, { useState, useMemo } from 'react'
import { toast } from 'react-toastify'
import { DesignersHeader } from './DesignersHeader'
import { UsersList } from './UsersList'
import { UserEditModal } from './UserEditModal'
import { useModalStore } from '@/stores/modalStore'
import {
  useClickUpUsers,
  useSyncUsers,
  useTaskTypes,
  useBrands,
  useAddUserRole,
  useDeleteUserRole,
  useAddUserVacation,
  useDeleteUserVacation,
} from '@/hooks/queries/useUsers'

export const ClickUpUsersSync: React.FC = () => {
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [searchFilter, setSearchFilter] = useState('')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  
  // ✅ NUEVO: Estados para loading de operaciones específicas
  const [loadingStates, setLoadingStates] = useState<{
    addingRole?: boolean
    deletingRole?: number
    addingVacation?: boolean
    deletingVacation?: number
  }>({})

  const { openModal, closeModal } = useModalStore()

  const { 
    data: usersData, 
    isLoading, 
    refetch: refreshUsers 
  } = useClickUpUsers()

  const { 
    data: taskTypes = [], 
    isLoading: loadingTypes 
  } = useTaskTypes()
  
  const { 
    data: brands = [], 
    isLoading: loadingBrands 
  } = useBrands()

  const { mutate: syncUsers, isPending: syncing } = useSyncUsers({
    onSuccess: (data) => {
      const { statistics, notFoundUsers, errors } = data

      let successMessage = `${statistics.created} users synced successfully`

      if (notFoundUsers && notFoundUsers.length > 0) {
        successMessage += ` (${notFoundUsers.length} not found in teams)`
      }

      if (errors && errors.length > 0) {
        successMessage += ` (${errors.length} errors)`
      }

      toast.success(successMessage)

      if (notFoundUsers && notFoundUsers.length > 0) {
        toast.warning(`Users not found in teams: ${notFoundUsers.join(', ')}`)
      }

      if (errors && errors.length > 0) {
        console.warn('Errors during sync:', errors)
        toast.warning('Some users had errors. Check console for details.')
      }

      setSelectedUsers(new Set())
    },
    onError: (error: any) => {
      console.error('❌ Sync error:', error)
      const message = error.response?.data?.error || error.message
      toast.error(`Sync error: ${message}`)
    },
  })

  // ✅ NUEVO: Hooks para mutaciones de roles
  const { mutate: addUserRole } = useAddUserRole({
    onSuccess: () => {
      toast.success('Role added successfully')
      setLoadingStates(prev => ({ ...prev, addingRole: false }))
    },
    onError: () => {
      toast.error('Failed to add role')
      setLoadingStates(prev => ({ ...prev, addingRole: false }))
    }
  })

  const { mutate: deleteUserRole } = useDeleteUserRole(editingUserId || '', {
    onSuccess: () => {
      toast.success('Role deleted successfully')
      setLoadingStates(prev => ({ ...prev, deletingRole: undefined }))
    },
    onError: () => {
      toast.error('Failed to delete role')
      setLoadingStates(prev => ({ ...prev, deletingRole: undefined }))
    }
  })

  // ✅ NUEVO: Hooks para mutaciones de vacaciones
  const { mutate: addUserVacation } = useAddUserVacation({
    onSuccess: () => {
      toast.success('Vacation added successfully')
      setLoadingStates(prev => ({ ...prev, addingVacation: false }))
    },
    onError: () => {
      toast.error('Failed to add vacation')
      setLoadingStates(prev => ({ ...prev, addingVacation: false }))
    }
  })

  const { mutate: deleteUserVacation } = useDeleteUserVacation(editingUserId || '', {
    onSuccess: () => {
      toast.success('Vacation deleted successfully')
      setLoadingStates(prev => ({ ...prev, deletingVacation: undefined }))
    },
    onError: () => {
      toast.error('Failed to delete vacation')
      setLoadingStates(prev => ({ ...prev, deletingVacation: undefined }))
    }
  })

  const clickupUsers = usersData?.clickupUsers || []
  
  const filteredUsers = useMemo(() => {
    return clickupUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        user.email.toLowerCase().includes(searchFilter.toLowerCase())
      return matchesSearch
    })
  }, [clickupUsers, searchFilter])

  const availableUsers = useMemo(() => {
    return filteredUsers.filter((user) => user.canSync)
  }, [filteredUsers])

  const allAvailableSelected = useMemo(() => {
    return availableUsers.length > 0 &&
      availableUsers.every((user) => selectedUsers.has(user.clickupId))
  }, [availableUsers, selectedUsers])

  const handleUserSelection = (userId: string, checked: boolean) => {
    const newSelection = new Set(selectedUsers)

    if (checked) {
      newSelection.add(userId)
    } else {
      newSelection.delete(userId)
    }

    setSelectedUsers(newSelection)
    console.log(`${checked ? 'Selected' : 'Deselected'} user: ${userId}`)
  }

  const handleSelectAll = () => {
    if (allAvailableSelected) {
      const newSelection = new Set(selectedUsers)
      availableUsers.forEach((user) => newSelection.delete(user.clickupId))
      setSelectedUsers(newSelection)
    } else {
      const newSelection = new Set(selectedUsers)
      availableUsers.forEach((user) => newSelection.add(user.clickupId))
      setSelectedUsers(newSelection)
    }
  }

  const handleSync = () => {
    if (selectedUsers.size === 0) {
      toast.warning('Select at least one user to sync')
      return
    }

    syncUsers(Array.from(selectedUsers))
  }

  const handleRefresh = () => {
    refreshUsers()
  }

  // ✅ IMPLEMENTACIÓN CORRECTA: Funciones para operaciones de roles y vacaciones
  const handleAddRole = (typeId: number, brandId?: string) => {
    if (!editingUserId) {
      toast.error('No user selected for role assignment')
      return
    }

    console.log(`🔄 Adding role to user ${editingUserId}: typeId=${typeId}, brandId=${brandId || 'null'}`)
    setLoadingStates(prev => ({ ...prev, addingRole: true }))
    
    addUserRole({ 
      userId: editingUserId, 
      typeId, 
      brandId: brandId || null 
    })
  }

  const handleDeleteRole = (roleId: number) => {
    if (!editingUserId) {
      toast.error('No user selected for role deletion')
      return
    }

    console.log(`🗑️ Deleting role ${roleId} from user ${editingUserId}`)
    setLoadingStates(prev => ({ ...prev, deletingRole: roleId }))
    
    deleteUserRole(roleId)
  }

  const handleAddVacation = (startDate: string, endDate: string) => {
    if (!editingUserId) {
      toast.error('No user selected for vacation assignment')
      return
    }

    console.log(`🔄 Adding vacation to user ${editingUserId}: ${startDate} to ${endDate}`)
    setLoadingStates(prev => ({ ...prev, addingVacation: true }))
    
    addUserVacation({ 
      userId: editingUserId, 
      startDate, 
      endDate 
    })
  }

  const handleDeleteVacation = (vacationId: number) => {
    if (!editingUserId) {
      toast.error('No user selected for vacation deletion')
      return
    }

    console.log(`🗑️ Deleting vacation ${vacationId} from user ${editingUserId}`)
    setLoadingStates(prev => ({ ...prev, deletingVacation: vacationId }))
    
    deleteUserVacation(vacationId)
  }

  const handleEditUser = (userId: string) => {
    console.log(`✏️ Opening edit modal for user: ${userId}`)
    setEditingUserId(userId)
    
    openModal({
      title: `Edit User: ${clickupUsers.find(u => u.clickupId === userId)?.name}`,
      content: (
        <UserEditModal
          userId={userId}
          onAddRole={handleAddRole}
          onDeleteRole={handleDeleteRole}
          onAddVacation={handleAddVacation}
          onDeleteVacation={handleDeleteVacation}
          loadingStates={loadingStates}
        />
      ),
      onClose: () => {
        console.log(`🔒 Closing edit modal for user: ${userId}`)
        setEditingUserId(null)
        setLoadingStates({}) // Reset loading states when closing modal
      },
    })
  }

  return (
    <>
      <DesignersHeader
        searchValue={searchFilter}
        onSearchChange={setSearchFilter}
        selectedCount={selectedUsers.size}
        availableCount={availableUsers.length}
        allAvailableSelected={allAvailableSelected}
        onSelectAll={handleSelectAll}
        onSync={handleSync}
        onRefresh={handleRefresh}
        loading={isLoading}
        syncing={syncing}
      />

      <div className="p-6 flex-1">
        <UsersList
          users={filteredUsers}
          selectedUsers={selectedUsers}
          onUserSelect={handleUserSelection}
          onUserEdit={handleEditUser}
          loading={isLoading}
        />
      </div>
    </>
  )
}
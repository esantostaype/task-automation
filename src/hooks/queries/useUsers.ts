/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/queries/useUsers.ts - FIXED VERSION
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// Types
interface ClickUpUser {
  clickupId: string
  name: string
  email: string
  profilePicture: string
  initials: string
  color: string
  role: string
  lastActive: string
  dateJoined: string
  existsInLocal: boolean
  canSync: boolean
}

interface UserSyncResponse {
  clickupUsers: ClickUpUser[]
  localUsers: any[]
  statistics: {
    totalClickUpUsers: number
    existingInLocal: number
    availableToSync: number
    totalLocalUsers: number
  }
  teams: any[]
}

interface DetailedUser {
  id: string
  name: string
  email: string
  active: boolean
  roles: Array<{
    id: number
    userId: string
    typeId: number
    brandId?: string | null
    type: {
      id: number
      name: string
    }
    brand?: {
      id: string
      name: string
    } | null
  }>
  vacations: Array<{
    id: number
    userId: string
    startDate: string
    endDate: string
  }>
}

interface TaskType {
  id: number
  name: string
}

interface Brand {
  id: string
  name: string
}

// Query Keys
export const userKeys = {
  all: ['users'] as const,
  clickup: () => [...userKeys.all, 'clickup'] as const,
  details: (userId: string) => [...userKeys.all, 'details', userId] as const,
  types: () => ['task-types'] as const,
  brands: () => ['brands'] as const,
}

// Queries
export const useClickUpUsers = () => {
  return useQuery({
    queryKey: userKeys.clickup(),
    queryFn: async (): Promise<UserSyncResponse> => {
      const { data } = await axios.get('/api/sync/clickup-users')
      return data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - fresher for user management
  })
}

export const useUserDetails = (userId: string, enabled = true) => {
  return useQuery({
    queryKey: userKeys.details(userId),
    queryFn: async (): Promise<DetailedUser> => {
      const { data } = await axios.get(`/api/users/${userId}/details`)
      return data
    },
    enabled: enabled && !!userId,
  })
}

export const useTaskTypes = () => {
  return useQuery({
    queryKey: userKeys.types(),
    queryFn: async (): Promise<TaskType[]> => {
      const { data } = await axios.get('/api/types')
      return data
    },
  })
}

export const useBrands = () => {
  return useQuery({
    queryKey: userKeys.brands(),
    queryFn: async (): Promise<Brand[]> => {
      const { data } = await axios.get('/api/brands')
      return data
    },
  })
}

// Mutations
export const useSyncUsers = (options?: {
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const { data } = await axios.post('/api/sync/clickup-users', { userIds })
      return data
    },
    onSuccess: (data) => {
      // Invalidate and refetch users data
      queryClient.invalidateQueries({ queryKey: userKeys.clickup() })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

export const useAddUserRole = (options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: { userId: string; typeId: number; brandId?: string | null }) => {
      const { data } = await axios.post('/api/users/roles', payload)
      return data
    },
    onSuccess: (_, variables) => {
      // ✅ FIX: Invalidate user details to refetch roles
      queryClient.invalidateQueries({ queryKey: userKeys.details(variables.userId) })
      
      // ✅ NEW: Comprehensive cache invalidation for task assignment
      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      queryClient.invalidateQueries({ queryKey: ['compatible-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-slots'] })
      queryClient.invalidateQueries({ queryKey: ['best-user-selection'] })
      
      // ✅ NEW: Also invalidate task data queries (for user compatibility)
      queryClient.invalidateQueries({ queryKey: ['task-data'] })
      
      console.log('🔄 Cache invalidated after role addition - task suggestions will be recalculated')
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

// ✅ FIXED: Proper deletion with userId context
export const useDeleteUserRole = (userId: string, options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (roleId: number) => {
      await axios.delete(`/api/users/roles/${roleId}`)
      return { roleId, userId }
    },
    onSuccess: (data) => {
      // ✅ FIX: Now we always have userId to invalidate
      queryClient.invalidateQueries({ queryKey: userKeys.details(data.userId) })
      
      // ✅ NEW: Comprehensive cache invalidation for task assignment
      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      queryClient.invalidateQueries({ queryKey: ['compatible-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-slots'] })
      queryClient.invalidateQueries({ queryKey: ['best-user-selection'] })
      queryClient.invalidateQueries({ queryKey: ['task-data'] })
      
      console.log('🔄 Cache invalidated after role deletion - task suggestions will be recalculated')
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

export const useAddUserVacation = (options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: { userId: string; startDate: string; endDate: string }) => {
      const { data } = await axios.post('/api/users/vacations', payload)
      return data
    },
    onSuccess: (_, variables) => {
      // ✅ FIX: Invalidate user details to refetch vacations
      queryClient.invalidateQueries({ queryKey: userKeys.details(variables.userId) })
      
      // ✅ NEW: Vacation-specific cache invalidation (affects task assignment logic)
      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      queryClient.invalidateQueries({ queryKey: ['user-slots'] })
      queryClient.invalidateQueries({ queryKey: ['best-user-selection'] })
      queryClient.invalidateQueries({ queryKey: ['vacation-aware'] })
      
      console.log('🏖️ Cache invalidated after vacation addition - vacation-aware logic will recalculate')
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

// ✅ FIXED: Proper deletion with userId context
export const useDeleteUserVacation = (userId: string, options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (vacationId: number) => {
      await axios.delete(`/api/users/vacations/${vacationId}`)
      return { vacationId, userId }
    },
    onSuccess: (data) => {
      // ✅ FIX: Now we always have userId to invalidate
      queryClient.invalidateQueries({ queryKey: userKeys.details(data.userId) })
      
      // ✅ NEW: Vacation-specific cache invalidation
      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      queryClient.invalidateQueries({ queryKey: ['user-slots'] })
      queryClient.invalidateQueries({ queryKey: ['best-user-selection'] })
      queryClient.invalidateQueries({ queryKey: ['vacation-aware'] })
      
      console.log('🏖️ Cache invalidated after vacation deletion - vacation-aware logic will recalculate')
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/queries/useUsers.ts
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
      // Invalidate user details to refetch roles
      queryClient.invalidateQueries({ queryKey: userKeys.details(variables.userId) })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

export const useDeleteUserRole = (options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (roleId: number, context?: { context: { userId: string } }) => {
      await axios.delete(`/api/users/roles/${roleId}`)
      return { roleId, userId: context?.context?.userId }
    },
    onSuccess: (data) => {
      // Invalidate user details if we have userId
      if (data.userId) {
        queryClient.invalidateQueries({ queryKey: userKeys.details(data.userId) })
      }
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
      queryClient.invalidateQueries({ queryKey: userKeys.details(variables.userId) })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

export const useDeleteUserVacation = (options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (vacationId: number, context?: { context: { userId: string } }) => {
      await axios.delete(`/api/users/vacations/${vacationId}`)
      return { vacationId, userId: context?.context?.userId }
    },
    onSuccess: (data) => {
      if (data.userId) {
        queryClient.invalidateQueries({ queryKey: userKeys.details(data.userId) })
      }
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
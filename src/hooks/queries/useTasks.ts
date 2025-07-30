/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/queries/useTasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// Types
interface Task {
  clickupId: string
  customId?: string | null
  name: string
  description: string
  status: string
  statusColor: string
  priority: string
  priorityColor: string
  assignees: Array<{
    id: string
    name: string
    email: string
    initials: string
    color: string
  }>
  dueDate?: string | null
  timeEstimate?: number | null
  tags: string[]
  list: {
    id: string
    name: string
  }
  space: {
    id: string
    name: string
  }
  url: string
  existsInLocal: boolean
  canSync: boolean
}

interface TaskSyncResponse {
  clickupTasks: Task[]
  statistics: {
    totalClickUpTasks: number
    existingInLocal: number
    availableToSync: number
    totalLocalTasks: number
  }
}

interface Category {
  id: number
  name: string
  type: {
    name: string
  }
  tierList: {
    name: string
  }
}

interface Brand {
  id: string
  name: string
  isActive: boolean
}

interface SyncTasksPayload {
  taskIds: string[]
  categoryId?: number | null
  brandId: string
}

// Query Keys
export const taskKeys = {
  all: ['tasks'] as const,
  clickup: () => [...taskKeys.all, 'clickup'] as const,
  categories: () => ['categories'] as const,
  brands: () => ['brands'] as const,
}

// Queries
export const useClickUpTasks = () => {
  return useQuery({
    queryKey: taskKeys.clickup(),
    queryFn: async (): Promise<TaskSyncResponse> => {
      const { data } = await axios.get('/api/sync/clickup-tasks')
      return data
    },
    staleTime: 3 * 60 * 1000, // 3 minutes - tasks change frequently
  })
}

export const useCategories = () => {
  return useQuery({
    queryKey: taskKeys.categories(),
    queryFn: async (): Promise<Category[]> => {
      const { data } = await axios.get('/api/categories')
      return data
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - categories don't change often
  })
}

export const useTaskBrands = () => {
  return useQuery({
    queryKey: taskKeys.brands(),
    queryFn: async (): Promise<Brand[]> => {
      const { data } = await axios.get('/api/brands')
      return data?.filter((b: Brand) => b.isActive) || []
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - brands don't change often
  })
}

// Mutations
export const useSyncTasks = (options?: {
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: SyncTasksPayload) => {
      const { data } = await axios.post('/api/sync/clickup-tasks', payload)
      return data
    },
    onSuccess: (data) => {
      // Invalidate and refetch tasks data
      queryClient.invalidateQueries({ queryKey: taskKeys.clickup() })
      
      // Also invalidate task-related data
      queryClient.invalidateQueries({ queryKey: ['task-data'] })
      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      
      console.log('🔄 Cache invalidated after task sync')
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

export const useRefreshTasks = (options?: {
  onSuccess?: () => void
  onError?: (error: any) => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      // Force refetch by invalidating cache
      await queryClient.invalidateQueries({ queryKey: taskKeys.clickup() })
      return 'refreshed'
    },
    onSuccess: () => {
      console.log('🔄 Tasks refreshed successfully')
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
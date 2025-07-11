// src/hooks/useTaskData.ts - VERSIÓN CON REACT QUERY
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { TierInfo, TaskType, Brand, User } from '@/interfaces'

// Query keys para React Query
export const taskDataKeys = {
  all: ['task-data'] as const,
  types: () => [...taskDataKeys.all, 'types'] as const,
  brands: () => [...taskDataKeys.all, 'brands'] as const,
  users: () => [...taskDataKeys.all, 'users'] as const,
  tiers: () => [...taskDataKeys.all, 'tiers'] as const,
}

// Funciones de fetching
const fetchTypes = async (): Promise<TaskType[]> => {
  const response = await axios.get('/api/types')
  return response.data
}

const fetchBrands = async (): Promise<Brand[]> => {
  const response = await axios.get('/api/brands')
  return response.data.filter((brand: Brand) => brand.isActive)
}

const fetchUsers = async (): Promise<User[]> => {
  const response = await axios.get('/api/users')
  return response.data.filter((user: User) => user.active)
}

const fetchTiers = async (): Promise<TierInfo[]> => {
  const response = await axios.get('/api/tiers')
  return response.data
}

export const useTaskData = () => {
  const queryClient = useQueryClient()

  // Queries individuales
  const {
    data: types = [],
    isLoading: typesLoading,
    error: typesError
  } = useQuery({
    queryKey: taskDataKeys.types(),
    queryFn: fetchTypes,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })

  const {
    data: brands = [],
    isLoading: brandsLoading,
    error: brandsError
  } = useQuery({
    queryKey: taskDataKeys.brands(),
    queryFn: fetchBrands,
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError
  } = useQuery({
    queryKey: taskDataKeys.users(),
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: tiers = [],
    isLoading: tiersLoading,
    error: tiersError
  } = useQuery({
    queryKey: taskDataKeys.tiers(),
    queryFn: fetchTiers,
    staleTime: 5 * 60 * 1000,
  })

  // Loading y error combinados
  const loading = typesLoading || brandsLoading || usersLoading || tiersLoading
  const error = typesError || brandsError || usersError || tiersError

  // Funciones de refresh
  const refreshData = () => {
    console.log('🔄 Refrescando todos los datos...')
    queryClient.invalidateQueries({ queryKey: taskDataKeys.all })
  }

  const refreshTypes = () => {
    console.log('🔄 Refrescando tipos y categorías...')
    queryClient.invalidateQueries({ queryKey: taskDataKeys.types() })
  }

  const refreshTiers = () => {
    console.log('🔄 Refrescando tiers...')
    queryClient.invalidateQueries({ queryKey: taskDataKeys.tiers() })
    // También invalidar types porque las categorías dependen de los tiers
    queryClient.invalidateQueries({ queryKey: taskDataKeys.types() })
  }

  const refreshBrands = () => {
    console.log('🔄 Refrescando brands...')
    queryClient.invalidateQueries({ queryKey: taskDataKeys.brands() })
  }

  const refreshUsers = () => {
    console.log('🔄 Refrescando users...')
    queryClient.invalidateQueries({ queryKey: taskDataKeys.users() })
  }

  // Log cuando se obtienen datos
  if (types.length > 0 || brands.length > 0 || users.length > 0 || tiers.length > 0) {
    console.log('📊 Datos obtenidos del servidor:')
    console.log(`   - Types: ${types.length}`)
    console.log(`   - Brands: ${brands.length}`)
    console.log(`   - Users: ${users.length}`)
    console.log(`   - Tiers: ${tiers.length}`)
  }

  return {
    types,
    brands,
    users,
    tiers,
    loading,
    error,
    refreshData,
    refreshTypes,
    refreshTiers,
    refreshBrands,
    refreshUsers,
  }
}

// Hook para invalidar task data cache desde otros componentes
export const useTaskDataInvalidation = () => {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      console.log('🗑️ Invalidating all task data cache...')
      queryClient.invalidateQueries({ queryKey: taskDataKeys.all })
    },
    invalidateTypes: () => {
      console.log('🗑️ Invalidating types cache...')
      queryClient.invalidateQueries({ queryKey: taskDataKeys.types() })
    },
    invalidateTiers: () => {
      console.log('🗑️ Invalidating tiers cache...')
      queryClient.invalidateQueries({ queryKey: taskDataKeys.tiers() })
      queryClient.invalidateQueries({ queryKey: taskDataKeys.types() })
    },
    invalidateBrands: () => {
      console.log('🗑️ Invalidating brands cache...')
      queryClient.invalidateQueries({ queryKey: taskDataKeys.brands() })
    },
    invalidateUsers: () => {
      console.log('🗑️ Invalidating users cache...')
      queryClient.invalidateQueries({ queryKey: taskDataKeys.users() })
    },
  }
}
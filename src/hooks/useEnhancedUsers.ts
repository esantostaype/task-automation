// src/hooks/useEnhancedUsers.ts
import { useState, useEffect } from 'react';
import axios from 'axios';

interface EnhancedUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  isSpecialist: boolean;
  status: 'available' | 'on_vacation' | 'overloaded';
  availableFrom: string;
  hasVacationConflict: boolean;
  currentWorkload: {
    taskCount: number;
    durationDays: number;
    lastTaskDeadline?: string;
  };
  vacationInfo?: {
    currentVacation?: {
      startDate: string;
      endDate: string;
      durationDays: number;
      returnDate: string;
    };
    upcomingVacations: Array<{
      startDate: string;
      endDate: string;
      durationDays: number;
    }>;
  };
  recommendation?: {
    shouldWaitForReturn: boolean;
    daysSavedByWaiting: number;
    alternativeStartDate: string;
    reason: string;
  };
}

interface EnhancedUsersResponse {
  availableUsers: EnhancedUser[];
  usersOnVacation: EnhancedUser[];
  overloadedUsers: EnhancedUser[];
  smartSuggestion?: {
    userId: string;
    reason: string;
    alternativeStartDate: string;
    daysSaved: number;
  };
  totalCompatible: number;
  message: string;
}

interface UseEnhancedUsersParams {
  typeId?: number;
  brandId?: string;
  durationDays?: number;
  enabled?: boolean;
}

export const useEnhancedUsers = ({
  typeId,
  brandId,
  durationDays,
  enabled = true
}: UseEnhancedUsersParams) => {
  const [data, setData] = useState<EnhancedUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar si tenemos todos los parámetros necesarios
  const hasRequiredParams = typeId && typeId > 0 && durationDays && durationDays > 0;
  const shouldFetch = enabled && hasRequiredParams;

  useEffect(() => {
    if (!shouldFetch) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchEnhancedUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        const params: Record<string, string> = {
          typeId: typeId!.toString(),
          durationDays: durationDays!.toString()
        };

        if (brandId) {
          params.brandId = brandId;
        }

        console.log('🧠 Fetching enhanced users with params:', params);

        const response = await axios.get<EnhancedUsersResponse>('/api/users/enhanced', {
          params
        });

        console.log('✅ Enhanced users response:', response.data);
        setData(response.data);

      } catch (err) {
        console.error('❌ Error fetching enhanced users:', err);
        
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error || err.message);
        } else {
          setError('Unknown error occurred');
        }
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEnhancedUsers();
  }, [typeId, brandId, durationDays, shouldFetch]);

  // Función para refetch manual
  const refetch = () => {
    if (shouldFetch) {
      setError(null);
    }
  };

  // Funciones helper para acceder a la data fácilmente
  const getAllUsers = (): EnhancedUser[] => {
    if (!data) return [];
    return [...data.availableUsers, ...data.usersOnVacation, ...data.overloadedUsers];
  };

  const getUserById = (userId: string): EnhancedUser | undefined => {
    return getAllUsers().find(user => user.id === userId);
  };

  const getVacationWarning = (userId: string): string | null => {
    const user = getUserById(userId);
    if (!user) return null;

    if (user.status === 'on_vacation' && user.vacationInfo?.currentVacation) {
      const vacation = user.vacationInfo.currentVacation;
      return `${user.name} is currently on vacation until ${vacation.endDate}. Task would start on ${vacation.returnDate} when they return.`;
    }

    if (user.hasVacationConflict && user.recommendation?.shouldWaitForReturn) {
      return `${user.name} has vacation conflicts. Task would start on ${user.recommendation.alternativeStartDate}, saving ${user.recommendation.daysSavedByWaiting} days compared to other options.`;
    }

    return null;
  };

  return {
    // Datos principales
    availableUsers: data?.availableUsers || [],
    usersOnVacation: data?.usersOnVacation || [],
    overloadedUsers: data?.overloadedUsers || [],
    allUsers: getAllUsers(),
    
    // Sugerencia inteligente
    smartSuggestion: data?.smartSuggestion,
    
    // Estadísticas
    totalCompatible: data?.totalCompatible || 0,
    totalAvailable: data?.availableUsers.length || 0,
    totalOnVacation: data?.usersOnVacation.length || 0,
    
    // Estado
    loading,
    error,
    hasRequiredParams,
    message: data?.message || '',
    
    // Funciones helper
    getUserById,
    getVacationWarning,
    refetch
  };
};
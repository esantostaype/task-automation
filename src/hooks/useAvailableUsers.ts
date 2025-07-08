// src/hooks/useAvailableUsers.ts
import { useState, useEffect } from 'react';
import axios from 'axios';

interface AvailableUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  isSpecialist: boolean;
  availableFrom: string;
  hasVacationConflict: boolean;
  vacationDetails?: {
    conflictingVacations: Array<{
      startDate: string;
      endDate: string;
      durationDays: number;
    }>;
  };
}

interface AvailableUsersResponse {
  availableUsers: AvailableUser[];
  totalCompatible: number;
  totalAvailable: number;
  allOnVacation: boolean;
  unavailableUsers?: Array<{
    name: string;
    reason: string;
    vacations: string[];
  }>;
  message: string;
}

interface UseAvailableUsersParams {
  typeId?: number;
  brandId?: string;
  durationDays?: number;
  enabled?: boolean;
}

export const useAvailableUsers = ({
  typeId,
  brandId,
  durationDays,
  enabled = true
}: UseAvailableUsersParams) => {
  const [data, setData] = useState<AvailableUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar si tenemos todos los parámetros necesarios
  const hasRequiredParams = typeId && typeId > 0 && durationDays && durationDays > 0;
  const shouldFetch = enabled && hasRequiredParams;

  useEffect(() => {
    if (!shouldFetch) {
      // Limpiar datos cuando no se puede hacer fetch
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchAvailableUsers = async () => {
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

        console.log('🔍 Fetching available users with params:', params);

        const response = await axios.get<AvailableUsersResponse>('/api/users/available', {
          params
        });

        console.log('✅ Available users response:', response.data);
        setData(response.data);

      } catch (err) {
        console.error('❌ Error fetching available users:', err);
        
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

    fetchAvailableUsers();
  }, [typeId, brandId, durationDays, shouldFetch]);

  // Función para refetch manual
  const refetch = () => {
    if (shouldFetch) {
      // Trigger useEffect again by updating a dependency
      setError(null);
    }
  };

  return {
    availableUsers: data?.availableUsers || [],
    totalCompatible: data?.totalCompatible || 0,
    totalAvailable: data?.totalAvailable || 0,
    allOnVacation: data?.allOnVacation || false,
    unavailableUsers: data?.unavailableUsers || [],
    message: data?.message || '',
    loading,
    error,
    hasRequiredParams,
    refetch
  };
};
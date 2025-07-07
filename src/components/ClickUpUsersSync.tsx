/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/ClickUpUsersSync.tsx - Componente para sincronizar usuarios de ClickUp

"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Checkbox, 
  Avatar, 
  Chip,
  LinearProgress,
  Box,
  Alert
} from '@mui/joy';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  RefreshIcon, 
  DatabaseSync01Icon, 
  UserCheck01Icon,
  UserRemove01Icon,
  SearchListIcon,
  CheckmarkSquare02Icon
} from '@hugeicons/core-free-icons';
import { ClickUpTroubleshootingGuide } from './ClickUpTroubleshootingGuide';

interface ClickUpUser {
  clickupId: string;
  name: string;
  email: string;
  profilePicture: string;
  initials: string;
  timezone: string;
  color: string;
  role: string; // ✅ NUEVO: Rol en ClickUp
  lastActive: string; // ✅ NUEVO: Última actividad
  dateJoined: string; // ✅ NUEVO: Fecha de unión
  existsInLocal: boolean;
  canSync: boolean;
}

interface LocalUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

interface SyncStatistics {
  totalClickUpUsers: number;
  existingInLocal: number;
  availableToSync: number;
  totalLocalUsers: number;
}

interface Team {
  id: string;
  name: string;
  memberCount: number;
}

interface SyncResponse {
  clickupUsers: ClickUpUser[];
  localUsers: LocalUser[];
  statistics: SyncStatistics;
  teams: Team[];
}

export const ClickUpUsersSync: React.FC = () => {
  // Estados principales
  const [clickupUsers, setClickupUsers] = useState<ClickUpUser[]>([]);
  const [localUsers, setLocalUsers] = useState<LocalUser[]>([]);
  const [statistics, setStatistics] = useState<SyncStatistics | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Estados de la UI
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [showFilter, setShowFilter] = useState<'all' | 'available' | 'existing'>('all');
  const [error, setError] = useState<string | null>(null); // ✅ NUEVO: Estado de error
  const [debugMode, setDebugMode] = useState(false); // ✅ NUEVO: Modo debug

  // Cargar datos iniciales
  useEffect(() => {
    fetchClickUpUsers();
  }, []);

  // ✅ NUEVA FUNCIÓN: Debug de datos crudos
  const debugClickUpData = async () => {
    try {
      console.log('🔍 Iniciando debug de datos de ClickUp...');
      const response = await axios.get('/api/debug/clickup-raw');
      console.log('📊 Debug response:', response.data);
      
      // Mostrar en consola para debugging
      console.table(response.data.analysis.teams);
      
      toast.info('Debug data logged to console. Check browser developer tools.');
      setDebugMode(true);
      
    } catch (error) {
      console.error('❌ Error en debug:', error);
      toast.error('Error obtaining debug data');
    }
  };

  const fetchClickUpUsers = async () => {
    setLoading(true);
    setError(null); // ✅ Limpiar errores previos
    try {
      console.log('🔄 Obteniendo usuarios de ClickUp...');
      
      const response = await axios.get<SyncResponse>('/api/sync/clickup-users');
      
      setClickupUsers(response.data.clickupUsers);
      setLocalUsers(response.data.localUsers);
      setStatistics(response.data.statistics);
      setTeams(response.data.teams);
      
      console.log('✅ Datos cargados exitosamente');
      toast.success(`${response.data.statistics.totalClickUpUsers} usuarios encontrados en ClickUp`);
      
    } catch (error) {
      console.error('❌ Error obteniendo usuarios:', error);
      
      let errorMessage = 'Error inesperado al obtener usuarios';
      
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error || error.message;
        const apiDetails = error.response?.data?.details;
        
        errorMessage = apiDetails ? `${apiError}: ${apiDetails}` : apiError;
        
        // ✅ Guardar error para mostrar UI de debug
        setError(errorMessage);
        
        toast.error(`Error: ${apiError}`);
      } else {
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    const newSelection = new Set(selectedUsers);
    
    if (checked) {
      newSelection.add(userId);
    } else {
      newSelection.delete(userId);
    }
    
    setSelectedUsers(newSelection);
    console.log(`${checked ? 'Seleccionado' : 'Deseleccionado'} usuario: ${userId}`);
  };

  const handleSelectAll = () => {
    const availableUsers = filteredUsers.filter(user => user.canSync);
    const allSelected = availableUsers.every(user => selectedUsers.has(user.clickupId));
    
    if (allSelected) {
      // Deseleccionar todos los disponibles
      const newSelection = new Set(selectedUsers);
      availableUsers.forEach(user => newSelection.delete(user.clickupId));
      setSelectedUsers(newSelection);
    } else {
      // Seleccionar todos los disponibles
      const newSelection = new Set(selectedUsers);
      availableUsers.forEach(user => newSelection.add(user.clickupId));
      setSelectedUsers(newSelection);
    }
  };

  const syncSelectedUsers = async () => {
    if (selectedUsers.size === 0) {
      toast.warning('Selecciona al menos un usuario para sincronizar');
      return;
    }

    setSyncing(true);
    
    try {
      console.log(`🔄 Sincronizando ${selectedUsers.size} usuarios...`);
      
      const response = await axios.post('/api/sync/clickup-users', {
        userIds: Array.from(selectedUsers)
      });

      console.log('✅ Sincronización completada:', response.data);

      const { statistics, createdUsers, notFoundUsers, errors } = response.data;
      
      // Construir mensaje de éxito detallado
      let successMessage = `${statistics.created} usuarios sincronizados exitosamente`;
      
      if (notFoundUsers && notFoundUsers.length > 0) {
        successMessage += ` (${notFoundUsers.length} no encontrados en teams)`;
      }
      
      if (errors && errors.length > 0) {
        successMessage += ` (${errors.length} errores)`;
      }

      toast.success(successMessage);

      // Mostrar detalles adicionales si es necesario
      if (notFoundUsers && notFoundUsers.length > 0) {
        toast.warning(`Usuarios no encontrados en teams: ${notFoundUsers.join(', ')}`);
      }
      
      if (errors && errors.length > 0) {
        console.warn('Errores durante la sincronización:', errors);
        toast.warning(`Algunos usuarios tuvieron errores. Ver consola para detalles.`);
      }

      // Limpiar selección y recargar datos
      setSelectedUsers(new Set());
      await fetchClickUpUsers();

    } catch (error) {
      console.error('❌ Error en sincronización:', error);
      
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        toast.error(`Error en sincronización: ${message}`);
      } else {
        toast.error('Error inesperado durante la sincronización');
      }
    } finally {
      setSyncing(false);
    }
  };

  // Filtrar usuarios basado en búsqueda y filtro
  const filteredUsers = clickupUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchFilter.toLowerCase());
    
    switch (showFilter) {
      case 'available':
        return matchesSearch && user.canSync;
      case 'existing':
        return matchesSearch && user.existsInLocal;
      default:
        return matchesSearch;
    }
  });

  const availableUsers = filteredUsers.filter(user => user.canSync);
  const allAvailableSelected = availableUsers.length > 0 && 
    availableUsers.every(user => selectedUsers.has(user.clickupId));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Typography level="h2" startDecorator={<HugeiconsIcon icon={DatabaseSync01Icon} size={28} />}>
            ClickUp Users Sync
          </Typography>
          <Typography level="body-md" sx={{ color: 'text.tertiary' }}>
            Sincroniza usuarios de ClickUp con tu base de datos local
          </Typography>
        </div>
        
        <Button
          variant="outlined"
          startDecorator={<HugeiconsIcon icon={RefreshIcon} size={20} />}
          onClick={fetchClickUpUsers}
          disabled={loading}
          loading={loading}
        >
          Refrescar
        </Button>
        
        {/* ✅ NUEVO: Botón de debug cuando hay errores */}
        {(error || debugMode) && (
          <Button
            variant="outlined"
            color="warning"
            size="sm"
            onClick={debugClickUpData}
            disabled={loading}
          >
            🔍 Debug Data
          </Button>
        )}
      </div>

      {/* ✅ MEJORADO: Guía de troubleshooting */}
      {error && !loading && (
        <div className="space-y-4">
          <ClickUpTroubleshootingGuide
            error={error}
            onDebugClick={debugClickUpData}
            onRetryClick={fetchClickUpUsers}
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <HugeiconsIcon icon={SearchListIcon} size={20} />
              <Typography>Obteniendo usuarios de ClickUp...</Typography>
            </Box>
            <LinearProgress />
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {statistics && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent>
              <Typography level="h3" sx={{ textAlign: 'center' }}>
                {statistics.totalClickUpUsers}
              </Typography>
              <Typography level="body-sm" sx={{ textAlign: 'center', color: 'text.tertiary' }}>
                Total ClickUp
              </Typography>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <Typography level="h3" sx={{ textAlign: 'center', color: 'success.500' }}>
                {statistics.availableToSync}
              </Typography>
              <Typography level="body-sm" sx={{ textAlign: 'center', color: 'text.tertiary' }}>
                Disponibles
              </Typography>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <Typography level="h3" sx={{ textAlign: 'center', color: 'neutral.500' }}>
                {statistics.existingInLocal}
              </Typography>
              <Typography level="body-sm" sx={{ textAlign: 'center', color: 'text.tertiary' }}>
                Ya existen
              </Typography>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <Typography level="h3" sx={{ textAlign: 'center', color: 'primary.500' }}>
                {statistics.totalLocalUsers}
              </Typography>
              <Typography level="body-sm" sx={{ textAlign: 'center', color: 'text.tertiary' }}>
                Total Local
              </Typography>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Teams Info */}
      {teams.length > 0 && !loading && (
        <Alert variant="soft" color="primary">
          <Typography level="body-sm">
            <strong>Teams encontrados:</strong> {teams.map(team => `${team.name} (${team.memberCount})`).join(', ')}
          </Typography>
        </Alert>
      )}

      {/* Controls */}
      {!loading && clickupUsers.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              
              {/* Search */}
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                {(['all', 'available', 'existing'] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={showFilter === filter ? "solid" : "outlined"}
                    size="sm"
                    onClick={() => setShowFilter(filter)}
                  >
                    {filter === 'all' && 'Todos'}
                    {filter === 'available' && 'Disponibles'}
                    {filter === 'existing' && 'Existentes'}
                  </Button>
                ))}
              </div>

              {/* Bulk Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outlined"
                  size="sm"
                  startDecorator={<HugeiconsIcon icon={CheckmarkSquare02Icon} size={16} />}
                  onClick={handleSelectAll}
                  disabled={availableUsers.length === 0}
                >
                  {allAvailableSelected ? 'Deseleccionar' : 'Seleccionar'} disponibles
                </Button>
                
                <Button
                  variant="solid"
                  color="primary"
                  size="sm"
                  startDecorator={<HugeiconsIcon icon={DatabaseSync01Icon} size={16} />}
                  onClick={syncSelectedUsers}
                  disabled={selectedUsers.size === 0}
                  loading={syncing}
                >
                  Sincronizar ({selectedUsers.size})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      {!loading && (
        <Card>
          <CardContent>
            <div className="space-y-3">
              
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Typography level="body-md" sx={{ color: 'text.tertiary' }}>
                    {searchFilter 
                      ? 'No se encontraron usuarios que coincidan con la búsqueda'
                      : 'No hay usuarios para mostrar'
                    }
                  </Typography>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.clickupId}
                    className={`flex items-center gap-4 p-3 rounded-lg border ${
                      user.existsInLocal 
                        ? 'border-gray-600 bg-gray-800/50' 
                        : selectedUsers.has(user.clickupId)
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/50'
                    } transition-colors`}
                  >
                    
                    {/* Checkbox */}
                    <Checkbox
                      checked={selectedUsers.has(user.clickupId)}
                      onChange={(e) => handleUserSelection(user.clickupId, e.target.checked)}
                      disabled={user.existsInLocal}
                    />

                    {/* Avatar */}
                    <Avatar
                      src={user.profilePicture}
                      sx={{  
                        width: 40, 
                        height: 40,
                        bgcolor: user.color || 'primary.500'
                      }}
                    >
                      {user.initials}
                    </Avatar>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Typography level="title-sm" className="truncate">
                          {user.name}
                        </Typography>
                        
                        {user.existsInLocal ? (
                          <Chip
                            variant="soft"
                            color="neutral"
                            size="sm"
                            startDecorator={<HugeiconsIcon icon={UserRemove01Icon} size={14} />}
                          >
                            Ya existe
                          </Chip>
                        ) : (
                          <Chip
                            variant="soft"
                            color="success"
                            size="sm"
                            startDecorator={<HugeiconsIcon icon={UserCheck01Icon} size={14} />}
                          >
                            Disponible
                          </Chip>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 mt-1">
                        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                          {user.email}
                        </Typography>
                        
                        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                          ID: {user.clickupId}
                        </Typography>
                        
                        {user.role && (
                          <Chip
                            variant="outlined"
                            size="sm"
                            color={user.role === 'owner' ? 'primary' : 'neutral'}
                          >
                            {user.role}
                          </Chip>
                        )}
                        
                        {user.lastActive && (
                          <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                            Active: {new Date(parseInt(user.lastActive)).toLocaleDateString()}
                          </Typography>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && clickupUsers.length === 0 && (
        <Card>
          <CardContent>
            <div className="text-center py-8">
              <HugeiconsIcon icon={SearchListIcon} size={48} className="mx-auto mb-4 text-gray-500" />
              <Typography level="h4" sx={{ mb: 1 }}>
                No se encontraron usuarios
              </Typography>
              <Typography level="body-md" sx={{ color: 'text.tertiary' }}>
                Verifica la configuración de ClickUp API o intenta refrescar
              </Typography>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
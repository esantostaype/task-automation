
// src/components/designers/UserEditModal.tsx
import React from 'react'
import { UserRoleRow } from './UserRoleRow'
import { UserVacationRow } from './UserVacationRow'
import { AddRoleForm } from './AddRoleForm'
import { AddVacationForm } from './AddVacationForm'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserIcon, Calendar04Icon } from '@hugeicons/core-free-icons'
import { useUserDetails, useTaskTypes, useBrands } from '@/hooks/queries/useUsers'
import { Alert } from '@mui/joy'

interface UserEditModalProps {
  userId: string
  onAddRole: (typeId: number, brandId?: string) => void
  onDeleteRole: (roleId: number) => void
  onAddVacation: (startDate: string, endDate: string) => void
  onDeleteVacation: (vacationId: number) => void
  loadingStates?: {
    addingRole?: boolean
    deletingRole?: number
    addingVacation?: boolean
    deletingVacation?: number
  }
}

export const UserEditModal: React.FC<UserEditModalProps> = ({
  userId,
  onAddRole,
  onDeleteRole,
  onAddVacation,
  onDeleteVacation,
  loadingStates = {}
}) => {
  const { 
    data: user, 
    isLoading: loadingUser, 
    error: userError 
  } = useUserDetails(userId)
  
  const { 
    data: taskTypes = [], 
    isLoading: loadingTypes, 
    error: typesError 
  } = useTaskTypes()
  
  const { 
    data: brands = [], 
    isLoading: loadingBrands, 
    error: brandsError 
  } = useBrands()

  // ✅ DEBUG: Log para verificar datos
  React.useEffect(() => {
    console.log('🔍 UserEditModal Debug:', {
      userId,
      user: user ? { id: user.id, name: user.name, rolesCount: user.roles?.length } : null,
      taskTypes: taskTypes?.length || 0,
      brands: brands?.length || 0,
      loading: { user: loadingUser, types: loadingTypes, brands: loadingBrands },
      errors: { user: userError, types: typesError, brands: brandsError }
    })
  }, [userId, user, taskTypes, brands, loadingUser, loadingTypes, loadingBrands, userError, typesError, brandsError])

  // Removed the LinearProgress block

  // ✅ Manejo mejorado de errores
  if (userError || typesError || brandsError) {
    return (
      <div className="p-6">
        <Alert color="danger" variant="soft">
          <div>
            <strong>Error loading data:</strong>
            <ul className="mt-2 text-sm">
              {userError && <li>User: {userError instanceof Error ? userError.message : 'Unknown error'}</li>}
              {typesError && <li>Task Types: {typesError instanceof Error ? typesError.message : 'Unknown error'}</li>}
              {brandsError && <li>Brands: {brandsError instanceof Error ? brandsError.message : 'Unknown error'}</li>}
            </ul>
          </div>
        </Alert>
      </div>
    )
  }

  if (!user && !loadingUser) { // Only show 'User not found' if not loading and user is null
    return (
      <div className="p-8 text-center text-gray-400">
        User not found
      </div>
    )
  }

  // ✅ Verificación adicional de datos
  if (!taskTypes || taskTypes.length === 0) {
    console.warn('⚠️ No task types loaded')
  }

  if (!brands || brands.length === 0) {
    console.warn('⚠️ No brands loaded')
  }

  const showRoleSkeleton = loadingUser || (user && user.roles?.length === 0 && loadingUser);
  const showVacationSkeleton = loadingUser || (user && user.vacations?.length === 0 && loadingUser);

  return (
    <div className="p-8 space-y-6">
      {/* User Roles Section */}
      <div>
        <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
          <HugeiconsIcon icon={UserIcon} size={20} />
          User Roles
        </h3>
        
        {/* Current Roles Table */}
        <div className="border border-white/10 rounded-lg overflow-hidden mb-4">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-300">Type</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-300">Brand</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-300 w-[5rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {user && user.roles && user.roles.length > 0 && user.roles.map((role) => (
                <UserRoleRow
                  key={role.id}
                  role={role}
                  onDelete={onDeleteRole}
                  deleting={loadingStates.deletingRole === role.id}
                  loading={loadingUser} // Pass loadingUser to row
                />
              ))}
              {(showRoleSkeleton || (user && user.roles.length === 0)) && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-gray-400">
                    {showRoleSkeleton ? 'Loading roles...' : 'No roles assigned'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add New Role Form */}
        <AddRoleForm
          taskTypes={taskTypes}
          brands={brands}
          onAdd={onAddRole}
          loading={loadingStates.addingRole}
          loadingTypes={loadingTypes}
          loadingBrands={loadingBrands}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* User Vacations Section */}
      <div>
        <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
          <HugeiconsIcon icon={Calendar04Icon} size={20} />
          Vacations
        </h3>
        
        {/* Current Vacations Table */}
        <div className="border border-white/10 rounded-lg overflow-hidden mb-4">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-300">Start Date</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-300">End Date</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-300">Duration</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-300 w-[5rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {user && user.vacations && user.vacations.length > 0 && user.vacations.map((vacation) => (
                <UserVacationRow
                  key={vacation.id}
                  vacation={vacation}
                  onDelete={onDeleteVacation}
                  deleting={loadingStates.deletingVacation === vacation.id}
                  loading={loadingUser} // Pass loadingUser to row
                />
              ))}
              {(showVacationSkeleton || (user && user.vacations.length === 0)) && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                    {showVacationSkeleton ? 'Loading vacations...' : 'No vacations scheduled'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add New Vacation Form */}
        <AddVacationForm
          onAdd={onAddVacation}
          loading={loadingStates.addingVacation}
        />
      </div>
    </div>
  )
}

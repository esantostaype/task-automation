import React from 'react'
import { UserRoleRow } from './UserRoleRow'
import { UserVacationRow } from './UserVacationRow'
import { AddRoleForm } from './AddRoleForm'
import { AddVacationForm } from './AddVacationForm'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserIcon, CalendarIcon } from '@hugeicons/core-free-icons'
import { useUserDetails, useTaskTypes, useBrands } from '@/hooks/queries/useUsers'
import { LinearProgress } from '@mui/joy'

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
  const { data: user, isLoading: loadingUser } = useUserDetails(userId)
  const { data: taskTypes = [], isLoading: loadingTypes } = useTaskTypes()
  const { data: brands = [], isLoading: loadingBrands } = useBrands()

  if (loadingUser || loadingTypes || loadingBrands) {
    return (
      <div className="p-6 flex justify-center">
        <LinearProgress />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-400">
        Error loading user details
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* User Roles Section */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
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
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {user.roles.map((role) => (
                <UserRoleRow
                  key={role.id}
                  role={role}
                  onDelete={onDeleteRole}
                  deleting={loadingStates.deletingRole === role.id}
                />
              ))}
              {user.roles.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-gray-400">
                    No roles assigned
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
        />
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* User Vacations Section */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <HugeiconsIcon icon={CalendarIcon} size={20} />
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
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {user.vacations.map((vacation) => (
                <UserVacationRow
                  key={vacation.id}
                  vacation={vacation}
                  onDelete={onDeleteVacation}
                  deleting={loadingStates.deletingVacation === vacation.id}
                />
              ))}
              {user.vacations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                    No vacations scheduled
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
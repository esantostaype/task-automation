/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect, forwardRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
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
  Input,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  Select,
  Option,
  Divider,
  IconButton,
  Table,
  Sheet,
} from "@mui/joy";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DatabaseSync01Icon,
  UserCheck01Icon,
  UserRemove01Icon,
  SearchListIcon,
  CheckmarkSquare02Icon,
  UserGroup03Icon,
  RefreshIcon,
  Mail01Icon,
  VoiceIdIcon,
  Edit02Icon,
  Delete02Icon,
  PlusSignIcon,
  CalendarIcon,
  UserIcon,
  Cancel01Icon,
  CheckmarkCircleIcon,
} from "@hugeicons/core-free-icons";

interface ClickUpUser {
  clickupId: string;
  name: string;
  email: string;
  profilePicture: string;
  initials: string;
  timezone: string;
  color: string;
  role: string;
  lastActive: string;
  dateJoined: string;
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

interface UserRole {
  id: number;
  userId: string;
  typeId: number;
  brandId?: string | null;
  type: {
    id: number;
    name: string;
  };
  brand?: {
    id: string;
    name: string;
  } | null;
}

interface UserVacation {
  id: number;
  userId: string;
  startDate: string;
  endDate: string;
}

interface TaskType {
  id: number;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface DetailedUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roles: UserRole[];
  vacations: UserVacation[];
}

// ✅ Interface para exponer funciones al componente padre
export interface ClickUpUsersSyncRef {
  refresh: () => Promise<void>;
  debugClickUpData: () => Promise<void>;
}

export const ClickUpUsersSync = forwardRef<ClickUpUsersSyncRef>(
  (props, ref) => {
    // Estados principales
    const [clickupUsers, setClickupUsers] = useState<ClickUpUser[]>([]);

    // Estados de la UI
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [searchFilter, setSearchFilter] = useState("");
    const [showFilter, setShowFilter] = useState<
      "all" | "available" | "existing"
    >("all");

    // Estados del modal de edición
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<DetailedUser | null>(null);
    const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loadingUserDetails, setLoadingUserDetails] = useState(false);

    // Estados para nuevos roles y vacaciones
    const [newRole, setNewRole] = useState({ typeId: '', brandId: '' });
    const [newVacation, setNewVacation] = useState({ startDate: '', endDate: '' });

    // ✅ Función principal de fetch
    const fetchClickUpUsers = async () => {
      setLoading(true);
      try {
        console.log("🔄 Getting ClickUp users...");

        const response = await axios.get<SyncResponse>(
          "/api/sync/clickup-users"
        );

        setClickupUsers(response.data.clickupUsers);

        console.log("✅ Data loaded successfully");
        toast.success(
          `${response.data.statistics.totalClickUpUsers} users found in ClickUp`
        );
      } catch (error) {
        console.error("❌ Error getting users:", error);

        let errorMessage = "Unexpected error getting users";

        if (axios.isAxiosError(error)) {
          const apiError = error.response?.data?.error || error.message;
          const apiDetails = error.response?.data?.details;

          errorMessage = apiDetails ? `${apiError}: ${apiDetails}` : apiError;

          toast.error(`Error: ${apiError}`);
        } else {
          toast.error(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

    // Cargar tipos y brands para el modal
    const fetchModalData = async () => {
      try {
        const [typesRes, brandsRes] = await Promise.all([
          axios.get('/api/types'),
          axios.get('/api/brands')
        ]);
        setTaskTypes(typesRes.data);
        setBrands(brandsRes.data);
      } catch (error) {
        console.error('Error loading modal data:', error);
        toast.error('Error loading types and brands');
      }
    };

    // Cargar datos iniciales
    useEffect(() => {
      fetchClickUpUsers();
      fetchModalData();
    }, []);

    const handleUserSelection = (userId: string, checked: boolean) => {
      const newSelection = new Set(selectedUsers);

      if (checked) {
        newSelection.add(userId);
      } else {
        newSelection.delete(userId);
      }

      setSelectedUsers(newSelection);
      console.log(
        `${checked ? "Selected" : "Deselected"} user: ${userId}`
      );
    };

    const handleSelectAll = () => {
      const availableUsers = filteredUsers.filter((user) => user.canSync);
      const allSelected = availableUsers.every((user) =>
        selectedUsers.has(user.clickupId)
      );

      if (allSelected) {
        const newSelection = new Set(selectedUsers);
        availableUsers.forEach((user) => newSelection.delete(user.clickupId));
        setSelectedUsers(newSelection);
      } else {
        const newSelection = new Set(selectedUsers);
        availableUsers.forEach((user) => newSelection.add(user.clickupId));
        setSelectedUsers(newSelection);
      }
    };

    const syncSelectedUsers = async () => {
      if (selectedUsers.size === 0) {
        toast.warning("Select at least one user to sync");
        return;
      }

      setSyncing(true);

      try {
        const response = await axios.post("/api/sync/clickup-users", {
          userIds: Array.from(selectedUsers),
        });

        const { statistics, notFoundUsers, errors } = response.data;

        let successMessage = `${statistics.created} users synced successfully`;

        if (notFoundUsers && notFoundUsers.length > 0) {
          successMessage += ` (${notFoundUsers.length} not found in teams)`;
        }

        if (errors && errors.length > 0) {
          successMessage += ` (${errors.length} errors)`;
        }

        toast.success(successMessage);

        if (notFoundUsers && notFoundUsers.length > 0) {
          toast.warning(
            `Users not found in teams: ${notFoundUsers.join(", ")}`
          );
        }

        if (errors && errors.length > 0) {
          console.warn("Errors during sync:", errors);
          toast.warning(
            `Some users had errors. Check console for details.`
          );
        }

        setSelectedUsers(new Set());
        await fetchClickUpUsers();
      } catch (error) {
        console.error("❌ Sync error:", error);

        if (axios.isAxiosError(error)) {
          const message = error.response?.data?.error || error.message;
          toast.error(`Sync error: ${message}`);
        } else {
          toast.error("Unexpected error during sync");
        }
      } finally {
        setSyncing(false);
      }
    };

    // ✅ Función para abrir modal de edición
    const handleEditUser = async (userId: string) => {
      setLoadingUserDetails(true);
      setEditModalOpen(true);
      
      try {
        // Cargar detalles del usuario desde la DB
        const response = await axios.get(`/api/users/${userId}/details`);
        setEditingUser(response.data);
      } catch (error) {
        console.error('Error loading user details:', error);
        toast.error('Error loading user details');
        setEditModalOpen(false);
      } finally {
        setLoadingUserDetails(false);
      }
    };

    // ✅ Función para agregar rol
    const handleAddRole = async () => {
      if (!editingUser || !newRole.typeId) {
        toast.error('Please select a role type');
        return;
      }

      try {
        const payload = {
          userId: editingUser.id,
          typeId: parseInt(newRole.typeId),
          brandId: newRole.brandId || null
        };

        await axios.post('/api/users/roles', payload);
        
        // Recargar detalles del usuario
        const response = await axios.get(`/api/users/${editingUser.id}/details`);
        setEditingUser(response.data);
        setNewRole({ typeId: '', brandId: '' });
        
        toast.success('Role added successfully');
      } catch (error) {
        console.error('Error adding role:', error);
        toast.error('Error adding role');
      }
    };

    // ✅ Función para eliminar rol
    const handleDeleteRole = async (roleId: number) => {
      try {
        await axios.delete(`/api/users/roles/${roleId}`);
        
        // Recargar detalles del usuario
        if (editingUser) {
          const response = await axios.get(`/api/users/${editingUser.id}/details`);
          setEditingUser(response.data);
        }
        
        toast.success('Role removed successfully');
      } catch (error) {
        console.error('Error removing role:', error);
        toast.error('Error removing role');
      }
    };

    // ✅ Función para agregar vacaciones
    const handleAddVacation = async () => {
      if (!editingUser || !newVacation.startDate || !newVacation.endDate) {
        toast.error('Please select start and end dates');
        return;
      }

      try {
        const payload = {
          userId: editingUser.id,
          startDate: newVacation.startDate,
          endDate: newVacation.endDate
        };

        await axios.post('/api/users/vacations', payload);
        
        // Recargar detalles del usuario
        const response = await axios.get(`/api/users/${editingUser.id}/details`);
        setEditingUser(response.data);
        setNewVacation({ startDate: '', endDate: '' });
        
        toast.success('Vacation added successfully');
      } catch (error) {
        console.error('Error adding vacation:', error);
        toast.error('Error adding vacation');
      }
    };

    // ✅ Función para eliminar vacaciones
    const handleDeleteVacation = async (vacationId: number) => {
      try {
        await axios.delete(`/api/users/vacations/${vacationId}`);
        
        // Recargar detalles del usuario
        if (editingUser) {
          const response = await axios.get(`/api/users/${editingUser.id}/details`);
          setEditingUser(response.data);
        }
        
        toast.success('Vacation removed successfully');
      } catch (error) {
        console.error('Error removing vacation:', error);
        toast.error('Error removing vacation');
      }
    };

    // Filtrar usuarios basado en búsqueda y filtro
    const filteredUsers = clickupUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        user.email.toLowerCase().includes(searchFilter.toLowerCase());

      switch (showFilter) {
        case "available":
          return matchesSearch && user.canSync;
        case "existing":
          return matchesSearch && user.existsInLocal;
        default:
          return matchesSearch;
      }
    });

    const availableUsers = filteredUsers.filter((user) => user.canSync);
    const allAvailableSelected =
      availableUsers.length > 0 &&
      availableUsers.every((user) => selectedUsers.has(user.clickupId));

    return (
      <>
        <div className="sticky top-16 p-4 bg-background/70 backdrop-blur-lg z-50 border-b border-b-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="flex items-center gap-2 text-2xl font-medium">
                <HugeiconsIcon
                  icon={UserGroup03Icon}
                  size={32}
                  strokeWidth={1}
                />
                Designers
              </h1>

              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex-1 w-xs">
                  <Input
                    type="text"
                    placeholder="Search by Name or Email..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    size="sm"
                    fullWidth
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="soft"
                    size="sm"
                    startDecorator={
                      <HugeiconsIcon icon={CheckmarkSquare02Icon} size={16} />
                    }
                    onClick={handleSelectAll}
                    disabled={availableUsers.length === 0}
                  >
                    {allAvailableSelected ? "Deselect" : "Select"} Available
                  </Button>

                  <Button
                    variant="solid"
                    color="primary"
                    size="sm"
                    startDecorator={
                      <HugeiconsIcon icon={DatabaseSync01Icon} size={16} />
                    }
                    onClick={syncSelectedUsers}
                    disabled={selectedUsers.size === 0}
                    loading={syncing}
                  >
                    Sync ({selectedUsers.size})
                  </Button>
                </div>
              </div>
            </div>

            <Button
              size="sm"
              variant="soft"
              onClick={fetchClickUpUsers}
              disabled={loading}
              loading={loading}
              startDecorator={<HugeiconsIcon icon={RefreshIcon} size={16} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="p-6 flex-1">
          {loading && (
            <div className="h-full flex items-center justify-center relative max-w-5xl mx-auto">
              <div className="w-full">
                <div className="flex items-center gap-2 mb-4">
                  <HugeiconsIcon icon={SearchListIcon} size={24} />
                  <p>Getting ClickUp users...</p>
                </div>
                <LinearProgress />
              </div>
            </div>
          )}

          {!loading && (
            <ul className="grid [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] gap-4">
              {filteredUsers.map((user) => (
                <li
                  key={user.clickupId}
                  className={`p-8 rounded-lg flex flex-col items-center relative text-center gap-4 transition-all border-2 ${
                    user.existsInLocal
                      ? "bg-white/4 border-transparent"
                      : selectedUsers.has(user.clickupId)
                      ? "bg-accent/10 border-accent/30"
                      : "bg-accent/10 border-transparent hover:bg-accent/20"
                  }`}
                >
                  {!user.existsInLocal && (
                    <div className="absolute top-4 left-4 z-20">
                      <Checkbox
                        checked={selectedUsers.has(user.clickupId)}
                        onChange={(e) =>
                          handleUserSelection(user.clickupId, e.target.checked)
                        }
                      />
                    </div>
                  )}

                  {/* ✅ Botón de editar solo para usuarios existentes */}
                  {user.existsInLocal && (
                    <div className="absolute top-4 right-4 z-20">
                      <IconButton
                        size="sm"
                        variant="soft"
                        color="primary"
                        onClick={() => handleEditUser(user.clickupId)}
                      >
                        <HugeiconsIcon icon={Edit02Icon} size={16} />
                      </IconButton>
                    </div>
                  )}

                  <Avatar
                    src={user.profilePicture}
                    sx={{
                      width: 80,
                      height: 80,
                      bgcolor: user.color || "primary.500",
                      fontSize: "1.5rem",
                    }}
                  >
                    {user.initials}
                  </Avatar>
                  
                  <div className="flex-1">
                    <div>
                      <h3 className="font-semibold text-lg">{user.name}</h3>
                      {user.existsInLocal ? (
                        <div className="flex items-center gap-1 justify-center text-xs uppercase text-yellow-400">
                          <HugeiconsIcon icon={DatabaseSync01Icon} size={16} />
                          Database Synced
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-center text-xs uppercase text-green-400">
                          <HugeiconsIcon icon={UserCheck01Icon} size={16} />
                          Available
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-sm flex flex-col gap-1">
                    <div className="flex items-center gap-1 justify-center">
                      <HugeiconsIcon icon={Mail01Icon} size={16} />
                      {user.email}
                    </div>
                    <div className="flex items-center gap-1 justify-center">
                      <HugeiconsIcon icon={VoiceIdIcon} size={16} />
                      {user.clickupId}
                    </div>
                  </div>

                  {user.lastActive && (
                    <div className="text-sm text-gray-400">
                      Active:{" "}
                      {new Date(parseInt(user.lastActive)).toLocaleDateString()}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!loading && clickupUsers.length === 0 && (
            <div className="h-full flex items-center justify-center relative max-w-5xl mx-auto">
              <div className="w-full">
                <div className="flex items-center flex-col gap-4 mb-4">
                  <HugeiconsIcon icon={SearchListIcon} size={48} />
                  <div className="text-center">
                    <h3 className="text-2xl">No users found</h3>
                    <p className="text-gray-400">
                      Check ClickUp API configuration or try refreshing
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ✅ MODAL DE EDICIÓN DE USUARIO */}
        <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)}>
          <ModalDialog size="lg" sx={{ maxWidth: '800px', width: '90vw' }}>
            <DialogTitle>
              <HugeiconsIcon icon={UserIcon} size={24} />
              Edit User: {editingUser?.name}
            </DialogTitle>
            
            <DialogContent sx={{ overflow: 'auto', maxHeight: '80vh' }}>
              {loadingUserDetails ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <LinearProgress />
                </Box>
              ) : editingUser ? (
                <div className="space-y-6">
                  
                  {/* ✅ SECTION: User Roles */}
                  <div>
                    <Typography level="title-md" startDecorator={<HugeiconsIcon icon={UserIcon} size={20} />}>
                      User Roles
                    </Typography>
                    
                    {/* Current Roles */}
                    <Sheet variant="outlined" sx={{ borderRadius: 'md', mt: 2 }}>
                      <Table size="sm">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Brand</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editingUser.roles.map((role) => (
                            <tr key={role.id}>
                              <td>{role.type.name}</td>
                              <td>{role.brand?.name || 'Global'}</td>
                              <td>
                                <IconButton
                                  size="sm"
                                  color="danger"
                                  variant="soft"
                                  onClick={() => handleDeleteRole(role.id)}
                                >
                                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                                </IconButton>
                              </td>
                            </tr>
                          ))}
                          {editingUser.roles.length === 0 && (
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'center', padding: '1rem' }}>
                                No roles assigned
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </Sheet>

                    {/* Add New Role */}
                    <div className="flex gap-2 mt-3">
                      <FormControl sx={{ flex: 1 }}>
                        <FormLabel>Role Type</FormLabel>
                        <Select
                          value={newRole.typeId}
                          onChange={(_, value) => setNewRole({ ...newRole, typeId: value || '' })}
                          placeholder="Select role type"
                        >
                          {taskTypes.map((type) => (
                            <Option key={type.id} value={type.id.toString()}>
                              {type.name}
                            </Option>
                          ))}
                        </Select>
                      </FormControl>
                      
                      <FormControl sx={{ flex: 1 }}>
                        <FormLabel>Brand (Optional)</FormLabel>
                        <Select
                          value={newRole.brandId}
                          onChange={(_, value) => setNewRole({ ...newRole, brandId: value || '' })}
                          placeholder="Select brand (optional)"
                        >
                          <Option value="">Global (All brands)</Option>
                          {brands.map((brand) => (
                            <Option key={brand.id} value={brand.id}>
                              {brand.name}
                            </Option>
                          ))}
                        </Select>
                      </FormControl>
                      
                      <Button
                        variant="soft"
                        color="primary"
                        startDecorator={<HugeiconsIcon icon={PlusSignIcon} size={16} />}
                        onClick={handleAddRole}
                        sx={{ mt: 'auto' }}
                      >
                        Add Role
                      </Button>
                    </div>
                  </div>

                  <Divider />

                  {/* ✅ SECTION: Vacations */}
                  <div>
                    <Typography level="title-md" startDecorator={<HugeiconsIcon icon={CalendarIcon} size={20} />}>
                      Vacations
                    </Typography>
                    
                    {/* Current Vacations */}
                    <Sheet variant="outlined" sx={{ borderRadius: 'md', mt: 2 }}>
                      <Table size="sm">
                        <thead>
                          <tr>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Duration</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editingUser.vacations.map((vacation) => {
                            const startDate = new Date(vacation.startDate);
                            const endDate = new Date(vacation.endDate);
                            const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                            
                            return (
                              <tr key={vacation.id}>
                                <td>{startDate.toLocaleDateString()}</td>
                                <td>{endDate.toLocaleDateString()}</td>
                                <td>{durationDays} days</td>
                                <td>
                                  <IconButton
                                    size="sm"
                                    color="danger"
                                    variant="soft"
                                    onClick={() => handleDeleteVacation(vacation.id)}
                                  >
                                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                                  </IconButton>
                                </td>
                              </tr>
                            );
                          })}
                          {editingUser.vacations.length === 0 && (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', padding: '1rem' }}>
                                No vacations scheduled
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </Sheet>

                    {/* Add New Vacation */}
                    <div className="flex gap-2 mt-3">
                      <FormControl sx={{ flex: 1 }}>
                        <FormLabel>Start Date</FormLabel>
                        <Input
                          type="date"
                          value={newVacation.startDate}
                          onChange={(e) => setNewVacation({ ...newVacation, startDate: e.target.value })}
                        />
                      </FormControl>
                      
                      <FormControl sx={{ flex: 1 }}>
                        <FormLabel>End Date</FormLabel>
                        <Input
                          type="date"
                          value={newVacation.endDate}
                          onChange={(e) => setNewVacation({ ...newVacation, endDate: e.target.value })}
                        />
                      </FormControl>
                      
                      <Button
                        variant="soft"
                        color="success"
                        startDecorator={<HugeiconsIcon icon={PlusSignIcon} size={16} />}
                        onClick={handleAddVacation}
                        sx={{ mt: 'auto' }}
                      >
                        Add Vacation
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Typography>Error loading user details</Typography>
              )}
            </DialogContent>
            
            <DialogActions>
              <Button
                variant="plain"
                color="neutral"
                onClick={() => setEditModalOpen(false)}
                startDecorator={<HugeiconsIcon icon={Cancel01Icon} size={16} />}
              >
                Close
              </Button>
              <Button
                variant="solid"
                color="primary"
                onClick={() => {
                  setEditModalOpen(false);
                  toast.success('User updated successfully');
                }}
                startDecorator={<HugeiconsIcon icon={CheckmarkCircleIcon} size={16} />}
              >
                Save Changes
              </Button>
            </DialogActions>
          </ModalDialog>
        </Modal>
      </>
    );
  }
);

ClickUpUsersSync.displayName = "ClickUpUsersSync";
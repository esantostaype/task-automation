import { Priority, Status, Tier } from '@prisma/client'

export interface TaskType {
  id: number
  name: string
  categories: TaskCategory[]
}

export interface TaskCategory {
  id: number
  name: string
  typeId: number
  tierId: number
  type: TaskType
  tierList: {
    id: number
    name: Tier
    duration: number
  }
}

export interface Brand {
  id: string
  name: string
  isActive: boolean
  clickupListId?: string
  defaultStatus: Status
  statusMapping: Record<string, string> | null
}

export interface User {
  id: string
  name: string
  email: string
  active: boolean
  roles: UserRole[]
}

export interface UserRole {
  id: number
  userId: string
  typeId: number
  brandId?: string | null
}

export interface UserVacation {
  id: number
  userId: string
  startDate: Date
  endDate: Date
}

export interface VacationAwareUserSlot extends UserSlot {
  upcomingVacations: UserVacation[]
  potentialTaskStart: Date
  potentialTaskEnd: Date
  hasVacationConflict: boolean
  workingDaysUntilAvailable: number
  vacationConflictDetails?: {
    conflictingVacation: UserVacation
    daysSavedByWaiting: number
  }
}

export interface AssignmentCandidate {
  user: VacationAwareUserSlot
  type: 'specialist_eligible' | 'specialist_on_vacation' | 'generalist'
  priority: number
  workingDaysUntilStart: number
  reason: string
}

export interface Task {
  createdAt: string | number | Date
  id: string
  name: string
  description?: string
  typeId: number
  categoryId: number
  brandId: string
  priority: Priority
  status: Status
  startDate: Date
  deadline: Date
  customDuration: number
  url?: string
  lastSyncAt?: Date
  syncStatus: string
  category: TaskCategory
  type: TaskType
  brand: Brand
  assignees: TaskAssignment[]
}

export interface TaskAssignment {
  id: number
  userId: string
  taskId: string
  user: User
}

export interface TierInfo {
  id: number
  name: string
  duration: number
  categoryCount: number
  categories: Array<{
    id: number
    name: string
    typeName: string
  }>
}

export interface UserSlot {
  userId: string
  userName: string
  availableDate: Date
  tasks: Task[]
  cargaTotal: number
  isSpecialist: boolean
  lastTaskDeadline?: Date
  totalAssignedDurationDays: number 
}

export interface QueueCalculationResult {
  insertAt: number
  calculatedStartDate: Date
  affectedTasks: Task[]
}

export interface TaskCreationParams {
  name: string
  description?: string
  typeId: number
  categoryId: number
  priority: Priority
  brandId: string
  assignedUserIds?: string[]
  durationDays: number
}

export interface TaskTimingResult {
  startDate: Date
  deadline: Date
  insertAt: number
}

// Interfaz específica para ClickUp que garantiza statusMapping como Record<string, string>
export interface ClickUpBrand {
  teamId: string
  id: string
  name: string
  isActive: boolean
  clickupListId?: string
  defaultStatus: Status
}

export interface ClickUpTaskCreationParams {
  name: string
  description?: string
  priority: Priority
  deadline: Date
  startDate: Date
  usersToAssign: string[]
  category: TaskCategory
  brand: ClickUpBrand
}

export interface ClickUpTaskResponse {
  clickupTaskId: string
  clickupTaskUrl: string
}

export interface TaskFilters {
  brandId?: string
  status?: Status
  priority?: Priority
}

export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// Tipos para mapeo de ClickUp
export interface ClickUpStatusMapping {
  [localStatus: string]: string
}

export interface AssigneeDebugInfo {
  userId: string
  userName?: string
  clickupId?: string
  willBeAssigned: boolean
  reason: string
}

// Tipos de utilidad
export type TaskWithAssignees = Task & {
  assignees: (TaskAssignment & { user: User })[]
}

export type UserWithRoles = User & {
  roles: UserRole[]
}

export type CategoryWithType = TaskCategory & {
  type: TaskType
}

export interface UpdatedTask {
  id: string
  name: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high'
  assignedTo?: string
  dueDate?: string
  createdAt: string
  updatedAt: string
}

export interface ServerToClientEvents {
  connect: () => void
  disconnect: () => void
  task_update: (updatedTask: UpdatedTask) => void
}

export interface ClientToServerEvents {
  join_room: (roomId: string) => void
  leave_room: (roomId: string) => void
  update_task: (taskId: string, updates: Partial<UpdatedTask>) => void
}

export interface ExtendedFormValues extends FormValues {
  newCategoryTier: Tier | null
  isNewCategory: boolean
  newCategoryName: string
}

// También necesitamos actualizar FormValues para que sea más flexible
export interface FormValues {
  name: string
  description: string
  categoryId: string
  priority: string
  brandId: string
  assignedUserIds: string[]
  durationDays: string
}

// Nueva interfaz para el request de creación de categoría
export interface CreateCategoryRequest {
  name: string
  duration: number
  tier: Tier
  typeId: number
}

// Nueva interfaz para la respuesta de creación de categoría
export interface CreateCategoryResponse {
  id: number
  name: string
  duration: number
  tier: Tier
  typeId: number
  createdAt: string
  updatedAt: string
}

export interface SuggestedAssignment {
  userId: string
  durationDays: number
}

export interface TaskWhereInput {
  brandId?: string
  status?: Status
  priority?: Priority
}

// Enums específicos para la aplicación
export enum SyncStatus {
  SYNCED = 'SYNCED',
  PENDING = 'PENDING',
  ERROR = 'ERROR'
}

export enum SyncAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

export enum SyncLogStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
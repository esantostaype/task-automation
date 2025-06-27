export interface TaskType {
  id: number
  name: string
  categories: TaskCategory[]
}

export interface TaskCategory {
  id: number
  name: string
  duration: number
  tier: string
}

export interface Brand {
  id: string
  name: string
  isActive: boolean
  clickupListId?: string
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

export interface FormValues {
  name: string
  description: string
  categoryId: string
  priority: string
  brandId: string
  assignedUserIds: string[]
  durationDays: string
}

export interface SuggestedAssignment {
  userId: string
  durationDays: number
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
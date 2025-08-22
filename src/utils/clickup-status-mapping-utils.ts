// src/utils/clickup-status-mapping-utils.ts

export type LocalTaskStatus = 'TO_DO' | 'IN_PROGRESS' | 'ON_APPROVAL' | 'COMPLETE';

/**
 * Maps ClickUp status to our local 3-column system
 * @param clickupStatus - The status string from ClickUp
 * @returns Local status or null if task should be excluded (completed)
 */
export function mapClickUpStatusToLocal(clickupStatus: string): LocalTaskStatus | null {
  const statusLower = clickupStatus.toLowerCase().trim();
  
  console.log(`🔍 Mapping ClickUp status: "${clickupStatus}" -> "${statusLower}"`);
  
  // ✅ ON APPROVAL - Estados de revisión/aprobación (PRIMERO para evitar conflictos)
  if (statusLower === 'on approval' || 
      statusLower === 'approval' ||
      statusLower === 'pending approval' ||
      statusLower.includes('on approval') ||
      statusLower.includes('approval') ||
      statusLower.includes('review') ||
      statusLower.includes('pending review') ||
      statusLower.includes('qa') || 
      statusLower.includes('testing') ||
      statusLower.includes('check') ||
      statusLower.includes('waiting for approval') ||
      statusLower.includes('ready for review')) {
    console.log(`✅ Mapped to: ON_APPROVAL`);
    return 'ON_APPROVAL';
  }
  
  // IN PROGRESS - Estados de trabajo activo
  if (statusLower.includes('in progress') || statusLower.includes('in-progress') ||
      statusLower.includes('progress') || statusLower.includes('active') ||
      statusLower.includes('working') || statusLower.includes('development') ||
      statusLower.includes('doing') || statusLower === 'in progress') {
    console.log(`✅ Mapped to: IN_PROGRESS`);
    return 'IN_PROGRESS';
  }
  
  // TO DO - Estados iniciales
  if (statusLower.includes('to do') || statusLower.includes('todo') || 
      statusLower.includes('open') || statusLower.includes('backlog') ||
      statusLower.includes('new') || statusLower.includes('pending') ||
      statusLower.includes('ready') || statusLower === 'to do') {
    console.log(`✅ Mapped to: TO_DO`);
    return 'TO_DO';
  }
  
  // ✅ EXCLUDE completed tasks - return null
  if (statusLower.includes('done') || statusLower.includes('complete') ||
      statusLower.includes('finished') || statusLower.includes('closed') ||
      statusLower.includes('resolved') || statusLower.includes('delivered') ||
      statusLower.includes('merged') || statusLower.includes('deployed')) {
    console.log(`🚫 Task completed, excluding: ${clickupStatus}`);
    return null; // Exclude completed tasks
  }
  
  // Por defecto, estados desconocidos van a TO DO
  console.log(`⚠️ Unknown status "${clickupStatus}", defaulting to TO_DO`);
  return 'TO_DO';
}

/**
 * Maps ClickUp status to our local status, with guarantee of non-null result
 * Use this when you know the task is active and you need a guaranteed status
 * @param clickupStatus - The status string from ClickUp
 * @returns Local status (never null, defaults to TO_DO for unknown statuses)
 */
export function mapClickUpStatusToLocalSafe(clickupStatus: string): LocalTaskStatus {
  const mapped = mapClickUpStatusToLocal(clickupStatus);
  
  // If mapping returned null (completed task), this shouldn't happen in create context
  if (mapped === null) {
    console.warn(`⚠️ Received completed status "${clickupStatus}" in safe mapping, defaulting to TO_DO`);
    return 'TO_DO';
  }
  
  return mapped;
}
export function mapLocalStatusToColumn(localStatus: LocalTaskStatus): string | null {
  switch (localStatus) {
    case 'TO_DO':
      return 'TO DO';
    case 'IN_PROGRESS':
      return 'IN PROGRESS';
    case 'ON_APPROVAL':
      return 'ON APPROVAL';
    case 'COMPLETE':
      return null; // Don't show completed tasks
    default:
      return 'TO DO';
  }
}

/**
 * Checks if a ClickUp status represents an active (non-completed) task
 * @param clickupStatus - The status string from ClickUp
 * @returns true if task is active, false if completed
 */
export function isActiveTaskStatus(clickupStatus: string): boolean {
  const mapped = mapClickUpStatusToLocal(clickupStatus);
  return mapped !== null; // null means completed/excluded
}

/**
 * Gets all valid local statuses for filtering
 * @returns Array of valid local statuses
 */
export function getValidLocalStatuses(): LocalTaskStatus[] {
  return ['TO_DO', 'IN_PROGRESS', 'ON_APPROVAL'];
}

/**
 * Gets column order for display
 * @returns Array of column names in display order
 */
export function getColumnOrder(): string[] {
  return ['TO DO', 'IN PROGRESS', 'ON APPROVAL'];
}

// ✅ LEGACY SUPPORT: Keep existing function name for backwards compatibility
export { mapClickUpStatusToLocal as mapClickUpStatusToLocal_Original };

// ✅ PRIORITY MAPPING
export function mapClickUpPriority(clickupPriority?: string): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
  if (!clickupPriority) return 'NORMAL';
  
  const priorityMap: Record<string, 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'> = {
    'urgent': 'URGENT',
    'high': 'HIGH',
    'normal': 'NORMAL',
    'low': 'LOW'
  };
  
  return priorityMap[clickupPriority.toLowerCase()] || 'NORMAL';
}
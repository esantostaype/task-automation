import React from "react";
import { TaskCard } from "./TaskCard";
import { HugeiconsIcon } from "@hugeicons/react";
import { TaskIcon } from "@hugeicons/core-free-icons";
import { TaskCardSkeleton } from "./TaskCardSkeleton";

interface Task {
  clickupId: string;
  customId?: string | null;
  name: string;
  description: string;
  status: string;
  statusColor: string;
  priority: string;
  priorityColor: string;
  assignees: Array<{
    id: string;
    name: string;
    email: string;
    initials: string;
    color: string;
  }>;
  dueDate?: string | null;
  startDate?: string | null;
  timeEstimate?: number | null;
  tags: string[];
  list: {
    id: string;
    name: string;
  };
  space: {
    id: string;
    name: string;
  };
  url: string;
  existsInLocal: boolean;
  canSync: boolean;
  isCompleted?: boolean; // ✅ NUEVO: Para identificar tareas DONE
  dateClosed?: string | null; // ✅ NUEVO: Fecha de cierre
}

interface TasksListProps {
  tasks: Task[];
  selectedTasks: Set<string>;
  onTaskSelect: (taskId: string, selected: boolean) => void;
  onTaskEdit: (taskId: string) => void;
  loading?: boolean;
  filters?: {
    status?: string;
    priority?: string;
    space?: string;
    assignee?: string;
    syncStatus?: 'all' | 'synced' | 'available';
  };
}

export const TasksList: React.FC<TasksListProps> = ({
  tasks,
  selectedTasks,
  onTaskSelect,
  onTaskEdit,
  loading = false,
  filters = {},
}) => {
  // ✅ MEJORADO: Función para mapear status a columnas incluyendo DONE
  const mapStatusToColumn = (status: string): string => {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('to do') || statusLower.includes('todo') || 
        statusLower.includes('open') || statusLower.includes('backlog') ||
        statusLower.includes('new') || statusLower.includes('pending')) {
      return 'TO DO';
    }
    
    if (statusLower.includes('in progress') || statusLower.includes('in-progress') ||
        statusLower.includes('progress') || statusLower.includes('active') ||
        statusLower.includes('working') || statusLower.includes('development')) {
      return 'IN PROGRESS';
    }
    
    // ✅ NUEVO: Manejar estados de DONE/COMPLETE
    if (statusLower.includes('done') || statusLower.includes('complete') ||
        statusLower.includes('finished') || statusLower.includes('closed') ||
        statusLower.includes('resolved') || statusLower.includes('delivered') ||
        statusLower.includes('approved')) {
      return 'DONE';
    }
    
    // ✅ NUEVO: Manejar ON_APPROVAL como columna separada
    if (statusLower.includes('approval') || statusLower.includes('review') ||
        statusLower.includes('reviewing')) {
      return 'REVIEW';
    }
    
    // Por defecto, manejar otros status como TO DO
    return 'TO DO';
  };

  // ✅ MEJORADO: Función para ordenar tareas considerando fechas de cierre para DONE
  const sortTasksByDate = (tasks: Task[], column: string): Task[] => {
    return tasks.sort((a, b) => {
      // Para tareas DONE, ordenar por fecha de cierre (más recientes primero)
      if (column === 'DONE') {
        const aCloseDate = a.dateClosed ? new Date(a.dateClosed).getTime() : 0;
        const bCloseDate = b.dateClosed ? new Date(b.dateClosed).getTime() : 0;
        
        // Si ambas tienen fecha de cierre, ordenar por fecha (más recientes primero)
        if (aCloseDate && bCloseDate) {
          return bCloseDate - aCloseDate;
        }
        
        // Las que tienen fecha de cierre van primero
        if (aCloseDate && !bCloseDate) return -1;
        if (!aCloseDate && bCloseDate) return 1;
        
        // Si ninguna tiene fecha de cierre, usar fecha de vencimiento
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      }
      
      // Para otras columnas, ordenar por fecha de vencimiento (más próximas primero)
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  };

  // Renderizar skeletons durante la carga
  if (loading) {
    // ✅ ACTUALIZADO: Incluir columna DONE en el skeleton
    const columnOrder = ['TO DO', 'IN PROGRESS', 'REVIEW', 'DONE'];
    
    return (
      <div className="space-y-6">
        <div className="flex align-baseline gap-6 h-[calc(100dvh-11.375rem)]">
          {columnOrder.map((column) => (
            <div key={column} className="flex flex-[0_0_360px] flex-col overflow-y-auto relative pr-2">
              {/* Column Header */}
              <div className="sticky top-0 pb-2 bg-background flex items-center justify-between z-20">
                <h2 className="font-semibold text-lg">{column}</h2>
                <div className="bg-accent/20 text-accent text-xs size-6 rounded-full animate-pulse">
                </div>
              </div>
              
              {/* Skeleton Tasks */}
              <div className="flex-1 space-y-4">
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Filtrar tareas según los filtros aplicados
  const filteredTasks = tasks.filter(task => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.space && task.space.id !== filters.space) return false;
    if (filters.assignee && !task.assignees.some(a => a.id === filters.assignee)) return false;
    if (filters.syncStatus) {
      if (filters.syncStatus === 'synced' && !task.existsInLocal) return false;
      if (filters.syncStatus === 'available' && task.existsInLocal) return false;
    }
    return true;
  });

  // Agrupar tareas por columnas
  const groupedTasks = filteredTasks.reduce((acc, task) => {
    const column = mapStatusToColumn(task.status);
    if (!acc[column]) {
      acc[column] = [];
    }
    acc[column].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Ordenar tareas dentro de cada columna
  Object.keys(groupedTasks).forEach(column => {
    groupedTasks[column] = sortTasksByDate(groupedTasks[column], column);
  });

  // ✅ ACTUALIZADO: Definir el orden de las columnas incluyendo DONE
  const columnOrder = ['TO DO', 'IN PROGRESS', 'REVIEW', 'DONE'];
  const orderedColumns = columnOrder.filter(column => groupedTasks[column]?.length > 0);

  // ✅ MEJORADO: Función para obtener color de la columna
  const getColumnColor = (column: string): string => {
    switch (column) {
      case 'TO DO':
        return 'text-gray-400';
      case 'IN PROGRESS':
        return 'text-blue-400';
      case 'REVIEW':
        return 'text-yellow-400';
      case 'DONE':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  // ✅ MEJORADO: Función para obtener icono de la columna
  const getColumnIcon = (column: string): string => {
    switch (column) {
      case 'TO DO':
        return '📋';
      case 'IN PROGRESS':
        return '⚡';
      case 'REVIEW':
        return '👀';
      case 'DONE':
        return '✅';
      default:
        return '📋';
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <HugeiconsIcon
            icon={TaskIcon}
            size={48}
            className="mx-auto mb-4 text-gray-400"
          />
          <h3 className="text-2xl font-medium mb-2">No tasks found</h3>
          <p className="text-gray-400">
            Check ClickUp API configuration or try refreshing
          </p>
        </div>
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <HugeiconsIcon
            icon={TaskIcon}
            size={48}
            className="mx-auto mb-4 text-gray-400"
          />
          <h3 className="text-2xl font-medium mb-2">No tasks match your filters</h3>
          <p className="text-gray-400">
            Try adjusting your search criteria
          </p>
        </div>
      </div>
    );
  }

  // Si no hay columnas ordenadas, mostrar todas las columnas con placeholders
  const displayColumns = orderedColumns.length > 0 ? orderedColumns : columnOrder;

  return (
    <div className="space-y-6">
      {/* ✅ MEJORADO: Estadísticas de tareas incluyendo DONE */}
      <div className="flex gap-4 text-sm text-gray-400 bg-background/50 p-3 rounded-lg">
        <span>📊 Total: {filteredTasks.length}</span>
        <span>📋 To Do: {groupedTasks['TO DO']?.length || 0}</span>
        <span>⚡ In Progress: {groupedTasks['IN PROGRESS']?.length || 0}</span>
        <span>👀 Review: {groupedTasks['REVIEW']?.length || 0}</span>
        <span>✅ Done: {groupedTasks['DONE']?.length || 0}</span>
      </div>

      {/* Kanban Board */}
      <div className="flex align-baseline gap-6 h-[calc(100dvh-11.375rem)]">
        {displayColumns.map((column) => (
          <div key={column} className="flex flex-[0_0_360px] flex-col overflow-y-auto relative pr-2">
            {/* ✅ MEJORADO: Column Header con iconos y colores */}
            <div className="sticky top-0 pb-2 bg-background flex items-center justify-between z-20">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getColumnIcon(column)}</span>
                <h2 className={`font-semibold text-lg ${getColumnColor(column)}`}>
                  {column}
                </h2>
              </div>
              <span className={`${
                column === 'DONE' ? 'bg-green-500/20 text-green-400' : 
                column === 'REVIEW' ? 'bg-yellow-500/20 text-yellow-400' :
                column === 'IN PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                'bg-accent/20 text-accent'
              } text-xs px-2 py-1 rounded-full`}>
                {groupedTasks[column]?.length || 0}
              </span>
            </div>
            
            {/* Tasks Column */}
            <div className="flex-1 space-y-4">
              {groupedTasks[column]?.map((task) => (
                <TaskCard
                  key={task.clickupId}
                  task={task}
                  isSelected={selectedTasks.has(task.clickupId)}
                  onSelect={(selected: boolean) => onTaskSelect(task.clickupId, selected)}
                  onEdit={() => onTaskEdit(task.clickupId)}
                  showSelection={!task.existsInLocal}
                />
              )) || (
                // ✅ MEJORADO: Mensaje específico por columna
                <div className="text-center text-gray-500 text-sm py-8">
                  {column === 'DONE' ? 
                    'No completed tasks' : 
                    column === 'REVIEW' ? 
                    'No tasks under review' :
                    `No ${column.toLowerCase()} tasks`
                  }
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ✅ MEJORADO: Summary con información de tareas DONE */}
      {filteredTasks.length !== tasks.length && (
        <div className="text-center text-sm text-gray-500 pt-4 border-t border-white/10">
          <div className="flex justify-center gap-6">
            <span>Showing {filteredTasks.length} of {tasks.length} tasks</span>
            {groupedTasks['DONE']?.length > 0 && (
              <span className="text-green-400">
                ✅ {groupedTasks['DONE'].length} completed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
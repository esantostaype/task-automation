import React from "react";
import { TaskCard } from "./TaskCard";
import { HugeiconsIcon } from "@hugeicons/react";
import { TaskIcon } from "@hugeicons/core-free-icons";
import { LinearProgress } from "@mui/joy";

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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center relative max-w-7xl mx-auto">
        <div className="w-full">
          <div className="flex items-center gap-2 mb-4">
            <HugeiconsIcon icon={TaskIcon} size={24} />
            <p>Getting ClickUp tasks...</p>
          </div>
          <LinearProgress />
        </div>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Tasks Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.clickupId}
            task={task}
            isSelected={selectedTasks.has(task.clickupId)}
            onSelect={(selected: boolean) => onTaskSelect(task.clickupId, selected)}
            onEdit={() => onTaskEdit(task.clickupId)}
            showSelection={!task.existsInLocal}
          />
        ))}
      </div>

      {/* Summary */}
      {filteredTasks.length !== tasks.length && (
        <div className="text-center text-sm text-gray-500 pt-4 border-t border-white/10">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </div>
      )}
    </div>
  );
};
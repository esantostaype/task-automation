import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  Time04Icon,
  UserIcon,
  Edit02Icon,
  DatabaseSync01Icon,
  CheckmarkSquare02Icon,
  TagIcon,
} from "@hugeicons/core-free-icons";
import { Avatar, Checkbox, IconButton, Chip } from "@mui/joy";

interface TaskCardProps {
  task: {
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
  };
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onEdit?: () => void;
  showSelection?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isSelected = false,
  onSelect,
  onEdit,
  showSelection = true,
}) => {
  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} days overdue`, color: 'text-red-400' };
    } else if (diffDays === 0) {
      return { text: 'Due today', color: 'text-orange-400' };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', color: 'text-yellow-400' };
    } else {
      return { text: `Due in ${diffDays} days`, color: 'text-gray-400' };
    }
  };

  const formatTimeEstimate = (timeMs: number) => {
    const hours = Math.round(timeMs / 3600000 * 10) / 10; // Convert ms to hours, round to 1 decimal
    return hours >= 1 ? `${hours}h` : `${Math.round(timeMs / 60000)}m`;
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
      case 'urgent':
        return '🔥';
      case 'medium':
      case 'normal':
        return '⚡';
      case 'low':
        return '📋';
      default:
        return '📋';
    }
  };

  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;

  return (
    <div
      className={`
      p-6 rounded-lg flex flex-col relative gap-4 
      transition-all border-2 min-h-[300px]
      ${
        task.existsInLocal
          ? "bg-white/4 border-transparent"
          : isSelected
          ? "bg-accent/10 border-accent/30"
          : "bg-accent/10 border-transparent hover:bg-accent/20"
      }
    `}
    >
      {/* Selection checkbox */}
      {showSelection && !task.existsInLocal && onSelect && (
        <div className="absolute top-4 left-4 z-20">
          <Checkbox
            checked={isSelected}
            onChange={(event) => onSelect(event.target.checked)}
          />
        </div>
      )}

      {/* Edit button for existing tasks */}
      {task.existsInLocal && onEdit && (
        <div className="absolute top-4 right-4 z-20">
          <IconButton size="sm" variant="soft" color="primary" onClick={onEdit}>
            <HugeiconsIcon icon={Edit02Icon} size={16} />
          </IconButton>
        </div>
      )}

      {/* Status and Priority Header */}
      <div className="flex items-center justify-between mt-6">
        <Chip
          size="sm"
          variant="soft"
          sx={{ 
            bgcolor: `${task.statusColor}20`,
            color: task.statusColor,
            borderColor: task.statusColor
          }}
        >
          {task.status}
        </Chip>
        
        <div className="flex items-center gap-1 text-sm">
          <span>{getPriorityIcon(task.priority)}</span>
          <span style={{ color: task.priorityColor }}>{task.priority}</span>
        </div>
      </div>

      {/* Task Info */}
      <div className="flex-1">
        <div className="mb-2">
          <h3 className="font-semibold text-lg leading-tight mb-1 line-clamp-2">
            {task.name}
          </h3>
          {task.customId && (
            <span className="text-xs text-gray-500">#{task.customId}</span>
          )}
        </div>

        {task.description && (
          <p className="text-sm text-gray-400 line-clamp-3 mb-3">
            {task.description}
          </p>
        )}

        {/* Sync Status */}
        <div className="mb-3">
          {task.existsInLocal ? (
            <div className="flex items-center gap-1 text-xs uppercase text-yellow-400">
              <HugeiconsIcon icon={DatabaseSync01Icon} size={16} />
              Synced
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs uppercase text-green-400">
              <HugeiconsIcon icon={CheckmarkSquare02Icon} size={16} />
              Available
            </div>
          )}
        </div>
      </div>

      {/* Assignees */}
      {task.assignees.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <HugeiconsIcon icon={UserIcon} size={16} className="text-gray-400" />
          <div className="flex -space-x-2">
            {task.assignees.slice(0, 3).map((assignee, index) => (
              <Avatar
                key={assignee.id}
                size="sm"
                sx={{
                  width: 24,
                  height: 24,
                  bgcolor: assignee.color,
                  fontSize: "0.7rem",
                  border: '2px solid var(--joy-palette-background-level1)',
                  zIndex: task.assignees.length - index
                }}
                title={`${assignee.name} (${assignee.email})`}
              >
                {assignee.initials}
              </Avatar>
            ))}
            {task.assignees.length > 3 && (
              <div className="flex items-center justify-center w-6 h-6 bg-gray-600 rounded-full text-xs text-white border-2 border-gray-700">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Details */}
      <div className="space-y-2 text-sm">
        {/* Due Date */}
        {dueInfo && (
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-gray-400" />
            <span className={dueInfo.color}>{dueInfo.text}</span>
          </div>
        )}

        {/* Time Estimate */}
        {task.timeEstimate && (
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Time04Icon} size={16} className="text-gray-400" />
            <span className="text-gray-400">{formatTimeEstimate(task.timeEstimate)}</span>
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={TagIcon} size={16} className="text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {task.tags.slice(0, 2).map((tag, index) => (
                <Chip
                  key={index}
                  size="sm"
                  variant="outlined"
                  className="text-xs"
                >
                  {tag}
                </Chip>
              ))}
              {task.tags.length > 2 && (
                <span className="text-xs text-gray-500">+{task.tags.length - 2}</span>
              )}
            </div>
          </div>
        )}

        {/* Space and List */}
        <div className="text-xs text-gray-500 pt-2 border-t border-white/10">
          <div>{task.space.name} → {task.list.name}</div>
        </div>
      </div>
    </div>
  );
};
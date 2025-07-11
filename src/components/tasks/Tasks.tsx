/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Select,
  Option,
  FormLabel,
  Alert,
  LinearProgress,
  Checkbox,
  FormControl,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/joy";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  RefreshIcon,
  DatabaseSync01Icon,
  TaskIcon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import { TasksList } from "./TaskList";
import { useTaskDataInvalidation } from "@/hooks/useTaskData";
import axios from "axios";
import { toast } from "react-toastify";

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

interface Category {
  id: number;
  name: string;
  type: {
    name: string;
  };
  tierList: {
    name: string;
  };
}

interface Brand {
  id: string;
  name: string;
  isActive: boolean;
}

interface SyncStatistics {
  totalClickUpTasks: number;
  existingInLocal: number;
  availableToSync: number;
  totalLocalTasks: number;
}

export const TasksSync: React.FC = () => {
  const { invalidateAll } = useTaskDataInvalidation();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [statistics, setStatistics] = useState<SyncStatistics | null>(null);
  
  // Filtros
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    space: '',
    assignee: '',
    syncStatus: 'all' as 'all' | 'synced' | 'available',
    search: ''
  });

  // Cargar datos iniciales
  useEffect(() => {
    loadTasksAndCategories();
  }, []);

  const loadTasksAndCategories = async () => {
    try {
      setLoading(true);
      const [tasksRes, categoriesRes, brandsRes] = await Promise.all([
        axios.get("/api/sync/clickup-tasks"),
        axios.get("/api/categories"),
        axios.get("/api/brands") // Asumiendo que tienes este endpoint
      ]);
      
      setTasks(tasksRes.data.clickupTasks || []);
      setCategories(categoriesRes.data || []);
      setBrands(brandsRes.data?.filter((b: Brand) => b.isActive) || []);
      setStatistics(tasksRes.data.statistics);
      
      console.log(`✅ Cargadas ${tasksRes.data.clickupTasks?.length || 0} tareas de ClickUp`);
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Error loading tasks from ClickUp");
    } finally {
      setLoading(false);
    }
  };

  const refreshTasks = async () => {
    try {
      setRefreshing(true);
      await loadTasksAndCategories();
      toast.success("Tasks refreshed successfully");
    } catch (error) {
      toast.error("Error refreshing tasks");
    } finally {
      setRefreshing(false);
    }
  };

  const handleTaskSelect = (taskId: string, selected: boolean) => {
    const newSelection = new Set(selectedTasks);
    if (selected) {
      newSelection.add(taskId);
    } else {
      newSelection.delete(taskId);
    }
    setSelectedTasks(newSelection);
  };

  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      const availableTasks = filteredTasks.filter(task => task.canSync);
      setSelectedTasks(new Set(availableTasks.map(task => task.clickupId)));
    } else {
      setSelectedTasks(new Set());
    }
  };

  const handleSyncSelected = async () => {
    if (selectedTasks.size === 0) {
      toast.warning("Please select tasks to sync");
      return;
    }

    if (!selectedBrand) {
      toast.warning("Please select a brand for the tasks");
      return;
    }

    try {
      setSyncing(true);
      
      const response = await axios.post("/api/sync/clickup-tasks", {
        taskIds: Array.from(selectedTasks),
        categoryId: selectedCategory,
        brandId: selectedBrand
      });

      // Actualizar estado local
      setTasks(prev => 
        prev.map(task => 
          selectedTasks.has(task.clickupId) 
            ? { ...task, existsInLocal: true, canSync: false }
            : task
        )
      );

      setSelectedTasks(new Set());
      invalidateAll();
      
      toast.success(`${response.data.createdTasks?.length || 0} tasks synced successfully`);
      
      if (response.data.errors?.length > 0) {
        console.warn("Sync errors:", response.data.errors);
      }
      
    } catch (error: any) {
      console.error("Error syncing tasks:", error);
      const errorMessage = error.response?.data?.error || "Error syncing tasks";
      toast.error(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  const handleTaskEdit = (taskId: string) => {
    const task = tasks.find(t => t.clickupId === taskId);
    if (task?.url) {
      window.open(task.url, '_blank');
    }
  };

  // Filtrar tareas
  const filteredTasks = tasks.filter(task => {
    // Filtro de búsqueda
    if (filters.search && !task.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    
    // Otros filtros
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.space && task.space.id !== filters.space) return false;
    if (filters.assignee && !task.assignees.some(a => a.id === filters.assignee)) return false;
    if (filters.syncStatus === 'synced' && !task.existsInLocal) return false;
    if (filters.syncStatus === 'available' && task.existsInLocal) return false;
    
    return true;
  });

  // Extraer valores únicos para filtros
  const uniqueStatuses = [...new Set(tasks.map(t => t.status))];
  const uniquePriorities = [...new Set(tasks.map(t => t.priority))];
  const uniqueSpaces = [...new Set(tasks.map(t => ({ id: t.space.id, name: t.space.name })))];

  const availableTasksCount = filteredTasks.filter(t => t.canSync).length;
  const selectedAvailableCount = Array.from(selectedTasks).filter(id => 
    filteredTasks.find(t => t.clickupId === id)?.canSync
  ).length;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={TaskIcon} size={28} className="text-accent" />
          <div>
            <h1 className="text-2xl font-semibold">ClickUp Tasks Sync</h1>
            <p className="text-sm text-gray-400">
              Sync tasks from ClickUp to your local database
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip title="Refresh tasks from ClickUp">
            <IconButton
              size="lg"
              variant="soft"
              onClick={refreshTasks}
              loading={refreshing}
            >
              <HugeiconsIcon icon={RefreshIcon} size={20} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/5 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">{statistics.totalClickUpTasks}</div>
            <div className="text-sm text-gray-400">Total in ClickUp</div>
          </div>
          <div className="bg-white/5 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{statistics.existingInLocal}</div>
            <div className="text-sm text-gray-400">Already Synced</div>
          </div>
          <div className="bg-white/5 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{statistics.availableToSync}</div>
            <div className="text-sm text-gray-400">Available to Sync</div>
          </div>
          <div className="bg-white/5 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-400">{statistics.totalLocalTasks}</div>
            <div className="text-sm text-gray-400">Total in Local DB</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white/5 p-4 rounded-lg space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <HugeiconsIcon icon={FilterIcon} size={20} />
          <span className="font-medium">Filters</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <FormControl>
            <FormLabel>Search</FormLabel>
            <Input
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              size="sm"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Status</FormLabel>
            <Select
              placeholder="Any status"
              value={filters.status}
              onChange={(_, value) => setFilters(prev => ({ ...prev, status: value || '' }))}
              size="sm"
            >
              <Option value="">Any status</Option>
              {uniqueStatuses.map(status => (
                <Option key={status} value={status}>{status}</Option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Priority</FormLabel>
            <Select
              placeholder="Any priority"
              value={filters.priority}
              onChange={(_, value) => setFilters(prev => ({ ...prev, priority: value || '' }))}
              size="sm"
            >
              <Option value="">Any priority</Option>
              {uniquePriorities.map(priority => (
                <Option key={priority} value={priority}>{priority}</Option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Space</FormLabel>
            <Select
              placeholder="Any space"
              value={filters.space}
              onChange={(_, value) => setFilters(prev => ({ ...prev, space: value || '' }))}
              size="sm"
            >
              <Option value="">Any space</Option>
              {uniqueSpaces.map(space => (
                <Option key={space.id} value={space.id}>{space.name}</Option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Sync Status</FormLabel>
            <Select
              value={filters.syncStatus}
              onChange={(_, value) => setFilters(prev => ({ ...prev, syncStatus: value || 'all' }))}
              size="sm"
            >
              <Option value="all">All tasks</Option>
              <Option value="available">Available to sync</Option>
              <Option value="synced">Already synced</Option>
            </Select>
          </FormControl>
        </div>
      </div>

      {/* Sync Controls */}
      {availableTasksCount > 0 && (
        <div className="bg-accent/10 p-4 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectedAvailableCount === availableTasksCount && availableTasksCount > 0}
                indeterminate={selectedAvailableCount > 0 && selectedAvailableCount < availableTasksCount}
                onChange={(e) => handleSelectAll(e.target.checked)}
                label="Select all available tasks"
              />
              
              {selectedTasks.size > 0 && (
                <Chip variant="soft" color="primary">
                  {selectedTasks.size} selected
                </Chip>
              )}
            </div>
          </div>

          {selectedTasks.size > 0 && (
            <div className="flex items-center gap-4">
              <FormControl className="flex-1 max-w-xs">
                <FormLabel>Select Brand (Required)</FormLabel>
                <Select
                  placeholder="Select brand..."
                  value={selectedBrand}
                  onChange={(_, value) => setSelectedBrand(value)}
                  required
                >
                  {brands.map(brand => (
                    <Option key={brand.id} value={brand.id}>
                      {brand.name}
                    </Option>
                  ))}
                </Select>
              </FormControl>

              <FormControl className="flex-1 max-w-xs">
                <FormLabel>Assign to Category (Optional)</FormLabel>
                <Select
                  placeholder="Select category..."
                  value={selectedCategory}
                  onChange={(_, value) => setSelectedCategory(value)}
                >
                  {categories.map(category => (
                    <Option key={category.id} value={category.id}>
                      {category.name} ({category.type.name} - Tier {category.tierList.name})
                    </Option>
                  ))}
                </Select>
              </FormControl>

              <Button
                startDecorator={<HugeiconsIcon icon={DatabaseSync01Icon} size={16} />}
                onClick={handleSyncSelected}
                disabled={!selectedBrand || selectedTasks.size === 0}
                loading={syncing}
                color="primary"
                size="lg"
              >
                Sync {selectedTasks.size} Task{selectedTasks.size === 1 ? '' : 's'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tasks List */}
      <TasksList
        tasks={filteredTasks}
        selectedTasks={selectedTasks}
        onTaskSelect={handleTaskSelect}
        onTaskEdit={handleTaskEdit}
        loading={loading}
        filters={filters}
      />
    </div>
  );
};
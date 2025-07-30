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
  SearchListIcon,
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
    status: "",
    priority: "",
    space: "",
    assignee: "",
    syncStatus: "all" as "all" | "synced" | "available",
    search: "",
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
        axios.get("/api/brands"), // Asumiendo que tienes este endpoint
      ]);

      setTasks(tasksRes.data.clickupTasks || []);
      setCategories(categoriesRes.data || []);
      setBrands(brandsRes.data?.filter((b: Brand) => b.isActive) || []);
      setStatistics(tasksRes.data.statistics);

      console.log(
        `✅ Cargadas ${
          tasksRes.data.clickupTasks?.length || 0
        } tareas de ClickUp`
      );
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
      const availableTasks = filteredTasks.filter((task) => task.canSync);
      setSelectedTasks(new Set(availableTasks.map((task) => task.clickupId)));
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
        brandId: selectedBrand,
      });

      // Actualizar estado local
      setTasks((prev) =>
        prev.map((task) =>
          selectedTasks.has(task.clickupId)
            ? { ...task, existsInLocal: true, canSync: false }
            : task
        )
      );

      setSelectedTasks(new Set());
      invalidateAll();

      toast.success(
        `${response.data.createdTasks?.length || 0} tasks synced successfully`
      );

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
    const task = tasks.find((t) => t.clickupId === taskId);
    if (task?.url) {
      window.open(task.url, "_blank");
    }
  };

  // Filtrar tareas
  const filteredTasks = tasks.filter((task) => {
    // Filtro de búsqueda
    if (
      filters.search &&
      !task.name.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }

    // Otros filtros
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.space && task.space.id !== filters.space) return false;
    if (
      filters.assignee &&
      !task.assignees.some((a) => a.id === filters.assignee)
    )
      return false;
    if (filters.syncStatus === "synced" && !task.existsInLocal) return false;
    if (filters.syncStatus === "available" && task.existsInLocal) return false;

    return true;
  });

  // Extraer valores únicos para filtros
  const uniqueStatuses = [...new Set(tasks.map((t) => t.status))];
  const uniquePriorities = [...new Set(tasks.map((t) => t.priority))];
  const uniqueSpaces = [
    ...new Set(tasks.map((t) => ({ id: t.space.id, name: t.space.name }))),
  ];

  const availableTasksCount = filteredTasks.filter((t) => t.canSync).length;
  const selectedAvailableCount = Array.from(selectedTasks).filter(
    (id) => filteredTasks.find((t) => t.clickupId === id)?.canSync
  ).length;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-16 bg-background/70 backdrop-blur-lg z-50">
        <div className="p-4 flex items-center justify-between border-b border-b-white/10">
          <h1 className="flex items-center gap-2 text-2xl font-medium">
            <HugeiconsIcon icon={TaskIcon} size={32} strokeWidth={1} />
            ClickUp Tasks Sync
          </h1>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={
                  selectedAvailableCount === availableTasksCount &&
                  availableTasksCount > 0
                }
                indeterminate={
                  selectedAvailableCount > 0 &&
                  selectedAvailableCount < availableTasksCount
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                label="Select Available"
                size="sm"
                sx={{ alignItems: "center" }}
              />
            </div>
            <FormControl className="flex-1 max-w-xs">
              <Select
                placeholder="Select brand..."
                value={selectedBrand}
                onChange={(_, value) => setSelectedBrand(value)}
                required
                size="sm"
                sx={{ width: 200 }}
              >
                <Option value={null}>Select Brand</Option>
                {brands.map((brand) => (
                  <Option key={brand.id} value={brand.id}>
                    {brand.name}
                  </Option>
                ))}
              </Select>
            </FormControl>

            <FormControl className="flex-1 max-w-xs">
              <Select
                placeholder="Select category..."
                value={selectedCategory}
                onChange={(_, value) => setSelectedCategory(value)}
                size="sm"
                sx={{ width: 200 }}
              >
                <Option value={null}>Select Category</Option>
                {categories.map((category) => (
                  <Option key={category.id} value={category.id}>
                    {category.name} ({category.type.name} - Tier{" "}
                    {category.tierList.name})
                  </Option>
                ))}
              </Select>
            </FormControl>

            <Button
              startDecorator={
                <HugeiconsIcon icon={DatabaseSync01Icon} size={16} />
              }
              onClick={handleSyncSelected}
              disabled={!selectedBrand || selectedTasks.size === 0}
              loading={syncing}
              color="primary"
              size="sm"
            >
              Sync ({selectedTasks.size})
            </Button>
            <Tooltip title="Refresh tasks from ClickUp">
              <IconButton
                size="sm"
                variant="soft"
                onClick={refreshTasks}
                loading={refreshing}
              >
                <HugeiconsIcon icon={RefreshIcon} size={16} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
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
    </div>
  );
};

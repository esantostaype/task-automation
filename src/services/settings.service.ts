/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/settings.service.ts

import { prisma } from '@/utils/prisma';
import { getFromCache, setInCache, invalidateCacheByPrefix } from '@/utils/cache';

interface SettingDefinition {
  category: string;
  key: string;
  value: any;
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  label: string;
  description?: string;
  group: string;
  order: number;
  minValue?: number;
  maxValue?: number;
  options?: any[];
  required: boolean;
}

// ✅ CONFIGURACIONES POR DEFECTO - Todo lo que estaba hardcodeado
export const DEFAULT_SETTINGS: SettingDefinition[] = [
  // 🕐 HORARIOS DE TRABAJO
  {
    category: 'work_hours',
    key: 'start',
    value: 15, // 10 AM Perú (UTC-5)
    dataType: 'number',
    label: 'Work Start Hour (UTC)',
    description: 'Hour when work day starts (in UTC)',
    group: 'work_schedule',
    order: 1,
    minValue: 0,
    maxValue: 23,
    required: true
  },
  {
    category: 'work_hours',
    key: 'lunch_start',
    value: 19, // 2 PM Perú
    dataType: 'number',
    label: 'Lunch Start Hour (UTC)',
    description: 'Hour when lunch break starts (in UTC)',
    group: 'work_schedule',
    order: 2,
    minValue: 0,
    maxValue: 23,
    required: true
  },
  {
    category: 'work_hours',
    key: 'lunch_end',
    value: 20, // 3 PM Perú
    dataType: 'number',
    label: 'Lunch End Hour (UTC)',
    description: 'Hour when lunch break ends (in UTC)',
    group: 'work_schedule',
    order: 3,
    minValue: 0,
    maxValue: 23,
    required: true
  },
  {
    category: 'work_hours',
    key: 'end',
    value: 24, // 7 PM Perú
    dataType: 'number',
    label: 'Work End Hour (UTC)',
    description: 'Hour when work day ends (in UTC)',
    group: 'work_schedule',
    order: 4,
    minValue: 0,
    maxValue: 23,
    required: true
  },

  // 📊 UMBRALES DE ASIGNACIÓN
  {
    category: 'task_assignment',
    key: 'deadline_difference_to_force_generalist',
    value: 10,
    dataType: 'number',
    label: 'Days Difference to Force Generalist',
    description: 'Days difference in workload to assign to generalist instead of specialist',
    group: 'task_assignment',
    order: 1,
    minValue: 1,
    maxValue: 30,
    required: true
  },
  {
    category: 'task_assignment',
    key: 'normal_tasks_before_low_threshold',
    value: 5,
    dataType: 'number',
    label: 'Normal Tasks Before Low Priority',
    description: 'Maximum normal priority tasks allowed before a low priority task',
    group: 'task_assignment',
    order: 2,
    minValue: 1,
    maxValue: 20,
    required: true
  },
  {
    category: 'task_assignment',
    key: 'consecutive_low_tasks_threshold',
    value: 4,
    dataType: 'number',
    label: 'Consecutive Low Priority Tasks Limit',
    description: 'Maximum consecutive low priority tasks allowed',
    group: 'task_assignment',
    order: 3,
    minValue: 1,
    maxValue: 10,
    required: true
  },

  // ⚡ DURACIONES POR TIER
  {
    category: 'tier_durations',
    key: 'S',
    value: 30,
    dataType: 'number',
    label: 'Tier S Duration (days)',
    description: 'Default duration in days for Tier S tasks',
    group: 'tier_settings',
    order: 1,
    minValue: 0.1,
    maxValue: 90,
    required: true
  },
  {
    category: 'tier_durations',
    key: 'A',
    value: 21,
    dataType: 'number',
    label: 'Tier A Duration (days)',
    description: 'Default duration in days for Tier A tasks',
    group: 'tier_settings',
    order: 2,
    minValue: 0.1,
    maxValue: 90,
    required: true
  },
  {
    category: 'tier_durations',
    key: 'B',
    value: 14,
    dataType: 'number',
    label: 'Tier B Duration (days)',
    description: 'Default duration in days for Tier B tasks',
    group: 'tier_settings',
    order: 3,
    minValue: 0.1,
    maxValue: 90,
    required: true
  },
  {
    category: 'tier_durations',
    key: 'C',
    value: 7,
    dataType: 'number',
    label: 'Tier C Duration (days)',
    description: 'Default duration in days for Tier C tasks',
    group: 'tier_settings',
    order: 4,
    minValue: 0.1,
    maxValue: 90,
    required: true
  },
  {
    category: 'tier_durations',
    key: 'D',
    value: 3,
    dataType: 'number',
    label: 'Tier D Duration (days)',
    description: 'Default duration in days for Tier D tasks',
    group: 'tier_settings',
    order: 5,
    minValue: 0.1,
    maxValue: 90,
    required: true
  },
  {
    category: 'tier_durations',
    key: 'E',
    value: 0.5,
    dataType: 'number',
    label: 'Tier E Duration (days)',
    description: 'Default duration in days for Tier E tasks',
    group: 'tier_settings',
    order: 6,
    minValue: 0.1,
    maxValue: 90,
    required: true
  },

  // 💾 CONFIGURACIONES DE CACHE
  {
    category: 'cache',
    key: 'default_ttl_seconds',
    value: 300, // 5 minutos
    dataType: 'number',
    label: 'Default Cache TTL (seconds)',
    description: 'Default time-to-live for cache entries in seconds',
    group: 'performance',
    order: 1,
    minValue: 60,
    maxValue: 3600,
    required: true
  },
  {
    category: 'cache',
    key: 'check_period_seconds',
    value: 60, // 1 minuto
    dataType: 'number',
    label: 'Cache Check Period (seconds)',
    description: 'Interval to check for expired cache entries',
    group: 'performance',
    order: 2,
    minValue: 30,
    maxValue: 600,
    required: true
  },

  // ✅ VALIDACIONES
  {
    category: 'validation',
    key: 'max_users_per_task',
    value: 5,
    dataType: 'number',
    label: 'Maximum Users Per Task',
    description: 'Maximum number of users that can be assigned to a single task',
    group: 'validation',
    order: 1,
    minValue: 1,
    maxValue: 20,
    required: true
  },
  {
    category: 'validation',
    key: 'min_task_duration_days',
    value: 0.1,
    dataType: 'number',
    label: 'Minimum Task Duration (days)',
    description: 'Minimum allowed task duration in days',
    group: 'validation',
    order: 2,
    minValue: 0.1,
    maxValue: 1,
    required: true
  },
  {
    category: 'validation',
    key: 'max_task_duration_days',
    value: 30,
    dataType: 'number',
    label: 'Maximum Task Duration (days)',
    description: 'Maximum allowed task duration in days',
    group: 'validation',
    order: 3,
    minValue: 1,
    maxValue: 365,
    required: true
  },
  {
    category: 'validation',
    key: 'min_category_name_length',
    value: 2,
    dataType: 'number',
    label: 'Minimum Category Name Length',
    description: 'Minimum characters required for category names',
    group: 'validation',
    order: 4,
    minValue: 1,
    maxValue: 10,
    required: true
  },
  {
    category: 'validation',
    key: 'max_category_name_length',
    value: 50,
    dataType: 'number',
    label: 'Maximum Category Name Length',
    description: 'Maximum characters allowed for category names',
    group: 'validation',
    order: 5,
    minValue: 10,
    maxValue: 200,
    required: true
  },

  // 🔗 CLICKUP CONFIGURACIONES
  {
    category: 'clickup',
    key: 'use_custom_fields',
    value: false,
    dataType: 'boolean',
    label: 'Use ClickUp Custom Fields',
    description: 'Whether to use custom fields for task metadata (requires ClickUp Unlimited plan)',
    group: 'clickup',
    order: 1,
    required: true
  },
  {
    category: 'clickup',
    key: 'use_table_comments',
    value: true,
    dataType: 'boolean',
    label: 'Use Table Comments',
    description: 'Whether to use table comments for task metadata',
    group: 'clickup',
    order: 2,
    required: true
  },
  {
    category: 'clickup',
    key: 'api_timeout_ms',
    value: 30000,
    dataType: 'number',
    label: 'API Timeout (milliseconds)',
    description: 'Timeout for ClickUp API requests',
    group: 'clickup',
    order: 3,
    minValue: 5000,
    maxValue: 120000,
    required: true
  },

  // 📄 PAGINACIÓN
  {
    category: 'pagination',
    key: 'default_page_size',
    value: 10,
    dataType: 'number',
    label: 'Default Page Size',
    description: 'Default number of items per page',
    group: 'ui',
    order: 1,
    minValue: 5,
    maxValue: 100,
    required: true
  },
  {
    category: 'pagination',
    key: 'max_page_size',
    value: 100,
    dataType: 'number',
    label: 'Maximum Page Size',
    description: 'Maximum number of items per page',
    group: 'ui',
    order: 2,
    minValue: 10,
    maxValue: 1000,
    required: true
  },

  // 🔄 INTERVALOS DE REFRESH
  {
    category: 'refresh',
    key: 'task_data_stale_time_ms',
    value: 300000, // 5 minutos
    dataType: 'number',
    label: 'Task Data Stale Time (ms)',
    description: 'How long task data stays fresh before refetch',
    group: 'performance',
    order: 3,
    minValue: 60000,
    maxValue: 1800000,
    required: true
  }
];

class SettingsService {
  private cache = new Map<string, any>();
  private readonly CACHE_PREFIX = 'settings_';

  /**
   * Inicializar configuraciones por defecto en la DB si no existen
   */
  async initializeDefaultSettings() {
    console.log('🔧 Initializing default settings...');
    
    const existingSettings = await prisma.systemSettings.findMany();
    const existingKeys = new Set(
      existingSettings.map(s => `${s.category}.${s.key}`)
    );

    const settingsToCreate = DEFAULT_SETTINGS.filter(
      setting => !existingKeys.has(`${setting.category}.${setting.key}`)
    );

    if (settingsToCreate.length > 0) {
      await prisma.systemSettings.createMany({
        data: settingsToCreate,
        skipDuplicates: true
      });
      
      console.log(`✅ Created ${settingsToCreate.length} default settings`);
    } else {
      console.log('✅ All default settings already exist');
    }
  }

  /**
   * Obtener una configuración específica
   */
  async getSetting<T = any>(category: string, key: string): Promise<T> {
    const cacheKey = `${this.CACHE_PREFIX}${category}.${key}`;
    
    // Verificar cache en memoria
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Verificar cache Redis/NodeCache
    const cached = getFromCache<T>(cacheKey);
    if (cached !== undefined) {
      this.cache.set(cacheKey, cached);
      return cached;
    }

    // Buscar en DB
    const setting = await prisma.systemSettings.findUnique({
      where: { 
        category_key: { category, key }
      }
    });

    if (!setting) {
      // Buscar en defaults como fallback
      const defaultSetting = DEFAULT_SETTINGS.find(
        s => s.category === category && s.key === key
      );
      
      if (defaultSetting) {
        console.warn(`⚠️ Setting ${category}.${key} not found in DB, using default: ${defaultSetting.value}`);
        return defaultSetting.value;
      }
      
      throw new Error(`Setting ${category}.${key} not found`);
    }

    const value = setting.value as T;
    
    // Cachear el resultado
    this.cache.set(cacheKey, value);
    setInCache(cacheKey, value, 300); // 5 minutos

    return value;
  }

  /**
   * Obtener múltiples configuraciones por categoría
   */
  async getSettingsByCategory(category: string): Promise<Record<string, any>> {
    const settings = await prisma.systemSettings.findMany({
      where: { category }
    });

    const result: Record<string, any> = {};
    
    for (const setting of settings) {
      result[setting.key] = setting.value;
      
      // Cachear individualmente
      const cacheKey = `${this.CACHE_PREFIX}${category}.${setting.key}`;
      this.cache.set(cacheKey, setting.value);
      setInCache(cacheKey, setting.value, 300);
    }

    return result;
  }

  /**
   * Actualizar una configuración
   */
  async updateSetting(category: string, key: string, value: any): Promise<void> {
    const setting = await prisma.systemSettings.findUnique({
      where: { 
        category_key: { category, key }
      }
    });

    if (!setting) {
      throw new Error(`Setting ${category}.${key} not found`);
    }

    // Validar el valor
    await this.validateSettingValue(setting, value);

    // Actualizar en DB
    await prisma.systemSettings.update({
      where: { id: setting.id },
      data: { 
        value,
        updatedAt: new Date()
      }
    });

    // Invalidar cache
    this.invalidateSettingCache(category, key);
    
    console.log(`✅ Updated setting ${category}.${key} = ${JSON.stringify(value)}`);
  }

  /**
   * Obtener todas las configuraciones para la UI
   */
  async getAllSettingsForUI() {
    const settings = await prisma.systemSettings.findMany({
      orderBy: [
        { group: 'asc' },
        { order: 'asc' }
      ]
    });

    // Agrupar por group
    const grouped: Record<string, any[]> = {};
    
    for (const setting of settings) {
      if (!grouped[setting.group]) {
        grouped[setting.group] = [];
      }
      
      grouped[setting.group].push({
        id: setting.id,
        category: setting.category,
        key: setting.key,
        value: setting.value,
        dataType: setting.dataType,
        label: setting.label,
        description: setting.description,
        minValue: setting.minValue,
        maxValue: setting.maxValue,
        options: setting.options,
        required: setting.required
      });
    }

    return grouped;
  }

  /**
   * Validar valor de configuración
   */
  private async validateSettingValue(setting: any, value: any): Promise<void> {
    if (setting.required && (value === null || value === undefined)) {
      throw new Error(`Setting ${setting.category}.${setting.key} is required`);
    }

    switch (setting.dataType) {
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(`Invalid number value for ${setting.category}.${setting.key}`);
        }
        if (setting.minValue !== null && value < setting.minValue) {
          throw new Error(`Value ${value} is below minimum ${setting.minValue} for ${setting.category}.${setting.key}`);
        }
        if (setting.maxValue !== null && value > setting.maxValue) {
          throw new Error(`Value ${value} is above maximum ${setting.maxValue} for ${setting.category}.${setting.key}`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`Invalid boolean value for ${setting.category}.${setting.key}`);
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`Invalid string value for ${setting.category}.${setting.key}`);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          throw new Error(`Invalid array value for ${setting.category}.${setting.key}`);
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw new Error(`Invalid object value for ${setting.category}.${setting.key}`);
        }
        break;
    }

    // Validar opciones si existen
    if (setting.options && Array.isArray(setting.options)) {
      if (!setting.options.includes(value)) {
        throw new Error(`Value ${value} is not in allowed options for ${setting.category}.${setting.key}`);
      }
    }
  }

  /**
   * Invalidar cache de una configuración
   */
  private invalidateSettingCache(category: string, key: string): void {
    const cacheKey = `${this.CACHE_PREFIX}${category}.${key}`;
    this.cache.delete(cacheKey);
    invalidateCacheByPrefix(cacheKey);
  }

  /**
   * Invalidar todo el cache de configuraciones
   */
  invalidateAllCache(): void {
    this.cache.clear();
    invalidateCacheByPrefix(this.CACHE_PREFIX);
  }
}

export const settingsService = new SettingsService();

// ✅ HELPERS PARA OBTENER CONFIGURACIONES ESPECÍFICAS
export const getWorkHours = () => settingsService.getSettingsByCategory('work_hours');
export const getTaskAssignmentThresholds = () => settingsService.getSettingsByCategory('task_assignment');
export const getTierDurations = () => settingsService.getSettingsByCategory('tier_durations');
export const getCacheSettings = () => settingsService.getSettingsByCategory('cache');
export const getValidationSettings = () => settingsService.getSettingsByCategory('validation');
export const getClickUpSettings = () => settingsService.getSettingsByCategory('clickup');
export const getPaginationSettings = () => settingsService.getSettingsByCategory('pagination');
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

const DEFAULT_SETTINGS = [
  // Work Schedule
  {
    category: 'work_schedule',
    key: 'start_hour',
    value: 8,
    dataType: 'number',
    label: 'Work Start Hour',
    description: 'Hour when work day starts (24h format)',
    group: 'work_schedule',
    order: 1,
    minValue: 0,
    maxValue: 23,
    required: true
  },
  {
    category: 'work_schedule',
    key: 'end_hour',
    value: 18,
    dataType: 'number',
    label: 'Work End Hour',
    description: 'Hour when work day ends (24h format)',
    group: 'work_schedule',
    order: 2,
    minValue: 0,
    maxValue: 23,
    required: true
  },
  {
    category: 'work_schedule',
    key: 'lunch_start',
    value: 13,
    dataType: 'number',
    label: 'Lunch Start Hour',
    description: 'Hour when lunch break starts',
    group: 'work_schedule',
    order: 3,
    minValue: 0,
    maxValue: 23,
    required: true
  },
  {
    category: 'work_schedule',
    key: 'lunch_duration',
    value: 1,
    dataType: 'number',
    label: 'Lunch Duration (hours)',
    description: 'Duration of lunch break in hours',
    group: 'work_schedule',
    order: 4,
    minValue: 0.5,
    maxValue: 2,
    required: true
  },
  // Task Assignment
  {
    category: 'task_assignment',
    key: 'normal_before_low_threshold',
    value: 2,
    dataType: 'number',
    label: 'Normal Tasks Before Low',
    description: 'Number of NORMAL priority tasks before placing a LOW priority task',
    group: 'task_assignment',
    order: 1,
    minValue: 1,
    maxValue: 10,
    required: true
  },
  {
    category: 'task_assignment',
    key: 'consecutive_low_threshold',
    value: 3,
    dataType: 'number',
    label: 'Consecutive Low Tasks Threshold',
    description: 'Maximum consecutive LOW priority tasks before forcing interleaving',
    group: 'task_assignment',
    order: 2,
    minValue: 1,
    maxValue: 10,
    required: true
  },
  {
    category: 'task_assignment',
    key: 'deadline_difference_threshold',
    value: 30,
    dataType: 'number',
    label: 'Deadline Difference Threshold (days)',
    description: 'Days difference to prefer generalist over specialist',
    group: 'task_assignment',
    order: 3,
    minValue: 5,
    maxValue: 60,
    required: true
  },
  // Tier Settings (nota informativa)
  {
    category: 'tier_settings',
    key: 'tier_info',
    value: 'Tier durations are managed in the table below',
    dataType: 'string',
    label: 'Tier Duration Management',
    description: 'Use the table below to adjust tier durations',
    group: 'tier_settings',
    order: 1,
    required: false
  }
];

// POST /api/settings/reset
export async function POST() {
  try {
    console.log('🔄 Resetting settings to defaults...');

    // Eliminar todos los settings actuales
    await prisma.systemSettings.deleteMany();

    // Recrear con valores por defecto
    for (const defaultSetting of DEFAULT_SETTINGS) {
      await prisma.systemSettings.create({
        data: defaultSetting
      });
    }

    const settings = await prisma.systemSettings.findMany({
      orderBy: [
        { group: 'asc' },
        { order: 'asc' }
      ]
    });

    console.log('✅ Settings reset to defaults');

    return NextResponse.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('❌ Error resetting settings:', error);
    return NextResponse.json({
      error: 'Error resetting settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
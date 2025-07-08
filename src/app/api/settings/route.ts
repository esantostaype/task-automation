// src/app/api/settings/route.ts

import { NextResponse } from 'next/server';
import { settingsService } from '@/services/settings.service';
import { prisma } from '@/utils';

/**
 * GET /api/settings
 * Obtiene todas las configuraciones agrupadas para la UI
 */
export async function GET() {
  try {
    console.log('📋 Getting all settings for UI...');
    
    // Inicializar configuraciones por defecto si es necesario
    await settingsService.initializeDefaultSettings();
    
    // Obtener todas las configuraciones
    const groupedSettings = await settingsService.getAllSettingsForUI();
    
    console.log(`✅ Retrieved settings for ${Object.keys(groupedSettings).length} groups`);
    
    return NextResponse.json({
      settings: groupedSettings,
      groups: Object.keys(groupedSettings),
      totalSettings: Object.values(groupedSettings).flat().length
    });
    
  } catch (error) {
    console.error('❌ Error getting settings:', error);
    
    return NextResponse.json({
      error: 'Failed to get settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * Actualiza múltiples configuraciones
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { updates } = body;
    
    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({
        error: 'Invalid request body. Expected { updates: [{ category, key, value }] }'
      }, { status: 400 });
    }
    
    console.log(`🔄 Updating ${updates.length} settings...`);
    
    const results = [];
    const errors = [];
    
    // Procesar cada actualización
    for (const update of updates) {
      const { category, key, value } = update;
      
      if (!category || !key || value === undefined) {
        errors.push({
          update,
          error: 'Missing required fields: category, key, value'
        });
        continue;
      }
      
      try {
        await settingsService.updateSetting(category, key, value);
        results.push({
          category,
          key,
          value,
          status: 'success'
        });
        
        console.log(`✅ Updated ${category}.${key} = ${JSON.stringify(value)}`);
        
      } catch (updateError) {
        console.error(`❌ Failed to update ${category}.${key}:`, updateError);
        
        errors.push({
          update,
          error: updateError instanceof Error ? updateError.message : 'Unknown error'
        });
      }
    }
    
    const response = {
      success: results.length,
      errors: errors.length,
      results,
      ...(errors.length > 0 && { errors })
    };
    
    console.log(`📊 Settings update completed: ${results.length} success, ${errors.length} errors`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error updating settings:', error);
    
    return NextResponse.json({
      error: 'Failed to update settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/settings/reset
 * Resetea todas las configuraciones a valores por defecto
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { confirmReset } = body;
    
    if (!confirmReset) {
      return NextResponse.json({
        error: 'Reset confirmation required'
      }, { status: 400 });
    }
    
    console.log('🔄 Resetting all settings to defaults...');
    
    // Invalidar cache
    settingsService.invalidateAllCache();
    
    // Eliminar configuraciones existentes
    await prisma.systemSettings.deleteMany();
    
    // Recrear configuraciones por defecto
    await settingsService.initializeDefaultSettings();
    
    console.log('✅ All settings reset to defaults');
    
    return NextResponse.json({
      message: 'All settings reset to defaults successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error resetting settings:', error);
    
    return NextResponse.json({
      error: 'Failed to reset settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
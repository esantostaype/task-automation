/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/debug/clickup-raw/route.ts - Endpoint para debuggear datos crudos de ClickUp

import { NextResponse } from 'next/server';
import axios from 'axios';
import { API_CONFIG } from '@/config';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

/**
 * GET /api/debug/clickup-raw
 * Devuelve los datos crudos de ClickUp para debugging
 */
export async function GET() {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  try {
    console.log('🔍 DEBUG: Obteniendo datos crudos de ClickUp...');

    // Obtener teams del usuario autenticado
    const teamsResponse = await axios.get(
      `${API_CONFIG.CLICKUP_API_BASE}/team`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📊 Respuesta cruda de ClickUp teams:', JSON.stringify(teamsResponse.data, null, 2));

    // Analizar la estructura de cada team y miembro
    const analysis = {
      totalTeams: teamsResponse.data.teams?.length || 0,
      teams: teamsResponse.data.teams?.map((team: any, teamIndex: number) => {
        const teamAnalysis = {
          index: teamIndex,
          id: team.id,
          name: team.name,
          totalMembers: team.members?.length || 0,
          membersAnalysis: team.members?.map((member: any, memberIndex: number) => {
            // ✅ CORRECCIÓN: Analizar member.user en lugar de member directamente
            const user = member?.user;
            const memberAnalysis = {
              index: memberIndex,
              hasMember: !!member,
              hasUserObject: !!user,
              hasId: user?.hasOwnProperty('id'),
              idType: typeof user?.id,
              idValue: user?.id,
              hasUsername: user?.hasOwnProperty('username'),
              usernameValue: user?.username,
              hasEmail: user?.hasOwnProperty('email'),
              emailValue: user?.email,
              hasRole: user?.hasOwnProperty('role_key'),
              roleValue: user?.role_key,
              userProperties: Object.keys(user || {}),
              memberProperties: Object.keys(member || {}),
              rawMember: member,
              extractedUser: user
            };
            
            console.log(`   Team ${teamIndex} - Member ${memberIndex}:`, memberAnalysis);
            return memberAnalysis;
          }) || []
        };
        
        console.log(`Team ${teamIndex} analysis:`, teamAnalysis);
        return teamAnalysis;
      }) || [],
      rawResponse: teamsResponse.data
    };

    return NextResponse.json({
      message: 'Datos crudos de ClickUp para debugging',
      timestamp: new Date().toISOString(),
      analysis: analysis,
      recommendations: {
        checkIdProperty: 'Verifica que todos los miembros tengan la propiedad "id"',
        checkDataTypes: 'Revisa los tipos de datos de las propiedades',
        validateStructure: 'Asegúrate de que la estructura coincida con la interfaz esperada'
      }
    });

  } catch (error) {
    console.error('❌ Error en debug de ClickUp:', error);
    
    if (axios.isAxiosError(error)) {
      const errorInfo = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        url: error.config?.url,
        method: error.config?.method
      };
      
      console.log('Error details:', errorInfo);
      
      return NextResponse.json({
        error: 'Error de ClickUp API',
        details: errorInfo,
        message: error.message
      }, { status: error.response?.status || 500 });
    }

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
/* eslint-disable @typescript-eslint/no-explicit-any */
// Crear endpoint para debuggear status de ClickUp
// src/app/api/debug-clickup-status/route.ts

import { NextResponse } from 'next/server'
import axios from 'axios'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const listId = searchParams.get('listId')

  if (!listId) {
    return NextResponse.json({ error: 'listId is required' }, { status: 400 })
  }

  try {
    console.log(`🔍 Obteniendo status de lista: ${listId}`)
    
    const response = await axios.get(
      `https://api.clickup.com/api/v2/list/${listId}`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    const listData = response.data
    console.log(`📋 Lista: ${listData.name}`)
    console.log('📊 Status disponibles:')
    
    listData.statuses?.forEach((status: any, index: number) => {
      console.log(`   ${index}: "${status.status}" (type: ${status.type}, orderindex: ${status.orderindex})`)
    })

    return NextResponse.json({
      listId: listData.id,
      listName: listData.name,
      statuses: listData.statuses,
      debugInfo: {
        statusNames: listData.statuses?.map((s: any) => s.status) || [],
        defaultStatus: listData.statuses?.[0]?.status || 'unknown'
      }
    })

  } catch (error: any) {
    console.error('❌ Error obteniendo status de ClickUp:', error.response?.data || error.message)
    return NextResponse.json({
      error: 'Error al obtener status de ClickUp',
      details: error.response?.data || error.message
    }, { status: 500 })
  }
}

// Función auxiliar para verificar status de todos los brands
export async function debugAllBrandStatuses() {
  const brands = [
    { id: '901700182493', name: 'Inszone' },
    { id: '901700182489', name: 'R.E. Chaix' },
    { id: '901704229078', name: 'Pinney' }
  ]

  console.log('🔍 === DEBUGGING STATUS DE TODOS LOS BRANDS ===')
  
  for (const brand of brands) {
    try {
      const response = await axios.get(
        `https://api.clickup.com/api/v2/list/${brand.id}`,
        {
          headers: {
            'Authorization': CLICKUP_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      )

      console.log(`\n📋 Brand: ${brand.name} (${brand.id})`)
      console.log('   Status disponibles:')
      
      response.data.statuses?.forEach((status: any) => {
        console.log(`     - "${status.status}" (${status.type})`)
      })

    } catch (error: any) {
      console.error(`❌ Error con brand ${brand.name}:`, error.response?.data || error.message)
    }
  }
}
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/webhook-monitor/route.ts
import { NextResponse } from 'next/server'

// Almacenar los últimos eventos recibidos (solo en memoria para debugging)
let lastEvents: Array<{
  timestamp: string,
  method: string,
  event?: string,
  taskId?: string,
  body: any
}> = []

export async function POST(req: Request) {
  const timestamp = new Date().toISOString()
  
  try {
    const rawBody = await req.text()
    let body: any = {}
    
    try {
      body = rawBody ? JSON.parse(rawBody) : {}
    } catch (e) {
      body = { rawBody, parseError: true }
    }

    // Guardar evento
    const eventData = {
      timestamp,
      method: 'POST',
      event: body.event || 'no_event',
      taskId: body.task_id || 'no_task_id',
      body: body
    }
    
    lastEvents.unshift(eventData)
    if (lastEvents.length > 10) lastEvents = lastEvents.slice(0, 10) // Solo últimos 10
    
    // Log inmediato
    console.log(`\n🔥 WEBHOOK RECEIVED - ${timestamp}`)
    console.log(`📧 Method: POST`)
    console.log(`🎯 Event: ${body.event || 'NONE'}`)
    console.log(`📋 Task ID: ${body.task_id || 'NONE'}`)
    console.log(`📦 Body size: ${rawBody.length} chars`)
    console.log(`📊 Total events stored: ${lastEvents.length}`)
    
    if (body.event) {
      console.log(`✅ REAL EVENT DETECTED: ${body.event}`)
    } else {
      console.log(`🧪 TEST/PING EVENT (no event type)`)
    }
    
    console.log(`-`.repeat(50))

    return NextResponse.json({
      success: true,
      message: 'Event received and logged',
      timestamp,
      eventType: body.event || 'test_event',
      taskId: body.task_id || null,
      totalEventsReceived: lastEvents.length
    })

  } catch (error) {
    console.error('❌ Webhook monitor error:', error)
    
    const errorData = {
      timestamp,
      method: 'POST',
      event: 'ERROR',
      taskId: 'ERROR',
      body: { error: error instanceof Error ? error.message : 'Unknown error' }
    }
    
    lastEvents.unshift(errorData)
    if (lastEvents.length > 10) lastEvents = lastEvents.slice(0, 10)
    
    return NextResponse.json({
      error: 'Processing error',
      timestamp,
      totalEventsReceived: lastEvents.length
    })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge')
  
  // Handle ClickUp verification
  if (challenge) {
    console.log('🔐 ClickUp verification challenge:', challenge)
    return new Response(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  // Return recent events for monitoring
  return NextResponse.json({
    status: 'Webhook monitor active',
    timestamp: new Date().toISOString(),
    recentEvents: lastEvents,
    totalEvents: lastEvents.length,
    lastEventTime: lastEvents[0]?.timestamp || 'none',
    instructions: [
      '1. Configure your ClickUp webhook to point to this endpoint',
      '2. Make sure to select specific EVENTS in ClickUp webhook config',
      '3. Make changes to tasks in ClickUp',
      '4. Check this endpoint to see received events',
      '5. Events are stored temporarily in memory for debugging'
    ]
  })
}
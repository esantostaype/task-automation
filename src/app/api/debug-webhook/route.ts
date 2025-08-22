// src/app/api/webhook-debug/route.ts
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  
  try {
    // Log todo lo que llega
    console.log('\n🚨 =================== WEBHOOK DEBUG ===================');
    console.log(`⏰ Timestamp: ${timestamp}`);
    console.log(`🔗 URL: ${req.url}`);
    console.log(`📧 Method: ${req.method}`);
    
    // Log headers
    console.log('\n📨 HEADERS:');
    req.headers.forEach((value, key) => {
      console.log(`   ${key}: ${value}`);
    });
    
    // Log body
    const rawBody = await req.text();
    console.log(`\n📦 RAW BODY (${rawBody.length} chars):`);
    console.log(rawBody);
    
    // Intentar parsear JSON
    let jsonBody = null;
    try {
      jsonBody = JSON.parse(rawBody);
      console.log('\n📝 PARSED JSON:');
      console.log(JSON.stringify(jsonBody, null, 2));
    } catch (e) {
      console.log('\n❌ JSON PARSE ERROR:', e);
    }
    
    // Log específico de ClickUp
    if (jsonBody) {
      console.log('\n🎯 CLICKUP EVENT ANALYSIS:');
      console.log(`   Event: ${jsonBody.event || 'NOT_PROVIDED'}`);
      console.log(`   Task ID: ${jsonBody.task_id || 'NOT_PROVIDED'}`);
      console.log(`   Task Name: ${jsonBody.task?.name || 'NOT_PROVIDED'}`);
      console.log(`   Webhook ID: ${jsonBody.webhook_id || 'NOT_PROVIDED'}`);
    }
    
    console.log('=======================================================\n');
    
    // Respuesta exitosa para ClickUp
    return NextResponse.json({
      success: true,
      message: 'Webhook debug received successfully',
      timestamp,
      receivedData: {
        bodyLength: rawBody.length,
        eventType: jsonBody?.event || 'unknown',
        taskId: jsonBody?.task_id || 'unknown'
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ DEBUG WEBHOOK ERROR:', error);
    
    return NextResponse.json({
      error: 'Debug webhook error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    }, { status: 200 }); // Siempre 200 para ClickUp
  }
}

export async function GET(req: Request) {
  // Para verificación de ClickUp
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    console.log('🔐 ClickUp verification challenge:', challenge);
    return new Response(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  return NextResponse.json({
    status: 'Debug endpoint active',
    timestamp: new Date().toISOString(),
    message: 'Use POST to receive webhook data'
  });
}
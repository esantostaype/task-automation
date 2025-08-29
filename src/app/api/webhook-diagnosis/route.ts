// src/app/api/webhook-diagnosis/route.ts
import { NextResponse } from 'next/server'
import axios from 'axios'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

interface WebhookAnalysis {
  id: string;
  endpoint: string;
  status: string;
  events: string[];
  eventsCount: number;
  health: string;
  created: string;
  space: string;
  folder: string;
  list: string;
}

interface DiagnosisIssue {
  type: 'CRITICAL' | 'ERROR' | 'WARNING';
  webhook: string;
  problem: string;
  solution: string;
  currentEvents?: string[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const teamId = searchParams.get('teamId')
  
  if (!teamId) {
    return NextResponse.json({
      error: 'Missing teamId parameter',
      note: 'Usage: /api/webhook-diagnosis?teamId=YOUR_TEAM_ID',
      howToFindTeamId: 'Go to ClickUp → Settings → Apps → API → Copy your Team ID'
    })
  }

  if (!CLICKUP_TOKEN) {
    return NextResponse.json({
      error: 'CLICKUP_API_TOKEN not configured in environment variables',
      required: 'Add CLICKUP_API_TOKEN to your .env file'
    })
  }

  try {
    console.log(`🔍 Fetching webhook configuration for team ${teamId}...`)

    const response = await axios.get(
      `https://api.clickup.com/api/v2/team/${teamId}/webhook`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    )

    const webhooks = response.data.webhooks || []
    
    const diagnosis = {
      timestamp: new Date().toISOString(),
      teamId,
      totalWebhooks: webhooks.length,
      yourWebhooks: [] as WebhookAnalysis[],
      issues: [] as DiagnosisIssue[],
      recommendations: [] as string[]
    }

    // Analizar cada webhook
    for (const webhook of webhooks) {
      const isYours = webhook.endpoint && (
        webhook.endpoint.includes('assignify.vercel.app') ||
        webhook.endpoint.includes('webhook-monitor') ||
        webhook.endpoint.includes('debug-webhook')
      )

      if (isYours) {
        const webhookAnalysis: WebhookAnalysis = {
          id: webhook.id,
          endpoint: webhook.endpoint,
          status: webhook.status,
          events: webhook.events || [],
          eventsCount: (webhook.events || []).length,
          health: webhook.health,
          created: webhook.date_created,
          space: webhook.space?.name || 'All spaces',
          folder: webhook.folder?.name || 'All folders',
          list: webhook.list?.name || 'All lists'
        }

        diagnosis.yourWebhooks.push(webhookAnalysis)

        // Detectar problemas específicos
        if (!webhook.events || webhook.events.length === 0) {
          diagnosis.issues.push({
            type: 'CRITICAL',
            webhook: webhook.id,
            problem: 'NO EVENTS CONFIGURED',
            solution: 'Go to ClickUp → Edit this webhook → Select specific events (Task Created, Task Updated, etc.)'
          })
        }

        if (webhook.status !== 'active') {
          diagnosis.issues.push({
            type: 'ERROR',
            webhook: webhook.id,
            problem: `Webhook status is '${webhook.status}'`,
            solution: 'Webhook should be active'
          })
        }

        const requiredEvents = ['taskCreated', 'taskUpdated', 'taskStatusUpdated', 'taskDeleted']
        const hasRequiredEvents = requiredEvents.some(event => 
          webhook.events && webhook.events.includes(event)
        )

        if (webhook.events && webhook.events.length > 0 && !hasRequiredEvents) {
          diagnosis.issues.push({
            type: 'WARNING',
            webhook: webhook.id,
            problem: 'No task-related events configured',
            solution: 'Add events: taskCreated, taskUpdated, taskStatusUpdated, taskDeleted',
            currentEvents: webhook.events
          })
        }
      }
    }

    // Generar recomendaciones
    if (diagnosis.yourWebhooks.length === 0) {
      diagnosis.recommendations.push('Create a webhook pointing to your Vercel app')
    }

    if (diagnosis.issues.some(issue => issue.type === 'CRITICAL')) {
      diagnosis.recommendations.push('URGENT: Configure events in ClickUp webhook settings')
      diagnosis.recommendations.push('Steps: ClickUp → Settings → Integrations → Webhooks → Edit → Select Events')
    }

    diagnosis.recommendations.push('After fixing, test by changing a task status in ClickUp')
    diagnosis.recommendations.push('Check /api/webhook-monitor for received events')

    // Log para debugging
    console.log('📊 WEBHOOK DIAGNOSIS RESULTS:')
    console.log(`   Total webhooks: ${diagnosis.totalWebhooks}`)
    console.log(`   Your webhooks: ${diagnosis.yourWebhooks.length}`)
    console.log(`   Issues found: ${diagnosis.issues.length}`)
    
    diagnosis.yourWebhooks.forEach((webhook, index) => {
      console.log(`\n   Webhook ${index + 1}:`)
      console.log(`     ID: ${webhook.id}`)
      console.log(`     Endpoint: ${webhook.endpoint}`)
      console.log(`     Status: ${webhook.status}`)
      console.log(`     Events: ${webhook.events.join(', ') || 'NONE ⚠️'}`)
      console.log(`     Events count: ${webhook.eventsCount}`)
    })

    return NextResponse.json({
      success: true,
      diagnosis,
      summary: {
        status: diagnosis.issues.length === 0 ? 'HEALTHY' : 'NEEDS_ATTENTION',
        criticalIssues: diagnosis.issues.filter(i => i.type === 'CRITICAL').length,
        totalIssues: diagnosis.issues.length,
        webhooksFound: diagnosis.yourWebhooks.length
      }
    })

  } catch (error) {
    console.error('❌ Error in webhook diagnosis:', error)
    
    let errorDetails = 'Unknown error'
    let statusCode = 500
    
    if (axios.isAxiosError(error)) {
      errorDetails = `API Error: ${error.response?.status} - ${error.response?.statusText}`
      statusCode = error.response?.status || 500
      
      if (error.response?.status === 401) {
        errorDetails = 'Invalid or expired ClickUp API token'
      } else if (error.response?.status === 404) {
        errorDetails = 'Team ID not found or no access'
      }
    }

    return NextResponse.json({
      error: 'Failed to diagnose webhooks',
      details: errorDetails,
      troubleshooting: {
        checkApiToken: 'Verify CLICKUP_API_TOKEN is valid',
        checkTeamId: 'Verify team ID is correct',
        checkPermissions: 'API token needs webhook permissions'
      }
    }, { status: statusCode })
  }
}
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios'
import { prisma } from '@/utils/prisma'
import { createSyncLog } from '@/utils/sync-log-utils'
import { 
  ClickUpTaskCreationParams, 
  ClickUpTaskResponse, 
  AssigneeDebugInfo 
} from '@/interfaces'
import { clickupPriorityMap, getClickUpStatusName } from '@/utils/clickup-task-mapping-utils'

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2'
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

export async function createTaskInClickUp(params: ClickUpTaskCreationParams): Promise<ClickUpTaskResponse> {
  const { name, description, priority, deadline, startDate, usersToAssign, category, brand } = params

  const clickupAssignees: number[] = []
  const assigneeDebugInfo: AssigneeDebugInfo[] = []

  for (const userId of usersToAssign) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const debugInfo: AssigneeDebugInfo = { 
      userId, 
      userName: user?.name, 
      clickupId: user?.id, 
      willBeAssigned: false, 
      reason: '' 
    }

    if (!user) {
      debugInfo.reason = 'Usuario no encontrado en DB local.'
    } else if (!user.id) {
      debugInfo.reason = 'Usuario no tiene ClickUp ID.'
    } else {
      const clickupIdNum = parseInt(user.id)
      if (isNaN(clickupIdNum)) {
        debugInfo.reason = `ClickUp ID no es un número válido: "${user.id}"`
      } else {
        clickupAssignees.push(clickupIdNum)
        debugInfo.willBeAssigned = true
        debugInfo.reason = `Asignado: ${clickupIdNum}`
      }
    }
    assigneeDebugInfo.push(debugInfo)
  }

  console.log('🎯 DEBUG - Procesamiento de asignados para ClickUp:', {
    localUsersToAssign: usersToAssign,
    clickupAssigneesToSend: clickupAssignees,
    assigneeDebugInfo,
  })

  const clickUpPayload = {
    name: name,
    description: description || '',
    priority: clickupPriorityMap[priority] || 3,
    due_date: deadline.getTime().toString(),
    start_date: startDate.getTime().toString(),
    assignees: clickupAssignees,
    tags: [`type:${category.type.name}`, `category:${category.name}`],
    status: getClickUpStatusName(brand.defaultStatus, brand.statusMapping),
  }

  console.log('📤 Enviando a ClickUp API:', {
    url: `${CLICKUP_API_BASE}/list/${brand.id}/task`,
    payload: clickUpPayload,
  })

  try {
    const response = await axios.post(
      `${CLICKUP_API_BASE}/list/${brand.id}/task`,
      clickUpPayload,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    await createSyncLog('Task', null, response.data.id, 'CREATE', 'SUCCESS', undefined, response.data)
    console.log(`✅ Tarea creada en ClickUp: ${response.data.id}`)

    return {
      clickupTaskId: response.data.id,
      clickupTaskUrl: response.data.url
    }

  } catch (error: unknown) {
    const axiosError = error as any
    const errorMessage = `Error al crear tarea en ClickUp: ${axiosError.response?.data?.err || axiosError.message || axiosError.toString()}`
    
    console.error('❌ Error de ClickUp API:', {
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      errorData: axiosError.response?.data,
      sentPayload: axiosError.config?.data,
      url: axiosError.config?.url,
      message: axiosError.message,
    })

    await createSyncLog('Task', null, 'temp-id-failed-create', 'CREATE', 'ERROR', errorMessage, axiosError.response?.data)
    throw error
  }
}

export async function emitTaskUpdateEvent(taskData: unknown): Promise<void> {
  try {
    await axios.post('https://task-automation-zeta.vercel.app/api/socket_emitter', {
      eventName: 'task_update',
      data: taskData,
    })
    console.log('✅ Evento task_update enviado al socket-emitter.')
  } catch (emitterError) {
    console.error('⚠️ Error al enviar evento a socket-emitter:', emitterError)
  }
}
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios'
import { prisma } from '@/utils/prisma'
import { createSyncLog } from '@/utils/sync-log-utils'
import {
  ClickUpTaskCreationParams,
  ClickUpTaskResponse,
  AssigneeDebugInfo,
  Task // Importar el tipo Task
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

/**
 * Actualiza una tarea existente en ClickUp.
 * @param taskId El ID de la tarea de ClickUp.
 * @param updatedTaskData Los datos de la tarea local (de Prisma) con las actualizaciones.
 */
export async function updateTaskInClickUp(taskId: string, updatedTaskData: Task): Promise<void> {
  if (!CLICKUP_TOKEN) {
    console.error('ERROR: CLICKUP_API_TOKEN no configurado para actualizar tarea en ClickUp.')
    throw new Error('CLICKUP_API_TOKEN no configurado.')
  }

  // Asegurarse de que tenemos la información más reciente de la marca para el mapeo de estado
  const brand = await prisma.brand.findUnique({ where: { id: updatedTaskData.brandId } });
  if (!brand) {
    console.warn(`Brand no encontrado para la tarea ${taskId}. No se puede actualizar el estado en ClickUp.`);
    await createSyncLog('Task', null, taskId, 'UPDATE_CLICKUP', 'WARNING', 'Brand no encontrado para mapeo de estado.');
    // Continuar sin actualizar el estado si no se encuentra la marca
  }

  const clickupAssignees: number[] = [];
  if (updatedTaskData.assignees && updatedTaskData.assignees.length > 0) {
    for (const assignee of updatedTaskData.assignees) {
      const clickupIdNum = parseInt(assignee.userId);
      if (!isNaN(clickupIdNum)) {
        clickupAssignees.push(clickupIdNum);
      }
    }
  }

  const clickUpPayload: any = {
    name: updatedTaskData.name,
    description: updatedTaskData.description || '',
    priority: clickupPriorityMap[updatedTaskData.priority] || 3,
    due_date: updatedTaskData.deadline.getTime().toString(), // Asegurar que es un string de timestamp
    start_date: updatedTaskData.startDate.getTime().toString(), // Asegurar que es un string de timestamp
    assignees: clickupAssignees,
    // No actualizamos tags aquí a menos que sea necesario, ya que pueden ser complejos.
    // Si el estado es importante, lo incluimos usando el mapeo de la marca.
    status: brand ? getClickUpStatusName(updatedTaskData.status, brand.statusMapping) : undefined,
  };

  console.log(`📤 Enviando actualización a ClickUp API para tarea ${taskId}:`);
  console.log('   URL:', `${CLICKUP_API_BASE}/task/${taskId}`);
  console.log('   Payload:', JSON.stringify(clickUpPayload, null, 2));


  try {
    const response = await axios.put(
      `${CLICKUP_API_BASE}/task/${taskId}`,
      clickUpPayload,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Tarea ${taskId} actualizada en ClickUp. Respuesta:`);
    console.log(JSON.stringify(response.data, null, 2));
    await createSyncLog('Task', null, taskId, 'UPDATE_CLICKUP', 'SUCCESS', undefined, response.data);
  } catch (error: unknown) {
    const axiosError = error as any;
    const errorMessage = `Error al actualizar tarea ${taskId} en ClickUp: ${axiosError.response?.data?.err || axiosError.message || axiosError.toString()}`;
    console.error('❌ Error de ClickUp API al actualizar tarea:', {
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      errorData: axiosError.response?.data,
      sentPayload: axiosError.config?.data,
      url: axiosError.config?.url,
      message: axiosError.message,
    });
    await createSyncLog('Task', null, taskId, 'UPDATE_CLICKUP', 'ERROR', errorMessage, axiosError.response?.data);
    throw error; // Propagar el error para manejo superior si es necesario
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

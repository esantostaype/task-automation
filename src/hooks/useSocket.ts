import { useEffect } from 'react'
import io, { Socket } from 'socket.io-client'
import { toast } from 'react-toastify'
import { ClientToServerEvents, ServerToClientEvents, UpdatedTask } from '@/interfaces'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: TypedSocket | null = null

export const useSocket = () => {
  useEffect(() => {
    if (!socket) {
      socket = io({
        path: '/api/socket_io',
        addTrailingSlash: false,
      })

      socket.on('connect', () => console.log('Conectado a Socket.IO'))
      socket.on('task_update', (updatedTask: UpdatedTask) => {
        console.log('Tarea actualizada en tiempo real:', updatedTask)
        toast.info(`Tarea "${updatedTask.name}" actualizada en tiempo real.`)
      })
      socket.on('disconnect', () => console.log('Desconectado de Socket.IO'))
    }

    return () => {
      if (socket) {
        socket.disconnect()
        socket = null
      }
    }
  }, [])
}
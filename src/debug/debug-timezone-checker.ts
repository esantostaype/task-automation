/* eslint-disable @typescript-eslint/no-explicit-any */
// debug-timezone-checker.ts - Para verificar los horarios que se están enviando

import { WORK_HOURS } from '@/config'

// Función para debug: mostrar qué horarios se están calculando
export function debugTimezoneCalculations() {
  console.log('🌍 === DEBUG: CONFIGURACIÓN DE HORARIOS ===')
  
  // Configuración actual
  console.log('⚙️ Configuración WORK_HOURS (UTC):')
  console.log(`   START: ${WORK_HOURS.START} UTC`)
  console.log(`   LUNCH_START: ${WORK_HOURS.LUNCH_START} UTC`) 
  console.log(`   LUNCH_END: ${WORK_HOURS.LUNCH_END} UTC`)
  console.log(`   END: ${WORK_HOURS.END} UTC`)
  
  // Conversión a hora de Perú (UTC-5)
  console.log('\n🇵🇪 Equivalencias en hora de Perú (UTC-5):')
  console.log(`   START: ${WORK_HOURS.START - 5} = ${formatHour(WORK_HOURS.START - 5)}`)
  console.log(`   LUNCH_START: ${WORK_HOURS.LUNCH_START - 5} = ${formatHour(WORK_HOURS.LUNCH_START - 5)}`)
  console.log(`   LUNCH_END: ${WORK_HOURS.LUNCH_END - 5} = ${formatHour(WORK_HOURS.LUNCH_END - 5)}`)
  console.log(`   END: ${WORK_HOURS.END - 5} = ${formatHour(WORK_HOURS.END - 5)}`)
  
  // Ejemplo de fecha de trabajo
  const testDate = new Date()
  testDate.setUTCHours(WORK_HOURS.START, 0, 0, 0)
  
  console.log('\n📅 Ejemplo de fecha calculada:')
  console.log(`   Fecha UTC: ${testDate.toISOString()}`)
  console.log(`   Fecha Perú: ${testDate.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`)
  
  // Test de horarios
  console.log('\n🧪 Test de conversiones:')
  testHourConversion(10, 'Inicio trabajo Perú')
  testHourConversion(14, 'Inicio almuerzo Perú') 
  testHourConversion(15, 'Fin almuerzo Perú')
  testHourConversion(19, 'Fin trabajo Perú')
}

function formatHour(hour: number): string {
  if (hour < 0) hour += 24
  if (hour >= 24) hour -= 24
  
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:00 ${period}`
}

function testHourConversion(peruHour: number, description: string) {
  const utcHour = peruHour + 5 // Perú es UTC-5
  const testDate = new Date()
  testDate.setUTCHours(utcHour, 0, 0, 0)
  
  console.log(`   ${description}: ${peruHour}:00 Perú = ${utcHour} UTC = ${testDate.toISOString()}`)
}

// Función para verificar que una fecha específica tenga los horarios correctos
export function verifyTaskDateTime(startDate: Date, deadline: Date, taskName: string) {
  console.log(`\n🔍 === VERIFICANDO HORARIOS DE TAREA: "${taskName}" ===`)
  
  // Mostrar en UTC
  console.log('⏰ Horarios en UTC:')
  console.log(`   Start: ${startDate.toISOString()}`)
  console.log(`   Deadline: ${deadline.toISOString()}`)
  
  // Mostrar en hora de Perú
  console.log('🇵🇪 Horarios en Perú (UTC-5):')
  console.log(`   Start: ${startDate.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`)
  console.log(`   Deadline: ${deadline.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`)
  
  // Verificar si están en horario laboral
  const startHourUTC = startDate.getUTCHours()
  const deadlineHourUTC = deadline.getUTCHours()
  
  console.log('✅ Validación horario laboral:')
  console.log(`   Start hour UTC: ${startHourUTC} (¿Entre ${WORK_HOURS.START}-${WORK_HOURS.END}? ${isWorkingHour(startHourUTC)})`)
  console.log(`   Deadline hour UTC: ${deadlineHourUTC} (¿Entre ${WORK_HOURS.START}-${WORK_HOURS.END}? ${isWorkingHour(deadlineHourUTC)})`)
  
  // Timestamps para ClickUp
  console.log('📤 Timestamps para ClickUp:')
  console.log(`   start_date: ${startDate.getTime()}`)
  console.log(`   due_date: ${deadline.getTime()}`)
}

function isWorkingHour(utcHour: number): boolean {
  // Verificar si está en horario laboral (considerando almuerzo)
  return (utcHour >= WORK_HOURS.START && utcHour < WORK_HOURS.LUNCH_START) ||
         (utcHour >= WORK_HOURS.LUNCH_END && utcHour < WORK_HOURS.END)
}

// Función para debuggear el payload completo que se envía a ClickUp
export function debugClickUpPayload(payload: any, taskName: string) {
  console.log(`\n📤 === PAYLOAD CLICKUP PARA: "${taskName}" ===`)
  
  if (payload.start_date) {
    const startDate = new Date(payload.start_date)
    console.log('📅 Start Date:')
    console.log(`   Timestamp: ${payload.start_date}`)
    console.log(`   UTC: ${startDate.toISOString()}`) 
    console.log(`   Perú: ${startDate.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`)
    console.log(`   start_date_time: ${payload.start_date_time}`)
  }
  
  if (payload.due_date) {
    const dueDate = new Date(payload.due_date)
    console.log('📅 Due Date:')
    console.log(`   Timestamp: ${payload.due_date}`)
    console.log(`   UTC: ${dueDate.toISOString()}`)
    console.log(`   Perú: ${dueDate.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`)
    console.log(`   due_date_time: ${payload.due_date_time}`)
  }
  
  console.log('📋 Payload completo:', JSON.stringify(payload, null, 2))
}

// Función para verificar la zona horaria del servidor
export function checkServerTimezone() {
  console.log('\n🖥️ === INFORMACIÓN DEL SERVIDOR ===')
  
  const now = new Date()
  console.log(`Fecha actual servidor: ${now.toString()}`)
  console.log(`UTC: ${now.toISOString()}`)
  console.log(`Zona horaria servidor: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`)
  console.log(`Offset servidor: UTC${now.getTimezoneOffset() > 0 ? '-' : '+'}${Math.abs(now.getTimezoneOffset() / 60)}`)
  
  // Test de conversión específica a Lima
  console.log(`Hora en Lima: ${now.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`)
}

// Test completo
export function runCompleteTimezoneTest() {
  console.log('🧪 === TEST COMPLETO DE ZONA HORARIA ===\n')
  
  checkServerTimezone()
  debugTimezoneCalculations()
  
  // Simular una tarea que empieza "ahora" en horario laboral
  const testStart = new Date()
  testStart.setUTCHours(WORK_HOURS.START, 30, 0, 0) // 10:30 AM Perú
  
  const testDeadline = new Date(testStart)
  testDeadline.setUTCHours(WORK_HOURS.START + 2, 30, 0, 0) // 12:30 PM Perú (2 horas después)
  
  verifyTaskDateTime(testStart, testDeadline, 'Test Task')
  
  // Simular payload de ClickUp
  const testPayload = {
    name: 'Test Task',
    start_date: testStart.getTime(),
    start_date_time: true,
    due_date: testDeadline.getTime(), 
    due_date_time: true,
  }
  
  debugClickUpPayload(testPayload, 'Test Task')
}
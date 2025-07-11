// /* eslint-disable @typescript-eslint/no-explicit-any */
// // src/app/api/tasks/suggestion/smart/route.ts
// import { NextResponse } from 'next/server';
// import { prisma } from '@/utils/prisma';
// import { Priority } from '@prisma/client';
// import { 
//   getNextAvailableStart, 
//   calculateWorkingDeadline 
// } from '@/utils/task-calculation-utils';

// interface SmartSuggestionResponse {
//   suggestedUserId: string;
//   suggestionType: 'immediate' | 'wait_for_vacation_return' | 'overload_distribution';
//   estimatedDurationHours: number;
//   estimatedDurationDays: number;
//   userInfo: {
//     id: string;
//     name: string;
//     isSpecialist: boolean;
//     status: 'available' | 'on_vacation' | 'overloaded';
//     availableFrom: string;
//     estimatedStartDate: string;
//     estimatedEndDate: string;
//     currentWorkloadDays: number;
//     vacationInfo?: {
//       isOnVacation: boolean;
//       vacationEndDate?: string;
//       returnDate?: string;
//       daysUntilReturn?: number;
//     };
//   };
//   recommendation: {
//     reason: string;
//     confidence: number; // 0-100
//     alternativeOptions?: Array<{
//       userId: string;
//       userName: string;
//       reason: string;
//       estimatedStartDate: string;
//     }>;
//     waitingBenefits?: {
//       daysSaved: number;
//       efficiencyGain: string;
//     };
//   };
//   metadata: {
//     priority: Priority;
//     durationDays: number;
//     generatedAt: string;
//     algorithm: 'smart-vacation-aware-assignment';
//     totalCompatibleUsers: number;
//     availableImmediately: number;
//     onVacation: number;
//   };
// }

// /**
//  * GET /api/tasks/suggestion/smart
//  * Obtiene sugerencia inteligente que considera vacaciones y carga de trabajo
//  * Query params: typeId, brandId, priority, durationDays
//  */
// export async function GET(req: Request) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const typeId = parseInt(searchParams.get('typeId') || '0');
//     const brandId = searchParams.get('brandId');
//     const priority = searchParams.get('priority') as Priority;
//     const durationDays = parseFloat(searchParams.get('durationDays') || '0');

//     // Validar parámetros requeridos
//     if (!typeId || typeId <= 0) {
//       return NextResponse.json({
//         error: 'typeId is required and must be a valid number greater than 0'
//       }, { status: 400 });
//     }

//     if (!durationDays || durationDays <= 0) {
//       return NextResponse.json({
//         error: 'durationDays is required and must be greater than 0'
//       }, { status: 400 });
//     }

//     const validPriorities: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
//     if (!validPriorities.includes(priority)) {
//       return NextResponse.json({
//         error: 'Valid priority is required',
//         validPriorities
//       }, { status: 400 });
//     }

//     console.log(`🧠 === SMART SUGGESTION ANALYSIS ===`);
//     console.log(`📋 Params: typeId=${typeId}, brandId=${brandId || 'global'}, priority=${priority}, duration=${durationDays} days`);

//     // Obtener usuarios compatibles con análisis completo
//     const compatibleUsers = await prisma.user.findMany({
//       where: { 
//         active: true,
//         roles: {
//           some: {
//             typeId: typeId,
//             OR: [
//               { brandId: brandId },
//               { brandId: null }
//             ]
//           }
//         }
//       },
//       include: {
//         roles: {
//           where: {
//             typeId: typeId,
//             OR: [
//               { brandId: brandId },
//               { brandId: null }
//             ]
//           }
//         },
//         vacations: {
//           where: {
//             endDate: {
//               gte: new Date()
//             }
//           }
//         }
//       }
//     });

//     if (compatibleUsers.length === 0) {
//       return NextResponse.json({
//         error: 'No compatible users found for this task type'
//       }, { status: 404 });
//     }

//     console.log(`👥 Analyzing ${compatibleUsers.length} compatible users`);

//     // Análisis detallado de cada usuario
//     const userAnalysis = await Promise.all(compatibleUsers.map(async (user) => {
//       // Verificar si es especialista
//       const matchingRoles = user.roles.filter(role => role.typeId === typeId);
//       const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

//       // Obtener carga de trabajo actual
//       const userTasks = await prisma.task.findMany({
//         where: {
//           assignees: { some: { userId: user.id } },
//           status: { notIn: ['COMPLETE'] }
//         },
//         orderBy: { queuePosition: 'asc' },
//         include: { category: true }
//       });

//       const currentWorkloadDays = userTasks.reduce((sum, task) => {
//         return sum + (task.customDuration !== null ? task.customDuration : task.category.duration);
//       }, 0);

//       // Calcular disponibilidad
//       let baseAvailableDate: Date;
//       if (userTasks.length > 0) {
//         const lastTask = userTasks[userTasks.length - 1];
//         baseAvailableDate = await getNextAvailableStart(new Date(lastTask.deadline));
//       } else {
//         baseAvailableDate = await getNextAvailableStart(new Date());
//       }

//       // Analizar vacaciones
//       const now = new Date();
//       const upcomingVacations = user.vacations.map(v => ({
//         startDate: new Date(v.startDate),
//         endDate: new Date(v.endDate)
//       }));

//       const currentVacation = upcomingVacations.find(vacation => 
//         vacation.startDate <= now && vacation.endDate >= now
//       );

//       // Verificar conflictos con timeline de tarea
//       const taskHours = durationDays * 8;
//       const potentialTaskEnd = await calculateWorkingDeadline(baseAvailableDate, taskHours);
      
//       let hasVacationConflict = false;
//       let conflictingVacation = null;

//       for (const vacation of upcomingVacations) {
//         const hasConflict = baseAvailableDate <= vacation.endDate && potentialTaskEnd >= vacation.startDate;
//         if (hasConflict) {
//           hasVacationConflict = true;
//           conflictingVacation = vacation;
//           break;
//         }
//       }

//       // Calcular fecha de regreso si está de vacaciones
//       let returnDate: Date | null = null;
//       let daysUntilReturn = 0;
      
//       if (currentVacation || conflictingVacation) {
//         const relevantVacation = currentVacation || conflictingVacation!;
//         const dayAfterVacation = new Date(relevantVacation.endDate);
//         dayAfterVacation.setDate(dayAfterVacation.getDate() + 1);
//         returnDate = await getNextAvailableStart(dayAfterVacation);
//         daysUntilReturn = Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
//       }

//       // Determinar estado
//       let status: 'available' | 'on_vacation' | 'overloaded';
//       if (currentVacation || hasVacationConflict) {
//         status = 'on_vacation';
//       } else if (currentWorkloadDays > 15) {
//         status = 'overloaded';
//       } else {
//         status = 'available';
//       }

//       return {
//         user,
//         isSpecialist,
//         status,
//         currentWorkloadDays,
//         baseAvailableDate,
//         hasVacationConflict,
//         currentVacation,
//         returnDate,
//         daysUntilReturn,
//         workingDaysUntilAvailable: Math.ceil((baseAvailableDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
//       };
//     }));

//     // Clasificar usuarios
//     const availableUsers = userAnalysis.filter(u => u.status === 'available');
//     const vacationUsers = userAnalysis.filter(u => u.status === 'on_vacation');
//     const overloadedUsers = userAnalysis.filter(u => u.status === 'overloaded');

//     console.log(`📊 User classification:`);
//     console.log(`   ✅ Available: ${availableUsers.length}`);
//     console.log(`   🏖️ On vacation: ${vacationUsers.length}`);
//     console.log(`   📈 Overloaded: ${overloadedUsers.length}`);

//     // Lógica de selección inteligente
//     let selectedUser: any = null;
//     let suggestionType: SmartSuggestionResponse['suggestionType'] = 'immediate';
//     let reason = '';
//     let confidence = 0;
//     let waitingBenefits: SmartSuggestionResponse['recommendation']['waitingBenefits'] = undefined;

//     // Prioridad 1: Usuarios disponibles inmediatamente
//     if (availableUsers.length > 0) {
//       console.log(`🎯 Found immediately available users, selecting best option`);
      
//       // Ordenar por: especialista > carga de trabajo menor > disponibilidad más temprana
//       const sortedAvailable = availableUsers.sort((a, b) => {
//         if (a.isSpecialist && !b.isSpecialist) return -1;
//         if (!a.isSpecialist && b.isSpecialist) return 1;
//         if (a.currentWorkloadDays !== b.currentWorkloadDays) return a.currentWorkloadDays - b.currentWorkloadDays;
//         return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
//       });

//       selectedUser = sortedAvailable[0];
//       suggestionType = 'immediate';
//       reason = `${selectedUser.isSpecialist ? 'Specialist' : 'Generalist'} available immediately with ${selectedUser.currentWorkloadDays} days current workload`;
//       confidence = 95;

//     } 
//     // Prioridad 2: Usuarios de vacaciones si la espera es beneficiosa
//     else if (vacationUsers.length > 0) {
//       console.log(`🏖️ No immediately available users, analyzing vacation options`);

//       // Encontrar usuarios de vacaciones que valga la pena esperar
//       const beneficialVacationUsers = vacationUsers.filter(user => {
//         if (!user.returnDate) return false;
        
//         // Comparar con usuarios sobrecargados
//         const bestOverloadedOption = overloadedUsers.length > 0 ? 
//           overloadedUsers.sort((a, b) => a.workingDaysUntilAvailable - b.workingDaysUntilAvailable)[0] : null;
        
//         if (!bestOverloadedOption) return true; // Si no hay otros, vale la pena esperar
        
//         const daysSaved = bestOverloadedOption.workingDaysUntilAvailable - user.daysUntilReturn;
//         return daysSaved > 5; // Solo si ahorra más de 5 días
//       });

//       if (beneficialVacationUsers.length > 0) {
//         // Seleccionar mejor opción de vacaciones
//         const sortedVacationUsers = beneficialVacationUsers.sort((a, b) => {
//           if (a.isSpecialist && !b.isSpecialist) return -1;
//           if (!a.isSpecialist && b.isSpecialist) return 1;
//           return a.daysUntilReturn - b.daysUntilReturn;
//         });

//         selectedUser = sortedVacationUsers[0];
//         suggestionType = 'wait_for_vacation_return';
        
//         const bestOverloadedOption = overloadedUsers.length > 0 ? 
//           overloadedUsers.sort((a, b) => a.workingDaysUntilAvailable - b.workingDaysUntilAvailable)[0] : null;
        
//         const daysSaved = bestOverloadedOption ? 
//           bestOverloadedOption.workingDaysUntilAvailable - selectedUser.daysUntilReturn : 0;

//         reason = `${selectedUser.isSpecialist ? 'Specialist' : 'Generalist'} returns from vacation in ${selectedUser.daysUntilReturn} days${daysSaved > 0 ? `, saving ${daysSaved} days vs other options` : ''}`;
//         confidence = daysSaved > 10 ? 90 : 75;
        
//         if (daysSaved > 0) {
//           waitingBenefits = {
//             daysSaved,
//             efficiencyGain: `${Math.round((daysSaved / selectedUser.daysUntilReturn) * 100)}% faster than alternatives`
//           };
//         }
//       }
//     }

//     // Prioridad 3: Distribución de carga entre usuarios sobrecargados
//     if (!selectedUser && overloadedUsers.length > 0) {
//       console.log(`📈 Using overloaded users as last resort`);
      
//       const sortedOverloaded = overloadedUsers.sort((a, b) => {
//         if (a.isSpecialist && !b.isSpecialist) return -1;
//         if (!a.isSpecialist && b.isSpecialist) return 1;
//         return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
//       });

//       selectedUser = sortedOverloaded[0];
//       suggestionType = 'overload_distribution';
//       reason = `${selectedUser.isSpecialist ? 'Specialist' : 'Generalist'} with least overload (${selectedUser.currentWorkloadDays} days workload)`;
//       confidence = 60;
//     }

//     if (!selectedUser) {
//       return NextResponse.json({
//         error: 'No suitable user found for assignment'
//       }, { status: 404 });
//     }

//     // Calcular fechas de la tarea
//     const effectiveStartDate = selectedUser.returnDate || selectedUser.baseAvailableDate;
//     const taskHours = durationDays * 8;
//     const effectiveEndDate = await calculateWorkingDeadline(effectiveStartDate, taskHours);

//     console.log(`✅ Selected: ${selectedUser.user.name} (${suggestionType})`);
//     console.log(`   Start: ${effectiveStartDate.toISOString().split('T')[0]}`);
//     console.log(`   End: ${effectiveEndDate.toISOString().split('T')[0]}`);
//     console.log(`   Reason: ${reason}`);

//     // Construir respuesta
//     const response: SmartSuggestionResponse = {
//       suggestedUserId: selectedUser.user.id,
//       suggestionType,
//       estimatedDurationHours: durationDays * 8,
//       estimatedDurationDays: durationDays,
//       userInfo: {
//         id: selectedUser.user.id,
//         name: selectedUser.user.name,
//         isSpecialist: selectedUser.isSpecialist,
//         status: selectedUser.status,
//         availableFrom: effectiveStartDate.toISOString().split('T')[0],
//         estimatedStartDate: effectiveStartDate.toISOString().split('T')[0],
//         estimatedEndDate: effectiveEndDate.toISOString().split('T')[0],
//         currentWorkloadDays: selectedUser.currentWorkloadDays,
//         vacationInfo: selectedUser.currentVacation || selectedUser.hasVacationConflict ? {
//           isOnVacation: !!selectedUser.currentVacation,
//           vacationEndDate: selectedUser.currentVacation?.endDate.toISOString().split('T')[0],
//           returnDate: selectedUser.returnDate?.toISOString().split('T')[0],
//           daysUntilReturn: selectedUser.daysUntilReturn > 0 ? selectedUser.daysUntilReturn : undefined
//         } : undefined
//       },
//       recommendation: {
//         reason,
//         confidence,
//         waitingBenefits
//       },
//       metadata: {
//         priority,
//         durationDays,
//         generatedAt: new Date().toISOString(),
//         algorithm: 'smart-vacation-aware-assignment',
//         totalCompatibleUsers: compatibleUsers.length,
//         availableImmediately: availableUsers.length,
//         onVacation: vacationUsers.length
//       }
//     };

//     return NextResponse.json(response);

//   } catch (error) {
//     console.error('❌ Error in smart suggestion:', error);
    
//     return NextResponse.json({
//       error: 'Internal server error in smart suggestion',
//       details: error instanceof Error ? error.message : 'Unknown error'
//     }, { status: 500 });
//   }
// }
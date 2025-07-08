/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { prisma } from '@/utils/prisma';
import { Priority, Status } from '@prisma/client';
import { UserSlot, UserWithRoles, Task, QueueCalculationResult, TaskTimingResult, UserVacation, VacationAwareUserSlot } from '@/interfaces';
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils'; // Removed shiftUserTasks import here
import { TASK_ASSIGNMENT_THRESHOLDS, CACHE_KEYS, WORK_HOURS } from '@/config';
import { getFromCache, setInCache } from '@/utils/cache';
import usHolidays from '@/data/usHolidays.json'

function getUSHolidays(startDate: Date, endDate: Date): Date[] {
  const holidays: Date[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  usHolidays.forEach(holiday => {
    const holidayDate = new Date(holiday.date + 'T00:00:00Z');
    if (holidayDate >= start && holidayDate <= end) {
      holidays.push(holidayDate);
    }
  });

  return holidays;
}

function calculateWorkingDaysBetween(startDate: Date, endDate: Date, excludeVacations: UserVacation[] = []): number {
  if (startDate >= endDate) return 0;

  let workingDays = 0;
  const current = new Date(startDate);
  const holidays = getUSHolidays(startDate, endDate);

  while (current < endDate) {
    const dayOfWeek = current.getUTCDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const isHoliday = holidays.some(holiday =>
        holiday.toISOString().split('T')[0] === current.toISOString().split('T')[0]
      );

      const isOnVacation = excludeVacations.some(vacation => {
        const vacStart = new Date(vacation.startDate);
        const vacEnd = new Date(vacation.endDate);
        return current >= vacStart && current <= vacEnd;
      });

      if (!isHoliday && !isOnVacation) {
        workingDays++;
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return workingDays;
}

function checkVacationConflict(
  taskStart: Date, 
  taskEnd: Date, 
  vacations: UserVacation[]
): { hasConflict: boolean; conflictingVacation?: UserVacation } {
  for (const vacation of vacations) {
    const vacStart = new Date(vacation.startDate);
    const vacEnd = new Date(vacation.endDate);
    
    if (taskStart <= vacEnd && taskEnd >= vacStart) {
      // ✅ ADD this logging:
      console.log(`❌ VACATION CONFLICT DETECTED:`, {
        taskPeriod: `${taskStart.toISOString().split('T')[0]} to ${taskEnd.toISOString().split('T')[0]}`,
        vacationPeriod: `${vacStart.toISOString().split('T')[0]} to ${vacEnd.toISOString().split('T')[0]}`,
        conflict: 'OVERLAP'
      });
      return { hasConflict: true, conflictingVacation: vacation };
    }
  }
  
  return { hasConflict: false };
}

async function getNextAvailableStartAfterVacations(
  baseDate: Date,
  vacations: UserVacation[],
  taskDurationDays: number = 0
): Promise<Date> {
  let availableDate = await getNextAvailableStart(baseDate);

  console.log(`🏖️ Checking vacation conflicts for task starting ${availableDate.toISOString().split('T')[0]} (${taskDurationDays} days duration)`);

  // Sort vacations by start date
  const sortedVacations = vacations.sort((a, b) =>
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  let adjusted = true;
  let maxIterations = 10; // Prevent infinite loops
  let iterations = 0;

  while (adjusted && iterations < maxIterations) {
    adjusted = false;
    iterations++;

    // ✅ CRITICAL: Calculate potential task end date considering duration
    const taskHours = taskDurationDays * 8;
    const potentialTaskEnd = taskDurationDays > 0
      ? await calculateWorkingDeadline(availableDate, taskHours)
      : availableDate;

    console.log(`   🎯 Iteration ${iterations}: Checking task ${availableDate.toISOString().split('T')[0]} to ${potentialTaskEnd.toISOString().split('T')[0]}`);

    for (const vacation of sortedVacations) {
      const vacStart = new Date(vacation.startDate);
      const vacEnd = new Date(vacation.endDate);

      console.log(`   📅 Against vacation: ${vacStart.toISOString().split('T')[0]} to ${vacEnd.toISOString().split('T')[0]}`);

      // ✅ CRITICAL: Check if task END would conflict, not just start
      const hasConflict = availableDate <= vacEnd && potentialTaskEnd >= vacStart;

      if (hasConflict) {
        // Move start date to after this vacation
        const dayAfterVacation = new Date(vacEnd);
        dayAfterVacation.setUTCDate(dayAfterVacation.getUTCDate() + 1);
        const newAvailableDate = await getNextAvailableStart(dayAfterVacation);

        console.log(`   ⚠️ Conflict detected! Moving start date from ${availableDate.toISOString().split('T')[0]} to ${newAvailableDate.toISOString().split('T')[0]}`);

        availableDate = newAvailableDate;
        adjusted = true;
        break; // Start over with new date
      }
    }
  }

  console.log(`✅ Final vacation-aware start date: ${availableDate.toISOString().split('T')[0]}`);
  return availableDate;
}

export async function findCompatibleUsers(typeId: number, brandId: string): Promise<UserWithRoles[]> {
  // The cache key still includes brandId because compatibility can depend on brand-specific roles
  const cacheKey = `${CACHE_KEYS.COMPATIBLE_USERS_PREFIX}${typeId}-${brandId}`;
  const compatibleUsers = getFromCache<UserWithRoles[]>(cacheKey);

  if (compatibleUsers) {
    return compatibleUsers;
  }

  const allUsersWithRoles = await prisma.user.findMany({
    where: { active: true },
    include: {
      roles: {
        where: {
          OR: [
            { brandId: brandId }, // Keep brandId filter for roles as compatibility can be brand-specific
            { brandId: null }
          ]
        }
      },
    },
  });

  const filteredUsers = allUsersWithRoles.filter(user =>
    user.roles.some(role => role.typeId === typeId)
  ) as UserWithRoles[];

  setInCache(cacheKey, filteredUsers);
  return filteredUsers;
}

export async function calculateUserSlots(
  users: UserWithRoles[],
  typeId: number,
  brandId: string,
  taskDurationDays?: number // ✅ Add optional duration parameter
): Promise<UserSlot[]> {
  const userIdsSorted = users.map(u => u.id).sort().join('-');
  const cacheKey = `${CACHE_KEYS.USER_SLOTS_PREFIX}${typeId}-${userIdsSorted}-${taskDurationDays || 0}`;
  const cachedUserSlots = getFromCache<UserSlot[]>(cacheKey);

  if (cachedUserSlots) {
    console.log(`💾 Using cached user slots for ${users.length} users`);
    return cachedUserSlots;
  }

  console.log(`\n🔍 === CALCULATING USER SLOTS (Duration: ${taskDurationDays || 0} days) ===`);

  const userIds = users.map(user => user.id);

  const allRelevantTasks = await prisma.task.findMany({
    where: {
      typeId: typeId,
      status: { notIn: [Status.COMPLETE] },
      assignees: { some: { userId: { in: userIds } } }
    },
    orderBy: { queuePosition: 'asc' },
    include: {
      category: { include: { type: true } },
      type: true,
      brand: true,
      assignees: { include: { user: true } }
    },
  }) as unknown as Task[];

  const tasksByUser: Record<string, Task[]> = {};
  for (const task of allRelevantTasks) {
    for (const assignee of task.assignees) {
      if (userIds.includes(assignee.userId)) {
        if (!tasksByUser[assignee.userId]) {
          tasksByUser[assignee.userId] = [];
        }
        tasksByUser[assignee.userId].push(task);
      }
    }
  }

  for (const userId in tasksByUser) {
    tasksByUser[userId].sort((a, b) => a.queuePosition - b.queuePosition);
  }

  const resultSlots = await Promise.all(users.map(async (user) => {
    console.log(`\n👤 Processing slot for ${user.name}:`);
    
    const userTasks = tasksByUser[user.id] || [];
    const cargaTotal = userTasks.length;
    let totalAssignedDurationDays = 0;

    let availableDate: Date;
    let lastTaskDeadline: Date | undefined;

    if (userTasks.length > 0) {
      const lastTask = userTasks[userTasks.length - 1];
      availableDate = await getNextAvailableStart(new Date(lastTask.deadline));
      lastTaskDeadline = new Date(lastTask.deadline);
      totalAssignedDurationDays = userTasks.reduce((sum, task) => {
        return sum + (task.customDuration !== null ? task.customDuration : task.category.duration);
      }, 0);
      console.log(`   📊 Has ${userTasks.length} tasks, available after: ${availableDate.toISOString().split('T')[0]}`);
    } else {
      availableDate = await getNextAvailableStart(new Date());
      console.log(`   ✅ Currently free, available from: ${availableDate.toISOString().split('T')[0]}`);
    }

    // ✅ CRITICAL: If duration is provided, check for vacation conflicts
    if (taskDurationDays && taskDurationDays > 0) {
      const userWithVacations = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          vacations: {
            where: { endDate: { gte: new Date() } }
          }
        }
      });

      if (userWithVacations?.vacations && userWithVacations.vacations.length > 0) {
        console.log(`   🏖️ Checking ${userWithVacations.vacations.length} upcoming vacations...`);
        
        const upcomingVacations: UserVacation[] = userWithVacations.vacations.map(v => ({
          id: v.id,
          userId: v.userId,
          startDate: new Date(v.startDate),
          endDate: new Date(v.endDate)
        }));

        // Check if task would conflict with vacations
        const taskHours = taskDurationDays * 8;
        const potentialTaskEnd = await calculateWorkingDeadline(availableDate, taskHours);
        
        let hasConflict = false;
        for (const vacation of upcomingVacations) {
          const vacStart = new Date(vacation.startDate);
          const vacEnd = new Date(vacation.endDate);
          
          if (availableDate <= vacEnd && potentialTaskEnd >= vacStart) {
            console.log(`   ❌ Vacation conflict detected: task (${availableDate.toISOString().split('T')[0]} to ${potentialTaskEnd.toISOString().split('T')[0]}) vs vacation (${vacStart.toISOString().split('T')[0]} to ${vacEnd.toISOString().split('T')[0]})`);
            hasConflict = true;
            break;
          }
        }

        // ✅ If conflict found, adjust available date to after vacations
        if (hasConflict) {
          console.log(`   🔄 Adjusting date due to vacation conflicts...`);
          availableDate = await getNextAvailableStartAfterVacations(
            availableDate,
            upcomingVacations,
            taskDurationDays
          );
          console.log(`   ✅ Adjusted available date: ${availableDate.toISOString().split('T')[0]}`);
        }
      }
    }

    const matchingRoles = user.roles.filter(role => role.typeId === typeId);
    const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

    return {
      userId: user.id,
      userName: user.name,
      availableDate, // ✅ This is now vacation-aware
      tasks: userTasks,
      cargaTotal,
      isSpecialist,
      lastTaskDeadline,
      totalAssignedDurationDays,
    };
  }));

  setInCache(cacheKey, resultSlots);
  return resultSlots;
}

async function getVacationAwareUserSlots(
  typeId: number, 
  brandId: string,
  taskDurationDays: number
): Promise<VacationAwareUserSlot[]> {
  console.log(`🏖️ === VACATION FILTERING FOR ${taskDurationDays}-DAY TASK ===`);
  console.log(`📋 Will EXCLUDE users with vacation conflicts instead of adjusting dates`);
  
  const allUsersWithRoles = await prisma.user.findMany({
    where: { active: true },
    include: {
      roles: {
        where: {
          OR: [
            { brandId: brandId },
            { brandId: null }
          ]
        }
      },
      vacations: {
        where: {
          endDate: {
            gte: new Date() // Only future/current vacations
          }
        }
      }
    },
  });

  const compatibleUsers = allUsersWithRoles.filter(user =>
    user.roles.some(role => role.typeId === typeId)
  );

  console.log(`👥 Found ${compatibleUsers.length} compatible users for type ${typeId}`);

  const userIds = compatibleUsers.map(user => user.id);
  const allRelevantTasks = await prisma.task.findMany({
    where: {
      typeId: typeId,
      status: { notIn: [Status.COMPLETE] },
      assignees: { some: { userId: { in: userIds } } }
    },
    orderBy: { queuePosition: 'asc' },
    include: {
      category: { include: { type: true } },
      type: true,
      brand: true,
      assignees: { include: { user: true } }
    },
  }) as unknown as Task[];

  const tasksByUser: Record<string, Task[]> = {};
  for (const task of allRelevantTasks) {
    for (const assignee of task.assignees) {
      if (userIds.includes(assignee.userId)) {
        if (!tasksByUser[assignee.userId]) {
          tasksByUser[assignee.userId] = [];
        }
        tasksByUser[assignee.userId].push(task);
      }
    }
  }

  for (const userId in tasksByUser) {
    tasksByUser[userId].sort((a, b) => a.queuePosition - b.queuePosition);
  }

  const eligibleSlots: VacationAwareUserSlot[] = [];
  const excludedUsers: Array<{name: string, reason: string, vacations: string[]}> = [];
  
  for (const user of compatibleUsers) {
    console.log(`\n👤 Evaluating ${user.name} (${user.id})`);
    
    const userTasks = tasksByUser[user.id] || [];
    const upcomingVacations: UserVacation[] = user.vacations.map(v => ({
      id: v.id,
      userId: v.userId,
      startDate: new Date(v.startDate),
      endDate: new Date(v.endDate)
    }));

    console.log(`   🏖️ Upcoming vacations: ${upcomingVacations.length}`);
    upcomingVacations.forEach(vacation => {
      const days = Math.ceil((vacation.endDate.getTime() - vacation.startDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`     - ${vacation.startDate.toISOString().split('T')[0]} to ${vacation.endDate.toISOString().split('T')[0]} (${days} days)`);
    });

    // Calculate when user would be available
    let baseAvailableDate: Date;
    let totalAssignedDurationDays = 0;
    
    if (userTasks.length > 0) {
      const lastTask = userTasks[userTasks.length - 1];
      baseAvailableDate = await getNextAvailableStart(new Date(lastTask.deadline));
      totalAssignedDurationDays = userTasks.reduce((sum, task) => {
        return sum + (task.customDuration !== null ? task.customDuration : task.category.duration);
      }, 0);
      console.log(`   📊 Current workload: ${userTasks.length} tasks, ${totalAssignedDurationDays} days total`);
      console.log(`   📅 Available after current tasks: ${baseAvailableDate.toISOString().split('T')[0]}`);
    } else {
      baseAvailableDate = await getNextAvailableStart(new Date());
      console.log(`   ✅ User is currently free, available from: ${baseAvailableDate.toISOString().split('T')[0]}`);
    }

    // ✅ CRITICAL: Calculate task timeline to check for vacation conflicts
    const taskHours = taskDurationDays * 8;
    const potentialTaskEnd = await calculateWorkingDeadline(baseAvailableDate, taskHours);

    console.log(`   🎯 Potential task timeline (before vacation check):`);
    console.log(`     Start: ${baseAvailableDate.toISOString().split('T')[0]}`);
    console.log(`     End: ${potentialTaskEnd.toISOString().split('T')[0]}`);
    console.log(`     Duration: ${taskDurationDays} days`);

    // ✅ Check for vacation conflicts - EXCLUDE if any conflicts found
    let hasAnyVacationConflict = false;
    let conflictDetails: string[] = [];
    
    for (const vacation of upcomingVacations) {
      const vacStart = new Date(vacation.startDate);
      const vacEnd = new Date(vacation.endDate);
      
      // Check if task would overlap with vacation
      const hasConflict = baseAvailableDate <= vacEnd && potentialTaskEnd >= vacStart;
      
      if (hasConflict) {
        hasAnyVacationConflict = true;
        conflictDetails.push(`${vacStart.toISOString().split('T')[0]} to ${vacEnd.toISOString().split('T')[0]}`);
        console.log(`   ❌ VACATION CONFLICT: Task (${baseAvailableDate.toISOString().split('T')[0]} to ${potentialTaskEnd.toISOString().split('T')[0]}) overlaps with vacation (${vacStart.toISOString().split('T')[0]} to ${vacEnd.toISOString().split('T')[0]})`);
      }
    }

    // ✅ EXCLUDE users with vacation conflicts
    if (hasAnyVacationConflict) {
      const matchingRoles = user.roles.filter(role => role.typeId === typeId);
      const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;
      
      excludedUsers.push({
        name: user.name,
        reason: `Vacation conflict - ${isSpecialist ? 'Specialist' : 'Generalist'}`,
        vacations: conflictDetails
      });
      
      console.log(`   🚫 EXCLUDED: ${user.name} due to vacation conflicts`);
      continue; // Skip this user completely
    }

    // ✅ User has no conflicts - include in eligible list
    console.log(`   ✅ ELIGIBLE: ${user.name} - no vacation conflicts detected`);

    const workingDaysUntilAvailable = calculateWorkingDaysBetween(
      new Date(),
      baseAvailableDate,
      upcomingVacations
    );

    const matchingRoles = user.roles.filter(role => role.typeId === typeId);
    const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

    const vacationAwareSlot: VacationAwareUserSlot = {
      userId: user.id,
      userName: user.name,
      availableDate: baseAvailableDate,
      tasks: userTasks,
      cargaTotal: userTasks.length,
      isSpecialist,
      lastTaskDeadline: userTasks.length > 0 ? new Date(userTasks[userTasks.length - 1].deadline) : undefined,
      upcomingVacations,
      potentialTaskStart: baseAvailableDate,
      potentialTaskEnd: potentialTaskEnd,
      hasVacationConflict: false, // Only eligible users reach here
      workingDaysUntilAvailable,
      vacationConflictDetails: undefined,
      totalAssignedDurationDays,
    };

    console.log(`   📊 Final assessment for ${user.name}:`);
    console.log(`     🎯 Specialist: ${isSpecialist ? 'YES' : 'NO'}`);
    console.log(`     ⚖️ Duration load: ${totalAssignedDurationDays} days`);
    console.log(`     📅 Available: ${baseAvailableDate.toISOString().split('T')[0]}`);

    eligibleSlots.push(vacationAwareSlot);
  }

  // ✅ Log exclusion summary
  console.log(`\n🚫 === USERS EXCLUDED DUE TO VACATIONS ===`);
  if (excludedUsers.length === 0) {
    console.log(`✅ No users excluded - all users available`);
  } else {
    excludedUsers.forEach(excluded => {
      console.log(`❌ ${excluded.name}: ${excluded.reason}`);
      excluded.vacations.forEach(vacation => {
        console.log(`   📅 Conflicting vacation: ${vacation}`);
      });
    });
  }

  console.log(`\n✅ === ELIGIBLE USERS (${eligibleSlots.length}) ===`);
  eligibleSlots.forEach(slot => {
    console.log(`✅ ${slot.userName}: ${slot.isSpecialist ? 'Specialist' : 'Generalist'}, available ${slot.availableDate.toISOString().split('T')[0]}, load: ${slot.totalAssignedDurationDays} days`);
  });

  return eligibleSlots;
}

async function selectBestUserWithVacationLogic(
  userSlots: VacationAwareUserSlot[]
): Promise<VacationAwareUserSlot | null> {
  if (userSlots.length === 0) {
    console.log(`❌ No users available - all users excluded due to vacation conflicts`);
    return null;
  }

  console.log(`\n🏆 === SELECTING BEST USER FROM ${userSlots.length} ELIGIBLE USERS ===`);

  const specialists = userSlots.filter(slot => slot.isSpecialist);
  const generalists = userSlots.filter(slot => !slot.isSpecialist);

  console.log(`   🎯 Specialists available: ${specialists.length}`);
  console.log(`   🔧 Generalists available: ${generalists.length}`);

  // Sort by duration load first, then by availability
  const sortUsers = (users: VacationAwareUserSlot[]) => {
    return users.sort((a, b) => {
      if (a.totalAssignedDurationDays !== b.totalAssignedDurationDays) {
        return a.totalAssignedDurationDays - b.totalAssignedDurationDays;
      }
      return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
    });
  };

  const sortedSpecialists = sortUsers(specialists);
  const sortedGeneralists = sortUsers(generalists);

  const bestSpecialist = sortedSpecialists.length > 0 ? sortedSpecialists[0] : null;
  const bestGeneralist = sortedGeneralists.length > 0 ? sortedGeneralists[0] : null;

  // Prefer specialists unless they have significantly higher load
  if (bestSpecialist && bestGeneralist) {
    const durationDifference = bestSpecialist.totalAssignedDurationDays - bestGeneralist.totalAssignedDurationDays;
    
    if (durationDifference > TASK_ASSIGNMENT_THRESHOLDS.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST) {
      console.log(`🔧 Selecting generalist due to specialist overload (${durationDifference} days difference)`);
      console.log(`   Selected: ${bestGeneralist.userName} (${bestGeneralist.totalAssignedDurationDays} days load)`);
      return bestGeneralist;
    } else {
      console.log(`🎯 Selecting specialist with manageable load`);
      console.log(`   Selected: ${bestSpecialist.userName} (${bestSpecialist.totalAssignedDurationDays} days load)`);
      return bestSpecialist;
    }
  }

  if (bestSpecialist) {
    console.log(`🎯 Selecting only available specialist: ${bestSpecialist.userName}`);
    return bestSpecialist;
  }

  if (bestGeneralist) {
    console.log(`🔧 Selecting only available generalist: ${bestGeneralist.userName}`);
    return bestGeneralist;
  }

  console.log(`❌ No users available for assignment`);
  return null;
}

export function selectBestUser(userSlots: UserSlot[]): UserSlot | null {
  const specialists = userSlots.filter(slot => slot.isSpecialist)
  const generalists = userSlots.filter(slot => !slot.isSpecialist)

  const sortUsers = (users: UserSlot[]) => {
    // <--- MODIFIED: Sort by totalAssignedDurationDays first, then by availableDate
    return users.sort((a, b) => {
      if (a.totalAssignedDurationDays !== b.totalAssignedDurationDays) return a.totalAssignedDurationDays - b.totalAssignedDurationDays; // Primary sort
      return a.availableDate.getTime() - b.availableDate.getTime(); // Secondary sort
    })
  }

  const sortedSpecialists = sortUsers(specialists)
  const sortedGeneralists = sortUsers(generalists)

  const bestSpecialist: UserSlot | null = sortedSpecialists.length > 0 ? sortedSpecialists[0] : null
  const bestGeneralist: UserSlot | null = sortedGeneralists.length > 0 ? sortedGeneralists[0] : null

  if (!bestSpecialist) {
    return bestGeneralist;
  }
  if (!bestGeneralist) {
    return bestSpecialist;
  }

  // The deadline difference logic here is still about when they become free,
  // which might still be relevant even with duration-based balancing.
  let effectiveSpecialistDeadline: Date;
  if (bestSpecialist.tasks.length > 0 && bestSpecialist.lastTaskDeadline) {
    effectiveSpecialistDeadline = bestSpecialist.lastTaskDeadline;
  } else {
    effectiveSpecialistDeadline = bestSpecialist.availableDate;
  }

  let effectiveGeneralistDeadline: Date;
  if (bestGeneralist.tasks.length > 0 && bestGeneralist.lastTaskDeadline) {
    effectiveGeneralistDeadline = bestGeneralist.lastTaskDeadline;
  } else {
    effectiveGeneralistDeadline = bestGeneralist.availableDate;
  }

  const deadlineDifferenceDays = (effectiveSpecialistDeadline.getTime() - effectiveGeneralistDeadline.getTime()) / (1000 * 60 * 60 * 24);

  if (deadlineDifferenceDays > TASK_ASSIGNMENT_THRESHOLDS.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST) {
    return bestGeneralist;
  }

  return bestSpecialist;
}

export async function getBestUserWithCache(
  typeId: number, 
  brandId: string, 
  priority: Priority,
  durationDays?: number
): Promise<UserSlot | null> {
  
  console.log(`\n🎯 === GET BEST USER WITH VACATION CACHE ===`);
  console.log(`📋 Params: typeId=${typeId}, brandId=${brandId}, priority=${priority}, duration=${durationDays}`);
  
  const cacheKey = `${CACHE_KEYS.BEST_USER_SELECTION_PREFIX}${typeId}-${brandId}-${priority}-vacation-${durationDays || 'no-duration'}`;
  let bestSlot = getFromCache<UserSlot | null>(cacheKey);

  if (bestSlot !== undefined) {
    console.log(`💾 Using cached result for user: ${bestSlot?.userName || 'null'}`);
    return bestSlot;
  }

  // ✅ CRITICAL: Use vacation-aware slots that exclude conflicted users
  console.log(`🏖️ Calculating vacation-aware user slots...`);
  const vacationAwareSlots = await getVacationAwareUserSlots(typeId, brandId, durationDays || 0);
  const bestVacationSlot = await selectBestUserWithVacationLogic(vacationAwareSlots);
  
  if (!bestVacationSlot) {
    console.log(`❌ No eligible users found after vacation filtering`);
    setInCache(cacheKey, null);
    return null;
  }
  
  // ✅ Convert vacation-aware slot to regular UserSlot format
  const compatibleSlot: UserSlot = {
    userId: bestVacationSlot.userId,
    userName: bestVacationSlot.userName,
    availableDate: bestVacationSlot.availableDate, // ✅ This is vacation-aware!
    tasks: bestVacationSlot.tasks,
    cargaTotal: bestVacationSlot.cargaTotal,
    isSpecialist: bestVacationSlot.isSpecialist,
    lastTaskDeadline: bestVacationSlot.lastTaskDeadline,
    totalAssignedDurationDays: bestVacationSlot.totalAssignedDurationDays
  };

  console.log(`✅ Selected vacation-aware user: ${compatibleSlot.userName}`);
  console.log(`   📅 Available from: ${compatibleSlot.availableDate.toISOString().split('T')[0]}`);
  console.log(`   🎯 Is specialist: ${compatibleSlot.isSpecialist}`);

  setInCache(cacheKey, compatibleSlot);
  return compatibleSlot;
}

interface QueueAnalysis {
  urgentCount: number
  highCount: number
  normalCount: number
  lowCount: number
  lastUrgentIndex: number
  lastHighIndex: number
  firstNormalIndex: number
  firstLowIndex: number
  nonUrgentHighCount: number
  nonUrgentNormalCount: number
}

function analyzeQueueByPriority(tasks: Task[]): QueueAnalysis {
  const analysis: QueueAnalysis = {
    urgentCount: 0,
    highCount: 0,
    normalCount: 0,
    lowCount: 0,
    lastUrgentIndex: -1,
    lastHighIndex: -1,
    firstNormalIndex: -1,
    firstLowIndex: -1,
    nonUrgentHighCount: 0,
    nonUrgentNormalCount: 0
  }

  tasks.forEach((task, index) => {
    switch (task.priority) {
      case 'URGENT':
        analysis.urgentCount++
        analysis.lastUrgentIndex = index
        break
      case 'HIGH':
        analysis.highCount++
        analysis.lastHighIndex = index
        // Solo contar HIGH después de la zona URGENT
        if (analysis.lastUrgentIndex === -1 || index > analysis.lastUrgentIndex) {
          analysis.nonUrgentHighCount++
        }
        break
      case 'NORMAL':
        analysis.normalCount++
        if (analysis.firstNormalIndex === -1) {
          analysis.firstNormalIndex = index
        }
        // Solo contar NORMAL después de la zona URGENT
        if (analysis.lastUrgentIndex === -1 || index > analysis.lastUrgentIndex) {
          analysis.nonUrgentNormalCount++
        }
        break
      case 'LOW':
        analysis.lowCount++
        if (analysis.firstLowIndex === -1) {
          analysis.firstLowIndex = index
        }
        break
    }
  })

  return analysis
}

function isLowTaskInWaitingPeriod(task: Task): boolean {
  const now = new Date();
  const taskCreationTime = new Date(task.createdAt);

  const workingHoursElapsed = calculateWorkingHoursBetween(taskCreationTime, now);

  return workingHoursElapsed < 8;
}

function calculateWorkingHoursBetween(startDate: Date, endDate: Date): number {
  let totalHours = 0;
  const current = new Date(startDate);

  while (current < endDate) {
    const day = current.getUTCDay();

    if (day === 0 || day === 6) {
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(WORK_HOURS.START, 0, 0, 0);
      continue;
    }

    const dayStart = new Date(current);
    dayStart.setUTCHours(WORK_HOURS.START, 0, 0, 0);

    const dayEnd = new Date(current);
    dayEnd.setUTCHours(WORK_HOURS.END, 0, 0, 0);

    if (current < dayStart) {
      current.setTime(dayStart.getTime());
    }

    if (current >= dayEnd) {
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(WORK_HOURS.START, 0, 0, 0);
      continue;
    }

    const effectiveEndTime = endDate < dayEnd ? endDate : dayEnd;

    const lunchStart = new Date(current);
    lunchStart.setUTCHours(WORK_HOURS.LUNCH_START, 0, 0, 0);

    const lunchEnd = new Date(current);
    lunchEnd.setUTCHours(WORK_HOURS.LUNCH_END, 0, 0, 0);

    if (current < lunchStart) {
      const beforeLunchEnd = effectiveEndTime < lunchStart ? effectiveEndTime : lunchStart;
      totalHours += (beforeLunchEnd.getTime() - current.getTime()) / (1000 * 60 * 60);

      if (effectiveEndTime > lunchEnd && beforeLunchEnd >= lunchStart) {
        const afterLunchStart = effectiveEndTime < lunchEnd ? effectiveEndTime : lunchEnd;
        totalHours += (effectiveEndTime.getTime() - afterLunchStart.getTime()) / (1000 * 60 * 60);
      }
    } else if (current >= lunchEnd) {
      totalHours += (effectiveEndTime.getTime() - current.getTime()) / (1000 * 60 * 60);
    }

    current.setUTCDate(current.getUTCDate() + 1);
    current.setUTCHours(WORK_HOURS.START, 0, 0, 0);
  }

  return totalHours;
}

async function calculateNormalPriorityPosition(userSlot: UserSlot): Promise<number> {
  // Los NORMAL van al final natural, después de toda la lógica de intercalado
  // Pero respetando las reglas con LOW

  let insertAt = userSlot.tasks.length // Por defecto al final

  // Buscar posición respetando lógica con LOW (mantener lógica existente)
  for (let i = userSlot.tasks.length - 1; i >= 0; i--) {
    const currentTask = userSlot.tasks[i]

    if (currentTask.priority === 'LOW') {
      // Aplicar lógica existente para LOW
      let normalTasksBeforeThisLow = 0
      for (let j = 0; j < i; j++) {
        if (userSlot.tasks[j].priority === 'NORMAL') {
          normalTasksBeforeThisLow++
        }
      }

      if (normalTasksBeforeThisLow < TASK_ASSIGNMENT_THRESHOLDS.NORMAL_TASKS_BEFORE_LOW_THRESHOLD) {
        insertAt = i
        break
      }
      insertAt = i + 1
    }
  }

  return insertAt
}

async function calculateLowPriorityPosition(userSlot: UserSlot): Promise<QueueCalculationResult> {
  let insertAt = userSlot.tasks.length
  let calculatedStartDate: Date
  const affectedTasks: Task[] = []

  let lastLowInWaitingPeriodIndex = -1

  for (let i = userSlot.tasks.length - 1; i >= 0; i--) {
    const task = userSlot.tasks[i]
    if (task.priority === 'LOW' && isLowTaskInWaitingPeriod(task)) {
      lastLowInWaitingPeriodIndex = i
      break
    }
  }

  if (lastLowInWaitingPeriodIndex !== -1) {
    insertAt = lastLowInWaitingPeriodIndex + 1
  } else {
    let consecutiveLowCount = 0
    for (let i = userSlot.tasks.length - 1; i >= 0; i--) {
      if (userSlot.tasks[i].priority === 'LOW') {
        consecutiveLowCount++
      } else {
        break
      }
    }

    if (consecutiveLowCount < TASK_ASSIGNMENT_THRESHOLDS.CONSECUTIVE_LOW_TASKS_THRESHOLD) {
      insertAt = userSlot.tasks.length
    } else {
      insertAt = userSlot.tasks.length - consecutiveLowCount
    }
  }

  calculatedStartDate = userSlot.availableDate

  return {
    insertAt,
    calculatedStartDate,
    affectedTasks
  }
}

export async function calculateQueuePosition(userSlot: UserSlot, priority: Priority): Promise<QueueCalculationResult> {
  let insertAt = 0
  let calculatedStartDate: Date
  const affectedTasks: Task[] = []

  const queueAnalysis = analyzeQueueByPriority(userSlot.tasks)

  switch (priority) {
    case 'URGENT':
      insertAt = queueAnalysis.lastUrgentIndex + 1

      // ✅ CORRECCIÓN: Calcular fecha basada en la posición de inserción
      if (insertAt === 0) {
        // Si es la primera URGENT, empieza ahora
        calculatedStartDate = await getNextAvailableStart(new Date())
      } else {
        // Si va después de otras URGENT, empieza cuando termina la URGENT anterior
        const previousTask = userSlot.tasks[insertAt - 1]
        calculatedStartDate = await getNextAvailableStart(new Date(previousTask.deadline))
      }

      affectedTasks.push(...userSlot.tasks.slice(insertAt))
      break

    case 'HIGH':
      insertAt = calculateHighInterleavedPosition(userSlot.tasks, queueAnalysis)

      // ✅ La lógica de HIGH ya está correcta
      if (insertAt === 0) {
        calculatedStartDate = await getNextAvailableStart(new Date())
      } else {
        const previousTask = userSlot.tasks[insertAt - 1]
        calculatedStartDate = await getNextAvailableStart(new Date(previousTask.deadline))
      }

      affectedTasks.push(...userSlot.tasks.slice(insertAt))
      break

    case 'NORMAL':
      insertAt = await calculateNormalPriorityPosition(userSlot)
      calculatedStartDate = userSlot.availableDate
      break

    case 'LOW':
      return await calculateLowPriorityPosition(userSlot)

    default:
      insertAt = userSlot.tasks.length
      calculatedStartDate = userSlot.availableDate
  }

  return {
    insertAt,
    calculatedStartDate,
    affectedTasks
  }
}

function calculateHighInterleavedPosition(tasks: Task[], queueAnalysis: QueueAnalysis): number {
  // Si no hay tareas, HIGH va en posición 0
  if (tasks.length === 0) {
    return 0
  }

  // Si solo hay URGENT, HIGH va después de todos los URGENT
  if (queueAnalysis.urgentCount === tasks.length) {
    return queueAnalysis.lastUrgentIndex + 1
  }

  // Buscar la zona no-URGENT para intercalar (después de todos los URGENT)
  const nonUrgentStartIndex = queueAnalysis.lastUrgentIndex + 1

  // Si no hay URGENT, empezamos desde el inicio
  const startIndex = queueAnalysis.urgentCount > 0 ? nonUrgentStartIndex : 0

  // Contar HIGH existentes después de los URGENT para saber qué posición toca
  let existingHighCount = 0
  for (let i = startIndex; i < tasks.length; i++) {
    if (tasks[i].priority === 'HIGH') {
      existingHighCount++
    }
  }

  // La nueva HIGH debe ir en la posición: (existingHighCount + 1)
  // Esto significa que si hay 0 HIGH, va en posición 1 (después del primer NORMAL)
  // Si hay 1 HIGH, va en posición 3 (después del segundo NORMAL), etc.
  const targetPosition = existingHighCount + 1

  // Contar NORMAL desde el inicio de la zona no-URGENT
  let normalCount = 0

  for (let i = startIndex; i < tasks.length; i++) {
    // Si encontramos un NORMAL, incrementar el contador
    if (tasks[i].priority === 'NORMAL') {
      normalCount++

      // Si hemos visto suficientes NORMAL para nuestra posición objetivo
      if (normalCount === targetPosition) {
        // Insertar después de este NORMAL
        return i + 1
      }
    }
  }

  // Si no hay suficientes NORMAL para el patrón, insertar al final
  return tasks.length
}

/**
 * ✅ FUNCIÓN AUXILIAR MEJORADA: Analiza la cola con más detalle
 */
interface QueueAnalysis {
  urgentCount: number
  highCount: number
  normalCount: number
  lowCount: number
  lastUrgentIndex: number
  lastHighIndex: number
  firstNormalIndex: number
  firstLowIndex: number
  // Nuevos campos para patrón cebra
  nonUrgentHighCount: number  // HIGH después de los URGENT
  nonUrgentNormalCount: number // NORMAL después de los URGENT
}

export async function processUserAssignments(
  usersToAssign: string[],
  userSlots: UserSlot[],
  priority: Priority,
  durationDays: number,
  brandId: string
): Promise<TaskTimingResult> {
  console.log(`\n🎯 === PROCESSING USER ASSIGNMENTS WITH VACATION AWARENESS ===`);
  console.log(`📋 Users to assign: ${usersToAssign.join(', ')}`);
  console.log(`⏰ Task duration: ${durationDays} days`);
  console.log(`🔥 Priority: ${priority}`);

  const numberOfAssignees = usersToAssign.length
  const effectiveDuration = durationDays / numberOfAssignees
  const newTaskHours = effectiveDuration * 8

  let earliestStartDate = new Date()
  let latestDeadline = new Date()
  let primaryInsertAt = 0

  for (const userId of usersToAssign) {
    const userSlot = userSlots.find(slot => slot.userId === userId)

    if (!userSlot) {
      console.warn(`⚠️ User slot not found for ${userId}, using fallback logic`);
      continue
    }

    console.log(`\n👤 Processing assignment for ${userSlot.userName}:`);
    console.log(`   📅 Slot available date: ${userSlot.availableDate.toISOString().split('T')[0]}`);
    console.log(`   📊 Current workload: ${userSlot.cargaTotal} tasks`);

    // ✅ CRITICAL: Use the vacation-aware available date from the slot
    const userStartDate = userSlot.availableDate; // This already considers vacations!
    const userDeadline = await calculateWorkingDeadline(userStartDate, newTaskHours);

    console.log(`   🎯 Calculated timeline:`);
    console.log(`     Start: ${userStartDate.toISOString().split('T')[0]}`);
    console.log(`     End: ${userDeadline.toISOString().split('T')[0]}`);

    // Calculate queue position for this user
    const queueResult = await calculateQueuePosition(userSlot, priority);
    console.log(`   📍 Queue position: ${queueResult.insertAt}`);

    if (userId === usersToAssign[0]) {
      earliestStartDate = userStartDate
      latestDeadline = userDeadline
      primaryInsertAt = queueResult.insertAt
      console.log(`   🥇 Primary user - setting global dates from this user`);
    } else {
      if (userStartDate < earliestStartDate) {
        earliestStartDate = userStartDate
        console.log(`   ⬅️ Earlier start date found, updating global start`);
      }
      if (userDeadline > latestDeadline) {
        latestDeadline = userDeadline
        console.log(`   ➡️ Later deadline found, updating global deadline`);
      }
    }
  }

  console.log(`\n✅ Final task timing (vacation-aware):`);
  console.log(`   🚀 Start: ${earliestStartDate.toISOString().split('T')[0]}`);
  console.log(`   🏁 Deadline: ${latestDeadline.toISOString().split('T')[0]}`);
  console.log(`   📍 Queue position: ${primaryInsertAt}`);

  return {
    startDate: earliestStartDate,
    deadline: latestDeadline,
    insertAt: primaryInsertAt
  }
}

export async function getTaskHours(taskId: string): Promise<number> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      category: true,
      type: true,
      assignees: {
        include: {
          user: true
        }
      }
    },
  });

  if (!task) throw new Error('Tarea no encontrada');
  if (!task.assignees.length) throw new Error('Tarea sin asignaciones');

  return task.customDuration !== null ? task.customDuration * 8 : task.category.duration * 8;
}
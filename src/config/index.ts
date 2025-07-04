export const WORK_HOURS = {
  START: 15,
  LUNCH_START: 19,
  LUNCH_END: 20,
  END: 24,
}

export const TASK_ASSIGNMENT_THRESHOLDS = {
  DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST: 10,
  NORMAL_TASKS_BEFORE_LOW_THRESHOLD: 5,
  CONSECUTIVE_LOW_TASKS_THRESHOLD: 4
}

export const API_CONFIG = {
  CLICKUP_API_BASE: 'https://api.clickup.com/api/v2',
  SOCKET_EMITTER_URL: 'https://task-automation-zeta.vercel.app/api/socket_emitter'
}

export const CACHE_KEYS = {
  COMPATIBLE_USERS_PREFIX: 'compatibleUsers-',
  USER_SLOTS_PREFIX: 'userSlots-',
  BEST_USER_SELECTION_PREFIX: 'bestUserSelection-'
}
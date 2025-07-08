// src/utils/task-assignment-cache.ts - Cache invalidation utilities
import { invalidateCacheByPrefix, invalidateAllCache } from '@/utils/cache';

/**
 * Invalidates all task assignment related cache when user roles change
 */
export function invalidateTaskAssignmentCache(): void {
  console.log('🗑️ Invalidating task assignment cache...');
  
  // Invalidate specific cache prefixes used by task assignment
  invalidateCacheByPrefix('compatibleUsers-');
  invalidateCacheByPrefix('userSlots-');
  invalidateCacheByPrefix('bestUserSelection-');
  
  console.log('✅ Task assignment cache invalidated');
}

/**
 * Invalidates vacation-aware cache when user vacations change
 */
export function invalidateVacationAwareCache(): void {
  console.log('🏖️ Invalidating vacation-aware cache...');
  
  // Invalidate vacation-related cache
  invalidateCacheByPrefix('bestUserSelection-');
  invalidateCacheByPrefix('userSlots-');
  
  console.log('✅ Vacation-aware cache invalidated');
}

/**
 * Invalidates user compatibility cache when user roles change
 */
export function invalidateUserCompatibilityCache(): void {
  console.log('👥 Invalidating user compatibility cache...');
  
  // Invalidate user compatibility cache
  invalidateCacheByPrefix('compatibleUsers-');
  invalidateCacheByPrefix('bestUserSelection-');
  
  console.log('✅ User compatibility cache invalidated');
}

/**
 * Comprehensive cache invalidation for major changes
 */
export function invalidateAllTaskRelatedCache(): void {
  console.log('🧹 Performing comprehensive cache invalidation...');
  
  invalidateAllCache();
  
  console.log('✅ All task-related cache invalidated');
}
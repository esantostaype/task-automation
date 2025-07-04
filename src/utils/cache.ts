// src/utils/cache.ts
import NodeCache from 'node-cache';

// Configuración de la caché:
// stdTTL: tiempo de vida por defecto en segundos para los elementos (ej. 5 minutos).
// checkperiod: intervalo en segundos para eliminar claves expiradas (ej. 1 minuto).
const appCache = new NodeCache({ stdTTL: 60 * 5, checkperiod: 60 * 1 });

/**
 * Obtiene un valor de la caché.
 * @param key La clave del elemento a obtener.
 * @returns El valor cacheados o `undefined` si no se encuentra.
 */
export const getFromCache = <T>(key: string): T | undefined => {
  return appCache.get<T>(key);
};

/**
 * Establece un valor en la caché.
 * @param key La clave para almacenar el valor.
 * @param value El valor a almacenar.
 * @param ttlSeconds (Opcional) Tiempo de vida específico para este elemento en segundos.
 * @returns `true` si el valor fue establecido, `false` de lo contrario.
 */
export const setInCache = <T>(key: string, value: T, ttlSeconds?: number): boolean => {
  if (ttlSeconds !== undefined) {
    return appCache.set(key, value, ttlSeconds);
  }
  return appCache.set(key, value);
};

/**
 * Elimina uno o más elementos de la caché por su clave.
 * @param key La clave (o un array de claves) de los elementos a eliminar.
 * @returns El número de elementos eliminados.
 */
export const deleteFromCache = (key: string | string[]): number => {
  return appCache.del(key);
};

/**
 * Invalida todos los elementos de la caché.
 */
export const invalidateAllCache = (): void => {
  appCache.flushAll();
  console.log('Cache: All items invalidated.');
};

/**
 * Invalida elementos de la caché que comienzan con un prefijo dado.
 * @param prefix El prefijo de las claves a invalidar.
 */
export const invalidateCacheByPrefix = (prefix: string): void => {
  const keys = appCache.keys();
  const keysToDelete = keys.filter(key => key.startsWith(prefix));
  if (keysToDelete.length > 0) {
    appCache.del(keysToDelete);
    console.log(`Cache: ${keysToDelete.length} items invalidated with prefix "${prefix}"`);
  }
};
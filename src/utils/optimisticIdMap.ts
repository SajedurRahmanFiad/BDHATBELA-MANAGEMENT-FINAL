/**
 * Centralized optimistic ID mapping.
 * 
 * Instead of scattering `temp-${Date.now()}` throughout code,
 * this module maintains a single source of truth:
 * - When creating an optimistic object, generate a stable temp ID here
 * - When server responds with real ID, replace temp→real in this map
 * - UI queries check the map to see if temp ID has been replaced
 * 
 * Benefits:
 * - Consistent behavior across all entity types
 * - Easy to debug/audit (single file, clear logic)
 * - Prevents "orphaned" temp IDs
 */

const tempToRealIdMap = new Map<string, string>();
const realToTempIdMap = new Map<string, string>();
// Resolvers waiting for a tempId to be replaced with a real id
const waiters = new Map<string, Array<(realId: string) => void>>();

/**
 * Generate a stable optimistic (temporary) ID.
 * These follow pattern: `__temp_${entityType}_${uuid}__`
 */
export function generateTempId(entityType: string = 'item'): string {
  return `__temp_${entityType}_${crypto.randomUUID()}__`;
}

/**
 * Register the pairing of temp ID → real ID.
 * Call this when server confirms creation and returns real ID.
 */
export function registerRealId(tempId: string, realId: string): void {
  console.log(`[optimisticIdMap] Mapping ${tempId} → ${realId}`);
  tempToRealIdMap.set(tempId, realId);
  realToTempIdMap.set(realId, tempId);
  const arr = waiters.get(tempId);
  if (arr && arr.length) {
    arr.forEach(fn => {
      try { fn(realId); } catch (e) { /* ignore */ }
    });
    waiters.delete(tempId);
  }
}

/**
 * Look up if a temp ID has been replaced with a real ID.
 * Returns the real ID if registered, otherwise returns the temp ID unchanged.
 */
export function getRealId(idOrTempId: string): string {
  if (!idOrTempId) return idOrTempId;
  const real = tempToRealIdMap.get(idOrTempId);
  return real || idOrTempId;
}

/**
 * Check if an ID is a temporary ID (not yet confirmed by server).
 */
export function isTempId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('__temp_');
}

/**
 * Clear the mapping (e.g., on logout, or for testing).
 */
export function clearOptimisticMap(): void {
  tempToRealIdMap.clear();
  realToTempIdMap.clear();
  waiters.clear();
  console.log('[optimisticIdMap] Cleared all mappings');
}

/**
 * Debug: dump current mappings to console
 */
export function dumpOptimisticMap(): void {
  console.log('[optimisticIdMap] Current mappings:', {
    tempToReal: Array.from(tempToRealIdMap.entries()),
    realToTemp: Array.from(realToTempIdMap.entries()),
  });
}

/**
 * Wait for a tempId to be registered with a real id.
 * Resolves with the real id, or null on timeout.
 */
export function waitForRealId(tempId: string, timeoutMs: number = 5000): Promise<string | null> {
  if (!tempId) return Promise.resolve(null);
  const existing = tempToRealIdMap.get(tempId);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const resolver = (realId: string) => resolve(realId);
    const list = waiters.get(tempId) || [];
    list.push(resolver);
    waiters.set(tempId, list);

    const t = setTimeout(() => {
      // remove resolver from list
      const cur = waiters.get(tempId) || [];
      const filtered = cur.filter(fn => fn !== resolver);
      if (filtered.length) waiters.set(tempId, filtered);
      else waiters.delete(tempId);
      resolve(null);
    }, timeoutMs);

    // ensure if resolved earlier we clear the timer
    const wrapped = (realId: string) => {
      clearTimeout(t);
      resolve(realId);
    };

    // replace last pushed resolver with wrapped so timer cleared when invoked
    const curList = waiters.get(tempId) || [];
    curList[curList.length - 1] = wrapped;
    waiters.set(tempId, curList);
  });
}

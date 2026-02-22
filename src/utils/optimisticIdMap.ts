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

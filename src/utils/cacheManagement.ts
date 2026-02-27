import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Cache key generator for orders pagination
 * 
 * Usage:
 * - Browsing (no search): getCacheKey('browsing', page) => ['orders', page]
 * - Search: getCacheKey('search', page, term) => ['orders-search', term, page]
 */
export function getCacheKey(
  mode: 'browsing' | 'search',
  page?: number,
  searchTerm?: string
): QueryKey {
  if (mode === 'search' && searchTerm) {
    return ['orders-search', searchTerm, page || 1];
  }
  return ['orders', page || 1];
}

/**
 * Determines if we're in search mode based on active search term
 */
export function isSearchMode(searchTerm?: string): boolean {
  return !!(searchTerm && searchTerm.trim());
}

/**
 * Type for paginated order response
 */
export interface OrdersPageData {
  data: any[];
  count: number;
}

/**
 * Manually inject a new order into the cached first page
 * Only call this if:
 * - No search is active (browsing mode)
 * - The order should appear at the top (ORDER BY created_at DESC)
 * - The order matches any active filters (status, date range, etc.)
 * 
 * This ensures the UI reflects the new order immediately without refetching
 */
export function injectOrderIntoFirstPage(
  queryClient: QueryClient,
  newOrder: any,
  mode: 'browsing' | 'search',
  searchTerm?: string,
  pageSize: number = 25,
  shouldInclude?: (order: any) => boolean
): void {
  // Don't mutate cache if searching
  if (isSearchMode(searchTerm)) {
    return;
  }

  // Get the current cached first page
  const cacheKey = getCacheKey('browsing', 1);
  const currentData = queryClient.getQueryData<OrdersPageData>(cacheKey);

  if (!currentData) {
    return;
  }

  // Check if the order should be included (e.g., matches status filter)
  if (shouldInclude && !shouldInclude(newOrder)) {
    return;
  }

  // Inject at the top (orders are fetched in DESC created_at order)
  const updatedData = {
    data: [newOrder, ...currentData.data.slice(0, pageSize - 1)],
    count: currentData.count + 1,
  };

  // Update the cache
  queryClient.setQueryData<OrdersPageData>(cacheKey, updatedData);
}

/**
 * Invalidate all order-related caches
 * Use after operations that affect order list (delete, bulk updates, etc.)
 */
export function invalidateOrdersCaches(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    queryKey: ['orders'],
    exact: false,
  });
  queryClient.invalidateQueries({
    queryKey: ['orders-search'],
    exact: false,
  });
}

/**
 * Invalidate specific search cache
 * Use when filter conditions change but we want to keep browsing cache intact
 */
export function invalidateSearchCache(queryClient: QueryClient, searchTerm?: string): void {
  if (!searchTerm) {
    return;
  }
  queryClient.invalidateQueries({
    queryKey: ['orders-search', searchTerm],
    exact: false,
  });
}

/**
 * Prefetch the next page of orders
 * Improves perceived performance when user navigates pages
 */
export function prefetchNextPage(
  queryClient: QueryClient,
  fetchFn: (page: number, pageSize?: number, filters?: any) => Promise<OrdersPageData>,
  currentPage: number,
  pageSize: number = 25,
  mode: 'browsing' | 'search' = 'browsing',
  searchTerm?: string,
  filters?: any
): void {
  const nextPage = currentPage + 1;
  const cacheKey = getCacheKey(mode, nextPage, searchTerm);

  // Only prefetch if not already cached
  const existing = queryClient.getQueryData<OrdersPageData>(cacheKey);
  if (existing) {
    return;
  }

  queryClient.prefetchQuery({
    queryKey: cacheKey,
    queryFn: () => {
      if (mode === 'search') {
        return fetchFn(nextPage, pageSize, { ...filters, search: searchTerm });
      }
      return fetchFn(nextPage, pageSize, filters);
    },
  });
}

/**
 * Update a single order in all relevant caches
 * Use after updating an order to keep all cached lists in sync
 */
export function updateOrderInAllCaches(
  queryClient: QueryClient,
  updatedOrder: any
): void {
  // Update in browsing cache
  const browsingCaches = queryClient.getQueriesData({
    queryKey: ['orders'],
  });

  browsingCaches.forEach(([cacheKey, data]: any) => {
    if (!data || !data.data) return;
    const updated = data.data.map((o: any) => o.id === updatedOrder.id ? updatedOrder : o);
    queryClient.setQueryData(cacheKey, { ...data, data: updated });
  });

  // Update in search caches
  const searchCaches = queryClient.getQueriesData({
    queryKey: ['orders-search'],
  });

  searchCaches.forEach(([cacheKey, data]: any) => {
    if (!data || !data.data) return;
    const updated = data.data.map((o: any) => o.id === updatedOrder.id ? updatedOrder : o);
    queryClient.setQueryData(cacheKey, { ...data, data: updated });
  });
}

/**
 * Remove an order from all relevant caches
 * Use after deleting an order to keep all cached lists in sync
 */
export function removeOrderFromAllCaches(
  queryClient: QueryClient,
  orderId: string
): void {
  // Remove from browsing caches
  const browsingCaches = queryClient.getQueriesData({
    queryKey: ['orders'],
  });

  browsingCaches.forEach(([cacheKey, data]: any) => {
    if (!data || !data.data) return;
    const filtered = data.data.filter((o: any) => o.id !== orderId);
    queryClient.setQueryData(cacheKey, { 
      ...data, 
      data: filtered,
      count: Math.max(0, data.count - 1),
    });
  });

  // Remove from search caches
  const searchCaches = queryClient.getQueriesData({
    queryKey: ['orders-search'],
  });

  searchCaches.forEach(([cacheKey, data]: any) => {
    if (!data || !data.data) return;
    const filtered = data.data.filter((o: any) => o.id !== orderId);
    queryClient.setQueryData(cacheKey, { 
      ...data, 
      data: filtered,
      count: Math.max(0, data.count - 1),
    });
  });
}

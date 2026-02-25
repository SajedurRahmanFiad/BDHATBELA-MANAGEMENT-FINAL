import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createOrder,
  updateOrder,
  deleteOrder,
  createBill,
  updateBill,
  deleteBill,
  createAccount,
  updateAccount,
  deleteAccount,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createUser,
  updateUser,
  deleteUser,
  createVendor,
  updateVendor,
  deleteVendor,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  updateCategory,
  deleteCategory,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  createUnit,
  updateUnit,
  deleteUnit,
  updateCompanySettings,
  updateOrderSettings,
  updateInvoiceSettings,
  updateSystemDefaults,
  updateCourierSettings,
  batchUpdateSettings,
} from '../services/supabaseQueries';
import { DEFAULT_PAGE_SIZE } from '../services/supabaseQueries';
import type { Customer, Order, Bill, Account, Transaction, User, Vendor, Product } from '../../types';
import { generateTempId, registerRealId, isTempId } from '../utils/optimisticIdMap';

// ========== CUSTOMERS ==========

export function useCreateCustomer(): UseMutationResult<Customer, Error, Partial<Customer>, unknown> {
  const queryClient = useQueryClient();
  const patchCustomerPages = (newCust: Customer) => {
    // Update page 1 if cached
    const page1 = queryClient.getQueryData<any>(['customers', 1]);
    if (page1 && Array.isArray(page1.data)) {
      queryClient.setQueryData(['customers', 1], { ...page1, data: [newCust, ...page1.data].slice(0, DEFAULT_PAGE_SIZE), count: (page1.count || 0) + 1 });
    } else {
      // no-op fallback: do not invalidate entire page; creation is handled deterministically elsewhere
    }
  };
  return useMutation({
    mutationFn: createCustomer,
    onMutate: async (newCustomer) => {
      // Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['customers'] });
      
      // Snapshot previous data
      const previousCustomers = queryClient.getQueryData<Customer[]>(['customers']);
      
      // Optimistically add to list with stable temp ID
      if (previousCustomers) {
        const tempId = generateTempId('customer');
        const optimisticCustomer = {
          ...newCustomer,
          id: tempId,
        } as Customer;
        queryClient.setQueryData(['customers'], [...previousCustomers, optimisticCustomer]);

        // Also patch paginated page 1 if present so components reading ['customers', 1] update immediately
        const custPage1 = queryClient.getQueryData<any>(['customers', 1]);
        if (custPage1 && Array.isArray(custPage1.data)) {
          queryClient.setQueryData(['customers', 1], { ...custPage1, data: [optimisticCustomer, ...custPage1.data].slice(0, DEFAULT_PAGE_SIZE), count: (custPage1.count || 0) + 1 });
        }

        return { previousCustomers, tempId, optimisticCustomer };
      }
      return { previousCustomers };
    },
    onError: (err, newCustomer, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers'], context.previousCustomers);
      }
    },
    onSuccess: async (data: Customer, _variables, context) => {
      // Register tempId mapping if present
      try {
        if (context?.tempId) registerRealId(context.tempId, data.id);
      } catch (e) {}

      // Update detail cache
      queryClient.setQueryData(['customer', data.id], data);

      // Replace optimistic entries in non-paginated list
      try {
        const prev = queryClient.getQueryData<Customer[]>(['customers']) || [];
        const cleaned = (prev || []).filter(c => !isTempId(String(c.id)));
        if (!cleaned.some(c => c.id === data.id)) {
          queryClient.setQueryData(['customers'], [data, ...cleaned]);
        } else {
          queryClient.setQueryData(['customers'], cleaned.map(c => c.id === data.id ? data : c));
        }
      } catch (e) {}

      // Deterministically patch cached first pages for customers respecting filters (no invalidation)
      const pages = queryClient.getQueriesData({ queryKey: ['customers'] });
      pages.forEach(([key, value]) => {
        try {
          const k = key as any[];
          if (k[1] !== 1) return;
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            const filters = k[2] as any | undefined;
            const matches = (() => {
              if (!filters) return true;
              if (filters.search) {
                const q = String(filters.search).trim().toLowerCase();
                if (q) {
                  const v = String(data.name || '') + ' ' + String(data.phone || '') + ' ' + String(data.address || '');
                  if (!v.toLowerCase().includes(q)) return false;
                }
              }
              return true;
            })();
            if (matches) {
              queryClient.setQueryData(key as any, { ...(value as any), data: [data, ...((value as any).data)].slice(0, DEFAULT_PAGE_SIZE), count: (value as any).count ? (value as any).count + 1 : 1 });
            }
          }
        } catch (e) {}
      });
    },
  });
}

export function useUpdateCustomer(): UseMutationResult<Customer, Error, { id: string; updates: Partial<Customer> }, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateCustomer(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['customers'] });
      await queryClient.cancelQueries({ queryKey: ['customer', id] });
      
      // Snapshot previous data
      const previousCustomers = queryClient.getQueryData<Customer[]>(['customers']);
      const previousCustomer = queryClient.getQueryData<Customer>(['customer', id]);
      
      // Optimistically update list
      if (previousCustomers) {
        queryClient.setQueryData(['customers'], 
          previousCustomers.map(c => c.id === id ? { ...c, ...updates } : c)
        );
      }
      
      // Optimistically update detail view
      if (previousCustomer) {
        queryClient.setQueryData(['customer', id], { ...previousCustomer, ...updates });
      }
      
      return { previousCustomers, previousCustomer };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers'], context.previousCustomers);
      }
      if (context?.previousCustomer) {
        queryClient.setQueryData(['customer', variables.id], context.previousCustomer);
      }
    },
    onSuccess: (data) => {
      // Patch paginated customer pages in-place to avoid full refetch
      const pages = queryClient.getQueriesData({ queryKey: ['customers'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            queryClient.setQueryData(key as any, { ...(value as any), data: (value as any).data.map((c: any) => c.id === data.id ? data : c) });
          }
        } catch (e) {
          // ignore per-page patch errors
        }
      });
      queryClient.setQueryData(['customer', data.id], data);
    },
  });
}

export function useDeleteCustomer(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomer,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['customers'] });
      
      // Snapshot previous data
      const previousCustomers = queryClient.getQueryData<Customer[]>(['customers']);
      
      // Optimistically remove from list
      if (previousCustomers) {
        queryClient.setQueryData(['customers'], previousCustomers.filter(c => c.id !== id));
      }
      
      return { previousCustomers };
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers'], context.previousCustomers);
      }
    },
    onSuccess: (_data, id) => {
      // Remove deleted customer from paginated caches and try to maintain page size by pulling from next cached page
      const pages = queryClient.getQueriesData({ queryKey: ['customers'] });
      const pageMap = new Map<string, any>();
      pages.forEach(([key, value]) => {
        const k = key as any[];
        const pageNum = k[1];
        // Skip non-paginated queries (e.g., ['customers'] without page number)
        if (typeof pageNum !== 'number' || !Number.isInteger(pageNum)) return;
        const filters = k[k.length - 1];
        pageMap.set(JSON.stringify([pageNum, filters]), { key: k, value });
      });

      const keys = Array.from(pageMap.keys()).sort((a, b) => JSON.parse(a)[0] - JSON.parse(b)[0]);
      for (const mapKey of keys) {
        const entry = pageMap.get(mapKey);
        if (!entry) continue;
        const { key: k, value } = entry;
        try {
          if (value && value.data && Array.isArray(value.data)) {
            const filtered = value.data.filter((c: any) => c.id !== id);
            const pageNum = k[1] as number;
            const filters = k[k.length - 1];
            const nextKey = JSON.stringify([pageNum + 1, filters]);
            const nextEntry = pageMap.get(nextKey);
            if (nextEntry && nextEntry.value && Array.isArray(nextEntry.value.data) && nextEntry.value.data.length > 0) {
              const shiftItem = nextEntry.value.data[0];
              nextEntry.value.data = nextEntry.value.data.slice(1);
              filtered.push(shiftItem);
              queryClient.setQueryData(nextEntry.key as any, { ...(nextEntry.value), data: nextEntry.value.data, count: Math.max(0, (nextEntry.value.count || 1) - 1) });
            }
            queryClient.setQueryData(k as any, { ...(value), data: filtered, count: Math.max(0, (value.count || 1) - 1) });
          }
        } catch (e) {}
      }
    },
  });
}

// ========== ORDERS ==========

export function useCreateOrder(): UseMutationResult<Order, Error, Omit<Order, 'id'>, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (order) => createOrder(order),
    onMutate: async (newOrder) => {
      // Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      
      // Get the current orders list
      const previousOrders = queryClient.getQueryData<Order[]>(['orders']) || [];
      
      // Create optimistic order with stable temp ID
      const tempId = generateTempId('order');
      const optimisticOrder: Order = {
        ...newOrder,
        id: tempId,
        paidAmount: newOrder.paidAmount || 0,
      } as Order;
      
      // Optimistically add to the top of the list (newest first)
      queryClient.setQueryData(['orders'], [optimisticOrder, ...previousOrders]);

      // Also patch paginated page 1 if cached so components using ['orders', 1] show the optimistic order immediately
      const ordersPage1 = queryClient.getQueryData<any>(['orders', 1]);
      if (ordersPage1 && Array.isArray(ordersPage1.data)) {
        queryClient.setQueryData(['orders', 1], { ...ordersPage1, data: [optimisticOrder, ...ordersPage1.data].slice(0, DEFAULT_PAGE_SIZE), count: (ordersPage1.count || 0) + 1 });
      }
      
      return { previousOrders, optimisticOrder, tempId };
    },
    onError: (err, newOrder, context) => {
      // Rollback to previous data on error
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
    },
    onSuccess: async (data, variables, context) => {
      // Register the mapping of temp ID → real ID
      if (context?.tempId) {
        registerRealId(context.tempId, data.id);
      }

      // Cache the newly created order for immediate access in details view
      queryClient.setQueryData(['order', data.id], data);

      // Patch cached first pages for orders deterministically (no blind invalidation)
      const pages = queryClient.getQueriesData({ queryKey: ['orders'] });
      let patchedAny = false;
      pages.forEach(([key, value]) => {
        try {
          const k = key as any[];
          // Only modify first page entries (page index === 1)
          if (k[1] !== 1) return;
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            // If filters are present in the key (e.g., k[2]) verify the created row matches
            const filters = k[2] as any | undefined;
            const matchesFilters = (() => {
              if (!filters) return true;
              // Basic checks mirroring fetchOrdersPage: status, from, to, search, createdByIds
              if (filters.status && filters.status !== 'All' && data.status !== filters.status) return false;
              if (filters.from && data.orderDate < filters.from) return false;
              if (filters.to && data.orderDate > filters.to) return false;
              if (filters.search) {
                const q = String(filters.search).trim().toLowerCase();
                if (q && !String(data.orderNumber || '').toLowerCase().includes(q)) return false;
              }
              if (filters.createdByIds && Array.isArray(filters.createdByIds) && filters.createdByIds.length > 0) {
                if (!filters.createdByIds.includes(data.createdBy)) return false;
              }
              return true;
            })();

            if (matchesFilters) {
              queryClient.setQueryData(key as any, { ...(value as any), data: [data, ...((value as any).data)].slice(0, DEFAULT_PAGE_SIZE), count: (value as any).count ? (value as any).count + 1 : 1 });
              patchedAny = true;
            }
          }
        } catch (e) {
          // ignore per-page patch errors
        }
      });

      // Best-effort: increment nextNumber in settings locally for optimistic UI
      // If the created order had a higher number, use that; otherwise just increment current
      try {
        const currentSettings = queryClient.getQueryData<{ prefix: string; nextNumber: number }>(['settings', 'order']);
        if (currentSettings) {
          // Extract numeric part from created order number and use next value
          const match = (data.orderNumber || '').match(/(\d+)$/);
          if (match) {
            const createdNum = parseInt(match[1], 10);
            const nextNum = Math.max(createdNum + 1, currentSettings.nextNumber);
            queryClient.setQueryData(['settings', 'order'], { ...currentSettings, nextNumber: nextNum });
          } else {
            // Fallback: just increment
            queryClient.setQueryData(['settings', 'order'], { ...currentSettings, nextNumber: currentSettings.nextNumber + 1 });
          }
        }
      } catch (err) {
        console.error('Failed to locally update order settings:', err);
      }

      // No global refetches or invalidations: we've deterministically updated cached first pages where possible.
    },
  });
}

export function useUpdateOrder(): UseMutationResult<Order, Error, { id: string; updates: Partial<Order> }, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateOrder(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      await queryClient.cancelQueries({ queryKey: ['order', id] });
      await queryClient.cancelQueries({ queryKey: ['ordersByCustomerId'] });
      
      // Snapshot previous data
      const previousOrders = queryClient.getQueryData<Order[]>(['orders']);
      const previousOrder = queryClient.getQueryData<Order>(['order', id]);
      
      // Update all related query caches
      if (previousOrders) {
        queryClient.setQueryData(['orders'], 
          previousOrders.map(o => o.id === id ? { ...o, ...updates } : o)
        );
      }
      
      if (previousOrder) {
        queryClient.setQueryData(['order', id], { ...previousOrder, ...updates });
      }
      
      // Update customer-specific orders if cached
      if (previousOrder?.customerId) {
        const customerOrders = queryClient.getQueryData<Order[]>(['ordersByCustomerId', previousOrder.customerId]);
        if (customerOrders) {
          queryClient.setQueryData(
            ['ordersByCustomerId', previousOrder.customerId],
            customerOrders.map(o => o.id === id ? { ...o, ...updates } : o)
          );
        }
      }
      
      return { previousOrders, previousOrder };
    },
    onError: (err, variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      if (context?.previousOrder) {
        queryClient.setQueryData(['order', variables.id], context.previousOrder);
      }
    },
    onSuccess: (data) => {
      // Update any cached paginated order pages in-place to avoid full refetch
      const pages = queryClient.getQueriesData({ queryKey: ['orders'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            queryClient.setQueryData(key as any, { ...(value as any), data: (value as any).data.map((o: any) => o.id === data.id ? data : o) });
          }
        } catch (e) {
          // ignore per-page patch errors
        }
      });

      // Update detail cache deterministically
      queryClient.setQueryData(['order', data.id], data);

      // No blind refetches: pages and detail were updated in-place.
    },
  });
}

export function useDeleteOrder(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteOrder,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      
      // Snapshot previous data
      const previousOrders = queryClient.getQueryData<Order[]>(['orders']);
      
      // Optimistically remove
      if (previousOrders) {
        queryClient.setQueryData(['orders'], previousOrders.filter(o => o.id !== id));
      }
      
      return { previousOrders };
    },
    onError: (err, id, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
    },
    onSuccess: (_data, id) => {
      // Remove deleted order from any cached paginated pages and try to maintain page size by pulling from next cached page
      const pages = queryClient.getQueriesData({ queryKey: ['orders'] });
      // Build a map of pages by page number + filters key so we can pull from next page
      const pageMap = new Map<string, any>();
      pages.forEach(([key, value]) => {
        const k = key as any[];
        const pageNum = k[1];
        // Skip non-paginated queries (e.g., ['orders'] without page number)
        if (typeof pageNum !== 'number' || !Number.isInteger(pageNum)) return;
        const filters = k[k.length - 1];
        const mapKey = JSON.stringify([pageNum, filters]);
        pageMap.set(mapKey, { key: k, value });
      });

      // Iterate pages in ascending page number order to remove and pull
      const keys = Array.from(pageMap.keys()).sort((a, b) => {
        const pa = JSON.parse(a)[0] as number;
        const pb = JSON.parse(b)[0] as number;
        return pa - pb;
      });

      for (const mapKey of keys) {
        const entry = pageMap.get(mapKey);
        if (!entry) continue;
        const { key: k, value } = entry;
        try {
          if (value && value.data && Array.isArray(value.data)) {
            // Remove the deleted id
            const filtered = value.data.filter((o: any) => o.id !== id);
            // If we have a next page cached, and filtered length < page size, try to pull first from next
            const pageNum = k[1] as number;
            const filters = k[k.length - 1];
            const nextKey = JSON.stringify([pageNum + 1, filters]);
            const nextEntry = pageMap.get(nextKey);
            if (nextEntry && nextEntry.value && Array.isArray(nextEntry.value.data) && nextEntry.value.data.length > 0) {
              const shiftItem = nextEntry.value.data[0];
              // remove from next
              nextEntry.value.data = nextEntry.value.data.slice(1);
              // append to current page to maintain page size
              filtered.push(shiftItem);
              // write back next page
              queryClient.setQueryData(nextEntry.key as any, { ...(nextEntry.value), data: nextEntry.value.data, count: Math.max(0, (nextEntry.value.count || 1) - 1) });
            }

            // write current page
            queryClient.setQueryData(k as any, { ...(value), data: filtered, count: Math.max(0, (value.count || 1) - 1) });
          }
        } catch (e) {
          // ignore per-page patch errors
        }
      }
    },
  });
}

// ========== BILLS ==========

export function useCreateBill(): UseMutationResult<Bill, Error, Omit<Bill, 'id'>, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBill,
    onMutate: async (newBill) => {
      // Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['bills'] });
      
      // Get the current bills list
      const previousBills = queryClient.getQueryData<Bill[]>(['bills']) || [];
      
      // Create optimistic bill with temp ID (will be replaced after server response)
      const optimisticBill: Bill = {
        ...newBill,
        id: `temp-${Date.now()}`, // Temporary ID for optimistic update
        paidAmount: newBill.paidAmount || 0,
      } as Bill;
      
      // Optimistically add to the top of the list (newest first)
      queryClient.setQueryData(['bills'], [optimisticBill, ...previousBills]);

      // Also patch paginated page 1 if cached so components using ['bills', 1] show it instantly
      const billsPage1 = queryClient.getQueryData<any>(['bills', 1]);
      if (billsPage1 && Array.isArray(billsPage1.data)) {
        queryClient.setQueryData(['bills', 1], { ...billsPage1, data: [optimisticBill, ...billsPage1.data].slice(0, DEFAULT_PAGE_SIZE), count: (billsPage1.count || 0) + 1 });
      }
      
      return { previousBills, optimisticBill };
    },
    onError: (err, newBill, context) => {
      // Rollback to previous data on error
      if (context?.previousBills) {
        queryClient.setQueryData(['bills'], context.previousBills);
      }
    },
    onSuccess: async (data, _variables, context) => {
      // Register temp id mapping and cache the newly created bill for immediate access in details view
      try {
        if ((context as any)?.optimisticBill?.id) {
          registerRealId((context as any).optimisticBill.id, data.id);
        }
      } catch (e) {}
      queryClient.setQueryData(['bill', data.id], data);

      // Clean optimistic temp entries from non-paginated bills list
      try {
        const prev = queryClient.getQueryData<Bill[]>(['bills']) || [];
        const cleaned = (prev || []).filter(b => !String(b.id).startsWith('temp-'));
        if (!cleaned.some(b => b.id === data.id)) queryClient.setQueryData(['bills'], [data, ...cleaned]);
        else queryClient.setQueryData(['bills'], cleaned.map(b => b.id === data.id ? data : b));
      } catch (e) {}

      // Deterministically patch cached first pages for bills (no invalidation)
      const pages = queryClient.getQueriesData({ queryKey: ['bills'] });
      pages.forEach(([key, value]) => {
        try {
          const k = key as any[];
          if (k[1] !== 1) return;
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            queryClient.setQueryData(key as any, { ...(value as any), data: [data, ...((value as any).data)].slice(0, DEFAULT_PAGE_SIZE), count: (value as any).count ? (value as any).count + 1 : 1 });
          }
        } catch (e) {}
      });
    },
  });
}

export function useUpdateBill(): UseMutationResult<Bill, Error, { id: string; updates: Partial<Bill> }, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateBill(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['bills'] });
      await queryClient.cancelQueries({ queryKey: ['bill', id] });
      
      // Snapshot previous data
      const previousBills = queryClient.getQueryData<Bill[]>(['bills']);
      const previousBill = queryClient.getQueryData<Bill>(['bill', id]);
      
      // Update optimistically
      if (previousBills) {
        queryClient.setQueryData(['bills'], 
          previousBills.map(b => b.id === id ? { ...b, ...updates } : b)
        );
      }
      
      if (previousBill) {
        queryClient.setQueryData(['bill', id], { ...previousBill, ...updates });
      }
      
      return { previousBills, previousBill };
    },
    onError: (err, variables, context) => {
      if (context?.previousBills) {
        queryClient.setQueryData(['bills'], context.previousBills);
      }
      if (context?.previousBill) {
        queryClient.setQueryData(['bill', variables.id], context.previousBill);
      }
    },
    onSuccess: (data) => {
      // Update any cached paginated bills pages in-place to avoid full refetch
      const pages = queryClient.getQueriesData({ queryKey: ['bills'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            queryClient.setQueryData(key as any, { ...(value as any), data: (value as any).data.map((b: any) => b.id === data.id ? data : b) });
          }
        } catch (e) {
          // ignore per-page patch errors
        }
      });
      queryClient.invalidateQueries({ queryKey: ['bill', data.id] });
    },
  });
}

export function useDeleteBill(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBill,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['bills'] });
      
      // Snapshot previous data
      const previousBills = queryClient.getQueryData<Bill[]>(['bills']);
      
      // Optimistically remove
      if (previousBills) {
        queryClient.setQueryData(['bills'], previousBills.filter(b => b.id !== id));
      }
      
      return { previousBills };
    },
    onError: (err, id, context) => {
      if (context?.previousBills) {
        queryClient.setQueryData(['bills'], context.previousBills);
      }
    },
    onSuccess: (_data, id) => {
      // Remove deleted bill from paginated caches and try to maintain page size by pulling from next cached page
      const pages = queryClient.getQueriesData({ queryKey: ['bills'] });
      const pageMap = new Map<string, any>();
      pages.forEach(([key, value]) => {
        const k = key as any[];
        const pageNum = k[1];
        // Skip non-paginated queries (e.g., ['bills'] without page number)
        if (typeof pageNum !== 'number' || !Number.isInteger(pageNum)) return;
        const filters = k[k.length - 1];
        pageMap.set(JSON.stringify([pageNum, filters]), { key: k, value });
      });

      const keys = Array.from(pageMap.keys()).sort((a, b) => JSON.parse(a)[0] - JSON.parse(b)[0]);
      for (const mapKey of keys) {
        const entry = pageMap.get(mapKey);
        if (!entry) continue;
        const { key: k, value } = entry;
        try {
          if (value && value.data && Array.isArray(value.data)) {
            const filtered = value.data.filter((b: any) => b.id !== id);
            const pageNum = k[1] as number;
            const filters = k[k.length - 1];
            const nextKey = JSON.stringify([pageNum + 1, filters]);
            const nextEntry = pageMap.get(nextKey);
            if (nextEntry && nextEntry.value && Array.isArray(nextEntry.value.data) && nextEntry.value.data.length > 0) {
              const shiftItem = nextEntry.value.data[0];
              nextEntry.value.data = nextEntry.value.data.slice(1);
              filtered.push(shiftItem);
              queryClient.setQueryData(nextEntry.key as any, { ...(nextEntry.value), data: nextEntry.value.data, count: Math.max(0, (nextEntry.value.count || 1) - 1) });
            }
            queryClient.setQueryData(k as any, { ...(value), data: filtered, count: Math.max(0, (value.count || 1) - 1) });
          }
        } catch (e) {}
      }
    },
  });
}

// ========== ACCOUNTS ==========

export function useCreateAccount(): UseMutationResult<Account, Error, Partial<Account>, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAccount,
    onMutate: async (newAccount) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['accounts'] });
      
      // Snapshot previous data
      const previousAccounts = queryClient.getQueryData<Account[]>(['accounts']);
      
      // Optimistically add to list
      if (previousAccounts) {
        const optimisticAccount = {
          ...newAccount,
          id: `temp-${Date.now()}`,
        } as Account;
        queryClient.setQueryData(['accounts'], [...previousAccounts, optimisticAccount]);
      }
      
      return { previousAccounts };
    },
    onError: (err, newAccount, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateAccount(): UseMutationResult<Account, Error, { id: string; updates: Partial<Account> }, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateAccount(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['accounts'] });
      await queryClient.cancelQueries({ queryKey: ['account', id] });
      
      // Snapshot previous data
      const previousAccounts = queryClient.getQueryData<Account[]>(['accounts']);
      const previousAccount = queryClient.getQueryData<Account>(['account', id]);
      
      // Update optimistically
      if (previousAccounts) {
        queryClient.setQueryData(['accounts'], 
          previousAccounts.map(a => a.id === id ? { ...a, ...updates } : a)
        );
      }
      
      if (previousAccount) {
        queryClient.setQueryData(['account', id], { ...previousAccount, ...updates });
      }
      
      return { previousAccounts, previousAccount };
    },
    onError: (err, variables, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }
      if (context?.previousAccount) {
        queryClient.setQueryData(['account', variables.id], context.previousAccount);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account', data.id] });
    },
  });
}

export function useDeleteAccount(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAccount,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['accounts'] });
      
      // Snapshot previous data
      const previousAccounts = queryClient.getQueryData<Account[]>(['accounts']);
      
      // Optimistically remove
      if (previousAccounts) {
        queryClient.setQueryData(['accounts'], previousAccounts.filter(a => a.id !== id));
      }
      
      return { previousAccounts };
    },
    onError: (err, id, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

// ========== TRANSACTIONS ==========

export function useCreateTransaction(): UseMutationResult<Transaction, Error, Partial<Transaction>, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTransaction,
    onMutate: async (newTransaction) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      
      // Snapshot previous data
      const previousTransactions = queryClient.getQueryData<Transaction[]>(['transactions']);
      const previousOrders = queryClient.getQueryData<Order[]>(['orders']);
      
      // Optimistically add transaction
      if (previousTransactions) {
        const optimisticTransaction = {
          ...newTransaction,
          id: `temp-${Date.now()}`,
        } as Transaction;
        queryClient.setQueryData(['transactions'], [...previousTransactions, optimisticTransaction]);

        // Also patch paginated page 1 for transactions so lists update immediately
        const txPage1 = queryClient.getQueryData<any>(['transactions', 1]);
        if (txPage1 && Array.isArray(txPage1.data)) {
          queryClient.setQueryData(['transactions', 1], { ...txPage1, data: [optimisticTransaction, ...txPage1.data].slice(0, DEFAULT_PAGE_SIZE), count: (txPage1.count || 0) + 1 });
        }
      }
      
      return { previousTransactions, previousOrders };
    },
    onError: (err, newTransaction, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(['transactions'], context.previousTransactions);
      }
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
    },
    onSuccess: (data) => {
      // Patch paginated transaction pages (add to page 1) when possible
      const pages = queryClient.getQueriesData({ queryKey: ['transactions'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            const newData = [data, ...((value as any).data)].slice(0, DEFAULT_PAGE_SIZE);
            queryClient.setQueryData(key as any, { ...(value as any), data: newData, count: (value as any).count ? (value as any).count + 1 : 1 });
          }
        } catch (e) {
          // ignore per-page patch errors
        }
      });
      // No blind invalidation: transactions paginated pages were patched deterministically above.
    },
  });
}

export function useDeleteTransaction(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTransaction,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      
      // Snapshot previous data
      const previousTransactions = queryClient.getQueryData<Transaction[]>(['transactions']);
      
      // Optimistically remove
      if (previousTransactions) {
        queryClient.setQueryData(['transactions'], previousTransactions.filter(t => t.id !== id));
      }
      
      return { previousTransactions };
    },
    onError: (err, id, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(['transactions'], context.previousTransactions);
      }
    },
    onSuccess: (_data, id) => {
      // Remove deleted transaction from paginated caches and maintain page sizes
      const pages = queryClient.getQueriesData({ queryKey: ['transactions'] });
      const pageMap = new Map<string, any>();
      pages.forEach(([key, value]) => {
        const k = key as any[];
        const pageNum = k[1];
        const filters = k[2];
        pageMap.set(JSON.stringify([pageNum, filters]), { key: k, value });
      });
      const keys = Array.from(pageMap.keys()).sort((a, b) => JSON.parse(a)[0] - JSON.parse(b)[0]);
      for (const mapKey of keys) {
        const entry = pageMap.get(mapKey);
        if (!entry) continue;
        const { key: k, value } = entry;
        try {
          if (value && value.data && Array.isArray(value.data)) {
            const filtered = value.data.filter((t: any) => t.id !== id);
            const pageNum = k[1] as number;
            const filters = k[k.length - 1];
            const nextKey = JSON.stringify([pageNum + 1, filters]);
            const nextEntry = pageMap.get(nextKey);
            if (nextEntry && nextEntry.value && Array.isArray(nextEntry.value.data) && nextEntry.value.data.length > 0) {
              const shiftItem = nextEntry.value.data[0];
              nextEntry.value.data = nextEntry.value.data.slice(1);
              filtered.push(shiftItem);
              queryClient.setQueryData(nextEntry.key as any, { ...(nextEntry.value), data: nextEntry.value.data, count: Math.max(0, (nextEntry.value.count || 1) - 1) });
            }
            queryClient.setQueryData(k as any, { ...(value), data: filtered, count: Math.max(0, (value.count || 1) - 1) });
          }
        } catch (e) {}
      }
    },
  });
}

// ========== USERS ==========

export function useCreateUser(): UseMutationResult<User, Error, Partial<User>, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onMutate: async (newUser) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['users'] });
      
      // Snapshot previous data
      const previousUsers = queryClient.getQueryData<User[]>(['users']);
      
      // Optimistically add to list
      if (previousUsers) {
        const optimisticUser = {
          ...newUser,
          id: `temp-${Date.now()}`,
        } as User;
        queryClient.setQueryData(['users'], [...previousUsers, optimisticUser]);
      }
      
      return { previousUsers };
    },
    onError: (err, newUser, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['users'], context.previousUsers);
      }
    },
    onSuccess: (data) => {
      // If backend returned user row, cache detail and patch first pages deterministically
      try {
        if (data?.id) queryClient.setQueryData(['user', data.id], data);
      } catch (e) {}
      // Clean optimistic temp entries from non-paginated users list
      try {
        const prev = queryClient.getQueryData<User[]>(['users']) || [];
        const cleaned = (prev || []).filter(u => !String(u.id).startsWith('temp-'));
        if (!cleaned.some(u => u.id === data.id)) queryClient.setQueryData(['users'], [data, ...cleaned]);
        else queryClient.setQueryData(['users'], cleaned.map(u => u.id === data.id ? data : u));
      } catch (e) {}

      const pages = queryClient.getQueriesData({ queryKey: ['users'] });
      pages.forEach(([key, value]) => {
        try {
          const k = key as any[];
          if (k[1] !== 1) return;
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            queryClient.setQueryData(key as any, { ...(value as any), data: [data, ...((value as any).data)].slice(0, DEFAULT_PAGE_SIZE), count: (value as any).count ? (value as any).count + 1 : 1 });
          }
        } catch (e) {}
      });
    },
  });
}

export function useUpdateUser(): UseMutationResult<User, Error, { id: string; updates: Partial<User> }, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateUser(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['users'] });
      await queryClient.cancelQueries({ queryKey: ['user', id] });
      await queryClient.cancelQueries({ queryKey: ['userByPhone'] });
      
      // Snapshot previous data
      const previousUsers = queryClient.getQueryData<User[]>(['users']);
      const previousUser = queryClient.getQueryData<User>(['user', id]);
      
      // Update optimistically
      if (previousUsers) {
        queryClient.setQueryData(['users'], 
          previousUsers.map(u => u.id === id ? { ...u, ...updates } : u)
        );
      }
      
      if (previousUser) {
        queryClient.setQueryData(['user', id], { ...previousUser, ...updates });
      }
      
      return { previousUsers, previousUser };
    },
    onError: (err, variables, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['users'], context.previousUsers);
      }
      if (context?.previousUser) {
        queryClient.setQueryData(['user', variables.id], context.previousUser);
      }
    },
    onSuccess: (data) => {
      // Patch paginated user pages in-place and update detail cache
      const pages = queryClient.getQueriesData({ queryKey: ['users'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            queryClient.setQueryData(key as any, { ...(value as any), data: (value as any).data.map((u: any) => u.id === data.id ? data : u) });
          }
        } catch (e) {}
      });
      queryClient.setQueryData(['user', data.id], data);
    },
  });
}

export function useDeleteUser(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['users'] });
      
      // Snapshot previous data
      const previousUsers = queryClient.getQueryData<User[]>(['users']);
      
      // Optimistically remove
      if (previousUsers) {
        queryClient.setQueryData(['users'], previousUsers.filter(u => u.id !== id));
      }
      
      return { previousUsers };
    },
    onError: (err, id, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['users'], context.previousUsers);
      }
    },
    onSuccess: (_data, id) => {
      // Remove user from paginated caches similar to other deletes
      const pages = queryClient.getQueriesData({ queryKey: ['users'] });
      const pageMap = new Map<string, any>();
      pages.forEach(([key, value]) => {
        const k = key as any[];
        const pageNum = k[1];
        // Skip non-paginated queries (e.g., ['users'] without page number)
        if (typeof pageNum !== 'number' || !Number.isInteger(pageNum)) return;
        const filters = k[k.length - 1];
        pageMap.set(JSON.stringify([pageNum, filters]), { key: k, value });
      });
      const keys = Array.from(pageMap.keys()).sort((a, b) => JSON.parse(a)[0] - JSON.parse(b)[0]);
      for (const mapKey of keys) {
        const entry = pageMap.get(mapKey);
        if (!entry) continue;
        const { key: k, value } = entry;
        try {
          if (value && value.data && Array.isArray(value.data)) {
            const filtered = value.data.filter((u: any) => u.id !== id);
            queryClient.setQueryData(k as any, { ...(value), data: filtered, count: Math.max(0, (value.count || 1) - 1) });
          }
        } catch (e) {}
      }
    },
  });
}

// ========== VENDORS ==========

export function useCreateVendor(): UseMutationResult<Vendor, Error, Partial<Vendor>, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVendor,
    onMutate: async (newVendor) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['vendors'] });
      
      // Snapshot previous data
      const previousVendors = queryClient.getQueryData<Vendor[]>(['vendors']);
      
      // Optimistically add to list
      if (previousVendors) {
        const optimisticVendor = {
          ...newVendor,
          id: `temp-${Date.now()}`,
        } as Vendor;
        queryClient.setQueryData(['vendors'], [...previousVendors, optimisticVendor]);

        // Also patch paginated page 1 cache if present so vendor lists update immediately
        const vendorsPage1 = queryClient.getQueryData<any>(['vendors', 1]);
        if (vendorsPage1 && Array.isArray(vendorsPage1.data)) {
          queryClient.setQueryData(['vendors', 1], { ...vendorsPage1, data: [optimisticVendor, ...vendorsPage1.data].slice(0, DEFAULT_PAGE_SIZE), count: (vendorsPage1.count || 0) + 1 });
        }
      }
      
      return { previousVendors };
    },
    onError: (err, newVendor, context) => {
      if (context?.previousVendors) {
        queryClient.setQueryData(['vendors'], context.previousVendors);
      }
    },
    onSuccess: (data) => {
      // Ensure root vendors cache is updated: replace any optimistic entries and dedupe
      try {
        const previous = queryClient.getQueryData<Vendor[]>(['vendors']);
        if (previous) {
          const cleaned = (previous || []).filter(v => !(v.id && String(v.id).startsWith('temp-')));
          if (!cleaned.some(v => v.id === data.id)) {
            queryClient.setQueryData(['vendors'], [data, ...cleaned]);
          } else {
            queryClient.setQueryData(['vendors'], cleaned.map(v => v.id === data.id ? data : v));
          }
        }
      } catch (e) {
        // ignore
      }

      // Deterministically patch paginated vendor first pages (no invalidation)
      const pages = queryClient.getQueriesData({ queryKey: ['vendors'] });
      pages.forEach(([key, value]) => {
        try {
          const k = key as any[];
          if (k[1] !== 1) return;
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            queryClient.setQueryData(key as any, { ...(value as any), data: [data, ...((value as any).data)].slice(0, DEFAULT_PAGE_SIZE), count: (value as any).count ? (value as any).count + 1 : 1 });
          }
        } catch (e) {}
      });
    },
  });
}

export function useUpdateVendor(): UseMutationResult<Vendor, Error, { id: string; updates: Partial<Vendor> }, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateVendor(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['vendors'] });
      await queryClient.cancelQueries({ queryKey: ['vendor', id] });
      
      // Snapshot previous data
      const previousVendors = queryClient.getQueryData<Vendor[]>(['vendors']);
      const previousVendor = queryClient.getQueryData<Vendor>(['vendor', id]);
      
      // Update optimistically
      if (previousVendors) {
        queryClient.setQueryData(['vendors'], 
          previousVendors.map(v => v.id === id ? { ...v, ...updates } : v)
        );
      }
      
      if (previousVendor) {
        queryClient.setQueryData(['vendor', id], { ...previousVendor, ...updates });
      }
      
      return { previousVendors, previousVendor };
    },
    onError: (err, variables, context) => {
      if (context?.previousVendors) {
        queryClient.setQueryData(['vendors'], context.previousVendors);
      }
      if (context?.previousVendor) {
        queryClient.setQueryData(['vendor', variables.id], context.previousVendor);
      }
    },
    onSuccess: (data) => {
      // Patch any paginated vendor pages in-place
      const pages = queryClient.getQueriesData({ queryKey: ['vendors'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            queryClient.setQueryData(key as any, { ...(value as any), data: (value as any).data.map((v: any) => v.id === data.id ? data : v) });
          }
        } catch (e) {}
      });
      queryClient.setQueryData(['vendor', data.id], data);
    },
  });
}

export function useDeleteVendor(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteVendor,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['vendors'] });
      
      // Snapshot previous data
      const previousVendors = queryClient.getQueryData<Vendor[]>(['vendors']);
      
      // Optimistically remove
      if (previousVendors) {
        queryClient.setQueryData(['vendors'], previousVendors.filter(v => v.id !== id));
      }
      
      return { previousVendors };
    },
    onError: (err, id, context) => {
      if (context?.previousVendors) {
        queryClient.setQueryData(['vendors'], context.previousVendors);
      }
    },
    onSuccess: (_data, id) => {
      // Remove deleted vendor from paginated caches and maintain page sizes
      const pages = queryClient.getQueriesData({ queryKey: ['vendors'] });
      const pageMap = new Map<string, any>();
      pages.forEach(([key, value]) => {
        const k = key as any[];
        const pageNum = k[1];
        // Skip non-paginated queries (e.g., ['vendors'] without page number)
        if (typeof pageNum !== 'number' || !Number.isInteger(pageNum)) return;
        const filters = k[k.length - 1];
        pageMap.set(JSON.stringify([pageNum, filters]), { key: k, value });
      });
      const keys = Array.from(pageMap.keys()).sort((a, b) => JSON.parse(a)[0] - JSON.parse(b)[0]);
      for (const mapKey of keys) {
        const entry = pageMap.get(mapKey);
        if (!entry) continue;
        const { key: k, value } = entry;
        try {
          if (value && value.data && Array.isArray(value.data)) {
            const filtered = value.data.filter((v: any) => v.id !== id);
            const pageNum = k[1] as number;
            const filters = k[k.length - 1];
            const nextKey = JSON.stringify([pageNum + 1, filters]);
            const nextEntry = pageMap.get(nextKey);
            if (nextEntry && nextEntry.value && Array.isArray(nextEntry.value.data) && nextEntry.value.data.length > 0) {
              const shiftItem = nextEntry.value.data[0];
              nextEntry.value.data = nextEntry.value.data.slice(1);
              filtered.push(shiftItem);
              queryClient.setQueryData(nextEntry.key as any, { ...(nextEntry.value), data: nextEntry.value.data, count: Math.max(0, (nextEntry.value.count || 1) - 1) });
            }
            queryClient.setQueryData(k as any, { ...(value), data: filtered, count: Math.max(0, (value.count || 1) - 1) });
          }
        } catch (e) {}
      }
    },
  });
}

// ========== PRODUCTS ==========

export function useCreateProduct(): UseMutationResult<Product, Error, Partial<Product>, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onMutate: async (newProduct) => {
      // Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['products'] });
      
      // Get the current products list
      const previousProducts = queryClient.getQueryData<Product[]>(['products']) || [];
      
      // Create optimistic product with temp ID (will be replaced after server response)
      const optimisticProduct: Product = {
        ...newProduct,
        id: `temp-${Date.now()}`,
      } as Product;
      
      // Optimistically add to the top of the list (newest first)
      queryClient.setQueryData(['products'], [optimisticProduct, ...previousProducts]);
      
      return { previousProducts, optimisticProduct };
    },
    onError: (err, newProduct, context) => {
      // Rollback to previous data on error
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
    },
    onSuccess: async (data) => {
      // Cache the newly created product and patch paginated product pages
      queryClient.setQueryData(['product', data.id], data);

      // Patch any paginated product pages to include the new product at the top
      const pages = queryClient.getQueriesData({ queryKey: ['products'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            const newData = [data, ...((value as any).data)].slice(0, DEFAULT_PAGE_SIZE);
            queryClient.setQueryData(key as any, { ...(value as any), data: newData, count: (value as any).count ? (value as any).count + 1 : 1 });
          }
        } catch (e) {
          // ignore per-page patch errors
        }
      });

      // Also update the non-paginated products list if present (cleanup temp entries)
      const prev = queryClient.getQueryData<Product[]>(['products']) || [];
      const cleaned = (prev || []).filter(p => !String(p.id).startsWith('temp-'));
      queryClient.setQueryData(['products'], [data, ...cleaned]);
    },
  });
}

export function useUpdateProduct(): UseMutationResult<Product, Error, { id: string; updates: Partial<Product> }, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateProduct(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['products'] });
      await queryClient.cancelQueries({ queryKey: ['product', id] });
      
      // Snapshot previous data
      const previousProducts = queryClient.getQueryData<Product[]>(['products']);
      const previousProduct = queryClient.getQueryData<Product>(['product', id]);
      
      // Update optimistically
      if (previousProducts) {
        queryClient.setQueryData(['products'], 
          previousProducts.map(p => p.id === id ? { ...p, ...updates } : p)
        );
      }
      
      if (previousProduct) {
        queryClient.setQueryData(['product', id], { ...previousProduct, ...updates });
      }
      
      return { previousProducts, previousProduct };
    },
    onError: (err, variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
      if (context?.previousProduct) {
        queryClient.setQueryData(['product', variables.id], context.previousProduct);
      }
    },
    onSuccess: (data) => {
      // Patch any paginated product pages in-place
      const pages = queryClient.getQueriesData({ queryKey: ['products'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            queryClient.setQueryData(key as any, { ...(value as any), data: (value as any).data.map((p: any) => p.id === data.id ? data : p) });
          }
        } catch (e) {}
      });
      queryClient.setQueryData(['product', data.id], data);
    },
  });
}

export function useDeleteProduct(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['products'] });
      
      // Snapshot previous data
      const previousProducts = queryClient.getQueryData<Product[]>(['products']);
      
      // Optimistically remove
      if (previousProducts) {
        queryClient.setQueryData(['products'], previousProducts.filter(p => p.id !== id));
      }
      
      return { previousProducts };
    },
    onError: (err, id, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
    },
    onSuccess: (_data, id) => {
      // Remove deleted product from paginated caches and maintain page sizes
      const pages = queryClient.getQueriesData({ queryKey: ['products'] });
      const pageMap = new Map<string, any>();
      pages.forEach(([key, value]) => {
        const k = key as any[];
        const pageNum = k[1];
        // Skip non-paginated queries (e.g., ['products'] without page number)
        if (typeof pageNum !== 'number' || !Number.isInteger(pageNum)) return;
        const filters = k[k.length - 1];
        pageMap.set(JSON.stringify([pageNum, filters]), { key: k, value });
      });
      const keys = Array.from(pageMap.keys()).sort((a, b) => JSON.parse(a)[0] - JSON.parse(b)[0]);
      for (const mapKey of keys) {
        const entry = pageMap.get(mapKey);
        if (!entry) continue;
        const { key: k, value } = entry;
        try {
          if (value && value.data && Array.isArray(value.data)) {
            const filtered = value.data.filter((p: any) => p.id !== id);
            const pageNum = k[1] as number;
            const filters = k[k.length - 1];
            const nextKey = JSON.stringify([pageNum + 1, filters]);
            const nextEntry = pageMap.get(nextKey);
            if (nextEntry && nextEntry.value && Array.isArray(nextEntry.value.data) && nextEntry.value.data.length > 0) {
              const shiftItem = nextEntry.value.data[0];
              nextEntry.value.data = nextEntry.value.data.slice(1);
              filtered.push(shiftItem);
              queryClient.setQueryData(nextEntry.key as any, { ...(nextEntry.value), data: nextEntry.value.data, count: Math.max(0, (nextEntry.value.count || 1) - 1) });
            }
            queryClient.setQueryData(k as any, { ...(value), data: filtered, count: Math.max(0, (value.count || 1) - 1) });
          }
        } catch (e) {}
      }
    },
  });
}

// ========== CATEGORIES ==========

export function useCreateCategory(): UseMutationResult<any, Error, any, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onMutate: async (newCategory) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['categories'] });
      
      // Snapshot previous data
      const previousCategories = queryClient.getQueryData<any[]>(['categories']);
      
      // Optimistically add to list
      if (previousCategories) {
        const optimisticCategory = {
          ...newCategory,
          id: `temp-${Date.now()}`,
        };
        queryClient.setQueryData(['categories'], [...previousCategories, optimisticCategory]);
      }
      
      return { previousCategories };
    },
    onError: (err, newCategory, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(['categories'], context.previousCategories);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory(): UseMutationResult<any, Error, { id: string; updates: any }, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateCategory(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['categories'] });
      await queryClient.cancelQueries({ queryKey: ['category', id] });
      
      // Snapshot previous data
      const previousCategories = queryClient.getQueryData<any[]>(['categories']);
      const previousCategory = queryClient.getQueryData<any>(['category', id]);
      
      // Update optimistically
      if (previousCategories) {
        queryClient.setQueryData(['categories'], 
          previousCategories.map(c => c.id === id ? { ...c, ...updates } : c)
        );
      }
      
      if (previousCategory) {
        queryClient.setQueryData(['category', id], { ...previousCategory, ...updates });
      }
      
      return { previousCategories, previousCategory };
    },
    onError: (err, variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(['categories'], context.previousCategories);
      }
      if (context?.previousCategory) {
        queryClient.setQueryData(['category', variables.id], context.previousCategory);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category', data.id] });
    },
  });
}

export function useDeleteCategory(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['categories'] });
      
      // Snapshot previous data
      const previousCategories = queryClient.getQueryData<any[]>(['categories']);
      
      // Optimistically remove
      if (previousCategories) {
        queryClient.setQueryData(['categories'], previousCategories.filter(c => c.id !== id));
      }
      
      return { previousCategories };
    },
    onError: (err, id, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(['categories'], context.previousCategories);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// ========== PAYMENT METHODS ==========

export function useCreatePaymentMethod(): UseMutationResult<any, Error, any, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPaymentMethod,
    onMutate: async (newMethod) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['paymentMethods'] });
      
      // Snapshot previous data
      const previousMethods = queryClient.getQueryData<any[]>(['paymentMethods']);
      
      // Optimistically add to list
      if (previousMethods) {
        const optimisticMethod = {
          ...newMethod,
          id: `temp-${Date.now()}`,
        };
        queryClient.setQueryData(['paymentMethods'], [...previousMethods, optimisticMethod]);
      }
      
      return { previousMethods };
    },
    onError: (err, newMethod, context) => {
      if (context?.previousMethods) {
        queryClient.setQueryData(['paymentMethods'], context.previousMethods);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
    },
  });
}

export function useUpdatePaymentMethod(): UseMutationResult<any, Error, { id: string; updates: any }, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updatePaymentMethod(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['paymentMethods'] });
      await queryClient.cancelQueries({ queryKey: ['paymentMethod', id] });
      
      // Snapshot previous data
      const previousMethods = queryClient.getQueryData<any[]>(['paymentMethods']);
      const previousMethod = queryClient.getQueryData<any>(['paymentMethod', id]);
      
      // Update optimistically
      if (previousMethods) {
        queryClient.setQueryData(['paymentMethods'], 
          previousMethods.map(m => m.id === id ? { ...m, ...updates } : m)
        );
      }
      
      if (previousMethod) {
        queryClient.setQueryData(['paymentMethod', id], { ...previousMethod, ...updates });
      }
      
      return { previousMethods, previousMethod };
    },
    onError: (err, variables, context) => {
      if (context?.previousMethods) {
        queryClient.setQueryData(['paymentMethods'], context.previousMethods);
      }
      if (context?.previousMethod) {
        queryClient.setQueryData(['paymentMethod', variables.id], context.previousMethod);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
      queryClient.invalidateQueries({ queryKey: ['paymentMethod', data.id] });
    },
  });
}

export function useDeletePaymentMethod(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePaymentMethod,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['paymentMethods'] });
      
      // Snapshot previous data
      const previousMethods = queryClient.getQueryData<any[]>(['paymentMethods']);
      
      // Optimistically remove
      if (previousMethods) {
        queryClient.setQueryData(['paymentMethods'], previousMethods.filter(m => m.id !== id));
      }
      
      return { previousMethods };
    },
    onError: (err, id, context) => {
      if (context?.previousMethods) {
        queryClient.setQueryData(['paymentMethods'], context.previousMethods);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
    },
  });
}

// ========== UNITS ==========

export function useCreateUnit(): UseMutationResult<any, Error, any, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUnit,
    onMutate: async (newUnit) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['units'] });
      
      // Snapshot previous data
      const previousUnits = queryClient.getQueryData<any[]>(['units']);
      
      // Optimistically add to list
      if (previousUnits) {
        const optimisticUnit = {
          ...newUnit,
          id: `temp-${Date.now()}`,
        };
        queryClient.setQueryData(['units'], [...previousUnits, optimisticUnit]);
      }
      
      return { previousUnits };
    },
    onError: (err, newUnit, context) => {
      if (context?.previousUnits) {
        queryClient.setQueryData(['units'], context.previousUnits);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
  });
}

export function useUpdateUnit(): UseMutationResult<any, Error, { id: string; updates: any }, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateUnit(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['units'] });
      await queryClient.cancelQueries({ queryKey: ['unit', id] });
      
      // Snapshot previous data
      const previousUnits = queryClient.getQueryData<any[]>(['units']);
      const previousUnit = queryClient.getQueryData<any>(['unit', id]);
      
      // Update optimistically
      if (previousUnits) {
        queryClient.setQueryData(['units'], 
          previousUnits.map(u => u.id === id ? { ...u, ...updates } : u)
        );
      }
      
      if (previousUnit) {
        queryClient.setQueryData(['unit', id], { ...previousUnit, ...updates });
      }
      
      return { previousUnits, previousUnit };
    },
    onError: (err, variables, context) => {
      if (context?.previousUnits) {
        queryClient.setQueryData(['units'], context.previousUnits);
      }
      if (context?.previousUnit) {
        queryClient.setQueryData(['unit', variables.id], context.previousUnit);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['unit', data.id] });
    },
  });
}

export function useDeleteUnit(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUnit,
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['units'] });
      
      // Snapshot previous data
      const previousUnits = queryClient.getQueryData<any[]>(['units']);
      
      // Optimistically remove
      if (previousUnits) {
        queryClient.setQueryData(['units'], previousUnits.filter(u => u.id !== id));
      }
      
      return { previousUnits };
    },
    onError: (err, id, context) => {
      if (context?.previousUnits) {
        queryClient.setQueryData(['units'], context.previousUnits);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
  });
}

// ========== SETTINGS ==========

export function useUpdateCompanySettings(): UseMutationResult<any, Error, any, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCompanySettings,
    onMutate: async (newSettings) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['settings', 'company'] });
      
      // Snapshot previous data
      const previousSettings = queryClient.getQueryData<any>(['settings', 'company']);
      
      // Optimistically update
      queryClient.setQueryData(['settings', 'company'], { ...previousSettings, ...newSettings });
      
      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings', 'company'], context.previousSettings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'company'] });
    },
  });
}

export function useUpdateOrderSettings(): UseMutationResult<any, Error, any, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOrderSettings,
    onMutate: async (newSettings) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['settings', 'order'] });
      
      // Snapshot previous data
      const previousSettings = queryClient.getQueryData<any>(['settings', 'order']);
      
      // Optimistically update
      queryClient.setQueryData(['settings', 'order'], { ...previousSettings, ...newSettings });
      
      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings', 'order'], context.previousSettings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'order'] });
    },
  });
}

export function useUpdateInvoiceSettings(): UseMutationResult<any, Error, any, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateInvoiceSettings,
    onMutate: async (newSettings) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['settings', 'invoice'] });
      
      // Snapshot previous data
      const previousSettings = queryClient.getQueryData<any>(['settings', 'invoice']);
      
      // Optimistically update
      queryClient.setQueryData(['settings', 'invoice'], { ...previousSettings, ...newSettings });
      
      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings', 'invoice'], context.previousSettings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'invoice'] });
    },
  });
}

export function useUpdateSystemDefaults(): UseMutationResult<any, Error, any, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSystemDefaults,
    onMutate: async (newSettings) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['settings', 'defaults'] });
      
      // Snapshot previous data
      const previousSettings = queryClient.getQueryData<any>(['settings', 'defaults']);
      
      // Optimistically update
      queryClient.setQueryData(['settings', 'defaults'], { ...previousSettings, ...newSettings });
      
      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings', 'defaults'], context.previousSettings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'defaults'] });
    },
  });
}

export function useUpdateCourierSettings(): UseMutationResult<any, Error, any, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCourierSettings,
    onMutate: async (newSettings) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['settings', 'courier'] });
      
      // Snapshot previous data
      const previousSettings = queryClient.getQueryData<any>(['settings', 'courier']);
      
      // Optimistically update
      queryClient.setQueryData(['settings', 'courier'], { ...previousSettings, ...newSettings });
      
      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings', 'courier'], context.previousSettings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'courier'] });
    },
  });
}

// ========== BATCH SETTINGS ==========

/**
 * Batch update all 5 settings tables in a single mutation instead of 5 separate ones.
 * Provides optimistic updates for all 5 settings caches simultaneously.
 * 
 * Reduces network latency from 2-4s (5 individual mutations) to ~500ms (1 batch).
 */
export function useBatchUpdateSettings(): UseMutationResult<any, Error, any, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchUpdateSettings,
    onMutate: async (updates) => {
      // Cancel all settings queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      
      // Snapshot all previous settings
      const previousCompany = queryClient.getQueryData<any>(['settings', 'company']);
      const previousOrder = queryClient.getQueryData<any>(['settings', 'order']);
      const previousInvoice = queryClient.getQueryData<any>(['settings', 'invoice']);
      const previousDefaults = queryClient.getQueryData<any>(['settings', 'defaults']);
      const previousCourier = queryClient.getQueryData<any>(['settings', 'courier']);
      
      // Optimistically update all settings caches
      if (updates.company && previousCompany) {
        queryClient.setQueryData(['settings', 'company'], { ...previousCompany, ...updates.company });
      }
      if (updates.order && previousOrder) {
        queryClient.setQueryData(['settings', 'order'], { ...previousOrder, ...updates.order });
      }
      if (updates.invoice && previousInvoice) {
        queryClient.setQueryData(['settings', 'invoice'], { ...previousInvoice, ...updates.invoice });
      }
      if (updates.defaults && previousDefaults) {
        queryClient.setQueryData(['settings', 'defaults'], { ...previousDefaults, ...updates.defaults });
      }
      if (updates.courier && previousCourier) {
        queryClient.setQueryData(['settings', 'courier'], { ...previousCourier, ...updates.courier });
      }
      
      return {
        previousCompany,
        previousOrder,
        previousInvoice,
        previousDefaults,
        previousCourier,
      };
    },
    onError: (err, updates, context) => {
      // Rollback all settings on error
      if (context?.previousCompany) {
        queryClient.setQueryData(['settings', 'company'], context.previousCompany);
      }
      if (context?.previousOrder) {
        queryClient.setQueryData(['settings', 'order'], context.previousOrder);
      }
      if (context?.previousInvoice) {
        queryClient.setQueryData(['settings', 'invoice'], context.previousInvoice);
      }
      if (context?.previousDefaults) {
        queryClient.setQueryData(['settings', 'defaults'], context.previousDefaults);
      }
      if (context?.previousCourier) {
        queryClient.setQueryData(['settings', 'courier'], context.previousCourier);
      }
    },
    onSuccess: () => {
      // Refetch all settings in background to validate
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

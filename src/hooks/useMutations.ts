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
      queryClient.invalidateQueries({ queryKey: ['customers', 1] });
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
      }
      
      return { previousCustomers };
    },
    onError: (err, newCustomer, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers'], context.previousCustomers);
      }
    },
    onSuccess: async (data: Customer) => {
      // Replace optimistic entries with server result
      if (data && data.id) {
        queryClient.setQueryData(['customer', data.id], data);
        const prev = queryClient.getQueryData<Customer[]>(['customers']) || [];
        const cleaned = (prev || []).filter(c => !isTempId(String(c.id)));
        queryClient.setQueryData(['customers'], [data, ...cleaned]);
      }
      // Patch page-level cache to avoid refetching entire list
      patchCustomerPages(data);
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
      // Remove deleted customer from paginated caches
      const pages = queryClient.getQueriesData({ queryKey: ['customers'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            const newDataArr = (value as any).data.filter((c: any) => c.id !== id);
            queryClient.setQueryData(key as any, { ...(value as any), data: newDataArr, count: Math.max(0, (value as any).count ? (value as any).count - 1 : 0) });
          }
        } catch (e) {
          // ignore
        }
      });
      queryClient.invalidateQueries({ queryKey: ['customers', 1] });
    },
  });
}

// ========== ORDERS ==========

export function useCreateOrder(): UseMutationResult<Order, Error, Omit<Order, 'id'>, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
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

      // Patch page 1 of paginated orders if cached to include the new order
      const page1 = queryClient.getQueryData<any>(['orders', 1]);
      if (page1 && Array.isArray(page1.data)) {
        queryClient.setQueryData(['orders', 1], { ...page1, data: [data, ...page1.data].slice(0, DEFAULT_PAGE_SIZE), count: (page1.count || 0) + 1 });
      } else {
        // Fallback: invalidate page 1 so it will be refetched
        queryClient.invalidateQueries({ queryKey: ['orders', 1] });
      }

      // Increment nextNumber in settings after successful order creation (best-effort)
      try {
        const currentSettings = queryClient.getQueryData<{ prefix: string; nextNumber: number }>(['settings', 'order']);
        if (currentSettings && currentSettings.nextNumber) {
          await updateOrderSettings({ nextNumber: currentSettings.nextNumber + 1 });
          queryClient.invalidateQueries({ queryKey: ['settings', 'order'] });
        }
      } catch (err) {
        console.error('Failed to update order settings:', err);
      }
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
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
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
      // Remove deleted order from any cached paginated pages
      const pages = queryClient.getQueriesData({ queryKey: ['orders'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            const newDataArr = (value as any).data.filter((o: any) => o.id !== id);
            queryClient.setQueryData(key as any, { ...(value as any), data: newDataArr, count: Math.max(0, (value as any).count ? (value as any).count - 1 : 0) });
          }
        } catch (e) {
          // ignore
        }
      });
      // Fallback: invalidate first page
      queryClient.invalidateQueries({ queryKey: ['orders', 1] });
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
      
      return { previousBills, optimisticBill };
    },
    onError: (err, newBill, context) => {
      // Rollback to previous data on error
      if (context?.previousBills) {
        queryClient.setQueryData(['bills'], context.previousBills);
      }
    },
    onSuccess: async (data) => {
      // Cache the newly created bill for immediate access in details view
      queryClient.setQueryData(['bill', data.id], data);

      // Patch page 1 if it exists
      const page1 = queryClient.getQueryData<any>(['bills', 1]);
      if (page1 && Array.isArray(page1.data)) {
        queryClient.setQueryData(['bills', 1], { ...page1, data: [data, ...page1.data].slice(0, DEFAULT_PAGE_SIZE), count: (page1.count || 0) + 1 });
      } else {
        queryClient.invalidateQueries({ queryKey: ['bills', 1] });
      }
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
      queryClient.invalidateQueries({ queryKey: ['bills'] });
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
      // Remove deleted bill from paginated caches
      const pages = queryClient.getQueriesData({ queryKey: ['bills'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            const newDataArr = (value as any).data.filter((b: any) => b.id !== id);
            queryClient.setQueryData(key as any, { ...(value as any), data: newDataArr, count: Math.max(0, (value as any).count ? (value as any).count - 1 : 0) });
          }
        } catch (e) {
          // ignore
        }
      });
      queryClient.invalidateQueries({ queryKey: ['bills', 1] });
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
      // Minimal orders invalidation: only first page to keep egress lower
      queryClient.invalidateQueries({ queryKey: ['orders', 1] });
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
      // Remove deleted transaction from paginated caches
      const pages = queryClient.getQueriesData({ queryKey: ['transactions'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            const newDataArr = (value as any).data.filter((t: any) => t.id !== id);
            queryClient.setQueryData(key as any, { ...(value as any), data: newDataArr, count: Math.max(0, (value as any).count ? (value as any).count - 1 : 0) });
          }
        } catch (e) {
          // ignore
        }
      });
      queryClient.invalidateQueries({ queryKey: ['transactions', 1] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
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
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', data.id] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
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
      }
      
      return { previousVendors };
    },
    onError: (err, newVendor, context) => {
      if (context?.previousVendors) {
        queryClient.setQueryData(['vendors'], context.previousVendors);
      }
    },
    onSuccess: (data) => {
      // Patch paginated vendor pages (add to page 1) if present
      const pages = queryClient.getQueriesData({ queryKey: ['vendors'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            const newData = [data, ...((value as any).data)].slice(0, DEFAULT_PAGE_SIZE);
            queryClient.setQueryData(key as any, { ...(value as any), data: newData, count: (value as any).count ? (value as any).count + 1 : 1 });
          }
        } catch (e) {
          // ignore
        }
      });
      // Fallback: invalidate first page
      queryClient.invalidateQueries({ queryKey: ['vendors', 1] });
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
      // Remove deleted vendor from paginated caches
      const pages = queryClient.getQueriesData({ queryKey: ['vendors'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            const newDataArr = (value as any).data.filter((v: any) => v.id !== id);
            queryClient.setQueryData(key as any, { ...(value as any), data: newDataArr, count: Math.max(0, (value as any).count ? (value as any).count - 1 : 0) });
          }
        } catch (e) {
          // ignore
        }
      });
      queryClient.invalidateQueries({ queryKey: ['vendors', 1] });
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
      // Remove deleted product from paginated caches
      const pages = queryClient.getQueriesData({ queryKey: ['products'] });
      pages.forEach(([key, value]) => {
        try {
          if (value && (value as any).data && Array.isArray((value as any).data)) {
            const newDataArr = (value as any).data.filter((p: any) => p.id !== id);
            queryClient.setQueryData(key as any, { ...(value as any), data: newDataArr, count: Math.max(0, (value as any).count ? (value as any).count - 1 : 0) });
          }
        } catch (e) {
          // ignore
        }
      });
      queryClient.invalidateQueries({ queryKey: ['products', 1] });
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

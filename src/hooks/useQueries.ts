import { useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  fetchCustomers,
  fetchCustomerById,
  fetchOrders,
  fetchOrderById,
  fetchOrdersByCustomerId,
  fetchBills,
  fetchBillById,
  fetchAccounts,
  fetchAccountById,
  fetchTransactions,
  fetchTransactionById,
  fetchUsers,
  fetchUserById,
  fetchUserByPhone,
  fetchVendors,
  fetchVendorById,
  fetchProducts,
  fetchProductById,
  fetchCategories,
  fetchCategoriesById,
  fetchPaymentMethods,
  fetchPaymentMethodById,
  fetchUnits,
  fetchUnitById,
  fetchCompanySettings,
  fetchOrderSettings,
  fetchInvoiceSettings,
  fetchSystemDefaults,
  fetchCourierSettings,
} from '../services/supabaseQueries';
import type { Customer, Order, Bill, Account, Transaction, User, Vendor, Product } from '../../types';

// ========== CUSTOMERS ==========

export function useCustomers(): UseQueryResult<Customer[], Error> {
  return useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCustomer(id: string | undefined): UseQueryResult<Customer | null, Error> {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomerById(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ========== ORDERS ==========

export function useOrders(): UseQueryResult<Order[], Error> {
  return useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrder(id: string | undefined): UseQueryResult<Order | null, Error> {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrderById(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrdersByCustomerId(customerId: string | undefined): UseQueryResult<Order[], Error> {
  return useQuery({
    queryKey: ['ordersByCustomerId', customerId],
    queryFn: () => fetchOrdersByCustomerId(customerId || ''),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000,
  });
}

// ========== BILLS ==========

export function useBills(): UseQueryResult<Bill[], Error> {
  return useQuery({
    queryKey: ['bills'],
    queryFn: fetchBills,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBill(id: string | undefined): UseQueryResult<Bill | null, Error> {
  return useQuery({
    queryKey: ['bill', id],
    queryFn: () => fetchBillById(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ========== ACCOUNTS ==========

export function useAccounts(): UseQueryResult<Account[], Error> {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAccount(id: string | undefined): UseQueryResult<Account | null, Error> {
  return useQuery({
    queryKey: ['account', id],
    queryFn: () => fetchAccountById(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ========== TRANSACTIONS ==========

export function useTransactions(): UseQueryResult<Transaction[], Error> {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: fetchTransactions,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTransaction(id: string | undefined): UseQueryResult<Transaction | null, Error> {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: () => fetchTransactionById(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ========== USERS ==========

export function useUsers(): UseQueryResult<User[], Error> {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes - matches bills/orders cache, creator names stay fresh without refetch on every mutation
  });
}

export function useUser(id: string | undefined): UseQueryResult<User | null, Error> {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUserById(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes - matches other query caches
  });
}

export function useUserByPhone(phone: string | undefined): UseQueryResult<User | null, Error> {
  return useQuery({
    queryKey: ['userByPhone', phone],
    queryFn: () => fetchUserByPhone(phone || ''),
    enabled: !!phone,
    staleTime: 30 * 60 * 1000,
  });
}

// ========== VENDORS ==========

export function useVendors(): UseQueryResult<Vendor[], Error> {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: fetchVendors,
    staleTime: 5 * 60 * 1000,
  });
}

export function useVendor(id: string | undefined): UseQueryResult<Vendor | null, Error> {
  return useQuery({
    queryKey: ['vendor', id],
    queryFn: () => fetchVendorById(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ========== PRODUCTS ==========

export function useProducts(category?: string): UseQueryResult<Product[], Error> {
  return useQuery({
    queryKey: ['products', category],
    queryFn: () => fetchProducts(category), // FIX: Wrap to pass category parameter
    staleTime: 5 * 60 * 1000, // FIX: Reduced from 30 to 5 minutes to match orders/customers - ensure fresh product data
  });
}

export function useProduct(id: string | undefined): UseQueryResult<Product | null, Error> {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProductById(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // FIX: Reduced from 30 to 5 minutes to match other entities
  });
}

// ========== CATEGORIES ==========

export function useCategories(type?: string): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: ['categories', type],
    queryFn: () => fetchCategories(type),
    staleTime: 60 * 60 * 1000, // 60 minutes for categories
  });
}

export function useCategory(id: string | undefined): UseQueryResult<any | null, Error> {
  return useQuery({
    queryKey: ['category', id],
    queryFn: () => fetchCategoriesById(id || ''),
    enabled: !!id,
    staleTime: 60 * 60 * 1000,
  });
}

// ========== PAYMENT METHODS ==========

export function usePaymentMethods(activeOnly?: boolean): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: ['paymentMethods', activeOnly],
    queryFn: () => fetchPaymentMethods(activeOnly),
    staleTime: 60 * 60 * 1000, // 60 minutes for payment methods
  });
}

export function usePaymentMethod(id: string | undefined): UseQueryResult<any | null, Error> {
  return useQuery({
    queryKey: ['paymentMethod', id],
    queryFn: () => fetchPaymentMethodById(id || ''),
    enabled: !!id,
    staleTime: 60 * 60 * 1000,
  });
}

// ========== UNITS ==========

export function useUnits(): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: ['units'],
    queryFn: fetchUnits,
    staleTime: 60 * 60 * 1000, // 60 minutes for units
  });
}

export function useUnit(id: string | undefined): UseQueryResult<any | null, Error> {
  return useQuery({
    queryKey: ['unit', id],
    queryFn: () => fetchUnitById(id || ''),
    enabled: !!id,
    staleTime: 60 * 60 * 1000,
  });
}

// ========== SETTINGS ==========

export function useCompanySettings(): UseQueryResult<any, Error> {
  return useQuery({
    queryKey: ['settings', 'company'],
    queryFn: fetchCompanySettings,
    staleTime: 60 * 60 * 1000, // 60 minutes for settings
  });
}

export function useOrderSettings(): UseQueryResult<any, Error> {
  return useQuery({
    queryKey: ['settings', 'order'],
    queryFn: fetchOrderSettings,
    staleTime: 60 * 60 * 1000,
  });
}

export function useInvoiceSettings(): UseQueryResult<any, Error> {
  return useQuery({
    queryKey: ['settings', 'invoice'],
    queryFn: fetchInvoiceSettings,
    staleTime: 60 * 60 * 1000,
  });
}

export function useSystemDefaults(): UseQueryResult<any, Error> {
  return useQuery({
    queryKey: ['settings', 'defaults'],
    queryFn: fetchSystemDefaults,
    staleTime: 60 * 60 * 1000,
  });
}

export function useCourierSettings(): UseQueryResult<any, Error> {
  return useQuery({
    queryKey: ['settings', 'courier'],
    queryFn: fetchCourierSettings,
    staleTime: 60 * 60 * 1000,
  });
}

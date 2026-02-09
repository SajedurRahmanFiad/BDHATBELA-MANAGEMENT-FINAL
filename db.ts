
import { User, UserRole, Order, OrderStatus, Bill, BillStatus, Customer, Vendor, Product, Account, Transaction, Settings } from './types';

// Default Settings (Only for UI, all data comes from Supabase)
const defaultSettings: Settings = {
  company: {
    name: 'BD Hatbela',
    logo: '',
    phone: '',
    email: '',
    address: '',
  },
  order: { prefix: 'BDH-', nextNumber: 1 },
  invoice: { title: 'Tax Invoice', logoWidth: 60, logoHeight: 60, footer: 'Thank you for shopping with BD Hatbela!' },
  defaults: { accountId: '', paymentMethod: 'Cash', incomeCategoryId: '', expenseCategoryId: '', recordsPerPage: 20 },
  categories: [],
  paymentMethods: [],
  courier: {
    steadfast: { baseUrl: '', apiKey: '', secretKey: '' },
    carryBee: { baseUrl: '', clientId: '', clientSecret: '', clientContext: '', storeId: '' },
  },
};

// Helper to get from local storage, NO fallback to initial data
const getFromStorage = <T,>(key: string): T | null => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

// Global State - ONLY for currentUser and settings (sync with localStorage)
const _storedCurrent = getFromStorage<User | null>('currentUser');
const _storedSettings = getFromStorage<Settings>('settings');

export const db = {
  // Keep only currentUser and settings (for context)
  // ALL other data MUST come from Supabase via React Query
  users: [],       // DEPRECATED - Do not use. Fetch via useUsers()
  customers: [],   // DEPRECATED - Do not use. Fetch via useCustomers()
  vendors: [],     // DEPRECATED - Do not use. Fetch via useVendors()
  products: [],    // DEPRECATED - Do not use. Fetch via useProducts()
  orders: [],      // DEPRECATED - Do not use. Fetch via useOrders()
  bills: [],       // DEPRECATED - Do not use. Fetch via useBills()
  accounts: [],    // DEPRECATED - Do not use. Fetch via useAccounts()
  transactions: [], // DEPRECATED - Do not use. Fetch via useTransactions()
  
  currentUser: _storedCurrent ?? null,
  settings: _storedSettings ?? defaultSettings,
};

export const saveDb = () => {
  // Only save essential data to localStorage to avoid quota exceeded errors
  // Large datasets (orders, bills, transactions, etc.) are fetched from Supabase on demand
  try {
    localStorage.setItem('currentUser', JSON.stringify(db.currentUser));
    localStorage.setItem('settings', JSON.stringify(db.settings));
  } catch (err) {
    console.warn('[DB] localStorage write failed:', err);
  }
};

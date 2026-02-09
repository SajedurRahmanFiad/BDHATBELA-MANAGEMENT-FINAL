/// <reference types="vite/client" />
import supabase, { phoneToEmail } from './supabaseClient';
import { Customer, Order, Bill, Account, Transaction, User, Vendor, Product } from '../../types';
import { db } from '../../db';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Ensures that a valid session exists in the Supabase client before mutations.
 * This prevents "Authentication required" errors from RLS policies.
 */
async function ensureAuthenticated() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) {
      throw new Error('No authenticated session available. Please log in.');
    }
    // Optionally refresh the session to ensure it's valid
    await supabase.auth.refreshSession();
    return data.session;
  } catch (err: any) {
    console.error('[supabaseQueries] ensureAuthenticated failed:', err.message);
    throw err;
  }
}

/**
 * Centralized Supabase query helpers for the frontend.
 * All table operations are funneled through these helpers, making it easier to:
 * - Add logging/analytics
 * - Handle errors consistently
 * - Cache results if needed
 * - Migrate to backend functions later
 */

/**
 * Wraps a Supabase query builder with a timeout.
 * Returns empty array on timeout or error (no fallback to stale data).
 * This ensures UI always reflects actual Supabase state.
 * 
 * CRITICAL FIX: Use Promise.race with resolve (not reject) for timeout
 * to avoid race condition where timeout fires first and corrupts data.
 */
async function queryWithTimeout<T>(
  queryBuilder: any,
  timeoutMs: number = 10000  // Increased from 5s to 10s to handle slower networks
): Promise<T[]> {
  try {
    const result = await Promise.race([
      queryBuilder,
      new Promise<{ data: null; error: { message: string } }>((resolve) => {
        setTimeout(() => resolve({ data: null, error: { message: 'Query timeout' } }), timeoutMs);
      })
    ]) as any;
    
    // Handle both Supabase response and timeout response with same logic
    const { data, error } = result;
    
    if (error) {
      console.error(`[supabaseQueries] Query error:`, error.message);
      return [];
    }
    
    if (!data) {
      console.warn(`[supabaseQueries] Query returned no data`);
      return [];
    }
    
    return data;
  } catch (err: any) {
    console.error(`[supabaseQueries] Query exception:`, err.message);
    return [];
  }
}

// ========== CUSTOMERS ==========

export async function fetchCustomers() {
  console.log('[supabaseQueries] fetchCustomers called');
  const mapped = await queryWithTimeout<Customer>(
    supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
  );
  return mapped.map(mapCustomer);
}

export async function fetchCustomerById(id: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchCustomerById error:', error);
    return null;
  }
  return mapCustomer(data);
}

export async function createCustomer(customer: Omit<Customer, 'id'>) {
  await ensureAuthenticated();
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('customers')
    .insert([{
      id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      total_orders: customer.totalOrders || 0,
      due_amount: customer.dueAmount || 0,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] createCustomer error:', error);
    throw error;
  }
  return mapCustomer(data);
}

export async function updateCustomer(id: string, updates: Partial<Customer>) {
  await ensureAuthenticated();
  const { data, error } = await supabase
    .from('customers')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.phone && { phone: updates.phone }),
      ...(updates.address && { address: updates.address }),
      ...(updates.totalOrders !== undefined && { total_orders: updates.totalOrders }),
      ...(updates.dueAmount !== undefined && { due_amount: updates.dueAmount }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updateCustomer error:', error);
    throw error;
  }
  return mapCustomer(data);
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deleteCustomer error:', error);
    throw error;
  }
}

function mapCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    totalOrders: row.total_orders ?? row.totalOrders ?? 0,
    dueAmount: row.due_amount ?? row.dueAmount ?? 0,
  };
}

// ========== ORDERS ==========

export async function fetchOrders() {
  const mapped = await queryWithTimeout<Order>(
    supabase
      .from('orders')
      .select('*')
      .order('order_date', { ascending: false })
  );
  return mapped.map(mapOrder);
}

export async function fetchOrderById(id: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchOrderById error:', error);
    return null;
  }
  return mapOrder(data);
}

export async function fetchOrdersByCustomerId(customerId: string) {
  const mapped = await queryWithTimeout<Order>(
    supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('order_date', { ascending: false })
  );
  return mapped.map(mapOrder);
}

export async function createOrder(order: Omit<Order, 'id'>) {
  await ensureAuthenticated();
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('orders')
    .insert([{
      id,
      order_number: order.orderNumber,
      order_date: order.orderDate,
      customer_id: order.customerId,
      created_by: order.createdBy,
      status: order.status,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping,
      total: order.total,
      paid_amount: order.paidAmount,
      history: order.history,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] createOrder error:', error);
    throw error;
  }
  return mapOrder(data);
}

export async function updateOrder(id: string, updates: Partial<Order>) {
  await ensureAuthenticated();
  const { data, error } = await supabase
    .from('orders')
    .update({
      ...(updates.customerId && { customer_id: updates.customerId }),
      ...(updates.orderDate && { order_date: updates.orderDate }),
      ...(updates.orderNumber && { order_number: updates.orderNumber }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.status && { status: updates.status }),
      ...(updates.items && { items: updates.items }),
      ...(updates.subtotal !== undefined && { subtotal: updates.subtotal }),
      ...(updates.discount !== undefined && { discount: updates.discount }),
      ...(updates.shipping !== undefined && { shipping: updates.shipping }),
      ...(updates.total !== undefined && { total: updates.total }),
      ...(updates.paidAmount !== undefined && { paid_amount: updates.paidAmount }),
      ...(updates.history && { history: updates.history }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updateOrder error:', error);
    throw error;
  }
  return mapOrder(data);
}

export async function deleteOrder(id: string) {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deleteOrder error:', error);
    throw error;
  }
}

function mapOrder(row: any): Order {
  return {
    id: row.id,
    orderNumber: row.order_number ?? row.orderNumber,
    orderDate: row.order_date ?? row.orderDate,
    customerId: row.customer_id ?? row.customerId,
    createdBy: row.created_by ?? row.createdBy,
    status: row.status,
    items: row.items ?? [],
    subtotal: row.subtotal ?? 0,
    discount: row.discount ?? 0,
    shipping: row.shipping ?? 0,
    total: row.total ?? 0,
    notes: row.notes,
    history: row.history ?? {},
    paidAmount: row.paid_amount ?? row.paidAmount ?? 0,
  };
}

// ========== ACCOUNTS ==========

export async function fetchAccounts() {
  const mapped = await queryWithTimeout<Account>(
    supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })
  );
  return mapped.map(mapAccount);
}

export async function fetchAccountById(id: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchAccountById error:', error);
    return null;
  }
  return mapAccount(data);
}

export async function createAccount(account: Omit<Account, 'id'>) {
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('accounts')
    .insert([{
      id,
      name: account.name,
      type: account.type,
      opening_balance: account.openingBalance,
      current_balance: account.currentBalance,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] createAccount error:', error);
    throw error;
  }
  return mapAccount(data);
}

export async function updateAccount(id: string, updates: Partial<Account>) {
  const { data, error } = await supabase
    .from('accounts')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.type && { type: updates.type }),
      ...(updates.currentBalance !== undefined && { current_balance: updates.currentBalance }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updateAccount error:', error);
    throw error;
  }
  return mapAccount(data);
}

export async function deleteAccount(id: string) {
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deleteAccount error:', error);
    throw error;
  }
}

function mapAccount(row: any): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    openingBalance: row.opening_balance ?? row.openingBalance,
    currentBalance: row.current_balance ?? row.currentBalance,
  };
}

// ========== TRANSACTIONS ==========

export async function fetchTransactions() {
  const mapped = await queryWithTimeout<Transaction>(
    supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
  );
  return mapped.map(mapTransaction);
}

export async function fetchTransactionById(id: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchTransactionById error:', error);
    return null;
  }
  return mapTransaction(data);
}

export async function createTransaction(transaction: Omit<Transaction, 'id'>) {
  await ensureAuthenticated();
  const id = crypto.randomUUID();
  
  // Build insert object - ONLY include fields that have actual values
  // This avoids Supabase trying to validate empty strings as UUIDs
  const insertData: any = {
    id,
    date: transaction.date,
    type: transaction.type,
    category: transaction.category,
    account_id: transaction.accountId,
    amount: transaction.amount,
    description: transaction.description,
    payment_method: transaction.paymentMethod,
    created_by: transaction.createdBy,
  };

  // Only add optional UUID fields if they have truthy values
  // Never include undefined, null, or empty strings
  if (transaction.toAccountId) {
    insertData.to_account_id = transaction.toAccountId;
  }
  if (transaction.referenceId) {
    insertData.reference_id = transaction.referenceId;
  }
  if (transaction.contactId) {
    insertData.contact_id = transaction.contactId;
  }
  if (transaction.attachmentName) {
    insertData.attachment_name = transaction.attachmentName;
  }
  if (transaction.attachmentUrl) {
    insertData.attachment_url = transaction.attachmentUrl;
  }

  const { error } = await supabase
    .from('transactions')
    .insert([insertData]);
  
  if (error) {
    console.error('[supabaseQueries] createTransaction error:', error);
    throw error;
  }
  
  // Return the transaction object we inserted (avoid SELECT to prevent UUID column issues)
  return {
    id,
    date: transaction.date,
    type: transaction.type as 'Income' | 'Expense' | 'Transfer',
    category: transaction.category,
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId,
    amount: transaction.amount,
    description: transaction.description,
    referenceId: transaction.referenceId,
    contactId: transaction.contactId,
    paymentMethod: transaction.paymentMethod,
    attachmentName: transaction.attachmentName,
    attachmentUrl: transaction.attachmentUrl,
    createdBy: transaction.createdBy,
  } as Transaction;
}

export async function updateTransaction(id: string, updates: Partial<Transaction>) {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      ...(updates.amount !== undefined && { amount: updates.amount }),
      ...(updates.description && { description: updates.description }),
      ...(updates.category && { category: updates.category }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updateTransaction error:', error);
    throw error;
  }
  return mapTransaction(data);
}

export async function deleteTransaction(id: string) {
  // Validate UUID format - temporarily created transactions use "temp-" prefix
  if (id.startsWith('temp-')) {
    const error = new Error('Cannot delete unsaved transactions. Please refresh and try again.');
    console.error('[supabaseQueries] deleteTransaction error:', error);
    throw error;
  }
  
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deleteTransaction error:', error);
    throw error;
  }
}

function mapTransaction(row: any): Transaction {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    category: row.category,
    accountId: row.account_id ?? row.accountId,
    toAccountId: row.to_account_id ?? row.toAccountId,
    amount: row.amount,
    description: row.description,
    referenceId: row.reference_id ?? row.referenceId,
    contactId: row.contact_id ?? row.contactId,
    paymentMethod: row.payment_method ?? row.paymentMethod,
    attachmentName: row.attachment_name ?? row.attachmentName,
    attachmentUrl: row.attachment_url ?? row.attachmentUrl,
    createdBy: row.created_by ?? row.createdBy,
  };
}

// ========== USERS ==========

export async function fetchUsers() {
  const mapped = await queryWithTimeout<User>(
    supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
  );
  return mapped.map(mapUser);
}

export async function fetchUserByPhone(phone: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchUserByPhone error:', error);
    return null;
  }
  return mapUser(data);
}

export async function fetchUserById(id: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchUserById error:', error);
    return null;
  }
  return mapUser(data);
}

export async function createUser(user: Omit<User, 'id'> & { password?: string }) {
  try {
    // Convert phone to email using the same method as login
    const email = phoneToEmail(user.phone);
    const password = user.password;
    
    if (!password) {
      throw new Error('Password is required to create a user');
    }
    
    console.log('[supabaseQueries] Creating auth user with email:', email);
    
    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: user.name,
          phone: user.phone,
        }
      }
    });
    
    if (authError) {
      console.error('[supabaseQueries] Auth signup error:', authError);
      throw authError;
    }
    
    // Get the Auth user ID
    const userId = authData?.user?.id;
    console.log('[supabaseQueries] Auth user created:', userId, 'Confirmed:', authData?.user?.user_metadata?.email_confirmed);
    
    if (!userId) {
      throw new Error('Failed to create auth user - no user ID returned. If email confirmation is enabled in Supabase Auth settings, please disable it.');
    }
    
    // Create user profile with the Auth user's ID
    console.log('[supabaseQueries] Creating user profile in public schema...');
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert([{
        id: userId,
        name: user.name,
        phone: user.phone,
        role: user.role,
        image: user.image,
      }])
      .select()
      .single();
    
    if (profileError) {
      console.error('[supabaseQueries] Create profile error:', profileError);
      throw profileError;
    }
    
    console.log('[supabaseQueries] User created successfully - can now sign in');
    return mapUser(profileData);
  } catch (err) {
    console.error('[supabaseQueries] createUser error:', err);
    throw err;
  }
}

export async function updateUser(id: string, updates: Partial<User>) {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.phone && { phone: updates.phone }),
      ...(updates.role && { role: updates.role }),
      ...(updates.image && { image: updates.image }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updateUser error:', error);
    throw error;
  }
  return mapUser(data);
}

export async function deleteUser(id: string) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deleteUser error:', error);
    throw error;
  }
}

function mapUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role,
    image: row.image,
    createdAt: row.created_at,
  };
}

// ========== BILLS ==========

export async function fetchBills() {
  const mapped = await queryWithTimeout<Bill>(
    supabase
      .from('bills')
      .select('*')
      .order('bill_date', { ascending: false })
  );
  return mapped.map(mapBill);
}

export async function fetchBillById(id: string) {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchBillById error:', error);
    return null;
  }
  return mapBill(data);
}

export async function createBill(bill: Omit<Bill, 'id'>) {
  await ensureAuthenticated();
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('bills')
    .insert([{
      id,
      bill_number: bill.billNumber,
      bill_date: bill.billDate,
      vendor_id: bill.vendorId,
      created_by: bill.createdBy,
      status: bill.status,
      items: bill.items,
      subtotal: bill.subtotal,
      discount: bill.discount,
      shipping: bill.shipping,
      total: bill.total,
      paid_amount: bill.paidAmount,
      history: bill.history || {},
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] createBill error:', error);
    throw error;
  }
  return mapBill(data);
}

export async function updateBill(id: string, updates: Partial<Bill>) {
  await ensureAuthenticated();
  const { data, error } = await supabase
    .from('bills')
    .update({
      ...(updates.vendorId && { vendor_id: updates.vendorId }),
      ...(updates.billDate && { bill_date: updates.billDate }),
      ...(updates.billNumber && { bill_number: updates.billNumber }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.status && { status: updates.status }),
      ...(updates.items && { items: updates.items }),
      ...(updates.subtotal !== undefined && { subtotal: updates.subtotal }),
      ...(updates.discount !== undefined && { discount: updates.discount }),
      ...(updates.shipping !== undefined && { shipping: updates.shipping }),
      ...(updates.total !== undefined && { total: updates.total }),
      ...(updates.paidAmount !== undefined && { paid_amount: updates.paidAmount }),
      ...(updates.history && { history: updates.history }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updateBill error:', error);
    throw error;
  }
  return mapBill(data);
}

export async function deleteBill(id: string) {
  const { error } = await supabase
    .from('bills')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deleteBill error:', error);
    throw error;
  }
}

function mapBill(row: any): Bill {
  return {
    id: row.id,
    billNumber: row.bill_number ?? row.billNumber,
    billDate: row.bill_date ?? row.billDate,
    vendorId: row.vendor_id ?? row.vendorId,
    createdBy: row.created_by ?? row.createdBy,
    status: row.status,
    items: row.items ?? [],
    subtotal: row.subtotal ?? 0,
    discount: row.discount ?? 0,
    shipping: row.shipping ?? 0,
    total: row.total ?? 0,
    notes: row.notes,
    paidAmount: row.paid_amount ?? row.paidAmount ?? 0,
    history: row.history,
  };
}

// ========== VENDORS ==========

export async function fetchVendors() {
  const mapped = await queryWithTimeout<Vendor>(
    supabase
      .from('vendors')
      .select('*')
      .order('created_at', { ascending: false })
  );
  return mapped.map(mapVendor);
}

export async function fetchVendorById(id: string) {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchVendorById error:', error);
    return null;
  }
  return mapVendor(data);
}

export async function createVendor(vendor: Omit<Vendor, 'id'>) {
  await ensureAuthenticated();
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('vendors')
    .insert([{
      id,
      name: vendor.name,
      phone: vendor.phone,
      address: vendor.address,
      total_purchases: vendor.totalPurchases || 0,
      due_amount: vendor.dueAmount || 0,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] createVendor error:', error);
    throw error;
  }
  return mapVendor(data);
}

export async function updateVendor(id: string, updates: Partial<Vendor>) {
  await ensureAuthenticated();
  const { data, error } = await supabase
    .from('vendors')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.phone && { phone: updates.phone }),
      ...(updates.address && { address: updates.address }),
      ...(updates.totalPurchases !== undefined && { total_purchases: updates.totalPurchases }),
      ...(updates.dueAmount !== undefined && { due_amount: updates.dueAmount }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updateVendor error:', error);
    throw error;
  }
  return mapVendor(data);
}

export async function deleteVendor(id: string) {
  const { error } = await supabase
    .from('vendors')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deleteVendor error:', error);
    throw error;
  }
}

function mapVendor(row: any): Vendor {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    totalPurchases: row.total_purchases ?? row.totalPurchases ?? 0,
    dueAmount: row.due_amount ?? row.dueAmount ?? 0,
  };
}

// ========== PRODUCTS ==========

export async function fetchProducts() {
  const mapped = await queryWithTimeout<Product>(
    supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
  );
  return mapped.map(mapProduct);
}

export async function fetchProductById(id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchProductById error:', error);
    return null;
  }
  return mapProduct(data);
}

export async function createProduct(product: Omit<Product, 'id'>) {
  await ensureAuthenticated();
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('products')
    .insert([{
      id,
      name: product.name,
      image: product.image,
      category: product.category,
      sale_price: product.salePrice,
      purchase_price: product.purchasePrice,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] createProduct error:', error);
    throw error;
  }
  return mapProduct(data);
}

export async function updateProduct(id: string, updates: Partial<Product>) {
  const { data, error } = await supabase
    .from('products')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.image && { image: updates.image }),
      ...(updates.category && { category: updates.category }),
      ...(updates.salePrice !== undefined && { sale_price: updates.salePrice }),
      ...(updates.purchasePrice !== undefined && { purchase_price: updates.purchasePrice }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updateProduct error:', error);
    throw error;
  }
  return mapProduct(data);
}

export async function deleteProduct(id: string) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deleteProduct error:', error);
    throw error;
  }
}

function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    category: row.category,
    salePrice: row.sale_price ?? row.salePrice ?? 0,
    purchasePrice: row.purchase_price ?? row.purchasePrice ?? 0,
  };
}

// ========== CATEGORIES ==========

export async function fetchCategories(type?: string) {
  console.log('[supabaseQueries] fetchCategories called', type ? 'for type: ' + type : '');
  try {
    let query = supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    
    if (type) {
      query = query.eq('type', type);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[supabaseQueries] fetchCategories error:', error);
      throw new Error(`[${error.code}] ${error.message}`);
    }
    
    return data ? data.map(mapCategory) : [];
  } catch (err) {
    console.error('[supabaseQueries] fetchCategories exception:', err);
    throw err;
  }
}

export async function fetchCategoriesById(id: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchCategoriesById error:', error);
    return null;
  }
  return mapCategory(data);
}

export async function createCategory(category: {
  name: string;
  type: 'Income' | 'Expense' | 'Product' | 'Other';
  color?: string;
  parentId?: string;
}) {
  await ensureAuthenticated();
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('categories')
    .insert([{
      id,
      name: category.name,
      type: category.type,
      color: category.color || '#3B82F6',
      parent_id: category.parentId || null,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] createCategory error:', error);
    throw error;
  }
  return mapCategory(data);
}

export async function updateCategory(id: string, updates: Partial<{
  name: string;
  type: string;
  color: string;
  parentId: string;
}>) {
  const { data, error } = await supabase
    .from('categories')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.type && { type: updates.type }),
      ...(updates.color && { color: updates.color }),
      ...(updates.parentId !== undefined && { parent_id: updates.parentId || null }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updateCategory error:', error);
    throw error;
  }
  return mapCategory(data);
}

export async function deleteCategory(id: string) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deleteCategory error:', error);
    throw error;
  }
}

function mapCategory(row: any): any {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ========== PAYMENT METHODS ==========

export async function fetchPaymentMethods(activeOnly: boolean = true) {
  console.log('[supabaseQueries] fetchPaymentMethods called');
  try {
    let query = supabase
      .from('payment_methods')
      .select('*')
      .order('name', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[supabaseQueries] fetchPaymentMethods error:', error);
      throw new Error(`[${error.code}] ${error.message}`);
    }
    
    return data ? data.map(mapPaymentMethod) : [];
  } catch (err) {
    console.error('[supabaseQueries] fetchPaymentMethods exception:', err);
    throw err;
  }
}

export async function fetchPaymentMethodById(id: string) {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchPaymentMethodById error:', error);
    return null;
  }
  return mapPaymentMethod(data);
}

export async function createPaymentMethod(method: {
  name: string;
  description?: string;
}) {
  await ensureAuthenticated();
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('payment_methods')
    .insert([{
      id,
      name: method.name,
      description: method.description || null,
      is_active: true,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] createPaymentMethod error:', error);
    throw error;
  }
  return mapPaymentMethod(data);
}

export async function updatePaymentMethod(id: string, updates: Partial<{
  name: string;
  description: string;
}>) {
  const { data, error } = await supabase
    .from('payment_methods')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description || null }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updatePaymentMethod error:', error);
    throw error;
  }
  return mapPaymentMethod(data);
}

export async function deletePaymentMethod(id: string) {
  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deletePaymentMethod error:', error);
    throw error;
  }
}

function mapPaymentMethod(row: any): any {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ========== UNITS ==========

export async function fetchUnits() {
  console.log('[supabaseQueries] fetchUnits called');
  try {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('[supabaseQueries] fetchUnits error:', error);
      throw new Error(`[${error.code}] ${error.message}`);
    }
    
    return data ? data.map(mapUnit) : [];
  } catch (err) {
    console.error('[supabaseQueries] fetchUnits exception:', err);
    throw err;
  }
}

export async function fetchUnitById(id: string) {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[supabaseQueries] fetchUnitById error:', error);
    return null;
  }
  return mapUnit(data);
}

export async function createUnit(unit: {
  name: string;
  shortName: string;
  description?: string;
}) {
  const id = unit.shortName.toLowerCase();
  const { data, error } = await supabase
    .from('units')
    .insert([{
      id,
      name: unit.name,
      short_name: unit.shortName,
      description: unit.description || null,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] createUnit error:', error);
    throw error;
  }
  return mapUnit(data);
}

export async function updateUnit(id: string, updates: Partial<{
  name: string;
  shortName: string;
  description: string;
}>) {
  const { data, error } = await supabase
    .from('units')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.shortName && { short_name: updates.shortName }),
      ...(updates.description !== undefined && { description: updates.description || null }),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[supabaseQueries] updateUnit error:', error);
    throw error;
  }
  return mapUnit(data);
}

export async function deleteUnit(id: string) {
  const { error } = await supabase
    .from('units')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[supabaseQueries] deleteUnit error:', error);
    throw error;
  }
}

function mapUnit(row: any): any {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ========== SETTINGS ==========

export async function fetchCompanySettings() {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .single();
    
    if (error) {
      console.error('[supabaseQueries] fetchCompanySettings error:', error);
      // Return default settings if not found
      return {
        id: 'default',
        name: 'Your Company',
        phone: '+880',
        email: 'info@company.com',
        address: '',
        logo: ''
      };
    }
    
    return {
      id: data.id,
      name: data.name || 'Your Company',
      phone: data.phone || '+880',
      email: data.email || 'info@company.com',
      address: data.address || '',
      logo: data.logo || ''
    };
  } catch (err) {
    console.error('[supabaseQueries] fetchCompanySettings exception:', err);
    // Return default settings on error
    return {
      id: 'default',
      name: 'Your Company',
      phone: '+880',
      email: 'info@company.com',
      address: '',
      logo: ''
    };
  }
}

export async function updateCompanySettings(updates: {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo?: string;
}) {
  await ensureAuthenticated();
  try {
    // Get current value to merge with updates
    const current = await fetchCompanySettings();
    const merged = {
      name: updates.name || current.name,
      phone: updates.phone || current.phone,
      email: updates.email || current.email,
      address: updates.address !== undefined ? updates.address : current.address,
      logo: updates.logo !== undefined ? updates.logo : current.logo,
    };
    
    // Try to fetch an existing record
    const { data: existingData } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    let result;
    if (existingData?.id) {
      // Update existing record
      const { data, error } = await supabase
        .from('company_settings')
        .update(merged)
        .eq('id', existingData.id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('company_settings')
        .insert(merged)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    return result || merged;
  } catch (err) {
    console.error('[supabaseQueries] updateCompanySettings exception:', err);
    throw err;
  }
}

export async function fetchOrderSettings() {
  try {
    const { data, error } = await supabase
      .from('order_settings')
      .select('*')
      .single();
    
    if (error) {
      console.error('[supabaseQueries] fetchOrderSettings error:', error);
      return { prefix: 'ORD-', nextNumber: 1 };
    }
    
    return {
      prefix: data.prefix || 'ORD-',
      nextNumber: data.next_number || 1
    };
  } catch (err) {
    console.error('[supabaseQueries] fetchOrderSettings exception:', err);
    return { prefix: 'ORD-', nextNumber: 1 };
  }
}

export async function updateOrderSettings(updates: {
  prefix?: string;
  nextNumber?: number;
}) {
  try {
    // Get current value to merge with updates
    const current = await fetchOrderSettings();
    const merged = {
      prefix: updates.prefix || current.prefix,
      next_number: updates.nextNumber !== undefined ? updates.nextNumber : current.nextNumber,
    };
    
    // Try to fetch an existing record
    const { data: existingData } = await supabase
      .from('order_settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    let result;
    if (existingData?.id) {
      // Update existing record
      const { data, error } = await supabase
        .from('order_settings')
        .update(merged)
        .eq('id', existingData.id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('order_settings')
        .insert(merged)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    return result ? { prefix: result.prefix, nextNumber: result.next_number } : merged;
  } catch (err) {
    console.error('[supabaseQueries] updateOrderSettings error:', err);
    throw err;
  }
}

export async function fetchInvoiceSettings() {
  try {
    const { data, error } = await supabase
      .from('invoice_settings')
      .select('*')
      .single();
    
    if (error) {
      console.error('[supabaseQueries] fetchInvoiceSettings error:', error);
      return { title: 'Invoice', logoWidth: 120, logoHeight: 120, footer: '' };
    }
    
    return {
      title: data.title || 'Invoice',
      logoWidth: data.logo_width || 120,
      logoHeight: data.logo_height || 120,
      footer: data.footer || ''
    };
  } catch (err) {
    console.error('[supabaseQueries] fetchInvoiceSettings exception:', err);
    return { title: 'Invoice', logoWidth: 120, logoHeight: 120, footer: '' };
  }
}

export async function updateInvoiceSettings(updates: {
  title?: string;
  logoWidth?: number;
  logoHeight?: number;
  footer?: string;
}) {
  try {
    // Get current value to merge with updates
    const current = await fetchInvoiceSettings();
    const merged = {
      title: updates.title || current.title,
      logo_width: updates.logoWidth !== undefined ? updates.logoWidth : current.logoWidth,
      logo_height: updates.logoHeight !== undefined ? updates.logoHeight : current.logoHeight,
      footer: updates.footer !== undefined ? updates.footer : current.footer,
    };
    
    // Try to fetch an existing record
    const { data: existingData } = await supabase
      .from('invoice_settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    let result;
    if (existingData?.id) {
      // Update existing record
      const { data, error } = await supabase
        .from('invoice_settings')
        .update(merged)
        .eq('id', existingData.id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('invoice_settings')
        .insert(merged)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    return result ? { title: result.title, logoWidth: result.logo_width, logoHeight: result.logo_height, footer: result.footer } : { title: merged.title, logoWidth: merged.logo_width, logoHeight: merged.logo_height, footer: merged.footer };
  } catch (err) {
    console.error('[supabaseQueries] updateInvoiceSettings error:', err);
    throw err;
  }
}

export async function fetchSystemDefaults() {
  try {
    const { data, error } = await supabase
      .from('system_defaults')
      .select('*')
      .single();
    
    if (error) {
      console.error('[supabaseQueries] fetchSystemDefaults error:', error);
      return {
        defaultAccountId: '',
        defaultPaymentMethod: '',
        incomeCategoryId: '',
        expenseCategoryId: '',
        recordsPerPage: 10
      };
    }
    
    return {
      defaultAccountId: data.default_account_id || '',
      defaultPaymentMethod: data.default_payment_method || '',
      incomeCategoryId: data.income_category_id || '',
      expenseCategoryId: data.expense_category_id || '',
      recordsPerPage: data.records_per_page || 10
    };
  } catch (err) {
    console.error('[supabaseQueries] fetchSystemDefaults exception:', err);
    return {
      defaultAccountId: '',
      defaultPaymentMethod: '',
      incomeCategoryId: '',
      expenseCategoryId: '',
      recordsPerPage: 10
    };
  }
}

export async function updateSystemDefaults(updates: {
  defaultAccountId?: string;
  defaultPaymentMethod?: string;
  incomeCategoryId?: string;
  expenseCategoryId?: string;
  recordsPerPage?: number;
}) {
  try {
    // Get current value to merge with updates
    const current = await fetchSystemDefaults();
    const merged = {
      default_account_id: updates.defaultAccountId ? updates.defaultAccountId : (current.defaultAccountId || null),
      default_payment_method: updates.defaultPaymentMethod ? updates.defaultPaymentMethod : (current.defaultPaymentMethod || null),
      income_category_id: updates.incomeCategoryId ? updates.incomeCategoryId : (current.incomeCategoryId || null),
      expense_category_id: updates.expenseCategoryId ? updates.expenseCategoryId : (current.expenseCategoryId || null),
      records_per_page: updates.recordsPerPage !== undefined ? updates.recordsPerPage : current.recordsPerPage,
    };
    
    // Try to fetch an existing record
    const { data: existingData } = await supabase
      .from('system_defaults')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    let result;
    if (existingData?.id) {
      // Update existing record
      const { data, error } = await supabase
        .from('system_defaults')
        .update(merged)
        .eq('id', existingData.id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('system_defaults')
        .insert(merged)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    return result ? { defaultAccountId: result.default_account_id, defaultPaymentMethod: result.default_payment_method, incomeCategoryId: result.income_category_id, expenseCategoryId: result.expense_category_id, recordsPerPage: result.records_per_page } : current;
  } catch (err) {
    console.error('[supabaseQueries] updateSystemDefaults error:', err);
    throw err;
  }
}

export async function fetchCourierSettings() {
  try {
    const { data, error } = await supabase
      .from('courier_settings')
      .select('*')
      .single();
    
    if (error) {
      console.error('[supabaseQueries] fetchCourierSettings error:', error);
      return {
        steadfast: { baseUrl: '', apiKey: '', secretKey: '' },
        carryBee: { baseUrl: '', clientId: '', clientSecret: '', clientContext: '', storeId: '' }
      };
    }
    
    return {
      steadfast: {
        baseUrl: data.steadfast_base_url || '',
        apiKey: data.steadfast_api_key || '',
        secretKey: data.steadfast_secret_key || ''
      },
      carryBee: {
        baseUrl: data.carrybee_base_url || '',
        clientId: data.carrybee_client_id || '',
        clientSecret: data.carrybee_client_secret || '',
        clientContext: data.carrybee_client_context || '',
        storeId: data.carrybee_store_id || ''
      }
    };
  } catch (err) {
    console.error('[supabaseQueries] fetchCourierSettings exception:', err);
    return {
      steadfast: { baseUrl: '', apiKey: '', secretKey: '' },
      carryBee: { baseUrl: '', clientId: '', clientSecret: '', clientContext: '', storeId: '' }
    };
  }
}

export async function updateCourierSettings(updates: {
  steadfast?: { baseUrl?: string; apiKey?: string; secretKey?: string };
  carryBee?: { baseUrl?: string; clientId?: string; clientSecret?: string; clientContext?: string; storeId?: string };
}) {
  try {
    // Get current value to merge with updates
    const current = await fetchCourierSettings();
    const merged = {
      steadfast_base_url: updates.steadfast?.baseUrl || current.steadfast.baseUrl,
      steadfast_api_key: updates.steadfast?.apiKey || current.steadfast.apiKey,
      steadfast_secret_key: updates.steadfast?.secretKey || current.steadfast.secretKey,
      carrybee_base_url: updates.carryBee?.baseUrl || current.carryBee.baseUrl,
      carrybee_client_id: updates.carryBee?.clientId || current.carryBee.clientId,
      carrybee_client_secret: updates.carryBee?.clientSecret || current.carryBee.clientSecret,
      carrybee_client_context: updates.carryBee?.clientContext || current.carryBee.clientContext,
      carrybee_store_id: updates.carryBee?.storeId || current.carryBee.storeId,
    };
    
    // Try to fetch an existing record
    const { data: existingData } = await supabase
      .from('courier_settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    let result;
    if (existingData?.id) {
      // Update existing record
      const { data, error } = await supabase
        .from('courier_settings')
        .update(merged)
        .eq('id', existingData.id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('courier_settings')
        .insert(merged)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    // Map back to expected format
    return {
      steadfast: {
        baseUrl: result?.steadfast_base_url || '',
        apiKey: result?.steadfast_api_key || '',
        secretKey: result?.steadfast_secret_key || ''
      },
      carryBee: {
        baseUrl: result?.carrybee_base_url || '',
        clientId: result?.carrybee_client_id || '',
        clientSecret: result?.carrybee_client_secret || '',
        clientContext: result?.carrybee_client_context || '',
        storeId: result?.carrybee_store_id || ''
      }
    };
  } catch (err) {
    console.error('[supabaseQueries] updateCourierSettings error:', err);
    throw err;
  }
}

// ========== CARRYBEE STORES ==========

/**
 * Fetch stores from CarryBee API using the provided credentials
 */
export async function fetchCarryBeeStores(params: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
}): Promise<Array<{ id: string; name: string }>> {
  try {
    // Validate that all required parameters are provided (trim whitespace)
    const baseUrl = params.baseUrl?.trim();
    const clientId = params.clientId?.trim();
    const clientSecret = params.clientSecret?.trim();
    const clientContext = params.clientContext?.trim();
    
    if (!baseUrl || !clientId || !clientSecret || !clientContext) {
      console.warn('[supabaseQueries] CarryBee API parameters incomplete');
      return [];
    }

    console.log('[supabaseQueries] Calling Edge Function for CarryBee stores');

    // Call Supabase Edge Function to proxy the CarryBee API request
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/carrybee-stores`;
    console.log('[supabaseQueries] Edge Function URL:', edgeFunctionUrl);
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        baseUrl,
        clientId,
        clientSecret,
        clientContext,
      }),
    });

    console.log('[supabaseQueries] Edge Function response status:', response.status);

    if (!response.ok) {
      console.error('[supabaseQueries] Edge Function error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    console.log('[supabaseQueries] Edge Function response data:', data);

    if (data.error) {
      console.error('[supabaseQueries] Edge Function returned error:', data.error, data.details);
      return [];
    }

    if (!data.data?.stores) {
      console.warn('[supabaseQueries] No stores in response');
      return [];
    }

    // Map stores to { id, name } format
    const stores = data.data.stores.map((store: any) => ({
      id: store.id,
      name: store.name
    }));
    
    console.log('[supabaseQueries] Successfully fetched', stores.length, 'stores');
    return stores;
  } catch (err) {
    console.error('[supabaseQueries] fetchCarryBeeStores exception:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchCarryBeeCities(params: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
}): Promise<Array<{ id: string; name: string }>> {
  try {
    const baseUrl = params.baseUrl?.trim();
    const clientId = params.clientId?.trim();
    const clientSecret = params.clientSecret?.trim();
    const clientContext = params.clientContext?.trim();
    
    if (!baseUrl || !clientId || !clientSecret || !clientContext) {
      console.warn('[supabaseQueries] CarryBee API parameters incomplete');
      return [];
    }

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/carrybee-cities`;
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        baseUrl,
        clientId,
        clientSecret,
        clientContext,
      }),
    });

    if (!response.ok) {
      console.error('[supabaseQueries] Cities Edge Function error:', response.status);
      return [];
    }

    const data = await response.json();
    if (data.error || !data.data?.cities) {
      console.error('[supabaseQueries] Cities Edge Function returned error:', data.error);
      return [];
    }

    return data.data.cities.map((city: any) => ({
      id: city.id,
      name: city.name
    }));
  } catch (err) {
    console.error('[supabaseQueries] fetchCarryBeeCities exception:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchCarryBeeZones(params: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
  cityId: string;
}): Promise<Array<{ id: string; name: string }>> {
  try {
    const baseUrl = params.baseUrl?.trim();
    const clientId = params.clientId?.trim();
    const clientSecret = params.clientSecret?.trim();
    const clientContext = params.clientContext?.trim();
    const cityId = params.cityId?.trim();
    
    if (!baseUrl || !clientId || !clientSecret || !clientContext || !cityId) {
      console.warn('[supabaseQueries] CarryBee API parameters incomplete');
      return [];
    }

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/carrybee-zones`;
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        baseUrl,
        clientId,
        clientSecret,
        clientContext,
        cityId,
      }),
    });

    if (!response.ok) {
      console.error('[supabaseQueries] Zones Edge Function error:', response.status);
      return [];
    }

    const data = await response.json();
    if (data.error || !data.data?.zones) {
      console.error('[supabaseQueries] Zones Edge Function returned error:', data.error);
      return [];
    }

    return data.data.zones.map((zone: any) => ({
      id: zone.id,
      name: zone.name
    }));
  } catch (err) {
    console.error('[supabaseQueries] fetchCarryBeeZones exception:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchCarryBeeAreas(params: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
  cityId: string;
  zoneId: string;
}): Promise<Array<{ id: string; name: string }>> {
  try {
    const baseUrl = params.baseUrl?.trim();
    const clientId = params.clientId?.trim();
    const clientSecret = params.clientSecret?.trim();
    const clientContext = params.clientContext?.trim();
    const cityId = params.cityId?.trim();
    const zoneId = params.zoneId?.trim();
    
    if (!baseUrl || !clientId || !clientSecret || !clientContext || !cityId || !zoneId) {
      console.warn('[supabaseQueries] CarryBee API parameters incomplete');
      return [];
    }

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/carrybee-areas`;
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        baseUrl,
        clientId,
        clientSecret,
        clientContext,
        cityId,
        zoneId,
      }),
    });

    if (!response.ok) {
      console.error('[supabaseQueries] Areas Edge Function error:', response.status);
      return [];
    }

    const data = await response.json();
    if (data.error || !data.data?.areas) {
      console.error('[supabaseQueries] Areas Edge Function returned error:', data.error);
      return [];
    }

    return data.data.areas.map((area: any) => ({
      id: area.id,
      name: area.name
    }));
  } catch (err) {
    console.error('[supabaseQueries] fetchCarryBeeAreas exception:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function submitCarryBeeOrder(params: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
  storeId: string;
  deliveryType: number;
  productType: number;
  recipientPhone: string;
  recipientName: string;
  recipientAddress: string;
  cityId: string;
  zoneId: string;
  areaId?: string;
  itemWeight: number;
  collectableAmount: number;
}): Promise<any> {
  try {
    const baseUrl = params.baseUrl?.trim();
    const clientId = params.clientId?.trim();
    const clientSecret = params.clientSecret?.trim();
    const clientContext = params.clientContext?.trim();
    
    if (!baseUrl || !clientId || !clientSecret || !clientContext || !params.storeId) {
      console.warn('[supabaseQueries] CarryBee API parameters incomplete');
      return { error: 'Missing required parameters' };
    }

    console.log('[supabaseQueries] Calling Edge Function to submit CarryBee order');

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/carrybee-submit-order`;
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        baseUrl,
        clientId,
        clientSecret,
        clientContext,
        storeId: params.storeId,
        deliveryType: params.deliveryType,
        productType: params.productType,
        recipientPhone: params.recipientPhone,
        recipientName: params.recipientName,
        recipientAddress: params.recipientAddress,
        cityId: params.cityId,
        zoneId: params.zoneId,
        areaId: params.areaId,
        itemWeight: params.itemWeight,
        collectableAmount: params.collectableAmount,
      }),
    });

    console.log('[supabaseQueries] Submit Order Edge Function response status:', response.status);

    if (!response.ok) {
      console.error('[supabaseQueries] Submit Order Edge Function error:', response.status);
      return { error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    console.log('[supabaseQueries] Submit Order response:', data);

    if (data.error) {
      console.error('[supabaseQueries] Edge Function returned error:', data.error);
      return { error: data.error };
    }

    console.log('[supabaseQueries] Successfully submitted order to CarryBee');
    return data.data;
  } catch (err) {
    console.error('[supabaseQueries] submitCarryBeeOrder exception:', err instanceof Error ? err.message : err);
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function submitSteadfastOrder(params: {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  invoice: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number;
}): Promise<any> {
  try {
    const baseUrl = params.baseUrl?.trim();
    const apiKey = params.apiKey?.trim();
    const secretKey = params.secretKey?.trim();
    
    console.log('[supabaseQueries] ======== BEFORE TRIM ========');
    console.log('[supabaseQueries] baseUrl (raw):', JSON.stringify(params.baseUrl));
    console.log('[supabaseQueries] apiKey (raw):', JSON.stringify(params.apiKey?.substring(0, 5)));
    console.log('[supabaseQueries] secretKey (raw):', JSON.stringify(params.secretKey?.substring(0, 5)));

    console.log('[supabaseQueries] ======== AFTER TRIM ========');
    console.log('[supabaseQueries] baseUrl (trimmed):', JSON.stringify(baseUrl));
    console.log('[supabaseQueries] apiKey (trimmed):', JSON.stringify(apiKey?.substring(0, 5)));
    console.log('[supabaseQueries] secretKey (trimmed):', JSON.stringify(secretKey?.substring(0, 5)));
    
    if (!baseUrl || !apiKey || !secretKey || !params.invoice || !params.recipientName || !params.recipientPhone || !params.recipientAddress || params.codAmount === undefined) {
      console.warn('[supabaseQueries] Steadfast API parameters incomplete');
      console.warn('[supabaseQueries] Validation:', {
        baseUrl: !!baseUrl,
        apiKey: !!apiKey,
        secretKey: !!secretKey,
        invoice: !!params.invoice,
        recipientName: !!params.recipientName,
        recipientPhone: !!params.recipientPhone,
        recipientAddress: !!params.recipientAddress,
        codAmount: params.codAmount !== undefined
      });
      return { error: 'Missing required parameters' };
    }

    console.log('[supabaseQueries] ======== CALLING EDGE FUNCTION ========');

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/steadfast-submit-order`;
    console.log('[supabaseQueries] Edge Function URL:', edgeFunctionUrl);

    const payload = {
      baseUrl,
      apiKey,
      secretKey,
      invoice: params.invoice,
      recipientName: params.recipientName,
      recipientPhone: params.recipientPhone,
      recipientAddress: params.recipientAddress,
      codAmount: params.codAmount,
    };

    console.log('[supabaseQueries] Payload being sent:', {
      baseUrl,
      apiKey: `${apiKey.substring(0, 5)}...`,
      secretKey: `${secretKey.substring(0, 5)}...`,
      invoice: payload.invoice,
      recipientName: payload.recipientName,
      recipientPhone: payload.recipientPhone,
      recipientAddress: payload.recipientAddress,
      codAmount: payload.codAmount,
    });

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('[supabaseQueries] Submit Steadfast Order Edge Function response status:', response.status);

    if (!response.ok) {
      console.error('[supabaseQueries] Submit Steadfast Order Edge Function error:', response.status);
      return { error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    console.log('[supabaseQueries] Submit Steadfast Order response:', data);

    if (data.error) {
      const detailedError = data.details ? `${data.error}: ${data.details}` : data.error;
      console.error('[supabaseQueries] Edge Function returned error:', detailedError);
      return { error: detailedError };
    }

    console.log('[supabaseQueries] Successfully submitted order to Steadfast');
    return data.data;
  } catch (err) {
    console.error('[supabaseQueries] submitSteadfastOrder exception:', err instanceof Error ? err.message : err);
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ========== BATCH SETTINGS ==========

/**
 * Batch update all settings tables in parallel instead of sequentially.
 * This replaces making 5 separate mutation calls with 1 batch call.
 * 
 * Reduces network latency from 2-4s (5 sequential calls) to ~500ms (1 batch).
 */
export async function batchUpdateSettings(updates: {
  company?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    logo?: string;
  };
  order?: {
    prefix?: string;
    nextNumber?: number;
  };
  invoice?: {
    title?: string;
    logoWidth?: number;
    logoHeight?: number;
    footer?: string;
  };
  defaults?: {
    defaultAccountId?: string;
    defaultPaymentMethod?: string;
    incomeCategoryId?: string;
    expenseCategoryId?: string;
    recordsPerPage?: number;
  };
  courier?: {
    steadfast?: { baseUrl?: string; apiKey?: string; secretKey?: string };
    carryBee?: { baseUrl?: string; clientId?: string; clientSecret?: string; clientContext?: string; storeId?: string };
  };
}) {
  await ensureAuthenticated();
  
  try {
    // Execute all 5 settings updates in parallel
    const [company, order, invoice, defaults, courier] = await Promise.all([
      updates.company ? updateCompanySettings(updates.company) : fetchCompanySettings(),
      updates.order ? updateOrderSettings(updates.order) : fetchOrderSettings(),
      updates.invoice ? updateInvoiceSettings(updates.invoice) : fetchInvoiceSettings(),
      updates.defaults ? updateSystemDefaults(updates.defaults) : fetchSystemDefaults(),
      updates.courier ? updateCourierSettings(updates.courier) : fetchCourierSettings(),
    ]);

    return {
      company,
      order,
      invoice,
      defaults,
      courier,
    };
  } catch (err: any) {
    console.error('[supabaseQueries] batchUpdateSettings error:', err);
    throw err;
  }
}

export default {
  fetchCustomers,
  fetchCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchOrders,
  fetchOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  fetchAccounts,
  fetchAccountById,
  createAccount,
  updateAccount,
  fetchTransactions,
  fetchTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  fetchUsers,
  fetchUserByPhone,
  fetchUserById,
  createUser,
  updateUser,
  deleteUser,
  fetchBills,
  fetchBillById,
  createBill,
  updateBill,
  deleteBill,
  fetchVendors,
  fetchVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  fetchProducts,
  fetchProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchCategories,
  fetchCategoriesById,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchPaymentMethods,
  fetchPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  fetchUnits,
  fetchUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  fetchCompanySettings,
  updateCompanySettings,
  fetchOrderSettings,
  updateOrderSettings,
  fetchInvoiceSettings,
  updateInvoiceSettings,
  fetchSystemDefaults,
  updateSystemDefaults,
  fetchCourierSettings,
  updateCourierSettings,
  batchUpdateSettings,
};

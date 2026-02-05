
import { User, UserRole, Order, OrderStatus, Bill, BillStatus, Customer, Vendor, Product, Account, Transaction, Settings } from './types';

// Initial Mock Data
export const initialUsers: User[] = [
  { id: '1', name: 'Admin User', phone: '01700000000', role: UserRole.ADMIN, image: 'https://picsum.photos/200/200?random=1', password: 'admin' },
  { id: '2', name: 'Shamim Ahmed', phone: '01711111111', role: UserRole.EMPLOYEE, image: 'https://picsum.photos/200/200?random=2', password: 'employee' },
];

export const initialCustomers: Customer[] = [
  { id: 'c1', name: 'Rahim Ullah', phone: '01811111111', address: 'Dhanmondi, Dhaka', totalOrders: 5, dueAmount: 1500 },
  { id: 'c2', name: 'Karim Sheikh', phone: '01822222222', address: 'Banani, Dhaka', totalOrders: 2, dueAmount: 0 },
];

export const initialVendors: Vendor[] = [
  { id: 'v1', name: 'Supplier One', phone: '01911111111', address: 'Gazipur, Dhaka', totalPurchases: 10, dueAmount: 5000 },
];

export const initialProducts: Product[] = [
  { id: 'p1', name: 'Casual Shirt', image: 'https://picsum.photos/100/100?random=10', category: 'Clothing', salePrice: 1200, purchasePrice: 800 },
  { id: 'p2', name: 'Slim Fit Denim', image: 'https://picsum.photos/100/100?random=11', category: 'Clothing', salePrice: 1500, purchasePrice: 1000 },
  { id: 'p3', name: 'Cotton T-Shirt', image: 'https://picsum.photos/100/100?random=12', category: 'Clothing', salePrice: 500, purchasePrice: 300 },
];

export const initialSettings: Settings = {
  company: {
    name: 'BD Hatbela',
    logo: 'https://picsum.photos/100/100?random=logo',
    phone: '01712345678',
    email: 'contact@bdhatbela.com',
    address: 'Dhaka, Bangladesh',
  },
  order: { prefix: 'BDH-', nextNumber: 105 },
  invoice: { title: 'Tax Invoice', logoWidth: 60, logoHeight: 60, footer: 'Thank you for shopping with BD Hatbela!' },
  defaults: { accountId: 'acc1', paymentMethod: 'Cash', incomeCategoryId: 'cat1', expenseCategoryId: 'cat2', recordsPerPage: 20 },
  categories: [
    { id: 'cat1', name: 'Sales', type: 'Income', color: '#10B981' },
    { id: 'cat2', name: 'Purchases', type: 'Expense', color: '#EF4444' },
    { id: 'cat3', name: 'Office Rent', type: 'Expense', color: '#F59E0B' },
  ],
  paymentMethods: [
    { id: 'pm1', name: 'Cash', description: 'On-hand physical currency' },
    { id: 'pm2', name: 'bKash', description: 'Mobile Banking' },
    { id: 'pm3', name: 'Bank Transfer', description: 'Direct transfer to account' },
  ],
  courier: {
    steadfast: { baseUrl: '', apiKey: '', secretKey: '' },
    carryBee: { baseUrl: '', clientId: '', clientSecret: '', clientContext: '', storeId: '' },
  },
};

export const initialAccounts: Account[] = [
  { id: 'acc1', name: 'Cash in Hand', type: 'Cash', openingBalance: 50000, currentBalance: 75000 },
  { id: 'acc2', name: 'DBBL Main', type: 'Bank', openingBalance: 100000, currentBalance: 120000 },
];

export const initialOrders: Order[] = [
  {
    id: 'o1',
    orderNumber: 'BDH-101',
    orderDate: '2026-01-20',
    customerId: 'c1',
    createdBy: 'Shamim Ahmed',
    status: OrderStatus.COMPLETED,
    items: [{ productId: 'p1', productName: 'Casual Shirt', rate: 1200, quantity: 2, amount: 2400 }],
    subtotal: 2400,
    discount: 100,
    shipping: 60,
    total: 2360,
    paidAmount: 2360,
    history: { created: 'Shamim Ahmed, 20 Jan 2026, 10:00 am', completed: 'Admin, 21 Jan 2026, 11:00 am' },
  },
  {
    id: 'o2',
    orderNumber: 'BDH-102',
    orderDate: '2026-01-22',
    customerId: 'c2',
    createdBy: 'Shamim Ahmed',
    status: OrderStatus.ON_HOLD,
    items: [{ productId: 'p2', productName: 'Slim Fit Denim', rate: 1500, quantity: 1, amount: 1500 }],
    subtotal: 1500,
    discount: 0,
    shipping: 60,
    total: 1560,
    paidAmount: 0,
    history: { created: 'Shamim Ahmed, 22 Jan 2026, 04:34 pm' },
  },
];

// Helper to get from local storage or use initial
const getFromStorage = <T,>(key: string, initial: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : initial;
};

// Global State (Simplified for SPA)
const _storedUsers = getFromStorage<User[]>('users', initialUsers);
const users = Array.isArray(_storedUsers)
  ? _storedUsers.map(u => {
      const init = initialUsers.find(i => i.id === u.id);
      return { ...u, password: u.password ?? init?.password } as User;
    })
  : initialUsers;

// ensure currentUser references the user object from `users`
const _storedCurrent = getFromStorage<User | null>('currentUser', initialUsers[0]);
const currentUser = users.find(u => u.id === _storedCurrent?.id) ?? initialUsers[0];

export const db = {
  users,
  customers: getFromStorage('customers', initialCustomers),
  vendors: getFromStorage('vendors', initialVendors),
  products: getFromStorage('products', initialProducts),
  orders: getFromStorage('orders', initialOrders),
  bills: getFromStorage('bills', []),
  accounts: getFromStorage('accounts', initialAccounts),
  transactions: getFromStorage('transactions', []),
  settings: getFromStorage('settings', initialSettings),
  currentUser,
};

export const saveDb = () => {
  localStorage.setItem('users', JSON.stringify(db.users));
  localStorage.setItem('customers', JSON.stringify(db.customers));
  localStorage.setItem('vendors', JSON.stringify(db.vendors));
  localStorage.setItem('products', JSON.stringify(db.products));
  localStorage.setItem('orders', JSON.stringify(db.orders));
  localStorage.setItem('bills', JSON.stringify(db.bills));
  localStorage.setItem('accounts', JSON.stringify(db.accounts));
  localStorage.setItem('transactions', JSON.stringify(db.transactions));
  localStorage.setItem('settings', JSON.stringify(db.settings));
  localStorage.setItem('currentUser', JSON.stringify(db.currentUser));
};

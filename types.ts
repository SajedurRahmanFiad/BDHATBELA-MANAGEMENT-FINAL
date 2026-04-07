
export enum UserRole {
  ADMIN = 'Admin',
  EMPLOYEE = 'Employee',
  EMPLOYEE1 = 'Employee1'
}

export const isEmployeeRole = (r?: UserRole) => r === UserRole.EMPLOYEE || r === UserRole.EMPLOYEE1;

export enum OrderStatus {
  ON_HOLD = 'On Hold',
  PROCESSING = 'Processing',
  PICKED = 'Picked',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

export enum BillStatus {
  ON_HOLD = 'On Hold',
  PROCESSING = 'Processing',
  RECEIVED = 'Received',
  PAID = 'Paid'
}

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  image?: string;
  password?: string;
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  dueAmount: number;
  createdBy?: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalPurchases: number;
  dueAmount: number;
  createdBy?: string;
}

export interface Product {
  id: string;
  name: string;
  image: string;
  category: string;
  salePrice: number;
  purchasePrice: number;
  stock: number;
  createdBy?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  rate: number;
  quantity: number;
  amount: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  createdAt?: string;
  customerId: string;
  createdBy: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  notes?: string;
  carrybeeConsignmentId?: string;
  steadfastConsignmentId?: string;
  paperflyTrackingNumber?: string;
  history: {
    created: string;
    courier?: string;
    processing?: string;
    picked?: string;
    completed?: string;
    payment?: string;
  };
  paidAmount: number;
  processedAt?: string; // ISO timestamp when marked processing
  completedAt?: string; // ISO timestamp when marked completed
  paidAt?: string; // ISO timestamp when payment received
  // Relational fields: populated from joined customer and user data
  // Present when fetching paginated orders via orders_with_customer_creator view
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  creatorName?: string;
}

export interface Bill {
  id: string;
  billNumber: string;
  billDate: string;
  createdAt?: string;
  vendorId: string;
  createdBy: string;
  status: BillStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  notes?: string;
  history?: {
    created?: string;
    processing?: string;
    received?: string;
    cancelled?: string;
    paid?: string;
  };
  paidAmount: number;
  processedAt?: string; // ISO timestamp when marked processing
  receivedAt?: string; // ISO timestamp when marked received
  paidAt?: string; // ISO timestamp when payment received
  // Relational fields populated by joined paginated queries
  vendorName?: string;
  vendorPhone?: string;
  vendorAddress?: string;
  creatorName?: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'Bank' | 'Cash';
  openingBalance: number;
  currentBalance: number;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'Income' | 'Expense' | 'Transfer';
  category: string;
  createdAt?: string;
  accountId: string; // Used for Income/Expense or Source in Transfer
  toAccountId?: string; // Used for Transfer
  amount: number;
  description: string;
  referenceId?: string; // Order, Bill or custom Ref
  contactId?: string; // Customer or Vendor ID
  paymentMethod: string;
  attachmentName?: string;
  attachmentUrl?: string;
  createdBy: string; // User ID who created this transaction
  history?: {
    created?: string;
  };
  // Relational fields provided by joined queries
  accountName?: string;
  contactName?: string;
  contactType?: 'Customer' | 'Vendor' | null;
  creatorName?: string;
}

export interface Settings {
  company: {
    name: string;
    logo: string;
    phone: string;
    email: string;
    address: string;
  };
  order: {
    prefix: string;
    nextNumber: number;
  };
  invoice: {
    title: string;
    logoWidth: number;
    logoHeight: number;
    footer: string;
  };
  defaults: {
    accountId: string;
    paymentMethod: string;
    incomeCategoryId: string;
    expenseCategoryId: string;
    recordsPerPage: number;
  };
  categories: {
    id: string;
    name: string;
    type: 'Income' | 'Expense' | 'Product' | 'Other';
    color: string;
    parentId?: string;
  }[];
  paymentMethods: {
    id: string;
    name: string;
    description: string;
  }[];
  courier: {
    steadfast: { baseUrl: string; apiKey: string; secretKey: string };
    carryBee: { baseUrl: string; clientId: string; clientSecret: string; clientContext: string; storeId: string };
    paperfly: {
      baseUrl: string;
      username: string;
      password: string;
      paperflyKey: string;
      defaultShopName: string;
      maxWeightKg: number;
    };
  };
  payroll: {
    unitAmount: number;
    countedStatuses: OrderStatus[];
  };
}

export interface PayrollSettings {
  unitAmount: number;
  countedStatuses: OrderStatus[];
}

export interface PayrollPayment {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeRole?: UserRole;
  periodStart: string;
  periodEnd: string;
  periodKind: 'month' | 'custom';
  periodLabel: string;
  unitAmountSnapshot: number;
  countedStatusesSnapshot: OrderStatus[];
  orderCountSnapshot: number;
  amountSnapshot: number;
  paidAt: string;
  paidBy: string;
  paidByName?: string;
  note?: string;
  createdAt?: string;
}

export interface PayrollSummaryRow {
  employeeId: string;
  employeeName: string;
  employeeRole: UserRole;
  countedOrderCount: number;
  unitAmount: number;
  estimatedAmount: number;
  paymentStatus: 'paid' | 'unpaid';
  paymentSnapshot?: PayrollPayment;
  liveAmountDelta?: number;
  liveOrderCountDelta?: number;
}

export type WalletEntryType = 'order_credit' | 'order_reversal' | 'payout';

export interface WalletSettings {
  unitAmount: number;
  countedStatuses: OrderStatus[];
}

export interface WalletBalanceCard {
  employeeId: string;
  employeeName: string;
  employeeRole: UserRole;
  currentBalance: number;
  totalEarned: number;
  totalPaid: number;
  creditedOrders: number;
  lastActivityAt?: string;
}

export interface WalletActivityEntry {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeRole?: UserRole;
  entryType: WalletEntryType;
  amountDelta: number;
  unitAmountSnapshot?: number;
  orderId?: string;
  orderNumber?: string;
  payoutId?: string;
  transactionId?: string;
  accountId?: string;
  accountName?: string;
  paymentMethod?: string;
  categoryId?: string;
  categoryName?: string;
  note?: string;
  createdAt: string;
  createdBy?: string;
  createdByName?: string;
  paidAt?: string;
  paidBy?: string;
  paidByName?: string;
}

export interface WalletPayout {
  id: string;
  employeeId: string;
  amount: number;
  accountId: string;
  paymentMethod: string;
  categoryId: string;
  transactionId: string;
  paidAt: string;
  paidBy: string;
  paidByName?: string;
  note?: string;
}

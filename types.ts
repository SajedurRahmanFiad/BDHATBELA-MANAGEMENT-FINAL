
export enum UserRole {
  ADMIN = 'Admin',
  DEVELOPER = 'Developer',
  EMPLOYEE = 'Employee',
  EMPLOYEE1 = 'Employee1'
}

export const isEmployeeRole = (r?: UserRole | string | null) => r === UserRole.EMPLOYEE || r === UserRole.EMPLOYEE1;
export const isDeveloperRole = (r?: UserRole | string | null) => r === UserRole.DEVELOPER;
export const hasAdminAccess = (r?: UserRole | string | null) => r === UserRole.ADMIN || r === UserRole.DEVELOPER;

export enum OrderStatus {
  ON_HOLD = 'On Hold',
  PROCESSING = 'Processing',
  PICKED = 'Picked',
  COMPLETED = 'Completed',
  RETURNED = 'Returned',
  CANCELLED = 'Cancelled'
}

export type OrderCompletionOutcome = 'Delivered' | 'Returned';

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
  deletedAt?: string;
  deletedBy?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  dueAmount: number;
  createdBy?: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalPurchases: number;
  dueAmount: number;
  createdBy?: string;
  deletedAt?: string;
  deletedBy?: string;
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
  deletedAt?: string;
  deletedBy?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  rate: number;
  quantity: number;
  amount: number;
}

export interface CompanyPage {
  id: string;
  name: string;
  logo: string;
  phone: string;
  email: string;
  address: string;
  isGlobalBranding: boolean;
}

export interface CompanySettings {
  id?: string;
  name: string;
  logo: string;
  phone: string;
  email: string;
  address: string;
  pages: CompanyPage[];
}

export interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  createdAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  customerId: string;
  createdBy: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  notes?: string;
  pageId?: string;
  pageSnapshot?: CompanyPage | null;
  carrybeeConsignmentId?: string;
  steadfastConsignmentId?: string;
  paperflyTrackingNumber?: string;
  history: {
    created: string;
    courier?: string;
    processing?: string;
    picked?: string;
    completed?: string;
    returned?: string;
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
  deletedAt?: string;
  deletedBy?: string;
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
  deletedAt?: string;
  deletedBy?: string;
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

export interface DashboardOrderMetrics {
  total: number;
  onHold: number;
  processing: number;
  picked: number;
  completed: number;
  returned: number;
  cancelled: number;
}

export interface DashboardCashFlowPoint {
  name: string;
  income: number;
  expense: number;
  profit: number;
}

export interface DashboardExpenseCategory {
  name: string;
  value: number;
}

export interface DashboardTopProduct {
  name: string;
  qty: number;
}

export interface DashboardTopCustomer {
  name: string;
  orders: number;
  amount: number;
}

export interface DashboardAdminSnapshot {
  totalSales: number;
  totalPurchases: number;
  otherExpenses: number;
  totalProfit: number;
  orderCounts: DashboardOrderMetrics;
  orderTotals: DashboardOrderMetrics;
  monthlyData: DashboardCashFlowPoint[];
  expenseByCategory: DashboardExpenseCategory[];
  topSoldProducts: DashboardTopProduct[];
  topCustomers: DashboardTopCustomer[];
}

export interface DashboardEmployeeStatusSnapshot {
  status: OrderStatus;
  label: string;
  value: number;
}

export interface DashboardEmployeeComparisonEntry {
  userId: string;
  name: string;
  role: string;
  orderCount: number;
  isCurrentUser: boolean;
}

export interface DashboardEmployeeSnapshot {
  myTotalCreated: number;
  myCreatedToday: number;
  myPendingOrders: number;
  walletBalance: number;
  employeeStatusSnapshot: DashboardEmployeeStatusSnapshot[];
  employeeComparisonRows: DashboardEmployeeComparisonEntry[];
}

export interface DashboardSnapshot {
  role: 'admin' | 'employee';
  admin?: DashboardAdminSnapshot;
  employee?: DashboardEmployeeSnapshot;
  refreshedAt: string;
}

export interface Settings {
  company: CompanySettings;
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
    defaultAccountId: string;
    defaultPaymentMethod: string;
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

export interface CompletePickedOrderPayload {
  orderId: string;
  outcome: OrderCompletionOutcome;
  date: string;
  accountId: string;
  amount: number;
  paymentMethod?: string;
  categoryId?: string;
  note?: string;
}

export type RecycleBinEntityType =
  | 'customer'
  | 'order'
  | 'bill'
  | 'transaction'
  | 'user'
  | 'vendor'
  | 'product';

export interface RecycleBinItem {
  id: string;
  entityType: RecycleBinEntityType;
  title: string;
  description?: string;
  details: string[];
  deletedAt: string;
  deletedBy?: string;
  deletedByName?: string;
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  status?: string;
  amount?: number;
}

import { Order, OrderStatus } from '../../types';
import { FilterRange, isWithinDateRange } from '../../utils';

export const SALES_REPORT_STATUSES = new Set<OrderStatus>([
  OrderStatus.PROCESSING,
  OrderStatus.PICKED,
  OrderStatus.COMPLETED,
]);

const normalize = (value: string): string => value.trim().toLowerCase();

export type ProductSalesRow = {
  productName: string;
  quantity: number;
  revenue: number;
};

export type CustomerSalesRow = {
  name: string;
  orders: number;
  quantity: number;
  amount: number;
};

export function buildProductSalesRows(
  orders: Order[],
  filterRange: FilterRange,
  customDates: { from: string; to: string },
  searchQuery: string = ''
): ProductSalesRow[] {
  const query = normalize(searchQuery || '');
  const productMap = new Map<string, ProductSalesRow>();

  orders.forEach((order) => {
    if (!SALES_REPORT_STATUSES.has(order.status)) return;
    if (!isWithinDateRange(order.orderDate, filterRange, customDates)) return;

    order.items.forEach((item) => {
      const key = item.productId || item.productName;
      const current = productMap.get(key) || {
        productName: item.productName,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += Number(item.quantity || 0);
      current.revenue += Number(item.amount || 0);
      productMap.set(key, current);
    });
  });

  const rows = Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity);
  if (!query) return rows;
  return rows.filter((r) => normalize(r.productName).includes(query));
}

export function buildCustomerSalesRows(
  orders: Order[],
  filterRange: FilterRange,
  customDates: { from: string; to: string },
  searchQuery: string = ''
): CustomerSalesRow[] {
  const query = normalize(searchQuery || '');
  const customerMap = new Map<string, CustomerSalesRow>();

  orders.forEach((order) => {
    if (!SALES_REPORT_STATUSES.has(order.status)) return;
    if (!isWithinDateRange(order.orderDate, filterRange, customDates)) return;

    const key = order.customerId || order.customerName || 'unknown';
    const current = customerMap.get(key) || {
      name: order.customerName || 'Unknown Customer',
      orders: 0,
      quantity: 0,
      amount: 0,
    };

    current.orders += 1;
    current.amount += Number(order.total || 0);
    current.quantity += order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    customerMap.set(key, current);
  });

  const rows = Array.from(customerMap.values()).sort((a, b) => b.amount - a.amount);
  if (!query) return rows;
  return rows.filter((r) => normalize(r.name).includes(query));
}


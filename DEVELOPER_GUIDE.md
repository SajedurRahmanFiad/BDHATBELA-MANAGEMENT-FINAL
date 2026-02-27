# Quick Reference & Developer Guide

## Quick Start

### For Users

1. **Browse orders** (automatic caching):
   ```
   Visit Orders page → See list cached and paginated deterministically
   Navigate pages → Instant (from cache)
   Switch filters (status/date) → Refreshes page 1, rest cached
   ```

2. **Search orders** (real-time database queries):
   ```
   Type in search box → Queries database for matches
   Search term changes → Separate cache per term
   Clear search → Returns to browsing mode cache
   ```

3. **Create order**:
   ```
   Fill form → Submit
   Order number auto-generated (no conflicts!)
   Order appears at top of list
   ```

### For Developers

#### Querying Orders (Browsing Mode)

```typescript
import { useOrdersPage } from '@/src/hooks/useQueries';

function MyOrderList() {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  
  // Browsing: no search filter
  const { data: ordersPage, isFetching } = useOrdersPage(
    page,
    pageSize,
    {
      status: 'All',
      // Note: no 'search' field means browsing mode
    }
  );

  // Cache key in use: ['orders', 1] or ['orders', 2], etc.
  // Query: SELECT * FROM orders_with_customer_creator 
  //        ORDER BY created_at DESC LIMIT 25 OFFSET 0
  
  return (
    <>
      {ordersPage?.data.map(order => (
        <div key={order.id}>
          {order.orderNumber} - {order.customerName} ({order.customerPhone})
          Created by: {order.creatorUsername}
        </div>
      ))}
    </>
  );
}
```

#### Querying Orders (Search Mode)

```typescript
function SearchOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  
  const { data: ordersPage, isFetching } = useOrdersPage(
    page,
    25,
    {
      search: searchTerm,  // ← Activates search mode!
    }
  );

  // Cache key: ['orders-search', searchTerm, 1]
  // Query: SELECT * FROM orders_with_customer_creator
  //        WHERE customer_name.ilike.%searchTerm%
  //           OR customer_phone.ilike.%searchTerm%
  //           OR order_number.ilike.%searchTerm%
  //        ORDER BY created_at DESC LIMIT 25
  
  return (
    <>
      <input 
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setPage(1);  // Reset to page 1 on new search
        }}
        placeholder="Search order number, customer phone, or name..."
      />
      {/* Results shown from database */}
    </>
  );
}
```

#### Creating Orders

```typescript
import { useCreateOrder } from '@/src/hooks/useMutations';

function CreateOrderForm() {
  const createOrderMutation = useCreateOrder();

  const handleSubmit = async (formData: any) => {
    try {
      const newOrder = await createOrderMutation.mutateAsync({
        orderDate: formData.date,
        customerId: formData.customerId,
        createdBy: currentUser.id,  // Automatic
        status: 'On Hold',
        items: formData.items,
        subtotal: formData.subtotal,
        discount: formData.discount,
        shipping: formData.shipping,
        total: formData.total,
        paidAmount: 0,
        notes: formData.notes,
        history: { created: new Date().toISOString() },
      });

      // Behind the scenes:
      // 1. RPC create_order_atomic is called
      // 2. Advisory lock acquired for prefix
      // 3. Next order_seq computed = MAX(order_seq) + 1
      // 4. Order inserted with order_number = prefix + seq
      // 5. Returned with customerName, creatorUsername, etc.
      // 6. Page 1 cache updated if browsing (not searching)
      // 7. Search caches invalidated
      
      console.log(`Order created: ${newOrder.orderNumber}`);
    } catch (error) {
      console.error('Failed to create order:', error);
    }
  };

  return <form onSubmit={handleSubmit}>... </form>;
}
```

#### Key Points About Order Numbers

```typescript
// NO frontend number generation needed
const order = await createOrderMutation.mutateAsync(orderData);
console.log(order.orderNumber);  // ← Already assigned by RPC!

// Multiple concurrent requests are safe:
// Request 1: Lock acquired → seq=101 → Released
// Request 2: Lock waits... → seq=102 → Assigned
// Request 3: Lock waits... → seq=103 → Assigned
// ✅ No collisions! Database handles it atomically.
```

## Cache Management Utilities

### Manual Cache Updates (Advanced)

```typescript
import { 
  injectOrderIntoFirstPage,
  invalidateOrdersCaches,
  updateOrderInAllCaches,
  removeOrderFromAllCaches,
  prefetchNextPage,
} from '@/src/utils/cacheManagement';
import { useQueryClient } from '@tanstack/react-query';

function AdvancedOrderManagement() {
  const queryClient = useQueryClient();

  // Manually inject order into page 1 if browsing
  const handleOrderCreated = (order: Order) => {
    injectOrderIntoFirstPage(queryClient, order, 'browsing', 25, (o) => {
      // Only inject if matches active filters
      return o.status === 'Pending';
    });
  };

  // Invalidate everything
  const handleClearAllCaches = () => {
    invalidateOrdersCaches(queryClient);
  };

  // Update order in all cached pages
  const handleOrderStatusChanged = (updatedOrder: Order) => {
    updateOrderInAllCaches(queryClient, updatedOrder);
  };

  // Remove from all caches
  const handleOrderDeleted = (orderId: string) => {
    removeOrderFromAllCaches(queryClient, orderId);
  };

  // Prefetch next page for smooth pagination
  const handlePrefetchNextPage = (currentPage: number) => {
    prefetchNextPage(queryClient, (p, s, f) => fetchOrdersPage(p, s, f), currentPage);
  };
}
```

## Common Patterns

### Pattern 1: List with Pagination

```typescript
const [page, setPage] = useState(1);
const { data: ordersPage } = useOrdersPage(page, 25);

return (
  <>
    {ordersPage?.data.map(o => <OrderRow key={o.id} order={o} />)}
    <Pagination 
      current={page}
      total={Math.ceil((ordersPage?.count || 0) / 25)}
      onChange={setPage}
    />
  </>
);
```

### Pattern 2: Filtered List

```typescript
const [status, setStatus] = useState('All');
const [dateFrom, setDateFrom] = useState('');
const [dateTo, setDateTo] = useState('');

const { data: ordersPage } = useOrdersPage(
  1,  // Always reset to page 1
  25,
  { status, from: dateFrom, to: dateTo }
);

// Change filter → Page resets → Page 1 fetched/cached
```

### Pattern 3: Search

```typescript
const [searchTerm, setSearchTerm] = useState('');

const { data: ordersPage, isFetching } = useOrdersPage(
  1,
  25,
  { search: searchTerm.trim() }
);

// Empty search term → Browsing cache used
// Non-empty search term → Search cache used (database query)
```

### Pattern 4: Create and Show

```typescript
const createOrderMutation = useCreateOrder();

const handleCreate = async (orderData: any) => {
  const newOrder = await createOrderMutation.mutateAsync(orderData);
  
  // If browsing (not searching):
  // - New order is in page 1 cache, displays immediately
  // - No manual refresh needed
  
  // If searching:
  // - Search cache invalidated
  // - User sees message: "New order created, refresh to see if it matches your search"
};
```

## Troubleshooting

### Issue: New order doesn't appear in list

**Cause:** You're in search mode (search term active)

**Solution:** Clear search term to see new order in browsing mode

```typescript
if (searchTerm) {
  setSearchTerm('');  // Switch to browsing mode
}
```

### Issue: Order number shows as undefined

**Cause:** Order created without using RPC function

**Solution:** Ensure createOrder uses RPC:

```typescript
// ✅ Correct (uses RPC)
const { data } = await supabase.rpc('create_order_atomic', params);

// ✗ Wrong (direct insert)
const { data } = await supabase.from('orders').insert(...);
```

### Issue: Same order number appears twice

**Cause:** RPC not acquiring lock properly

**Solution:** Check PostgreSQL advisory lock function:

```sql
-- Test if lock works
SELECT pg_advisory_xact_lock(hashtext('prefix'));
SELECT MAX(order_seq) FROM orders WHERE order_number LIKE 'prefix%';
-- Should return different values in concurrent transactions
```

### Issue: Pagination shows wrong total count

**Cause:** Cache not updated after mutation

**Solution:** Verify mutation hooks are using proper cache update:

```typescript
// Check in Redux DevTools or console
queryClient.getQueryData(['orders', 1]);  
// Should show correct count after create/delete
```

## Performance Tips

### 1. Use Browsing Mode When Possible

```typescript
// ✅ Fast (uses cache)
const { data } = useOrdersPage(page, 25);  // No search

// ⚠️ Slower (hits database every time)
const { data } = useOrdersPage(page, 25, { search: term });
```

### 2. Prefetch Next Pages

```typescript
import { prefetchNextPage } from '@/src/utils/cacheManagement';

// User is on page 1 and likely to go to page 2
prefetchNextPage(queryClient, fetchOrdersPage, 1, 25);
```

### 3. Reset to Page 1 When Filters Change

```typescript
useEffect(() => {
  setPage(1);  // ← Prevents 416 errors and keeps UI in sync
}, [status, dateFrom, dateTo, searchTerm]);
```

### 4. Use Selective Invalidation

```typescript
// ✅ Only invalidate search caches
queryClient.invalidateQueries({ queryKey: ['orders-search'] });

// ✗ Don't use if not necessary
invalidateOrdersCaches(queryClient);  // Invalidates everything
```

## Testing

### Test Browsing Mode

```typescript
// 1. Open Orders page
// 2. Verify list loads from 'orders' cache key
// 3. Page through pages → should be instant
// 4. Change status filter → page 1 refetches
// 5. Other pages from before filter still cached (if you navigate back)
```

### Test Search Mode

```typescript
// 1. search for order number (e.g., "ORD")
// 2. Verify query params show in network tab
// 3. Change search term → different query
// 4. Search results are fresh (not duplicated from cache)
// 5. Clear search → go back to browsing
```

### Test Order Creation

```typescript
// 1. Create order (watch RPC call in network tab)
// 2. Order appears at top of list immediately
// 3. Order number is generated (not empty)
// 4. Create another order quickly → no duplicate numbers
// 5. If searching → search cache invalidated (if searching, page stays same)
```

### Test Concurrency

```typescript
// Open two browser tabs
// Tab 1: Create order (should get seq=1)
// Tab 2: Create order (should get seq=2, not duplicate)
// Both complete without conflict

// Alternative: Use DevTools to throttle network
// Create order → Still gets unique number
```

## Database Queries Reference

### Get Orders with Customer/Creator Info

```sql
SELECT * FROM orders_with_customer_creator
WHERE status = 'Pending'
ORDER BY created_at DESC
LIMIT 25;
```

### Get Order Number Sequence Progress

```sql
SELECT 
  prefix,
  COALESCE(MAX(order_seq), 0) as next_seq
FROM order_settings, orders
WHERE order_number LIKE order_settings.prefix || '%'
GROUP BY prefix;
```

### Check Advisory Lock

```sql
SELECT * FROM pg_locks WHERE locktype = 'advisory';
-- Shows if any locks are held
```

### Verify Indexes

```sql
SELECT 
  indexname,
  tableame,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Support

For questions about:
- **Cache behavior**: See [SCALABLE_PAGINATION_DESIGN.md](SCALABLE_PAGINATION_DESIGN.md#cache-management-strategy)
- **Order number generation**: See [SCALABLE_PAGINATION_DESIGN.md](SCALABLE_PAGINATION_DESIGN.md#atomic-order-number-generation)
- **Implementation details**: See [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)

# Scalable Pagination, Real Search, and Concurrency-Safe Orders

## System Overview

This implementation enforces a deterministic, scalable architecture for order management in a React + Supabase frontend-only system. It separates concerns across three dimensions:

1. **Browsing vs Search**: Different cache strategies for paginated browsing vs database-driven search
2. **Relational Data**: Customer and creator info retrieved via joins, not denormalized
3. **Atomic Order Numbers**: Database-generated order numbers via RPC with advisory locks

## Cache Management Strategy

### Mode 1: Browsing Mode (No Search)

When no search term is active, the system fetches paginated data using deterministic ordering:

```typescript
// Query pattern
ORDER BY created_at DESC
LIMIT pageSize
OFFSET (page - 1) * pageSize

// Cache key pattern
['orders', page]  // e.g., ['orders', 1], ['orders', 2]
```

**Characteristics:**
- Uses server-side pagination with stable ORDER BY
- Results are deterministic and reproducible
- Cache is updated on page 1 after creation, deletion, or updates
- Multiple filters can be included in key: `['orders', page, filters]`
- Cache never needs to be invalidated when navigating pages (results are stable)

### Mode 2: Search Mode (Search Term Active)

When a search term exists, results must always reflect current database state:

```typescript
// Query pattern
WHERE ILIKE filters match (customer_name, customer_phone, order_number)
ORDER BY created_at DESC
LIMIT pageSize
OFFSET (page - 1) * pageSize

// Cache key pattern
['orders-search', searchTerm, page]  // e.g., ['orders-search', '123', 1]
```

**Characteristics:**
- Always queries the database (no local filtering of cached pages)
- Searches across: order_number, customer_name, customer_phone
- Results are time-sensitive (database-driven)
- Cache is invalidated after any mutation (order created/updated/deleted)
- New searches with different terms use separate cache entries

### Separation Logic

The separation happens in `fetchOrdersPage`:

```typescript
const searchTerm = filters?.search?.trim();
const isSearching = !!searchTerm;

if (isSearching) {
  // Search mode: uses OR filters on customer_name.ilike, customer_phone.ilike, order_number.ilike
  query = query.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,order_number.ilike.%${q}%`);
} else {
  // Browsing mode: just apply non-search filters
}
```

## Relational Data Retrieval

### Orders Table Structure

The `orders` table stores only:
- `id` (uuid)
- `order_number` (text, generated atomically)
- `order_date` (date)
- `customer_id` (uuid, FK to customers)
- `created_by` (uuid, FK to users)
- `status` (text)
- `items` (jsonb)
- `subtotal`, `discount`, `shipping`, `total`, `paid_amount` (numeric)
- `notes` (text, nullable)
- `history` (jsonb)
- `created_at`, `updated_at` (timestamps)

### View: `orders_with_customer_creator`

A view that joins orders with customer and user data for efficient list views:

```sql
CREATE VIEW orders_with_customer_creator AS
SELECT
  o.id,
  o.order_number,
  o.order_date,
  o.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  o.created_by,
  u.username AS creator_username,
  u.email AS creator_email,
  o.status,
  ...other order fields
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN users u ON o.created_by = u.id;
```

### Data Flow

1. **fetchOrdersPage** queries `orders_with_customer_creator`
2. **mapOrder** maps database columns to TypeScript Order type
3. Frontend receives complete Order objects with `customerName`, `customerPhone`, `creatorUsername`, `creatorEmail`
4. No additional queries needed to display customer or creator info

## Atomic Order Number Generation

### RPC Function: `create_order_atomic`

Handles atomic order number allocation and insertion:

```plpgsql
CREATE FUNCTION create_order_atomic(
  p_order_date date,
  p_customer_id uuid,
  p_created_by uuid,
  ...
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
```

**Process:**
1. Read prefix from `order_settings` table
2. Acquire advisory transaction lock scoped to prefix: `pg_advisory_xact_lock(hashtext(prefix))`
3. Compute next `order_seq`: `MAX(order_seq) + 1` for this prefix
4. Insert order with `order_number = prefix || next_seq`
5. Return complete order data as JSONB with joined customer/creator info

**Atomicity Guarantee:**
- Advisory lock ensures only one transaction allocates each sequence number
- Lock is transaction-scoped (released at commit/rollback)
- Different prefixes can allocate in parallel (lock key is derived from prefix)
- Even with concurrent requests, order numbers are collision-free

### Frontend Implementation

When creating an order:

```typescript
// supabaseQueries.ts
const { data, error } = await supabase.rpc('create_order_atomic', rpcParams);

// RPC performs the number allocation atomically
// No client-side retries or number generation needed
```

## Indexing Strategy

### Indexes for Search Performance

```sql
-- Single-column indexes for filtering
CREATE INDEX idx_orders_order_number ON orders(order_number DESC NULLS LAST);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC NULLS LAST);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_created_by ON orders(created_by);

-- Indexes on joined tables for ILIKE searches  
CREATE INDEX idx_customers_name_lower ON customers(LOWER(name) text_pattern_ops);
CREATE INDEX idx_customers_phone_lower ON customers(LOWER(phone) text_pattern_ops);
CREATE INDEX idx_users_email_lower ON users(LOWER(email) text_pattern_ops);

-- Composite indexes for common filter combinations
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at DESC NULLS LAST);
CREATE INDEX idx_orders_created_by_created_at ON orders(created_by, created_at DESC NULLS LAST);
```

### Index Usage Pattern

- `ORDER BY created_at DESC` uses `idx_orders_created_at` for fast pagination
- `WHERE status = ?` + `ORDER BY created_at DESC` uses `idx_orders_status_created_at`
- `ILIKE` searches on `customer_name`, `customer_phone` use text_pattern_ops indexes
- Composite indexes enable combined filters to use single index scan

## Cache Mutation Strategy

### After Order Creation

**Browsing Mode (no search):**
```typescript
// Inject into cached page 1 if the order matches active filters
injectOrderIntoFirstPage(queryClient, newOrder, 'browsing', pageSize, shouldInclude);
```

**Search Mode:**
```typescript
// Invalidate ALL search cache entries
queryClient.invalidateQueries({
  queryKey: ['orders-search'],
  exact: false,
});
// User must refetch to see if new order matches their search
```

### After Order Deletion

**Browsing Mode:**
```typescript
// Remove from page 1, pull item from page 2 to maintain page size
// Decrement total count
```

**Search Mode:**
```typescript
// Invalidate ALL search cache entries
```

### After Order Update

**Browsing Mode:**
```typescript
// Update order in-place in all cached pages where it appears
// If order no longer matches filters, remove it and pull from next page
```

**Search Mode:**
```typescript
// Invalidate ALL search cache entries
// Order might now match/unmatch search filters
```

## Type Definitions

### Order Interface Extensions

```typescript
export interface Order {
  // ... existing fields ...
  
  // Relational fields: populated from joined customer and user data
  // Present when fetching paginated orders via orders_with_customer_creator view
  customerName?: string;
  customerPhone?: string;
  creatorUsername?: string;
  creatorEmail?: string;
}
```

## Usage Examples

### Browsing with Pagination (Cached)

```typescript
// Components/Orders.tsx
const [page, setPage] = useState(1);
const [searchQuery, setSearchQuery] = useState('');

// No search: uses browsing cache
const { data: ordersPage } = useOrdersPage(page, pageSize, { 
  status: statusFilter,
  from: dateFrom,
  to: dateTo,
  // search is undefined, so browsing mode is used
});

// Displays orders with customer names and usernames from joins
orders.map(o => (
  <div key={o.id}>
    Order: {o.orderNumber}
    Customer: {o.customerName} ({o.customerPhone})
    Created by: {o.creatorUsername}
  </div>
))
```

### Searching (Database-Driven)

```typescript
setSearchQuery('customer phone or order number');

// With search term: uses search cache and database-driven queries
const { data: ordersPage } = useOrdersPage(page, 1, {
  status: statusFilter,
  search: searchQuery,  // Triggers search mode
});

// Results always reflect current database state
// Includes only matches for the search term
```

### Creating Orders

```typescript
// Mutation automatically:
// 1. Calls create_order_atomic RPC
// 2. Gets back order with joinedcustomer_name, creator_username
// 3. Injects into page 1 cache if browsing (not searching)
// 4. Invalidates search caches
const { mutateAsync: createOrder } = useCreateOrder();
const newOrder = await createOrder({
  customerId: selectedCustomer.id,
  orderDate: new Date().toISOString().split('T')[0],
  ...otherFields
});
```

### Deleting Orders

```typescript
const { mutateAsync: deleteOrder } = useDeleteOrder();
await deleteOrder(orderId);

// Mutation automatically:
// 1. Removes from browsing cache, maintains page size
// 2. Invalidates all search caches
// 3. Decrements total count
```

## Performance Characteristics

### Query Performance

| Operation | Complexity | Index Used |
|-----------|-----------|-----------|
| Fetch page 1 (browsing) | O(log N) | `idx_orders_created_at` |
| Fetch page with status filter | O(log N) | `idx_orders_status_created_at` |
| Search by order number | O(log N) | `idx_orders_order_number` |
| Search by customer name | O(log N) | `idx_customers_name_lower` |
| Search by customer phone | O(log N) | `idx_customers_phone_lower` |
| Generate next order number | O(1) lock + O(log N) scan | `idx_orders_order_seq` |

### Cache Benefits

| Scenario | Benefit |
|----------|---------|
| Navigate pages while browsing | Zero database queries (cached) |
| Switch between filters (status, date) | Targeted page 1 invalidation only |
| Search with same term | Reuse cached results |
| Search with different terms | Separate cache entries, no conflicts |
| Create order | Page 1 updated immediately, no full refetch |
| Update order | In-place cache update, reflected instantly |

## Summary of Deterministic Behavior

1. **Browsing is cached pagination**: ORDER BY created_at DESC ensures deterministic results
2. **Search is database-driven pagination**: Always queries latest data, cached per term
3. **Order numbers are generated inside Postgres**: RPC + advisory lock = collision-free
4. **Relational joins replace denormalized data**: Single source of truth for customer/creator info
5. **UI updates through precise cache mutation**: No full refetches, only targeted updates
6. **Indexes support both patterns**: Composite indexes for common filter combinations
7. **Concurrency is safe**: RPC transactions and locks prevent race conditions

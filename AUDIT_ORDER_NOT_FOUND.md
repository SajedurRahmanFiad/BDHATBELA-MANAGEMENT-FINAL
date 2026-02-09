# Order "Not Found" Bug Audit Report

## Issue Summary
After recording a payment in OrderDetails.tsx, the order becomes "not found" or displays with stale/incorrect data. This appears to happen because the 'order' query cache isn't properly invalidated after the payment mutation completes.

---

## 1. QUERY INVALIDATION - MISSING IN OrderDetails.tsx ✗

### Problem Found: Line 151-152 in OrderDetails.tsx
```tsx
// CURRENT (OrderDetails.tsx, line 151-152):
setShowPaymentModal(false);
toast.success('Payment recorded successfully');
```

### Missing: Explicit Query Invalidation
- **OrderDetails.tsx does NOT import queryClient**
- **OrderDetails.tsx does NOT call queryClient.invalidateQueries() after payment**
- Relies ENTIRELY on the mutation's onSuccess callback to invalidate the cache

### Comparison: Orders.tsx DOES invalidate (Line 235-236):
```tsx
// Orders.tsx (line 235-236):
queryClient.invalidateQueries({ queryKey: ['orders'] });
```
This line is after Promise.all() and explicitly forces a cache invalidation.

### Root Cause:
While `useUpdateOrder.onSuccess` does invalidate the cache, the invalidation is asynchronous and scheduled. In OrderDetails.tsx, there's no guarantee that by the time the component tries to re-render, the cache invalidation has actually occurred and the refetch has completed.

### Impact:
- User records payment
- Modal closes, success message shown
- UI still shows stale order data or "Order not found" because refetch hasn't occurred yet
- Cache invalidation happens too late or gets missed due to race condition

---

## 2. MUTATION ERROR HANDLING - Promise.all() Risk ⚠️

### Location: OrderDetails.tsx, lines 141-147 (handleLifecyclePayment)
```tsx
await Promise.all([
  updateMutation.mutateAsync({ id: id!, updates: updatedOrder }),
  updateAccountMutation.mutateAsync({
    id: paymentForm.accountId,
    updates: { currentBalance: account.currentBalance + balanceChange }
  })
]);
```

### The Issue:
`Promise.all()` will reject as soon as ONE promise rejects. If `updateMutation` fails:
1. The error IS caught by the try-catch (good)
2. Modal stays open and error toast shows (good)
3. BUT - if BOTH mutations partially succeed before one fails, the order might be updated but account not updated, or vice versa

### Specific Scenario That Causes "Not Found":
1. Income transaction created ✓
2. Shipping expense transaction created ✓
3. updateMutation succeeds, updates order ✓
4. updateAccountMutation FAILS (network issue, RLS error, etc.)
5. Promise.all() rejects with updateAccountMutation error
6. Error handler shows error toast, modal should close... but what if it doesn't?
7. Component state gets confused
8. Next render shows "Order not found"

### Risk Level: **HIGH**
While the try-catch handles it, the lack of transaction-like atomicity means partial updates are possible.

---

## 3. ORDER STATUS UPDATE LOGIC - Spread Field Issues ⚠️

### Location: OrderDetails.tsx, lines 100-107 (updateStatus function)
```tsx
const updates = { 
  ...order, 
  status: newStatus, 
  history: historyKey ? { ...order.history, [historyKey]: historyText } : order.history
};
```

### And: OrderDetails.tsx, lines 102-107 (handleLifecyclePayment)
```tsx
const updatedOrder = { 
  ...order, 
  paidAmount: updatedPaid,
  status,
  history: { ...order.history, payment: historyText }
};
```

### Potential Issues:
1. **items array is copied by reference** - If items gets mutated elsewhere, it affects all copies
2. **Shallow spread of complex history object** - Could cause issues if history object is modified during payment processing
3. **Missing error validation** - No check if spreading succeeds

### Supabase Update (supabaseQueries.ts, line 242-243):
```tsx
...(updates.history && { history: updates.history }),
```
**Good news:** The history IS properly passed to Supabase with conditional spread operator.

### Risk: **MEDIUM**
The spread should work correctly, but shallow copying complex objects (items array, history object) could cause mutation issues if those fields are modified elsewhere during the payment flow.

---

## 4. CACHE INVALIDATION in useMutations - Proper Implementation ✓

### Location: src/hooks/useMutations.ts, lines 250-252 (useUpdateOrder)
```tsx
onSuccess: (data) => {
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['order', data.id] });
},
```

### Assessment: ✓ CORRECTLY IMPLEMENTED
The mutation hook properly invalidates:
- `['orders']` - for the orders list view
- `['order', data.id]` - for the specific order detail view

### BUT: The Problem is in the Component
The issue is that **OrderDetails.tsx doesn't import or use queryClient** to validate that invalidation has occurred. It relies on the async onSuccess callback.

---

## 5. PAYMENT RECORDING FLOW - Sequence & Failure Points

### Current Flow (OrderDetails.tsx, lines 73-165):
```
1. Income transaction created ✓
   └─ await createTransactionMutation.mutateAsync()
   
2. Shipping expense created (if applicable) ✓
   └─ await createTransactionMutation.mutateAsync()
   
3. Update account + order in PARALLEL ⚠️
   └─ await Promise.all([
        updateMutation (order status update)
        updateAccountMutation (balance update)
      ])
   
4. Close modal + show success ⚠️
   └─ setShowPaymentModal(false)
   └─ toast.success('Payment recorded')
   └─ NO explicit queryClient.invalidateQueries()
```

### Failure Scenarios:

**Scenario A: Income transaction fails**
```
STATUS: ✓ Caught by catch block
RESULT: Modal stays open, error toast shown
USER SEES: "Failed to record payment"
```

**Scenario B: Order update succeeds but account update fails**
```
STATUS: ⚠️ Promise.all() rejects
RESULT: Error is caught, but order WAS already updated in DB
USER SEES: Either error message OR stale UI if error handling is incomplete
PROBLEM: Order updated but account not updated - INCONSISTENT STATE
```

**Scenario C: Both mutations succeed but query cache isn't invalidated in time**
```
STATUS: ✓ Mutations succeed
RESULT: useUpdateOrder.onSuccess fires async invalidation
PROBLEM: Modal closes immediately, component might re-render BEFORE invalidation occurs
USER SEES: "Order not found" because refetch hasn't happened yet
LIKELIHOOD: HIGH - This is likely the actual bug!
```

---

## RECOMMENDED FIXES

### Fix #1: Import queryClient and invalidate explicitly ✓ CRITICAL
**File:** pages/OrderDetails.tsx

Add import:
```tsx
import { useQueryClient } from '@tanstack/react-query';
```

In component:
```tsx
const queryClient = useQueryClient();
```

In handleLifecyclePayment, after Promise.all():
```tsx
await Promise.all([
  updateMutation.mutateAsync({ id: id!, updates: updatedOrder }),
  updateAccountMutation.mutateAsync({...})
]);

// ADD THIS - Explicitly invalidate the specific order query
queryClient.invalidateQueries({ queryKey: ['order', id] });

setShowPaymentModal(false);
toast.success('Payment recorded successfully');
```

**Why:** Forces the useOrder hook to refetch the latest data before the component re-renders, preventing the race condition that shows "Order not found".

---

### Fix #2: Update updateStatus function similarly ✓ IMPORTANT
**File:** pages/OrderDetails.tsx, updateStatus function (line 56-66)

```tsx
const updateStatus = async (newStatus: OrderStatus, historyKey?: keyof Order['history'], historyText?: string) => {
  if (!order) return;
  try {
    const updates = { 
      ...order, 
      status: newStatus, 
      history: historyKey ? { ...order.history, [historyKey]: historyText } : order.history
    };
    await updateMutation.mutateAsync({ id: id!, updates });
    
    // ADD EXPLICIT INVALIDATION
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    
    setIsActionOpen(false);
  } catch (err) {
    console.error('Failed to update order status:', err);
    toast.error('Failed to update order status');
  }
};
```

---

### Fix #3: Add Promise error boundary ✓ ENHANCED ERROR HANDLING
**File:** pages/OrderDetails.tsx, handleLifecyclePayment

```tsx
try {
  // ... transaction creation ...
  
  // Use Promise.allSettled instead of Promise.all to handle partial failures
  const results = await Promise.allSettled([
    updateMutation.mutateAsync({ id: id!, updates: updatedOrder }),
    updateAccountMutation.mutateAsync({
      id: paymentForm.accountId,
      updates: { currentBalance: account.currentBalance + balanceChange }
    })
  ]);
  
  // Check if both succeeded
  if (results[0].status === 'rejected' || results[1].status === 'rejected') {
    throw new Error(
      `Payment update failed: Order ${results[0].status === 'rejected' ? 'update failed' : 'OK'}, ` +
      `Account ${results[1].status === 'rejected' ? 'update failed' : 'OK'}`
    );
  }
  
  // EXPLICIT INVALIDATION
  queryClient.invalidateQueries({ queryKey: ['order', id] });

  setShowPaymentModal(false);
  toast.success('Payment recorded successfully');
} catch (err) {
  // ... error handling ...
}
```

---

### Fix #4: Add loading state to prevent user interaction during update ✓ UX IMPROVEMENT
**File:** pages/OrderDetails.tsx

```tsx
const [isUpdating, setIsUpdating] = useState(false);

const handleLifecyclePayment = async () => {
  setIsUpdating(true);
  try {
    // ... existing code ...
  } catch (err) {
    // ... error handling ...
  } finally {
    setIsUpdating(false);
  }
};

// In modal button:
<Button 
  onClick={handleLifecyclePayment} 
  disabled={isUpdating || updateMutation.isPending}
  loading={isUpdating}
>
  Save Payment
</Button>
```

---

## Summary Table

| Check | Status | Line | Fix Needed |
|-------|--------|------|-----------|
| Query Invalidation in OrderDetails | ❌ MISSING | 151-152 | Import queryClient + add invalidation |
| Query Invalidation in Orders | ✓ PRESENT | 236 | Already correct |
| Promise.all Error Handling | ⚠️ RISKY | 141-147 | Use Promise.allSettled, add checks |
| Order Field Spreading | ✓ CORRECT | 102-107 | No changes needed |
| useUpdateOrder onSuccess | ✓ CORRECT | Lines 250-252 | No changes needed |
| updateStatus function | ❌ MISSING | 56-66 | Add queryClient invalidation |

---

## Root Cause Summary

**The "Order becomes not found after payment" bug is caused by:**

1. **Missing explicit query invalidation** in OrderDetails.tsx after mutations complete
2. **Race condition** where component re-renders before the async onSuccess callback invalidates the cache
3. **useOrder hook relies on cache invalidation** that happens asynchronously, but component doesn't wait for it

**Result:** When modal closes after payment, the order query hasn't been invalidated yet, so useOrder still returns the cached (now stale) data. When React Query finally invalidates and refetches, it might encounter errors or the refetch completes too late, causing the component to render "Order not found" during the race condition window.

---

## Implementation Priority

1. 🔴 **CRITICAL**: Add queryClient import and invalidation in handleLifecyclePayment (Fix #1)
2. 🔴 **CRITICAL**: Update updateStatus function with explicit invalidation (Fix #2)  
3. 🟡 **IMPORTANT**: Improve error handling with Promise.allSettled (Fix #3)
4. 🟢 **NICE-TO-HAVE**: Add loading state for better UX (Fix #4)

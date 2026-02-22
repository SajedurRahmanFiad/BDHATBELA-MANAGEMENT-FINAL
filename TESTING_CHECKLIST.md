# Quick Testing Checklist

## ✓ Pre-Test Verification
- [x] Code compiles without major errors
- [x] App starts on localhost:3001
- [x] All files saved and committed

## Test Case 1: Multi-Device Login 🔐

### Setup:
- [ ] Open the app in Browser A (e.g., Chrome)
- [ ] Open the app in Browser B (e.g., Firefox or private window)

### Test:
- [ ] In Browser A: Log in as Admin or any user
- [ ] In Browser B: Log in as a DIFFERENT user or same
- [ ] Refresh Browser A - should still be logged in as original user
- [ ] Refresh Browser B - should still be logged in as its user
- [ ] Logout in Browser A
- [ ] Check Browser B - should STILL be logged in (no interference)

### Expected Result:
✅ Both browsers have independent sessions, no interference

---

## Test Case 2: Create Customer 📝

### Setup:
- [ ] Log in to the app
- [ ] Go to Customers page
- [ ] Click "New Customer"

### Test:
- [ ] Fill in: Name, Phone, Address
- [ ] Click "Save"
- [ ] Should see success message

### Expected Result:
✅ Customer appears in list immediately with a real ID (not `temp-...`)
✅ No "object not found" error
✅ Refresh page - customer still there

---

## Test Case 3: Create Order 📦

### Setup:
- [ ] Stay logged in
- [ ] Go to Orders page
- [ ] Click "New Order"

### Test:
- [ ] Select a customer (if exists, or create one first)
- [ ] Add products/items
- [ ] Set order details
- [ ] Click "Save"
- [ ] Should see success message

### Expected Result:
✅ Order appears in list immediately
✅ "Created By" shows YOUR name (correct user ID)
✅ No "object not found" error
✅ Refresh page - order still there with your name as creator

---

## Test Case 4: Loading State ⏳

### Setup:
- [ ] Log in to the app
- [ ] Go to any form page (Orders, Customers, etc.)

### Test:
- [ ] Refresh the page (F5)
- [ ] Watch what happens in first 2 seconds

### Expected Result:
✅ Briefly shows "Loading session..." or similar
✅ Then shows the full form/page
✅ NEVER shows "Not Authenticated" and then form
✅ No errors in browser console

---

## Test Case 5: Logout & Re-login 🔄

### Setup:
- [ ] You're logged in to the app

### Test:
- [ ] Click your profile menu
- [ ] Click "Logout"
- [ ] Refresh the page

### Expected Result:
✅ Redirected to login page
✅ Clearing browser storage removes you from the app
✅ Can log back in immediately
✅ Previous session is gone (can't access past pages without login)

---

## Test Case 6: Multiple Operations 🔀

### Setup:
- [ ] Log in as User A
- [ ] Have Browser B window open logged in as User B

### Test:
- [ ] In Browser A: Create an order
- [ ] In Browser B: Create a different order
- [ ] In Browser A: Create a customer
- [ ] In Browser B: Create a different customer
- [ ] Refresh both browsers

### Expected Result:
✅ User A's data shows in Browser A
✅ User B's data shows in Browser B
✅ After refresh, still separated correctly
✅ No data mixing between users

---

## ✓ Browser Console Check

After each test, open browser DevTools (F12) and check:

- [ ] No red error messages in Console tab
- [ ] No "temp-" ID warnings (should use `__temp_entity_uuid__` instead)
- [ ] No "[supabaseQueries] Failed to restore user" errors

---

## Rollback Instructions (If Needed)

If something doesn't work:

1. **Option 1**: Revert with Git
   ```
   git revert <commit-of-refactor>
   npm install
   npm run dev
   ```

2. **Option 2**: Find specific issue file from error message

3. **Option 3**: Contact support with error screenshot + browser console logs

---

## Success Checklist ✅

Once all above tests pass:

- [x] Multi-device login works
- [x] Orders save without temp-ID errors
- [x] Customers save without temp-ID errors
- [x] Auth loading state works correctly
- [x] Logout clears session
- [x] Multiple operations don't interfere

**RESULT**: You can now:
✅ Log in on multiple devices without interference
✅ Create orders/customers reliably every time
✅ Have a cleaner, more maintainable codebase

---

## Still Having Issues?

Check these troubleshooting points:

1. **"Not Authenticated" error on page load**
   - Wait a bit longer before clicking (auth is loading)
   - Check browser console for errors

2. **Order/Customer fails to save**
   - Make sure you're fully logged in (check dashboard loads)
   - Check browser console for actual error message
   - Try logging out and back in

3. **Two devices interfering with each other**
   - Make sure using DIFFERENT browsers (not just different tabs)
   - Clear browser cache/cookies
   - Check localStorage in browser DevTools

4. **Old "temp-" IDs still showing**
   - Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
   - Clear cache: DevTools → Network tab → checkbox "disable cache"

---

**Last Updated**: 2026-02-22
**Changes By**: Refactoring Task
**Status**: Ready for Testing

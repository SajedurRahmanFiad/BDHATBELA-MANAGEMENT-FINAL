/**
 * INFINITE LOADING DIAGNOSIS SCRIPT
 * 
 * INSTRUCTIONS:
 * 1. Open the app and navigate to Customers page
 * 2. Press F12 to open DevTools
 * 3. Click the Console tab
 * 4. Copy this entire script (the function below)
 * 5. Paste it into the console and press Enter
 * 6. Report the output
 * 
 * This script will identify WHY the page is stuck loading
 */

// First, let's get the supabase instance from the page
async function diagnoseLoadingIssue() {
  console.log('🔍 DIAGNOSING LOADING ISSUE...\n');

  // Note: Supabase must be accessible from the module cache
  // Directly test using fetch to Supabase API
  
  // Get environment from page (this assumes it's loaded)
  const SUPABASE_URL = import.meta?.env?.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta?.env?.VITE_SUPABASE_ANON_KEY;

  console.log('1️⃣  CHECKING CONFIGURATION');
  console.log('   Supabase URL configured:', !!SUPABASE_URL);
  console.log('   Supabase Anon Key configured:', !!SUPABASE_ANON_KEY);
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ MISSING ENVIRONMENT VARIABLES');
    console.error('   Action: Check .env.local has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    return;
  }

  console.log('\n2️⃣  CHECKING AUTHENTICATION');
  try {
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sb-ozjddzasadgffjjeqntc-auth-token') || 'NO_TOKEN'}`,
        'apikey': SUPABASE_ANON_KEY,
      }
    });
    
    if (authResponse.ok) {
      console.log('✅ Authentication: OK');
    } else if (authResponse.status === 401) {
      console.error('❌ Authentication: FAILED (401 Unauthorized)');
      console.error('   Action: Log in with your credentials');
      return;
    } else {
      console.error('❌ Authentication: ERROR', authResponse.status);
    }
  } catch (err) {
    console.error('❌ Authentication check failed:', err.message);
  }

  console.log('\n3️⃣  CHECKING CUSTOMERS TABLE');
  try {
    const tableResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?limit=1&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sb-ozjddzasadgffjjeqntc-auth-token') || 'NO_TOKEN'}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        }
      }
    );
    
    console.log('   HTTP Status:', tableResponse.status);
    
    if (tableResponse.status === 404) {
      console.error('❌ TABLE DOES NOT EXIST');
      console.error('   The customers table is missing');
      console.error('   Action: Create it using SQL from SUPABASE_INTEGRATION.md');
      return;
    } else if (tableResponse.status === 400) {
      const error = await tableResponse.json();
      console.error('❌ TABLE QUERY ERROR:', error.message);
      if (error.code === '42P01') {
        console.error('   Action: Create the customers table');
      } else if (error.code === '42501') {
        console.error('   Action: Run RLS_SETUP.sql to fix permissions');
      }
      return;
    } else if (tableResponse.status === 401) {
      console.error('❌ AUTHENTICATION REQUIRED');
      console.error('   Action: Make sure you are logged in');
      return;
    } else if (tableResponse.ok) {
      const data = await tableResponse.json();
      console.log('✅ Customers table exists and is accessible');
      console.log('   Found rows:', Array.isArray(data) ? data.length : 0);
      if (Array.isArray(data) && data.length === 0) {
        console.warn('   ⚠️  TABLE IS EMPTY');
        console.warn('   Action: Add test data via Supabase Table Editor');
      }
    } else {
      console.error('❌ Unexpected response:', tableResponse.status);
      const text = await tableResponse.text();
      console.error('   Response:', text.substring(0, 200));
    }
  } catch (err) {
    console.error('❌ Network request failed:', err.message);
    console.error('   Action: Check your internet connection');
  }

  console.log('\n4️⃣  CHECKING BROWSER NETWORK');
  console.log('   Open DevTools → Network tab');
  console.log('   Refresh the page');
  console.log('   Look for requests to supabase');
  console.log('   Check if they hang or complete');

  console.log('\n5️⃣  SUGGESTION');
  console.log('   Hard refresh the page: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)');
  console.log('   This clears cached data that might be causing issues');
}

// Run the diagnosis
diagnoseLoadingIssue().catch(err => {
  console.error('Diagnostic error:', err);
});


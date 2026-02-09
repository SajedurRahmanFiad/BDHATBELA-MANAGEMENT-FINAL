/**
 * Supabase Diagnostic Test
 * Copy and paste this into your browser console (F12) to debug the connection
 */

(async () => {
  console.clear();
  console.log('🔧 SUPABASE DIAGNOSTIC TEST');
  console.log('================================\n');

  try {
    // Get Supabase from window
    const supabaseModule = window.__SUPABASE__ || {};
    console.log('✓ Page loaded');

    // Import from import.meta.env
    const root = document.querySelector('[id="root"]');
    if (!root || !root.__reactFiber$) {
      console.error('❌ Cannot access React internals. Make sure app is loaded.');
      return;
    }

    console.log('✓ React app detected\n');

    // The easiest way: fetch directly using the fetch API
    const SUPABASE_URL = 'https://phfwljfzwelswbrqtlha.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd5anfpbXdlbHN3YnJxdGxoYSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzI0MDczMzk0LCJleHAiOjE5OTk2NDMzOTR9.1C0D39pKH6EqF3w0LVFn5KkT8h8M8OfBSCzFdxvxq4s';

    console.log('📋 TEST 1: Fetch Customers via HTTP');
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      }
    );

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ SUCCESS! Found ${result.length} customers`);
      console.table(result.slice(0, 5));
    } else {
      console.error('❌ FAILED!');
      console.error('Status:', response.status);
      console.error('Response:', result);
      if (result.code === 'PGRST301') {
        console.error('\n🔐 RLS POLICY ERROR');
        console.error('The policies are blocking access. Make sure you ran RLS_SETUP.sql');
      }
    }

    console.log('\n📊 TEST 2: Check Auth Session');
    const sessionResp = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sb-phfwljfzwelswbrqtlha-auth-token') || 'NO_TOKEN'}`,
        }
      }
    );
    const sessionData = await sessionResp.json();
    if (sessionResp.ok) {
      console.log('✅ Auth Token Valid');
      console.log('User:', sessionData.email || sessionData.id);
    } else {
      console.warn('⚠️ Auth token issue or not logged in');
    }

  } catch (err) {
    console.error('💥 Exception:', err.message);
  }
})();

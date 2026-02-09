/**
 * Debug script to test if Supabase customers can be fetched
 * Run this in the browser console to see what's happening
 */

(async () => {
  console.log('🔍 Starting Supabase customers debug...');

  // Get Supabase URL and key from the environment
  const SUPABASE_URL = 'https://phfwljfzwelswbrqtlha.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd5anfpbXdlbHN3YnJxdGxoYSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzI0MDczMzk0LCJleHAiOjE5OTk2NDMzOTR9.1C0D39pKH6EqF3w0LVFn5KkT8h8M8OfBSCzFdxvxq4s';

  try {
    // 1. Check if we can initialize Supabase
    console.log('📦 Creating Supabase client...');
    const { createClient } = window.supabase;
    if (!createClient) {
      throw new Error('Supabase JS library not loaded. Run: npm install @supabase/supabase-js');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client created');

    // 2. Check current auth session
    console.log('📋 Checking current auth session...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('Session:', sessionData?.session ? '✅ Authenticated' : '❌ Not authenticated');
    if (sessionData?.session) {
      console.log('  User:', sessionData.session.user.email);
    } else {
      console.warn('⚠️  You are not logged in! Supabase requires authentication to read data.');
      return;
    }

    // 3. Try to fetch customers
    console.log('👥 Attempting to fetch customers...');
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching customers:', error);
      
      if (error.code === 'PGRST301') {
        console.error('🔐 RLS Policy Error!');
        console.error('The database has Row Level Security (RLS) enabled, but no policy allows authenticated users to read from the customers table.');
        console.error('');
        console.error('To fix this:');
        console.error('1. Go to https://app.supabase.com → Your Project → SQL Editor');
        console.error('2. Create a new query and run the SQL from RLS_SETUP.md');
        console.error('3. This will create policies allowing authenticated users to access all tables');
      } else if (error.code === 'PGRST116') {
        console.error('❌ Table not found - The customers table does not exist');
      } else if (error.code === '42P01') {
        console.error('❌ Table does not exist - Create tables first in Supabase');
      } else {
        console.error('Error details:', error);
      }
      return;
    }

    if (!data) {
      console.warn('⚠️  No data returned (null)');
      return;
    }

    console.log(`✅ Successfully fetched ${data.length} customers`);
    console.table(data.slice(0, 5)); // Show first 5 as table

    if (data.length === 0) {
      console.warn('⚠️  The customers table is empty. Add some customers in Supabase.');
    }

  } catch (err) {
    console.error('💥 Exception:', err.message);
    console.error('Stack:', err.stack);
  }
})();

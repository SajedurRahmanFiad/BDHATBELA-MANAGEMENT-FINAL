import { createClient } from '@supabase/supabase-js';

// Require Vite env variables for Supabase. Fail fast in development when missing.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utility: construct a stable pseudo-email for phone-based auth flow.
// NOTE: Prefer registering users in Supabase Auth properly (email or phone). This helper
// is a pragmatic bridge for the existing client which uses phone as identifier.
export function phoneToEmail(phone: string) {
  const cleaned = phone.replace(/[^0-9]/g, '');
  return `${cleaned}@bdhatbela.local`;
}

export default supabase;

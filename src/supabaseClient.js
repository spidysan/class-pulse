import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    '[SupabaseClient] Warning: Supabase environment variables are missing! ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env.local file at the root.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

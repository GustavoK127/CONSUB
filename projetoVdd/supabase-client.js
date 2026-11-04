import { createClient } from '@supabase/supabase-js';

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigured = Boolean(projectUrl && publishableKey);
export const supabaseClient = supabaseConfigured
  ? createClient(projectUrl, publishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

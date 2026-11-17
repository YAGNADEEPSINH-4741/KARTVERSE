// ============================================================================
// KARTVERSE — Supabase Client Instance
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {};
const supabaseUrl = env?.VITE_SUPABASE_URL || 'https://rlclbbnvciqnxmppjavr.supabase.co';
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsY2xiYm52Y2lxbnhtcHBqYXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMTUwMTcsImV4cCI6MjEwOTY5MTAxN30.kgSQX2bxRJvfJNi9hrmzH00DP42hbNhT-fv5sk3oRIQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});


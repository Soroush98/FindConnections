import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/env';

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * Bypasses RLS. NEVER import this from client components or expose to the browser.
 */
class SupabaseAdminSingleton {
  private static instance: SupabaseClient | null = null;

  static getInstance(): SupabaseClient {
    if (!this.instance) {
      if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
        throw new Error(
          'Supabase service-role client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
        );
      }
      this.instance = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.instance;
  }
}

export const supabaseAdmin = SupabaseAdminSingleton.getInstance();

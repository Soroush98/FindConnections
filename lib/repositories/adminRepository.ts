import { supabaseAdmin } from '@/lib/db';

const TABLE_NAME = 'admins';

export interface AdminInfo {
  Id: string;
  Email: string;
  Password: string;
}

interface AdminRow {
  id: string;
  email: string;
  password: string | null;
}

function toAdminInfo(row: AdminRow | null | undefined): AdminInfo | null {
  if (!row || !row.password) return null;
  return { Id: row.id, Email: row.email, Password: row.password };
}

/**
 * Admin Repository — backed by Supabase Postgres (public.admins).
 * Service-role client; bypasses RLS.
 */
export class AdminRepository {
  /**
   * Find an admin by email (case-insensitive — column is citext).
   */
  async findByEmail(email: string): Promise<AdminInfo | null> {
    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .select('id, email, password')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new Error(`adminRepository.findByEmail: ${error.message}`);
    return toAdminInfo(data);
  }

  /**
   * Find an admin by ID.
   */
  async findById(id: string): Promise<AdminInfo | null> {
    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .select('id, email, password')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`adminRepository.findById: ${error.message}`);
    return toAdminInfo(data);
  }
}

export const adminRepository = new AdminRepository();

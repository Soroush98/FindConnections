/**
 * Create or update an admin row in public.admins.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts <email> <password>
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error('Usage: tsx scripts/seed-admin.ts <email> <password>');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const hash = await bcrypt.hash(password, 10);

  const { data: existing, error: findErr } = await supabase
    .from('admins')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();
  if (findErr) {
    console.error('lookup failed:', findErr.message);
    process.exit(1);
  }

  if (existing) {
    const { error } = await supabase
      .from('admins')
      .update({ password: hash })
      .eq('id', existing.id);
    if (error) {
      console.error('update failed:', error.message);
      process.exit(1);
    }
    console.log(`✓ updated password for existing admin ${email} (id=${existing.id})`);
    return;
  }

  const { data, error } = await supabase
    .from('admins')
    .insert({ email, password: hash })
    .select('id, email')
    .single();
  if (error) {
    console.error('insert failed:', error.message);
    process.exit(1);
  }
  console.log(`✓ created admin ${data.email} (id=${data.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

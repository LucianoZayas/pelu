import { createClient } from '@supabase/supabase-js';

/** Service-role client. SOLO para seed/scripts/server-side admin. NUNCA exponer al browser. */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

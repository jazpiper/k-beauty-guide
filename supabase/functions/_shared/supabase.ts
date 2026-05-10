import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type ServiceRoleClientResult =
  | { ok: true; client: SupabaseClient }
  | { ok: false; missing: string[] };

export function createServiceRoleClient(): ServiceRoleClientResult {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      missing: [
        ...(!supabaseUrl ? ["SUPABASE_URL"] : []),
        ...(!serviceRoleKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
      ],
    };
  }

  return {
    ok: true,
    client: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  };
}

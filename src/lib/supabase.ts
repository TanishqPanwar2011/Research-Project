import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Every visitor gets a private anonymous account, so row-level security keeps their runs separate. */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: d, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return d.session;
}

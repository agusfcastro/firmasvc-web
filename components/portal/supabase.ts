import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const claveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null cuando faltan las variables de entorno. El portal lo avisa en pantalla. */
export const supabase: SupabaseClient | null =
  url && claveAnonima
    ? createClient(url, claveAnonima, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      })
    : null;

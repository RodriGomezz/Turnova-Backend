import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;
const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

// Secret key: solo se usa en el backend, nunca en el frontend
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseSecretKey,
  clientOptions,
);

// Crear un cliente aislado evita que una sesion de auth mutada en memoria
// contamine el cliente admin compartido para consultas a la base.
export function createSupabaseAuthClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseSecretKey, clientOptions);
}

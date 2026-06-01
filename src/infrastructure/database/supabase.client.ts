import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl       = process.env.SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

// Timeout de 8s para todas las llamadas a Supabase.
// Sin esto, si Supabase tiene latencia alta el request del usuario queda
// colgado indefinidamente bloqueando el event loop.
const SUPABASE_TIMEOUT_MS = 8_000;

function fetchWithTimeout(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

const clientOptions = {
  auth: {
    autoRefreshToken:   false,
    persistSession:     false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
};

// Cliente admin — usa secret key, nunca exponer al frontend
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseSecretKey,
  clientOptions,
);

// Cliente aislado para operaciones de auth — evita que una sesión mutada
// en memoria contamine el cliente admin compartido para queries a la BD.
export function createSupabaseAuthClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseSecretKey, clientOptions);
}
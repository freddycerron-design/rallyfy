import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Los tipos generados (`supabase gen types`) se agregan en la Fase 1.
export const supabase = createClient(
  env.supabaseUrl || 'http://127.0.0.1:54321',
  env.supabaseAnonKey || 'falta-configurar-VITE_SUPABASE_ANON_KEY',
)

/** Variables de entorno públicas del frontend (ver `.env.example`). */
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '',
  estiloMapaUrl:
    import.meta.env.VITE_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty',
  realtimePublico: import.meta.env.VITE_REALTIME_PUBLICO !== 'false',
} as const

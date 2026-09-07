import { createClient } from '@supabase/supabase-js'

// lê as variáveis de ambiente (Vite exige o prefixo VITE_)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// cria o client mesmo que as variáveis estejam vazias — evita importar "null" e quebrar a aplicação.
// Em runtime, chamadas ao Supabase falharão claramente se as chaves estiverem ausentes.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Client sẽ là null nếu chưa configure .env — app vẫn chạy offline bình thường
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isSupabaseReady = () => !!supabase

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function signInWithEmail(email) {
  if (!supabase) throw new Error('Supabase chưa được cấu hình')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {}
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return () => subscription.unsubscribe()
}

// ── Generic DB helpers ────────────────────────────────────────────────────────

/**
 * Upsert một record lên Supabase. Fire-and-forget (không throw khi offline).
 * @param {string} table - tên bảng
 * @param {object} data  - record cần upsert (phải có id là UUID)
 */
export async function upsertRecord(table, data) {
  if (!supabase) return
  const session = await getSession()
  if (!session) return
  const { error } = await supabase.from(table).upsert({
    ...data,
    user_id: session.user.id,
  })
  if (error) console.warn(`[supabase] upsert ${table} failed:`, error.message)
}

/**
 * Delete một record trên Supabase.
 */
export async function deleteRecord(table, id) {
  if (!supabase) return
  const session = await getSession()
  if (!session) return
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) console.warn(`[supabase] delete ${table}:${id} failed:`, error.message)
}

/**
 * Fetch tất cả records của user từ một bảng.
 */
export async function fetchAll(table, orderBy = 'created_at', ascending = false) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(orderBy, { ascending })
  if (error) {
    console.warn(`[supabase] fetch ${table} failed:`, error.message)
    return null
  }
  return data
}

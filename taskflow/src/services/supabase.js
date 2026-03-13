import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Client sẽ là null nếu chưa configure .env — app vẫn chạy offline bình thường
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

console.log('[Supabase]', supabase ? `✅ Ready — ${supabaseUrl}` : '❌ Not configured (missing env vars)')

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

// ── Dual-write helpers ────────────────────────────────────────────────────────

// camelCase Dexie fields → snake_case Supabase columns
const FIELD_MAP = {
  createdAt: 'created_at',
  estimatedMinutes: 'estimated_minutes',
  doneAt: 'done_at',
  coverEmoji: 'cover_emoji',
  readingMinutes: 'reading_minutes',
  progressLog: 'progress_log',
}

// Fields to skip during auto-mapping (handled via overrides or not needed)
const SKIP_FIELDS = new Set(['id', 'cloudId', 'goalId'])

/**
 * Sync a Dexie record to Supabase. Fire-and-forget — never throws.
 * Skips silently if Supabase not configured, user not logged in, or no cloudId.
 * @param {string} table     - Supabase table name
 * @param {object} record    - Dexie record (must have cloudId)
 * @param {object} overrides - Extra Supabase fields (e.g. { goal_id: uuid })
 */
export async function syncToCloud(table, record, overrides = {}) {
  if (!supabase || !record?.cloudId) return
  const session = await getSession()
  if (!session) return
  const supaRec = { id: record.cloudId, user_id: session.user.id }
  for (const [k, v] of Object.entries(record)) {
    if (SKIP_FIELDS.has(k)) continue
    supaRec[FIELD_MAP[k] || k] = v
  }
  Object.assign(supaRec, overrides)
  const { error } = await supabase.from(table).upsert(supaRec)
  if (error) console.warn(`[supabase] sync ${table}:`, error.message)
}

/**
 * Delete a record from Supabase by its cloudId. Fire-and-forget.
 */
export async function deleteFromCloud(table, cloudId) {
  if (!supabase || !cloudId) return
  const session = await getSession()
  if (!session) return
  const { error } = await supabase.from(table).delete().eq('id', cloudId)
  if (error) console.warn(`[supabase] delete ${table}:`, error.message)
}

// ── User Preferences helpers ──────────────────────────────────────────────────

/**
 * Upsert user preferences. Primary key là user_id (không cần cloudId).
 */
export async function syncPreferences(prefs) {
  if (!supabase) return
  const session = await getSession()
  if (!session) return
  const { error } = await supabase.from('user_preferences').upsert({
    user_id: session.user.id,
    ...prefs,
    updated_at: new Date().toISOString(),
  })
  if (error) console.warn('[supabase] sync preferences:', error.message)
}

/**
 * Fetch user preferences từ Supabase. Returns null nếu chưa login hoặc chưa có row.
 */
export async function fetchPreferences() {
  if (!supabase) return null
  const session = await getSession()
  if (!session) return null
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .maybeSingle()
  if (error) return null
  return data
}

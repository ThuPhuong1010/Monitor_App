/**
 * aiCache.js — Smart caching layer for AI API calls
 * 
 * Features:
 * - Cache responses by prompt hash (same question → cached answer)
 * - Different TTL per feature type
 * - Persist in localStorage (survives reload)
 * - Stats tracking: hits, misses, tokens saved
 * - Rate limiter: prevent exceeding 15 RPM per key
 * - Auto-cleanup expired entries
 */

// ─── Cache Storage ───────────────────────────────────────────────

const CACHE_KEY = 'taskflow_ai_cache'
const CACHE_STATS_KEY = 'taskflow_ai_cache_stats'
const RATE_LOG_KEY = 'taskflow_ai_rate_log'

// TTL per feature type (in milliseconds)
const FEATURE_TTL = {
    parseTasksFromText: 5 * 60 * 1000,         // 5 min — same text = same tasks
    summarizeUrl: 24 * 60 * 60 * 1000,          // 24h — URL content rarely changes
    expandTaskNotes: 60 * 60 * 1000,            // 1h — same title = same notes
    chatWithAI: 0,                               // NO CACHE — chat always fresh
    rankTasksWithAI: 30 * 60 * 1000,            // 30 min — ranking changes slowly
    synthesizeDailyPriorities: 2 * 60 * 60 * 1000, // 2h — priorities change slowly
    generateWeeklySummary: 24 * 60 * 60 * 1000,  // 24h — weekly data doesn't change
    suggestDeadline: 60 * 60 * 1000,            // 1h — deadline suggestion stable
    breakdownGoal: 30 * 60 * 1000,              // 30 min — goal breakdown
    enrichIdea: 30 * 60 * 1000,                 // 30 min — idea enrichment
    suggestDailyPlan: 2 * 60 * 60 * 1000,       // 2h — daily plan
    analyzeImageForTasks: 10 * 60 * 1000,       // 10 min — image analysis
    default: 15 * 60 * 1000,                    // 15 min fallback
}

// Max cache entries to prevent localStorage bloat
const MAX_CACHE_ENTRIES = 100

// ─── Hash function ───────────────────────────────────────────────

function hashPrompt(prompt) {
    // Simple but effective hash for cache keys
    let hash = 0
    const str = prompt.slice(0, 2000) // Only hash first 2000 chars for performance
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    return 'c_' + Math.abs(hash).toString(36)
}

// ─── Cache CRUD ──────────────────────────────────────────────────

function loadCache() {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    } catch { return {} }
}

function saveCache(cache) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    } catch (e) {
        // localStorage full — clear oldest entries
        console.warn('[AICache] Storage full, clearing old entries')
        const entries = Object.entries(cache)
        entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0))
        const trimmed = Object.fromEntries(entries.slice(Math.floor(entries.length / 2)))
        localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed))
    }
}

/**
 * Get cached response for a prompt
 * @param {string} prompt - The AI prompt
 * @param {string} feature - Feature name for TTL lookup
 * @returns {string|null} - Cached response or null
 */
export function getCachedResponse(prompt, feature = 'default') {
    const cache = loadCache()
    const key = hashPrompt(prompt)
    const entry = cache[key]

    if (!entry) return null

    const ttl = FEATURE_TTL[feature] || FEATURE_TTL.default
    if (ttl === 0) return null // Feature has caching disabled

    const age = Date.now() - entry.ts
    if (age > ttl) {
        // Expired — remove entry
        delete cache[key]
        saveCache(cache)
        return null
    }

    // Cache HIT!
    trackCacheStats('hit', feature, entry.tokens || 0)
    return entry.response
}

/**
 * Store a response in cache
 * @param {string} prompt - The AI prompt  
 * @param {string} response - The AI response
 * @param {string} feature - Feature name
 * @param {number} estimatedTokens - Tokens this call used
 */
export function setCachedResponse(prompt, response, feature = 'default', estimatedTokens = 0) {
    const ttl = FEATURE_TTL[feature] || FEATURE_TTL.default
    if (ttl === 0) return // Don't cache features with TTL=0

    const cache = loadCache()
    const key = hashPrompt(prompt)

    cache[key] = {
        response,
        ts: Date.now(),
        feature,
        tokens: estimatedTokens,
    }

    // Enforce max entries
    const entries = Object.entries(cache)
    if (entries.length > MAX_CACHE_ENTRIES) {
        entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0))
        const trimmed = Object.fromEntries(entries.slice(entries.length - MAX_CACHE_ENTRIES))
        saveCache(trimmed)
    } else {
        saveCache(cache)
    }

    trackCacheStats('miss', feature, 0)
}

// ─── Cache Stats ─────────────────────────────────────────────────

function loadCacheStats() {
    try {
        return JSON.parse(localStorage.getItem(CACHE_STATS_KEY) || '{"hits":0,"misses":0,"tokensSaved":0,"byFeature":{}}')
    } catch { return { hits: 0, misses: 0, tokensSaved: 0, byFeature: {} } }
}

function trackCacheStats(type, feature, tokensSaved) {
    const stats = loadCacheStats()
    if (type === 'hit') {
        stats.hits++
        stats.tokensSaved += tokensSaved
    } else {
        stats.misses++
    }

    if (!stats.byFeature[feature]) stats.byFeature[feature] = { hits: 0, misses: 0 }
    stats.byFeature[feature][type === 'hit' ? 'hits' : 'misses']++

    localStorage.setItem(CACHE_STATS_KEY, JSON.stringify(stats))
}

export function getCacheStats() {
    const stats = loadCacheStats()
    const cache = loadCache()
    const totalEntries = Object.keys(cache).length
    const hitRate = stats.hits + stats.misses > 0
        ? Math.round((stats.hits / (stats.hits + stats.misses)) * 100)
        : 0

    return {
        ...stats,
        totalEntries,
        hitRate,
        estimatedSavings: `~${Math.round(stats.tokensSaved / 1000)}k tokens`,
    }
}

export function clearCache() {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_STATS_KEY)
}

export function getCacheSize() {
    const raw = localStorage.getItem(CACHE_KEY) || '{}'
    return (raw.length * 2) / 1024 // Approximate KB (UTF-16)
}

// ─── Rate Limiter ────────────────────────────────────────────────

const RATE_WINDOW = 60 * 1000 // 1 minute window
const MAX_RPM = 14 // Stay under 15 RPM limit with safety margin

function loadRateLog() {
    try {
        return JSON.parse(localStorage.getItem(RATE_LOG_KEY) || '[]')
    } catch { return [] }
}

function saveRateLog(log) {
    localStorage.setItem(RATE_LOG_KEY, JSON.stringify(log))
}

/**
 * Check if we can make an API call right now
 * @returns {{ allowed: boolean, waitMs: number, currentRPM: number }}
 */
export function checkRateLimit() {
    const now = Date.now()
    let log = loadRateLog()

    // Clean old entries (older than 1 minute)
    log = log.filter(ts => now - ts < RATE_WINDOW)
    saveRateLog(log)

    const currentRPM = log.length

    if (currentRPM >= MAX_RPM) {
        // Calculate wait time until oldest entry expires
        const oldestTs = Math.min(...log)
        const waitMs = RATE_WINDOW - (now - oldestTs) + 100 // +100ms safety
        return { allowed: false, waitMs, currentRPM }
    }

    return { allowed: true, waitMs: 0, currentRPM }
}

/**
 * Record an API call for rate limiting
 */
export function recordApiCall() {
    const log = loadRateLog()
    log.push(Date.now())
    saveRateLog(log)
}

/**
 * Wait until rate limit allows a call
 * Shows progress in console
 */
export async function waitForRateLimit() {
    const check = checkRateLimit()
    if (check.allowed) return

    console.log(`[AICache] Rate limit: ${check.currentRPM}/${MAX_RPM} RPM. Waiting ${Math.ceil(check.waitMs / 1000)}s...`)
    await new Promise(resolve => setTimeout(resolve, check.waitMs))

    // Check again (recursive, but normally only 1 iteration)
    return waitForRateLimit()
}

/**
 * Get current rate limit status for display
 */
export function getRateLimitStatus() {
    const now = Date.now()
    let log = loadRateLog()
    log = log.filter(ts => now - ts < RATE_WINDOW)

    return {
        currentRPM: log.length,
        maxRPM: MAX_RPM,
        percentage: Math.round((log.length / MAX_RPM) * 100),
        isNearLimit: log.length >= MAX_RPM - 2,
    }
}

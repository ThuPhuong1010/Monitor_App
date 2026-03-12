/**
 * keyVault.js — Multi-key management for AI API keys
 * 
 * Features:
 * - Lưu nhiều key cho mỗi provider (Gemini/Claude)
 * - Mỗi key có: label, account info, status, usage stats
 * - Quick switch khi bị rate limit
 * - Auto-rotate sang key khác khi bị rate limit
 */

const VAULT_KEY = 'taskflow_key_vault'

// ─── Data structure ──────────────────────────────────────────────
// {
//   keys: [...],
//   activeKeyId: { claude: 'uuid', gemini: 'uuid' }
// }

function loadVault() {
    try {
        return JSON.parse(localStorage.getItem(VAULT_KEY) || '{"keys":[],"activeKeyId":{}}')
    } catch {
        return { keys: [], activeKeyId: {} }
    }
}

function saveVault(vault) {
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault))
}

// ─── CRUD ────────────────────────────────────────────────────────

export function getAllKeys(provider = null) {
    const vault = loadVault()
    if (provider) return vault.keys.filter(k => k.provider === provider)
    return vault.keys
}

export function getKeyById(id) {
    return loadVault().keys.find(k => k.id === id)
}

export function addKey({ provider, key, label, accountEmail, accountUrl }) {
    const vault = loadVault()
    const newKey = {
        id: crypto.randomUUID(),
        provider,
        key: key.trim(),
        label: label?.trim() || `Key ${vault.keys.filter(k => k.provider === provider).length + 1}`,
        accountEmail: accountEmail?.trim() || '',
        accountUrl: accountUrl?.trim() || '',
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        status: 'active', // active | rate_limited | expired | error
        statusMessage: '',
        statusUpdatedAt: null,
        callCount: 0,
        errorCount: 0,
        lastError: '',
    }
    vault.keys.push(newKey)
    // Auto-set as active if first key for this provider
    if (!vault.activeKeyId[provider]) {
        vault.activeKeyId[provider] = newKey.id
    }
    saveVault(vault)
    return newKey
}

export function updateKey(id, changes) {
    const vault = loadVault()
    const idx = vault.keys.findIndex(k => k.id === id)
    if (idx < 0) return null
    vault.keys[idx] = { ...vault.keys[idx], ...changes }
    saveVault(vault)
    return vault.keys[idx]
}

export function deleteKey(id) {
    const vault = loadVault()
    const key = vault.keys.find(k => k.id === id)
    vault.keys = vault.keys.filter(k => k.id !== id)
    // If deleted key was active, switch to another
    if (key && vault.activeKeyId[key.provider] === id) {
        const remaining = vault.keys.filter(k => k.provider === key.provider)
        vault.activeKeyId[key.provider] = remaining[0]?.id || null
    }
    saveVault(vault)
}

// ─── Active key management ───────────────────────────────────────

export function getActiveKey(provider) {
    const vault = loadVault()
    const activeId = vault.activeKeyId[provider]
    if (!activeId) return null
    return vault.keys.find(k => k.id === activeId) || null
}

export function setActiveKey(provider, keyId) {
    const vault = loadVault()
    vault.activeKeyId[provider] = keyId
    saveVault(vault)
}

/**
 * Lấy key value để dùng cho API call
 * Fallback: nếu vault không có → lấy từ settings (backward compatible)
 */
export function getActiveKeyValue(provider) {
    const active = getActiveKey(provider)
    return active?.key || null
}

// ─── Usage tracking per key ──────────────────────────────────────

export function trackKeyUsage(provider) {
    const vault = loadVault()
    const activeId = vault.activeKeyId[provider]
    if (!activeId) return
    const key = vault.keys.find(k => k.id === activeId)
    if (!key) return
    key.callCount = (key.callCount || 0) + 1
    key.lastUsedAt = new Date().toISOString()
    saveVault(vault)
}

export function markKeyRateLimited(provider, errorMessage = '') {
    const vault = loadVault()
    const activeId = vault.activeKeyId[provider]
    if (!activeId) return null

    const key = vault.keys.find(k => k.id === activeId)
    if (!key) return null

    key.status = 'rate_limited'
    key.statusMessage = errorMessage
    key.statusUpdatedAt = new Date().toISOString()
    key.errorCount = (key.errorCount || 0) + 1
    key.lastError = errorMessage

    // Auto-rotate: try to find another active key
    const alternatives = vault.keys.filter(k =>
        k.provider === provider &&
        k.id !== activeId &&
        k.status === 'active'
    )

    let rotatedTo = null
    if (alternatives.length > 0) {
        vault.activeKeyId[provider] = alternatives[0].id
        rotatedTo = alternatives[0]
    }

    saveVault(vault)
    return rotatedTo // returns the key we rotated to, or null
}

export function markKeyActive(keyId) {
    const vault = loadVault()
    const key = vault.keys.find(k => k.id === keyId)
    if (!key) return
    key.status = 'active'
    key.statusMessage = ''
    key.statusUpdatedAt = new Date().toISOString()
    saveVault(vault)
}

export function markKeyError(keyId, message) {
    const vault = loadVault()
    const key = vault.keys.find(k => k.id === keyId)
    if (!key) return
    key.status = 'error'
    key.statusMessage = message
    key.statusUpdatedAt = new Date().toISOString()
    key.lastError = message
    key.errorCount = (key.errorCount || 0) + 1
    saveVault(vault)
}

// ─── Migration: import old single keys into vault ────────────────

export function migrateFromSettings(provider, keyValue, label) {
    if (!keyValue?.trim()) return
    const vault = loadVault()
    // Check if this key already exists
    if (vault.keys.some(k => k.key === keyValue.trim())) return
    addKey({
        provider,
        key: keyValue,
        label: label || `Key from Settings`,
        accountEmail: '',
        accountUrl: provider === 'gemini'
            ? 'https://aistudio.google.com/app/apikey'
            : provider === 'gpt'
                ? 'https://platform.openai.com/api-keys'
                : 'https://console.anthropic.com',
    })
}

// ─── Stats ────────────────────────────────────────────────────────

export function getKeyStats(provider) {
    const keys = getAllKeys(provider)
    const active = getActiveKey(provider)
    return {
        total: keys.length,
        active: keys.filter(k => k.status === 'active').length,
        rateLimited: keys.filter(k => k.status === 'rate_limited').length,
        error: keys.filter(k => k.status === 'error').length,
        activeKey: active,
        totalCalls: keys.reduce((sum, k) => sum + (k.callCount || 0), 0),
    }
}

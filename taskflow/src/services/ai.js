/**
 * ai.js — Multi-provider AI service
 * Supports: Claude (Anthropic) | Gemini (Google)
 *
 * Tính năng AI hiện tại:
 *  1. parseTasksFromText  — paste đoạn text → extract danh sách tasks
 *  2. summarizeUrl        — URL → title + tóm tắt + tags
 *
 * Tính năng AI có thể mở rộng:
 *  3. expandTaskNotes     — title ngắn → ghi chú chi tiết
 *  4. suggestDeadline     — title task → đề xuất deadline hợp lý
 *  5. dailyDigest         — toàn bộ tasks → tóm tắt ngắn ngày hôm nay
 *  6. smartCategorize     — title → category + priority gợi ý
 */

import { getSetting, setSetting } from './db'
import { getActiveKeyValue, trackKeyUsage, markKeyRateLimited, getAllKeys, setActiveKey } from './keyVault'
import { showToast } from './globalToast'
import { getCachedResponse, setCachedResponse, waitForRateLimit, recordApiCall, getCacheStats, getRateLimitStatus } from './aiCache'

// ─── Provider config ─────────────────────────────────────────────

export const AI_PROVIDERS = {
  claude: {
    id: 'claude',
    name: 'Claude (Anthropic)',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'],
    defaultModel: 'claude-haiku-4-5-20251001',
    keyPlaceholder: 'sk-ant-api03-...',
    keyUrl: 'https://console.anthropic.com',
    keyLabel: 'Anthropic API Key',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini (Google)',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-flash-lite'],
    defaultModel: 'gemini-2.0-flash',
    keyPlaceholder: 'AIzaSy...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyLabel: 'Google AI Studio Key',
  },
  gpt: {
    id: 'gpt',
    name: 'GPT (OpenAI)',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'],
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLabel: 'OpenAI API Key',
  },
}

// ─── Load settings ────────────────────────────────────────────────

const DEPRECATED_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro']

async function getAIConfig() {
  const provider = (await getSetting('aiProvider')) || 'claude'
  let model = (await getSetting('aiModel')) || AI_PROVIDERS[provider]?.defaultModel
  // Auto-fix deprecated models
  if (DEPRECATED_MODELS.includes(model)) {
    model = AI_PROVIDERS[provider]?.defaultModel || 'gemini-2.0-flash'
    await setSetting('aiModel', model)
  }

  // Priority: Key Vault → Settings (backward compatible)
  let key = getActiveKeyValue(provider)
  if (!key) {
    const keyMap = { claude: 'claudeApiKey', gemini: 'geminiApiKey', gpt: 'gptApiKey' }
    key = await getSetting(keyMap[provider] || 'claudeApiKey')
  }
  if (!key) throw new Error('NO_API_KEY')
  return { provider, model, key }
}

// ─── Call wrappers ────────────────────────────────────────────────

// Usage tracker — lưu trong localStorage
const USAGE_KEY = 'taskflow_ai_usage'

function getUsageData() {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}')
  } catch { return {} }
}

function trackCall(provider, model, estimatedTokens, success) {
  const usage = getUsageData()
  const today = new Date().toISOString().slice(0, 10)
  const hour = new Date().getHours()

  if (!usage[today]) usage[today] = { calls: 0, tokens: 0, errors: 0, byHour: {}, byFeature: {} }
  usage[today].calls++
  usage[today].tokens += estimatedTokens
  if (!success) usage[today].errors++

  // Track by hour for rate limit awareness
  if (!usage[today].byHour[hour]) usage[today].byHour[hour] = 0
  usage[today].byHour[hour]++

  // Keep only last 7 days
  const keys = Object.keys(usage).sort().reverse()
  const trimmed = {}
  keys.slice(0, 7).forEach(k => { trimmed[k] = usage[k] })

  localStorage.setItem(USAGE_KEY, JSON.stringify(trimmed))
}

export function getAIUsageStats() {
  const usage = getUsageData()
  const today = new Date().toISOString().slice(0, 10)
  const todayData = usage[today] || { calls: 0, tokens: 0, errors: 0, byHour: {} }

  // Calculate recent rate (last minute)
  const allDays = Object.keys(usage).sort().reverse()
  const totalCalls = allDays.reduce((sum, d) => sum + (usage[d]?.calls || 0), 0)
  const totalTokens = allDays.reduce((sum, d) => sum + (usage[d]?.tokens || 0), 0)
  const totalErrors = allDays.reduce((sum, d) => sum + (usage[d]?.errors || 0), 0)

  return {
    today: todayData,
    total: { calls: totalCalls, tokens: totalTokens, errors: totalErrors, days: allDays.length },
    history: usage,
  }
}

export function resetAIUsageStats() {
  localStorage.removeItem(USAGE_KEY)
}

// Auto-retry with key rotation — loops through all available keys

async function withRetry(callFactory, provider) {
  // callFactory(key, model) → returns promise. Re-invoked with different key on rotation.
  const config = await getAIConfig()

  // Try with current key first
  try {
    return await callFactory(config.key, config.model)
  } catch (err) {
    if (!isRateLimitError(err)) throw err

    console.log(`[AI] Key rate limited, attempting rotation...`)
    markKeyRateLimited(provider, err.message)
  }

  // Current key failed — try rotating through all other active keys
  const allKeys = getAllKeys(provider).filter(k => k.status === 'active')

  for (const altKey of allKeys) {
    // Skip if this is the same key we just tried
    if (altKey.key === config.key) continue

    console.log(`[AI] Trying key: ${altKey.label} (${altKey.key.slice(0, 8)}...)`)
    setActiveKey(provider, altKey.id)

    try {
      const result = await callFactory(altKey.key, config.model)
      trackKeyUsage(provider)
      showToast({ type: 'info', message: `🔄 Key auto-switched sang "${altKey.label}"`, duration: 3000 })
      return result
    } catch (rotateErr) {
      if (!isRateLimitError(rotateErr)) throw rotateErr
      console.log(`[AI] Key "${altKey.label}" cũng bị rate limit`)
      markKeyRateLimited(provider, rotateErr.message)
      continue
    }
  }

  // All keys exhausted — wait and retry with original key as last resort
  const retryDelay = 15000 // 15 seconds
  showToast({
    type: 'error',
    message: `⚠️ Tất cả API key đều bị rate limit! Tự động retry sau ${retryDelay / 1000}s... Vào Settings → Key Vault để thêm key mới.`,
    duration: retryDelay,
  })

  console.log(`[AI] ALL keys exhausted! Waiting ${retryDelay}ms before final retry...`)
  await new Promise(r => setTimeout(r, retryDelay))

  // Final attempt with original key (may have reset by now)
  try {
    return await callFactory(config.key, config.model)
  } catch (finalErr) {
    showToast({
      type: 'error',
      message: `❌ Hết quota API! Vào Settings → Key Vault thêm key hoặc đợi reset.`,
      duration: 8000,
    })
    throw finalErr
  }
}

function isRateLimitError(err) {
  const msg = err.message?.toLowerCase() || ''
  return msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('too many requests')
}


async function callClaude(prompt, key, model, maxTokens = 1024) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Claude error ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text.trim()
}

async function callGemini(prompt, key, model, maxTokens = 1024) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini error ${res.status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

async function callGPT(prompt, key, model, maxTokens = 1024) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `GPT error ${res.status}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function callGPTWithImage(prompt, imageBase64, mimeType, key, model, maxTokens = 1024) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `GPT vision error ${res.status}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function callAI(prompt, maxTokens = 1024, feature = 'default') {
  // 1. Check cache first
  const cached = getCachedResponse(prompt, feature)
  if (cached) {
    console.log(`[AI] Cache HIT for ${feature} — saved 1 API call!`)
    return cached
  }

  // 2. Rate limit check
  await waitForRateLimit()

  // 3. Actual API call
  const { provider } = await getAIConfig()
  const callFactory = (key, model) => {
    if (provider === 'gemini') return callGemini(prompt, key, model, maxTokens)
    if (provider === 'gpt') return callGPT(prompt, key, model, maxTokens)
    return callClaude(prompt, key, model, maxTokens)
  }
  const result = await withRetry(callFactory, provider)
  trackCall(provider, '', maxTokens, true)
  trackKeyUsage(provider)
  recordApiCall()

  // 4. Store in cache
  setCachedResponse(prompt, result, feature, maxTokens)

  return result
}

// ─── Image-aware call wrappers ────────────────────────────────────

async function callClaudeWithImage(prompt, imageBase64, mimeType, key, model, maxTokens = 1024) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Claude vision error ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text.trim()
}

async function callGeminiWithImage(prompt, imageBase64, mimeType, key, model, maxTokens = 1024) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini vision error ${res.status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

export async function callAIWithImage(prompt, imageBase64, mimeType = 'image/jpeg', maxTokens = 1024) {
  // Rate limit check (no cache for images — too large)
  await waitForRateLimit()

  const { provider } = await getAIConfig()
  const callFactory = (key, model) => {
    if (provider === 'gemini') return callGeminiWithImage(prompt, imageBase64, mimeType, key, model, maxTokens)
    if (provider === 'gpt') return callGPTWithImage(prompt, imageBase64, mimeType, key, model, maxTokens)
    return callClaudeWithImage(prompt, imageBase64, mimeType, key, model, maxTokens)
  }
  const result = await withRetry(callFactory, provider)
  trackCall(provider, '', maxTokens + 500, true)
  trackKeyUsage(provider)
  recordApiCall()
  return result
}

// ─── Test API key ─────────────────────────────────────────────────

export async function fetchGeminiModels(key) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `API error ${res.status}`)
    }
    const data = await res.json()
    // Filter to only generateContent-capable models
    return (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''))
      .filter(name => name.startsWith('gemini'))
  } catch (err) {
    console.warn('[AI] fetchGeminiModels failed:', err.message)
    return []
  }
}

export async function testApiKey(providerOverride, keyOverride, modelOverride) {
  const prov = providerOverride || 'claude'
  const key = keyOverride
  let model = modelOverride || AI_PROVIDERS[prov]?.defaultModel
  if (!key) return { ok: false, message: 'Chưa nhập API key' }

  try {
    if (prov === 'gemini') {
      // First try the selected model
      try {
        await callGemini('Trả lời đúng 1 từ: "ok"', key, model, 8)
        return { ok: true, message: `✅ Key hoạt động! Model: ${model}`, model }
      } catch (err) {
        // If model not found, try to fetch available models and retry
        if (err.message.includes('not found') || err.message.includes('not supported')) {
          const available = await fetchGeminiModels(key)
          if (available.length === 0) {
            return { ok: false, message: `❌ Key lỗi hoặc không có model nào available. Error: ${err.message}` }
          }
          // Key works (we got models list), try first available model
          const fallback = available.find(m => m.includes('flash')) || available[0]
          try {
            await callGemini('Trả lời đúng 1 từ: "ok"', key, fallback, 8)
            return {
              ok: true,
              message: `✅ Key OK! Model "${model}" đã bị deprecated.\n→ Đã tự chuyển sang: ${fallback}`,
              model: fallback,
              availableModels: available,
            }
          } catch {
            return {
              ok: true,
              message: `⚠️ Key hợp lệ nhưng model "${model}" đã deprecated.\nModels available: ${available.slice(0, 5).join(', ')}`,
              model: fallback,
              availableModels: available,
            }
          }
        }
        throw err
      }
    } else if (prov === 'gpt') {
      await callGPT('Trả lời đúng 1 từ: "ok"', key, model, 8)
      return { ok: true, message: `✅ Key hoạt động! Model: ${model}`, model }
    } else {
      await callClaude('Trả lời đúng 1 từ: "ok"', key, model, 8)
      return { ok: true, message: `✅ Key hoạt động! Model: ${model}`, model }
    }
  } catch (err) {
    return { ok: false, message: `❌ Lỗi: ${err.message}` }
  }
}

function parseJSON(raw) {
  // Clean markdown code fences if present
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    // Try to extract JSON object or array
    const arr = cleaned.match(/\[[\s\S]*\]/)
    if (arr) try { return JSON.parse(arr[0]) } catch { }
    const obj = cleaned.match(/\{[\s\S]*\}/)
    if (obj) try { return JSON.parse(obj[0]) } catch { }

    // Try to repair truncated JSON (response cut off by maxTokens)
    const repaired = repairTruncatedJSON(cleaned)
    if (repaired) return repaired

    throw new Error('Không parse được response từ AI')
  }
}

function repairTruncatedJSON(raw) {
  // Find the start of JSON
  let start = raw.indexOf('{')
  const arrStart = raw.indexOf('[')
  if (arrStart >= 0 && (start < 0 || arrStart < start)) start = arrStart
  if (start < 0) return null

  let json = raw.slice(start)

  // Remove trailing incomplete string (ends mid-value)
  // e.g. ..."title": "some text that got cu
  json = json.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '')
  json = json.replace(/,\s*"[^"]*$/, '')
  json = json.replace(/,\s*$/, '')

  // Count open brackets and close them
  let openBraces = 0, openBrackets = 0, inString = false, escape = false
  for (const ch of json) {
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') openBraces++
    if (ch === '}') openBraces--
    if (ch === '[') openBrackets++
    if (ch === ']') openBrackets--
  }

  // If still in string, close it
  if (inString) json += '"'

  // Close open brackets/braces
  while (openBrackets > 0) { json += ']'; openBrackets-- }
  while (openBraces > 0) { json += '}'; openBraces-- }

  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

// ─── Feature 1: Parse text → task list ───────────────────────────

export async function parseTasksFromText(text) {
  const prompt = `Phân tích đoạn text sau và extract ra danh sách tasks. Trả về JSON array, không có markdown.

Text: "${text}"

Trả về format:
[
  {
    "title": "tên task ngắn gọn",
    "category": "work|personal|finance|adhoc",
    "priority": "p0|p1|p2|p3",
    "deadline": "YYYY-MM-DD hoặc null",
    "notes": "ghi chú nếu có",
    "estimatedMinutes": 30
  }
]

Quy tắc:
- "30 phút", "1 tiếng", "2h", "nửa tiếng" → estimatedMinutes (convert sang số phút, hoặc null nếu không rõ)
- "gấp", "urgent", "khẩn" → priority p0
- "quan trọng", "cần" → priority p1
- "chuyển khoản", "thanh toán", "tiền" → category finance
- "họp", "email", "project", "client", "deadline" → category work
- Ngày như "thứ 4", "cuối tuần", "ngày 15" → convert sang date tương đối từ hôm nay ${new Date().toISOString().slice(0, 10)}
- Nếu không rõ priority → p2
- Nếu không rõ category → adhoc
- Chỉ trả về JSON array thuần, không giải thích gì thêm`

  const raw = await callAI(prompt, 1024, 'parseTasksFromText')
  return parseJSON(raw)
}

// ─── Feature 2: Summarize URL ─────────────────────────────────────

export async function summarizeUrl(url) {
  const prompt = `Tóm tắt nội dung từ URL này trong đúng 3 câu ngắn gọn bằng tiếng Việt.
URL: ${url}

Format trả về (JSON):
{
  "title": "tiêu đề trang",
  "summary": "3 câu tóm tắt. Câu 1 nói về gì. Câu 2 hữu ích khi nào. Câu 3 kết luận.",
  "tags": ["tag1", "tag2", "tag3"],
  "readingMinutes": 5
}

Chỉ trả về JSON, không giải thích.`

  const raw = await callAI(prompt, 512, 'summarizeUrl')
  return parseJSON(raw)
}

// ─── Feature 3: Expand task notes (có thể dùng sau) ──────────────

export async function expandTaskNotes(title) {
  const prompt = `Viết ghi chú ngắn (2-3 dòng) cho task này bằng tiếng Việt, bao gồm: mục tiêu, bước đầu tiên cần làm, và lưu ý.
Task: "${title}"
Chỉ trả về text thuần, không markdown, không giải thích thêm.`

  return callAI(prompt, 256, 'expandTaskNotes')
}

// ─── Feature 5: Chat with context ────────────────────────────────

export async function chatWithAI(userMessage, taskContext) {
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `Mày là TaskFlow AI — "đại ca" quản lý công việc. Tính cách:
- Chửi thẳng mặt, không nể nang, toxic motivational
- Xưng "tao", gọi user là "mày"
- Nói thẳng sự thật brutal dựa trên DATA thực tế bên dưới, KHÔNG nịnh
- Nếu mày thấy user lười (task quá hạn nhiều, chưa chọn focus) → CHỬI THẲNG
- Nếu user đang làm tốt → khen nhẹ rồi push thêm, kiểu "ừ được rồi nhưng đừng tưởng thế là xong"
- Dùng emoji 🔥💀😤🤡⚡ cho mạnh
- Trả lời tiếng Việt, tối đa 4-5 câu, ngắn gọn đanh thép
- KHÔNG BAO GIỜ dịu dàng hay "bạn ơi hãy cố gắng nhé" — phải là "mày làm cái gì cả ngày vậy hả?"
- Nếu user hỏi gợi ý → gợi ý nhưng kèm chửi kiểu "tao phải chỉ tận tay à, mày không tự nghĩ được hả?"

Dữ liệu THỰC TẾ của user hôm nay (${today}):
${taskContext}

User nói: ${userMessage}

Chửi thẳng mặt nó đi. Trả lời tối đa 4-5 câu, ngắn gọn đanh thép.`

  return callAI(prompt, 1024, 'chatWithAI')
}

// ─── Feature: AI Task Ranking ────────────────────────────────────

export async function rankTasksWithAI(tasks) {
  const today = new Date().toISOString().slice(0, 10)
  const taskList = tasks.slice(0, 15).map((t, i) => {
    const parts = [`${i + 1}. [${(t.priority || 'p2').toUpperCase()}] ${t.title}`]
    if (t.notes) parts.push(`   Note: ${t.notes.slice(0, 100)}`)
    if (t.deadline) parts.push(`   Deadline: ${t.deadline}`)
    if (t.category) parts.push(`   Category: ${t.category}`)
    if (t.impactScope) parts.push(`   Impact: ${t.impactScope}`)
    return parts.join('\n')
  }).join('\n\n')

  const prompt = `Mày là AI quản lý công việc. Hôm nay là ${today}.

Dưới đây là tasks của user với đầy đủ nội dung và ghi chú. Đọc KỸ từng task — kể cả phần notes — để hiểu thực sự cái gì quan trọng nhất.

${taskList}

Xếp hạng theo thứ tự nên làm trước. Với mỗi task giải thích NGẮN (1 câu) tại sao nên làm trước/sau dựa trên nội dung thực tế.

Trả về JSON array (không markdown):
[
  { "rank": 1, "taskIndex": 1, "reason": "lý do 1 câu" },
  { "rank": 2, "taskIndex": 3, "reason": "lý do 1 câu" }
]

Chỉ trả về JSON.`

  const raw = await callAI(prompt, 1024, 'rankTasksWithAI')
  return parseJSON(raw)
}

// ─── Feature: AI Daily Priority Synthesis ────────────────────────

export async function synthesizeDailyPriorities(tasks) {
  const today = new Date().toISOString().slice(0, 10)
  const pending = tasks.filter(t => t.status !== 'done').slice(0, 20)

  if (pending.length === 0) return null

  const taskLines = pending.map((t, i) => {
    const parts = [`${i + 1}. [${(t.priority || 'p2').toUpperCase()}]${t.deadline ? ` deadline:${t.deadline}` : ''} ${t.title}`]
    if (t.notes?.trim()) parts.push(`   → ${t.notes.slice(0, 120)}`)
    return parts.join('\n')
  }).join('\n')

  const prompt = `Mày là đại ca quản lý công việc. Hôm nay ${today}.

Đây là toàn bộ tasks ĐANG PENDING của user, bao gồm cả notes:

${taskLines}

Đọc KỸ nội dung và notes. Dựa vào đó:
1. Chọn TOP 3 task NÊN LÀM NGAY HÔM NAY (với lý do dựa trên content thực tế)
2. Nhận xét brutal 1 câu về tình trạng công việc (không nịnh)

Trả về JSON:
{
  "top3": [
    { "title": "...", "reason": "lý do ngắn dựa trên nội dung/deadline thực tế" }
  ],
  "assessment": "nhận xét 1 câu brutal honest"
}

Chỉ trả về JSON.`

  const raw = await callAI(prompt, 512, 'synthesizeDailyPriorities')
  return parseJSON(raw)
}

// ─── Feature: Weekly Review AI Summary ───────────────────────────

export async function generateWeeklySummary(weekData) {
  const prompt = `Bạn là TaskFlow AI Assistant. Hãy viết tóm tắt tuần làm việc bằng tiếng Việt, thân thiện và động viên.

Dữ liệu tuần (${weekData.weekStart} → ${weekData.weekEnd}):
- Tasks hoàn thành: ${weekData.done} / ${weekData.total}
- Tasks quá hạn không làm: ${weekData.overdue}
- Focus sessions: ${weekData.focusDays}/7 ngày có focus
- Categories: ${weekData.categoryBreakdown}
- Goals tiến độ: ${weekData.goalsProgress}

Hãy viết:
1. **Điểm nổi bật** (1-2 câu)
2. **Cần cải thiện** (1-2 câu)
3. **Gợi ý tuần tới** (2-3 gạch đầu dòng)

Ngắn gọn, không quá 150 từ. Dùng tiếng Việt tự nhiên.`

  return callAI(prompt, 512, 'generateWeeklySummary')
}

// ─── Feature 6: Suggest deadline (có thể dùng sau) ───────────────

export async function suggestDeadline(title) {
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `Dựa vào tên task sau, gợi ý 1 deadline hợp lý. Hôm nay là ${today}.
Task: "${title}"
Trả về JSON: {"deadline": "YYYY-MM-DD", "reason": "lý do ngắn"}
Chỉ trả về JSON.`

  const raw = await callAI(prompt, 128, 'suggestDeadline')
  return parseJSON(raw)
}

// ─── Feature 7: AI Goal Breakdown ────────────────────────────────

export async function breakdownGoal(goalTitle, goalCategory, goalDeadline) {
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `Phân tích goal sau và chia nhỏ thành danh sách tasks cụ thể, actionable. Trả về JSON array, không markdown.

Goal: "${goalTitle}"
Category: ${goalCategory || 'chung'}
Deadline: ${goalDeadline || 'không có'}
Hôm nay: ${today}

Trả về format:
[
  {
    "title": "tên task ngắn gọn, actionable",
    "category": "work|personal|finance|adhoc",
    "priority": "p0|p1|p2|p3",
    "deadline": "YYYY-MM-DD hoặc null",
    "estimatedMinutes": 30,
    "milestone": "tên milestone (nhóm tasks lại)"
  }
]

Quy tắc:
- Chia goal thành 3-7 tasks cụ thể
- Mỗi task phải là hành động rõ ràng (bắt đầu bằng động từ)
- Sắp xếp theo thứ tự ưu tiên/thời gian hợp lý
- Đặt deadline hợp lý nếu goal có deadline (chia đều)
- Nhóm tasks thành 2-3 milestones logic
- estimatedMinutes phải thực tế (15, 30, 60, 120, ...)
- Chỉ trả về JSON array thuần, không giải thích gì thêm`

  const raw = await callAI(prompt, 1024, 'breakdownGoal')
  return parseJSON(raw)
}

// ─── Feature 8: Smart Idea Enrichment ────────────────────────────

export async function enrichIdea(ideaContent) {
  const prompt = `Phân tích ý tưởng sau và mở rộng thành kế hoạch chi tiết. Trả về JSON, không markdown.

Ý tưởng: "${ideaContent}"

Trả về format:
{
  "expandedNotes": "2-4 dòng mô tả chi tiết hơn về ý tưởng, bao gồm mục tiêu, cách tiếp cận gợi ý, và lưu ý quan trọng",
  "suggestedCategory": "idea|note|goal|random|project",
  "effortLevel": "low|medium|high",
  "effortDescription": "mô tả ngắn về effort, ví dụ: '2-3 ngày', '1 tuần', '1 tháng'",
  "suggestedGoalCategory": "career|finance|health|travel|learning|null",
  "actionItems": ["bước 1 cụ thể", "bước 2 cụ thể", "bước 3 cụ thể"],
  "potentialImpact": "mô tả ngắn impact nếu thực hiện"
}

Quy tắc:
- expandedNotes phải cụ thể, không chung chung
- actionItems: 2-4 bước cụ thể, bắt đầu bằng động từ
- effortLevel dựa trên độ phức tạp thực tế
- suggestedGoalCategory: nếu idea phù hợp thành goal thì suggest category, nếu không thì null
- Chỉ trả về JSON thuần, không giải thích thêm
- Trả lời bằng tiếng Việt`

  const raw = await callAI(prompt, 512, 'enrichIdea')
  return parseJSON(raw)
}

// ─── Feature 9: Smart Daily Plan ─────────────────────────────────

export async function suggestDailyPlan(tasksSummary) {
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `Mày là TaskFlow AI — "đại ca" quản lý công việc. Phân tích danh sách tasks bên dưới và chọn TOP 3 TASKS nên focus hôm nay.

Hôm nay: ${today}

Danh sách tasks pending:
${tasksSummary}

Trả về JSON:
{
  "suggestedIds": [id1, id2, id3],
  "reasoning": "2-3 câu giải thích TẠI SAO chọn 3 task này. Xưng tao, gọi mày. Ngắn gọn đanh thép."
}

Quy tắc chọn:
1. Ưu tiên task có deadline hôm nay/ngày mai
2. Task quá hạn phải xử lý đầu tiên
3. P0/P1 ưu tiên hơn P2/P3
4. Impact scope cao (client/critical) ưu tiên hơn (self)
5. Cân bằng tổng estimatedMinutes cho 1 ngày làm việc (4-6 tiếng effective)
6. Chỉ trả về JSON thuần, không giải thích thêm outside JSON`

  const raw = await callAI(prompt, 512, 'suggestDailyPlan')
  return parseJSON(raw)
}

// ─── Feature 10: Image → Tasks analysis ──────────────────────────

export async function analyzeImageForTasks(imageBase64, mimeType = 'image/jpeg') {
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `Phân tích hình ảnh này (có thể là: ảnh chụp whiteboard, meeting notes, screenshot danh sách việc, sticky notes, tài liệu, ảnh chụp màn hình, mindmap, hoặc bất kỳ nội dung nào).

Nhiệm vụ: Extract TẤT CẢ tasks, to-do items, action items, hoặc công việc cần làm từ hình ảnh. Trả về JSON array.

Hôm nay: ${today}

Format trả về:
{
  "description": "mô tả ngắn 1-2 câu về nội dung hình ảnh",
  "tasks": [
    {
      "title": "tên task ngắn gọn, actionable",
      "category": "work|personal|finance|adhoc",
      "priority": "p0|p1|p2|p3",
      "deadline": "YYYY-MM-DD hoặc null",
      "estimatedMinutes": 30,
      "notes": "ghi chú bổ sung nếu có từ context trong ảnh"
    }
  ],
  "ideas": [
    {
      "content": "ý tưởng hoặc ghi chú không phải task",
      "category": "idea|note|goal|random|project"
    }
  ]
}

Quy tắc:
- Đọc KỸ mọi text, ghi chú, bullet points trong ảnh
- Mỗi item riêng biệt = 1 task riêng
- Nếu có dates/deadlines trong ảnh → convert sang YYYY-MM-DD (tương đối từ ${today})
- Nếu có dấu hiệu urgency (gạch đỏ, dấu !, viền đỏ) → p0 hoặc p1
- Items không phải task (ý tưởng, brainstorm, random notes) → đưa vào "ideas"
- estimatedMinutes phải thực tế
- Nếu ảnh trống hoặc không có nội dung liên quan → trả về {"description": "...", "tasks": [], "ideas": []}
- Chỉ trả về JSON thuần, không giải thích thêm
- Trả lời bằng tiếng Việt cho title/notes/content`

  const raw = await callAIWithImage(prompt, imageBase64, mimeType, 4096)
  return parseJSON(raw)
}

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
  const keyMap = { claude: 'claudeApiKey', gemini: 'geminiApiKey' }
  const key = await getSetting(keyMap[provider] || 'claudeApiKey')
  if (!key) throw new Error('NO_API_KEY')
  return { provider, model, key }
}

// ─── Call wrappers ────────────────────────────────────────────────

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

export async function callAI(prompt, maxTokens = 1024) {
  const { provider, model, key } = await getAIConfig()
  if (provider === 'gemini') return callGemini(prompt, key, model, maxTokens)
  return callClaude(prompt, key, model, maxTokens)
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
    } else {
      await callClaude('Trả lời đúng 1 từ: "ok"', key, model, 8)
      return { ok: true, message: `✅ Key hoạt động! Model: ${model}`, model }
    }
  } catch (err) {
    return { ok: false, message: `❌ Lỗi: ${err.message}` }
  }
}

function parseJSON(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    const arr = raw.match(/\[[\s\S]*\]/)
    if (arr) return JSON.parse(arr[0])
    const obj = raw.match(/\{[\s\S]*\}/)
    if (obj) return JSON.parse(obj[0])
    throw new Error('Không parse được response từ AI')
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

  const raw = await callAI(prompt, 1024)
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

  const raw = await callAI(prompt, 512)
  return parseJSON(raw)
}

// ─── Feature 3: Expand task notes (có thể dùng sau) ──────────────

export async function expandTaskNotes(title) {
  const prompt = `Viết ghi chú ngắn (2-3 dòng) cho task này bằng tiếng Việt, bao gồm: mục tiêu, bước đầu tiên cần làm, và lưu ý.
Task: "${title}"
Chỉ trả về text thuần, không markdown, không giải thích thêm.`

  return callAI(prompt, 256)
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

  return callAI(prompt, 512)
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

  const raw = await callAI(prompt, 1024)
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

  const raw = await callAI(prompt, 512)
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

  return callAI(prompt, 512)
}

// ─── Feature 6: Suggest deadline (có thể dùng sau) ───────────────

export async function suggestDeadline(title) {
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `Dựa vào tên task sau, gợi ý 1 deadline hợp lý. Hôm nay là ${today}.
Task: "${title}"
Trả về JSON: {"deadline": "YYYY-MM-DD", "reason": "lý do ngắn"}
Chỉ trả về JSON.`

  const raw = await callAI(prompt, 128)
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

  const raw = await callAI(prompt, 1024)
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

  const raw = await callAI(prompt, 512)
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

  const raw = await callAI(prompt, 512)
  return parseJSON(raw)
}

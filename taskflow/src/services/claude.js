import { getSetting } from './db'

async function getApiKey() {
  const key = await getSetting('claudeApiKey')
  if (!key) throw new Error('NO_API_KEY')
  return key
}

export async function parseTasksFromText(text) {
  const apiKey = await getApiKey()

  const prompt = `Phân tích đoạn text sau và extract ra danh sách tasks. Trả về JSON array, không có markdown.

Text: "${text}"

Trả về format:
[
  {
    "title": "tên task ngắn gọn",
    "category": "work|personal|finance|adhoc",
    "priority": "p0|p1|p2|p3",
    "deadline": "YYYY-MM-DD hoặc null",
    "notes": "ghi chú nếu có"
  }
]

Quy tắc:
- "gấp", "urgent", "khẩn" → priority p0
- "quan trọng", "cần" → priority p1
- "chuyển khoản", "thanh toán", "tiền" → category finance
- "họp", "email", "project", "client", "deadline" → category work
- Ngày như "thứ 4", "cuối tuần", "ngày 15" → convert sang date tương đối từ hôm nay ${new Date().toISOString().slice(0, 10)}
- Nếu không rõ priority → p2
- Nếu không rõ category → adhoc
- Chỉ trả về JSON array thuần, không giải thích gì thêm`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Claude API error')
  }

  const data = await res.json()
  const raw = data.content[0].text.trim()

  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
    throw new Error('Không parse được response từ AI')
  }
}

export async function summarizeUrl(url) {
  const apiKey = await getApiKey()

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) throw new Error('Claude API error')

  const data = await res.json()
  const raw = data.content[0].text.trim()

  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Không parse được response từ AI')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 },
          },
          {
            type: 'text',
            text: `Analyse this nutrition tracking screenshot (MyFitnessPal, Cronometer, etc).

Return ONLY a JSON object with no markdown fences:
{
  "calories": <daily total or null>,
  "protein": <grams or null>,
  "carbs": <grams or null>,
  "fat": <grams or null>,
  "water": <litres or null>,
  "food_items": "<compact food list, e.g.: Oats 60g (P:7 C:40 F:4), Chicken breast 180g (P:42 C:0 F:4), Banana (P:1 C:27 F:0), Whey shake (P:25 C:5 F:2)>",
  "meal_summary": "<1 sentence: key protein sources and whether it looks on/off track>",
  "confidence": "high" | "medium" | "low"
}

Rules:
- food_items: list individual foods with portion and per-item macros in compact format. Max ~10 items. Skip condiments/trivial items. If no individual foods visible, use null.
- For water: convert ml to litres (2500ml = 2.5)
- Use daily totals for top-level macros, not individual meals
- If not a nutrition screenshot, return all nulls with confidence "low"`,
          },
        ],
      }],
    })

    const text = response.content.map(b => b.type === 'text' ? b.text : '').join('').trim()
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json({ ...parsed, success: true })
  } catch (e: any) {
    console.error('Scan error:', e)
    return NextResponse.json({ error: e.message || 'Failed to scan image' }, { status: 500 })
  }
}

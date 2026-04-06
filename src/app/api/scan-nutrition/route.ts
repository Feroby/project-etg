import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json()

    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType || 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `You are a nutrition data extractor. Analyse this food/nutrition tracking screenshot (e.g. MyFitnessPal, Cronometer, or any food diary).

Extract the DAILY TOTALS only (not individual meals). Return ONLY a JSON object with no markdown, no explanation:
{
  "calories": <number or null>,
  "protein": <number in grams or null>,
  "carbs": <number in grams or null>,
  "fat": <number in grams or null>,
  "water": <number in litres or null>,
  "meal_summary": "<brief 1-2 sentence summary of what was eaten, key foods mentioned>",
  "confidence": "high" | "medium" | "low"
}

Rules:
- Only extract values that are clearly visible — use null for anything uncertain
- For water: convert ml to litres (e.g. 2500ml = 2.5)
- Ignore individual food items, only use totals/summary rows
- If this is not a nutrition tracking screenshot, return all nulls with confidence "low"`,
          },
        ],
      }],
    })

    const text = response.content.map(b => b.type === 'text' ? b.text : '').join('').trim()

    // Strip any accidental markdown fences
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json({ ...parsed, success: true })
  } catch (e: any) {
    console.error('Scan error:', e)
    return NextResponse.json({ error: e.message || 'Failed to scan image' }, { status: 500 })
  }
}

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { message, tripId, history } = await req.json()

    // Load trip context
    let tripContext = ''
    if (tripId) {
      const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
      const { data: expenses } = await supabase.from('expenses').select('*').eq('trip_id', tripId).order('expense_date')
      const { data: documents } = await supabase.from('documents').select('id, name, doc_type, traveler_id, booking_ref, flight_number, valid_until, extracted_data').eq('trip_id', tripId)

      if (trip) {
        const totalIls = (expenses || []).reduce((s, e) => s + Number(e.amount_ils || 0), 0)
        const byCategory: Record<string, number> = {}
        for (const e of expenses || []) {
          byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount_ils || 0)
        }

        tripContext = `
פרטי הטיול הנוכחי:
- שם: ${trip.name}
- יעד: ${trip.destination}
- תאריכים: ${trip.start_date} עד ${trip.end_date}
- נוסעים: ${(trip.travelers || []).map((t: any) => t.name).join(', ')}
- סה"כ הוצאות: ₪${totalIls.toFixed(0)}
- חלוקה לפי קטגוריה: ${Object.entries(byCategory).map(([k, v]) => `${k}: ₪${v.toFixed(0)}`).join(', ')}
- מספר הוצאות: ${(expenses || []).length}
- מסמכים שהועלו: ${(documents || []).map(d => `${d.name} (${d.doc_type})`).join(', ') || 'אין'}

5 ההוצאות האחרונות:
${(expenses || []).slice(-5).map(e => `- ${e.title}: ${e.amount} ${e.currency} (₪${Number(e.amount_ils).toFixed(0)}) - ${e.expense_date}`).join('\n')}
`
      }
    }

    const systemPrompt = `אתה עוזר טיול חכם בשם Tripix AI. אתה חלק ממערכת ניהול טיולים.
אתה עונה בעברית, בצורה ידידותית, קצרה ומועילה.
אתה מכיר את פרטי הטיול של המשתמש ויכול לענות על שאלות לגבי:
- ההוצאות והתקציב
- המלצות למסעדות, פעילויות ואטרקציות ביעד
- טיפים מקומיים (מטבע, תרבות, בטיחות, מזג אוויר)
- עזרה עם תכנון ימים
- מידע על מסמכים (טיסות, מלונות, דרכונים)

חוקים:
- ענה תמיד בעברית
- היה קצר וממוקד (2-4 משפטים)
- השתמש באימוג'י במידה
- אם אתה לא בטוח, אמור שאתה לא יודע
- אל תמציא מידע על ההוצאות — השתמש רק בנתונים שקיבלת

${tripContext}`

    const messages = [
      ...(history || []).map((h: any) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({ reply: text })
  } catch (err: any) {
    console.error('Assistant error:', err)
    return NextResponse.json({ error: err.message || 'שגיאה' }, { status: 500 })
  }
}

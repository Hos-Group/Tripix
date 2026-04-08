/**
 * emailSender.ts
 * Sends transactional emails via Resend.
 * Used for: email alias verification, notifications, etc.
 *
 * Architecture note:
 * ─────────────────
 * We use Resend for BOTH inbound (webhook) and outbound (transactional).
 * One account, one API key, one dashboard — simpler ops.
 *
 * To reuse across projects: extract this file + the API key pattern
 * into a shared package / environment variable per project.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS   = process.env.EMAIL_FROM || 'Tripix <noreply@tripix.app>'
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL || 'https://tripix-ruby.vercel.app'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[emailSender] RESEND_API_KEY not set — email not sent')
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    })
    return res.ok
  } catch (err) {
    console.error('[emailSender] Send failed:', err)
    return false
  }
}

/**
 * Send email alias verification link.
 */
export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const verifyUrl = `${APP_URL}/api/email-aliases/verify?token=${token}`

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head><meta charset="UTF-8" /></head>
    <body style="font-family: sans-serif; background: #f9fafb; padding: 40px 20px; direction: rtl;">
      <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 40px;">✈️</span>
          <h1 style="margin: 8px 0 4px; color: #111827; font-size: 20px;">אישור כתובת מייל</h1>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">Tripix — מערכת ניהול טיול חכמה</p>
        </div>

        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          קיבלנו בקשה לחבר את הכתובת <strong>${to}</strong> לחשבון Tripix שלך.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${verifyUrl}"
             style="background: #2563eb; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">
            אשר כתובת מייל
          </a>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          הקישור תקף ל-24 שעות.<br/>
          אם לא ביקשת זאת — אפשר להתעלם ממייל זה.
        </p>
      </div>
    </body>
    </html>
  `

  return sendEmail({ to, subject: '✅ אשר את כתובת המייל שלך — Tripix', html })
}

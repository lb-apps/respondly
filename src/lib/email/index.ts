import * as React from "react"
import { Resend } from "resend"

let resendClient: Resend | null = null

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

const FROM_EMAIL = process.env.EMAIL_FROM ?? "Respondly <info@littlebigapps.io>"

export interface SendEmailResult {
  success: boolean
  error?: string
}

/**
 * Send a transactional email using a React Email component.
 * Resend renders the component server-side to HTML automatically.
 */
export async function sendEmail(options: {
  to: string
  subject: string
  react: React.ReactElement
}): Promise<SendEmailResult> {
  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      react: options.react,
    })

    if (error) {
      console.error("[email] Send failed:", JSON.stringify(error, null, 2))
      return { success: false, error: error.message }
    }

    console.log(`[email] Sent to ${options.to} from ${FROM_EMAIL}`)
    return { success: true }
  } catch (err) {
    console.error("[email] Unexpected error:", err)
    return { success: false, error: "E-posta gönderilemedi" }
  }
}

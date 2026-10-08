import "server-only";
import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

let client: Resend | null = null;

/**
 * Sends a transactional e-mail via Resend. Without RESEND_API_KEY (local dev)
 * the message is logged instead, so the booking flow still works.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[email:dev] To: ${message.to} | ${message.subject}\n${message.text}\n`);
    return true;
  }

  client ??= new Resend(apiKey);
  const { error } = await client.emails.send({
    from: process.env.EMAIL_FROM ?? "Rezervo <onboarding@resend.dev>",
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: message.replyTo,
  });

  if (error) {
    console.error(`[email] Failed to send "${message.subject}" to ${message.to}:`, error);
    return false;
  }
  return true;
}

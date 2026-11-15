import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

/** Email is used only when a host and a sender are configured. */
export function mailConfigured(): boolean {
  const e = env();
  return Boolean(e.SMTP_HOST && e.SMTP_FROM);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const e = env();
  transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    // Port 465 is implicit TLS; other ports upgrade with STARTTLS when the server offers it
    secure: e.SMTP_SECURE || e.SMTP_PORT === 465,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD ?? "" } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return transporter;
}

export async function sendMail(message: { to: string; subject: string; text: string; html: string }) {
  if (!mailConfigured()) throw new Error("Email isn't set up on this server.");
  await getTransporter().sendMail({ from: env().SMTP_FROM, ...message });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** The invitation email. The link is the only secret in it, so it's never logged. */
export function inviteEmail(input: { to: string; link: string; roleName: string; inviterName: string; expiresAt: Date }) {
  const when = input.expiresAt.toUTCString();
  const who = input.inviterName || "A team admin";
  const text = [
    `${who} invited you to Seo Engine as ${input.roleName}.`,
    "",
    "Set up your account with this link:",
    input.link,
    "",
    `The link works once and expires ${when}. It was sent to ${input.to}, and only that address can use it.`,
    "",
    "If you weren't expecting this, you can ignore this email.",
  ].join("\n");
  const html = `
    <p>${escapeHtml(who)} invited you to Seo Engine as <strong>${escapeHtml(input.roleName)}</strong>.</p>
    <p><a href="${escapeHtml(input.link)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#188182;color:#fff;text-decoration:none">Set up your account</a></p>
    <p style="color:#666;font-size:13px">The link works once and expires ${escapeHtml(when)}. It was sent to ${escapeHtml(input.to)}, and only that address can use it.</p>
    <p style="color:#666;font-size:13px">If you weren't expecting this, you can ignore this email.</p>`;
  return { subject: `You're invited to Seo Engine`, text, html };
}

/**
 * Transactional email via Resend's REST API.
 *
 * Deliberately no SDK dependency — this is one POST. Configure with:
 *   RESEND_API_KEY  the API key from resend.com
 *   MAIL_FROM       OPTIONAL. e.g. "SalesCallOS <noreply@chillyonaryo.com>" (domain must
 *                   be verified in Resend). Defaults to Resend's shared sender.
 *   APP_URL         public base URL, default https://salesos.chillyonaryo.com
 *
 * With no RESEND_API_KEY the app still runs and password reset still *works* —
 * it just cannot deliver the link. See sendPasswordReset's return value.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Only the API key is required. MAIL_FROM is optional and defaults to Resend's
 * shared sender, which needs no DNS setup.
 *
 * This used to require BOTH, which meant setting just the key silently did
 * nothing — the feature reported itself unavailable with no hint why. That is a
 * bad failure mode for a variable people forget.
 */
export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Sender address. Override with MAIL_FROM once your own domain is verified in
 * Resend — the default works immediately but, being Resend's shared test
 * sender, only delivers to the Resend account owner's own address.
 */
export function mailFrom(): string {
  return process.env.MAIL_FROM || "SalesCallOS <onboarding@resend.dev>";
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "https://salesos.chillyonaryo.com").replace(/\/+$/, "");
}

async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: mailFrom(), to: [to], subject, html, text }),
  });
  if (!res.ok) {
    // Surface Resend's own message — usually "domain not verified" or a bad key.
    throw new Error(`Resend rejected the send (${res.status}): ${await res.text()}`);
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * Sends the password-reset link. Returns false when email isn't configured, so
 * the caller can log a warning — it must NOT change what the API tells the
 * browser, or the response would reveal whether an account exists.
 */
export async function sendPasswordReset(
  to: string,
  name: string,
  token: string,
): Promise<boolean> {
  if (!mailConfigured()) return false;
  const link = `${appUrl()}/?reset=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name);
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#111;line-height:1.5">
      <p>Hi ${safeName},</p>
      <p>Someone asked to reset the password for your SalesCallOS account. Click below to choose a new one:</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Choose a new password</a>
      </p>
      <p style="color:#555">This link works once and expires in 1 hour.</p>
      <p style="color:#555">If you didn't ask for this, you can ignore this email — your password stays as it is.</p>
    </div>`;
  const text =
    `Hi ${name},\n\n` +
    `Someone asked to reset the password for your SalesCallOS account.\n` +
    `Open this link to choose a new one:\n\n${link}\n\n` +
    `The link works once and expires in 1 hour.\n` +
    `If you didn't ask for this, ignore this email — your password stays as it is.\n`;
  await send(to, "Reset your SalesCallOS password", html, text);
  return true;
}

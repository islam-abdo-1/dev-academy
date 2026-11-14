export interface MessageEmailInput {
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
  recipientName?: string | null;
  createdAt?: string | null;
  siteUrl: string;
  isBroadcast?: boolean;
}

export interface RenderedMessageEmail {
  html: string;
  text: string;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function bodyToHtml(value: string): string {
  return escapeHtml(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "<br />");
}

function bodyToText(value: string): string {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function formatDate(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Cairo",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function renderMessageEmail(input: MessageEmailInput): RenderedMessageEmail {
  const siteUrl = trimTrailingSlash(input.siteUrl);
  const dashboardUrl = `${siteUrl}/dashboard`;
  const logoUrl = `${siteUrl}/logo-full.jpg`;
  const recipientName = String(input.recipientName || "").trim();
  const greeting = recipientName ? `مرحبًا ${recipientName}،` : "مرحبًا،";
  const dateLabel = formatDate(input.createdAt);
  const eyebrow = input.isBroadcast
    ? "إعلان من فريق Dev Academy"
    : "رسالة جديدة من فريق Dev Academy";
  const preheader = `${input.subject} — ${eyebrow}`;

  const subject = escapeHtml(input.subject);
  const senderName = escapeHtml(input.senderName || "فريق Dev Academy");
  const senderEmail = escapeHtml(input.senderEmail);
  const greetingHtml = escapeHtml(greeting);
  const messageHtml = bodyToHtml(input.body);
  const dateHtml = escapeHtml(dateLabel);

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef4f8;font-family:Tahoma,Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef4f8;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;border-collapse:separate;">
          <tr>
            <td align="center" style="background-color:#000000;padding:26px 28px;">
              <img src="${logoUrl}" width="180" alt="Dev Academy" style="display:block;width:180px;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td style="height:4px;background-color:#00d9ff;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:34px 32px 6px;">
              <p style="margin:0 0 10px;font-size:12px;line-height:1.6;font-weight:bold;letter-spacing:0.4px;color:#0891b2;text-transform:none;">
                ${escapeHtml(eyebrow)}
              </p>
              <h1 style="margin:0 0 20px;font-size:24px;line-height:1.45;font-weight:bold;color:#0f172a;">
                ${subject}
              </h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.9;color:#334155;">
                ${greetingHtml}
              </p>
              <div style="margin:0;font-size:16px;line-height:1.95;color:#1e293b;">
                ${messageHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;font-family:Tahoma,Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 6px;font-size:11px;line-height:1.5;color:#64748b;">
                      أرسل هذه الرسالة
                    </p>
                    <p style="margin:0 0 2px;font-size:15px;line-height:1.6;font-weight:bold;color:#0f172a;">
                      ${senderName}
                    </p>
                    <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#64748b;direction:ltr;text-align:right;">
                      ${senderEmail}
                    </p>
                    ${
                      dateHtml
                        ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">${dateHtml}</p>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 32px 34px;">
              <a href="${dashboardUrl}" style="display:inline-block;background-color:#00c8e8;color:#04121a;text-decoration:none;font-family:Tahoma,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;padding:13px 28px;border-radius:10px;">
                افتح لوحة Dev Academy
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:22px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;line-height:1.7;font-weight:bold;color:#334155;">
                Dev Academy — منصة تعليمية
              </p>
              <p style="margin:0 0 10px;font-size:11px;line-height:1.7;color:#64748b;">
                <a href="${siteUrl}" style="color:#0891b2;text-decoration:none;">${siteUrl.replace(/^https?:\/\//, "")}</a>
              </p>
              <p style="margin:0;font-size:11px;line-height:1.8;color:#94a3b8;">
                وصلتك هذه الرسالة لأنك عضو في Dev Academy. للرد، استخدم زر الرد وسيصل ردك إلى مرسل الرسالة.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    input.subject,
    "",
    greeting,
    "",
    bodyToText(input.body),
    "",
    "—",
    input.senderName || "فريق Dev Academy",
    input.senderEmail,
    dateLabel,
    "",
    `افتح لوحة Dev Academy: ${dashboardUrl}`,
    "",
    "Dev Academy — منصة تعليمية",
    siteUrl,
    "",
    "وصلتك هذه الرسالة لأنك عضو في Dev Academy. للرد، استخدم زر الرد وسيصل ردك إلى مرسل الرسالة.",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");

  return { html, text };
}

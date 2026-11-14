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
  const markUrl = `${siteUrl}/logo-mark.png`;
  const domain = siteUrl.replace(/^https?:\/\//, "");
  const recipientName = String(input.recipientName || "").trim();
  const greeting = recipientName ? `مرحبًا ${recipientName}،` : "مرحبًا،";
  const dateLabel = formatDate(input.createdAt);
  const year = new Date().getFullYear();
  const eyebrow = input.isBroadcast
    ? "إعلان من فريق Dev Academy"
    : "رسالة جديدة من فريق Dev Academy";
  const preheader = `${input.subject} — ${eyebrow}`;
  const founderName = "𝘌𝘕𝘎. 𝐼𝑠𝑙𝑎𝑚 𝐴𝑏𝑑𝑜";

  const subject = escapeHtml(input.subject);
  const rawSenderName = input.senderName || "فريق Dev Academy";
  const senderName = escapeHtml(rawSenderName);
  const senderInitial = escapeHtml(Array.from(rawSenderName.trim())[0] || "D");
  const senderEmail = escapeHtml(input.senderEmail);
  const greetingHtml = escapeHtml(greeting);
  const messageHtml = bodyToHtml(input.body);
  const dateHtml = escapeHtml(dateLabel);
  const founderHtml = escapeHtml(founderName);

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f6;font-family:Tahoma,Arial,Helvetica,sans-serif;color:#0b1220;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f6;">
    <tr>
      <td align="center" style="padding:40px 14px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e3e9ef;border-radius:22px;overflow:hidden;border-collapse:separate;box-shadow:0 18px 48px rgba(4,16,28,0.10);">
          <tr>
            <td align="center" bgcolor="#000000" style="background-color:#000000;padding:30px 28px 22px;">
              <img src="${logoUrl}" width="220" alt="Dev Academy" style="display:block;width:220px;max-width:220px;height:auto;border:0;outline:none;text-decoration:none;" />
              <p style="margin:10px 0 0;font-size:10px;line-height:1.7;letter-spacing:1.2px;font-weight:bold;color:#7c8b9b;">
                منصة تعليمية للذكاء الاصطناعي والأمن السيبراني
              </p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#00d9ff" style="height:3px;background-color:#00d9ff;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 34px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#e8fbff" style="background-color:#e8fbff;border:1px solid #bdeef7;border-radius:999px;padding:6px 12px;">
                    <p style="margin:0;font-size:11px;line-height:1.5;font-weight:bold;letter-spacing:0.3px;color:#067a8c;">
                      ${escapeHtml(eyebrow)}
                    </p>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 20px;font-size:25px;line-height:1.5;font-weight:bold;color:#0b1220;">
                ${subject}
              </h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.9;color:#475569;">
                ${greetingHtml}
              </p>
              <div style="margin:0;font-size:16px;line-height:2;color:#1e293b;">
                ${messageHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 34px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b1220" style="background-color:#0b1220;border-radius:14px;">
                <tr>
                  <td width="52" valign="middle" style="padding:18px 20px 18px 0;text-align:center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td width="44" height="44" align="center" valign="middle" bgcolor="#00d9ff" style="width:44px;height:44px;background-color:#00d9ff;border-radius:999px;font-family:Tahoma,Arial,Helvetica,sans-serif;font-size:18px;line-height:44px;font-weight:bold;color:#04121a;">
                          ${senderInitial}
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td valign="middle" style="padding:18px 20px 18px 22px;">
                    <p style="margin:0 0 5px;font-size:10px;line-height:1.5;letter-spacing:0.8px;font-weight:bold;color:#8fa3b8;">
                      أرسل هذه الرسالة
                    </p>
                    <p style="margin:0 0 2px;font-size:15px;line-height:1.6;font-weight:bold;color:#ffffff;">
                      ${senderName}
                    </p>
                    <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#7dd3e3;direction:ltr;text-align:right;">
                      ${senderEmail}
                    </p>
                    ${
                      dateHtml
                        ? `<p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">${dateHtml}</p>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:26px 34px 36px;">
              <a href="${dashboardUrl}" style="display:inline-block;background-color:#04070a;color:#ffffff;border:1px solid #00d9ff;text-decoration:none;font-family:Tahoma,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;padding:14px 32px;border-radius:12px;">
                افتح لوحة Dev Academy
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#000000" style="background-color:#000000;padding:30px 32px 26px;">
              <img src="${markUrl}" width="42" alt="Dev Academy" style="display:block;width:42px;max-width:42px;height:42px;border:0;outline:none;text-decoration:none;" />
              <p style="margin:10px 0 4px;font-size:14px;line-height:1.7;font-weight:bold;color:#ffffff;">
                Dev Academy
              </p>
              <p style="margin:0 0 6px;font-size:10px;line-height:1.7;letter-spacing:0.6px;color:#8fa3b8;">
                منصة تعليمية للذكاء الاصطناعي والأمن السيبراني
              </p>
              <p style="margin:0;font-size:11px;line-height:1.7;">
                <a href="${siteUrl}" style="color:#22d3ee;text-decoration:none;">${escapeHtml(domain)}</a>
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:18px auto;">
                <tr>
                  <td bgcolor="#1e2a36" style="width:64px;height:1px;background-color:#1e2a36;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:10px;line-height:1.6;letter-spacing:1px;color:#64748b;">
                المؤسس
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.8;font-weight:bold;letter-spacing:0.3px;color:#e2e8f0;">
                ${founderHtml}
              </p>
              <p style="margin:0 0 6px;font-size:10px;line-height:1.7;color:#5b6b7c;">
                © ${year} Dev Academy. جميع الحقوق محفوظة.
              </p>
              <p style="margin:0;font-size:10px;line-height:1.8;color:#64748b;">
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
    "Dev Academy — منصة تعليمية للذكاء الاصطناعي والأمن السيبراني",
    siteUrl,
    "",
    `المؤسس: ${founderName}`,
    `© ${year} Dev Academy. جميع الحقوق محفوظة.`,
    "",
    "وصلتك هذه الرسالة لأنك عضو في Dev Academy. للرد، استخدم زر الرد وسيصل ردك إلى مرسل الرسالة.",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");

  return { html, text };
}

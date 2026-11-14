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
<body style="margin:0;padding:0;background-color:#eef2f6;font-family:Arial,'Segoe UI',Tahoma,'Noto Sans Arabic',sans-serif;color:#0b1220;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f6;">
    <tr>
      <td align="center" style="padding:40px 14px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e3e9ef;border-radius:22px;overflow:hidden;border-collapse:separate;box-shadow:0 18px 48px rgba(4,16,28,0.10);">
          <tr>
            <td align="center" bgcolor="#000000" style="background-color:#000000;padding:26px 24px 20px;">
              <img src="${logoUrl}" width="200" alt="Dev Academy" style="display:block;width:200px;max-width:200px;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td bgcolor="#00d9ff" style="height:3px;background-color:#00d9ff;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:34px 32px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
                <tr>
                  <td width="4" height="16" bgcolor="#00c8e8" style="width:4px;height:16px;background-color:#00c8e8;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding-right:8px;font-size:11px;line-height:1.6;font-weight:bold;color:#067a8c;">
                    ${escapeHtml(eyebrow)}
                  </td>
                </tr>
              </table>
              <h1 style="margin:0 0 18px;font-size:24px;line-height:1.55;font-weight:bold;color:#0b1220;">
                ${subject}
              </h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.9;color:#475569;">
                ${greetingHtml}
              </p>
              <div style="margin:0;font-size:15.5px;line-height:1.95;color:#1e293b;">
                ${messageHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b1220" style="background-color:#0b1220;border-radius:14px;">
                <tr>
                  <td width="50" valign="middle" style="padding:16px 18px 16px 0;text-align:center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td width="42" height="42" align="center" valign="middle" bgcolor="#00d9ff" style="width:42px;height:42px;background-color:#00d9ff;border-radius:999px;font-family:Arial,'Segoe UI',Tahoma,'Noto Sans Arabic',sans-serif;font-size:17px;line-height:42px;font-weight:bold;color:#04121a;">
                          ${senderInitial}
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td valign="middle" style="padding:16px 18px 16px 20px;">
                    <p style="margin:0 0 4px;font-size:10.5px;line-height:1.6;font-weight:bold;color:#8fa3b8;">
                      أرسل هذه الرسالة
                    </p>
                    <p style="margin:0 0 1px;font-size:14.5px;line-height:1.6;font-weight:bold;color:#ffffff;">
                      ${senderName}
                    </p>
                    <p style="margin:0 0 5px;font-size:11.5px;line-height:1.6;color:#7dd3e3;direction:ltr;text-align:right;">
                      ${senderEmail}
                    </p>
                    ${
                      dateHtml
                        ? `<p style="margin:0;font-size:10.5px;line-height:1.6;color:#64748b;">${dateHtml}</p>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 32px;">
              <a href="${dashboardUrl}" style="display:inline-block;background-color:#04070a;color:#ffffff;border:1px solid #00d9ff;text-decoration:none;font-family:Arial,'Segoe UI',Tahoma,'Noto Sans Arabic',sans-serif;font-size:14.5px;line-height:1.4;font-weight:bold;padding:13px 30px;border-radius:10px;">
                افتح لوحة Dev Academy
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#000000" style="background-color:#000000;padding:26px 30px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td valign="middle" style="padding-left:10px;">
                    <img src="${markUrl}" width="34" alt="Dev Academy" style="display:block;width:34px;max-width:34px;height:34px;border:0;outline:none;text-decoration:none;" />
                  </td>
                  <td valign="middle" style="text-align:right;">
                    <p style="margin:0 0 2px;font-size:13.5px;line-height:1.6;font-weight:bold;color:#ffffff;">
                      Dev Academy
                    </p>
                    <p style="margin:0;font-size:10.5px;line-height:1.7;color:#8fa3b8;">
                      منصة تعليمية للذكاء الاصطناعي والأمن السيبراني
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0;font-size:10.5px;line-height:1.7;">
                <a href="${siteUrl}" style="color:#22d3ee;text-decoration:none;">${escapeHtml(domain)}</a>
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:16px auto 14px;">
                <tr>
                  <td bgcolor="#1e2a36" style="width:48px;height:1px;background-color:#1e2a36;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin:0 0 3px;font-size:10px;line-height:1.6;color:#64748b;">
                المؤسس
              </p>
              <p style="margin:0 0 14px;font-size:13.5px;line-height:1.8;font-weight:bold;color:#e2e8f0;">
                ${founderHtml}
              </p>
              <p style="margin:0 0 4px;font-size:10px;line-height:1.7;color:#5b6b7c;">
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

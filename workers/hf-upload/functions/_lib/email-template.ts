export interface MessageEmailInput {
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
  senderAvatarUrl?: string | null;
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
  const logoUrl = `${siteUrl}/email-logo.jpg`;
  const markUrl = `${siteUrl}/logo-mark.png`;
  const domain = siteUrl.replace(/^https?:\/\//, "");
  const recipientName = String(input.recipientName || "").trim();
  const greeting = recipientName
    ? `مرحبًا بك، ${recipientName}`
    : "مرحبًا بك،";
  const dateLabel = formatDate(input.createdAt);
  const year = new Date().getFullYear();
  const eyebrow = input.isBroadcast
    ? "إعلان رسمي من Dev Academy"
    : "رسالة جديدة من فريق Dev Academy";
  const preheader = `${input.subject} — ${eyebrow}`;
  const founderName = "𝘌𝘕𝘎. 𝐼𝑠𝑙𝑎𝑚 𝐴𝑏𝑑𝑜";
  const fontStack = "Arial,'Segoe UI',Tahoma,'Noto Sans Arabic',sans-serif";
  const rawAvatarUrl = String(input.senderAvatarUrl || "").trim();
  const avatarUrl = /^https?:\/\//i.test(rawAvatarUrl) ? rawAvatarUrl : "";

  const subject = escapeHtml(input.subject);
  const rawSenderName = input.senderName || "فريق Dev Academy";
  const senderName = escapeHtml(rawSenderName);
  const senderInitial = escapeHtml(Array.from(rawSenderName.trim())[0] || "D");
  const senderEmail = escapeHtml(input.senderEmail);
  const greetingHtml = escapeHtml(greeting);
  const messageHtml = bodyToHtml(input.body);
  const dateHtml = escapeHtml(dateLabel);
  const founderHtml = escapeHtml(founderName);

  const avatarHtml = avatarUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                        <tr>
                          <td width="52" height="52" align="center" valign="middle">
                            <img src="${escapeHtml(avatarUrl)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:2px solid #ffffff;border-radius:999px;background-color:#e2e8f0;outline:none;text-decoration:none;" />
                          </td>
                        </tr>
                      </table>`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                        <tr>
                          <td width="48" height="48" align="center" valign="middle" bgcolor="#0b1220" style="width:48px;height:48px;background-color:#0b1220;border-radius:999px;font-family:${fontStack};font-size:18px;line-height:48px;font-weight:bold;color:#7dd3e3;">
                            ${senderInitial}
                          </td>
                        </tr>
                      </table>`;

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${subject}</title>
  <style>
    @media only screen and (max-width:620px) {
      .email-outer { padding:20px 10px !important; }
      .email-card { border-radius:16px !important; }
      .email-header { padding:18px 16px 14px !important; }
      .email-logo { width:170px !important; }
      .email-content { padding:24px 20px 0 !important; }
      .email-title { font-size:20px !important; line-height:1.5 !important; }
      .email-greeting { font-size:14px !important; }
      .email-message { font-size:14.5px !important; line-height:1.9 !important; }
      .email-sender-wrap { padding:16px 20px 0 !important; }
      .email-cta { padding:20px 20px 26px !important; }
      .email-footer { padding:20px 18px 16px !important; }
    }
    @media only screen and (max-width:380px) {
      .email-outer { padding:14px 8px !important; }
      .email-logo { width:150px !important; }
      .email-content { padding:22px 16px 0 !important; }
      .email-title { font-size:18px !important; }
      .email-sender-wrap { padding:14px 16px 0 !important; }
      .email-cta { padding:18px 16px 24px !important; }
      .email-footer { padding:18px 14px 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e7eef3;font-family:${fontStack};color:#0b1220;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e7eef3" style="background-color:#e7eef3;">
    <tr>
      <td align="center" class="email-outer" style="padding:38px 14px;">
        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6fafc" class="email-card" style="width:100%;max-width:600px;background-color:#f6fafc;border:1px solid #d9e4ec;border-radius:20px;overflow:hidden;border-collapse:separate;box-shadow:0 16px 42px rgba(6,24,38,0.10);">
          <tr>
            <td align="center" bgcolor="#000000" class="email-header" style="background-color:#000000;padding:22px 24px 16px;">
              <img src="${logoUrl}" width="200" height="127" alt="Dev Academy" class="email-logo" style="display:block;width:200px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td bgcolor="#22d3ee" style="height:3px;background-color:#22d3ee;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-content" style="padding:32px 34px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
                <tr>
                  <td width="4" height="14" bgcolor="#0891b2" style="width:4px;height:14px;background-color:#0891b2;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding-right:8px;font-size:11px;line-height:1.6;font-weight:bold;color:#0e7490;">
                    ${escapeHtml(eyebrow)}
                  </td>
                </tr>
              </table>
              <h1 class="email-title" style="margin:0 0 16px;font-size:23px;line-height:1.55;font-weight:bold;color:#0b1220;">
                ${subject}
              </h1>
              <p class="email-greeting" style="margin:0 0 12px;font-size:14.5px;line-height:1.9;color:#64748b;">
                ${greetingHtml}
              </p>
              <div class="email-message" style="margin:0;font-size:15px;line-height:1.95;color:#334155;word-break:break-word;">
                ${messageHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td class="email-sender-wrap" style="padding:20px 34px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef6f9" style="background-color:#eef6f9;border:1px solid #d6e5ee;border-right:3px solid #0891b2;border-radius:12px;">
                <tr>
                  <td width="58" valign="middle" style="padding:16px 12px 16px 0;text-align:center;">
                    ${avatarHtml}
                  </td>
                  <td valign="middle" style="padding:16px 16px 16px 18px;">
                    <p style="margin:0 0 3px;font-size:10px;line-height:1.6;font-weight:bold;color:#64748b;">
                      المرسل
                    </p>
                    <p style="margin:0 0 2px;font-size:14px;line-height:1.6;font-weight:bold;color:#0b1220;">
                      ${senderName}
                    </p>
                    <p style="margin:0 0 4px;font-size:11.5px;line-height:1.6;color:#0e7490;direction:ltr;text-align:right;word-break:break-all;">
                      ${senderEmail}
                    </p>
                    ${
                      dateHtml
                        ? `<p style="margin:0;font-size:10px;line-height:1.6;color:#94a3b8;">${dateHtml}</p>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="email-cta" style="padding:24px 34px 30px;">
              <a href="${dashboardUrl}" style="display:inline-block;background-color:#0b1220;color:#ffffff;border:1px solid #0e7490;text-decoration:none;font-family:${fontStack};font-size:14px;line-height:1.4;font-weight:bold;padding:13px 32px;border-radius:10px;">
                الدخول إلى لوحة التحكم
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#000000" class="email-footer" style="background-color:#000000;padding:22px 30px 18px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td valign="middle" style="padding-left:8px;">
                    <img src="${markUrl}" width="28" alt="Dev Academy" style="display:block;width:28px;max-width:28px;height:28px;border:0;outline:none;text-decoration:none;" />
                  </td>
                  <td valign="middle" style="text-align:right;">
                    <p style="margin:0 0 1px;font-size:13px;line-height:1.6;font-weight:bold;color:#f8fafc;">
                      Dev Academy
                    </p>
                    <p style="margin:0;font-size:10px;line-height:1.7;color:#8fa3b8;">
                      منصة تعليمية للذكاء الاصطناعي والأمن السيبراني
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:8px 0 0;font-size:10.5px;line-height:1.7;">
                <a href="${siteUrl}" style="color:#22d3ee;text-decoration:none;">${escapeHtml(domain)}</a>
              </p>
              <p style="margin:10px 0 0;font-size:10px;line-height:1.7;color:#64748b;">
                المؤسس
                <span style="color:#334155;">·</span>
                <span style="font-size:12.5px;font-weight:bold;color:#e2e8f0;">${founderHtml}</span>
              </p>
              <p style="margin:8px 0 0;font-size:10px;line-height:1.7;color:#475569;">
                © ${year} Dev Academy. جميع الحقوق محفوظة.
              </p>
              <p style="margin:4px 0 0;font-size:10px;line-height:1.8;color:#64748b;">
                تلقيت هذه الرسالة بصفتك عضوًا في منصة Dev Academy. للرد، استخدم زر الرد وسيصل ردك مباشرة إلى المرسل.
              </p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
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
    `الدخول إلى لوحة التحكم: ${dashboardUrl}`,
    "",
    "Dev Academy — منصة تعليمية للذكاء الاصطناعي والأمن السيبراني",
    siteUrl,
    "",
    `المؤسس: ${founderName}`,
    `© ${year} Dev Academy. جميع الحقوق محفوظة.`,
    "",
    "تلقيت هذه الرسالة بصفتك عضوًا في منصة Dev Academy. للرد، استخدم زر الرد وسيصل ردك مباشرة إلى المرسل.",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");

  return { html, text };
}

import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function EmailPreview({ subject, body, senderName, senderEmail }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-white text-right shadow-sm">
      <div className="flex items-center justify-center bg-[#05070d] px-4 py-3">
        <img
          src="/logo-full.jpg"
          alt="Dev Academy"
          className="h-auto w-32"
        />
      </div>
      <div className="h-1 bg-[#00d9ff]" />
      <div className="space-y-2 px-4 py-4" dir="rtl">
        <p className="text-[10px] font-semibold text-[#0891b2]">
          رسالة جديدة من فريق Dev Academy
        </p>
        <p className="text-sm font-bold leading-relaxed text-[#0f172a]">
          {subject || "عنوان الرسالة"}
        </p>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#334155]">
          {body || "نص الرسالة هيظهر هنا..."}
        </p>
        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
          <p className="text-[9px] text-[#64748b]">أرسل هذه الرسالة</p>
          <p className="text-[11px] font-semibold text-[#0f172a]">
            {senderName || "فريق Dev Academy"}
          </p>
          <p className="text-[9px] text-[#64748b]" dir="ltr">
            {senderEmail}
          </p>
        </div>
        <div className="pt-1 text-center">
          <span className="inline-block rounded-lg bg-[#00c8e8] px-4 py-1.5 text-[10px] font-bold text-[#04121a]">
            افتح لوحة Dev Academy
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SendMessageDialog({
  user,
  subject,
  body,
  senderName,
  senderEmail,
  sending,
  onSubjectChange,
  onBodyChange,
  onSend,
  onClose,
}) {
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            إرسال رسالة إلى {user?.full_name || user?.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4" dir="rtl">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <Mail size={14} className="shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">المستلم</p>
              <p className="truncate text-xs font-medium text-foreground" dir="ltr">
                {user?.email}
              </p>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              عنوان الرسالة
            </span>
            <Input
              value={subject}
              onChange={(event) => onSubjectChange(event.target.value)}
              placeholder="مثال: موعد تسليم المشروع"
              maxLength={200}
              className="border-border bg-input"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              نص الرسالة
            </span>
            <Textarea
              placeholder="اكتب رسالتك هنا..."
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              maxLength={5000}
              className="min-h-[130px] border-border bg-input"
            />
          </label>

          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              هتتحفظ في إشعارات الموقع، وهتتبعت كمان على البريد الإلكتروني
            </span>{" "}
            بقالب Dev Academy الاحترافي. لو البريد فشل، الإشعار هيفضل محفوظ
            وتقدر تعيد المحاولة.
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              معاينة كارت البريد
            </p>
            <EmailPreview
              subject={subject}
              body={body}
              senderName={senderName}
              senderEmail={senderEmail}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={sending}>
              إلغاء
            </Button>
            <Button
              className="gap-2 bg-primary text-primary-foreground hover:brightness-110"
              disabled={sending || !subject?.trim() || !body.trim()}
              onClick={onSend}
            >
              <Send size={14} />
              {sending ? "جاري الإرسال..." : "إرسال الرسالة"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

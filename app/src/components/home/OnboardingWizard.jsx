import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'

export default function OnboardingWizard({ onComplete }) {
  const { user, refreshProfile } = useAuth()
  const [form, setForm] = useState({ major: '', year: '', semester: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!form.major || !form.year || !form.semester) {
      toast.error('الرجاء تحديد كافة الاختيارات')
      return
    }
    setSaving(true)
    await db.update('profiles', user.id, {
      major: form.major,
      year: form.year,
      semester: form.semester,
    })
    await refreshProfile()
    toast.success('تم تحديد مسارك بنجاح!')
    setSaving(false)
    onComplete(form)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md p-6 rounded-2xl space-y-6"
        style={{
          background: 'hsl(240, 30%, 7%)',
          border: '1px solid hsla(190,100%,50%,0.3)',
          boxShadow: '0 0 40px hsla(190,100%,50%,0.15)',
        }}
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img
              src="/logo-mark.png"
              alt="Logo"
              style={{
                width: 36,
                height: 36,
                objectFit: 'contain',
                borderRadius: 8,
                border: '1px solid hsla(190,100%,50%,0.3)',
              }}
            />
            <span
              className="font-semibold text-lg"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: 'hsl(190, 100%, 50%)',
              }}
            >
              Dev Academy
            </span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">حدد مسارك الدراسي</h2>
          <p className="text-muted-foreground text-sm">سيتم توجيهك تلقائياً إلى مواد تخصصك</p>
        </div>
        <div className="space-y-4">
          <div>
            <label
              className="text-xs font-mono text-muted-foreground mb-1.5 block"
              style={{ color: 'hsl(190,100%,50%)' }}
            >
              التخصص
            </label>
            <select
              value={form.major}
              onChange={(e) => setForm((c) => ({ ...c, major: e.target.value }))}
              className="w-full h-10 rounded-lg border px-3 text-sm text-foreground"
              style={{
                background: 'hsl(240,20%,12%)',
                borderColor: 'hsla(190,100%,50%,0.2)',
              }}
            >
              <option value="">اختر التخصص</option>
              <option value="ai">الذكاء الاصطناعي (AI)</option>
              <option value="cybersecurity">الأمن السيبراني (Cybersecurity)</option>
            </select>
          </div>
          <div>
            <label
              className="text-xs font-mono text-muted-foreground mb-1.5 block"
              style={{ color: 'hsl(190,100%,50%)' }}
            >
              السنة الدراسية
            </label>
            <select
              value={form.year}
              onChange={(e) => setForm((c) => ({ ...c, year: e.target.value }))}
              className="w-full h-10 rounded-lg border px-3 text-sm text-foreground"
              style={{
                background: 'hsl(240,20%,12%)',
                borderColor: 'hsla(190,100%,50%,0.2)',
              }}
            >
              <option value="">اختر السنة</option>
              <option value="year-1">السنة الأولى</option>
              <option value="year-2">السنة الثانية</option>
              <option value="year-3">السنة الثالثة</option>
              <option value="year-4">السنة الرابعة</option>
            </select>
          </div>
          <div>
            <label
              className="text-xs font-mono text-muted-foreground mb-1.5 block"
              style={{ color: 'hsl(190,100%,50%)' }}
            >
              الترم الحالي
            </label>
            <select
              value={form.semester}
              onChange={(e) => setForm((c) => ({ ...c, semester: e.target.value }))}
              className="w-full h-10 rounded-lg border px-3 text-sm text-foreground"
              style={{
                background: 'hsl(240,20%,12%)',
                borderColor: 'hsla(190,100%,50%,0.2)',
              }}
            >
              <option value="">اختر الترم</option>
              <option value="sem-1">الترم الأول</option>
              <option value="sem-2">الترم الثاني</option>
            </select>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full h-11 text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110"
          style={{ boxShadow: '0 0 16px hsla(190,100%,50%,0.3)' }}
        >
          {saving ? 'جاري الحفظ...' : 'ابدأ مسيرتي التعليمية ←'}
        </Button>
      </motion.div>
    </div>
  )
}

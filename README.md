# Dev Academy — ديف أكاديمي

منصة مذاكرة لطلاب كلية الحاسبات والذكاء الاصطناعي: مكتبة مواد مصنّفة (فصول ← محاضرات/سكاشن ← عناصر: فيديوهات، تسجيلات، PDF، أكواد) + لوحة تحكم للأدمن (إعلانات، رسائل، مهام، إعدادات) + ملفات شخصية.

## التقنيات

- **الواجهة**: React 18 + Vite + Tailwind CSS + Radix UI + Framer Motion
- **البيانات والمصادقة**: Supabase (Postgres + RLS + Storage)
- **الاستضافة**: Cloudflare Pages
- **وسائط المواد**: Hugging Face Dataset ([devacademy-fcai/devacademy-media](https://huggingface.co/datasets/devacademy-fcai/devacademy-media))

## البنية

| المسار | الوصف |
| --- | --- |
| `app/` | تطبيق الواجهة (Vite + React) |
| `db/migrations/` | هجرات SQL لقاعدة البيانات |
| `db/functions/` | دوال/Edge Functions |
| `scripts/` | سكربتات استيراد/تصدير وأدوات تشغيلية |
| `audit/` | تقارير التدقيق والتحققات (غير مرفوعة للمستودع) |

## التشغيل محليًا

```bash
cd app
npm install
cp .env.example .env   # ثم املأ القيم
npm run dev
```

## البناء والنشر

```bash
cd app
npm run build
npx wrangler pages deploy dist --project-name dev-academy --branch main
```

## متغيرات البيئة

انظر `app/.env.example` — تشمل مفاتيح Supabase، وCloudflare، وHugging Face.

## ملاحظات

- الواجهة عربية RTL بالكامل.
- الملفات الكبيرة تُستورد عبر بايبلاين تيليجرام ← Hugging Face ← قاعدة البيانات (سكربتات `scripts/`).

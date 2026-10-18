import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PublicBackground from "@/components/layout/PublicBackground";

const CONTENT = {
  privacy: {
    title: "سياسة الخصوصية",
    updated: "آخر تحديث: 18 أكتوبر 2026",
    sections: [
      {
        heading: "مقدمة",
        body: "منصة Dev Academy (المتاحة على dev-academy.pages.dev) هي منصة تعليمية تتيح لطلاب الذكاء الاصطناعي وعلوم الحاسب الوصول إلى المواد الدراسية والملفات والمصادر التعليمية. توضح هذه السياسة كيف نجمع بياناتك ونستخدمها ونحميها.",
      },
      {
        heading: "البيانات التي نجمعها",
        body: "عند إنشاء حساب أو تسجيل الدخول (بالبريد الإلكتروني أو عبر حساب Google) نجمع: الاسم والبريد الإلكتروني والصورة الشخصية (إن وُجدت) التي يوفرها مزود تسجيل الدخول، إضافة إلى بيانات الاستخدام مثل المواد التي تتصفحها ومفضلاتك وعدد مرات التحميل، وذلك لتشغيل المنصة وتحسينها.",
      },
      {
        heading: "كيف نستخدم البيانات",
        body: "نستخدم بياناتك لتوفير خدمات المنصة: عرض المواد المناسبة لتخصصك وسنتك الدراسية، حفظ المفضلة، إظهار إحصائيات الاستخدام للمشرفين، والتواصل معك بخصوص التحديثات. لا نبيع بياناتك الشخصية ولا نشاركها مع أي طرف ثالث لأغراض تسويقية.",
      },
      {
        heading: "تخزين البيانات",
        body: "تُخزَّن بياناتك لدى مزوّدي الخدمة المعتمدين (Supabase لقاعدة البيانات والمصادقة، وCloudflare لتقديم الموقع، وHugging Face لاستضافة ملفات الوسائط). جميع الاتصالات مشفرة عبر HTTPS.",
      },
      {
        heading: "الإعلانات والتحليلات",
        body: "نستخدم خدمة Cloudflare Web Analytics لقياس الزيارات بشكل مجمّع وبعضوية كاملة دون ملفات تعريف ارتباط (cookies) ودون تتبع شخصي. ولا نعرض إعلانات على المنصة.",
      },
      {
        heading: "حقوقك",
        body: "يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذف حسابك بالتواصل معنا عبر البريد الإلكتروني islam230366qw@gmail.com. سنستجيب لطلبك خلال مدة معقولة.",
      },
      {
        heading: "التواصل",
        body: "لأي استفسار حول هذه السياسة، راسلنا على islam230366qw@gmail.com.",
      },
    ],
  },
  terms: {
    title: "شروط الاستخدام",
    updated: "آخر تحديث: 18 أكتوبر 2026",
    sections: [
      {
        heading: "قبول الشروط",
        body: "باستخدامك منصة Dev Academy فأنت توافق على هذه الشروط. إذا لم توافق عليها، يُرجى عدم استخدام المنصة.",
      },
      {
        heading: "الحساب",
        body: "أنت مسؤول عن الحفاظ على سرية بيانات حسابك وعن جميع الأنشطة التي تتم من خلاله. يُمنع إنشاء حسابات وهمية أو انتحال شخصية الآخرين. يحق للإدارة تعطيل أي حساب يخالف هذه الشروط.",
      },
      {
        heading: "المحتوى التعليمي",
        body: "المواد والمحاضرات والملفات المنشورة على المنصة هي لأغراض تعليمية شخصية. يُمنع إعادة بيع المحتوى أو نشره تجاريًا أو إتاحته للعامة دون إذن مسبق من إدارة المنصة.",
      },
      {
        heading: "الاستخدام المقبول",
        body: "يُمنع محاولة اختراق المنصة أو إساءة استخدام خدماتها أو رفع محتوى ضار أو مخالف للقانون أو منتهك لحقوق الملكية الفكرية.",
      },
      {
        heading: "حدود المسؤولية",
        body: "نبذل جهدنا لتوفير خدمة مستقرة ودقيقة، لكننا لا نضمن خلو المنصة من الأخطاء أو الانقطاعات، ولا نتحمل مسؤولية أي أضرار ناتجة عن استخدام المنصة أو الاعتماد على محتواها الأكاديمي، ويبقى المرجع النهائي هو المواد الرسمية للأستاذ والدكتور الجامعي.",
      },
      {
        heading: "التعديلات",
        body: "قد نحدّث هذه الشروط من وقت لآخر، ويُعد استمرارك في استخدام المنصة بعد نشر التعديلات موافقةً عليها.",
      },
      {
        heading: "التواصل",
        body: "لأي استفسار حول هذه الشروط، راسلنا على islam230366qw@gmail.com.",
      },
    ],
  },
};

export default function Legal() {
  const { pathname } = useLocation();
  const kind = pathname.includes("terms") ? "terms" : "privacy";
  const content = CONTENT[kind];

  return (
    <div className="min-h-screen bg-background relative">
      <PublicBackground />
      <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto relative">
        <p className="text-xs font-mono mb-1 text-primary">
          DEV ACADEMY
        </p>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {content.title}
        </h1>
        <p className="text-muted-foreground text-sm mb-8">{content.updated}</p>
        <div className="space-y-6">
          {content.sections.map((section) => (
            <section key={section.heading} className="rounded-xl p-5" style={{ background: "hsl(240, 30%, 7%)" }}>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                {section.heading}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {section.body}
              </p>
            </section>
          ))}
        </div>
        <div className="mt-10 flex gap-3">
          <Button asChild variant="outline">
            <Link to={kind === "terms" ? "/privacy" : "/terms"}>
              {kind === "terms" ? "سياسة الخصوصية" : "شروط الاستخدام"}
            </Link>
          </Button>
          <Button asChild>
            <Link to="/">العودة للرئيسية</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

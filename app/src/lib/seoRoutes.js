export const SITE_URL = "https://dev-academy.pages.dev";
export const SITE_NAME = "Dev Academy";
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export const MAJOR_IDS = ["ai", "cybersecurity"];
export const YEAR_IDS = ["year-1", "year-2", "year-3", "year-4"];
export const SEM_IDS = ["sem-1", "sem-2"];

const HOME_DESCRIPTION =
  "Dev Academy — ديف أكاديمي، منصة تعليمية عربية: محاضرات وملخصات وكتب وحلول وامتحانات سابقة في الذكاء الاصطناعي والأمن السيبراني وعلوم الحاسب.";

const MAJOR_SEO = {
  ai: {
    title: "الذكاء الاصطناعي",
    short: "ذكاء اصطناعي",
    description:
      "مواد تخصص الذكاء الاصطناعي في Dev Academy: محاضرات، ملخصات، كتب، حلول، ومراجع تعليمية، وامتحانات سابقة، مرتبة حسب الفرقة والفصل الدراسي.",
  },
  cybersecurity: {
    title: "الأمن السيبراني",
    short: "أمن سيبراني",
    description:
      "مواد تخصص الأمن السيبراني في Dev Academy: محاضرات، ملخصات، كتب، حلول، ومراجع تعليمية، وامتحانات سابقة، مرتبة حسب الفرقة والفصل الدراسي.",
  },
};

const YEAR_LABELS = {
  "year-1": "الفرقة الأولى",
  "year-2": "الفرقة الثانية",
  "year-3": "الفرقة الثالثة",
  "year-4": "الفرقة الرابعة",
};

const SEM_LABELS = {
  "sem-1": "الفصل الأول",
  "sem-2": "الفصل الثاني",
};

export function seoFor(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  const pageTitle = (title) => `${title} | ${SITE_NAME}`;
  const publicRobots = "index, follow, max-image-preview:large";

  if (path === "/") {
    return {
      title: `${SITE_NAME} | ديف أكاديمي — منصة تعليمية`,
      description: HOME_DESCRIPTION,
      robots: publicRobots,
    };
  }

  if (path === "/explore") {
    return {
      title: pageTitle("استكشف التخصصات والمواد الدراسية"),
      description:
        "استكشف تخصصات الذكاء الاصطناعي والأمن السيبراني في Dev Academy، وتصفّح الفرق والفصول الدراسية للوصول إلى المحاضرات والملخصات والامتحانات السابقة.",
      robots: publicRobots,
    };
  }

  if (path === "/privacy") {
    return {
      title: pageTitle("سياسة الخصوصية"),
      description:
        "سياسة الخصوصية في Dev Academy — ديف أكاديمي: كيف نجمع بياناتك ونستخدمها ونحميها، وحقوقك في الوصول إلى حسابك وحذفه.",
      robots: publicRobots,
    };
  }

  if (path === "/terms") {
    return {
      title: pageTitle("الشروط والأحكام"),
      description:
        "شروط استخدام Dev Academy — ديف أكاديمي: قواعد الحساب والمحتوى التعليمي والاستخدام المقبول وحدود المسؤولية وحقوق الملكية.",
      robots: publicRobots,
    };
  }

  if (parts[0] === "s" && parts.length === 2) {
    return {
      title: pageTitle("قائمة مشتركة"),
      description: "قائمة مواد دراسية مشتركة عبر Dev Academy — ديف أكاديمي.",
      robots: "noindex, nofollow",
    };
  }

  if (path === "/login") {
    return {
      title: pageTitle("تسجيل الدخول"),
      description: "سجّل الدخول إلى حسابك في Dev Academy.",
      robots: "noindex, nofollow",
    };
  }

  if (path === "/reset-password") {
    return {
      title: pageTitle("إعادة تعيين كلمة المرور"),
      description: "إعادة تعيين كلمة المرور في Dev Academy.",
      robots: "noindex, nofollow",
    };
  }

  if (path === "/legacy-login") {
    return {
      title: pageTitle("دخول الحسابات القديمة"),
      description: "دخول مؤقت للحسابات القديمة في Dev Academy.",
      robots: "noindex, nofollow",
    };
  }

  if (path === "/profile") {
    return {
      title: pageTitle("الملف الشخصي"),
      description: "ملفك الشخصي في Dev Academy — ديف أكاديمي.",
      robots: "noindex, nofollow",
    };
  }

  if (parts[0] === "dashboard" || parts[0] === "admin") {
    return {
      title: pageTitle("لوحة التحكم"),
      description: HOME_DESCRIPTION,
      robots: "noindex, nofollow",
    };
  }

  const major = MAJOR_SEO[parts[0]];
  if (major && parts.length === 1) {
    return {
      title: pageTitle(`${major.title}: محاضرات وملخصات وامتحانات`),
      description: major.description,
      robots: publicRobots,
    };
  }

  const year = YEAR_LABELS[parts[1]];
  if (major && year && parts.length === 2) {
    return {
      title: pageTitle(`${year} ${major.short}: المواد والملخصات`),
      description: `مواد ${year} في تخصص ${major.title} على Dev Academy: محاضرات، ملخصات، واجبات، وامتحانات سابقة للفصلين الدراسيين، مرتبة حسب المادة الدراسية.`,
      robots: publicRobots,
    };
  }

  const sem = SEM_LABELS[parts[2]];
  if (major && year && sem && parts.length === 3) {
    return {
      title: pageTitle(`${sem} — ${year} ${major.short}`),
      description: `محاضرات وملخصات وحلول وامتحانات سابقة في ${sem} ${year} لتخصص ${major.title} على Dev Academy، مرتبة حسب المادة الدراسية.`,
      robots: publicRobots,
    };
  }

  return {
    title: pageTitle("الصفحة غير موجودة"),
    description: HOME_DESCRIPTION,
    robots: "noindex, nofollow",
  };
}

export function publicRoutes() {
  const routes = ["/", "/explore", "/privacy", "/terms"];
  for (const major of MAJOR_IDS) {
    routes.push(`/${major}`);
    for (const year of YEAR_IDS) {
      routes.push(`/${major}/${year}`);
      for (const sem of SEM_IDS) {
        routes.push(`/${major}/${year}/${sem}`);
      }
    }
  }
  return routes;
}

export function shellRoutes() {
  return ["/login", "/legacy-login", "/reset-password", "/profile", "/dashboard", "/dashboard/subjects", "/dashboard/resources", "/dashboard/team", "/dashboard/settings", "/dashboard/publish-requests", "/dashboard/storage", "/admin"];
}

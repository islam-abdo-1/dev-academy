import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  publicRoutes,
  seoFor,
  shellRoutes,
  SITE_NAME,
  SITE_URL,
} from "../src/lib/seoRoutes.js";

const appDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(appDir, "..", "dist");
const templatePath = join(distDir, "index.html");

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setMeta(html, attribute, key, content) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta\\s+${attribute}="${escapedKey}"[^>]*>`,
    "i",
  );
  const tag = `<meta ${attribute}="${key}" content="${escapeAttribute(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `${tag}\n</head>`);
}

function setCanonical(html, href) {
  return html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeAttribute(href)}" />`,
  );
}

function removeCanonical(html) {
  return html.replace(/<link\s+rel="canonical"[^>]*>\s*/i, "");
}

function renderMeta(template, pathname, { includeCanonical = true } = {}) {
  const seo = seoFor(pathname);
  const url = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttribute(seo.title)}</title>`);
  html = setMeta(html, "name", "description", seo.description);
  html = setMeta(html, "name", "robots", seo.robots);
  html = setMeta(html, "property", "og:site_name", SITE_NAME);
  html = setMeta(html, "property", "og:title", seo.title);
  html = setMeta(html, "property", "og:description", seo.description);
  html = setMeta(html, "property", "og:url", url);
  html = setMeta(html, "property", "og:image", `${SITE_URL}/og-image.jpg`);
  html = setMeta(html, "name", "twitter:title", seo.title);
  html = setMeta(html, "name", "twitter:description", seo.description);
  html = includeCanonical ? setCanonical(html, url) : removeCanonical(html);
  return html;
}

async function writeRoute(template, pathname) {
  const html = renderMeta(template, pathname);
  if (pathname === "/") {
    await writeFile(join(distDir, "index.html"), html, "utf8");
    return;
  }
  const relative = pathname.replace(/^\//, "");
  const fileTarget = join(distDir, `${relative}.html`);
  const indexTarget = join(distDir, relative, "index.html");
  await mkdir(dirname(fileTarget), { recursive: true });
  await mkdir(dirname(indexTarget), { recursive: true });
  await writeFile(fileTarget, html, "utf8");
  await writeFile(indexTarget, html, "utf8");
}

const template = await readFile(templatePath, "utf8");

for (const route of [...publicRoutes(), ...shellRoutes()]) {
  await writeRoute(template, route);
}

const notFound = renderMeta(template, "/__not_found__", { includeCanonical: false });
await writeFile(join(distDir, "404.html"), notFound, "utf8");

const shareShell = renderMeta(template, "/s/0000000000000000", {
  includeCanonical: false,
});
await writeFile(join(distDir, "app-shell.html"), shareShell, "utf8");

const dashboardShell = renderMeta(template, "/dashboard", {
  includeCanonical: false,
});
await writeFile(join(distDir, "dashboard-shell.html"), dashboardShell, "utf8");

const today = new Date().toISOString().slice(0, 10);
const urls = publicRoutes()
  .map((route) => {
    const loc = `${SITE_URL}${route === "/" ? "/" : route}`;
    const priority = route === "/" ? "1.0" : route.split("/").filter(Boolean).length === 1 ? "0.8" : "0.6";
    const changefreq = route === "/" ? "daily" : route === "/explore" ? "daily" : "weekly";
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
await writeFile(join(distDir, "sitemap.xml"), sitemap, "utf8");

console.log(`Prerendered ${publicRoutes().length} public routes, ${shellRoutes().length} app shells, 404.html, and fallback shells.`);

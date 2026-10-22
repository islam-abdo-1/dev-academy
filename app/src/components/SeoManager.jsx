import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { OG_IMAGE, SITE_NAME, SITE_URL, seoFor } from "@/lib/seoRoutes";

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function upsertAlternate(hreflang, href) {
  let element = document.head.querySelector(
    `link[rel="alternate"][hreflang="${hreflang}"]`,
  );
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "alternate");
    element.setAttribute("hreflang", hreflang);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

export default function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = seoFor(pathname);
    const cleanPath = pathname.replace(/\/+$/, "") || "/";
    const url = `${SITE_URL}${cleanPath === "/" ? "/" : cleanPath}`;

    document.title = seo.title;
    upsertMeta("name", "description", seo.description);
    upsertMeta("name", "robots", seo.robots);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", seo.title);
    upsertMeta("name", "twitter:description", seo.description);
    upsertMeta("name", "twitter:image", OG_IMAGE);
    upsertMeta("name", "twitter:image:alt", "Dev Academy — ديف أكاديمي، شعار المنصة");
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:title", seo.title);
    upsertMeta("property", "og:description", seo.description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", OG_IMAGE);
    upsertMeta("property", "og:image:secure_url", OG_IMAGE);
    upsertMeta("property", "og:image:alt", "Dev Academy — ديف أكاديمي، شعار المنصة");
    upsertCanonical(url);
    upsertAlternate("ar", url);
    upsertAlternate("x-default", url);
  }, [pathname]);

  return null;
}

import { stripHtml } from "./blog-search.mjs";

/** blog.naver.com URL → 모바일 본문 URL */
export function toMobileBlogUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "blog.naver.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `https://m.blog.naver.com/${parts[0]}/${parts[1]}`;
      }
    }
    if (u.hostname === "m.blog.naver.com") return url;
  } catch {
    /* ignore */
  }
  return url;
}

function extractMainText(html) {
  let text = String(html ?? "");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const markers = [
    /<div[^>]*class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="postViewArea"[^>]*>([\s\S]*?)<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
  ];

  for (const re of markers) {
    const m = text.match(re);
    if (m?.[1] && stripHtml(m[1]).length > 120) {
      return stripHtml(m[1]);
    }
  }

  return stripHtml(text);
}

/**
 * 블로그 URL에서 본문 텍스트 추출 (best-effort)
 * @param {string} url
 * @param {{ maxChars?: number }} opts
 */
export async function fetchBlogText(url, opts = {}) {
  const maxChars = opts.maxChars ?? 5000;
  const target = toMobileBlogUrl(url);

  const res = await fetch(target, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    signal: AbortSignal.timeout(10_000),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Fetch blog ${res.status}`);
  }

  const html = await res.text();
  const text = extractMainText(html);
  if (!text || text.length < 40) {
    throw new Error("Blog body too short");
  }

  return text.slice(0, maxChars);
}

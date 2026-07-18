import { stripHtml } from "./blog-search.mjs";

/** 네이버 블로그 UI/내비게이션 노이즈 라인 패턴 */
const NOISE_LINE_PATTERNS = [
  /이웃\s*추가/i,
  /이웃\s*신청/i,
  /^공감\b/i,
  /^댓글\b/i,
  /^구독\b/i,
  /폰트\s*크기/i,
  /글꼴/i,
  /^폰트\b/i,
  /^크기\b/i,
  /본문\s*폰트/i,
  /^본문\s*\.\.\./i,
  /^본문\s*…/i,
  /^인쇄\b/i,
  /URL\s*복사/i,
  /^카테고리\b/i,
  /^태그\b/i,
  /최근\s*댓글/i,
  /블로그\s*홈/i,
  /^네이버\s*블로그/i,
  /blog\.naver\.com/i,
  /^목록\b/i,
  /^이전\s*글/i,
  /^다음\s*글/i,
  /^공유하기/i,
  /^신고/i,
  /^좋아요/i,
  /^스크랩/i,
  /^프로필/i,
  /^전체\s*보기/i,
  /^더보기/i,
  /^맨\s*위로/i,
  /이\s*블로그의\s*체크인/,
  /이\s*장소의\s*다른\s*글/,
];

const PLACE_REGION =
  "서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|[가-힣]+특별자치도|[가-힣]+도|[가-힣]+시";

/**
 * 체크인 위젯에서 상호·주소 추출 (노이즈 제거 전에 호출).
 * 주소는 basicInfo용으로 보존하고, UI 문구만 버린다.
 */
export function extractPlaceHintsFromText(text) {
  const raw = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return { name: "", address: "" };

  const withCheckin = raw.match(
    new RegExp(
      `([가-힣A-Za-z0-9&·.]{2,30})\\s+((?:${PLACE_REGION})\\s+[가-힣]+(?:구|군)\\s+[가-힣0-9]+(?:대로|로|길|번길)(?:\\s*\\d+(?:-\\d+)?)?)\\s*이\\s*블로그의\\s*체크인`,
    ),
  );
  if (withCheckin) {
    return {
      name: withCheckin[1].trim(),
      address: withCheckin[2].replace(/\s+/g, " ").trim(),
    };
  }

  const addrOnly = raw.match(
    new RegExp(
      `((?:${PLACE_REGION})\\s+[가-힣]+(?:구|군)\\s+[가-힣0-9]+(?:대로|로|길|번길)(?:\\s*\\d+(?:-\\d+)?)?)`,
    ),
  );
  return {
    name: "",
    address: addrOnly?.[1]?.replace(/\s+/g, " ").trim() ?? "",
  };
}

/**
 * 네이버 장소/체크인 위젯 UI 문구만 제거.
 * 상호·주소는 남겨 두어 basicInfo 추출에 쓰이게 한다.
 * 예: "…해양로65번길 8 이 블로그의 체크인 이 장소의 다른 글" → 주소 유지
 */
function stripPlaceCheckinNoise(text) {
  return String(text ?? "")
    .replace(/\s*이\s*블로그의\s*체크인(?:\s*이\s*장소의\s*다른\s*글)?/g, " ")
    .replace(/\s*이\s*장소의\s*다른\s*글/g, " ");
}

/** 인라인/줄단위 해시태그 (#맛집, #명지맛집 등) 제거 */
function stripHashtags(text) {
  return String(text ?? "")
    // 연속 해시태그만 있는 줄 제거
    .replace(/(^|\n)(?:\s*#[\w가-힣]+(?:\s+#[\w가-힣]+)*\s*)+(?=\n|$)/g, "\n")
    // 본문 중간의 #태그 제거
    .replace(/#[\w가-힣]+/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 블로그 본문에서 UI 크롬·내비게이션·해시태그 노이즈 제거
 * @param {string} text
 */
export function filterBlogNoise(text) {
  const raw = stripPlaceCheckinNoise(String(text ?? ""));
  const lines = raw.split(/\n/);
  const kept = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 해시태그만으로 구성된 줄은 제외
    if (/^(?:#[\w가-힣]+\s*)+$/.test(trimmed)) continue;

    if (trimmed.length < 4 && !/[가-힣]{2,}/.test(trimmed)) continue;

    let isNoise = false;
    for (const re of NOISE_LINE_PATTERNS) {
      if (re.test(trimmed)) {
        isNoise = true;
        break;
      }
    }
    if (isNoise) continue;

    kept.push(trimmed);
  }

  return stripHashtags(
    stripPlaceCheckinNoise(
      kept
        .join("\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    ),
  );
}

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

/**
 * 여는 태그 위치부터 중첩 div를 균형 매칭해 내부 HTML 반환.
 * 비탐욕 정규식은 첫 </div>에서 끊겨 본문이 짧아지거나 실패함.
 */
function extractBalancedDivInner(html, openMatch) {
  if (!openMatch) return "";
  let i = openMatch.index + openMatch[0].length;
  let depth = 1;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", i);
    const nextClose = html.indexOf("</div>", i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) {
        return html.slice(openMatch.index + openMatch[0].length, nextClose);
      }
      i = nextClose + 6;
    }
  }
  return "";
}

function extractDivInnerByClass(html, className) {
  const openRe = new RegExp(
    `<div\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>`,
    "i",
  );
  return extractBalancedDivInner(html, openRe.exec(html));
}

function extractDivInnerById(html, id) {
  const openRe = new RegExp(
    `<div\\b[^>]*id=["']${id}["'][^>]*>`,
    "i",
  );
  return extractBalancedDivInner(html, openRe.exec(html));
}

/** 네이버 장소/지도(체크인) 모듈 div 제거 — best-effort */
function removeDivsByClass(html, className) {
  const openRe = new RegExp(
    `<div\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>`,
    "i",
  );
  let out = String(html ?? "");
  for (let guard = 0; guard < 30; guard += 1) {
    const m = openRe.exec(out);
    if (!m) break;
    const start = m.index;
    let i = start + m[0].length;
    let depth = 1;
    let end = -1;
    while (i < out.length && depth > 0) {
      const nextOpen = out.indexOf("<div", i);
      const nextClose = out.indexOf("</div>", i);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth += 1;
        i = nextOpen + 4;
      } else {
        depth -= 1;
        if (depth === 0) {
          end = nextClose + 6;
          break;
        }
        i = nextClose + 6;
      }
    }
    if (end < 0) break;
    out = `${out.slice(0, start)} ${out.slice(end)}`;
    openRe.lastIndex = 0;
  }
  return out;
}

function extractParagraphFallback(html) {
  const parts = [];
  const re =
    /class=["'][^"']*se-text-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const t = stripHtml(m[1]).trim();
    if (t) parts.push(t);
  }
  return parts.join("\n");
}

/** 지도/장소 모듈 HTML에서 상호·주소 힌트 추출 (DOM 제거 전) */
function extractPlaceHintsFromHtml(html) {
  const raw = String(html ?? "");
  const chunks = [];
  for (const cls of ["se-module-map", "se-placesMap", "se-map"]) {
    const inner = extractDivInnerByClass(raw, cls);
    if (inner) chunks.push(stripHtml(inner));
  }
  // 본문에도 체크인 문구가 남을 수 있음
  chunks.push(stripHtml(raw).slice(0, 12000));

  let name = "";
  let address = "";
  for (const chunk of chunks) {
    const hints = extractPlaceHintsFromText(chunk);
    if (!name && hints.name) name = hints.name;
    if (!address && hints.address) address = hints.address;
    if (name && address) break;
  }
  return { name, address };
}

function prependPlaceHints(text, hints) {
  const header = [
    hints?.name ? `상호: ${hints.name}` : "",
    hints?.address ? `주소: ${hints.address}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (!header) return text;
  if (String(text ?? "").includes(header)) return text;
  return `${header}\n${text}`.trim();
}

function extractMainText(html) {
  let text = String(html ?? "");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  // 지도 모듈 제거 전에 장소 정보 확보 (주소가 DOM과 함께 사라지지 않게)
  const placeHints = extractPlaceHintsFromHtml(text);

  // 장소/체크인·지도 위젯 DOM 제거 (텍스트 필터 보조)
  for (const cls of ["se-module-map", "se-placesMap", "se-map"]) {
    text = removeDivsByClass(text, cls);
  }

  const candidates = [
    extractDivInnerByClass(text, "se-main-container"),
    extractDivInnerById(text, "postViewArea"),
  ];

  const article = text.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article?.[1]) candidates.push(article[1]);

  candidates.push(extractParagraphFallback(text));

  let best = "";
  for (const chunk of candidates) {
    if (!chunk) continue;
    const cleaned = filterBlogNoise(stripHtml(chunk));
    if (cleaned.length > best.length) best = cleaned;
  }

  if (best.length < 40) {
    // 전체 페이지 strip은 URL/스크립트 노이즈로 본문이 0이 될 수 있어 og 보조
    const og = text.match(
      /property=["']og:description["']\s+content=["']([^"']*)["']/i,
    );
    if (og?.[1]) {
      const ogText = filterBlogNoise(stripHtml(og[1]));
      if (ogText.length > best.length) best = ogText;
    }
  }

  return prependPlaceHints(best, placeHints);
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

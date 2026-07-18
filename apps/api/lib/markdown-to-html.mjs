/**
 * 맛집/블로그 마크다운 → WordPress용 HTML (의존성 없이 최소 변환)
 * post-3 스타일: h4 소제목, 문단, 목록, 클릭 가능한 링크
 */

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url ?? "").trim());
}

/** 인라인: 이미지 → 링크 → 굵게 */
function formatInline(raw) {
  let s = String(raw ?? "");
  const tokens = [];

  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const u = String(url).trim();
    if (!isHttpUrl(u)) return "";
    const i = tokens.length;
    tokens.push(
      `<figure class="wp-block-image"><img src="${escapeHtml(u)}" alt="${escapeHtml(alt)}" /></figure>`,
    );
    return `\u0000T${i}\u0000`;
  });

  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    const u = String(url).trim();
    if (!isHttpUrl(u)) return escapeHtml(text);
    const i = tokens.length;
    tokens.push(
      `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`,
    );
    return `\u0000T${i}\u0000`;
  });

  s = escapeHtml(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\u0000T(\d+)\u0000/g, (_, i) => tokens[Number(i)] ?? "");
  return s;
}

function headingTag(level, text) {
  const lv = Math.min(Math.max(level, 2), 4);
  const tag = `h${lv}`;
  return `<${tag}>${formatInline(text)}</${tag}>`;
}

/**
 * @param {string} markdown
 * @returns {string} HTML
 */
export function markdownToHtml(markdown) {
  let src = String(markdown ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!src) return "";

  // 한 줄에 붙은 ✔ 맛 ★… ✔ 가격 ★… → 줄 분리 후 목록으로
  src = src.replace(
    /([^\n])\s*([✔✓])\s*(맛|가격|서비스|청결|재방문의사)\s*([★☆]+)/g,
    "$1\n$2 $3 $4",
  );
  src = src.replace(
    /([✔✓]\s*(?:맛|가격|서비스|청결|재방문의사)\s*[★☆]+)\s+(?=[✔✓])/g,
    "$1\n",
  );
  src = src.replace(
    /^([-*•]?\s*[✔✓]\s*(?:맛|가격|서비스|청결|재방문의사)\s*[★☆]+)\s+([^✔✓\n★☆].+)$/gm,
    "$1\n\n$2",
  );
  // 별점 줄을 마크다운 리스트로
  src = src
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (/^[✔✓]\s*(?:맛|가격|서비스|청결|재방문의사)\s*[★☆]+/.test(t)) {
        return `- ${t}`;
      }
      return line;
    })
    .join("\n");

  const lines = src.split("\n");
  const out = [];
  let i = 0;
  let para = [];
  let listItems = [];
  let inQuote = false;
  let quoteLines = [];

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ").trim();
    para = [];
    if (text) out.push(`<p>${formatInline(text)}</p>`);
  };

  const flushList = () => {
    if (!listItems.length) return;
    out.push(
      `<ul>\n${listItems.map((t) => `  <li>${formatInline(t)}</li>`).join("\n")}\n</ul>`,
    );
    listItems = [];
  };

  const flushQuote = () => {
    if (!inQuote) return;
    inQuote = false;
    const text = quoteLines.join(" ").trim();
    quoteLines = [];
    if (text) out.push(`<blockquote><p>${formatInline(text)}</p></blockquote>`);
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushPara();
      flushList();
      flushQuote();
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushPara();
      flushList();
      flushQuote();
      // WP 테마에서 H1/H2가 과하게 큼 → 본문 소제목은 h4로 맞춤 (post-3 스타일)
      const level = heading[1].length;
      const htmlLevel = level <= 2 ? 4 : Math.min(level, 4);
      out.push(headingTag(htmlLevel, heading[2].trim()));
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushPara();
      flushList();
      flushQuote();
      out.push("<hr />");
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushPara();
      flushList();
      inQuote = true;
      quoteLines.push(trimmed.replace(/^>\s?/, ""));
      i += 1;
      continue;
    }

    if (inQuote) {
      flushQuote();
    }

    const list = /^[-*•]\s+(.+)$/.exec(trimmed);
    if (list) {
      flushPara();
      listItems.push(list[1]);
      i += 1;
      continue;
    }

    // ✔ 맛 ★★★★★ 단독 줄 → 목록
    if (/^[✔✓]\s*(?:맛|가격|서비스|청결|재방문의사)\s*[★☆]+/.test(trimmed)) {
      flushPara();
      listItems.push(trimmed);
      i += 1;
      continue;
    }

    if (listItems.length) flushList();

    // 단독 이미지 줄
    const onlyImg = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (onlyImg) {
      flushPara();
      const html = formatInline(trimmed);
      if (html) out.push(html);
      i += 1;
      continue;
    }

    para.push(trimmed);
    i += 1;
  }

  flushPara();
  flushList();
  flushQuote();

  return out.join("\n\n");
}

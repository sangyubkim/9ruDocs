/** AI 글쓰기 메타(슬러그·요약·이미지 설명) 정규화 */

export function slugifyTitle(title) {
  const ascii = String(title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return ascii || `post-${Date.now()}`;
}

/**
 * LLM JSON / fallback에서 공통 메타 필드를 안전하게 꺼낸다.
 * 대표 이미지는 앱 사진 사용 — imagePath는 만들지 않음.
 */
export function normalizeAiMeta(parsed, fallbackTitle = "") {
  const title = String(parsed?.title ?? fallbackTitle ?? "").trim() || "제목 없음";
  const excerpt = String(parsed?.excerpt ?? "").trim().slice(0, 200);
  const suggestedTags = Array.isArray(parsed?.suggestedTags)
    ? parsed.suggestedTags.map(String).map((t) => t.trim()).filter(Boolean).slice(0, 8)
    : [];
  const slugRaw = String(parsed?.slug ?? "").trim().toLowerCase();
  const slug =
    slugRaw
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || slugifyTitle(title);

  return {
    title,
    body: String(parsed?.body ?? ""),
    excerpt,
    suggestedTags,
    slug,
    imagePrompt: String(parsed?.imagePrompt ?? "").trim(),
    imageAlt: String(parsed?.imageAlt ?? "").trim(),
    imageCaption: String(parsed?.imageCaption ?? "").trim(),
  };
}

/** Gemini/OpenAI JSON 스키마 안내 문구 (프롬프트에 삽입) */
export const AI_META_JSON_FIELDS = `"slug": "english-kebab-case-slug",
  "excerpt": "검색/카드용 120~160자 요약",
  "suggestedTags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
  "imagePrompt": "English prompt for 16:9 editorial workspace image, no text or logo",
  "imageAlt": "접근성용 대체 텍스트 (한국어)",
  "imageCaption": "본문 아래 캡션 (한국어)"`;

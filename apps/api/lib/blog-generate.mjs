import { completeJson, hasLlmConfigured } from "./llm.mjs";

/** Google Maps URL (API 키 불필요) */
export function buildGoogleSearchUrl(query) {
  const q = encodeURIComponent(String(query ?? "").trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function buildGoogleLatLngUrl(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** @deprecated buildGoogleSearchUrl */
export const buildNaverSearchUrl = buildGoogleSearchUrl;

/** @deprecated buildGoogleLatLngUrl */
export const buildNaverLatLngUrl = buildGoogleLatLngUrl;

export function resolveMapsUrl(loc) {
  if (!loc) return "";
  const existing = String(loc.mapsUrl ?? "").trim();
  if (
    existing &&
    (existing.includes("google.com/maps") || existing.includes("maps.google.com")) &&
    !existing.includes("map.naver.com")
  ) {
    return existing;
  }
  const label = String(loc.label ?? "").trim();
  if (loc.latitude != null && loc.longitude != null) {
    return buildGoogleLatLngUrl(loc.latitude, loc.longitude);
  }
  if (label) return buildGoogleSearchUrl(label);
  return existing;
}

const DEFAULTS = {
  persona: "친근한 블로거",
  target: "같은 관심사를 가진 독자",
  keywords: "일상, 기록",
  toneLabel: "친근하고 솔직한",
  personalTips: "단계별로 직접 해본 경험",
  cta: "댓글로 여러분의 경험도 공유해 주세요",
};

function toneLabelFromCode(tone) {
  if (tone === "professional") return "전문적이고 차분한";
  return DEFAULTS.toneLabel;
}

function extractKeywordsFromSteps(steps) {
  const words = steps
    .flatMap((s) =>
      String(s.caption ?? "")
        .split(/[\s,，、·]+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2),
    )
    .slice(0, 8);
  return [...new Set(words)].slice(0, 5).join(", ") || DEFAULTS.keywords;
}

function extractPersonalTipsFromSteps(steps) {
  const tips = steps
    .map((s) => String(s.caption ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
  return tips.length ? tips.join(" / ") : DEFAULTS.personalTips;
}

/** 요청 본문 + 단계에서 글쓰기 컨텍스트 추출 */
export function buildWritingContext(body, steps) {
  const toneCode = body?.tone === "professional" ? "professional" : "friendly";
  return {
    persona: String(body?.persona ?? "").trim() || DEFAULTS.persona,
    target: String(body?.target ?? "").trim() || DEFAULTS.target,
    keywords:
      String(body?.keywords ?? "").trim() ||
      extractKeywordsFromSteps(steps),
    toneLabel:
      String(body?.toneLabel ?? "").trim() || toneLabelFromCode(toneCode),
    personalTips:
      String(body?.personalTips ?? "").trim() ||
      extractPersonalTipsFromSteps(steps),
    cta: String(body?.cta ?? "").trim() || DEFAULTS.cta,
    toneCode,
  };
}

/** 모델 지시용 한국어 페르소나 프롬프트 문장 */
export function buildPersonaInstruction(ctx) {
  return `**[${ctx.persona}]**로서 **[${ctx.target}]**을 위해 **[${ctx.keywords}]**를 넣어 **[${ctx.toneLabel}]** 톤으로 글을 써줘. 특히 **[${ctx.personalTips}]**을 강조하고 마지막엔 **[${ctx.cta}]**를 포함해줘.`;
}

export async function generateBlogPost(body, env) {
  const steps = Array.isArray(body?.steps) ? body.steps : [];

  if (steps.length === 0) {
    throw new Error("steps is required");
  }

  const sorted = [...steps].sort(
    (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0),
  );

  const writingContext = buildWritingContext(body, sorted);

  if (hasLlmConfigured(env)) {
    return generateWithLlm(sorted, writingContext, env);
  }

  return generateFallback(sorted, writingContext);
}

function formatStepForPrompt(s, index) {
  const cap = String(s.caption ?? "").trim() || "(설명 없음)";
  const loc = s.location;
  if (!loc?.label && !loc?.mapsUrl && loc?.latitude == null) {
    return `${index + 1}. ${cap}`;
  }
  const label = String(loc.label ?? "위치").trim();
  const url = resolveMapsUrl(loc);
  const coords =
    loc.latitude != null && loc.longitude != null
      ? ` (${loc.latitude}, ${loc.longitude})`
      : "";
  return `${index + 1}. ${cap}\n   위치: ${label}${coords}${url ? `\n   구글 지도: ${url}` : ""}`;
}

function locationMarkdown(loc) {
  if (!loc || (!loc.mapsUrl && !loc.label && loc.latitude == null)) return "";
  const url = resolveMapsUrl(loc);
  const text = String(loc.label ?? "구글 지도에서 보기").trim() || "구글 지도에서 보기";
  return `\n\n📍 [${text}](${url})\n`;
}

async function generateWithLlm(steps, ctx, env) {
  const stepText = steps.map((s, i) => formatStepForPrompt(s, i)).join("\n");
  const personaLine = buildPersonaInstruction(ctx);

  const system = `당신은 한국어 블로그 작가입니다. Markdown으로 구조화된 글을 작성합니다.
위치가 있으면 반드시 Google Maps(https://www.google.com/maps) 링크만 사용하세요. 네이버 지도 링크는 쓰지 마세요.
각 단계 위치는 [장소명](구글지도URL) 형태로 본문에 넣으세요.`;

  const user = `${personaLine}

아래 단계 메모를 바탕으로 블로그 글을 작성해 주세요.

단계:
${stepText}

JSON만 반환하세요:
{
  "title": "제목",
  "body": "Markdown 본문",
  "excerpt": "2~3문장 요약",
  "suggestedTags": ["태그1", "태그2"]
}`;

  const { data: parsed } = await completeJson(env, system, user, {
    temperature: 0.7,
  });
  return {
    title: String(parsed.title ?? "제목 없음"),
    body: String(parsed.body ?? ""),
    excerpt: String(parsed.excerpt ?? ""),
    suggestedTags: Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags.map(String)
      : [],
  };
}

function generateFallback(steps, ctx) {
  const intro =
    ctx.toneCode === "professional"
      ? `${ctx.persona}의 시각에서 ${ctx.target}에게 전달하는 정리 글입니다.`
      : `안녕하세요! ${ctx.persona}입니다. ${ctx.target}분께 오늘 경험을 나눠 볼게요.`;

  const sections = steps
    .map((s, i) => {
      const cap = String(s.caption ?? "").trim() || "내용을 추가해 주세요.";
      return `## ${i + 1}단계\n\n${cap}${locationMarkdown(s.location)}`;
    })
    .join("\n");

  const title =
    String(steps[0]?.caption ?? "").trim().slice(0, 40) || "나의 작업 기록";

  const body = `# ${title}\n\n${intro}\n\n${sections}\n\n---\n\n${ctx.cta}`;
  const excerpt =
    String(steps[0]?.caption ?? "").trim().slice(0, 160) || intro;

  const tags = (ctx.keywords || DEFAULTS.keywords)
    .split(/[,，、]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    title,
    body,
    excerpt,
    suggestedTags: tags.length ? tags : ["일상", "기록"],
  };
}

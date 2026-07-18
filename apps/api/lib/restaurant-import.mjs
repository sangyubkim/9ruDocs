import {
  buildRestaurantSearchQueries,
  searchNaverBlogs,
  stripHtml,
} from "./blog-search.mjs";
import { fetchBlogText, filterBlogNoise } from "./blog-fetch.mjs";

const DEFAULT_BASIC = {
  name: "",
  address: "",
  hours: "",
  phone: "",
  parking: "",
  reservation: "",
};

const DEFAULT_SECTIONS = {
  intro: `안녕하세요 :)

오늘은 {region}에 위치한 {restaurantName}에 다녀왔습니다.
평소 {mainMenu}가 유명하다고 해서 방문했는데,
직접 먹어보니 왜 인기가 많은지 알겠더라고요.

주차, 분위기, 메뉴, 가격, 맛까지 솔직하게 리뷰해보겠습니다.`,
  atmosphere: `매장에 들어가자마자 깔끔한 인테리어가 눈에 들어왔습니다.

테이블 간격도 넓어서 식사하기 편했고,
가족모임, 데이트, 친구들과 방문하기에도 좋은 분위기였습니다.

직원분들도 친절하게 안내해 주셔서 첫인상이 좋았습니다.`,
  menu: `메뉴는 생각보다 다양했습니다.

저희는
✔ {mainMenu}
✔ 사이드 메뉴
✔ 음료

이렇게 주문했습니다.
가격도 전체적으로 부담 없는 편이었습니다.`,
  foodReview: `가장 먼저 나온 {mainMenu}.

비주얼부터 먹음직스러웠고
향도 정말 좋았습니다.

한입 먹어보니
쫀득한 식감과
깊은 풍미,
적당한 간,
신선한 재료

모두 만족스러웠습니다.

특히 {restaurantName}만의 조리법이 인상적이었습니다.

같이 나온 반찬이나 소스와 함께 먹으면 더욱 맛있었습니다.`,
  summary: `전체적으로 만족도가 높은 식사였습니다.

- ✔ 맛 ★★★★★
- ✔ 가격 ★★★★☆
- ✔ 서비스 ★★★★★
- ✔ 청결 ★★★★★
- ✔ 재방문의사 ★★★★★

{region}에서 맛있는 {mainMenu}를 찾는다면
한 번 방문해 보시는 것을 추천드립니다.`,
  closing: `오늘도 끝까지 읽어주셔서 감사합니다.

다음에도 솔직한 맛집 리뷰로 찾아오겠습니다.`,
};

function fillTemplate(text, vars) {
  return String(text)
    .replace(/\{region\}/g, vars.region)
    .replace(/\{restaurantName\}/g, vars.restaurantName)
    .replace(/\{mainMenu\}/g, vars.mainMenu || "대표 메뉴");
}

function stripFieldGuides(value) {
  const guides = ["[지역]", "[맛집명]", "[대표메뉴]"];
  let v = String(value ?? "").trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const guide of guides) {
      if (v.startsWith(guide)) {
        v = v.slice(guide.length).trimStart();
        changed = true;
      }
    }
  }
  return v;
}

function parseVars(body) {
  const region = stripFieldGuides(body?.region);
  const restaurantName = stripFieldGuides(body?.restaurantName);
  const mainMenu = stripFieldGuides(body?.mainMenu) || "대표 메뉴";
  return { region, restaurantName, mainMenu };
}

function formatOpenAiResult(parsed, vars, meta = {}) {
  const sections = parsed.sections ?? {};
  const basic = parsed.basicInfo ?? {};
  let basicInfo = {
    name: String(basic.name ?? vars.restaurantName),
    address: String(basic.address ?? ""),
    hours: String(basic.hours ?? ""),
    phone: String(basic.phone ?? ""),
    parking: String(basic.parking ?? ""),
    reservation: String(basic.reservation ?? ""),
  };

  // AI가 비우거나 모호하게 쓴 필드는 본문 패턴 추출로 보강
  const hintSource = String(meta?.hintSource ?? "").trim();
  if (hintSource) {
    basicInfo = mergeBasicInfoWithHints(basicInfo, hintSource, vars);
  }

  const rawSections = {
    intro: String(sections.intro ?? DEFAULT_SECTIONS.intro),
    atmosphere: String(sections.atmosphere ?? DEFAULT_SECTIONS.atmosphere),
    menu: String(sections.menu ?? DEFAULT_SECTIONS.menu),
    foodReview: String(sections.foodReview ?? DEFAULT_SECTIONS.foodReview),
    summary: String(sections.summary ?? DEFAULT_SECTIONS.summary),
    closing: String(sections.closing ?? DEFAULT_SECTIONS.closing),
  };

  return {
    title: String(parsed.title ?? buildImportTitle(vars)),
    region: vars.region,
    restaurantName: vars.restaurantName,
    mainMenu: vars.mainMenu,
    basicInfo,
    // 주소·영업시간 등은 basicInfo에만 — 섹션 본문 중복·도입부 헤딩 제거
    sections: stripSectionsBasicInfo(rawSections, [
      vars.restaurantName,
      basicInfo.name,
    ]),
    excerpt: String(parsed.excerpt ?? ""),
    suggestedTags: Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags.map(String)
      : [vars.region, "맛집", vars.restaurantName],
    geocodeHint: buildGeocodeHint(basicInfo, vars),
    ...Object.fromEntries(
      Object.entries(meta).filter(([k]) => k !== "hintSource"),
    ),
  };
}

function buildImportTitle(vars) {
  const region = vars.region.trim();
  let name = vars.restaurantName
    .trim()
    .replace(/\s*맛집\s*후기\s*$/i, "")
    .trim();

  if (region) {
    while (name.startsWith(region)) {
      name = name.slice(region.length).trimStart();
    }
    const re = new RegExp(`^${region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
    name = name.replace(re, "").trim();
  }

  if (!name) name = vars.restaurantName.trim();
  return `${region ? `${region} ` : ""}${name} 맛집 후기`
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackImport(body, meta = {}) {
  const vars = parseVars(body);
  const title = buildImportTitle(vars);

  return {
    title,
    region: vars.region,
    restaurantName: vars.restaurantName,
    mainMenu: vars.mainMenu,
    basicInfo: {
      name: vars.restaurantName,
      address: `${vars.region} (방문 후 확인)`,
      hours: "영업시간은 방문 전 전화 확인을 권장합니다.",
      phone: "",
      parking: "매장 주변 주차 가능 여부는 방문 시 확인해 주세요.",
      reservation: "전화 또는 네이버 예약 가능 여부를 확인해 주세요.",
    },
    sections: {
      intro: fillTemplate(DEFAULT_SECTIONS.intro, vars),
      atmosphere: fillTemplate(DEFAULT_SECTIONS.atmosphere, vars),
      menu: fillTemplate(DEFAULT_SECTIONS.menu, vars),
      foodReview: fillTemplate(DEFAULT_SECTIONS.foodReview, vars),
      summary: fillTemplate(DEFAULT_SECTIONS.summary, vars),
      closing: fillTemplate(DEFAULT_SECTIONS.closing, vars),
    },
    excerpt: `${vars.region} ${vars.restaurantName} 방문 후기. ${vars.mainMenu} 중심으로 분위기·가격·맛을 정리했습니다.`,
    suggestedTags: [
      vars.region,
      vars.restaurantName,
      "맛집",
      vars.mainMenu,
      "맛집후기",
    ].filter(Boolean),
    sources: [],
    importMeta: {
      mode: "template",
      searchedQuery: meta.searchedQuery ?? "",
      sourceCount: 0,
      message:
        meta.message ??
        "블로그 검색 없이 기본 템플릿으로 채웠습니다.",
    },
  };
}

async function callOpenAiJson(env, system, user) {
  const res = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature: 0.65,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");
  return JSON.parse(content);
}

const JSON_SCHEMA_HINT = `JSON만 반환:
{
  "title": "블로그 제목",
  "basicInfo": {
    "name": "상호명 (참고 글의 상호/가게명)",
    "address": "도로명·지번 주소 (참고 글에 있으면 그대로 추출, 없으면 짧은 안내)",
    "hours": "영업시간 (영업시간/운영시간/매일 HH:MM 등 있으면 추출)",
    "phone": "전화번호 (02-/051-/010- 등 있으면 추출, 없으면 빈 문자열)",
    "parking": "주차 안내 (주차/발렛/공용주차장 언급 있으면 추출)",
    "reservation": "예약 안내"
  },
  "sections": {
    "intro": "도입부 (주소·영업시간·연락처·주차·상호 라벨 블록 금지)",
    "atmosphere": "매장 분위기 (기본정보 라벨 블록 금지)",
    "menu": "메뉴 소개 (기본정보 라벨 블록 금지)",
    "foodReview": "음식 리뷰만 (■ 위치/영업시간/연락처/주차 블록 절대 금지)",
    "summary": "별점 포함 총평. ✔ 맛/가격/서비스/청결/재방문의사는 각 항목마다 반드시 새 줄 (한 줄에 나열 금지)",
    "closing": "마무리 인사"
  },
  "excerpt": "2~3문장 SEO 요약",
  "suggestedTags": ["태그1", "태그2"]
}

중요: 상호·주소·영업시간·연락처·주차는 basicInfo에만 넣고, sections 본문에는 같은 정보를 반복하지 마세요.`;

async function importWithOpenAiOnly(body, env) {
  const vars = parseVars(body);

  const system = `당신은 한국어 네이버 블로그 맛집 리뷰 작가입니다.
인기 맛집 블로그의 구조와 톤을 참고하되, 문장은 새로 작성합니다.
솔직한 1인칭 후기 톤, 이모지는 섹션 제목 외 최소화.
상호·주소·영업시간·연락처·주차는 basicInfo에만 두고 sections(도입부·음식 리뷰 등)에는 넣지 마세요.`;

  const user = `다음 맛집 블로그 초안을 작성해 주세요.

- 지역: ${vars.region}
- 맛집명: ${vars.restaurantName}
- 대표메뉴: ${vars.mainMenu}

${JSON_SCHEMA_HINT}`;

  const parsed = await callOpenAiJson(env, system, user);
  return formatOpenAiResult(parsed, vars, {
    sources: [],
    importMeta: {
      mode: "ai-only",
      searchedQuery: "",
      sourceCount: 0,
      message: "블로그 검색 없이 AI로 초안을 생성했습니다.",
    },
  });
}

function takeExcerpt(text, maxChars = 500) {
  const cleaned = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxChars) return cleaned;
  const cut = cleaned.slice(0, maxChars);
  const lastBreak = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
    cut.lastIndexOf("。"),
  );
  if (lastBreak > maxChars * 0.45) return `${cut.slice(0, lastBreak + 1).trim()}…`;
  return `${cut.trim()}…`;
}

/** 기본정보 카드/라벨 줄 여부 (상호·주소·영업시간·연락처·주차 등) */
function isBasicInfoLine(line) {
  const t = String(line ?? "").trim();
  if (!t) return false;
  // 📝 ■ 위치 / 영업시간 / 연락처 / 주차
  if (
    /^(?:📝\s*)?(?:■\s*)?(?:위치|영업\s*시간|연락처|주차|기본\s*정보|매장\s*정보)(?:\s*[\/·|,]\s*(?:위치|영업\s*시간|연락처|주차|기본\s*정보|매장\s*정보))+/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/^(?:📝\s*)?■\s*(?:위치|영업\s*시간|연락처|주차|기본\s*정보|매장\s*정보)/i.test(t)) {
    return true;
  }
  // 📍 상호명 : … / 주소: … / 전화 02-…
  if (
    /^(?:📝|📍|🕒|☎️|🚗|💳|■)?\s*(?:상호(?:명)?|매장명|가게명|식당명|주소|위치|매장\s*위치|가게\s*위치|영업\s*시간|운영\s*시간|연락처|전화(?:번호)?|TEL|Tel|주차(?:\s*안내|\s*정보|장)?|예약(?:\s*가능\s*여부)?)\s*[:：]/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/^(?:전화|연락처|TEL|Tel)\s*[:.：]?\s*0\d/i.test(t)) return true;
  return false;
}

/**
 * 섹션/스니펫 본문에서 기본정보 블록 제거.
 * 추출값은 basicInfo 필드에만 두고, 리뷰 서술 문장은 유지.
 */
export function stripBasicInfoBlocksFromText(text) {
  const lines = String(text ?? "").split(/\n/);
  const kept = [];
  for (const line of lines) {
    if (isBasicInfoLine(line)) continue;
    // 한 줄에 라벨이 연쇄된 경우 (주소: … 영업시간: …)
    const strippedInline = String(line).replace(
      /(?:^|\s)(?:📝|📍|🕒|☎️|🚗|■)?\s*(?:상호(?:명)?|매장명|가게명|주소|위치|영업\s*시간|운영\s*시간|연락처|전화(?:번호)?|TEL|주차(?:장)?|예약)\s*[:：]\s*[^|\n]{0,80}/gi,
      " ",
    );
    if (!strippedInline.trim() || isBasicInfoLine(strippedInline)) continue;
    kept.push(strippedInline.replace(/[ \t]{2,}/g, " ").trimEnd());
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** ■메뉴 ■외부사진 등 사진/섹션 placeholder 제거 */
export function stripPhotoPlaceholders(text) {
  let s = String(text ?? "");
  s = s.replace(
    /(?:■\s*(?:메뉴|외부\s*사진|내부\s*사진|사진|위치|주차|연락처|영업\s*시간|분위기|음식|리뷰)\s*)+/gi,
    " ",
  );
  s = s.replace(/■\s*[가-힣A-Za-z0-9]{1,12}(?=\s|$|■)/g, " ");
  s = s
    .split("\n")
    .filter((line) => {
      const t = line.replace(/[■\s]/g, "").trim();
      return t.length > 0;
    })
    .join("\n");
  return s.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const SECTION_META_HEADING_RE =
  /^(?:#{1,3}\s*)?(?:\d+\.\s*)?(?:도입부|기본\s*정보|매장\s*정보|매장\s*분위기|분위기|메뉴\s*소개|메뉴|음식\s*리뷰|총평|마무리)\s*$/i;

function collectNameVariants(...names) {
  const out = [];
  for (const raw of names) {
    const n = String(raw ?? "").trim();
    if (n.length < 2) continue;
    out.push(n);
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      if (last.length >= 2) out.push(last);
    }
  }
  return [...new Set(out)];
}

function isNameOnlyHeading(line, names) {
  const t = String(line ?? "")
    .trim()
    .replace(/^#{1,3}\s*/, "")
    .trim();
  if (!t || t.length > 40) return false;
  return names.some((n) => t === n);
}

/** 「도입부」·상호명 단독 헤딩 제거 */
export function stripSectionDecorations(text, nameHints = []) {
  const names = collectNameVariants(...nameHints);
  const lines = String(text ?? "").split("\n");
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      kept.push(line);
      continue;
    }
    if (SECTION_META_HEADING_RE.test(trimmed)) continue;
    if (isNameOnlyHeading(trimmed, names)) continue;
    kept.push(line);
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeCompareText(s) {
  return String(s ?? "")
    .replace(/\s+/g, "")
    .replace(/[.,!?。…~·\-–—'"“”‘’]/g, "")
    .toLowerCase();
}

/** intro와 겹치는 문단/문장 제거 */
export function dedupeTextAgainstReference(text, reference) {
  const src = String(text ?? "").trim();
  const ref = String(reference ?? "").trim();
  if (!src || !ref) return src;
  const refNorm = normalizeCompareText(ref);
  if (!refNorm) return src;
  const minLen = 10;

  const paragraphs = src.split(/\n{2,}/);
  const keptParas = [];
  for (const para of paragraphs) {
    const pNorm = normalizeCompareText(para);
    if (pNorm.length >= minLen && refNorm.includes(pNorm)) continue;

    const sentences = para
      .split(/(?<=[.!?。])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length <= 1) {
      if (pNorm.length >= minLen && refNorm.includes(pNorm)) continue;
      keptParas.push(para.trim());
      continue;
    }
    const keptSentences = sentences.filter((s) => {
      const n = normalizeCompareText(s);
      if (n.length < minLen) return true;
      return !refNorm.includes(n);
    });
    if (keptSentences.length === 0) continue;
    keptParas.push(
      keptSentences.length === sentences.length
        ? para.trim()
        : keptSentences.join("\n\n"),
    );
  }
  return keptParas.join("\n\n").trim();
}

function cleanSectionText(text, nameHints = []) {
  let cleaned = stripSectionDecorations(
    stripBasicInfoBlocksFromText(stripPhotoPlaceholders(text)),
    nameHints,
  );
  // 가로로 붙은 별점 → 세로 줄
  cleaned = cleaned.replace(
    /([^\n])\s*([✔✓])\s*(맛|가격|서비스|청결|재방문의사)\s*([★☆]+)/g,
    "$1\n$2 $3 $4",
  );
  cleaned = cleaned.replace(
    /([✔✓]\s*(?:맛|가격|서비스|청결|재방문의사)\s*[★☆]+)\s+(?=[✔✓])/g,
    "$1\n",
  );
  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

function stripSectionsBasicInfo(sections, nameHints = []) {
  const out = {};
  for (const [key, value] of Object.entries(sections ?? {})) {
    out[key] = cleanSectionText(String(value ?? ""), nameHints);
  }
  if (out.intro && out.foodReview) {
    out.foodReview = dedupeTextAgainstReference(out.foodReview, out.intro);
  }
  return out;
}

function pickSentences(text, keywords, max = 4) {
  const parts = String(text ?? "")
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
  const keys = keywords.filter(Boolean);
  const matched = parts.filter((s) =>
    keys.some((k) => s.includes(k)),
  );
  const picked = (matched.length > 0 ? matched : parts).slice(0, max);
  if (picked.length === 0) return "";
  return `${picked.join("\n\n")}${/[.!?。]$/.test(picked.at(-1) ?? "") ? "" : "."}`;
}

function isVagueBasicField(value, kind = "generic") {
  const v = String(value ?? "").trim();
  if (!v) return true;
  if (/방문\s*(?:전|후)\s*확인|참고|블로그|권장합니다|확인해\s*주세요/i.test(v)) {
    return true;
  }
  if (kind === "address" && v.length < 8) return true;
  if (kind === "hours" && v.length < 5) return true;
  return false;
}

/** 네이버 본문의 ZWSP 등을 줄바꿈으로 바꿔 라벨 추출이 끊기게 함 */
function normalizeForBasicExtract(text) {
  return String(text ?? "")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function takeUntilNextLabel(value) {
  return String(value ?? "")
    .split(
      /\s*(?=(?:전화|연락처|TEL|영업\s*시간|운영\s*시간|주차(?:장)?|주소|위치|예약|상호|매장명|가게명)\s*[:：])/i,
    )[0]
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[,.]$/, "")
    .trim();
}

function looksLikeStoreName(name) {
  const n = String(name ?? "").trim();
  if (n.length < 2 || n.length > 30) return false;
  if (/[?]/.test(n)) return false;
  if (/추천|검색|다를|브레이크|하세요|입니다|있어요|맛집\s*후기/i.test(n)) {
    return false;
  }
  if ((n.match(/\s/g) || []).length >= 4) return false;
  return true;
}

function extractBasicHints(combined, vars) {
  const text = normalizeForBasicExtract(combined);

  const nameLabeled =
    text.match(
      /(?:^|\n)\s*(?:상호(?:명)?|매장명|가게\s*이름|가게명|식당명)\s*[:：]\s*([^\n|#]{2,40})/im,
    )?.[1]?.trim() ?? "";
  const name = looksLikeStoreName(takeUntilNextLabel(nameLabeled))
    ? takeUntilNextLabel(nameLabeled)
    : "";

  const phone =
    text.match(
      /(?:전화|연락처|TEL|Tel|T)\s*[:.：]?\s*(0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4})/i,
    )?.[1] ??
    text.match(/(?<![\d])(0\d{1,2}[-\s.]\d{3,4}[-\s.]\d{4})(?![\d])/)?.[1] ??
    text.match(/(?<![\d])(01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})(?![\d])/)?.[1] ??
    "";

  const hoursLabeled = takeUntilNextLabel(
    text.match(
      /(?:영업\s*시간|운영\s*시간|영업시간|운영시간)\s*[:：]?\s*([^\n]{4,80})/i,
    )?.[1] ?? "",
  );
  const hoursDay = takeUntilNextLabel(
    text.match(
      /(?:매일|연중무휴|평일|주말|월\s*[~～\-]\s*[금토일]|화\s*[~～\-]\s*일)[^\n]{0,10}\d{1,2}\s*[:：]\s*\d{2}[^\n]{0,40}/i,
    )?.[0] ?? "",
  );
  const hoursRange =
    text.match(
      /\d{1,2}\s*[:：]\s*\d{2}\s*[-~～]\s*\d{1,2}\s*[:：]\s*\d{2}/,
    )?.[0]?.trim() ?? "";
  let hours = hoursLabeled || hoursDay || hoursRange;
  if (hours.length > 60) hours = hours.slice(0, 60).trim();

  const address = extractKoreanAddress(text, vars) ?? "";

  const parkingColon = takeUntilNextLabel(
    text.match(
      /(?:주차(?:\s*안내|\s*정보|장)?|발렛(?:\s*주차)?|공용\s*주차장)\s*[:：]\s*([^\n|#]{2,40})/i,
    )?.[1] ?? "",
  );
  const parkingShort =
    text.match(
      /(?:주차\s*(?:가능|불가|무료|유료|편리|협소|어려움)|발렛\s*(?:가능|운영)|공용\s*주차장(?:\s*이용)?(?:\s*가능)?)/i,
    )?.[0]?.trim() ?? "";
  let parking = parkingColon || parkingShort;
  if (
    parking.length > 40 ||
    /맛집|여행|후기|블로그|T맵|네이버\s*지도|#/.test(parking)
  ) {
    parking = parkingShort && parkingShort.length <= 30 ? parkingShort : "";
  }

  return {
    name,
    phone: String(phone).replace(/\s+/g, "-").replace(/\./g, "-"),
    hours,
    address,
    parking,
  };
}

function mergeBasicInfoWithHints(basicInfo, combined, vars) {
  const hints = extractBasicHints(combined, vars);
  const cur = basicInfo ?? {};
  return {
    name:
      (!isVagueBasicField(cur.name) ? String(cur.name).trim() : "") ||
      hints.name ||
      vars.restaurantName,
    address:
      (!isVagueBasicField(cur.address, "address")
        ? String(cur.address).trim()
        : "") ||
      hints.address ||
      String(cur.address ?? "").trim(),
    hours:
      (!isVagueBasicField(cur.hours, "hours")
        ? String(cur.hours).trim()
        : "") ||
      hints.hours ||
      String(cur.hours ?? "").trim(),
    phone:
      (!isVagueBasicField(cur.phone) ? String(cur.phone).trim() : "") ||
      hints.phone ||
      "",
    parking:
      (!isVagueBasicField(cur.parking) ? String(cur.parking).trim() : "") ||
      hints.parking ||
      String(cur.parking ?? "").trim(),
    reservation: String(cur.reservation ?? "").trim(),
  };
}

const KOREAN_REGIONS =
  "서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주";

function extractKoreanAddress(combined, vars) {
  const text = String(combined ?? "");

  const labeled =
    text.match(
      /(?:주소|위치|address|매장\s*위치|가게\s*위치)\s*[:：]?\s*([^\n|#]{6,100})/i,
    )?.[1]?.trim() ?? "";

  const regionEsc = String(vars?.region ?? "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regionPart = regionEsc
    ? `${KOREAN_REGIONS}|${regionEsc}`
    : KOREAN_REGIONS;

  const roadFull =
    text.match(
      new RegExp(
        `(?:${regionPart})[^\\n|#]{0,20}(?:시|군|구)[^\\n|#]{0,35}(?:동|읍|면|로|길|번길)[^\\n|#]{0,25}\\d+(?:-\\d+)?[^\\n|#]{0,20}`,
        "i",
      ),
    )?.[0] ?? "";

  const patterns = [
    labeled,
    roadFull,
    text.match(
      new RegExp(
        `(?:${regionPart})[^\\n|#]{0,25}(?:시|군|구)[^\\n|#]{0,35}(?:동|읍|면|로|길|번길)[^\\n|#]{0,40}\\d*[^\\n|#]{0,20}`,
        "i",
      ),
    )?.[0],
    regionEsc
      ? text.match(
          new RegExp(
            `${regionEsc}[^\\n|#]{0,60}(?:동|로|길|번길)[^\\n|#]{0,30}\\d+[^\\n|#]{0,15}`,
            "i",
          ),
        )?.[0]
      : "",
    text.match(
      new RegExp(
        `(?:${KOREAN_REGIONS})[^\\n|#]{4,60}(?:시|군|구)[^\\n|#]{0,40}(?:동|로|길|번길)[^\\n|#]{0,30}`,
        "i",
      ),
    )?.[0],
  ];

  for (const candidate of patterns) {
    const cleaned = String(candidate ?? "")
      .replace(/\s+/g, " ")
      .replace(/[,.]$/, "")
      .replace(/\s*(?:이\s*블로그의\s*체크인|전화|영업|주차).*$/i, "")
      .trim();
    if (cleaned.length >= 8 && cleaned.length <= 100) return cleaned;
  }

  return "";
}

function buildGeocodeHint(basicInfo, vars) {
  const address = String(basicInfo?.address ?? "").trim();
  const vague =
    !address ||
    /방문\s*(?:전|후)\s*확인|참고|블로그/i.test(address) ||
    address.length < 6;

  const geocodeQuery = vague
    ? [vars.restaurantName, vars.region].filter(Boolean).join(" ").trim()
    : [vars.restaurantName, address, vars.region].filter(Boolean).join(" ").trim();

  return {
    address: vague ? "" : address,
    geocodeQuery,
  };
}

function cleanBlogText(text) {
  return filterBlogNoise(String(text ?? "").trim());
}

/** OpenAI 없이 수집 블로그 스니펫으로 섹션 채우기 */
function importFromCollectedSnippets(body, collected, searchedQuery) {
  const vars = parseVars(body);
  // hints는 원문에서 추출, 섹션 문장 추출은 기본정보 블록 제거본 사용
  const combinedRaw = collected.map((c) => c.text).join("\n\n");
  const hints = extractBasicHints(combinedRaw, vars);
  const cleanedCollected = collected.map((c) => ({
    ...c,
    text: stripBasicInfoBlocksFromText(c.text),
  }));
  const combined = cleanedCollected.map((c) => c.text).join("\n\n");
  const primary = cleanedCollected[0]?.text ?? "";
  const menuKeys = [vars.mainMenu, "메뉴", "가격", "주문"];
  const foodKeys = [vars.mainMenu, "맛", "먹", "식감", "비주얼"];
  const moodKeys = ["분위기", "인테리어", "좌석", "매장", "친절"];

  const introBlog = pickSentences(primary, [vars.region, vars.restaurantName], 3);
  const intro = introBlog
    ? `${introBlog}\n\n${vars.region} ${vars.restaurantName}에 다녀와 ${vars.mainMenu}를 맛봤습니다.`
    : fillTemplate(DEFAULT_SECTIONS.intro, vars);

  const atmosphere =
    pickSentences(combined, moodKeys, 4) ||
    fillTemplate(DEFAULT_SECTIONS.atmosphere, vars);
  const menu =
    pickSentences(combined, menuKeys, 4) ||
    fillTemplate(DEFAULT_SECTIONS.menu, vars);
  const foodReview =
    cleanedCollected
      .slice(0, 3)
      .map((c) => pickSentences(c.text, foodKeys, 3))
      .filter(Boolean)
      .join("\n\n") ||
    takeExcerpt(combined, 900) ||
    fillTemplate(DEFAULT_SECTIONS.foodReview, vars);
  const summary =
    pickSentences(combined, ["총평", "추천", "재방문", "만족", "별점"], 3) ||
    fillTemplate(DEFAULT_SECTIONS.summary, vars);

  const simCount = collected.filter((c) => c.matchedSort === "sim").length;
  const dateCount = collected.filter((c) => c.matchedSort === "date").length;
  const basicInfo = {
    name: hints.name || vars.restaurantName,
    address: hints.address || `${vars.region} (블로그 참고 — 방문 전 확인)`,
    hours: hints.hours || "영업시간은 방문 전 전화 확인을 권장합니다.",
    phone: hints.phone,
    parking: hints.parking || "매장 주변 주차 가능 여부는 방문 시 확인해 주세요.",
    reservation: "전화 또는 네이버 예약 가능 여부를 확인해 주세요.",
  };

  return {
    title: buildImportTitle(vars),
    region: vars.region,
    restaurantName: vars.restaurantName,
    mainMenu: vars.mainMenu,
    basicInfo,
    sections: stripSectionsBasicInfo(
      {
        intro,
        atmosphere,
        menu,
        foodReview,
        summary,
        closing: fillTemplate(DEFAULT_SECTIONS.closing, vars),
      },
      [vars.restaurantName, basicInfo.name],
    ),
    excerpt: takeExcerpt(
      `${vars.region} ${vars.restaurantName} ${vars.mainMenu} 후기. ${introBlog || intro}`,
      180,
    ),
    suggestedTags: [
      vars.region,
      vars.restaurantName,
      "맛집",
      vars.mainMenu,
      "맛집후기",
    ].filter(Boolean),
    geocodeHint: buildGeocodeHint(basicInfo, vars),
    sources: collected.map((c) => ({
      title: c.title,
      url: c.url,
      blogger: c.blogger,
      matchedSort: c.matchedSort,
    })),
    importMeta: {
      mode: "search-snippet",
      searchedQuery,
      sourceCount: collected.length,
      message: `블로그 ${collected.length}건(정확도 ${simCount} · 최신 ${dateCount})을 검색·수집해 초안을 채웠습니다. OpenAI 키가 없어 AI 최적화 없이 참고 글 요약을 사용했습니다.`,
    },
  };
}

async function optimizeWithCollectedBlogs(body, collected, env, searchedQuery) {
  const vars = parseVars(body);

  const sourceList = collected.map((c, i) => ({
    index: i + 1,
    title: c.title,
    url: c.url,
    blogger: c.blogger,
    excerpt: c.text.slice(0, 2500),
  }));

  const system = `당신은 한국어 맛집 블로그 SEO 편집자입니다.
여러 네이버 블로그 글에서 사실 정보(메뉴, 가격, 주소, 영업시간, 분위기, 맛 평가)를 추출·종합하세요.
원문 문장을 그대로 복사하지 말고, 1인칭 방문 후기 톤으로 새로 작성하세요.
확실하지 않은 정보는 "방문 전 확인" 등으로 완곡하게 표기하세요.
섹션별로 나누어 SEO에 유리하게 최적화하세요.
상호·주소·영업시간·연락처·주차는 basicInfo에만 넣고, intro/foodReview 등 sections 본문에는 ■ 위치·주소:·영업시간: 같은 정보 카드를 넣지 마세요.`;

  const blogsBlock = sourceList
    .map(
      (s) =>
        `[참고${s.index}] ${s.title}\nURL: ${s.url}\n작성자: ${s.blogger || "미상"}\n내용:\n${s.excerpt}`,
    )
    .join("\n\n---\n\n");

  const user = `아래 참고 블로그 글들을 바탕으로 맛집 리뷰 초안을 작성·최적화해 주세요.

대상 맛집:
- 지역: ${vars.region}
- 맛집명: ${vars.restaurantName}
- 대표메뉴: ${vars.mainMenu}

참고 블로그 (${sourceList.length}건):
${blogsBlock}

${JSON_SCHEMA_HINT}`;

  const parsed = await callOpenAiJson(env, system, user);

  const simCount = collected.filter((c) => c.matchedSort === "sim").length;
  const dateCount = collected.filter((c) => c.matchedSort === "date").length;

  return formatOpenAiResult(parsed, vars, {
    hintSource: collected.map((c) => c.text).join("\n\n"),
    sources: collected.map((c) => ({
      title: c.title,
      url: c.url,
      blogger: c.blogger,
      matchedSort: c.matchedSort,
    })),
    importMeta: {
      mode: "search-ai",
      searchedQuery,
      sourceCount: collected.length,
      message: `블로그 ${collected.length}건(정확도 ${simCount} · 최신 ${dateCount})을 검색·수집해 AI로 최적화했습니다.`,
    },
  });
}

/** 정확도(sim)/최신(date) 결과를 번갈아 병합 */
function mergeBySortStrategy(simHits, dateHits, limit) {
  const merged = [];
  const seen = new Set();
  const maxLen = Math.max(simHits.length, dateHits.length);

  for (let i = 0; i < maxLen && merged.length < limit; i += 1) {
    const sim = simHits[i];
    if (sim && !seen.has(sim.link)) {
      seen.add(sim.link);
      merged.push({ ...sim, matchedSort: "sim" });
    }
    if (merged.length >= limit) break;

    const date = dateHits[i];
    if (date && !seen.has(date.link)) {
      seen.add(date.link);
      merged.push({ ...date, matchedSort: "date" });
    }
  }

  return merged;
}

async function searchForSort(queries, env, sort) {
  const seenUrls = new Set();
  const hits = [];

  for (const query of queries) {
    try {
      const found = await searchNaverBlogs(query, env, { display: 5, sort });
      for (const hit of found) {
        if (!hit.link || seenUrls.has(hit.link)) continue;
        seenUrls.add(hit.link);
        hits.push({ ...hit, searchedQuery: query });
      }
    } catch {
      /* 다음 쿼리 시도 */
    }
    if (hits.length >= 6) break;
  }

  return hits;
}

/** 네이버 블로그 검색(정확도+최신 혼합) 후 본문 수집 */
async function collectBlogSources(body, env, opts = {}) {
  const limit = opts.limit ?? 4;
  if (!env.naverClientId || !env.naverClientSecret) {
    return { collected: [], searchedQuery: "", searchError: "NAVER keys missing" };
  }

  const vars = parseVars(body);
  const queries = buildRestaurantSearchQueries(vars);
  const primaryQuery = queries[0] ?? "";

  const [simHits, dateHits] = await Promise.all([
    searchForSort(queries, env, "sim"),
    searchForSort(queries, env, "date"),
  ]);

  const searchHits = mergeBySortStrategy(simHits, dateHits, 6);
  if (searchHits.length === 0) {
    return { collected: [], searchedQuery: primaryQuery, searchError: "" };
  }

  const collected = [];

  for (const hit of searchHits) {
    let text = cleanBlogText(hit.description || "");
    try {
      const full = await fetchBlogText(hit.link, { maxChars: 4500 });
      if (full.length > text.length) text = cleanBlogText(full);
    } catch {
      /* 스니펫만 사용 */
    }

    if (text.length < 15) continue;

    collected.push({
      title: hit.title || stripHtml(hit.title),
      url: hit.link,
      blogger: hit.blogger,
      text,
      matchedSort: hit.matchedSort,
      postDate: hit.postDate,
    });

    if (collected.length >= limit) break;
  }

  return { collected, searchedQuery: primaryQuery };
}

function formatPostDate(postDate) {
  const raw = String(postDate ?? "").trim();
  if (raw.length !== 8) return raw;
  return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
}

/** 블로그 검색만 — 목록·미리보기용 (AI import 없음) */
export async function searchRestaurantBlogSources(body, env) {
  const vars = parseVars(body);

  if (!vars.region || !vars.restaurantName) {
    throw new Error("region and restaurantName are required");
  }

  if (!env.naverClientId || !env.naverClientSecret) {
    return {
      sources: [],
      searchedQuery: "",
      searchError: "NAVER keys missing",
    };
  }

  const { collected, searchedQuery, searchError } = await collectBlogSources(
    body,
    env,
    { limit: 6 },
  );

  return {
    sources: collected.map((c) => ({
      title: c.title,
      url: c.url,
      blogger: c.blogger,
      excerpt: takeExcerpt(c.text, 220),
      content: c.text,
      postDate: formatPostDate(c.postDate),
      matchedSort: c.matchedSort,
    })),
    searchedQuery,
    searchError: searchError ?? "",
  };
}

async function importSingleCollectedBlog(body, collected, env, searchedQuery) {
  if (collected.length === 0) {
    throw new Error("선택한 블로그 본문을 가져오지 못했습니다.");
  }

  if (env.openaiApiKey) {
    try {
      return await optimizeWithCollectedBlogs(body, collected, env, searchedQuery);
    } catch {
      /* AI 최적화 실패 시 스니펫 fallback */
    }
  }

  return importFromCollectedSnippets(body, collected, searchedQuery);
}

/** 선택한 블로그 URL 하나만 import */
export async function importFromSelectedBlog(body, env) {
  const vars = parseVars(body);
  const selectedUrl = String(body?.selectedUrl ?? "").trim();

  if (!vars.region || !vars.restaurantName) {
    throw new Error("region and restaurantName are required");
  }
  if (!selectedUrl) {
    throw new Error("selectedUrl is required");
  }

  let text = "";
  try {
    text = cleanBlogText(await fetchBlogText(selectedUrl, { maxChars: 8000 }));
  } catch (e) {
    throw new Error(
      `블로그 본문을 가져오지 못했습니다: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (text.length < 15) {
    throw new Error("블로그 본문이 너무 짧습니다.");
  }

  const collected = [
    {
      title: vars.restaurantName,
      url: selectedUrl,
      blogger: "",
      text,
      matchedSort: "sim",
      postDate: "",
    },
  ];

  const queries = buildRestaurantSearchQueries(vars);
  const searchedQuery = queries[0] ?? "";

  return importSingleCollectedBlog(body, collected, env, searchedQuery);
}

export async function importRestaurantBlog(body, env) {
  const vars = parseVars(body);

  if (!vars.region || !vars.restaurantName) {
    throw new Error("region and restaurantName are required");
  }

  let collected = [];
  let searchedQuery = "";
  let searchError = "";

  try {
    const result = await collectBlogSources(body, env, { limit: 4 });
    collected = result.collected;
    searchedQuery = result.searchedQuery;
    searchError = result.searchError ?? "";
  } catch (e) {
    collected = [];
    searchError = e instanceof Error ? e.message : String(e);
  }

  if (collected.length > 0 && env.openaiApiKey) {
    try {
      return await optimizeWithCollectedBlogs(
        body,
        collected,
        env,
        searchedQuery,
      );
    } catch {
      /* AI 최적화 실패 시 스니펫 fallback */
    }
  }

  if (collected.length > 0) {
    return importFromCollectedSnippets(body, collected, searchedQuery);
  }

  if (env.openaiApiKey) {
    try {
      return await importWithOpenAiOnly(body, env);
    } catch {
      return fallbackImport(body);
    }
  }

  const fb = fallbackImport(body, {
    searchedQuery,
    message: !env.naverClientId || !env.naverClientSecret
      ? "네이버 검색 API 키가 없어 블로그 검색 없이 템플릿으로 채웠습니다."
      : searchError
        ? `블로그 검색 오류: ${searchError.slice(0, 120)}`
        : collected.length === 0 && searchedQuery
          ? `「${searchedQuery}」 검색 결과가 없어 기본 템플릿으로 채웠습니다.`
          : "블로그를 찾지 못해 기본 템플릿으로 채웠습니다.",
  });
  return fb;
}

export { DEFAULT_BASIC };

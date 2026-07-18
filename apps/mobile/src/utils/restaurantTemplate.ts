import type {
  MapProvider,
  RestaurantBasicInfo,
  RestaurantSection,
  RestaurantSectionKey,
  RestaurantTemplateData,
  StepLocation,
} from "../types";
import {
  buildSummaryContent,
  createDefaultRatings,
  expandInlineStarRatings,
  normalizeRatings,
  parseSummaryContent,
} from "./restaurantRatings";
import {
  locationFromPlaceName,
  refreshLocationProvider,
  resolveMapsUrl,
} from "./maps";

/** UI prefix 라벨 (저장값에는 포함하지 않음) */
export const RESTAURANT_FIELD_PREFIXES = {
  restaurantName: "[맛집명]",
  region: "[지역]",
  mainMenu: "[대표메뉴]",
} as const;

/** @deprecated RESTAURANT_FIELD_PREFIXES 사용 */
export const RESTAURANT_FIELD_PLACEHOLDERS = RESTAURANT_FIELD_PREFIXES;

const ALL_FIELD_PREFIXES = Object.values(RESTAURANT_FIELD_PREFIXES);

/** 입력값 앞에 붙은 가이드 prefix 제거 (API·검색용) */
export function sanitizeRestaurantFieldValue(
  raw: string,
  _field?: keyof typeof RESTAURANT_FIELD_PREFIXES,
): string {
  let v = String(raw ?? "").trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of ALL_FIELD_PREFIXES) {
      if (v.startsWith(prefix)) {
        v = v.slice(prefix.length).trimStart();
        changed = true;
      }
    }
  }
  return v;
}

export function isRestaurantPlaceholderField(value: string): boolean {
  return sanitizeRestaurantFieldValue(value).length === 0;
}

/** 기본정보 카드/라벨 줄 (상호·주소·영업시간·연락처·주차 등) */
function isBasicInfoLine(line: string): boolean {
  const t = String(line ?? "").trim();
  if (!t) return false;
  if (
    /^(?:📝\s*)?(?:■\s*)?(?:위치|영업\s*시간|연락처|주차|기본\s*정보|매장\s*정보)(?:\s*[\/·|,]\s*(?:위치|영업\s*시간|연락처|주차|기본\s*정보|매장\s*정보))+/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /^(?:📝\s*)?■\s*(?:위치|영업\s*시간|연락처|주차|기본\s*정보|매장\s*정보)/i.test(
      t,
    )
  ) {
    return true;
  }
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
 * 섹션 본문에서 기본정보 블록 제거 (basicInfo 필드와 중복 방지).
 * 이미 저장된 draft·미리보기에도 적용.
 */
export function stripBasicInfoBlocksFromSection(text: string): string {
  const lines = String(text ?? "").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (isBasicInfoLine(line)) continue;
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

/** 편집 UI용 섹션 라벨 — 본문 헤딩으로 남아 있으면 제거 */
const SECTION_META_HEADING_RE =
  /^(?:#{1,3}\s*)?(?:\d+\.\s*)?(?:도입부|기본\s*정보|매장\s*정보|매장\s*분위기|분위기|메뉴\s*소개|메뉴|음식\s*리뷰|총평|마무리)\s*$/i;

function collectRestaurantNameVariants(...names: Array<string | undefined>): string[] {
  const out: string[] = [];
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

function isRestaurantNameHeading(line: string, names: string[]): boolean {
  const t = String(line ?? "")
    .trim()
    .replace(/^#{1,3}\s*/, "")
    .trim();
  if (!t || t.length > 40) return false;
  if (t === "[맛집명]") return true;
  return names.some((n) => t === n);
}

function normalizeCompareText(s: string): string {
  return String(s ?? "")
    .replace(/\s+/g, "")
    .replace(/[.,!?。…~·\-–—'"“”‘’]/g, "")
    .toLowerCase();
}

/**
 * 섹션 content에 박힌 「도입부」·상호명 단독 헤딩 제거.
 * 기존 draft에도 미리보기/본문 재생성 시 적용.
 */
export function stripSectionDecorations(
  text: string,
  nameHints: Array<string | undefined> = [],
): string {
  const names = collectRestaurantNameVariants(...nameHints);
  const lines = String(text ?? "").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      kept.push(line);
      continue;
    }
    if (SECTION_META_HEADING_RE.test(trimmed)) continue;
    if (isRestaurantNameHeading(trimmed, names)) continue;
    kept.push(line);
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** intro와 겹치는 문단/문장을 foodReview 등에서 제거 */
export function dedupeTextAgainstReference(
  text: string,
  reference: string,
): string {
  const src = String(text ?? "").trim();
  const ref = String(reference ?? "").trim();
  if (!src || !ref) return src;
  const refNorm = normalizeCompareText(ref);
  if (!refNorm) return src;
  const minLen = 10;

  const paragraphs = src.split(/\n{2,}/);
  const keptParas: string[] = [];
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

/**
 * 블로그 원문의 ■메뉴 ■외부사진 등 사진/섹션 placeholder 제거
 */
export function stripPhotoPlaceholders(text: string): string {
  let s = String(text ?? "");
  // 연속 placeholder 덩어리
  s = s.replace(
    /(?:■\s*(?:메뉴|외부\s*사진|내부\s*사진|사진|위치|주차|연락처|영업\s*시간|분위기|음식|리뷰)\s*)+/gi,
    " ",
  );
  // 단독 ■단어 (짧은 라벨)
  s = s.replace(/■\s*[가-힣A-Za-z0-9]{1,12}(?=\s|$|■)/g, " ");
  // placeholder만 있는 줄 제거
  s = s
    .split("\n")
    .filter((line) => {
      const t = line.replace(/[■\s]/g, "").trim();
      return t.length > 0;
    })
    .join("\n");
  return s.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function cleanRestaurantSectionContent(
  text: string,
  nameHints: Array<string | undefined> = [],
): string {
  return expandInlineStarRatings(
    stripSectionDecorations(
      stripBasicInfoBlocksFromSection(stripPhotoPlaceholders(text)),
      nameHints,
    ),
  );
}

export function effectiveRestaurantFields(data: {
  region: string;
  restaurantName: string;
  mainMenu: string;
}) {
  return {
    region: sanitizeRestaurantFieldValue(data.region, "region"),
    restaurantName: sanitizeRestaurantFieldValue(
      data.restaurantName,
      "restaurantName",
    ),
    mainMenu: sanitizeRestaurantFieldValue(data.mainMenu, "mainMenu"),
  };
}

export const RESTAURANT_SECTION_LABELS: Record<RestaurantSectionKey, string> = {
  intro: "1. 도입부",
  atmosphere: "3. 매장 분위기",
  menu: "4. 메뉴 소개",
  foodReview: "5. 음식 리뷰",
  summary: "6. 총평",
  closing: "7. 마무리",
};

const DEFAULT_INTRO = `안녕하세요 :)

오늘은 [지역]에 위치한 [맛집명]에 다녀왔습니다.
평소 [대표메뉴]가 유명하다고 해서 방문했는데,
직접 먹어보니 왜 인기가 많은지 알겠더라고요.

주차, 분위기, 메뉴, 가격, 맛까지 솔직하게 리뷰해보겠습니다.`;

const DEFAULT_ATMOSPHERE = `매장에 들어가자마자 깔끔한 인테리어가 눈에 들어왔습니다.

테이블 간격도 넓어서 식사하기 편했고,
가족모임, 데이트, 친구들과 방문하기에도 좋은 분위기였습니다.

직원분들도 친절하게 안내해 주셔서 첫인상이 좋았습니다.`;

const DEFAULT_MENU = `메뉴는 생각보다 다양했습니다.

저희는
✔ [메뉴1]
✔ [메뉴2]
✔ [메뉴3]

이렇게 주문했습니다.
가격도 전체적으로 부담 없는 편이었습니다.`;

const DEFAULT_FOOD_REVIEW = `가장 먼저 나온 [메뉴명].

비주얼부터 먹음직스러웠고
향도 정말 좋았습니다.

한입 먹어보니
[식감]
[풍미]
[간]
[재료의 신선함]

모두 만족스러웠습니다.

특히 [포인트]가 인상적이었습니다.

같이 나온 반찬이나 소스와 함께 먹으면 더욱 맛있었습니다.`;

const DEFAULT_SUMMARY = `전체적으로 만족도가 높은 식사였습니다.

- ✔ 맛 ★★★★★
- ✔ 가격 ★★★★☆
- ✔ 서비스 ★★★★★
- ✔ 청결 ★★★★★
- ✔ 재방문의사 ★★★★★

[지역]에서 맛있는 [음식 종류]를 찾는다면
한 번 방문해 보시는 것을 추천드립니다.`;

const DEFAULT_CLOSING = `오늘도 끝까지 읽어주셔서 감사합니다.

다음에도 솔직한 맛집 리뷰로 찾아오겠습니다.`;

const DEFAULT_CONTENT: Record<RestaurantSectionKey, string> = {
  intro: DEFAULT_INTRO,
  atmosphere: DEFAULT_ATMOSPHERE,
  menu: DEFAULT_MENU,
  foodReview: DEFAULT_FOOD_REVIEW,
  summary: DEFAULT_SUMMARY,
  closing: DEFAULT_CLOSING,
};

function newSection(key: RestaurantSectionKey): RestaurantSection {
  return {
    id: `sec-${key}-${Date.now()}`,
    key,
    content: DEFAULT_CONTENT[key],
    images: [],
  };
}

export function createFoodReviewSection(): RestaurantSection {
  return {
    ...newSection("foodReview"),
    id: `sec-foodReview-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
}

export function createEmptyRestaurantData(): RestaurantTemplateData {
  const keys: RestaurantSectionKey[] = [
    "intro",
    "atmosphere",
    "menu",
    "foodReview",
    "summary",
    "closing",
  ];
  const ratings = createDefaultRatings();
  const summaryHead = "전체적으로 만족도가 높은 식사였습니다.";
  const summaryTail =
    "[지역]에서 맛있는 [음식 종류]를 찾는다면\n한 번 방문해 보시는 것을 추천드립니다.";
  const sections = keys.map(newSection);
  const summarySection = sections.find((s) => s.key === "summary");
  if (summarySection) {
    summarySection.content = buildSummaryContent(
      ratings,
      summaryHead,
      summaryTail,
    );
  }
  return {
    region: "",
    restaurantName: "",
    mainMenu: "",
    mapProvider: "google",
    location: null,
    basicInfo: {
      name: "",
      address: "",
      hours: "",
      phone: "",
      parking: "",
      reservation: "",
    },
    parkingImages: [],
    sections,
    ratings,
    summaryHead,
    summaryTail,
  };
}

export function normalizeRestaurantData(
  raw: RestaurantTemplateData,
): RestaurantTemplateData {
  const summarySection = raw.sections.find((s) => s.key === "summary");
  let ratings = normalizeRatings(raw.ratings);
  let summaryHead = raw.summaryHead ?? "";
  let summaryTail = raw.summaryTail ?? "";

  if (summarySection && (!raw.ratings || !raw.summaryHead)) {
    const parsed = parseSummaryContent(summarySection.content);
    if (!raw.ratings) ratings = parsed.ratings;
    if (!raw.summaryHead) summaryHead = parsed.headText;
    if (!raw.summaryTail) summaryTail = parsed.tailText;
  }

  if (!summaryHead) summaryHead = "전체적으로 만족도가 높은 식사였습니다.";

  const mapProvider = raw.mapProvider === "naver" ? "naver" : "google";
  const region = sanitizeRestaurantFieldValue(raw.region, "region");
  const restaurantName = sanitizeRestaurantFieldValue(
    raw.restaurantName,
    "restaurantName",
  );
  const mainMenu = sanitizeRestaurantFieldValue(raw.mainMenu, "mainMenu");
  const basicName =
    sanitizeRestaurantFieldValue(raw.basicInfo.name, "restaurantName") ||
    restaurantName;
  const nameHints = [restaurantName, basicName];

  let sections = raw.sections.map((s) =>
    s.key === "summary"
      ? {
          ...s,
          content: buildSummaryContent(ratings, summaryHead, summaryTail),
        }
      : {
          ...s,
          content: cleanRestaurantSectionContent(s.content, nameHints),
        },
  );

  if (!sections.some((s) => s.key === "foodReview")) {
    sections = [...sections, createFoodReviewSection()];
  }

  const introContent =
    sections.find((s) => s.key === "intro")?.content.trim() ?? "";
  if (introContent) {
    sections = sections.map((s) =>
      s.key === "foodReview"
        ? {
            ...s,
            content: dedupeTextAgainstReference(s.content, introContent),
          }
        : s,
    );
  }

  const parkingImages = Array.isArray(raw.parkingImages)
    ? raw.parkingImages.filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

  return {
    ...raw,
    region,
    restaurantName,
    mainMenu,
    mapProvider,
    location: raw.location
      ? refreshLocationProvider(raw.location, mapProvider)
      : null,
    basicInfo: {
      ...raw.basicInfo,
      name: basicName,
    },
    parkingImages,
    sections,
    ratings,
    summaryHead,
    summaryTail,
  };
}

/** 맛집 템플릿 전환·신규 초안 시 restaurant 데이터 보장 */
export function initRestaurantTemplateData(
  existing?: RestaurantTemplateData | null,
  title?: string,
): RestaurantTemplateData {
  const defaults = createEmptyRestaurantData();
  if (!existing) {
    const titleTrim = sanitizeRestaurantFieldValue(title ?? "", "restaurantName");
    if (!titleTrim) return defaults;
    return normalizeRestaurantData({
      ...defaults,
      restaurantName: titleTrim,
      basicInfo: { ...defaults.basicInfo, name: titleTrim },
    });
  }
  const merged = normalizeRestaurantData(existing);
  const titleTrim = sanitizeRestaurantFieldValue(title ?? "", "restaurantName");
  const name =
    sanitizeRestaurantFieldValue(merged.restaurantName, "restaurantName") ||
    titleTrim;
  return normalizeRestaurantData({
    ...merged,
    restaurantName: name || merged.restaurantName,
    basicInfo: {
      ...merged.basicInfo,
      name:
        sanitizeRestaurantFieldValue(merged.basicInfo.name, "restaurantName") ||
        name,
    },
  });
}

export function patchSummary(
  data: RestaurantTemplateData,
  patch: {
    ratings?: RestaurantTemplateData["ratings"];
    summaryHead?: string;
    summaryTail?: string;
  },
): RestaurantTemplateData {
  const ratings = patch.ratings ?? data.ratings;
  const summaryHead = patch.summaryHead ?? data.summaryHead;
  const summaryTail = patch.summaryTail ?? data.summaryTail;
  const content = buildSummaryContent(ratings, summaryHead, summaryTail);
  return normalizeRestaurantData({
    ...data,
    ratings,
    summaryHead,
    summaryTail,
    sections: data.sections.map((s) =>
      s.key === "summary" ? { ...s, content } : s,
    ),
  });
}

export function applyRestaurantPlaceholders(
  data: RestaurantTemplateData,
): RestaurantTemplateData {
  const effective = effectiveRestaurantFields(data);
  const { region, restaurantName, mainMenu } = effective;
  const replace = (text: string) =>
    text
      .replace(/\[지역\]/g, region || "[지역]")
      .replace(/\[맛집명\]/g, restaurantName || "[맛집명]")
      .replace(/\[대표메뉴\]/g, mainMenu || "[대표메뉴]")
      .replace(/\[메뉴명\]/g, mainMenu || "[메뉴명]")
      .replace(/\[음식 종류\]/g, mainMenu || "[음식 종류]");

  return {
    ...data,
    basicInfo: {
      ...data.basicInfo,
      name:
        sanitizeRestaurantFieldValue(data.basicInfo.name, "restaurantName") ||
        restaurantName,
    },
    sections: data.sections.map((s) => ({
      ...s,
      content: replace(s.content),
    })),
  };
}

export function formatBasicInfoMarkdown(
  info: RestaurantBasicInfo,
  location: StepLocation | null,
  mapProvider: MapProvider,
  parkingImages: string[] = [],
): string {
  // post-3 스타일: #### 소제목 + 불릿. 지도는 클릭 가능한 별도 링크.
  const mapUrl = location
    ? resolveMapsUrl(location, mapProvider)
    : info.address.trim()
      ? resolveMapsUrl(
          locationFromPlaceName(info.address, mapProvider),
          mapProvider,
        )
      : "";
  const mapLabel =
    mapProvider === "naver" ? "네이버 지도에서 보기" : "구글 지도에서 보기";

  const lines = ["#### 📍 위치 및 기본 정보", ""];
  if (info.name.trim()) lines.push(`- **상호명:** ${info.name.trim()}`);
  if (info.address.trim()) lines.push(`- **주소:** ${info.address.trim()}`);
  if (mapUrl) lines.push(`- **지도:** [${mapLabel}](${mapUrl})`);
  if (info.hours.trim()) lines.push(`- **영업시간:** ${info.hours.trim()}`);
  if (info.phone.trim()) lines.push(`- **연락처:** ${info.phone.trim()}`);
  if (info.parking.trim()) lines.push(`- **주차:** ${info.parking.trim()}`);
  for (const uri of parkingImages) {
    if (/^https?:\/\//i.test(uri)) lines.push("", `![주차](${uri})`);
  }
  if (info.reservation.trim()) {
    lines.push(`- **예약:** ${info.reservation.trim()}`);
  }
  return lines.join("\n");
}

/** WP/본문용 섹션 소제목 (post-3의 #### 이모지 헤딩 스타일) */
const SECTION_MARKDOWN_HEADINGS: Partial<
  Record<RestaurantSectionKey, string | null>
> = {
  intro: null,
  atmosphere: "#### 🥘 분위기와 서비스",
  menu: "#### 🍽 메뉴 소개",
  foodReview: "#### 🥢 음식 리뷰",
  summary: "#### ✨ 총평",
  closing: null,
};

function appendSectionParts(
  parts: string[],
  key: RestaurantSectionKey,
  label: string,
  content: string,
  images: string[],
): void {
  const heading = SECTION_MARKDOWN_HEADINGS[key];
  if (heading) {
    parts.push(heading, "");
  } else if (key === "foodReview" && label.includes(" ")) {
    // 음식 리뷰 2개 이상일 때만 번호 헤딩
    parts.push(`#### 🥢 ${label}`, "");
  }
  parts.push(content);
  for (const uri of images) {
    if (/^https?:\/\//i.test(uri)) {
      parts.push("", `![${label}](${uri})`);
    }
  }
  parts.push("");
}

export function restaurantToMarkdown(data: RestaurantTemplateData): string {
  const applied = applyRestaurantPlaceholders(data);
  const nameHints = [applied.restaurantName, applied.basicInfo.name];
  // 제목은 draft.title / WP title만 사용 — 본문 # 상호 헤딩 중복 제거
  const parts: string[] = [];

  const orderedKeys: RestaurantSectionKey[] = [
    "intro",
    "atmosphere",
    "menu",
    "foodReview",
    "summary",
    "closing",
  ];

  const introClean = cleanRestaurantSectionContent(
    applied.sections.find((s) => s.key === "intro")?.content ?? "",
    nameHints,
  );

  for (const key of orderedKeys) {
    const sections =
      key === "foodReview"
        ? applied.sections.filter((s) => s.key === key)
        : applied.sections.filter((s) => s.key === key).slice(0, 1);
    if (sections.length === 0) continue;
    const baseLabel = RESTAURANT_SECTION_LABELS[key].replace(/^\d+\.\s*/, "");

    for (const [index, section] of sections.entries()) {
      const label =
        key === "foodReview" && sections.length > 1
          ? `${baseLabel} ${index + 1}`
          : baseLabel;
      let content = cleanRestaurantSectionContent(section.content, nameHints);
      if (key === "foodReview" && introClean) {
        content = dedupeTextAgainstReference(content, introClean);
      }
      // 도입부·마무리: 헤딩 생략. 기본정보는 formatBasicInfoMarkdown 한 번만.
      appendSectionParts(parts, key, label, content, section.images);
    }

    if (key === "intro") {
      parts.push(
        formatBasicInfoMarkdown(
          applied.basicInfo,
          applied.location,
          applied.mapProvider,
          applied.parkingImages,
        ),
        "",
      );
    }
  }

  return parts.join("\n").trim();
}

/** 가져오기 조건: 지역 + 맛집명 2개 필드 입력 */
export function canImportRestaurant(data: RestaurantTemplateData): boolean {
  const { region, restaurantName } = effectiveRestaurantFields(data);
  return region.length >= 1 && restaurantName.length >= 1;
}

export function getSectionByKey(
  data: RestaurantTemplateData,
  key: RestaurantSectionKey,
): RestaurantSection | undefined {
  return data.sections.find((s) => s.key === key);
}

export function patchRestaurantSection(
  data: RestaurantTemplateData,
  sectionId: string,
  patch: Partial<RestaurantSection>,
): RestaurantTemplateData {
  return {
    ...data,
    sections: data.sections.map((s) =>
      s.id === sectionId ? { ...s, ...patch } : s,
    ),
  };
}

export function addFoodReviewSection(
  data: RestaurantTemplateData,
): RestaurantTemplateData {
  const nextSection = createFoodReviewSection();
  const insertAfter = data.sections.reduce(
    (last, section, index) => (section.key === "foodReview" ? index : last),
    -1,
  );
  const sections = [...data.sections];
  sections.splice(insertAfter + 1, 0, nextSection);
  return { ...data, sections };
}

export function removeFoodReviewSection(
  data: RestaurantTemplateData,
  sectionId: string,
): RestaurantTemplateData {
  const foodReviews = data.sections.filter((s) => s.key === "foodReview");
  if (foodReviews.length <= 1) {
    return patchRestaurantSection(data, sectionId, {
      content: DEFAULT_FOOD_REVIEW,
      images: [],
    });
  }
  return {
    ...data,
    sections: data.sections.filter((s) => s.id !== sectionId),
  };
}

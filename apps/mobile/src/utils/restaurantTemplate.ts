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
  normalizeRatings,
  parseSummaryContent,
} from "./restaurantRatings";
import {
  formatLocationMarkdown,
  locationFromPlaceName,
  refreshLocationProvider,
  resolveMapsUrl,
} from "./maps";

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

✔ 맛 ★★★★★
✔ 가격 ★★★★☆
✔ 서비스 ★★★★★
✔ 청결 ★★★★★
✔ 재방문의사 ★★★★★

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

  let sections = raw.sections.map((s) =>
    s.key === "summary"
      ? {
          ...s,
          content: buildSummaryContent(ratings, summaryHead, summaryTail),
        }
      : s,
  );

  if (!sections.some((s) => s.key === "foodReview")) {
    sections = [...sections, createFoodReviewSection()];
  }

  const mapProvider = raw.mapProvider === "naver" ? "naver" : "google";

  return {
    ...raw,
    mapProvider,
    location: raw.location
      ? refreshLocationProvider(raw.location, mapProvider)
      : null,
    sections,
    ratings,
    summaryHead,
    summaryTail,
  };
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
  const { region, restaurantName, mainMenu } = data;
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
      name: data.basicInfo.name || restaurantName,
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
): string {
  const mapLink = location
    ? formatLocationMarkdown(location, mapProvider).trim()
    : info.address.trim()
      ? `\n\n📍 [${info.address.trim()}](${resolveMapsUrl(locationFromPlaceName(info.address, mapProvider), mapProvider)})`
      : "";
  return `## 2. 기본 정보

📍 상호명 : ${info.name || ""}
📍 주소 : ${info.address || ""}${mapLink}
🕒 영업시간 : ${info.hours || ""}
☎️ 전화번호 : ${info.phone || ""}
🚗 주차 : ${info.parking || ""}
💳 예약 가능 여부 : ${info.reservation || ""}`;
}

function appendSectionParts(
  parts: string[],
  label: string,
  content: string,
  images: string[],
): void {
  parts.push(`## ${label}`, "", content);
  for (const uri of images) {
    parts.push("", `![${label}](${uri})`);
  }
  parts.push("");
}

export function restaurantToMarkdown(data: RestaurantTemplateData): string {
  const applied = applyRestaurantPlaceholders(data);
  const title = applied.restaurantName || applied.basicInfo.name || "맛집 리뷰";
  const parts: string[] = [`# ${title}`, ""];

  const orderedKeys: RestaurantSectionKey[] = [
    "intro",
    "atmosphere",
    "menu",
    "foodReview",
    "summary",
    "closing",
  ];

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
      appendSectionParts(parts, label, section.content, section.images);
    }

    if (key === "intro") {
      parts.push(
        formatBasicInfoMarkdown(
          applied.basicInfo,
          applied.location,
          applied.mapProvider,
        ),
        "",
      );
    }
  }

  return parts.join("\n").trim();
}

/** 가져오기 조건: 지역 + 맛집명 2개 필드 입력 */
export function canImportRestaurant(data: RestaurantTemplateData): boolean {
  return (
    data.region.trim().length >= 1 && data.restaurantName.trim().length >= 1
  );
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

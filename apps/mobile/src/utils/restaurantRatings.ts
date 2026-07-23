import type { RestaurantRatingKey, RestaurantRatings } from "../types";

export const RATING_KEYS: RestaurantRatingKey[] = [
  "taste",
  "price",
  "service",
  "cleanliness",
  "revisit",
];

export const RATING_LABELS: Record<RestaurantRatingKey, string> = {
  taste: "맛",
  price: "가격",
  service: "서비스",
  cleanliness: "청결",
  revisit: "재방문의사",
};

export function createDefaultRatings(): RestaurantRatings {
  return {
    taste: 5,
    price: 4,
    service: 5,
    cleanliness: 5,
    revisit: 5,
  };
}

export function starsToText(count: number): string {
  const n = Math.max(0, Math.min(5, Math.round(count)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

/** 한 줄에 뭉친 ✔ 맛 ★… ✔ 가격 ★… → 줄마다 분리 */
export function expandInlineStarRatings(text: string): string {
  let s = String(text ?? "");
  // ✔/✓ 라벨 앞에 줄바꿈 (문장 중간 가로 나열 방지)
  // 단, 목록 마커(-/*/•)만 앞에 있으면 분리하지 않음 → 단독 "-" 줄 방지
  s = s.replace(
    /([^\n])\s*([✔✓])\s*(맛|가격|서비스|청결|재방문의사)\s*([★☆]+)/g,
    (full, before: string, check: string, label: string, stars: string) => {
      if (/^[-*•]$/.test(before)) return full;
      return `${before}\n${check} ${label} ${stars}`;
    },
  );
  s = s.replace(
    /([✔✓]\s*(?:맛|가격|서비스|청결|재방문의사)\s*[★☆]+)\s+(?=[✔✓])/g,
    "$1\n",
  );
  // 별점 뒤에 이어진 일반 문장 분리
  s = s.replace(
    /^([-*•]?\s*[✔✓]\s*(?:맛|가격|서비스|청결|재방문의사)\s*[★☆]+)\s+([^✔✓\n★☆].+)$/gm,
    "$1\n\n$2",
  );
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildSummaryContent(
  ratings: RestaurantRatings,
  headText: string,
  tailText: string,
): string {
  const head = headText.trim() || "전체적으로 만족도가 높은 식사였습니다.";
  // 앞에 "-" 없이 줄 단위로 — HTML/미리보기에서 <ul><li> 또는 줄바꿈으로 세로 정렬
  const starLines = RATING_KEYS.map(
    (k) => `✔ ${RATING_LABELS[k]} ${starsToText(ratings[k])}`,
  ).join("\n");
  const tail =
    tailText.trim() ||
    "맛있는 음식을 찾는다면 한 번 방문해 보시는 것을 추천드립니다.";
  return `${head}\n\n${starLines}\n\n${tail}`;
}

const STAR_ITEM_RE =
  /[✔✓]\s*(맛|가격|서비스|청결|재방문의사)\s*([★☆]+)/g;
const STAR_LINE_RE =
  /^[-*•]?\s*[✔✓]\s*(맛|가격|서비스|청결|재방문의사)\s*[★☆]+/;

export function parseSummaryContent(content: string): {
  headText: string;
  tailText: string;
  ratings: RestaurantRatings;
} {
  const ratings = createDefaultRatings();
  const expanded = expandInlineStarRatings(content);
  const lines = expanded.split("\n");
  const starLineIndices: number[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!STAR_LINE_RE.test(trimmed) && !/[✔✓]\s*(?:맛|가격|서비스|청결|재방문의사)/.test(trimmed)) {
      return;
    }
    starLineIndices.push(i);
    STAR_ITEM_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = STAR_ITEM_RE.exec(trimmed)) !== null) {
      const label = m[1];
      const stars = (m[2].match(/★/g) ?? []).length;
      if (label === "맛") ratings.taste = stars;
      else if (label === "가격") ratings.price = stars;
      else if (label === "서비스") ratings.service = stars;
      else if (label === "청결") ratings.cleanliness = stars;
      else if (label === "재방문의사") ratings.revisit = stars;
    }
  });

  if (starLineIndices.length === 0) {
    return {
      headText: expanded.trim(),
      tailText: "",
      ratings,
    };
  }

  const firstStar = starLineIndices[0];
  const lastStar = starLineIndices[starLineIndices.length - 1];
  const headText = lines.slice(0, firstStar).join("\n").trim();
  const tailText = lines.slice(lastStar + 1).join("\n").trim();

  return { headText, tailText, ratings };
}

export function normalizeRatings(raw: unknown): RestaurantRatings {
  const d = createDefaultRatings();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Partial<RestaurantRatings>;
  for (const k of RATING_KEYS) {
    const v = r[k];
    if (typeof v === "number" && v >= 0 && v <= 5) d[k] = Math.round(v);
  }
  return d;
}

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

export function buildSummaryContent(
  ratings: RestaurantRatings,
  headText: string,
  tailText: string,
): string {
  const head = headText.trim() || "전체적으로 만족도가 높은 식사였습니다.";
  const starLines = RATING_KEYS.map(
    (k) => `✔ ${RATING_LABELS[k]} ${starsToText(ratings[k])}`,
  ).join("\n");
  const tail =
    tailText.trim() ||
    "맛있는 음식을 찾는다면 한 번 방문해 보시는 것을 추천드립니다.";
  return `${head}\n\n${starLines}\n\n${tail}`;
}

const STAR_LINE_RE = /^✔\s*(맛|가격|서비스|청결|재방문의사)\s*[★☆]+/m;

export function parseSummaryContent(content: string): {
  headText: string;
  tailText: string;
  ratings: RestaurantRatings;
} {
  const ratings = createDefaultRatings();
  const lines = content.split("\n");
  const starLineIndices: number[] = [];

  lines.forEach((line, i) => {
    if (!STAR_LINE_RE.test(line.trim())) return;
    starLineIndices.push(i);
    const taste = line.match(/맛\s*([★☆]+)/);
    const price = line.match(/가격\s*([★☆]+)/);
    const service = line.match(/서비스\s*([★☆]+)/);
    const clean = line.match(/청결\s*([★☆]+)/);
    const revisit = line.match(/재방문의사\s*([★☆]+)/);
    if (taste) ratings.taste = (taste[1].match(/★/g) ?? []).length;
    if (price) ratings.price = (price[1].match(/★/g) ?? []).length;
    if (service) ratings.service = (service[1].match(/★/g) ?? []).length;
    if (clean) ratings.cleanliness = (clean[1].match(/★/g) ?? []).length;
    if (revisit) ratings.revisit = (revisit[1].match(/★/g) ?? []).length;
  });

  if (starLineIndices.length === 0) {
    return {
      headText: content.trim(),
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

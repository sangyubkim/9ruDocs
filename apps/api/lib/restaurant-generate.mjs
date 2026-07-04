const RATING_KEYS = ["taste", "price", "service", "cleanliness", "revisit"];
const RATING_LABELS = {
  taste: "맛",
  price: "가격",
  service: "서비스",
  cleanliness: "청결",
  revisit: "재방문의사",
};

function starsToText(count) {
  const n = Math.max(0, Math.min(5, Math.round(Number(count) || 0)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function formatRestaurantContext(restaurant) {
  if (!restaurant) return "";
  const lines = [];
  lines.push(`지역: ${restaurant.region ?? ""}`);
  lines.push(`맛집명: ${restaurant.restaurantName ?? ""}`);
  lines.push(`대표메뉴: ${restaurant.mainMenu ?? ""}`);

  const info = restaurant.basicInfo ?? {};
  lines.push("\n[기본 정보]");
  lines.push(`상호: ${info.name ?? ""}`);
  lines.push(`주소: ${info.address ?? ""}`);
  lines.push(`영업시간: ${info.hours ?? ""}`);
  lines.push(`전화: ${info.phone ?? ""}`);
  lines.push(`주차: ${info.parking ?? ""}`);
  lines.push(`예약: ${info.reservation ?? ""}`);

  const sections = Array.isArray(restaurant.sections) ? restaurant.sections : [];
  for (const s of sections) {
    if (s.key === "summary") continue;
    lines.push(`\n[${s.key}]`);
    lines.push(String(s.content ?? "").trim());
  }

  const ratings = restaurant.ratings ?? {};
  lines.push("\n[별점]");
  for (const k of RATING_KEYS) {
    lines.push(`${RATING_LABELS[k]}: ${starsToText(ratings[k])}`);
  }

  if (restaurant.summaryHead) {
    lines.push(`\n총평: ${restaurant.summaryHead}`);
  }
  if (restaurant.summaryTail) {
    lines.push(`추천: ${restaurant.summaryTail}`);
  }

  return lines.join("\n");
}

function fallbackGenerate(restaurant) {
  const title =
    restaurant?.restaurantName?.trim() ||
    restaurant?.basicInfo?.name?.trim() ||
    "맛집 후기";
  const region = restaurant?.region?.trim() ?? "";
  const bodyParts = [`# ${title}`, ""];

  const sections = Array.isArray(restaurant?.sections) ? restaurant.sections : [];
  const labelMap = {
    intro: "도입부",
    atmosphere: "매장 분위기",
    menu: "메뉴 소개",
    foodReview: "음식 리뷰",
    summary: "총평",
    closing: "마무리",
  };

  for (const s of sections) {
    const label = labelMap[s.key] ?? s.key;
    bodyParts.push(`## ${label}`, "", String(s.content ?? "").trim(), "");
  }

  const info = restaurant?.basicInfo ?? {};
  bodyParts.splice(
    4,
    0,
    "## 기본 정보",
    "",
    `📍 ${info.name ?? ""} | ${info.address ?? ""}`,
    `🕒 ${info.hours ?? ""} | ☎️ ${info.phone ?? ""}`,
    "",
  );

  return {
    title: region ? `${region} ${title}` : title,
    body: bodyParts.join("\n").trim(),
    excerpt: `${region} ${title} 방문 후기`.trim(),
    suggestedTags: [region, title, "맛집", restaurant?.mainMenu].filter(Boolean),
  };
}

async function generateWithOpenAi(restaurant, env) {
  const context = formatRestaurantContext(restaurant);

  const system = `당신은 한국어 네이버 블로그 SEO 전문 작가입니다.
사용자가 입력한 맛집 리뷰 메모를 바탕으로, 조회수 높은 맛집 블로그처럼 읽기 쉽고 검색에 유리한 Markdown 글을 작성합니다.
원문을 그대로 복사하지 말고 자연스럽게 다듬되, 사실 관계는 유지하세요.
이모지는 적절히 사용하고, 소제목과 문단을 명확히 나누세요.`;

  const user = `아래 맛집 리뷰 입력을 SEO 최적화 블로그 글로 작성해 주세요.

${context}

JSON만 반환:
{
  "title": "블로그 제목",
  "body": "Markdown 본문 (h1~h3, 목록, 별점 포함)",
  "excerpt": "2~3문장 SEO 요약",
  "suggestedTags": ["태그1", "태그2"]
}`;

  const res = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  const parsed = JSON.parse(content);
  return {
    title: String(parsed.title ?? "맛집 후기"),
    body: String(parsed.body ?? ""),
    excerpt: String(parsed.excerpt ?? ""),
    suggestedTags: Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags.map(String)
      : [],
  };
}

export async function generateRestaurantBlog(body, env) {
  const restaurant = body?.restaurant;
  if (!restaurant) {
    throw new Error("restaurant data is required");
  }

  const hasContent =
    String(restaurant.restaurantName ?? "").trim() ||
    (Array.isArray(restaurant.sections) &&
      restaurant.sections.some((s) => String(s.content ?? "").trim().length > 10));

  if (!hasContent) {
    throw new Error("맛집명 또는 섹션 내용을 먼저 입력해 주세요.");
  }

  if (env.openaiApiKey) {
    try {
      return await generateWithOpenAi(restaurant, env);
    } catch {
      return fallbackGenerate(restaurant);
    }
  }

  return fallbackGenerate(restaurant);
}

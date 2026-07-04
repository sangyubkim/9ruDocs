import {
  buildRestaurantSearchQueries,
  searchNaverBlogs,
  stripHtml,
} from "./blog-search.mjs";
import { fetchBlogText } from "./blog-fetch.mjs";

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

✔ 맛 ★★★★★
✔ 가격 ★★★★☆
✔ 서비스 ★★★★★
✔ 청결 ★★★★★
✔ 재방문의사 ★★★★★

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

function parseVars(body) {
  const region = String(body?.region ?? "").trim();
  const restaurantName = String(body?.restaurantName ?? "").trim();
  const mainMenu = String(body?.mainMenu ?? "").trim() || "대표 메뉴";
  return { region, restaurantName, mainMenu };
}

function formatOpenAiResult(parsed, vars, meta = {}) {
  const sections = parsed.sections ?? {};
  const basic = parsed.basicInfo ?? {};

  return {
    title: String(parsed.title ?? `${vars.region} ${vars.restaurantName}`),
    region: vars.region,
    restaurantName: vars.restaurantName,
    mainMenu: vars.mainMenu,
    basicInfo: {
      name: String(basic.name ?? vars.restaurantName),
      address: String(basic.address ?? ""),
      hours: String(basic.hours ?? ""),
      phone: String(basic.phone ?? ""),
      parking: String(basic.parking ?? ""),
      reservation: String(basic.reservation ?? ""),
    },
    sections: {
      intro: String(sections.intro ?? DEFAULT_SECTIONS.intro),
      atmosphere: String(sections.atmosphere ?? DEFAULT_SECTIONS.atmosphere),
      menu: String(sections.menu ?? DEFAULT_SECTIONS.menu),
      foodReview: String(sections.foodReview ?? DEFAULT_SECTIONS.foodReview),
      summary: String(sections.summary ?? DEFAULT_SECTIONS.summary),
      closing: String(sections.closing ?? DEFAULT_SECTIONS.closing),
    },
    excerpt: String(parsed.excerpt ?? ""),
    suggestedTags: Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags.map(String)
      : [vars.region, "맛집", vars.restaurantName],
    ...meta,
  };
}

function fallbackImport(body) {
  const vars = parseVars(body);

  return {
    title: `${vars.region} ${vars.restaurantName} 맛집 후기`.trim(),
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
      searchedQuery: "",
      sourceCount: 0,
      message: "블로그 검색 없이 기본 템플릿으로 채웠습니다.",
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
    "name": "상호명",
    "address": "주소 (참고 글에 있으면 추출, 없으면 일반 안내)",
    "hours": "영업시간",
    "phone": "전화번호 없으면 빈 문자열",
    "parking": "주차 안내",
    "reservation": "예약 안내"
  },
  "sections": {
    "intro": "도입부",
    "atmosphere": "매장 분위기",
    "menu": "메뉴 소개",
    "foodReview": "음식 리뷰",
    "summary": "별점 포함 총평 (✔ 맛 ★★★★★ 형식)",
    "closing": "마무리 인사"
  },
  "excerpt": "2~3문장 SEO 요약",
  "suggestedTags": ["태그1", "태그2"]
}`;

async function importWithOpenAiOnly(body, env) {
  const vars = parseVars(body);

  const system = `당신은 한국어 네이버 블로그 맛집 리뷰 작가입니다.
인기 맛집 블로그의 구조와 톤을 참고하되, 문장은 새로 작성합니다.
솔직한 1인칭 후기 톤, 이모지는 섹션 제목 외 최소화.`;

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
섹션별로 나누어 SEO에 유리하게 최적화하세요.`;

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
async function collectBlogSources(body, env) {
  if (!env.naverClientId || !env.naverClientSecret) {
    return { collected: [], searchedQuery: "" };
  }

  const vars = parseVars(body);
  const queries = buildRestaurantSearchQueries(vars);
  const primaryQuery = queries[0] ?? "";

  const [simHits, dateHits] = await Promise.all([
    searchForSort(queries, env, "sim"),
    searchForSort(queries, env, "date"),
  ]);

  const searchHits = mergeBySortStrategy(simHits, dateHits, 6);

  const collected = [];

  for (const hit of searchHits) {
    let text = hit.description || "";
    try {
      const full = await fetchBlogText(hit.link, { maxChars: 4500 });
      if (full.length > text.length) text = full;
    } catch {
      /* 스니펫만 사용 */
    }

    if (text.length < 30) continue;

    collected.push({
      title: hit.title || stripHtml(hit.title),
      url: hit.link,
      blogger: hit.blogger,
      text,
      matchedSort: hit.matchedSort,
      postDate: hit.postDate,
    });

    if (collected.length >= 4) break;
  }

  return { collected, searchedQuery: primaryQuery };
}

export async function importRestaurantBlog(body, env) {
  const vars = parseVars(body);

  if (!vars.region || !vars.restaurantName) {
    throw new Error("region and restaurantName are required");
  }

  let collected = [];
  let searchedQuery = "";

  try {
    const result = await collectBlogSources(body, env);
    collected = result.collected;
    searchedQuery = result.searchedQuery;
  } catch {
    collected = [];
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
      /* AI 최적화 실패 시 아래 fallback */
    }
  }

  if (env.openaiApiKey) {
    try {
      return await importWithOpenAiOnly(body, env);
    } catch {
      return fallbackImport(body);
    }
  }

  const fb = fallbackImport(body);
  if (!env.naverClientId || !env.naverClientSecret) {
    fb.importMeta.message =
      "네이버 검색 API 키가 없어 블로그 검색 없이 템플릿으로 채웠습니다. apps/api/.env에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET을 설정하세요.";
  }
  return fb;
}

export { DEFAULT_BASIC };

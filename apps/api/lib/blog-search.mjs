/** HTML 태그 제거 및 엔티티 디코딩 */
export function stripHtml(html) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} query
 * @param {{ naverClientId: string; naverClientSecret: string }} env
 * @param {{ display?: number; sort?: 'sim' | 'date' }} opts
 */
export async function searchNaverBlogs(query, env, opts = {}) {
  const display = Math.min(Math.max(opts.display ?? 5, 1), 10);
  const sort = opts.sort ?? "sim";

  const url = new URL("https://openapi.naver.com/v1/search/blog.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("sort", sort);

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": env.naverClientId,
      "X-Naver-Client-Secret": env.naverClientSecret,
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Naver search ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];

  return items.map((item) => ({
    title: stripHtml(item.title),
    link: String(item.link ?? "").trim(),
    description: stripHtml(item.description),
    blogger: String(item.bloggername ?? "").trim(),
    postDate: String(item.postdate ?? "").trim(),
  }));
}

export function buildRestaurantSearchQueries({ region, restaurantName, mainMenu }) {
  const r = String(region ?? "").trim();
  const name = String(restaurantName ?? "").trim();
  const menu = String(mainMenu ?? "").trim();

  const queries = [];
  if (r && name) queries.push(`${r} ${name} 맛집`);
  if (r && name && menu) queries.push(`${r} ${name} ${menu}`);
  if (r && menu) queries.push(`${r} ${menu} 맛집`);
  if (name && menu) queries.push(`${name} ${menu}`);

  return [...new Set(queries.filter(Boolean))];
}

function wpAuthHeader(username, appPassword) {
  const token = Buffer.from(`${username}:${appPassword}`).toString("base64");
  return `Basic ${token}`;
}

function wpBase(siteUrl) {
  return siteUrl.replace(/\/+$/, "");
}

/**
 * @param {string} raw
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
export function normalizeWordPressSiteUrl(raw) {
  let input = String(raw ?? "").trim();
  if (!input) {
    return { ok: false, error: "사이트 URL을 입력하세요." };
  }

  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return {
      ok: false,
      error: "올바른 URL 형식이 아닙니다. 예: https://yoursite.com",
    };
  }

  if (!parsed.hostname) {
    return {
      ok: false,
      error: "올바른 URL 형식이 아닙니다. 예: https://yoursite.com",
    };
  }

  let pathname = parsed.pathname.replace(/\/+$/, "") || "";
  pathname = pathname.replace(/\/wp-admin(\/.*)?$/i, "");
  pathname = pathname.replace(/\/wp-login\.php$/i, "");
  pathname = pathname.replace(/\/wp-json(\/.*)?$/i, "");

  const origin = `${parsed.protocol}//${parsed.host}`;
  const url = pathname ? `${origin}${pathname}` : origin;
  return { ok: true, url: url.replace(/\/+$/, "") };
}

function wpErrorFromResponse(status, json, requestUrl) {
  const wpMessage = json?.message ?? json?.code ?? null;

  if (status === 401) {
    return new Error(
      "인증에 실패했습니다. 사용자명과 애플리케이션 비밀번호를 확인하세요. (일반 로그인 비밀번호는 사용할 수 없습니다.)",
    );
  }
  if (status === 403) {
    return new Error(
      wpMessage
        ? `접근이 거부되었습니다: ${wpMessage}`
        : "접근이 거부되었습니다. 해당 계정에 REST API 권한이 있는지 확인하세요.",
    );
  }
  if (status === 404) {
    return new Error(
      `WordPress REST API 엔드포인트를 찾을 수 없습니다.\n요청: ${requestUrl}\n사이트 URL이 루트 도메인(https://도메인)인지, /wp-admin·/wp-json 경로가 붙지 않았는지, 고유주소(permalink) 설정을 확인하세요.`,
    );
  }

  return new Error(
    wpMessage ? String(wpMessage) : `WordPress 오류 (${status})`,
  );
}

async function checkWordPressRestApi(siteUrl) {
  const url = `${wpBase(siteUrl)}/wp-json/`;
  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `사이트에 연결할 수 없습니다: ${msg}\nURL(https 포함)·인터넷·방화벽을 확인하세요.`,
    );
  }

  if (res.status === 404) {
    throw new Error(
      "WordPress REST API(/wp-json/)를 찾을 수 없습니다.\n사이트 URL 예: https://yoursite.com (끝에 /wp-admin, /wp-json 붙이지 마세요)\n고유주소(permalink)가 '기본'이 아닌지, REST API 차단 플러그인이 없는지 확인하세요.",
    );
  }

  if (!res.ok) {
    throw new Error(
      `WordPress REST API 응답 오류 (HTTP ${res.status}). 사이트 URL·SSL 인증서를 확인하세요.`,
    );
  }
}

async function wpFetch(siteUrl, username, appPassword, path, init = {}) {
  const url = `${wpBase(siteUrl)}/wp-json/wp/v2${path}`;
  const headers = {
    Authorization: wpAuthHeader(username, appPassword),
    ...(init.headers ?? {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw wpErrorFromResponse(res.status, json, url);
  }
  return json;
}

export async function uploadMedia(siteUrl, username, appPassword, image) {
  const buffer = Buffer.from(image.base64, "base64");
  const filename = image.filename ?? "image.jpg";
  const mime = image.mimeType ?? "image/jpeg";

  return wpFetch(siteUrl, username, appPassword, "/media", {
    method: "POST",
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
    body: buffer,
  });
}

export async function resolveTagIds(siteUrl, username, appPassword, tagNames) {
  const ids = [];
  for (const name of tagNames) {
    const trimmed = String(name).trim();
    if (!trimmed) continue;

    const found = await wpFetch(
      siteUrl,
      username,
      appPassword,
      `/tags?search=${encodeURIComponent(trimmed)}&per_page=5`,
    );

    const exact = Array.isArray(found)
      ? found.find((t) => t.name?.toLowerCase() === trimmed.toLowerCase())
      : null;

    if (exact?.id) {
      ids.push(exact.id);
      continue;
    }

    const created = await wpFetch(siteUrl, username, appPassword, "/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (created?.id) ids.push(created.id);
  }
  return [...new Set(ids)];
}

function buildSeoContent({ content, excerpt, seo }) {
  const summary = seo?.metaDescription ?? excerpt ?? "";
  const block = summary
    ? `> **요약:** ${summary}\n\n`
    : "";
  return block + content;
}

function normalizeAppPassword(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
}

export async function verifyWordPressCredentials(body, env) {
  const rawSiteUrl = body?.siteUrl?.trim() || env.wpSiteUrl;
  const username = body?.username?.trim() || env.wpUsername;
  const appPassword =
    normalizeAppPassword(body?.appPassword) || normalizeAppPassword(env.wpAppPassword);

  if (!rawSiteUrl || !username || !appPassword) {
    throw new Error(
      "WordPress 자격 증명이 없습니다. 사이트 URL, 사용자명, 애플리케이션 비밀번호를 입력하거나 서버 .env를 설정하세요.",
    );
  }

  const normalized = normalizeWordPressSiteUrl(rawSiteUrl);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }
  const siteUrl = normalized.url;

  await checkWordPressRestApi(siteUrl);

  const user = await wpFetch(siteUrl, username, appPassword, "/users/me");
  return {
    ok: true,
    message: "WordPress 연결 성공",
    user: {
      id: user?.id ?? null,
      name: user?.name ?? null,
      slug: user?.slug ?? null,
    },
    siteUrl,
  };
}

export async function publishToWordPress(body, env) {
  const rawSiteUrl = body?.siteUrl?.trim() || env.wpSiteUrl;
  const username = body?.username?.trim() || env.wpUsername;
  const appPassword =
    normalizeAppPassword(body?.appPassword) || normalizeAppPassword(env.wpAppPassword);

  if (!rawSiteUrl || !username || !appPassword) {
    throw new Error(
      "WordPress 자격 증명이 없습니다. 사이트 URL, 사용자명, 애플리케이션 비밀번호를 입력하거나 서버 .env를 설정하세요.",
    );
  }

  const normalized = normalizeWordPressSiteUrl(rawSiteUrl);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }
  const siteUrl = normalized.url;

  const title = String(body?.title ?? "").trim();
  const content = String(body?.content ?? body?.body ?? "").trim();
  if (!title || !content) {
    throw new Error("title and content are required");
  }

  const status = body?.status === "publish" ? "publish" : "draft";
  const excerpt = String(body?.excerpt ?? "").trim();
  const tagNames = Array.isArray(body?.tags) ? body.tags.map(String) : [];
  const images = Array.isArray(body?.images) ? body.images : [];
  const seo = body?.seo ?? {};

  const mediaIds = [];
  const mediaUrls = [];

  for (const img of images) {
    if (!img?.base64) continue;
    const media = await uploadMedia(siteUrl, username, appPassword, img);
    if (media?.id) mediaIds.push(media.id);
    if (media?.source_url) mediaUrls.push(media.source_url);
  }

  let finalContent = buildSeoContent({ content, excerpt, seo });

  if (mediaUrls.length) {
    const imgs = mediaUrls.map((u) => `![step](${u})`).join("\n\n");
    finalContent = `${finalContent}\n\n## 이미지\n\n${imgs}`;
  }

  const tagIds = tagNames.length
    ? await resolveTagIds(siteUrl, username, appPassword, tagNames)
    : [];

  const postPayload = {
    title,
    content: finalContent,
    excerpt,
    status,
    tags: tagIds,
  };

  if (mediaIds[0]) {
    postPayload.featured_media = mediaIds[0];
  }

  const post = await wpFetch(siteUrl, username, appPassword, "/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postPayload),
  });

  const yoastRoute = env.wpYoastMetaRoute?.trim();
  if (yoastRoute && post?.id && (seo.yoastTitle || seo.yoastDescription)) {
    try {
      const path = yoastRoute.startsWith("/") ? yoastRoute : `/${yoastRoute}`;
      const url = `${wpBase(siteUrl)}/wp-json${path}/${post.id}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: wpAuthHeader(username, appPassword),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          yoast_wpseo_title: seo.yoastTitle ?? title,
          yoast_wpseo_metadesc: seo.yoastDescription ?? excerpt,
        }),
      });
      if (!res.ok) {
        throw new Error(`Yoast meta ${res.status}`);
      }
    } catch (e) {
      console.warn("Yoast meta skipped:", e.message);
    }
  }

  return {
    postId: post.id,
    link: post.link,
    editLink: post.link ? `${post.link}?preview=true` : null,
    featuredMediaId: mediaIds[0] ?? null,
    tagIds,
    seoApplied: Boolean(excerpt || seo.metaDescription),
  };
}

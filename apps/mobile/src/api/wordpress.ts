import { apiFetch, isApiConnectionError } from "./client";
import {
  loadWpSettings,
  normalizeWordPressSiteUrl,
  type WpSettings,
} from "../storage/wpSettingsStorage";

export type PublishImage = {
  base64: string;
  filename: string;
  mimeType: string;
};

export type PublishRequest = {
  title: string;
  content: string;
  excerpt: string;
  status?: "draft" | "publish";
  tags: string[];
  /** WP post slug (영문 케밥) */
  slug?: string;
  /** 대표(첫) 미디어 대체 텍스트 */
  imageAlt?: string;
  /** 대표(첫) 미디어 캡션 */
  imageCaption?: string;
  images?: PublishImage[];
  seo?: {
    metaDescription?: string;
    yoastTitle?: string;
    yoastDescription?: string;
  };
  siteUrl?: string;
  username?: string;
  appPassword?: string;
};

export type PublishResponse = {
  postId: number;
  link: string;
  editLink: string | null;
  featuredMediaId: number | null;
  tagIds: number[];
  seoApplied: boolean;
};

export type VerifyWordPressResponse = {
  ok: boolean;
  message: string;
  user: { id: number | null; name: string | null; slug: string | null };
  siteUrl: string;
};

type VerifyErrorBody = {
  error?: string;
  hint?: string;
  code?: string;
};

async function withStoredCredentials(
  creds?: Partial<WpSettings>,
): Promise<Partial<WpSettings>> {
  const stored = await loadWpSettings();
  const rawSiteUrl = creds?.siteUrl?.trim() || stored.siteUrl || "";
  let siteUrl: string | undefined;
  if (rawSiteUrl) {
    const siteNorm = normalizeWordPressSiteUrl(rawSiteUrl);
    if (!siteNorm.ok) {
      // 깨진 로컬 URL은 보내지 않음 → 서버 WP_SITE_URL 폴백
      siteUrl = undefined;
    } else {
      siteUrl = siteNorm.url;
    }
  }
  return {
    siteUrl,
    username: creds?.username?.trim() || stored.username || undefined,
    appPassword:
      creds?.appPassword?.trim().replace(/\s+/g, "") ||
      stored.appPassword ||
      undefined,
  };
}

function isMissingVerifyRoute(status: number, body: VerifyErrorBody): boolean {
  if (status !== 404) return false;
  const msg = body.error?.trim().toLowerCase() ?? "";
  return (
    body.code === "route_not_found" ||
    !msg ||
    msg === "not found" ||
    msg.includes("not found")
  );
}

/** API(9ruDocs) 문제 vs WordPress 자격 증명·사이트 문제 구분 */
function formatVerifyError(status: number, body: VerifyErrorBody): string {
  if (isMissingVerifyRoute(status, body)) {
    const hint = body.hint?.trim();
    return (
      "9ruDocs API에 WordPress 연결 확인(/wordpress/verify) 기능이 없습니다.\n" +
      "PC에서 scripts\\start-api.bat 으로 API 재시작이 필요합니다.\n" +
      "또는 scripts\\restart-api.bat 을 실행하세요.\n" +
      "설정의 API 주소(예: http://192.168.0.10:3001)가 PC IP·포트 3001인지 확인하세요." +
      (hint ? `\n\n${hint}` : "")
    );
  }

  const msg = body.error?.trim();
  if (msg) return msg;

  if (status >= 500) {
    return `9ruDocs API 서버 오류 (HTTP ${status}). PC 터미널의 API 로그를 확인하세요.`;
  }

  return `WordPress 연결 확인 실패 (HTTP ${status})`;
}

function requireVerifyCredentials(merged: Partial<WpSettings>): {
  siteUrl: string;
  username: string;
  appPassword: string;
} {
  const siteUrl = merged.siteUrl?.trim() ?? "";
  const username = merged.username?.trim() ?? "";
  const appPassword = merged.appPassword?.trim() ?? "";
  if (!siteUrl || !username || !appPassword) {
    throw new Error(
      "WordPress 사이트 URL, 사용자명, 애플리케이션 비밀번호를 모두 입력하세요.\n" +
        "(일반 로그인 비밀번호가 아닌, WordPress에서 발급한 애플리케이션 비밀번호입니다.)",
    );
  }
  return { siteUrl, username, appPassword };
}

export async function verifyWordPress(
  creds?: Partial<WpSettings>,
): Promise<VerifyWordPressResponse> {
  const merged = await withStoredCredentials(creds);
  const body = requireVerifyCredentials(merged);

  let res: Response;
  try {
    res = await apiFetch("/wordpress/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteUrl: body.siteUrl,
        username: body.username,
        appPassword: body.appPassword,
      }),
    });
  } catch (e) {
    if (isApiConnectionError(e)) throw e;
    throw e;
  }

  let json: VerifyWordPressResponse & VerifyErrorBody;
  try {
    const text = await res.text();
    if (!text.trim()) {
      throw new Error(
        `9ruDocs API 응답이 비어 있습니다 (HTTP ${res.status}).\n` +
          "API 주소가 올바른지(예: …/apps/api) 확인하고, API를 재시작했는지 확인하세요.",
      );
    }
    try {
      json = JSON.parse(text) as VerifyWordPressResponse & VerifyErrorBody;
    } catch {
      const snippet = text.replace(/\s+/g, " ").slice(0, 160);
      throw new Error(
        `9ruDocs API 응답을 해석할 수 없습니다 (HTTP ${res.status}).\n` +
          "API 주소가 올바른지(예: …/apps/api) 확인하세요.\n" +
          `응답 미리보기: ${snippet}`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("API")) throw e;
    throw new Error(
      "9ruDocs API 응답을 해석할 수 없습니다. API 주소가 올바른지(예: …/apps/api) 확인하세요.",
    );
  }

  if (!res.ok) {
    throw new Error(formatVerifyError(res.status, json));
  }

  return json;
}

export async function publishToWordPress(
  payload: PublishRequest,
): Promise<PublishResponse> {
  const creds = await withStoredCredentials({
    siteUrl: payload.siteUrl,
    username: payload.username,
    appPassword: payload.appPassword,
  });
  let res: Response;
  try {
    res = await apiFetch("/wordpress/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, ...creds }),
    });
  } catch (e) {
    if (isApiConnectionError(e)) throw e;
    throw e;
  }
  let json: PublishResponse & { error?: string };
  try {
    const text = await res.text();
    if (!text.trim()) {
      throw new Error(
        `9ruDocs API 응답이 비어 있습니다 (HTTP ${res.status}).\n` +
          "사진이 많거나 크면 서버/프록시 한도를 넘을 수 있습니다. 사진을 줄인 뒤 다시 시도하세요.",
      );
    }
    try {
      json = JSON.parse(text) as PublishResponse & { error?: string };
    } catch {
      const snippet = text.replace(/\s+/g, " ").slice(0, 160);
      throw new Error(
        `9ruDocs API 응답을 해석할 수 없습니다 (HTTP ${res.status}).\n` +
          "API 주소가 올바른지(예: …/apps/api) 확인하고, 사진 용량을 줄인 뒤 다시 시도하세요.\n" +
          `응답 미리보기: ${snippet}`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("API")) throw e;
    throw new Error(
      "9ruDocs API 응답을 해석할 수 없습니다. API 주소가 올바른지(예: …/apps/api) 확인하세요.",
    );
  }
  if (!res.ok) {
    throw new Error(json.error ?? `Publish failed: ${res.status}`);
  }
  return json;
}

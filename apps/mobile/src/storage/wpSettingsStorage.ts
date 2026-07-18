import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@9rudocs/wp-settings";

export type WpSettings = {
  siteUrl: string;
  username: string;
  appPassword: string;
};

const EMPTY: WpSettings = {
  siteUrl: "",
  username: "",
  appPassword: "",
};

export type NormalizeSiteUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** WordPress 사이트 URL 정규화 (https 보정, /wp-admin·/wp-json 제거) */
export function normalizeWordPressSiteUrl(raw: string): NormalizeSiteUrlResult {
  let input = String(raw ?? "").trim();
  if (!input) {
    return { ok: false, error: "사이트 URL을 입력하세요." };
  }

  const invalidMsg =
    "올바른 URL 형식이 아닙니다. 예: https://yoursite.com";

  // 중복 scheme 제거: https://https://example.com → https://example.com
  input = input.replace(/^(https?:\/\/)+/i, (m) =>
    /^https/i.test(m) ? "https://" : "http://",
  );
  input = input.replace(/^(https?:\/\/)https?:\/+/i, "$1");

  if (/^https?:\/\/?$/i.test(input) || /^https?$/i.test(input)) {
    return { ok: false, error: invalidMsg };
  }

  if (!/^https?:\/\//i.test(input)) {
    input = input.startsWith("//") ? `https:${input}` : `https://${input}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: invalidMsg };
  }

  const hostname = String(parsed.hostname ?? "").trim().toLowerCase();
  if (!hostname || hostname === "http" || hostname === "https") {
    return { ok: false, error: invalidMsg };
  }

  const looksLikeHost =
    hostname === "localhost" ||
    hostname.includes(".") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  if (!looksLikeHost) {
    return { ok: false, error: invalidMsg };
  }

  let pathname = parsed.pathname.replace(/\/+$/, "") || "";
  pathname = pathname.replace(/\/wp-admin(\/.*)?$/i, "");
  pathname = pathname.replace(/\/wp-login\.php$/i, "");
  pathname = pathname.replace(/\/wp-json(\/.*)?$/i, "");
  if (pathname.startsWith("//")) {
    pathname = "";
  }

  const origin = `${parsed.protocol}//${parsed.host}`;
  const url = pathname ? `${origin}${pathname}` : origin;
  return { ok: true, url: url.replace(/\/+$/, "") };
}

function normalizeSettings(settings: WpSettings): WpSettings {
  const trimmed = settings.siteUrl.trim();
  const siteNorm = trimmed
    ? normalizeWordPressSiteUrl(trimmed)
    : { ok: true as const, url: "" };
  return {
    // 깨진 URL은 저장하지 않음 → 서버 .env 폴백 가능
    siteUrl: siteNorm.ok ? siteNorm.url : "",
    username: settings.username.trim(),
    appPassword: settings.appPassword.trim().replace(/\s+/g, ""),
  };
}

export async function loadWpSettings(): Promise<WpSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<WpSettings>;
    return normalizeSettings({
      siteUrl: String(parsed.siteUrl ?? ""),
      username: String(parsed.username ?? ""),
      appPassword: String(parsed.appPassword ?? ""),
    });
  } catch {
    return { ...EMPTY };
  }
}

export async function saveWpSettings(settings: WpSettings): Promise<void> {
  const payload = normalizeSettings(settings);
  await AsyncStorage.setItem(KEY, JSON.stringify(payload));
}

export async function clearWpSettings(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

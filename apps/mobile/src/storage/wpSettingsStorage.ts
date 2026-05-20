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

  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  let parsed: URL;
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

function normalizeSettings(settings: WpSettings): WpSettings {
  const siteNorm = settings.siteUrl.trim()
    ? normalizeWordPressSiteUrl(settings.siteUrl)
    : { ok: true as const, url: "" };
  return {
    siteUrl: siteNorm.ok ? siteNorm.url : settings.siteUrl.trim().replace(/\/+$/, ""),
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

import * as FileSystem from "expo-file-system";

import { getApiClientBaseUrl } from "../api/client";
import { buildStaticMapUrlCandidates } from "./maps";

const CACHE_DIR = `${FileSystem.cacheDirectory ?? ""}static-maps-v2/`;
const MAP_USER_AGENT =
  "9ruDocs/1.0 (contact: support@9ruinfo.com; static map preview)";

/** API 정적 지도 HTTPS URL (Image source에 바로 사용) */
export function buildApiStaticMapUrl(
  latitude: number,
  longitude: number,
): string | null {
  const apiBase = getApiClientBaseUrl();
  if (!apiBase) return null;
  return `${apiBase}/maps/static?lat=${latitude.toFixed(6)}&lng=${longitude.toFixed(6)}`;
}

/** API → 외부 정적맵 후보 URL 목록 (다운로드 없이 Image에 직접 표시용) */
export function buildStaticMapRemoteUrls(
  latitude: number,
  longitude: number,
): string[] {
  const urls: string[] = [];
  const apiUrl = buildApiStaticMapUrl(latitude, longitude);
  if (apiUrl) urls.push(apiUrl);
  return [...urls, ...buildStaticMapUrlCandidates(latitude, longitude)];
}

function cachePath(latitude: number, longitude: number, index: number): string {
  const key = `${latitude.toFixed(5)}_${longitude.toFixed(5)}_${index}`;
  return `${CACHE_DIR}${key.replace(/[^a-zA-Z0-9._-]/g, "_")}.png`;
}

async function ensureCacheDir(): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  } catch {
    /* already exists */
  }
}

async function isValidMapImage(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || (info.size ?? 0) < 800) return false;
    const head = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 16,
      position: 0,
    });
    return head.startsWith("iVBORw0KGgo") || head.startsWith("/9j/");
  } catch {
    return false;
  }
}

/**
 * 정적 지도 URL을 순서대로 시도해 로컬 file:// URI 반환.
 * Image 직접 로드 실패 시 폴백용.
 */
export async function loadStaticMapUri(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const urls = buildStaticMapRemoteUrls(latitude, longitude);
  await ensureCacheDir();

  for (let i = 0; i < urls.length; i++) {
    const dest = cachePath(latitude, longitude, i);
    try {
      const existing = await FileSystem.getInfoAsync(dest);
      if (existing.exists && (await isValidMapImage(dest))) return dest;
      if (existing.exists) {
        await FileSystem.deleteAsync(dest, { idempotent: true });
      }
    } catch {
      /* re-download */
    }

    try {
      const result = await FileSystem.downloadAsync(urls[i], dest, {
        headers: {
          "User-Agent": MAP_USER_AGENT,
          Accept: "image/png,image/jpeg,image/*,*/*",
        },
      });

      if (result.status >= 200 && result.status < 300) {
        const ok = await isValidMapImage(dest);
        if (ok) return dest;
      }
      await FileSystem.deleteAsync(dest, { idempotent: true });
    } catch {
      await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return null;
}

export const STATIC_MAP_LOAD_TIMEOUT_MS = 14_000;

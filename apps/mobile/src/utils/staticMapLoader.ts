import * as FileSystem from "expo-file-system";



import { buildStaticMapUrlCandidates } from "./maps";



const CACHE_DIR = `${FileSystem.cacheDirectory ?? ""}static-maps/`;

const DOWNLOAD_TIMEOUT_MS = 14_000;

const MAP_USER_AGENT =

  "Mozilla/5.0 (compatible; 9ruDocs/1.0; +https://github.com/9rudocs)";



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



/**

 * 정적 지도 URL을 순서대로 시도해 로컬 file:// URI 반환.

 * OSM 서버 차단·타임아웃 시 다음 후보로 넘어갑니다.

 */

export async function loadStaticMapUri(

  latitude: number,

  longitude: number,

): Promise<string | null> {

  const urls = buildStaticMapUrlCandidates(latitude, longitude);

  await ensureCacheDir();



  for (let i = 0; i < urls.length; i++) {

    const dest = cachePath(latitude, longitude, i);

    try {

      const existing = await FileSystem.getInfoAsync(dest);

      if (existing.exists) return dest;

    } catch {

      /* re-download */

    }



    try {

      const isTile = urls[i].includes("tile.openstreetmap.org");
      const result = await FileSystem.downloadAsync(urls[i], dest, {

        headers: {

          "User-Agent": MAP_USER_AGENT,

          Accept: "image/png,image/jpeg,image/*,*/*",

          ...(isTile ? { Referer: "https://www.openstreetmap.org/" } : {}),

        },

      });

      if (result.status >= 200 && result.status < 300) {

        return result.uri;

      }

      await FileSystem.deleteAsync(dest, { idempotent: true });

    } catch {

      await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});

    }



    await new Promise((r) => setTimeout(r, 400));

  }



  return null;

}



export { DOWNLOAD_TIMEOUT_MS as STATIC_MAP_LOAD_TIMEOUT_MS };


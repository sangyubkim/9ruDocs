import { Alert, Linking, Platform } from "react-native";
import * as Location from "expo-location";

import type { StepLocation } from "../types";
import {
  geocodePlaceNameNominatim,
  type GeocodeResult,
} from "./geocodePlace";

export type { GeocodeResult };

/**
 * Google Maps 링크는 API 키 없이 URL로 생성합니다 (Expo Go·프리뷰 APK 호환).
 * 앱 내 미리보기는 OSM 정적 이미지 기본 — MapView는
 * `EXPO_PUBLIC_USE_MAP_VIEW=true` + (Android) `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` 일 때만.
 */

/** 장소명 검색 URL */
export function buildGoogleSearchUrl(query: string): string {
  const q = encodeURIComponent(query.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** 좌표로 Google Maps 웹 URL */
export function buildGoogleLatLngUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

/** Android/iOS 네이티브 지도 앱 (geo 스킴) */
export function buildGoogleAppUrl(
  latitude: number,
  longitude: number,
  name: string,
): string {
  const label = encodeURIComponent(name.trim() || `${latitude},${longitude}`);
  if (Platform.OS === "android") {
    return `geo:${latitude},${longitude}?q=${label}`;
  }
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/** @deprecated buildGoogleSearchUrl 사용 */
export const buildNaverSearchUrl = buildGoogleSearchUrl;

/** @deprecated buildGoogleLatLngUrl 사용 */
export const buildNaverLatLngUrl = buildGoogleLatLngUrl;

/** @deprecated buildGoogleAppUrl 사용 */
export const buildNaverAppUrl = buildGoogleAppUrl;

/** 위·경도 → OSM 타일 좌표 (슬리피맵) */
export function latLngToTile(
  latitude: number,
  longitude: number,
  zoom: number,
): { x: number; y: number; z: number } {
  const latRad = (latitude * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y, z: zoom };
}

/** 단일 OSM 타일 — 모바일에서 정적맵 API보다 잘 로드되는 경우가 많음 */
export function buildOsmTileUrl(
  latitude: number,
  longitude: number,
  zoom = 13,
): string {
  const { x, y, z } = latLngToTile(latitude, longitude, zoom);
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/** OSM·위키미디어 등 정적 지도 URL 후보 (순서대로 시도) */
export function buildStaticMapUrlCandidates(
  latitude: number,
  longitude: number,
  width = 640,
  height = 240,
  zoom = 13,
): string[] {
  const center = `${latitude},${longitude}`;
  const markers = `${latitude},${longitude},red`;
  const size = `${width}x${height}`;
  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);
  const w = Math.min(Math.max(width, 320), 1280);
  const h = Math.min(Math.max(height, 120), 640);
  const wmSize = `${w}x${h}`;

  const tile = buildOsmTileUrl(latitude, longitude, zoom);
  const tileZoomOut = buildOsmTileUrl(latitude, longitude, Math.max(zoom - 1, 10));

  return [
    tile,
    tileZoomOut,
    `https://staticmap.openstreetmap.de/staticmap.php?center=${center}&zoom=${zoom}&size=${size}&markers=${lat},${lng}`,
    `https://staticmap.openstreetmap.de/staticmap.php?center=${center}&zoom=${zoom}&size=${size}&markers=${markers}`,
    `https://maps.wikimedia.org/img/osm-intl,${zoom},${lat},${lng},${wmSize}.png`,
    `https://staticmap.openstreetmap.de/staticmap.php?center=${center}&zoom=${zoom - 1}&size=${size}&markers=${lat},${lng},lightblue1`,
  ];
}

/** @deprecated buildStaticMapUrlCandidates 사용 권장 */
export function buildOsmStaticMapUrl(
  latitude: number,
  longitude: number,
  width = 640,
  height = 240,
  zoom = 15,
): string {
  return buildStaticMapUrlCandidates(latitude, longitude, width, height, zoom)[0];
}

export function isValidCoords(
  latitude: number | undefined,
  longitude: number | undefined,
): boolean {
  if (latitude == null || longitude == null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/** @deprecated geocodePlaceName + locationFromCoords 사용 */
export function locationFromPlaceName(placeName: string): StepLocation {
  const label = placeName.trim();
  return {
    label,
    mapsUrl: buildGoogleSearchUrl(label),
  };
}

/** 장소명 → 좌표 (Nominatim 우선, 실패 시 expo-location geocodeAsync) */
export async function geocodePlaceName(
  query: string,
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const nominatim = await geocodePlaceNameNominatim(trimmed);
    if (nominatim) return nominatim;
  } catch {
    /* expo-location 폴백 */
  }

  try {
    const results = await Location.geocodeAsync(trimmed);
    if (results.length > 0) {
      const { latitude, longitude } = results[0];
      if (isValidCoords(latitude, longitude)) {
        return { latitude, longitude, label: trimmed };
      }
    }
  } catch {
    /* null 반환 */
  }

  return null;
}

export function locationFromCoords(
  latitude: number,
  longitude: number,
  label: string,
): StepLocation {
  const trimmed = label.trim() || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return {
    label: trimmed,
    latitude,
    longitude,
    mapsUrl: buildGoogleLatLngUrl(latitude, longitude),
  };
}

export function formatLocationMarkdown(loc: StepLocation | null | undefined): string {
  if (!loc?.mapsUrl && !loc?.label) return "";
  const url =
    loc.mapsUrl ||
    (isValidCoords(loc.latitude, loc.longitude)
      ? buildGoogleLatLngUrl(loc.latitude!, loc.longitude!)
      : buildGoogleSearchUrl(loc.label));
  const text = loc.label || "구글 지도에서 보기";
  return `\n\n📍 [${text}](${url})\n`;
}

/** Google Maps 앱(geo/maps.google.com) 우선, 실패 시 웹 URL */
export async function openGoogleMaps(loc: StepLocation): Promise<void> {
  const webUrl =
    loc.mapsUrl ||
    (isValidCoords(loc.latitude, loc.longitude)
      ? buildGoogleLatLngUrl(loc.latitude!, loc.longitude!)
      : buildGoogleSearchUrl(loc.label));

  if (isValidCoords(loc.latitude, loc.longitude)) {
    const appUrl = buildGoogleAppUrl(loc.latitude!, loc.longitude!, loc.label);
    try {
      const canApp = await Linking.canOpenURL(appUrl);
      if (canApp) {
        await Linking.openURL(appUrl);
        return;
      }
    } catch {
      /* 웹으로 폴백 */
    }
  }

  try {
    const can = await Linking.canOpenURL(webUrl);
    if (!can) {
      Alert.alert("열기 실패", "구글 지도 링크를 열 수 없습니다.");
      return;
    }
    await Linking.openURL(webUrl);
  } catch {
    Alert.alert("열기 실패", "구글 지도를 열지 못했습니다.");
  }
}

/** @deprecated openGoogleMaps 사용 */
export const openNaverMaps = openGoogleMaps;

import { Alert, Linking, Platform } from "react-native";
import * as Location from "expo-location";

import type { MapProvider, StepLocation } from "../types";
import {
  geocodePlaceNameNominatim,
  type GeocodeResult,
} from "./geocodePlace";

export type { GeocodeResult, MapProvider };

/**
 * Google/Naver Maps 링크는 API 키 없이 URL로 생성 (Expo Go·프리뷰 APK 호환).
 * 앱 내 미리보기는 OSM 정적 이미지 — MapView는 설정 시에만.
 */

export function buildGoogleSearchUrl(query: string): string {
  const q = encodeURIComponent(query.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function buildNaverSearchUrl(query: string): string {
  const q = encodeURIComponent(query.trim());
  return `https://map.naver.com/p/search/${q}`;
}

export function buildGoogleLatLngUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function buildNaverLatLngUrl(latitude: number, longitude: number): string {
  return `https://map.naver.com/v5/?c=${longitude},${latitude},16,0,0,0,dh`;
}

export function buildMapsSearchUrl(query: string, provider: MapProvider): string {
  return provider === "naver"
    ? buildNaverSearchUrl(query)
    : buildGoogleSearchUrl(query);
}

export function buildMapsLatLngUrl(
  latitude: number,
  longitude: number,
  provider: MapProvider,
): string {
  return provider === "naver"
    ? buildNaverLatLngUrl(latitude, longitude)
    : buildGoogleLatLngUrl(latitude, longitude);
}

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

export function buildNaverAppUrl(
  latitude: number,
  longitude: number,
  name: string,
): string {
  const label = encodeURIComponent(name.trim() || "맛집");
  return `nmap://place?lat=${latitude}&lng=${longitude}&name=${label}&appname=9ruDocs`;
}

export function buildMapsAppUrl(
  latitude: number,
  longitude: number,
  name: string,
  provider: MapProvider,
): string {
  return provider === "naver"
    ? buildNaverAppUrl(latitude, longitude, name)
    : buildGoogleAppUrl(latitude, longitude, name);
}

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

export function buildOsmTileUrl(
  latitude: number,
  longitude: number,
  zoom = 13,
): string {
  const { x, y, z } = latLngToTile(latitude, longitude, zoom);
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

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

export function locationFromPlaceName(
  placeName: string,
  provider: MapProvider = "google",
): StepLocation {
  const label = placeName.trim();
  return {
    label,
    mapsUrl: buildMapsSearchUrl(label, provider),
  };
}

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
  provider: MapProvider = "google",
): StepLocation {
  const trimmed = label.trim() || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return {
    label: trimmed,
    latitude,
    longitude,
    mapsUrl: buildMapsLatLngUrl(latitude, longitude, provider),
  };
}

export function resolveMapsUrl(
  loc: StepLocation | null | undefined,
  provider: MapProvider = "google",
): string {
  if (!loc) return "";
  const existing = String(loc.mapsUrl ?? "").trim();
  if (existing) {
    if (provider === "naver" && existing.includes("google.com/maps")) {
      /* provider 변경 시 재생성 */
    } else if (provider === "google" && existing.includes("map.naver.com")) {
      /* provider 변경 시 재생성 */
    } else {
      return existing;
    }
  }
  const label = String(loc.label ?? "").trim();
  if (isValidCoords(loc.latitude, loc.longitude)) {
    return buildMapsLatLngUrl(loc.latitude!, loc.longitude!, provider);
  }
  if (label) return buildMapsSearchUrl(label, provider);
  return existing;
}

export function formatLocationMarkdown(
  loc: StepLocation | null | undefined,
  provider: MapProvider = "google",
): string {
  if (!loc?.label && !loc?.mapsUrl && loc?.latitude == null) return "";
  const url = resolveMapsUrl(loc, provider);
  const text = loc.label || "지도에서 보기";
  return `\n\n📍 [${text}](${url})\n`;
}

export function mapsProviderLabel(provider: MapProvider): string {
  return provider === "naver" ? "네이버 지도" : "구글 지도";
}

export async function openExternalMaps(
  loc: StepLocation,
  provider: MapProvider = "google",
): Promise<void> {
  const webUrl = resolveMapsUrl(loc, provider);
  const label = mapsProviderLabel(provider);

  if (isValidCoords(loc.latitude, loc.longitude)) {
    const appUrl = buildMapsAppUrl(
      loc.latitude!,
      loc.longitude!,
      loc.label,
      provider,
    );
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
      Alert.alert("열기 실패", `${label} 링크를 열 수 없습니다.`);
      return;
    }
    await Linking.openURL(webUrl);
  } catch {
    Alert.alert("열기 실패", `${label}를 열지 못했습니다.`);
  }
}

/** @deprecated openExternalMaps 사용 */
export async function openGoogleMaps(loc: StepLocation): Promise<void> {
  return openExternalMaps(loc, "google");
}

/** @deprecated openExternalMaps(loc, "naver") 사용 */
export const openNaverMaps = (loc: StepLocation) =>
  openExternalMaps(loc, "naver");

export function refreshLocationProvider(
  loc: StepLocation | null,
  provider: MapProvider,
): StepLocation | null {
  if (!loc) return null;
  return {
    ...loc,
    mapsUrl: isValidCoords(loc.latitude, loc.longitude)
      ? buildMapsLatLngUrl(loc.latitude!, loc.longitude!, provider)
      : buildMapsSearchUrl(loc.label, provider),
  };
}

import { Platform } from "react-native";

/** Google Maps Android SDK 키 (EAS/로컬 빌드 시 app.config.js → android.config.googleMaps) */
export function getGoogleMapsApiKey(): string {
  return (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export function hasGoogleMapsApiKey(): boolean {
  return getGoogleMapsApiKey().length > 0;
}

/**
 * 네이티브 MapView 사용 여부.
 * 기본은 OSM 정적 이미지(프리뷰 APK 크래시 방지).
 * `EXPO_PUBLIC_USE_MAP_VIEW=true` 일 때만 MapView 시도.
 * Android 릴리스/프리뷰는 API 키 없으면 MapView가 네이티브 크래시 → 키 필수.
 */
export function canUseNativeMapView(): boolean {
  if (process.env.EXPO_PUBLIC_USE_MAP_VIEW !== "true") return false;
  if (Platform.OS === "android" && !hasGoogleMapsApiKey()) return false;
  return true;
}

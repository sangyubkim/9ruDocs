import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import type { MapProvider, StepLocation } from "../types";
import { MapViewErrorBoundary } from "./MapViewErrorBoundary";
import { canUseNativeMapView } from "../utils/mapConfig";
import {
  isValidCoords,
  openExternalMaps,
  mapsProviderLabel,
} from "../utils/maps";
import {
  buildStaticMapRemoteUrls,
  loadStaticMapUri,
  STATIC_MAP_LOAD_TIMEOUT_MS,
} from "../utils/staticMapLoader";

type Props = {
  location: StepLocation;
  /** 구글/네이버 외부 지도 앱 연동 */
  mapService?: MapProvider;
  compact?: boolean;
};

const MAP_HEIGHT_DEFAULT = 168;
const MAP_HEIGHT_COMPACT = 120;
const MAP_LOAD_TIMEOUT_MS = 15_000;

export function LocationMapPreview({
  location,
  mapService = "google",
  compact = false,
}: Props) {
  const mapHeight = compact ? MAP_HEIGHT_COMPACT : MAP_HEIGHT_DEFAULT;
  const tryNativeMap = canUseNativeMapView();

  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(!tryNativeMap);
  const [remoteUrlIndex, setRemoteUrlIndex] = useState(0);
  const [staticLocalUri, setStaticLocalUri] = useState<string | null>(null);
  const [staticFailed, setStaticFailed] = useState(false);
  const [staticLoading, setStaticLoading] = useState(false);
  const loadGenRef = useRef(0);

  const hasCoords = isValidCoords(location.latitude, location.longitude);
  const lat = location.latitude ?? 0;
  const lng = location.longitude ?? 0;

  const region = useMemo(
    () => ({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }),
    [lat, lng],
  );

  const remoteUrls = useMemo(
    () => (hasCoords ? buildStaticMapRemoteUrls(lat, lng) : []),
    [hasCoords, lat, lng],
  );
  const remoteUri = remoteUrls[remoteUrlIndex] ?? null;

  const useNativeMap = hasCoords && tryNativeMap && !mapFailed;
  const useRemoteStatic =
    hasCoords && !useNativeMap && remoteUri != null && !staticFailed;
  const useCachedStatic =
    hasCoords && !useNativeMap && !useRemoteStatic && staticLocalUri != null;

  const showMapLoading =
    hasCoords &&
    ((useNativeMap && !mapReady) ||
      (staticLoading && !useRemoteStatic && !useCachedStatic));

  useEffect(() => {
    if (!hasCoords || !tryNativeMap || mapReady || mapFailed) return;
    const timer = setTimeout(() => setMapFailed(true), MAP_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasCoords, tryNativeMap, mapReady, mapFailed]);

  useEffect(() => {
    setMapReady(false);
    setMapFailed(!tryNativeMap);
    setRemoteUrlIndex(0);
    setStaticFailed(false);
    setStaticLocalUri(null);
    setStaticLoading(false);
  }, [location.latitude, location.longitude, location.label, tryNativeMap]);

  const shouldLoadStaticCache =
    hasCoords && (!tryNativeMap || mapFailed) && staticFailed;

  useEffect(() => {
    if (!shouldLoadStaticCache) return;

    const gen = ++loadGenRef.current;
    setStaticLoading(true);
    setStaticLocalUri(null);

    const timer = setTimeout(() => {
      if (loadGenRef.current !== gen) return;
      setStaticLoading(false);
    }, STATIC_MAP_LOAD_TIMEOUT_MS + 2000);

    void (async () => {
      const uri = await loadStaticMapUri(lat, lng);
      if (loadGenRef.current !== gen) return;
      clearTimeout(timer);
      if (uri) {
        setStaticLocalUri(uri);
      }
      setStaticLoading(false);
    })();

    return () => clearTimeout(timer);
  }, [shouldLoadStaticCache, lat, lng]);

  const openMaps = () => void openExternalMaps(location, mapService);

  const handleRemoteImageError = () => {
    if (remoteUrlIndex + 1 < remoteUrls.length) {
      setRemoteUrlIndex((i) => i + 1);
      return;
    }
    setStaticFailed(true);
  };

  const imageUri = useRemoteStatic
    ? remoteUri
    : useCachedStatic
      ? staticLocalUri
      : null;

  const showFallbackPanel =
    hasCoords &&
    !useNativeMap &&
    !imageUri &&
    (staticFailed || (!staticLoading && remoteUrls.length === 0));

  const nativeMapProvider =
    Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

  return (
    <View style={styles.wrap}>
      <View style={styles.cardHeader}>
        <Text style={styles.pin}>📍</Text>
        <View style={styles.cardHeaderText}>
          <Text style={styles.placeName} numberOfLines={2}>
            {location.label}
          </Text>
          {hasCoords ? (
            <Text style={styles.coordsInline}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.coordsInline}>좌표 없음 · 이름으로 검색</Text>
          )}
        </View>
      </View>

      <Pressable
        style={[styles.mapBox, { height: mapHeight }]}
        onPress={openMaps}
        accessibilityRole="button"
      >
        {showMapLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>지도 불러오는 중…</Text>
          </View>
        ) : null}

        {useNativeMap ? (
          <MapViewErrorBoundary onError={() => setMapFailed(true)}>
            <MapView
              style={[styles.map, { height: mapHeight }]}
              provider={nativeMapProvider}
              initialRegion={region}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              onMapReady={() => setMapReady(true)}
            >
              <Marker
                coordinate={{ latitude: lat, longitude: lng }}
                title={location.label}
              />
            </MapView>
          </MapViewErrorBoundary>
        ) : imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={[styles.map, { height: mapHeight }]}
            resizeMode="cover"
            onError={() => {
              if (useRemoteStatic) {
                handleRemoteImageError();
                return;
              }
              setStaticLocalUri(null);
              setStaticFailed(true);
            }}
          />
        ) : showFallbackPanel ? (
          <View style={[styles.noMap, { height: mapHeight }]}>
            <Text style={styles.noMapIcon}>🗺️</Text>
            <Text style={styles.noMapText} numberOfLines={2}>
              지도 타일을 불러오지 못했습니다
            </Text>
            <Text style={styles.noMapCoords}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </Text>
            <Text style={styles.noMapHint}>
              API 주소(설정)를 확인하거나 아래 「구글 지도에서 열기」를 눌러
              주세요
            </Text>
          </View>
        ) : (
          <View style={[styles.noMap, { height: mapHeight }]}>
            <Text style={styles.noMapIcon}>🗺️</Text>
            <Text style={styles.noMapText} numberOfLines={2}>
              장소 이름만 저장됨
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable style={styles.mapsBtn} onPress={openMaps}>
        <Text style={styles.mapsBtnText}>
          {mapsProviderLabel(mapService)}에서 열기
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  pin: { fontSize: 22, marginTop: 2 },
  cardHeaderText: { flex: 1 },
  placeName: { fontSize: 15, fontWeight: "700", color: "#1e3a8a" },
  coordsInline: { marginTop: 3, fontSize: 12, color: "#475569" },
  mapBox: {
    marginHorizontal: 10,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#dbeafe",
  },
  map: { width: "100%" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 246, 255, 0.85)",
  },
  loadingText: { marginTop: 8, fontSize: 12, color: "#475569" },
  noMap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  noMapIcon: { fontSize: 32, marginBottom: 6 },
  noMapText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    textAlign: "center",
  },
  noMapCoords: { marginTop: 4, fontSize: 12, color: "#64748b" },
  noMapHint: {
    marginTop: 6,
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
  },
  mapsBtn: {
    margin: 10,
    marginTop: 8,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  mapsBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

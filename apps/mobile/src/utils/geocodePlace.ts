export const NOMINATIM_USER_AGENT =
  "9ruDocs/1.0 (mobile; geocoding for place search)";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  label: string;
};

export function isValidGeocodeCoords(
  latitude: number | undefined,
  longitude: number | undefined,
): boolean {
  if (latitude == null || longitude == null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/** OpenStreetMap Nominatim — API 키 없이 장소명 → 좌표 */
export async function geocodePlaceNameNominatim(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(trimmed)}&format=json&limit=1&countrycodes=kr`;

  const res = await fetchFn(url, {
    headers: {
      "User-Agent": NOMINATIM_USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
    name?: string;
  }>;

  if (!Array.isArray(data) || data.length === 0) return null;

  const item = data[0];
  const latitude = parseFloat(item.lat ?? "");
  const longitude = parseFloat(item.lon ?? "");

  if (!isValidGeocodeCoords(latitude, longitude)) return null;

  const label =
    item.name?.trim() ||
    item.display_name?.split(",")[0]?.trim() ||
    trimmed;

  return { latitude, longitude, label };
}

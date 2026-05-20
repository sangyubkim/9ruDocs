/**
 * Nominatim 지오코딩 스모크 테스트 (네트워크 필요)
 * 사용: node apps/mobile/scripts/test-geocode.mjs
 */
const USER_AGENT = "9ruDocs/1.0 (mobile; geocoding for place search)";

function isValidCoords(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

async function geocodePlaceNameNominatim(query) {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(trimmed)}&format=json&limit=1&countrycodes=kr`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const item = data[0];
  const latitude = parseFloat(item.lat ?? "");
  const longitude = parseFloat(item.lon ?? "");
  if (!isValidCoords(latitude, longitude)) return null;

  const label =
    item.name?.trim() ||
    item.display_name?.split(",")[0]?.trim() ||
    trimmed;

  return { latitude, longitude, label };
}

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`[FAIL] ${msg}`);
    failed++;
  } else {
    console.log(`[OK] ${msg}`);
  }
}

const result = await geocodePlaceNameNominatim("강남역");
assert(result != null, "강남역 geocode returns result");
if (result) {
  assert(isValidCoords(result.latitude, result.longitude), "coords valid");
  assert(result.label.length > 0, "label non-empty");
  console.log(`  → ${result.label} (${result.latitude}, ${result.longitude})`);
}

const empty = await geocodePlaceNameNominatim("");
assert(empty == null, "empty query returns null");

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log("\nAll geocode tests passed.");

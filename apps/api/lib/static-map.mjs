/** 서버에서 정적 지도 PNG 프록시 (앱 직접 OSM 타일 요청 차단 우회) */
export async function fetchStaticMapPng(latitude, longitude, opts = {}) {
  const width = Math.min(Math.max(opts.width ?? 640, 320), 1280);
  const height = Math.min(Math.max(opts.height ?? 240, 120), 640);
  const zoom = opts.zoom ?? 14;
  const lat = Number(latitude).toFixed(6);
  const lng = Number(longitude).toFixed(6);
  const center = `${lat},${lng}`;
  const size = `${width}x${height}`;

  const urls = [
    `https://staticmap.openstreetmap.de/staticmap.php?center=${center}&zoom=${zoom}&size=${size}&markers=${lat},${lng}`,
    `https://maps.wikimedia.org/img/osm-intl,${zoom},${lat},${lng},${width}x${height}.png`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "9ruDocs-API/1.0 (contact: support@9ruinfo.com)",
          Accept: "image/png,image/jpeg,image/*,*/*",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("image")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) continue;
      return buf;
    } catch {
      /* next */
    }
  }
  return null;
}

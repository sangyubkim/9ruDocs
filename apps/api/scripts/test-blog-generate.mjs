/**
 * blog-generate.mjs 단위 테스트 (OpenAI 없이 fallback + 컨텍스트 추출)
 * 사용: node apps/api/scripts/test-blog-generate.mjs
 */
import {
  buildWritingContext,
  buildPersonaInstruction,
  buildGoogleSearchUrl,
  buildGoogleLatLngUrl,
  resolveMapsUrl,
  generateBlogPost,
} from "../lib/blog-generate.mjs";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`[FAIL] ${msg}`);
    failed++;
  } else {
    console.log(`[OK] ${msg}`);
  }
}

const steps = [
  { order: 0, caption: "강남역 근처 카페에서 작업", location: { label: "강남역" } },
  { order: 1, caption: "노트북 세팅 완료" },
];

const ctx = buildWritingContext(
  { persona: "IT 블로거", target: "개발자", keywords: "카페, 작업" },
  steps,
);
assert(ctx.persona === "IT 블로거", "persona from body");
assert(ctx.keywords === "카페, 작업", "keywords from body");
assert(
  buildPersonaInstruction(ctx).includes("**[IT 블로거]**"),
  "persona instruction format",
);

const inferred = buildWritingContext({}, steps);
assert(inferred.keywords.includes("강남역") || inferred.keywords.length > 0, "infer keywords");

const googleSearch = buildGoogleSearchUrl("강남역");
assert(googleSearch.includes("google.com/maps/search"), "google search url");
assert(googleSearch.includes("query="), "google search has query param");

const googleLat = buildGoogleLatLngUrl(37.5, 127.0);
assert(googleLat.includes("37.5,127"), "google lat/lng in url");

const resolved = resolveMapsUrl({
  label: "테스트",
  mapsUrl: "https://map.naver.com/v5/search/test",
});
assert(resolved.includes("google.com/maps"), "naver url replaced with google");

const kept = resolveMapsUrl({
  label: "테스트",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=test",
});
assert(kept.includes("google.com/maps"), "existing google url kept");

const result = await generateBlogPost({ steps, tone: "friendly" }, {});
assert(result.title.length > 0, "fallback title");
assert(
  result.body.includes("google.com/maps") || result.body.includes("강남역"),
  "fallback google or label",
);
assert(result.suggestedTags.length > 0, "fallback tags");

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll blog-generate tests passed.");

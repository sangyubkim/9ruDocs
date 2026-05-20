import { normalizeWordPressSiteUrl } from "../apps/api/lib/wordpress.mjs";

const cases = [
  ["yoursite.com", "https://yoursite.com"],
  ["https://yoursite.com/", "https://yoursite.com"],
  ["https://yoursite.com/wp-admin/", "https://yoursite.com"],
  ["https://yoursite.com/wp-json/wp/v2/", "https://yoursite.com"],
  ["http://blog.example.com/subdir", "http://blog.example.com/subdir"],
  ["", null],
];

let failed = 0;
for (const [input, expected] of cases) {
  const r = normalizeWordPressSiteUrl(input);
  const got = r.ok ? r.url : null;
  const pass = got === expected;
  console.log(pass ? "OK" : "FAIL", JSON.stringify(input), "->", got, expected ? `(want ${expected})` : "");
  if (!pass) failed++;
}

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll URL normalization tests passed.");

import {
  normalizeWordPressSiteUrl,
  resolveWordPressSiteUrl,
} from "../apps/api/lib/wordpress.mjs";

const cases = [
  ["yoursite.com", "https://yoursite.com"],
  ["https://yoursite.com/", "https://yoursite.com"],
  ["https://yoursite.com/wp-admin/", "https://yoursite.com"],
  ["https://yoursite.com/wp-json/wp/v2/", "https://yoursite.com"],
  ["http://blog.example.com/subdir", "http://blog.example.com/subdir"],
  ["https://https://9ruinfo.com", "https://9ruinfo.com"],
  ["//9ruinfo.com", "https://9ruinfo.com"],
  ["https://", null],
  ["https", null],
  ["https://https", null],
  ["https://https//", null],
  ["", null],
];

let failed = 0;
for (const [input, expected] of cases) {
  const r = normalizeWordPressSiteUrl(input);
  const got = r.ok ? r.url : null;
  const pass = got === expected;
  console.log(
    pass ? "OK" : "FAIL",
    JSON.stringify(input),
    "->",
    got,
    expected ? `(want ${expected})` : "(want reject)",
  );
  if (!pass) failed++;
}

const resolveCases = [
  {
    body: "https",
    env: "https://9ruinfo.com",
    want: "https://9ruinfo.com",
    from: "env",
  },
  {
    body: "https://",
    env: "https://9ruinfo.com",
    want: "https://9ruinfo.com",
    from: "env",
  },
  {
    body: "https://https://9ruinfo.com",
    env: "https://other.com",
    want: "https://9ruinfo.com",
    from: "body",
  },
  {
    body: "",
    env: "https://9ruinfo.com",
    want: "https://9ruinfo.com",
    from: "env",
  },
  { body: "https", env: "", want: null, from: null },
];

for (const c of resolveCases) {
  const r = resolveWordPressSiteUrl(c.body, c.env);
  const got = r.ok ? r.url : null;
  const from = r.ok ? r.from : null;
  const pass = got === c.want && from === c.from;
  console.log(
    pass ? "OK" : "FAIL",
    "resolve",
    JSON.stringify(c.body),
    "+",
    JSON.stringify(c.env),
    "->",
    got,
    from,
  );
  if (!pass) failed++;
}

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll URL normalization tests passed.");

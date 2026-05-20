/**
 * 로컬 API의 /health, /wordpress/verify 동작을 빠르게 확인합니다.
 * 사용: node apps/api/scripts/test-wordpress-verify.mjs [baseUrl]
 */
const base = (process.argv[2] ?? "http://127.0.0.1:3001").replace(/\/+$/, "");

async function req(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function ok(label, detail) {
  console.log(`[OK] ${label}${detail ? `: ${detail}` : ""}`);
}

function fail(label, detail) {
  console.error(`[FAIL] ${label}${detail ? `: ${detail}` : ""}`);
  process.exitCode = 1;
}

console.log(`Base URL: ${base}\n`);

const health = await req("GET", "/health");
if (health.status === 200 && health.json?.ok) {
  ok("GET /health", health.json.service);
} else {
  fail("GET /health", `status=${health.status} body=${JSON.stringify(health.json)}`);
}

const root = await req("GET", "/");
const routes = root.json?.routes ?? [];
if (routes.includes("POST /wordpress/verify")) {
  ok("GET / (verify route listed)");
} else {
  fail("GET / (verify route missing)", JSON.stringify(routes));
}

const missingCreds = await req("POST", "/wordpress/verify", {});
if (missingCreds.status === 400 && missingCreds.json?.error) {
  ok("POST /wordpress/verify (no creds → 400)", missingCreds.json.error);
} else {
  fail(
    "POST /wordpress/verify (no creds)",
    `status=${missingCreds.status} body=${JSON.stringify(missingCreds.json)}`,
  );
}

const bogus = await req("POST", "/wordpress/verify", {
  siteUrl: "https://invalid.example.test",
  username: "nobody",
  appPassword: "wrongpassword",
});
if (bogus.status === 400 && bogus.json?.error) {
  ok("POST /wordpress/verify (bad WP creds → 400)", bogus.json.error.slice(0, 80));
} else {
  fail(
    "POST /wordpress/verify (bad creds)",
    `status=${bogus.status} body=${JSON.stringify(bogus.json)}`,
  );
}

const notFound = await req("POST", "/no-such-route", {});
if (notFound.status === 404 && notFound.json?.code === "route_not_found") {
  ok("404 route_not_found code");
} else {
  fail("404 shape", JSON.stringify(notFound.json));
}

if (!process.exitCode) {
  console.log("\n모든 기본 검사 통과. API가 실행 중이면 위 결과가 정상입니다.");
}

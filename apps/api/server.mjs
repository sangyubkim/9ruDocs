import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readBody, matchRoute } from "./lib/http-util.mjs";
import { generateBlogPost } from "./lib/blog-generate.mjs";
import {
  importRestaurantBlog,
  importFromSelectedBlog,
  searchRestaurantBlogSources,
} from "./lib/restaurant-import.mjs";
import { generateRestaurantBlog } from "./lib/restaurant-generate.mjs";
import {
  publishToWordPress,
  uploadMedia,
  verifyWordPressCredentials,
  resolveWordPressSiteUrl,
} from "./lib/wordpress.mjs";
import { fetchStaticMapPng } from "./lib/static-map.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(join(__dirname, ".env"));

const API_ROUTES = [
  "GET /health",
  "GET /",
  "GET /maps/static",
  "POST /blog/generate",
  "POST /blog/restaurant-import",
  "POST /blog/restaurant-import/search",
  "POST /blog/restaurant-import/apply",
  "POST /blog/restaurant-generate",
  "POST /wordpress/publish",
  "POST /wordpress/verify",
  "POST /wordpress/media",
];

const env = {
  port: Number(process.env.PORT ?? 3001),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:8081,*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini",
  naverClientId: process.env.NAVER_CLIENT_ID?.trim() ?? "",
  naverClientSecret: process.env.NAVER_CLIENT_SECRET?.trim() ?? "",
  wpSiteUrl: process.env.WP_SITE_URL?.trim() ?? "",
  wpUsername: process.env.WP_USERNAME?.trim() ?? "",
  wpAppPassword: process.env.WP_APP_PASSWORD?.trim() ?? "",
  wpYoastMetaRoute: process.env.WP_YOAST_META_ROUTE?.trim() ?? "",
};

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

function corsHeaders(origin) {
  const allow =
    !origin ||
    env.corsOrigins.includes("*") ||
    env.corsOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": allow
      ? (origin || env.corsOrigins[0] || "*")
      : env.corsOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
    // Apache/CDN이 /health 등을 오래 캐시하지 않도록
    "Cache-Control": "no-store",
  };
}

function send(res, status, body, origin) {
  res.writeHead(status, corsHeaders(origin));
  res.end(JSON.stringify(body));
}

async function handle(req, res) {
  const origin = req.headers.origin ?? "";
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  try {
    if (method === "GET" && url.split("?")[0] === "/health") {
      send(
        res,
        200,
        { ok: true, service: "9rudocs-api", timestamp: new Date().toISOString() },
        origin,
      );
      return;
    }

    if (method === "GET" && url.split("?")[0] === "/") {
      send(
        res,
        200,
        {
          name: "9ruDocs API",
          routes: API_ROUTES.filter((r) => r !== "GET /"),
        },
        origin,
      );
      return;
    }

    if (method === "GET" && url.split("?")[0] === "/maps/static") {
      const u = new URL(url, `http://${req.headers.host ?? "localhost"}`);
      const lat = Number.parseFloat(u.searchParams.get("lat") ?? "");
      const lng = Number.parseFloat(u.searchParams.get("lng") ?? "");
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        send(res, 400, { error: "lat and lng query params required" }, origin);
        return;
      }
      const png = await fetchStaticMapPng(lat, lng);
      if (!png) {
        send(res, 502, { error: "Map unavailable" }, origin);
        return;
      }
      const allow =
        !origin ||
        env.corsOrigins.includes("*") ||
        env.corsOrigins.includes(origin);
      res.writeHead(200, {
        "Access-Control-Allow-Origin": allow
          ? (origin || env.corsOrigins[0] || "*")
          : env.corsOrigins[0],
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      });
      res.end(png);
      return;
    }

    if (matchRoute(url, method, "/blog/generate", "POST")) {
      const body = await readBody(req);
      const result = await generateBlogPost(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (matchRoute(url, method, "/blog/restaurant-import/search", "POST")) {
      const body = await readBody(req);
      const result = await searchRestaurantBlogSources(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (matchRoute(url, method, "/blog/restaurant-import/apply", "POST")) {
      const body = await readBody(req);
      const result = await importFromSelectedBlog(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (matchRoute(url, method, "/blog/restaurant-import", "POST")) {
      const body = await readBody(req);
      const result = await importRestaurantBlog(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (matchRoute(url, method, "/blog/restaurant-generate", "POST")) {
      const body = await readBody(req);
      const result = await generateRestaurantBlog(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (matchRoute(url, method, "/wordpress/publish", "POST")) {
      const body = await readBody(req);
      const result = await publishToWordPress(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (matchRoute(url, method, "/wordpress/verify", "POST")) {
      const body = await readBody(req);
      const result = await verifyWordPressCredentials(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (matchRoute(url, method, "/wordpress/media", "POST")) {
      const body = await readBody(req);
      const resolved = resolveWordPressSiteUrl(body?.siteUrl, env.wpSiteUrl);
      if (!resolved.ok) {
        send(res, 400, { error: resolved.error }, origin);
        return;
      }
      const username = body?.username?.trim() || env.wpUsername;
      const appPassword = body?.appPassword?.trim() || env.wpAppPassword;
      if (!username || !appPassword) {
        send(res, 400, { error: "WordPress credentials missing" }, origin);
        return;
      }
      const media = await uploadMedia(
        resolved.url,
        username,
        appPassword,
        body?.image ?? body,
      );
      send(res, 200, { id: media.id, source_url: media.source_url }, origin);
      return;
    }

    send(
      res,
      404,
      {
        code: "route_not_found",
        error: "요청한 API 경로를 찾을 수 없습니다.",
        hint:
          "GET / 로 사용 가능한 경로를 확인하고, PC에서 scripts\\start-api.bat 으로 API를 최신 코드로 재시작하세요.",
      },
      origin,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    send(res, 400, { error: message }, origin);
  }
}

const server = http.createServer((req, res) => {
  void handle(req, res);
});

server.listen(env.port, () => {
  console.log(`API http://localhost:${env.port}`);
  console.log("Routes:");
  for (const route of API_ROUTES) {
    console.log(`  ${route}`);
  }
  console.log(`OpenAI: ${env.openaiApiKey ? "configured" : "fallback mode"}`);
  console.log(`WordPress: ${env.wpSiteUrl ? "configured" : "not configured"}`);
  console.log(`CORS: ${env.corsOrigins.join(", ")}`);
});

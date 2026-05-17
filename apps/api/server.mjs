import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readBody, matchRoute } from "./lib/http-util.mjs";
import { generateBlogPost } from "./lib/blog-generate.mjs";
import { publishToWordPress, uploadMedia } from "./lib/wordpress.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(join(__dirname, ".env"));

const env = {
  port: Number(process.env.PORT ?? 3001),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:8081")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini",
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
          routes: [
            "GET /health",
            "POST /blog/generate",
            "POST /wordpress/publish",
            "POST /wordpress/media",
          ],
        },
        origin,
      );
      return;
    }

    if (matchRoute(url, method, "/blog/generate", "POST")) {
      const body = await readBody(req);
      const result = await generateBlogPost(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (matchRoute(url, method, "/wordpress/publish", "POST")) {
      const body = await readBody(req);
      const result = await publishToWordPress(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (matchRoute(url, method, "/wordpress/media", "POST")) {
      const body = await readBody(req);
      const siteUrl = body?.siteUrl?.trim() || env.wpSiteUrl;
      const username = body?.username?.trim() || env.wpUsername;
      const appPassword = body?.appPassword?.trim() || env.wpAppPassword;
      if (!siteUrl || !username || !appPassword) {
        send(res, 400, { error: "WordPress credentials missing" }, origin);
        return;
      }
      const media = await uploadMedia(siteUrl, username, appPassword, body?.image ?? body);
      send(res, 200, { id: media.id, source_url: media.source_url }, origin);
      return;
    }

    send(res, 404, { error: "Not found" }, origin);
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
  console.log(`OpenAI: ${env.openaiApiKey ? "configured" : "fallback mode"}`);
  console.log(`WordPress: ${env.wpSiteUrl ? "configured" : "not configured"}`);
  console.log(`CORS: ${env.corsOrigins.join(", ")}`);
});

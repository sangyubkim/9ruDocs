import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

const port = Number(process.env.PORT ?? 3001);
const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:8081,*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (corsOrigins.includes("*")) return origin;
      return corsOrigins.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "9rudocs-api",
    timestamp: new Date().toISOString(),
  }),
);

app.get("/", (c) =>
  c.json({
    name: "9ruDocs API",
    health: "/health",
  }),
);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API http://localhost:${info.port}`);
  console.log(`CORS: ${corsOrigins.join(", ")}`);
});

/**
 * LLM 레이어 smoke test (유료 호출 최소화: Gemini ping 1회)
 * 사용: node scripts/test-llm.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseJsonLoose,
  hasLlmConfigured,
  describeLlmEngines,
  completeText,
} from "../lib/llm.mjs";
import { generateBlogPost } from "../lib/blog-generate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "..");

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

loadEnv(join(apiRoot, ".env"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("[FAIL]", msg);
    failed += 1;
  } else {
    console.log("[OK]", msg);
  }
}

assert(parseJsonLoose('{"a":1}').a === 1, "parseJsonLoose plain");
assert(parseJsonLoose("```json\n{\"b\":2}\n```").b === 2, "parseJsonLoose fence");
assert(parseJsonLoose('prefix {"c":3} suffix').c === 3, "parseJsonLoose embed");

const fb = await generateBlogPost(
  { steps: [{ order: 0, caption: "테스트 카페", location: { label: "강남" } }] },
  {},
);
assert(fb.title.length > 0, "fallback generate title");
assert(!hasLlmConfigured({}), "empty env has no llm");

const env = {
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
  geminiModel: process.env.GEMINI_MODEL?.trim() ?? "gemini-2.0-flash",
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  openaiBaseUrl:
    process.env.OPENAI_BASE_URL?.trim() ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini",
  cursorApiKey: process.env.CURSOR_API_KEY?.trim() ?? "",
  cursorModel: process.env.CURSOR_MODEL?.trim() ?? "composer-2.5",
  llmTimeoutMs: 90_000,
  llmRootDir: apiRoot,
};

const desc = describeLlmEngines(env);
console.log("[INFO] LLM configured:", desc);
assert(hasLlmConfigured(env), "env has llm keys");
assert(desc.includes("gemini"), "gemini in describe");
assert(desc.includes("openai"), "openai in describe");
assert(desc.includes("cursor"), "cursor in describe");

try {
  await completeText({}, "sys", "user");
  assert(false, "completeText without keys should throw");
} catch (e) {
  assert(String(e.message).includes("No LLM"), "no-key throws clearly");
}

try {
  const r = await completeText(
    env,
    "Return valid JSON only.",
    'Respond with JSON: {"ok":true,"engine_check":"ping"}',
    { temperature: 0 },
  );
  console.log("[INFO] smoke engine used:", r.engine);
  assert(
    r.text.includes("ok") || r.text.includes("true"),
    "smoke response has ok",
  );
  assert(r.engine === "gemini" || r.engine === "openai" || r.engine === "cursor", "known engine");
} catch (e) {
  console.error("[WARN] live LLM smoke failed:", e instanceof Error ? e.message : e);
  failed += 1;
}

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll llm smoke checks passed.");

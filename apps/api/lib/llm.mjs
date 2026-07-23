/**
 * LLM 공통 호출 레이어
 * 우선순위: Gemini → OpenAI → Cursor (키 있는 엔진만 시도, 실패 시 soft-fail)
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Cursor Agent.prompt local cwd (apps/api) */
export const LLM_ROOT_DIR = join(__dirname, "..");

function envMs(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function hasLlmConfigured(env) {
  return Boolean(
    env?.geminiApiKey || env?.openaiApiKey || env?.cursorApiKey,
  );
}

/** 기동 로그용: gemini|openai|cursor 또는 fallback */
export function describeLlmEngines(env) {
  const names = [];
  if (env?.geminiApiKey) names.push("gemini");
  if (env?.openaiApiKey) names.push("openai");
  if (env?.cursorApiKey) names.push("cursor");
  return names.length ? names.join("|") : "fallback";
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function parseJsonLoose(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) throw new Error("Empty LLM response");
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    return JSON.parse(fence[1].trim());
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("Failed to parse JSON from LLM response");
}

async function completeGemini(env, system, user, temperature) {
  const model = env.geminiModel || "gemini-2.0-flash";
  const timeoutMs = env.llmTimeoutMs || envMs("LLM_TIMEOUT_MS", 90_000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.geminiApiKey}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system || "Respond with valid JSON only when asked." }],
        },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: temperature ?? 0.7,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("") || "";
    if (!text.trim()) throw new Error("Gemini returned empty text");
    return { text, engine: "gemini" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Gemini timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function completeOpenAi(env, system, user, temperature) {
  const timeoutMs = env.llmTimeoutMs || envMs("LLM_TIMEOUT_MS", 90_000);
  const base = (env.openaiBaseUrl || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openaiModel || "gpt-4o-mini",
      temperature: temperature ?? 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text.trim()) throw new Error("OpenAI returned empty text");
  return { text, engine: "openai" };
}

async function completeCursor(env, system, user) {
  const timeoutMs = env.cursorTimeoutMs || envMs("CURSOR_TIMEOUT_MS", 120_000);
  let Agent;
  try {
    ({ Agent } = await import("@cursor/sdk"));
  } catch (err) {
    throw new Error(
      `@cursor/sdk unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const full = system
    ? `${system}\n\n---\n\n${user}`
    : user;
  const result = await withTimeout(
    Agent.prompt(full, {
      apiKey: env.cursorApiKey,
      model: { id: env.cursorModel || "composer-2.5" },
      local: { cwd: env.llmRootDir || LLM_ROOT_DIR, settingSources: [] },
    }),
    timeoutMs,
    "Cursor Agent.prompt",
  );
  if (result.status === "error") {
    throw new Error(`Cursor SDK run error (id=${result.id})`);
  }
  const text =
    typeof result.result === "string"
      ? result.result
      : String(result.result ?? "");
  if (!text.trim()) throw new Error("Cursor SDK returned empty text");
  return { text, engine: "cursor" };
}

/**
 * @returns {Promise<{ text: string, engine: string }>}
 */
export async function completeText(env, system, user, options = {}) {
  const temperature = options.temperature ?? 0.7;
  const engines = [];
  if (env?.geminiApiKey) {
    engines.push({
      name: "gemini",
      run: () => completeGemini(env, system, user, temperature),
    });
  }
  if (env?.openaiApiKey) {
    engines.push({
      name: "openai",
      run: () => completeOpenAi(env, system, user, temperature),
    });
  }
  if (env?.cursorApiKey) {
    engines.push({
      name: "cursor",
      run: () => completeCursor(env, system, user),
    });
  }
  if (engines.length === 0) {
    throw new Error("No LLM API key configured");
  }

  let lastError;
  for (let i = 0; i < engines.length; i++) {
    const engine = engines[i];
    try {
      return await engine.run();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const next = engines[i + 1];
      if (next) {
        console.warn(
          `[llm] ${engine.name} failed: ${msg}; falling back to ${next.name}`,
        );
      } else {
        console.warn(`[llm] ${engine.name} failed: ${msg}; no more fallbacks`);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || "All LLM engines failed"));
}

/**
 * system + user → JSON object (기존 OpenAI json_object 호출과 호환)
 * @returns {Promise<{ data: object, engine: string, raw: string }>}
 */
export async function completeJson(env, system, user, options = {}) {
  const { text, engine } = await completeText(env, system, user, options);
  const data = parseJsonLoose(text);
  return { data, engine, raw: text };
}

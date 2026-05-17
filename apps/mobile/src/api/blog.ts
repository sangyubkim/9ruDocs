import { apiFetch } from "./client";

export type GenerateRequest = {
  steps: { caption: string; order: number }[];
  tone?: "friendly" | "professional";
};

export type GenerateResponse = {
  title: string;
  body: string;
  excerpt: string;
  suggestedTags: string[];
};

export async function generateBlog(
  payload: GenerateRequest,
): Promise<GenerateResponse> {
  const res = await apiFetch("/blog/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as GenerateResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Generate failed: ${res.status}`);
  }
  return json;
}

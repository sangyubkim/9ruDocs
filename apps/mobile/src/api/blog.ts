import {
  apiFetch,
  formatApiConnectionError,
  isApiConnectionError,
} from "./client";

export type GenerateStepLocation = {
  label: string;
  latitude?: number;
  longitude?: number;
  mapsUrl: string;
};

export type GenerateRequest = {
  steps: {
    caption: string;
    order: number;
    location?: GenerateStepLocation | null;
  }[];
  tone?: "friendly" | "professional";
  persona?: string;
  target?: string;
  keywords?: string;
  toneLabel?: string;
  personalTips?: string;
  cta?: string;
};

export type GenerateResponse = {
  title: string;
  body: string;
  excerpt: string;
  suggestedTags: string[];
  slug: string;
  imagePrompt: string;
  imageAlt: string;
  imageCaption: string;
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

/** fetch 실패 시 사용자에게 보여줄 메시지 */
export function formatNetworkError(e: unknown): string {
  if (isApiConnectionError(e)) return e.message;
  return formatApiConnectionError(e);
}

import { apiFetch } from "./client";

export type PublishImage = {
  base64: string;
  filename: string;
  mimeType: string;
};

export type PublishRequest = {
  title: string;
  content: string;
  excerpt: string;
  status?: "draft" | "publish";
  tags: string[];
  images?: PublishImage[];
  seo?: {
    metaDescription?: string;
    yoastTitle?: string;
    yoastDescription?: string;
  };
};

export type PublishResponse = {
  postId: number;
  link: string;
  editLink: string | null;
  featuredMediaId: number | null;
  tagIds: number[];
  seoApplied: boolean;
};

export async function publishToWordPress(
  payload: PublishRequest,
): Promise<PublishResponse> {
  const res = await apiFetch("/wordpress/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as PublishResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Publish failed: ${res.status}`);
  }
  return json;
}

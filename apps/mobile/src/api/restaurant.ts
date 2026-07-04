import { apiFetch } from "./client";

export type RestaurantImportRequest = {
  region: string;
  restaurantName: string;
  mainMenu?: string;
};

export type RestaurantImportSource = {
  title: string;
  url: string;
  blogger?: string;
  matchedSort?: "sim" | "date";
};

export type RestaurantImportMeta = {
  mode: "search-ai" | "ai-only" | "template";
  searchedQuery: string;
  sourceCount: number;
  message: string;
};

export type RestaurantImportResponse = {
  title: string;
  region: string;
  restaurantName: string;
  mainMenu: string;
  basicInfo: {
    name: string;
    address: string;
    hours: string;
    phone: string;
    parking: string;
    reservation: string;
  };
  sections: {
    intro: string;
    atmosphere: string;
    menu: string;
    foodReview: string;
    summary: string;
    closing: string;
  };
  excerpt: string;
  suggestedTags: string[];
  sources?: RestaurantImportSource[];
  importMeta?: RestaurantImportMeta;
};

export async function importRestaurantBlog(
  payload: RestaurantImportRequest,
): Promise<RestaurantImportResponse> {
  const res = await apiFetch("/blog/restaurant-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as RestaurantImportResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Import failed: ${res.status}`);
  }
  return json;
}

export type RestaurantGenerateRequest = {
  restaurant: unknown;
  tone?: "friendly" | "professional";
};

export type RestaurantGenerateResponse = {
  title: string;
  body: string;
  excerpt: string;
  suggestedTags: string[];
};

export async function generateRestaurantBlog(
  payload: RestaurantGenerateRequest,
): Promise<RestaurantGenerateResponse> {
  const res = await apiFetch("/blog/restaurant-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as RestaurantGenerateResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? `Generate failed: ${res.status}`);
  }
  return json;
}

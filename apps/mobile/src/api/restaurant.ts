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
  excerpt?: string;
  content?: string;
  postDate?: string;
};

export type RestaurantGeocodeHint = {
  address: string;
  geocodeQuery: string;
};

export type RestaurantImportMeta = {
  mode: "search-ai" | "search-snippet" | "ai-only" | "template";
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
  geocodeHint?: RestaurantGeocodeHint;
};

export type RestaurantBlogSearchResponse = {
  sources: RestaurantImportSource[];
  searchedQuery: string;
  searchError?: string;
};

export async function searchRestaurantBlogs(
  payload: RestaurantImportRequest,
): Promise<RestaurantBlogSearchResponse> {
  const res = await apiFetch("/blog/restaurant-import/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as RestaurantBlogSearchResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? `Search failed: ${res.status}`);
  }
  return json;
}

export async function applyRestaurantBlogImport(
  payload: RestaurantImportRequest & { selectedUrl: string },
): Promise<RestaurantImportResponse> {
  const res = await apiFetch("/blog/restaurant-import/apply", {
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

/** @deprecated search + apply 2단계 플로우 사용 권장 */
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

import { apiFetch } from "./client";

export type HealthResponse = {
  ok: boolean;
  service: string;
  timestamp: string;
};

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await apiFetch("/health");
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return (await res.json()) as HealthResponse;
}

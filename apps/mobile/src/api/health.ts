import { apiFetch, isApiConnectionError } from "./client";

export type HealthResponse = {
  ok: boolean;
  service: string;
  timestamp: string;
};

export async function fetchHealth(): Promise<HealthResponse> {
  let res: Response;
  try {
    res = await apiFetch("/health");
  } catch (e) {
    if (isApiConnectionError(e)) throw e;
    throw e;
  }
  if (res.status === 404) {
    throw new Error(
      "9ruDocs API에 /health 경로가 없습니다. PC에서 scripts\\start-api.bat 으로 API를 재시작하세요.",
    );
  }
  if (!res.ok) {
    throw new Error(`9ruDocs API 응답 오류 (HTTP ${res.status})`);
  }
  let json: HealthResponse;
  try {
    json = (await res.json()) as HealthResponse;
  } catch {
    throw new Error(
      "9ruDocs API 응답을 해석할 수 없습니다. API 주소가 PC의 9ruDocs API인지 확인하세요.",
    );
  }
  return json;
}

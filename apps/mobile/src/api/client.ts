let _baseUrl = "";

export function setApiClientBaseUrl(url: string) {
  _baseUrl = url.replace(/\/+$/, "");
}

export function getApiClientBaseUrl(): string {
  return _baseUrl;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!_baseUrl) {
    throw new Error("API 주소가 설정되지 않았습니다. 설정(톱니바퀴)에서 PC IP를 입력하세요.");
  }
  return fetch(`${_baseUrl}${path}`, init);
}

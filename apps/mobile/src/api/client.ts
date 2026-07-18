let _baseUrl = "";

export function setApiClientBaseUrl(url: string) {
  _baseUrl = url.replace(/\/+$/, "");
}

export function getApiClientBaseUrl(): string {
  return _baseUrl;
}

/** PC 9ruDocs API에 연결할 수 없을 때 (네트워크·주소 오류) */
export class ApiConnectionError extends Error {
  readonly kind = "api_connection" as const;

  constructor(message: string) {
    super(message);
    this.name = "ApiConnectionError";
  }
}

export function isApiConnectionError(e: unknown): e is ApiConnectionError {
  return e instanceof ApiConnectionError;
}

export function formatApiConnectionError(
  e: unknown,
  apiBaseUrl?: string,
): string {
  const base = (apiBaseUrl ?? _baseUrl).trim();
  const msg = e instanceof Error ? e.message : String(e);
  if (
    /network request failed|failed to fetch|fetch failed|network error|econnrefused|enotfound|etimedout|cleartext|ssl|certificate/i.test(
      msg,
    )
  ) {
    const addr = base || "http://192.168.x.x:3001";
    const cloudHint = addr.includes("cloudwaysapps.com")
      ? "\n\nCloudways API라면 URL 끝이 /apps/api 인지, 휴대폰 인터넷이 되는지 확인하세요."
      : "\n\n프리뷰 APK는 Expo Go와 달리 PC IP(또는 Cloudways API URL)를 앱에서 직접 설정해야 합니다.\n\n" +
        "1) PC·폰 같은 Wi-Fi 연결 (로컬 API 사용 시)\n" +
        "2) PC에서 scripts\\start-api.bat 실행 (포트 3001)\n" +
        "3) cmd에서 ipconfig → IPv4 확인 (예: 192.168.0.10)\n" +
        "4) 앱 ⚙ 설정에 http://192.168.0.10:3001 또는 Cloudways API URL 입력 후 「연결 테스트」\n" +
        "5) Windows 방화벽에서 Node.js 허용";
    return (
      "9ruDocs API에 연결할 수 없습니다.\n\n" +
      `현재 API 주소: ${addr}` +
      cloudHint
    );
  }
  return msg;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!_baseUrl) {
    throw new ApiConnectionError(
      "API 주소가 설정되지 않았습니다. 설정(톱니바퀴)에서 PC IP:포트(예: http://192.168.0.10:3001)를 입력하세요.",
    );
  }
  try {
    return await fetch(`${_baseUrl}${path}`, init);
  } catch (e) {
    throw new ApiConnectionError(formatApiConnectionError(e, _baseUrl));
  }
}

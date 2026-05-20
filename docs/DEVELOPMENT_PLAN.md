# 9ruDocs 개발 계획 및 프로젝트 관리



> 사진·단계 기록 → AI 블로그 초안 → WordPress 발행을 한 번에 하는 모바일+API 프로젝트입니다.



## 원래 4단계 로드맵



| 단계 | 목표 | 상태 |

|------|------|------|

| 1. 캡처 | 단계별 사진·설명·작성완료 | **완료 (MVP)** |

| 2. AI | 단계 메모 → Markdown 블로그 초안 | **완료 (MVP)** |

| 3. WordPress | 초안 편집·미디어·게시·인증 검증 | **완료 (MVP)** |

| 4. SEO | 발췌·태그·Yoast 연동 등 | **진행 중** |



---



## 현재 단계 (2026-05-19)



**MVP 유지보수 + SEO 4단계 마무리.** Android 프리뷰 APK 지도 크래시 수정, 음성 입력 토글(누르면 시작·다시 누르면 종료), 프리뷰 QA 문서 반영.



### 오늘 작업 (2026-05-19, 프리뷰 APK 연결·지도 UX)



| 항목 | 상태 | 내용 |

|------|------|------|

| 프리뷰 APK API 연결 | ✅ | placeholder URL 감지·첫 실행 Alert·상단 배너·설정 ipconfig 안내·`usesCleartextTraffic`·오류 메시지 개선 |

| 지도 미리보기 폴백 | ✅ | OSM·위키미디어 다중 URL, `expo-file-system` 캐시, 15초 타임아웃, 실패 시 좌표 카드·구글 지도 버튼 유지 |

| 현재 위치 버튼 | ✅ | 로딩·중복 탭 방지·권한 안내·저장 성공 Alert |

| 프리뷰 APK 지도 크래시 | ✅ | `LocationMapPreview` — OSM 정적 이미지 **기본**, MapView는 `EXPO_PUBLIC_USE_MAP_VIEW=true` + Android API 키 있을 때만 |

| MapView 안전장치 | ✅ | `MapViewErrorBoundary`, 15초 타임아웃 → 정적 지도 폴백 |

| EAS preview env | ✅ | `eas.json` — `EXPO_PUBLIC_API_URL` (빌드 전 선택, [ANDROID_BUILD.md](./ANDROID_BUILD.md) 참고) |

| Android 빌드 문서 | ✅ | 프리뷰 APK API 설정 절 추가 |

| 자동 테스트 | ✅ | `api:test-blog`, `tsc --noEmit` (mobile) |



### 이전 (2026-05-19, 프리뷰 APK 안정화)



| 항목 | 상태 | 내용 |

|------|------|------|

| Google Maps 빌드 키 | ✅ | `app.config.js` → `android.config.googleMaps.apiKey` |

| 음성 입력 토글 | ✅ | 🎤 첫 탭 시작·다시 탭 종료·「듣는 중…」 UI |



### 이전 (2026-05-19, 심야)



| 항목 | 상태 | 내용 |

|------|------|------|

| 지도 링크 Google 복귀 | ✅ | `maps.ts`·`blog-generate.mjs` — `google.com/maps` 검색·좌표 URL, `geo:` 앱 스킴 |

| 블로그 미리보기 위치 카드 | ✅ | `BlogPreviewScreen` — `LocationMapPreview`로 단계별 지도·탭 시 구글 지도 |

| UI 문구 | ✅ | 「구글 지도에서 열기」, HomeScreen 「위치 · 구글 지도」 |

| 개발 계획·테스트 | ✅ | 본 문서 갱신, `api:test-blog`·`tsc --noEmit`·`test-geocode.mjs` |



### 이전 (2026-05-19, 밤)



| 항목 | 상태 | 내용 |

|------|------|------|

| 장소 이름 검색 → 지도 | ✅ | `geocodePlaceName` (Nominatim + expo-location 폴백), 저장 시 lat/lng |

| 장소 저장 UX | ✅ | 지오코딩 중 로딩 스피너, 실패 Alert |

| Android 빌드 문서 | ✅ | [ANDROID_BUILD.md](./ANDROID_BUILD.md) — EAS·로컬·Expo Go |

| EAS preview 프로필 | ✅ | `apps/mobile/eas.json` (APK, internal) |

| 지오코딩 테스트 | ✅ | `node apps/mobile/scripts/test-geocode.mjs` |



### 이전 (2026-05-19, 저녁)



| 항목 | 상태 | 내용 |

|------|------|------|

| 위치 지도 미리보기 | ✅ | `react-native-maps` MapView + 마커 (Expo SDK 54). OSM 정적 타일 다중 URL 폴백 |

| 지도 항상 보이는 UI | ✅ | 장소명·좌표 카드, 로딩 인디케이터, 「구글 지도에서 열기」 버튼 |

| 좌표 검증 | ✅ | `(0,0)`·비유효 좌표 제외 (`isValidCoords`) |

| 블로그 미리보기 | ✅ | `BlogPreviewScreen` — 제목·요약·태그·Markdown·**방문 장소 지도 카드**·단계 사진 |

| 편집 화면 | ✅ | 「미리보기」 버튼 → 미리보기 → 「편집으로」/「WordPress 등록」 |

| 의존성 | ✅ | `react-native-maps@1.20.1` (expo install) |

| 개발 계획·테스트 | ✅ | 본 문서 갱신, `api:test-blog`·`tsc --noEmit` 통과 |



### 이전 (2026-05-19, 오후)



| 항목 | 상태 | 내용 |

|------|------|------|

| 글 편집 🎤 복원 | ✅ | Expo Go에서도 버튼 표시, 탭 시 Alert |

| OSM 정적 타일 | ⚠️ 대체 | 모바일에서 타일 로드 실패 빈번 → MapView로 전환 |



---



## MVP 완료 항목



- [x] 단계별 캡처(카메라/갤러리), 설명, 작성완료 잠금

- [x] AI 블로그 생성 API (`POST /blog/generate`) — OpenAI 또는 로컬 fallback

- [x] 페르소나형 한국어 프롬프트 (API는 옵션 필드 지원, 미입력 시 캡션에서 추론)

- [x] 글 편집 화면(제목·요약·태그·Markdown 본문) + **입력란 옆 음성(🎤)**

- [x] **발행 미리보기** (`BlogPreviewScreen`) — WordPress 게시 전 확인

- [x] WordPress 발행·자격 증명 검증·미디어 업로드

- [x] 설정 화면(API URL, WP 사이트/계정)

- [x] 위치: `expo-location` + **Google Maps** 링크(검색·좌표·`geo:` 앱)

- [x] **장소 이름 검색 지오코딩** — Nominatim/OSM → lat/lng 저장, GPS와 동일 MapView

- [x] **위치 지도 미리보기** (OSM 정적 기본, 선택적 MapView, 구글 지도 버튼)

- [x] **블로그 미리보기 방문 장소** — 단계 `location`마다 `LocationMapPreview` 임베드

- [x] 음성 입력 — 토글(시작/종료), Expo Go: Alert, 개발·프리뷰 빌드: `expo-speech-recognition` 연속 인식

- [x] Expo SDK **54** 고정 (Play 스토어 Expo Go 호환)



---



## 백로그 (Backlog)



- [ ] SEO: Yoast 메타 필드 자동 매핑 강화

- [ ] Google Static Maps API (선택, API 키 있을 때 정적 미리보기 품질 향상)

- [ ] AI 옵션을 설정 화면에 저장(기본 페르소나·타겟) — UI는 우선 제거됨

- [ ] 단계 이미지 API 업로드 후 본문 자동 삽입

- [ ] 오프라인 초안 동기화

- [ ] EAS 개발 빌드 CI + `expo-speech-recognition` 플러그인 포함

- [ ] HomeScreen 단계 캡션 음성 — 현재는 편집 화면 우선



---



## 진행 중 (In Progress)



- [ ] SEO 4단계 마무리 (발췌·태그 품질, WP 메타)

- [ ] 음성·지도: EAS `preview` APK 실기 QA — [ANDROID_BUILD.md](./ANDROID_BUILD.md) 체크리스트

- [ ] 수동 QA 체크리스트 정기 실행



---



## 완료 (Done)



- MVP 캡처·단계·AI·WP·설정·Google Maps 링크

- react-native-maps 위치 미리보기 + OSM 폴백·구글 지도 열기

- BlogPreviewScreen 방문 장소 지도 카드 (`LocationMapPreview`)

- 장소 이름 검색 지오코딩 (Nominatim + expo-location)

- BlogPreviewScreen + EditScreen 「미리보기」

- Expo Go 음성 인식 크래시 방지 + 편집 화면 🎤

- `docs/DEVELOPMENT_PLAN.md` (본 문서)



---



## 실행 방법



### API (Node, 포트 기본 3001)



```bash

# 저장소 루트

npm run api



# Windows 재시작

npm run api:restart

```



환경 변수: `apps/api/.env` (`.env.example` 참고)



- `OPENAI_API_KEY` — 있으면 OpenAI, 없으면 fallback

- `WP_SITE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD` — WordPress



### 모바일 (Expo SDK 54)



```bash

cd apps/mobile

npm install

npx expo start -c

```



또는 루트:



```bash

npm run mobile

```



**주의:** 루트에서 `npx expo start` 하지 마세요. SDK 55 혼선 → Expo Go 오류.



**신규:** `react-native-maps` 설치 후 Metro 캐시 클리어(`-c`) 권장.



### Android 실기기 빌드·설치



자세한 내용은 **[ANDROID_BUILD.md](./ANDROID_BUILD.md)** 를 참고하세요.



| 방법 | 명령·요약 |

|------|-----------|

| **EAS APK** | `cd apps/mobile` → `eas build --platform android --profile preview` |

| **로컬 APK** | `cd apps/mobile` → `npx expo run:android` |

| **Expo Go** | `npx expo start -c` (음성 등 네이티브 제한) |

| **API URL** | 실기기는 PC IP (예: `http://192.168.0.10:3001`) |



### Git



```bash

git status

git add ...

git commit -m "메시지"

```



커밋·푸시는 팀 규칙에 따릅니다. `.env`는 커밋하지 않습니다.



---



## 알려진 이슈



| 이슈 | 설명 | 대응 |

|------|------|------|

| Expo SDK 54 | Play 스토어 Expo Go는 SDK 54까지 | `apps/mobile`만 expo 실행 |

| API 재시작 | `.env` 변경 후 반영 안 됨 | `npm run api:restart` |

| 음성 입력 | 네이티브 모듈 | Expo Go: Alert. 개발 빌드: `expo run:android` |

| OSM 정적 타일 | 일부 네트워크에서 로드 실패 | 다중 URL 시도 → 카드 UI + 구글 지도 버튼 |

| MapView (Android 프리뷰) | API 키 없으면 **네이티브 크래시** 가능 | **기본 비활성** — OSM 정적만. MapView는 키+`USE_MAP_VIEW` 후 재빌드 |

| Google Maps API 키 | 프리뷰 APK **필수 아님** | 링크·OSM 미리보기는 키 없이 동작. MapView만 키 필요 |

| 장소 이름만 저장 | ~~좌표 없어 지도 미표시~~ | **수정됨:** 저장 시 Nominatim 지오코딩 |

| Nominatim | 사용량·정책 | User-Agent 필수, 과도한 연속 호출 자제 |

| Google Maps | **복귀** | `maps.ts`·API fallback·블로그 Markdown 모두 `google.com/maps` |



---



## 테스트



### 자동 (2026-05-19, 프리뷰 APK 안정화 반영 후)



```bash

# blog-generate (OpenAI 불필요)

npm run api:test-blog



# WordPress verify (API 실행 중, .env 설정 필요)

npm run api:test-verify



# 모바일 타입체크

cd apps/mobile && npx tsc --noEmit



# 지오코딩 스모크 (네트워크 필요)

node apps/mobile/scripts/test-geocode.mjs

```



| 테스트 | 결과 | 비고 |

|--------|------|------|

| `npm run api:test-blog` | ✅ 통과 | Google Maps URL·naver 치환·fallback 본문 |

| `tsc --noEmit` (mobile) | ✅ 통과 | mapConfig, LocationMapPreview, VoiceInputButton |

| `test-geocode.mjs` | ✅ 통과 | Nominatim 「강남역」 스모크 |

| ExpoSpeechRecognition | ✅ 안전 | 네이티브 없으면 import 생략 |



### 수동 체크리스트



#### 위치 지도 (Expo Go / 프리뷰 APK)



- [ ] 단계에서 **현재 위치** 탭 → 권한 허용 → 장소명·좌표 카드 표시 (**앱 크래시 없음**)

- [ ] **프리뷰 APK (기본):** OSM 정적 미리보기 이미지 표시 (API 키 없이)

- [ ] OSM 실패 시 「지도 미리보기를 불러오지 못했습니다」+ 좌표 표시

- [ ] (선택) `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` + `EXPO_PUBLIC_USE_MAP_VIEW=true` 재빌드 후 MapView·마커 확인

- [ ] **장소 이름** 입력 → 「장소 저장」 → 지오코딩 로딩 → MapView·마커·좌표 표시 (현재 위치와 동일)

- [ ] 존재하지 않는 장소명 → 실패 Alert

- [ ] **구글 지도에서 열기** → Google Maps 앱(`geo:`) 또는 웹

- [ ] 작성완료 후에도 저장된 `step.location` (lat/lng 포함) 유지



#### 블로그 미리보기



- [ ] AI 글쓰기 후 편집 화면 → **미리보기** 탭

- [ ] 제목(큰 글씨)·요약·태그 칩·본문 `#` `##` `**` 링크 렌더 확인

- [ ] 본문 내 `📍 [장소](google.com/maps...)` 탭 시 구글 지도 열림

- [ ] **방문 장소** 섹션에 단계별 `LocationMapPreview`(OSM 정적 또는 MapView) 표시

- [ ] 지도·「구글 지도에서 열기」 탭 → 올바른 위치로 구글 지도 열림

- [ ] 첫 단계 사진이 대표 이미지로 표시

- [ ] 단계 사진 섹션 표시

- [ ] **편집으로** → 편집 화면 복귀

- [ ] **WordPress 등록** → 발행 화면 이동



#### 기타



- [ ] API `GET /health` → `ok: true`

- [ ] 단계 캡처·갤러리·작성완료·수정

- [ ] AI 글쓰기 → Google Maps Markdown 링크 포함

- [ ] Expo Go 편집 화면 🎤 탭 시 크래시 없음 (Alert)

- [ ] **프리뷰/개발 빌드:** 🎤 첫 탭 → 「듣는 중…」→ 말하기 → 🎤 다시 탭 → 텍스트 반영

- [ ] WordPress 검증·발행(설정된 경우)



---



## 저장소 구조 (요약)



```

9ruDocs/

  apps/api/          # Node HTTP API

  apps/mobile/       # Expo React Native (+ react-native-maps)

  docs/              # 개발 문서 (본 파일, ANDROID_BUILD.md)

  scripts/           # API 재시작, Expo 정리 등

```



---



## 변경 이력 (요약)



- **2026-05-19 (프리뷰)**: OSM 정적 지도 기본·MapView 옵션, 음성 토글, `app.config.js` Google Maps 키

- **2026-05-19 (심야)**: Google Maps URL 복귀, BlogPreviewScreen `LocationMapPreview` 임베드

- **2026-05-19 (밤)**: 장소 이름 Nominatim 지오코딩, ANDROID_BUILD.md, eas.json preview

- **2026-05-19 (저녁)**: react-native-maps 지도 미리보기, BlogPreviewScreen, EditScreen 미리보기 버튼

- **2026-05-19 (오후)**: 편집 화면 🎤, OSM zoom·폴백 UI

- **2026-05-19 (오전)**: Expo Go 음성 크래시 수정, AI 옵션 UI 제거

- ~~네이버 지도 URL~~ → **Google Maps 복귀** (`google.com/maps`, `geo:`)

- BlogPreviewScreen 방문 장소 지도 카드

- AI 페르소나 프롬프트 및 API 옵션 필드

- `expo-speech-recognition` 음성 입력 (개발 빌드)

- 본 개발 계획 문서 추가



# Android 빌드 및 실기기 설치 가이드 (Windows)

9ruDocs 모바일 앱(`apps/mobile`)을 Android 폰에 설치해 테스트하는 방법입니다.

---

## 사전 준비

| 항목 | 설명 |
|------|------|
| **Node.js** | LTS 권장 (저장소 루트·`apps/mobile`에서 `npm install` 완료) |
| **Android Studio** | SDK Platform, Build-Tools, Platform-Tools 설치 |
| **JDK 17** | Android Studio 번들 JDK 또는 [Temurin 17](https://adoptium.net/) |
| **USB 디버깅** | 폰: 설정 → 개발자 옵션 → USB 디버깅 ON |
| **Expo 계정** | EAS Build 사용 시 [expo.dev](https://expo.dev) 가입 |

환경 변수(권장):

- `ANDROID_HOME` — Android SDK 경로 (예: `C:\Users\<사용자>\AppData\Local\Android\Sdk`)
- `JAVA_HOME` — JDK 17 경로

PowerShell에서 SDK 확인:

```powershell
adb version
```

---

## API URL (실기기 필수)

Expo Go·개발 빌드·**프리뷰 APK** 모두 **PC의 API 서버**에 접속해야 합니다.

> **프리뷰 APK만의 차이:** Expo Go에서는 개발 중 ⚙ 설정에 PC IP를 넣어 두었을 수 있지만, **새로 설치한 APK는 AsyncStorage가 비어** 기본값 `http://192.168.0.1:3001`(placeholder)일 수 있습니다. **AI 생성 전에 반드시 ⚙에서 PC IP로 바꾸세요.**

### 프리뷰 APK — PC API 설정 (AI 생성 전 필수)

1. PC에서 API 실행: `scripts\start-api.bat` 또는 저장소 루트 `npm run api` (포트 **3001**)
2. PC IP 확인: cmd → `ipconfig` → **무선 LAN Wi-Fi** IPv4 (예: `192.168.0.10`)
3. 폰에 APK 설치 후 앱 실행 → 상단 **⚠ PC API 주소를 설정하세요** 배너 또는 첫 실행 Alert 확인
4. **⚙ 설정** → `http://192.168.0.10:3001` 입력 → **저장 후 API 연결 테스트** 성공 확인
5. PC·폰 **같은 Wi-Fi**, Windows 방화벽에서 **Node.js** 허용
6. `localhost` / `10.0.2.2` 는 실기기에서 PC API에 연결되지 않음

연결 실패 시: API 재시작(`scripts\restart-api.bat`), IP 재확인, 방화벽, VPN 끄기.

### (선택) 빌드 시 API URL 고정

PC IP를 빌드 전에 알고 있다면 EAS 빌드 시 환경 변수로 넣을 수 있습니다 (폰에서 다시 설정할 필요 감소).

```powershell
cd apps\mobile
eas build --platform android --profile preview --env EXPO_PUBLIC_API_URL=http://192.168.0.10:3001
```

또는 [eas.json](../apps/mobile/eas.json) `preview.env.EXPO_PUBLIC_API_URL` 에 LAN IP를 넣고 재빌드.  
**IP가 바뀌면** 앱 ⚙ 설정에서 수정하거나 재빌드하세요.

HTTP API는 `app.json` / `app.config.js` 의 `android.usesCleartextTraffic: true` 로 허용됩니다.

---

## 방법 A: EAS Build (클라우드 APK, 권장)

Expo 계정으로 로그인 후 클라우드에서 APK를 빌드합니다. Android Studio 없이도 설치 파일을 받을 수 있습니다.

```powershell
cd apps\mobile
npm install -g eas-cli
eas login
eas build:configure   # 최초 1회 (eas.json 이미 있음)
eas build --platform android --profile preview
```

- `preview` 프로필: **APK** (`distribution: internal`)
- 빌드 완료 후 터미널·[expo.dev](https://expo.dev) 대시보드에서 **다운로드 링크** 제공
- 링크를 폰 브라우저로 열어 APK 설치 (「출처를 알 수 없는 앱」 허용)

---

## 방법 B: 로컬 개발 빌드 (USB + `expo run:android`)

음성 인식(`expo-speech-recognition`) 등 네이티브 모듈을 포함한 **개발용 APK**를 PC에서 직접 빌드·설치합니다.

```powershell
cd apps\mobile
npm install
npx expo prebuild --platform android   # android/ 폴더 최초 생성 시
npx expo run:android
```

- USB로 연결된 기기에 자동 설치·실행
- APK 위치(빌드 후):  
  `apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk`
- 다른 기기에 복사해 설치하려면 위 APK를 USB·카카오톡 등으로 전달

**재빌드만:**

```powershell
cd apps\mobile\android
.\gradlew assembleDebug
```

---

## 방법 C: Expo Go (빠른 UI 테스트)

```powershell
cd apps\mobile
npx expo start -c
```

Play 스토어 **Expo Go**(SDK **54**) 설치 후 QR 코드 스캔.

| 가능 | 제한 |
|------|------|
| 캡처, AI, WP, 지도 미리보기, 현재 위치 | `expo-speech-recognition` 네이티브 음성 — **개발 빌드 필요** |
| API는 PC IP로 설정 | 스토어 배포용 APK 아님 |

---

## APK를 폰에 설치하기

### USB (adb)

```powershell
adb devices
adb install -r apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

`-r`: 기존 앱 덮어쓰기

### 파일 공유

1. EAS 빌드 링크 또는 `app-debug.apk`를 폰으로 전송
2. 파일 관리자에서 APK 탭 → 설치
3. Android 8+: 「이 출처 허용」 설정 필요할 수 있음

---

## Google Maps API 키 (선택)

**프리뷰 APK 기본 동작:** 앱 내 지도 미리보기는 **OSM 정적 이미지**를 사용합니다. **Google Maps API 키 없이도** 위치 저장·「구글 지도에서 열기」는 동작합니다.

| 목적 | API 키 필요? |
|------|----------------|
| OSM 정적 미리보기 + `openGoogleMaps` 링크 | **아니오** |
| 앱 안 `react-native-maps` MapView (Android) | **예** (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` + `EXPO_PUBLIC_USE_MAP_VIEW=true`) |

MapView 없이 API 키를 넣지 않으면, 예전처럼 위치 탭 시 앱이 강제 종료되는 문제를 피할 수 있습니다.

네이티브 MapView를 쓰려면:

1. [Google Cloud Console](https://console.cloud.google.com/)에서 Maps SDK for Android 키 발급
2. EAS 빌드 시 시크릿 또는 `.env`에 설정:

   ```env
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_android_maps_key
   EXPO_PUBLIC_USE_MAP_VIEW=true
   ```

3. `apps/mobile/app.config.js`가 빌드 시 `android.config.googleMaps.apiKey`에 주입합니다.
4. **키·플래그 변경 후** `eas build` 또는 `npx expo prebuild`로 **재빌드**해야 반영됩니다.

---

## 프리뷰 APK 수동 QA (지도·음성)

EAS `preview` APK 설치 후:

### API·AI

- [ ] ⚙ 설정에서 PC IP (`http://192.168.x.x:3001`) 입력 → 연결 테스트 성공
- [ ] **AI 글쓰기** 성공 (「PC API에 연결할 수 없습니다」 없음)

### 위치·지도

- [ ] 단계 **현재 위치** → 권한 허용 → 로딩 후 「위치 저장됨」·장소 카드·지도 미리보기 (실패해도 좌표·구글 지도 버튼)
- [ ] **장소 이름** 저장 → 지오코딩 후 미리보기·좌표 표시
- [ ] 지도 영역·**구글 지도에서 열기** → Google Maps 앱 또는 웹 (크래시 없음)
- [ ] (선택) API 키 + `USE_MAP_VIEW` 설정 후 재빌드 → MapView·마커 확인

### 음성 (개발/프리뷰 빌드)

- [ ] 편집·단계 설명 옆 🎤 **첫 탭** → 「듣는 중…」·빨간 마이크
- [ ] 말한 뒤 🎤 **다시 탭** → 인식 종료·텍스트 입력란에 반영
- [ ] Expo Go: 🎤 탭 시 Alert만 (크래시 없음)

---

## 자주 묻는 문제

| 증상 | 해결 |
|------|------|
| API 연결 실패 (프리뷰 APK) | ⚙에서 `http://PC의IPv4:3001` 설정, `scripts\start-api.bat`, 같은 Wi-Fi, placeholder(192.168.0.1) 아닌지 확인 |
| Expo Go는 되는데 APK만 실패 | Expo Go에 저장된 IP ≠ APK 기본값 — APK ⚙에서 다시 입력 |
| 지도 미리보기만 실패 | 좌표·「구글 지도에서 열기」는 동작해야 함. Wi-Fi·OSM 차단 시 정상 |
| `SDK location not found` | Android Studio SDK 설치, `ANDROID_HOME` 설정 |
| Gradle/JDK 오류 | JDK 17, Android Studio 최신 SDK |
| Expo Go SDK 불일치 | 반드시 `apps/mobile`에서만 `expo start` (SDK 54) |
| EAS 빌드 실패 | `eas login`, `app.json`의 `android.package` 확인 |
| 위치 탭 시 앱 강제 종료 | MapView+API 키 없는 빌드 — 최신 코드는 OSM 정적 기본. 재빌드 후 확인 |

---

## 관련 문서

- [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) — 전체 개발 계획·테스트
- `apps/mobile/eas.json` — EAS `preview` / `development` / `production` 프로필

# 9ruDocs Mobile (Expo SDK 54)

Play 스토어 **Expo Go**는 현재 **SDK 54**까지 지원합니다. 이 앱은 SDK 54에 고정되어 있습니다.

## 실행 (올바른 방법)

```bash
cd apps/mobile
npm install
npx expo install expo-speech-recognition
npx expo start -c
```

음성 입력(`expo-speech-recognition`)은 네이티브 모듈입니다. Expo Go에서 동작하지 않으면 `npx expo run:android` 등 **개발 빌드**를 사용하세요.

저장소 루트(`9ruDocs`)에서:

```bash
npm run mobile
```

## 하지 말 것

| 금지 | 이유 |
|------|------|
| `9ruDocs` 루트에서 `npx expo start` | 루트 `node_modules`에 예전 **SDK 55** expo가 남으면 그 버전으로 Metro가 뜸 |
| 루트에서 `npm install expo` | `package.json`에 없어도 `node_modules`만 생겨 혼선 유발 |
| `expo upgrade`로 SDK 55 올리기 | Play 스토어 Expo Go와 불일치 |

## "Project requires a newer version of Expo Go" 가 반복되는 이유

1. **잘못된 폴더** — 루트에서 `npx expo` → SDK **55** 번들 제공, 폰의 Expo Go는 SDK **54** → 위 오류
2. **루트 `node_modules` 잔여물** — 과거 루트 `package.json`에 expo가 있었거나, 루트에서 expo를 설치한 적이 있으면 `node_modules/expo@55`가 남음 (`package.json`에는 expo 없음)
3. **`apps/mobile` 미정리** — mobile은 54인데 캐시/옛 lockfile이 섞이면 간헐적 불일치
4. **Expo Go 미업데이트** — 드물게 스토어 앱이 너무 오래된 경우 (보통은 1~3번)

`@expo/require-utils@55.x` 같은 패키지 이름의 **55**는 SDK 버전이 아닙니다. **`expo` 패키지 major**만 보면 됩니다.

## 한 번에 고치기

Windows:

```bat
scripts\upgrade-mobile-expo.bat
cd apps\mobile
npx expo start -c
```

또는 루트 잔여물만 제거:

```bash
npm run clean:root-expo
```

## SDK 확인

```bash
cd apps/mobile
node -e "console.log(require('expo/package.json').version)"
# 54.x.x 이어야 함
```

`npm start` 시 `[9ruDocs mobile] Expo SDK 54` 메시지가 보이면 정상입니다.
